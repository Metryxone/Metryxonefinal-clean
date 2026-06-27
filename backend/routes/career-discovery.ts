/**
 * MX-302B — Career Discovery & AI Guidance routes
 * ----------------------------------------------------------------------------
 * Flag-gated (careerDiscovery / FF_CAREER_DISCOVERY). Default OFF → every route
 * 503s BEFORE any auth/DB touch, so flag-OFF is byte-identical incl. schema (the
 * lazy ensure-schema is only reached on the flag-ON path).
 *
 * Security: every route is requireAuth and operates on the AUTHENTICATED user
 * only — the subject is resolved server-side from the session principal, never
 * from a client-supplied id, so there is no IDOR surface (the composed
 * match/simulation engines are called as services, bypassing their super-admin
 * HTTP routes, with subject pinned to self).
 *
 * Audit: discovery completion and guidance generation are logged via the shared
 * best-effort, redacting platform-audit logger.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isCareerDiscoveryEnabled } from '../config/feature-flags';
import { logAudit } from '../services/platform-audit';
import { VALUES_QUESTIONS, VALUE_DIMENSIONS } from '../services/career-discovery-values';
import {
  readDiscoveryStatus,
  persistValues,
  markDiscovery,
  buildDiscoveryBattery,
  buildDiscoveryProfile,
} from '../services/career-discovery-orchestrator';
import {
  buildExplorerView,
  buildExplorerRole,
  buildExplorerSimulation,
  buildExplorerMarket,
} from '../services/career-discovery-explorer';
import { buildDiscoveryGuidance } from '../services/career-discovery-guidance';

type RequireAuth = (req: Request, res: Response, next: () => void) => void;

/** Resolve the authenticated subject id (self only — never client-supplied). */
function selfId(req: Request): string | null {
  const u = (req as any).user;
  const id = u?.id ?? u?.userId ?? u?.user_id;
  return id != null ? String(id) : null;
}

export function registerCareerDiscoveryRoutes(app: Express, pool: Pool, requireAuth: RequireAuth): void {
  const BASE = '/api/career-discovery';

  /** Flag gate — 503 before any auth/DB touch when OFF. */
  const gate = (_req: Request, res: Response, next: () => void) => {
    if (!isCareerDiscoveryEnabled()) {
      return res.status(503).json({ ok: false, enabled: false, message: 'Career Discovery is not enabled.' });
    }
    next();
  };

  // ── Probe: enabled flag. Intentionally NOT gated — it always returns 200 with
  // {enabled:false} when OFF so the frontend can cheaply detect the flag state.
  // DATA routes below are gate-protected and 503 when OFF (byte-identical). ──
  app.get(`${BASE}/enabled`, (_req, res) => {
    res.json({ ok: true, enabled: isCareerDiscoveryEnabled() });
  });

  // ── Values inventory question bank (static) ─────────────────────────────────
  app.get(`${BASE}/values/questions`, gate, requireAuth, (_req, res) => {
    res.json({ ok: true, dimensions: VALUE_DIMENSIONS, questions: VALUES_QUESTIONS });
  });

  // ── Per-user discovery status ───────────────────────────────────────────────
  app.get(`${BASE}/status`, gate, requireAuth, async (req, res) => {
    const uid = selfId(req);
    if (!uid) return res.status(401).json({ ok: false, message: 'Unauthorized' });
    const status = await readDiscoveryStatus(pool, uid);
    res.json({ ok: true, ...status });
  });

  // ── Assessment battery ──────────────────────────────────────────────────────
  app.get(`${BASE}/battery`, gate, requireAuth, async (req, res) => {
    const uid = selfId(req);
    if (!uid) return res.status(401).json({ ok: false, message: 'Unauthorized' });
    const battery = await buildDiscoveryBattery(pool, uid);
    res.json(battery);
  });

  // ── Submit Values inventory (explicit write) ────────────────────────────────
  app.post(`${BASE}/values`, gate, requireAuth, async (req, res) => {
    const uid = selfId(req);
    if (!uid) return res.status(401).json({ ok: false, message: 'Unauthorized' });
    const responses = (req.body && typeof req.body === 'object' ? (req.body.responses ?? req.body) : {}) as Record<string, unknown>;
    const scores = await persistValues(pool, uid, responses);
    void logAudit(pool, req, {
      action: 'update',
      entityType: 'career_discovery_values',
      entityId: uid,
      metadata: { coverage: scores.coverage, measurable: scores.measurable },
    });
    res.json({ ok: true, scores });
  });

  // ── Aggregated discovery profile + compatibility ────────────────────────────
  app.get(`${BASE}/profile`, gate, requireAuth, async (req, res) => {
    const uid = selfId(req);
    if (!uid) return res.status(401).json({ ok: false, message: 'Unauthorized' });
    const profile = await buildDiscoveryProfile(pool, uid);
    res.json(profile);
  });

  // ── Mark discovery complete / skipped (explicit write + audit) ──────────────
  app.post(`${BASE}/complete`, gate, requireAuth, async (req, res) => {
    const uid = selfId(req);
    if (!uid) return res.status(401).json({ ok: false, message: 'Unauthorized' });
    const skip = req.body?.skip === true || req.body?.status === 'skipped';
    const status = await markDiscovery(pool, uid, skip ? 'skipped' : 'completed');
    void logAudit(pool, req, {
      action: 'update',
      entityType: 'career_discovery',
      entityId: uid,
      metadata: { status: status.status, compatibility_score: status.compatibility_score },
    });
    res.json({ ok: true, ...status });
  });

  // ── Career Explorer (literal sub-paths BEFORE the param route) ──────────────
  app.get(`${BASE}/explorer`, gate, requireAuth, async (req, res) => {
    const uid = selfId(req);
    if (!uid) return res.status(401).json({ ok: false, message: 'Unauthorized' });
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const view = await buildExplorerView(pool, uid, limit);
    res.json(view);
  });

  // Market explorer: industries / functions / salaries / emerging careers.
  app.get(`${BASE}/explorer/market`, gate, requireAuth, async (req, res) => {
    const uid = selfId(req);
    if (!uid) return res.status(401).json({ ok: false, message: 'Unauthorized' });
    const region = typeof req.query.region === 'string' ? req.query.region : 'IN';
    const market = await buildExplorerMarket(pool, uid, region);
    res.json(market);
  });

  app.post(`${BASE}/explorer/simulate`, gate, requireAuth, async (req, res) => {
    const uid = selfId(req);
    if (!uid) return res.status(401).json({ ok: false, message: 'Unauthorized' });
    const changes = Array.isArray(req.body?.changes) ? req.body.changes : [];
    const scenarioKey = typeof req.body?.scenarioKey === 'string' ? req.body.scenarioKey : undefined;
    const sim = await buildExplorerSimulation(pool, uid, changes, scenarioKey);
    res.json(sim);
  });

  app.get(`${BASE}/explorer/role/:roleId`, gate, requireAuth, async (req, res) => {
    const uid = selfId(req);
    if (!uid) return res.status(401).json({ ok: false, message: 'Unauthorized' });
    const out = await buildExplorerRole(pool, uid, String(req.params.roleId));
    res.json(out);
  });

  // ── AI Guidance (honest LLM → rule-based degradation) ───────────────────────
  app.get(`${BASE}/guidance`, gate, requireAuth, async (req, res) => {
    const uid = selfId(req);
    if (!uid) return res.status(401).json({ ok: false, message: 'Unauthorized' });
    const profile = await buildDiscoveryProfile(pool, uid);
    const guidance = await buildDiscoveryGuidance(pool, uid, profile);
    void logAudit(pool, req, {
      action: 'export',
      entityType: 'career_discovery_guidance',
      entityId: uid,
      metadata: { ai_mode: guidance.ai_mode, ai_available: guidance.ai_available, coverage: guidance.coverage },
    });
    res.json(guidance);
  });
}
