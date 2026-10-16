import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ToastContainer = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
    error:   <AlertCircle  className="w-4 h-4 text-red-400   shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
    info:    <Info          className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-bright)' }} />,
  };

  const borderColors = {
    success: 'rgba(34, 197, 94,  0.35)',
    error:   'rgba(239, 68,  68,  0.35)',
    warning: 'rgba(245, 158, 11,  0.35)',
    info:    'rgba(52,  120, 246, 0.35)',
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md transition-all"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: `1px solid ${borderColors[toast.type] || 'var(--border-default)'}`,
          }}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 min-w-0">
            {icons[toast.type] || icons.info}
            <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {toast.message}
            </span>
          </div>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss notification"
            className="p-1 rounded-lg transition-colors shrink-0 cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--bg-surface-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
