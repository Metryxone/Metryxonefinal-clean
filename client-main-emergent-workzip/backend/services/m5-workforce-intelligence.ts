import type { Pool } from 'pg';

export const WORKFORCE_INTELLIGENCE_VERSION = '5.0.0';
export const ECI_VERSION = '5.0.0';

const newId = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36).slice(-4)}`;
const clip = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const safeAvg = (xs: number[]) => xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

export function createWorkforceIntelligence(pool: Pool) {
  async function capabilities(orgId: string) {
    const r = await pool.query(
      `SELECT * FROM m5_organizational_capabilities WHERE org_id=$1 ORDER BY criticality DESC, capability_name`,
      [orgId]);
    return r.rows;
  }

  async function heatmap(orgId: string) {
    const r = await pool.query(
      `SELECT department, competency_id, intensity, risk_tier
       FROM m5_workforce_capability_heatmaps WHERE org_id=$1
       ORDER BY department, competency_id`, [orgId]);
    return r.rows;
  }

  async function maturity(orgId: string) {
    const caps = (await capabilities(orgId)).map(c => +c.current_level);
    const score = safeAvg(caps);
    const level = score >= 80 ? 5 : score >= 65 ? 4 : score >= 50 ? 3 : score >= 35 ? 2 : 1;
    return {
      org_id: orgId,
      maturity_score: +score.toFixed(2),
      maturity_level: level,
      n_capabilities: caps.length,
    };
  }

  async function skillGaps(orgId: string) {
    const r = await pool.query(
      `SELECT * FROM m5_organizational_skill_gaps WHERE org_id=$1 ORDER BY gap DESC`,
      [orgId]);
    return r.rows;
  }

  async function departments(orgId: string) {
    const r = await pool.query(
      `SELECT * FROM m5_department_capability_scores WHERE org_id=$1 ORDER BY capability_score DESC`,
      [orgId]);
    return r.rows;
  }

  async function readiness(orgId: string) {
    const depts = await departments(orgId);
    if (!depts.length) return { org_id: orgId, readiness_score: 0, departments: [] };
    const avg = safeAvg(depts.map((d: any) => +d.readiness_score));
    const variance = safeAvg(depts.map((d: any) => Math.pow(+d.readiness_score - avg, 2)));
    const sd = Math.sqrt(variance);
    return {
      org_id: orgId,
      readiness_score: +avg.toFixed(2),
      band_low: +clip(avg - sd, 0, 100).toFixed(2),
      band_high: +clip(avg + sd, 0, 100).toFixed(2),
      consistency: +clip(1 - sd / 50, 0, 1).toFixed(3),
      departments: depts,
    };
  }

  async function enterpriseIndices(orgId: string) {
    const r = await pool.query(
      `SELECT * FROM m5_enterprise_capability_indices WHERE org_id=$1 ORDER BY index_type`,
      [orgId]);
    if (!r.rows.length) return { org_id: orgId, indices: [], composite: 0 };
    const composite = +safeAvg(r.rows.map((x: any) => +x.index_value)).toFixed(2);
    return { org_id: orgId, indices: r.rows, composite };
  }

  // Enterprise Capability Index = avg(workforce, leadership, future_readiness, agility, resilience)
  async function computeECI(orgId: string) {
    const idx = await enterpriseIndices(orgId);
    return {
      org_id: orgId,
      enterprise_capability_index: idx.composite,
      contributors: Object.fromEntries(idx.indices.map((x: any) => [x.index_type, +x.index_value])),
      version: ECI_VERSION,
    };
  }

  return { capabilities, heatmap, maturity, skillGaps, departments, readiness, enterpriseIndices, computeECI };
}

export type WorkforceIntelligence = ReturnType<typeof createWorkforceIntelligence>;
