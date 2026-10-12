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
import { apiService } from '../services/apiService';
import { useDataCache } from '../context/DataCacheContext';
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
        <div className="p-12 rounded-2xl border border-red-500/30 bg-[#0A1629] text-center flex flex-col items-center justify-center my-6 space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="text-lg font-bold text-[#F4F7FF]">Something went wrong on the Organize page</h3>
            <p className="text-xs text-[#A7B7D0]">
              An unexpected display error occurred. You can click below to reload the page safely.
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#3478F6] hover:bg-[#2563EB] text-white font-semibold text-xs shadow-lg transition-all cursor-pointer"
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
  const {
    organizationData,
    fetchSuggestions,
    startOrganizationAnalysis,
    updateSuggestionStatus,
    updateSuggestionCategory,
    invalidateDuplicates,
    invalidateDashboard,
    invalidateOverview,
    invalidateSuggestions
  } = useDataCache();

  // Selected checkboxes & modal UI state
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingSuggestion, setEditingSuggestion] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [dupRefreshKey, setDupRefreshKey] = useState(0);
  const [warningMessage, setWarningMessage] = useState('');

  // Suggestions and analysis state are preserved in DataCacheContext
  const suggestions = organizationData.suggestions;
  const analysisStatus = organizationData.analysisStatus;
  const currentStep = organizationData.currentStep;
  const summaryStats = organizationData.summaryStats;

  // Load suggestions on initial mount if not already loaded
  useEffect(() => {
    fetchSuggestions({ forceRefresh: false }).catch((err) => {
      console.warn('Backend loading error, using initial state:', err);
    });
  }, [fetchSuggestions]);

  const handleOpenPreview = () => {
    if (selectedIds.length === 0) {
      setWarningMessage('Please select at least one file to organize.');
      setTimeout(() => setWarningMessage(''), 4000);
      return;
    }
    setWarningMessage('');
    setIsPreviewOpen(true);
  };

  const handleFileDeleted = async () => {
    invalidateDuplicates();
    invalidateDashboard();
    invalidateOverview();
    invalidateSuggestions();
    await fetchSuggestions({ forceRefresh: true });
    setDupRefreshKey((k) => k + 1);
  };

  // Trigger file analysis via DataCacheContext so progress survives module navigation
  const handleStartAnalysis = async () => {
    await startOrganizationAnalysis();
    setDupRefreshKey((k) => k + 1);
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
    updateSuggestionStatus(id, 'Accepted');
    try {
      await organizationService.updateSuggestion(id, 'accepted');
    } catch (err) {
      console.error('Failed to sync accept on backend:', err);
    }
  };

  const handleReject = async (id) => {
    updateSuggestionStatus(id, 'Rejected');
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
    updateSuggestionCategory(id, newCategory, updatedTags);
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
    safeSelectedIds.forEach((id) => updateSuggestionStatus(id, 'Accepted'));
    for (const id of safeSelectedIds) {
      try {
        await organizationService.updateSuggestion(id, 'accepted');
      } catch (err) {}
    }
    setSelectedIds([]);
  };

  const handleRejectSelected = async () => {
    safeSelectedIds.forEach((id) => updateSuggestionStatus(id, 'Rejected'));
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
          <div className="p-12 rounded-2xl border border-[rgba(139,170,215,0.14)] bg-[#0A1629] text-center flex flex-col items-center justify-center my-6 space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-[rgba(52,120,246,0.15)] border border-[rgba(52,120,246,0.3)] flex items-center justify-center text-[#4B91FF] shadow-lg shadow-blue-500/10">
              <FolderSearch className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-lg font-bold text-[#F4F7FF]">No files analyzed yet</h3>
              <p className="text-xs text-[#A7B7D0]">
                Select a folder and let Memora analyze your files to suggest intelligent category mappings and flag potential duplicates.
              </p>
            </div>
            <button
              onClick={handleStartAnalysis}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#3478F6] hover:bg-[#2563EB] active:scale-95 text-white font-semibold text-xs shadow-lg shadow-blue-500/20 border border-blue-400/30 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-white" />
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
            <DuplicatesSection refreshTrigger={dupRefreshKey} onFileDeleted={handleFileDeleted} />

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
                invalidateDuplicates();
                invalidateDashboard();
                invalidateOverview();
                await fetchSuggestions({ forceRefresh: true });
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
