import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Avatar from './Avatar';
import { colors, fonts, radius } from '../theme';
import type { Tenant } from '../types/tenant';

export type SidebarScreen = 'home' | 'avatar' | 'voice' | 'password';

export interface SidebarProps {
  tenant: Tenant;
  activeScreen: SidebarScreen;
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onNavigateHome: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
}

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 76;

/**
 * Conteúdo da navegação lateral -- usado tanto fixo (desktop) quanto dentro
 * da gaveta (mobile), ver AppShell.
 */
export default function Sidebar({
  tenant,
  activeScreen,
  collapsed,
  onToggleCollapse,
  onNavigateHome,
  onChangePassword,
  onLogout,
}: SidebarProps) {
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);

  return (
    <View style={[styles.container, { width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }]}>
      <View style={styles.topSection}>
        <View style={styles.logoRow}>
          {collapsed ? (
            <Image
              source={require('../../assets/brand/sellai-symbol.png')}
              style={styles.symbol}
              resizeMode="contain"
            />
          ) : (
            <Image
              source={require('../../assets/brand/sellai-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          )}
        </View>

        <View style={[styles.profile, collapsed && styles.profileCollapsed]}>
          <Avatar name={tenant.name} avatarUrl={tenant.avatarUrl} size={collapsed ? 32 : 40} />
          {!collapsed ? (
            <View style={styles.profileText}>
              <Text style={styles.profileName} numberOfLines={1}>
                {tenant.name}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {tenant.email}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.divider} />

        <SidebarItem
          icon="home"
          label="Home"
          collapsed={collapsed}
          active={activeScreen === 'home'}
          onPress={onNavigateHome}
        />
        <SidebarItem
          icon="key-outline"
          label="Alterar senha"
          collapsed={collapsed}
          active={activeScreen === 'password'}
          onPress={onChangePassword}
        />
      </View>

      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={[styles.item, collapsed && styles.itemCollapsed]}
          onPress={() => setLanguagePickerOpen(true)}
        >
          <Ionicons name="language-outline" size={20} color={colors.muted} />
          {!collapsed ? (
            <>
              <Text style={styles.itemLabel}>Português (Brasil)</Text>
              <Ionicons name="chevron-down" size={14} color={colors.muted} />
            </>
          ) : null}
        </TouchableOpacity>

        <SidebarItem
          icon="log-out-outline"
          label="Sair"
          collapsed={collapsed}
          destructive
          onPress={onLogout}
        />

        {onToggleCollapse ? (
          <TouchableOpacity
            style={[styles.item, collapsed && styles.itemCollapsed, styles.collapseToggle]}
            onPress={onToggleCollapse}
            accessibilityLabel={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <Ionicons
              name={collapsed ? 'chevron-forward' : 'chevron-back'}
              size={18}
              color={colors.muted}
            />
            {!collapsed ? <Text style={styles.itemLabel}>Recolher</Text> : null}
          </TouchableOpacity>
        ) : null}
      </View>

      <Modal
        visible={languagePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguagePickerOpen(false)}
      >
        <Pressable style={styles.langBackdrop} onPress={() => setLanguagePickerOpen(false)}>
          <Pressable style={styles.langPanel} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.langTitle}>Idioma</Text>
            <View style={styles.langOption}>
              <Text style={styles.langOptionText}>🇧🇷 Português (Brasil)</Text>
              <Ionicons name="checkmark" size={18} color={colors.electric} />
            </View>
            <Text style={styles.langNote}>Mais idiomas em breve.</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

interface SidebarItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  collapsed: boolean;
  active?: boolean;
  destructive?: boolean;
  onPress: () => void;
}

function SidebarItem({ icon, label, collapsed, active, destructive, onPress }: SidebarItemProps) {
  return (
    <TouchableOpacity
      style={[styles.item, collapsed && styles.itemCollapsed, active && styles.itemActive]}
      onPress={onPress}
      accessibilityLabel={label}
    >
      <Ionicons
        name={icon}
        size={20}
        color={destructive ? colors.destructive : active ? colors.navy : colors.muted}
      />
      {!collapsed ? (
        <Text style={[styles.itemLabel, destructive && styles.itemLabelDestructive, active && styles.itemLabelActive]}>
          {label}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    height: '100%',
    backgroundColor: colors.white,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingVertical: 20,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  topSection: {
    gap: 4,
  },
  bottomSection: {
    gap: 4,
  },
  logoRow: {
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  logo: {
    width: 128,
    height: 27,
  },
  symbol: {
    width: 28,
    height: 27,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  profileCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: colors.navy,
  },
  profileEmail: {
    fontSize: 11,
    fontFamily: fonts.bodyRegular,
    color: colors.muted,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  itemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  itemActive: {
    backgroundColor: colors.soft,
  },
  itemLabel: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.navy,
    flex: 1,
  },
  itemLabelActive: {
    fontFamily: fonts.bodySemiBold,
  },
  itemLabelDestructive: {
    color: colors.destructive,
  },
  collapseToggle: {
    marginTop: 8,
  },
  langBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 19, 50, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langPanel: {
    width: 280,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
  },
  langTitle: {
    fontSize: 16,
    fontFamily: fonts.displayBold,
    color: colors.navy,
    marginBottom: 12,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.soft,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  langOptionText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.navy,
  },
  langNote: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.muted,
    marginTop: 12,
  },
});
