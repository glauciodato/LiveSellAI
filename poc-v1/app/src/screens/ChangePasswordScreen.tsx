import { useState } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { changePassword } from '../services/authService';
import type { Tenant } from '../types/tenant';
import AuthScreenLayout from '../components/AuthScreenLayout';
import AuthTextInput from '../components/AuthTextInput';
import GradientButton from '../components/GradientButton';
import { colors, fonts } from '../theme';

const MIN_PASSWORD_LENGTH = 6;

interface ChangePasswordScreenProps {
  tenantEmail: string;
  /** false pra contas criadas via Google que ainda não têm senha -- pula o campo "senha atual". */
  hasPassword: boolean;
  onDone: (updatedTenant: Tenant) => void;
  onCancel: () => void;
}

/** Tela de alterar senha (ou definir a primeira, pra contas via Google). */
export default function ChangePasswordScreen({
  tenantEmail,
  hasPassword,
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
    if (hasPassword && !currentPassword) {
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
      const updatedTenant = await changePassword({
        email: tenantEmail,
        currentPassword: hasPassword ? currentPassword : undefined,
        newPassword,
      });
      setSuccess(true);
      onDone(updatedTenant);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao trocar a senha.');
    } finally {
      setSubmitting(false);
    }
  }

  const title = hasPassword ? 'Alterar senha' : 'Definir senha';
  const subtitle = hasPassword
    ? tenantEmail
    : `${tenantEmail} — sua conta foi criada com o Google e ainda não tem senha.`;

  if (success) {
    return (
      <AuthScreenLayout title="Senha salva!" subtitle="Sua senha foi atualizada com sucesso.">
        <View style={styles.buttonWrapper}>
          <GradientButton title="Voltar" onPress={() => onCancel()} />
        </View>
      </AuthScreenLayout>
    );
  }

  return (
    <AuthScreenLayout title={title} subtitle={subtitle}>
      {hasPassword ? (
        <AuthTextInput
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
      ) : null}

      <AuthTextInput
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

      <AuthTextInput
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

      <View style={styles.buttonWrapper}>
        <GradientButton
          title={hasPassword ? 'Salvar nova senha' : 'Definir senha'}
          onPress={handleSubmit}
          loading={submitting}
        />
      </View>

      <TouchableOpacity onPress={onCancel} disabled={submitting} style={styles.cancelWrapper}>
        <Text style={styles.cancelLink}>Cancelar</Text>
      </TouchableOpacity>
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
  cancelWrapper: {
    alignItems: 'center',
    marginTop: 18,
  },
  cancelLink: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.muted,
  },
});
