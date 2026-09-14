import React, { useState, useRef, useEffect } from 'react';
import { 
  Eye, 
  Edit3, 
  Highlighter, 
  Type, 
  FileText,
  Move,
  Trash2
} from 'lucide-react';
import { PDFTextFormattingBar } from './PDFTextFormattingBar';

export const PDFWorkspace = ({
  activePage,
  activePageIndex = 0,
  totalPages = 1,
  zoomLevel = 100,
  zoomMode = 'custom', // 'custom' | 'fit-width' | 'fit-page'
  viewMode = 'view', // 'view' | 'edit' | 'annotate'
  pageSize = 'A4',
  orientation = 'portrait',
  selectedTextId = null,
  onSelectText,
  onAddTextAtPosition,
  onUpdateText,
  onDeleteText
}) => {
  const rotation = activePage?.rotation || 0;
  const pageContainerRef = useRef(null);

  // Drag-to-Move State for Text Boxes
  const [draggingTextId, setDraggingTextId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Drag-to-Resize State for Text Boxes
  const [resizingTextId, setResizingTextId] = useState(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidthPct, setResizeStartWidthPct] = useState(30);

  // Focus/Editing State for Text Box Inline Typing
  const [editingTextId, setEditingTextId] = useState(null);

  // Dynamic dimensions based on Page Size & Orientation
  const dimensions = {
    A4: orientation === 'portrait' ? { w: 'w-[595px]', h: 'h-[842px]', widthPx: 595, heightPx: 842 } : { w: 'w-[842px]', h: 'h-[595px]', widthPx: 842, heightPx: 595 },
    Letter: orientation === 'portrait' ? { w: 'w-[612px]', h: 'h-[792px]', widthPx: 612, heightPx: 792 } : { w: 'w-[792px]', h: 'h-[612px]', widthPx: 792, heightPx: 612 },
    Legal: orientation === 'portrait' ? { w: 'w-[612px]', h: 'h-[1008px]', widthPx: 612, heightPx: 1008 } : { w: 'w-[1008px]', h: 'h-[612px]', widthPx: 1008, heightPx: 612 }
  }[pageSize] || { w: 'w-[595px]', h: 'h-[842px]', widthPx: 595, heightPx: 842 };

  // Calculate style transformation for zoom modes
  const getScaleStyle = () => {
    if (zoomMode === 'fit-width') {
      return { transform: 'scale(1.15)', transformOrigin: 'top center' };
    }
    if (zoomMode === 'fit-page') {
      return { transform: 'scale(0.85)', transformOrigin: 'center center' };
    }
    return { transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' };
  };

  // Handle Page Canvas Click to Create Text Box in Edit Mode
  const handlePageCanvasClick = (e) => {
    if (viewMode !== 'edit') return;
    if (editingTextId || draggingTextId || resizingTextId) return;

    if (pageContainerRef.current) {
      const rect = pageContainerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Page-relative percentage coordinates (0% to 100%)
      const xPct = Math.max(5, Math.min(85, (clickX / rect.width) * 100));
      const yPct = Math.max(5, Math.min(90, (clickY / rect.height) * 100));

      onAddTextAtPosition({ xPct, yPct });
    }
  };

  // Drag-to-Move Event Listeners
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (draggingTextId && pageContainerRef.current) {
        const rect = pageContainerRef.current.getBoundingClientRect();
        const currentX = e.clientX - rect.left - dragOffset.x;
        const currentY = e.clientY - rect.top - dragOffset.y;

        const xPct = Math.max(0, Math.min(85, (currentX / rect.width) * 100));
        const yPct = Math.max(0, Math.min(92, (currentY / rect.height) * 100));

        onUpdateText(draggingTextId, { xPct, yPct });
      }

      if (resizingTextId && pageContainerRef.current) {
        const rect = pageContainerRef.current.getBoundingClientRect();
        const deltaX = e.clientX - resizeStartX;
        const deltaPct = (deltaX / rect.width) * 100;
        const newWidthPct = Math.max(10, Math.min(90, resizeStartWidthPct + deltaPct));

        onUpdateText(resizingTextId, { widthPct: newWidthPct });
      }
    };

    const handleMouseUp = () => {
      setDraggingTextId(null);
      setResizingTextId(null);
    };

    if (draggingTextId || resizingTextId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingTextId, resizingTextId, dragOffset, resizeStartX, resizeStartWidthPct, onUpdateText]);

  // Keyboard Deletion Handling for Selected Text Box
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTextId && !editingTextId) {
        // Prevent deleting if user is typing inside an input field
        const activeElem = document.activeElement;
        if (activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA')) {
          return;
        }
        onDeleteText(selectedTextId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTextId, editingTextId, onDeleteText]);

  const activeTextOverlays = activePage?.textOverlays || [];
  const selectedTextObj = activeTextOverlays.find(t => t.id === selectedTextId);

  return (
    <main className="flex-1 flex flex-col items-center justify-start glass-panel rounded-xl p-8 border border-gray-800/80 bg-gray-950/80 backdrop-blur-md overflow-auto relative custom-scrollbar select-none">
      {/* Viewport Top Info Bar */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900/90 border border-gray-800/80 backdrop-blur-md text-xs text-gray-400 font-mono shadow-lg">
        <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
          {viewMode === 'view' && <Eye className="w-3.5 h-3.5" />}
          {viewMode === 'edit' && <Edit3 className="w-3.5 h-3.5" />}
          {viewMode === 'annotate' && <Highlighter className="w-3.5 h-3.5" />}
          <span className="capitalize">{viewMode} Mode</span>
        </span>
        <span className="text-gray-700">|</span>
        <span>Page {activePageIndex + 1} / {totalPages}</span>
        <span className="text-gray-700">|</span>
        <span>{pageSize} ({orientation})</span>
      </div>

      {/* Floating Contextual Text Formatting Toolbar (Visible when text box is selected) */}
      {selectedTextObj && (
        <div className="absolute top-4 right-4 z-30">
          <PDFTextFormattingBar
            selectedText={selectedTextObj}
            onUpdateText={(updates) => onUpdateText(selectedTextObj.id, updates)}
            onDeleteText={() => onDeleteText(selectedTextObj.id)}
          />
        </div>
      )}

      {/* Main Centered Document Page Sheet Viewport */}
      <div 
        className="my-auto py-6 transition-all duration-200 ease-out flex justify-center"
        style={getScaleStyle()}
      >
        <div 
          ref={pageContainerRef}
          onClick={handlePageCanvasClick}
          className={`${dimensions.w} ${dimensions.h} bg-white text-slate-900 rounded-sm shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-10 flex flex-col justify-between relative overflow-hidden transition-transform duration-300 border border-slate-300 ${
            viewMode === 'edit' ? 'cursor-crosshair' : 'cursor-default'
          }`}
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {/* Header Line Marker */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 text-[10px] text-slate-400 font-mono tracking-wider shrink-0 pointer-events-none select-none">
            <span>MEMORA PDF STUDIO</span>
            <span>PAGE {activePageIndex + 1} OF {totalPages}</span>
          </div>

          {/* Page Body / Content Layer */}
          <div className="flex-1 relative w-full h-full my-auto overflow-hidden">
            {/* Real Selected Image Page Render */}
            {activePage?.type === 'image' && activePage?.previewUrl && (
              <div className="w-full h-full flex flex-col items-center justify-center p-2 pointer-events-none">
                <img
                  src={activePage.previewUrl}
                  alt={activePage.title || 'PDF Image Page'}
                  className="max-w-full max-h-[90%] object-contain rounded border border-slate-200 shadow-sm"
                />
              </div>
            )}

            {/* Blank Page Hint (when no text overlays exist) */}
            {activePage?.type === 'blank' && activeTextOverlays.length === 0 && (
              <div className="w-full h-full flex flex-col items-center justify-center text-center space-y-3 pointer-events-none">
                <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto">
                  <Type className="w-6 h-6" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h4 className="text-sm font-semibold text-slate-700">Page Canvas Ready</h4>
                  <p className="text-xs text-slate-400">
                    {viewMode === 'edit'
                      ? 'Click anywhere on this page sheet to create a new text box.'
                      : 'Switch to Edit Mode to insert text overlays.'}
                  </p>
                </div>
              </div>
            )}

            {/* RENDERED PAGE-RELATIVE TEXT OVERLAYS LAYER */}
            {activeTextOverlays.map((item) => {
              const isSelected = item.id === selectedTextId;
              const isEditing = item.id === editingTextId;

              return (
                <div
                  key={item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectText(item.id);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onSelectText(item.id);
                    setEditingTextId(item.id);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${item.xPct || 10}%`,
                    top: `${item.yPct || 10}%`,
                    width: `${item.widthPct || 35}%`,
                    opacity: item.opacity || 1
                  }}
                  className={`group rounded transition-shadow ${
                    isSelected
                      ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white border border-dashed border-blue-400 bg-blue-500/5'
                      : 'hover:border hover:border-dashed hover:border-slate-400'
                  }`}
                >
                  {/* Text Box Header Bar (Move Handle & Delete Button when Selected) */}
                  {isSelected && (
                    <div 
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        if (pageContainerRef.current) {
                          const rect = pageContainerRef.current.getBoundingClientRect();
                          const boxElem = e.currentTarget.parentElement.getBoundingClientRect();
                          setDraggingTextId(item.id);
                          setDragOffset({
                            x: e.clientX - boxElem.left,
                            y: e.clientY - boxElem.top
                          });
                        }
                      }}
                      className="absolute -top-6 left-0 right-0 h-5 bg-blue-600 text-white rounded-t flex items-center justify-between px-1.5 cursor-move z-20 shadow-md text-[10px] font-mono select-none"
                    >
                      <span className="flex items-center gap-1">
                        <Move className="w-3 h-3" />
                        <span>Move Box</span>
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteText(item.id);
                        }}
                        className="hover:text-red-200 cursor-pointer"
                        title="Delete Text"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Text Box Content: Editable Textarea vs. Rendered Styled Text */}
                  {isEditing ? (
                    <textarea
                      autoFocus
                      value={item.text}
                      onChange={(e) => onUpdateText(item.id, { text: e.target.value })}
                      onBlur={() => setEditingTextId(null)}
                      rows={Math.max(2, item.text.split('\n').length)}
                      style={{
                        fontSize: `${item.fontSize || 16}px`,
                        fontWeight: item.isBold ? 'bold' : 'normal',
                        fontStyle: item.isItalic ? 'italic' : 'normal',
                        textDecoration: item.isUnderline ? 'underline' : 'none',
                        textAlign: item.align || 'left',
                        color: item.color || '#1e293b'
                      }}
                      className="w-full bg-transparent border-none outline-none resize-none p-1 font-sans leading-snug"
                    />
                  ) : (
                    <div
                      style={{
                        fontSize: `${item.fontSize || 16}px`,
                        fontWeight: item.isBold ? 'bold' : 'normal',
                        fontStyle: item.isItalic ? 'italic' : 'normal',
                        textDecoration: item.isUnderline ? 'underline' : 'none',
                        textAlign: item.align || 'left',
                        color: item.color || '#1e293b'
                      }}
                      className="w-full p-1 whitespace-pre-wrap break-words leading-snug font-sans cursor-text"
                    >
                      {item.text || 'Double-click to edit text...'}
                    </div>
                  )}

                  {/* Corner Resize Handle */}
                  {isSelected && (
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setResizingTextId(item.id);
                        setResizeStartX(e.clientX);
                        setResizeStartWidthPct(item.widthPct || 35);
                      }}
                      className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-600 border border-white rounded-full cursor-se-resize z-20 shadow-sm"
                      title="Resize Text Box Width"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer Line Marker */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-[10px] text-slate-400 font-mono tracking-wider shrink-0 pointer-events-none select-none">
            <span>DOCUMENT WORKSPACE</span>
            <span>{pageSize} • {orientation.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </main>
  );
};
