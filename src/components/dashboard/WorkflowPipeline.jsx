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
      fullName: 'Folder Ingestion & Scan',
      icon: FolderSearch,
      color: 'from-blue-500 to-cyan-500',
      textColor: 'text-blue-400',
      borderColor: 'hover:border-blue-500/50',
      accentBg: 'bg-blue-500/10 border-blue-500/20',
      topLine: 'bg-gradient-to-r from-blue-500 to-cyan-500',
      statusText: isScanning ? 'Scanning...' : `${folderCount} folder${folderCount === 1 ? '' : 's'} active`,
      statusState: isScanning ? 'active' : (folderCount > 0 ? 'ready' : 'idle'),
      description: 'Memora scans user-selected directories and detects supported documents & media.',
      actionPath: '/folders'
    },
    {
      id: 'understand',
      label: 'Understand',
      fullName: 'AI Intelligence Extraction',
      icon: BrainCircuit,
      color: 'from-purple-500 to-indigo-500',
      textColor: 'text-purple-400',
      borderColor: 'hover:border-purple-500/50',
      accentBg: 'bg-purple-500/10 border-purple-500/20',
      topLine: 'bg-gradient-to-r from-purple-500 to-indigo-500',
      statusText: `${fileCount} file${fileCount === 1 ? '' : 's'} indexed`,
      statusState: fileCount > 0 ? 'ready' : 'idle',
      description: 'Extracts deep text snippets, OCR image text, metadata, and semantic embeddings offline.',
      actionPath: '/media'
    },
    {
      id: 'organize',
      label: 'Organize',
      fullName: 'Smart Classification & Tagging',
      icon: FolderTree,
      color: 'from-amber-500 to-orange-500',
      textColor: 'text-amber-400',
      borderColor: 'hover:border-amber-500/50',
      accentBg: 'bg-amber-500/10 border-amber-500/20',
      topLine: 'bg-gradient-to-r from-amber-500 to-orange-500',
      statusText: suggestionCount > 0 ? `${suggestionCount} suggestions` : 'Taxonomy ready',
      statusState: 'ready',
      description: 'Generates AI category suggestions, smart tags, and duplicate detection without altering disk files.',
      actionPath: '/organize'
    },
    {
      id: 'search',
      label: 'Search',
      fullName: 'Semantic & Natural Query',
      icon: Search,
      color: 'from-emerald-500 to-teal-500',
      textColor: 'text-emerald-400',
      borderColor: 'hover:border-emerald-500/50',
      accentBg: 'bg-emerald-500/10 border-emerald-500/20',
      topLine: 'bg-gradient-to-r from-emerald-500 to-teal-500',
      statusText: 'Semantic search ready',
      statusState: 'ready',
      description: 'Query your workspace memories by concept, meaning, keywords, or OCR text instantly.',
      actionPath: '/search'
    },
    {
      id: 'discover',
      label: 'Discover',
      fullName: 'Contextual Discovery & Connections',
      icon: Compass,
      color: 'from-pink-500 to-rose-500',
      textColor: 'text-pink-400',
      borderColor: 'hover:border-pink-500/50',
      accentBg: 'bg-pink-500/10 border-pink-500/20',
      topLine: 'bg-gradient-to-r from-pink-500 to-rose-500',
      statusText: 'Discovery active',
      statusState: 'ready',
      description: 'Find closely related documents, similar images, and linked files based on AI embeddings.',
      actionPath: '/results'
    }
  ];

  return (
    <div className="glass-panel p-2.5 sm:p-3 rounded-2xl border-slate-800/80 shadow-md shadow-black/30">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-200">
            Memora AI Engine Workflow
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-medium hidden sm:inline-block">
          Hover step for details &bull; Click step to open module
        </span>
      </div>

      {/* Pipeline Steps Row */}
      <div className="grid grid-cols-5 gap-2 relative">
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
                className={`w-full p-2 sm:p-2.5 rounded-xl border border-slate-800 ${step.accentBg} ${step.borderColor} transition-all duration-200 text-left group cursor-pointer flex flex-col justify-between min-h-[56px] relative overflow-hidden shadow-sm hover:shadow-md`}
                aria-label={`${step.label}: ${step.fullName}`}
              >
                {/* Step Top Color Accent Line */}
                <div className={`absolute top-0 left-0 right-0 h-[2px] ${step.topLine}`} />

                {/* Step Header */}
                <div className="flex items-center justify-between gap-1 w-full mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-1.5 rounded-lg bg-slate-950/90 ${step.textColor} shrink-0 group-hover:scale-110 transition-transform`}>
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <span className="font-bold text-xs sm:text-sm text-white tracking-tight truncate">
                      {step.label}
                    </span>
                  </div>
                  
                  {/* Status Badge */}
                  <span className="shrink-0 flex items-center">
                    {step.statusState === 'active' ? (
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
                    ) : (
                      <CheckCircle2 className={`w-3.5 h-3.5 ${step.textColor} opacity-90`} />
                    )}
                  </span>
                </div>

                {/* Step Subtext */}
                <div className="text-[10px] font-medium text-slate-400 truncate">
                  {step.statusText}
                </div>
              </button>

              {/* Connecting Flow Indicator (between steps) */}
              {idx < steps.length - 1 && (
                <div className="hidden lg:flex absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 text-slate-700 pointer-events-none">
                  <ChevronRight className="w-4 h-4" />
                </div>
              )}

              {/* Hover Tooltip Overlay */}
              {isHovered && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-60 p-3 rounded-xl bg-slate-950/95 border border-slate-700 text-white text-xs shadow-2xl z-50 backdrop-blur-xl pointer-events-none animate-in fade-in duration-150">
                  <div className="flex items-center justify-between gap-2 mb-1 border-b border-slate-800 pb-1.5">
                    <span className={`font-bold text-xs ${step.textColor}`}>
                      {step.fullName}
                    </span>
                    <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      Step {idx + 1}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    {step.description}
                  </p>
                  <div className="mt-2 text-[10px] text-blue-400 font-semibold flex items-center justify-between">
                    <span>Click to open {step.label}</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                  {/* Arrow Tip */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-slate-950/95" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
