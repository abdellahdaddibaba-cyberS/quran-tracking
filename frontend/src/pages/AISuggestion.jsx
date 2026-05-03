import { useState, useEffect } from 'react';
import { Brain, TrendingUp, TrendingDown, Minus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { studentsAPI, aiAPI } from '../services/api';

const STATUS_CONFIG = {
  increase: {
    icon: <TrendingUp size={28} />,
    label: 'يُقترح رفع القسط',
    color: 'var(--green-400)',
    bg: 'rgba(34,197,94,0.1)',
    border: 'rgba(34,197,94,0.3)',
    emoji: '🚀',
  },
  decrease: {
    icon: <TrendingDown size={28} />,
    label: 'يُقترح تخفيض القسط',
    color: 'var(--danger)',
    bg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.3)',
    emoji: '📉',
  },
  keep: {
    icon: <Minus size={28} />,
    label: 'إبقاء القسط الحالي',
    color: 'var(--gold-400)',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.3)',
    emoji: '👍',
  },
  no_data: {
    icon: <Brain size={28} />,
    label: 'بيانات غير كافية',
    color: 'var(--text-secondary)',
    bg: 'rgba(148,163,184,0.1)',
    border: 'rgba(148,163,184,0.3)',
    emoji: '📋',
  },
};

export default function AISuggestion() {
  const [students,    setStudents]    = useState([]);
  const [selected,    setSelected]    = useState('');
  const [suggestion,  setSuggestion]  = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [fetchLoading,setFetchLoading]= useState(false);
  const [search,      setSearch]      = useState('');

  useEffect(() => {
    setFetchLoading(true);
    studentsAPI.getAll()
      .then(r => setStudents(r.data.data))
      .catch(() => toast.error('فشل تحميل الطلبة'))
      .finally(() => setFetchLoading(false));
  }, []);

  const handleAnalyze = async () => {
    if (!selected) { toast.error('اختر طالباً أولاً'); return; }
    setLoading(true);
    setSuggestion(null);
    try {
      const res = await aiAPI.getSuggestion(selected);
      setSuggestion(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل التحليل');
    } finally {
      setLoading(false);
    }
  };

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const cfg = suggestion ? (STATUS_CONFIG[suggestion.status] || STATUS_CONFIG.no_data) : null;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon"><Brain size={20} /></div>
          الاقتراح الذكي للقسط
        </div>
      </div>

      {/* ─── Info Banner ─────────────────────────────────────── */}
      <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
        <Brain size={18} />
        يحلل النظام آخر 7 أيام لكل طالب ويقترح تعديل القسط بناءً على معدل الأداء — لن يتم تطبيق أي تغيير تلقائياً.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* ─── Student Picker ───────────────────────────────── */}
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            اختر الطالب
          </div>
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <Search size={15} style={{
              position: 'absolute', top: '50%', right: '0.7rem',
              transform: 'translateY(-50%)', color: 'var(--text-muted)',
            }} />
            <input
              className="form-control"
              placeholder="بحث..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingRight: '2.1rem', fontSize: '0.82rem' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: 400, overflowY: 'auto' }}>
            {fetchLoading ? (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto' }} />
              </div>
            ) : filtered.map(s => (
              <button
                key={s._id}
                onClick={() => { setSelected(s._id); setSuggestion(null); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.6rem 0.875rem',
                  borderRadius: 'var(--radius-sm)',
                  background: selected === s._id ? 'rgba(34,197,94,0.15)' : 'transparent',
                  border: selected === s._id ? '1px solid var(--border-green)' : '1px solid transparent',
                  color: selected === s._id ? 'var(--green-400)' : 'var(--text-primary)',
                  fontFamily: 'Cairo, sans-serif', fontWeight: 500, fontSize: '0.875rem',
                  cursor: 'pointer', textAlign: 'right', transition: 'var(--transition)',
                }}
              >
                <span>{s.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.dailyTarget} ص</span>
              </button>
            ))}
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }}
            onClick={handleAnalyze}
            disabled={!selected || loading}
          >
            <Brain size={16} />
            {loading ? 'جاري التحليل...' : 'تحليل الأداء'}
          </button>
        </div>

        {/* ─── Result Panel ─────────────────────────────────── */}
        <div>
          {loading ? (
            <div className="loading-wrap">
              <div className="spinner" />
              <span>جاري تحليل بيانات الطالب...</span>
            </div>
          ) : !suggestion ? (
            <div className="card">
              <div className="empty-state">
                <Brain size={56} />
                <h3>اختر طالباً وابدأ التحليل</h3>
                <p>سيحلل النظام آخر 7 أيام ويعطيك اقتراحاً بشأن القسط اليومي</p>
              </div>
            </div>
          ) : (
            <>
              {/* ─── Status Card ─────────────────────── */}
              <div style={{
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                borderRadius: 'var(--radius-xl)',
                padding: '2rem',
                marginBottom: '1.5rem',
                display: 'flex', alignItems: 'center', gap: '1.5rem',
              }}>
                <div style={{
                  width: 72, height: 72,
                  background: cfg.bg,
                  border: `2px solid ${cfg.border}`,
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: cfg.color, flexShrink: 0,
                  fontSize: '2rem',
                }}>
                  {cfg.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    الطالب: {suggestion.studentName}
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: cfg.color, marginBottom: '0.5rem' }}>
                    {cfg.label}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    {suggestion.recommendation}
                  </div>
                </div>
              </div>

              {/* ─── Metrics ─────────────────────────── */}
              <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="stat-card green">
                  <div className="stat-icon green">📖</div>
                  <div>
                    <div className="stat-value">{suggestion.currentTarget}</div>
                    <div className="stat-label">القسط الحالي (صفحات)</div>
                  </div>
                </div>
                <div className="stat-card gold">
                  <div className="stat-icon gold">🎯</div>
                  <div>
                    <div className="stat-value" style={{ color: cfg.color }}>
                      {suggestion.suggestedTarget}
                    </div>
                    <div className="stat-label">القسط المقترح</div>
                  </div>
                </div>
                <div className="stat-card blue">
                  <div className="stat-icon blue">📅</div>
                  <div>
                    <div className="stat-value">{suggestion.totalDays}</div>
                    <div className="stat-label">أيام محللة</div>
                  </div>
                </div>
                <div className="stat-card red">
                  <div className="stat-icon red">✅</div>
                  <div>
                    <div className="stat-value">
                      {suggestion.successRate !== null ? `${suggestion.successRate}%` : '—'}
                    </div>
                    <div className="stat-label">معدل الإنجاز</div>
                  </div>
                </div>
              </div>

              {/* ─── Progress Bar ─────────────────────── */}
              {suggestion.successRate !== null && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      معدل إنجاز القسط (آخر {suggestion.totalDays} أيام)
                    </span>
                    <span style={{ color: cfg.color, fontWeight: 800 }}>
                      {suggestion.successDays}/{suggestion.totalDays} يوم
                    </span>
                  </div>
                  <div className="progress-bar-wrap" style={{ height: 10 }}>
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${suggestion.successRate}%`,
                        background: suggestion.successRate >= 80
                          ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                          : suggestion.successRate >= 50
                            ? 'linear-gradient(90deg, #d97706, #f59e0b)'
                            : 'linear-gradient(90deg, #dc2626, #ef4444)',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>0%</span>
                    <span style={{ color: '#f59e0b' }}>50% (حد التخفيض)</span>
                    <span style={{ color: '#22c55e' }}>80% (حد الرفع)</span>
                    <span>100%</span>
                  </div>
                </div>
              )}

              {/* ─── Last Records ─────────────────────── */}
              {suggestion.lastRecords?.length > 0 && (
                <div className="card">
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
                    آخر {suggestion.lastRecords.length} أيام
                  </div>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>التاريخ</th>
                          <th style={{ textAlign: 'center' }}>المطلوب</th>
                          <th style={{ textAlign: 'center' }}>المستظهر</th>
                          <th style={{ textAlign: 'center' }}>النتيجة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suggestion.lastRecords.map((r, i) => (
                          <tr key={i}>
                            <td style={{ color: 'var(--text-secondary)' }}>
                              {new Date(r.date).toLocaleDateString('en-GB', {
                                weekday: 'short', month: 'short', day: 'numeric',
                              })}
                            </td>
                            <td style={{ textAlign: 'center' }}>{r.required}</td>
                            <td style={{
                              textAlign: 'center', fontWeight: 700,
                              color: r.success ? 'var(--green-400)' : 'var(--danger)',
                            }}>
                              {r.memorized}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {r.success
                                ? <span className="badge badge-green">✅ نجح</span>
                                : <span className="badge badge-red">❌ لم يكتمل</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
