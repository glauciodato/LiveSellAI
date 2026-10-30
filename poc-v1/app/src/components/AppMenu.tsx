import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Avatar from './Avatar';
import { colors, fonts } from '../theme';
import type { Tenant } from '../types/tenant';

interface AppMenuProps {
  visible: boolean;
  tenant: Tenant;
  onClose: () => void;
  onNavigateHome: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
}

/** Menu da plataforma -- perfil + navegação, aberto a partir do avatar no cabeçalho. */
export default function AppMenu({
  visible,
  tenant,
  onClose,
  onNavigateHome,
  onChangePassword,
  onLogout,
}: AppMenuProps) {
  function go(action: () => void) {
    onClose();
    action();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
          <View style={styles.profile}>
            <Avatar name={tenant.name} avatarUrl={tenant.avatarUrl} size={44} />
            <View style={styles.profileText}>
              <Text style={styles.profileName} numberOfLines={1}>
                {tenant.name}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {tenant.email}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.item} onPress={() => go(onNavigateHome)}>
            <Text style={styles.itemText}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.item} onPress={() => go(onChangePassword)}>
            <Text style={styles.itemText}>Alterar senha</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.item} onPress={() => go(onLogout)}>
            <Text style={styles.itemTextDestructive}>Sair</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 19, 50, 0.4)',
    alignItems: 'flex-end',
  },
  panel: {
    marginTop: 64,
    marginRight: 16,
    width: 260,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 8,
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 8,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    color: colors.navy,
  },
  profileEmail: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.muted,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  itemText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.navy,
  },
  itemTextDestructive: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.destructive,
  },
});
