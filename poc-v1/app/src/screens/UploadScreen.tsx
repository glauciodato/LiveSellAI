import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { requestUploadUrl, uploadVideoToBlob } from '../services/uploadService';

interface UploadScreenProps {
  tenantEmail: string;
  onLogout: () => void;
}

interface SelectedVideo {
  uri: string;
  fileName: string;
  contentType: string;
  durationMs: number | null;
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

function guessFileName(uri: string, fallbackExtension = 'mp4'): string {
  const uriParts = uri.split('/');
  const lastPart = uriParts[uriParts.length - 1] ?? '';
  if (lastPart.includes('.')) {
    return lastPart.split('?')[0];
  }
  return `video-${Date.now()}.${fallbackExtension}`;
}

/**
 * Tela principal da POC: permite selecionar um vídeo já existente no
 * dispositivo ou gravar um novo, e enviá-lo para o Azure Blob Storage.
 */
export default function UploadScreen({ tenantEmail, onLogout }: UploadScreenProps) {
  const [video, setVideo] = useState<SelectedVideo | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);

  function handlePickerResult(result: ImagePicker.ImagePickerResult) {
    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    setVideo({
      uri: asset.uri,
      fileName: guessFileName(asset.uri, asset.uri.endsWith('.mov') ? 'mov' : 'mp4'),
      contentType: asset.mimeType ?? 'video/mp4',
      durationMs: asset.duration ?? null,
    });
    setStatus('idle');
    setMessage(null);
  }

  async function selectFromLibrary() {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permissão necessária',
          'Autorize o acesso à galeria para selecionar um vídeo.'
        );
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
    });
    handlePickerResult(result);
  }

  async function recordVideo() {
    if (Platform.OS === 'web') {
      Alert.alert(
        'Indisponível na Web',
        'A gravação de vídeo pela câmera está disponível apenas em iOS/Android nesta POC. Use "Selecionar vídeo" para escolher um arquivo.'
      );
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso à câmera para gravar um vídeo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      quality: 1,
    });
    handlePickerResult(result);
  }

  async function handleUpload() {
    if (!video) {
      return;
    }

    setStatus('uploading');
    setMessage(null);

    try {
      const { uploadUrl, blobUrl } = await requestUploadUrl(
        tenantEmail,
        video.fileName,
        video.contentType
      );

      await uploadVideoToBlob({
        localUri: video.uri,
        uploadUrl,
        contentType: video.contentType,
      });

      setStatus('success');
      setMessage(blobUrl);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Erro inesperado no upload.');
    }
  }

  const uploading = status === 'uploading';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.tenant}>{tenantEmail}</Text>
        <TouchableOpacity onPress={onLogout}>
          <Text style={styles.logout}>Trocar conta</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Enviar vídeo</Text>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={selectFromLibrary}>
          <Text style={styles.secondaryButtonText}>Selecionar vídeo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={recordVideo}>
          <Text style={styles.secondaryButtonText}>Gravar vídeo</Text>
        </TouchableOpacity>
      </View>

      {video ? (
        <View style={styles.videoInfo}>
          <Text style={styles.videoInfoText}>Arquivo: {video.fileName}</Text>
          <Text style={styles.videoInfoText}>Tipo: {video.contentType}</Text>
          {video.durationMs ? (
            <Text style={styles.videoInfoText}>
              Duração: {Math.round(video.durationMs / 1000)}s
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.placeholder}>Nenhum vídeo selecionado ainda.</Text>
      )}

      <TouchableOpacity
        style={[styles.button, (!video || uploading) && styles.buttonDisabled]}
        onPress={handleUpload}
        disabled={!video || uploading}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Enviar para o Azure Blob Storage</Text>
        )}
      </TouchableOpacity>

      {status === 'success' && message ? (
        <Text style={styles.success}>Upload concluído! Blob: {message}</Text>
      ) : null}
      {status === 'error' && message ? (
        <Text style={styles.error}>{message}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingTop: 64,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  tenant: {
    fontSize: 14,
    color: '#555',
  },
  logout: {
    fontSize: 14,
    color: '#c0392b',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#111',
    fontWeight: '600',
  },
  videoInfo: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  videoInfoText: {
    fontSize: 14,
    color: '#333',
  },
  placeholder: {
    fontSize: 14,
    color: '#888',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#111',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  success: {
    color: '#1e8449',
    marginTop: 16,
  },
  error: {
    color: '#c0392b',
    marginTop: 16,
  },
});
