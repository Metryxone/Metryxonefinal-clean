/**
 * CAPADEX PIL — Phase 8B: Relationship Traversal API (read-only).
 *
 *   Public read surface over the GraphTraversalEngine. All routes traverse the
 *   CANONICAL materialized graph (pil_kg_nodes/pil_kg_edges + the catalog tables)
 *   — they NEVER create nodes or mutate graph structure.
 *
 *     GET /api/pil-graph/path         — ShortestPathResolver
 *     GET /api/pil-graph/related      — RelatedNodeResolver
 *     GET /api/pil-graph/lineage      — LineageResolver (concept spine)
 *     GET /api/pil-graph/dependencies — DependencyResolver (directed closure)
 *
 *   Phase 8C (SimilarityEngine — same flag, same conventions):
 *     GET /api/pil-graph/similar                    — same-category similarity (explainable)
 *     GET /api/pil-graph/recommendations-like-this  — similar recommendations for any anchor
 *
 *   Flag-gated by isRuntimeIntelligenceActivationEnabled(): OFF → {enabled:false}
 *   (byte-identical legacy). Param-validated; degrades gracefully; never 500s.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isRuntimeIntelligenceActivationEnabled } from '../config/feature-flags';
import {
  traversePath,
  traverseRelated,
  traverseLineage,
  traverseDependencies,
} from '../services/pil/graph-traversal-engine';
import { similarTo, recommendationsLikeThis } from '../services/pil/similarity-engine';
import { explainNode, whyNode, pathToSource } from '../services/pil/graph-explainability-engine';
import { runGraphValidation } from '../services/pil/graph-validation-engine';

const floatParam = (v: unknown, def: number, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(n, hi)) : def;
};

const MAX_ID = 256;
const validId = (s: string) => !!s && s.length <= MAX_ID;
const intParam = (v: unknown, def: number, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(Math.trunc(n), hi)) : def;
};

type Auth = (req: Request, res: Response, next: NextFunction) => void;

export function registerPilGraphTraversalRoutes(app: Express, pool: Pool, requireAuth: Auth): void {
  // GET /api/pil-graph/path?source=&target=&directed=1&maxHops=
  app.get('/api/pil-graph/path', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) return res.status(200).json({ ok: true, enabled: false });
      const source = String(req.query.source || '').trim();
      const target = String(req.query.target || '').trim();
      if (!validId(source) || !validId(target)) return res.status(400).json({ error: 'source_and_target_required' });
      const directed = req.query.directed === '1' || req.query.directed === 'true';
      const maxHops = intParam(req.query.maxHops, 12, 1, 64);
      const result = await traversePath(pool, source, target, { directed, maxHops }).catch((err) => {
        console.warn('[pil-graph-path] degraded:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!result) return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      if (!result.found) return res.status(404).json({ ok: false, enabled: true, error: 'node_not_found' });
      return res.status(200).json({ ok: true, enabled: true, ...result });
    } catch (err) { next(err); }
  });

  // GET /api/pil-graph/related?node=&limit=&sameCategory=1
  app.get('/api/pil-graph/related', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) return res.status(200).json({ ok: true, enabled: false });
      const node = String(req.query.node || '').trim();
      if (!validId(node)) return res.status(400).json({ error: 'node_required' });
      const limit = intParam(req.query.limit, 20, 1, 200);
      const sameCategory = req.query.sameCategory === '1' || req.query.sameCategory === 'true';
      const result = await traverseRelated(pool, node, { limit, sameCategory }).catch((err) => {
        console.warn('[pil-graph-related] degraded:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!result) return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      if (!result.found) return res.status(404).json({ ok: false, enabled: true, error: 'node_not_found' });
      return res.status(200).json({ ok: true, enabled: true, ...result });
    } catch (err) { next(err); }
  });

  // GET /api/pil-graph/lineage?anchor=&maxPerStage=&maxHopsPerStage=
  app.get('/api/pil-graph/lineage', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) return res.status(200).json({ ok: true, enabled: false });
      const anchor = String(req.query.anchor || '').trim();
      if (!validId(anchor)) return res.status(400).json({ error: 'anchor_required' });
      const maxPerStage = intParam(req.query.maxPerStage, 8, 1, 50);
      const maxHopsPerStage = intParam(req.query.maxHopsPerStage, 3, 1, 8);
      const result = await traverseLineage(pool, anchor, { maxPerStage, maxHopsPerStage }).catch((err) => {
        console.warn('[pil-graph-lineage] degraded:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!result) return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      if (!result.found) return res.status(404).json({ ok: false, enabled: true, error: 'node_not_found' });
      return res.status(200).json({ ok: true, enabled: true, ...result });
    } catch (err) { next(err); }
  });

  // GET /api/pil-graph/dependencies?node=&direction=&maxDepth=&maxNodes=
  app.get('/api/pil-graph/dependencies', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) return res.status(200).json({ ok: true, enabled: false });
      const node = String(req.query.node || '').trim();
      if (!validId(node)) return res.status(400).json({ error: 'node_required' });
      const dirRaw = String(req.query.direction || 'downstream');
      const direction = dirRaw === 'upstream' || dirRaw === 'both' ? dirRaw : 'downstream';
      const maxDepth = intParam(req.query.maxDepth, 6, 1, 32);
      const maxNodes = intParam(req.query.maxNodes, 500, 1, 5000);
      const result = await traverseDependencies(pool, node, { direction, maxDepth, maxNodes }).catch((err) => {
        console.warn('[pil-graph-dependencies] degraded:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!result) return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      if (!result.found) return res.status(404).json({ ok: false, enabled: true, error: 'node_not_found' });
      return res.status(200).json({ ok: true, enabled: true, ...result });
    } catch (err) { next(err); }
  });

  // GET /api/pil-graph/similar?node=&limit=&minScore=&targetCategory=  (Phase 8C)
  app.get('/api/pil-graph/similar', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) return res.status(200).json({ ok: true, enabled: false });
      const node = String(req.query.node || '').trim();
      if (!validId(node)) return res.status(400).json({ error: 'node_required' });
      const limit = intParam(req.query.limit, 10, 1, 200);
      const minScore = floatParam(req.query.minScore, 0.05, 0, 1);
      const targetCategory = String(req.query.targetCategory || '').trim() || undefined;
      const result = await similarTo(pool, node, { limit, minScore, targetCategory }).catch((err) => {
        console.warn('[pil-graph-similar] degraded:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!result) return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      if (!result.found) return res.status(404).json({ ok: false, enabled: true, error: 'node_not_found' });
      return res.status(200).json({ ok: true, enabled: true, ...result });
    } catch (err) { next(err); }
  });

  // GET /api/pil-graph/recommendations-like-this?node=&limit=&minScore=  (Phase 8C)
  app.get('/api/pil-graph/recommendations-like-this', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) return res.status(200).json({ ok: true, enabled: false });
      const node = String(req.query.node || '').trim();
      if (!validId(node)) return res.status(400).json({ error: 'node_required' });
      const limit = intParam(req.query.limit, 10, 1, 200);
      const minScore = floatParam(req.query.minScore, 0.05, 0, 1);
      const result = await recommendationsLikeThis(pool, node, { limit, minScore }).catch((err) => {
        console.warn('[pil-graph-recs-like-this] degraded:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!result) return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      if (!result.found) return res.status(404).json({ ok: false, enabled: true, error: 'node_not_found' });
      return res.status(200).json({ ok: true, enabled: true, ...result });
    } catch (err) { next(err); }
  });

  // GET /api/pil-graph/explain?node=&maxHops=&maxExpand=  (Phase 8E)
  app.get('/api/pil-graph/explain', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) return res.status(200).json({ ok: true, enabled: false });
      const node = String(req.query.node || '').trim();
      if (!validId(node)) return res.status(400).json({ error: 'node_required' });
      const maxHops = intParam(req.query.maxHops, 8, 1, 32);
      const maxExpand = intParam(req.query.maxExpand, 20000, 100, 200000);
      const result = await explainNode(pool, node, { maxHops, maxExpand }).catch((err) => {
        console.warn('[pil-graph-explain] degraded:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!result) return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      if (!result.found) return res.status(404).json({ ok: false, enabled: true, error: 'node_not_found' });
      return res.status(200).json({ ok: true, enabled: true, ...result });
    } catch (err) { next(err); }
  });

  // GET /api/pil-graph/why?node=&maxHops=&maxExpand=  (Phase 8E)
  app.get('/api/pil-graph/why', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) return res.status(200).json({ ok: true, enabled: false });
      const node = String(req.query.node || '').trim();
      if (!validId(node)) return res.status(400).json({ error: 'node_required' });
      const maxHops = intParam(req.query.maxHops, 8, 1, 32);
      const maxExpand = intParam(req.query.maxExpand, 20000, 100, 200000);
      const result = await whyNode(pool, node, { maxHops, maxExpand }).catch((err) => {
        console.warn('[pil-graph-why] degraded:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!result) return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      if (!result.found) return res.status(404).json({ ok: false, enabled: true, error: 'node_not_found' });
      return res.status(200).json({ ok: true, enabled: true, ...result });
    } catch (err) { next(err); }
  });

  // GET /api/pil-graph/path-to-source?node=&maxHops=&maxExpand=  (Phase 8E)
  app.get('/api/pil-graph/path-to-source', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) return res.status(200).json({ ok: true, enabled: false });
      const node = String(req.query.node || '').trim();
      if (!validId(node)) return res.status(400).json({ error: 'node_required' });
      const maxHops = intParam(req.query.maxHops, 8, 1, 32);
      const maxExpand = intParam(req.query.maxExpand, 20000, 100, 200000);
      const result = await pathToSource(pool, node, { maxHops, maxExpand }).catch((err) => {
        console.warn('[pil-graph-path-to-source] degraded:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!result) return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      if (!result.found) return res.status(404).json({ ok: false, enabled: true, error: 'node_not_found' });
      return res.status(200).json({ ok: true, enabled: true, ...result });
    } catch (err) { next(err); }
  });

  // GET /api/pil-graph/readiness?refresh=1  (Phase 8F — Knowledge Graph certification)
  app.get('/api/pil-graph/readiness', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) return res.status(200).json({ ok: true, enabled: false });
      const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
      const result = await runGraphValidation(pool, { refresh }).catch((err) => {
        console.warn('[pil-graph-readiness] degraded:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!result) return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      return res.status(200).json({ ok: true, enabled: true, ...result });
    } catch (err) { next(err); }
  });
}
