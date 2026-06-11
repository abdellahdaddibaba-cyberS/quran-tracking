import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home, Users, BookOpen, BarChart2,
  Brain, AlignJustify, TrendingUp, TrendingDown, Sun, Moon, UserCheck, Trophy, LogOut, History, MessageSquare, Waves, Activity
} from 'lucide-react';

const navLinks = [
  { label: 'الرئيسية', path: '/', icon: Home, roles: ['admin', 'teacher', 'parent'] },
  { label: 'الحلقات', path: '/halaqat', icon: AlignJustify, roles: ['admin', 'teacher'] },
  { label: 'الطلبة', path: '/students', icon: Users, roles: ['admin', 'teacher'] },
  { label: 'التحصيل اليومي', path: '/daily-input', icon: BookOpen, roles: ['admin', 'teacher'] },
  { label: 'تسجيل الحضور', path: '/attendance', icon: UserCheck, roles: ['admin', 'teacher'] },
  { label: 'المتخلفين عن التحصيل', path: '/low-pages', icon: TrendingDown, roles: ['admin', 'teacher'] },
  { label: 'جلسات فردية', path: '/individual-sessions', icon: UserCheck, roles: ['admin', 'teacher'] },
  { label: 'تحصيل الجوائز', path: '/awards', icon: Trophy, roles: ['admin', 'teacher'] },
  { label: 'جدول السباحة', path: '/swimming', icon: Waves, roles: ['admin', 'teacher'] },
  { label: 'سباحة الأسبوع', path: '/swimming/weekly', icon: Waves, roles: ['admin', 'teacher'] },

  { label: 'ملخص الأسبوع', path: '/weekly-report', icon: TrendingUp, roles: ['admin', 'teacher', 'parent'] },
  { label: 'سجلات الدخول', path: '/login-logs', icon: History, roles: ['admin'] },
  { label: 'الملاحظات والشكاوى', path: '/feedback', icon: MessageSquare, roles: ['admin'] },
  { label: 'تتبع دخول الأولياء', path: '/parent-access', icon: Activity, roles: ['admin'] },
  { label: 'المستخدمين وأولياء الأمور', path: '/users', icon: UserCheck, roles: ['admin'] },
  { label: 'الاقتراح الذكي', path: '/ai', icon: Brain, roles: ['admin', 'teacher'] },
];

export default function Navbar({ user, onLogout }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const userRole = user?.role || 'parent';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <aside className="sidebar">
      {/* ─── Logo ─────────────────────────────────── */}
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            backgroundColor: '#ffffff',
            padding: '4px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            flexShrink: 0
          }}>
            <img src="/logo.png" alt="Logo" style={{ width: 42, height: 42, objectFit: 'contain' }} />
          </div>
          <div style={{ lineHeight: 1.3 }}>
            <h1 style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--green-400)' }}>مدرسة النور القرآنية</h1>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>التربص الصيفي النصف داخلي</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--gold-400)', fontWeight: 700, display: 'block' }}>2026-1447</span>
          </div>
        </div>
      </div>

      {/* ─── Navigation ───────────────────────────── */}
      <nav className="sidebar-nav">
        <div className="nav-label">القائمة الرئيسية</div>

        {navLinks
          .filter(link => link.roles.includes(userRole))
          .map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}

        <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            onClick={toggleTheme}
            className="nav-item"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border)',
            }}
          >
            {theme === 'dark' ? (
              <>
                <Sun size={18} color="var(--gold-400)" />
                الوضع الصباحي
              </>
            ) : (
              <>
                <Moon size={18} color="var(--info)" />
                الوضع الليلي
              </>
            )}
          </button>

          <button
            onClick={onLogout}
            className="nav-item"
            style={{
              width: '100%',
              background: 'rgba(239, 68, 68, 0.05)',
              color: 'var(--danger)',
              border: '1px solid rgba(239, 68, 68, 0.1)',
            }}
          >
            <LogOut size={18} />
            تسجيل الخروج
          </button>
        </div>
      </nav>

      {/* ─── Footer ───────────────────────────────── */}
      <div style={{
        padding: '1rem',
        borderTop: '1px solid var(--border)',
        textAlign: 'center',
        lineHeight: 1.6
      }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>مدرسة النور القرآنية</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>التربص الصيفي 2026-1447</div>
      </div>
    </aside>
  );
}
