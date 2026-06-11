import { useState, useEffect, useMemo } from 'react';
import { Waves, Save, AlertCircle, Search, Square, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { halaqatAPI, studentsAPI } from '../services/api';

export default function SwimmingManagement() {
  const [halaqat, setHalaqat] = useState([]);
  const [students, setStudents] = useState([]);
  const [scheduledStudentIds, setScheduledStudentIds] = useState(new Set());
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // 1. تحميل الحلقات والطلاب عند التحميل
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const [hRes, sRes] = await Promise.all([
          halaqatAPI.getAll(),
          studentsAPI.getAll({ isActive: true })
        ]);
        setHalaqat(hRes.data.data || []);
        setStudents(sRes.data.data || []);
      } catch (err) {
        toast.error('فشل تحميل بيانات الطلاب أو الحلقات');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  // 2. تحميل معرفات الطلاب المعنيين بالسباحة عند تغيير التاريخ
  useEffect(() => {
    const fetchSchedules = async () => {
      if (!selectedDate) return;
      try {
        const res = await studentsAPI.getSwimming(selectedDate);
        setScheduledStudentIds(new Set(res.data.data.map(id => Number(id))));
      } catch (err) {
        toast.error('فشل تحميل جدول السباحة للتاريخ المحدد');
        console.error(err);
      }
    };
    fetchSchedules();
  }, [selectedDate]);

  // تقسيم الطلاب حسب الحلقات
  const studentsByHalaqa = useMemo(() => {
    const groups = {};
    
    halaqat.forEach(h => {
      groups[h._id] = {
        name: h.name,
        supervisor: h.supervisor || 'لا يوجد مشرف',
        students: []
      };
    });
    
    groups['unassigned'] = {
      name: 'غير محدد',
      supervisor: '—',
      students: []
    };

    students.forEach(st => {
      const hId = st.halaqaId?._id || st.halaqaId || 'unassigned';
      if (groups[hId]) {
        groups[hId].students.push(st);
      } else {
        groups['unassigned'].students.push(st);
      }
    });

    Object.keys(groups).forEach(key => {
      groups[key].students.sort((a, b) => a.name.localeCompare(b.name));
    });

    return groups;
  }, [students, halaqat]);

  // تفعيل/إلغاء تفعيل الطالب
  const toggleStudent = (studentId) => {
    setScheduledStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  // تفعيل/إلغاء تفعيل كافة طلاب الحلقة
  const toggleHalaqa = (halaqaId, selectAll) => {
    const hStudents = studentsByHalaqa[halaqaId]?.students || [];
    if (hStudents.length === 0) return;

    setScheduledStudentIds(prev => {
      const next = new Set(prev);
      hStudents.forEach(st => {
        if (selectAll) {
          next.add(st._id);
        } else {
          next.delete(st._id);
        }
      });
      return next;
    });
  };

  // حفظ التعديلات وإرسال الإشعارات
  const handleSave = async () => {
    setSaving(true);
    try {
      const studentIds = Array.from(scheduledStudentIds);
      await studentsAPI.saveSwimming({
        date: selectedDate,
        studentIds
      });
      toast.success('تم حفظ جدول السباحة وإرسال الإشعارات للآباء بنجاح ✅');
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء الحفظ');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // إعادة التوليد التلقائي حسب الإنجاز
  const handleAutoGenerate = async () => {
    if (!selectedDate) return;
    setLoading(true);
    try {
      const res = await studentsAPI.getSwimming(selectedDate, 'true');
      setScheduledStudentIds(new Set(res.data.data.map(id => Number(id))));
      toast.success('تمت إعادة حساب وتوليد قائمة السباحة تلقائياً بنجاح ✅');
    } catch (err) {
      toast.error('فشل توليد جدول السباحة تلقائياً');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // التحقق مما إذا كان التاريخ المحدد هو يوم سبت بدءاً من الأسبوع الثاني
  const isSelectedDateSaturday = useMemo(() => {
    if (!selectedDate) return false;
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.getDay() === 6 && selectedDate >= '2026-06-27';
  }, [selectedDate]);

  // تصفية الطلاب حسب اسم البحث
  const filteredStudentsByHalaqa = useMemo(() => {
    if (!search.trim()) return studentsByHalaqa;

    const filtered = {};
    const query = search.toLowerCase();

    Object.entries(studentsByHalaqa).forEach(([key, group]) => {
      const matchedStudents = group.students.filter(st =>
        st.name.toLowerCase().includes(query)
      );
      if (matchedStudents.length > 0) {
        filtered[key] = {
          ...group,
          students: matchedStudents
        };
      }
    });

    return filtered;
  }, [studentsByHalaqa, search]);

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon"><Waves size={20} /></div>
          جدول السباحة للطلبة
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {isSelectedDateSaturday && (
            <button
              className="btn btn-secondary"
              onClick={handleAutoGenerate}
              disabled={loading || !selectedDate}
              style={{ gap: '0.5rem', display: 'flex', alignItems: 'center' }}
            >
              <Waves size={16} />
              توليد تلقائي حسب الإنجاز
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !selectedDate}
            style={{ gap: '0.5rem', display: 'flex', alignItems: 'center' }}
          >
            <Save size={16} />
            {saving ? 'جاري الحفظ...' : 'حفظ الجدول وإرسال الإشعارات'}
          </button>
        </div>
      </div>

      {isSelectedDateSaturday && (
        <div style={{
          background: 'rgba(14, 165, 233, 0.1)',
          border: '1px solid rgba(14, 165, 233, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          marginBottom: '1.5rem',
          color: '#38bdf8',
          fontSize: '0.9rem',
          lineHeight: '1.6',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>توليد تلقائي نشط:</strong> هذا التاريخ يقع في يوم السبت (الأسبوع الثاني فما فوق). يتم تحديد الطلاب تلقائياً إذا حققوا المطلوب من السبت إلى الخميس: <strong>(القسط اليومي × 6 أيام)</strong>. استظهار السور يحتسب بنصف القسط اليومي. يمكنك التعديل يدوياً بالضغط على الطلاب ثم الحفظ.
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">اختر تاريخ حصة السباحة</label>
            <input
              type="date"
              className="form-control"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{ textAlign: 'center' }}
            />
          </div>

          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">بحث عن طالب</label>
            <div style={{ position: 'relative' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  right: '0.8rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                type="text"
                className="form-control"
                placeholder="اكتب اسم الطالب للبحث السريع..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingRight: '2.5rem' }}
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-wrap">
          <div className="spinner" />
          <span>جاري تحميل بيانات السباحة...</span>
        </div>
      ) : Object.keys(filteredStudentsByHalaqa).length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <AlertCircle size={48} />
            <h3>لا توجد نتائج</h3>
            <p>لم يتم العثور على طلبة يطابقون البحث</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {Object.entries(filteredStudentsByHalaqa).map(([halaqaId, group]) => {
            if (group.students.length === 0) return null;

            const allSelected = group.students.every(st => scheduledStudentIds.has(st._id));

            return (
              <div key={halaqaId} className="card" style={{ padding: '1.2rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border)',
                    paddingBottom: '0.8rem',
                    marginBottom: '1rem'
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--green-400)' }}>
                      حلقة {group.name}
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      المشرف: {group.supervisor}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => toggleHalaqa(halaqaId, !allSelected)}
                    >
                      {allSelected ? 'إلغاء تحديد الكل' : 'تحديد كل الحلقة'}
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '0.8rem'
                  }}
                >
                  {group.students.map(st => {
                    const isSelected = scheduledStudentIds.has(st._id);
                    return (
                      <div
                        key={st._id}
                        onClick={() => toggleStudent(st._id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.8rem',
                          padding: '0.8rem',
                          borderRadius: 'var(--radius-md)',
                          border: isSelected
                            ? '1px solid var(--green-500)'
                            : '1px solid var(--border)',
                          background: isSelected
                            ? 'rgba(34, 197, 94, 0.05)'
                            : 'rgba(255, 255, 255, 0.01)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          userSelect: 'none'
                        }}
                      >
                        <div style={{ color: isSelected ? 'var(--green-500)' : 'var(--text-muted)' }}>
                          {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{st.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {st.level === 'level1' ? 'المستوى الأول' : st.level === 'level2' ? 'المستوى الثاني' : st.level === 'level3' ? 'المستوى الثالث' : 'المستوى الرابع'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
