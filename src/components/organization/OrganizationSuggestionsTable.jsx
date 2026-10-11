import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  FileCode, 
  FileImage, 
  File, 
  Check, 
  X, 
  Edit3, 
  Eye, 
  CheckSquare, 
  Square,
  ShieldCheck,
  ShieldAlert,
  Tag,
  Folder,
  Layers,
  FolderOutput,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

export const OrganizationSuggestionsTable = ({
  suggestions = [],
  selectedIds = [],
  onToggleSelect,
  onSelectAll,
  onAccept,
  onReject,
  onEdit,
  onAcceptSelected,
  onRejectSelected,
  onPreviewChanges,
  warningMessage
}) => {
  const [expandedFolders, setExpandedFolders] = useState({});
  
  const safeSuggestions = Array.isArray(suggestions) ? suggestions : [];
  const safeSelectedIds = Array.isArray(selectedIds) ? selectedIds : [];

  const allSelected = safeSuggestions.length > 0 && safeSelectedIds.length === safeSuggestions.length;
  const someSelected = safeSelectedIds.length > 0;

  // Group suggestions by physical/display folder path
  const folderGroups = useMemo(() => {
    const groups = {};
    for (const item of safeSuggestions) {
      if (!item) continue;
      const folderKey = item.displayPath || item.currentPath || item.folderName || 'Scanned Folder';
      if (!groups[folderKey]) {
        groups[folderKey] = [];
      }
      groups[folderKey].push(item);
    }
    return groups;
  }, [safeSuggestions]);

  const folderEntries = Object.entries(folderGroups);

  const toggleFolder = (folderKey) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderKey]: !prev[folderKey]
    }));
  };

  const getFileIcon = (type) => {
    switch ((type || '').toUpperCase()) {
      case 'PDF':
        return <FileText className="w-4 h-4 text-red-400 shrink-0" />;
      case 'DOCX':
      case 'DOC':
        return <FileText className="w-4 h-4 text-[#4B91FF] shrink-0" />;
      case 'PPTX':
      case 'PPT':
        return <FilePresentation className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'TXT':
      case 'MD':
      case 'PY':
      case 'JAVA':
      case 'C':
      case 'CPP':
        return <FileCode className="w-4 h-4 text-[#A7B7D0] shrink-0" />;
      case 'JPG':
      case 'PNG':
      case 'JPEG':
      case 'WEBP':
        return <FileImage className="w-4 h-4 text-[#7566F6] shrink-0" />;
      default:
        return <File className="w-4 h-4 text-[#71839E] shrink-0" />;
    }
  };

  const getConfidenceBadge = (confidence, level) => {
    const confVal = typeof confidence === 'number' ? confidence : 85;
    if (confVal >= 90) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>{confVal}% {level || 'High'}</span>
        </span>
      );
    } else if (confVal >= 70) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <ShieldAlert className="w-3 h-3 text-amber-400" />
          <span>{confVal}% {level || 'Medium'}</span>
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#06101F] text-[#71839E] border border-[rgba(139,170,215,0.14)]">
          <span>{confVal}% {level || 'Low'}</span>
        </span>
      );
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Accepted':
      case 'Reviewed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Check className="w-3 h-3 text-emerald-400" />
            Reviewed
          </span>
        );
      case 'Applied':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[rgba(52,120,246,0.15)] text-[#4B91FF] border border-[rgba(52,120,246,0.3)]">
            <ShieldCheck className="w-3 h-3 text-[#4B91FF]" />
            Applied
          </span>
        );
      case 'Rejected':
      case 'Skipped':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#06101F] text-[#71839E] border border-[rgba(139,170,215,0.14)]">
            <X className="w-3 h-3 text-[#71839E]" />
            Skipped
          </span>
        );
      case 'Edited':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[rgba(117,102,246,0.15)] text-[#7566F6] border border-[rgba(117,102,246,0.3)]">
            <Edit3 className="w-3 h-3 text-[#7566F6]" />
            Edited
          </span>
        );
      case 'Pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            AI Suggested
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-[rgba(139,170,215,0.14)] bg-[#0A1629] mb-8 overflow-hidden shadow-xl">
      {/* Selection Warning Banner */}
      {warningMessage && (
        <div className="px-5 py-3 bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-between animate-fadeIn">
          <span className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{warningMessage}</span>
          </span>
        </div>
      )}

      {/* Table Control Header */}
      <div className="p-4 sm:p-5 border-b border-[rgba(139,170,215,0.14)] bg-[#0E1D35] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#F4F7FF] tracking-tight flex items-center gap-2">
            <span>Folder Organization Review</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[rgba(52,120,246,0.15)] text-[#4B91FF] border border-[rgba(52,120,246,0.3)]">
              {folderEntries.length} {folderEntries.length === 1 ? 'folder' : 'folders'} ({safeSuggestions.length} files)
            </span>
          </h2>
          <p className="text-xs text-[#A7B7D0] mt-0.5">
            Expand folder groups below to review AI category suggestions, confidence ratings, and smart tags.
          </p>
        </div>

        {/* Bulk Actions Toolbar */}
        <div className="flex items-center flex-wrap sm:flex-nowrap gap-2 sm:gap-2.5 shrink-0 overflow-x-auto py-0.5">
          <button
            onClick={onSelectAll}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 h-9 rounded-xl border border-[rgba(139,170,215,0.18)] bg-[#06101F] hover:bg-[#132642] text-[#F4F7FF] font-semibold text-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            {allSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-[#4B91FF] shrink-0" />
            ) : (
              <Square className="w-3.5 h-3.5 text-[#71839E] shrink-0" />
            )}
            <span>Select All</span>
          </button>

          <button
            onClick={onAcceptSelected}
            disabled={!someSelected}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs whitespace-nowrap shrink-0 shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>Mark Reviewed ({safeSelectedIds.length})</span>
          </button>

          <button
            onClick={onRejectSelected}
            disabled={!someSelected}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 h-9 rounded-xl bg-[#06101F] hover:bg-[#132642] text-[#A7B7D0] border border-[rgba(139,170,215,0.18)] font-semibold text-xs whitespace-nowrap shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <X className="w-3.5 h-3.5 shrink-0" />
            <span>Skip Selected</span>
          </button>

          <button
            onClick={onPreviewChanges}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 h-9 rounded-xl bg-[#3478F6] hover:bg-[#2563EB] active:scale-95 text-white font-semibold text-xs whitespace-nowrap shrink-0 shadow-md shadow-blue-500/20 border border-blue-400/30 transition-all cursor-pointer"
          >
            <FolderOutput className="w-3.5 h-3.5 shrink-0" />
            <span>Folder Organization ({safeSelectedIds.length})</span>
          </button>
        </div>
      </div>

      {/* Expandable Folder Groups List */}
      <div className="divide-y divide-[rgba(139,170,215,0.1)]">
        {safeSuggestions.length === 0 ? (
          <div className="py-12 text-center text-[#71839E] text-xs font-medium">
            No organization suggestions found. Click "Analyze Files" to scan and analyze files.
          </div>
        ) : (
          folderEntries.map(([folderKey, items]) => {
            const isExpanded = !!expandedFolders[folderKey];
            const reviewedCount = items.filter(
              i => i.status === 'Accepted' || i.status === 'Reviewed' || i.status === 'Edited'
            ).length;

            return (
              <div key={folderKey} className="bg-[#0A1629] transition-colors">
                {/* Collapsed/Expanded Folder Header Card */}
                <div
                  onClick={() => toggleFolder(folderKey)}
                  className="p-4 bg-[#06101F] hover:bg-[#0E1D35] border-b border-[rgba(139,170,215,0.1)] flex items-center justify-between cursor-pointer select-none transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1 rounded-lg bg-[#0A1629] border border-[rgba(139,170,215,0.14)] text-[#A7B7D0]">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-[#4B91FF]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#71839E]" />
                      )}
                    </div>
                    <Folder className="w-5 h-5 text-[#4B91FF] shrink-0" />
                    <div>
                      <h3 className="text-sm font-bold text-[#F4F7FF] flex items-center gap-2">
                        <span>📁 {folderKey}</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[rgba(52,120,246,0.15)] text-[#4B91FF] border border-[rgba(52,120,246,0.3)]">
                          {items.length} {items.length === 1 ? 'file' : 'files'}
                        </span>
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {reviewedCount > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <Check className="w-3 h-3 text-emerald-400" />
                        {reviewedCount}/{items.length} Reviewed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        Pending Review
                      </span>
                    )}
                    <span className="text-xs font-semibold text-[#4B91FF] hover:text-[#F4F7FF] flex items-center gap-1">
                      <span>{isExpanded ? 'Collapse' : 'Expand Files'}</span>
                    </span>
                  </div>
                </div>

                {/* Expanded Folder Files Table */}
                {isExpanded && (
                  <div className="overflow-x-auto custom-scrollbar animate-fadeIn">
                    <table className="w-full text-left border-collapse min-w-[920px]">
                      <thead>
                        <tr className="bg-[#06101F] border-b border-[rgba(139,170,215,0.14)] text-[11px] font-bold text-[#71839E] uppercase tracking-wider select-none">
                          <th className="py-3 px-4 w-10">
                            {/* Checkbox */}
                          </th>
                          <th className="py-3 px-4 min-w-[180px]">File Details</th>
                          <th className="py-3 px-4 min-w-[280px]">Smart Tags</th>
                          <th className="py-3 px-4">Confidence</th>
                          <th className="py-3 px-4 min-w-[180px]">Current Physical Folder</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right pr-6 min-w-[160px]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgba(139,170,215,0.08)] text-xs">
                        {items.map((item) => {
                          if (!item) return null;
                          const isSelected = safeSelectedIds.includes(item.id);

                          // Smart tags list handling
                          const tagsList = Array.isArray(item.smart_tags)
                            ? item.smart_tags
                            : (Array.isArray(item.labels)
                                ? item.labels
                                : (item.suggestedCategory || '').split('/').map(s => s.trim()).filter(Boolean));
                          const displayTags = tagsList.slice(0, 5);
                          const extraCount = tagsList.length - displayTags.length;

                          return (
                            <tr
                              key={item.id || item.filename}
                              className={`transition-colors hover:bg-[#0E1D35] ${
                                isSelected ? 'bg-[rgba(52,120,246,0.1)]' : ''
                              }`}
                            >
                              <td className="py-3.5 px-4">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => onToggleSelect && onToggleSelect(item.id)}
                                  className="rounded border-[rgba(139,170,215,0.25)] bg-[#06101F] text-[#3478F6] focus:ring-[#3478F6]/30 cursor-pointer"
                                />
                              </td>

                              {/* File Name & Type */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2.5 font-medium text-[#F4F7FF]">
                                  {getFileIcon(item.type)}
                                  <div>
                                    <span className="font-semibold text-[#F4F7FF] block line-clamp-1" title={item.filename || ''}>
                                      {item.filename || 'Unnamed File'}
                                    </span>
                                    <span className="text-[10px] text-[#71839E] font-mono block">
                                      Type: {item.type || 'FILE'}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* SMART TAGS */}
                              <td className="py-3.5 px-4">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {displayTags.map((tag, tIdx) => (
                                    <span key={tIdx} className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[rgba(117,102,246,0.15)] text-indigo-300 border border-[rgba(117,102,246,0.3)] flex items-center gap-1">
                                      <Tag className="w-3 h-3 text-[#7566F6]" />
                                      <span>{tag}</span>
                                    </span>
                                  ))}
                                  {extraCount > 0 && (
                                    <span
                                      onClick={() => onEdit && onEdit(item)}
                                      className="px-2 py-1 rounded-md text-[11px] font-bold bg-[#06101F] text-indigo-300 border border-[rgba(139,170,215,0.18)] cursor-pointer hover:bg-[rgba(117,102,246,0.2)]"
                                    >
                                      +{extraCount}
                                    </span>
                                  )}
                                  <button
                                    onClick={() => onEdit && onEdit(item)}
                                    className="ml-1 p-1 rounded-md bg-[#06101F] hover:bg-[rgba(117,102,246,0.2)] text-[#71839E] hover:text-indigo-300 border border-[rgba(139,170,215,0.14)] text-[10px] transition-colors cursor-pointer"
                                    title="Edit Smart Tags"
                                  >
                                    <Edit3 className="w-3 h-3 text-[#7566F6]" />
                                  </button>
                                </div>
                              </td>

                              {/* AI Confidence */}
                              <td className="py-3.5 px-4">
                                {getConfidenceBadge(item.confidence, item.confidenceLevel)}
                              </td>

                              {/* Current Physical Folder */}
                              <td className="py-3.5 px-4 font-mono text-[11px] text-[#A7B7D0] truncate max-w-[220px]" title={item.displayPath || item.currentPath || ''}>
                                📁 {item.displayPath || item.currentPath || 'Root Folder'}
                              </td>

                              {/* Status Badge */}
                              <td className="py-3.5 px-4">
                                {getStatusBadge(item.status)}
                              </td>

                              {/* Action Controls */}
                              <td className="py-3.5 px-4 text-right pr-6">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => onAccept && onAccept(item.id)}
                                    title="Confirm Smart Tags for this file"
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors font-medium text-xs flex items-center gap-1 cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Confirm</span>
                                  </button>

                                  <button
                                    onClick={() => onReject && onReject(item.id)}
                                    title="Skip suggestion"
                                    className="p-1.5 rounded-lg bg-[#06101F] hover:bg-red-950/40 text-[#71839E] hover:text-red-400 border border-[rgba(139,170,215,0.14)] transition-colors cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

function FilePresentation(props) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12H4z" />
    </svg>
  );
}
