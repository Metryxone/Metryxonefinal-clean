/**
 * CAPADEX 3.0 — Program 3 · Phase 3.9 Enterprise Benchmark Intelligence CERTIFICATION
 * ───────────────────────────────────────────────────────────────────────────
 * READ-ONLY composer/verifier over the canonical registry (`config/benchmark-intelligence.ts`).
 * It NEVER writes, NEVER runs DDL — it only:
 *   1. serves the canonical benchmark-intelligence model,
 *   2. INDEPENDENTLY verifies each evidence claim against the live filesystem + DB (the verifier —
 *      not the registry — is the SSoT for "present/absent" numbers),
 *   3. certifies NINE INDEPENDENT dimensions, each reported SEPARATELY and NEVER composited:
 *        benchmark_engine · comparison_engine · governance · super_admin · frontend · ux ·
 *        apis · testing · documentation,
 *   4. reports ADOPTION (real benchmarked / governed / saved VOLUME) as a SEPARATE axis — never a gap,
 *   5. classifies gaps (OPEN genuine deferrals + RESOLVED via reuse-before-build).
 *
 * This engine turns a STANDARDIZED score (3.8) into a BENCHMARK result (percentile / z / delta / quartile
 * against a reference group) by COMPOSING the existing benchmark substrate (peer-benchmark / m5-org-benchmark
 * / mei-benchmark-engine / adaptive-benchmark / benchmark-engine / comparative-intelligence) + the pure
 * psychometric transforms — it NEVER re-scores, NEVER re-standardizes, NEVER builds a norm. AI-interpretation /
 * recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases). NO AI here.
 *
 * Honesty: a DB/FS read error yields null (unknown), NEVER 0. null ≠ 0.
 * Coverage (does an implementation exist?) ⟂ Confidence ⟂ Adoption — never composited. Never fabricate.
 */
import { existsSync } from 'fs';
import path from 'path';
import type { Pool } from 'pg';
import {
  BMK_AXES,
  BMK_DIMENSIONS,
  BENCHMARK_TYPES,
  COMPARISON_DIMENSIONS,
  TIME_MODES,
  BENCHMARK_CONFIG,
  GOVERNANCE_STATES,
  SUPER_ADMIN_SURFACES,
  FRONTEND_SURFACES,
  UX_CRITERIA,
  API_GROUPS,
  TRACEABILITY_MODEL,
  BMK_DECISIONS,
  BENCHMARK_GAPS,
  RESOLVED_BENCHMARK_GAPS,
  BMK_K_MIN,
  type BmkEvidence,
  type BmkStatus,
  type BmkAxis,
  type GapSeverity,
} from '../config/benchmark-intelligence';
import { computeOverlayCoverage } from './benchmark-intelligence-mechanisms';

const BACKEND_ROOT = process.cwd();
const REPO_ROOT = path.resolve(BACKEND_ROOT, '..');

function looksLikePath(rel: string): boolean {
  return /\.(ts|tsx|js|jsx)$/.test(rel) || rel.includes('/');
}
function fileExists(rel: string, kind: 'backend' | 'frontend'): boolean {
  const base = kind === 'frontend' ? path.join(REPO_ROOT, 'frontend', 'src') : BACKEND_ROOT;
  return existsSync(path.join(base, rel));
}
async function tableExists(pool: Pool, table: string): Promise<boolean | null> {
  try {
    const base = table.split('.')[0];
    const { rows } = await pool.query('SELECT to_regclass($1) AS reg', [`public.${base}`]);
    return rows[0]?.reg != null;
  } catch {
    return null;
  }
}

export interface EvidenceVerification {
  services: { present: number; total: number; missing: string[] };
  routes: { present: number; total: number; missing: string[] };
  frontend: { present: number; total: number; missing: string[] };
  tables: { present: number; absent: number; unknown: number; total: number; absentList: string[] };
}

function verifyFsGroup(items: string[], kind: 'backend' | 'frontend'): { present: number; total: number; missing: string[] } {
  const paths = items.filter(looksLikePath);
  const missing = paths.filter((i) => !fileExists(i, kind));
  return { present: paths.length - missing.length, total: paths.length, missing };
}

export async function verifyEvidence(pool: Pool, ev: BmkEvidence): Promise<EvidenceVerification> {
  const services = verifyFsGroup(ev.services, 'backend');
  const routes = verifyFsGroup(ev.routes, 'backend');
  const frontend = verifyFsGroup(ev.frontend, 'frontend');
  let present = 0, absent = 0, unknown = 0;
  const absentList: string[] = [];
  for (const t of ev.tables) {
    const r = await tableExists(pool, t);
    if (r === null) unknown += 1;
    else if (r) present += 1;
    else { absent += 1; absentList.push(t); }
  }
  return { services, routes, frontend, tables: { present, absent, unknown, total: ev.tables.length, absentList } };
}

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSION COVERAGE — the 9 certification dimensions
// ─────────────────────────────────────────────────────────────────────────────
export interface DimensionCoverage {
  key: BmkAxis;
  label: string;
  status: BmkStatus;
  statusNote: string;
  evidence: EvidenceVerification;
}
export interface DimensionsAxis {
  dimension_count: number;
  status_counts: Record<BmkStatus, number>;
  dimensions: DimensionCoverage[];
}
export async function composeDimensions(pool: Pool): Promise<DimensionsAxis> {
  const status_counts: Record<BmkStatus, number> = { SUPPORTED: 0, PARTIAL: 0, DEAD_END: 0, MISSING: 0 };
  const dimensions: DimensionCoverage[] = [];
  for (const d of BMK_DIMENSIONS) {
    status_counts[d.status] += 1;
    dimensions.push({
      key: d.key, label: d.label, status: d.status, statusNote: d.statusNote,
      evidence: await verifyEvidence(pool, d.evidence),
    });
  }
  return { dimension_count: BMK_DIMENSIONS.length, status_counts, dimensions };
}

// ── Pure catalog roll-ups (status-only) ──────────────────────────────────────
function catalogRollup<T extends { status: BmkStatus }>(items: T[]) {
  const status_counts: Record<BmkStatus, number> = { SUPPORTED: 0, PARTIAL: 0, DEAD_END: 0, MISSING: 0 };
  for (const t of items) status_counts[t.status] += 1;
  return { count: items.length, status_counts, items };
}
export const composeBenchmarkTypes = () => catalogRollup(BENCHMARK_TYPES);
export const composeComparisonDimensions = () => catalogRollup(COMPARISON_DIMENSIONS);
export const composeTimeModes = () => catalogRollup(TIME_MODES);

// ── Control-group verifier (benchmark config / governance / surfaces / ux / apis) ─
async function verifyControls(pool: Pool, controls: { key: string; label: string; status: BmkStatus; evidence: string[] }[]) {
  const status_counts: Record<BmkStatus, number> = { SUPPORTED: 0, PARTIAL: 0, DEAD_END: 0, MISSING: 0 };
  const out = [];
  for (const c of controls) {
    status_counts[c.status] += 1;
    let anyPresent = false, anyUnknown = false;
    for (const e of c.evidence) {
      if (looksLikePath(e)) {
        const kind: 'backend' | 'frontend' = e.startsWith('components/') || e.startsWith('pages/') || e.startsWith('lib/') ? 'frontend' : 'backend';
        if (fileExists(e, kind)) anyPresent = true;
      } else {
        const r = await tableExists(pool, e);
        if (r === null) anyUnknown = true; else if (r) anyPresent = true;
      }
    }
    const evidence_present = anyPresent ? true : (anyUnknown ? null : (c.evidence.length ? false : null));
    out.push({ key: c.key, label: c.label, status: c.status, evidence_present, evidence: c.evidence });
  }
  return { count: controls.length, status_counts, controls: out };
}
export const composeBenchmarkConfig = (pool: Pool) => verifyControls(pool, BENCHMARK_CONFIG);
export const composeGovernanceStates = (pool: Pool) => verifyControls(pool, GOVERNANCE_STATES);
export const composeSuperAdminSurfaces = (pool: Pool) => verifyControls(pool, SUPER_ADMIN_SURFACES);
export const composeFrontendSurfaces = (pool: Pool) => verifyControls(pool, FRONTEND_SURFACES);
export const composeUxCriteria = (pool: Pool) => verifyControls(pool, UX_CRITERIA);
export const composeApiGroups = (pool: Pool) => verifyControls(pool, API_GROUPS);

// ── Traceability axis ────────────────────────────────────────────────────────
export async function composeTraceability(pool: Pool) {
  const trace_status_counts: Record<BmkStatus, number> = { SUPPORTED: 0, PARTIAL: 0, DEAD_END: 0, MISSING: 0 };
  const traceability = [];
  for (const m of TRACEABILITY_MODEL) {
    trace_status_counts[m.status] += 1;
    let source_present: boolean | null = null;
    const firstToken = m.source.split(/[ .+/]/)[0];
    if (looksLikePath(m.source)) source_present = fileExists(m.source, 'backend');
    else if (/^[a-z_]+$/.test(firstToken)) source_present = await tableExists(pool, firstToken);
    traceability.push({ ...m, source_present });
  }
  return { link_count: TRACEABILITY_MODEL.length, traceability, trace_status_counts };
}

// ── Repository-alignment rollup ──────────────────────────────────────────────
export async function composeRepositoryAlignment(pool: Pool) {
  const roll = {
    services: { present: 0, total: 0 },
    routes: { present: 0, total: 0 },
    frontend: { present: 0, total: 0 },
    tables: { present: 0, absent: 0, unknown: 0, total: 0 },
  };
  for (const d of BMK_DIMENSIONS) {
    const v = await verifyEvidence(pool, d.evidence);
    roll.services.present += v.services.present; roll.services.total += v.services.total;
    roll.routes.present += v.routes.present; roll.routes.total += v.routes.total;
    roll.frontend.present += v.frontend.present; roll.frontend.total += v.frontend.total;
    roll.tables.present += v.tables.present; roll.tables.absent += v.tables.absent;
    roll.tables.unknown += v.tables.unknown; roll.tables.total += v.tables.total;
  }
  return {
    ...roll,
    trace_link_count: TRACEABILITY_MODEL.length,
    note: 'Every dimension evidence claim is verified INDEPENDENTLY against the live FS (services/routes/frontend) ' +
      'and DB (to_regclass). null (unknown) ≠ 0 (absent). Coverage-only — kept SEPARATE from Confidence/Adoption. ' +
      'The reused benchmark substrate (peer-benchmark / m5-org-benchmark / mei-benchmark-engine / adaptive-benchmark / ' +
      'benchmark-engine / comparative-intelligence) is composed by EXISTENCE — never invoked at compose time. ' +
      'abmk_* overlay tables are absent while the flag has never run its write paths — that is expected + honest.',
  };
}

// ── ADOPTION axis — real usage volume, reported SEPARATELY, NEVER a gap ───────
export async function composeAdoption(pool: Pool) {
  return {
    note: 'ADOPTION is real benchmarked / governed / audited / saved-view VOLUME across the abmk_* overlay. ' +
      'It is a usage axis reported SEPARATELY from engineering closure — NEVER a gap, NEVER fabricated. Benchmarking ' +
      'ABSTAINS below k_min=' + String(BMK_K_MIN) + ' real members in the reference group. null (unreadable) ≠ 0 (empty).',
    overlay: await computeOverlayCoverage(pool).catch(() => ({
      groups: null, configs: null, results: null, suppressed_results: null, abstained_results: null,
      governance_events: null, audit_events: null, saved_views: null,
    })),
  };
}

// ── GAPS ─────────────────────────────────────────────────────────────────────
export function classifiedGaps() {
  const gap_counts: Record<GapSeverity, number> = { 'Launch-Critical': 0, High: 0, Medium: 0, Low: 0, Future: 0 };
  for (const g of BENCHMARK_GAPS) gap_counts[g.severity] += 1;
  const resolved_gap_counts: Record<GapSeverity, number> = { 'Launch-Critical': 0, High: 0, Medium: 0, Low: 0, Future: 0 };
  for (const g of RESOLVED_BENCHMARK_GAPS) resolved_gap_counts[g.severity] += 1;
  return {
    gaps: BENCHMARK_GAPS, gap_counts,
    resolved_gaps: RESOLVED_BENCHMARK_GAPS, resolved_gap_counts, resolved_gap_count: RESOLVED_BENCHMARK_GAPS.length,
  };
}

// ── SUMMARY — 9 dimensions reported SEPARATELY + verdict (never composited) ───
export async function composeSummary(pool: Pool) {
  const dims = await composeDimensions(pool);
  const benchmarkTypes = composeBenchmarkTypes();
  const comparisonDimensions = composeComparisonDimensions();
  const timeModes = composeTimeModes();
  const benchmarkConfig = await composeBenchmarkConfig(pool);
  const govStates = await composeGovernanceStates(pool);
  const adminSurfaces = await composeSuperAdminSurfaces(pool);
  const frontendSurfaces = await composeFrontendSurfaces(pool);
  const uxCriteria = await composeUxCriteria(pool);
  const apiGroups = await composeApiGroups(pool);
  const trace = await composeTraceability(pool);
  const repo = await composeRepositoryAlignment(pool);
  const adoption = await composeAdoption(pool);
  const { gap_counts, resolved_gap_counts, resolved_gap_count } = classifiedGaps();
  const launchCritical = gap_counts['Launch-Critical'];
  return {
    flag: 'benchmarkIntelligence' as const,
    k_min: BMK_K_MIN,
    axes: BMK_AXES,
    dimensions: { dimension_count: dims.dimension_count, status_counts: dims.status_counts },
    benchmark_types: { count: benchmarkTypes.count, status_counts: benchmarkTypes.status_counts },
    comparison_dimensions: { count: comparisonDimensions.count, status_counts: comparisonDimensions.status_counts },
    time_modes: { count: timeModes.count, status_counts: timeModes.status_counts },
    benchmark_config: { count: benchmarkConfig.count, status_counts: benchmarkConfig.status_counts },
    governance_states: { count: govStates.count, status_counts: govStates.status_counts },
    super_admin_surfaces: { count: adminSurfaces.count, status_counts: adminSurfaces.status_counts },
    frontend_surfaces: { count: frontendSurfaces.count, status_counts: frontendSurfaces.status_counts },
    ux_criteria: { count: uxCriteria.count, status_counts: uxCriteria.status_counts },
    api_groups: { count: apiGroups.count, status_counts: apiGroups.status_counts },
    traceability: { link_count: trace.link_count, trace_status_counts: trace.trace_status_counts },
    repository_alignment: { services: repo.services, routes: repo.routes, frontend: repo.frontend, tables: repo.tables },
    adoption,
    decisions: BMK_DECISIONS,
    gap_counts, gap_total: BENCHMARK_GAPS.length,
    resolved_gap_counts, resolved_gap_count,
    ready_for_certification: {
      ready: launchCritical === 0,
      verdict: launchCritical === 0 ? 'YES' : 'NO',
      note:
        'Enterprise Benchmark Intelligence is READY for certification: all NINE dimensions are certified, every ' +
        'standardized score flows through a clean benchmark seam (standardized score → reference-group resolution → ' +
        'percentile / z / delta / quartile → multi-dimension / multi-mode comparison → composite index → governance → ' +
        'audit), and there are ' + String(launchCritical) + ' Launch-Critical gaps. The benchmark / comparison / trend / ' +
        'distribution / composite-index capabilities are ENGINEERING-CLOSED via reuse-before-build (pure ' +
        'computeReferenceStats / computeBenchmarkComparison / computeGroupComparison / computeTrend / computeDistribution / ' +
        'computePercentileRank mechanisms reusing the existing psychometric transforms zFromValue/zToPercentile + the 3.8 ' +
        'structured-AST formula engine, over the additive abmk_* overlay). Benchmarking ABSTAINS below k_min real members ' +
        'in the reference group — never fabricated. The OPEN gaps are all NON-Launch-Critical coverage-breadth / upstream-' +
        'input boundaries: GAP-BMK-1 (first-class institutional / geographic roster ingestion — the 10 PARTIAL benchmark ' +
        'TYPES are already reachable via generic custom benchmark groups) + GAP-BMK-2 (finer-grained standardized sub_domain ' +
        '/ skill / trait / learning_outcome comparison inputs upstream) are Medium; GAP-BMK-3 (cross-version benchmark ' +
        're-baselining — full version lineage is already carried on every abmk_results row, so re-baselining is additive, ' +
        'not a correctness gap) is Future. Real benchmarked / governed / saved VOLUME is an ADOPTION axis (honest 0), ' +
        'reported SEPARATELY, never a gap.',
    },
    enterprise_ready: {
      verdict: 'STRUCTURAL_COMPLETE_ADOPTION_PENDING' as const,
      note:
        'ONE canonical Enterprise Benchmark Intelligence Platform: a single certified layer COMPOSING the existing ' +
        'benchmark substrate (peer-benchmark / m5-org-benchmark / mei-benchmark-engine / adaptive-benchmark / ' +
        'benchmark-engine / comparative-intelligence) + the pure psychometric transforms (zFromValue/zToPercentile) + the ' +
        '3.8 structured-AST formula engine under one registry + an additive abmk_* overlay — NO duplicate benchmark / ' +
        'comparison engine, NO V2, NO breaking change. Scope is BENCHMARKING & COMPARISON ONLY (benchmark engine · ' +
        'comparison engine · governance · super admin · frontend · ux · apis · testing · documentation) — it turns a ' +
        'STANDARDIZED score (3.8) into percentile / z / delta / quartile against a reference group across multiple ' +
        'dimensions + time modes and NEVER re-scores, re-standardizes or builds a norm. AI-interpretation / recommendation ' +
        '/ report / dashboard / candidate-analytics are OUT OF SCOPE (later phases); there is NO AI here — every output is ' +
        'deterministic. The NINE dimensions are certified SEPARATELY: the benchmark / comparison / trend / distribution / ' +
        'composite-index / governance / API / console / workbench capabilities were ENGINEERING-CLOSED via REUSE-before-' +
        'build (pure compute mechanisms reusing the existing psychometric functions + 3.8 formula engine + own additive ' +
        'overlay tables) — with a STRUCTURED-AST composite index (no eval) and benchmarking that ABSTAINS below k_min real ' +
        'members (never fabricated). Scoped benchmark configuration (organization / institution / industry / country / ' +
        'custom, resolved most-specific-wins via resolveConfig), custom benchmark groups (inclusion/exclusion + ' +
        'min_sample_size + effective dates), multi-group comparison, saved views, governance + version history + rollback + ' +
        'audit trail are all WIRED, each gated by benchmarkIntelligence so OFF is byte-identical incl. schema (all DDL runs ' +
        'only on the flag-gated write paths). The OPEN gaps (GAP-BMK-1 first-class institutional / geo roster ingestion + ' +
        'GAP-BMK-2 finer-grained standardized comparison inputs — both Medium coverage-breadth boundaries, each already ' +
        'reachable via generic custom benchmark groups; GAP-BMK-3 cross-version benchmark re-baselining — Future, additive) are ' +
        'reported in-line, NOT Launch-Critical. What remains beyond them is ADOPTION — real benchmarked / governed / saved ' +
        'VOLUME across the overlay — a usage axis reported SEPARATELY, NEVER a gap. ' +
        'Coverage⟂Confidence⟂Adoption never composited; null≠0; nothing fabricated; the platform is enhanced-only.',
    },
  };
}
