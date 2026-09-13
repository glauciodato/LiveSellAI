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

# Mesmo motivo: o F5-TTS também costuma puxar uma versão de transformers
# bem mais nova que a que o MuseTalk pede (4.39.2) -- versões recentes
# têm inclusive um bug próprio (NameError em accelerate.py) que quebra a
# importação do mmdet. Fixamos de volta à versão que o MuseTalk testou.
pip install "transformers==4.39.2"

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
mkdir -p models/musetalk models/musetalkV15 models/syncnet models/dwpose models/face-parse-bisent models/sd-vae models/whisper
pip install -U "huggingface_hub[cli]" gdown

# NÃO usamos o download_weights.sh original do MuseTalk: ele aponta pra um
# mirror chinês do HuggingFace (hf-mirror.com), que se mostrou instável a
# partir daqui -- várias vezes falhou silenciosamente pra arquivos
# específicos sem interromper o script (ele sempre imprime "sucesso" no
# final, mesmo com arquivos faltando). Baixamos direto do HuggingFace
# oficial, um a um, e cada comando é seguro de rodar de novo (só baixa o
# que ainda falta).
hf download TMElyralab/MuseTalk --local-dir models --include "musetalk/musetalk.json" "musetalk/pytorch_model.bin"
hf download TMElyralab/MuseTalk --local-dir models --include "musetalkV15/musetalk.json" "musetalkV15/unet.pth"
hf download stabilityai/sd-vae-ft-mse --local-dir models/sd-vae --include "config.json" "diffusion_pytorch_model.bin"
hf download openai/whisper-tiny --local-dir models/whisper --include "config.json" "pytorch_model.bin" "preprocessor_config.json"
hf download yzd-v/DWPose --local-dir models/dwpose --include "dw-ll_ucoco_384.pth"
hf download ByteDance/LatentSync --local-dir models/syncnet --include "latentsync_syncnet.pt"

if [ ! -f "models/face-parse-bisent/79999_iter.pth" ]; then
  # gdown removeu a flag --id em versões recentes -- o ID vai direto como argumento.
  gdown 154JgKpzCPW82qINcVieuPH3fZ2e0P812 -O models/face-parse-bisent/79999_iter.pth
fi
if [ ! -f "models/face-parse-bisent/resnet18-5c106cde.pth" ]; then
  curl -L https://download.pytorch.org/models/resnet18-5c106cde.pth \
    -o models/face-parse-bisent/resnet18-5c106cde.pth
fi

echo "Conferindo se todos os pesos esperados estão presentes..."
for f in \
  models/musetalk/musetalk.json models/musetalk/pytorch_model.bin \
  models/musetalkV15/musetalk.json models/musetalkV15/unet.pth \
  models/sd-vae/config.json models/sd-vae/diffusion_pytorch_model.bin \
  models/whisper/config.json models/whisper/pytorch_model.bin models/whisper/preprocessor_config.json \
  models/dwpose/dw-ll_ucoco_384.pth \
  models/syncnet/latentsync_syncnet.pt \
  models/face-parse-bisent/79999_iter.pth models/face-parse-bisent/resnet18-5c106cde.pth
do
  if [ ! -f "$f" ]; then
    echo "⚠️  AVISO: $f não foi encontrado -- o teste provavelmente vai falhar nessa etapa."
  fi
done

echo ""
echo "✅ Tudo pronto! Para testar, rode:"
echo ""
echo "  source $VENV_DIR/bin/activate"
echo "  export MUSETALK_DIR=$HOME/musetalk"
echo '  cd ~/musetalk && python handler.py \'
echo '    --video-url "<SAS de leitura do vídeo de origem>" \'
echo '    --upload-url "<SAS de escrita do vídeo de destino>" \'
echo '    --text "Olá! Este é um teste do avatar."'
