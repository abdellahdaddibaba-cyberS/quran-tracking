import { useState, useEffect } from 'react';
import { TrendingDown, Calendar, Search, Filter, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { reportsAPI } from '../services/api';

export default function LowPageReport() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(2);
  const [search, setSearch] = useState('');

  const fetchReport = async (daysVal) => {
    setLoading(true);
    try {
      const res = await reportsAPI.getLowPages({ days: daysVal });
      setData(res.data.data);
    } catch (err) {
      toast.error('فشل تحميل التقرير');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(days);
  }, [days]);

  const filtered = data.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.halaqa.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="report-container">
      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon"><TrendingDown size={20} /></div>
          تقرير الحفظ الضعيف
        </div>
        <div className="header-actions">
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              className={`btn ${days === 2 ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setDays(2)}
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              يومين
            </button>
            <button 
              className={`btn ${days === 3 ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setDays(3)}
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              3 أيام
            </button>
          </div>
        </div>
      </div>

      <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
        <AlertCircle size={18} />
        يعرض هذا التقرير الطلاب الذين لم يتجاوز حفظهم <b>صفحتين</b> لمدة <b>{days} أيام متتالية</b> من حضورهم.
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ 
            position: 'absolute', top: '50%', right: '1rem', 
            transform: 'translateY(-50%)', color: 'var(--text-muted)' 
          }} />
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
        <div className="loading-wrap">
          <div className="spinner" />
          <span>جاري جلب البيانات...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Filter size={48} />
            <h3>لا يوجد نتائج</h3>
            <p>لم يتم العثور على طلاب تنطبق عليهم هذه الشروط حالياً.</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>الطالب</th>
                  <th>الحلقة</th>
                  <th style={{ textAlign: 'center' }}>التاريخ الأخير</th>
                  <th>آخر {days} أيام</th>
                  <th style={{ textAlign: 'center' }}>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</div>
                    </td>
                    <td>
                      <span className="badge badge-blue">{s.halaqa}</span>
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {new Date(s.lastRecords[0].date).toLocaleDateString('ar-DZ', { month: 'short', day: 'numeric' })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {s.lastRecords.map((r, idx) => (
                          <div key={idx} style={{ 
                            background: 'rgba(239, 68, 68, 0.1)', 
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.8rem',
                            color: 'var(--danger)',
                            fontWeight: 600
                          }}>
                            {r.pages} ص
                          </div>
                        ))}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        className="btn btn-sm btn-outline"
                        onClick={() => window.location.href = `/student-history?studentId=${s.id}`}
                      >
                        السجل الكامل
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
