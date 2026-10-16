import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'memora_theme';
const STYLE_TAG_ID = 'memora-light-overrides';

function resolveEffective(preference) {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(effective) {
  document.documentElement.setAttribute('data-theme', effective);
  if (effective === 'light') {
    injectLightOverrides();
  } else {
    removeLightOverrides();
  }
}

function readStoredPreference() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch (_) { /* ignore */ }
  return 'system';
}

function savePreference(preference) {
  try { localStorage.setItem(STORAGE_KEY, preference); } catch (_) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Runtime style injection for light theme
//
// Tailwind v4 with Vite 8 uses lightningcss at build time, which rejects the
// escaped bracket selectors like  .bg-\[#0A1629\]  inside CSS files.
// We inject those rules at runtime so lightningcss never sees them, yet they
// work perfectly inside Electron/Chromium where the CSS engine is modern.
//
// We use [class*="..."] substring-match attribute selectors. This matches any
// element whose class attribute contains the literal substring, e.g.
//   [class*="bg-[#0A1629]"]   ->  matches   class="glass-panel bg-[#0A1629] ..."
// ---------------------------------------------------------------------------

// Build the CSS string using a helper so it stays readable.
function buildLightOverrideCSS() {
  const SCOPE = 'html[data-theme="light"]';

  // Map each hardcoded dark color to its light equivalent.
  // Format: [ class-substring, property, value ]
  const BG = [
    ['bg-[#06101F]',  'background-color', '#F5F6F8'],
    ['bg-[#0A1629]',  'background-color', '#FFFFFF'],
    ['bg-[#0E1D35]',  'background-color', '#EEF1F5'],
    ['bg-[#132642]',  'background-color', '#E3E8F0'],
    ['bg-[#162746]',  'background-color', '#D8DFE9'],
    ['bg-[#182F50]',  'background-color', '#CFD8E6'],
    ['bg-[#1E293B]',  'background-color', '#EEF1F5'],
    ['bg-[#334155]',  'background-color', '#DDE3EC'],
    ['bg-[#71839E]',  'background-color', '#94A3B8'],
    // Opacity variants
    ['bg-[#06101F]/', 'background-color', '#F5F6F8'],
    ['bg-[#0A1629]/', 'background-color', '#FFFFFF'],
    ['bg-[#0E1D35]/', 'background-color', '#EEF1F5'],
  ];

  const TEXT = [
    // Near-white primary text -> charcoal
    ['text-[#F4F7FF]', 'color', '#1F2937'],
    ['text-[#DCE5F3]', 'color', '#1F2937'],
    ['text-[#E2E8F0]', 'color', '#4B5563'],
    ['text-[#CBD5E1]', 'color', '#4B5563'],
    // Secondary / muted
    ['text-[#A7B7D0]', 'color', '#475569'],
    ['text-[#8BAAD7]', 'color', '#475569'],
    ['text-[#7E93B3]', 'color', '#64748B'],
    ['text-[#71839E]', 'color', '#64748B'],
    // Blue accents
    ['text-[#4B91FF]', 'color', '#2563EB'],
    ['text-[#3478F6]', 'color', '#1D4ED8'],
    ['text-[#38BDF8]', 'color', '#0284C7'],
    ['text-[#60A5FA]', 'color', '#2563EB'],
    ['text-[#93C5FD]', 'color', '#3B82F6'],
    // Indigo / violet
    ['text-[#7566F6]', 'color', '#6366F1'],
    ['text-[#A78BFA]', 'color', '#7C3AED'],
    ['text-[#C4B5FD]', 'color', '#7C3AED'],
  ];

  let css = '/* === Memora AI - Light Theme Runtime Overrides === */\n\n';

  // Hardcoded hex background overrides
  for (const [substring, prop, value] of BG) {
    css += `${SCOPE} [class*="${substring}"] { ${prop}: ${value} !important; }\n`;
  }

  css += '\n';

  // Hardcoded hex text overrides
  for (const [substring, prop, value] of TEXT) {
    css += `${SCOPE} [class*="${substring}"] { ${prop}: ${value} !important; }\n`;
  }

  // Hardcoded hex border overrides
  css += '\n/* Hardcoded hex borders */\n';
  css += `${SCOPE} [class*="border-[rgba(139,170,215"] { border-color: #E1E5EC !important; }\n`;
  css += `${SCOPE} [class*="border-[rgba(117,102,246"] { border-color: rgba(99,102,241,0.35) !important; }\n`;

  // text-white: override globally to dark in light mode, but restore for coloured surfaces
  css += '\n/* text-white override */\n';
  css += `${SCOPE} .text-white { color: #1F2937 !important; }\n`;
  css += `${SCOPE} [class*="bg-[#3478F6]"] .text-white,\n`;
  css += `${SCOPE} [class*="bg-[#2563EB]"] .text-white,\n`;
  css += `${SCOPE} [class*="bg-[#4B91FF]"] .text-white,\n`;
  css += `${SCOPE} .bg-blue-600 .text-white,\n`;
  css += `${SCOPE} .bg-emerald-600 .text-white,\n`;
  css += `${SCOPE} .bg-red-600 .text-white,\n`;
  css += `${SCOPE} .bg-amber-600 .text-white,\n`;
  css += `${SCOPE} .bg-indigo-600 .text-white { color: #FFFFFF !important; }\n`;
  css += `${SCOPE} [class*="bg-[#3478F6]"].text-white,\n`;
  css += `${SCOPE} [class*="bg-[#2563EB]"].text-white,\n`;
  css += `${SCOPE} [class*="bg-[#4B91FF]"].text-white,\n`;
  css += `${SCOPE} .bg-blue-600.text-white,\n`;
  css += `${SCOPE} .bg-emerald-600.text-white,\n`;
  css += `${SCOPE} .bg-red-600.text-white,\n`;
  css += `${SCOPE} .bg-amber-600.text-white { color: #FFFFFF !important; }\n`;

  // Glass utilities
  css += '\n/* Glass / surface utilities */\n';
  css += `${SCOPE} .glass-panel { background: rgba(255,255,255,0.98) !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; border-color: #E1E5EC !important; }\n`;
  css += `${SCOPE} .glass-panel-hover:hover { background: rgba(238,241,245,0.98) !important; border-color: rgba(52,120,246,0.28) !important; box-shadow: 0 4px 12px -2px rgba(52,120,246,0.10) !important; }\n`;
  css += `${SCOPE} .surface-card { background: rgba(255,255,255,0.98) !important; border-color: #E1E5EC !important; backdrop-filter: none !important; }\n`;

  // Native form elements
  css += '\n/* Native form elements */\n';
  css += `${SCOPE} select { background-color: #FFFFFF !important; color: #1F2937 !important; border-color: #CBD3DE !important; }\n`;
  css += `${SCOPE} select option { background-color: #FFFFFF; color: #1F2937; }\n`;
  css += `${SCOPE} input:not([type="checkbox"]):not([type="radio"]):not([type="range"]) { background-color: #FFFFFF !important; color: #1F2937 !important; }\n`;
  css += `${SCOPE} input::placeholder, ${SCOPE} textarea::placeholder { color: #94A3B8 !important; }\n`;

  // ── ROOT CAUSE FIX: Tailwind semantic dark classes not caught by hex matching ──
  // These are the classes Security.jsx (and other pages) use that previously
  // rendered as near-black backgrounds / invisible text on light surfaces.

  css += '\n/* Tailwind semantic gray backgrounds -> light surfaces */\n';
  css += `${SCOPE} .bg-gray-900\\/80 { background-color: #F8FAFC !important; }\n`;
  css += `${SCOPE} .bg-gray-900\\/60 { background-color: #F8FAFC !important; }\n`;
  css += `${SCOPE} .bg-gray-900\\/50 { background-color: #F8FAFC !important; }\n`;
  css += `${SCOPE} .bg-gray-900\\/40 { background-color: #F1F5F9 !important; }\n`;
  css += `${SCOPE} .bg-gray-900 { background-color: #F8FAFC !important; }\n`;
  css += `${SCOPE} .bg-gray-800 { background-color: #EEF1F5 !important; }\n`;

  css += '\n/* Tailwind semantic dark borders -> light borders */\n';
  css += `${SCOPE} .border-gray-800 { border-color: #CBD3DE !important; }\n`;
  css += `${SCOPE} .border-gray-700\\/80 { border-color: #CBD3DE !important; }\n`;
  css += `${SCOPE} .border-gray-700 { border-color: #CBD3DE !important; }\n`;
  css += `${SCOPE} .border-red-900\\/60 { border-color: #FECACA !important; }\n`;

  css += '\n/* Semantic text grays -> readable on light surfaces */\n';
  css += `${SCOPE} .text-gray-200 { color: #1F2937 !important; }\n`;
  css += `${SCOPE} .text-gray-300 { color: #374151 !important; }\n`;
  css += `${SCOPE} .text-gray-400 { color: #4B5563 !important; }\n`;
  css += `${SCOPE} .text-gray-500 { color: #6B7280 !important; }\n`;
  css += `${SCOPE} .text-gray-600 { color: #6B7280 !important; }\n`;

  css += '\n/* Opacity-suffixed text that goes invisible on light surfaces */\n';
  css += `${SCOPE} .text-yellow-400\\/60 { color: #92400E !important; opacity: 1 !important; }\n`;
  css += `${SCOPE} .text-emerald-300\\/90 { color: #065F46 !important; opacity: 1 !important; }\n`;

  css += '\n/* Colored semantic text -> darkened for WCAG AA on light bg */\n';
  css += `${SCOPE} .text-yellow-300 { color: #92400E !important; }\n`;
  css += `${SCOPE} .text-yellow-400 { color: #B45309 !important; }\n`;
  css += `${SCOPE} .text-emerald-400 { color: #047857 !important; }\n`;
  css += `${SCOPE} .text-emerald-300 { color: #065F46 !important; }\n`;
  css += `${SCOPE} .text-red-400 { color: #B91C1C !important; }\n`;
  css += `${SCOPE} .text-red-300 { color: #9F1239 !important; }\n`;
  css += `${SCOPE} .text-blue-300 { color: #1D4ED8 !important; }\n`;
  css += `${SCOPE} .text-blue-400 { color: #1D4ED8 !important; }\n`;
  css += `${SCOPE} .text-amber-400 { color: #B45309 !important; }\n`;
  css += `${SCOPE} .text-purple-300 { color: #5B21B6 !important; }\n`;
  css += `${SCOPE} .text-purple-400 { color: #7C3AED !important; }\n`;

  css += '\n/* Colored panel backgrounds -> proper light tints */\n';
  css += `${SCOPE} .bg-emerald-950\\/20 { background-color: #ECFDF5 !important; }\n`;
  css += `${SCOPE} .bg-yellow-950\\/20 { background-color: #FFFBEB !important; }\n`;
  css += `${SCOPE} .bg-purple-950\\/20 { background-color: #F5F3FF !important; }\n`;
  css += `${SCOPE} .bg-red-950\\/10 { background-color: #FFF1F2 !important; }\n`;
  css += `${SCOPE} .bg-red-950\\/20 { background-color: #FFF1F2 !important; }\n`;
  css += `${SCOPE} .bg-red-950\\/30 { background-color: #FFE4E6 !important; }\n`;
  css += `${SCOPE} .bg-red-950\\/40 { background-color: #FFE4E6 !important; }\n`;

  css += '\n/* Colored panel borders */\n';
  css += `${SCOPE} .border-emerald-500\\/30 { border-color: #6EE7B7 !important; }\n`;
  css += `${SCOPE} .border-yellow-500\\/20 { border-color: #FDE68A !important; }\n`;
  css += `${SCOPE} .border-yellow-500\\/30 { border-color: #FCD34D !important; }\n`;
  css += `${SCOPE} .border-purple-500\\/20 { border-color: #C4B5FD !important; }\n`;
  css += `${SCOPE} .border-red-500\\/20 { border-color: #FECACA !important; }\n`;
  css += `${SCOPE} .border-red-500\\/30 { border-color: #FCA5A5 !important; }\n`;
  css += `${SCOPE} .border-red-500\\/40 { border-color: #F87171 !important; }\n`;

  css += '\n/* Status/badge chip backgrounds */\n';
  css += `${SCOPE} .bg-emerald-500\\/10 { background-color: #ECFDF5 !important; }\n`;
  css += `${SCOPE} .bg-amber-500\\/10 { background-color: #FFFBEB !important; }\n`;
  css += `${SCOPE} .bg-yellow-500\\/10 { background-color: #FFFBEB !important; }\n`;
  css += `${SCOPE} .bg-red-500\\/10 { background-color: #FFF1F2 !important; }\n`;
  css += `${SCOPE} .bg-red-500\\/20 { background-color: #FFE4E6 !important; }\n`;
  css += `${SCOPE} .bg-blue-400\\/10 { background-color: #EFF6FF !important; }\n`;
  css += `${SCOPE} .bg-purple-500\\/10 { background-color: #F5F3FF !important; }\n`;

  css += '\n/* Toggle switch off-state track */\n';
  css += `${SCOPE} .bg-gray-700 { background-color: #CBD5E1 !important; }\n`;

  css += '\n/* Hover states */\n';
  css += `${SCOPE} .hover\\:bg-red-500\\/10:hover { background-color: #FFF1F2 !important; }\n`;
  css += `${SCOPE} .hover\\:text-red-400:hover { color: #B91C1C !important; }\n`;
  css += `${SCOPE} .hover\\:text-gray-300:hover { color: #374151 !important; }\n`;
  css += `${SCOPE} .hover\\:text-white:hover { color: #1F2937 !important; }\n`;

  return css;
}

function injectLightOverrides() {
  let tag = document.getElementById(STYLE_TAG_ID);
  if (!tag) {
    tag = document.createElement('style');
    tag.id = STYLE_TAG_ID;
    // Insert before the first existing style/link so we don't outrank Tailwind
    const firstLink = document.head.querySelector('link[rel="stylesheet"], style');
    if (firstLink) {
      document.head.insertBefore(tag, firstLink);
    } else {
      document.head.appendChild(tag);
    }
  }
  // Always update content in case it was cleared
  tag.textContent = buildLightOverrideCSS();
}

function removeLightOverrides() {
  const tag = document.getElementById(STYLE_TAG_ID);
  if (tag) tag.remove();
}

// -- Context ------------------------------------------------------------------

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [preference, setPreference] = useState(() => {
    const stored = readStoredPreference();
    // Apply immediately -- before React's first paint -- to avoid FOUC
    applyTheme(resolveEffective(stored));
    return stored;
  });

  // When system preference changes AND user is on 'system', re-apply
  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => applyTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [preference]);

  const setTheme = useCallback((newPreference) => {
    if (newPreference !== 'light' && newPreference !== 'dark' && newPreference !== 'system') return;
    savePreference(newPreference);
    setPreference(newPreference);
    applyTheme(resolveEffective(newPreference));
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
