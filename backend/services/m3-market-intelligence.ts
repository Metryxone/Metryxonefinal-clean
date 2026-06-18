/**
 * Phase 3 — Market Intelligence Engine (v3.0.0)
 * Read/aggregate over m3_market_* tables. No destructive writes to onto_* / sci_* / bench_*.
 */
import type { Pool } from 'pg';
export const MARKET_INTELLIGENCE_VERSION = '3.0.0';

const cache = new Map<string, { at: number; value: any }>();
const TTL = 60_000;
function memo<T>(k: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.value);
  return fn().then(v => { cache.set(k, { at: Date.now(), value: v }); return v; });
}

export function createMarketIntelligence(pool: Pool) {
  const listSources = () => memo('mi:sources', async () => (await pool.query(
    `SELECT * FROM m3_source_registry ORDER BY trust_score DESC`)).rows);

  const listMarketRoles = (limit = 50) => memo(`mi:roles:${limit}`, async () => (await pool.query(
    `SELECT r.*, s.name AS source_name FROM m3_market_roles r
     LEFT JOIN m3_source_registry s ON s.id = r.source_id
     ORDER BY observed_count DESC LIMIT $1`, [limit])).rows);

  const listMarketCompetencies = () => memo('mi:comps', async () => (await pool.query(
    `SELECT mc.*, sd.posting_count, sd.growth_rate, sd.demand_score
     FROM m3_market_competencies mc
     LEFT JOIN m3_skill_demand sd ON sd.market_competency_id = mc.id AND sd.geo = 'GLOBAL'
     ORDER BY sd.demand_score DESC NULLS LAST`)).rows);

  const skillDemand = async (geo = 'GLOBAL') => (await pool.query(
    `SELECT sd.*, mc.market_skill, mc.ontology_competency_id, mc.emerging
     FROM m3_skill_demand sd
     JOIN m3_market_competencies mc ON mc.id = sd.market_competency_id
     WHERE sd.geo = $1
     ORDER BY sd.demand_score DESC`, [geo])).rows;

  const salaryTrends = async (geo?: string) => (await pool.query(
    `SELECT st.*, mr.market_title FROM m3_salary_trends st
     JOIN m3_market_roles mr ON mr.id = st.market_role_id
     ${geo ? 'WHERE st.geo = $1' : ''}
     ORDER BY st.p50 DESC`, geo ? [geo] : [])).rows;

  const roleTrends = async () => (await pool.query(
    `SELECT rt.*, mr.market_title FROM m3_role_trends rt
     JOIN m3_market_roles mr ON mr.id = rt.market_role_id
     ORDER BY rt.hiring_velocity DESC`)).rows;

  const emergingCompetencies = async () => (await pool.query(
    `SELECT ec.*, mc.market_skill, mc.ontology_competency_id
     FROM m3_emerging_competencies ec
     JOIN m3_market_competencies mc ON mc.id = ec.market_competency_id
     ORDER BY ec.emergence_score DESC`)).rows;

  const industryDemand = async () => (await pool.query(
    `SELECT * FROM m3_industry_demand ORDER BY growth_score DESC`)).rows;

  const geographyDemand = async () => (await pool.query(
    `SELECT * FROM m3_geography_demand ORDER BY demand_score DESC`)).rows;

  /** Ingest a single raw posting (used by /ingest endpoint). */
  async function ingestPosting(input: {
    raw_title: string; raw_skills?: string[]; industry?: string; geo?: string; source_code: string;
  }) {
    const { rows: src } = await pool.query(
      `SELECT id FROM m3_source_registry WHERE source_code = $1`, [input.source_code]);
    if (!src[0]) throw new Error('unknown source_code');
    const sourceId = src[0].id;
    // Try to resolve to a known alias/title; else log into m3_emerging_role_candidates
    const { rows: alias } = await pool.query(
      `SELECT mra.market_role_id, mra.similarity FROM m3_market_role_aliases mra
       WHERE LOWER(mra.alias_title) = LOWER($1) LIMIT 1`, [input.raw_title]);
    const { rows: exact } = await pool.query(
      `SELECT id FROM m3_market_roles WHERE LOWER(market_title) = LOWER($1) LIMIT 1`, [input.raw_title]);
    const matched = exact[0]?.id ?? alias[0]?.market_role_id ?? null;
    let candidateId: string | null = null;
    if (!matched) {
      candidateId = `merc_${Date.now().toString(36)}`;
      await pool.query(
        `INSERT INTO m3_emerging_role_candidates(id, raw_title, observed_count, distinct_aliases, emergence_score, status)
         VALUES ($1,$2,1,1,55,'candidate')
         ON CONFLICT (id) DO NOTHING`, [candidateId, input.raw_title]);
    } else {
      await pool.query(
        `UPDATE m3_market_roles SET observed_count = observed_count + 1, last_seen = now() WHERE id = $1`, [matched]);
    }
    return { matched_market_role_id: matched, candidate_id: candidateId, source_id: sourceId };
  }

  return {
    listSources, listMarketRoles, listMarketCompetencies, skillDemand, salaryTrends,
    roleTrends, emergingCompetencies, industryDemand, geographyDemand, ingestPosting,
  };
}
