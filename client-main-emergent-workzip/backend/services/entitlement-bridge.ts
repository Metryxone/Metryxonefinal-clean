/**
 * Entitlement Bridge Service
 *
 * Maps capadex_payments (email + stage_code + status='paid') to a structured
 * feature entitlement profile. Additive, read-only, never-throws.
 *
 * Stage hierarchy: CAP_CUR < CAP_INS < CAP_GRW < CAP_MAS
 * Higher stages inherit all features of lower stages.
 */

import pg from 'pg';

export type StageCode = 'CAP_CUR' | 'CAP_INS' | 'CAP_GRW' | 'CAP_MAS';

const STAGE_ORDER: StageCode[] = ['CAP_CUR', 'CAP_INS', 'CAP_GRW', 'CAP_MAS'];

const STAGE_FEATURES: Record<StageCode, string[]> = {
  CAP_CUR: [
    'behavioral_report',
    'pattern_identification',
    'benchmark_comparison',
    'dimensional_breakdown',
  ],
  CAP_INS: [
    'competency_gap_analysis',
    'behavioral_benchmark',
    'root_cause_patterns',
    'trigger_driver_identification',
    'cv_positioning_intelligence',
    'job_market_fit_prediction',
  ],
  CAP_GRW: [
    '30_day_strategy_plan',
    'intervention_map',
    'progress_checkpoints',
    'behaviour_replacement_protocol',
  ],
  CAP_MAS: [
    'full_19_domain_profile',
    'expert_debrief_session',
    'career_readiness_map',
    'academic_readiness_map',
  ],
};

const STAGE_LABELS: Record<StageCode, string> = {
  CAP_CUR: 'Curiosity',
  CAP_INS: 'Insight',
  CAP_GRW: 'Growth',
  CAP_MAS: 'Mastery',
};

function resolveInheritedFeatures(stages: StageCode[]): string[] {
  if (stages.length === 0) return [];
  const highestIdx = Math.max(...stages.map(s => STAGE_ORDER.indexOf(s)));
  const features = new Set<string>();
  for (let i = 0; i <= highestIdx; i++) {
    for (const f of STAGE_FEATURES[STAGE_ORDER[i]]) {
      features.add(f);
    }
  }
  return [...features];
}

export interface EntitlementPayment {
  stage_code: StageCode;
  stage_name: string;
  amount_paise: number;
  razorpay_payment_id: string | null;
  created_at: string;
}

export interface EntitlementProfile {
  email: string;
  entitled: boolean;
  highest_stage: StageCode | null;
  highest_stage_label: string | null;
  paid_stages: StageCode[];
  features: string[];
  payments: EntitlementPayment[];
  checked_at: string;
}

const BLANK = (email: string): EntitlementProfile => ({
  email,
  entitled: false,
  highest_stage: null,
  highest_stage_label: null,
  paid_stages: [],
  features: [],
  payments: [],
  checked_at: new Date().toISOString(),
});

export async function getEntitlementProfile(
  email: string,
  pool: pg.Pool
): Promise<EntitlementProfile> {
  try {
    const result = await pool.query(
      `SELECT stage_code, stage_name, amount_paise,
              razorpay_payment_id, created_at
       FROM capadex_payments
       WHERE email = $1
         AND status = 'paid'
       ORDER BY created_at DESC`,
      [email]
    );

    if (result.rows.length === 0) return BLANK(email);

    const validRows = result.rows.filter(r =>
      STAGE_ORDER.includes(r.stage_code as StageCode)
    );
    if (validRows.length === 0) return BLANK(email);

    const paidStages: StageCode[] = [...new Set(
      validRows.map(r => r.stage_code as StageCode)
    )];
    const highestIdx = Math.max(...paidStages.map(s => STAGE_ORDER.indexOf(s)));
    const highestStage = STAGE_ORDER[highestIdx];

    return {
      email,
      entitled: true,
      highest_stage: highestStage,
      highest_stage_label: STAGE_LABELS[highestStage],
      paid_stages: paidStages,
      features: resolveInheritedFeatures(paidStages),
      payments: validRows.map(r => ({
        stage_code:          r.stage_code as StageCode,
        stage_name:          r.stage_name ?? STAGE_LABELS[r.stage_code as StageCode] ?? r.stage_code,
        amount_paise:        Number(r.amount_paise ?? 0),
        razorpay_payment_id: r.razorpay_payment_id ?? null,
        created_at:          r.created_at,
      })),
      checked_at: new Date().toISOString(),
    };
  } catch {
    return BLANK(email);
  }
}

export function hasFeature(profile: EntitlementProfile, feature: string): boolean {
  return profile.features.includes(feature);
}

export function requiresStage(
  profile: EntitlementProfile,
  stage: StageCode
): boolean {
  const needed = STAGE_ORDER.indexOf(stage);
  const have = profile.highest_stage
    ? STAGE_ORDER.indexOf(profile.highest_stage)
    : -1;
  return have >= needed;
}
