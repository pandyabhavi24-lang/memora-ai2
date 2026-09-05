import React, { useState, useEffect } from 'react';
import { X, Folder, Info, Plus, Check, Tag, Sparkles, FolderOutput, ShieldCheck } from 'lucide-react';

export const EditSuggestionModal = ({ isOpen, onClose, suggestion, onSave }) => {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [suggestedFolderName, setSuggestedFolderName] = useState('');

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

  // Helper to generate up to 5 relevant category label suggestions based on file extension/type
  const getAISuggestedCategories = (filename = '', category = '') => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const suggestions = [];

    if (['c', 'cpp', 'js', 'py', 'java', 'html', 'css'].includes(ext)) {
      suggestions.push('Programming', 'C Language', 'Source Code', 'Software Development', 'College Notes');
    } else if (['pdf', 'doc', 'docx'].includes(ext)) {
      suggestions.push('Education', 'Study Notes', 'Academic Reports', 'Documentation', 'Assignments');
    } else if (['ppt', 'pptx'].includes(ext)) {
      suggestions.push('Presentations', 'Course Slides', 'Seminars', 'Project Demos', 'Work Reports');
    } else if (['jpg', 'jpeg', 'png'].includes(ext)) {
      suggestions.push('Certificates', 'Scan Documents', 'Receipts', 'Personal Records', 'Media');
    } else {
      suggestions.push('Education / Notes', 'Work / Reports', 'Projects', 'Personal', 'Other');
    }

    if (category && !suggestions.includes(category)) {
      suggestions[0] = category;
    }
    return suggestions.slice(0, 5);
  };

  useEffect(() => {
    if (suggestion) {
      const initialCat = suggestion.suggestedCategory || 'Education / Notes';
      setSelectedCategory(initialCat);
      setIsCustomMode(false);
      setCustomCategoryInput('');

      // Build initial label chips from category parts & file type
      const parts = initialCat.split('/').map(s => s.trim());
      const ext = suggestion.filename?.split('.').pop()?.toUpperCase() || 'FILE';
      const initialChips = Array.from(new Set([...parts, ext])).filter(Boolean);
      setSelectedLabels(initialChips);
      setSuggestedFolderName(parts.join(' & '));
    }
  }, [suggestion]);

  // Update folder suggestion when labels change
  useEffect(() => {
    if (selectedLabels.length > 0) {
      const cleanLabels = selectedLabels.filter(l => !['FILE', 'PDF', 'PPTX', 'DOCX', 'PPT', 'DOC'].includes(l.toUpperCase()));
      if (cleanLabels.length > 0) {
        setSuggestedFolderName(cleanLabels.join(' & '));
      } else {
        setSuggestedFolderName(selectedLabels.join(' & '));
      }
    }
  }, [selectedLabels]);

  if (!isOpen || !suggestion) return null;

  const handleToggleLabel = (label) => {
    if (selectedLabels.includes(label)) {
      if (selectedLabels.length > 1) {
        setSelectedLabels(prev => prev.filter(l => l !== label));
      }
    } else {
      setSelectedLabels(prev => [...prev, label]);
    }
  };

  const handleAddLabelChip = (newLabel) => {
    if (!newLabel || !newLabel.trim()) return;
    const trimmed = newLabel.trim();
    if (!selectedLabels.includes(trimmed)) {
      setSelectedLabels(prev => [...prev, trimmed]);
    }
  };

  const handleApplySuggestedFolder = () => {
    if (suggestedFolderName) {
      setSelectedCategory(suggestedFolderName);
    }
  };

  const handleSave = () => {
    const finalCategory = isCustomMode && customCategoryInput.trim() 
      ? customCategoryInput.trim() 
      : selectedCategory;
    onSave(suggestion.id, finalCategory);
    onClose();
  };

  const aiCategories = getAISuggestedCategories(suggestion.filename, suggestion.suggestedCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div
        className="w-full max-w-3xl glass-panel bg-slate-900 border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">AI Classification & Label Management</h3>
              <p className="text-xs text-slate-400">Manage logical tags and choose physical target folder placement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* Target File Info */}
          <div className="p-4 bg-slate-950/90 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              TARGET FILE
            </span>
            <p className="text-sm font-bold text-white font-mono truncate" title={suggestion.filename}>
              📄 {suggestion.filename}
            </p>
            <p className="text-xs text-slate-400 font-mono truncate" title={suggestion.currentPath}>
              📁 Current Folder: <span className="text-slate-300">{suggestion.currentPath}</span>
            </p>
          </div>

          {/* CONCEPT BANNER: LABELS VS PHYSICAL FOLDER */}
          <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/25 space-y-2 text-xs">
            <div className="font-bold flex items-center gap-2 text-blue-200 text-sm">
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Logical AI Labels vs. Physical Folders</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-purple-500/20 text-purple-300/90 leading-relaxed">
                <strong className="text-white block mb-0.5 font-semibold">🏷 AI Labels (Logical)</strong>
                Searchable tags used by Memora for indexing and organizing (e.g. <code className="text-purple-200 font-mono">C</code>, <code className="text-purple-200 font-mono">Programming</code>).
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-blue-500/20 text-blue-300/90 leading-relaxed">
                <strong className="text-white block mb-0.5 font-semibold">📁 Physical Folder (Windows)</strong>
                Actual folder directory on your hard drive where the file will move or copy.
              </div>
            </div>
          </div>

          {/* MULTI-LABEL CHIPS SECTION */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>AI Suggested Labels (Multiple)</span>
              </span>
              <span className="text-[11px] text-slate-400">Click to select/remove labels</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedLabels.map((lbl) => (
                <span
                  key={lbl}
                  onClick={() => handleToggleLabel(lbl)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 cursor-pointer hover:bg-purple-500/25 transition-all"
                >
                  <Tag className="w-3 h-3 text-purple-400" />
                  <span>{lbl}</span>
                  <X className="w-3 h-3 text-purple-400 hover:text-white" />
                </span>
              ))}
            </div>
          </div>

          {/* AI SUGGESTED PHYSICAL FOLDER NAME */}
          {suggestedFolderName && (
            <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                  <FolderOutput className="w-4 h-4 text-indigo-400" />
                  <span>AI Suggested Physical Folder Name:</span>
                </span>
                <p className="text-sm font-bold text-white font-mono pl-5">
                  📁 {suggestedFolderName}
                </p>
              </div>
              <button
                type="button"
                onClick={handleApplySuggestedFolder}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md border border-indigo-400/30 transition-all shrink-0 cursor-pointer"
              >
                Use Suggested Folder
              </button>
            </div>
          )}

          {/* 5 AI SUGGESTED CATEGORIES */}
          <div className="space-y-2.5">
            <span className="font-bold text-xs text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>AI Suggested Categories for this File</span>
            </span>

            <div className="flex flex-wrap gap-2">
              {aiCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    handleAddLabelChip(cat);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <Plus className="w-3 h-3 text-blue-400" />
                  <span>{cat}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CATEGORY & CUSTOM INPUT AREA */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Folder className="w-4 h-4 text-blue-400" />
                <span>Primary Category / Target Folder:</span>
              </label>

              <button
                type="button"
                onClick={() => setIsCustomMode(!isCustomMode)}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isCustomMode ? 'Select from list' : '+ Create custom category'}</span>
              </button>
            </div>

            {isCustomMode ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={customCategoryInput}
                  onChange={(e) => setCustomCategoryInput(e.target.value)}
                  placeholder="e.g. Research / Machine Learning / Code"
                  className="w-full px-4 py-3 bg-slate-950 border border-blue-500/50 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium shadow-inner"
                  autoFocus
                />
                <p className="text-xs text-slate-400">
                  Enter custom category or hierarchical subcategories (e.g. <span className="font-mono text-slate-300 font-semibold">Category / Subcategory</span>).
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto custom-scrollbar p-1">
                {HIERARCHICAL_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all text-left flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/25'
                          : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:bg-slate-800/80'
                      }`}
                    >
                      <span className="truncate">{cat}</span>
                      {isSelected && <Check className="w-4 h-4 text-white shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/90 shrink-0">
          <div className="text-xs text-slate-400 font-mono">
            Selected: <span className="text-blue-300 font-semibold">{isCustomMode && customCategoryInput ? customCategoryInput : selectedCategory}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/20 border border-blue-500/30 transition-all cursor-pointer"
            >
              Save Classification
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
