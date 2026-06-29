import { useAppTheme } from '../../context/ThemeContext';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { mobileAPI } from '../../services/api';
import { Calendar, CheckCircle, XCircle, AlertCircle, Trophy, UserX, UserCheck, BookOpen, Activity, Waves } from 'lucide-react-native';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { LoadingView } from '../../components/ui/LoadingView';
import { spacing, radius, cardShadow } from '../../constants/layout';
import { useAuth } from '../../context/AuthContext';
import { cleanStudentName } from '../../utils/name';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const ARABIC_WEEK_NAMES = [
  'الأسبوع الأول',
  'الأسبوع الثاني',
  'الأسبوع الثالث',
  'الأسبوع الرابع',
  'الأسبوع الخامس',
  'الأسبوع السادس',
  'الأسبوع السابع',
  'الأسبوع الثامن',
  'الأسبوع التاسع',
  'الأسبوع العاشر'
];

const getArabicWeekName = (weekIndexFromStart: number) => {
  if (weekIndexFromStart <= ARABIC_WEEK_NAMES.length) {
    return ARABIC_WEEK_NAMES[weekIndexFromStart - 1];
  }
  return `الأسبوع ${weekIndexFromStart}`;
};

export default function StudentDetailScreen() {
  const { colors, theme, typography } = useAppTheme();
  const styles = getStyles(colors, theme, typography);
  const { id } = useLocalSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { user } = useAuth();
  const [selectedWeekTitle, setSelectedWeekTitle] = useState<string | null>(null);

  const displayName = data?.student?.name ? cleanStudentName(data.student.name, user?.fullName || '') : '';

  useEffect(() => {
    fetchTracking();
  }, [id]);

  const fetchTracking = async () => {
    try {
      const res = await mobileAPI.getTracking(id as string);

      // Group records by week (Week 1: Sun-Thu, other weeks: Sat-Thu)
      const records = res.data.data.tracking || [];
      const groups: Record<number, { title: string; weekNumber: number; data: any[] }> = {};

      records.forEach((record: any) => {
        const dateParts = record.date.split('T')[0].split('-');
        const yVal = parseInt(dateParts[0], 10);
        const mVal = parseInt(dateParts[1], 10);
        const dVal = parseInt(dateParts[2], 10);
        const d = new Date(yVal, mVal - 1, dVal);

        const yStr = d.getFullYear();
        const mStr = String(d.getMonth() + 1).padStart(2, '0');
        const dStr = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yStr}-${mStr}-${dStr}`;

        let weekStart: Date;
        let weekEnd: Date;
        let weekNumber = 1;

        if (dateStr < '2026-06-20') {
          weekStart = new Date(2026, 5, 14);
          weekEnd = new Date(2026, 5, 18);
          weekNumber = 1;
        } else {
          const day = d.getDay();
          const diffToSat = (day + 1) % 7;
          weekStart = new Date(d);
          weekStart.setDate(d.getDate() - diffToSat);

          weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 5);

          const startW2 = new Date(2026, 5, 20); // 20 June 2026
          const wStartMid = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
          const diffTime = wStartMid.getTime() - startW2.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          weekNumber = 2 + Math.floor(diffDays / 7);
        }

        const weekLabel = `من ${weekStart.toLocaleDateString('ar-DZ', { month: 'short', day: 'numeric' })} إلى ${weekEnd.toLocaleDateString('ar-DZ', { month: 'short', day: 'numeric' })}`;

        if (!groups[weekNumber]) {
          groups[weekNumber] = {
            title: weekLabel,
            weekNumber: weekNumber,
            data: []
          };
        }
        groups[weekNumber].data.push(record);
      });

      const sections = Object.values(groups).sort((a: any, b: any) => b.weekNumber - a.weekNumber);

      setData({ ...res.data.data, sections });

      if (sections.length > 0) {
        setSelectedWeekTitle(sections[0].title);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingView />;
  }

  const renderItem = ({ item, index }: { item: any, index: number }) => {
    const isLess = (item.pagesMemorized || 0) < (item.pagesRequired || 0) && !item.isSurahCompleted;
    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(500)} style={styles.trackingCard}>
        <View style={styles.dateRow}>
          <Text style={styles.dateText}>
            {new Date(item.date).toLocaleDateString('ar-DZ', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          <Calendar size={16} color={colors.primary} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.mainStat}>
            <Text style={[styles.pagesMemorized, { color: isLess ? colors.danger : colors.success }]}>
              {item.pagesMemorized}
            </Text>
            <Text style={styles.statLabel}>صفحات منجزة</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.mainStat}>
            <Text style={styles.pagesRequired}>{item.pagesRequired}</Text>
            <Text style={styles.statLabel}>المطلوب</Text>
          </View>
        </View>

        {item.isSurahCompleted && (
          <View style={styles.statusRow}>
            <View style={[styles.badge, styles.badgeGold]}>
              <CheckCircle size={14} color={colors.gold} />
              <Text style={[styles.badgeText, styles.textGold]}>
                {item.currentSurah ? `تم ختم سورة ${item.currentSurah}` : 'تم ختم السورة'}
              </Text>
            </View>
          </View>
        )}

        {item.notes ? (
          <View style={styles.notesBox}>
            <AlertCircle size={14} color={colors.textMuted} />
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        ) : null}
      </Animated.View>
    );
  };

  const renderSummary = () => {
    const tracking = data?.tracking || [];
    const totalPages = tracking.reduce((sum: number, r: any) => sum + (r.pagesMemorized || 0), 0);
    const avgPages = tracking.length > 0 ? (totalPages / tracking.length).toFixed(1) : 0;
    const absences = tracking.filter((r: any) => r.attendance === 'absent');
    const attendanceRate = tracking.length > 0
      ? Math.round((tracking.filter((r: any) => r.attendance === 'present').length / tracking.length) * 100)
      : 0;

    return (
      <Animated.View entering={FadeInUp.duration(800)} style={styles.summaryContainer}>
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { borderTopColor: colors.danger, borderTopWidth: 3 }]}>
            <UserX size={20} color={colors.danger} style={{ marginBottom: 8 }} />
            <Text style={[styles.statValue, { color: colors.danger, fontFamily: typography.black }]}>{absences.length}</Text>
            <Text style={[styles.statLabel, { fontFamily: typography.semiBold }]}>أيام الغياب</Text>
          </View>
          <View style={[styles.statBox, { borderTopColor: colors.success, borderTopWidth: 3 }]}>
            <UserCheck size={20} color={colors.success} style={{ marginBottom: 8 }} />
            <Text style={[styles.statValue, { color: colors.success, fontFamily: typography.black }]}>{attendanceRate}%</Text>
            <Text style={[styles.statLabel, { fontFamily: typography.semiBold }]}>نسبة الحضور</Text>
          </View>
          <View style={[styles.statBox, { borderTopColor: colors.primary, borderTopWidth: 3 }]}>
            <BookOpen size={20} color={colors.primary} style={{ marginBottom: 8 }} />
            <Text style={[styles.statValue, { color: colors.primary, fontFamily: typography.black }]}>{avgPages}</Text>
            <Text style={[styles.statLabel, { fontFamily: typography.semiBold }]}>معدل الحفظ</Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  const selectedSection = (data?.sections || []).find((s: any) => s.title === selectedWeekTitle);
  const selectedWeekItems = selectedSection?.data || [];

  const totalPages = selectedWeekItems.reduce((sum: number, item: any) => sum + (item.pagesMemorized || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: displayName || 'تفاصيل التحصيل', headerShown: false }} />

      <ScreenHeader
        title={displayName || 'تفاصيل التحصيل'}
        subtitle="سجل الحفظ والحضور"
        right={
          <View style={{ flexDirection: 'row-reverse', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => router.push(`/student/prizes/${id}` as any)}
              style={styles.prizesHeaderBtn}
            >
              <Trophy size={20} color={colors.success} />
              <Text style={styles.prizesHeaderText}>الجوائز</Text>
            </TouchableOpacity>
            {data?.student?.hasSwimmingToday && (
              <View style={styles.swimmingHeaderBtn}>
                <Waves size={18} color="#0ea5e9" />
                <Text style={styles.swimmingHeaderText}>السباحة اليوم</Text>
              </View>
            )}
          </View>
        }
      />

      <FlatList
        data={selectedWeekItems}
        renderItem={renderItem}
        keyExtractor={(item) => item._id.toString()}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            {renderSummary()}

            <View style={styles.header}>
              <Text style={styles.headerTitle}>سجل المتابعة الأسبوعية</Text>
            </View>

            {/* Horizontal Tabs for Weeks */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.weekTabsContent}
              style={styles.weekTabsScroll}
            >
              {(data?.sections || []).map((section: any) => {
                const weekName = getArabicWeekName(section.weekNumber);
                const isActive = section.title === selectedWeekTitle;
                return (
                  <TouchableOpacity
                    key={section.title}
                    onPress={() => setSelectedWeekTitle(section.title)}
                    style={[
                      styles.weekTab,
                      isActive && styles.weekTabActive
                    ]}
                  >
                    <Text style={[
                      styles.weekTabText,
                      isActive && styles.weekTabTextActive
                    ]}>
                      {weekName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Selected Week Info Card */}
            {selectedWeekTitle && (
              <View style={styles.weekInfoCard}>
                <View style={styles.weekInfoLeft}>
                  <View style={styles.weekInfoLabelRow}>
                    <BookOpen size={14} color={colors.textMuted} />
                    <Text style={styles.weekInfoLbl}>مجموع الحصيلة</Text>
                  </View>
                  <View style={styles.weekInfoPagesRow}>
                    <Text style={styles.weekInfoPages}>{totalPages}</Text>
                    <Text style={styles.weekInfoUnit}>صفحة</Text>
                  </View>
                </View>

                <View style={styles.weekInfoDivider} />

                <View style={styles.weekInfoRight}>
                  <Text style={styles.weekInfoTitle}>
                    {(() => {
                      const section = (data?.sections || []).find((s: any) => s.title === selectedWeekTitle);
                      return section ? getArabicWeekName(section.weekNumber) : '';
                    })()}
                  </Text>
                  <Text style={styles.weekInfoDate}>{selectedWeekTitle}</Text>
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>لا توجد سجلات متابعة لهذا الأسبوع</Text>
          </View>
        }
      />
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
  list: {
    padding: 20,
  },
  header: {
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 22,
    fontFamily: typography.bold,
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: typography.semiBold,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontFamily: typography.black,
    textAlign: 'right',
  },
  weeklyStatsContainer: {
    flexDirection: 'row-reverse',
    gap: spacing.xs,
    alignItems: 'center',
  },
  weeklyStatBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: colors.surfaceTrans,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  weeklyStatText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: typography.bold,
  },
  trackingCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow(theme as 'light' | 'dark'),
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  dateText: {
    color: colors.text,
    fontSize: 13,
    fontFamily: typography.bold,
  },
  statsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 8,
  },
  mainStat: {
    alignItems: 'center',
  },
  pagesMemorized: {
    color: colors.success,
    fontSize: 30,
    fontFamily: typography.black,
  },
  pagesRequired: {
    color: colors.textSecondary,
    fontSize: 30,
    fontFamily: typography.black,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: typography.semiBold,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 46,
    backgroundColor: colors.border,
  },
  statusRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  badgeSuccess: {
    backgroundColor: colors.successBg,
  },
  badgeDanger: {
    backgroundColor: colors.dangerBg,
  },
  badgeGold: {
    backgroundColor: colors.goldBg,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: typography.bold,
  },
  textSuccess: { color: colors.success },
  textDanger: { color: colors.danger },
  textGold: { color: colors.gold },
  notesBox: {
    flexDirection: 'row-reverse',
    backgroundColor: colors.surfaceTrans,
    padding: 12,
    borderRadius: 8,
    gap: 8,
    alignItems: 'flex-start',
  },
  notesText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: typography.regular,
    textAlign: 'right',
    lineHeight: 18,
  },
  empty: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    fontFamily: typography.semiBold,
  },
  prizesHeaderBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.successBg,
    borderRadius: radius.md,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  prizesHeaderText: {
    color: colors.success,
    fontSize: 12,
    fontFamily: typography.bold,
  },
  swimmingHeaderBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderRadius: radius.md,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.2)',
  },
  swimmingHeaderText: {
    color: '#0ea5e9',
    fontSize: 12,
    fontFamily: typography.bold,
  },
  summaryContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow(theme as 'light' | 'dark'),
  },
  statsGrid: {
    flexDirection: 'row-reverse',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: colors.textMuted,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.surfaceTrans,
  },
  statValue: {
    color: colors.text,
    fontSize: 22,
    fontFamily: typography.black,
  },
  chartSection: {
    marginTop: 8,
  },
  chartTitle: {
    color: colors.text,
    fontSize: 15,
    fontFamily: typography.bold,
    textAlign: 'right',
  },
  weekTabsScroll: {
    marginVertical: spacing.md,
    marginHorizontal: -20,
  },
  weekTabsContent: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row-reverse',
  },
  weekTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f3f4f6',
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  weekTabText: {
    fontSize: 13,
    fontFamily: typography.semiBold,
    color: colors.textSecondary,
  },
  weekTabTextActive: {
    color: '#ffffff',
    fontFamily: typography.bold,
  },
  weekInfoCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: spacing.md,
    ...cardShadow(theme as 'light' | 'dark'),
  },
  weekInfoLeft: {
    flex: 1,
    paddingLeft: 16,
    gap: 6,
  },
  weekInfoLabelRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 2,
  },
  weekInfoPagesRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  weekInfoPages: {
    fontSize: 26,
    fontFamily: typography.black,
    color: colors.primary,
  },
  weekInfoUnit: {
    fontSize: 13,
    fontFamily: typography.semiBold,
    color: colors.textMuted,
  },
  weekInfoLbl: {
    fontSize: 11,
    fontFamily: typography.bold,
    color: colors.textMuted,
    flex: 1,
    paddingLeft: 16,
    gap: 6,
    alignItems: 'center',
  },
  weekInfoDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  weekInfoRight: {
    flex: 1,
    paddingRight: 16,
    alignItems: 'flex-end',
    gap: 4,
  },
  weekInfoTitle: {
    fontSize: 15,
    fontFamily: typography.bold,
    color: colors.text,
  },
  weekInfoDate: {
    fontSize: 11,
    fontFamily: typography.bold,
    color: colors.textMuted,
  },
  chartContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 96,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
  },
  chartBarWrap: {
    alignItems: 'center',
    gap: 4,
  },
  chartBarTrack: {
    width: 14,
    height: 50,
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarProgress: {
    width: '100%',
    borderRadius: 7,
  },
  chartBarValue: {
    fontSize: 10,
    marginBottom: 2,
  },
  chartDay: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
  },



});

