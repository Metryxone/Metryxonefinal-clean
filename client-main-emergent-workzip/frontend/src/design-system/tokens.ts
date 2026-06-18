export const COLOR = {
  primary:   '#344E86',
  accent:    '#4ECDC4',
  green:     '#2A9D8F',
  red:       '#e63946',
  orange:    '#f4a261',
  purple:    '#8b5cf6',
  sky:       '#0ea5e9',
  pink:      '#ec4899',
  slate:     '#94a3b8',
  darkGreen: '#16a34a',
} as const;

export const TYPOGRAPHY = {
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  sizes: {
    xs:  '10px',
    sm:  '12px',
    base:'14px',
    md:  '16px',
    lg:  '18px',
    xl:  '20px',
    '2xl':'24px',
    '3xl':'30px',
  },
  weights: {
    normal:    '400',
    medium:    '500',
    semibold:  '600',
    bold:      '700',
  },
} as const;

export const SPACING = {
  0:  '0',
  1:  '4px',
  2:  '8px',
  3:  '12px',
  4:  '16px',
  5:  '20px',
  6:  '24px',
  8:  '32px',
  10: '40px',
  12: '48px',
  16: '64px',
} as const;

export const RADIUS = {
  sm:   '6px',
  md:   '8px',
  lg:   '12px',
  xl:   '16px',
  '2xl':'20px',
  full: '9999px',
} as const;

export const SHADOW = {
  none: 'none',
  sm:   '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md:   '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg:   '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
} as const;

export const BREAKPOINTS = {
  sm:  '640px',
  md:  '768px',
  lg:  '1024px',
  xl:  '1280px',
  '2xl':'1400px',
} as const;

export const ANIMATION = {
  fast:   '150ms ease',
  base:   '300ms ease',
  slow:   '700ms ease',
  spring: '1.2s ease',
} as const;

export const CHART = {
  colors: [
    COLOR.primary, COLOR.accent, COLOR.green,
    COLOR.orange,  COLOR.purple, COLOR.sky, COLOR.pink,
  ],
  gridColor:    '#f1f5f9',
  axisColor:    '#94a3b8',
  labelColor:   '#64748b',
  tooltipBg:    '#1e293b',
  tooltipText:  '#f8fafc',
} as const;

export const EI_BANDS = [
  { min: 80, label: 'Excellent', color: COLOR.green  },
  { min: 65, label: 'Strong',    color: COLOR.green  },
  { min: 50, label: 'Good',      color: COLOR.accent },
  { min: 35, label: 'Developing',color: COLOR.orange },
  { min:  0, label: 'Starter',   color: COLOR.orange },
] as const;

export function getEIBand(score: number) {
  return EI_BANDS.find(b => score >= b.min) ?? EI_BANDS[EI_BANDS.length - 1];
}
