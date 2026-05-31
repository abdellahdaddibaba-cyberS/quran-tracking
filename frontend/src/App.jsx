import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Home from './pages/Home';
import HalaqaManagement from './pages/HalaqaManagement';
import Students from './pages/Students';
import DailyInput from './pages/DailyInput';
import StudentHistory from './pages/StudentHistory';
import AISuggestion from './pages/AISuggestion';
import WeeklyReport from './pages/WeeklyReport';
import Attendance from './pages/Attendance';
import LowPageReport from './pages/LowPageReport';
import IndividualSessionReport from './pages/IndividualSessionReport';
import StudentAwards from './pages/StudentAwards';
import LoginReport from './pages/LoginReport';
import Users from './pages/Users';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchUser = async () => {
    try {
      const { authAPI } = await import('./services/api');
      const res = await authAPI.getMe();
      setUser(res.data.data);
    } catch (err) {
      console.error('Failed to fetch user', err);
      localStorage.removeItem('token');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-wrap"><div className="spinner" /></div>;
  }

  if (!isAuthenticated) {
    return (
      <>
        <Login onLogin={setIsAuthenticated} />
        <Toaster position="top-center" />
      </>
    );
  }

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Navbar user={user} onLogout={() => {
          localStorage.removeItem('token');
          setIsAuthenticated(false);
          setUser(null);
        }} />
        <main className="main-content">
          <Routes>
            <Route path="/"            element={<Home user={user} />} />
            <Route path="/halaqat"     element={<HalaqaManagement />} />
            <Route path="/students"    element={<Students />} />
            <Route path="/attendance"  element={<Attendance />} />
            <Route path="/daily-input" element={<DailyInput />} />
            <Route path="/history"          element={<StudentHistory />} />
            <Route path="/weekly-report"     element={<WeeklyReport user={user} />} />
            <Route path="/low-pages"         element={<LowPageReport />} />
            <Route path="/individual-sessions" element={<IndividualSessionReport />} />
            <Route path="/awards"            element={<StudentAwards />} />
            <Route path="/login-logs"        element={<LoginReport />} />
            <Route path="/ai"               element={<AISuggestion />} />
            <Route path="/users"            element={<Users />} />
            <Route path="*"                element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#111827',
            color: '#f1f5f9',
            border: '1px solid rgba(255,255,255,0.08)',
            fontFamily: 'Tajawal, sans-serif',
            fontSize: '0.875rem',
            direction: 'rtl',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
    </BrowserRouter>
  );
}
