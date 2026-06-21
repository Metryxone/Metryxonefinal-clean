/**
 * PHASE 5.6 — Employability Matching Engine (services).
 *
 * Composes THREE already-computed subject profiles into three employability
 * lenses. It NEVER recomputes the underlying scores and NEVER fabricates: when
 * an input is absent the corresponding output is reported `measurable:false`
 * with a `null` score and an honest note.
 *
 * Inputs (all loaded ONCE via the read-only loadPassportContext):
 *   - EI Profile        — ei-profile-engine.buildEiProfile (overall_ei + dimensions
 *                         + strengths/development/critical_risks + growth_potential).
 *   - Career Profile    — career_seeker_profiles JSONB (skills / experience months /
 *                         target_occupation / upskill_priorities).
 *   - Readiness Profile — career-readiness-aggregator.buildCareerReadiness
 *                         (overall + current/future/role/growth blocks, each with
 *                         its own coverage & confidence axes).
 *
 * Outputs (three deliverable engines, all pure / read-only / never-fabricating):
 *   - employability_matching_engine → computeHiringReadiness + orchestrator.
 *       Hiring Readiness — ROLE-AGNOSTIC present-state employability readiness.
 *       Driven by the readiness composite (current EI / future FRI / role), with
 *       an EI-current fallback. A developmental readiness SIGNAL, never a hiring
 *       verdict.
 *   - job_readiness_engine          → computeJobReadiness.
 *       Job Readiness — ROLE-SPECIFIC readiness against the subject's anchor role
 *       (career-readiness role block), contextualised by target_occupation. No
 *       anchor role => honestly unmeasured (we never invent a target).
 *   - employer_fit_engine           → computeEmployerFit.
 *       Employer Fit — DIRECTIONAL alignment between the subject's demonstrated
 *       profile (EI overall) and role demands (role readiness). ALWAYS provisional
 *       (no employer-side outcome data to validate against) and capped DOWN by any
 *       HIGH-severity EI critical risk. A developmental fit signal, never a
 *       suitability/hiring prediction.
 *
 * Design contract (mirrors the program):
 *   - COMPOSE-never-recompute: every score is DERIVED from already-computed
 *     composite scores (readiness.overall / readiness.role / ei.overall). No
 *     weighted competency / dimension math is re-implemented here.
 *   - Additive + GET-never-writes: the only substrate read is the existing
 *     read-only loadPassportContext (competencyRuntimeReady-gated; to_regclass
 *     probes; ZERO DDL). This phase introduces ZERO net-new tables.
 *   - never-throws: every op returns a typed EngineResult; the substrate load is
 *     wrapped and degrades to honest absence.
 *   - Honesty: Coverage (data exists) and Confidence (trustworthy) are reported
 *     as TWO SEPARATE axes, never composited into one number. Absent inputs are
 *     reported as such. Outputs carry the underlying language_policy unchanged
 *     (developmental signals only).
 */

import type { Pool } from 'pg';
import { loadPassportContext, type PassportContext } from './career-passport-engine';
import { LANGUAGE_POLICY } from './competency-ei-scoring-shared.js';
import type { EiProfile } from './ei-profile-engine';
import type { CareerReadinessEnvelope, ReadinessBlock } from './career-readiness-aggregator';

export const EMPLOYABILITY_MATCHING_ENGINE_VERSION = '5.6.0';

export type EngineResult<T = any> =
  | { ok: true; data: T }
  | { ok: false; code: 'not_found' | 'invalid_input'; message: string };

const ok = <T>(data: T): EngineResult<T> => ({ ok: true, data });
const err = (code: 'not_found' | 'invalid_input', message: string): EngineResult =>
  ({ ok: false, code, message });

// ---------------------------------------------------------------------------
// Shared output shape — one developmental readiness/fit signal with dual axes.
// ---------------------------------------------------------------------------

export type EmployabilityBand =
  | 'Advanced'
  | 'Proficient'
  | 'Developing'
  | 'Emerging'
  | 'Unmeasured';

export interface MetricAxes {
  coverage: {
    measurable: boolean;
    coverage_pct: number | null;
    detail: string;
  };
  confidence: {
    band: 'High' | 'Moderate' | 'Low' | 'None';
    /** 0..1 fraction of real contributing signals, when derivable. */
    value: number | null;
    basis: string;
    caps: string[];
  };
}

export interface EmployabilityMetric {
  key: 'hiring_readiness' | 'job_readiness' | 'employer_fit';
  label: string;
  measurable: boolean;
  /** 0..100 developmental readiness/fit SIGNAL (never a hiring probability). */
  score: number | null;
  band: EmployabilityBand;
  axes: MetricAxes;
  /** Transparent provenance — exactly which composed scores fed this metric. */
  drivers: { source: string; score: number | null; weight: number; note?: string }[];
  notes: string[];
}

export interface EmployabilityMatch {
  ok: boolean;
  subject_id: string;
  version: string;
  generated_at: string;
  /** True when at least one of the three metrics is measurable. */
  measurable: boolean;
  hiring_readiness: EmployabilityMetric;
  job_readiness: EmployabilityMetric;
  employer_fit: EmployabilityMetric;
  /** Honest provenance of the inputs that were available. */
  inputs: {
    runtime_ready: boolean;
    ei_profile: boolean;
    readiness_profile: boolean;
    career_profile: boolean;
    target_occupation: string | null;
  };
  language_policy: typeof LANGUAGE_POLICY;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

function bandFromScore(score: number | null): EmployabilityBand {
  if (score == null || !Number.isFinite(score)) return 'Unmeasured';
  if (score >= 80) return 'Advanced';
  if (score >= 60) return 'Proficient';
  if (score >= 40) return 'Developing';
  return 'Emerging';
}

/** Ordering used to cap a band DOWN (Employer Fit critical-risk cap). */
const BAND_ORDER: EmployabilityBand[] = ['Unmeasured', 'Emerging', 'Developing', 'Proficient', 'Advanced'];
function capBand(band: EmployabilityBand, ceiling: EmployabilityBand): EmployabilityBand {
  return BAND_ORDER.indexOf(band) > BAND_ORDER.indexOf(ceiling) ? ceiling : band;
}

const emptyAxes = (detail: string, basis: string): MetricAxes => ({
  coverage: { measurable: false, coverage_pct: null, detail },
  confidence: { band: 'None', value: null, basis, caps: [] },
});

function unmeasured(
  key: EmployabilityMetric['key'],
  label: string,
  detail: string,
  basis: string,
  note: string,
): EmployabilityMetric {
  return {
    key,
    label,
    measurable: false,
    score: null,
    band: 'Unmeasured',
    axes: emptyAxes(detail, basis),
    drivers: [],
    notes: [note],
  };
}

/** Map a readiness-block confidence band (or EI confidence band) to our scale. */
function normConfBand(band: unknown): MetricAxes['confidence']['band'] {
  const b = String(band ?? '').toLowerCase();
  if (b === 'high') return 'High';
  if (b === 'moderate' || b === 'medium') return 'Moderate';
  if (b === 'low') return 'Low';
  return 'None';
}

// ===========================================================================
// employability_matching_engine — Hiring Readiness (role-agnostic)
// ===========================================================================

/**
 * Hiring Readiness — present-state, role-AGNOSTIC employability readiness.
 * Primary driver is the already-composed readiness composite (mean of the
 * measurable current/future/role blocks). When the readiness composite is not
 * measurable we fall back to the EI overall (current employability). When
 * neither exists the metric is honestly unmeasured.
 */
export function computeHiringReadiness(ctx: PassportContext): EmployabilityMetric {
  const label = 'Hiring Readiness';
  const readiness = ctx.readiness;
  const ei = ctx.eiProfile;

  // Preferred substrate: the readiness composite (already a mean of measurable
  // present-readiness blocks — we COMPOSE it, never recompute it).
  if (readiness?.overall.measurable && readiness.overall.score != null) {
    const score = round1(clamp(readiness.overall.score));
    const contributing = readiness.overall.contributing ?? [];
    const drivers = contributing.map((t) => {
      const blk = (readiness as CareerReadinessEnvelope)[t as 'current' | 'future' | 'role'] as ReadinessBlock | undefined;
      return { source: `readiness.${t}`, score: blk?.score ?? null, weight: round1(1 / contributing.length) };
    });
    return {
      key: 'hiring_readiness',
      label,
      measurable: true,
      score,
      band: bandFromScore(score),
      axes: {
        coverage: {
          measurable: true,
          coverage_pct: round1((contributing.length / 3) * 100),
          detail: `${contributing.length}/3 present-readiness blocks measurable (${contributing.join(', ')})`,
        },
        confidence: {
          band: normConfBand(ei?.overall_ei.confidence?.band),
          value: round1(contributing.length / 3),
          basis: 'readiness composite over measurable present-readiness blocks',
          caps: contributing.length < 3 ? ['partial substrate — not all readiness blocks measurable'] : [],
        },
      },
      drivers,
      notes: [readiness.overall.basis],
    };
  }

  // Fallback: EI overall (current employability) only.
  if (ei?.overall_ei.measurable && ei.overall_ei.ei_score != null) {
    const score = round1(clamp(ei.overall_ei.ei_score));
    return {
      key: 'hiring_readiness',
      label,
      measurable: true,
      score,
      band: bandFromScore(score),
      axes: {
        coverage: {
          measurable: true,
          coverage_pct: ei.overall_ei.coverage_pct ?? null,
          detail: `${ei.coverage.dimensions_measurable}/${ei.coverage.dimensions_total} EI dimensions measured (readiness composite unavailable)`,
        },
        confidence: {
          band: normConfBand(ei.overall_ei.confidence?.band),
          value: null,
          basis: 'EI overall fallback — readiness composite not measurable',
          caps: ['fallback to EI overall — present/future/role readiness composite unavailable'],
        },
      },
      drivers: [{ source: 'ei_profile.overall_ei', score, weight: 1, note: 'readiness composite unavailable' }],
      notes: ['Readiness composite not measurable; using EI overall as the present-readiness signal.'],
    };
  }

  return unmeasured(
    'hiring_readiness',
    label,
    'no readiness composite and no measured EI profile',
    'no present-readiness substrate',
    'Hiring readiness not yet measurable — no measured EI profile or readiness composite (honest absence).',
  );
}

// ===========================================================================
// job_readiness_engine — Job Readiness (role-specific)
// ===========================================================================

/**
 * Job Readiness — readiness against the subject's ANCHOR role (the role-readiness
 * block already computed inside the career-readiness envelope), contextualised by
 * the career profile's target_occupation. Requires a measurable role block; with
 * no anchor role the metric is honestly unmeasured (we never invent a target).
 */
export function computeJobReadiness(ctx: PassportContext): EmployabilityMetric {
  const label = 'Job Readiness';
  const roleBlock = ctx.readiness?.role;
  const target = readTargetOccupation(ctx);

  if (!roleBlock || !roleBlock.measurable || roleBlock.score == null) {
    const why = !roleBlock
      ? 'no readiness profile'
      : 'no anchor role readiness (role not in catalog or no measured competency profile)';
    return {
      ...unmeasured(
        'job_readiness',
        label,
        why,
        'role readiness block not measurable',
        `Job readiness not yet measurable — ${why}${target ? ` (target: ${target})` : ''} (honest absence).`,
      ),
      drivers: [],
    };
  }

  const score = round1(clamp(roleBlock.score));
  const cov = roleBlock.axes?.coverage;
  const conf = roleBlock.axes?.confidence;
  const detail = (roleBlock.detail ?? {}) as Record<string, unknown>;
  return {
    key: 'job_readiness',
    label,
    measurable: true,
    score,
    band: bandFromScore(score),
    axes: {
      coverage: {
        measurable: !!cov?.measurable,
        coverage_pct: cov?.coverage_pct ?? null,
        detail: cov?.detail ?? 'role readiness coverage',
      },
      confidence: {
        band: normConfBand(conf?.band),
        value: typeof conf?.value === 'number' ? conf.value : null,
        basis: conf?.basis ?? 'role readiness confidence',
        caps: Array.isArray(conf?.caps) ? [...conf.caps] : [],
      },
    },
    drivers: [{ source: 'readiness.role', score, weight: 1 }],
    notes: [
      `Anchored to role block${detail.role_title ? ` — ${String(detail.role_title)}` : ''}${target ? ` · career target: ${target}` : ''}.`,
      ...(Array.isArray(roleBlock.notes) ? roleBlock.notes : []),
    ],
  };
}

// ===========================================================================
// employer_fit_engine — Employer Fit (directional, provisional, critical-capped)
// ===========================================================================

/**
 * Employer Fit — a DIRECTIONAL alignment signal between the subject's
 * demonstrated profile (EI overall) and role demands (role readiness). It is:
 *   - ALWAYS provisional: there is no employer-side outcome data to validate
 *     against, so confidence is capped at Moderate.
 *   - Capped DOWN by HIGH-severity EI critical risks: an unaddressed high-severity
 *     behavioural risk can never read as a strong fit (band ceiling = Developing).
 *   - Measurable only when BOTH EI overall AND role readiness are measurable —
 *     a fit claim needs both the candidate signal and the role bar.
 */
export function computeEmployerFit(ctx: PassportContext): EmployabilityMetric {
  const label = 'Employer Fit';
  const ei = ctx.eiProfile;
  const roleBlock = ctx.readiness?.role;

  const eiOk = !!ei?.overall_ei.measurable && ei.overall_ei.ei_score != null;
  const roleOk = !!roleBlock?.measurable && roleBlock?.score != null;

  if (!eiOk || !roleOk) {
    const missing = [!eiOk ? 'EI overall' : null, !roleOk ? 'role readiness' : null].filter(Boolean).join(' + ');
    return unmeasured(
      'employer_fit',
      label,
      `requires EI overall AND role readiness; missing: ${missing}`,
      'insufficient substrate for a fit signal',
      `Employer fit not yet measurable — requires both EI overall and role readiness (missing: ${missing}) (honest absence).`,
    );
  }

  const eiScore = ei!.overall_ei.ei_score as number;
  const roleScore = roleBlock!.score as number;
  const raw = round1(clamp((eiScore + roleScore) / 2));

  // Critical-risk cap (directional honesty): a HIGH-severity EI risk caps the band.
  const highRisks = (ei!.critical_risks ?? []).filter((r) => r.severity === 'high');
  let band = bandFromScore(raw);
  const cappedByRisk = highRisks.length > 0 && BAND_ORDER.indexOf(band) > BAND_ORDER.indexOf('Developing');
  if (highRisks.length > 0) band = capBand(band, 'Developing');

  const caps = ['provisional — directional alignment signal, not a hiring/suitability decision'];
  if (cappedByRisk) caps.push(`band capped by ${highRisks.length} high-severity EI critical risk(s)`);

  // Coverage: average the two sources ONLY when both are genuinely present.
  // Never coerce an absent coverage to 0 (that would fabricate a measured value).
  const eiCov = typeof ei!.overall_ei.coverage_pct === 'number' ? clamp(ei!.overall_ei.coverage_pct) : null;
  const roleCovRaw = roleBlock!.axes?.coverage?.coverage_pct;
  const roleCov = typeof roleCovRaw === 'number' ? clamp(roleCovRaw) : null;
  let coveragePct: number | null;
  let coverageDetail: string;
  if (eiCov != null && roleCov != null) {
    coveragePct = round1((eiCov + roleCov) / 2);
    coverageDetail = 'mean of EI dimension coverage and role readiness coverage';
  } else if (eiCov != null) {
    coveragePct = eiCov;
    coverageDetail = 'EI dimension coverage only (role readiness coverage absent)';
  } else if (roleCov != null) {
    coveragePct = roleCov;
    coverageDetail = 'role readiness coverage only (EI dimension coverage absent)';
  } else {
    coveragePct = null;
    coverageDetail = 'coverage not reported by either source';
  }
  return {
    key: 'employer_fit',
    label,
    measurable: true,
    score: raw,
    band,
    axes: {
      coverage: {
        measurable: coveragePct != null,
        coverage_pct: coveragePct,
        detail: coverageDetail,
      },
      confidence: {
        // Provisional ceiling: never exceed Moderate (no employer outcome data).
        band: normConfBand(ei!.overall_ei.confidence?.band) === 'High' ? 'Moderate' : normConfBand(ei!.overall_ei.confidence?.band),
        value: null,
        basis: 'directional EI×role alignment; no employer-side outcome data to validate',
        caps,
      },
    },
    drivers: [
      { source: 'ei_profile.overall_ei', score: round1(eiScore), weight: 0.5 },
      { source: 'readiness.role', score: round1(roleScore), weight: 0.5 },
    ],
    notes: [
      'Directional alignment of demonstrated EI strengths with role demands — provisional and developmental, never a hiring verdict.',
      ...(highRisks.length > 0
        ? [`Band capped to Developing by high-severity EI critical risk(s): ${highRisks.map((r) => r.dimension_name ?? r.type).join(', ')}.`]
        : []),
    ],
  };
}

// ---------------------------------------------------------------------------
// Career-profile reader (read-only over the already-loaded JSONB blob)
// ---------------------------------------------------------------------------

function readTargetOccupation(ctx: PassportContext): string | null {
  const data = ctx.careerProfile?.data;
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const candidate =
    d.target_occupation ?? d.targetOccupation ?? d.target_role ?? d.targetRole ?? (d.target as any);
  const s = typeof candidate === 'string' ? candidate.trim() : '';
  return s.length ? s : null;
}

// ===========================================================================
// Orchestrator — employability_matching_engine
// ===========================================================================

async function loadSubstrate(pool: Pool, subjectId: string): Promise<PassportContext | null> {
  try {
    return await loadPassportContext(pool, subjectId);
  } catch {
    return null;
  }
}

export async function buildEmployabilityMatch(
  pool: Pool,
  subjectId: string,
): Promise<EngineResult<EmployabilityMatch>> {
  const sid = String(subjectId ?? '').trim();
  if (!sid) return err('invalid_input', 'subject id is required');

  const ctx = await loadSubstrate(pool, sid);
  if (!ctx) {
    // Substrate loader itself failed — degrade to an all-unmeasured envelope
    // (never throw), so the caller still gets an honest, well-formed result.
    const note = 'Profile substrate unavailable (read-only load failed) — all metrics honestly unmeasured.';
    return ok({
      ok: true,
      subject_id: sid,
      version: EMPLOYABILITY_MATCHING_ENGINE_VERSION,
      generated_at: new Date().toISOString(),
      measurable: false,
      hiring_readiness: unmeasured('hiring_readiness', 'Hiring Readiness', 'substrate unavailable', 'no substrate', note),
      job_readiness: unmeasured('job_readiness', 'Job Readiness', 'substrate unavailable', 'no substrate', note),
      employer_fit: unmeasured('employer_fit', 'Employer Fit', 'substrate unavailable', 'no substrate', note),
      inputs: {
        runtime_ready: false,
        ei_profile: false,
        readiness_profile: false,
        career_profile: false,
        target_occupation: null,
      },
      language_policy: LANGUAGE_POLICY,
      notes: [note],
    });
  }

  const hiring = computeHiringReadiness(ctx);
  const job = computeJobReadiness(ctx);
  const fit = computeEmployerFit(ctx);

  const notes: string[] = [...(ctx.notes ?? [])];
  if (!ctx.runtimeReady) {
    notes.push('Competency runtime schema not initialized — EI/readiness inputs unavailable (read-only; no schema created).');
  }

  return ok({
    ok: true,
    subject_id: sid,
    version: EMPLOYABILITY_MATCHING_ENGINE_VERSION,
    generated_at: new Date().toISOString(),
    measurable: hiring.measurable || job.measurable || fit.measurable,
    hiring_readiness: hiring,
    job_readiness: job,
    employer_fit: fit,
    inputs: {
      runtime_ready: ctx.runtimeReady,
      ei_profile: !!ctx.eiProfile?.overall_ei.measurable,
      readiness_profile: !!ctx.readiness?.measurable,
      career_profile: !!ctx.careerProfile?.exists,
      target_occupation: readTargetOccupation(ctx),
    },
    language_policy: (ctx.eiProfile?.language_policy as typeof LANGUAGE_POLICY) ?? LANGUAGE_POLICY,
    notes,
  });
}

/** Single-metric orchestrators (share the one substrate load; never-throws). */
export async function getHiringReadiness(pool: Pool, subjectId: string): Promise<EngineResult<EmployabilityMetric>> {
  const full = await buildEmployabilityMatch(pool, subjectId);
  return full.ok ? ok(full.data.hiring_readiness) : full;
}
export async function getJobReadiness(pool: Pool, subjectId: string): Promise<EngineResult<EmployabilityMetric>> {
  const full = await buildEmployabilityMatch(pool, subjectId);
  return full.ok ? ok(full.data.job_readiness) : full;
}
export async function getEmployerFit(pool: Pool, subjectId: string): Promise<EngineResult<EmployabilityMetric>> {
  const full = await buildEmployabilityMatch(pool, subjectId);
  return full.ok ? ok(full.data.employer_fit) : full;
}
