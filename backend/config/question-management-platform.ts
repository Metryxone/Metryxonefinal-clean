/**
 * CAPADEX 3.0 — Program 3 · Phase 3.2 Enterprise Question Management Platform
 * ───────────────────────────────────────────────────────────────────────────
 * The ONE canonical, FROZEN registry describing the Enterprise Question Management Platform.
 * It is PURE DATA — no DB, no engine, no side effects. The read-only composer
 * (`services/question-management-engine.ts`) verifies every evidence claim here against the live
 * filesystem + DB and is the SSoT for "present/absent" numbers. The registry is the SSoT for the
 * canonical MODEL (dimensions · types · metadata standard · lifecycle · governance · versioning ·
 * workflow · search · bulk-ops · library scopes · mapping · decisions · gaps).
 *
 * Contract (mirrors Phases 1.3–1.7 + 3.1 EXACTLY): Repository First · Search before modify ·
 * Reuse before build · NO duplicate question platforms · NO V2 · NO breaking changes. Additive +
 * flag-gated (`questionManagementPlatform` / FF_QUESTION_MANAGEMENT_PLATFORM, default OFF), so OFF
 * is byte-identical incl. schema (all DDL runs ONLY on the flag-gated write paths).
 *
 * EIGHT INDEPENDENT certification dimensions, each certified SEPARATELY and NEVER composited:
 *   platform · library · metadata · governance · version_management · workflow · apis · frontend.
 *
 * Honesty: engineering closure (a capability/mechanism EXISTS + is wired) ⟂ adoption (real authored
 * question VOLUME). Adoption is a usage axis reported SEPARATELY, NEVER a gap; never fabricated.
 * Coverage ⟂ Confidence ⟂ Adoption; null ≠ 0.
 */

export type QmpStatus = 'SUPPORTED' | 'PARTIAL' | 'DEAD_END' | 'MISSING';
export type GapSeverity = 'Launch-Critical' | 'High' | 'Medium' | 'Low' | 'Future';

/** Evidence claim — verified INDEPENDENTLY by the composer against the live FS+DB. */
export interface QmpEvidence {
  services: string[];   // backend/… paths (verified via FS)
  routes: string[];     // backend/… paths (verified via FS)
  frontend: string[];   // frontend/src/… paths (verified via FS)
  tables: string[];     // pg relations (verified via to_regclass; null on read error ≠ absent)
}

// ─────────────────────────────────────────────────────────────────────────────
// AXES — the eight independent certification dimensions
// ─────────────────────────────────────────────────────────────────────────────
export const QMP_AXES = [
  'platform',
  'library',
  'metadata',
  'governance',
  'version_management',
  'workflow',
  'apis',
  'frontend',
] as const;
export type QmpAxis = (typeof QMP_AXES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSIONS — 8 certification dimensions (all SUPPORTED after reuse-before-build closure)
// ─────────────────────────────────────────────────────────────────────────────
export interface QmpDimension {
  key: QmpAxis;
  label: string;
  status: QmpStatus;
  statusNote: string;
  evidence: QmpEvidence;
}

export const QMP_DIMENSIONS: QmpDimension[] = [
  {
    key: 'platform',
    label: 'Question Platform (single unified layer)',
    status: 'SUPPORTED',
    statusNote:
      'ONE canonical platform layer COMPOSES the 13 existing question services under one registry ' +
      '(capadex_question_registry) + the additive qmp_* overlay. No duplicate platform; no V2.',
    evidence: {
      services: [
        'services/question-management-engine.ts',
        'services/question-management-mechanisms.ts',
        'services/question-registry-service.ts',
        'services/question-utility-index.ts',
      ],
      routes: ['routes/question-management.ts'],
      frontend: ['components/superadmin/QuestionManagementPanel.tsx'],
      tables: ['capadex_question_registry', 'qmp_question_metadata'],
    },
  },
  {
    key: 'library',
    label: 'Question Library (unified over all banks)',
    status: 'SUPPORTED',
    statusNote:
      'ONE library abstraction over the existing physical banks (clarity · psychometric · competency · ' +
      'interview · CAF · LBI · exam) + qmp_collections for folders/collections. Banks are NOT merged ' +
      '(no breaking change) — they are unified by reference (LIBRARY_SCOPES) with collection grouping.',
    evidence: {
      services: [
        'services/question-blueprint.ts',
        'services/question-factory.ts',
        'services/interview-question-store.ts',
        'services/question-management-mechanisms.ts',
      ],
      routes: [
        'routes/capadex-questions.ts',
        'routes/competency-questions.ts',
        'routes/interview-questions.ts',
        'routes/caf-question-framework.ts',
      ],
      frontend: [
        'components/superadmin/QuestionBankPanel.tsx',
        'components/superadmin/CompetencyQuestionsPanel.tsx',
        'pages/InterviewQuestionBankPage.tsx',
        'components/superadmin/caf/CAFQuestionBankPanel.tsx',
      ],
      tables: ['psychometric_question_bank', 'lbi_question_bank', 'exam_questions', 'qmp_collections'],
    },
  },
  {
    key: 'metadata',
    label: 'Metadata Standard (canonical, unified)',
    status: 'SUPPORTED',
    statusNote:
      'ONE canonical metadata standard (METADATA_STANDARD) persisted in the additive qmp_question_metadata ' +
      'overlay — a superset spanning identity/authoring/pedagogy/psychometrics/governance/lifecycle. Existing ' +
      'per-bank columns remain the source of already-captured facts; the overlay UNIFIES them without migration.',
    evidence: {
      services: ['services/question-metadata-ranking.ts', 'services/question-management-mechanisms.ts'],
      routes: ['routes/question-management.ts'],
      frontend: ['components/superadmin/QuestionManagementPanel.tsx'],
      tables: ['qmp_question_metadata', 'capadex_question_registry'],
    },
  },
  {
    key: 'governance',
    label: 'Question Governance (ownership · review · audit · access)',
    status: 'SUPPORTED',
    statusNote:
      'Governance control-plane REUSES the existing registry governance (buildGovernanceData/transitionStatus) + ' +
      'hypothesis-question-governance + the additive qmp_workflow audit ledger. Ownership/reviewer/approver + ' +
      'status-change audit + access via super-admin gate. Change history in qmp_question_versions.',
    evidence: {
      services: [
        'services/question-registry-service.ts',
        'services/hypothesis-question-governance.ts',
        'services/question-certification.ts',
        'services/question-management-mechanisms.ts',
      ],
      routes: ['routes/capadex-question-registry.ts', 'routes/question-management.ts'],
      frontend: ['components/superadmin/QuestionRegistryPanel.tsx'],
      tables: ['capadex_question_registry', 'qmp_workflow'],
    },
  },
  {
    key: 'version_management',
    label: 'Version Management (history · compare · rollback · clone/fork/merge)',
    status: 'SUPPORTED',
    statusNote:
      'Version history + major/minor increment + compare + rollback + clone/fork/merge on the additive ' +
      'qmp_question_versions ledger. REUSES the existing registry integer version as the baseline pointer; ' +
      'each transition snapshots content so rollback/compare are lossless. Append-only (no destructive edit).',
    evidence: {
      services: ['services/question-management-mechanisms.ts', 'services/question-registry-service.ts'],
      routes: ['routes/question-management.ts'],
      frontend: ['components/superadmin/QuestionManagementPanel.tsx'],
      tables: ['qmp_question_versions', 'capadex_question_registry'],
    },
  },
  {
    key: 'workflow',
    label: 'Question Workflow (draft → review → approve → publish → retire)',
    status: 'SUPPORTED',
    statusNote:
      'The 9-state canonical lifecycle (LIFECYCLE_STATES) mapped onto the existing 6-state registry CHECK via ' +
      'LIFECYCLE_MAPPING, with review→approve→publish transitions recorded in qmp_workflow. REUSES the existing ' +
      'transitionStatus writer; the additive states (under_review/approved/published/suspended/retired) are ' +
      'tracked in the overlay so the legacy CHECK is NOT broken (no breaking change).',
    evidence: {
      services: ['services/question-management-mechanisms.ts', 'services/question-registry-service.ts'],
      routes: ['routes/question-management.ts'],
      frontend: ['components/superadmin/QuestionManagementPanel.tsx'],
      tables: ['qmp_workflow', 'capadex_question_registry'],
    },
  },
  {
    key: 'apis',
    label: 'Question APIs (unified read + governed write)',
    status: 'SUPPORTED',
    statusNote:
      'ONE unified API surface (routes/question-management.ts) COMPOSES the existing per-bank route files ' +
      '(clarity · registry · competency · interview · CAF · factory) into a single certified read layer + ' +
      'governed write paths (metadata/version/collection/search/bulk/workflow). Existing routes are unchanged.',
    evidence: {
      services: ['services/question-management-engine.ts'],
      routes: [
        'routes/question-management.ts',
        'routes/capadex-clarity-questions.ts',
        'routes/capadex-question-registry.ts',
        'routes/question-factory.ts',
      ],
      frontend: ['components/superadmin/QuestionManagementPanel.tsx'],
      tables: ['capadex_question_registry'],
    },
  },
  {
    key: 'frontend',
    label: 'Question Frontend (unified super-admin console)',
    status: 'SUPPORTED',
    statusNote:
      'ONE flag-gated super-admin console (QuestionManagementPanel) COMPOSES the existing question panels ' +
      '(registry · bank · factory · competency · CAF · clarity · interview) into a single certified experience. ' +
      'Existing panels are unchanged; the console links to them (no fork).',
    evidence: {
      services: ['services/question-management-engine.ts'],
      routes: ['routes/question-management.ts'],
      frontend: [
        'components/superadmin/QuestionManagementPanel.tsx',
        'components/superadmin/QuestionRegistryPanel.tsx',
        'components/superadmin/QuestionFactoryPanel.tsx',
        'components/superadmin/CapadexClarityQuestionsPanel.tsx',
        'components/superadmin/CompetencyQuestionMapPanel.tsx',
      ],
      tables: [],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION TYPES — canonical catalog (29). Status honestly reflects renderer support:
//   SUPPORTED = a real renderer/bank authors + scores this type today.
//   PARTIAL   = registered in the canonical catalog (platform accepts + validates the type via the
//               metadata standard) but no dedicated renderer/bank authors it yet — an ADOPTION gap,
//               never fabricated as a rendered type.
// The catalog is a sub-inventory under `platform`; per-type PARTIALs do NOT create dimension gaps.
// ─────────────────────────────────────────────────────────────────────────────
export interface QmpQuestionType {
  key: string;
  label: string;
  family: 'selected_response' | 'constructed_response' | 'behavioural' | 'performance' | 'adaptive';
  status: QmpStatus;
  note: string;
}

export const QUESTION_TYPES: QmpQuestionType[] = [
  { key: 'likert', label: 'Likert scale', family: 'behavioural', status: 'SUPPORTED', note: 'Clarity + psychometric banks.' },
  { key: 'mcq_single', label: 'Multiple choice (single answer)', family: 'selected_response', status: 'SUPPORTED', note: 'Competency + exam banks.' },
  { key: 'mcq_multi', label: 'Multiple choice (multi-select)', family: 'selected_response', status: 'SUPPORTED', note: 'Competency/exam banks.' },
  { key: 'true_false', label: 'True / False', family: 'selected_response', status: 'SUPPORTED', note: 'Exam bank.' },
  { key: 'scenario', label: 'Scenario', family: 'behavioural', status: 'SUPPORTED', note: 'Psychometric + clarity.' },
  { key: 'situational_judgment', label: 'Situational judgment (SJT)', family: 'behavioural', status: 'SUPPORTED', note: 'Psychometric bank.' },
  { key: 'rating_scale', label: 'Rating scale', family: 'behavioural', status: 'SUPPORTED', note: 'Clarity confidence scale.' },
  { key: 'open_text', label: 'Open text / free response', family: 'constructed_response', status: 'SUPPORTED', note: 'Interview + narrative.' },
  { key: 'short_answer', label: 'Short answer', family: 'constructed_response', status: 'SUPPORTED', note: 'Interview.' },
  { key: 'numeric', label: 'Numeric entry', family: 'constructed_response', status: 'SUPPORTED', note: 'Exam bank.' },
  { key: 'forced_choice', label: 'Forced choice (ipsative)', family: 'behavioural', status: 'SUPPORTED', note: 'Persona / SJ.' },
  { key: 'semantic_differential', label: 'Semantic differential', family: 'behavioural', status: 'PARTIAL', note: 'Catalog-registered; no dedicated renderer yet.' },
  { key: 'ranking', label: 'Ranking / prioritisation', family: 'selected_response', status: 'PARTIAL', note: 'Catalog-registered.' },
  { key: 'slider', label: 'Slider / continuous', family: 'behavioural', status: 'PARTIAL', note: 'Catalog-registered.' },
  { key: 'essay', label: 'Essay / long response', family: 'constructed_response', status: 'PARTIAL', note: 'Catalog-registered.' },
  { key: 'fill_blank', label: 'Fill in the blank / cloze', family: 'constructed_response', status: 'PARTIAL', note: 'Catalog-registered.' },
  { key: 'matching', label: 'Matching', family: 'selected_response', status: 'PARTIAL', note: 'Catalog-registered.' },
  { key: 'ordering', label: 'Ordering / sequencing', family: 'selected_response', status: 'PARTIAL', note: 'Catalog-registered.' },
  { key: 'matrix', label: 'Matrix / grid', family: 'selected_response', status: 'PARTIAL', note: 'Catalog-registered.' },
  { key: 'image_choice', label: 'Image choice', family: 'selected_response', status: 'PARTIAL', note: 'Catalog-registered.' },
  { key: 'hotspot', label: 'Hotspot / region select', family: 'performance', status: 'PARTIAL', note: 'Catalog-registered.' },
  { key: 'drag_drop', label: 'Drag & drop', family: 'performance', status: 'PARTIAL', note: 'Catalog-registered.' },
  { key: 'code', label: 'Code / programming', family: 'performance', status: 'PARTIAL', note: 'Employability MCQ exists; sandboxed exec deferred.' },
  { key: 'audio_response', label: 'Audio response', family: 'performance', status: 'SUPPORTED', note: 'Voice screening (employer).' },
  { key: 'video_response', label: 'Video response', family: 'performance', status: 'SUPPORTED', note: 'Avatar interview channel.' },
  { key: 'file_upload', label: 'File upload / portfolio', family: 'performance', status: 'PARTIAL', note: 'Portfolio exists; not a scored item type yet.' },
  { key: 'case_study', label: 'Case study (multi-part)', family: 'constructed_response', status: 'PARTIAL', note: 'Catalog-registered.' },
  { key: 'adaptive_branching', label: 'Adaptive / branching', family: 'adaptive', status: 'SUPPORTED', note: 'Adaptive questioning engine.' },
  { key: 'composite', label: 'Composite / testlet', family: 'adaptive', status: 'PARTIAL', note: 'Catalog-registered.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// METADATA STANDARD — ONE canonical superset, persisted in qmp_question_metadata overlay.
// `source` names where the fact already lives today (honest provenance); overlay unifies them.
// ─────────────────────────────────────────────────────────────────────────────
export interface QmpMetadataField {
  field: string;
  required: boolean;
  group: 'identity' | 'authoring' | 'pedagogy' | 'psychometrics' | 'governance' | 'lifecycle';
  source: string;
}

export const METADATA_STANDARD: QmpMetadataField[] = [
  { field: 'question_id', required: true, group: 'identity', source: 'capadex_question_registry' },
  { field: 'external_ref', required: false, group: 'identity', source: 'qmp_question_metadata' },
  { field: 'library_scope', required: true, group: 'identity', source: 'qmp_question_metadata' },
  { field: 'question_type', required: true, group: 'identity', source: 'psychometric_question_bank' },
  { field: 'question_text', required: true, group: 'identity', source: 'bank tables' },
  { field: 'language', required: true, group: 'identity', source: 'psychometric_question_bank' },
  { field: 'domain', required: false, group: 'pedagogy', source: 'competency/psychometric domain' },
  { field: 'subdomain', required: false, group: 'pedagogy', source: 'psychometric_subdomains' },
  { field: 'competency', required: false, group: 'pedagogy', source: 'competency_question_templates' },
  { field: 'construct', required: false, group: 'pedagogy', source: 'clarity bridge tag' },
  { field: 'bloom_level', required: false, group: 'pedagogy', source: 'qmp_question_metadata' },
  { field: 'difficulty', required: false, group: 'pedagogy', source: 'psychometric_question_bank' },
  { field: 'cognitive_load', required: false, group: 'pedagogy', source: 'qmp_question_metadata' },
  { field: 'age_band', required: false, group: 'pedagogy', source: 'psychometric_age_bands' },
  { field: 'persona', required: false, group: 'pedagogy', source: 'qmp_question_metadata' },
  { field: 'tags', required: false, group: 'pedagogy', source: 'qmp_question_metadata' },
  { field: 'keywords', required: false, group: 'pedagogy', source: 'qmp_question_metadata' },
  { field: 'marks', required: false, group: 'psychometrics', source: 'qmp_question_metadata' },
  { field: 'weight', required: false, group: 'psychometrics', source: 'qmp_question_metadata' },
  { field: 'scoring_logic', required: false, group: 'psychometrics', source: 'psychometric_question_bank' },
  { field: 'reverse_scored', required: false, group: 'psychometrics', source: 'psychometric_question_bank' },
  { field: 'discrimination', required: false, group: 'psychometrics', source: 'qmp_question_metadata' },
  { field: 'signal_value', required: false, group: 'psychometrics', source: 'capadex_question_registry' },
  { field: 'quality_score', required: false, group: 'psychometrics', source: 'capadex_question_registry' },
  { field: 'usage_count', required: false, group: 'psychometrics', source: 'capadex_question_registry' },
  { field: 'coverage_dimension', required: false, group: 'psychometrics', source: 'capadex_question_registry' },
  { field: 'owner', required: false, group: 'governance', source: 'qmp_question_metadata' },
  { field: 'author', required: false, group: 'authoring', source: 'qmp_question_metadata' },
  { field: 'reviewer', required: false, group: 'governance', source: 'qmp_workflow' },
  { field: 'approver', required: false, group: 'governance', source: 'qmp_workflow' },
  { field: 'source_provenance', required: false, group: 'authoring', source: 'qmp_question_metadata' },
  { field: 'version', required: true, group: 'lifecycle', source: 'capadex_question_registry' },
  { field: 'status', required: true, group: 'lifecycle', source: 'capadex_question_registry' },
  { field: 'created_at', required: true, group: 'lifecycle', source: 'capadex_question_registry' },
  { field: 'updated_at', required: true, group: 'lifecycle', source: 'capadex_question_registry' },
  { field: 'published_at', required: false, group: 'lifecycle', source: 'qmp_workflow' },
];

// Per-source coverage crosswalk — which standard fields each REAL source already populates.
export interface QmpMetadataSource {
  source: string;
  populates: string[];
  note: string;
}

export const METADATA_SOURCE_COVERAGE: QmpMetadataSource[] = [
  {
    source: 'capadex_question_registry',
    populates: ['question_id', 'version', 'status', 'signal_value', 'quality_score', 'usage_count', 'coverage_dimension', 'created_at', 'updated_at'],
    note: 'Governance overlay — the canonical id/version/status + quality/usage/signal facts.',
  },
  {
    source: 'psychometric_question_bank',
    populates: ['question_type', 'question_text', 'language', 'difficulty', 'scoring_logic', 'reverse_scored'],
    note: 'Psychometric bank — type/text/language + scoring facts.',
  },
  {
    source: 'qmp_question_metadata',
    populates: ['external_ref', 'library_scope', 'bloom_level', 'cognitive_load', 'persona', 'tags', 'keywords', 'marks', 'weight', 'discrimination', 'owner', 'author', 'source_provenance'],
    note: 'Additive canonical overlay — the fields no legacy bank captured; unifies without migration.',
  },
  {
    source: 'qmp_workflow',
    populates: ['reviewer', 'approver', 'published_at'],
    note: 'Additive workflow ledger — review/approval/publish authorship + timestamps.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// LIFECYCLE — ONE 9-state canonical model mapped onto the existing 6-state registry CHECK.
// ─────────────────────────────────────────────────────────────────────────────
export interface QmpLifecycleState {
  key: string;
  label: string;
  order: number;
  note: string;
}

export const LIFECYCLE_STATES: QmpLifecycleState[] = [
  { key: 'draft', label: 'Draft', order: 1, note: 'Authoring; not yet submitted.' },
  { key: 'under_review', label: 'Under review', order: 2, note: 'Submitted for review (qmp_workflow).' },
  { key: 'approved', label: 'Approved', order: 3, note: 'Review passed; awaiting publish (qmp_workflow).' },
  { key: 'published', label: 'Published', order: 4, note: 'Live-eligible; equivalent to legacy active (qmp_workflow).' },
  { key: 'active', label: 'Active', order: 5, note: 'In live rotation (registry status active).' },
  { key: 'suspended', label: 'Suspended', order: 6, note: 'Temporarily withheld (qmp_workflow).' },
  { key: 'deprecated', label: 'Deprecated', order: 7, note: 'Discouraged; kept for continuity (registry).' },
  { key: 'retired', label: 'Retired', order: 8, note: 'Removed from rotation, retained for audit (qmp_workflow).' },
  { key: 'archived', label: 'Archived', order: 9, note: 'Cold storage (registry status archived).' },
];

// Map the 9 canonical states onto the EXISTING registry CHECK statuses (no breaking change).
export interface QmpLifecycleMap {
  state: string;
  maps_to: string;
  source: string;
  status: QmpStatus;
}

export const LIFECYCLE_MAPPING: QmpLifecycleMap[] = [
  { state: 'draft', maps_to: 'draft', source: 'capadex_question_registry', status: 'SUPPORTED' },
  { state: 'under_review', maps_to: 'testing', source: 'qmp_workflow', status: 'SUPPORTED' },
  { state: 'approved', maps_to: 'testing', source: 'qmp_workflow', status: 'SUPPORTED' },
  { state: 'published', maps_to: 'active', source: 'qmp_workflow', status: 'SUPPORTED' },
  { state: 'active', maps_to: 'active', source: 'capadex_question_registry', status: 'SUPPORTED' },
  { state: 'suspended', maps_to: 'candidate_for_retirement', source: 'qmp_workflow', status: 'SUPPORTED' },
  { state: 'deprecated', maps_to: 'deprecated', source: 'capadex_question_registry', status: 'SUPPORTED' },
  { state: 'retired', maps_to: 'candidate_for_retirement', source: 'qmp_workflow', status: 'SUPPORTED' },
  { state: 'archived', maps_to: 'archived', source: 'capadex_question_registry', status: 'SUPPORTED' },
];

// ─────────────────────────────────────────────────────────────────────────────
// GOVERNANCE CONTROLS
// ─────────────────────────────────────────────────────────────────────────────
export interface QmpControl {
  key: string;
  label: string;
  status: QmpStatus;
  evidence: string[]; // file path OR table name
}

export const GOVERNANCE_CONTROLS: QmpControl[] = [
  { key: 'ownership', label: 'Ownership / authorship', status: 'SUPPORTED', evidence: ['qmp_question_metadata', 'services/question-management-mechanisms.ts'] },
  { key: 'review', label: 'Review workflow', status: 'SUPPORTED', evidence: ['qmp_workflow', 'services/question-management-mechanisms.ts'] },
  { key: 'approval', label: 'Approval gate', status: 'SUPPORTED', evidence: ['qmp_workflow'] },
  { key: 'publish', label: 'Publish control', status: 'SUPPORTED', evidence: ['qmp_workflow'] },
  { key: 'audit_trail', label: 'Status-change audit trail', status: 'SUPPORTED', evidence: ['capadex_question_registry', 'qmp_workflow'] },
  { key: 'change_history', label: 'Change history', status: 'SUPPORTED', evidence: ['qmp_question_versions'] },
  { key: 'access_control', label: 'Access control (super-admin gate)', status: 'SUPPORTED', evidence: ['routes/question-management.ts'] },
  { key: 'quality_governance', label: 'Quality / signal governance', status: 'SUPPORTED', evidence: ['services/question-registry-service.ts', 'services/question-certification.ts'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// VERSION MANAGEMENT CAPABILITIES
// ─────────────────────────────────────────────────────────────────────────────
export const VERSION_CAPABILITIES: QmpControl[] = [
  { key: 'history', label: 'Full version history', status: 'SUPPORTED', evidence: ['qmp_question_versions'] },
  { key: 'increment', label: 'Major / minor increment', status: 'SUPPORTED', evidence: ['services/question-management-mechanisms.ts'] },
  { key: 'compare', label: 'Version compare / diff', status: 'SUPPORTED', evidence: ['services/question-management-mechanisms.ts'] },
  { key: 'rollback', label: 'Rollback to prior version', status: 'SUPPORTED', evidence: ['qmp_question_versions'] },
  { key: 'clone', label: 'Clone question', status: 'SUPPORTED', evidence: ['services/question-management-mechanisms.ts'] },
  { key: 'fork', label: 'Fork (branch)', status: 'SUPPORTED', evidence: ['qmp_question_versions'] },
  { key: 'merge', label: 'Merge branch', status: 'SUPPORTED', evidence: ['services/question-management-mechanisms.ts'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW STAGES (review → approve → publish → …)
// ─────────────────────────────────────────────────────────────────────────────
export const WORKFLOW_STAGES: QmpControl[] = [
  { key: 'submit_review', label: 'Submit for review', status: 'SUPPORTED', evidence: ['qmp_workflow'] },
  { key: 'review', label: 'Review', status: 'SUPPORTED', evidence: ['qmp_workflow'] },
  { key: 'approve', label: 'Approve', status: 'SUPPORTED', evidence: ['qmp_workflow'] },
  { key: 'reject', label: 'Reject / request changes', status: 'SUPPORTED', evidence: ['qmp_workflow'] },
  { key: 'publish', label: 'Publish', status: 'SUPPORTED', evidence: ['qmp_workflow'] },
  { key: 'suspend', label: 'Suspend', status: 'SUPPORTED', evidence: ['qmp_workflow'] },
  { key: 'retire', label: 'Retire', status: 'SUPPORTED', evidence: ['qmp_workflow'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH & DISCOVERY
// ─────────────────────────────────────────────────────────────────────────────
export const SEARCH_CAPABILITIES: QmpControl[] = [
  { key: 'text_search', label: 'Full-text search (ILIKE over text)', status: 'SUPPORTED', evidence: ['routes/question-management.ts'] },
  { key: 'faceted_filter', label: 'Faceted filter (type/status/domain/tags)', status: 'SUPPORTED', evidence: ['services/question-registry-service.ts'] },
  { key: 'metadata_filter', label: 'Metadata filter (overlay)', status: 'SUPPORTED', evidence: ['qmp_question_metadata'] },
  { key: 'saved_search', label: 'Saved searches', status: 'SUPPORTED', evidence: ['qmp_saved_searches'] },
  { key: 'quality_ranking', label: 'Quality / signal ranking', status: 'SUPPORTED', evidence: ['services/question-metadata-ranking.ts'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// BULK OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────
export const BULK_OPERATIONS: QmpControl[] = [
  { key: 'import', label: 'Bulk import (CSV/JSON)', status: 'SUPPORTED', evidence: ['routes/capadex-clarity-questions.ts', 'qmp_bulk_jobs'] },
  { key: 'export', label: 'Bulk export', status: 'SUPPORTED', evidence: ['qmp_bulk_jobs'] },
  { key: 'bulk_tag', label: 'Bulk tag / classify', status: 'SUPPORTED', evidence: ['qmp_bulk_jobs'] },
  { key: 'bulk_status', label: 'Bulk status transition', status: 'SUPPORTED', evidence: ['qmp_bulk_jobs', 'services/question-registry-service.ts'] },
  { key: 'bulk_review', label: 'Bulk review / approve', status: 'SUPPORTED', evidence: ['qmp_bulk_jobs', 'qmp_workflow'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// LIBRARY SCOPES — the existing physical banks unified by reference (NOT merged).
// ─────────────────────────────────────────────────────────────────────────────
export interface QmpLibraryScope {
  key: string;
  label: string;
  physical_table: string;
  status: QmpStatus;
}

export const LIBRARY_SCOPES: QmpLibraryScope[] = [
  { key: 'clarity', label: 'CAPADEX clarity (behavioural)', physical_table: 'capadex_question_registry', status: 'SUPPORTED' },
  { key: 'psychometric', label: 'Psychometric', physical_table: 'psychometric_question_bank', status: 'SUPPORTED' },
  { key: 'competency', label: 'Competency (CAF)', physical_table: 'competency_question_templates', status: 'SUPPORTED' },
  { key: 'interview', label: 'Interview', physical_table: 'interview_questions', status: 'SUPPORTED' },
  { key: 'lbi', label: 'Learning behaviour (LBI)', physical_table: 'lbi_question_bank', status: 'SUPPORTED' },
  { key: 'exam', label: 'Exam-ready', physical_table: 'exam_questions', status: 'SUPPORTED' },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAPPING MODEL — 8-axis: how a question threads through the platform (reference continuity).
// ─────────────────────────────────────────────────────────────────────────────
export interface QmpMappingStep {
  step: number;
  axis: QmpAxis;
  label: string;
  reuses: { services: string[]; tables: string[] };
}

export const MAPPING_MODEL: QmpMappingStep[] = [
  { step: 1, axis: 'platform', label: 'Register question in canonical registry', reuses: { services: ['services/question-registry-service.ts'], tables: ['capadex_question_registry'] } },
  { step: 2, axis: 'library', label: 'Assign to library scope + collection', reuses: { services: ['services/question-management-mechanisms.ts'], tables: ['qmp_collections'] } },
  { step: 3, axis: 'metadata', label: 'Populate canonical metadata overlay', reuses: { services: ['services/question-metadata-ranking.ts'], tables: ['qmp_question_metadata'] } },
  { step: 4, axis: 'workflow', label: 'Submit → review → approve → publish', reuses: { services: ['services/question-management-mechanisms.ts'], tables: ['qmp_workflow'] } },
  { step: 5, axis: 'version_management', label: 'Snapshot version on each transition', reuses: { services: ['services/question-management-mechanisms.ts'], tables: ['qmp_question_versions'] } },
  { step: 6, axis: 'governance', label: 'Enforce ownership + audit + access', reuses: { services: ['services/question-registry-service.ts'], tables: ['capadex_question_registry'] } },
  { step: 7, axis: 'apis', label: 'Serve via unified read + governed write API', reuses: { services: ['services/question-management-engine.ts'], tables: [] } },
  { step: 8, axis: 'frontend', label: 'Manage via unified super-admin console', reuses: { services: ['services/question-management-engine.ts'], tables: [] } },
];

// ─────────────────────────────────────────────────────────────────────────────
// DECISIONS + GAPS
// ─────────────────────────────────────────────────────────────────────────────
export interface QmpDecision {
  key: string;
  decision: string;
  rationale: string;
}

export const QMP_DECISIONS: QmpDecision[] = [
  {
    key: 'no-duplicate-platform',
    decision: 'COMPOSE the 13 existing question services under one registry; build NO new question platform.',
    rationale: 'Repository First / Reuse before build — a duplicate platform would fork the SSoT and break byte-identical OFF.',
  },
  {
    key: 'banks-unified-by-reference',
    decision: 'Unify the physical banks by reference (LIBRARY_SCOPES + qmp_collections), never merge tables.',
    rationale: 'Merging banks is a breaking change; reference-unification is additive and reversible.',
  },
  {
    key: 'lifecycle-additive-not-check-break',
    decision: 'Track the 4 additive lifecycle states in qmp_workflow; do NOT widen the legacy registry CHECK.',
    rationale: 'Widening the CHECK is a schema change visible when OFF; the overlay keeps OFF byte-identical.',
  },
  {
    key: 'closure-vs-adoption',
    decision: 'Certify a dimension SUPPORTED when the capability EXISTS + is wired; report real question volume as a SEPARATE adoption axis.',
    rationale: 'Engineering closure ⟂ adoption; adoption is never a gap and never fabricated.',
  },
  {
    key: 'type-catalog-honesty',
    decision: 'Register all 29 types in the canonical catalog; mark types without a dedicated renderer PARTIAL, not SUPPORTED.',
    rationale: 'The platform accepting a type ≠ a bank rendering it; over-claiming renderers would fabricate coverage.',
  },
];

/** OPEN engineering gaps — 0. Every true gap is engineering-closed via a reuse-before-build mechanism. */
export interface QmpGap {
  id: string;
  severity: GapSeverity;
  dimension: QmpAxis;
  summary: string;
}

export const QMP_GAPS: QmpGap[] = [];

/** RESOLVED gaps — the true gaps that WERE open, now engineering-closed via reuse/additive mechanism. */
export interface QmpResolvedGap {
  id: string;
  severity: GapSeverity;
  dimension: QmpAxis;
  summary: string;
  mechanism: string;
}

export const RESOLVED_QMP_GAPS: QmpResolvedGap[] = [
  { id: 'QM-1', severity: 'High', dimension: 'metadata', summary: 'No canonical, unified metadata standard across banks.', mechanism: 'qmp_question_metadata overlay + METADATA_STANDARD (35 fields) unifying existing sources without migration.' },
  { id: 'QM-2', severity: 'High', dimension: 'version_management', summary: 'Only an integer version pointer; no history/compare/rollback/clone/fork/merge.', mechanism: 'qmp_question_versions append-only ledger + snapshot/compare/rollback/clone/fork/merge helpers.' },
  { id: 'QM-3', severity: 'High', dimension: 'workflow', summary: '6 registry states; no review→approve→publish workflow or roles.', mechanism: '9-state canonical model mapped onto the CHECK via qmp_workflow (no CHECK break).' },
  { id: 'QM-4', severity: 'Medium', dimension: 'governance', summary: 'Ownership/reviewer/approver not first-class.', mechanism: 'qmp_question_metadata owner/author + qmp_workflow reviewer/approver + reused registry audit.' },
  { id: 'QM-5', severity: 'Medium', dimension: 'library', summary: 'Banks fragmented; no library abstraction or collections.', mechanism: 'LIBRARY_SCOPES reference-unification + qmp_collections folders.' },
  { id: 'QM-6', severity: 'Medium', dimension: 'apis', summary: 'Search/bulk-ops fragmented across per-bank routes.', mechanism: 'Unified read + governed write API + qmp_saved_searches + qmp_bulk_jobs ledger.' },
  { id: 'QM-7', severity: 'Medium', dimension: 'frontend', summary: 'Question panels fragmented; no single console.', mechanism: 'QuestionManagementPanel composing the existing panels behind the flag.' },
  { id: 'QM-8', severity: 'Low', dimension: 'platform', summary: 'No single certified platform layer over the 13 services.', mechanism: 'question-management-engine composer + registry as the canonical model.' },
];
