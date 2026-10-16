import React from 'react';

export const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  icon: Icon,
  className = ''
}) => {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[11px] gap-1 font-medium',
    md: 'px-2.5 py-1 text-xs gap-1.5 font-medium',
    lg: 'px-3 py-1.5 text-xs gap-2 font-semibold'
  };

  // Fixed-color semantic variants stay the same across themes.
  // The 'default' variant uses CSS variables so it adapts to light/dark.
  const variantStaticStyles = {
    blue:    'bg-[#3478F6]/15 text-[#4B91FF] border-[#3478F6]/30',
    indigo:  'bg-[#7566F6]/15 text-[#7566F6] border-[#7566F6]/30',
    violet:  'bg-purple-500/15 text-purple-400 border-purple-500/30',
    success: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
    danger:  'bg-red-500/15 text-red-400 border-red-500/30',
  };

  // 'default' uses inline CSS vars to stay themed
  const isDefault = variant === 'default' || !variantStaticStyles[variant];

  return (
    <span
      className={`inline-flex items-center rounded-lg border select-none ${sizeStyles[size] || sizeStyles.md} ${isDefault ? '' : variantStaticStyles[variant]} ${className}`}
      style={isDefault ? {
        backgroundColor: 'var(--bg-surface-secondary)',
        color: 'var(--text-secondary)',
        borderColor: 'var(--border-default)',
      } : {}}
    >
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      <span>{children}</span>
    </span>
  );
};
