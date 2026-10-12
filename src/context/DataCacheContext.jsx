import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { organizationService } from '../services/organizationService';

const DataCacheContext = createContext(null);

export const DataCacheProvider = ({ children }) => {
  // ---------------------------------------------------------------------------
  // 1. Dashboard Cache Store
  // ---------------------------------------------------------------------------
  const [dashboardData, setDashboardData] = useState({
    stats: {
      folders: 0,
      files: 0,
      chunks: 0,
      vectors: 0,
      searches: 0,
      total_size_bytes: 0,
      recent_files: [],
      recent_searches: []
    },
    categories: [],
    duplicateCount: 0,
    scanStatus: {
      status: 'idle',
      files_found: 0,
      files_processed: 0,
      files_failed: 0,
      progress_percentage: 100,
      current_file: ''
    },
    healthStatus: {
      status: 'ok',
      database: true,
      faiss: true,
      embedding_model: true
    },
    expirySummary: {
      total_tracked: 0,
      upcoming: 0,
      due_soon: 0,
      expired: 0,
      needs_review: 0
    },
    nextExpiry: null,
    isLoaded: false,
    timestamp: null,
    hasError: false
  });

  // ---------------------------------------------------------------------------
  // 2. Duplicates Cache Store
  // ---------------------------------------------------------------------------
  const [duplicatesData, setDuplicatesData] = useState({
    items: [],
    isLoaded: false,
    timestamp: null,
    error: null
  });

  // ---------------------------------------------------------------------------
  // 3. Organization & Suggestions Cache Store
  // ---------------------------------------------------------------------------
  const [organizationData, setOrganizationData] = useState({
    suggestions: [],
    selectedIds: [],
    summaryStats: {
      files_analyzed: 0,
      suggestions_generated: 0,
      high_confidence: 0,
      duplicate_groups: 0
    },
    analysisStatus: 'idle', // 'idle' | 'scanning' | 'complete' | 'error'
    currentStep: 1,
    isLoaded: false,
    timestamp: null
  });

  // ---------------------------------------------------------------------------
  // 4. Category Overview Cache Store
  // ---------------------------------------------------------------------------
  const [overviewData, setOverviewData] = useState({
    data: {
      existingFolders: [],
      aiCategories: [],
      totalFiles: 0
    },
    isLoaded: false,
    timestamp: null,
    error: null
  });

  // In-flight Promise trackers for deduplication
  const inFlightRef = useRef({
    dashboard: null,
    duplicates: null,
    suggestions: null,
    overview: null
  });

  // ---------------------------------------------------------------------------
  // Fetch Duplicates with In-Flight Deduplication & Caching
  // ---------------------------------------------------------------------------
  const fetchDuplicates = useCallback(async (options = { forceRefresh: false }) => {
    const { forceRefresh = false } = options;

    // Return cached results if valid and not forcing refresh
    if (!forceRefresh && duplicatesData.isLoaded) {
      return duplicatesData.items;
    }

    // Reuse existing in-flight request
    if (inFlightRef.current.duplicates) {
      return inFlightRef.current.duplicates;
    }

    const promise = (async () => {
      try {
        const raw = await organizationService.getDuplicates(forceRefresh);
        const items = Array.isArray(raw) ? raw : [];
        setDuplicatesData({
          items,
          isLoaded: true,
          timestamp: Date.now(),
          error: null
        });
        // Also update dashboard duplicateCount if present
        setDashboardData(prev => ({
          ...prev,
          duplicateCount: items.length
        }));
        return items;
      } catch (err) {
        console.error('DataCache: fetchDuplicates error:', err);
        setDuplicatesData(prev => ({
          ...prev,
          error: 'Unable to load duplicate results.'
        }));
        throw err;
      } finally {
        inFlightRef.current.duplicates = null;
      }
    })();

    inFlightRef.current.duplicates = promise;
    return promise;
  }, [duplicatesData.isLoaded, duplicatesData.items]);

  // ---------------------------------------------------------------------------
  // Fetch Suggestions with In-Flight Deduplication & Caching
  // ---------------------------------------------------------------------------
  const fetchSuggestions = useCallback(async (options = { forceRefresh: false }) => {
    const { forceRefresh = false } = options;

    if (!forceRefresh && organizationData.isLoaded) {
      return organizationData.suggestions;
    }

    if (inFlightRef.current.suggestions) {
      return inFlightRef.current.suggestions;
    }

    const promise = (async () => {
      try {
        const raw = await organizationService.getSuggestions();
        const items = Array.isArray(raw) ? raw : [];
        setOrganizationData(prev => ({
          ...prev,
          suggestions: items,
          isLoaded: true,
          timestamp: Date.now(),
          analysisStatus: items.length > 0 ? 'complete' : prev.analysisStatus,
          summaryStats: {
            ...prev.summaryStats,
            files_analyzed: items.length,
            suggestions_generated: items.length,
            high_confidence: items.filter(s => (s.confidence || s.confidenceScore || 0) >= 90).length
          }
        }));
        return items;
      } catch (err) {
        console.error('DataCache: fetchSuggestions error:', err);
        throw err;
      } finally {
        inFlightRef.current.suggestions = null;
      }
    })();

    inFlightRef.current.suggestions = promise;
    return promise;
  }, [organizationData.isLoaded, organizationData.suggestions]);

  // ---------------------------------------------------------------------------
  // Fetch Category Overview with In-Flight Deduplication & Caching
  // ---------------------------------------------------------------------------
  const fetchOverview = useCallback(async (options = { forceRefresh: false }) => {
    const { forceRefresh = false } = options;

    if (!forceRefresh && overviewData.isLoaded) {
      return overviewData.data;
    }

    if (inFlightRef.current.overview) {
      return inFlightRef.current.overview;
    }

    const promise = (async () => {
      try {
        const raw = await organizationService.getOverview();
        let formatted = { existingFolders: [], aiCategories: [], totalFiles: 0 };
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          formatted = {
            existingFolders: Array.isArray(raw.existingFolders) ? raw.existingFolders : [],
            aiCategories: Array.isArray(raw.aiCategories) ? raw.aiCategories : [],
            totalFiles: raw.totalFiles || 0
          };
        } else if (Array.isArray(raw)) {
          formatted = {
            existingFolders: [],
            aiCategories: raw,
            totalFiles: raw.reduce((acc, curr) => acc + (curr.fileCount || 0), 0)
          };
        }
        setOverviewData({
          data: formatted,
          isLoaded: true,
          timestamp: Date.now(),
          error: null
        });
        // Also sync categories into dashboardData
        if (formatted.aiCategories && formatted.aiCategories.length > 0) {
          setDashboardData(prev => ({
            ...prev,
            categories: formatted.aiCategories
          }));
        }
        return formatted;
      } catch (err) {
        console.error('DataCache: fetchOverview error:', err);
        setOverviewData(prev => ({
          ...prev,
          error: 'Unable to load overview data.'
        }));
        throw err;
      } finally {
        inFlightRef.current.overview = null;
      }
    })();

    inFlightRef.current.overview = promise;
    return promise;
  }, [overviewData.isLoaded, overviewData.data]);

  // ---------------------------------------------------------------------------
  // Fetch All Dashboard Data (with in-flight deduplication & background revalidation)
  // ---------------------------------------------------------------------------
  const fetchDashboardData = useCallback(async (options = { forceRefresh: false }) => {
    const { forceRefresh = false } = options;

    if (!forceRefresh && dashboardData.isLoaded) {
      return dashboardData;
    }

    if (inFlightRef.current.dashboard) {
      return inFlightRef.current.dashboard;
    }

    const promise = (async () => {
      try {
        const [
          statsRes,
          overviewRes,
          scanStatusRes,
          duplicatesRes,
          suggestionsRes,
          healthRes,
          expirySummaryRes,
          expiryListRes
        ] = await Promise.allSettled([
          apiService.getStatistics(),
          organizationService.getOverview(),
          apiService.getScanStatus(),
          fetchDuplicates({ forceRefresh }),
          organizationService.getSuggestions(),
          apiService.getHealth(),
          apiService.getExpirySummary(),
          apiService.getExpiries({ sort_by: 'date_asc', status: 'all' })
        ]);

        let nextExpiryVal = null;
        if (expiryListRes.status === 'fulfilled' && Array.isArray(expiryListRes.value)) {
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          nextExpiryVal = expiryListRes.value.find(r => new Date(r.extracted_date) >= today) || expiryListRes.value[0] || null;
        }

        const newCategories = (overviewRes.status === 'fulfilled' && overviewRes.value && overviewRes.value.aiCategories)
          ? overviewRes.value.aiCategories
          : (Array.isArray(overviewRes.value) ? overviewRes.value : []);

        const newDupCount = (duplicatesRes.status === 'fulfilled' && Array.isArray(duplicatesRes.value))
          ? duplicatesRes.value.length
          : 0;

        setDashboardData(prev => ({
          stats: (statsRes.status === 'fulfilled' && statsRes.value) ? statsRes.value : prev.stats,
          categories: newCategories.length > 0 ? newCategories : prev.categories,
          duplicateCount: duplicatesRes.status === 'fulfilled' ? newDupCount : prev.duplicateCount,
          scanStatus: (scanStatusRes.status === 'fulfilled' && scanStatusRes.value) ? scanStatusRes.value : prev.scanStatus,
          healthStatus: (healthRes.status === 'fulfilled' && healthRes.value) ? healthRes.value : prev.healthStatus,
          expirySummary: (expirySummaryRes.status === 'fulfilled' && expirySummaryRes.value) ? expirySummaryRes.value : prev.expirySummary,
          nextExpiry: expiryListRes.status === 'fulfilled' ? nextExpiryVal : prev.nextExpiry,
          isLoaded: true,
          timestamp: Date.now(),
          hasError: false
        }));

        // Keep overviewData in sync if available
        if (overviewRes.status === 'fulfilled' && overviewRes.value) {
          const raw = overviewRes.value;
          let formatted = { existingFolders: [], aiCategories: [], totalFiles: 0 };
          if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            formatted = {
              existingFolders: Array.isArray(raw.existingFolders) ? raw.existingFolders : [],
              aiCategories: Array.isArray(raw.aiCategories) ? raw.aiCategories : [],
              totalFiles: raw.totalFiles || 0
            };
          } else if (Array.isArray(raw)) {
            formatted = {
              existingFolders: [],
              aiCategories: raw,
              totalFiles: raw.reduce((acc, curr) => acc + (curr.fileCount || 0), 0)
            };
          }
          setOverviewData({
            data: formatted,
            isLoaded: true,
            timestamp: Date.now(),
            error: null
          });
        }

        return dashboardData;
      } catch (err) {
        console.error('DataCache: fetchDashboardData error:', err);
        // If we already had usable data, retain it and do NOT flip hasError to true
        setDashboardData(prev => ({
          ...prev,
          hasError: !prev.isLoaded
        }));
        throw err;
      } finally {
        inFlightRef.current.dashboard = null;
      }
    })();

    inFlightRef.current.dashboard = promise;
    return promise;
  }, [dashboardData, fetchDuplicates]);

  // ---------------------------------------------------------------------------
  // Long-Running Organization Analysis State Preserver
  // ---------------------------------------------------------------------------
  const startOrganizationAnalysis = useCallback(async () => {
    // If already analyzing, do not spawn another job
    if (organizationData.analysisStatus === 'scanning') {
      return;
    }

    setOrganizationData(prev => ({
      ...prev,
      analysisStatus: 'scanning',
      currentStep: 1
    }));

    const stepInterval = setInterval(() => {
      setOrganizationData(prev => {
        if (prev.currentStep >= 5) {
          clearInterval(stepInterval);
          return prev;
        }
        return { ...prev, currentStep: prev.currentStep + 1 };
      });
    }, 450);

    try {
      const summary = await organizationService.analyzeFiles();
      const realSuggestions = await organizationService.getSuggestions();
      const dupItems = await fetchDuplicates({ forceRefresh: true });

      const safeSuggestions = Array.isArray(realSuggestions) ? realSuggestions : [];

      setOrganizationData(prev => ({
        ...prev,
        suggestions: safeSuggestions,
        summaryStats: summary || {
          files_analyzed: safeSuggestions.length,
          suggestions_generated: safeSuggestions.length,
          high_confidence: safeSuggestions.filter(s => (s.confidence || s.confidenceScore || 0) >= 90).length,
          duplicate_groups: Array.isArray(dupItems) ? dupItems.length : 0
        }
      }));

      // Invalidate overview so fresh AI categories are reloaded
      setOverviewData(prev => ({ ...prev, isLoaded: false }));

      const nowStr = new Date().toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      localStorage.setItem('last_analysis_timestamp', nowStr);
      localStorage.removeItem('scanned_since_last_analysis');
    } catch (err) {
      console.error('DataCache: Analysis error:', err);
      setOrganizationData(prev => ({ ...prev, analysisStatus: 'error' }));
    } finally {
      setTimeout(() => {
        setOrganizationData(prev => ({ ...prev, analysisStatus: 'complete' }));
      }, 2300);
    }
  }, [organizationData.analysisStatus, fetchDuplicates]);

  // ---------------------------------------------------------------------------
  // Fine-Grained Cache Invalidation Triggers
  // ---------------------------------------------------------------------------
  const invalidateDashboard = useCallback(() => {
    setDashboardData(prev => ({ ...prev, isLoaded: false }));
  }, []);

  const invalidateDuplicates = useCallback(() => {
    setDuplicatesData(prev => ({ ...prev, isLoaded: false }));
  }, []);

  const invalidateSuggestions = useCallback(() => {
    setOrganizationData(prev => ({ ...prev, isLoaded: false }));
  }, []);

  const invalidateOverview = useCallback(() => {
    setOverviewData(prev => ({ ...prev, isLoaded: false }));
  }, []);

  const invalidateAll = useCallback(() => {
    setDashboardData(prev => ({ ...prev, isLoaded: false }));
    setDuplicatesData(prev => ({ ...prev, isLoaded: false }));
    setOrganizationData(prev => ({ ...prev, isLoaded: false }));
    setOverviewData(prev => ({ ...prev, isLoaded: false }));
  }, []);

  // ---------------------------------------------------------------------------
  // In-Memory Mutators for Immediate Responsive Feedback
  // ---------------------------------------------------------------------------
  const updateDuplicateStatus = useCallback((groupId, newStatus) => {
    setDuplicatesData(prev => ({
      ...prev,
      items: prev.items.map(item => (item.id === groupId ? { ...item, status: newStatus } : item))
    }));
  }, []);

  const removeDuplicateFile = useCallback((fileId) => {
    setDuplicatesData(prev => ({
      ...prev,
      items: prev.items.filter(item => {
        const aId = item.fileA?.id || item.fileA?.db_id || item.fileA?.file_id;
        const bId = item.fileB?.id || item.fileB?.db_id || item.fileB?.file_id;
        return aId !== fileId && bId !== fileId;
      })
    }));
    // Invalidate dashboard stats since file count changed
    invalidateDashboard();
  }, [invalidateDashboard]);

  const updateSuggestionStatus = useCallback((id, status) => {
    setOrganizationData(prev => ({
      ...prev,
      suggestions: prev.suggestions.map(item => (item.id === id ? { ...item, status } : item))
    }));
  }, []);

  const updateSuggestionCategory = useCallback((id, newCategory, newTags) => {
    setOrganizationData(prev => ({
      ...prev,
      suggestions: prev.suggestions.map(item =>
        item.id === id
          ? {
              ...item,
              suggestedCategory: newCategory || item.suggestedCategory,
              smart_tags: newTags || item.smart_tags,
              labels: newTags || item.labels,
              status: 'Edited'
            }
          : item
      )
    }));
  }, []);

  return (
    <DataCacheContext.Provider
      value={{
        // Dashboard
        dashboardData,
        fetchDashboardData,
        invalidateDashboard,

        // Duplicates
        duplicatesData,
        fetchDuplicates,
        updateDuplicateStatus,
        removeDuplicateFile,
        invalidateDuplicates,

        // Organization Suggestions & Long-Running Analysis
        organizationData,
        fetchSuggestions,
        startOrganizationAnalysis,
        updateSuggestionStatus,
        updateSuggestionCategory,
        invalidateSuggestions,

        // Category Overview
        overviewData,
        fetchOverview,
        invalidateOverview,

        // General
        invalidateAll
      }}
    >
      {children}
    </DataCacheContext.Provider>
  );
};

export const useDataCache = () => {
  const context = useContext(DataCacheContext);
  if (!context) {
    throw new Error('useDataCache must be used within a DataCacheProvider');
  }
  return context;
};
