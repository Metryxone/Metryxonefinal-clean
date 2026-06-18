/**
 * Unified Action Engine — Career OS orchestration (Phase 4).
 *
 * One ranked answer to "what should I do next?", fused from every action source
 * the Career OS ALREADY produces — it invents no new advice and runs no new
 * scoring model:
 *
 *   1. Library-backed CAPADEX interventions  (backend `intervention-intelligence.ts`
 *      Top-5, surfaced via GET /api/career/next-actions/:userId) — authoritative,
 *      non-generic, behaviourally grounded.
 *   2. Weekly ROI moves  (`weeklyActionEngine.ts`) — deterministic profile/skill/
 *      market/job/interview levers.
 *   3. Constraint hand-offs  (`constraintEngine.ts`) — the recommended action for
 *      each surfaced career constraint ("why am I stuck").
 *
 * Pure + deterministic + best-effort: same inputs → same plan, no I/O, never
 * throws. Any missing source simply contributes nothing, so the engine degrades
 * gracefully (backend empty → weekly + constraints; everything empty → []).
 *
 * Developmental guidance only — never hiring / promotion / suitability claims.
 */
import type { CareerBrain } from '../services/useCareerBrain';
import { generateWeeklyActions, type WeeklyAction, type WeeklyActionContext, type ActionEffort } from '../engines/weeklyActionEngine';
import type { ConstraintReport, ConstraintType } from './constraintEngine';

// ── Backend Best Next Action (mirrors intervention-intelligence.ts `BestNextAction`) ──
export interface BestNextAction {
  intervention: string;
  reason: string;
  expectedImpact: number;   // 0..1
  confidence: number;       // 0..1
  reviewWindow: string;
  intervention_key: string;
  construct_key: string;
  description: string;
  severity: number;
  signalFrequency: number;
  patternStrength: number;
  historicalEffectiveness: number;
  score: number;            // 0..1 backend rank score
  rank: number;
  signal_refs: string[];
  pattern_refs: string[];
}

// ── Unified output ─────────────────────────────────────────────────────────────
export type UnifiedSource = 'intervention' | 'weekly' | 'constraint';
export type UnifiedProvenance = 'library-backed' | 'heuristic' | 'constraint';

export interface UnifiedAction {
  id: string;
  title: string;
  rationale: string;
  source: UnifiedSource;
  provenance: UnifiedProvenance;
  impact: number;            // 0..100 (normalised across sources)
  confidence: number;        // 0..1
  effort?: ActionEffort;
  reviewWindow?: string;
  deepLinkTab: string;       // a valid CareerBuilderPage TabId
  priority: number;          // final ranking score (desc) — explainable, additive
  refs?: { signals?: string[]; constructKey?: string; constraintType?: ConstraintType };
}

export interface UnifiedActionOptions {
  limit?: number;            // cap (default 6)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
function slug(s: string): string {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'action';
}

/** Map a constraint type to the CareerBuilderPage tab that addresses it. */
const CONSTRAINT_TAB: Record<ConstraintType, string> = {
  behavior: 'behavioral-growth',
  execution: 'behavioral-growth',
  confidence: 'behavioral-growth',
  skill: 'skills',
  experience: 'simulations',
};

/**
 * Tier bands keep the three sources comparable while honouring authority:
 *  - library-backed interventions lead (0.50–1.00) — strongest always wins;
 *  - weekly ROI moves interleave (0.30–0.70) so a top-ROI lever can outrank a
 *    weak intervention but never a strong one;
 *  - constraint hand-offs fill remaining slots (0.25–0.50).
 */
function interventionPriority(a: BestNextAction): number {
  // score is the backend's own composite rank; expectedImpact breaks ties.
  return clamp01(0.5 + 0.4 * clamp01(a.score) + 0.1 * clamp01(a.expectedImpact));
}
function weeklyPriority(a: WeeklyAction, maxRoi: number): number {
  const normRoi = maxRoi > 0 ? clamp01(a.roi / maxRoi) : 0;
  return clamp01(0.3 + 0.4 * normRoi);
}
function constraintPriority(score: number): number {
  return clamp01(0.25 + 0.25 * clamp01(score));
}

/**
 * Build the unified, ranked Next Best Actions list.
 *
 * @param brain  aggregated Career Brain (carries `bestNextActions` from the backend).
 * @param ctx    weekly-engine context (open jobs, assessment presence).
 * @param report optional ConstraintReport (P3) — its recommended actions enrich the plan.
 */
export function buildUnifiedActions(
  brain: CareerBrain,
  ctx: WeeklyActionContext = {},
  report?: ConstraintReport | null,
  opts: UnifiedActionOptions = {},
): UnifiedAction[] {
  const limit = Math.max(1, opts.limit ?? 6);
  const out: UnifiedAction[] = [];

  // 1. Library-backed CAPADEX interventions (authoritative — lead the plan).
  const backend = (brain?.bestNextActions || []).filter((a) => a && a.intervention);
  for (const a of backend) {
    out.push({
      id: `intervention-${slug(a.intervention_key || a.construct_key || a.intervention)}`,
      title: a.intervention,
      rationale: a.reason || a.description || 'Behaviourally grounded next step.',
      source: 'intervention',
      provenance: 'library-backed',
      impact: Math.round(clamp01(a.expectedImpact) * 100),
      confidence: clamp01(a.confidence),
      reviewWindow: a.reviewWindow || undefined,
      deepLinkTab: 'behavioral-growth',
      priority: interventionPriority(a),
      refs: { signals: a.signal_refs, constructKey: a.construct_key },
    });
  }

  // 2. Weekly ROI moves (deterministic levers — interleave by ROI).
  const weekly = generateWeeklyActions(brain, ctx);
  const maxRoi = weekly.reduce((m, w) => Math.max(m, w.roi), 0);
  for (const w of weekly) {
    out.push({
      id: `weekly-${slug(w.id)}`,
      title: w.title,
      rationale: w.rationale,
      source: 'weekly',
      provenance: 'heuristic',
      impact: clamp01(w.impact / 100) * 100,
      confidence: 0.6,
      effort: w.effort,
      deepLinkTab: w.deepLinkTab,
      priority: weeklyPriority(w, maxRoi),
    });
  }

  // 3. Constraint hand-offs (the "why am I stuck" → fix, fills remaining slots).
  //    ONLY enrich with constraints once authoritative backend interventions exist —
  //    with an empty backend the plan must degrade to exactly the prior weekly-only
  //    view (no behaviour change when the library-backed layer is absent).
  const constraints = backend.length > 0 ? (report?.constraints || []) : [];
  for (const c of constraints) {
    const act = c.recommendedActions?.[0];
    if (!act) continue;
    out.push({
      id: `constraint-${slug(c.type)}-${slug(act.id)}`,
      title: act.label,
      rationale: act.hint || c.rootCause,
      source: 'constraint',
      provenance: 'constraint',
      impact: Math.round(clamp01(c.score) * 100),
      confidence: clamp01(report?.confidence ?? c.score),
      deepLinkTab: CONSTRAINT_TAB[c.type] || 'behavioral-growth',
      priority: constraintPriority(c.score),
      refs: { constraintType: c.type },
    });
  }

  // Dedupe: keep the highest-priority action per normalised title (cross-source
  // overlap — e.g. an intervention and a constraint targeting the same behaviour).
  const best = new Map<string, UnifiedAction>();
  for (const a of out.sort((x, y) => y.priority - x.priority)) {
    const key = slug(a.title);
    if (!best.has(key)) best.set(key, a);
  }

  return Array.from(best.values())
    .sort((a, b) => b.priority - a.priority || b.impact - a.impact)
    .slice(0, limit);
}
