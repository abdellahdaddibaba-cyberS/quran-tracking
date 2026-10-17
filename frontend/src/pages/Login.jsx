import { useState } from 'react';
import { LogIn, Lock, User, ShieldCheck, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await axios.post('/api/auth/login', {
        username,
        password
      });

      if (res.data.success) {
        localStorage.setItem('token', res.data.data.token);
        onLogin(true);
        toast.success('تم تسجيل الدخول بنجاح! مرحباً بك', {
          icon: '👋',
          style: {
            borderRadius: '10px',
            background: '#333',
            color: '#fff',
          },
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'اسم المستخدم أو كلمة المرور غير صحيحة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top right, #1e293b, #0f172a)',
      padding: '1.5rem',
      fontFamily: 'Tajawal, sans-serif'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '2.5rem',
        borderRadius: '24px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(10px)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative elements */}
        <div style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '150px',
          height: '150px',
          background: 'rgba(34, 197, 94, 0.1)',
          borderRadius: '50%',
          filter: 'blur(40px)'
        }} />

        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <img 
            src="/logo.png" 
            alt="Logo" 
            style={{ 
              width: '80px', 
              height: '80px', 
              margin: '0 auto 1.5rem',
              objectFit: 'contain'
            }} 
          />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white', marginBottom: '0.5rem' }}>
            نظام متابعة التحصيل
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <Sparkles size={14} color="var(--gold-400)" />
            سجل الدخول للإدارة والتحكم
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>اسم المستخدم</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                placeholder="أدخل اسم المستخدم"
                value={username}
                onChange={e => setUsername(e.target.value)}
                style={{ paddingRight: '2.8rem', background: 'rgba(255,255,255,0.03)', height: '50px' }}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>كلمة المرور</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ paddingRight: '2.8rem', background: 'rgba(255,255,255,0.03)', height: '50px' }}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ 
              height: '50px', 
              fontSize: '1rem', 
              marginTop: '1rem',
              justifyContent: 'center',
              boxShadow: '0 10px 20px rgba(34, 197, 94, 0.2)'
            }}
          >
            {loading ? (
              <div className="spinner" style={{ width: '20px', height: '20px', borderTopColor: 'white' }} />
            ) : (
              <>
                <LogIn size={20} />
                دخول للنظام
              </>
            )}
          </button>
        </form>

        <div style={{ 
          marginTop: '2rem', 
          textAlign: 'center', 
          fontSize: '0.75rem', 
          color: 'var(--text-muted)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          paddingTop: '1.5rem'
        }}>
          جميع الحقوق محفوظة &copy; {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
