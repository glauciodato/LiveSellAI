import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { isValidEmail, register } from '../services/authService';
import { saveTenant } from '../services/tenantStorage';
import type { Tenant } from '../types/tenant';

const MIN_PASSWORD_LENGTH = 6;

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Criar conta</Text>
      <Text style={styles.subtitle}>Informe seus dados para começar a usar o LiveSellAI.</Text>

      <TextInput
        style={styles.input}
        placeholder="Nome"
        autoCapitalize="words"
        value={name}
        onChangeText={(value) => {
          setName(value);
          if (error) setError(null);
        }}
      />

      <TextInput
        style={styles.input}
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

      <TextInput
        style={styles.input}
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

      <TextInput
        style={styles.input}
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

      <TouchableOpacity
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Cadastrar</Text>
        )}
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Já tem conta?</Text>
        <TouchableOpacity onPress={onNavigateToLogin}>
          <Text style={styles.footerLink}>Entrar</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginTop: 12,
  },
  error: {
    color: '#c0392b',
    marginTop: 8,
  },
  button: {
    marginTop: 16,
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#111',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#555',
  },
  footerLink: {
    fontSize: 14,
    color: '#111',
    fontWeight: '600',
  },
});
