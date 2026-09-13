import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  getLatestAvatar,
  requestUploadUrl,
  uploadVideoToBlob,
} from '../services/uploadService';

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
type AvatarStatus = 'loading' | 'found' | 'not-found' | 'error';

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
 * dispositivo ou gravar um novo, enviá-lo para o Azure Blob Storage, e
 * ver o avatar já gerado pra esse tenant (se algum já tiver sido gerado
 * — hoje a geração em si ainda é disparada manualmente, fora do app).
 */
export default function UploadScreen({ tenantEmail, onLogout }: UploadScreenProps) {
  const [video, setVideo] = useState<SelectedVideo | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>('loading');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const avatarPlayer = useVideoPlayer(avatarUrl);

  async function loadAvatar() {
    setAvatarStatus('loading');
    setAvatarError(null);
    try {
      const result = await getLatestAvatar(tenantEmail);
      if (result.found && result.url) {
        setAvatarUrl(result.url);
        setAvatarStatus('found');
      } else {
        setAvatarUrl(null);
        setAvatarStatus('not-found');
      }
    } catch (err) {
      setAvatarUrl(null);
      setAvatarStatus('error');
      setAvatarError(err instanceof Error ? err.message : 'Erro ao buscar o avatar.');
    }
  }

  useEffect(() => {
    loadAvatar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantEmail]);

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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
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
      {status === 'error' && message ? <Text style={styles.error}>{message}</Text> : null}

      <View style={styles.divider} />

      <View style={styles.avatarHeader}>
        <Text style={styles.title}>Meu avatar</Text>
        <TouchableOpacity onPress={loadAvatar} disabled={avatarStatus === 'loading'}>
          <Text style={styles.refreshLink}>Atualizar</Text>
        </TouchableOpacity>
      </View>

      {avatarStatus === 'loading' ? (
        <ActivityIndicator style={styles.avatarState} />
      ) : avatarStatus === 'found' && avatarUrl ? (
        <VideoView
          key={avatarUrl}
          player={avatarPlayer}
          style={styles.avatarVideo}
          nativeControls
          contentFit="contain"
        />
      ) : avatarStatus === 'not-found' ? (
        <Text style={styles.placeholder}>
          Nenhum avatar gerado ainda pra essa conta. Envie um vídeo e peça pra gerar o avatar a
          partir dele.
        </Text>
      ) : (
        <Text style={styles.error}>{avatarError}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 48,
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
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 32,
  },
  avatarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  refreshLink: {
    fontSize: 14,
    color: '#111',
    fontWeight: '600',
    marginBottom: 24,
  },
  avatarState: {
    marginBottom: 24,
  },
  avatarVideo: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 480,
    backgroundColor: '#000',
    borderRadius: 8,
    marginBottom: 24,
  },
});
