import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { MainLayout } from './components/layout/MainLayout';

// Screen Component Imports
import { Splash } from './pages/Splash';
import { Welcome } from './pages/Welcome';
import { FolderSelection } from './pages/FolderSelection';
import { Scanning } from './pages/Scanning';
import { Dashboard } from './pages/Dashboard';
import { SemanticSearch } from './pages/SemanticSearch';
import { SearchResults } from './pages/SearchResults';
import { Organization } from './pages/Organization';
import { MediaIntelligence } from './pages/MediaIntelligence';
import { PDFStudio } from './pages/PDFStudio';
import { FileExpiry } from './pages/FileExpiry';
import { Settings } from './pages/Settings';
import { Security } from './pages/Security';
import { LockScreen } from './pages/LockScreen';

/**
 * Inner app that has access to auth state from AppContext.
 * Renders the LockScreen when lock is enabled and the session is not authenticated.
 * This is a client-side convenience guard — all sensitive API calls also
 * enforce authentication server-side via the X-Session-Token header.
 */
function AppRoutes() {
  const { lockEnabled, isAuthenticated, hasPin, securityLoading } = useApp();

  // While security settings are being loaded, show nothing (avoids flash)
  if (securityLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0b0f19]">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show lock screen when lock is enabled and no valid session
  if (!hasPin || (lockEnabled && !isAuthenticated)) {
    return <LockScreen />;
  }

  return (
    <Routes>
      {/* Onboarding & Ingestion Flow (Fullscreen Layout) */}
      <Route path="/" element={<Splash />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/folders" element={<FolderSelection />} />
      <Route path="/scan" element={<Scanning />} />

      {/* Primary App Views (Wrapped in MainLayout with Sidebar & TopNav) */}
      <Route
        path="/dashboard"
        element={
          <MainLayout>
            <Dashboard />
          </MainLayout>
        }
      />

      <Route
        path="/search"
        element={
          <MainLayout>
            <SemanticSearch />
          </MainLayout>
        }
      />

      <Route
        path="/results"
        element={
          <MainLayout>
            <SearchResults />
          </MainLayout>
        }
      />

      <Route
        path="/organize"
        element={
          <MainLayout>
            <Organization />
          </MainLayout>
        }
      />

      {/* Module 3 - Media Intelligence */}
      <Route
        path="/media"
        element={
          <MainLayout>
            <MediaIntelligence />
          </MainLayout>
        }
      />

      {/* PDF Studio */}
      <Route
        path="/pdf-studio"
        element={
          <MainLayout>
            <PDFStudio />
          </MainLayout>
        }
      />

      {/* Module 4 - File Expiry */}
      <Route
        path="/expiry"
        element={
          <MainLayout>
            <FileExpiry />
          </MainLayout>
        }
      />

      {/* Existing Settings */}
      <Route
        path="/settings"
        element={
          <MainLayout>
            <Settings />
          </MainLayout>
        }
      />

      {/* Module 5 - Security & Privacy */}
      <Route
        path="/security"
        element={
          <MainLayout>
            <Security />
          </MainLayout>
        }
      />

      {/* Fallback Redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}