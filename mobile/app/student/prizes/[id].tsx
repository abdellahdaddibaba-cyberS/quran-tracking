import { useAppTheme } from '../../../context/ThemeContext';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator, SafeAreaView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { mobileAPI } from '../../../services/api';
import { Trophy, Star, Medal, ArrowRight } from 'lucide-react-native';

export default function PrizesScreen() {
  const { colors, theme, toggleTheme } = useAppTheme();
  const styles = getStyles(colors);
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
      setData(res.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'medal': return <Medal size={32} color="#fbbf24" />;
      case 'trophy': return <Trophy size={32} color="#fbbf24" />;
      default: return <Star size={32} color="#fbbf24" />;
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  const generateAutomaticPrizes = (tracking: any[]) => {
    let automaticPrizes: any[] = [];
    let currentStreak = 0;

    // Sort tracking by date ascending to calculate streaks
    const sorted = [...(tracking || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (let i = 0; i < sorted.length; i++) {
      const record = sorted[i];
      // Only count records that have not been rewarded yet to avoid double counting
      if (record.rewarded) {
        currentStreak = 0;
        continue;
      }

      const isSuccess = (record.pagesMemorized >= record.pagesRequired || record.isSurahCompleted) && record.pagesRequired > 0;

      if (record.attendance === 'present' && isSuccess) {
        currentStreak++;

        // Award a prize for every 3 consecutive days
        if (currentStreak > 0 && currentStreak % 3 === 0) {
          automaticPrizes.push({
            id: `auto-streak-${record._id}`,
            title: `بطل المواظبة: ${currentStreak} أيام متتالية`,
            description: `ممتاز! حافظ الطالب على إتمام ورده لـ ${currentStreak} أيام متصلة.`,
            date: record.date,
            icon: 'medal'
          });
        }
      } else {
        currentStreak = 0;
      }
    }

    // Check for "Surah Completed"
    sorted.forEach(record => {
      if (record.isSurahCompleted) {
        automaticPrizes.push({
          id: `auto-surah-${record._id}`,
          title: 'إتمام سورة جديدة',
          description: 'ما شاء الله! أتم الطالب حفظ سورة كاملة بنجاح.',
          date: record.date,
          icon: 'trophy'
        });
      }
    });

    return automaticPrizes;
  };

  const manualPrizes = data?.prizes || [];
  const autoPrizes = generateAutomaticPrizes(data?.tracking || []);

  // Combine and sort descending
  const allPrizes = [...manualPrizes, ...autoPrizes].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'لوحة الشرف والجوائز', headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowRight size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>جوائز {data?.student?.name}</Text>
      </View>

      <FlatList
        data={allPrizes}
        keyExtractor={(item: any) => (item._id || item.id).toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Trophy size={64} color="#334155" />
            <Text style={styles.emptyText}>لم يحصل الطالب على جوائز بعد</Text>
            <Text style={styles.emptySubText}>شجعه على المزيد من التحصيل لنيل الجوائز!</Text>
          </View>
        }
        renderItem={({ item }: { item: any }) => (
          <View style={styles.prizeCard}>
            <View style={styles.iconContainer}>
              {getIcon(item.icon)}
            </View>
            <View style={styles.prizeDetails}>
              <Text style={styles.prizeTitle}>{item.title}</Text>
              {item.description ? <Text style={styles.prizeDescription}>{item.description}</Text> : null}
              <Text style={styles.prizeDate}>{new Date(item.date).toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
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
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceTrans,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  list: {
    padding: 20,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubText: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  prizeCard: {
    flexDirection: 'row-reverse',
    backgroundColor: colors.surfaceTrans,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.goldBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  prizeDetails: {
    flex: 1,
    alignItems: 'flex-end',
  },
  prizeTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'right',
  },
  prizeDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'right',
  },
  prizeDate: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
