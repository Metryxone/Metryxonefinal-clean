-- Phase 0 S7: Governance, audit & explainability layer
-- Adds reasoning column to capadex_recommendations so every generated
-- recommendation carries a plain-English explanation of why it was triggered.

ALTER TABLE capadex_recommendations
  ADD COLUMN IF NOT EXISTS reasoning text;
