import React, { useState, useEffect } from 'react';
import { X, Folder, Info, Plus, Check, Tag } from 'lucide-react';

export const EditSuggestionModal = ({ isOpen, onClose, suggestion, onSave }) => {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);

  const HIERARCHICAL_CATEGORIES = [
    'Education / Certificates',
    'Education / Notes',
    'Education / Assignments',
    'Work / Reports',
    'Work / Presentations',
    'Projects / Memora AI',
    'Projects / Documentation',
    'Personal / Documents',
    'Finance / Receipts',
    'Certificates / Credentials',
    'Other'
  ];

  useEffect(() => {
    if (suggestion) {
      setSelectedCategory(suggestion.suggestedCategory || 'Documents');
      setIsCustomMode(false);
      setCustomCategoryInput('');
    }
  }, [suggestion]);

  if (!isOpen || !suggestion) return null;

  const handleSave = () => {
    const finalCategory = isCustomMode && customCategoryInput.trim() 
      ? customCategoryInput.trim() 
      : selectedCategory;
    onSave(suggestion.id, finalCategory);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn select-none">
      <div
        className="w-full max-w-lg glass-panel bg-slate-900 border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Choose Category</h3>
              <p className="text-xs text-slate-400">Assign a logical category label to this file</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
          {/* File Target Metadata */}
          <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              TARGET FILE
            </span>
            <p className="text-xs font-bold text-white font-mono truncate" title={suggestion.filename}>
              {suggestion.filename}
            </p>
            <p className="text-[10px] text-slate-500 font-mono truncate" title={suggestion.currentPath}>
              Current: {suggestion.currentPath}
            </p>
          </div>

          {/* Explanatory Banner: Category vs Destination */}
          <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-xs text-blue-300 space-y-1">
            <div className="font-semibold flex items-center gap-1.5 text-blue-200">
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Category vs Physical Destination</span>
            </div>
            <p className="text-[11px] text-blue-300/90 leading-relaxed">
              <strong>Category</strong> tells Memora what the file is about. <strong>Destination</strong> tells Memora where the file will physically move or copy on your computer.
            </p>
          </div>

          {/* Category Selector Grid */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-blue-400" />
                <span>Select Category / Subcategory:</span>
              </span>
              <button
                type="button"
                onClick={() => setIsCustomMode(!isCustomMode)}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>{isCustomMode ? 'Choose from list' : '+ Create custom category'}</span>
              </button>
            </label>

            {isCustomMode ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={customCategoryInput}
                  onChange={(e) => setCustomCategoryInput(e.target.value)}
                  placeholder="e.g. Research / Machine Learning"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-blue-500/50 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
                  autoFocus
                />
                <p className="text-[10px] text-slate-400">
                  Type a category or hierarchy (e.g. <span className="font-mono text-slate-300">Category / Subcategory</span>).
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                {HIERARCHICAL_CATEGORIES.map((cat) => {
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
                      <span className="truncate">{cat}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-white" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Reasoning Context */}
          {suggestion.reason && (
            <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-xs text-purple-200">
              <span className="font-semibold block text-purple-300 mb-0.5">AI Suggestion Reason:</span>
              <p className="text-purple-200/90 text-[11px] leading-relaxed">"{suggestion.reason}"</p>
            </div>
          )}
        </div>

        {/* Sticky Actions Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-950/90 border-t border-slate-800 shrink-0">
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
            Save Category Choice
          </button>
        </div>
      </div>
    </div>
  );
};
