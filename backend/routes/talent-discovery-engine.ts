/**
 * PHASE 5.4 — Talent Discovery Engine (routes).
 *
 * Base: /api/talent-discovery-engine/*
 *   - candidate_search_engine : GET /candidates (search+filter), GET /candidates/:id
 *   - talent_discovery_engine : GET /segments (segmentation),
 *                               shortlists CRUD + members, saved-searches CRUD + run
 *   - talent_pools            : pools CRUD + members
 *
 * Contract:
 *   - Flag-gated: `talentDiscovery` (FF_TALENT_DISCOVERY). OFF => every route 503
 *     BEFORE any auth/DB touch (byte-identical legacy).
 *   - Super-admin gated (requireAuth -> requireSuperAdmin); created_by/added_by
 *     are the authenticated principal, never client-supplied (IDOR-safe).
 *   - GET routes are read-only (engine uses to_regclass probes, no DDL).
 *   - Engine never throws; not-found => 404, bad input => 400.
 *   - Literal/more-specific sub-paths registered BEFORE param routes.
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isTalentDiscoveryEnabled } from '../config/feature-flags';
import {
  TALENT_DISCOVERY_ENGINE_VERSION as ENGINE_VERSION,
  searchCandidates,
  getCandidate,
  segmentCandidates,
  segmentDimensions,
  createPool,
  listPools,
  getPool,
  addToPool,
  removeFromPool,
  deletePool,
  createShortlist,
  listShortlists,
  getShortlist,
  addToShortlist,
  setShortlistMemberStatus,
  removeFromShortlist,
  deleteShortlist,
  createSavedSearch,
  listSavedSearches,
  getSavedSearch,
  runSavedSearch,
  deleteSavedSearch,
  type Actor,
  type EngineResult,
  type SearchParams,
} from '../services/talent-discovery-engine';

type Mw = (req: any, res: any, next: any) => void;

export function registerTalentDiscoveryEngineRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const gate: Mw = (_req, res, next) => {
    if (!isTalentDiscoveryEnabled()) {
      return res.status(503).json({
        error: 'Talent Discovery Engine is not enabled',
        flag: 'talentDiscovery',
        env: 'FF_TALENT_DISCOVERY',
      });
    }
    next();
  };
  const guards = [gate, requireAuth, requireSuperAdmin];

  const actorOf = (req: Request): Actor => ({
    id: (req as any).user?.id,
    role: (req as any).user?.role ?? 'super_admin',
  });

  const send = (res: Response, r: EngineResult, okStatus = 200) => {
    if (r.ok) return res.status(okStatus).json({ success: true, data: r.data });
    const status = r.code === 'not_found' ? 404 : 400;
    return res.status(status).json({ success: false, code: r.code, error: r.message });
  };

  const arr = (v: any): string[] | undefined => {
    if (v === undefined) return undefined;
    if (Array.isArray(v)) return v.map(String);
    return String(v).split(',').map((s) => s.trim()).filter(Boolean);
  };

  const parseSearch = (q: any): SearchParams => ({
    q: q.q,
    role: q.role,
    location: q.location,
    stage: q.stage,
    source: q.source,
    employerId: q.employerId ?? q.employer_id,
    skills: arr(q.skills),
    tags: arr(q.tags),
    minEi: q.minEi,
    maxEi: q.maxEi,
    minMatch: q.minMatch,
    minRating: q.minRating,
    pooled: q.pooled === undefined ? undefined : q.pooled === 'true' || q.pooled === '1',
    sort: q.sort,
    dir: q.dir === 'asc' ? 'asc' : q.dir === 'desc' ? 'desc' : undefined,
    limit: q.limit,
    offset: q.offset,
  });

  // ── meta ───────────────────────────────────────────────────────────────────
  app.get('/api/talent-discovery-engine/_meta/status', ...guards, (_req: Request, res: Response) => {
    res.json({
      engine: 'talent-discovery-engine',
      version: ENGINE_VERSION,
      flag: 'talentDiscovery',
      segment_dimensions: segmentDimensions(),
      engines: {
        candidate_search_engine: ['search', 'filter', 'get'],
        talent_discovery_engine: ['segment', 'shortlists', 'saved_searches'],
        talent_pools: ['create', 'list', 'get', 'add_members', 'remove_member', 'delete'],
      },
    });
  });

  // ── candidate_search_engine ─────────────────────────────────────────────────
  app.get('/api/talent-discovery-engine/candidates', ...guards, async (req: Request, res: Response) => {
    send(res, await searchCandidates(pool, parseSearch(req.query)));
  });
  app.get('/api/talent-discovery-engine/candidates/:id', ...guards, async (req: Request, res: Response) => {
    send(res, await getCandidate(pool, req.params.id));
  });

  // ── talent_discovery_engine: segmentation ───────────────────────────────────
  app.get('/api/talent-discovery-engine/segments', ...guards, async (req: Request, res: Response) => {
    send(res, await segmentCandidates(pool, String(req.query.dimension ?? 'stage'), parseSearch(req.query)));
  });

  // ── talent_pools ────────────────────────────────────────────────────────────
  app.post('/api/talent-discovery-engine/pools', ...guards, async (req: Request, res: Response) => {
    send(res, await createPool(pool, actorOf(req), req.body), 201);
  });
  app.get('/api/talent-discovery-engine/pools', ...guards, async (_req: Request, res: Response) => {
    send(res, await listPools(pool));
  });
  // more-specific member paths BEFORE /pools/:id
  app.post('/api/talent-discovery-engine/pools/:id/members', ...guards, async (req: Request, res: Response) => {
    send(res, await addToPool(pool, actorOf(req), req.params.id, req.body?.candidateIds ?? req.body?.candidate_ids));
  });
  app.delete('/api/talent-discovery-engine/pools/:id/members/:candidateId', ...guards, async (req: Request, res: Response) => {
    send(res, await removeFromPool(pool, req.params.id, req.params.candidateId));
  });
  app.get('/api/talent-discovery-engine/pools/:id', ...guards, async (req: Request, res: Response) => {
    send(res, await getPool(pool, req.params.id));
  });
  app.delete('/api/talent-discovery-engine/pools/:id', ...guards, async (req: Request, res: Response) => {
    send(res, await deletePool(pool, req.params.id));
  });

  // ── shortlists ────────────────────────────────────────────────────────────
  app.post('/api/talent-discovery-engine/shortlists', ...guards, async (req: Request, res: Response) => {
    send(res, await createShortlist(pool, actorOf(req), req.body), 201);
  });
  app.get('/api/talent-discovery-engine/shortlists', ...guards, async (_req: Request, res: Response) => {
    send(res, await listShortlists(pool));
  });
  app.post('/api/talent-discovery-engine/shortlists/:id/members', ...guards, async (req: Request, res: Response) => {
    send(res, await addToShortlist(pool, actorOf(req), req.params.id, req.body?.candidateIds ?? req.body?.candidate_ids));
  });
  app.put('/api/talent-discovery-engine/shortlists/:id/members/:candidateId', ...guards, async (req: Request, res: Response) => {
    send(res, await setShortlistMemberStatus(pool, req.params.id, req.params.candidateId, req.body?.status));
  });
  app.delete('/api/talent-discovery-engine/shortlists/:id/members/:candidateId', ...guards, async (req: Request, res: Response) => {
    send(res, await removeFromShortlist(pool, req.params.id, req.params.candidateId));
  });
  app.get('/api/talent-discovery-engine/shortlists/:id', ...guards, async (req: Request, res: Response) => {
    send(res, await getShortlist(pool, req.params.id));
  });
  app.delete('/api/talent-discovery-engine/shortlists/:id', ...guards, async (req: Request, res: Response) => {
    send(res, await deleteShortlist(pool, req.params.id));
  });

  // ── saved searches ──────────────────────────────────────────────────────────
  app.post('/api/talent-discovery-engine/saved-searches', ...guards, async (req: Request, res: Response) => {
    send(res, await createSavedSearch(pool, actorOf(req), req.body), 201);
  });
  app.get('/api/talent-discovery-engine/saved-searches', ...guards, async (_req: Request, res: Response) => {
    send(res, await listSavedSearches(pool));
  });
  app.post('/api/talent-discovery-engine/saved-searches/:id/run', ...guards, async (req: Request, res: Response) => {
    send(res, await runSavedSearch(pool, req.params.id, parseSearch(req.query)));
  });
  app.get('/api/talent-discovery-engine/saved-searches/:id', ...guards, async (req: Request, res: Response) => {
    send(res, await getSavedSearch(pool, req.params.id));
  });
  app.delete('/api/talent-discovery-engine/saved-searches/:id', ...guards, async (req: Request, res: Response) => {
    send(res, await deleteSavedSearch(pool, req.params.id));
  });
}
