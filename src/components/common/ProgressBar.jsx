import React from 'react';

export const ProgressBar = ({
  progress = 0,
  label = '',
  subLabel = '',
  className = ''
}) => {
  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div className={`w-full ${className}`}>
      {(label || subLabel) && (
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-[#A7B7D0] font-medium">{label}</span>
          <span className="text-[#71839E] font-mono text-[11px]">{subLabel || `${clampedProgress}%`}</span>
        </div>
      )}
      <div className="w-full h-2 bg-[#0E1D35] rounded-full overflow-hidden border border-[rgba(139,170,215,0.14)] p-[1px]">
        <div
          className="h-full bg-gradient-to-r from-[#3478F6] to-[#4B91FF] rounded-full transition-all duration-300 ease-out shadow-xs shadow-[#3478F6]/30"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};
