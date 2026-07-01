/**
 * AI-Trust surfaces — Phase 2.4 remediation (AI-M2).
 *
 * Read-only governance-console view over the fairness-monitoring CADENCE:
 *   GET  /api/ai-trust/fairness/enabled   flag probe (ungated)
 *   GET  /api/ai-trust/fairness/reports   super-admin: latest + history + live current summary
 *   POST /api/ai-trust/fairness/run       super-admin: force one snapshot now
 *
 * No scoring change — every read composes the EXISTING fairness engine's read-only
 * summary. Byte-identical OFF incl. schema: data routes 503 before any work/auth/DDL
 * when the flag is OFF; fairness_report_snapshots is created only on a flag-ON hit.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFairnessMonitoringCadenceEnabled } from '../config/feature-flags';
import { captureFairnessSnapshot } from '../services/fairness-cadence-scheduler';
import { summary as fairnessSummary } from '../services/fairness-monitoring-engine';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFairnessMonitoringCadenceEnabled()) {
    return res.status(503).json({ error: 'fairness_monitoring_cadence_disabled' });
  }
  next();
}

export function registerAiTrustRoutes(app: Express, pool: Pool, requireAuth: Mw, requireSuperAdmin: Mw): void {
  app.get('/api/ai-trust/fairness/enabled', (_req, res) => {
    res.json({ enabled: isFairnessMonitoringCadenceEnabled() });
  });

  app.get('/api/ai-trust/fairness/reports', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      // Live current summary (honest empty when no fairness volume yet).
      let current: any[] = [];
      try { current = (await fairnessSummary(pool)) as any[]; } catch { current = []; }

      // Snapshot history (table may not exist yet on a cold flag-ON → honest empty).
      let history: any[] = [];
      try {
        const { rows } = await pool.query(
          `SELECT id, captured_at, surfaces, total_tests, passed, failed
             FROM fairness_report_snapshots
            ORDER BY captured_at DESC LIMIT 90`);
        history = rows;
      } catch { history = []; }

      res.json({
        current_summary: current,
        latest_snapshot: history[0] ?? null,
        history,
        cadence: 'daily',
        note: 'Read-only fairness posture. null/empty = no measured cohort volume yet (adoption axis, never fabricated).',
      });
    } catch (e: any) {
      res.status(500).json({ error: 'fairness_reports_failed', detail: e.message });
    }
  });

  app.post('/api/ai-trust/fairness/run', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    const snap = await captureFairnessSnapshot(pool);
    if (!snap) return res.status(500).json({ error: 'snapshot_failed' });
    res.status(201).json({ snapshot: snap });
  });
}
