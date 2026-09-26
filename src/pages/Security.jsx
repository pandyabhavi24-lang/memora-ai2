import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, Lock, Unlock, Eye, EyeOff, FolderLock, FolderPlus, FilePlus,
  Trash2, RefreshCw, ClipboardList, HardDrive, Download, Upload,
  CheckCircle2, AlertTriangle, XCircle, Info, Filter, ChevronDown,
  Database, Cpu, Globe, Key, FileText, Folder, AlertCircle
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { useApp } from '../context/AppContext';
import { securityService } from '../services/securityService';

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
const OverviewTab = ({ settings }) => (
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
        <Cpu className="w-3.5 h-3.5" /> Local Processing & AES-256-GCM Encryption Guarantee
      </div>
      <p className="text-[11px] text-emerald-300/80 leading-relaxed">
        All document indexing, OCR, vector embeddings, local file/folder encryption (AES-256-GCM), and audit logs execute exclusively on your computer.
        No file contents, encryption keys, OCR text, or search queries leave your local machine.
      </p>
    </div>

    <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/20 space-y-1">
      <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
        <Info className="w-3.5 h-3.5" /> Core Security Action Distinctions
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 text-[11px]">
        <div className="p-2.5 rounded-lg bg-gray-900/50 border border-gray-800">
          <strong className="text-yellow-400 block mb-1">1. Exclude</strong>
          Stops scanning and indexing. Does NOT delete or encrypt the file on disk.
        </div>
        <div className="p-2.5 rounded-lg bg-gray-900/50 border border-gray-800">
          <strong className="text-purple-400 block mb-1">2. Encrypt</strong>
          Protects actual file contents locally with AES-256-GCM. Unreadable without decryption.
        </div>
        <div className="p-2.5 rounded-lg bg-gray-900/50 border border-gray-800">
          <strong className="text-red-400 block mb-1">3. Delete Permanently</strong>
          Permanently removes original file/folder from computer disk with confirmation modal.
        </div>
      </div>
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

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailCurrentPin, setEmailCurrentPin] = useState('');
  const [newRecoveryEmail, setNewRecoveryEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const { lockApp, isAuthenticated } = useApp();

  const handleSetPin = async (e) => {
    e.preventDefault();
    if (pin.length < 4) { addToast('PIN must be at least 4 characters.', 'warning'); return; }
    if (pin !== confirmPin) { addToast('PINs do not match.', 'error'); return; }
    setLoading(true);
    try {
      await securityService.setPin(pin, settings?.has_pin ? currentPin : null, null, sessionToken);
      addToast('PIN updated successfully.', 'success');
      setPin(''); setConfirmPin(''); setCurrentPin('');
      onRefresh();
    } catch (err) {
      addToast(err.message || 'Failed to set PIN.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRecoveryEmail = async (e) => {
    e.preventDefault();
    if (!newRecoveryEmail || !newRecoveryEmail.includes('@') || !newRecoveryEmail.includes('.')) {
      addToast('Please enter a valid recovery email.', 'warning');
      return;
    }
    setEmailLoading(true);
    try {
      await securityService.changeRecoveryEmail(emailCurrentPin, newRecoveryEmail.trim(), sessionToken);
      addToast('Recovery email updated successfully.', 'success');
      setShowEmailModal(false);
      setEmailCurrentPin('');
      setNewRecoveryEmail('');
      onRefresh();
    } catch (err) {
      addToast(err.message || 'Failed to update recovery email.', 'error');
    } finally {
      setEmailLoading(false);
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

      <SettingRow
        label="PIN"
        description="Stored as a secure PBKDF2-HMAC-SHA256 hash. Never stored as plaintext."
      >
        <span className="font-mono text-gray-400 text-xs tracking-widest mr-3">••••••••</span>
      </SettingRow>

      <SettingRow
        label="Recovery Email"
        description="Used to send a 10-minute reset code if you forget your PIN."
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-blue-300 text-xs">
            {settings?.masked_recovery_email || 'Not configured'}
          </span>
          <Button variant="secondary" size="sm" onClick={() => setShowEmailModal(true)}>
            Change Recovery Email
          </Button>
        </div>
      </SettingRow>

      {settings?.lock_enabled && isAuthenticated && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-yellow-950/20 border border-yellow-500/20">
          <div>
            <h4 className="text-xs font-semibold text-yellow-300">Lock Now</h4>
            <p className="text-[11px] text-yellow-400/60">Immediately invalidate your session. PIN required to unlock again.</p>
          </div>
          <Button variant="danger" size="sm" icon={Lock} onClick={handleLockNow}>Lock Now</Button>
        </div>
      )}

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

      <Modal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        title="Change Recovery Email"
        subtitle="Current PIN verification is required to change your recovery email."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowEmailModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleChangeRecoveryEmail}
              disabled={emailLoading || !emailCurrentPin || !newRecoveryEmail}
            >
              {emailLoading ? 'Updating…' : 'Update Email'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleChangeRecoveryEmail} className="space-y-3 pt-2">
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Current PIN</label>
            <input
              type="password"
              value={emailCurrentPin}
              onChange={e => setEmailCurrentPin(e.target.value)}
              placeholder="Enter current PIN"
              required
              className="w-full px-3 py-2 rounded-xl bg-gray-900/80 border border-gray-700/80 text-xs text-white placeholder-gray-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">New Recovery Email</label>
            <input
              type="email"
              value={newRecoveryEmail}
              onChange={e => setNewRecoveryEmail(e.target.value)}
              placeholder="new.email@example.com"
              required
              className="w-full px-3 py-2 rounded-xl bg-gray-900/80 border border-gray-700/80 text-xs text-white placeholder-gray-500 outline-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tab: Excluded Folders & Files
// ---------------------------------------------------------------------------
const ExcludedTab = ({ sessionToken, addToast }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [customPath, setCustomPath] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await securityService.getExcludedFolders(sessionToken);
      setItems(data);
    } catch (err) {
      addToast('Could not load excluded items.', 'error');
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
      addToast('Item added to exclusion list.', 'success');
      load();
    } catch (err) {
      addToast(err.message || 'Failed to add excluded item.', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleAddNativeDir = async () => {
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
      addToast('Item removed from exclusion list.', 'info');
      load();
    } catch (err) {
      addToast(err.message || 'Failed to remove exclusion.', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl bg-yellow-950/20 border border-yellow-500/20 text-xs text-yellow-300 leading-relaxed space-y-1">
        <div className="font-bold flex items-center gap-2 text-yellow-400">
          <Info className="w-4 h-4" /> Understanding Excluded Items
        </div>
        <p className="text-gray-300 text-[11px]">
          • <strong>Exclusion means:</strong> Memora will NOT scan, index, or show this file/folder in search or indexed results.<br />
          • <strong>Original file safety:</strong> The original file/folder remains intact on your computer.<br />
          • <strong>Exclusion is NOT Encryption:</strong> Excluding an item stops indexing; it does not encrypt file contents on disk.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          value={customPath}
          onChange={e => setCustomPath(e.target.value)}
          placeholder="Enter absolute file or folder path to exclude…"
          className="flex-1 px-3 py-2 rounded-xl bg-gray-900/80 border border-gray-700/80 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500/60"
        />
        {window.electronAPI?.openDirectory && (
          <Button variant="secondary" size="sm" icon={FolderPlus} onClick={handleAddNativeDir}>Browse Directory</Button>
        )}
        <Button variant="primary" size="sm" onClick={handleAdd} disabled={adding || !customPath.trim()}>
          {adding ? 'Adding…' : 'Exclude Item'}
        </Button>
      </div>

      {loading ? (
        <div className="text-xs text-gray-500 animate-pulse">Loading excluded items…</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-gray-500 text-center py-8">No files or folders excluded. All approved items are scanned.</div>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const isFolder = (item.item_type || 'folder') === 'folder';
            return (
              <div key={item.id} className="flex items-center justify-between p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {isFolder ? (
                      <FolderLock className="w-4 h-4 text-yellow-400 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-yellow-400 shrink-0" />
                    )}
                    <span className="text-xs font-mono text-gray-200 truncate">{item.path}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                      Excluded from Memora indexing
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 ml-6 mt-0.5">
                    {isFolder ? 'Folder' : 'Individual File'} • Added {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(item.id, item.path)}
                  title="Remove from exclusion list"
                  className="ml-3 p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tab: File & Folder Encryption (AES-256-GCM)
// ---------------------------------------------------------------------------
const EncryptionTab = ({ sessionToken, addToast }) => {
  const [targetPath, setTargetPath] = useState('');
  const [statusInfo, setStatusInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleCheckStatus = async () => {
    const p = targetPath.trim();
    if (!p) return;
    setLoading(true);
    try {
      const res = await securityService.getEncryptionStatus(p, sessionToken);
      setStatusInfo(res);
    } catch (err) {
      setStatusInfo(null);
      addToast(err.message || 'Failed to inspect encryption status.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEncrypt = async () => {
    const p = targetPath.trim();
    if (!p) return;
    setActionLoading(true);
    try {
      const res = await securityService.encryptItem(p, sessionToken);
      addToast(
        res.is_folder
          ? `Folder encrypted: ${res.encrypted_count} files encrypted.`
          : 'File encrypted successfully with AES-256-GCM.',
        'success'
      );
      handleCheckStatus();
    } catch (err) {
      addToast(err.message || 'Encryption failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecrypt = async () => {
    const p = targetPath.trim();
    if (!p) return;
    setActionLoading(true);
    try {
      const res = await securityService.decryptItem(p, sessionToken);
      addToast(
        res.is_folder
          ? `Folder decrypted: ${res.decrypted_count} files decrypted.`
          : 'File decrypted successfully.',
        'success'
      );
      handleCheckStatus();
    } catch (err) {
      addToast(err.message || 'Decryption failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs text-purple-300 leading-relaxed">
        <strong className="text-purple-400 font-semibold block mb-1">Local Authenticated AES-256-GCM Encryption</strong>
        Encrypting a file or folder protects its actual disk contents with a 256-bit key.
        Search index records are atomically purged so plaintext content cannot be queried while encrypted.
        Decryption requires a valid application session. Encryption keys never leave your machine.
      </div>

      <div className="space-y-3 glass-panel p-5 rounded-2xl border-gray-800/80">
        <h3 className="text-xs font-bold text-white">Select Target File or Folder</h3>
        <div className="flex gap-2">
          <input
            value={targetPath}
            onChange={e => { setTargetPath(e.target.value); setStatusInfo(null); }}
            placeholder="Absolute file or folder path to encrypt/decrypt…"
            className="flex-1 px-3 py-2 rounded-xl bg-gray-900/80 border border-gray-700/80 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500/60"
          />
          <Button variant="secondary" size="sm" onClick={handleCheckStatus} disabled={loading || !targetPath.trim()}>
            {loading ? 'Inspecting…' : 'Inspect Status'}
          </Button>
        </div>

        {statusInfo && (
          <div className="p-3.5 rounded-xl bg-gray-900/80 border border-gray-700/80 space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-300">Path:</span>
              <span className="font-mono text-gray-400 truncate">{statusInfo.path}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-300">Status:</span>
              {statusInfo.is_encrypted ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Encrypted (AES-256-GCM)
                </span>
              ) : statusInfo.partially_encrypted ? (
                <span className="text-yellow-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Partially Encrypted ({statusInfo.encrypted_files}/{statusInfo.total_files} files)
                </span>
              ) : (
                <span className="text-gray-400 font-semibold flex items-center gap-1">
                  <Unlock className="w-3.5 h-3.5" /> Plaintext (Unencrypted)
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            variant="primary"
            size="sm"
            icon={Lock}
            onClick={handleEncrypt}
            disabled={actionLoading || !targetPath.trim()}
          >
            {actionLoading ? 'Encrypting…' : '🔒 Encrypt File / Folder'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Unlock}
            onClick={handleDecrypt}
            disabled={actionLoading || !targetPath.trim()}
          >
            {actionLoading ? 'Decrypting…' : '🔓 Decrypt File / Folder'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tab: Data Management
// ---------------------------------------------------------------------------
const DataManagementTab = ({ sessionToken, folders, addToast }) => {
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState(null); // { scope, folderId, label }
  const [indexLoading, setIndexLoading] = useState(false);

  // Permanent Delete state
  const [deletePath, setDeletePath] = useState('');
  const [inspectInfo, setInspectInfo] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleRemoveIndex = async () => {
    if (!confirmRemoveIndex) return;
    setIndexLoading(true);
    try {
      const result = await securityService.removeIndexData(
        { scope: confirmRemoveIndex.scope, folderId: confirmRemoveIndex.folderId },
        sessionToken
      );
      addToast(`Removed: ${result.files_removed ?? 0} files, ${result.chunks_removed ?? 0} chunks, ${result.vector_mappings_removed ?? 0} vectors.`, 'success');
      setConfirmRemoveIndex(null);
    } catch (err) {
      addToast(err.message || 'Data removal failed.', 'error');
    } finally {
      setIndexLoading(false);
    }
  };

  const handleInspectDelete = async () => {
    const p = deletePath.trim();
    if (!p) return;
    setInspectLoading(true);
    try {
      const info = await securityService.inspectDelete(p, sessionToken);
      setInspectInfo(info);
      setShowDeleteModal(true);
    } catch (err) {
      addToast(err.message || 'Path inspection failed.', 'error');
    } finally {
      setInspectLoading(false);
    }
  };

  const handleConfirmDeletePermanently = async () => {
    if (!inspectInfo) return;
    setDeleteLoading(true);
    try {
      await securityService.deletePermanently(inspectInfo.path, true, sessionToken);
      addToast(`Permanently deleted: ${inspectInfo.name}`, 'success');
      setShowDeleteModal(false);
      setInspectInfo(null);
      setDeletePath('');
    } catch (err) {
      addToast(err.message || 'Permanent deletion failed.', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* SECTION A: REMOVE FROM MEMORA */}
      <div className="glass-panel p-5 rounded-2xl border-gray-800/80 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">A) Remove from Memora</h3>
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Removes Memora's indexed metadata, search records, and vector embeddings.
          <strong className="text-emerald-400"> Your original files remain untouched on your computer.</strong>
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-gray-900/60 border border-gray-800">
            <div>
              <h4 className="text-xs font-semibold text-gray-200">Remove All Indexed Metadata</h4>
              <p className="text-[11px] text-gray-400">Removes all File, Chunk, and Vector records from Memora's database and FAISS index. Original files untouched.</p>
            </div>
            <Button variant="danger" size="sm" icon={Database}
              onClick={() => setConfirmRemoveIndex({ scope: 'metadata', folderId: null, label: 'all indexed metadata' })}>
              Remove
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-gray-900/60 border border-gray-800">
            <div>
              <h4 className="text-xs font-semibold text-gray-200">Reset Vector Index Only</h4>
              <p className="text-[11px] text-gray-400">Clears the FAISS vector index and VectorMapping table. Chunk text and file records are preserved. Re-index to restore search.</p>
            </div>
            <Button variant="secondary" size="sm" icon={Cpu}
              onClick={() => setConfirmRemoveIndex({ scope: 'vectors', folderId: null, label: 'vector index (FAISS + mappings)' })}>
              Reset Vectors
            </Button>
          </div>

          {folders.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs text-gray-400 font-semibold">Remove indexed metadata for a specific folder:</p>
              {folders.map(f => (
                <div key={f.id} className="flex items-center justify-between p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-200 truncate">{f.name}</p>
                    <p className="text-[11px] text-gray-500 font-mono truncate">{f.path}</p>
                  </div>
                  <Button variant="danger" size="sm" icon={Trash2}
                    onClick={() => setConfirmRemoveIndex({ scope: 'metadata', folderId: f.id, label: `indexed data for "${f.name}"` })}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION B: DELETE PERMANENTLY */}
      <div className="glass-panel p-5 rounded-2xl border-red-500/30 bg-red-950/10 space-y-4">
        <div className="flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-red-400" />
          <h3 className="text-xs font-bold text-red-300 uppercase tracking-wider">B) Delete Permanently from Computer</h3>
        </div>
        <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-500/30 text-xs text-red-300 leading-relaxed font-semibold">
          WARNING: This permanently deletes the selected file or folder tree from your computer disk. This action cannot be undone.
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={deletePath}
              onChange={e => setDeletePath(e.target.value)}
              placeholder="Absolute path of file or folder to permanently delete…"
              className="flex-1 px-3 py-2 rounded-xl bg-gray-900/80 border border-red-900/60 text-xs text-white placeholder-gray-500 outline-none focus:border-red-500/80"
            />
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={handleInspectDelete}
              disabled={inspectLoading || !deletePath.trim()}
            >
              {inspectLoading ? 'Inspecting…' : 'Inspect & Delete'}
            </Button>
          </div>
        </div>
      </div>

      {/* Modal A: Confirm Remove Index */}
      <Modal
        isOpen={!!confirmRemoveIndex}
        onClose={() => setConfirmRemoveIndex(null)}
        title="Confirm Index Data Removal"
        subtitle="This removes Memora's indexed search records only — original files are safe."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmRemoveIndex(null)}>Cancel</Button>
            <Button variant="danger" size="sm" icon={Trash2} onClick={handleRemoveIndex} disabled={indexLoading}>
              {indexLoading ? 'Removing…' : 'Yes, Remove Index Data'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-300">
          You are about to remove <strong className="text-white">{confirmRemoveIndex?.label}</strong> from Memora's database.
        </p>
        <p className="text-xs text-yellow-400 mt-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
          Original user files on disk will NOT be deleted. Only Memora's indexed metadata will be removed.
        </p>
      </Modal>

      {/* Modal B: Confirm Permanent Disk Deletion */}
      <Modal
        isOpen={showDeleteModal && !!inspectInfo}
        onClose={() => setShowDeleteModal(false)}
        title="⚠️ Confirm Permanent File/Folder Deletion"
        subtitle="This action CANNOT be undone."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={handleConfirmDeletePermanently}
              disabled={deleteLoading || !inspectInfo?.can_delete}
            >
              {deleteLoading ? 'Deleting…' : 'Delete Permanently'}
            </Button>
          </>
        }
      >
        {inspectInfo && (
          <div className="space-y-4 pt-1">
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs leading-relaxed font-semibold">
              WARNING: You are about to PERMANENTLY DELETE this {inspectInfo.is_folder ? 'folder tree' : 'file'} from your computer disk!
            </div>

            <div className="space-y-2 text-xs bg-gray-900/80 p-4 rounded-xl border border-gray-800">
              <div className="flex justify-between">
                <span className="text-gray-400">Target Name:</span>
                <span className="font-semibold text-white">{inspectInfo.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Full Path:</span>
                <span className="font-mono text-gray-300 text-[11px] truncate max-w-xs">{inspectInfo.path}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Item Type:</span>
                <span className="font-semibold text-blue-400 capitalize">{inspectInfo.item_type}</span>
              </div>
              {inspectInfo.is_folder && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Child Files:</span>
                    <span className="font-semibold text-yellow-300">{inspectInfo.child_file_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Child Subfolders:</span>
                    <span className="font-semibold text-yellow-300">{inspectInfo.child_folder_count}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Total Size:</span>
                <span className="font-mono text-gray-300">{(inspectInfo.total_size_bytes / 1024).toFixed(1)} KB</span>
              </div>
            </div>

            {!inspectInfo.is_inside_approved ? (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-400 text-xs font-semibold">
                🚫 Deletion Blocked: Target path is outside approved/user-selected folders. Deletion outside approved folders is strictly prohibited.
              </div>
            ) : inspectInfo.is_protected ? (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-400 text-xs font-semibold">
                🚫 Deletion Blocked: Target path is a protected system or application directory.
              </div>
            ) : null}
          </div>
        )}
      </Modal>
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
  { id: 'overview',   label: 'Overview',                icon: ShieldCheck  },
  { id: 'lock',       label: 'Application Lock',        icon: Lock         },
  { id: 'excluded',   label: 'Excluded Folders & Files',icon: FolderLock   },
  { id: 'encryption', label: 'File & Folder Encryption',icon: Key          },
  { id: 'data',       label: 'Data Management',         icon: Database     },
  { id: 'audit',      label: 'Audit Log',               icon: ClipboardList },
  { id: 'backup',     label: 'Backup & Restore',        icon: HardDrive    },
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
        title="Security, Privacy & Data Management"
        subtitle="Application lock, excluded items, AES-256-GCM local encryption, permanent deletion, audit trail, and backups."
        badge={<Badge variant="blue">Module 5</Badge>}
      />

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

      <div className="glass-panel p-6 rounded-2xl border-gray-800/80">
        {activeTab === 'overview'   && <OverviewTab settings={settings} />}
        {activeTab === 'lock'       && <LockTab settings={settings} sessionToken={sessionToken} onRefresh={handleRefresh} addToast={addToast} />}
        {activeTab === 'excluded'   && <ExcludedTab sessionToken={sessionToken} addToast={addToast} />}
        {activeTab === 'encryption' && <EncryptionTab sessionToken={sessionToken} addToast={addToast} />}
        {activeTab === 'data'       && <DataManagementTab sessionToken={sessionToken} folders={folders} addToast={addToast} />}
        {activeTab === 'audit'      && <AuditLogTab sessionToken={sessionToken} addToast={addToast} />}
        {activeTab === 'backup'     && <BackupRestoreTab sessionToken={sessionToken} addToast={addToast} />}
      </div>
    </div>
  );
};
