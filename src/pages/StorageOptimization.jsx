import React, { useState, useEffect, useMemo } from 'react';
import {
  HardDrive,
  Sparkles,
  Zap,
  Archive,
  FolderOpen,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Layers,
  FileText,
  Image as ImageIcon,
  Code,
  FileArchive,
  FileQuestion,
  ChevronRight,
  ShieldCheck,
  Check,
  X,
  Sliders,
  ArrowRight,
  Info,
  Loader2,
  Filter,
  CheckSquare,
  Square,
  Eye,
  Copy,
  FileCheck,
  SlidersHorizontal
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { useApp } from '../context/AppContext';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Modal } from '../components/common/Modal';

export const StorageOptimization = () => {
  const { addToast } = useApp();

  // Primary Data State
  const [summary, setSummary] = useState(null);
  const [largeFiles, setLargeFiles] = useState([]);
  const [largeFilesTotal, setLargeFilesTotal] = useState(0);
  const [optimizableFiles, setOptimizableFiles] = useState([]);
  const [optimizableFilesTotal, setOptimizableFilesTotal] = useState(0);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [loadingOptimizable, setLoadingOptimizable] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter & Query State
  const [minSizeMb, setMinSizeMb] = useState(5.0);
  const [limit, setLimit] = useState(50);
  const [selectedFileIds, setSelectedFileIds] = useState([]);

  // Optimization Modal State
  const [optimizeTargetFile, setOptimizeTargetFile] = useState(null);
  const [optimizeMode, setOptimizeMode] = useState('lossless'); // 'lossless' | 'lossy'
  const [lossyQuality, setLossyQuality] = useState(82);
  const [bmpTargetFormat, setBmpTargetFormat] = useState('png');
  const [maxDimension, setMaxDimension] = useState(null);
  const [pdfImageQuality, setPdfImageQuality] = useState(75);
  const [analyzingCandidate, setAnalyzingCandidate] = useState(false);
  const [candidateResult, setCandidateResult] = useState(null);
  const [candidateError, setCandidateError] = useState(null);
  const [applyingOptimization, setApplyingOptimization] = useState(false);
  const [applyResult, setApplyResult] = useState(null);
  const [replaceOriginal, setReplaceOriginal] = useState(false);
  const [comparisonTab, setComparisonTab] = useState('metrics'); // 'metrics' | 'preview'
  const [previewTarget, setPreviewTarget] = useState('candidate'); // 'candidate' | 'original'
  // ZIP Archive Modal State
  const [showZipModal, setShowZipModal] = useState(false);
  const [zipDestination, setZipDestination] = useState('');
  const [zipCompressionLevel, setZipCompressionLevel] = useState(9);
  const [zipOverwrite, setZipOverwrite] = useState(false);
  const [creatingZip, setCreatingZip] = useState(false);
  const [zipResult, setZipResult] = useState(null);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    loadLargeFiles(minSizeMb, limit);
  }, [minSizeMb, limit]);

  const loadAllData = async () => {
    setIsRefreshing(true);
    await Promise.all([
      loadSummary(),
      loadOptimizableFiles(),
      loadLargeFiles(minSizeMb, limit)
    ]);
    setIsRefreshing(false);
  };

  const loadSummary = async () => {
    setLoadingSummary(true);
    try {
      const data = await storageService.getStorageSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load storage summary:', err);
      addToast('Failed to load storage summary metrics', 'error');
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadOptimizableFiles = async () => {
    setLoadingOptimizable(true);
    try {
      const data = await storageService.getOptimizableFiles({ limit: 50 });
      setOptimizableFiles(data.items || []);
      setOptimizableFilesTotal(data.total_count || 0);
    } catch (err) {
      console.error('Failed to load optimizable files:', err);
      addToast('Failed to load optimizable files list', 'error');
    } finally {
      setLoadingOptimizable(false);
    }
  };

  const loadLargeFiles = async (minMb, currentLimit) => {
    setLoadingFiles(true);
    try {
      const data = await storageService.getLargeFiles({
        min_size_mb: minMb,
        limit: currentLimit
      });
      setLargeFiles(data.items || []);
      setLargeFilesTotal(data.total_count || 0);
    } catch (err) {
      console.error('Failed to load large files:', err);
      addToast('Failed to load large files analysis', 'error');
    } finally {
      setLoadingFiles(false);
    }
  };

  // --------------------------------------------------------------------------
  // Selection Logic
  // --------------------------------------------------------------------------
  const handleToggleSelectFile = (fileId) => {
    setSelectedFileIds(prev =>
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    );
  };

  const handleSelectAll = () => {
    if (selectedFileIds.length === largeFiles.length) {
      setSelectedFileIds([]);
    } else {
      setSelectedFileIds(largeFiles.map(f => f.id));
    }
  };

  const selectedFilesList = useMemo(() => {
    return largeFiles.filter(f => selectedFileIds.includes(f.id));
  }, [largeFiles, selectedFileIds]);

  const selectedTotalBytes = useMemo(() => {
    return selectedFilesList.reduce((acc, f) => acc + (f.size_bytes || 0), 0);
  }, [selectedFilesList]);

  // --------------------------------------------------------------------------
  // Optimization Actions
  // --------------------------------------------------------------------------
  const handleOpenOptimize = (file) => {
    setOptimizeTargetFile(file);
    const isPdf = file.extension?.toLowerCase() === '.pdf';
    setOptimizeMode(isPdf ? 'lossy' : 'lossless');
    setLossyQuality(82);
    setBmpTargetFormat('png');
    setCandidateResult(null);
    setCandidateError(null);
    setApplyResult(null);
    setReplaceOriginal(false);
    setMaxDimension(null);
    setPdfImageQuality(75);
    setComparisonTab('metrics');
    setPreviewTarget('candidate');
  };

  const handleCloseOptimize = () => {
    setOptimizeTargetFile(null);
    setCandidateResult(null);
    setCandidateError(null);
    setApplyResult(null);
    setComparisonTab('metrics');
    setPreviewTarget('candidate');
  };

  const handleGenerateCandidate = async () => {
    if (!optimizeTargetFile) return;
    setAnalyzingCandidate(true);
    setCandidateError(null);
    setCandidateResult(null);

    try {
      const isPdf = optimizeTargetFile.extension?.toLowerCase() === '.pdf';
      const payload = {
        file_id: optimizeTargetFile.id,
        mode: optimizeMode,
        lossy_quality: optimizeMode === 'lossy' ? lossyQuality : undefined,
        bmp_target_format: optimizeTargetFile.extension === '.bmp' ? bmpTargetFormat : undefined,
        max_dimension: maxDimension || undefined,
        pdf_image_quality: (isPdf && optimizeMode === 'lossy') ? pdfImageQuality : undefined
      };

      const res = await storageService.createOptimizationCandidate(payload);
      setCandidateResult(res);
      setComparisonTab('metrics');
      setPreviewTarget('candidate');
      if (res.status === 'no_meaningful_savings') {
        addToast('No meaningful savings found. Original file remains untouched.', 'info');
      }
    } catch (err) {
      console.error('Error generating optimization candidate:', err);
      const msg = err.message || 'Failed to analyze optimization potential.';
      setCandidateError(msg);
      addToast(msg, 'error');
    } finally {
      setAnalyzingCandidate(false);
    }
  };

  const handleApplyOptimization = async () => {
    if (!optimizeTargetFile || !candidateResult?.candidate_token) return;
    setApplyingOptimization(true);

    try {
      const payload = {
        file_id: optimizeTargetFile.id,
        candidate_token: candidateResult.candidate_token,
        replace_original: replaceOriginal
      };

      const res = await storageService.applyOptimization(payload);
      setApplyResult(res);
      addToast(`Optimization applied successfully! Saved ${candidateResult.bytes_saved_formatted || 'storage'}.`, 'success');

      // Refresh data
      loadSummary();
      loadOptimizableFiles();
      loadLargeFiles(minSizeMb, limit);
    } catch (err) {
      console.error('Error applying optimization:', err);
      let msg = err.message || 'Failed to apply optimization.';
      if (err.status === 409 || msg.includes('modified after')) {
        msg = 'The source file was modified after candidate analysis. Optimization aborted to prevent data loss. Please re-analyze.';
      } else if (err.status === 400 && (msg.includes('expired') || msg.includes('Invalid'))) {
        msg = 'This optimization candidate has expired. Please analyze the file again.';
      }
      setCandidateError(msg);
      addToast(msg, 'error');
    } finally {
      setApplyingOptimization(false);
    }
  };

  // --------------------------------------------------------------------------
  // ZIP Archive Actions
  // --------------------------------------------------------------------------
  const handleOpenZipModal = () => {
    if (selectedFileIds.length === 0) return;
    // Suggest default destination path based on first selected file directory
    const firstFile = selectedFilesList[0];
    if (firstFile && firstFile.path) {
      const dir = firstFile.path.substring(0, Math.max(firstFile.path.lastIndexOf('/'), firstFile.path.lastIndexOf('\\')));
      const separator = firstFile.path.includes('\\') ? '\\' : '/';
      setZipDestination(`${dir}${separator}memora_archive_${Date.now()}.zip`);
    } else {
      setZipDestination('');
    }
    setZipCompressionLevel(9);
    setZipOverwrite(false);
    setZipResult(null);
    setShowZipModal(true);
  };

  const handleBrowseZipDestination = async () => {
    if (window.electronAPI?.showSaveDialog) {
      try {
        const defaultName = `memora_archive_${Date.now()}.zip`;
        const res = await window.electronAPI.showSaveDialog({
          title: 'Choose Destination for ZIP Archive',
          defaultPath: zipDestination || defaultName,
          filters: [{ name: 'ZIP Archives (*.zip)', extensions: ['zip'] }]
        });
        if (!res.canceled && res.filePath) {
          setZipDestination(res.filePath);
        }
      } catch (err) {
        console.warn('Error opening native save dialog:', err);
      }
    } else if (window.electronAPI?.openDirectory) {
      try {
        const res = await window.electronAPI.openDirectory();
        if (!res.canceled && res.filePaths && res.filePaths.length > 0) {
          const chosenDir = res.filePaths[0];
          const separator = chosenDir.includes('\\') ? '\\' : '/';
          setZipDestination(`${chosenDir}${separator}memora_archive_${Date.now()}.zip`);
        }
      } catch (err) {
        console.warn('Error opening directory dialog:', err);
      }
    }
  };

  const handleCreateZip = async () => {
    if (!zipDestination || selectedFileIds.length === 0) {
      addToast('Please provide a valid destination path for the archive', 'warning');
      return;
    }
    setCreatingZip(true);

    try {
      const payload = {
        file_ids: selectedFileIds,
        destination_path: zipDestination.trim(),
        compression_level: Number(zipCompressionLevel),
        overwrite: Boolean(zipOverwrite)
      };

      const res = await storageService.createZipArchive(payload);
      setZipResult(res);
      addToast(`ZIP archive created successfully with ${res.files_archived} files!`, 'success');
      setSelectedFileIds([]);
      loadSummary();
      loadOptimizableFiles();
      loadLargeFiles(minSizeMb, limit);
    } catch (err) {
      console.error('Error creating ZIP archive:', err);
      const msg = err.message || 'Failed to create ZIP archive.';
      addToast(msg, 'error');
    } finally {
      setCreatingZip(false);
    }
  };

  // Helper for category badge styling
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Media':
        return <ImageIcon className="w-3.5 h-3.5 text-blue-400" />;
      case 'Documents':
        return <FileText className="w-3.5 h-3.5 text-purple-400" />;
      case 'Code & Text':
        return <Code className="w-3.5 h-3.5 text-emerald-400" />;
      case 'Archives':
        return <FileArchive className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <FileQuestion className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'Media':
        return 'from-blue-500 to-indigo-600';
      case 'Documents':
        return 'from-purple-500 to-pink-600';
      case 'Code & Text':
        return 'from-emerald-500 to-teal-600';
      case 'Archives':
        return 'from-amber-500 to-orange-600';
      default:
        return 'from-gray-500 to-slate-600';
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* ------------------------------------------------------------------- */}
      {/* HEADER */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
                Storage Analysis & Optimization
              </h1>
              <p className="text-xs text-gray-400">
                Inspect disk utilization, audit large assets, apply bit-safe local compression, and create archives.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={loadAllData}
            disabled={isRefreshing}
            className={isRefreshing ? 'animate-pulse' : ''}
          >
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Analysis'}</span>
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* SECTION A: METRICS OVERVIEW */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex flex-col justify-between border-gray-800/80 bg-gray-900/40">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Indexed Files</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-white tracking-tight">
              {loadingSummary ? '...' : (summary?.total_files?.toLocaleString() || 0)}
            </span>
            <p className="text-[11px] text-gray-400 mt-0.5">Across all scanned folders</p>
          </div>
        </Card>

        <Card className="flex flex-col justify-between border-gray-800/80 bg-gray-900/40">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Storage</span>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-white tracking-tight">
              {loadingSummary ? '...' : (summary?.total_size_formatted || '0 B')}
            </span>
            <p className="text-[11px] text-gray-400 mt-0.5">Combined disk footprint</p>
          </div>
        </Card>

        <Card className="flex flex-col justify-between border-gray-800/80 bg-gray-900/40">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Optimizable Files</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-amber-400 tracking-tight">
              {loadingSummary ? '...' : (summary?.optimizable_candidates_count || 0)}
            </span>
            <p className="text-[11px] text-gray-400 mt-0.5">JPEG, PNG, BMP, and PDF files</p>
          </div>
        </Card>

        <Card className="flex flex-col justify-between border-gray-800/80 bg-gray-900/40">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Large Files Audited</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Filter className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-white tracking-tight">
              {loadingFiles ? '...' : largeFilesTotal}
            </span>
            <p className="text-[11px] text-gray-400 mt-0.5">Files exceeding {minSizeMb} MB threshold</p>
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* SECTION B: CATEGORY BREAKDOWN */}
      {/* ------------------------------------------------------------------- */}
      <Card className="border-gray-800/80 bg-gray-900/30 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Storage Category Distribution</h2>
            <p className="text-xs text-gray-400">Breakdown of indexed content by type and volume</p>
          </div>
        </div>

        {/* Stacked Progress Bar */}
        <div className="w-full h-3.5 bg-gray-950 rounded-full overflow-hidden flex border border-gray-800">
          {summary?.category_breakdown?.map((cat) => (
            <div
              key={cat.category}
              style={{ width: `${Math.max(cat.percentage, 0)}%` }}
              title={`${cat.category}: ${cat.formatted} (${cat.percentage}%)`}
              className={`h-full bg-gradient-to-r ${getCategoryColor(cat.category)} transition-all duration-500`}
            />
          ))}
        </div>

        {/* Breakdown Legend Items */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-2">
          {summary?.category_breakdown?.map((cat) => (
            <div
              key={cat.category}
              className="p-3 rounded-xl bg-gray-950/60 border border-gray-800/60 flex flex-col justify-between"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-tr ${getCategoryColor(cat.category)}`} />
                <span className="text-xs font-semibold text-gray-300">{cat.category}</span>
              </div>
              <div>
                <span className="text-sm font-bold text-white">{cat.formatted}</span>
                <div className="flex items-center justify-between text-[11px] text-gray-400 mt-0.5">
                  <span>{cat.count} files</span>
                  <span className="font-mono text-cyan-400">{cat.percentage}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ------------------------------------------------------------------- */}
      {/* SECTION C: OPTIMIZABLE FILES (INDEPENDENT OF SIZE THRESHOLD) */}
      {/* ------------------------------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <span>Optimizable Files</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {loadingOptimizable ? '...' : `${optimizableFilesTotal} available`}
              </span>
            </h2>
            <p className="text-xs text-gray-400">
              Supported assets (JPEG, PNG, BMP, PDF) ready for lossless compression or conversion, regardless of size.
            </p>
          </div>
        </div>

        {/* Optimizable Files Table */}
        <div className="glass-panel border-gray-800/80 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-gray-950/80 text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-800">
                <tr>
                  <th className="p-4">File Name & Path</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Size</th>
                  <th className="p-4">Modified</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {loadingOptimizable ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                        <span>Scanning optimizable assets...</span>
                      </div>
                    </td>
                  </tr>
                ) : optimizableFiles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Zap className="w-8 h-8 text-gray-600" />
                        <span className="font-semibold text-gray-300">No optimizable files found</span>
                        <span className="text-[11px] text-gray-500">Supported formats: JPEG, PNG, BMP, PDF</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  optimizableFiles.map((file) => {
                    const isBmp = file.extension?.toLowerCase() === '.bmp';
                    return (
                      <tr
                        key={file.id}
                        className="transition-colors hover:bg-gray-800/30"
                      >
                        <td className="p-4 max-w-xs md:max-w-md">
                          <div className="font-semibold text-white truncate" title={file.name}>
                            {file.name}
                          </div>
                          <div className="text-[11px] text-gray-500 truncate mt-0.5" title={file.path}>
                            {file.path}
                          </div>
                        </td>

                        <td className="p-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-900 border border-gray-800 text-[11px] text-gray-300">
                            {getCategoryIcon(file.category)}
                            <span>{file.category}</span>
                          </span>
                        </td>

                        <td className="p-4 whitespace-nowrap font-mono font-medium text-white">
                          {file.size_formatted}
                        </td>

                        <td className="p-4 whitespace-nowrap text-gray-400">
                          {file.modified_at ? new Date(file.modified_at).toLocaleDateString() : '—'}
                        </td>

                        <td className="p-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenOptimize(file)}
                            title={isBmp ? 'Convert to PNG' : 'Optimize file'}
                            aria-label={isBmp ? 'Convert to PNG' : 'Optimize file'}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg
               bg-amber-500/10 border border-amber-500/20
               text-amber-400
               hover:bg-amber-500/20 hover:border-amber-500/40
               transition-colors"
                          >
                            <Zap className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* SECTION D: LARGE FILES AUDIT & ARCHIVING */}
      {/* ------------------------------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              Large File Audit & Optimization
            </h2>
            <p className="text-xs text-gray-400">
              Select files to optimize in-place or package into compressed ZIP archives.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Minimum Size Threshold Filter */}
            <div className="flex items-center gap-2 bg-gray-900/80 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-300">
              <span className="text-gray-400">Min Size:</span>
              <select
                value={minSizeMb}
                onChange={(e) => setMinSizeMb(parseFloat(e.target.value))}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
              >
                <option value={1.0} className="bg-gray-900">1.0 MB</option>
                <option value={5.0} className="bg-gray-900">5.0 MB</option>
                <option value={10.0} className="bg-gray-900">10.0 MB</option>
                <option value={25.0} className="bg-gray-900">25.0 MB</option>
                <option value={50.0} className="bg-gray-900">50.0 MB</option>
                <option value={100.0} className="bg-gray-900">100.0 MB</option>
              </select>
            </div>

            {/* Limit Filter */}
            <div className="flex items-center gap-2 bg-gray-900/80 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-300">
              <span className="text-gray-400">Limit:</span>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
              >
                <option value={25} className="bg-gray-900">25</option>
                <option value={50} className="bg-gray-900">50</option>
                <option value={100} className="bg-gray-900">100</option>
                <option value={200} className="bg-gray-900">200</option>
              </select>
            </div>

            {/* Create ZIP Action */}
            {selectedFileIds.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                icon={Archive}
                onClick={handleOpenZipModal}
                className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 border-amber-500/30 text-white"
              >
                <span>Create ZIP ({selectedFileIds.length})</span>
              </Button>
            )}
          </div>
        </div>

        {/* Files Table */}
        <div className="glass-panel border-gray-800/80 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-gray-950/80 text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-800">
                <tr>
                  <th className="p-4 w-10 text-center">
                    <button
                      onClick={handleSelectAll}
                      className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                      title={selectedFileIds.length === largeFiles.length ? "Deselect all" : "Select all"}
                    >
                      {selectedFileIds.length > 0 && selectedFileIds.length === largeFiles.length ? (
                        <CheckSquare className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="p-4">File Name & Path</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Size</th>
                  <th className="p-4">Modified</th>
                  <th className="p-4">Optimization Potential</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {loadingFiles ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                        <span>Loading large files analysis...</span>
                      </div>
                    </td>
                  </tr>
                ) : largeFiles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <HardDrive className="w-8 h-8 text-gray-600" />
                        <span className="font-semibold text-gray-300">No large files found matching threshold</span>
                        <span className="text-[11px] text-gray-500">Try lowering the minimum size filter above</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  largeFiles.map((file) => {
                    const isSelected = selectedFileIds.includes(file.id);
                    return (
                      <tr
                        key={file.id}
                        className={`transition-colors hover:bg-gray-800/30 ${isSelected ? 'bg-blue-900/15' : ''
                          }`}
                      >
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleToggleSelectFile(file.id)}
                            className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        <td className="p-4 max-w-xs md:max-w-md">
                          <div className="font-semibold text-white truncate" title={file.name}>
                            {file.name}
                          </div>
                          <div className="text-[11px] text-gray-500 truncate mt-0.5" title={file.path}>
                            {file.path}
                          </div>
                        </td>

                        <td className="p-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-900 border border-gray-800 text-[11px] text-gray-300">
                            {getCategoryIcon(file.category)}
                            <span>{file.category}</span>
                          </span>
                        </td>

                        <td className="p-4 whitespace-nowrap font-mono font-medium text-white">
                          {file.size_formatted}
                        </td>

                        <td className="p-4 whitespace-nowrap text-gray-400">
                          {file.modified_at ? new Date(file.modified_at).toLocaleDateString() : '—'}
                        </td>

                        <td className="p-4 whitespace-nowrap">
                          {file.is_optimizable ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Zap className="w-3 h-3" />
                              <span>{file.optimization_type || 'Optimizable'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-800 text-gray-400 border border-gray-700">
                              <Archive className="w-3 h-3" />
                              <span>Archive only</span>
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-right whitespace-nowrap">
                          {file.is_optimizable ? (
                            <Button
                              variant="primary"
                              size="sm"
                              icon={Zap}
                              onClick={() => handleOpenOptimize(file)}
                              className="text-xs"
                            >
                              <span>Optimize</span>
                            </Button>
                          ) : (
                            <span className="text-[11px] text-gray-500 italic">No optimizer</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* OPTIMIZATION MODAL */}
      {/* ------------------------------------------------------------------- */}
      <Modal
        isOpen={Boolean(optimizeTargetFile)}
        onClose={handleCloseOptimize}
        title="File Optimization Sandbox"
        maxWidth={candidateResult?.status === 'optimized' ? 'max-w-4xl' : 'max-w-xl'}
        actions={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCloseOptimize}
                disabled={analyzingCandidate || applyingOptimization}
              >
                <span>{applyResult ? 'Close' : 'Cancel'}</span>
              </Button>

              {candidateResult?.status === 'optimized' && !applyResult && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCandidateResult(null);
                    setCandidateError(null);
                  }}
                  disabled={applyingOptimization}
                  className="text-xs"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1 text-gray-400" />
                  <span>Change Options</span>
                </Button>
              )}
            </div>

            {candidateResult?.status === 'optimized' && !applyResult && (
              <Button
                variant="primary"
                size="sm"
                icon={applyingOptimization ? Loader2 : (replaceOriginal ? HardDrive : FileCheck)}
                onClick={handleApplyOptimization}
                disabled={applyingOptimization}
                className={replaceOriginal
                  ? "bg-amber-600 hover:bg-amber-500 border-amber-500/30 text-white"
                  : "bg-emerald-600 hover:bg-emerald-500 border-emerald-500/30 text-white"
                }
              >
                <span>
                  {applyingOptimization
                    ? 'Applying...'
                    : replaceOriginal
                      ? 'Replace Original File'
                      : 'Save Optimized Copy'}
                </span>
              </Button>
            )}
          </div>
        }
      >
        {optimizeTargetFile && (
          <div className="space-y-6">
            {/* File Info Header */}
            <div className="p-4 rounded-xl bg-gray-950/70 border border-gray-800 flex items-center justify-between">
              <div className="min-w-0 pr-4">
                <div className="text-xs text-gray-400 font-medium">Original Asset</div>
                <div className="text-sm font-bold text-white mt-0.5 truncate">{optimizeTargetFile.name}</div>
                <div className="text-[11px] text-gray-500 truncate max-w-sm">{optimizeTargetFile.path}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-gray-400 font-medium">Current Size</div>
                <div className="text-base font-mono font-bold text-cyan-400 mt-0.5">{optimizeTargetFile.size_formatted}</div>
              </div>
            </div>

            {/* Mode & Strategy Configuration */}
            {!candidateResult && !applyResult && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-2">Optimization Mode</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setOptimizeMode('lossless')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${optimizeMode === 'lossless'
                        ? 'bg-blue-600/20 border-blue-500/50 text-white shadow-sm'
                        : 'bg-gray-950/50 border-gray-800 text-gray-400 hover:bg-gray-900'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">Lossless</span>
                        {optimizeMode === 'lossless' && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                      </div>
                      <p className="text-[11px] text-gray-400">
                        No quality loss
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOptimizeMode('lossy')}
                      disabled={optimizeTargetFile.extension === '.png' || optimizeTargetFile.extension === '.bmp'}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${optimizeMode === 'lossy'
                        ? 'bg-amber-600/20 border-amber-500/50 text-white shadow-sm'
                        : 'bg-gray-950/50 border-gray-800 text-gray-400 hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">Lossy</span>
                        {optimizeMode === 'lossy' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                      </div>
                      <p className="text-[11px] text-gray-400">
                        Smaller file
                      </p>
                    </button>
                  </div>
                </div>

                {/* Quality Slider for Lossy JPEG */}
                {optimizeMode === 'lossy' && optimizeTargetFile.extension !== '.pdf' && (
                  <div className="p-4 rounded-xl bg-gray-950/60 border border-gray-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-300">JPEG Compression Quality</span>
                      <span className="font-mono font-bold text-amber-400">{lossyQuality}%</span>
                    </div>
                    <input
                      type="range"
                      min={65}
                      max={90}
                      step={1}
                      value={lossyQuality}
                      onChange={(e) => setLossyQuality(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>65% (Smaller size)</span>
                      <span>82% (Balanced Default)</span>
                      <span>90% (Near lossless)</span>
                    </div>
                  </div>
                )}

                {/* PDF image quality slider — shown only when PDF + lossy selected */}
                {optimizeMode === 'lossy' && optimizeTargetFile.extension?.toLowerCase() === '.pdf' && (
                  <div className="p-4 rounded-xl bg-gray-950/60 border border-amber-800/40 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-300">📄 PDF Image Compression Quality</span>
                      <span className="font-mono font-bold text-amber-400">{pdfImageQuality}%</span>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={95}
                      step={5}
                      value={pdfImageQuality}
                      onChange={(e) => setPdfImageQuality(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>50% (Max savings)</span>
                      <span>75% (Balanced)</span>
                      <span>95% (Near lossless)</span>
                    </div>
                    <p className="text-[10px] text-amber-400/80">
                      Embedded images (photos, diagrams) will be re-encoded at this quality. Text and layout are not affected.
                    </p>
                  </div>
                )}

                {/* BMP to PNG Options */}
                {optimizeTargetFile.extension === '.bmp' && (
                  <div className="p-4 rounded-xl bg-gray-950/60 border border-gray-800 space-y-2">
                    <span className="text-xs font-semibold text-gray-300 block">Conversion Target Format</span>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setBmpTargetFormat('png')}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold border ${bmpTargetFormat === 'png'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                          : 'bg-gray-900 border-gray-800 text-gray-400'
                          }`}
                      >
                        PNG (Deflate Compressed)
                      </button>
                    </div>
                  </div>
                )}

                {/* Resolution / Dimension Picker */}
                {(['.jpg', '.jpeg', '.png', '.bmp'].includes(optimizeTargetFile.extension?.toLowerCase()) || (optimizeTargetFile.extension?.toLowerCase() === '.pdf' && optimizeMode === 'lossy')) && (
                  <div className="p-4 rounded-xl bg-gray-950/60 border border-gray-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-300">
                        {optimizeTargetFile.extension?.toLowerCase() === '.pdf' ? '📐 Downsample Embedded Images' : '📐 Resize Resolution'}
                      </span>
                      <span className="text-[10px] text-gray-500">Optional — longest side</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Original', value: null },
                        { label: '4K (3840)', value: 3840 },
                        { label: 'Full HD (1920)', value: 1920 },
                        { label: 'HD (1280)', value: 1280 },
                        { label: 'Web (800)', value: 800 },
                        { label: 'Thumb (480)', value: 480 },
                      ].map(opt => (
                        <button
                          key={String(opt.value)}
                          type="button"
                          onClick={() => setMaxDimension(opt.value)}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border text-center transition-all cursor-pointer ${maxDimension === opt.value
                              ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300'
                              : 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-800'
                            }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {maxDimension && (
                      <p className="text-[10px] text-cyan-400">
                        {optimizeTargetFile.extension?.toLowerCase() === '.pdf'
                          ? `Embedded photos and scans larger than ${maxDimension} px will be downsampled proportionally (LANCZOS). Vectors and text remain untouched.`
                          : `Image will be downsampled so its longest side ≤ ${maxDimension} px (proportional, LANCZOS)`}
                      </p>
                    )}
                  </div>
                )}

                {/* Safe Staging Note */}
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                  <span>
                    The candidate is safely generated in a hidden local sandbox staging file. Your original asset will remain completely untouched until you explicitly click "Apply Optimization".
                  </span>
                </div>

                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="md"
                    icon={analyzingCandidate ? Loader2 : Zap}
                    onClick={handleGenerateCandidate}
                    disabled={analyzingCandidate}
                    className="w-full"
                  >
                    <span>{analyzingCandidate ? 'Generating Candidate...' : 'Generate Candidate'}</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Candidate Result View */}
            {candidateResult && !applyResult && (
              <div className="space-y-4">
                {candidateResult.status === 'optimized' ? (
                  <div className="space-y-4">
                    {/* View Switcher Tabs: Metrics vs Live Preview */}
                    <div className="flex items-center gap-2 p-1 bg-gray-950/80 rounded-xl border border-gray-800">
                      <button
                        type="button"
                        onClick={() => setComparisonTab('metrics')}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${comparisonTab === 'metrics'
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 shadow-sm'
                          : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Comparison Metrics</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setComparisonTab('preview')}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${comparisonTab === 'preview'
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 shadow-sm'
                          : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Live Document Preview</span>
                      </button>
                    </div>

                    {/* Tab 1: Comparison Metrics */}
                    {comparisonTab === 'metrics' && (
                      <div className="space-y-3">
                        {/* Savings Highlight Box */}
                        <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Candidate Ready for Verification</span>
                            </span>
                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                              -{candidateResult.percentage_saved}%
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-500/20 text-center">
                            <div>
                              <span className="text-[10px] text-gray-400 uppercase">Original</span>
                              <div className="text-xs font-mono font-medium text-gray-300 mt-0.5">
                                {candidateResult.original_size_formatted}
                              </div>
                              {candidateResult.original_width && (
                                <div className="text-[10px] text-gray-500 mt-0.5">
                                  {candidateResult.original_width} × {candidateResult.original_height} px
                                </div>
                              )}
                            </div>
                            <div className="flex items-center justify-center text-emerald-400">
                              <ArrowRight className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-400 uppercase">Optimized</span>
                              <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                                {candidateResult.candidate_size_formatted}
                              </div>
                              {candidateResult.candidate_width && (
                                <div className="text-[10px] text-emerald-600 mt-0.5">
                                  {candidateResult.candidate_width} × {candidateResult.candidate_height} px
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="text-center pt-1">
                            <span className="text-xs text-emerald-300">
                              Net Storage Saved: <strong className="font-mono text-emerald-400">{candidateResult.bytes_saved_formatted}</strong>
                            </span>
                          </div>
                        </div>

                        {/* PDF Specific Structural Stats */}
                        {optimizeTargetFile.extension?.toLowerCase() === '.pdf' && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                            <div className="p-2.5 rounded-lg bg-gray-950/60 border border-gray-800">
                              <span className="text-[10px] text-gray-500 block uppercase">Pages Intact</span>
                              <span className="font-mono font-bold text-gray-200 mt-0.5 block">
                                {candidateResult.page_count ?? '—'}
                              </span>
                            </div>

                            <div className="p-2.5 rounded-lg bg-gray-950/60 border border-gray-800">
                              <span className="text-[10px] text-gray-500 block uppercase">Images Optimized</span>
                              <span className="font-mono font-bold text-emerald-400 mt-0.5 block">
                                {candidateResult.images_optimized ?? 0} / {candidateResult.images_count ?? 0}
                              </span>
                            </div>

                            <div className="p-2.5 rounded-lg bg-gray-950/60 border border-gray-800">
                              <span className="text-[10px] text-gray-500 block uppercase">Downsampled</span>
                              <span className="font-mono font-bold text-cyan-400 mt-0.5 block">
                                {candidateResult.images_downsampled ?? 0}
                              </span>
                            </div>

                            <div className="p-2.5 rounded-lg bg-gray-950/60 border border-gray-800">
                              <span className="text-[10px] text-gray-500 block uppercase">Content Streams</span>
                              <span className="font-mono font-bold text-blue-400 mt-0.5 block">
                                {candidateResult.streams_compressed ? `${candidateResult.streams_compressed} deflated` : 'Optimized'}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Technical details */}
                        <div className="p-3 rounded-lg bg-gray-950/60 border border-gray-800 text-[11px] text-gray-400 space-y-1">
                          <div>Strategy: <span className="text-gray-200 font-mono">{candidateResult.strategy_used}</span></div>
                          <div>Mode: <span className="text-gray-200">{candidateResult.is_lossless ? 'Lossless bit-exact' : 'Perceptually balanced'}</span></div>
                          {candidateResult.execution_time_ms && (
                            <div>Execution Time: <span className="text-gray-200 font-mono">{candidateResult.execution_time_ms} ms</span></div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tab 2: Live Document / Image Preview */}
                    {comparisonTab === 'preview' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between bg-gray-950/70 p-2 rounded-xl border border-gray-800">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewTarget('candidate')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${previewTarget === 'candidate'
                                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/50'
                                : 'text-gray-400 hover:text-gray-200'
                              }`}
                            >
                              ✨ Compressed ({candidateResult.candidate_size_formatted})
                            </button>

                            <button
                              type="button"
                              onClick={() => setPreviewTarget('original')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${previewTarget === 'original'
                                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/50'
                                : 'text-gray-400 hover:text-gray-200'
                              }`}
                            >
                              📄 Original ({candidateResult.original_size_formatted})
                            </button>
                          </div>

                          <span className="text-[11px] text-gray-400 font-mono hidden sm:inline">
                            Viewing: <strong className="text-gray-200">{previewTarget === 'candidate' ? 'Optimized Candidate' : 'Original Source'}</strong>
                          </span>
                        </div>

                        <div className="bg-gray-950 rounded-xl border border-gray-800 overflow-hidden min-h-[440px] flex items-center justify-center relative">
                          {optimizeTargetFile.extension?.toLowerCase() === '.pdf' ? (
                            <iframe
                              key={previewTarget}
                              src={storageService.getCandidatePreviewUrl(candidateResult.candidate_token, previewTarget)}
                              title="PDF Document Comparison"
                              className="w-full h-[450px] border-0 bg-white"
                            />
                          ) : (
                            <img
                              key={previewTarget}
                              src={storageService.getCandidatePreviewUrl(candidateResult.candidate_token, previewTarget)}
                              alt="Comparison View"
                              className="max-h-[440px] max-w-full object-contain p-2"
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Save Choice */}
                    <div className="space-y-2 pt-1">
                      <div className="text-xs font-semibold text-gray-300">
                        Select Save Option
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setReplaceOriginal(false)}
                          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${!replaceOriginal
                            ? 'bg-emerald-600/15 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/30'
                            : 'bg-gray-950/60 border-gray-800 text-gray-400 hover:bg-gray-900'
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Copy className="w-4 h-4 text-emerald-400" />
                              <span className="text-xs font-bold text-gray-100">Create Copy</span>
                            </div>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">Recommended</span>
                          </div>
                          <div className="text-[11px] text-gray-400 mt-1.5 leading-snug">
                            Saves as a new optimized file. Keeps original 100% untouched.
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setReplaceOriginal(true)}
                          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${replaceOriginal
                            ? 'bg-amber-600/15 border-amber-500 text-white shadow-sm ring-1 ring-amber-500/30'
                            : 'bg-gray-950/60 border-gray-800 text-gray-400 hover:bg-gray-900'
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <HardDrive className="w-4 h-4 text-amber-400" />
                              <span className="text-xs font-bold text-gray-100">Replace Original</span>
                            </div>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">Frees Space</span>
                          </div>
                          <div className="text-[11px] text-gray-400 mt-1.5 leading-snug">
                            Replaces existing file in-place. Staged backup & rollback protect your data.
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Two-phase replacement notice */}
                    <div className="p-3 rounded-lg bg-gray-900/80 border border-gray-800 text-[11px] text-gray-300 flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        {replaceOriginal
                          ? 'The original file will be safely replaced. A temporary backup and automatic rollback protect your data if anything fails.'
                          : 'A new optimized copy will be created. Your original file will remain untouched.'}
                      </span>
                    </div>
                  </div>
                ) : candidateResult.status === 'no_meaningful_savings' ? (
                  <div className="p-5 rounded-xl bg-gray-950/80 border border-gray-800 text-center space-y-2">
                    <Info className="w-6 h-6 text-blue-400 mx-auto" />
                    <h4 className="text-sm font-bold text-white">No Meaningful Savings Found</h4>
                    <p className="text-xs text-gray-400 max-w-sm mx-auto">
                      This file is already efficiently compressed. Optimization would save less than the 20 KB / 3% threshold.
                    </p>
                    <p className="text-[11px] text-emerald-400 font-medium">Your original file was not changed.</p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-2 text-center">
                    <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
                    <h4 className="text-sm font-bold text-white">Optimization Not Applicable</h4>
                    <p className="text-xs text-gray-300">{candidateResult.reason || 'This asset cannot be optimized further.'}</p>
                    <p className="text-[11px] text-gray-400">Your original file remains untouched.</p>
                  </div>
                )}
              </div>
            )}

            {/* Apply Result Screen */}
            {applyResult && (
              <div className="p-6 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
                <h4 className="text-base font-bold text-white">Optimization Applied Successfully!</h4>
                <p className="text-xs text-gray-300">{applyResult.message}</p>
                <div className="text-xs font-mono text-emerald-400">
                  New size: {candidateResult?.candidate_size_formatted}
                </div>
              </div>
            )}

            {/* Error Message */}
            {candidateError && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{candidateError}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ------------------------------------------------------------------- */}
      {/* ZIP ARCHIVE MODAL */}
      {/* ------------------------------------------------------------------- */}
      <Modal
        isOpen={showZipModal}
        onClose={() => setShowZipModal(false)}
        title="Create Compressed ZIP Archive"
        subtitle={`Packaging ${selectedFileIds.length} selected files`}
        maxWidth="max-w-lg"
        actions={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowZipModal(false)}
              disabled={creatingZip}
            >
              <span>{zipResult ? 'Close' : 'Cancel'}</span>
            </Button>

            {!zipResult && (
              <Button
                variant="primary"
                size="sm"
                icon={Archive}
                onClick={handleCreateZip}
                disabled={creatingZip || !zipDestination}
                className="bg-amber-600 hover:bg-amber-500 border-amber-500/30 text-white"
              >
                <span>{creatingZip ? 'Compressing Archive...' : 'Create Archive'}</span>
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {!zipResult ? (
            <>
              {/* Selected Files Overview */}
              <div className="p-3.5 rounded-xl bg-gray-950/70 border border-gray-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-gray-300">Selected Items</span>
                  <div className="text-[11px] text-gray-400 mt-0.5">{selectedFileIds.length} files selected</div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-gray-300">Total Uncompressed</span>
                  <div className="text-xs font-mono font-bold text-amber-400 mt-0.5">
                    {(selectedTotalBytes / (1024 * 1024)).toFixed(2)} MB
                  </div>
                </div>
              </div>

              {/* Destination Path Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 block">
                  Archive Destination Absolute Path
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={zipDestination}
                    onChange={(e) => setZipDestination(e.target.value)}
                    placeholder="C:\Users\...\archive.zip"
                    className="flex-1 px-3.5 py-2 rounded-xl bg-gray-950 border border-gray-800 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={FolderOpen}
                    onClick={handleBrowseZipDestination}
                    className="text-xs shrink-0"
                  >
                    <span>Browse...</span>
                  </Button>
                </div>
                <p className="text-[11px] text-gray-500">
                  Enter or browse to the full absolute path where the .zip archive should be written.
                </p>
              </div>

              {/* Compression Level */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-300">Deflate Compression Level</span>
                  <span className="font-mono text-amber-400 font-bold">Level {zipCompressionLevel} (Max)</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Store (0)', val: 0 },
                    { label: 'Fast (6)', val: 6 },
                    { label: 'Maximum (9)', val: 9 }
                  ].map(lvl => (
                    <button
                      key={lvl.val}
                      type="button"
                      onClick={() => setZipCompressionLevel(lvl.val)}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${zipCompressionLevel === lvl.val
                        ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:bg-gray-900'
                        }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Overwrite Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-950/60 border border-gray-800">
                <div className="text-xs">
                  <span className="font-semibold text-gray-300 block">Overwrite Existing Archive</span>
                  <span className="text-[11px] text-gray-500">Replace target archive if it already exists</span>
                </div>
                <input
                  type="checkbox"
                  checked={zipOverwrite}
                  onChange={(e) => setZipOverwrite(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-900 border-gray-700 text-amber-600 focus:ring-0 cursor-pointer"
                />
              </div>
            </>
          ) : (
            <div className="p-5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="text-base font-bold text-white">ZIP Archive Created!</h4>
              <p className="text-xs text-gray-300">
                Successfully archived {zipResult.files_archived} files into:
              </p>
              <div className="p-2 rounded bg-gray-950/80 font-mono text-[11px] text-cyan-300 truncate">
                {zipResult.destination_path}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                <div className="p-2 rounded bg-gray-900/60">
                  <span className="text-[10px] text-gray-400 uppercase block">Archive Size</span>
                  <span className="font-mono font-bold text-white">
                    {(zipResult.archive_size_bytes / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
                <div className="p-2 rounded bg-gray-900/60">
                  <span className="text-[10px] text-gray-400 uppercase block">Compression Saved</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {zipResult.percentage_saved}%
                  </span>
                </div>
              </div>
              {window.electronAPI?.showItemInFolder && (
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={FolderOpen}
                    onClick={() => window.electronAPI.showItemInFolder(zipResult.destination_path)}
                    className="text-xs"
                  >
                    <span>Show in File Explorer</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default StorageOptimization;
