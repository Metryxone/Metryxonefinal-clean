/**
 * MX-203 — lazy ensure-schema mirror of migrations/20260626_mx203_knowledge_content.sql.
 *
 * Additive ONLY: creates THREE new canonical home tables for the new expert-authored attribute
 * types (coaching_guidance / interview_guidance / development_activity). They stay EMPTY until a
 * human approves a draft via mx202b-content-approval.approveContentDraft (the single promotion
 * path). observable_behaviour + proficiency_anchor reuse onto_indicators (already wired). Reuses
 * onto_competency_content_drafts (staging), onto_audit_logs, onto_competency_versions — NO new
 * audit/version/staging engine. Idempotent (CREATE ... IF NOT EXISTS). Reversible (DROP TABLE).
 */
import type { Pool } from 'pg';
import { ensureMx202bContentSchema } from './mx202b-content-schema';

let ensured = false;

export async function ensureMx203ContentSchema(pool: Pool): Promise<void> {
  if (ensured) return;
  // Staging table + the MX-202B homes must exist first (drafts FK into the staging table).
  await ensureMx202bContentSchema(pool);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS onto_competency_coaching_guidance (
      id                BIGSERIAL PRIMARY KEY,
      competency_id     TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
      proficiency_level INT NOT NULL DEFAULT 0 CHECK (proficiency_level BETWEEN 0 AND 5),
      guidance          TEXT NOT NULL,
      provenance        TEXT NOT NULL DEFAULT 'rule_based',
      source            TEXT NOT NULL DEFAULT 'mx203',
      lifecycle         TEXT NOT NULL DEFAULT 'approved',
      draft_id          BIGINT REFERENCES onto_competency_content_drafts(id) ON DELETE SET NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_occg_comp ON onto_competency_coaching_guidance (competency_id);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS onto_competency_interview_guidance (
      id                BIGSERIAL PRIMARY KEY,
      competency_id     TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
      proficiency_level INT NOT NULL DEFAULT 0 CHECK (proficiency_level BETWEEN 0 AND 5),
      guidance          TEXT NOT NULL,
      provenance        TEXT NOT NULL DEFAULT 'rule_based',
      source            TEXT NOT NULL DEFAULT 'mx203',
      lifecycle         TEXT NOT NULL DEFAULT 'approved',
      draft_id          BIGINT REFERENCES onto_competency_content_drafts(id) ON DELETE SET NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_ociv_comp ON onto_competency_interview_guidance (competency_id);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS onto_competency_development_activity (
      id                BIGSERIAL PRIMARY KEY,
      competency_id     TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
      proficiency_level INT NOT NULL DEFAULT 0 CHECK (proficiency_level BETWEEN 0 AND 5),
      activity          TEXT NOT NULL,
      provenance        TEXT NOT NULL DEFAULT 'rule_based',
      source            TEXT NOT NULL DEFAULT 'mx203',
      lifecycle         TEXT NOT NULL DEFAULT 'approved',
      draft_id          BIGINT REFERENCES onto_competency_content_drafts(id) ON DELETE SET NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_ocda_comp ON onto_competency_development_activity (competency_id);`);

  ensured = true;
}

/** The three MX-203 canonical home tables (for read-only probes / certifier). */
export const MX203_HOME_TABLES = [
  'onto_competency_coaching_guidance',
  'onto_competency_interview_guidance',
  'onto_competency_development_activity',
] as const;
