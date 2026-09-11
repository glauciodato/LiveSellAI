import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import LoginScreen from './src/screens/LoginScreen';
import UploadScreen from './src/screens/UploadScreen';
import { clearTenant, getStoredTenant } from './src/services/tenantStorage';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [tenantEmail, setTenantEmail] = useState<string | null>(null);

  useEffect(() => {
    getStoredTenant()
      .then((tenant) => setTenantEmail(tenant?.email ?? null))
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

  return (
    <>
      {tenantEmail ? (
        <UploadScreen
          tenantEmail={tenantEmail}
          onLogout={async () => {
            await clearTenant();
            setTenantEmail(null);
          }}
        />
      ) : (
        <LoginScreen onLogin={setTenantEmail} />
      )}
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
