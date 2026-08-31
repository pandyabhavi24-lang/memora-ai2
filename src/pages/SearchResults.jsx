import React, { useEffect } from 'react';
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
  SlidersHorizontal,
  RefreshCw,
  AlertTriangle,
  Folder
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Skeleton } from '../components/common/Skeleton';
import { EmptyState } from '../components/common/EmptyState';
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
    setSortBy
  } = useApp();

  useEffect(() => {
    if (searchQuery) {
      executeSearch(searchQuery, filters, sortBy);
    }
  }, [searchQuery, filters, sortBy]);

  const handleOpenNative = (filePath) => {
    apiService.openFile(filePath);
  };

  const handleLocateNative = (filePath) => {
    apiService.locateFile(filePath);
  };

  const resetFilters = () => {
    setFilters({ fileType: 'all', dateRange: 'any', folder: 'all' });
    setSortBy('relevant');
  };

  return (
    <div className="space-y-6 select-none">
      {/* Top Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <button
          onClick={() => navigate('/search')}
          className="p-2.5 text-gray-400 hover:text-white rounded-xl glass-panel border-gray-800 transition-colors shrink-0 flex items-center justify-center"
          title="Back to Search Setup"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            executeSearch(searchQuery, filters, sortBy);
          }}
          className="flex-1 relative"
        >
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memories..."
            className="w-full pl-10 pr-24 py-2.5 text-sm rounded-xl glass-input text-white"
          />
          <Button type="submit" variant="primary" size="sm" className="absolute right-1.5 top-1/2 -translate-y-1/2">
            Search
          </Button>
        </form>

        {/* Sort Selector Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400 font-medium">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          >
            <option value="relevant">Most Relevant</option>
            <option value="newest">Newest Modified</option>
            <option value="oldest">Oldest Modified</option>
            <option value="largest">Largest File Size</option>
          </select>
        </div>
      </div>

      {/* Secondary Filter Ribbon */}
      <div className="flex items-center justify-between p-3 rounded-xl glass-panel border-gray-800/80 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-semibold text-gray-400 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            Active Filters:
          </span>

          <select
            value={filters.fileType}
            onChange={(e) => setFilters({ ...filters, fileType: e.target.value })}
            className="bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1 text-gray-300 focus:outline-none"
          >
            <option value="all">Type: All</option>
            <option value="pdf">Type: PDF</option>
            <option value="doc">Type: Word</option>
            <option value="image">Type: Images/OCR</option>
            <option value="presentation">Type: Presentation</option>
            <option value="spreadsheet">Type: Spreadsheet</option>
          </select>

          <select
            value={filters.dateRange}
            onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
            className="bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1 text-gray-300 focus:outline-none"
          >
            <option value="any">Date: Any time</option>
            <option value="today">Date: Today</option>
            <option value="week">Date: This week</option>
            <option value="month">Date: This month</option>
            <option value="year">Date: This year</option>
          </select>

          <select
            value={filters.folder}
            onChange={(e) => setFilters({ ...filters, folder: e.target.value })}
            className="bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1 text-gray-300 focus:outline-none"
          >
            <option value="all">Folder: All</option>
            <option value="Documents">Folder: Documents</option>
            <option value="Downloads">Folder: Downloads</option>
            <option value="Desktop">Folder: Desktop</option>
            <option value="Pictures">Folder: Pictures</option>
            <option value="College">Folder: College</option>
            <option value="Work">Folder: Work</option>
          </select>
        </div>

        {(filters.fileType !== 'all' || filters.dateRange !== 'any' || filters.folder !== 'all' || sortBy !== 'relevant') && (
          <button
            onClick={resetFilters}
            className="text-blue-400 hover:text-blue-300 font-medium transition-colors ml-2"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Results Subheader & Statistics */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-800/80">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Semantic Results for</span>
            <span className="text-blue-400 italic">"{searchQuery}"</span>
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-0.5">
            Found {searchTotal} relevant match(es) in {searchExecutionTime} ms (Local Vector Index)
          </p>
        </div>
      </div>

      {/* Error State View */}
      {searchError && (
        <div className="p-6 rounded-2xl glass-panel border-red-500/30 bg-red-950/20 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <h3 className="text-sm font-semibold text-white">Search System Warning</h3>
          <p className="text-xs text-gray-300 max-w-md mx-auto">{searchError}</p>
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => executeSearch(searchQuery)}>
            Retry Query
          </Button>
        </div>
      )}

      {/* Search Results Stream */}
      {isSearching ? (
        <div className="space-y-4">
          <Skeleton height={140} />
          <Skeleton height={140} />
          <Skeleton height={140} />
        </div>
      ) : searchResults.length === 0 && !searchError ? (
        <EmptyState
          title="No semantic matches found"
          description={`No indexed local files matched "${searchQuery}" with current filters.`}
          actionLabel="Clear Filters & Retry"
          onAction={resetFilters}
        />
      ) : (
        <div className="space-y-4">
          {searchResults.map((result) => {
            const { file, score, matchedSnippet, aiExplanation } = result;

            return (
              <div
                key={file.id}
                className="glass-panel p-5 rounded-2xl border-gray-800/80 hover:border-blue-500/40 transition-all space-y-3.5 group"
              >
                {/* Result Top Row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      {file.category === 'image' ? (
                        <ImageIcon className="w-5 h-5" />
                      ) : (
                        <FileText className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap mb-1">
                        <h3
                          onClick={() => setPreviewFile(file)}
                          className="font-bold text-base text-gray-100 hover:text-blue-300 cursor-pointer truncate transition-colors"
                        >
                          {file.name}
                        </h3>
                        <Badge variant="blue" size="sm">
                          {file.category.toUpperCase()}
                        </Badge>
                        <Badge variant="success" size="sm" icon={Sparkles}>
                          {score}% Relevance
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-400 font-mono truncate">
                        <Folder className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span className="truncate">{file.path}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Matched Content Snippet */}
                {matchedSnippet && (
                  <div className="p-3.5 rounded-xl bg-gray-950/70 border border-gray-800/80 text-xs text-gray-300 font-sans leading-relaxed">
                    <span className="text-gray-500 font-semibold mr-1.5">[Matching Content]:</span>
                    "{matchedSnippet}"
                  </div>
                )}

                {/* "Why This Matched" AI Explanation */}
                <div className="flex items-start gap-2.5 text-xs text-purple-200 bg-purple-950/25 p-3 rounded-xl border border-purple-500/25">
                  <Brain className="w-4 h-4 shrink-0 text-purple-400 mt-0.5" />
                  <div>
                    <strong className="text-purple-300 font-semibold block mb-0.5">Why this matched:</strong>
                    <span>"{aiExplanation}"</span>
                  </div>
                </div>

                {/* Result Bottom Action Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-800/60 text-xs">
                  <div className="flex items-center gap-4 text-gray-400 font-mono">
                    <span>Size: {(file.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
                    <span>Modified: {new Date(file.modifiedAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-2">
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
                      Locate
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={ExternalLink}
                      onClick={() => handleOpenNative(file.path)}
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
