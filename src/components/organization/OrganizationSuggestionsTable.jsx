import React from 'react';
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
  FolderOutput
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
  const safeSuggestions = Array.isArray(suggestions) ? suggestions : [];
  const safeSelectedIds = Array.isArray(selectedIds) ? selectedIds : [];

  const allSelected = safeSuggestions.length > 0 && safeSelectedIds.length === safeSuggestions.length;
  const someSelected = safeSelectedIds.length > 0;

  const getFileIcon = (type) => {
    switch ((type || '').toUpperCase()) {
      case 'PDF':
        return <FileText className="w-4 h-4 text-red-400 shrink-0" />;
      case 'DOCX':
      case 'DOC':
        return <FileText className="w-4 h-4 text-blue-400 shrink-0" />;
      case 'PPTX':
      case 'PPT':
        return <FilePresentation className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'TXT':
      case 'MD':
      case 'PY':
      case 'JAVA':
      case 'C':
      case 'CPP':
        return <FileCode className="w-4 h-4 text-slate-400 shrink-0" />;
      case 'JPG':
      case 'PNG':
      case 'JPEG':
      case 'WEBP':
        return <FileImage className="w-4 h-4 text-purple-400 shrink-0" />;
      default:
        return <File className="w-4 h-4 text-slate-400 shrink-0" />;
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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700/60">
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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <ShieldCheck className="w-3 h-3 text-blue-400" />
            Applied
          </span>
        );
      case 'Rejected':
      case 'Skipped':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <X className="w-3 h-3 text-slate-400" />
            Skipped
          </span>
        );
      case 'Edited':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <Edit3 className="w-3 h-3 text-indigo-400" />
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
    <div className="glass-panel rounded-2xl border border-slate-800/80 bg-slate-900/80 backdrop-blur-md mb-8 overflow-hidden shadow-xl">
      {/* Friendly Selection Warning Banner */}
      {warningMessage && (
        <div className="px-5 py-3 bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-between animate-fadeIn">
          <span className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{warningMessage}</span>
          </span>
        </div>
      )}

      {/* Table Control Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <span>Folder Organization Review</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
              {safeSuggestions.length} files scanned
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Review proposed AI folder suggestions and labels before organizing files into physical directories.
          </p>
        </div>

        {/* Bulk Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onSelectAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700/60 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 font-medium text-xs transition-colors cursor-pointer"
          >
            {allSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
            ) : (
              <Square className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>Select All</span>
          </button>

          <button
            onClick={onAcceptSelected}
            disabled={!someSelected}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Mark Reviewed ({safeSelectedIds.length})</span>
          </button>

          <button
            onClick={onRejectSelected}
            disabled={!someSelected}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 font-medium text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Skip Selected</span>
          </button>

          <div className="hidden sm:block w-px h-6 bg-slate-800 mx-1" />

          <button
            onClick={onPreviewChanges}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 border border-blue-500/30 transition-all cursor-pointer"
          >
            <FolderOutput className="w-3.5 h-3.5" />
            <span>Folder Organization ({safeSelectedIds.length})</span>
          </button>
        </div>
      </div>

      {/* Main Suggestions Table */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[920px]">
          <thead>
            <tr className="bg-slate-950/90 border-b border-slate-800/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none">
              <th className="py-3 px-4 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onSelectAll}
                  className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500/30 cursor-pointer"
                />
              </th>
              <th className="py-3 px-4 min-w-[180px]">File Details</th>
              <th className="py-3 px-4 min-w-[280px]">Smart Tags</th>
              <th className="py-3 px-4">Confidence</th>
              <th className="py-3 px-4 min-w-[180px]">Current Physical Folder</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right pr-6 min-w-[160px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {safeSuggestions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400 text-xs font-medium">
                  No organization suggestions found. Click "Analyze Files" to scan and analyze files.
                </td>
              </tr>
            ) : (
              safeSuggestions.map((item) => {
                if (!item) return null;
                const isSelected = safeSelectedIds.includes(item.id);
                
                // Smart tags list handling
                const tagsList = Array.isArray(item.smart_tags) && item.smart_tags.length > 0
                  ? item.smart_tags
                  : (Array.isArray(item.labels) && item.labels.length > 0
                      ? item.labels
                      : (item.suggestedCategory || '').split('/').map(s => s.trim()).filter(Boolean));
                const displayTags = tagsList.slice(0, 5);
                const extraCount = tagsList.length - displayTags.length;

                return (
                  <tr
                    key={item.id || item.filename}
                    className={`transition-colors hover:bg-slate-800/40 ${
                      isSelected ? 'bg-blue-500/10' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect && onToggleSelect(item.id)}
                        className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500/30 cursor-pointer"
                      />
                    </td>

                    {/* File Name & Type */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5 font-medium text-white">
                        {getFileIcon(item.type)}
                        <div>
                          <span className="font-semibold text-slate-100 block line-clamp-1" title={item.filename || ''}>
                            {item.filename || 'Unnamed File'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            Type: {item.type || 'FILE'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* SMART TAGS */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {displayTags.map((tag, tIdx) => (
                          <span key={tIdx} className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                            <Tag className="w-3 h-3 text-purple-400" />
                            <span>{tag}</span>
                          </span>
                        ))}
                        {extraCount > 0 && (
                          <span
                            onClick={() => onEdit && onEdit(item)}
                            className="px-2 py-1 rounded-md text-[11px] font-bold bg-slate-800 text-purple-300 border border-slate-700 cursor-pointer hover:bg-purple-500/20"
                          >
                            +{extraCount}
                          </span>
                        )}
                        <button
                          onClick={() => onEdit && onEdit(item)}
                          className="ml-1 p-1 rounded-md bg-slate-800 hover:bg-purple-500/20 text-slate-400 hover:text-purple-300 border border-slate-700/60 text-[10px] transition-colors cursor-pointer"
                          title="Edit Smart Tags"
                        >
                          <Edit3 className="w-3 h-3 text-purple-400" />
                        </button>
                      </div>
                    </td>

                    {/* AI Confidence */}
                    <td className="py-3.5 px-4">
                      {getConfidenceBadge(item.confidence, item.confidenceLevel)}
                    </td>

                    {/* Current Physical Folder */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300 truncate max-w-[220px]" title={item.displayPath || item.currentPath || ''}>
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
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-700/60 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
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
