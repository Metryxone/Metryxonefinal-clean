// ============================================================================
// MetryxOne — Career Intelligence
// Pure deterministic functions. All scores derive from the user's actual
// profile + jobs + goals data + the curated market catalog. No randomness,
// no fake data — what you see is reproducible from inputs.
// ============================================================================
import {
  MARKET_CATALOG, COMPETENCY_DOMAINS, type MarketRole, findRoleByTitle,
} from '@/data/marketCatalog';
import { INTERVENTIONS, type Intervention } from '@/data/interventionCatalog';

/* ──────────────────────────────────────────────────────────────────────── */
/*  Profile shape (subset we actually use)                                  */
/* ──────────────────────────────────────────────────────────────────────── */
export interface CareerProfile {
  personal?: { name?: string; location?: string; linkedin?: string; github?: string };
  summary?: string;
  experience?: { title?: string; company?: string; years?: number; current?: boolean }[];
  skills?: { technical?: string[]; soft?: string[] };
  education?: unknown[];
  certifications?: unknown[];
  projects?: unknown[];
  competencyProfile?: { completeness?: number };
}

export interface JobLike {
  _id?: string; role?: string; company?: string; matchScore?: number; status?: string;
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Skill / level inference                                                 */
/* ──────────────────────────────────────────────────────────────────────── */

/** Normalize a skill keyword: lowercase, trim, strip punctuation, collapse spaces */
function norm(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9+#.\s-]/g, '').replace(/\s+/g, ' ');
}

/** Build set of normalized user skill tokens (technical + soft) */
export function getUserSkillSet(profile: CareerProfile | null | undefined): Set<string> {
  const out = new Set<string>();
  const tech = profile?.skills?.technical ?? [];
  const soft = profile?.skills?.soft ?? [];
  [...tech, ...soft].forEach(s => {
    if (typeof s !== 'string') return;
    const n = norm(s);
    if (!n) return;
    out.add(n);
    // Also add tokens for multi-word skills
    n.split(/[\s/]+/).forEach(t => { if (t.length > 1) out.add(t); });
  });
  return out;
}

/**
 * Infer a 0-5 proficiency for each competency from profile signals:
 *  - technical skills count toward technical/analytical competencies
 *  - certifications nudge cloud/security/process
 *  - experience years nudge leadership/execution
 *  - projects nudge programming/design-thinking
 *  - profile completeness scales the ceiling
 */
export function inferCompetencyLevels(profile: CareerProfile | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  COMPETENCY_DOMAINS.forEach(c => { out[c.id] = 0; });
  if (!profile) return out;

  const skills = getUserSkillSet(profile);
  const techCount = (profile.skills?.technical ?? []).length;
  const softCount = (profile.skills?.soft ?? []).length;
  const certCount = (profile.certifications ?? []).length;
  const projCount = (profile.projects ?? []).length;
  const expYears = (profile.experience ?? []).reduce((s, e) => s + (Number(e?.years) || 1), 0);
  const completeness = profile.competencyProfile?.completeness ?? 0;
  const ceil = Math.min(5, 1 + Math.floor(completeness / 22)); // 0%→1, 22%→2, ... 100%→5

  // Skill-keyword → competency rules
  const RULES: { skills: string[]; comp: string; weight: number }[] = [
    { skills: ['javascript','typescript','python','java','go','rust','c++','php','ruby','swift','kotlin'], comp: 'programming', weight: 1.2 },
    { skills: ['react','vue','angular','next','svelte','nodejs','express','django','flask','spring','rails'], comp: 'programming', weight: 0.8 },
    { skills: ['microservices','distributed','event-driven','architecture','grpc','kafka','queue'], comp: 'systems-design', weight: 1.2 },
    { skills: ['aws','gcp','azure','kubernetes','docker','terraform','helm','ansible','ci-cd','jenkins'], comp: 'cloud', weight: 1.2 },
    { skills: ['airflow','spark','dbt','snowflake','databricks','etl','data-warehouse','kafka'], comp: 'data-engineering', weight: 1.5 },
    { skills: ['security','iam','penetration','threat','siem','sast','dast','owasp'], comp: 'security', weight: 1.5 },
    { skills: ['sql','excel','tableau','powerbi','looker','pandas','analytics'], comp: 'data-analysis', weight: 1.0 },
    { skills: ['ml','machine-learning','tensorflow','pytorch','scikit-learn','statistics','llm','rag','nlp','xgboost'], comp: 'statistics', weight: 1.3 },
    { skills: ['business','strategy','market','revenue','pricing','okr'], comp: 'business-acumen', weight: 1.0 },
    { skills: ['user-research','interviews','usability','dovetail','survey'], comp: 'research', weight: 1.5 },
    { skills: ['writing','copywriting','content','blogging','technical-writing'], comp: 'writing', weight: 1.2 },
    { skills: ['presentation','public-speaking','keynote','pitching'], comp: 'presentation', weight: 1.5 },
    { skills: ['stakeholder','client','vendor','executive','communication'], comp: 'stakeholder-mgmt', weight: 1.0 },
    { skills: ['leadership','people-management','team-lead','mentor','coaching'], comp: 'people-mgmt', weight: 1.3 },
    { skills: ['strategy','vision','roadmap','market-strategy'], comp: 'strategy', weight: 1.3 },
    { skills: ['mentoring','coaching','onboarding'], comp: 'mentoring', weight: 1.5 },
    { skills: ['design-thinking','user-centered','journey-mapping','wireframing','prototyping'], comp: 'design-thinking', weight: 1.5 },
    { skills: ['figma','sketch','adobe-xd','illustrator','photoshop','design-systems','typography'], comp: 'visual-design', weight: 1.3 },
    { skills: ['storytelling','narrative','case-study'], comp: 'storytelling', weight: 1.5 },
    { skills: ['pmp','prince2','agile','scrum','kanban','jira','asana','project-management'], comp: 'project-mgmt', weight: 1.2 },
    { skills: ['six-sigma','lean','process-improvement','sla','operations'], comp: 'process', weight: 1.5 },
    { skills: ['negotiation','closing','sales','deal'], comp: 'negotiation', weight: 1.5 },
  ];

  for (const r of RULES) {
    const hits = r.skills.reduce((n, k) => n + (skills.has(k) ? 1 : 0), 0);
    if (hits > 0) {
      out[r.comp] = Math.min(ceil, (out[r.comp] || 0) + hits * r.weight);
    }
  }

  // Volume bumps
  if (techCount >= 3) out['programming'] = Math.max(out['programming'] || 0, 2);
  if (techCount >= 6) out['programming'] = Math.max(out['programming'] || 0, 3);
  if (techCount >= 10) out['programming'] = Math.max(out['programming'] || 0, 4);
  if (certCount >= 1) out['cloud'] = Math.max(out['cloud'] || 0, 2);
  if (certCount >= 3) out['process'] = Math.max(out['process'] || 0, 3);
  if (projCount >= 1) out['design-thinking'] = Math.max(out['design-thinking'] || 0, 1);
  if (projCount >= 3) out['programming'] = Math.max(out['programming'] || 0, 3);
  if (expYears >= 2) out['collaboration'] = Math.max(out['collaboration'] || 0, 2);
  if (expYears >= 4) { out['people-mgmt'] = Math.max(out['people-mgmt'] || 0, 2); out['stakeholder-mgmt'] = Math.max(out['stakeholder-mgmt'] || 0, 3); }
  if (expYears >= 7) { out['strategy'] = Math.max(out['strategy'] || 0, 3); out['mentoring'] = Math.max(out['mentoring'] || 0, 3); }
  if (softCount >= 3) out['collaboration'] = Math.max(out['collaboration'] || 0, 3);

  // Cap and round to 1 decimal
  Object.keys(out).forEach(k => { out[k] = Math.round(Math.min(5, out[k]) * 10) / 10; });
  return out;
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Fitment & switchability                                                 */
/* ──────────────────────────────────────────────────────────────────────── */

export interface FitmentBreakdown {
  fitScore: number;          // 0-100
  skillMatch: number;        // 0-100  keyword overlap
  competencyMatch: number;   // 0-100  level coverage
  experienceMatch: number;   // 0-100  years vs role expectation
  hireProbability: number;   // 0-100  logistic blend
  matchedSkills: string[];
  missingSkills: string[];   // top 5 missing critical skills
  topGapCompetency?: { id: string; label: string; gap: number };
}

/** Compute a deterministic fitment between a profile and a target market role. */
export function computeFitment(
  profile: CareerProfile | null | undefined,
  role: MarketRole,
  levels?: Record<string, number>
): FitmentBreakdown {
  const userSkills = getUserSkillSet(profile);
  const lvls = levels ?? inferCompetencyLevels(profile);

  // Skill match — fraction of role's critical skills present
  const matched: string[] = [];
  const missing: string[] = [];
  role.skills.forEach(s => {
    const n = norm(s);
    if (userSkills.has(n) || [...userSkills].some(u => u.includes(n) || n.includes(u))) matched.push(s);
    else missing.push(s);
  });
  const skillMatch = Math.round((matched.length / Math.max(1, role.skills.length)) * 100);

  // Competency match — sum(min(actual, required)) / sum(required) * 100
  let need = 0, have = 0;
  let topGap: { id: string; label: string; gap: number } | undefined;
  role.competencies.forEach(rc => {
    const actual = lvls[rc.id] ?? 0;
    need += rc.required;
    have += Math.min(actual, rc.required);
    const gap = rc.required - actual;
    if (gap > 0 && (!topGap || gap > topGap.gap)) {
      const c = COMPETENCY_DOMAINS.find(c => c.id === rc.id);
      if (c) topGap = { id: c.id, label: c.label, gap: Math.round(gap * 10) / 10 };
    }
  });
  const competencyMatch = need > 0 ? Math.round((have / need) * 100) : 0;

  // Experience match — assumes role expects 4 years for required:4 etc.
  const expYears = (profile?.experience ?? []).reduce((s, e) => s + (Number(e?.years) || 1), 0);
  const expectedYears = Math.max(2, role.competencies.reduce((m, c) => Math.max(m, c.required), 0));
  const experienceMatch = Math.round(Math.min(100, (expYears / expectedYears) * 100));

  // Composite — weighted blend
  const fitScore = Math.round(skillMatch * 0.45 + competencyMatch * 0.40 + experienceMatch * 0.15);

  // Hire probability — simple logistic of fitScore + completeness penalty
  const completeness = profile?.competencyProfile?.completeness ?? 0;
  const z = (fitScore - 55) / 14 + (completeness - 50) / 60;
  const hireProbability = Math.round(100 / (1 + Math.exp(-z)));

  return {
    fitScore, skillMatch, competencyMatch, experienceMatch, hireProbability,
    matchedSkills: matched.slice(0, 8),
    missingSkills: missing.slice(0, 5),
    topGapCompetency: topGap,
  };
}

/** Switchability: how easily current → target role given skill overlap + adjacency */
export function switchability(currentRoleId: string | null | undefined, targetId: string): number {
  if (!currentRoleId) return 50;
  if (currentRoleId === targetId) return 100;
  const cur = MARKET_CATALOG.find(r => r.id === currentRoleId);
  const tgt = MARKET_CATALOG.find(r => r.id === targetId);
  if (!cur || !tgt) return 45;
  const adjacent = cur.adjacentRoles.includes(targetId) || tgt.adjacentRoles.includes(currentRoleId);
  const skillOverlap = cur.skills.filter(s => tgt.skills.includes(s)).length / Math.max(1, tgt.skills.length);
  const compOverlap = cur.competencies.filter(c => tgt.competencies.some(t => t.id === c.id)).length /
                      Math.max(1, tgt.competencies.length);
  const familyMatch = cur.family === tgt.family ? 1 : 0;
  return Math.round(((skillOverlap * 0.45 + compOverlap * 0.35 + familyMatch * 0.10 + (adjacent ? 0.10 : 0)) * 100));
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Future-role recommender                                                 */
/* ──────────────────────────────────────────────────────────────────────── */

export interface FutureRoleRec {
  role: MarketRole;
  fitment: FitmentBreakdown;
  switch: number;           // 0-100
  etaMonths: number;        // months to be hire-ready
  /** Composite score used for ranking */
  score: number;
}

/** Detect the user's current role from their most recent / current experience entry. */
export function detectCurrentRole(profile: CareerProfile | null | undefined): MarketRole | undefined {
  const exps = profile?.experience ?? [];
  if (!exps.length) return undefined;
  const cur = exps.find(e => e?.current) ?? exps[0];
  return findRoleByTitle(cur?.title ?? '');
}

/**
 * Behavioural-readiness context (subset of CareerBehaviorProfile). Optional, additive:
 * when supplied, the Career-OS engines nudge their rankings to reflect how behaviourally
 * ready the user is to execute a move. Absent → engines behave exactly as before.
 */
export interface BehaviorContext {
  careerReadiness?: number;     // 0–100
  interviewReadiness?: number;  // 0–100
  learningReadiness?: number;   // 0–100
  executionReadiness?: number;  // 0–100
  leadershipReadiness?: number; // 0–100
}
function readiness(v: number | undefined, fallback = 50): number {
  return Number.isFinite(v as number) ? (v as number) : fallback;
}
function isLeadershipRole(role: MarketRole): boolean {
  return /lead|manager|head|director|chief|principal|vp|executive/i.test(`${role.title} ${role.family ?? ''}`);
}
/** Pipeline momentum 0–1 — how "in motion" an application is (terminal stages → 0). */
function stageMomentum(status?: string): number {
  const s = (status ?? '').toLowerCase();
  if (/reject|declin|withdraw|accept|hired/.test(s)) return 0;    // terminal — no point re-prioritising
  if (/interview|onsite|final/.test(s)) return 1;
  if (/offer/.test(s)) return 0.9;
  if (/screen|phone|assessment|test/.test(s)) return 0.7;
  if (/applied|submitted/.test(s)) return 0.55;
  if (/saved|wishlist|lead|prospect/.test(s)) return 0.1;
  return 0.4;
}

/** Recommend top N future roles for this user based on demand × switchability × fit. */
export function recommendFutureRoles(
  profile: CareerProfile | null | undefined,
  topN = 6,
  behavior?: BehaviorContext,
): FutureRoleRec[] {
  const levels = inferCompetencyLevels(profile);
  const current = detectCurrentRole(profile);
  // Behavioural readiness modifiers (centred on 50 → no net effect at neutral).
  const careerMod = behavior ? (readiness(behavior.careerReadiness) - 50) * 0.04 : 0;
  const leadMod = behavior ? (readiness(behavior.leadershipReadiness) - 50) * 0.10 : 0;
  const recs: FutureRoleRec[] = MARKET_CATALOG.map(role => {
    const fitment = computeFitment(profile, role, levels);
    const sw = switchability(current?.id, role.id);
    // ETA: gap to fitness 80, assuming ~4 EI points/week of focused effort
    const fitGap = Math.max(0, 80 - fitment.fitScore);
    const etaMonths = Math.max(1, Math.round((fitGap / 4) / 4)); // 4 weeks/month
    const baseScore =
      role.demandScore * 0.30 +
      role.growth36mo * 0.20 +
      sw * 0.25 +
      fitment.fitScore * 0.20 +
      (100 - role.automationRisk) * 0.05;
    // Decision-fatigue / low leadership readiness pushes leadership roles down; strong
    // overall behavioural readiness lifts all moves. Bounded nudge (career ±2, leadership
    // ±5 pts) — it can only reorder near-ties, never override a clear fit gap.
    const behaviorAdj = careerMod + (isLeadershipRole(role) ? leadMod : 0);
    const score = Math.round(baseScore + behaviorAdj);
    return { role, fitment, switch: sw, etaMonths, score };
  });
  recs.sort((a, b) => b.score - a.score);
  // Exclude the user's current role from "future" recommendations
  return recs.filter(r => !current || r.role.id !== current.id).slice(0, topN);
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Job fitment (for actual user-tracked jobs)                              */
/* ──────────────────────────────────────────────────────────────────────── */

export interface RankedJob {
  job: JobLike;
  role?: MarketRole;
  fitment?: FitmentBreakdown;
  fitScore: number;
}

export function rankJobsForUser(
  profile: CareerProfile | null | undefined,
  jobs: JobLike[],
  behavior?: BehaviorContext,
): RankedJob[] {
  const levels = inferCompetencyLevels(profile);
  // Low execution readiness → the binding constraint is follow-through, not fit, so favour
  // applications already IN MOTION (per-job pipeline momentum, independent of fitScore, so
  // it genuinely reorders rather than monotonically rescaling). At neutral/high readiness
  // the boost is 0 → ordering is identical to the legacy fit-only sort. fitScore unchanged.
  const followThrough = behavior ? Math.max(0, (50 - readiness(behavior.executionReadiness)) / 50) : 0;
  // Weight 12 → at the lowest execution readiness an in-motion application can leapfrog one
  // up to ~12 fit-points higher; tapers to 0 at readiness ≥ 50 (legacy fit-only ordering).
  const rankScore = (fitScore: number, status?: string) =>
    fitScore + followThrough * 12 * stageMomentum(status);
  return jobs.map(j => {
    const role = findRoleByTitle(j.role ?? '');
    if (role) {
      const f = computeFitment(profile, role, levels);
      return { job: j, role, fitment: f, fitScore: f.fitScore };
    }
    return { job: j, fitScore: typeof j.matchScore === 'number' ? j.matchScore : 50 };
  }).sort((a, b) =>
    (rankScore(b.fitScore, b.job?.status) - rankScore(a.fitScore, a.job?.status)) || b.fitScore - a.fitScore);
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  IDP — pick interventions that close the largest gaps                    */
/* ──────────────────────────────────────────────────────────────────────── */

export interface IDPItem extends Intervention {
  gapClosed: { competencyId: string; competencyLabel: string; gap: number };
  rank: number;
}

/** Build an IDP for a target role from current competency levels. */
export function buildIDP(
  profile: CareerProfile | null | undefined,
  targetRole: MarketRole,
  maxItems = 7,
  behavior?: BehaviorContext,
): IDPItem[] {
  const levels = inferCompetencyLevels(profile);
  // Low execution readiness → bias the plan toward lower-effort, achievable steps so the
  // learner can build momentum; high readiness keeps the pure ROI ordering. Neutral → none.
  const exec = behavior ? readiness(behavior.executionReadiness) : 50;
  const effortBias = Math.max(0, (50 - exec) / 50); // 0 at ≥50, →1 as readiness → 0
  const roi = (iv: Intervention) =>
    (iv.eiLift / Math.max(1, iv.hours)) - effortBias * (iv.hours * 0.15);
  // Compute gaps sorted descending
  const gaps = targetRole.competencies
    .map(rc => ({
      id: rc.id,
      label: COMPETENCY_DOMAINS.find(c => c.id === rc.id)?.label ?? rc.id,
      required: rc.required,
      actual: levels[rc.id] ?? 0,
      gap: rc.required - (levels[rc.id] ?? 0),
    }))
    .filter(g => g.gap > 0.2)
    .sort((a, b) => b.gap - a.gap);

  const picked: IDPItem[] = [];
  const usedIds = new Set<string>();

  // For each gap, pull the highest-ROI intervention not already picked
  for (const g of gaps) {
    const candidates = INTERVENTIONS
      .filter(iv => iv.competencies.includes(g.id) && !usedIds.has(iv.id))
      .sort((a, b) => roi(b) - roi(a));
    // Pull top 2 per gap to ensure diversity
    candidates.slice(0, Math.max(1, Math.ceil(maxItems / Math.max(1, gaps.length)))).forEach(iv => {
      if (picked.length < maxItems) {
        usedIds.add(iv.id);
        picked.push({
          ...iv,
          gapClosed: { competencyId: g.id, competencyLabel: g.label, gap: Math.round(g.gap * 10) / 10 },
          rank: picked.length + 1,
        });
      }
    });
    if (picked.length >= maxItems) break;
  }

  // If we still have room (small gap list), pad with high-impact generic items
  if (picked.length < maxItems) {
    INTERVENTIONS
      .filter(iv => !usedIds.has(iv.id))
      .sort((a, b) => b.eiLift - a.eiLift)
      .slice(0, maxItems - picked.length)
      .forEach(iv => {
        const firstComp = iv.competencies[0];
        const compLabel = COMPETENCY_DOMAINS.find(c => c.id === firstComp)?.label ?? firstComp;
        picked.push({
          ...iv,
          gapClosed: { competencyId: firstComp, competencyLabel: compLabel, gap: 0 },
          rank: picked.length + 1,
        });
      });
  }

  return picked.slice(0, maxItems);
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Visibility score — how visible to recruiters                            */
/* ──────────────────────────────────────────────────────────────────────── */

export interface VisibilityBreakdown {
  score: number;          // 0-100
  band: 'hidden' | 'low' | 'medium' | 'high' | 'top';
  drivers: { label: string; pts: number; max: number; tip?: string }[];
}

export function computeVisibility(
  profile: CareerProfile | null | undefined,
  eiScore: number,
  isOpenToOpportunities: boolean,
): VisibilityBreakdown {
  const completeness = profile?.competencyProfile?.completeness ?? 0;
  const techCount = (profile?.skills?.technical ?? []).length;
  const expCount = (profile?.experience ?? []).length;
  const certCount = (profile?.certifications ?? []).length;
  const projCount = (profile?.projects ?? []).length;
  const hasLinkedin = !!profile?.personal?.linkedin;
  const hasSummary = !!profile?.summary;

  const drivers = [
    { label: 'Profile completeness',     pts: Math.round((completeness / 100) * 20),                max: 20, tip: completeness < 80 ? 'Fill remaining sections' : undefined },
    { label: 'Employability Index',      pts: Math.round((eiScore / 100) * 25),                     max: 25, tip: eiScore < 60 ? 'Take/retake assessment' : undefined },
    { label: 'Skills depth',             pts: Math.min(15, techCount * 2),                          max: 15, tip: techCount < 5 ? 'Add more technical skills' : undefined },
    { label: 'Experience signal',        pts: Math.min(15, expCount * 5),                           max: 15, tip: expCount === 0 ? 'Add roles or projects' : undefined },
    { label: 'Credentials & projects',   pts: Math.min(10, certCount * 3 + projCount * 2),          max: 10, tip: (certCount + projCount) < 2 ? 'Add a cert or project' : undefined },
    { label: 'External profile linked',  pts: hasLinkedin ? 5 : 0,                                  max: 5,  tip: !hasLinkedin ? 'Add LinkedIn URL' : undefined },
    { label: 'Professional summary',     pts: hasSummary ? 5 : 0,                                   max: 5,  tip: !hasSummary ? 'Add a 2-line bio' : undefined },
    { label: 'Open to opportunities',    pts: isOpenToOpportunities ? 5 : 0,                        max: 5,  tip: !isOpenToOpportunities ? 'Toggle "open to opportunities"' : undefined },
  ];
  const score = drivers.reduce((s, d) => s + d.pts, 0);
  const band: VisibilityBreakdown['band'] =
    score >= 85 ? 'top' : score >= 65 ? 'high' : score >= 45 ? 'medium' : score >= 25 ? 'low' : 'hidden';
  return { score, band, drivers };
}

/** Synthetic recruiter view counter — derived deterministically from profile + EI.
 *  Replace with real `employer_views` query when the recruiter-side ships. */
export function estimateRecruiterViews(
  profile: CareerProfile | null | undefined,
  eiScore: number,
  visibility: number,
): { thisWeek: number; trend: 'up' | 'down' | 'flat' } {
  if (visibility < 25) return { thisWeek: 0, trend: 'flat' };
  const exp = (profile?.experience ?? []).length;
  const techCount = (profile?.skills?.technical ?? []).length;
  const base = Math.round(visibility * 0.18 + eiScore * 0.08 + techCount * 0.6 + exp * 1.2);
  const completeness = profile?.competencyProfile?.completeness ?? 0;
  return {
    thisWeek: Math.max(0, base),
    trend: completeness >= 70 ? 'up' : completeness >= 40 ? 'flat' : 'down',
  };
}
