import React, { useState, useEffect } from 'react';
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
    recordOpenedFile,
    folders
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

  const [dynamicCategories, setDynamicCategories] = useState([]);

  useEffect(() => {
    import('../services/organizationService').then(({ organizationService }) => {
      organizationService.getCategories().then(cats => {
        if (Array.isArray(cats) && cats.length > 0) {
          setDynamicCategories(cats);
        }
      }).catch(err => console.warn('Could not load dynamic categories:', err));
    });
  }, []);

  const defaultCategories = [
    { id: 'education', label: 'Education' },
    { id: 'programming', label: 'Programming' },
    { id: 'work', label: 'Work' },
    { id: 'personal', label: 'Personal' },
    { id: 'projects', label: 'Projects' },
    { id: 'certificates', label: 'Certificates' },
    { id: 'finance', label: 'Finance' },
    { id: 'images', label: 'Images' },
    { id: 'documents', label: 'Documents' },
    { id: 'other', label: 'Other' }
  ];

  const categoryList = dynamicCategories.length > 0
    ? dynamicCategories.map(c => ({ id: c.name.toLowerCase(), label: c.name }))
    : defaultCategories;

  const categoryOptions = [
    { id: 'all', label: 'All Categories' },
    ...categoryList.filter(c => c.id !== 'all')
  ];

  const samplePrompts = [
    'Find recent project documents',
    'Search for reports and notes',
    'Find certificates and documents',
    'Search for image files'
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
    <div className="max-w-4xl mx-auto space-y-6 py-3 select-none">
      {/* Friendly Plain-Language Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#3478F6]/10 border border-[#3478F6]/20 text-xs font-semibold text-[#4B91FF] mb-2.5">
          <Sparkles className="w-3.5 h-3.5 text-[#4B91FF]" />
          <span>Search</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F4F7FF] tracking-tight mb-1.5">
          Search
        </h1>
        <p className="text-xs sm:text-sm text-[#A7B7D0] max-w-xl mx-auto font-medium">
          Search by meaning and context, not only exact file titles.
        </p>
      </div>

      {/* Prominent Hero Search Input Form */}
      <form onSubmit={handleSearchSubmit} className="relative shadow-2xl">
        <div className="glass-panel p-2 rounded-2xl border-[rgba(139,170,215,0.22)] bg-[#0A1629] focus-within:border-[#3478F6] focus-within:ring-2 focus-within:ring-[#3478F6]/20 flex items-center gap-3 transition-all">
          <Search className="w-5 h-5 text-[#71839E] ml-3 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="What are you looking for?"
            className="w-full bg-transparent border-none text-sm sm:text-base text-[#F4F7FF] placeholder-[#71839E] focus:outline-none py-2.5 font-medium"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1.5 text-[#71839E] hover:text-[#F4F7FF] rounded-lg hover:bg-[#0E1D35] transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <Button type="submit" variant="primary" size="md" className="shrink-0 rounded-xl px-5 font-semibold">
            Search Files
          </Button>
        </div>
      </form>

      {/* Natural Language Suggestions Section */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl border-[rgba(139,170,215,0.14)] bg-[#0A1629] space-y-2.5">
        <h3 className="text-xs font-bold text-[#A7B7D0] uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#4B91FF]" />
          <span>Try searching for:</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {samplePrompts.map((prompt, idx) => (
            <div
              key={idx}
              onClick={() => handleSelectQuery(prompt)}
              className="p-3 rounded-xl bg-[#0E1D35] hover:bg-[#132642] border border-[rgba(139,170,215,0.14)] hover:border-[#3478F6]/40 cursor-pointer transition-all flex items-center justify-between group"
            >
              <span className="text-xs text-[#F4F7FF] font-medium group-hover:text-[#4B91FF]">
                "{prompt}"
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-[#71839E] group-hover:text-[#4B91FF] group-hover:translate-x-0.5 transition-all" />
            </div>
          ))}
        </div>
      </div>

      {/* Refine Search / Filter Controls */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl border-[rgba(139,170,215,0.14)] bg-[#0A1629] space-y-3.5">
        <div className="flex items-center justify-between border-b border-[rgba(139,170,215,0.14)] pb-2.5">
          <h3 className="text-xs font-bold text-[#A7B7D0] uppercase tracking-wider flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#4B91FF]" />
            <span>Refine Your Search</span>
          </h3>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#71839E] font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#0E1D35] border border-[rgba(139,170,215,0.18)] rounded-lg px-2.5 py-1 text-xs text-[#F4F7FF] focus:outline-none focus:border-[#3478F6]"
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
            <label className="text-[#A7B7D0] font-semibold mb-1 block flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#4B91FF]" />
              File Type
            </label>
            <select
              value={filters.fileType}
              onChange={(e) => setFilters({ ...filters, fileType: e.target.value })}
              className="w-full bg-[#0E1D35] border border-[rgba(139,170,215,0.18)] rounded-xl p-2 text-[#F4F7FF] focus:outline-none focus:border-[#3478F6] font-medium"
            >
              {fileTypeOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="text-[#A7B7D0] font-semibold mb-1 block flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              Date Modified
            </label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
              className="w-full bg-[#0E1D35] border border-[rgba(139,170,215,0.18)] rounded-xl p-2 text-[#F4F7FF] focus:outline-none focus:border-[#3478F6] font-medium"
            >
              {dateRangeOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* File Size Filter */}
          <div>
            <label className="text-[#A7B7D0] font-semibold mb-1 block flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              File Size
            </label>
            <select
              value={filters.size || 'any'}
              onChange={(e) => setFilters({ ...filters, size: e.target.value })}
              className="w-full bg-[#0E1D35] border border-[rgba(139,170,215,0.18)] rounded-xl p-2 text-[#F4F7FF] focus:outline-none focus:border-[#3478F6] font-medium"
            >
              {sizeOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="text-[#A7B7D0] font-semibold mb-1 block flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-400" />
              Category
            </label>
            <select
              value={filters.category || 'all'}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full bg-[#0E1D35] border border-[rgba(139,170,215,0.18)] rounded-xl p-2 text-[#F4F7FF] focus:outline-none focus:border-[#3478F6] font-medium"
            >
              {categoryOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Ribbon */}
        {hasActiveFilters && (
          <div className="pt-2.5 border-t border-[rgba(139,170,215,0.14)] flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[#71839E] font-semibold">Active Filters:</span>
              {filters.fileType !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#3478F6]/15 text-[#4B91FF] border border-[#3478F6]/30">
                  Type: {fileTypeOptions.find(o => o.id === filters.fileType)?.label}
                  <button onClick={() => setFilters({ ...filters, fileType: 'all' })} className="hover:text-white ml-0.5 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filters.dateRange !== 'any' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  Date: {dateRangeOptions.find(o => o.id === filters.dateRange)?.label}
                  <button onClick={() => setFilters({ ...filters, dateRange: 'any' })} className="hover:text-white ml-0.5 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filters.size && filters.size !== 'any' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Size: {sizeOptions.find(o => o.id === filters.size)?.label}
                  <button onClick={() => setFilters({ ...filters, size: 'any' })} className="hover:text-white ml-0.5 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filters.category && filters.category !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Category: {categoryOptions.find(o => o.id === filters.category)?.label}
                  <button onClick={() => setFilters({ ...filters, category: 'all' })} className="hover:text-white ml-0.5 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-[#4B91FF] hover:underline font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear All</span>
            </button>
          </div>
        )}
      </div>

      {/* Recently Opened Files */}
      {recentlyOpenedFiles && recentlyOpenedFiles.length > 0 && (
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border-[rgba(139,170,215,0.14)] bg-[#0A1629] space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#A7B7D0] uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-[#4B91FF]" />
              <span>Recently Opened Files</span>
            </h3>
            <span className="text-[11px] text-[#71839E] font-medium">Click to open file</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {recentlyOpenedFiles.slice(0, 6).map((fileItem) => {
              const shortenedPath = fileItem.path && fileItem.path.length > 40
                ? '...' + fileItem.path.slice(-37)
                : fileItem.path;

              return (
                <div
                  key={fileItem.id || fileItem.path}
                  onClick={() => handleOpenRecentFile(fileItem)}
                  className="p-3 rounded-xl bg-[#0E1D35] hover:bg-[#132642] border border-[rgba(139,170,215,0.14)] hover:border-[#3478F6]/40 cursor-pointer transition-all flex items-center justify-between group"
                  title={`Open ${fileItem.name}\n${fileItem.path}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-[#4B91FF] shrink-0 group-hover:scale-105 transition-transform" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#F4F7FF] truncate group-hover:text-[#4B91FF]">
                        {fileItem.name}
                      </p>
                      <p className="text-[10px] text-[#71839E] font-mono truncate">
                        {shortenedPath}
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-[#71839E] group-hover:text-[#4B91FF] shrink-0 ml-2" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Searches */}
      {searchHistory.length > 0 && (
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border-[rgba(139,170,215,0.14)] bg-[#0A1629]">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-bold text-[#A7B7D0] uppercase tracking-wider flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-purple-400" />
              <span>Recent Searches</span>
            </h3>
            <button
              type="button"
              onClick={clearHistoryAll}
              className="text-[11px] text-[#71839E] hover:text-red-400 transition-colors font-medium cursor-pointer"
            >
              Clear All History
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {searchHistory.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0E1D35] text-xs text-[#A7B7D0] border border-[rgba(139,170,215,0.14)] hover:border-[#3478F6]/40 transition-colors group"
              >
                <span
                  onClick={() => handleSelectQuery(item.query)}
                  className="cursor-pointer hover:text-[#F4F7FF] font-medium"
                >
                  {item.query}
                </span>
                <button
                  type="button"
                  onClick={() => removeHistoryItem(item.id)}
                  className="text-[#71839E] hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
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
