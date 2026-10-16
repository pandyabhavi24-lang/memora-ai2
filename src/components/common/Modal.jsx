import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-2xl',
  actions
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-md transition-all animate-fadeIn"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.70)' }}
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all`}
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface-secondary)',
          }}
        >
          <div className="min-w-0 pr-4">
            <h3
              className="text-base sm:text-lg font-bold truncate tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--bg-surface-elevated)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div
          className="p-6 overflow-y-auto flex-1 custom-scrollbar text-sm"
          style={{ color: 'var(--text-primary)' }}
        >
          {children}
        </div>

        {/* Modal Actions Footer */}
        {actions && (
          <div
            className="flex items-center justify-end gap-3 px-6 py-4 shrink-0"
            style={{
              backgroundColor: 'var(--bg-surface-secondary)',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
