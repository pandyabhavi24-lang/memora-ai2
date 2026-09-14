import React from 'react';
import { 
  Eye, 
  Edit3, 
  Highlighter, 
  Type,
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  RotateCw, 
  Trash2, 
  Plus, 
  Copy,
  ArrowUp,
  ArrowDown,
  X,
  MoveHorizontal,
  Square
} from 'lucide-react';

export const PDFStudioToolbar = ({
  viewMode = 'view', // 'view' | 'edit' | 'annotate'
  onViewModeChange,
  zoomLevel = 100,
  zoomMode = 'custom', // 'custom' | 'fit-width' | 'fit-page'
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitWidth,
  onFitPage,
  currentPage = 1,
  totalPages = 1,
  onPrevPage,
  onNextPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onRotateLeft,
  onRotateRight,
  onMoveUp,
  onMoveDown,
  onCloseDocument
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 glass-panel px-4 py-2.5 rounded-xl border border-gray-800/80 bg-gray-900/80 backdrop-blur-md select-none">
      {/* Group 1: View Modes & Editing Tools */}
      <div className="flex items-center gap-1 bg-gray-950/70 p-1 rounded-lg border border-gray-800/60 shrink-0">
        <button
          onClick={() => onViewModeChange('view')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
            viewMode === 'view'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
          }`}
          title="View Mode"
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">View</span>
        </button>

        <button
          onClick={() => onViewModeChange('edit')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
            viewMode === 'edit'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
          }`}
          title="Text & Edit Mode"
        >
          <Type className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-semibold">Text</span>
        </button>

        <button
          onClick={() => onViewModeChange('annotate')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
            viewMode === 'annotate'
              ? 'bg-purple-600/20 text-purple-400 border border-purple-500/40 shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
          }`}
          title="Annotate Mode"
        >
          <Highlighter className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Annotate</span>
        </button>
      </div>

      {/* Group 2: Page Navigation & Stepper */}
      <div className="flex items-center gap-1.5 bg-gray-950/60 px-2 py-1 rounded-lg border border-gray-800/50 shrink-0">
        <button
          onClick={onPrevPage}
          disabled={currentPage <= 1}
          className="p-1 text-gray-400 hover:text-white disabled:opacity-30 rounded hover:bg-gray-800/50 transition-colors cursor-pointer"
          title="Previous Page"
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="text-xs text-gray-300 font-mono px-1">
          Page <strong className="text-white">{currentPage}</strong> of <strong className="text-gray-400">{totalPages}</strong>
        </span>

        <button
          onClick={onNextPage}
          disabled={currentPage >= totalPages}
          className="p-1 text-gray-400 hover:text-white disabled:opacity-30 rounded hover:bg-gray-800/50 transition-colors cursor-pointer"
          title="Next Page"
          aria-label="Next Page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Group 3: Page Actions Toolbar */}
      <div className="flex items-center gap-1 bg-gray-950/70 p-1 rounded-lg border border-gray-800/60 shrink-0">
        <button
          onClick={onAddPage}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-gray-800/60 rounded transition-colors cursor-pointer"
          title="Add Blank Page"
          aria-label="Add Blank Page"
        >
          <Plus className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden md:inline">Add</span>
        </button>

        <button
          onClick={onDuplicatePage}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-gray-800/60 rounded transition-colors cursor-pointer"
          title="Duplicate Current Page"
          aria-label="Duplicate Current Page"
        >
          <Copy className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden md:inline">Duplicate</span>
        </button>

        <div className="w-px h-4 bg-gray-800 my-auto mx-0.5" />

        <button
          onClick={onRotateLeft}
          className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-800/60 transition-colors cursor-pointer"
          title="Rotate Left 90°"
          aria-label="Rotate Page Left 90 Degrees"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onRotateRight}
          className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-800/60 transition-colors cursor-pointer"
          title="Rotate Right 90°"
          aria-label="Rotate Page Right 90 Degrees"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-gray-800 my-auto mx-0.5" />

        <button
          onClick={onMoveUp}
          disabled={currentPage <= 1}
          className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 rounded hover:bg-gray-800/60 transition-colors cursor-pointer"
          title="Move Page Up"
          aria-label="Move Page Up"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onMoveDown}
          disabled={currentPage >= totalPages}
          className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 rounded hover:bg-gray-800/60 transition-colors cursor-pointer"
          title="Move Page Down"
          aria-label="Move Page Down"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-gray-800 my-auto mx-0.5" />

        <button
          onClick={onDeletePage}
          disabled={totalPages <= 1}
          className="p-1.5 text-red-400 hover:text-red-300 disabled:opacity-30 rounded hover:bg-red-500/10 transition-colors cursor-pointer"
          title="Delete Page"
          aria-label="Delete Current Page"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Group 4: Zoom Controls */}
      <div className="flex items-center gap-1.5 bg-gray-950/60 px-2 py-1 rounded-lg border border-gray-800/50 shrink-0">
        <button
          onClick={onZoomOut}
          disabled={zoomLevel <= 50}
          className="p-1 text-gray-400 hover:text-white disabled:opacity-30 rounded hover:bg-gray-800/50 transition-colors cursor-pointer"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onResetZoom}
          className="text-xs text-gray-300 font-mono px-1.5 hover:text-blue-400 transition-colors cursor-pointer"
          title="Reset Zoom to 100%"
          aria-label="Reset Zoom to 100 Percent"
        >
          {zoomLevel}%
        </button>

        <button
          onClick={onZoomIn}
          disabled={zoomLevel >= 200}
          className="p-1 text-gray-400 hover:text-white disabled:opacity-30 rounded hover:bg-gray-800/50 transition-colors cursor-pointer"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-3.5 bg-gray-800 my-auto mx-0.5" />

        <button
          onClick={onFitWidth}
          className={`p-1 text-xs rounded transition-colors cursor-pointer ${
            zoomMode === 'fit-width'
              ? 'text-blue-400 bg-blue-500/20'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
          title="Fit to Width"
          aria-label="Fit Page to Width"
        >
          <MoveHorizontal className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onFitPage}
          className={`p-1 text-xs rounded transition-colors cursor-pointer ${
            zoomMode === 'fit-page'
              ? 'text-blue-400 bg-blue-500/20'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
          title="Fit to Page"
          aria-label="Fit Page to Screen"
        >
          <Square className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Close Document */}
      <button
        onClick={onCloseDocument}
        className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-800/60 transition-colors cursor-pointer shrink-0"
        title="Close Document Studio"
        aria-label="Close Document Studio Workspace"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
