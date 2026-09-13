#!/usr/bin/env bash
# Instala manualmente, num Pod de GPU genérico (ex: Runstack, ou qualquer
# máquina Linux com GPU Nvidia + Python), tudo que o Dockerfile deste
# serviço faz automaticamente. Use isto quando o provedor de GPU NÃO
# aceita rodar uma imagem Docker customizada (só templates prontos).
#
# Uso: cole este script inteiro no terminal do Pod, ou salve como
# setup-manual.sh e rode `bash setup-manual.sh`.
#
# Usa Python 3.10 dedicado (num venv), a mesma versão documentada pelo
# MuseTalk, em vez do Python do sistema (que em Pods recentes costuma ser
# 3.12+ -- muito mais novo do que o MuseTalk foi testado, o que causa uma
# cascata de incompatibilidades: numpy/tensorflow sem wheel, torch 2.0.1
# inexistente para 3.12, e até bugs de compilação C++ com PyTorch muito
# novo). Com Python 3.10 num venv, usamos as versões originais do MuseTalk.

set -e

VENV_DIR="$HOME/musetalk-venv"

echo "=== Instalando Python 3.10 + compilador C++ ==="
apt-get update -qq
if ! apt-get install -y -qq python3.10 python3.10-venv python3.10-dev; then
  echo "python3.10 não disponível nos repositórios padrão -- adicionando deadsnakes PPA..."
  apt-get install -y -qq software-properties-common
  add-apt-repository -y ppa:deadsnakes/ppa
  apt-get update -qq
  apt-get install -y -qq python3.10 python3.10-venv python3.10-dev
fi
apt-get install -y -qq build-essential ffmpeg

echo ""
echo "=== Ambiente ==="
python3.10 --version
nvidia-smi || echo "AVISO: nvidia-smi não encontrado -- confirme que este Pod tem GPU."

echo ""
echo "=== Criando ambiente virtual (venv) com Python 3.10 ==="
if [ ! -d "$VENV_DIR" ]; then
  python3.10 -m venv "$VENV_DIR"
fi
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"
# setuptools recentes (~80+) removeram o módulo pkg_resources, do qual o
# setup.py (legado) do mmcv depende para instalar mesmo com
# --no-build-isolation. Fixamos uma versão anterior a essa remoção.
python -m pip install --upgrade pip wheel "setuptools<81"

echo ""
echo "=== Clonando o MuseTalk ==="
cd ~
if [ ! -d musetalk ]; then
  git clone --depth 1 https://github.com/TMElyralab/MuseTalk.git musetalk
fi
cd ~/musetalk

echo ""
echo "=== Instalando requirements.txt do MuseTalk ==="
pip install -r requirements.txt

echo ""
echo "=== Instalando F5-TTS, Whisper e utilitários do handler ==="
pip install f5-tts openai-whisper requests pyyaml

# bitsandbytes vem como dependência opcional do F5-TTS e exige torch mais
# novo que o 2.0.1 -- ao ser importado (o mmengine tenta, na inicialização,
# registrar otimizadores baseados nele), quebra com AttributeError e derruba
# a importação do mmpose/mmengine inteira. Não precisamos dele aqui.
pip uninstall -y bitsandbytes || true

echo ""
echo "=== Instalando/fixando PyTorch 2.0.1 (cu118) ==="
# Importante: isso roda DEPOIS do F5-TTS/Whisper de propósito -- essas
# libs podem puxar (via suas próprias dependências) uma versão diferente
# de torch. Reinstalamos a versão exata aqui, e só ENTÃO compilamos o
# mmcv logo abaixo, contra essa versão final -- senão o mmcv fica com uma
# extensão C++ compilada contra um torch que já não é mais o instalado
# (erro "undefined symbol" ao importar).
pip install torch==2.0.1 torchvision==0.15.2 torchaudio==2.0.2 \
  --index-url https://download.pytorch.org/whl/cu118

echo ""
echo "=== Instalando mmengine/mmcv/mmdet/mmpose ==="
# Este Pod tem o driver da GPU, mas não o CUDA toolkit completo (falta o
# nvcc) -- por isso essas três instalações rodam com CUDA_VISIBLE_DEVICES=""
# (só durante o build), forçando o mmcv a compilar as versões CPU-only dos
# operadores, em vez de tentar (e falhar) compilar com CUDA. A parte pesada
# de verdade (MuseTalk/F5-TTS/Whisper) continua usando a GPU normalmente --
# só a etapa de detecção de rosto/pose fica em CPU.
pip install mmengine
CUDA_VISIBLE_DEVICES="" pip install --no-build-isolation "mmcv==2.0.1"
CUDA_VISIBLE_DEVICES="" pip install --no-build-isolation "mmdet==3.1.0"
pip install cython numpy
CUDA_VISIBLE_DEVICES="" pip install --no-build-isolation "mmpose==1.1.0"

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
echo "✅ Tudo pronto! Para testar, rode:"
echo ""
echo "  source $VENV_DIR/bin/activate"
echo "  export MUSETALK_DIR=$HOME/musetalk"
echo '  cd ~/musetalk && python handler.py \'
echo '    --video-url "<SAS de leitura do vídeo de origem>" \'
echo '    --upload-url "<SAS de escrita do vídeo de destino>" \'
echo '    --text "Olá! Este é um teste do avatar."'
