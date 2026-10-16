import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Copy, 
  ArrowLeftRight, 
  X, 
  Loader2, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Trash2,
  ShieldAlert,
  FolderOpen,
  ExternalLink,
  Check,
  Layers
} from 'lucide-react';
import { organizationService } from '../../services/organizationService';
import { apiService } from '../../services/apiService';
import { useApp } from '../../context/AppContext';
import { useDataCache } from '../../context/DataCacheContext';

export const getDetectionBadge = (type) => {
  switch (type) {
    case 'Exact duplicate':
    case 'Exact Copy':
      return 'bg-[rgba(117,102,246,0.15)] text-indigo-300 border-[rgba(117,102,246,0.3)]';
    case 'Identical text content':
    case 'Same Text Content':
      return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
    case 'Highly similar':
      return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    case 'Similar content':
    case 'Possible duplicate':
    default:
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  }
};

// Map raw backend detection type strings to plain user-facing labels
const friendlyDetectionType = (type) => {
  switch (type) {
    case 'Exact duplicate':         return 'Exact Copy';
    case 'Identical text content':  return 'Same Text Content';
    case 'Highly similar':          return 'Very Similar';
    case 'Similar content':         return 'Similar Content';
    case 'Possible duplicate':      return 'Possible Copy';
    default:                        return type || 'Possible Copy';
  }
};

export const DuplicatesSection = ({ refreshTrigger, onFileDeleted }) => {
  const { 
    duplicatesData, 
    fetchDuplicates: fetchCachedDuplicates, 
    updateDuplicateStatus, 
    removeDuplicateFile 
  } = useDataCache();

  // Instant zero-spinner initial state from shared cache
  const [duplicates, setDuplicates] = useState(duplicatesData.items);
  const [loading, setLoading] = useState(!duplicatesData.isLoaded);
  const [error, setError] = useState(duplicatesData.error);
  const [activeDuplicate, setActiveDuplicate] = useState(null);
  const [activeTooltip, setActiveTooltip] = useState(null);
  const { recordOpenedFile, addToast } = useApp();

  const [copiedPath, setCopiedPath] = useState(null);
  const [fileToDelete, setFileToDelete] = useState(null); // { id, filename, path }
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState(null);
  const [showMatchDetails, setShowMatchDetails] = useState(false);

  // One-click Open Both Files state
  const [isOpeningBoth, setIsOpeningBoth] = useState(false);
  const [openBothError, setOpenBothError] = useState(null);

  const fetchDuplicates = async (force = false) => {
    // Only show full loading spinner if we have no cached data yet or if explicitly forced
    if (!duplicatesData.isLoaded || force) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await fetchCachedDuplicates({ forceRefresh: force });
      setDuplicates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load duplicate files from backend API:', err);
      if (!duplicatesData.isLoaded) {
        setError('Unable to load duplicate results.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Sync state when cache changes
  useEffect(() => {
    if (duplicatesData.isLoaded) {
      setDuplicates(duplicatesData.items);
      setLoading(false);
      setError(duplicatesData.error);
    }
  }, [duplicatesData]);

  useEffect(() => {
    const shouldForce = Boolean(refreshTrigger && refreshTrigger > 0);
    fetchDuplicates(shouldForce);
  }, [refreshTrigger]);

  const handleCopyPath = (filePath) => {
    if (!filePath) return;
    navigator.clipboard.writeText(filePath);
    setCopiedPath(filePath);
    if (addToast) addToast('File path copied to clipboard', 'info');
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const handleOpenReview = (dup) => {
    setActiveDuplicate(dup);
    setDeleteMessage(null);
    setFileToDelete(null);
    setOpenBothError(null);
    setShowMatchDetails(false);
  };

  const handleCloseReview = () => {
    setActiveDuplicate(null);
    setFileToDelete(null);
    setDeleteMessage(null);
    setOpenBothError(null);
  };

  const handleKeepBoth = (id) => {
    setDuplicates((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'Kept Both' } : item))
    );
    updateDuplicateStatus(id, 'Kept Both');
    setActiveDuplicate(null);
  };

  const handleOpenNative = async (filePath, fileObj) => {
    if (!filePath) return;
    try {
      const res = await apiService.openFile(filePath);
      if (res && typeof res === 'string' && res.length > 0) {
        if (addToast) addToast(`Could not open file: ${res}`, 'error');
      } else {
        if (fileObj && recordOpenedFile) {
          recordOpenedFile(fileObj);
        }
      }
    } catch (err) {
      if (addToast) addToast(`Failed to launch file: ${err.message || 'Unknown error'}`, 'error');
    }
  };

  const handleLocateNative = (filePath) => {
    if (!filePath) return;
    apiService.locateFile(filePath);
  };

  /**
   * One-Click Open Both Files
   * Launches both original duplicate files simultaneously in default desktop applications.
   * Throttled against rapid clicks with isolated error handling per file.
   */
  const handleOpenBoth = async () => {
    if (isOpeningBoth || !activeDuplicate) return;
    setIsOpeningBoth(true);
    setOpenBothError(null);

    const pathA = activeDuplicate.fileA?.path;
    const pathB = activeDuplicate.fileB?.path;

    if (!pathA || !pathB) {
      const err = 'Both file paths must be available to open simultaneously.';
      setOpenBothError(err);
      if (addToast) addToast(err, 'error');
      setIsOpeningBoth(false);
      return;
    }

    try {
      const result = await apiService.openBothFiles(pathA, pathB);
      if (result && result.error) {
        setOpenBothError(result.error);
        if (addToast) addToast(result.error, 'error');
      } else {
        if (recordOpenedFile) {
          recordOpenedFile(activeDuplicate.fileA);
          recordOpenedFile(activeDuplicate.fileB);
        }
        const msg = result?.message || 'Opened both files in your default desktop applications';
        if (addToast) {
          addToast(msg, result?.arranged ? 'success' : 'info');
        }
      }
    } catch (err) {
      const errMsg = err.message || 'Failed to launch files';
      setOpenBothError(errMsg);
      if (addToast) addToast(errMsg, 'error');
    } finally {
      setTimeout(() => {
        setIsOpeningBoth(false);
      }, 1200);
    }
  };

  const handleConfirmDeleteFile = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      const targetId = fileToDelete.id || fileToDelete.db_id || fileToDelete.file_id;
      if (!targetId) {
        throw new Error("File ID missing for deletion.");
      }
      await organizationService.deleteFile(targetId);
      setDeleteMessage(`Successfully deleted physical file from disk: ${fileToDelete.filename}`);
      setDuplicates((prev) =>
        prev.map((item) => {
          if (activeDuplicate && item.id === activeDuplicate.id) {
            return { ...item, status: 'Duplicate Deleted' };
          }
          return item;
        })
      );
      removeDuplicateFile(targetId);
      setFileToDelete(null);

      // Notify parent component to refresh organization suggestions, overview & summary counts
      if (typeof onFileDeleted === 'function') {
        onFileDeleted();
      }

      setTimeout(() => {
        fetchDuplicates(true);
      }, 400);
    } catch (err) {
      console.error('Failed to delete physical file copy:', err);
      setDeleteMessage(`Deletion Failed: ${err.message || 'Could not delete file from disk'}`);
      setFileToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!loading && !error && duplicates.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[rgba(139,170,215,0.14)] bg-[#0A1629] p-6 mb-8 shadow-xl select-none">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-[rgba(139,170,215,0.14)] pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Copy className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#F4F7FF] tracking-tight">
              Possible Duplicates
            </h2>
            <p className="text-xs text-[#A7B7D0]">
              Files with matching or very similar content.
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
          <p className="text-xs font-medium text-[#A7B7D0]">Checking for duplicates...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="py-10 text-center flex flex-col items-center justify-center space-y-3 bg-[#06101F] rounded-xl border border-red-500/20 p-6">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-[#F4F7FF]">{error}</p>
          <button
            type="button"
            onClick={fetchDuplicates}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0E1D35] hover:bg-[#132642] text-[#F4F7FF] text-xs font-semibold border border-[rgba(139,170,215,0.18)] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Duplicate Pairs Cards */}
      {!loading && !error && duplicates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {duplicates.map((dup) => (
            <div
              key={dup.id}
              className="p-4 bg-[#06101F] rounded-xl border border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.28)] transition-all flex flex-col justify-between"
            >
              <div>
                {/* Top Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getDetectionBadge(dup.detectionType)}`}
                  >
                    {friendlyDetectionType(dup.detectionType)}
                  </span>

                  <span className="font-mono text-xs font-bold text-amber-400">
                    {dup.similarity}% similar
                  </span>
                </div>

                {/* Pair Visualization */}
                <div className="space-y-2 mb-4">
                  <div className="p-2.5 bg-[#0A1629] rounded-lg border border-[rgba(139,170,215,0.14)] font-mono text-xs text-[#F4F7FF] font-semibold truncate" title={dup.fileA?.filename}>
                    {dup.fileA?.filename}
                  </div>

                  <div className="flex items-center justify-center text-[#71839E]">
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </div>

                  <div className="p-2.5 bg-[#0A1629] rounded-lg border border-[rgba(139,170,215,0.14)] font-mono text-xs text-[#F4F7FF] font-semibold truncate" title={dup.fileB?.filename}>
                    {dup.fileB?.filename}
                  </div>
                </div>
              </div>

              {/* Bottom Action */}
              <div className="flex items-center justify-between border-t border-[rgba(139,170,215,0.1)] pt-3">
                <span className="text-[11px] font-medium text-[#71839E]">
                  Status: <strong className="text-[#A7B7D0]">{dup.status}</strong>
                </span>

                <button
                  type="button"
                  onClick={() => handleOpenReview(dup)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3478F6]/15 hover:bg-[#3478F6]/25 text-[#4B91FF] border border-[#3478F6]/30 font-semibold text-xs transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Compare Both Files</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Simplified Compact Duplicate File Comparison Modal */}
      {activeDuplicate && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div
            className="w-full max-w-3xl bg-[#0A1629] border border-[rgba(139,170,215,0.22)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(139,170,215,0.14)] bg-[#0E1D35] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#3478F6] to-[#7566F6] flex items-center justify-center text-white shadow-xs shrink-0 border border-[#4B91FF]/30">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#F4F7FF] flex items-center gap-2">
                    <span>Compare Files</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#3478F6]/15 text-[#4B91FF] border border-[#3478F6]/30">
                      {friendlyDetectionType(activeDuplicate.detectionType)}
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#A7B7D0]">
                    Review both files and choose which copy to keep or delete.
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseReview}
                className="p-1.5 text-[#71839E] hover:text-[#F4F7FF] hover:bg-[#132642] rounded-lg transition-colors cursor-pointer"
                title="Close comparison"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              
              {/* Detection Information & Evidence Strip */}
              <div className="p-3.5 bg-[#06101F] rounded-xl border border-[rgba(139,170,215,0.18)] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold border ${getDetectionBadge(activeDuplicate.detectionType)}`}>
                      {friendlyDetectionType(activeDuplicate.detectionType)}
                    </span>
                    <span className="text-xs text-[#F4F7FF] font-semibold">
                      {activeDuplicate.reason && activeDuplicate.reason !== 'Calculated based on binary hash and extracted content.' ? activeDuplicate.reason : 'These files were found to have matching or highly similar content.'}
                    </span>
                  </div>

                  <div className="relative inline-flex items-center gap-1 shrink-0">
                    <span
                      onMouseEnter={() => setActiveTooltip(activeDuplicate.id)}
                      onMouseLeave={() => setActiveTooltip(null)}
                      className="font-mono text-amber-300 cursor-help flex items-center gap-1 bg-[#0A1629] px-2.5 py-1 rounded-lg border border-amber-500/30"
                    >
                      <span>{activeDuplicate.similarity}% Match</span>
                      <Info className="w-3.5 h-3.5 text-amber-400" />
                    </span>

                    {activeTooltip === activeDuplicate.id && (
                      <div className="absolute right-0 bottom-full mb-2 w-72 p-3 bg-[#06101F] border border-[rgba(139,170,215,0.2)] rounded-xl text-[11px] text-[#A7B7D0] shadow-2xl z-30 font-sans leading-snug animate-fadeIn">
                        <strong className="text-amber-300 block mb-1">Similarity Score</strong>
                        How closely these files match based on content and structure analysis.
                      </div>
                    )}
                  </div>
                </div>

                {/* Collapsible Evidence Metrics */}
                <div className="pt-2 border-t border-[rgba(139,170,215,0.1)]">
                  <button
                    type="button"
                    onClick={() => setShowMatchDetails(prev => !prev)}
                    className="flex items-center gap-1.5 text-[10px] font-semibold text-[#71839E] hover:text-[#A7B7D0] transition-colors cursor-pointer"
                  >
                    <span>{showMatchDetails ? '▾' : '▸'} {showMatchDetails ? 'Hide Details' : 'Show Details'}</span>
                  </button>

                  {showMatchDetails && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-[11px] font-mono">
                      <div className="p-2 rounded-lg bg-[#0A1629] border border-[rgba(139,170,215,0.1)] flex items-center justify-between">
                        <span className="text-[#71839E]">Identical Files:</span>
                        <span className={activeDuplicate.is_hash_match ? "text-emerald-400 font-bold" : "text-[#71839E]"}>
                          {activeDuplicate.is_hash_match ? "Yes" : "No"}
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-[#0A1629] border border-[rgba(139,170,215,0.1)] flex items-center justify-between">
                        <span className="text-[#71839E]">Same Content:</span>
                        <span className={activeDuplicate.is_text_match ? "text-cyan-400 font-bold" : "text-[#71839E]"}>
                          {activeDuplicate.is_text_match ? "Identical" : "Different"}
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-[#0A1629] border border-[rgba(139,170,215,0.1)] flex items-center justify-between">
                        <span className="text-[#71839E]">Word Similarity:</span>
                        <span className="text-[#A7B7D0] font-bold">
                          {activeDuplicate.lexical_similarity !== null && activeDuplicate.lexical_similarity !== undefined
                            ? `${activeDuplicate.lexical_similarity}%`
                            : (activeDuplicate.is_hash_match ? "100%" : "N/A")}
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-[#0A1629] border border-[rgba(139,170,215,0.1)] flex items-center justify-between">
                        <span className="text-[#71839E]">Overall Similarity:</span>
                        <span className="text-[#A7B7D0] font-bold">
                          {activeDuplicate.semantic_similarity !== null && activeDuplicate.semantic_similarity !== undefined
                            ? `${activeDuplicate.semantic_similarity}%`
                            : (activeDuplicate.is_hash_match ? "100%" : "N/A")}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>


              {/* Status or Error Notifications */}
              {openBothError && (
                <div className="p-3 bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{openBothError}</span>
                </div>
              )}

              {deleteMessage && (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{deleteMessage}</span>
                </div>
              )}

              {/* Compact Comparison Cards Grid (File A vs File B) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                
                {/* ---------------- FILE COPY A ---------------- */}
                <div className="p-3.5 bg-[#06101F] rounded-xl border border-[rgba(139,170,215,0.16)] flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-[rgba(139,170,215,0.12)] pb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#3478F6]/20 text-[#60A5FA] border border-[#3478F6]/40 uppercase tracking-wider font-mono">
                        File A
                      </span>
                      <span className="text-[10px] font-mono font-bold text-[#71839E] px-1.5 py-0.5 rounded bg-[#0A1629] border border-[rgba(139,170,215,0.1)]">
                        {activeDuplicate.fileA?.filename?.split('.').pop()?.toUpperCase() || 'FILE'}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-[#F4F7FF] font-mono truncate" title={activeDuplicate.fileA?.filename}>
                        {activeDuplicate.fileA?.filename}
                      </p>
                      <p className="text-[11px] text-[#8BAAD7] font-mono mt-0.5">
                        Size: <strong className="text-white">{activeDuplicate.fileA?.size || 'Unknown'}</strong>
                      </p>

                      {/* Path Bar with Copy & Locate */}
                      <div className="mt-2 flex items-center justify-between gap-1.5 p-2 rounded-lg bg-[#0A1629] border border-[rgba(139,170,215,0.12)] text-[10px] font-mono text-[#A7B7D0]">
                        <span className="truncate" title={activeDuplicate.fileA?.path}>
                          {activeDuplicate.fileA?.path}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyPath(activeDuplicate.fileA?.path)}
                            className="p-1 rounded hover:bg-[#132642] text-[#8BAAD7] hover:text-white transition-colors cursor-pointer"
                            title="Copy path to clipboard"
                          >
                            {copiedPath === activeDuplicate.fileA?.path ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLocateNative(activeDuplicate.fileA?.path)}
                            className="p-1 rounded hover:bg-[#132642] text-[#8BAAD7] hover:text-white transition-colors cursor-pointer"
                            title="Locate in File Explorer"
                          >
                            <FolderOpen className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* File A Action Controls */}
                  <div className="space-y-2 pt-2 border-t border-[rgba(139,170,215,0.1)]">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenNative(activeDuplicate.fileA?.path, activeDuplicate.fileA)}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#0E1D35] hover:bg-[#132642] text-[#4B91FF] border border-[rgba(139,170,215,0.14)] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open File A</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFileToDelete(activeDuplicate.fileA)}
                        className="py-1.5 px-3 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title="Delete this copy"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setFileToDelete(activeDuplicate.fileB)}
                      className="w-full py-2 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Keep This Copy — Delete File B</span>
                    </button>
                  </div>
                </div>

                {/* ---------------- FILE COPY B ---------------- */}
                <div className="p-3.5 bg-[#06101F] rounded-xl border border-[rgba(139,170,215,0.16)] flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-[rgba(139,170,215,0.12)] pb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#7566F6]/20 text-[#A78BFA] border border-[#7566F6]/40 uppercase tracking-wider font-mono">
                        File B
                      </span>
                      <span className="text-[10px] font-mono font-bold text-[#71839E] px-1.5 py-0.5 rounded bg-[#0A1629] border border-[rgba(139,170,215,0.1)]">
                        {activeDuplicate.fileB?.filename?.split('.').pop()?.toUpperCase() || 'FILE'}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-[#F4F7FF] font-mono truncate" title={activeDuplicate.fileB?.filename}>
                        {activeDuplicate.fileB?.filename}
                      </p>
                      <p className="text-[11px] text-[#8BAAD7] font-mono mt-0.5">
                        Size: <strong className="text-white">{activeDuplicate.fileB?.size || 'Unknown'}</strong>
                      </p>

                      {/* Path Bar with Copy & Locate */}
                      <div className="mt-2 flex items-center justify-between gap-1.5 p-2 rounded-lg bg-[#0A1629] border border-[rgba(139,170,215,0.12)] text-[10px] font-mono text-[#A7B7D0]">
                        <span className="truncate" title={activeDuplicate.fileB?.path}>
                          {activeDuplicate.fileB?.path}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyPath(activeDuplicate.fileB?.path)}
                            className="p-1 rounded hover:bg-[#132642] text-[#8BAAD7] hover:text-white transition-colors cursor-pointer"
                            title="Copy path to clipboard"
                          >
                            {copiedPath === activeDuplicate.fileB?.path ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLocateNative(activeDuplicate.fileB?.path)}
                            className="p-1 rounded hover:bg-[#132642] text-[#8BAAD7] hover:text-white transition-colors cursor-pointer"
                            title="Locate in File Explorer"
                          >
                            <FolderOpen className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* File B Action Controls */}
                  <div className="space-y-2 pt-2 border-t border-[rgba(139,170,215,0.1)]">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenNative(activeDuplicate.fileB?.path, activeDuplicate.fileB)}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#0E1D35] hover:bg-[#132642] text-[#4B91FF] border border-[rgba(139,170,215,0.14)] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open File B</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFileToDelete(activeDuplicate.fileB)}
                        className="py-1.5 px-3 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title="Delete this copy"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setFileToDelete(activeDuplicate.fileA)}
                      className="w-full py-2 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                      <span>Keep This Copy — Delete File A</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Permanent Deletion Safety Confirmation Dialog */}
              {fileToDelete && (
                <div className="p-4 bg-red-950/40 rounded-xl border border-red-500/40 space-y-3 animate-fadeIn my-1">
                  <div className="flex items-start gap-2.5 text-red-200">
                    <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-red-200 uppercase tracking-wide">
                        Confirm Permanent Deletion of Duplicate Copy
                      </h4>
                      <p className="text-[11px] text-red-300/90 mt-0.5">
                        This will permanently delete the file from your computer. This cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="p-2.5 bg-[#06101F] rounded-lg border border-red-500/30 text-xs font-mono text-red-300 break-all select-all">
                    📁 {fileToDelete.path || fileToDelete.filename}
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setFileToDelete(null)}
                      disabled={isDeleting}
                      className="px-3.5 py-1.5 rounded-lg bg-[#0E1D35] hover:bg-[#132642] text-[#A7B7D0] text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDeleteFile}
                      disabled={isDeleting}
                      className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      <span>{isDeleting ? 'Deleting...' : 'Yes, Permanently Delete File'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Actions Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-[#0E1D35] border-t border-[rgba(139,170,215,0.14)] shrink-0">
              <span className="text-[11px] text-[#71839E]">
                Both files remain safe until you choose to delete one.
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenBoth}
                  disabled={isOpeningBoth}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#3478F6] to-[#4B91FF] hover:from-[#2563EB] hover:to-[#3478F6] text-white text-xs font-bold shadow-md shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-60 active:scale-95"
                  title="Open both original files side-by-side (50/50 screen split)"
                >
                  {isOpeningBoth ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Opening...</span>
                    </>
                  ) : (
                    <>
                      <Layers className="w-3.5 h-3.5" />
                      <span>Open Both Files</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleKeepBoth(activeDuplicate.id)}
                  className="px-4 py-1.5 text-xs font-semibold text-[#F4F7FF] bg-[#0A1629] hover:bg-[#132642] rounded-xl border border-[rgba(139,170,215,0.20)] transition-all cursor-pointer"
                >
                  Keep Both Copies
                </button>

                <button
                  type="button"
                  onClick={handleCloseReview}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#1E293B] hover:bg-[#334155] rounded-xl border border-[rgba(139,170,215,0.20)] transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
