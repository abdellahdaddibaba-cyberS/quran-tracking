import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold, Cairo_900Black } from '@expo-google-fonts/cairo';

import '../services/notificationService';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AppThemeProvider, useAppTheme } from '../context/ThemeContext';
import { useAuthRedirect } from '../hooks/use-auth-redirect';
import { useNotificationNavigation } from '../hooks/use-notification-navigation';
import { useAppUpdates } from '../hooks/use-app-updates';
import { usePushNotifications } from '../hooks/use-push-notifications';
import { LoadingView } from '../components/ui/LoadingView';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { loading: authLoading } = useAuth();
  const { theme, colors } = useAppTheme();
  
  const [fontsLoaded, fontError] = useFonts({
    'Cairo-Regular': Cairo_400Regular,
    'Cairo-SemiBold': Cairo_600SemiBold,
    'Cairo-Bold': Cairo_700Bold,
    'Cairo-Black': Cairo_900Black,
  });

  useAuthRedirect();
  useNotificationNavigation();
  useAppUpdates();
  usePushNotifications();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (authLoading || (!fontsLoaded && !fontError)) {
    return <LoadingView />;
  }

  return (
  <>
    <Stack screenOptions={{ 
      headerShown: false, 
      contentStyle: { backgroundColor: colors.background },
      animation: 'slide_from_right'
    }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="feedback" options={{ headerShown: false }} />
      <Stack.Screen name="student/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="student/prizes/[id]" options={{ headerShown: false }} />
    </Stack>
    <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
  </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppThemeProvider>
        <RootNavigator />
      </AppThemeProvider>
    </AuthProvider>
  );
}
