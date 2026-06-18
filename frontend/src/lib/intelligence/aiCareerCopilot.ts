/**
 * AI Career Copilot (Phase 8) — graph-grounded, deterministic-first orchestrator.
 *
 * This is the LAST layer of the Career OS spine. It does NOT compute anything new
 * and it owns NO new data: it RE-SHAPES the already-computed outputs of every
 * upstream intelligence system into grounded, evidence-backed answers to the
 * canonical career questions:
 *
 *   • Where am I?               → current state (Career Brain + Behavior Graph + ledger)
 *   • What is stopping me?      → ConstraintReport.primary (P3)
 *   • What should I do next?    → top Unified Action (P4)
 *   • Why?                      → the lineage behind the primary recommendation
 *   • What happens if I do it?  → expected outcome (action impact + P6 attribution)
 *   • Biggest gap? / Highest ROI? → top constraint / top action (blueprint extras)
 *
 * Every answer carries the user-required 4-part frame — **Current state · Evidence ·
 * Recommended action · Expected outcome** — plus machine `citations` (EvidenceRef[]).
 * NOTHING generic: when a source is empty the answer says so truthfully rather than
 * emitting hollow coaching. Pure, deterministic, best-effort, never throws.
 *
 * Grounding sources (all already-computed — connected, never rebuilt):
 *   Career Brain · Behavior Graph (P2) · Constraint Engine (P3) · Unified Action
 *   Engine (P4) · Progress Ledger (P5) · Outcome Attribution (P6) · plus Market
 *   readiness / Goals / Learning / Job Tracker carried on the brain + ctx.
 */
import type { BehaviorGraph, EvidenceRef, GraphNode } from './behaviorGraph';
import type { ConstraintReport, Constraint } from './constraintEngine';
import type { UnifiedAction } from './unifiedActionEngine';
import type { GrowthTimeline } from './progressLedger';
import type { Attribution } from './outcomeAttributionEngine';
import type { CareerBrain } from '../services/useCareerBrain';

// ── Lightweight grounding refs (read-only views of data already loaded elsewhere) ──
export interface CopilotGoalRef { text: string; completed?: boolean; targetDate?: string }
export interface CopilotJobRef { company?: string; role?: string; status?: string }

/** Everything the copilot reasons over — all of it already computed upstream. */
export interface CopilotContext {
  brain: CareerBrain;
  graph: BehaviorGraph | null;
  constraints: ConstraintReport;
  actions: UnifiedAction[];
  ledger: GrowthTimeline | null;
  attributions: Attribution[];
  eiScore?: number;
  openJobs?: number;
  goals?: CopilotGoalRef[];
  jobs?: CopilotJobRef[];
}

export type CopilotIntent =
  | 'where_am_i'
  | 'whats_stopping'
  | 'what_next'
  | 'why'
  | 'what_if'
  | 'biggest_gap'
  | 'highest_roi'
  | 'freeform';

export interface CopilotAnswer {
  question: string;
  intent: CopilotIntent;
  /** Composed prose answer (the 4 parts stitched) — what a chat surface renders. */
  answer: string;
  /** User-required structured frame. */
  currentState: string;
  evidence: string[];
  recommendedAction: string;
  expectedOutcome: string;
  /** Machine-readable provenance — no ungrounded claims. */
  citations: EvidenceRef[];
  /** Forward link(s) to the ranked plan (P4). */
  actions: UnifiedAction[];
  /** A valid CareerBuilderPage TabId to deep-link the recommended move, when known. */
  deepLinkTab?: string;
  confidence: number; // 0..1
}

// ── Canonical questions (the chips a surface offers) ───────────────────────────
export const CANONICAL_QUESTIONS: { intent: CopilotIntent; q: string }[] = [
  { intent: 'where_am_i', q: 'Where am I?' },
  { intent: 'whats_stopping', q: 'What is stopping me?' },
  { intent: 'what_next', q: 'What should I do next?' },
  { intent: 'why', q: 'Why?' },
  { intent: 'what_if', q: 'What happens if I do it?' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
function pct(n01: number): number {
  return Math.round(clamp01(n01) * 100);
}
function humanKey(s: string): string {
  return String(s || '').replace(/_/g, ' ').trim();
}
/** Pull up to `n` non-generic evidence lines off a graph node list. */
function nodeEvidence(nodes: GraphNode[] | undefined, n: number): { lines: string[]; refs: EvidenceRef[] } {
  const lines: string[] = [];
  const refs: EvidenceRef[] = [];
  for (const node of (nodes || []).slice(0, n)) {
    const detail = node.evidence?.[0]?.detail || node.label;
    lines.push(`${node.label}${detail && detail !== node.label ? ` — ${detail}` : ''}`);
    for (const e of node.evidence || []) refs.push(e);
  }
  return { lines, refs };
}
/** The Unified Action whose construct/signals match a constraint — for "what if" projection. */
function actionForConstraint(actions: UnifiedAction[], c: Constraint | null): UnifiedAction | undefined {
  if (!c) return undefined;
  return (
    actions.find((a) => a.refs?.constraintType === c.type) ||
    actions.find((a) => a.refs?.signals?.some((s) => c.evidence.some((e) => e.ref === s))) ||
    actions[0]
  );
}
/** Attributions tied to THIS action only — matched by id/title/construct/signal overlap. */
function matchedAttributions(attributions: Attribution[], a: UnifiedAction | undefined): Attribution[] {
  if (!a) return [];
  const construct = a.refs?.constructKey?.toLowerCase();
  const sigs = (a.refs?.signals || []).map((s) => s.toLowerCase());
  const title = a.title.toLowerCase();
  return attributions.filter((at) => {
    const label = (at.action.label || '').toLowerCase();
    if (at.action.id === a.id) return true;
    if (label && (label === title || label.includes(title) || title.includes(label))) return true;
    if (construct && label.includes(construct)) return true;
    return sigs.some((s) => label.includes(s));
  });
}
/** Grounded one-line summary of the live job pipeline, when any rows are tracked. */
function jobsLine(jobs: CopilotJobRef[] | undefined): string | null {
  const rows = (jobs || []).filter((j) => j.company || j.role);
  if (!rows.length) return null;
  const active = rows.filter((j) => j.status && !/reject|withdraw|closed|archiv/i.test(String(j.status)));
  const sample = (active[0] || rows[0]);
  const label = [sample.role, sample.company].filter(Boolean).join(' @ ');
  return `${rows.length} role${rows.length === 1 ? '' : 's'} in your pipeline${active.length ? ` (${active.length} active${label ? `, e.g. ${label}` : ''})` : ''}.`;
}
function stitch(parts: { currentState: string; evidence: string[]; recommendedAction: string; expectedOutcome: string }): string {
  const ev = parts.evidence.length ? `\n\n**Evidence:**\n${parts.evidence.map((e) => `• ${e}`).join('\n')}` : '';
  return (
    `**Where you stand:** ${parts.currentState}` +
    ev +
    `\n\n**Recommended action:** ${parts.recommendedAction}` +
    `\n\n**Expected outcome:** ${parts.expectedOutcome}`
  );
}

// ── Intent classification (deterministic — keyword routed) ─────────────────────
const INTENT_RULES: { intent: CopilotIntent; re: RegExp }[] = [
  { intent: 'whats_stopping', re: /stopping|stuck|block|hold(ing)?\s*me|in my way|bottleneck|barrier/i },
  { intent: 'what_if', re: /what\s+happens|if i (do|act|start)|expected (outcome|impact)|will (it|this) help|payoff/i },
  { intent: 'highest_roi', re: /highest\s*roi|best return|most impact|biggest win|fastest win|quick win/i },
  { intent: 'biggest_gap', re: /biggest gap|main gap|weakest|biggest weakness|skill gap/i },
  { intent: 'what_next', re: /what\s*('s| is|should i| do i|to do)\s*next|next step|what now|what should i do|action/i },
  { intent: 'where_am_i', re: /where am i|where do i stand|current (state|status)|my progress|how am i doing|status/i },
  { intent: 'why', re: /^why\b|why (am|is|should|does|that)/i },
];
export function classifyIntent(q: string): CopilotIntent {
  const text = String(q || '').trim();
  for (const r of INTENT_RULES) if (r.re.test(text)) return r.intent;
  return 'freeform';
}

// ── Per-intent grounded builders ───────────────────────────────────────────────
function emptyState(question: string, intent: CopilotIntent, msg: string): CopilotAnswer {
  return {
    question, intent,
    answer: msg,
    currentState: msg,
    evidence: [],
    recommendedAction: 'Complete an assessment (or add more profile detail) so the copilot has signals to reason over.',
    expectedOutcome: 'Once there is data, every answer here will be grounded in your own behaviour graph and metrics.',
    citations: [], actions: [], confidence: 0,
  };
}

function whereAmI(ctx: CopilotContext): CopilotAnswer {
  const b = ctx.brain;
  const ei = typeof ctx.eiScore === 'number' ? ctx.eiScore : undefined;
  const stage = b.currentStage || b.primaryIdentity || 'your current stage';
  const target = b.targetRole ? ` targeting ${b.targetRole}` : '';
  const metrics: string[] = [];
  if (ei !== undefined) metrics.push(`Employability Index ${ei}`);
  if (b.marketReadiness) metrics.push(`market readiness ${b.marketReadiness}`);
  if (b.interviewReadiness) metrics.push(`interview readiness ${b.interviewReadiness}`);
  if (b.transitionProbability) metrics.push(`transition probability ${b.transitionProbability}%`);

  const currentState =
    `You're in the "${stage}" stage${target}${metrics.length ? `, with ${metrics.join(', ')}.` : '.'}`;

  // Evidence: strengths + growth drivers + top ledger mover (all already computed).
  const strengths = nodeEvidence(ctx.graph?.strengths, 2);
  const drivers = nodeEvidence(ctx.graph?.growthDrivers, 1);
  const evidence = [...strengths.lines, ...drivers.lines];
  const citations = [...strengths.refs, ...drivers.refs];
  const mover = ctx.ledger?.summary?.topMover;
  if (mover) evidence.push(`Recent movement: ${mover.metric} ${mover.delta > 0 ? '+' : ''}${mover.delta}.`);
  if (ctx.goals && ctx.goals.length) {
    const open = ctx.goals.filter((g) => !g.completed).length;
    evidence.push(`${open} active goal${open === 1 ? '' : 's'} on record${open ? ` (e.g. "${ctx.goals.find((g) => !g.completed)?.text}")` : ''}.`);
  }
  const jl = jobsLine(ctx.jobs);
  if (jl) evidence.push(jl);
  else if (typeof ctx.openJobs === 'number' && ctx.openJobs > 0) evidence.push(`${ctx.openJobs} role${ctx.openJobs === 1 ? '' : 's'} tracked in your pipeline.`);

  const top = ctx.actions[0];
  const recommendedAction = top ? top.title : (b.fastestWinAction || 'Keep building your profile — more guidance unlocks as it fills in.');
  const expectedOutcome = top
    ? `Acting on it is your highest-return move (impact ${Math.round(top.impact)}, ${pct(top.confidence)}% confidence).`
    : 'Adding skills, a project and a goal will lift your Employability Index fastest.';

  return {
    question: 'Where am I?', intent: 'where_am_i',
    answer: stitch({ currentState, evidence, recommendedAction, expectedOutcome }),
    currentState, evidence, recommendedAction, expectedOutcome,
    citations, actions: top ? [top] : [], deepLinkTab: top?.deepLinkTab,
    confidence: clamp01(ctx.graph?.meta?.confidence ?? (ctx.constraints.confidence || 0.5)),
  };
}

function whatsStopping(ctx: CopilotContext, question = 'What is stopping me?', intent: CopilotIntent = 'whats_stopping'): CopilotAnswer {
  const c = ctx.constraints.primary;
  if (!c) {
    // No constraint surfaced — fall back to the brain's bottleneck if it named one.
    if (ctx.brain.coreBottleneck) {
      const cs = `Your main constraint right now is: ${ctx.brain.coreBottleneck}.`;
      const top = ctx.actions[0];
      return {
        question, intent, answer: stitch({ currentState: cs, evidence: ctx.brain.behavioralConstraints || [], recommendedAction: top?.title || ctx.brain.fastestWinAction || cs, expectedOutcome: top ? `Impact ${Math.round(top.impact)}, ${pct(top.confidence)}% confidence.` : 'Addressing it clears your fastest path forward.' }),
        currentState: cs, evidence: ctx.brain.behavioralConstraints || [],
        recommendedAction: top?.title || ctx.brain.fastestWinAction || cs,
        expectedOutcome: top ? `Impact ${Math.round(top.impact)}, ${pct(top.confidence)}% confidence.` : 'Addressing it clears your fastest path forward.',
        citations: [], actions: top ? [top] : [], deepLinkTab: top?.deepLinkTab, confidence: 0.4,
      };
    }
    return emptyState(question, intent, 'No blocking constraint has surfaced yet — nothing is clearly holding you back in the current data.');
  }
  const currentState = `${c.rootCause} (a ${c.severity} ${c.type} constraint blocking ${c.blocksGoal}).`;
  const evidence = c.evidence.map((e) => e.detail);
  const citations = c.evidence;
  const action = actionForConstraint(ctx.actions, c);
  const recommendedAction = action ? action.title : (c.recommendedActions[0]?.label || 'Address this constraint directly.');
  const expectedOutcome = action
    ? `Clears the ${c.type} constraint on ${c.blocksGoal} — impact ${Math.round(action.impact)}, ${pct(action.confidence)}% confidence.`
    : `Removing it unblocks ${c.blocksGoal}.`;
  return {
    question, intent,
    answer: stitch({ currentState, evidence, recommendedAction, expectedOutcome }),
    currentState, evidence, recommendedAction, expectedOutcome,
    citations, actions: action ? [action] : [], deepLinkTab: action?.deepLinkTab,
    confidence: clamp01(ctx.constraints.confidence || c.score),
  };
}

function whatNext(ctx: CopilotContext, question = 'What should I do next?', intent: CopilotIntent = 'what_next'): CopilotAnswer {
  const top = ctx.actions[0];
  if (!top) return emptyState(question, intent, 'No ranked action is available yet — finish an assessment to unlock library-backed recommendations.');
  const provenance = top.provenance === 'library-backed' ? 'a CAPADEX library intervention' : top.provenance === 'constraint' ? 'your top constraint' : 'your highest-ROI weekly move';
  const currentState = `Your highest-return next move comes from ${provenance}.`;
  const evidence: string[] = [];
  const sig = top.refs?.signals?.filter(Boolean) ?? [];
  if (sig.length) evidence.push(`Derived from signals: ${sig.slice(0, 3).map(humanKey).join(', ')}${sig.length > 3 ? ` +${sig.length - 3} more` : ''}.`);
  if (top.refs?.constructKey) evidence.push(`Targets construct: ${humanKey(top.refs.constructKey)}.`);
  if (top.rationale) evidence.push(top.rationale);
  const recommendedAction = top.title;
  const expectedOutcome = `Impact ${Math.round(top.impact)}, ${pct(top.confidence)}% confidence${top.reviewWindow ? `, review in ${top.reviewWindow}` : ''}.`;
  return {
    question, intent,
    answer: stitch({ currentState, evidence, recommendedAction, expectedOutcome }),
    currentState, evidence, recommendedAction, expectedOutcome,
    citations: [], actions: ctx.actions.slice(0, 3), deepLinkTab: top.deepLinkTab,
    confidence: clamp01(top.confidence),
  };
}

function why(ctx: CopilotContext): CopilotAnswer {
  // "Why?" explains the lineage behind the current primary recommendation:
  // constraint → evidence → action → (historical effectiveness, if attributed).
  const c = ctx.constraints.primary;
  const action = actionForConstraint(ctx.actions, c) || ctx.actions[0];
  if (!c && !action) return emptyState('Why?', 'why', 'There is no active recommendation to explain yet.');
  const currentState = c
    ? `Because your strongest constraint is ${c.rootCause} — it scores highest on impact × evidence among everything blocking ${c.blocksGoal}.`
    : `Because "${action!.title}" is your highest-ranked move right now.`;
  const evidence: string[] = [];
  const citations: EvidenceRef[] = [];
  if (c) { for (const e of c.evidence) { evidence.push(e.detail); citations.push(e); } }
  if (action?.rationale) evidence.push(action.rationale);
  // Historical effectiveness from P6 attribution, when this kind of move has moved metrics before.
  const relevant = ctx.attributions.find((a) => action && (a.action.label === action.title || a.action.id === action.id));
  if (relevant) evidence.push(`Historically, "${relevant.action.label}" preceded a ${relevant.attributedDelta > 0 ? '+' : ''}${relevant.attributedDelta} move in ${relevant.outcomeMetric} (${pct(relevant.confidence)}% confidence).`);
  const recommendedAction = action ? action.title : (c?.recommendedActions[0]?.label || '');
  const expectedOutcome = action
    ? `Doing it is expected to move the needle most — impact ${Math.round(action.impact)}, ${pct(action.confidence)}% confidence.`
    : `Addressing ${c?.blocksGoal} is the unlock.`;
  return {
    question: 'Why?', intent: 'why',
    answer: stitch({ currentState, evidence, recommendedAction, expectedOutcome }),
    currentState, evidence, recommendedAction, expectedOutcome,
    citations, actions: action ? [action] : [], deepLinkTab: action?.deepLinkTab,
    confidence: clamp01(ctx.constraints.confidence || action?.confidence || 0.5),
  };
}

function whatIf(ctx: CopilotContext): CopilotAnswer {
  const top = ctx.actions[0];
  if (!top) return emptyState('What happens if I do it?', 'what_if', 'No recommended action is queued yet, so there is no outcome to project.');
  const currentState = `If you complete "${top.title}":`;
  const evidence: string[] = [];
  const citations: EvidenceRef[] = [];
  // Ground the projection ONLY in attributions tied to THIS action — matched by id /
  // title / construct / signal overlap — so we never present an unrelated historical
  // outcome as evidence for the current recommendation. Unmatched → modelled impact only.
  const proven = matchedAttributions(ctx.attributions, top).filter((a) => a.attributedDelta > 0).slice(0, 2);
  for (const a of proven) {
    evidence.push(`This action ("${a.action.label}") previously moved ${a.outcomeMetric} by +${a.attributedDelta} (${pct(a.confidence)}% confidence).`);
    for (const e of a.evidence) citations.push(e);
  }
  const sig = top.refs?.signals?.filter(Boolean) ?? [];
  if (sig.length) evidence.push(`It directly targets ${sig.slice(0, 2).map(humanKey).join(' & ')}.`);
  const recommendedAction = top.title;
  const projected = proven.length
    ? `Based on your own history, expect measurable movement on ${proven.map((p) => p.outcomeMetric).join(' & ')}.`
    : `Modelled impact ${Math.round(top.impact)} at ${pct(top.confidence)}% confidence${top.reviewWindow ? `; reassess in ${top.reviewWindow}` : ''}.`;
  return {
    question: 'What happens if I do it?', intent: 'what_if',
    answer: stitch({ currentState, evidence, recommendedAction, expectedOutcome: projected }),
    currentState, evidence, recommendedAction, expectedOutcome: projected,
    citations, actions: [top], deepLinkTab: top.deepLinkTab,
    confidence: clamp01(top.confidence),
  };
}

function biggestGap(ctx: CopilotContext): CopilotAnswer {
  // Biggest gap = the primary constraint, or — when no constraint — the top critical skill gap.
  if (ctx.constraints.primary) return whatsStopping(ctx, 'What is my biggest gap?', 'biggest_gap');
  const gap = (ctx.brain.skillGaps || []).find((g) => g.category === 'critical') || (ctx.brain.skillGaps || [])[0];
  if (!gap) return emptyState('What is my biggest gap?', 'biggest_gap', 'No clear gap has surfaced — your profile is well rounded for the data available.');
  const currentState = `Your biggest gap is ${gap.skill} (a ${gap.category} skill for ${ctx.brain.targetRole || 'your target role'}).`;
  const top = ctx.actions[0];
  const recommendedAction = top?.title || `Build evidence in ${gap.skill}.`;
  return {
    question: 'What is my biggest gap?', intent: 'biggest_gap',
    answer: stitch({ currentState, evidence: [`Impact weight ${gap.impact} on your target role match.`], recommendedAction, expectedOutcome: top ? `Impact ${Math.round(top.impact)}, ${pct(top.confidence)}% confidence.` : `Closing it lifts your role-fit most.` }),
    currentState, evidence: [`Impact weight ${gap.impact} on your target role match.`],
    recommendedAction, expectedOutcome: top ? `Impact ${Math.round(top.impact)}, ${pct(top.confidence)}% confidence.` : `Closing it lifts your role-fit most.`,
    citations: [], actions: top ? [top] : [], deepLinkTab: top?.deepLinkTab || 'skills', confidence: 0.55,
  };
}

/**
 * Deterministic, grounded answer to a canonical career question. Pure & never
 * throws — an empty source yields a truthful empty-state answer (no generic coaching).
 */
export function answerCareerQuestion(question: string, ctx: CopilotContext): CopilotAnswer {
  const intent = classifyIntent(question);
  switch (intent) {
    case 'where_am_i':    return whereAmI(ctx);
    case 'whats_stopping':return whatsStopping(ctx);
    case 'what_next':     return whatNext(ctx);
    case 'why':           return why(ctx);
    case 'what_if':       return whatIf(ctx);
    case 'biggest_gap':   return biggestGap(ctx);
    case 'highest_roi':   return whatNext(ctx, 'What is my highest-ROI move?', 'highest_roi');
    case 'freeform':      return whereAmI(ctx); // safe grounded default for unmatched intents
    default:              return whereAmI(ctx);
  }
}

/**
 * Grounded free-form answer via the EXISTING chat LLM proxy (`/api/chat/message`).
 * The copilot context is injected into the message as a structured, factual brief so
 * the model can only speak from the user's own data — and the deterministic answer is
 * attached as the citation/action backbone (no ungrounded claims). Falls back to the
 * deterministic answer on any failure. Reuses the existing endpoint — no new API.
 */
export async function answerWithLLM(question: string, ctx: CopilotContext): Promise<CopilotAnswer> {
  const grounded = answerCareerQuestion(question, ctx);
  const brief = [
    `[Career OS context — answer ONLY from these facts, no generic advice]`,
    grounded.currentState && `State: ${grounded.currentState}`,
    grounded.evidence.length ? `Evidence: ${grounded.evidence.join('; ')}` : '',
    grounded.recommendedAction && `Recommended: ${grounded.recommendedAction}`,
    grounded.expectedOutcome && `Expected: ${grounded.expectedOutcome}`,
  ].filter(Boolean).join('\n');
  try {
    const resp = await fetch('/api/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        message: `${question}\n\n${brief}`,
        sessionId: `copilot_${Date.now()}`,
        context: { userRole: 'career' },
      }),
    });
    if (!resp.ok) return grounded;
    const data = await resp.json();
    const text = typeof data?.response === 'string' && data.response.trim() ? data.response.trim() : grounded.answer;
    return { ...grounded, intent: 'freeform', answer: text };
  } catch {
    return grounded;
  }
}
