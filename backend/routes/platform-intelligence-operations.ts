/**
 * MX-800 Phase 2.11 — Platform Intelligence Operations Center (probe-only route).
 *
 * This phase is a FRONTEND EXPOSURE phase: it extends the EXISTING SuperAdmin with ONE read-only console
 * that COMPOSES the already-shipped read APIs of the nine prior MX-800 intelligence tiers (2.1 platform-
 * intelligence-registry / 2.3 engineering / 2.4 runtime / 2.5 knowledge / 2.6 decision / 2.7 predictive /
 * 2.8 recommendation / 2.9 continuous-learning / 2.10 enterprise) CLIENT-SIDE. It therefore ships NO new
 * data endpoints, NO new service, NO migration and NO new persistence — the console fetches the existing
 * per-tier endpoints client-side. No business logic is changed and no dormant capability is activated.
 *
 * The ONLY backend surface here is the standard flag gate so the new nav tab can be hidden when OFF and
 * the whole phase is byte-identical legacy when the flag is OFF:
 *   - GET `/enabled`      — persona-agnostic probe (no auth), `{ enabled }`.
 *   - GET `/feature-flag` — super-admin UI gate (res.ok); 503 when OFF (tab hidden), 200 when ON.
 *
 * Honesty: this gate reports whether the OPERATIONS CONSOLE is exposed — it says nothing about whether the
 * underlying 2.1–2.10 intelligence engines are activated. Each console section independently probes its own
 * engine flag and renders an honest "engine OFF" state (Visible ≠ Healthy; Dashboard ≠ Intelligence;
 * Monitoring ≠ Governance; Alert ≠ Incident; Built ≠ Activated; human approval mandatory).
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import { isPlatformIntelligenceOperationsEnabled } from '../config/feature-flags';

export function registerPlatformIntelligenceOperationsRoutes(
  app: Express,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  const BASE = '/api/admin/platform-intelligence-operations';

  // Persona-agnostic flag probe (no auth) so the admin UI can hide the tab when OFF.
  app.get(`${BASE}/enabled`, (_req: Request, res: Response) => {
    res.json({ enabled: isPlatformIntelligenceOperationsEnabled() });
  });

  // Gate the super-admin probe on the flag FIRST (503 before any auth touch when OFF).
  const gate: RequestHandler = (_req, res, next) => {
    if (!isPlatformIntelligenceOperationsEnabled()) {
      return res.status(503).json({ ok: false, error: 'platform_intelligence_operations_disabled' });
    }
    next();
  };

  // Super-admin UI tab gate (res.ok). 503 when OFF (tab hidden), 200 when ON.
  app.get(`${BASE}/feature-flag`, gate, requireAuth, requireSuperAdmin, (_req, res) => {
    res.json({ ok: true, enabled: true });
  });
}
