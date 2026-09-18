import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Brain, 
  LayoutDashboard, 
  Search, 
  FolderSearch, 
  FolderTree, 
  Settings, 
  ShieldCheck, 
  Sparkles,
  FileText,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export const Sidebar = () => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('memora_sidebar_collapsed') === 'true';
    } catch (e) {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('memora_sidebar_collapsed', String(next));
      } catch (e) {
        console.error('Failed to save sidebar state:', e);
      }
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Search', path: '/search', icon: Search },
    { label: 'Files', path: '/folders', icon: FolderSearch },
    { label: 'Organization', path: '/organize', icon: FolderTree },
    { label: 'Media Intelligence', path: '/media', icon: Sparkles },
    { label: 'PDF Studio', path: '/pdf-studio', icon: FileText },
    { label: 'Analytics', path: '#', icon: BarChart3, disabled: true, badge: 'Coming soon' },
    { label: 'Events', path: '#', icon: Calendar, disabled: true, badge: 'Coming soon' },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside 
      className={`${
        isCollapsed ? 'w-20' : 'w-64'
      } h-screen bg-[#0b0f19] border-r border-gray-800/80 flex flex-col justify-between p-3.5 shrink-0 select-none transition-all duration-150 ease-in-out relative z-40`}
      aria-label="Main Navigation"
    >
      <div>
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 py-2 mb-4 border-b border-gray-800/60 pb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 shrink-0">
              <Brain className="w-5 h-5" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <h1 className="font-bold text-base tracking-wide text-white flex items-center gap-1.5 truncate">
                  MEMORA <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono">AI</span>
                </h1>
                <p className="text-[11px] text-gray-400 font-medium truncate">Digital Memory Assistant</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
            title={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors cursor-pointer"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path === '/search' && location.pathname === '/results');

            if (item.disabled) {
              return (
                <div
                  key={item.label}
                  title={`${item.label} (${item.badge})`}
                  className={`flex items-center ${
                    isCollapsed ? 'justify-center px-0' : 'justify-between px-3.5'
                  } py-2.5 rounded-xl text-sm font-medium text-gray-600 opacity-50 cursor-not-allowed`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0 text-gray-600" />
                    {!isCollapsed && <span>{item.label}</span>}
                  </div>
                  {!isCollapsed && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800/80 text-gray-500 font-sans">
                      {item.badge}
                    </span>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={isCollapsed ? item.label : undefined}
                className={({ isActive: isLinkActive }) => {
                  const active = isLinkActive || (item.path === '/search' && location.pathname === '/results');
                  return `flex items-center ${
                    isCollapsed ? 'justify-center px-0' : 'px-3.5'
                  } py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm shadow-blue-500/10'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                  }`;
                }}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-400'}`} />
                {!isCollapsed && <span className="ml-3 truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Status Widget */}
      <div className="space-y-2">
        {/* Privacy Badge */}
        {!isCollapsed ? (
          <div className="px-3 py-2.5 rounded-xl bg-gray-900/80 border border-gray-800/80 backdrop-blur-md">
            <div className="flex items-center gap-2 mb-0.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-semibold text-gray-200">Local & Private</span>
            </div>
            <p className="text-[10px] text-gray-400 leading-tight">
              Offline processing. Zero cloud upload.
            </p>
          </div>
        ) : (
          <div
            className="flex justify-center p-2 rounded-xl bg-gray-900/80 border border-gray-800/80 text-emerald-400"
            title="Local & Private - Offline processing"
          >
            <ShieldCheck className="w-4 h-4" />
          </div>
        )}

        {/* Search Status Indicator */}
        <div 
          className={`flex items-center ${isCollapsed ? 'justify-center px-0 py-2' : 'justify-between px-3 py-1.5'} text-xs text-gray-400 bg-gray-950/60 rounded-lg border border-gray-800/50 font-mono`}
          title="Search is ready"
        >
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            {!isCollapsed && <span>Search is ready</span>}
          </span>
          {!isCollapsed && <span className="text-[10px] text-emerald-400">Ready</span>}
        </div>
      </div>
    </aside>
  );
};

