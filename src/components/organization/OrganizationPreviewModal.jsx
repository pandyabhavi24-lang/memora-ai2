import React, { useState } from 'react';
import { X, ArrowRight, FolderOutput, CheckCircle2, ShieldCheck, FileText } from 'lucide-react';

export const OrganizationPreviewModal = ({
  isOpen,
  onClose,
  suggestions = [],
  onConfirmSuccess
}) => {
  const [isConfirmed, setIsConfirmed] = useState(false);

  if (!isOpen) return null;

  // Filter items to organize (Accepted or Edited or all valid suggestions)
  const itemsToOrganize = suggestions.filter(
    (item) => item.status === 'Accepted' || item.status === 'Edited' || item.status === 'Pending'
  );

  const handleConfirm = () => {
    setIsConfirmed(true);
    if (onConfirmSuccess) {
      onConfirmSuccess();
    }
  };

  const handleCloseAll = () => {
    setIsConfirmed(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-2xl glass-panel bg-slate-900 border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {isConfirmed ? (
          /* SUCCESS STATE */
          <div className="p-8 flex flex-col items-center text-center my-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-lg">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h3 className="text-xl font-extrabold text-white mb-1">
              Organization Approved
            </h3>

            <p className="text-sm font-medium text-slate-300 mb-4 max-w-md">
              Your organization plan has been approved successfully.
            </p>

            <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-6 text-xs text-blue-300 font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Demo Mode — no files were moved, copied, or modified on disk.</span>
            </div>

            <button
              type="button"
              onClick={handleCloseAll}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-500/25 border border-blue-500/30 transition-all cursor-pointer"
            >
              Back to Suggestions
            </button>
          </div>
        ) : (
          /* PREVIEW STATE */
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <FolderOutput className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Review Organization</h3>
                  <p className="text-xs text-slate-400">Review the proposed changes before applying them.</p>
                </div>
              </div>
              <button
                onClick={handleCloseAll}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stat Banner */}
            <div className="px-6 py-3 bg-blue-500/10 border-b border-blue-500/20 flex items-center justify-between text-xs text-blue-300">
              <span className="font-semibold">
                Files to organize: <strong className="text-white font-bold">{itemsToOrganize.length}</strong>
              </span>
              <span className="text-blue-400 font-medium italic">
                Nothing has been moved yet.
              </span>
            </div>

            {/* Content List */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-3">
              {itemsToOrganize.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  {/* Current Location */}
                  <div className="flex-1 space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      CURRENT LOCATION
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-slate-300 font-semibold truncate">
                      <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{item.currentPath}</span>
                    </div>
                  </div>

                  {/* Arrow Indicator */}
                  <div className="self-center text-blue-400 sm:px-2">
                    <ArrowRight className="w-4 h-4 rotate-90 sm:rotate-0" />
                  </div>

                  {/* Proposed Location */}
                  <div className="flex-1 space-y-0.5 text-left sm:text-right">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">
                      PROPOSED LOCATION
                    </span>
                    <div className="flex items-center sm:justify-end gap-1.5 font-mono text-blue-300 font-bold truncate">
                      <span>{item.suggestedCategory}/{item.filename}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-950/90 border-t border-slate-800">
              <span className="text-[11px] text-slate-500 font-mono">
                Frontend Demo Sandbox Mode
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCloseAll}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-blue-500/25 border border-blue-500/30 transition-all cursor-pointer"
                >
                  Confirm Organization
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
