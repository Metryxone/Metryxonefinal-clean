-- Phase 1 S7: Adaptive Assessment Runtime
-- (1) Adds four adaptive-engine columns to short_assessment_questions.
-- (2) Creates the adaptive_question_selections stats table.
-- (3) Seeds plausible values for existing questions.

-- ── 1. Extend short_assessment_questions ─────────────────────────────────────

ALTER TABLE short_assessment_questions
  ADD COLUMN IF NOT EXISTS behavioural_constructs JSONB   DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence_objectives    JSONB   DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS adaptive_priority      INTEGER DEFAULT 3
    CONSTRAINT saq_adaptive_priority_range CHECK (adaptive_priority BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS confidence_gain        NUMERIC DEFAULT 0.10
    CONSTRAINT saq_confidence_gain_range CHECK (confidence_gain >= 0 AND confidence_gain <= 1);

CREATE INDEX IF NOT EXISTS idx_saq_adaptive_priority ON short_assessment_questions(adaptive_priority);

-- ── 2. Stats tracking table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS adaptive_question_selections (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       TEXT          NOT NULL,
  question_id      TEXT          NOT NULL,    -- digit-string for SAQ, UUID for SDI
  question_code    TEXT,
  selection_reason TEXT          NOT NULL,
  adaptive_score   NUMERIC(6,4),
  confidence_gain  NUMERIC(5,4),              -- captured at selection time
  hypothesis_keys  JSONB         DEFAULT '[]'::jsonb,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aqs_session    ON adaptive_question_selections(session_id);
CREATE INDEX IF NOT EXISTS idx_aqs_question   ON adaptive_question_selections(question_id);
CREATE INDEX IF NOT EXISTS idx_aqs_created_at ON adaptive_question_selections(created_at DESC);

-- ── 3. Seed adaptive values for existing questions ───────────────────────────
--
-- adaptive_priority: Curiosity=2 (simple anchor questions), Insight=3,
--   Growth=4, Mastery=5 (complex synthesis questions).
--
-- confidence_gain: how much new evidence each question typically provides;
--   doubles for anchor questions (is_anchor=TRUE, capped at 1.0).
--
-- behavioural_constructs: derived from focus_area / layer / dimension keywords
--   mapped to canonical CAPADEX construct keys (see data/behavioural-constructs.ts).
--
-- evidence_objectives: intent of each question given its stage and anchor status.

UPDATE short_assessment_questions
SET
  adaptive_priority = CASE stage
    WHEN 'Curiosity' THEN 2
    WHEN 'Insight'   THEN 3
    WHEN 'Growth'    THEN 4
    WHEN 'Mastery'   THEN 5
    ELSE 3
  END,

  confidence_gain = LEAST(1.0, CASE stage
    WHEN 'Curiosity' THEN CASE WHEN is_anchor THEN 0.10 ELSE 0.05 END
    WHEN 'Insight'   THEN CASE WHEN is_anchor THEN 0.20 ELSE 0.10 END
    WHEN 'Growth'    THEN CASE WHEN is_anchor THEN 0.30 ELSE 0.15 END
    WHEN 'Mastery'   THEN CASE WHEN is_anchor THEN 0.40 ELSE 0.20 END
    ELSE 0.10
  END),

  behavioural_constructs = CASE
    WHEN COALESCE(focus_area,'') ILIKE '%attention%'
      OR COALESCE(layer,'')      ILIKE '%attention%'
      OR COALESCE(dimension,'')  ILIKE '%attention%'
      THEN '["ATTENTION_REGULATION","EXECUTIVE_FUNCTION"]'::jsonb

    WHEN COALESCE(focus_area,'') ILIKE '%executive%'
      OR COALESCE(layer,'')      ILIKE '%executive%'
      OR COALESCE(dimension,'')  ILIKE '%executive%'
      THEN '["EXECUTIVE_FUNCTION","PROCRASTINATION"]'::jsonb

    WHEN COALESCE(focus_area,'') ILIKE '%impulse%'
      OR COALESCE(layer,'')      ILIKE '%impulse%'
      OR COALESCE(dimension,'')  ILIKE '%impulse%'
      THEN '["IMPULSE_CONTROL","SELF_REGULATION"]'::jsonb

    WHEN COALESCE(focus_area,'') ILIKE '%emotion%'
      OR COALESCE(layer,'')      ILIKE '%emotion%'
      OR COALESCE(dimension,'')  ILIKE '%emotion%'
      THEN '["EMOTIONAL_REGULATION","SELF_AWARENESS"]'::jsonb

    WHEN COALESCE(focus_area,'') ILIKE '%anxiety%'
      OR COALESCE(layer,'')      ILIKE '%anxiety%'
      OR COALESCE(focus_area,'') ILIKE '%stress%'
      OR COALESCE(layer,'')      ILIKE '%stress%'
      THEN '["ANXIETY","STRESS_RESPONSE"]'::jsonb

    WHEN COALESCE(focus_area,'') ILIKE '%motivation%'
      OR COALESCE(layer,'')      ILIKE '%motivation%'
      OR COALESCE(dimension,'')  ILIKE '%motivation%'
      THEN '["MOTIVATION","GOAL_SETTING"]'::jsonb

    WHEN COALESCE(focus_area,'') ILIKE '%social%'
      OR COALESCE(layer,'')      ILIKE '%social%'
      OR COALESCE(dimension,'')  ILIKE '%peer%'
      THEN '["SOCIAL_SKILLS","PEER_PRESSURE"]'::jsonb

    WHEN COALESCE(focus_area,'') ILIKE '%resilience%'
      OR COALESCE(layer,'')      ILIKE '%resilience%'
      THEN '["RESILIENCE","HABIT_FORMATION"]'::jsonb

    WHEN COALESCE(focus_area,'') ILIKE '%digital%'
      OR COALESCE(layer,'')      ILIKE '%digital%'
      OR COALESCE(focus_area,'') ILIKE '%screen%'
      THEN '["DIGITAL_WELLNESS","IMPULSE_CONTROL"]'::jsonb

    WHEN COALESCE(focus_area,'') ILIKE '%sleep%'
      OR COALESCE(layer,'')      ILIKE '%sleep%'
      THEN '["HABIT_FORMATION","SELF_REGULATION"]'::jsonb

    WHEN COALESCE(focus_area,'') ILIKE '%self.esteem%'
      OR COALESCE(focus_area,'') ILIKE '%self-esteem%'
      OR COALESCE(layer,'')      ILIKE '%esteem%'
      THEN '["SELF_ESTEEM","SELF_AWARENESS"]'::jsonb

    WHEN COALESCE(focus_area,'') ILIKE '%career%'
      OR COALESCE(dimension,'')  ILIKE '%career%'
      THEN '["CAREER_CLARITY","GOAL_SETTING"]'::jsonb

    WHEN COALESCE(focus_area,'') ILIKE '%academic%'
      OR COALESCE(focus_area,'') ILIKE '%study%'
      OR COALESCE(layer,'')      ILIKE '%academic%'
      THEN '["ACADEMIC_PERFORMANCE","EXECUTIVE_FUNCTION"]'::jsonb

    WHEN COALESCE(focus_area,'') ILIKE '%procrastinat%'
      OR COALESCE(layer,'')      ILIKE '%procrastinat%'
      THEN '["PROCRASTINATION","IMPULSE_CONTROL"]'::jsonb

    WHEN COALESCE(focus_area,'') ILIKE '%memory%'
      OR COALESCE(layer,'')      ILIKE '%memory%'
      THEN '["WORKING_MEMORY","ATTENTION_REGULATION"]'::jsonb

    ELSE '["SELF_AWARENESS","EMOTIONAL_REGULATION"]'::jsonb
  END,

  evidence_objectives = CASE
    WHEN is_anchor AND stage = 'Curiosity'
      THEN '["baseline_evidence","construct_anchor","initial_calibration"]'::jsonb
    WHEN is_anchor
      THEN '["construct_anchor","synthesis_evidence","stage_calibration"]'::jsonb
    WHEN stage = 'Curiosity'
      THEN '["descriptive_evidence","surface_behaviour"]'::jsonb
    WHEN stage = 'Insight'
      THEN '["root_cause_evidence","pattern_evidence","trigger_identification"]'::jsonb
    WHEN stage = 'Growth'
      THEN '["growth_readiness","behavioural_change","coping_strategy"]'::jsonb
    WHEN stage = 'Mastery'
      THEN '["mastery_evidence","resilience_evidence","sustained_change"]'::jsonb
    ELSE '["descriptive_evidence"]'::jsonb
  END

WHERE behavioural_constructs = '[]'::jsonb
   OR behavioural_constructs IS NULL;
