/**
 * CAPADEX 3.0 — Program 3 · Phase 3.3 Enterprise Assessment Builder (Authoring Platform)
 * ───────────────────────────────────────────────────────────────────────────
 * The ONE canonical Assessment Builder registry — a pure-data, FROZEN model that COMPOSES the
 * EXISTING assessment-authoring services (CAF builder, blueprint engines, assembly, writer,
 * architecture) under a single certified layer + an additive `ab_*` overlay. NO duplicate builder,
 * NO V2, NO breaking change. Scope is AUTHORING ONLY — design/compose/configure/validate/version/
 * approve/publish an assessment. It does NOT deliver, score, or run psychometrics (that is runtime).
 *
 * This file is DATA ONLY (no DB, no FS, no side effects). The engine
 * (`services/assessment-builder-engine.ts`) is the SSoT for "present/absent" — it INDEPENDENTLY
 * verifies every evidence claim here against the live filesystem + DB. The registry only declares
 * the canonical model + the evidence it EXPECTS.
 *
 * SEVEN INDEPENDENT certification dimensions, each reported SEPARATELY and NEVER composited:
 *   builder · blueprint · validation · version_management · publishing · apis · frontend.
 *
 * Honesty: null (unknown) ≠ 0 (absent). Coverage (does an implementation exist?) ⟂ Confidence ⟂
 * Adoption (real authored-assessment volume) — never composited. Never fabricate.
 */

export type AbStatus = 'SUPPORTED' | 'PARTIAL' | 'DEAD_END' | 'MISSING';
export type GapSeverity = 'Launch-Critical' | 'High' | 'Medium' | 'Low' | 'Future';
export type AbAxis =
  | 'builder' | 'blueprint' | 'validation' | 'version_management'
  | 'publishing' | 'apis' | 'frontend';

export interface AbEvidence {
  services: string[];
  routes: string[];
  frontend: string[];
  tables: string[];
}

export interface AbDimension {
  key: AbAxis;
  label: string;
  status: AbStatus;
  statusNote: string;
  evidence: AbEvidence;
}

// ─────────────────────────────────────────────────────────────────────────────
// AXES — the seven certification dimensions (declarative descriptors)
// ─────────────────────────────────────────────────────────────────────────────
export const AB_AXES: { key: AbAxis; label: string; question: string }[] = [
  { key: 'builder', label: 'Assessment Builder / Designer', question: 'Can an assessment be designed, composed & configured?' },
  { key: 'blueprint', label: 'Blueprint Framework', question: 'Can a blueprint (distribution + mix + time/marks) be defined & bound?' },
  { key: 'validation', label: 'Validation Framework', question: 'Is an assessment validated (structure/blueprint/rules/config/readiness) before publish?' },
  { key: 'version_management', label: 'Version Management', question: 'Are major/minor/draft versions tracked, comparable, rollback-able & clonable?' },
  { key: 'publishing', label: 'Publishing / Approval Workflow', question: 'Does draft→review→approved→published→active→deprecated→archived exist with human approval?' },
  { key: 'apis', label: 'Assessment Authoring APIs', question: 'Do CRUD/builder/blueprint/version/validation/publishing APIs exist?' },
  { key: 'frontend', label: 'Builder Frontend', question: 'Is there a builder UI (compose/blueprint/rules/validation/preview/version/approval)?' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FROZEN sub-inventories (pure catalogs — status-only)
// ─────────────────────────────────────────────────────────────────────────────
export interface CatalogItem { key: string; label: string; status: AbStatus; note: string }

// Designer actions (7)
export const DESIGNER_ACTIONS: CatalogItem[] = [
  { key: 'create', label: 'Create assessment', status: 'SUPPORTED', note: 'ab_assessments authoring record (composes caf_assessments/assessment_blueprints by reference).' },
  { key: 'edit', label: 'Edit assessment', status: 'SUPPORTED', note: 'Structure/config JSONB edited in place; every save snapshots a version.' },
  { key: 'clone', label: 'Clone assessment', status: 'SUPPORTED', note: 'Deep copy → new authoring record via cloneAssessment (reuse version snapshot).' },
  { key: 'version', label: 'Version assessment', status: 'SUPPORTED', note: 'Append-only ab_assessment_versions (major/minor/draft).' },
  { key: 'archive', label: 'Archive assessment', status: 'SUPPORTED', note: 'Workflow transition to archived (reversible, never destructive).' },
  { key: 'restore', label: 'Restore assessment', status: 'SUPPORTED', note: 'Workflow transition back to draft/active from archived.' },
  { key: 'publish', label: 'Publish assessment', status: 'SUPPORTED', note: 'Workflow transition to published/active after human approval + validation-clean.' },
];

// Structure levels (10) — the compositional hierarchy an assessment can express
export const STRUCTURE_LEVELS: CatalogItem[] = [
  { key: 'section', label: 'Section', status: 'SUPPORTED', note: 'caf_assessment_sections / structure JSONB sections[].' },
  { key: 'page', label: 'Page', status: 'SUPPORTED', note: 'Structure JSONB page grouping within a section.' },
  { key: 'group', label: 'Group', status: 'SUPPORTED', note: 'Question grouping (pool / ordered block).' },
  { key: 'category', label: 'Category', status: 'SUPPORTED', note: 'Category tag on a section/group.' },
  { key: 'domain', label: 'Domain', status: 'SUPPORTED', note: 'caf_domains / competency domain binding.' },
  { key: 'subdomain', label: 'Subdomain', status: 'SUPPORTED', note: 'Subdomain binding under a domain.' },
  { key: 'competency', label: 'Competency', status: 'SUPPORTED', note: 'assessment_blueprint_competencies / onto_blueprint_competency_map.' },
  { key: 'behaviour', label: 'Behaviour', status: 'SUPPORTED', note: 'Behaviour anchor on a section/competency.' },
  { key: 'skill', label: 'Skill', status: 'SUPPORTED', note: 'Skill mapping in the blueprint.' },
  { key: 'learning_objective', label: 'Learning objective', status: 'SUPPORTED', note: 'Learning-objective tag on a section/competency.' },
];

// Composition capabilities (8)
export const COMPOSITION_CAPS: CatalogItem[] = [
  { key: 'add_question', label: 'Add question', status: 'SUPPORTED', note: 'Bind a question ref into a section (caf_section_questions / structure JSONB).' },
  { key: 'remove_question', label: 'Remove question', status: 'SUPPORTED', note: 'Unbind a question ref (reversible).' },
  { key: 'reorder', label: 'Reorder', status: 'SUPPORTED', note: 'Order index on section questions.' },
  { key: 'question_pool', label: 'Question pool', status: 'SUPPORTED', note: 'Fixed pool of candidate questions per section.' },
  { key: 'random_pool', label: 'Random pool', status: 'SUPPORTED', note: 'caf_randomization_rules / draw-N-of-M pool.' },
  { key: 'mandatory_question', label: 'Mandatory question', status: 'SUPPORTED', note: 'Required flag on a bound question.' },
  { key: 'optional_question', label: 'Optional question', status: 'SUPPORTED', note: 'Optional flag on a bound question.' },
  { key: 'section_rule', label: 'Section rule', status: 'SUPPORTED', note: 'Per-section min/max/select rules in structure JSONB.' },
];

// Reusable templates (12)
export const REUSABLE_TEMPLATES: CatalogItem[] = [
  { key: 'school', label: 'School', status: 'SUPPORTED', note: 'assessment_templates + ab_templates registry.' },
  { key: 'jee', label: 'JEE', status: 'SUPPORTED', note: 'Competitive-exam template.' },
  { key: 'neet', label: 'NEET', status: 'SUPPORTED', note: 'Competitive-exam template.' },
  { key: 'cuet', label: 'CUET', status: 'SUPPORTED', note: 'Competitive-exam template.' },
  { key: 'competitive_exam', label: 'Competitive exam (generic)', status: 'SUPPORTED', note: 'Generic competitive template.' },
  { key: 'freshers', label: 'Freshers', status: 'SUPPORTED', note: 'Early-career template.' },
  { key: 'jobseekers', label: 'Jobseekers', status: 'SUPPORTED', note: 'Jobseeker template.' },
  { key: 'professionals', label: 'Professionals', status: 'SUPPORTED', note: 'Working-professional template.' },
  { key: 'leadership', label: 'Leadership', status: 'SUPPORTED', note: 'Senior-leadership template.' },
  { key: 'enterprise', label: 'Enterprise', status: 'SUPPORTED', note: 'Enterprise template.' },
  { key: 'organization', label: 'Organization', status: 'SUPPORTED', note: 'Org-wide template.' },
  { key: 'custom', label: 'Custom', status: 'SUPPORTED', note: 'Author-defined custom template.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FROZEN control groups (evidence-verified — each has evidence[] the engine checks)
// ─────────────────────────────────────────────────────────────────────────────
export interface AbControl { key: string; label: string; status: AbStatus; evidence: string[] }

// Blueprint capabilities (8)
export const BLUEPRINT_CAPS: AbControl[] = [
  { key: 'blueprint_template', label: 'Blueprint template', status: 'SUPPORTED', evidence: ['services/blueprint-builder.ts', 'ab_blueprints', 'assessment_blueprints'] },
  { key: 'competency_distribution', label: 'Competency distribution', status: 'SUPPORTED', evidence: ['services/assessment-blueprint-engine.ts', 'assessment_blueprint_competencies', 'onto_blueprint_competency_map'] },
  { key: 'behaviour_distribution', label: 'Behaviour distribution', status: 'SUPPORTED', evidence: ['services/assessment-blueprint-engine.ts', 'ab_blueprints'] },
  { key: 'domain_distribution', label: 'Domain distribution', status: 'SUPPORTED', evidence: ['services/blueprint-builder.ts', 'blueprint_sections', 'ab_blueprints'] },
  { key: 'question_type_mix', label: 'Question-type mix', status: 'SUPPORTED', evidence: ['services/question-blueprint.ts', 'ab_blueprints'] },
  { key: 'difficulty_mix', label: 'Difficulty mix', status: 'SUPPORTED', evidence: ['services/adaptive-blueprint-generation-engine.ts', 'ab_blueprints'] },
  { key: 'time_allocation', label: 'Time allocation', status: 'SUPPORTED', evidence: ['services/blueprint-builder.ts', 'ab_blueprints'] },
  { key: 'marks_distribution', label: 'Marks distribution', status: 'SUPPORTED', evidence: ['services/blueprint-builder.ts', 'ab_blueprints'] },
];

// Rule types (10)
export const RULE_TYPES: AbControl[] = [
  { key: 'passing_criteria', label: 'Passing criteria', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessments'] },
  { key: 'completion_criteria', label: 'Completion criteria', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessments'] },
  { key: 'eligibility', label: 'Eligibility rules', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessments'] },
  { key: 'navigation', label: 'Navigation rules', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessments'] },
  { key: 'branching', label: 'Branching rules', status: 'SUPPORTED', evidence: ['services/assessment-architecture-engine.ts', 'assessment_branching_rules', 'ab_assessments'] },
  { key: 'adaptive_placeholder', label: 'Adaptive rule (placeholder)', status: 'PARTIAL', evidence: ['services/adaptive-assessment-engine.ts', 'ab_assessments'] },
  { key: 'mandatory_sections', label: 'Mandatory sections', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessments'] },
  { key: 'optional_sections', label: 'Optional sections', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessments'] },
  { key: 'time_rules', label: 'Time rules', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessments'] },
  { key: 'attempt_rules', label: 'Attempt rules', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessments'] },
];

// Configuration options (8)
export const CONFIG_OPTIONS: AbControl[] = [
  { key: 'languages', label: 'Languages', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessments'] },
  { key: 'instructions', label: 'Instructions', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessments'] },
  { key: 'welcome_screen', label: 'Welcome screen', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessments'] },
  { key: 'completion_screen', label: 'Completion screen', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessments'] },
  { key: 'branding', label: 'Branding', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessments'] },
  { key: 'logos', label: 'Logos', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessments'] },
  { key: 'themes', label: 'Themes', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessments'] },
  { key: 'accessibility', label: 'Accessibility', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessments'] },
];

// Version capabilities (7)
export const VERSION_CAPABILITIES: AbControl[] = [
  { key: 'major_version', label: 'Major version', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessment_versions'] },
  { key: 'minor_version', label: 'Minor version', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessment_versions'] },
  { key: 'draft_version', label: 'Draft version', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessment_versions'] },
  { key: 'compare', label: 'Compare versions', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessment_versions'] },
  { key: 'rollback', label: 'Rollback version', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessment_versions'] },
  { key: 'clone', label: 'Clone version', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessment_versions'] },
  { key: 'audit_history', label: 'Audit history', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_assessment_versions'] },
];

// Validation checks (7)
export const VALIDATION_CHECKS: AbControl[] = [
  { key: 'missing_questions', label: 'Missing questions', status: 'SUPPORTED', evidence: ['services/assessment-builder-engine.ts', 'ab_validation_runs'] },
  { key: 'empty_sections', label: 'Empty sections', status: 'SUPPORTED', evidence: ['services/assessment-builder-engine.ts', 'ab_validation_runs'] },
  { key: 'duplicate_questions', label: 'Duplicate questions', status: 'SUPPORTED', evidence: ['services/assessment-builder-engine.ts', 'ab_validation_runs'] },
  { key: 'blueprint_validation', label: 'Blueprint validation', status: 'SUPPORTED', evidence: ['services/assessment-builder-engine.ts', 'ab_validation_runs'] },
  { key: 'rule_validation', label: 'Rule validation', status: 'SUPPORTED', evidence: ['services/assessment-builder-engine.ts', 'ab_validation_runs'] },
  { key: 'config_validation', label: 'Config validation', status: 'SUPPORTED', evidence: ['services/assessment-builder-engine.ts', 'ab_validation_runs'] },
  { key: 'publishing_readiness', label: 'Publishing readiness', status: 'SUPPORTED', evidence: ['services/assessment-builder-engine.ts', 'ab_validation_runs'] },
];

// Workflow states (7)
export const WORKFLOW_STATES: AbControl[] = [
  { key: 'draft', label: 'Draft', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_workflow'] },
  { key: 'review', label: 'In review', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_workflow'] },
  { key: 'approved', label: 'Approved', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_workflow'] },
  { key: 'published', label: 'Published', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_workflow'] },
  { key: 'active', label: 'Active', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_workflow'] },
  { key: 'deprecated', label: 'Deprecated', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_workflow'] },
  { key: 'archived', label: 'Archived', status: 'SUPPORTED', evidence: ['services/assessment-builder-mechanisms.ts', 'ab_workflow'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAPPING MODEL (10) — every assessment maps to the platform's canonical dimensions
// ─────────────────────────────────────────────────────────────────────────────
export interface MappingRow { key: string; label: string; target: string; source: string; status: AbStatus; note: string }
export const MAPPING_MODEL: MappingRow[] = [
  { key: 'product_blueprint', label: 'Product blueprint', target: 'CAPADEX product blueprint', source: 'config/assessment-framework.ts', status: 'SUPPORTED', note: 'Assessment is a first-class product-blueprint artifact.' },
  { key: 'personas', label: 'Personas', target: 'Persona model', source: 'config/customer-journey.ts', status: 'SUPPORTED', note: 'Assessment bound to persona(s) via template + config.' },
  { key: 'lifecycle', label: 'Lifecycle', target: 'Lifecycle stages', source: 'lib/lifecycle.ts', status: 'SUPPORTED', note: 'Assessment mapped to a lifecycle stage (entry/baseline/diagnostic/…).' },
  { key: 'customer_journey', label: 'Customer journey', target: 'Journey spine', source: 'config/customer-journey.ts', status: 'SUPPORTED', note: 'Assessment is the entry/re-measure step of the journey spine.' },
  { key: 'question_library', label: 'Question library', target: 'Question Management Platform (3.2)', source: 'config/question-management-platform.ts', status: 'SUPPORTED', note: 'Assessment composes questions from the canonical library.' },
  { key: 'competencies', label: 'Competencies', target: 'Competency ontology', source: 'assessment_blueprint_competencies', status: 'SUPPORTED', note: 'Blueprint distributes across competencies.' },
  { key: 'behaviours', label: 'Behaviours', target: 'Behaviour model', source: 'ab_blueprints', status: 'SUPPORTED', note: 'Blueprint distributes across behaviours.' },
  { key: 'skills', label: 'Skills', target: 'Skill model', source: 'ab_blueprints', status: 'SUPPORTED', note: 'Blueprint maps to skills.' },
  { key: 'outcomes', label: 'Outcomes', target: 'Outcome/KPI framework (1.6)', source: 'config/outcome-kpi-model.ts', status: 'SUPPORTED', note: 'Assessment feeds the outcome framework at runtime (author-side declared).' },
  { key: 'kpis', label: 'KPIs', target: 'KPI families (1.6)', source: 'config/outcome-kpi-model.ts', status: 'SUPPORTED', note: 'Assessment declared against KPI families (author-side).' },
];

// ─────────────────────────────────────────────────────────────────────────────
// SEVEN certification DIMENSIONS — evidence anchored in REAL substrate + own overlay
// ─────────────────────────────────────────────────────────────────────────────
export const AB_DIMENSIONS: AbDimension[] = [
  {
    key: 'builder', label: 'Assessment Builder / Designer', status: 'SUPPORTED',
    statusNote: 'ONE canonical authoring record (ab_assessments) composing the existing CAF builder + assembly + writer — design/edit/clone/version/archive/restore/publish, no duplicate builder.',
    evidence: {
      services: ['services/assessment-architecture-engine.ts', 'services/assessment-assembly.ts', 'services/assessment-writer.ts', 'services/blueprint-builder.ts', 'services/assessment-builder-engine.ts', 'services/assessment-builder-mechanisms.ts'],
      routes: ['routes/caf-assessment-builder.ts', 'routes/assessment-writer.ts', 'routes/assessment-builder.ts'],
      frontend: ['components/superadmin/caf/CAFAssessmentBuilderPanel.tsx', 'components/superadmin/AssessmentBuilderPanel.tsx'],
      tables: ['caf_assessments', 'caf_assessment_sections', 'caf_section_questions', 'ab_assessments'],
    },
  },
  {
    key: 'blueprint', label: 'Blueprint Framework', status: 'SUPPORTED',
    statusNote: 'Competency/behaviour/domain distribution + question/difficulty mix + time/marks, composing the existing blueprint engines into the ab_blueprints overlay.',
    evidence: {
      services: ['services/assessment-blueprint-engine.ts', 'services/blueprint-builder.ts', 'services/adaptive-blueprint-generation-engine.ts', 'services/question-blueprint.ts'],
      routes: ['routes/assessment-architecture.ts'],
      frontend: ['components/superadmin/CompetencyBlueprintPanel.tsx', 'components/superadmin/BlueprintMappingPanel.tsx', 'components/PreviewBlueprint.tsx'],
      tables: ['assessment_blueprints', 'assessment_blueprints_v2', 'assessment_blueprint_competencies', 'blueprint_sections', 'onto_assessment_blueprints', 'ab_blueprints'],
    },
  },
  {
    key: 'validation', label: 'Validation Framework', status: 'SUPPORTED',
    statusNote: 'Seven read-time checks (missing questions/empty sections/duplicates/blueprint/rule/config/publishing-readiness) recorded to ab_validation_runs; assessment is validation-clean before publish.',
    evidence: {
      services: ['services/assessment-builder-engine.ts', 'services/assessment-architecture-engine.ts'],
      routes: ['routes/assessment-builder.ts'],
      frontend: ['components/superadmin/AssessmentBuilderPanel.tsx'],
      tables: ['ab_validation_runs'],
    },
  },
  {
    key: 'version_management', label: 'Version Management', status: 'SUPPORTED',
    statusNote: 'Append-only ab_assessment_versions — major/minor/draft, compare, rollback, clone, audit history (lossless snapshots).',
    evidence: {
      services: ['services/assessment-builder-mechanisms.ts'],
      routes: ['routes/assessment-builder.ts'],
      frontend: ['components/superadmin/AssessmentBuilderPanel.tsx'],
      tables: ['ab_assessment_versions'],
    },
  },
  {
    key: 'publishing', label: 'Publishing / Approval Workflow', status: 'SUPPORTED',
    statusNote: 'draft→review→approved→published→active→deprecated→archived audit ledger (ab_workflow) with mandatory human approval; publish blocked until validation-clean.',
    evidence: {
      services: ['services/assessment-builder-mechanisms.ts'],
      routes: ['routes/assessment-builder.ts'],
      frontend: ['components/superadmin/AssessmentBuilderPanel.tsx'],
      tables: ['ab_workflow'],
    },
  },
  {
    key: 'apis', label: 'Assessment Authoring APIs', status: 'SUPPORTED',
    statusNote: 'CRUD + builder + blueprint + version + validation + publishing endpoints under /api/admin/assessment-builder, composing existing authoring routes.',
    evidence: {
      services: ['services/assessment-builder-engine.ts'],
      routes: ['routes/assessment-builder.ts', 'routes/caf-assessment-builder.ts', 'routes/assessment-architecture.ts', 'routes/assessment-writer.ts'],
      frontend: [],
      tables: [],
    },
  },
  {
    key: 'frontend', label: 'Builder Frontend', status: 'SUPPORTED',
    statusNote: 'Super-admin certification console + reused CAF builder / blueprint / mapping / preview UI (compose/blueprint/rules/validation/preview/version/approval surfaces).',
    evidence: {
      services: [],
      routes: [],
      frontend: ['components/superadmin/AssessmentBuilderPanel.tsx', 'components/superadmin/caf/CAFAssessmentBuilderPanel.tsx', 'components/superadmin/CompetencyBlueprintPanel.tsx', 'components/superadmin/BlueprintMappingPanel.tsx', 'components/PreviewBlueprint.tsx'],
      tables: [],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DECISIONS — the reuse-before-build design record
// ─────────────────────────────────────────────────────────────────────────────
export interface AbDecision { id: string; title: string; decision: string }
export const AB_DECISIONS: AbDecision[] = [
  { id: 'AB-D1', title: 'One canonical builder, no fork', decision: 'ab_assessments OVERLAYS the existing CAF builder / assembly / writer by reference — it never forks caf_assessments or spawns a second builder. Authoring capabilities the legacy builder lacks (unified versioning, blueprint framework binding, validation runs, approval workflow, template library) are ADDED as additive ab_* overlay, not a V2.' },
  { id: 'AB-D2', title: 'Authoring only — not delivery/scoring', decision: 'Phase 3.3 designs/composes/configures/validates/versions/approves/publishes assessments. It does NOT deliver, score, or run psychometrics — that is the runtime (assessment-runtime-orchestrator, caf-runtime, competency-assessment-runtime) and is out of scope.' },
  { id: 'AB-D3', title: 'Flag-gated, byte-identical OFF incl. schema', decision: 'All DDL is confined to ensureAbSchema, which asserts the assessmentBuilder flag first → flag OFF creates 0 tables. Every route 503s before auth when OFF. OFF is byte-identical to legacy.' },
  { id: 'AB-D4', title: 'Seven dimensions never composited', decision: 'builder · blueprint · validation · version_management · publishing · apis · frontend are certified INDEPENDENTLY and reported SEPARATELY. Coverage ⟂ Confidence ⟂ Adoption. A dimension can be SUPPORTED while adoption is honestly 0.' },
  { id: 'AB-D5', title: 'Adoption is a usage axis, never a gap', decision: 'Real authored-assessment VOLUME across the ab_* overlay is reported SEPARATELY. Zero authored assessments is honest engineering-closure with 0 adoption — NEVER a gap, NEVER fabricated. null (unreadable) ≠ 0 (empty).' },
  { id: 'AB-D6', title: 'Validation is read-time, non-blocking to storage', decision: 'Validation checks compute against the authoring record on demand and are recorded to ab_validation_runs. They gate PUBLISH (human decision) but never mutate the assessment or throw destructively.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// GAPS — 0 OPEN (engineering-closed via reuse) + RESOLVED ledger
// ─────────────────────────────────────────────────────────────────────────────
export interface AbGap { id: string; severity: GapSeverity; dimension: AbAxis; summary: string; mechanism?: string }
export const AB_GAPS: AbGap[] = [];

export const RESOLVED_AB_GAPS: AbGap[] = [
  { id: 'AB-1', severity: 'High', dimension: 'builder', summary: 'No single canonical authoring record unifying the CAF builder / assembly / writer.', mechanism: 'ab_assessments overlay + assessment-builder-mechanisms (create/edit/clone) composing existing builders.' },
  { id: 'AB-2', severity: 'High', dimension: 'blueprint', summary: 'Blueprint distribution/mix/time/marks not bound to a first-class authoring blueprint.', mechanism: 'ab_blueprints overlay + upsertBlueprint composing assessment-blueprint-engine / blueprint-builder.' },
  { id: 'AB-3', severity: 'Medium', dimension: 'validation', summary: 'No unified pre-publish validation (missing/empty/duplicate/blueprint/rule/config/readiness).', mechanism: 'assessment-builder-engine validation composer + ab_validation_runs ledger.' },
  { id: 'AB-4', severity: 'High', dimension: 'version_management', summary: 'No major/minor/draft version history with compare/rollback/clone.', mechanism: 'ab_assessment_versions append-only overlay + snapshot/compare/rollback/clone helpers.' },
  { id: 'AB-5', severity: 'High', dimension: 'publishing', summary: 'No review→approve→publish→archive workflow with human approval.', mechanism: 'ab_workflow audit ledger + workflowTransition (7-state model, publish blocked until validation-clean).' },
  { id: 'AB-6', severity: 'Medium', dimension: 'apis', summary: 'No unified authoring API surface (CRUD/builder/blueprint/version/validation/publishing).', mechanism: 'routes/assessment-builder.ts composing existing authoring routes under one base.' },
  { id: 'AB-7', severity: 'Low', dimension: 'frontend', summary: 'No single builder console surfacing compose/blueprint/rules/validation/preview/version/approval.', mechanism: 'AssessmentBuilderPanel certification console reusing CAF builder / blueprint / mapping / preview UI.' },
];
