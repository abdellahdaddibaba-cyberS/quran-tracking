import { useAppTheme } from '../context/ThemeContext';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { mobileAPI } from '../services/api';
import { setupNotifications } from '../services/notificationService';
import { Users, ChevronLeft, LogOut, BookOpen, Star, Settings, Sun, Moon, Award } from 'lucide-react-native';

const LEVEL_TRANSLATIONS: { [key: string]: string } = {
  level1: 'المستوى الأول',
  level2: 'المستوى الثاني',
  level3: 'المستوى الثالث',
  level4: 'المستوى الرابع'
};

export default function HomeScreen() {
  const { colors, theme, toggleTheme } = useAppTheme();
  const styles = getStyles(colors, theme);
  const { user, loading: authLoading, logout } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    } else if (user) {
      fetchStudents();
      setupNotifications(); // تسجيل وتحديث رمز إشعارات الهاتف لولي الأمر
    }
  }, [user, authLoading]);

  const fetchStudents = async () => {
    try {
      const res = await mobileAPI.getStudents();
      setStudents(res.data.data);
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

  if (authLoading || (loading && !refreshing)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.success} />
      </View>
    );
  }


  const renderStudent = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.studentCard}
      onPress={() => router.push(`/student/${item._id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.chevronContainer}>
          <ChevronLeft size={24} color={colors.primary} />
        </View>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{item.name}</Text>
          <View style={styles.levelBadge}>
            <Award size={14} color={colors.gold} />
            <Text style={styles.studentLevel}>{LEVEL_TRANSLATIONS[item.level] || item.level}</Text>
          </View>
        </View>
        <View style={[styles.avatar, { backgroundColor: item.level === 'level1' ? colors.success : item.level === 'level2' ? colors.primary : colors.gold }]}>
          <Text style={styles.avatarText}>{item.name[0]}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.statContainer}>
          <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
            <BookOpen size={16} color={colors.success} />
          </View>
          <View>
            <Text style={styles.statLabel}>سورة البداية</Text>
            <Text style={styles.statValue}>{item.startSurah}</Text>
          </View>
        </View>
        
        <View style={styles.statDivider} />

        <View style={styles.statContainer}>
          <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
            <Star size={16} color={colors.gold} />
          </View>
          <View>
            <Text style={styles.statLabel}>القسط اليومي</Text>
            <Text style={styles.statValue}>{item.dailyTarget} صفحات</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <LogOut size={20} color={colors.danger} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsBtn}>
            <Settings size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleTheme} style={styles.themeBtn}>
            {theme === 'dark' ? <Sun size={20} color="#f59e0b" /> : <Moon size={20} color="#3b82f6" />}
          </TouchableOpacity>
        </View>
        <View>
          <Text style={styles.welcome}>مرحباً بك،</Text>
          <Text style={styles.userName}>{user?.fullName}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>قائمة الأبناء ({students.length})</Text>
        </View>


        <FlatList
          data={students}
          renderItem={renderStudent}
          keyExtractor={(item) => item._id.toString()}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.success} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Users size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>لم يتم ربط أي أبناء بحسابك بعد</Text>
            </View>
          }
        />
      </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 48,
  },
  welcome: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'right',
  },
  userName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  logoutBtn: {
    padding: 10,
    backgroundColor: colors.dangerBg,
    borderRadius: 12,
  },
  settingsBtn: {
    padding: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
  },
  themeBtn: {
    padding: 10,
    backgroundColor: theme === 'dark' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceTrans,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 20,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: colors.text,
    fontSize: 16,
    textAlign: 'right',
  },
  list: {
    paddingBottom: 24,
  },
  studentCard: {
    backgroundColor: theme === 'dark' ? 'rgba(30, 41, 59, 0.7)' : '#ffffff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: theme === 'dark' ? '#000' : colors.textMuted,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevronContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  studentInfo: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  studentName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  levelBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  studentLevel: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row-reverse',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 2,
    textAlign: 'right',
  },
  statValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  empty: {
    alignItems: 'center',
    marginTop: 100,
    gap: 16,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  themeToggleBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: 24,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.surfaceTrans,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  themeToggleLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
