import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, UserPlus, X, Search, Shield, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { usersAPI } from '../services/api';
import ConfirmModal from '../components/ConfirmModal';

const ROLES = [
  { value: 'parent', label: 'ولي أمر', icon: User },
  { value: 'teacher', label: 'معلم', icon: User },
  { value: 'admin', label: 'مدير', icon: Shield },
];

const roleLabel = (v) => ROLES.find(r => r.value === v)?.label || v;

// ─── User Modal ───────────────────────────────────────────────────
function UserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({
    username:    user?.username    || '',
    password:    '',
    fullName:    user?.fullName    || '',
    role:        user?.role        || 'parent',
    phoneNumber: user?.phoneNumber || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.fullName || (!user && !form.password)) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    setSaving(true);
    try {
      if (user) {
        // Remove password if empty on update
        const updateData = { ...form };
        if (!updateData.password) delete updateData.password;
        await usersAPI.update(user._id, updateData);
        toast.success('تم تعديل بيانات المستخدم ✅');
      } else {
        await usersAPI.create(form);
        toast.success('تم إضافة المستخدم بنجاح ✅');
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
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{user ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">الاسم الكامل *</label>
              <input className="form-control" placeholder="مثال: أحمد محمد" value={form.fullName}
                onChange={e => setForm({...form, fullName: e.target.value})} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">اسم المستخدم *</label>
                <input className="form-control" placeholder="username" value={form.username}
                  onChange={e => setForm({...form, username: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">كلمة المرور {user && '(اختياري)'} *</label>
                <input className="form-control" type="password" placeholder="******" value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">الدور / الصلاحية</label>
                <select className="form-control" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">رقم الهاتف</label>
                <input className="form-control" placeholder="05xxxxxxxx" value={form.phoneNumber}
                  onChange={e => setForm({...form, phoneNumber: e.target.value})} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>إلغاء</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'جاري الحفظ...' : (user ? 'حفظ التعديلات' : 'إنشاء الحساب')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Users Page ───────────────────────────────────────────────────
export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [deleteName, setDeleteName] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await usersAPI.getAll();
      setUsers(res.data.data);
    } catch { toast.error('فشل تحميل المستخدمين'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = users.filter(u => 
    u.fullName.toLowerCase().includes(search.toLowerCase()) || 
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon"><UserPlus size={20} /></div>
          إدارة المستخدمين وأولياء الأمور
          <span className="badge badge-blue">{users.length}</span>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowModal(true); }}>
          <Plus size={18} /> إضافة مستخدم
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <Search size={16} style={{ position: 'absolute', top: '50%', right: '0.75rem', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          className="form-control"
          placeholder="بحث بالاسم أو اسم المستخدم..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingRight: '2.25rem' }}
        />
      </div>

      {loading ? (
        <div className="loading-wrap"><div className="spinner" /><span>جاري التحميل...</span></div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <User size={48} />
          <h3>لا توجد نتائج</h3>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>الاسم الكامل</th>
                <th>اسم المستخدم</th>
                <th>الدور</th>
                <th>رقم الهاتف</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u._id}>
                  <td style={{ fontWeight: 600 }}>{u.fullName}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{u.username}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-gold' : (u.role === 'teacher' ? 'badge-blue' : 'badge-gray')}`}>
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td>{u.phoneNumber || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setEditItem(u); setShowModal(true); }}>
                        <Edit2 size={13} />
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => { setDeleteId(u._id); setDeleteName(u.fullName); }}>
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
        <UserModal
          user={editItem}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); fetchUsers(); }}
        />
      )}

      <ConfirmModal 
        isOpen={!!deleteId}
        title="تأكيد حذف المستخدم"
        message={`هل أنت متأكد من حذف المستخدم "${deleteName}"؟`}
        confirmText="نعم، احذف"
        onConfirm={async () => {
          try {
            await usersAPI.delete(deleteId);
            toast.success('تم الحذف بنجاح');
            fetchUsers();
          } catch (err) { toast.error('فشل الحذف'); }
          setDeleteId(null);
        }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
