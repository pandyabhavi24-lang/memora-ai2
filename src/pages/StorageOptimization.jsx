import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  HardDrive, Zap, Archive, FolderOpen, CheckCircle2, AlertTriangle,
  RefreshCw, Layers, ArrowRight, Info, Loader2, Filter, CheckSquare,
  Square, Eye, Copy, FileCheck, SlidersHorizontal, ShieldCheck,
  ChevronRight, ChevronDown, Folder
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { useApp } from '../context/AppContext';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getDirFromPath = (p) => {
  if (!p) return 'Unknown';
  const sep = p.includes('\\') ? '\\' : '/';
  const parts = p.split(sep);
  parts.pop();
  return parts.join(sep) || sep;
};

const EXT_COLORS = {
  '.pdf':  'text-red-400 bg-red-500/10 border-red-500/20',
  '.jpg':  'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  '.jpeg': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  '.png':  'text-blue-400 bg-blue-500/10 border-blue-500/20',
  '.bmp':  'text-purple-400 bg-purple-500/10 border-purple-500/20',
};
const ExtBadge = ({ ext }) => {
  const label = ext ? ext.replace('.','').toUpperCase().slice(0,4) : '?';
  const cls = EXT_COLORS[ext?.toLowerCase()] || 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  return <span className={`inline-block text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>;
};

const CAT_COLORS = {
  'Media': 'from-blue-500 to-indigo-600',
  'Documents': 'from-purple-500 to-pink-600',
  'Code & Text': 'from-emerald-500 to-teal-600',
  'Archives': 'from-amber-500 to-orange-600',
};
const getCategoryColor = (c) => CAT_COLORS[c] || 'from-gray-500 to-slate-600';

// ─── Accordion Header ─────────────────────────────────────────────────────────

const AccordionHeader = ({ icon: Icon, title, subtitle, badge, isOpen, onToggle, accent = 'text-cyan-400' }) => (
  <button type="button" onClick={onToggle}
    className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-800/30 transition-colors group">
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gray-800/60 ${accent}`}>
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-white">{title}</span>
        {badge !== undefined && badge !== null && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700/60 text-gray-400 font-mono">{badge}</span>
        )}
      </div>
      {subtitle && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{subtitle}</p>}
    </div>
    {isOpen
      ? <ChevronDown className="w-4 h-4 text-gray-500 shrink-0 group-hover:text-gray-300" />
      : <ChevronRight className="w-4 h-4 text-gray-500 shrink-0 group-hover:text-gray-300" />}
  </button>
);

// ─── File Browser ─────────────────────────────────────────────────────────────

const FileBrowser = ({ files, loading, selectedFileIds, onToggle, onToggleFolder, filterOptimizable, showOptimize, onOptimize }) => {
  const [openFolders, setOpenFolders] = useState({});

  const grouped = useMemo(() => {
    const map = {};
    const list = filterOptimizable ? files.filter(f => f.is_optimizable) : files;
    for (const f of list) {
      const dir = getDirFromPath(f.path);
      if (!map[dir]) map[dir] = [];
      map[dir].push(f);
    }
    return map;
  }, [files, filterOptimizable]);

  const folderKeys = useMemo(() => Object.keys(grouped).sort(), [grouped]);
  const folderKeysStr = folderKeys.join('|');

  const toggleFolder = useCallback((dir) => setOpenFolders(prev => ({ ...prev, [dir]: !prev[dir] })), []);

  useEffect(() => {
    if (folderKeys.length > 0) {
      setOpenFolders(prev => Object.keys(prev).length === 0 ? { [folderKeys[0]]: true } : prev);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderKeysStr]);

  if (loading) return (
    <div className="flex items-center justify-center gap-2 py-10 text-gray-500 text-sm">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading files…
    </div>
  );
  if (folderKeys.length === 0) return (
    <div className="py-10 text-center text-gray-500 text-sm">No files found.</div>
  );

  return (
    <div className="divide-y divide-gray-800/60 max-h-[420px] overflow-y-auto">
      {folderKeys.map(dir => {
        const fFiles = grouped[dir];
        const isOpen = !!openFolders[dir];
        const selCount = fFiles.filter(f => selectedFileIds.includes(f.id)).length;
        const allSel = selCount === fFiles.length && fFiles.length > 0;
        return (
          <div key={dir}>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-900/60 hover:bg-gray-800/40 transition-colors">
              <button type="button" title={allSel ? 'Deselect folder' : 'Select folder'}
                onClick={() => onToggleFolder(fFiles.map(f => f.id), !allSel)}
                className="text-gray-500 hover:text-white transition-colors shrink-0">
                {allSel
                  ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                  : selCount > 0
                    ? <CheckSquare className="w-3.5 h-3.5 text-cyan-600" />
                    : <Square className="w-3.5 h-3.5" />}
              </button>
              <button type="button" onClick={() => toggleFolder(dir)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left">
                <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-xs font-medium text-gray-300 truncate flex-1" title={dir}>{dir}</span>
                <span className="text-[10px] text-gray-500 shrink-0">{selCount > 0 ? `${selCount}/` : ''}{fFiles.length}</span>
                {isOpen
                  ? <ChevronDown className="w-3 h-3 text-gray-600 shrink-0" />
                  : <ChevronRight className="w-3 h-3 text-gray-600 shrink-0" />}
              </button>
            </div>
            {isOpen && (
              <div className="divide-y divide-gray-800/30 bg-gray-950/20">
                {fFiles.map(file => {
                  const isSel = selectedFileIds.includes(file.id);
                  return (
                    <div key={file.id}
                      className={`flex items-center gap-2.5 px-4 py-2 transition-colors ${isSel ? 'bg-cyan-500/5' : 'hover:bg-gray-800/20'}`}>
                      <button type="button" onClick={() => onToggle(file.id)}
                        className="text-gray-500 hover:text-white transition-colors shrink-0">
                        {isSel ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" /> : <Square className="w-3.5 h-3.5" />}
                      </button>
                      <ExtBadge ext={file.extension} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate" title={file.name}>{file.name}</p>
                      </div>
                      <span className="text-[11px] font-mono text-gray-400 shrink-0">{file.size_formatted}</span>
                      {showOptimize && file.is_optimizable && (
                        <button type="button" title="Optimize" onClick={() => onOptimize(file)}
                          className="w-6 h-6 rounded flex items-center justify-center bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors shrink-0">
                          <Zap className="w-3 h-3" />
                        </button>
                      )}
                      {showOptimize && !file.is_optimizable && (
                        <span className="text-[10px] text-gray-600 shrink-0 w-6 text-center" title="ZIP only">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Selection Bar ─────────────────────────────────────────────────────────────

const SelectionBar = ({ count, optimizableCount, onOptimize, onZip, showOptimize }) => {
  if (count === 0) return null;
  const zipOnly = count - optimizableCount;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 bg-cyan-950/30 border-t border-cyan-500/20">
      <div className="text-xs text-gray-300">
        <span className="font-semibold text-white">{count}</span> file{count !== 1 ? 's' : ''} selected
        {optimizableCount > 0 && <span className="ml-2 text-emerald-400">· {optimizableCount} optimizable</span>}
        {zipOnly > 0 && <span className="ml-2 text-gray-500">· {zipOnly} ZIP only</span>}
      </div>
      <div className="flex items-center gap-2">
        {showOptimize && optimizableCount > 0 && (
          <Button variant="primary" size="sm" onClick={onOptimize}>
            <Zap className="w-3.5 h-3.5 mr-1" />Optimize First
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onZip}>
          <Archive className="w-3.5 h-3.5 mr-1" />Create ZIP
        </Button>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

export const StorageOptimization = () => {
  const { addToast } = useApp();

  const [summary, setSummary] = useState(null);
  const [largeFiles, setLargeFiles] = useState([]);
  const [largeFilesTotal, setLargeFilesTotal] = useState(0);
  const [optimizableFilesTotal, setOptimizableFilesTotal] = useState(0);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [allFiles, setAllFiles] = useState([]);
  const [loadingAllFiles, setLoadingAllFiles] = useState(true);

  const [minSizeMb, setMinSizeMb] = useState(5.0);
  const [limit, setLimit] = useState(50);
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [openSection, setOpenSection] = useState(null);

  // Optimize modal
  const [optimizeTargetFile, setOptimizeTargetFile] = useState(null);
  const [optimizeMode, setOptimizeMode] = useState('lossless');
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
  const [comparisonTab, setComparisonTab] = useState('metrics');
  const [previewTarget, setPreviewTarget] = useState('candidate');

  // ZIP modal
  const [showZipModal, setShowZipModal] = useState(false);
  const [zipDestination, setZipDestination] = useState('');
  const [zipCompressionLevel, setZipCompressionLevel] = useState(9);
  const [zipOverwrite, setZipOverwrite] = useState(false);
  const [creatingZip, setCreatingZip] = useState(false);
  const [zipResult, setZipResult] = useState(null);

  useEffect(() => { loadAllData(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadLargeFiles(minSizeMb, limit); }, [minSizeMb, limit]);

  const loadAllData = async () => {
    setIsRefreshing(true);
    await Promise.all([loadSummary(), loadLargeFiles(minSizeMb, limit), loadAllFiles()]);
    setIsRefreshing(false);
  };

  const loadSummary = async () => {
    setLoadingSummary(true);
    try { setSummary(await storageService.getStorageSummary()); }
    catch { addToast('Failed to load storage summary', 'error'); }
    finally { setLoadingSummary(false); }
  };

  const loadAllFiles = async () => {
    setLoadingAllFiles(true);
    try {
      const data = await storageService.getAllFiles({ limit: 500 });
      setAllFiles(data.items || []);
      setOptimizableFilesTotal((data.items || []).filter(f => f.is_optimizable).length);
    } catch { setAllFiles([]); }
    finally { setLoadingAllFiles(false); }
  };

  const loadLargeFiles = async (minMb, lim) => {
    setLoadingFiles(true);
    try {
      const data = await storageService.getLargeFiles({ min_size_mb: minMb, limit: lim });
      setLargeFiles(data.items || []);
      setLargeFilesTotal(data.total_count || 0);
    } catch { addToast('Failed to load large files', 'error'); }
    finally { setLoadingFiles(false); }
  };

  const handleToggle = useCallback((id) =>
    setSelectedFileIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]), []);

  const handleToggleFolder = useCallback((ids, select) =>
    setSelectedFileIds(prev => {
      const without = prev.filter(x => !ids.includes(x));
      return select ? [...without, ...ids] : without;
    }), []);

  const handleSelectAll = () =>
    setSelectedFileIds(prev => prev.length === allFiles.length ? [] : allFiles.map(f => f.id));

  const selectedList = useMemo(() => allFiles.filter(f => selectedFileIds.includes(f.id)), [allFiles, selectedFileIds]);
  const selectedBytes = useMemo(() => selectedList.reduce((a, f) => a + (f.size_bytes || 0), 0), [selectedList]);
  const selectedOptimizable = useMemo(() => selectedList.filter(f => f.is_optimizable), [selectedList]);
  const optimizableLargeFiles = useMemo(() => largeFiles.filter(f => f.is_optimizable), [largeFiles]);

  const handleOpenOptimize = (file) => {
    setOptimizeTargetFile(file);
    const isPdf = file.extension?.toLowerCase() === '.pdf';
    setOptimizeMode(isPdf ? 'lossy' : 'lossless');
    setLossyQuality(82); setBmpTargetFormat('png'); setCandidateResult(null);
    setCandidateError(null); setApplyResult(null); setReplaceOriginal(false);
    setMaxDimension(null); setPdfImageQuality(75);
    setComparisonTab('metrics'); setPreviewTarget('candidate');
  };
  const handleCloseOptimize = () => {
    setOptimizeTargetFile(null); setCandidateResult(null);
    setCandidateError(null); setApplyResult(null);
  };
  const handleGenerateCandidate = async () => {
    if (!optimizeTargetFile) return;
    setAnalyzingCandidate(true); setCandidateError(null); setCandidateResult(null);
    try {
      const isPdf = optimizeTargetFile.extension?.toLowerCase() === '.pdf';
      const res = await storageService.createOptimizationCandidate({
        file_id: optimizeTargetFile.id, mode: optimizeMode,
        lossy_quality: optimizeMode === 'lossy' ? lossyQuality : undefined,
        bmp_target_format: optimizeTargetFile.extension === '.bmp' ? bmpTargetFormat : undefined,
        max_dimension: maxDimension || undefined,
        pdf_image_quality: (isPdf && optimizeMode === 'lossy') ? pdfImageQuality : undefined,
      });
      setCandidateResult(res); setComparisonTab('metrics'); setPreviewTarget('candidate');
      if (res.status === 'no_meaningful_savings') addToast('No meaningful savings. File unchanged.', 'info');
    } catch (err) {
      const msg = err.message || 'Failed to generate candidate.';
      setCandidateError(msg); addToast(msg, 'error');
    } finally { setAnalyzingCandidate(false); }
  };
  const handleApplyOptimization = async () => {
    if (!optimizeTargetFile || !candidateResult?.candidate_token) return;
    setApplyingOptimization(true);
    try {
      const res = await storageService.applyOptimization({
        file_id: optimizeTargetFile.id,
        candidate_token: candidateResult.candidate_token,
        replace_original: replaceOriginal,
      });
      setApplyResult(res);
      addToast('Optimization applied!', 'success');
      loadSummary(); loadAllFiles(); loadLargeFiles(minSizeMb, limit);
    } catch (err) {
      let msg = err.message || 'Failed to apply.';
      if (err.status === 409 || msg.includes('modified after')) msg = 'File changed after analysis. Re-analyze.';
      else if (err.status === 400 && (msg.includes('expired') || msg.includes('Invalid'))) msg = 'Candidate expired. Re-analyze.';
      setCandidateError(msg); addToast(msg, 'error');
    } finally { setApplyingOptimization(false); }
  };

  const handleOpenZipModal = () => {
    if (!selectedFileIds.length) return;
    const f = selectedList[0];
    if (f?.path) {
      const dir = f.path.substring(0, Math.max(f.path.lastIndexOf('/'), f.path.lastIndexOf('\\')));
      const sep = f.path.includes('\\') ? '\\' : '/';
      setZipDestination(`${dir}${sep}memora_archive_${Date.now()}.zip`);
    } else setZipDestination('');
    setZipCompressionLevel(9); setZipOverwrite(false); setZipResult(null); setShowZipModal(true);
  };
  const handleBrowseZipDestination = async () => {
    if (window.electronAPI?.showSaveDialog) {
      try {
        const res = await window.electronAPI.showSaveDialog({
          title: 'ZIP Destination', defaultPath: zipDestination,
          filters: [{ name: 'ZIP', extensions: ['zip'] }],
        });
        if (!res.canceled && res.filePath) setZipDestination(res.filePath);
      } catch {}
    } else if (window.electronAPI?.openDirectory) {
      try {
        const res = await window.electronAPI.openDirectory();
        if (!res.canceled && res.filePaths?.[0]) {
          const d = res.filePaths[0];
          const sep = d.includes('\\') ? '\\' : '/';
          setZipDestination(`${d}${sep}memora_archive_${Date.now()}.zip`);
        }
      } catch {}
    }
  };
  const handleCreateZip = async () => {
    if (!zipDestination || !selectedFileIds.length) { addToast('Provide a destination path', 'warning'); return; }
    setCreatingZip(true);
    try {
      const res = await storageService.createZipArchive({
        file_ids: selectedFileIds, destination_path: zipDestination.trim(),
        compression_level: Number(zipCompressionLevel), overwrite: Boolean(zipOverwrite),
      });
      setZipResult(res); setSelectedFileIds([]);
      addToast(`ZIP created with ${res.files_archived} files!`, 'success');
      loadSummary(); loadAllFiles(); loadLargeFiles(minSizeMb, limit);
    } catch (err) { addToast(err.message || 'ZIP creation failed', 'error'); }
    finally { setCreatingZip(false); }
  };

  const toggleSection = (key) => setOpenSection(prev => prev === key ? null : key);

  return (
    <div className="space-y-5 pb-12">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Storage Optimization</h1>
            <p className="text-[11px] text-gray-500">Compress files, audit large assets, and create archives.</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={loadAllData} disabled={isRefreshing}
          className={isRefreshing ? 'animate-pulse' : ''}>
          <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
        </Button>
      </div>

      {/* METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Files', val: loadingSummary ? '…' : (summary?.total_files?.toLocaleString() || 0), icon: Layers, color: 'text-blue-400' },
          { label: 'Total Size',  val: loadingSummary ? '…' : (summary?.total_size_formatted || '0 B'), icon: HardDrive, color: 'text-cyan-400' },
          { label: 'Optimizable', val: loadingAllFiles ? '…' : optimizableFilesTotal, icon: Zap, color: 'text-amber-400' },
          { label: `≥ ${minSizeMb} MB`, val: loadingFiles ? '…' : largeFilesTotal, icon: Filter, color: 'text-purple-400' },
        ].map(m => (
          <div key={m.label} className="flex items-center gap-3 p-3 rounded-xl bg-gray-900/40 border border-gray-800/80">
            <m.icon className={`w-4 h-4 shrink-0 ${m.color}`} />
            <div>
              <div className="text-lg font-bold text-white leading-none">{m.val}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{m.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* CATEGORY BAR */}
      {summary?.category_breakdown && (
        <div className="rounded-xl border border-gray-800/80 bg-gray-900/30 p-4 space-y-3">
          <span className="text-xs font-semibold text-gray-400">Storage by type</span>
          <div className="w-full h-2.5 bg-gray-950 rounded-full overflow-hidden flex border border-gray-800/60">
            {summary.category_breakdown.map(cat => (
              <div key={cat.category} style={{ width: `${Math.max(cat.percentage, 0)}%` }}
                title={`${cat.category}: ${cat.formatted} (${cat.percentage}%)`}
                className={`h-full bg-gradient-to-r ${getCategoryColor(cat.category)}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {summary.category_breakdown.map(cat => (
              <div key={cat.category} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full bg-gradient-to-tr ${getCategoryColor(cat.category)}`} />
                <span className="text-[11px] text-gray-400">{cat.category}</span>
                <span className="text-[11px] font-mono text-gray-300">{cat.formatted}</span>
                <span className="text-[10px] text-gray-600">({cat.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─ SECTION 1: OPTIMIZE FILES ─ */}
      <div className="rounded-xl border border-gray-800/80 bg-gray-900/30 overflow-hidden">
        <AccordionHeader icon={Zap} title="Optimize Files"
          subtitle="Compress JPEG, PNG, BMP, and PDF files to save space"
          badge={optimizableFilesTotal || undefined}
          isOpen={openSection === 'optimize'} onToggle={() => toggleSection('optimize')}
          accent="text-amber-400" />
        {openSection === 'optimize' && (
          <div className="border-t border-gray-800/60">
            <FileBrowser files={allFiles} loading={loadingAllFiles} selectedFileIds={selectedFileIds}
              onToggle={handleToggle} onToggleFolder={handleToggleFolder}
              filterOptimizable={true} showOptimize={true} onOptimize={handleOpenOptimize} />
            <SelectionBar count={selectedList.length} optimizableCount={selectedOptimizable.length}
              onOptimize={() => selectedOptimizable.length > 0 && handleOpenOptimize(selectedOptimizable[0])}
              onZip={handleOpenZipModal} showOptimize={true} />
          </div>
        )}
      </div>

      {/* ─ SECTION 2: LARGE FILE AUDIT ─ */}
      <div className="rounded-xl border border-gray-800/80 bg-gray-900/30 overflow-hidden">
        <AccordionHeader icon={HardDrive} title="Large File Audit"
          subtitle={`Optimizable files above ${minSizeMb} MB`}
          badge={largeFilesTotal || undefined}
          isOpen={openSection === 'audit'} onToggle={() => toggleSection('audit')}
          accent="text-blue-400" />
        {openSection === 'audit' && (
          <div className="border-t border-gray-800/60">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/40 bg-gray-950/30">
              <span className="text-[11px] text-gray-400 shrink-0">Min size:</span>
              <select value={minSizeMb} onChange={e => setMinSizeMb(parseFloat(e.target.value))}
                className="bg-gray-900 border border-gray-700 text-white text-xs rounded-lg px-2 py-1 focus:outline-none cursor-pointer">
                {[1,5,10,25,50,100].map(v => <option key={v} value={v}>{v} MB</option>)}
              </select>
              <span className="text-[11px] text-gray-400 shrink-0 ml-4">Limit:</span>
              <select value={limit} onChange={e => setLimit(parseInt(e.target.value))}
                className="bg-gray-900 border border-gray-700 text-white text-xs rounded-lg px-2 py-1 focus:outline-none cursor-pointer">
                {[25,50,100,200].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            {loadingFiles
              ? <div className="flex items-center justify-center gap-2 py-10 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
              : optimizableLargeFiles.length === 0
                ? <div className="py-10 text-center text-gray-500 text-sm">No optimizable files above {minSizeMb} MB.</div>
                : <div className="divide-y divide-gray-800/40 max-h-[380px] overflow-y-auto">
                    {optimizableLargeFiles.map(file => {
                      const isSel = selectedFileIds.includes(file.id);
                      return (
                        <div key={file.id}
                          className={`flex items-center gap-2.5 px-4 py-2.5 transition-colors ${isSel ? 'bg-cyan-500/5' : 'hover:bg-gray-800/20'}`}>
                          <button type="button" onClick={() => handleToggle(file.id)} className="text-gray-500 hover:text-white shrink-0">
                            {isSel ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" /> : <Square className="w-3.5 h-3.5" />}
                          </button>
                          <ExtBadge ext={file.extension} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white truncate" title={file.name}>{file.name}</p>
                            <p className="text-[10px] text-gray-500 truncate">{getDirFromPath(file.path)}</p>
                          </div>
                          <span className="text-[11px] font-mono text-gray-400 shrink-0">{file.size_formatted}</span>
                          <button type="button" title="Optimize" onClick={() => handleOpenOptimize(file)}
                            className="w-6 h-6 rounded flex items-center justify-center bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors shrink-0">
                            <Zap className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
            }
            <SelectionBar count={selectedList.length} optimizableCount={selectedOptimizable.length}
              onOptimize={() => selectedOptimizable.length > 0 && handleOpenOptimize(selectedOptimizable[0])}
              onZip={handleOpenZipModal} showOptimize={true} />
          </div>
        )}
      </div>

      {/* ─ SECTION 3: ZIP / ARCHIVE ─ */}
      <div className="rounded-xl border border-gray-800/80 bg-gray-900/30 overflow-hidden">
        <AccordionHeader icon={Archive} title="ZIP / Archive"
          subtitle="Select files from any folder and package into one ZIP"
          badge={selectedFileIds.length > 0 ? `${selectedFileIds.length} selected` : undefined}
          isOpen={openSection === 'zip'} onToggle={() => toggleSection('zip')}
          accent="text-orange-400" />
        {openSection === 'zip' && (
          <div className="border-t border-gray-800/60">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800/40 bg-gray-950/30">
              <span className="text-[11px] text-gray-400">Select files across folders, then create a ZIP.</span>
              <button type="button" onClick={handleSelectAll} className="text-[11px] text-cyan-400 hover:text-cyan-300">
                {selectedFileIds.length === allFiles.length ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <FileBrowser files={allFiles} loading={loadingAllFiles} selectedFileIds={selectedFileIds}
              onToggle={handleToggle} onToggleFolder={handleToggleFolder}
              filterOptimizable={false} showOptimize={false} onOptimize={handleOpenOptimize} />
            <SelectionBar count={selectedList.length} optimizableCount={selectedOptimizable.length}
              onOptimize={() => selectedOptimizable.length > 0 && handleOpenOptimize(selectedOptimizable[0])}
              onZip={handleOpenZipModal} showOptimize={false} />
          </div>
        )}
      </div>

      {/* ─ OPTIMIZATION MODAL ─ */}
      <Modal isOpen={Boolean(optimizeTargetFile)} onClose={handleCloseOptimize}
        title="File Optimization Sandbox"
        maxWidth={candidateResult?.status === 'optimized' ? 'max-w-4xl' : 'max-w-xl'}
        actions={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleCloseOptimize} disabled={analyzingCandidate || applyingOptimization}>
                <span>{applyResult ? 'Close' : 'Cancel'}</span>
              </Button>
              {candidateResult?.status === 'optimized' && !applyResult && (
                <Button variant="outline" size="sm"
                  onClick={() => { setCandidateResult(null); setCandidateError(null); }}
                  disabled={applyingOptimization} className="text-xs">
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1 text-gray-400" /><span>Change Options</span>
                </Button>
              )}
            </div>
            {candidateResult?.status === 'optimized' && !applyResult && (
              <Button variant="primary" size="sm"
                icon={applyingOptimization ? Loader2 : (replaceOriginal ? HardDrive : FileCheck)}
                onClick={handleApplyOptimization} disabled={applyingOptimization}
                className={replaceOriginal
                  ? 'bg-amber-600 hover:bg-amber-500 border-amber-500/30 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500/30 text-white'}>
                <span>{applyingOptimization ? 'Applying...' : replaceOriginal ? 'Replace Original File' : 'Save Optimized Copy'}</span>
              </Button>
            )}
          </div>
        }>
        {optimizeTargetFile && (
          <div className="space-y-6">
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

            {!candidateResult && !applyResult && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-2">Optimization Mode</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'lossless', label: 'Lossless', desc: 'No quality loss', disabled: false, activeClass: 'bg-blue-600/20 border-blue-500/50', icon: 'text-blue-400' },
                      { key: 'lossy',    label: 'Lossy',    desc: 'Smaller file',   disabled: ['.png','.bmp'].includes(optimizeTargetFile.extension), activeClass: 'bg-amber-600/20 border-amber-500/50', icon: 'text-amber-400' },
                    ].map(m => (
                      <button key={m.key} type="button" onClick={() => !m.disabled && setOptimizeMode(m.key)} disabled={m.disabled}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${optimizeMode === m.key ? `${m.activeClass} text-white shadow-sm` : 'bg-gray-950/50 border-gray-800 text-gray-400 hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold">{m.label}</span>
                          {optimizeMode === m.key && <CheckCircle2 className={`w-4 h-4 ${m.icon}`} />}
                        </div>
                        <p className="text-[11px] text-gray-400">{m.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {optimizeMode === 'lossy' && optimizeTargetFile.extension !== '.pdf' && (
                  <div className="p-4 rounded-xl bg-gray-950/60 border border-gray-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-300">JPEG Quality</span>
                      <span className="font-mono font-bold text-amber-400">{lossyQuality}%</span>
                    </div>
                    <input type="range" min={65} max={90} step={1} value={lossyQuality}
                      onChange={e => setLossyQuality(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-500" />
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>65% (Smaller)</span><span>82% (Default)</span><span>90% (Near lossless)</span>
                    </div>
                  </div>
                )}

                {optimizeMode === 'lossy' && optimizeTargetFile.extension?.toLowerCase() === '.pdf' && (
                  <div className="p-4 rounded-xl bg-gray-950/60 border border-amber-800/40 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-300">PDF Image Quality</span>
                      <span className="font-mono font-bold text-amber-400">{pdfImageQuality}%</span>
                    </div>
                    <input type="range" min={50} max={95} step={5} value={pdfImageQuality}
                      onChange={e => setPdfImageQuality(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-500" />
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>50% (Max savings)</span><span>75% (Balanced)</span><span>95% (Near lossless)</span>
                    </div>
                    <p className="text-[10px] text-amber-400/80">Embedded images only. Text/layout unaffected.</p>
                  </div>
                )}

                {optimizeTargetFile.extension === '.bmp' && (
                  <div className="p-4 rounded-xl bg-gray-950/60 border border-gray-800 space-y-2">
                    <span className="text-xs font-semibold text-gray-300 block">Conversion Format</span>
                    <button type="button" onClick={() => setBmpTargetFormat('png')}
                      className="px-4 py-2 rounded-lg text-xs font-semibold border bg-blue-600/20 border-blue-500 text-blue-300">
                      PNG (Deflate Compressed)
                    </button>
                  </div>
                )}

                {(['.jpg','.jpeg','.png','.bmp'].includes(optimizeTargetFile.extension?.toLowerCase()) ||
                  (optimizeTargetFile.extension?.toLowerCase() === '.pdf' && optimizeMode === 'lossy')) && (
                  <div className="p-4 rounded-xl bg-gray-950/60 border border-gray-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-300">
                        {optimizeTargetFile.extension?.toLowerCase() === '.pdf' ? 'Downsample Embedded Images' : 'Resize Resolution'}
                      </span>
                      <span className="text-[10px] text-gray-500">Optional — longest side</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[{label:'Original',value:null},{label:'4K',value:3840},{label:'Full HD',value:1920},{label:'HD',value:1280},{label:'Web 800',value:800},{label:'Thumb 480',value:480}].map(opt => (
                        <button key={String(opt.value)} type="button" onClick={() => setMaxDimension(opt.value)}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border text-center transition-all cursor-pointer ${maxDimension === opt.value ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300' : 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-800'}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {maxDimension && <p className="text-[10px] text-cyan-400">Longest side ≤ {maxDimension}px (LANCZOS, proportional).</p>}
                  </div>
                )}

                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                  <span>Candidate generated in a sandbox. Original is untouched until you explicitly apply.</span>
                </div>
                <div className="pt-2">
                  <Button variant="primary" size="md" icon={analyzingCandidate ? Loader2 : Zap}
                    onClick={handleGenerateCandidate} disabled={analyzingCandidate} className="w-full">
                    <span>{analyzingCandidate ? 'Generating Candidate...' : 'Generate Candidate'}</span>
                  </Button>
                </div>
              </div>
            )}

            {candidateResult && !applyResult && (
              <div className="space-y-4">
                {candidateResult.status === 'optimized' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-1 bg-gray-950/80 rounded-xl border border-gray-800">
                      {[
                        { key: 'metrics', label: 'Comparison Metrics', icon: Layers },
                        { key: 'preview', label: 'Live Preview', icon: Eye },
                      ].map(t => (
                        <button key={t.key} type="button" onClick={() => setComparisonTab(t.key)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${comparisonTab === t.key ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>
                          <t.icon className="w-3.5 h-3.5" /><span>{t.label}</span>
                        </button>
                      ))}
                    </div>

                    {comparisonTab === 'metrics' && (
                      <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" /><span>Candidate Ready</span>
                            </span>
                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                              -{candidateResult.percentage_saved}%
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-500/20 text-center">
                            <div>
                              <span className="text-[10px] text-gray-400 uppercase">Original</span>
                              <div className="text-xs font-mono font-medium text-gray-300 mt-0.5">{candidateResult.original_size_formatted}</div>
                              {candidateResult.original_width && <div className="text-[10px] text-gray-500 mt-0.5">{candidateResult.original_width}×{candidateResult.original_height}px</div>}
                            </div>
                            <div className="flex items-center justify-center text-emerald-400"><ArrowRight className="w-4 h-4" /></div>
                            <div>
                              <span className="text-[10px] text-gray-400 uppercase">Optimized</span>
                              <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">{candidateResult.candidate_size_formatted}</div>
                              {candidateResult.candidate_width && <div className="text-[10px] text-emerald-600 mt-0.5">{candidateResult.candidate_width}×{candidateResult.candidate_height}px</div>}
                            </div>
                          </div>
                          <div className="text-center pt-1">
                            <span className="text-xs text-emerald-300">Saved: <strong className="font-mono text-emerald-400">{candidateResult.bytes_saved_formatted}</strong></span>
                          </div>
                        </div>
                        {optimizeTargetFile.extension?.toLowerCase() === '.pdf' && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                            {[
                              {label:'Pages',val:candidateResult.page_count??'—',color:'text-gray-200'},
                              {label:'Images Opt.',val:`${candidateResult.images_optimized??0}/${candidateResult.images_count??0}`,color:'text-emerald-400'},
                              {label:'Downsampled',val:candidateResult.images_downsampled??0,color:'text-cyan-400'},
                              {label:'Streams',val:candidateResult.streams_compressed?`${candidateResult.streams_compressed}`:'OK',color:'text-blue-400'},
                            ].map(s => (
                              <div key={s.label} className="p-2.5 rounded-lg bg-gray-950/60 border border-gray-800">
                                <span className="text-[10px] text-gray-500 block uppercase">{s.label}</span>
                                <span className={`font-mono font-bold mt-0.5 block ${s.color}`}>{s.val}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="p-3 rounded-lg bg-gray-950/60 border border-gray-800 text-[11px] text-gray-400 space-y-1">
                          <div>Strategy: <span className="text-gray-200 font-mono">{candidateResult.strategy_used}</span></div>
                          <div>Mode: <span className="text-gray-200">{candidateResult.is_lossless ? 'Lossless bit-exact' : 'Perceptually balanced'}</span></div>
                          {candidateResult.execution_time_ms && <div>Time: <span className="text-gray-200 font-mono">{candidateResult.execution_time_ms}ms</span></div>}
                        </div>
                      </div>
                    )}

                    {comparisonTab === 'preview' && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 bg-gray-950/70 p-2 rounded-xl border border-gray-800">
                          {[
                            {key:'candidate',label:`Compressed (${candidateResult.candidate_size_formatted})`,cls:'bg-emerald-600/20 text-emerald-300 border-emerald-500/50'},
                            {key:'original', label:`Original (${candidateResult.original_size_formatted})`,cls:'bg-blue-600/20 text-blue-300 border-blue-500/50'},
                          ].map(b => (
                            <button key={b.key} type="button" onClick={() => setPreviewTarget(b.key)}
                              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${previewTarget === b.key ? `border ${b.cls}` : 'text-gray-400 hover:text-gray-200'}`}>
                              {b.label}
                            </button>
                          ))}
                        </div>
                        <div className="bg-gray-950 rounded-xl border border-gray-800 overflow-hidden min-h-[440px] flex items-center justify-center">
                          {optimizeTargetFile.extension?.toLowerCase() === '.pdf'
                            ? <iframe key={previewTarget} src={storageService.getCandidatePreviewUrl(candidateResult.candidate_token, previewTarget)} title="PDF" className="w-full h-[450px] border-0 bg-white" />
                            : <img key={previewTarget} src={storageService.getCandidatePreviewUrl(candidateResult.candidate_token, previewTarget)} alt="Preview" className="max-h-[440px] max-w-full object-contain p-2" />}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-1">
                      <div className="text-xs font-semibold text-gray-300">Select Save Option</div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          {val:false,label:'Create Copy',icon:Copy,desc:'New file. Original untouched.',badge:'Recommended',badgeCls:'bg-emerald-500/20 text-emerald-300',activeCls:'bg-emerald-600/15 border-emerald-500 ring-emerald-500/30',iconCls:'text-emerald-400'},
                          {val:true, label:'Replace Original',icon:HardDrive,desc:'Replaces in-place. Backup protects you.',badge:'Frees Space',badgeCls:'bg-amber-500/20 text-amber-300',activeCls:'bg-amber-600/15 border-amber-500 ring-amber-500/30',iconCls:'text-amber-400'},
                        ].map(opt => (
                          <button key={String(opt.val)} type="button" onClick={() => setReplaceOriginal(opt.val)}
                            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${replaceOriginal === opt.val ? `${opt.activeCls} text-white shadow-sm ring-1` : 'bg-gray-950/60 border-gray-800 text-gray-400 hover:bg-gray-900'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <opt.icon className={`w-4 h-4 ${opt.iconCls}`} />
                                <span className="text-xs font-bold text-gray-100">{opt.label}</span>
                              </div>
                              <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded ${opt.badgeCls} font-bold`}>{opt.badge}</span>
                            </div>
                            <div className="text-[11px] text-gray-400 mt-1.5 leading-snug">{opt.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-900/80 border border-gray-800 text-[11px] text-gray-300 flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{replaceOriginal ? 'Safely replaced with backup rollback protection.' : 'New copy created. Original untouched.'}</span>
                    </div>
                  </div>
                ) : candidateResult.status === 'no_meaningful_savings' ? (
                  <div className="p-5 rounded-xl bg-gray-950/80 border border-gray-800 text-center space-y-2">
                    <Info className="w-6 h-6 text-blue-400 mx-auto" />
                    <h4 className="text-sm font-bold text-white">No Meaningful Savings</h4>
                    <p className="text-xs text-gray-400">Already well-compressed. Below 20 KB / 3% threshold.</p>
                    <p className="text-[11px] text-emerald-400 font-medium">Original unchanged.</p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-2 text-center">
                    <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
                    <h4 className="text-sm font-bold text-white">Optimization Not Applicable</h4>
                    <p className="text-xs text-gray-300">{candidateResult.reason || 'Cannot optimize further.'}</p>
                  </div>
                )}
              </div>
            )}

            {applyResult && (
              <div className="p-6 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
                <h4 className="text-base font-bold text-white">Optimization Applied!</h4>
                <p className="text-xs text-gray-300">{applyResult.message}</p>
                <div className="text-xs font-mono text-emerald-400">New size: {candidateResult?.candidate_size_formatted}</div>
              </div>
            )}

            {candidateError && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" /><span>{candidateError}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ─ ZIP MODAL ─ */}
      <Modal isOpen={showZipModal} onClose={() => setShowZipModal(false)}
        title="Create ZIP Archive"
        subtitle={`Packaging ${selectedFileIds.length} selected files`}
        maxWidth="max-w-lg"
        actions={
          <div className="flex items-center justify-between w-full">
            <Button variant="ghost" size="sm" onClick={() => setShowZipModal(false)} disabled={creatingZip}>
              <span>{zipResult ? 'Close' : 'Cancel'}</span>
            </Button>
            {!zipResult && (
              <Button variant="primary" size="sm" icon={Archive} onClick={handleCreateZip}
                disabled={creatingZip || !zipDestination}
                className="bg-amber-600 hover:bg-amber-500 border-amber-500/30 text-white">
                <span>{creatingZip ? 'Compressing...' : 'Create Archive'}</span>
              </Button>
            )}
          </div>
        }>
        <div className="space-y-4">
          {!zipResult ? (
            <>
              <div className="p-3.5 rounded-xl bg-gray-950/70 border border-gray-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-gray-300">Selected Files</span>
                  <div className="text-[11px] text-gray-400 mt-0.5">{selectedFileIds.length} files</div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-gray-300">Total Size</span>
                  <div className="text-xs font-mono font-bold text-amber-400 mt-0.5">{(selectedBytes/(1024*1024)).toFixed(2)} MB</div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 block">Destination Path</label>
                <div className="flex gap-2">
                  <input type="text" value={zipDestination} onChange={e => setZipDestination(e.target.value)}
                    placeholder="C:\Users\...\archive.zip"
                    className="flex-1 px-3.5 py-2 rounded-xl bg-gray-950 border border-gray-800 text-xs text-white font-mono focus:border-amber-500 focus:outline-none" />
                  <Button type="button" variant="secondary" size="sm" icon={FolderOpen}
                    onClick={handleBrowseZipDestination} className="shrink-0">
                    <span>Browse…</span>
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-300">Compression Level</span>
                  <span className="font-mono text-amber-400 font-bold">Level {zipCompressionLevel}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[{label:'Store (0)',val:0},{label:'Fast (6)',val:6},{label:'Max (9)',val:9}].map(l => (
                    <button key={l.val} type="button" onClick={() => setZipCompressionLevel(l.val)}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${zipCompressionLevel === l.val ? 'bg-amber-600/20 border-amber-500 text-amber-300' : 'bg-gray-950 border-gray-800 text-gray-400 hover:bg-gray-900'}`}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-950/60 border border-gray-800">
                <div className="text-xs">
                  <span className="font-semibold text-gray-300 block">Overwrite Existing</span>
                  <span className="text-[11px] text-gray-500">Replace if archive already exists</span>
                </div>
                <input type="checkbox" checked={zipOverwrite} onChange={e => setZipOverwrite(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-900 border-gray-700 text-amber-600 focus:ring-0 cursor-pointer" />
              </div>
            </>
          ) : (
            <div className="p-5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="text-base font-bold text-white">ZIP Created!</h4>
              <p className="text-xs text-gray-300">Archived {zipResult.files_archived} files into:</p>
              <div className="p-2 rounded bg-gray-950/80 font-mono text-[11px] text-cyan-300 truncate">{zipResult.destination_path}</div>
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                <div className="p-2 rounded bg-gray-900/60">
                  <span className="text-[10px] text-gray-400 uppercase block">Archive Size</span>
                  <span className="font-mono font-bold text-white">{(zipResult.archive_size_bytes/(1024*1024)).toFixed(2)} MB</span>
                </div>
                <div className="p-2 rounded bg-gray-900/60">
                  <span className="text-[10px] text-gray-400 uppercase block">Saved</span>
                  <span className="font-mono font-bold text-emerald-400">{zipResult.percentage_saved}%</span>
                </div>
              </div>
              {window.electronAPI?.showItemInFolder && (
                <div className="pt-2">
                  <Button type="button" variant="secondary" size="sm" icon={FolderOpen}
                    onClick={() => window.electronAPI.showItemInFolder(zipResult.destination_path)} className="text-xs">
                    <span>Show in Explorer</span>
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
