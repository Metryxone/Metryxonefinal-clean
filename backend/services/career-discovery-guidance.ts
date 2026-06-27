/**
 * MX-302B — Career Discovery: AI Guidance (backend, compose-only)
 * ----------------------------------------------------------------------------
 * The "guidance" surface of Career Discovery. It COMPOSES the existing
 * recommendation / roadmap / development engines into a single guidance
 * envelope, then layers a conversational coach on top.
 *
 * HONEST AI DEGRADATION (core requirement): when no LLM key is configured
 * (OPENAI_API_KEY / AI_INTEGRATIONS_OPENAI_API_KEY / EMERGENT_LLM_KEY all
 * unset, or the proxy unreachable) the coach falls back to DETERMINISTIC,
 * rule-based guidance derived from the composed engine output. The response
 * always declares which mode produced it (`ai_mode`, `ai_available`) — we never
 * pretend rule-based output is LLM output, and we never fabricate.
 *
 * never-throws: any composed engine failure degrades to an honest empty section.
 */
import type { Pool } from 'pg';
import { buildCareerRecommendations } from './career-recommendation-aggregator';
import { buildCareerRoadmap } from './career-roadmap-engine';
import { buildCareerDevelopment } from './career-development-engine';
import { listMarketDemands } from './market-intelligence';
import { getAIConfig, chatJSON } from './aiClient';
import type { DiscoveryProfile } from './career-discovery-orchestrator';

export type AiMode = 'llm' | 'rule_based';

/** True only when an LLM key is configured. (Reachability is checked lazily at
 *  call time; this is the cheap pre-check used for the honest mode label.) */
export function isLLMConfigured(): boolean {
  const { apiKey } = getAIConfig();
  return !!(apiKey || process.env.EMERGENT_LLM_KEY);
}

export interface GuidanceMessage {
  role: 'coach';
  headline: string;
  body: string;
  /** Concrete, ordered next actions. */
  actions: string[];
}

export interface DiscoveryGuidance {
  ok: boolean;
  ai_available: boolean;
  ai_mode: AiMode;
  ai_note: string;
  coach: GuidanceMessage;
  /** Composed recommendation groups (read-only). */
  recommendations: any[];
  /** Composed roadmap milestones (read-only). */
  roadmap_milestones: any[];
  /** Composed development streams (read-only). */
  development_streams: any[];
  /** Short nudges derived deterministically from the composed output. */
  nudges: string[];
  /** "Today" focus — the single highest-leverage next action + context. */
  daily_brief: { headline: string; focus: string | null; items: string[] };
  /** This week's concrete goals (deterministic from recs/roadmap). */
  weekly_goals: string[];
  /** Monthly roadmap framing — near-term milestones from the roadmap engine. */
  monthly_roadmap: { horizon: string; milestones: Array<{ title: string; detail: string | null }> };
  /** Competency advice — development streams framed as concrete advice. */
  competency_advice: Array<{ area: string; advice: string }>;
  /** Industry trends from the seeded labor-market intelligence (honest empty). */
  industry_trends: { measurable: boolean; rising: string[]; declining: string[]; emerging: string[]; note?: string };
  coverage: { recommendations: boolean; roadmap: boolean; development: boolean; industry_trends: boolean };
  generated_at: string;
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}

/** Build the deterministic, rule-based coach message from composed output. */
function ruleBasedCoach(
  profile: DiscoveryProfile | null,
  recEnv: any,
  roadmapEnv: any,
): GuidanceMessage {
  const topMatch = profile?.top_matches?.[0] ?? null;
  const topValue = profile?.values?.top_values?.[0] ?? null;
  const milestones: any[] = Array.isArray(roadmapEnv?.milestones) ? roadmapEnv.milestones : [];
  const recGroups: any[] = Array.isArray(recEnv?.groups) ? recEnv.groups : [];

  const actions: string[] = [];
  // Pull the first few recommendation targets as concrete next steps.
  for (const g of recGroups) {
    for (const item of (Array.isArray(g?.items) ? g.items : [])) {
      const target = item?.target ?? item?.title;
      if (target) actions.push(String(target));
      if (actions.length >= 3) break;
    }
    if (actions.length >= 3) break;
  }
  if (actions.length === 0 && milestones.length) {
    for (const m of milestones.slice(0, 3)) {
      if (m?.title) actions.push(String(m.title));
    }
  }
  if (actions.length === 0) {
    actions.push('Complete the competency assessment to unlock personalised role matches.');
    actions.push('Fill out your profile (education, experience, skills) to improve match accuracy.');
  }

  const parts: string[] = [];
  if (topMatch) {
    const pct = topMatch.match_percentage != null ? ` (${Math.round(topMatch.match_percentage)}% fit)` : '';
    parts.push(`Your strongest current match is ${topMatch.role_name}${pct}.`);
  } else {
    parts.push(`We don't have enough signal yet to rank role matches — that's the first thing to fix.`);
  }
  if (topValue) {
    parts.push(`Your top work value is "${topValue.label}", so weigh roles that protect that.`);
  }
  parts.push(`Here are the next steps that will move you forward fastest.`);

  return {
    role: 'coach',
    headline: topMatch ? `Let's build toward ${topMatch.role_name}` : `Let's get your discovery profile measurable`,
    body: parts.join(' '),
    actions: actions.slice(0, 5),
  };
}

/** Try the LLM coach; return null if unavailable/unreachable (caller falls back). */
async function llmCoach(
  profile: DiscoveryProfile | null,
  recEnv: any,
  roadmapEnv: any,
): Promise<GuidanceMessage | null> {
  try {
    const context = {
      top_matches: profile?.top_matches ?? [],
      top_values: profile?.values?.top_values ?? [],
      compatibility_score: profile?.compatibility_score ?? null,
      recommendation_count: Array.isArray(recEnv?.groups) ? recEnv.groups.length : 0,
      milestones: (Array.isArray(roadmapEnv?.milestones) ? roadmapEnv.milestones : []).slice(0, 5).map((m: any) => m?.title).filter(Boolean),
    };
    const out = await chatJSON({
      system:
        'You are a supportive, honest career discovery coach. Use ONLY the supplied context. ' +
        'Never invent roles, scores or facts not present. If signal is missing, say so plainly. ' +
        'Outputs are developmental signals only — never hiring/promotion/suitability predictions. ' +
        'Respond as strict JSON: {"headline": string, "body": string, "actions": string[] }.',
      user: `Context:\n${JSON.stringify(context)}\n\nWrite an encouraging 2-3 sentence body and 3-5 concrete next actions.`,
      max_tokens: 500,
      temperature: 0.6,
    });
    if (out && typeof out.headline === 'string' && typeof out.body === 'string' && Array.isArray(out.actions)) {
      return {
        role: 'coach',
        headline: out.headline,
        body: out.body,
        actions: out.actions.map((a: unknown) => String(a)).slice(0, 5),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Deterministic nudges from composed output (used regardless of AI mode). */
function buildNudges(profile: DiscoveryProfile | null, devEnv: any): string[] {
  const nudges: string[] = [];
  const streams: any[] = Array.isArray(devEnv?.development_plan?.streams) ? devEnv.development_plan.streams : [];
  for (const s of streams.slice(0, 3)) {
    if (s?.label) nudges.push(`Focus this week on your ${String(s.label).toLowerCase()} development stream.`);
  }
  if (profile && !profile.coverage.values) {
    nudges.push('Complete the Work Values inventory — it takes about 2 minutes and sharpens your matches.');
  }
  if (profile && !profile.coverage.matches) {
    nudges.push('Finish the competency assessment to unlock role matches.');
  }
  return nudges.slice(0, 5);
}

/** Concrete recommendation/milestone targets, in priority order. */
function targetsFrom(recEnv: any, roadmapEnv: any): string[] {
  const out: string[] = [];
  for (const g of (Array.isArray(recEnv?.groups) ? recEnv.groups : [])) {
    for (const item of (Array.isArray(g?.items) ? g.items : [])) {
      const t = item?.target ?? item?.title;
      if (t) out.push(String(t));
    }
  }
  for (const m of (Array.isArray(roadmapEnv?.milestones) ? roadmapEnv.milestones : [])) {
    if (m?.title) out.push(String(m.title));
  }
  return out;
}

/** Deterministic daily brief: today's single highest-leverage focus. */
function buildDailyBrief(profile: DiscoveryProfile | null, recEnv: any, roadmapEnv: any): DiscoveryGuidance['daily_brief'] {
  const targets = targetsFrom(recEnv, roadmapEnv);
  const topMatch = profile?.top_matches?.[0] ?? null;
  const focus = targets[0] ?? (profile && !profile.coverage.matches
    ? 'Complete the competency assessment to unlock role matches.'
    : null);
  const headline = topMatch
    ? `Today: one step toward ${topMatch.role_name}`
    : 'Today: make your discovery profile measurable';
  return { headline, focus, items: targets.slice(0, 3) };
}

/** Deterministic weekly goals from composed recommendation/roadmap targets. */
function buildWeeklyGoals(profile: DiscoveryProfile | null, recEnv: any, roadmapEnv: any): string[] {
  const goals = targetsFrom(recEnv, roadmapEnv).slice(0, 3);
  if (goals.length === 0) {
    if (profile && !profile.coverage.values) goals.push('Complete the Work Values inventory.');
    if (profile && !profile.coverage.matches) goals.push('Finish the competency assessment to unlock role matches.');
    if (goals.length === 0) goals.push('Fill out your profile (education, experience, skills) to sharpen guidance.');
  }
  return goals;
}

/** Monthly roadmap framing — near-term milestones from the roadmap engine. */
function buildMonthlyRoadmap(roadmapEnv: any): DiscoveryGuidance['monthly_roadmap'] {
  const milestones = (Array.isArray(roadmapEnv?.milestones) ? roadmapEnv.milestones : [])
    .slice(0, 5)
    .map((m: any) => ({ title: String(m?.title ?? 'Milestone'), detail: m?.detail ?? m?.description ?? null }));
  return { horizon: '30-day', milestones };
}

/** Competency advice — development streams framed as concrete advice. */
function buildCompetencyAdvice(devEnv: any): Array<{ area: string; advice: string }> {
  const streams: any[] = Array.isArray(devEnv?.development_plan?.streams) ? devEnv.development_plan.streams : [];
  return streams.slice(0, 5).map((s) => ({
    area: String(s?.label ?? s?.competency ?? 'Development area'),
    advice: String(s?.recommendation ?? s?.summary ?? `Prioritise focused practice in your ${String(s?.label ?? 'development').toLowerCase()} stream.`),
  }));
}

/** Industry trends from the seeded labor-market intelligence (honest empty). */
async function buildIndustryTrends(pool: Pool): Promise<DiscoveryGuidance['industry_trends']> {
  try {
    const rows: any[] = await listMarketDemands(pool, 'IN', 100);
    if (!rows.length) {
      return { measurable: false, rising: [], declining: [], emerging: [], note: 'No seeded labor-market data yet (honest empty, not zero).' };
    }
    const name = (r: any) => String(r.canonical_title ?? r.role_family ?? r.occupation_id ?? 'Role');
    const rising = rows.filter((r) => r.hiring_trend === 'rising').slice(0, 6).map(name);
    const declining = rows.filter((r) => r.hiring_trend === 'declining').slice(0, 6).map(name);
    const emerging = rows
      .filter((r) => r.future_relevance_score != null)
      .sort((a, b) => Number(b.future_relevance_score) - Number(a.future_relevance_score))
      .slice(0, 6)
      .map(name);
    return { measurable: true, rising, declining, emerging };
  } catch {
    return { measurable: false, rising: [], declining: [], emerging: [], note: 'Labor-market data unavailable (honest empty).' };
  }
}

/**
 * Build the full guidance envelope. `profile` is passed in (already composed by
 * the orchestrator) so we don't recompute it.
 */
export async function buildDiscoveryGuidance(
  pool: Pool,
  userId: string,
  profile: DiscoveryProfile | null,
): Promise<DiscoveryGuidance> {
  const [recEnv, roadmapEnv, devEnv, industry_trends] = await Promise.all([
    safe(() => buildCareerRecommendations(pool, userId)),
    safe(() => buildCareerRoadmap(pool, userId)),
    safe(() => buildCareerDevelopment(pool, userId)),
    buildIndustryTrends(pool),
  ]);

  const configured = isLLMConfigured();
  let coach: GuidanceMessage | null = null;
  let mode: AiMode = 'rule_based';
  let aiAvailable = false;

  if (configured) {
    coach = await llmCoach(profile, recEnv, roadmapEnv);
    if (coach) { mode = 'llm'; aiAvailable = true; }
  }
  if (!coach) {
    coach = ruleBasedCoach(profile, recEnv, roadmapEnv);
    mode = 'rule_based';
  }

  const ai_note = aiAvailable
    ? 'Guidance generated with the configured AI model.'
    : configured
      ? 'AI key is configured but the model was unreachable — showing deterministic rule-based guidance.'
      : 'No AI key configured — showing deterministic rule-based guidance derived from your composed profile.';

  return {
    ok: true,
    ai_available: aiAvailable,
    ai_mode: mode,
    ai_note,
    coach,
    recommendations: Array.isArray((recEnv as any)?.groups) ? (recEnv as any).groups : [],
    roadmap_milestones: Array.isArray((roadmapEnv as any)?.milestones) ? (roadmapEnv as any).milestones : [],
    development_streams: Array.isArray((devEnv as any)?.development_plan?.streams) ? (devEnv as any).development_plan.streams : [],
    nudges: buildNudges(profile, devEnv),
    daily_brief: buildDailyBrief(profile, recEnv, roadmapEnv),
    weekly_goals: buildWeeklyGoals(profile, recEnv, roadmapEnv),
    monthly_roadmap: buildMonthlyRoadmap(roadmapEnv),
    competency_advice: buildCompetencyAdvice(devEnv),
    industry_trends,
    coverage: {
      recommendations: Array.isArray((recEnv as any)?.groups) && (recEnv as any).groups.length > 0,
      roadmap: Array.isArray((roadmapEnv as any)?.milestones) && (roadmapEnv as any).milestones.length > 0,
      development: Array.isArray((devEnv as any)?.development_plan?.streams) && (devEnv as any).development_plan.streams.length > 0,
      industry_trends: industry_trends.measurable,
    },
    generated_at: new Date().toISOString(),
  };
}
