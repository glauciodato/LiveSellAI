import { Platform } from 'react-native';
import { File, UploadType } from 'expo-file-system';
import { BACKEND_URL } from '../config';

export interface RequestUploadUrlResult {
  /** URL com SAS token, usada para o PUT direto no Azure Blob Storage. */
  uploadUrl: string;
  /** URL pública do blob (sem o token), para referência/exibição. */
  blobUrl: string;
  /** Nome final do blob dentro do container. */
  blobName: string;
  /** Data/hora (ISO) em que o SAS token expira. */
  expiresOn: string;
}

/** Deixa o e-mail seguro para compor o caminho do blob (isolamento por tenant). */
export function sanitizeTenantSegment(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/@/g, '_at_')
    .replace(/[^a-z0-9._-]/g, '-');
}

/**
 * Pede ao backend um SAS token de curta duração para upload de um blob
 * específico. O app nunca tem acesso à chave/connection string da Storage
 * Account — apenas a esse token temporário e escopado a um único blob.
 */
export async function requestUploadUrl(
  tenantEmail: string,
  fileName: string,
  contentType: string
): Promise<RequestUploadUrlResult> {
  const response = await fetch(`${BACKEND_URL}/generate-sas-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId: sanitizeTenantSegment(tenantEmail),
      fileName,
      contentType,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Falha ao solicitar URL de upload (HTTP ${response.status}). ${body}`
    );
  }

  return (await response.json()) as RequestUploadUrlResult;
}

export interface UploadVideoParams {
  /** URI local do vídeo (retornada pelo expo-image-picker). */
  localUri: string;
  uploadUrl: string;
  contentType: string;
}

/**
 * Envia o vídeo diretamente para o Azure Blob Storage usando a URL com SAS
 * token (upload feito do dispositivo/navegador direto para o Azure — o
 * backend não recebe o arquivo, apenas gera a permissão temporária).
 */
export async function uploadVideoToBlob({
  localUri,
  uploadUrl,
  contentType,
}: UploadVideoParams): Promise<void> {
  const headers = {
    'x-ms-blob-type': 'BlockBlob',
    'Content-Type': contentType,
  };

  if (Platform.OS === 'web') {
    const fileResponse = await fetch(localUri);
    const blob = await fileResponse.blob();

    const putResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers,
      body: blob,
    });

    if (!putResponse.ok) {
      const body = await putResponse.text().catch(() => '');
      throw new Error(
        `Falha no upload para o Azure Blob Storage (HTTP ${putResponse.status}). ${body}`
      );
    }
    return;
  }

  // iOS/Android: upload binário direto do arquivo local via expo-file-system.
  const file = new File(localUri);
  const task = file.createUploadTask(uploadUrl, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    headers,
  });

  const result = await task.uploadAsync();

  if (!result || result.status < 200 || result.status >= 300) {
    throw new Error(
      `Falha no upload para o Azure Blob Storage (HTTP ${result?.status}). ${result?.body ?? ''}`
    );
  }
}

export interface LatestAvatarResult {
  found: boolean;
  /** URL com SAS de leitura, presente só quando found === true. */
  url?: string;
  blobName?: string;
  lastModified?: string;
}

/**
 * Pergunta ao backend se já existe um avatar gerado para este tenant e,
 * se existir, devolve uma URL (com SAS de leitura, temporária) pra exibir.
 * A geração do avatar em si ainda é disparada manualmente (fora do app)
 * nesta fase da POC — aqui só verificamos se o resultado já está pronto.
 */
export async function getLatestAvatar(tenantEmail: string): Promise<LatestAvatarResult> {
  const response = await fetch(
    `${BACKEND_URL}/latest-avatar?tenantId=${encodeURIComponent(sanitizeTenantSegment(tenantEmail))}`
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Falha ao consultar o avatar mais recente (HTTP ${response.status}). ${body}`
    );
  }

  return (await response.json()) as LatestAvatarResult;
}
