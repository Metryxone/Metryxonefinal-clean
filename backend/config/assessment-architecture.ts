/**
 * CAPADEX 3.0 — Program 3 · Phase 3.1 Assessment Architecture Certification
 * ────────────────────────────────────────────────────────────────────────
 * THE ONE canonical Assessment Architecture registry (single source of truth for the
 * certification). This module is PURE DATA. It introduces NO new engine, NO V2, NO duplicate
 * logic, NO schema. It COMPOSES the Program-3 FROZEN blueprint (docs 03/04/17/18/20 in
 * `backend/audit/program-3-assessment-platform-blueprint/`) and the FROZEN assessment-framework
 * registry (`config/assessment-framework.ts`) into a runtime-readable certification model that
 * REFERENCES the EXISTING implementations by file/table only (reuse-before-build, zero DDL).
 *
 * The architecture is FROZEN — this phase does NOT re-decide it. It certifies FIVE INDEPENDENT
 * axes over the existing substrate:
 *   1. Architecture           — the 13-layer canonical decomposition + 10-type taxonomy.
 *   2. Lifecycle              — ONE 10-state assessment lifecycle mapped onto existing per-artifact states.
 *   3. Governance             — the governance/control-plane model.
 *   4. Metadata               — the 18-field metadata standard + per-source coverage crosswalk.
 *   5. Repository-Alignment   — every evidence claim verified against the live filesystem + DB.
 *
 * Honesty contract: the five axes are certified SEPARATELY and NEVER composited.
 * Coverage (does an implementation exist?) ⟂ Confidence (is output trustworthy?) ⟂ Adoption
 * (real usage/data volume). Evidence paths are CLAIMS verified independently by
 * `scripts/capadex-3.1-assessment-architecture-scan.ts` against the live filesystem + DB — the
 * scan, not this file, is the SSoT for "present/absent" numbers. null ≠ 0; never fabricate.
 */

import {
  ASSESSMENT_FRAMEWORK,
  SPEC_19_CROSSWALK,
  KNOWN_OVERLAPS,
  type AssessmentStatus,
} from './assessment-framework';

/** Coverage status for an architecture element (does an implementation exist?). */
export type ArchStatus = 'SUPPORTED' | 'PARTIAL' | 'DEAD_END' | 'MISSING';

/** Repo evidence — existing implementations REUSED (no rebuild). Verified vs live FS+DB by the scan. */
export interface ArchEvidence {
  services: string[];
  routes: string[];
  tables: string[];
  frontend: string[];
}

/** The FIVE independent certification axes — certified SEPARATELY, never composited. */
export const ARCHITECTURE_AXES = [
  'architecture', 'lifecycle', 'governance', 'metadata', 'repository_alignment',
] as const;
export type ArchitectureAxis = typeof ARCHITECTURE_AXES[number];

// ─────────────────────────────────────────────────────────────────────────
// 1. ARCHITECTURE AXIS — the 13-layer canonical decomposition (FROZEN, doc 03)
// ─────────────────────────────────────────────────────────────────────────
export interface ArchLayer {
  layer: number;
  key: string;
  label: string;
  definition: string;
  status: ArchStatus;
  /** Honest note on WHY a status is PARTIAL (Coverage⟂Confidence). */
  statusNote?: string;
  evidence: ArchEvidence;
}

/**
 * THE 13-LAYER CANONICAL ARCHITECTURE (FROZEN — doc 03 §"13-Layer Canonical Architecture").
 * Evidence references EXISTING files/tables only; verified present/absent by the scan.
 */
export const ARCHITECTURE_LAYERS: ArchLayer[] = [
  {
    layer: 1, key: 'foundation', label: 'Assessment Foundation',
    definition: 'What an assessment IS: type, category, template, metadata, version, lifecycle, governance, publishing. SSoT = the frozen assessment-framework registry.',
    status: 'SUPPORTED',
    evidence: {
      services: ['config/assessment-framework.ts', 'services/governance/admin-lifecycle.ts', 'services/platform-lifecycle.ts'],
      routes: ['routes/assessment-framework.ts', 'routes/assessment-writer.ts'],
      tables: ['assessment_templates', 'assessment_template_questions', 'exams'],
      frontend: ['components/FreeAssessmentModal.tsx'],
    },
  },
  {
    layer: 2, key: 'question_platform', label: 'Question Platform',
    definition: 'Authoring, banking and governance of items across the behavioural + competency families.',
    status: 'SUPPORTED',
    evidence: {
      services: ['services/question-factory.ts', 'services/question-registry-service.ts'],
      routes: ['routes/capadex.ts'],
      tables: ['psychometric_question_bank', 'capadex_question_registry', 'onto_competency_question_map'],
      frontend: [],
    },
  },
  {
    layer: 3, key: 'authoring', label: 'Assessment Authoring',
    definition: 'The CAF builder — authored, rubric/IRT/CTT/SJT/BARS assessments with sections, scoring and randomization rules.',
    status: 'SUPPORTED',
    evidence: {
      services: ['services/caf/scoring-engine.ts'],
      routes: ['routes/caf-assessment-builder.ts'],
      tables: ['caf_assessments', 'caf_assessment_sections', 'caf_score_rules', 'caf_randomization_rules'],
      frontend: [],
    },
  },
  {
    layer: 4, key: 'delivery', label: 'Assessment Delivery',
    definition: 'Runtime delivery of both families — the flagship consumer flow and the flag-gated adaptive/CAF runtime.',
    status: 'SUPPORTED',
    evidence: {
      services: ['adaptive/adaptive-question-pipeline.ts'],
      routes: ['routes/caf-runtime.ts'],
      tables: ['caf_sessions', 'capadex_sessions'],
      frontend: ['components/FreeAssessmentModal.tsx', 'components/AdaptiveAssessmentRuntime.tsx'],
    },
  },
  {
    layer: 5, key: 'scoring', label: 'Scoring Engine',
    definition: 'Dimension/weighting scoring for the behavioural family + rubric/IRT/CTT scoring for the CAF family (two intentional sciences).',
    status: 'SUPPORTED',
    evidence: {
      services: ['services/dimension-scoring-engine.ts', 'services/weighting-engine.ts', 'services/caf/scoring-engine.ts', 'services/reliability-engine.ts'],
      routes: [],
      tables: ['capadex_signal_profiles', 'spe_behavioural_scores'],
      frontend: [],
    },
  },
  {
    layer: 6, key: 'norms', label: 'Norm Engine',
    definition: 'Population norm-referencing. Age norms exist; gender/education/competitive-exam norms are data-coverage gaps computed by the same engine when a real, k-sufficient distribution exists.',
    status: 'PARTIAL',
    statusNote: 'Only age norms are populated. Gender/education-tier/competitive-exam norm-referencing is a DATA-coverage gap (GAP-AA-4/5/6), not an architecture gap — the same engine computes them once a real k≥k_min distribution exists; never fabricated.',
    evidence: {
      services: ['services/lbi-norms-engine.ts', 'services/weighting-engine.ts', 'services/contextual-norm-engine.ts'],
      routes: [],
      tables: ['lbi_subdomain_norms', 'lbi_age_bands'],
      frontend: [],
    },
  },
  {
    layer: 7, key: 'standardization', label: 'Standardization',
    definition: 'Percentile / z / standardized-score transforms. Percentile + z + deviation exist; canonical T(SD=10)/stanine/sten breadth is a Low additive gap.',
    status: 'PARTIAL',
    statusNote: 'Percentile/z/deviation transforms exist. Canonical T(M=50,SD=10)/stanine/sten breadth is a Low additive transform gap (GAP-AA-7); deviation SD=15 must not be mislabelled "T". Coverage⟂Confidence.',
    evidence: {
      services: ['services/lbi-norms-engine.ts', 'services/reliability-engine.ts', 'services/dimension-scoring-engine.ts'],
      routes: [],
      tables: ['lbi_subdomain_norms'],
      frontend: [],
    },
  },
  {
    layer: 8, key: 'benchmarking', label: 'Benchmark Engine',
    definition: 'Relative cohort/industry/role benchmarking with k-anonymity (k=30). Kept DISTINCT from Norms (standardized).',
    status: 'SUPPORTED',
    evidence: {
      services: ['services/benchmark-engine.ts', 'services/m5-org-benchmark.ts', 'services/mei-benchmark-engine.ts', 'services/peer-benchmark.ts'],
      routes: [],
      tables: ['ti_industry_benchmarks', 'ti_role_benchmarks', 'ti_layer_benchmarks', 'rf_benchmark_configs'],
      frontend: [],
    },
  },
  {
    layer: 9, key: 'ai_interpretation', label: 'AI Interpretation',
    definition: 'Reasoning, explainability, confidence and recommendation over scored assessments.',
    status: 'SUPPORTED',
    evidence: {
      services: ['services/ai-orchestration-engine.ts', 'services/ai-reasoning-engine.ts', 'services/capadex-explainability-engine.ts', 'services/recommendation-intelligence-engine.ts'],
      routes: ['routes/ai-orchestration.ts'],
      tables: ['ai_reasoning_chains', 'development_recommendations', 'capadex_interventions'],
      frontend: [],
    },
  },
  {
    layer: 10, key: 'report_intelligence', label: 'Report Intelligence',
    definition: 'Report Factory — templated, multi-audience, multi-language report generation and PDF rendering.',
    status: 'SUPPORTED',
    evidence: {
      services: ['services/report-factory-schema.ts', 'services/dynamic-report.ts', 'services/report-pack.ts', 'services/pdf-renderer.ts'],
      routes: [],
      tables: ['rf_templates', 'rf_template_sections', 'rf_language_packs', 'capadex_reports'],
      frontend: ['components/admin/ReportFactoryPanel.tsx'],
    },
  },
  {
    layer: 11, key: 'visualization', label: 'Visualization',
    definition: 'Chart/data resolution for reports and dashboards (radar/heatmap/benchmark/progress).',
    status: 'SUPPORTED',
    evidence: {
      services: ['services/viz-data-resolver.ts', 'services/benchmark-engine.ts'],
      routes: [],
      tables: [],
      frontend: ['lib/intelligence/progressLedger.ts'],
    },
  },
  {
    layer: 12, key: 'analytics', label: 'Assessment Analytics',
    definition: 'Enterprise analytics star-schema over assessment facts (scores, cohorts, predictive features, KPIs).',
    status: 'SUPPORTED',
    evidence: {
      services: ['services/enterprise-analytics-schema.ts'],
      routes: ['routes/enterprise-analytics.ts'],
      tables: ['anl_fact_scores', 'anl_cohort_analysis', 'anl_predictive_features', 'anl_kpi_daily'],
      frontend: [],
    },
  },
  {
    layer: 13, key: 'administration', label: 'Assessment Administration',
    definition: 'Admin surfaces — report/question factory admin, platform audit, white-label config. AI-prompt management is a net-new additive gap.',
    status: 'SUPPORTED',
    statusNote: 'Core admin surfaces exist. AI-prompt management (prompts code-embedded) is a Medium additive gap (GAP-AA-9), governable through existing aig_prompts/aig_prompt_versions — an enhancement over the frozen architecture, not an architecture gap.',
    evidence: {
      services: [],
      routes: ['routes/platform-audit-routes.ts', 'routes/enterprise-analytics.ts'],
      tables: ['rf_white_label_configs'],
      frontend: ['components/admin/ReportFactoryPanel.tsx'],
    },
  },
];

/**
 * TWO assessment families under ONE platform (doc 03 §"Assessment Families") — overlapping-by-design,
 * NOT accidental duplication. Certified as ONE architecture, not merged.
 */
export const ASSESSMENT_FAMILIES: { key: string; label: string; description: string; anchors: string[] }[] = [
  {
    key: 'behavioural_signal', label: 'CAPADEX behavioural / signal family',
    description: 'The consumer flow producing behavioural signals scored by dimension/weighting engines and interpreted through the CAPADEX runtime (concern/clarity, adaptive-next).',
    anchors: ['components/FreeAssessmentModal.tsx', 'services/dimension-scoring-engine.ts', 'services/weighting-engine.ts'],
  },
  {
    key: 'caf_competency', label: 'CAF competency / academic family',
    description: 'Authored rubric/IRT/CTT/SJT/BARS assessments built in the CAF builder and scored by caf/scoring-engine.',
    anchors: ['routes/caf-assessment-builder.ts', 'services/caf/scoring-engine.ts'],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// TAXONOMY — composed from the FROZEN 10-type registry (never forked)
// ─────────────────────────────────────────────────────────────────────────
/** Re-export the frozen taxonomy so the certification has ONE type source (composed, not copied). */
export const CANONICAL_TYPES = ASSESSMENT_FRAMEWORK.map((t) => ({
  key: t.key, label: t.label, status: t.status as AssessmentStatus, specAliases: t.specAliases,
}));

/**
 * ASSESSMENT-TYPE CROSSWALK — the frozen SPEC_19_CROSSWALK + the three additional spec names
 * (Aptitude / Organization / Custom) marked as ABSENT / folds. Certifies there is ONE taxonomy:
 * every legacy/spec name folds into a canonical type OR is honestly marked not-a-separate-type.
 */
export const TYPE_CROSSWALK: { specName: string; canonicalKey: string | null; disposition: 'FOLDS' | 'ABSENT'; note: string }[] = [
  ...SPEC_19_CROSSWALK.map((c) => ({ specName: c.specName, canonicalKey: c.canonicalKey, disposition: 'FOLDS' as const, note: c.note })),
  { specName: 'Aptitude', canonicalKey: 'competency', disposition: 'FOLDS', note: 'Aptitude items fold into Competency/Diagnostic delivery (question-bank cognitive items); NOT a separate canonical type.' },
  { specName: 'Organization', canonicalKey: null, disposition: 'ABSENT', note: 'Organization/institutional roll-up is an AGGREGATION lens (enterprise-analytics), not an assessment type — no separate taxonomy entry.' },
  { specName: 'Custom', canonicalKey: null, disposition: 'ABSENT', note: 'Custom/ad-hoc assessments are authored via the CAF builder against the canonical types — not a distinct taxonomy entry.' },
];

// ─────────────────────────────────────────────────────────────────────────
// CATEGORY MODEL — validated categories ⟂ non-validated scaffolds
// ─────────────────────────────────────────────────────────────────────────
export const ASSESSMENT_CATEGORIES: {
  key: string; label: string; validated: boolean; clinicalUse: boolean; description: string; evidence: string[];
}[] = [
  { key: 'academic', label: 'Academic', validated: true, clinicalUse: false, description: 'Curriculum/competency academic assessments (CAF family).', evidence: ['assessment_templates.category', 'caf_assessments'] },
  { key: 'behavioural', label: 'Behavioural', validated: true, clinicalUse: false, description: 'CAPADEX behavioural-signal assessments (concern/clarity).', evidence: ['capadex_sessions', 'capadex_signal_profiles'] },
  { key: 'competency', label: 'Competency', validated: true, clinicalUse: false, description: 'Ontology-backed competency assessment (onto_* / LBI).', evidence: ['onto_competency_question_map', 'psychometric_question_bank'] },
  { key: 'practice', label: 'Practice', validated: true, clinicalUse: false, description: 'Curated practice/MCQ delivery (learning sub-type).', evidence: ['assessment_templates.category'] },
  { key: 'olympiad', label: 'Olympiad', validated: true, clinicalUse: false, description: 'Olympiad/short-assessment templates.', evidence: ['assessment_templates.category', 'routes/short-assessments.ts'] },
  // Non-validated scaffolds — boundary markers, NOT products. Never certified as validated/clinical.
  { key: 'clinical_psychology', label: 'Clinical Psychology (scaffold)', validated: false, clinicalUse: false, description: 'NOT VALIDATED / NOT FOR CLINICAL OR DIAGNOSTIC USE — boundary marker only.', evidence: [] },
  { key: 'healthcare', label: 'Healthcare (scaffold)', validated: false, clinicalUse: false, description: 'NOT VALIDATED / NOT FOR CLINICAL OR DIAGNOSTIC USE — boundary marker only.', evidence: [] },
  { key: 'government', label: 'Government / Public-Sector (scaffold)', validated: false, clinicalUse: false, description: 'NOT VALIDATED — scaffold registry entry, not a product.', evidence: [] },
];

// ─────────────────────────────────────────────────────────────────────────
// 2. LIFECYCLE AXIS — ONE 10-state canonical assessment lifecycle
// ─────────────────────────────────────────────────────────────────────────
export interface LifecycleState {
  order: number;
  key: string;
  label: string;
  description: string;
  /** How the CANONICAL state maps onto the EXISTING per-artifact lifecycle states (no new engine). */
  mapsTo: string[];
}

/** THE ONE 10-state canonical assessment lifecycle. Mapped onto existing per-artifact states; zero DDL. */
export const LIFECYCLE_STATES: LifecycleState[] = [
  { order: 1, key: 'draft', label: 'Draft', description: 'Authored, not yet reviewed.', mapsTo: ['exams.status=Draft', 'caf_assessments.status=draft', 'question_registry status=draft'] },
  { order: 2, key: 'review', label: 'Review', description: 'Submitted for content/SME review.', mapsTo: ['governance/admin-lifecycle.ts review transition', 'question-registry human review'] },
  { order: 3, key: 'pilot', label: 'Pilot', description: 'Limited pilot administration to gather item statistics.', mapsTo: ['assessment_templates pilot rows', 'caf pilot sessions (caf_sessions)'] },
  { order: 4, key: 'validation', label: 'Validation', description: 'Reliability/validity checked before approval.', mapsTo: ['services/reliability-engine.ts outputs', 'validation_loop_outcomes'] },
  { order: 5, key: 'approval', label: 'Approval', description: 'Human/governance approval to publish.', mapsTo: ['services/governance/admin-lifecycle.ts approve', 'question_registry status=approved'] },
  { order: 6, key: 'published', label: 'Published', description: 'Published/available but not yet the served default.', mapsTo: ['exams.status=Published', 'caf_assessments.published_at'] },
  { order: 7, key: 'active', label: 'Active', description: 'Live and being administered to users.', mapsTo: ['capadex_sessions (live runs)', 'caf_sessions (live)'] },
  { order: 8, key: 'suspended', label: 'Suspended', description: 'Temporarily withdrawn (issue/hold) — reversible.', mapsTo: ['services/platform-lifecycle.ts suspend', 'feature-flag gate OFF (reversible)'] },
  { order: 9, key: 'deprecated', label: 'Deprecated', description: 'Superseded by a newer version; retained for continuity.', mapsTo: ['services/platform-lifecycle.ts deprecate', 'methodology_versions superseded'] },
  { order: 10, key: 'archived', label: 'Archived', description: 'Retired from service; retained for audit only.', mapsTo: ['services/platform-lifecycle.ts archive', 'lbi_questions_legacy (archived bank)'] },
];

/** Per-artifact lifecycle sources the canonical 10-state model reconciles (mapping model). */
export const LIFECYCLE_MAPPING: { artifact: string; states: string; source: string; status: ArchStatus }[] = [
  { artifact: 'exams', states: 'Draft → Published', source: 'exams.status', status: 'PARTIAL' },
  { artifact: 'caf_assessments', states: 'draft → published (published_at)', source: 'caf_assessments.status + published_at', status: 'PARTIAL' },
  { artifact: 'question registry', states: 'draft → approved', source: 'capadex_question_registry status', status: 'PARTIAL' },
  { artifact: 'platform lifecycle', states: 'active → suspended → deprecated → archived', source: 'services/platform-lifecycle.ts', status: 'SUPPORTED' },
  { artifact: 'governance lifecycle', states: 'review → approval', source: 'services/governance/admin-lifecycle.ts', status: 'SUPPORTED' },
  { artifact: 'CAPADEX lifecycle stages', states: 'CAP_CUR → CAP_INS → CAP_GRW → CAP_MAS (subject journey, distinct axis)', source: 'lib/lifecycle.ts', status: 'SUPPORTED' },
];

// ─────────────────────────────────────────────────────────────────────────
// 3. GOVERNANCE AXIS — the control-plane / governance model
// ─────────────────────────────────────────────────────────────────────────
export const GOVERNANCE_CONTROLS: {
  key: string; label: string; description: string; status: ArchStatus; evidence: string[];
}[] = [
  { key: 'admin_gate', label: 'Super-admin gate', description: 'requireAuth + requireSuperAdmin front every management surface; global /api/admin gate applies platform-wide.', status: 'SUPPORTED', evidence: ['services/governance/admin-lifecycle.ts', 'lib/admin-path-gate.ts'] },
  { key: 'feature_flags', label: 'Feature-flag control plane', description: 'Every additive phase ships behind a default-OFF flag; OFF is byte-identical incl. schema.', status: 'SUPPORTED', evidence: ['config/feature-flags.ts'] },
  { key: 'lifecycle_governance', label: 'Lifecycle governance', description: 'Review/approval transitions governed by admin-lifecycle; no parallel lifecycle engine.', status: 'SUPPORTED', evidence: ['services/governance/admin-lifecycle.ts', 'services/platform-lifecycle.ts'] },
  { key: 'audit_trail', label: 'Audit trail', description: 'Admin actions written to a redacted, unified audit trail.', status: 'SUPPORTED', evidence: ['admin_audit_logs', 'routes/platform-audit-routes.ts'] },
  { key: 'question_governance', label: 'Question/registry governance', description: 'Item status transitions are human-only; served bank reads only approved rows.', status: 'SUPPORTED', evidence: ['services/question-registry-service.ts', 'capadex_question_registry'] },
  { key: 'prompt_governance', label: 'AI-prompt governance', description: 'Prompt versioning through aig_prompts/aig_prompt_versions. Prompts are currently code-embedded — a Medium additive enhancement (GAP-AA-9).', status: 'PARTIAL', statusNote: 'Substrate (aig_prompts/aig_prompt_versions) exists; wiring code-embedded prompts through it is additive.', evidence: ['aig_prompts', 'aig_prompt_versions'] } as any,
  { key: 'ethics_gate', label: 'Ethics / norm-fabrication gate', description: 'Group norms compute only from real, k-sufficient distributions; gender norms are owner/legal-gated; never fabricated.', status: 'SUPPORTED', evidence: ['services/lbi-norms-engine.ts'] },
];

// ─────────────────────────────────────────────────────────────────────────
// 4. METADATA AXIS — the 18-field metadata standard + per-source coverage
// ─────────────────────────────────────────────────────────────────────────
/** THE 18-field canonical assessment-metadata standard. */
export const METADATA_STANDARD: { field: string; description: string; required: boolean }[] = [
  { field: 'id', description: 'Stable unique identifier.', required: true },
  { field: 'key', description: 'Canonical machine key.', required: true },
  { field: 'label', description: 'Human-readable name.', required: true },
  { field: 'type', description: 'Canonical assessment type (10-type taxonomy).', required: true },
  { field: 'category', description: 'Assessment category (Academic/Behavioural/Competency/…).', required: true },
  { field: 'family', description: 'Assessment family (behavioural-signal | CAF competency).', required: true },
  { field: 'purpose', description: 'Why the assessment exists.', required: true },
  { field: 'personas', description: 'Target persona codes (P1–P9 / aggregate).', required: true },
  { field: 'lifecycle_state', description: 'Current state in the 10-state lifecycle.', required: true },
  { field: 'lifecycle_stage', description: 'Subject journey stage (CAP_CUR→CAP_MAS).', required: false },
  { field: 'version', description: 'Version / methodology version.', required: true },
  { field: 'scoring_method', description: 'How it is scored (or non-scored placement).', required: true },
  { field: 'norm_reference', description: 'Norm basis (age band / none).', required: false },
  { field: 'benchmark_reference', description: 'Relative benchmark cohort (k≥k_min).', required: false },
  { field: 'governance_owner', description: 'Governing role/owner (honest-NULL if unassigned).', required: false },
  { field: 'status', description: 'Coverage status (SUPPORTED/PARTIAL/…).', required: true },
  { field: 'evidence', description: 'Reused services/routes/tables/frontend.', required: true },
  { field: 'published_at', description: 'Publish timestamp (null until Published).', required: false },
];

/** Per-source coverage crosswalk — which metadata fields each real source populates today. */
export const METADATA_SOURCE_COVERAGE: { source: string; populates: string[]; note: string }[] = [
  { source: 'config/assessment-framework.ts', populates: ['key', 'label', 'type', 'purpose', 'personas', 'lifecycle_stage', 'scoring_method', 'benchmark_reference', 'status', 'evidence'], note: 'Frozen registry — richest metadata source; version/lifecycle_state derived at composition time.' },
  { source: 'assessment_templates', populates: ['id', 'label', 'category', 'version'], note: 'Template rows carry category + template version.' },
  { source: 'exams', populates: ['id', 'label', 'lifecycle_state', 'published_at'], note: 'status Draft/Published → lifecycle_state; published_at when Published.' },
  { source: 'caf_assessments', populates: ['id', 'label', 'lifecycle_state', 'published_at', 'scoring_method'], note: 'CAF authored assessments; status + published_at.' },
  { source: 'methodology_versions', populates: ['version'], note: 'Competency-graph runtime version source.' },
  { source: 'services/governance/admin-lifecycle.ts', populates: ['governance_owner', 'lifecycle_state'], note: 'Governance transitions; owner honest-NULL when unassigned.' },
];

// ─────────────────────────────────────────────────────────────────────────
// MAPPING MODEL — canonical spine → owning registry / reused engine (doc 17.A)
// ─────────────────────────────────────────────────────────────────────────
export const MAPPING_MODEL: { step: string; owningRegistry: string; reusedEngine: string }[] = [
  { step: 'Question', owningRegistry: 'config/assessment-framework.ts', reusedEngine: 'question-factory.ts · psychometric_question_bank' },
  { step: 'Assessment', owningRegistry: 'config/assessment-framework.ts', reusedEngine: 'routes/capadex.ts · caf_assessments · capadex_sessions' },
  { step: 'Delivery', owningRegistry: 'config/customer-journey.ts', reusedEngine: 'FreeAssessmentModal.tsx · caf-runtime.ts' },
  { step: 'Scoring', owningRegistry: 'config/assessment-framework.ts', reusedEngine: 'dimension-scoring-engine.ts · caf/scoring-engine.ts' },
  { step: 'Norms', owningRegistry: '(norm engine)', reusedEngine: 'lbi-norms-engine.ts · lbi_subdomain_norms' },
  { step: 'Standardization', owningRegistry: '(standardization)', reusedEngine: 'lbi-norms-engine.ts · reliability-engine.ts' },
  { step: 'Benchmarking', owningRegistry: 'config/assessment-framework.ts', reusedEngine: 'benchmark-engine.ts (k=30) · ti_*' },
  { step: 'AI Interpretation', owningRegistry: 'config/ai-orchestration-model.ts', reusedEngine: 'ai-reasoning-engine.ts · ai_reasoning_chains' },
  { step: 'Recommendations', owningRegistry: 'config/ai-orchestration-model.ts', reusedEngine: 'recommendation-intelligence-engine.ts · development_recommendations' },
  { step: 'Learning', owningRegistry: 'config/progression-model.ts', reusedEngine: 'learning-path-engine.ts · learning_recommendations' },
  { step: 'Progression', owningRegistry: 'config/progression-model.ts', reusedEngine: 'wc3_stage_state · wc3_longitudinal_snapshots' },
  { step: 'Reports', owningRegistry: 'config/ai-orchestration-model.ts', reusedEngine: 'report-factory-schema.ts · capadex_reports' },
  { step: 'Analytics', owningRegistry: 'config/outcome-kpi-model.ts', reusedEngine: 'enterprise-analytics-schema.ts · anl_*' },
  { step: 'Outcomes', owningRegistry: 'config/outcome-kpi-model.ts', reusedEngine: 'validation_loop_outcomes' },
  { step: 'KPIs', owningRegistry: 'config/outcome-kpi-model.ts', reusedEngine: 'anl_kpi_daily' },
];

// ─────────────────────────────────────────────────────────────────────────
// DECISIONS & GAPS (classified — from the frozen blueprint, docs 18/20)
// ─────────────────────────────────────────────────────────────────────────
/** Freeze invariants (doc 03 §"Architecture Invariants" + doc 20). */
export const ARCHITECTURE_DECISIONS: { decision: string; rationale: string }[] = [
  { decision: '13-layer decomposition is canonical + frozen', rationale: 'The architecture is not re-designed; enhancements are additive over these 13 layers.' },
  { decision: 'ONE registry + ONE traceability model for BOTH families', rationale: 'CAPADEX behavioural + CAF competency are overlapping-by-design (different measurement science), unified, never merged.' },
  { decision: 'Norms ⟂ Weighting ⟂ Benchmarks kept distinct', rationale: 'A norm exists only when a real k-sufficient distribution is computed; weighting/benchmark are never reported as norms.' },
  { decision: 'Coverage ⟂ Confidence ⟂ Adoption never composited', rationale: 'Structural coverage, output trustworthiness and usage volume are separate axes; adoption is never a gap.' },
  { decision: 'Additive, flag-gated, byte-identical-OFF (incl. schema)', rationale: 'This certification is READ-ONLY; the flag gates only the certification routes, zero DDL.' },
];

/** Known overlaps carried from the frozen registry + blueprint — DECISIONS, not silent merges. */
export const ARCHITECTURE_OVERLAPS = [
  ...KNOWN_OVERLAPS.map((o) => ({ pair: o.pair, decision: o.decision, rationale: o.rationale })),
  { pair: 'benchmark-engine ⟂ m5-org-benchmark ⟂ mei-benchmark-engine ⟂ peer-benchmark', decision: 'KEEP_SEPARATE' as const, rationale: 'Cohort vs org vs employability vs peer benchmarks — different subjects; kept distinct (doc 18 OVL-2).' },
];

export type GapSeverity = 'Launch-Critical' | 'High' | 'Medium' | 'Low' | 'Future';

/**
 * REMAINING ARCHITECTURE GAPS (classified — doc 18). These are ADDITIVE enhancement gaps over the
 * FROZEN architecture — 0 Launch-Critical, 0 High. They are honest OPEN gaps: the prior
 * out-of-scope remediation code was removed, so these are certified as remaining (additive) work,
 * NOT as closed. None blocks the architecture certification.
 */
export const ARCHITECTURE_GAPS: { id: string; layer: string; title: string; severity: GapSeverity; evidence: string; remediation: string }[] = [
  { id: 'GAP-AA-1', layer: 'L2 Question', title: 'Bloom/cognitive-level coding not applied to the behavioural clarity bank', severity: 'Low', evidence: 'Clarity bank has no Bloom-level column; cognitive coding exists only for the CAF item bank.', remediation: 'Additive: derive Bloom levels from the clarity bank into an own table; flag-gated, byte-identical OFF.' },
  { id: 'GAP-AA-2', layer: 'L4 Delivery', title: 'No end-user offline delivery mode', severity: 'Future', evidence: 'Delivery is online-only; no PWA/offline queue.', remediation: 'Additive opt-in PWA foundation; browser online/offline verification is an ADOPTION axis, not claimed structurally.' },
  { id: 'GAP-AA-3', layer: 'L4 Delivery', title: 'No dedicated accessibility (WCAG) layer', severity: 'Medium', evidence: 'i18next is mature (separate axis) but there is no consolidated a11y layer (skip-link/ARIA-live/focus-trap).', remediation: 'Additive a11y layer initialised only when flag ON; screen-reader/axe audit is an ADOPTION axis.' },
  { id: 'GAP-AA-4', layer: 'L6 Norms', title: 'Gender population norms absent', severity: 'Medium', evidence: 'Only age norms populated; no gender norm distribution.', remediation: 'Ethics-gated: compute REAL norms only under an explicit owner/legal enable; default abstains; never fabricated.' },
  { id: 'GAP-AA-5', layer: 'L6 Norms', title: 'Education-tier population norms absent', severity: 'Medium', evidence: 'No education-tier norm distribution; dimension source not yet populated.', remediation: 'Compute via the same engine when the dimension column exists + k≥30; honest abstain until then.' },
  { id: 'GAP-AA-6', layer: 'L6 Norms', title: 'Competitive-exam population norms absent', severity: 'Medium', evidence: 'No competitive-exam norm distribution.', remediation: 'Same k_min=30 path; honest abstain until the persona/exam dimension is populated.' },
  { id: 'GAP-AA-7', layer: 'L7 Standardization', title: 'Canonical T(SD=10)/stanine/sten breadth absent; SD=15 must not be labelled "T"', severity: 'Low', evidence: 'Percentile/z/deviation exist; canonical T/stanine/sten transforms do not.', remediation: 'Additive pure transforms (T M=50/SD=10, stanine 1–9, sten 1–10); relabel deviation SD=15.' },
  { id: 'GAP-AA-8', layer: 'L8 Benchmark', title: 'Country-level benchmarks absent', severity: 'Low', evidence: 'Cohort/industry/role/layer benchmarks exist; no country cohort.', remediation: 'Additive country cohort registration; norms compute via the same k_min path.' },
  { id: 'GAP-AA-9', layer: 'L13 Admin', title: 'AI Prompt Management absent (prompts code-embedded)', severity: 'Medium', evidence: 'Prompts embedded in code; aig_prompts/aig_prompt_versions substrate exists but is not the prompt source.', remediation: 'Additive: govern prompts through aig_prompts/aig_prompt_versions with literal fallback; flag-gated.' },
];

/** Overlaps that are recommend-only consolidation candidates (never silently merged). */
export const OVERLAP_DECISIONS = ARCHITECTURE_OVERLAPS;
