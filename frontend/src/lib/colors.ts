// ─── MetryxOne Brand Color System ───
// Single source of truth. Import from here — never hardcode hex values.

export const colors = {
  // Brand
  primary: '#344E86',        // Deep blue — buttons, headers, nav
  primaryDark: '#0B3C5D',    // Navy — dark cards, plan highlights
  accent: '#4ECDC4',         // Cyan/teal — links, CTAs, highlights

  // Status
  success: '#4ECDC4',        // Teal — correct, selected, progress
  warning: '#F59E0B',        // Amber — flags, caution
  danger: '#DC2626',         // Red — errors, critical, destructive

  // Exam-ready dark theme
  darkBg: '#0B1D2E',         // Deep navy background
  darkBgAlt: '#0a1628',      // Slightly darker variant
  darkCard: '#0f2641',       // Card on dark background
  darkBorder: '#1a3a5c',     // Border on dark background

  // Text
  textDark: '#2E3440',       // Primary text (light mode)
  textMuted: '#9AA4B2',      // Muted/secondary text

  // Backgrounds
  bgLight: '#F7F9FC',        // Light page background
  bgWhite: '#FFFFFF',        // White

  // Borders
  borderLight: '#E2E8F0',    // Light border
} as const;

// Tailwind class helpers (for bg-[...], text-[...], border-[...])
export const tw = {
  primary: `[#344E86]`,
  primaryDark: `[#0B3C5D]`,
  accent: `[#4ECDC4]`,
  success: `[#4ECDC4]`,
  warning: `[#F59E0B]`,
  danger: `[#DC2626]`,
  darkBg: `[#0B1D2E]`,
  darkCard: `[#0f2641]`,
  darkBorder: `[#1a3a5c]`,
} as const;
