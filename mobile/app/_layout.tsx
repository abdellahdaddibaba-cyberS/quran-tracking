import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { AuthProvider } from '../context/AuthContext';
import { AppThemeProvider } from '../context/ThemeContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppThemeProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="student/[id]" options={{ headerShown: true, title: 'متابعة التحصيل' }} />
        </Stack>
        <StatusBar style="auto" />
      </AppThemeProvider>
    </AuthProvider>
  );
}
