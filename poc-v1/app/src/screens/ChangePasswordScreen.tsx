import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { changePassword } from '../services/authService';

const MIN_PASSWORD_LENGTH = 6;

interface ChangePasswordScreenProps {
  tenantEmail: string;
  onDone: () => void;
  onCancel: () => void;
}

/** Tela de alterar senha: senha atual + nova senha (com confirmação). */
export default function ChangePasswordScreen({
  tenantEmail,
  onDone,
  onCancel,
}: ChangePasswordScreenProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!currentPassword) {
      setError('Informe sua senha atual.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`A nova senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await changePassword({ email: tenantEmail, currentPassword, newPassword });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao trocar a senha.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <KeyboardAvoidingView style={styles.container}>
        <Text style={styles.title}>Senha alterada!</Text>
        <Text style={styles.subtitle}>Sua senha foi atualizada com sucesso.</Text>
        <TouchableOpacity style={styles.button} onPress={onDone}>
          <Text style={styles.buttonText}>Voltar</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Alterar senha</Text>
      <Text style={styles.subtitle}>{tenantEmail}</Text>

      <TextInput
        style={styles.input}
        placeholder="Senha atual"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        value={currentPassword}
        onChangeText={(value) => {
          setCurrentPassword(value);
          if (error) setError(null);
        }}
      />

      <TextInput
        style={styles.input}
        placeholder="Nova senha (mínimo 6 caracteres)"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        value={newPassword}
        onChangeText={(value) => {
          setNewPassword(value);
          if (error) setError(null);
        }}
      />

      <TextInput
        style={styles.input}
        placeholder="Confirmar nova senha"
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
          <Text style={styles.buttonText}>Salvar nova senha</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onCancel} disabled={submitting}>
        <Text style={styles.cancelLink}>Cancelar</Text>
      </TouchableOpacity>
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
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
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
  cancelLink: {
    marginTop: 20,
    fontSize: 14,
    color: '#555',
  },
});
