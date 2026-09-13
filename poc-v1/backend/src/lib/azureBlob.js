const {
  BlobServiceClient,
  StorageSharedKeyCredential,
} = require('@azure/storage-blob');

/**
 * Utilitários compartilhados entre as functions que geram SAS tokens para
 * o Azure Blob Storage (upload do vídeo original e leitura/escrita usadas
 * pelo pipeline de geração de avatar).
 */

function sanitizeSegment(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-');
}

function sanitizeFileName(fileName) {
  const base = sanitizeSegment(fileName || '');
  return base.length > 0 ? base : `arquivo-${Date.now()}`;
}

/**
 * Lê a configuração da Storage Account das variáveis de ambiente e monta
 * o client + credencial. Lança erro descritivo se algo estiver faltando.
 */
function getStorageContext() {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'videos';

  if (!accountName || !accountKey) {
    throw new Error(
      'Configuração ausente: defina AZURE_STORAGE_ACCOUNT_NAME e AZURE_STORAGE_ACCOUNT_KEY ' +
        '(local.settings.json ou App Settings do Function App).'
    );
  }

  const credential = new StorageSharedKeyCredential(accountName, accountKey);
  const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    credential
  );
  const containerClient = blobServiceClient.getContainerClient(containerName);

  return { accountName, accountKey, containerName, credential, blobServiceClient, containerClient };
}

function corsHeaders() {
  const origin = process.env.CORS_ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(status, data) {
  return {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    jsonBody: data,
  };
}

module.exports = {
  sanitizeSegment,
  sanitizeFileName,
  getStorageContext,
  corsHeaders,
  jsonResponse,
};
