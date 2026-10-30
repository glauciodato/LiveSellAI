import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, type GestureResponderEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradientLive, radius } from '../theme';

interface GradientButtonProps {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
  loading?: boolean;
  disabled?: boolean;
}

/** Botão primário das telas de autenticação — gradiente de marca (violet → magenta → live). */
export default function GradientButton({ title, onPress, loading, disabled }: GradientButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={isDisabled}
      style={isDisabled && styles.disabled}
    >
      <LinearGradient
        colors={gradientLive}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.button}
      >
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.text}>{title}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.white,
    fontSize: 16,
    fontFamily: fonts.bodySemiBold,
  },
  disabled: {
    opacity: 0.6,
  },
});
