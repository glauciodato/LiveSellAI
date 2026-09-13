# LiveSellAI — POC v1

Primeira versão (prova de conceito) do LiveSellAI: acesso por e-mail
(estrutura multi-tenant simplificada) e upload de vídeo para o Azure Blob
Storage, rodando a partir do mesmo código em Web, iOS e Android.

## Estrutura

```
poc-v1/
├── app/             App Expo (React Native + Web) — tela de e-mail e upload de vídeo
├── backend/         Azure Function leve — gera SAS tokens e orquestra a geração do avatar
├── avatar-service/  Serviço RunPod Serverless (MuseTalk + F5-TTS) — gera o avatar a partir do vídeo
└── infra/           Scripts para criar a Storage Account/container no Azure
```

### Por que um backend, mesmo em uma POC?

O app nunca tem acesso à chave/connection string da Storage Account. Ele
pede ao backend um SAS token (Shared Access Signature) de curta duração,
escopado a um único blob, e faz o upload do vídeo **diretamente** para o
Azure Blob Storage usando esse token. O backend não recebe o arquivo de
vídeo em nenhum momento — apenas autoriza o upload.

### Multi-tenant

Cadastro e login são de verdade: nome, e-mail e senha ficam gravados no
Azure Database for PostgreSQL Flexible Server (senha com hash `bcrypt`,
nunca em texto puro). Depois de autenticado, o e-mail da conta é usado
como prefixo do caminho do blob (`tenants/<email-sanitizado>/<arquivo>`),
garantindo o isolamento entre contas no Blob Storage.

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

### Backend implantado no Azure (produção da POC)

O backend também está implantado de verdade, numa Function App real (plano
**Flex Consumption**): **`https://livesellai-poc-backend.azurewebsites.net/api`**.

O deploy é automático via GitHub Actions
(`.github/workflows/backend-deploy.yml`), a cada push que muda
`poc-v1/backend/`. Autenticação por OIDC (login federado com um App
Registration + federated credential — sem senha armazenada), usando os
secrets do repositório `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
`AZURE_SUBSCRIPTION_ID`.

> **Nota:** Flex Consumption não suporta mais o "publish profile" clássico
> do Azure Functions — por isso o workflow usa `azure/login` com OIDC em
> vez disso. Se recriar a Function App do zero, é preciso recriar também o
> App Registration + federated credential (ver histórico de comandos no
> `BACKLOG.md`).

### Banco de dados (Postgres) e segredos (Key Vault)

O cadastro/login usa um Azure Database for PostgreSQL Flexible Server
(`livesellai-poc-db-centralus`, tier Burstable — o menor disponível, só
para desenvolvimento). A senha do usuário admin do Postgres nunca fica em
texto puro nas configurações do Function App: ela é guardada num Azure
Key Vault (`livesellai-poc-kv`) e referenciada via
`@Microsoft.KeyVault(SecretUri=...)` no App Setting `PGPASSWORD` — o
Function App lê o segredo em runtime usando sua identidade gerenciada
(Managed Identity), sem nenhuma credencial fixa.

Rodando localmente (`func start`), essa resolução automática de
`@Microsoft.KeyVault(...)` não existe (é um recurso da plataforma do App
Service/Functions no Azure) — por isso `local.settings.json` continua
guardando a senha em texto puro só para desenvolvimento local (arquivo
gitignored, nunca sai da sua máquina). Ver `src/lib/db.js` para os
detalhes de como a senha é resolvida nos dois cenários.

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
1. Cadastre-se (nome, e-mail e senha) ou entre com uma conta já existente.
2. Selecione um vídeo da galeria ou grave um novo (câmera disponível apenas em iOS/Android).
3. Toque em "Enviar para o Azure Blob Storage".

## 4. Gerar um avatar a partir do vídeo enviado (opcional)

Requer configurar o `avatar-service` no RunPod primeiro — ver
[`avatar-service/README.md`](./avatar-service/README.md) para o passo a
passo completo (criar conta, configurar o Serverless Endpoint, Network
Volume, etc.). Ainda não há tela no app para isso; teste direto nos
endpoints do backend:

```bash
curl -X POST http://localhost:7071/api/generate-avatar \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "usuario_at_empresa-com",
    "sourceBlobName": "tenants/usuario_at_empresa-com/171...-video.mp4",
    "text": "Texto que o avatar deve falar"
  }'
# -> { "jobId": "...", "status": "IN_QUEUE", "outputBlobUrl": "..." }

curl "http://localhost:7071/api/avatar-status?jobId=<jobId retornado acima>"
```

## Limitações conhecidas desta POC

- Sem persistência de metadados dos vídeos (nome do blob, tenant, data) em um banco de dados — hoje eles só existem como caminho dentro do próprio Blob Storage.
- Sem tela de listagem/histórico dos vídeos enviados.
- CORS do backend liberado para qualquer origem (`*`) — ajustar antes de qualquer uso além de desenvolvimento local.
- Geração de avatar (`avatar-service`) ainda não foi testada em GPU real — ver limitações detalhadas em [`avatar-service/README.md`](./avatar-service/README.md).
