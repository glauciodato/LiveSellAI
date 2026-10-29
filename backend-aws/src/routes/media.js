const express = require('express');
const {
  sanitizeSegment,
  sanitizeFileName,
  getBucketName,
  generateUploadUrl,
  generateReadUrl,
  listObjectsByPrefix,
} = require('../lib/s3');

const router = express.Router();

/**
 * POST /api/generate-sas-token
 * (nome mantido igual ao backend do Azure de propósito -- facilita o
 * corte final na Fase 5, já que o app chama esse mesmo endpoint)
 * { "tenantId": "...", "fileName": "video.mp4", "contentType": "video/mp4" }
 */
router.post('/generate-sas-token', async (req, res) => {
  const { tenantId, fileName, contentType } = req.body ?? {};

  if (!tenantId || !fileName) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes: "tenantId" e "fileName".' });
  }

  const expiryMinutes = Number(process.env.UPLOAD_URL_EXPIRY_MINUTES || 15);

  try {
    const key = `tenants/${sanitizeSegment(tenantId)}/${Date.now()}-${sanitizeFileName(fileName)}`;
    const { url, bucket } = await generateUploadUrl(key, contentType, expiryMinutes * 60);
    const region = process.env.AWS_REGION || 'us-east-1';

    res.status(200).json({
      uploadUrl: url,
      blobUrl: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
      blobName: key,
      expiresOn: new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString(),
    });
  } catch (err) {
    console.error('Erro ao gerar URL de upload', err);
    res.status(500).json({ error: err.message || 'Erro ao gerar URL de upload.' });
  }
});

/**
 * GET /api/latest-avatar?tenantId=...
 */
router.get('/latest-avatar', async (req, res) => {
  const tenantId = req.query.tenantId;
  if (!tenantId) {
    return res.status(400).json({ error: 'Parâmetro obrigatório ausente: "tenantId".' });
  }

  try {
    const prefix = `avatars/${sanitizeSegment(tenantId)}/`;
    const objects = await listObjectsByPrefix(prefix);

    if (objects.length === 0) {
      return res.status(200).json({ found: false });
    }

    const latest = objects.reduce((a, b) => (a.LastModified > b.LastModified ? a : b));
    const expiryMinutes = Number(process.env.READ_URL_EXPIRY_MINUTES || 60);
    const url = await generateReadUrl(latest.Key, expiryMinutes * 60);

    res.status(200).json({
      found: true,
      url,
      blobName: latest.Key,
      lastModified: latest.LastModified,
    });
  } catch (err) {
    console.error('Erro ao buscar o avatar mais recente', err);
    res.status(500).json({ error: err.message || 'Erro ao buscar o avatar mais recente.' });
  }
});

/**
 * GET /api/videos?tenantId=...
 */
router.get('/videos', async (req, res) => {
  const tenantId = req.query.tenantId;
  if (!tenantId) {
    return res.status(400).json({ error: 'Parâmetro obrigatório ausente: "tenantId".' });
  }

  try {
    const prefix = `tenants/${sanitizeSegment(tenantId)}/`;
    const objects = await listObjectsByPrefix(prefix);
    const expiryMinutes = Number(process.env.READ_URL_EXPIRY_MINUTES || 60);

    const videos = await Promise.all(
      objects.map(async (obj) => ({
        blobName: obj.Key,
        url: await generateReadUrl(obj.Key, expiryMinutes * 60),
        size: obj.Size ?? null,
        lastModified: obj.LastModified,
      }))
    );

    videos.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

    res.status(200).json({ videos });
  } catch (err) {
    console.error('Erro ao listar vídeos', err);
    res.status(500).json({ error: err.message || 'Erro ao listar vídeos.' });
  }
});

module.exports = router;
