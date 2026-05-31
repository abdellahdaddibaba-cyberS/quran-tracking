import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// الرابط الافتراضي للخادم السحابي
const API_URL = 'https://quran-tracking-api.onrender.com/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Ensure the correct base URL is loaded from storage dynamically
  const savedUrl = await AsyncStorage.getItem('apiUrl');
  if (savedUrl && savedUrl.trim() !== '') {
    config.baseURL = savedUrl;
  }

  return config;
});

export const authAPI = {
  login: (data: any) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data: any) => api.put('/auth/profile', data),
  savePushToken: (pushToken: string) => api.post('/auth/save-push-token', { pushToken }),
};

export const mobileAPI = {
  getStudents: () => api.get('/mobile/students'),
  getTracking: (studentId: string | number) => api.get(`/mobile/tracking/${studentId}`),
};

export default api;
