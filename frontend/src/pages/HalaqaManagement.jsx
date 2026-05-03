import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, AlignJustify, X, Check, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { halaqatAPI } from '../services/api';
import ConfirmModal from '../components/ConfirmModal';

// ─── Modal للإضافة / التعديل ─────────────────────────────────────
function HalaqaModal({ halaqa, onClose, onSave }) {
  const [form, setForm] = useState({
    name:        halaqa?.name        || '',
    supervisor:  halaqa?.supervisor  || '',
    description: halaqa?.description || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.supervisor.trim()) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    setSaving(true);
    try {
      if (halaqa) {
        await halaqatAPI.update(halaqa._id, form);
        toast.success('تم تعديل الحلقة بنجاح ✅');
      } else {
        await halaqatAPI.create(form);
        toast.success('تم إنشاء الحلقة بنجاح ✅');
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
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{halaqa ? 'تعديل حلقة' : 'إنشاء حلقة جديدة'}</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">اسم الحلقة *</label>
              <input
                className="form-control"
                placeholder="مثال: حلقة الفجر"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">المشرف *</label>
              <input
                className="form-control"
                placeholder="اسم المشرف"
                value={form.supervisor}
                onChange={e => setForm(p => ({ ...p, supervisor: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">وصف (اختياري)</label>
              <input
                className="form-control"
                placeholder="وصف مختصر للحلقة"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>إلغاء</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'جاري الحفظ...' : (halaqa ? 'حفظ التعديلات' : 'إنشاء الحلقة')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── الصفحة الرئيسية ─────────────────────────────────────────────
export default function HalaqaManagement() {
  const [halaqat, setHalaqat]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem]  = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteName, setDeleteName] = useState('');

  const fetchHalaqat = async () => {
    setLoading(true);
    try {
      const res = await halaqatAPI.getAll();
      setHalaqat(res.data.data);
    } catch {
      toast.error('فشل تحميل الحلقات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHalaqat(); }, []);

  const handleDeleteClick = (id, name) => {
    setDeleteId(id);
    setDeleteName(name);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    
    toast.promise(
      halaqatAPI.delete(deleteId),
      {
        loading: `جاري حذف حلقة ${deleteName}...`,
        success: () => {
          fetchHalaqat();
          return `تم حذف الحلقة "${deleteName}" بنجاح 🗑️`;
        },
        error: (err) => err.response?.data?.message || 'فشل الحذف ❌',
      }
    );
  };

  const openAdd  = ()      => { setEditItem(null);  setShowModal(true); };
  const openEdit = (item)  => { setEditItem(item);  setShowModal(true); };
  const onSave   = ()      => { setShowModal(false); fetchHalaqat(); };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon"><AlignJustify size={20} /></div>
          إدارة الحلقات
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={18} /> إنشاء حلقة
        </button>
      </div>

      {loading ? (
        <div className="loading-wrap"><div className="spinner" /><span>جاري التحميل...</span></div>
      ) : halaqat.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <AlignJustify size={48} />
            <h3>لا توجد حلقات</h3>
            <p>أنشئ أول حلقة قرآنية للبدء</p>
            <button className="btn btn-primary" onClick={openAdd} style={{ marginTop: '0.5rem' }}>
              <Plus size={16} /> إنشاء حلقة
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {halaqat.map(h => (
            <div key={h._id} className="card" style={{
              borderTop: '3px solid var(--green-600)',
              transition: 'var(--transition)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      {h.name}
                    </h3>
                    <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                      {h.studentsCount || 0} طالب
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                    👤 <span>{h.supervisor}</span>
                  </div>
                  {h.description && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                      {h.description}
                    </div>
                  )}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem', marginBottom: '1rem' }}>
                    أُنشئت: {new Date(h.createdAt).toLocaleDateString('en-GB')}
                  </div>
                  <Link 
                    to={`/students?halaqaId=${h._id}`} 
                    className="btn btn-secondary btn-sm" 
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <Users size={14} /> عرض الطلبة
                  </Link>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(h)}>
                    <Edit2 size={14} />
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClick(h._id, h.name)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <HalaqaModal
          halaqa={editItem}
          onClose={() => setShowModal(false)}
          onSave={onSave}
        />
      )}

      <ConfirmModal 
        isOpen={!!deleteId}
        title="تأكيد حذف الحلقة"
        message={`هل أنت متأكد من حذف حلقة "${deleteName}"؟ سيؤدي هذا إلى حذف الحلقة بشكل نهائي.`}
        confirmText="نعم، احذف الحلقة"
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
