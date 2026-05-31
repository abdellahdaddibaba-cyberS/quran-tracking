import { useAppTheme } from '../context/ThemeContext';
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { Lock, User as UserIcon } from 'lucide-react-native';

export default function LoginScreen() {
  const { colors } = useAppTheme();
  const styles = getStyles(colors);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
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
    } catch (error: any) {
      if (!error.response) {
        const code = error?.code || '';
        if (code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
          setErrorMessage('انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى.');
        } else {
          setErrorMessage('تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت وحاول مجدداً.');
        }
      } else if (error.response.status === 401) {
        setErrorMessage(error.response.data?.message || 'اسم المستخدم أو كلمة المرور غير صحيحة');
      } else if (error.response.status === 404) {
        setErrorMessage('تعذر الوصول إلى الخادم. يرجى المحاولة لاحقاً أو التواصل مع الإدارة.');
      } else {
        setErrorMessage(error.response.data?.message || 'حدث خطأ. يرجى المحاولة مرة أخرى.');
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <Image
              source={require('../assets/images/Logo.png')}
              style={styles.logo}
            />
          </View>
          <Text style={styles.title}>مدرسة النور القرآنية</Text>
          <Text style={styles.subtitle}>بوابة أولياء الأمور لمتابعة التحصيل اليومي</Text>
        </View>

        <View style={styles.form}>
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.inputContainer}>
            <UserIcon size={20} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="اسم المستخدم"
              placeholderTextColor="#94a3b8"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Lock size={20} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="كلمة المرور"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>جميع الحقوق محفوظة © 2026</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 24,
    },
    header: {
      alignItems: 'center',
      marginBottom: 48,
    },
    logoWrap: {
      backgroundColor: '#ffffff',
      width: 120,
      height: 120,
      borderRadius: 60,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
      overflow: 'hidden',
    },
    logo: {
      width: 110,
      height: 110,
      resizeMode: 'contain',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: colors.textMuted,
      marginTop: 4,
      textAlign: 'center',
    },
    form: {
      gap: 16,
    },
    errorBox: {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    errorText: {
      color: '#ef4444',
      textAlign: 'center',
      fontSize: 14,
    },
    inputContainer: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      backgroundColor: colors.surfaceTrans,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
    },
    inputIcon: {
      marginLeft: 12,
    },
    input: {
      flex: 1,
      height: 56,
      color: colors.text,
      fontSize: 16,
      textAlign: 'right',
    },
    button: {
      backgroundColor: colors.success,
      height: 56,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 8,
      shadowColor: colors.success,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: 'bold',
    },
    footer: {
      textAlign: 'center',
      color: '#475569',
      fontSize: 12,
      marginTop: 48,
    },
  });
