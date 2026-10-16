import React, { useState } from 'react';
import { 
  Type, 
  Image as ImageIcon,
  Download, 
  Sparkles, 
  Info, 
  Check, 
  RotateCw, 
  RotateCcw, 
  ArrowRightLeft,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Trash2,
  Copy,
  LayoutGrid,
  Move,
  Maximize2,
  Lock,
  Unlock,
  Plus
} from 'lucide-react';
import { Button } from '../common/Button';

export const PDFPropertiesPanel = ({
  documentTitle = 'Untitled Document',
  onTitleChange,
  pageCount = 1,
  activePageIndex = 0,
  activePage = null,
  activePageRotation = 0,
  pageSize = 'A4',
  onPageSizeChange,
  orientation = 'portrait',
  onOrientationChange,
  onRotateLeft,
  onRotateRight,
  selectedElementObj = null,
  selectedTextObj = null,
  onAddText,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  onAlignElement,
  onAddSubtitleBelowImage,
  onApplyPageLayout,
  onUpdateText,
  onDeleteText,
  exportFileName = 'document_export.pdf',
  onExportFileNameChange,
  indexWithMemora = true,
  onToggleIndexWithMemora,
  onOpenConvert,
  onExport,
  isExporting = false
}) => {
  const [activeTab, setActiveTab] = useState('page'); // 'page' | 'tools' | 'export'
  const [lockAspect, setLockAspect] = useState(true);

  const fontSizes = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48];
  const colorPresets = [
    { name: 'Dark Slate', hex: '#1e293b' },
    { name: 'White', hex: '#ffffff' },
    { name: 'Royal Blue', hex: '#2563eb' },
    { name: 'Crimson Red', hex: '#dc2626' },
    { name: 'Emerald', hex: '#059669' },
    { name: 'Amber', hex: '#d97706' },
    { name: 'Purple', hex: '#9333ea' }
  ];

  const isImageSelected = selectedElementObj && selectedElementObj.type === 'image';
  const isTextSelected = !!selectedTextObj;
  const pageImages = (activePage?.elements || []).filter(el => el.type === 'image');

  const handleWidthChange = (val) => {
    const num = Math.max(20, Math.min(800, parseInt(val) || 20));
    if (!selectedElementObj) return;
    const updates = { width: num };
    if (lockAspect && selectedElementObj.aspectRatio) {
      updates.height = Math.round(num / selectedElementObj.aspectRatio);
    }
    onUpdateElement(selectedElementObj.id, updates);
  };

  const handleHeightChange = (val) => {
    const num = Math.max(20, Math.min(1000, parseInt(val) || 20));
    if (!selectedElementObj) return;
    const updates = { height: num };
    if (lockAspect && selectedElementObj.aspectRatio) {
      updates.width = Math.round(num * selectedElementObj.aspectRatio);
    }
    onUpdateElement(selectedElementObj.id, updates);
  };

  return (
    <aside className="w-80 rounded-2xl p-4 border border-[rgba(139,170,215,0.14)] bg-[#0A1629]/90 backdrop-blur-md flex flex-col shrink-0 overflow-hidden select-none space-y-4">
      {/* Panel Tab Navigation */}
      <div className="flex items-center gap-1 bg-[#06101F]/70 p-1 rounded-xl border border-[rgba(139,170,215,0.12)] text-xs shrink-0">
        <button
          onClick={() => setActiveTab('page')}
          className={`flex-1 py-1.5 font-medium rounded-lg transition-all cursor-pointer ${
            activeTab === 'page'
              ? 'bg-[#3478F6]/20 text-[#4B91FF] border border-[#3478F6]/40 font-semibold'
              : 'text-[#A7B7D0] hover:text-[#F4F7FF]'
          }`}
        >
          Page Setup
        </button>

        <button
          onClick={() => setActiveTab('tools')}
          className={`flex-1 py-1.5 font-medium rounded-lg transition-all cursor-pointer ${
            activeTab === 'tools'
              ? 'bg-[#3478F6]/20 text-[#4B91FF] border border-[#3478F6]/40 font-semibold'
              : 'text-[#A7B7D0] hover:text-[#F4F7FF]'
          }`}
        >
          Properties
        </button>

        <button
          onClick={() => setActiveTab('export')}
          className={`flex-1 py-1.5 font-medium rounded-lg transition-all cursor-pointer ${
            activeTab === 'export'
              ? 'bg-[#3478F6]/20 text-[#4B91FF] border border-[#3478F6]/40 font-semibold'
              : 'text-[#A7B7D0] hover:text-[#F4F7FF]'
          }`}
        >
          Export
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar text-xs">
        {/* TAB 1: PAGE SETUP & INFORMATION */}
        {activeTab === 'page' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-[#06101F]/80 border border-[rgba(139,170,215,0.12)] space-y-2">
              <div className="flex items-center gap-1.5 text-[#F4F7FF] font-semibold">
                <Info className="w-3.5 h-3.5 text-[#4B91FF]" />
                <span>Active Page Info</span>
              </div>
              <div className="space-y-1.5 text-[#A7B7D0] font-mono text-[11px]">
                <div className="flex justify-between">
                  <span>Current Page:</span>
                  <span className="text-[#F4F7FF] font-bold">#{activePageIndex + 1} of {pageCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Dimensions:</span>
                  <span className="text-[#F4F7FF]">{pageSize} ({orientation})</span>
                </div>
                <div className="flex justify-between">
                  <span>Rotation:</span>
                  <span className="text-[#F4F7FF]">{activePageRotation}°</span>
                </div>
                <div className="flex justify-between">
                  <span>Elements on Page:</span>
                  <span className="text-[#F4F7FF]">{activePage?.elements?.length || 0}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[#A7B7D0] font-medium mb-1.5">Page Size</label>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-[#06101F] border border-[rgba(139,170,215,0.18)] text-[#F4F7FF] text-xs focus:outline-none focus:border-[#3478F6]"
              >
                <option value="A4">A4 (210 × 297 mm)</option>
                <option value="Letter">US Letter (8.5 × 11 in)</option>
                <option value="Legal">US Legal (8.5 × 14 in)</option>
              </select>
            </div>

            <div>
              <label className="block text-[#A7B7D0] font-medium mb-1.5">Orientation</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onOrientationChange('portrait')}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    orientation === 'portrait'
                      ? 'bg-[#3478F6]/20 border-[#3478F6] text-[#4B91FF] font-semibold'
                      : 'bg-[#06101F]/60 border-[rgba(139,170,215,0.12)] text-[#A7B7D0] hover:text-[#F4F7FF]'
                  }`}
                >
                  Portrait
                </button>

                <button
                  onClick={() => onOrientationChange('landscape')}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    orientation === 'landscape'
                      ? 'bg-[#3478F6]/20 border-[#3478F6] text-[#4B91FF] font-semibold'
                      : 'bg-[#06101F]/60 border-[rgba(139,170,215,0.12)] text-[#A7B7D0] hover:text-[#F4F7FF]'
                  }`}
                >
                  Landscape
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[#A7B7D0] font-medium mb-1.5">Page Rotation</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onRotateLeft}
                  className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-[#06101F]/60 border border-[rgba(139,170,215,0.14)] text-[#A7B7D0] hover:text-[#F4F7FF] hover:border-[#3478F6]/50 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Rotate -90°</span>
                </button>

                <button
                  onClick={onRotateRight}
                  className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-[#06101F]/60 border border-[rgba(139,170,215,0.14)] text-[#A7B7D0] hover:text-[#F4F7FF] hover:border-[#3478F6]/50 transition-all cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Rotate +90°</span>
                </button>
              </div>
            </div>

            {/* Multiple Images Layouts */}
            {pageImages.length > 1 && (
              <div className="p-3.5 rounded-xl bg-[#06101F]/80 border border-[rgba(139,170,215,0.12)] space-y-2.5">
                <div className="flex items-center gap-1.5 font-semibold text-[#F4F7FF]">
                  <LayoutGrid className="w-3.5 h-3.5 text-[#4B91FF]" />
                  <span>Multi-Image Auto-Layout</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    onClick={() => onApplyPageLayout && onApplyPageLayout('grid2x2')}
                    className="p-2 rounded-lg bg-[#0E1D35] border border-[rgba(139,170,215,0.12)] hover:border-[#3478F6]/50 text-[#A7B7D0] hover:text-[#F4F7FF] text-left transition-all text-[11px]"
                  >
                    Arrange in 2 × 2 Grid
                  </button>
                  <button
                    onClick={() => onApplyPageLayout && onApplyPageLayout('equal_spacing_v')}
                    className="p-2 rounded-lg bg-[#0E1D35] border border-[rgba(139,170,215,0.12)] hover:border-[#3478F6]/50 text-[#A7B7D0] hover:text-[#F4F7FF] text-left transition-all text-[11px]"
                  >
                    Distribute Equal Vertical Spacing
                  </button>
                  <button
                    onClick={() => onApplyPageLayout && onApplyPageLayout('equal_spacing_h')}
                    className="p-2 rounded-lg bg-[#0E1D35] border border-[rgba(139,170,215,0.12)] hover:border-[#3478F6]/50 text-[#A7B7D0] hover:text-[#F4F7FF] text-left transition-all text-[11px]"
                  >
                    Distribute Equal Horizontal Spacing
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TOOLS & CONTEXTUAL ELEMENT PROPERTIES */}
        {activeTab === 'tools' && (
          <div className="space-y-4">
            {/* CONTEXTUAL IMAGE PROPERTIES */}
            {isImageSelected ? (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between font-semibold text-emerald-300">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                    <span>Image Properties</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onDuplicateElement(selectedElementObj.id)}
                      className="p-1 text-[#A7B7D0] hover:text-[#F4F7FF] rounded hover:bg-[#0E1D35] cursor-pointer"
                      title="Duplicate Image"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteElement(selectedElementObj.id)}
                      className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-500/10 cursor-pointer"
                      title="Delete Image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Dimensions: Width & Height */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-[#A7B7D0]">
                    <span>Dimensions (Points)</span>
                    <button 
                      onClick={() => setLockAspect(v => !v)}
                      className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300"
                    >
                      {lockAspect ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      <span>{lockAspect ? 'Locked Ratio' : 'Free Resize'}</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-[#71839E] mb-0.5 font-mono">WIDTH</label>
                      <input
                        type="number"
                        min="20"
                        max="800"
                        value={Math.round(selectedElementObj.width || 300)}
                        onChange={(e) => handleWidthChange(e.target.value)}
                        className="w-full bg-[#06101F] border border-[rgba(139,170,215,0.18)] rounded-lg p-1.5 text-xs text-[#F4F7FF] font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#71839E] mb-0.5 font-mono">HEIGHT</label>
                      <input
                        type="number"
                        min="20"
                        max="1000"
                        value={Math.round(selectedElementObj.height || 200)}
                        onChange={(e) => handleHeightChange(e.target.value)}
                        className="w-full bg-[#06101F] border border-[rgba(139,170,215,0.18)] rounded-lg p-1.5 text-xs text-[#F4F7FF] font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Position: X & Y */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] text-[#A7B7D0] font-mono">POSITION (X, Y)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-[#71839E] mb-0.5 font-mono">X</label>
                      <input
                        type="number"
                        min="0"
                        max="800"
                        value={Math.round(selectedElementObj.x || 0)}
                        onChange={(e) => onUpdateElement(selectedElementObj.id, { x: parseInt(e.target.value) || 0 })}
                        className="w-full bg-[#06101F] border border-[rgba(139,170,215,0.18)] rounded-lg p-1.5 text-xs text-[#F4F7FF] font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#71839E] mb-0.5 font-mono">Y</label>
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        value={Math.round(selectedElementObj.y || 0)}
                        onChange={(e) => onUpdateElement(selectedElementObj.id, { y: parseInt(e.target.value) || 0 })}
                        className="w-full bg-[#06101F] border border-[rgba(139,170,215,0.18)] rounded-lg p-1.5 text-xs text-[#F4F7FF] font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : isTextSelected ? (
              /* CONTEXTUAL TEXT PROPERTIES */
              (() => {
                const isBold = Boolean(selectedTextObj.isBold || selectedTextObj.fontWeight === 'bold');
                const isItalic = Boolean(selectedTextObj.isItalic || selectedTextObj.fontStyle === 'italic');
                const isUnderline = Boolean(selectedTextObj.isUnderline || selectedTextObj.textDecoration === 'underline');
                const currentAlign = (selectedTextObj.align || selectedTextObj.textAlign || 'left').toLowerCase();
                const currentSize = parseInt(selectedTextObj.fontSize || selectedTextObj.font_size || 16, 10) || 16;
                const currentColor = (selectedTextObj.color || '#1e293b').toLowerCase();

                return (
                  <div className="p-3.5 rounded-xl bg-[#3478F6]/10 border border-[#3478F6]/30 space-y-3">
                    <div className="flex items-center justify-between font-semibold text-[#4B91FF]">
                      <span className="flex items-center gap-1.5">
                        <Type className="w-4 h-4 text-[#4B91FF]" />
                        <span>Text Properties</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => onDeleteText(selectedTextObj.id)}
                          className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-500/10 cursor-pointer"
                          title="Delete Text Box"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Font Size & Alignment */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[#A7B7D0] text-[11px] mb-1">Font Size</label>
                        <select
                          value={currentSize}
                          onMouseDown={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const sz = parseInt(e.target.value, 10) || 16;
                            onUpdateText(selectedTextObj.id, { fontSize: sz, font_size: sz });
                          }}
                          className="w-full bg-[#06101F] border border-[rgba(139,170,215,0.18)] rounded-lg p-1.5 text-xs text-[#F4F7FF]"
                        >
                          {fontSizes.map(sz => (
                            <option key={sz} value={sz}>{sz} pt</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[#A7B7D0] text-[11px] mb-1">Align</label>
                        <div className="flex items-center gap-0.5 bg-[#06101F] p-1 rounded-lg border border-[rgba(139,170,215,0.18)]">
                          {['left', 'center', 'right'].map(align => (
                            <button
                              key={align}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => onUpdateText(selectedTextObj.id, { align, textAlign: align })}
                              className={`flex-1 py-1 rounded capitalize text-[10px] cursor-pointer ${
                                currentAlign === align ? 'bg-[#3478F6] text-white' : 'text-[#71839E]'
                              }`}
                            >
                              {align[0].toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Styling Toggles */}
                    <div>
                      <label className="block text-[#A7B7D0] text-[11px] mb-1">Typography Style</label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => onUpdateText(selectedTextObj.id, { 
                            isBold: !isBold, 
                            fontWeight: !isBold ? 'bold' : 'normal' 
                          })}
                          className={`flex-1 py-1.5 rounded-lg border text-center font-bold text-xs cursor-pointer ${
                            isBold ? 'bg-[#3478F6] text-white border-[#3478F6]' : 'bg-[#06101F] text-[#A7B7D0] border-[rgba(139,170,215,0.18)]'
                          }`}
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => onUpdateText(selectedTextObj.id, { 
                            isItalic: !isItalic, 
                            fontStyle: !isItalic ? 'italic' : 'normal' 
                          })}
                          className={`flex-1 py-1.5 rounded-lg border text-center italic text-xs cursor-pointer ${
                            isItalic ? 'bg-[#3478F6] text-white border-[#3478F6]' : 'bg-[#06101F] text-[#A7B7D0] border-[rgba(139,170,215,0.18)]'
                          }`}
                        >
                          I
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => onUpdateText(selectedTextObj.id, { 
                            isUnderline: !isUnderline, 
                            textDecoration: !isUnderline ? 'underline' : 'none' 
                          })}
                          className={`flex-1 py-1.5 rounded-lg border text-center underline text-xs cursor-pointer ${
                            isUnderline ? 'bg-[#3478F6] text-white border-[#3478F6]' : 'bg-[#06101F] text-[#A7B7D0] border-[rgba(139,170,215,0.18)]'
                          }`}
                        >
                          U
                        </button>
                      </div>
                    </div>

                    {/* Text Color Swatches */}
                    <div>
                      <label className="block text-[#A7B7D0] text-[11px] mb-1">Text Color</label>
                      <div className="flex items-center gap-1.5">
                        {colorPresets.map(c => (
                          <button
                            key={c.hex}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => onUpdateText(selectedTextObj.id, { color: c.hex })}
                            style={{ backgroundColor: c.hex }}
                            className={`w-5 h-5 rounded-full border cursor-pointer transition-transform ${
                              currentColor === c.hex.toLowerCase() ? 'ring-2 ring-[#4B91FF] scale-110 border-white' : 'border-gray-700'
                            }`}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div>
                <h4 className="text-xs font-semibold text-[#A7B7D0] mb-2 uppercase tracking-wider">
                  Quick Actions
                </h4>
                <div className="space-y-2">
                  <button 
                    onClick={onAddText}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-[#3478F6]/15 border border-[#3478F6]/30 hover:bg-[#3478F6]/25 text-[#4B91FF] font-semibold transition-all cursor-pointer shadow-sm"
                  >
                    <Type className="w-4 h-4 text-[#4B91FF] shrink-0" />
                    <span>+ Add Text Box to Page</span>
                  </button>
                </div>
              </div>
            )}

            {/* Document Conversions Shortcut */}
            <div className="space-y-2 pt-2 border-t border-[rgba(139,170,215,0.12)]">
              <h4 className="text-xs font-semibold text-[#A7B7D0] mb-1 uppercase tracking-wider">
                Document Conversions
              </h4>
              <button 
                onClick={onOpenConvert}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-[#3478F6]/20 to-[#7566F6]/20 border border-[#3478F6]/30 hover:border-[#3478F6]/60 text-[#4B91FF] hover:text-[#F4F7FF] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-[#4B91FF]" />
                  <span className="font-semibold">Open Convert Studio</span>
                </div>
                <span className="text-[10px] bg-[#3478F6]/20 px-1.5 py-0.5 rounded font-mono text-[#4B91FF]">4 Tools</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: EXPORT & MEMORA INGESTION */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            <div>
              <label className="block text-[#A7B7D0] font-medium mb-1.5">Export File Name</label>
              <input
                type="text"
                value={exportFileName}
                onChange={(e) => onExportFileNameChange(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-[#06101F] border border-[rgba(139,170,215,0.18)] text-[#F4F7FF] text-xs font-mono focus:outline-none focus:border-[#3478F6]"
              />
            </div>

            <div 
              onClick={onToggleIndexWithMemora}
              className="flex items-center justify-between p-3 rounded-xl bg-[#06101F]/80 border border-[rgba(139,170,215,0.14)] cursor-pointer hover:border-[#3478F6]/50 transition-all"
            >
              <div className="space-y-0.5 pr-2">
                <div className="flex items-center gap-1.5 font-semibold text-[#F4F7FF]">
                  <Sparkles className="w-3.5 h-3.5 text-[#4B91FF]" />
                  <span>Index with Memora</span>
                </div>
                <p className="text-[10px] text-[#A7B7D0] leading-tight">
                  Automatically make the exported PDF searchable in Memora.
                </p>
              </div>
              <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                indexWithMemora ? 'bg-[#3478F6] border-[#3478F6] text-white' : 'border-[rgba(139,170,215,0.2)] bg-[#0E1D35]'
              }`}>
                {indexWithMemora && <Check className="w-3.5 h-3.5" />}
              </div>
            </div>

            <Button
              variant="primary"
              size="md"
              icon={Download}
              onClick={onExport}
              disabled={isExporting}
              className="w-full mt-2"
            >
              Export PDF Document
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
};
