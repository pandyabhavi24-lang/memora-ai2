import React from 'react';
import { CheckCircle2, Loader2, Circle, Sparkles, AlertCircle } from 'lucide-react';

export const AnalysisProgress = ({ currentStep, isComplete, isError, onRetry }) => {
  const steps = [
    { id: 1, label: 'Scanning files...' },
    { id: 2, label: 'Reading metadata...' },
    { id: 3, label: 'Analyzing content...' },
    { id: 4, label: 'Generating organization suggestions...' },
    { id: 5, label: 'Checking possible duplicates...' }
  ];

  if (isError) {
    return (
      <div className="p-6 bg-red-950/30 rounded-2xl border border-red-800/60 mb-6 flex flex-col items-center justify-center text-center shadow-xl">
        <div className="w-12 h-12 rounded-full bg-red-900/40 border border-red-700/50 flex items-center justify-center text-red-400 mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">
          Something went wrong while analyzing your files.
        </h3>
        <p className="text-xs text-slate-400 mb-4 max-w-md">
          The simulated background file analysis encountered an error. Please try running the analysis process again.
        </p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="glass-panel p-5 rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-950/40 via-slate-900/90 to-indigo-950/30 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-md">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Analysis Complete
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Ready for review
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              <strong className="text-slate-200 font-semibold">24</strong> files analyzed • <strong className="text-slate-200 font-semibold">18</strong> suggestions generated • <strong className="text-slate-200 font-semibold">3</strong> duplicate candidate groups found
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-slate-900/90 px-3.5 py-2 rounded-xl border border-emerald-500/30 backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>All suggestions parsed successfully</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 bg-slate-900/80 mb-6 space-y-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
          <span>Analyzing Files & Content...</span>
        </h3>
        <span className="text-xs font-mono font-medium text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
          Step {Math.min(currentStep, 5)} of 5
        </span>
      </div>

      {/* Progress Steps Indicator */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-1">
        {steps.map((step) => {
          const isDone = currentStep > step.id;
          const isCurrent = currentStep === step.id;

          return (
            <div
              key={step.id}
              className={`p-3 rounded-xl border text-left transition-all duration-300 ${
                isDone
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : isCurrent
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-200 shadow-sm shadow-blue-500/10 ring-1 ring-blue-500/20'
                  : 'bg-slate-950/50 border-slate-800/60 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-600 shrink-0" />
                )}
                <span className="text-[11px] font-mono font-semibold">
                  Step {step.id}
                </span>
              </div>
              <p className="text-xs font-medium leading-snug line-clamp-1">
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
