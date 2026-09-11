#!/usr/bin/env bash
# Cria a infraestrutura mínima no Azure para esta POC: um Resource Group,
# uma Storage Account e um container de blobs para os vídeos.
#
# Pré-requisitos: Azure CLI instalado e autenticado (`az login`).
#
# Uso:
#   ./create-storage.sh
#
# Variáveis opcionais (podem ser exportadas antes de rodar o script):
#   RESOURCE_GROUP        (default: rg-livesellai-poc)
#   LOCATION              (default: eastus)
#   STORAGE_ACCOUNT_NAME  (default: livesellaipoc<aleatório> - precisa ser único globalmente,
#                          só letras minúsculas/números, 3-24 caracteres)
#   CONTAINER_NAME         (default: videos)

set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-rg-livesellai-poc}"
LOCATION="${LOCATION:-eastus}"
STORAGE_ACCOUNT_NAME="${STORAGE_ACCOUNT_NAME:-livesellaipoc$RANDOM}"
CONTAINER_NAME="${CONTAINER_NAME:-videos}"

echo "Resource Group:  $RESOURCE_GROUP"
echo "Location:        $LOCATION"
echo "Storage Account: $STORAGE_ACCOUNT_NAME"
echo "Container:       $CONTAINER_NAME"
echo ""

az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output none

az storage account create \
  --name "$STORAGE_ACCOUNT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --allow-blob-public-access false \
  --output none

ACCOUNT_KEY=$(az storage account keys list \
  --account-name "$STORAGE_ACCOUNT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "[0].value" -o tsv)

az storage container create \
  --name "$CONTAINER_NAME" \
  --account-name "$STORAGE_ACCOUNT_NAME" \
  --account-key "$ACCOUNT_KEY" \
  --public-access off \
  --output none

cat <<EOF

✅ Infraestrutura criada.

Copie poc-v1/backend/local.settings.json.example para
poc-v1/backend/local.settings.json e preencha:

  AZURE_STORAGE_ACCOUNT_NAME=$STORAGE_ACCOUNT_NAME
  AZURE_STORAGE_ACCOUNT_KEY=$ACCOUNT_KEY
  AZURE_STORAGE_CONTAINER_NAME=$CONTAINER_NAME

Guarde a chave de acesso com segurança — ela nunca deve ser commitada
no repositório nem embutida no app (o app só recebe SAS tokens
temporários gerados pelo backend).
EOF
