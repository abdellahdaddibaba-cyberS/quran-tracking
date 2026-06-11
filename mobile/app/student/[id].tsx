import { useAppTheme } from '../../context/ThemeContext';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, SectionList, SafeAreaView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { mobileAPI } from '../../services/api';
import { Calendar, CheckCircle, XCircle, AlertCircle, Trophy, UserX, UserCheck, BookOpen, Activity, Waves } from 'lucide-react-native';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { LoadingView } from '../../components/ui/LoadingView';
import { spacing, radius, cardShadow } from '../../constants/layout';

export default function StudentDetailScreen() {
  const { colors, theme } = useAppTheme();
  const styles = getStyles(colors, theme);
  const { id } = useLocalSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchTracking();
  }, [id]);

  const fetchTracking = async () => {
    try {
      const res = await mobileAPI.getTracking(id as string);

      // Group records by week (starting on Saturday)
      const records = res.data.data.tracking || [];
      const groups: Record<string, any[]> = {};

      records.forEach((record: any) => {
        const d = new Date(record.date);
        const day = d.getDay(); // Sunday is 0, Saturday is 6
        const diff = day; // Distance from Sunday

        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - diff);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 5); // Sunday to Friday (6 days)

        const weekLabel = `من ${weekStart.toLocaleDateString('ar-DZ', { month: 'short', day: 'numeric' })} إلى ${weekEnd.toLocaleDateString('ar-DZ', { month: 'short', day: 'numeric' })}`;

        if (!groups[weekLabel]) groups[weekLabel] = [];
        groups[weekLabel].push(record);
      });

      const sections = Object.keys(groups).map(key => ({
        title: key,
        data: groups[key]
      }));

      setData({ ...res.data.data, sections });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingView />;
  }

  const renderItem = ({ item }: { item: any }) => {
    const isPresent = item.attendance === 'present';
    const isExcused = item.attendance === 'excused';
    const isLess = (item.pagesMemorized || 0) < (item.pagesRequired || 0) && !item.isSurahCompleted;
    return (
      <View style={styles.trackingCard}>
        <View style={styles.dateRow}>
          <Text style={styles.dateText}>
            {new Date(item.date).toLocaleDateString('ar-DZ', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          <Calendar size={16} color={colors.textMuted} />
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

        <View style={styles.statusRow}>
          <View style={[styles.badge, isPresent ? styles.badgeSuccess : styles.badgeDanger]}>
            {isPresent ? (
              <CheckCircle size={14} color={colors.success} />
            ) : (
              <XCircle size={14} color={colors.danger} />
            )}
            <Text style={[styles.badgeText, isPresent ? styles.textSuccess : styles.textDanger]}>
              {isPresent ? 'حاضر' : isExcused ? 'غياب بعذر' : 'غائب'}
            </Text>
          </View>

          {item.isSurahCompleted && (
            <View style={[styles.badge, styles.badgeGold]}>
              <CheckCircle size={14} color={colors.gold} />
              <Text style={[styles.badgeText, styles.textGold]}>تم ختم السورة</Text>
            </View>
          )}
        </View>

        {item.notes ? (
          <View style={styles.notesBox}>
            <AlertCircle size={14} color={colors.textMuted} />
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        ) : null}
      </View>
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

    // Get last 7 records for the chart
    const last7 = [...tracking].slice(0, 7).reverse();

    return (
      <View style={styles.summaryContainer}>
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { borderTopColor: colors.danger, borderTopWidth: 3 }]}>
            <UserX size={20} color={colors.danger} style={{ marginBottom: 8 }} />
            <Text style={[styles.statValue, { color: colors.danger }]}>{absences.length}</Text>
            <Text style={styles.statLabel}>أيام الغياب</Text>
          </View>
          <View style={[styles.statBox, { borderTopColor: colors.success, borderTopWidth: 3 }]}>
            <UserCheck size={20} color={colors.success} style={{ marginBottom: 8 }} />
            <Text style={styles.statValue}>{attendanceRate}%</Text>
            <Text style={styles.statLabel}>نسبة الحضور</Text>
          </View>
          <View style={[styles.statBox, { borderTopColor: colors.primary, borderTopWidth: 3 }]}>
            <BookOpen size={20} color={colors.primary} style={{ marginBottom: 8 }} />
            <Text style={[styles.statValue, { color: colors.primary }]}>{avgPages}</Text>
            <Text style={styles.statLabel}>معدل الحفظ</Text>
          </View>
        </View>

        {absences.length > 0 && (
          <View style={styles.absenceSection}>
            <View style={styles.absenceHeader}>
              <AlertCircle size={18} color={colors.danger} />
              <Text style={styles.absenceTitle}>تواريخ الغياب المسجلة:</Text>
            </View>
            <View style={styles.absenceDaysList}>
              {absences.slice(0, 5).map((r: any, i: number) => (
                <View key={i} style={styles.absenceDayItem}>
                  <Text style={styles.absenceDayText}>
                    {new Date(r.date).toLocaleDateString('ar-DZ', { day: 'numeric', month: 'long', weekday: 'short' })}
                  </Text>
                  <XCircle size={12} color={colors.danger} />
                </View>
              ))}
              {absences.length > 5 && (
                <Text style={styles.moreAbsences}>... وأيام أخرى</Text>
              )}
            </View>
          </View>
        )}

        <View style={styles.chartSection}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Activity size={18} color={colors.primary} />
            <Text style={styles.chartTitle}>نشاط آخر 7 أيام</Text>
          </View>
          <View style={styles.chartContainer}>
            {last7.map((r: any, i: number) => {
              const required = r.pagesRequired || 5;
              const memorized = r.pagesMemorized || 0;
              const progressRatio = Math.min(memorized / required, 1);
              const heightRatio = progressRatio * 50; // Max bar height 50
              const isSuccess = (memorized >= required || r.isSurahCompleted) && r.attendance === 'present';
              const isAbsent = r.attendance === 'absent';

              const barColor = isAbsent
                ? colors.textMuted
                : isSuccess
                  ? colors.success
                  : colors.danger;

              return (
                <View key={i} style={styles.chartBarWrap}>
                  <Text style={[styles.chartBarValue, { color: barColor }]}>
                    {isAbsent ? 'غ' : memorized}
                  </Text>
                  <View style={[styles.chartBarTrack, { backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
                    <View style={[styles.chartBarProgress, { height: Math.max(heightRatio, 4), backgroundColor: barColor }]} />
                  </View>
                  <Text style={styles.chartDay}>{new Date(r.date).toLocaleDateString('ar-DZ', { weekday: 'short' })}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: data?.student?.name || 'تفاصيل التحصيل', headerShown: false }} />

      <ScreenHeader
        title={data?.student?.name || 'تفاصيل التحصيل'}
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

      <SectionList
        sections={data?.sections || []}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title, data } }) => {
          // Calculate weekly stats
          const totalPages = data.reduce((sum: number, item: any) => sum + (item.pagesMemorized || 0), 0);
          const presentDays = data.filter((item: any) => item.attendance === 'present').length;

          return (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{title}</Text>
              <View style={styles.weeklyStatsContainer}>
                <View style={styles.weeklyStatBadge}>
                  <BookOpen size={12} color={colors.textSecondary} />
                  <Text style={styles.weeklyStatText}>الحفظ: {totalPages} ص</Text>
                </View>
                <View style={styles.weeklyStatBadge}>
                  <Calendar size={12} color={colors.textSecondary} />
                  <Text style={styles.weeklyStatText}>الحضور: {presentDays} أيام</Text>
                </View>
              </View>
            </View>
          );
        }}
        keyExtractor={(item) => item._id.toString()}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View>
            {renderSummary()}

            <View style={styles.header}>
              <Text style={styles.headerTitle}>سجل المتابعة الأسبوعية</Text>
              <Text style={styles.headerSubtitle}>ملخص أداء الطالب</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>لا توجد سجلات متابعة بعد</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const getStyles = (colors: any, theme: string) => StyleSheet.create({
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
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
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
    fontSize: 14,
    fontWeight: '700',
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
    fontWeight: '600',
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
    marginBottom: 16,
  },
  dateText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
  },
  mainStat: {
    alignItems: 'center',
  },
  pagesMemorized: {
    color: colors.success,
    fontSize: 32,
    fontWeight: '900',
  },
  pagesRequired: {
    color: colors.textSecondary,
    fontSize: 32,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  divider: {
    width: 1,
    height: 40,
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
    fontWeight: 'bold',
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
    fontWeight: 'bold',
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
    fontWeight: 'bold',
  },
  summaryContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow(theme as 'light' | 'dark'),
  },
  statsGrid: {
    flexDirection: 'row-reverse',
    gap: 12,
    marginBottom: 24,
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
    fontWeight: '900',
  },

  statSub: {
    color: colors.textMuted,
    fontSize: 10,
  },
  miniProgress: {
    width: '100%',
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginTop: 8,
  },
  miniProgressBar: {
    height: '100%',
    borderRadius: 2,
  },
  chartSection: {
    marginTop: 8,
  },
  chartTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'right',
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
    fontWeight: '700',
    marginBottom: 2,
  },
  chartDay: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  absenceAlert: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: colors.dangerBg,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  absenceAlertText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right',
  },
  absenceSection: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.dangerBg,
  },
  absenceHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  absenceTitle: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: 'bold',
  },
  absenceDaysList: {
    gap: 8,
  },
  absenceDayItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    padding: 8,
    borderRadius: 8,
  },
  absenceDayText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  moreAbsences: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
});
