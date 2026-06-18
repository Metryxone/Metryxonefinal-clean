/**
 * Market Intelligence — Phase 5
 *
 * Reads from `market_demand_models`. Strictly evidence-backed; every value
 * carries its source_authority + dataset_version + snapshot_date.
 */

import type { Pool } from 'pg';

export interface MarketDemand {
  occupation_id:          string;
  region:                 string;
  demand_score:           number;        // 0..100
  salary_min:             number | null;
  salary_max:             number | null;
  salary_currency:        string;
  salary_period:          string;
  future_relevance_score: number;
  automation_risk_score:  number;
  hiring_trend:           'rising' | 'stable' | 'declining' | 'volatile';
  source_authority:       string | null;
  source_url:             string | null;
  evidence_ref:           Record<string, unknown>;
  dataset_version:        string;
  snapshot_date:          string;
}

export async function getMarketDemand(
  pool: Pool, occupationId: string, region = 'IN',
): Promise<MarketDemand | null> {
  const r = await pool.query(
    `SELECT occupation_id, region,
            demand_score::float, salary_min::float, salary_max::float,
            salary_currency, salary_period,
            future_relevance_score::float, automation_risk_score::float,
            hiring_trend, source_authority, source_url, evidence_ref,
            dataset_version, snapshot_date::text
       FROM market_demand_models
      WHERE is_active AND occupation_id=$1 AND region=$2
      ORDER BY snapshot_date DESC LIMIT 1`,
    [occupationId, region],
  );
  return r.rows[0] || null;
}

export async function listMarketDemands(pool: Pool, region = 'IN', limit = 50) {
  const r = await pool.query(
    `SELECT DISTINCT ON (m.occupation_id)
            m.occupation_id, o.canonical_title, o.role_family, o.seniority_level,
            m.region, m.demand_score::float, m.salary_min::float, m.salary_max::float,
            m.salary_currency, m.future_relevance_score::float,
            m.automation_risk_score::float, m.hiring_trend,
            m.source_authority, m.dataset_version, m.snapshot_date::text
       FROM market_demand_models m
       JOIN occupations o ON o.id = m.occupation_id
      WHERE m.is_active AND m.region=$1
      ORDER BY m.occupation_id, m.snapshot_date DESC
      LIMIT ${Math.min(limit, 500)}`,
    [region],
  );
  return r.rows;
}
