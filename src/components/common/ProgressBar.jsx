import React from 'react';

export const ProgressBar = ({
  progress = 0,
  label = '',
  subLabel = '',
  className = ''
}) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={`w-full ${className}`}>
      {(label || subLabel) && (
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-gray-300 font-medium">{label}</span>
          <span className="text-gray-400 font-mono">{subLabel || `${clampedProgress}%`}</span>
        </div>
      )}
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700/50 p-0.5">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300 ease-out shadow-sm shadow-blue-500/50"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};
