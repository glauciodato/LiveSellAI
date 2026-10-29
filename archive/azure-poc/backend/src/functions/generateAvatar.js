const { app } = require('@azure/functions');
const { generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');
const {
  sanitizeSegment,
  getStorageContext,
  corsHeaders,
  jsonResponse,
} = require('../lib/azureBlob');

/**
 * Orquestra a geração do avatar: gera as URLs (SAS) de leitura do vídeo de
 * origem e de escrita do vídeo resultante, e aciona o job no RunPod
 * Serverless (que roda o pipeline MuseTalk + F5-TTS numa GPU sob demanda).
 *
 * Esta function NUNCA processa vídeo/áudio em si — apenas orquestra. O
 * processamento pesado acontece no serviço RunPod (ver poc-v1/avatar-service).
 *
 * Body esperado:
 *   {
 *     "tenantId": "usuario_at_empresa-com",
 *     "sourceBlobName": "tenants/usuario_at_empresa-com/171...-video.mp4",
 *     "text": "Texto que o avatar deve falar"
 *   }
 *
 * Resposta:
 *   { "jobId": "...", "status": "IN_QUEUE", "outputBlobUrl": "https://.../avatar.mp4" }
 */

app.http('generateAvatar', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'generate-avatar',
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

    const {
      tenantId,
      sourceBlobName,
      text,
      referenceClipStartSeconds,
      referenceClipDurationSeconds,
    } = body ?? {};

    if (!tenantId || !sourceBlobName || !text) {
      return jsonResponse(400, {
        error: 'Campos obrigatórios ausentes: "tenantId", "sourceBlobName" e "text".',
      });
    }

    const runpodApiKey = process.env.RUNPOD_API_KEY;
    const runpodEndpointId = process.env.RUNPOD_ENDPOINT_ID;

    if (!runpodApiKey || !runpodEndpointId) {
      context.error(
        'Configuração ausente: defina RUNPOD_API_KEY e RUNPOD_ENDPOINT_ID (local.settings.json ou App Settings do Function App).'
      );
      return jsonResponse(500, {
        error: 'Backend não configurado com as credenciais do RunPod.',
      });
    }

    try {
      const { containerName, containerClient, credential } = getStorageContext();
      const expiryMinutes = Number(process.env.SAS_TOKEN_EXPIRY_MINUTES || 30);
      const startsOn = new Date(Date.now() - 5 * 60 * 1000);
      const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);

      // SAS de leitura do vídeo já enviado (fonte para o pipeline).
      const sourceBlobClient = containerClient.getBlockBlobClient(sourceBlobName);
      const readSas = generateBlobSASQueryParameters(
        {
          containerName,
          blobName: sourceBlobName,
          permissions: BlobSASPermissions.parse('r'),
          startsOn,
          expiresOn,
          protocol: 'https',
        },
        credential
      ).toString();

      // SAS de escrita para o vídeo do avatar que será gerado.
      const outputBlobName = `avatars/${sanitizeSegment(tenantId)}/${Date.now()}-avatar.mp4`;
      const outputBlobClient = containerClient.getBlockBlobClient(outputBlobName);
      const writeSas = generateBlobSASQueryParameters(
        {
          containerName,
          blobName: outputBlobName,
          permissions: BlobSASPermissions.parse('cw'),
          startsOn,
          expiresOn,
          contentType: 'video/mp4',
          protocol: 'https',
        },
        credential
      ).toString();

      const runpodInput = {
        videoUrl: `${sourceBlobClient.url}?${readSas}`,
        uploadUrl: `${outputBlobClient.url}?${writeSas}`,
        text,
      };
      if (referenceClipStartSeconds !== undefined) {
        runpodInput.referenceClipStartSeconds = referenceClipStartSeconds;
      }
      if (referenceClipDurationSeconds !== undefined) {
        runpodInput.referenceClipDurationSeconds = referenceClipDurationSeconds;
      }

      const runpodResponse = await fetch(`https://api.runpod.ai/v2/${runpodEndpointId}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${runpodApiKey}`,
        },
        body: JSON.stringify({ input: runpodInput }),
      });

      const runpodBody = await runpodResponse.json().catch(() => ({}));

      if (!runpodResponse.ok) {
        context.error('Falha ao acionar o job no RunPod', runpodBody);
        return jsonResponse(502, {
          error: 'Falha ao acionar a geração do avatar no RunPod.',
          details: runpodBody,
        });
      }

      return jsonResponse(200, {
        jobId: runpodBody.id,
        status: runpodBody.status || 'IN_QUEUE',
        outputBlobUrl: outputBlobClient.url,
        outputBlobName,
      });
    } catch (err) {
      context.error('Erro ao orquestrar geração de avatar', err);
      return jsonResponse(500, { error: err.message || 'Erro ao gerar o avatar.' });
    }
  },
});
