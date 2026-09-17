import React, { useState } from 'react';
import { PieChart, RefreshCw, AlertTriangle, HardDrive } from 'lucide-react';
import { Button } from '../common/Button';

// Category color map matching Memora design system
const COLOR_PALETTE = [
  '#3B82F6', // Blue (Documents / Default 1)
  '#A855F7', // Purple (Education / Default 2)
  '#10B981', // Emerald (Images / Default 3)
  '#F59E0B', // Amber (Projects / Default 4)
  '#EC4899', // Pink (Finance / Default 5)
  '#6366F1', // Indigo (Other / Default 6)
  '#14B8A6', // Teal
  '#F97316'  // Orange
];

export const FileDistributionChart = ({ categories = [], isLoading = false, hasError = false, onRetry }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (hasError) {
    return (
      <div className="glass-panel p-4 rounded-2xl border border-red-500/30 bg-slate-900/90 text-center space-y-2 h-full flex flex-col justify-center">
        <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="space-y-0.5">
          <h4 className="text-xs font-bold text-white">Couldn't load file overview</h4>
          <p className="text-[10px] text-slate-400">Please check backend connection.</p>
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
  const size = 125;
  const strokeWidth = 16;
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
    <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-slate-800 flex flex-col justify-between h-full shadow-lg shadow-black/20">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-purple-400" />
          <h3 className="font-bold text-xs text-white uppercase tracking-wider">
            File Overview
          </h3>
        </div>
        {totalFiles > 0 && (
          <span className="text-[11px] font-mono font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
            {totalFiles} Total
          </span>
        )}
      </div>

      {/* Content Body */}
      {isLoading ? (
        <div className="animate-pulse flex flex-col items-center justify-center p-6 space-y-3 my-auto">
          <div className="w-24 h-24 rounded-full border-4 border-slate-800 border-t-purple-500 animate-spin" />
          <div className="h-2.5 bg-slate-800 rounded w-1/3" />
        </div>
      ) : categories.length === 0 || totalFiles === 0 ? (
        <div className="p-6 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800/50 space-y-1.5 my-auto">
          <HardDrive className="w-6 h-6 text-slate-600 mx-auto" />
          <p className="font-semibold text-slate-300 text-xs">No file category data yet.</p>
          <p className="text-[10px] text-slate-400">Add a folder to populate file distribution.</p>
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
                stroke="#1E293B"
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
                  <span className="text-base sm:text-lg font-black text-white font-mono leading-none">
                    {activeSegment.fileCount}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-purple-400 truncate max-w-[65px] mt-0.5">
                    {activeSegment.category}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-lg sm:text-xl font-black text-white font-mono leading-none">{totalFiles}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Files</span>
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
                      ? 'bg-slate-800/90 border-purple-500/40 shadow-sm' 
                      : 'bg-slate-950/40 border-slate-800/60 hover:bg-slate-900/60'
                  }`}
                  title={`${seg.category}: ${seg.fileCount} files (${seg.percentage.toFixed(1)}%)`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span 
                      className="w-2.5 h-2.5 rounded-sm shrink-0" 
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="font-semibold text-slate-200 capitalize truncate text-xs">
                      {seg.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                    <span className="text-white font-black">{seg.fileCount}</span>
                    <span className="text-slate-400 text-[10px] font-semibold">{seg.percentage.toFixed(0)}%</span>
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
