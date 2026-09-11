# LiveSellAI — POC v1

Primeira versão (prova de conceito) do LiveSellAI: acesso por e-mail
(estrutura multi-tenant simplificada) e upload de vídeo para o Azure Blob
Storage, rodando a partir do mesmo código em Web, iOS e Android.

## Estrutura

```
poc-v1/
├── app/       App Expo (React Native + Web) — tela de e-mail e upload de vídeo
├── backend/   Azure Function leve — gera o SAS token de upload sob demanda
└── infra/     Script para criar a Storage Account/container no Azure
```

### Por que um backend, mesmo em uma POC?

O app nunca tem acesso à chave/connection string da Storage Account. Ele
pede ao backend um SAS token (Shared Access Signature) de curta duração,
escopado a um único blob, e faz o upload do vídeo **diretamente** para o
Azure Blob Storage usando esse token. O backend não recebe o arquivo de
vídeo em nenhum momento — apenas autoriza o upload.

### Multi-tenant (mock desta fase)

Não há senha nem cadastro nesta POC. O e-mail informado na tela inicial é
salvo localmente no dispositivo (via `AsyncStorage`) e passa a identificar
o tenant: ele é usado como prefixo do caminho do blob
(`tenants/<email-sanitizado>/<arquivo>`), simulando o isolamento entre
contas. Numa versão futura isso será substituído por autenticação e um
cadastro de tenants reais no backend.

## Pré-requisitos

- Node.js 18+ e npm
- Uma conta Azure com permissão para criar recursos
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) (`az`) — para criar a Storage Account
- [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local) (`func`) — para rodar o backend localmente
  - macOS: `brew tap azure/functions && brew install azure-functions-core-tools@4`
- Para iOS/Android: o app [Expo Go](https://expo.dev/go) no celular (mais rápido para a POC) ou os ambientes nativos configurados

## 1. Criar a infraestrutura no Azure

```bash
az login
cd infra
./create-storage.sh
```

O script cria um Resource Group, uma Storage Account e um container
(`videos`) e imprime no final os valores a preencher no backend.

## 2. Rodar o backend (Azure Function)

```bash
cd backend
npm install
cp local.settings.json.example local.settings.json
# edite local.settings.json com os valores impressos pelo create-storage.sh
npm start
```

O backend sobe em `http://localhost:7071` e expõe:

`POST /api/generate-sas-token`
```json
{ "tenantId": "usuario_at_empresa-com", "fileName": "video.mp4", "contentType": "video/mp4" }
```
retorna:
```json
{
  "uploadUrl": "https://<conta>.blob.core.windows.net/videos/tenants/.../video.mp4?<sas>",
  "blobUrl": "https://<conta>.blob.core.windows.net/videos/tenants/.../video.mp4",
  "blobName": "tenants/.../video.mp4",
  "expiresOn": "2026-09-11T12:15:00.000Z"
}
```

## 3. Rodar o app (Expo)

```bash
cd app
npm install
cp .env.example .env
# ajuste EXPO_PUBLIC_BACKEND_URL se o backend não estiver em localhost:7071

npm run web      # abre no navegador
npm run ios      # abre no simulador iOS (ou escaneie o QR code com o Expo Go)
npm run android  # abre no emulador Android (ou escaneie o QR code com o Expo Go)
```

> Ao rodar em um dispositivo físico via Expo Go, `localhost` não aponta
> para a sua máquina — troque `EXPO_PUBLIC_BACKEND_URL` no `.env` pelo IP
> da sua máquina na rede local (ex: `http://192.168.0.10:7071/api`).

Fluxo no app:
1. Informe um e-mail na tela inicial (não há senha nesta fase).
2. Selecione um vídeo da galeria ou grave um novo (câmera disponível apenas em iOS/Android).
3. Toque em "Enviar para o Azure Blob Storage".

## Limitações conhecidas desta POC

- Sem autenticação real (qualquer e-mail é aceito, sem verificação).
- Sem persistência de metadados dos vídeos (nome do blob, tenant, data) em um banco de dados — hoje eles só existem como caminho dentro do próprio Blob Storage.
- Sem tela de listagem/histórico dos vídeos enviados.
- CORS do backend liberado para qualquer origem (`*`) — ajustar antes de qualquer uso além de desenvolvimento local.
