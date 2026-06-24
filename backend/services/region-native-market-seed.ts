/**
 * region-native-market-seed.ts — Task 81
 *
 * SINGLE source of truth for the region-native market & benchmark seed. Consolidates the logic
 * that previously lived in two one-shot CLI scripts (`seed-region-native-market.ts` +
 * `seed-global-region-content.ts`) so it can run from BOTH:
 *   1. the CLI scripts (manual `npx tsx` run — force re-seed), and
 *   2. an idempotent, guarded backend-startup hook (`ensureRegionNativeMarketSeed`).
 *
 * WHY a startup hook (see .agents/memory/merged-task-data-not-in-live-db.md):
 *   A task merge carries CODE + migration DDL only — NOT seeded rows. The agent also cannot
 *   write to the production DB (read-only replica). So the ONLY way region-native data reaches
 *   production is a self-running, idempotent seeder on the live backend — exactly the pattern this
 *   codebase already uses for occupation/ontology self-seeders. A single publish then activates it.
 *
 * HONESTY / SAFETY CONTRACT (replit.md + .agents/memory/global-competency-phase8.md):
 *   - Every embedded number is a REAL public figure with provenance (source name, URL, as-of date,
 *     exact unit, confidence by source authority). Figures across rows are NOT cross-comparable.
 *   - Strictly ADDITIVE & reversible: region-native rows carry provenance `region_native_market_v1`;
 *     rollback = delete-by-provenance. The universal-tagging rows carry `phase8_global_competency`.
 *   - Observably byte-identical for the DEFAULT region (IN) and under the flag-OFF read path: the
 *     engine baseFilter excludes region-native rows from India's base read, and the global-competency
 *     routes 503 when the flag is OFF. The data is therefore inert until the region surface is read.
 *   - The startup hook seeds DATA unconditionally (not flag-gated) so a publish activates it; the
 *     `globalCompetency` flag still governs whether the admin surface EXPOSES the regions.
 *   - Idempotent: the startup hook is a no-op once the data is present (guarded by provenance probe);
 *     the schema-ensure mirrors migration 20261213 with additive IF NOT EXISTS DDL.
 */
import { Pool } from 'pg';
import {
  REGIONS,
  DEFAULT_REGION,
  GLOBAL_REGION_PROVENANCE,
  assignRegionContent,
  computeRegionCoverage,
  ensureGlobalRegionSchema,
  type RegionCode,
  type SurfaceKey,
} from './global-competency-engine';

export const REGION_NATIVE_PROVENANCE = 'region_native_market_v1';

// ---------------------------------------------------------------------------
// REAL region-native market signals (verified via primary sources, June 2026)
// ---------------------------------------------------------------------------
interface MarketSignalSeed {
  geography: 'US' | 'EU' | 'ME' | 'APAC';
  signal_type: 'job_demand' | 'salary_shift' | 'ai_disruption' | 'emerging_role' | 'macro_trend';
  role_id: string | null;
  source: string;
  metric_value: number;
  confidence: number;
  context: {
    title: string;
    metric_unit: string;
    direction: 'up' | 'down' | 'flat';
    source_name: string;
    source_url: string;
    as_of: string;
    soc_code?: string;
    country?: string;
    crosswalk_note?: string;
    confidence_basis: string;
    methodology: string;
  };
}

const SIGNALS: MarketSignalSeed[] = [
  // ===== UNITED STATES — U.S. Bureau of Labor Statistics, Employment Projections 2024–34 (OOH) =====
  {
    geography: 'US', signal_type: 'job_demand', role_id: 'role_be_eng', source: 'bls_ep_2024_34',
    metric_value: 15, confidence: 0.9,
    context: {
      title: 'Software developers — projected employment growth (US)',
      metric_unit: 'percent_change_2024_2034', direction: 'up',
      source_name: 'U.S. Bureau of Labor Statistics — Occupational Outlook Handbook',
      source_url: 'https://www.bls.gov/ooh/computer-and-information-technology/software-developers.htm',
      as_of: '2024-2034 projection (May 2024 base)', soc_code: '15-1252',
      crosswalk_note: 'Backend Engineer maps to BLS Software Developers (SOC 15-1252).',
      confidence_basis: 'U.S. federal statistical agency projection (highest authority).',
      methodology: 'BLS Employment Projections program, 10-year occupational projection.',
    },
  },
  {
    geography: 'US', signal_type: 'job_demand', role_id: 'role_sr_be_eng', source: 'bls_ep_2024_34',
    metric_value: 15, confidence: 0.9,
    context: {
      title: 'Software developers — projected employment growth (US, senior)',
      metric_unit: 'percent_change_2024_2034', direction: 'up',
      source_name: 'U.S. Bureau of Labor Statistics — Occupational Outlook Handbook',
      source_url: 'https://www.bls.gov/ooh/computer-and-information-technology/software-developers.htm',
      as_of: '2024-2034 projection (May 2024 base)', soc_code: '15-1252',
      crosswalk_note: 'Senior Backend Engineer shares the BLS Software Developers occupation; BLS does not split by seniority.',
      confidence_basis: 'U.S. federal statistical agency projection.',
      methodology: 'BLS Employment Projections program, 10-year occupational projection.',
    },
  },
  {
    geography: 'US', signal_type: 'job_demand', role_id: 'role_eng_manager', source: 'bls_ep_2024_34',
    metric_value: 15, confidence: 0.9,
    context: {
      title: 'Computer & information systems managers — projected employment growth (US)',
      metric_unit: 'percent_change_2024_2034', direction: 'up',
      source_name: 'U.S. Bureau of Labor Statistics — Occupational Outlook Handbook',
      source_url: 'https://www.bls.gov/ooh/management/computer-and-information-systems-managers.htm',
      as_of: '2024-2034 projection (May 2024 base)', soc_code: '11-3021',
      crosswalk_note: 'Engineering Manager maps to BLS Computer & Information Systems Managers (SOC 11-3021).',
      confidence_basis: 'U.S. federal statistical agency projection.',
      methodology: 'BLS Employment Projections program, 10-year occupational projection.',
    },
  },
  {
    geography: 'US', signal_type: 'job_demand', role_id: 'role_credit_analyst', source: 'bls_ep_2024_34',
    metric_value: 6, confidence: 0.9,
    context: {
      title: 'Financial analysts — projected employment growth (US)',
      metric_unit: 'percent_change_2024_2034', direction: 'up',
      source_name: 'U.S. Bureau of Labor Statistics — Occupational Outlook Handbook',
      source_url: 'https://www.bls.gov/ooh/business-and-financial/financial-analysts.htm',
      as_of: '2024-2034 projection (May 2024 base)', soc_code: '13-2051',
      crosswalk_note: 'Credit Analyst mapped to the BLS Financial Analysts family (nearest published occupation).',
      confidence_basis: 'U.S. federal statistical agency projection.',
      methodology: 'BLS Employment Projections program, 10-year occupational projection.',
    },
  },
  {
    geography: 'US', signal_type: 'macro_trend', role_id: null, source: 'bls_ep_2024_34',
    metric_value: 4, confidence: 0.9,
    context: {
      title: 'All occupations — baseline projected employment growth (US)',
      metric_unit: 'percent_change_2024_2034', direction: 'up',
      source_name: 'U.S. Bureau of Labor Statistics — Employment Projections',
      source_url: 'https://www.bls.gov/emp/',
      as_of: '2024-2034 projection (May 2024 base)',
      confidence_basis: 'U.S. federal statistical agency projection (economy-wide baseline).',
      methodology: 'BLS Employment Projections program, total employment 10-year projection.',
    },
  },

  // ===== EUROPEAN UNION — Eurostat (EU-LFS, ICT specialists 2024) + CEDEFOP Skills Forecast 2035 =====
  {
    geography: 'EU', signal_type: 'job_demand', role_id: 'role_be_eng', source: 'eurostat_lfs_2024',
    metric_value: 4.8, confidence: 0.88,
    context: {
      title: 'ICT specialists in employment — year-on-year growth (EU)',
      metric_unit: 'percent_change_year_on_year_2023_2024', direction: 'up',
      source_name: 'Eurostat — EU Labour Force Survey (ICT specialists in employment)',
      source_url: 'https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20250708-2',
      as_of: '2024 (vs 2023)',
      crosswalk_note: 'ICT specialists is the closest EU-wide measured population for software/engineering roles. 10M+ specialists; 5.0% of EU employment (+0.2pp YoY).',
      confidence_basis: 'EU statistical office, harmonised Labour Force Survey.',
      methodology: 'Eurostat secondary statistics on ICT specialists derived from EU-LFS.',
    },
  },
  {
    geography: 'EU', signal_type: 'job_demand', role_id: 'role_sr_be_eng', source: 'eurostat_lfs_2024',
    metric_value: 4.8, confidence: 0.88,
    context: {
      title: 'ICT specialists in employment — year-on-year growth (EU, senior)',
      metric_unit: 'percent_change_year_on_year_2023_2024', direction: 'up',
      source_name: 'Eurostat — EU Labour Force Survey (ICT specialists in employment)',
      source_url: 'https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20250708-2',
      as_of: '2024 (vs 2023)',
      crosswalk_note: 'Senior Backend Engineer shares the ICT specialists population; EU-LFS does not split by seniority.',
      confidence_basis: 'EU statistical office, harmonised Labour Force Survey.',
      methodology: 'Eurostat secondary statistics on ICT specialists derived from EU-LFS.',
    },
  },
  {
    geography: 'EU', signal_type: 'macro_trend', role_id: null, source: 'cedefop_sf_2035',
    metric_value: 0.4, confidence: 0.75,
    context: {
      title: 'Total EU employment — projected annual growth to 2035',
      metric_unit: 'percent_per_annum_to_2035', direction: 'up',
      source_name: 'CEDEFOP — Skills Forecast 2035',
      source_url: 'https://www.cedefop.europa.eu/en/tools/skills-forecast',
      as_of: '2025-2035 projection',
      confidence_basis: 'EU inter-governmental agency forecast (model-based, lower than measured stats).',
      methodology: 'CEDEFOP Skills Forecast macro-econometric + sectoral model.',
    },
  },

  // ===== MIDDLE EAST (GCC) — ServiceNow/Gulf Business + ManpowerGroup Employment Outlook =====
  {
    geography: 'ME', signal_type: 'emerging_role', role_id: 'role_be_eng', source: 'servicenow_gcc_2024',
    metric_value: 54, confidence: 0.55,
    context: {
      title: 'UAE technology-role demand — projected growth to 2030',
      metric_unit: 'percent_growth_to_2030', direction: 'up',
      source_name: 'ServiceNow / Pearson "Enterprise AI Maturity" study (reported via Gulf Business)',
      source_url: 'https://gulfbusiness.com/uae-to-add-tech-jobs-by-2030/',
      as_of: 'to 2030 estimate (2024 report)', country: 'United Arab Emirates',
      crosswalk_note: 'Aggregate tech-role demand; applied to Backend Engineer as the representative software role. ~91,000 additional tech specialists estimated for the UAE by 2030.',
      confidence_basis: 'Vendor-sponsored consultancy study reported by trade press (moderate confidence).',
      methodology: 'Industry study / labour-demand modelling; not a national statistical projection.',
    },
  },
  {
    geography: 'ME', signal_type: 'macro_trend', role_id: null, source: 'manpowergroup_2025',
    metric_value: 48, confidence: 0.6,
    context: {
      title: 'UAE Net Employment Outlook (hiring intentions)',
      metric_unit: 'net_employment_outlook_percent', direction: 'up',
      source_name: 'ManpowerGroup Employment Outlook Survey 2025',
      source_url: 'https://www.manpowergroup.com/workforce-insights/world-of-work/meos',
      as_of: 'Q-survey 2025', country: 'United Arab Emirates',
      crosswalk_note: 'Net Employment Outlook = % employers expecting to hire minus % expecting to reduce; UAE ranked among the strongest globally.',
      confidence_basis: 'Large employer-intentions survey (directional, not a statistical projection).',
      methodology: 'ManpowerGroup quarterly survey of employer hiring intentions.',
    },
  },
  {
    geography: 'ME', signal_type: 'macro_trend', role_id: null, source: 'manpowergroup_2025',
    metric_value: 35, confidence: 0.55,
    context: {
      title: 'Saudi Arabia Net Employment Outlook (hiring intentions)',
      metric_unit: 'net_employment_outlook_percent', direction: 'up',
      source_name: 'ManpowerGroup Employment Outlook Survey 2025',
      source_url: 'https://www.manpowergroup.com/workforce-insights/world-of-work/meos',
      as_of: 'Q-survey 2025', country: 'Saudi Arabia',
      crosswalk_note: 'Net Employment Outlook for Saudi Arabia; Vision-2030 diversification driving hiring.',
      confidence_basis: 'Large employer-intentions survey (directional).',
      methodology: 'ManpowerGroup quarterly survey of employer hiring intentions.',
    },
  },

  // ===== ASIA-PACIFIC — ManpowerGroup Talent Shortage 2025 + Singapore market reports =====
  {
    geography: 'APAC', signal_type: 'macro_trend', role_id: null, source: 'manpowergroup_2025',
    metric_value: 77, confidence: 0.6,
    context: {
      title: 'APAC employers reporting difficulty filling roles (talent shortage)',
      metric_unit: 'percent_employers_reporting_shortage', direction: 'up',
      source_name: 'ManpowerGroup Talent Shortage 2025 (APAC)',
      source_url: 'https://go.manpowergroup.com/talent-shortage',
      as_of: '2025', country: 'APAC (regional)',
      crosswalk_note: 'Talent scarcity, NOT employment growth — high values mean roles are hard to fill (up from 45% in 2014; above the 74% global average).',
      confidence_basis: 'Large multi-market employer survey (directional).',
      methodology: 'ManpowerGroup annual Talent Shortage survey.',
    },
  },
  {
    geography: 'APAC', signal_type: 'job_demand', role_id: 'role_be_eng', source: 'manpowergroup_2025',
    metric_value: 32, confidence: 0.55,
    context: {
      title: 'IT & Data — hardest skills to find in APAC',
      metric_unit: 'percent_employers_citing_hardest_to_find', direction: 'up',
      source_name: 'ManpowerGroup Talent Shortage 2025 (APAC)',
      source_url: 'https://go.manpowergroup.com/talent-shortage',
      as_of: '2025', country: 'APAC (regional)',
      crosswalk_note: 'Share of APAC employers naming IT & Data as the hardest skill area to fill — a scarcity proxy for software demand, not a growth rate. Engineering 27%, Sales 24% follow.',
      confidence_basis: 'Large multi-market employer survey (directional).',
      methodology: 'ManpowerGroup annual Talent Shortage survey.',
    },
  },
];

// ---------------------------------------------------------------------------
// REAL region market-benchmark cohorts (cohort_type='region'; wage/market stats only — NO
// fabricated competency statistics, so bench_cohort_statistics is intentionally NOT written).
// ---------------------------------------------------------------------------
interface RegionCohortSeed {
  id: string;
  geography: 'US' | 'EU' | 'ME' | 'APAC';
  name: string;
  filters: Record<string, unknown>;
}

const COHORTS: RegionCohortSeed[] = [
  {
    id: 'coh_region_us', geography: 'US', name: 'United States — Labour Market Benchmark (BLS OEWS / EP)',
    filters: {
      provenance: REGION_NATIVE_PROVENANCE, currency: 'USD',
      source_name: 'U.S. Bureau of Labor Statistics — OEWS median wages (May 2024) & EP 2024-34',
      as_of: 'May 2024 wages; 2024-2034 projections',
      median_wages_usd: {
        software_developers: { p50: 133080, soc: '15-1252', url: 'https://www.bls.gov/ooh/computer-and-information-technology/software-developers.htm' },
        computer_information_systems_managers: { p50: 171200, soc: '11-3021', url: 'https://www.bls.gov/ooh/management/computer-and-information-systems-managers.htm' },
      },
      confidence: 0.9, confidence_basis: 'U.S. federal statistical agency (OEWS survey + EP projections).',
      note: 'Real wage levels (USD, annual median). NOT competency-benchmark statistics — no competency scores are claimed for this cohort.',
    },
  },
  {
    id: 'coh_region_eu', geography: 'EU', name: 'European Union — ICT Workforce Benchmark (Eurostat)',
    filters: {
      provenance: REGION_NATIVE_PROVENANCE, currency: 'EUR',
      source_name: 'Eurostat — EU Labour Force Survey, ICT specialists in employment',
      source_url: 'https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20250708-2',
      as_of: '2024',
      ict_specialists: { count: '10,000,000+', share_of_employment_pct: 5.0, yoy_growth_pct: 4.8, share_change_pp_yoy: 0.2 },
      country_extremes: { highest_share: { Sweden: 8.6, Luxembourg: 8.0, Finland: 7.8 }, lowest_share: { Greece: 2.5, Romania: 2.8, Italy: 4.0 } },
      confidence: 0.88, confidence_basis: 'EU statistical office, harmonised LFS.',
      note: 'Workforce-share statistics (not wages or competency scores). No competency benchmark is claimed.',
    },
  },
  {
    id: 'coh_region_me', geography: 'ME', name: 'Middle East (GCC) — Tech Demand Benchmark (ServiceNow / ManpowerGroup)',
    filters: {
      provenance: REGION_NATIVE_PROVENANCE,
      sources: [
        { name: 'ServiceNow / Pearson via Gulf Business', metric: 'UAE tech-role demand +54% to 2030; ~91,000 additional tech specialists by 2030', url: 'https://gulfbusiness.com/uae-to-add-tech-jobs-by-2030/' },
        { name: 'ManpowerGroup Employment Outlook Survey 2025', metric: 'UAE Net Employment Outlook +48%; Saudi Arabia +35%', url: 'https://www.manpowergroup.com/workforce-insights/world-of-work/meos' },
      ],
      as_of: '2024-2025 (to-2030 estimates)',
      confidence: 0.55, confidence_basis: 'Vendor study + employer-intentions survey (moderate; not national statistics).',
      note: 'Demand/hiring-intention figures (directional). No wages or competency scores are claimed.',
    },
  },
  {
    id: 'coh_region_apac', geography: 'APAC', name: 'Asia-Pacific — Talent Scarcity Benchmark (ManpowerGroup)',
    filters: {
      provenance: REGION_NATIVE_PROVENANCE,
      source_name: 'ManpowerGroup Talent Shortage 2025 (APAC)',
      source_url: 'https://go.manpowergroup.com/talent-shortage',
      as_of: '2025',
      talent_shortage: { employers_reporting_difficulty_pct: 77, vs_2014_pct: 45, vs_global_avg_pct: 74, hardest_skill_areas: { 'IT & Data': 32, Engineering: 27, Sales: 24 } },
      confidence: 0.6, confidence_basis: 'Large multi-market employer survey (directional).',
      note: 'Scarcity statistics (hard-to-fill share), NOT growth or competency scores.',
    },
  },
];

// ---------------------------------------------------------------------------
// Schema + probes (idempotent; mirrors migration 20261213_region_native_market_benchmark.sql)
// ---------------------------------------------------------------------------
async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try {
    const { rows } = await pool.query('SELECT to_regclass($1) AS reg', [`public.${name}`]);
    return Boolean(rows[0]?.reg);
  } catch {
    return false;
  }
}

/** Additive, idempotent DDL mirroring migration 20261213 + the overlay table. */
export async function ensureRegionMarketSchema(pool: Pool): Promise<void> {
  await ensureGlobalRegionSchema(pool); // global_region_content overlay table + indexes
  await pool.query(`ALTER TABLE bench_cohorts ADD COLUMN IF NOT EXISTS geography text`);
  await pool.query(`ALTER TABLE bench_cohorts DROP CONSTRAINT IF EXISTS bench_cohorts_cohort_type_check`);
  await pool.query(`ALTER TABLE bench_cohorts ADD CONSTRAINT bench_cohorts_cohort_type_check
    CHECK (cohort_type = ANY (ARRAY[
      'global'::text, 'industry'::text, 'function'::text, 'role'::text,
      'layer'::text, 'aspirational'::text, 'region'::text
    ]))`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_bench_cohorts_geography ON bench_cohorts (geography) WHERE geography IS NOT NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_wos_market_geography ON wos_market_signals (geography, captured_at DESC)`);
}

async function provenancePresent(pool: Pool, provenance: string): Promise<boolean> {
  if (!(await tableExists(pool, 'global_region_content'))) return false;
  try {
    const { rows } = await pool.query('SELECT 1 FROM global_region_content WHERE provenance = $1 LIMIT 1', [provenance]);
    return rows.length > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// (1) Region-native market signals + region benchmark cohorts + their overlay rows.
//     Idempotent by delete-then-insert on this seed's own provenance (rollback = the delete block).
// ---------------------------------------------------------------------------
export interface RegionMarketSeedResult {
  signals: number;
  cohorts: number;
  overlayByRegionSurface: Array<{ region_code: string; surface: string; n: number }>;
}

export async function seedRegionNativeMarket(pool: Pool): Promise<RegionMarketSeedResult> {
  await ensureRegionMarketSchema(pool);

  // --- Idempotent cleanup (rollback = this block on its own) ---
  await pool.query(`DELETE FROM global_region_content WHERE provenance = $1`, [REGION_NATIVE_PROVENANCE]);
  await pool.query(
    `DELETE FROM wos_market_signals WHERE geography = ANY($1) AND source = ANY($2)`,
    [['US', 'EU', 'ME', 'APAC'], Array.from(new Set(SIGNALS.map((s) => s.source)))],
  );
  await pool.query(`DELETE FROM bench_cohorts WHERE id = ANY($1)`, [COHORTS.map((c) => c.id)]);

  // --- 1. Region-native market signals ---
  const signalIds: Array<{ id: number; region: string }> = [];
  for (const s of SIGNALS) {
    const { rows } = await pool.query(
      `INSERT INTO wos_market_signals
         (signal_type, role_id, geography, metric_value, metric_unit, direction, confidence, source, context, captured_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, CURRENT_DATE)
       RETURNING id`,
      [s.signal_type, s.role_id, s.geography, s.metric_value, s.context.metric_unit, s.context.direction,
       s.confidence, s.source, JSON.stringify({ ...s.context, provenance: REGION_NATIVE_PROVENANCE })],
    );
    signalIds.push({ id: rows[0].id, region: s.geography });
  }

  // --- 2. Region market-benchmark cohorts (real stats; no fabricated competency rows) ---
  for (const c of COHORTS) {
    await pool.query(
      `INSERT INTO bench_cohorts (id, cohort_type, name, geography, filters, is_active)
       VALUES ($1, 'region', $2, $3, $4::jsonb, true)
       ON CONFLICT (id) DO UPDATE SET
         cohort_type = 'region', name = EXCLUDED.name, geography = EXCLUDED.geography,
         filters = EXCLUDED.filters, is_active = true`,
      [c.id, c.name, c.geography, JSON.stringify(c.filters)],
    );
  }

  // --- 3. Thread region-native rows through the region overlay (so each region's surface differs) ---
  for (const sig of signalIds) {
    await pool.query(
      `INSERT INTO global_region_content (surface, region_code, entity_ref, detail, provenance)
       VALUES ('demand_intelligence', $1, $2, $3::jsonb, $4)
       ON CONFLICT (surface, region_code, entity_ref) DO UPDATE SET
         detail = EXCLUDED.detail, provenance = EXCLUDED.provenance`,
      [sig.region, String(sig.id), JSON.stringify({ provenance: REGION_NATIVE_PROVENANCE, kind: 'region_native_demand' }), REGION_NATIVE_PROVENANCE],
    );
  }
  for (const c of COHORTS) {
    await pool.query(
      `INSERT INTO global_region_content (surface, region_code, entity_ref, detail, provenance)
       VALUES ('benchmarks', $1, $2, $3::jsonb, $4)
       ON CONFLICT (surface, region_code, entity_ref) DO UPDATE SET
         detail = EXCLUDED.detail, provenance = EXCLUDED.provenance`,
      [c.geography, c.id, JSON.stringify({ provenance: REGION_NATIVE_PROVENANCE, kind: 'region_native_benchmark' }), REGION_NATIVE_PROVENANCE],
    );
  }

  const byRegion = await pool.query(
    `SELECT region_code, surface, COUNT(*)::int n
       FROM global_region_content WHERE provenance = $1
      GROUP BY region_code, surface ORDER BY region_code, surface`,
    [REGION_NATIVE_PROVENANCE],
  );
  return {
    signals: signalIds.length,
    cohorts: COHORTS.length,
    overlayByRegionSurface: byRegion.rows.map((r) => ({ region_code: r.region_code, surface: r.surface, n: r.n })),
  };
}

// ---------------------------------------------------------------------------
// (2) Global region content — region-tag EXISTING universal entities to the priority regions.
//     Never invents an entity; never fabricates regional statistics. Idempotent (ON CONFLICT DO NOTHING).
// ---------------------------------------------------------------------------
const PRIORITY_REGIONS = REGIONS.filter((r) => !r.is_default).map((r) => r.code) as RegionCode[];

async function fetchRefs(pool: Pool, sql: string): Promise<string[]> {
  const { rows } = await pool.query(sql);
  return rows.map((r) => String(r.ref));
}

export interface GlobalRegionContentResult {
  written: number;
  rejected: number;
  pools: { roles: number; competencies: number; benchmarks: number; demand: number };
}

export async function seedGlobalRegionContent(pool: Pool): Promise<GlobalRegionContentResult> {
  await ensureGlobalRegionSchema(pool);

  const roleRefs = await fetchRefs(pool, `SELECT id::text AS ref FROM onto_roles ORDER BY id`);
  const competencyRefs = await fetchRefs(pool, `SELECT id::text AS ref FROM onto_competencies WHERE deprecated = false ORDER BY id`);
  // Definitional / global cohorts only — exclude India-population statistical role cohorts.
  const benchmarkRefs = await fetchRefs(pool, `SELECT id::text AS ref FROM bench_cohorts WHERE id NOT LIKE 'coh_role_%' ORDER BY id`);
  const demandRefs = await fetchRefs(pool, `SELECT id::text AS ref FROM wos_market_signals WHERE geography = 'global' ORDER BY id`);

  const plan: { surface: SurfaceKey; refs: string[]; basis: string }[] = [
    { surface: 'role_library', refs: roleRefs, basis: 'universal_role_definition' },
    { surface: 'competency_models', refs: competencyRefs, basis: 'universal_competency_genome' },
    { surface: 'benchmarks', refs: benchmarkRefs, basis: 'global_structural_cohort' },
    { surface: 'demand_intelligence', refs: demandRefs, basis: 'global_market_signal' },
    // readiness_models intentionally omitted (subject-specific user snapshots, not regional content).
  ];

  let written = 0;
  let rejected = 0;
  for (const region of PRIORITY_REGIONS) {
    for (const item of plan) {
      if (!item.refs.length) continue;
      const res = await assignRegionContent(pool, {
        surface: item.surface,
        region,
        entityRefs: item.refs,
        provenance: GLOBAL_REGION_PROVENANCE,
        detail: {
          basis: item.basis,
          note: 'Existing universal entity tagged to region; no regional statistics fabricated.',
        },
      });
      written += res.written;
      rejected += res.rejected;
    }
  }
  return {
    written,
    rejected,
    pools: { roles: roleRefs.length, competencies: competencyRefs.length, benchmarks: benchmarkRefs.length, demand: demandRefs.length },
  };
}

// ---------------------------------------------------------------------------
// Startup hook — idempotent, guarded, never throws. Seeds DATA unconditionally (inert under the
// default-region/flag-OFF read paths); the `globalCompetency` flag still governs surface exposure.
// ---------------------------------------------------------------------------
export interface EnsureSeedSummary {
  market: 'seeded' | 'already_present' | 'error';
  globalContent: 'seeded' | 'already_present' | 'error';
  detail?: RegionMarketSeedResult;
  globalContentDetail?: GlobalRegionContentResult;
  skipped?: boolean;
}

export async function ensureRegionNativeMarketSeed(pool: Pool): Promise<EnsureSeedSummary> {
  const summary: EnsureSeedSummary = { market: 'already_present', globalContent: 'already_present' };

  // (1) Region-native market — guard on this seed's own provenance.
  try {
    if (await provenancePresent(pool, REGION_NATIVE_PROVENANCE)) {
      summary.market = 'already_present';
    } else {
      summary.detail = await seedRegionNativeMarket(pool);
      summary.market = 'seeded';
    }
  } catch (err) {
    summary.market = 'error';
    console.warn('[region-native-seed] market seed error:', (err as Error)?.message ?? err);
  }

  // (2) Universal-entity region tagging — guard on the phase-8 provenance.
  try {
    if (await provenancePresent(pool, GLOBAL_REGION_PROVENANCE)) {
      summary.globalContent = 'already_present';
    } else {
      summary.globalContentDetail = await seedGlobalRegionContent(pool);
      summary.globalContent = 'seeded';
    }
  } catch (err) {
    summary.globalContent = 'error';
    console.warn('[region-native-seed] global content seed error:', (err as Error)?.message ?? err);
  }

  return summary;
}

/** Convenience for CLI/verification: report per-region coverage after a (re)seed. */
export async function reportRegionCoverage(pool: Pool): Promise<void> {
  const coverage = await computeRegionCoverage(pool);
  for (const r of coverage.regions) {
    console.log(
      `[verify] ${r.code} (${r.name})${r.code === DEFAULT_REGION ? ' [default]' : ''}: ` +
        `surfaces_with_content=${r.surfaces_with_content}/${r.surfaces.length}, total_effective=${r.total_effective_content}`,
    );
  }
}
