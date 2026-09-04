import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Sparkles, 
  FileText, 
  Image as ImageIcon, 
  ExternalLink, 
  FolderOpen, 
  Eye, 
  Brain,
  Filter,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Folder,
  FolderOutput,
  Info,
  RotateCcw,
  SearchX
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Skeleton } from '../components/common/Skeleton';
import { apiService } from '../services/apiService';

export const SearchResults = () => {
  const navigate = useNavigate();
  const { 
    searchQuery, 
    setSearchQuery, 
    searchResults, 
    searchTotal,
    searchExecutionTime,
    isSearching, 
    searchError,
    executeSearch, 
    setPreviewFile,
    filters,
    setFilters,
    sortBy,
    setSortBy,
    recordOpenedFile
  } = useApp();

  const [activeTooltip, setActiveTooltip] = useState(null);

  useEffect(() => {
    if (searchQuery) {
      executeSearch(searchQuery, filters, sortBy);
    }
  }, [searchQuery, sortBy]);

  const handleOpenNative = (filePath, fileObj) => {
    apiService.openFile(filePath);
    if (fileObj) {
      recordOpenedFile(fileObj);
    }
  };

  const handleLocateNative = (filePath) => {
    apiService.locateFile(filePath);
  };

  const handleOrganizeAction = () => {
    navigate('/organize');
  };

  const resetFilters = () => {
    setFilters({ fileType: 'all', dateRange: 'any', folder: 'all', size: 'any', category: 'all' });
    setSortBy('relevant');
  };

  // Helper for size-based filtering
  const matchesSize = (sizeBytes, sizeFilter) => {
    if (!sizeFilter || sizeFilter === 'any') return true;
    const mb = sizeBytes / (1024 * 1024);
    if (sizeFilter === 'under_10mb') return mb < 10;
    if (sizeFilter === 'under_100mb') return mb < 100;
    if (sizeFilter === 'under_500mb') return mb < 500;
    if (sizeFilter === 'under_1gb') return mb < 1024;
    if (sizeFilter === 'over_1gb') return mb >= 1024;
    return true;
  };

  // Helper for category-based filtering
  const matchesCategory = (itemCategory, categoryFilter) => {
    if (!categoryFilter || categoryFilter === 'all') return true;
    if (!itemCategory) return false;
    return itemCategory.toLowerCase().includes(categoryFilter.toLowerCase());
  };

  // Helper for file-type filtering
  const matchesFileType = (file, typeFilter) => {
    if (!typeFilter || typeFilter === 'all') return true;
    const ext = (file.fileExtension || file.extension || '').toLowerCase();
    const cat = (file.category || '').toLowerCase();

    if (typeFilter === 'pdf') return ext === '.pdf' || cat === 'pdf';
    if (typeFilter === 'doc') return ['.doc', '.docx'].includes(ext) || cat === 'doc' || cat === 'docx';
    if (typeFilter === 'presentation') return ['.ppt', '.pptx'].includes(ext);
    if (typeFilter === 'image') return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) || cat === 'image';
    if (typeFilter === 'text') return ['.txt', '.md', '.json', '.xml', '.csv', '.log'].includes(ext);
    if (typeFilter === 'other') return !['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.webp', '.txt', '.md'].includes(ext);
    return true;
  };

  // Filter backend search results on frontend
  const filteredResults = searchResults.filter(result => {
    const file = result.file || {};
    return matchesFileType(file, filters.fileType) &&
           matchesSize(file.sizeBytes, filters.size) &&
           matchesCategory(file.category, filters.category);
  });

  const hasActiveFilters = 
    filters.fileType !== 'all' || 
    filters.dateRange !== 'any' || 
    (filters.size && filters.size !== 'any') || 
    (filters.category && filters.category !== 'all') || 
    filters.folder !== 'all';

  // Format relevance score with friendly copy & badge variant
  const getRelevanceBadge = (score) => {
    let text = '';
    let variant = 'default';

    if (score >= 95) {
      text = `Very strong match · ${score}% match`;
      variant = 'success';
    } else if (score >= 90) {
      text = `Very relevant · ${score}% match`;
      variant = 'success';
    } else if (score >= 80) {
      text = `Relevant · ${score}% match`;
      variant = 'blue';
    } else if (score >= 60) {
      text = `Moderately relevant · ${score}% match`;
      variant = 'violet';
    } else if (score >= 40) {
      text = `Weakly relevant · ${score}% match`;
      variant = 'default';
    } else {
      text = `Unrelated · ${score}% match`;
      variant = 'default';
    }

    return { text, variant };
  };

  return (
    <div className="space-y-6 select-none max-w-5xl mx-auto">
      {/* Top Search & Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <button
          onClick={() => navigate('/search')}
          className="p-2.5 text-gray-400 hover:text-white rounded-xl glass-panel border-gray-800 transition-colors shrink-0 flex items-center justify-center cursor-pointer"
          title="Back to Search Setup"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (searchQuery.trim()) {
              executeSearch(searchQuery, filters, sortBy);
            }
          }}
          className="flex-1 relative"
        >
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="What are you looking for?"
            className="w-full pl-10 pr-28 py-2.5 text-sm rounded-xl glass-input text-white font-medium"
          />
          <Button type="submit" variant="primary" size="sm" className="absolute right-1.5 top-1/2 -translate-y-1/2">
            Search
          </Button>
        </form>

        {/* Sort Selector Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400 font-semibold">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="relevant">Most Relevant</option>
            <option value="newest">Newest Modified</option>
            <option value="oldest">Oldest Modified</option>
            <option value="largest">Largest File Size</option>
          </select>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3.5 rounded-xl glass-panel border-gray-800/80 text-xs space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-semibold text-gray-300 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-blue-400" />
              Refine Results:
            </span>

            {/* File Type Dropdown */}
            <select
              value={filters.fileType}
              onChange={(e) => setFilters({ ...filters, fileType: e.target.value })}
              className="bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1 text-gray-300 focus:outline-none font-medium"
            >
              <option value="all">Type: All</option>
              <option value="pdf">Type: PDF</option>
              <option value="doc">Type: Word</option>
              <option value="presentation">Type: PowerPoint</option>
              <option value="image">Type: Images</option>
              <option value="text">Type: Text</option>
              <option value="other">Type: Other</option>
            </select>

            {/* Date Modified Dropdown */}
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
              className="bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1 text-gray-300 focus:outline-none font-medium"
            >
              <option value="any">Date: Any time</option>
              <option value="today">Date: Today</option>
              <option value="week">Date: Last 7 Days</option>
              <option value="month">Date: Last 30 Days</option>
              <option value="year">Date: This Year</option>
            </select>

            {/* Size Dropdown */}
            <select
              value={filters.size || 'any'}
              onChange={(e) => setFilters({ ...filters, size: e.target.value })}
              className="bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1 text-gray-300 focus:outline-none font-medium"
            >
              <option value="any">Size: Any size</option>
              <option value="under_10mb">Size: Under 10 MB</option>
              <option value="under_100mb">Size: Under 100 MB</option>
              <option value="under_500mb">Size: Under 500 MB</option>
              <option value="under_1gb">Size: Under 1 GB</option>
              <option value="over_1gb">Size: 1 GB or larger</option>
            </select>

            {/* Category Dropdown */}
            <select
              value={filters.category || 'all'}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1 text-gray-300 focus:outline-none font-medium"
            >
              <option value="all">Category: All</option>
              <option value="education">Category: Education</option>
              <option value="work">Category: Work</option>
              <option value="personal">Category: Personal</option>
              <option value="projects">Category: Projects</option>
              <option value="certificates">Category: Certificates</option>
              <option value="finance">Category: Finance</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-blue-400 hover:text-blue-300 font-semibold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Results Header */}
      {searchQuery && (
        <div className="flex items-center justify-between pb-3 border-b border-gray-800/80">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Results for</span>
              <span className="text-blue-400 italic">"{searchQuery}"</span>
            </h2>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              Showing {filteredResults.length} of {searchTotal} matching file(s)
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {searchError && (
        <div className="p-6 rounded-2xl glass-panel border-red-500/30 bg-red-950/20 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <h3 className="text-sm font-semibold text-white">Unable to query local files</h3>
          <p className="text-xs text-gray-300 max-w-md mx-auto">
            Please check that the local server is running and try again.
          </p>
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => executeSearch(searchQuery)}>
            Retry Search
          </Button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isSearching && (
        <div className="space-y-4">
          <Skeleton height={150} />
          <Skeleton height={150} />
          <Skeleton height={150} />
        </div>
      )}

      {/* EMPTY STATE CASE 1: No query searched yet */}
      {!searchQuery && !isSearching && (
        <div className="glass-panel p-10 rounded-2xl text-center space-y-4 border-dashed border-gray-800">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto">
            <Search className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Find anything in your files</h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto mt-1 font-medium">
              Describe what you're looking for in your own words.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto pt-2">
            {[
              'Find my internship certificate',
              'Show my BFS notes',
              'Find project documentation'
            ].map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSearchQuery(prompt);
                  executeSearch(prompt);
                }}
                className="px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-xs text-blue-300 border border-gray-800 transition-colors cursor-pointer"
              >
                "{prompt}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* EMPTY STATE CASE 2: Search returned 0 results from backend */}
      {!isSearching && searchQuery && searchResults.length === 0 && !searchError && (
        <div className="glass-panel p-10 rounded-2xl text-center space-y-4 border border-gray-800">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
            <SearchX className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">We couldn't find a matching file.</h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto font-medium">
              No local files matched <span className="text-gray-200">"{searchQuery}"</span>.
            </p>
          </div>

          <div className="p-4 bg-gray-950/80 rounded-xl border border-gray-800 text-xs text-gray-300 max-w-md mx-auto text-left space-y-1.5 font-medium">
            <span className="font-semibold text-gray-200 block mb-1">Suggestions:</span>
            <p>• Try using different or simpler words</p>
            <p>• Search for a broader topic</p>
            <p>• Remove or reset your active search filters</p>
          </div>

          {hasActiveFilters && (
            <Button variant="secondary" size="sm" icon={RotateCcw} onClick={resetFilters}>
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* EMPTY STATE CASE 3: Search returned results, but frontend active filters hid all of them */}
      {!isSearching && searchQuery && searchResults.length > 0 && filteredResults.length === 0 && (
        <div className="glass-panel p-10 rounded-2xl text-center space-y-4 border border-gray-800">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto">
            <Filter className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No files match these filters.</h3>
            <p className="text-xs text-gray-300 max-w-md mx-auto font-medium">
              Some files matched <span className="text-blue-300 italic">"{searchQuery}"</span>, but they were hidden by your current filter choices.
            </p>
          </div>

          <Button variant="primary" size="md" icon={RotateCcw} onClick={resetFilters}>
            Clear Active Filters
          </Button>
        </div>
      )}

      {/* SEARCH RESULTS LIST */}
      {!isSearching && filteredResults.length > 0 && (
        <div className="space-y-4">
          {filteredResults.map((result, idx) => {
            const { file = {}, score = 0, matchedSnippet = '', aiExplanation = '' } = result;
            const relevance = getRelevanceBadge(score);

            return (
              <div
                key={file.id || idx}
                className="glass-panel p-5 rounded-2xl border-gray-800/80 hover:border-blue-500/40 transition-all space-y-3.5 group"
              >
                {/* Result Card Header Row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      {['.jpg', '.jpeg', '.png', '.webp'].includes((file.fileExtension || '').toLowerCase()) || file.category === 'image' ? (
                        <ImageIcon className="w-5 h-5" />
                      ) : (
                        <FileText className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3
                          onClick={() => setPreviewFile(file)}
                          className="font-bold text-base text-white hover:text-blue-300 cursor-pointer truncate transition-colors"
                          title={file.name}
                        >
                          {file.name}
                        </h3>

                        {/* Relevance Score Badge with Explanatory Tooltip */}
                        <div className="relative inline-block">
                          <span
                            onMouseEnter={() => setActiveTooltip(file.id || idx)}
                            onMouseLeave={() => setActiveTooltip(null)}
                            className="cursor-help"
                          >
                            <Badge variant={relevance.variant} size="sm" icon={Sparkles}>
                              {relevance.text}
                            </Badge>
                          </span>

                          {activeTooltip === (file.id || idx) && (
                            <div className="absolute left-0 bottom-full mb-2 w-64 p-2.5 bg-gray-950 border border-gray-700 rounded-xl text-[11px] text-gray-200 shadow-xl z-20 font-sans leading-snug animate-fadeIn">
                              <div className="flex items-center gap-1 font-semibold text-blue-300 mb-0.5">
                                <Info className="w-3.5 h-3.5" />
                                <span>Relevance Score</span>
                              </div>
                              This score shows how closely this file matches what you searched for.
                            </div>
                          )}
                        </div>

                        {file.category && (
                          <Badge variant="default" size="sm">
                            {file.category.toUpperCase()}
                          </Badge>
                        )}
                      </div>

                      {/* File Path */}
                      <div className="flex items-center gap-2 text-xs text-gray-400 font-mono min-w-0">
                        <Folder className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span className="truncate max-w-full" title={file.path}>
                          {file.path}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Matched Snippet / "Why This Matches" */}
                {(matchedSnippet || aiExplanation) && (
                  <div className="p-3.5 rounded-xl bg-gray-950/70 border border-gray-800/80 space-y-1.5 text-xs">
                    <span className="font-semibold text-purple-300 flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5 text-purple-400" />
                      Why this matches:
                    </span>
                    <p className="text-gray-300 font-sans leading-relaxed italic">
                      "{matchedSnippet || aiExplanation}"
                    </p>
                  </div>
                )}

                {/* Result Bottom Info & Action Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-gray-800/60 text-xs">
                  <div className="flex items-center gap-4 text-gray-400 font-medium">
                    {file.sizeBytes > 0 && (
                      <span>Size: {(file.sizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                    )}
                    {file.modifiedAt && (
                      <span>Modified: {new Date(file.modifiedAt).toLocaleDateString()}</span>
                    )}
                  </div>

                  {/* Explicit Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Eye}
                      onClick={() => setPreviewFile(file)}
                    >
                      Preview
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={FolderOpen}
                      onClick={() => handleLocateNative(file.path)}
                    >
                      Show in Folder
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={FolderOutput}
                      onClick={handleOrganizeAction}
                    >
                      Organize
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={ExternalLink}
                      onClick={() => handleOpenNative(file.path, file)}
                    >
                      Open
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

