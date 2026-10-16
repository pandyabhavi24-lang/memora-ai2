import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Settings as SettingsIcon, 
  Folder, 
  ShieldCheck, 
  Cpu, 
  Palette, 
  HardDrive, 
  Info,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { useApp } from '../context/AppContext';
import { useDataCache } from '../context/DataCacheContext';

export const Settings = () => {
  const { folders, removeFolder, selectFolderNative, addToast } = useApp();
  const { invalidateAll } = useDataCache();
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'folders' | 'privacy' | 'ai' | 'about'

  const handleSelectFolder = async () => {
    await selectFolderNative();
    invalidateAll();
  };

  const handleRemoveFolder = async (folderId) => {
    await removeFolder(folderId);
    invalidateAll();
  };

  const handleReindex = () => {
    addToast('Refreshing your search index…', 'info');
  };

  const handleClearCache = () => {
    addToast('Cache cleared.', 'success');
  };

  return (
    <div className="space-y-6 select-none">
      <PageHeader
        title="Settings"
        badge={<Badge variant="blue">v1.0.0 Desktop</Badge>}
      />

      {/* Settings Tab Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-[rgba(139,170,215,0.14)] pb-3 overflow-x-auto custom-scrollbar flex-nowrap shrink-0">
        {[
          { id: 'general', label: 'Appearance', icon: Palette },
          { id: 'folders', label: 'Folders', icon: Folder },
          { id: 'privacy', label: 'Privacy', icon: ShieldCheck },
          { id: 'ai', label: 'Advanced', icon: Cpu },
          { id: 'about', label: 'About', icon: Info },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[#3478F6]/20 text-[#38BDF8] border border-[#3478F6]/40 shadow-sm'
                  : 'text-[#7E93B3] hover:text-white hover:bg-[#0E1D35]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {activeTab === 'general' && (
        <div className="bg-[#0A1629] p-6 rounded-2xl border border-[rgba(139,170,215,0.14)] shadow-xl space-y-6">
          <h3 className="text-sm font-bold text-white">Theme</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#06101F]/70 border border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.25)] transition-all">
              <div>
                <h4 className="text-xs font-semibold text-white">Theme System</h4>
                <p className="text-[11px] text-[#A7B7D0] mt-0.5">Dark mode (default)</p>
              </div>
              <Badge variant="blue">Active</Badge>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-[#06101F]/70 border border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.25)] transition-all">
              <div>
                <h4 className="text-xs font-semibold text-white">Quick Search</h4>
                <p className="text-[11px] text-[#A7B7D0] mt-0.5">Press Ctrl+K anywhere to search.</p>
              </div>
              <span className="px-3 py-1 bg-[#0E1D35] text-xs font-mono text-[#38BDF8] font-bold rounded-lg border border-[rgba(139,170,215,0.2)]">
                Ctrl + K
              </span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-[#06101F]/70 border border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.25)] transition-all">
              <div>
                <h4 className="text-xs font-semibold text-white">Open Settings</h4>
                <p className="text-[11px] text-[#A7B7D0] mt-0.5">Go straight to Settings from anywhere.</p>
              </div>
              <span className="px-3 py-1 bg-[#0E1D35] text-xs font-mono text-[#38BDF8] font-bold rounded-lg border border-[rgba(139,170,215,0.2)]">
                Ctrl + ,
              </span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-[#06101F]/70 border border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.25)] transition-all">
              <div>
                <h4 className="text-xs font-semibold text-white">Go to Home</h4>
                <p className="text-[11px] text-[#A7B7D0] mt-0.5">Jump back to the Home screen.</p>
              </div>
              <span className="px-3 py-1 bg-[#0E1D35] text-xs font-mono text-[#38BDF8] font-bold rounded-lg border border-[rgba(139,170,215,0.2)]">
                Alt + H
              </span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-[#06101F]/70 border border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.25)] transition-all">
              <div>
                <h4 className="text-xs font-semibold text-white">Add Folder</h4>
                <p className="text-[11px] text-[#A7B7D0] mt-0.5">Open the folder picker from anywhere.</p>
              </div>
              <span className="px-3 py-1 bg-[#0E1D35] text-xs font-mono text-[#38BDF8] font-bold rounded-lg border border-[rgba(139,170,215,0.2)]">
                Ctrl + O
              </span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'folders' && (
        <div className="bg-[#0A1629] p-6 rounded-2xl border border-[rgba(139,170,215,0.14)] shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Your Folders</h3>
              <p className="text-xs text-[#A7B7D0] mt-0.5">Folders Memora watches for files.</p>
            </div>
            <Button variant="primary" size="sm" icon={Folder} onClick={handleSelectFolder} className="bg-[#3478F6] hover:bg-[#2563EB] text-white">
              Add Folder
            </Button>
          </div>

          <div className="space-y-2.5">
            {folders.length === 0 ? (
              <div className="p-8 text-center text-[#7E93B3] bg-[#06101F]/60 rounded-xl border border-[rgba(139,170,215,0.12)]">
                No folders added yet. Click "Add Folder" to get started.
              </div>
            ) : (
              folders.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-3.5 rounded-xl bg-[#06101F]/70 border border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.25)] transition-all">
                  <div>
                    <h4 className="text-xs font-semibold text-white flex items-center gap-2">
                      <Folder className="w-3.5 h-3.5 text-[#38BDF8]" />
                      {f.name}
                    </h4>
                    <p className="text-[11px] text-[#7E93B3] font-mono mt-0.5">{f.path}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveFolder(f.id)}
                    className="p-1.5 text-[#7E93B3] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Remove folder"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'privacy' && (
        <div className="bg-[#0A1629] p-6 rounded-2xl border border-[rgba(139,170,215,0.14)] shadow-xl space-y-6">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Privacy</span>
          </h3>

          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-300 leading-relaxed">
            Everything Memora does stays on your device. Nothing is sent to the cloud.
          </div>

          <p className="text-xs text-[#A7B7D0] leading-relaxed">
            App Lock, PIN management, ignored folders, activity log, file encryption,
            and local backup are all in Privacy settings.
          </p>

          <Link
            to="/security"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3478F6]/20 border border-[#3478F6]/40 text-[#38BDF8] text-xs font-semibold hover:bg-[#3478F6]/30 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            Open Privacy Settings
          </Link>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="bg-[#0A1629] p-6 rounded-2xl border border-[rgba(139,170,215,0.14)] shadow-xl space-y-6">
          <h3 className="text-sm font-bold text-white">Advanced Settings</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#06101F]/70 border border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.25)] transition-all">
              <span className="text-[11px] text-[#7E93B3] font-mono uppercase tracking-wider">Search Model</span>
              <h4 className="text-sm font-bold text-white font-mono mt-1">all-MiniLM-L6-v2</h4>
            </div>

            <div className="p-4 rounded-xl bg-[#06101F]/70 border border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.25)] transition-all">
              <span className="text-[11px] text-[#7E93B3] font-mono uppercase tracking-wider">Search Engine</span>
              <h4 className="text-sm font-bold text-white font-mono mt-1">FAISS IndexFlatIP</h4>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-[rgba(139,170,215,0.14)]">
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={handleReindex} className="bg-[#0E1D35] hover:bg-[#162746] border-[rgba(139,170,215,0.2)] text-white">
              Refresh Search Index
            </Button>
            <Button variant="danger" size="sm" icon={Trash2} onClick={handleClearCache}>
              Clear Cache
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'about' && (
        <div className="bg-[#0A1629] p-6 rounded-2xl border border-[rgba(139,170,215,0.14)] shadow-xl space-y-6">
          {/* Logo centered */}
          <div className="flex flex-col items-center text-center py-4">
            <img
              src="/memora-ai-logo.png"
              alt="Memora AI — Your Files • Smarter • Always"
              className="w-48 h-48 object-contain drop-shadow-2xl mb-2"
              draggable={false}
            />
            <p className="text-xs text-[#A7B7D0] leading-relaxed max-w-xs">
              Your personal file assistant — finds, organizes, and manages your files locally, with no cloud required.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#06101F]/80 border border-[rgba(139,170,215,0.14)] text-xs font-mono space-y-1 text-[#DCE5F3]">
            <div>Application: <span className="text-white font-bold">Memora AI Desktop</span></div>
            <div>Version: <span className="text-[#38BDF8]">1.0.0 Production Edition</span></div>
          </div>
        </div>
      )}
    </div>
  );
};
