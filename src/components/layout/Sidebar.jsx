import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Brain, 
  LayoutDashboard, 
  Search, 
  FolderSearch, 
  RefreshCw, 
  Settings, 
  ShieldCheck, 
  Cpu
} from 'lucide-react';

export const Sidebar = () => {
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'AI Search', path: '/search', icon: Search },
    { label: 'Scanned Folders', path: '/folders', icon: FolderSearch },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 h-screen bg-[#0b0f19] border-r border-gray-800/80 flex flex-col justify-between p-4 shrink-0 select-none">
      {/* Brand Header */}
      <div>
        <div className="flex items-center gap-3 px-3 py-3 mb-6 border-b border-gray-800/60 pb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-wide text-white flex items-center gap-1.5">
              MEMORA <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono">AI</span>
            </h1>
            <p className="text-[11px] text-gray-400 font-medium">Digital Memory Assistant</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path === '/search' && location.pathname === '/results');
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm shadow-blue-500/10'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-gray-400'}`} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Status Widget */}
      <div className="space-y-3">
        {/* Privacy Badge */}
        <div className="px-3.5 py-3 rounded-xl bg-gray-900/80 border border-gray-800/80 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-gray-200">100% Local Privacy</span>
          </div>
          <p className="text-[11px] text-gray-400 leading-tight">
            Offline processing. Zero cloud upload.
          </p>
        </div>

        {/* Index Status */}
        <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-400 bg-gray-950/60 rounded-lg border border-gray-800/50 font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Local FAISS
          </span>
          <span className="text-gray-500">2.4k files</span>
        </div>
      </div>
    </aside>
  );
};
