import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FolderPlus, 
  Folder, 
  Trash2, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  HardDrive,
  Info
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';

export const FolderSelection = () => {
  const navigate = useNavigate();
  const { folders, removeFolder, selectFolderNative, completeOnboarding } = useApp();

  const handleStartScanning = () => {
    completeOnboarding();
    navigate('/scan');
  };

  const totalEstimatedFiles = folders.reduce((acc, f) => acc + f.fileCount, 0);

  return (
    <div className="min-h-screen bg-[#0b0f19] flex flex-col justify-between p-8 select-none">
      <div className="max-w-4xl mx-auto w-full my-auto">
        {/* Header */}
        <div className="mb-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-xs font-semibold text-blue-400 mb-3 border border-blue-500/20">
            <HardDrive className="w-3.5 h-3.5" />
            <span>Step 1 of 2: Folder Consent</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            Select Folders for Memora AI to Index
          </h1>
          <p className="text-sm text-gray-400">
            Memora AI scans strictly user-selected local folders. Your private data never leaves your hardware.
          </p>
        </div>

        {/* Privacy Notice Panel */}
        <div className="glass-panel p-4 rounded-xl border-blue-500/30 bg-blue-950/20 mb-6 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed text-gray-300">
            <strong className="text-white block font-semibold mb-0.5">Privacy Assurance:</strong>
            You are granting local indexing permissions for the folders below. System folders and unselected drives remain completely untouched and unindexed.
          </div>
        </div>

        {/* Folder List Card */}
        <div className="glass-panel rounded-2xl border-gray-800/80 p-6 mb-8">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800/80">
            <div>
              <h3 className="font-semibold text-sm text-white">Scanned Local Directories</h3>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                {folders.length} Folder(s) Selected • ~{totalEstimatedFiles} Total Files
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={FolderPlus}
              onClick={selectFolderNative}
            >
              Add Local Folder
            </Button>
          </div>

          {/* Folder Items */}
          {folders.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-xl">
              <Folder className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-300">No folders selected yet</p>
              <p className="text-xs text-gray-500 mb-4">Click "Add Local Folder" to select your Documents or College files.</p>
              <Button variant="primary" size="sm" icon={FolderPlus} onClick={selectFolderNative}>
                Choose Folder
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-gray-900/60 border border-gray-800/80 hover:border-gray-700/80 transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                      <Folder className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm text-gray-200 truncate">{folder.name}</h4>
                        <Badge variant="blue" size="sm">
                          ~{folder.fileCount} files
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400 font-mono truncate">{folder.path}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => removeFolder(folder.id)}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                    title="Remove folder from scan scope"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/welcome')}
            className="text-xs font-medium text-gray-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
          
          <Button
            variant="primary"
            size="lg"
            icon={ArrowRight}
            onClick={handleStartScanning}
            disabled={folders.length === 0}
          >
            Start Indexing ({folders.length} Folders)
          </Button>
        </div>
      </div>
    </div>
  );
};
