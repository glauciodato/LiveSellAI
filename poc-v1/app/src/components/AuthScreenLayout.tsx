import type { ReactNode } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, fonts } from '../theme';

interface AuthScreenLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Fundo + card brancos compartilhados entre LoginScreen e SignupScreen. */
export default function AuthScreenLayout({ title, subtitle, children, footer }: AuthScreenLayoutProps) {
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={require('../../assets/brand/sellai-symbol.png')}
          style={styles.symbol}
          resizeMode="contain"
        />

        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {children}
        </View>

        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.soft,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  symbol: {
    width: 56,
    height: 53,
    marginBottom: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 32,
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.08,
    shadowRadius: 40,
    elevation: 4,
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.displayBold,
    color: colors.navy,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: fonts.bodyRegular,
    color: colors.muted,
    marginBottom: 8,
    lineHeight: 21,
  },
});
