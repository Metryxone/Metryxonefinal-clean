/**
 * CAPADEX WC-7B Tier A — Decision → Mentor Bridge (Deliverable 3).
 *
 * COMPOSE-ONLY + PURE + BACKEND-ONLY. Derives mentor-type recommendations from the
 * unified activation decision (the activated L2 outcome models + canonical stage +
 * the concern). It re-uses the documented domain → mentor_type mapping that the
 * marketplace matcher (`frontend/server/src/routes/mentor.ts`) already applies to LBI
 * weak-domains — but it NEVER calls across servers and NEVER books a mentor. It only
 * produces a read-only recommendation that the activation envelope carries.
 *
 * It NEVER fabricates a mentor when no signal supports one: an empty decision yields
 * `ready:false` with an honest reason. The caller is gated on
 * `isDecisionMentorBridgeEnabled()`.
 */
import type { DecisionContext } from './decision-orchestrator';

/** Canonical mentor types (mirror the marketplace `mentor_type` enum). */
export type MentorType =
  | 'subject_tutor'
  | 'performance_coach'
  | 'psychological_counsellor'
  | 'exam_strategist'
  | 'career_transition_coach';

export interface MentorActivation {
  ready: boolean;
  reason: string;
  recommended_types: MentorType[];
  match_reason: string | null;
  source: 'outcome_models' | 'concern_keyword' | null;
}

/** Activated L2 outcome model_key → mentor types it indicates. */
const OUTCOME_MENTOR_MAP: Record<string, MentorType[]> = {
  career_clarity: ['performance_coach'],
  decision_quality: ['performance_coach'],
  learning_effectiveness: ['subject_tutor'],
  employability_readiness: ['performance_coach', 'subject_tutor'],
  exam_readiness: ['exam_strategist', 'subject_tutor'],
  confidence_stability: ['psychological_counsellor', 'performance_coach'],
  // FRP outcome models
  ai_career_readiness: ['career_transition_coach', 'subject_tutor'],
  career_transition_readiness: ['career_transition_coach', 'performance_coach'],
  future_skills_readiness: ['career_transition_coach', 'subject_tutor'],
  entrepreneurship_readiness: ['career_transition_coach', 'performance_coach'],
};

/** Concern-text keyword → mentor types (fallback when no outcome model activated). */
const CONCERN_KEYWORD_MAP: Array<{ re: RegExp; types: MentorType[]; label: string }> = [
  { re: /\b(exam|jee|neet|board|entrance|upsc|gate|cat)\b/i, types: ['exam_strategist', 'subject_tutor'], label: 'exam pressure' },
  { re: /(stress|anxiet|emotion|fear|panic|overwhelm|depress|lonel)/i, types: ['psychological_counsellor'], label: 'emotional strain' },
  { re: /(focus|concentrat|distract|attention)/i, types: ['subject_tutor', 'performance_coach'], label: 'focus difficulty' },
  { re: /(motivat|procrastinat|discipline|lazy|inconsist)/i, types: ['performance_coach'], label: 'motivation gap' },
  { re: /(confidence|self.?esteem|self.?doubt|imposter)/i, types: ['psychological_counsellor', 'performance_coach'], label: 'confidence' },
  { re: /(career|future|direction|stream|college|course|placement|job)/i, types: ['performance_coach'], label: 'career direction' },
];

function dedupe<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of arr) {
    if (!seen.has(x)) { seen.add(x); out.push(x); }
  }
  return out;
}

/**
 * Pure derivation — never throws. Prefers the REAL activated outcome models; falls
 * back to a concern-keyword heuristic only when no model activated. Returns an honest
 * `ready:false` when nothing supports a mentor recommendation (never fabricated).
 */
export function deriveMentorActivation(ctx: DecisionContext): MentorActivation {
  try {
    const stageLabel = ctx.stage?.canonical_stage ?? 'unknown stage';
    const models = ctx.outcome && !ctx.outcome.unclassified ? ctx.outcome.models : [];

    if (models.length > 0) {
      // Order by outcome confidence so the strongest model leads the recommendation.
      const ordered = [...models].sort((a, b) => b.confidence - a.confidence);
      const types: MentorType[] = [];
      const labels: string[] = [];
      for (const m of ordered) {
        const mapped = OUTCOME_MENTOR_MAP[m.model_key];
        if (mapped && mapped.length > 0) {
          types.push(...mapped);
          labels.push(m.display_label);
        }
      }
      const recommended = dedupe(types);
      if (recommended.length > 0) {
        return {
          ready: true,
          reason: 'derived_from_outcome_models',
          recommended_types: recommended,
          match_reason:
            `Mentor types derived from the activated outcome ${labels.length > 1 ? 'models' : 'model'} ` +
            `${labels.join(', ')} at stage ${stageLabel}.`,
          source: 'outcome_models',
        };
      }
    }

    // Fallback: concern-text keyword heuristic (only when no model activated).
    const concern = String(ctx.concern_name ?? '');
    if (concern.trim()) {
      const types: MentorType[] = [];
      const labels: string[] = [];
      for (const entry of CONCERN_KEYWORD_MAP) {
        if (entry.re.test(concern)) {
          types.push(...entry.types);
          labels.push(entry.label);
        }
      }
      const recommended = dedupe(types);
      if (recommended.length > 0) {
        return {
          ready: true,
          reason: 'derived_from_concern_keyword',
          recommended_types: recommended,
          match_reason:
            `Mentor types derived from the concern signal (${labels.join(', ')}) at stage ${stageLabel}; ` +
            `no outcome model activated for this session.`,
          source: 'concern_keyword',
        };
      }
    }

    return {
      ready: false,
      reason: 'no_mentor_signal',
      recommended_types: [],
      match_reason: null,
      source: null,
    };
  } catch {
    return { ready: false, reason: 'mentor_bridge_error', recommended_types: [], match_reason: null, source: null };
  }
}
