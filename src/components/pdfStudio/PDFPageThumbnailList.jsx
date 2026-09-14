import React, { useState } from 'react';
import { 
  Plus, 
  RotateCcw, 
  RotateCw, 
  Copy, 
  ArrowUp, 
  ArrowDown, 
  Trash2,
  FileText,
  CheckSquare,
  Square,
  Download,
  GripVertical
} from 'lucide-react';

export const PDFPageThumbnailList = ({
  pages = [],
  activePageIndex = 0,
  selectedPageIndices = [0],
  onSelectPage,
  onToggleSelectPage,
  onSelectAll,
  onClearSelection,
  onRotateLeft,
  onRotateRight,
  onDuplicatePage,
  onMoveUp,
  onMoveDown,
  onDeletePage,
  onAddPage,
  onExtractSelected,
  onDragReorder,
  onOpenContextMenu
}) => {
  const [draggedIndex, setDraggedIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      onDragReorder(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
  };

  const isAllSelected = selectedPageIndices.length === pages.length && pages.length > 0;

  return (
    <aside className="w-64 glass-panel rounded-xl p-3 border border-gray-800/80 bg-gray-900/60 flex flex-col shrink-0 overflow-hidden select-none">
      {/* Thumbnail Drawer Header */}
      <div className="flex items-center justify-between px-2 pb-2.5 border-b border-gray-800/60">
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-blue-400" />
          <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Pages ({pages.length})
          </h3>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onAddPage}
            className="p-1 text-gray-400 hover:text-blue-400 rounded hover:bg-gray-800/60 transition-colors cursor-pointer"
            title="Add Blank Page"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Multi-Selection Control Toolbar */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-gray-800/40 text-[11px] text-gray-400">
        <button
          onClick={isAllSelected ? onClearSelection : onSelectAll}
          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
        >
          {isAllSelected ? (
            <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
          ) : (
            <Square className="w-3.5 h-3.5" />
          )}
          <span>{isAllSelected ? 'Deselect All' : 'Select All'}</span>
        </button>

        {selectedPageIndices.length > 0 && (
          <span className="font-mono text-blue-400 font-semibold">
            {selectedPageIndices.length} Selected
          </span>
        )}
      </div>

      {/* Extract Action Button (Visible when multi-selection > 0) */}
      {selectedPageIndices.length > 0 && (
        <div className="px-1 py-1.5 border-b border-gray-800/40">
          <button
            onClick={onExtractSelected}
            className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-medium transition-all cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-purple-400" />
            <span>Extract Selected ({selectedPageIndices.length})</span>
          </button>
        </div>
      )}

      {/* Thumbnails Scroll Container */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 pt-2 custom-scrollbar">
        {pages.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-400 space-y-2 my-auto">
            <FileText className="w-8 h-8 text-gray-600 mx-auto" />
            <p>No pages in document.</p>
            <button
              onClick={onAddPage}
              className="px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-semibold cursor-pointer hover:bg-blue-600/30 transition-colors"
            >
              + Add First Page
            </button>
          </div>
        ) : (
          pages.map((page, idx) => {
            const isActive = idx === activePageIndex;
            const isSelected = selectedPageIndices.includes(idx);

            return (
              <div
                key={page.id || idx}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey || e.shiftKey) {
                    onToggleSelectPage(idx);
                  } else {
                    onSelectPage(idx);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onOpenContextMenu(e, idx);
                }}
                className={`group relative p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600/15 border-blue-500/60 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/40'
                    : 'bg-gray-950/40 border-gray-800/60 hover:border-gray-700/80 hover:bg-gray-800/30'
                } ${draggedIndex === idx ? 'opacity-40 border-dashed border-blue-400' : ''}`}
              >
                {/* Top Bar: Checkbox, Page Number, Drag Handle */}
                <div className="flex items-center justify-between mb-2 px-0.5 z-10">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelectPage(idx);
                      }}
                      className="p-0.5 text-gray-400 hover:text-blue-400 cursor-pointer"
                      title="Select Page"
                      aria-label={`Select Page ${idx + 1}`}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <span className={`text-[11px] font-mono font-bold ${isSelected ? 'text-blue-400' : 'text-gray-400'}`}>
                      #{idx + 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {isActive && (
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono">
                        Active
                      </span>
                    )}
                    <GripVertical className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 cursor-grab shrink-0" />
                  </div>
                </div>

                {/* Hover Quick Action Toolbar */}
                <div className="absolute top-8 right-2 z-20 flex items-center gap-0.5 bg-gray-900/95 backdrop-blur-md p-1 rounded-lg border border-gray-800 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRotateLeft(idx);
                    }}
                    className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 cursor-pointer"
                    title="Rotate Left"
                    aria-label={`Rotate Page ${idx + 1} Left 90 Degrees`}
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRotateRight(idx);
                    }}
                    className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 cursor-pointer"
                    title="Rotate Right"
                    aria-label={`Rotate Page ${idx + 1} Right 90 Degrees`}
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicatePage(idx);
                    }}
                    className="p-1 text-gray-400 hover:text-indigo-400 rounded hover:bg-gray-800 cursor-pointer"
                    title="Duplicate Page"
                    aria-label={`Duplicate Page ${idx + 1}`}
                  >
                    <Copy className="w-3 h-3" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveUp(idx);
                    }}
                    disabled={idx === 0}
                    className="p-1 text-gray-400 hover:text-white disabled:opacity-20 rounded hover:bg-gray-800 cursor-pointer"
                    title="Move Up"
                    aria-label={`Move Page ${idx + 1} Up`}
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveDown(idx);
                    }}
                    disabled={idx === pages.length - 1}
                    className="p-1 text-gray-400 hover:text-white disabled:opacity-20 rounded hover:bg-gray-800 cursor-pointer"
                    title="Move Down"
                    aria-label={`Move Page ${idx + 1} Down`}
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>

                  {pages.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePage(idx);
                      }}
                      className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-500/10 cursor-pointer"
                      title="Delete Page"
                      aria-label={`Delete Page ${idx + 1}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Thumbnail Miniature Surface Frame */}
                <div 
                  className="w-full aspect-[1/1.3] bg-slate-900 rounded-lg border border-slate-800 flex flex-col justify-between p-2 shadow-inner overflow-hidden transition-transform duration-200"
                  style={{ transform: `rotate(${page.rotation || 0}deg)` }}
                >
                  {page.type === 'image' && page.previewUrl ? (
                    <img
                      src={page.previewUrl}
                      alt={page.name || `Page ${idx + 1}`}
                      className="w-full h-full object-contain rounded"
                    />
                  ) : (
                    <>
                      <div className="space-y-1.5 opacity-40">
                        <div className="w-3/4 h-1.5 bg-slate-400 rounded-sm" />
                        <div className="w-full h-1 bg-slate-600 rounded-sm" />
                        <div className="w-5/6 h-1 bg-slate-600 rounded-sm" />
                        <div className="w-4/5 h-1 bg-slate-600 rounded-sm" />
                      </div>

                      <div className="text-[9px] text-slate-500 font-mono text-center my-auto">
                        Blank Canvas
                      </div>

                      <div className="space-y-1 opacity-30">
                        <div className="w-full h-1 bg-slate-600 rounded-sm" />
                        <div className="w-2/3 h-1 bg-slate-600 rounded-sm" />
                      </div>
                    </>
                  )}
                </div>

                {/* Footer Page Label */}
                <div className="flex items-center justify-between mt-2 px-1 text-xs">
                  <span className={`font-mono font-medium truncate max-w-[120px] ${isSelected ? 'text-blue-400 font-semibold' : 'text-gray-400'}`}>
                    {page.name ? page.name : `Page ${idx + 1}`}
                  </span>
                  {page.rotation > 0 && (
                    <span className="text-[10px] text-amber-400/90 font-mono">
                      {page.rotation}°
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
