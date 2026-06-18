/**
 * Phase 4 — Organizational Risk Intelligence (v4.0.0)
 *
 *   capability_risk = clip(100 − coverage_pct,  0..100)   modulated by velocity
 *   succession_risk = 100 − (ready_now·40 + ready_12m·30 + ready_24m·20)/successors_n
 *   workforce_resilience = 0.40·redundancy + 0.35·mobility + 0.25·learning_velocity
 *
 * Pure reads from precomputed m4_organizational_capability_risks / m4_succession_risk_scores
 * + recompute helpers for ad-hoc cohorts.
 */
import type { Pool } from 'pg';

export const ORG_RISK_VERSION = '4.0.0';

const clip = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

export function createOrgRisk(pool: Pool) {
  async function capabilityRisks(orgUnit?: string) {
    return (await pool.query(
      orgUnit
        ? `SELECT * FROM m4_organizational_capability_risks WHERE org_unit = $1 ORDER BY risk DESC`
        : `SELECT * FROM m4_organizational_capability_risks ORDER BY risk DESC`,
      orgUnit ? [orgUnit] : [])).rows;
  }

  async function succession(roleId?: string) {
    return (await pool.query(
      roleId
        ? `SELECT * FROM m4_succession_risk_scores WHERE role_id = $1`
        : `SELECT * FROM m4_succession_risk_scores ORDER BY risk DESC`,
      roleId ? [roleId] : [])).rows;
  }

  async function leadershipGaps(orgUnit?: string) {
    return (await pool.query(
      orgUnit
        ? `SELECT * FROM m4_leadership_gap_predictions WHERE org_unit = $1 ORDER BY horizon_months`
        : `SELECT * FROM m4_leadership_gap_predictions ORDER BY org_unit, horizon_months`,
      orgUnit ? [orgUnit] : [])).rows;
  }

  async function resilience(orgUnit?: string) {
    return (await pool.query(
      orgUnit
        ? `SELECT * FROM m4_workforce_resilience_scores WHERE org_unit = $1`
        : `SELECT * FROM m4_workforce_resilience_scores ORDER BY resilience DESC`,
      orgUnit ? [orgUnit] : [])).rows;
  }

  async function criticalRisks() {
    return (await pool.query(`SELECT * FROM m4_critical_capability_risks ORDER BY risk DESC`)).rows;
  }

  /** Pure helpers (no DB) — exposed for ad-hoc computation. */
  function computeCapabilityRisk(coveragePct: number, velocity = 0.5): number {
    const base = 100 - clip(coveragePct, 0, 100);
    const velocityAdj = velocity < 0 ? 15 : velocity < 0.3 ? 8 : 0;
    return +clip(base + velocityAdj).toFixed(2);
  }

  function computeSuccessionRisk(args: { successors_n: number; ready_now: number; ready_12m: number; ready_24m: number }): number {
    const n = Math.max(1, args.successors_n);
    const coverage = (args.ready_now * 40 + args.ready_12m * 30 + args.ready_24m * 20) / n;
    return +clip(100 - coverage).toFixed(2);
  }

  function computeResilience(args: { redundancy: number; mobility: number; learning_velocity: number }): number {
    const r = 0.40 * args.redundancy + 0.35 * args.mobility + 0.25 * args.learning_velocity;
    return +clip(r * 100).toFixed(2);
  }

  return {
    capabilityRisks, succession, leadershipGaps, resilience, criticalRisks,
    computeCapabilityRisk, computeSuccessionRisk, computeResilience,
  };
}
