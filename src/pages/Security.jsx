import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, Lock, Unlock, Eye, EyeOff, FolderLock, FolderPlus,
  Trash2, RefreshCw, ClipboardList, HardDrive, Download, Upload,
  CheckCircle2, AlertTriangle, XCircle, Info, Filter, ChevronDown,
  Database, Cpu, Globe
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { useApp } from '../context/AppContext';
import { securityService } from '../services/securityService';
import { useNavigate } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Small reusable row
// ---------------------------------------------------------------------------
const SettingRow = ({ label, description, children }) => (
  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-900/60 border border-gray-800">
    <div className="flex-1 min-w-0 mr-4">
      <h4 className="text-xs font-semibold text-gray-200">{label}</h4>
      {description && <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{description}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const StatusBadge = ({ ok, label }) => (
  <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${
    ok ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
       : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
  }`}>
    {ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
    {label}
  </span>
);

// ---------------------------------------------------------------------------
// Tab: Overview
// ---------------------------------------------------------------------------
const OverviewTab = ({ settings, onRefresh }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 space-y-2">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Lock className="w-3.5 h-3.5" /> Application Lock
        </div>
        <StatusBadge ok={settings?.lock_enabled} label={settings?.lock_enabled ? 'Enabled' : 'Disabled'} />
      </div>
      <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 space-y-2">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <ShieldCheck className="w-3.5 h-3.5" /> PIN Configured
        </div>
        <StatusBadge ok={settings?.has_pin} label={settings?.has_pin ? 'Set' : 'Not Set'} />
      </div>
      <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 space-y-2">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Globe className="w-3.5 h-3.5" /> Data Processing
        </div>
        <StatusBadge ok={true} label="100% Local" />
      </div>
    </div>

    <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
        <Cpu className="w-3.5 h-3.5" /> Local Processing Guarantee
      </div>
      <p className="text-[11px] text-emerald-300/80 leading-relaxed">
        All document indexing, OCR, semantic embeddings (all-MiniLM-L6-v2), FAISS vector search, and
        AI classification run exclusively on your local hardware. No file contents, OCR text, embeddings,
        metadata, or audit logs are ever transmitted to any external service.
      </p>
    </div>

    <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/20 space-y-1">
      <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
        <Info className="w-3.5 h-3.5" /> Backup Encryption Note
      </div>
      <p className="text-[11px] text-blue-300/70 leading-relaxed">
        Backup ZIP files are <strong>not encrypted</strong>. Store backups in a secure location you control.
        The backup contains hashed PIN data and indexed metadata — but never original user files.
        Encryption support can be added in a future update when a secure key-storage mechanism is available.
      </p>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Tab: Application Lock
// ---------------------------------------------------------------------------
const LockTab = ({ settings, sessionToken, onRefresh, addToast }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);
  const { lockApp, isAuthenticated } = useApp();

  const handleSetPin = async (e) => {
    e.preventDefault();
    if (pin.length < 4) { addToast('PIN must be at least 4 characters.', 'warning'); return; }
    if (pin !== confirmPin) { addToast('PINs do not match.', 'error'); return; }
    setLoading(true);
    try {
      await securityService.setPin(pin, settings?.has_pin ? currentPin : null, sessionToken);
      addToast('PIN updated successfully.', 'success');
      setPin(''); setConfirmPin(''); setCurrentPin('');
      onRefresh();
    } catch (err) {
      addToast(err.message || 'Failed to set PIN.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLock = async () => {
    setLockLoading(true);
    try {
      await securityService.setLockEnabled(!settings?.lock_enabled, sessionToken);
      addToast(`Application lock ${!settings?.lock_enabled ? 'enabled' : 'disabled'}.`, 'success');
      onRefresh();
    } catch (err) {
      addToast(err.message || 'Failed to toggle lock.', 'error');
    } finally {
      setLockLoading(false);
    }
  };

  const handleLockNow = async () => {
    await lockApp();
    addToast('Application locked.', 'info');
  };

  return (
    <div className="space-y-5">
      {/* Lock toggle */}
      <SettingRow
        label="Application Lock"
        description={
          settings?.lock_enabled
            ? 'The application requires PIN authentication on launch and after locking.'
            : 'Enable to require PIN authentication when Memora starts.'
        }
      >
        <button
          id="toggle-app-lock-btn"
          onClick={handleToggleLock}
          disabled={lockLoading || (!settings?.has_pin && !settings?.lock_enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings?.lock_enabled ? 'bg-blue-600' : 'bg-gray-700'
          } disabled:opacity-40 cursor-pointer`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            settings?.lock_enabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </SettingRow>

      {/* Lock Now */}
      {settings?.lock_enabled && isAuthenticated && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-yellow-950/20 border border-yellow-500/20">
          <div>
            <h4 className="text-xs font-semibold text-yellow-300">Lock Now</h4>
            <p className="text-[11px] text-yellow-400/60">Immediately invalidate your session. PIN required to unlock again.</p>
          </div>
          <Button variant="danger" size="sm" icon={Lock} onClick={handleLockNow}>Lock Now</Button>
        </div>
      )}

      {/* PIN form */}
      <div className="glass-panel p-5 rounded-2xl border-gray-800/80 space-y-4">
        <h3 className="text-xs font-bold text-white">{settings?.has_pin ? 'Change PIN' : 'Set PIN'}</h3>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          PIN is stored only as a PBKDF2-HMAC-SHA256 hash with a random salt (260,000 iterations).
          It is never stored as plaintext and never transmitted to any external service.
        </p>
        <form onSubmit={handleSetPin} className="space-y-3">
          {settings?.has_pin && (
            <div className="relative flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-900/80 border border-gray-700/80">
              <Lock className="w-3.5 h-3.5 text-gray-500" />
              <input
                type={showPin ? 'text' : 'password'}
                value={currentPin}
                onChange={e => setCurrentPin(e.target.value)}
                placeholder="Current PIN"
                maxLength={32}
                autoComplete="current-password"
                className="flex-1 bg-transparent text-white text-xs outline-none placeholder-gray-500"
              />
            </div>
          )}
          <div className="relative flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-900/80 border border-gray-700/80">
            <Lock className="w-3.5 h-3.5 text-gray-500" />
            <input
              type={showPin ? 'text' : 'password'}
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="New PIN (min 4 chars)"
              minLength={4}
              maxLength={32}
              autoComplete="new-password"
              className="flex-1 bg-transparent text-white text-xs outline-none placeholder-gray-500"
            />
            <button type="button" onClick={() => setShowPin(v => !v)} className="text-gray-500 hover:text-gray-300">
              {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-900/80 border border-gray-700/80">
            <Lock className="w-3.5 h-3.5 text-gray-500" />
            <input
              type={showPin ? 'text' : 'password'}
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value)}
              placeholder="Confirm new PIN"
              maxLength={32}
              autoComplete="new-password"
              className="flex-1 bg-transparent text-white text-xs outline-none placeholder-gray-500"
            />
          </div>
          <Button type="submit" variant="primary" size="sm" icon={ShieldCheck}
            disabled={loading || !pin || !confirmPin}>
            {loading ? 'Saving…' : settings?.has_pin ? 'Change PIN' : 'Set PIN'}
          </Button>
        </form>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tab: Excluded Folders
// ---------------------------------------------------------------------------
const ExcludedFoldersTab = ({ sessionToken, addToast }) => {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [customPath, setCustomPath] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await securityService.getExcludedFolders(sessionToken);
      setFolders(data);
    } catch (err) {
      addToast('Could not load excluded folders.', 'error');
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    const path = customPath.trim();
    if (!path) return;
    setAdding(true);
    try {
      await securityService.addExcludedFolder(path, sessionToken);
      setCustomPath('');
      addToast('Folder added to exclusion list.', 'success');
      load();
    } catch (err) {
      addToast(err.message || 'Failed to add excluded folder.', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleAddNative = async () => {
    if (window.electronAPI?.openDirectory) {
      const result = await window.electronAPI.openDirectory();
      if (!result.canceled && result.filePaths?.[0]) {
        setCustomPath(result.filePaths[0]);
      }
    }
  };

  const handleRemove = async (id, path) => {
    try {
      await securityService.removeExcludedFolder(id, sessionToken);
      addToast('Folder removed from exclusion list.', 'info');
      load();
    } catch (err) {
      addToast(err.message || 'Failed to remove exclusion.', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl bg-gray-900/40 border border-gray-800 text-xs text-gray-400 leading-relaxed">
        <strong className="text-gray-300">Private / Excluded Folders</strong><br />
        Files inside excluded folders are skipped during scanning and indexing.
        Existing indexed data from a folder you exclude is <em>not automatically removed</em> —
        use Data Management to remove it explicitly. Original user files are never deleted.
      </div>

      {/* Add new exclusion */}
      <div className="flex gap-2">
        <input
          value={customPath}
          onChange={e => setCustomPath(e.target.value)}
          placeholder="Absolute folder path to exclude…"
          className="flex-1 px-3 py-2 rounded-xl bg-gray-900/80 border border-gray-700/80 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500/60"
        />
        {window.electronAPI?.openDirectory && (
          <Button variant="secondary" size="sm" icon={FolderPlus} onClick={handleAddNative}>Browse</Button>
        )}
        <Button variant="primary" size="sm" onClick={handleAdd} disabled={adding || !customPath.trim()}>
          {adding ? 'Adding…' : 'Exclude'}
        </Button>
      </div>

      {/* Folder list */}
      {loading ? (
        <div className="text-xs text-gray-500 animate-pulse">Loading…</div>
      ) : folders.length === 0 ? (
        <div className="text-xs text-gray-500 text-center py-8">No folders excluded. All approved folders are scanned.</div>
      ) : (
        <div className="space-y-2">
          {folders.map(f => (
            <div key={f.id} className="flex items-center justify-between p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FolderLock className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                  <p className="text-xs font-mono text-gray-200 truncate">{f.path}</p>
                </div>
                <p className="text-[11px] text-gray-500 ml-6 mt-0.5">
                  Excluded since {new Date(f.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleRemove(f.id, f.path)}
                className="ml-3 p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tab: Audit Log
// ---------------------------------------------------------------------------
const AuditLogTab = ({ sessionToken, addToast }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showClearModal, setShowClearModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await securityService.getAuditLogs(
        { action: actionFilter || undefined, status: statusFilter || undefined },
        sessionToken
      );
      setLogs(data);
    } catch (err) {
      addToast('Could not load audit logs.', 'error');
    } finally {
      setLoading(false);
    }
  }, [sessionToken, actionFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleClear = async () => {
    try {
      await securityService.clearAuditLogs(sessionToken);
      addToast('Audit logs cleared.', 'success');
      setShowClearModal(false);
      load();
    } catch (err) {
      addToast(err.message || 'Failed to clear logs.', 'error');
    }
  };

  const statusColor = (s) => s === 'success'
    ? 'text-emerald-400 bg-emerald-500/10'
    : 'text-red-400 bg-red-500/10';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          placeholder="Filter by action…"
          className="px-3 py-1.5 rounded-lg bg-gray-900/80 border border-gray-700/80 text-xs text-white placeholder-gray-500 outline-none w-40"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-gray-900/80 border border-gray-700/80 text-xs text-gray-300 outline-none"
        >
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
        </select>
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={load}>Refresh</Button>
        <div className="flex-1" />
        <Button variant="danger" size="sm" icon={Trash2} onClick={() => setShowClearModal(true)}>
          Clear Logs
        </Button>
      </div>

      {/* Log table */}
      {loading ? (
        <div className="text-xs text-gray-500 animate-pulse py-4">Loading audit logs…</div>
      ) : logs.length === 0 ? (
        <div className="text-xs text-gray-500 text-center py-10">No audit log entries found.</div>
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto custom-scrollbar pr-1">
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-900/50 border border-gray-800/80 text-xs">
              <span className={`mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${statusColor(log.status)}`}>
                {log.status}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-mono text-blue-300">{log.action}</span>
                  {log.resource && <span className="text-gray-400 truncate max-w-xs">{log.resource}</span>}
                </div>
                {log.error && <p className="text-red-400 text-[10px] mt-0.5">{log.error}</p>}
              </div>
              <span className="text-gray-600 text-[10px] shrink-0 whitespace-nowrap">
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Clear confirmation modal */}
      <Modal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        title="Clear Audit Logs"
        subtitle="This action cannot be undone."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowClearModal(false)}>Cancel</Button>
            <Button variant="danger" size="sm" icon={Trash2} onClick={handleClear}>Clear All Logs</Button>
          </>
        }
      >
        <p className="text-sm text-gray-300">
          All audit log entries will be deleted. A single record of this clearing event will be retained.
        </p>
        <p className="text-xs text-gray-500 mt-2">Original user files are not affected.</p>
      </Modal>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tab: Data Management
// ---------------------------------------------------------------------------
const DataManagementTab = ({ sessionToken, folders, addToast }) => {
  const [confirm, setConfirm] = useState(null); // { scope, folderId, label }
  const [loading, setLoading] = useState(false);

  const handleRemove = async () => {
    if (!confirm) return;
    setLoading(true);
    try {
      const result = await securityService.removeIndexData(
        { scope: confirm.scope, folderId: confirm.folderId },
        sessionToken
      );
      addToast(`Removed: ${result.files_removed ?? 0} files, ${result.chunks_removed ?? 0} chunks, ${result.vector_mappings_removed ?? 0} vectors.`, 'success');
      setConfirm(null);
    } catch (err) {
      addToast(err.message || 'Data removal failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-yellow-950/20 border border-yellow-500/20 text-xs text-yellow-300 leading-relaxed">
        <strong>Important distinctions:</strong><br />
        • <em>Remove indexed metadata</em> — deletes Memora's File/Chunk/Vector records from SQLite and FAISS. Original user files on disk are <strong>NOT deleted</strong>.<br />
        • <em>Remove vector data only</em> — resets the FAISS vector index and VectorMapping table. Chunk text and file records are kept; you can re-index later.<br />
        • <em>Delete original files</em> — Memora does NOT have this feature; never deletes user files automatically.
      </div>

      <div className="space-y-3">
        {/* Remove all indexed metadata */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-900/60 border border-gray-800">
          <div>
            <h4 className="text-xs font-semibold text-gray-200">Remove All Indexed Metadata</h4>
            <p className="text-[11px] text-gray-400">Removes all File, Chunk, and Vector records from Memora's database and FAISS index. Original files untouched.</p>
          </div>
          <Button variant="danger" size="sm" icon={Database}
            onClick={() => setConfirm({ scope: 'metadata', folderId: null, label: 'all indexed metadata' })}>
            Remove
          </Button>
        </div>

        {/* Remove vectors only */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-900/60 border border-gray-800">
          <div>
            <h4 className="text-xs font-semibold text-gray-200">Reset Vector Index Only</h4>
            <p className="text-[11px] text-gray-400">Clears the FAISS vector index and VectorMapping table. Chunk text and file records are preserved. Re-index to restore search.</p>
          </div>
          <Button variant="secondary" size="sm" icon={Cpu}
            onClick={() => setConfirm({ scope: 'vectors', folderId: null, label: 'vector index (FAISS + mappings)' })}>
            Reset Vectors
          </Button>
        </div>

        {/* Per-folder removal */}
        {folders.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 font-semibold">Remove indexed data for a specific folder:</p>
            {folders.map(f => (
              <div key={f.id} className="flex items-center justify-between p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-200 truncate">{f.name}</p>
                  <p className="text-[11px] text-gray-500 font-mono truncate">{f.path}</p>
                </div>
                <Button variant="danger" size="sm" icon={Trash2}
                  onClick={() => setConfirm({ scope: 'metadata', folderId: f.id, label: `indexed data for "${f.name}"` })}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      <Modal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        title="Confirm Data Removal"
        subtitle="This removes Memora's indexed data only — original files are safe."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="danger" size="sm" icon={Trash2} onClick={handleRemove} disabled={loading}>
              {loading ? 'Removing…' : 'Yes, Remove'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-300">
          You are about to remove <strong className="text-white">{confirm?.label}</strong> from Memora's database.
        </p>
        <p className="text-xs text-yellow-400 mt-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
          Original user files on disk will NOT be deleted. Only Memora's indexed metadata will be removed.
        </p>
      </Modal>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tab: Backup & Restore
// ---------------------------------------------------------------------------
const BackupRestoreTab = ({ sessionToken, addToast }) => {
  const [backupDir, setBackupDir] = useState('');
  const [restorePath, setRestorePath] = useState('');
  const [validateResult, setValidateResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  const handleBrowseBackupDest = async () => {
    if (window.electronAPI?.openDirectory) {
      const result = await window.electronAPI.openDirectory();
      if (!result.canceled && result.filePaths?.[0]) setBackupDir(result.filePaths[0]);
    }
  };

  const handleCreateBackup = async () => {
    if (!backupDir.trim()) { addToast('Choose a backup destination first.', 'warning'); return; }
    setLoading(true);
    try {
      const result = await securityService.createBackup(backupDir.trim(), sessionToken);
      addToast(`Backup created: ${result.backup_path}`, 'success');
    } catch (err) {
      addToast(err.message || 'Backup failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!restorePath.trim()) { addToast('Enter a backup file path first.', 'warning'); return; }
    setLoading(true);
    try {
      const res = await securityService.validateBackup(restorePath.trim(), sessionToken);
      setValidateResult(res);
    } catch (err) {
      setValidateResult({ valid: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      await securityService.restoreBackup(restorePath.trim(), sessionToken);
      addToast('Restore completed. Please restart Memora to apply changes.', 'success');
      setShowRestoreModal(false);
    } catch (err) {
      addToast(err.message || 'Restore failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl bg-gray-900/40 border border-gray-800 text-xs text-gray-400 leading-relaxed">
        Backup covers: SQLite database, FAISS vector index, and FAISS mapping file.
        <strong className="text-gray-300"> Original user files are NOT backed up.</strong> PIN data is included as a hash (not plaintext).
        Backups are <strong className="text-yellow-300">not encrypted</strong> — store in a secure location you control.
      </div>

      {/* Create backup */}
      <div className="glass-panel p-5 rounded-2xl border-gray-800/80 space-y-3">
        <h3 className="text-xs font-bold text-white">Create Backup</h3>
        <div className="flex gap-2">
          <input
            value={backupDir}
            onChange={e => setBackupDir(e.target.value)}
            placeholder="Backup destination folder…"
            className="flex-1 px-3 py-2 rounded-xl bg-gray-900/80 border border-gray-700/80 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500/60"
          />
          {window.electronAPI?.openDirectory && (
            <Button variant="secondary" size="sm" onClick={handleBrowseBackupDest}>Browse</Button>
          )}
        </div>
        <Button variant="primary" size="sm" icon={Download} onClick={handleCreateBackup}
          disabled={loading || !backupDir.trim()}>
          {loading ? 'Creating…' : 'Create Backup'}
        </Button>
      </div>

      {/* Restore */}
      <div className="glass-panel p-5 rounded-2xl border-gray-800/80 space-y-3">
        <h3 className="text-xs font-bold text-white">Restore from Backup</h3>
        <div className="flex gap-2">
          <input
            value={restorePath}
            onChange={e => { setRestorePath(e.target.value); setValidateResult(null); }}
            placeholder="Path to backup .zip file…"
            className="flex-1 px-3 py-2 rounded-xl bg-gray-900/80 border border-gray-700/80 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500/60"
          />
          <Button variant="secondary" size="sm" onClick={handleValidate} disabled={loading || !restorePath.trim()}>
            Validate
          </Button>
        </div>

        {validateResult && (
          <div className={`p-3 rounded-xl text-xs ${validateResult.valid
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
            : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
            {validateResult.valid ? (
              <>
                <strong>✓ Valid backup</strong> — created {validateResult.manifest?.created_at?.split('T')[0]},
                format v{validateResult.manifest?.backup_format_version}
              </>
            ) : (
              <><strong>✗ Invalid:</strong> {validateResult.error}</>
            )}
          </div>
        )}

        <Button variant="danger" size="sm" icon={Upload}
          disabled={!validateResult?.valid || loading}
          onClick={() => setShowRestoreModal(true)}>
          Restore Backup
        </Button>
      </div>

      {/* Restore confirmation modal */}
      <Modal
        isOpen={showRestoreModal}
        onClose={() => setShowRestoreModal(false)}
        title="Confirm Restore"
        subtitle="Current application data will be replaced."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowRestoreModal(false)}>Cancel</Button>
            <Button variant="danger" size="sm" icon={Upload} onClick={handleRestore} disabled={loading}>
              {loading ? 'Restoring…' : 'Yes, Restore'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-300">
          This will replace Memora's current database and vector index with the backup data.
          A <strong className="text-white">safety backup</strong> of your current data will be created first.
        </p>
        <p className="text-xs text-yellow-400 mt-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
          Original user files on disk will NOT be modified. After restoring, restart Memora to apply changes.
        </p>
      </Modal>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Security page
// ---------------------------------------------------------------------------
const TABS = [
  { id: 'overview',   label: 'Overview',          icon: ShieldCheck  },
  { id: 'lock',       label: 'Application Lock',  icon: Lock         },
  { id: 'excluded',   label: 'Excluded Folders',  icon: FolderLock   },
  { id: 'audit',      label: 'Audit Log',         icon: ClipboardList },
  { id: 'data',       label: 'Data Management',   icon: Database     },
  { id: 'backup',     label: 'Backup & Restore',  icon: HardDrive    },
];

export const Security = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [settings, setSettings] = useState(null);
  const { sessionToken, folders, addToast, refreshSecuritySettings } = useApp();

  const loadSettings = useCallback(async () => {
    try {
      const data = await securityService.getSettings(sessionToken);
      setSettings(data);
    } catch (err) {
      console.warn('Security settings load error:', err);
    }
  }, [sessionToken]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleRefresh = () => {
    loadSettings();
    refreshSecuritySettings();
  };

  return (
    <div className="space-y-6 select-none">
      <PageHeader
        title="Security & Privacy"
        subtitle="Application lock, access control, audit log, data management, and backup."
        badge={<Badge variant="blue">Module 5</Badge>}
      />

      {/* Tab navigation */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-3 overflow-x-auto custom-scrollbar flex-nowrap">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`security-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="glass-panel p-6 rounded-2xl border-gray-800/80">
        {activeTab === 'overview'  && <OverviewTab settings={settings} onRefresh={handleRefresh} />}
        {activeTab === 'lock'      && <LockTab settings={settings} sessionToken={sessionToken} onRefresh={handleRefresh} addToast={addToast} />}
        {activeTab === 'excluded'  && <ExcludedFoldersTab sessionToken={sessionToken} addToast={addToast} />}
        {activeTab === 'audit'     && <AuditLogTab sessionToken={sessionToken} addToast={addToast} />}
        {activeTab === 'data'      && <DataManagementTab sessionToken={sessionToken} folders={folders} addToast={addToast} />}
        {activeTab === 'backup'    && <BackupRestoreTab sessionToken={sessionToken} addToast={addToast} />}
      </div>
    </div>
  );
};
