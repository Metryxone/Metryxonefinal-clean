/**
 * CAPADEX Simulation & Validation Environment — admin routes (0C).
 *
 * All routes are gated by the static `simulationHarness` flag (default OFF) and
 * require SuperAdmin. Flag-off → 503 + the dashboard panel renders a disabled
 * notice. The harness drives the real CAPADEX pipeline (see simulation-engine)
 * and persists each run for the Quality Monitoring layer.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import { runSimulation } from '../services/simulation/simulation-engine';
import { PERSONAS } from '../services/simulation/persona-library';
import { TARGETS } from '../services/simulation/validation-framework';

let schemaReady: Promise<void> | null = null;

async function ensureSimulationSchema(pool: Pool): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS capadex_simulation_runs (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
          profile_count   INTEGER     NOT NULL DEFAULT 0,
          sample_size     INTEGER     NOT NULL DEFAULT 0,
          seed            BIGINT      NOT NULL DEFAULT 0,
          duration_ms     INTEGER     NOT NULL DEFAULT 0,
          verdict         TEXT        NOT NULL DEFAULT 'pass',
          metrics         JSONB       NOT NULL DEFAULT '{}'::jsonb,
          conditions      JSONB       NOT NULL DEFAULT '[]'::jsonb,
          per_persona     JSONB       NOT NULL DEFAULT '{}'::jsonb,
          failed_conditions JSONB     NOT NULL DEFAULT '[]'::jsonb,
          trigger_reason  TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_capadex_simulation_runs_created
          ON capadex_simulation_runs (created_at DESC);
      `);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

function flagGate(req: Request, res: Response): boolean {
  if (!isFlagEnabled('simulationHarness')) {
    res.status(503).json({ error: 'feature_disabled', flag: 'simulationHarness' });
    return false;
  }
  return true;
}

export function registerSimulationRoutes(
  app: Express,
  pool: Pool,
  requireAuth: any,
  requireSuperAdmin: any,
): void {
  // Flag state + targets + persona library — drives the dashboard shell. Always
  // available to SuperAdmin so the UI can decide whether to show the panel.
  app.get('/api/admin/simulation/config', requireAuth, requireSuperAdmin, (_req: Request, res: Response) => {
    res.json({
      enabled: isFlagEnabled('simulationHarness'),
      targets: TARGETS,
      personas: PERSONAS.map((p) => ({
        key: p.key,
        label: p.label,
        role: p.role,
        concern: p.concern,
        track: p.track,
        ageBand: p.ageBand,
      })),
    });
  });

  app.get('/api/admin/simulation/personas', requireAuth, requireSuperAdmin, (req: Request, res: Response) => {
    if (!flagGate(req, res)) return;
    res.json({ personas: PERSONAS });
  });

  // Trigger a simulation run. Body: { profileCount?, sampleSize?, seed?, cleanup?, settleMs?, reason? }
  app.post('/api/admin/simulation/run', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!flagGate(req, res)) return;
    try {
      await ensureSimulationSchema(pool);
      const b = req.body || {};
      const result = await runSimulation(pool, {
        profileCount: b.profileCount != null ? Number(b.profileCount) : undefined,
        sampleSize: b.sampleSize != null ? Number(b.sampleSize) : undefined,
        seed: b.seed != null ? Number(b.seed) : undefined,
        // Cleanup is NOT client-controllable — the zero-impact contract requires
        // every run to purge its sim sessions, regardless of request body.
        cleanup: true,
        settleMs: b.settleMs != null ? Number(b.settleMs) : undefined,
      });

      const ins = await pool.query(
        `INSERT INTO capadex_simulation_runs
           (profile_count, sample_size, seed, duration_ms, verdict, metrics, conditions, per_persona, failed_conditions, trigger_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id, created_at`,
        [
          result.profileCount,
          result.sampleSize,
          result.seed,
          result.durationMs,
          result.validation.verdict,
          JSON.stringify(result.metrics),
          JSON.stringify(result.validation.conditions),
          JSON.stringify(result.perPersona),
          JSON.stringify(result.validation.failedConditions),
          typeof b.reason === 'string' ? b.reason.slice(0, 200) : null,
        ],
      );

      res.json({
        ok: true,
        id: ins.rows[0]?.id,
        created_at: ins.rows[0]?.created_at,
        verdict: result.validation.verdict,
        metrics: result.metrics,
        validation: result.validation,
        perPersona: result.perPersona,
        profileCount: result.profileCount,
        sampleSize: result.sampleSize,
        seed: result.seed,
        durationMs: result.durationMs,
      });
    } catch (err: any) {
      console.error('[simulation] run error:', err);
      res.status(500).json({ error: 'simulation_failed', message: String(err?.message || err).slice(0, 300) });
    }
  });

  // Run history (summaries).
  app.get('/api/admin/simulation/runs', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!flagGate(req, res)) return;
    try {
      await ensureSimulationSchema(pool);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
      const rows = await pool.query(
        `SELECT id, created_at, profile_count, sample_size, seed, duration_ms, verdict,
                metrics, failed_conditions, trigger_reason
           FROM capadex_simulation_runs
          ORDER BY created_at DESC
          LIMIT $1`,
        [limit],
      );
      res.json({ runs: rows.rows });
    } catch (err: any) {
      res.status(500).json({ error: 'query_failed', message: String(err?.message || err).slice(0, 200) });
    }
  });

  app.get('/api/admin/simulation/latest', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!flagGate(req, res)) return;
    try {
      await ensureSimulationSchema(pool);
      const rows = await pool.query(
        `SELECT * FROM capadex_simulation_runs ORDER BY created_at DESC LIMIT 1`,
      );
      res.json({ run: rows.rows[0] || null });
    } catch (err: any) {
      res.status(500).json({ error: 'query_failed', message: String(err?.message || err).slice(0, 200) });
    }
  });

  app.get('/api/admin/simulation/runs/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!flagGate(req, res)) return;
    try {
      await ensureSimulationSchema(pool);
      const rows = await pool.query(`SELECT * FROM capadex_simulation_runs WHERE id = $1`, [req.params.id]);
      if (!rows.rows[0]) return res.status(404).json({ error: 'not_found' });
      res.json({ run: rows.rows[0] });
    } catch (err: any) {
      res.status(500).json({ error: 'query_failed', message: String(err?.message || err).slice(0, 200) });
    }
  });
}
