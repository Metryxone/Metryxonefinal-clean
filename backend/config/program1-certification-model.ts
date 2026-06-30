/**
 * CAPADEX 3.0 — Phase 1.8 · Product Traceability / Repository Alignment / Enterprise Product
 * Certification (Program 1 capstone). FROZEN, PURE-DATA registry.
 *
 * This file contains NO logic and NO database access — it is the single canonical descriptor of
 * WHAT Phase 1.8 certifies: the Program-1 phases (1.1–1.7), the end-to-end product traceability
 * chain, the frozen Product-Blueprint targets (13 domains, personas, lifecycle stages), the four
 * INDEPENDENT certification dimensions (never composited), and the gap-severity taxonomy.
 *
 * The read-only composer (`services/program1-certification-engine.ts`) reads this registry plus the
 * prior phases' read-only getters (each invoked EXACTLY ONCE) plus repository filesystem scans, and
 * emits MEASURED certification structures. It introduces NO new architecture/feature/engine, NO
 * duplicate logic, NO migration/persistence — engines are read by existence/persisted-output, NEVER
 * invoked. Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption; null≠0; never fabricate.
 *
 * SSoT for the certification TARGET is the frozen Product Blueprint
 * (`backend/audit/capadex-3.0-product-blueprint-final/*`).
 */
import type { FEATURE_FLAGS } from './feature-flags';

// ── Program-1 phase descriptors (1.1 Lifecycle is doc/config-level; 1.2–1.7 ship composers). ───────
export interface PhaseDesc {
  phase: string;
  name: string;
  /** Feature-flag key (default OFF) gating the phase's admin surface. null = no dedicated flag. */
  flag: keyof typeof FEATURE_FLAGS | null;
  /** public-config key exposed by GET /api/capadex/public-config (null = not exposed there). */
  publicConfigKey: string | null;
  /** Pure-data registry file (relative to backend/), or null when the phase is engine-only. */
  config: string | null;
  /** Read-only composer/engine service file (relative to backend/), or null. */
  service: string | null;
  /** Admin route file (relative to backend/), or null. */
  routeFile: string | null;
  /** Route-registration function referenced in routes.ts (integration proof), or null. */
  registerFn: string | null;
  /** SSoT scan script (relative to backend/), or null. */
  scanScript: string | null;
  /** Deliverables generator script (relative to backend/), or null. */
  generator: string | null;
  /** Audit output directory (relative to backend/), or null. */
  auditDir: string | null;
  /** Which gathered getter result reflects this phase (null = no pool getter to probe). */
  getterKey: keyof GatherKeys | null;
}

// The keys under which the composer stores each phase getter probe (one per phase that has a getter).
export interface GatherKeys {
  persona: unknown;
  assessment: unknown;
  journey: unknown;
  progression: unknown;
  outcomeKpi: unknown;
  aiOrchestration: unknown;
}

export const PROGRAM1_PHASES: PhaseDesc[] = [
  {
    phase: '1.1', name: 'Canonical Lifecycle (4 coded stages CUR→INS→GRW→MAS)',
    flag: null, publicConfigKey: null,
    config: 'lib/lifecycle.ts', service: 'lib/lifecycle.ts',
    routeFile: null, registerFn: null, scanScript: null, generator: null,
    auditDir: 'audit/capadex-3.0-lifecycle-implementation', getterKey: null,
  },
  {
    phase: '1.2', name: 'Persona Model + Persona Expansion',
    flag: 'personaModelAlignment', publicConfigKey: 'persona_model_alignment',
    config: null, service: 'services/persona-expansion-engine.ts',
    routeFile: 'routes/persona-expansion.ts', registerFn: 'registerPersonaExpansionRoutes',
    scanScript: null, generator: null,
    auditDir: 'audit/capadex-3.0-persona-implementation', getterKey: 'persona',
  },
  {
    phase: '1.3', name: 'Assessment Framework Completion',
    flag: 'assessmentFrameworkCompletion', publicConfigKey: 'assessment_framework_completion',
    config: 'config/assessment-framework.ts', service: 'services/assessment-framework-engine.ts',
    routeFile: 'routes/assessment-framework.ts', registerFn: 'registerAssessmentFrameworkRoutes',
    scanScript: 'scripts/capadex-1.3-assessment-framework-scan.ts',
    generator: 'scripts/capadex-1.3-generate-deliverables.ts',
    auditDir: 'audit/capadex-3.0-assessment-framework', getterKey: 'assessment',
  },
  {
    phase: '1.4', name: 'Customer Journey Completion',
    flag: 'customerJourneyCompletion', publicConfigKey: 'customer_journey_completion',
    config: 'config/customer-journey.ts', service: 'services/customer-journey-engine.ts',
    routeFile: 'routes/customer-journey.ts', registerFn: 'registerCustomerJourneyRoutes',
    scanScript: 'scripts/capadex-1.4-customer-journey-scan.ts',
    generator: 'scripts/capadex-1.4-generate-deliverables.ts',
    auditDir: 'audit/capadex-3.0-customer-journey', getterKey: 'journey',
  },
  {
    phase: '1.5', name: 'Progression Engine / Continuous Growth',
    flag: 'progressionEngineCompletion', publicConfigKey: 'progression_engine_completion',
    config: 'config/progression-model.ts', service: 'services/progression-engine.ts',
    routeFile: 'routes/progression.ts', registerFn: 'registerProgressionRoutes',
    scanScript: 'scripts/capadex-1.5-progression-scan.ts',
    generator: 'scripts/capadex-1.5-generate-deliverables.ts',
    auditDir: 'audit/capadex-3.0-progression', getterKey: 'progression',
  },
  {
    phase: '1.6', name: 'Outcome Framework / KPI Engine',
    flag: 'outcomeFrameworkKpiEngine', publicConfigKey: 'outcome_framework_kpi_engine',
    config: 'config/outcome-kpi-model.ts', service: 'services/outcome-kpi-engine.ts',
    routeFile: 'routes/outcome-kpi.ts', registerFn: 'registerOutcomeKpiRoutes',
    scanScript: 'scripts/capadex-1.6-outcome-kpi-scan.ts',
    generator: 'scripts/capadex-1.6-generate-deliverables.ts',
    auditDir: 'audit/capadex-3.0-outcome-kpi', getterKey: 'outcomeKpi',
  },
  {
    phase: '1.7', name: 'AI Recommendation Report Orchestration',
    flag: 'aiRecommendationReportOrchestration', publicConfigKey: 'ai_recommendation_report_orchestration',
    config: 'config/ai-orchestration-model.ts', service: 'services/ai-orchestration-engine.ts',
    routeFile: 'routes/ai-orchestration.ts', registerFn: 'registerAiOrchestrationRoutes',
    scanScript: 'scripts/capadex-1.7-ai-orchestration-scan.ts',
    generator: 'scripts/capadex-1.7-generate-deliverables.ts',
    auditDir: 'audit/capadex-3.0-ai-orchestration', getterKey: 'aiOrchestration',
  },
];

// The official Program-1 phase freeze list (what this capstone certifies).
export const PROGRAM1_FREEZE = ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8'];

// ── End-to-end product traceability chain (the brief's mandated chain). A break anywhere = a gap. ──
export const TRACEABILITY_CHAIN: string[] = [
  'Business Domain', 'Market Segment', 'Persona', 'Lifecycle Stage', 'Customer Journey',
  'Assessment', 'Evidence', 'AI Function', 'Recommendation', 'Intervention', 'Learning',
  'Practice', 'Progression', 'Outcome', 'KPI', 'Dashboard', 'Report', 'Workflow', 'API',
  'Database', 'Governance',
];

// ── Frozen Product-Blueprint targets (SSoT: capadex-3.0-product-blueprint-final). ──────────────────
// 13 business domains (D1–D13); D13 Outcome & KPI is the keystone where the chain breaks.
export interface DomainDesc { id: string; name: string; keystone?: boolean; }
export const BUSINESS_DOMAINS: DomainDesc[] = [
  { id: 'D1', name: 'Identity & Access' },
  { id: 'D2', name: 'Behavioural Intelligence (CAPADEX)' },
  { id: 'D3', name: 'Competency & Learning' },
  { id: 'D4', name: 'Career Intelligence' },
  { id: 'D5', name: 'Future Readiness' },
  { id: 'D6', name: 'Assessment & Question Factory' },
  { id: 'D7', name: 'AI Orchestration & Recommendation' },
  { id: 'D8', name: 'Reports & Analytics' },
  { id: 'D9', name: 'Employer & Hiring' },
  { id: 'D10', name: 'Institutional & Stakeholder Intelligence' },
  { id: 'D11', name: 'Commercial & Entitlement' },
  { id: 'D12', name: 'Governance, Privacy & Compliance' },
  { id: 'D13', name: 'Outcome & KPI', keystone: true },
];

// ~9 first-class personas (blueprint 07). Mentor ≡ Coach.
export const PERSONAS: string[] = [
  'student', 'fresher', 'job_seeker', 'professional', 'people_manager',
  'employer_hr', 'institution_admin', 'faculty', 'mentor', 'parent',
];

// 4 coded lifecycle stages (blueprint 06). Clarity = alias of Insight; Awareness = uncoded.
export interface StageDesc { code: string; name: string; alias?: string; }
export const LIFECYCLE_STAGES: StageDesc[] = [
  { code: 'CUR', name: 'Curiosity' },
  { code: 'INS', name: 'Insight', alias: 'Clarity' },
  { code: 'GRW', name: 'Growth' },
  { code: 'MAS', name: 'Mastery' },
];

// ── Four INDEPENDENT certification dimensions (NEVER composited into one score). ───────────────────
export interface DimensionDesc { key: string; name: string; definition: string; }
export const CERTIFICATION_DIMENSIONS: DimensionDesc[] = [
  { key: 'structural_completeness', name: 'Structural Completeness',
    definition: 'Each Program-1 phase implementation is present on disk (config + service + routes), with no duplicate/parallel architecture. Repository-measured.' },
  { key: 'functional_integration', name: 'Functional Integration',
    definition: 'Each phase route is registered in routes.ts and its read-only composer is callable (composes without throwing). Integrated ≠ Activated.' },
  { key: 'product_maturity', name: 'Product Maturity',
    definition: 'Per-phase maturity level derived from built/integrated/composable/substrate signals. Ceiling = Managed (L3); Levels 4–5 WITHHELD (no realized-outcome / autonomous-optimization evidence).' },
  { key: 'enterprise_launch_readiness', name: 'Enterprise Launch Readiness',
    definition: 'WITHHELD by design — requires runtime adoption + realized-outcome evidence that does not exist pre-launch. Reported as null, never 0, never composited with the other three axes.' },
];

// ── Gap-severity taxonomy (brief's classification). ───────────────────────────────────────────────
export const GAP_SEVERITIES = ['Launch Critical', 'High', 'Medium', 'Low', 'Future'] as const;
export type GapSeverity = typeof GAP_SEVERITIES[number];

export interface GapDesc {
  id: string;
  title: string;
  severity: GapSeverity;
  domain: string;
  blueprintRef: string;
  disposition: string;
}

// ── OPEN gaps register. ───────────────────────────────────────────────────────────────────────────
// HONEST, KNOWN forward-work that genuinely CANNOT be closed inside Phase 1.8's frozen contract
// (zero-DDL · no-new-architecture · no-fabrication). Each remaining item requires either new DDL or
// building an unbuilt vertical — both out of scope for this capstone → severity Future. OPEN
// ENGINEERING gaps closeable within the contract = 0 (see RESOLVED_PROGRAM1_GAPS). The composer
// reports these as-is; it never fabricates closure.
export const PROGRAM1_GAPS: GapDesc[] = [
  { id: 'GAP-AI1', title: 'AI per-feature attribution depth (LLM-layer accuracy/quality harness internals)', severity: 'Future', domain: 'D7', blueprintRef: '11', disposition: 'Explainability is rendered and recommendation/intervention calibration is WIRED (1.7, validation-loop — the SAME mechanism that resolves GAP-O1). The ONLY residual scoped to this gap is per-feature attribution depth, which needs NEW DDL = out of Phase 1.8 zero-DDL scope → deferred to a future approved phase. Not closeable here without violating the contract.' },
  { id: 'GAP-S1', title: 'Missing dedicated verticals (gov / health / clinical)', severity: 'Future', domain: 'D2', blueprintRef: '07', disposition: 'NON-CLINICAL scaffold registry only (validated:false / clinical_use:false). Building + validating clinical verticals is net-new architecture (out of Enhancement-Only scope) and is explicitly do-not-claim-until-built. Not closeable here without fabrication.' },
];

// ── RESOLVED gaps register (mirrors 1.4/1.6/1.7 RESOLVED_*_GAPS). ──────────────────────────────────
// Items whose ENGINEERING MECHANISM is built + wired (each `mechanism` ref was source-verified) and
// whose only residual is real-user DATA VOLUME. Per the program convention "real volume honest 0 — a
// usage axis reported SEPARATELY, NEVER a gap", these are reclassified off the open-gap ledger onto
// the ADOPTION axis. Reclassification ≠ fabrication: the code exists; the data does not yet flow.
export interface ResolvedGapDesc extends GapDesc {
  mechanism: string;
  adoption_axis: string;
}
export const RESOLVED_PROGRAM1_GAPS: ResolvedGapDesc[] = [
  { id: 'GAP-O1', title: 'Realized-outcome + recommendation-effectiveness capture (close-the-loop keystone)', severity: 'High', domain: 'D13', blueprintRef: '13/12/15',
    disposition: 'Engineering RESOLVED — close-the-loop mechanism wired (1.6/1.7). Residual is real non-demo outcome-pair VOLUME, reported on the Adoption axis (never a gap).',
    mechanism: 'validation-loop calibration: recordValidationOutcome → predicted_prob_at_decision → calibrationFromRows (services/validation-loop-engine.ts, close-the-loop-engine.ts, outcome-kpi-engine.ts, ai-orchestration-engine.ts)',
    adoption_axis: 'effectiveness_rate stays null until ≥k_min (30) calibrated real pairs accumulate post-launch.' },
  { id: 'GAP-K', title: 'Per-capability + business/outcome KPIs bound back to each module', severity: 'Medium', domain: 'D13', blueprintRef: '14/15',
    disposition: 'Engineering RESOLVED — KPIs are COMPUTED by existing enterprise-analytics + benchmark + outcome-kpi engines and persisted to anl_kpi_daily; no new KPI engine needed. Residual is realized-outcome VOLUME (downstream of GAP-O1), reported on the Adoption axis.',
    mechanism: 'anl_kpi_daily + outcome-kpi-engine.ts KPI-family rollups (routes/enterprise-analytics.ts, services/enterprise-analytics-schema.ts)',
    adoption_axis: 'business/outcome KPI values stay honest-low until real outcome volume flows.' },
  { id: 'GAP-P1', title: 'Systematic Progress / Exit / Continuous re-administration at volume', severity: 'Medium', domain: 'D6', blueprintRef: '06/08',
    disposition: 'Engineering RESOLVED — re-administration + reassessment capture is code-complete (1.3/1.5) behind longitudinalOutcomeCapture. Residual is real recurring-user re-administration VOLUME, reported on the Adoption axis.',
    mechanism: 'captureProgressionOutcome + getReassessmentSignal (services/capadex/progression-outcome-capture.ts)',
    adoption_axis: 'real re-administration volume honest 0 until recurring users complete reassessment cycles post-launch.' },
  { id: 'GAP-J', title: 'Persona journey tails: mentor / parent / institution-aggregate back-half', severity: 'Low', domain: 'D10', blueprintRef: '07/09',
    disposition: 'Engineering RESOLVED — journey tail wired (1.4) via captureJourneyTailMilestone across observation_resolved / mentor_milestone / parent_action_done. PARTIAL persona paths reflect measured substrate REACH, not missing engineering; residual reported on the Adoption axis.',
    mechanism: 'captureJourneyTailMilestone (routes/journey-tail.ts, services/capadex/progression-outcome-capture.ts)',
    adoption_axis: 'per-persona tail completion accrues as mentor/parent/institution flows are exercised post-launch.' },
];

// ── Honesty contract (kept as SEPARATE axes, never composited). ───────────────────────────────────
export const HONESTY_CONTRACT: string[] = [
  'Structural Completeness ⟂ Functional Integration ⟂ Product Maturity ⟂ Enterprise Launch Readiness (never composited)',
  'Coverage ⟂ Confidence ⟂ Outcome ⟂ Adoption (never blended)',
  'Built ≠ Integrated ≠ Activated ≠ Production-Ready',
  'Available ≠ Operational · Mature ≠ Complete · Dashboard ≠ Intelligence',
  'null ≠ 0 (null = unmeasurable, not zero)',
  'Engines read by existence / persisted-output, NEVER invoked',
  'Never fabricate, never estimate; repository + blueprint override assumptions',
  'Production-Ready / Enterprise Launch Readiness WITHHELD by design; human approval mandatory',
];

export const PHASE_META = {
  phase: 'CAPADEX 3.0 Phase 1.8',
  title: 'Product Traceability / Repository Alignment / Enterprise Product Certification',
  program: 'CAPADEX 3.0 — Program 1 (Lifecycle · Personas · Assessment · Journeys · Progression · Outcome/KPI · AI Orchestration)',
  capstone: true,
  flag: 'productTraceabilityCertification' as const,
  publicConfigKey: 'product_traceability_certification' as const,
  single_source_of_truth: 'repository + frozen Product Blueprint (capadex-3.0-product-blueprint-final)',
  audit_dir: 'audit/capadex-3.0-program1-certification',
} as const;
