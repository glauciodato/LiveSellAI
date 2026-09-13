import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import UploadScreen from './src/screens/UploadScreen';
import { clearTenant, getStoredTenant } from './src/services/tenantStorage';
import type { Tenant } from './src/types/tenant';

type AuthScreen = 'login' | 'signup';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');

  useEffect(() => {
    getStoredTenant()
      .then(setTenant)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <StatusBar style="auto" />
      </View>
    );
  }

  function renderContent() {
    if (tenant) {
      return (
        <UploadScreen
          tenantEmail={tenant.email}
          onLogout={async () => {
            await clearTenant();
            setTenant(null);
            setAuthScreen('login');
          }}
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
    backgroundColor: '#fff',
  },
});
