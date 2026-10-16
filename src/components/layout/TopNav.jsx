import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Command, Sparkles, X } from 'lucide-react';
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

  const handleClear = () => {
    setSearchQuery('');
    inputRef.current?.focus();
  };

  return (
    <header
      className="h-14 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none backdrop-blur-md"
      style={{
        backgroundColor: 'var(--topnav-bg)',
        borderBottom: '1px solid var(--topnav-border)',
      }}
    >
      {/* Quick Search Field */}
      <form onSubmit={handleGlobalSearchSubmit} className="relative w-72 sm:w-96 max-w-full">
        <Search
          className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--text-muted)' }}
        />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search files & documents (Ctrl+K)..."
          className="w-full pl-9 pr-16 py-1.5 text-xs rounded-xl glass-input font-normal"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {searchQuery && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:opacity-80 cursor-pointer transition-opacity"
              style={{ color: 'var(--text-secondary)' }}
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <div
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono border"
            style={{
              backgroundColor: 'var(--bg-surface-secondary)',
              color: 'var(--text-muted)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <Command className="w-2.5 h-2.5" />
            <span>K</span>
          </div>
        </div>
      </form>

      {/* Global Actions */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => navigate('/scan')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer active:scale-95 shadow-sm border"
          style={{
            color: 'var(--accent-bright)',
            backgroundColor: 'rgba(52, 120, 246, 0.10)',
            borderColor: 'rgba(52, 120, 246, 0.30)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(52, 120, 246, 0.18)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(52, 120, 246, 0.10)'; }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Rescan Folders</span>
        </button>
      </div>
    </header>
  );
};
