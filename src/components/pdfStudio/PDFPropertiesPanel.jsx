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
    <aside className="w-80 glass-panel rounded-xl p-4 border border-gray-800/80 bg-gray-900/60 flex flex-col shrink-0 overflow-hidden select-none space-y-4">
      {/* Panel Tab Navigation */}
      <div className="flex items-center gap-1 bg-gray-950/70 p-1 rounded-lg border border-gray-800/60 text-xs shrink-0">
        <button
          onClick={() => setActiveTab('page')}
          className={`flex-1 py-1.5 font-medium rounded transition-all cursor-pointer ${
            activeTab === 'page'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Page Setup
        </button>

        <button
          onClick={() => setActiveTab('tools')}
          className={`flex-1 py-1.5 font-medium rounded transition-all cursor-pointer ${
            activeTab === 'tools'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Properties
        </button>

        <button
          onClick={() => setActiveTab('export')}
          className={`flex-1 py-1.5 font-medium rounded transition-all cursor-pointer ${
            activeTab === 'export'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'text-gray-400 hover:text-gray-200'
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
            <div className="p-3.5 rounded-xl bg-gray-950/60 border border-gray-800/60 space-y-2">
              <div className="flex items-center gap-1.5 text-gray-300 font-semibold">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                <span>Active Page Info</span>
              </div>
              <div className="space-y-1.5 text-gray-400 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span>Current Page:</span>
                  <span className="text-gray-200 font-bold">#{activePageIndex + 1} of {pageCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Dimensions:</span>
                  <span className="text-gray-200">{pageSize} ({orientation})</span>
                </div>
                <div className="flex justify-between">
                  <span>Rotation:</span>
                  <span className="text-gray-200">{activePageRotation}°</span>
                </div>
                <div className="flex justify-between">
                  <span>Elements on Page:</span>
                  <span className="text-gray-200">{activePage?.elements?.length || 0}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-gray-300 font-medium mb-1.5">Page Size</label>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(e.target.value)}
                className="w-full p-2 rounded-lg glass-input text-gray-200 text-xs"
              >
                <option value="A4">A4 (210 × 297 mm)</option>
                <option value="Letter">US Letter (8.5 × 11 in)</option>
                <option value="Legal">US Legal (8.5 × 14 in)</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-300 font-medium mb-1.5">Orientation</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onOrientationChange('portrait')}
                  className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                    orientation === 'portrait'
                      ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 font-semibold'
                      : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  Portrait
                </button>

                <button
                  onClick={() => onOrientationChange('landscape')}
                  className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                    orientation === 'landscape'
                      ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 font-semibold'
                      : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  Landscape
                </button>
              </div>
            </div>

            <div>
              <label className="block text-gray-300 font-medium mb-1.5">Page Rotation</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onRotateLeft}
                  className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-gray-950/40 border border-gray-800 text-gray-300 hover:text-white hover:border-gray-700 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Rotate -90°</span>
                </button>

                <button
                  onClick={onRotateRight}
                  className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-gray-950/40 border border-gray-800 text-gray-300 hover:text-white hover:border-gray-700 transition-all cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Rotate +90°</span>
                </button>
              </div>
            </div>

            {/* Multiple Images Layouts */}
            {pageImages.length > 1 && (
              <div className="p-3 rounded-xl bg-gray-950/70 border border-gray-800/80 space-y-2.5">
                <div className="flex items-center gap-1.5 font-semibold text-gray-200">
                  <LayoutGrid className="w-3.5 h-3.5 text-blue-400" />
                  <span>Multi-Image Auto-Layout</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    onClick={() => onApplyPageLayout && onApplyPageLayout('grid2x2')}
                    className="p-1.5 rounded-lg bg-gray-900 border border-gray-800 hover:border-blue-500/40 text-gray-300 hover:text-white text-left transition-all text-[11px]"
                  >
                    Arrange in 2 × 2 Grid
                  </button>
                  <button
                    onClick={() => onApplyPageLayout && onApplyPageLayout('equal_spacing_v')}
                    className="p-1.5 rounded-lg bg-gray-900 border border-gray-800 hover:border-blue-500/40 text-gray-300 hover:text-white text-left transition-all text-[11px]"
                  >
                    Distribute Equal Vertical Spacing
                  </button>
                  <button
                    onClick={() => onApplyPageLayout && onApplyPageLayout('equal_spacing_h')}
                    className="p-1.5 rounded-lg bg-gray-900 border border-gray-800 hover:border-blue-500/40 text-gray-300 hover:text-white text-left transition-all text-[11px]"
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
                      className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 cursor-pointer"
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
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
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
                      <label className="block text-[10px] text-gray-500 mb-0.5 font-mono">WIDTH</label>
                      <input
                        type="number"
                        min="20"
                        max="800"
                        value={Math.round(selectedElementObj.width || 300)}
                        onChange={(e) => handleWidthChange(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded p-1.5 text-xs text-gray-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5 font-mono">HEIGHT</label>
                      <input
                        type="number"
                        min="20"
                        max="1000"
                        value={Math.round(selectedElementObj.height || 200)}
                        onChange={(e) => handleHeightChange(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded p-1.5 text-xs text-gray-200 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Position: X & Y */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] text-gray-400 font-mono">POSITION (X, Y)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5 font-mono">X</label>
                      <input
                        type="number"
                        min="0"
                        max="800"
                        value={Math.round(selectedElementObj.x || 0)}
                        onChange={(e) => onUpdateElement(selectedElementObj.id, { x: parseInt(e.target.value) || 0 })}
                        className="w-full bg-gray-950 border border-gray-800 rounded p-1.5 text-xs text-gray-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5 font-mono">Y</label>
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        value={Math.round(selectedElementObj.y || 0)}
                        onChange={(e) => onUpdateElement(selectedElementObj.id, { y: parseInt(e.target.value) || 0 })}
                        className="w-full bg-gray-950 border border-gray-800 rounded p-1.5 text-xs text-gray-200 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Align Actions */}
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Align on Page</label>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => onAlignElement(selectedElementObj.id, 'left')}
                      className="p-1 rounded bg-gray-950 border border-gray-800 text-[10px] text-gray-300 hover:text-white"
                    >
                      Left
                    </button>
                    <button
                      onClick={() => onAlignElement(selectedElementObj.id, 'center')}
                      className="p-1 rounded bg-gray-950 border border-gray-800 text-[10px] text-gray-300 hover:text-white"
                    >
                      Center
                    </button>
                    <button
                      onClick={() => onAlignElement(selectedElementObj.id, 'right')}
                      className="p-1 rounded bg-gray-950 border border-gray-800 text-[10px] text-gray-300 hover:text-white"
                    >
                      Right
                    </button>
                    <button
                      onClick={() => onAlignElement(selectedElementObj.id, 'top')}
                      className="p-1 rounded bg-gray-950 border border-gray-800 text-[10px] text-gray-300 hover:text-white"
                    >
                      Top
                    </button>
                    <button
                      onClick={() => onAlignElement(selectedElementObj.id, 'middle')}
                      className="p-1 rounded bg-gray-950 border border-gray-800 text-[10px] text-gray-300 hover:text-white"
                    >
                      Middle
                    </button>
                    <button
                      onClick={() => onAlignElement(selectedElementObj.id, 'bottom')}
                      className="p-1 rounded bg-gray-950 border border-gray-800 text-[10px] text-gray-300 hover:text-white"
                    >
                      Bottom
                    </button>
                  </div>
                  <button
                    onClick={() => onAlignElement(selectedElementObj.id, 'fit-page')}
                    className="w-full mt-1.5 p-1 rounded bg-gray-950 border border-gray-800 text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center justify-center gap-1"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Fit to A4 Page Margins</span>
                  </button>
                </div>

                {/* Subtitle & Description Feature */}
                <div className="pt-2 border-t border-emerald-500/20">
                  <button
                    onClick={() => onAddSubtitleBelowImage(selectedElementObj)}
                    className="w-full flex items-center justify-center gap-1.5 p-2 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Subtitle & Text Below</span>
                  </button>
                </div>
              </div>
            ) : isTextSelected ? (
              /* CONTEXTUAL TEXT PROPERTIES */
              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-3">
                <div className="flex items-center justify-between font-semibold text-blue-300">
                  <span className="flex items-center gap-1.5">
                    <Type className="w-4 h-4 text-blue-400" />
                    <span>Text Box Properties</span>
                  </span>
                  <button
                    onClick={() => onDeleteText(selectedTextObj.id)}
                    className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-500/10 cursor-pointer"
                    title="Delete Text Box"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Font Size & Alignment */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-gray-400 text-[11px] mb-1">Font Size</label>
                    <select
                      value={selectedTextObj.fontSize || 16}
                      onChange={(e) => onUpdateText(selectedTextObj.id, { fontSize: parseInt(e.target.value) })}
                      className="w-full bg-gray-950 border border-gray-800 rounded p-1.5 text-xs text-gray-200"
                    >
                      {fontSizes.map(s => <option key={s} value={s}>{s}px</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-400 text-[11px] mb-1">Alignment</label>
                    <div className="flex items-center gap-0.5 bg-gray-950 p-1 rounded border border-gray-800">
                      {['left', 'center', 'right'].map(align => (
                        <button
                          key={align}
                          onClick={() => onUpdateText(selectedTextObj.id, { align })}
                          className={`flex-1 py-1 rounded capitalize text-[10px] cursor-pointer ${
                            (selectedTextObj.align || 'left') === align ? 'bg-blue-600 text-white' : 'text-gray-400'
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
                  <label className="block text-gray-400 text-[11px] mb-1">Typography Style</label>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onUpdateText(selectedTextObj.id, { isBold: !selectedTextObj.isBold })}
                      className={`flex-1 py-1.5 rounded border text-center font-bold text-xs cursor-pointer ${
                        selectedTextObj.isBold ? 'bg-blue-600 text-white border-blue-500' : 'bg-gray-950 text-gray-400 border-gray-800'
                      }`}
                    >
                      B
                    </button>
                    <button
                      onClick={() => onUpdateText(selectedTextObj.id, { isItalic: !selectedTextObj.isItalic })}
                      className={`flex-1 py-1.5 rounded border text-center italic text-xs cursor-pointer ${
                        selectedTextObj.isItalic ? 'bg-blue-600 text-white border-blue-500' : 'bg-gray-950 text-gray-400 border-gray-800'
                      }`}
                    >
                      I
                    </button>
                    <button
                      onClick={() => onUpdateText(selectedTextObj.id, { isUnderline: !selectedTextObj.isUnderline })}
                      className={`flex-1 py-1.5 rounded border text-center underline text-xs cursor-pointer ${
                        selectedTextObj.isUnderline ? 'bg-blue-600 text-white border-blue-500' : 'bg-gray-950 text-gray-400 border-gray-800'
                      }`}
                    >
                      U
                    </button>
                  </div>
                </div>

                {/* Text Color Swatches */}
                <div>
                  <label className="block text-gray-400 text-[11px] mb-1">Text Color</label>
                  <div className="flex items-center gap-1.5">
                    {colorPresets.map(c => (
                      <button
                        key={c.hex}
                        onClick={() => onUpdateText(selectedTextObj.id, { color: c.hex })}
                        style={{ backgroundColor: c.hex }}
                        className={`w-5 h-5 rounded-full border cursor-pointer transition-transform ${
                          selectedTextObj.color === c.hex ? 'ring-2 ring-blue-500 scale-110 border-white' : 'border-gray-700'
                        }`}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h4 className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">
                  Quick Actions
                </h4>
                <div className="space-y-2">
                  <button 
                    onClick={onAddText}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-blue-600/15 border border-blue-500/30 hover:bg-blue-600/25 text-blue-300 font-semibold transition-all cursor-pointer shadow-sm"
                  >
                    <Type className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>+ Add Text Box to Page</span>
                  </button>
                </div>
              </div>
            )}

            {/* Document Conversions Shortcut */}
            <div className="space-y-2 pt-2 border-t border-gray-800/80">
              <h4 className="text-xs font-semibold text-gray-300 mb-1 uppercase tracking-wider">
                Document Conversions
              </h4>
              <button 
                onClick={onOpenConvert}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 hover:border-blue-500/50 text-blue-300 hover:text-white transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold">Open Convert Studio</span>
                </div>
                <span className="text-[10px] bg-blue-500/20 px-1.5 py-0.5 rounded font-mono text-blue-300">4 Tools</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: EXPORT & MEMORA INGESTION */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            <div>
              <label className="block text-gray-300 font-medium mb-1.5">Export File Name</label>
              <input
                type="text"
                value={exportFileName}
                onChange={(e) => onExportFileNameChange(e.target.value)}
                className="w-full p-2 rounded-lg glass-input text-gray-200 text-xs font-mono"
              />
            </div>

            <div 
              onClick={onToggleIndexWithMemora}
              className="flex items-center justify-between p-3 rounded-xl bg-gray-950/60 border border-gray-800/60 cursor-pointer hover:border-gray-700/60 transition-all"
            >
              <div className="space-y-0.5 pr-2">
                <div className="flex items-center gap-1.5 font-semibold text-gray-200">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Index with Memora</span>
                </div>
                <p className="text-[10px] text-gray-400 leading-tight">
                  Automatically chunk and vector index exported PDF for Module 1 search.
                </p>
              </div>
              <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                indexWithMemora ? 'bg-blue-600 border-blue-500 text-white' : 'border-gray-700 bg-gray-900'
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
