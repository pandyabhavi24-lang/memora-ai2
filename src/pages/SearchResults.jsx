import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  SearchX,
  Layers,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  X,
  Check,
  Tag
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Skeleton } from '../components/common/Skeleton';
import { apiService } from '../services/apiService';

// Smart Portal Popover Wrapper Component with Fixed Viewport Positioning & Collision Detection
const FilterPopover = ({ name, title, activeCount = 0, activeLabel = '', isOpen, onToggle, widthClass = 'w-56', children }) => {
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, openUpward: false });
  const triggerRef = useRef(null);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < 280;

      let popWidth = 224; // default w-56
      if (widthClass.includes('w-64')) popWidth = 256;
      if (widthClass.includes('w-72')) popWidth = 288;
      if (widthClass.includes('w-48')) popWidth = 192;

      let leftPos = rect.left;
      if (leftPos + popWidth > window.innerWidth - 12) {
        leftPos = Math.max(12, window.innerWidth - popWidth - 12);
      }

      setPopoverPos({
        top: openUpward ? undefined : rect.bottom + 6,
        bottom: openUpward ? window.innerHeight - rect.top + 6 : undefined,
        left: leftPos,
        openUpward
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => {
        updatePosition();
      };
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen]);

  const isActive = activeCount > 0 || (activeLabel && activeLabel !== 'all' && activeLabel !== 'any');

  return (
    <div className="relative inline-block" ref={triggerRef}>
      <button
        type="button"
        onClick={() => onToggle(name)}
        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
          isActive
            ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 font-bold shadow-sm'
            : 'bg-gray-900 text-gray-300 border-gray-800 hover:bg-gray-800'
        }`}
      >
        <span>
          {title}
          {activeCount > 0 ? ` • ${activeCount}` : activeLabel ? `: ${activeLabel} ✓` : ''}
        </span>
        {isOpen ? (
          <ChevronUp className="w-3.5 h-3.5 text-blue-400 font-bold" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        )}
      </button>

      {isOpen &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: popoverPos.top !== undefined ? `${popoverPos.top}px` : 'auto',
              bottom: popoverPos.bottom !== undefined ? `${popoverPos.bottom}px` : 'auto',
              left: `${popoverPos.left}px`,
              zIndex: 9999
            }}
            className={`${widthClass} p-2 bg-gray-950/95 backdrop-blur-md border border-gray-800 rounded-xl shadow-2xl text-xs space-y-1.5 animate-fadeIn`}
          >
            {children}
          </div>,
          document.body
        )}
    </div>
  );
};

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
  const [searchMode, setSearchMode] = useState('semantic'); // 'semantic' | 'exact'
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showFullPaths, setShowFullPaths] = useState({});

  // Active popover menu state: null | 'type' | 'date' | 'size' | 'category' | 'location' | 'labels' | 'relevance' | 'more'
  const [openPopover, setOpenPopover] = useState(null);
  const popoverContainerRef = useRef(null);

  // SEPARATE LOCAL SEARCH INPUT STATES FOR FILTER POPOVERS
  const [categorySearchInput, setCategorySearchInput] = useState('');
  const [labelSearchInput, setLabelSearchInput] = useState('');
  const [locationSearchInput, setLocationSearchInput] = useState('');

  useEffect(() => {
    if (searchQuery) {
      executeSearch(searchQuery, filters, sortBy);
    }
  }, [searchQuery, filters, sortBy]);

  // Click outside and Escape key handler for filter popovers
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverContainerRef.current && !popoverContainerRef.current.contains(event.target)) {
        setOpenPopover(null);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpenPopover(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

  const togglePopover = (name) => {
    setOpenPopover(prev => {
      const next = prev === name ? null : name;
      // ALWAYS reset internal popover search fields when toggling popovers so they start completely empty
      setCategorySearchInput('');
      setLabelSearchInput('');
      setLocationSearchInput('');
      return next;
    });
  };

  const resetFilters = () => {
    setFilters({
      fileType: 'all',
      dateRange: 'any',
      size: 'any',
      category: 'all',
      location: 'all',
      labels: [], // array of selected labels or 'all'
      relevance: 'any'
    });
    setCategorySearchInput('');
    setLabelSearchInput('');
    setLocationSearchInput('');
    setOpenPopover(null);
  };

  const removeSingleFilter = (filterKey, defaultValue = 'all') => {
    if (filterKey === 'labels') {
      setFilters(prev => ({ ...prev, labels: [] }));
    } else {
      setFilters(prev => ({ ...prev, [filterKey]: defaultValue }));
    }
  };

  const removeIndividualLabel = (lblToRemove) => {
    setFilters(prev => {
      const current = Array.isArray(prev.labels) ? prev.labels : [];
      const updated = current.filter(l => l.toLowerCase() !== lblToRemove.toLowerCase());
      return { ...prev, labels: updated };
    });
  };

  const toggleSelectLabel = (lbl) => {
    setFilters(prev => {
      const current = Array.isArray(prev.labels) ? prev.labels : (prev.labels && prev.labels !== 'all' ? [prev.labels] : []);
      const exists = current.some(l => l.toLowerCase() === lbl.toLowerCase());
      let updated = [];
      if (exists) {
        updated = current.filter(l => l.toLowerCase() !== lbl.toLowerCase());
      } else {
        updated = [...current, lbl];
      }
      return { ...prev, labels: updated };
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.fileType && filters.fileType !== 'all') count++;
    if (filters.dateRange && filters.dateRange !== 'any') count++;
    if (filters.size && filters.size !== 'any') count++;
    if (filters.category && filters.category !== 'all') count++;
    if (filters.location && filters.location !== 'all') count++;
    if (Array.isArray(filters.labels) && filters.labels.length > 0) {
      count += filters.labels.length;
    } else if (typeof filters.labels === 'string' && filters.labels !== 'all' && filters.labels !== '') {
      count++;
    }
    if (filters.relevance && filters.relevance !== 'any') count++;
    return count;
  };

  const getSecondaryFiltersCount = () => {
    let count = 0;
    if (filters.size && filters.size !== 'any') count++;
    if (filters.location && filters.location !== 'all') count++;
    if (Array.isArray(filters.labels) && filters.labels.length > 0) {
      count += filters.labels.length;
    } else if (typeof filters.labels === 'string' && filters.labels !== 'all' && filters.labels !== '') {
      count++;
    }
    if (filters.relevance && filters.relevance !== 'any') count++;
    return count;
  };

  // Helper for size-based filtering
  const matchesSize = (sizeBytes, sizeFilter) => {
    if (!sizeFilter || sizeFilter === 'any') return true;
    const mb = sizeBytes / (1024 * 1024);
    if (sizeFilter === 'under_1mb') return mb < 1;
    if (sizeFilter === '1_10mb') return mb >= 1 && mb <= 10;
    if (sizeFilter === '10_100mb') return mb >= 10 && mb <= 100;
    if (sizeFilter === '100_500mb') return mb >= 100 && mb <= 500;
    if (sizeFilter === '500mb_1gb') return mb >= 500 && mb <= 1024;
    if (sizeFilter === 'over_1gb') return mb >= 1024;
    return true;
  };

  // Helper for category-based filtering
  const matchesCategory = (itemCategory, categoryFilter) => {
    if (!categoryFilter || categoryFilter === 'all') return true;
    if (!itemCategory) return false;
    return itemCategory.toLowerCase().includes(categoryFilter.toLowerCase());
  };

  // Helper for location-based filtering
  const matchesLocation = (filePath, locationFilter) => {
    if (!locationFilter || locationFilter === 'all') return true;
    if (!filePath) return false;
    return filePath.toLowerCase().includes(locationFilter.toLowerCase());
  };

  // Helper for label-based filtering (REAL label matching against file metadata/name/path/text)
  const matchesLabels = (file, labelFilters) => {
    if (!labelFilters || labelFilters === 'all' || (Array.isArray(labelFilters) && labelFilters.length === 0)) return true;
    const labelsList = Array.isArray(labelFilters) ? labelFilters : [labelFilters];
    
    const textContent = (
      (file.category || '') + ' ' +
      (file.name || '') + ' ' +
      (file.path || '') + ' ' +
      (file.fileExtension || file.extension || '')
    ).toLowerCase();

    // Must match ALL selected labels
    return labelsList.every(lbl => textContent.includes(lbl.toLowerCase()));
  };

  // Helper for relevance threshold filtering
  const matchesRelevance = (score, relevanceFilter) => {
    if (!relevanceFilter || relevanceFilter === 'any') return true;
    if (relevanceFilter === 'min_50') return score >= 50;
    if (relevanceFilter === 'min_60') return score >= 60;
    if (relevanceFilter === 'min_70') return score >= 70;
    if (relevanceFilter === 'min_80') return score >= 80;
    if (relevanceFilter === 'min_90') return score >= 90;
    return true;
  };

  // Helper for file-type filtering
  const matchesFileType = (file, typeFilter) => {
    if (!typeFilter || typeFilter === 'all') return true;
    const ext = (file.fileExtension || file.extension || '').toLowerCase();
    const cat = (file.category || '').toLowerCase();

    if (typeFilter === 'pdf') return ext === '.pdf' || cat === 'pdf';
    if (typeFilter === 'doc') return ['.doc', '.docx'].includes(ext) || cat === 'doc' || cat === 'docx';
    if (typeFilter === 'presentation') return ['.ppt', '.pptx'].includes(ext);
    if (typeFilter === 'excel') return ['.xls', '.xlsx', '.csv'].includes(ext);
    if (typeFilter === 'image') return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) || cat === 'image';
    if (typeFilter === 'text') return ['.txt', '.md', '.json', '.xml', '.log'].includes(ext);
    if (typeFilter === 'other') return !['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.webp', '.txt', '.md'].includes(ext);
    return true;
  };

  // Helper for date filtering
  const matchesDateRange = (dateStr, dateFilter) => {
    if (!dateFilter || dateFilter === 'any') return true;
    if (!dateStr) return false;
    const fileTime = new Date(dateStr).getTime();
    if (isNaN(fileTime)) return true;
    const now = Date.now();
    const diffDays = (now - fileTime) / (1000 * 60 * 60 * 24);

    if (dateFilter === 'today') return diffDays <= 1;
    if (dateFilter === 'yesterday') return diffDays <= 2;
    if (dateFilter === 'week') return diffDays <= 7;
    if (dateFilter === 'month') return diffDays <= 30;
    if (dateFilter === 'month3') return diffDays <= 90;
    if (dateFilter === 'year') return diffDays <= 365;
    return true;
  };

  // Filter backend search results on frontend
  const filteredResults = searchResults.filter(result => {
    const file = result.file || {};
    const matchesType = matchesFileType(file, filters.fileType);
    const matchesDate = matchesDateRange(file.modifiedAt, filters.dateRange);
    const matchesSz = matchesSize(file.sizeBytes, filters.size);
    const matchesCat = matchesCategory(file.category, filters.category);
    const matchesLoc = matchesLocation(file.path, filters.location);
    const matchesLbl = matchesLabels(file, filters.labels);
    const matchesRel = matchesRelevance(result.score || 0, filters.relevance);

    if (searchMode === 'exact' && searchQuery) {
      const qWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 1);
      const textContent = ((file.name || '') + ' ' + (result.matchedSnippet || '') + ' ' + (result.aiExplanation || '')).toLowerCase();
      const hasExactWords = qWords.every(w => textContent.includes(w));
      return matchesType && matchesDate && matchesSz && matchesCat && matchesLoc && matchesLbl && matchesRel && hasExactWords;
    }

    return matchesType && matchesDate && matchesSz && matchesCat && matchesLoc && matchesLbl && matchesRel;
  });

  const activeFiltersCount = getActiveFiltersCount();
  const secondaryFiltersCount = getSecondaryFiltersCount();

  // Format relevance score with friendly copy & badge variant
  const getRelevanceBadge = (score) => {
    let label = '';
    let variant = 'default';
    let bullets = [];

    if (score >= 90) {
      label = 'Very Strong Match';
      variant = 'success';
      bullets = [
        'Query meaning is highly similar to document content',
        'Related concepts found in indexed chunks',
        'High contextual overlap detected by AI model'
      ];
    } else if (score >= 75) {
      label = 'Strong Match';
      variant = 'success';
      bullets = [
        'Important matching concepts appear in indexed chunks',
        'Strong semantic alignment with searched topics'
      ];
    } else if (score >= 50) {
      label = 'Moderate Match';
      variant = 'violet';
      bullets = [
        'Some query concepts are related to the document',
        'Semantically related terms contributed to score'
      ];
    } else if (score >= 30) {
      label = 'Partial Match';
      variant = 'blue';
      bullets = [
        'Minor conceptual overlap with your query',
        'Lower similarity score across document chunks'
      ];
    } else {
      label = 'Weak Match';
      variant = 'default';
      bullets = [
        'Low semantic similarity to search query'
      ];
    }

    return { label, text: `${label} · ${score}% Relevance`, variant, bullets };
  };

  // Format date helper
  const formatDateFormatted = (dateStr) => {
    if (!dateStr) return 'Unknown date';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  };

  // Helper to extract folder-only path (strictly excluding filename!)
  const getFolderOnlyInfo = (filePath, fileName) => {
    if (!filePath) return { folderPath: '', breadcrumbs: [] };

    let cleanedPath = filePath;
    if (fileName && cleanedPath.toLowerCase().endsWith(fileName.toLowerCase())) {
      cleanedPath = cleanedPath.substring(0, cleanedPath.length - fileName.length);
    }

    cleanedPath = cleanedPath.replace(/[/\\]+$/, '');
    const parts = cleanedPath.split(/[/\\]/).filter(Boolean);
    const breadcrumbs = parts.length > 4 ? parts.slice(parts.length - 3) : parts;
    return { folderPath: cleanedPath, breadcrumbs };
  };

  // Group search results by filename to detect duplicate physical locations
  const groupedResults = filteredResults.reduce((acc, result) => {
    const fnameKey = (result.file?.name || 'Untitled').toLowerCase();
    if (!acc[fnameKey]) {
      acc[fnameKey] = {
        filename: result.file?.name || 'Untitled',
        results: []
      };
    }
    acc[fnameKey].results.push(result);
    return acc;
  }, {});

  const groupedList = Object.values(groupedResults);

  const toggleGroupExpand = (fnameKey) => {
    setExpandedGroups(prev => ({ ...prev, [fnameKey]: !prev[fnameKey] }));
  };

  const toggleFullPathShow = (fileId) => {
    setShowFullPaths(prev => ({ ...prev, [fileId]: !prev[fileId] }));
  };

  // Dynamically compile REAL labels from indexed results & standard categories
  const BASE_LABELS = ['C', 'Coding', 'College', 'Certificate', 'ed', 'Education', 'Internship', 'Project', 'Personal', 'Work', 'Notes', 'Assignments'];
  const dynamicLabels = Array.from(new Set([
    ...BASE_LABELS,
    ...searchResults.map(r => r.file?.category).filter(Boolean),
    ...searchResults.map(r => r.file?.extension?.replace('.', '')).filter(Boolean)
  ]));

  // Lists for Popovers filtered strictly by local popover search inputs
  const categoryItems = [
    { id: 'all', label: 'All Categories' },
    { id: 'education', label: 'Education' },
    { id: 'work', label: 'Work' },
    { id: 'projects', label: 'Projects' },
    { id: 'personal', label: 'Personal' },
    { id: 'certificates', label: 'Certificates' },
    { id: 'finance', label: 'Finance' }
  ].filter(i => i.label.toLowerCase().includes(categorySearchInput.toLowerCase()));

  const labelItems = dynamicLabels
    .map(l => ({ id: l.toLowerCase(), label: l }))
    .filter(i => i.label.toLowerCase().includes(labelSearchInput.toLowerCase()));

  const locationItems = [
    { id: 'all', label: 'All Locations' },
    { id: 'documents', label: '📁 Documents' },
    { id: 'downloads', label: '📥 Downloads' },
    { id: 'desktop', label: '💻 Desktop' },
    { id: 'pictures', label: '🖼 Pictures' }
  ].filter(i => i.label.toLowerCase().includes(locationSearchInput.toLowerCase()));

  const activeLabelList = Array.isArray(filters.labels)
    ? filters.labels
    : (filters.labels && filters.labels !== 'all' ? [filters.labels] : []);

  return (
    <div className="space-y-4 select-none max-w-5xl mx-auto" ref={popoverContainerRef}>
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

        {/* Search Mode Toggle (Semantic vs Exact) */}
        <div className="flex items-center p-1 rounded-xl bg-gray-900 border border-gray-800 shrink-0">
          <button
            type="button"
            onClick={() => setSearchMode('semantic')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              searchMode === 'semantic'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title="Semantic Mode: Finds conceptually related files even if exact words differ"
          >
            <Brain className="w-3.5 h-3.5 text-purple-300" />
            <span>Semantic</span>
          </button>
          <button
            type="button"
            onClick={() => setSearchMode('exact')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              searchMode === 'exact'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title="Exact Mode: Prioritizes files where the exact search phrase appears"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
            <span>Exact Keyword</span>
          </button>
        </div>

        {/* Sort Selector Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400 font-semibold">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="relevant">Most Relevant</option>
            <option value="newest">Newest Modified</option>
            <option value="oldest">Oldest Modified</option>
            <option value="largest">Largest File Size</option>
          </select>
        </div>
      </div>

      {/* COMPACT FILTER TOOLBAR WITH QUICK FILTERS + MORE FILTERS */}
      <div className="p-3 rounded-2xl glass-panel border-gray-800/80 space-y-2.5 relative">
        <div className="flex items-center justify-between flex-wrap gap-2">
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filters Counter Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 text-xs font-bold text-gray-200">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-extrabold shadow-sm">
                  ({activeFiltersCount})
                </span>
              )}
            </div>

            {/* QUICK FILTER 1. TYPE POPOVER */}
            <FilterPopover
              name="type"
              title="Type"
              activeValue={filters.fileType}
              displayActiveValue={filters.fileType.toUpperCase()}
              isOpen={openPopover === 'type'}
              onToggle={togglePopover}
              widthClass="w-48"
            >
              <div className="text-[10px] font-bold text-gray-400 px-2 py-1 uppercase tracking-wider">File Type</div>
              {[
                { id: 'all', label: 'All Types' },
                { id: 'pdf', label: '📄 PDF' },
                { id: 'doc', label: '📝 Word' },
                { id: 'presentation', label: '📊 PowerPoint' },
                { id: 'excel', label: '📈 Excel' },
                { id: 'image', label: '🖼 Images' },
                { id: 'text', label: '📃 Text' },
                { id: 'other', label: '📁 Other' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setFilters({ ...filters, fileType: item.id });
                    setOpenPopover(null);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium transition-colors cursor-pointer ${
                    filters.fileType === item.id ? 'bg-blue-600 text-white font-bold' : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span>{item.label}</span>
                  {filters.fileType === item.id && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </FilterPopover>

            {/* QUICK FILTER 2. DATE POPOVER */}
            <FilterPopover
              name="date"
              title="Date"
              activeValue={filters.dateRange}
              isOpen={openPopover === 'date'}
              onToggle={togglePopover}
              widthClass="w-48"
            >
              <div className="text-[10px] font-bold text-gray-400 px-2 py-1 uppercase tracking-wider">Modified Date</div>
              {[
                { id: 'any', label: 'Any time' },
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'week', label: 'Last 7 days' },
                { id: 'month', label: 'Last 30 days' },
                { id: 'month3', label: 'Last 3 months' },
                { id: 'year', label: 'This year' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setFilters({ ...filters, dateRange: item.id });
                    setOpenPopover(null);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium transition-colors cursor-pointer ${
                    filters.dateRange === item.id ? 'bg-purple-600 text-white font-bold' : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span>{item.label}</span>
                  {filters.dateRange === item.id && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </FilterPopover>

            {/* QUICK FILTER 3. CATEGORY POPOVER (WITH SEPARATE SEARCH INPUT) */}
            <FilterPopover
              name="category"
              title="Category"
              activeValue={filters.category}
              isOpen={openPopover === 'category'}
              onToggle={togglePopover}
              widthClass="w-64"
            >
              <div className="text-[10px] font-bold text-gray-400 px-2 py-1 uppercase tracking-wider">Category</div>
              
              {/* Category Search Input (Isolated Local State) */}
              <div className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  name="categoryFilterSearchInput"
                  autoComplete="off"
                  value={categorySearchInput}
                  onChange={(e) => setCategorySearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                  placeholder="Search categories..."
                  className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5 pr-0.5">
                {categoryItems.length > 0 ? (
                  categoryItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setFilters({ ...filters, category: item.id });
                        setOpenPopover(null);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium transition-colors cursor-pointer ${
                        filters.category === item.id ? 'bg-emerald-600 text-white font-bold' : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <span>{item.label}</span>
                      {filters.category === item.id && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))
                ) : (
                  <div className="px-2 py-2 text-[11px] text-gray-500 italic">No matching categories</div>
                )}
              </div>
            </FilterPopover>

            {/* MORE FILTERS POPOVER (SHOWING ACTIVE SECONDARY COUNT WHEN SECONDARY FILTERS ARE SELECTED) */}
            <FilterPopover
              name="more"
              title="More Filters"
              activeCount={secondaryFiltersCount}
              isOpen={openPopover === 'more'}
              onToggle={togglePopover}
              widthClass="w-72"
            >
              <div className="text-[10px] font-bold text-gray-400 px-2 py-1 uppercase tracking-wider border-b border-gray-800 pb-1">
                More Search Filters
              </div>

              <div className="space-y-3 pt-1 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                {/* Size Subsection */}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-amber-400 block px-1">File Size:</span>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { id: 'any', label: 'Any size' },
                      { id: 'under_1mb', label: '< 1 MB' },
                      { id: '1_10mb', label: '1–10 MB' },
                      { id: '10_100mb', label: '10–100 MB' },
                      { id: '100_500mb', label: '100–500 MB' },
                      { id: 'over_1gb', label: '> 1 GB' }
                    ].map(s => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setFilters({ ...filters, size: s.id });
                          setOpenPopover(null);
                        }}
                        className={`px-2 py-1 rounded text-[11px] font-medium text-left truncate cursor-pointer ${
                          filters.size === s.id ? 'bg-amber-600 text-white font-bold' : 'text-gray-300 hover:bg-gray-800'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Location Subsection */}
                <div className="space-y-1 border-t border-gray-800/60 pt-2">
                  <span className="text-[11px] font-bold text-blue-400 block px-1">Physical Location:</span>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { id: 'all', label: 'All Locations' },
                      { id: 'documents', label: '📁 Documents' },
                      { id: 'downloads', label: '📥 Downloads' },
                      { id: 'desktop', label: '💻 Desktop' },
                      { id: 'pictures', label: '🖼 Pictures' }
                    ].map(l => (
                      <button
                        key={l.id}
                        onClick={() => {
                          setFilters({ ...filters, location: l.id });
                          setOpenPopover(null);
                        }}
                        className={`px-2 py-1 rounded text-[11px] font-medium text-left truncate cursor-pointer ${
                          filters.location === l.id ? 'bg-blue-600 text-white font-bold' : 'text-gray-300 hover:bg-gray-800'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Labels Subsection */}
                <div className="space-y-1 border-t border-gray-800/60 pt-2">
                  <span className="text-[11px] font-bold text-purple-400 block px-1">Memora Labels:</span>
                  <div className="grid grid-cols-2 gap-1">
                    {BASE_LABELS.slice(0, 6).map(lbl => {
                      const isSelected = activeLabelList.some(l => l.toLowerCase() === lbl.toLowerCase());
                      return (
                        <button
                          key={lbl}
                          onClick={() => {
                            toggleSelectLabel(lbl);
                          }}
                          className={`px-2 py-1 rounded text-[11px] font-medium text-left truncate cursor-pointer flex items-center justify-between ${
                            isSelected ? 'bg-purple-600 text-white font-bold' : 'text-gray-300 hover:bg-gray-800'
                          }`}
                        >
                          <span>🏷 {lbl}</span>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Relevance Subsection */}
                <div className="space-y-1 border-t border-gray-800/60 pt-2">
                  <span className="text-[11px] font-bold text-emerald-400 block px-1">Min Relevance:</span>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { id: 'any', label: 'Any relevance' },
                      { id: 'min_50', label: '> 50% match' },
                      { id: 'min_70', label: '> 70% match' },
                      { id: 'min_90', label: '> 90% match' }
                    ].map(r => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setFilters({ ...filters, relevance: r.id });
                          setOpenPopover(null);
                        }}
                        className={`px-2 py-1 rounded text-[11px] font-medium text-left truncate cursor-pointer ${
                          filters.relevance === r.id ? 'bg-emerald-600 text-white font-bold' : 'text-gray-300 hover:bg-gray-800'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </FilterPopover>

            {/* DIRECT QUICK-ACCESS POPOVER BUTTONS */}
            <FilterPopover
              name="size"
              title="Size"
              activeValue={filters.size}
              displayActiveValue={filters.size ? filters.size.replace('_', ' ') : ''}
              isOpen={openPopover === 'size'}
              onToggle={togglePopover}
              widthClass="w-52"
            >
              <div className="text-[10px] font-bold text-gray-400 px-2 py-1 uppercase tracking-wider">File Size</div>
              {[
                { id: 'any', label: 'Any size' },
                { id: 'under_1mb', label: '< 1 MB' },
                { id: '1_10mb', label: '1–10 MB' },
                { id: '10_100mb', label: '10–100 MB' },
                { id: '100_500mb', label: '100–500 MB' },
                { id: '500mb_1gb', label: '500 MB–1 GB' },
                { id: 'over_1gb', label: '> 1 GB' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setFilters({ ...filters, size: item.id });
                    setOpenPopover(null);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium transition-colors cursor-pointer ${
                    filters.size === item.id ? 'bg-amber-600 text-white font-bold' : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span>{item.label}</span>
                  {filters.size === item.id && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </FilterPopover>

            <FilterPopover
              name="location"
              title="Location"
              activeValue={filters.location}
              isOpen={openPopover === 'location'}
              onToggle={togglePopover}
              widthClass="w-72"
            >
              <div className="text-[10px] font-bold text-gray-400 px-2 py-1 uppercase tracking-wider">Physical Location</div>
              
              <div className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  name="locationFilterSearchInput"
                  autoComplete="off"
                  value={locationSearchInput}
                  onChange={(e) => setLocationSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                  placeholder="Search locations..."
                  className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5 pr-0.5">
                {locationItems.length > 0 ? (
                  locationItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setFilters({ ...filters, location: item.id });
                        setOpenPopover(null);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium transition-colors cursor-pointer ${
                        filters.location === item.id ? 'bg-blue-600 text-white font-bold' : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <span>{item.label}</span>
                      {filters.location === item.id && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))
                ) : (
                  <div className="px-2 py-2 text-[11px] text-gray-500 italic">No matching locations</div>
                )}
              </div>
            </FilterPopover>

            {/* LABELS POPOVER WITH MULTI-SELECT & ISOLATED POPOVER SEARCH INPUT */}
            <FilterPopover
              name="labels"
              title="Labels"
              activeCount={activeLabelList.length}
              isOpen={openPopover === 'labels'}
              onToggle={togglePopover}
              widthClass="w-72"
            >
              <div className="text-[10px] font-bold text-gray-400 px-2 py-1 uppercase tracking-wider">Memora Labels</div>
              
              {/* Isolated Label Search Input */}
              <div className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  name="labelFilterSearchInput"
                  autoComplete="off"
                  value={labelSearchInput}
                  onChange={(e) => setLabelSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                  placeholder="Search labels..."
                  className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>

              <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5 pr-0.5">
                {labelItems.length > 0 ? (
                  labelItems.map((item) => {
                    const isChecked = activeLabelList.some(l => l.toLowerCase() === item.id.toLowerCase());
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectLabel(item.label);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium transition-colors cursor-pointer ${
                          isChecked ? 'bg-purple-600 text-white font-bold' : 'text-gray-300 hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by button onClick
                            className="rounded border-gray-700 bg-gray-900 text-purple-500 focus:ring-purple-500/30 cursor-pointer"
                          />
                          <span>{item.label}</span>
                        </div>
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-2 py-2 text-[11px] text-gray-500 italic">No matching labels found</div>
                )}
              </div>
            </FilterPopover>

            <FilterPopover
              name="relevance"
              title="Relevance"
              activeValue={filters.relevance}
              displayActiveValue={filters.relevance && filters.relevance !== 'any' ? `>${filters.relevance.replace('min_', '')}%` : ''}
              isOpen={openPopover === 'relevance'}
              onToggle={togglePopover}
              widthClass="w-52"
            >
              <div className="text-[10px] font-bold text-gray-400 px-2 py-1 uppercase tracking-wider">Min Relevance Score</div>
              {[
                { id: 'any', label: 'Any relevance' },
                { id: 'min_50', label: '> 50% match' },
                { id: 'min_60', label: '> 60% match' },
                { id: 'min_70', label: '> 70% match' },
                { id: 'min_80', label: '> 80% match' },
                { id: 'min_90', label: '> 90% match' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setFilters({ ...filters, relevance: item.id });
                    setOpenPopover(null);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium transition-colors cursor-pointer ${
                    filters.relevance === item.id ? 'bg-amber-600 text-white font-bold' : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span>{item.label}</span>
                  {filters.relevance === item.id && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </FilterPopover>
          </div>

          {/* CLEAR ALL BUTTON */}
          {activeFiltersCount > 0 && (
            <button
              onClick={resetFilters}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors flex items-center gap-1 cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          )}

        </div>

        {/* ACTIVE FILTER CHIPS ROW */}
        {activeFiltersCount > 0 && (
          <div className="pt-2 border-t border-gray-800/80 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-gray-400 font-medium">Active filters:</span>
            
            {filters.fileType !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold text-[11px]">
                {filters.fileType.toUpperCase()}
                <button onClick={() => removeSingleFilter('fileType', 'all')} className="hover:text-white ml-0.5 cursor-pointer font-bold">×</button>
              </span>
            )}

            {filters.dateRange !== 'any' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 font-semibold text-[11px]">
                {filters.dateRange}
                <button onClick={() => removeSingleFilter('dateRange', 'any')} className="hover:text-white ml-0.5 cursor-pointer font-bold">×</button>
              </span>
            )}

            {filters.size && filters.size !== 'any' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold text-[11px]">
                {filters.size.replace('_', ' ')}
                <button onClick={() => removeSingleFilter('size', 'any')} className="hover:text-white ml-0.5 cursor-pointer font-bold">×</button>
              </span>
            )}

            {filters.category && filters.category !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold text-[11px]">
                Category: {filters.category}
                <button onClick={() => removeSingleFilter('category', 'all')} className="hover:text-white ml-0.5 cursor-pointer font-bold">×</button>
              </span>
            )}

            {filters.location && filters.location !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold text-[11px]">
                Location: {filters.location}
                <button onClick={() => removeSingleFilter('location', 'all')} className="hover:text-white ml-0.5 cursor-pointer font-bold">×</button>
              </span>
            )}

            {/* Individual Label Chips */}
            {activeLabelList.map(lbl => (
              <span key={lbl} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 font-semibold text-[11px]">
                Label: {lbl}
                <button onClick={() => removeIndividualLabel(lbl)} className="hover:text-white ml-0.5 cursor-pointer font-bold">×</button>
              </span>
            ))}

            {filters.relevance && filters.relevance !== 'any' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold text-[11px]">
                &gt;{filters.relevance.replace('min_', '')}% Relevance
                <button onClick={() => removeSingleFilter('relevance', 'any')} className="hover:text-white ml-0.5 cursor-pointer font-bold">×</button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Results Summary Header */}
      {searchQuery && (
        <div className="flex items-center justify-between pb-2 border-b border-gray-800/80">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Search Results for</span>
              <span className="text-blue-400 italic">"{searchQuery}"</span>
              {searchMode === 'exact' && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                  Exact Mode
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              {activeFiltersCount > 0
                ? `Showing ${filteredResults.length} of ${searchResults.length} matching file(s) (${searchExecutionTime}ms)`
                : `${filteredResults.length} results found (${searchExecutionTime}ms)`}
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
            Please check that the local backend server is running and try again.
          </p>
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => executeSearch(searchQuery)}>
            Retry Search
          </Button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isSearching && (
        <div className="space-y-4">
          <Skeleton height={160} />
          <Skeleton height={160} />
          <Skeleton height={160} />
        </div>
      )}

      {/* EMPTY STATE: No query searched yet */}
      {!searchQuery && !isSearching && (
        <div className="glass-panel p-10 rounded-2xl text-center space-y-4 border-dashed border-gray-800">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto">
            <Search className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Find anything in your files</h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto mt-1 font-medium">
              Enter a natural language prompt to search across indexed documents.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto pt-2">
            {[
              'Find my internship certificate',
              'Show my C programming notes',
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

      {/* EMPTY STATE: 0 results */}
      {!isSearching && searchQuery && searchResults.length === 0 && !searchError && (
        <div className="glass-panel p-10 rounded-2xl text-center space-y-4 border border-gray-800">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
            <SearchX className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">We couldn't find a matching file</h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto font-medium">
              No local files matched <span className="text-gray-200">"{searchQuery}"</span>.
            </p>
          </div>

          <div className="p-4 bg-gray-950/80 rounded-xl border border-gray-800 text-xs text-gray-300 max-w-md mx-auto text-left space-y-1.5 font-medium">
            <span className="font-semibold text-gray-200 block mb-1">Suggestions:</span>
            <p>• Try using simpler search terms or broader keywords</p>
            <p>• Switch search mode from Exact to <strong>Semantic</strong></p>
            <p>• Reset your active search filters</p>
          </div>

          {activeFiltersCount > 0 && (
            <Button variant="secondary" size="sm" icon={RotateCcw} onClick={resetFilters}>
              Clear All Filters
            </Button>
          )}
        </div>
      )}

      {/* EMPTY STATE: Results exist but hidden by filters */}
      {!isSearching && searchQuery && searchResults.length > 0 && filteredResults.length === 0 && (
        <div className="glass-panel p-10 rounded-2xl text-center space-y-4 border border-gray-800">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto">
            <Filter className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No files match your current filters</h3>
            <p className="text-xs text-gray-300 max-w-md mx-auto font-medium">
              Files matched <span className="text-blue-300 italic">"{searchQuery}"</span>, but they were hidden by active filter selections.
            </p>
          </div>

          <Button variant="primary" size="md" icon={RotateCcw} onClick={resetFilters}>
            Clear Active Filters
          </Button>
        </div>
      )}

      {/* SEARCH RESULTS LIST */}
      {!isSearching && groupedList.length > 0 && (
        <div className="space-y-4">
          {groupedList.map((group, gIdx) => {
            const isMultiLocation = group.results.length > 1;
            const primaryResult = group.results[0];
            const primaryFile = primaryResult.file || {};
            const fnameKey = (primaryFile.name || '').toLowerCase();
            const isExpanded = expandedGroups[fnameKey] !== false;

            const relevance = getRelevanceBadge(primaryResult.score || 0);

            return (
              <div
                key={gIdx}
                className="glass-panel p-5 rounded-2xl border-gray-800/80 hover:border-blue-500/40 transition-all space-y-4 group"
              >
                {/* Result Card Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      {['.jpg', '.jpeg', '.png', '.webp'].includes((primaryFile.fileExtension || '').toLowerCase()) || primaryFile.category === 'image' ? (
                        <ImageIcon className="w-5 h-5" />
                      ) : (
                        <FileText className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-1">
                      {/* FILE TITLE */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          📄 FILE:
                        </span>
                        <h3
                          onClick={() => setPreviewFile(primaryFile)}
                          className="font-bold text-base text-white hover:text-blue-300 cursor-pointer truncate transition-colors"
                          title={primaryFile.name}
                        >
                          {primaryFile.name}
                        </h3>

                        {/* RELEVANCE SCORE BADGE WITH EXPLANATORY TOOLTIP */}
                        <div className="relative inline-block">
                          <span
                            onMouseEnter={() => setActiveTooltip(primaryFile.id || gIdx)}
                            onMouseLeave={() => setActiveTooltip(null)}
                            className="cursor-help"
                          >
                            <Badge variant={relevance.variant} size="sm" icon={Sparkles}>
                              {relevance.text}
                            </Badge>
                          </span>

                          {activeTooltip === (primaryFile.id || gIdx) && (
                            <div className="absolute left-0 bottom-full mb-2 w-80 p-3.5 bg-gray-950 border border-gray-700 rounded-xl text-[11px] text-gray-200 shadow-2xl z-30 font-sans leading-snug animate-fadeIn">
                              <div className="flex items-center gap-1.5 font-bold text-blue-300 mb-1">
                                <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                <span>Why this percentage? ({primaryResult.score}% Relevance)</span>
                              </div>
                              <p className="text-gray-300 text-[11px] mb-2 leading-relaxed">
                                Memora uses <strong>semantic similarity</strong> to compare the meaning of your query with the indexed document content. The score is <em>not</em> based only on how many times an exact word appears.
                              </p>
                              <div className="space-y-1 pt-1.5 border-t border-gray-800 text-[10px]">
                                {relevance.bullets.map((b, i) => (
                                  <div key={i} className="flex items-start gap-1 text-gray-300">
                                    <span className="text-blue-400">•</span>
                                    <span>{b}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {primaryFile.category && (
                          <Badge variant="default" size="sm">
                            {primaryFile.category.toUpperCase()}
                          </Badge>
                        )}
                      </div>

                      {/* MULTIPLE LOCATIONS BANNER IF SAME FILENAME HAS MULTIPLE COPIES */}
                      {isMultiLocation && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => toggleGroupExpand(fnameKey)}
                            className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/25 transition-colors cursor-pointer"
                          >
                            <Layers className="w-4 h-4 text-amber-400" />
                            <span>Found in {group.results.length} physical locations</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* PHYSICAL LOCATIONS LIST (EXCLUDES FILENAME FROM LOCATION) */}
                <div className="space-y-3 pt-1">
                  {group.results.slice(0, isExpanded ? group.results.length : 1).map((res, rIdx) => {
                    const itemFile = res.file || {};
                    const { folderPath, breadcrumbs } = getFolderOnlyInfo(itemFile.path, itemFile.name);
                    const isShowingFullPath = showFullPaths[itemFile.id || `${gIdx}-${rIdx}`];

                    return (
                      <div
                        key={itemFile.id || rIdx}
                        className="p-3.5 rounded-xl bg-gray-950/80 border border-gray-800/80 space-y-2.5 text-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-1 min-w-0">
                            {/* Directory Location Header */}
                            <div className="flex items-center gap-1.5 font-medium text-gray-300 flex-wrap">
                              <span className="font-bold text-gray-200 flex items-center gap-1">
                                <Folder className="w-3.5 h-3.5 text-blue-400" />
                                {isMultiLocation ? `Location ${rIdx + 1}:` : 'Location:'}
                              </span>
                              
                              {/* Folder Breadcrumbs Tree View (EXCLUDES FILENAME) */}
                              <div className="flex items-center gap-1 text-gray-300 font-mono flex-wrap">
                                {breadcrumbs.map((b, bIdx) => (
                                  <React.Fragment key={bIdx}>
                                    <span className="text-gray-200 font-semibold">{b}</span>
                                    {bIdx < breadcrumbs.length - 1 && <span className="text-gray-600 font-bold">›</span>}
                                  </React.Fragment>
                                ))}
                              </div>
                            </div>

                            {/* Optional Full Windows Directory Path Toggle */}
                            <div className="text-[11px] text-gray-400 font-mono">
                              {isShowingFullPath ? (
                                <span className="text-blue-300 break-all">📁 Path: {folderPath}</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleFullPathShow(itemFile.id || `${gIdx}-${rIdx}`)}
                                  className="text-gray-500 hover:text-gray-300 transition-colors underline cursor-pointer text-[10px]"
                                >
                                  Show full directory path
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Specific Action Buttons for this Physical Location */}
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Eye}
                              onClick={() => setPreviewFile(itemFile)}
                            >
                              Preview
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={FolderOpen}
                              onClick={() => handleLocateNative(itemFile.path)}
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
                              onClick={() => handleOpenNative(itemFile.path, itemFile)}
                            >
                              Open This File
                            </Button>
                          </div>
                        </div>

                        {/* File Details (Modified Date & Size) */}
                        <div className="flex items-center gap-4 text-[11px] text-gray-400 font-medium pt-1 border-t border-gray-900">
                          {itemFile.modifiedAt && (
                            <span>📅 Modified: {formatDateFormatted(itemFile.modifiedAt)}</span>
                          )}
                          {itemFile.sizeBytes > 0 && (
                            <span>💾 Size: {(itemFile.sizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* WHY THIS MATCHES CARD */}
                {(primaryResult.matchedSnippet || primaryResult.aiExplanation) && (
                  <div className="p-4 rounded-xl bg-gray-950/90 border border-purple-500/20 space-y-2 text-xs">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-bold text-purple-300 flex items-center gap-1.5">
                        <Brain className="w-4 h-4 text-purple-400" />
                        <span>Why this matches</span>
                      </span>

                      <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-semibold">
                        ✓ Semantic Similarity
                      </span>
                    </div>

                    <div className="space-y-1.5 pl-1">
                      <div className="text-[11px] text-gray-400">
                        <strong className="text-gray-300 font-semibold">Search Query:</strong> <span className="italic text-blue-300">"{searchQuery}"</span>
                      </div>
                      <div className="text-[11px] text-gray-300 leading-relaxed">
                        <strong className="text-gray-200 block mb-0.5 font-semibold">Relevant Content Snippet:</strong>
                        <p className="p-2.5 rounded-lg bg-gray-900/90 border border-gray-800 text-gray-300 text-xs italic">
                          "{primaryResult.matchedSnippet || primaryResult.aiExplanation}"
                        </p>
                      </div>
                      <p className="text-[11px] text-purple-200/90 leading-snug">
                        <strong>Semantic Explanation:</strong> {primaryResult.aiExplanation || `This document contains concepts closely aligned with your search context.`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
