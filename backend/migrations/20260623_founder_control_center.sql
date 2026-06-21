-- Phase 6.15 — Founder Control Center
-- Mirrors backend/services/founder-control-center/founder-control-center-schema.ts
-- Append-only snapshot audit trail for the founder posture. The console is otherwise READ-ONLY:
-- all GET routes compose live source tables and write nothing. This DDL is reached ONLY via the
-- explicit POST /api/admin/founder-control-center/console/setup write path (flag-gated, default OFF).

CREATE TABLE IF NOT EXISTS founder_control_center_snapshots (
  id           BIGSERIAL PRIMARY KEY,
  captured_by  TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  degraded     BOOLEAN NOT NULL DEFAULT false,
  dashboard    JSONB NOT NULL DEFAULT '{}'::jsonb,
  executive    JSONB NOT NULL DEFAULT '{}'::jsonb,
  strategic    JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fcc_snapshots_generated_at ON founder_control_center_snapshots (generated_at DESC);
