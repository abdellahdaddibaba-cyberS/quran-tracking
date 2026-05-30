import { useState, useEffect } from 'react';
import { History, Shield, AlertTriangle, CheckCircle, Search, Calendar, Monitor, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';

export default function LoginReport() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await authAPI.getLogs();
      if (res.data.success) {
        setLogs(res.data.data);
      }
    } catch (err) {
      toast.error('فشل تحميل سجلات الدخول');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(l => 
    l.username.toLowerCase().includes(search.toLowerCase()) ||
    l.status.toLowerCase().includes(search.toLowerCase()) ||
    (l.ipAddress && l.ipAddress.includes(search))
  );

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--info)' }}>
            <History size={20} />
          </div>
          سجلات تسجيل الدخول (Logs)
        </div>
        <button className="btn btn-secondary" onClick={fetchLogs} disabled={loading}>
          تحديث البيانات
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="form-group" style={{ maxWidth: '400px' }}>
          <label className="form-label">بحث في السجلات</label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="ابحث باسم المستخدم أو عنوان IP..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingRight: '2.8rem' }}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>التاريخ والوقت</th>
                <th>اسم المستخدم</th>
                <th>الحالة</th>
                <th>عنوان IP</th>
                <th>المتصفح / الجهاز</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="spinner" style={{ margin: '0 auto' }}></div>
                    <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>جاري تحميل السجلات...</p>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <Shield size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                    <p>لا توجد سجلات دخول مطابقة للبحث</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Calendar size={14} color="var(--text-muted)" />
                        {new Date(log.loginTime).toLocaleString('ar-DZ')}
                      </div>
                    </td>
                    <td style={{ fontWeight: 700 }}>{log.username}</td>
                    <td>
                      <span className={`badge ${log.status === 'success' ? 'badge-green' : 'badge-danger'}`} style={{
                        background: log.status === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: log.status === 'success' ? 'var(--green-400)' : 'var(--danger)',
                        padding: '4px 12px',
                        borderRadius: '8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        {log.status === 'success' ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                        {log.status === 'success' ? 'دخول ناجح' : 'محاولة فاشلة'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        <Globe size={14} />
                        {log.ipAddress || 'Unknown'}
                      </div>
                    </td>
                    <td style={{ maxWidth: '300px' }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        fontSize: '0.75rem', 
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        <Monitor size={14} />
                        {log.userAgent}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        <Shield size={16} />
        هذا السجل يساعد في مراقبة أمن النظام وتتبع محاولات الدخول غير المصرح بها.
      </div>
    </div>
  );
}
