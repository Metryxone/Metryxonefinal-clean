/**
 * Competency · Behavioural Evidence (T9)
 * ───────────────────────────────────────────────────────────────────────────
 * Additive, read-only, never-throws. Feeds CAPADEX behavioural-signal evidence
 * into the BEHAVIOURAL competency dimension (`dom_behavioral`) and the
 * Competency Intelligence Engine summary.
 *
 * HONESTY CONTRACT (do not weaken):
 *   - CAPADEX signals are concern-DIAGNOSTIC. They may LOWER or FLAG the
 *     behavioural dimension as risk; they may NEVER raise it as a strength.
 *   - The evidence score is capped at a NEUTRAL ceiling (≤ 50). It starts at
 *     the neutral base and is only ever dragged DOWN by observed risks, so it
 *     can never read as a strength.
 *   - No risk signals observed → score is `null` (unmeasured), never 0 and
 *     never a fabricated neutral.
 *   - Confidence is capped at `moderate`: single-session, self-report
 *     behavioural signals are diagnostic, not psychometrically validated.
 *   - Identity bridge is required: user → latest CAPADEX session via
 *     `capadex_behavioural_memory`. No linked session → unavailable (honest).
 */
import type { Pool } from 'pg';
import { buildBehaviorGraphForUser, type BehaviorGraphRisk } from './behavior-graph-service.js';

// Neutral ceiling — behavioural evidence can sit AT or BELOW this, never above.
const NEUTRAL_BASE = 50;

// Severity → deficit dragged off the neutral base (concern-diagnostic only).
const SEV_DEFICIT: Record<string, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
};

export interface BehaviouralRiskEvidence {
  risk_key: string;
  type: string;
  severity: string;
  description: string | null;
  deficit: number;
}

export interface BehaviouralEvidenceResult {
  available: boolean;
  session_id: string | null;
  domain: 'dom_behavioral';
  polarity: 'concern_diagnostic';
  /** ≤ 50; neutral/deficit only, NEVER a strength. null when no risk evidence. */
  evidence_score: number | null;
  neutral_ceiling: number;
  risk_signals: BehaviouralRiskEvidence[];
  coverage: {
    has_graph: boolean;
    risks_observed: number;
    signals_observed: number;
  };
  confidence: {
    band: 'moderate' | 'low' | 'unmeasured';
    basis: string;
    note: string;
  };
  note: string;
}

function unavailable(session_id: string | null, hasGraph: boolean, signalsObserved: number): BehaviouralEvidenceResult {
  return {
    available: false,
    session_id,
    domain: 'dom_behavioral',
    polarity: 'concern_diagnostic',
    evidence_score: null,
    neutral_ceiling: NEUTRAL_BASE,
    risk_signals: [],
    coverage: { has_graph: hasGraph, risks_observed: 0, signals_observed: signalsObserved },
    confidence: {
      band: 'unmeasured',
      basis: 'capadex_behavioural_signals',
      note: hasGraph
        ? 'A behavioural session is linked but carries no risk signals — behavioural evidence is unmeasured, not zero.'
        : 'No CAPADEX behavioural session linked to this user — behavioural evidence is unmeasured, not zero.',
    },
    note: 'CAPADEX behavioural signals are concern-diagnostic: they can lower or flag the behavioural dimension as risk, never raise it as a strength.',
  };
}

/**
 * Read-only: compute behavioural-signal evidence for the behavioural competency
 * dimension. Reuses the existing CAPADEX behaviour bridge (identity + graph) —
 * never rebuilds it. Never throws; degrades to `unavailable` on any gap.
 */
export async function computeBehaviouralEvidence(
  pool: Pool,
  userId: string,
): Promise<BehaviouralEvidenceResult> {
  let session_id: string | null = null;
  let risks: BehaviorGraphRisk[] = [];
  let signalsObserved = 0;
  let hasGraph = false;
  try {
    const { graph, session_id: sid } = await buildBehaviorGraphForUser(pool, userId);
    session_id = sid;
    if (graph) {
      hasGraph = true;
      risks = Array.isArray(graph.risks) ? graph.risks : [];
      signalsObserved = Array.isArray(graph.signals) ? graph.signals.length : 0;
    }
  } catch {
    return unavailable(null, false, 0);
  }

  if (!hasGraph || risks.length === 0) {
    return unavailable(session_id, hasGraph, signalsObserved);
  }

  const risk_signals: BehaviouralRiskEvidence[] = risks.map((r) => {
    const sev = String(r.severity ?? '').toLowerCase();
    return {
      risk_key: r.risk_key,
      type: r.type,
      severity: sev || 'unknown',
      description: r.description ?? null,
      deficit: SEV_DEFICIT[sev] ?? 0,
    };
  });

  // Drag the neutral base down by the summed deficit (clamped to [0, NEUTRAL_BASE]).
  const totalDeficit = Math.min(
    risk_signals.reduce((a, r) => a + r.deficit, 0),
    NEUTRAL_BASE,
  );
  const evidence_score = Math.max(0, NEUTRAL_BASE - totalDeficit);

  // Confidence is capped at `moderate` — diagnostic, never validated.
  const band: 'moderate' | 'low' = risk_signals.length >= 3 ? 'moderate' : 'low';

  return {
    available: true,
    session_id,
    domain: 'dom_behavioral',
    polarity: 'concern_diagnostic',
    evidence_score,
    neutral_ceiling: NEUTRAL_BASE,
    risk_signals: risk_signals.sort((a, b) => b.deficit - a.deficit),
    coverage: { has_graph: true, risks_observed: risk_signals.length, signals_observed: signalsObserved },
    confidence: {
      band,
      basis: 'capadex_behavioural_signals',
      note: 'Confidence reflects the count of concern-diagnostic risk signals from a single CAPADEX session — capped at moderate (not psychometrically validated).',
    },
    note: 'CAPADEX behavioural signals are concern-diagnostic: they lower or flag the behavioural dimension as risk and are capped at a neutral ceiling — they never raise it as a strength.',
  };
}
