import { useState, useEffect } from 'react';
import { Brain, TrendingUp, TrendingDown, Minus, Search, Users, Sparkles, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { studentsAPI, aiAPI, halaqatAPI } from '../services/api';

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
  const [activeTab, setActiveTab] = useState('student'); // 'student' | 'halaqa'
  
  // Student States
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [studentSuggestion, setStudentSuggestion] = useState(null);
  
  // Halaqa States
  const [halaqat, setHalaqat] = useState([]);
  const [selectedHalaqa, setSelectedHalaqa] = useState('');
  const [halaqaSuggestion, setHalaqaSuggestion] = useState(null);
  const [expandedStudents, setExpandedStudents] = useState({});

  // Loading & Filter States
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [halaqatLoading, setHalaqatLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setFetchLoading(true);
    studentsAPI.getAll()
      .then(r => setStudents(r.data.data))
      .catch(() => toast.error('فشل تحميل الطلبة'))
      .finally(() => setFetchLoading(false));

    setHalaqatLoading(true);
    halaqatAPI.getAll()
      .then(r => setHalaqat(r.data.data))
      .catch(() => toast.error('فشل تحميل الحلقات'))
      .finally(() => setHalaqatLoading(false));
  }, []);

  const handleAnalyzeStudent = async () => {
    if (!selectedStudent) { toast.error('اختر طالباً أولاً'); return; }
    setLoading(true);
    setStudentSuggestion(null);
    try {
      const res = await aiAPI.getSuggestion(selectedStudent);
      setStudentSuggestion(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل التحليل');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeHalaqa = async () => {
    if (!selectedHalaqa) { toast.error('اختر حلقة أولاً'); return; }
    setLoading(true);
    setHalaqaSuggestion(null);
    setExpandedStudents({});
    try {
      const res = await aiAPI.getHalaqaSuggestion(selectedHalaqa);
      setHalaqaSuggestion(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل تحليل الحلقة');
    } finally {
      setLoading(false);
    }
  };

  const toggleStudentExpanded = (id) => {
    setExpandedStudents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const studentCfg = studentSuggestion ? (STATUS_CONFIG[studentSuggestion.status] || STATUS_CONFIG.no_data) : null;

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
        يحلل الذكاء الاصطناعي أداء الحفظ والحضور لكل طالب أو للحلقة بالكامل لمساعدتك في ضبط المقدار اليومي المناسب.
      </div>

      {/* ─── Tabs ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '0.25rem'
      }}>
        <button
          onClick={() => { setActiveTab('student'); setSearch(''); }}
          style={{
            padding: '0.6rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'student' ? '3px solid var(--green-400)' : '3px solid transparent',
            color: activeTab === 'student' ? 'var(--green-400)' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontFamily: 'Cairo, sans-serif',
            transition: 'var(--transition)'
          }}
        >
          <Brain size={16} />
          تحليل أداء طالب فردي
        </button>
        <button
          onClick={() => { setActiveTab('halaqa'); setSearch(''); }}
          style={{
            padding: '0.6rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'halaqa' ? '3px solid var(--green-400)' : '3px solid transparent',
            color: activeTab === 'halaqa' ? 'var(--green-400)' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontFamily: 'Cairo, sans-serif',
            transition: 'var(--transition)'
          }}
        >
          <Users size={16} />
          تحليل أداء حلقة كاملة
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* ─── Side Picker ───────────────────────────────────── */}
        {activeTab === 'student' ? (
          /* Student Picker */
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
                placeholder="بحث عن طالب..."
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
              ) : filteredStudents.map(s => (
                <button
                  key={s._id}
                  onClick={() => { setSelectedStudent(s._id); setStudentSuggestion(null); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.6rem 0.875rem',
                    borderRadius: 'var(--radius-sm)',
                    background: selectedStudent === s._id ? 'rgba(34,197,94,0.15)' : 'transparent',
                    border: selectedStudent === s._id ? '1px solid var(--border-green)' : '1px solid transparent',
                    color: selectedStudent === s._id ? 'var(--green-400)' : 'var(--text-primary)',
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
              onClick={handleAnalyzeStudent}
              disabled={!selectedStudent || loading}
            >
              <Brain size={16} />
              {loading ? 'جاري التحليل...' : 'تحليل أداء الطالب'}
            </button>
          </div>
        ) : (
          /* Halaqa Picker */
          <div className="card" style={{ padding: '1rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              اختر الحلقة
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: 400, overflowY: 'auto' }}>
              {halaqatLoading ? (
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                  <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto' }} />
                </div>
              ) : halaqat.map(h => (
                <button
                  key={h._id}
                  onClick={() => { setSelectedHalaqa(h._id); setHalaqaSuggestion(null); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.75rem 0.875rem',
                    borderRadius: 'var(--radius-sm)',
                    background: selectedHalaqa === h._id ? 'rgba(34,197,94,0.15)' : 'transparent',
                    border: selectedHalaqa === h._id ? '1px solid var(--border-green)' : '1px solid transparent',
                    color: selectedHalaqa === h._id ? 'var(--green-400)' : 'var(--text-primary)',
                    fontFamily: 'Cairo, sans-serif', fontWeight: 500, fontSize: '0.875rem',
                    cursor: 'pointer', textAlign: 'right', transition: 'var(--transition)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'right' }}>
                    <span>{h.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>المعلم: {h.supervisor}</span>
                  </div>
                  <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                    {h.studentsCount || 0} طالب
                  </span>
                </button>
              ))}
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }}
              onClick={handleAnalyzeHalaqa}
              disabled={!selectedHalaqa || loading}
            >
              <Sparkles size={16} />
              {loading ? 'جاري التحليل...' : 'تحليل أداء الحلقة'}
            </button>
          </div>
        )}

        {/* ─── Result Panel ─────────────────────────────────── */}
        <div>
          {loading ? (
            <div className="loading-wrap">
              <div className="spinner" />
              <span>جاري تحليل البيانات واستدعاء المستشار الذكي...</span>
            </div>
          ) : activeTab === 'student' ? (
            /* Student Suggestions Result */
            !studentSuggestion ? (
              <div className="card">
                <div className="empty-state">
                  <Brain size={56} />
                  <h3>اختر طالباً وابدأ التحليل</h3>
                  <p>سيحلل الذكاء الاصطناعي آخر 14 يوماً ويعطيك اقتراحاً بشأن القسط اليومي</p>
                </div>
              </div>
            ) : (
              <>
                {/* Status Card */}
                <div style={{
                  background: studentCfg.bg,
                  border: `1px solid ${studentCfg.border}`,
                  borderRadius: 'var(--radius-xl)',
                  padding: '2rem',
                  marginBottom: '1.5rem',
                  display: 'flex', alignItems: 'center', gap: '1.5rem',
                }}>
                  <div style={{
                    width: 72, height: 72,
                    background: studentCfg.bg,
                    border: `2px solid ${studentCfg.border}`,
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: studentCfg.color, flexShrink: 0,
                    fontSize: '2rem',
                  }}>
                    {studentCfg.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      الطالب: {studentSuggestion.studentName}
                    </div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: studentCfg.color, marginBottom: '0.5rem' }}>
                      {studentCfg.label}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      {studentSuggestion.recommendation}
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                  <div className="stat-card green">
                    <div className="stat-icon green">📖</div>
                    <div>
                      <div className="stat-value">{studentSuggestion.currentTarget}</div>
                      <div className="stat-label">القسط الحالي (صفحات)</div>
                    </div>
                  </div>
                  <div className="stat-card gold">
                    <div className="stat-icon gold">🎯</div>
                    <div>
                      <div className="stat-value" style={{ color: studentCfg.color }}>
                        {studentSuggestion.suggestedTarget}
                      </div>
                      <div className="stat-label">القسط المقترح</div>
                    </div>
                  </div>
                  <div className="stat-card blue">
                    <div className="stat-icon blue">📅</div>
                    <div>
                      <div className="stat-value">{studentSuggestion.totalDays}</div>
                      <div className="stat-label">أيام محللة</div>
                    </div>
                  </div>
                  <div className="stat-card red">
                    <div className="stat-icon red">✅</div>
                    <div>
                      <div className="stat-value">
                        {studentSuggestion.successRate !== null ? `${studentSuggestion.successRate}%` : '—'}
                      </div>
                      <div className="stat-label">معدل الإنجاز</div>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                {studentSuggestion.successRate !== null && (
                  <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        معدل إنجاز القسط (آخر {studentSuggestion.totalDays} أيام)
                      </span>
                      <span style={{ color: studentCfg.color, fontWeight: 800 }}>
                        {studentSuggestion.successDays}/{studentSuggestion.totalDays} يوم
                      </span>
                    </div>
                    <div className="progress-bar-wrap" style={{ height: 10 }}>
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${studentSuggestion.successRate}%`,
                          background: studentSuggestion.successRate >= 80
                            ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                            : studentSuggestion.successRate >= 50
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

                {/* Last Records */}
                {studentSuggestion.lastRecords?.length > 0 && (
                  <div className="card">
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
                      آخر {studentSuggestion.lastRecords.length} أيام
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
                          {studentSuggestion.lastRecords.map((r, i) => (
                            <tr key={i}>
                              <td style={{ color: 'var(--text-secondary)' }}>
                                {new Date(r.date).toLocaleDateString('ar-DZ', {
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
            )
          ) : (
            /* Halaqa Suggestions Result */
            !halaqaSuggestion ? (
              <div className="card">
                <div className="empty-state">
                  <Users size={56} />
                  <h3>اختر حلقة وابدأ التحليل</h3>
                  <p>سيحلل الذكاء الاصطناعي أداء جميع طلاب الحلقة ككل ويقدم تقريراً تفصيلياً مع مقترحات فردية</p>
                </div>
              </div>
            ) : (
              <>
                {/* Overall evaluation Card */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(34,197,94,0.04) 0%, rgba(59,130,246,0.04) 100%)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '2rem',
                  marginBottom: '1.5rem',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    position: 'absolute', top: 0, right: 0,
                    width: '120px', height: '120px',
                    background: 'radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)',
                    pointerEvents: 'none'
                  }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div style={{
                      width: 48, height: 48,
                      background: 'rgba(34,197,94,0.1)',
                      border: '1px solid rgba(34,197,94,0.2)',
                      borderRadius: 'var(--radius-lg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--green-400)'
                    }}>
                      <Sparkles size={24} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Cairo, sans-serif' }}>
                        التقييم والتحليل العام لحلقة ({halaqaSuggestion.halaqaName})
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        تقرير استشاري ذكي شامل لأداء الحلقة
                      </span>
                    </div>
                  </div>
                  <div style={{
                    fontSize: '0.95rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.85,
                    whiteSpace: 'pre-line',
                    textAlign: 'justify'
                  }}>
                    {halaqaSuggestion.overallEvaluation}
                  </div>
                </div>

                {/* Group Stats Grid */}
                <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                  <div className="stat-card blue">
                    <div className="stat-icon blue"><Users size={20} /></div>
                    <div>
                      <div className="stat-value">{halaqaSuggestion.statsSummary.totalStudents}</div>
                      <div className="stat-label">إجمالي الطلاب</div>
                    </div>
                  </div>
                  <div className="stat-card green">
                    <div className="stat-icon green">📈</div>
                    <div>
                      <div className="stat-value">
                        {halaqaSuggestion.statsSummary.avgSuccessRate !== null ? `${halaqaSuggestion.statsSummary.avgSuccessRate}%` : '—'}
                      </div>
                      <div className="stat-label">متوسط نسبة إنجاز الحلقة</div>
                    </div>
                  </div>
                  <div className="stat-card gold">
                    <div className="stat-icon gold"><TrendingUp size={20} /></div>
                    <div>
                      <div className="stat-value" style={{ color: 'var(--green-400)' }}>
                        {halaqaSuggestion.statsSummary.increaseCount}
                      </div>
                      <div className="stat-label">مقترح زيادة قسطهم</div>
                    </div>
                  </div>
                  <div className="stat-card red">
                    <div className="stat-icon red"><TrendingDown size={20} /></div>
                    <div>
                      <div className="stat-value" style={{ color: 'var(--danger)' }}>
                        {halaqaSuggestion.statsSummary.decreaseCount}
                      </div>
                      <div className="stat-label">مقترح تقليل قسطهم</div>
                    </div>
                  </div>
                </div>

                {/* Individual Recommendations Card list */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Cairo, sans-serif' }}>
                    التوصيات الفردية لطلاب الحلقة
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {halaqaSuggestion.students.length === 0 ? (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        لا يوجد طلاب نشطين لتحليل أدائهم في هذه الحلقة.
                      </div>
                    ) : (
                      halaqaSuggestion.students.map((student) => {
                        const studentCfg = STATUS_CONFIG[student.status] || STATUS_CONFIG.no_data;
                        const isExpanded = expandedStudents[student.studentId];

                        return (
                          <div
                            key={student.studentId}
                            style={{
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-lg)',
                              backgroundColor: 'var(--bg-surface)',
                              overflow: 'hidden',
                              transition: 'var(--transition)',
                            }}
                          >
                            {/* Student Row */}
                            <div
                              onClick={() => toggleStudentExpanded(student.studentId)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.9rem 1.25rem',
                                cursor: 'pointer',
                                userSelect: 'none',
                                background: isExpanded ? 'rgba(0,0,0,0.02)' : 'transparent',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '1.5' }}>
                                <div style={{
                                  width: 38, height: 38,
                                  borderRadius: '50%',
                                  background: studentCfg.bg,
                                  border: `1px solid ${studentCfg.border}`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '1.2rem', flexShrink: 0
                                }}>
                                  {studentCfg.emoji}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                                    {student.studentName}
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    {student.level}
                                  </div>
                                </div>
                              </div>

                              {/* Target Comparison */}
                              <div style={{ flex: '1.8', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                  الحالي: <strong style={{ color: 'var(--text-primary)' }}>{student.currentTarget} ص</strong>
                                </div>
                                <span style={{ color: 'var(--text-muted)' }}>➔</span>
                                <div style={{
                                  fontSize: '0.85rem',
                                  fontWeight: 800,
                                  color: studentCfg.color,
                                  background: studentCfg.bg,
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: 'var(--radius-sm)',
                                  border: `1px solid ${studentCfg.border}`
                                }}>
                                  المقترح: {student.suggestedTarget} ص
                                </div>
                              </div>

                              {/* Success Rate */}
                              <div style={{ flex: '1.2', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                  الإنجاز: <strong style={{ color: 'var(--text-primary)' }}>{student.successRate !== null ? `${student.successRate}%` : '—'}</strong>
                                </div>
                                {student.successRate !== null && (
                                  <div className="progress-bar-wrap" style={{ height: 6, width: 70 }}>
                                    <div
                                      className="progress-bar-fill"
                                      style={{
                                        width: `${student.successRate}%`,
                                        background: student.successRate >= 80 ? 'var(--green-400)' : student.successRate >= 50 ? 'var(--gold-400)' : 'var(--danger)'
                                      }}
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Toggle Arrow */}
                              <div style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </div>
                            </div>

                            {/* Details Accordion Content */}
                            {isExpanded && (
                              <div style={{
                                padding: '1.25rem',
                                borderTop: '1px solid var(--border-color)',
                                backgroundColor: 'rgba(0,0,0,0.01)',
                              }}>
                                {/* Individual recommendation text */}
                                <div style={{
                                  marginBottom: '1rem',
                                  padding: '0.85rem 1.1rem',
                                  borderRadius: 'var(--radius-md)',
                                  background: studentCfg.bg,
                                  borderRight: `4px solid ${studentCfg.color}`,
                                  fontSize: '0.9rem',
                                  color: 'var(--text-secondary)',
                                  lineHeight: 1.6
                                }}>
                                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}>
                                    توصية المستشار:
                                  </strong>
                                  {student.recommendation}
                                </div>

                                {/* Last Records Table */}
                                {student.lastRecords && student.lastRecords.length > 0 && (
                                  <div>
                                    <div style={{
                                      fontWeight: 700,
                                      fontSize: '0.78rem',
                                      color: 'var(--text-muted)',
                                      marginBottom: '0.5rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.3rem'
                                    }}>
                                      <FileText size={13} />
                                      سجل التتبع الأخير (آخر {student.lastRecords.length} أيام)
                                    </div>
                                    <div className="table-wrapper" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                      <table style={{ fontSize: '0.78rem' }}>
                                        <thead>
                                          <tr>
                                            <th>التاريخ</th>
                                            <th style={{ textAlign: 'center' }}>المطلوب</th>
                                            <th style={{ textAlign: 'center' }}>المستظهر</th>
                                            <th style={{ textAlign: 'center' }}>النتيجة</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {student.lastRecords.map((r, i) => (
                                            <tr key={i}>
                                              <td style={{ color: 'var(--text-secondary)' }}>
                                                {new Date(r.date).toLocaleDateString('ar-DZ', {
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
                                                  ? <span className="badge badge-green" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>✅ نجح</span>
                                                  : <span className="badge badge-red" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>❌ لم يكتمل</span>
                                                }
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
