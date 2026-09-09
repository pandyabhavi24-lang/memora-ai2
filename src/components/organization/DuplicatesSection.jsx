import React, { useState, useEffect } from 'react';
import { Copy, ArrowLeftRight, Eye, X, Loader2, RefreshCw, AlertTriangle, CheckCircle2, Info, FolderOpen, ExternalLink, FileText } from 'lucide-react';
import { organizationService } from '../../services/organizationService';
import { apiService } from '../../services/apiService';
import { useApp } from '../../context/AppContext';

export const DuplicatesSection = ({ refreshTrigger }) => {
  const [duplicates, setDuplicates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeDuplicate, setActiveDuplicate] = useState(null);
  const [activeTooltip, setActiveTooltip] = useState(null);
  const { setPreviewFile, recordOpenedFile } = useApp();

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

  const [fileToDelete, setFileToDelete] = useState(null); // { id, filename, path }
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState(null);

  const handleOpenReview = (dup) => {
    setActiveDuplicate(dup);
    setDeleteMessage(null);
  };

  const handleCloseReview = () => {
    setActiveDuplicate(null);
    setFileToDelete(null);
    setDeleteMessage(null);
  };

  const handleKeepBoth = (id) => {
    setDuplicates((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'Kept Both' } : item))
    );
    setActiveDuplicate(null);
  };

  const handleOpenNative = (filePath, fileObj) => {
    apiService.openFile(filePath);
    if (fileObj && recordOpenedFile) {
      recordOpenedFile(fileObj);
    }
  };

  const handleLocateNative = (filePath) => {
    apiService.locateFile(filePath);
  };

  const handleConfirmDeleteFile = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      if (fileToDelete.db_id || fileToDelete.id) {
        await organizationService.deleteFile(fileToDelete.db_id || fileToDelete.id);
      }
      setDeleteMessage(`Successfully deleted duplicate copy: ${fileToDelete.filename}`);
      setDuplicates((prev) =>
        prev.map((item) => {
          if (activeDuplicate && item.id === activeDuplicate.id) {
            return { ...item, status: 'Duplicate Deleted' };
          }
          return item;
        })
      );
      setFileToDelete(null);
    } catch (err) {
      console.warn('Failed to delete file copy:', err);
      setDeleteMessage(`Could not delete file: ${err.message || 'Server error'}`);
      setFileToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!loading && !error && duplicates.length === 0) {
    return null;
  }

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

      {/* Empty State - omit entire section if no duplicates */}
      {!loading && !error && duplicates.length === 0 && null}

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
                  <span>Review Pair</span>
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
            className="w-full max-w-xl glass-panel bg-slate-900 border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Compare Duplicate Files</h3>
                  <p className="text-xs text-slate-400">Review paths and decide which copy to keep</p>
                </div>
              </div>
              <button
                onClick={handleCloseReview}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              <div className="flex items-center justify-between p-3.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs font-semibold text-amber-300 relative">
                <span className="flex items-center gap-1.5">
                  <span>Detection: <strong>{activeDuplicate.detectionType}</strong></span>
                </span>

                <div className="relative inline-flex items-center gap-1">
                  <span
                    onMouseEnter={() => setActiveTooltip(activeDuplicate.id)}
                    onMouseLeave={() => setActiveTooltip(null)}
                    className="font-mono text-amber-400 cursor-help flex items-center gap-1"
                  >
                    <span>{activeDuplicate.similarity}% Content Similarity</span>
                    <Info className="w-3.5 h-3.5 text-amber-400" />
                  </span>

                  {activeTooltip === activeDuplicate.id && (
                    <div className="absolute right-0 bottom-full mb-2 w-72 p-3 bg-gray-950 border border-gray-700 rounded-xl text-[11px] text-gray-200 shadow-2xl z-30 font-sans leading-snug animate-fadeIn">
                      <strong className="text-amber-300 block mb-1">Duplicate Similarity Score</strong>
                      This percentage represents how similar the detected files are based on Memora's duplicate-detection comparison. It is not a percentage of identical filenames.
                    </div>
                  )}
                </div>
              </div>

              {deleteMessage && (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{deleteMessage}</span>
                </div>
              )}

              {/* Side-by-Side File Comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* File A Card */}
                <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      FILE COPY A
                    </span>
                    <p className="text-xs font-bold text-white font-mono truncate" title={activeDuplicate.fileA?.filename}>
                      {activeDuplicate.fileA?.filename}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono break-all leading-tight">
                      📁 {activeDuplicate.fileA?.path}
                    </p>
                    <span className="inline-block text-[10px] font-mono text-slate-500 mt-1">
                      Size: {activeDuplicate.fileA?.size || 'Unknown size'}
                    </span>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewFile({ name: activeDuplicate.fileA?.filename, path: activeDuplicate.fileA?.path })}
                        className="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Preview</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenNative(activeDuplicate.fileA?.path, activeDuplicate.fileA)}
                        className="py-1 px-2 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleLocateNative(activeDuplicate.fileA?.path)}
                        className="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <FolderOpen className="w-3 h-3" />
                        <span>Show Folder</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFileToDelete(activeDuplicate.fileA)}
                        className="py-1 px-2 rounded bg-red-950/50 hover:bg-red-900/70 text-red-300 border border-red-500/30 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>Delete Copy</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* File B Card */}
                <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      FILE COPY B
                    </span>
                    <p className="text-xs font-bold text-white font-mono truncate" title={activeDuplicate.fileB?.filename}>
                      {activeDuplicate.fileB?.filename}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono break-all leading-tight">
                      📁 {activeDuplicate.fileB?.path}
                    </p>
                    <span className="inline-block text-[10px] font-mono text-slate-500 mt-1">
                      Size: {activeDuplicate.fileB?.size || 'Unknown size'}
                    </span>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewFile({ name: activeDuplicate.fileB?.filename, path: activeDuplicate.fileB?.path })}
                        className="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Preview</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenNative(activeDuplicate.fileB?.path, activeDuplicate.fileB)}
                        className="py-1 px-2 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleLocateNative(activeDuplicate.fileB?.path)}
                        className="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <FolderOpen className="w-3 h-3" />
                        <span>Show Folder</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFileToDelete(activeDuplicate.fileB)}
                        className="py-1 px-2 rounded bg-red-950/50 hover:bg-red-900/70 text-red-300 border border-red-500/30 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>Delete Copy</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Explicit Path Confirmation Dialog */}
              {fileToDelete && (
                <div className="p-4 bg-red-950/40 rounded-xl border border-red-500/40 space-y-3 animate-fadeIn">
                  <div className="flex items-start gap-2 text-red-200">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-red-200">Confirm Deletion</h4>
                      <p className="text-[11px] text-red-300/90 mt-0.5">
                        Are you sure you want to delete this file? This action will permanently remove the file copy.
                      </p>
                    </div>
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-red-500/30 text-[11px] font-mono text-red-300 break-all">
                    {fileToDelete.path || fileToDelete.filename}
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setFileToDelete(null)}
                      disabled={isDeleting}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDeleteFile}
                      disabled={isDeleting}
                      className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      <span>{isDeleting ? 'Deleting...' : 'Yes, Delete File'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Actions Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-950/90 border-t border-slate-800 shrink-0">
              <button
                type="button"
                onClick={handleCloseReview}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => handleKeepBoth(activeDuplicate.id)}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-500/25 border border-blue-500/30 transition-all cursor-pointer"
              >
                Keep Both Copies
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
