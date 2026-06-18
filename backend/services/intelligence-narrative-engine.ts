/**
 * Intelligence Narrative Engine — Phase 5 (additive, shadow-mode).
 *
 * Generates short developmental narratives from already-computed adaptive
 * intelligence outputs. Pure-function core; persists to
 * `intelligence_narratives` (append-only).
 *
 * Language policy: developmental signals only. No hiring, promotion,
 * pass/fail, or suitability language.
 */
import type { Pool } from 'pg';
import type { FusedCompetency } from './competency-fusion-engine';

export const INTELLIGENCE_NARRATIVE_VERSION = '5.0.0';

export const NARRATIVE_KINDS = [
  'strength_signals',
  'growth_signals',
  'confidence_gaps',
  'benchmark_deviations',
  'cognitive_summary',
  'behavioral_summary',
  'market_alignment',
  'predictive_trajectory',
  'learning_velocity',
] as const;
export type NarrativeKind = (typeof NARRATIVE_KINDS)[number];

export const LANGUAGE_POLICY = {
  allowed: [
    'developmental signal', 'observed pattern', 'evidence-based',
    'growth opportunity', 'confidence gap', 'benchmark deviation',
    'trajectory', 'learning velocity', 'cognitive pattern',
  ],
  disallowed: [
    'hiring recommendation', 'promotion verdict', 'pass/fail',
    'suitability score', 'IQ ranking', 'mastery certification',
    'rejected', 'unfit', 'ineligible',
  ],
};

export type NarrativeInputs = {
  fused?: FusedCompetency[];
  benchmarkDeviations?: Array<{ competencyId: string; userScore: number; cohortMedian: number; delta: number }>;
  cognitiveProfile?: { signals?: Record<string, number>; confidence?: number };
  behavioralRecent?: Array<{ type: string; severity: string }>;
  marketDemand?: Array<{ competencyId: string; demandScore: number }>;
  trajectory?: Array<{ competencyId: string; delta: number }>;
  learningVelocity?: { trajectory_samples?: number; recent_growth?: number };
};

export type GeneratedNarrative = {
  kind: NarrativeKind;
  headline: string;
  body: string;
  evidenceRefs: unknown[];
};

function top<T>(arr: T[], n: number, cmp: (a: T, b: T) => number): T[] {
  return [...arr].sort(cmp).slice(0, n);
}

function pct(n: number): string {
  return `${Math.round(n)}`;
}

export function generateNarratives(inputs: NarrativeInputs): GeneratedNarrative[] {
  const out: GeneratedNarrative[] = [];

  const fused = inputs.fused ?? [];
  if (fused.length > 0) {
    const strengths = top(fused, 3, (a, b) => b.score - a.score).filter((f) => f.score >= 60);
    if (strengths.length > 0) {
      out.push({
        kind: 'strength_signals',
        headline: 'Observed strength signals',
        body: strengths
          .map((s) => `${s.competency}: fused score ${pct(s.score)} across ${s.sourceCoverage.length} sources (confidence ${(s.confidence * 100).toFixed(0)}%).`)
          .join(' '),
        evidenceRefs: strengths.map((s) => ({ competencyId: s.competency, score: s.score })),
      });
    }
    const growth = top(fused, 3, (a, b) => a.score - b.score).filter((f) => f.score < 60);
    if (growth.length > 0) {
      out.push({
        kind: 'growth_signals',
        headline: 'Growth opportunity signals',
        body: growth
          .map((g) => `${g.competency}: fused score ${pct(g.score)} — additional evidence would refine this developmental signal.`)
          .join(' '),
        evidenceRefs: growth.map((g) => ({ competencyId: g.competency, score: g.score })),
      });
    }
    const lowConf = top(fused, 3, (a, b) => a.confidence - b.confidence).filter((f) => f.confidence < 0.5);
    if (lowConf.length > 0) {
      out.push({
        kind: 'confidence_gaps',
        headline: 'Confidence gaps to address',
        body: lowConf
          .map((c) => `${c.competency}: confidence ${(c.confidence * 100).toFixed(0)}% (${c.sourceCoverage.length} source${c.sourceCoverage.length === 1 ? '' : 's'}); more diverse evidence would calibrate this further.`)
          .join(' '),
        evidenceRefs: lowConf.map((c) => ({ competencyId: c.competency, confidence: c.confidence })),
      });
    }
  }

  const devs = inputs.benchmarkDeviations ?? [];
  if (devs.length > 0) {
    const top3 = top(devs, 3, (a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    out.push({
      kind: 'benchmark_deviations',
      headline: 'Notable benchmark deviations',
      body: top3
        .map((d) => `${d.competencyId}: ${d.delta > 0 ? '+' : ''}${d.delta.toFixed(1)} vs cohort median ${d.cohortMedian.toFixed(1)} (developmental signal — not a ranking).`)
        .join(' '),
      evidenceRefs: top3,
    });
  }

  if (inputs.cognitiveProfile?.signals) {
    const sigs = Object.entries(inputs.cognitiveProfile.signals)
      .filter(([, v]) => Number.isFinite(v))
      .sort((a, b) => (b[1] as number) - (a[1] as number));
    if (sigs.length > 0) {
      const top3 = sigs.slice(0, 3);
      out.push({
        kind: 'cognitive_summary',
        headline: 'Cognitive pattern summary',
        body: `Strongest cognitive signals observed so far: ${top3.map(([k, v]) => `${k} (${pct(v as number)})`).join(', ')}. Sample size: ${inputs.cognitiveProfile.confidence != null ? `confidence ${(inputs.cognitiveProfile.confidence * 100).toFixed(0)}%` : 'limited — more responses will refine this'}.`,
        evidenceRefs: top3.map(([k, v]) => ({ signal: k, value: v })),
      });
    }
  }

  const beh = inputs.behavioralRecent ?? [];
  if (beh.length > 0) {
    const high = beh.filter((b) => b.severity === 'high');
    out.push({
      kind: 'behavioral_summary',
      headline: 'Recent behavioral observations',
      body: `${beh.length} contradiction signal${beh.length === 1 ? '' : 's'} observed; ${high.length} flagged as high severity. These are reflective prompts, not judgements.`,
      evidenceRefs: beh.slice(0, 10),
    });
  }

  const mkt = inputs.marketDemand ?? [];
  if (mkt.length > 0) {
    const top3 = top(mkt, 3, (a, b) => b.demandScore - a.demandScore);
    out.push({
      kind: 'market_alignment',
      headline: 'Market demand alignment',
      body: top3.map((m) => `${m.competencyId}: market demand index ${m.demandScore.toFixed(1)}.`).join(' '),
      evidenceRefs: top3,
    });
  }

  const traj = inputs.trajectory ?? [];
  if (traj.length > 0) {
    const movers = top(traj, 3, (a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    out.push({
      kind: 'predictive_trajectory',
      headline: 'Trajectory movement',
      body: movers.map((t) => `${t.competencyId}: ${t.delta > 0 ? '+' : ''}${t.delta.toFixed(1)} over recent observation window.`).join(' '),
      evidenceRefs: movers,
    });
  }

  if (inputs.learningVelocity) {
    const lv = inputs.learningVelocity;
    out.push({
      kind: 'learning_velocity',
      headline: 'Learning velocity',
      body: `${lv.trajectory_samples ?? 0} trajectory observations on record; recent growth signal: ${(lv.recent_growth ?? 0).toFixed(2)}.`,
      evidenceRefs: [lv],
    });
  }

  return out;
}

export async function persistNarratives(
  pool: Pool,
  args: { userId: string; narratives: GeneratedNarrative[] },
): Promise<void> {
  for (const n of args.narratives) {
    try {
      await pool.query(
        `INSERT INTO intelligence_narratives
           (user_id, narrative_kind, headline, body, evidence_refs, language_policy, engine_version)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
        [
          args.userId, n.kind, n.headline, n.body,
          JSON.stringify(n.evidenceRefs ?? []),
          JSON.stringify(LANGUAGE_POLICY),
          INTELLIGENCE_NARRATIVE_VERSION,
        ],
      );
    } catch (err) {
      console.warn('[intelligence-narrative] persist failed:', (err as Error).message);
    }
  }
}

export async function recentNarratives(
  pool: Pool,
  userId: string,
  opts: { kind?: NarrativeKind; limit?: number } = {},
) {
  const limit = Math.max(1, Math.min(200, opts.limit ?? 50));
  try {
    if (opts.kind) {
      const r = await pool.query(
        `SELECT id, narrative_kind, headline, body, evidence_refs, generated_at
           FROM intelligence_narratives
          WHERE user_id = $1 AND narrative_kind = $2
          ORDER BY generated_at DESC LIMIT $3`,
        [userId, opts.kind, limit],
      );
      return r.rows;
    }
    const r = await pool.query(
      `SELECT id, narrative_kind, headline, body, evidence_refs, generated_at
         FROM intelligence_narratives
        WHERE user_id = $1
        ORDER BY generated_at DESC LIMIT $2`,
      [userId, limit],
    );
    return r.rows;
  } catch {
    return [];
  }
}
