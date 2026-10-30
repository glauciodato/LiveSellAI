import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts, gradientLive } from '../theme';

interface AvatarProps {
  name: string;
  avatarUrl: string | null;
  size?: number;
}

/** Foto de perfil (contas via Google) ou um círculo com a inicial do nome. */
export default function Avatar({ name, avatarUrl, size = 36 }: AvatarProps) {
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={dimension} />;
  }

  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <LinearGradient colors={gradientLive} style={[styles.fallback, dimension]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: '#fff',
    fontFamily: fonts.bodySemiBold,
  },
});
