-- ============================================================
-- MX-302A — Career Launchpad & Experience Routing
-- Migration: 20260627_career_stage.sql
-- ============================================================
-- Adds a first-class career-stage field to the EXISTING career-seeker
-- profile table (one user = one record; no new user table). The structured
-- education/career profile captured at registration lives in the existing
-- career_seeker_profiles.data JSONB (under data.careerProfile), so only the
-- canonical stage gets its own column here.
--
-- Additive & reversible: the column is nullable with no default, so absent /
-- flag-OFF rows are byte-identical to today. A lazy ensure-schema mirror
-- (backend/services/experience-routing.ts -> ensureCareerStageColumn) applies
-- this same DDL at runtime, but ONLY on the flag-ON code path.
-- ============================================================

ALTER TABLE career_seeker_profiles
  ADD COLUMN IF NOT EXISTS career_stage TEXT;
