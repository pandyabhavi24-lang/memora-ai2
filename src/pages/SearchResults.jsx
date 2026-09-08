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
  ArrowLeft,
  AlertTriangle,
  Folder,
  FolderOutput,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  X,
  Check
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/common/Button';
import { apiService } from '../services/apiService';
import { semanticSearchService } from '../services/semanticSearchService';

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
      if (widthClass.includes('w-52')) popWidth = 208;
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
            data-filter-popover="true"
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

  const [searchMode, setSearchMode] = useState('semantic'); // 'semantic' | 'exact'
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showFullPaths, setShowFullPaths] = useState({});

  // Active popover menu state: null | 'type' | 'date' | 'category' | 'labels' | 'size'
  const [openPopover, setOpenPopover] = useState(null);
  const popoverContainerRef = useRef(null);

  // SEPARATE LOCAL SEARCH INPUT STATES FOR FILTER POPOVERS
  const [categorySearchInput, setCategorySearchInput] = useState('');
  const [labelSearchInput, setLabelSearchInput] = useState('');
  const [availableTags, setAvailableTags] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);

  // Fetch real persistent Smart Tags and Categories from backend
  useEffect(() => {
    semanticSearchService.getAvailableSmartTags().then(tags => {
      if (Array.isArray(tags) && tags.length > 0) {
        setAvailableTags(tags);
      }
    }).catch(err => {
      console.warn('Could not load smart tags for search filters:', err);
    });

    import('../services/organizationService').then(({ organizationService }) => {
      organizationService.getCategories().then(cats => {
        if (Array.isArray(cats) && cats.length > 0) {
          setAvailableCategories(cats);
        }
      }).catch(err => console.warn('Could not load categories for search filters:', err));
    });
  }, []);

  useEffect(() => {
    if (searchQuery) {
      executeSearch(searchQuery, filters, sortBy);
    }
  }, [searchQuery, filters, sortBy]);

  // Click outside and Escape key handler for filter popovers
  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedInsideTrigger = popoverContainerRef.current?.contains(event.target);
      const clickedInsidePopover = event.target.closest?.('[data-filter-popover="true"]');
      if (!clickedInsideTrigger && !clickedInsidePopover) {
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
      setCategorySearchInput('');
      setLabelSearchInput('');
      return next;
    });
  };

  const resetFilters = () => {
    setFilters({
      fileType: 'all',
      dateRange: 'any',
      category: 'all',
      smartTags: [],
      labels: [],
      size: 'any'
    });
    setLabelSearchInput('');
    setCategorySearchInput('');
    setOpenPopover(null);
  };

  const removeSingleFilter = (filterKey, defaultValue = 'all') => {
    if (filterKey === 'smartTags' || filterKey === 'labels') {
      setFilters(prev => ({ ...prev, smartTags: [], labels: [] }));
    } else {
      setFilters(prev => ({ ...prev, [filterKey]: defaultValue }));
    }
  };

  const removeIndividualLabel = (lblToRemove) => {
    setFilters(prev => {
      const current = Array.isArray(prev.smartTags) && prev.smartTags.length > 0
        ? prev.smartTags
        : (Array.isArray(prev.labels) ? prev.labels : []);
      const updated = current.filter(l => l.toLowerCase() !== lblToRemove.toLowerCase());
      return { ...prev, smartTags: updated, labels: updated };
    });
  };

  const toggleSelectLabel = (selectedLabel) => {
    setFilters(prev => {
      const current = Array.isArray(prev.smartTags) && prev.smartTags.length > 0
        ? prev.smartTags
        : (Array.isArray(prev.labels) ? prev.labels : []);
      const exists = current.some(
        label => label.toLowerCase() === selectedLabel.toLowerCase()
      );
      const updated = exists
        ? current.filter(label => label.toLowerCase() !== selectedLabel.toLowerCase())
        : [...current, selectedLabel];
      return {
        ...prev,
        smartTags: updated,
        labels: updated
      };
    });
  };

  const activeLabelList = Array.isArray(filters.smartTags) && filters.smartTags.length > 0
    ? filters.smartTags
    : (Array.isArray(filters.labels) ? filters.labels : []);

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.fileType && filters.fileType !== 'all') count++;
    if (filters.dateRange && filters.dateRange !== 'any') count++;
    if (filters.size && filters.size !== 'any') count++;
    if (filters.category && filters.category !== 'all') count++;
    if (activeLabelList.length > 0) {
      count += activeLabelList.length;
    }
    return count;
  };

  // Helper for size-based filtering
  const matchesSize = (sizeBytes, sizeFilter) => {
    if (!sizeFilter || sizeFilter === 'any') return true;
    const mb = (sizeBytes || 0) / (1024 * 1024);
    if (sizeFilter === 'under_1mb') return mb < 1;
    if (sizeFilter === '1_10mb') return mb >= 1 && mb <= 10;
    if (sizeFilter === '10_100mb') return mb >= 10 && mb <= 100;
    if (sizeFilter === '100_500mb') return mb >= 100 && mb <= 500;
    if (sizeFilter === '500mb_1gb') return mb >= 500 && mb <= 1024;
    if (sizeFilter === 'over_1gb') return mb >= 1024;
    return true;
  };

  // Helper for Category filtering
  const matchesCategory = (file, catFilter) => {
    if (!catFilter || catFilter.toLowerCase() === 'all') return true;
    const target = catFilter.toLowerCase();
    const cat = (file.category || '').toLowerCase();
    const orgCat = (file.orgCategory || file.org_category || '').toLowerCase();
    const tags = (file.smartTags || file.tags || []).map(t => (t || '').toLowerCase());
    return cat.includes(target) || orgCat.includes(target) || tags.some(t => t.includes(target));
  };

  // Helper for Smart Tags filtering
  const matchesSmartTags = (file, tagFilters) => {
    if (!tagFilters || tagFilters === 'all' || (Array.isArray(tagFilters) && tagFilters.length === 0)) return true;
    const tagsList = Array.isArray(tagFilters) ? tagFilters : [tagFilters];
    
    const fileTags = Array.isArray(file.smartTags) && file.smartTags.length > 0
      ? file.smartTags
      : (Array.isArray(file.tags) ? file.tags : []);

    const textContent = (
      (file.name || '') + ' ' +
      (file.path || '') + ' ' +
      fileTags.join(' ') + ' ' +
      (file.fileExtension || file.extension || '')
    ).toLowerCase();

    return tagsList.every(lbl => textContent.includes(lbl.toLowerCase()));
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

  // Filter backend search results on frontend across filter dimensions
  const filteredResults = searchResults.filter(result => {
    const file = result.file || {};
    const matchesType = matchesFileType(file, filters.fileType);
    const matchesDate = matchesDateRange(file.modifiedAt, filters.dateRange);
    const matchesSz = matchesSize(file.sizeBytes, filters.size);
    const matchesCat = matchesCategory(file, filters.category);
    const matchesTag = matchesSmartTags(file, activeLabelList);

    if (searchMode === 'exact' && searchQuery) {
      const qWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 1);
      const textContent = ((file.name || '') + ' ' + (result.matchedSnippet || '') + ' ' + (result.aiExplanation || '')).toLowerCase();
      const hasExactWords = qWords.every(w => textContent.includes(w));
      return matchesType && matchesDate && matchesSz && matchesCat && matchesTag && hasExactWords;
    }

    return matchesType && matchesDate && matchesSz && matchesCat && matchesTag;
  });

  const activeFiltersCount = getActiveFiltersCount();

  // Format relevance score for result cards
  const getRelevanceBadge = (score) => {
    let label = '';
    let variant = 'default';
    if (score >= 90) {
      label = 'Very Strong Match';
      variant = 'success';
    } else if (score >= 75) {
      label = 'Strong Match';
      variant = 'success';
    } else if (score >= 50) {
      label = 'Moderate Match';
      variant = 'violet';
    } else if (score >= 30) {
      label = 'Partial Match';
      variant = 'blue';
    } else {
      label = 'Weak Match';
      variant = 'default';
    }
    return { label, text: `${label} · ${score}% Relevance`, variant };
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

  // Sort items within each duplicate group
  Object.values(groupedResults).forEach(group => {
    if (sortBy === 'newest') {
      group.results.sort((a, b) => {
        const timeA = new Date(a.file?.modifiedAt || 0).getTime();
        const timeB = new Date(b.file?.modifiedAt || 0).getTime();
        return timeB - timeA;
      });
    } else if (sortBy === 'oldest') {
      group.results.sort((a, b) => {
        const timeA = new Date(a.file?.modifiedAt || 0).getTime();
        const timeB = new Date(b.file?.modifiedAt || 0).getTime();
        return timeA - timeB;
      });
    } else if (sortBy === 'name') {
      group.results.sort((a, b) => (a.file?.name || '').localeCompare(b.file?.name || ''));
    } else {
      group.results.sort((a, b) => (b.score || 0) - (a.score || 0));
    }
  });

  const groupedList = Object.values(groupedResults);

  // Sort overall group list
  if (sortBy === 'newest') {
    groupedList.sort((a, b) => {
      const timeA = Math.max(...a.results.map(r => new Date(r.file?.modifiedAt || 0).getTime()), 0);
      const timeB = Math.max(...b.results.map(r => new Date(r.file?.modifiedAt || 0).getTime()), 0);
      return timeB - timeA;
    });
  } else if (sortBy === 'oldest') {
    groupedList.sort((a, b) => {
      const timeA = Math.min(...a.results.map(r => new Date(r.file?.modifiedAt || 0).getTime()), Infinity);
      const timeB = Math.min(...b.results.map(r => new Date(r.file?.modifiedAt || 0).getTime()), Infinity);
      return timeA - timeB;
    });
  } else if (sortBy === 'name') {
    groupedList.sort((a, b) => (a.filename || '').localeCompare(b.filename || ''));
  } else {
    groupedList.sort((a, b) => {
      const maxA = Math.max(...a.results.map(r => r.score || 0), 0);
      const maxB = Math.max(...b.results.map(r => r.score || 0), 0);
      return maxB - maxA;
    });
  }

  const toggleGroupExpand = (fnameKey) => {
    setExpandedGroups(prev => ({ ...prev, [fnameKey]: !prev[fnameKey] }));
  };

  const toggleFullPathShow = (fileId) => {
    setShowFullPaths(prev => ({ ...prev, [fileId]: !prev[fileId] }));
  };

  // Dynamically compile REAL Smart Tags from backend and current search results (No hardcoded presets)
  const dynamicLabels = Array.from(new Set([
    ...availableTags,
    ...searchResults.flatMap(r => r.file?.smartTags || r.file?.tags || []).filter(Boolean)
  ])).filter(t => t && typeof t === 'string' && t.trim().length > 0);

  // Lists for Popovers filtered strictly by local popover search inputs
  const defaultCategoryOptions = [
    { id: 'all', label: 'All Categories' },
    { id: 'education', label: '🎓 Education' },
    { id: 'programming', label: '💻 Programming' },
    { id: 'work', label: '💼 Work' },
    { id: 'personal', label: '👤 Personal' },
    { id: 'projects', label: '📁 Projects' },
    { id: 'certificates', label: '🏆 Certificates' },
    { id: 'finance', label: '💳 Finance' },
    { id: 'images', label: '🖼 Images' },
    { id: 'documents', label: '📄 Documents' },
    { id: 'other', label: '📦 Other' }
  ];

  const dynamicCategoryOptions = [
    { id: 'all', label: 'All Categories' },
    ...availableCategories.map(c => ({ id: c.name.toLowerCase(), label: c.name }))
  ];

  const categoryOptions = availableCategories.length > 0 ? dynamicCategoryOptions : defaultCategoryOptions;

  const fileTypeOptions = [
    { id: 'all', label: 'All Types' },
    { id: 'pdf', label: '📄 PDF' },
    { id: 'doc', label: '📝 Word' },
    { id: 'presentation', label: '📊 PowerPoint' },
    { id: 'excel', label: '📈 Excel' },
    { id: 'image', label: '🖼 Images' },
    { id: 'text', label: '📃 Text' },
    { id: 'other', label: '📁 Other' }
  ];

  const dateRangeOptions = [
    { id: 'any', label: 'Any time' },
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'week', label: 'Last 7 days' },
    { id: 'month', label: 'Last 30 days' },
    { id: 'month3', label: 'Last 3 months' },
    { id: 'year', label: 'This year' }
  ];

  const labelItems = dynamicLabels
    .map(l => ({ id: l, label: l }))
    .filter(i => i.label.toLowerCase().includes(labelSearchInput.toLowerCase()));

  const sizeOptions = [
    { id: 'any', label: 'Any size' },
    { id: 'under_1mb', label: '< 1 MB' },
    { id: '1_10mb', label: '1–10 MB' },
    { id: '10_100mb', label: '10–100 MB' },
    { id: '100_500mb', label: '100–500 MB' },
    { id: '500mb_1gb', label: '500 MB–1 GB' },
    { id: 'over_1gb', label: '> 1 GB' }
  ];

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

      {/* FILTER TOOLBAR: [ Category ] [ Type ] [ Date ] [ Smart Tags ] [ Size ] [ Reset Filters ] */}
      <div className="p-3 rounded-2xl glass-panel border-gray-800/80 space-y-2.5 relative">
        <div className="flex items-center justify-between flex-wrap gap-2">
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filters Counter Indicator */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 text-xs font-bold text-gray-200">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-extrabold shadow-sm">
                  ({activeFiltersCount})
                </span>
              )}
            </div>

            {/* 1. CATEGORY POPOVER */}
            <FilterPopover
              name="category"
              title="Category"
              activeLabel={filters.category && filters.category !== 'all' ? (categoryOptions.find(o => o.id.toLowerCase() === filters.category.toLowerCase())?.label || filters.category) : ''}
              isOpen={openPopover === 'category'}
              onToggle={togglePopover}
              widthClass="w-56"
            >
              <div className="text-[10px] font-bold text-emerald-400 px-2 py-1 uppercase tracking-wider">Category</div>
              <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-0.5">
                {categoryOptions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setFilters(prev => ({ ...prev, category: item.id }));
                      setOpenPopover(null);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium transition-colors cursor-pointer ${
                      (filters.category || 'all').toLowerCase() === item.id.toLowerCase()
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <span>{item.label}</span>
                    {(filters.category || 'all').toLowerCase() === item.id.toLowerCase() && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </FilterPopover>

            {/* 2. TYPE POPOVER */}
            <FilterPopover
              name="type"
              title="Type"
              activeLabel={filters.fileType !== 'all' ? filters.fileType.toUpperCase() : ''}
              isOpen={openPopover === 'type'}
              onToggle={togglePopover}
              widthClass="w-48"
            >
              <div className="text-[10px] font-bold text-gray-400 px-2 py-1 uppercase tracking-wider">File Type</div>
              {fileTypeOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setFilters(prev => ({ ...prev, fileType: item.id }));
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

            {/* 3. DATE POPOVER */}
            <FilterPopover
              name="date"
              title="Date"
              activeLabel={filters.dateRange !== 'any' ? dateRangeOptions.find(o => o.id === filters.dateRange)?.label : ''}
              isOpen={openPopover === 'date'}
              onToggle={togglePopover}
              widthClass="w-48"
            >
              <div className="text-[10px] font-bold text-gray-400 px-2 py-1 uppercase tracking-wider">Modified Date</div>
              {dateRangeOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setFilters(prev => ({ ...prev, dateRange: item.id }));
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

            {/* 4. SMART TAGS POPOVER (UNIFIED METADATA FILTER) */}
            <FilterPopover
              name="smartTags"
              title="Smart Tags"
              activeCount={activeLabelList.length}
              isOpen={openPopover === 'smartTags'}
              onToggle={togglePopover}
              widthClass="w-72"
            >
              <div className="text-[10px] font-bold text-purple-300 px-2 py-1 uppercase tracking-wider">Smart Tags</div>
              
              <div className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  name="smartTagsFilterSearchInput"
                  autoComplete="off"
                  value={labelSearchInput}
                  onChange={(e) => setLabelSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                  placeholder="Filter by Smart Tags..."
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
                            readOnly
                            className="rounded border-gray-700 bg-gray-900 text-purple-500 focus:ring-purple-500/30 cursor-pointer"
                          />
                          <span>{item.label}</span>
                        </div>
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-2 py-2 text-[11px] text-gray-500 italic">No matching Smart Tags found</div>
                )}
              </div>
            </FilterPopover>

            {/* 5. SIZE POPOVER */}
            <FilterPopover
              name="size"
              title="Size"
              activeLabel={filters.size !== 'any' ? sizeOptions.find(o => o.id === filters.size)?.label : ''}
              isOpen={openPopover === 'size'}
              onToggle={togglePopover}
              widthClass="w-52"
            >
              <div className="text-[10px] font-bold text-gray-400 px-2 py-1 uppercase tracking-wider">File Size</div>
              {sizeOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setFilters(prev => ({ ...prev, size: item.id }));
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
          </div>

          {/* RESET FILTERS BUTTON */}
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-900 hover:bg-gray-800 text-blue-400 hover:text-blue-300 border border-gray-800 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}

        </div>

        {/* ACTIVE FILTER CHIPS ROW */}
        {activeFiltersCount > 0 && (
          <div className="pt-2 border-t border-gray-800/80 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-gray-400 font-medium">Active filters:</span>

            {filters.category && filters.category !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold text-[11px]">
                Category: {categoryOptions.find(o => o.id.toLowerCase() === filters.category.toLowerCase())?.label || filters.category}
                <button onClick={() => removeSingleFilter('category', 'all')} className="hover:text-white ml-0.5 cursor-pointer font-bold">×</button>
              </span>
            )}
            
            {filters.fileType !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold text-[11px]">
                Type: {filters.fileType.toUpperCase()}
                <button onClick={() => removeSingleFilter('fileType', 'all')} className="hover:text-white ml-0.5 cursor-pointer font-bold">×</button>
              </span>
            )}

            {filters.dateRange !== 'any' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 font-semibold text-[11px]">
                Date: {dateRangeOptions.find(o => o.id === filters.dateRange)?.label || filters.dateRange}
                <button onClick={() => removeSingleFilter('dateRange', 'any')} className="hover:text-white ml-0.5 cursor-pointer font-bold">×</button>
              </span>
            )}

            {/* Individual Smart Tag Chips */}
            {activeLabelList.map(lbl => (
              <span key={lbl} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 font-semibold text-[11px]">
                Tag: {lbl}
                <button onClick={() => removeIndividualLabel(lbl)} className="hover:text-white ml-0.5 cursor-pointer font-bold">×</button>
              </span>
            ))}

            {filters.size && filters.size !== 'any' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold text-[11px]">
                Size: {sizeOptions.find(o => o.id === filters.size)?.label || filters.size.replace('_', ' ')}
                <button onClick={() => removeSingleFilter('size', 'any')} className="hover:text-white ml-0.5 cursor-pointer font-bold">×</button>
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
        </div>
      )}

      {/* Loading Skeleton */}
      {isSearching && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-5 rounded-2xl glass-panel border-gray-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-5 w-48 rounded-lg bg-gray-800 animate-pulse" />
                <div className="h-5 w-24 rounded-full bg-gray-800 animate-pulse" />
              </div>
              <div className="h-4 w-full rounded-lg bg-gray-800 animate-pulse" />
              <div className="h-4 w-3/4 rounded-lg bg-gray-800 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Empty Search Results */}
      {!isSearching && !searchError && searchQuery && filteredResults.length === 0 && (
        <div className="p-12 rounded-2xl glass-panel border-gray-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto text-gray-500">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No files match your query</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            Try adjusting your search query, clearing active filters, or scanning additional folders.
          </p>
          {activeFiltersCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              icon={RotateCcw}
              onClick={resetFilters}
              className="mt-2"
            >
              Reset Filters
            </Button>
          )}
        </div>
      )}

      {/* Grouped Results Display (Handles Duplicate Files across Multiple Physical Locations) */}
      {!isSearching && !searchError && groupedList.length > 0 && (
        <div className="space-y-4">
          {groupedList.map((group, gIdx) => {
            const isGroupExpanded = expandedGroups[group.filename] ?? true;
            const primaryResult = group.results[0];
            const primaryFile = primaryResult.file || {};
            const relevance = getRelevanceBadge(primaryResult.score || 0);
            const physicalLocationsCount = group.results.length;

            const fileSmartTags = Array.isArray(primaryFile.smartTags) && primaryFile.smartTags.length > 0
              ? primaryFile.smartTags
              : (Array.isArray(primaryFile.tags) ? primaryFile.tags : []);

            return (
              <div
                key={gIdx}
                className="p-5 rounded-2xl glass-panel border-gray-800/80 hover:border-gray-700/80 transition-all space-y-4 shadow-xl"
              >
                {/* Result Card Main Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0 mt-0.5">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-white truncate hover:text-blue-300 transition-colors">
                          {group.filename}
                        </h3>
                        <span className="px-2 py-0.5 rounded-md bg-gray-900 text-gray-400 border border-gray-800 text-[10px] font-mono">
                          {(primaryFile.fileExtension || primaryFile.extension || 'FILE').toUpperCase().replace('.', '')}
                        </span>
                      </div>

                      {/* Smart Tags Chips */}
                      {fileSmartTags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-0.5">
                          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mr-1">Smart Tags:</span>
                          {fileSmartTags.map((tag, tIdx) => (
                            <span key={tIdx} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Duplicate physical locations indicator */}
                      {physicalLocationsCount > 1 && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
                            ⚠️ Exists in {physicalLocationsCount} physical locations
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleGroupExpand(group.filename)}
                            className="text-xs text-blue-400 hover:text-blue-300 font-semibold underline cursor-pointer"
                          >
                            {isGroupExpanded ? 'Collapse locations' : 'Expand all locations'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Similarity / Relevance Badge with Semantic + Lexical Breakdown */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      relevance.variant === 'success'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : relevance.variant === 'violet'
                        ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                        : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                    }`}>
                      {relevance.text}
                    </span>
                    {typeof primaryResult.semanticScore === 'number' && (
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-mono">
                        <span className="text-purple-300 font-semibold" title="Semantic Score (90% weight)">
                          Sem: {(primaryResult.semanticScore * 100).toFixed(1)}%
                        </span>
                        <span>•</span>
                        <span className="text-blue-300 font-semibold" title="Lexical Score (10% weight)">
                          Lex: {typeof primaryResult.lexicalScore === 'number' ? (primaryResult.lexicalScore * 100).toFixed(1) : '0.0'}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>


                {/* PHYSICAL LOCATIONS LIST */}
                <div className="space-y-2 pl-2 border-l-2 border-gray-800/80">
                  {group.results.map((resItem, rIdx) => {
                    const itemFile = resItem.file || {};
                    const isMultiLocation = group.results.length > 1;
                    const { folderPath, breadcrumbs } = getFolderOnlyInfo(itemFile.path, group.filename);
                    const isShowingFullPath = showFullPaths[itemFile.id || `${gIdx}-${rIdx}`];

                    if (!isGroupExpanded && rIdx > 0) return null;

                    return (
                      <div
                        key={rIdx}
                        className="p-3 rounded-xl bg-gray-950/60 border border-gray-800/60 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
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

                          {/* Action Buttons for this Physical Location */}
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
                              Open
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
