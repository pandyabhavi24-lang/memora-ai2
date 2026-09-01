import React, { useState, useEffect } from 'react';
import { Copy, ArrowLeftRight, Eye, ShieldCheck, X, Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { organizationService } from '../../services/organizationService';

export const DuplicatesSection = ({ refreshTrigger }) => {
  const [duplicates, setDuplicates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeDuplicate, setActiveDuplicate] = useState(null);

  const fetchDuplicates = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await organizationService.getDuplicates();
      setDuplicates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load duplicate files from backend API:', err);
      setError('Unable to load duplicate results.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDuplicates();
  }, [refreshTrigger]);

  const handleOpenReview = (dup) => {
    setActiveDuplicate(dup);
  };

  const handleCloseReview = () => {
    setActiveDuplicate(null);
  };

  const handleKeepBoth = (id) => {
    setDuplicates((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'Kept Both' } : item))
    );
    setActiveDuplicate(null);
  };

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/80 bg-slate-900/80 backdrop-blur-md p-6 mb-8 shadow-xl">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Copy className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Possible Duplicates
            </h2>
            <p className="text-xs text-slate-400">
              Files with identical or near-identical text content detected.
            </p>
          </div>
        </div>

        {!loading && !error && duplicates.length > 0 && (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            {duplicates.length} {duplicates.length === 1 ? 'group' : 'groups'} found
          </span>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
          <p className="text-xs font-medium text-slate-400">Checking for duplicates...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="py-10 text-center flex flex-col items-center justify-center space-y-3 bg-slate-950/40 rounded-xl border border-red-500/20 p-6">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-300">{error}</p>
          <button
            type="button"
            onClick={fetchDuplicates}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700/80 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && duplicates.length === 0 && (
        <div className="py-12 text-center flex flex-col items-center justify-center space-y-2 bg-slate-950/30 rounded-xl border border-slate-800/50 p-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-1">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">No possible duplicates found</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            Memora didn't detect any duplicate files in the scanned folders.
          </p>
        </div>
      )}

      {/* Duplicate Pairs Cards (Real API Data) */}
      {!loading && !error && duplicates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {duplicates.map((dup) => (
            <div
              key={dup.id}
              className="p-4 bg-slate-950/70 rounded-xl border border-slate-800/80 hover:border-amber-500/30 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Top Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      dup.detectionType === 'Exact duplicate'
                        ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                        : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                    }`}
                  >
                    {dup.detectionType}
                  </span>

                  <span className="font-mono text-xs font-bold text-amber-400">
                    {dup.similarity}% similar
                  </span>
                </div>

                {/* Pair Visualization */}
                <div className="space-y-2 mb-4">
                  <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800 font-mono text-xs text-slate-200 font-semibold truncate" title={dup.fileA?.filename}>
                    {dup.fileA?.filename}
                  </div>

                  <div className="flex items-center justify-center text-slate-500">
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </div>

                  <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800 font-mono text-xs text-slate-200 font-semibold truncate" title={dup.fileB?.filename}>
                    {dup.fileB?.filename}
                  </div>
                </div>
              </div>

              {/* Bottom Action */}
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
                <span className="text-[11px] font-medium text-slate-400">
                  Status: <strong className="text-slate-200">{dup.status}</strong>
                </span>

                <button
                  type="button"
                  onClick={() => handleOpenReview(dup)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 hover:text-white font-medium text-xs border border-slate-700/60 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Review</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {activeDuplicate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-lg glass-panel bg-slate-900 border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Duplicate Review</h3>
                  <p className="text-xs text-slate-400">Compare candidate file pair</p>
                </div>
              </div>
              <button
                onClick={handleCloseReview}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs font-semibold text-amber-300">
                <span>Detection Type: <strong>{activeDuplicate.detectionType}</strong></span>
                <span className="font-mono text-amber-400">{activeDuplicate.similarity}% Similarity</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    FILE A
                  </span>
                  <p className="text-xs font-bold text-white font-mono truncate" title={activeDuplicate.fileA?.filename}>
                    {activeDuplicate.fileA?.filename}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono truncate" title={activeDuplicate.fileA?.path}>
                    {activeDuplicate.fileA?.path}
                  </p>
                  <span className="inline-block text-[10px] font-mono text-slate-400 mt-2">
                    Size: {activeDuplicate.fileA?.size}
                  </span>
                </div>

                <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    FILE B
                  </span>
                  <p className="text-xs font-bold text-white font-mono truncate" title={activeDuplicate.fileB?.filename}>
                    {activeDuplicate.fileB?.filename}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono truncate" title={activeDuplicate.fileB?.path}>
                    {activeDuplicate.fileB?.path}
                  </p>
                  <span className="inline-block text-[10px] font-mono text-slate-400 mt-2">
                    Size: {activeDuplicate.fileB?.size}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Detection only — deletion capabilities are disabled in Demo Mode.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-950/90 border-t border-slate-800">
              <button
                type="button"
                onClick={handleCloseReview}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleKeepBoth(activeDuplicate.id)}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-500/25 border border-blue-500/30 transition-all cursor-pointer"
              >
                Keep Both
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
