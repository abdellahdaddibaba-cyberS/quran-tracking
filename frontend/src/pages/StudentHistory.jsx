import { useState, useEffect } from 'react';
import { BarChart2, Search, ChevronRight, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { studentsAPI, trackingAPI } from '../services/api';

export default function StudentHistory() {
  const [students,   setStudents]   = useState([]);
  const [selected,   setSelected]   = useState('');
  const [records,    setRecords]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const LIMIT = 15;

  useEffect(() => {
    studentsAPI.getAll()
      .then(r => setStudents(r.data.data))
      .catch(() => toast.error('فشل تحميل الطلبة'));
  }, []);

  const fetchHistory = async (studentId, p = 1) => {
    if (!studentId) return;
    setLoading(true);
    try {
      const res = await trackingAPI.getByStudent(studentId, { page: p, limit: LIMIT });
      setRecords(res.data.data);
      setTotalPages(res.data.pages || 1);
      setPage(p);
    } catch {
      toast.error('فشل تحميل السجل');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (id) => {
    setSelected(id);
    setPage(1);
    fetchHistory(id, 1);
  };

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedStudent = students.find(s => s._id === selected);

  // إحصائيات الطالب
  const stats = records.length > 0 ? {
    totalDays:    records.length,
    successDays:  records.filter(r => r.pagesMemorized >= r.pagesRequired && r.attendance !== 'absent').length,
    totalMemorized: records.reduce((sum, r) => sum + (r.attendance !== 'absent' ? r.pagesMemorized : 0), 0),
    avgMemorized: (records.reduce((sum, r) => sum + (r.attendance !== 'absent' ? r.pagesMemorized : 0), 0) / records.length).toFixed(1),
    absences:     records.filter(r => r.attendance === 'absent').length,
    lates:        records.filter(r => r.isLate).length
  } : null;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon"><BarChart2 size={20} /></div>
          سجل الطالب
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* ─── Student List ─────────────────────────── */}
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ marginBottom: '0.75rem', position: 'relative' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: 480, overflowY: 'auto' }}>
            {filteredStudents.map(s => (
              <button
                key={s._id}
                onClick={() => handleSelect(s._id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.6rem 0.875rem',
                  borderRadius: 'var(--radius-sm)',
                  background: selected === s._id ? 'rgba(34,197,94,0.15)' : 'transparent',
                  border: selected === s._id ? '1px solid var(--border-green)' : '1px solid transparent',
                  color: selected === s._id ? 'var(--green-400)' : 'var(--text-primary)',
                  fontFamily: 'Cairo, sans-serif',
                  fontWeight: selected === s._id ? 700 : 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  textAlign: 'right',
                  transition: 'var(--transition)',
                }}
              >
                <span>{s.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.dailyTarget} ص</span>
              </button>
            ))}
            {filteredStudents.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontSize: '0.85rem' }}>
                لا توجد نتائج
              </div>
            )}
          </div>
        </div>

        {/* ─── History Panel ────────────────────────── */}
        <div>
          {!selected ? (
            <div className="card">
              <div className="empty-state">
                <BarChart2 size={48} />
                <h3>اختر طالباً</h3>
                <p>اختر طالباً من القائمة لعرض سجله اليومي</p>
              </div>
            </div>
          ) : loading ? (
            <div className="loading-wrap"><div className="spinner" /><span>جاري التحميل...</span></div>
          ) : (
            <>
              {/* Stats */}
              {stats && (
                <div className="stats-grid" style={{ marginBottom: '1rem' }}>
                  <div className="stat-card green">
                    <div className="stat-icon green"><BarChart2 size={20} /></div>
                    <div>
                      <div className="stat-value">{stats.totalDays}</div>
                      <div className="stat-label">أيام مسجلة</div>
                    </div>
                  </div>
                  <div className="stat-card gold">
                    <div className="stat-icon gold">✅</div>
                    <div>
                      <div className="stat-value">{stats.successDays}</div>
                      <div className="stat-label">أيام اكتمل فيها القسط</div>
                    </div>
                  </div>
                  <div className="stat-card blue">
                    <div className="stat-icon blue">📖</div>
                    <div>
                      <div className="stat-value">{stats.avgMemorized}</div>
                      <div className="stat-label">متوسط الصفحات/يوم</div>
                    </div>
                  </div>
                  <div className="stat-card red">
                    <div className="stat-icon red">❌</div>
                    <div>
                      <div className="stat-value">{stats.absences}</div>
                      <div className="stat-label">الغيابات</div>
                    </div>
                  </div>
                  <div className="stat-card gold">
                    <div className="stat-icon gold">⏱️</div>
                    <div>
                      <div className="stat-value">{stats.lates}</div>
                      <div className="stat-label">التأخرات</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Progress Bar */}
              {stats && (
                <div className="card" style={{ marginBottom: '1rem', padding: '1rem 1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>معدل إنجاز القسط</span>
                    <span style={{ color: 'var(--green-400)', fontWeight: 700 }}>
                      {Math.round((stats.successDays / stats.totalDays) * 100)}%
                    </span>
                  </div>
                  <div className="progress-bar-wrap">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${(stats.successDays / stats.totalDays) * 100}%`,
                        background: 'linear-gradient(90deg, var(--green-600), var(--green-400))',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Records Table */}
              {records.length === 0 ? (
                <div className="card">
                  <div className="empty-state">
                    <BarChart2 size={40} />
                    <h3>لا يوجد سجل</h3>
                    <p>لم يُدخل بيانات لهذا الطالب بعد</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>التاريخ</th>
                          <th style={{ textAlign: 'center' }}>المطلوب</th>
                          <th style={{ textAlign: 'center' }}>المستظهر</th>
                          <th style={{ textAlign: 'center' }}>الفرق</th>
                          <th style={{ textAlign: 'center' }}>الحالة</th>
                          <th>ملاحظة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map(r => {
                          const diff    = r.pagesMemorized - r.pagesRequired;
                          const success = r.pagesMemorized >= r.pagesRequired && r.attendance !== 'absent';
                          return (
                            <tr key={r._id}>
                              <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                {new Date(r.date).toLocaleDateString('en-GB', {
                                  weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                                })}
                                {r.isLate && <span style={{ marginRight: '6px', fontSize: '0.7rem', color: 'var(--gold-500)', fontWeight: 'bold' }}>(متأخر)</span>}
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.pagesRequired}</td>
                              <td style={{ textAlign: 'center', fontWeight: 700, color: success ? 'var(--green-400)' : 'var(--danger)' }}>
                                {r.attendance === 'absent' ? '—' : r.pagesMemorized}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{ color: diff >= 0 && r.attendance !== 'absent' ? 'var(--green-400)' : 'var(--danger)', fontWeight: 600 }}>
                                  {r.attendance === 'absent' ? '—' : (diff >= 0 ? `+${diff}` : diff)}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {r.attendance === 'absent'
                                  ? <span className="badge badge-red">❌ غائب</span>
                                  : success
                                    ? <span className="badge badge-green">✅ اكتمل</span>
                                    : r.pagesMemorized > 0
                                      ? <span className="badge badge-gold">⚡ جزئي</span>
                                      : <span className="badge badge-red">❌ لم يحفظ</span>
                                }
                              </td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                {r.notes || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => fetchHistory(selected, page - 1)}
                        disabled={page === 1}
                      >
                        <ChevronRight size={16} /> السابق
                      </button>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        صفحة {page} من {totalPages}
                      </span>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => fetchHistory(selected, page + 1)}
                        disabled={page === totalPages}
                      >
                        التالي <ChevronLeft size={16} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
