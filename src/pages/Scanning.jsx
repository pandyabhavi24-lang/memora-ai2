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
import { useDataCache } from '../context/DataCacheContext';

export const Scanning = () => {
  const navigate = useNavigate();
  const { invalidateAll } = useDataCache();
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
        invalidateAll();
        setTimeout(() => {
          navigate('/dashboard');
        }, 1200);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [navigate, invalidateAll]);

  return (
    <div className="min-h-screen bg-[#06101F] flex flex-col justify-between p-8 select-none">
      <div className="max-w-2xl mx-auto w-full my-auto text-center">
        {/* Animated Badge Header */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#3478F6]/10 border border-[#3478F6]/25 text-xs font-semibold text-[#38BDF8] mb-6">
          <Sparkles className="w-4 h-4 animate-spin text-[#38BDF8]" />
          <span>Local Document Indexer Active</span>
        </div>

        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
          {scanState.percent >= 100 ? 'Indexing Complete!' : 'Building Your Local Document Index'}
        </h1>
        <p className="text-sm text-[#A7B7D0] mb-8">
          Extracting content, processing documents, and generating semantic vector embeddings.
        </p>

        {/* Large Progress Card */}
        <div className="bg-[#0A1629] p-8 rounded-3xl border border-[rgba(139,170,215,0.14)] mb-8 relative overflow-hidden shadow-2xl">
          {/* Circular / Large Percent Display */}
          <div className="text-5xl font-black text-white tracking-tight mb-4 font-mono">
            {scanState.percent}%
          </div>

          <ProgressBar
            progress={scanState.percent}
            className="mb-6"
          />

          {/* Current File Activity */}
          <div className="p-3.5 rounded-xl bg-[#06101F]/80 border border-[rgba(139,170,215,0.14)] text-xs font-mono text-[#DCE5F3] truncate flex items-center justify-between mb-6">
            <span className="text-[#7E93B3] shrink-0 mr-2">Processing:</span>
            <span className="truncate text-[#38BDF8]">{scanState.currentFile || 'Indexing...'}</span>
          </div>

          {/* Detailed Statistics Grid */}
          <div className="grid grid-cols-3 gap-3 text-left">
            <div className="p-3.5 rounded-xl bg-[#06101F]/70 border border-[rgba(139,170,215,0.12)]">
              <div className="flex items-center gap-1.5 text-xs text-[#7E93B3] mb-1 font-mono uppercase">
                <FileText className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>Files</span>
              </div>
              <div className="text-base font-bold text-white font-mono">
                {scanState.processedFiles} / {scanState.totalFiles}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#06101F]/70 border border-[rgba(139,170,215,0.12)]">
              <div className="flex items-center gap-1.5 text-xs text-[#7E93B3] mb-1 font-mono uppercase">
                <Eye className="w-3.5 h-3.5 text-purple-400" />
                <span>OCR</span>
              </div>
              <div className="text-base font-bold text-white font-mono">
                {scanState.ocrProcessed} Files
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#06101F]/70 border border-[rgba(139,170,215,0.12)]">
              <div className="flex items-center gap-1.5 text-xs text-[#7E93B3] mb-1 font-mono uppercase">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>FAISS</span>
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
            className="bg-[#3478F6] hover:bg-[#2563EB] text-white font-semibold shadow-lg shadow-blue-900/40"
          >
            Go to Dashboard
          </Button>
        ) : (
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs font-medium text-[#A7B7D0] hover:text-white transition-colors cursor-pointer"
          >
            Run indexing in background &rarr;
          </button>
        )}
      </div>
    </div>
  );
};
