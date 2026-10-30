import { useCallback, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { isValidEmail, login, loginWithGoogle } from '../services/authService';
import { saveTenant } from '../services/tenantStorage';
import type { Tenant } from '../types/tenant';
import AuthScreenLayout from '../components/AuthScreenLayout';
import AuthTextInput from '../components/AuthTextInput';
import AuthDivider from '../components/AuthDivider';
import GradientButton from '../components/GradientButton';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { colors, fonts } from '../theme';
import { GOOGLE_CLIENT_ID } from '../config';

const GOOGLE_SIGN_IN_AVAILABLE = Platform.OS === 'web' && Boolean(GOOGLE_CLIENT_ID);

interface LoginScreenProps {
  onLogin: (tenant: Tenant) => void;
  onNavigateToSignup: () => void;
}

/**
 * Tela de login: e-mail + senha de verdade, validados contra o backend
 * (Postgres). Substitui o mock antigo que aceitava qualquer e-mail sem
 * validação nenhuma.
 */
export default function LoginScreen({ onLogin, onNavigateToSignup }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!isValidEmail(email)) {
      setError('Informe um e-mail válido.');
      return;
    }
    if (!password) {
      setError('Informe sua senha.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const tenant = await login({ email: email.trim().toLowerCase(), password });
      await saveTenant(tenant);
      onLogin(tenant);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao entrar.');
    } finally {
      setSubmitting(false);
    }
  }

  const handleGoogleCredential = useCallback(async (idToken: string) => {
    setError(null);
    try {
      const tenant = await loginWithGoogle(idToken);
      await saveTenant(tenant);
      onLogin(tenant);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao entrar com Google.');
    }
  }, [onLogin]);

  return (
    <AuthScreenLayout
      title="Entrar"
      subtitle="Acesse sua conta LiveSellAI."
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerText}>Ainda não tem conta?</Text>
          <TouchableOpacity onPress={onNavigateToSignup}>
            <Text style={styles.footerLink}>Cadastre-se</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <AuthTextInput
        placeholder="seuemail@empresa.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          if (error) setError(null);
        }}
      />

      <AuthTextInput
        placeholder="Senha"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          if (error) setError(null);
        }}
        onSubmitEditing={handleSubmit}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.buttonWrapper}>
        <GradientButton title="Entrar" onPress={handleSubmit} loading={submitting} />
      </View>

      {GOOGLE_SIGN_IN_AVAILABLE ? (
        <>
          <AuthDivider />
          <GoogleSignInButton onCredential={handleGoogleCredential} />
        </>
      ) : null}
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  error: {
    color: colors.destructive,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    marginTop: 10,
  },
  buttonWrapper: {
    marginTop: 20,
  },
  footer: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.muted,
  },
  footerLink: {
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    color: colors.electric,
  },
});
