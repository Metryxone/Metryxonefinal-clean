import type { Pool } from 'pg';

export const ORG_BENCHMARK_VERSION = '5.0.0';

export function createOrgBenchmark(pool: Pool) {
  async function orgBenchmarks(orgId: string, peerCohort?: string) {
    const sql = peerCohort
      ? `SELECT * FROM m5_organizational_benchmarks WHERE org_id=$1 AND peer_cohort=$2 ORDER BY metric`
      : `SELECT * FROM m5_organizational_benchmarks WHERE org_id=$1 ORDER BY metric`;
    const args = peerCohort ? [orgId, peerCohort] : [orgId];
    const r = await pool.query(sql, args);
    return r.rows;
  }

  async function industryBenchmarks(industry?: string) {
    const sql = industry
      ? `SELECT * FROM m5_industry_workforce_benchmarks WHERE industry=$1 ORDER BY metric`
      : `SELECT * FROM m5_industry_workforce_benchmarks ORDER BY industry, metric`;
    const args = industry ? [industry] : [];
    const r = await pool.query(sql, args);
    return r.rows;
  }

  async function leadershipBenchmarks(industry?: string) {
    const sql = industry
      ? `SELECT * FROM m5_leadership_benchmarks WHERE industry=$1 ORDER BY layer`
      : `SELECT * FROM m5_leadership_benchmarks ORDER BY industry, layer`;
    const args = industry ? [industry] : [];
    const r = await pool.query(sql, args);
    return r.rows;
  }

  async function maturityBenchmarks(industry?: string) {
    const sql = industry
      ? `SELECT * FROM m5_enterprise_maturity_benchmarks WHERE industry=$1`
      : `SELECT * FROM m5_enterprise_maturity_benchmarks`;
    const args = industry ? [industry] : [];
    const r = await pool.query(sql, args);
    return r.rows;
  }

  return { orgBenchmarks, industryBenchmarks, leadershipBenchmarks, maturityBenchmarks };
}
