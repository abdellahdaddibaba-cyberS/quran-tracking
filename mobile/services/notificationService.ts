import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, wakeServer } from './api';

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

export type NotificationSetupResult = {
  ok: boolean;
  message?: string;
};

async function saveTokenToServer(token: string): Promise<NotificationSetupResult> {
  const awake = await wakeServer();
  if (!awake) {
    return {
      ok: false,
      message: 'الخادم نائم — انتظر 30–60 ثانية ثم اضغط الزر مجدداً',
    };
  }

  let lastMessage = 'فشل حفظ رمز الإشعارات على الخادم';

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await authAPI.savePushToken(token);
      if (res?.data?.success) {
        return { ok: true };
      }
      lastMessage = res?.data?.message || lastMessage;
      console.error('❌ الخادم رفض حفظ رمز الإشعارات:', lastMessage);
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: { message?: string } };
        message?: string;
        code?: string;
      };

      if (err?.response?.status === 401) {
        return { ok: false, message: 'انتهت الجلسة — سجّل الخروج ثم الدخول مجدداً' };
      }
      if (err?.response?.status === 403) {
        return { ok: false, message: 'هذا الحساب ليس ولي أمر — الإشعارات للأولياء فقط' };
      }

      if (!err?.response) {
        lastMessage =
          err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')
            ? 'انتهت مهلة الاتصال — الخادم بطيء، حاول بعد 30 ثانية'
            : 'تعذر الاتصال بالخادم — استخدم Expo Go على الهاتف (ليس المتصفح)';
      } else {
        lastMessage = err.response.data?.message || lastMessage;
      }

      console.error(`❌ فشل حفظ رمز الإشعارات (محاولة ${attempt + 1}):`, lastMessage);
    }

    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 5000));
      await wakeServer();
    }
  }

  return { ok: false, message: lastMessage };
}

function describeTokenError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (/firebase|fcm|FirebaseApp/i.test(msg)) {
    return 'يلزم إعداد FCM في Firebase وexpo.dev ثم إعادة بناء APK (راجع التعليمات أدناه)';
  }
  if (/project/i.test(msg)) {
    return 'خطأ في إعداد مشروع Expo — أعد بناء التطبيق';
  }
  return `تعذر الحصول على رمز الإشعار: ${msg.slice(0, 100)}`;
}

/**
 * تسجيل الإشعارات وحفظ الرمز — يُستدعى بعد كل تسجيل دخول ناجح
 */
export async function setupNotifications(): Promise<NotificationSetupResult> {
  try {
    if (!isPushSupported()) {
      return { ok: false, message: 'الإشعارات متاحة فقط على تطبيق Android أو iOS' };
    }

    if (!Device.isDevice) {
      return { ok: false, message: 'الإشعارات لا تعمل على المحاكي — استخدم جهازاً حقيقياً' };
    }

    await ensureAndroidChannel();

    const granted = await requestNotificationPermissions();
    if (!granted) {
      return { ok: false, message: 'لم يتم منح صلاحية الإشعارات — فعّلها من إعدادات الهاتف' };
    }

    const projectId = getProjectId();
    if (!projectId) {
      return { ok: false, message: 'خطأ في إعداد التطبيق — أعد بناء التطبيق من Expo' };
    }

    let token: string;
    try {
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log('✅ رمز إشعارات إكسبو:', token);
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    } catch (error) {
      console.error('❌ خطأ أثناء الحصول على رمز إشعارات إكسبو:', error);
      return { ok: false, message: describeTokenError(error) };
    }

    const saved = await saveTokenToServer(token);
    if (saved.ok) {
      console.log('✅ تم حفظ رمز الإشعارات في قاعدة البيانات');
    } else {
      console.error('❌ تم الحصول على الرمز لكن فشل حفظه على الخادم:', saved.message);
    }

    return saved;
  } catch (error) {
    console.error('❌ فشل إعداد الإشعارات:', error);
    return { ok: false, message: 'حدث خطأ غير متوقع أثناء تفعيل الإشعارات' };
  }
}

/**
 * إعادة مزامنة الرمز المحفوظ مع الخادم عند فتح التطبيق
 */
export async function syncPushTokenIfNeeded(): Promise<void> {
  const cached = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if (cached) {
    const result = await saveTokenToServer(cached);
    if (result.ok) return;
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
