import React from 'react';

export const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  icon: Icon,
  className = ''
}) => {
  const variantStyles = {
    default: 'bg-[#0E1D35] text-[#A7B7D0] border-[rgba(139,170,215,0.18)]',
    blue: 'bg-[#3478F6]/15 text-[#4B91FF] border-[#3478F6]/30',
    indigo: 'bg-[#7566F6]/15 text-[#A7B7D0] border-[#7566F6]/30',
    violet: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    danger: 'bg-red-500/15 text-red-300 border-red-500/30'
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[11px] gap-1 font-medium',
    md: 'px-2.5 py-1 text-xs gap-1.5 font-medium',
    lg: 'px-3 py-1.5 text-xs gap-2 font-semibold'
  };

  return (
    <span className={`inline-flex items-center rounded-lg border select-none ${sizeStyles[size] || sizeStyles.md} ${variantStyles[variant] || variantStyles.default} ${className}`}>
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      <span>{children}</span>
    </span>
  );
};
