/**
 * CAPADEX 3.0 — Program 1 · Phase 1.7 AI Recommendation Report Orchestration
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * The ONE canonical AI-orchestration model — a PURE DATA registry (zero behaviour, zero DDL).
 * It answers: "assessment → AI analysis → confidence → explainability → recommendation →
 * intervention → outcome-validation → report → KPI", auditing every EXISTING AI / recommendation /
 * report / analytics / explainability / orchestration capability into ONE coherent layer.
 *
 * STRICT contract (mirrors Phase 1.6 EXACTLY): Enhancement-Only / Reuse-Before-Build / NO new
 * engines / no duplicate logic / byte-identical-OFF / ZERO DDL. Every spine step `reuses` a
 * VERIFIED EXISTING engine + table — this phase invents nothing. The read-only composer
 * (`services/ai-orchestration-engine.ts`) INDEPENDENTLY verifies every evidence claim here against
 * the live filesystem + DB; the verifier — not this registry — is the SSoT for present/absent.
 *
 * Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption are NEVER composited. null≠0. Engines are read by
 * existence / persisted output — NEVER invoked. Nothing is fabricated.
 */

export type AiOrchestrationStatus = 'SUPPORTED' | 'PARTIAL' | 'DEAD_END' | 'MISSING';

/** Uniform evidence shape — any group may be empty []. The composer verifies each against live FS/DB. */
export interface AiEvidence {
  services: string[];
  routes: string[];
  tables: string[];
  frontend: string[];
}

function ev(e: Partial<AiEvidence>): AiEvidence {
  return { services: e.services ?? [], routes: e.routes ?? [], tables: e.tables ?? [], frontend: e.frontend ?? [] };
}

/**
 * The FROZEN 12-step AI-orchestration spine. MEASURED, not padded to a round number — each step is
 * a real stage in the existing assessment→AI→recommendation→report→KPI flow, and each `reuses` a
 * VERIFIED existing engine + table. The composer never invokes these — it reads their existence.
 */
export interface AiSpineStep {
  step: string;
  label: string;
  description: string;
  /** The EXISTING engine(s) + table(s) this step reuses (verified present at authoring time). */
  reuses: { services: string[]; tables: string[] };
}

export const AI_ORCHESTRATION_SPINE: AiSpineStep[] = [
  {
    step: 'assessment',
    label: 'Assessment intake',
    description: 'A persona completes a CAPADEX / competency / behaviour assessment — the AI orchestration entry point.',
    reuses: { services: ['services/outcome-intelligence-engine.ts'], tables: ['capadex_sessions'] },
  },
  {
    step: 'evidence_collection',
    label: 'Evidence collection',
    description: 'Per-question signals + scores are persisted as the evidence substrate AI analysis reasons over.',
    reuses: { services: ['services/validation-loop-engine.ts'], tables: ['capadex_session_signals'] },
  },
  {
    step: 'ai_analysis',
    label: 'AI analysis / reasoning',
    description: 'The AI layer interprets the evidence (reasoning chains, narrative synthesis) over the collected signals.',
    reuses: { services: ['services/aiClient.ts', 'services/ai-reasoning-engine.ts'], tables: ['ai_reasoning_chains'] },
  },
  {
    step: 'confidence_scoring',
    label: 'Confidence scoring',
    description: 'Decision-time predictions are scored + calibrated (Brier/ECE) via the validation-loop mechanism — the Confidence axis.',
    reuses: { services: ['services/validation-loop-engine.ts', 'services/wc7b/decision-orchestrator.ts'], tables: ['wc7b_decision_state'] },
  },
  {
    step: 'explainability',
    label: 'Explainability',
    description: 'Each AI recommendation / decision is rendered into an explainable, human-readable rationale.',
    reuses: { services: ['services/capadex-explainability-engine.ts', 'services/runtime-explainability-engine.ts'], tables: [] },
  },
  {
    step: 'recommendation_generation',
    label: 'Recommendation generation',
    description: 'Development / career / competency recommendations are generated and persisted per subject.',
    reuses: {
      services: ['services/recommendation-intelligence-engine.ts', 'services/career-recommendation-engine.ts', 'services/mei-recommendation-engine.ts'],
      tables: ['development_recommendations', 'career_recommendations'],
    },
  },
  {
    step: 'intervention_selection',
    label: 'Intervention selection',
    description: 'Recommendations are converted into actionable interventions matched to the subject.',
    reuses: { services: ['services/intervention-intelligence.ts'], tables: ['capadex_interventions'] },
  },
  {
    step: 'learning_plan',
    label: 'Learning plan',
    description: 'Interventions compose into a personalised learning plan / pathway.',
    reuses: { services: ['services/learning-path-engine.ts'], tables: ['career_readiness_history'] },
  },
  {
    step: 'progress_tracking',
    label: 'Progress tracking',
    description: 'Longitudinal snapshots track movement against baseline — the measured-progress input.',
    reuses: { services: ['services/longitudinal-memory.ts', 'services/wc3/longitudinal-foundation.ts'], tables: ['wc3_longitudinal_snapshots'] },
  },
  {
    step: 'outcome_validation',
    label: 'Outcome validation',
    description: 'Realized outcomes are captured into the canonical ledger and validated vs the decision-time prediction.',
    reuses: { services: ['services/outcome-intelligence-engine.ts', 'services/capadex/progression-outcome-capture.ts'], tables: ['validation_loop_outcomes'] },
  },
  {
    step: 'report_generation',
    label: 'Report generation',
    description: 'A human-readable AI report is composed from the analysis, recommendations, explainability + outcomes.',
    reuses: { services: ['services/pil/report-builder.ts', 'services/omega-report-builder.ts'], tables: ['capadex_reports'] },
  },
  {
    step: 'kpi_update',
    label: 'KPI update',
    description: 'Realized outcomes + report engagement roll up into the enterprise-analytics KPI substrate.',
    reuses: { services: ['services/enterprise-analytics-schema.ts', 'services/benchmark-engine.ts'], tables: ['anl_kpi_daily'] },
  },
];

/** The eight AI-orchestration axes every path maps to. */
export const AI_ORCHESTRATION_AXES = [
  'persona',
  'lifecycle',
  'assessment',
  'ai_analysis',
  'explainability',
  'recommendation',
  'report',
  'kpi',
] as const;
export type AiAxis = typeof AI_ORCHESTRATION_AXES[number];

/**
 * AI CAPABILITY INVENTORY — the EXISTING AI / recommendation / report / analytics / explainability /
 * orchestration capabilities, audited (not built) into one inventory. Each cites verified evidence.
 */
export interface AiCapability {
  id: string;
  label: string;
  category: 'analysis' | 'reasoning' | 'recommendation' | 'intervention' | 'explainability' | 'report' | 'analytics' | 'orchestration';
  status: AiOrchestrationStatus;
  statusNote?: string;
  evidence: AiEvidence;
}

export const AI_CAPABILITIES: AiCapability[] = [
  {
    id: 'ai_narrative_analysis',
    label: 'AI narrative analysis (LLM-backed)',
    category: 'analysis',
    status: 'SUPPORTED',
    statusNote: 'LLM client wraps assessment evidence into narrative analysis; degrades honestly without OPENAI_API_KEY (null≠0).',
    evidence: ev({ services: ['services/aiClient.ts'], tables: ['capadex_sessions'] }),
  },
  {
    id: 'ai_reasoning_chains',
    label: 'AI reasoning chains',
    category: 'reasoning',
    status: 'SUPPORTED',
    statusNote: 'Multi-step reasoning chains are generated + persisted; substrate present.',
    evidence: ev({ services: ['services/ai-reasoning-engine.ts'], tables: ['ai_reasoning_chains'] }),
  },
  {
    id: 'development_recommendations',
    label: 'Development recommendations',
    category: 'recommendation',
    status: 'SUPPORTED',
    statusNote: 'Competency-gap → development recommendation; persisted per subject.',
    evidence: ev({ services: ['services/recommendation-intelligence-engine.ts', 'services/mei-recommendation-engine.ts'], tables: ['development_recommendations'] }),
  },
  {
    id: 'career_recommendations',
    label: 'Career recommendations',
    category: 'recommendation',
    status: 'SUPPORTED',
    statusNote: 'Role / pathway recommendations generated + persisted.',
    evidence: ev({ services: ['services/career-recommendation-engine.ts', 'services/recommendation-engine.ts'], tables: ['career_recommendations'] }),
  },
  {
    id: 'intervention_selection',
    label: 'Intervention selection',
    category: 'intervention',
    status: 'SUPPORTED',
    statusNote: 'Recommendations → actionable interventions; persisted per subject.',
    evidence: ev({ services: ['services/intervention-intelligence.ts'], tables: ['capadex_interventions'] }),
  },
  {
    id: 'capadex_explainability',
    label: 'CAPADEX explainability',
    category: 'explainability',
    status: 'SUPPORTED',
    statusNote: 'Recommendation / decision rationale rendered human-readable.',
    evidence: ev({ services: ['services/capadex-explainability-engine.ts'], tables: [] }),
  },
  {
    id: 'runtime_explainability',
    label: 'Runtime explainability',
    category: 'explainability',
    status: 'SUPPORTED',
    statusNote: 'Runtime guidance + per-decision explainability over the live evidence.',
    evidence: ev({ services: ['services/runtime-explainability-engine.ts', 'services/explainability-engine.ts'], tables: [] }),
  },
  {
    id: 'confidence_calibration',
    label: 'Confidence / calibration scoring',
    category: 'analysis',
    status: 'PARTIAL',
    statusNote: 'Decision-time predictions are calibrated (Brier/ECE) via the validation-loop mechanism; calibrated CONFIDENCE abstains until ≥ k_min real pairs accrue (Confidence axis, null≠0).',
    evidence: ev({ services: ['services/validation-loop-engine.ts', 'services/wc7b/decision-orchestrator.ts'], tables: ['wc7b_decision_state', 'validation_loop_outcomes'] }),
  },
  {
    id: 'report_generation',
    label: 'AI report generation',
    category: 'report',
    status: 'SUPPORTED',
    statusNote: 'PIL + omega report builders compose human-readable AI reports; persisted in capadex_reports.',
    evidence: ev({ services: ['services/pil/report-builder.ts', 'services/omega-report-builder.ts'], tables: ['capadex_reports'], frontend: ['components/AIPoweredReports.tsx', 'components/reports/GeneratedReportBody.tsx'] }),
  },
  {
    id: 'kpi_analytics',
    label: 'KPI / enterprise analytics roll-up',
    category: 'analytics',
    status: 'PARTIAL',
    statusNote: 'Enterprise-analytics + benchmark engines compute KPI families; population is usage-driven (Adoption axis, null≠0).',
    evidence: ev({ services: ['services/enterprise-analytics-schema.ts', 'services/benchmark-engine.ts'], tables: ['anl_kpi_daily'] }),
  },
  {
    id: 'decision_orchestration',
    label: 'Decision orchestration',
    category: 'orchestration',
    status: 'SUPPORTED',
    statusNote: 'wc7b decision-orchestrator sequences the AI decision flow over the existing engines (orchestrates, never re-derives).',
    evidence: ev({ services: ['services/wc7b/decision-orchestrator.ts'], tables: ['wc7b_decision_state'] }),
  },
  {
    id: 'runtime_guidance',
    label: 'Runtime AI guidance',
    category: 'orchestration',
    status: 'SUPPORTED',
    statusNote: 'Per-persona runtime guidance lens composes the AI outputs into actionable next-steps.',
    evidence: ev({ services: ['services/pil/runtime-guidance-engine.ts'], tables: [] }),
  },
];

/**
 * RECOMMENDATION-COMPLETENESS criteria — what makes the recommendation chain "complete" end-to-end.
 * Each is VERIFIED against existing substrate; none is a new build.
 */
export interface RecommendationCriterion {
  key: string;
  label: string;
  status: AiOrchestrationStatus;
  statusNote?: string;
  evidence: AiEvidence;
}

export const RECOMMENDATION_CRITERIA: RecommendationCriterion[] = [
  {
    key: 'grounded_in_evidence',
    label: 'Recommendations grounded in assessment evidence',
    status: 'SUPPORTED',
    statusNote: 'Recommendations derive from the persisted signals/scores, not free-text — grounded chain.',
    evidence: ev({ services: ['services/recommendation-intelligence-engine.ts'], tables: ['capadex_session_signals', 'development_recommendations'] }),
  },
  {
    key: 'persisted_per_subject',
    label: 'Recommendations persisted per subject',
    status: 'SUPPORTED',
    statusNote: 'development_recommendations + career_recommendations persist per-user.',
    evidence: ev({ services: ['services/career-recommendation-engine.ts'], tables: ['development_recommendations', 'career_recommendations'] }),
  },
  {
    key: 'actionable_intervention',
    label: 'Recommendation → actionable intervention',
    status: 'SUPPORTED',
    statusNote: 'Each recommendation maps to a selectable intervention.',
    evidence: ev({ services: ['services/intervention-intelligence.ts'], tables: ['capadex_interventions'] }),
  },
  {
    key: 'explainable',
    label: 'Recommendation is explainable',
    status: 'SUPPORTED',
    statusNote: 'Rationale rendered for each recommendation.',
    evidence: ev({ services: ['services/capadex-explainability-engine.ts'], tables: [] }),
  },
  {
    key: 'outcome_validated',
    label: 'Recommendation → validated realized outcome',
    status: 'PARTIAL',
    statusNote: 'Realized outcomes capture into validation_loop_outcomes; effectiveness calibration abstains until ≥ k_min real pairs (Confidence/Adoption axes, null≠0).',
    evidence: ev({ services: ['services/outcome-intelligence-engine.ts', 'services/validation-loop-engine.ts'], tables: ['validation_loop_outcomes'] }),
  },
  {
    key: 'persona_aware',
    label: 'Recommendations are persona-aware',
    status: 'SUPPORTED',
    statusNote: 'Per-persona runtime guidance lenses tailor the recommendation framing.',
    evidence: ev({ services: ['services/pil/runtime-guidance-engine.ts'], tables: ['capadex_user_profiles'] }),
  },
];

/**
 * EXPLAINABILITY criteria — what makes the AI explainability layer trustworthy.
 */
export interface ExplainabilityCriterion {
  key: string;
  label: string;
  status: AiOrchestrationStatus;
  statusNote?: string;
  evidence: AiEvidence;
}

export const EXPLAINABILITY_CRITERIA: ExplainabilityCriterion[] = [
  {
    key: 'rationale_rendered',
    label: 'Per-recommendation rationale rendered',
    status: 'SUPPORTED',
    statusNote: 'CAPADEX explainability engine renders a rationale per recommendation/decision.',
    evidence: ev({ services: ['services/capadex-explainability-engine.ts'], tables: [] }),
  },
  {
    key: 'runtime_explainability',
    label: 'Runtime per-decision explainability',
    status: 'SUPPORTED',
    statusNote: 'Runtime explainability over the live evidence at decision time.',
    evidence: ev({ services: ['services/runtime-explainability-engine.ts', 'services/explainability-engine.ts'], tables: [] }),
  },
  {
    key: 'evidence_traceability',
    label: 'Evidence traceability (signal → recommendation)',
    status: 'PARTIAL',
    statusNote: 'Recommendations trace to persisted signals; full per-token attribution is a Confidence axis (not fabricated).',
    evidence: ev({ services: ['services/recommendation-intelligence-engine.ts'], tables: ['capadex_session_signals', 'ai_reasoning_chains'] }),
  },
  {
    key: 'confidence_disclosure',
    label: 'Confidence disclosure (calibration surfaced honestly)',
    status: 'PARTIAL',
    statusNote: 'Calibration (Brier/ECE) surfaced via the validation-loop mechanism; abstains until ≥ k_min (null≠0).',
    evidence: ev({ services: ['services/validation-loop-engine.ts'], tables: ['validation_loop_outcomes'] }),
  },
  {
    key: 'reasoning_chain_persisted',
    label: 'Reasoning chain persisted + inspectable',
    status: 'SUPPORTED',
    statusNote: 'Reasoning chains persist to ai_reasoning_chains.',
    evidence: ev({ services: ['services/ai-reasoning-engine.ts'], tables: ['ai_reasoning_chains'] }),
  },
  {
    key: 'human_readable_report',
    label: 'Explainability surfaced in human-readable report',
    status: 'SUPPORTED',
    statusNote: 'Rationale flows into the generated report body.',
    evidence: ev({ services: ['services/pil/report-builder.ts'], tables: ['capadex_reports'], frontend: ['components/reports/GeneratedReportBody.tsx'] }),
  },
];

/**
 * REPORT-SECTION validation — sections a complete AI report must contain (verified vs report builders).
 */
export interface ReportSection {
  key: string;
  label: string;
  status: AiOrchestrationStatus;
  statusNote?: string;
  evidence: AiEvidence;
}

export const REPORT_SECTIONS: ReportSection[] = [
  {
    key: 'summary',
    label: 'Executive summary',
    status: 'SUPPORTED',
    statusNote: 'AI-composed summary section.',
    evidence: ev({ services: ['services/pil/report-builder.ts', 'services/omega-report-builder.ts'], tables: ['capadex_reports'], frontend: ['components/AIPoweredReports.tsx'] }),
  },
  {
    key: 'analysis',
    label: 'AI analysis / interpretation',
    status: 'SUPPORTED',
    statusNote: 'Narrative analysis section grounded in reasoning chains.',
    evidence: ev({ services: ['services/aiClient.ts', 'services/ai-reasoning-engine.ts'], tables: ['ai_reasoning_chains'] }),
  },
  {
    key: 'recommendations',
    label: 'Recommendations section',
    status: 'SUPPORTED',
    statusNote: 'Persisted recommendations rendered into the report.',
    evidence: ev({ services: ['services/recommendation-intelligence-engine.ts'], tables: ['development_recommendations', 'career_recommendations'] }),
  },
  {
    key: 'interventions',
    label: 'Intervention / action plan section',
    status: 'SUPPORTED',
    statusNote: 'Actionable interventions rendered.',
    evidence: ev({ services: ['services/intervention-intelligence.ts'], tables: ['capadex_interventions'] }),
  },
  {
    key: 'explainability',
    label: 'Explainability / rationale section',
    status: 'SUPPORTED',
    statusNote: 'Per-recommendation rationale surfaced in the report.',
    evidence: ev({ services: ['services/capadex-explainability-engine.ts'], tables: [], frontend: ['components/reports/GeneratedReportBody.tsx'] }),
  },
  {
    key: 'progress',
    label: 'Progress / longitudinal section',
    status: 'PARTIAL',
    statusNote: 'Longitudinal trend rendered when >1 datapoint exists (Adoption axis, null≠0).',
    evidence: ev({ services: ['services/longitudinal-memory.ts'], tables: ['wc3_longitudinal_snapshots'] }),
  },
  {
    key: 'outcomes',
    label: 'Realized-outcomes section',
    status: 'PARTIAL',
    statusNote: 'Realized outcomes surfaced from the canonical ledger; volume usage-driven (Adoption axis).',
    evidence: ev({ services: ['services/outcome-intelligence-engine.ts'], tables: ['validation_loop_outcomes'] }),
  },
  {
    key: 'kpis',
    label: 'KPI / benchmark section',
    status: 'PARTIAL',
    statusNote: 'KPI roll-up + benchmark surfaced; population usage-driven (Adoption axis).',
    evidence: ev({ services: ['services/enterprise-analytics-schema.ts', 'services/benchmark-engine.ts'], tables: ['anl_kpi_daily'] }),
  },
];

/**
 * DASHBOARD validation — admin / user dashboards that surface the AI orchestration outputs.
 */
export interface DashboardSurface {
  key: string;
  label: string;
  audience: 'super_admin' | 'user' | 'employer' | 'institution';
  status: AiOrchestrationStatus;
  statusNote?: string;
  evidence: AiEvidence;
}

export const DASHBOARD_SURFACES: DashboardSurface[] = [
  {
    key: 'ai_powered_reports',
    label: 'AI-powered reports (user)',
    audience: 'user',
    status: 'SUPPORTED',
    statusNote: 'User-facing AI report surface.',
    evidence: ev({ frontend: ['components/AIPoweredReports.tsx', 'pages/AIPoweredReportsPage.tsx'], tables: ['capadex_reports'] }),
  },
  {
    key: 'report_factory_admin',
    label: 'Report Factory (super-admin)',
    audience: 'super_admin',
    status: 'SUPPORTED',
    statusNote: 'Admin report orchestration surface.',
    evidence: ev({ frontend: ['components/superadmin/ReportFactoryPanel.tsx', 'components/superadmin/UnifiedReportsPanel.tsx'], routes: ['routes/report-factory.ts'], tables: ['capadex_reports'] }),
  },
  {
    key: 'capadex_reports_admin',
    label: 'CAPADEX reports (super-admin)',
    audience: 'super_admin',
    status: 'SUPPORTED',
    statusNote: 'Admin CAPADEX report inventory.',
    evidence: ev({ frontend: ['components/superadmin/CapadexReportsPanel.tsx'], tables: ['capadex_reports'] }),
  },
  {
    key: 'recommendation_analytics_admin',
    label: 'Recommendation analytics (super-admin)',
    audience: 'super_admin',
    status: 'SUPPORTED',
    statusNote: 'Admin recommendation analytics + RIE recommendations.',
    evidence: ev({ frontend: ['components/superadmin/RecommendationAnalyticsPanel.tsx', 'components/superadmin/RIERecommendationsPanel.tsx'], tables: ['development_recommendations', 'career_recommendations'] }),
  },
  {
    key: 'outcome_intelligence_admin',
    label: 'Outcome intelligence (super-admin)',
    audience: 'super_admin',
    status: 'SUPPORTED',
    statusNote: 'Admin realized-outcome intelligence.',
    evidence: ev({ frontend: ['components/superadmin/OutcomeIntelligencePanel.tsx'], routes: ['routes/outcome-intelligence.ts'], tables: ['validation_loop_outcomes'] }),
  },
  {
    key: 'enterprise_analytics_admin',
    label: 'Enterprise analytics / KPI (super-admin)',
    audience: 'super_admin',
    status: 'PARTIAL',
    statusNote: 'KPI dashboard; population usage-driven (Adoption axis, null≠0).',
    evidence: ev({ frontend: ['components/superadmin/EnterpriseAnalyticsPanel.tsx'], routes: ['routes/enterprise-analytics.ts'], tables: ['anl_kpi_daily'] }),
  },
  {
    key: 'ai_governance_admin',
    label: 'AI governance (super-admin)',
    audience: 'super_admin',
    status: 'SUPPORTED',
    statusNote: 'AI governance + rules surface.',
    evidence: ev({ frontend: ['components/superadmin/AiGovernancePanel.tsx', 'pages/AIGovernancePage.tsx'] }),
  },
  {
    key: 'user_ai_insights',
    label: 'User AI insights (Career Builder)',
    audience: 'user',
    status: 'SUPPORTED',
    statusNote: 'User-facing AI competency insights in the Career Builder.',
    evidence: ev({ frontend: ['modules/career-builder/intelligence/views/AICompetencyInsights.tsx', 'pages/CareerBuilderPage.tsx'] }),
  },
];

/**
 * Per-persona AI-orchestration paths — mirrors the Phase 1.6 per-persona path register EXACTLY.
 * Each maps the AI flow for one persona across the eight axes, with verified evidence.
 */
export interface AiOrchestrationPath {
  key: string;
  label: string;
  persona: string;
  personas: string[];
  spineReached: string[];
  lifecycleStages: string[];
  assessments: string[];
  aiAnalysis: string;
  explainability: string;
  recommendation: string;
  report: string;
  kpiFamilies: string[];
  status: AiOrchestrationStatus;
  statusNote?: string;
  evidence: AiEvidence;
}

export const AI_ORCHESTRATION_MODEL: AiOrchestrationPath[] = [
  {
    key: 'student_growth',
    label: 'Student → Growth AI loop',
    persona: 'School / college student',
    personas: ['P1', 'P2', 'P3'],
    spineReached: ['assessment', 'evidence_collection', 'ai_analysis', 'confidence_scoring', 'explainability', 'recommendation_generation', 'intervention_selection', 'learning_plan', 'progress_tracking', 'report_generation'],
    lifecycleStages: ['CAP_CUR', 'CAP_INS', 'CAP_GRW'],
    assessments: ['entry', 'baseline', 'diagnostic', 'behaviour'],
    aiAnalysis: 'Behaviour + competency narrative analysis (reasoning chains) over assessment evidence.',
    explainability: 'Per-recommendation rationale rendered into the student report.',
    recommendation: 'Development recommendations + interventions + learning plan.',
    report: 'AI-powered student report (PIL/omega builders → capadex_reports).',
    kpiFamilies: ['individual', 'learning', 'journey'],
    status: 'SUPPORTED',
    statusNote: 'Full front-half AI loop is live; realized-outcome validation + KPI population are the universal adoption-gated tail (Adoption⟂Coverage).',
    evidence: ev({
      services: ['services/aiClient.ts', 'services/recommendation-intelligence-engine.ts', 'services/intervention-intelligence.ts', 'services/pil/report-builder.ts'],
      routes: ['routes/capadex.ts'],
      tables: ['capadex_sessions', 'ai_reasoning_chains', 'development_recommendations', 'capadex_reports'],
      frontend: ['components/FreeAssessmentModal.tsx', 'components/StudentDashboard.tsx', 'components/AIPoweredReports.tsx'],
    }),
  },
  {
    key: 'fresher_readiness',
    label: 'Fresher → Placement-Readiness AI loop',
    persona: 'Fresher / final-year (job-seeker)',
    personas: ['P3', 'P4'],
    spineReached: ['assessment', 'evidence_collection', 'ai_analysis', 'explainability', 'recommendation_generation', 'intervention_selection', 'learning_plan', 'progress_tracking', 'outcome_validation', 'report_generation', 'kpi_update'],
    lifecycleStages: ['CAP_CUR', 'CAP_INS', 'CAP_GRW'],
    assessments: ['entry', 'baseline', 'competency', 'performance'],
    aiAnalysis: 'Competency + readiness diagnosis; role-DNA crosswalk for fit.',
    explainability: 'Readiness-gap rationale surfaced in the launchpad report.',
    recommendation: 'Launchpad next-steps + placement-matching recommendations.',
    report: 'Readiness report with recommendations + outcomes.',
    kpiFamilies: ['individual', 'assessment', 'business', 'journey'],
    status: 'SUPPORTED',
    statusNote: 'Reaches the full AI→report→KPI loop; realized placement-outcome capture is the universal adoption-gated tail.',
    evidence: ev({
      services: ['services/career-recommendation-engine.ts', 'services/employability-scoring-engine.ts', 'services/outcome-intelligence-engine.ts'],
      routes: ['routes/career-readiness.ts', 'routes/career-recommendation.ts'],
      tables: ['career_recommendations', 'career_readiness_history', 'validation_loop_outcomes'],
      frontend: ['pages/career/CareerLaunchpadDashboard.tsx', 'pages/CareerBuilderPage.tsx'],
    }),
  },
  {
    key: 'professional_progression',
    label: 'Professional → Role-Progression AI loop',
    persona: 'Working professional',
    personas: ['P5'],
    spineReached: ['assessment', 'evidence_collection', 'ai_analysis', 'confidence_scoring', 'explainability', 'recommendation_generation', 'learning_plan', 'progress_tracking', 'outcome_validation', 'report_generation', 'kpi_update'],
    lifecycleStages: ['CAP_INS', 'CAP_GRW', 'CAP_MAS'],
    assessments: ['baseline', 'competency', 'performance', 'progress'],
    aiAnalysis: 'Competency + progression diagnosis; trend intelligence.',
    explainability: 'Progression rationale vs baseline surfaced honestly (abstained calibration).',
    recommendation: 'Progression-aware growth-plan recommendations.',
    report: 'Progression report with trend + outcomes.',
    kpiFamilies: ['individual', 'lifecycle', 'business'],
    status: 'PARTIAL',
    statusNote: 'Reaches the full AI loop incl. report+KPI as a MECHANISM; validation is ADOPTION-pending (Coverage⟂Adoption⟂Confidence).',
    evidence: ev({
      services: ['services/recommendation-intelligence-engine.ts', 'services/longitudinal-memory.ts', 'services/outcome-intelligence-engine.ts'],
      routes: ['routes/capadex.ts', 'routes/career-readiness.ts'],
      tables: ['wc3_longitudinal_snapshots', 'career_readiness_history', 'validation_loop_outcomes'],
      frontend: ['pages/CareerBuilderPage.tsx'],
    }),
  },
  {
    key: 'employee_competency',
    label: 'Employee → Competency / EI AI loop',
    persona: 'Enterprise employee',
    personas: ['P5', 'P6'],
    spineReached: ['assessment', 'evidence_collection', 'ai_analysis', 'explainability', 'recommendation_generation', 'intervention_selection', 'learning_plan', 'progress_tracking', 'report_generation'],
    lifecycleStages: ['CAP_CUR', 'CAP_INS', 'CAP_GRW'],
    assessments: ['entry', 'baseline', 'competency', 'behaviour'],
    aiAnalysis: 'Competency genome + EI dimension diagnosis (mei-scoring).',
    explainability: 'Competency/EI-delta rationale rendered.',
    recommendation: 'Competency-gap → development recommendation + EI interventions.',
    report: 'Competency / EI development report.',
    kpiFamilies: ['individual', 'learning', 'ai', 'organizational'],
    status: 'SUPPORTED',
    statusNote: 'Competency + EI development AI loop is well-supported; realized development-outcome capture is the universal adoption-gated tail.',
    evidence: ev({
      services: ['services/mei-scoring-engine.ts', 'services/mei-recommendation-engine.ts', 'services/intervention-intelligence.ts'],
      routes: ['routes/capadex.ts'],
      tables: ['ei_profile_snapshots', 'development_recommendations', 'wc3_longitudinal_snapshots'],
      frontend: ['pages/CareerBuilderPage.tsx'],
    }),
  },
  {
    key: 'recruiter_pipeline',
    label: 'HR / Recruiter → Hiring AI loop',
    persona: 'HR / recruiter',
    personas: ['P7'],
    spineReached: ['assessment', 'ai_analysis', 'confidence_scoring', 'recommendation_generation', 'outcome_validation', 'report_generation', 'kpi_update'],
    lifecycleStages: ['CAP_INS', 'CAP_GRW', 'CAP_MAS'],
    assessments: ['competency', 'performance', 'behaviour'],
    aiAnalysis: 'Candidate-match + interview intelligence (calibration k-gated).',
    explainability: 'Match-rationale surfaced; calibration disclosed honestly (Brier/ECE abstain <k_min).',
    recommendation: 'Talent-match ranking → interview → hire decision support.',
    report: 'Hiring decision report; calibration reported separately.',
    kpiFamilies: ['business', 'journey', 'ai'],
    status: 'SUPPORTED',
    statusNote: 'The 9-stage hiring funnel is the most complete realized-outcome family; calibration abstains <k_min=30 (Confidence⟂Coverage).',
    evidence: ev({
      services: ['services/wc7b/decision-orchestrator.ts', 'services/outcome-intelligence-engine.ts'],
      routes: ['routes/capadex.ts'],
      tables: ['wc7b_decision_state', 'validation_loop_outcomes'],
      frontend: ['pages/EmployerPortalPage.tsx'],
    }),
  },
  {
    key: 'institute_cohort',
    label: 'Institute Admin → Cohort AI loop',
    persona: 'Institution administrator',
    personas: ['P9', 'aggregate'],
    spineReached: ['ai_analysis', 'recommendation_generation', 'outcome_validation', 'report_generation', 'kpi_update'],
    lifecycleStages: ['CAP_INS', 'CAP_GRW'],
    assessments: ['competency', 'behaviour', 'progress'],
    aiAnalysis: 'k-anon cohort aggregation (institutional intelligence).',
    explainability: 'Cohort-level rationale (k≥k_min, scores masked below).',
    recommendation: 'Cohort-level act recommendations (k-gated).',
    report: 'Cohort report (aggregate; scores masked below k_min).',
    kpiFamilies: ['organizational', 'lifecycle', 'business'],
    status: 'SUPPORTED',
    statusNote: 'Real k-anon aggregation — scores masked below k_min, roster always shown. Realized cohort-outcome tail adoption-gated.',
    evidence: ev({
      services: ['services/longitudinal-memory.ts', 'services/benchmark-engine.ts'],
      routes: ['routes/enterprise-analytics.ts'],
      tables: ['wc3_longitudinal_snapshots', 'anl_kpi_daily'],
      frontend: ['components/UnifiedInstituteDashboard.tsx'],
    }),
  },
  {
    key: 'mentor_mentee',
    label: 'Mentor / Coach → Mentee AI loop',
    persona: 'Mentor / coach',
    personas: ['P6'],
    spineReached: ['ai_analysis', 'recommendation_generation', 'intervention_selection', 'report_generation'],
    lifecycleStages: ['CAP_GRW', 'CAP_MAS'],
    assessments: ['competency', 'progress'],
    aiAnalysis: 'Mentee progress framing; decision-mentor bridge.',
    explainability: 'Guidance rationale surfaced to the mentor.',
    recommendation: 'Engagement / guidance recommendations.',
    report: 'Mentee progress report.',
    kpiFamilies: ['journey', 'individual'],
    status: 'PARTIAL',
    statusNote: 'Mentor AI framing reuses the decision-orchestrator + runtime guidance; engagement volume is ADOPTION-driven (Coverage⟂Adoption, null≠0).',
    evidence: ev({
      services: ['services/wc7b/decision-orchestrator.ts', 'services/pil/runtime-guidance-engine.ts'],
      routes: ['routes/capadex.ts'],
      tables: ['validation_loop_outcomes'],
      frontend: ['pages/MentorDashboardPage.tsx'],
    }),
  },
  {
    key: 'parent_support',
    label: 'Parent → Support-Child AI loop',
    persona: 'Parent / guardian',
    personas: ['P1', 'P2'],
    spineReached: ['ai_analysis', 'recommendation_generation', 'report_generation'],
    lifecycleStages: ['CAP_INS', 'CAP_GRW'],
    assessments: ['behaviour', 'competency'],
    aiAnalysis: 'Child progress framing via consent-scoped view.',
    explainability: 'Support-action rationale surfaced to the parent.',
    recommendation: 'Support-action recommendations (consent-scoped).',
    report: 'Consent-scoped child progress report.',
    kpiFamilies: ['journey', 'individual'],
    status: 'PARTIAL',
    statusNote: 'Consent-scoped AI framing reuses runtime guidance; support-action volume is ADOPTION-driven (Coverage⟂Adoption, null≠0).',
    evidence: ev({
      services: ['services/pil/runtime-guidance-engine.ts'],
      routes: ['routes/capadex.ts'],
      tables: ['capadex_user_profiles'],
      frontend: ['components/UnifiedParentDashboard.tsx'],
    }),
  },
  {
    key: 'institution_aggregate',
    label: 'Institution → Aggregate Intelligence report',
    persona: 'Institution (aggregate)',
    personas: ['aggregate'],
    spineReached: ['ai_analysis', 'report_generation', 'kpi_update'],
    lifecycleStages: ['CAP_INS'],
    assessments: ['competency', 'behaviour'],
    aiAnalysis: 'Batch-confined cohort aggregation (nested in institute).',
    explainability: 'Aggregate rationale (no per-individual attribution).',
    recommendation: 'Aggregate-only act recommendations (k-gated).',
    report: 'Aggregate intelligence report.',
    kpiFamilies: ['organizational', 'lifecycle'],
    status: 'PARTIAL',
    statusNote: 'Aggregate-only AI report reuses benchmark + analytics; cohort volume is ADOPTION-driven (Coverage⟂Adoption).',
    evidence: ev({
      services: ['services/benchmark-engine.ts', 'services/enterprise-analytics-schema.ts'],
      routes: ['routes/enterprise-analytics.ts'],
      tables: ['anl_kpi_daily', 'wc3_longitudinal_snapshots'],
      frontend: ['components/UnifiedInstituteDashboard.tsx'],
    }),
  },
];

/** Cross-cutting decisions that are NOT silent merges (documented, like 1.4/1.5/1.6). */
export interface AiOrchestrationDecision {
  topic: string;
  decision: string;
  rationale: string;
}

export const AI_ORCHESTRATION_DECISIONS: AiOrchestrationDecision[] = [
  {
    topic: 'Single AI-orchestration layer (no V2)',
    decision: 'COMPOSE_EXISTING',
    rationale: 'AI analysis, reasoning, recommendation, intervention, explainability, report and KPI computation are ALL performed by EXISTING engines. This phase adds ONE read-only composer/registry that audits and orchestrates the READING of those capabilities — never a parallel AI / recommendation / report / KPI engine.',
  },
  {
    topic: 'Engines read, never invoked',
    decision: 'READ_BY_EXISTENCE_AND_PERSISTED_OUTPUT',
    rationale: 'The composer verifies each capability by filesystem existence + persisted-output COUNT (to_regclass + COUNT(*)). It NEVER invokes an AI/reasoning/recommendation/report engine — proving zero behaviour change (byte-identical OFF, and no side effects ON).',
  },
  {
    topic: 'Recommendation / explainability effectiveness',
    decision: 'WIRE_REUSE_CALIBRATION_ABSTAIN_UNTIL_KMIN',
    rationale: 'Where a recommendation→outcome effectiveness rate is implied, it is WIRED via REUSE of the EXISTING validation-loop calibration mechanism (predicted_prob_at_decision; calibrationFromRows/toCalibrationPairs with a k_min gate) — zero new engine/table/DDL. The rate is honestly ABSTAINED (null) until ≥ k_min real non-demo pairs accrue (Confidence axis). Never fabricated.',
  },
  {
    topic: 'Report / KPI population',
    decision: 'REUSE_REPORT_AND_ANALYTICS_ENGINES',
    rationale: 'Reports are composed by the existing PIL/omega builders (capadex_reports); KPI families roll up over the existing enterprise-analytics + benchmark substrate (anl_kpi_daily). Population is usage-driven (Adoption axis, null≠0) — no new report or KPI engine.',
  },
  {
    topic: 'Honesty axes',
    decision: 'KEEP_AXES_SEPARATE',
    rationale: 'Coverage (a capability exists) ⟂ Confidence (calibrated/trustworthy) ⟂ Outcome (realized) ⟂ Adoption (real volume) are reported on their OWN axes and NEVER composited. null (unreadable) ≠ 0 (measured-empty). Revenue stays in capadex_payments and is never composited into AI/outcome KPIs.',
  },
];
