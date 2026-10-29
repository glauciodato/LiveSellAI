$RESOURCE_GROUP = "rg-livesellai-poc"
$LOCATION = "brazilsouth"
$STORAGE_ACCOUNT = "livesellaipoc4821"
$CONTAINER = "videos"

az group create --name $RESOURCE_GROUP --location $LOCATION --output none

az storage account create --name $STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP --location $LOCATION --sku Standard_LRS --kind StorageV2 --allow-blob-public-access false --output none

$ACCOUNT_KEY = az storage account keys list --account-name $STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP --query "[0].value" -o tsv

az storage container create --name $CONTAINER --account-name $STORAGE_ACCOUNT --account-key $ACCOUNT_KEY --public-access off --output none

$EXPIRY = (Get-Date).ToUniversalTime().AddMinutes(30).ToString("yyyy-MM-ddTHH:mmZ")

$SAS = az storage blob generate-sas `
  --account-name $STORAGE_ACCOUNT `
  --account-key $ACCOUNT_KEY `
  --container-name $CONTAINER `
  --name "tenants/teste-poc/arquivo-teste.mp4" `
  --permissions cw `
  --expiry $EXPIRY `
  --https-only `
  -o tsv

$UPLOAD_URL = "https://$STORAGE_ACCOUNT.blob.core.windows.net/$CONTAINER/tenants/teste-poc/arquivo-teste.mp4?$SAS"

Write-Host ""
Write-Host "STORAGE_ACCOUNT=$STORAGE_ACCOUNT"
Write-Host "CONTAINER=$CONTAINER"
Write-Host "UPLOAD_URL=$UPLOAD_URL"
