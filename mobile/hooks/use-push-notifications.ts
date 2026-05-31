import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { setupNotifications, syncPushTokenIfNeeded } from '../services/notificationService';

/**
 * يسجّل رمز الإشعارات عند تسجيل الدخول ويعيد المزامنة عند العودة للتطبيق
 */
export function usePushNotifications() {
  const { user, loading } = useAuth();
  const registered = useRef(false);

  useEffect(() => {
    if (loading || !user || user.role !== 'parent') return;

    const register = async () => {
      if (!registered.current) {
        await setupNotifications();
        registered.current = true;
      } else {
        await syncPushTokenIfNeeded();
      }
    };

    register();
  }, [user, loading]);

  useEffect(() => {
    if (!user || user.role !== 'parent') return;

    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        syncPushTokenIfNeeded();
      }
    };

    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, [user]);
}
