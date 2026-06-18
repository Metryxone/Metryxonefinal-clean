/**
 * RIE Recommendation Intelligence Engine
 * Rule-based engine that generates typed recommendations from InterventionContext.
 * 7 domains: learning, behavioural, emotional, resilience, employability, leadership, recovery
 */
import type { Pool } from 'pg';
import type { InterventionContext } from './rie-aggregator';

export interface RIERecommendation {
  rec_type: string;
  domain: string;
  title: string;
  rationale: string[];
  contributing_signals: string[];
  confidence: number;
  timing: string;
  intensity: string;
  priority: number;
  expected_outcome: string;
}

const TIMING = { immediate: 'immediate', short: '1-2 weeks', medium: '2-4 weeks', long: '1-3 months' };

export function generateRecommendations(ctx: InterventionContext): RIERecommendation[] {
  const recs: RIERecommendation[] = [];

  // ── Learning Recommendations ───────────────────────────────────────────────
  if (ctx.lbi_score < 40) {
    recs.push({
      rec_type: 'learning',
      domain: 'learning',
      title: 'Learning Behaviour Intensive — Foundations Reset',
      rationale: [
        `LBI score of ${ctx.lbi_score}/100 indicates significant learning behaviour challenges`,
        'Foundational engagement patterns need immediate restructuring',
        `Learning style classified as "${ctx.lbi_style}" — structured support required`,
      ],
      contributing_signals: ['lbi_score', 'learning_style', ...ctx.dominant_signals.slice(0, 2)],
      confidence: 0.82,
      timing: TIMING.immediate,
      intensity: 'high',
      priority: 1,
      expected_outcome: 'Improve LBI by 15-20 points over 4 weeks with structured intervention',
    });
  } else if (ctx.lbi_score < 60) {
    recs.push({
      rec_type: 'learning',
      domain: 'learning',
      title: 'Learning Style Optimisation Programme',
      rationale: [
        `LBI score of ${ctx.lbi_score}/100 — moderate learning behaviour patterns`,
        `Style: "${ctx.lbi_style}" — targeted optimisation can accelerate growth`,
      ],
      contributing_signals: ['lbi_score', 'learning_style'],
      confidence: 0.74,
      timing: TIMING.short,
      intensity: 'moderate',
      priority: 2,
      expected_outcome: 'Strengthen learning consistency and velocity over 2-3 weeks',
    });
  }

  if (ctx.lbi_style === 'impulsive') {
    recs.push({
      rec_type: 'learning',
      domain: 'behavioural',
      title: 'Impulse-Response Regulation Training',
      rationale: ['Impulsive learning style detected', 'Rapid response patterns indicate low deliberation', 'Structured pacing exercises recommended'],
      contributing_signals: ['rapid_answer_pattern', 'lbi_style'],
      confidence: 0.78,
      timing: TIMING.immediate,
      intensity: 'moderate',
      priority: 2,
      expected_outcome: 'Reduce impulsive response rate by 40% within 2 weeks',
    });
  }

  if (ctx.lbi_style === 'disengaged') {
    recs.push({
      rec_type: 'learning',
      domain: 'engagement',
      title: 'Re-Engagement Activation Protocol',
      rationale: ['Disengaged learning style detected', 'Completion rates critically low', 'Motivational scaffolding required urgently'],
      contributing_signals: ['lbi_style', 'engagement_score', 'dropout_risk'],
      confidence: 0.85,
      timing: TIMING.immediate,
      intensity: 'high',
      priority: 1,
      expected_outcome: 'Restore baseline engagement within 1-2 weeks',
    });
  }

  // ── Behavioural Recommendations ────────────────────────────────────────────
  if (ctx.engagement_score < 40) {
    recs.push({
      rec_type: 'behavioural',
      domain: 'behavioural',
      title: 'Behavioural Activation & Engagement Recovery',
      rationale: [
        `Engagement score critically low: ${ctx.engagement_score}/100`,
        'Behavioural withdrawal pattern detected',
        'Immediate activation intervention required',
      ],
      contributing_signals: ['engagement_score', 'rapid_answer_pattern', 'lbi_style'],
      confidence: 0.80,
      timing: TIMING.immediate,
      intensity: 'high',
      priority: 1,
      expected_outcome: 'Raise engagement score above 55 within 2 weeks',
    });
  }

  if (ctx.dropout_risk > 60) {
    recs.push({
      rec_type: 'behavioural',
      domain: 'retention',
      title: 'Dropout Prevention — High-Priority Retention Protocol',
      rationale: [
        `Dropout risk at ${ctx.dropout_risk}% — requires immediate outreach`,
        'Multiple disengagement signals detected',
        'Proactive counsellor contact recommended',
      ],
      contributing_signals: ['dropout_risk', 'engagement_score', 'lbi_score'],
      confidence: 0.87,
      timing: TIMING.immediate,
      intensity: 'high',
      priority: 1,
      expected_outcome: 'Reduce dropout risk to below 40% through targeted re-engagement',
    });
  }

  // ── Emotional Recommendations ──────────────────────────────────────────────
  if (ctx.emotional_load > 65) {
    recs.push({
      rec_type: 'emotional',
      domain: 'emotional',
      title: 'Emotional Stabilisation Protocol — High Load Detected',
      rationale: [
        `Emotional load at ${ctx.emotional_load}/100 — critical threshold exceeded`,
        'Emotional regulation support is clinically indicated',
        ...ctx.early_warnings.slice(0, 2).map(w => `Warning signal: ${w}`),
      ],
      contributing_signals: ['emotional_load', ...ctx.early_warnings.slice(0, 3)],
      confidence: 0.88,
      timing: TIMING.immediate,
      intensity: 'high',
      priority: 1,
      expected_outcome: 'Reduce emotional load below 50 through structured emotional support',
    });
  } else if (ctx.emotional_load > 40) {
    recs.push({
      rec_type: 'emotional',
      domain: 'emotional',
      title: 'Emotional Regulation Skill-Building Programme',
      rationale: [
        `Emotional load at ${ctx.emotional_load}/100 — elevated but manageable`,
        'Preventive emotional regulation work recommended',
      ],
      contributing_signals: ['emotional_load', 'burnout_probability'],
      confidence: 0.72,
      timing: TIMING.short,
      intensity: 'moderate',
      priority: 2,
      expected_outcome: 'Stabilise emotional patterns within 3 weeks',
    });
  }

  if (ctx.burnout_probability > 55) {
    recs.push({
      rec_type: 'emotional',
      domain: 'burnout',
      title: 'Burnout Prevention & Recovery Sequence',
      rationale: [
        `Burnout probability at ${ctx.burnout_probability}% — intervention required`,
        'High emotional + cognitive load convergence detected',
        'Pacing reduction and recovery support needed',
      ],
      contributing_signals: ['burnout_probability', 'emotional_load', 'cognitive_load'],
      confidence: 0.83,
      timing: TIMING.immediate,
      intensity: 'high',
      priority: 1,
      expected_outcome: 'Reduce burnout probability by 25+ points through structured recovery',
    });
  }

  // ── Resilience Recommendations ─────────────────────────────────────────────
  if (ctx.csi_score < 40 && ctx.sessions_completed > 0) {
    recs.push({
      rec_type: 'resilience',
      domain: 'resilience',
      title: 'Resilience Foundation Building Programme',
      rationale: [
        `CSI score at ${ctx.csi_score}/100 — "${ctx.csi_stage}" stage`,
        'Resilience rebuilding through consistent small wins recommended',
        `${ctx.sessions_completed} sessions completed — building on existing foundation`,
      ],
      contributing_signals: ['csi_score', 'csi_stage', 'trajectory'],
      confidence: 0.76,
      timing: TIMING.short,
      intensity: 'moderate',
      priority: 2,
      expected_outcome: 'Move from Forming/Emerging to Developing stage within 4-6 weeks',
    });
  }

  if (ctx.trajectory === 'burnout_escalation' || ctx.trajectory === 'disengagement_drift') {
    recs.push({
      rec_type: 'resilience',
      domain: 'trajectory',
      title: 'Trajectory Course-Correction — Decline Pattern Reversal',
      rationale: [
        `Developmental trajectory: "${ctx.trajectory}"`,
        'Score trend is declining — immediate resilience support needed',
        'Challenge reintroduction to be staged carefully after stabilisation',
      ],
      contributing_signals: ['trajectory', 'csi_score', 'burnout_probability'],
      confidence: 0.81,
      timing: TIMING.immediate,
      intensity: 'high',
      priority: 1,
      expected_outcome: 'Stabilise trajectory within 2 weeks, then introduce progressive challenges',
    });
  }

  // ── Employability Recommendations ──────────────────────────────────────────
  if (ctx.employability_readiness < 50) {
    recs.push({
      rec_type: 'employability',
      domain: 'employability',
      title: 'Employability Readiness Development Track',
      rationale: [
        `Employability readiness at ${ctx.employability_readiness}% — below threshold`,
        'Skill gap analysis and structured development plan required',
        `CSI stage "${ctx.csi_stage}" and LBI ${ctx.lbi_score}/100 inform target areas`,
      ],
      contributing_signals: ['employability_readiness', 'csi_score', 'lbi_score'],
      confidence: 0.72,
      timing: TIMING.medium,
      intensity: 'moderate',
      priority: 3,
      expected_outcome: 'Raise employability readiness above 60% within 6-8 weeks',
    });
  } else if (ctx.employability_readiness >= 75) {
    recs.push({
      rec_type: 'employability',
      domain: 'employability',
      title: 'Employability Excellence — Advanced Career Positioning',
      rationale: [
        `Employability readiness strong at ${ctx.employability_readiness}%`,
        'Focus on differentiation and advanced positioning',
        'Mentoring others and leadership development recommended',
      ],
      contributing_signals: ['employability_readiness', 'csi_score', 'leadership_emergence'],
      confidence: 0.78,
      timing: TIMING.medium,
      intensity: 'low',
      priority: 3,
      expected_outcome: 'Achieve market-leading positioning within 1-2 months',
    });
  }

  // ── Leadership Recommendations ─────────────────────────────────────────────
  if (ctx.leadership_emergence > 60) {
    recs.push({
      rec_type: 'leadership',
      domain: 'leadership',
      title: 'Leadership Emergence Amplification',
      rationale: [
        `Leadership emergence signal at ${ctx.leadership_emergence}% — strong potential detected`,
        'Adaptability and persistence scores support leadership trajectory',
        'Structured leadership development opportunities recommended',
      ],
      contributing_signals: ['leadership_emergence', 'csi_score', 'lbi_style'],
      confidence: 0.74,
      timing: TIMING.medium,
      intensity: 'moderate',
      priority: 3,
      expected_outcome: 'Activate leadership pathway within 4-6 weeks',
    });
  }

  // ── Recovery Recommendations ───────────────────────────────────────────────
  if (ctx.cognitive_load > 70 && ctx.emotional_load > 50) {
    recs.push({
      rec_type: 'recovery',
      domain: 'recovery',
      title: 'Overload + Fatigue Recovery Sequence',
      rationale: [
        `Cognitive overload (${ctx.cognitive_load}/100) + emotional load (${ctx.emotional_load}/100)`,
        'Combined load indicates burnout trajectory — pacing reduction critical',
        'Recovery sequence: pacing → stabilisation → resilience → challenge reintroduction',
      ],
      contributing_signals: ['cognitive_load', 'emotional_load', 'burnout_probability'],
      confidence: 0.85,
      timing: TIMING.immediate,
      intensity: 'high',
      priority: 1,
      expected_outcome: 'Reduce combined load by 30% within 2 weeks through structured recovery',
    });
  }

  if (ctx.crisis_detected) {
    recs.push({
      rec_type: 'recovery',
      domain: 'crisis',
      title: 'CRISIS RESPONSE — Mandatory Human Escalation Required',
      rationale: [
        `Crisis signal detected: ${ctx.crisis_type}`,
        'Constitutional AI guardrail triggered — automated intervention insufficient',
        'MANDATORY: Qualified counsellor or human professional must review immediately',
      ],
      contributing_signals: ctx.early_warnings,
      confidence: 0.95,
      timing: TIMING.immediate,
      intensity: 'critical',
      priority: 0,
      expected_outcome: 'Immediate human professional assessment and support',
    });
  }

  recs.sort((a, b) => a.priority - b.priority);
  return recs.slice(0, 10);
}

export async function saveRecommendations(
  pool: Pool,
  email: string,
  sessionId: string | undefined,
  recs: RIERecommendation[],
  tenantId: string = '00000000-0000-0000-0000-000000000000'
): Promise<void> {
  for (const r of recs) {
    await pool.query(`
      INSERT INTO rie_recommendations
        (user_email, tenant_id, session_id, rec_type, domain, title, rationale, contributing_signals,
         confidence, timing, intensity, priority, expected_outcome, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active',NOW(),NOW())
    `, [
      email, tenantId, sessionId || null, r.rec_type, r.domain, r.title,
      JSON.stringify(r.rationale), JSON.stringify(r.contributing_signals),
      r.confidence, r.timing, r.intensity, r.priority, r.expected_outcome,
    ]);
  }
}
