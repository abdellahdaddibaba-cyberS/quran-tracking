import { useAppTheme } from '../../../context/ThemeContext';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, SafeAreaView } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { mobileAPI } from '../../../services/api';
import { Trophy, Star, Medal, Crown } from 'lucide-react-native';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { LoadingView } from '../../../components/ui/LoadingView';
import { EmptyState } from '../../../components/ui/EmptyState';
import { spacing, radius, cardShadow } from '../../../constants/layout';
import { useAuth } from '../../../context/AuthContext';
import { cleanStudentName } from '../../../utils/name';

export default function PrizesScreen() {
  const { colors, theme } = useAppTheme();
  const styles = getStyles(colors, theme);
  const { id } = useLocalSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const displayName = data?.student?.name ? cleanStudentName(data.student.name, user?.fullName || '') : '';

  useEffect(() => {
    fetchTracking();
  }, [id]);

  const fetchTracking = async () => {
    try {
      const res = await mobileAPI.getTracking(id as string);
      setData(res.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'medal':
        return <Medal size={28} color={colors.gold} />;
      case 'trophy':
        return <Trophy size={28} color={colors.gold} />;
      case 'crown':
        return <Crown size={28} color={colors.gold} />;
      default:
        return <Star size={28} color={colors.gold} />;
    }
  };

  if (loading) {
    return <LoadingView />;
  }

  const generateAutomaticPrizes = (tracking: any[]) => {
    const automaticPrizes: any[] = [];
    let currentStreak = 0;
    const sorted = [...(tracking || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (let i = 0; i < sorted.length; i++) {
      const record = sorted[i];
      if (record.rewarded) {
        currentStreak = 0;
        continue;
      }
      const isSuccess =
        (record.pagesMemorized >= record.pagesRequired || record.isSurahCompleted) && record.pagesRequired > 0;
      if (record.attendance === 'present' && isSuccess) {
        currentStreak += 1;
        if (currentStreak > 0 && currentStreak % 3 === 0) {
          automaticPrizes.push({
            id: `auto-streak-${record._id}`,
            title: `بطل المواظبة: ${currentStreak} أيام متتالية`,
            description: `حافظ الطالب على إتمام ورده لـ ${currentStreak} أيام متصلة.`,
            date: record.date,
            icon: 'medal',
          });
        }
      } else {
        currentStreak = 0;
      }
    }

    sorted.forEach((record) => {
      if (record.isSurahCompleted) {
        automaticPrizes.push({
          id: `auto-surah-${record._id}`,
          title: 'إتمام سورة جديدة',
          description: 'أتم الطالب حفظ سورة كاملة بنجاح.',
          date: record.date,
          icon: 'trophy',
        });
      }
    });

    return automaticPrizes;
  };

  const allPrizes = [...(data?.prizes || []), ...generateAutomaticPrizes(data?.tracking || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'الجوائز', headerShown: false }} />

      <ScreenHeader title={`جوائز ${displayName}`} subtitle="إنجازات التحصيل والمواظبة" />

      <FlatList
        data={allPrizes}
        keyExtractor={(item: any) => (item._id || item.id).toString()}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon={<Trophy size={40} color={colors.gold} />}
            title="لم يحصل الطالب على جوائز بعد"
            subtitle="شجّعه على المواظبة والحفظ لنيل الجوائز القادمة"
          />
        }
        renderItem={({ item }: { item: any }) => (
          <View style={styles.prizeCard}>
            <View style={styles.iconContainer}>{getIcon(item.icon)}</View>
            <View style={styles.prizeDetails}>
              <Text style={styles.prizeTitle}>{item.title}</Text>
              {item.description ? <Text style={styles.prizeDescription}>{item.description}</Text> : null}
              <Text style={styles.prizeDate}>
                {new Date(item.date).toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' })}
              </Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const getStyles = (colors: ReturnType<typeof import('../../../context/ThemeContext').useAppTheme>['colors'], theme: string) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    list: {
      padding: spacing.lg,
      paddingBottom: spacing.xl,
    },
    prizeCard: {
      flexDirection: 'row-reverse',
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      ...cardShadow(theme as 'light' | 'dark'),
    },
    iconContainer: {
      width: 56,
      height: 56,
      borderRadius: radius.full,
      backgroundColor: colors.goldBg,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    prizeDetails: {
      flex: 1,
      alignItems: 'flex-end',
    },
    prizeTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
      marginBottom: 4,
      textAlign: 'right',
    },
    prizeDescription: {
      color: colors.textSecondary,
      fontSize: 14,
      marginBottom: 8,
      textAlign: 'right',
      lineHeight: 22,
    },
    prizeDate: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
  });
