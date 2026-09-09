import React, { useState, useEffect } from 'react';
import { OrganizationHeader } from '../components/organization/OrganizationHeader';
import { OrganizationSummary } from '../components/organization/OrganizationSummary';
import { AnalysisProgress } from '../components/organization/AnalysisProgress';
import { OrganizationSuggestionsTable } from '../components/organization/OrganizationSuggestionsTable';
import { EditSuggestionModal } from '../components/organization/EditSuggestionModal';
import { OrganizationPreviewModal } from '../components/organization/OrganizationPreviewModal';
import { DuplicatesSection } from '../components/organization/DuplicatesSection';
import { CategoryOverview } from '../components/organization/CategoryOverview';
import { organizationService } from '../services/organizationService';
import { INITIAL_SUGGESTIONS } from '../data/organizationMockData';
import { FolderSearch, Sparkles } from 'lucide-react';

// Simple Error Boundary Fallback for Organization Page
class OrganizationErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Organization Error Boundary caught an exception:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-panel p-12 rounded-2xl border border-red-500/30 bg-slate-900/90 text-center flex flex-col items-center justify-center my-6 space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="text-lg font-bold text-white">Something went wrong on the Organize page</h3>
            <p className="text-xs text-slate-400">
              An unexpected display error occurred. You can click below to reload the page safely.
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg transition-all cursor-pointer"
          >
            <span>Reset & Reload Page View</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const Organization = () => {
  // Analysis state: 'idle' | 'scanning' | 'complete' | 'error'
  const [analysisStatus, setAnalysisStatus] = useState('idle');
  const [currentStep, setCurrentStep] = useState(1);
  const [suggestions, setSuggestions] = useState(INITIAL_SUGGESTIONS || []);
  const [selectedIds, setSelectedIds] = useState([]);
  const [summaryStats, setSummaryStats] = useState({
    files_analyzed: 0,
    suggestions_generated: 0,
    high_confidence: 0,
    duplicate_groups: 0
  });
  
  // Modals state
  const [editingSuggestion, setEditingSuggestion] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [dupRefreshKey, setDupRefreshKey] = useState(0);
  const [warningMessage, setWarningMessage] = useState('');

  // Load suggestions on initial mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleOpenPreview = () => {
    if (selectedIds.length === 0) {
      setWarningMessage('Please select at least one file to organize.');
      setTimeout(() => setWarningMessage(''), 4000);
      return;
    }
    setWarningMessage('');
    setIsPreviewOpen(true);
  };

  const fetchInitialData = async () => {
    try {
      const realSuggestions = await organizationService.getSuggestions();
      if (Array.isArray(realSuggestions) && realSuggestions.length > 0) {
        setSuggestions(realSuggestions);
        setAnalysisStatus('complete');
        setSummaryStats(prev => ({
          ...prev,
          files_analyzed: realSuggestions.length,
          suggestions_generated: realSuggestions.length,
          high_confidence: realSuggestions.filter(s => (s.confidenceScore || 0) >= 0.8).length
        }));
      }
    } catch (err) {
      console.warn('Backend loading error, using initial state:', err);
    }
  };

  // Trigger file analysis via backend or simulated progress
  const handleStartAnalysis = async () => {
    setAnalysisStatus('scanning');
    setCurrentStep(1);

    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= 5) {
          clearInterval(stepInterval);
          return 5;
        }
        return prev + 1;
      });
    }, 450);

    try {
      const summary = await organizationService.analyzeFiles();
      if (summary) {
        setSummaryStats(summary);
      }
      const realSuggestions = await organizationService.getSuggestions();
      if (Array.isArray(realSuggestions)) {
        setSuggestions(realSuggestions);
      }
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
      console.error('Error during backend analysis:', err);
    } finally {
      setTimeout(() => {
        setAnalysisStatus('complete');
        setDupRefreshKey((k) => k + 1);
      }, 2300);
    }
  };

  const safeSuggestions = Array.isArray(suggestions) ? suggestions : [];
  const safeSelectedIds = Array.isArray(selectedIds) ? selectedIds : [];

  // Toggle individual item checkbox
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      return safePrev.includes(id) ? safePrev.filter((i) => i !== id) : [...safePrev, id];
    });
  };

  // Select all / Deselect all
  const handleSelectAll = () => {
    if (safeSelectedIds.length === safeSuggestions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(safeSuggestions.map((s) => s.id).filter(Boolean));
    }
  };

  // Individual Actions
  const handleAccept = async (id) => {
    setSuggestions((prev) =>
      (Array.isArray(prev) ? prev : []).map((item) => (item.id === id ? { ...item, status: 'Accepted' } : item))
    );
    try {
      await organizationService.updateSuggestion(id, 'accepted');
    } catch (err) {
      console.error('Failed to sync accept on backend:', err);
    }
  };

  const handleReject = async (id) => {
    setSuggestions((prev) =>
      (Array.isArray(prev) ? prev : []).map((item) => (item.id === id ? { ...item, status: 'Rejected' } : item))
    );
    try {
      await organizationService.updateSuggestion(id, 'rejected');
    } catch (err) {
      console.error('Failed to sync reject on backend:', err);
    }
  };

  const handleOpenEdit = (item) => {
    setEditingSuggestion(item);
  };

  const handleSaveEditCategory = async (id, newCategory, smartTags) => {
    const updatedTags = Array.isArray(smartTags) ? smartTags : [];
    setSuggestions((prev) =>
      (Array.isArray(prev) ? prev : []).map((item) =>
        item.id === id
          ? {
              ...item,
              suggestedCategory: newCategory || item.suggestedCategory,
              smart_tags: updatedTags,
              labels: updatedTags,
              status: 'Edited'
            }
          : item
      )
    );
    try {
      await organizationService.updateSuggestion(id, 'edited', newCategory, updatedTags);
      const sug = (suggestions || []).find((s) => s.id === id);
      if (sug && (sug.file_id || sug.db_id)) {
        const targetFileId = sug.file_id || sug.db_id;
        await apiService.updateFileTags(targetFileId, updatedTags);
      }
    } catch (err) {
      console.error('Failed to sync edited category on backend:', err);
    }
  };

  // Bulk Actions
  const handleAcceptSelected = async () => {
    setSuggestions((prev) =>
      (Array.isArray(prev) ? prev : []).map((item) =>
        safeSelectedIds.includes(item.id) ? { ...item, status: 'Accepted' } : item
      )
    );
    for (const id of safeSelectedIds) {
      try {
        await organizationService.updateSuggestion(id, 'accepted');
      } catch (err) {}
    }
    setSelectedIds([]);
  };

  const handleRejectSelected = async () => {
    setSuggestions((prev) =>
      (Array.isArray(prev) ? prev : []).map((item) =>
        safeSelectedIds.includes(item.id) ? { ...item, status: 'Rejected' } : item
      )
    );
    for (const id of safeSelectedIds) {
      try {
        await organizationService.updateSuggestion(id, 'rejected');
      } catch (err) {}
    }
    setSelectedIds([]);
  };

  // Metric Computations
  const highConfidenceCount = safeSuggestions.filter((s) => (s?.confidence || 0) >= 90).length;

  return (
    <OrganizationErrorBoundary>
      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <OrganizationHeader
          onAnalyze={handleStartAnalysis}
          isAnalyzing={analysisStatus === 'scanning'}
          isAnalyzed={analysisStatus === 'complete'}
        />

        {/* Initial Empty State (before analysis) */}
        {analysisStatus === 'idle' && (
          <div className="glass-panel p-12 rounded-2xl border border-slate-800/80 bg-slate-900/80 backdrop-blur-md text-center flex flex-col items-center justify-center my-6 space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/10">
              <FolderSearch className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-lg font-bold text-white">No files analyzed yet</h3>
              <p className="text-xs text-slate-400">
                Select a folder and let Memora analyze your files to suggest intelligent category mappings and flag potential duplicates.
              </p>
            </div>
            <button
              onClick={handleStartAnalysis}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/20 border border-blue-500/30 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-blue-200" />
              <span>Analyze Files</span>
            </button>
          </div>
        )}

        {/* Analysis Progress Banner (during or after scanning) */}
        {analysisStatus !== 'idle' && (
          <AnalysisProgress
            currentStep={currentStep}
            isComplete={analysisStatus === 'complete'}
            isError={analysisStatus === 'error'}
            onRetry={handleStartAnalysis}
          />
        )}

        {/* Summary Cards & Main Content (visible when analysis is complete or in progress) */}
        {analysisStatus === 'complete' && (
          <>
            {/* Summary Cards */}
            <OrganizationSummary
              filesAnalyzed={summaryStats.files_analyzed || safeSuggestions.length || 0}
              suggestionsCount={safeSuggestions.length}
              highConfidenceCount={highConfidenceCount}
              duplicatesCount={summaryStats.duplicate_groups || 0}
            />

            {/* Main Suggestions Table */}
            <OrganizationSuggestionsTable
              suggestions={safeSuggestions}
              selectedIds={safeSelectedIds}
              warningMessage={warningMessage}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onAccept={handleAccept}
              onReject={handleReject}
              onEdit={handleOpenEdit}
              onAcceptSelected={handleAcceptSelected}
              onRejectSelected={handleRejectSelected}
              onPreviewChanges={handleOpenPreview}
            />

            {/* Lower Content Grid: Possible Duplicates & Category Overview */}
            <DuplicatesSection refreshTrigger={dupRefreshKey} />

            <CategoryOverview refreshTrigger={dupRefreshKey} />
          </>
        )}

        {/* Edit Suggestion Modal */}
        <EditSuggestionModal
          isOpen={!!editingSuggestion}
          onClose={() => setEditingSuggestion(null)}
          suggestion={editingSuggestion}
          onSave={handleSaveEditCategory}
        />

        {/* Organization Preview & Confirm Modal */}
        <OrganizationPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          suggestions={safeSuggestions.filter((s) => safeSelectedIds.includes(s.id) && s.status !== 'Rejected')}
          onConfirmSuccess={async (operationMode, targetIds, destinationFolder) => {
            try {
              const idsToApply = targetIds && targetIds.length > 0 ? targetIds : safeSelectedIds;
              if (!idsToApply || idsToApply.length === 0) {
                setWarningMessage('Please select at least one file to organize.');
                return null;
              }
              const result = await organizationService.applyOrganization(idsToApply, operationMode, destinationFolder);
              if (result && (result.files_moved > 0 || result.files_copied > 0)) {
                setSelectedIds([]);
                await fetchInitialData();
                setDupRefreshKey((k) => k + 1);
              }
              return result;
            } catch (err) {
              console.error('Error applying organization plan:', err);
              throw err;
            }
          }}
        />
      </div>
    </OrganizationErrorBoundary>
  );
};
