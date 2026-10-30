import { useCallback, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { isValidEmail, loginWithGoogle, register } from '../services/authService';
import { saveTenant } from '../services/tenantStorage';
import type { Tenant } from '../types/tenant';
import AuthScreenLayout from '../components/AuthScreenLayout';
import AuthTextInput from '../components/AuthTextInput';
import AuthDivider from '../components/AuthDivider';
import GradientButton from '../components/GradientButton';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { colors, fonts } from '../theme';
import { GOOGLE_CLIENT_ID } from '../config';

const MIN_PASSWORD_LENGTH = 6;
const GOOGLE_SIGN_IN_AVAILABLE = Platform.OS === 'web' && Boolean(GOOGLE_CLIENT_ID);

interface SignupScreenProps {
  onSignup: (tenant: Tenant) => void;
  onNavigateToLogin: () => void;
}

/** Tela de cadastro: nome, e-mail e senha (com confirmação). */
export default function SignupScreen({ onSignup, onNavigateToLogin }: SignupScreenProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Informe seu nome.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Informe um e-mail válido.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const tenant = await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      await saveTenant(tenant);
      onSignup(tenant);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao cadastrar.');
    } finally {
      setSubmitting(false);
    }
  }

  const handleGoogleCredential = useCallback(async (idToken: string) => {
    setError(null);
    try {
      const tenant = await loginWithGoogle(idToken);
      await saveTenant(tenant);
      onSignup(tenant);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao entrar com Google.');
    }
  }, [onSignup]);

  return (
    <AuthScreenLayout
      title="Criar conta"
      subtitle="Informe seus dados para começar a usar o LiveSellAI."
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerText}>Já tem conta?</Text>
          <TouchableOpacity onPress={onNavigateToLogin}>
            <Text style={styles.footerLink}>Entrar</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <AuthTextInput
        placeholder="Nome"
        autoCapitalize="words"
        value={name}
        onChangeText={(value) => {
          setName(value);
          if (error) setError(null);
        }}
      />

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
        placeholder="Senha (mínimo 6 caracteres)"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          if (error) setError(null);
        }}
      />

      <AuthTextInput
        placeholder="Confirmar senha"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        value={confirmPassword}
        onChangeText={(value) => {
          setConfirmPassword(value);
          if (error) setError(null);
        }}
        onSubmitEditing={handleSubmit}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.buttonWrapper}>
        <GradientButton title="Cadastrar" onPress={handleSubmit} loading={submitting} />
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
