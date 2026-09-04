import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Command, Bell, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const TopNav = () => {
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery } = useApp();
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleGlobalSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate('/results');
    }
  };

  return (
    <header className="h-16 border-b border-gray-800/80 bg-[#0b0f19]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Quick Search Trigger */}
      <form onSubmit={handleGlobalSearchSubmit} className="relative w-72 sm:w-96">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search memories (e.g. 'internship resume')..."
          className="w-full pl-10 pr-12 py-2 text-xs rounded-xl glass-input placeholder-gray-500 text-white font-medium"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-800/80 text-[10px] text-gray-400 border border-gray-700/60 font-mono">
          <Command className="w-3 h-3" />
          <span>K</span>
        </div>
      </form>

      {/* Action Shortcuts */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/scan')}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Rescan Folders</span>
        </button>

        <div className="w-px h-5 bg-gray-800" />

        <button className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800/60 transition-colors relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500"></span>
        </button>
      </div>
    </header>
  );
};
