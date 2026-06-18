import type { Pool } from 'pg';

export const SUCCESSION_VERSION = '5.0.0';

const clip = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const safeAvg = (xs: number[]) => xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

// Succession Readiness = w1·LC + w2·SR + w3·MA + w4·FP, modulated by reliability_confidence
export function computeSuccessionReadiness(c: {
  leadership_capability: number;
  strategic_readiness: number;
  mobility_alignment: number;
  future_potential: number;
  reliability_confidence: number;
}) {
  const raw = 0.30 * c.leadership_capability
            + 0.25 * c.strategic_readiness
            + 0.20 * c.mobility_alignment
            + 0.25 * c.future_potential;
  const modulated = raw * clip(0.7 + 0.3 * c.reliability_confidence, 0.7, 1.0);
  const score = +clip(modulated, 0, 100).toFixed(2);
  const band = score >= 80 ? 'ready_now'
             : score >= 65 ? 'ready_12m'
             : score >= 50 ? 'ready_24m'
             : 'developing';
  const timeToReady = band === 'ready_now' ? 0 : band === 'ready_12m' ? 12 : band === 'ready_24m' ? 24 : 36;
  return { readiness_score: score, readiness_band: band, time_to_ready_months: timeToReady };
}

export function createSuccessionEngine(pool: Pool) {
  async function candidates(orgId: string, targetRoleId?: string) {
    const sql = targetRoleId
      ? `SELECT * FROM m5_succession_candidates WHERE org_id=$1 AND target_role_id=$2`
      : `SELECT * FROM m5_succession_candidates WHERE org_id=$1`;
    const args: any[] = targetRoleId ? [orgId, targetRoleId] : [orgId];
    const r = await pool.query(sql, args);
    return r.rows.map((c: any) => ({
      ...c,
      ...computeSuccessionReadiness({
        leadership_capability: +c.leadership_capability,
        strategic_readiness: +c.strategic_readiness,
        mobility_alignment: +c.mobility_alignment,
        future_potential: +c.future_potential,
        reliability_confidence: +c.reliability_confidence,
      }),
    })).sort((a: any, b: any) => b.readiness_score - a.readiness_score);
  }

  async function criticalRoles(orgId: string) {
    const r = await pool.query(
      `SELECT * FROM m5_critical_role_successors WHERE org_id=$1 ORDER BY criticality DESC, successor_count ASC`,
      [orgId]);
    return r.rows;
  }

  async function leadershipGapRisks(orgId: string) {
    const r = await pool.query(
      `SELECT * FROM m5_leadership_gap_risks WHERE org_id=$1 ORDER BY layer`, [orgId]);
    return r.rows;
  }

  async function benchStrength(orgId: string) {
    const r = await pool.query(
      `SELECT * FROM m5_bench_strength_scores WHERE org_id=$1 ORDER BY layer`, [orgId]);
    return r.rows;
  }

  async function successionSummary(orgId: string) {
    const [cands, crit, gaps, bench] = await Promise.all([
      candidates(orgId), criticalRoles(orgId), leadershipGapRisks(orgId), benchStrength(orgId),
    ]);
    const readyNow = cands.filter((c: any) => c.readiness_band === 'ready_now').length;
    const ready12m = cands.filter((c: any) => c.readiness_band === 'ready_12m').length;
    const avgBench = +safeAvg(bench.map((b: any) => +b.strength_score)).toFixed(2);
    return {
      org_id: orgId,
      total_candidates: cands.length,
      ready_now: readyNow,
      ready_12m: ready12m,
      avg_bench_strength: avgBench,
      critical_roles: crit,
      gap_risks: gaps,
      bench_strength: bench,
      top_candidates: cands.slice(0, 10),
    };
  }

  return { candidates, criticalRoles, leadershipGapRisks, benchStrength, successionSummary };
}
