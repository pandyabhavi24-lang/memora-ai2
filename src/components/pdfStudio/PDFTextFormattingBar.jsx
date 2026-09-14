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

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl glass-panel border border-blue-500/40 bg-gray-950/95 shadow-2xl backdrop-blur-md select-none text-xs text-gray-200 animate-fadeIn">
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-400 font-semibold font-mono text-[11px]">
        <Type className="w-3.5 h-3.5" />
        <span>Text Formatting</span>
      </div>

      <div className="w-px h-4 bg-gray-800 my-auto" />

      {/* Font Size Selector */}
      <div className="flex items-center gap-1">
        <label className="text-[10px] text-gray-400">Size:</label>
        <select
          value={selectedText.fontSize || 16}
          onChange={(e) => onUpdateText({ fontSize: parseInt(e.target.value) })}
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
          onClick={() => onUpdateText({ isBold: !selectedText.isBold })}
          className={`p-1 rounded cursor-pointer transition-colors ${
            selectedText.isBold ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
          title="Bold"
          aria-label="Toggle Bold Text"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onUpdateText({ isItalic: !selectedText.isItalic })}
          className={`p-1 rounded cursor-pointer transition-colors ${
            selectedText.isItalic ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
          title="Italic"
          aria-label="Toggle Italic Text"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onUpdateText({ isUnderline: !selectedText.isUnderline })}
          className={`p-1 rounded cursor-pointer transition-colors ${
            selectedText.isUnderline ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
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
          onClick={() => onUpdateText({ align: 'left' })}
          className={`p-1 rounded cursor-pointer transition-colors ${
            selectedText.align === 'left' || !selectedText.align ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
          title="Align Left"
          aria-label="Align Left"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onUpdateText({ align: 'center' })}
          className={`p-1 rounded cursor-pointer transition-colors ${
            selectedText.align === 'center' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
          title="Align Center"
          aria-label="Align Center"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onUpdateText({ align: 'right' })}
          className={`p-1 rounded cursor-pointer transition-colors ${
            selectedText.align === 'right' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
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
            onClick={() => onUpdateText({ color: c.hex })}
            style={{ backgroundColor: c.hex }}
            className={`w-4 h-4 rounded-full border cursor-pointer transition-transform ${
              selectedText.color === c.hex ? 'ring-2 ring-blue-500 scale-110 border-white' : 'border-gray-700 hover:scale-105'
            }`}
            title={c.name}
            aria-label={`Select Color ${c.name}`}
          />
        ))}
      </div>

      <div className="w-px h-4 bg-gray-800 my-auto" />

      {/* Delete Text Box */}
      <button
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
