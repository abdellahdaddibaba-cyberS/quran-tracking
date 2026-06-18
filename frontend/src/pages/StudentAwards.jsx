import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Search, Star, CheckCircle2, Loader2, History, Users, Award, ChevronLeft, ChevronRight, TrendingUp, Calendar, Zap, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { reportsAPI, studentsAPI, halaqatAPI, syncAPI } from '../services/api';

function getThursdayForWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 4=Thu
  const diff = (4 - day + 7) % 7;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatThursdayDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const obj = new Date(y, m - 1, d);
  return obj.toLocaleDateString('ar-DZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function StudentAwards() {
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' or 'improvement'
  const [halaqat, setHalaqat] = useState([]);
  const [students, setStudents] = useState([]);
  const [recentPrizes, setRecentPrizes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Manual Selection Tab States
  const [selected, setSelected] = useState(new Set());
  const [prizeTitle, setPrizeTitle] = useState('جائزة الانضباط');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  
  // Improvement Tab States
  const [selectedThursday, setSelectedThursday] = useState(() => getThursdayForWeek(new Date()));
  const [improvementData, setImprovementData] = useState({ winners: [] });
  const [impLoading, setImpLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Surah Performance Tab States
  const [surahAwardsData, setSurahAwardsData] = useState([]);
  const [surahLoading, setSurahLoading] = useState(false);
  const [expandedStudentId, setExpandedStudentId] = useState(null);

  const navigate = useNavigate();

  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // null | 'success' | 'error'

  const handleSync = async () => {
    setSyncing(true);
    setSyncStatus(null);
    try {
      await syncAPI.runSync();
      setSyncStatus('success');
      toast.success('تمت المزامنة مع Supabase بنجاح ✅');
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (err) {
      setSyncStatus('error');
      toast.error(err.response?.data?.message || 'فشلت المزامنة مع Supabase ❌');
      setTimeout(() => setSyncStatus(null), 5000);
    } finally {
      setSyncing(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [hRes, sRes, pRes] = await Promise.all([
        halaqatAPI.getAll(),
        studentsAPI.getAll({ isActive: true }),
        reportsAPI.getRecentPrizes()
      ]);
      setHalaqat(hRes.data.data || []);
      setStudents(sRes.data.data || []);
      setRecentPrizes(pRes.data.data || []);
    } catch (err) {
      toast.error('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const fetchImprovementData = async (date) => {
    setImpLoading(true);
    try {
      const res = await reportsAPI.getImprovementAwards(date);
      setImprovementData(res.data.data || { winners: [], ranges: {} });
    } catch (err) {
      toast.error('فشل تحميل جوائز التحسن');
    } finally {
      setImpLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'improvement') {
      fetchImprovementData(selectedThursday);
    }
  }, [selectedThursday, activeTab]);

  const fetchSurahPerformanceData = async () => {
    setSurahLoading(true);
    try {
      const res = await reportsAPI.getSurahPerformanceAwards();
      setSurahAwardsData(res.data.data || []);
    } catch (err) {
      toast.error('فشل تحميل جوائز الأداء في السورة');
    } finally {
      setSurahLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'surahPerformance') {
      fetchSurahPerformanceData();
    }
  }, [activeTab]);

  const toggleStudent = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleHalaqa = (halaqaStudents) => {
    const ids = halaqaStudents.map(s => s._id);
    const allSelected = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const handleGivePrizes = async () => {
    if (selected.size === 0) {
      toast.error('يرجى اختيار طالب واحد على الأقل');
      return;
    }
    if (!window.confirm(`هل تريد تسليم الجائزة لـ ${selected.size} طالب؟`)) return;

    setSubmitting(true);
    let successCount = 0;
    for (const studentId of selected) {
      try {
        await reportsAPI.givePrize({ studentId, prizeTitle });
        successCount++;
      } catch (err) {
        console.error(`Failed for student ${studentId}:`, err);
      }
    }
    setSubmitting(false);
    toast.success(`تم تسليم الجائزة لـ ${successCount} طالب بنجاح 🏆`);
    setSelected(new Set());
    fetchData();
  };

  const handleGiveSinglePrize = async (studentId, title = 'جائزة تحسن') => {
    setActionLoading(studentId);
    try {
      await reportsAPI.givePrize({ studentId, prizeTitle: title });
      toast.success('تم تسليم الجائزة بنجاح 🏆');
      fetchData();
      if (activeTab === 'improvement') {
        fetchImprovementData(selectedThursday);
      } else if (activeTab === 'surahPerformance') {
        fetchSurahPerformanceData();
      }
    } catch (err) {
      toast.error('فشل تسليم الجائزة');
    } finally {
      setActionLoading(null);
    }
  };

  const handleGiveBatchPrizes = async (list, title = 'جائزة تحسن') => {
    if (list.length === 0) return;
    if (!window.confirm(`هل أنت متأكد من تسليم الجائزة لـ ${list.length} طالب؟`)) return;
    setSubmitting(true);
    let successCount = 0;
    for (const student of list) {
      try {
        await reportsAPI.givePrize({ studentId: student._id, prizeTitle: title });
        successCount++;
      } catch (err) {
        console.error(err);
      }
    }
    setSubmitting(false);
    toast.success(`تم تسليم الجائزة لـ ${successCount} طالب بنجاح 🏆`);
    fetchData();
    if (activeTab === 'improvement') {
      fetchImprovementData(selectedThursday);
    } else if (activeTab === 'surahPerformance') {
      fetchSurahPerformanceData();
    }
  };

  const prevWeek = () => {
    const [y, m, d] = selectedThursday.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 7);
    setSelectedThursday(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`);
  };

  const nextWeek = () => {
    const [y, m, d] = selectedThursday.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + 7);
    setSelectedThursday(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`);
  };

  // تجميع الطلاب حسب الحلقة مع تطبيق البحث (للتبويب اليدوي)
  const groupedByHalaqa = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map();
    halaqat.forEach(h => map.set(h._id, { halaqa: h, students: [] }));

    students.forEach(st => {
      if (q && !st.name.toLowerCase().includes(q)) return;
      if (map.has(st.halaqaId)) {
        map.get(st.halaqaId).students.push(st);
      }
    });

    return [...map.values()].filter(g => g.students.length > 0);
  }, [halaqat, students, search]);

  return (
    <div className="report-container">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="page-title" style={{ margin: 0 }}>
          <div className="page-title-icon" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--gold-400)' }}>
            <Trophy size={20} />
          </div>
          لوحة الجوائز والمكافآت
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="btn btn-sm"
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
            <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
          ) : syncStatus === 'success' ? (
            <CheckCircle size={14} />
          ) : syncStatus === 'error' ? (
            <XCircle size={14} />
          ) : (
            <RefreshCw size={14} />
          )}
          {syncing ? 'جاري المزامنة...' : syncStatus === 'success' ? 'تمت المزامنة ✅' : syncStatus === 'error' ? 'فشلت المزامنة ❌' : 'مزامنة مع الجوال'}
        </button>
      </div>

      {/* ─── Navigation Tabs ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', paddingBottom: '0.2rem' }}>
        <button
          onClick={() => setActiveTab('manual')}
          style={{
            background: 'none', border: 'none',
            color: activeTab === 'manual' ? 'var(--gold-400)' : 'var(--text-muted)',
            fontWeight: 700, padding: '0.5rem 1rem', cursor: 'pointer',
            borderBottom: activeTab === 'manual' ? '2px solid var(--gold-400)' : 'none',
            fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8,
            transition: 'color 0.2s'
          }}
        >
          <Trophy size={16} />
          الجوائز العادية (اختيار يدوي)
        </button>
        <button
          onClick={() => setActiveTab('improvement')}
          style={{
            background: 'none', border: 'none',
            color: activeTab === 'improvement' ? 'var(--gold-400)' : 'var(--text-muted)',
            fontWeight: 700, padding: '0.5rem 1rem', cursor: 'pointer',
            borderBottom: activeTab === 'improvement' ? '2px solid var(--gold-400)' : 'none',
            fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8,
            transition: 'color 0.2s'
          }}
        >
          <TrendingUp size={16} />
          جائزة التحسن (تلقائي)
        </button>
        <button
          onClick={() => setActiveTab('surahPerformance')}
          style={{
            background: 'none', border: 'none',
            color: activeTab === 'surahPerformance' ? 'var(--gold-400)' : 'var(--text-muted)',
            fontWeight: 700, padding: '0.5rem 1rem', cursor: 'pointer',
            borderBottom: activeTab === 'surahPerformance' ? '2px solid var(--gold-400)' : 'none',
            fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8,
            transition: 'color 0.2s'
          }}
        >
          <Award size={16} />
          جائزة الأداء في السورة (تلقائي)
        </button>
      </div>

      {activeTab === 'manual' ? (
        <>
          {/* ─── Toolbar (Manual Selection) ─────────────────── */}
          <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label" style={{ marginBottom: '0.35rem' }}>عنوان الجائزة</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Star size={15} color="var(--gold-400)" />
                <input
                  className="form-control"
                  value={prizeTitle}
                  onChange={e => setPrizeTitle(e.target.value)}
                  placeholder="جائزة الانضباط"
                />
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label" style={{ marginBottom: '0.35rem' }}>بحث عن طالب</label>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  className="form-control"
                  placeholder="اكتب اسم الطالب..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingRight: '2.2rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <label className="form-label" style={{ marginBottom: '0.35rem', visibility: 'hidden' }}>.</label>
              <button
                className="btn btn-gold"
                onClick={handleGivePrizes}
                disabled={submitting || selected.size === 0}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 180 }}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />}
                {submitting ? 'جاري التسليم...' : `تسليم الجائزة (${selected.size})`}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading-wrap"><div className="spinner" /><span>جاري تحميل الطلاب...</span></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '3rem' }}>
              {groupedByHalaqa.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <Users size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                  <p>لا توجد نتائج مطابقة</p>
                </div>
              ) : (
                groupedByHalaqa.map(({ halaqa, students: hStudents }) => {
                  const allSelected = hStudents.every(s => selected.has(s._id));
                  const someSelected = hStudents.some(s => selected.has(s._id));
                  const selectedCount = hStudents.filter(s => selected.has(s._id)).length;

                  return (
                    <div key={halaqa._id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                      <div
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.75rem 1.25rem',
                          background: allSelected ? 'rgba(245,158,11,0.1)' : someSelected ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.02)',
                          borderBottom: '1px solid var(--border)',
                          cursor: 'pointer',
                        }}
                        onClick={() => toggleHalaqa(hStudents)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 8,
                            background: allSelected ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
                            border: allSelected ? '2px solid var(--gold-400)' : someSelected ? '2px dashed var(--gold-400)' : '2px solid var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {allSelected && <CheckCircle2 size={16} color="var(--gold-400)" />}
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '1rem' }}>{halaqa.name}</span>
                          <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.06)', padding: '1px 8px', borderRadius: 20, color: 'var(--text-muted)' }}>
                            {hStudents.length} طالب
                          </span>
                        </div>
                        {selectedCount > 0 && (
                          <span style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--gold-400)', borderRadius: 20, padding: '2px 12px', fontSize: '0.8rem', fontWeight: 700 }}>
                            ✓ {selectedCount} مختار
                          </span>
                        )}
                      </div>

                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <tbody>
                          {hStudents.map((st, i) => {
                            const isSelected = selected.has(st._id);
                            return (
                              <tr
                                key={st._id}
                                onClick={() => toggleStudent(st._id)}
                                style={{
                                  cursor: 'pointer',
                                  background: isSelected ? 'rgba(245,158,11,0.06)' : 'transparent',
                                  borderBottom: i < hStudents.length - 1 ? '1px solid var(--border)' : 'none',
                                  transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => !isSelected && (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                                onMouseLeave={e => !isSelected && (e.currentTarget.style.background = 'transparent')}
                              >
                                <td style={{ width: 48, padding: '0.65rem 1rem', textAlign: 'center' }}>
                                  <div style={{
                                    width: 22, height: 22, borderRadius: 6,
                                    border: isSelected ? '2px solid var(--gold-400)' : '2px solid var(--border)',
                                    background: isSelected ? 'var(--gold-400)' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    margin: '0 auto'
                                  }}>
                                    {isSelected && <CheckCircle2 size={13} color="#1a1a2e" strokeWidth={3} />}
                                  </div>
                                </td>
                                <td style={{ padding: '0.65rem 0.5rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--gold-400)' : 'var(--text)' }}>
                                  {isSelected ? '🏆 ' : ''}{st.name}
                                </td>
                                <td style={{ padding: '0.65rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: '2px 10px' }}
                                    onClick={e => { e.stopPropagation(); navigate(`/history?studentId=${st._id}`); }}
                                  >
                                    السجل
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      ) : activeTab === 'improvement' ? (
        <>
          {/* ─── Week Navigator (Improvement Tab) ──────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            background: 'var(--card)', borderRadius: 10,
            padding: '0.5rem 1rem', border: '1px solid var(--border)',
            marginBottom: '1.5rem', flexWrap: 'wrap'
          }}>
            <button onClick={prevWeek} className="btn-icon" title="الأسبوع السابق"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', color: 'var(--text)' }}>
              <ChevronRight size={18} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
              <Calendar size={15} color="var(--gold-400)" />
              <span style={{ fontWeight: 700, minWidth: 250, textAlign: 'center', fontSize: '0.92rem' }}>
                خميس الأسبوع: {formatThursdayDate(selectedThursday)}
              </span>
            </div>
            <button onClick={nextWeek} className="btn-icon" title="الأسبوع التالي"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', color: 'var(--text)' }}>
              <ChevronLeft size={18} />
            </button>
          </div>

          <div className="alert" style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(251, 191, 36, 0.03))',
            border: '1px solid rgba(245, 158, 11, 0.15)',
            color: 'var(--gold-400)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem',
            borderRadius: 'var(--radius-md)'
          }}>
            <Zap size={18} />
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem' }}>معيار جائزة التحسن:</p>
              <ul style={{ margin: '0.2rem 0 0 0', paddingRight: '1rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <li>قسط الطالب اليومي <b>صفحتان أو أقل</b>.</li>
                <li>في الأسبوع الماضي (السبت→الخميس) حقق <b>9 صفحات أو أكثر</b>.</li>
                <li>في هذا الأسبوع حقق <b>14 صفحة أو أكثر</b> (تحسن بـ5 صفحات على الأقل).</li>
                <li>تُقدَّم الجائزة <b>يوم الخميس</b> من كل أسبوع, بدءاً من الأسبوع الثالث.</li>
              </ul>
            </div>
          </div>

          {impLoading ? (
            <div className="loading-wrap"><div className="spinner" /><span>جاري حساب إنجازات الطلاب...</span></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '3rem' }}>
              
              {/* ─── WINNERS TABLE ───────────────────────────── */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{
                  padding: '0.85rem 1.25rem',
                  background: 'rgba(59, 130, 246, 0.08)',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Award size={18} color="var(--info)" />
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>
                      الطلاب المستحقون لجائزة التحسن
                    </span>
                    <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--info)', fontSize: '0.8rem' }}>
                      {improvementData.winners?.length || 0}
                    </span>
                  </div>
                  {improvementData.winners?.length > 0 && (
                    <button
                      className="btn btn-gold btn-sm"
                      onClick={() => handleGiveBatchPrizes(improvementData.winners, 'جائزة تحسن')}
                      disabled={submitting}
                    >
                      تسليم للجميع
                    </button>
                  )}
                </div>

                <div style={{ padding: '0.5rem' }}>
                  {!improvementData.winners || improvementData.winners.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '2rem', margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      لا يوجد مستحقون لجائزة التحسن في هذا الأسبوع.
                    </p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>اسم الطالب</th>
                          <th style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>الحلقة</th>
                          <th style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>القسط/يوم</th>
                          <th style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>الأسبوع الماضي</th>
                          <th style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>هذا الأسبوع</th>
                          <th style={{ padding: '0.5rem 1rem', textAlign: 'center', color: 'var(--green-400)' }}>التحسن</th>
                          <th style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {improvementData.winners.map(st => (
                          <tr key={st._id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{st.name}</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{st.halaqaName}</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{st.dailyTarget} ص</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>{st.prevTotal} ص</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--gold-400)', fontWeight: 700 }}>{st.currentTotal} ص</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                              <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '3px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 800 }}>
                                +{st.improvement} ص ⬆
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                              <button
                                className="btn btn-gold btn-sm"
                                onClick={() => handleGiveSinglePrize(st._id, 'جائزة تحسن')}
                                disabled={actionLoading === st._id}
                              >
                                {actionLoading === st._id ? <Loader2 size={13} className="animate-spin" /> : <Trophy size={13} />}
                                تسليم الجائزة
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>
          )}
        </>
      ) : (
        <>
          <div className="alert" style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(251, 191, 36, 0.03))',
            border: '1px solid rgba(245, 158, 11, 0.15)',
            color: 'var(--gold-400)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem',
            borderRadius: 'var(--radius-md)'
          }}>
            <Zap size={18} />
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem' }}>معيار جائزة الأداء في السورة:</p>
              <ul style={{ margin: '0.2rem 0 0 0', paddingRight: '1rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <li>حفظ سورة كاملة مع تفعيل خيار <b>"أتم السورة"</b>.</li>
                <li>كتابة ملاحظة تحتوي على <b>"ممتاز"</b> و <b>"من الوهلة الأولى"</b> (أو "أول مرة").</li>
                <li>تُمنح الجائزة للطالب عند استظهار <b>سورتين (2)</b> بهذه المواصفات.</li>
              </ul>
            </div>
          </div>

          {surahLoading ? (
            <div className="loading-wrap"><div className="spinner" /><span>جاري حساب استحقاق الطلاب لجائزة الأداء في السورة...</span></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '3rem' }}>
              
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{
                  padding: '0.85rem 1.25rem',
                  background: 'rgba(59, 130, 246, 0.08)',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Award size={18} color="var(--info)" />
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>
                      الطلاب المستحقون لجائزة الأداء في السورة
                    </span>
                    <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--info)', fontSize: '0.8rem' }}>
                      {surahAwardsData.length}
                    </span>
                  </div>
                  {surahAwardsData.length > 0 && (
                    <button
                      className="btn btn-gold btn-sm"
                      onClick={() => handleGiveBatchPrizes(surahAwardsData, 'جائزة الأداء في السورة')}
                      disabled={submitting}
                    >
                      تسليم للجميع
                    </button>
                  )}
                </div>

                <div style={{ padding: '0.5rem' }}>
                  {surahAwardsData.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '2rem', margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      لا يوجد مستحقون لجائزة الأداء في السورة حالياً.
                    </p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>اسم الطالب</th>
                          <th style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>الحلقة</th>
                          <th style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>السور الممتازة</th>
                          <th style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>الجوائز المستلمة سابقاً</th>
                          <th style={{ padding: '0.5rem 1rem', textAlign: 'center', color: 'var(--gold-400)' }}>الجوائز المستحقة المعلقة</th>
                          <th style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {surahAwardsData.map(st => (
                          <tr key={st._id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{st.name}</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{st.halaqaName}</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                                onClick={() => setExpandedStudentId(expandedStudentId === st._id ? null : st._id)}
                              >
                                {st.excellentSurahCount} سور 🔍
                              </button>
                              {expandedStudentId === st._id && (
                                <div style={{
                                  marginTop: '0.5rem',
                                  background: 'var(--bg)',
                                  padding: '0.8rem',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border)',
                                  textAlign: 'right',
                                  maxWidth: '350px',
                                  fontSize: '0.82rem',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                }}>
                                  <div style={{ fontWeight: 'bold', marginBottom: '0.25rem', color: 'var(--gold-400)' }}>السور المستظهرة بممتاز:</div>
                                  <ul style={{ margin: 0, paddingRight: '1rem', listStyleType: 'disc', color: 'var(--text-secondary)' }}>
                                    {st.matchingRecords.map((rec, rIdx) => (
                                      <li key={rIdx} style={{ marginBottom: '4px' }}>
                                        <b style={{ color: 'var(--text-primary)' }}>{rec.date}:</b> {rec.notes}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>{st.awardsGivenCount}</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--gold-400)', fontWeight: 700 }}>
                              {st.pendingAwardsCount}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                              <button
                                className="btn btn-gold btn-sm"
                                onClick={() => handleGiveSinglePrize(st._id, 'جائزة الأداء في السورة')}
                                disabled={actionLoading === st._id}
                              >
                                {actionLoading === st._id ? <Loader2 size={13} className="animate-spin" /> : <Trophy size={13} />}
                                تسليم الجائزة
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>
          )}
        </>
      )}

      {/* ─── Recent Prizes (Always shown at the bottom) ───── */}
      <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <History size={20} />
        آخر الجوائز الممنوحة
      </h2>

      <div className="card">
        {recentPrizes.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>لا يوجد سجل جوائز حالياً.</p>
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
                        <Award size={14} />
                        {p.title}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {new Date(p.date).toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
