import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { isValidEmail, login } from '../services/authService';
import { saveTenant } from '../services/tenantStorage';
import type { Tenant } from '../types/tenant';
import AuthScreenLayout from '../components/AuthScreenLayout';
import AuthTextInput from '../components/AuthTextInput';
import GradientButton from '../components/GradientButton';
import { colors, fonts } from '../theme';

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
