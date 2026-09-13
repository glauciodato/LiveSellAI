const { app } = require('@azure/functions');
const { generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');
const { sanitizeSegment, getStorageContext, corsHeaders, jsonResponse } = require('../lib/azureBlob');

/**
 * Devolve uma URL de leitura (SAS) para o avatar mais recente já gerado
 * para um tenant, se existir algum em `avatars/<tenant>/`.
 *
 * Uso: GET /api/latest-avatar?tenantId=usuario_at_empresa-com
 *
 * Resposta:
 *   { "found": false }
 *   ou
 *   { "found": true, "url": "https://...avatar.mp4?<SAS>", "blobName": "...", "lastModified": "..." }
 */

app.http('getLatestAvatar', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'latest-avatar',
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
      const prefix = `avatars/${sanitizeSegment(tenantId)}/`;

      let latest = null;
      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        if (!latest || blob.properties.lastModified > latest.properties.lastModified) {
          latest = blob;
        }
      }

      if (!latest) {
        return jsonResponse(200, { found: false });
      }

      const expiryMinutes = Number(process.env.SAS_TOKEN_EXPIRY_MINUTES || 60);
      const startsOn = new Date(Date.now() - 5 * 60 * 1000);
      const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);

      const sas = generateBlobSASQueryParameters(
        {
          containerName,
          blobName: latest.name,
          permissions: BlobSASPermissions.parse('r'),
          startsOn,
          expiresOn,
          protocol: 'https',
        },
        credential
      ).toString();

      const blobClient = containerClient.getBlockBlobClient(latest.name);

      return jsonResponse(200, {
        found: true,
        url: `${blobClient.url}?${sas}`,
        blobName: latest.name,
        lastModified: latest.properties.lastModified,
      });
    } catch (err) {
      context.error('Erro ao buscar o avatar mais recente', err);
      return jsonResponse(500, { error: err.message || 'Erro ao buscar o avatar mais recente.' });
    }
  },
});
