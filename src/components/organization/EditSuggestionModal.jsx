import React, { useState, useEffect } from 'react';
import { X, Info, Plus, Check, Tag, Sparkles, Edit3 } from 'lucide-react';

export const EditSuggestionModal = ({ isOpen, onClose, suggestion, onSave }) => {
  const [smartTags, setSmartTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingText, setEditingText] = useState('');

  const PRESET_TAG_SUGGESTIONS = [
    'Java', 'Python', 'C Language', 'OOP', 'Inheritance', 'Polymorphism',
    'Data Structures', 'Algorithms', 'College Notes', 'Certificates',
    'Work Reports', 'Presentations', 'Personal Docs'
  ];

  useEffect(() => {
    if (suggestion) {
      if (Array.isArray(suggestion.smart_tags)) {
        setSmartTags(suggestion.smart_tags);
      } else if (Array.isArray(suggestion.labels)) {
        setSmartTags(suggestion.labels);
      } else {
        const catParts = (suggestion.suggestedCategory || '').split('/').map(s => s.trim()).filter(Boolean);
        const ext = suggestion.filename?.split('.').pop()?.toUpperCase() || '';
        const initial = Array.from(new Set([...catParts, ext])).filter(Boolean);
        setSmartTags(initial.length > 0 ? initial : ['Document']);
      }
      setNewTagInput('');
      setEditingIndex(null);
      setEditingText('');
    }
  }, [suggestion]);

  if (!isOpen || !suggestion) return null;

  const sanitizeTag = (t) => (t || '').trim();

  const handleRemoveTag = (indexToRemove) => {
    setSmartTags(prev => prev.filter((_, idx) => idx !== indexToRemove));
    if (editingIndex === indexToRemove) {
      setEditingIndex(null);
      setEditingText('');
    }
  };

  const handleAddTag = (tagToAdd) => {
    const trimmed = sanitizeTag(tagToAdd || newTagInput);
    if (!trimmed) return;
    if (!smartTags.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
      setSmartTags(prev => [...prev, trimmed]);
    }
    setNewTagInput('');
  };

  const handleStartEditing = (idx, currentTag) => {
    setEditingIndex(idx);
    setEditingText(currentTag);
  };

  const handleSaveEditing = (idx) => {
    const trimmed = sanitizeTag(editingText);
    if (!trimmed) {
      handleRemoveTag(idx);
      return;
    }
    const isDuplicate = smartTags.some((t, i) => i !== idx && t.toLowerCase() === trimmed.toLowerCase());
    if (!isDuplicate) {
      setSmartTags(prev => prev.map((t, i) => (i === idx ? trimmed : t)));
    }
    setEditingIndex(null);
    setEditingText('');
  };

  const handleKeyDownNewTag = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleKeyDownEditTag = (e, idx) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEditing(idx);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingIndex(null);
      setEditingText('');
    }
  };

  const handleSave = () => {
    let finalTags = [...smartTags];
    if (editingIndex !== null && editingText) {
      const trimmed = sanitizeTag(editingText);
      if (trimmed && !finalTags.some((t, i) => i !== editingIndex && t.toLowerCase() === trimmed.toLowerCase())) {
        finalTags[editingIndex] = trimmed;
      }
    }
    // Clean, trim, and deduplicate
    const cleanList = [];
    const seen = new Set();
    for (const t of finalTags) {
      const trimmed = sanitizeTag(t);
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        cleanList.push(trimmed);
      }
    }
    onSave(suggestion.id, suggestion.suggestedCategory, cleanList);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div
        className="w-full max-w-2xl glass-panel bg-slate-900 border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Edit Smart Tags</h3>
              <p className="text-xs text-slate-400">Manage descriptive metadata tags for semantic search & filtering</p>
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
              📁 Location: <span className="text-slate-300">{suggestion.currentPath}</span>
            </p>
          </div>

          {/* CONCEPT BANNER */}
          <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/25 space-y-1.5 text-xs text-purple-200">
            <div className="font-bold flex items-center gap-2 text-purple-300 text-sm">
              <Info className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Smart Tags vs. Physical Folders</span>
            </div>
            <p className="text-[11px] leading-relaxed text-purple-200/90">
              <strong>Smart Tags</strong> describe file content for quick search filtering and indexing. Multiple Smart Tags can be attached to a single file. They do <strong>not</strong> restrict or determine physical hard drive folder names.
            </p>
          </div>

          {/* ACTIVE SMART TAGS CHIPS */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
            <span className="font-bold text-xs text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Active Smart Tags ({smartTags.length})</span>
            </span>

            <div className="flex flex-wrap items-center gap-2 min-h-[36px]">
              {smartTags.length === 0 ? (
                <span className="text-xs text-slate-500 italic">No smart tags assigned. Add one below.</span>
              ) : (
                smartTags.map((tag, idx) => (
                  editingIndex === idx ? (
                    <div key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-purple-500">
                      <input
                        type="text"
                        autoFocus
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => handleKeyDownEditTag(e, idx)}
                        className="px-1 py-0.5 bg-transparent text-xs text-white focus:outline-none w-28 font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEditing(idx)}
                        className="text-emerald-400 hover:text-emerald-300 p-0.5"
                        title="Save tag edit"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingIndex(null)}
                        className="text-slate-400 hover:text-slate-200 p-0.5"
                        title="Cancel edit"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40 group transition-all"
                    >
                      <Tag className="w-3 h-3 text-purple-400" />
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleStartEditing(idx, tag)}
                        className="text-purple-400 hover:text-purple-200 transition-colors ml-1 p-0.5"
                        title="Edit tag text"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(idx)}
                        className="text-purple-400 hover:text-red-400 transition-colors p-0.5"
                        title="Remove tag"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )
                ))
              )}
            </div>
          </div>

          {/* ADD CUSTOM TAG INPUT */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-200">
              Add New Smart Tag:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={handleKeyDownNewTag}
                placeholder="Type tag name (e.g. Artificial Intelligence) and press Enter"
                className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-medium"
              />
              <button
                type="button"
                onClick={() => handleAddTag()}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Tag</span>
              </button>
            </div>
          </div>

          {/* SUGGESTED PRESET TAGS */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-slate-300">
              Suggested Preset Tags:
            </span>
            <div className="flex flex-wrap gap-2">
              {PRESET_TAG_SUGGESTIONS.map((preset) => {
                const isSelected = smartTags.some(t => t.toLowerCase() === preset.toLowerCase());
                return (
                  <button
                    key={preset}
                    type="button"
                    disabled={isSelected}
                    onClick={() => handleAddTag(preset)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-slate-600 border-slate-800 opacity-50 cursor-not-allowed'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-purple-500/20 hover:text-purple-300 hover:border-purple-500/30'
                    }`}
                  >
                    <Plus className="w-3 h-3 text-purple-400" />
                    <span>{preset}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/90 shrink-0">
          <div className="text-xs text-slate-400 font-mono">
            Tags count: <span className="text-purple-300 font-semibold">{smartTags.length}</span>
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
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-lg shadow-purple-500/20 border border-purple-500/30 transition-all cursor-pointer"
            >
              Save Smart Tags
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
