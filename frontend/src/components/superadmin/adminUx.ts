/**
 * Admin UX spacing & layout tokens (STEP 10 — additive UX shell).
 *
 * A single source of truth for spacing / radius / page-rhythm used by the
 * additive shell (breadcrumb bar, sticky action bar) and available to any new
 * SuperAdmin panel that wants consistent rhythm. Existing panels are NOT
 * required to adopt these — this layer is additive and never rewrites them.
 */
export const ADMIN_UX = {
  /** Base spacing scale (px). */
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  /** Page-level rhythm for the content container. */
  page: { padX: 24, padY: 24, maxW: 1600, gap: 24 },
  /** Corner radii (px). */
  radius: { sm: 6, md: 10, lg: 14 },
  /** Sticky sub-header (breadcrumb + action) bar. */
  bar: { height: 44, padX: 24 },
} as const;

/** Consistent content-container class for the shell + opt-in panels. */
export const ADMIN_PAGE_CONTAINER = 'mx-auto w-full';

/** Inline style for the max-width content wrapper. */
export const adminPageStyle: React.CSSProperties = {
  maxWidth: ADMIN_UX.page.maxW,
};
