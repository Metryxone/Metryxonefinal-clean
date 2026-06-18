/**
 * RIE Aggregator Service
 * Reads existing tables (capadex sessions, CSI, LBI, signal profiles, predictive profiles)
 * for a given user email and builds a unified InterventionContext.
 * Tenant isolation: PUBLIC_TENANT_ID sentinel used when no tenant is specified.
 */
import type { Pool } from 'pg';

export const PUBLIC_TENANT_ID = '00000000-0000-0000-0000-000000000000';

export interface BehaviouralState {
  learning_style: string;
  consistency: number;
  persistence: number;
  adaptability: number;
  velocity: number;
  engagement_level: string;
}

export interface InterventionContext {
  user_email: string;
  tenant_id: string;
  session_id?: string;
  csi_score: number;
  csi_stage: string;
  lbi_score: number;
  lbi_style: string;
  dropout_risk: number;
  burnout_probability: number;
  employability_readiness: number;
  leadership_emergence: number;
  emotional_load: number;
  cognitive_load: number;
  engagement_score: number;
  risk_score: number;
  composite_intensity: number;
  behavioural_state: BehaviouralState;
  cognitive_state: Record<string, number | string | string[]>;
  emotional_state: Record<string, number | string | boolean | string[]>;
  resilience_state: Record<string, number | string>;
  risk_profile: Record<string, number | string>;
  opportunity_profile: Record<string, number | boolean>;
  crisis_detected: boolean;
  crisis_type: string | null;
  sessions_completed: number;
  latest_concern: string;
  early_warnings: string[];
  dominant_signals: string[];
  trajectory: string;
}

export async function aggregateUserContext(
  pool: Pool,
  email: string,
  sessionId?: string,
  tenantId?: string,
  persist = true
): Promise<InterventionContext> {
  const emailLower = email.toLowerCase().trim();
  const effectiveTenant = tenantId ?? PUBLIC_TENANT_ID;

  const [csiRes, lbiRes, signalRes, sessRes, trajRes] = await Promise.all([
    pool.query(`SELECT csi_score, csi_stage, positive_factors, negative_factors, domain_scores FROM csi_profiles WHERE user_email=$1`, [emailLower]),
    pool.query(`SELECT overall_lbi, learning_style, consistency_score, persistence_score, attention_score, adaptability_score, velocity_score FROM lbi_scores WHERE user_email=$1`, [emailLower]),
    pool.query(`
      SELECT emotional_load, cognitive_load, engagement_score, risk_score, composite_intensity,
             early_warnings, dominant_signals, hidden_patterns, severity_level, intervention_priority
      FROM capadex_signal_profiles WHERE session_id = ANY(
        SELECT id::text FROM capadex_sessions WHERE LOWER(guest_email)=$1 ORDER BY created_at DESC LIMIT 5
      ) ORDER BY generated_at DESC LIMIT 1`, [emailLower]),
    pool.query(`
      SELECT id, stage_code, score, concern_name, status, created_at
      FROM capadex_sessions WHERE LOWER(guest_email)=$1 AND status='completed'
      ORDER BY created_at DESC LIMIT 20`, [emailLower]),
    pool.query(`SELECT trajectory_type, trend_direction FROM developmental_trajectory WHERE user_email=$1 ORDER BY detected_at DESC LIMIT 1`, [emailLower]),
  ]);

  const csi = csiRes.rows[0];
  const lbi = lbiRes.rows[0];
  const signal = signalRes.rows[0];
  const sessions = sessRes.rows;
  const traj = trajRes.rows[0];

  const csiScore = Number(csi?.csi_score || 0);
  const csiStage = csi?.csi_stage || 'Forming';
  const lbiScore = Number(lbi?.overall_lbi || 0);
  const lbiStyle = lbi?.learning_style || 'exploratory';

  const emotionalLoad = Number(signal?.emotional_load || 0);
  const cognitiveLoad = Number(signal?.cognitive_load || 0);
  const engagementScore = Number(signal?.engagement_score || 50);
  const riskScore = Number(signal?.risk_score || 0);
  const compositeIntensity = Number(signal?.composite_intensity || 0);

  const earlyWarnings: string[] = (() => {
    const w = signal?.early_warnings;
    if (!w) return [];
    const arr = Array.isArray(w) ? w : JSON.parse(w || '[]');
    return arr.map((x: unknown) => (typeof x === 'string' ? x : (x as { type?: string })?.type || ''));
  })();

  const dominantSignals: string[] = (() => {
    const d = signal?.dominant_signals;
    if (!d) return [];
    const arr = Array.isArray(d) ? d : JSON.parse(d || '[]');
    return arr.map((x: unknown) => (typeof x === 'string' ? x : (x as { signal_key?: string })?.signal_key || ''));
  })();

  const sessionsCompleted = sessions.length;
  const latestConcern = sessions[0]?.concern_name || '';
  const latestScore = Number(sessions[0]?.score || 0);

  const dropoutRisk = Math.min(100, Math.round(
    (sessionsCompleted === 0 ? 60 : Math.max(0, 60 - sessionsCompleted * 3)) +
    (lbiScore < 30 ? 20 : 0) +
    (riskScore > 60 ? 15 : 0)
  ));
  const burnoutProb = Math.min(100, Math.round(
    (emotionalLoad > 65 ? 30 : 10) + (cognitiveLoad > 55 ? 20 : 0) +
    (Number(lbi?.attention_score ?? 50) < 35 ? 15 : 0) +
    (earlyWarnings.includes('burnout_trajectory_risk') ? 25 : 0)
  ));
  const employability = Math.min(100, Math.round(csiScore * 0.6 + lbiScore * 0.4));
  const leadership = Math.min(100, Math.round(
    (csiScore >= 65 ? 30 : csiScore >= 50 ? 15 : 5) +
    (Number(lbi?.adaptability_score || 0) > 70 ? 20 : 0) +
    (Number(lbi?.persistence_score || 0) > 65 ? 10 : 0)
  ) + 25);

  const crisisSignals = ['hopelessness', 'emotional_collapse', 'silent_distress', 'helplessness_escalation'];
  const crisisDetected = earlyWarnings.some(w => crisisSignals.some(cs => w.toLowerCase().includes(cs)));
  const crisisType = crisisDetected
    ? earlyWarnings.find(w => crisisSignals.some(cs => w.toLowerCase().includes(cs))) || null
    : null;

  const behaviouralState: BehaviouralState = {
    learning_style: lbiStyle,
    consistency: Number(lbi?.consistency_score || 0),
    persistence: Number(lbi?.persistence_score || 0),
    adaptability: Number(lbi?.adaptability_score || 0),
    velocity: Number(lbi?.velocity_score || 0),
    engagement_level: engagementScore > 65 ? 'high' : engagementScore > 40 ? 'moderate' : 'low',
  };

  const cognitiveState = {
    attention: Number(lbi?.attention_score || 0),
    cognitive_load: cognitiveLoad,
    load_level: cognitiveLoad > 70 ? 'overloaded' : cognitiveLoad > 45 ? 'elevated' : 'normal',
    dominant_signals: dominantSignals.filter(s => ['hesitation', 'prolonged_hesitation', 'response_volatility', 'absolutist_thinking'].includes(s)),
  };

  const emotionalState = {
    emotional_load: emotionalLoad,
    load_level: emotionalLoad > 70 ? 'severe' : emotionalLoad > 50 ? 'elevated' : emotionalLoad > 30 ? 'moderate' : 'normal',
    early_warnings: earlyWarnings,
    crisis_detected: crisisDetected,
    burnout_probability: burnoutProb,
  };

  const resilienceState = {
    csi_score: csiScore,
    csi_stage: csiStage,
    recovery_trajectory: traj?.trajectory_type || 'unknown',
    trend: traj?.trend_direction || 'stable',
    sessions_completed: sessionsCompleted,
    latest_score: latestScore,
  };

  const riskProfile = {
    dropout_risk: dropoutRisk,
    burnout_probability: burnoutProb,
    risk_score: riskScore,
    composite_intensity: compositeIntensity,
    severity_level: signal?.severity_level || 'minimal',
    intervention_priority: signal?.intervention_priority || 'standard',
  };

  const oppProfile = {
    employability_readiness: employability,
    leadership_emergence: leadership,
    lbi_score: lbiScore,
    high_potential: lbiScore > 65 && csiScore > 60,
    adaptability_strength: Number(lbi?.adaptability_score || 0) > 70,
    persistence_strength: Number(lbi?.persistence_score || 0) > 65,
  };

  const ctx: InterventionContext = {
    user_email: emailLower,
    tenant_id: effectiveTenant,
    session_id: sessionId,
    csi_score: csiScore,
    csi_stage: csiStage,
    lbi_score: lbiScore,
    lbi_style: lbiStyle,
    dropout_risk: dropoutRisk,
    burnout_probability: burnoutProb,
    employability_readiness: employability,
    leadership_emergence: leadership,
    emotional_load: emotionalLoad,
    cognitive_load: cognitiveLoad,
    engagement_score: engagementScore,
    risk_score: riskScore,
    composite_intensity: compositeIntensity,
    behavioural_state: behaviouralState,
    cognitive_state: cognitiveState,
    emotional_state: emotionalState,
    resilience_state: resilienceState,
    risk_profile: riskProfile,
    opportunity_profile: oppProfile,
    crisis_detected: crisisDetected,
    crisis_type: crisisType,
    sessions_completed: sessionsCompleted,
    latest_concern: latestConcern,
    early_warnings: earlyWarnings,
    dominant_signals: dominantSignals,
    trajectory: traj?.trajectory_type || 'unknown',
  };

  // Upsert context with tenant isolation (skipped when persist=false, e.g. counterfactual simulation)
  if (persist) await pool.query(`
    INSERT INTO rie_intervention_context
      (user_email, tenant_id, session_id, behavioural_state, cognitive_state, emotional_state, resilience_state,
       risk_profile, opportunity_profile, csi_score, csi_stage, lbi_score,
       dropout_risk, burnout_probability, employability_readiness, leadership_emergence,
       emotional_load, cognitive_load, engagement_score, risk_score, composite_intensity,
       crisis_detected, crisis_type, computed_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,NOW(),NOW())
    ON CONFLICT (user_email, tenant_id) DO UPDATE SET
      session_id=$3, behavioural_state=$4, cognitive_state=$5, emotional_state=$6,
      resilience_state=$7, risk_profile=$8, opportunity_profile=$9,
      csi_score=$10, csi_stage=$11, lbi_score=$12,
      dropout_risk=$13, burnout_probability=$14, employability_readiness=$15,
      leadership_emergence=$16, emotional_load=$17, cognitive_load=$18,
      engagement_score=$19, risk_score=$20, composite_intensity=$21,
      crisis_detected=$22, crisis_type=$23, updated_at=NOW(),
      context_version = rie_intervention_context.context_version + 1
  `, [
    emailLower, effectiveTenant, sessionId || null,
    JSON.stringify(behaviouralState), JSON.stringify(cognitiveState),
    JSON.stringify(emotionalState), JSON.stringify(resilienceState),
    JSON.stringify(riskProfile), JSON.stringify(oppProfile),
    csiScore, csiStage, lbiScore,
    dropoutRisk, burnoutProb, employability, leadership,
    emotionalLoad, cognitiveLoad, engagementScore, riskScore, compositeIntensity,
    crisisDetected, crisisType,
  ]);

  return ctx;
}
