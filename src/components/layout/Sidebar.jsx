import React, { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Search,
  FolderTree,
  ShieldCheck,
  Sparkles,
  FileText,
  HardDrive,
  CalendarClock,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useApp } from "../../context/AppContext";

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectFolderNative } = useApp();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem("memora_sidebar_collapsed") === "true";
    } catch (e) {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("memora_sidebar_collapsed", String(next));
      } catch (e) {
        console.error("Failed to save sidebar state:", e);
      }
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isEditing =
        tag === "input" ||
        tag === "textarea" ||
        document.activeElement?.isContentEditable;

      // Ctrl+B — toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      if (isEditing) return;

      // Ctrl+K — open Search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        navigate("/search");
        return;
      }

      // Ctrl+, — open Settings
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        navigate("/settings");
        return;
      }

      // Alt+H — go to Home / Dashboard
      if (e.altKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        navigate("/dashboard");
        return;
      }

      // Ctrl+O — Add Folder
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        selectFolderNative();
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, selectFolderNative]);

  // Flat nav — 9 items
  const navItems = [
    { label: "Home",                 path: "/dashboard",            icon: LayoutDashboard },
    { label: "Search",               path: "/search",               icon: Search },
    { label: "Organization",         path: "/organize",             icon: FolderTree },
    { label: "Media Intelligence",   path: "/media",                icon: Sparkles,      dividerBefore: true },
    { label: "Expiry & Reminders",   path: "/expiry",               icon: CalendarClock },
    { label: "Security & Privacy",   path: "/security",             icon: ShieldCheck },
    { label: "PDF Studio",           path: "/pdf-studio",           icon: FileText },
    { label: "Storage Optimization", path: "/storage-optimization", icon: HardDrive },
    { label: "Settings",             path: "/settings",             icon: Settings,      dividerBefore: true },
  ];

  return (
    <aside
      className={`${
        isCollapsed ? "w-[72px]" : "w-64"
      } h-screen flex flex-col justify-between p-3 shrink-0 select-none transition-all duration-200 ease-in-out relative z-40`}
      style={{
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
      }}
      aria-label="Main Navigation"
    >
      <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
        {/* Brand Header */}
        <div
          className="flex items-center justify-between px-1.5 py-1.5 mb-3 pb-3 shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isCollapsed ? (
              <div
                className="w-9 h-9 rounded-xl overflow-hidden shrink-0 shadow-md"
                style={{
                  border: '1px solid var(--border-subtle)',
                  boxShadow: '0 4px 12px rgba(52, 120, 246, 0.20)',
                }}
                title="Memora AI"
              >
                <img
                  src="/memora-ai-logo.png"
                  alt="Memora AI"
                  className="w-full object-cover"
                  style={{ objectPosition: 'center 18%', height: '180%' }}
                  draggable={false}
                />
              </div>
            ) : (
              <div className="h-12 w-auto flex items-center shrink-0">
                <img
                  src="/memora-ai-logo.png"
                  alt="Memora AI — Your Files • Smarter • Always"
                  className="h-12 w-auto object-contain"
                  draggable={false}
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={
              isCollapsed
                ? "Expand sidebar (Ctrl+B)"
                : "Collapse sidebar (Ctrl+B)"
            }
            title={
              isCollapsed
                ? "Expand sidebar (Ctrl+B)"
                : "Collapse sidebar (Ctrl+B)"
            }
            className="p-1 rounded-lg transition-colors cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--bg-surface-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation — flat list */}
        <div className="flex-1 overflow-y-auto space-y-0.5 custom-scrollbar pr-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              (item.path === "/search" && location.pathname === "/results");

            return (
              <React.Fragment key={item.path}>
                {item.dividerBefore && (
                  <div
                    className="my-2 mx-1"
                    style={{ borderTop: '1px solid var(--border-subtle)' }}
                  />
                )}
                <NavLink
                  to={item.path}
                  title={isCollapsed ? item.label : undefined}
                  style={({ isActive: isLinkActive }) => {
                    const active =
                      isLinkActive ||
                      (item.path === "/search" && location.pathname === "/results");
                    if (active) {
                      return {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isCollapsed ? 'center' : undefined,
                        padding: isCollapsed ? '10px 0' : '8px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        transition: 'all 150ms',
                        position: 'relative',
                        color: 'var(--accent-bright)',
                        backgroundColor: 'var(--bg-sidebar-item-active)',
                        border: '1px solid rgba(52, 120, 246, 0.30)',
                      };
                    }
                    return {
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isCollapsed ? 'center' : undefined,
                      padding: isCollapsed ? '10px 0' : '8px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      transition: 'all 150ms',
                      position: 'relative',
                      color: 'var(--text-muted)',
                      backgroundColor: 'transparent',
                      border: '1px solid transparent',
                    };
                  }}
                  onMouseEnter={(e) => {
                    const active =
                      location.pathname === item.path ||
                      (item.path === "/search" && location.pathname === "/results");
                    if (!active) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-sidebar-item-hover)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    const active =
                      location.pathname === item.path ||
                      (item.path === "/search" && location.pathname === "/results");
                    if (!active) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }
                  }}
                >
                  <Icon className="w-4 h-4 shrink-0 transition-colors" />
                  {!isCollapsed && (
                    <span className="ml-2.5 truncate">{item.label}</span>
                  )}
                </NavLink>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Footer Status Widget */}
      <div
        className="pt-3 space-y-2 shrink-0"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        {!isCollapsed ? (
          <div
            className="px-2.5 py-2 rounded-xl"
            style={{
              backgroundColor: 'var(--bg-surface-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Private & Local
                </span>
              </div>
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                100% Offline
              </span>
            </div>
            <p className="text-[10px] leading-tight" style={{ color: 'var(--text-muted)' }}>
              Your data stays on your device.
            </p>
          </div>
        ) : (
          <div
            className="flex justify-center p-2 rounded-xl text-emerald-400"
            style={{
              backgroundColor: 'var(--bg-surface-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
            title="Private & Local"
          >
            <ShieldCheck className="w-4 h-4" />
          </div>
        )}

        <div
          className={`flex items-center ${
            isCollapsed ? "justify-center px-0 py-1.5" : "justify-between px-2.5 py-1.5"
          } text-[11px] rounded-lg font-mono`}
          style={{
            color: 'var(--text-muted)',
            backgroundColor: 'var(--bg-page)',
            border: '1px solid var(--border-subtle)',
          }}
          title="Memora is ready"
        >
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            {!isCollapsed && <span>Ready</span>}
          </span>
          {!isCollapsed && (
            <span className="text-[10px] text-emerald-400 font-semibold">✓</span>
          )}
        </div>
      </div>
    </aside>
  );
};
