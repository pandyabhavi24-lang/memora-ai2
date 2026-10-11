import React from 'react';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { ToastContainer } from '../common/Toast';
import { FilePreviewModal } from '../../pages/FilePreview';
import { useApp } from '../../context/AppContext';

export const MainLayout = ({ children }) => {
  const { previewFile, setPreviewFile } = useApp();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#06101F] text-[#F4F7FF]">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <TopNav />

        <main className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar bg-[#06101F]">
          <div className="w-full max-w-[1400px] mx-auto px-1 sm:px-2">
            {children}
          </div>
        </main>
      </div>

      {/* File Preview Modal Overlay */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
};
