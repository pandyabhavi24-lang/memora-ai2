import React from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Trash2, 
  Palette,
  Type
} from 'lucide-react';

export const PDFTextFormattingBar = ({
  selectedText,
  onUpdateText,
  onDeleteText
}) => {
  if (!selectedText) return null;

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

  // Normalized formatting state resolution
  const isBold = Boolean(selectedText.isBold || selectedText.fontWeight === 'bold');
  const isItalic = Boolean(selectedText.isItalic || selectedText.fontStyle === 'italic');
  const isUnderline = Boolean(selectedText.isUnderline || selectedText.textDecoration === 'underline');
  const currentAlign = (selectedText.align || selectedText.textAlign || 'left').toLowerCase();
  const currentSize = parseInt(selectedText.fontSize || selectedText.font_size || 16, 10) || 16;
  const currentColor = (selectedText.color || '#1e293b').toLowerCase();

  return (
    <div 
      onMouseDown={(e) => e.preventDefault()}
      className="flex flex-wrap items-center gap-2 p-2 rounded-xl glass-panel border border-blue-500/40 bg-gray-950/95 shadow-2xl backdrop-blur-md select-none text-xs text-gray-200 animate-fadeIn"
    >
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-400 font-semibold font-mono text-[11px]">
        <Type className="w-3.5 h-3.5" />
        <span>Text Formatting</span>
      </div>

      <div className="w-px h-4 bg-gray-800 my-auto" />

      {/* Font Size Selector */}
      <div className="flex items-center gap-1">
        <label className="text-[10px] text-gray-400">Size:</label>
        <select
          value={currentSize}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            const sz = parseInt(e.target.value, 10) || 16;
            onUpdateText({ fontSize: sz, font_size: sz });
          }}
          className="bg-gray-900 border border-gray-800 rounded px-1.5 py-1 text-xs font-mono text-gray-200"
        >
          {fontSizes.map(size => (
            <option key={size} value={size}>{size}px</option>
          ))}
        </select>
      </div>

      <div className="w-px h-4 bg-gray-800 my-auto" />

      {/* Style Toggles: Bold, Italic, Underline */}
      <div className="flex items-center gap-0.5 bg-gray-900 p-0.5 rounded border border-gray-800">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onUpdateText({ 
            isBold: !isBold, 
            fontWeight: !isBold ? 'bold' : 'normal' 
          })}
          className={`p-1 rounded cursor-pointer transition-colors ${
            isBold ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
          title="Bold"
          aria-label="Toggle Bold Text"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onUpdateText({ 
            isItalic: !isItalic, 
            fontStyle: !isItalic ? 'italic' : 'normal' 
          })}
          className={`p-1 rounded cursor-pointer transition-colors ${
            isItalic ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
          title="Italic"
          aria-label="Toggle Italic Text"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onUpdateText({ 
            isUnderline: !isUnderline, 
            textDecoration: !isUnderline ? 'underline' : 'none' 
          })}
          className={`p-1 rounded cursor-pointer transition-colors ${
            isUnderline ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
          title="Underline"
          aria-label="Toggle Underline Text"
        >
          <Underline className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-4 bg-gray-800 my-auto" />

      {/* Alignment Controls */}
      <div className="flex items-center gap-0.5 bg-gray-900 p-0.5 rounded border border-gray-800">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onUpdateText({ align: 'left', textAlign: 'left' })}
          className={`p-1 rounded cursor-pointer transition-colors ${
            currentAlign === 'left' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
          title="Align Left"
          aria-label="Align Left"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onUpdateText({ align: 'center', textAlign: 'center' })}
          className={`p-1 rounded cursor-pointer transition-colors ${
            currentAlign === 'center' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
          title="Align Center"
          aria-label="Align Center"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onUpdateText({ align: 'right', textAlign: 'right' })}
          className={`p-1 rounded cursor-pointer transition-colors ${
            currentAlign === 'right' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
          title="Align Right"
          aria-label="Align Right"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-4 bg-gray-800 my-auto" />

      {/* Color Swatches */}
      <div className="flex items-center gap-1">
        {colorPresets.map((c) => (
          <button
            key={c.hex}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onUpdateText({ color: c.hex })}
            style={{ backgroundColor: c.hex }}
            className={`w-4 h-4 rounded-full border cursor-pointer transition-transform ${
              currentColor === c.hex.toLowerCase() ? 'ring-2 ring-blue-500 scale-110 border-white' : 'border-gray-700 hover:scale-105'
            }`}
            title={c.name}
            aria-label={`Select Color ${c.name}`}
          />
        ))}
      </div>

      <div className="w-px h-4 bg-gray-800 my-auto" />

      {/* Delete Text Box */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onDeleteText}
        className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/15 rounded cursor-pointer transition-colors"
        title="Delete Text Box"
        aria-label="Delete Selected Text Box"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
