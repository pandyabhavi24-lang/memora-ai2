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
//   [class*="bg-[#0A1629]"]   →  matches   class="glass-panel bg-[#0A1629] ..."
// ---------------------------------------------------------------------------

// Build the CSS string using a helper so it stays readable.
function buildLightOverrideCSS() {
  const SCOPE = 'html[data-theme="light"]';

  // Map each hardcoded dark color to its light equivalent.
  // Format: [ class-substring, property, value ]
  const BG = [
    ['bg-[#06101F]',  'background-color', '#F8FAFC'],
    ['bg-[#0A1629]',  'background-color', '#FFFFFF'],
    ['bg-[#0E1D35]',  'background-color', '#F1F5F9'],
    ['bg-[#132642]',  'background-color', '#E8EFF9'],
    ['bg-[#162746]',  'background-color', '#E2EAF6'],
    ['bg-[#182F50]',  'background-color', '#DCE8F8'],
    ['bg-[#1E293B]',  'background-color', '#F1F5F9'],
    ['bg-[#334155]',  'background-color', '#E2E8F0'],
    ['bg-[#71839E]',  'background-color', '#94A3B8'],
    // Opacity variants — use substring on the hex only
    ['bg-[#06101F]/', 'background-color', '#F8FAFC'],
    ['bg-[#0A1629]/', 'background-color', '#FFFFFF'],
    ['bg-[#0E1D35]/', 'background-color', '#F1F5F9'],
  ];

  const TEXT = [
    // Near-white primary text → charcoal
    ['text-[#F4F7FF]', 'color', '#111827'],
    ['text-[#DCE5F3]', 'color', '#1F2937'],
    ['text-[#E2E8F0]', 'color', '#374151'],
    ['text-[#CBD5E1]', 'color', '#374151'],
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

  let css = `/* === Memora AI — Light Theme Runtime Overrides === */\n\n`;

  // Backgrounds
  for (const [substring, prop, value] of BG) {
    css += `${SCOPE} [class*="${substring}"] { ${prop}: ${value} !important; }\n`;
  }

  css += '\n';

  // Text colors
  for (const [substring, prop, value] of TEXT) {
    css += `${SCOPE} [class*="${substring}"] { ${prop}: ${value} !important; }\n`;
  }

  // All rgba(139,170,215,x) borders → light border gray
  css += `\n/* Borders */\n`;
  css += `${SCOPE} [class*="border-[rgba(139,170,215"] { border-color: #E2E8F0 !important; }\n`;
  css += `${SCOPE} [class*="border-[rgba(117,102,246"] { border-color: rgba(99,102,241,0.35) !important; }\n`;

  // text-white: override globally to dark in light mode, but restore for coloured surfaces
  css += `\n/* text-white override */\n`;
  css += `${SCOPE} .text-white { color: #111827 !important; }\n`;
  // Restore white text on intentionally coloured buttons / badges / chips
  css += `${SCOPE} [class*="bg-[#3478F6]"] .text-white,\n`;
  css += `${SCOPE} [class*="bg-[#2563EB]"] .text-white,\n`;
  css += `${SCOPE} [class*="bg-[#4B91FF]"] .text-white,\n`;
  css += `${SCOPE} .bg-blue-600 .text-white,\n`;
  css += `${SCOPE} .bg-emerald-600 .text-white,\n`;
  css += `${SCOPE} .bg-red-600 .text-white,\n`;
  css += `${SCOPE} .bg-amber-600 .text-white,\n`;
  css += `${SCOPE} .bg-indigo-600 .text-white { color: #FFFFFF !important; }\n`;
  // Restore white on elements that ARE the coloured button (self-contained)
  css += `${SCOPE} [class*="bg-[#3478F6]"].text-white,\n`;
  css += `${SCOPE} [class*="bg-[#2563EB]"].text-white,\n`;
  css += `${SCOPE} [class*="bg-[#4B91FF]"].text-white,\n`;
  css += `${SCOPE} .bg-blue-600.text-white,\n`;
  css += `${SCOPE} .bg-emerald-600.text-white,\n`;
  css += `${SCOPE} .bg-red-600.text-white,\n`;
  css += `${SCOPE} .bg-amber-600.text-white { color: #FFFFFF !important; }\n`;

  // Glass utilities
  css += `
/* Glass / surface utilities */
${SCOPE} .glass-panel {
  background: rgba(255,255,255,0.98) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border-color: #E2E8F0 !important;
}
${SCOPE} .glass-panel-hover:hover {
  background: rgba(241,245,249,0.98) !important;
  border-color: rgba(52,120,246,0.28) !important;
  box-shadow: 0 4px 12px -2px rgba(52,120,246,0.10) !important;
}
${SCOPE} .surface-card {
  background: rgba(255,255,255,0.98) !important;
  border-color: #E2E8F0 !important;
  backdrop-filter: none !important;
}

/* Native form elements */
${SCOPE} select { background-color: #FFFFFF !important; color: #111827 !important; border-color: #CBD5E1 !important; }
${SCOPE} select option { background-color: #FFFFFF; color: #111827; }
${SCOPE} input:not([type="checkbox"]):not([type="radio"]):not([type="range"]) { background-color: #FFFFFF !important; color: #111827 !important; }
${SCOPE} input::placeholder, ${SCOPE} textarea::placeholder { color: #94A3B8 !important; }
`;

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

// ── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [preference, setPreference] = useState(() => {
    const stored = readStoredPreference();
    // Apply immediately — before React's first paint — to avoid FOUC
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
