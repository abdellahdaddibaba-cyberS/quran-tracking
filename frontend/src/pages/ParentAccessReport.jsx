import { useState, useEffect } from 'react';
import { Users, Search, Calendar, Phone, User, CheckCircle2, XCircle, RefreshCw, Clock, ArrowLeftRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { usersAPI } from '../services/api';

const formatRelativeDate = (dateStr) => {
  if (!dateStr) return 'لم يدخل بعد';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'الآن';
  if (diffMins < 60) return `منذ ${diffMins} د`;
  if (diffHours < 24) return `منذ ${diffHours} س`;
  if (diffDays === 1) return 'أمس';
  if (diffDays === 2) return 'منذ يومين';
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  
  return date.toLocaleDateString('ar-DZ', { dateStyle: 'short' });
};

const getStatusConfig = (lastLogin) => {
  if (!lastLogin) {
    return { label: 'لم يدخل أبداً', color: 'var(--text-muted)', bg: 'rgba(255, 255, 255, 0.05)' };
  }
  
  const now = new Date();
  const date = new Date(lastLogin);
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { label: 'نشط اليوم', color: 'var(--green-400)', bg: 'rgba(34, 197, 94, 0.15)' };
  } else if (diffDays < 3) {
    return { label: 'نشط مؤخراً', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' };
  } else if (diffDays < 7) {
    return { label: 'نشط هذا الأسبوع', color: 'var(--gold-400)', bg: 'rgba(234, 179, 8, 0.15)' };
  } else {
    return { label: 'خامل (منذ مدة)', color: 'var(--danger)', bg: 'rgba(239, 68, 68, 0.15)' };
  }
};

export default function ParentAccessReport() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await usersAPI.getParentAccessReport();
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      toast.error('فشل تحميل تقرير دخول أولياء الأمور');
    } finally {
      setLoading(false);
    }
  };

  // Get past 7 days list
  const last7Days = (() => {
    const days = [];
    const localeDays = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        dateStr: d.toLocaleDateString('en-CA'),
        dayName: localeDays[d.getDay()],
        rawDate: d
      });
    }
    return days;
  })();

  const hasLoggedInOnDate = (logins, dateStr) => {
    return logins.some(loginTime => {
      const loginDateStr = new Date(loginTime).toLocaleDateString('en-CA');
      return loginDateStr === dateStr;
    });
  };

  const filteredData = data.filter(p => {
    const parentName = p.fullName || '';
    const phone = p.phoneNumber || '';
    const username = p.username || '';
    const studentsList = p.students.join(' ') || '';

    const matchesSearch =
      parentName.toLowerCase().includes(search.toLowerCase()) ||
      phone.includes(search) ||
      username.toLowerCase().includes(search.toLowerCase()) ||
      studentsList.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === 'all') return true;

    const statusConfig = getStatusConfig(p.lastLogin);
    if (filterStatus === 'active_today') return statusConfig.label === 'نشط اليوم';
    if (filterStatus === 'active_week') return ['نشط اليوم', 'نشط مؤخراً', 'نشط هذا الأسبوع'].includes(statusConfig.label);
    if (filterStatus === 'inactive') return statusConfig.label === 'خامل (منذ مدة)' || statusConfig.label === 'لم يدخل أبداً';

    return true;
  });

  // Calculate quick stats
  const stats = (() => {
    let activeToday = 0;
    let activeWeek = 0;
    let neverLogged = 0;

    data.forEach(p => {
      const statusConfig = getStatusConfig(p.lastLogin);
      if (statusConfig.label === 'نشط اليوم') {
        activeToday++;
        activeWeek++;
      } else if (['نشط مؤخراً', 'نشط هذا الأسبوع'].includes(statusConfig.label)) {
        activeWeek++;
      } else if (statusConfig.label === 'لم يدخل أبداً') {
        neverLogged++;
      }
    });

    return {
      total: data.length,
      activeToday,
      activeWeek,
      neverLogged
    };
  })();

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--green-400)' }}>
            <Users size={20} />
          </div>
          تتبع دخول أولياء الأمور (نشاط بوابة الأولياء)
        </div>
        <button 
          className="btn btn-secondary" 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} 
          onClick={fetchReport} 
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          تحديث البيانات
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'center' }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)' }}>{stats.total}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>إجمالي الأولياء</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.15)', display: 'flex', alignItems: 'center', color: 'var(--green-400)', display: 'flex', justifyContent: 'center' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--green-400)' }}>{stats.activeToday}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>نشط اليوم</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', color: '#3b82f6', display: 'flex', justifyContent: 'center' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#3b82f6' }}>{stats.activeWeek}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>نشط هذا الأسبوع</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', color: 'var(--danger)', display: 'flex', justifyContent: 'center' }}>
            <XCircle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--danger)' }}>{stats.neverLogged}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>لم يدخل أبداً</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'row-reverse', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div className="form-group" style={{ flex: 1, minWidth: '250px' }}>
          <label className="form-label">بحث في الأولياء</label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="ابحث باسم الولي، اسم الطالب، رقم الهاتف..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingRight: '2.8rem' }}
            />
          </div>
        </div>

        <div className="form-group" style={{ width: '200px' }}>
          <label className="form-label">تصفية النشاط</label>
          <select 
            className="form-control" 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="all">كل أولياء الأمور</option>
            <option value="active_today">النشطين اليوم</option>
            <option value="active_week">النشطين هذا الأسبوع</option>
            <option value="inactive">الخاملين / بدون دخول</option>
          </select>
        </div>
      </div>

      {/* Report Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'right' }}>ولي الأمر</th>
                <th style={{ textAlign: 'right' }}>الأبناء المسجلين</th>
                <th style={{ textAlign: 'right' }}>رقم الهاتف</th>
                <th style={{ textAlign: 'right' }}>حالة البوابة</th>
                <th style={{ textAlign: 'center' }}>نشاط آخر 7 أيام</th>
                <th style={{ textAlign: 'right' }}>تاريخ آخر دخول</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '4rem' }}>
                    <div className="spinner" style={{ margin: '0 auto' }}></div>
                    <p style={{ marginTop: '1.25rem', color: 'var(--text-secondary)' }}>جاري تحميل تقرير تتبع الأولياء...</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                    <Users size={48} style={{ opacity: 0.15, marginBottom: '1.25rem' }} />
                    <p>لا يوجد أولياء أمور مطابقين لمعايير البحث حالياً</p>
                  </td>
                </tr>
              ) : (
                filteredData.map(parent => {
                  const status = getStatusConfig(parent.lastLogin);
                  
                  return (
                    <tr key={parent._id}>
                      {/* Parent name & username */}
                      <td>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{parent.fullName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{parent.username}</div>
                        </div>
                      </td>

                      {/* Linked students */}
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {parent.students.length > 0 ? (
                            parent.students.map((studentName, idx) => (
                              <span 
                                key={idx} 
                                style={{ 
                                  background: 'rgba(255, 255, 255, 0.05)', 
                                  color: 'var(--text-secondary)', 
                                  padding: '2px 8px', 
                                  borderRadius: '6px', 
                                  fontSize: '0.75rem',
                                  border: '1px solid var(--border)'
                                }}
                              >
                                {studentName}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>لا يوجد أبناء مرتبطين</span>
                          )}
                        </div>
                      </td>

                      {/* Phone Number */}
                      <td>
                        {parent.phoneNumber ? (
                          <a 
                            href={`tel:${parent.phoneNumber}`} 
                            style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.4rem', 
                              color: 'var(--text-secondary)',
                              textDecoration: 'none',
                              fontSize: '0.85rem'
                            }}
                          >
                            <Phone size={12} color="var(--text-muted)" />
                            <span style={{ direction: 'ltr' }}>{parent.phoneNumber}</span>
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>غير مسجل</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td>
                        <span style={{
                          background: status.bg,
                          color: status.color,
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: status.color }}></span>
                          {status.label}
                        </span>
                      </td>

                      {/* Visual 7-day login grid */}
                      <td>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'center', 
                          gap: '6px', 
                          direction: 'rtl' 
                        }}>
                          {last7Days.map((day, idx) => {
                            const active = hasLoggedInOnDate(parent.logins, day.dateStr);
                            return (
                              <div 
                                key={idx} 
                                title={`${day.dayName} (${day.dateStr}): ${active ? 'تم تسجيل الدخول' : 'لم يسجل دخول'}`}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '4px',
                                  backgroundColor: active ? 'var(--green-400)' : 'rgba(255, 255, 255, 0.05)',
                                  border: active ? 'none' : '1px solid var(--border)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  transition: 'transform 0.15s'
                                }}
                              >
                                {active && <CheckCircle2 size={10} color="#fff" />}
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'center', 
                          gap: '6px', 
                          marginTop: '4px',
                          fontSize: '0.65rem',
                          color: 'var(--text-muted)',
                          textAlign: 'center'
                        }}>
                          {last7Days.map((day, idx) => (
                            <span key={idx} style={{ width: '18px' }}>{day.dayName[0]}</span>
                          ))}
                        </div>
                      </td>

                      {/* Last login date */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                          <Calendar size={13} color="var(--text-muted)" />
                          <div>
                            <div style={{ color: 'var(--text-primary)' }}>
                              {parent.lastLogin ? new Date(parent.lastLogin).toLocaleDateString('ar-DZ') : 'لم يدخل بعد'}
                            </div>
                            {parent.lastLogin && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {formatRelativeDate(parent.lastLogin)}
                              </div>
                            )}
                          </div>
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

      <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem', direction: 'rtl' }}>
        <ArrowLeftRight size={16} />
        يقوم هذا التقرير بتتبع آخر 30 يوماً من نشاط تسجيل الدخول لأولياء الأمور لتحديد مدى اهتمامهم ومتابعتهم اليومية لتحصيل أبنائهم.
      </div>
    </div>
  );
}
