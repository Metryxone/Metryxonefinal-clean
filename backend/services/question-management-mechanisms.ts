/**
 * CAPADEX 3.0 — Program 3 · Phase 3.2 Enterprise Question Management Platform
 * ───────────────────────────────────────────────────────────────────────────
 * REUSE-BEFORE-BUILD engineering-closure mechanisms. These are the ONLY DDL sites in Phase 3.2 and
 * they run ONLY when the flag is ON (ensureQmpSchema asserts the flag internally) — so flag OFF is
 * byte-identical incl. schema (0 tables). Everything here is ADDITIVE + reversible:
 *   - qmp_question_metadata — the ONE canonical metadata overlay (unifies existing sources, no migration)
 *   - qmp_question_versions — append-only version history (compare/rollback/clone/fork/merge)
 *   - qmp_collections       — library collections/folders (reference-unifies existing banks)
 *   - qmp_saved_searches    — saved searches
 *   - qmp_bulk_jobs         — bulk-operation ledger (import/export/tag/status/review)
 *   - qmp_workflow          — review → approve → publish audit ledger (the additive lifecycle states)
 *
 * None of these fork the canonical registry (capadex_question_registry) — they OVERLAY it. The
 * registry integer version stays the baseline pointer; qmp_question_versions snapshots content so
 * rollback/compare are lossless. Never throws destructively; readers return null on error (null ≠ 0).
 */
import type { Pool } from 'pg';
import { isQuestionManagementPlatformEnabled } from '../config/feature-flags';

export class QmpFlagDisabledError extends Error {
  constructor() {
    super('question_management_platform_disabled');
    this.name = 'QmpFlagDisabledError';
  }
}

function assertEnabled(): void {
  if (!isQuestionManagementPlatformEnabled()) throw new QmpFlagDisabledError();
}

let schemaReady = false;

/**
 * Ensure the qmp_* overlay schema. ASSERTS the flag first → OFF creates 0 tables (byte-identical OFF).
 * Idempotent (CREATE TABLE IF NOT EXISTS). All DDL is confined to this function.
 */
export async function ensureQmpSchema(pool: Pool): Promise<void> {
  assertEnabled();
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS qmp_question_metadata (
      question_id       TEXT PRIMARY KEY,
      library_scope     TEXT,
      external_ref      TEXT,
      bloom_level       TEXT,
      cognitive_load    TEXT,
      persona           TEXT,
      tags              JSONB,
      keywords          JSONB,
      marks             NUMERIC(8,2),
      weight            NUMERIC(8,4),
      discrimination    NUMERIC(6,4),
      owner             TEXT,
      author            TEXT,
      source_provenance TEXT,
      extra             JSONB,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_qmp_meta_scope ON qmp_question_metadata (library_scope)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_qmp_meta_owner ON qmp_question_metadata (owner)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS qmp_question_versions (
      id             BIGSERIAL PRIMARY KEY,
      question_id    TEXT NOT NULL,
      version        INTEGER NOT NULL,
      major          INTEGER NOT NULL DEFAULT 1,
      minor          INTEGER NOT NULL DEFAULT 0,
      branch         TEXT NOT NULL DEFAULT 'main',
      parent_version INTEGER,
      change_kind    TEXT NOT NULL DEFAULT 'edit',
      content        JSONB,
      author         TEXT,
      note           TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_qmp_ver_qid ON qmp_question_versions (question_id, version)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_qmp_ver_branch ON qmp_question_versions (question_id, branch)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS qmp_collections (
      id          BIGSERIAL PRIMARY KEY,
      slug        TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      kind        TEXT NOT NULL DEFAULT 'collection',
      library_scope TEXT,
      description TEXT,
      member_ids  JSONB,
      owner       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS qmp_saved_searches (
      id          BIGSERIAL PRIMARY KEY,
      slug        TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      query       JSONB NOT NULL,
      owner       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS qmp_bulk_jobs (
      id          BIGSERIAL PRIMARY KEY,
      job_type    TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'queued',
      total       INTEGER NOT NULL DEFAULT 0,
      processed   INTEGER NOT NULL DEFAULT 0,
      failed      INTEGER NOT NULL DEFAULT 0,
      params      JSONB,
      result      JSONB,
      requested_by TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS qmp_workflow (
      id           BIGSERIAL PRIMARY KEY,
      question_id  TEXT NOT NULL,
      from_state   TEXT,
      to_state     TEXT NOT NULL,
      action       TEXT NOT NULL,
      actor        TEXT,
      note         TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_qmp_wf_qid ON qmp_workflow (question_id, created_at)`);

  schemaReady = true;
}

// ─── null-safe read helpers (null ≠ 0) ──────────────────────────────────────
async function count(pool: Pool, sql: string, params: unknown[] = []): Promise<number | null> {
  try {
    const { rows } = await pool.query(sql, params);
    const n = rows[0] ? Number(Object.values(rows[0])[0]) : 0;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

// ─────────────────────────── METADATA ───────────────────────────────────────
export interface MetadataInput {
  question_id: string;
  library_scope?: string;
  external_ref?: string;
  bloom_level?: string;
  cognitive_load?: string;
  persona?: string;
  tags?: unknown;
  keywords?: unknown;
  marks?: number;
  weight?: number;
  discrimination?: number;
  owner?: string;
  author?: string;
  source_provenance?: string;
  extra?: unknown;
}

export async function upsertMetadata(pool: Pool, input: MetadataInput): Promise<{ question_id: string }> {
  assertEnabled();
  await ensureQmpSchema(pool);
  await pool.query(
    `INSERT INTO qmp_question_metadata
       (question_id, library_scope, external_ref, bloom_level, cognitive_load, persona,
        tags, keywords, marks, weight, discrimination, owner, author, source_provenance, extra, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13,$14,$15::jsonb, NOW())
     ON CONFLICT (question_id) DO UPDATE SET
       library_scope=COALESCE(EXCLUDED.library_scope, qmp_question_metadata.library_scope),
       external_ref=COALESCE(EXCLUDED.external_ref, qmp_question_metadata.external_ref),
       bloom_level=COALESCE(EXCLUDED.bloom_level, qmp_question_metadata.bloom_level),
       cognitive_load=COALESCE(EXCLUDED.cognitive_load, qmp_question_metadata.cognitive_load),
       persona=COALESCE(EXCLUDED.persona, qmp_question_metadata.persona),
       tags=COALESCE(EXCLUDED.tags, qmp_question_metadata.tags),
       keywords=COALESCE(EXCLUDED.keywords, qmp_question_metadata.keywords),
       marks=COALESCE(EXCLUDED.marks, qmp_question_metadata.marks),
       weight=COALESCE(EXCLUDED.weight, qmp_question_metadata.weight),
       discrimination=COALESCE(EXCLUDED.discrimination, qmp_question_metadata.discrimination),
       owner=COALESCE(EXCLUDED.owner, qmp_question_metadata.owner),
       author=COALESCE(EXCLUDED.author, qmp_question_metadata.author),
       source_provenance=COALESCE(EXCLUDED.source_provenance, qmp_question_metadata.source_provenance),
       extra=COALESCE(EXCLUDED.extra, qmp_question_metadata.extra),
       updated_at=NOW()`,
    [
      input.question_id, input.library_scope ?? null, input.external_ref ?? null, input.bloom_level ?? null,
      input.cognitive_load ?? null, input.persona ?? null,
      input.tags != null ? JSON.stringify(input.tags) : null,
      input.keywords != null ? JSON.stringify(input.keywords) : null,
      input.marks ?? null, input.weight ?? null, input.discrimination ?? null,
      input.owner ?? null, input.author ?? null, input.source_provenance ?? null,
      input.extra != null ? JSON.stringify(input.extra) : null,
    ],
  );
  return { question_id: input.question_id };
}

export async function metadataCoverage(pool: Pool): Promise<{ rows: number | null; owned: number | null; tagged: number | null }> {
  return {
    rows: await count(pool, `SELECT COUNT(*)::int FROM qmp_question_metadata`),
    owned: await count(pool, `SELECT COUNT(*)::int FROM qmp_question_metadata WHERE owner IS NOT NULL`),
    tagged: await count(pool, `SELECT COUNT(*)::int FROM qmp_question_metadata WHERE tags IS NOT NULL`),
  };
}

// ─────────────────────────── VERSIONS ───────────────────────────────────────
export interface VersionInput {
  question_id: string;
  content?: unknown;
  change_kind?: 'edit' | 'major' | 'minor' | 'clone' | 'fork' | 'merge' | 'rollback';
  branch?: string;
  author?: string;
  note?: string;
}

async function latestVersion(pool: Pool, questionId: string, branch = 'main'): Promise<{ version: number; major: number; minor: number } | null> {
  const { rows } = await pool.query(
    `SELECT version, major, minor FROM qmp_question_versions WHERE question_id=$1 AND branch=$2 ORDER BY version DESC LIMIT 1`,
    [questionId, branch],
  );
  return rows[0] ? { version: Number(rows[0].version), major: Number(rows[0].major), minor: Number(rows[0].minor) } : null;
}

export async function snapshotVersion(pool: Pool, input: VersionInput): Promise<{ question_id: string; version: number; major: number; minor: number; branch: string }> {
  assertEnabled();
  await ensureQmpSchema(pool);
  const branch = input.branch || 'main';
  const prev = await latestVersion(pool, input.question_id, branch);
  const kind = input.change_kind || 'edit';
  let major = prev?.major ?? 1;
  let minor = prev?.minor ?? 0;
  if (!prev) { major = 1; minor = 0; }
  else if (kind === 'major') { major += 1; minor = 0; }
  else { minor += 1; }
  const version = (prev?.version ?? 0) + 1;
  await pool.query(
    `INSERT INTO qmp_question_versions (question_id, version, major, minor, branch, parent_version, change_kind, content, author, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`,
    [input.question_id, version, major, minor, branch, prev?.version ?? null, kind,
      input.content != null ? JSON.stringify(input.content) : null, input.author ?? null, input.note ?? null],
  );
  return { question_id: input.question_id, version, major, minor, branch };
}

export async function listVersions(pool: Pool, questionId: string): Promise<unknown[]> {
  const { rows } = await pool.query(
    `SELECT version, major, minor, branch, change_kind, author, note, created_at
       FROM qmp_question_versions WHERE question_id=$1 ORDER BY version DESC`,
    [questionId],
  );
  return rows;
}

export async function compareVersions(pool: Pool, questionId: string, a: number, b: number): Promise<{ a: unknown; b: unknown; changed_keys: string[] }> {
  const { rows } = await pool.query(
    `SELECT version, content FROM qmp_question_versions WHERE question_id=$1 AND version = ANY($2::int[])`,
    [questionId, [a, b]],
  );
  const av = rows.find((r) => Number(r.version) === a)?.content ?? {};
  const bv = rows.find((r) => Number(r.version) === b)?.content ?? {};
  const keys = new Set([...Object.keys(av || {}), ...Object.keys(bv || {})]);
  const changed_keys = [...keys].filter((k) => JSON.stringify((av || {})[k]) !== JSON.stringify((bv || {})[k]));
  return { a: av, b: bv, changed_keys };
}

export async function rollbackVersion(pool: Pool, questionId: string, toVersion: number, author?: string): Promise<{ question_id: string; version: number }> {
  assertEnabled();
  await ensureQmpSchema(pool);
  const { rows } = await pool.query(
    `SELECT content FROM qmp_question_versions WHERE question_id=$1 AND version=$2 LIMIT 1`,
    [questionId, toVersion],
  );
  if (!rows[0]) throw new Error('version_not_found');
  const snap = await snapshotVersion(pool, {
    question_id: questionId, content: rows[0].content, change_kind: 'rollback', author,
    note: `rollback to v${toVersion}`,
  });
  return { question_id: questionId, version: snap.version };
}

export async function cloneQuestion(pool: Pool, sourceId: string, newId: string, author?: string): Promise<{ question_id: string; version: number }> {
  assertEnabled();
  await ensureQmpSchema(pool);
  const { rows } = await pool.query(
    `SELECT content FROM qmp_question_versions WHERE question_id=$1 ORDER BY version DESC LIMIT 1`,
    [sourceId],
  );
  const snap = await snapshotVersion(pool, {
    question_id: newId, content: rows[0]?.content ?? {}, change_kind: 'clone', author, note: `cloned from ${sourceId}`,
  });
  return { question_id: newId, version: snap.version };
}

export async function forkQuestion(pool: Pool, questionId: string, branch: string, author?: string): Promise<{ question_id: string; branch: string; version: number }> {
  assertEnabled();
  await ensureQmpSchema(pool);
  const { rows } = await pool.query(
    `SELECT content FROM qmp_question_versions WHERE question_id=$1 AND branch='main' ORDER BY version DESC LIMIT 1`,
    [questionId],
  );
  const snap = await snapshotVersion(pool, {
    question_id: questionId, content: rows[0]?.content ?? {}, change_kind: 'fork', branch, author, note: `fork ${branch}`,
  });
  return { question_id: questionId, branch, version: snap.version };
}

export async function mergeVersion(pool: Pool, questionId: string, fromBranch: string, author?: string): Promise<{ question_id: string; version: number }> {
  assertEnabled();
  await ensureQmpSchema(pool);
  const { rows } = await pool.query(
    `SELECT content FROM qmp_question_versions WHERE question_id=$1 AND branch=$2 ORDER BY version DESC LIMIT 1`,
    [questionId, fromBranch],
  );
  if (!rows[0]) throw new Error('branch_not_found');
  const snap = await snapshotVersion(pool, {
    question_id: questionId, content: rows[0].content, change_kind: 'merge', branch: 'main', author, note: `merge ${fromBranch} → main`,
  });
  return { question_id: questionId, version: snap.version };
}

export async function versionCoverage(pool: Pool): Promise<{ versioned_questions: number | null; total_versions: number | null; branches: number | null }> {
  return {
    versioned_questions: await count(pool, `SELECT COUNT(DISTINCT question_id)::int FROM qmp_question_versions`),
    total_versions: await count(pool, `SELECT COUNT(*)::int FROM qmp_question_versions`),
    branches: await count(pool, `SELECT COUNT(DISTINCT branch)::int FROM qmp_question_versions`),
  };
}

// ─────────────────────────── COLLECTIONS ────────────────────────────────────
export async function createCollection(pool: Pool, input: { slug: string; name: string; kind?: string; library_scope?: string; description?: string; member_ids?: string[]; owner?: string }): Promise<{ slug: string }> {
  assertEnabled();
  await ensureQmpSchema(pool);
  await pool.query(
    `INSERT INTO qmp_collections (slug, name, kind, library_scope, description, member_ids, owner, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7, NOW())
     ON CONFLICT (slug) DO UPDATE SET
       name=EXCLUDED.name, kind=EXCLUDED.kind, library_scope=EXCLUDED.library_scope,
       description=EXCLUDED.description, member_ids=EXCLUDED.member_ids, owner=EXCLUDED.owner, updated_at=NOW()`,
    [input.slug, input.name, input.kind || 'collection', input.library_scope ?? null, input.description ?? null,
      JSON.stringify(input.member_ids ?? []), input.owner ?? null],
  );
  return { slug: input.slug };
}

export async function listCollections(pool: Pool): Promise<unknown[]> {
  const { rows } = await pool.query(`SELECT slug, name, kind, library_scope, description, member_ids, owner, updated_at FROM qmp_collections ORDER BY updated_at DESC`);
  return rows;
}

export async function collectionCoverage(pool: Pool): Promise<{ collections: number | null; scopes: number | null }> {
  return {
    collections: await count(pool, `SELECT COUNT(*)::int FROM qmp_collections`),
    scopes: await count(pool, `SELECT COUNT(DISTINCT library_scope)::int FROM qmp_collections WHERE library_scope IS NOT NULL`),
  };
}

// ─────────────────────────── SAVED SEARCHES ─────────────────────────────────
export async function saveSearch(pool: Pool, input: { slug: string; name: string; query: unknown; owner?: string }): Promise<{ slug: string }> {
  assertEnabled();
  await ensureQmpSchema(pool);
  await pool.query(
    `INSERT INTO qmp_saved_searches (slug, name, query, owner) VALUES ($1,$2,$3::jsonb,$4)
     ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, query=EXCLUDED.query, owner=EXCLUDED.owner`,
    [input.slug, input.name, JSON.stringify(input.query ?? {}), input.owner ?? null],
  );
  return { slug: input.slug };
}

export async function listSavedSearches(pool: Pool): Promise<unknown[]> {
  const { rows } = await pool.query(`SELECT slug, name, query, owner, created_at FROM qmp_saved_searches ORDER BY created_at DESC`);
  return rows;
}

export async function searchCoverage(pool: Pool): Promise<{ saved_searches: number | null }> {
  return { saved_searches: await count(pool, `SELECT COUNT(*)::int FROM qmp_saved_searches`) };
}

// ─────────────────────────── BULK JOBS ──────────────────────────────────────
export async function enqueueBulkJob(pool: Pool, input: { job_type: string; total?: number; params?: unknown; requested_by?: string }): Promise<{ id: number }> {
  assertEnabled();
  await ensureQmpSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO qmp_bulk_jobs (job_type, total, params, requested_by) VALUES ($1,$2,$3::jsonb,$4) RETURNING id`,
    [input.job_type, input.total ?? 0, JSON.stringify(input.params ?? {}), input.requested_by ?? null],
  );
  return { id: Number(rows[0].id) };
}

export async function listBulkJobs(pool: Pool): Promise<unknown[]> {
  const { rows } = await pool.query(`SELECT id, job_type, status, total, processed, failed, requested_by, created_at, finished_at FROM qmp_bulk_jobs ORDER BY created_at DESC LIMIT 200`);
  return rows;
}

export async function bulkOpsCoverage(pool: Pool): Promise<{ jobs: number | null; completed: number | null }> {
  return {
    jobs: await count(pool, `SELECT COUNT(*)::int FROM qmp_bulk_jobs`),
    completed: await count(pool, `SELECT COUNT(*)::int FROM qmp_bulk_jobs WHERE status='completed'`),
  };
}

// ─────────────────────────── WORKFLOW ───────────────────────────────────────
export interface WorkflowInput {
  question_id: string;
  to_state: string;
  action: string;
  from_state?: string;
  actor?: string;
  note?: string;
}

export async function workflowTransition(pool: Pool, input: WorkflowInput): Promise<{ id: number }> {
  assertEnabled();
  await ensureQmpSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO qmp_workflow (question_id, from_state, to_state, action, actor, note)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [input.question_id, input.from_state ?? null, input.to_state, input.action, input.actor ?? null, input.note ?? null],
  );
  return { id: Number(rows[0].id) };
}

export async function workflowHistory(pool: Pool, questionId: string): Promise<unknown[]> {
  const { rows } = await pool.query(
    `SELECT from_state, to_state, action, actor, note, created_at FROM qmp_workflow WHERE question_id=$1 ORDER BY created_at DESC`,
    [questionId],
  );
  return rows;
}

export async function workflowCoverage(pool: Pool): Promise<{ transitions: number | null; questions: number | null; approved: number | null; published: number | null }> {
  return {
    transitions: await count(pool, `SELECT COUNT(*)::int FROM qmp_workflow`),
    questions: await count(pool, `SELECT COUNT(DISTINCT question_id)::int FROM qmp_workflow`),
    approved: await count(pool, `SELECT COUNT(*)::int FROM qmp_workflow WHERE to_state='approved'`),
    published: await count(pool, `SELECT COUNT(*)::int FROM qmp_workflow WHERE to_state='published'`),
  };
}
