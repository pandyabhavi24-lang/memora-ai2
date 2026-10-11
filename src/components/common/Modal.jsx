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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md transition-all animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} bg-[#0A1629] border border-[rgba(139,170,215,0.18)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(139,170,215,0.14)] bg-[#06101F]/70 shrink-0">
          <div className="min-w-0 pr-4">
            <h3 className="text-base sm:text-lg font-bold text-[#F4F7FF] truncate tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-[#A7B7D0] mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-[#A7B7D0] hover:text-[#F4F7FF] hover:bg-[#0E1D35] rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar text-sm text-[#F4F7FF]">
          {children}
        </div>

        {/* Modal Actions Footer */}
        {actions && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[#06101F]/80 border-t border-[rgba(139,170,215,0.14)] shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
