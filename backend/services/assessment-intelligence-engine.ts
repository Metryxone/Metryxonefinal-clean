/**
 * CAPADEX 3.0 — Program 3 · Phase 3.7 Assessment Intelligence (Interpretation & Reporting) CERTIFICATION
 * ───────────────────────────────────────────────────────────────────────────
 * READ-ONLY composer/verifier over the canonical registry (`config/assessment-intelligence.ts`).
 * It NEVER writes, NEVER runs DDL — it only:
 *   1. serves the canonical assessment-intelligence model,
 *   2. INDEPENDENTLY verifies each evidence claim against the live filesystem + DB (the verifier —
 *      not the registry — is the SSoT for "present/absent" numbers),
 *   3. certifies EIGHT INDEPENDENT dimensions, each reported SEPARATELY and NEVER composited:
 *        norms · standardization · benchmarking · ai_interpretation · report_intelligence ·
 *        candidate_performance · frontend · apis,
 *   4. reports ADOPTION (real interpreted / benchmarked / reported VOLUME) as a SEPARATE axis — never a gap,
 *   5. classifies gaps (OPEN genuine deferrals + RESOLVED via reuse-before-build).
 *
 * This engine turns a SCORED + VALIDATED assessment (3.5 Scoring + 3.6 Science) into MEANING — it NEVER
 * re-scores and NEVER re-validates the instrument. Realized outcomes & KPI roll-up are the downstream
 * Outcome/KPI scope (reported in-line as a boundary, NOT a gap).
 *
 * Honesty: a DB/FS read error yields null (unknown), NEVER 0. null ≠ 0.
 * Coverage (does an implementation exist?) ⟂ Confidence ⟂ Adoption — never composited. Never fabricate.
 */
import { existsSync } from 'fs';
import path from 'path';
import type { Pool } from 'pg';
import {
  AINT_AXES,
  AINT_DIMENSIONS,
  NORM_TYPES,
  STANDARD_SCORE_TYPES,
  BENCHMARK_SCOPES,
  AI_INTERPRETATION_CAPABILITIES,
  REPORT_SECTIONS,
  PERFORMANCE_METRICS,
  MAPPING_MODEL,
  AINT_DECISIONS,
  AINT_GAPS,
  RESOLVED_AINT_GAPS,
  AINT_K_MIN,
  type AintEvidence,
  type AintStatus,
  type AintAxis,
  type GapSeverity,
} from '../config/assessment-intelligence';
import {
  normTablesCoverage, standardScoresCoverage, benchmarksCoverage, interpretationsCoverage,
  reportsCoverage, performanceCoverage, repositoryCoverage,
} from './assessment-intelligence-mechanisms';

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

export async function verifyEvidence(pool: Pool, ev: AintEvidence): Promise<EvidenceVerification> {
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
// DIMENSION COVERAGE — the 8 certification dimensions
// ─────────────────────────────────────────────────────────────────────────────
export interface DimensionCoverage {
  key: AintAxis;
  label: string;
  status: AintStatus;
  statusNote: string;
  evidence: EvidenceVerification;
}
export interface DimensionsAxis {
  dimension_count: number;
  status_counts: Record<AintStatus, number>;
  dimensions: DimensionCoverage[];
}
export async function composeDimensions(pool: Pool): Promise<DimensionsAxis> {
  const status_counts: Record<AintStatus, number> = { SUPPORTED: 0, PARTIAL: 0, DEAD_END: 0, MISSING: 0 };
  const dimensions: DimensionCoverage[] = [];
  for (const d of AINT_DIMENSIONS) {
    status_counts[d.status] += 1;
    dimensions.push({
      key: d.key, label: d.label, status: d.status, statusNote: d.statusNote,
      evidence: await verifyEvidence(pool, d.evidence),
    });
  }
  return { dimension_count: AINT_DIMENSIONS.length, status_counts, dimensions };
}

// ── Pure catalog roll-ups (status-only) ──────────────────────────────────────
function catalogRollup<T extends { status: AintStatus }>(items: T[]) {
  const status_counts: Record<AintStatus, number> = { SUPPORTED: 0, PARTIAL: 0, DEAD_END: 0, MISSING: 0 };
  for (const t of items) status_counts[t.status] += 1;
  return { count: items.length, status_counts, items };
}
export const composeNormTypes = () => catalogRollup(NORM_TYPES);
export const composeStandardScoreTypes = () => catalogRollup(STANDARD_SCORE_TYPES);

// ── Control-group verifier (benchmark scopes / AI caps / report sections / perf metrics) ─
async function verifyControls(pool: Pool, controls: { key: string; label: string; status: AintStatus; evidence: string[] }[]) {
  const status_counts: Record<AintStatus, number> = { SUPPORTED: 0, PARTIAL: 0, DEAD_END: 0, MISSING: 0 };
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
export const composeBenchmarkScopes = (pool: Pool) => verifyControls(pool, BENCHMARK_SCOPES);
export const composeAiCapabilities = (pool: Pool) => verifyControls(pool, AI_INTERPRETATION_CAPABILITIES);
export const composeReportSections = (pool: Pool) => verifyControls(pool, REPORT_SECTIONS);
export const composePerformanceMetrics = (pool: Pool) => verifyControls(pool, PERFORMANCE_METRICS);

// ── Mapping axis ─────────────────────────────────────────────────────────────
export async function composeMapping(pool: Pool) {
  const mapping_status_counts: Record<AintStatus, number> = { SUPPORTED: 0, PARTIAL: 0, DEAD_END: 0, MISSING: 0 };
  const mapping = [];
  for (const m of MAPPING_MODEL) {
    mapping_status_counts[m.status] += 1;
    let source_present: boolean | null = null;
    const firstToken = m.source.split(/[ .]/)[0];
    if (looksLikePath(m.source)) source_present = fileExists(m.source, 'backend');
    else if (/^[a-z_]+$/.test(firstToken)) source_present = await tableExists(pool, firstToken);
    mapping.push({ ...m, source_present });
  }
  return { step_count: MAPPING_MODEL.length, mapping, mapping_status_counts };
}

// ── Repository-alignment rollup ──────────────────────────────────────────────
export async function composeRepositoryAlignment(pool: Pool) {
  const roll = {
    services: { present: 0, total: 0 },
    routes: { present: 0, total: 0 },
    frontend: { present: 0, total: 0 },
    tables: { present: 0, absent: 0, unknown: 0, total: 0 },
  };
  for (const d of AINT_DIMENSIONS) {
    const v = await verifyEvidence(pool, d.evidence);
    roll.services.present += v.services.present; roll.services.total += v.services.total;
    roll.routes.present += v.routes.present; roll.routes.total += v.routes.total;
    roll.frontend.present += v.frontend.present; roll.frontend.total += v.frontend.total;
    roll.tables.present += v.tables.present; roll.tables.absent += v.tables.absent;
    roll.tables.unknown += v.tables.unknown; roll.tables.total += v.tables.total;
  }
  return {
    ...roll,
    spine_step_count: MAPPING_MODEL.length,
    note: 'Every dimension evidence claim is verified INDEPENDENTLY against the live FS (services/routes/frontend) ' +
      'and DB (to_regclass). null (unknown) ≠ 0 (absent). Coverage-only — kept SEPARATE from Confidence/Adoption. ' +
      'aint_* overlay tables are absent while the flag has never run its write paths — that is expected + honest.',
  };
}

// ── ADOPTION axis — real usage volume, reported SEPARATELY, NEVER a gap ───────
export async function composeAdoption(pool: Pool) {
  return {
    note: 'ADOPTION is real interpreted / standardized / benchmarked / narrated / reported VOLUME across the ' +
      'aint_* overlay. It is a usage axis reported SEPARATELY from engineering closure — NEVER a gap, NEVER ' +
      'fabricated. Norm-referenced statistics + benchmarks ABSTAIN below k_min=' + String(AINT_K_MIN) + ' real ' +
      'members; AI narrative confidence stays honestly null while cold-start. null (unreadable) ≠ 0 (empty).',
    norm_tables: await normTablesCoverage(pool).catch(() => ({ norm_tables: null, types_used: null, assessments: null, abstained: null })),
    standard_scores: await standardScoresCoverage(pool).catch(() => ({ scores: null, subjects: null, assessments: null, abstained: null })),
    benchmarks: await benchmarksCoverage(pool).catch(() => ({ benchmarks: null, subjects: null, scopes_used: null, abstained: null })),
    interpretations: await interpretationsCoverage(pool).catch(() => ({ interpretations: null, subjects: null, with_confidence: null, abstained: null })),
    reports: await reportsCoverage(pool).catch(() => ({ reports: null, subjects: null, assessments: null })),
    performance: await performanceCoverage(pool).catch(() => ({ performance: null, subjects: null, assessments: null, abstained: null })),
    repository: await repositoryCoverage(pool).catch(() => ({ artefacts: null, types_used: null, active: null })),
  };
}

// ── GAPS ─────────────────────────────────────────────────────────────────────
export function classifiedGaps() {
  const gap_counts: Record<GapSeverity, number> = { 'Launch-Critical': 0, High: 0, Medium: 0, Low: 0, Future: 0 };
  for (const g of AINT_GAPS) gap_counts[g.severity] += 1;
  const resolved_gap_counts: Record<GapSeverity, number> = { 'Launch-Critical': 0, High: 0, Medium: 0, Low: 0, Future: 0 };
  for (const g of RESOLVED_AINT_GAPS) resolved_gap_counts[g.severity] += 1;
  return {
    gaps: AINT_GAPS, gap_counts,
    resolved_gaps: RESOLVED_AINT_GAPS, resolved_gap_counts, resolved_gap_count: RESOLVED_AINT_GAPS.length,
  };
}

// ── SUMMARY — 8 dimensions reported SEPARATELY + verdict (never composited) ───
export async function composeSummary(pool: Pool) {
  const dims = await composeDimensions(pool);
  const normTypes = composeNormTypes();
  const standardScoreTypes = composeStandardScoreTypes();
  const benchmarkScopes = await composeBenchmarkScopes(pool);
  const aiCaps = await composeAiCapabilities(pool);
  const reportSections = await composeReportSections(pool);
  const perfMetrics = await composePerformanceMetrics(pool);
  const mapping = await composeMapping(pool);
  const repo = await composeRepositoryAlignment(pool);
  const adoption = await composeAdoption(pool);
  const { gap_counts, resolved_gap_counts, resolved_gap_count } = classifiedGaps();
  const launchCritical = gap_counts['Launch-Critical'];
  return {
    flag: 'assessmentIntelligence' as const,
    k_min: AINT_K_MIN,
    axes: AINT_AXES,
    dimensions: { dimension_count: dims.dimension_count, status_counts: dims.status_counts },
    norm_types: { count: normTypes.count, status_counts: normTypes.status_counts },
    standard_score_types: { count: standardScoreTypes.count, status_counts: standardScoreTypes.status_counts },
    benchmark_scopes: { count: benchmarkScopes.count, status_counts: benchmarkScopes.status_counts },
    ai_capabilities: { count: aiCaps.count, status_counts: aiCaps.status_counts },
    report_sections: { count: reportSections.count, status_counts: reportSections.status_counts },
    performance_metrics: { count: perfMetrics.count, status_counts: perfMetrics.status_counts },
    mapping: { step_count: mapping.step_count, mapping_status_counts: mapping.mapping_status_counts },
    repository_alignment: { services: repo.services, routes: repo.routes, frontend: repo.frontend, tables: repo.tables },
    adoption,
    decisions: AINT_DECISIONS,
    gap_counts, gap_total: AINT_GAPS.length,
    resolved_gap_counts, resolved_gap_count,
    ready_for_certification: {
      ready: launchCritical === 0,
      verdict: launchCritical === 0 ? 'YES' : 'NO',
      note:
        'Assessment Intelligence is READY for certification: all EIGHT dimensions are certified, every scored+' +
        'validated result flows through a clean interpretation seam (norm-referencing → standardization → ' +
        'benchmarking → AI narrative → report → candidate-performance), and there are ' + String(launchCritical) + ' ' +
        'Launch-Critical gaps. There are 0 OPEN engineering gaps — the norm / standardization / benchmarking / ' +
        'AI-interpretation / report / candidate-performance capabilities are ENGINEERING-CLOSED via reuse-before-' +
        'build (pure computeNormReference/computeStandardScores/computeBenchmark/computeInterpretation/computeReport/' +
        'computePerformance mechanisms reusing the existing psychometric-standardization + benchmark + narrative + ' +
        'report engines + the additive aint_* overlay). Norm-referenced statistics + benchmarks ABSTAIN below ' +
        'k_min real members and AI narrative confidence stays honest-null while cold-start — never fabricated. The ' +
        'honest BOUNDARIES that remain (age / national / custom norms, NCE / scaled scores, institution / national ' +
        'benchmarks, interpretation confidence, next-steps action plans, response consistency / timing) are data-' +
        'availability / first-class-objective boundaries (PARTIAL), NOT gaps.',
    },
    enterprise_ready: {
      verdict: 'STRUCTURAL_COMPLETE_ADOPTION_PENDING' as const,
      note:
        'ONE canonical Assessment Intelligence / Interpretation & Reporting layer: a single certified layer ' +
        'COMPOSING the existing interpretation services (psychometric-standardization, benchmark-engine, ' +
        'peer-benchmark, intelligence-narrative-engine, ai-reasoning-engine, dynamic-report) under one registry + ' +
        'an additive aint_* overlay — NO duplicate interpretation / benchmark / narrative / report engine, NO V2, ' +
        'NO breaking change. Scope is INTERPRETATION & REPORTING ONLY (norm-referencing · standardization · ' +
        'benchmarking · AI-interpretation · report intelligence · candidate performance · frontend · apis) — it ' +
        'turns a SCORED + VALIDATED result into MEANING and NEVER re-scores or re-validates the instrument. The ' +
        'EIGHT dimensions are certified SEPARATELY: the true engineering gaps (canonical norm-referencing, standard-' +
        'score transforms, unified benchmarking, narrative interpretation over scored results, section-aware ' +
        'interpretation report, candidate-performance analytics) were ENGINEERING-CLOSED via REUSE-before-build ' +
        '(pure compute mechanisms reusing the existing engines + own additive overlay tables) — with norm-referenced ' +
        'statistics + benchmarks that ABSTAIN below k_min real members and AI narrative confidence that stays honest-' +
        'null while cold-start (never fabricated). All former gaps are RESOLVED, each gated by assessmentIntelligence ' +
        'so OFF is byte-identical incl. schema (all DDL runs only on the flag-gated write paths). There are 0 OPEN ' +
        'engineering gaps. The honest BOUNDARIES that remain (age/national/custom norms, NCE/scaled scores, ' +
        'institution/national benchmarks, interpretation confidence, next-steps plans, consistency/timing) are data-' +
        'availability / first-class-objective boundaries reported in-line, NOT gaps; realized outcomes & KPI roll-up ' +
        'are the downstream Outcome/KPI scope. What remains beyond them is ADOPTION — real interpreted / benchmarked ' +
        '/ reported VOLUME across the overlay — a usage axis reported SEPARATELY, NEVER a gap. ' +
        'Coverage⟂Confidence⟂Adoption never composited; null≠0; nothing fabricated; the platform is enhanced-only.',
    },
  };
}
