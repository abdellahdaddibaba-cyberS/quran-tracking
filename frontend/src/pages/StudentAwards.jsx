import { useState, useEffect } from 'react';
import { Trophy, Search, Star, Calendar, Sparkles, Award, CheckCircle2, Loader2, History } from 'lucide-react';
import toast from 'react-hot-toast';
import { reportsAPI } from '../services/api';

export default function StudentAwards() {
  const [data, setData] = useState([]);
  const [potential, setPotential] = useState([]);
  const [recentPrizes, setRecentPrizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // studentId of currently processing prize
  const [search, setSearch] = useState('');

  const fetchAwards = async () => {
    setLoading(true);
    try {
      const awardsRes = await reportsAPI.getAwardStudents();
      setData(awardsRes.data.data || []);
      setPotential(awardsRes.data.potentialWinners || []);
    } catch (err) {
      toast.error('فشل تحميل قائمة المتميزين');
    }

    try {
      const recentRes = await reportsAPI.getRecentPrizes();
      setRecentPrizes(recentRes.data.data || []);
    } catch (err) {
      console.error('Failed to load recent prizes:', err);
      // Don't show a toast for this, as it's secondary
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchAwards();
  }, []);

  const handleGivePrize = async (studentId) => {
    if (!window.confirm('هل أنت متأكد من تسليم الجائزة لهذا الطالب؟ سيتم تصفير سلسلة الإنجاز الحالية.')) {
      return;
    }

    setActionLoading(studentId);
    try {
      await reportsAPI.givePrize({ studentId });
      toast.success('تم تسليم الجائزة بنجاح');
      fetchAwards(); // Refresh lists
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل تسليم الجائزة');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = data.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.halaqa.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPotential = potential.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.halaqa.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="report-container">
      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--gold-400)' }}>
            <Trophy size={20} />
          </div>
          متابعة الجوائز والتميز
        </div>
      </div>

      <div className="alert" style={{ 
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(251, 191, 36, 0.05))', 
        border: '1px solid rgba(245, 158, 11, 0.2)',
        color: 'var(--gold-400)',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '1rem',
        borderRadius: 'var(--radius-md)'
      }}>
        <Sparkles size={18} />
        يستحق الطالب الجائزة عند إتمام حفظه المقرر بالكامل لمدة <b>3 أيام متتالية</b> (سلسلة إنجاز غير مكافأة).
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ 
            position: 'absolute', top: '50%', right: '1rem', 
            transform: 'translateY(-50%)', color: 'var(--text-muted)' 
          }} />
          <input 
            className="form-control"
            placeholder="بحث باسم الطالب أو الحلقة..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingRight: '2.8rem' }}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-wrap">
          <div className="spinner" />
          <span>جاري جلب قائمة المتميزين...</span>
        </div>
      ) : (
        <>
          {/* ─── المستحقون للجوائز (3 أيام) ─── */}
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: '1.5rem', color: 'var(--gold-400)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Trophy size={22} />
            مستحقو الجوائز (إتمام 3 أيام)
            <span className="badge badge-gold" style={{ fontSize: '0.8rem' }}>{filtered.length}</span>
          </h2>

          {filtered.length === 0 ? (
            <div className="card" style={{ marginBottom: '2.5rem' }}>
              <div className="empty-state" style={{ padding: '2rem' }}>
                <Award size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                <p style={{ color: 'var(--text-secondary)' }}>لا يوجد طلاب أتموا 3 أيام متتالية غير مكافأة حالياً.</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
              {filtered.map(s => (
                <AwardCard 
                  key={s.id} 
                  student={s} 
                  type="winner" 
                  onGive={() => handleGivePrize(s.id)}
                  isProcessing={actionLoading === s.id}
                />
              ))}
            </div>
          )}

          {/* ─── مرشحو الغد (يومان متتاليان) ─── */}
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: '1.5rem', color: 'var(--info)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={22} />
            مرشحو الغد (أتموا يومين متتاليين)
            <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--info)', fontSize: '0.8rem' }}>{filteredPotential.length}</span>
          </h2>

          {filteredPotential.length === 0 ? (
            <div className="card">
              <div className="empty-state" style={{ padding: '2rem' }}>
                <Calendar size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                <p style={{ color: 'var(--text-secondary)' }}>لا يوجد مرشحون حالياً لديهم يومان متتاليان من الإنجاز.</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {filteredPotential.map(s => (
                <AwardCard key={s.id} student={s} type="potential" />
              ))}
            </div>
          )}
          {/* ─── آخر الجوائز المسلمة ─── */}
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, marginTop: '3rem', marginBottom: '1.5rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={22} />
            آخر الجوائز التي تم تسليمها
          </h2>

          <div className="card">
            {recentPrizes.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>لا يوجد سجل جوائز حالياً.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>الطالب</th>
                      <th>الحلقة</th>
                      <th>الجائزة</th>
                      <th>التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPrizes.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 700 }}>{p.student?.name}</td>
                        <td>{p.student?.halaqa?.name}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--gold-400)' }}>
                            <Trophy size={14} />
                            {p.title}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {new Date(p.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AwardCard({ student, type, onGive, isProcessing }) {
  const isWinner = type === 'winner';
  const accentColor = isWinner ? 'var(--gold-500)' : 'var(--info)';
  const bgColor = isWinner ? 'rgba(245, 158, 11, 0.02)' : 'rgba(59, 130, 246, 0.02)';

  return (
    <div className="card" style={{ 
      borderTop: `4px solid ${accentColor}`, 
      position: 'relative',
      overflow: 'hidden',
      background: `linear-gradient(to bottom, var(--bg-card), ${bgColor})`
    }}>
      <div style={{ position: 'absolute', top: '-10px', left: '-10px', opacity: 0.1 }}>
        {isWinner ? <Trophy size={80} /> : <Award size={80} />}
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{student.name}</h3>
          <span className="badge" style={{ 
            marginTop: '0.5rem',
            background: isWinner ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
            color: accentColor
          }}>
            {student.halaqa}
          </span>
        </div>
        <div style={{ 
          background: isWinner ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)', 
          color: accentColor, 
          width: '36px', height: '36px', 
          borderRadius: '50%', 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 10px ${isWinner ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`
        }}>
          {isWinner ? <Star size={18} fill="currentColor" /> : <Award size={18} />}
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Calendar size={14} />
          سلسلة الإنجاز ({student.streakCount} أيام):
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {student.lastRecords.map((r, idx) => (
            <div key={idx} style={{ 
              flex: 1,
              background: 'rgba(34, 197, 94, 0.08)', 
              border: '1px solid rgba(34, 197, 94, 0.15)',
              borderRadius: '8px',
              padding: '0.4rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                {new Date(r.date).toLocaleDateString('ar-EG', { weekday: 'short' })}
              </div>
              <div style={{ fontWeight: 700, color: 'var(--green-400)', fontSize: '0.8rem' }}>
                {r.pages} ص
              </div>
            </div>
          ))}
          {!isWinner && (
            <div style={{ 
              flex: 1,
              background: 'rgba(255, 255, 255, 0.03)', 
              border: '1px dashed var(--border)',
              borderRadius: '8px',
              padding: '0.4rem',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.65rem',
              color: 'var(--text-muted)'
            }}>
              اليوم 3؟
            </div>
          )}
        </div>
      </div>

      <div style={{ 
        borderTop: '1px solid var(--border)', 
        paddingTop: '1rem', 
        display: 'flex', 
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        {isWinner ? (
          <button 
            className="btn btn-gold btn-sm" 
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={onGive}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            تسليم الجائزة الآن
          </button>
        ) : null}
        
        <button 
          className="btn btn-secondary btn-sm" 
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => window.location.href = `/history?studentId=${student.id}`}
        >
          عرض السجل التفصيلي
        </button>
      </div>
    </div>
  );
}
