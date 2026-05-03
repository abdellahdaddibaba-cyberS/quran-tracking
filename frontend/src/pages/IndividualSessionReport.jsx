import { useState, useEffect } from 'react';
import { UserCheck, Search, Calendar, Award, Plus, List, CheckCircle2, History, MessageSquare, ChevronDown, ChevronUp, Trash2, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { halaqatAPI, studentsAPI, reportsAPI, trackingAPI } from '../services/api';

export default function IndividualSessionReport() {
  const [view, setView] = useState('record'); // 'record' or 'report'
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  // States for Record View
  const [halaqat, setHalaqat] = useState([]);
  const [selectedHalaqa, setSelectedHalaqa] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState([]);
  const [sessionsMap, setSessionsMap] = useState({}); // { studentId: boolean }
  const [notesMap, setNotesMap] = useState({}); // { studentId: string }
  const [expandedStudent, setExpandedStudent] = useState(null); // studentId
  const [studentHistory, setStudentHistory] = useState({}); // { studentId: [notes] }
  const [historyLoading, setHistoryLoading] = useState(false);

  // States for Report View
  const [reportData, setReportData] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null); // { studentId, date }

  useEffect(() => {
    halaqatAPI.getAll().then(r => setHalaqat(r.data.data));
  }, []);

  // Fetch students and their session status for the selected date
  useEffect(() => {
    if (view === 'record' && selectedHalaqa) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const [sRes, tRes] = await Promise.all([
            studentsAPI.getByHalaqa(selectedHalaqa),
            trackingAPI.getByHalaqa(selectedHalaqa, { date: selectedDate })
          ]);
          setStudents(sRes.data.data);
          
          const sMap = {};
          const nMap = {};
          tRes.data.data.forEach(rec => {
            const sid = rec.studentId?._id || rec.studentId;
            if (rec.individualSession) sMap[sid] = true;
            nMap[sid] = rec.notes || '';
          });
          setSessionsMap(sMap);
          setNotesMap(nMap);
        } catch (err) {
          toast.error('فشل تحميل البيانات');
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    } else if (view === 'report') {
      const fetchReport = async () => {
        setLoading(true);
        try {
          const res = await reportsAPI.getIndividualSessions();
          setReportData(res.data.data);
        } catch (err) {
          toast.error('فشل تحميل التقرير');
        } finally {
          setLoading(false);
        }
      };
      fetchReport();
    }
  }, [view, selectedHalaqa, selectedDate]);

  const toggleSession = async (studentId, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      await reportsAPI.toggleSession({
        studentId,
        date: selectedDate,
        status: newStatus
      });
      setSessionsMap(prev => ({ ...prev, [studentId]: newStatus }));
      toast.success(newStatus ? 'تم تسجيل الجلسة' : 'تم إلغاء الجلسة');
    } catch (err) {
      toast.error('فشل تحديث حالة الجلسة');
    }
  };

  const saveNote = async (studentId, note) => {
    try {
      await reportsAPI.toggleSession({
        studentId,
        date: selectedDate,
        notes: note
      });
      // تحديث التاريخ المحلي للسجل إذا كان مفتوحاً
      if (studentHistory[studentId]) {
        fetchHistory(studentId);
      }
      toast.success('تم حفظ الملاحظة');
    } catch (err) {
      toast.error('فشل حفظ الملاحظة');
    }
  };

  const fetchHistory = async (studentId) => {
    if (expandedStudent === studentId) {
      setExpandedStudent(null);
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await reportsAPI.getStudentNotes(studentId);
      setStudentHistory(prev => ({ ...prev, [studentId]: res.data.data }));
      setExpandedStudent(studentId);
    } catch (err) {
      toast.error('فشل تحميل السجل');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteSession = async (studentId, date) => {
    setConfirmDelete({ studentId, date });
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    const { studentId, date } = confirmDelete;
    try {
      await reportsAPI.deleteSession({ studentId, date });
      toast.success('تم حذف الجلسة بنجاح');
      
      // تحديث الواجهة
      if (selectedDate === date) {
        setSessionsMap(prev => ({ ...prev, [studentId]: false }));
        setNotesMap(prev => ({ ...prev, [studentId]: '' }));
      }
      
      // تحديث السجل التاريخي
      const res = await reportsAPI.getStudentNotes(studentId);
      setStudentHistory(prev => ({ ...prev, [studentId]: res.data.data }));
      
      setConfirmDelete(null);
    } catch (err) {
      toast.error('فشل حذف الجلسة');
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredReport = reportData.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.halaqa.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="report-container">
      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon"><UserCheck size={20} /></div>
          الجلسات الفردية
        </div>
        <div className="header-actions">
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              className={`btn ${view === 'record' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setView('record'); setSearch(''); }}
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              <Plus size={16} />
              تسجيل جلسة
            </button>
            <button 
              className={`btn ${view === 'report' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setView('report'); setSearch(''); }}
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              <List size={16} />
              تقرير الجلسات
            </button>
          </div>
        </div>
      </div>

      {/* ─── نافذة التأكيد الجميلة ─── */}
      {confirmDelete && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
            <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>
              <Trash2 size={48} />
            </div>
            <h3 style={{ marginBottom: '0.5rem' }}>تأكيد الحذف</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>هل أنت متأكد من حذف هذه الجلسة؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn btn-outline" onClick={() => setConfirmDelete(null)}>إلغاء</button>
              <button className="btn btn-danger" onClick={executeDelete}>حذف الآن</button>
            </div>
          </div>
        </div>
      )}

      {view === 'record' ? (
        <>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">التاريخ</label>
              <input 
                type="date" 
                className="form-control" 
                value={selectedDate} 
                onChange={e => setSelectedDate(e.target.value)} 
                style={{ maxWidth: '250px' }}
              />
            </div>

            <label className="form-label">اختر الحلقة</label>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
              gap: '1rem',
              marginTop: '0.5rem',
              marginBottom: '1.5rem'
            }}>
              {halaqat.map(h => {
                const isSelected = selectedHalaqa === h._id;
                return (
                  <div 
                    key={h._id}
                    onClick={() => setSelectedHalaqa(h._id)}
                    style={{
                      cursor: 'pointer',
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-card)',
                      border: isSelected ? '2px solid var(--green-500)' : '1px solid var(--border)',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ 
                        margin: 0, 
                        fontSize: '1rem', 
                        fontWeight: 800,
                        color: isSelected ? 'var(--green-400)' : 'var(--text-primary)'
                      }}>
                        {h.name}
                      </h3>
                      <span className="badge badge-green" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                        {h.studentsCount || 0} طالب
                      </span>
                    </div>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      color: isSelected ? 'var(--green-500)' : 'var(--text-secondary)'
                    }}>
                      👤 {h.supervisor}
                    </span>
                    {isSelected && (
                      <div style={{ 
                        position: 'absolute', top: '0.5rem', left: '0.5rem',
                        color: 'var(--green-400)'
                      }}>
                        <CheckCircle2 size={16} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedHalaqa && (
              <div style={{ marginTop: '1.5rem', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="بحث عن طالب..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingRight: '2.5rem' }}
                />
              </div>
            )}
          </div>
          </div>

          {!selectedHalaqa ? (
            <div className="card">
              <div className="empty-state">
                <Plus size={48} />
                <h3>اختر الحلقة أولاً</h3>
                <p>حدد الحلقة والتاريخ لتسجيل الجلسات الفردية للطلاب.</p>
              </div>
            </div>
          ) : loading ? (
            <div className="loading-wrap"><div className="spinner" /><span>جاري التحميل...</span></div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>اسم الطالب</th>
                      <th style={{ textAlign: 'center' }}>الحالة</th>
                      <th>الملاحظات (لليوم)</th>
                      <th style={{ textAlign: 'center' }}>السجل</th>
                      <th style={{ textAlign: 'center' }}>الإجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s, idx) => {
                      const isRecorded = !!sessionsMap[s._id];
                      const note = notesMap[s._id] || '';
                      const history = studentHistory[s._id] || [];
                      const isExpanded = expandedStudent === s._id;

                      return (
                        <>
                          <tr key={s._id} style={{ 
                            background: isRecorded ? 'rgba(34, 197, 94, 0.03)' : '',
                            borderBottom: isExpanded ? 'none' : '1px solid var(--border)'
                          }}>
                            <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td style={{ fontWeight: 700 }}>{s.name}</td>
                            <td style={{ textAlign: 'center' }}>
                              {isRecorded ? (
                                <span className="badge badge-green">تم التسجيل</span>
                              ) : (
                                <span className="badge badge-outline">لم تسجل</span>
                              )}
                            </td>
                            <td>
                              <textarea 
                                className="form-control"
                                placeholder="أضف ملاحظة..."
                                value={note}
                                onChange={e => setNotesMap(prev => ({ ...prev, [s._id]: e.target.value }))}
                                onBlur={e => saveNote(s._id, e.target.value)}
                                style={{ 
                                  fontSize: '0.8rem', minHeight: '60px', 
                                  padding: '0.4rem', background: 'var(--bg-lighter)' 
                                }}
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button 
                                className={`btn btn-sm ${isExpanded ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => fetchHistory(s._id)}
                                disabled={historyLoading && expandedStudent === null}
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <History size={16} />}
                              </button>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button 
                                className={`btn btn-sm ${isRecorded ? 'btn-danger' : 'btn-primary'}`}
                                onClick={() => toggleSession(s._id, isRecorded)}
                                style={{ minWidth: 100 }}
                              >
                                {isRecorded ? 'إلغاء' : 'تسجيل'}
                              </button>
                            </td>
                          </tr>
                          
                          {/* ─── توسيع عرض الملاحظات السابقة ─── */}
                          {isExpanded && (
                            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                              <td colSpan={6} style={{ padding: '0 1rem 1rem 1rem' }}>
                                <div style={{ 
                                  padding: '1rem', 
                                  border: '1px solid var(--border)', 
                                  borderRadius: '0 0 8px 8px',
                                  background: 'var(--bg-main)',
                                  maxHeight: '250px',
                                  overflowY: 'auto'
                                }}>
                                  <h4 style={{ fontSize: '0.85rem', color: 'var(--gold-400)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <MessageSquare size={14} /> سجل جميع الملاحظات
                                  </h4>
                                  {history.length === 0 ? (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>لا توجد ملاحظات سابقة.</div>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                      {history.map((h, hIdx) => (
                                        <div key={hIdx} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', position: 'relative' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', paddingLeft: '2rem' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                              {new Date(h.date).toLocaleDateString('ar-EG', { dateStyle: 'medium' })}
                                            </span>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                              {h.individualSession && <span style={{ fontSize: '0.65rem', color: 'var(--green-400)' }}>جلسة فردية</span>}
                                              {(h.isSurahCompleted || h.issurahcompleted) && (
                                                <span style={{ fontSize: '0.65rem', color: 'var(--gold-400)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                  <Star size={10} fill="currentColor" /> أتم السورة
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.5, paddingLeft: '2rem' }}>
                                            {h.notes || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>بدون ملاحظة مكتوبة</span>}
                                          </p>
                                          <button 
                                            onClick={() => handleDeleteSession(s._id, h.date)}
                                            style={{ 
                                              position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                                              background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer',
                                              opacity: 0.6, padding: '4px'
                                            }}
                                            title="حذف الجلسة"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', top: '50%', right: '1rem', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
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
            <div className="loading-wrap"><div className="spinner" /><span>جاري التحميل...</span></div>
          ) : filteredReport.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <Award size={48} />
                <h3>لا توجد بيانات</h3>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {filteredReport.map(s => {
                const isExpanded = expandedStudent === s.id;
                const history = studentHistory[s.id] || [];

                return (
                  <div key={s.id} className="card" style={{ borderTop: '4px solid var(--green-500)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{s.name}</h3>
                        <span className="badge badge-blue" style={{ marginTop: '0.5rem', display: 'inline-block' }}>{s.halaqa}</span>
                      </div>
                      <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'var(--green-400)', padding: '0.5rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{s.sessionCount}</div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700 }}>جلسات</div>
                      </div>
                    </div>
                    
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <Calendar size={14} />
                      <span>آخر جلسة: {new Date(s.lastSessionDate).toLocaleDateString('ar-EG', { dateStyle: 'medium' })}</span>
                    </div>

                    <button 
                      className="btn btn-outline" 
                      style={{ width: '100%', justifyContent: 'center' }} 
                      onClick={() => fetchHistory(s.id)}
                    >
                      <History size={16} />
                      {isExpanded ? 'إخفاء السجل' : 'عرض السجل الكامل'}
                    </button>

                    {isExpanded && (
                      <div style={{ 
                        marginTop: '0.5rem', 
                        padding: '1rem', 
                        background: 'rgba(255,255,255,0.02)', 
                        borderRadius: 'var(--radius-md)',
                        maxHeight: '300px',
                        overflowY: 'auto'
                      }}>
                        <h4 style={{ fontSize: '0.8rem', color: 'var(--gold-400)', marginBottom: '0.5rem' }}>الملاحظات التاريخية:</h4>
                        {history.map((h, i) => (
                          <div key={i} style={{ marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(h.date).toLocaleDateString('ar-EG')}</div>
                            <div style={{ fontSize: '0.85rem' }}>{h.notes || '—'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
