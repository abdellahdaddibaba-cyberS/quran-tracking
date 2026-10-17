import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { getStudentIdFromNotification, isPushSupported } from '../services/notificationService';

const HANDLED_PREFIX = 'handled_notif_';

async function navigateFromNotification(
  response: Notifications.NotificationResponse,
  router: ReturnType<typeof useRouter>
) {
  const notificationId = response.notification.request.identifier;
  const handledKey = `${HANDLED_PREFIX}${notificationId}`;

  if (await AsyncStorage.getItem(handledKey)) return;

  const studentId = getStudentIdFromNotification(response);
  if (studentId == null) return;

  await AsyncStorage.setItem(handledKey, '1');
  router.push(`/student/${studentId}`);
}

/**
 * عند النقر على إشعار التحصيل، يفتح صفحة الطالب المعني (iOS/Android فقط)
 */
export function useNotificationNavigation() {
  const router = useRouter();

  useEffect(() => {
    if (!isPushSupported()) return;

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) navigateFromNotification(response, router);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromNotification(response, router);
    });

    return () => subscription.remove();
  }, [router]);
}
