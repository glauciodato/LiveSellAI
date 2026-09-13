const { app } = require('@azure/functions');
const { generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');
const {
  sanitizeSegment,
  sanitizeFileName,
  getStorageContext,
  corsHeaders,
  jsonResponse,
} = require('../lib/azureBlob');

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

    const expiryMinutes = Number(process.env.SAS_TOKEN_EXPIRY_MINUTES || 15);

    try {
      const { containerName, containerClient, credential } = getStorageContext();

      const blobName = `tenants/${sanitizeSegment(tenantId)}/${Date.now()}-${sanitizeFileName(
        fileName
      )}`;

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
      return jsonResponse(500, { error: err.message || 'Erro ao gerar SAS token de upload.' });
    }
  },
});
