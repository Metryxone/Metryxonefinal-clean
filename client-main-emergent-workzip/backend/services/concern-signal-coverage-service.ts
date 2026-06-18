/**
 * CAPADEX Concern → Signal coverage service (Task #16, step 6).
 *
 * **Strictly read-only.** Aggregates the persisted `capadex_concern_signal_map`
 * (joined to the Concerns Master for labels) into the figures the SuperAdmin
 * Coverage Dashboard surfaces: mapped / unmapped(orphan) / weak / strong counts,
 * the confidence distribution, the method/tier breakdown, a per-concern registry
 * (with a concern-level coverage-confidence aggregate), and the orphan list. It
 * SELECTs only — no new table, no migration, no writes.
 */
import type { Pool } from 'pg';

export interface CoverageStats {
  generated_at: string;
  total_concerns: number;
  mapped_concerns: number;
  orphan_concerns: number;
  coverage_pct: number;
  tier3_mappings: number;
  atomic_mappings: number;
  composite_mappings: number;
  strong: number;
  moderate: number;
  weak: number;
  avg_confidence: number;
  by_band: Record<string, number>;
  by_method: Record<string, number>;
  by_tier: Record<string, number>;
}

export interface RegistryRow {
  concern_pk: number;
  concern_id: string | null;
  display_label: string | null;
  domain: string | null;
  bridge_tag: string | null;
  tier3_count: number;
  composite_count: number;
  atomic_count: number;
  top_signal: string | null;
  coverage_confidence: number;     // max Tier-3 confidence for the concern
  coverage_band: 'strong' | 'moderate' | 'weak' | 'none';
  is_orphan: boolean;
}

export interface CoverageData {
  stats: CoverageStats;
  registry: RegistryRow[];
  orphans: RegistryRow[];
}

function bandFor(c: number): RegistryRow['coverage_band'] {
  if (c >= 0.7) return 'strong';
  if (c >= 0.45) return 'moderate';
  if (c > 0) return 'weak';
  return 'none';
}

export async function buildConcernSignalCoverage(pool: Pool): Promise<CoverageData> {
  const totalRes = await pool.query<{ n: string }>(`SELECT COUNT(*) n FROM capadex_concerns_master`);
  const totalConcerns = Number(totalRes.rows[0]?.n) || 0;

  const tierRes = await pool.query<{ signal_tier: string; n: string }>(
    `SELECT signal_tier, COUNT(*) n FROM capadex_concern_signal_map GROUP BY signal_tier`,
  );
  const byTier: Record<string, number> = {};
  for (const r of tierRes.rows) byTier[r.signal_tier] = Number(r.n);

  const methodRes = await pool.query<{ match_method: string; n: string }>(
    `SELECT match_method, COUNT(*) n FROM capadex_concern_signal_map GROUP BY match_method`,
  );
  const byMethod: Record<string, number> = {};
  for (const r of methodRes.rows) byMethod[r.match_method] = Number(r.n);

  const bandRes = await pool.query<{ confidence_band: string; n: string }>(
    `SELECT confidence_band, COUNT(*) n
       FROM capadex_concern_signal_map WHERE signal_tier = 'tier3'
      GROUP BY confidence_band`,
  );
  const byBand: Record<string, number> = {};
  for (const r of bandRes.rows) byBand[r.confidence_band] = Number(r.n);

  const avgRes = await pool.query<{ avg: number | null }>(
    `SELECT AVG(confidence) avg FROM capadex_concern_signal_map WHERE signal_tier = 'tier3'`,
  );

  // Per-concern registry: one aggregated row per concern in the master.
  const regRes = await pool.query<{
    concern_pk: number; concern_id: string | null; display_label: string | null;
    domain: string | null; bridge_tag: string | null;
    tier3_count: string; composite_count: string; atomic_count: string;
    top_signal: string | null; coverage_confidence: number | null; is_orphan: boolean;
  }>(
    `SELECT c.id                                                        AS concern_pk,
            c.concern_id                                               AS concern_id,
            c.display_label                                            AS display_label,
            c.domain                                                   AS domain,
            c.relational_bridge_tag                                    AS bridge_tag,
            COUNT(*) FILTER (WHERE m.signal_tier = 'tier3')            AS tier3_count,
            COUNT(*) FILTER (WHERE m.signal_tier = 'composite')        AS composite_count,
            COUNT(*) FILTER (WHERE m.signal_tier = 'atomic')           AS atomic_count,
            (ARRAY_AGG(m.signal_name ORDER BY m.confidence DESC)
               FILTER (WHERE m.signal_tier = 'tier3'))[1]             AS top_signal,
            COALESCE(MAX(m.confidence) FILTER (WHERE m.signal_tier = 'tier3'), 0) AS coverage_confidence,
            bool_or(m.signal_tier = 'orphan') AND NOT bool_or(m.signal_tier = 'tier3') AS is_orphan
       FROM capadex_concerns_master c
       LEFT JOIN capadex_concern_signal_map m ON m.concern_pk = c.id
      GROUP BY c.id, c.concern_id, c.display_label, c.domain, c.relational_bridge_tag
      ORDER BY c.id`,
  );

  const registry: RegistryRow[] = regRes.rows.map((r) => {
    const conf = Number(r.coverage_confidence) || 0;
    const tier3 = Number(r.tier3_count) || 0;
    return {
      concern_pk: r.concern_pk,
      concern_id: r.concern_id,
      display_label: r.display_label,
      domain: r.domain,
      bridge_tag: r.bridge_tag,
      tier3_count: tier3,
      composite_count: Number(r.composite_count) || 0,
      atomic_count: Number(r.atomic_count) || 0,
      top_signal: r.top_signal,
      coverage_confidence: conf,
      coverage_band: tier3 === 0 ? 'none' : bandFor(conf),
      is_orphan: !!r.is_orphan || tier3 === 0,
    };
  });

  const mapped = registry.filter((r) => r.tier3_count > 0).length;
  const orphanRows = registry.filter((r) => r.is_orphan);

  const stats: CoverageStats = {
    generated_at: new Date().toISOString(),
    total_concerns: totalConcerns,
    mapped_concerns: mapped,
    orphan_concerns: orphanRows.length,
    coverage_pct: totalConcerns > 0 ? Math.round((mapped / totalConcerns) * 1000) / 10 : 0,
    tier3_mappings: byTier.tier3 || 0,
    atomic_mappings: byTier.atomic || 0,
    composite_mappings: byTier.composite || 0,
    strong: byBand.strong || 0,
    moderate: byBand.moderate || 0,
    weak: byBand.weak || 0,
    avg_confidence: Math.round((Number(avgRes.rows[0]?.avg) || 0) * 10000) / 10000,
    by_band: byBand,
    by_method: byMethod,
    by_tier: byTier,
  };

  return { stats, registry, orphans: orphanRows };
}
