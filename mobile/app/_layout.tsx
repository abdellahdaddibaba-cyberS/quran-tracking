import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AppThemeProvider } from '../context/ThemeContext';
import { useAuthRedirect } from '../hooks/use-auth-redirect';

function RootNavigator() {
  const { loading } = useAuth();
  useAuthRedirect();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return (
  <>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="student/[id]" options={{ headerShown: true, title: 'متابعة التحصيل' }} />
    </Stack>
    <StatusBar style="auto" />
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
