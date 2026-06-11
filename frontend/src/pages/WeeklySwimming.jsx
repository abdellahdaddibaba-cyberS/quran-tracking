import { useState, useEffect, useCallback } from 'react';
import { studentsAPI } from '../services/api';
import { Waves, ChevronLeft, ChevronRight, Users, Calendar } from 'lucide-react';

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().split('T')[0];
}

function formatSaturdayDate(weekStart) {
  const [y, m, d] = weekStart.split('-').map(Number);
  const startObj = new Date(y, m - 1, d);
  const endObj = new Date(startObj);
  endObj.setDate(startObj.getDate() + 6);
  return endObj.toLocaleDateString('ar-DZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function WeeklySwimming() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const fetchWeek = useCallback(async (ws) => {
    setLoading(true);
    setError(null);
    try {
      const res = await studentsAPI.getWeeklySwimming(ws);
      setData(res?.data?.data || {});
    } catch (e) {
      setError('حدث خطأ أثناء تحميل البيانات');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeek(weekStart);
  }, [weekStart, fetchWeek]);

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d.toISOString().split('T')[0]);
  };

  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d.toISOString().split('T')[0]);
  };

  const goToThisWeek = () => setWeekStart(getWeekStart(new Date()));

  // استخرج طلاب يوم السبت فقط
  const saturdayStudents = Object.entries(data)
    .filter(([date]) => {
      const [y, m, d] = date.split('-').map(Number);
      return new Date(y, m - 1, d).getDay() === 6;
    })
    .flatMap(([, students]) => students);

  const filteredStudents = search.trim()
    ? saturdayStudents.filter(st => st.name.toLowerCase().includes(search.toLowerCase()))
    : saturdayStudents;

  const totalSwimmers = saturdayStudents.length;

  return (
    <div className="page-container">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="page-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(14,165,233,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Waves size={20} color="#0ea5e9" />
          </div>
          <div>
            <h2 className="page-title" style={{ margin: 0 }}>الجدول الأسبوعي للسباحة</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              قائمة الطلبة المعنيين بالسباحة ليوم السبت
            </p>
          </div>
        </div>

        {/* Week Navigator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: 'var(--card)', borderRadius: 10,
          padding: '0.5rem 1rem', border: '1px solid var(--border)',
          flexWrap: 'wrap', width: '100%'
        }}>
          <button onClick={prevWeek} title="الأسبوع السابق"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center' }}>
            <ChevronRight size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)', flex: 1, justifyContent: 'center' }}>
            <Calendar size={15} color="#0ea5e9" />
            <span style={{ fontWeight: 700, textAlign: 'center', fontSize: '0.95rem' }}>
              {formatSaturdayDate(weekStart)}
            </span>
          </div>

          <button onClick={nextWeek} title="الأسبوع التالي"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center' }}>
            <ChevronLeft size={18} />
          </button>

          <button onClick={goToThisWeek}
            style={{
              background: 'rgba(14,165,233,0.1)', color: '#0ea5e9',
              border: '1px solid rgba(14,165,233,0.25)', borderRadius: 8,
              padding: '4px 14px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600
            }}>
            هذا الأسبوع
          </button>

          {totalSwimmers > 0 && (
            <div style={{
              background: 'rgba(14,165,233,0.08)',
              color: '#0ea5e9', borderRadius: 20,
              padding: '3px 14px', fontSize: '0.82rem', fontWeight: 700,
              border: '1px solid rgba(14,165,233,0.2)',
              display: 'flex', alignItems: 'center', gap: 5
            }}>
              <Users size={13} />
              {totalSwimmers} سباح
            </div>
          )}
        </div>
      </div>

      {/* ─── Content ─────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner" />
        </div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : totalSwimmers === 0 ? (
        <div style={{
          textAlign: 'center', color: 'var(--text-muted)',
          padding: '4rem', background: 'var(--card)',
          borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
          marginTop: '1rem'
        }}>
          <Waves size={40} style={{ opacity: 0.25, marginBottom: '1rem', display: 'block', margin: '0 auto 1rem' }} />
          <p style={{ margin: 0, fontSize: '1rem' }}>لا يوجد طلاب مسجلون للسباحة في هذا الأسبوع</p>
        </div>
      ) : (
        <div style={{ marginTop: '1rem', background: 'var(--card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          {/* Search bar */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
            <input
              type="text"
              className="form-control"
              placeholder="🔍  ابحث عن طالب..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ maxWidth: 320 }}
            />
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'rgba(14,165,233,0.08)', borderBottom: '2px solid rgba(14,165,233,0.15)' }}>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 700, color: '#0ea5e9', width: 55 }}>#</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>اسم الطالب</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 700, color: 'var(--text)', width: 140 }}>رقم الحلقة</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    لا توجد نتائج مطابقة للبحث
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st, i) => (
                  <tr
                    key={st._id}
                    style={{
                      borderBottom: i < filteredStudents.length - 1 ? '1px solid var(--border)' : 'none',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(14,165,233,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'rgba(14,165,233,0.12)', color: '#0ea5e9',
                        fontSize: '0.78rem', fontWeight: 700
                      }}>
                        {i + 1}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: 'var(--text)' }}>
                      🏊‍♂️ {st.name}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {st.halaqaId || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Footer count */}
          {filteredStudents.length > 0 && (
            <div style={{
              padding: '0.6rem 1rem',
              borderTop: '1px solid var(--border)',
              fontSize: '0.8rem', color: 'var(--text-muted)',
              display: 'flex', justifyContent: 'space-between'
            }}>
              <span>إجمالي: <strong style={{ color: '#0ea5e9' }}>{filteredStudents.length}</strong> طالب</span>
              {search && <span>نتائج البحث عن: <strong>{search}</strong></span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
