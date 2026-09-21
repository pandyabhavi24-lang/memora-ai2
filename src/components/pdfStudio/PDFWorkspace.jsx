import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Eye, 
  Edit3, 
  Move,
  Trash2,
  Copy,
  AlignCenter
} from 'lucide-react';
import { PDFTextFormattingBar } from './PDFTextFormattingBar';

export const PDFWorkspace = ({
  activePage,
  activePageIndex = 0,
  totalPages = 1,
  zoomLevel = 100,
  zoomMode = 'fit-page', // 'custom' | 'fit-width' | 'fit-page'
  viewMode = 'edit', // 'view' | 'edit' | 'annotate'
  pageSize = 'A4',
  orientation = 'portrait',
  selectedElementId = null,
  onSelectElement,
  onAddTextAtPosition,
  onAddImageAtPosition,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  // Legacy props compatibility
  selectedTextId = null,
  onSelectText,
  onUpdateText,
  onDeleteText
}) => {
  const rotation = activePage?.rotation || 0;
  const workspaceContainerRef = useRef(null);
  const pageContainerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 900, height: 700 });

  // Active selection ID fallback
  const activeSelectedId = selectedElementId || selectedTextId;
  const handleSelect = onSelectElement || onSelectText || (() => {});
  const handleUpdate = onUpdateElement || onUpdateText || (() => {});
  const handleDelete = onDeleteElement || onDeleteText || (() => {});

  // Drag-to-Move State
  const [draggingId, setDraggingId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Drag-to-Resize State (Supports 8 handles)
  // Handle directions: 'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'
  const [resizingInfo, setResizingInfo] = useState(null);

  // Inline Text Editing State
  const [editingTextId, setEditingTextId] = useState(null);

  // Dynamic dimensions based on standard page sizes (Points: 1pt = 1px at 100% zoom)
  const dimensions = {
    A4: orientation === 'portrait' ? { width: 595, height: 842 } : { width: 842, height: 595 },
    Letter: orientation === 'portrait' ? { width: 612, height: 792 } : { width: 792, height: 612 },
    Legal: orientation === 'portrait' ? { width: 612, height: 1008 } : { width: 1008, height: 612 }
  }[pageSize] || { width: 595, height: 842 };

  // Observe container size to calculate dynamic fit-to-page without cropping
  useEffect(() => {
    if (!workspaceContainerRef.current) return;
    const updateSize = () => {
      if (workspaceContainerRef.current) {
        const rect = workspaceContainerRef.current.getBoundingClientRect();
        setContainerSize({
          width: Math.max(300, rect.width),
          height: Math.max(300, rect.height)
        });
      }
    };
    updateSize();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setContainerSize({
            width: Math.max(300, entry.contentRect.width),
            height: Math.max(300, entry.contentRect.height)
          });
        }
      }
    });
    observer.observe(workspaceContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute exact scale dynamically
  const computedScale = useMemo(() => {
    const padW = 48;
    const padH = 80;
    const availW = Math.max(200, containerSize.width - padW);
    const availH = Math.max(200, containerSize.height - padH);

    if (zoomMode === 'fit-page') {
      const scaleW = availW / dimensions.width;
      const scaleH = availH / dimensions.height;
      return Math.min(scaleW, scaleH);
    }
    if (zoomMode === 'fit-width') {
      return availW / dimensions.width;
    }
    return Math.max(0.25, Math.min(3.0, (zoomLevel || 100) / 100));
  }, [containerSize, dimensions.width, dimensions.height, zoomMode, zoomLevel]);

  // Calculate style transformation for zoom modes
  const getScaleStyle = () => {
    return {
      transform: `scale(${computedScale})`,
      transformOrigin: 'center center'
    };
  };

  // Collect unified elements array (elements or converted textOverlays)
  const elements = React.useMemo(() => {
    if (activePage?.elements && activePage.elements.length > 0) {
      return activePage.elements;
    }
    const list = [];
    // Convert legacy textOverlays
    if (activePage?.textOverlays && activePage.textOverlays.length > 0) {
      activePage.textOverlays.forEach((t) => {
        const xPt = (parseFloat(t.xPct ?? 10) / 100) * dimensions.width;
        const yPt = (parseFloat(t.yPct ?? 10) / 100) * dimensions.height;
        const widthPt = (parseFloat(t.widthPct ?? 35) / 100) * dimensions.width;
        list.push({
          id: t.id,
          type: 'text',
          x: xPt,
          y: yPt,
          width: widthPt,
          height: Math.max(30, (t.fontSize || 16) * 2),
          text: t.text || '',
          fontSize: t.fontSize || 16,
          fontWeight: t.isBold ? 'bold' : 'normal',
          fontStyle: t.isItalic ? 'italic' : 'normal',
          textAlign: t.align || 'left',
          color: t.color || '#1e293b',
          zIndex: 10
        });
      });
    }
    // Background image page
    if (activePage?.type === 'image' && activePage?.previewUrl) {
      list.unshift({
        id: 'bg_img_' + (activePage.id || '0'),
        type: 'image',
        x: 36,
        y: 36,
        width: dimensions.width - 72,
        height: dimensions.height - 72,
        previewUrl: activePage.previewUrl,
        imagePath: activePage.imagePath || activePage.previewUrl,
        fileName: activePage.title || 'Image',
        aspectRatio: 1.0,
        zIndex: 0
      });
    }
    return list;
  }, [activePage, dimensions.width, dimensions.height]);

  const selectedElement = elements.find(e => e.id === activeSelectedId);

  // Handle Page Canvas Click / Double-Click
  const handlePageCanvasClick = (e) => {
    if (editingTextId || draggingId || resizingInfo) return;
    // Click outside unselects
    if (e.target === pageContainerRef.current) {
      handleSelect(null);
    }
  };

  const handlePageDoubleClick = (e) => {
    if (viewMode !== 'edit') return;
    if (pageContainerRef.current) {
      const rect = pageContainerRef.current.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) / computedScale;
      const clickY = (e.clientY - rect.top) / computedScale;

      const clampedX = Math.max(36, Math.min(dimensions.width - 200, clickX));
      const clampedY = Math.max(36, Math.min(dimensions.height - 80, clickY));

      if (onAddTextAtPosition) {
        onAddTextAtPosition({ x: clampedX, y: clampedY });
      }
    }
  };

  // Drag and Drop Image File onto Page Canvas
  const handleCanvasDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const rect = pageContainerRef.current.getBoundingClientRect();
        const dropX = (e.clientX - rect.left) / computedScale;
        const dropY = (e.clientY - rect.top) / computedScale;

        if (onAddImageAtPosition) {
          onAddImageAtPosition(file, { x: dropX, y: dropY });
        }
      }
    }
  };

  // Mouse Move / Up Listeners for Dragging & Resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      // Handle Element Dragging
      if (draggingId && pageContainerRef.current) {
        const rect = pageContainerRef.current.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) / computedScale;
        const mouseY = (e.clientY - rect.top) / computedScale;

        const newX = Math.max(0, Math.min(dimensions.width - 20, mouseX - dragOffset.x));
        const newY = Math.max(0, Math.min(dimensions.height - 20, mouseY - dragOffset.y));

        handleUpdate(draggingId, { x: Math.round(newX), y: Math.round(newY) });
      }

      // Handle Element Resizing (8-way Word-like resizing)
      if (resizingInfo && pageContainerRef.current) {
        const deltaX = (e.clientX - resizingInfo.startX) / computedScale;
        const deltaY = (e.clientY - resizingInfo.startY) / computedScale;
        const { handle, startX, startY, startWidth, startHeight, aspectRatio } = resizingInfo;

        let newWidth = startWidth;
        let newHeight = startHeight;
        let newX = startX;
        let newY = startY;

        if (handle.includes('e')) {
          newWidth = Math.max(30, startWidth + deltaX);
        }
        if (handle.includes('s')) {
          newHeight = Math.max(20, startHeight + deltaY);
        }
        if (handle.includes('w')) {
          const possibleWidth = startWidth - deltaX;
          if (possibleWidth > 30) {
            newWidth = possibleWidth;
            newX = startX + deltaX;
          }
        }
        if (handle.includes('n')) {
          const possibleHeight = startHeight - deltaY;
          if (possibleHeight > 20) {
            newHeight = possibleHeight;
            newY = startY + deltaY;
          }
        }

        // Maintain aspect ratio for corner handles on images
        if (aspectRatio && (handle === 'se' || handle === 'nw' || handle === 'ne' || handle === 'sw')) {
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            newHeight = newWidth / aspectRatio;
          } else {
            newWidth = newHeight * aspectRatio;
          }
        }

        handleUpdate(resizingInfo.id, {
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.round(newWidth),
          height: Math.round(newHeight)
        });
      }
    };

    const handleMouseUp = () => {
      setDraggingId(null);
      setResizingInfo(null);
    };

    if (draggingId || resizingInfo) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingId, resizingInfo, dragOffset, dimensions.width, dimensions.height, computedScale, handleUpdate]);

  // Keyboard Delete / Duplicate Handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeSelectedId && !editingTextId) {
        const activeElem = document.activeElement;
        if (activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA')) {
          return;
        }
        handleDelete(activeSelectedId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSelectedId, editingTextId, handleDelete]);

  return (
    <main ref={workspaceContainerRef} className="flex-1 flex flex-col items-center justify-start glass-panel rounded-2xl p-6 border border-gray-800/80 bg-gray-950/90 backdrop-blur-md overflow-auto relative custom-scrollbar select-none">
      {/* Viewport Top Info Bar */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-900/90 border border-gray-800/80 backdrop-blur-md text-xs text-gray-300 font-mono shadow-lg">
        <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
          {viewMode === 'view' && <Eye className="w-3.5 h-3.5" />}
          {viewMode === 'edit' && <Edit3 className="w-3.5 h-3.5" />}
          <span className="capitalize">{viewMode} Mode</span>
        </span>
        <span className="text-gray-700">|</span>
        <span>Page {activePageIndex + 1} of {totalPages}</span>
        <span className="text-gray-700">|</span>
        <span>{pageSize} ({orientation}) • {dimensions.width}×{dimensions.height} pt</span>
      </div>

      {/* Floating Contextual Text Formatting Toolbar (Visible when text element is selected) */}
      {selectedElement && selectedElement.type === 'text' && (
        <div className="absolute top-4 right-4 z-30 animate-fadeIn">
          <PDFTextFormattingBar
            selectedText={selectedElement}
            onUpdateText={(updates) => handleUpdate(selectedElement.id, updates)}
            onDeleteText={() => handleDelete(selectedElement.id)}
          />
        </div>
      )}

      {/* Main Centered Document Page Sheet Viewport */}
      <div 
        className="my-auto py-8 transition-all duration-200 ease-out flex justify-center w-full"
        style={getScaleStyle()}
      >
        <div 
          ref={pageContainerRef}
          onClick={handlePageCanvasClick}
          onDoubleClick={handlePageDoubleClick}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          style={{
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
            transform: `rotate(${rotation}deg)`
          }}
          className={`bg-white text-slate-900 rounded-sm shadow-[0_25px_70px_rgba(0,0,0,0.85)] relative overflow-hidden border border-slate-300 ${
            viewMode === 'edit' ? 'cursor-default' : 'cursor-default'
          }`}
        >
          {/* Subtle Document Margins Guide Line (36pt standard margin) */}
          <div className="absolute inset-[36px] border border-dashed border-slate-200 pointer-events-none rounded-sm" />

          {/* RENDERED PAGE ELEMENTS (TEXT BOXES & RESIZABLE IMAGES) */}
          {elements.map((elem) => {
            const isSelected = elem.id === activeSelectedId;
            const isEditing = elem.id === editingTextId;
            const isImage = elem.type === 'image';
            const isText = elem.type === 'text';

            return (
              <div
                key={elem.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(elem.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleSelect(elem.id);
                  if (isText) setEditingTextId(elem.id);
                }}
                style={{
                  position: 'absolute',
                  left: `${elem.x}px`,
                  top: `${elem.y}px`,
                  width: `${elem.width}px`,
                  height: `${elem.height}px`,
                  zIndex: isSelected ? 40 : (elem.zIndex || 1)
                }}
                className={`group transition-shadow ${
                  isSelected
                    ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white border border-dashed border-blue-400'
                    : 'hover:border hover:border-dashed hover:border-slate-400'
                }`}
              >
                {/* ------------------------------------------------------------- */}
                {/* FLOATING ACTION BAR FOR SELECTED ELEMENT */}
                {/* ------------------------------------------------------------- */}
                {isSelected && (
                  <div 
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      if (pageContainerRef.current) {
                        const rect = pageContainerRef.current.getBoundingClientRect();
                        setDraggingId(elem.id);
                        setDragOffset({
                          x: (e.clientX - rect.left) / computedScale - elem.x,
                          y: (e.clientY - rect.top) / computedScale - elem.y
                        });
                      }
                    }}
                    className="absolute -top-7 left-0 right-0 h-6 bg-slate-900 text-white rounded-t-md flex items-center justify-between px-2 cursor-move z-50 shadow-md text-[10px] font-mono select-none"
                  >
                    <span className="flex items-center gap-1.5 font-semibold text-blue-300">
                      <Move className="w-3 h-3" />
                      <span>{isImage ? 'Image' : 'Text Box'}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      {isImage && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Center on page
                            handleUpdate(elem.id, { x: (dimensions.width - elem.width) / 2 });
                          }}
                          className="hover:text-blue-300 cursor-pointer text-slate-400"
                          title="Center Horizontally"
                        >
                          <AlignCenter className="w-3 h-3" />
                        </button>
                      )}

                      {onDuplicateElement && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateElement(elem.id);
                          }}
                          className="hover:text-blue-300 cursor-pointer text-slate-400"
                          title="Duplicate Element"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(elem.id);
                        }}
                        className="hover:text-red-300 cursor-pointer text-red-400"
                        title="Delete Element"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* IMAGE ELEMENT: REAL IMAGE RENDERING (WORD-LIKE) */}
                {/* ------------------------------------------------------------- */}
                {isImage && (
                  <div 
                    onMouseDown={(e) => {
                      // Allow dragging by clicking image body if selected
                      if (isSelected && !resizingInfo && pageContainerRef.current) {
                        e.stopPropagation();
                        const rect = pageContainerRef.current.getBoundingClientRect();
                        setDraggingId(elem.id);
                        setDragOffset({
                          x: (e.clientX - rect.left) / computedScale - elem.x,
                          y: (e.clientY - rect.top) / computedScale - elem.y
                        });
                      }
                    }}
                    className={`w-full h-full relative overflow-hidden bg-slate-100 ${
                      isSelected ? 'cursor-move' : 'cursor-pointer'
                    }`}
                  >
                    <img
                      src={elem.previewUrl || elem.imagePath}
                      alt={elem.fileName || 'Document Image'}
                      className="w-full h-full object-contain pointer-events-none select-none"
                    />
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* TEXT ELEMENT: INLINE EDITABLE / STYLED TEXT */}
                {/* ------------------------------------------------------------- */}
                {isText && (
                  <div className="w-full h-full relative">
                    {isEditing ? (
                      <textarea
                        autoFocus
                        value={elem.text || ''}
                        onChange={(e) => handleUpdate(elem.id, { text: e.target.value })}
                        onBlur={() => setEditingTextId(null)}
                        style={{
                          fontSize: `${elem.fontSize || 14}px`,
                          fontWeight: elem.fontWeight || 'normal',
                          fontStyle: elem.fontStyle || 'normal',
                          textAlign: elem.textAlign || 'left',
                          color: elem.color || '#1e293b',
                          lineHeight: elem.lineHeight || 1.3
                        }}
                        className="w-full h-full bg-transparent border-none outline-none resize-none p-1 font-sans"
                        placeholder="Type text here..."
                      />
                    ) : (
                      <div
                        style={{
                          fontSize: `${elem.fontSize || 14}px`,
                          fontWeight: elem.fontWeight || 'normal',
                          fontStyle: elem.fontStyle || 'normal',
                          textAlign: elem.textAlign || 'left',
                          color: elem.color || '#1e293b',
                          lineHeight: elem.lineHeight || 1.3
                        }}
                        className="w-full h-full p-1 whitespace-pre-wrap break-words font-sans cursor-text leading-tight"
                      >
                        {elem.text || (
                          <span className="text-slate-400 italic">Double-click to type text...</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* WORD-LIKE 8-WAY RESIZE HANDLES (When Selected) */}
                {/* ------------------------------------------------------------- */}
                {isSelected && (
                  <>
                    {/* Top-Left Handle */}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setResizingInfo({
                          id: elem.id,
                          handle: 'nw',
                          startX: e.clientX,
                          startY: e.clientY,
                          startWidth: elem.width,
                          startHeight: elem.height,
                          aspectRatio: isImage ? (elem.width / elem.height) : null
                        });
                      }}
                      className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-sm cursor-nwse-resize z-50 shadow-sm"
                    />

                    {/* Top-Right Handle */}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setResizingInfo({
                          id: elem.id,
                          handle: 'ne',
                          startX: e.clientX,
                          startY: e.clientY,
                          startWidth: elem.width,
                          startHeight: elem.height,
                          aspectRatio: isImage ? (elem.width / elem.height) : null
                        });
                      }}
                      className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-sm cursor-nesw-resize z-50 shadow-sm"
                    />

                    {/* Bottom-Left Handle */}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setResizingInfo({
                          id: elem.id,
                          handle: 'sw',
                          startX: e.clientX,
                          startY: e.clientY,
                          startWidth: elem.width,
                          startHeight: elem.height,
                          aspectRatio: isImage ? (elem.width / elem.height) : null
                        });
                      }}
                      className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-sm cursor-nesw-resize z-50 shadow-sm"
                    />

                    {/* Bottom-Right Handle */}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setResizingInfo({
                          id: elem.id,
                          handle: 'se',
                          startX: e.clientX,
                          startY: e.clientY,
                          startWidth: elem.width,
                          startHeight: elem.height,
                          aspectRatio: isImage ? (elem.width / elem.height) : null
                        });
                      }}
                      className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-sm cursor-nwse-resize z-50 shadow-sm"
                    />

                    {/* Middle-Right Handle */}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setResizingInfo({
                          id: elem.id,
                          handle: 'e',
                          startX: e.clientX,
                          startY: e.clientY,
                          startWidth: elem.width,
                          startHeight: elem.height,
                          aspectRatio: null
                        });
                      }}
                      className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2.5 h-3.5 bg-white border-2 border-blue-600 rounded-sm cursor-ew-resize z-50 shadow-sm"
                    />

                    {/* Middle-Bottom Handle */}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setResizingInfo({
                          id: elem.id,
                          handle: 's',
                          startX: e.clientX,
                          startY: e.clientY,
                          startWidth: elem.width,
                          startHeight: elem.height,
                          aspectRatio: null
                        });
                      }}
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-2.5 bg-white border-2 border-blue-600 rounded-sm cursor-ns-resize z-50 shadow-sm"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
};
