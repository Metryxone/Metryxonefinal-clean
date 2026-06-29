/**
 * MX-700 Phase 1.42 — Platform Lifecycle Operations & SuperAdmin Governance Platform (probe-only route).
 *
 * This phase is a FRONTEND EXPOSURE phase: it extends the EXISTING SuperAdmin with ONE read-only console
 * that COMPOSES the already-shipped read APIs of 1.37 Foundation / 1.38 Management / 1.39 Intelligence /
 * 1.40 Evolution / 1.41 Automation. It therefore ships NO new data endpoints, NO new service, NO migration
 * and NO new persistence — the console fetches the existing per-engine endpoints client-side.
 *
 * The ONLY backend surface here is the standard flag gate so the new nav tab can be hidden when OFF and
 * the whole phase is byte-identical legacy when the flag is OFF:
 *   - GET `/enabled`      — persona-agnostic probe (no auth), `{ enabled }`.
 *   - GET `/feature-flag` — super-admin UI gate (res.ok); 503 when OFF (tab hidden), 200 when ON.
 *
 * Honesty: this gate reports whether the OPERATIONS CONSOLE is exposed — it says nothing about whether the
 * underlying 1.37–1.41 engines are activated. Each console section independently probes its own engine flag
 * and renders an honest "engine OFF" state (Dashboard ≠ Runtime, Visible ≠ Operational, Built ≠ Activated).
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import { isPlatformLifecycleOperationsEnabled } from '../config/feature-flags';

export function registerPlatformLifecycleOperationsRoutes(
  app: Express,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  const BASE = '/api/admin/platform-lifecycle-operations';

  // Persona-agnostic flag probe (no auth) so the admin UI can hide the tab when OFF.
  app.get(`${BASE}/enabled`, (_req: Request, res: Response) => {
    res.json({ enabled: isPlatformLifecycleOperationsEnabled() });
  });

  // Gate the super-admin probe on the flag FIRST (503 before any auth touch when OFF).
  const gate: RequestHandler = (_req, res, next) => {
    if (!isPlatformLifecycleOperationsEnabled()) {
      return res.status(503).json({ ok: false, error: 'platform_lifecycle_operations_disabled' });
    }
    next();
  };

  // Super-admin UI tab gate (res.ok). 503 when OFF (tab hidden), 200 when ON.
  app.get(`${BASE}/feature-flag`, gate, requireAuth, requireSuperAdmin, (_req, res) => {
    res.json({ ok: true, enabled: true });
  });
}
