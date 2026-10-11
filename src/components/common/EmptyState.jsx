import React from 'react';
import { SearchX } from 'lucide-react';
import { Button } from './Button';

export const EmptyState = ({
  icon: Icon = SearchX,
  title = 'No files found',
  description = 'Try adjusting your search terms or filters.',
  actionLabel,
  onAction,
  children
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center glass-panel rounded-2xl border border-dashed border-[rgba(139,170,215,0.18)] my-4 select-none">
      <div className="w-14 h-14 rounded-2xl bg-[#3478F6]/10 border border-[#3478F6]/20 flex items-center justify-center text-[#4B91FF] mb-4 shadow-sm">
        <Icon className="w-7 h-7" />
      </div>
      <h4 className="text-base sm:text-lg font-bold text-[#F4F7FF] mb-1.5 tracking-tight">{title}</h4>
      <p className="text-xs sm:text-sm text-[#A7B7D0] max-w-md mb-5 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  );
};
