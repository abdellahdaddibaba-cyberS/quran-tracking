import { useState, useEffect } from 'react';
import { KeyRound, Shield, Search, Calendar, Monitor, Globe, User, RefreshCw, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';

function parseDevice(userAgent) {
  if (!userAgent) return { device: 'غير معروف', browser: 'غير معروف' };
  
  let device = 'جهاز سطح مكتب';
  if (/android/i.test(userAgent)) device = '📱 Android';
  else if (/iphone|ipad/i.test(userAgent)) device = '📱 iOS';
  else if (/mobile/i.test(userAgent)) device = '📱 جهاز محمول';
  else if (/windows/i.test(userAgent)) device = '🖥️ Windows';
  else if (/mac/i.test(userAgent)) device = '🍎 Mac';
  else if (/linux/i.test(userAgent)) device = '🐧 Linux';

  let browser = 'غير معروف';
  if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) browser = 'Chrome';
  else if (/firefox/i.test(userAgent)) browser = 'Firefox';
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari';
  else if (/edge/i.test(userAgent)) browser = 'Edge';
  else if (/expo/i.test(userAgent) || /okhttp/i.test(userAgent)) browser = 'تطبيق الموبايل';

  return { device, browser };
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('ar-DZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PasswordChangeReport() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await authAPI.getPasswordChangeLogs();
      if (res.data.success) {
        setLogs(res.data.data);
        setTotalCount(res.data.data.length);
      }
    } catch (err) {
      toast.error('فشل تحميل سجلات تغيير كلمة السر');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(l =>
    (l.username || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.ipAddress || '').includes(search)
  );

  const exportCSV = () => {
    if (filteredLogs.length === 0) return;
    const rows = [
      ['التاريخ والوقت', 'الاسم الكامل', 'اسم المستخدم', 'عنوان IP', 'الجهاز'],
      ...filteredLogs.map(l => {
        const { device, browser } = parseDevice(l.userAgent);
        return [
          formatDate(l.changedAt),
          l.fullName || '',
          l.username || '',
          l.ipAddress || '',
          `${device} - ${browser}`,
        ];
      })
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `password-change-logs-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('تم تصدير السجلات بنجاح');
  };

  return (
    <div style={{ paddingBottom: '2rem' }}>
      {/* ─── Header ───────────────────────────────────────── */}
      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <KeyRound size={20} />
          </div>
          سجلات تغيير كلمة السر
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={fetchLogs} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            تحديث
          </button>
          <button className="btn btn-primary" onClick={exportCSV} disabled={filteredLogs.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={15} />
            تصدير CSV
          </button>
        </div>
      </div>

      {/* ─── Stats Bar ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#f59e0b', flexShrink: 0
          }}>
            <KeyRound size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>{totalCount}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>إجمالي التغييرات</div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '12px',
            background: 'rgba(59, 130, 246, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--info)', flexShrink: 0
          }}>
            <User size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--info)', lineHeight: 1 }}>
              {new Set(logs.map(l => l.username)).size}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>أولياء قاموا بالتغيير</div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '12px',
            background: 'rgba(34, 197, 94, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--green-400)', flexShrink: 0
          }}>
            <Calendar size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--green-400)', lineHeight: 1.2 }}>
              {logs.length > 0 ? formatDate(logs[0].changedAt) : '—'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>آخر تغيير</div>
          </div>
        </div>
      </div>

      {/* ─── Search ───────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div className="form-group" style={{ maxWidth: '420px', marginBottom: 0 }}>
          <label className="form-label">بحث في السجلات</label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="ابحث بالاسم أو اسم المستخدم أو عنوان IP..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingRight: '2.8rem' }}
            />
          </div>
        </div>
      </div>

      {/* ─── Table ────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>التاريخ والوقت</th>
                <th>الاسم الكامل</th>
                <th>اسم المستخدم</th>
                <th>عنوان IP</th>
                <th>الجهاز / المتصفح</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="spinner" style={{ margin: '0 auto' }}></div>
                    <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>جاري تحميل السجلات...</p>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                    <KeyRound size={48} style={{ opacity: 0.15, marginBottom: '1rem', display: 'block', margin: '0 auto 1rem' }} />
                    <p>{search ? 'لا توجد نتائج مطابقة للبحث' : 'لم يقم أي ولي بتغيير كلمة السر بعد'}</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, idx) => {
                  const { device, browser } = parseDevice(log.userAgent);
                  return (
                    <tr key={log._id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                        {idx + 1}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Calendar size={14} color="var(--text-muted)" />
                          <span style={{ fontSize: '0.85rem' }}>{formatDate(log.changedAt)}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: '50%',
                            background: 'rgba(245, 158, 11, 0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#f59e0b', flexShrink: 0, fontSize: '0.75rem', fontWeight: 700
                          }}>
                            {(log.fullName || '?')[0]}
                          </div>
                          <span style={{ fontWeight: 600 }}>{log.fullName || '—'}</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {log.username || '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                          <Globe size={14} />
                          {log.ipAddress || 'Unknown'}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{device}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Monitor size={12} /> {browser}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Footer Note ──────────────────────────────────── */}
      <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        <Shield size={16} />
        يسجل هذا التقرير كل عملية تغيير لكلمة سر بوابة الأولياء مع تفاصيل الجهاز وعنوان IP للمتابعة الأمنية.
      </div>
    </div>
  );
}
