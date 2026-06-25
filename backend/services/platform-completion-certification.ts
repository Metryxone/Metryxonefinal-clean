/**
 * MX-108 — Platform Completion Certification & Founder Executive Report (read-only TOP-LEVEL composer).
 *
 * Certifies HOW COMPLETE MetryxOne is as a platform and produces a single Founder Executive view —
 * WITHOUT rebuilding anything or fabricating completeness. It COMPOSES the already-built read-only
 * certification / activation / health composers and ADDS genuinely-new read-only content/structure
 * probes (genome attribute coverage incl. `onto_indicators`, question density per competency, Role-DNA
 * completeness, O*NET reference governance) that the existing composers do not cover.
 *
 * HONESTY CANON (enforced throughout):
 *   - FIVE certification dimensions — Implementation ⟂ Structural Readiness ⟂ Activation ⟂ Adoption ⟂
 *     Outcome-Confidence — are reported SIDE-BY-SIDE and NEVER composited into one number.
 *   - The overall completion is decomposed into Engineering / Content / Integration / Governance /
 *     Dashboard, each a SEPARATE honest %.
 *   - Coverage ⟂ Confidence kept separate. A rate with a zero/absent denominator is null
 *     ("not measurable"), NEVER a fabricated 0% / 100%.
 *   - Content & activation/adoption modules are CAPPED at PARTIAL by honest evidence — never upgraded
 *     on demo/seed data (@example.com excluded by the composed adoption SQL).
 *   - COMPOSE-NEVER-RECOMPUTE: only existing engines' READ paths + read-only to_regclass-probed SELECTs.
 *     Recomputes no score, runs NO DDL, writes NO rows (GET-only, no ensure-schema). Never throws.
 */

import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  recertification,
  unifiedJourney,
  commandCenter,
} from './enterprise-certification';
import {
  goLiveCertification,
  sixAxisReadiness,
  securityGovernanceCertification,
  scalabilityCertification,
  founderGoLiveCenter,
} from './go-live-certification';
import { certification as ecosystemCertification } from './ecosystem-activation';
import { composeOverview as composeOutcomeOverview } from './outcome-intelligence-engine';
import { getCoverageMatricesOverview } from './competency-coverage-matrices-engine';
import { composeCertification as cmiCertification } from './competency-match-intelligence';

export const PLATFORM_COMPLETION_VERSION = '108.0.0';

export const PLATFORM_COMPLETION_DISCLAIMER =
  'MX-108 read-only platform-completion certification. It COMPOSES existing read-only certification / ' +
  'activation / health composers and adds read-only content/structure probes — it recomputes no score, ' +
  'runs no DDL, writes no rows. The FIVE dimensions (Implementation ⟂ Structural ⟂ Activation ⟂ Adoption ' +
  '⟂ Outcome-Confidence) and the completion breakdown (Engineering / Content / Integration / Governance / ' +
  'Dashboard) are SEPARATE honest measures, never blended into one inflated score. Coverage ⟂ Confidence ' +
  'kept separate. A zero/absent denominator is null ("not measurable"), never a fabricated 0%/100%. ' +
  'Content & adoption modules are capped at PARTIAL by honest evidence (demo @example.com excluded). ' +
  'Developmental / operational signals only — NOT hiring/promotion/suitability predictions.';

type Verdict = 'PASS' | 'PARTIAL' | 'FAIL';

// ── primitives ────────────────────────────────────────────────────────────────────

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}

async function tablePresent(pool: Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS r', ['public.' + table]);
    return !!r.rows[0]?.r;
  } catch { return false; }
}

/** Mean of the measurable (non-null) values; null when NONE are measurable (never a fabricated 0). */
function meanOf(values: Array<number | null | undefined>): number | null {
  const ms = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (ms.length === 0) return null;
  return Math.round((ms.reduce((s, v) => s + v, 0) / ms.length) * 10) / 10;
}

function rate(num: number | null, denom: number | null): number | null {
  if (num === null || denom === null) return null;
  if (denom <= 0) return null;
  return Math.round((num / denom) * 1000) / 10;
}

/** The honest-min of two verdicts (PASS > PARTIAL > FAIL). A cap can only LOWER a verdict, never raise. */
function capVerdict(base: Verdict, cap: Verdict): Verdict {
  const rank: Record<Verdict, number> = { FAIL: 0, PARTIAL: 1, PASS: 2 };
  return rank[cap] < rank[base] ? cap : base;
}

// ── PROBE — genuinely-new read-only content / structure measurement ─────────────────
// Measures the content reality the existing composers do NOT cover. Pure SELECTs guarded by
// to_regclass; absent table/column → null (never a fabricated 0).

const GENOME_ATTRIBUTES: Array<{ key: string; predicate: string }> = [
  { key: 'definition', predicate: "definition IS NOT NULL AND definition <> ''" },
  { key: 'domain', predicate: 'domain_id IS NOT NULL' },
  { key: 'family', predicate: 'family_id IS NOT NULL' },
  { key: 'scientific_type', predicate: 'scientific_type IS NOT NULL' },
  { key: 'trainability', predicate: 'trainability IS NOT NULL' },
  { key: 'stability_level', predicate: 'stability_level IS NOT NULL' },
  { key: 'complexity_level', predicate: 'complexity_level IS NOT NULL' },
  { key: 'leadership_relevance', predicate: 'leadership_relevance IS NOT NULL' },
  { key: 'role_relevance', predicate: "role_relevance IS NOT NULL AND role_relevance::text NOT IN ('null','{}','[]')" },
  { key: 'scoring_metadata', predicate: "scoring_metadata IS NOT NULL AND scoring_metadata::text NOT IN ('null','{}','[]')" },
  { key: 'benchmark_metadata', predicate: "benchmark_metadata IS NOT NULL AND benchmark_metadata::text NOT IN ('null','{}','[]')" },
  { key: 'legal_classification', predicate: "legal_classification IS NOT NULL AND legal_classification::text NOT IN ('null','{}','[]')" },
];

async function contentStructureProbe(pool: Pool) {
  const haveGenome = await tablePresent(pool, 'onto_competencies');
  const haveIndicators = await tablePresent(pool, 'onto_indicators');
  const haveQmap = await tablePresent(pool, 'onto_competency_question_map');
  const haveTempl = await tablePresent(pool, 'competency_question_templates');
  const haveDna = await tablePresent(pool, 'onto_role_competency_profiles');
  const haveOnetComp = await tablePresent(pool, 'ont_competencies');
  const haveOnetRole = await tablePresent(pool, 'ont_roles');
  const haveOnetMap = await tablePresent(pool, 'map_role_competency');

  const scalar = async (sql: string): Promise<number | null> => {
    try {
      const r = await pool.query(sql);
      const v = r.rows[0]?.n;
      if (v === null || v === undefined) return 0;
      const num = Number(v);
      return Number.isFinite(num) ? num : null;
    } catch { return null; }
  };

  const genomeTotal = haveGenome ? await scalar('SELECT count(*)::int AS n FROM onto_competencies WHERE deprecated IS NOT TRUE') : null;

  // Genome attribute coverage — each attribute reported separately + a present-cell completeness %.
  const attributes: Array<{ key: string; present: number | null; total: number | null; pct: number | null }> = [];
  let presentCells = 0;
  let totalCells = 0;
  if (haveGenome && genomeTotal != null) {
    for (const a of GENOME_ATTRIBUTES) {
      const present = await scalar(`SELECT count(*)::int AS n FROM onto_competencies WHERE deprecated IS NOT TRUE AND (${a.predicate})`);
      attributes.push({ key: a.key, present, total: genomeTotal, pct: rate(present, genomeTotal) });
      if (present != null) { presentCells += present; totalCells += genomeTotal; }
    }
  }
  const attributeCompletenessPct = totalCells > 0 ? Math.round((presentCells / totalCells) * 1000) / 10 : null;

  // Indicator coverage — genome competencies with ≥1 behavioural indicator.
  const compsWithIndicator = haveIndicators ? await scalar('SELECT count(DISTINCT competency_id)::int AS n FROM onto_indicators') : null;
  const indicatorsTotal = haveIndicators ? await scalar('SELECT count(*)::int AS n FROM onto_indicators') : null;
  const indicatorCoveragePct = rate(compsWithIndicator, genomeTotal);

  // Question density — PRECISE active competency→question crosswalk (canonical), kept SEPARATE from the
  // raw template bank (which is a draft/authoring pool, not approved coverage).
  const qmapActive = haveQmap ? await scalar('SELECT count(*)::int AS n FROM onto_competency_question_map WHERE active IS TRUE') : null;
  const qmapActiveComps = haveQmap ? await scalar('SELECT count(DISTINCT competency_id)::int AS n FROM onto_competency_question_map WHERE active IS TRUE') : null;
  const templatesTotal = haveTempl ? await scalar('SELECT count(*)::int AS n FROM competency_question_templates') : null;
  const templatesApproved = haveTempl ? await scalar("SELECT count(*)::int AS n FROM competency_question_templates WHERE coalesce(status,'') = 'approved'") : null;
  const preciseQuestionCoveragePct = rate(qmapActiveComps, genomeTotal);

  // Role-DNA completeness — roles with a DNA profile + how much of the genome is wired into role requirements.
  const dnaRoles = haveDna ? await scalar('SELECT count(DISTINCT role_id)::int AS n FROM onto_role_competency_profiles WHERE active IS TRUE') : null;
  const dnaReqs = haveDna ? await scalar('SELECT count(*)::int AS n FROM onto_role_competency_profiles WHERE active IS TRUE') : null;
  const dnaGenomeComps = haveDna ? await scalar('SELECT count(DISTINCT competency_id)::int AS n FROM onto_role_competency_profiles WHERE active IS TRUE') : null;
  const roleDnaGenomeCoveragePct = rate(dnaGenomeComps, genomeTotal);

  // O*NET reference library (a curated reference asset; disjoint id-space from the genome → counts only).
  const onetComps = haveOnetComp ? await scalar('SELECT count(*)::int AS n FROM ont_competencies') : null;
  const onetRoles = haveOnetRole ? await scalar('SELECT count(*)::int AS n FROM ont_roles') : null;
  const onetMap = haveOnetMap ? await scalar('SELECT count(*)::int AS n FROM map_role_competency') : null;

  // CONTENT completion — conservative mean of the MEASURABLE content-coverage ratios (never inflated).
  const contentCompletionPct = meanOf([
    attributeCompletenessPct,
    indicatorCoveragePct,
    preciseQuestionCoveragePct,
    roleDnaGenomeCoveragePct,
  ]);

  return {
    genome_total: genomeTotal,
    genome_attributes: attributes,
    attribute_completeness_pct: attributeCompletenessPct,
    indicators: { competencies_with_indicator: compsWithIndicator, indicators_total: indicatorsTotal, coverage_pct: indicatorCoveragePct },
    question_density: {
      precise_active_map_rows: qmapActive,
      precise_competencies_covered: qmapActiveComps,
      precise_coverage_pct: preciseQuestionCoveragePct,
      template_bank_total: templatesTotal,
      template_bank_approved: templatesApproved,
      note: 'Precise coverage = genome competencies with an ACTIVE question→competency crosswalk row. The template bank is a draft/authoring pool and is reported separately (not counted as approved coverage).',
    },
    role_dna: { roles_with_dna: dnaRoles, requirements: dnaReqs, genome_competencies_in_dna: dnaGenomeComps, genome_coverage_pct: roleDnaGenomeCoveragePct },
    onet_reference: { competencies: onetComps, roles: onetRoles, role_competency_links: onetMap, note: 'Curated reference library — disjoint id-space from the genome; reported as counts, not a genome-coverage %.' },
    content_completion_pct: contentCompletionPct,
    content_note: 'content_completion_pct is the conservative MEAN of the measurable content-coverage ratios (genome attributes, indicators, precise question crosswalk, Role-DNA genome coverage). Each sub-metric is reported separately; sparse/empty cells are honest authoring gaps, never fabricated.',
  };
}

// ── shared composition context (compose every sub-engine ONCE, never throws) ─────────

async function buildContext(pool: Pool) {
  const [
    recert, journey, cmd, sixAxis, secGov, scal, gocert, founderGoLive,
    ecoCert, outcomeOv, covMatrices, matchCert, content,
  ] = await Promise.all([
    safe(() => recertification(pool)),
    safe(() => unifiedJourney(pool)),
    safe(() => commandCenter(pool)),
    safe(() => sixAxisReadiness(pool)),
    safe(() => securityGovernanceCertification(pool)),
    safe(() => scalabilityCertification(pool)),
    safe(() => goLiveCertification(pool)),
    safe(() => founderGoLiveCenter(pool)),
    safe(() => ecosystemCertification(pool)),
    safe(() => composeOutcomeOverview(pool)),
    safe(() => getCoverageMatricesOverview(pool)),
    safe(() => cmiCertification(pool)),
    safe(() => contentStructureProbe(pool)),
  ]);

  // Engineering completion = composer/engine RESPONSIVENESS (is the code built & running?). Each engine
  // either returned a result (built) or degraded to null (failed). This is SEPARATE from structural
  // table-coverage (the Structural dimension).
  const engines = { recert, journey, cmd, sixAxis, secGov, scal, gocert, founderGoLive, ecoCert, outcomeOv, covMatrices, matchCert };
  const engineKeys = Object.keys(engines);
  const enginesResponsive = engineKeys.filter((k) => (engines as any)[k] != null).length;
  const engineeringPct = rate(enginesResponsive, engineKeys.length);

  return {
    recert, journey, cmd, sixAxis, secGov, scal, gocert, founderGoLive,
    ecoCert, outcomeOv, covMatrices, matchCert, content,
    engineeringPct, enginesResponsive, engineKeys,
  };
}

type Ctx = Awaited<ReturnType<typeof buildContext>>;

function axisScore(ctx: Ctx, name: string): number | null {
  const axes: any[] = (ctx.sixAxis as any)?.axes ?? [];
  const a = axes.find((x) => x.axis === name);
  const s = a?.score;
  return typeof s === 'number' && Number.isFinite(s) ? s : null;
}

// ── completion breakdown (5 SEPARATE areas) ──────────────────────────────────────────

function completionBreakdown(ctx: Ctx) {
  const engineering = ctx.engineeringPct;
  const content = (ctx.content as any)?.content_completion_pct ?? null;

  // Integration = cross-module journey wiring (candidate + employer), reported with broken-link count.
  const candPct = (ctx.journey as any)?.candidate?.completion?.structural_pct ?? null;
  const empPct = (ctx.journey as any)?.employer?.completion?.coverage_pct ?? null;
  const brokenLinks = ((ctx.journey as any)?.broken_links ?? []).length;
  const integration = meanOf([candPct, empPct]);

  const governance = (ctx.secGov as any)?.structural_readiness_pct ?? null;
  const dashboard = (ctx.cmd as any)?.summary?.structural_pct ?? null;

  const areas = {
    engineering_pct: engineering,
    content_pct: content,
    integration_pct: integration,
    governance_pct: governance,
    dashboard_pct: dashboard,
  };

  // Overall completion = MEAN of the measurable areas. Content drags it below 100 → honest PARTIAL.
  const overall = meanOf([engineering, content, integration, governance, dashboard]);

  return {
    overall_completion_pct: overall,
    areas,
    detail: {
      engineering: { engines_responsive: ctx.enginesResponsive, engines_total: ctx.engineKeys.length },
      integration: { candidate_structural_pct: candPct, employer_coverage_pct: empPct, broken_links: brokenLinks },
    },
    note: 'Each area is a SEPARATE honest %. overall_completion_pct is the mean of the MEASURABLE areas — it is a completion measure, NOT a blend of the five certification dimensions.',
  };
}

// ── FIVE certification dimensions (NEVER composited into one number) ──────────────────

function fiveDimensions(ctx: Ctx) {
  const breakdown = completionBreakdown(ctx);

  // 1. Implementation maturity = overall completion (engineering + content + integration + governance +
  //    dashboard). This is the program's headline maturity; content keeps it honestly < 100.
  const implementation = {
    pct: breakdown.overall_completion_pct,
    measurable: breakdown.overall_completion_pct != null,
    breakdown: breakdown.areas,
    note: 'Implementation maturity = overall platform completion (mean of the five completion areas). It INCLUDES content, so it is honestly below 100 until content (questions/indicators/Role-DNA) is filled.',
  };

  // 2. Structural readiness = required-table machinery present (schema axis), from the go-live structural
  //    axis with the enterprise structural % as fallback.
  const structuralPct = axisScore(ctx, 'structural') ?? ((ctx.recert as any)?.enterprise_structural_pct ?? null);
  const structural = {
    pct: structuralPct,
    measurable: structuralPct != null,
    enterprise_structural_pct: (ctx.recert as any)?.enterprise_structural_pct ?? null,
    note: 'Schema/table machinery present. SEPARATE from Implementation — a table can exist (structural) while its content is empty (content).',
  };

  // 3. Activation = flags switched on + machinery active.
  const activationPct = axisScore(ctx, 'activation')
    ?? rate((ctx.ecoCert as any)?.data?.readiness_score?.activation_steps_live ?? null, (ctx.ecoCert as any)?.data?.readiness_score?.activation_steps_total ?? null);
  const activation = {
    pct: activationPct,
    measurable: activationPct != null,
    activated_subsystems: (ctx.recert as any)?.summary?.activated ?? null,
    subsystems_total: (ctx.recert as any)?.summary?.total ?? null,
    note: 'Feature flags switched on / machinery active. SEPARATE from Adoption (real usage).',
  };

  // 4. Adoption = real, non-demo live usage (@example.com excluded by the composed adoption SQL).
  const adoptionPct = axisScore(ctx, 'adoption')
    ?? rate((ctx.recert as any)?.summary?.adopted ?? null, (ctx.recert as any)?.summary?.total ?? null);
  const adoption = {
    pct: adoptionPct,
    measurable: adoptionPct != null,
    adopted_subsystems: (ctx.recert as any)?.summary?.adopted ?? null,
    subsystems_total: (ctx.recert as any)?.summary?.total ?? null,
    note: 'Real non-demo live data across subsystems. Demo (@example.com) excluded. 0 adopted is honest early-stage, never inflated.',
  };

  // 5. Outcome-Confidence = calibration evidence (Coverage ⟂ Confidence kept SEPARATE; NOT a single %).
  const plat: any = (ctx.outcomeOv as any)?.platform ?? null;
  const evidenceBacked = plat?.evidence_backed === true;
  const realizedCoverage = plat?.realized_coverage ?? null;
  const maxPairs = plat?.max_type_pairs ?? null;
  const kMin = (ctx.outcomeOv as any)?.k_min ?? 30;
  const outcomeConfidence = {
    state: evidenceBacked ? 'calibrated' : (maxPairs != null && maxPairs > 0 ? 'provisional' : 'abstained'),
    evidence_backed: evidenceBacked,
    realized_coverage: realizedCoverage,
    max_type_pairs: maxPairs,
    k_min: kMin,
    measurable: plat != null,
    note: 'Coverage (realized outcomes captured) ⟂ Confidence (calibrated only once a single type reaches k_min). Reported as a STATE + coverage, never a fabricated accuracy %.',
  };

  return {
    note: 'FIVE SEPARATE dimensions, reported side-by-side and NEVER composited into one number.',
    implementation,
    structural,
    activation,
    adoption,
    outcome_confidence: outcomeConfidence,
  };
}

// ── per-module PASS / PARTIAL / FAIL ─────────────────────────────────────────────────
// Structural verdict composed from the enterprise recertification subsystems; content / adoption /
// outcome CAPS lower (never raise) the verdict, with an explicit `capped_by` reason.

type ModuleSpec = {
  key: string;
  label: string;
  subsystemKey?: string;     // recertification subsystem to read structural status from
  contentGated?: boolean;    // capped by honest content evidence
  adoptionGated?: boolean;   // capped by real non-demo adoption
  outcomeGated?: boolean;    // capped by outcome-confidence (evidence-backed)
};

const MODULES: ModuleSpec[] = [
  { key: 'competency_framework', label: 'Competency Framework', subsystemKey: 'competency_framework', contentGated: true },
  { key: 'role_dna', label: 'Role DNA', subsystemKey: 'role_dna', contentGated: true },
  { key: 'onet_reference', label: 'O*NET Reference', subsystemKey: 'onet_crosswalk' },
  { key: 'assessment', label: 'Assessment Engine', subsystemKey: 'assessment_engine', contentGated: true },
  { key: 'employer_intelligence', label: 'Employer Intelligence', subsystemKey: 'employer_intelligence', adoptionGated: true },
  { key: 'candidate_intelligence', label: 'Candidate Intelligence', subsystemKey: 'candidate_intelligence', adoptionGated: true },
  { key: 'employability', label: 'Employability', subsystemKey: 'candidate_intelligence', adoptionGated: true },
  { key: 'career_builder', label: 'Career Builder', subsystemKey: 'career_builder', adoptionGated: true },
  { key: 'career_passport', label: 'Career Passport', subsystemKey: 'career_passport', adoptionGated: true },
  { key: 'report_factory', label: 'Report Factory', subsystemKey: 'report_factory' },
  { key: 'dashboards', label: 'Dashboards (Command Centers)', subsystemKey: 'super_admin' },
  { key: 'governance', label: 'Security & Governance' },
  { key: 'validation_loop', label: 'Validation Loop', subsystemKey: 'validation_loop', outcomeGated: true },
  { key: 'outcome_intelligence', label: 'Outcome Intelligence', subsystemKey: 'outcome_intelligence', outcomeGated: true },
];

function moduleVerdicts(ctx: Ctx) {
  const subs: any[] = (ctx.recert as any)?.subsystems ?? [];
  const subByKey = (k?: string) => (k ? subs.find((s) => s.key === k) : undefined);

  const content: any = ctx.content ?? {};
  // Honest content sufficiency gate: a content-bearing module is "content-ready" only if its precise
  // question crosswalk AND indicator coverage are non-trivial. Thin coverage caps it at PARTIAL.
  const preciseCoverage = content?.question_density?.precise_coverage_pct ?? null;
  const indicatorCoverage = content?.indicators?.coverage_pct ?? null;
  const roleDnaCoverage = content?.role_dna?.genome_coverage_pct ?? null;
  const contentSufficient = (pct: number | null) => pct != null && pct >= 60;

  const outcomeBacked = ((ctx.outcomeOv as any)?.platform?.evidence_backed === true);

  const rows = MODULES.map((spec) => {
    const sub = subByKey(spec.subsystemKey);
    let structural: Verdict | null = (sub?.status as Verdict) ?? null;

    // Modules without a recert subsystem read structural from their own composed source.
    if (spec.key === 'governance') {
      const v = (ctx.secGov as any)?.verdict ?? null;
      structural = v === 'PASS' ? 'PASS' : v === 'NOT_MEASURABLE' || v == null ? null : (v as Verdict);
    }
    if (spec.key === 'dashboards') {
      const ok = (ctx.cmd as any)?.summary?.structural_ok;
      const pct = (ctx.cmd as any)?.summary?.structural_pct ?? null;
      structural = ok === true || (pct != null && pct >= 90) ? 'PASS' : (pct != null && pct >= 60 ? 'PARTIAL' : structural);
    }

    const capped_by: string[] = [];
    let status: Verdict = structural ?? 'FAIL';
    const measurable = structural != null;

    if (spec.contentGated) {
      let pct: number | null = preciseCoverage;
      if (spec.key === 'role_dna') pct = roleDnaCoverage;
      if (spec.key === 'competency_framework') pct = meanOf([preciseCoverage, indicatorCoverage]);
      if (!contentSufficient(pct)) {
        status = capVerdict(status, 'PARTIAL');
        capped_by.push(`content (${pct == null ? 'not measurable' : pct + '%'} < 60% threshold)`);
      }
    }
    if (spec.adoptionGated) {
      const adoption = sub?.adoption?.live_rows ?? null;
      if (!(adoption != null && adoption > 0)) {
        status = capVerdict(status, 'PARTIAL');
        capped_by.push(`adoption (${adoption == null ? 'not measurable' : 'no real non-demo usage'})`);
      }
    }
    if (spec.outcomeGated && !outcomeBacked) {
      status = capVerdict(status, 'PARTIAL');
      capped_by.push('outcome-confidence (abstained — < k_min realized outcomes)');
    }

    return {
      key: spec.key,
      label: spec.label,
      status: measurable ? status : 'PARTIAL', // unmeasurable structure → honest PARTIAL, never fabricated PASS/FAIL
      structural: structural ?? 'not_measurable',
      capped_by: capped_by.length ? capped_by : null,
      source: spec.subsystemKey ? `recertification:${spec.subsystemKey}` : `composed:${spec.key}`,
    };
  });

  const pass = rows.filter((r) => r.status === 'PASS').length;
  const partial = rows.filter((r) => r.status === 'PARTIAL').length;
  const fail = rows.filter((r) => r.status === 'FAIL').length;

  return {
    modules: rows,
    summary: { total: rows.length, pass, partial, fail },
    note: 'Per-module verdict = structural verdict (composed from enterprise recertification) LOWERED by honest content/adoption/outcome caps (never raised). capped_by names the limiting axis. Demo data excluded.',
  };
}

// ── top risks + go-live recommendation ───────────────────────────────────────────────

function topRisks(ctx: Ctx, mods: ReturnType<typeof moduleVerdicts>) {
  const risks: Array<{ severity: 'high' | 'medium' | 'low'; area: string; risk: string }> = [];
  const content: any = ctx.content ?? {};

  const precise = content?.question_density?.precise_coverage_pct ?? null;
  if (precise != null && precise < 25) {
    risks.push({ severity: 'high', area: 'content', risk: `Precise question→competency coverage is ${precise}% (${content?.question_density?.precise_competencies_covered ?? '?'}/${content?.genome_total ?? '?'} competencies). Most of the genome is not yet assessment-mapped — an authoring effort, not a structural gap.` });
  }
  const indCov = content?.indicators?.coverage_pct ?? null;
  if (indCov != null && indCov < 25) {
    risks.push({ severity: 'high', area: 'content', risk: `Behavioural indicator coverage is ${indCov}% (${content?.indicators?.competencies_with_indicator ?? '?'}/${content?.genome_total ?? '?'} competencies have indicators).` });
  }
  const attrPct = content?.attribute_completeness_pct ?? null;
  if (attrPct != null && attrPct < 95) {
    risks.push({ severity: 'medium', area: 'content', risk: `Genome attribute completeness is ${attrPct}% — some enrichment attributes (e.g. role_relevance / benchmark_metadata) are not fully populated.` });
  }
  const dnaCov = content?.role_dna?.genome_coverage_pct ?? null;
  if (dnaCov != null && dnaCov < 60) {
    risks.push({ severity: 'medium', area: 'content', risk: `Role-DNA wires only ${dnaCov}% of the genome (${content?.role_dna?.roles_with_dna ?? '?'} roles, ${content?.role_dna?.requirements ?? '?'} requirements).` });
  }

  const adoption = (ctx.recert as any)?.summary?.adopted ?? null;
  if (adoption != null && adoption === 0) {
    risks.push({ severity: 'high', area: 'adoption', risk: 'No real non-demo adoption recorded across subsystems yet — Adoption and Outcome-Confidence cannot certify until live customers use the platform.' });
  }

  const outcomeBacked = ((ctx.outcomeOv as any)?.platform?.evidence_backed === true);
  if (!outcomeBacked) {
    risks.push({ severity: 'medium', area: 'outcome', risk: 'Outcome intelligence is ABSTAINED — fewer than k_min realized outcomes for any single type, so empirical accuracy is not yet claimable.' });
  }

  // Compose any structural risks the Go-Live founder center already surfaced.
  const goRisks: any[] = (ctx.founderGoLive as any)?.top_risks ?? [];
  for (const r of goRisks.slice(0, 4)) {
    risks.push({ severity: 'low', area: 'structural', risk: typeof r === 'string' ? r : (r?.detail ? JSON.stringify(r.detail) : JSON.stringify(r)) });
  }

  const failMods = mods.modules.filter((m) => m.status === 'FAIL');
  for (const m of failMods) {
    risks.push({ severity: 'high', area: 'module', risk: `Module "${m.label}" is structurally FAIL.` });
  }

  return risks.slice(0, 12);
}

function goLiveRecommendation(ctx: Ctx) {
  const level = (ctx.gocert as any)?.level ?? null;
  const recommendation = (ctx.gocert as any)?.recommendation ?? null;
  return {
    certification_level: level,
    ladder: (ctx.gocert as any)?.ladder ?? null,
    go_live_recommendation: recommendation,
    checklist_pct: (ctx.gocert as any)?.overall_checklist_pct ?? null,
    platform_completion_note:
      'MX-108 recommendation: Engineering & Integration are near-complete; Content (questions / indicators / Role-DNA) and real Adoption / Outcome-Confidence are PARTIAL. Suitable for a controlled launch of the structurally-complete journeys; full market/outcome certification requires the content authoring program + live adoption — NOT achievable by composition. STOP for founder approval; do not deploy.',
  };
}

// ── PUBLIC VIEWS ─────────────────────────────────────────────────────────────────────

export async function platformCompletionFounder(pool: Pool) {
  const ctx = await buildContext(pool);
  const dimensions = fiveDimensions(ctx);
  const breakdown = completionBreakdown(ctx);
  const mods = moduleVerdicts(ctx);
  const risks = topRisks(ctx, mods);
  const recommendation = goLiveRecommendation(ctx);

  return {
    ok: true,
    view: 'founder',
    version: PLATFORM_COMPLETION_VERSION,
    disclaimer: PLATFORM_COMPLETION_DISCLAIMER,
    completion: breakdown,
    dimensions,
    modules: mods,
    top_risks: risks,
    recommendation,
    content_probe: ctx.content,
    read_only: true,
  };
}

export async function platformCompletionCertification(pool: Pool) {
  const ctx = await buildContext(pool);
  const mods = moduleVerdicts(ctx);
  const breakdown = completionBreakdown(ctx);
  const dimensions = fiveDimensions(ctx);

  // Certification verdict is STRUCTURAL-led (PASS only when no module is FAIL and structural ≥ 90%),
  // reported ALONGSIDE the separate completion / activation / adoption / outcome axes (never composited).
  const structuralPct = dimensions.structural.pct;
  const anyFail = mods.summary.fail > 0;
  const verdict: Verdict =
    anyFail ? 'FAIL'
      : structuralPct != null && structuralPct >= 90 && mods.summary.partial === 0 ? 'PASS'
        : structuralPct != null && structuralPct >= 60 ? 'PARTIAL'
          : 'FAIL';

  return {
    ok: true,
    view: 'certification',
    version: PLATFORM_COMPLETION_VERSION,
    disclaimer: PLATFORM_COMPLETION_DISCLAIMER,
    verdict,
    verdict_axis: 'structural+module',
    verdict_note: 'Verdict is STRUCTURAL/module-led (PASS needs structural ≥ 90% AND zero PARTIAL/FAIL modules). It is reported ALONGSIDE — never blended with — the completion %, activation, adoption, and outcome-confidence axes.',
    module_summary: mods.summary,
    modules: mods.modules,
    completion_overall_pct: breakdown.overall_completion_pct,
    dimensions,
    certification_level: (ctx.gocert as any)?.level ?? null,
    go_live_recommendation: (ctx.gocert as any)?.recommendation ?? null,
    read_only: true,
  };
}

export async function platformCompletionOverview(pool: Pool) {
  const ctx = await buildContext(pool);
  const dimensions = fiveDimensions(ctx);
  const breakdown = completionBreakdown(ctx);
  const mods = moduleVerdicts(ctx);

  return {
    ok: true,
    view: 'overview',
    version: PLATFORM_COMPLETION_VERSION,
    disclaimer: PLATFORM_COMPLETION_DISCLAIMER,
    overall_completion_pct: breakdown.overall_completion_pct,
    completion_areas: breakdown.areas,
    dimensions: {
      implementation_pct: dimensions.implementation.pct,
      structural_pct: dimensions.structural.pct,
      activation_pct: dimensions.activation.pct,
      adoption_pct: dimensions.adoption.pct,
      outcome_confidence_state: dimensions.outcome_confidence.state,
    },
    module_summary: mods.summary,
    certification_level: (ctx.gocert as any)?.level ?? null,
    go_live_recommendation: (ctx.gocert as any)?.recommendation ?? null,
    note: 'Headline of the platform-completion certification. The five dimensions are SEPARATE measures, never blended into one number.',
    read_only: true,
  };
}

export async function platformCompletionDimensions(pool: Pool) {
  const ctx = await buildContext(pool);
  return { ok: true, view: 'dimensions', version: PLATFORM_COMPLETION_VERSION, ...fiveDimensions(ctx), read_only: true };
}

export async function platformCompletionContent(pool: Pool) {
  const content = await safe(() => contentStructureProbe(pool));
  return { ok: true, view: 'content', version: PLATFORM_COMPLETION_VERSION, disclaimer: PLATFORM_COMPLETION_DISCLAIMER, content, read_only: true };
}
