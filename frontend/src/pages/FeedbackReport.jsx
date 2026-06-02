import { useState, useEffect } from 'react';
import { MessageSquare, Search, Calendar, Phone, User, MessageCircle, AlertTriangle, Lightbulb, HelpCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { usersAPI } from '../services/api';

const TYPE_LABELS = {
  suggestion: { label: 'اقتراح', color: 'var(--green-400)', bg: 'rgba(34, 197, 94, 0.15)', icon: Lightbulb },
  bug: { label: 'مشكلة تقنية', color: 'var(--danger)', bg: 'rgba(239, 68, 68, 0.15)', icon: AlertTriangle },
  complaint: { label: 'شكوى', color: 'var(--gold-400)', bg: 'rgba(234, 179, 8, 0.15)', icon: MessageSquare },
  other: { label: 'ملاحظة أخرى', color: 'var(--text-secondary)', bg: 'rgba(255, 255, 255, 0.08)', icon: HelpCircle },
};

export default function FeedbackReport() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    try {
      setLoading(true);
      const res = await usersAPI.getFeedback();
      if (res.data.success) {
        setFeedbacks(res.data.data);
      }
    } catch (err) {
      toast.error('فشل تحميل ملاحظات وشكاوى أولياء الأمور');
    } finally {
      setLoading(false);
    }
  };

  const filteredFeedbacks = feedbacks.filter(f => {
    const parentName = f.user?.fullName || '';
    const phone = f.user?.phoneNumber || '';
    const msg = f.message || '';
    
    const matchesSearch = 
      parentName.toLowerCase().includes(search.toLowerCase()) ||
      phone.includes(search) ||
      msg.toLowerCase().includes(search.toLowerCase());

    const matchesType = filterType === 'all' || f.type === filterType;

    return matchesSearch && matchesType;
  });

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--green-400)' }}>
            <MessageCircle size={20} />
          </div>
          الملاحظات والشكاوى (آراء أولياء الأمور)
        </div>
        <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={fetchFeedbacks} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          تحديث
        </button>
      </div>

      {/* Filter and Search Section */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'row-reverse', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div className="form-group" style={{ flex: 1, minWidth: '250px' }}>
          <label className="form-label">بحث في الملاحظات</label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="ابحث باسم ولي الأمر، الهاتف أو نص الرسالة..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingRight: '2.8rem' }}
            />
          </div>
        </div>

        <div className="form-group" style={{ width: '200px' }}>
          <label className="form-label">تصفية حسب النوع</label>
          <select 
            className="form-control" 
            value={filterType} 
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="all">الكل</option>
            <option value="suggestion">اقتراحات</option>
            <option value="bug">مشاكل تقنية</option>
            <option value="complaint">شكاوى</option>
            <option value="other">أخرى</option>
          </select>
        </div>
      </div>

      {/* Feedback Feed */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
          <div className="spinner" style={{ margin: '0 auto' }}></div>
          <p style={{ marginTop: '1.25rem', color: 'var(--text-secondary)' }}>جاري تحميل ملاحظات أولياء الأمور...</p>
        </div>
      ) : filteredFeedbacks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <MessageCircle size={52} style={{ opacity: 0.15, marginBottom: '1.25rem' }} />
          <p>لا توجد أي ملاحظات أو شكاوى مسجلة حالياً</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.25rem' }}>
          {filteredFeedbacks.map(item => {
            const config = TYPE_LABELS[item.type] || TYPE_LABELS.other;
            const IconComponent = config.icon;
            
            return (
              <div key={item._id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: `4px solid ${config.color}`, transition: 'transform 0.2s', cursor: 'pointer' }}>
                {/* Header row: type badge & date */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ 
                    background: config.bg, 
                    color: config.color, 
                    padding: '4px 10px', 
                    borderRadius: '8px', 
                    fontSize: '0.75rem', 
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <IconComponent size={13} />
                    {config.label}
                  </span>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <Calendar size={13} />
                    {new Date(item.createdAt).toLocaleString('ar-DZ', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                </div>

                {/* Message body */}
                <div style={{ 
                  flex: 1, 
                  backgroundColor: 'rgba(255, 255, 255, 0.02)', 
                  border: '1px solid var(--border)', 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  fontSize: '0.9rem', 
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  textAlign: 'right'
                }}>
                  {item.message}
                </div>

                {/* Sender info footer */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'row-reverse',
                  alignItems: 'center', 
                  gap: '0.75rem', 
                  paddingTop: '0.75rem', 
                  borderTop: '1px solid var(--border)' 
                }}>
                  <div style={{ 
                    width: '36px', 
                    height: '36px', 
                    borderRadius: '50%', 
                    backgroundColor: 'var(--border)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'var(--text-secondary)'
                  }}>
                    <User size={18} />
                  </div>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {item.user?.fullName || 'ولي أمر مجهول'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <User size={10} />
                      {item.user?.username}
                      {item.user?.phoneNumber && (
                        <>
                          <span style={{ margin: '0 4px' }}>•</span>
                          <Phone size={10} />
                          <span style={{ direction: 'ltr' }}>{item.user.phoneNumber}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
