import { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Avatar from './Avatar';
import AppMenu from './AppMenu';
import { colors, fonts } from '../theme';
import type { Tenant } from '../types/tenant';

interface AppHeaderProps {
  tenant: Tenant;
  onNavigateHome: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
  /** Se informado, mostra um link "← Voltar" acima do cabeçalho (telas que não são o Home). */
  onBack?: () => void;
}

/**
 * Cabeçalho reutilizável de todas as telas depois do login: logo, botão de
 * voltar opcional, e o avatar que abre o menu da plataforma (perfil,
 * navegação, sair).
 */
export default function AppHeader({
  tenant,
  onNavigateHome,
  onChangePassword,
  onLogout,
  onBack,
}: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Voltar</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.header}>
        <Image
          source={require('../../assets/brand/sellai-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <TouchableOpacity onPress={() => setMenuOpen(true)} accessibilityLabel="Abrir menu">
          <Avatar name={tenant.name} avatarUrl={tenant.avatarUrl} />
        </TouchableOpacity>
      </View>

      <AppMenu
        visible={menuOpen}
        tenant={tenant}
        onClose={() => setMenuOpen(false)}
        onNavigateHome={onNavigateHome}
        onChangePassword={onChangePassword}
        onLogout={onLogout}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backLink: {
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  backLinkText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.muted,
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
});
