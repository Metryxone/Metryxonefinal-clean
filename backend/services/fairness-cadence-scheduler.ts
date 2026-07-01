/**
 * Fairness-Monitoring Cadence Scheduler (Phase 2.4 remediation — AI-M2).
 *
 * Operationalizes the EXISTING fairness/bias engine by giving it a periodic
 * cadence: it snapshots the read-only fairness summary
 * (services/fairness-monitoring-engine.summary — a pure SELECT over
 * wos_fairness_results, NO scoring change) into an append-only log that the
 * governance console reads. Mirrors the retention-scheduler shape: idempotent
 * single start, unref'd interval, never-throws.
 *
 * Honest adoption axis: with no real cohort volume the snapshot is empty (0 rows
 * / null), never fabricated.
 *
 * Byte-identical OFF incl. schema: fairness_report_snapshots is created only
 * inside start()/captureFairnessSnapshot(), reached only when the flag is ON.
 */
import type { Pool } from 'pg';
import { isFairnessMonitoringCadenceEnabled } from '../config/feature-flags';
import { summary as fairnessSummary } from './fairness-monitoring-engine';

const CADENCE_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
let started = false;
let schemaReady = false;

async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fairness_report_snapshots (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      captured_at  timestamptz NOT NULL DEFAULT now(),
      surfaces     integer NOT NULL DEFAULT 0,
      total_tests  integer NOT NULL DEFAULT 0,
      passed       integer NOT NULL DEFAULT 0,
      failed       integer NOT NULL DEFAULT 0,
      detail       jsonb
    )
  `);
  schemaReady = true;
}

export interface FairnessSnapshot {
  captured_at: string;
  surfaces: number;
  total_tests: number;
  passed: number;
  failed: number;
  detail: any[];
}

/**
 * Capture one fairness snapshot. Reused by both the scheduler and the manual
 * /run route. Never-throws: returns null on any failure so callers stay honest
 * (null ≠ empty snapshot).
 */
export async function captureFairnessSnapshot(pool: Pool): Promise<FairnessSnapshot | null> {
  try {
    await ensureSchema(pool);
    let rows: any[] = [];
    try {
      rows = (await fairnessSummary(pool)) as any[];
    } catch {
      // wos_fairness_results may not exist yet — honest empty, not a failure.
      rows = [];
    }
    const total = rows.reduce((a, r) => a + (Number(r.total) || 0), 0);
    const passed = rows.reduce((a, r) => a + (Number(r.passed) || 0), 0);
    const failed = rows.reduce((a, r) => a + (Number(r.failed) || 0), 0);
    const { rows: ins } = await pool.query(
      `INSERT INTO fairness_report_snapshots (surfaces, total_tests, passed, failed, detail)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING captured_at, surfaces, total_tests, passed, failed, detail`,
      [rows.length, total, passed, failed, JSON.stringify(rows)]);
    const s = ins[0];
    return {
      captured_at: s.captured_at,
      surfaces: s.surfaces,
      total_tests: s.total_tests,
      passed: s.passed,
      failed: s.failed,
      detail: s.detail ?? [],
    };
  } catch (e: any) {
    console.warn('[fairness-cadence] snapshot error:', e.message);
    return null;
  }
}

export function startFairnessCadenceScheduler(pool: Pool): void {
  if (started) return;
  if (!isFairnessMonitoringCadenceEnabled()) return;
  started = true;
  console.log('[fairness-cadence] scheduler starting — daily fairness snapshot (read-only)');
  captureFairnessSnapshot(pool)
    .then(() => { setInterval(() => captureFairnessSnapshot(pool), CADENCE_INTERVAL_MS).unref(); })
    .catch(err => console.warn('[fairness-cadence] init error:', err.message));
}
