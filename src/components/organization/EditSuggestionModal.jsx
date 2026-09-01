import React, { useState, useEffect } from 'react';
import { X, Edit3, Folder, Info } from 'lucide-react';
import { INITIAL_CATEGORIES } from '../../data/organizationMockData';

export const EditSuggestionModal = ({ isOpen, onClose, suggestion, onSave }) => {
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    if (suggestion) {
      setSelectedCategory(suggestion.suggestedCategory);
    }
  }, [suggestion]);

  if (!isOpen || !suggestion) return null;

  const handleSave = () => {
    onSave(suggestion.id, selectedCategory);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-lg glass-panel bg-slate-900 border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Edit Organization</h3>
              <p className="text-xs text-slate-400">Override AI category assignment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5">
          {/* File Metadata Card */}
          <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              File Name
            </span>
            <p className="text-sm font-bold text-white font-mono">
              {suggestion.filename}
            </p>
            <p className="text-[11px] text-slate-500 font-mono">
              {suggestion.currentPath}
            </p>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-blue-400" />
              <span>Select Category:</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {INITIAL_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/25'
                        : 'bg-slate-950/90 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <span>{cat}</span>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reasoning Context */}
          <div className="p-3.5 bg-blue-500/10 rounded-xl border border-blue-500/20 flex items-start gap-2.5 text-xs text-blue-300">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block text-blue-200">AI Reasoning:</span>
              <p className="text-blue-300/80 text-[11px] mt-0.5">{suggestion.reason}</p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-950/90 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-500/25 border border-blue-500/30 transition-all cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
