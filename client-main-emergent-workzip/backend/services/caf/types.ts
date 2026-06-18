// ============================================================
// Competency Assessment Factory (CAF) — TypeScript Types
// backend/services/caf/types.ts
// ============================================================

// ── Core enumerations ──────────────────────────────────────

export type AssessmentTypeCode =
  | 'behavioral'
  | 'functional'
  | 'cognitive'
  | 'leadership'
  | 'future_readiness';

export type QuestionType =
  | 'MCQ'
  | 'MULTI_SELECT'
  | 'LIKERT'
  | 'BARS_RATING'
  | 'SITUATIONAL_JUDGMENT'
  | 'SCENARIO_MCQ'
  | 'PRIORITIZATION'
  | 'DATA_INTERPRETATION'
  | 'OPEN_RUBRIC'
  | 'COMPARATIVE_JUDGMENT'
  | 'KNOWLEDGE_PROBE';

export type DifficultyTier   = 'easy' | 'medium' | 'hard';
export type LevelCode        = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
export type SessionStatus    = 'draft' | 'in_progress' | 'paused' | 'completed' | 'abandoned' | 'expired' | 'invalidated';
export type ScoringModel     = 'BARS_RUBRIC' | 'WEIGHTED_CTT' | 'IRT_3PL' | 'SJT_EXPERT' | 'DIMENSIONAL';
export type CalibrationStatus = 'uncalibrated' | 'pilot' | 'calibrated' | 'stable';
export type QualityFlag      = 'good' | 'review' | 'retire';
export type CognitiveLevel   = 'RECALL' | 'COMPREHENSION' | 'APPLICATION' | 'ANALYSIS' | 'SYNTHESIS' | 'EVALUATION';
export type RandomStrategy   = 'fixed' | 'stratified' | 'purely_random' | 'adaptive' | 'fixed_parallel';
export type ScenarioType     = 'situational_judgment' | 'case_study' | 'roleplay' | 'incident' | 'data_prompt';

// ── Question Framework ──────────────────────────────────────

export interface QuestionOption {
  id:              string;
  text:            string;
  score_value:     number;
  is_correct:      boolean | null;
  distractor_type: 'plausible' | 'common_error' | 'partial' | null;
  feedback:        string | null;
  sort_order:      number;
}

export interface BARSLevel {
  level:                  1 | 2 | 3 | 4 | 5;
  anchor:                 string;
  behavioral_indicators:  string[];
  score:                  number;        // 0–100 mapped score
}

export interface BARSRubric {
  levels: BARSLevel[];
}

export interface ExpertKey {
  best_option_scores:  Record<string, number>;   // option_key → score 0–4
  worst_option_scores: Record<string, number>;
}

export interface CAFQuestion {
  id:                BIGINT;
  assessment_type:   AssessmentTypeCode;
  question_type:     QuestionType;
  stem:              string;
  domain_code:       string;
  competency_id:     number | null;
  indicator_id:      number | null;
  scenario_id:       number | null;
  level_code:        LevelCode;
  difficulty_tier:   DifficultyTier;
  cognitive_level:   CognitiveLevel | null;
  polarity:          'positive' | 'negative';
  reverse_score:     boolean;
  is_anchor_item:    boolean;
  options?:          QuestionOption[];
  rubric?:           BARSRubric;
  expert_key?:       ExpertKey;
  importance_weight: number;
  irt_a:             number | null;
  irt_b:             number | null;
  irt_c:             number;
  calibration_status: CalibrationStatus;
  status:            'draft' | 'approved' | 'deprecated';
  is_active:         boolean;
}

type BIGINT = number;

// ── Scenario Framework ─────────────────────────────────────

export interface CAFScenario {
  id:                  number;
  code:                string;
  assessment_type:     AssessmentTypeCode;
  title:               string;
  context:             string;
  context_type:        ScenarioType;
  character_personas?: Array<{ name: string; role: string; context: string }>;
  domain_codes:        string[];
  difficulty_tier:     DifficultyTier;
  industry_tags:       string[];
  role_tags:           string[];
  media_refs:          { chart_url?: string; table_data?: Record<string, unknown>[]; document_excerpt?: string };
  word_count:          number | null;
  reading_time_seconds: number | null;
}

export interface ScenarioBranch {
  id:                       number;
  scenario_id:              number;
  source_question_id:       number | null;
  response_value_matches:   Record<string, unknown>;
  next_question_id:         number | null;
}

// ── Level Framework ────────────────────────────────────────

export interface LevelBandThresholds {
  L1: { min: number; max: number };
  L2: { min: number; max: number };
  L3: { min: number; max: number };
  L4: { min: number; max: number };
  L5: { min: number; max: number };
}

export interface LevelAnchor {
  framework_id:          number;
  assessment_type:       AssessmentTypeCode;
  level_code:            LevelCode;
  domain_code:           string;
  level_label:           string;
  anchor_text:           string;
  behavioral_indicators: string[];
  evidence_examples:     string[];
}

// ── Difficulty Framework ────────────────────────────────────

export interface TierDefinition {
  irt_b_min:     number;
  irt_b_max:     number;
  p_value_min:   number;
  p_value_max:   number;
}

export interface DifficultyCalibration {
  id:                      number;
  assessment_type:         AssessmentTypeCode;
  irt_model:               '1PL' | '2PL' | '3PL';
  tier_definitions:        Record<DifficultyTier, TierDefinition>;
  passing_thresholds:      Record<LevelCode, number>;
  default_difficulty_dist: Record<DifficultyTier, number>;
}

// ── Randomization Engine ────────────────────────────────────

export interface RandomizationRule {
  assessment_id:           number;
  strategy:                RandomStrategy;
  difficulty_distribution: Record<DifficultyTier, number>;
  ensure_coverage:         string[];          // domain_codes that must have ≥1 item
  seed_mode:               'session' | 'daily' | 'global';
  max_daily_exposure:      number;
  user_cooldown_days:      number;
  n_parallel_forms:        number;
  pool_groups:             Record<string, { domain_code: string; difficulty_tier: DifficultyTier; n: number }[]>;
}

export interface DrawnQuestion {
  question_id:      number;
  domain_code:      string;
  difficulty_tier:  DifficultyTier;
  position:         number;
  option_order:     string[] | null;    // shuffled option keys; null for non-MCQ
  scenario_id:      number | null;
  is_scenario_first: boolean;           // true = first question in a scenario group
}

export interface RandomizationInput {
  rule:              RandomizationRule;
  pool:              CAFQuestion[];
  session_state:     SessionState;
  user_context:      SessionContext;
  n_questions:       number;
}

// ── Assessment Builder ──────────────────────────────────────

export interface CAFAssessment {
  id:                  number;
  code:                string;
  assessment_type:     AssessmentTypeCode;
  level_framework_id:  number;
  label:               string;
  description:         string | null;
  instructions:        string | null;
  total_questions:     number;
  time_limit_seconds:  number | null;
  adaptive:            boolean;
  allow_review:        boolean;
  randomize_options:   boolean;
  domain_weights:      Record<string, number>;
  scoring_config:      ScoringConfig;
  language_policy:     LanguagePolicy;
  status:              'draft' | 'active' | 'retired';
  version:             number;
}

export interface ScoringConfig {
  // IRT (cognitive)
  irt_model?:              '1PL' | '2PL' | '3PL';
  theta_prior_mean?:       number;
  theta_prior_sd?:         number;
  stopping_se_threshold?:  number;
  min_questions_adaptive?: number;
  max_questions_adaptive?: number;
  // BARS/Rubric (behavioral, leadership)
  rubric_weight_by_domain?: Record<string, number>;
  // SJT (leadership)
  sjt_best_weight?:        number;
  sjt_worst_weight?:       number;
  // Dimensional (future_readiness)
  dimension_weights?:      Record<string, number>;
  // Universal
  domain_weight_overrides?: Record<string, number>;
  penalise_guessing:       boolean;
  partial_credit:          boolean;
}

export interface LanguagePolicy {
  allowed_terms?:    string[];
  disallowed_terms?: string[];
  tone?:             'developmental' | 'normative';
}

// ── Runtime Types ───────────────────────────────────────────

export interface SessionContext {
  current_role?:      string;
  target_role?:       string;
  industry?:          string;
  career_stage?:      string;
  experience_years?:  number;
  organisation?:      string;
  locale?:            string;
}

export interface AdaptiveState {
  theta:    number;         // current ability estimate
  se:       number;         // standard error
  history:  Array<{
    question_id: number;
    raw_score:   number;
    is_correct:  boolean | null;
  }>;
}

export interface SessionState {
  id:                string;   // UUID
  assessment_id:     number;
  user_id:           string;
  status:            SessionStatus;
  context:           SessionContext;
  question_order:    DrawnQuestion[];
  current_position:  number;
  adaptive_state:    AdaptiveState;
  pause_count:       number;
  time_spent_seconds: number;
  started_at:        Date | null;
  expires_at:        Date | null;
  flagged:           boolean;
}

// ── Response Types ──────────────────────────────────────────

export type ResponseValue =
  | { selected_option_id: string }                               // MCQ, SCENARIO_MCQ, DATA_INTERPRETATION
  | { selected_ids: string[] }                                   // MULTI_SELECT
  | { rating: 1 | 2 | 3 | 4 | 5 }                              // LIKERT
  | { level: 1 | 2 | 3 | 4 | 5; justification?: string }       // BARS_RATING
  | { best_id: string; worst_id: string }                       // SITUATIONAL_JUDGMENT
  | { rankings: Array<{ id: string; rank: number }> }           // PRIORITIZATION
  | { text: string }                                             // OPEN_RUBRIC
  | { preferred_id: string }                                    // COMPARATIVE_JUDGMENT
  | { answer: boolean; confidence: 1 | 2 | 3 | 4 | 5 }        // KNOWLEDGE_PROBE

export interface CAFResponse {
  id:                  number;
  session_id:          string;
  question_id:         number;
  sequence_position:   number;
  response_value:      ResponseValue;
  raw_score:           number | null;
  is_correct:          boolean | null;
  is_skipped:          boolean;
  is_revised:          boolean;
  first_response_value?: ResponseValue;
  time_taken_secs:     number | null;
  confidence_level:    number | null;
  flagged_for_review:  boolean;
}

export interface RespondRequest {
  question_id:     number;
  response_value:  ResponseValue;
  time_taken_secs: number;
  confidence?:     number;
  revised?:        boolean;
}

// ── Scoring Types ───────────────────────────────────────────

export interface DomainScore {
  domain_code:     string;
  raw_score:       number;
  scaled_score:    number;             // 0–100
  theta_estimate?: number;
  theta_se?:       number;
  percentile?:     number;
  confidence_tier?: string;
  level_code:      LevelCode;
  is_primary:      boolean;
}

export interface SessionScoreResult {
  session_id:     string;
  overall_score:  number;
  level_code:     LevelCode;
  domain_scores:  DomainScore[];
  theta_estimate?: number;
  theta_se?:       number;
  percentile?:    number;
  reliability?:   number;
  quality_tier?:  string;
  completeness:   number;              // 0–1
  is_complete:    boolean;
  scored_at:      Date;
}

// ── IRT Types ───────────────────────────────────────────────

export interface IRTItem {
  question_id: number;
  a:           number;
  b:           number;
  c:           number;
}

export interface EAPResult {
  theta: number;
  se:    number;
}

// ── Analytics Types ─────────────────────────────────────────

export interface ItemStats {
  question_id:          number;
  n_administered:       number;
  p_value:              number | null;
  point_biserial:       number | null;
  discrimination_index: number | null;
  distractor_analysis:  Record<string, { n_chosen: number; pct_chosen: number; point_biserial: number }>;
  mean_time_secs:       number | null;
  skip_rate:            number;
  revision_rate:        number;
  quality_flag:         QualityFlag;
  drift_detected:       boolean;
}

export interface PsychometricReport {
  assessment_id:          number;
  report_date:            string;
  n_sessions:             number;
  cronbachs_alpha:        number | null;
  mcdonalds_omega:        number | null;
  sem:                    number | null;
  domain_alphas:          Record<string, number>;
  kmo_measure:            number | null;
  n_factors_suggested:    number | null;
  floor_pct:              number | null;
  ceiling_pct:            number | null;
  theta_mean?:            number;
  theta_sd?:              number;
  dif_results:            Record<string, { mh_delta: number; category: 'A' | 'B' | 'C' }>;
  quality_advisory:       string[];
}

// ── Next Question Response ──────────────────────────────────

export interface NextQuestionResponse {
  session_id:           string;
  position:             number;
  total:                number;
  time_remaining_secs:  number | null;
  question: {
    id:              number;
    type:            QuestionType;
    stem:            string;
    options?:        Array<{ key: string; text: string }>;   // shuffled, score_value stripped
    rubric?:         BARSRubric;
    cognitive_level?: CognitiveLevel;
    difficulty_tier: DifficultyTier;
    domain_code:     string;
    scenario?:       {
      title:               string;
      context:             string;
      context_type:        ScenarioType;
      media_refs:          CAFScenario['media_refs'];
      reading_time_seconds: number | null;
      is_first_in_group:   boolean;
    } | null;
  };
  adaptive_state?: { theta: number; se: number };
}

// ── Builder Validation ──────────────────────────────────────

export interface BuilderValidationError {
  code:    string;
  message: string;
  field?:  string;
}

export interface PoolDepthReport {
  domain_code:      string;
  required:         number;
  available:        number;
  approved:         number;
  sufficient:       boolean;
  warning?:         string;
}
