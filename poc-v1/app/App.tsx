import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import UploadScreen from './src/screens/UploadScreen';
import { clearTenant, getStoredTenant } from './src/services/tenantStorage';
import type { Tenant } from './src/types/tenant';
import { colors, fontsToLoad } from './src/theme';

type AuthScreen = 'login' | 'signup';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  const [changingPassword, setChangingPassword] = useState(false);
  const [fontsLoaded, fontsError] = useFonts(fontsToLoad);

  useEffect(() => {
    getStoredTenant()
      .then(setTenant)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontsError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontsError]);

  if (loading || (!fontsLoaded && !fontsError)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.electric} />
        <StatusBar style="auto" />
      </View>
    );
  }

  function renderContent() {
    if (tenant) {
      if (changingPassword) {
        return (
          <ChangePasswordScreen
            tenantEmail={tenant.email}
            onDone={() => setChangingPassword(false)}
            onCancel={() => setChangingPassword(false)}
          />
        );
      }

      return (
        <UploadScreen
          tenantEmail={tenant.email}
          onLogout={async () => {
            await clearTenant();
            setTenant(null);
            setAuthScreen('login');
          }}
          onChangePassword={() => setChangingPassword(true)}
        />
      );
    }

    if (authScreen === 'signup') {
      return (
        <SignupScreen onSignup={setTenant} onNavigateToLogin={() => setAuthScreen('login')} />
      );
    }

    return <LoginScreen onLogin={setTenant} onNavigateToSignup={() => setAuthScreen('signup')} />;
  }

  return (
    <>
      {renderContent()}
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.soft,
  },
});
