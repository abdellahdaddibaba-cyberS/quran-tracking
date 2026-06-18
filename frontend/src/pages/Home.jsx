import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, BookOpen, AlignJustify, TrendingUp, ArrowLeft, Calendar, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { halaqatAPI, studentsAPI, trackingAPI, mobileAPI, syncAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function Home({ user }) {
  const [stats, setStats] = useState({ halaqat: 0, students: 0, todayRecords: 0 });
  const [halaqat, setHalaqat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [doneHalaqat, setDoneHalaqat] = useState(new Set());
  const [myStudents, setMyStudents] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // null | 'success' | 'error'

  const handleSync = async () => {
    setSyncing(true);
    setSyncStatus(null);
    try {
      await syncAPI.runSync();
      setSyncStatus('success');
      toast.success('تمت المزامنة مع Supabase بنجاح ✅', { duration: 4000 });
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (err) {
      setSyncStatus('error');
      toast.error(err.response?.data?.message || 'فشلت المزامنة مع Supabase ❌', { duration: 5000 });
      setTimeout(() => setSyncStatus(null), 5000);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const d = new Date();
        let todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const [hRes, sRes, tRes] = await Promise.all([
          halaqatAPI.getAll(),
          studentsAPI.getAll(),
          trackingAPI.getAllRange({ startDate: todayStr, endDate: todayStr })
        ]);

        setHalaqat(hRes.data.data);

        const records = tRes.data.data || [];
        const completed = new Set();
        records.forEach(r => {
          if (r.student && r.student.halaqaId) {
            completed.add(String(r.student.halaqaId));
          }
        });
        setDoneHalaqat(completed);

        setStats({
          halaqat: hRes.data.count,
          students: sRes.data.count,
          todayRecords: records.length,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === 'parent') {
      const fetchMyStudents = async () => {
        try {
          const res = await mobileAPI.getStudents();
          setMyStudents(res.data.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
      };
      fetchMyStudents();
    } else {
      fetchData();
    }
  }, [user]);

  const today = new Date().toLocaleDateString('ar-DZ', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  if (loading) return (
    <div className="loading-wrap">
      <div className="spinner" />
      <span>جاري التحميل...</span>
    </div>
  );

  if (user?.role === 'parent') {
    return (
      <div>
        <div style={{
          background: 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(251,191,36,0.06) 100%)',
          border: '1px solid var(--border-green)',
          borderRadius: 'var(--radius-xl)',
          padding: '2rem',
          marginBottom: '2rem',
        }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            أهلاً بك، {user.fullName} 👋
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>بوابة أولياء الأمور - متابعة تحصيل الأبناء</p>
        </div>

        <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>قائمة الأبناء المسجلين</h3>

        {myStudents.length === 0 ? (
          <div className="card empty-state">
            <Users size={48} />
            <p>لا يوجد أبناء مرتبطين بحسابك حالياً. يرجى مراجعة إدارة المدرسة.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {myStudents.map(s => (
              <div key={s._id} className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{
                    width: 50, height: 50, borderRadius: '50%', background: 'var(--green-600)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '1.2rem'
                  }}>
                    {s.name[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{s.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.halaqa?.name || 'بدون حلقة'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>المستوى:</span>
                    <span style={{ fontWeight: 600 }}>{s.level}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>السورة الحالية:</span>
                    <span style={{ fontWeight: 600 }}>{s.currentSurah || s.startSurah}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>الهدف اليومي:</span>
                    <span style={{ fontWeight: 600 }}>{s.dailyTarget} صفحات</span>
                  </div>
                </div>

                <Link to={`/history?studentId=${s._id}`} className="btn btn-primary" style={{ marginTop: '1.5rem', width: '100%', justifyContent: 'center' }}>
                  عرض سجل التحصيل <ArrowLeft size={16} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(251,191,36,0.06) 100%)',
        border: '1px solid var(--border-green)',
        borderRadius: 'var(--radius-xl)',
        padding: '2rem',
        marginBottom: '2rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              مدرسة النور القرآنية 🕌
            </h2>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--green-400)', marginBottom: '0.25rem' }}>
              التربص الصيفي النصف داخلي 2026-1447
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              نظام متابعة تحصيل الطلاب للحلقات القرآنية
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem 1.25rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              color: 'var(--text-secondary)', fontSize: '0.85rem',
            }}>
              <Calendar size={16} color="var(--green-400)" />
              {today}
            </div>

            {user?.role === 'admin' && (
              <button
                id="btn-sync-supabase"
                onClick={handleSync}
                disabled={syncing}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.6rem 1.2rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none', cursor: syncing ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem',
                  background: syncStatus === 'success'
                    ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                    : syncStatus === 'error'
                    ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                    : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  color: 'white',
                  opacity: syncing ? 0.75 : 1,
                  boxShadow: '0 2px 8px rgba(59,130,246,0.3)',
                  transition: 'all 0.3s ease',
                }}
              >
                {syncing ? (
                  <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                ) : syncStatus === 'success' ? (
                  <CheckCircle size={15} />
                ) : syncStatus === 'error' ? (
                  <XCircle size={15} />
                ) : (
                  <RefreshCw size={15} />
                )}
                {syncing ? 'جاري المزامنة...' : syncStatus === 'success' ? 'تمت المزامنة ✅' : syncStatus === 'error' ? 'فشلت المزامنة ❌' : 'مزامنة مع Supabase'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card green">
          <div className="stat-icon green"><AlignJustify size={22} /></div>
          <div>
            <div className="stat-value">{stats.halaqat}</div>
            <div className="stat-label">عدد الحلقات</div>
          </div>
        </div>
        <div className="stat-card gold">
          <div className="stat-icon gold"><Users size={22} /></div>
          <div>
            <div className="stat-value">{stats.students}</div>
            <div className="stat-label">إجمالي الطلبة</div>
          </div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon blue"><BookOpen size={22} /></div>
          <div>
            <div className="stat-value">{stats.todayRecords}</div>
            <div className="stat-label">إدخالات اليوم</div>
          </div>
        </div>
        <div className="stat-card red">
          <div className="stat-icon red"><TrendingUp size={22} /></div>
          <div>
            <div className="stat-value">—</div>
            <div className="stat-label">معدل الإنجاز</div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          الإجراءات السريعة
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {[
            { label: 'إدخال يومي', path: '/daily-input', icon: '📝', desc: 'تسجيل أداء الطلبة اليوم', color: '#22c55e' },
            { label: 'إضافة طالب', path: '/students', icon: '👤', desc: 'إضافة طالب جديد للحلقة', color: '#f59e0b' },
            { label: 'الاقتراح الذكي', path: '/ai', icon: '🤖', desc: 'اقتراح تعديل القسط اليومي', color: '#3b82f6' },
            { label: 'سجل الطالب', path: '/history', icon: '📊', desc: 'عرض سجل أداء أي طالب', color: '#a855f7' },
          ].map(item => (
            <Link key={item.path} to={item.path} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ cursor: 'pointer', transition: 'var(--transition)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{item.icon}</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{item.label}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <div className="page-header">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>الحلقات النشطة</h3>
          <Link to="/halaqat" className="btn btn-secondary btn-sm">عرض الكل <ArrowLeft size={14} /></Link>
        </div>

        {halaqat.length === 0 ? (
          <div className="card empty-state">
            <AlignJustify size={48} />
            <h3>لا توجد حلقات بعد</h3>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {halaqat.map(h => (
              <div key={h._id} className="card" style={{ borderRight: '4px solid var(--green-600)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>{h.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>👤 {h.supervisor}</div>
                  </div>
                  <Link to={`/daily-input?halaqaId=${h._id}`} className={`btn btn-sm ${doneHalaqat.has(String(h._id)) ? 'btn-secondary' : 'btn-primary'}`}>
                    {doneHalaqat.has(String(h._id)) ? 'تمت ✅' : 'إدخال اليوم'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
