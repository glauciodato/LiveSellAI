const { app } = require('@azure/functions');
const {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} = require('@azure/storage-blob');

/**
 * Backend leve responsável por gerar um SAS token de curta duração,
 * escopado a um único blob, para que o app faça o upload do vídeo
 * diretamente para o Azure Blob Storage.
 *
 * O backend NUNCA recebe o arquivo de vídeo em si (o upload é feito do
 * dispositivo/navegador direto para o Azure) e NUNCA expõe a chave/
 * connection string da Storage Account ao app — apenas este token
 * temporário.
 *
 * "tenantId" aqui é o e-mail do usuário (já sanitizado pelo app) e é
 * usado como prefixo do caminho do blob, simulando o isolamento
 * multi-tenant desta POC.
 */

function sanitizeSegment(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-');
}

function sanitizeFileName(fileName) {
  const base = sanitizeSegment(fileName || '');
  return base.length > 0 ? base : `video-${Date.now()}`;
}

function corsHeaders() {
  const origin = process.env.CORS_ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

app.http('generateSasToken', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'generate-sas-token',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 204, headers: corsHeaders() };
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { error: 'Corpo da requisição inválido (esperado JSON).' });
    }

    const { tenantId, fileName, contentType } = body ?? {};

    if (!tenantId || !fileName) {
      return jsonResponse(400, {
        error: 'Campos obrigatórios ausentes: "tenantId" e "fileName".',
      });
    }

    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'videos';
    const expiryMinutes = Number(process.env.SAS_TOKEN_EXPIRY_MINUTES || 15);

    if (!accountName || !accountKey) {
      context.error(
        'Configuração ausente: defina AZURE_STORAGE_ACCOUNT_NAME e AZURE_STORAGE_ACCOUNT_KEY (local.settings.json ou App Settings do Function App).'
      );
      return jsonResponse(500, {
        error: 'Backend não configurado com as credenciais da Storage Account.',
      });
    }

    try {
      const credential = new StorageSharedKeyCredential(accountName, accountKey);
      const blobServiceClient = new BlobServiceClient(
        `https://${accountName}.blob.core.windows.net`,
        credential
      );

      const blobName = `tenants/${sanitizeSegment(tenantId)}/${Date.now()}-${sanitizeFileName(
        fileName
      )}`;

      const containerClient = blobServiceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      // Tolerância de alguns minutos para diferenças de relógio entre cliente e servidor.
      const startsOn = new Date(Date.now() - 5 * 60 * 1000);
      const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);

      const sasToken = generateBlobSASQueryParameters(
        {
          containerName,
          blobName,
          permissions: BlobSASPermissions.parse('cw'), // create + write, nada de leitura/exclusão
          startsOn,
          expiresOn,
          contentType,
          protocol: 'https',
        },
        credential
      ).toString();

      return jsonResponse(200, {
        uploadUrl: `${blockBlobClient.url}?${sasToken}`,
        blobUrl: blockBlobClient.url,
        blobName,
        expiresOn: expiresOn.toISOString(),
      });
    } catch (err) {
      context.error('Erro ao gerar SAS token', err);
      return jsonResponse(500, { error: 'Erro ao gerar SAS token de upload.' });
    }
  },
});
