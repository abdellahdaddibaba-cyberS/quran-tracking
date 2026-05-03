import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

/**
 * مكون رسالة تأكيد احترافي (Confirm Modal)
 * يتميز بتصميم عصري وحركات ناعمة
 */
export default function ConfirmModal({ 
  isOpen, 
  title = 'تأكيد الحذف', 
  message = 'هل أنت متأكد من هذه العملية؟ لا يمكن التراجع عنها.', 
  confirmText = 'نعم، احذف', 
  cancelText = 'إلغاء', 
  onConfirm, 
  onClose,
  type = 'danger' // danger | warning | info
}) {
  if (!isOpen) return null;

  const accentColor = type === 'danger' ? 'var(--red-500)' : 'var(--blue-500)';
  const accentBg = type === 'danger' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)';

  return (
    <div className="modal-overlay" style={{ zIndex: 9999, backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div 
        className="modal" 
        style={{ 
          maxWidth: 400, 
          padding: '1.5rem',
          border: `1px solid rgba(255,255,255,0.1)`,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          animation: 'modalFadeIn 0.3s ease-out'
        }} 
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ 
            width: 64, height: 64, 
            borderRadius: '50%', 
            background: accentBg, 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1rem',
            color: accentColor
          }}>
            <AlertTriangle size={32} />
          </div>
          
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            {title}
          </h3>
          
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {message}
          </p>
          
          <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
            <button 
              className="btn btn-secondary" 
              style={{ flex: 1, padding: '0.75rem' }}
              onClick={onClose}
            >
              {cancelText}
            </button>
            <button 
              className={`btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}`}
              style={{ 
                flex: 1, 
                padding: '0.75rem',
                boxShadow: type === 'danger' ? '0 10px 15px -3px rgba(239, 68, 68, 0.3)' : '0 10px 15px -3px rgba(59, 130, 246, 0.3)'
              }}
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
