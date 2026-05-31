import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const DEFAULT_API = 'https://quran-tracking-api.onrender.com/api';
const DEFAULT_ROOT = 'https://quran-tracking-api.onrender.com';

export const API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined)?.trim() || DEFAULT_API;
const SERVER_ROOT =
  (Constants.expoConfig?.extra?.serverRoot as string | undefined)?.trim() || DEFAULT_ROOT;

const REQUEST_TIMEOUT_MS = 120000;

function normalizeApiBase(url: string): string {
  const trimmed = url.trim().replace(/\/$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

async function resolveBaseUrl(): Promise<string> {
  if (__DEV__) {
    const savedUrl = await AsyncStorage.getItem('apiUrl');
    if (savedUrl?.trim()) {
      return normalizeApiBase(savedUrl);
    }
  }
  return API_URL;
}

const api = axios.create({
  baseURL: API_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.baseURL = await resolveBaseUrl();
  return config;
});

function isNetworkError(error: unknown): boolean {
  const err = error as AxiosError;
  return !err.response;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestWithRetry<T>(config: AxiosRequestConfig, retries = 1): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await api.request<T>(config);
      return response.data;
    } catch (error) {
      lastError = error;
      if (!isNetworkError(error) || attempt === retries) throw error;
      await sleep(3000);
      await wakeServer();
    }
  }
  throw lastError;
}

/** إيقاظ خادم Render قبل تسجيل الدخول */
export async function wakeServer(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${SERVER_ROOT}/`, { signal: controller.signal });
      return res.ok;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

/** فحص الاتصال (للشاشة أو التشخيص) */
export async function checkServerConnection(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const base = await resolveBaseUrl();
    const res = await fetch(base, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export const authAPI = {
  login: async (credentials: { username: string; password: string }) => {
    await wakeServer();
    const data = await requestWithRetry<{
      success: boolean;
      data: { token: string; _id: string; username: string; fullName: string; role: string };
    }>({
      method: 'POST',
      url: '/auth/login',
      data: credentials,
    });
    return { data };
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
  testPush: () => api.post('/mobile/test-push'),
};

export default api;
