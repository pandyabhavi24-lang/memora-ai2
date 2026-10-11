import React from 'react';

export const PageHeader = ({
  title,
  subtitle,
  children,
  badge
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3.5 border-b border-[rgba(139,170,215,0.14)] select-none">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-lg sm:text-xl font-bold text-[#F4F7FF] tracking-tight truncate">{title}</h2>
          {badge}
        </div>
        {subtitle && <p className="text-xs text-[#A7B7D0] mt-0.5 leading-normal">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2.5 shrink-0 flex-wrap">{children}</div>}
    </div>
  );
};
