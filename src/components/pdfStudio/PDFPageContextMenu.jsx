import React, { useEffect, useRef } from 'react';
import { 
  RotateCcw, 
  RotateCw, 
  Copy, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Download, 
  FilePlus 
} from 'lucide-react';

export const PDFPageContextMenu = ({
  x,
  y,
  pageIndex,
  totalPages,
  selectedCount = 1,
  onClose,
  onRotateLeft,
  onRotateRight,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDelete,
  onExtract
}) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{ top: `${y}px`, left: `${x}px` }}
      className="fixed z-50 w-52 glass-panel rounded-xl border border-gray-800 bg-gray-950/95 shadow-2xl p-1.5 text-xs text-gray-200 backdrop-blur-md select-none animate-fadeIn"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-2 py-1 text-[10px] font-mono text-gray-400 uppercase tracking-wider border-b border-gray-800/80 mb-1">
        Page {pageIndex + 1} Actions {selectedCount > 1 && `(${selectedCount} selected)`}
      </div>

      <button
        onClick={() => { onRotateLeft(pageIndex); onClose(); }}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-800/80 hover:text-white transition-colors text-left cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
        <span>Rotate Left 90°</span>
      </button>

      <button
        onClick={() => { onRotateRight(pageIndex); onClose(); }}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-800/80 hover:text-white transition-colors text-left cursor-pointer"
      >
        <RotateCw className="w-3.5 h-3.5 text-blue-400" />
        <span>Rotate Right 90°</span>
      </button>

      <button
        onClick={() => { onDuplicate(pageIndex); onClose(); }}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-800/80 hover:text-white transition-colors text-left cursor-pointer"
      >
        <Copy className="w-3.5 h-3.5 text-indigo-400" />
        <span>Duplicate Page{selectedCount > 1 ? 's' : ''}</span>
      </button>

      <div className="w-full h-px bg-gray-800/80 my-1" />

      <button
        onClick={() => { onMoveUp(pageIndex); onClose(); }}
        disabled={pageIndex <= 0}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-800/80 hover:text-white disabled:opacity-30 transition-colors text-left cursor-pointer"
      >
        <ArrowUp className="w-3.5 h-3.5" />
        <span>Move Page Up</span>
      </button>

      <button
        onClick={() => { onMoveDown(pageIndex); onClose(); }}
        disabled={pageIndex >= totalPages - 1}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-800/80 hover:text-white disabled:opacity-30 transition-colors text-left cursor-pointer"
      >
        <ArrowDown className="w-3.5 h-3.5" />
        <span>Move Page Down</span>
      </button>

      <div className="w-full h-px bg-gray-800/80 my-1" />

      <button
        onClick={() => { onExtract(); onClose(); }}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-800/80 hover:text-purple-400 transition-colors text-left cursor-pointer"
      >
        <Download className="w-3.5 h-3.5 text-purple-400" />
        <span>Extract Selected ({selectedCount})</span>
      </button>

      <button
        onClick={() => { onDelete(pageIndex); onClose(); }}
        disabled={totalPages <= 1}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-red-500/15 text-red-400 hover:text-red-300 disabled:opacity-30 transition-colors text-left cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Delete Page{selectedCount > 1 ? 's' : ''}</span>
      </button>
    </div>
  );
};
