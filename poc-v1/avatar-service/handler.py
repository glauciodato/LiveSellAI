"""
Gera um vídeo de avatar falando um texto arbitrário, a partir de um vídeo
de origem (voz + rosto) já enviado ao Azure Blob Storage.

Roda em dois modos, na mesma imagem Docker:
  - RunPod Serverless (sem argumentos de linha de comando -- é assim que o
    RunPod inicia o container): fica escutando jobs indefinidamente.
  - CLI manual (com argumentos --video-url/--upload-url/--text): roda um
    único job e imprime o resultado -- útil para testar dentro de um Pod
    alugado sob demanda (ex: Vast.ai, via SSH/terminal web).

Pipeline:
  1. Baixa o vídeo de origem (URL com SAS de leitura)
  2. Extrai um trecho curto de áudio limpo do próprio vídeo (referência de voz)
  3. Transcreve esse trecho com Whisper (necessário para o F5-TTS)
  4. Sintetiza o texto novo clonando a voz da referência, com F5-TTS
  5. Gera o vídeo com sincronização labial (áudio novo + vídeo original), com MuseTalk
  6. Envia o resultado para o Azure Blob Storage (URL com SAS de escrita)

Entrada esperada (event["input"]):
  {
    "videoUrl": "https://...blob.core.windows.net/.../origem.mp4?<SAS leitura>",
    "uploadUrl": "https://...blob.core.windows.net/.../avatar.mp4?<SAS escrita>",
    "text": "Texto que o avatar deve falar",
    "referenceClipStartSeconds": 0,      # opcional
    "referenceClipDurationSeconds": 12   # opcional
  }

Saída:
  { "status": "completed", "blobUrl": "https://...avatar.mp4" }
  ou
  { "error": "mensagem" }  (convenção do RunPod para job com falha)
"""

import glob
import os
import subprocess
import tempfile
import time
import uuid
from urllib.parse import urlsplit

import requests
import yaml

# /workspace/musetalk é o caminho usado dentro da imagem Docker (RunPod/
# Vast.ai). Em setups manuais (ex: setup-manual.sh, Runstack) o MuseTalk é
# clonado em outro lugar (ex: ~/musetalk) -- por isso isso é configurável.
MUSETALK_DIR = os.environ.get("MUSETALK_DIR", "/workspace/musetalk")

# ---------------------------------------------------------------------------
# Cache persistente (Network Volume do RunPod), para não re-baixar os pesos
# dos modelos (vários GB) a cada cold start. Ver README.md deste serviço.
# ---------------------------------------------------------------------------
_VOLUME_ROOT = "/runpod-volume" if os.path.isdir("/runpod-volume") else None


def _setup_cache_dirs() -> None:
    if not _VOLUME_ROOT:
        print("[avatar-service] Nenhum Network Volume detectado em /runpod-volume "
              "-- os pesos serão baixados a cada cold start. Configure um Network "
              "Volume no endpoint do RunPod para evitar isso (ver README.md).")
        return

    hf_home = os.path.join(_VOLUME_ROOT, "hf_cache")
    xdg_cache = os.path.join(_VOLUME_ROOT, "xdg_cache")
    musetalk_models = os.path.join(_VOLUME_ROOT, "musetalk_models")

    os.makedirs(hf_home, exist_ok=True)
    os.makedirs(xdg_cache, exist_ok=True)
    os.makedirs(musetalk_models, exist_ok=True)

    # F5-TTS e afins usam o cache padrão do HuggingFace Hub.
    os.environ.setdefault("HF_HOME", hf_home)
    # openai-whisper usa ~/.cache/whisper por padrão (respeita XDG_CACHE_HOME).
    os.environ.setdefault("XDG_CACHE_HOME", xdg_cache)

    # Redireciona a pasta de pesos do MuseTalk para o volume persistente.
    musetalk_models_link = os.path.join(MUSETALK_DIR, "models")
    if not os.path.islink(musetalk_models_link):
        if os.path.isdir(musetalk_models_link):
            # Pasta vazia criada pelo próprio repo -- remove antes de linkar.
            try:
                os.rmdir(musetalk_models_link)
            except OSError:
                pass
        if not os.path.exists(musetalk_models_link):
            os.symlink(musetalk_models, musetalk_models_link)


def _ensure_musetalk_weights() -> None:
    models_dir = os.path.join(MUSETALK_DIR, "models")
    # Heurística simples: se a pasta de pesos já tem conteúdo, assume-se pronta.
    has_weights = os.path.isdir(models_dir) and len(os.listdir(models_dir)) > 0
    if has_weights:
        return

    print("[avatar-service] Baixando pesos do MuseTalk (primeira execução)...")
    subprocess.run(
        ["sh", "./download_weights.sh"],
        cwd=MUSETALK_DIR,
        check=True,
    )


# ---------------------------------------------------------------------------
# Etapas do pipeline
# ---------------------------------------------------------------------------

def _download_file(url: str, dest_path: str) -> None:
    with requests.get(url, stream=True, timeout=120) as resp:
        resp.raise_for_status()
        with open(dest_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)


def _extract_reference_audio(video_path: str, out_wav_path: str, start: float, duration: float) -> None:
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-ss", str(start),
            "-t", str(duration),
            "-i", video_path,
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            out_wav_path,
        ],
        check=True,
        capture_output=True,
    )


def _transcribe_reference(wav_path: str) -> str:
    import whisper  # import tardio: carrega o modelo só quando necessário

    model = whisper.load_model("base")
    result = model.transcribe(wav_path)
    text = (result.get("text") or "").strip()
    if not text:
        raise RuntimeError(
            "Não foi possível transcrever o trecho de referência de áudio "
            "(Whisper retornou texto vazio) -- verifique se o vídeo tem fala "
            "clara no trecho selecionado."
        )
    return text


def _synthesize_speech(ref_audio: str, ref_text: str, gen_text: str, out_dir: str, out_file: str) -> str:
    os.makedirs(out_dir, exist_ok=True)

    cmd = [
        "f5-tts_infer-cli",
        "--model", "F5TTS_v1_Base",
        "--ref_audio", ref_audio,
        "--ref_text", ref_text,
        "--gen_text", gen_text,
        "--output_dir", out_dir,
        "--output_file", out_file,
    ]

    # Permite plugar um checkpoint/vocab ajustado para português (ou outro
    # idioma), sem alterar código -- ver SHARED.md do F5-TTS para modelos da
    # comunidade. Ex: F5TTS_CKPT_FILE=/caminho/model.pt
    ckpt_file = os.environ.get("F5TTS_CKPT_FILE")
    vocab_file = os.environ.get("F5TTS_VOCAB_FILE")
    if ckpt_file:
        cmd += ["--ckpt_file", ckpt_file]
    if vocab_file:
        cmd += ["--vocab_file", vocab_file]

    subprocess.run(cmd, check=True)

    output_path = os.path.join(out_dir, out_file)
    if not os.path.isfile(output_path):
        raise RuntimeError(f"F5-TTS não gerou o arquivo esperado em {output_path}")
    return output_path


def _run_musetalk(video_path: str, audio_path: str, job_id: str) -> str:
    result_dir = os.path.join("/tmp", "musetalk_results", job_id)
    os.makedirs(result_dir, exist_ok=True)

    config_path = os.path.join("/tmp", f"musetalk_config_{job_id}.yaml")
    task_name = "avatar"
    config = {
        task_name: {
            "video_path": video_path,
            "audio_path": audio_path,
        }
    }
    with open(config_path, "w") as f:
        yaml.safe_dump(config, f)

    unet_model_path = os.path.join(MUSETALK_DIR, "models", "musetalkV15", "unet.pth")
    unet_config_path = os.path.join(MUSETALK_DIR, "models", "musetalkV15", "musetalk.json")

    subprocess.run(
        [
            "python", "-m", "scripts.inference",
            "--inference_config", config_path,
            "--result_dir", result_dir,
            "--unet_model_path", unet_model_path,
            "--unet_config", unet_config_path,
            "--version", "v15",
            "--ffmpeg_path", "/usr/bin",
            "--use_float16",  # reduz o uso de VRAM (~metade), à custa de precisão
        ],
        cwd=MUSETALK_DIR,
        check=True,
    )

    # A estrutura exata de subpastas do result_dir pode variar entre versões
    # do MuseTalk -- em vez de depender de um caminho fixo, pega o .mp4 mais
    # recente gerado dentro do result_dir.
    generated = sorted(
        glob.glob(os.path.join(result_dir, "**", "*.mp4"), recursive=True),
        key=os.path.getmtime,
    )
    if not generated:
        raise RuntimeError(f"MuseTalk não gerou nenhum vídeo .mp4 em {result_dir}")
    return generated[-1]


def _upload_result(local_path: str, upload_url: str) -> None:
    with open(local_path, "rb") as f:
        data = f.read()

    resp = requests.put(
        upload_url,
        data=data,
        headers={
            "x-ms-blob-type": "BlockBlob",
            "Content-Type": "video/mp4",
        },
        timeout=300,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(
            f"Falha ao enviar o vídeo gerado para o Azure Blob Storage "
            f"(HTTP {resp.status_code}): {resp.text}"
        )


def _strip_query(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}{parts.path}"


# ---------------------------------------------------------------------------
# Núcleo do pipeline -- independente de RunPod, reaproveitado pelo handler()
# (modo serverless) e pelo modo CLI (teste manual, ex: dentro de um Pod do
# Vast.ai via SSH, sem depender de nenhuma convenção específica do RunPod).
# ---------------------------------------------------------------------------

def process_job(job_id: str, video_url: str, upload_url: str, text: str,
                 ref_start: float = 0, ref_duration: float = 12) -> dict:
    work_dir = tempfile.mkdtemp(prefix=f"avatar_{job_id}_")
    t0 = time.time()

    try:
        _setup_cache_dirs()
        _ensure_musetalk_weights()

        source_video_path = os.path.join(work_dir, "source.mp4")
        print(f"[avatar-service] Baixando vídeo de origem: {_strip_query(video_url)}")
        _download_file(video_url, source_video_path)

        reference_wav_path = os.path.join(work_dir, "reference.wav")
        _extract_reference_audio(source_video_path, reference_wav_path, ref_start, ref_duration)

        print("[avatar-service] Transcrevendo trecho de referência com Whisper...")
        reference_text = _transcribe_reference(reference_wav_path)

        print("[avatar-service] Sintetizando fala com F5-TTS (clonagem de voz)...")
        synthesized_audio_path = _synthesize_speech(
            ref_audio=reference_wav_path,
            ref_text=reference_text,
            gen_text=text,
            out_dir=os.path.join(work_dir, "tts_out"),
            out_file="generated.wav",
        )

        print("[avatar-service] Gerando vídeo com sincronização labial (MuseTalk)...")
        output_video_path = _run_musetalk(source_video_path, synthesized_audio_path, job_id)

        print(f"[avatar-service] Enviando resultado para o Azure Blob Storage...")
        _upload_result(output_video_path, upload_url)

        elapsed = round(time.time() - t0, 1)
        print(f"[avatar-service] Concluído em {elapsed}s")

        return {
            "status": "completed",
            "blobUrl": _strip_query(upload_url),
            "referenceTranscript": reference_text,
            "elapsedSeconds": elapsed,
        }
    except subprocess.CalledProcessError as exc:
        return {"error": f"Falha ao executar '{' '.join(exc.cmd)}' (código {exc.returncode})"}
    except Exception as exc:  # noqa: BLE001 -- handler de topo precisa capturar tudo
        return {"error": str(exc)}


# ---------------------------------------------------------------------------
# Modo 1: RunPod Serverless -- handler(event) é a convenção esperada pelo
# pacote `runpod`, que fica escutando jobs indefinidamente.
# ---------------------------------------------------------------------------

def handler(event):
    job_id = event.get("id") or str(uuid.uuid4())
    job_input = event.get("input") or {}

    video_url = job_input.get("videoUrl")
    upload_url = job_input.get("uploadUrl")
    text = job_input.get("text")

    if not video_url or not upload_url or not text:
        return {"error": 'Campos obrigatórios ausentes em "input": videoUrl, uploadUrl, text.'}

    return process_job(
        job_id=job_id,
        video_url=video_url,
        upload_url=upload_url,
        text=text,
        ref_start=float(job_input.get("referenceClipStartSeconds", 0)),
        ref_duration=float(job_input.get("referenceClipDurationSeconds", 12)),
    )


# ---------------------------------------------------------------------------
# Modo 2: CLI manual -- útil para testar o pipeline direto dentro de um Pod
# alugado sob demanda (ex: Vast.ai, via SSH/terminal web), sem precisar de
# nenhuma infraestrutura de "serverless endpoint" pronta. Exemplo:
#
#   python handler.py \
#     --video-url "https://.../origem.mp4?<SAS leitura>" \
#     --upload-url "https://.../avatar.mp4?<SAS escrita>" \
#     --text "Olá! Este é um teste do avatar."
# ---------------------------------------------------------------------------

def _run_cli() -> None:
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Gera um avatar falando um texto, a partir de um vídeo.")
    parser.add_argument("--video-url", required=True, help="URL (com SAS de leitura) do vídeo de origem.")
    parser.add_argument("--upload-url", required=True, help="URL (com SAS de escrita) para o vídeo resultante.")
    parser.add_argument("--text", required=True, help="Texto que o avatar deve falar.")
    parser.add_argument("--ref-start", type=float, default=0, help="Início (s) do trecho de referência de voz.")
    parser.add_argument("--ref-duration", type=float, default=12, help="Duração (s) do trecho de referência de voz.")
    args = parser.parse_args()

    result = process_job(
        job_id=str(uuid.uuid4()),
        video_url=args.video_url,
        upload_url=args.upload_url,
        text=args.text,
        ref_start=args.ref_start,
        ref_duration=args.ref_duration,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        # Rodando com argumentos de linha de comando -> modo manual/teste.
        _run_cli()
    else:
        # Sem argumentos (é assim que o RunPod inicia o container) -> modo
        # serverless, escutando jobs indefinidamente.
        import runpod

        runpod.serverless.start({"handler": handler})
