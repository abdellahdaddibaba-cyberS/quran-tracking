import { useState, useEffect, useMemo, useCallback } from 'react';
import { BookOpen, Save, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft, Trash2, TriangleAlert, Star, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { halaqatAPI, studentsAPI, trackingAPI } from '../services/api';
import { useSearchParams } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';
import { SURAHS } from '../utils/surahs';

function getWeekDays(dateInput) {
  // استخدام التوقيت المحلي بدلاً من UTC لتجنب مشاكل فارق التوقيت
  const [y, m, d] = dateInput.split('-');
  const date = new Date(y, m - 1, d);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const days = [];
  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  if (dateStr < '2026-06-20') {
    // الأسبوع الأول: الأحد إلى الخميس (5 أيام)
    const sunday = new Date(2026, 5, 14); // 14 June 2026
    for (let i = 0; i < 5; i++) {
      const current = new Date(sunday);
      current.setDate(sunday.getDate() + i);
      days.push({
        dateStr: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`,
        label: dayNames[current.getDay()],
        shortDate: current.toLocaleDateString('ar-DZ', { month: 'numeric', day: 'numeric' })
      });
    }
  } else {
    // الأسابيع الباقية: السبت إلى الخميس (6 أيام)
    const day = date.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
    const diffToSat = (day + 1) % 7;
    const saturday = new Date(date);
    saturday.setDate(date.getDate() - diffToSat);

    for (let i = 0; i < 6; i++) { // السبت إلى الخميس (6 أيام)
      const current = new Date(saturday);
      current.setDate(saturday.getDate() + i);
      days.push({
        dateStr: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`,
        label: dayNames[current.getDay()],
        shortDate: current.toLocaleDateString('ar-DZ', { month: 'numeric', day: 'numeric' })
      });
    }
  }
  return days;
}

export default function DailyInput() {
  const [searchParams] = useSearchParams();
  const initialHalaqa = searchParams.get('halaqaId') || '';

  const [halaqat, setHalaqat] = useState([]);
  const [selectedHalaqa, setSelectedHalaqa] = useState(initialHalaqa);

  // Date state
  const [baseDate, setBaseDate] = useState(() => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return today < '2026-06-14' ? '2026-06-14' : today;
  });
  const weekDays = useMemo(() => getWeekDays(baseDate), [baseDate]);

  const weekName = useMemo(() => {
    const [y, m, d] = baseDate.split('-');
    const current = new Date(y, m - 1, d);
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;

    let weekNum = 1;
    if (dateStr >= '2026-06-20') {
      const day = current.getDay();
      const diffToSat = (day + 1) % 7;
      const saturday = new Date(current);
      saturday.setDate(current.getDate() - diffToSat);

      const startW2 = new Date(2026, 5, 20); // 20 June 2026
      const diffDays = Math.floor((saturday - startW2) / (1000 * 60 * 60 * 24));
      weekNum = 2 + Math.floor(diffDays / 7);
    }

    const names = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
    return names[weekNum - 1] || String(weekNum);
  }, [baseDate]);

  const [students, setStudents] = useState([]);
  // matrix: { studentId: { dateStr: pagesMemorized } }
  const [matrix, setMatrix] = useState({});
  const [cumulativeTotals, setCumulativeTotals] = useState({}); // إجمالي تراكمي لكل طالب
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteDay, setDeleteDay] = useState(null); // { dateStr, label }

  /**
   * حساب عدد الحضور لكل يوم من خلال المصفوفة الحالية
   */
  const getAttendanceCount = useCallback((dateStr) => {
    let count = 0;
    Object.values(matrix).forEach(studentDays => {
      const dayData = studentDays[dateStr];
      // نعتبر الطالب حاضراً إذا تم اختيار 'present' أو إذا كان هناك حفظ صفحات ولم يتم تحديد الحالة كغائب
      if (dayData && (dayData.attendance === 'present' || (dayData.pages > 0 && dayData.attendance !== 'absent'))) {
        count++;
      }
    });
    return count;
  }, [matrix]);

  // جلب الحلقات عند التحميل
  useEffect(() => {
    halaqatAPI.getAll()
      .then(r => setHalaqat(r.data.data))
      .catch(() => toast.error('فشل تحميل الحلقات'));
  }, []);

  // جلب طلبة الحلقة وسجلاتهم للأسبوع المختار
  useEffect(() => {
    if (!selectedHalaqa) {
      setStudents([]);
      setMatrix({});
      setCumulativeTotals({});
      return;
    }

    const fetchWeekData = async () => {
      setLoading(true);
      try {
        const startDate = weekDays[0].dateStr;
        const endDate = weekDays[weekDays.length - 1].dateStr;

        const [studentsRes, trackingRes, cumRes] = await Promise.all([
          studentsAPI.getByHalaqa(selectedHalaqa),
          trackingAPI.getByHalaqa(selectedHalaqa, { startDate, endDate }),
          trackingAPI.getHalaqaCumulative(selectedHalaqa),
        ]);
        setCumulativeTotals(cumRes.data.data || {});

        const fetchedStudents = studentsRes.data.data;
        const fetchedTracking = trackingRes.data.data;

        setStudents(fetchedStudents);

        // بناء المصفوفة من السجلات القديمة إن وجدت
        const newMatrix = {};
        fetchedStudents.forEach(st => {
          newMatrix[st._id] = {};
          weekDays.forEach(day => {
            newMatrix[st._id][day.dateStr] = {
              pages: '',
              attendance: '',
              isLate: false,
              isSurahCompleted: false,
              currentSurah: ''
            };
          });
        });

        fetchedTracking.forEach(record => {
          const rd = new Date(record.date);
          const rDate = `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, '0')}-${String(rd.getDate()).padStart(2, '0')}`;
          if (newMatrix[record.studentId?._id || record.studentId]) {
            newMatrix[record.studentId?._id || record.studentId][rDate] = {
              pages: record.pagesMemorized,
              attendance: record.attendance || '',
              isLate: record.isLate || false,
              isSurahCompleted: record.isSurahCompleted || false,
              currentSurah: record.currentSurah || '',
              notes: record.notes || ''
            };
          }
        });

        setMatrix(newMatrix);
        setSaved(false);
      } catch (err) {
        toast.error('فشل تحميل بيانات الأسبوع');
      } finally {
        setLoading(false);
      }
    };

    fetchWeekData();
  }, [selectedHalaqa, baseDate, weekDays]);

  const updateCell = (studentId, dateStr, field, value) => {
    setMatrix(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [dateStr]: {
          ...prev[studentId][dateStr],
          [field]: value
        }
      }
    }));
  };

  const handleKeyDown = (e, rowIdx, colIdx) => {
    let nextRow = rowIdx;
    let nextCol = colIdx;

    if (e.key === 'Enter') {
      e.preventDefault();
      nextRow = rowIdx + 1;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextCol = colIdx + 1; // في الواجهة العربية، اليسار يعني العمود التالي
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextCol = colIdx - 1; // في الواجهة العربية، اليمين يعني العمود السابق
    }
    // ArrowUp / ArrowDown: let the browser handle number increment/decrement naturally

    if (nextRow !== rowIdx || nextCol !== colIdx) {
      const nextInput = document.getElementById(`cell-${nextRow}-${nextCol}`);
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  };

  const shiftWeek = (offset) => {
    const [y, m, d] = baseDate.split('-');
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + offset * 7);
    let newDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

    // منع العودة إلى ما قبل بدء الدورة (14 جوان 2026)
    if (newDate < '2026-06-14') {
      newDate = '2026-06-14';
    }

    setBaseDate(newDate);
  };

  const handleDeleteDay = async (dateStr, label) => {
    setDeleteDay({ dateStr, label });
  };

  const confirmDelete = async () => {
    if (!deleteDay) return;
    const { dateStr, label } = deleteDay;
    setDeleteDay(null);
    try {
      await trackingAPI.deleteHalaqaDay(selectedHalaqa, dateStr);
      toast.success(`تم مسح بيانات يوم ${label} بنجاح`);
      setMatrix(prev => {
        const newMatrix = JSON.parse(JSON.stringify(prev));
        Object.keys(newMatrix).forEach(studentId => {
          if (newMatrix[studentId]) {
            newMatrix[studentId][dateStr] = { pages: '', attendance: '', isLate: false };
          }
        });
        return newMatrix;
      });
    } catch (err) {
      toast.error('حدث خطأ أثناء مسح البيانات');
    }
  };

  // ─── معالجة التقدم في السور ────────────────────────────────────
  const handleAdvanceSurah = useCallback(async (studentId, studentName, currentSurahVal) => {
    // إيجاد السورة الحالية وحساب التالية
    const normalizeAr = (str) =>
      (str || '')
        .replace(/^سوره?\s+/, '')
        .replace(/[أإآا]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u065F\u0670ـ]/g, '')
        .replace(/^ال/, '')
        .trim();

    const normSurahs = SURAHS.map(normalizeAr);
    const currentIdx = normSurahs.indexOf(normalizeAr(currentSurahVal || ''));

    let nextSurah;
    if (currentIdx === -1) {
      // إذا لم تكن هناك سورة، نبدأ من سورة الناس كبداية تلقائية (الترتيب التصاعدي من قصار السور)
      nextSurah = SURAHS[SURAHS.length - 1];
    } else {
      const nextIdx = currentIdx - 1;
      if (nextIdx < 0) {
        toast.success(`🎉 ${studentName} أتمَّ القرآن الكريم كاملاً!`, { duration: 6000 });
        return;
      }
      nextSurah = SURAHS[nextIdx];
    }

    try {
      await studentsAPI.update(studentId, { currentSurah: nextSurah });
      // تحديث الحالة المحلية للطلاب
      setStudents(prev =>
        prev.map(st =>
          st._id === studentId ? { ...st, currentSurah: nextSurah } : st
        )
      );
      toast.success(
        `📖 ${studentName} — انتقلت السورة الحالية إلى: سورة ${nextSurah}`,
        { duration: 4000 }
      );
    } catch {
      toast.error('فشل تحديث السورة الحالية للطالب');
    }
  }, []);

  const handleSelectSurah = useCallback(async (studentId, studentName, selectedSurah) => {
    try {
      await studentsAPI.update(studentId, { currentSurah: selectedSurah });
      setStudents(prev =>
        prev.map(st =>
          st._id === studentId ? { ...st, currentSurah: selectedSurah } : st
        )
      );
      toast.success(
        `📖 ${studentName} — تم تغيير السورة الحالية إلى: سورة ${selectedSurah}`,
        { duration: 4000 }
      );
    } catch {
      toast.error('فشل تحديث السورة الحالية للطالب');
    }
  }, []);

  // حفظ كل السجلات دفعة واحدة
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const records = [];
      students.forEach(st => {
        weekDays.forEach(day => {
          const cellData = matrix[st._id]?.[day.dateStr];
          if (cellData && (cellData.pages !== '' || cellData.attendance === 'absent' || cellData.isLate || cellData.isSurahCompleted)) {
            records.push({
              studentId: st._id,
              date: day.dateStr,
              pagesRequired: st.dailyTarget,
              pagesMemorized: cellData.attendance === 'absent' ? 0 : parseFloat(cellData.pages || 0),
              attendance: cellData.attendance,
              isLate: cellData.isLate,
              isSurahCompleted: cellData.isSurahCompleted || false,
              currentSurah: cellData.currentSurah || '',
              notes: cellData.notes || ''
            });
          }
        });
      });

      if (records.length === 0) {
        toast.error('لا يوجد أي بيانات للحفظ!');
        setSaving(false);
        return;
      }

      const res = await trackingAPI.bulkInsert(records);
      const notif = res.data?.data?.notifications;
      if (notif?.sent > 0) {
        toast.success(`تم حفظ ${records.length} سجل وإرسال ${notif.sent} إشعار ✅`);
      } else if (notif?.skipped?.length > 0) {
        toast.success(`تم حفظ ${records.length} سجل ✅`, { duration: 4000 });
        toast('لم يُرسل إشعار — ولي الأمر لم يسجّل الدخول من الهاتف بعد', { icon: '⚠️', duration: 6000 });
      } else {
        toast.success(`تم حفظ ${records.length} سجل بنجاح ✅`);
      }
      setSaved(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>

      {/* ─── نافذة تأكيد الحذف الجميلة ─────────────────────────── */}
      <ConfirmModal
        isOpen={!!deleteDay}
        title="تأكيد مسح بيانات اليوم"
        message={deleteDay ? `هل أنت متأكد أنك تريد مسح جميع بيانات يوم ${deleteDay.label} (${deleteDay.dateStr}) لجميع طلبة هذه الحلقة؟ لا يمكن التراجع عن هذا الإجراء.` : ''}
        confirmText="نعم، امسح البيانات"
        onConfirm={confirmDelete}
        onClose={() => setDeleteDay(null)}
      />

      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon"><BookOpen size={20} /></div>
          التحصيل اليومي
        </div>
        {students.length > 0 && (
          <button
            className="btn btn-primary btn-lg"
            onClick={handleSaveAll}
            disabled={saving}
          >
            <Save size={18} />
            {saving ? 'جاري الحفظ...' : `حفظ بيانات الأسبوع`}
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label className="form-label">أسبوع يبدأ من ({weekDays[0]?.label || 'الأحد'}) — <span style={{ color: 'var(--green-500)', fontWeight: 'bold' }}>الأسبوع {weekName}</span></label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', maxWidth: '400px' }}>
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

        <div style={{ marginBottom: '0.5rem' }}>
          <label className="form-label">اختر الحلقة</label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '1rem',
            marginTop: '0.5rem'
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
        </div>
      </div>

      {/* ─── Success Banner ─────────────────────────────────────── */}
      {saved && (
        <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>
          <CheckCircle2 size={18} />
          تم حفظ جدول الأسبوع بنجاح!
        </div>
      )}

      {/* ─── Table ─────────────────────────────────────────────── */}
      {!selectedHalaqa ? (
        <div className="card">
          <div className="empty-state">
            <BookOpen size={48} />
            <h3>اختر الحلقة أولاً</h3>
            <p>حدد الحلقة لبدء إدخال التحصيل اليومي</p>
          </div>
        </div>
      ) : loading ? (
        <div className="loading-wrap"><div className="spinner" /><span>جاري تحميل بيانات الأسبوع...</span></div>
      ) : students.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <AlertCircle size={48} />
            <h3>لا يوجد طلبة في هذه الحلقة</h3>
            <p>أضف طلبة للحلقة أولاً من صفحة إدارة الطلبة</p>
          </div>
        </div>
      ) : (
        <div className="table-wrapper daily-table">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>اسم الطالب</th>
                <th style={{ textAlign: 'center', width: 80 }}>القسط</th>
                {weekDays.map(day => {
                  const attendanceCount = getAttendanceCount(day.dateStr);
                  return (
                    <th key={day.dateStr} style={{ textAlign: 'center', minWidth: 90 }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{day.label}</div>
                      <div style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                        {day.shortDate}
                        <button
                          onClick={() => handleDeleteDay(day.dateStr, day.label)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0, opacity: 0.8 }}
                          title="مسح بيانات هذا اليوم"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div style={{
                        marginTop: '4px',
                        fontSize: '0.75rem',
                        color: 'var(--green-400)',
                        fontWeight: 800,
                        background: 'rgba(34, 197, 94, 0.12)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '2px 6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}>
                        <UserCheck size={12} />
                        {attendanceCount}
                      </div>
                    </th>
                  );
                })}
                <th style={{ textAlign: 'center', minWidth: 100, background: 'rgba(34,197,94,0.08)', borderRight: '2px solid rgba(34,197,94,0.2)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>هذا الأسبوع</div>
                  <div>المجموع</div>
                </th>
                <th style={{ textAlign: 'center', minWidth: 120, background: 'rgba(99,102,241,0.08)', borderRight: '2px solid rgba(99,102,241,0.2)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(129,140,248,0.8)' }}>جميع الأسابيع</div>
                  <div style={{ color: '#818cf8' }}>الإجمالي الكلي</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map((st, idx) => {
                // حساب مجموع الأسبوع الحالي مباشرة من المدخلات
                const weekSum = weekDays.reduce((sum, day) => {
                  const c = matrix[st._id]?.[day.dateStr];
                  return sum + (c && c.pages !== '' && c.attendance !== 'absent' ? Number(c.pages || 0) : 0);
                }, 0);
                const weekReq = st.dailyTarget * weekDays.length;
                const weekPct = weekReq > 0 ? Math.round((weekSum / weekReq) * 100) : 0;
                const weekColor = weekPct >= 80 ? 'var(--green-400)' : weekPct >= 50 ? 'var(--gold-400)' : 'var(--danger)';
                const cumTotal = Number(cumulativeTotals[st._id] || 0);
                return (
                  <tr key={st._id}>
                    <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{st.name}</span>
                        {/* عرض السورة الحالية كشارة قابلة للضغط للتقدم */}
                        <button
                          onClick={() => handleAdvanceSurah(st._id, st.name, st.currentSurah || st.startSurah)}
                          title="اضغط للانتقال إلى السورة التالية تصاعدياً"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(99,102,241,0.12)',
                            border: '1px solid rgba(99,102,241,0.25)',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            alignSelf: 'flex-start',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            outline: 'none'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(99,102,241,0.28)';
                            e.currentTarget.style.borderColor = 'rgba(99,102,241,0.55)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(99,102,241,0.12)';
                            e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)';
                          }}
                        >
                          <span style={{ fontSize: '0.7rem', color: 'rgba(129,140,248,0.7)' }}>📖</span>
                          <span style={{
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            color: '#a5b4fc',
                            whiteSpace: 'nowrap'
                          }}>
                            {st.currentSurah || st.startSurah || 'غير محدد'}
                          </span>
                          <span style={{ fontSize: '0.6rem', color: 'rgba(129,140,248,0.5)', marginRight: '2px' }}>↑</span>
                        </button>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'rgba(34,197,94,0.12)', color: 'var(--green-400)',
                        fontWeight: 800, fontSize: '0.8rem'
                      }}>
                        {st.dailyTarget}
                      </span>
                    </td>
                    {weekDays.map((day, colIdx) => {
                      const cellData = matrix[st._id]?.[day.dateStr] || { pages: '', attendance: '', isLate: false };
                      const val = cellData.pages;
                      const entered = val !== '';
                      const success = entered && Number(val) >= st.dailyTarget;
                      const zero = (entered && Number(val) === 0) || cellData.attendance === 'absent';

                      return (
                        <td key={day.dateStr} style={{ textAlign: 'center', verticalAlign: 'top', paddingTop: '0.5rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <input
                              id={`cell-${idx}-${colIdx}`}
                              className="matrix-input"
                              type="number"
                              min="0"
                              max="50"
                              step="0.5"
                              placeholder="-"
                              value={cellData.attendance === 'absent' ? '0' : val}
                              disabled={cellData.attendance === 'absent'}
                              onChange={e => updateCell(st._id, day.dateStr, 'pages', e.target.value)}
                              onKeyDown={e => handleKeyDown(e, idx, colIdx)}
                              style={{
                                borderColor: (success || cellData.isSurahCompleted) ? 'var(--green-500)' : zero ? 'var(--danger)' : 'var(--border)',
                                backgroundColor: cellData.attendance === 'absent' ? 'rgba(239,68,68,0.15)' : (success || cellData.isSurahCompleted) ? 'var(--green-600)' : zero ? 'rgba(239,68,68,0.1)' : 'var(--bg-primary)',
                                color: (success || cellData.isSurahCompleted) ? '#fff' : 'var(--text-primary)',
                                boxShadow: (success || cellData.isSurahCompleted) ? '0 0 10px rgba(34,197,94,0.3)' : ''
                              }}
                            />
                            <button
                              onClick={() => {
                                const nextVal = !cellData.isSurahCompleted;
                                updateCell(st._id, day.dateStr, 'isSurahCompleted', nextVal);
                                if (nextVal) {
                                  updateCell(st._id, day.dateStr, 'currentSurah', st.currentSurah || st.startSurah || '');
                                  handleAdvanceSurah(st._id, st.name, st.currentSurah || st.startSurah);
                                } else {
                                  updateCell(st._id, day.dateStr, 'currentSurah', '');
                                }
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: cellData.isSurahCompleted ? 'var(--gold-400)' : 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: 0,
                                opacity: cellData.isSurahCompleted ? 1 : 0.3,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px',
                                fontSize: '0.65rem'
                              }}
                              title="أتم السورة (يحسب كإنجاز كامل)"
                            >
                              <Star size={12} fill={cellData.isSurahCompleted ? 'currentColor' : 'none'} />
                              سورة
                            </button>

                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => {
                                  const isAbsent = cellData.attendance === 'absent';
                                  updateCell(st._id, day.dateStr, 'attendance', isAbsent ? 'present' : 'absent');
                                  if (!isAbsent) {
                                    updateCell(st._id, day.dateStr, 'pages', '0');
                                  }
                                }}
                                style={{
                                  background: cellData.attendance === 'absent' ? 'rgba(239,68,68,0.2)' : 'none',
                                  border: '1px solid ' + (cellData.attendance === 'absent' ? 'var(--danger)' : 'rgba(255,255,255,0.1)'),
                                  color: cellData.attendance === 'absent' ? 'var(--danger)' : 'var(--text-muted)',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  padding: '2px 6px',
                                  fontSize: '0.6rem',
                                  fontWeight: 'bold'
                                }}
                                title={cellData.attendance === 'absent' ? 'إلغاء الغياب' : 'تسجيل غياب'}
                              >
                                غ
                              </button>
                              <button
                                onClick={() => updateCell(st._id, day.dateStr, 'isLate', !cellData.isLate)}
                                style={{
                                  background: cellData.isLate ? 'rgba(234,179,8,0.2)' : 'none',
                                  border: '1px solid ' + (cellData.isLate ? 'var(--gold-400)' : 'rgba(255,255,255,0.1)'),
                                  color: cellData.isLate ? 'var(--gold-400)' : 'var(--text-muted)',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  padding: '2px 6px',
                                  fontSize: '0.6rem',
                                  fontWeight: 'bold'
                                }}
                                title={cellData.isLate ? 'إلغاء التأخر' : 'تسجيل تأخر'}
                              >
                                ت
                              </button>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    {/* عمود مجموع الأسبوع */}
                    <td style={{ textAlign: 'center', background: 'rgba(34,197,94,0.04)', padding: '0.5rem', borderRight: '2px solid rgba(34,197,94,0.15)', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <span style={{ fontWeight: 900, fontSize: '1.1rem', color: weekColor }}>{weekSum}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', borderRadius: 999, padding: '1px 6px' }}>{weekPct}%</span>
                      </div>
                    </td>
                    {/* عمود الإجمالي التراكمي */}
                    <td style={{ textAlign: 'center', background: 'rgba(99,102,241,0.04)', padding: '0.5rem', borderRight: '2px solid rgba(99,102,241,0.15)', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#818cf8' }}>{cumTotal}</span>
                        <span style={{ fontSize: '0.65rem', color: 'rgba(129,140,248,0.7)', background: 'rgba(99,102,241,0.12)', borderRadius: 999, padding: '1px 7px', fontWeight: 600 }}>صفحة</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* ─── صف المجاميع اليومية ─── */}
            <tfoot>
              <tr style={{ background: 'rgba(34,197,94,0.06)', borderTop: '2px solid var(--border-green)' }}>
                <td colSpan={2} style={{ padding: '0.75rem 1rem', fontWeight: 800, color: 'var(--green-400)', fontSize: '0.85rem' }}>
                  إجمالي الحلقة
                </td>
                <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(34,197,94,0.15)', color: 'var(--green-400)', borderRadius: 'var(--radius-sm)', padding: '2px 10px', fontWeight: 800, fontSize: '0.85rem' }}>
                    {students.reduce((sum, st) => sum + (st.dailyTarget || 0), 0)}
                  </span>
                </td>
                {weekDays.map(day => {
                  const total = students.reduce((sum, st) => {
                    const c = matrix[st._id]?.[day.dateStr];
                    return sum + (c && c.pages !== '' && c.pages !== undefined && c.attendance !== 'absent' ? Number(c.pages) : 0);
                  }, 0);
                  const required = students.reduce((sum, st) => sum + (st.dailyTarget || 0), 0);
                  const hasData = students.some(st => { const c = matrix[st._id]?.[day.dateStr]; return c && (c.pages !== '' || c.attendance === 'absent' || c.isLate); });
                  const pct = required > 0 ? Math.round((total / required) * 100) : 0;
                  const pctColor = pct >= 80 ? 'var(--green-400)' : pct >= 50 ? 'var(--gold-400)' : 'var(--danger)';
                  return (
                    <td key={day.dateStr} style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                      {hasData ? (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                        <span style={{ fontWeight: 800, fontSize: '1rem', color: pctColor }}>{total}</span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', borderRadius: 999, padding: '1px 6px' }}>{pct}%</span>
                      </div>) : (<span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>)}
                    </td>
                  );
                })}
                {/* مجموع الأسبوع الكلي للحلقة */}
                <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem', background: 'rgba(34,197,94,0.08)', borderRight: '2px solid rgba(34,197,94,0.2)' }}>
                  {(() => {
                    const g = students.reduce((s, st) => s + weekDays.reduce((d, day) => { const c = matrix[st._id]?.[day.dateStr]; return d + (c && c.pages !== '' && c.attendance !== 'absent' ? Number(c.pages || 0) : 0); }, 0), 0);
                    const gReq = students.reduce((s, st) => s + st.dailyTarget * weekDays.length, 0);
                    const gPct = gReq > 0 ? Math.round((g / gReq) * 100) : 0;
                    return (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontWeight: 900, fontSize: '1.1rem', color: gPct >= 80 ? 'var(--green-400)' : gPct >= 50 ? 'var(--gold-400)' : 'var(--danger)' }}>{g}</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', borderRadius: 999, padding: '1px 6px' }}>{gPct}%</span>
                    </div>);
                  })()}
                </td>
                {/* الإجمالي التراكمي الكلي للحلقة */}
                <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem', background: 'rgba(99,102,241,0.12)', borderRight: '2px solid rgba(99,102,241,0.3)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontWeight: 900, fontSize: '1.15rem', color: '#818cf8' }}>
                      {students.reduce((s, st) => s + Number(cumulativeTotals[st._id] || 0), 0)}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'rgba(129,140,248,0.8)', background: 'rgba(99,102,241,0.15)', borderRadius: 999, padding: '1px 7px', fontWeight: 700 }}>إجمالي الحلقة</span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ─── Save Button (Bottom) ────────────────────────────────── */}
      {students.length > 0 && (
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleSaveAll}
            disabled={saving}
          >
            <Save size={18} />
            {saving ? 'جاري الحفظ...' : 'حفظ بيانات الأسبوع'}
          </button>
        </div>
      )}
    </div>
  );
}
