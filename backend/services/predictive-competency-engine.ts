/**
 * Predictive Competency Engine — deterministic heuristics (no ML / LLM).
 * Inputs: current competency scores + tenure + history → readiness, burnout,
 * leadership-emergence, promotion-proximity, skill-decay predictions.
 */
import type { Pool } from 'pg';
export const PREDICTIVE_ENGINE_VERSION = '6.0.0';

const cap = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const CANON = ['COG','COM','LEA','EXE','ADP','TEC','EIQ'] as const;
type Scores = Partial<Record<typeof CANON[number], number>>;

export type ReadinessInput = { userId: string; scores: Scores; targetRole?: string; tenureMonths?: number };
export type ReadinessPrediction = {
  user_id: string; target_role: string;
  probability: number; eta_months: number | null;
  drivers: Array<{ competency: string; level: number; weight: number }>;
};

const ROLE_WEIGHTS: Record<string, Scores> = {
  ic_senior:    { TEC: 0.35, COG: 0.20, EXE: 0.20, COM: 0.10, ADP: 0.10, LEA: 0.03, EIQ: 0.02 },
  team_lead:    { LEA: 0.25, COM: 0.20, EXE: 0.20, COG: 0.15, EIQ: 0.10, TEC: 0.05, ADP: 0.05 },
  manager:      { LEA: 0.30, EIQ: 0.20, COM: 0.20, EXE: 0.15, COG: 0.10, ADP: 0.03, TEC: 0.02 },
  director:     { LEA: 0.30, COG: 0.20, EIQ: 0.15, COM: 0.15, EXE: 0.10, ADP: 0.07, TEC: 0.03 },
  executive:    { LEA: 0.35, COG: 0.20, EIQ: 0.20, COM: 0.15, ADP: 0.05, EXE: 0.04, TEC: 0.01 },
};

export function predictReadiness(input: ReadinessInput): ReadinessPrediction {
  const target = input.targetRole && ROLE_WEIGHTS[input.targetRole] ? input.targetRole : 'ic_senior';
  const weights = ROLE_WEIGHTS[target];
  let weighted = 0;
  const drivers: ReadinessPrediction['drivers'] = [];
  for (const k of CANON) {
    const lvl = input.scores[k] ?? 0;
    const w = weights[k] ?? 0;
    weighted += (lvl / 100) * w;
    drivers.push({ competency: k, level: lvl, weight: w });
  }
  drivers.sort((a, b) => b.weight * b.level - a.weight * a.level);
  const probability = cap(weighted);                        // 0..1
  // Heuristic ETA: shortfall / monthly growth (assume 1.5 pts/month avg)
  const monthlyGrowth = 1.5;
  const gapPts = (1 - weighted) * 100;
  const eta = gapPts <= 0 ? 0 : Math.round(gapPts / monthlyGrowth);
  return { user_id: input.userId, target_role: target, probability: Math.round(probability * 1000) / 1000, eta_months: Math.min(48, eta), drivers: drivers.slice(0, 5) };
}

export type BurnoutInput = { userId: string; weeklyHours?: number; recentTrendDelta?: number; supportSignal?: number; tenureMonths?: number };
export function predictBurnoutRisk(input: BurnoutInput) {
  const hours = input.weeklyHours ?? 45;
  const trend = input.recentTrendDelta ?? 0;            // negative = declining
  const support = input.supportSignal ?? 0.6;           // 0..1
  const tenure = input.tenureMonths ?? 12;
  // Risk = overwork + decline + low support + tenure-floor
  const overwork = cap((hours - 40) / 30);              // 0..1
  const decline = cap(-trend / 30);
  const lowSupport = cap(1 - support);
  const tenureFloor = cap(0.1 + (tenure < 6 ? 0.2 : 0));
  const raw = (overwork * 0.4 + decline * 0.3 + lowSupport * 0.2 + tenureFloor * 0.1);
  const score = Math.round(raw * 100);
  const band = score >= 70 ? 'high' : score >= 40 ? 'moderate' : 'low';
  return {
    user_id: input.userId, risk_score: score, risk_band: band,
    drivers: [
      { driver: 'workload', contribution: Math.round(overwork * 40) },
      { driver: 'trend', contribution: Math.round(decline * 30) },
      { driver: 'support', contribution: Math.round(lowSupport * 20) },
      { driver: 'tenure', contribution: Math.round(tenureFloor * 10) },
    ].sort((a, b) => b.contribution - a.contribution),
  };
}

export function predictLeadershipEmergence(input: { userId: string; scores: Scores; teamSize?: number; mentorshipCount?: number }) {
  const s = input.scores;
  const lea = s.LEA ?? 0; const eiq = s.EIQ ?? 0; const com = s.COM ?? 0; const cog = s.COG ?? 0;
  const ts = Math.min(50, input.teamSize ?? 0); const mc = Math.min(20, input.mentorshipCount ?? 0);
  const score = Math.round(cap((lea * 0.35 + eiq * 0.25 + com * 0.20 + cog * 0.10) + (ts * 0.4 + mc * 1.0)) );
  const capped = Math.min(100, score);
  const signals = [
    lea > 60 && 'high_leadership_baseline',
    eiq > 55 && 'emotional_intelligence',
    com > 60 && 'communication',
    ts >= 5 && `manages_team_of_${ts}`,
    mc >= 3 && `mentored_${mc}`,
  ].filter(Boolean) as string[];
  return { user_id: input.userId, emergence_score: capped, signals };
}

export function predictPromotionProximity(input: { userId: string; currentStage: string; nextStage: string; readinessProbability: number; tenureMonths?: number }) {
  const tenureBonus = Math.min(0.15, (input.tenureMonths ?? 0) / 120);
  const proximity = cap(input.readinessProbability * 0.85 + tenureBonus);
  const evidence: string[] = [];
  if (input.readinessProbability > 0.7) evidence.push('readiness_above_threshold');
  if ((input.tenureMonths ?? 0) > 18) evidence.push('tenure_sufficient');
  if (proximity > 0.6) evidence.push('promotion_window_open');
  return { user_id: input.userId, current_stage: input.currentStage, next_stage: input.nextStage, proximity: Math.round(proximity * 1000) / 1000, evidence };
}

export function predictSkillDecay(input: { userId: string; competencyKey: string; currentLevel: number; monthsSinceLastUse: number }) {
  // Decay ≈ 0.5% per month, accelerated past 6 months
  const months = Math.max(0, input.monthsSinceLastUse);
  const baseDecay = 0.005;
  const accelerated = months > 6 ? baseDecay * 1.5 : baseDecay;
  const projectedLoss3mo = Math.round(input.currentLevel * accelerated * 3 * 100) / 100;
  return {
    user_id: input.userId, competency_key: input.competencyKey,
    decay_rate_per_month: Math.round(accelerated * 10000) / 10000,
    projected_loss_3mo: projectedLoss3mo,
    months_since_last_use: months,
  };
}

// ── Persistence helpers ──────────────────────────────────────────────────
export async function persistReadiness(pool: Pool, r: ReadinessPrediction) {
  try {
    await pool.query(
      `INSERT INTO readiness_predictions (user_id, target_role, probability, eta_months, drivers)
       VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [r.user_id, r.target_role, r.probability, r.eta_months, JSON.stringify(r.drivers)],
    );
  } catch (e) { console.warn('[predictive] readiness persist failed:', (e as Error).message); }
}
export async function persistBurnout(pool: Pool, b: ReturnType<typeof predictBurnoutRisk>) {
  try {
    await pool.query(
      `INSERT INTO burnout_risk_models (user_id, risk_score, risk_band, drivers) VALUES ($1,$2,$3,$4::jsonb)`,
      [b.user_id, b.risk_score, b.risk_band, JSON.stringify(b.drivers)],
    );
  } catch (e) { console.warn('[predictive] burnout persist failed:', (e as Error).message); }
}
export async function persistLeadership(pool: Pool, l: ReturnType<typeof predictLeadershipEmergence>) {
  try {
    await pool.query(
      `INSERT INTO leadership_emergence_models (user_id, emergence_score, signals) VALUES ($1,$2,$3::jsonb)`,
      [l.user_id, l.emergence_score, JSON.stringify(l.signals)],
    );
  } catch (e) { console.warn('[predictive] leadership persist failed:', (e as Error).message); }
}
export async function persistPromotion(pool: Pool, p: ReturnType<typeof predictPromotionProximity>) {
  try {
    await pool.query(
      `INSERT INTO promotion_proximity_models (user_id, current_stage, next_stage, proximity, evidence) VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [p.user_id, p.current_stage, p.next_stage, p.proximity, JSON.stringify(p.evidence)],
    );
  } catch (e) { console.warn('[predictive] promotion persist failed:', (e as Error).message); }
}
