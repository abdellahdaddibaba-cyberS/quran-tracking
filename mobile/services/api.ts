import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const DEFAULT_API = 'https://quran-tracking-api.onrender.com/api';
const DEFAULT_ROOT = 'https://quran-tracking-api.onrender.com';

const getInitialApiUrl = (): string => {
  if (__DEV__) {
    // In development mode, point to the local backend server
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      return `http://${ip}:5000/api`;
    }
    return Platform.OS === 'android' ? 'http://10.0.2.2:5000/api' : 'http://localhost:5000/api';
  }
  return (Constants.expoConfig?.extra?.apiUrl as string | undefined)?.trim() || DEFAULT_API;
};

export const API_URL = getInitialApiUrl();

const SERVER_ROOT =
  (Constants.expoConfig?.extra?.serverRoot as string | undefined)?.trim() || DEFAULT_ROOT;

const REQUEST_TIMEOUT_MS = 120000;
const WAKE_TIMEOUT_MS = 60000;

function apiRootFromBase(apiBase: string): string {
  return apiBase.replace(/\/api\/?$/, '');
}

/** دائماً نستخدم عنوان الإنتاج من app.json — لا نعتمد على تخزين محلي قديم */
export function getApiBaseUrl(): string {
  const trimmed = API_URL.trim().replace(/\/$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

export function getServerRoot(): string {
  return apiRootFromBase(getApiBaseUrl()) || SERVER_ROOT;
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.baseURL = getApiBaseUrl();
  return config;
});

function isNetworkError(error: unknown): boolean {
  const err = error as AxiosError;
  return !err.response;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestWithRetry<T>(config: AxiosRequestConfig, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await api.request<T>(config);
      return response.data;
    } catch (error) {
      lastError = error;
      if (!isNetworkError(error) || attempt === retries) throw error;
      await sleep(5000);
      await wakeServer();
    }
  }
  throw lastError;
}

async function pingUrl(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WAKE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** إيقاظ خادم Render (قد يستغرق حتى 60 ثانية عند السبات) */
export async function wakeServer(): Promise<boolean> {
  const root = getServerRoot();
  const apiBase = getApiBaseUrl();
  const targets = [`${root}/`, `${apiBase}`];

  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of targets) {
      if (await pingUrl(url)) {
        return true;
      }
    }
    if (attempt < 2) {
      await sleep(5000);
    }
  }
  return false;
}

/** فحص الاتصال (للشاشة أو التشخيص) */
export async function checkServerConnection(): Promise<boolean> {
  return wakeServer();
}

export const authAPI = {
  login: async (credentials: { username: string; password: string }) => {
    const awake = await wakeServer();
    if (!awake) {
      const err = new Error('SERVER_WAKE_FAILED') as Error & { code?: string };
      err.code = 'SERVER_WAKE_FAILED';
      throw err;
    }
    const data = await requestWithRetry<{
      success: boolean;
      data: { token: string; _id: string; username: string; fullName: string; role: string };
    }>({
      method: 'POST',
      url: '/auth/login',
      data: credentials,
    }, 3);
    return { data };
  },
  getMe: () => api.get('/auth/me'),
  updateProfile: (data: unknown) => api.put('/auth/profile', data),
  savePushToken: async (pushToken: string) => {
    const data = await requestWithRetry<{ success: boolean; message?: string }>(
      {
        method: 'POST',
        url: '/auth/save-push-token',
        data: { pushToken },
      },
      4
    );
    return { data };
  },
};

export const mobileAPI = {
  getStudents: () => api.get('/mobile/students'),
  getTracking: (studentId: string | number) => api.get(`/mobile/tracking/${studentId}`),
  getWeeklyReport: (params: { startDate: string; endDate: string; halaqaId?: string | number }) =>
    api.get('/mobile/weekly-report', { params }),
  testPush: () =>
    api.post('/mobile/test-push', undefined, {
      validateStatus: (status) => status < 600,
    }),
  submitFeedback: (data: { type: string; message: string }) => api.post('/mobile/feedback', data),
};

export default api;
