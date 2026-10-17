import { useAppTheme } from '../context/ThemeContext';
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  Text,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { Lock, User as UserIcon, Eye, EyeOff } from 'lucide-react-native';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { spacing, radius, cardShadow } from '../constants/layout';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

export default function LoginScreen() {
  const { colors, theme, typography } = useAppTheme();
  const styles = getStyles(colors, theme, typography);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    setErrorMessage('');
    if (!username || !password) {
      setErrorMessage('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.login({ username, password });
      if (res.data.success) {
        if (res.data.data.role !== 'parent') {
          setErrorMessage('هذا التطبيق مخصص لحسابات أولياء الأمور فقط');
          return;
        }
        await login(res.data.data.token, res.data.data);
        router.replace('/');
      }
    } catch (error: unknown) {
      const err = error as {
        code?: string;
        message?: string;
        response?: { status?: number; data?: { message?: string } };
      };
      if (err?.code === 'SERVER_WAKE_FAILED' || err?.message === 'SERVER_WAKE_FAILED') {
        setErrorMessage('الخادم نائم — انتظر 30–60 ثانية ثم حاول تسجيل الدخول مجدداً');
      } else if (!err.response) {
        const code = err?.code || '';
        if (code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
          setErrorMessage('انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى.');
        } else {
          setErrorMessage(
            Platform.OS === 'web'
              ? 'تعذر الاتصال — افتح التطبيق عبر Expo Go على الهاتف'
              : 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مجدداً.'
          );
        }
      } else if (err.response.status === 401) {
        setErrorMessage(err.response.data?.message || 'اسم المستخدم أو كلمة المرور غير صحيحة');
      } else if (err.response.status === 404) {
        setErrorMessage('تعذر الوصول إلى الخادم. يرجى المحاولة لاحقاً.');
      } else {
        setErrorMessage(err.response.data?.message || 'حدث خطأ. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInUp.delay(200).duration(800)} style={styles.header}>
          <View style={styles.logoWrap}>
            <Image source={require('../assets/images/Logo.png')} style={styles.logo} />
          </View>
          <Text style={styles.title}>مدرسة النور القرآنية</Text>
          <Text style={styles.subtitle}>بوابة أولياء الأمور لمتابعة التحصيل اليومي</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.formCard}>
          {errorMessage ? (
            <View style={[styles.errorBox, { borderColor: colors.danger, backgroundColor: colors.dangerBg }]}>
              <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
            </View>
          ) : null}

          <View
            style={[
              styles.inputContainer,
              {
                borderColor: focusedField === 'username' ? colors.primary : colors.border,
                backgroundColor: focusedField === 'username' ? (theme === 'dark' ? 'rgba(96, 165, 250, 0.05)' : 'rgba(29, 78, 216, 0.03)') : colors.surfaceTrans,
              },
            ]}
          >
            <UserIcon
              size={20}
              color={focusedField === 'username' ? colors.primary : colors.textMuted}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="اسم المستخدم"
              placeholderTextColor={colors.textMuted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              textAlign="right"
              onFocus={() => setFocusedField('username')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <View
            style={[
              styles.inputContainer,
              {
                borderColor: focusedField === 'password' ? colors.primary : colors.border,
                backgroundColor: focusedField === 'password' ? (theme === 'dark' ? 'rgba(96, 165, 250, 0.05)' : 'rgba(29, 78, 216, 0.03)') : colors.surfaceTrans,
              },
            ]}
          >
            <Lock
              size={20}
              color={focusedField === 'password' ? colors.primary : colors.textMuted}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="كلمة المرور"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              textAlign="right"
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {showPassword
                ? <EyeOff size={20} color={colors.textMuted} />
                : <Eye size={20} color={colors.textMuted} />
              }
            </TouchableOpacity>
          </View>

          <PrimaryButton
            label={loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            onPress={handleLogin}
            loading={loading}
          />
        </Animated.View>

        <Animated.Text entering={FadeInDown.delay(600)} style={[styles.footer, { color: colors.textMuted }]}>جميع الحقوق محفوظة © 2026</Animated.Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any, theme: string, typography: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: spacing.lg,
    },
    header: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    logoWrap: {
      backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
      width: 112,
      height: 112,
      borderRadius: radius.xl,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...cardShadow(theme as 'light' | 'dark'),
    },
    logo: {
      width: 96,
      height: 96,
      resizeMode: 'contain',
      opacity: theme === 'dark' ? 0.9 : 1,
    },
    title: {
      fontSize: 24,
      fontFamily: typography.black,
      color: colors.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      fontFamily: typography.semiBold,
      color: colors.textMuted,
      marginTop: spacing.xs,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: spacing.md,
    },
    formCard: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
      ...cardShadow(theme as 'light' | 'dark'),
    },
    errorBox: {
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    errorText: {
      textAlign: 'center',
      fontSize: 14,
      fontFamily: typography.bold,
      lineHeight: 22,
    },
    inputContainer: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
    },
    inputIcon: {
      marginLeft: spacing.md,
    },
    input: {
      flex: 1,
      height: 52,
      fontSize: 16,
      fontFamily: typography.semiBold,
    },
    eyeBtn: {
      padding: spacing.xs,
      marginRight: spacing.xs,
    },
    footer: {
      textAlign: 'center',
      fontSize: 12,
      fontFamily: typography.regular,
      marginTop: spacing.xl,
    },
  });
