/**
 * Constraint Engine — frontend orchestration (Career OS — Phase 3).
 *
 * One explainable answer to "Why is this person not progressing?".
 *
 * This is ORCHESTRATION, not a new compute engine. It reads only from already-
 * computed surfaces — the unified `BehaviorGraph` (P2) and the aggregated
 * `CareerBrain` — and reshapes them into a deterministic, evidence-backed set of
 * career constraints. It never recomputes behavioural intelligence, never fetches,
 * and never throws: missing/empty inputs degrade to an empty report.
 *
 * Every constraint is non-generic — its `rootCause` names the actual signal,
 * pattern, skill, or readiness value it came from, and carries the `EvidenceRef`s
 * that justify it. Developmental framing only — never hiring/suitability claims.
 */
import type { BehaviorGraph, EvidenceRef, GraphNode, SourceTag } from './behaviorGraph';
import type { CareerBrain } from '../services/useCareerBrain';

// ── Public shapes ─────────────────────────────────────────────────────────────
export type ConstraintType = 'behavior' | 'skill' | 'experience' | 'execution' | 'confidence';
export type ConstraintSeverity = 'critical' | 'high' | 'medium' | 'low';

/** Lightweight forward-link to the Next Best Action engine (P4). Until P4 lands
 *  these are deterministic hints derived from the constraint; P4 will supersede. */
export interface ActionRef {
  id: string;
  label: string;
  hint: string;
}

export interface Constraint {
  type: ConstraintType;
  rootCause: string;              // non-generic — names the actual signal/skill/value
  evidence: EvidenceRef[];        // what justifies it (from BehaviorGraph + brain)
  severity: ConstraintSeverity;
  blocksGoal: string;             // the target this constraint blocks
  recommendedActions: ActionRef[];
  score: number;                  // 0..1 internal ranking (explainable, additive)
}

export interface ConstraintReport {
  constraints: Constraint[];
  primary: Constraint | null;
  confidence: number;            // 0..1 — how trustworthy the report is
  sources: SourceTag[];
}

/** Optional context. Every field is optional — anything missing is derived from
 *  `brain` or simply skipped (the matching constraint is not emitted). */
export interface CareerCtx {
  targetRole?: string;
  profile?: any;
  openJobs?: number;
  eiScore?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
function slug(s: string): string {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'item';
}
/** A node's strength = its severity when it has one (risks/contradictions), else confidence. */
function nodeStrength(n: GraphNode): number {
  return clamp01(typeof n.severity === 'number' ? n.severity : n.confidence);
}
function severityFromScore(score: number): ConstraintSeverity {
  if (score >= 0.75) return 'critical';
  if (score >= 0.55) return 'high';
  if (score >= 0.35) return 'medium';
  return 'low';
}
/** Impact weight per constraint type — how broadly this kind of constraint blocks progress. */
const IMPACT: Record<ConstraintType, number> = {
  behavior: 0.9,
  execution: 0.85,
  skill: 0.8,
  confidence: 0.7,
  experience: 0.7,
};
/** Tie-break order when scores are equal — behaviour/execution lead the "why stuck" story. */
const TYPE_RANK: Record<ConstraintType, number> = {
  behavior: 0, execution: 1, skill: 2, confidence: 3, experience: 4,
};
const CONFIDENCE_RE = /confiden|hesit|avoid|doubt|overthink|imposter|impostor|self_?worth|fear/i;

// ── Engine ────────────────────────────────────────────────────────────────────
/**
 * Derive the career constraints blocking the user, ranked by impact × evidence.
 * Pure, deterministic, best-effort. `graph` may be null (no linked session) — the
 * engine then leans on whatever the brain already aggregated.
 */
export function deriveConstraints(
  graph: BehaviorGraph | null,
  brain: CareerBrain,
  ctx: CareerCtx = {},
): ConstraintReport {
  const rawTarget = (ctx.targetRole ?? brain?.targetRole ?? '').trim();
  const targetRole = rawTarget && rawTarget.toLowerCase() !== 'not set' ? rawTarget : '';
  const blocksGoal = targetRole || 'your next career move';
  const eiScore = typeof ctx.eiScore === 'number' ? ctx.eiScore : undefined;
  const openJobs = typeof ctx.openJobs === 'number' ? ctx.openJobs : undefined;

  const constraints: Constraint[] = [];

  const push = (
    type: ConstraintType,
    rootCause: string,
    evidence: EvidenceRef[],
    evidenceStrength: number,
    actions: ActionRef[],
  ) => {
    const score = clamp01(IMPACT[type] * clamp01(evidenceStrength));
    if (score <= 0) return;
    constraints.push({
      type,
      rootCause,
      evidence: evidence.slice(0, 4),
      severity: severityFromScore(score),
      blocksGoal,
      recommendedActions: actions.slice(0, 2),
      score,
    });
  };

  // ── 1. BEHAVIOUR ← growthBlockers / risks / contradictions / concern patterns ──
  const behaviorNodes: GraphNode[] = [
    ...((graph?.risks) || []),
    ...((graph?.contradictions) || []),
    ...((graph?.growthBlockers) || []),
    ...((graph?.patterns) || []),
  ].slice().sort((a, b) => nodeStrength(b) - nodeStrength(a));

  if (behaviorNodes.length > 0) {
    const top = behaviorNodes[0];
    const evidence = behaviorNodes.slice(0, 3).flatMap((n) => n.evidence || []);
    push(
      'behavior',
      `${top.label} is the dominant behavioural blocker`,
      evidence,
      nodeStrength(top),
      [{ id: `act_behavior_${slug(top.label)}`, label: `Work on "${top.label}"`, hint: `Target the behaviour driving "${top.label}" with a focused intervention` }],
    );
  } else {
    // No linked graph — fall back to what the brain already distilled.
    const realConstraints = (brain?.behavioralConstraints || []).filter(
      (c) => c && !/^no behavioural constraints/i.test(c),
    );
    const topPattern = (brain?.patterns || [])[0];
    if (realConstraints.length > 0 || topPattern) {
      const rootCause = realConstraints[0] || `Recurring pattern: ${topPattern?.label || topPattern?.key}`;
      const evidence: EvidenceRef[] = [];
      if (topPattern) evidence.push({ source: 'capadex', ref: topPattern.key || 'pattern', detail: topPattern.label || topPattern.key || 'Behavioural pattern' });
      realConstraints.slice(0, 2).forEach((c, i) => evidence.push({ source: 'capadex', ref: `constraint_${i}`, detail: c }));
      const strength = topPattern ? clamp01(topPattern.confidence) : 0.55;
      push('behavior', rootCause, evidence, Math.max(strength, 0.5), [
        { id: 'act_behavior_pattern', label: 'Address the recurring pattern', hint: rootCause },
      ]);
    }
  }

  // ── 2. SKILL ← brain.skillGaps (+ low competency signals from the graph) ──
  const gaps = (brain?.skillGaps || []).filter((g) => g && g.skill);
  const criticalGaps = gaps.filter((g) => g.category === 'critical');
  if (gaps.length > 0 && targetRole) {
    const lead = criticalGaps[0] || gaps[0];
    const evidence: EvidenceRef[] = gaps.slice(0, 3).map((g) => ({
      source: 'resume' as SourceTag,
      ref: `skill_${slug(g.skill)}`,
      detail: `${g.skill} — ${g.category} gap for ${targetRole}`,
    }));
    (graph?.competencySignals || [])
      .filter((c) => Number(c.level) > 0 && Number(c.level) < 40)
      .slice(0, 2)
      .forEach((c) => evidence.push({ source: 'csi', ref: `comp_${slug(c.domain)}`, detail: `${c.domain} competency low (${Math.round(Number(c.level))})` }));
    const base = lead.category === 'critical' ? 0.9 : lead.category === 'important' ? 0.6 : 0.35;
    const strength = clamp01(base + Math.min(0.1, Math.max(0, criticalGaps.length - 1) * 0.05));
    push(
      'skill',
      `"${lead.skill}" is the highest-impact missing skill for ${targetRole}`,
      evidence,
      strength,
      [{ id: `act_skill_${slug(lead.skill)}`, label: `Close "${lead.skill}"`, hint: `Add evidence or a project demonstrating ${lead.skill}` }],
    );
  }

  // ── 3. EXPERIENCE ← profile experience vs target role ──
  if (targetRole && ctx.profile && Array.isArray(ctx.profile.experience)) {
    const entries = ctx.profile.experience.filter(Boolean).length;
    if (entries < 2) {
      const strength = entries === 0 ? 0.9 : 0.55;
      push(
        'experience',
        entries === 0
          ? `No demonstrated experience on record for ${targetRole}`
          : `Only one role on record — thin experience for ${targetRole}`,
        [{ source: 'resume' as SourceTag, ref: 'experience_count', detail: `${entries} experience ${entries === 1 ? 'entry' : 'entries'} vs ${targetRole} expectations` }],
        strength,
        [{ id: 'act_experience', label: 'Build demonstrable experience', hint: `Run a simulation or ship a project relevant to ${targetRole}` }],
      );
    }
  }

  // ── 4. EXECUTION ← executionReadiness + job-pipeline stagnation ──
  const exec = Number(brain?.executionReadiness);
  const hasExec = Number.isFinite(exec) && exec > 0;
  const stagnant = openJobs === 0;
  if ((hasExec && exec < 55) || stagnant) {
    const deficit = hasExec ? clamp01((55 - exec) / 55) : 0;
    const strength = clamp01(deficit + (stagnant ? 0.25 : 0));
    const parts: string[] = [];
    if (hasExec && exec < 55) parts.push(`execution readiness at ${Math.round(exec)}/100`);
    if (stagnant) parts.push('no applications currently in flight');
    const evidence: EvidenceRef[] = [];
    if (hasExec && exec < 55) {
      evidence.push({
        source: brain?.behaviorProfile ? 'capadex' : 'csi',
        ref: 'execution_readiness',
        detail: `Execution readiness ${Math.round(exec)}/100`,
      });
    }
    if (stagnant) evidence.push({ source: 'employer', ref: 'job_pipeline', detail: 'No active applications in flight' });
    if (strength > 0) {
      push(
        'execution',
        `Stalled execution — ${parts.join(' and ')}`,
        evidence,
        Math.max(strength, 0.35),
        [{ id: 'act_execution', label: 'Create momentum', hint: stagnant ? 'Apply to one well-matched role this week' : 'Time-box one concrete step to rebuild momentum' }],
      );
    }
  }

  // ── 5. CONFIDENCE ← confidence-coded signals + low EI provenance ──
  const confNodes: GraphNode[] = [
    ...((graph?.patterns) || []),
    ...((graph?.risks) || []),
    ...((graph?.growthBlockers) || []),
  ].filter((n) => CONFIDENCE_RE.test(n.label || n.id));
  const lowEi = typeof eiScore === 'number' && eiScore < 45 ? clamp01((45 - eiScore) / 45) : 0;
  if (confNodes.length > 0 || lowEi > 0) {
    const top = confNodes.slice().sort((a, b) => nodeStrength(b) - nodeStrength(a))[0];
    const evidence: EvidenceRef[] = [];
    confNodes.slice(0, 2).forEach((n) => (n.evidence || []).forEach((e) => evidence.push(e)));
    if (lowEi > 0) evidence.push({ source: 'assessment', ref: 'ei_score', detail: `Emotional intelligence score at ${Math.round(eiScore as number)}` });
    const strength = clamp01((top ? nodeStrength(top) : 0) * 0.7 + lowEi * 0.6);
    const rootCause = top
      ? `Confidence signal "${top.label}" is holding you back`
      : `Low confidence provenance (EI ${Math.round(eiScore as number)})`;
    push('confidence', rootCause, evidence, Math.max(strength, 0.3), [
      { id: 'act_confidence', label: 'Build evidenced confidence', hint: 'Convert a recent win into proof, then take one stretch action' },
    ]);
  }

  // ── Rank & assemble ────────────────────────────────────────────────────────
  constraints.sort((a, b) => (b.score - a.score) || (TYPE_RANK[a.type] - TYPE_RANK[b.type]));
  const primary = constraints[0] || null;

  const meanScore = constraints.length
    ? constraints.reduce((s, c) => s + c.score, 0) / constraints.length
    : 0;
  const graphConf = clamp01(graph?.meta?.confidence ?? 0);
  const confidence = graph
    ? clamp01(graphConf * 0.6 + meanScore * 0.4)
    : clamp01(meanScore * 0.7);

  const sourceSet = new Set<SourceTag>();
  (graph?.meta?.sources || []).forEach((s) => sourceSet.add(s as SourceTag));
  constraints.forEach((c) => c.evidence.forEach((e) => {
    if (e.source) sourceSet.add(e.source as SourceTag);
  }));

  return { constraints, primary, confidence, sources: Array.from(sourceSet) };
}
