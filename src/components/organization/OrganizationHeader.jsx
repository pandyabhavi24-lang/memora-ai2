import React from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';

export const OrganizationHeader = ({ onAnalyze, isAnalyzing, isAnalyzed }) => {
  return (
    <div className="p-5 rounded-2xl border border-[rgba(139,170,215,0.14)] bg-[#0A1629] flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 shadow-lg">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[rgba(52,120,246,0.15)] border border-[rgba(52,120,246,0.3)] flex items-center justify-center text-[#4B91FF] shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#F4F7FF] tracking-tight">
              Intelligent File Organization
            </h1>
            <span className="text-[11px] font-semibold text-[#4B91FF]">
              AI suggests taxonomy &bull; You approve all changes
            </span>
          </div>
        </div>
        <p className="text-xs text-[#A7B7D0] pl-10 font-normal leading-relaxed">
          Analyzes document and media semantics to suggest category groupings, smart tags, and duplicate consolidation.
        </p>
      </div>

      <div className="flex items-center gap-3 pl-10 sm:pl-0 shrink-0">
        <button
          type="button"
          onClick={onAnalyze}
          disabled={isAnalyzing}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#3478F6] hover:bg-[#2563EB] active:scale-95 text-white font-semibold text-xs shadow-md shadow-blue-500/20 border border-blue-400/30 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
              <span>Analyzing Documents...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-white" />
              <span>{isAnalyzed ? 'Re-Analyze Files' : 'Analyze Files'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
