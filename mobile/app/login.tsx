import { useAppTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Text, Image, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { Lock, User as UserIcon, Settings, Globe } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const { colors, theme } = useAppTheme();
  const styles = getStyles(colors, theme);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  // إعدادات رابط الاتصال بالخادم
  const [showSettings, setShowSettings] = useState(false);
  const [customApiUrl, setCustomApiUrl] = useState('');

  useEffect(() => {
    loadApiUrl();
  }, []);

  const loadApiUrl = async () => {
    try {
      const savedUrl = await AsyncStorage.getItem('apiUrl');
      if (savedUrl) {
        setCustomApiUrl(savedUrl);
      } else {
        setCustomApiUrl('https://quran-tracking-api.onrender.com/api');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveApiUrl = async () => {
    try {
      const cleanUrl = customApiUrl.trim();
      if (cleanUrl === '' || cleanUrl === 'https://quran-tracking-api.onrender.com/api') {
        await AsyncStorage.removeItem('apiUrl');
      } else {
        await AsyncStorage.setItem('apiUrl', cleanUrl);
      }
      Alert.alert('تم التحديث ✅', 'تم تحديث رابط الاتصال بالخادم بنجاح! 🚀');
      setShowSettings(false);
    } catch (e) {
      Alert.alert('خطأ ❌', 'فشل حفظ رابط الاتصال');
    }
  };

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
        await login(res.data.data.token, res.data.data);
        router.replace('/');
      }
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || 'تأكد من البيانات والاتصال بالخادم');
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
          <View style={{
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
            overflow: 'hidden'
          }}>
            <Image 
              source={require('../assets/images/Logo.png')} 
              style={{ width: 110, height: 110, resizeMode: 'contain' }} 
            />
          </View>
          <Text style={styles.title}>مدرسة النور القرآنية</Text>
          <Text style={styles.subtitle}>بوابة أولياء الأمور لمتابعة التحصيل اليومي</Text>
        </View>

        <View style={styles.form}>
          {errorMessage ? (
            <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }}>
              <Text style={{ color: '#ef4444', textAlign: 'center', fontSize: 14 }}>{errorMessage}</Text>
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
              {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
            </Text>
          </TouchableOpacity>

          {/* زر وواجهة إعدادات الاتصال بالخادم */}
          <TouchableOpacity 
            style={styles.settingsToggle}
            onPress={() => setShowSettings(!showSettings)}
            activeOpacity={0.7}
          >
            <Settings size={16} color={colors.textMuted} />
            <Text style={styles.settingsToggleText}>إعدادات الاتصال بالخادم</Text>
          </TouchableOpacity>

          {showSettings && (
            <View style={styles.settingsCard}>
              <Text style={styles.settingsTitle}>رابط خادم البيانات (API):</Text>
              
              <View style={[styles.inputContainer, { height: 48, marginTop: 4 }]}>
                <Globe size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { fontSize: 13, height: '100%' }]}
                  placeholder="https://example.com/api"
                  placeholderTextColor="#94a3b8"
                  value={customApiUrl}
                  onChangeText={setCustomApiUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.quickUrlsContainer}>
                <TouchableOpacity 
                  style={styles.quickUrlBtn}
                  onPress={() => setCustomApiUrl('https://quran-tracking-api.onrender.com/api')}
                >
                  <Text style={styles.quickUrlText}>الخادم السحابي</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.quickUrlBtn}
                  onPress={() => setCustomApiUrl('http://192.168.1.100:5000/api')}
                >
                  <Text style={styles.quickUrlText}>خادم محلي (WiFi)</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.quickUrlBtn}
                  onPress={() => setCustomApiUrl('http://10.0.2.2:5000/api')}
                >
                  <Text style={styles.quickUrlText}>محاكي أندرويد</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.saveSettingsBtn}
                onPress={handleSaveApiUrl}
              >
                <Text style={styles.saveSettingsBtnText}>حفظ رابط الخادم</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.footer}>جميع الحقوق محفوظة © 2026</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any, theme: string) => StyleSheet.create({
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
    marginBottom: 32,
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
    marginTop: 32,
  },
  settingsToggle: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    paddingVertical: 8,
  },
  settingsToggleText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  settingsCard: {
    backgroundColor: theme === 'dark' ? 'rgba(30, 41, 59, 0.6)' : 'rgba(241, 245, 249, 0.8)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  settingsTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  quickUrlsContainer: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
    marginTop: 4,
  },
  quickUrlBtn: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  quickUrlText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  saveSettingsBtn: {
    backgroundColor: colors.primary,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  saveSettingsBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
