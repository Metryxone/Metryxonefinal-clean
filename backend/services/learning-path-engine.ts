/**
 * MX-74X — Learning Path engine (additive, flag-gated, compose-only, read-only).
 *
 * THE SECOND MISSING LINK: Career Intelligence → Learning Path sequencing.
 *
 * The career-roadmap engine already sequences gap closure into milestones, and the
 * career-recommendation aggregator already produces developmental recommendations.
 * Neither is connected to the other. This layer COMPOSES them into a single ordered
 * learning sequence — gap → recommended action → milestone horizon — so a learner
 * sees WHAT to develop, IN WHAT ORDER, and WHICH recommendation backs each step.
 *
 *   roadmap milestones (career-roadmap) — the ordered gap-closure plan
 *     + development_action per gap        — deterministic target (never a fake course)
 *     + matching recommendations          — career-recommendation items, joined by target
 *   = sequenced learning steps with a disclosed time horizon.
 *
 * Honesty contract:
 *   - No measurable roadmap → measurable:false, empty sequence, honest note.
 *   - Every step is a REAL gap from the roadmap; recommendations are JOINED, never
 *     invented. A step with no matching recommendation says so (rec_backed:false).
 *   - estimated_weeks is carried verbatim from the roadmap's disclosed heuristic.
 *   - Coverage (steps that are recommendation-backed) and Confidence (roadmap
 *     measurability + backing density) are reported as SEPARATE axes.
 *   - Reaches NO DDL — composes engines that self-gate their own schema.
 */

import type { Pool } from 'pg';
import {
  buildCareerRoadmap,
  CAREER_ROADMAP_VERSION,
  type RoadmapCompetency,
} from './career-roadmap-engine.js';
import {
  buildCareerRecommendations,
  CAREER_RECOMMENDATION_VERSION,
  type RecommendationItem,
} from './career-recommendation-aggregator.js';

export const LEARNING_PATH_VERSION = '74x.1.0';

const LANGUAGE_POLICY = {
  allowed: ['learning step', 'development target', 'recommended focus', 'sequence', 'horizon'],
  disallowed: ['guaranteed outcome', 'certification guarantee', 'job placement', 'you will master'],
} as const;

export interface LearningStep {
  sequence: number;
  competency_id: string;
  competency_name: string | null;
  type_label: string;
  /** Carried verbatim from the roadmap milestone band (Immediate / Near-Term / Longer-Term). */
  horizon: string;
  priority_band: string;
  gap: number;
  blocking: boolean;
  /** Deterministic development target from the roadmap — never a fabricated course. */
  development_action: string;
  estimated_weeks: number;
  /** Whether a real career-recommendation backs this step. */
  rec_backed: boolean;
  /** The joined recommendation(s) — empty when none match (honest). */
  recommendations: {
    rec_type: string;
    title: string;
    action: string;
    priority: string;
    personalized: boolean;
    confidence_band: string;
  }[];
}

export interface CoverageConfidence {
  coverage: { measurable: boolean; coverage_pct: number | null; detail: string };
  confidence: { band: 'high' | 'moderate' | 'low' | 'none'; basis: string; caps: string[] };
}

export interface LearningPathEnvelope {
  ok: boolean;
  subject_id: string;
  version: string;
  generated_at: string;
  measurable: boolean;
  target_role: { role_id: string | null; role_title: string | null; source: string };
  /** Ordered learning steps (priority-ranked gap closure with joined recommendations). */
  steps: LearningStep[];
  /** Recommendations that did NOT map to a current gap step — surfaced, never dropped. */
  unmapped_recommendations: {
    rec_type: string;
    target: string;
    title: string;
    personalized: boolean;
  }[];
  timeline: {
    total_estimated_weeks: number | null;
    total_estimated_months: number | null;
    basis: string;
    disclaimer: string;
  };
  summary: {
    total_steps: number;
    rec_backed_steps: number;
    blocking_steps: number;
    immediate_steps: number;
    unmapped_recommendations: number;
  };
  axes: CoverageConfidence;
  language_policy: typeof LANGUAGE_POLICY;
  source_versions: Record<string, string>;
  notes: string[];
}

/** Normalise a free-text label/title for fuzzy join between a gap and a recommendation. */
function norm(s: string | null | undefined): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** A recommendation backs a step if its target/title shares the competency name or
 *  its development action token — a join over EXISTING strings, never fabricated. */
function recMatchesCompetency(rec: RecommendationItem, comp: RoadmapCompetency): boolean {
  const name = norm(comp.competency_name);
  if (!name) return false;
  const target = norm(rec.target);
  const title = norm(rec.title);
  const action = norm(rec.action);
  return (
    target.includes(name) ||
    name.includes(target) ||
    title.includes(name) ||
    action.includes(name)
  );
}

function emptyEnvelope(
  sid: string,
  target: LearningPathEnvelope['target_role'],
  notes: string[],
): LearningPathEnvelope {
  return {
    ok: true,
    subject_id: sid,
    version: LEARNING_PATH_VERSION,
    generated_at: new Date().toISOString(),
    measurable: false,
    target_role: target,
    steps: [],
    unmapped_recommendations: [],
    timeline: {
      total_estimated_weeks: null,
      total_estimated_months: null,
      basis: 'composed from career-roadmap (no measurable plan)',
      disclaimer: 'Developmental estimate only — not a guarantee of outcome or timing.',
    },
    summary: {
      total_steps: 0,
      rec_backed_steps: 0,
      blocking_steps: 0,
      immediate_steps: 0,
      unmapped_recommendations: 0,
    },
    axes: {
      coverage: { measurable: false, coverage_pct: null, detail: 'No measurable roadmap to sequence.' },
      confidence: { band: 'none', basis: 'no measurable roadmap', caps: ['no_roadmap'] },
    },
    language_policy: LANGUAGE_POLICY,
    source_versions: {
      learning_path: LEARNING_PATH_VERSION,
      career_roadmap: CAREER_ROADMAP_VERSION,
      career_recommendation: CAREER_RECOMMENDATION_VERSION,
    },
    notes,
  };
}

/**
 * Compose an ordered learning path for `subjectId`. Never throws — composition
 * failures degrade to honest empties.
 */
export async function buildLearningPath(pool: Pool, subjectId: string): Promise<LearningPathEnvelope> {
  const sid = String(subjectId ?? '').trim();
  const notes: string[] = [];

  // ---- Compose the roadmap (which itself composes the gap engine) -----------
  const roadmap = await buildCareerRoadmap(pool, sid).catch((e) => {
    notes.push(`Career roadmap composition unavailable: ${e?.message ?? 'error'} (honest empty).`);
    return null;
  });

  const target: LearningPathEnvelope['target_role'] = roadmap?.target_role ?? {
    role_id: null,
    role_title: null,
    source: 'none',
  };

  if (!roadmap || !roadmap.measurable || (roadmap.development_plan?.length ?? 0) === 0) {
    notes.push('No measurable roadmap (no target role or no gaps) — learning path is honestly empty.');
    return emptyEnvelope(sid, target, notes);
  }

  // ---- Compose recommendations (never recompute) ----------------------------
  const recs = await buildCareerRecommendations(pool, sid).catch((e) => {
    notes.push(`Career recommendation composition unavailable: ${e?.message ?? 'error'}.`);
    return null;
  });
  const allRecs: RecommendationItem[] = [];
  for (const g of recs?.groups ?? []) {
    for (const it of g.items ?? []) allRecs.push(it);
  }

  // Map roadmap milestone band per competency (for the horizon label).
  const bandToHorizon = new Map<string, string>();
  for (const m of roadmap.milestones ?? []) {
    for (const c of m.competencies_required ?? []) {
      bandToHorizon.set(c.competency_id, m.horizon);
    }
  }

  // ---- Sequence: roadmap development_plan is already priority-ordered -------
  const usedRecKeys = new Set<string>();
  const steps: LearningStep[] = (roadmap.development_plan ?? []).map((comp, idx) => {
    const matched = allRecs.filter((r) => recMatchesCompetency(r, comp));
    for (const r of matched) usedRecKeys.add(r.rec_key);
    return {
      sequence: idx + 1,
      competency_id: comp.competency_id,
      competency_name: comp.competency_name,
      type_label: comp.type_label,
      horizon: bandToHorizon.get(comp.competency_id) ?? comp.priority_band,
      priority_band: comp.priority_band,
      gap: comp.gap,
      blocking: comp.blocking,
      development_action: comp.development_action,
      estimated_weeks: comp.estimated_weeks,
      rec_backed: matched.length > 0,
      recommendations: matched.map((r) => ({
        rec_type: r.rec_type,
        title: r.title,
        action: r.action,
        priority: r.priority,
        personalized: r.personalized,
        confidence_band: r.confidence_band,
      })),
    };
  });

  // ---- Recommendations that mapped to no gap step (surfaced, never dropped) -
  const unmapped_recommendations = allRecs
    .filter((r) => !usedRecKeys.has(r.rec_key))
    .map((r) => ({
      rec_type: r.rec_type,
      target: r.target,
      title: r.title,
      personalized: r.personalized,
    }));

  // ---- Coverage & Confidence (SEPARATE axes) --------------------------------
  const recBacked = steps.filter((s) => s.rec_backed).length;
  const coveragePct = steps.length > 0 ? Math.round((recBacked / steps.length) * 100) : null;
  let confidenceBand: CoverageConfidence['confidence']['band'] = 'none';
  const caps: string[] = [];
  if (steps.length === 0) {
    confidenceBand = 'none';
  } else if (recBacked >= steps.length * 0.6) {
    confidenceBand = 'high';
  } else if (recBacked >= 1) {
    confidenceBand = 'moderate';
  } else {
    confidenceBand = 'low';
    caps.push('no_recommendation_backing');
  }
  if (!roadmap.timeline?.measurable) caps.push('timeline_unmeasured');

  return {
    ok: true,
    subject_id: sid,
    version: LEARNING_PATH_VERSION,
    generated_at: new Date().toISOString(),
    measurable: steps.length > 0,
    target_role: target,
    steps,
    unmapped_recommendations,
    timeline: {
      total_estimated_weeks: roadmap.timeline?.total_estimated_weeks ?? null,
      total_estimated_months: roadmap.timeline?.total_estimated_months ?? null,
      basis: roadmap.timeline?.basis ?? 'composed from career-roadmap',
      disclaimer:
        roadmap.timeline?.disclaimer ??
        'Developmental estimate only — not a guarantee of outcome or timing.',
    },
    summary: {
      total_steps: steps.length,
      rec_backed_steps: recBacked,
      blocking_steps: steps.filter((s) => s.blocking).length,
      immediate_steps: steps.filter((s) => /immediate/i.test(s.horizon)).length,
      unmapped_recommendations: unmapped_recommendations.length,
    },
    axes: {
      coverage: {
        measurable: steps.length > 0,
        coverage_pct: coveragePct,
        detail: `${recBacked} of ${steps.length} learning steps are recommendation-backed.`,
      },
      confidence: {
        band: confidenceBand,
        basis: 'roadmap measurability + recommendation-join density',
        caps,
      },
    },
    language_policy: LANGUAGE_POLICY,
    source_versions: {
      learning_path: LEARNING_PATH_VERSION,
      career_roadmap: CAREER_ROADMAP_VERSION,
      career_recommendation: CAREER_RECOMMENDATION_VERSION,
    },
    notes,
  };
}
