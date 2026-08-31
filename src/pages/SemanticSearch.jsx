import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Sparkles, 
  History, 
  Filter, 
  ArrowRight,
  FileText,
  Image as ImageIcon,
  GraduationCap,
  Receipt,
  Trash2,
  X,
  SlidersHorizontal,
  Calendar,
  Folder
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/common/Button';
import { MOCK_SEARCH_SUGGESTIONS } from '../services/mockData';

export const SemanticSearch = () => {
  const navigate = useNavigate();
  const { 
    searchQuery, 
    setSearchQuery, 
    filters, 
    setFilters, 
    sortBy, 
    setSortBy, 
    searchHistory, 
    removeHistoryItem, 
    clearHistoryAll,
    executeSearch
  } = useApp();

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      executeSearch(searchQuery);
      navigate('/results');
    }
  };

  const handleSelectQuery = (query) => {
    setSearchQuery(query);
    executeSearch(query);
    navigate('/results');
  };

  const fileTypeOptions = [
    { id: 'all', label: 'All Types' },
    { id: 'pdf', label: 'PDF Documents' },
    { id: 'doc', label: 'Word / Docs' },
    { id: 'image', label: 'Images & Receipts' },
    { id: 'presentation', label: 'Presentations' },
    { id: 'spreadsheet', label: 'Spreadsheets' }
  ];

  const dateRangeOptions = [
    { id: 'any', label: 'Any time' },
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This week' },
    { id: 'month', label: 'This month' },
    { id: 'year', label: 'This year' }
  ];

  const folderOptions = [
    { id: 'all', label: 'All Folders' },
    { id: 'Documents', label: 'Documents' },
    { id: 'Downloads', label: 'Downloads' },
    { id: 'Desktop', label: 'Desktop' },
    { id: 'Pictures', label: 'Pictures' },
    { id: 'College', label: 'College' },
    { id: 'Work', label: 'Work' }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4 select-none">
      {/* Search Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400 mb-3">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span>Semantic Vector Search Engine</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
          Search Digital Memories by Meaning
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 max-w-xl mx-auto">
          Type natural language queries. Memora AI searches document content, EasyOCR scans, and visual vector embeddings.
        </p>
      </div>

      {/* Prominent Hero Search Input Form */}
      <form onSubmit={handleSearchSubmit} className="relative shadow-2xl">
        <div className="glass-panel p-2.5 rounded-2xl border-blue-500/40 focus-within:border-blue-500 flex items-center gap-3">
          <Search className="w-6 h-6 text-gray-400 ml-3 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ask Memora... (e.g. 'Show my latest internship resume')"
            className="w-full bg-transparent border-none text-base text-white placeholder-gray-500 focus:outline-none py-3"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <Button type="submit" variant="primary" size="md" className="shrink-0 rounded-xl px-6">
            Search
          </Button>
        </div>
      </form>

      {/* Expanded Filter Bar */}
      <div className="glass-panel p-5 rounded-2xl border-gray-800/80 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-400" />
            <span>Search Filters & Sort Options</span>
          </h3>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            >
              <option value="relevant">Most Relevant</option>
              <option value="newest">Newest Modified</option>
              <option value="oldest">Oldest Modified</option>
              <option value="largest">Largest File Size</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          {/* File Type Filter */}
          <div>
            <label className="text-gray-400 font-semibold mb-1.5 block flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              File Type
            </label>
            <select
              value={filters.fileType}
              onChange={(e) => setFilters({ ...filters, fileType: e.target.value })}
              className="w-full bg-gray-900/80 border border-gray-800 rounded-xl p-2 text-gray-200 focus:outline-none focus:border-blue-500"
            >
              {fileTypeOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="text-gray-400 font-semibold mb-1.5 block flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              Date Modified
            </label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
              className="w-full bg-gray-900/80 border border-gray-800 rounded-xl p-2 text-gray-200 focus:outline-none focus:border-blue-500"
            >
              {dateRangeOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Folder Filter */}
          <div>
            <label className="text-gray-400 font-semibold mb-1.5 block flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-emerald-400" />
              Folder Scope
            </label>
            <select
              value={filters.folder}
              onChange={(e) => setFilters({ ...filters, folder: e.target.value })}
              className="w-full bg-gray-900/80 border border-gray-800 rounded-xl p-2 text-gray-200 focus:outline-none focus:border-blue-500"
            >
              {folderOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Suggested Natural Language Queries Grid */}
      <div className="glass-panel p-6 rounded-2xl border-gray-800/80">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>Recommended Natural Language Queries</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {MOCK_SEARCH_SUGGESTIONS.map((suggestion, idx) => (
            <div
              key={idx}
              onClick={() => handleSelectQuery(suggestion)}
              className="p-3.5 rounded-xl bg-gray-900/60 hover:bg-gray-800/80 border border-gray-800/80 hover:border-blue-500/40 cursor-pointer transition-all flex items-center justify-between group"
            >
              <span className="text-xs text-gray-200 font-medium group-hover:text-blue-300">
                "{suggestion}"
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
            </div>
          ))}
        </div>
      </div>

      {/* Search History */}
      {searchHistory.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl border-gray-800/80">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-purple-400" />
              <span>Search History</span>
            </h3>
            <button
              onClick={clearHistoryAll}
              className="text-[11px] text-gray-500 hover:text-red-400 transition-colors"
            >
              Clear All History
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {searchHistory.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900/80 text-xs text-gray-300 border border-gray-800 hover:border-gray-700 transition-colors group"
              >
                <span
                  onClick={() => handleSelectQuery(item.query)}
                  className="cursor-pointer hover:text-white"
                >
                  {item.query}
                </span>
                <button
                  onClick={() => removeHistoryItem(item.id)}
                  className="text-gray-500 hover:text-red-400 p-0.5 rounded transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
