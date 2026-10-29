const { app } = require('@azure/functions');
const { generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');
const { sanitizeSegment, getStorageContext, corsHeaders, jsonResponse } = require('../lib/azureBlob');

/**
 * Lista os vídeos já enviados por um tenant (em `tenants/<tenant>/`), com
 * URL de leitura (SAS de curta duração) para cada um.
 *
 * Uso: GET /api/videos?tenantId=usuario_at_empresa-com
 *
 * Resposta:
 *   { "videos": [ { "blobName": "...", "url": "https://...?<SAS>", "size": 123, "lastModified": "..." } ] }
 *   (mais recentes primeiro)
 */
app.http('listVideos', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'videos',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 204, headers: corsHeaders() };
    }

    const tenantId = request.query.get('tenantId');
    if (!tenantId) {
      return jsonResponse(400, { error: 'Parâmetro obrigatório ausente: "tenantId".' });
    }

    try {
      const { containerName, containerClient, credential } = getStorageContext();
      const prefix = `tenants/${sanitizeSegment(tenantId)}/`;

      const expiryMinutes = Number(process.env.SAS_TOKEN_EXPIRY_MINUTES || 60);
      const startsOn = new Date(Date.now() - 5 * 60 * 1000);
      const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);

      const videos = [];
      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        const sas = generateBlobSASQueryParameters(
          {
            containerName,
            blobName: blob.name,
            permissions: BlobSASPermissions.parse('r'),
            startsOn,
            expiresOn,
            protocol: 'https',
          },
          credential
        ).toString();

        const blobClient = containerClient.getBlockBlobClient(blob.name);

        videos.push({
          blobName: blob.name,
          url: `${blobClient.url}?${sas}`,
          size: blob.properties.contentLength ?? null,
          lastModified: blob.properties.lastModified,
        });
      }

      videos.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

      return jsonResponse(200, { videos });
    } catch (err) {
      context.error('Erro ao listar vídeos', err);
      return jsonResponse(500, { error: 'Erro ao listar vídeos.' });
    }
  },
});
