import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../services/notificationService';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AppThemeProvider, useAppTheme } from '../context/ThemeContext';
import { useAuthRedirect } from '../hooks/use-auth-redirect';
import { useNotificationNavigation } from '../hooks/use-notification-navigation';
import { useAppUpdates } from '../hooks/use-app-updates';
import { usePushNotifications } from '../hooks/use-push-notifications';
import { LoadingView } from '../components/ui/LoadingView';

function RootNavigator() {
  const { loading } = useAuth();
  const { theme, colors } = useAppTheme();
  useAuthRedirect();
  useNotificationNavigation();
  useAppUpdates();
  usePushNotifications();

  if (loading) {
    return <LoadingView />;
  }

  return (
  <>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
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
