import { useAppTheme } from '../context/ThemeContext';
import React, { useEffect, useState, useMemo } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { mobileAPI } from '../services/api';
import { Users, ChevronLeft, LogOut, BookOpen, Star, Settings, Sun, Moon, Award, Waves } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { spacing, radius, cardShadow } from '../constants/layout';
import { EmptyState } from '../components/ui/EmptyState';
import { cleanStudentName } from '../utils/name';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';

const LEVEL_TRANSLATIONS: { [key: string]: string } = {
  level1: 'المستوى الأول',
  level2: 'المستوى الثاني',
  level3: 'المستوى الثالث',
  level4: 'المستوى الرابع'
};

const LEVEL_COLORS: { [key: string]: { border: string; bg: string; text: string } } = {
  level1: { border: '#059669', bg: 'rgba(5, 150, 105, 0.1)', text: '#059669' },
  level2: { border: '#1d4ed8', bg: 'rgba(29, 78, 216, 0.1)', text: '#1d4ed8' },
  level3: { border: '#b45309', bg: 'rgba(180, 83, 9, 0.1)', text: '#b45309' },
  level4: { border: '#7c3aed', bg: 'rgba(124, 58, 237, 0.1)', text: '#7c3aed' },
};

export default function HomeScreen() {
  const { colors, theme, toggleTheme, typography } = useAppTheme();
  const styles = getStyles(colors, theme, typography);
  const { user, loading: authLoading, logout } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      fetchStudents();
    }
  }, [user, authLoading]);

  const fetchStudents = async () => {
    try {
      const res = await mobileAPI.getStudents();
      setStudents(res.data.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'صباح الخير ☀️';
    if (hour >= 12 && hour < 18) return 'مساء الخير 🌤️';
    return 'مساء الخير ✨';
  };

  const handleLogout = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    logout();
  };

  const handleToggleTheme = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleTheme();
  };

  const handleSettingsPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/settings');
  };

  const handleStudentPress = (studentId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/student/${studentId}`);
  };

  // Dashboard Stats calculations
  const totalDailyTarget = useMemo(() => {
    return students.reduce((acc, curr) => acc + (curr.dailyTarget || 0), 0);
  }, [students]);

  if (authLoading || !user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.success} />
      </View>
    );
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.success} />
      </View>
    );
  }

  const renderStudent = ({ item, index }: { item: any, index: number }) => {
    const levelStyle = LEVEL_COLORS[item.level] || { border: colors.primary, bg: colors.primaryBg, text: colors.primary };
    const displayName = cleanStudentName(item.name, user?.fullName || '');
    
    return (
      <Animated.View entering={FadeInDown.delay(index * 100).duration(600)}>
        <TouchableOpacity
          style={[
            styles.studentCard,
            cardShadow(theme),
            { borderRightColor: levelStyle.border, borderRightWidth: 4 }
          ]}
          onPress={() => handleStudentPress(item._id)}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <View style={styles.chevronContainer}>
              <ChevronLeft size={20} color={colors.textMuted} />
            </View>
            
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{displayName}</Text>
              <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 6, alignItems: 'center' }}>
                <View style={[styles.levelBadge, { backgroundColor: levelStyle.bg, marginTop: 0 }]}>
                  <Award size={13} color={levelStyle.border} />
                  <Text style={[styles.studentLevel, { color: levelStyle.text }]}>
                    {LEVEL_TRANSLATIONS[item.level] || item.level}
                  </Text>
                </View>
                {item.hasSwimmingToday && (
                  <View style={styles.swimmingBadge}>
                    <Waves size={12} color="#0ea5e9" />
                    <Text style={styles.swimmingBadgeText}>سباحة اليوم</Text>
                  </View>
                )}
              </View>
            </View>
            
            <View style={[styles.avatar, { backgroundColor: levelStyle.border }]}>
              <Text style={styles.avatarText}>{displayName ? displayName[0] : 'أ'}</Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.statContainer}>
              <View style={[styles.statIconWrapper, { backgroundColor: colors.successBg }]}>
                <BookOpen size={16} color={colors.success} />
              </View>
              <View>
                <Text style={styles.statLabel}>السورة الحالية</Text>
                <Text style={styles.statValue}>{item.currentSurah || item.startSurah || 'غير محدد'}</Text>
              </View>
            </View>
            
            <View style={styles.statDivider} />

            <View style={styles.statContainer}>
              <View style={[styles.statIconWrapper, { backgroundColor: colors.goldBg }]}>
                <Star size={16} color={colors.gold} />
              </View>
              <View>
                <Text style={styles.statLabel}>القسط اليومي</Text>
                <Text style={styles.statValue}>{item.dailyTarget || 0} صفحات</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Welcome / Header Area */}
      <Animated.View entering={FadeInDown.duration(800)} style={styles.header}>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.7}>
            <LogOut size={20} color={colors.danger} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSettingsPress} style={styles.settingsBtn} activeOpacity={0.7}>
            <Settings size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleToggleTheme} style={styles.themeBtn} activeOpacity={0.7}>
            {theme === 'dark' ? <Sun size={20} color="#f59e0b" /> : <Moon size={20} color="#1d4ed8" />}
          </TouchableOpacity>
        </View>

        <View style={styles.profileRow}>
          <View style={styles.profileTextContainer}>
            <Text style={styles.welcome}>{getGreeting()}</Text>
            <Text style={styles.userName}>{user?.fullName || 'ولي الأمر'}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Parent Overview Dashboard Stats */}
      <Animated.View entering={FadeInRight.delay(200).duration(800)} style={styles.statsRow}>
        {students.length <= 1 && (
          <View style={[styles.statBox, cardShadow(theme), { backgroundColor: colors.surface, borderColor: theme === 'dark' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(5, 150, 105, 0.15)' }]}>
            <View style={[styles.statBoxIcon, { backgroundColor: colors.successBg }]}>
              <BookOpen size={20} color={colors.success} />
            </View>
            <View style={styles.statBoxInfo}>
              <Text style={styles.statBoxLabel}>مستهدف الحفظ اليومي</Text>
              <Text style={styles.statBoxValue}>{totalDailyTarget} صفحات</Text>
            </View>
          </View>
        )}

        <View style={[styles.statBox, cardShadow(theme), { backgroundColor: colors.surface, borderColor: theme === 'dark' ? 'rgba(96, 165, 250, 0.15)' : 'rgba(29, 78, 216, 0.15)' }]}>
          <View style={[styles.statBoxIcon, { backgroundColor: colors.primaryBg }]}>
            <Users size={20} color={colors.primary} />
          </View>
          <View style={styles.statBoxInfo}>
            <Text style={styles.statBoxLabel}>عدد الأبناء</Text>
            <Text style={styles.statBoxValue}>{students.length} أبناء</Text>
          </View>
        </View>
      </Animated.View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>متابعة الأبناء</Text>
        </View>

        {/* Students List */}
        <FlatList
          data={students}
          renderItem={renderStudent}
          keyExtractor={(item) => item._id.toString()}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.success} />
          }
          ListEmptyComponent={
            <EmptyState
              icon={<Users size={36} color={colors.textMuted} />}
              title="لم يتم ربط أي أبناء بحسابك"
              subtitle="يرجى التواصل مع إدارة الحلقة لربط أبنائك بحسابك"
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, theme: string, typography: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + 12,
    paddingBottom: spacing.md,
  },
  profileRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm + 4,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    fontSize: 20,
    fontFamily: typography.bold,
  },
  profileTextContainer: {
    alignItems: 'flex-end',
  },
  welcome: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: typography.semiBold,
    textAlign: 'right',
  },
  userName: {
    color: colors.text,
    fontSize: 20,
    fontFamily: typography.black,
    textAlign: 'right',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderRadius: radius.md,
  },
  themeBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme === 'dark' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(29, 78, 216, 0.08)',
    borderRadius: radius.md,
  },
  statsRow: {
    flexDirection: 'row-reverse',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  statBox: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: spacing.md - 2,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  statBoxIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm + 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statBoxInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  statBoxLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: typography.semiBold,
  },
  statBoxValue: {
    color: colors.text,
    fontSize: 14,
    fontFamily: typography.bold,
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontFamily: typography.bold,
    textAlign: 'right',
  },
  list: {
    paddingBottom: spacing.xl,
  },
  studentCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg - 4,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevronContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.sm + 4,
    backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentInfo: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: spacing.md,
  },
  studentName: {
    color: colors.text,
    fontSize: 18,
    fontFamily: typography.bold,
  },
  levelBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.sm,
    gap: 4,
    marginTop: 6,
  },
  studentLevel: {
    fontSize: 11,
    fontFamily: typography.bold,
  },
  swimmingBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: theme === 'dark' ? 'rgba(14, 165, 233, 0.15)' : 'rgba(14, 165, 233, 0.1)',
  },
  swimmingBadgeText: {
    fontSize: 10,
    fontFamily: typography.bold,
    color: theme === 'dark' ? '#38bdf8' : '#0ea5e9',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontFamily: typography.bold,
  },
  cardFooter: {
    flexDirection: 'row-reverse',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm + 2,
    flex: 1,
    justifyContent: 'flex-start',
  },
  statIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.semiBold,
    textAlign: 'right',
  },
  statValue: {
    color: colors.text,
    fontSize: 13,
    fontFamily: typography.bold,
    textAlign: 'right',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
});
