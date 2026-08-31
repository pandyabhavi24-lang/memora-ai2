import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { semanticSearchService } from '../services/semanticSearchService';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => {
    return localStorage.getItem('memora_onboarding_done') === 'true';
  });

  const [folders, setFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  
  // Active search query and results state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchExecutionTime, setSearchExecutionTime] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Search Filter & Sort States
  const [filters, setFilters] = useState({
    fileType: 'all',
    dateRange: 'any',
    folder: 'all'
  });
  const [sortBy, setSortBy] = useState('relevant');

  // Search History State
  const [searchHistory, setSearchHistory] = useState([]);

  // File Preview Modal State
  const [previewFile, setPreviewFile] = useState(null);

  // Toast Notifications
  const [toasts, setToasts] = useState([]);

  // Load folders & search history on startup
  useEffect(() => {
    loadFolders();
    refreshSearchHistory();
  }, []);

  const loadFolders = async () => {
    setLoadingFolders(true);
    try {
      const data = await apiService.getFolders();
      setFolders(data);
    } catch (err) {
      console.error('Failed to load folders:', err);
    } finally {
      setLoadingFolders(false);
    }
  };

  const refreshSearchHistory = async () => {
    try {
      const history = await semanticSearchService.getSearchHistory();
      setSearchHistory(history);
    } catch (err) {
      console.error('Failed to load search history:', err);
    }
  };

  const addFolder = async (path, name) => {
    try {
      const newFolder = await apiService.addFolder(path, name);
      await loadFolders();
      addToast(`Added folder: ${newFolder.name}`, 'success');
      return newFolder;
    } catch (err) {
      addToast('Failed to add folder', 'error');
    }
  };

  const removeFolder = async (folderId) => {
    try {
      await apiService.removeFolder(folderId);
      await loadFolders();
      addToast('Folder removed from scanning list', 'info');
    } catch (err) {
      addToast('Failed to remove folder', 'error');
    }
  };

  const selectFolderNative = async () => {
    try {
      const added = await apiService.selectFolderViaNativeDialog();
      if (added && added.length > 0) {
        await loadFolders();
        addToast(`Selected ${added.length} folder(s)`, 'success');
      }
    } catch (err) {
      addToast('Folder selection canceled or failed', 'warning');
    }
  };

  const completeOnboarding = () => {
    localStorage.setItem('memora_onboarding_done', 'true');
    setHasCompletedOnboarding(true);
  };

  /**
   * Execute Core Semantic Search
   */
  const executeSearch = async (
    query = searchQuery,
    searchFilters = filters,
    sortOption = sortBy
  ) => {
    if (!query || query.trim().length === 0) {
      setSearchResults([]);
      setSearchTotal(0);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const payload = await semanticSearchService.search(query, searchFilters, sortOption);
      setSearchResults(payload.results);
      setSearchTotal(payload.total);
      setSearchExecutionTime(payload.executionTimeMs);
      await refreshSearchHistory();
    } catch (err) {
      console.error('Semantic search service error:', err);
      setSearchError('An error occurred while querying the local vector database.');
      addToast('Error performing semantic search', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const removeHistoryItem = async (id) => {
    await semanticSearchService.removeSearchHistory(id);
    await refreshSearchHistory();
  };

  const clearHistoryAll = async () => {
    await semanticSearchService.clearSearchHistory();
    await refreshSearchHistory();
    addToast('Search history cleared', 'info');
  };

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <AppContext.Provider
      value={{
        hasCompletedOnboarding,
        completeOnboarding,
        folders,
        loadingFolders,
        loadFolders,
        addFolder,
        removeFolder,
        selectFolderNative,
        searchQuery,
        setSearchQuery,
        searchResults,
        searchTotal,
        searchExecutionTime,
        isSearching,
        searchError,
        executeSearch,
        filters,
        setFilters,
        sortBy,
        setSortBy,
        searchHistory,
        removeHistoryItem,
        clearHistoryAll,
        previewFile,
        setPreviewFile,
        toasts,
        addToast,
        removeToast
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
