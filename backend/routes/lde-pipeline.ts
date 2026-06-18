/**
 * LDE Pipeline — Real-time Longitudinal Development Engine integration
 * Called non-blocking from postCompletionHooks after every CAPADEX session completes.
 *
 * Responsibilities:
 *  1. Map session scores → LDE feature dimensions
 *  2. Upsert the feature store
 *  3. Record a timeline checkpoint
 *  4. Compute momentum
 *  5. Scan for drift
 *  6. Record identity checkpoint (confidence + self_efficacy proxies)
 *  7. Ingest TRAJECTORY_UPDATED + SIGNAL_CAPTURED events
 */

import { Pool } from 'pg';

// Stage weights for resilience/developmental maturity proxy
const STAGE_MATURITY: Record<string, number> = {
  CAP_CUR: 0.25,
  CAP_INS: 0.50,
  CAP_GRW: 0.75,
  CAP_MAS: 1.00,
};

// Concern category → dimensional weight boosts
const CONCERN_DIM_WEIGHTS: Record<string, { behavioural: number; emotional: number; cognitive: number; social: number }> = {
  digital:     { behavioural: 1.2, emotional: 0.8, cognitive: 1.0, social: 0.9 },
  academic:    { behavioural: 0.9, emotional: 0.8, cognitive: 1.3, social: 0.8 },
  emotional:   { behavioural: 0.8, emotional: 1.3, cognitive: 0.9, social: 1.0 },
  behavioural: { behavioural: 1.3, emotional: 0.9, cognitive: 1.0, social: 0.8 },
  social:      { behavioural: 0.9, emotional: 1.0, cognitive: 0.8, social: 1.3 },
  career:      { behavioural: 1.0, emotional: 0.9, cognitive: 1.1, social: 1.1 },
  general:     { behavioural: 1.0, emotional: 1.0, cognitive: 1.0, social: 1.0 },
};

function categorizeConcern(concern: string): string {
  const l = concern.toLowerCase();
  if (/screen|phone|gaming|social.?media|digital|internet|device|app\b|online/.test(l)) return 'digital';
  if (/study|exam|homework|academic|school|grade|learning|class|marks|syllab/.test(l)) return 'academic';
  if (/anxiety|stress|emotion|mood|depress|worry|fear|loneli|mental|wellbeing/.test(l)) return 'emotional';
  if (/focus|attent|distract|concentrat|procrastinat|impulsiv|hyperactiv|restless/.test(l)) return 'behavioural';
  if (/social|peer|friend|relation|communicat|conflict|bully|shy/.test(l)) return 'social';
  if (/career|job|employ|skill|workplace|interview|profession/.test(l)) return 'career';
  return 'general';
}

/**
 * Derive LDE dimensional scores from a completed CAPADEX session.
 * Returns scores on 0-100 scale for each LDE dimension.
 */
function deriveDimensions(score: number, stageCode: string, concernName: string, subdomainAvgs: Record<string, number>) {
  const maturity = STAGE_MATURITY[stageCode] || 0.5;
  const cat = categorizeConcern(concernName);
  const w = CONCERN_DIM_WEIGHTS[cat] || CONCERN_DIM_WEIGHTS.general;

  // Use subdomain averages when available, fall back to overall score × weight
  const subKeys = Object.keys(subdomainAvgs);
  const subAvg = subKeys.length > 0
    ? subKeys.reduce((s, k) => s + subdomainAvgs[k], 0) / subKeys.length
    : score;

  const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v)));

  return {
    behavioural:   clamp(subAvg * w.behavioural),
    emotional:     clamp(subAvg * w.emotional),
    resilience:    clamp(subAvg * maturity * 1.1),
    employability: clamp(subAvg * (cat === 'career' ? 1.15 : 0.85)),
    leadership:    clamp(subAvg * maturity * (stageCode === 'CAP_MAS' ? 1.2 : 0.9)),
    cognitive:     clamp(subAvg * w.cognitive),
  };
}

/**
 * Fetch per-subdomain average scores for a completed session.
 */
async function fetchSubdomainScores(pool: Pool, sessionId: string): Promise<Record<string, number>> {
  try {
    const r = await pool.query(`
      SELECT
        COALESCE(si.subdomain_code, sa.subdomain_code, 'general') AS subdomain,
        AVG(cr.response_value::numeric) AS avg_score
      FROM capadex_responses cr
      LEFT JOIN sdi_items si ON si.id::text = cr.item_id
      LEFT JOIN short_assessment_questions sa ON sa.id::text = cr.item_id
      WHERE cr.session_id = $1
        AND cr.response_value IS NOT NULL
      GROUP BY 1
    `, [sessionId]);
    const out: Record<string, number> = {};
    for (const row of r.rows) {
      if (row.subdomain) out[row.subdomain] = parseFloat(row.avg_score) || 0;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Main LDE pipeline — runs after every CAPADEX session completion.
 * Uses email as the stable cross-system user identifier.
 */
export async function runLDEPipeline(
  pool: Pool,
  email: string,
  sessionId: string,
  stageCode: string,
  score: number,
  scoreLevel: string,
  concernName: string
): Promise<void> {
  const userId = email.toLowerCase().trim();

  // 1. Fetch subdomain scores for richer dimensional mapping
  const subdomainAvgs = await fetchSubdomainScores(pool, sessionId);

  const dims = deriveDimensions(score, stageCode, concernName, subdomainAvgs);

  // 2. Upsert feature store
  // Read existing record first so we can accumulate sessions_completed
  const existingR = await pool.query(
    `SELECT developmental_features FROM lde_feature_store WHERE user_id=$1`,
    [userId]
  );
  const existingDev = existingR.rows[0]?.developmental_features || {};
  const previousSessions = typeof existingDev.sessions_completed === 'number'
    ? existingDev.sessions_completed : 0;

  const behavioural_features = {
    score: dims.behavioural,
    concern_category: categorizeConcern(concernName),
    stage: stageCode,
    score_level: scoreLevel,
  };
  const resilience_features = {
    score: dims.resilience,
    stage_maturity: STAGE_MATURITY[stageCode] || 0.5,
  };
  const emotional_features = {
    score: dims.emotional,
    concern: concernName,
  };
  const developmental_features = {
    score: dims.resilience,
    stage: stageCode,
    sessions_completed: previousSessions + 1,
  };
  const cognitive_features = {
    score: dims.cognitive,
  };

  await pool.query(`
    INSERT INTO lde_feature_store
      (user_id, tenant_id, behavioural_features, resilience_features, emotional_features,
       developmental_features, cognitive_features, biomarkers, entropy_score, coverage_pct, feature_version)
    VALUES ($1, NULL, $2, $3, $4, $5, $6, '{}', 0.1, 0.7, 1)
    ON CONFLICT (user_id) DO UPDATE SET
      behavioural_features  = EXCLUDED.behavioural_features,
      resilience_features   = EXCLUDED.resilience_features,
      emotional_features    = EXCLUDED.emotional_features,
      developmental_features= EXCLUDED.developmental_features,
      cognitive_features    = EXCLUDED.cognitive_features,
      coverage_pct          = LEAST(1.0, lde_feature_store.coverage_pct + 0.05),
      feature_version       = lde_feature_store.feature_version + 1,
      computed_at           = NOW()
  `, [
    userId,
    JSON.stringify(behavioural_features),
    JSON.stringify(resilience_features),
    JSON.stringify(emotional_features),
    JSON.stringify(developmental_features),
    JSON.stringify(cognitive_features),
  ]);

  // 3. Record timeline entry
  const today = new Date().toISOString().split('T')[0];
  await pool.query(`
    INSERT INTO lde_timelines
      (user_id, tenant_id, checkpoint_date, behavioural_score, emotional_score, resilience_score,
       employability_score, leadership_score, intervention_count, milestone_flags, notes)
    VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, 0, $8, $9)
  `, [
    userId, today,
    dims.behavioural, dims.emotional, dims.resilience,
    dims.employability, dims.leadership,
    JSON.stringify([`stage:${stageCode}`, `level:${scoreLevel}`]),
    `CAPADEX session ${sessionId} — ${concernName} (${stageCode})`,
  ]);

  // 4. Compute momentum from last 2 timeline entries
  // Order by checkpoint_date + created_at for deterministic ordering when multiple sessions occur on the same day
  const timelineR = await pool.query(`
    SELECT * FROM lde_timelines WHERE user_id=$1 ORDER BY checkpoint_date DESC, created_at DESC LIMIT 6
  `, [userId]);
  const timeline = timelineR.rows;
  let velocity = 0;
  if (timeline.length >= 2) {
    const prev = timeline[1];
    velocity = ((dims.behavioural) - (prev.behavioural_score || 50)) / 100;
  } else {
    velocity = (dims.behavioural - 50) / 100;
  }
  const stability    = Math.min(1, 0.5 + (score / 200));
  const sustainability = Math.min(1, 0.4 + (STAGE_MATURITY[stageCode] || 0.5) * 0.5);
  const momentum     = parseFloat((velocity * 0.5 + stability * 0.3 + sustainability * 0.2).toFixed(3));
  const momentumState = momentum > 0.5 && velocity > 0.2 ? 'acceleration'
    : momentum > 0.4 && velocity > 0 ? 'stable'
    : velocity > 0.3 ? 'breakthrough'
    : velocity < -0.3 ? 'collapse'
    : velocity < -0.1 ? 'stagnation'
    : 'recovery';

  await pool.query(`
    INSERT INTO lde_momentum
      (user_id, tenant_id, growth_velocity, stability_score, sustainability_score,
       momentum_score, momentum_state, trend_direction, forecast_30d)
    VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8)
  `, [
    userId, velocity, stability, sustainability, momentum, momentumState,
    velocity > 0 ? 'upward' : velocity < 0 ? 'downward' : 'lateral',
    Math.min(1, Math.max(0, momentum + 0.05)),
  ]);

  // 5. Scan for drift — compare current dims vs previous timeline entry
  if (timeline.length >= 2) {
    const prev = timeline[1];
    const driftTypes: Array<{ type: string; current: number; prev: number }> = [
      { type: 'behavioural', current: dims.behavioural, prev: prev.behavioural_score || 50 },
      { type: 'emotional',   current: dims.emotional,   prev: prev.emotional_score   || 50 },
      { type: 'resilience',  current: dims.resilience,  prev: prev.resilience_score  || 50 },
    ];

    for (const d of driftTypes) {
      const baseline = d.prev / 100;
      const current  = d.current / 100;
      const magnitude = parseFloat(Math.abs(current - baseline).toFixed(3));
      if (magnitude > 0.08) {
        const sev = magnitude > 0.3 ? 'critical' : magnitude > 0.2 ? 'high' : magnitude > 0.12 ? 'medium' : 'low';
        const silent = current < baseline && magnitude > 0.15;
        await pool.query(`
          INSERT INTO lde_drift
            (user_id, tenant_id, drift_type, drift_severity, drift_magnitude, baseline_value, current_value,
             silent_deterioration_flag, days_drifting, intervention_urgency)
          VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          userId, d.type, sev, magnitude, baseline, current, silent,
          1,
          sev === 'critical' ? 'immediate' : sev === 'high' ? 'urgent' : 'monitor',
        ]);

        if (sev === 'critical' || silent) {
          await pool.query(`
            INSERT INTO lde_events (user_id, tenant_id, event_type, event_payload, source)
            VALUES ($1, NULL, 'DRIFT_DETECTED', $2, 'lde_pipeline')
          `, [userId, JSON.stringify({ drift_type: d.type, severity: sev, silent, magnitude, session_id: sessionId })]);
        }
      }
    }
  }

  // 6. Identity checkpoint — confidence and self_efficacy proxies from scores
  const confidenceProxy   = parseFloat((score / 100).toFixed(3));
  const selfEfficacyProxy = parseFloat(((score + (STAGE_MATURITY[stageCode] || 0.5) * 20) / 120).toFixed(3));
  const aspirationProxy   = parseFloat(Math.min(1, selfEfficacyProxy + 0.1).toFixed(3));
  const motivationProxy   = parseFloat(Math.min(1, confidenceProxy + 0.05).toFixed(3));

  await pool.query(`
    INSERT INTO lde_identity_evolution
      (user_id, tenant_id, checkpoint_date, confidence_score, self_efficacy_score,
       aspiration_score, motivation_score, identity_coherence, breakthrough_flag, shift_detected, notes)
    VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `, [
    userId, today,
    confidenceProxy, selfEfficacyProxy,
    aspirationProxy, motivationProxy,
    parseFloat(Math.min(0.95, (confidenceProxy + selfEfficacyProxy) / 2).toFixed(3)),
    score >= 80,
    true,
    `Proxy from ${stageCode} score ${score} — ${concernName}`,
  ]);

  // 7. Ingest LDE events
  await pool.query(`
    INSERT INTO lde_events (user_id, tenant_id, event_type, event_payload, source)
    VALUES ($1, NULL, 'SIGNAL_CAPTURED', $2, 'capadex_session')
  `, [userId, JSON.stringify({
    session_id: sessionId,
    stage: stageCode,
    score,
    score_level: scoreLevel,
    concern: concernName,
    dimensions: dims,
  })]);

  await pool.query(`
    INSERT INTO lde_events (user_id, tenant_id, event_type, event_payload, source)
    VALUES ($1, NULL, 'TRAJECTORY_UPDATED', $2, 'capadex_session')
  `, [userId, JSON.stringify({
    session_id: sessionId,
    stage: stageCode,
    momentum_state: momentumState,
    momentum,
    velocity,
    checkpoint_date: today,
  })]);
}
