import React from 'react';
import { 
  FileText, 
  FilePlus, 
  FolderOpen, 
  Layers, 
  Download, 
  ArrowRightLeft,
  Eye,
  Save,
  Image as ImageIcon,
  Type,
  Sparkles,
  Loader2
} from 'lucide-react';
import { Badge } from '../common/Badge';

export const PDFStudioHeader = ({
  hasDocument = false,
  documentTitle = 'Untitled Document',
  pageCount = 0,
  hasUnsavedChanges = false,
  onNewPDF,
  onOpenPDF,
  onOpenDrafts,
  onAddImage,
  onAddText,
  onAddFromMemora,
  onOpenConvert,
  onOpenAlternate,
  onSaveDraft,
  onOpenPreview,
  onExport,
  isExporting = false
}) => {
  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-4 px-5 rounded-2xl border border-gray-800/80 bg-gray-900/70 backdrop-blur-md shadow-xl select-none">
      {/* Title & Status */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 border border-blue-500/30 shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg font-bold text-white tracking-wide truncate max-w-xs md:max-w-md">
              {hasDocument ? documentTitle : 'PDF Studio'}
            </h1>
            {hasDocument ? (
              <div className="flex items-center gap-1.5">
                <Badge variant="blue" size="sm">
                  {pageCount} {pageCount === 1 ? 'Page' : 'Pages'}
                </Badge>
                {hasUnsavedChanges && (
                  <Badge variant="warning" size="sm">
                    Unsaved
                  </Badge>
                )}
              </div>
            ) : (
              <Badge variant="default" size="sm">
                Studio Workspace
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-gray-400 font-medium">
            Create, edit, organize, annotate, and convert your documents with precision.
          </p>
        </div>
      </div>

      {/* ICON-FIRST Action Buttons (expand smoothly on hover) */}
      <div className="flex items-center flex-wrap gap-2 shrink-0">
        {/* New PDF Button */}
        <button
          onClick={onNewPDF}
          title="New PDF Document"
          className="group relative flex items-center h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-md shadow-blue-600/25 transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <FilePlus className="w-4 h-4 shrink-0" />
          <span className="max-w-0 opacity-0 group-hover:max-w-xs group-hover:opacity-100 group-hover:ml-2 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out">
            New PDF
          </span>
        </button>

        {/* Open PDF Button */}
        <button
          onClick={onOpenPDF}
          title="Open Local PDF File"
          className="group relative flex items-center h-9 px-3 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 border border-gray-700/60 font-medium text-xs shadow-sm transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <FolderOpen className="w-4 h-4 shrink-0 text-blue-400" />
          <span className="max-w-0 opacity-0 group-hover:max-w-xs group-hover:opacity-100 group-hover:ml-2 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out">
            Open PDF
          </span>
        </button>

        {/* Drafts List Button */}
        {onOpenDrafts && (
          <button
            onClick={onOpenDrafts}
            title="Open Saved Workspace Drafts"
            className="group relative flex items-center h-9 px-3 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 border border-gray-700/60 font-medium text-xs shadow-sm transition-all duration-300 cursor-pointer overflow-hidden"
          >
            <Save className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="max-w-0 opacity-0 group-hover:max-w-xs group-hover:opacity-100 group-hover:ml-2 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out">
              Drafts
            </span>
          </button>
        )}

        {/* Add from Memora Button */}
        <button
          onClick={onAddFromMemora}
          title="Add Indexed Document from Memora Store"
          className="group relative flex items-center h-9 px-3 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 border border-gray-700/60 font-medium text-xs shadow-sm transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <Layers className="w-4 h-4 shrink-0 text-purple-400" />
          <span className="max-w-0 opacity-0 group-hover:max-w-xs group-hover:opacity-100 group-hover:ml-2 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out">
            Add from Memora
          </span>
        </button>

        {/* Alternate Pages Shortcut Button */}
        <button
          onClick={onOpenAlternate || onOpenConvert}
          title="Alternate & Interleave 2 PDFs"
          className="group relative flex items-center h-9 px-3 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 border border-gray-700/60 font-medium text-xs shadow-sm transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <ArrowRightLeft className="w-4 h-4 shrink-0 text-indigo-400" />
          <span className="max-w-0 opacity-0 group-hover:max-w-xs group-hover:opacity-100 group-hover:ml-2 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out">
            Alternate Pages
          </span>
        </button>

        {/* Convert & Tools Button */}
        <button
          onClick={onOpenConvert}
          title="Merge, Split & Conversion Tools"
          className="group relative flex items-center h-9 px-3 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 border border-gray-700/60 font-medium text-xs shadow-sm transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
          <span className="max-w-0 opacity-0 group-hover:max-w-xs group-hover:opacity-100 group-hover:ml-2 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out">
            PDF Tools
          </span>
        </button>

        {hasDocument && (
          <>
            {/* Save Draft Button */}
            <button
              onClick={onSaveDraft}
              title="Save Draft State"
              className="group relative flex items-center h-9 px-3 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 border border-gray-700/60 font-medium text-xs shadow-sm transition-all duration-300 cursor-pointer overflow-hidden"
            >
              <Save className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="max-w-0 opacity-0 group-hover:max-w-xs group-hover:opacity-100 group-hover:ml-2 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out">
                Save Draft
              </span>
            </button>

            {/* Preview Button */}
            <button
              onClick={onOpenPreview}
              title="Full-screen Document Preview"
              className="group relative flex items-center h-9 px-3 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 border border-gray-700/60 font-medium text-xs shadow-sm transition-all duration-300 cursor-pointer overflow-hidden"
            >
              <Eye className="w-4 h-4 shrink-0 text-cyan-400" />
              <span className="max-w-0 opacity-0 group-hover:max-w-xs group-hover:opacity-100 group-hover:ml-2 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out">
                Preview
              </span>
            </button>
          </>
        )}

        {/* Export Button */}
        <button
          onClick={onExport}
          disabled={!hasDocument || isExporting}
          title="Export Document to PDF"
          className={`group relative flex items-center h-9 px-3.5 rounded-xl font-medium text-xs shadow-md transition-all duration-300 cursor-pointer overflow-hidden ${
            hasDocument && !isExporting
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/25 border border-emerald-500/40'
              : 'bg-gray-800/50 text-gray-500 border border-gray-800 cursor-not-allowed'
          }`}
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 shrink-0 animate-spin text-white" />
          ) : (
            <Download className="w-4 h-4 shrink-0" />
          )}
          <span className="max-w-0 opacity-0 group-hover:max-w-xs group-hover:opacity-100 group-hover:ml-2 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out">
            {isExporting ? 'Exporting...' : 'Export PDF'}
          </span>
        </button>
      </div>
    </header>
  );
};


