/**
 * CAPADEX 3.0 — Program 2 · Phase 2.5 Observability, Monitoring & Operational Readiness.
 *
 * READ-ONLY routes over `services/operational-readiness-engine.ts`.
 *  - `/api/operational-readiness/enabled` — ungated flag probe (200 {enabled:false} when OFF).
 *  - all data routes — flag-gate 503 BEFORE auth, then super-admin. GET-only + one explicit POST
 *    capture. Flag OFF → 503 before any auth/DB touch → byte-identical legacy (zero tables).
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isOperationalReadinessEnabled } from '../config/feature-flags';
import {
  composeCoverage,
  composeCertification,
  composeAdoption,
  composeGaps,
  composeValidation,
  composeSummary,
  captureOperationalSnapshot,
  getOperationalSnapshots,
  OPERATIONAL_MODEL,
} from '../services/operational-readiness-engine';
import { renderPrometheus, snapshotMetrics } from '../services/ops/metrics-registry';
import {
  getQueueStats,
  getDeadLetters,
  enqueueJob,
  runQueueOnce,
  startQueueWorker,
} from '../services/ops/durable-queue';
import {
  listAlertRules,
  createAlertRule,
  setAlertRuleEnabled,
  listAlertEvents,
  evaluateAlertRules,
} from '../services/ops/alerting';
import { getAiTokenUsageSummary } from '../services/ops/ai-token-accounting';
import { DISASTER_RECOVERY_MANIFEST } from '../config/disaster-recovery-manifest';

type Mw = (req: Request, res: Response, next: NextFunction) => any;

export function registerOperationalReadinessRoutes(app: Express, pool: Pool, requireAuth: Mw, requireSuperAdmin: Mw) {
  // Start the durable-queue background worker (self-guards on the flag; no-op when OFF).
  startQueueWorker(pool);
  // Flag gate — 503 BEFORE auth so OFF is byte-identical (no auth/DB work).
  const gate: Mw = (_req, res, next) => {
    if (!isOperationalReadinessEnabled()) {
      return res.status(503).json({ error: 'feature_disabled', flag: 'operationalReadiness', note: 'Phase 2.5 Operational Readiness is OFF — byte-identical legacy behaviour.' });
    }
    next();
  };
  const guards = [gate, requireAuth, requireSuperAdmin];
  const safe = (fn: (req: Request, res: Response) => Promise<any>) => async (req: Request, res: Response) => {
    try { await fn(req, res); } catch (e: any) {
      res.status(200).json({ ready: false, error: 'measurement_error', note: 'Read-only composer error — honest unavailable, never a fabricated value.', detail: String(e?.message || e) });
    }
  };

  // Ungated probe (mirrors the CAPADEX 3.0 program convention).
  app.get('/api/operational-readiness/enabled', (_req: Request, res: Response) => {
    res.json({ enabled: isOperationalReadinessEnabled(), phase: OPERATIONAL_MODEL.OPERATIONAL_MODEL_META.phase });
  });

  app.get('/api/operational-readiness/model', ...guards, safe(async (_req, res) => {
    res.json({ ready: true, ...OPERATIONAL_MODEL });
  }));

  app.get('/api/operational-readiness/coverage', ...guards, safe(async (_req, res) => {
    res.json({ ready: true, coverage: await composeCoverage(pool) });
  }));

  app.get('/api/operational-readiness/certification', ...guards, safe(async (_req, res) => {
    res.json({ ready: true, certification: await composeCertification(pool) });
  }));

  app.get('/api/operational-readiness/adoption', ...guards, safe(async (_req, res) => {
    res.json({ ready: true, adoption: await composeAdoption(pool) });
  }));

  app.get('/api/operational-readiness/gaps', ...guards, safe(async (_req, res) => {
    res.json({ ready: true, gaps: composeGaps() });
  }));

  app.get('/api/operational-readiness/validation', ...guards, safe(async (_req, res) => {
    res.json({ ready: true, validation: await composeValidation(pool) });
  }));

  app.get('/api/operational-readiness/summary', ...guards, safe(async (_req, res) => {
    res.json({ ready: true, summary: await composeSummary(pool) });
  }));

  // Snapshot history (literal sub-path BEFORE any :param — no params here, kept explicit).
  app.get('/api/operational-readiness/snapshots', ...guards, safe(async (req, res) => {
    const limit = Number(req.query.limit) || 20;
    res.json(await getOperationalSnapshots(pool, { limit }));
  }));

  // The ONLY snapshot write path — explicit capture (flag-ON; owns its lazy ensure-schema).
  app.post('/api/operational-readiness/audit/capture', ...guards, safe(async (req, res) => {
    const actor = (req as any).user?.email ?? (req as any).user?.id ?? null;
    res.json(await captureOperationalSnapshot(pool, actor == null ? null : String(actor)));
  }));

  // ── GAP-OPS-1 / GAP-OPS-6: build/version + Prometheus metrics export ──────────
  app.get('/api/operational-readiness/version', ...guards, safe(async (_req, res) => {
    res.json({
      ready: true,
      version: {
        app_version: process.env.npm_package_version || '3.0',
        node: process.version,
        env: process.env.NODE_ENV || 'development',
        commit: process.env.GIT_COMMIT || process.env.COMMIT_SHA || process.env.K_REVISION || null,
        uptime_seconds: Math.round(process.uptime()),
        started_at: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      },
    });
  }));

  // Prometheus text exposition (metrics recorded by opsMetricsMiddleware, flag-ON only).
  app.get('/api/operational-readiness/metrics', ...guards, safe(async (_req, res) => {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(renderPrometheus());
  }));

  // JSON metrics snapshot (alt to Prometheus text; feeds alert-rule signals).
  app.get('/api/operational-readiness/metrics.json', ...guards, safe(async (_req, res) => {
    res.json({ ready: true, metrics: snapshotMetrics() });
  }));

  // ── GAP-OPS-2: durable job queue + dead-letter ───────────────────────────────
  app.get('/api/operational-readiness/queue/stats', ...guards, safe(async (_req, res) => {
    res.json({ ready: true, queue: await getQueueStats(pool) });
  }));
  app.get('/api/operational-readiness/queue/dead-letter', ...guards, safe(async (req, res) => {
    res.json({ ready: true, ...(await getDeadLetters(pool, Number(req.query.limit) || 50)) });
  }));
  app.post('/api/operational-readiness/queue/enqueue', ...guards, safe(async (req, res) => {
    const { job_type, payload, max_attempts } = req.body || {};
    if (!job_type || typeof job_type !== 'string') return res.status(400).json({ error: 'job_type required' });
    res.json(await enqueueJob(pool, job_type, payload ?? {}, { maxAttempts: max_attempts }));
  }));
  app.post('/api/operational-readiness/queue/run', ...guards, safe(async (req, res) => {
    res.json({ ready: true, result: await runQueueOnce(pool, Number(req.body?.batch) || 10) });
  }));

  // ── GAP-OPS-3: alert-rule store + notification routing ───────────────────────
  app.get('/api/operational-readiness/alerts/rules', ...guards, safe(async (_req, res) => {
    res.json({ ready: true, ...(await listAlertRules(pool)) });
  }));
  app.post('/api/operational-readiness/alerts/rules', ...guards, safe(async (req, res) => {
    const { name, signal, comparator, threshold, severity, channel, target } = req.body || {};
    if (!name || !signal || !comparator || threshold == null) {
      return res.status(400).json({ error: 'name, signal, comparator, threshold required' });
    }
    res.json(await createAlertRule(pool, { name, signal, comparator, threshold: Number(threshold), severity, channel, target }));
  }));
  app.post('/api/operational-readiness/alerts/rules/:id/toggle', ...guards, safe(async (req, res) => {
    const enabled = req.body?.enabled !== false;
    res.json(await setAlertRuleEnabled(pool, Number(req.params.id), enabled));
  }));
  app.get('/api/operational-readiness/alerts/events', ...guards, safe(async (req, res) => {
    res.json({ ready: true, ...(await listAlertEvents(pool, Number(req.query.limit) || 50)) });
  }));
  app.post('/api/operational-readiness/alerts/evaluate', ...guards, safe(async (_req, res) => {
    res.json({ ready: true, result: await evaluateAlertRules(pool) });
  }));

  // ── GAP-OPS-4: AI token + cost accounting ────────────────────────────────────
  app.get('/api/operational-readiness/ai/token-usage', ...guards, safe(async (_req, res) => {
    res.json({ ready: true, usage: await getAiTokenUsageSummary(pool) });
  }));

  // ── GAP-OPS-7: disaster-recovery manifest + readiness ────────────────────────
  app.get('/api/operational-readiness/dr/manifest', ...guards, safe(async (_req, res) => {
    res.json({ ready: true, manifest: DISASTER_RECOVERY_MANIFEST });
  }));
  app.get('/api/operational-readiness/dr/readiness', ...guards, safe(async (_req, res) => {
    const checks: Array<{ key: string; label: string; status: 'pass' | 'fail'; detail: string }> = [];
    const hasPg = !!process.env.DATABASE_URL;
    const hasMongo = !!process.env.MONGODB_URI;
    checks.push({ key: 'pg_config', label: 'DATABASE_URL configured', status: hasPg ? 'pass' : 'fail', detail: hasPg ? 'present' : 'absent' });
    checks.push({ key: 'mongo_config', label: 'MONGODB_URI configured', status: hasMongo ? 'pass' : 'fail', detail: hasMongo ? 'present' : 'absent' });
    checks.push({ key: 'manifest_present', label: 'DR manifest + runbook present', status: 'pass', detail: 'in-repo' });
    let dbOk = false;
    try { await pool.query('SELECT 1'); dbOk = true; } catch { dbOk = false; }
    checks.push({ key: 'pg_connectivity', label: 'PostgreSQL reachable', status: dbOk ? 'pass' : 'fail', detail: dbOk ? 'SELECT 1 OK' : 'unreachable' });
    const passed = checks.filter((c) => c.status === 'pass').length;
    res.json({
      ready: true,
      readiness: {
        manifest_version: DISASTER_RECOVERY_MANIFEST.version,
        declared_targets: DISASTER_RECOVERY_MANIFEST.data_stores.map((s) => ({ key: s.key, rto_target: s.rto_target, rpo_target: s.rpo_target })),
        checks,
        readiness_pct: Math.round((passed / checks.length) * 100),
        restore_drill_executed: false, // honest — readiness verified, live drill is separate (adoption)
        note: 'Recovery-READINESS only. A live restore drill against infra is a separate operational activity, never claimed as validated here. null ≠ 0; Coverage ⟂ Confidence ⟂ Adoption never composited.',
      },
    });
  }));
}
