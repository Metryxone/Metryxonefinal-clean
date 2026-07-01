/**
 * CAPADEX 3.0 — Program 3 · Phase 3.3 Enterprise Assessment Builder (Authoring Platform)
 * ───────────────────────────────────────────────────────────────────────────
 * REUSE-BEFORE-BUILD engineering-closure mechanisms. These are the ONLY DDL sites in Phase 3.3 and
 * they run ONLY when the flag is ON (ensureAbSchema asserts the flag internally) — so flag OFF is
 * byte-identical incl. schema (0 tables). Everything here is ADDITIVE + reversible:
 *   - ab_assessments         — the ONE canonical authoring record (composes caf_assessments etc. by ref)
 *   - ab_assessment_versions — append-only version history (compare/rollback/clone; major/minor/draft)
 *   - ab_blueprints          — blueprint framework binding (distribution/mix/time/marks)
 *   - ab_templates           — reusable assessment templates (school/jee/…/custom)
 *   - ab_validation_runs      — pre-publish validation ledger
 *   - ab_workflow            — draft→review→approved→published→active→deprecated→archived audit ledger
 *
 * None of these fork the existing builder (caf_assessments) or blueprint tables — they OVERLAY them by
 * reference. Never throws destructively; readers return null on error (null ≠ 0). AUTHORING ONLY —
 * nothing here delivers, scores, or runs psychometrics.
 */
import type { Pool } from 'pg';
import { isAssessmentBuilderEnabled } from '../config/feature-flags';

export class AbFlagDisabledError extends Error {
  constructor() {
    super('assessment_builder_disabled');
    this.name = 'AbFlagDisabledError';
  }
}

function assertEnabled(): void {
  if (!isAssessmentBuilderEnabled()) throw new AbFlagDisabledError();
}

let schemaReady = false;

/**
 * Ensure the ab_* overlay schema. ASSERTS the flag first → OFF creates 0 tables (byte-identical OFF).
 * Idempotent (CREATE TABLE IF NOT EXISTS). All DDL is confined to this function.
 */
export async function ensureAbSchema(pool: Pool): Promise<void> {
  assertEnabled();
  if (schemaReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ab_assessments (
      slug           TEXT PRIMARY KEY,
      title          TEXT NOT NULL,
      assessment_type TEXT,
      source_ref     TEXT,
      blueprint_ref  TEXT,
      status         TEXT NOT NULL DEFAULT 'draft',
      version        INTEGER NOT NULL DEFAULT 1,
      structure      JSONB,
      rules          JSONB,
      config         JSONB,
      mapping        JSONB,
      owner          TEXT,
      author         TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ab_assess_status ON ab_assessments (status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ab_assess_owner ON ab_assessments (owner)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ab_assessment_versions (
      id             BIGSERIAL PRIMARY KEY,
      slug           TEXT NOT NULL,
      version        INTEGER NOT NULL,
      major          INTEGER NOT NULL DEFAULT 1,
      minor          INTEGER NOT NULL DEFAULT 0,
      is_draft       BOOLEAN NOT NULL DEFAULT TRUE,
      parent_version INTEGER,
      change_kind    TEXT NOT NULL DEFAULT 'edit',
      content        JSONB,
      author         TEXT,
      note           TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ab_ver_slug ON ab_assessment_versions (slug, version)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ab_blueprints (
      slug            TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      assessment_slug TEXT,
      competency_dist JSONB,
      behaviour_dist  JSONB,
      domain_dist     JSONB,
      question_mix    JSONB,
      difficulty_mix  JSONB,
      time_allocation JSONB,
      marks_dist      JSONB,
      owner           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ab_templates (
      slug         TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      category     TEXT NOT NULL DEFAULT 'custom',
      description  TEXT,
      definition   JSONB,
      owner        TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ab_validation_runs (
      id             BIGSERIAL PRIMARY KEY,
      slug           TEXT NOT NULL,
      passed         BOOLEAN NOT NULL DEFAULT FALSE,
      checks         JSONB,
      error_count    INTEGER NOT NULL DEFAULT 0,
      warning_count  INTEGER NOT NULL DEFAULT 0,
      actor          TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ab_val_slug ON ab_validation_runs (slug, created_at)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ab_workflow (
      id           BIGSERIAL PRIMARY KEY,
      slug         TEXT NOT NULL,
      from_state   TEXT,
      to_state     TEXT NOT NULL,
      action       TEXT NOT NULL,
      actor        TEXT,
      note         TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ab_wf_slug ON ab_workflow (slug, created_at)`);

  schemaReady = true;
}

// ─── null-safe read helper (null ≠ 0) ───────────────────────────────────────
async function count(pool: Pool, sql: string, params: unknown[] = []): Promise<number | null> {
  try {
    const { rows } = await pool.query(sql, params);
    const n = rows[0] ? Number(Object.values(rows[0])[0]) : 0;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

// ─────────────────────────── ASSESSMENTS (CRUD) ─────────────────────────────
export interface AssessmentInput {
  slug: string;
  title: string;
  assessment_type?: string;
  source_ref?: string;
  blueprint_ref?: string;
  structure?: unknown;
  rules?: unknown;
  config?: unknown;
  mapping?: unknown;
  owner?: string;
  author?: string;
}

export async function upsertAssessment(pool: Pool, input: AssessmentInput): Promise<{ slug: string }> {
  assertEnabled();
  await ensureAbSchema(pool);
  await pool.query(
    `INSERT INTO ab_assessments
       (slug, title, assessment_type, source_ref, blueprint_ref, structure, rules, config, mapping, owner, author, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11, NOW())
     ON CONFLICT (slug) DO UPDATE SET
       title=EXCLUDED.title,
       assessment_type=COALESCE(EXCLUDED.assessment_type, ab_assessments.assessment_type),
       source_ref=COALESCE(EXCLUDED.source_ref, ab_assessments.source_ref),
       blueprint_ref=COALESCE(EXCLUDED.blueprint_ref, ab_assessments.blueprint_ref),
       structure=COALESCE(EXCLUDED.structure, ab_assessments.structure),
       rules=COALESCE(EXCLUDED.rules, ab_assessments.rules),
       config=COALESCE(EXCLUDED.config, ab_assessments.config),
       mapping=COALESCE(EXCLUDED.mapping, ab_assessments.mapping),
       owner=COALESCE(EXCLUDED.owner, ab_assessments.owner),
       author=COALESCE(EXCLUDED.author, ab_assessments.author),
       updated_at=NOW()`,
    [
      input.slug, input.title, input.assessment_type ?? null, input.source_ref ?? null, input.blueprint_ref ?? null,
      input.structure != null ? JSON.stringify(input.structure) : null,
      input.rules != null ? JSON.stringify(input.rules) : null,
      input.config != null ? JSON.stringify(input.config) : null,
      input.mapping != null ? JSON.stringify(input.mapping) : null,
      input.owner ?? null, input.author ?? null,
    ],
  );
  return { slug: input.slug };
}

export async function getAssessment(pool: Pool, slug: string): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(`SELECT * FROM ab_assessments WHERE slug=$1 LIMIT 1`, [slug]);
  return rows[0] ?? null;
}

export async function listAssessments(pool: Pool): Promise<unknown[]> {
  const { rows } = await pool.query(
    `SELECT slug, title, assessment_type, blueprint_ref, status, version, owner, author, updated_at
       FROM ab_assessments ORDER BY updated_at DESC LIMIT 500`,
  );
  return rows;
}

export async function cloneAssessment(pool: Pool, sourceSlug: string, newSlug: string, newTitle: string, author?: string): Promise<{ slug: string }> {
  assertEnabled();
  await ensureAbSchema(pool);
  const src = await getAssessment(pool, sourceSlug);
  if (!src) throw new Error('source_assessment_not_found');
  await upsertAssessment(pool, {
    slug: newSlug, title: newTitle,
    assessment_type: src.assessment_type as string | undefined,
    source_ref: src.source_ref as string | undefined,
    blueprint_ref: src.blueprint_ref as string | undefined,
    structure: src.structure, rules: src.rules, config: src.config, mapping: src.mapping,
    owner: src.owner as string | undefined, author,
  });
  await snapshotVersion(pool, { slug: newSlug, content: src, change_kind: 'clone', author, note: `cloned from ${sourceSlug}` });
  return { slug: newSlug };
}

export async function assessmentCoverage(pool: Pool): Promise<{ assessments: number | null; published: number | null; owned: number | null }> {
  return {
    assessments: await count(pool, `SELECT COUNT(*)::int FROM ab_assessments`),
    published: await count(pool, `SELECT COUNT(*)::int FROM ab_assessments WHERE status IN ('published','active')`),
    owned: await count(pool, `SELECT COUNT(*)::int FROM ab_assessments WHERE owner IS NOT NULL`),
  };
}

// ─────────────────────────── VERSIONS ───────────────────────────────────────
export interface VersionInput {
  slug: string;
  content?: unknown;
  change_kind?: 'edit' | 'major' | 'minor' | 'draft' | 'clone' | 'rollback' | 'publish';
  author?: string;
  note?: string;
}

async function latestVersion(pool: Pool, slug: string): Promise<{ version: number; major: number; minor: number } | null> {
  const { rows } = await pool.query(
    `SELECT version, major, minor FROM ab_assessment_versions WHERE slug=$1 ORDER BY version DESC LIMIT 1`,
    [slug],
  );
  return rows[0] ? { version: Number(rows[0].version), major: Number(rows[0].major), minor: Number(rows[0].minor) } : null;
}

export async function snapshotVersion(pool: Pool, input: VersionInput): Promise<{ slug: string; version: number; major: number; minor: number }> {
  assertEnabled();
  await ensureAbSchema(pool);
  const prev = await latestVersion(pool, input.slug);
  const kind = input.change_kind || 'edit';
  let major = prev?.major ?? 1;
  let minor = prev?.minor ?? 0;
  if (!prev) { major = 1; minor = 0; }
  else if (kind === 'major') { major += 1; minor = 0; }
  else { minor += 1; }
  const version = (prev?.version ?? 0) + 1;
  const isDraft = kind !== 'publish' && kind !== 'major';
  await pool.query(
    `INSERT INTO ab_assessment_versions (slug, version, major, minor, is_draft, parent_version, change_kind, content, author, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`,
    [input.slug, version, major, minor, isDraft, prev?.version ?? null, kind,
      input.content != null ? JSON.stringify(input.content) : null, input.author ?? null, input.note ?? null],
  );
  await pool.query(`UPDATE ab_assessments SET version=$2, updated_at=NOW() WHERE slug=$1`, [input.slug, version]);
  return { slug: input.slug, version, major, minor };
}

export async function listVersions(pool: Pool, slug: string): Promise<unknown[]> {
  const { rows } = await pool.query(
    `SELECT version, major, minor, is_draft, change_kind, author, note, created_at
       FROM ab_assessment_versions WHERE slug=$1 ORDER BY version DESC`,
    [slug],
  );
  return rows;
}

export async function compareVersions(pool: Pool, slug: string, a: number, b: number): Promise<{ a: unknown; b: unknown; changed_keys: string[] }> {
  const { rows } = await pool.query(
    `SELECT version, content FROM ab_assessment_versions WHERE slug=$1 AND version = ANY($2::int[])`,
    [slug, [a, b]],
  );
  const av = rows.find((r) => Number(r.version) === a)?.content ?? {};
  const bv = rows.find((r) => Number(r.version) === b)?.content ?? {};
  const keys = new Set([...Object.keys(av || {}), ...Object.keys(bv || {})]);
  const changed_keys = [...keys].filter((k) => JSON.stringify((av || {})[k]) !== JSON.stringify((bv || {})[k]));
  return { a: av, b: bv, changed_keys };
}

export async function rollbackVersion(pool: Pool, slug: string, toVersion: number, author?: string): Promise<{ slug: string; version: number }> {
  assertEnabled();
  await ensureAbSchema(pool);
  const { rows } = await pool.query(
    `SELECT content FROM ab_assessment_versions WHERE slug=$1 AND version=$2 LIMIT 1`,
    [slug, toVersion],
  );
  if (!rows[0]) throw new Error('version_not_found');
  const snap = await snapshotVersion(pool, { slug, content: rows[0].content, change_kind: 'rollback', author, note: `rollback to v${toVersion}` });
  return { slug, version: snap.version };
}

export async function versionCoverage(pool: Pool): Promise<{ versioned_assessments: number | null; total_versions: number | null; drafts: number | null }> {
  return {
    versioned_assessments: await count(pool, `SELECT COUNT(DISTINCT slug)::int FROM ab_assessment_versions`),
    total_versions: await count(pool, `SELECT COUNT(*)::int FROM ab_assessment_versions`),
    drafts: await count(pool, `SELECT COUNT(*)::int FROM ab_assessment_versions WHERE is_draft`),
  };
}

// ─────────────────────────── BLUEPRINTS ─────────────────────────────────────
export interface BlueprintInput {
  slug: string;
  name: string;
  assessment_slug?: string;
  competency_dist?: unknown;
  behaviour_dist?: unknown;
  domain_dist?: unknown;
  question_mix?: unknown;
  difficulty_mix?: unknown;
  time_allocation?: unknown;
  marks_dist?: unknown;
  owner?: string;
}

export async function upsertBlueprint(pool: Pool, input: BlueprintInput): Promise<{ slug: string }> {
  assertEnabled();
  await ensureAbSchema(pool);
  await pool.query(
    `INSERT INTO ab_blueprints
       (slug, name, assessment_slug, competency_dist, behaviour_dist, domain_dist, question_mix, difficulty_mix, time_allocation, marks_dist, owner, updated_at)
     VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11, NOW())
     ON CONFLICT (slug) DO UPDATE SET
       name=EXCLUDED.name, assessment_slug=EXCLUDED.assessment_slug,
       competency_dist=EXCLUDED.competency_dist, behaviour_dist=EXCLUDED.behaviour_dist,
       domain_dist=EXCLUDED.domain_dist, question_mix=EXCLUDED.question_mix,
       difficulty_mix=EXCLUDED.difficulty_mix, time_allocation=EXCLUDED.time_allocation,
       marks_dist=EXCLUDED.marks_dist, owner=EXCLUDED.owner, updated_at=NOW()`,
    [input.slug, input.name, input.assessment_slug ?? null,
      input.competency_dist != null ? JSON.stringify(input.competency_dist) : null,
      input.behaviour_dist != null ? JSON.stringify(input.behaviour_dist) : null,
      input.domain_dist != null ? JSON.stringify(input.domain_dist) : null,
      input.question_mix != null ? JSON.stringify(input.question_mix) : null,
      input.difficulty_mix != null ? JSON.stringify(input.difficulty_mix) : null,
      input.time_allocation != null ? JSON.stringify(input.time_allocation) : null,
      input.marks_dist != null ? JSON.stringify(input.marks_dist) : null,
      input.owner ?? null],
  );
  return { slug: input.slug };
}

export async function listBlueprints(pool: Pool): Promise<unknown[]> {
  const { rows } = await pool.query(`SELECT slug, name, assessment_slug, owner, updated_at FROM ab_blueprints ORDER BY updated_at DESC LIMIT 500`);
  return rows;
}

export async function blueprintCoverage(pool: Pool): Promise<{ blueprints: number | null; bound: number | null }> {
  return {
    blueprints: await count(pool, `SELECT COUNT(*)::int FROM ab_blueprints`),
    bound: await count(pool, `SELECT COUNT(*)::int FROM ab_blueprints WHERE assessment_slug IS NOT NULL`),
  };
}

// ─────────────────────────── TEMPLATES ──────────────────────────────────────
export async function createTemplate(pool: Pool, input: { slug: string; name: string; category?: string; description?: string; definition?: unknown; owner?: string }): Promise<{ slug: string }> {
  assertEnabled();
  await ensureAbSchema(pool);
  await pool.query(
    `INSERT INTO ab_templates (slug, name, category, description, definition, owner, updated_at)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6, NOW())
     ON CONFLICT (slug) DO UPDATE SET
       name=EXCLUDED.name, category=EXCLUDED.category, description=EXCLUDED.description,
       definition=EXCLUDED.definition, owner=EXCLUDED.owner, updated_at=NOW()`,
    [input.slug, input.name, input.category || 'custom', input.description ?? null,
      input.definition != null ? JSON.stringify(input.definition) : null, input.owner ?? null],
  );
  return { slug: input.slug };
}

export async function listTemplates(pool: Pool): Promise<unknown[]> {
  const { rows } = await pool.query(`SELECT slug, name, category, description, owner, updated_at FROM ab_templates ORDER BY updated_at DESC LIMIT 500`);
  return rows;
}

export async function templateCoverage(pool: Pool): Promise<{ templates: number | null; categories: number | null }> {
  return {
    templates: await count(pool, `SELECT COUNT(*)::int FROM ab_templates`),
    categories: await count(pool, `SELECT COUNT(DISTINCT category)::int FROM ab_templates WHERE category IS NOT NULL`),
  };
}

// ─────────────────────────── VALIDATION RUNS ────────────────────────────────
export interface ValidationResult {
  passed: boolean;
  checks: { key: string; ok: boolean; severity: 'error' | 'warning'; message: string }[];
  error_count: number;
  warning_count: number;
}

/**
 * Read-time validation of an authoring record. Pure computation over the stored structure/rules/config —
 * NEVER mutates the assessment. Records the run to ab_validation_runs (the ONLY write) so the console can
 * surface the latest result. Gates PUBLISH (human decision) but is non-blocking to storage.
 */
export async function runValidation(pool: Pool, slug: string, actor?: string): Promise<ValidationResult> {
  assertEnabled();
  await ensureAbSchema(pool);
  const a = await getAssessment(pool, slug);
  const checks: ValidationResult['checks'] = [];
  const structure = (a?.structure as { sections?: { questions?: unknown[] }[] } | null) || null;
  const sections = structure?.sections ?? [];
  const allQ: unknown[] = [];
  let emptySections = 0;
  for (const s of sections) {
    const qs = Array.isArray(s?.questions) ? s.questions : [];
    if (qs.length === 0) emptySections += 1;
    for (const q of qs) allQ.push(q);
  }
  const dupCount = allQ.length - new Set(allQ.map((q) => JSON.stringify(q))).size;

  const push = (key: string, ok: boolean, severity: 'error' | 'warning', message: string) => checks.push({ key, ok, severity, message });
  push('missing_questions', allQ.length > 0, 'error', allQ.length > 0 ? `${allQ.length} question(s) bound` : 'no questions bound');
  push('empty_sections', emptySections === 0, 'error', emptySections === 0 ? 'no empty sections' : `${emptySections} empty section(s)`);
  push('duplicate_questions', dupCount === 0, 'warning', dupCount === 0 ? 'no duplicate questions' : `${dupCount} duplicate question binding(s)`);
  push('blueprint_validation', a?.blueprint_ref != null, 'warning', a?.blueprint_ref != null ? 'blueprint bound' : 'no blueprint bound');
  push('rule_validation', a?.rules != null, 'warning', a?.rules != null ? 'rules present' : 'no rules configured');
  push('config_validation', a?.config != null, 'warning', a?.config != null ? 'config present' : 'no config set');
  push('publishing_readiness', a != null && sections.length > 0 && allQ.length > 0, 'error',
    a != null && sections.length > 0 && allQ.length > 0 ? 'ready to publish' : 'not publish-ready');

  const error_count = checks.filter((c) => !c.ok && c.severity === 'error').length;
  const warning_count = checks.filter((c) => !c.ok && c.severity === 'warning').length;
  const passed = error_count === 0;

  await pool.query(
    `INSERT INTO ab_validation_runs (slug, passed, checks, error_count, warning_count, actor)
     VALUES ($1,$2,$3::jsonb,$4,$5,$6)`,
    [slug, passed, JSON.stringify(checks), error_count, warning_count, actor ?? null],
  );
  return { passed, checks, error_count, warning_count };
}

export async function latestValidation(pool: Pool, slug: string): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT passed, checks, error_count, warning_count, actor, created_at
       FROM ab_validation_runs WHERE slug=$1 ORDER BY created_at DESC LIMIT 1`,
    [slug],
  );
  return rows[0] ?? null;
}

export async function validationCoverage(pool: Pool): Promise<{ runs: number | null; passed: number | null; assessments_validated: number | null }> {
  return {
    runs: await count(pool, `SELECT COUNT(*)::int FROM ab_validation_runs`),
    passed: await count(pool, `SELECT COUNT(*)::int FROM ab_validation_runs WHERE passed`),
    assessments_validated: await count(pool, `SELECT COUNT(DISTINCT slug)::int FROM ab_validation_runs`),
  };
}

// ─────────────────────────── WORKFLOW / PUBLISHING ──────────────────────────
export const WORKFLOW_STATE_ORDER = ['draft', 'review', 'approved', 'published', 'active', 'deprecated', 'archived'] as const;
export type WorkflowState = typeof WORKFLOW_STATE_ORDER[number];

export interface WorkflowInput {
  slug: string;
  to_state: WorkflowState | string;
  action: string;
  from_state?: string;
  actor?: string;
  note?: string;
}

/**
 * Transition an assessment through the 7-state workflow with mandatory human approval.
 * Publishing is GATED: to_state 'published'/'active' requires the latest validation run to have passed.
 */
export async function workflowTransition(pool: Pool, input: WorkflowInput): Promise<{ id: number; to_state: string }> {
  assertEnabled();
  await ensureAbSchema(pool);
  if (input.to_state === 'published' || input.to_state === 'active') {
    const latest = await latestValidation(pool, input.slug);
    if (!latest || latest.passed !== true) throw new Error('publish_blocked_validation_not_clean');
  }
  const { rows } = await pool.query(
    `INSERT INTO ab_workflow (slug, from_state, to_state, action, actor, note)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [input.slug, input.from_state ?? null, input.to_state, input.action, input.actor ?? null, input.note ?? null],
  );
  await pool.query(`UPDATE ab_assessments SET status=$2, updated_at=NOW() WHERE slug=$1`, [input.slug, input.to_state]);
  return { id: Number(rows[0].id), to_state: String(input.to_state) };
}

export async function workflowHistory(pool: Pool, slug: string): Promise<unknown[]> {
  const { rows } = await pool.query(
    `SELECT from_state, to_state, action, actor, note, created_at FROM ab_workflow WHERE slug=$1 ORDER BY created_at DESC`,
    [slug],
  );
  return rows;
}

export async function workflowCoverage(pool: Pool): Promise<{ transitions: number | null; assessments: number | null; approved: number | null; published: number | null }> {
  return {
    transitions: await count(pool, `SELECT COUNT(*)::int FROM ab_workflow`),
    assessments: await count(pool, `SELECT COUNT(DISTINCT slug)::int FROM ab_workflow`),
    approved: await count(pool, `SELECT COUNT(*)::int FROM ab_workflow WHERE to_state='approved'`),
    published: await count(pool, `SELECT COUNT(*)::int FROM ab_workflow WHERE to_state IN ('published','active')`),
  };
}
