import { useState, useEffect, useCallback } from 'react';
import { studentsAPI } from '../services/api';
import { Waves, ChevronLeft, ChevronRight, Users, Calendar } from 'lucide-react';

// أسماء الأيام بالعربية
const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS_AR = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
];

function getWeekStart(date) {
  // بداية الأسبوع = الأحد
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS_AR[d.getMonth()]}`;
}

function formatWeekRange(weekStart) {
  const start = new Date(weekStart);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  return `${start.getDate()} ${MONTHS_AR[start.getMonth()]} – ${end.getDate()} ${MONTHS_AR[end.getMonth()]} ${end.getFullYear()}`;
}

export default function WeeklySwimming() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [data, setData] = useState({}); // { 'YYYY-MM-DD': [student, ...] }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const totalSwimmers = Object.values(data).reduce((acc, arr) => acc + arr.length, 0);

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
              عرض طلاب السباحة مرتّبين حسب أيام الأسبوع
            </p>
          </div>
        </div>

        {/* Week Navigator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: 'var(--card)', borderRadius: 10,
          padding: '0.5rem 1rem', border: '1px solid var(--border)',
          flexWrap: 'wrap'
        }}>
          <button onClick={prevWeek} className="btn-icon" title="الأسبوع السابق"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', color: 'var(--text)' }}>
            <ChevronRight size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
            <Calendar size={15} color="#0ea5e9" />
            <span style={{ fontWeight: 600, minWidth: 220, textAlign: 'center' }}>
              {formatWeekRange(weekStart)}
            </span>
          </div>

          <button onClick={nextWeek} className="btn-icon" title="الأسبوع التالي"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', color: 'var(--text)' }}>
            <ChevronLeft size={18} />
          </button>

          <button onClick={goToThisWeek}
            style={{
              background: 'rgba(14,165,233,0.1)', color: '#0ea5e9',
              border: '1px solid rgba(14,165,233,0.25)', borderRadius: 8,
              padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600
            }}>
            هذا الأسبوع
          </button>

          {totalSwimmers > 0 && (
            <div style={{
              marginRight: 'auto', background: 'rgba(14,165,233,0.08)',
              color: '#0ea5e9', borderRadius: 20,
              padding: '2px 12px', fontSize: '0.8rem', fontWeight: 700,
              border: '1px solid rgba(14,165,233,0.2)'
            }}>
              <Users size={13} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
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
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
          gap: '1rem',
          marginTop: '1rem'
        }}>
          {Object.entries(data).map(([date, students]) => {
            const isToday = date === new Date().toISOString().split('T')[0];
            const hasStudents = students.length > 0;

            return (
              <div key={date} style={{
                background: 'var(--card)',
                borderRadius: 14,
                border: isToday
                  ? '1.5px solid rgba(14,165,233,0.5)'
                  : '1px solid var(--border)',
                overflow: 'hidden',
                boxShadow: isToday ? '0 0 0 3px rgba(14,165,233,0.08)' : undefined
              }}>
                {/* Day header */}
                <div style={{
                  padding: '0.65rem 1rem',
                  background: hasStudents
                    ? 'rgba(14,165,233,0.08)'
                    : 'rgba(255,255,255,0.02)',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <span style={{
                      fontWeight: 700, fontSize: '0.9rem',
                      color: isToday ? '#0ea5e9' : 'var(--text)'
                    }}>
                      {formatDate(date)}
                    </span>
                    {isToday && (
                      <span style={{
                        marginRight: 6, fontSize: '0.65rem',
                        background: '#0ea5e9', color: '#fff',
                        borderRadius: 4, padding: '1px 5px', fontWeight: 700
                      }}>اليوم</span>
                    )}
                  </div>
                  {hasStudents && (
                    <span style={{
                      background: 'rgba(14,165,233,0.15)', color: '#0ea5e9',
                      borderRadius: 20, padding: '1px 10px',
                      fontSize: '0.75rem', fontWeight: 700
                    }}>
                      {students.length}
                    </span>
                  )}
                </div>

                {/* Students list */}
                <div style={{ padding: '0.5rem' }}>
                  {!hasStudents ? (
                    <p style={{
                      textAlign: 'center', color: 'var(--text-muted)',
                      fontSize: '0.8rem', padding: '1rem 0', margin: 0
                    }}>
                      لا يوجد سباحون
                    </p>
                  ) : (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {students.map((st, i) => (
                        <li key={st._id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 8px', borderRadius: 8,
                          background: 'rgba(255,255,255,0.03)',
                          fontSize: '0.85rem', color: 'var(--text)'
                        }}>
                          <span style={{
                            minWidth: 20, height: 20, borderRadius: '50%',
                            background: 'rgba(14,165,233,0.15)', color: '#0ea5e9',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.7rem', fontWeight: 700
                          }}>
                            {i + 1}
                          </span>
                          <span style={{ fontWeight: 500 }}>{st.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
