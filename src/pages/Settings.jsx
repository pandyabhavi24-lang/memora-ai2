import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Palette,
  Folder,
  FolderOpen,
  ShieldCheck,
  HardDrive,
  Info,
  Trash2,
  RefreshCw,
  ExternalLink,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { useApp } from '../context/AppContext';
import { useDataCache } from '../context/DataCacheContext';
import { useTheme } from '../context/ThemeContext';

// ── Helper sub-components ─────────────────────────────────────────────────────

const SectionHeading = ({ children }) => (
  <h3
    className="text-[11px] font-semibold uppercase tracking-wider mb-3"
    style={{ color: 'var(--text-muted)' }}
  >
    {children}
  </h3>
);

const SettingsRow = ({ label, description, right }) => (
  <div
    className="flex items-center justify-between gap-4 py-3 last:border-0"
    style={{ borderBottom: '1px solid var(--border-subtle)' }}
  >
    <div className="min-w-0">
      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {description && (
        <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>
          {description}
        </p>
      )}
    </div>
    {right && <div className="shrink-0">{right}</div>}
  </div>
);

const KbdBadge = ({ children }) => (
  <span
    className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg border"
    style={{
      backgroundColor: 'var(--bg-surface-secondary)',
      color: 'var(--accent-bright)',
      borderColor: 'var(--border-default)',
    }}
  >
    {children}
  </span>
);

// ── Theme Selector ─────────────────────────────────────────────────────────────
const THEME_OPTIONS = [
  { value: 'system', label: 'System', icon: Monitor, desc: 'Follows your Windows appearance' },
  { value: 'light',  label: 'Light',  icon: Sun,     desc: 'Clean white interface' },
  { value: 'dark',   label: 'Dark',   icon: Moon,    desc: "Memora AI's classic dark mode" },
];

const ThemeSelector = ({ preference, onSelect }) => (
  <div className="grid grid-cols-3 gap-3">
    {THEME_OPTIONS.map(({ value, label, icon: Icon, desc }) => {
      const isActive = preference === value;
      return (
        <button
          key={value}
          onClick={() => onSelect(value)}
          className="flex flex-col items-center gap-2 p-4 rounded-xl border transition-all cursor-pointer text-center"
          style={{
            backgroundColor: isActive ? 'rgba(52, 120, 246, 0.12)' : 'var(--bg-surface-secondary)',
            borderColor: isActive ? 'rgba(52, 120, 246, 0.50)' : 'var(--border-subtle)',
            boxShadow: isActive ? '0 0 0 2px rgba(52, 120, 246, 0.18)' : 'none',
          }}
          aria-pressed={isActive}
          aria-label={`Switch to ${label} theme`}
        >
          <Icon
            className="w-5 h-5"
            style={{ color: isActive ? 'var(--accent-bright)' : 'var(--text-muted)' }}
          />
          <span
            className="text-xs font-semibold"
            style={{ color: isActive ? 'var(--accent-bright)' : 'var(--text-primary)' }}
          >
            {label}
          </span>
          <span
            className="text-[10px] leading-tight"
            style={{ color: 'var(--text-muted)' }}
          >
            {desc}
          </span>
          {isActive && (
            <span className="text-[9px] font-bold text-[#3478F6] bg-[#3478F6]/15 px-2 py-0.5 rounded-full border border-[#3478F6]/30 mt-0.5">
              Active
            </span>
          )}
        </button>
      );
    })}
  </div>
);

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'appearance',  label: 'Appearance',  icon: Palette },
  { id: 'preferences', label: 'Preferences', icon: SettingsIcon },
  { id: 'folders',     label: 'Folders',     icon: Folder },
  { id: 'security',    label: 'Security',    icon: ShieldCheck },
  { id: 'storage',     label: 'Storage',     icon: HardDrive },
  { id: 'about',       label: 'About',       icon: Info },
];

// ── Main component ────────────────────────────────────────────────────────────
export const Settings = () => {
  const { folders, removeFolder, selectFolderNative, addToast } = useApp();
  const { invalidateAll } = useDataCache();
  const { preference, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('appearance');
  const [removingId, setRemovingId] = useState(null);

  const handleSelectFolder = async () => {
    await selectFolderNative();
    invalidateAll();
  };

  const handleRemoveFolder = async (folderId) => {
    setRemovingId(folderId);
    await removeFolder(folderId);
    invalidateAll();
    setRemovingId(null);
  };

  const handleRefreshIndex = () => {
    addToast('Refreshing your search index…', 'info');
  };

  const handleClearCache = () => {
    invalidateAll();
    addToast('Application cache cleared.', 'success');
  };

  const handleThemeChange = (newPref) => {
    setTheme(newPref);
    const labels = { system: 'System (auto)', light: 'Light', dark: 'Dark' };
    addToast(`Theme switched to ${labels[newPref]}.`, 'success');
  };

  return (
    <div className="space-y-5 select-none">
      <PageHeader
        title="Settings"
        subtitle="Manage your Memora AI preferences."
        badge={<Badge variant="blue">v1.0.0</Badge>}
      />

      {/* Tab bar */}
      <div
        className="flex items-center gap-1.5 pb-3 overflow-x-auto flex-nowrap shrink-0"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer border"
              style={
                isActive
                  ? {
                      backgroundColor: 'rgba(52, 120, 246, 0.15)',
                      color: 'var(--accent-bright)',
                      borderColor: 'rgba(52, 120, 246, 0.35)',
                    }
                  : {
                      backgroundColor: 'transparent',
                      color: 'var(--text-muted)',
                      borderColor: 'transparent',
                    }
              }
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--text-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface-secondary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      <div
        className="rounded-xl p-5 space-y-5"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
        }}
      >

        {/* ── APPEARANCE ── */}
        {activeTab === 'appearance' && (
          <div className="space-y-6">
            <div>
              <SectionHeading>Theme</SectionHeading>
              <ThemeSelector preference={preference} onSelect={handleThemeChange} />
              <p className="text-[11px] mt-3 leading-snug" style={{ color: 'var(--text-muted)' }}>
                Your selection is saved and restored automatically. System mode follows the Windows appearance setting.
              </p>
            </div>
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
              <SectionHeading>Keyboard Shortcuts</SectionHeading>
              <SettingsRow label="Quick Search" description="Open Semantic Search from anywhere." right={<KbdBadge>Ctrl + K</KbdBadge>} />
              <SettingsRow label="Open Settings" description="Jump directly to this Settings page." right={<KbdBadge>Ctrl + ,</KbdBadge>} />
              <SettingsRow label="Go to Home" description="Return to the Dashboard." right={<KbdBadge>Alt + H</KbdBadge>} />
              <SettingsRow label="Add Folder" description="Open the native folder picker." right={<KbdBadge>Ctrl + O</KbdBadge>} />
              <SettingsRow label="Toggle Sidebar" description="Collapse or expand the left navigation panel." right={<KbdBadge>Ctrl + B</KbdBadge>} />
            </div>
          </div>
        )}

        {/* ── PREFERENCES ── */}
        {activeTab === 'preferences' && (
          <div className="space-y-5">
            <div>
              <SectionHeading>Search Engine</SectionHeading>
              <SettingsRow
                label="Search Model"
                description="Embedding model used for semantic file search."
                right={
                  <span
                    className="px-2.5 py-1 text-xs font-mono rounded-lg border"
                    style={{
                      backgroundColor: 'var(--bg-surface-secondary)',
                      color: 'var(--accent-bright)',
                      borderColor: 'var(--border-default)',
                    }}
                  >
                    all-MiniLM-L6-v2
                  </span>
                }
              />
              <SettingsRow
                label="Search Index"
                description="Nearest-neighbour index powering semantic search."
                right={
                  <span
                    className="px-2.5 py-1 text-xs font-mono rounded-lg border"
                    style={{
                      backgroundColor: 'var(--bg-surface-secondary)',
                      color: 'var(--accent-bright)',
                      borderColor: 'var(--border-default)',
                    }}
                  >
                    FAISS IndexFlatIP
                  </span>
                }
              />
            </div>
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
              <SectionHeading>Maintenance</SectionHeading>
              <SettingsRow
                label="Refresh Search Index"
                description="Re-build the search index if results feel stale."
                right={
                  <Button variant="secondary" size="sm" icon={RefreshCw} onClick={handleRefreshIndex} className="text-xs">
                    Refresh
                  </Button>
                }
              />
              <SettingsRow
                label="Clear Application Cache"
                description="Flushes in-memory data cache. The app will reload data on next use."
                right={
                  <Button variant="danger" size="sm" icon={Trash2} onClick={handleClearCache} className="text-xs">
                    Clear
                  </Button>
                }
              />
            </div>
          </div>
        )}

        {/* ── FOLDERS ── */}
        {activeTab === 'folders' && (
          <div className="space-y-5">
            <div
              className="px-4 py-3 rounded-xl border text-xs leading-relaxed"
              style={{
                backgroundColor: 'rgba(52, 120, 246, 0.06)',
                borderColor: 'rgba(52, 120, 246, 0.22)',
                color: 'var(--accent-bright)',
              }}
            >
              Memora scans only the folders you choose. It reads file metadata and content locally to build a searchable index — nothing leaves your device.
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <SectionHeading>Watched Folders</SectionHeading>
                <button
                  onClick={handleSelectFolder}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer"
                  style={{
                    backgroundColor: 'rgba(52, 120, 246, 0.12)',
                    borderColor: 'rgba(52, 120, 246, 0.35)',
                    color: 'var(--accent-bright)',
                  }}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Add Folder
                </button>
              </div>
              {folders.length === 0 ? (
                <div
                  className="py-8 text-center text-xs rounded-xl border"
                  style={{
                    color: 'var(--text-muted)',
                    backgroundColor: 'var(--bg-surface-secondary)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  No folders added yet. Click <span style={{ color: 'var(--accent-bright)' }}>Add Folder</span> to get started.
                </div>
              ) : (
                <div className="space-y-2">
                  {folders.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border transition-all"
                      style={{
                        backgroundColor: 'var(--bg-surface-secondary)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                          <Folder className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent-bright)' }} />
                          {f.name}
                        </p>
                        <p className="text-[10px] font-mono mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{f.path}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveFolder(f.id)}
                        disabled={removingId === f.id}
                        className="p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#f87171';
                          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.10)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted)';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title={`Remove ${f.name}`}
                        aria-label={`Remove ${f.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] mt-3 leading-snug" style={{ color: 'var(--text-muted)' }}>
                Removing a folder stops Memora from scanning it. Existing indexed results may still appear until the index refreshes.
              </p>
            </div>
          </div>
        )}

        {/* ── SECURITY ── */}
        {activeTab === 'security' && (
          <div className="space-y-5">
            <div
              className="px-4 py-3 rounded-xl border text-xs leading-relaxed text-emerald-600"
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.06)',
                borderColor: 'rgba(16, 185, 129, 0.25)',
              }}
            >
              Memora is fully offline. All security features — App Lock, PIN, and session management — run entirely on your device.
            </div>
            <div>
              <SectionHeading>Managed on the Security page</SectionHeading>
              <SettingsRow label="App Lock and PIN" description="Set or change your PIN, enable App Lock, and manage session timeout." />
              <SettingsRow label="Recovery Options" description="Configure a recovery email in case you forget your PIN." />
              <SettingsRow label="Activity and Audit Log" description="Review recent security events and access history." />
            </div>
            <Link
              to="/security"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer"
              style={{
                backgroundColor: 'rgba(52, 120, 246, 0.12)',
                borderColor: 'rgba(52, 120, 246, 0.35)',
                color: 'var(--accent-bright)',
              }}
            >
              <ShieldCheck className="w-4 h-4" />
              Open Security and Privacy
              <ExternalLink className="w-3 h-3 opacity-60" />
            </Link>
          </div>
        )}

        {/* ── STORAGE ── */}
        {activeTab === 'storage' && (
          <div className="space-y-5">
            <div>
              <SectionHeading>Storage Optimization features</SectionHeading>
              <SettingsRow label="Duplicate Detection" description="Find and remove duplicate files to free up disk space." />
              <SettingsRow label="Large File Review" description="Identify files consuming the most storage." />
              <SettingsRow label="Old and Unused Files" description="Surface files that have not been accessed in a long time." />
            </div>
            <Link
              to="/storage-optimization"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer"
              style={{
                backgroundColor: 'rgba(52, 120, 246, 0.12)',
                borderColor: 'rgba(52, 120, 246, 0.35)',
                color: 'var(--accent-bright)',
              }}
            >
              <HardDrive className="w-4 h-4" />
              Open Storage Optimization
              <ExternalLink className="w-3 h-3 opacity-60" />
            </Link>
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
              <SectionHeading>Cache</SectionHeading>
              <SettingsRow
                label="Clear Application Cache"
                description="Flushes Memora's in-memory data cache. No files are deleted from disk."
                right={
                  <Button variant="danger" size="sm" icon={Trash2} onClick={handleClearCache} className="text-xs">
                    Clear Cache
                  </Button>
                }
              />
            </div>
          </div>
        )}

        {/* ── ABOUT ── */}
        {activeTab === 'about' && (
          <div className="space-y-5">
            <div className="flex flex-col items-center text-center py-3">
              <img
                src="/memora-ai-logo.png"
                alt="Memora AI"
                className="w-32 h-32 object-contain drop-shadow-xl mb-3"
                draggable={false}
              />
              <p className="text-xs leading-relaxed max-w-xs" style={{ color: 'var(--text-muted)' }}>
                Your personal file assistant — finds, organises, and manages your files locally, with no cloud required.
              </p>
            </div>
            <div
              className="rounded-xl border divide-y"
              style={{
                backgroundColor: 'var(--bg-surface-secondary)',
                borderColor: 'var(--border-subtle)',
                divideColor: 'var(--border-subtle)',
              }}
            >
              {[
                { label: 'Application', value: 'Memora AI Desktop', mono: false },
                { label: 'Version',     value: '1.0.0',             mono: true },
                { label: 'Platform',    value: 'Electron Desktop',  mono: false },
                { label: 'Data storage',value: '100% Local',        mono: false, highlight: true },
              ].map(({ label, value, mono, highlight }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span
                    className={mono ? 'text-xs font-mono' : 'text-xs font-semibold'}
                    style={{ color: highlight ? '#34d399' : 'var(--text-primary)' }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};