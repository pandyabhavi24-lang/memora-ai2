import React, { useState } from 'react';
import { PieChart, RefreshCw, AlertTriangle, HardDrive } from 'lucide-react';
import { Button } from '../common/Button';

// Category color map matching Memora electric-blue & midnight design system
const COLOR_PALETTE = [
  '#3478F6', // Electric Blue (Documents / Default 1)
  '#4B91FF', // Bright Blue (Images / Default 2)
  '#7566F6', // Indigo (Education / Default 3)
  '#10B981', // Emerald (Finance / Default 4)
  '#F59E0B', // Amber (Projects / Default 5)
  '#EC4899', // Pink (Media / Default 6)
  '#14B8A6', // Teal
  '#F97316'  // Orange
];

export const FileDistributionChart = ({ categories = [], isLoading = false, hasError = false, onRetry }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (hasError) {
    return (
      <div className="glass-panel p-4 rounded-2xl border border-red-500/30 bg-[#0A1629] text-center space-y-2 h-full flex flex-col justify-center">
        <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="space-y-0.5">
          <h4 className="text-xs font-bold text-[#F4F7FF]">Couldn't load file overview</h4>
          <p className="text-[10px] text-[#A7B7D0]">Please check backend connection.</p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mx-auto text-[11px] py-1">
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  // Calculate total files
  const totalFiles = categories.reduce((sum, c) => sum + (c.fileCount || 0), 0);

  // SVG Donut geometry
  const size = 112;
  const strokeWidth = 14;
  const center = size / 2;
  const radius = center - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;
  const segments = categories.map((cat, idx) => {
    const pct = cat.percentage || (totalFiles > 0 ? (cat.fileCount / totalFiles) * 100 : 0);
    const dashoffset = circumference * (1 - cumulativePercent / 100);
    const dasharray = `${(pct / 100) * circumference} ${circumference}`;
    cumulativePercent += pct;
    return {
      category: cat.category,
      fileCount: cat.fileCount,
      percentage: pct,
      color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
      dasharray,
      dashoffset
    };
  });

  const activeSegment = hoveredIdx !== null ? segments[hoveredIdx] : null;

  return (
    <div className="glass-panel p-3 rounded-xl border border-[rgba(139,170,215,0.14)] bg-[#0A1629] flex flex-col justify-between h-full shadow-sm">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-[rgba(139,170,215,0.14)] pb-1.5 mb-1.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <PieChart className="w-3.5 h-3.5 text-[#4B91FF]" />
          <h3 className="font-bold text-[11px] text-[#F4F7FF] uppercase tracking-wider">
            File Category Overview
          </h3>
        </div>
        {totalFiles > 0 && (
          <span className="text-[10px] font-mono font-bold text-[#4B91FF] bg-[#3478F6]/10 px-2 py-0.5 rounded-full border border-[#3478F6]/20">
            {totalFiles} Total
          </span>
        )}
      </div>

      {/* Content Body */}
      {isLoading ? (
        <div className="animate-pulse flex flex-col items-center justify-center p-6 space-y-3 my-auto">
          <div className="w-20 h-20 rounded-full border-4 border-[#0E1D35] border-t-[#3478F6] animate-spin" />
          <div className="h-2.5 bg-[#0E1D35] rounded w-1/3" />
        </div>
      ) : categories.length === 0 || totalFiles === 0 ? (
        <div className="p-6 text-center text-xs text-[#A7B7D0] bg-[#0E1D35]/50 rounded-xl border border-[rgba(139,170,215,0.12)] space-y-1.5 my-auto">
          <HardDrive className="w-6 h-6 text-[#71839E] mx-auto" />
          <p className="font-semibold text-[#F4F7FF] text-xs">No file category data yet.</p>
          <p className="text-[10px] text-[#A7B7D0]">Add a monitored folder to view file distribution.</p>
        </div>
      ) : (
        <div className="flex flex-row items-center justify-between gap-3 py-1 flex-1">
          {/* SVG Donut Visualization */}
          <div className="relative shrink-0 flex items-center justify-center p-1">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 filter drop-shadow-md">
              {/* Track */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke="#0E1D35"
                strokeWidth={strokeWidth}
              />
              {/* Segments */}
              {segments.map((seg, i) => {
                const isHovered = hoveredIdx === i;
                return (
                  <circle
                    key={i}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={seg.dasharray}
                    strokeDashoffset={seg.dashoffset}
                    strokeLinecap="round"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="transition-all duration-200 cursor-pointer"
                  />
                );
              })}
            </svg>

            {/* Donut Center Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              {activeSegment ? (
                <>
                  <span className="text-base sm:text-lg font-black text-[#F4F7FF] font-mono leading-none">
                    {activeSegment.fileCount}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#4B91FF] truncate max-w-[65px] mt-0.5">
                    {activeSegment.category}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-lg sm:text-xl font-black text-[#F4F7FF] font-mono leading-none">{totalFiles}</span>
                  <span className="text-[9px] font-bold text-[#A7B7D0] uppercase tracking-wider mt-0.5">Files</span>
                </>
              )}
            </div>
          </div>

          {/* Legend Items */}
          <div className="flex-1 space-y-1.5 min-w-0 max-h-[145px] overflow-y-auto custom-scrollbar pr-1">
            {segments.map((seg, idx) => {
              const isHovered = hoveredIdx === idx;
              return (
                <div 
                  key={idx}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`p-1.5 px-2.5 rounded-lg border transition-all duration-150 flex items-center justify-between text-xs cursor-pointer ${
                    isHovered 
                      ? 'bg-[#182F50] border-[#3478F6]/50 shadow-sm' 
                      : 'bg-[#0E1D35]/80 border-[rgba(139,170,215,0.12)] hover:bg-[#132642]'
                  }`}
                  title={`${seg.category}: ${seg.fileCount} files (${seg.percentage.toFixed(1)}%)`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span 
                      className="w-2.5 h-2.5 rounded-sm shrink-0" 
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="font-semibold text-[#F4F7FF] capitalize truncate text-xs">
                      {seg.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                    <span className="text-[#F4F7FF] font-black">{seg.fileCount}</span>
                    <span className="text-[#A7B7D0] text-[10px] font-semibold">{seg.percentage.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
