import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// يجب أن ينتهي الرابط بـ /api (مثل الويب: /api/auth/login)
export const API_URL = 'https://quran-tracking-api.onrender.com/api';
const SERVER_ROOT = 'https://quran-tracking-api.onrender.com';

function normalizeApiBase(url: string): string {
  const trimmed = url.trim().replace(/\/$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 90000, // Render free tier: أول طلب قد يستغرق دقيقة
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // تجاوز الرابط فقط في وضع التطوير (تجنب عنوان محفوظ خاطئ في APK)
  if (__DEV__) {
    const savedUrl = await AsyncStorage.getItem('apiUrl');
    if (savedUrl && savedUrl.trim() !== '') {
      config.baseURL = normalizeApiBase(savedUrl);
    }
  }

  return config;
});

/** إيقاظ خادم Render قبل تسجيل الدخول */
export async function wakeServer(): Promise<void> {
  try {
    await axios.get(`${SERVER_ROOT}/`, { timeout: 90000 });
  } catch {
    // حتى لو فشل التحقق، قد يكون الخادم قد استيقظ
  }
}

function isNetworkError(error: unknown): boolean {
  const err = error as AxiosError;
  return !err.response;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const authAPI = {
  login: async (data: { username: string; password: string }) => {
    await wakeServer();
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await api.post('/auth/login', data);
      } catch (error) {
        lastError = error;
        if (!isNetworkError(error) || attempt === 1) throw error;
        await sleep(2500);
        await wakeServer();
      }
    }
    throw lastError;
  },
  getMe: () => api.get('/auth/me'),
  updateProfile: (data: unknown) => api.put('/auth/profile', data),
  savePushToken: (pushToken: string) => api.post('/auth/save-push-token', { pushToken }),
};

export const mobileAPI = {
  getStudents: () => api.get('/mobile/students'),
  getTracking: (studentId: string | number) => api.get(`/mobile/tracking/${studentId}`),
  getWeeklyReport: (params: { startDate: string; endDate: string; halaqaId?: string | number }) =>
    api.get('/mobile/weekly-report', { params }),
};

export default api;
