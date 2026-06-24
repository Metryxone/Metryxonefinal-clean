/**
 * MX-105X — Enterprise Certification & Platform Activation (read-only TOP-LEVEL composer).
 *
 * A THIN composer that aggregates the already-built activation / certification / health / outcome
 * engines into ONE unified enterprise certification. It COMPOSES — it never recomputes a score,
 * never writes a row, never runs DDL, and never fabricates a value.
 *
 * Views:
 *   - unifiedJourney(pool)        candidate + employer end-to-end journey validation
 *                                  (completion · broken-link · dependency reports)
 *   - outcomeReadiness(pool)      outcome readiness/coverage/confidence (composes MX-102X)
 *   - commandCenter(pool)         Super Admin command center — 12 health categories
 *   - founderCommandCenter(pool)  Founder command center — 12 exec metrics + cert score
 *   - recertification(pool)       Enterprise re-certification across 15 subsystems (4 axes)
 *   - overview(pool)              fold the headline of every view
 *
 * Honesty contract (NEVER regress):
 *   - Structural ⟂ Activation ⟂ Adoption ⟂ Outcome-Confidence are SEPARATE axes, never composited.
 *   - Coverage (data exists) ⟂ Confidence (trustworthy/sufficient) kept separate.
 *   - null = not measurable (table absent / unreadable), NEVER a fabricated 0.
 *   - Every sub-engine call is wrapped so the composer NEVER throws (degrades to null).
 *   - Verdicts (PASS/PARTIAL/FAIL) are STRUCTURAL only; activation/adoption are reported alongside.
 */

import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import { certification as candidateCertification } from './ecosystem-activation';
import { runEmployerEcosystemAudit } from './employer-ecosystem-audit-engine';
import { composeOverview as composeOutcomeOverview } from './outcome-intelligence-engine';

export const ENTERPRISE_CERTIFICATION_VERSION = '105.0.0';

export const ENTERPRISE_CERTIFICATION_DISCLAIMER =
  'Enterprise Certification is a READ-ONLY composition of already-built activation / certification / ' +
  'health / outcome engines. Structural (machinery exists), Activation (subsystem switched on), ' +
  'Adoption (live non-demo data), and Outcome-Confidence (calibrated ≥ k_min) are reported as ' +
  'SEPARATE axes and NEVER composited. Coverage ⟂ Confidence kept separate. A rate with a zero ' +
  'denominator is null, never a fabricated 0% / 100%. Absent tables degrade to null (not 0). ' +
  'Developmental / operational signals only — NOT hiring/promotion/suitability predictions.';

const ENTERPRISE_K_MIN = 30;

// ── primitives ──────────────────────────────────────────────────────────────────

async function tablePresent(pool: Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS r', ['public.' + table]);
    return !!r.rows[0]?.r;
  } catch {
    return false;
  }
}

/** Scalar SELECT returning `n`. null when the guard table is absent OR the query errors. */
async function scalar(pool: Pool, guardTable: string, sql: string, params: any[] = []): Promise<number | null> {
  if (!(await tablePresent(pool, guardTable))) return null;
  try {
    const r = await pool.query(sql, params);
    const v = r.rows[0]?.n;
    if (v === null || v === undefined) return 0;
    const num = Number(v);
    return Number.isFinite(num) ? num : null;
  } catch {
    return null;
  }
}

/** A rate: null when numerator/denominator unmeasurable or denom 0 (never a fabricated %). */
function rate(num: number | null, denom: number | null): number | null {
  if (num === null || denom === null) return null;
  if (denom <= 0) return null;
  return Math.round((num / denom) * 1000) / 10;
}

/** Wrap any sub-engine call so the composer NEVER throws — degrade to null on error. */
async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

/** Read a feature flag by name without coupling to the typed key union (unknown → false). */
function flag(name: string): boolean {
  try {
    return isFlagEnabled(name as any);
  } catch {
    return false;
  }
}

/** Are ALL the named tables present? (structural readiness for a subsystem) */
async function allPresent(pool: Pool, tables: string[]): Promise<{ present: number; total: number; missing: string[] }> {
  const missing: string[] = [];
  for (const t of tables) {
    if (!(await tablePresent(pool, t))) missing.push(t);
  }
  return { present: tables.length - missing.length, total: tables.length, missing };
}

type HealthStatus = 'healthy' | 'partial' | 'dormant' | 'gap';

/** Derive a health status from the SEPARATE structural & adoption axes (never composited into one number). */
function healthStatus(structuralOk: boolean, adoption: number | null): HealthStatus {
  if (!structuralOk) return 'gap';                 // machinery missing
  if (adoption === null) return 'partial';         // present but not measurable
  if (adoption > 0) return 'healthy';              // live data
  return 'dormant';                                // wired, awaiting adoption
}

// ── VIEW 1 — Unified candidate + employer journey validation ──────────────────────

export async function unifiedJourney(pool: Pool) {
  const candCert = await safe(() => candidateCertification(pool));
  const employer = await safe(() => runEmployerEcosystemAudit(pool));

  // Candidate journey steps (structural + activation) from the MX-104X certification.
  const candQuestions = (candCert?.data as any)?.questions ?? null;
  const candidateSteps = Array.isArray(candQuestions)
    ? candQuestions
        .filter((q: any) => !q.activation_na) // journey steps only (exclude discipline checks)
        .map((q: any) => ({
          step: q.q,
          structural: !!q.structural,
          activation: q.activation === true,
        }))
    : null;

  // Employer journey stages (status + coverage/confidence) from the MX-103X audit.
  const employerStages = Array.isArray((employer as any)?.stages)
    ? (employer as any).stages.map((s: any) => ({
        stage: s.name,
        status: s.status,
        coverage: s.coverage,
        confidence: s.confidence,
        flag_enabled: s.flagEnabled,
        substrate_present: s.substratePresent,
        real_rows: s.realRows,
        demo_rows: s.demoRows,
      }))
    : null;

  // ── Broken links: a structural break = a journey step whose machinery is absent. Honestly listed,
  //    kept SEPARATE from activation gaps (a present-but-empty step is NOT a broken link). ──
  const brokenLinks: { surface: string; step: string; reason: string }[] = [];
  if (candidateSteps) {
    for (const s of candidateSteps) {
      if (!s.structural) brokenLinks.push({ surface: 'candidate', step: s.step, reason: 'structural machinery absent' });
    }
  }
  if (employerStages) {
    for (const s of employerStages) {
      if (s.status === 'gap') brokenLinks.push({ surface: 'employer', step: s.stage, reason: 'substrate absent (flag on, table missing)' });
    }
  }

  // ── Dependency report: gated stages = a downstream subsystem switched OFF (dependency unmet by
  //    configuration, NOT a structural break). Reported separately from broken links. ──
  const dependencyGaps: { surface: string; step: string; reason: string }[] = [];
  if (employerStages) {
    for (const s of employerStages) {
      if (s.status === 'gated') dependencyGaps.push({ surface: 'employer', step: s.stage, reason: 'gating flag OFF (configuration dependency)' });
    }
  }

  // Completion = structural completeness per surface (machinery present), kept distinct from activation.
  const candStructuralComplete = candidateSteps ? candidateSteps.filter((s: any) => s.structural).length : null;
  const candTotal = candidateSteps ? candidateSteps.length : null;
  const candActivationLive = candidateSteps ? candidateSteps.filter((s: any) => s.activation).length : null;
  const empReachable = (employer as any)?.summary?.coverageReachable ?? null;
  const empTotal = (employer as any)?.summary?.totalStages ?? null;
  const empRealData = (employer as any)?.summary?.realDataStages ?? null;

  return {
    view: 'unified_journey',
    candidate: {
      available: candidateSteps !== null,
      steps: candidateSteps,
      completion: {
        structural_complete: candStructuralComplete,
        structural_total: candTotal,
        structural_pct: rate(candStructuralComplete, candTotal),
        activation_live: candActivationLive, // SEPARATE axis (adoption)
      },
    },
    employer: {
      available: employerStages !== null,
      stages: employerStages,
      verdict: (employer as any)?.verdict ?? null,
      completion: {
        coverage_reachable: empReachable,
        coverage_total: empTotal,
        coverage_pct: rate(empReachable, empTotal),
        real_data_stages: empRealData, // SEPARATE axis (adoption)
      },
    },
    broken_links: brokenLinks,           // structural breaks only
    dependency_gaps: dependencyGaps,     // configuration (flag) dependencies only
    notes: [
      'Candidate steps from MX-104X certification; employer stages from MX-103X audit (composed, not recomputed).',
      'Broken links = structural machinery absent. Dependency gaps = a gating flag is OFF. Reported SEPARATELY.',
      'Completion (structural) and activation/adoption are independent axes; never composited.',
    ],
  };
}

// ── VIEW 2 — Outcome readiness (composes MX-102X Outcome Intelligence) ────────────

export async function outcomeReadiness(pool: Pool) {
  const ov = await safe(() => composeOutcomeOverview(pool));
  if (!ov) {
    return {
      view: 'outcome_readiness',
      available: false,
      coverage: null,
      confidence: null,
      quality: null,
      note: 'Outcome Intelligence engine unreadable — degraded to null (no fabricated 0).',
    };
  }
  const platform = (ov as any).platform ?? {};
  return {
    view: 'outcome_readiness',
    available: true,
    // Coverage axis — realized outcomes captured (data exists).
    coverage: {
      type_count: platform.type_count ?? null,
      types_with_coverage: platform.types_with_coverage ?? null,
      realized_coverage: platform.realized_coverage ?? null, // null = unreadable, never 0
    },
    // Confidence axis — calibration trust; SEPARATE from coverage and from accuracy.
    confidence: {
      types_evidence_backed: platform.types_evidence_backed ?? null,
      evidence_backed: platform.evidence_backed === true,
      abstained: platform.abstained !== false,
      max_type_pairs: platform.max_type_pairs ?? null,
      k_min: (ov as any).k_min ?? ENTERPRISE_K_MIN,
    },
    // Quality axis — per-type breakdown (structural unification of the six realized-outcome types).
    quality: {
      types: Array.isArray((ov as any).types)
        ? (ov as any).types.map((t: any) => ({
            type: t.type,
            realized: t?.coverage?.realized ?? null,
            evidence_backed: t?.validation?.evidence_backed === true,
            calibration_status: t?.calibration?.status ?? null,
          }))
        : null,
    },
    verdict: (ov as any).verdict ?? null,
    note: 'Composed from MX-102X. Coverage ⟂ Confidence ⟂ accuracy; accuracy abstained until a single type reaches k_min.',
  };
}

// ── VIEW 3 — Super Admin command center (12 health categories) ────────────────────
// COMPOSES the recertification subsystems + outcome-readiness view (never recomputes
// its own SQL counts). Each category carries SEPARATE structural & adoption axes, plus
// the required `outcome` and `certification` categories sourced from the composed views.

export async function commandCenter(pool: Pool) {
  const cert = await recertification(pool);
  const outcome = await safe(() => outcomeReadiness(pool));

  const subByKey: Record<string, any> = {};
  for (const s of ((cert as any)?.subsystems ?? [])) subByKey[s.key] = s;

  // Map a curated recertification subsystem → a health category (compose, never recompute).
  const fromSub = (subKey: string, catKey: string, label: string) => {
    const s = subByKey[subKey];
    if (!s) {
      return { key: catKey, label, structural: false, adoption: null as number | null, status: 'gap' as HealthStatus, source: `recertification:${subKey}` };
    }
    const adoption = s.adoption?.live_rows ?? null;
    return {
      key: catKey,
      label,
      structural: !!s.structural?.ok,
      adoption,                                 // SEPARATE axis; null = not measurable
      status: healthStatus(!!s.structural?.ok, adoption),
      source: `recertification:${subKey}`,
    };
  };

  // `outcome` category — composed from MX-102X outcome readiness (types-with-coverage = adoption).
  const outcomeAvailable = (outcome as any)?.available === true;
  const outcomeAdoption = (outcome as any)?.coverage?.types_with_coverage ?? null;
  const outcomeCat = {
    key: 'outcome',
    label: 'Outcome Intelligence (realized-outcome coverage)',
    structural: outcomeAvailable,
    adoption: outcomeAdoption as number | null,
    status: healthStatus(outcomeAvailable, outcomeAdoption),
    source: 'outcome_readiness',
  };

  // `certification` category — composed from the enterprise recertification verdict itself.
  const certVerdict = (cert as any)?.verdict ?? null;
  const certCat = {
    key: 'certification',
    label: 'Enterprise Certification (recertification verdict)',
    structural: certVerdict === 'PASS' || certVerdict === 'PARTIAL',
    adoption: (cert as any)?.summary?.adopted ?? null,
    status: (certVerdict === 'PASS' ? 'healthy' : certVerdict === 'PARTIAL' ? 'partial' : 'gap') as HealthStatus,
    source: 'recertification:verdict',
    verdict: certVerdict,
    structural_pct: (cert as any)?.enterprise_structural_pct ?? null,
  };

  const categories = [
    fromSub('super_admin', 'platform_core', 'Platform Core (super-admin · auth)'),
    fromSub('competency_framework', 'competency_framework', 'Competency Framework (genome)'),
    fromSub('assessment_engine', 'assessment_engine', 'Assessment Engine (approved templates)'),
    fromSub('role_dna', 'role_dna', 'Role DNA (profiled roles)'),
    fromSub('candidate_intelligence', 'candidate_journey', 'Candidate Journey (seeker profiles)'),
    fromSub('employer_intelligence', 'employer_ecosystem', 'Employer Ecosystem (real candidates)'),
    fromSub('career_builder', 'career_builder', 'Career Builder (activations)'),
    fromSub('career_passport', 'career_passport', 'Career Passport (snapshots)'),
    fromSub('report_factory', 'report_factory', 'Report Factory (generated reports)'),
    fromSub('validation_loop', 'validation_loop', 'Validation Loop (realized outcomes)'),
    outcomeCat,
    certCat,
  ];

  const healthy = categories.filter((c) => c.status === 'healthy').length;
  const structuralOkCount = categories.filter((c) => c.structural).length;

  return {
    view: 'command_center',
    categories,
    summary: {
      category_count: categories.length,
      structural_ok: structuralOkCount,              // machinery axis
      structural_pct: rate(structuralOkCount, categories.length),
      healthy_adoption: healthy,                     // adoption axis (SEPARATE)
    },
    note: 'Categories COMPOSE the recertification subsystems + outcome-readiness view (never recomputed). Structural (machinery) ⟂ Adoption (live data) reported separately; null adoption = not measurable, never 0.',
  };
}

// ── VIEW 4 — Founder command center (12 exec metrics + cert score) ────────────────
// COMPOSES the unified-journey + outcome-readiness + recertification views. The headline
// metrics are the per-surface READINESS scores (candidate / employer / career-builder /
// passport / outcome / …) plus adoption volumes pulled from the composed subsystem axes —
// never recomputed here.

export async function founderCommandCenter(pool: Pool) {
  const cert = await recertification(pool);
  const journey = await safe(() => unifiedJourney(pool));
  const outcome = await safe(() => outcomeReadiness(pool));

  const subByKey: Record<string, any> = {};
  for (const s of ((cert as any)?.subsystems ?? [])) subByKey[s.key] = s;
  const subStructPct = (key: string): number | null => {
    const s = subByKey[key];
    return s ? rate(s.structural?.present ?? null, s.structural?.total ?? null) : null;
  };
  const subAdoption = (key: string): number | null => {
    const s = subByKey[key];
    return s ? (s.adoption?.live_rows ?? null) : null;
  };

  const m = (key: string, label: string, value: number | null, unit: string, axis: string, source: string) => ({ key, label, value, unit, axis, source });

  // Readiness scores composed from the journey + outcome views (already structural pcts).
  const candidateReadiness = (journey as any)?.candidate?.completion?.structural_pct ?? null;
  const employerReadiness = (journey as any)?.employer?.completion?.coverage_pct ?? null;
  const outcomeReadinessPct = rate(
    (outcome as any)?.coverage?.types_with_coverage ?? null,
    (outcome as any)?.coverage?.type_count ?? null,
  );

  const metrics = [
    // Readiness axis (structural) — composed from unified-journey + recertification subsystems.
    m('candidate_readiness', 'Candidate Journey Readiness', candidateReadiness, 'pct', 'structural', 'unified_journey'),
    m('employer_readiness', 'Employer Journey Readiness', employerReadiness, 'pct', 'structural', 'unified_journey'),
    m('career_builder_readiness', 'Career Builder Readiness', subStructPct('career_builder'), 'pct', 'structural', 'recertification:career_builder'),
    m('passport_readiness', 'Career Passport Readiness', subStructPct('career_passport'), 'pct', 'structural', 'recertification:career_passport'),
    m('competency_framework_readiness', 'Competency Framework Readiness', subStructPct('competency_framework'), 'pct', 'structural', 'recertification:competency_framework'),
    m('assessment_readiness', 'Assessment Engine Readiness', subStructPct('assessment_engine'), 'pct', 'structural', 'recertification:assessment_engine'),
    m('enterprise_cert_score', 'Enterprise Certification Score', (cert as any)?.enterprise_structural_pct ?? null, 'pct', 'structural', 'recertification'),
    // Outcome axis — composed from MX-102X outcome readiness.
    m('outcome_readiness', 'Outcome Readiness (realized-type coverage)', outcomeReadinessPct, 'pct', 'outcome', 'outcome_readiness'),
    // Adoption axis (volume) — pulled from the composed subsystem adoption axis (no ad-hoc recompute).
    m('registered_candidates', 'Registered Candidates', subAdoption('candidate_intelligence'), 'count', 'adoption', 'recertification:candidate_intelligence'),
    m('assessments_completed', 'Assessments Completed', subAdoption('adaptive_assessment'), 'count', 'adoption', 'recertification:adaptive_assessment'),
    m('employer_candidates', 'Employer Candidates (real)', subAdoption('employer_intelligence'), 'count', 'adoption', 'recertification:employer_intelligence'),
    m('realized_outcomes', 'Realized Outcomes (non-demo)', subAdoption('validation_loop'), 'count', 'outcome', 'recertification:validation_loop'),
  ];

  return {
    view: 'founder_command_center',
    metrics,
    enterprise_certification: {
      structural_pct: (cert as any)?.enterprise_structural_pct ?? null,
      verdict: (cert as any)?.verdict ?? null,
      subsystems_pass: (cert as any)?.summary?.pass ?? null,
      subsystems_total: (cert as any)?.summary?.total ?? null,
    },
    note: 'Exec metrics COMPOSE the unified-journey / outcome / recertification views (never recomputed). Each tags its axis (structural readiness / adoption / outcome); null = not measurable, never a fabricated 0.',
  };
}

// ── VIEW 5 — Enterprise re-certification across 15 subsystems (4 axes) ─────────────

interface SubsystemSpec {
  key: string;
  label: string;
  requiredTables: string[];
  flagKey?: string;        // activation axis (subsystem switched on); undefined = always-on
  adoptionSql?: { guard: string; sql: string }; // adoption axis (live non-demo rows)
  outcomeBearing?: boolean; // whether the outcome-confidence axis applies
}

const SUBSYSTEMS: SubsystemSpec[] = [
  { key: 'competency_framework', label: 'Competency Framework', requiredTables: ['onto_competencies', 'onto_competency_type_map'], adoptionSql: { guard: 'onto_competencies', sql: 'SELECT count(*)::int AS n FROM onto_competencies' } },
  { key: 'role_dna', label: 'Role DNA', requiredTables: ['onto_role_competency_profiles'], flagKey: 'roleDnaGovernance', adoptionSql: { guard: 'onto_role_competency_profiles', sql: 'SELECT count(DISTINCT role_id)::int AS n FROM onto_role_competency_profiles' } },
  { key: 'onet_crosswalk', label: 'O*NET Crosswalk', requiredTables: ['ont_roles', 'map_role_competency'], flagKey: 'onetCrosswalkGovernance', adoptionSql: { guard: 'map_role_competency', sql: 'SELECT count(*)::int AS n FROM map_role_competency' } },
  { key: 'assessment_engine', label: 'Assessment Engine', requiredTables: ['competency_question_templates'], flagKey: 'competencyRuntime', adoptionSql: { guard: 'competency_question_templates', sql: "SELECT count(*)::int AS n FROM competency_question_templates WHERE coalesce(status,'') = 'approved'" } },
  { key: 'question_factory', label: 'Question Factory', requiredTables: ['competency_question_templates'], flagKey: 'questionFactory', adoptionSql: { guard: 'competency_question_templates', sql: "SELECT count(*)::int AS n FROM competency_question_templates WHERE coalesce(source,'') = 'generated'" } },
  { key: 'adaptive_assessment', label: 'Adaptive Assessment', requiredTables: ['cra_scores'], flagKey: 'adaptiveDifficultyActivation', adoptionSql: { guard: 'cra_scores', sql: 'SELECT count(DISTINCT user_id)::int AS n FROM cra_scores' } },
  { key: 'employer_intelligence', label: 'Employer Intelligence', requiredTables: ['employer_candidates', 'employer_jobs'], flagKey: 'liveEmployerEcosystem', adoptionSql: { guard: 'employer_candidates', sql: "SELECT count(*)::int AS n FROM employer_candidates WHERE coalesce(email,'') NOT ILIKE '%@example.com'" } },
  { key: 'candidate_intelligence', label: 'Candidate Intelligence', requiredTables: ['career_seeker_profiles', 'cra_scores'], flagKey: 'ecosystemActivation', adoptionSql: { guard: 'career_seeker_profiles', sql: 'SELECT count(*)::int AS n FROM career_seeker_profiles' } },
  { key: 'career_builder', label: 'Career Builder', requiredTables: ['cg_user_activation_runs', 'cg_user_role_readiness'], flagKey: 'careerIntelligenceActivation', adoptionSql: { guard: 'cg_user_activation_runs', sql: 'SELECT count(*)::int AS n FROM cg_user_activation_runs' } },
  { key: 'career_passport', label: 'Career Passport', requiredTables: ['career_passport_snapshots'], flagKey: 'careerPassport', adoptionSql: { guard: 'career_passport_snapshots', sql: 'SELECT count(*)::int AS n FROM career_passport_snapshots' } },
  { key: 'outcome_intelligence', label: 'Outcome Intelligence', requiredTables: ['validation_loop_outcomes'], flagKey: 'outcomeIntelligenceActivation', adoptionSql: { guard: 'validation_loop_outcomes', sql: 'SELECT count(*)::int AS n FROM validation_loop_outcomes WHERE coalesce(is_demo,false) = false' }, outcomeBearing: true },
  { key: 'validation_loop', label: 'Validation Loop', requiredTables: ['validation_loop_outcomes'], flagKey: 'validationLoop', adoptionSql: { guard: 'validation_loop_outcomes', sql: 'SELECT count(*)::int AS n FROM validation_loop_outcomes WHERE coalesce(is_demo,false) = false' }, outcomeBearing: true },
  { key: 'super_admin', label: 'Super Admin Command Center', requiredTables: ['users', 'feature_flags', 'mfa_codes'], adoptionSql: { guard: 'users', sql: "SELECT count(*)::int AS n FROM users WHERE coalesce(role,'') = 'super_admin'" } },
  { key: 'founder_dashboard', label: 'Founder Dashboard', requiredTables: ['capadex_payments', 'users'], adoptionSql: { guard: 'users', sql: "SELECT count(*)::int AS n FROM users WHERE COALESCE(role,'') <> 'super_admin' AND COALESCE(email,'') NOT ILIKE '%@example.com'" } },
  { key: 'report_factory', label: 'Report Factory', requiredTables: ['rf_templates', 'rf_generated_reports'], adoptionSql: { guard: 'rf_generated_reports', sql: 'SELECT count(*)::int AS n FROM rf_generated_reports' } },
];

export async function recertification(pool: Pool) {
  // Outcome-confidence axis (shared) — computed once from MX-102X; applies only to outcome-bearing subsystems.
  const outcomeOv = await safe(() => composeOutcomeOverview(pool));
  const outcomeBacked = ((outcomeOv as any)?.platform?.evidence_backed === true);
  const outcomeMaxPairs = (outcomeOv as any)?.platform?.max_type_pairs ?? null;
  const outcomeConfidence = (n: number | null): string => {
    if (outcomeBacked) return 'calibrated';
    if (n != null && n > 0) return 'provisional';
    return 'abstained';
  };

  const subsystems = [];
  for (const spec of SUBSYSTEMS) {
    const struct = await allPresent(pool, spec.requiredTables);
    const structuralOk = struct.missing.length === 0;
    const activation = spec.flagKey ? flag(spec.flagKey) : true; // always-on subsystems = activation true by design
    const adoption = spec.adoptionSql ? await scalar(pool, spec.adoptionSql.guard, spec.adoptionSql.sql) : null;

    // Status is STRUCTURAL only (PASS = all required tables; PARTIAL = some; FAIL = none).
    const status: 'PASS' | 'PARTIAL' | 'FAIL' =
      structuralOk ? 'PASS' : struct.present > 0 ? 'PARTIAL' : 'FAIL';

    subsystems.push({
      key: spec.key,
      label: spec.label,
      // 4 SEPARATE axes — never composited:
      structural: { ok: structuralOk, present: struct.present, total: struct.total, missing: struct.missing },
      activation: { switched_on: activation, flag: spec.flagKey ?? null, always_on: !spec.flagKey },
      adoption: { live_rows: adoption }, // null = not measurable, never 0
      outcome_confidence: spec.outcomeBearing
        ? { applies: true, state: outcomeConfidence(outcomeMaxPairs ?? adoption), max_pairs: outcomeMaxPairs, k_min: ENTERPRISE_K_MIN }
        : { applies: false, state: 'n/a' },
      status,
    });
  }

  const pass = subsystems.filter((s) => s.status === 'PASS').length;
  const partial = subsystems.filter((s) => s.status === 'PARTIAL').length;
  const fail = subsystems.filter((s) => s.status === 'FAIL').length;
  // Enterprise structural score = fraction of required tables present across ALL subsystems (honest denominator).
  const totalRequired = subsystems.reduce((s, x) => s + x.structural.total, 0);
  const presentRequired = subsystems.reduce((s, x) => s + x.structural.present, 0);
  const enterpriseStructuralPct = rate(presentRequired, totalRequired);
  const verdict: 'PASS' | 'PARTIAL' | 'FAIL' =
    enterpriseStructuralPct != null && enterpriseStructuralPct >= 90 ? 'PASS'
      : enterpriseStructuralPct != null && enterpriseStructuralPct >= 60 ? 'PARTIAL'
      : 'FAIL';

  // Adoption & activation rollups reported SEPARATELY (never folded into the structural verdict).
  const activatedCount = subsystems.filter((s) => s.activation.switched_on).length;
  const adoptedCount = subsystems.filter((s) => (s.adoption.live_rows ?? 0) > 0).length;

  return {
    view: 'recertification',
    version: ENTERPRISE_CERTIFICATION_VERSION,
    subsystems,
    summary: { total: subsystems.length, pass, partial, fail, activated: activatedCount, adopted: adoptedCount },
    enterprise_structural_pct: enterpriseStructuralPct,
    structural_tables_present: presentRequired,
    structural_tables_total: totalRequired,
    verdict,
    verdict_axis: 'structural',
    axes_note: 'Structural (PASS/PARTIAL/FAIL & the headline %) ⟂ Activation (flag on) ⟂ Adoption (live rows) ⟂ Outcome-Confidence. NEVER composited.',
    target: 'Structural readiness ≥ 90% for enterprise certification (PASS).',
  };
}

// ── OVERVIEW — fold the headline of every view ────────────────────────────────────

export async function overview(pool: Pool) {
  const [journey, outcomes, cmd, founder, cert] = await Promise.all([
    safe(() => unifiedJourney(pool)),
    safe(() => outcomeReadiness(pool)),
    safe(() => commandCenter(pool)),
    safe(() => founderCommandCenter(pool)),
    safe(() => recertification(pool)),
  ]);

  return {
    ok: true,
    view: 'overview',
    version: ENTERPRISE_CERTIFICATION_VERSION,
    disclaimer: ENTERPRISE_CERTIFICATION_DISCLAIMER,
    enterprise_certification: cert
      ? {
          structural_pct: cert.enterprise_structural_pct,
          verdict: cert.verdict,
          subsystems_pass: cert.summary.pass,
          subsystems_total: cert.summary.total,
          activated: cert.summary.activated,
          adopted: cert.summary.adopted,
        }
      : null,
    journey: journey
      ? {
          candidate_structural_pct: journey.candidate.completion.structural_pct,
          employer_coverage_pct: journey.employer.completion.coverage_pct,
          broken_links: journey.broken_links.length,
          dependency_gaps: journey.dependency_gaps.length,
        }
      : null,
    outcomes: outcomes
      ? {
          realized_coverage: outcomes.coverage?.realized_coverage ?? null,
          evidence_backed: outcomes.confidence?.evidence_backed ?? false,
          verdict: outcomes.verdict ?? null,
        }
      : null,
    command_center: cmd
      ? { structural_ok: cmd.summary.structural_ok, structural_pct: cmd.summary.structural_pct, healthy_adoption: cmd.summary.healthy_adoption, category_count: cmd.summary.category_count }
      : null,
    founder: founder ? { metric_count: founder.metrics.length } : null,
    read_only: true,
  };
}
