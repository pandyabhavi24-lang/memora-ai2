import React from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';

export const OrganizationHeader = ({ onAnalyze, isAnalyzing, isAnalyzed }) => {
  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 bg-slate-900/80 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shadow-xl">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Intelligent File Organization
            </h1>
            <span className="text-[11px] font-semibold text-blue-400">
              Memora suggests. You decide.
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-300 pl-10 font-medium leading-relaxed">
          Memora reads file content to suggest target categories and physical folder locations on your computer.
        </p>
      </div>

      <div className="flex items-center gap-3 pl-10 sm:pl-0">
        <button
          onClick={onAnalyze}
          disabled={isAnalyzing}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 active:to-indigo-700 text-white font-medium text-xs shadow-lg shadow-blue-500/20 border border-blue-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
              <span>Analyzing Files...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-blue-200" />
              <span>{isAnalyzed ? 'Re-Analyze Files' : 'Analyze Files'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
