import React, { useState, useEffect } from 'react';
import { X, ArrowRight, FolderOutput, CheckCircle2, ShieldCheck, FileText, Info, Copy, Folder, AlertTriangle, RefreshCw, Sparkles, Edit3 } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { organizationService } from '../../services/organizationService';

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
  const [missingFileDetails, setMissingFileDetails] = useState(null);

  // Collective folder state
  const [collectiveFolderName, setCollectiveFolderName] = useState('');
  const [isLoadingCollective, setIsLoadingCollective] = useState(false);

  // Filter items to organize
  const itemsToOrganize = suggestions.filter(
    (item) => item.status === 'Accepted' || item.status === 'Edited' || item.status === 'Pending'
  );

  useEffect(() => {
    if (isOpen && itemsToOrganize.length > 0) {
      fetchCollectiveFolder();
    } else {
      setCollectiveFolderName('');
    }
  }, [isOpen, suggestions]);

  const fetchCollectiveFolder = async () => {
    setIsLoadingCollective(true);
    try {
      const suggestionIds = itemsToOrganize.map(i => i.db_id || i.id).filter(Boolean);
      const fileIds = itemsToOrganize.map(i => i.file_id).filter(Boolean);
      const res = await organizationService.getCollectiveFolder(suggestionIds, fileIds);
      if (res && res.folder_name) {
        setCollectiveFolderName(res.folder_name);
      } else {
        setCollectiveFolderName('Organized Files');
      }
    } catch (err) {
      console.warn('Failed to fetch collective folder name:', err);
      setCollectiveFolderName('Organized Files');
    } finally {
      setIsLoadingCollective(false);
    }
  };

  if (!isOpen) return null;

  const folderNameClean = (collectiveFolderName || '').trim() || 'Organized Files';

  const handleConfirm = async () => {
    setErrorMessage('');
    setMissingFileDetails(null);
    if (!onConfirmSuccess) return;
    
    setIsSubmitting(true);
    try {
      // Sync collective folder name to all items being organized
      for (const item of itemsToOrganize) {
        const rawId = item.db_id || item.id;
        try {
          await organizationService.updateSuggestion(rawId, 'edited', folderNameClean);
        } catch (e) {
          console.error('Failed to sync edited category on confirm:', e);
        }
      }

      const targetIds = itemsToOrganize.map((item) => item.id);
      const result = await onConfirmSuccess(operationMode, targetIds, folderNameClean);
      if (result && (result.files_moved > 0 || result.files_copied > 0)) {
        setIsConfirmed(true);
      } else {
        const errDetail = (result && result.errors && result.errors.length > 0)
          ? result.errors.join(', ')
          : (result && result.message) || 'No files were organized. Please verify selected files exist on disk.';

        const isMissingErr = errDetail.toLowerCase().includes('does not exist') || errDetail.toLowerCase().includes('not found') || errDetail.toLowerCase().includes('no files');

        if (isMissingErr && itemsToOrganize.length > 0) {
          setMissingFileDetails({
            recordedPath: itemsToOrganize[0].currentPath || 'Unknown path',
            filename: itemsToOrganize[0].filename
          });
        }
        setErrorMessage(errDetail);
      }
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred while organizing files.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRescanFolder = async () => {
    try {
      await apiService.scanFiles();
      setErrorMessage('');
      setMissingFileDetails(null);
      onClose();
    } catch (err) {
      console.error('Failed to trigger scan:', err);
    }
  };

  const handleCloseAll = () => {
    setIsConfirmed(false);
    setIsSubmitting(false);
    setErrorMessage('');
    setMissingFileDetails(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div
        className="w-full max-w-3xl glass-panel bg-slate-900 border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {isConfirmed ? (
          /* SUCCESS STATE */
          <div className="p-8 flex flex-col items-center text-center my-auto space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h3 className="text-xl font-extrabold text-white">
              ✓ Folder Organization Complete
            </h3>

            <p className="text-sm font-medium text-slate-300 max-w-md leading-relaxed">
              {itemsToOrganize.length} file(s) successfully {operationMode === 'move' ? 'moved' : 'copied'} into physical folder <strong className="text-emerald-300 font-mono">📁 {folderNameClean}</strong>.
            </p>

            <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-slate-300 font-medium flex items-center gap-3 max-w-md text-left">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="font-semibold text-white block">Physical Folders Updated</span>
                Memora has moved/copied the files on disk and updated its internal path index.
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseAll}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-500/25 border border-blue-500/30 transition-all cursor-pointer mt-2"
            >
              Done & Return to Table
            </button>
          </div>
        ) : (
          /* PREVIEW STATE */
          <>
            {/* Sticky Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <FolderOutput className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Folder Organization Preview</h3>
                  <p className="text-xs text-slate-400">Review physical file operations and destination paths before confirming</p>
                </div>
              </div>
              <button
                onClick={handleCloseAll}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* CREATE NEW FOLDER SECTION */}
            <div className="p-5 bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 border-b border-blue-500/30 space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-300 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span>CREATE NEW FOLDER (Collective AI Suggestion)</span>
                </span>
                {isLoadingCollective && (
                  <span className="text-[11px] text-blue-400 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Generating folder name...
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Folder Name:
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-blue-400">
                      <Folder className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={collectiveFolderName}
                      onChange={(e) => setCollectiveFolderName(e.target.value)}
                      placeholder="e.g. Java OOP Study"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-blue-500/50 rounded-xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 shadow-inner font-mono"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Edit the collective physical folder name above. All selected files will be placed into this folder.
                </p>
              </div>
            </div>

            {/* Stat Banner & Operation Selection Radio Cards */}
            <div className="p-5 bg-slate-950/80 border-b border-slate-800/80 space-y-3 shrink-0">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold text-sm text-white">
                  Selected files to organize: <strong className="text-blue-400 font-bold">{itemsToOrganize.length}</strong>
                </span>
                <span className="text-[11px] text-slate-400">Choose organization mode:</span>
              </div>

              {/* Move vs Copy Radio Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Move Option Card */}
                <div
                  onClick={() => setOperationMode('move')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    operationMode === 'move'
                      ? 'bg-blue-600/15 border-blue-500/60 text-white shadow-md shadow-blue-500/10'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="opMode"
                    checked={operationMode === 'move'}
                    onChange={() => setOperationMode('move')}
                    className="mt-0.5 text-blue-500 focus:ring-blue-500/30 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-xs text-white block">○ Move Files</span>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Relocate original files from current directories into <strong>{folderNameClean}</strong>.
                    </p>
                  </div>
                </div>

                {/* Copy Option Card */}
                <div
                  onClick={() => setOperationMode('copy')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    operationMode === 'copy'
                      ? 'bg-blue-600/15 border-blue-500/60 text-white shadow-md shadow-blue-500/10'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="opMode"
                    checked={operationMode === 'copy'}
                    onChange={() => setOperationMode('copy')}
                    className="mt-0.5 text-blue-500 focus:ring-blue-500/30 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-xs text-white block">○ Copy Files</span>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Keep original files in place and create copies inside <strong>{folderNameClean}</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Error / Missing File Alert Banner */}
            {errorMessage && (
              <div className="p-4 bg-red-950/40 border-b border-red-500/30 text-red-200 text-xs space-y-2 shrink-0">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-sm font-bold text-white block mb-0.5">
                      Memora could not find this file at its recorded location.
                    </strong>
                    <p className="text-xs text-red-300/90 leading-relaxed">
                      {errorMessage}
                    </p>
                    {missingFileDetails && (
                      <div className="mt-2 p-2.5 rounded-lg bg-slate-950 border border-red-500/30 font-mono text-[11px] text-red-300 space-y-1">
                        <div><strong>Recorded location:</strong> {missingFileDetails.recordedPath}</div>
                        <div><strong>Possible reason:</strong> The file may have been moved, renamed, or deleted manually outside of Memora.</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleRescanFolder}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Rescan Folder Now</span>
                  </button>
                </div>
              </div>
            )}

            {/* Explanatory Banner: Safety Note */}
            <div className="px-6 py-2.5 bg-slate-950/90 border-b border-slate-800/80 text-[11px] text-slate-300 flex items-center gap-2 shrink-0">
              <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>
                Safety Check: Files remain in place until you click <strong>Confirm Organization</strong>.
              </span>
            </div>

            {/* Scrollable Content List */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-3">
              {itemsToOrganize.map((item) => {
                return (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-950/90 rounded-xl border border-slate-800/80 space-y-2 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="font-bold text-sm text-white font-mono">{item.filename}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono pt-1">
                      {/* Current Location */}
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">
                          CURRENT LOCATION
                        </span>
                        <p className="text-slate-300 text-[11px] truncate" title={item.currentPath}>
                          {item.currentPath}
                        </p>
                      </div>

                      {/* Proposed Destination */}
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-blue-500/30 space-y-0.5">
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block font-sans">
                          TARGET PATH ({operationMode.toUpperCase()})
                        </span>
                        <p className="text-blue-300 text-[11px] font-bold truncate" title={`${folderNameClean}/${item.filename}`}>
                          📁 {folderNameClean}/{item.filename}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sticky Actions Footer */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-950/90 border-t border-slate-800 shrink-0">
              <span className="text-xs text-slate-400 font-medium">
                Nothing is moved without explicit confirmation.
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
                  className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-blue-500/25 border border-blue-500/30 transition-all cursor-pointer disabled:opacity-50"
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
