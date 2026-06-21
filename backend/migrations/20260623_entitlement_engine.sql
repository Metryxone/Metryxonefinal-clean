-- Phase 6.4 — Entitlement Engine (Module Access)
-- Canonical migration mirroring the lazy `ensureModuleRegistry()` in
-- backend/services/wc7c/module-access-engine.ts. ADDITIVE + IDEMPOTENT: seeds the 7 product-module
-- rows into the pre-existing comm_features registry. No new tables, no destructive change.
--
-- These rows describe the 7 access-controlled product surfaces gated by FF_MODULE_ACCESS_CONTROL.
-- feature_class is left NULL (a module is not a metered feature class); metadata.kind='module'
-- distinguishes module rows from per-feature rows. sort_order 1000+ keeps modules after features.
--
-- NOTE: only runs when comm_features already exists (the commercial architecture schema owns its DDL).

DO $$
BEGIN
  IF to_regclass('public.comm_features') IS NOT NULL THEN
    INSERT INTO comm_features (code, name, feature_class, description, sort_order, metadata) VALUES
      ('competency_assessments', 'Competency Assessments', NULL,
       'Competency assessment authoring, runtime and scoring.', 1000,
       '{"kind":"module","surface":"individual"}'::jsonb),
      ('employability_index', 'Employability Index', NULL,
       'Employability Index (EI) profile, dimensions and trajectory.', 1001,
       '{"kind":"module","surface":"individual"}'::jsonb),
      ('career_builder', 'Career Builder', NULL,
       'Career intelligence: readiness, gap, match, roadmap and recommendations.', 1002,
       '{"kind":"module","surface":"individual"}'::jsonb),
      ('career_passport', 'Career Passport', NULL,
       'Portable verified career passport and shareable profile.', 1003,
       '{"kind":"module","surface":"individual"}'::jsonb),
      ('employer_portal', 'Employer Portal', NULL,
       'Employer hiring intelligence, candidate pools and postings.', 1004,
       '{"kind":"module","surface":"organization"}'::jsonb),
      ('analytics', 'Enterprise Analytics', NULL,
       'Enterprise analytics and reporting dashboards.', 1005,
       '{"kind":"module","surface":"organization"}'::jsonb),
      ('workforce_intelligence', 'Workforce Intelligence', NULL,
       'Workforce planning and organizational capability intelligence.', 1006,
       '{"kind":"module","surface":"organization"}'::jsonb)
    ON CONFLICT (code) DO NOTHING;
  END IF;
END $$;
