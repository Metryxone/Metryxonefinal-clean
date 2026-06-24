/**
 * seed-region-native-market.ts — Task 75
 *
 * Imports REAL, citable, region-native market & benchmark data so the Global Competency regions
 * (US / EU / ME / APAC) differ MEANINGFULLY from India's default content, moving D12 beyond 75/100.
 *
 * HONESTY CONTRACT (replit.md + .agents/memory/global-competency-phase8.md):
 *   - Every number embedded here is a REAL public figure with provenance: source name, source URL,
 *     as-of date, exact metric semantics/unit, and a confidence reflecting source authority
 *     (government statistics > inter-governmental agency > consultancy survey > market report).
 *   - Figures across rows are NOT comparable (a US 10-yr projection, an EU YoY change, a Gulf
 *     demand-to-2030 estimate and an APAC talent-shortage share are different units) — each row
 *     states its own unit + meaning in `context`. We never imply comparability or fabricate a value.
 *   - Strictly ADDITIVE & reversible: all rows carry provenance `region_native_market_v1`; re-running
 *     deletes that provenance first, so the seed is idempotent and rollback = delete-by-provenance.
 *   - Flag-OFF / default-region (IN) byte-identical: region-native rows use a non-global geography
 *     and cohort_type='region', which the engine's baseFilter excludes from India's base read.
 *
 * Run:  cd backend && npx tsx scripts/seed-region-native-market.ts
 */
import { Pool } from 'pg';

const PROVENANCE = 'region_native_market_v1';

// onto_roles ids confirmed present in this DB:
//   role_be_eng, role_sr_be_eng, role_eng_manager, role_pm, role_credit_analyst
// Crosswalks below only map a role when the source occupation is a clean match; otherwise role_id is
// left NULL (region-level signal) rather than forcing a dubious mapping. Where a mapping is a defensible
// PROXY rather than an exact occupational match (e.g. Product Manager → BLS Project Management
// Specialists, which is a related-but-distinct occupation), it is stamped `crosswalk_quality:'proxy'`
// and its `confidence` is discounted below the underlying source authority so the proxy is never
// presented as an exact figure. Subset relationships (e.g. EU ICT service managers ⊂ ICT specialists)
// are stamped `crosswalk_quality:'subset'` and retain source authority.

interface MarketSignalSeed {
  geography: 'US' | 'EU' | 'ME' | 'APAC';
  signal_type: 'job_demand' | 'salary_shift' | 'ai_disruption' | 'emerging_role' | 'macro_trend';
  role_id: string | null;
  source: string;            // short source code (also stored on wos_market_signals.source)
  metric_value: number;
  confidence: number;        // 0..1 by source authority
  context: {
    title: string;           // human label for the signal
    metric_unit: string;     // EXACT unit — rows are NOT cross-comparable
    direction: 'up' | 'down' | 'flat';
    source_name: string;
    source_url: string;
    as_of: string;           // reference period of the figure
    soc_code?: string;       // US SOC where applicable
    country?: string;        // sub-region the figure actually refers to
    crosswalk_note?: string; // why this maps (or does not map) to the role
    crosswalk_quality?: 'exact' | 'subset' | 'proxy'; // honesty of the role mapping
    confidence_basis: string;
    methodology: string;
  };
}

// ---------------------------------------------------------------------------
// REAL region-native market signals (verified via primary sources, June 2026)
// ---------------------------------------------------------------------------
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
    metric_value: 3, confidence: 0.9,
    context: {
      title: 'All occupations — baseline projected employment growth (US)',
      metric_unit: 'percent_change_2024_2034', direction: 'up',
      source_name: 'U.S. Bureau of Labor Statistics — Employment Projections',
      source_url: 'https://www.bls.gov/emp/',
      as_of: '2024-2034 projection (May 2024 base)',
      confidence_basis: 'U.S. federal statistical agency projection (economy-wide baseline).',
      methodology: 'BLS Employment Projections program, total employment 10-year projection (170.0M → 175.2M jobs, +3%).',
    },
  },
  {
    geography: 'US', signal_type: 'job_demand', role_id: 'role_pm', source: 'bls_ep_2024_34',
    metric_value: 6, confidence: 0.7,
    context: {
      title: 'Project management specialists — projected employment growth (US)',
      metric_unit: 'percent_change_2024_2034', direction: 'up',
      source_name: 'U.S. Bureau of Labor Statistics — Occupational Outlook Handbook',
      source_url: 'https://www.bls.gov/ooh/business-and-financial/project-management-specialists.htm',
      as_of: '2024-2034 projection (May 2024 base)', soc_code: '13-1082',
      crosswalk_note: 'Product Manager has no dedicated SOC; mapped to the nearest BLS published occupation, Project Management Specialists (13-1082) — a related but DISTINCT management occupation (~1.05M jobs in 2024, median $100,750). Treat as a directional PROXY for product-management demand, not an exact product-manager figure.',
      crosswalk_quality: 'proxy',
      confidence_basis: 'Source authority is high (U.S. federal statistical agency, 0.9), but the role crosswalk is a proxy (product ≠ project management), so the signal confidence is discounted to 0.7.',
      methodology: 'BLS Employment Projections program, 10-year occupational projection.',
    },
  },
  {
    geography: 'US', signal_type: 'macro_trend', role_id: null, source: 'bls_ep_2024_34',
    metric_value: 7, confidence: 0.9,
    context: {
      title: 'Market research analysts & marketing specialists — projected employment growth (US)',
      metric_unit: 'percent_change_2024_2034', direction: 'up',
      source_name: 'U.S. Bureau of Labor Statistics — Occupational Outlook Handbook',
      source_url: 'https://www.bls.gov/ooh/business-and-financial/market-research-analysts.htm',
      as_of: '2024-2034 projection (May 2024 base)', soc_code: '13-1161',
      crosswalk_note: 'Region-level business-occupation demand signal (no platform role maps to marketing/market-research); broadens US coverage beyond engineering/finance/management. ~941,700 jobs in 2024, median $76,950.',
      confidence_basis: 'U.S. federal statistical agency projection.',
      methodology: 'BLS Employment Projections program, 10-year occupational projection.',
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
    geography: 'EU', signal_type: 'job_demand', role_id: 'role_eng_manager', source: 'eurostat_lfs_2024',
    metric_value: 4.8, confidence: 0.88,
    context: {
      title: 'ICT specialists in employment — year-on-year growth (EU, ICT managers)',
      metric_unit: 'percent_change_year_on_year_2023_2024', direction: 'up',
      source_name: 'Eurostat — EU Labour Force Survey (ICT specialists in employment)',
      source_url: 'https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20250708-2',
      as_of: '2024 (vs 2023)',
      crosswalk_note: 'Engineering Manager maps to ICT service managers (ISCO-08 group 133), which are part of Eurostat\u2019s "ICT specialists" definition; Eurostat does not publish the ISCO-133 sub-group growth separately, so the published all-ICT-specialists YoY growth (+4.8%) is used as the closest measured figure for the management slice. Subset relationship, not a force-map.',
      crosswalk_quality: 'subset',
      confidence_basis: 'EU statistical office, harmonised Labour Force Survey (the manager slice is a subset of the published total).',
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
    geography: 'ME', signal_type: 'emerging_role', role_id: 'role_sr_be_eng', source: 'servicenow_gcc_2024',
    metric_value: 54, confidence: 0.55,
    context: {
      title: 'UAE technology-role demand — projected growth to 2030 (senior)',
      metric_unit: 'percent_growth_to_2030', direction: 'up',
      source_name: 'ServiceNow / Pearson "Enterprise AI Maturity" study (reported via Gulf Business)',
      source_url: 'https://gulfbusiness.com/uae-to-add-tech-jobs-by-2030/',
      as_of: 'to 2030 estimate (2024 report)', country: 'United Arab Emirates',
      crosswalk_note: 'Senior Backend Engineer shares the aggregate UAE tech-role demand population with Backend Engineer; the study does not split by seniority (mirrors the US senior pattern).',
      crosswalk_quality: 'subset',
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

  // ===== ASIA-PACIFIC — Singapore MOM (official) + ManpowerGroup Talent Shortage 2025 =====
  {
    geography: 'APAC', signal_type: 'macro_trend', role_id: null, source: 'sg_mom_lmr_2024',
    metric_value: 44500, confidence: 0.85,
    context: {
      title: 'Singapore — total employment growth in 2024 (official)',
      metric_unit: 'persons_total_employment_change_2024', direction: 'up',
      source_name: 'Singapore Ministry of Manpower — Labour Market Report 4Q 2024',
      source_url: 'https://www.mom.gov.sg/newsroom/press-releases/2025/0319-labour-market-in-4q-2024',
      as_of: '2024 (full year)', country: 'Singapore',
      crosswalk_note: 'Official national-statistics figure: total employment (resident and non-resident) grew by 44,500 in 2024 amid a tight labour market (overall unemployment 1.9% Dec 2024). Raises APAC off consultancy-only with a government source; macro-level, not occupation-specific.',
      confidence_basis: 'National statistical office (Manpower Research & Statistics Department), measured administrative/survey data — higher authority than consultancy surveys.',
      methodology: 'MOM Labour Market Report, total employment change over the calendar year.',
    },
  },
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
  filters: Record<string, unknown>; // real stats + provenance live here
}

const COHORTS: RegionCohortSeed[] = [
  {
    id: 'coh_region_us', geography: 'US', name: 'United States — Labour Market Benchmark (BLS OEWS / EP)',
    filters: {
      provenance: PROVENANCE, currency: 'USD',
      source_name: 'U.S. Bureau of Labor Statistics — OEWS median wages (May 2024) & EP 2024-34',
      as_of: 'May 2024 wages; 2024-2034 projections',
      median_wages_usd: {
        software_developers: { p50: 133080, soc: '15-1252', url: 'https://www.bls.gov/ooh/computer-and-information-technology/software-developers.htm' },
        computer_information_systems_managers: { p50: 171200, soc: '11-3021', url: 'https://www.bls.gov/ooh/management/computer-and-information-systems-managers.htm' },
        project_management_specialists: { p50: 100750, soc: '13-1082', url: 'https://www.bls.gov/ooh/business-and-financial/project-management-specialists.htm' },
        market_research_analysts: { p50: 76950, soc: '13-1161', url: 'https://www.bls.gov/ooh/business-and-financial/market-research-analysts.htm' },
      },
      confidence: 0.9, confidence_basis: 'U.S. federal statistical agency (OEWS survey + EP projections).',
      note: 'Real wage levels (USD, annual median). NOT competency-benchmark statistics — no competency scores are claimed for this cohort.',
    },
  },
  {
    id: 'coh_region_eu', geography: 'EU', name: 'European Union — ICT Workforce Benchmark (Eurostat)',
    filters: {
      provenance: PROVENANCE, currency: 'EUR',
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
      provenance: PROVENANCE,
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
    id: 'coh_region_apac', geography: 'APAC', name: 'Asia-Pacific — Labour Market & Talent Scarcity Benchmark (Singapore MOM + ManpowerGroup)',
    filters: {
      provenance: PROVENANCE,
      sources: [
        { name: 'Singapore Ministry of Manpower — Labour Market Report 4Q 2024', metric: 'Total employment grew by 44,500 in 2024; overall unemployment 1.9% (Dec 2024)', url: 'https://www.mom.gov.sg/newsroom/press-releases/2025/0319-labour-market-in-4q-2024', confidence: 0.85, basis: 'National statistical office (official).' },
        { name: 'ManpowerGroup Talent Shortage 2025 (APAC)', metric: '77% of employers report difficulty filling roles; IT & Data hardest (32%)', url: 'https://go.manpowergroup.com/talent-shortage', confidence: 0.6, basis: 'Large multi-market employer survey (directional).' },
      ],
      as_of: '2024-2025',
      talent_shortage: { employers_reporting_difficulty_pct: 77, vs_2014_pct: 45, vs_global_avg_pct: 74, hardest_skill_areas: { 'IT & Data': 32, Engineering: 27, Sales: 24 } },
      confidence: 0.72, confidence_basis: 'Blend of an official national-statistics labour figure (Singapore MOM, 0.85) and a multi-market employer survey (0.6); raised off consultancy-only by the official source.',
      note: 'Labour-market growth (official, Singapore) + scarcity statistics (survey). NO wages or competency scores are claimed.',
    },
  },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // --- Idempotent cleanup (rollback = this block on its own) ---------------------------------
    await pool.query(`DELETE FROM global_region_content WHERE provenance = $1`, [PROVENANCE]);
    await pool.query(
      `DELETE FROM wos_market_signals WHERE geography = ANY($1) AND source = ANY($2)`,
      [['US', 'EU', 'ME', 'APAC'], Array.from(new Set(SIGNALS.map((s) => s.source)))],
    );
    await pool.query(`DELETE FROM bench_cohorts WHERE id = ANY($1)`, [COHORTS.map((c) => c.id)]);

    // --- 1. Region-native market signals -------------------------------------------------------
    const signalIds: Array<{ id: number; region: string }> = [];
    for (const s of SIGNALS) {
      const { rows } = await pool.query(
        `INSERT INTO wos_market_signals
           (signal_type, role_id, geography, metric_value, metric_unit, direction, confidence, source, context, captured_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, CURRENT_DATE)
         RETURNING id`,
        [s.signal_type, s.role_id, s.geography, s.metric_value, s.context.metric_unit, s.context.direction,
         s.confidence, s.source, JSON.stringify({ ...s.context, provenance: PROVENANCE })],
      );
      signalIds.push({ id: rows[0].id, region: s.geography });
    }

    // --- 2. Region market-benchmark cohorts (real stats; no fabricated competency rows) --------
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

    // --- 3. Thread region-native rows through the region overlay (so each region's surface differs)
    //     assignRegionContent fail-closed validates entity_ref exists in the backing table → insert FIRST.
    for (const sig of signalIds) {
      await pool.query(
        `INSERT INTO global_region_content (surface, region_code, entity_ref, detail, provenance)
         VALUES ('demand_intelligence', $1, $2, $3::jsonb, $4)
         ON CONFLICT (surface, region_code, entity_ref) DO UPDATE SET
           detail = EXCLUDED.detail, provenance = EXCLUDED.provenance`,
        [sig.region, String(sig.id), JSON.stringify({ provenance: PROVENANCE, kind: 'region_native_demand' }), PROVENANCE],
      );
    }
    for (const c of COHORTS) {
      await pool.query(
        `INSERT INTO global_region_content (surface, region_code, entity_ref, detail, provenance)
         VALUES ('benchmarks', $1, $2, $3::jsonb, $4)
         ON CONFLICT (surface, region_code, entity_ref) DO UPDATE SET
           detail = EXCLUDED.detail, provenance = EXCLUDED.provenance`,
        [c.geography, c.id, JSON.stringify({ provenance: PROVENANCE, kind: 'region_native_benchmark' }), PROVENANCE],
      );
    }

    // --- Report --------------------------------------------------------------------------------
    const byRegion = await pool.query(
      `SELECT region_code, surface, COUNT(*)::int n
         FROM global_region_content WHERE provenance = $1
        GROUP BY region_code, surface ORDER BY region_code, surface`,
      [PROVENANCE],
    );
    console.log(`\n[seed-region-native-market] provenance=${PROVENANCE}`);
    console.log(`  market signals inserted: ${signalIds.length}`);
    console.log(`  region benchmark cohorts: ${COHORTS.length}`);
    console.log('  overlay rows by region/surface:');
    for (const r of byRegion.rows) console.log(`    ${r.region_code.padEnd(5)} ${r.surface.padEnd(22)} ${r.n}`);
    console.log('\nDone. Region-native market & benchmark data seeded (all real, provenance-stamped).');
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
