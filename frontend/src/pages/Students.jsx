import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Users, X, Search, UploadCloud, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { studentsAPI, halaqatAPI, usersAPI, trackingAPI } from '../services/api';
import ConfirmModal from '../components/ConfirmModal';
import { SURAHS } from '../utils/surahs';

const LEVELS = [
  { value: 'level1', label: 'الأول' },
  { value: 'level2', label: 'الثاني' },
  { value: 'level3', label: 'الثالث' },
  { value: 'level4', label: 'الرابع' },
];

const levelLabel = (v) => LEVELS.find(l => l.value === v)?.label || v;
const levelClass = (v) => {
  if (v === 'level4') return 'badge-green';
  if (v === 'level3') return 'badge-gold';
  if (v === 'level2') return 'badge-blue';
  return 'badge-gray';
};

// ─── Student Modal ────────────────────────────────────────────────
function StudentModal({ student, halaqat, parents, onClose, onSave }) {
  const [form, setForm] = useState({
    name: student?.name || '',
    level: student?.level || 'level1',
    startSurah: student?.startSurah || '',
    currentSurah: student?.currentSurah || student?.startSurah || '',
    dailyTarget: student?.dailyTarget || 1,
    halaqaId: student?.halaqaId?._id || student?.halaqaId || '',
    parentId: student?.parentId?._id || student?.parentId || '',
    parentName: '',
    parentPhone: '',
  });
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [suggestionField, setSuggestionField] = useState('');

  const set = (k, v) => {
    setForm(p => {
      const updated = { ...p, [k]: v };
      if (k === 'startSurah' && !student) {
        updated.currentSurah = v;
      }
      return updated;
    });

    // منطق الاقتراحات عند كتابة السورة
    if (k === 'startSurah' || k === 'currentSurah') {
      setSuggestionField(k);
      setSelectedIndex(-1);
      if (v.trim().length > 0) {
        const filtered = SURAHS.filter(s => s.includes(v)).slice(0, 5);
        setSuggestions(filtered);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0) {
        e.preventDefault();
        set(suggestionField, suggestions[selectedIndex]);
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.startSurah || !form.halaqaId) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.currentSurah) {
        payload.currentSurah = payload.startSurah;
      }
      if (payload.parentId) {
        delete payload.parentName;
        delete payload.parentPhone;
      }
      if (student) {
        await studentsAPI.update(student._id, payload);
        toast.success('تم تعديل بيانات الطالب ✅');
      } else {
        await studentsAPI.create(payload);
        toast.success('تم إضافة الطالب بنجاح ✅');
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{student ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">الاسم *</label>
                <input className="form-control" placeholder="اسم الطالب" value={form.name}
                  onChange={e => set('name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">المستوى</label>
                <select className="form-control" value={form.level} onChange={e => set('level', e.target.value)}>
                  {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">بداية السورة *</label>
                <input
                  className="form-control"
                  placeholder="مثال: البقرة"
                  value={form.startSurah}
                  autoComplete="off"
                  onChange={e => set('startSurah', e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onFocus={() => {
                    setSuggestionField('startSurah');
                    if (form.startSurah) setSuggestions(SURAHS.filter(s => s.includes(form.startSurah)).slice(0, 5));
                  }}
                />

                {showSuggestions && suggestionField === 'startSurah' && suggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', marginTop: '4px',
                    boxShadow: 'var(--shadow-lg)',
                    overflow: 'hidden', animation: 'fadeInDown 0.2s ease-out'
                  }}>
                    {suggestions.map((s, index) => (
                      <div
                        key={s}
                        style={{
                          padding: '0.6rem 1rem', cursor: 'pointer',
                          fontSize: '0.85rem', color: 'var(--text-primary)',
                          background: index === selectedIndex ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                          transition: 'background 0.2s', borderBottom: '1px solid var(--border)'
                        }}
                        onMouseEnter={() => setSelectedIndex(index)}
                        onClick={() => {
                          set('startSurah', s);
                          setShowSuggestions(false);
                        }}
                      >
                        سورة {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">السورة الحالية</label>
                <input
                  className="form-control"
                  placeholder="تلقائياً نفس البداية"
                  value={form.currentSurah}
                  autoComplete="off"
                  onChange={e => set('currentSurah', e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onFocus={() => {
                    setSuggestionField('currentSurah');
                    if (form.currentSurah) setSuggestions(SURAHS.filter(s => s.includes(form.currentSurah)).slice(0, 5));
                  }}
                />

                {showSuggestions && suggestionField === 'currentSurah' && suggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', marginTop: '4px',
                    boxShadow: 'var(--shadow-lg)',
                    overflow: 'hidden', animation: 'fadeInDown 0.2s ease-out'
                  }}>
                    {suggestions.map((s, index) => (
                      <div
                        key={s}
                        style={{
                          padding: '0.6rem 1rem', cursor: 'pointer',
                          fontSize: '0.85rem', color: 'var(--text-primary)',
                          background: index === selectedIndex ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                          transition: 'background 0.2s', borderBottom: '1px solid var(--border)'
                        }}
                        onMouseEnter={() => setSelectedIndex(index)}
                        onClick={() => {
                          set('currentSurah', s);
                          setShowSuggestions(false);
                        }}
                      >
                        سورة {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <style>{`
              @keyframes fadeInDown {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">القسط اليومي (صفحات) *</label>
                <input className="form-control" type="number" min="0.1" step="0.1" value={form.dailyTarget}
                  onChange={e => set('dailyTarget', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">الحلقة *</label>
                <select className="form-control" value={form.halaqaId} onChange={e => set('halaqaId', e.target.value)}>
                  <option value="">اختر الحلقة</option>
                  {halaqat.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">ولي الأمر</label>
                <select className="form-control" value={form.parentId} onChange={e => set('parentId', e.target.value)}>
                  <option value="">اختر ولي الأمر (اختياري)</option>
                  {parents.map(p => <option key={p._id} value={p._id}>{p.fullName}</option>)}
                </select>
              </div>
            </div>

            {!form.parentId && (
              <div className="form-row animate-fade-in" style={{ marginTop: '1rem', borderTop: '1px dashed var(--border)', paddingTop: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">الاسم الكامل للاب (لإنشاء الحساب)</label>
                  <input className="form-control" placeholder="اسم الأب الكامل" value={form.parentName}
                    onChange={e => set('parentName', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">رقم الهاتف للاب (اسم المستخدم)</label>
                  <input className="form-control" placeholder="مثال: 0666112233" value={form.parentPhone}
                    onChange={e => set('parentPhone', e.target.value)} />
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>إلغاء</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'جاري الحفظ...' : (student ? 'حفظ التعديلات' : 'إضافة الطالب')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// دالة لتطهير ومقارنة النصوص العربية بشكل مرن
const normalizeArabicKey = (str) => {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/^سوره?\s+/, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/^ال/, '')
    .replace(/\s+/g, '');
};

// دالة لجلب القيمة من السطر بناءً على المفاتيح المحتملة بشكل مرن وذكي
const getExcelValue = (row, possibleKeys, type) => {
  const normalizedPossibles = possibleKeys.map(normalizeArabicKey);
  for (const key of Object.keys(row)) {
    const normKey = normalizeArabicKey(key);

    // فحص الفئة لضمان عدم الخلط بين اسم الطالب واسم الأب
    if (type === 'studentName') {
      if (normKey.includes('اب') || normKey.includes('أب') || normKey.includes('ولي') || normKey.includes('والد')) {
        continue;
      }
    } else if (type === 'parentName') {
      if (!normKey.includes('اب') && !normKey.includes('أب') && !normKey.includes('ولي') && !normKey.includes('والد')) {
        continue;
      }
    } else if (type === 'phone') {
      if (!normKey.includes('هاتف') && !normKey.includes('جوال') && !normKey.includes('رقم')) {
        continue;
      }
    }

    // مطابقة كاملة أو جزئية
    for (const pKey of normalizedPossibles) {
      if (normKey === pKey || normKey.includes(pKey) || pKey.includes(normKey)) {
        return row[key];
      }
    }
  }
  return '';
};

// ─── Excel Import Modal ────────────────────────────────────────────────
function ExcelImportModal({ halaqat, parents, onClose, onSave }) {
  const [selectedHalaqa, setSelectedHalaqa] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleImport = async (e) => {
    e.preventDefault();
    if (!selectedHalaqa || !file) {
      toast.error('يرجى اختيار الحلقة ورفع الملف');
      return;
    }

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws);

        if (rows.length === 0) {
          toast.error('الملف فارغ');
          setLoading(false);
          return;
        }

        const students = rows.map((row) => {
          const name = String(getExcelValue(row, ['الاسم الكامل', 'الاسم', 'اسم الطالب', 'الطالب'], 'studentName') || '').trim();
          const startSurah = String(getExcelValue(row, ['بداية السورة', 'السورة', 'سورة البداية']) || '').trim();
          const dailyTargetStr = getExcelValue(row, ['القسط', 'القسط اليومي', 'الصفحات', 'عدد الصفحات', 'المقدار']);
          const dailyTarget = dailyTargetStr ? Number(dailyTargetStr) : 3;

          let levelStr = String(getExcelValue(row, ['المستوى', 'مستوى']) || 'الأول');
          let level = 'level1';
          if (levelStr.includes('ثاني') || levelStr === '2') level = 'level2';
          else if (levelStr.includes('ثالع') || levelStr.includes('ثالث') || levelStr === '3') level = 'level3';
          else if (levelStr.includes('رابع') || levelStr === '4') level = 'level4';

          const parentName = String(getExcelValue(row, ['الاسم الكامل للاب', 'الاسم الكامل للأب', 'الاب', 'الأب', 'ولي الامر', 'ولي الأمر', 'اسم الاب', 'اسم ولي الامر', 'اسم ولي الأمر', 'الوالد', 'اسم الوالد'], 'parentName') || '').trim();
          const parentPhone = String(getExcelValue(row, ['رقم الهاتف', 'هاتف ولي الأمر', 'هاتف ولي الامر', 'هاتف الاب', 'هاتف الأب', 'رقم هاتف ولي الامر', 'رقم هاتف ولي الأمر', 'الهاتف', 'رقم هاتف الاب', 'رقم هاتف الأب', 'جوال ولي الامر', 'جوال ولي الأمر', 'الجوال', 'رقم الجوال'], 'phone') || '').trim();

          let parentId = null;
          if (parentName || parentPhone) {
            const matchedParent = parents.find(p => {
              const normPPhone = p.phoneNumber ? p.phoneNumber.replace(/[^\d]/g, '') : '';
              const normPUsername = p.username ? p.username.replace(/[^\d]/g, '') : '';
              const normImportPhone = parentPhone ? parentPhone.replace(/[^\d]/g, '') : '';

              const phoneMatch = normImportPhone && (normPPhone === normImportPhone || normPUsername === normImportPhone);
              const fullNameMatch = parentName && normalizeArabicKey(p.fullName) === normalizeArabicKey(parentName);

              return phoneMatch || fullNameMatch;
            });
            if (matchedParent) {
              parentId = matchedParent._id;
            }
          }

          return {
            name: name,
            level: level,
            startSurah: startSurah,
            dailyTarget: dailyTarget,
            halaqaId: selectedHalaqa,
            parentId: parentId,
            parentName: parentName || undefined,
            parentPhone: parentPhone || undefined
          };
        }).filter(s => s.name && s.startSurah);

        if (students.length === 0) {
          toast.error('لم يتم العثور على بيانات صحيحة في الملف. تأكد من العناوين (الاسم الكامل، بداية السورة)');
          setLoading(false);
          return;
        }

        const res = await studentsAPI.createBulk({ students });
        const parentsCreatedCount = res.data.parentsCreated || 0;

        if (parentsCreatedCount > 0) {
          toast.success(`تم استيراد ${res.data.count} طالب بنجاح ✅\n(تم إنشاء ${parentsCreatedCount} حسابات أولياء أمور تلقائياً بكلمة مرور افتراضية: 123456)`, { duration: 8000 });
        } else {
          toast.success(`تم استيراد ${res.data.count} طالب بنجاح ✅`);
        }
        onSave();
      } catch (err) {
        console.error(err);
        toast.error(err.response?.data?.message || 'حدث خطأ أثناء الاستيراد');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">استيراد من إكسل</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleImport}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">إلى الحلقة *</label>
              <select className="form-control" value={selectedHalaqa} onChange={e => setSelectedHalaqa(e.target.value)}>
                <option value="">اختر الحلقة التي سيتم استيراد الطلبة إليها</option>
                {halaqat.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">ملف الإكسل (.xlsx) *</label>
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '1.5rem', border: '2px dashed var(--border)', borderRadius: 'var(--radius-md)',
                cursor: 'pointer', background: 'rgba(0,0,0,0.2)', transition: 'all 0.2s ease',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--blue-500)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <UploadCloud size={32} color="var(--blue-400)" style={{ marginBottom: '0.5rem' }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
                  {file ? file.name : 'اضغط هنا لاختيار ملف الإكسل'}
                </span>
                <input type="file" style={{ display: 'none' }} accept=".xlsx, .xls" onChange={e => setFile(e.target.files[0])} />
              </label>
            </div>
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--blue-400)', lineHeight: '1.6' }}>
              <strong>أعمدة الإكسل (في الصف الأول):</strong><br />
              - <code>الاسم الكامل</code> (إجباري)<br />
              - <code>بداية السورة</code> (إجباري)<br />
              - <code>القسط</code> (اختياري - افتراضياً: 3)<br />
              - <code>المستوى</code> (اختياري - افتراضياً: الأول)<br />
              - <code>الاسم الكامل للاب</code> (إجباري لإنشاء الحساب)<br />
              - <code>رقم الهاتف</code> أو <code>هاتف ولي الأمر</code> (اختياري - لرقم هاتف ولي الأمر واسم المستخدم الخاص به)
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>إلغاء</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'جاري الاستيراد...' : 'بدء الاستيراد'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Helper Functions for Weekly Summary ───────────────────────────
const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function getWeekDays(dateInput) {
  const [y, m, d] = dateInput.split('-');
  const date = new Date(y, m - 1, d);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const days = [];
  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  if (dateStr < '2026-06-20') {
    const sunday = new Date(2026, 5, 14);
    for (let i = 0; i < 5; i++) {
      const current = new Date(sunday);
      current.setDate(sunday.getDate() + i);
      days.push({
        dateStr: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`,
        label: dayNames[current.getDay()],
        shortDate: current.toLocaleDateString('ar-DZ', { month: 'numeric', day: 'numeric' }),
      });
    }
  } else {
    const day = date.getDay();
    const diffToSat = (day + 1) % 7;
    const saturday = new Date(date);
    saturday.setDate(date.getDate() - diffToSat);

    for (let i = 0; i < 6; i++) {
      const current = new Date(saturday);
      current.setDate(saturday.getDate() + i);
      days.push({
        dateStr: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`,
        label: dayNames[current.getDay()],
        shortDate: current.toLocaleDateString('ar-DZ', { month: 'numeric', day: 'numeric' }),
      });
    }
  }
  return days;
}

// ─── Students Page ────────────────────────────────────────────────
export default function Students() {
  const [students, setStudents] = useState([]);
  const [halaqat, setHalaqat] = useState([]);
  const [parents, setParents] = useState([]);
  const [weeklyTracking, setWeeklyTracking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [search, setSearch] = useState('');
  const [searchParams] = useSearchParams();
  const initialHalaqa = searchParams.get('halaqaId') || '';
  const [filterHalaqa, setFilterHalaqa] = useState(initialHalaqa);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteName, setDeleteName] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const todayStr = getTodayStr();
      const currentWeekDays = getWeekDays(todayStr);
      const startD = currentWeekDays[0].dateStr;
      const endD = currentWeekDays[currentWeekDays.length - 1].dateStr;

      const [sRes, hRes, pRes, tRes] = await Promise.all([
        studentsAPI.getAll(),
        halaqatAPI.getAll(),
        usersAPI.getAll('parent'),
        trackingAPI.getAllRange({ startDate: startD, endDate: endD })
      ]);
      setStudents(sRes.data.data);
      setHalaqat(hRes.data.data);
      setParents(pRes.data.data);
      setWeeklyTracking(tRes.data.data || []);
    } catch { toast.error('فشل التحميل'); }
    finally { setLoading(false); }
  };

  const getStudentWeeklySummary = (studentId, dailyTarget) => {
    const todayStr = getTodayStr();
    const currentWeekDays = getWeekDays(todayStr);

    const studentRecs = weeklyTracking.filter(r => {
      const rid = r.studentId?._id || r.studentId;
      return String(rid) === String(studentId);
    });

    const recordsMap = {};
    studentRecs.forEach(r => {
      const rDate = r.date.slice(0, 10);
      recordsMap[rDate] = r;
    });

    let totalPages = 0;

    const daysData = currentWeekDays.map(day => {
      const rec = recordsMap[day.dateStr];
      let statusText = '—';
      let badgeClass = 'badge-gray';
      let pagesVal = '';

      if (rec) {
        if (rec.attendance === 'absent') {
          statusText = 'غائب';
          badgeClass = 'badge-danger';
        } else if (rec.attendance === 'excused') {
          statusText = 'عذر';
          badgeClass = 'badge-gold';
        } else {
          const pages = Number(rec.pagesMemorized) || 0;
          totalPages += pages;
          pagesVal = `${pages} ص`;

          if (pages >= dailyTarget) {
            statusText = 'اكتمل';
            badgeClass = 'badge-green';
          } else if (pages > 0) {
            statusText = 'جزئي';
            badgeClass = 'badge-gold';
          } else {
            statusText = 'لم يحفظ';
            badgeClass = 'badge-danger';
          }
        }
      }

      return {
        ...day,
        statusText,
        badgeClass,
        pagesVal,
        isLate: rec?.isLate
      };
    });

    return { daysData, totalPages };
  };

  useEffect(() => { fetchAll(); }, []);

  const handleDailyTargetChange = (studentId, value) => {
    setStudents(prev => prev.map(s => {
      if (s._id === studentId) {
        return { ...s, dailyTarget: value };
      }
      return s;
    }));
  };

  const handleDailyTargetBlur = async (studentId, value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      toast.error('المقدار المدخل غير صالح. يجب أن يكون أكبر من 0');
      fetchAll();
      return;
    }

    try {
      await studentsAPI.update(studentId, { dailyTarget: numValue });
      setStudents(prev => prev.map(s => {
        if (s._id === studentId) {
          return { ...s, dailyTarget: numValue };
        }
        return s;
      }));
      toast.success('تم تحديث القسط بنجاح ✅');
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل تحديث القسط ❌');
      fetchAll();
    }
  };

  const handleExportAllHalaqat = async () => {
    const toastId = toast.loading('جاري تصدير التقرير الفاخر...');
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'نظام متابعة التحصيل';

      const colors = {
        emerald: 'FF064E3B', // زمردي غامق
        gold: 'FFB45309',    // ذهبي
        lightEmerald: 'FFECFDF5',
        grayBg: 'FFF9FAFB',
        textDark: 'FF111827',
        border: 'FFE5E7EB',
        lightGray: 'FFF3F4F6'
      };

      let hasStudents = false;

      // إضافة ورقة عمل لكل حلقة بها طلاب
      for (const halaqa of halaqat) {
        const halaqaStudents = students.filter(s => String(s.halaqaId?._id || s.halaqaId) === String(halaqa._id));
        if (halaqaStudents.length === 0) continue;

        hasStudents = true;

        // اسم ورقة العمل لا يزيد عن 31 حرفاً
        const sheetName = halaqa.name.substring(0, 30);
        const worksheet = workbook.addWorksheet(sheetName, {
          views: [{ rightToLeft: true, showGridLines: true }]
        });

        // 1. ترويسة الحلقة (Emerald Title)
        worksheet.mergeCells('A1:G2');
        const headerCell = worksheet.getCell('A1');
        headerCell.value = `قائمة طلاب حلقة: ${halaqa.name}`;
        headerCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
        headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.emerald } };
        headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(1).height = 25;
        worksheet.getRow(2).height = 25;

        // 2. بطاقة معلومات الحلقة (Info Row)
        worksheet.mergeCells('A3:G4');
        const infoCell = worksheet.getCell('A3');
        infoCell.value = `👤 مشرف الحلقة: ${halaqa.supervisor || 'غير محدد'}   |   📊 عدد الطلاب: ${halaqaStudents.length} طلاب   |   📅 تاريخ التصدير: ${new Date().toLocaleDateString('ar-DZ')}`;
        infoCell.font = { name: 'Arial', bold: true, size: 11, color: { argb: colors.textDark } };
        infoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.lightEmerald } };
        infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
        infoCell.border = {
          bottom: { style: 'medium', color: { argb: colors.gold } }
        };
        worksheet.getRow(3).height = 20;
        worksheet.getRow(4).height = 20;

        worksheet.addRow([]); // Spacer row 5

        // تعريف الأعمدة
        const columns = [
          { header: '#', key: 'idx', width: 6 },
          { header: 'اسم الطالب الكامل', key: 'name', width: 28 },
          { header: 'المستوى', key: 'level', width: 14 },
          { header: 'القسط اليومي (صفحات)', key: 'target', width: 20 },
          { header: 'بداية السورة', key: 'startSurah', width: 18 },
          { header: 'اسم ولي الأمر', key: 'parent', width: 25 },
          { header: 'رقم هاتف ولي الأمر', key: 'parentPhone', width: 20 }
        ];

        worksheet.columns = columns.map(col => ({ key: col.key, width: col.width }));

        // كتابة وتنسيق رؤوس الجدول في الصف 6
        const tableHeader = worksheet.getRow(6);
        tableHeader.values = columns.map(col => col.header);
        tableHeader.height = 30;
        tableHeader.eachCell((cell) => {
          cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } }; // Charcoal header
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            bottom: { style: 'medium', color: { argb: colors.gold } },
            top: { style: 'thin', color: { argb: colors.border } },
            left: { style: 'thin', color: { argb: colors.border } },
            right: { style: 'thin', color: { argb: colors.border } }
          };
        });

        // إضافة بيانات الطلاب
        halaqaStudents.forEach((st, idx) => {
          const rowData = {
            idx: idx + 1,
            name: st.name,
            level: levelLabel(st.level) || st.level,
            target: st.dailyTarget,
            startSurah: st.startSurah,
            parent: st.parentId?.fullName || st.parent?.fullName || '—',
            parentPhone: st.parentId?.phoneNumber || st.parent?.phoneNumber || '—'
          };

          const row = worksheet.addRow(rowData);
          row.height = 25;

          const isEven = idx % 2 === 1;
          row.eachCell((cell, colNumber) => {
            cell.font = { name: 'Arial', size: 10 };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
              bottom: { style: 'thin', color: { argb: colors.border } },
              left: { style: 'thin', color: { argb: colors.border } },
              right: { style: 'thin', color: { argb: colors.border } }
            };

            if (isEven) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.lightGray } };
            }

            if (colNumber === 2) { // الاسم: عريض ومحاذاة لليمين
              cell.font = { name: 'Arial', bold: true, size: 10 };
              cell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
            }
          });
        });
      }

      if (!hasStudents) {
        toast.error('لا يوجد طلاب في أي حلقة للتصدير', { id: toastId });
        return;
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, 'قائمة_الطلبة_حسب_الحلقات.xlsx');

      toast.success('تم تصدير التقرير الفاخر بنجاح 💎', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تصدير ملف إكسل ❌', { id: toastId });
    }
  };

  const handleDeleteClick = (id, name) => {
    setDeleteId(id);
    setDeleteName(name);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;

    toast.promise(
      studentsAPI.delete(deleteId),
      {
        loading: `جاري حذف الطالب ${deleteName}...`,
        success: () => {
          fetchAll();
          return `تم حذف الطالب "${deleteName}" بنجاح 🗑️`;
        },
        error: (err) => err.response?.data?.message || 'فشل الحذف ❌',
      },
      { success: { duration: 4000 } }
    );
  };

  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchHalaqa = filterHalaqa ? String(s.halaqaId?._id || s.halaqaId) === String(filterHalaqa) : true;
    return matchSearch && matchHalaqa;
  });

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon"><Users size={20} /></div>
          إدارة الطلبة
          <span className="badge badge-green">{students.length}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={handleExportAllHalaqat} style={{ gap: '0.4rem' }}>
            <FileSpreadsheet size={18} /> تصدير إكسل للحلقات
          </button>
          <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>
            <UploadCloud size={18} /> استيراد إكسل
          </button>
          <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowModal(true); }}>
            <Plus size={18} /> إضافة طالب
          </button>
        </div>
      </div>

      {/* ─── Filters ─────────────────────── */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', top: '50%', right: '0.75rem', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-control"
            placeholder="بحث باسم الطالب..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingRight: '2.25rem' }}
          />
        </div>
        <select className="form-control" style={{ width: 'auto', minWidth: 180 }}
          value={filterHalaqa} onChange={e => setFilterHalaqa(e.target.value)}>
          <option value="">كل الحلقات</option>
          {halaqat.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
        </select>
      </div>

      {/* ─── Table ───────────────────────── */}
      {loading ? (
        <div className="loading-wrap"><div className="spinner" /><span>جاري التحميل...</span></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Users size={48} />
            <h3>{search || filterHalaqa ? 'لا توجد نتائج' : 'لا يوجد طلبة'}</h3>
            <p>{search || filterHalaqa ? 'جرّب تغيير فلاتر البحث' : 'ابدأ بإضافة الطلبة للحلقات'}</p>
          </div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>الاسم</th>
                <th>المستوى</th>
                <th>السورة (البداية / الحالية)</th>
                <th>القسط (صفحات)</th>
                <th>الحلقة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s._id}>
                  <td style={{ color: 'var(--text-muted)', width: 40 }}>{i + 1}</td>
                  <td className="student-name-cell">
                    {(() => {
                      const { daysData, totalPages } = getStudentWeeklySummary(s._id, s.dailyTarget);
                      return (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span>{s.name}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '4px', fontWeight: 500 }}>
                              {totalPages} ص
                            </span>
                          </div>

                          <div className="weekly-tooltip">
                            <div className="tooltip-title">
                              <span>متابعة الأسبوع الحالي</span>
                              <span>المجموع: {totalPages} ص</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {daysData.map(day => (
                                <div className="tooltip-day-row" key={day.dateStr}>
                                  <span className="tooltip-day-label">
                                    {day.label} <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginRight: '3px' }}>({day.shortDate})</span>
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {day.isLate && <span style={{ fontSize: '0.65rem', color: 'var(--gold-500)', fontWeight: 'bold' }}>ت</span>}
                                    {day.pagesVal && <span style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-primary)' }}>{day.pagesVal}</span>}
                                    <span className={`tooltip-day-badge ${day.badgeClass}`}>
                                      {day.statusText}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </td>
                  <td><span className={`badge ${levelClass(s.level)}`}>{levelLabel(s.level)}</span></td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>البداية: {s.startSurah}</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--gold-400)', fontWeight: 'bold' }}>
                        الحالية: {s.currentSurah || s.startSurah || 'غير محدد'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      className="daily-target-inline-input"
                      value={s.dailyTarget}
                      onChange={(e) => handleDailyTargetChange(s._id, e.target.value)}
                      onBlur={(e) => handleDailyTargetBlur(s._id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.target.blur();
                        }
                      }}
                    />
                  </td>
                  <td>
                    <span className="badge badge-blue">
                      {halaqat.find(h => h._id === (s.halaqaId?._id || s.halaqaId))?.name || '—'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setEditItem(s); setShowModal(true); }}>
                        <Edit2 size={13} />
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClick(s._id, s.name)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <StudentModal
          student={editItem}
          halaqat={halaqat}
          parents={parents}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); fetchAll(); }}
        />
      )}

      {showImportModal && (
        <ExcelImportModal
          halaqat={halaqat}
          parents={parents}
          onClose={() => setShowImportModal(false)}
          onSave={() => { setShowImportModal(false); fetchAll(); }}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        title="تأكيد حذف الطالب"
        message={`هل أنت متأكد من حذف الطالب "${deleteName}"؟ سيتم حذف جميع بيانات المتابعة الخاصة به نهائياً.`}
        confirmText="نعم، احذف الطالب"
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
