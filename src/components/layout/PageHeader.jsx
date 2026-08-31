import React from 'react';

export const PageHeader = ({
  title,
  subtitle,
  children,
  badge
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-800/60">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
          {badge}
        </div>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-3 shrink-0">{children}</div>}
    </div>
  );
};
