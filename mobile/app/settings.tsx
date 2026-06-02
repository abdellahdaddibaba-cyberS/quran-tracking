import { useAppTheme } from '../context/ThemeContext';
import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  SafeAreaView, ActivityIndicator, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { Save, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { spacing, radius, cardShadow } from '../constants/layout';
import * as Haptics from 'expo-haptics';

export default function SettingsScreen() {
  const { colors, theme } = useAppTheme();
  const styles = getStyles(colors, theme);
  const { user, updateUser, logout, login } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState(user?.username || '');
  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | null; text: string }>({ type: null, text: '' });

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg({ type: null, text: '' }), 5000);
  };

  const handleSave = async () => {
    setStatusMsg({ type: null, text: '' });

    if (!username.trim()) {
      showStatus('error', 'اسم المستخدم لا يمكن أن يكون فارغاً');
      return;
    }

    const isChangingPassword = !!password;

    if (isChangingPassword && !oldPassword) {
      showStatus('error', 'يرجى إدخال كلمة المرور القديمة');
      return;
    }

    setLoading(true);
    try {
      const data: { username: string; password?: string; oldPassword?: string } = { username };
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
        try {
          const freshRes = await authAPI.login({ username, password });
          if (freshRes?.data?.success) {
            await login(freshRes.data.data.token, freshRes.data.data);
            showStatus('success', 'تم تغيير كلمة المرور بنجاح');
            setOldPassword('');
            setPassword('');
          } else {
            await logout();
            router.replace('/login');
          }
        } catch {
          await logout();
          router.replace('/login');
        }
      } else {
        showStatus('success', 'تم تحديث اسم المستخدم بنجاح');
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const msg = err?.response?.data?.message
        || (err?.message?.includes('Network') ? 'خطأ في الاتصال بالخادم' : 'حدث خطأ غير متوقع');
      showStatus('error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="الإعدادات" subtitle="إدارة حساب ولي الأمر" />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {statusMsg.type && (
          <View style={[styles.statusBox, statusMsg.type === 'success' ? styles.statusSuccess : styles.statusError]}>
            {statusMsg.type === 'success'
              ? <CheckCircle size={18} color={colors.success} />
              : <AlertCircle size={18} color={colors.danger} />
            }
            <Text style={[styles.statusText, { color: statusMsg.type === 'success' ? colors.success : colors.danger }]}>
              {statusMsg.text}
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>بيانات الحساب</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>اسم المستخدم</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="أدخل اسم المستخدم"
              placeholderTextColor={colors.textMuted}
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
              placeholder="كلمة المرور الحالية"
              placeholderTextColor={colors.textMuted}
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
              placeholder="كلمة المرور الجديدة"
              placeholderTextColor={colors.textMuted}
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
        </View>

        <View style={[styles.card, { marginTop: spacing.lg }]}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: spacing.sm }}>
            <MessageSquare size={20} color={colors.primary} />
            <Text style={[styles.cardTitle, { marginBottom: 0 }]}>الدعم والملاحظات</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            هل لديك أي اقتراح أو شكوى؟ يمكنك إرسالها مباشرة لإدارة الحلقة لمساعدتنا على تحسين الخدمة.
          </Text>

          <TouchableOpacity
            style={styles.feedbackBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/feedback');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.feedbackBtnText}>إرسال ملاحظة أو شكوى</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ReturnType<typeof import('../context/ThemeContext').useAppTheme>['colors'], theme: string) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xl },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...cardShadow(theme as 'light' | 'dark'),
    },
    cardTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
      textAlign: 'right',
      marginBottom: spacing.lg,
    },
    statusBox: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderRadius: radius.md,
      marginBottom: spacing.md,
      borderWidth: 1,
    },
    statusSuccess: { backgroundColor: colors.successBg, borderColor: 'rgba(52, 211, 153, 0.35)' },
    statusError: { backgroundColor: colors.dangerBg, borderColor: 'rgba(248, 113, 113, 0.35)' },
    statusText: { flex: 1, fontSize: 14, fontWeight: '600', textAlign: 'right' },
    formGroup: { marginBottom: spacing.md },
    label: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm, textAlign: 'right', fontWeight: '600' },
    input: {
      backgroundColor: colors.surfaceTrans,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
      color: colors.text,
      fontSize: 16,
    },
    divider: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      marginVertical: spacing.md,
      gap: 10,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { color: colors.textMuted, fontSize: 12 },
    saveBtn: {
      backgroundColor: colors.primary,
      flexDirection: 'row-reverse',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
      padding: spacing.md,
      borderRadius: radius.md,
      marginTop: spacing.sm,
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    cardSubtitle: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: 'right',
      marginBottom: spacing.lg,
      lineHeight: 18,
    },
    feedbackBtn: {
      backgroundColor: colors.surfaceTrans,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row-reverse',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
      padding: spacing.md,
      borderRadius: radius.md,
    },
    feedbackBtnText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '700',
    },
  });
