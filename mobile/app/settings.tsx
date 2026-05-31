import { useAppTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  SafeAreaView, ActivityIndicator, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { authAPI, mobileAPI } from '../services/api';
import { setupNotifications, isPushSupported } from '../services/notificationService';
import { ChevronLeft, Save, CheckCircle, AlertCircle, Bell } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const { colors } = useAppTheme();
  const styles = getStyles(colors);
  const { user, updateUser, logout, login } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState(user?.username || '');
  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [pushRegistered, setPushRegistered] = useState<boolean | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | null; text: string }>({ type: null, text: '' });

  useEffect(() => {
    if (!isPushSupported()) {
      setPushRegistered(false);
      return;
    }
    authAPI.getMe().then((res) => {
      setPushRegistered(!!res.data?.data?.pushToken);
    }).catch(() => setPushRegistered(false));
  }, []);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg({ type: null, text: '' }), 5000);
  };

  const handleTestNotification = async () => {
    if (!isPushSupported()) {
      showStatus('error', 'الإشعارات متاحة فقط على تطبيق Android أو iOS');
      return;
    }

    setTestingPush(true);
    setStatusMsg({ type: null, text: '' });
    try {
      const result = await setupNotifications();
      if (!result.ok) {
        showStatus('error', result.message || 'فشل تسجيل الإشعارات — حاول مجدداً');
        setPushRegistered(false);
        return;
      }

      setPushRegistered(true);

      const res = await mobileAPI.testPush();
      if (res.data?.success) {
        showStatus('success', res.data.message || 'تم إرسال إشعار تجريبي — تحقق من شريط الإشعارات');
      } else {
        showStatus('error', res.data?.message || 'فشل إرسال الإشعار التجريبي');
      }
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        'تعذر إرسال الإشعار. تأكد من الاتصال بالإنترنت وأعد المحاولة.';
      showStatus('error', msg);
    } finally {
      setTestingPush(false);
    }
  };

  const handleSave = async () => {
    setStatusMsg({ type: null, text: '' });

    if (!username.trim()) {
      showStatus('error', 'اسم المستخدم لا يمكن أن يكون فارغاً');
      return;
    }

    const isChangingPassword = !!password;

    if (isChangingPassword) {
      if (!oldPassword) {
        showStatus('error', 'يرجى إدخال كلمة المرور القديمة');
        return;
      }
    }

    setLoading(true);
    try {
      const data: any = { username };
      if (isChangingPassword) {
        data.password = password;
        data.oldPassword = oldPassword;
      }

      const res = await authAPI.updateProfile(data);

      if (!res?.data?.success) {
        showStatus('error', res?.data?.message || 'فشلت العملية');
        setLoading(false);
        return;
      }

      updateUser(res.data.data);
      await AsyncStorage.setItem('savedUsername', username);

      if (isChangingPassword) {
        // Password changed - try re-login
        try {
          const freshRes = await authAPI.login({ username, password });
          if (freshRes?.data?.success) {
            await login(freshRes.data.data.token, freshRes.data.data);
            showStatus('success', 'تم تغيير كلمة المرور بنجاح ✅');
            setOldPassword('');
            setPassword('');
          } else {
            // password changed but re-login failed - force logout
            await logout();
            router.replace('/login');
          }
        } catch {
          // Assume password changed, force re-login
          await logout();
          router.replace('/login');
        }
      } else {
        showStatus('success', 'تم تحديث اسم المستخدم بنجاح ✅');
      }
    } catch (error: any) {
      console.error('Settings error:', error?.response?.data, error?.message);
      const msg = error?.response?.data?.message
        || (error?.message?.includes('Network') ? 'خطأ في الاتصال بالخادم' : 'حدث خطأ غير متوقع');
      showStatus('error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الإعدادات</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>تعديل بيانات الحساب</Text>

        <View style={styles.notifCard}>
          <Text style={styles.notifTitle}>إشعارات التحصيل</Text>
          <Text style={styles.notifHint}>
            اضغط الزر أدناه لاختبار الإشعارات. يجب أن يصل إشعار تجريبي خلال ثوانٍ.
            {'\n'}⚠️ يعمل فقط على هاتف Android/iOS عبر Expo Go — وليس من المتصفح.
          </Text>
          {pushRegistered === true && (
            <Text style={[styles.notifStatus, { color: colors.success }]}>● الإشعارات مسجّلة على الخادم</Text>
          )}
          {pushRegistered === false && (
            <Text style={[styles.notifStatus, { color: '#f59e0b' }]}>● الإشعارات غير مسجّلة — اضغط الزر للتفعيل</Text>
          )}
          <TouchableOpacity
            style={[styles.testBtn, testingPush && styles.saveBtnDisabled]}
            onPress={handleTestNotification}
            disabled={testingPush}
          >
            {testingPush ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.testBtnText}>اختبار الإشعار</Text>
                <Bell size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Status Message */}
        {statusMsg.type && (
          <View style={[styles.statusBox, statusMsg.type === 'success' ? styles.statusSuccess : styles.statusError]}>
            {statusMsg.type === 'success'
              ? <CheckCircle size={18} color="#22c55e" />
              : <AlertCircle size={18} color="#ef4444" />
            }
            <Text style={[styles.statusText, { color: statusMsg.type === 'success' ? '#22c55e' : '#ef4444' }]}>
              {statusMsg.text}
            </Text>
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={styles.label}>اسم المستخدم</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="أدخل اسم المستخدم"
            placeholderTextColor="#64748b"
            textAlign="right"
            autoCapitalize="none"
            editable={!loading}
          />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>تغيير كلمة المرور (اختياري)</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>كلمة المرور الحالية</Text>
          <TextInput
            style={styles.input}
            value={oldPassword}
            onChangeText={setOldPassword}
            placeholder="أدخل كلمة المرور الحالية"
            placeholderTextColor="#64748b"
            secureTextEntry
            textAlign="right"
            editable={!loading}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>كلمة المرور الجديدة</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="أدخل كلمة المرور الجديدة"
            placeholderTextColor="#64748b"
            secureTextEntry
            textAlign="right"
            editable={!loading}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.saveBtnText}>حفظ التغييرات</Text>
              <Save size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 8 },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  content: { padding: 24 },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'right',
  },
  notifCard: {
    backgroundColor: colors.surfaceTrans,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  notifTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 8,
  },
  notifHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right',
    marginBottom: 8,
  },
  notifStatus: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 14,
  },
  testBtn: {
    backgroundColor: colors.success,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
  },
  testBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  statusBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  statusSuccess: { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.3)' },
  statusError: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  statusText: { flex: 1, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  formGroup: { marginBottom: 20 },
  label: { color: colors.textMuted, fontSize: 14, marginBottom: 8, textAlign: 'right' },
  input: {
    backgroundColor: colors.surfaceTrans,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    color: colors.text,
    fontSize: 16,
  },
  divider: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginVertical: 20,
    gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  saveBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
