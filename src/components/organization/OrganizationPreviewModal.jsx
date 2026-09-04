import React, { useState } from 'react';
import { X, ArrowRight, FolderOutput, CheckCircle2, ShieldCheck, FileText, Info, Copy, Folder } from 'lucide-react';

export const OrganizationPreviewModal = ({
  isOpen,
  onClose,
  suggestions = [],
  onConfirmSuccess
}) => {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [operationMode, setOperationMode] = useState('move'); // 'move' | 'copy'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  // Filter items to organize (Accepted or Edited or all valid suggestions)
  const itemsToOrganize = suggestions.filter(
    (item) => item.status === 'Accepted' || item.status === 'Edited' || item.status === 'Pending'
  );

  const handleConfirm = async () => {
    setErrorMessage('');
    if (!onConfirmSuccess) return;
    
    setIsSubmitting(true);
    try {
      const targetIds = itemsToOrganize.map((item) => item.id);
      const result = await onConfirmSuccess(operationMode, targetIds);
      if (result && (result.files_moved > 0 || result.files_copied > 0)) {
        setIsConfirmed(true);
      } else {
        const errDetail = (result && result.errors && result.errors.length > 0)
          ? result.errors.join(', ')
          : (result && result.message) || 'No files were organized. Please verify selected files exist on disk.';
        setErrorMessage(errDetail);
      }
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred while organizing files.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseAll = () => {
    setIsConfirmed(false);
    setIsSubmitting(false);
    setErrorMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn select-none">
      <div
        className="w-full max-w-2xl glass-panel bg-slate-900 border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {isConfirmed ? (
          /* SUCCESS STATE */
          <div className="p-8 flex flex-col items-center text-center my-auto space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h3 className="text-xl font-extrabold text-white">
              Organization Plan Approved
            </h3>

            <p className="text-sm font-medium text-slate-300 max-w-md leading-relaxed">
              Your files have been queued for organization. {itemsToOrganize.length} file(s) will be {operationMode === 'move' ? 'moved' : 'copied'} to their target destination folders.
            </p>

            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 font-medium flex items-center gap-2 max-w-md">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Memora will update physical folder paths according to your selected plan.</span>
            </div>

            <button
              type="button"
              onClick={handleCloseAll}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-500/25 border border-blue-500/30 transition-all cursor-pointer mt-2"
            >
              Back to Suggestions
            </button>
          </div>
        ) : (
          /* PREVIEW STATE */
          <>
            {/* Sticky Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <FolderOutput className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Preview Organization</h3>
                  <p className="text-xs text-slate-400">Review physical file locations before confirming</p>
                </div>
              </div>
              <button
                onClick={handleCloseAll}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stat Banner & Operation Selection */}
            <div className="px-6 py-3 bg-blue-500/10 border-b border-blue-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-blue-300 shrink-0">
              <span className="font-semibold">
                Files to organize: <strong className="text-white font-bold">{itemsToOrganize.length}</strong>
              </span>

              {/* Move vs Copy Choice Toggle */}
              <div className="flex items-center gap-2 font-medium">
                <span className="text-slate-300">Operation:</span>
                <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setOperationMode('move')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      operationMode === 'move'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Move
                  </button>
                  <button
                    type="button"
                    onClick={() => setOperationMode('copy')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      operationMode === 'copy'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            {/* Error / Warning Banner */}
            {errorMessage && (
              <div className="px-6 py-3 bg-red-500/15 border-b border-red-500/30 text-red-300 text-xs font-semibold flex items-center justify-between shrink-0">
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Explanatory Banner: Move vs Copy Description */}
            <div className="px-6 py-2.5 bg-slate-950/80 border-b border-slate-800/80 text-[11px] text-slate-300 flex items-center gap-2 shrink-0">
              <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>
                {operationMode === 'move' 
                  ? 'Move operation: Files will be relocated from their current folder into target category folders.'
                  : 'Copy operation: Original files will stay in place; copies will be created in target category folders.'
                }
              </span>
            </div>

            {/* Scrollable Content List */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-3">
              {itemsToOrganize.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  {/* Current Location */}
                  <div className="flex-1 space-y-0.5 min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      CURRENT LOCATION
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-slate-300 font-semibold truncate" title={item.currentPath}>
                      <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{item.currentPath}</span>
                    </div>
                  </div>

                  {/* Arrow Indicator & Operation Badge */}
                  <div className="self-center text-blue-400 sm:px-2 flex flex-col items-center gap-0.5">
                    <span className="text-[9px] font-bold text-blue-400 uppercase px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                      {operationMode}
                    </span>
                    <ArrowRight className="w-4 h-4 rotate-90 sm:rotate-0 text-blue-400" />
                  </div>

                  {/* Proposed Destination */}
                  <div className="flex-1 space-y-0.5 text-left sm:text-right min-w-0">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">
                      PHYSICAL DESTINATION
                    </span>
                    <div className="flex items-center sm:justify-end gap-1.5 font-mono text-blue-300 font-bold truncate" title={`${item.suggestedCategory}/${item.filename}`}>
                      <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">{item.suggestedCategory}/{item.filename}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Sticky Actions Footer */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-950/90 border-t border-slate-800 shrink-0">
              <span className="text-[11px] text-slate-400 font-medium">
                Nothing is moved until you confirm.
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCloseAll}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-blue-500/25 border border-blue-500/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Organizing Files...' : 'Confirm Organization'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
