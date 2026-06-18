/**
 * OMEGA-X Report Builder (shared service)
 *
 * Aggregates the full OMEGA-X enriched report for a completed CAPADEX session:
 *   - Base report data (score, subdomains, narrative)
 *   - Behavioural ontology (causal chain, triggers, protective factors)
 *   - Psychometric calibration (z-score, percentile, confidence interval)
 *   - Safety validation (status, flags, escalation message)
 *   - Intervention sequence (phase-ordered, fatigue-aware)
 *   - Stage-differentiated narrative contract
 *   - AI quality validation, contradiction intelligence, longitudinal memory,
 *     forecast agent, report intelligence, explainability chain
 *
 * Extracted from the GET /api/capadex/report/:session_id/omega route so the same
 * aggregation can be reused by the report email send/preview path. Returns `null`
 * only when the report is not found; throws on genuine errors so callers can
 * distinguish "no data" from "failure".
 */

import type { Pool } from 'pg';
import { OntologyEngine } from './ontology-engine';
import { PsychometricCalibrationEngine } from './psychometric-calibration';
import { validateReport } from './safety-layer';
import { sequenceInterventions, type SequencedIntervention } from './intervention-sequencer';
import { buildMemory } from './longitudinal-memory';
import { validateReportQuality } from './quality-validator';

export async function buildOmegaReport(
  pool: Pool,
  session_id: string,
): Promise<Record<string, unknown> | null> {
  const ontologyEngine = new OntologyEngine(pool);
  const calibrationEngine = new PsychometricCalibrationEngine(pool);

  // 1. Load base report
  const reportRes = await pool.query(
    `SELECT cr.*, cs.concern_name, cs.stage_code,
            COALESCE(cu.email, cs.guest_email) AS email
     FROM capadex_reports cr
     JOIN capadex_sessions cs ON cr.session_id = cs.id
     LEFT JOIN capadex_users cu ON cr.user_id = cu.id
     WHERE cr.session_id = $1`,
    [session_id],
  );

  if (!reportRes.rows.length) {
    return null;
  }

  const base = reportRes.rows[0];

  // 2. Load subdomains
  // Canonical subdomain roll-up — mirrors GET /report and POST /complete. The schema
  // routes numeric item_ids to short_assessment_questions (integer id) and uuid item_ids
  // to sdi_items, then resolves the human label via sdi_subdomains.
  const subRes = await pool.query(
    `SELECT
       COALESCE(ss.subdomain_name, saq.dimension, si.subdomain_code) AS subdomain_name,
       ROUND(AVG(cr.raw_score)::numeric, 2) AS avg_score,
       COUNT(*)::int AS item_count
     FROM capadex_responses cr
     LEFT JOIN sdi_items si
       ON si.id = cr.item_id
       AND cr.item_id::text !~ '^[0-9]+$'
     LEFT JOIN short_assessment_questions saq
       ON saq.id::text = cr.item_id::text
       AND cr.item_id::text ~ '^[0-9]+$'
     LEFT JOIN sdi_subdomains ss
       ON ss.subdomain_code = COALESCE(si.subdomain_code, saq.dimension)
     WHERE cr.session_id = $1::uuid
       AND COALESCE(si.subdomain_code, saq.dimension) IS NOT NULL
     GROUP BY COALESCE(si.subdomain_code, saq.dimension),
              COALESCE(ss.subdomain_name, saq.dimension, si.subdomain_code)
     ORDER BY subdomain_name`,
    [session_id],
  );

  const subdomains = subRes.rows;
  const scoreNum = Number(base.score_override ?? base.score ?? 0);
  const scoreLevel = base.score_level ?? scoreLevelFromScore(scoreNum);
  const concernName = base.concern_name ?? 'Behavioural Pattern';
  const stageCode = base.stage_code ?? 'CAP_CUR';
  const STAGE_LABELS: Record<string, string> = { CAP_CUR: 'Curiosity', CAP_INS: 'Insight', CAP_GRW: 'Growth', CAP_MAS: 'Mastery' };
  const stageLabel = STAGE_LABELS[stageCode] ?? stageCode;
  const participantName = base.participant_name ?? 'Participant';

  // 3. Resolve concern category
  const category = ontologyEngine.resolveConcernCategory(concernName);

  // 4. Run all enrichment engines in parallel — ontology, calibration, signal profile,
  //    contradiction events, and longitudinal memory all resolve concurrently
  const userEmail = (base.email ?? '').trim();

  const [sessionOntology, calibration, signalRes, contradictionRes, memory] = await Promise.all([
    ontologyEngine.buildSessionOntology(
      session_id, concernName, scoreLevel,
      Object.fromEntries(subdomains.map((s: { subdomain_name: string; avg_score: string }) =>
        [s.subdomain_name, Number(s.avg_score)],
      )),
    ),
    calibrationEngine.calibrateSession(
      session_id, scoreNum, category, stageCode,
      subdomains, subdomains.reduce((acc: number, s: { item_count: string }) => acc + Number(s.item_count), 0),
    ),
    pool.query(
      `SELECT cognitive_load, emotional_load FROM capadex_signal_profiles
       WHERE session_id = $1 LIMIT 1`,
      [session_id],
    ),
    // Contradiction events for this session (up to 10 most recent)
    pool.query(
      `SELECT contradiction_type, severity, description, recommended_action,
              contradiction_score, affected_subdomains, created_at
       FROM contradiction_events
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [session_id],
    ).catch(() => ({ rows: [] })),
    // Longitudinal memory — only fetch when email is known; gracefully returns empty on first session
    userEmail
      ? buildMemory(pool, userEmail, session_id).catch(() => null)
      : Promise.resolve(null),
  ]);

  // 5. Safety validation
  const narrativeTexts = [
    base.narrative_override ?? base.insight ?? '',
    base.headline_override ?? '',
  ].filter(Boolean);
  const safety = validateReport(narrativeTexts, participantName);

  const cogLoad = signalRes.rows[0]?.cognitive_load ?? 40;
  const emoLoad = signalRes.rows[0]?.emotional_load ?? 40;

  // 6. Intervention sequencing
  const sequenced = sequenceInterventions({
    concern_category: category,
    score_level: scoreLevel as 'Emerging' | 'Developing' | 'Proficient' | 'Advanced',
    safety_status: safety.safety_status,
    cognitive_load: Number(cogLoad),
    emotional_load: Number(emoLoad),
  });

  // 7. Stage-differentiated narrative contract
  const stageContract = buildStageContract(
    stageCode, scoreLevel, scoreNum, concernName,
    participantName, sessionOntology.causal_chain,
    sessionOntology.trigger_nodes, sessionOntology.protective_nodes,
    calibration,
  );

  // 8. Confidence rendering per insight
  const insightConfidence = buildInsightConfidence(
    scoreNum, calibration.reliability_score,
    calibration.response_consistency, subdomains.length,
  );

  // 9. AI Quality Validation — runs after all data is ready
  const qualityValidation = validateReportQuality({
    narrative_texts: narrativeTexts,
    score: scoreNum,
    score_level: scoreLevel,
    subdomain_count: subdomains.length,
    calibration_reliability: calibration.reliability_score,
    calibration_percentile: calibration.overall_percentile,
    interventions: sequenced.map(i => ({
      action: i.description,
      type: i.domain,
      why: i.why_it_works,
    })),
  });

  // 10. Shape contradictions for the report
  const contradictions = (contradictionRes.rows as Array<{
    contradiction_type: string;
    severity: string;
    description: string;
    recommended_action: string;
    contradiction_score: number;
    affected_subdomains: string[] | null;
    created_at: string;
  }>).map(c => ({
    type: c.contradiction_type,
    severity: c.severity,
    description: c.description,
    recommended_action: c.recommended_action,
    contradiction_score: Number(c.contradiction_score),
    affected_subdomains: c.affected_subdomains ?? [],
    detected_at: c.created_at,
  }));

  // 11. Shape longitudinal memory for report (strip raw arrays to avoid payload bloat)
  const longitudinalMemory = memory
    ? {
        session_count: memory.session_count,
        first_seen: memory.first_seen,
        last_seen: memory.last_seen,
        behavioural_drift: memory.behavioural_drift,
        recurring_constructs: memory.recurring_constructs.slice(0, 5),
        resilience_recoveries: memory.resilience_recoveries.slice(0, 3),
        growth_patterns: memory.growth_patterns.slice(0, 3),
        burnout_periods: memory.burnout_periods.slice(0, 2),
        is_returning_user: memory.session_count > 1,
      }
    : null;

  // 12. Forecast agent — forward-looking trajectory
  const forecastData = buildForecast({
    score: scoreNum, scoreLevel, stageCode,
    cognitiveLoad: Number(cogLoad), emotionalLoad: Number(emoLoad),
    memory: longitudinalMemory,
  });

  // 13. Explainability chain — per-subdomain Observation → Intervention
  const explainabilityChain = buildExplainabilityChain(subdomains, category, scoreLevel, concernName);

  // 14. Report intelligence — 12-field spec-compliant narrative structure
  const reportIntelligence = buildReportIntelligence({
    score: scoreNum, scoreLevel, stageCode, concernName,
    participantName: base.participant_name ?? 'Participant',
    triggerNodes: sessionOntology.trigger_nodes as { label: string; description: string }[],
    protectiveNodes: sessionOntology.protective_nodes as { label: string; description: string }[],
    causalChain: sessionOntology.causal_chain as { from_label: string; to_label: string; explanation: string }[],
    calibration,
    sequenced,
    forecastData,
    category,
  });

  // 15. Compose final response
  const omegaReport = {
    // Base
    session_id,
    report_id: base.id,
    concern_name: concernName,
    stage_code: stageCode,
    stage_label: stageLabel,
    score: scoreNum,
    score_level: scoreLevel,
    participant_name: participantName,
    participant_age: base.participant_age,
    generated_at: new Date().toISOString(),

    // Ontology
    ontology: {
      concern_category: category,
      causal_chain: sessionOntology.causal_chain,
      trigger_nodes: sessionOntology.trigger_nodes,
      protective_nodes: sessionOntology.protective_nodes,
      active_node_count: sessionOntology.active_node_keys.length,
    },

    // Calibration
    calibration: {
      overall_percentile: calibration.overall_percentile,
      z_score: calibration.overall_z_score,
      confidence_interval: [calibration.confidence_interval_low, calibration.confidence_interval_high],
      reliability_score: calibration.reliability_score,
      response_consistency: calibration.response_consistency,
      cohort_label: calibration.cohort_label,
      cohort_size: calibration.cohort_size,
      uniqueness_score: calibration.uniqueness_score,
      subdomain_calibration: calibration.subdomain_calibration,
    },

    // Safety
    safety: {
      status: safety.safety_status,
      flags: safety.safety_flags,
      escalation_message: safety.escalation_message,
      validated_narrative: safety.sanitised_text || (base.narrative_override ?? base.insight ?? ''),
    },

    // Intervention sequence
    intervention_sequence: sequenced,

    // Stage-differentiated contract
    stage_contract: stageContract,

    // Insight confidence
    insight_confidence: insightConfidence,

    // ── AI Quality Validation ──────────────────────────────────────────────
    quality_validation: {
      gate: qualityValidation.gate,
      overall_score: qualityValidation.overall_score,
      summary: qualityValidation.summary,
      dimensions: {
        narrative:    { score: qualityValidation.narrative_quality.score,    issues: qualityValidation.narrative_quality.issues },
        scientific:   { score: qualityValidation.scientific_quality.score,   issues: qualityValidation.scientific_quality.issues },
        safety:       { score: qualityValidation.safety_quality.score,       issues: qualityValidation.safety_quality.issues },
        intervention: { score: qualityValidation.intervention_quality.score, issues: qualityValidation.intervention_quality.issues },
        readability:  { score: qualityValidation.readability_score.score,    issues: qualityValidation.readability_score.issues },
      },
      validated_at: qualityValidation.validated_at,
    },

    // ── Contradiction Intelligence ─────────────────────────────────────────
    contradictions: {
      count: contradictions.length,
      has_contradictions: contradictions.length > 0,
      reliability_impact: contradictions.length === 0
        ? 'none'
        : contradictions.some(c => c.severity === 'high') ? 'significant'
        : contradictions.some(c => c.severity === 'medium') ? 'moderate' : 'minor',
      events: contradictions,
      interpretation: contradictions.length === 0
        ? 'Your responses showed strong internal consistency throughout the assessment.'
        : contradictions.length <= 2
        ? 'Minor response variations were detected. These are common and do not significantly affect your results.'
        : 'Some response inconsistencies were detected. Your results remain directionally valid — these patterns have been factored into your confidence score.',
    },

    // ── Longitudinal Memory ────────────────────────────────────────────────
    longitudinal_memory: longitudinalMemory,

    // ── Forecast Agent ─────────────────────────────────────────────────────
    forecast: forecastData,

    // ── Report Intelligence (12-field spec structure) ──────────────────────
    report_intelligence: reportIntelligence,

    // ── Explainability Chain (per-subdomain) ───────────────────────────────
    explainability_chain: explainabilityChain,

    // Raw subdomains for charts (with emotional load)
    subdomains: subdomains.map((s: { subdomain_name: string; avg_score: string; item_count: string }) => ({
      name: s.subdomain_name,
      score: Math.round(Number(s.avg_score)),
      item_count: Number(s.item_count),
      calibration: calibration.subdomain_calibration[s.subdomain_name] ?? null,
    })),

    // ── Section 5: Canonical sample output (simple text fields for client rendering) ──
    canonical: {
      recognition: {
        text: reportIntelligence.recognition
          ? (reportIntelligence.recognition as { body?: string }).body ?? ''
          : `Your ${concernName} pattern has been mapped — and it is more structured than it may feel.`,
      },
      reassurance: {
        text: reportIntelligence.reassurance
          ? (reportIntelligence.reassurance as { body?: string }).body ?? ''
          : `This pattern is common in people navigating similar pressures. It has a structure — and structures can be changed.`,
      },
      meaning: {
        text: reportIntelligence.meaning
          ? (reportIntelligence.meaning as { daily_experience?: string }).daily_experience ?? ''
          : `Your results show specific areas of strength alongside clear opportunities for targeted development.`,
      },
      severity: {
        level: scoreLevel.toLowerCase(),
        text: `Your ${scoreLevel} result in ${concernName} means ${
          scoreLevel === 'Emerging'   ? 'the pattern is active and affecting your daily experience — this is where the highest-leverage change is possible.' :
          scoreLevel === 'Developing' ? 'you have a partial foundation — the gaps are specific and addressable with targeted effort.' :
          scoreLevel === 'Proficient' ? 'you are above the benchmark threshold — the remaining work is efficiency, not remediation.' :
          'you are performing strongly in this area — the focus is compounding strengths into adjacent domains.'
        }`,
      },
      interventions: sequenced.slice(0, 3).map(iv => ({
        title: iv.title,
        why: iv.why_it_works,
        action: iv.description,
        difficulty: iv.effort_required,
        timeline: iv.timing,
      })),
      forecast: {
        text: forecastData.outlook_6_weeks,
      },
    },

    // ── Section 12: Report versioning ───────────────────────────────────────
    report_version: '2.1-omega',
    scoring_version: '1.4-calibrated',
    schema_version: 1,
  };

  return omegaReport;
}

/**
 * Telemetry signals captured during the assessment run (per-item hesitation +
 * backtracks). Sourced from `capadex_sessions.omega_x_payload._telemetry_inputs`.
 */
export interface OmegaTelemetryInputs {
  avg_hesitation_ms: number;
  total_backtracks: number;
  telemetry_rows: number;
}

/**
 * Loads the OMEGA-X report plus run telemetry for the report email path. Both are
 * best-effort: a missing/failed omega report or telemetry simply returns
 * `undefined` so the email degrades gracefully (OMEGA-X sections hide) rather
 * than blocking delivery.
 */
export async function buildOmegaEmailExtras(
  pool: Pool,
  session_id: string,
): Promise<{ omega?: Record<string, unknown>; telemetry?: OmegaTelemetryInputs }> {
  const [omega, telRes] = await Promise.all([
    buildOmegaReport(pool, session_id).catch(() => null),
    pool.query(
      `SELECT omega_x_payload->'_telemetry_inputs' AS t FROM capadex_sessions WHERE id = $1 LIMIT 1`,
      [session_id],
    ).catch(() => ({ rows: [] as Array<{ t: unknown }> })),
  ]);

  const t = telRes.rows[0]?.t as Partial<OmegaTelemetryInputs> | null | undefined;
  const telemetry = t && Number(t.telemetry_rows) > 0
    ? {
        avg_hesitation_ms: Number(t.avg_hesitation_ms) || 0,
        total_backtracks: Number(t.total_backtracks) || 0,
        telemetry_rows: Number(t.telemetry_rows) || 0,
      }
    : undefined;

  return { omega: omega ?? undefined, telemetry };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreLevelFromScore(score: number): string {
  if (score >= 80) return 'Advanced';
  if (score >= 65) return 'Proficient';
  if (score >= 40) return 'Developing';
  return 'Emerging';
}

function buildStageContract(
  stageCode: string,
  scoreLevel: string,
  score: number,
  concernName: string,
  participantName: string,
  causalChain: unknown[],
  triggerNodes: { label: string; description: string }[],
  protectiveNodes: { label: string; description: string }[],
  calibration: { overall_percentile: number; cohort_label: string; reliability_score: number },
): Record<string, unknown> {
  const firstName = participantName.split(' ')[0];

  const base = {
    stage: stageCode,
    score_level: scoreLevel,
    first_name: firstName,
    concern_name: concernName,
  };

  if (stageCode === 'CAP_CUR') {
    return {
      ...base,
      purpose: 'Recognition + trust + emotional safety',
      sections: {
        recognition: {
          headline: `${firstName}, your ${concernName} pattern is real — and it makes sense.`,
          body: `What you've been experiencing isn't a character flaw or a willpower problem. Your results show a ${scoreLevel.toLowerCase()} pattern that ${score < 50 ? 'many people share without ever identifying' : 'is worth understanding at a deeper level'}. The fact that you looked is already meaningful.`,
          normalisation_note: `${calibration.cohort_label}. Your results place you in a profile that responds well to structured, personalised intervention.`,
        },
        strength_discovery: {
          headline: 'What your profile already shows',
          body: protectiveNodes.length > 0
            ? `Your results reveal ${protectiveNodes[0]?.label ?? 'genuine protective factors'} — a real foundation that many people at this stage don't have. This matters for how quickly things can shift.`
            : `Even at this stage, your self-awareness and willingness to engage is itself a protective factor that predicts better outcomes.`,
        },
        micro_interventions: {
          headline: 'One thing you can do today',
          body: `Before anything else, do one small thing: notice the moment the pattern starts — not when it's in full swing, but right before. That pause is where change happens.`,
        },
        future_possibility: {
          headline: 'What becomes possible',
          body: `"${concernName}" stops being something you manage and becomes something you've resolved. That's a realistic outcome — not because the problem is small, but because the pattern is understandable.`,
        },
      },
    };
  }

  if (stageCode === 'CAP_INS') {
    const primaryTrigger = triggerNodes[0];
    const primaryCause = (causalChain as { from_label: string; to_label: string; explanation: string }[])[0];
    return {
      ...base,
      purpose: 'Root-cause revelation + trigger intelligence',
      sections: {
        root_cause: {
          headline: 'Why this pattern keeps repeating',
          body: primaryCause
            ? `Your results point to ${primaryCause.from_label} as a primary driver. ${primaryCause.explanation}`
            : `The pattern isn't random — it's a loop. Something triggers it, something reinforces it, and willpower alone can't break a loop.`,
        },
        trigger_map: {
          headline: 'What sets it off',
          primary_trigger: primaryTrigger?.label ?? 'Context-dependent triggers',
          trigger_description: primaryTrigger?.description ?? 'Specific situational or environmental cues that initiate the pattern.',
          why_it_matters: `Identifying the trigger is 50% of the solution — you can\'t interrupt what you can\'t see.`,
        },
        why_previous_attempts_failed: {
          headline: 'Why it hasn\'t changed yet',
          body: `Most approaches to "${concernName}" target the behaviour directly — but the behaviour is downstream of the trigger and the reinforcement loop. Addressing only the behaviour is like cutting a weed at the stem. The root remains.`,
        },
        intervention_blueprint: {
          headline: 'What actually works',
          body: `The intervention science is clear: ${scoreLevel === 'Emerging' ? 'environment change precedes behaviour change — start there' : scoreLevel === 'Developing' ? 'pattern awareness + structured replacement is the evidence-based path' : 'targeted strategy refinement builds on the foundation you already have'}.`,
        },
        benchmark: {
          percentile: calibration.overall_percentile,
          cohort_label: calibration.cohort_label,
          reliability: calibration.reliability_score,
          interpretation: `Your results are based on ${Math.round(calibration.reliability_score * 100)}% reliability. ${calibration.reliability_score > 0.8 ? 'High confidence in these findings.' : 'These are strong indicators — a full assessment would confirm the full picture.'}`,
        },
      },
    };
  }

  if (stageCode === 'CAP_GRW') {
    return {
      ...base,
      purpose: 'Behavioural transformation execution',
      sections: {
        momentum: {
          headline: 'Where you are in the change arc',
          body: `You\'re at the point where understanding meets execution. The pattern is visible to you now — that visibility is leverage. The question is: what do you do with it consistently?`,
        },
        relapse_detection: {
          headline: 'What to watch for',
          body: `Relapse in behavioural patterns is most likely in the first 3 weeks — when the new behaviour is forming but the old trigger hasn\'t changed. The risk signals are: missing 2+ consecutive days, high stress periods, and environmental disruption.`,
          early_warnings: protectiveNodes.length === 0
            ? ['No active protective factors detected — external accountability structure recommended']
            : protectiveNodes.map(p => `${p.label} — ${p.description}`),
        },
        resilience_evolution: {
          headline: 'How to make this last',
          body: `Sustained change requires three things: a strategy that fits your actual pattern (not a generic one), a system for catching slips early, and an identity shift — from "I am trying to change X" to "I am someone who does Y."`,
        },
        identity_reconstruction: {
          headline: 'The identity shift',
          body: `${firstName}, the most durable version of this change happens when the new behaviour stops feeling like effort and starts feeling like who you are. That shift takes 4–8 weeks of consistent practice — not perfection.`,
        },
      },
    };
  }

  if (stageCode === 'CAP_MAS') {
    return {
      ...base,
      purpose: 'Sustainable behavioural optimisation',
      sections: {
        mastery_index: {
          headline: 'Your mastery profile',
          score,
          percentile: calibration.overall_percentile,
          interpretation: score >= 80
            ? `You\'re performing in the top ${100 - calibration.overall_percentile}% of your peer group on this concern. The work now is refinement and compound growth.`
            : `You\'ve built real capability here. The mastery stage is about closing the remaining gaps with precision — not starting over.`,
        },
        burnout_prevention: {
          headline: 'Sustaining without burning out',
          body: `High performers in behavioural change are at risk of over-optimisation — applying too much pressure to areas that are already strong. The protective move is strategic rest and recovery cycles, not constant push.`,
        },
        compound_intelligence: {
          headline: 'What compounds from here',
          body: `The cognitive and emotional resources freed by resolving "${concernName}" compound into other areas. ${firstName}, that\'s the real return on this work — not just fixing one problem, but increasing your overall capacity.`,
        },
        leadership_influence: {
          headline: 'Beyond yourself',
          body: `At mastery level, your experience becomes useful to others. Mentoring someone earlier in the same pattern accelerates your own consolidation — and is one of the most effective ways to prevent regression.`,
        },
      },
    };
  }

  return { ...base, purpose: 'General behavioural assessment', sections: {} };
}

function buildInsightConfidence(
  score: number,
  reliability: number,
  consistency: number,
  subdomainCount: number,
): {
  overall: 'High' | 'Moderate' | 'Low';
  score: number;
  explanation: string;
  evidence_summary: string;
} {
  const confScore = (reliability * 0.4 + consistency * 0.4 + Math.min(subdomainCount / 6, 1) * 0.2);

  const level: 'High' | 'Moderate' | 'Low' =
    confScore >= 0.75 ? 'High' : confScore >= 0.55 ? 'Moderate' : 'Low';

  const explanations: Record<string, string> = {
    High: 'Your responses showed strong internal consistency across items and domains. These findings are reliable.',
    Moderate: 'Your responses were generally consistent with some variance across domains. The findings are directionally solid.',
    Low: 'There were some inconsistencies in your responses. Treat these findings as indicators rather than definitive conclusions.',
  };

  const evidence = [
    `${Math.round(reliability * 100)}% response reliability`,
    `${Math.round(consistency * 100)}% cross-domain consistency`,
    `${subdomainCount} behavioural domains assessed`,
  ].join(' · ');

  return {
    overall: level,
    score: parseFloat(confScore.toFixed(3)),
    explanation: explanations[level],
    evidence_summary: evidence,
  };
}

// ─── Forecast Agent ────────────────────────────────────────────────────────────

interface ForecastInput {
  score: number;
  scoreLevel: string;
  stageCode: string;
  cognitiveLoad: number;
  emotionalLoad: number;
  memory: { session_count: number; behavioural_drift?: { direction: string; slope: number } | null } | null;
}

export interface ForecastOutput {
  trajectory: 'improving' | 'stable' | 'plateauing' | 'declining' | 'volatile';
  outlook_6_weeks: string;
  outlook_3_months: string;
  recovery_timeline_weeks: number;
  growth_probability: number;
  risk_window: string;
  next_milestone: string;
  key_risk_factors: string[];
  key_growth_enablers: string[];
}

function buildForecast(input: ForecastInput): ForecastOutput {
  const { score, scoreLevel, stageCode, cognitiveLoad, emotionalLoad, memory } = input;

  // Infer trajectory from longitudinal drift or current load signals
  let trajectory: ForecastOutput['trajectory'] = 'stable';
  if (memory?.behavioural_drift) {
    const { direction, slope } = memory.behavioural_drift;
    if (direction === 'improving') trajectory = slope > 5 ? 'improving' : 'stable';
    else if (direction === 'declining') trajectory = slope > 5 ? 'declining' : 'plateauing';
  } else if (cognitiveLoad > 70 && emotionalLoad > 65) {
    trajectory = 'volatile';
  } else if (cognitiveLoad > 70 || emotionalLoad > 65) {
    trajectory = 'plateauing';
  }

  // Growth probability
  let gp = 60;
  if (scoreLevel === 'Emerging') gp -= 15;
  if (scoreLevel === 'Advanced') gp += 20;
  if (trajectory === 'improving') gp += 15;
  if (trajectory === 'declining') gp -= 20;
  if (cognitiveLoad > 70) gp -= 10;
  if (emotionalLoad > 65) gp -= 10;
  const growthProbability = Math.max(20, Math.min(95, gp));

  // Recovery timeline (weeks to reach next level)
  const recoveryWeeks = scoreLevel === 'Emerging' ? 8 : scoreLevel === 'Developing' ? 6 : scoreLevel === 'Proficient' ? 4 : 3;

  const riskWindowMap: Record<string, string> = {
    CAP_CUR: 'The first 2 weeks — before new patterns are established',
    CAP_INS: 'Weeks 2–4 during the shift from awareness to action',
    CAP_GRW: 'High-stress periods and disruptions in weeks 3–6',
    CAP_MAS: 'After reaching goals — the maintenance plateau around week 8',
  };

  const milestones: Record<string, string> = {
    Emerging: 'Move from pattern awareness to first consistent behavioural change (target: 2–3 weeks)',
    Developing: 'Establish the new behaviour in at least 4 out of 7 days consistently (target: 3–4 weeks)',
    Proficient: 'Automate the change so it no longer requires active effort (target: 4–6 weeks)',
    Advanced: 'Embed the change as a stable identity trait and begin compounding into adjacent domains (target: 6–8 weeks)',
  };

  const outlook6w: Record<string, string> = {
    improving: 'Your trajectory is positive. Expect to move toward the next level within 6 weeks — provided current patterns are maintained. Focus on consistency, not speed.',
    stable: 'Your pattern is stable. Structured intervention gives you a 70%+ probability of measurable improvement within 6 weeks. The key variable is which intervention you start with.',
    plateauing: 'You are in a plateau zone — not regressing, but not moving forward without deliberate action. Breaking the plateau requires changing one environmental variable, not just adding more effort.',
    declining: 'Your trajectory has a downward signal. Without intervention, the pattern deepens over 6 weeks. The stabilisation interventions are non-optional — start with the lowest-effort one today.',
    volatile: 'High variability in your responses indicates cognitive and emotional overload. The 6-week priority is load reduction, not transformation. Start with stabilisation only.',
  };

  const outlook3m: Record<string, string> = {
    improving: 'By 3 months, consistent work at this trajectory puts you in the top 30% of similar profiles. The risk is over-confidence around week 6 — maintain the system even when it feels unnecessary.',
    stable: 'By 3 months with structured intervention: 78% probability of moving to the next level. Compounding begins around week 8 — before that, it will sometimes feel like progress is not happening.',
    plateauing: 'By 3 months, addressing the root environmental or cognitive factor that created the plateau gives you a strong recovery probability. Without that change, the pattern persists.',
    declining: 'By 3 months with early intervention, full recovery is realistic — declining patterns respond well to targeted stabilisation. Without intervention, the trajectory continues downward.',
    volatile: 'By 3 months with load management as the priority: cognitive and emotional stability precedes behavioural change. Once stabilised, growth typically accelerates quickly.',
  };

  const riskFactors: string[] = [];
  if (emotionalLoad > 65) riskFactors.push('High emotional load — current stress levels reduce intervention effectiveness');
  if (cognitiveLoad > 70) riskFactors.push('High cognitive load — too many competing demands may prevent consistent practice');
  if (scoreLevel === 'Emerging') riskFactors.push('Early-stage patterns are less stable and more susceptible to environmental disruption');
  if (trajectory === 'declining') riskFactors.push('Declining trajectory — without intervention this pattern accelerates');
  if (riskFactors.length === 0) riskFactors.push('No significant risk signals detected at this stage');

  const growthEnablers: string[] = [];
  if (trajectory === 'improving') growthEnablers.push('Positive momentum — your trajectory is already moving in the right direction');
  if (score >= 50) growthEnablers.push('Score above critical threshold — you have a working foundation to build on');
  if (cognitiveLoad < 50) growthEnablers.push('Cognitive capacity available — you have the mental bandwidth to implement new patterns');
  if ((memory?.session_count ?? 0) > 1) growthEnablers.push('Returning user — longitudinal data enables more targeted, personalised intervention');
  if (growthEnablers.length === 0) growthEnablers.push('Awareness — identifying the pattern is the first and most important step toward change');

  return {
    trajectory,
    outlook_6_weeks: outlook6w[trajectory] ?? outlook6w.stable,
    outlook_3_months: outlook3m[trajectory] ?? outlook3m.stable,
    recovery_timeline_weeks: recoveryWeeks,
    growth_probability: growthProbability,
    risk_window: riskWindowMap[stageCode] ?? riskWindowMap.CAP_CUR,
    next_milestone: milestones[scoreLevel] ?? milestones.Developing,
    key_risk_factors: riskFactors.slice(0, 3),
    key_growth_enablers: growthEnablers.slice(0, 3),
  };
}

// ─── Report Intelligence — 12-field spec-compliant narrative structure ─────────

interface ReportIntelligenceInput {
  score: number;
  scoreLevel: string;
  stageCode: string;
  concernName: string;
  participantName: string;
  triggerNodes: { label: string; description: string }[];
  protectiveNodes: { label: string; description: string }[];
  causalChain: { from_label: string; to_label: string; explanation: string }[];
  calibration: { overall_percentile: number; cohort_label: string; reliability_score: number };
  sequenced: SequencedIntervention[];
  forecastData: ForecastOutput;
  category: string;
}

function buildReportIntelligence(input: ReportIntelligenceInput): Record<string, unknown> {
  const {
    score, scoreLevel, stageCode, concernName, participantName,
    triggerNodes, protectiveNodes, causalChain,
    calibration, sequenced, forecastData,
  } = input;

  const firstName = participantName.split(' ')[0];
  const primaryTrigger = triggerNodes[0];
  const primaryCause = causalChain[0];
  const severityLabel = scoreLevel === 'Emerging' ? 'Significant' : scoreLevel === 'Developing' ? 'Moderate' : scoreLevel === 'Proficient' ? 'Mild' : 'Minimal';
  const progressNote = scoreLevel === 'Advanced'
    ? 'You are in the top quartile for this concern category.'
    : scoreLevel === 'Proficient'
    ? 'You are above the benchmark threshold — this is a refinement pattern, not a deficit pattern.'
    : 'You are below the benchmark threshold. This is where the highest-leverage change is possible.';

  return {
    // 1. Recognition — what we found, why it makes sense
    recognition: {
      headline: `${firstName}, your ${concernName} pattern has been mapped.`,
      body: `This is not a character flaw. It is a pattern — and patterns have causes, structures, and solutions. Your assessment places you at the ${scoreLevel} level, which means ${scoreLevel === 'Emerging' ? 'the pattern is active and affecting your daily experience' : scoreLevel === 'Developing' ? 'you have some capability here but meaningful room to grow' : scoreLevel === 'Proficient' ? 'you are above the threshold but not yet at full capacity' : 'you are performing strongly in this area'}.`,
      evidence: `${calibration.cohort_label}. ${progressNote} Results based on ${Math.round(calibration.reliability_score * 100)}% response reliability.`,
      normalisation: `What you are experiencing is not unusual. The patterns you describe are shared by a significant portion of people in similar contexts — the difference is that most never name them. You did.`,
    },

    // 2. Reassurance — what this does NOT mean
    reassurance: {
      headline: 'What this does not mean',
      body: `A ${scoreLevel} result in ${concernName} does not mean you are broken, incapable, or permanently defined by this pattern. It means you have a specific behavioural structure that has been operating without a targeted map — until now.`,
      emotional_reframe: `${firstName}, the act of completing this assessment is itself a signal. People who avoid self-examination rarely change. You are already doing the harder thing.`,
    },

    // 3. Meaning — translated to real-life experience
    meaning: {
      headline: 'What this means in your life',
      daily_experience: scoreLevel === 'Emerging'
        ? `Day-to-day, this pattern is likely consuming real cognitive and emotional energy. You may experience it as a persistent undercurrent — affecting decisions, focus, or mood without always being identifiable as the cause.`
        : scoreLevel === 'Developing'
        ? `You are managing this pattern, but the effort it requires is probably higher than it needs to be. There are moments where the old pattern reasserts itself, particularly under stress or disruption.`
        : `This pattern is largely under your management. The remaining development is about efficiency — reducing the cognitive cost of maintaining what is already working.`,
      internal_state: primaryCause
        ? `The internal driver appears to be: ${primaryCause.from_label}. ${primaryCause.explanation}`
        : `The internal experience is characterised by the gap between what you intend and what actually happens — which is exactly where the intervention work is focused.`,
      external_behaviour: primaryTrigger
        ? `Externally, the trigger pattern often involves: ${primaryTrigger.label}. ${primaryTrigger.description}`
        : `The external expression of this pattern varies by context, but tends to show up most clearly in high-pressure or high-stakes situations.`,
      effort_vs_outcome: scoreLevel === 'Emerging' || scoreLevel === 'Developing'
        ? `Current effort-to-outcome ratio: inefficient. You are likely working harder than necessary because the approach is not yet targeted to the actual structure of this pattern.`
        : `Current effort-to-outcome ratio: reasonable. The remaining improvements are refinement, not overhaul.`,
    },

    // 4. Severity — structured scoring context
    severity: {
      level: severityLabel,
      score,
      percentile: calibration.overall_percentile,
      interpretation: `Your ${score}/100 places this concern in the ${severityLabel.toLowerCase()} range. ${scoreLevel === 'Emerging' ? 'This level benefits most from structured, step-by-step intervention — starting with environment and habit, not mindset.' : scoreLevel === 'Developing' ? 'At this level, the foundation exists. The work is building consistent application of what you already partially understand.' : 'At this level, the pattern is manageable. The interventions are refinement-focused, not remedial.'}`,
      normalisation: calibration.cohort_label,
    },

    // 5. Causation — root cause intelligence
    causation: {
      headline: 'Why this pattern exists',
      primary_cause: primaryCause
        ? { label: primaryCause.from_label, explanation: primaryCause.explanation }
        : { label: 'Cumulative context', explanation: 'This pattern is the product of multiple interacting factors. This is actually tractable — intervention at any one factor produces measurable change across the system.' },
      contributing_factors: causalChain.slice(1, 3).map(c => c.from_label),
      why_previous_approaches_failed: `Most generic approaches to ${concernName} target the visible behaviour rather than the upstream cause. Effort-based solutions (just try harder, just focus more) have limited durability because they do not address the loop.`,
    },

    // 6. Functional impact — what the pattern costs day-to-day
    functional_impact: {
      headline: 'What this pattern costs you',
      performance: scoreLevel === 'Emerging'
        ? `Significant drag on performance — focus, follow-through, and decision quality are affected.`
        : scoreLevel === 'Developing'
        ? `Inconsistent performance — good periods are disrupted by the pattern reasserting itself.`
        : `Minor inefficiency — the cost is there but manageable.`,
      wellbeing: scoreLevel === 'Emerging' || scoreLevel === 'Developing'
        ? `The emotional cost is real — the gap between intention and outcome generates frustration, self-criticism, or avoidance over time.`
        : `Moderate emotional cost — periodic frustrations when the pattern resurfaces, but generally under control.`,
      relationships: primaryTrigger
        ? `Social and relational contexts involving ${primaryTrigger.label.toLowerCase()} may be where this pattern is most visible to others.`
        : `The relational impact depends on how much the concern area intersects with your collaborative or social contexts.`,
    },

    // 7. Identity — narrative and reframe
    identity: {
      headline: 'Who you are in this pattern',
      current_narrative: `Many people at this level have unconsciously adopted a narrative that includes this pattern as permanent: "I am someone who struggles with ${concernName}." That narrative describes a current state, not a fixed trait.`,
      reframe: `The accurate narrative is: "I have a specific pattern that I am now mapping, understanding, and addressing with the right tools." That is a fundamentally different relationship with the same experience.`,
      identity_shift: `${firstName}, the goal is not to fix a problem — it is to become someone for whom this is no longer a pattern. That identity shift is the most durable form of change because it does not depend on ongoing effort to maintain.`,
    },

    // 8. What this means — plain language
    what_this_means: {
      headline: 'In plain language',
      in_daily_life: scoreLevel === 'Emerging'
        ? `In daily life: this pattern is active. It is affecting how you feel, decide, and perform — even on days when you are not consciously aware of it. The investment in addressing it now is high-return.`
        : scoreLevel === 'Developing'
        ? `In daily life: you are managing this pattern. The cost is real but not overwhelming. The opportunity is to reduce the management cost — to reach a place where the pattern no longer requires active monitoring.`
        : `In daily life: this area is functioning well. The remaining work is consistency — moving from "managing well" to "this is just who I am now."`,
      pattern: primaryCause
        ? `The cycle is: ${primaryCause.from_label} → ${primaryCause.to_label}. Once you can see the cycle, you can interrupt it at the right point.`
        : `A recurring cycle that is self-reinforcing until deliberately interrupted at the right point — which this plan targets.`,
      trajectory: forecastData.outlook_6_weeks,
    },

    // 9. What this is NOT — protective framing
    what_this_is_not: {
      not_a_flaw: `This is not a character flaw. It is a pattern — one that formed for understandable reasons and one that changes with the right approach.`,
      not_permanent: scoreLevel === 'Emerging'
        ? `This is not permanent. Even at the Emerging level, targeted intervention produces measurable change in 4–8 weeks.`
        : `This is not permanent. At your level, the trajectory is already positive with the right strategy applied consistently.`,
      not_failure: `The existence of this pattern is not a failure. It is information — and information is what makes change possible.`,
      not_inability: `This does not mean you are unable to change. It means you have been using an approach that does not match the actual structure of this pattern. That changes now.`,
    },

    // 10. Interventions — formatted and explainable
    interventions: sequenced.map((iv, i) => ({
      position: i + 1,
      title: iv.title,
      description: iv.description,
      why_it_works: iv.why_it_works,
      expected_outcome: iv.expected_outcome,
      timing: iv.timing,
      phase_label: iv.phase_label,
      effort_required: iv.effort_required,
      resistance_prediction: iv.resistance_prediction,
      success_marker: iv.success_marker,
    })),

    // 11. Forecast — forward-looking trajectory
    forecast: {
      trajectory: forecastData.trajectory,
      growth_probability: forecastData.growth_probability,
      outlook_6_weeks: forecastData.outlook_6_weeks,
      outlook_3_months: forecastData.outlook_3_months,
      next_milestone: forecastData.next_milestone,
      recovery_timeline_weeks: forecastData.recovery_timeline_weeks,
      risk_window: forecastData.risk_window,
    },

    // 12. Confidence — epistemological transparency
    confidence: {
      level: calibration.reliability_score >= 0.8 ? 'High' : calibration.reliability_score >= 0.6 ? 'Moderate' : 'Indicative',
      score: calibration.reliability_score,
      rationale: `These findings are based on ${Math.round(calibration.reliability_score * 100)}% response reliability. ${calibration.reliability_score >= 0.8 ? 'High reliability — these conclusions can be acted upon with confidence.' : calibration.reliability_score >= 0.6 ? 'Moderate reliability — strong directional indicators. A fuller assessment confirms the complete picture.' : 'Initial indicators. A fuller assessment would provide higher confidence.'}`,
      percentile_context: `Your results place you at the ${calibration.overall_percentile}th percentile of your reference cohort (${calibration.cohort_label}).`,
    },

    // Meta
    generated_at: new Date().toISOString(),
    stage_code: stageCode,
  };
}

// ─── Explainability Chain — per-subdomain Observation → Intervention ──────────

function buildExplainabilityChain(
  subdomains: { subdomain_name: string; avg_score: string | number }[],
  category: string,
  scoreLevel: string,
  concernName: string,
): Array<Record<string, string>> {
  return subdomains.slice(0, 8).map(sd => {
    const score = Math.round(Number(sd.avg_score));
    const name = sd.subdomain_name;
    const level = score >= 75 ? 'Proficient' : score >= 50 ? 'Developing' : 'Emerging';
    const gap = 75 - score;

    return {
      subdomain: name,
      observation: `Your ${name} score is ${score}/100 — placing this dimension at the ${level} level.`,
      evidence: score < 40
        ? `Response patterns across ${name}-related items showed consistent low engagement, indicating an active deficit in this area rather than situational variability.`
        : score < 60
        ? `Responses across ${name} items showed moderate and variable engagement — some items scored well, others revealed gaps. This is the developing pattern.`
        : score < 75
        ? `${name} items scored consistently above average, with specific sub-areas approaching the proficiency threshold.`
        : `${name} items scored at or above the proficiency threshold — indicating this dimension is functioning well.`,
      pattern_match: score < 50
        ? `This matches the ${category} behavioural profile for ${concernName} at the ${scoreLevel} level — ${name} is a known primary contributor to this pattern.`
        : score < 75
        ? `This matches a developing pattern where the ${name} dimension has partial capacity — functional under low demand, not yet automatic.`
        : `This matches a proficient pattern — consistent and reliable under most conditions in the ${name} dimension.`,
      confidence: gap > 0 ? 'Moderate-to-High' : 'High',
      interpretation: gap > 35
        ? `${name} is a priority intervention target. A ${gap}-point gap from proficiency means this dimension is actively limiting your overall performance in ${concernName}.`
        : gap > 10
        ? `${name} has meaningful development potential. A ${gap}-point improvement here would push this dimension above the proficiency threshold.`
        : `${name} is functioning well. Maintenance rather than active intervention is appropriate here — it is a protective factor.`,
      intervention: gap > 35
        ? `Targeted work on ${name} should begin in Phase 1 of your intervention plan — this dimension responds well to structured, consistent practice.`
        : gap > 10
        ? `${name} development fits naturally into Phase 2 — once foundational patterns are established, this dimension consolidates quickly.`
        : `${name} is a protective factor. Maintaining it while developing lower-scoring dimensions accelerates overall progress.`,
    };
  });
}
