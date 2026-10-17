import { useAppTheme } from '../context/ThemeContext';
import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  SafeAreaView, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { mobileAPI } from '../services/api';
import { CheckCircle, AlertCircle, MessageSquare, Send, HelpCircle, Lightbulb, FileText } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { spacing, radius, cardShadow } from '../constants/layout';

const FEEDBACK_TYPES = [
  { id: 'suggestion', label: 'اقتراح' },
  { id: 'bug', label: 'بلاغ خطأ' },
  { id: 'complaint', label: 'شكوى' },
  { id: 'other', label: 'أخرى' },
];

const getFeedbackIcon = (id: string, color: string) => {
  switch (id) {
    case 'suggestion':
      return <Lightbulb size={16} color={color} />;
    case 'bug':
      return <AlertCircle size={16} color={color} />;
    case 'complaint':
      return <FileText size={16} color={color} />;
    default:
      return <HelpCircle size={16} color={color} />;
  }
};

export default function FeedbackScreen() {
  const { colors, theme, typography } = useAppTheme();
  const styles = getStyles(colors, theme, typography);
  const router = useRouter();

  const [type, setType] = useState('suggestion');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | null; text: string }>({ type: null, text: '' });
  const [isFocused, setIsFocused] = useState(false);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    if (type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setTimeout(() => setStatusMsg({ type: null, text: '' }), 5000);
  };

  const handleSubmit = async () => {
    setStatusMsg({ type: null, text: '' });

    if (!message.trim()) {
      showStatus('error', 'يرجى كتابة رسالتك أولاً');
      return;
    }

    if (message.trim().length < 10) {
      showStatus('error', 'يرجى كتابة رسالة توضيحية لا تقل عن 10 أحرف');
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await mobileAPI.submitFeedback({ type, message });

      if (res?.data?.success) {
        showStatus('success', 'شكراً لك! تم إرسال ملاحظاتك بنجاح إلى الإدارة.');
        setMessage('');
        setType('suggestion');
        // Back navigation after short delay to let user see success
        setTimeout(() => {
          router.back();
        }, 2000);
      } else {
        showStatus('error', res?.data?.message || 'فشل إرسال الملاحظة');
      }
    } catch (error: unknown) {
      console.error('Feedback submit error:', error);
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
      <ScreenHeader title="الملاحظات والشكاوى" subtitle="إرسال آرائك واقتراحاتك للإدارة" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
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
            <View style={styles.headerRow}>
              <MessageSquare size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>نوع الملاحظة</Text>
            </View>

            <View style={styles.typesGrid}>
              {FEEDBACK_TYPES.map((t) => {
                const isSelected = type === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.typeBtn,
                      isSelected && {
                        backgroundColor: colors.primaryBg,
                        borderColor: colors.primary,
                      }
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setType(t.id);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                      {getFeedbackIcon(t.id, isSelected ? colors.primary : colors.textMuted)}
                      <Text
                        style={[
                          styles.typeBtnText,
                          { color: isSelected ? colors.primary : colors.textSecondary }
                        ]}
                      >
                        {t.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.divider} />

            <Text style={styles.label}>رسالتك</Text>
            <TextInput
              style={[
                styles.messageInput,
                isFocused && {
                  borderColor: colors.primary,
                  backgroundColor: theme === 'dark' ? 'rgba(96, 165, 250, 0.05)' : 'rgba(29, 78, 216, 0.03)',
                }
              ]}
              value={message}
              onChangeText={setMessage}
              placeholder="اكتب هنا اقتراحاتك، أو شكواك، أو المشاكل التي تواجهها بالتفصيل..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={6}
              textAlign="right"
              textAlignVertical="top"
              maxLength={1000}
              editable={!loading}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
            <Text style={styles.charCount}>
              {message.length} / 1000 حرف
            </Text>

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>إرسال الملاحظة</Text>
                  <Send size={18} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <HelpCircle size={16} color={colors.textMuted} />
            <Text style={styles.infoText}>
              تصل ملاحظاتك مباشرة إلى الإدارة ويتم مراجعتها
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, theme: string, typography: any) =>
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
    headerRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 16,
      fontFamily: typography.bold,
      textAlign: 'right',
    },
    typesGrid: {
      flexDirection: 'row-reverse',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: spacing.sm,
      marginBottom: spacing.lg,
    },
    typeBtn: {
      width: '48%',
      backgroundColor: colors.surfaceTrans,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md - 2,
      paddingHorizontal: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeBtnText: {
      fontSize: 14,
      fontFamily: typography.semiBold,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.md,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 14,
      fontFamily: typography.semiBold,
      textAlign: 'right',
      marginBottom: spacing.sm,
    },
    messageInput: {
      backgroundColor: colors.surfaceTrans,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
      color: colors.text,
      fontSize: 15,
      fontFamily: typography.regular,
      height: 150,
      textAlign: 'right',
      textAlignVertical: 'top',
    },
    charCount: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: typography.regular,
      textAlign: 'left',
      marginTop: 4,
      marginBottom: spacing.lg,
    },
    submitBtn: {
      backgroundColor: colors.success,
      flexDirection: 'row-reverse',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
      padding: spacing.md,
      borderRadius: radius.md,
      shadowColor: colors.success,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 3,
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { color: '#fff', fontSize: 16, fontFamily: typography.bold },
    statusBox: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderRadius: radius.md,
      marginBottom: spacing.md,
      borderWidth: 1,
    },
    statusSuccess: { backgroundColor: colors.successBg, borderColor: theme === 'dark' ? 'rgba(52, 211, 153, 0.25)' : 'rgba(5, 150, 105, 0.2)' },
    statusError: { backgroundColor: colors.dangerBg, borderColor: theme === 'dark' ? 'rgba(248, 113, 113, 0.25)' : 'rgba(220, 38, 38, 0.2)' },
    statusText: { flex: 1, fontSize: 13, fontFamily: typography.semiBold, textAlign: 'right' },
    infoCard: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 8,
      padding: spacing.md,
      marginTop: spacing.lg,
      backgroundColor: colors.surfaceTrans,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoText: {
      flex: 1,
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: typography.regular,
      textAlign: 'right',
      lineHeight: 18,
    },
  });
