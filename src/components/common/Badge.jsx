import React from 'react';

export const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  icon: Icon,
  className = ''
}) => {
  const variantStyles = {
    default: 'bg-gray-800/80 text-gray-300 border-gray-700/60',
    blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    violet: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    danger: 'bg-red-500/15 text-red-400 border-red-500/30'
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[11px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5'
  };

  return (
    <span className={`inline-flex items-center font-medium rounded-md border backdrop-blur-md ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}>
      {Icon && <Icon className="w-3 h-3" />}
      <span>{children}</span>
    </span>
  );
};
