const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

/**
 * Equivalente ao poc-v1/backend/src/lib/azureBlob.js, mas pra S3. O app
 * nunca recebe credencial nenhuma -- só URLs pré-assinadas (presigned
 * URLs) de curta duração, escopadas a um único objeto. Mesmo princípio do
 * SAS token do Azure, trocando o mecanismo.
 *
 * Diferença importante: aqui a autenticação vem da IAM Task Role do ECS
 * (nenhuma chave de acesso fica guardada em lugar nenhum -- nem no
 * ambiente local, que também pode usar `aws configure`/SSO).
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

let s3Client;

function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  }
  return s3Client;
}

function getBucketName() {
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) {
    throw new Error('Configuração ausente: defina S3_BUCKET_NAME.');
  }
  return bucket;
}

/** URL pré-assinada de escrita (upload direto do app pro S3, igual ao SAS de escrita do Azure). */
async function generateUploadUrl(key, contentType, expirySeconds = 900) {
  const bucket = getBucketName();
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  const url = await getSignedUrl(getS3Client(), command, { expiresIn: expirySeconds });
  return { url, bucket, key };
}

/** URL pré-assinada de leitura (igual ao SAS de leitura do Azure). */
async function generateReadUrl(key, expirySeconds = 3600) {
  const bucket = getBucketName();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(getS3Client(), command, { expiresIn: expirySeconds });
}

/** Lista todos os objetos com um prefixo (ex: "tenants/<tenant>/"). */
async function listObjectsByPrefix(prefix) {
  const bucket = getBucketName();
  const client = getS3Client();
  const objects = [];
  let continuationToken;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of response.Contents || []) {
      objects.push(obj);
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

module.exports = {
  sanitizeSegment,
  sanitizeFileName,
  getBucketName,
  generateUploadUrl,
  generateReadUrl,
  listObjectsByPrefix,
};
