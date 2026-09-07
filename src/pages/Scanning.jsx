import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  FileText, 
  Eye, 
  Cpu, 
  ArrowRight
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { ProgressBar } from '../components/common/ProgressBar';
import { Button } from '../components/common/Button';

export const Scanning = () => {
  const navigate = useNavigate();
  const [scanState, setScanState] = useState({
    totalFiles: 0,
    processedFiles: 0,
    percent: 0,
    currentFile: 'Initializing scanner...',
    ocrProcessed: 0,
    vectorsIndexed: 0,
    status: 'scanning'
  });

  useEffect(() => {
    let isMounted = true;

    apiService.startScanProgress((update) => {
      if (isMounted) {
        setScanState(update);
      }
    }).then(() => {
      if (isMounted) {
        setTimeout(() => {
          navigate('/dashboard');
        }, 1200);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#0b0f19] flex flex-col justify-between p-8 select-none">
      <div className="max-w-2xl mx-auto w-full my-auto text-center">
        {/* Animated Badge Header */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400 mb-6">
          <Sparkles className="w-4 h-4 animate-spin text-blue-400" />
          <span>Local Memory Indexer Active</span>
        </div>

        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
          {scanState.percent >= 100 ? 'Indexing Complete!' : 'Building Your Local Memory Index'}
        </h1>
        <p className="text-sm text-gray-400 mb-8">
          Extracting content, running local OCR, and generating semantic embeddings.
        </p>

        {/* Large Progress Card */}
        <div className="glass-panel p-8 rounded-3xl border-gray-800/80 mb-8 relative overflow-hidden">
          {/* Circular / Large Percent Display */}
          <div className="text-5xl font-black text-white tracking-tight mb-4 font-mono">
            {scanState.percent}%
          </div>

          <ProgressBar
            progress={scanState.percent}
            className="mb-6"
          />

          {/* Current File Activity */}
          <div className="p-3.5 rounded-xl bg-gray-900/80 border border-gray-800 text-xs font-mono text-gray-300 truncate flex items-center justify-between mb-6">
            <span className="text-gray-500 shrink-0 mr-2">Processing:</span>
            <span className="truncate text-blue-400">{scanState.currentFile || 'Indexing...'}</span>
          </div>

          {/* Detailed Statistics Grid */}
          <div className="grid grid-cols-3 gap-3 text-left">
            <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>Files Scanned</span>
              </div>
              <div className="text-base font-bold text-white font-mono">
                {scanState.processedFiles} / {scanState.totalFiles}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                <Eye className="w-3.5 h-3.5 text-purple-400" />
                <span>Local OCR</span>
              </div>
              <div className="text-base font-bold text-white font-mono">
                {scanState.ocrProcessed} Files
              </div>
            </div>

            <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>Vector Index</span>
              </div>
              <div className="text-base font-bold text-white font-mono">
                {scanState.vectorsIndexed} Vectors
              </div>
            </div>
          </div>
        </div>

        {/* Skip / Continue Button */}
        {scanState.percent >= 100 ? (
          <Button
            variant="primary"
            size="lg"
            icon={ArrowRight}
            onClick={() => navigate('/dashboard')}
          >
            Go to Dashboard
          </Button>
        ) : (
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs font-medium text-gray-400 hover:text-white transition-colors"
          >
            Run indexing in background &rarr;
          </button>
        )}
      </div>
    </div>
  );
};
