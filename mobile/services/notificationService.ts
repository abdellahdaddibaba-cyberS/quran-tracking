import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from './api';

const PUSH_TOKEN_KEY = 'expo_push_token';
export const NOTIFICATION_CHANNEL_ID = 'default';

export function isPushSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

if (isPushSupported()) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    (Constants.manifest2 as { extra?: { expoClient?: { extra?: { eas?: { projectId?: string } } } } })
      ?.extra?.expoClient?.extra?.eas?.projectId
  );
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: 'إشعارات التحصيل',
    description: 'تنبيهات متابعة تحصيل أبنائكم',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#22c55e',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
}

async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return status === 'granted';
}

/**
 * طلب صلاحية الإشعارات والحصول على رمز دفع إكسبو (Expo Push Token)
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!isPushSupported()) {
    console.log('⚠️ الإشعارات متاحة فقط على iOS و Android');
    return null;
  }

  if (!Device.isDevice) {
    console.log('⚠️ الإشعارات لا تعمل على المحاكيات — استخدم جهازاً حقيقياً');
    return null;
  }

  await ensureAndroidChannel();

  const granted = await requestNotificationPermissions();
  if (!granted) {
    console.log('⚠️ لم يتم منح صلاحية إشعارات الهاتف');
    return null;
  }

  const projectId = getProjectId();
  if (!projectId) {
    console.error('❌ معرّف مشروع EAS غير موجود — تحقق من app.json');
    return null;
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('✅ رمز إشعارات إكسبو:', token);
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    return token;
  } catch (e) {
    console.error('❌ خطأ أثناء الحصول على رمز إشعارات إكسبو:', e);
    return null;
  }
}

async function saveTokenToServer(token: string): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await authAPI.savePushToken(token);
      return true;
    } catch (error) {
      console.error(`❌ فشل حفظ رمز الإشعارات (محاولة ${attempt + 1}):`, error);
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  return false;
}

/**
 * تسجيل الإشعارات وحفظ الرمز — يُستدعى بعد كل تسجيل دخول ناجح
 */
export async function setupNotifications(): Promise<boolean> {
  try {
    const token = await registerForPushNotificationsAsync();
    if (!token) return false;

    const saved = await saveTokenToServer(token);
    if (saved) {
      console.log('✅ تم حفظ رمز الإشعارات في قاعدة البيانات');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'تم تفعيل الإشعارات ✅',
          body: 'سيصلك تنبيه عند تسجيل تحصيل ابنك في الحلقة',
          sound: true,
        },
        trigger: null,
      });
    }
    return saved;
  } catch (error) {
    console.error('❌ فشل إعداد الإشعارات:', error);
    return false;
  }
}

/**
 * إعادة مزامنة الرمز المحفوظ مع الخادم عند فتح التطبيق
 */
export async function syncPushTokenIfNeeded(): Promise<void> {
  const cached = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if (cached) {
    await saveTokenToServer(cached);
    return;
  }
  await setupNotifications();
}

export function getStudentIdFromNotification(
  response: Notifications.NotificationResponse
): string | number | null {
  const data = response.notification.request.content.data;
  const studentId = data?.studentId;
  if (studentId == null || studentId === '') return null;
  return studentId as string | number;
}
