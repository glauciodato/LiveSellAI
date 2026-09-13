#!/usr/bin/env bash
# Instala manualmente, num Pod de GPU genérico (ex: Runstack, ou qualquer
# máquina Linux com GPU Nvidia + Python), tudo que o Dockerfile deste
# serviço faz automaticamente. Use isto quando o provedor de GPU NÃO
# aceita rodar uma imagem Docker customizada (só templates prontos).
#
# Uso: cole este script inteiro no terminal do Pod, ou salve como
# setup-manual.sh e rode `bash setup-manual.sh`.
#
# Baseado nos ajustes validados ao testar a instalação destas mesmas
# dependências (mmcv/mmdet/mmpose) num Mac sem GPU -- aqui, numa GPU Nvidia
# de verdade, devem instalar até mais fácil, mas os mesmos contornos foram
# mantidos por segurança (--no-build-isolation, Cython antes do mmpose).

set -e

# Distros Debian/Ubuntu recentes (Python 3.11+) bloqueiam "pip install" fora
# de um venv (PEP 668 -- "externally-managed-environment"). Como este é um
# Pod descartável só para este teste, contornamos isso globalmente em vez
# de montar um venv (que complicaria os passos seguintes do MuseTalk). O
# pip deste Pod não respeita a variável de ambiente PIP_BREAK_SYSTEM_PACKAGES
# -- por isso injetamos a flag --break-system-packages logo após "install"
# em toda chamada de pip3 (a flag só é aceita nessa posição, não antes).
pip3() {
  if [ "$1" = "install" ]; then
    shift
    command pip3 install --break-system-packages "$@"
  else
    command pip3 "$@"
  fi
}

echo "=== Ambiente ==="
python3 --version
pip3 --version
nvidia-smi || echo "AVISO: nvidia-smi não encontrado -- confirme que este Pod tem GPU."

echo ""
echo "=== Preparando pip/setuptools ==="
pip3 install --upgrade pip setuptools wheel

echo ""
echo "=== Clonando o MuseTalk ==="
cd ~
if [ ! -d musetalk ]; then
  git clone --depth 1 https://github.com/TMElyralab/MuseTalk.git musetalk
fi
cd ~/musetalk

echo ""
echo "=== Instalando PyTorch 2.0.1 (cu118) ==="
pip3 install torch==2.0.1 torchvision==0.15.2 torchaudio==2.0.2 \
  --index-url https://download.pytorch.org/whl/cu118

echo ""
echo "=== Instalando requirements.txt do MuseTalk ==="
# Tenta primeiro com as versões originais (pinadas pelo próprio MuseTalk).
# Se falhar (comum quando o Python do Pod é mais novo que o testado pelo
# MuseTalk -- ex: numpy==1.23.5 e tensorflow==2.12.0 não têm wheel para
# Python 3.12+), tenta de novo sem nenhuma versão fixada, deixando o pip
# escolher versões compatíveis com este Python automaticamente.
if ! pip3 install -r requirements.txt; then
  echo "Falhou com as versões originais -- tentando sem versões fixadas..."
  sed -E 's/==[0-9][A-Za-z0-9.\-]*//' requirements.txt > /tmp/requirements-patched.txt
  pip3 install -r /tmp/requirements-patched.txt
fi

echo ""
echo "=== Instalando mmengine/mmcv/mmdet/mmpose ==="
pip3 install mmengine
pip3 install --no-build-isolation "mmcv==2.0.1"
pip3 install --no-build-isolation "mmdet==3.1.0"
pip3 install cython numpy
pip3 install --no-build-isolation "mmpose==1.1.0"

echo ""
echo "=== Instalando F5-TTS, Whisper e utilitários do handler ==="
pip3 install f5-tts openai-whisper requests pyyaml

echo ""
echo "=== Baixando handler.py do repositório do projeto ==="
cd ~
if [ ! -d livesellai ]; then
  git clone --depth 1 https://github.com/glauciodato/LiveSellAI.git livesellai
fi
cp livesellai/poc-v1/avatar-service/handler.py ~/musetalk/handler.py

echo ""
echo "=== Baixando os pesos do MuseTalk (pode demorar, são vários GB) ==="
cd ~/musetalk
sh ./download_weights.sh

echo ""
echo "✅ Tudo pronto! Para testar, rode (dentro de ~/musetalk):"
echo ""
echo '  python3 handler.py \'
echo '    --video-url "<SAS de leitura do vídeo de origem>" \'
echo '    --upload-url "<SAS de escrita do vídeo de destino>" \'
echo '    --text "Olá! Este é um teste do avatar."'
