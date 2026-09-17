import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Image as ImageIcon,
  Film,
  Layers,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Eye,
  Check,
  X,
  ShieldAlert,
  Maximize2,
  Gauge,
  Zap,
  HardDrive,
  Copy,
  Sliders,
  FolderOpen,
  Camera,
  Play,
  FileSearch,
  ChevronRight,
  ArrowRight,
  CheckCircle,
  Tag,
  Plus,
  Clock,
  ExternalLink,
  FolderPlus,
  Upload,
  Loader2
} from 'lucide-react';
import { mediaService, API_BASE_URL } from '../services/mediaService';
import { Button } from '../components/common/Button';

export const MediaIntelligence = () => {
  const [activeTab, setActiveTab] = useState('overview'); // overview, inspector, recent, similar, recommendations, groups
  const [overview, setOverview] = useState(null);
  const [status, setStatus] = useState(null);
  const [mediaTypeFilter, setMediaTypeFilter] = useState('all');
  const [filesList, setFilesList] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [fileDetail, setFileDetail] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [visualGroups, setVisualGroups] = useState([]);
  const [similarMediaList, setSimilarMediaList] = useState([]);
  const [recentCheckedList, setRecentCheckedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [deleteModalFile, setDeleteModalFile] = useState(null);

  // External Similar Image Query State
  const fileInputRef = useRef(null);
  const [similarSearching, setSimilarSearching] = useState(false);
  const [similarError, setSimilarError] = useState(null);
  const [externalSimilarResults, setExternalSimilarResults] = useState(null);

  // Editable Manual Tags State
  const [userTags, setUserTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [tagsSaving, setTagsSaving] = useState(false);
  const [tagsDirty, setTagsDirty] = useState(false);

  // Create Visual Group State
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupFiles, setSelectedGroupFiles] = useState([]);
  const [createGroupLoading, setCreateGroupLoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    let interval = null;
    if (analyzing) {
      interval = setInterval(async () => {
        try {
          const s = await mediaService.getStatus();
          setStatus(s);
          if (!s.is_analyzing) {
            setAnalyzing(false);
            loadDashboardData();
          }
        } catch (e) {
          console.warn('Status poll error:', e);
        }
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [analyzing]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [ov, files, recs, groups, st, recents] = await Promise.all([
        mediaService.getOverview().catch(() => null),
        mediaService.getMediaFiles('all', 120).catch(() => []),
        mediaService.getRecommendations().catch(() => []),
        mediaService.getVisualGroups().catch(() => []),
        mediaService.getStatus().catch(() => null),
        mediaService.getRecentlyChecked(12).catch(() => [])
      ]);

      setOverview(ov);
      setFilesList(files || []);
      setRecommendations(recs || []);
      setVisualGroups(groups || []);
      setStatus(st);
      setRecentCheckedList(recents || []);
      if (st?.is_analyzing) setAnalyzing(true);

      if (files && files.length > 0 && !selectedFileId) {
        handleSelectFile(files[0].file_id, false);
      }
    } catch (err) {
      console.error('Error loading media dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerAnalysis = async (force = false) => {
    setAnalyzing(true);
    setActionMessage('Visual Intelligence analysis started in background...');
    try {
      await mediaService.triggerAnalysis(force);
    } catch (err) {
      setActionMessage('Failed to start analysis: ' + err.message);
      setAnalyzing(false);
    }
    setTimeout(() => setActionMessage(null), 4000);
  };

  const handleSelectFile = async (fileId, switchTab = true) => {
    setSelectedFileId(fileId);
    if (switchTab) {
      setActiveTab('inspector');
    }
    try {
      // Record inspection in recent history
      mediaService.recordFileInspection(fileId).catch(() => { });

      const detail = await mediaService.getFileDetail(fileId);
      setFileDetail(detail);

      // Populate Manual Tags
      setUserTags(detail.user_tags || []);
      setTagsDirty(false);

      const similar = await mediaService.getSimilarMedia(fileId);
      setSimilarMediaList(similar || []);

      // Refresh recent list in background
      const recents = await mediaService.getRecentlyChecked(12).catch(() => []);
      setRecentCheckedList(recents || []);
    } catch (e) {
      console.error('Error loading file detail:', e);
    }
  };

  // Editable Manual Tags Handlers
  const handleAddUserTag = () => {
    const val = newTagInput.trim().replace(/^#+/, '');
    if (!val) return;
    if (userTags.some(t => t.toLowerCase() === val.toLowerCase())) {
      setNewTagInput('');
      return;
    }
    setUserTags([...userTags, val]);
    setNewTagInput('');
    setTagsDirty(true);
  };

  const handleRemoveUserTag = (tagToRemove) => {
    setUserTags(userTags.filter(t => t !== tagToRemove));
    setTagsDirty(true);
  };

  const handleSaveTags = async () => {
    if (!selectedFileId) return;
    setTagsSaving(true);
    try {
      const res = await mediaService.updateFileTags(selectedFileId, userTags, []);
      setUserTags(res.user_tags || []);
      setTagsDirty(false);
      setActionMessage('Manual tags saved successfully & visual index updated in-place!');
    } catch (err) {
      setActionMessage('Failed to save tags: ' + err.message);
    } finally {
      setTagsSaving(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleSelectExternalImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSimilarSearching(true);
    setSimilarError(null);
    try {
      const res = await mediaService.findSimilarByExternalImage(file, file.name);
      if (res.status === 'rejected_text_heavy') {
        setSimilarError('The selected query image is a document or text-heavy scan. Please select a pictorial image.');
        setExternalSimilarResults(null);
      } else {
        setExternalSimilarResults(res);
      }
    } catch (err) {
      setSimilarError(err.message || 'Failed to analyze external image.');
    } finally {
      setSimilarSearching(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Create Visual Group Handlers
  const handleOpenCreateGroup = () => {
    setNewGroupName('');
    setSelectedGroupFiles([]);
    setShowCreateGroupModal(true);
  };

  const handleToggleGroupFile = (fileId) => {
    if (selectedGroupFiles.includes(fileId)) {
      setSelectedGroupFiles(selectedGroupFiles.filter(id => id !== fileId));
    } else {
      setSelectedGroupFiles([...selectedGroupFiles, fileId]);
    }
  };

  const handleCreateVisualGroup = async () => {
    if (!newGroupName.trim() || selectedGroupFiles.length === 0) return;
    setCreateGroupLoading(true);
    try {
      await mediaService.createVisualGroup(newGroupName.trim(), selectedGroupFiles);
      setActionMessage(`Visual Group '${newGroupName}' created with ${selectedGroupFiles.length} original images.`);
      setShowCreateGroupModal(false);
      const groups = await mediaService.getVisualGroups();
      setVisualGroups(groups || []);
      setActiveTab('groups');
    } catch (err) {
      setActionMessage('Group creation failed: ' + err.message);
    } finally {
      setCreateGroupLoading(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleDeleteVisualGroup = async (groupId) => {
    try {
      await mediaService.deleteVisualGroup(groupId);
      setActionMessage('Visual group removed (original files preserved).');
      const groups = await mediaService.getVisualGroups();
      setVisualGroups(groups || []);
    } catch (err) {
      setActionMessage('Failed to delete group: ' + err.message);
    }
    setTimeout(() => setActionMessage(null), 4000);
  };

  const handleRecAction = async (recId, action) => {
    try {
      await mediaService.handleRecommendationAction(recId, action);
      setActionMessage(`Recommendation marked as ${action.toUpperCase()}`);
      const [recs, ov] = await Promise.all([
        mediaService.getRecommendations(),
        mediaService.getOverview()
      ]);
      setRecommendations(recs || []);
      setOverview(ov);
    } catch (e) {
      setActionMessage('Action error: ' + e.message);
    }
    setTimeout(() => setActionMessage(null), 3500);
  };

  const confirmDeleteFile = async () => {
    if (!deleteModalFile) return;
    try {
      const res = await mediaService.deleteMediaFile(deleteModalFile.file_id);
      setActionMessage(res.message || 'File safely deleted.');
      setDeleteModalFile(null);
      loadDashboardData();
    } catch (err) {
      setActionMessage('Delete failed: ' + err.message);
    }
    setTimeout(() => setActionMessage(null), 4000);
  };

  const getQualityBadgeColor = (score) => {
    if (score >= 80) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (score >= 60) return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
    if (score >= 40) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  const exactDuplicates = [];
  const nearDuplicates = [];
  const visuallySimilar = [];

  similarMediaList.forEach(sim => {
    if (sim.similarity_type === 'exact_duplicate' || sim.similarity_score >= 98.5) {
      exactDuplicates.push(sim);
    } else if (sim.similarity_score >= 88) {
      nearDuplicates.push(sim);
    } else {
      visuallySimilar.push(sim);
    }
  });

  // Filter files by media type filter
  const filteredFiles = filesList.filter((f) => {
    if (mediaTypeFilter === 'all') return true;
    if (mediaTypeFilter === 'images') return f.media_type === 'image';
    if (mediaTypeFilter === 'videos') return f.media_type === 'video';
    if (mediaTypeFilter === 'pictorial') return f.content_type === 'pictorial';
    if (mediaTypeFilter === 'docs') return f.content_type === 'text_heavy' || f.is_screenshot;
    return true;
  });

  const pictorialFilesOnly = filesList.filter(f => f.content_type !== 'text_heavy' && !f.is_screenshot);

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto select-none">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-wide">
                Document & Visual Intelligence
              </h1>
              <span className="text-[11px] text-purple-300 font-mono font-semibold">
                MODULE 3 — Visual Intelligence, AI Descriptions, Dynamic Groups & Tags
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1 font-medium">
            Strict pictorial image intelligence, dynamic visual containers, editable tags, and unified integration with Module 1 Search.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {overview && (
            <div className="text-xs text-gray-400 mr-2 font-mono flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {overview.pictorial_images_count || overview.analyzed_count || 0} Pictorial Indexed
              </span>
              <span className="px-2 py-0.5 rounded-md bg-gray-800 text-gray-400 border border-gray-700">
                {overview.text_heavy_excluded_count || 0} Docs Excluded
              </span>
            </div>
          )}

          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            iconClassName={analyzing ? 'animate-spin' : ''}
            disabled={analyzing}
            onClick={() => handleTriggerAnalysis(false)}
          >
            {analyzing ? `Analyzing (${status?.processed_media || 0}/${status?.total_media || 0})...` : 'Re-index Visual Library'}
          </Button>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionMessage && (
        <div className="p-3.5 rounded-xl bg-purple-950/60 border border-purple-500/40 text-purple-200 text-xs flex items-center justify-between animate-fadeIn shadow-lg shadow-purple-500/10">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            {actionMessage}
          </span>
          <button onClick={() => setActionMessage(null)} className="text-gray-400 hover:text-white">×</button>
        </div>
      )}

      {/* Progress Bar when Analyzing */}
      {analyzing && status && (
        <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-2">
          <div className="flex items-center justify-between text-xs text-indigo-200">
            <span className="font-semibold">Processing: {status.current_file || 'Analyzing visual content...'}</span>
            <span>{status.processed_media} / {status.total_media} ({status.progress_percentage}%)</span>
          </div>
          <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${status.progress_percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-1 overflow-x-auto">
        {[
          { id: 'overview', label: 'Media Library & Overview', icon: ImageIcon },
          { id: 'inspector', label: 'Visual Inspector & Tags', icon: Eye },
          { id: 'recent', label: `Recently Checked (${recentCheckedList.length})`, icon: Clock },
          { id: 'similar', label: 'Similar & Duplicates', icon: Copy },
          { id: 'recommendations', label: `Cleanup Suggestions (${overview?.recommendations_count || 0})`, icon: Zap },
          { id: 'groups', label: 'Visual Groups', icon: Layers },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${isActive
                  ? 'bg-purple-600/25 text-purple-300 border border-purple-500/50 shadow-sm shadow-purple-500/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-purple-400' : 'text-gray-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* TAB 1: MEDIA OVERVIEW & LIBRARY */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* ============================================================= */}
          {/* PROMINENT TOP FEATURE: SIMILAR IMAGES (REQUIREMENTS 2, 17-21) */}
          {/* ============================================================= */}
          <div className="p-5 rounded-2xl glass-panel border border-purple-500/40 bg-gradient-to-r from-purple-950/40 via-gray-950/60 to-indigo-950/40 shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                    Similar Images
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Local Qwen2.5-VL + MiniLM
                  </span>
                </div>
                <p className="text-xs text-gray-300">
                  Find visually similar photos from your library using any external reference photo.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleSelectExternalImage}
                />
                <Button
                  variant="primary"
                  size="sm"
                  icon={Upload}
                  loading={similarSearching}
                  onClick={() => fileInputRef.current?.click()}
                  className="shadow-lg shadow-purple-500/25 px-4 py-2 font-semibold text-xs cursor-pointer"
                >
                  {similarSearching ? 'Analyzing Image...' : 'Select an Image'}
                </Button>
                {externalSimilarResults && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={X}
                    onClick={() => setExternalSimilarResults(null)}
                    className="text-xs"
                  >
                    Clear Results
                  </Button>
                )}
              </div>
            </div>

            {similarSearching && (
              <div className="p-4 text-center space-y-2 rounded-xl bg-gray-950/80 border border-purple-500/30 animate-pulse">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400 mx-auto" />
                <p className="text-xs text-purple-200 font-medium">
                  Understanding query image with Local Qwen2.5-VL & retrieving similar matches...
                </p>
              </div>
            )}

            {similarError && (
              <div className="p-3.5 bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs rounded-xl flex items-center justify-between">
                <span>{similarError}</span>
                <button onClick={() => setSimilarError(null)} className="text-rose-400 hover:text-white">✕</button>
              </div>
            )}

            {/* External Query Similarity Results */}
            {externalSimilarResults && (
              <div className="space-y-3 pt-3 border-t border-purple-500/20">
                <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">Matches Found:</span>
                    <span className="text-purple-300 font-mono">
                      {externalSimilarResults.results?.length || 0} similar photos
                    </span>
                  </div>
                  {externalSimilarResults.query_analysis?.scene && (
                    <span className="text-[11px] text-gray-400 bg-gray-900 px-2.5 py-1 rounded-md border border-gray-800">
                      Query Scene: <strong className="text-purple-300">{externalSimilarResults.query_analysis.scene}</strong>
                      {externalSimilarResults.query_analysis.environment ? ` • ${externalSimilarResults.query_analysis.environment}` : ''}
                    </span>
                  )}
                </div>

                {externalSimilarResults.results?.length === 0 ? (
                  <p className="text-xs text-gray-400 py-3 text-center">
                    No visually similar pictorial images were found in your library for this query image.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {externalSimilarResults.results.map((sim, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-gray-950/90 border border-purple-500/30 hover:border-purple-400 flex flex-col justify-between space-y-2.5 transition-all shadow-md"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-16 h-16 rounded-lg bg-gray-900 border border-gray-800 overflow-hidden shrink-0">
                            <img
                              src={sim.preview_url || sim.thumbnail_url}
                              alt={sim.file_name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-bold text-white truncate" title={sim.file_name}>
                                {sim.file_name}
                              </p>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${sim.similarity_score >= 88
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : sim.similarity_score >= 75
                                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  }`}
                              >
                                {sim.similarity_score}% Similar
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400 line-clamp-2 leading-tight">
                              <strong className="text-purple-300 font-medium">Why: </strong>
                              {sim.why_similar || sim.ai_description || 'Visual subject & scenic overlap'}
                            </p>
                          </div>
                        </div>

                        <div className="pt-1.5 border-t border-gray-900 flex items-center justify-between">
                          <span className="text-[10px] text-gray-500 font-mono">
                            Quality: {(sim.quality_score || 85).toFixed(0)}/100
                          </span>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Eye}
                            onClick={() => handleSelectFile(sim.file_id, true)}
                            className="text-[11px] px-2.5 py-0.5 bg-gray-900 hover:bg-purple-600 hover:text-white"
                          >
                            Inspect
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-4 rounded-2xl glass-panel border-gray-800/80 space-y-1">
              <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-blue-400" /> Pictorial Images
              </span>
              <p className="text-xl font-bold text-white">{overview?.pictorial_images_count ?? overview?.total_images ?? 0}</p>
              <span className="text-[10px] text-emerald-400">Indexed in Visual FAISS</span>
            </div>

            <div className="p-4 rounded-2xl glass-panel border-gray-800/80 space-y-1">
              <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Excluded Text-Heavy
              </span>
              <p className="text-xl font-bold text-amber-400">{overview?.text_heavy_excluded_count ?? 0}</p>
              <span className="text-[10px] text-gray-500">Docs / scans filtered out</span>
            </div>

            <div className="p-4 rounded-2xl glass-panel border-gray-800/80 space-y-1">
              <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-purple-400" /> Videos
              </span>
              <p className="text-xl font-bold text-white">{overview?.total_videos ?? 0}</p>
              <span className="text-[10px] text-gray-500">Representative frames</span>
            </div>

            <div className="p-4 rounded-2xl glass-panel border-gray-800/80 space-y-1">
              <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Analyzed Total
              </span>
              <p className="text-xl font-bold text-emerald-400">
                {overview?.analyzed_count ?? 0} <span className="text-xs font-normal text-gray-400">/ {overview?.total_media ?? 0}</span>
              </p>
              <span className="text-[10px] text-gray-500">{overview?.pending_count ?? 0} pending</span>
            </div>

            <div className="p-4 rounded-2xl glass-panel border-purple-500/30 bg-purple-950/20 space-y-1">
              <span className="text-[11px] text-purple-300 font-semibold flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-purple-400" /> Storage Used
              </span>
              <p className="text-xl font-bold text-purple-200">{overview?.total_storage_formatted || '0 B'}</p>
              <span className="text-[10px] text-purple-400">{overview?.recommendations_count || 0} cleanup suggestions</span>
            </div>
          </div>

          {/* Media Grid Header & Filter */}
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">Media Library</h2>
                <span className="text-xs text-gray-500 font-normal">({filteredFiles.length} files)</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMediaTypeFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${mediaTypeFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-gray-200'
                    }`}
                >
                  All ({filesList.length})
                </button>
                <button
                  onClick={() => setMediaTypeFilter('image')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${mediaTypeFilter === 'image' ? 'bg-purple-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-gray-200'
                    }`}
                >
                  Images ({overview?.total_images ?? 0})
                </button>
                <button
                  onClick={() => setMediaTypeFilter('video')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${mediaTypeFilter === 'video' ? 'bg-purple-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-gray-200'
                    }`}
                >
                  Videos ({overview?.total_videos ?? 0})
                </button>
              </div>
            </div>

            {filteredFiles.length === 0 ? (
              <div className="p-12 text-center rounded-2xl glass-panel border-gray-800 space-y-3">
                <ImageIcon className="w-10 h-10 text-gray-600 mx-auto" />
                <h3 className="text-sm font-bold text-white">No media has been analyzed yet.</h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Click "Re-index Visual Library" above to classify pictorial vs text-heavy images and generate AI metadata.
                </p>
                <div className="pt-2">
                  <Button variant="primary" size="sm" icon={RefreshCw} onClick={() => handleTriggerAnalysis(true)}>
                    Run Visual Analysis
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredFiles.map((f) => {
                  const ext = (f.extension || f.file_name.split('.').pop() || '').toUpperCase().replace('.', '');
                  const orientation = f.width && f.height ? (f.width > f.height ? 'Landscape' : f.height > f.width ? 'Portrait' : 'Square') : '';
                  const aspectText = f.aspect_ratio ? `${f.aspect_ratio}${orientation ? ` • ${orientation}` : ''}` : orientation;

                  return (
                    <div
                      key={f.file_id}
                      className={`group p-4 rounded-2xl glass-panel border transition-all flex flex-col justify-between space-y-3 hover:border-purple-500/70 hover:shadow-xl hover:shadow-purple-500/10 ${selectedFileId === f.file_id
                          ? 'border-purple-500 bg-purple-950/20 ring-1 ring-purple-500/40'
                          : 'border-gray-800/90 bg-gray-950/60'
                        }`}
                    >
                      {/* Authentic Original Image Preview (Zero Generated Covers) */}
                      <div
                        onClick={() => handleSelectFile(f.file_id, true)}
                        className="aspect-[4/3] rounded-xl bg-gray-900 border border-gray-800/80 flex items-center justify-center relative overflow-hidden cursor-pointer"
                        title="Click to view file in Visual Inspector"
                      >
                        <img
                          src={mediaService.getThumbnailUrl(f.file_id)}
                          alt={f.file_name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextSibling.style.display = 'flex';
                          }}
                        />
                        <div className="hidden w-full h-full flex-col items-center justify-center bg-gray-900 text-gray-500">
                          {f.media_type === 'video' ? <Play className="w-8 h-8 text-purple-400" /> : <ImageIcon className="w-8 h-8" />}
                        </div>

                        {/* File Format Badge */}
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-white font-mono text-[10px] font-bold border border-gray-700/60 shadow-sm pointer-events-none">
                          {ext || 'IMG'}
                        </span>
                      </div>

                      {/* Clean File & Dimension Information (Zero Pictorial AI Data in Card) */}
                      <div className="space-y-1.5 flex-1">
                        <h3
                          className="text-xs font-bold text-white truncate hover:text-purple-300 transition-colors cursor-pointer"
                          title={f.file_name}
                          onClick={() => handleSelectFile(f.file_id, true)}
                        >
                          {f.file_name}
                        </h3>

                        <div className="space-y-0.5 text-[11px] font-mono text-gray-400">
                          <div className="flex items-center justify-between text-gray-300">
                            <span>{ext || 'FILE'} • {f.size_formatted}</span>
                          </div>

                          {f.width > 0 && f.height > 0 && (
                            <div className="text-gray-400 text-[10px]">
                              {f.width} × {f.height} px
                            </div>
                          )}

                          {aspectText && (
                            <div className="text-purple-300/90 text-[10px]">
                              {aspectText}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Prominent OPEN Button */}
                      <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-gray-500 font-mono truncate">
                          {f.modified_at ? new Date(f.modified_at).toLocaleDateString() : ''}
                        </span>

                        <Button
                          variant="secondary"
                          size="sm"
                          icon={ExternalLink}
                          onClick={() => handleSelectFile(f.file_id, true)}
                          className="px-3 py-1 text-xs font-semibold bg-gray-900 hover:bg-purple-600 hover:text-white border-gray-700 hover:border-purple-500 transition-all cursor-pointer shadow-sm"
                        >
                          OPEN
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 2: VISUAL INSPECTOR (SECTIONS 1, 3, 4, 9, 25 - COMPACT ORDERED UI) */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'inspector' && (
        <div className="space-y-6 animate-fadeIn">
          {!fileDetail ? (
            <div className="p-16 text-center rounded-2xl glass-panel border-gray-800 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto text-gray-500">
                <Eye className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-base font-bold text-white">No Image Selected</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Select any image from the Media Library or Recently Checked to inspect its authentic original image and AI metadata.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left Column: 1. Original Image, 2. Basic Info, 3. Image Quality (Compact) */}
              <div className="xl:col-span-6 2xl:col-span-6 space-y-4">
                {/* 1. AUTHENTIC ORIGINAL IMAGE (FIXED PREVIEW SIZE, OBJECT-CONTAIN, NEVER ENLARGE, NO LIGHTBOX, NO CLICK) */}
                <div className="p-4 rounded-2xl glass-panel border-gray-800/90 bg-gray-950/70 shadow-2xl space-y-3">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-800/80">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold uppercase shrink-0">
                        {fileDetail.media_type}
                      </span>
                      <h3 className="text-xs font-bold text-white truncate" title={fileDetail.file_name}>
                        {fileDetail.file_name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {fileDetail.content_type === 'text_heavy' ? (
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold text-[10px]">
                          Document / Text-Heavy
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
                          Pictorial Image
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Image Viewport: STRICTLY FIXED PREVIEW, OBJECT-CONTAIN, NO ZOOM, CLICK DOES NOTHING */}
                  <div
                    className="relative w-full h-[360px] sm:h-[400px] lg:h-[440px] bg-gray-950 rounded-xl border border-gray-800/90 flex items-center justify-center p-2 overflow-hidden shadow-inner select-none pointer-events-none"
                  >
                    {fileDetail.media_type === 'video' ? (
                      <video
                        controls
                        src={mediaService.getPreviewUrl(fileDetail.file_id)}
                        className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg pointer-events-auto"
                        poster={mediaService.getThumbnailUrl(fileDetail.file_id)}
                      />
                    ) : (
                      <img
                        src={mediaService.getPreviewUrl(fileDetail.file_id)}
                        alt={fileDetail.file_name}
                        className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg shadow-md"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextSibling.style.display = 'flex';
                        }}
                      />
                    )}
                    <div className="hidden w-full h-full flex-col items-center justify-center bg-gray-900 text-gray-500">
                      <ImageIcon className="w-10 h-10 mb-2 text-gray-600" />
                      <span className="text-xs">Original image preview unavailable</span>
                    </div>

                    {/* Dimensions & Aspect Tag on Bottom-Left */}
                    <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none">
                      {fileDetail.width > 0 && fileDetail.height > 0 && (
                        <span className="px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-gray-200 font-mono text-[9px] font-bold border border-gray-700/80 shadow-md">
                          {fileDetail.width} × {fileDetail.height} px
                        </span>
                      )}
                      {fileDetail.aspect_ratio && (
                        <span className="px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-purple-300 font-mono text-[9px] font-bold border border-purple-500/40 shadow-md">
                          {fileDetail.aspect_ratio}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 2. BASIC INFORMATION (COMPACT) */}
                  <div className="space-y-1.5 pt-1">
                    <div className="p-2 bg-gray-950/80 rounded-xl border border-gray-800/80 text-[11px] font-mono text-gray-400 flex items-center justify-between gap-2">
                      <span className="truncate" title={fileDetail.file_path}>{fileDetail.file_path}</span>
                      <span className="shrink-0 text-gray-300 font-semibold">{fileDetail.size_formatted}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                      <div className="p-2 rounded-xl bg-gray-950/60 border border-gray-800">
                        <span className="text-gray-500 text-[9px] block font-sans">Dimensions</span>
                        <span className="font-semibold text-gray-200 text-[11px]">{fileDetail.width > 0 ? `${fileDetail.width}×${fileDetail.height}` : 'N/A'}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-gray-950/60 border border-gray-800">
                        <span className="text-gray-500 text-[9px] block font-sans">Aspect Ratio</span>
                        <span className="font-semibold text-gray-200 text-[11px]">{fileDetail.aspect_ratio || 'Original'}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-gray-950/60 border border-gray-800">
                        <span className="text-gray-500 text-[9px] block font-sans">Status</span>
                        <span className="font-semibold text-purple-300 capitalize text-[11px]">{fileDetail.analysis_status || 'completed'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. IMAGE QUALITY — COMPACT (OBJECTIVE CV / PILLOW METRICS) */}
                <div className="p-4 rounded-2xl glass-panel border-gray-800/80 space-y-2.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-gray-800/80">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-purple-400" />
                      Image Quality
                    </h4>
                    <span className="text-xs font-bold font-mono text-emerald-400">
                      Overall: {(fileDetail.quality_score || 84).toFixed(0)} / 100
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      {
                        name: 'Sharpness',
                        score: fileDetail.quality_factors?.sharpness_score ?? Math.min(100, Math.round((fileDetail.sharpness_score || 350) / 4)),
                        label: fileDetail.quality_factors?.sharpness || 'High'
                      },
                      {
                        name: 'Blur',
                        score: fileDetail.quality_factors?.blur_score ?? Math.max(0, 100 - Math.round(fileDetail.blur_score || 15)),
                        label: fileDetail.quality_factors?.blur || 'Low'
                      },
                      {
                        name: 'Brightness',
                        score: fileDetail.quality_factors?.brightness_score ?? 84,
                        label: fileDetail.quality_factors?.brightness || 'Good'
                      },
                      {
                        name: 'Contrast',
                        score: fileDetail.quality_factors?.contrast_score ?? 88,
                        label: fileDetail.quality_factors?.contrast || 'Good'
                      },
                      {
                        name: 'Exposure',
                        score: fileDetail.quality_factors?.exposure_score ?? 86,
                        label: fileDetail.quality_factors?.exposure || 'Good'
                      },
                      {
                        name: 'Resolution',
                        score: fileDetail.quality_factors?.resolution_score ?? (fileDetail.width >= 1920 ? 95 : (fileDetail.width >= 1280 ? 80 : 65)),
                        label: fileDetail.quality_factors?.resolution || (fileDetail.width >= 1280 ? 'Good' : 'Fair')
                      }
                    ].map((m, idx) => (
                      <div key={idx} className="p-2 rounded-xl bg-gray-950/70 border border-gray-800/70 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-gray-400 font-sans text-[10px]">{m.name}</span>
                          <span className="text-gray-200 font-bold text-[10px]">{Math.round(m.score)}</span>
                        </div>
                        <div className="w-full bg-gray-900 rounded-full h-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${m.score >= 80 ? 'bg-emerald-400' : m.score >= 60 ? 'bg-purple-400' : 'bg-amber-400'
                              }`}
                            style={{ width: `${Math.max(5, Math.min(100, m.score))}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-purple-300 font-sans block text-right">{m.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: 4. AI Visual Description, 5. AI Visual Entities, 6. Manual Tags */}
              <div className="xl:col-span-6 2xl:col-span-6 space-y-4">
                {/* 4. AI VISUAL DESCRIPTION (DETAILED 2-4 SENTENCES) */}
                <div className="p-5 rounded-2xl glass-panel border-purple-500/40 bg-purple-950/20 space-y-2.5 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      AI Visual Description
                    </h4>
                    <span className="text-[10px] text-purple-300 font-mono bg-purple-950/80 px-2.5 py-0.5 rounded-full border border-purple-500/40">
                      Qwen2.5-VL 3B Local AI
                    </span>
                  </div>
                  <p className="text-xs text-gray-200 leading-relaxed bg-gray-950/80 p-3.5 rounded-xl border border-purple-500/20 shadow-inner">
                    {fileDetail.ai_description || fileDetail.description || (
                      fileDetail.content_type === 'text_heavy'
                        ? 'This image was classified as a document or text-heavy file and excluded from visual photographic analysis.'
                        : (fileDetail.analysis_status === 'failed' || fileDetail.error_message
                          ? `Visual analysis failed: ${fileDetail.error_message || 'Local AI processing error'}`
                          : (fileDetail.analysis_status === 'pending'
                            ? 'Analysis pending. Local Qwen2.5-VL visual intelligence will process this image.'
                            : 'No AI visual description available.'))
                    )}
                  </p>
                </div>

                {/* 5. AI VISUAL ENTITIES (COMPACT) */}
                <div className="p-4 rounded-2xl glass-panel border-gray-800/80 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    AI Visual Entities
                  </h4>

                  <div className="space-y-2.5 text-xs">
                    {/* Objects (Compact) */}
                    <div className="flex items-start gap-2">
                      <span className="text-[11px] text-gray-400 font-semibold shrink-0 w-24">Objects:</span>
                      <div className="flex flex-wrap gap-1.5 flex-1">
                        {fileDetail.object_counts && fileDetail.object_counts.length > 0 ? (
                          fileDetail.object_counts.map((item, i) => {
                            const name = item.name || item.object || item;
                            const count = item.count || 1;
                            const emoji = String(name).includes('river') || String(name).includes('water') ? '🌊' :
                              String(name).includes('tree') || String(name).includes('forest') ? '🌳' :
                                String(name).includes('rock') || String(name).includes('stone') ? '🪨' :
                                  String(name).includes('dog') || String(name).includes('animal') ? '🐕' :
                                    String(name).includes('car') || String(name).includes('vehicle') ? '🚗' :
                                      String(name).includes('building') || String(name).includes('house') ? '🏢' : '🔹';
                            return (
                              <span key={i} className="px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[11px] font-medium flex items-center gap-1">
                                <span>{emoji}</span>
                                <span>{name}</span>
                                {count > 1 && <span className="text-[9px] font-mono opacity-70">({count})</span>}
                              </span>
                            );
                          })
                        ) : fileDetail.detected_objects && fileDetail.detected_objects.length > 0 ? (
                          fileDetail.detected_objects.map((obj, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[11px] font-medium">
                              🔹 {obj}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500 text-[11px]">None detected</span>
                        )}
                      </div>
                    </div>

                    {/* Scene & Environment (Compact) */}
                    <div className="flex items-center gap-2 pt-1 border-t border-gray-900">
                      <span className="text-[11px] text-gray-400 font-semibold shrink-0 w-24">Scene:</span>
                      <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[11px] font-medium">
                        🌿 {fileDetail.detected_scenes?.join(', ') || fileDetail.scene || 'Natural landscape'}
                      </span>
                    </div>

                    {fileDetail.environment && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-400 font-semibold shrink-0 w-24">Environment:</span>
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[11px] font-medium">
                          🌲 {fileDetail.environment}
                        </span>
                      </div>
                    )}

                    {/* Colors (Compact) */}
                    {fileDetail.colors && fileDetail.colors.length > 0 && (
                      <div className="flex items-center gap-2 pt-1 border-t border-gray-900">
                        <span className="text-[11px] text-gray-400 font-semibold shrink-0 w-24">Colors:</span>
                        <div className="flex flex-wrap gap-1.5 flex-1">
                          {fileDetail.colors.map((c, i) => {
                            const cLower = String(c).toLowerCase();
                            const dot = cLower.includes('blue') ? '🔵' :
                              cLower.includes('green') ? '🟢' :
                                cLower.includes('brown') ? '🟤' :
                                  cLower.includes('red') ? '🔴' :
                                    cLower.includes('white') ? '⚪' :
                                      cLower.includes('yellow') ? '🟡' : '🟣';
                            return (
                              <span key={i} className="px-2 py-0.5 rounded-md bg-gray-900 text-gray-200 border border-gray-800 text-[10px] flex items-center gap-1">
                                <span>{dot}</span>
                                <span className="capitalize">{c}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Activities (Compact) */}
                    <div className="flex items-center gap-2 pt-1 border-t border-gray-900">
                      <span className="text-[11px] text-gray-400 font-semibold shrink-0 w-24">Activities:</span>
                      <div className="flex flex-wrap gap-1 flex-1">
                        {fileDetail.activities && fileDetail.activities.length > 0 ? (
                          fileDetail.activities.map((act, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-gray-900 text-gray-300 border border-gray-800 text-[11px]">
                              {act}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500 text-[11px]">None</span>
                        )}
                      </div>
                    </div>

                    {/* Relationships (Compact) */}
                    <div className="flex items-start gap-2 pt-1 border-t border-gray-900">
                      <span className="text-[11px] text-gray-400 font-semibold shrink-0 w-24">Relationships:</span>
                      <div className="flex-1 space-y-1">
                        {fileDetail.relationships && fileDetail.relationships.length > 0 ? (
                          fileDetail.relationships.map((rel, i) => (
                            <span key={i} className="text-[11px] text-gray-300 block bg-gray-900/80 px-2 py-1 rounded-md border border-gray-800">
                              {rel}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500 text-[11px]">Standard scene composition</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. MANUAL TAGS (PERSISTENT & USER EDITABLE) */}
                <div className="p-4 rounded-2xl glass-panel border-emerald-500/30 bg-gray-950/60 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-emerald-400" />
                      Manual Tags
                    </h4>
                    {tagsDirty && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-mono">
                        Unsaved changes
                      </span>
                    )}
                  </div>

                  {/* User Tags Chips */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap gap-1.5 min-h-[28px] items-center">
                      {userTags.length === 0 ? (
                        <span className="text-gray-500 text-[11px]">No manual tags added yet. Add custom tags below (e.g. #vacation, #nature).</span>
                      ) : (
                        userTags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-lg bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 text-[11px] font-medium flex items-center gap-1.5 shadow-sm"
                          >
                            <span>#{tag}</span>
                            <button
                              onClick={() => handleRemoveUserTag(tag)}
                              className="text-emerald-400 hover:text-white transition-colors cursor-pointer"
                              title="Remove tag"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Add Tag Input & Save Button */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-900">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddUserTag()}
                      placeholder="Add manual tag (e.g. vacation, nature)..."
                      className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Plus}
                      disabled={!newTagInput.trim()}
                      onClick={handleAddUserTag}
                      className="px-3 py-1.5 text-xs font-semibold"
                    >
                      Add
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={Check}
                      disabled={tagsSaving || !tagsDirty}
                      onClick={handleSaveTags}
                      className="px-3.5 py-1.5 text-xs font-semibold shadow-md shadow-emerald-500/20"
                    >
                      {tagsSaving ? 'Saving...' : 'Save Tags'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 4: RECENTLY CHECKED IMAGES (SECTION 15) */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'recent' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                Recently Inspected Pictorial Images
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                History of recently viewed pictorial images. Documents and text-heavy scans are excluded.
              </p>
            </div>
          </div>

          {recentCheckedList.length === 0 ? (
            <div className="p-12 text-center rounded-2xl glass-panel border-gray-800 space-y-3">
              <Clock className="w-10 h-10 text-gray-600 mx-auto" />
              <h3 className="text-sm font-bold text-white">No recently inspected images.</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Inspect any pictorial image in the Visual Inspector or Search Results to record it in your history.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {recentCheckedList.map((item) => (
                <div
                  key={item.file_id}
                  onClick={() => handleSelectFile(item.file_id, true)}
                  className="p-3.5 rounded-2xl glass-panel border border-gray-800 hover:border-purple-500/70 cursor-pointer space-y-3 transition-all hover:shadow-lg hover:shadow-purple-500/10 group"
                >
                  <div className="aspect-video rounded-xl bg-gray-900 border border-gray-800 overflow-hidden relative">
                    <img
                      src={mediaService.getThumbnailUrl(item.file_id)}
                      alt={item.file_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/75 text-white font-mono text-[9px]">
                      Q: {item.quality_score?.toFixed(0)}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-white truncate" title={item.file_name}>
                      {item.file_name}
                    </h4>
                    {item.ai_description && (
                      <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                        {item.ai_description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono pt-1 border-t border-gray-800/60">
                    <span>{item.size_formatted}</span>
                    <span className="text-purple-400 flex items-center gap-1">
                      <Eye className="w-3 h-3" /> Inspect
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 5: SIMILAR & DUPLICATES */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'similar' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Similar & Duplicate Media</h2>
              <p className="text-xs text-gray-400">
                Visual vector comparisons strictly between genuine pictorial images. Documents and text scans are excluded.
              </p>
            </div>
          </div>

          {/* Section: Exact Duplicates */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Exact Duplicates (100% Match)
            </h3>
            {exactDuplicates.length === 0 ? (
              <div className="p-4 rounded-xl bg-gray-950/40 border border-gray-800 text-xs text-gray-500">
                No exact duplicate files detected.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {exactDuplicates.map((item, i) => (
                  <div key={i} className="p-3.5 rounded-xl glass-panel border-emerald-500/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gray-900 border border-gray-800 overflow-hidden shrink-0">
                        <img src={mediaService.getThumbnailUrl(item.file_id)} alt={item.file_name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white truncate max-w-[200px]">{item.file_name}</p>
                        <span className="text-[10px] text-gray-400 font-mono">{item.size_formatted} • Quality: {item.quality_score.toFixed(0)}</span>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" icon={Eye} onClick={() => handleSelectFile(item.file_id, true)}>
                      Inspect
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Near Duplicates */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono flex items-center gap-2">
              <Copy className="w-4 h-4" /> Near Duplicates (≥ 88% Similarity)
            </h3>
            {nearDuplicates.length === 0 ? (
              <div className="p-4 rounded-xl bg-gray-950/40 border border-gray-800 text-xs text-gray-500">
                No near-duplicate media files found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {nearDuplicates.map((item, i) => (
                  <div key={i} className="p-3.5 rounded-xl glass-panel border-amber-500/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gray-900 border border-gray-800 overflow-hidden shrink-0">
                        <img src={mediaService.getThumbnailUrl(item.file_id)} alt={item.file_name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white truncate max-w-[200px]">{item.file_name}</p>
                        <span className="text-[10px] text-amber-300 font-mono">{item.similarity_score}% Similar • {item.size_formatted}</span>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" icon={Eye} onClick={() => handleSelectFile(item.file_id, true)}>
                      Inspect
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Visually Similar Images */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider font-mono flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Visually Similar Images
            </h3>
            {visuallySimilar.length === 0 ? (
              <div className="p-4 rounded-xl bg-gray-950/40 border border-gray-800 text-xs text-gray-500">
                Select an image in Media Library to explore its visually similar matches.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {visuallySimilar.map((item, i) => (
                  <div key={i} className="p-3.5 rounded-xl glass-panel border-purple-500/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gray-900 border border-gray-800 overflow-hidden shrink-0">
                        <img src={mediaService.getThumbnailUrl(item.file_id)} alt={item.file_name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white truncate max-w-[200px]">{item.file_name}</p>
                        <span className="text-[10px] text-purple-300 font-mono">{item.similarity_score}% Similar • Quality: {item.quality_score.toFixed(0)}</span>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" icon={Eye} onClick={() => handleSelectFile(item.file_id, true)}>
                      Inspect
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 6: AI CLEANUP RECOMMENDATIONS */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'recommendations' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-400" />
                AI Media Cleanup Recommendations
              </h2>
              <p className="text-xs text-gray-400">
                Multi-signal assessments (quality, size, similarity, redundancy). Files are <strong className="text-purple-300">never automatically deleted</strong>.
              </p>
            </div>
          </div>

          {recommendations.length === 0 ? (
            <div className="p-12 text-center rounded-2xl glass-panel border-gray-800 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="text-sm font-bold text-white">No Redundant Media Found</h4>
              <p className="text-xs text-gray-400">All media files appear unique and optimal in quality and storage.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map((rec) => (
                <div key={rec.id} className="p-5 rounded-2xl glass-panel border-purple-500/30 bg-purple-950/10 space-y-4 shadow-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase font-mono">
                        Recommendation: {rec.action}
                      </span>
                      <h4 className="text-sm font-bold text-white break-all">{rec.file_name}</h4>
                      <p className="text-[11px] text-gray-400 font-mono">{rec.file_path}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-emerald-400 font-mono block">
                        +{rec.potential_storage_recovery_formatted}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">Savings</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-gray-950/60 border border-gray-800 text-xs text-gray-300 leading-relaxed">
                    <span className="font-semibold text-purple-300">Reason: </span>
                    {rec.reason}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800/80">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRecAction(rec.id, 'ignore')}
                    >
                      Ignore
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRecAction(rec.id, 'keep')}
                    >
                      Keep
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={Trash2}
                      onClick={() => setDeleteModalFile(rec)}
                    >
                      Approve & Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 7: VISUAL GROUPS (SECTIONS 16-19) */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                Visual Groups & Collections
              </h2>
              <p className="text-xs text-gray-400">
                Logical groupings of genuine pictorial images. Groups use original image covers and never modify physical files.
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              icon={FolderPlus}
              onClick={handleOpenCreateGroup}
            >
              + Create Visual Group
            </Button>
          </div>

          {visualGroups.length === 0 ? (
            <div className="p-12 text-center rounded-2xl glass-panel border-gray-800 space-y-4">
              <Layers className="w-10 h-10 text-gray-600 mx-auto" />
              <h3 className="text-sm font-bold text-white">No Visual Groups Yet</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Create your first visual collection with multiple pictorial images (e.g. "Goa Trip", "Sunset Collection").
              </p>
              <Button variant="primary" size="sm" icon={FolderPlus} onClick={handleOpenCreateGroup}>
                Create Visual Group
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {visualGroups.map((g) => (
                <div key={g.id} className="p-5 rounded-2xl glass-panel border-gray-800/90 bg-gray-950/50 space-y-4 shadow-xl hover:border-purple-500/60 transition-all group">
                  {/* Original Cover Image */}
                  <div className="aspect-video rounded-xl bg-gray-900 border border-gray-800 overflow-hidden relative">
                    <img
                      src={API_BASE_URL + (g.representative_file_id ? `/api/media/${g.representative_file_id}/thumbnail` : (g.items?.[0]?.file_id ? `/api/media/${g.items[0].file_id}/thumbnail` : ''))}
                      alt={g.group_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <div className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-black/75 text-white text-[10px] font-mono font-bold shadow-md">
                      {g.item_count} Original Images
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {g.group_name}
                      </h4>
                      <span className="text-[10px] text-purple-300 font-mono">
                        {g.group_type === 'custom_user_group' ? 'User Collection' : 'Automatic Cluster'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteVisualGroup(g.id)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                      title="Delete Group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Items list preview */}
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {g.items?.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectFile(item.file_id, true)}
                        className="p-2 rounded-xl bg-gray-900/60 hover:bg-purple-950/25 border border-gray-800/60 flex items-center justify-between text-xs cursor-pointer transition-colors"
                      >
                        <span className="text-gray-300 truncate max-w-[180px]" title={item.file_name}>
                          {item.file_name}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {item.size_formatted}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 1: CREATE VISUAL GROUP MODAL */}
      {/* --------------------------------------------------------------------- */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="p-6 rounded-2xl glass-panel border-purple-500/40 bg-gray-950 max-w-xl w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-purple-400" />
                Create Visual Group
              </h3>
              <button onClick={() => setShowCreateGroupModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Group Name:</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Goa Trip, Sunset Collection, Dog Album..."
                  className="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Select Images ({selectedGroupFiles.length} selected):
                </label>
                <div className="max-h-60 overflow-y-auto border border-gray-800 rounded-xl p-2 bg-gray-900/40 grid grid-cols-2 gap-2">
                  {filesList.map((f) => {
                    const isSelected = selectedGroupFiles.includes(f.file_id);
                    return (
                      <div
                        key={f.file_id}
                        onClick={() => handleToggleGroupFile(f.file_id)}
                        className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${isSelected ? 'bg-purple-950/50 border-purple-500 text-white' : 'bg-gray-950/60 border-gray-800 text-gray-300 hover:bg-gray-900'
                          }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-gray-900 border border-gray-800 overflow-hidden shrink-0">
                          <img src={mediaService.getThumbnailUrl(f.file_id)} alt={f.file_name} className="w-full h-full object-cover" />
                        </div>
                        <div className="truncate flex-1 text-xs">
                          <p className="truncate font-medium">{f.file_name}</p>
                          <span className="text-[10px] text-gray-500 font-mono">{f.size_formatted}</span>
                        </div>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-700'}`}>
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
              <Button variant="ghost" size="sm" onClick={() => setShowCreateGroupModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!newGroupName.trim() || selectedGroupFiles.length === 0 || createGroupLoading}
                onClick={handleCreateVisualGroup}
              >
                {createGroupLoading ? 'Creating...' : `Create Group (${selectedGroupFiles.length} Images)`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 3: USER CONFIRMATION MODAL FOR DELETION */}
      {/* --------------------------------------------------------------------- */}
      {deleteModalFile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="p-6 rounded-2xl glass-panel border-red-500/40 bg-gray-950 max-w-md w-full space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center gap-3 text-red-400">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Confirm User-Approved Deletion</h3>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">'{deleteModalFile.file_name}'</strong>?
              This action requires explicit approval and cannot be undone automatically.
            </p>

            <div className="p-3 rounded-xl bg-gray-900 border border-gray-800 text-xs font-mono space-y-1">
              <p className="text-gray-400 truncate">Path: {deleteModalFile.file_path}</p>
              <p className="text-emerald-400 font-semibold">Storage to Free: {deleteModalFile.potential_storage_recovery_formatted || deleteModalFile.size_formatted}</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteModalFile(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                onClick={confirmDeleteFile}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
