import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../context/AuthContext';

const PARENT_ROLE = 'parent';

/**
 * يوجّه تلقائياً: ولي أمر مسجّل → الرئيسية، غير مسجّل → تسجيل الدخول
 */
export function useAuthRedirect() {
  const { user, loading, logout } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const onLoginScreen = segments[0] === 'login';

    if (user && user.role !== PARENT_ROLE) {
      logout().then(() => router.replace('/login'));
      return;
    }

    if (!user && !onLoginScreen) {
      router.replace('/login');
    } else if (user && onLoginScreen) {
      router.replace('/');
    }
  }, [user, loading, segments, router, logout]);
}
