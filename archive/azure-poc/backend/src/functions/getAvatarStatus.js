const { app } = require('@azure/functions');
const { corsHeaders, jsonResponse } = require('../lib/azureBlob');

/**
 * Consulta o status de um job de geração de avatar no RunPod, sem expor a
 * API key do RunPod ao app (ela fica só nas App Settings do backend).
 *
 * Uso: GET /api/avatar-status?jobId=<id>
 *
 * Resposta (repassada do RunPod, ver https://docs.runpod.io/serverless/endpoints/status):
 *   { "status": "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED", "output": {...} }
 */

app.http('getAvatarStatus', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'avatar-status',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 204, headers: corsHeaders() };
    }

    const jobId = request.query.get('jobId');
    if (!jobId) {
      return jsonResponse(400, { error: 'Parâmetro obrigatório ausente: "jobId".' });
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
      const runpodResponse = await fetch(
        `https://api.runpod.ai/v2/${runpodEndpointId}/status/${jobId}`,
        {
          headers: { Authorization: `Bearer ${runpodApiKey}` },
        }
      );

      const runpodBody = await runpodResponse.json().catch(() => ({}));

      if (!runpodResponse.ok) {
        context.error('Falha ao consultar status do job no RunPod', runpodBody);
        return jsonResponse(502, {
          error: 'Falha ao consultar o status da geração do avatar.',
          details: runpodBody,
        });
      }

      return jsonResponse(200, runpodBody);
    } catch (err) {
      context.error('Erro ao consultar status do avatar', err);
      return jsonResponse(500, { error: err.message || 'Erro ao consultar status do avatar.' });
    }
  },
});
