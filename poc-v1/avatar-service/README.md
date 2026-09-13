# Avatar Service (MuseTalk + F5-TTS)

Gera um vídeo de avatar falando um texto arbitrário, a partir do vídeo de
~2 minutos que o usuário já enviou na POC (rosto + voz). Pensado para rodar
numa GPU alugada sob demanda (nuvem de GPU), cobrada por uso.

## Pipeline

1. Baixa o vídeo de origem (Azure Blob Storage, via SAS de leitura)
2. Extrai um trecho curto de áudio limpo do próprio vídeo (referência de voz)
3. Transcreve esse trecho com Whisper (o F5-TTS precisa da transcrição da referência)
4. Sintetiza o texto novo clonando a voz da referência, com **F5-TTS**
5. Gera o vídeo com sincronização labial (áudio novo + vídeo original), com **MuseTalk v1.5**
6. Envia o resultado para o Azure Blob Storage (via SAS de escrita)

## Decisões técnicas (ver BACKLOG.md para o contexto completo)

- **MuseTalk v1.5** em vez de LatentSync (mais rápido, MIT/uso comercial liberado,
  precisa de menos VRAM) e em vez de TalkingGaussian/GeneFace++ (não-comerciais,
  dependem do Basel Face Model)
- **F5-TTS** para a voz (clonagem zero-shot a partir de 5–15s do próprio vídeo)
- **GPU cloud sob demanda** em vez de VM sempre ligada — testado primeiro no
  **Vast.ai** (o Azure exige aprovação de cota de GPU, e ainda não foi liberada
  na subscription usada nesta POC — ver observação no `BACKLOG.md`; o RunPod
  também foi cogitado, mas esbarrou num problema de pagamento internacional)

## `handler.py` roda em dois modos, na mesma imagem

- **RunPod Serverless** (sem argumentos — é assim que o RunPod inicia o container):
  fica escutando jobs indefinidamente
- **CLI manual** (com `--video-url`/`--upload-url`/`--text`): roda um único job e
  imprime o resultado — é o modo usado para o teste manual num Pod alugado
  (ver abaixo)

## Build da imagem (GitHub Actions → GHCR)

Diferente do RunPod (que builda direto de um repositório GitHub conectado),
a maioria dos provedores de GPU (Vast.ai incluso) espera uma imagem **já
publicada** num registry. Por isso, a imagem é buildada automaticamente pelo
GitHub Actions (`.github/workflows/avatar-service-image.yml`) a cada push em
`poc-v1/avatar-service/**`, e publicada em:

```
ghcr.io/glauciodato/livesellai/avatar-service:latest
```

**Importante:** depois do primeiro build, acesse a página do pacote no GitHub
(`https://github.com/glauciodato?tab=packages` → `avatar-service`) e mude a
visibilidade para **pública** — assim o Vast.ai (ou qualquer outro provedor)
consegue puxar a imagem sem precisar de credenciais de registry.

> ⚠️ **Build nunca testado de ponta a ponta.** A imagem parte de
> `nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04` e instala PyTorch + MuseTalk +
> F5-TTS — é pesada, e o runner padrão do GitHub Actions tem espaço em disco
> limitado (~14GB). Se o build falhar por falta de espaço, os ajustes mais
> prováveis são: usar um runner maior, ou trocar a imagem base para a variante
> `runtime` (mais leve, mas arriscando perder aceleração de GPU em alguns
> operadores do `mmcv` que dependem do `nvcc` para compilar).

## Opção A (atual): validar manualmente num Pod do Vast.ai

Objetivo: confirmar que o pipeline realmente funciona numa GPU real, antes de
montar a versão "endpoint automático" definitiva.

### 1. Criar conta no Vast.ai

1. Acesse **https://cloud.vast.ai/** e crie uma conta
2. Em **Billing**, adicione uma forma de pagamento — confira diretamente ali
   quais métodos estão disponíveis para você (isso variou entre provedores
   nesta POC, então vale conferir antes de seguir)

### 2. Alugar um Pod on-demand com a imagem publicada

1. Em **https://cloud.vast.ai/create/**, escolha uma GPU (ex: A40, 48GB VRAM)
2. Em **Image**, use a imagem publicada pelo GitHub Actions:
   `ghcr.io/glauciodato/livesellai/avatar-service:latest`
3. Não é necessário mapear portas (o teste é feito via terminal, não HTTP)
4. Alugue o Pod e aguarde ele inicializar

### 3. Entrar no Pod e rodar o pipeline manualmente

Pelo terminal web do Vast.ai (ou SSH, se configurado):

```bash
python handler.py \
  --video-url "<SAS de leitura de um vídeo já no Blob Storage>" \
  --upload-url "<SAS de escrita para o blob de destino>" \
  --text "Olá! Este é um teste do avatar."
```

As URLs com SAS podem ser geradas no Cloud Shell do Azure, do mesmo jeito que
foi feito para testar o upload do vídeo:
```powershell
$ACCOUNT_KEY = az storage account keys list --account-name livesellaipoc4821 --resource-group rg-livesellai-poc --query "[0].value" -o tsv

# Leitura do vídeo de origem já existente:
az storage blob generate-sas --account-name livesellaipoc4821 --account-key $ACCOUNT_KEY --container-name videos --name "<caminho do blob de origem>" --permissions r --expiry <data/hora futura> --https-only -o tsv

# Escrita do vídeo de saída (ainda não existe):
az storage blob generate-sas --account-name livesellaipoc4821 --account-key $ACCOUNT_KEY --container-name videos --name "avatars/teste/avatar.mp4" --permissions cw --expiry <data/hora futura> --https-only -o tsv
```

5. **Não esqueça de parar/deletar o Pod depois do teste** — ele continua
   cobrando enquanto estiver rodando, mesmo sem estar processando nada.

## Opção B: RunPod Serverless (produção, quando o pagamento for resolvido)

Se o problema de pagamento internacional do RunPod for resolvido no futuro,
o mesmo `handler.py` funciona lá sem alterações (ele já suporta o modo
serverless nativo do RunPod):

1. Crie a conta e a API key em **runpod.io**
2. Em **Serverless → New Endpoint**, use a imagem publicada no GHCR (em vez
   de conectar o GitHub, já que preferimos manter o build centralizado no
   GitHub Actions) — ou conecte o repositório GitHub diretamente, se preferir
   deixar o RunPod buildar
3. Configure um **Network Volume** (30–50GB) para cachear os pesos dos modelos
4. Configure `RUNPOD_API_KEY` e `RUNPOD_ENDPOINT_ID` em
   `poc-v1/backend/local.settings.json` — o backend já tem os endpoints
   `generate-avatar` e `avatar-status` prontos para orquestrar isso

## Limitações conhecidas desta POC

- **Não testado em GPU real ainda** — o código foi escrito com base na
  documentação oficial do MuseTalk e do F5-TTS, e as dependências mais
  arriscadas (`mmcv`, `mmdet`, `mmpose`) foram validadas quanto à
  instalação (num Mac, sem GPU) — mas o pipeline completo, numa GPU de
  verdade, ainda não rodou. É esperado que a primeira execução real exija
  ajustes (versões de dependências, caminhos de saída, etc.)
- O build da imagem via GitHub Actions também nunca foi executado de fato
  (ver observação acima sobre espaço em disco do runner)
- A extração do trecho de referência de voz é ingênua (pega os primeiros
  segundos do vídeo, configurável via `--ref-start`/`--ref-duration` no modo
  CLI, ou `referenceClipStartSeconds`/`referenceClipDurationSeconds` no modo
  RunPod) — não valida se esse trecho tem fala limpa o suficiente
- F5-TTS, sem um checkpoint específico, tem suporte melhor a inglês/chinês;
  para português, recomenda-se plugar um checkpoint da comunidade (ver
  `SHARED.md` do repositório do F5-TTS) através das variáveis de ambiente
  `F5TTS_CKPT_FILE` e `F5TTS_VOCAB_FILE`
- Ainda não existe tela no app para disparar a geração do avatar e
  acompanhar o status
