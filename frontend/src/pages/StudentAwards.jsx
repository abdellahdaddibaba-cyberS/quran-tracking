import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Search, Star, CheckCircle2, Loader2, History, Users, Award, Calendar, ChevronLeft, ChevronRight, TrendingUp, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

import { reportsAPI, studentsAPI, halaqatAPI } from '../services/api';

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

function getSaturdayStr(weekStart) {
  const [y, m, d] = weekStart.split('-').map(Number);
  const startObj = new Date(y, m - 1, d);
  const endObj = new Date(startObj);
  endObj.setDate(startObj.getDate() + 6);
  return `${endObj.getFullYear()}-${String(endObj.getMonth() + 1).padStart(2, '0')}-${String(endObj.getDate()).padStart(2, '0')}`;
}

export default function StudentAwards() {
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'improvement'
  const [halaqat, setHalaqat] = useState([]);
  const [students, setStudents] = useState([]);
  const [recentPrizes, setRecentPrizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set()); // معرّفات الطلاب المختارين في التوجيه اليدوي
  const [prizeTitle, setPrizeTitle] = useState('جائزة الانضباط');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  
  // خاص بجوائز التحسن
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [improvementData, setImprovementData] = useState({ level1: [], level2: [] });
  const [loadingImprovement, setLoadingImprovement] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const navigate = useNavigate();

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

  const fetchImprovementAwards = async (ws) => {
    setLoadingImprovement(true);
    try {
      const targetSaturday = getSaturdayStr(ws);
      const res = await reportsAPI.getImprovementAwards(targetSaturday);
      setImprovementData(res.data.data || { level1: [], level2: [] });
    } catch (err) {
      toast.error('فشل تحميل جوائز التحسن');
      console.error(err);
    } finally {
      setLoadingImprovement(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'improvement') {
      fetchImprovementAwards(weekStart);
    }
  }, [activeTab, weekStart]);

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

  const handleGiveSinglePrize = async (studentId, title) => {
    if (!window.confirm(`هل أنت متأكد من تسليم ${title} لهذا الطالب؟`)) return;
    setActionLoading(studentId);
    try {
      await reportsAPI.givePrize({ studentId, prizeTitle: title });
      toast.success('تم تسليم الجائزة بنجاح 🏆');
      fetchImprovementAwards(weekStart);
      // تحديث السجل الأخير أيضاً
      const pRes = await reportsAPI.getRecentPrizes();
      setRecentPrizes(pRes.data.data || []);
    } catch (err) {
      toast.error('فشل تسليم الجائزة');
    } finally {
      setActionLoading(null);
    }
  };

  // تجميع الطلاب حسب الحلقة مع تطبيق البحث
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

  return (
    <div className="report-container">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <div className="page-title">
          <div className="page-title-icon" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--gold-400)' }}>
            <Trophy size={20} />
          </div>
          متابعة وتسليم الجوائز والتميز
        </div>
      </div>

      {/* ─── Tabs ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('manual')}
          style={{
            background: activeTab === 'manual' ? 'rgba(245,158,11,0.15)' : 'transparent',
            color: activeTab === 'manual' ? 'var(--gold-400)' : 'var(--text-muted)',
            border: activeTab === 'manual' ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent',
            padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
            transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <Award size={16} />
          منح يدوي (المنضبطين)
        </button>
        <button
          onClick={() => setActiveTab('improvement')}
          style={{
            background: activeTab === 'improvement' ? 'rgba(14,165,233,0.15)' : 'transparent',
            color: activeTab === 'improvement' ? '#0ea5e9' : 'var(--text-muted)',
            border: activeTab === 'improvement' ? '1px solid rgba(14,165,233,0.3)' : '1px solid transparent',
            padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
            transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <TrendingUp size={16} />
          جوائز التحسن (تلقائي)
        </button>
      </div>

      {/* ─── TAB 1: MANUAL AWARD ─────────────────────────────── */}
      {activeTab === 'manual' && (
        <>
          <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Prize title */}
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

            {/* Search */}
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

            {/* Give prizes button */}
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
            <>
              {groupedByHalaqa.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <Users size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                  <p>لا توجد نتائج مطابقة</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '3rem' }}>
                  {groupedByHalaqa.map(({ halaqa, students: hStudents }) => {
                    const allSelected = hStudents.every(s => selected.has(s._id));
                    const someSelected = hStudents.some(s => selected.has(s._id));
                    const selectedCount = hStudents.filter(s => selected.has(s._id)).length;

                    return (
                      <div key={halaqa._id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        {/* Halaqa header */}
                        <div
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '0.75rem 1.25rem',
                            background: allSelected
                              ? 'rgba(245,158,11,0.1)'
                              : someSelected
                                ? 'rgba(245,158,11,0.05)'
                                : 'rgba(255,255,255,0.02)',
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
                            <span style={{
                              fontSize: '0.75rem', background: 'rgba(255,255,255,0.06)',
                              padding: '1px 8px', borderRadius: 20, color: 'var(--text-muted)'
                            }}>
                              {hStudents.length} طالب
                            </span>
                          </div>
                          {selectedCount > 0 && (
                            <span style={{
                              background: 'rgba(245,158,11,0.15)', color: 'var(--gold-400)',
                              borderRadius: 20, padding: '2px 12px', fontSize: '0.8rem', fontWeight: 700
                            }}>
                              ✓ {selectedCount} مختار
                            </span>
                          )}
                        </div>

                        {/* Students table */}
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
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ─── TAB 2: IMPROVEMENT AWARD ─────────────────────────── */}
      {activeTab === 'improvement' && (
        <>
          {/* Week Selector */}
          <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', width: '100%' }}>
              <button onClick={prevWeek} className="btn-icon" title="الأسبوع السابق"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center' }}>
                <ChevronRight size={18} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', flex: 1, justifyContent: 'center' }}>
                <Calendar size={16} color="#0ea5e9" />
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  أسبوع السبت: {formatSaturdayDate(weekStart)}
                </span>
              </div>

              <button onClick={nextWeek} className="btn-icon" title="الأسبوع التالي"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center' }}>
                <ChevronLeft size={18} />
              </button>

              <button onClick={goToThisWeek}
                style={{
                  background: 'rgba(14,165,233,0.1)', color: '#0ea5e9',
                  border: '1px solid rgba(14,165,233,0.25)', borderRadius: 8,
                  padding: '6px 16px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600
                }}>
                هذا الأسبوع
              </button>
            </div>

            {/* Explanation box */}
            <div style={{
              background: 'rgba(14, 165, 233, 0.08)',
              border: '1px solid rgba(14, 165, 233, 0.2)',
              borderRadius: 8, padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
              <Sparkles size={16} color="#0ea5e9" style={{ flexShrink: 0 }} />
              <div>
                <strong>شروط جائزة التحسن:</strong> قسط الطالب اليومي <strong>صفحتين أو أقل</strong>.
                <br />
                • <strong>المستوى 1:</strong> إنجاز <strong>9 صفحات أو أكثر</strong> خلال هذا الأسبوع.
                <br />
                • <strong>المستوى 2:</strong> إنجاز <strong>14 صفحة أو أكثر</strong> هذا الأسبوع، بشرط أن يكون قد أنجز <strong>9 صفحات أو أكثر</strong> في الأسبوع السابق (بزيادة 5 صفحات).
              </div>
            </div>
          </div>

          {loadingImprovement ? (
            <div className="loading-wrap"><div className="spinner" /><span>جاري جلب طلاب التحسن...</span></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '3rem' }}>
              
              {/* Level 2 Winners */}
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0ea5e9', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <TrendingUp size={20} />
                  مستوى 2: تحسن مضاعف (إنجاز 14 صفحة بزيادة 5 صفحات)
                  <span className="badge" style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9', fontSize: '0.78rem' }}>
                    {improvementData.level2.length}
                  </span>
                </h3>

                {improvementData.level2.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    لا يوجد مؤهلون للمستوى الثاني في هذا الأسبوع.
                  </div>
                ) : (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(14,165,233,0.06)', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>اسم الطالب</th>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>الحلقة</th>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>إنجاز الأسبوع السابق</th>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>إنجاز هذا الأسبوع</th>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>التحسن</th>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {improvementData.level2.map(row => (
                          <tr key={row.student._id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>🏆 {row.student.name}</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>{row.student.halaqa?.name || '—'}</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600 }}>{row.prevPages} صفحات</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#0ea5e9', fontWeight: 700 }}>{row.currentPages} صفحة</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--green-400)', fontWeight: 700 }}>+{row.currentPages - row.prevPages} صفحات</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                              <button
                                className="btn btn-gold btn-sm"
                                disabled={actionLoading === row.student._id}
                                onClick={() => handleGiveSinglePrize(row.student._id, row.title)}
                                style={{ padding: '4px 12px' }}
                              >
                                {actionLoading === row.student._id ? <Loader2 size={13} className="animate-spin" /> : <Trophy size={13} />}
                                تسليم الجائزة
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Level 1 Winners */}
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--gold-400)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Star size={20} />
                  مستوى 1: إنجاز 9 صفحات أو أكثر
                  <span className="badge badge-gold" style={{ fontSize: '0.78rem' }}>
                    {improvementData.level1.length}
                  </span>
                </h3>

                {improvementData.level1.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    لا يوجد مؤهلون للمستوى الأول في هذا الأسبوع.
                  </div>
                ) : (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(245,158,11,0.06)', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>اسم الطالب</th>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>الحلقة</th>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>إنجاز الأسبوع السابق</th>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>إنجاز هذا الأسبوع</th>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {improvementData.level1.map(row => (
                          <tr key={row.student._id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>⭐ {row.student.name}</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>{row.student.halaqa?.name || '—'}</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>{row.prevPages} صفحات</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--gold-400)', fontWeight: 700 }}>{row.currentPages} صفحات</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                              <button
                                className="btn btn-gold btn-sm"
                                disabled={actionLoading === row.student._id}
                                onClick={() => handleGiveSinglePrize(row.student._id, row.title)}
                                style={{ padding: '4px 12px' }}
                              >
                                {actionLoading === row.student._id ? <Loader2 size={13} className="animate-spin" /> : <Trophy size={13} />}
                                تسليم الجائزة
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}
        </>
      )}

      {/* ─── Recent prizes (Always visible at the bottom) ───── */}
      <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2rem' }}>
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
