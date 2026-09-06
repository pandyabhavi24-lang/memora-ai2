import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Sparkles, 
  History, 
  ArrowRight,
  FileText,
  X,
  SlidersHorizontal,
  Calendar,
  HardDrive,
  Tag,
  RotateCcw,
  Clock,
  ExternalLink
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/common/Button';
import { apiService } from '../services/apiService';

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
    executeSearch,
    recentlyOpenedFiles,
    recordOpenedFile
  } = useApp();

  const handleOpenRecentFile = (fileItem) => {
    if (fileItem && fileItem.path) {
      apiService.openFile(fileItem.path);
      recordOpenedFile(fileItem);
    }
  };

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
    { id: 'all', label: 'All Files' },
    { id: 'pdf', label: 'PDF Documents' },
    { id: 'doc', label: 'Word Documents' },
    { id: 'presentation', label: 'PowerPoint' },
    { id: 'image', label: 'Images & Photos' },
    { id: 'text', label: 'Text Files' },
    { id: 'other', label: 'Other Formats' }
  ];

  const dateRangeOptions = [
    { id: 'any', label: 'Any Date' },
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'Last 7 Days' },
    { id: 'month', label: 'Last 30 Days' },
    { id: 'year', label: 'This Year' },
    { id: 'older', label: 'Older' }
  ];

  const sizeOptions = [
    { id: 'any', label: 'Any Size' },
    { id: 'under_10mb', label: 'Under 10 MB' },
    { id: 'under_100mb', label: 'Under 100 MB' },
    { id: 'under_500mb', label: 'Under 500 MB' },
    { id: 'under_1gb', label: 'Under 1 GB' },
    { id: 'over_1gb', label: '1 GB or larger' }
  ];

  const categoryOptions = [
    { id: 'all', label: 'All Categories' },
    { id: 'education', label: 'Education' },
    { id: 'work', label: 'Work' },
    { id: 'personal', label: 'Personal' },
    { id: 'projects', label: 'Projects' },
    { id: 'certificates', label: 'Certificates' },
    { id: 'finance', label: 'Finance' },
    { id: 'other', label: 'Other' }
  ];

  const folderOptions = [
    { id: 'all', label: 'All Locations' },
    { id: 'Documents', label: 'Documents Folder' },
    { id: 'Downloads', label: 'Downloads Folder' },
    { id: 'Desktop', label: 'Desktop' },
    { id: 'Pictures', label: 'Pictures' },
    { id: 'College', label: 'College' },
    { id: 'Work', label: 'Work' }
  ];

  const samplePrompts = [
    'Find my internship certificate',
    'Show my BFS notes',
    'Find files about machine learning',
    'Find my project report'
  ];

  const hasActiveFilters = 
    filters.fileType !== 'all' || 
    filters.dateRange !== 'any' || 
    (filters.size && filters.size !== 'any') || 
    (filters.category && filters.category !== 'all') || 
    (Array.isArray(filters.labels) && filters.labels.length > 0);

  const resetFilters = () => {
    setFilters({ fileType: 'all', dateRange: 'any', category: 'all', labels: [], size: 'any' });
    setSortBy('relevant');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4 select-none">
      {/* Friendly Plain-Language Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400 mb-3">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span>Intelligent Digital Memory Assistant</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
          Search Your Files
        </h1>
        <p className="text-sm text-gray-300 max-w-xl mx-auto font-medium">
          Search by meaning, not only exact words.
        </p>
      </div>

      {/* Prominent Hero Search Input Form */}
      <form onSubmit={handleSearchSubmit} className="relative shadow-2xl">
        <div className="glass-panel p-2.5 rounded-2xl border-blue-500/40 focus-within:border-blue-500 flex items-center gap-3 transition-all">
          <Search className="w-6 h-6 text-gray-400 ml-3 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="What are you looking for?"
            className="w-full bg-transparent border-none text-base text-white placeholder-gray-400 focus:outline-none py-3 font-medium"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <Button type="submit" variant="primary" size="md" className="shrink-0 rounded-xl px-6 font-semibold">
            Search Files
          </Button>
        </div>
      </form>

      {/* Natural Language Suggestions Section */}
      <div className="glass-panel p-5 rounded-2xl border-gray-800/80 space-y-3">
        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>Try searching for:</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {samplePrompts.map((prompt, idx) => (
            <div
              key={idx}
              onClick={() => handleSelectQuery(prompt)}
              className="p-3.5 rounded-xl bg-gray-900/70 hover:bg-blue-950/40 border border-gray-800/80 hover:border-blue-500/40 cursor-pointer transition-all flex items-center justify-between group"
            >
              <span className="text-xs text-gray-200 font-medium group-hover:text-blue-300">
                "{prompt}"
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
            </div>
          ))}
        </div>
      </div>

      {/* Refine Search / Filter Controls */}
      <div className="glass-panel p-5 rounded-2xl border-gray-800/80 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-400" />
            <span>Refine Your Search</span>
          </h3>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">Sort by:</span>
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

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* File Type Filter */}
          <div>
            <label className="text-gray-400 font-semibold mb-1.5 block flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              File Type
            </label>
            <select
              value={filters.fileType}
              onChange={(e) => setFilters({ ...filters, fileType: e.target.value })}
              className="w-full bg-gray-900/80 border border-gray-800 rounded-xl p-2 text-gray-200 focus:outline-none focus:border-blue-500 font-medium"
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
              className="w-full bg-gray-900/80 border border-gray-800 rounded-xl p-2 text-gray-200 focus:outline-none focus:border-blue-500 font-medium"
            >
              {dateRangeOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* File Size Filter */}
          <div>
            <label className="text-gray-400 font-semibold mb-1.5 block flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              File Size
            </label>
            <select
              value={filters.size || 'any'}
              onChange={(e) => setFilters({ ...filters, size: e.target.value })}
              className="w-full bg-gray-900/80 border border-gray-800 rounded-xl p-2 text-gray-200 focus:outline-none focus:border-blue-500 font-medium"
            >
              {sizeOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="text-gray-400 font-semibold mb-1.5 block flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-400" />
              Category
            </label>
            <select
              value={filters.category || 'all'}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full bg-gray-900/80 border border-gray-800 rounded-xl p-2 text-gray-200 focus:outline-none focus:border-blue-500 font-medium"
            >
              {categoryOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Ribbon */}
        {hasActiveFilters && (
          <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-gray-400 font-semibold">Active Filters:</span>
              {filters.fileType !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  Type: {fileTypeOptions.find(o => o.id === filters.fileType)?.label}
                  <button onClick={() => setFilters({ ...filters, fileType: 'all' })} className="hover:text-white ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filters.dateRange !== 'any' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  Date: {dateRangeOptions.find(o => o.id === filters.dateRange)?.label}
                  <button onClick={() => setFilters({ ...filters, dateRange: 'any' })} className="hover:text-white ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filters.size && filters.size !== 'any' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Size: {sizeOptions.find(o => o.id === filters.size)?.label}
                  <button onClick={() => setFilters({ ...filters, size: 'any' })} className="hover:text-white ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filters.category && filters.category !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Category: {categoryOptions.find(o => o.id === filters.category)?.label}
                  <button onClick={() => setFilters({ ...filters, category: 'all' })} className="hover:text-white ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear All</span>
            </button>
          </div>
        )}
      </div>

      {/* Recently Opened Files */}
      {recentlyOpenedFiles && recentlyOpenedFiles.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl border-gray-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Recently Opened Files</span>
            </h3>
            <span className="text-[11px] text-gray-500 font-medium">Click to open file</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {recentlyOpenedFiles.slice(0, 5).map((fileItem) => {
              const shortenedPath = fileItem.path && fileItem.path.length > 40
                ? '...' + fileItem.path.slice(-37)
                : fileItem.path;

              return (
                <div
                  key={fileItem.id || fileItem.path}
                  onClick={() => handleOpenRecentFile(fileItem)}
                  className="p-3 rounded-xl bg-gray-900/80 hover:bg-blue-950/40 border border-gray-800/80 hover:border-blue-500/40 cursor-pointer transition-all flex items-center justify-between group"
                  title={`Open ${fileItem.name}\n${fileItem.path}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-blue-400 shrink-0 group-hover:scale-105 transition-transform" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-200 truncate group-hover:text-blue-300">
                        {fileItem.name}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono truncate">
                        {shortenedPath}
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-500 group-hover:text-blue-400 shrink-0 ml-2" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Searches */}
      {searchHistory.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl border-gray-800/80">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-purple-400" />
              <span>Recent Searches</span>
            </h3>
            <button
              type="button"
              onClick={clearHistoryAll}
              className="text-[11px] text-gray-400 hover:text-red-400 transition-colors font-medium"
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
                  className="cursor-pointer hover:text-white font-medium"
                >
                  {item.query}
                </span>
                <button
                  type="button"
                  onClick={() => removeHistoryItem(item.id)}
                  className="text-gray-500 hover:text-red-400 p-0.5 rounded transition-colors"
                  title="Remove item"
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

