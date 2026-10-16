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
        className="w-full max-w-2xl bg-[#0A1629] border border-[rgba(139,170,215,0.18)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(139,170,215,0.14)] bg-[#0E1D35] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[rgba(117,102,246,0.15)] border border-[rgba(117,102,246,0.3)] flex items-center justify-center text-[#7566F6]">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#F4F7FF]">Edit Smart Tags</h3>
              <p className="text-xs text-[#A7B7D0]">Add or remove labels to help you find and organize this file</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#71839E] hover:text-[#F4F7FF] hover:bg-[#132642] rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* Target File Info */}
          <div className="p-4 bg-[#06101F] rounded-xl border border-[rgba(139,170,215,0.14)] space-y-1">
            <span className="text-[10px] font-bold text-[#71839E] uppercase tracking-wider block">
              TARGET FILE
            </span>
            <p className="text-sm font-bold text-[#F4F7FF] font-mono truncate" title={suggestion.filename}>
              📄 {suggestion.filename}
            </p>
            <p className="text-xs text-[#A7B7D0] font-mono truncate" title={suggestion.currentPath}>
              📁 Location: <span className="text-[#F4F7FF]">{suggestion.currentPath}</span>
            </p>
          </div>

          {/* CONCEPT BANNER */}
          <div className="p-4 bg-[rgba(117,102,246,0.1)] rounded-xl border border-[rgba(117,102,246,0.25)] space-y-1.5 text-xs text-indigo-200">
            <div className="font-bold flex items-center gap-2 text-indigo-300 text-sm">
              <Info className="w-4 h-4 text-[#7566F6] shrink-0" />
              <span>Smart Tags vs. Physical Folders</span>
            </div>
            <p className="text-[11px] leading-relaxed text-indigo-200/90">
              <strong>Smart Tags</strong> describe what a file is about, making it easier to find in search. Multiple Smart Tags can be attached to a single file. They do <strong>not</strong> move or rename files on your computer.
            </p>
          </div>

          {/* ACTIVE SMART TAGS CHIPS */}
          <div className="p-4 rounded-xl bg-[#06101F] border border-[rgba(139,170,215,0.14)] space-y-3">
            <span className="font-bold text-xs text-[#F4F7FF] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#7566F6]" />
              <span>Active Smart Tags ({smartTags.length})</span>
            </span>

            <div className="flex flex-wrap items-center gap-2 min-h-[36px]">
              {smartTags.length === 0 ? (
                <span className="text-xs text-[#71839E] italic">No smart tags assigned. Add one below.</span>
              ) : (
                smartTags.map((tag, idx) => (
                  editingIndex === idx ? (
                    <div key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0E1D35] border border-[#7566F6]">
                      <input
                        type="text"
                        autoFocus
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => handleKeyDownEditTag(e, idx)}
                        className="px-1 py-0.5 bg-transparent text-xs text-[#F4F7FF] focus:outline-none w-28 font-semibold"
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
                        className="text-[#71839E] hover:text-[#F4F7FF] p-0.5"
                        title="Cancel edit"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[rgba(117,102,246,0.15)] text-indigo-300 border border-[rgba(117,102,246,0.3)] group transition-all"
                    >
                      <Tag className="w-3 h-3 text-[#7566F6]" />
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleStartEditing(idx, tag)}
                        className="text-[#7566F6] hover:text-[#F4F7FF] transition-colors ml-1 p-0.5"
                        title="Edit tag text"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(idx)}
                        className="text-[#7566F6] hover:text-red-400 transition-colors p-0.5"
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
            <label className="text-xs font-bold text-[#F4F7FF]">
              Add New Smart Tag:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={handleKeyDownNewTag}
                placeholder="Type tag name (e.g. Artificial Intelligence) and press Enter"
                className="flex-1 px-4 py-2.5 bg-[#06101F] border border-[rgba(139,170,215,0.18)] rounded-xl text-xs text-[#F4F7FF] placeholder-[#71839E] focus:outline-none focus:border-[#7566F6] font-medium"
              />
              <button
                type="button"
                onClick={() => handleAddTag()}
                className="px-4 py-2.5 bg-[#7566F6] hover:bg-[#6353F5] text-white font-semibold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Tag</span>
              </button>
            </div>
          </div>

          {/* SUGGESTED PRESET TAGS */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-[#A7B7D0]">
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
                        ? 'bg-[#0E1D35] text-[#71839E] border-[rgba(139,170,215,0.1)] opacity-50 cursor-not-allowed'
                        : 'bg-[#06101F] text-[#A7B7D0] border-[rgba(139,170,215,0.14)] hover:bg-[rgba(117,102,246,0.15)] hover:text-indigo-300 hover:border-[rgba(117,102,246,0.3)]'
                    }`}
                  >
                    <Plus className="w-3 h-3 text-[#7566F6]" />
                    <span>{preset}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[rgba(139,170,215,0.14)] bg-[#0E1D35] shrink-0">
          <div className="text-xs text-[#71839E] font-mono">
            Tags count: <span className="text-indigo-300 font-semibold">{smartTags.length}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#06101F] hover:bg-[#132642] text-[#A7B7D0] hover:text-[#F4F7FF] border border-[rgba(139,170,215,0.18)] font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-[#7566F6] hover:bg-[#6353F5] text-white font-semibold text-xs shadow-lg shadow-purple-500/20 border border-purple-500/30 transition-all cursor-pointer"
            >
              Save Smart Tags
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
