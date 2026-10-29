# Serviço de geração de avatar (MuseTalk + F5-TTS), pensado para rodar como
# RunPod Serverless Endpoint (GPU sob demanda).
#
# Imagem propositalmente NÃO baixa os pesos dos modelos no build (eles somam
# vários GB) — isso é feito em runtime, uma única vez, e cacheado num Network
# Volume do RunPod (ver README.md). Isso mantém o build da imagem rápido.

FROM nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3.10 python3.10-venv python3-pip \
        git ffmpeg wget ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3.10 /usr/bin/python \
    && ln -sf /usr/bin/pip3 /usr/bin/pip

WORKDIR /workspace

# ---- MuseTalk (código; pesos baixados em runtime, ver handler.py) ----
RUN git clone --depth 1 https://github.com/TMElyralab/MuseTalk.git musetalk

WORKDIR /workspace/musetalk

RUN pip install torch==2.0.1 torchvision==0.15.2 torchaudio==2.0.2 \
        --index-url https://download.pytorch.org/whl/cu118

RUN pip install -r requirements.txt

RUN pip install -U openmim \
    && mim install mmengine \
    && mim install "mmcv==2.0.1" \
    && mim install "mmdet==3.1.0" \
    && mim install "mmpose==1.1.0"

# ---- F5-TTS (clonagem de voz + TTS) e utilitários do handler ----
WORKDIR /workspace
RUN pip install f5-tts openai-whisper runpod requests pyyaml

COPY handler.py /workspace/handler.py

CMD ["python", "-u", "handler.py"]
