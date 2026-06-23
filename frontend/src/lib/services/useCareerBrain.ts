/**
 * Career Brain — synchronised aggregation layer (Phase 5 — Part A).
 *
 * One hook that fuses every signal the Career OS already produces into a single,
 * decision-ready picture of the user:
 *
 *   Profile · Resume · Competency Assessment · BIOS Signals · CAPADEX Patterns ·
 *   Market Intelligence · Job Activity
 *
 * Everything is best-effort and defensive: missing data degrades to sane defaults,
 * the hook NEVER throws, and all outputs are developmental signals only — never
 * hiring / promotion / suitability predictions (language policy).
 *
 * The aggregate is intentionally read-only. It does not modify the Employability
 * Index, benchmarks, or any cohort data, and it touches no peer aggregates (so
 * k-anonymity is untouched).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchBehaviorGraph, type BehaviorGraph } from '../intelligence/behaviorGraph';
import type { BestNextAction } from '../intelligence/unifiedActionEngine';

const LS_TARGET_ROLE = 'mx-career-target-role';

function authHeader(): Record<string, string> {
  try {
    const t = localStorage.getItem('metryx_token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}

function clamp(n: number, lo = 0, hi = 100): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

// ── Public shapes ─────────────────────────────────────────────────────────────
export interface BrainSignal { key: string; label: string; strength: number; confidence: number; status?: string }
export interface BrainPattern { key: string; label: string; confidence: number }
export interface BrainSkillGap { skill: string; impact: number; category: 'critical' | 'important' | 'nice-to-have' }

/**
 * CareerBehaviorProfile — CAPADEX behavioural intelligence distilled for career
 * decisions. Mirrors the backend adapter output (GET /api/career/behavior-profile).
 * Developmental framing only; readiness fields are 0–100, confidence 0–1.
 */
export interface CareerBehaviorProfile {
  careerReadiness: number;
  interviewReadiness: number;
  learningReadiness: number;
  executionReadiness: number;
  leadershipReadiness: number;
  executionStyle: string;
  careerConstraints: string[];
  drivers?: Array<{ output: string; delta: number; reason: string; source: string }>;
  confidence: number;
  sources: string[];
}

/**
 * CompetencyActivation — Phase 6 competency-driven scores + gap-derived plan,
 * COMPOSED by the backend career-intelligence bridge from the MEASURED competency
 * profile (GET /api/career/competency-activation/:userId). null when the flag is
 * OFF (endpoint 503s) or the subject has no measured profile → the brain falls
 * back to its existing heuristics (byte-identical legacy behaviour).
 */
export interface ActivationScore {
  key: string;
  label: string;
  measurable: boolean;
  value: number | null;
  band: string | null;
  direction?: 'improving' | 'stable' | 'declining' | null;
  provenance: string;
  note: string;
}
export interface CompetencyActivation {
  measurable: boolean;
  scores: {
    measurable: boolean;
    career_readiness: ActivationScore;
    career_growth: ActivationScore;
    role_progression: ActivationScore;
    skill_gap: ActivationScore;
  };
  plan: {
    focus_areas: Array<{
      competency_id: string;
      competency_name: string | null;
      required_level: number;
      actual_level: number | null;
      gap: number;
      criticality: string;
      blocking: boolean;
    }>;
    plan_actions: Array<{ recommendation_id: string; category: string; title: string; priority: string; rationale: string }>;
  };
  provenance: { source: string; note: string };
}

export interface CareerBrain {
  primaryIdentity: string;
  currentStage: string;
  targetRole: string;
  transitionProbability: number;       // 0–100
  coreBottleneck: string;
  fastestWinAction: string;
  riskFactors: string[];
  executionStyle: string;
  behavioralConstraints: string[];
  marketReadiness: number;             // 0–100
  interviewReadiness: number;          // 0–100
  learningPriority: string;
  weeklyFocus: string;
  // ── helper fields (additive — consumed by the Weekly Action engine) ──
  skillGaps: BrainSkillGap[];
  signals: BrainSignal[];
  patterns: BrainPattern[];
  dimensions: Array<{ key: string; label: string; score: number }>;
  // ── CAPADEX behavioural readiness (additive — Phase 4 adapter) ──
  careerReadiness: number;             // 0–100
  learningReadiness: number;           // 0–100
  executionReadiness: number;          // 0–100
  leadershipReadiness: number;         // 0–100
  behaviorProfile: CareerBehaviorProfile | null; // raw adapter output (null until loaded)
  // ── Unified Behavior Graph (additive — Phase 2; null until loaded / when absent) ──
  behaviorGraph: BehaviorGraph | null;
  // ── Library-backed Best Next Actions (additive — Phase 4; [] until loaded / when absent) ──
  bestNextActions: BestNextAction[];
  // ── Competency-driven activation (additive — Phase 6; null until loaded / when absent or not measurable) ──
  competencyActivation: CompetencyActivation | null;
  growthScore: number | null;          // competency-driven career-growth potential (0–100)
  progressionScore: number | null;     // measured EI-history role-progression trajectory (0–100)
  skillGapScore: number | null;        // competency-driven skill-gap pressure (0–100; higher = more pressure)
}

export interface CareerBrainInputs {
  profile: any;
  jobs?: any[];
  goals?: any[];
  eiScore?: number;
}

const STAGES = [
  { label: 'Starter', min: 0 },
  { label: 'Builder', min: 25 },
  { label: 'Career-Ready', min: 50 },
  { label: 'Hire-Ready', min: 75 },
];
function stageFor(score: number): string {
  let s = STAGES[0].label;
  for (const st of STAGES) if (score >= st.min) s = st.label;
  return s;
}

/** Lightweight, dependency-free skill-gap heuristic: target-role tokens the
 *  profile's skills don't yet cover. Deterministic; no peer/cohort data. */
function deriveSkillGaps(profile: any, targetRole: string): BrainSkillGap[] {
  const have = new Set<string>(
    [
      ...((profile?.skills?.technical as string[]) || []),
      ...((profile?.skills?.soft as string[]) || []),
    ].map((s) => String(s).toLowerCase().trim()),
  );
  const role = (targetRole || '').toLowerCase();
  // Curated, role-family-keyed competency expectations (developmental, not a
  // hiring rubric). Generic fallback ensures we always surface something useful.
  const FAMILIES: Array<{ match: RegExp; needs: string[] }> = [
    { match: /engineer|developer|programmer|software|sde/, needs: ['system design', 'testing', 'code review', 'ci/cd', 'data structures'] },
    { match: /data|ml|ai|scientist|analyst/, needs: ['statistics', 'sql', 'python', 'data visualisation', 'experimentation'] },
    { match: /product|pm|owner/, needs: ['roadmapping', 'user research', 'prioritisation', 'stakeholder management', 'metrics'] },
    { match: /design|ux|ui/, needs: ['user research', 'prototyping', 'design systems', 'accessibility', 'visual design'] },
    { match: /manager|lead|head|director/, needs: ['people management', 'strategy', 'delegation', 'coaching', 'planning'] },
    { match: /market|sales|growth/, needs: ['positioning', 'analytics', 'campaign design', 'crm', 'negotiation'] },
  ];
  const fam = FAMILIES.find((f) => f.match.test(role));
  const needs = fam ? fam.needs : ['communication', 'problem solving', 'domain depth', 'collaboration', 'leadership'];
  const gaps: BrainSkillGap[] = [];
  needs.forEach((n, i) => {
    if (!have.has(n.toLowerCase())) {
      gaps.push({ skill: n, impact: 100 - i * 12, category: i < 2 ? 'critical' : i < 4 ? 'important' : 'nice-to-have' });
    }
  });
  return gaps;
}

/**
 * Aggregate the Career Brain. Pass the data already loaded in CareerBuilderPage
 * (profile/jobs/goals/eiScore); the hook fetches competency dimensions and prior
 * behavioural memory in the background and folds them in as they arrive.
 */
export function useCareerBrain(userId: string, inputs: CareerBrainInputs): { brain: CareerBrain; loading: boolean } {
  const { profile, jobs = [], goals = [], eiScore = 0 } = inputs;
  const [dimensions, setDimensions] = useState<Array<{ key: string; label: string; score: number }>>([]);
  const [memSignals, setMemSignals] = useState<BrainSignal[]>([]);
  const [memPatterns, setMemPatterns] = useState<BrainPattern[]>([]);
  const [behaviorProfile, setBehaviorProfile] = useState<CareerBehaviorProfile | null>(null);
  const [behaviorGraph, setBehaviorGraph] = useState<BehaviorGraph | null>(null);
  const [bestNextActions, setBestNextActions] = useState<BestNextAction[]>([]);
  const [competencyActivation, setCompetencyActivation] = useState<CompetencyActivation | null>(null);
  // Occupation-aware skill gaps from the DB graph (additive; empty = fall back to heuristic).
  const [occupationSkills, setOccupationSkills] = useState<Array<{ canonical_name: string; importance: string; proficiency_level: number; weight: number }>>([]);
  const [loading, setLoading] = useState(true);
  const reqId = useRef(0);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const id = ++reqId.current;
    setLoading(true);
    (async () => {
      // Competency dimensions (best-effort).
      try {
        const r = await fetch(`/api/competency/score/${userId}`, { headers: authHeader() as HeadersInit, credentials: 'include' });
        if (r.ok) {
          const d = await r.json();
          const dims = d?.dimensions || d?.score?.dimensions || {};
          const list = Object.entries(dims).map(([k, v]: [string, any]) => ({
            key: k,
            label: String(k).replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
            score: clamp(Number(v?.score ?? v) || 0),
          }));
          if (id === reqId.current) setDimensions(list);
        }
      } catch { /* degrade */ }

      // Behavioural memory — prior BIOS signals + CAPADEX patterns (best-effort).
      try {
        const r = await fetch(`/api/career/behavioural-memory/${userId}`, { headers: authHeader() as HeadersInit, credentials: 'include' });
        if (r.ok) {
          const d = await r.json();
          const latest = d?.snapshots?.[0];
          if (latest && id === reqId.current) {
            setMemSignals(Array.isArray(latest.signals) ? latest.signals : []);
            setMemPatterns(Array.isArray(latest.patterns) ? latest.patterns : []);
          }
        }
      } catch { /* degrade */ }

      // CAPADEX behavioural intelligence → CareerBehaviorProfile (best-effort).
      // Adopt ONLY when a real linked session backs the profile (session_id present).
      // With no behavioural data the backend returns a neutral profile + session_id:null;
      // ignoring it here preserves the legacy heuristics ("no change when absent").
      try {
        const r = await fetch(`/api/career/behavior-profile/${userId}`, { headers: authHeader() as HeadersInit, credentials: 'include' });
        if (r.ok) {
          const d = await r.json();
          if (d?.profile && d?.session_id && id === reqId.current) setBehaviorProfile(d.profile as CareerBehaviorProfile);
        }
      } catch { /* degrade */ }

      // Unified Behavior Graph (best-effort; null when no linked session → no behaviour change).
      try {
        const g = await fetchBehaviorGraph(userId);
        if (id === reqId.current) setBehaviorGraph(g);
      } catch { /* degrade */ }

      // Library-backed Best Next Actions (best-effort; [] when no linked session or no
      // library match → callers fall back to local heuristics, no behaviour change).
      try {
        const r = await fetch(`/api/career/next-actions/${userId}`, { headers: authHeader() as HeadersInit, credentials: 'include' });
        if (r.ok) {
          const d = await r.json();
          const acts = Array.isArray(d?.actions) ? (d.actions as BestNextAction[]) : [];
          if (id === reqId.current) setBestNextActions(acts);
        }
      } catch { /* degrade */ }

      // Competency-driven activation (Phase 6, best-effort). Flag OFF => endpoint 503
      // => stays null => brain falls back to its existing heuristics (byte-identical).
      // Adopt ONLY when the backend reports `measurable` (a real measured competency
      // profile backs the scores); not-measurable / cold-start => ignored.
      let adopted = false;
      try {
        const r = await fetch(`/api/career/competency-activation/${userId}`, { headers: authHeader() as HeadersInit, credentials: 'include' });
        if (r.ok) {
          const d = await r.json();
          if (d?.ok && d?.measurable && d?.scores && id === reqId.current) {
            setCompetencyActivation({ measurable: true, scores: d.scores, plan: d.plan, provenance: d.provenance } as CompetencyActivation);
            adopted = true;
          }
        }
      } catch { /* degrade */ }
      // Non-adoption (503 / non-OK / parse failure / not-measurable) MUST clear any
      // activation carried from a prior user/context, or stale competency-driven
      // scores would keep overriding the heuristic fallback (violating byte-identical
      // and risking cross-user leakage). Guarded by reqId so a stale request can't wipe
      // a fresher adoption.
      if (!adopted && id === reqId.current) setCompetencyActivation(null);

      if (id === reqId.current) setLoading(false);
    })();
  }, [userId]);

  // Occupation-aware skill enrichment — additive fetch triggered by target role.
  // Populates `occupationSkills` from the DB graph; on failure the useMemo falls
  // back to the heuristic deriveSkillGaps (no behaviour change).
  const profileTargetRole = profile?.targetRole || profile?.competencyProfile?.targetRole || '';
  useEffect(() => {
    if (!profileTargetRole) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/employability/role-skills?title=${encodeURIComponent(profileTargetRole)}`,
          { credentials: 'include' },
        );
        if (r.ok && !cancelled) {
          const d = await r.json();
          if (Array.isArray(d?.skills) && d.skills.length > 0) {
            setOccupationSkills(d.skills);
          }
        }
      } catch { /* degrade */ }
    })();
    return () => { cancelled = true; };
  }, [profileTargetRole]);

  const brain = useMemo<CareerBrain>(() => {
    const ei = clamp(Number(eiScore) || 0);
    const targetRole =
      (typeof window !== 'undefined' && localStorage.getItem(LS_TARGET_ROLE)) ||
      profile?.targetRole ||
      profile?.competencyProfile?.targetRole ||
      '';

    const currentRole =
      profile?.experience?.find((e: any) => e?.current)?.title ||
      profile?.experience?.[0]?.title ||
      profile?.personal?.headline ||
      'Career professional';

    // Occupation-aware gaps (DB-backed): filter the occupation's canonical skills
    // against what the user already has. Falls back to role-family heuristic when
    // the DB has no mapping for the target role (occupationSkills empty).
    const userSkillSet = new Set<string>(
      [
        ...((profile?.skills?.technical as string[]) || []),
        ...((profile?.skills?.soft as string[]) || []),
      ].map((s) => String(s).toLowerCase().trim()),
    );
    const occupationGaps: BrainSkillGap[] = occupationSkills
      .filter((s) => !userSkillSet.has(s.canonical_name.toLowerCase()))
      .map((s, i) => ({
        skill: s.canonical_name,
        impact: s.importance === 'essential' ? Math.max(92 - i * 2, 60) : s.importance === 'important' ? Math.max(74 - i * 2, 50) : 55,
        category: s.importance === 'essential' ? 'critical' : s.importance === 'important' ? 'important' : 'nice-to-have' as BrainSkillGap['category'],
      }));
    // Phase 6 — competency-driven activation takes PRECEDENCE when measurable.
    // The gap→plan focus_areas (severity-ranked, blocking flagged) become the
    // PRIMARY skill gaps; otherwise fall back to occupation-graph then heuristic.
    const act = competencyActivation;
    const actMeasurable = !!act?.measurable;
    const competencyGaps: BrainSkillGap[] = actMeasurable
      ? (act!.plan?.focus_areas || []).map((f, i) => ({
          skill: f.competency_name || f.competency_id,
          impact: clamp(Math.round(90 - i * 8)),
          category: (f.blocking || /critical|essential/i.test(f.criticality))
            ? 'critical'
            : /important|high/i.test(f.criticality)
              ? 'important'
              : 'nice-to-have',
        }))
      : [];
    const skillGaps =
      competencyGaps.length > 0
        ? competencyGaps
        : occupationGaps.length > 0
          ? occupationGaps
          : deriveSkillGaps(profile, targetRole);
    const topGap = skillGaps[0];

    // Phase 6 score projections (null = not measurable, never a fabricated 0).
    const actReadiness = actMeasurable && act!.scores.career_readiness.measurable
      ? act!.scores.career_readiness.value
      : null;
    const growthScore = actMeasurable && act!.scores.career_growth.measurable ? act!.scores.career_growth.value : null;
    const progressionScore = actMeasurable && act!.scores.role_progression.measurable ? act!.scores.role_progression.value : null;
    const skillGapScore = actMeasurable && act!.scores.skill_gap.measurable ? act!.scores.skill_gap.value : null;

    // Lowest competency dimension = behavioural bottleneck candidate.
    const weakestDim = [...dimensions].sort((a, b) => a.score - b.score)[0];
    const coreBottleneck =
      topGap?.skill
        ? `${topGap.skill} (skill gap)`
        : weakestDim
          ? `${weakestDim.label} (lowest competency)`
          : (profile?.competencyProfile?.completeness ?? 0) < 50
            ? 'Incomplete profile evidence'
            : 'No critical bottleneck detected';

    // Transition probability: EI-anchored, adjusted by gap load and evidence.
    const completeness = clamp(Number(profile?.competencyProfile?.completeness) || 0);
    const gapPenalty = Math.min(30, skillGaps.filter((g) => g.category === 'critical').length * 12);
    const transitionProbability = targetRole
      ? clamp(Math.round(ei * 0.6 + completeness * 0.4 - gapPenalty))
      : clamp(Math.round(ei * 0.7 + completeness * 0.3));

    const marketReadiness = clamp(Math.round(ei * 0.5 + (dimensions.length ? dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length : ei) * 0.5));
    const heuristicInterviewReadiness = clamp(Math.round(ei * 0.55 + completeness * 0.25 + (memPatterns.length ? 20 : 0) * 0.2 * 5));
    // CAPADEX behaviour profile is authoritative for readiness when present; else fall
    // back to the existing EI/completeness heuristic (no behaviour change when absent).
    const interviewReadiness = behaviorProfile ? clamp(behaviorProfile.interviewReadiness) : heuristicInterviewReadiness;

    // Execution style — prefer the adapter's evidence-weighted style; else derive from patterns.
    const patternLabels = memPatterns.map((p) => p.label || p.key);
    const executionStyle =
      behaviorProfile?.executionStyle
      || (patternLabels.find((l) => /cognitive|overthink|analys/i.test(l)) ? 'Reflective analyst — thorough, benefits from time-boxing'
      : patternLabels.find((l) => /paralysis|avoid|hesit/i.test(l)) ? 'Cautious mover — benefits from small committed steps'
      : patternLabels.find((l) => /momentum|action|decisive/i.test(l)) ? 'Fast mover — benefits from validation checkpoints'
      : ei >= 60 ? 'Steady builder — consistent, evidence-led' : 'Emerging explorer — building momentum');

    const behavioralConstraints: string[] = [];
    // Adapter constraints lead (they name the concept + career impact); patterns/signals augment.
    (behaviorProfile?.careerConstraints || []).slice(0, 3).forEach((c) => behavioralConstraints.push(c));
    memPatterns.slice(0, 3).forEach((p) => behavioralConstraints.push(`Watch for: ${p.label || p.key}`));
    memSignals.filter((s) => (s.status === 'suppressed') || Number(s.strength) > 0.8).slice(0, 2)
      .forEach((s) => behavioralConstraints.push(`Recurring signal: ${s.label || s.key}`));
    const dedupedConstraints = Array.from(new Set(behavioralConstraints));
    if (dedupedConstraints.length === 0) dedupedConstraints.push('No behavioural constraints surfaced yet');

    const riskFactors: string[] = [];
    if (completeness < 50) riskFactors.push('Profile evidence below 50% — under-represented strengths');
    if (skillGaps.filter((g) => g.category === 'critical').length >= 2) riskFactors.push('Multiple critical skill gaps for target role');
    const openJobs = (jobs || []).filter((j: any) => !['Accepted', 'Rejected'].includes(j?.status)).length;
    if (openJobs === 0) riskFactors.push('No active applications in flight');
    if (!targetRole) riskFactors.push('No target role set — direction unclear');
    if (memSignals.some((s) => Number(s.strength) > 0.85)) riskFactors.push('A strong recurring behavioural signal needs attention');
    if (riskFactors.length === 0) riskFactors.push('No elevated risks right now');

    const learningPriority = topGap?.skill
      ? `Close "${topGap.skill}" — highest-impact skill for ${targetRole || 'your next role'}`
      : weakestDim
        ? `Strengthen ${weakestDim.label}`
        : 'Add evidence to your profile to sharpen recommendations';

    const fastestWinAction =
      completeness < 40 ? 'Complete your profile to unlock accurate guidance'
      : topGap ? `Add or evidence "${topGap.skill}" this week`
      : openJobs === 0 ? 'Apply to one well-matched role this week'
      : 'Run a competency assessment to refresh your signals';

    const weeklyFocus =
      completeness < 40 ? 'Foundation: build out your profile evidence'
      : skillGaps.some((g) => g.category === 'critical') ? `Close critical gaps for ${targetRole || 'your target'}`
      : openJobs > 0 ? 'Convert active applications into interviews'
      : 'Sustain momentum and broaden opportunities';

    return {
      primaryIdentity: targetRole ? `${currentRole} → ${targetRole}` : String(currentRole),
      currentStage: stageFor(ei),
      targetRole: targetRole || 'Not set',
      transitionProbability,
      coreBottleneck,
      fastestWinAction,
      riskFactors,
      executionStyle,
      behavioralConstraints: dedupedConstraints,
      marketReadiness,
      interviewReadiness,
      learningPriority,
      weeklyFocus,
      skillGaps,
      signals: memSignals,
      patterns: memPatterns,
      dimensions,
      // Phase 6: the competency-driven readiness is PRIMARY when measurable; else
      // fall back to the CAPADEX behaviour profile, else the EI/market heuristic.
      careerReadiness: actReadiness != null ? clamp(actReadiness) : behaviorProfile ? clamp(behaviorProfile.careerReadiness) : marketReadiness,
      learningReadiness: behaviorProfile ? clamp(behaviorProfile.learningReadiness) : clamp(Math.round(ei * 0.5 + completeness * 0.5)),
      executionReadiness: behaviorProfile ? clamp(behaviorProfile.executionReadiness) : clamp(Math.round(ei * 0.6 + completeness * 0.4)),
      leadershipReadiness: behaviorProfile ? clamp(behaviorProfile.leadershipReadiness) : clamp(Math.round(ei * 0.5 + transitionProbability * 0.5)),
      behaviorProfile,
      behaviorGraph,
      bestNextActions,
      competencyActivation,
      growthScore,
      progressionScore,
      skillGapScore,
    };
  }, [profile, jobs, goals, eiScore, dimensions, memSignals, memPatterns, behaviorProfile, behaviorGraph, bestNextActions, occupationSkills, competencyActivation]);

  return { brain, loading };
}
