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

export const Organization = () => {
  // Analysis state: 'idle' | 'scanning' | 'complete' | 'error'
  const [analysisStatus, setAnalysisStatus] = useState('idle');
  const [currentStep, setCurrentStep] = useState(1);
  const [suggestions, setSuggestions] = useState(INITIAL_SUGGESTIONS);
  const [selectedIds, setSelectedIds] = useState([]);
  const [summaryStats, setSummaryStats] = useState({
    files_analyzed: 24,
    suggestions_generated: 18,
    high_confidence: 14,
    duplicate_groups: 3
  });
  
  // Modals state
  const [editingSuggestion, setEditingSuggestion] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [dupRefreshKey, setDupRefreshKey] = useState(0);

  // Load suggestions on initial mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const realSuggestions = await organizationService.getSuggestions();
      if (realSuggestions && realSuggestions.length > 0) {
        setSuggestions(realSuggestions);
      }
    } catch (err) {
      console.warn('Backend loading error, falling back to mock data:', err);
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
      if (realSuggestions && realSuggestions.length > 0) {
        setSuggestions(realSuggestions);
      }
    } catch (err) {
      console.error('Error during backend analysis:', err);
    } finally {
      setTimeout(() => {
        setAnalysisStatus('complete');
        setDupRefreshKey((k) => k + 1);
      }, 2300);
    }
  };

  // Toggle individual item checkbox
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Select all / Deselect all
  const handleSelectAll = () => {
    if (selectedIds.length === suggestions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(suggestions.map((s) => s.id));
    }
  };

  // Individual Actions
  const handleAccept = async (id) => {
    setSuggestions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'Accepted' } : item))
    );
    try {
      await organizationService.updateSuggestion(id, 'accepted');
    } catch (err) {
      console.error('Failed to sync accept on backend:', err);
    }
  };

  const handleReject = async (id) => {
    setSuggestions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'Rejected' } : item))
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

  const handleSaveEditCategory = async (id, newCategory) => {
    setSuggestions((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, suggestedCategory: newCategory, status: 'Edited' }
          : item
      )
    );
    try {
      await organizationService.updateSuggestion(id, 'edited', newCategory);
    } catch (err) {
      console.error('Failed to sync edited category on backend:', err);
    }
  };

  // Bulk Actions
  const handleAcceptSelected = async () => {
    setSuggestions((prev) =>
      prev.map((item) =>
        selectedIds.includes(item.id) ? { ...item, status: 'Accepted' } : item
      )
    );
    for (const id of selectedIds) {
      try {
        await organizationService.updateSuggestion(id, 'accepted');
      } catch (err) {}
    }
    setSelectedIds([]);
  };

  const handleRejectSelected = async () => {
    setSuggestions((prev) =>
      prev.map((item) =>
        selectedIds.includes(item.id) ? { ...item, status: 'Rejected' } : item
      )
    );
    for (const id of selectedIds) {
      try {
        await organizationService.updateSuggestion(id, 'rejected');
      } catch (err) {}
    }
    setSelectedIds([]);
  };

  // Metric Computations
  const highConfidenceCount = suggestions.filter((s) => s.confidence >= 90).length;

  return (
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
            filesAnalyzed={summaryStats.files_analyzed || 24}
            suggestionsCount={suggestions.length}
            highConfidenceCount={highConfidenceCount}
            duplicatesCount={summaryStats.duplicate_groups || 3}
          />

          {/* Main Suggestions Table */}
          <OrganizationSuggestionsTable
            suggestions={suggestions}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onAccept={handleAccept}
            onReject={handleReject}
            onEdit={handleOpenEdit}
            onAcceptSelected={handleAcceptSelected}
            onRejectSelected={handleRejectSelected}
            onPreviewChanges={() => setIsPreviewOpen(true)}
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
        suggestions={suggestions}
        onConfirmSuccess={async () => {
          try {
            await organizationService.applyOrganization(selectedIds);
          } catch (err) {
            console.error('Error applying organization plan:', err);
          }
        }}
      />
    </div>
  );
};
