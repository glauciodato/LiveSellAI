import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import AppShell from './src/components/AppShell';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';
import HomeScreen, { type OnboardingStep } from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import UploadScreen from './src/screens/UploadScreen';
import VoiceCloneInfoScreen from './src/screens/VoiceCloneInfoScreen';
import { clearTenant, getStoredTenant, saveTenant } from './src/services/tenantStorage';
import type { Tenant } from './src/types/tenant';
import { colors, fontsToLoad } from './src/theme';

type AuthScreen = 'login' | 'signup';
type MainScreen = 'home' | OnboardingStep;

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  const [mainScreen, setMainScreen] = useState<MainScreen>('home');
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
      const handleLogout = async () => {
        await clearTenant();
        setTenant(null);
        setAuthScreen('login');
        setMainScreen('home');
        setChangingPassword(false);
      };
      const goHome = () => {
        setChangingPassword(false);
        setMainScreen('home');
      };

      let screenContent;
      if (changingPassword) {
        screenContent = (
          <ChangePasswordScreen
            tenantEmail={tenant.email}
            hasPassword={tenant.hasPassword}
            onDone={async (updatedTenant) => {
              await saveTenant(updatedTenant);
              setTenant(updatedTenant);
              setChangingPassword(false);
            }}
            onCancel={() => setChangingPassword(false)}
          />
        );
      } else if (mainScreen === 'avatar') {
        screenContent = <UploadScreen tenant={tenant} />;
      } else if (mainScreen === 'voice') {
        screenContent = <VoiceCloneInfoScreen />;
      } else {
        screenContent = <HomeScreen tenant={tenant} onNavigateToStep={setMainScreen} />;
      }

      return (
        <AppShell
          tenant={tenant}
          activeScreen={changingPassword ? 'password' : mainScreen}
          onNavigateHome={goHome}
          onChangePassword={() => setChangingPassword(true)}
          onLogout={handleLogout}
        >
          {screenContent}
        </AppShell>
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
