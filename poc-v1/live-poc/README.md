# Validação: live com vídeo em loop + reação a comentários

Protótipo pra validar viabilidade técnica (ver história no `BACKLOG.md`):
um vídeo de produto em loop, conectado ao chat de uma live real do YouTube.
Ao chegar o primeiro comentário, dispara um áudio de apresentação.

**Não é a versão final do produto** — é uma página HTML autocontida, sem
build, sem backend, só pra provar que a integração funciona de verdade
contra uma live real.

## Como rodar

Abre o arquivo `index.html` direto no navegador, ou sirva localmente:

```bash
cd poc-v1/live-poc
npx serve .
```

## Passo a passo pra testar

### 1. Conseguir uma API key do YouTube Data API v3

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um projeto (ou use um existente)
3. Em "APIs e serviços" → "Biblioteca", ative a **YouTube Data API v3**
4. Em "APIs e serviços" → "Credenciais", crie uma **API key**
5. (Recomendado) Restrinja a key por referenciador HTTP (seu domínio/localhost) pra evitar uso indevido — a leitura do chat funciona só com API key, sem precisar de OAuth

### 2. Criar uma live de teste no YouTube

1. Vá em [studio.youtube.com](https://studio.youtube.com) → "Criar" → "Iniciar transmissão ao vivo"
2. Pode ser uma live **não listada**, só pra teste
3. Copie o **ID do vídeo** da live (a parte depois de `v=` na URL, ex:
   `https://www.youtube.com/watch?v=dQw4w9WgXcQ` → `dQw4w9WgXcQ`)

### 3. Preencher a página

- **URL do vídeo do produto**: qualquer vídeo de exemplo (mp4 acessível publicamente)
- **URL do áudio de apresentação**: qualquer áudio de exemplo (mp3 acessível publicamente)
- **ID do vídeo da live**: o que você copiou no passo 2
- **API key**: a que você criou no passo 1

Clica em "Iniciar validação". Comente na sua própria live (de outro
navegador/conta, ou pelo chat do YouTube mesmo) e confira se o comentário
aparece na lista e o áudio de apresentação começa a tocar.

## O que essa validação prova (ou não)

- ✅ Dá pra ler comentários de uma live do YouTube em tempo (quase) real, só
  com uma API key — sem precisar de aprovação de parceiro nem OAuth.
- ✅ Dá pra reagir à chegada de um comentário disparando um áudio.
- ❌ Não testa Instagram/TikTok/Shopee Live — essas plataformas exigem
  aprovação de parceiro pra acessar comentários de live via API, processo
  mais longo (ver observação na história do BACKLOG).
- ❌ Não é tempo real de verdade no sentido de "avatar respondendo com IA
  gerando conteúdo novo" — é um gatilho simples (primeiro comentário →
  toca áudio pré-gravado). Uma versão futura poderia usar o texto do
  comentário pra algo mais elaborado.

## Limitações conhecidas

- A API do YouTube tem cota diária limitada (10.000 unidades/dia por
  padrão) — o polling respeita o `pollingIntervalMillis` que a própria API
  retorna, mas em uso intenso pode esgotar a cota do dia.
- Navegadores bloqueiam áudio automático sem interação prévia do usuário —
  clicar em "Iniciar validação" conta como essa interação, então o áudio
  disparado depois funciona normalmente.
- A API key fica só no navegador (`localStorage`) — nunca é enviada pra
  nenhum backend nosso.
