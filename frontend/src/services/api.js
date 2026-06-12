import axios from 'axios';

// ─── Axios Instance ───────────────────────────────────────────────
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// Interceptor for adding token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor for handling 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Halaqat API ──────────────────────────────────────────────────
export const halaqatAPI = {
  getAll:  ()         => api.get('/halaqat'),
  create:  (data)     => api.post('/halaqat', data),
  update:  (id, data) => api.put(`/halaqat/${id}`, data),
  delete:  (id)       => api.delete(`/halaqat/${id}`),
};

// ─── Students API ─────────────────────────────────────────────────
export const studentsAPI = {
  getAll:       (params)     => api.get('/students', { params }),
  getById:      (id)         => api.get(`/students/${id}`),
  create:       (data)       => api.post('/students', data),
  createBulk:   (data)       => api.post('/students/bulk', data),
  update:       (id, data)   => api.put(`/students/${id}`, data),
  delete:       (id)         => api.delete(`/students/${id}`),
  getByHalaqa:  (halaqaId)   => api.get('/students', { params: { halaqaId } }),
  getSwimming:        (date, auto) => api.get('/students/swimming', { params: { date, auto } }),
  getWeeklySwimming:  (weekStart)  => api.get('/students/swimming/weekly', { params: { weekStart } }),
  saveSwimming:       (data)       => api.post('/students/swimming', data),
};

// ─── Tracking API ─────────────────────────────────────────────────
export const trackingAPI = {
  bulkInsert:       (records)     => api.post('/tracking/bulk', { records }),
  getByStudent:     (studentId, params) => api.get(`/tracking/${studentId}`, { params }),
  getByHalaqa:      (halaqaId, params)  => api.get(`/tracking/halaqa/${halaqaId}`, { params }),
  deleteHalaqaDay:  (halaqaId, date)    => api.delete(`/tracking/halaqa/${halaqaId}`, { params: { date } }),
  getAllRange:      (params)            => api.get('/tracking/all', { params }),
};

// ─── AI API ───────────────────────────────────────────────────────
export const aiAPI = {
  getSuggestion: (studentId) => api.get(`/ai/suggest/${studentId}`),
};

// ─── Reports API ──────────────────────────────────────────────────
export const reportsAPI = {
  getLowPages: (params) => api.get('/reports/low-pages', { params }),
  getIndividualSessions: () => api.get('/reports/individual-sessions'),
  toggleSession: (data) => api.post('/reports/toggle-session', data),
  getStudentNotes: (studentId) => api.get(`/reports/student-notes/${studentId}`),
  deleteSession: (data) => api.post('/reports/delete-session', data),
  getAwardStudents: () => api.get('/reports/award-students'),
  getRecentPrizes: () => api.get('/reports/recent-prizes'),
  getImprovementAwards: (date) => api.get('/reports/improvement-awards', { params: { date } }),
  givePrize: (data) => api.post('/reports/give-prize', data),
};

// ─── Auth & Users API ─────────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  getMe: ()     => api.get('/auth/me'),
  getLogs: ()   => api.get('/auth/logs'),
};

export const usersAPI = {
  getAll: (role)      => api.get('/users', { params: { role } }),
  create: (data)      => api.post('/users', data),
  update: (id, data)  => api.put(`/users/${id}`, data),
  delete: (id)        => api.delete(`/users/${id}`),
  getFeedback: ()     => api.get('/users/feedback'),
  getParentAccessReport: () => api.get('/users/parent-access-report'),
};

export const mobileAPI = {
  getStudents: () => api.get('/mobile/students'),
  getTracking: (studentId) => api.get(`/mobile/tracking/${studentId}`),
  getWeeklyReport: (params) => api.get('/mobile/weekly-report', { params }),
};

export default api;
