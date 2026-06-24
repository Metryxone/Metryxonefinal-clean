/**
 * MX-76X — Global Intelligence routes (read-only composer).
 *
 * GET /api/global-intel/enabled            persona-agnostic flag probe (flagGate-only)
 * GET /api/global-intel/regions            canonical region set + crosswalk + coverage      (auth)
 * GET /api/global-intel/countries          m4 localized countries + currency + region binding (auth)
 * GET /api/global-intel/country/:iso2       composed country profile (404 for unknown ISO2)    (auth)
 * GET /api/global-intel/benchmarks         benchmark tier coverage (region tier latent)        (auth)
 * GET /api/global-intel/role-dna/:roleId    Role-DNA region/country inheritance (variant=null)  (auth)
 * GET /api/global-intel/localization       language packs + currency resolver status           (auth)
 * GET /api/global-intel/overview           full composed view                       (super-admin)
 *
 * Strictly additive + reversible + flag-gated (`globalIntelligence`, FF_GLOBAL_INTELLIGENCE, OFF):
 *   - OFF → every route 503 before any DB touch → byte-identical legacy behaviour incl. schema.
 *   - GET-only, NO DDL / NO ensure-schema (zero new tables); every read is to_regclass-probed.
 *   - Reference reads require login (platform metadata, no PII); overview adds super-admin.
 *   - Composes existing assets only — never recomputes, never writes, never fabricates.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import { createGlobalIntelligence, GLOBAL_INTELLIGENCE_VERSION } from '../services/global-intelligence';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('globalIntelligence')) {
    return res.status(503).json({ ok: false, error: 'global_intelligence_disabled' });
  }
  next();
}

export function registerGlobalIntelligenceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const gi = createGlobalIntelligence(pool);

  // Persona-agnostic flag probe — lets employer/candidate UIs gate their tabs without super-admin.
  app.get('/api/global-intel/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true, version: GLOBAL_INTELLIGENCE_VERSION });
  });

  app.get('/api/global-intel/regions', flagGate, requireAuth, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, ...(await gi.regions()) }); }
    catch (err) { console.error('[global-intel] regions error:', err); res.status(500).json({ ok: false, error: 'regions_failed' }); }
  });

  app.get('/api/global-intel/countries', flagGate, requireAuth, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, ...(await gi.countries()) }); }
    catch (err) { console.error('[global-intel] countries error:', err); res.status(500).json({ ok: false, error: 'countries_failed' }); }
  });

  // Literal `country/:iso2` is fine (no sibling literal collision under this base).
  app.get('/api/global-intel/country/:iso2', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const iso2 = String(req.params.iso2 ?? '').trim();
      if (!/^[A-Za-z]{2}$/.test(iso2)) return res.status(400).json({ ok: false, error: 'invalid_iso2' });
      const profile = await gi.country(iso2);
      if (!profile) return res.status(404).json({ ok: false, error: 'country_not_localized', iso2: iso2.toUpperCase() });
      res.json({ ok: true, country: profile });
    } catch (err) { console.error('[global-intel] country error:', err); res.status(500).json({ ok: false, error: 'country_failed' }); }
  });

  app.get('/api/global-intel/benchmarks', flagGate, requireAuth, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, ...(await gi.benchmarks()) }); }
    catch (err) { console.error('[global-intel] benchmarks error:', err); res.status(500).json({ ok: false, error: 'benchmarks_failed' }); }
  });

  app.get('/api/global-intel/role-dna/:roleId', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const roleId = String(req.params.roleId ?? '').trim();
      if (!roleId) return res.status(400).json({ ok: false, error: 'role_id_required' });
      const region = req.query.region != null ? String(req.query.region) : undefined;
      const country = req.query.country != null ? String(req.query.country) : undefined;
      res.json({ ok: true, ...(await gi.roleDna(roleId, { region, country })) });
    } catch (err) { console.error('[global-intel] role-dna error:', err); res.status(500).json({ ok: false, error: 'role_dna_failed' }); }
  });

  app.get('/api/global-intel/localization', flagGate, requireAuth, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, ...(await gi.localization()) }); }
    catch (err) { console.error('[global-intel] localization error:', err); res.status(500).json({ ok: false, error: 'localization_failed' }); }
  });

  app.get('/api/global-intel/overview', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, ...(await gi.overview()) }); }
    catch (err) { console.error('[global-intel] overview error:', err); res.status(500).json({ ok: false, error: 'overview_failed' }); }
  });
}
