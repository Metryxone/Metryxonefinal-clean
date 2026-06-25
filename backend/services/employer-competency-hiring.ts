/**
 * Employer Competency Hiring Activation — 98X Gap Closure, Phase 3
 * (additive, flag-gated, read-only).
 *
 * WHAT THIS IS
 * ------------
 * A NEW, isolated service that makes employer candidate↔job matching COMPETENCY-DRIVEN
 * by reading the canonical `onto_*` genome, instead of the legacy keyword/LBI heuristic
 * in `routes/employer-hiring-intelligence.ts`. That legacy engine is left UNTOUCHED —
 * this composes ALONGSIDE it behind a flag and exposes a separate route family.
 *
 * It composes (never recomputes):
 *   - Phase-1 `generateRoleDNA`            → role requirements (curated onto_* over O*NET).
 *   - Phase-2 `resolveUnifiedCompetencyProfile` → candidate competency profile (UNION of
 *     both scoring ledgers), keyed by the candidate's email subject.
 *   - (best-effort) `computeRoleReadinessV2`     → candidate-scope competency readiness.
 *
 * HONESTY CONTRACT
 * ----------------
 * - Reads ONLY. No writes, no DDL. (Outcome capture for calibration is a separate explicit
 *   write in a later phase, not here.)
 * - The candidate competency subject is `candidate.email` — the operator-supplied text key
 *   the `onto_*` ledgers are scored against. No email → no subject → abstain (fail closed).
 * - Fail CLOSED: when no competency profile exists (or no requirement overlaps), the
 *   competency match is `null` and `source='heuristic_fallback'` — NEVER a fabricated
 *   competency number, and no hiring verdict is asserted.
 * - Coverage (requirements actually assessed) and Confidence (calibration state) are
 *   reported as SEPARATE axes. Calibration is `uncalibrated` until >=30 realized outcomes;
 *   the fit signal is explicitly flagged `validated:false` until then — it is a developmental
 *   competency signal, NOT a validated hiring prediction.
 * - `null` where unmeasured — never coerced to 0.
 */
import type { Pool } from 'pg';
import {
  resolveUnifiedCompetencyProfile,
  type UnifiedCompetencyScore,
} from './competency-intelligence-contracts';
import {
  generateRoleDNA,
  type RoleBenchmark,
  type RoleDNARequirement,
} from './role-dna-expansion-engine';
import { computeRoleReadinessV2 } from './role-readiness-v2';

export const EMPLOYER_COMPETENCY_HIRING_VERSION = '98x-phase3-1.1.0';

/** Realized outcomes required before the platform can claim a calibrated probability. */
export const CALIBRATION_MIN_OUTCOMES = 30;

/** Minimum requirement coverage (%) before a HEADLINE fit band may be asserted. Below
 *  this, the assessed-subset band is too thin to represent role fit, so the headline band
 *  is WITHHELD (null) and the signal is flagged provisional — coverage and fit must not be
 *  conflated (a high match on 1/76 requirements is not a strong fit). */
export const MIN_COVERAGE_FOR_FIT = 50;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function norm(s: unknown): string {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
/** Effective weight — curated onto_* weights are 0..1; an absent/zero weight falls back to
 *  equal weighting (1) so a requirement is never silently dropped from the denominator. */
function effWeight(req: { weight?: number | null }): number {
  const w = Number(req?.weight);
  return Number.isFinite(w) && w > 0 ? w : 1;
}

/** Read-only table probe — degrade (false) on any error, never throw. */
async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try {
    const { rows } = await pool.query('SELECT to_regclass($1) AS reg', [name]);
    return !!rows[0]?.reg;
  } catch {
    return false;
  }
}

/**
 * Crosswalk from a role-DNA requirement competency id (`comp_*`) to its canonical
 * onto-DOMAIN id (`dom_*`), read from `onto_competencies.domain_id`. This is the binding
 * that lets a candidate's DOMAIN-PROXY profile (a handful of measured `dom_*` scores)
 * score against `comp_*` role requirements — exactly the crosswalk the competency runtime
 * itself uses for domain-proxy measurement. Read-only; degrades to an empty map (never
 * throws, never fabricates a domain).
 */
async function loadCompetencyDomainCrosswalk(
  pool: Pool,
  compCodes: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = Array.from(new Set(compCodes.map((c) => String(c ?? '').trim()).filter(Boolean)));
  if (!ids.length) return map;
  if (!(await tableExists(pool, 'onto_competencies'))) return map;
  try {
    const { rows } = await pool.query(
      `SELECT id, domain_id FROM onto_competencies WHERE id = ANY($1::text[])`,
      [ids],
    );
    for (const r of rows as any[]) {
      const id = String(r?.id ?? '').trim();
      const dom = String(r?.domain_id ?? '').trim();
      if (id && dom) map.set(id, dom);
    }
  } catch {
    // Degrade: a read failure yields an empty crosswalk → requirements stay unassessed
    // (honest coverage miss), never a fabricated match.
  }
  return map;
}

/** Target score (0..100) a requirement expects, from its expected level / proficiency. */
export function targetScoreOf(req: RoleDNARequirement): number {
  if (req.expectedLevel != null && Number.isFinite(Number(req.expectedLevel))) {
    return Math.max(20, Math.min(100, Number(req.expectedLevel) * 20));
  }
  switch ((req.targetProficiency ?? '').toLowerCase()) {
    case 'expert': return 95;
    case 'advanced': return 85;
    case 'proficient': return 70;
    case 'novice': return 40;
    default: return 70; // 'established' threshold default
  }
}

/** The candidate competency subject key. `onto_*` ledgers are scored against the
 *  operator-supplied email; no email → no subject (abstain, never guess). */
export function resolveCandidateCompetencySubject(candidate: any): string | null {
  const email = String(candidate?.email ?? '').trim();
  return email || null;
}

/** How a requirement was matched to a candidate score. */
export type RequirementMatchVia = 'direct_competency' | 'domain_proxy';

/** Find the candidate's MEASURED competency score for a role requirement.
 *  Match precedence:
 *    1. DIRECT — exact canonical key, then normalized-label equality / bidirectional token
 *       containment (a per-competency score for this exact requirement).
 *    2. DOMAIN-PROXY — the requirement's competency `comp_*` → its onto-DOMAIN `dom_*`
 *       (via compDomainMap) → the candidate's measured domain score. This is the same
 *       domain-proxy measurement the competency runtime uses; it is clearly LABELLED so a
 *       proxied score is never mistaken for a per-competency one.
 *  Unmeasured scores are skipped (never matched). */
function findCandidateScore(
  req: RoleDNARequirement,
  scores: UnifiedCompetencyScore[],
  compDomainMap?: Map<string, string>,
): { score: UnifiedCompetencyScore; via: RequirementMatchVia } | null {
  const code = norm(req.code);
  const name = norm(req.name);
  // 1) Direct — exact canonical key.
  for (const s of scores) {
    if (s.score == null) continue;
    if (code && norm(s.key) === code) return { score: s, via: 'direct_competency' };
  }
  // 1) Direct — normalized label equality / token containment.
  for (const s of scores) {
    if (s.score == null) continue;
    const label = norm(s.label);
    if (!label || !name) continue;
    if (label === name || label.includes(name) || name.includes(label)) {
      return { score: s, via: 'direct_competency' };
    }
  }
  // 2) Domain-proxy — requirement competency → its onto-domain → candidate's domain score.
  if (compDomainMap && compDomainMap.size > 0) {
    const domainId = compDomainMap.get(String(req.code ?? '').trim());
    if (domainId) {
      const dnorm = norm(domainId);
      for (const s of scores) {
        if (s.score == null) continue;
        if (s.granularity === 'domain' && norm(s.key) === dnorm) {
          return { score: s, via: 'domain_proxy' };
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public contracts
// ---------------------------------------------------------------------------
export interface CompetencyRequirementMatch {
  code: string;
  name: string;
  importanceTier: string;
  weight: number;
  source: string;
  targetScore: number;
  candidateScore: number | null;
  /** candidateScore / targetScore clamped to 0..1, or null when unassessed. */
  attainment: number | null;
  assessed: boolean;
  matchedKey: string | null;
  matchedLedger: string | null;
  /** How the requirement was matched: a per-competency score (`direct_competency`) or the
   *  candidate's measured onto-domain score used as a proxy (`domain_proxy`). null when
   *  unassessed. A proxied attainment is NEVER represented as a per-competency measurement. */
  matchVia: RequirementMatchVia | null;
}

export interface CompetencyDrivenMatch {
  subjectId: string | null;
  jobId: string | null;
  jobTitle: string | null;
  /** Source of the candidate competency signal. */
  source: 'onto_competency_profile' | 'heuristic_fallback';
  competencyProfileAvailable: boolean;
  /** Weighted attainment over ASSESSED requirements (0..100), or null when none assessed. */
  competencyMatch: number | null;
  /** Assessed requirement weight / total requirement weight (0..100) — Coverage axis. */
  requirementCoveragePct: number | null;
  matchedRequirementCount: number;
  totalRequirementCount: number;
  /** Of the matched requirements, how many used a per-competency (direct) score. */
  directMatchCount: number;
  /** Of the matched requirements, how many used a domain-proxy (onto-domain) score. */
  domainProxyMatchCount: number;
  requirements: CompetencyRequirementMatch[];
  /** Assessed requirements below target (real, measured gaps). */
  gaps: CompetencyRequirementMatch[];
  /** Requirements with no candidate competency data (coverage gaps, never fabricated). */
  unassessedRequirements: CompetencyRequirementMatch[];
  roleDna: {
    resolved: boolean;
    roleTitle: string | null;
    requirementSource: string;
    confidence: number;
    band: string;
    provisional: boolean;
    /** Phase-1 Role DNA benchmark (read-only, abstain-by-default; ti_role_benchmarks).
     *  Surfaced here so employer consumers read ONE DNA computation. */
    benchmark: RoleBenchmark;
  };
  candidateReadiness: {
    available: boolean;
    readinessScore: number | null;
    band: string | null;
    coveragePct: number | null;
    note: string;
  };
  calibration: {
    state: 'calibrated' | 'uncalibrated';
    realizedOutcomes: number | null;
    minRequired: number;
    note: string;
  };
  fitSignal: {
    /** Headline fit band — WITHHELD (null) when coverage < MIN_COVERAGE_FOR_FIT or no match.
     *  Machine-readable so downstream consumers never key on a coverage-thin band. */
    band: 'strong_fit' | 'fit' | 'conditional' | 'development_focus' | null;
    /** Band over the ASSESSED subset only (transparency; ignores coverage — never the headline). */
    assessedBand: 'strong_fit' | 'fit' | 'conditional' | 'development_focus' | null;
    /** True when assessed coverage >= MIN_COVERAGE_FOR_FIT (headline band may be asserted). */
    coverageSufficient: boolean;
    /** True when the signal is coverage-thin OR uncalibrated — not a settled fit. */
    provisional: boolean;
    rationale: string;
    /** True only once the platform has >=minRequired realized outcomes. */
    validated: boolean;
  };
  coverageNote: string;
  confidenceNote: string;
  provenance: string;
  version: string;
  generatedAt: string;
}

const LANGUAGE_NOTE =
  'Developmental competency fit signal — NOT a validated hiring/suitability prediction. ' +
  'Coverage (requirements assessed) and Confidence (calibration state) are independent axes.';

/** Count of realized hiring outcomes (decided candidates) — the calibration substrate.
 *  Read-only; absent/unreadable → null (degrade, never throw). */
async function realizedOutcomeCount(pool: Pool): Promise<number | null> {
  try {
    const { rows } = await pool.query(
      'SELECT to_regclass($1) AS reg',
      ['employer_candidates'],
    );
    if (!rows[0]?.reg) return null;
    const r = await pool.query(
      'SELECT COUNT(*)::int n FROM employer_candidates WHERE decision_at IS NOT NULL',
    );
    return Number(r.rows[0]?.n ?? 0);
  } catch {
    return null;
  }
}

function fitBandOf(match: number | null): CompetencyDrivenMatch['fitSignal']['band'] {
  if (match == null) return null;
  if (match >= 80) return 'strong_fit';
  if (match >= 65) return 'fit';
  if (match >= 50) return 'conditional';
  return 'development_focus';
}

/**
 * Competency-driven candidate↔job match. Composes Phase-1 DNA + Phase-2 profile +
 * Role-Readiness-V2. Read-only; never throws (callers still wrap defensively).
 */
export async function computeCompetencyDrivenMatch(
  pool: Pool,
  opts: { candidate: any; job: any },
): Promise<CompetencyDrivenMatch> {
  const { candidate, job } = opts;
  const subjectId = resolveCandidateCompetencySubject(candidate);
  const jobId = job?.id != null ? String(job.id) : null;
  const jobTitle = String(job?.title ?? '').trim() || null;

  // Role DNA → requirements from the canonical genome (curated onto_* over O*NET).
  const dna = await generateRoleDNA(pool, jobTitle ?? '');
  const reqs = dna.requirements ?? [];

  const calibrationOutcomes = await realizedOutcomeCount(pool);
  const calibrated = (calibrationOutcomes ?? 0) >= CALIBRATION_MIN_OUTCOMES;
  const calibration: CompetencyDrivenMatch['calibration'] = {
    state: calibrated ? 'calibrated' : 'uncalibrated',
    realizedOutcomes: calibrationOutcomes,
    minRequired: CALIBRATION_MIN_OUTCOMES,
    note: calibrated
      ? 'Sufficient realized outcomes to calibrate probability.'
      : `Uncalibrated — ${calibrationOutcomes ?? 0}/${CALIBRATION_MIN_OUTCOMES} realized outcomes. ` +
        'Fit signal is developmental, not a validated hiring probability.',
  };

  const roleDna = {
    resolved: dna.resolved,
    roleTitle: dna.roleTitle,
    requirementSource: dna.requirementSource,
    confidence: dna.match.confidence,
    band: dna.match.band,
    provisional: dna.match.provisional,
    benchmark: dna.benchmark,
  };

  const baseFail = (source: CompetencyDrivenMatch['source'], reason: string): CompetencyDrivenMatch => ({
    subjectId,
    jobId,
    jobTitle,
    source,
    competencyProfileAvailable: false,
    competencyMatch: null,
    requirementCoveragePct: null,
    matchedRequirementCount: 0,
    totalRequirementCount: reqs.length,
    directMatchCount: 0,
    domainProxyMatchCount: 0,
    requirements: [],
    gaps: [],
    unassessedRequirements: [],
    roleDna,
    candidateReadiness: { available: false, readinessScore: null, band: null, coveragePct: null, note: reason },
    calibration,
    fitSignal: { band: null, assessedBand: null, coverageSufficient: false, provisional: true, rationale: reason, validated: false },
    coverageNote: reason,
    confidenceNote: LANGUAGE_NOTE,
    provenance: '98x_phase3_employer_competency_hiring',
    version: EMPLOYER_COMPETENCY_HIRING_VERSION,
    generatedAt: new Date().toISOString(),
  });

  // Fail CLOSED: no competency subject → no competency read possible.
  if (!subjectId) {
    return baseFail('heuristic_fallback',
      'No candidate email — cannot resolve a competency subject; competency match withheld (heuristic fallback applies).');
  }

  const profile = await resolveUnifiedCompetencyProfile(pool, subjectId);
  const measuredScores = profile.scores.filter((s) => s.score != null);
  const hasProfile = profile.available && profile.resolved && measuredScores.length > 0;

  if (!hasProfile) {
    const reason = !profile.available
      ? 'Competency ledgers not present/readable in this environment — competency match withheld (degraded).'
      : 'No measured competency profile for this candidate — competency match withheld (heuristic fallback applies).';
    return baseFail('heuristic_fallback', reason);
  }

  // Load the comp_* → dom_* crosswalk once so requirements expressed as competencies can be
  // scored against a candidate whose profile is at DOMAIN granularity (domain-proxy). The
  // candidate's per-competency scores still win (direct match) when present.
  const compDomainMap = await loadCompetencyDomainCrosswalk(pool, reqs.map((r) => String(r.code)));

  // Map each requirement to the candidate's measured competency where it overlaps.
  const requirements: CompetencyRequirementMatch[] = reqs.map((req) => {
    const target = targetScoreOf(req);
    const cs = findCandidateScore(req, profile.scores, compDomainMap);
    const candidateScore = cs?.score.score ?? null;
    const attainment = candidateScore != null && target > 0 ? round1(clamp01(candidateScore / target) * 100) / 100 : null;
    return {
      code: req.code,
      name: req.name,
      importanceTier: req.importanceTier,
      weight: effWeight(req),
      source: req.source,
      targetScore: target,
      candidateScore,
      attainment,
      assessed: candidateScore != null,
      matchedKey: cs?.score.key ?? null,
      matchedLedger: cs ? (cs.via === 'domain_proxy' ? `${cs.score.ledger} (domain_proxy)` : cs.score.ledger) : null,
      matchVia: cs?.via ?? null,
    };
  });

  const assessed = requirements.filter((m) => m.assessed);
  const gaps = assessed.filter((m) => (m.attainment ?? 1) < 1);
  const unassessed = requirements.filter((m) => !m.assessed);

  const totalWeight = requirements.reduce((s, m) => s + m.weight, 0);
  const assessedWeight = assessed.reduce((s, m) => s + m.weight, 0);

  // Competency match = weighted attainment over ASSESSED requirements only (quality axis,
  // not penalized for coverage). Coverage is reported separately.
  let competencyMatch: number | null = null;
  if (assessed.length > 0 && assessedWeight > 0) {
    const wScore = assessed.reduce((s, m) => s + m.weight * ((m.attainment ?? 0) * 100), 0);
    competencyMatch = round1(wScore / assessedWeight);
  }

  const requirementCoveragePct =
    totalWeight > 0 ? round1((assessedWeight / totalWeight) * 100) : null;

  // If there was a profile but NO requirement overlapped, that is an honest coverage miss —
  // fall back explicitly rather than report a fabricated 0.
  if (assessed.length === 0) {
    const fail = baseFail('heuristic_fallback',
      'Candidate has a competency profile but none of the role requirements overlap with assessed competencies — competency match withheld (coverage miss).');
    return {
      ...fail,
      competencyProfileAvailable: true,
      requirements,
      unassessedRequirements: unassessed,
      requirementCoveragePct: requirementCoveragePct ?? 0,
    };
  }

  // Candidate-scope readiness (role-agnostic vs curated onto_* roles) — best-effort context.
  let candidateReadiness: CompetencyDrivenMatch['candidateReadiness'] = {
    available: false,
    readinessScore: null,
    band: null,
    coveragePct: null,
    note: 'Candidate readiness unmeasured.',
  };
  try {
    const rr = await computeRoleReadinessV2(pool, subjectId);
    if (rr.readiness?.measured) {
      candidateReadiness = {
        available: true,
        readinessScore: rr.readiness.score,
        band: rr.readiness.band,
        coveragePct: rr.readiness.coverage_pct,
        note: 'Candidate-scope competency readiness (role-agnostic; curated onto_* role link), not job-specific.',
      };
    } else {
      candidateReadiness.note =
        'Candidate readiness unmeasured (no scored profile or no linked curated role).';
    }
  } catch {
    candidateReadiness.note = 'Candidate readiness could not be computed (degraded).';
  }

  const directMatchCount = assessed.filter((m) => m.matchVia === 'direct_competency').length;
  const domainProxyMatchCount = assessed.filter((m) => m.matchVia === 'domain_proxy').length;

  const assessedBand = fitBandOf(competencyMatch);
  const coverageSufficient = (requirementCoveragePct ?? 0) >= MIN_COVERAGE_FOR_FIT;
  // Headline band is WITHHELD when coverage is too thin to represent role fit — a high
  // match on a 1/76 subset must NOT surface as strong_fit. Coverage and fit stay separate.
  const band = coverageSufficient ? assessedBand : null;
  const provisional = !coverageSufficient || !calibrated;
  const rationale =
    `Competency match ${competencyMatch}/100 over ${assessed.length}/${requirements.length} assessed requirements ` +
    `(coverage ${requirementCoveragePct}%; ${directMatchCount} direct, ${domainProxyMatchCount} domain-proxy). ` +
    (domainProxyMatchCount > 0
      ? `${domainProxyMatchCount} requirement(s) scored via DOMAIN-PROXY (the candidate's measured onto-domain score stands in for the per-competency score) — a developmental approximation, not a per-competency measurement. `
      : '') +
    (coverageSufficient
      ? ''
      : `Headline fit band WITHHELD — coverage ${requirementCoveragePct}% < ${MIN_COVERAGE_FOR_FIT}% minimum ` +
        `(assessed-subset band would be ${assessedBand}). `) +
    (calibrated
      ? 'Calibrated probability available.'
      : 'Uncalibrated developmental signal — not a validated hiring prediction.');

  return {
    subjectId,
    jobId,
    jobTitle,
    source: 'onto_competency_profile',
    competencyProfileAvailable: true,
    competencyMatch,
    requirementCoveragePct,
    matchedRequirementCount: assessed.length,
    totalRequirementCount: requirements.length,
    directMatchCount,
    domainProxyMatchCount,
    requirements,
    gaps,
    unassessedRequirements: unassessed,
    roleDna,
    candidateReadiness,
    calibration,
    fitSignal: { band, assessedBand, coverageSufficient, provisional, rationale, validated: calibrated },
    coverageNote:
      `Coverage = assessed requirement weight / total requirement weight = ${requirementCoveragePct}%. ` +
      `${assessed.length} requirement(s) assessed (${directMatchCount} direct competency, ${domainProxyMatchCount} domain-proxy); ` +
      `${unassessed.length} had no candidate competency data (never fabricated). ` +
      (domainProxyMatchCount > 0
        ? 'Domain-proxy matches use the candidate\'s measured onto-domain score as a stand-in for the per-competency score — clearly labelled (matchVia=domain_proxy), never represented as a direct measurement.'
        : ''),
    confidenceNote: LANGUAGE_NOTE,
    provenance: '98x_phase3_employer_competency_hiring',
    version: EMPLOYER_COMPETENCY_HIRING_VERSION,
    generatedAt: new Date().toISOString(),
  };
}
