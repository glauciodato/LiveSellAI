import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
  listVideos,
  requestUploadUrl,
  uploadVideoToBlob,
  type VideoListItem,
} from '../services/uploadService';
import GradientButton from '../components/GradientButton';
import { colors, fonts } from '../theme';

interface UploadScreenProps {
  tenantEmail: string;
  onLogout: () => void;
  onChangePassword: () => void;
  onBackToHome?: () => void;
}

interface SelectedVideo {
  uri: string;
  fileName: string;
  contentType: string;
  durationMs: number | null;
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';
type AvatarStatus = 'loading' | 'found' | 'not-found' | 'error';
type VideosStatus = 'loading' | 'loaded' | 'error';

function guessFileName(uri: string, fallbackExtension = 'mp4'): string {
  const uriParts = uri.split('/');
  const lastPart = uriParts[uriParts.length - 1] ?? '';
  if (lastPart.includes('.')) {
    return lastPart.split('?')[0];
  }
  return `video-${Date.now()}.${fallbackExtension}`;
}

/** Mostra só o nome original do arquivo, sem o prefixo de pasta/timestamp do blob. */
function formatVideoLabel(blobName: string): string {
  const fileName = blobName.split('/').pop() ?? blobName;
  return fileName.replace(/^\d+-/, '');
}

function formatVideoDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

function formatVideoSize(bytes: number | null): string {
  if (bytes == null) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/**
 * Tela principal da POC: permite selecionar um vídeo já existente no
 * dispositivo ou gravar um novo, enviá-lo para o Azure Blob Storage, e
 * ver o avatar já gerado pra esse tenant (se algum já tiver sido gerado
 * — hoje a geração em si ainda é disparada manualmente, fora do app).
 */
export default function UploadScreen({
  tenantEmail,
  onLogout,
  onChangePassword,
  onBackToHome,
}: UploadScreenProps) {
  const [video, setVideo] = useState<SelectedVideo | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>('loading');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const avatarPlayer = useVideoPlayer(avatarUrl);

  const [videosStatus, setVideosStatus] = useState<VideosStatus>('loading');
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [videosError, setVideosError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoListItem | null>(null);

  const selectedVideoPlayer = useVideoPlayer(selectedVideo?.url ?? null);

  async function loadVideos() {
    setVideosStatus('loading');
    setVideosError(null);
    try {
      const result = await listVideos(tenantEmail);
      setVideos(result);
      setVideosStatus('loaded');
    } catch (err) {
      setVideos([]);
      setVideosStatus('error');
      setVideosError(err instanceof Error ? err.message : 'Erro ao listar vídeos.');
    }
  }

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
    loadVideos();
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
      loadVideos();
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
        <Image
          source={require('../../assets/brand/sellai-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={onChangePassword}>
            <Text style={styles.headerLink}>Alterar senha</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onLogout}>
            <Text style={styles.headerLink}>Trocar conta</Text>
          </TouchableOpacity>
        </View>
      </View>

      {onBackToHome ? (
        <TouchableOpacity onPress={onBackToHome} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Voltar</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.tenant}>{tenantEmail}</Text>

      <View style={styles.card}>
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

        <GradientButton
          title="Enviar vídeo"
          onPress={handleUpload}
          loading={uploading}
          disabled={!video}
        />

        {status === 'success' && message ? (
          <Text style={styles.success}>Upload concluído!</Text>
        ) : null}
        {status === 'error' && message ? <Text style={styles.error}>{message}</Text> : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.title}>Meus vídeos enviados</Text>
          <TouchableOpacity onPress={loadVideos} disabled={videosStatus === 'loading'}>
            <Text style={styles.refreshLink}>Atualizar</Text>
          </TouchableOpacity>
        </View>

        {videosStatus === 'loading' ? (
          <ActivityIndicator style={styles.avatarState} />
        ) : videosStatus === 'error' ? (
          <Text style={styles.error}>{videosError}</Text>
        ) : videos.length === 0 ? (
          <Text style={styles.placeholder}>Nenhum vídeo enviado ainda.</Text>
        ) : (
          <View style={styles.videoList}>
            {videos.map((item) => (
              <TouchableOpacity
                key={item.blobName}
                style={[
                  styles.videoListItem,
                  selectedVideo?.blobName === item.blobName && styles.videoListItemSelected,
                ]}
                onPress={() => setSelectedVideo(item)}
              >
                <Text style={styles.videoListItemName} numberOfLines={1}>
                  {formatVideoLabel(item.blobName)}
                </Text>
                <Text style={styles.videoListItemMeta}>
                  {formatVideoDate(item.lastModified)}
                  {item.size != null ? ` · ${formatVideoSize(item.size)}` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {selectedVideo ? (
          <VideoView
            key={selectedVideo.url}
            player={selectedVideoPlayer}
            style={styles.avatarVideo}
            nativeControls
            contentFit="contain"
          />
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.soft,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  logo: {
    width: 128,
    height: 27,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  headerLink: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.muted,
  },
  backLink: {
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  backLinkText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.muted,
  },
  tenant: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: colors.muted,
    marginBottom: 20,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: fonts.displayBold,
    color: colors.navy,
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.navy,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  videoInfo: {
    backgroundColor: colors.soft,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  videoInfoText: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.navy,
  },
  placeholder: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.muted,
    marginBottom: 16,
  },
  success: {
    color: colors.electric,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    marginTop: 14,
  },
  error: {
    color: colors.destructive,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    marginTop: 14,
  },
  refreshLink: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: colors.electric,
    marginBottom: 16,
  },
  avatarState: {
    marginBottom: 8,
  },
  videoList: {
    gap: 8,
    marginBottom: 8,
  },
  videoListItem: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  videoListItemSelected: {
    borderColor: colors.electric,
    backgroundColor: colors.soft,
  },
  videoListItemName: {
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    color: colors.navy,
  },
  videoListItemMeta: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.muted,
    marginTop: 2,
  },
  avatarVideo: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 480,
    backgroundColor: colors.navy,
    borderRadius: 12,
    marginTop: 8,
  },
});
