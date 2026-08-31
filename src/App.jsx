import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { MainLayout } from './components/layout/MainLayout';

// Screen Component Imports
import { Splash } from './pages/Splash';
import { Welcome } from './pages/Welcome';
import { FolderSelection } from './pages/FolderSelection';
import { Scanning } from './pages/Scanning';
import { Dashboard } from './pages/Dashboard';
import { SemanticSearch } from './pages/SemanticSearch';
import { SearchResults } from './pages/SearchResults';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
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
            path="/settings"
            element={
              <MainLayout>
                <Settings />
              </MainLayout>
            }
          />

          {/* Fallback Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
