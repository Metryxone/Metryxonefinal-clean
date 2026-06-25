/**
 * MX-202B — lazy ensure-schema mirror of migrations/20260625_mx202b_competency_content.sql.
 * Idempotent (CREATE ... IF NOT EXISTS). Additive; creates NEW tables only. Reuses
 * onto_audit_logs + onto_competency_versions for audit/versioning (no new audit engine).
 */
import type { Pool } from 'pg';

let ensured = false;

export async function ensureMx202bContentSchema(pool: Pool): Promise<void> {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS onto_competency_content_drafts (
      id               BIGSERIAL PRIMARY KEY,
      competency_id    TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
      attribute_type   TEXT NOT NULL,
      proficiency_level INT NOT NULL DEFAULT 0 CHECK (proficiency_level BETWEEN 0 AND 5),
      content          JSONB NOT NULL,
      content_text     TEXT,
      provenance       TEXT NOT NULL DEFAULT 'rule_based',
      confidence       NUMERIC,
      confidence_band  TEXT,
      version          INT NOT NULL DEFAULT 1,
      status           TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','in_review','approved','rejected','archived')),
      needs_review     BOOLEAN NOT NULL DEFAULT TRUE,
      generator        TEXT,
      source           TEXT NOT NULL DEFAULT 'mx202b',
      reviewed_by      TEXT,
      reviewed_at      TIMESTAMPTZ,
      review_notes     TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_occd_dedup
      ON onto_competency_content_drafts (competency_id, attribute_type, proficiency_level, source);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_occd_comp   ON onto_competency_content_drafts (competency_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_occd_attr   ON onto_competency_content_drafts (attribute_type);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_occd_status ON onto_competency_content_drafts (status);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS onto_competency_evidence (
      id BIGSERIAL PRIMARY KEY,
      competency_id TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
      proficiency_level INT NOT NULL DEFAULT 0 CHECK (proficiency_level BETWEEN 0 AND 5),
      evidence TEXT NOT NULL, evidence_type TEXT,
      provenance TEXT NOT NULL DEFAULT 'rule_based', source TEXT NOT NULL DEFAULT 'mx202b',
      draft_id BIGINT REFERENCES onto_competency_content_drafts(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_oce_comp ON onto_competency_evidence (competency_id);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS onto_competency_learning_outcomes (
      id BIGSERIAL PRIMARY KEY,
      competency_id TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
      proficiency_level INT NOT NULL DEFAULT 0 CHECK (proficiency_level BETWEEN 0 AND 5),
      outcome TEXT NOT NULL, bloom_level TEXT,
      provenance TEXT NOT NULL DEFAULT 'rule_based', source TEXT NOT NULL DEFAULT 'mx202b',
      draft_id BIGINT REFERENCES onto_competency_content_drafts(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_oclo_comp ON onto_competency_learning_outcomes (competency_id);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS onto_competency_function_map (
      id BIGSERIAL PRIMARY KEY,
      competency_id TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
      function_id TEXT, function_name TEXT NOT NULL, relevance NUMERIC,
      provenance TEXT NOT NULL DEFAULT 'rule_based', source TEXT NOT NULL DEFAULT 'mx202b',
      draft_id BIGINT REFERENCES onto_competency_content_drafts(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_ocfm_comp ON onto_competency_function_map (competency_id);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS onto_competency_industry_map (
      id BIGSERIAL PRIMARY KEY,
      competency_id TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
      industry_id TEXT, industry_name TEXT NOT NULL, relevance NUMERIC,
      provenance TEXT NOT NULL DEFAULT 'rule_based', source TEXT NOT NULL DEFAULT 'mx202b',
      draft_id BIGINT REFERENCES onto_competency_content_drafts(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_ocim_comp ON onto_competency_industry_map (competency_id);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS onto_competency_department_map (
      id BIGSERIAL PRIMARY KEY,
      competency_id TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
      department_name TEXT NOT NULL, relevance NUMERIC,
      provenance TEXT NOT NULL DEFAULT 'rule_based', source TEXT NOT NULL DEFAULT 'mx202b',
      draft_id BIGINT REFERENCES onto_competency_content_drafts(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_ocdm_comp ON onto_competency_department_map (competency_id);`);

  // ── Controlled Enterprise Activation — Verified lifecycle (additive, reversible) ──
  await pool.query(`ALTER TABLE onto_competency_content_drafts ADD COLUMN IF NOT EXISTS governance_track TEXT NOT NULL DEFAULT 'expert_authored';`);
  await pool.query(`ALTER TABLE onto_competency_content_drafts ADD COLUMN IF NOT EXISTS verified_by TEXT;`);
  await pool.query(`ALTER TABLE onto_competency_content_drafts ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE onto_competency_content_drafts DROP CONSTRAINT IF EXISTS onto_competency_content_drafts_status_check;`);
  await pool.query(`ALTER TABLE onto_competency_content_drafts ADD CONSTRAINT onto_competency_content_drafts_status_check
      CHECK (status IN ('draft','in_review','verified','approved','rejected','archived'));`);
  for (const t of ['onto_competency_evidence', 'onto_competency_learning_outcomes', 'onto_competency_function_map', 'onto_competency_industry_map', 'onto_competency_department_map']) {
    await pool.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS lifecycle TEXT NOT NULL DEFAULT 'approved';`);
  }

  ensured = true;
}
