-- EP-98-W2 TIG calibration enhancements: E1 decision-time snapshot, E2 quality metrics,
-- E4 calibration method, E5 globally-pooled prior. Additive only; mirrors the lazy
-- ensure*Schema() ALTERs in employer-portal.ts / employer-tig.ts (no migration runner).

ALTER TABLE employer_candidates ADD COLUMN IF NOT EXISTS predicted_prob_at_decision FLOAT;
ALTER TABLE employer_candidates ADD COLUMN IF NOT EXISTS decision_at                TIMESTAMPTZ;

ALTER TABLE tig_calibration ADD COLUMN IF NOT EXISTS mean_predicted FLOAT;
ALTER TABLE tig_calibration ADD COLUMN IF NOT EXISTS prior_source   TEXT DEFAULT 'uninformative';
ALTER TABLE tig_calibration ADD COLUMN IF NOT EXISTS brier          FLOAT;
ALTER TABLE tig_calibration ADD COLUMN IF NOT EXISTS ece            FLOAT;
ALTER TABLE tig_calibration ADD COLUMN IF NOT EXISTS method         TEXT DEFAULT 'identity';
