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
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478F6]/50 active:scale-[0.98]';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-xs sm:text-sm gap-2',
    lg: 'px-5 py-2.5 text-sm sm:text-base gap-2.5'
  };

  const variantStyles = {
    primary: 'bg-[#3478F6] hover:bg-[#4B91FF] text-[#F4F7FF] shadow-sm shadow-[#3478F6]/25 border border-[#4B91FF]/30 font-semibold',
    secondary: 'bg-[#0E1D35] hover:bg-[#182F50] text-[#F4F7FF] border border-[rgba(139,170,215,0.18)] hover:border-[rgba(139,170,215,0.30)] shadow-sm',
    ghost: 'bg-transparent hover:bg-[#0E1D35] text-[#A7B7D0] hover:text-[#F4F7FF]',
    outline: 'bg-transparent hover:bg-[#3478F6]/10 text-[#4B91FF] border border-[#3478F6]/40 hover:border-[#3478F6]/70',
    danger: 'bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 hover:border-red-500/50'
  };

  const IconComponent = Icon;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${sizeStyles[size] || sizeStyles.md} ${variantStyles[variant] || variantStyles.primary} ${className}`}
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
