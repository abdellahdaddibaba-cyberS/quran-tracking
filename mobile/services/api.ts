import axios, { AxiosError } from 'axios';
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

const api = axios.create({
  baseURL: API_URL,
  timeout: REQUEST_TIMEOUT_MS,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (__DEV__) {
    const savedUrl = await AsyncStorage.getItem('apiUrl');
    if (savedUrl && savedUrl.trim() !== '') {
      config.baseURL = normalizeApiBase(savedUrl);
    }
  }

  return config;
});

type ApiError = Error & {
  code?: string;
  response?: { status: number; data?: { message?: string } };
};

async function requestJson<T>(
  path: string,
  options: RequestInit & { base?: string } = {}
): Promise<{ data: T }> {
  const base = (options.base ?? API_URL).replace(/\/$/, '');
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
    });

    const text = await res.text();
    let data: T & { message?: string } = {} as T;
    try {
      data = text ? JSON.parse(text) : ({} as T);
    } catch {
      data = { message: text } as T & { message?: string };
    }

    if (!res.ok) {
      const err: ApiError = new Error(
        (data as { message?: string }).message || `HTTP ${res.status}`
      );
      err.response = { status: res.status, data: data as { message?: string } };
      throw err;
    }

    return { data };
  } catch (error: unknown) {
    const err = error as ApiError;
    if (err.name === 'AbortError') {
      const timeoutErr: ApiError = new Error('timeout');
      timeoutErr.code = 'ECONNABORTED';
      throw timeoutErr;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
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
    const res = await fetch(API_URL, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function isNetworkError(error: unknown): boolean {
  const err = error as AxiosError | ApiError;
  return !err.response;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const authAPI = {
  login: async (credentials: { username: string; password: string }) => {
    await wakeServer();
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await requestJson<{
          success: boolean;
          data: { token: string; _id: string; username: string; fullName: string; role: string };
        }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify(credentials),
        });
      } catch (error) {
        lastError = error;
        if (!isNetworkError(error) || attempt === 1) throw error;
        await sleep(3000);
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
