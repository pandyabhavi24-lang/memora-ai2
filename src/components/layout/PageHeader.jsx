import React from 'react';

export const PageHeader = ({
  title,
  subtitle,
  children,
  badge
}) => {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3.5 select-none"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2
            className="text-lg sm:text-xl font-bold tracking-tight truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h2>
          {badge}
        </div>
        {subtitle && (
          <p className="text-xs mt-0.5 leading-normal" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {children}
        </div>
      )}
    </div>
  );
};
