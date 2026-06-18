/**
 * LBI Profile Builder  (W6)
 *
 * Builds three learner profile objects from existing LBI data:
 *
 *   LearnerProfile       — identity + overall LBI + style + strengths + focus areas
 *   BehaviorProfile      — 5-dim breakdown + risk flags + style narrative
 *   LearningVelocityProfile — velocity arc + persistence trend + attention trajectory
 *
 * Purely additive and read-only. Never throws.
 */

import pg from 'pg';
import type { RiskIndicator } from './lbi-risk-engine';

export interface LearnerProfile {
  email: string;
  overall_lbi: number | null;
  lbi_band: 'high' | 'developing' | 'emerging' | 'early_stage' | 'no_data';
  learning_style: string | null;
  sessions_analyzed: number;
  top_strengths: Array<{ dimension: string; label: string; score: number }>;
  focus_areas: Array<{ dimension: string; label: string; score: number; message: string }>;
  profile_completeness: number; // 0–100
  computed_at: string;
}

export interface BehaviorProfile {
  email: string;
  dimensions: Array<{
    key: string;
    label: string;
    score: number | null;
    band: 'strong' | 'developing' | 'needs_focus' | 'no_data';
    percentile_estimate: number | null;
  }>;
  dominant_style: string | null;
  style_narrative: string | null;
  active_risk_count: number;
  active_risks: Pick<RiskIndicator, 'risk_type' | 'severity' | 'message'>[];
  behavioral_summary: string;
  computed_at: string;
}

export interface LearningVelocityProfile {
  email: string;
  velocity_score: number | null;
  velocity_band: 'fast' | 'steady' | 'slow' | 'no_data';
  velocity_trend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
  persistence_score: number | null;
  persistence_arc: 'strong' | 'building' | 'at_risk' | 'no_data';
  attention_trajectory: 'improving' | 'stable' | 'declining' | 'no_data';
  engagement_arc: string;
  sessions_30d: number;
  avg_weekly_improvement: number | null;
  computed_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DIM_LABELS: Record<string, string> = {
  consistency_score:  'Consistency',
  persistence_score:  'Persistence',
  attention_score:    'Attention',
  adaptability_score: 'Adaptability',
  velocity_score:     'Velocity',
};

const STYLE_NARRATIVES: Record<string, string> = {
  reflective:   'You tend to think before acting and prefer to process information deeply before moving on. Your strength is thoroughness; your growth edge is pacing.',
  persistent:   'You push through difficulty and stay with tasks longer than most. You build deep skills over time. Watch for rigidity when a new approach would be faster.',
  exploratory:  'You learn broadly and make connections across domains quickly. You thrive with variety. Channel this into structured exploration to avoid scattered effort.',
  impulsive:    'You move fast and try things before fully understanding them. This gives you rapid early exposure. Building a review habit will dramatically accelerate your retention.',
  disengaged:   'Your learning signals suggest reduced engagement right now. This is a starting point, not a ceiling. Small daily habits — even 10 minutes — create momentum quickly.',
};

const FOCUS_MESSAGES: Record<string, string> = {
  consistency_score:  'Building a daily study anchor — even 10 minutes — will compound your Consistency score within 2 weeks.',
  persistence_score:  'Practice the "2-minute rule": commit to just 2 minutes on the hardest task. You will almost always continue.',
  attention_score:    'Use 25-minute Pomodoro blocks with phone face-down. Attention is a trainable muscle.',
  adaptability_score: 'Try studying the same concept via 3 different formats (read, watch, explain). Variety builds cognitive flexibility.',
  velocity_score:     'Spaced repetition and self-testing before review are the two highest-impact techniques for learning speed.',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function lbiBand(score: number | null): LearnerProfile['lbi_band'] {
  if (score == null) return 'no_data';
  if (score >= 75) return 'high';
  if (score >= 55) return 'developing';
  if (score >= 35) return 'emerging';
  return 'early_stage';
}

function dimBand(score: number | null): BehaviorProfile['dimensions'][0]['band'] {
  if (score == null) return 'no_data';
  if (score >= 65) return 'strong';
  if (score >= 42) return 'developing';
  return 'needs_focus';
}

function velocityBand(score: number | null): LearningVelocityProfile['velocity_band'] {
  if (score == null) return 'no_data';
  if (score >= 65) return 'fast';
  if (score >= 40) return 'steady';
  return 'slow';
}

function persistenceArc(score: number | null): LearningVelocityProfile['persistence_arc'] {
  if (score == null) return 'no_data';
  if (score >= 60) return 'strong';
  if (score >= 38) return 'building';
  return 'at_risk';
}

// Rough percentile from 0–100 score assuming ~N(50, 15)
function roughPercentile(score: number): number {
  const z = (score - 50) / 15;
  const p = 0.5 * (1 + erf(z / Math.SQRT2));
  return Math.round(Math.min(99, Math.max(1, p * 100)));
}

function erf(x: number): number {
  const a1=0.254829592, a2=-0.284496736, a3=1.421413741, a4=-1.453152027, a5=1.061405429, p=0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t * Math.exp(-x*x);
  return sign * y;
}

// ── Learner Profile ───────────────────────────────────────────────────────────

export async function buildLearnerProfile(
  email: string,
  pool: pg.Pool
): Promise<LearnerProfile> {
  const blank: LearnerProfile = {
    email, overall_lbi: null, lbi_band: 'no_data', learning_style: null,
    sessions_analyzed: 0, top_strengths: [], focus_areas: [],
    profile_completeness: 0, computed_at: new Date().toISOString(),
  };
  try {
    const client = await pool.connect();
    try {
      const scoreRes = await client.query(
        `SELECT consistency_score, persistence_score, attention_score,
                adaptability_score, velocity_score, overall_lbi,
                learning_style, sessions_analyzed
         FROM lbi_scores WHERE user_email=$1 LIMIT 1`, [email]
      );
      if (!scoreRes.rows[0]) return blank;
      const r = scoreRes.rows[0];
      const dims = Object.keys(DIM_LABELS).map(k => ({
        dimension: k, label: DIM_LABELS[k], score: r[k] != null ? Number(r[k]) : null,
      })).filter(d => d.score != null) as Array<{ dimension: string; label: string; score: number }>;

      const sorted = [...dims].sort((a, b) => b.score - a.score);
      const topStrengths = sorted.slice(0, 2);
      const focusAreas = sorted.slice(-2).reverse().map(d => ({
        ...d,
        message: FOCUS_MESSAGES[d.dimension] ?? 'Small daily practice builds this dimension steadily.',
      }));

      const filled = dims.length; // 0–5 dimensions present
      const completeness = Math.round((filled / 5) * 60 + (Number(r.sessions_analyzed ?? 0) >= 3 ? 40 : (Number(r.sessions_analyzed ?? 0) / 3) * 40));

      return {
        email,
        overall_lbi: r.overall_lbi != null ? Number(r.overall_lbi) : null,
        lbi_band: lbiBand(r.overall_lbi != null ? Number(r.overall_lbi) : null),
        learning_style: r.learning_style ?? null,
        sessions_analyzed: Number(r.sessions_analyzed ?? 0),
        top_strengths: topStrengths,
        focus_areas: focusAreas,
        profile_completeness: Math.min(100, completeness),
        computed_at: new Date().toISOString(),
      };
    } finally { client.release(); }
  } catch (err) {
    console.error('[lbi-profile] buildLearnerProfile error:', err);
    return blank;
  }
}

// ── Behavior Profile ──────────────────────────────────────────────────────────

export async function buildBehaviorProfile(
  email: string,
  pool: pg.Pool
): Promise<BehaviorProfile> {
  const blank: BehaviorProfile = {
    email, dimensions: [], dominant_style: null, style_narrative: null,
    active_risk_count: 0, active_risks: [], behavioral_summary: 'Insufficient data to generate a behavioral profile. Complete a CAPADEX session to unlock this view.',
    computed_at: new Date().toISOString(),
  };
  try {
    const client = await pool.connect();
    try {
      const [scoreRes, riskRes] = await Promise.all([
        client.query(
          `SELECT consistency_score, persistence_score, attention_score,
                  adaptability_score, velocity_score, overall_lbi, learning_style
           FROM lbi_scores WHERE user_email=$1 LIMIT 1`, [email]
        ),
        client.query(
          `SELECT risk_type, severity, message FROM lbi_risk_indicators
           WHERE user_email=$1 AND is_active=TRUE`, [email]
        ),
      ]);

      if (!scoreRes.rows[0]) return blank;
      const r = scoreRes.rows[0];
      const style = r.learning_style ?? 'exploratory';

      const dims = Object.keys(DIM_LABELS).map(k => {
        const score = r[k] != null ? Number(r[k]) : null;
        return {
          key: k, label: DIM_LABELS[k], score,
          band: dimBand(score),
          percentile_estimate: score != null ? roughPercentile(score) : null,
        };
      });

      const activeRisks = riskRes.rows.map((r: any) => ({
        risk_type: r.risk_type, severity: r.severity, message: r.message,
      }));

      const overall = r.overall_lbi != null ? Number(r.overall_lbi) : null;
      const summary = overall == null
        ? blank.behavioral_summary
        : overall >= 65
          ? `Your behavioral learning profile shows strong engagement across most dimensions. ${STYLE_NARRATIVES[style] ?? ''}`
          : overall >= 42
            ? `Your behavioral profile shows a developing learner with clear strengths and identifiable growth areas. ${STYLE_NARRATIVES[style] ?? ''}`
            : `Your behavioral profile is in early development. This is the starting point — small consistent changes produce visible results within weeks. ${STYLE_NARRATIVES[style] ?? ''}`;

      return {
        email, dimensions: dims,
        dominant_style: style,
        style_narrative: STYLE_NARRATIVES[style] ?? null,
        active_risk_count: activeRisks.length,
        active_risks: activeRisks,
        behavioral_summary: summary,
        computed_at: new Date().toISOString(),
      };
    } finally { client.release(); }
  } catch (err) {
    console.error('[lbi-profile] buildBehaviorProfile error:', err);
    return blank;
  }
}

// ── Learning Velocity Profile ─────────────────────────────────────────────────

export async function buildVelocityProfile(
  email: string,
  pool: pg.Pool
): Promise<LearningVelocityProfile> {
  const blank: LearningVelocityProfile = {
    email, velocity_score: null, velocity_band: 'no_data',
    velocity_trend: 'insufficient_data', persistence_score: null,
    persistence_arc: 'no_data', attention_trajectory: 'no_data',
    engagement_arc: 'early_stage', sessions_30d: 0,
    avg_weekly_improvement: null, computed_at: new Date().toISOString(),
  };
  try {
    const client = await pool.connect();
    try {
      const [scoreRes, trendRes] = await Promise.all([
        client.query(
          `SELECT velocity_score, persistence_score FROM lbi_scores WHERE user_email=$1 LIMIT 1`, [email]
        ),
        client.query(
          `SELECT lt.engagement_arc, lt.sessions_30d, lt.avg_weekly_improvement,
                  bt_v.direction AS vel_direction,
                  bt_a.direction AS attn_direction
           FROM lbi_learning_trends lt
           LEFT JOIN lbi_behavior_trends bt_v ON bt_v.user_email=lt.user_email AND bt_v.dimension='velocity_score'
           LEFT JOIN lbi_behavior_trends bt_a ON bt_a.user_email=lt.user_email AND bt_a.dimension='attention_score'
           WHERE lt.user_email=$1 LIMIT 1`, [email]
        ),
      ]);

      const vel  = scoreRes.rows[0]?.velocity_score     != null ? Number(scoreRes.rows[0].velocity_score)     : null;
      const per  = scoreRes.rows[0]?.persistence_score  != null ? Number(scoreRes.rows[0].persistence_score)  : null;
      const tr   = trendRes.rows[0];

      return {
        email,
        velocity_score:       vel,
        velocity_band:        velocityBand(vel),
        velocity_trend:       (tr?.vel_direction  ?? 'insufficient_data') as LearningVelocityProfile['velocity_trend'],
        persistence_score:    per,
        persistence_arc:      persistenceArc(per),
        attention_trajectory: (tr?.attn_direction ?? 'no_data') as LearningVelocityProfile['attention_trajectory'],
        engagement_arc:       tr?.engagement_arc  ?? 'early_stage',
        sessions_30d:         Number(tr?.sessions_30d ?? 0),
        avg_weekly_improvement: tr?.avg_weekly_improvement != null ? Number(tr.avg_weekly_improvement) : null,
        computed_at: new Date().toISOString(),
      };
    } finally { client.release(); }
  } catch (err) {
    console.error('[lbi-profile] buildVelocityProfile error:', err);
    return blank;
  }
}

// ── Composite profile ─────────────────────────────────────────────────────────

export async function buildCompositeProfile(email: string, pool: pg.Pool) {
  const [learner, behavior, velocity] = await Promise.all([
    buildLearnerProfile(email, pool),
    buildBehaviorProfile(email, pool),
    buildVelocityProfile(email, pool),
  ]);
  return { learner, behavior, velocity, computed_at: new Date().toISOString() };
}
