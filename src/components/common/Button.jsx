import React from 'react';
import { Loader2 } from 'lucide-react';

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconClassName = '',
  loading = false,
  className = '',
  disabled = false,
  onClick,
  type = 'button',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none focus-visible:outline-none focus-visible:ring-2 active:scale-[0.98]';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-xs sm:text-sm gap-2',
    lg: 'px-5 py-2.5 text-sm sm:text-base gap-2.5'
  };

  // Variants use inline CSS variables that adapt automatically to the active theme
  const variantStyles = {
    primary:   'bg-[#3478F6] hover:bg-[#4B91FF] text-white shadow-sm border border-[rgba(52,120,246,0.40)] font-semibold focus-visible:ring-[#3478F6]/50',
    secondary: 'border font-medium focus-visible:ring-[rgba(139,170,215,0.40)]',
    ghost:     'bg-transparent font-medium focus-visible:ring-[rgba(139,170,215,0.40)]',
    outline:   'bg-transparent border font-medium focus-visible:ring-[#3478F6]/40',
    danger:    'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 hover:border-red-500/50 font-medium focus-visible:ring-red-500/40'
  };

  // For non-primary variants, use inline style to reference CSS vars
  const variantInlineStyle = {
    primary:   {},
    secondary: {
      backgroundColor: 'var(--bg-surface-secondary)',
      color: 'var(--text-primary)',
      borderColor: 'var(--border-default)',
    },
    ghost: {
      color: 'var(--text-secondary)',
    },
    outline: {
      color: 'var(--accent-bright)',
      borderColor: 'rgba(52, 120, 246, 0.40)',
    },
    danger: {},
  };

  const IconComponent = Icon;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${sizeStyles[size] || sizeStyles.md} ${variantStyles[variant] || variantStyles.primary} ${className}`}
      style={variantInlineStyle[variant] || {}}
      {...props}
    >
      {loading ? (
        <Loader2 className={`w-4 h-4 shrink-0 animate-spin text-current ${iconClassName}`} />
      ) : (
        IconComponent && <IconComponent className={`w-4 h-4 shrink-0 text-current ${iconClassName}`} />
      )}
      {children && <span>{children}</span>}
    </button>
  );
};
