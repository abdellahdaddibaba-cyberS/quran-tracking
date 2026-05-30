import { useState, useEffect, useMemo } from 'react';
import { UserCheck, Save, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { halaqatAPI, studentsAPI, trackingAPI } from '../services/api';

function getWeekDays(dateInput) {
  const [y, m, d] = dateInput.split('-');
  const date = new Date(y, m - 1, d);
  const day = date.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat

  const diffToSun = day;
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - diffToSun);

  const days = [];
  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  for (let i = 0; i < 6; i++) {
    const current = new Date(sunday);
    current.setDate(sunday.getDate() + i);
    days.push({
      dateStr: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`,
      label: dayNames[current.getDay()],
      shortDate: current.toLocaleDateString('ar-DZ', { month: 'numeric', day: 'numeric' })
    });
  }
  return days;
}

export default function Attendance() {
  const [halaqatMap, setHalaqatMap] = useState({});
  const [students, setStudents] = useState([]);

  const [baseDate, setBaseDate] = useState(() => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return today < '2026-06-14' ? '2026-06-14' : today;
  });
  const weekDays = useMemo(() => getWeekDays(baseDate), [baseDate]);

  const weekName = useMemo(() => {
    const start = new Date(2026, 5, 14);
    const [y, m, d] = baseDate.split('-');
    const current = new Date(y, m - 1, d);
    const diffDays = Math.floor((current - start) / (1000 * 60 * 60 * 24));
    const weekNum = Math.max(1, Math.floor(diffDays / 7) + 1);
    const names = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
    return names[weekNum - 1] || String(weekNum);
  }, [baseDate]);

  // matrix: { studentId: { dateStr: { status: '' | 'present' | 'absent' | 'late', pages: number } } }
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const startDate = weekDays[0].dateStr;
        const endDate = weekDays[5].dateStr;

        const [hRes, sRes, tRes] = await Promise.all([
          halaqatAPI.getAll(),
          studentsAPI.getAll(),
          trackingAPI.getAllRange({ startDate, endDate })
        ]);

        const hMap = {};
        hRes.data.data.forEach(h => { hMap[h._id] = h.name; });
        setHalaqatMap(hMap);

        const fetchedStudents = sRes.data.data;
        // ترتيب الطلبة حسب الحلقة ثم أبجدياً
        fetchedStudents.sort((a, b) => {
          const hA = String(a.halaqaId?._id || a.halaqaId || '');
          const hB = String(b.halaqaId?._id || b.halaqaId || '');
          if (hA !== hB) return hA.localeCompare(hB);
          return a.name.localeCompare(b.name);
        });

        setStudents(fetchedStudents);

        const fetchedTracking = tRes.data.data;
        const newMatrix = {};

        fetchedStudents.forEach(st => {
          newMatrix[st._id] = {};
          weekDays.forEach(day => {
            newMatrix[st._id][day.dateStr] = { status: '', pages: '' };
          });
        });

        fetchedTracking.forEach(record => {
          const sid = record.studentId?._id || record.studentId;
          const rd = new Date(record.date);
          const rDate = `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, '0')}-${String(rd.getDate()).padStart(2, '0')}`;

          if (newMatrix[sid]) {
            let stStatus = '';
            if (record.attendance === 'absent') stStatus = 'absent';
            else if (record.isLate) stStatus = 'late';
            else if (record.attendance === 'present') stStatus = 'present';
            else if (record.attendance === 'excused') stStatus = 'excused';

            newMatrix[sid][rDate] = {
              status: stStatus,
              pages: record.pagesMemorized,
              isSurahCompleted: record.isSurahCompleted || false,
              notes: record.notes || ''
            };
          }
        });

        setMatrix(newMatrix);
        setSaved(false);
      } catch (err) {
        toast.error('فشل تحميل بيانات الحضور');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [baseDate, weekDays]);

  const updateCell = (studentId, dateStr, newStatus) => {
    setMatrix(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [dateStr]: {
          ...prev[studentId][dateStr],
          status: newStatus
        }
      }
    }));
  };

  const shiftWeek = (offset) => {
    const [y, m, d] = baseDate.split('-');
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + offset * 7);
    let newDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    if (newDate < '2026-06-14') newDate = '2026-06-14';
    setBaseDate(newDate);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const records = [];
      students.forEach(st => {
        weekDays.forEach(day => {
          const cell = matrix[st._id]?.[day.dateStr];
          if (cell && cell.status !== '') {
            let att = 'present';
            let late = false;
            if (cell.status === 'absent') att = 'absent';
            else if (cell.status === 'late') late = true;
            else if (cell.status === 'excused') att = 'excused';

            records.push({
              studentId: st._id,
              date: day.dateStr,
              pagesRequired: st.dailyTarget,
              pagesMemorized: att === 'absent' ? 0 : Number(cell.pages || 0),
              attendance: att,
              isLate: late,
              isSurahCompleted: cell.isSurahCompleted || false,
              notes: cell.notes || ''
            });
          }
        });
      });

      if (records.length === 0) {
        toast.error('لا يوجد أي بيانات للحفظ!');
        setSaving(false);
        return;
      }

      await trackingAPI.bulkInsert(records);
      toast.success(`تم حفظ سجل الحضور بنجاح ✅`);
      setSaved(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon"><UserCheck size={20} /></div>
          سجل الحضور الأسبوعي للطلبة
        </div>
        {students.length > 0 && (
          <button className="btn btn-primary btn-lg" onClick={handleSaveAll} disabled={saving}>
            <Save size={18} />
            {saving ? 'جاري الحفظ...' : `حفظ سجل الحضور`}
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="form-row" style={{ alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">أسبوع يبدأ من (الأحد) — <span style={{ color: 'var(--green-500)', fontWeight: 'bold' }}>الأسبوع {weekName}</span></label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => shiftWeek(-1)} title="الأسبوع السابق">
                <ChevronRight size={18} />
              </button>
              <input
                type="date"
                className="form-control"
                min="2026-06-14"
                value={baseDate}
                onChange={e => {
                  if (e.target.value >= '2026-06-14') setBaseDate(e.target.value);
                }}
                style={{ textAlign: 'center' }}
              />
              <button className="btn btn-secondary" onClick={() => shiftWeek(1)} title="الأسبوع القادم">
                <ChevronLeft size={18} />
              </button>
            </div>
          </div>

          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">بحث عن طالب</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                placeholder="اكتب اسم الطالب..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingRight: '2.5rem' }}
              />
            </div>
          </div>
        </div>
      </div>

      {saved && (
        <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>
          <CheckCircle2 size={18} />
          تم حفظ سجل الحضور لهذا الأسبوع بنجاح!
        </div>
      )}

      {loading ? (
        <div className="loading-wrap"><div className="spinner" /><span>جاري تحميل بيانات الأسبوع...</span></div>
      ) : filteredStudents.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <AlertCircle size={48} />
            <h3>لا توجد نتائج</h3>
            <p>لم يتم العثور على طلبة</p>
          </div>
        </div>
      ) : (
        <div className="table-wrapper attendance-table">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th style={{ minWidth: 160 }}>اسم الطالب</th>
                <th>الحلقة</th>
                {weekDays.map(day => (
                  <th key={day.dateStr} style={{ textAlign: 'center', minWidth: 110 }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{day.label}</div>
                    <div style={{ color: 'var(--text-primary)' }}>{day.shortDate}</div>
                  </th>
                ))}
                <th style={{ textAlign: 'center', background: 'rgba(239,68,68,0.05)', color: 'var(--danger)', width: 90 }}>
                  مجموع الغياب
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((st, idx) => {
                const hName = st.halaqaId?.name || halaqatMap[st.halaqaId] || '—';

                let absencesCount = 0;
                weekDays.forEach(day => {
                  if (matrix[st._id]?.[day.dateStr]?.status === 'absent') {
                    absencesCount++;
                  }
                });

                return (
                  <tr key={st._id}>
                    <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 700, fontSize: '0.9rem' }}>{st.name}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{hName}</td>
                    {weekDays.map(day => {
                      const cell = matrix[st._id]?.[day.dateStr] || { status: '' };
                      const stVal = cell.status;

                      let bg = 'transparent';
                      let borderColor = 'var(--border)';
                      if (stVal === 'present') { bg = 'rgba(34,197,94,0.1)'; borderColor = 'var(--green-500)'; }
                      else if (stVal === 'absent') { bg = 'rgba(239,68,68,0.1)'; borderColor = 'var(--danger)'; }
                      else if (stVal === 'late') { bg = 'rgba(245,158,11,0.1)'; borderColor = 'var(--gold-500)'; }

                      return (
                        <td key={day.dateStr} style={{ textAlign: 'center', padding: '0.5rem' }}>
                          <select
                            value={stVal}
                            onChange={e => updateCell(st._id, day.dateStr, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.4rem',
                              borderRadius: 'var(--radius-sm)',
                              border: `1px solid ${borderColor}`,
                              background: bg,
                              color: 'var(--text-primary)',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              outline: 'none',
                              cursor: 'pointer',
                              appearance: 'none',
                              textAlign: 'center'
                            }}
                          >
                            <option value="">— اختر —</option>
                            <option value="present">✅ حاضر</option>
                            <option value="late">⏱️ متأخر</option>
                            <option value="absent">❌ غائب</option>
                          </select>
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center', background: 'rgba(239,68,68,0.03)' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 28, height: 28, borderRadius: '50%',
                        background: absencesCount > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(148,163,184,0.1)',
                        color: absencesCount > 0 ? 'var(--danger)' : 'var(--text-muted)',
                        fontWeight: 800, fontSize: '0.9rem'
                      }}>
                        {absencesCount}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {students.length > 0 && (
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button className="btn btn-primary btn-lg" onClick={handleSaveAll} disabled={saving}>
            <Save size={18} />
            {saving ? 'جاري الحفظ...' : 'حفظ سجل الحضور'}
          </button>
        </div>
      )}
    </div>
  );
}
