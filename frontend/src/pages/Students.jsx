import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Users, X, Search, UploadCloud } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { studentsAPI, halaqatAPI, usersAPI } from '../services/api';
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
    name:        student?.name        || '',
    level:       student?.level       || 'level1',
    startSurah:  student?.startSurah  || '',
    dailyTarget: student?.dailyTarget || 1,
    halaqaId:    student?.halaqaId?._id || student?.halaqaId || '',
    parentId:    student?.parentId?._id || student?.parentId || '',
  });
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    
    // منطق الاقتراحات عند كتابة السورة
    if (k === 'startSurah') {
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
        set('startSurah', suggestions[selectedIndex]);
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
      if (student) {
        await studentsAPI.update(student._id, form);
        toast.success('تم تعديل بيانات الطالب ✅');
      } else {
        await studentsAPI.create(form);
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
                  onFocus={() => form.startSurah && setSuggestions(SURAHS.filter(s => s.includes(form.startSurah)).slice(0, 5))}
                />
                
                {/* قائمة المقترحات الذكية */}
                {showSuggestions && suggestions.length > 0 && (
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
            </div>
            <style>{`
              @keyframes fadeInDown {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">المستوى</label>
                <select className="form-control" value={form.level} onChange={e => set('level', e.target.value)}>
                  {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">القسط اليومي (صفحات) *</label>
                <input className="form-control" type="number" min="1" value={form.dailyTarget}
                  onChange={e => set('dailyTarget', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">الحلقة *</label>
                <select className="form-control" value={form.halaqaId} onChange={e => set('halaqaId', e.target.value)}>
                  <option value="">اختر الحلقة</option>
                  {halaqat.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">ولي الأمر</label>
                <select className="form-control" value={form.parentId} onChange={e => set('parentId', e.target.value)}>
                  <option value="">اختر ولي الأمر (اختياري)</option>
                  {parents.map(p => <option key={p._id} value={p._id}>{p.fullName}</option>)}
                </select>
              </div>
            </div>
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
          let levelStr = String(row['المستوى'] || 'الأول');
          let level = 'level1';
          if (levelStr.includes('ثاني') || levelStr === '2') level = 'level2';
          else if (levelStr.includes('ثالث') || levelStr === '3') level = 'level3';
          else if (levelStr.includes('رابع') || levelStr === '4') level = 'level4';

          const parentName = String(row['الأب'] || row['ولي الأمر'] || '').trim();
          const parentPhone = String(row['هاتف الأب'] || row['هاتف ولي الأمر'] || row['رقم هاتف ولي الأمر'] || row['رقم الهاتف'] || row['الهاتف'] || '').trim();

          let parentId = null;
          if (parentName) {
            const matchedParent = parents.find(p => {
              const fullNameMatch = p.fullName.trim().toLowerCase() === parentName.toLowerCase();
              const phoneMatch = p.phoneNumber && String(p.phoneNumber).trim() === parentName;
              const usernameMatch = p.username.trim().toLowerCase() === parentName.toLowerCase();
              return fullNameMatch || phoneMatch || usernameMatch;
            });
            if (matchedParent) {
              parentId = matchedParent._id;
            }
          }

          return {
            name: String(row['الاسم'] || ''),
            level: level,
            startSurah: String(row['بداية السورة'] || ''),
            dailyTarget: row['القسط'] ? Number(row['القسط']) : (row['القسط اليومي'] ? Number(row['القسط اليومي']) : 1),
            halaqaId: selectedHalaqa,
            parentId: parentId,
            parentName: parentName || undefined,
            parentPhone: parentPhone || undefined
          };
        }).filter(s => s.name && s.startSurah);

        if (students.length === 0) {
          toast.error('لم يتم العثور على بيانات صحيحة في الملف. تأكد من العناوين (الاسم، بداية السورة)');
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
              - <code>الاسم</code> (إجباري)<br />
              - <code>بداية السورة</code> (إجباري)<br />
              - <code>القسط</code> (إجباري، رقم)<br />
              - <code>المستوى</code> (اختياري - افتراضياً: الأول)<br />
              - <code>الأب</code> أو <code>ولي الأمر</code> (اختياري - لربطه أو إنشاء حساب له تلقائياً)<br />
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

// ─── Students Page ────────────────────────────────────────────────
export default function Students() {
  const [students, setStudents] = useState([]);
  const [halaqat, setHalaqat]   = useState([]);
  const [parents, setParents]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editItem, setEditItem]  = useState(null);
  const [search, setSearch]      = useState('');
  const [searchParams] = useSearchParams();
  const initialHalaqa = searchParams.get('halaqaId') || '';
  const [filterHalaqa, setFilterHalaqa] = useState(initialHalaqa);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteName, setDeleteName] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sRes, hRes, pRes] = await Promise.all([
        studentsAPI.getAll(), 
        halaqatAPI.getAll(),
        usersAPI.getAll('parent')
      ]);
      setStudents(sRes.data.data);
      setHalaqat(hRes.data.data);
      setParents(pRes.data.data);
    } catch { toast.error('فشل التحميل'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

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
                <th>بداية السورة</th>
                <th>القسط (صفحات)</th>
                <th>الحلقة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s._id}>
                  <td style={{ color: 'var(--text-muted)', width: 40 }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td><span className={`badge ${levelClass(s.level)}`}>{levelLabel(s.level)}</span></td>
                  <td style={{ color: 'var(--text-secondary)' }}>{s.startSurah}</td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'rgba(34,197,94,0.12)', color: 'var(--green-400)',
                      fontWeight: 800, fontSize: '0.9rem',
                    }}>
                      {s.dailyTarget}
                    </span>
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
