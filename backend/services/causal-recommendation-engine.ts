/**
 * Phase 4 — Causal Recommendation Engine.
 *
 * Composes intervention-learning + transfer graph + dependency sequencer to
 * emit causally-ranked recommendations. Self-improving: as new outcomes land
 * in learn_outcomes the ROI/effectiveness shifts and so does ranking.
 *
 * Adaptive guidance signals (consumed if present):
 *   - velocity / momentum from Phase 4 longitudinal
 *   - market shifts via target_role_id changes
 *   - intervention completion via learn_intervention_events
 *   - recruiter engagement (via context payload)
 *
 * Language policy: developmental readiness · capability proximity ·
 * expected lift (with confidence band). NEVER asserts hiring outcomes.
 */

import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { getEffectiveness, INTERVENTION_LEARNING_VERSION, ConfidenceTier } from './intervention-learning-engine.js';
import { loadGraph, cascadeFrom, TRANSFER_GRAPH_VERSION, CascadeNode } from './competency-transfer-graph.js';
import { loadDependencies, sequenceCompetencies, DEPENDENCY_SEQUENCER_VERSION,
         scoreToLevel } from './dependency-sequencer.js';

export const CAUSAL_RECOMMENDATION_VERSION = '4.0.0';

export interface CausalRecommendation {
  id: string;
  rank: number;
  intervention_id: string;
  intervention_title: string;
  intervention_kind: string;
  competency_id: string | null;
  competency_name: string | null;
  sequence_position: number | null;
  is_ready_now: boolean;
  blocking_prereqs: string[];
  causal_score: number;
  expected_ei_lift: number;
  expected_ei_lift_lower: number;
  expected_ei_lift_upper: number;
  effort_hours: number;
  roi_score: number;
  confidence_tier: ConfidenceTier;
  transfer_cascade: CascadeNode[];
  rationale: {
    base_effectiveness: string;
    sequencing: string;
    cascade: string;
    momentum?: string;
  };
}

export interface CausalRankingInputs {
  user_id: string;
  target_role_id?: string | null;
  user_scores?: Record<string, number>;
  candidate_competency_ids?: string[];
  velocity?: Record<string, 'accelerating' | 'stabilizing' | 'flat' | 'declining' | 'recovering' | string>;
  profile_segment?: string;
  limit?: number;
}

const velocityMultiplier = (v?: string): number => {
  switch (v) {
    case 'accelerating': return 1.30;
    case 'recovering':   return 1.20;
    case 'stabilizing':  return 1.05;
    case 'flat':         return 1.00;
    case 'declining':    return 1.40;     // urgency boost — needs developmental support
    default:             return 1.00;
  }
};
const confidenceMultiplier = (t: ConfidenceTier): number => {
  switch (t) {
    case 'A': return 1.00;
    case 'B': return 0.92;
    case 'C': return 0.78;
    case 'D': return 0.55;
    default:  return 0.40;
  }
};

interface InterventionMeta {
  id: string; kind: string; title: string;
  target_competency_id: string | null;
  effort_hours: number | null;
}

export async function generateCausalRecommendations(
  pool: Pool, inputs: CausalRankingInputs,
): Promise<{
  recommendations: CausalRecommendation[];
  sequence_warnings: string[];
  versions: Record<string, string>;
  inputs_used: { candidate_competency_ids: string[]; profile_segment: string };
}> {
  const segment = inputs.profile_segment ?? 'global';
  const limit = Math.min(Math.max(inputs.limit ?? 8, 1), 30);

  // 1. Resolve candidate competencies: explicit list OR top developmental gaps for target role
  const candidateIds = (inputs.candidate_competency_ids?.length
    ? inputs.candidate_competency_ids
    : await resolveCandidatesFromRoleGaps(pool, inputs.target_role_id, inputs.user_scores ?? {}))
    .filter(Boolean);

  if (!candidateIds.length) {
    return { recommendations: [], sequence_warnings: ['no_candidate_competencies_resolved'],
             versions: versionStamp(), inputs_used: { candidate_competency_ids: [], profile_segment: segment } };
  }

  // 2. Sequence them via dependency engine
  const userLevels: Record<string, number> = {};
  for (const [c, s] of Object.entries(inputs.user_scores ?? {})) userLevels[c] = scoreToLevel(s);
  const depEdges = await loadDependencies(pool, candidateIds);
  const seqResult = sequenceCompetencies(candidateIds, depEdges, userLevels);

  // 3. Load interventions for these competencies + effectiveness rows
  const interventions = await loadInterventionsForCompetencies(pool, candidateIds);
  const effRows = await getEffectiveness(pool, { profile_segment: segment });
  const effIdx = new Map<string, ReturnType<typeof keyEff>>();
  for (const r of effRows) effIdx.set(keyEff(r.intervention_id, r.competency_id), r);

  // 4. Transfer graph for cascades
  const graph = await loadGraph(pool);

  // 5. Score each (competency, intervention) candidate
  const recsRaw: CausalRecommendation[] = [];
  for (const seqItem of seqResult.ordered) {
    const compInts = interventions.filter(i => i.target_competency_id === seqItem.competency_id);
    for (const meta of compInts) {
      const eff = effIdx.get(keyEff(meta.id, seqItem.competency_id)) ??
                  effIdx.get(keyEff(meta.id, null));
      const baseDelta = eff?.mean_ei_delta ?? 3.0;     // prior: a modest 3-pt EI lift
      const effortHours = eff?.mean_effort_hours ?? meta.effort_hours ?? 8.0;
      const roi = eff?.roi_score ?? (baseDelta / Math.max(effortHours, 0.5));
      const tier = (eff?.confidence_tier ?? 'provisional') as ConfidenceTier;
      const n = eff?.n_observations ?? 0;

      // Velocity boost for the targeted competency
      const v = inputs.velocity?.[seqItem.competency_id];
      const vMult = velocityMultiplier(v);
      const cMult = confidenceMultiplier(tier);

      // Sequence penalty: items not ready now are slightly down-weighted
      const readinessMult = seqItem.is_ready_now ? 1.0 : 0.75;

      // Cascade bonus: extra credit for unlocking downstream competencies
      const cascade = cascadeFrom(graph, seqItem.competency_id, { maxDepth: 2, minStrength: 0.25 });
      const cascadeBonus = 1 + Math.min(0.30, cascade.reduce((a, c) => a + c.propagated_strength, 0) * 0.10);

      const causalScore = roi * vMult * cMult * readinessMult * cascadeBonus;

      // CI band on expected EI lift — widens with low confidence + low n
      const halfWidth = baseDelta * (1.96 / Math.max(Math.sqrt(Math.max(n, 1)), 1)) * (1 - 0.5 * cMult);

      recsRaw.push({
        id: `crec_${randomUUID().slice(0, 12)}`,
        rank: 0,
        intervention_id: meta.id,
        intervention_title: meta.title,
        intervention_kind: meta.kind,
        competency_id: seqItem.competency_id,
        competency_name: null,                       // hydrated below
        sequence_position: seqItem.position,
        is_ready_now: seqItem.is_ready_now,
        // Cap to bound JSON row size for deep dependency trees
        blocking_prereqs: seqItem.blocking_prereqs.slice(0, 8),
        causal_score: round4(causalScore),
        expected_ei_lift: round3(baseDelta),
        expected_ei_lift_lower: round3(Math.max(0, baseDelta - halfWidth)),
        expected_ei_lift_upper: round3(baseDelta + halfWidth),
        effort_hours: round2(effortHours),
        roi_score: round4(roi),
        confidence_tier: tier,
        transfer_cascade: cascade.slice(0, 5),
        rationale: {
          base_effectiveness: eff
            ? `Mean +${round2(baseDelta)} EI pts across ${n} observations (tier ${tier}).`
            : `No observed outcomes yet — using prior estimate. Confidence will improve with data.`,
          sequencing: seqItem.is_ready_now
            ? `Ready to start now (position ${seqItem.position} in your sequence).`
            : `Sequenced at position ${seqItem.position}; depends on ${seqItem.blocking_prereqs.join(', ')}.`,
          cascade: cascade.length
            ? `Growth here can cascade into ${cascade.length} downstream capability area${cascade.length > 1 ? 's' : ''}.`
            : `No downstream cascade detected at strength ≥0.25.`,
          momentum: v ? `Your trajectory on this capability is "${v}" — adjusting urgency.` : undefined,
        },
      });
    }
  }

  // Hydrate competency names
  const allCompIds = Array.from(new Set(recsRaw.map(r => r.competency_id).filter(Boolean) as string[]));
  if (allCompIds.length) {
    const { rows } = await pool.query<{ id: string; canonical_name: string }>(
      `SELECT id, canonical_name FROM onto_competencies WHERE id = ANY($1::text[])`,
      [allCompIds]);
    const nameMap = new Map(rows.map(r => [r.id, r.canonical_name]));
    for (const r of recsRaw) if (r.competency_id) r.competency_name = nameMap.get(r.competency_id) ?? r.competency_id;
  }

  // 6. Final ranking and trimming
  recsRaw.sort((a, b) => b.causal_score - a.causal_score);
  const final = recsRaw.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));

  return {
    recommendations: final,
    sequence_warnings: seqResult.warnings,
    versions: versionStamp(),
    inputs_used: { candidate_competency_ids: candidateIds, profile_segment: segment },
  };
}

/** Persist a recommendation batch atomically — returns the batch id list. */
export async function persistRecommendations(
  pool: Pool, userId: string, targetRoleId: string | null, recs: CausalRecommendation[],
): Promise<{ persisted: number }> {
  if (!recs.length) return { persisted: 0 };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Prune prior batch for this (user, target_role) so the table reflects the
    // current causal ranking and never bloats across repeated calls.
    await client.query(
      `DELETE FROM learn_recommendations
        WHERE user_id = $1 AND COALESCE(target_role_id, '_none') = COALESCE($2, '_none')`,
      [userId, targetRoleId]);
    for (const r of recs) {
      await client.query(
        `INSERT INTO learn_recommendations
           (id, user_id, target_role_id, intervention_id, competency_id, rank,
            causal_score, expected_ei_lift, expected_ei_lift_lower, expected_ei_lift_upper,
            effort_hours, roi_score, confidence_tier, sequence_position, rationale, transfer_cascade)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (id) DO NOTHING`,
        [r.id, userId, targetRoleId, r.intervention_id, r.competency_id, r.rank,
         r.causal_score, r.expected_ei_lift, r.expected_ei_lift_lower, r.expected_ei_lift_upper,
         r.effort_hours, r.roi_score, r.confidence_tier, r.sequence_position,
         JSON.stringify(r.rationale), JSON.stringify(r.transfer_cascade)],
      );
    }
    await client.query('COMMIT');
    return { persisted: recs.length };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

async function resolveCandidatesFromRoleGaps(
  pool: Pool, roleId: string | null | undefined, userScores: Record<string, number>,
): Promise<string[]> {
  if (!roleId) {
    // Fall back to top user competencies (or all competencies, capped)
    if (Object.keys(userScores).length) {
      return Object.entries(userScores).sort((a, b) => a[1] - b[1]).slice(0, 8).map(([k]) => k);
    }
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM onto_competencies ORDER BY id LIMIT 8`);
    return rows.map(r => r.id);
  }
  const { rows } = await pool.query<{ id: string; expected_level: number; weight: number }>(`
    SELECT c.id, w.expected_level, w.weight::float AS weight
      FROM onto_role_weights w
      JOIN onto_dna_profiles p ON p.id = w.dna_profile_id AND p.is_current
      JOIN onto_competencies c ON c.id = w.competency_id
     WHERE p.role_id = $1
     ORDER BY w.weight DESC
     LIMIT 12
  `, [roleId]);
  const LEVEL_ANCHORS = [0, 30, 50, 65, 80, 92];
  return rows
    .map(r => ({ id: r.id, gap: (LEVEL_ANCHORS[r.expected_level] ?? 65) - (userScores[r.id] ?? 0), weight: r.weight }))
    .sort((a, b) => (b.gap * b.weight) - (a.gap * a.weight))
    .slice(0, 8)
    .map(r => r.id);
}

async function loadInterventionsForCompetencies(
  pool: Pool, ids: string[],
): Promise<InterventionMeta[]> {
  if (!ids.length) return [];
  const { rows } = await pool.query<InterventionMeta>(`
    SELECT id, kind, title, target_competency_id, effort_hours::float AS effort_hours
      FROM learn_interventions
     WHERE active = TRUE
       AND (target_competency_id = ANY($1::text[]) OR target_competency_id IS NULL)
  `, [ids]);
  return rows;
}

const keyEff = (i: string, c: string | null) => `${i}::${c ?? '_any'}`;
const round2 = (x: number) => Math.round(x * 100) / 100;
const round3 = (x: number) => Math.round(x * 1000) / 1000;
const round4 = (x: number) => Math.round(x * 10000) / 10000;

const versionStamp = () => ({
  causal: CAUSAL_RECOMMENDATION_VERSION,
  learning: INTERVENTION_LEARNING_VERSION,
  transfer: TRANSFER_GRAPH_VERSION,
  sequencer: DEPENDENCY_SEQUENCER_VERSION,
});

// ── Adaptive guidance evolution snapshot ───────────────────────────────────

export interface AdaptiveGuidanceSnapshot {
  user_id: string;
  generated_at: string;
  completion_signal: { recommended: number; completed: number; rate: number };
  momentum_signal: Record<string, string>;          // competency -> velocity tag
  intervention_winners: Array<{ intervention_id: string; roi_score: number; n: number; tier: ConfidenceTier }>;
  market_drift?: { target_role_id: string | null; weight_shift_signal: number };
  next_actions: CausalRecommendation[];
  language_note: string;
}

export async function buildAdaptiveGuidance(
  pool: Pool, args: { user_id: string; target_role_id?: string | null;
                      user_scores?: Record<string, number>; velocity?: Record<string, string>;
                      limit?: number },
): Promise<AdaptiveGuidanceSnapshot> {
  // Completion signal
  const { rows: cs } = await pool.query<{ event_type: string; n: string }>(`
    SELECT event_type, COUNT(*)::text AS n
      FROM learn_intervention_events
     WHERE user_id = $1
     GROUP BY event_type
  `, [args.user_id]);
  const recommended = parseInt(cs.find(r => r.event_type === 'recommended')?.n ?? '0', 10);
  const completed   = parseInt(cs.find(r => r.event_type === 'completed')?.n ?? '0', 10);

  // Top global winners
  const winners = await getEffectiveness(pool, { profile_segment: 'global' });

  // Next causal actions
  const rec = await generateCausalRecommendations(pool, {
    user_id: args.user_id, target_role_id: args.target_role_id ?? null,
    user_scores: args.user_scores ?? {}, velocity: args.velocity, limit: args.limit ?? 5,
  });

  return {
    user_id: args.user_id,
    generated_at: new Date().toISOString(),
    completion_signal: {
      recommended, completed,
      rate: recommended > 0 ? Math.round((completed / recommended) * 10000) / 10000 : 0,
    },
    momentum_signal: args.velocity ?? {},
    intervention_winners: winners.slice(0, 5).map(w => ({
      intervention_id: w.intervention_id, roi_score: w.roi_score,
      n: w.n_observations, tier: w.confidence_tier,
    })),
    market_drift: { target_role_id: args.target_role_id ?? null, weight_shift_signal: 0 },
    next_actions: rec.recommendations,
    language_note: 'Developmental guidance only — no hiring or promotion predictions.',
  };
}
