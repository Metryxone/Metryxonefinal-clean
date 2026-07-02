/**
 * CAPADEX 3.0 — Program 3 · Phase 3.10 Enterprise AI Interpretation & Explainability Platform
 * ───────────────────────────────────────────────────────────────────────────
 * The ONE canonical AI Interpretation & Explainability platform — turns a STANDARDIZED score (3.8) +
 * BENCHMARK result (3.9) into an INTERPRETED, EXPLAINABLE, CONFIDENCE-scored, HALLUCINATION-protected
 * result. It COMPOSES the EXISTING interpretation substrate (services/aiClient.ts health-gated LLM seam ·
 * services/mei-narrative-engine.ts rule-driven narration prior-art) + the pure 3.8 structured-AST formula
 * engine (score-standardization-mechanisms: evaluateFormula/validateFormula) + the pure psychometric
 * transforms (psychometric-standardization: zFromValue/zToPercentile) under a single certified layer, and
 * adds an additive `aixp_*` overlay for interpretation RULES, PROMPT links, POLICIES, THRESHOLDS, a RUN
 * ledger (full version lineage + confidence + evidence + suppressed/abstained + source tag), governance
 * (draft→…→retire + version history + rollback + audit) and saved views.
 * NO duplicate AI / interpretation engine, NO V2, NO breaking change.
 *
 * ARCHITECTURE (honest): the interpretation CORE is DETERMINISTIC — selectInterpretationRule (3.8
 * structured-AST condition, NO eval) + renderInterpretation ({{token}} render over GROUNDED tokens only) +
 * computeConfidence (evidence-completeness → score + missing-evidence + human-review flag) +
 * composeExplanation (why / evidence / confidence / data-sources / rule / benchmark / score / assessment
 * refs) + evaluateInterpretationFormula (composite index via 3.8 AST). The LLM NARRATION is an OPTIONAL,
 * honest-degrading seam: aiClient.checkAIHealth gates it, the model is constrained to grounded tokens,
 * detectUnsupportedClaims + verifyReferences validate the output, and ANY failure / unsupported claim
 * falls back to the deterministic, source-tagged interpretation. AI output is NEVER fabricated; when the
 * model is unavailable the result degrades to deterministic with source:'deterministic' + a reason.
 *
 * Scope is INTERPRETATION, EXPLAINABILITY, CONFIDENCE & HALLUCINATION-PROTECTION only. It sits DOWNSTREAM
 * of standardization (3.8) + benchmarking (3.9). It NEVER re-scores, NEVER re-standardizes, NEVER
 * re-benchmarks, NEVER builds a norm.
 *
 * OUT OF SCOPE — DO NOT IMPLEMENT here (later phases own these; they are BOUNDARIES, not gaps):
 * Recommendation Engine, Learning-Path Engine, Growth-Planning Engine, Report Generation and Dashboard
 * Intelligence. Interpretation FEEDS them; it does not build them.
 *
 * This file is DATA ONLY (no DB, no FS, no side effects). The engine
 * (`services/ai-interpretation-engine.ts`) is the SSoT for "present/absent" — it INDEPENDENTLY verifies
 * every evidence claim here against the live filesystem + DB. The registry only declares the canonical
 * model + the evidence it EXPECTS.
 *
 * ELEVEN INDEPENDENT certification dimensions, each reported SEPARATELY and NEVER composited:
 *   ai_interpretation · explainability · confidence · hallucination_protection · rule_repository ·
 *   super_admin · frontend · ux · apis · testing · documentation.
 *
 * Honesty: null (unknown) ≠ 0 (absent). Coverage (does an implementation exist?) ⟂ Confidence ⟂ Adoption
 * (real interpreted VOLUME) — never composited. Interpretation ABSTAINS when evidence is below the
 * confidence / k_min floor. The composite interpretation index is a STRUCTURED AST (no eval / no new
 * Function). Breadth is honest — fine-grained interpretation KINDS (skill / learning / growth), some
 * PERSONA / LIFECYCLE depth are PARTIAL (mechanism-present, finer standardized input / accumulated volume
 * pending), reported in-line, never forced to 100%. Never fabricate.
 */

export type AixpStatus = 'SUPPORTED' | 'PARTIAL' | 'DEAD_END' | 'MISSING';
export type GapSeverity = 'Launch-Critical' | 'High' | 'Medium' | 'Low' | 'Future';
export type AixpAxis =
  | 'ai_interpretation' | 'explainability' | 'confidence' | 'hallucination_protection'
  | 'rule_repository' | 'super_admin' | 'frontend' | 'ux' | 'apis' | 'testing' | 'documentation';

export interface AixpEvidence {
  services: string[];
  routes: string[];
  frontend: string[];
  tables: string[];
}

export interface AixpDimension {
  key: AixpAxis;
  label: string;
  status: AixpStatus;
  statusNote: string;
  evidence: AixpEvidence;
}

// Minimum real evidence / cohort members before an interpretation is confidence-reported (else ABSTAIN /
// human-review). Mirrors the k-anonymity floor used across the platform (peer-benchmark K=30).
export const AIXP_K_MIN = 30;

// ─────────────────────────────────────────────────────────────────────────────
// AXES — the eleven certification dimensions (declarative descriptors)
// ─────────────────────────────────────────────────────────────────────────────
export const AIXP_AXES: { key: AixpAxis; label: string; question: string }[] = [
  { key: 'ai_interpretation', label: 'AI Interpretation', question: 'Can a standardized + benchmarked result be interpreted (overall / domain / competency / behaviour / employability / leadership / readiness …) deterministically, with an OPTIONAL honest-degrading LLM narration constrained to grounded tokens?' },
  { key: 'explainability', label: 'Explainability', question: 'Does every interpretation carry a full explanation (why / evidence basis / data sources / rule reference / score reference / benchmark reference / assessment reference / confidence rationale)?' },
  { key: 'confidence', label: 'Confidence', question: 'Is each interpretation confidence-scored from evidence completeness, with missing-evidence detection, a human-review recommendation and abstention below the floor?' },
  { key: 'hallucination_protection', label: 'Hallucination Protection', question: 'Is the LLM constrained to grounded tokens, with unsupported-claim detection, reference verification, deterministic fallback and source tagging so no output is fabricated?' },
  { key: 'rule_repository', label: 'Rule Repository', question: 'Is there a governed, versioned interpretation rule / prompt / threshold / policy repository (draft→…→retire + version history + rollback + audit)?' },
  { key: 'super_admin', label: 'Super Admin', question: 'Is there a super-admin console (interpretation library / rule configuration / prompt management / threshold configuration / version manager / approval / audit)?' },
  { key: 'frontend', label: 'Frontend', question: 'Is there an interpretation dashboard / explanation viewer / confidence indicators / evidence explorer / rule-trace viewer / hallucination flags / interpretation workbench?' },
  { key: 'ux', label: 'UX', question: 'Does the UX support interactive filtering / drill-down / expandable explanations / confidence visualization / evidence linking / saved views / responsive / accessible surfaces?' },
  { key: 'apis', label: 'APIs', question: 'Do interpretation / explainability / confidence / rule / configuration APIs exist?' },
  { key: 'testing', label: 'Testing', question: 'Is there a testing suite (unit / integration / API) covering interpretation, explainability, confidence, hallucination protection, determinism and composite-index evaluation?' },
  { key: 'documentation', label: 'Documentation', question: 'Is there a documentation set (architecture / interpretation library / explainability framework / confidence framework / API / admin / release notes)?' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FROZEN sub-inventories (pure catalogs — status-only)
// ─────────────────────────────────────────────────────────────────────────────
export interface CatalogItem { key: string; label: string; status: AixpStatus; note: string }

// Interpretation KINDS (10). SUPPORTED = the standardized + benchmarked substrate exposes the axis, so a
// deterministic interpretation (rule-selected + token-rendered) is computable now; PARTIAL = depends on a
// finer-grained standardized input not uniformly present upstream (3.5/3.6/3.8) — GAP-AIXP-1. Never MISSING.
export const INTERPRETATION_KINDS: CatalogItem[] = [
  { key: 'overall', label: 'Overall interpretation', status: 'SUPPORTED', note: 'Interprets the overall standardized + benchmarked result — selectInterpretationRule over the overall band + benchmark percentile, rendered from grounded tokens.' },
  { key: 'domain', label: 'Domain interpretation', status: 'SUPPORTED', note: 'Per-domain interpretation over the standardized domain scores + domain benchmark (3.9), rendered from grounded tokens.' },
  { key: 'competency', label: 'Competency interpretation', status: 'SUPPORTED', note: 'Per-competency interpretation over the standardized competency scores + competency benchmark (3.9).' },
  { key: 'behaviour', label: 'Behaviour interpretation', status: 'SUPPORTED', note: 'Per-behaviour interpretation over the standardized behaviour scores + behaviour benchmark (3.9).' },
  { key: 'employability', label: 'Employability interpretation', status: 'SUPPORTED', note: 'Employability interpretation composing the MEI substrate + employability benchmark (3.9); the mei-narrative-engine is prior-art rule-driven narration.' },
  { key: 'leadership', label: 'Leadership interpretation', status: 'SUPPORTED', note: 'Leadership interpretation over the standardized leadership scores + leadership benchmark (3.9).' },
  { key: 'readiness', label: 'Readiness interpretation', status: 'SUPPORTED', note: 'Readiness interpretation over the standardized readiness scores + readiness benchmark (3.9).' },
  { key: 'skill', label: 'Skill interpretation', status: 'PARTIAL', note: 'Skill-level interpretation depends on a finer-grained standardized skill input not uniformly present upstream (GAP-AIXP-1). Reachable when the standardized substrate exposes skill scores. PARTIAL, not MISSING.' },
  { key: 'learning', label: 'Learning interpretation', status: 'PARTIAL', note: 'Learning-outcome interpretation depends on a standardized learning-outcome input not uniformly present upstream (GAP-AIXP-1).' },
  { key: 'growth', label: 'Growth interpretation', status: 'PARTIAL', note: 'Longitudinal growth interpretation depends on accumulated benchmark time-series VOLUME (abmk_results) — an ADOPTION axis (honest 0), reported SEPARATELY, never a gap.' },
];

// Explainability CRITERIA (8) — every interpretation must carry each explanation facet. All SUPPORTED:
// composeExplanation emits all eight refs; a null ref (no benchmark yet) is an honest null, never fabricated.
export const EXPLAINABILITY_CRITERIA: CatalogItem[] = [
  { key: 'why_explanation', label: 'Why (reasoning)', status: 'SUPPORTED', note: 'The plain-language reason this interpretation was produced — derived from the fired rule + the observed band / percentile. Deterministic, grounded.' },
  { key: 'evidence_basis', label: 'Evidence basis', status: 'SUPPORTED', note: 'The concrete evidence supporting the interpretation (which scores / dimensions / benchmark drove it) — carried as a structured evidence[] on every result.' },
  { key: 'data_sources', label: 'Data sources', status: 'SUPPORTED', note: 'The upstream data sources (standardized score 3.8 / benchmark 3.9 / assessment) the interpretation reads from — enumerated on every result.' },
  { key: 'rule_reference', label: 'Rule reference', status: 'SUPPORTED', note: 'The interpretation rule (aixp_rules key + version) that fired — carried on every result for full traceability.' },
  { key: 'score_reference', label: 'Score reference', status: 'SUPPORTED', note: 'The standardized score (astd_standard_scores) interpreted — the interpretation input, carried on every result.' },
  { key: 'benchmark_reference', label: 'Benchmark reference', status: 'SUPPORTED', note: 'The benchmark result (abmk_results, 3.9) the interpretation contextualizes — carried on every result; null when no benchmark exists yet (honest null).' },
  { key: 'assessment_reference', label: 'Assessment reference', status: 'SUPPORTED', note: 'The assessment + version the interpreted score was produced against — carried on every result.' },
  { key: 'confidence_rationale', label: 'Confidence rationale', status: 'SUPPORTED', note: 'Why the interpretation has the confidence it does — the evidence-completeness breakdown + missing-evidence list from computeConfidence.' },
];

// Confidence CRITERIA (5) — all SUPPORTED. Confidence is COMPUTED from evidence completeness, NEVER guessed.
export const CONFIDENCE_CRITERIA: CatalogItem[] = [
  { key: 'confidence_scoring', label: 'Confidence scoring', status: 'SUPPORTED', note: 'computeConfidence maps the fraction of required evidence present to a confidence score (0..1) + a band (low/medium/high). Deterministic.' },
  { key: 'evidence_completeness', label: 'Evidence completeness', status: 'SUPPORTED', note: 'Which required evidence facets (score / benchmark / rule / cohort) are present vs missing — the confidence numerator/denominator.' },
  { key: 'missing_evidence', label: 'Missing-evidence detection', status: 'SUPPORTED', note: 'The explicit list of missing evidence facets — surfaced so a reviewer knows exactly what is absent. null ≠ 0.' },
  { key: 'human_review', label: 'Human-review recommendation', status: 'SUPPORTED', note: 'A human_review flag is raised when confidence is below the review threshold or an unsupported claim was detected — never auto-published silently.' },
  { key: 'abstention', label: 'Abstention below floor', status: 'SUPPORTED', note: 'When cohort/evidence is below k_min / the confidence floor the interpretation ABSTAINS (abstained:true) rather than asserting — never fabricated.' },
];

// Hallucination-protection CONTROLS (5) — all SUPPORTED. These make the OPTIONAL LLM narration safe.
export const HALLUCINATION_CONTROLS: CatalogItem[] = [
  { key: 'grounded_tokens_only', label: 'Grounded tokens only', status: 'SUPPORTED', note: 'The LLM narration prompt is constrained to a whitelist of grounded tokens (the actual scores / bands / percentiles / dimensions) — it may only phrase, never introduce new facts.' },
  { key: 'unsupported_claim_detection', label: 'Unsupported-claim detection', status: 'SUPPORTED', note: 'detectUnsupportedClaims scans narration output for numeric / factual claims not present in the grounded token set; any hit forces the deterministic fallback + human_review.' },
  { key: 'reference_verification', label: 'Reference verification', status: 'SUPPORTED', note: 'verifyReferences confirms every score / benchmark / rule reference cited in the explanation resolves to a real provenance value — unresolved refs are dropped, never fabricated.' },
  { key: 'deterministic_fallback', label: 'Deterministic fallback', status: 'SUPPORTED', note: 'If the model is unavailable (checkAIHealth not ok) OR the output fails validation, the interpretation falls back to the deterministic rule-rendered text with source:\'deterministic\' + a reason.' },
  { key: 'source_tagging', label: 'Source tagging', status: 'SUPPORTED', note: 'Every interpretation is tagged source:\'ai\' | \'deterministic\' (+ ai_available + reason) so a consumer always knows whether a human-grade model or the deterministic core produced it.' },
];

// Rule-repository CAPABILITIES (5) — all SUPPORTED. The governed, versioned interpretation asset store.
export const RULE_CAPABILITIES: CatalogItem[] = [
  { key: 'interpretation_rules', label: 'Interpretation rules', status: 'SUPPORTED', note: 'aixp_rules: versioned interpretation rules (kind + structured-AST condition + grounded template + state). selectInterpretationRule picks the highest-priority matching rule.' },
  { key: 'prompt_links', label: 'Prompt templates', status: 'SUPPORTED', note: 'aixp_prompt_links: versioned LLM prompt templates linked to a rule, carrying the grounded-token whitelist that constrains narration.' },
  { key: 'thresholds', label: 'Confidence / abstention thresholds', status: 'SUPPORTED', note: 'aixp_thresholds: versioned confidence / review / k_min thresholds resolved by scope precedence.' },
  { key: 'policies', label: 'Interpretation policies', status: 'SUPPORTED', note: 'aixp_policies: versioned, scoped interpretation policies (which kinds / personas an interpretation config applies to) resolved by scope precedence.' },
  { key: 'versioning_governance', label: 'Versioning & governance', status: 'SUPPORTED', note: 'Every rule / prompt / threshold / policy moves through draft→review→validate→approve→publish→archive→retire with append-only version history + rollback + audit (aixp_governance_log + aixp_audit_log).' },
];

// PERSONA coverage (13). SUPPORTED = a rule set + grounded tokens interpret this persona today; PARTIAL =
// interpretation reachable but persona-specific rule depth is deferred to accumulated authored volume (GAP-AIXP-2).
export const PERSONA_COVERAGE: CatalogItem[] = [
  { key: 'student', label: 'Student', status: 'SUPPORTED', note: 'Student-lens interpretation over the standardized + benchmarked result.' },
  { key: 'graduate', label: 'Graduate / fresher', status: 'SUPPORTED', note: 'Graduate/fresher-lens interpretation.' },
  { key: 'professional', label: 'Working professional', status: 'SUPPORTED', note: 'Professional-lens interpretation.' },
  { key: 'jobseeker', label: 'Job seeker', status: 'SUPPORTED', note: 'Job-seeker-lens interpretation.' },
  { key: 'career_switcher', label: 'Career switcher', status: 'SUPPORTED', note: 'Career-switcher-lens interpretation.' },
  { key: 'manager', label: 'People manager', status: 'SUPPORTED', note: 'Manager-lens interpretation.' },
  { key: 'senior_leadership', label: 'Senior leadership', status: 'SUPPORTED', note: 'Senior-leadership-lens interpretation.' },
  { key: 'entrepreneur', label: 'Entrepreneur', status: 'SUPPORTED', note: 'Entrepreneur-lens interpretation.' },
  { key: 'returner', label: 'Returner (career break)', status: 'SUPPORTED', note: 'Returner-lens interpretation.' },
  { key: 'faculty', label: 'Faculty / educator', status: 'SUPPORTED', note: 'Faculty-lens interpretation (batch-confined institutional read).' },
  { key: 'counsellor', label: 'Counsellor', status: 'SUPPORTED', note: 'Counsellor-lens interpretation.' },
  { key: 'parent', label: 'Parent', status: 'SUPPORTED', note: 'Parent-lens interpretation (consent-gated).' },
  { key: 'hr', label: 'HR / talent partner', status: 'PARTIAL', note: 'HR/talent-lens interpretation reachable via the generic professional/organization rule set; a first-class HR-specific rule depth is deferred to authored volume (GAP-AIXP-2). PARTIAL, not MISSING.' },
];

// LIFECYCLE coverage (8). SUPPORTED where interpretation is a first-class output of the stage; PARTIAL where
// the stage is downstream of a DO-NOT-IMPLEMENT boundary (recommend) or depends on accumulated volume (GAP-AIXP-2).
export const LIFECYCLE_COVERAGE: CatalogItem[] = [
  { key: 'discover', label: 'Discover', status: 'SUPPORTED', note: 'Interpretation at discovery — what the standardized + benchmarked result means for this subject.' },
  { key: 'diagnose', label: 'Diagnose', status: 'PARTIAL', note: 'Diagnostic interpretation depends on the finer-grained diagnostic standardized inputs (skill/learning-outcome) not uniformly present upstream (GAP-AIXP-2).' },
  { key: 'recommend', label: 'Recommend', status: 'PARTIAL', note: 'Interpretation FEEDS the Recommendation Engine, which is a DO-NOT-IMPLEMENT boundary for 3.10 — the interpretation output is present; the recommend stage itself is a later-phase boundary, not a gap.' },
  { key: 'learn', label: 'Learn', status: 'SUPPORTED', note: 'Interpretation at the learn stage — what the current result means for what to learn (interpretation only; learning-path is a boundary).' },
  { key: 'improve', label: 'Improve', status: 'SUPPORTED', note: 'Interpretation of improvement — what a changed result means (point-in-time; longitudinal improvement depends on accumulated volume).' },
  { key: 'grow', label: 'Grow', status: 'SUPPORTED', note: 'Interpretation at the grow stage — what the result means for growth (interpretation only; growth-planning is a boundary).' },
  { key: 'transition', label: 'Transition', status: 'PARTIAL', note: 'Transition-stage interpretation depends on role/occupation standardized inputs not uniformly present upstream (GAP-AIXP-2).' },
  { key: 'sustain', label: 'Sustain', status: 'PARTIAL', note: 'Sustain-stage (longitudinal) interpretation depends on accumulated benchmark time-series VOLUME — an ADOPTION axis (honest 0), reported SEPARATELY, never a gap.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FROZEN control groups (evidence-verified — each has evidence[] the engine checks)
// ─────────────────────────────────────────────────────────────────────────────
export interface AixpControl { key: string; label: string; status: AixpStatus; evidence: string[] }

// Super-admin surfaces (7)
export const SUPER_ADMIN_SURFACES: AixpControl[] = [
  { key: 'interpretation_library', label: 'Interpretation library', status: 'SUPPORTED', evidence: ['components/superadmin/AiInterpretationPanel.tsx'] },
  { key: 'rule_configuration', label: 'Rule configuration', status: 'SUPPORTED', evidence: ['components/superadmin/AiInterpretationPanel.tsx'] },
  { key: 'prompt_management', label: 'Prompt management', status: 'SUPPORTED', evidence: ['components/superadmin/AiInterpretationPanel.tsx'] },
  { key: 'threshold_configuration', label: 'Threshold configuration', status: 'SUPPORTED', evidence: ['components/superadmin/AiInterpretationPanel.tsx'] },
  { key: 'version_manager', label: 'Version manager', status: 'SUPPORTED', evidence: ['components/superadmin/AiInterpretationPanel.tsx'] },
  { key: 'interpretation_approval', label: 'Interpretation approval workflow', status: 'SUPPORTED', evidence: ['components/superadmin/AiInterpretationPanel.tsx'] },
  { key: 'audit_console', label: 'Audit console', status: 'SUPPORTED', evidence: ['components/superadmin/AiInterpretationPanel.tsx'] },
];

// Frontend surfaces (7)
export const FRONTEND_SURFACES: AixpControl[] = [
  { key: 'interpretation_dashboard', label: 'Interpretation dashboard', status: 'SUPPORTED', evidence: ['components/superadmin/AiInterpretationPanel.tsx'] },
  { key: 'explanation_viewer', label: 'Explanation viewer', status: 'SUPPORTED', evidence: ['components/ai-interpretation/AiInterpretationWorkbench.tsx'] },
  { key: 'confidence_indicators', label: 'Confidence indicators', status: 'SUPPORTED', evidence: ['components/ai-interpretation/AiInterpretationWorkbench.tsx'] },
  { key: 'evidence_explorer', label: 'Evidence explorer', status: 'SUPPORTED', evidence: ['components/ai-interpretation/AiInterpretationWorkbench.tsx'] },
  { key: 'rule_trace_viewer', label: 'Rule-trace viewer', status: 'SUPPORTED', evidence: ['components/ai-interpretation/AiInterpretationWorkbench.tsx'] },
  { key: 'hallucination_flags', label: 'Hallucination flags', status: 'SUPPORTED', evidence: ['components/ai-interpretation/AiInterpretationWorkbench.tsx'] },
  { key: 'interpretation_workbench', label: 'Interpretation workbench', status: 'SUPPORTED', evidence: ['components/ai-interpretation/AiInterpretationWorkbench.tsx'] },
];

// UX criteria (8)
export const UX_CRITERIA: AixpControl[] = [
  { key: 'interactive_filtering', label: 'Interactive filtering', status: 'SUPPORTED', evidence: ['components/ai-interpretation/AiInterpretationWorkbench.tsx'] },
  { key: 'drill_down', label: 'Drill down', status: 'SUPPORTED', evidence: ['components/ai-interpretation/AiInterpretationWorkbench.tsx'] },
  { key: 'expandable_explanations', label: 'Expandable explanations', status: 'SUPPORTED', evidence: ['components/ai-interpretation/AiInterpretationWorkbench.tsx'] },
  { key: 'confidence_visualization', label: 'Confidence visualization', status: 'SUPPORTED', evidence: ['components/ai-interpretation/AiInterpretationWorkbench.tsx'] },
  { key: 'evidence_linking', label: 'Evidence linking', status: 'SUPPORTED', evidence: ['components/ai-interpretation/AiInterpretationWorkbench.tsx'] },
  { key: 'saved_views', label: 'Saved views', status: 'SUPPORTED', evidence: ['components/ai-interpretation/AiInterpretationWorkbench.tsx', 'routes/ai-interpretation.ts', 'aixp_saved_views'] },
  { key: 'responsive', label: 'Responsive design', status: 'SUPPORTED', evidence: ['components/ai-interpretation/AiInterpretationWorkbench.tsx'] },
  { key: 'accessibility', label: 'Accessibility', status: 'SUPPORTED', evidence: ['components/ai-interpretation/AiInterpretationWorkbench.tsx'] },
];

// API groups (5)
export const API_GROUPS: AixpControl[] = [
  { key: 'interpretation_apis', label: 'Interpretation APIs', status: 'SUPPORTED', evidence: ['routes/ai-interpretation.ts', 'services/ai-interpretation-mechanisms.ts'] },
  { key: 'explainability_apis', label: 'Explainability APIs', status: 'SUPPORTED', evidence: ['routes/ai-interpretation.ts', 'services/ai-interpretation-mechanisms.ts'] },
  { key: 'confidence_apis', label: 'Confidence APIs', status: 'SUPPORTED', evidence: ['routes/ai-interpretation.ts', 'services/ai-interpretation-mechanisms.ts'] },
  { key: 'rule_apis', label: 'Rule APIs', status: 'SUPPORTED', evidence: ['routes/ai-interpretation.ts', 'aixp_rules', 'aixp_prompt_links'] },
  { key: 'configuration_apis', label: 'Configuration APIs', status: 'SUPPORTED', evidence: ['routes/ai-interpretation.ts', 'aixp_policies', 'aixp_thresholds'] },
];

// Testing coverage (8). SUPPORTED = the runnable suite covers it; PARTIAL = a follow-on boundary (UI/e2e).
export const TESTING_COVERAGE: AixpControl[] = [
  { key: 'unit', label: 'Unit tests', status: 'SUPPORTED', evidence: ['tests/capadex-3.10-ai-interpretation.test.ts'] },
  { key: 'integration', label: 'Integration tests', status: 'SUPPORTED', evidence: ['tests/capadex-3.10-ai-interpretation.test.ts'] },
  { key: 'api', label: 'API tests', status: 'SUPPORTED', evidence: ['tests/capadex-3.10-ai-interpretation.test.ts'] },
  { key: 'interpretation', label: 'Interpretation tests', status: 'SUPPORTED', evidence: ['tests/capadex-3.10-ai-interpretation.test.ts'] },
  { key: 'explainability', label: 'Explainability tests', status: 'SUPPORTED', evidence: ['tests/capadex-3.10-ai-interpretation.test.ts'] },
  { key: 'confidence', label: 'Confidence tests', status: 'SUPPORTED', evidence: ['tests/capadex-3.10-ai-interpretation.test.ts'] },
  { key: 'hallucination', label: 'Hallucination-protection tests', status: 'SUPPORTED', evidence: ['tests/capadex-3.10-ai-interpretation.test.ts'] },
  { key: 'ui_e2e', label: 'UI / end-to-end tests (follow-on boundary — PARTIAL, not a gap)', status: 'PARTIAL', evidence: [] },
];

// Documentation set (7)
export const DOC_SET: AixpControl[] = [
  { key: 'architecture', label: 'Architecture', status: 'SUPPORTED', evidence: ['docs/AI_INTERPRETATION.md'] },
  { key: 'interpretation_library', label: 'Interpretation library', status: 'SUPPORTED', evidence: ['docs/AI_INTERPRETATION.md'] },
  { key: 'explainability_framework', label: 'Explainability framework', status: 'SUPPORTED', evidence: ['docs/AI_INTERPRETATION.md'] },
  { key: 'confidence_framework', label: 'Confidence framework', status: 'SUPPORTED', evidence: ['docs/AI_INTERPRETATION.md'] },
  { key: 'api_reference', label: 'API reference', status: 'SUPPORTED', evidence: ['docs/AI_INTERPRETATION.md'] },
  { key: 'admin_guide', label: 'Admin guide', status: 'SUPPORTED', evidence: ['docs/AI_INTERPRETATION.md'] },
  { key: 'release_notes', label: 'Release notes', status: 'SUPPORTED', evidence: ['docs/AI_INTERPRETATION.md'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// TRACEABILITY MODEL (9) — every interpretation must trace back to its full provenance chain
// ─────────────────────────────────────────────────────────────────────────────
export interface TraceRow { key: string; label: string; source: string; status: AixpStatus; note: string }
export const TRACEABILITY_MODEL: TraceRow[] = [
  { key: 'standardized_score', label: 'Standardized score', source: 'astd_standard_scores', status: 'SUPPORTED', note: 'The standardized score (3.8) interpreted — the interpretation input, carried on every run.' },
  { key: 'benchmark_result', label: 'Benchmark result', source: 'abmk_results (3.9)', status: 'SUPPORTED', note: 'The benchmark result (3.9) the interpretation contextualizes — carried on every run; null when no benchmark exists yet (honest null).' },
  { key: 'assessment_version', label: 'Assessment version', source: 'aixp_runs.assessment_version', status: 'SUPPORTED', note: 'The assessment version the interpreted score was produced against — carried on every run.' },
  { key: 'norm_version', label: 'Norm version', source: 'aint_norm_tables (3.7) + aixp_runs.norm_version', status: 'SUPPORTED', note: 'The norm reference (3.7) the score was standardized against — carried on every run.' },
  { key: 'standardization_version', label: 'Standardization version', source: 'astd_configs + aixp_runs.standardization_version', status: 'SUPPORTED', note: 'The versioned standardization config (3.8) applied — carried on every run.' },
  { key: 'benchmark_version', label: 'Benchmark version', source: 'abmk_configs (3.9) + aixp_runs.benchmark_version', status: 'SUPPORTED', note: 'The versioned benchmark config (3.9) applied — carried on every run.' },
  { key: 'rule_version', label: 'Rule version', source: 'aixp_rules.version + aixp_runs.rule_version', status: 'SUPPORTED', note: 'The interpretation rule (key + version) that fired — carried on every run.' },
  { key: 'prompt_version', label: 'Prompt version', source: 'aixp_prompt_links.version + aixp_runs.prompt_version', status: 'SUPPORTED', note: 'The prompt template (key + version) used for narration — carried on every run; null when narration is deterministic (honest null).' },
  { key: 'interpretation_version', label: 'Interpretation version', source: 'aixp_policies.version + aixp_runs.interpretation_version', status: 'SUPPORTED', note: 'The versioned interpretation policy applied — carried on every run.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// ELEVEN certification DIMENSIONS — evidence anchored in REUSED substrate + own overlay
// ─────────────────────────────────────────────────────────────────────────────
export const AIXP_DIMENSIONS: AixpDimension[] = [
  {
    key: 'ai_interpretation', label: 'AI Interpretation', status: 'SUPPORTED',
    statusNote: 'ONE canonical interpretation layer (aixp_runs) turning a standardized (3.8) + benchmarked (3.9) result into an interpreted result. The CORE is DETERMINISTIC — selectInterpretationRule (3.8 structured-AST condition, NO eval) + renderInterpretation (grounded {{token}} render). An OPTIONAL LLM narration (aiClient.checkAIHealth-gated, grounded-token-constrained) enhances phrasing and degrades honestly to deterministic + source-tagged on any failure. 7 interpretation KINDS are SUPPORTED (overall/domain/competency/behaviour/employability/leadership/readiness); the 3 finer KINDS (skill/learning/growth) are PARTIAL — depending on finer standardized input upstream / accumulated volume (GAP-AIXP-1), a breadth boundary NOT an engine gap. A composite interpretation index reuses the 3.8 structured-AST formula engine (no eval).',
    evidence: {
      services: ['services/ai-interpretation-mechanisms.ts', 'services/ai-interpretation-engine.ts', 'services/aiClient.ts', 'services/mei-narrative-engine.ts', 'services/score-standardization-mechanisms.ts', 'services/psychometric-standardization.ts'],
      routes: ['routes/ai-interpretation.ts'],
      frontend: ['components/ai-interpretation/AiInterpretationWorkbench.tsx'],
      tables: ['astd_standard_scores', 'abmk_results', 'aixp_runs', 'aixp_rules'],
    },
  },
  {
    key: 'explainability', label: 'Explainability', status: 'SUPPORTED',
    statusNote: 'Every interpretation carries a full explanation via composeExplanation — why (reasoning) / evidence basis / data sources / rule reference / score reference / benchmark reference / assessment reference / confidence rationale (8 facets). Each reference resolves to a real provenance value (verifyReferences); an absent reference (no benchmark yet) is an honest null, never fabricated.',
    evidence: {
      services: ['services/ai-interpretation-mechanisms.ts', 'services/ai-interpretation-engine.ts'],
      routes: ['routes/ai-interpretation.ts'],
      frontend: ['components/ai-interpretation/AiInterpretationWorkbench.tsx'],
      tables: ['aixp_runs'],
    },
  },
  {
    key: 'confidence', label: 'Confidence', status: 'SUPPORTED',
    statusNote: 'computeConfidence scores each interpretation from evidence completeness (fraction of required facets present → score + band), lists missing evidence, raises a human_review flag below the review threshold, and ABSTAINS below k_min / the confidence floor. Confidence ⟂ Coverage ⟂ Adoption — never composited. Confidence is COMPUTED, never guessed; null (unknown) ≠ 0.',
    evidence: {
      services: ['services/ai-interpretation-mechanisms.ts', 'services/ai-interpretation-engine.ts'],
      routes: ['routes/ai-interpretation.ts'],
      frontend: ['components/ai-interpretation/AiInterpretationWorkbench.tsx'],
      tables: ['aixp_runs', 'aixp_thresholds'],
    },
  },
  {
    key: 'hallucination_protection', label: 'Hallucination Protection', status: 'SUPPORTED',
    statusNote: 'The OPTIONAL LLM narration is constrained to a grounded-token whitelist; detectUnsupportedClaims scans output for facts not in the grounded set (any hit → deterministic fallback + human_review); verifyReferences confirms cited refs resolve; a deterministic fallback covers model-unavailable / validation-failure; and every output is source-tagged (ai | deterministic + ai_available + reason). No output is ever fabricated.',
    evidence: {
      services: ['services/ai-interpretation-mechanisms.ts', 'services/ai-interpretation-engine.ts', 'services/aiClient.ts'],
      routes: ['routes/ai-interpretation.ts'],
      frontend: ['components/ai-interpretation/AiInterpretationWorkbench.tsx'],
      tables: ['aixp_runs', 'aixp_prompt_links'],
    },
  },
  {
    key: 'rule_repository', label: 'Rule Repository', status: 'SUPPORTED',
    statusNote: 'ONE governed, versioned interpretation asset store: aixp_rules (kind + structured-AST condition + grounded template) + aixp_prompt_links (LLM prompt templates + grounded-token whitelist) + aixp_thresholds (confidence/review/k_min) + aixp_policies (scoped interpretation policies), each moving through draft→review→validate→approve→publish→archive→retire with append-only version history + rollback + audit (aixp_governance_log + aixp_audit_log). Scope precedence resolves the most-specific config. Never destructive.',
    evidence: {
      services: ['services/ai-interpretation-mechanisms.ts', 'services/ai-interpretation-engine.ts'],
      routes: ['routes/ai-interpretation.ts'],
      frontend: ['components/superadmin/AiInterpretationPanel.tsx'],
      tables: ['aixp_rules', 'aixp_prompt_links', 'aixp_thresholds', 'aixp_policies', 'aixp_governance_log', 'aixp_audit_log'],
    },
  },
  {
    key: 'super_admin', label: 'Super Admin', status: 'SUPPORTED',
    statusNote: 'Super-admin certification + management console (interpretation library / rule configuration / prompt management / threshold configuration / version manager / interpretation approval / audit console) nested in the competency-framework admin shell. Real populated rule/prompt volume is an ADOPTION axis (honest 0), not a coverage gap.',
    evidence: {
      services: [],
      routes: ['routes/ai-interpretation.ts'],
      frontend: ['components/superadmin/AiInterpretationPanel.tsx'],
      tables: [],
    },
  },
  {
    key: 'frontend', label: 'Frontend', status: 'SUPPORTED',
    statusNote: 'Interactive interpretation workbench (explanation viewer / confidence indicators / evidence explorer / rule-trace viewer / hallucination flags / interpretation dashboard) + super-admin console (interpretation library / version manager / audit console). Panels render REAL computed data — no fabricated interpretation; an empty / abstained result renders an honest empty/abstain state.',
    evidence: {
      services: [],
      routes: [],
      frontend: ['components/superadmin/AiInterpretationPanel.tsx', 'components/ai-interpretation/AiInterpretationWorkbench.tsx'],
      tables: [],
    },
  },
  {
    key: 'ux', label: 'UX', status: 'SUPPORTED',
    statusNote: 'Interactive filtering, drill-down, expandable explanations, confidence visualization, evidence linking, saved views (aixp_saved_views), responsive + accessible surfaces. Confidence / evidence visualizations render real computed data; non-finite / missing values are shown as honest empty, never fabricated.',
    evidence: {
      services: [],
      routes: [],
      frontend: ['components/ai-interpretation/AiInterpretationWorkbench.tsx'],
      tables: ['aixp_saved_views'],
    },
  },
  {
    key: 'apis', label: 'APIs', status: 'SUPPORTED',
    statusNote: 'interpretation / explainability / confidence / rule / configuration endpoints under /api/admin/ai-interpretation, composing the reused interpretation substrate + the aixp_* overlay. Read certifications are GET (to_regclass/fs probes); pure interpretation / explanation / confidence / hallucination-scan / composite computes are pure POSTs; overlay writes + governance transitions are flag-gated POSTs. The interpret endpoint returns an honest abstained / deterministic-fallback result when evidence is thin or the model is unavailable.',
    evidence: {
      services: ['services/ai-interpretation-engine.ts', 'services/ai-interpretation-mechanisms.ts'],
      routes: ['routes/ai-interpretation.ts'],
      frontend: [],
      tables: [],
    },
  },
  {
    key: 'testing', label: 'Testing', status: 'SUPPORTED',
    statusNote: 'A runnable interpretation test suite (tests/capadex-3.10-ai-interpretation.test.ts) covering rule selection (structured-AST condition), grounded token render, confidence scoring + abstention, unsupported-claim detection + reference verification (hallucination protection), deterministic fallback + source tagging, and structured-AST composite-index evaluation + validation (no eval), plus read-only engine composition against the live DB (INTEGRATION) — alongside the certification scan itself. UI / end-to-end / accessibility / performance test suites stay a follow-on boundary (PARTIAL), reported in-line, NOT a gap.',
    evidence: {
      services: [],
      routes: [],
      frontend: [],
      tables: [],
    },
  },
  {
    key: 'documentation', label: 'Documentation', status: 'SUPPORTED',
    statusNote: 'A documentation set (docs/AI_INTERPRETATION.md — architecture / interpretation library / explainability framework / confidence framework / API reference / admin guide / release notes) + the auto-generated deliverable pack (16 reports). An end-user (learner/candidate-facing) interpretation guide stays a follow-on boundary (PARTIAL), reported in-line, NOT a gap.',
    evidence: {
      services: [],
      routes: [],
      frontend: [],
      tables: [],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DO-NOT-IMPLEMENT boundaries (later-phase scope — declared so they are never mistaken for gaps)
// ─────────────────────────────────────────────────────────────────────────────
export interface AixpBoundary { key: string; label: string; owner: string; note: string }
export const INTERPRETATION_BOUNDARIES: AixpBoundary[] = [
  { key: 'recommendation_engine', label: 'Recommendation Engine', owner: 'later phase', note: 'Interpretation FEEDS recommendations; it does NOT generate them. Building a recommendation engine here is out of scope — a boundary, not a gap.' },
  { key: 'learning_path', label: 'Learning-Path Engine', owner: 'later phase', note: 'Interpretation of "what to learn" is present; authoring a learning path is out of scope — a boundary, not a gap.' },
  { key: 'growth_planning', label: 'Growth-Planning Engine', owner: 'later phase', note: 'Interpretation of growth is present; a growth-planning engine is out of scope — a boundary, not a gap.' },
  { key: 'report_generation', label: 'Report Generation', owner: 'later phase (report-factory)', note: 'Interpretation is a report INPUT; report generation / rendering is out of scope here — a boundary, not a gap.' },
  { key: 'dashboard_intelligence', label: 'Dashboard Intelligence', owner: 'later phase', note: 'Interpretation feeds dashboards; building dashboard intelligence is out of scope here — a boundary, not a gap.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FROZEN interpretation decisions (freeze invariants)
// ─────────────────────────────────────────────────────────────────────────────
export interface AixpDecision { id: string; title: string; decision: string }
export const AIXP_DECISIONS: AixpDecision[] = [
  { id: 'D1', title: 'Compose, never duplicate', decision: 'AI Interpretation COMPOSES the existing interpretation substrate (aiClient health-gated LLM seam + mei-narrative-engine rule-driven narration prior-art) + the pure 3.8 structured-AST formula engine + the pure psychometric transforms under one platform + an additive aixp_* overlay — NO duplicate AI / interpretation engine, NO V2, NO breaking change.' },
  { id: 'D2', title: 'Downstream of standardization + benchmarking', decision: 'Interpretation consumes the standardized scores (3.8) + benchmark results (3.9) + norm references (3.7). It NEVER re-scores, NEVER re-standardizes, NEVER re-benchmarks, NEVER builds a norm.' },
  { id: 'D3', title: 'Eleven dimensions certified SEPARATELY', decision: 'ai_interpretation · explainability · confidence · hallucination_protection · rule_repository · super_admin · frontend · ux · apis · testing · documentation are reported SEPARATELY and NEVER composited into a single score.' },
  { id: 'D4', title: 'Deterministic core, honest-degrading AI narration', decision: 'The interpretation CORE is deterministic (rule-select via 3.8 AST + grounded token render + confidence + explanation). The LLM narration is OPTIONAL: health-gated, grounded-token-constrained, output-validated (detectUnsupportedClaims + verifyReferences), and falls back to deterministic + source-tag on ANY failure. AI output is NEVER fabricated.' },
  { id: 'D5', title: 'Composite index is a STRUCTURED AST (no eval)', decision: 'The composite interpretation index reuses the 3.8 structured-AST formula engine (const/var/op/weighted/clamp/standardize nodes) evaluated by a whitelisted interpreter (evaluateFormula) — NEVER eval / new Function / string-executed. Formulas are validated before evaluation.' },
  { id: 'D6', title: 'ABSTAIN below floor; null ≠ 0', decision: 'Interpretation ABSTAINS below k_min real evidence / the confidence floor. Coverage ⟂ Confidence ⟂ Adoption are never composited. null (unknown) ≠ 0 (absent). Never fabricate.' },
  { id: 'D7', title: 'Governed & versioned, never destructive', decision: 'Every interpretation asset (rule / prompt / threshold / policy) moves through draft→review→validate→approve→publish→archive→retire with append-only version history + rollback + audit trail. Governance transitions are recorded, never destructive.' },
  { id: 'D8', title: 'Byte-identical OFF incl. schema', decision: 'All DDL runs only on the flag-gated write paths; read certifications are GET (to_regclass/fs probes) and pure computes are side-effect-free. OFF is byte-identical incl. schema (0 aixp_* tables).' },
  { id: 'D9', title: 'DO-NOT-IMPLEMENT boundaries', decision: 'Recommendation Engine, Learning-Path Engine, Growth-Planning Engine, Report Generation and Dashboard Intelligence are NOT built in 3.10 — interpretation FEEDS them. They are later-phase BOUNDARIES, never counted as gaps.' },
  { id: 'D10', title: 'Breadth is honest, never forced', decision: 'Fine-grained interpretation KINDS (finer standardized inputs upstream), some persona / lifecycle depth (authored volume) and longitudinal modes (accumulated volume) are PARTIAL / ADOPTION — reported SEPARATELY and in-line, never padded to 100%, never fabricated.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// GAPS — OPEN engineering gaps (honest breadth deferrals) + RESOLVED (via reuse-before-build)
// ─────────────────────────────────────────────────────────────────────────────
export interface AixpGap { id: string; severity: GapSeverity; axis: AixpAxis; title: string; detail: string }
export const AIXP_GAPS: AixpGap[] = [
  { id: 'GAP-AIXP-1', severity: 'Medium', axis: 'ai_interpretation', title: 'Fine-grained interpretation kinds PARTIAL', detail: 'skill / learning / growth interpretation depends on a finer-grained standardized input (skill / learning-outcome scores) that the upstream standardized substrate (3.5 / 3.6 / 3.8) does not uniformly expose, and on accumulated benchmark time-series VOLUME (growth); overall / domain / competency / behaviour / employability / leadership / readiness are SUPPORTED. Closing it depends on finer standardized inputs upstream + adoption, not the interpretation engine itself. PARTIAL, never MISSING.' },
  { id: 'GAP-AIXP-2', severity: 'Medium', axis: 'ai_interpretation', title: 'Persona / lifecycle interpretation depth PARTIAL', detail: 'HR-specific persona depth and the diagnose / recommend / transition / sustain lifecycle stages are reachable via the generic rule set but a first-class persona / stage-specific rule depth depends on authored rule volume + (for recommend) a DO-NOT-IMPLEMENT downstream boundary. Closing it is authoring / adoption, not a new engine.' },
  { id: 'GAP-AIXP-3', severity: 'Future', axis: 'ai_interpretation', title: 'Fine-tuned grounded interpretation model', detail: 'A domain fine-tuned grounded interpretation model (vs the deterministic core + grounded-token-constrained general LLM narration shipped today) is a Future enhancement; the deterministic + grounded + validated path is already correct and hallucination-protected, so a tuned model is additive, not a correctness gap.' },
];

export interface ResolvedAixpGap { id: string; severity: GapSeverity; axis: AixpAxis; title: string; resolution: string }
export const RESOLVED_AIXP_GAPS: ResolvedAixpGap[] = [
  { id: 'GAP-AIXP-R1', severity: 'High', axis: 'ai_interpretation', title: 'No canonical interpretation layer', resolution: 'ENGINEERING-CLOSED via reuse: aixp_runs + selectInterpretationRule (3.8 structured-AST condition, NO eval) + renderInterpretation (grounded {{token}} render) turning a standardized (3.8) + benchmarked (3.9) result into an interpreted result across 7 SUPPORTED interpretation kinds. ABSTAINS below the evidence floor.' },
  { id: 'GAP-AIXP-R2', severity: 'High', axis: 'explainability', title: 'No explanation / reasoning for interpretations', resolution: 'ENGINEERING-CLOSED: composeExplanation emitting why / evidence basis / data sources / rule / score / benchmark / assessment / confidence-rationale (8 facets) on every interpretation, with verifyReferences confirming each ref resolves.' },
  { id: 'GAP-AIXP-R3', severity: 'High', axis: 'confidence', title: 'No confidence scoring / abstention', resolution: 'ENGINEERING-CLOSED: computeConfidence scoring interpretations from evidence completeness (score + band + missing-evidence + human-review flag) and ABSTAINING below k_min / the confidence floor. null ≠ 0.' },
  { id: 'GAP-AIXP-R4', severity: 'High', axis: 'hallucination_protection', title: 'No hallucination protection on LLM output', resolution: 'ENGINEERING-CLOSED: grounded-token-constrained narration + detectUnsupportedClaims + verifyReferences + deterministic fallback (checkAIHealth-gated) + source tagging — no output is ever fabricated.' },
  { id: 'GAP-AIXP-R5', severity: 'Medium', axis: 'rule_repository', title: 'No governed / versioned interpretation rule store', resolution: 'ENGINEERING-CLOSED: aixp_rules + aixp_prompt_links + aixp_thresholds + aixp_policies + aixp_governance_log + aixp_audit_log + recordGovernanceTransition (draft→…→retire + version history + rollback + audit, never destructive) + scope-precedence config resolution.' },
  { id: 'GAP-AIXP-R6', severity: 'Medium', axis: 'apis', title: 'No interpretation / explainability / confidence / rule / configuration APIs', resolution: 'ENGINEERING-CLOSED: routes/ai-interpretation.ts exposing interpretation / explainability / confidence / rule / configuration endpoints (GET certifications, pure POST computes, flag-gated POST writes).' },
  { id: 'GAP-AIXP-R7', severity: 'Medium', axis: 'frontend', title: 'No interpretation console / workbench UI', resolution: 'ENGINEERING-CLOSED: AiInterpretationPanel (super-admin console) + AiInterpretationWorkbench (explanation viewer / confidence indicators / evidence explorer / rule-trace viewer / hallucination flags) nested in the competency-framework admin shell.' },
  { id: 'GAP-AIXP-R8', severity: 'Medium', axis: 'super_admin', title: 'No interpretation library / rule / prompt / threshold / version / approval / audit console', resolution: 'ENGINEERING-CLOSED: AiInterpretationPanel surfaces (interpretation library / rule configuration / prompt management / threshold configuration / version manager / approval / audit console).' },
  { id: 'GAP-AIXP-R9', severity: 'Low', axis: 'ux', title: 'No saved views / expandable explanations / drill-down', resolution: 'ENGINEERING-CLOSED: aixp_saved_views + saveView/listViews + workbench expandable explanations + drill-down + interactive filtering + evidence linking + confidence visualization.' },
  { id: 'GAP-AIXP-R10', severity: 'Low', axis: 'ai_interpretation', title: 'No composite interpretation index', resolution: 'ENGINEERING-CLOSED via reuse: evaluateInterpretationFormula reusing the 3.8 structured-AST formula engine (evaluateFormula/validateFormula — const/var/op/weighted/clamp/standardize, NO eval/new Function) to compose a weighted composite interpretation index, validated before evaluation.' },
];
