/**
 * Workforce OS V2 routes (additive, feature-flagged).
 *
 * Mount prefix: /api/wos/v2
 * Flag: workforceOSV2 (default ON; FF_WORKFORCE_OS_V2=false).
 * Existing /api/wos/* (Phase 5) routes are untouched.
 *
 *   POST /market/forecast            — predictive forecast for a market signal
 *   POST /predictive/simulate        — workforce scenario simulation
 *   POST /fairness/drift             — drift + significance for one metric
 *   GET  /dispute/sla/:disputeId     — SLA envelope for a dispute
 *   POST /rbac/abac/evaluate         — ABAC policy decision (allow/deny + trace)
 *   POST /learning/attribution       — cohort longitudinal attribution
 *   GET  /feature-flag               — public flag readback
 *   GET  /_meta/versions             — public version stamp
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  forecastSignal, persistForecast, fetchSignalHistory, MARKET_INTEL_V2_VERSION,
} from '../services/market-intelligence-engine-v2';
import {
  simulateScenario, persistScenario, PREDICTIVE_WORKFORCE_V2_VERSION,
} from '../services/predictive-workforce-engine-v2';
import {
  detectDrift, persistDrift, FAIRNESS_MONITORING_V2_VERSION,
} from '../services/fairness-monitoring-engine-v2';
import {
  loadSLAPolicy, evaluateSLA, markBreachedDisputes, DISPUTE_OVERRIDE_V2_VERSION,
} from '../services/dispute-override-engine-v2';
import {
  loadPolicies, decide, RBAC_TENANT_V2_VERSION,
} from '../services/rbac-tenant-engine-v2';
import { userHasPermission } from '../services/rbac-tenant-engine';
import {
  computeAttribution, persistAttribution, LEARNING_ROI_V2_VERSION,
} from '../services/learning-roi-engine-v2';
import { isWorkforceOSV2Enabled } from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = {
  MARKET_INTEL_V2_VERSION,
  PREDICTIVE_WORKFORCE_V2_VERSION,
  FAIRNESS_MONITORING_V2_VERSION,
  DISPUTE_OVERRIDE_V2_VERSION,
  RBAC_TENANT_V2_VERSION,
  LEARNING_ROI_V2_VERSION,
};

const LANGUAGE_POLICY = {
  allowed: ['workforce signal', 'scenario projection', 'drift indicator', 'sla envelope', 'policy decision', 'cohort attribution'],
  disallowed: ['hiring recommendation', 'individual termination prediction', 'pass/fail'],
};

function envelope<T extends object>(payload: T) {
  return {
    ok: true,
    ...payload,
    methodology_versions: VERSIONS,
    language_policy: LANGUAGE_POLICY,
    feature_flag: { workforceOSV2: isWorkforceOSV2Enabled() },
  };
}

function errorEnvelope(error: string, extra: Record<string, unknown> = {}) {
  return {
    ok: false, error, ...extra,
    methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY,
    feature_flag: { workforceOSV2: isWorkforceOSV2Enabled() },
  };
}

function requireFlag(_req: Request, res: Response, next: NextFunction) {
  if (!isWorkforceOSV2Enabled()) return res.status(503).json(errorEnvelope('workforceOSV2 disabled'));
  next();
}

function tenantId(req: Request): number | null {
  const t = (req.query.tenantId ?? req.body?.tenantId);
  if (t == null || t === '') return null;
  const n = Number(t);
  // Gap #3 — reject 0/negative/non-integer. Previously cast silently to a
  // truthy number which could cross-tenant-leak or write to tenant_id=0.
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
}

function userId(req: Request): number | null {
  const u = (req as Request & { user?: { id?: number | string } }).user;
  if (!u || u.id == null) return null;
  const n = typeof u.id === 'string' ? Number.parseInt(u.id, 10) : u.id;
  return Number.isFinite(n) ? (n as number) : null;
}

export function registerWorkforceOsV2Routes(opts: { app: Express; pool: Pool; requireAuth: RequireAuth }) {
  const { app, pool, requireAuth } = opts;

  app.get('/api/wos/v2/feature-flag', (_req, res) => res.json(envelope({})));
  app.get('/api/wos/v2/_meta/versions', (_req, res) => res.json(envelope({})));

  // ── Market intelligence forecast ──────────────────────────────────────
  app.post('/api/wos/v2/market/forecast', requireAuth, requireFlag, async (req, res) => {
    try {
      const signalKey = String(req.body?.signalKey || '').trim();
      const horizon = Number(req.body?.horizonWeeks ?? 12);
      if (!signalKey) return res.status(400).json(errorEnvelope('signalKey required'));
      const tid = tenantId(req);
      const history = Array.isArray(req.body?.history) && req.body.history.length
        ? req.body.history
        : await fetchSignalHistory(pool, signalKey, tid);
      const result = forecastSignal({ signalKey, history, horizonWeeks: horizon });
      persistForecast(pool, tid, result).catch((e) => console.warn('[wos-v2] forecast persist failed:', (e as Error).message));
      res.json(envelope({ forecast: result, history_points: history.length }));
    } catch (e) {
      res.status(500).json(errorEnvelope((e as Error).message));
    }
  });

  // ── Predictive workforce scenario ─────────────────────────────────────
  app.post('/api/wos/v2/predictive/simulate', requireAuth, requireFlag, async (req, res) => {
    try {
      const b = req.body?.baseline;
      const k = req.body?.knobs ?? {};
      if (!b || typeof b.headcount !== 'number') return res.status(400).json(errorEnvelope('baseline.headcount required'));
      const outcome = simulateScenario(
        { headcount: b.headcount, attritionAnnual: Number(b.attritionAnnual ?? 0.12),
          hiringPerQuarter: Number(b.hiringPerQuarter ?? 0), skillCoverage: Number(b.skillCoverage ?? 70) },
        k,
      );
      const tid = tenantId(req);
      const name = String(req.body?.scenarioName || 'unnamed-scenario');
      let scenarioId: string | null = null;
      try {
        scenarioId = await persistScenario(pool, tid, name, { baseline: b, knobs: k }, outcome, userId(req));
      } catch (e) { console.warn('[wos-v2] scenario persist failed:', (e as Error).message); }
      res.json(envelope({ scenario_id: scenarioId, outcome }));
    } catch (e) {
      res.status(500).json(errorEnvelope((e as Error).message));
    }
  });

  // ── Fairness drift ────────────────────────────────────────────────────
  app.post('/api/wos/v2/fairness/drift', requireAuth, requireFlag, async (req, res) => {
    try {
      const metric = String(req.body?.metric || '').trim();
      const baseline = Number(req.body?.baseline ?? NaN);
      const current  = Number(req.body?.current  ?? NaN);
      const baselineN = Number(req.body?.baselineN ?? 0);
      const currentN  = Number(req.body?.currentN  ?? 0);
      if (!metric || !Number.isFinite(baseline) || !Number.isFinite(current)) {
        return res.status(400).json(errorEnvelope('metric + baseline + current required'));
      }
      const result = detectDrift({ metric, baseline, current, baselineN, currentN });
      const tid = tenantId(req);
      const suiteKey = String(req.body?.suiteKey || 'default');
      const groupLabel = String(req.body?.groupLabel || 'overall');
      persistDrift(pool, tid, suiteKey, groupLabel, result)
        .catch((e) => console.warn('[wos-v2] drift persist failed:', (e as Error).message));
      res.json(envelope({ drift: result, suite_key: suiteKey, group_label: groupLabel }));
    } catch (e) {
      res.status(500).json(errorEnvelope((e as Error).message));
    }
  });

  // ── Dispute SLA envelope ──────────────────────────────────────────────
  app.get('/api/wos/v2/dispute/sla/:disputeId', requireAuth, requireFlag, async (req, res) => {
    try {
      const id = String(req.params.disputeId);
      const tid = tenantId(req);
      // Best-effort read of existing Phase 5 wos_disputes (may not exist in all envs).
      let dispute: { id: string; status: string; createdAt: Date } | null = null;
      try {
        const r = await pool.query<{ id: string; status: string; created_at: string }>(
          `SELECT id::text, status, created_at FROM wos_disputes WHERE id::text = $1 LIMIT 1`, [id],
        );
        if (r.rowCount && r.rows[0]) {
          dispute = { id: r.rows[0].id, status: r.rows[0].status, createdAt: new Date(r.rows[0].created_at) };
        }
      } catch { /* table may not exist; fall through */ }
      if (!dispute) return res.status(404).json(errorEnvelope('dispute not found'));
      const policy = await loadSLAPolicy(pool, tid, String(req.query.disputeType ?? 'default'));
      const sla = evaluateSLA(dispute, policy);
      res.json(envelope({ sla, policy }));
    } catch (e) {
      res.status(500).json(errorEnvelope((e as Error).message));
    }
  });

  // ── Gap #2: SLA breach sweeper (RBAC-gated, tenant-scoped) ────────────
  //
  // Hardening per architect review:
  //  - require valid positive tenantId (no null/global sweep)
  //  - require `disputes:resolve` permission on the resolved tenant
  app.post('/api/wos/v2/dispute/sla/sweep', requireAuth, requireFlag, async (req, res) => {
    try {
      const tid = tenantId(req);
      if (!tid) {
        return res.status(400).json(errorEnvelope('tenantId required (positive integer)'));
      }
      const uid = userId(req);
      if (uid == null) return res.status(401).json(errorEnvelope('authentication_required'));
      try {
        const ok = await userHasPermission(pool, String(uid), 'disputes:resolve', tid);
        if (!ok) return res.status(403).json(errorEnvelope('forbidden — disputes:resolve required'));
      } catch (e) {
        return res.status(500).json(errorEnvelope(`rbac_check_failed: ${(e as Error).message}`));
      }
      const disputeType = String(req.body?.disputeType ?? 'default');
      const limit = Number(req.body?.limit ?? 500);
      const result = await markBreachedDisputes(pool, { tenant_id: tid, disputeType, limit });
      res.json(envelope({ sweep: result, tenant_id: tid, swept_at: new Date().toISOString() }));
    } catch (e) {
      res.status(500).json(errorEnvelope((e as Error).message));
    }
  });

  // ── RBAC/ABAC decision ────────────────────────────────────────────────
  app.post('/api/wos/v2/rbac/abac/evaluate', requireAuth, requireFlag, async (req, res) => {
    try {
      const resource = String(req.body?.resource || '').trim();
      const action   = String(req.body?.action   || '').trim();
      const attrs    = (req.body?.attributes ?? {}) as Record<string, unknown>;
      if (!resource || !action) return res.status(400).json(errorEnvelope('resource + action required'));
      const policies = await loadPolicies(pool, tenantId(req), resource, action);
      const decision = decide(policies, attrs);
      res.json(envelope({ resource, action, decision, policy_count: policies.length }));
    } catch (e) {
      res.status(500).json(errorEnvelope((e as Error).message));
    }
  });

  // ── Learning ROI cohort attribution ───────────────────────────────────
  app.post('/api/wos/v2/learning/attribution', requireAuth, requireFlag, async (req, res) => {
    try {
      const interventionKey = String(req.body?.interventionKey || '').trim();
      const cohortLabel     = String(req.body?.cohortLabel     || 'unnamed-cohort');
      const observations    = Array.isArray(req.body?.observations) ? req.body.observations : [];
      if (!interventionKey) return res.status(400).json(errorEnvelope('interventionKey required'));
      const result = computeAttribution({
        interventionKey, cohortLabel, observations,
        baselineDelta: Number(req.body?.baselineDelta ?? 0),
        observationWeeks: Number(req.body?.observationWeeks ?? 12),
      });
      persistAttribution(pool, tenantId(req), result)
        .catch((e) => console.warn('[wos-v2] attribution persist failed:', (e as Error).message));
      res.json(envelope({ attribution: result }));
    } catch (e) {
      res.status(500).json(errorEnvelope((e as Error).message));
    }
  });
}
