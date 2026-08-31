import React from 'react';

export const Skeleton = ({
  className = '',
  variant = 'rectangular', // 'text' | 'circular' | 'rectangular'
  width,
  height
}) => {
  const variantStyles = {
    text: 'h-4 rounded-md',
    circular: 'rounded-full',
    rectangular: 'rounded-xl'
  };

  return (
    <div
      className={`animate-pulse bg-gray-800/60 border border-gray-700/30 ${variantStyles[variant]} ${className}`}
      style={{ width, height }}
    />
  );
};
