/**
 * CAPADEX 3.0 — Program 2: Evidence-gated stage progression (Task #304)
 *
 * Closes blueprint-06 GAP-P2 (evidence-gated advancement) + GAP-P1 (systematic
 * re-measurement). This is a STRICTLY ADDITIVE, READ-ONLY, flag-gated layer on
 * top of the existing completion-only progression in `routes/capadex.ts`
 * (`buildProgress`). It NEVER writes, runs NO DDL, and is reached only when the
 * `evidenceGatedProgression` flag is ON — so flag-OFF behaviour (and schema) is
 * byte-identical to legacy.
 *
 * ── What "evidence" means here ────────────────────────────────────────────────
 * The legacy gate advances a learner to the next stage purely because the prior
 * stage's session row carries `status='completed'`. GAP-P2 asks for an EVIDENCE
 * gate: advancement should require that the prior stage actually produced a
 * measured result — a completed session WITH a computed score (Coverage) that is
 * trustworthy/fresh (Confidence). These two axes are kept SEPARATE and never
 * composited (replit.md honesty rule).
 *
 *   Coverage   → does measured data exist?  (has_session, has_score)
 *   Confidence → is it trustworthy / fresh?  (level, age_days, fresh)
 *
 * ── Deliberate scope decision (honest deviation worth recording) ──────────────
 * The Task #304 plan listed a `below_bar` verdict (score vs a stage threshold)
 * as a possible BLOCKING outcome. We deliberately DO NOT let the CAPADEX score
 * block advancement. The CAPADEX score is concern-DIAGNOSTIC (a behavioural /
 * wellbeing signal), NOT a competency-mastery score — barring a learner from a
 * supportive next stage because their concern score is "low" would be harmful
 * and violates the platform strengths-canon (signals are concern-diagnostic,
 * never a merit gate). So `below_reference_band` is surfaced ONLY as a
 * non-gating informational annotation. The gate's real levers are evidence
 * INTEGRITY (Coverage) and FRESHNESS (Confidence / re-measurement), never the
 * concern magnitude.
 *
 * ── GAP-P1 (systematic re-measurement) ───────────────────────────────────────
 * A derived `due_for_remeasurement` marker flags a completed stage whose newest
 * evidence is older than `EVIDENCE_FRESHNESS_DAYS`. It is a READ-ONLY display
 * signal — there is no scheduler, no job, and it never changes lock/unlock.
 */

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
  | 'verified'              // completed + a real computed score exists
  | 'insufficient_evidence' // completed flag set but NO usable measured result
  | 'in_progress'           // session open, not yet completed
  | 'not_started'           // no session yet, but unlocked (available)
  | 'blocked';              // no session and the prior stage is not yet verified

export interface EvidenceCoverage {
  has_session: boolean;
  has_score: boolean;
  score: number | null;
}

export interface EvidenceConfidence {
  /** verified = trustworthy measured result; provisional = stale measured result; none = no usable result. */
  level: 'verified' | 'provisional' | 'none';
  age_days: number | null;
  fresh: boolean | null;
}

export interface EvidenceGate {
  verdict: EvidenceVerdict;
  reason: string;
  coverage: EvidenceCoverage;
  confidence: EvidenceConfidence;
  /** GAP-P1: completed stage whose evidence is older than the freshness window. */
  due_for_remeasurement: boolean;
  /** Non-gating informational axis (NEVER blocks — see file header). */
  informational: {
    below_reference_band: boolean;
    reference_band: string | null;
  };
}

/**
 * Freshness window for the re-measurement signal (GAP-P1). 180 days (~6 months)
 * is a conservative default: behavioural concern signals drift over months, so a
 * half-year-old measurement is flagged as "due for a re-check". This is a
 * read-only DISPLAY heuristic — it never gates advancement and there is no
 * scheduler. Overridable via the second arg to the pure evaluators for testing.
 */
export const EVIDENCE_FRESHNESS_DAYS = 180;

/**
 * Reference band for the informational `below_reference_band` annotation. The
 * CAPADEX score levels (see getScoreLevel in routes/capadex.ts) treat <40 as the
 * lowest ("Emerging") band. We mirror that single boundary purely to annotate,
 * NEVER to block.
 */
const REFERENCE_BAND_FLOOR = 40;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

/**
 * Pure evaluator for ONE stage's OWN evidence (completed / in_progress / absent).
 * Never throws. `now` and `freshnessDays` are injectable for deterministic tests.
 */
export function evaluateStageEvidence(
  entry: StageEvidenceEntry | undefined,
  freshnessDays: number = EVIDENCE_FRESHNESS_DAYS,
  now: Date = new Date(),
): EvidenceGate {
  const status = entry?.status;
  const score = entry?.score ?? null;
  const hasSession = status === 'completed' || status === 'in_progress';
  const hasScore = score != null && Number.isFinite(score);

  const ageDays =
    entry?.updatedAt instanceof Date && !Number.isNaN(entry.updatedAt.getTime())
      ? Math.max(0, daysBetween(now, entry.updatedAt))
      : null;

  const coverage: EvidenceCoverage = {
    has_session: hasSession,
    has_score: hasScore,
    score,
  };

  const informational = {
    below_reference_band: hasScore ? (score as number) < REFERENCE_BAND_FLOOR : false,
    reference_band: hasScore ? `floor:${REFERENCE_BAND_FLOOR}` : null,
  };

  if (status === 'completed') {
    if (hasScore) {
      const fresh = ageDays == null ? null : ageDays <= freshnessDays;
      const due = ageDays != null && ageDays > freshnessDays;
      return {
        verdict: 'verified',
        reason: due
          ? 'Completed with a measured result; evidence is older than the freshness window and is due for re-measurement.'
          : 'Completed with a measured result.',
        coverage,
        confidence: { level: due ? 'provisional' : 'verified', age_days: ageDays, fresh },
        due_for_remeasurement: due,
        informational,
      };
    }
    // Completed flag set but no usable measured result (degenerate / legacy row).
    return {
      verdict: 'insufficient_evidence',
      reason: 'Marked completed but no measured result is available; re-measurement needed before this counts as evidence.',
      coverage,
      confidence: { level: 'none', age_days: ageDays, fresh: ageDays == null ? null : false },
      due_for_remeasurement: true,
      informational,
    };
  }

  if (status === 'in_progress') {
    return {
      verdict: 'in_progress',
      reason: 'Assessment in progress — no completed evidence yet.',
      coverage,
      confidence: { level: 'none', age_days: ageDays, fresh: null },
      due_for_remeasurement: false,
      informational,
    };
  }

  // Absent — verdict (not_started vs blocked) is decided by the caller based on
  // whether the prior stage is verified. Default to not_started here.
  return {
    verdict: 'not_started',
    reason: 'No assessment recorded yet for this stage.',
    coverage,
    confidence: { level: 'none', age_days: null, fresh: null },
    due_for_remeasurement: false,
    informational,
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
 * stage carries an additive `gate` envelope and, when the prior stage's evidence
 * is not `verified`, an absent next stage is `blocked` instead of legacy
 * `available` (this is the GAP-P2 evidence gate). Existing `status` vocabulary is
 * preserved ('available' | 'locked' | 'completed' | 'in_progress') so legacy
 * consumers keep working; the nuance lives in `gate.verdict`.
 *
 * In practice every real completed session carries a computed score, so the
 * lock/unlock delta vs legacy is ~0 for real users — the gate's value is
 * integrity enforcement (no advancing on an evidence-less "completed" row) plus
 * the re-measurement signal, NOT gatekeeping learners out.
 *
 * Never throws; on any inconsistency it falls back to the legacy stage object.
 */
export function enrichProgressWithEvidence(
  legacy: LegacyProgressStage[],
  entriesByStage: Record<string, StageEvidenceEntry>,
  freshnessDays: number = EVIDENCE_FRESHNESS_DAYS,
  now: Date = new Date(),
): EvidenceGatedProgressStage[] {
  try {
    const stages = legacy.map((s) => ({ ...s }));
    const gates: EvidenceGate[] = stages.map((s) =>
      evaluateStageEvidence(entriesByStage[s.stage_code], freshnessDays, now),
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
          const priorGate = i > 0 ? gates[i - 1] : undefined;
          const reason =
            priorGate?.verdict === 'insufficient_evidence'
              ? 'Locked: the previous stage is marked complete but lacks a measured result; re-measure it to unlock this stage.'
              : 'Locked: complete the previous stage with a measured result to unlock this stage.';
          resolvedGate = { ...gate, verdict: 'blocked', reason };
        }
      }

      return { ...s, status, gate: resolvedGate };
    });
  } catch {
    // Honest degradation: never break progression on an enrichment fault.
    return legacy.map((s) => ({
      ...s,
      gate: {
        verdict: 'not_started',
        reason: 'Evidence gate unavailable; showing completion-only status.',
        coverage: { has_session: false, has_score: false, score: null },
        confidence: { level: 'none', age_days: null, fresh: null },
        due_for_remeasurement: false,
        informational: { below_reference_band: false, reference_band: null },
      },
    }));
  }
}
