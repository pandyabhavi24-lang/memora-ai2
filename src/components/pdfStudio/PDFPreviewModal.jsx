import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  FileText, 
  Layers, 
  X, 
  Type, 
  Sparkles,
  Maximize2
} from 'lucide-react';

export const PDFPreviewModal = ({
  isOpen,
  onClose,
  activeDocument,
  onOpenExport
}) => {
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);

  if (!activeDocument) return null;

  const pages = activeDocument.pages || [];
  const pageCount = pages.length;
  const activePage = pages[currentPreviewIndex] || pages[0];

  const activeTextOverlays = activePage?.textOverlays || [];
  const activeAnnotations = activePage?.annotations || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Preview: ${activeDocument.title || 'Document'}`}
      subtitle="Review document page flow, text overlays, and annotations before final export."
      maxWidth="max-w-4xl"
      actions={
        <>
          <div className="flex items-center gap-2 mr-auto text-xs text-gray-400 font-mono">
            <span>Page {currentPreviewIndex + 1} of {pageCount}</span>
            <span>•</span>
            <span>{activeTextOverlays.length} Text Box{activeTextOverlays.length === 1 ? '' : 'es'}</span>
            <span>•</span>
            <span>{activeAnnotations.length} Annotation{activeAnnotations.length === 1 ? '' : 's'}</span>
          </div>

          <Button variant="ghost" size="sm" onClick={onClose}>
            Exit Preview
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onClose();
              onOpenExport();
            }}
            icon={Download}
          >
            Export Document
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Top Preview Pagination Toolbar */}
        <div className="flex items-center justify-between bg-gray-950/70 p-2 rounded-xl border border-gray-800/60 text-xs">
          <button
            onClick={() => setCurrentPreviewIndex(p => Math.max(0, p - 1))}
            disabled={currentPreviewIndex <= 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 hover:text-white disabled:opacity-30 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous Page</span>
          </button>

          {/* Page Indicator Pills */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-sm custom-scrollbar py-1">
            {pages.map((p, idx) => (
              <button
                key={p.id || idx}
                onClick={() => setCurrentPreviewIndex(idx)}
                className={`w-7 h-7 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                  currentPreviewIndex === idx
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-gray-900 text-gray-400 border border-gray-800 hover:text-white'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPreviewIndex(p => Math.min(pageCount - 1, p + 1))}
            disabled={currentPreviewIndex >= pageCount - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 hover:text-white disabled:opacity-30 transition-all cursor-pointer"
          >
            <span>Next Page</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Centered Document Sheet Preview Container */}
        <div className="bg-gray-950/90 rounded-2xl p-6 border border-gray-800/80 flex items-center justify-center min-h-[420px] relative overflow-hidden select-none">
          {activePage && (
            <div 
              className="w-[440px] h-[620px] bg-white text-slate-900 rounded shadow-2xl p-8 flex flex-col justify-between relative overflow-hidden border border-slate-300 transition-transform duration-300"
              style={{ transform: `rotate(${activePage.rotation || 0}deg)` }}
            >
              {/* Header Marker */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-[9px] text-slate-400 font-mono tracking-wider">
                <span>MEMORA PREVIEW</span>
                <span>PAGE {currentPreviewIndex + 1} OF {pageCount}</span>
              </div>

              {/* Body Content */}
              <div className="flex-1 relative w-full h-full my-auto overflow-hidden">
                {activePage.type === 'image' && activePage.previewUrl && (
                  <div className="w-full h-full flex items-center justify-center p-2">
                    <img
                      src={activePage.previewUrl}
                      alt={activePage.title || 'Page Image'}
                      className="max-w-full max-h-[85%] object-contain rounded border border-slate-200"
                    />
                  </div>
                )}

                {/* Rendered Text Overlays */}
                {activeTextOverlays.map(item => (
                  <div
                    key={item.id}
                    style={{
                      position: 'absolute',
                      left: `${item.xPct || 10}%`,
                      top: `${item.yPct || 10}%`,
                      width: `${item.widthPct || 35}%`,
                      fontSize: `${item.fontSize || 16}px`,
                      fontWeight: item.isBold ? 'bold' : 'normal',
                      fontStyle: item.isItalic ? 'italic' : 'normal',
                      textDecoration: item.isUnderline ? 'underline' : 'none',
                      textAlign: item.align || 'left',
                      color: item.color || '#1e293b',
                      opacity: item.opacity || 1
                    }}
                    className="p-1 whitespace-pre-wrap break-words leading-snug font-sans pointer-events-none"
                  >
                    {item.text}
                  </div>
                ))}

                {/* Rendered Annotations */}
                {activeAnnotations.length > 0 && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    {activeAnnotations.map(ann => {
                      if (ann.type === 'highlight') {
                        return (
                          <rect
                            key={ann.id}
                            x={`${ann.xPct || 10}%`}
                            y={`${ann.yPct || 10}%`}
                            width={`${ann.widthPct || 30}%`}
                            height={`${ann.heightPct || 5}%`}
                            fill={ann.color || '#fef08a'}
                            opacity={ann.opacity || 0.4}
                          />
                        );
                      }
                      if (ann.type === 'draw' && ann.points) {
                        const pathString = ann.points.reduce((acc, pt, i) => (
                          i === 0 ? `M ${pt.xPct} ${pt.yPct}` : `${acc} L ${pt.xPct} ${pt.yPct}`
                        ), '');
                        return (
                          <path
                            key={ann.id}
                            d={pathString}
                            stroke={ann.color || '#2563eb'}
                            strokeWidth={ann.strokeWidth || 3}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        );
                      }
                      if (ann.type === 'rectangle') {
                        return (
                          <rect
                            key={ann.id}
                            x={`${ann.xPct}%`}
                            y={`${ann.yPct}%`}
                            width={`${ann.widthPct}%`}
                            height={`${ann.heightPct}%`}
                            stroke={ann.strokeColor || '#2563eb'}
                            strokeWidth={ann.strokeWidth || 2}
                            fill={ann.fillColor || 'transparent'}
                            opacity={ann.opacity || 1}
                          />
                        );
                      }
                      if (ann.type === 'circle') {
                        return (
                          <ellipse
                            key={ann.id}
                            cx={`${(ann.xPct || 10) + (ann.widthPct || 20) / 2}%`}
                            cy={`${(ann.yPct || 10) + (ann.heightPct || 20) / 2}%`}
                            rx={`${(ann.widthPct || 20) / 2}%`}
                            ry={`${(ann.heightPct || 20) / 2}%`}
                            stroke={ann.strokeColor || '#2563eb'}
                            strokeWidth={ann.strokeWidth || 2}
                            fill={ann.fillColor || 'transparent'}
                            opacity={ann.opacity || 1}
                          />
                        );
                      }
                      if (ann.type === 'line' || ann.type === 'arrow') {
                        return (
                          <line
                            key={ann.id}
                            x1={`${ann.x1Pct}%`}
                            y1={`${ann.y1Pct}%`}
                            x2={`${ann.x2Pct}%`}
                            y2={`${ann.y2Pct}%`}
                            stroke={ann.strokeColor || '#2563eb'}
                            strokeWidth={ann.strokeWidth || 2}
                          />
                        );
                      }
                      return null;
                    })}
                  </svg>
                )}
              </div>

              {/* Footer Marker */}
              <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-[9px] text-slate-400 font-mono tracking-wider">
                <span>PREVIEW MODE</span>
                <span>PAGE {currentPreviewIndex + 1}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
