import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FolderSearch, 
  BrainCircuit, 
  FolderTree, 
  Search, 
  Compass,
  CheckCircle2,
  ChevronRight,
  Sparkles
} from 'lucide-react';

export const WorkflowPipeline = ({ 
  folderCount = 0, 
  fileCount = 0, 
  suggestionCount = 0, 
  isScanning = false 
}) => {
  const navigate = useNavigate();
  const [activeTooltip, setActiveTooltip] = useState(null);

  const steps = [
    {
      id: 'scan',
      label: 'Scan',
      fullName: 'Scan Folders',
      icon: FolderSearch,
      color: 'from-blue-500 to-cyan-500',
      textColor: 'text-[#4B91FF]',
      borderColor: 'hover:border-[#3478F6]/50',
      accentBg: 'bg-[#3478F6]/10 border-[#3478F6]/20',
      topLine: 'bg-gradient-to-r from-[#3478F6] to-[#4B91FF]',
      statusText: isScanning ? 'Scanning...' : `${folderCount} folder${folderCount === 1 ? '' : 's'} active`,
      statusState: isScanning ? 'active' : (folderCount > 0 ? 'ready' : 'idle'),
      description: 'Memora watches your selected folders and detects your documents and photos.',
      actionPath: '/folders'
    },
    {
      id: 'understand',
      label: 'Understand',
      fullName: 'Read Files',
      icon: BrainCircuit,
      color: 'from-purple-500 to-indigo-500',
      textColor: 'text-purple-400',
      borderColor: 'hover:border-purple-500/50',
      accentBg: 'bg-purple-500/10 border-purple-500/20',
      topLine: 'bg-gradient-to-r from-[#7566F6] to-purple-500',
      statusText: `${fileCount} file${fileCount === 1 ? '' : 's'} read`,
      statusState: fileCount > 0 ? 'ready' : 'idle',
      description: 'Reads and understands your documents and photos, all locally on your device.',
      actionPath: '/media'
    },
    {
      id: 'organize',
      label: 'Organize',
      fullName: 'Organize',
      icon: FolderTree,
      color: 'from-amber-500 to-orange-500',
      textColor: 'text-amber-400',
      borderColor: 'hover:border-amber-500/50',
      accentBg: 'bg-amber-500/10 border-amber-500/20',
      topLine: 'bg-gradient-to-r from-amber-500 to-orange-500',
      statusText: suggestionCount > 0 ? `${suggestionCount} suggestions` : 'Ready to organize',
      statusState: 'ready',
      description: 'Suggests categories and tags for your files. You approve all changes before anything moves.',
      actionPath: '/organize'
    },
    {
      id: 'search',
      label: 'Search',
      fullName: 'Find Files',
      icon: Search,
      color: 'from-emerald-500 to-teal-500',
      textColor: 'text-emerald-400',
      borderColor: 'hover:border-emerald-500/50',
      accentBg: 'bg-emerald-500/10 border-emerald-500/20',
      topLine: 'bg-gradient-to-r from-emerald-500 to-teal-500',
      statusText: 'Search ready',
      statusState: 'ready',
      description: 'Search by meaning — not just exact filenames. Find anything in your files instantly.',
      actionPath: '/search'
    },
    {
      id: 'discover',
      label: 'Discover',
      fullName: 'Discover',
      icon: Compass,
      color: 'from-pink-500 to-rose-500',
      textColor: 'text-pink-400',
      borderColor: 'hover:border-pink-500/50',
      accentBg: 'bg-pink-500/10 border-pink-500/20',
      topLine: 'bg-gradient-to-r from-pink-500 to-rose-500',
      statusText: 'Discovery active',
      statusState: 'ready',
      description: 'Find related files and similar documents based on what you are working on.',
      actionPath: '/results'
    }
  ];

  return (
    <div className="glass-panel p-2 sm:p-2.5 rounded-xl border border-[rgba(139,170,215,0.14)] bg-[#0A1629] shadow-sm">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-[#4B91FF]" />
          <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-[#F4F7FF]">
            How Memora Works
          </span>
        </div>
        <span className="text-[9px] text-[#A7B7D0] font-medium hidden sm:inline-block">
          Click any step to open it
        </span>
      </div>

      {/* Pipeline Steps Row */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2 relative">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isHovered = activeTooltip === step.id;

          return (
            <div key={step.id} className="relative flex items-center">
              <button
                type="button"
                onClick={() => step.actionPath && navigate(step.actionPath)}
                onMouseEnter={() => setActiveTooltip(step.id)}
                onMouseLeave={() => setActiveTooltip(null)}
                onFocus={() => setActiveTooltip(step.id)}
                onBlur={() => setActiveTooltip(null)}
                className={`w-full p-1.5 sm:p-2 rounded-lg border border-[rgba(139,170,215,0.14)] bg-[#0E1D35] ${step.borderColor} hover:bg-[#132642] transition-all duration-200 text-left group cursor-pointer flex flex-col justify-between min-h-[44px] sm:min-h-[48px] relative overflow-hidden shadow-xs`}
                aria-label={`${step.label}: ${step.fullName}`}
              >
                {/* Step Top Color Accent Line */}
                <div className={`absolute top-0 left-0 right-0 h-[2px] ${step.topLine}`} />

                {/* Step Header */}
                <div className="flex items-center justify-between gap-1 w-full mb-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className={`p-1 rounded bg-[#06101F] ${step.textColor} shrink-0 group-hover:scale-110 transition-transform border border-[rgba(139,170,215,0.12)]`}>
                      <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </div>
                    <span className="font-bold text-[11px] sm:text-xs text-[#F4F7FF] tracking-tight truncate">
                      {step.label}
                    </span>
                  </div>
                  
                  {/* Status Badge */}
                  <span className="shrink-0 flex items-center">
                    {step.statusState === 'active' ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4B91FF] animate-ping"></span>
                    ) : (
                      <CheckCircle2 className={`w-3 h-3 ${step.textColor} opacity-90`} />
                    )}
                  </span>
                </div>

                {/* Step Subtext */}
                <div className="text-[9px] font-medium text-[#A7B7D0] truncate leading-tight">
                  {step.statusText}
                </div>
              </button>

              {/* Connecting Flow Indicator (between steps) */}
              {idx < steps.length - 1 && (
                <div className="hidden lg:flex absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 text-[#71839E] pointer-events-none">
                  <ChevronRight className="w-4 h-4" />
                </div>
              )}

              {/* Hover Tooltip Overlay */}
              {isHovered && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-60 p-3 rounded-xl bg-[#0A1629] border border-[rgba(139,170,215,0.24)] text-[#F4F7FF] text-xs shadow-2xl z-50 backdrop-blur-xl pointer-events-none animate-in fade-in duration-150">
                  <div className="flex items-center justify-between gap-2 mb-1 border-b border-[rgba(139,170,215,0.14)] pb-1.5">
                    <span className={`font-bold text-xs ${step.textColor}`}>
                      {step.fullName}
                    </span>
                    <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#0E1D35] text-[#A7B7D0]">
                      Step {idx + 1}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#A7B7D0] leading-snug">
                    {step.description}
                  </p>
                  <div className="mt-2 text-[10px] text-[#4B91FF] font-semibold flex items-center justify-between">
                    <span>Click to open {step.label}</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                  {/* Arrow Tip */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-[#0A1629]" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
