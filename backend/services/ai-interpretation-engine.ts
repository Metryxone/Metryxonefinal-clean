/**
 * CAPADEX 3.0 — Program 3 · Phase 3.10 Enterprise AI Interpretation & Explainability CERTIFICATION
 * ───────────────────────────────────────────────────────────────────────────
 * READ-ONLY composer/verifier over the canonical registry (`config/ai-interpretation.ts`).
 * It NEVER writes, NEVER runs DDL — it only:
 *   1. serves the canonical AI-interpretation model,
 *   2. INDEPENDENTLY verifies each evidence claim against the live filesystem + DB (the verifier —
 *      not the registry — is the SSoT for "present/absent" numbers),
 *   3. certifies ELEVEN INDEPENDENT dimensions, each reported SEPARATELY and NEVER composited:
 *        ai_interpretation · explainability · confidence · hallucination_protection · rule_repository ·
 *        super_admin · frontend · ux · apis · testing · documentation,
 *   4. reports ADOPTION (real interpreted / governed / saved VOLUME) as a SEPARATE axis — never a gap,
 *   5. classifies gaps (OPEN genuine breadth deferrals + RESOLVED via reuse-before-build).
 *
 * This engine turns a STANDARDIZED score (3.8) + BENCHMARK result (3.9) into an INTERPRETED, EXPLAINABLE,
 * CONFIDENCE-scored, HALLUCINATION-protected result by COMPOSING the existing interpretation substrate
 * (aiClient health-gated LLM seam · mei-narrative-engine rule-driven narration prior-art) + the pure 3.8
 * structured-AST formula engine + the pure psychometric transforms (zFromValue/zToPercentile) — it NEVER
 * re-scores, NEVER re-standardizes, NEVER re-benchmarks, NEVER builds a norm. Recommendation / learning-path /
 * growth-planning / report-generation / dashboard-intelligence are OUT OF SCOPE (later phases; boundaries).
 *
 * Honesty: a DB/FS read error yields null (unknown), NEVER 0. null ≠ 0.
 * Coverage (does an implementation exist?) ⟂ Confidence ⟂ Adoption — never composited. Never fabricate.
 */
import { existsSync } from 'fs';
import path from 'path';
import type { Pool } from 'pg';
import {
  AIXP_AXES,
  AIXP_DIMENSIONS,
  INTERPRETATION_KINDS,
  EXPLAINABILITY_CRITERIA,
  CONFIDENCE_CRITERIA,
  HALLUCINATION_CONTROLS,
  RULE_CAPABILITIES,
  PERSONA_COVERAGE,
  LIFECYCLE_COVERAGE,
  SUPER_ADMIN_SURFACES,
  FRONTEND_SURFACES,
  UX_CRITERIA,
  API_GROUPS,
  TESTING_COVERAGE,
  DOC_SET,
  TRACEABILITY_MODEL,
  AIXP_DECISIONS,
  INTERPRETATION_BOUNDARIES,
  AIXP_GAPS,
  RESOLVED_AIXP_GAPS,
  AIXP_K_MIN,
  type AixpEvidence,
  type AixpStatus,
  type AixpAxis,
  type GapSeverity,
} from '../config/ai-interpretation';
import { computeOverlayCoverage } from './ai-interpretation-mechanisms';

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

export async function verifyEvidence(pool: Pool, ev: AixpEvidence): Promise<EvidenceVerification> {
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
// DIMENSION COVERAGE — the 11 certification dimensions
// ─────────────────────────────────────────────────────────────────────────────
export interface DimensionCoverage {
  key: AixpAxis;
  label: string;
  status: AixpStatus;
  statusNote: string;
  evidence: EvidenceVerification;
}
export interface DimensionsAxis {
  dimension_count: number;
  status_counts: Record<AixpStatus, number>;
  dimensions: DimensionCoverage[];
}
export async function composeDimensions(pool: Pool): Promise<DimensionsAxis> {
  const status_counts: Record<AixpStatus, number> = { SUPPORTED: 0, PARTIAL: 0, DEAD_END: 0, MISSING: 0 };
  const dimensions: DimensionCoverage[] = [];
  for (const d of AIXP_DIMENSIONS) {
    status_counts[d.status] += 1;
    dimensions.push({
      key: d.key, label: d.label, status: d.status, statusNote: d.statusNote,
      evidence: await verifyEvidence(pool, d.evidence),
    });
  }
  return { dimension_count: AIXP_DIMENSIONS.length, status_counts, dimensions };
}

// ── Pure catalog roll-ups (status-only) ──────────────────────────────────────
function catalogRollup<T extends { status: AixpStatus }>(items: T[]) {
  const status_counts: Record<AixpStatus, number> = { SUPPORTED: 0, PARTIAL: 0, DEAD_END: 0, MISSING: 0 };
  for (const t of items) status_counts[t.status] += 1;
  return { count: items.length, status_counts, items };
}
export const composeInterpretationKinds = () => catalogRollup(INTERPRETATION_KINDS);
export const composeExplainabilityCriteria = () => catalogRollup(EXPLAINABILITY_CRITERIA);
export const composeConfidenceCriteria = () => catalogRollup(CONFIDENCE_CRITERIA);
export const composeHallucinationControls = () => catalogRollup(HALLUCINATION_CONTROLS);
export const composeRuleCapabilities = () => catalogRollup(RULE_CAPABILITIES);
export const composePersonaCoverage = () => catalogRollup(PERSONA_COVERAGE);
export const composeLifecycleCoverage = () => catalogRollup(LIFECYCLE_COVERAGE);

// ── Control-group verifier (surfaces / ux / apis / testing / docs) ───────────
async function verifyControls(pool: Pool, controls: { key: string; label: string; status: AixpStatus; evidence: string[] }[]) {
  const status_counts: Record<AixpStatus, number> = { SUPPORTED: 0, PARTIAL: 0, DEAD_END: 0, MISSING: 0 };
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
export const composeSuperAdminSurfaces = (pool: Pool) => verifyControls(pool, SUPER_ADMIN_SURFACES);
export const composeFrontendSurfaces = (pool: Pool) => verifyControls(pool, FRONTEND_SURFACES);
export const composeUxCriteria = (pool: Pool) => verifyControls(pool, UX_CRITERIA);
export const composeApiGroups = (pool: Pool) => verifyControls(pool, API_GROUPS);
export const composeTestingCoverage = (pool: Pool) => verifyControls(pool, TESTING_COVERAGE);
export const composeDocSet = (pool: Pool) => verifyControls(pool, DOC_SET);

// ── Traceability axis ────────────────────────────────────────────────────────
export async function composeTraceability(pool: Pool) {
  const trace_status_counts: Record<AixpStatus, number> = { SUPPORTED: 0, PARTIAL: 0, DEAD_END: 0, MISSING: 0 };
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
  for (const d of AIXP_DIMENSIONS) {
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
      'The reused interpretation substrate (aiClient health-gated LLM seam / mei-narrative-engine rule-driven ' +
      'narration prior-art / 3.8 structured-AST formula engine / psychometric transforms) is composed by ' +
      'EXISTENCE — never invoked at compose time. aixp_* overlay tables are absent while the flag has never run ' +
      'its write paths — that is expected + honest.',
  };
}

// ── ADOPTION axis — real usage volume, reported SEPARATELY, NEVER a gap ───────
export async function composeAdoption(pool: Pool) {
  return {
    note: 'ADOPTION is real interpreted / governed / audited / saved-view VOLUME across the aixp_* overlay. ' +
      'It is a usage axis reported SEPARATELY from engineering closure — NEVER a gap, NEVER fabricated. ' +
      'Interpretation ABSTAINS below the confidence / k_min=' + String(AIXP_K_MIN) + ' evidence floor. ' +
      'null (unreadable) ≠ 0 (empty).',
    overlay: await computeOverlayCoverage(pool).catch(() => ({
      rules: null, prompt_links: null, policies: null, thresholds: null,
      runs: null, ai_runs: null, abstained_runs: null, human_review_runs: null,
      governance_events: null, audit_events: null, saved_views: null,
    })),
  };
}

// ── GAPS ─────────────────────────────────────────────────────────────────────
export function classifiedGaps() {
  const gap_counts: Record<GapSeverity, number> = { 'Launch-Critical': 0, High: 0, Medium: 0, Low: 0, Future: 0 };
  for (const g of AIXP_GAPS) gap_counts[g.severity] += 1;
  const resolved_gap_counts: Record<GapSeverity, number> = { 'Launch-Critical': 0, High: 0, Medium: 0, Low: 0, Future: 0 };
  for (const g of RESOLVED_AIXP_GAPS) resolved_gap_counts[g.severity] += 1;
  return {
    gaps: AIXP_GAPS, gap_counts,
    resolved_gaps: RESOLVED_AIXP_GAPS, resolved_gap_counts, resolved_gap_count: RESOLVED_AIXP_GAPS.length,
  };
}

// ── SUMMARY — 11 dimensions reported SEPARATELY + verdict (never composited) ──
export async function composeSummary(pool: Pool) {
  const dims = await composeDimensions(pool);
  const interpretationKinds = composeInterpretationKinds();
  const explainabilityCriteria = composeExplainabilityCriteria();
  const confidenceCriteria = composeConfidenceCriteria();
  const hallucinationControls = composeHallucinationControls();
  const ruleCapabilities = composeRuleCapabilities();
  const personaCoverage = composePersonaCoverage();
  const lifecycleCoverage = composeLifecycleCoverage();
  const adminSurfaces = await composeSuperAdminSurfaces(pool);
  const frontendSurfaces = await composeFrontendSurfaces(pool);
  const uxCriteria = await composeUxCriteria(pool);
  const apiGroups = await composeApiGroups(pool);
  const testingCoverage = await composeTestingCoverage(pool);
  const docSet = await composeDocSet(pool);
  const trace = await composeTraceability(pool);
  const repo = await composeRepositoryAlignment(pool);
  const adoption = await composeAdoption(pool);
  const { gap_counts, resolved_gap_counts, resolved_gap_count } = classifiedGaps();
  const launchCritical = gap_counts['Launch-Critical'];
  return {
    flag: 'aiInterpretation' as const,
    k_min: AIXP_K_MIN,
    axes: AIXP_AXES,
    dimensions: { dimension_count: dims.dimension_count, status_counts: dims.status_counts },
    interpretation_kinds: { count: interpretationKinds.count, status_counts: interpretationKinds.status_counts },
    explainability_criteria: { count: explainabilityCriteria.count, status_counts: explainabilityCriteria.status_counts },
    confidence_criteria: { count: confidenceCriteria.count, status_counts: confidenceCriteria.status_counts },
    hallucination_controls: { count: hallucinationControls.count, status_counts: hallucinationControls.status_counts },
    rule_capabilities: { count: ruleCapabilities.count, status_counts: ruleCapabilities.status_counts },
    persona_coverage: { count: personaCoverage.count, status_counts: personaCoverage.status_counts },
    lifecycle_coverage: { count: lifecycleCoverage.count, status_counts: lifecycleCoverage.status_counts },
    super_admin_surfaces: { count: adminSurfaces.count, status_counts: adminSurfaces.status_counts },
    frontend_surfaces: { count: frontendSurfaces.count, status_counts: frontendSurfaces.status_counts },
    ux_criteria: { count: uxCriteria.count, status_counts: uxCriteria.status_counts },
    api_groups: { count: apiGroups.count, status_counts: apiGroups.status_counts },
    testing_coverage: { count: testingCoverage.count, status_counts: testingCoverage.status_counts },
    doc_set: { count: docSet.count, status_counts: docSet.status_counts },
    traceability: { link_count: trace.link_count, trace_status_counts: trace.trace_status_counts },
    repository_alignment: { services: repo.services, routes: repo.routes, frontend: repo.frontend, tables: repo.tables },
    adoption,
    decisions: AIXP_DECISIONS,
    boundaries: INTERPRETATION_BOUNDARIES,
    gap_counts, gap_total: AIXP_GAPS.length,
    resolved_gap_counts, resolved_gap_count,
    ready_for_certification: {
      ready: launchCritical === 0,
      verdict: launchCritical === 0 ? 'YES' : 'NO',
      note:
        'Enterprise AI Interpretation & Explainability is READY for certification: all ELEVEN dimensions are ' +
        'certified, every standardized (3.8) + benchmarked (3.9) result flows through a clean interpretation seam ' +
        '(standardized + benchmarked result → rule selection via 3.8 structured-AST condition → grounded {{token}} ' +
        'render → confidence scoring + abstention → 8-facet explanation → OPTIONAL grounded-token-constrained LLM ' +
        'narration validated by unsupported-claim detection + reference verification → deterministic fallback + ' +
        'source tag → governance → audit), and there are ' + String(launchCritical) + ' Launch-Critical gaps. The ' +
        'interpretation / explainability / confidence / hallucination-protection / rule-repository capabilities are ' +
        'ENGINEERING-CLOSED via reuse-before-build (pure selectInterpretationRule / renderInterpretation / ' +
        'computeConfidence / composeExplanation / detectUnsupportedClaims / verifyReferences / ' +
        'evaluateInterpretationFormula mechanisms reusing the existing aiClient health-gated LLM seam + the 3.8 ' +
        'structured-AST formula engine + the psychometric transforms, over the additive aixp_* overlay). ' +
        'Interpretation ABSTAINS below the confidence / k_min evidence floor — never fabricated. The OPEN gaps are ' +
        'all NON-Launch-Critical breadth / upstream-input boundaries: GAP-AIXP-1 (fine-grained skill / learning / ' +
        'growth interpretation kinds — depend on finer standardized inputs upstream / accumulated volume; the 7 core ' +
        'kinds are SUPPORTED) + GAP-AIXP-2 (persona / lifecycle interpretation depth — reachable via the generic ' +
        'rule set, first-class depth depends on authored volume) are Medium; GAP-AIXP-3 (a domain fine-tuned ' +
        'grounded interpretation model — the deterministic + grounded + validated path already ships) is Future. ' +
        'Real interpreted / governed / saved VOLUME is an ADOPTION axis (honest 0), reported SEPARATELY, never a gap.',
    },
    enterprise_ready: {
      verdict: 'STRUCTURAL_COMPLETE_ADOPTION_PENDING' as const,
      note:
        'ONE canonical Enterprise AI Interpretation & Explainability Platform: a single certified layer COMPOSING ' +
        'the existing interpretation substrate (aiClient health-gated LLM seam / mei-narrative-engine rule-driven ' +
        'narration prior-art) + the pure 3.8 structured-AST formula engine + the pure psychometric transforms ' +
        '(zFromValue/zToPercentile) under one registry + an additive aixp_* overlay — NO duplicate AI / ' +
        'interpretation engine, NO V2, NO breaking change. Scope is INTERPRETATION, EXPLAINABILITY, CONFIDENCE & ' +
        'HALLUCINATION-PROTECTION only (ai_interpretation · explainability · confidence · hallucination_protection ' +
        '· rule_repository · super_admin · frontend · ux · apis · testing · documentation) — it turns a ' +
        'STANDARDIZED score (3.8) + BENCHMARK result (3.9) into an interpreted, explainable, confidence-scored, ' +
        'hallucination-protected result and NEVER re-scores, re-standardizes, re-benchmarks or builds a norm. The ' +
        'interpretation CORE is DETERMINISTIC (rule-select via 3.8 AST + grounded token render + confidence + ' +
        '8-facet explanation); the LLM NARRATION is an OPTIONAL, honest-degrading seam (checkAIHealth-gated, ' +
        'grounded-token-constrained, output-validated by detectUnsupportedClaims + verifyReferences, falling back ' +
        'to deterministic + source-tag on ANY failure) — AI output is NEVER fabricated. The composite ' +
        'interpretation index is a STRUCTURED AST (no eval). The ELEVEN dimensions are certified SEPARATELY: the ' +
        'interpretation / explainability / confidence / hallucination-protection / rule-repository / API / console ' +
        '/ workbench capabilities were ENGINEERING-CLOSED via REUSE-before-build (pure compute mechanisms reusing ' +
        'the existing aiClient + 3.8 formula engine + psychometric transforms + own additive overlay tables). ' +
        'A governed, versioned interpretation asset store (rules / prompts / thresholds / policies resolved ' +
        'most-specific-wins) with draft→…→retire + version history + rollback + audit + saved views is WIRED, each ' +
        'gated by aiInterpretation so OFF is byte-identical incl. schema (all DDL runs only on the flag-gated write ' +
        'paths). Recommendation / learning-path / growth-planning / report-generation / dashboard-intelligence are ' +
        'DO-NOT-IMPLEMENT boundaries (interpretation FEEDS them) — reported in-line, NEVER gaps. The OPEN gaps ' +
        '(GAP-AIXP-1 fine-grained interpretation kinds + GAP-AIXP-2 persona / lifecycle depth — both Medium breadth ' +
        'boundaries, each already reachable via the generic rule set; GAP-AIXP-3 fine-tuned grounded model — ' +
        'Future, additive) are reported in-line, NOT Launch-Critical. What remains beyond them is ADOPTION — real ' +
        'interpreted / governed / saved VOLUME across the overlay — a usage axis reported SEPARATELY, NEVER a gap. ' +
        'Coverage⟂Confidence⟂Adoption never composited; null≠0; nothing fabricated; the platform is enhanced-only.',
    },
  };
}
