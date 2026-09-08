import React, { useState, useEffect } from 'react';
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
  CheckCircle
} from 'lucide-react';
import { mediaService, API_BASE_URL } from '../services/mediaService';
import { Button } from '../components/common/Button';

export const MediaIntelligence = () => {
  const [activeTab, setActiveTab] = useState('overview'); // overview, inspector, similar, recommendations, groups
  const [overview, setOverview] = useState(null);
  const [status, setStatus] = useState(null);
  const [mediaTypeFilter, setMediaTypeFilter] = useState('all');
  const [filesList, setFilesList] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [fileDetail, setFileDetail] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [visualGroups, setVisualGroups] = useState([]);
  const [similarMediaList, setSimilarMediaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [deleteModalFile, setDeleteModalFile] = useState(null);

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
      const [ov, files, recs, groups, st] = await Promise.all([
        mediaService.getOverview().catch(() => null),
        mediaService.getMediaFiles('all', 120).catch(() => []),
        mediaService.getRecommendations().catch(() => []),
        mediaService.getVisualGroups().catch(() => []),
        mediaService.getStatus().catch(() => null)
      ]);

      setOverview(ov);
      setFilesList(files || []);
      setRecommendations(recs || []);
      setVisualGroups(groups || []);
      setStatus(st);
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
    setActionMessage('Visual Analysis started in background...');
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
      const detail = await mediaService.getFileDetail(fileId);
      setFileDetail(detail);
      const similar = await mediaService.getSimilarMedia(fileId);
      setSimilarMediaList(similar || []);
    } catch (e) {
      console.error('Error loading file detail:', e);
    }
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
      await loadDashboardData();
    } catch (e) {
      setActionMessage('Delete failed: ' + e.message);
    }
    setTimeout(() => setActionMessage(null), 4000);
  };

  const getQualityBadgeColor = (score) => {
    if (score >= 75) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    if (score >= 50) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    return 'bg-red-500/20 text-red-300 border-red-500/40';
  };

  // Groupings for Similar & Duplicates tab
  const exactDuplicates = [];
  const nearDuplicates = [];
  const visuallySimilar = [];
  const similarVideos = [];

  // Group similar items across all known relations
  similarMediaList.forEach(sim => {
    if (sim.visual_category === 'video') {
      similarVideos.push(sim);
    } else if (sim.similarity_type === 'exact_duplicate' || sim.similarity_score >= 99) {
      exactDuplicates.push(sim);
    } else if (sim.similarity_score >= 88) {
      nearDuplicates.push(sim);
    } else {
      visuallySimilar.push(sim);
    }
  });

  const filteredFiles = filesList.filter(f => {
    if (mediaTypeFilter === 'image') return f.media_type === 'image';
    if (mediaTypeFilter === 'video') return f.media_type === 'video';
    return true;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">
              Visual & Media Intelligence
            </h1>
          </div>
          <p className="text-xs text-gray-400 mt-1 font-medium">
            Local visual processing, object & scene recognition, quality analysis, visual similarity, and explainable recommendations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {overview && (
            <div className="text-xs text-gray-400 mr-2 font-mono">
              {overview.analyzed_count === 0 && !analyzing ? (
                <span className="text-amber-400">No media analyzed yet</span>
              ) : analyzing ? (
                <span className="text-indigo-300">Analyzing {status?.processed_media || 0} / {status?.total_media || overview.total_media} media...</span>
              ) : (
                <span className="text-emerald-400">{overview.analyzed_count} / {overview.total_media} media analyzed</span>
              )}
            </div>
          )}

          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            disabled={analyzing}
            onClick={() => handleTriggerAnalysis(false)}
            className={analyzing ? 'animate-spin' : ''}
          >
            {analyzing ? `Analyzing (${status?.processed_media || 0}/${status?.total_media || 0})...` : 'Run Visual Analysis'}
          </Button>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionMessage && (
        <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 text-blue-300 text-xs flex items-center justify-between animate-fadeIn">
          <span className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-400" />
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
          { id: 'inspector', label: 'Visual Inspector', icon: Eye },
          { id: 'similar', label: 'Similar & Duplicates', icon: Copy },
          { id: 'recommendations', label: `Cleanup Recommendations (${overview?.recommendations_count || 0})`, icon: Zap },
          { id: 'groups', label: 'Visual Groups', icon: Layers },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/10'
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
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-4 rounded-2xl glass-panel border-gray-800/80 space-y-1">
              <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-blue-400" /> Total Images
              </span>
              <p className="text-xl font-bold text-white">{overview?.total_images ?? 0}</p>
              <span className="text-[10px] text-gray-500">{overview?.total_storage_formatted || '0 B'} total</span>
            </div>

            <div className="p-4 rounded-2xl glass-panel border-gray-800/80 space-y-1">
              <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-purple-400" /> Total Videos
              </span>
              <p className="text-xl font-bold text-white">{overview?.total_videos ?? 0}</p>
              <span className="text-[10px] text-gray-500">Representative frames</span>
            </div>

            <div className="p-4 rounded-2xl glass-panel border-gray-800/80 space-y-1">
              <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Analyzed Media
              </span>
              <p className="text-xl font-bold text-emerald-400">
                {overview?.analyzed_count ?? 0} <span className="text-xs font-normal text-gray-400">/ {overview?.total_media ?? 0}</span>
              </p>
              <span className="text-[10px] text-gray-500">{overview?.pending_count ?? 0} pending</span>
            </div>

            <div className="p-4 rounded-2xl glass-panel border-gray-800/80 space-y-1">
              <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-amber-400" /> Screenshots
              </span>
              <p className="text-xl font-bold text-amber-400">{overview?.screenshots_count ?? 0}</p>
              <span className="text-[10px] text-gray-500">UI & app captures</span>
            </div>

            <div className="p-4 rounded-2xl glass-panel border-purple-500/30 bg-purple-950/20 space-y-1">
              <span className="text-[11px] text-purple-300 font-semibold flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-purple-400" /> Potential Recovery
              </span>
              <p className="text-xl font-bold text-purple-200">{overview?.potential_recovery_formatted || '0 B'}</p>
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
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    mediaTypeFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  All ({filesList.length})
                </button>
                <button
                  onClick={() => setMediaTypeFilter('image')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    mediaTypeFilter === 'image' ? 'bg-purple-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Images ({overview?.total_images ?? 0})
                </button>
                <button
                  onClick={() => setMediaTypeFilter('video')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    mediaTypeFilter === 'video' ? 'bg-purple-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-gray-200'
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
                  Click "Run Visual Analysis" above to process visual features, quality scores, object detection, and similarity.
                </p>
                <div className="pt-2">
                  <Button variant="primary" size="sm" icon={RefreshCw} onClick={() => handleTriggerAnalysis(true)}>
                    Run Visual Analysis
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                {filteredFiles.map((f) => (
                  <div
                    key={f.file_id}
                    onClick={() => handleSelectFile(f.file_id, true)}
                    className={`group p-2.5 rounded-2xl glass-panel border transition-all cursor-pointer space-y-2 hover:border-purple-500/80 hover:shadow-lg hover:shadow-purple-500/10 ${
                      selectedFileId === f.file_id ? 'border-purple-500 bg-purple-950/30 ring-1 ring-purple-500/50' : 'border-gray-800/80 bg-gray-950/40'
                    }`}
                  >
                    {/* Thumbnail Container */}
                    <div className="aspect-square rounded-xl bg-gray-900 flex items-center justify-center relative overflow-hidden border border-gray-800/80">
                      <img
                        src={mediaService.getThumbnailUrl(f.file_id)}
                        alt={f.file_name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextSibling.style.display = 'flex';
                        }}
                      />
                      {/* Fallback Icon if image load fails */}
                      <div className="hidden w-full h-full flex-col items-center justify-center bg-gray-900 text-gray-600">
                        {f.media_type === 'video' ? <Play className="w-6 h-6 text-purple-400" /> : <ImageIcon className="w-6 h-6" />}
                      </div>

                      {/* Top Badges */}
                      <div className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1 pointer-events-none">
                        {f.is_screenshot && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-600/90 text-white font-bold text-[9px] shadow-sm">
                            UI
                          </span>
                        )}
                        {f.quality_score > 0 && (
                          <span className={`px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold shadow-sm ${getQualityBadgeColor(f.quality_score)}`}>
                            {f.quality_score.toFixed(0)}
                          </span>
                        )}
                      </div>

                      {f.media_type === 'video' && (
                        <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 text-white text-[9px] font-mono flex items-center gap-1">
                          <Play className="w-2.5 h-2.5 text-purple-400" />
                          {f.duration > 0 ? `${Math.round(f.duration)}s` : 'Video'}
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-gray-200 truncate" title={f.file_name}>
                        {f.file_name}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                        <span>{f.size_formatted}</span>
                        <span className="capitalize text-purple-300">{f.visual_category || f.media_type}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 2: VISUAL INSPECTOR */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'inspector' && (
        <div className="space-y-6">
          {!fileDetail ? (
            <div className="p-12 text-center rounded-2xl glass-panel border-gray-800 space-y-2">
              <Eye className="w-8 h-8 text-gray-600 mx-auto" />
              <p className="text-xs text-gray-400">Select any image or video from the Media Library to inspect its visual intelligence.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Media Preview & File Information */}
              <div className="p-6 rounded-2xl glass-panel border-gray-800/80 space-y-5">
                <div className="aspect-video rounded-2xl bg-gray-950 border border-gray-800 flex items-center justify-center overflow-hidden relative shadow-inner">
                  {fileDetail.media_type === 'video' ? (
                    <video
                      controls
                      src={mediaService.getPreviewUrl(fileDetail.file_id)}
                      className="w-full h-full object-contain"
                      poster={mediaService.getThumbnailUrl(fileDetail.file_id)}
                    />
                  ) : (
                    <img
                      src={mediaService.getPreviewUrl(fileDetail.file_id)}
                      alt={fileDetail.file_name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextSibling.style.display = 'flex';
                      }}
                    />
                  )}
                  <div className="hidden w-full h-full flex-col items-center justify-center bg-gray-900 text-gray-500">
                    <ImageIcon className="w-10 h-10 mb-1" />
                    <span className="text-xs">Preview unavailable</span>
                  </div>

                  {fileDetail.is_screenshot && (
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-blue-600/90 text-white font-bold text-[10px] shadow-md">
                      Screenshot ({Math.round((fileDetail.screenshot_confidence || 0.8) * 100)}% conf)
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-mono uppercase font-bold">
                      {fileDetail.media_type}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">{fileDetail.size_formatted}</span>
                  </div>
                  <h3 className="text-base font-bold text-white break-all">{fileDetail.file_name}</h3>
                  <p className="text-xs text-gray-400 font-mono break-all bg-gray-950/60 p-2 rounded-xl border border-gray-800/60">
                    {fileDetail.file_path}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                  <div className="p-2.5 rounded-xl bg-gray-950/60 border border-gray-800">
                    <span className="text-gray-500 text-[10px] block">Resolution</span>
                    <span className="font-semibold text-gray-200">{fileDetail.width > 0 ? `${fileDetail.width} × ${fileDetail.height}` : 'N/A'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-gray-950/60 border border-gray-800">
                    <span className="text-gray-500 text-[10px] block">Aspect Ratio</span>
                    <span className="font-semibold text-gray-200">{fileDetail.aspect_ratio || 'N/A'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-gray-950/60 border border-gray-800">
                    <span className="text-gray-500 text-[10px] block">Visual Category</span>
                    <span className="font-semibold text-purple-300 capitalize">{fileDetail.visual_category}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-gray-950/60 border border-gray-800">
                    <span className="text-gray-500 text-[10px] block">Analysis Status</span>
                    <span className="font-semibold text-emerald-400 capitalize">{fileDetail.analysis_status}</span>
                  </div>
                </div>

                {/* AI Recommendation for Selected Image */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/30 to-indigo-950/30 border border-purple-500/30 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-purple-400" />
                      AI Recommendation
                    </h4>
                    {fileDetail.recommendation?.score && (
                      <span className="text-[10px] text-purple-300 font-mono">
                        Score: {fileDetail.recommendation.score.toFixed(0)}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-300 leading-relaxed">
                    {fileDetail.recommendation?.reason || "No cleanup recommendation for this image. Visual quality is optimal and item is unique."}
                  </p>

                  {fileDetail.recommendation?.potential_recovery_bytes > 0 && (
                    <div className="p-2 rounded-xl bg-gray-950/60 border border-gray-800 text-[11px] font-mono text-emerald-300 flex items-center justify-between">
                      <span>Potential Storage Recovery:</span>
                      <span className="font-bold">{fileDetail.recommendation.potential_recovery_formatted}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    {fileDetail.recommendation?.action === 'review' ? (
                      <Button
                        variant="danger"
                        size="sm"
                        icon={Trash2}
                        onClick={() => setDeleteModalFile(fileDetail)}
                      >
                        Review for Removal
                      </Button>
                    ) : (
                      <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Keep Recommended
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column (2 cols): Quality, Objects, Scenes, and Visual Similarity */}
              <div className="lg:col-span-2 space-y-5">
                {/* 1. Quality Analysis Breakdown */}
                <div className="p-6 rounded-2xl glass-panel border-gray-800/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-purple-400" />
                        Estimated Quality Score
                      </h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Measurable properties: Laplacian variance (sharpness), FFT blur score, dynamic contrast & resolution.
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-xl border text-sm font-mono font-bold ${getQualityBadgeColor(fileDetail.quality_score)}`}>
                      {fileDetail.quality_score.toFixed(0)} / 100
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="p-3 rounded-xl bg-gray-950/60 border border-gray-800">
                      <span className="text-gray-500 text-[10px] block">Sharpness</span>
                      <span className="font-bold text-gray-200">{fileDetail.quality_factors?.sharpness || 'Medium'}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-950/60 border border-gray-800">
                      <span className="text-gray-500 text-[10px] block">Blur</span>
                      <span className="font-bold text-gray-200">
                        {fileDetail.blur_score > 60 ? 'High' : fileDetail.blur_score > 30 ? 'Medium' : 'Low'}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-950/60 border border-gray-800">
                      <span className="text-gray-500 text-[10px] block">Resolution</span>
                      <span className="font-bold text-gray-200">{fileDetail.width > 0 ? `${fileDetail.width} × ${fileDetail.height}` : 'N/A'}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-950/60 border border-gray-800">
                      <span className="text-gray-500 text-[10px] block">Aspect Ratio</span>
                      <span className="font-bold text-gray-200">{fileDetail.aspect_ratio || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Detected Objects & Scene Understanding */}
                <div className="p-6 rounded-2xl glass-panel border-gray-800/80 space-y-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    Visual Content & Detected Information
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <span className="text-[11px] text-gray-400 font-semibold block">Detected Objects:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {fileDetail.detected_objects && fileDetail.detected_objects.length > 0 ? (
                          fileDetail.detected_objects.map((obj, i) => (
                            <span key={i} className="px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-xs font-medium">
                              #{obj}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500">General visual textures</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[11px] text-gray-400 font-semibold block">Detected Scene & Context:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {fileDetail.detected_scenes && fileDetail.detected_scenes.length > 0 ? (
                          fileDetail.detected_scenes.map((scn, i) => (
                            <span key={i} className="px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30 text-xs font-medium">
                              {scn}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500">Standard scene</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Visually Similar Images Comparison */}
                <div className="p-6 rounded-2xl glass-panel border-gray-800/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Copy className="w-4 h-4 text-purple-400" />
                        Similar Images & Visual Comparison ({similarMediaList.length})
                      </h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Direct visual vector comparison (512-dim embedding cosine similarity).
                      </p>
                    </div>
                  </div>

                  {similarMediaList.length === 0 ? (
                    <div className="p-6 text-center rounded-xl bg-gray-950/40 border border-gray-800 text-xs text-gray-400">
                      No visually similar media items found for this file.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {similarMediaList.map((sim, i) => (
                        <div key={i} className="p-3.5 rounded-xl bg-gray-950/60 border border-gray-800 hover:border-purple-500/50 flex items-center justify-between gap-4 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-lg bg-gray-900 border border-gray-800 overflow-hidden shrink-0">
                              <img
                                src={mediaService.getThumbnailUrl(sim.file_id)}
                                alt={sim.file_name}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white truncate max-w-[200px]" title={sim.file_name}>
                                {sim.file_name}
                              </p>
                              <div className="flex items-center gap-3 text-[10px] text-gray-400 font-mono mt-0.5">
                                <span>Quality: <strong className="text-gray-200">{sim.quality_score.toFixed(0)}/100</strong></span>
                                <span>Size: <strong className="text-gray-200">{sim.size_formatted}</strong></span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <span className="text-sm font-bold text-purple-300 font-mono">{sim.similarity_score}%</span>
                              <span className="text-[10px] text-gray-500 block uppercase font-mono">Similarity</span>
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Eye}
                              onClick={() => handleSelectFile(sim.file_id, true)}
                            >
                              Inspect
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 3: SIMILAR & DUPLICATES (GLOBAL VIEW) */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'similar' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Similar & Duplicate Media</h2>
              <p className="text-xs text-gray-400">
                Visual embeddings & hash matching partition media into Exact Duplicates, Near Duplicates, and Visually Similar images.
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
      {/* TAB 4: AI CLEANUP RECOMMENDATIONS */}
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

                  {rec.target_better_file && (
                    <div className="p-2.5 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-[11px] text-indigo-200 flex items-center justify-between">
                      <span>Preferred Alternative: <strong>{rec.target_better_file.file_name}</strong></span>
                      <span className="font-mono text-emerald-300">Quality: {rec.target_better_file.quality_score.toFixed(0)}</span>
                    </div>
                  )}

                  {/* Explicit Action Buttons */}
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
      {/* TAB 5: VISUAL GROUPS */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Visual Groups</h2>
              <p className="text-xs text-gray-400">Logical clusters formed by visual context, scenes, and similarity without moving physical files.</p>
            </div>
          </div>

          {visualGroups.length === 0 ? (
            <div className="p-12 text-center rounded-2xl glass-panel border-gray-800">
              <p className="text-xs text-gray-400">No visual groups generated yet. Run visual analysis to construct collections.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visualGroups.map((g) => (
                <div key={g.id} className="p-5 rounded-2xl glass-panel border-gray-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-purple-400" />
                      {g.group_name}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 text-[10px] font-mono">
                      {g.item_count} items
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {g.items.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectFile(item.file_id, true)}
                        className="p-2 rounded-xl bg-gray-950/50 hover:bg-purple-950/20 border border-gray-800/60 flex items-center justify-between text-xs cursor-pointer transition-colors"
                      >
                        <span className="text-gray-300 truncate max-w-[200px]" title={item.file_name}>
                          {item.file_name}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {item.quality_score > 0 ? `Q: ${item.quality_score.toFixed(0)}` : item.size_formatted}
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

      {/* User Confirmation Modal for Safe Deletion */}
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
