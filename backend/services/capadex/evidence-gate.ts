/**
 * CAPADEX 3.0 — Program 2: Evidence-gated stage progression (Task #304)
 *
 * Closes blueprint-06 GAP-P2 (evidence-gated advancement) + GAP-P1 (systematic
 * re-measurement). STRICTLY ADDITIVE, READ-ONLY, flag-gated layer on top of the
 * existing completion-only progression in `routes/capadex.ts` (`buildProgress`).
 * NEVER writes, runs NO DDL, reached only when `evidenceGatedProgression` is ON —
 * so flag-OFF behaviour (and schema) is byte-identical to legacy.
 *
 * ── Reuse-before-build: this layer COMPOSES two existing engines ───────────────
 *   1. competency-scoring `scoreToLevelBand()` — the canonical proficiency-band
 *      ladder (>=80/60/40/20 → 1..5). We use it for the READINESS dimension
 *      ("score vs stage threshold") instead of re-deriving thresholds locally.
 *      The CAPADEX stage score is a POSITIVE proficiency measure (mirrors
 *      getScoreLevel: Advanced/Proficient/Developing/Emerging — higher is better),
 *      NOT raw concern-signal magnitude, so a readiness threshold gate is honest
 *      and is exactly what GAP-P2 ("evidence-gated advancement") asks for.
 *   2. cohort-gating `applyKAnonymity()` — the canonical k-anonymity gate
 *      (masked/provisional/verified). We use it for the DATA-SUFFICIENCY
 *      sub-dimension of Confidence (is there enough peer data to trust a
 *      benchmark-referenced read?). It NEVER blocks advancement — gating a
 *      learner because too few peers share their cohort would be wrong.
 *
 * ── Three SEPARATE axes (never composited — replit.md honesty rule) ────────────
 *   Coverage   → does a measured result exist?            (has_session, has_score)
 *   Readiness  → does the measured result meet the bar?   (band vs min_band)
 *   Confidence → is it trustworthy/fresh + peer-backed?   (freshness + cohort)
 *
 * ── What gates advancement vs what is informational ───────────────────────────
 *   Advancement (next stage unlock) depends on the prior stage being `verified`,
 *   i.e. completed + a real measured result (Coverage) + readiness band >=
 *   STAGE_READINESS_MIN_BAND. A completed-but-low result is `below_bar` and holds
 *   the next stage `locked` with an honest, supportive reason. A completed-but-
 *   unscored row is `insufficient_evidence` (re-measure to advance). DATA-
 *   SUFFICIENCY (cohort k-anonymity) is reported alongside but NEVER gates.
 *
 * ── GAP-P1 (systematic re-measurement) ───────────────────────────────────────
 *   A derived `due_for_remeasurement` marker flags a completed stage whose newest
 *   evidence is older than `EVIDENCE_FRESHNESS_DAYS`. READ-ONLY display signal —
 *   no scheduler, no job, never changes lock/unlock.
 */

import { scoreToLevelBand } from '../competency-scoring.js';
import { applyKAnonymity, K_MIN } from '../cohort-gating.js';

/** Per-stage evidence snapshot extracted from the existing capadex_sessions row. */
export interface StageEvidenceEntry {
  /** Latest session status for this stage: 'completed' | 'in_progress' | undefined (absent). */
  status?: string;
  /** Computed concern score for the latest session (0–100), or null when none. */
  score: number | null;
  /** updated_at of the latest session for this stage, or null when absent. */
  updatedAt: Date | null;
}

export type EvidenceVerdict =
  | 'verified'              // completed + measured score + readiness >= threshold
  | 'below_bar'            // completed + measured score but readiness below threshold
  | 'insufficient_evidence' // completed flag set but NO usable measured result
  | 'in_progress'           // session open, not yet completed
  | 'not_started'           // no session yet, but unlocked (available)
  | 'blocked';              // no session and the prior stage is not yet verified

export interface EvidenceCoverage {
  has_session: boolean;
  has_score: boolean;
  score: number | null;
}

/** Readiness — composed via competency-scoring scoreToLevelBand (score vs threshold). */
export interface EvidenceReadiness {
  /** 1..5 proficiency band from scoreToLevelBand, or null when no measured score. */
  band: number | null;
  /** Mirror of getScoreLevel labels for the band, or null. */
  label: string | null;
  /** Minimum band a stage must reach to count as ready for advancement. */
  min_band: number;
  /** band >= min_band, or null when unmeasurable. */
  meets_threshold: boolean | null;
}

/** Data sufficiency — composed via cohort-gating applyKAnonymity (NEVER gates). */
export interface EvidenceDataSufficiency {
  status: 'masked' | 'provisional' | 'verified';
  n: number;
  k_min: number;
}

export interface EvidenceConfidence {
  /** Freshness-based: verified = fresh measured result; provisional = stale; none = no usable result. */
  level: 'verified' | 'provisional' | 'none';
  age_days: number | null;
  fresh: boolean | null;
  /** Peer-data sufficiency for benchmark-referenced confidence (composed; non-gating). */
  data_sufficiency: EvidenceDataSufficiency;
}

export interface EvidenceGate {
  verdict: EvidenceVerdict;
  reason: string;
  coverage: EvidenceCoverage;
  readiness: EvidenceReadiness;
  confidence: EvidenceConfidence;
  /** GAP-P1: completed stage whose evidence is older than the freshness window. */
  due_for_remeasurement: boolean;
}

export interface EvidenceGateOptions {
  /** Freshness window (days) for the GAP-P1 re-measurement signal. */
  freshnessDays?: number;
  /** Minimum readiness band required to advance (score vs stage threshold). */
  minBand?: number;
  /** Cohort member count (from cohort-gating countCohort) for data-sufficiency. */
  cohortN?: number;
  /** Injectable clock for deterministic tests. */
  now?: Date;
}

/**
 * Freshness window for the re-measurement signal (GAP-P1). 180 days (~6 months):
 * behavioural concern signals drift over months, so a half-year-old measurement
 * is flagged "due for a re-check". READ-ONLY display heuristic — never gates.
 */
export const EVIDENCE_FRESHNESS_DAYS = 180;

/**
 * Minimum readiness band (from scoreToLevelBand) required to advance. Band 3 maps
 * to score >= 40 — the first non-"Emerging" band in getScoreLevel — so advancement
 * requires at least a "Developing" measured result. A completed result below this
 * is `below_bar` (held with a supportive reason), NOT silently advanced. The whole
 * gate is flag-gated OFF by default, so prod behaviour is unchanged until enabled.
 */
export const STAGE_READINESS_MIN_BAND = 3;

/** Band → label, mirroring getScoreLevel in routes/capadex.ts. */
const BAND_LABEL: Record<number, string> = {
  5: 'Advanced', 4: 'Proficient', 3: 'Developing', 2: 'Emerging', 1: 'Emerging',
};

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

/** Compose cohort-gating into a non-gating data-sufficiency descriptor. */
function deriveDataSufficiency(cohortN: number): EvidenceDataSufficiency {
  const n = Number.isFinite(cohortN) && cohortN > 0 ? Math.floor(cohortN) : 0;
  const gated = applyKAnonymity(n, null);
  return { status: gated.cohort_status, n: gated.n, k_min: gated.k_min ?? K_MIN };
}

/**
 * Pure evaluator for ONE stage's OWN evidence. Never throws. All knobs (clock,
 * freshness window, min band, cohort N) are injectable for deterministic tests.
 */
export function evaluateStageEvidence(
  entry: StageEvidenceEntry | undefined,
  opts: EvidenceGateOptions = {},
): EvidenceGate {
  const freshnessDays = opts.freshnessDays ?? EVIDENCE_FRESHNESS_DAYS;
  const minBand = opts.minBand ?? STAGE_READINESS_MIN_BAND;
  const now = opts.now ?? new Date();
  const cohortN = opts.cohortN ?? 0;

  const status = entry?.status;
  const score = entry?.score ?? null;
  const hasSession = status === 'completed' || status === 'in_progress';
  const hasScore = score != null && Number.isFinite(score);

  const ageDays =
    entry?.updatedAt instanceof Date && !Number.isNaN(entry.updatedAt.getTime())
      ? Math.max(0, daysBetween(now, entry.updatedAt))
      : null;

  const coverage: EvidenceCoverage = { has_session: hasSession, has_score: hasScore, score };

  // Readiness — composed via competency-scoring scoreToLevelBand.
  const band = hasScore ? scoreToLevelBand(score as number) : null;
  const readiness: EvidenceReadiness = {
    band,
    label: band != null ? (BAND_LABEL[band] ?? null) : null,
    min_band: minBand,
    meets_threshold: band != null ? band >= minBand : null,
  };

  const data_sufficiency = deriveDataSufficiency(cohortN);

  if (status === 'completed') {
    if (!hasScore) {
      // Completed flag set but no usable measured result (degenerate / legacy row).
      return {
        verdict: 'insufficient_evidence',
        reason: 'Marked completed but no measured result is available; re-measurement needed before this counts as evidence.',
        coverage,
        readiness,
        confidence: { level: 'none', age_days: ageDays, fresh: ageDays == null ? null : false, data_sufficiency },
        due_for_remeasurement: true,
      };
    }
    const fresh = ageDays == null ? null : ageDays <= freshnessDays;
    const due = ageDays != null && ageDays > freshnessDays;
    const confidence: EvidenceConfidence = {
      level: due ? 'provisional' : 'verified', age_days: ageDays, fresh, data_sufficiency,
    };
    if (readiness.meets_threshold === false) {
      return {
        verdict: 'below_bar',
        reason: `Completed, but readiness is "${readiness.label}" (band ${band}; band ${minBand}+ needed to advance). Build a little more here before the next stage.`,
        coverage,
        readiness,
        confidence,
        due_for_remeasurement: due,
      };
    }
    return {
      verdict: 'verified',
      reason: due
        ? 'Completed with a measured result that meets the bar; evidence is older than the freshness window and is due for re-measurement.'
        : 'Completed with a measured result that meets the bar.',
      coverage,
      readiness,
      confidence,
      due_for_remeasurement: due,
    };
  }

  if (status === 'in_progress') {
    return {
      verdict: 'in_progress',
      reason: 'Assessment in progress — no completed evidence yet.',
      coverage,
      readiness,
      confidence: { level: 'none', age_days: ageDays, fresh: null, data_sufficiency },
      due_for_remeasurement: false,
    };
  }

  // Absent — verdict (not_started vs blocked) is decided by the caller based on
  // whether the prior stage is verified. Default to not_started here.
  return {
    verdict: 'not_started',
    reason: 'No assessment recorded yet for this stage.',
    coverage,
    readiness,
    confidence: { level: 'none', age_days: null, fresh: null, data_sufficiency },
    due_for_remeasurement: false,
  };
}

/** Legacy progress row shape produced by buildProgress (routes/capadex.ts). */
export interface LegacyProgressStage {
  stage_code: string;
  stage_label: string;
  stage_index: number;
  stage_color: string;
  status: string;
  score: number | null;
}

export interface EvidenceGatedProgressStage extends LegacyProgressStage {
  gate: EvidenceGate;
}

/**
 * Pure enrichment over the legacy progress array. Returns a NEW array where each
 * stage carries an additive `gate` envelope, and an absent next stage is `locked`
 * (gate verdict `blocked`) UNLESS the prior stage's evidence is `verified`
 * (completed + measured + readiness meets the bar) — this is the GAP-P2 evidence
 * gate. Existing `status` vocabulary is preserved ('available' | 'locked' |
 * 'completed' | 'in_progress') so legacy consumers keep working; the nuance lives
 * in `gate.verdict`.
 *
 * Never throws; on any inconsistency it falls back to the legacy stage object.
 */
export function enrichProgressWithEvidence(
  legacy: LegacyProgressStage[],
  entriesByStage: Record<string, StageEvidenceEntry>,
  opts: EvidenceGateOptions = {},
): EvidenceGatedProgressStage[] {
  try {
    const stages = legacy.map((s) => ({ ...s }));
    const gates: EvidenceGate[] = stages.map((s) =>
      evaluateStageEvidence(entriesByStage[s.stage_code], opts),
    );

    return stages.map((s, i) => {
      const gate = gates[i];
      const entry = entriesByStage[s.stage_code];
      const isAbsent = !entry || (entry.status !== 'completed' && entry.status !== 'in_progress');

      let status = s.status;
      let resolvedGate = gate;

      if (isAbsent) {
        // First stage is always reachable (legacy parity).
        const priorVerified = i === 0 ? true : gates[i - 1]?.verdict === 'verified';
        if (priorVerified) {
          status = 'available';
          resolvedGate = { ...gate, verdict: 'not_started' };
        } else {
          status = 'locked';
          const prior = i > 0 ? gates[i - 1] : undefined;
          const reason =
            prior?.verdict === 'below_bar'
              ? 'Locked: the previous stage is complete but its readiness is below the bar to advance; build a little more there to unlock this stage.'
              : prior?.verdict === 'insufficient_evidence'
              ? 'Locked: the previous stage is marked complete but lacks a measured result; re-measure it to unlock this stage.'
              : 'Locked: complete the previous stage with a measured result to unlock this stage.';
          resolvedGate = { ...gate, verdict: 'blocked', reason };
        }
      }

      return { ...s, status, gate: resolvedGate };
    });
  } catch {
    // Honest degradation: never break progression on an enrichment fault.
    const data_sufficiency = deriveDataSufficiency(0);
    return legacy.map((s) => ({
      ...s,
      gate: {
        verdict: 'not_started',
        reason: 'Evidence gate unavailable; showing completion-only status.',
        coverage: { has_session: false, has_score: false, score: null },
        readiness: { band: null, label: null, min_band: opts.minBand ?? STAGE_READINESS_MIN_BAND, meets_threshold: null },
        confidence: { level: 'none', age_days: null, fresh: null, data_sufficiency },
        due_for_remeasurement: false,
      },
    }));
  }
}
