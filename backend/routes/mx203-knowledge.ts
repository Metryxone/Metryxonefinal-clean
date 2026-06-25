/**
 * MX-203 — Knowledge Center + Founder Knowledge-Completion routes (Phases 4 & 5).  READ-ONLY.
 *
 * Flag-gated (mx203KnowledgePopulation). OFF → every route 503 BEFORE any auth/DB touch, so the
 * surface is byte-identical to legacy. All routes are GET (the composer never writes). Admin-gated
 * (requireAuth + requireSuperAdmin). The `/enabled` probe is intentionally unauthenticated so any
 * persona's nav can hide the tab when the flag is OFF without leaking admin state.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isMx203KnowledgePopulationEnabled } from '../config/feature-flags';
import {
  getKnowledgeCoverage, getCompetencyHealth, getConsumerReadiness, getFounderKnowledgeRollup,
} from '../services/mx203-knowledge';

type GuardMW = (req: Request, res: Response, next: () => void) => void;

export function registerMx203KnowledgeRoutes(app: Express, pool: Pool, requireAuth: GuardMW, requireSuperAdmin: GuardMW) {
  const base = '/api/admin/mx203-knowledge';

  // Unauthenticated flag probe (byte-identical-OFF nav gating across personas).
  app.get(`${base}/enabled`, (_req, res) => {
    res.json({ enabled: isMx203KnowledgePopulationEnabled() });
  });

  // Flag gate fronts every data route: OFF → 503 before auth/DB.
  const gate: GuardMW = (_req, res, next) => {
    if (!isMx203KnowledgePopulationEnabled()) { res.status(503).json({ ok: false, error: 'mx203_knowledge_disabled' }); return; }
    next();
  };

  const wrap = (fn: (req: Request) => Promise<any>) => async (req: Request, res: Response) => {
    try { res.json(await fn(req)); }
    catch (e) { res.status(500).json({ ok: false, error: (e as Error).message }); }
  };

  app.get(`${base}/coverage`, gate, requireAuth, requireSuperAdmin, wrap(() => getKnowledgeCoverage(pool)));
  app.get(`${base}/health`, gate, requireAuth, requireSuperAdmin, wrap((req) => getCompetencyHealth(pool, { limit: Number(req.query.limit) || undefined, competencyId: req.query.competency_id ? String(req.query.competency_id) : undefined })));
  app.get(`${base}/consumers`, gate, requireAuth, requireSuperAdmin, wrap((req) => getConsumerReadiness(pool, { limit: Number(req.query.limit) || undefined })));
  app.get(`${base}/founder`, gate, requireAuth, requireSuperAdmin, wrap(() => getFounderKnowledgeRollup(pool)));
}
