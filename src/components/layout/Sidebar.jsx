import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
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
  HardDrive,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export const Sidebar = () => {
  const location = useLocation();
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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navSections = [
    {
      title: "Core",
      items: [
        { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
        { label: "Search", path: "/search", icon: Search },
        { label: "Files", path: "/folders", icon: FolderSearch },
      ],
    },
    {
      title: "Intelligence & Tools",
      items: [
        { label: "Organization", path: "/organize", icon: FolderTree },
        { label: "Media Intelligence", path: "/media", icon: Sparkles },
        { label: "PDF Studio", path: "/pdf-studio", icon: FileText },
        { label: "Storage Optimization", path: "/storage-optimization", icon: HardDrive },
        { label: "Expiry & Reminders", path: "/expiry", icon: CalendarClock },
      ],
    },
    {
      title: "System",
      items: [
        { label: "Security & Privacy", path: "/security", icon: ShieldCheck },
        { label: "Settings", path: "/settings", icon: Settings },
      ],
    },
  ];

  return (
    <aside
      className={`${
        isCollapsed ? "w-[72px]" : "w-64"
      } h-screen bg-[#0A1629] border-r border-[rgba(139,170,215,0.14)] flex flex-col justify-between p-3 shrink-0 select-none transition-all duration-200 ease-in-out relative z-40`}
      aria-label="Main Navigation"
    >
      <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-1.5 py-1.5 mb-3 border-b border-[rgba(139,170,215,0.14)] pb-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#3478F6] to-[#7566F6] flex items-center justify-center text-white shadow-md shadow-[#3478F6]/25 shrink-0 border border-[#4B91FF]/30">
              <Brain className="w-5 h-5" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-wide text-[#F4F7FF]">MEMORA</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#3478F6]/20 text-[#4B91FF] font-mono font-semibold">
                    AI
                  </span>
                </div>
                <p className="text-[10px] text-[#A7B7D0] font-medium truncate">
                  Digital Memory Assistant
                </p>
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
            className="p-1 rounded-lg text-[#A7B7D0] hover:text-[#F4F7FF] hover:bg-[#0E1D35] transition-colors cursor-pointer"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-0.5">
          {navSections.map((section, idx) => (
            <div key={section.title || idx} className="space-y-1">
              {!isCollapsed ? (
                <div className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold text-[#71839E] font-mono">
                  {section.title}
                </div>
              ) : (
                idx > 0 && <div className="my-1.5 border-t border-[rgba(139,170,215,0.12)] mx-2" />
              )}

              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.path ||
                  (item.path === "/search" && location.pathname === "/results");

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive: isLinkActive }) => {
                      const active =
                        isLinkActive ||
                        (item.path === "/search" &&
                          location.pathname === "/results");
                      return `group flex items-center ${
                        isCollapsed ? "justify-center px-0 py-2.5" : "px-2.5 py-2"
                      } rounded-xl text-xs font-medium transition-all duration-150 relative ${
                        active
                          ? "bg-[#3478F6]/15 text-[#4B91FF] border border-[#3478F6]/30 shadow-xs font-semibold"
                          : "text-[#A7B7D0] hover:text-[#F4F7FF] hover:bg-[#0E1D35] border border-transparent"
                      }`;
                    }}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? "text-[#4B91FF]" : "text-[#71839E] group-hover:text-[#F4F7FF]"
                      }`}
                    />
                    {!isCollapsed && (
                      <span className="ml-2.5 truncate">{item.label}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Status Widget */}
      <div className="pt-3 border-t border-[rgba(139,170,215,0.14)] space-y-2 shrink-0">
        {!isCollapsed ? (
          <div className="px-2.5 py-2 rounded-xl bg-[#0E1D35] border border-[rgba(139,170,215,0.14)]">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11px] font-semibold text-[#F4F7FF]">
                  Private & Local
                </span>
              </div>
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                100% Offline
              </span>
            </div>
            <p className="text-[10px] text-[#A7B7D0] leading-tight">
              Hardware-only index. No cloud sync.
            </p>
          </div>
        ) : (
          <div
            className="flex justify-center p-2 rounded-xl bg-[#0E1D35] border border-[rgba(139,170,215,0.14)] text-emerald-400"
            title="Local & Private - 100% Offline"
          >
            <ShieldCheck className="w-4 h-4" />
          </div>
        )}

        <div
          className={`flex items-center ${
            isCollapsed ? "justify-center px-0 py-1.5" : "justify-between px-2.5 py-1.5"
          } text-[11px] text-[#A7B7D0] bg-[#06101F] rounded-lg border border-[rgba(139,170,215,0.14)] font-mono`}
          title="Search vector engine is online"
        >
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            {!isCollapsed && <span>Engine Ready</span>}
          </span>
          {!isCollapsed && (
            <span className="text-[10px] text-emerald-400 font-semibold">Active</span>
          )}
        </div>
      </div>
    </aside>
  );
};
