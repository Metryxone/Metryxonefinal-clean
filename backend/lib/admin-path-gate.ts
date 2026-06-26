/**
 * Per-framework admin path classifier — single source of truth.
 *
 * The global `app.use('/api/admin', requireAuth → requireSuperAdmin)` gate in
 * routes.ts only covers the literal `/api/admin/*` prefix. Admin endpoints that
 * live under per-framework prefixes (`/api/lbi/admin`, `/api/sdi/admin`, …) and
 * a handful of admin-only reads outside an `/admin` segment historically relied
 * on per-route inline guards alone — so a NEW sub-route that forgot its guard
 * would ship public.
 *
 * `isFrameworkAdminPath()` lets a single mount-level gate (and the regression
 * test) classify those paths from ONE shared definition, so the gate and the
 * test can never drift. See `.agents/memory/per-framework-admin-gate-gap.md`.
 *
 * All paths here are MOUNT-RELATIVE to `/api` (i.e. the path AFTER the `/api`
 * mount prefix is stripped by Express). E.g. a request to
 * `/api/lbi/admin/foo` is classified on `/lbi/admin/foo`.
 */

/** Framework admin prefixes (everything under these is super-admin only). */
export const FRAMEWORK_ADMIN_PREFIXES: readonly string[] = [
  '/lbi/admin',
  '/sdi/admin',
  '/competency/admin',
  '/commercial/admin',
  '/concerns/admin',
  '/invoice/admin',
  '/short-assessments/admin',
];

/** Admin-only reads/writes that live OUTSIDE an `/admin` segment (exact match). */
export const FRAMEWORK_ADMIN_EXACT: ReadonlySet<string> = new Set([
  '/competency/cohorts',
  '/competency/versions',
  '/competency/engine-summary',
  '/commercial/razorpay/plan',
  '/commercial/razorpay/refund',
]);

/** Admin-only path families OUTSIDE an `/admin` segment (prefix match, e.g. `/competency/items/:id`). */
export const FRAMEWORK_ADMIN_PREFIX_PATHS: readonly string[] = [
  '/competency/items/',
];

/**
 * Intentionally-public framework reads (assessment/buyer flow, NOT an admin
 * page). Explicitly exempted so the gate never blocks them even if a future
 * prefix would otherwise catch them.
 */
export const FRAMEWORK_ADMIN_PUBLIC_EXEMPT: ReadonlySet<string> = new Set([
  '/sdi/domains',
  '/sdi/subdomains',
  '/sdi/items',
  '/lbi/clusters',
  '/sdi/clusters',
  '/commercial/razorpay/subscribe',
  '/commercial/razorpay/payment-link',
  '/commercial/razorpay/verify',
  '/commercial/razorpay/webhook',
]);

/**
 * Returns true when `mountRelativePath` (the request path AFTER the `/api`
 * mount prefix is stripped) must be gated by requireAuth → requireSuperAdmin.
 */
export function isFrameworkAdminPath(mountRelativePath: string): boolean {
  // Express route matching is CASE-INSENSITIVE by default ("case sensitive
  // routing" is off), so `/api/LBI/admin/foo` reaches a route registered as
  // `/api/lbi/admin/foo`. Classify case-insensitively too — otherwise a
  // mixed-case URL would evade the gate and reach a guard-less admin route.
  // Lowercasing is the fail-safe direction (it can only ever gate MORE, never
  // expose an admin path); the prefix/exact/exempt lists are all lowercase.
  const lowered = mountRelativePath.toLowerCase();

  // Normalise a single trailing slash (but keep root '/').
  const p =
    lowered.length > 1 && lowered.endsWith('/')
      ? lowered.slice(0, -1)
      : lowered;

  if (FRAMEWORK_ADMIN_PUBLIC_EXEMPT.has(p)) return false;
  if (FRAMEWORK_ADMIN_EXACT.has(p)) return true;
  if (FRAMEWORK_ADMIN_PREFIXES.some((pre) => p === pre || p.startsWith(pre + '/'))) return true;
  if (FRAMEWORK_ADMIN_PREFIX_PATHS.some((pre) => p.startsWith(pre))) return true;
  return false;
}
