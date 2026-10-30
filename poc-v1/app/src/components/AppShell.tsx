import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Sidebar, { type SidebarScreen } from './Sidebar';
import { colors } from '../theme';
import type { Tenant } from '../types/tenant';

const WIDE_BREAKPOINT = 900;

interface AppShellProps {
  tenant: Tenant;
  activeScreen: SidebarScreen;
  onNavigateHome: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
  children: ReactNode;
}

/**
 * Casco da aplicação pós-login: sidebar fixa (recolhível) em telas largas,
 * gaveta acionada por um botão de menu em telas estreitas. Cada tela só
 * cuida do próprio conteúdo -- a navegação/perfil ficam todos aqui.
 */
export default function AppShell({
  tenant,
  activeScreen,
  onNavigateHome,
  onChangePassword,
  onLogout,
  children,
}: AppShellProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <View style={styles.root}>
      {isWide ? (
        <Sidebar
          tenant={tenant}
          activeScreen={activeScreen}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          onNavigateHome={onNavigateHome}
          onChangePassword={onChangePassword}
          onLogout={onLogout}
        />
      ) : null}

      <View style={styles.content}>
        {!isWide ? (
          <View style={styles.mobileTopBar}>
            {activeScreen !== 'home' ? (
              <TouchableOpacity onPress={onNavigateHome} accessibilityLabel="Voltar pro Home">
                <Ionicons name="arrow-back" size={22} color={colors.navy} />
              </TouchableOpacity>
            ) : (
              <View style={styles.topBarSpacer} />
            )}

            <Image
              source={require('../../assets/brand/sellai-symbol.png')}
              style={styles.mobileSymbol}
              resizeMode="contain"
            />

            <TouchableOpacity onPress={() => setDrawerOpen(true)} accessibilityLabel="Abrir menu">
              <Ionicons name="menu" size={24} color={colors.navy} />
            </TouchableOpacity>
          </View>
        ) : null}

        {children}
      </View>

      {!isWide ? (
        <Modal
          visible={drawerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setDrawerOpen(false)}
        >
          <Pressable style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)}>
            <Pressable style={styles.drawerPanel} onPress={(e) => e.stopPropagation()}>
              <Sidebar
                tenant={tenant}
                activeScreen={activeScreen}
                collapsed={false}
                onNavigateHome={() => {
                  setDrawerOpen(false);
                  onNavigateHome();
                }}
                onChangePassword={() => {
                  setDrawerOpen(false);
                  onChangePassword();
                }}
                onLogout={() => {
                  setDrawerOpen(false);
                  onLogout();
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.soft,
  },
  content: {
    flex: 1,
  },
  mobileTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  topBarSpacer: {
    width: 22,
  },
  mobileSymbol: {
    width: 28,
    height: 27,
  },
  drawerBackdrop: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(3, 19, 50, 0.4)',
  },
  drawerPanel: {
    height: '100%',
  },
});
