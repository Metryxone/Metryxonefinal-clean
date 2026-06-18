-- Adaptive Questioning (Phase B, T8) — extend contradiction_events.contradiction_type
-- to allow the three named cross-trait contradiction pairs detected during the
-- adaptive runtime:
--   confidence_avoidance           (high confidence + high avoidance)
--   perfectionism_rapid_execution  (high perfectionism + rapid execution)
--   confidence_performance_gap     (low confidence + strong performance)
--
-- Additive + idempotent: drops and re-creates the CHECK constraint so the new
-- types are accepted alongside the original four. No existing rows change. The
-- adaptive engine only writes these types when the `adaptiveQuestioning` flag is
-- ON, so flag-off runtimes never depend on this migration.

ALTER TABLE contradiction_events
  DROP CONSTRAINT IF EXISTS contradiction_events_contradiction_type_check;

ALTER TABLE contradiction_events
  ADD CONSTRAINT contradiction_events_contradiction_type_check
  CHECK (contradiction_type IN (
    'score_reversal',
    'emotional_masking',
    'self_perception_bias',
    'defensive_answering',
    'confidence_avoidance',
    'perfectionism_rapid_execution',
    'confidence_performance_gap'
  ));
