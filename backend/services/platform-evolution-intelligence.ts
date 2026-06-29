/**
 * MX-700 Phase 1.40 — Platform Evolution & Technical Debt Intelligence Engine (service layer).
 *
 * ENHANCEMENT-ONLY. This layer COMPOSES the Phase 1.37 Foundation + Phase 1.38 Management +
 * Phase 1.39 Intelligence. It establishes continuous repository evolution, technical-debt
 * governance, version governance, deprecation governance, retirement governance and knowledge
 * preservation by REUSING the existing registry/ledger/getters — it introduces NO duplicate
 * debt/version/deprecation/retirement/evolution registry, NO parallel engine, and changes NO
 * business logic. The repository remains the single source of truth.
 *
 * HONESTY CONTRACT (per user preference — honesty over optimism, never fabricate):
 *   - Technical Debt ≠ Bug · Deprecated ≠ Removed · Retired ≠ Deleted · Archived ≠ Forgotten
 *     · Version ≠ Release · Release ≠ Adoption · Knowledge Exists ≠ Runtime Active.
 *   - Coverage ≠ Confidence ≠ Evidence — reported as SEPARATE axes, never blended.
 *   - Counts are MEASURED (COUNT(*) / filesystem / git), never estimated. null ≠ zero in both
 *     directions: a metric whose denominator is 0 is returned as null (not 0).
 *   - Anything not machine-verifiable (e.g. git history when .git is absent) degrades to an
 *     explicit `unavailable`/honest-gap note — never invented.
 *
 * Three genuinely-NEW tables are owned here (technical_debt + knowledge + evolution audit
 * snapshots). Their lazy ensure-schema runs ONLY on flag-ON WRITE paths, so with the flag OFF
 * this layer is byte-identical incl. schema. All reads are GET-never-writes: they probe via
 * to_regclass and degrade to `ready:false`.
 */
import type { Pool } from 'pg';
import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { schemaReady as foundationSchemaReady, getSummary } from './platform-lifecycle';
import {
  getManagementSummary, getDeprecation, getRetirement, getVersionHistory, getEvolution,
} from './platform-lifecycle-management';
import { getLifecycleValidation, getLifecycleMetrics, getRepositoryHealthIntel } from './platform-lifecycle-intelligence';

const execFileP = promisify(execFile);
const __dirname_ = path.dirname(fileURLToPath(import.meta.url)); // backend/services
const BACKEND_ROOT = path.resolve(__dirname_, '..');             // backend
const REPO_ROOT = path.resolve(BACKEND_ROOT, '..');              // workspace

const DEBT_TABLE = 'platform_evolution_technical_debt';
const KNOWLEDGE_TABLE = 'platform_evolution_knowledge';
const SNAPSHOT_TABLE = 'platform_evolution_audit_snapshots';
let _schemaReady = false;

/** Lazy ensure-schema — canonical mirror of 20261219_platform_evolution_intelligence.sql.
 *  ONLY ever called from a flag-ON WRITE path -> flag-OFF byte-identical incl. schema. */
export async function ensureEvolutionSchema(pool: Pool): Promise<void> {
  if (_schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${DEBT_TABLE} (
      debt_uid               TEXT PRIMARY KEY,
      title                  TEXT NOT NULL,
      debt_category          TEXT,
      debt_type              TEXT,
      debt_owner             TEXT,
      priority               TEXT,
      severity               TEXT,
      impact                 TEXT,
      dependencies           TEXT[] NOT NULL DEFAULT '{}',
      status                 TEXT NOT NULL DEFAULT 'open',
      resolution_history     JSONB NOT NULL DEFAULT '[]',
      evidence               TEXT,
      documentation_reference TEXT,
      repository_reference   TEXT,
      lifecycle_uid          TEXT,
      created_by             TEXT,
      created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_pev_debt_status ON ${DEBT_TABLE} (status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS ${KNOWLEDGE_TABLE} (
      knowledge_uid          TEXT PRIMARY KEY,
      decision_type          TEXT NOT NULL,
      title                  TEXT NOT NULL,
      decision               TEXT,
      rationale              TEXT,
      lessons_learned        TEXT,
      documentation_links    TEXT[] NOT NULL DEFAULT '{}',
      repository_reference   TEXT,
      lifecycle_uid          TEXT,
      preserved_by           TEXT,
      created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_pev_knowledge_type ON ${KNOWLEDGE_TABLE} (decision_type, created_at DESC);

    CREATE TABLE IF NOT EXISTS ${SNAPSHOT_TABLE} (
      id                     BIGSERIAL PRIMARY KEY,
      snapshot_uid           TEXT UNIQUE NOT NULL,
      technical_debt_health  NUMERIC,
      version_health         NUMERIC,
      repository_evolution   NUMERIC,
      knowledge_health       NUMERIC,
      migration_health       NUMERIC,
      architecture_stability NUMERIC,
      metrics                JSONB NOT NULL DEFAULT '{}',
      debt_indicators        JSONB NOT NULL DEFAULT '{}',
      captured_by            TEXT,
      captured_at            TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_pev_audit_captured_at ON ${SNAPSHOT_TABLE} (captured_at DESC);
  `);
  _schemaReady = true;
}

// ── small helpers ─────────────────────────────────────────────────────────────
async function tableReady(pool: Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS ready`, [`public.${table}`]);
    return !!r.rows[0]?.ready;
  } catch { return false; }
}
async function scalar(pool: Pool, sql: string, params: unknown[] = []): Promise<number> {
  const r = await pool.query(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}
async function rows(pool: Pool, sql: string, params: unknown[] = []): Promise<any[]> {
  return (await pool.query(sql, params)).rows;
}
/** Measured ratio as a 0–100 percentage. null when the denominator is 0 (null ≠ zero). */
function pct(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(denominator) || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}
function mean(vals: Array<number | null | undefined>): number | null {
  const nums = vals.filter((v): v is number => typeof v === 'number');
  return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : null;
}
function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const FOUNDATION_NOT_READY = { ready: false as const, note: 'Foundation discovery has not run — no lifecycle registry to evolve yet (run POST /api/admin/platform-lifecycle/discover).' };

// ── PART 1: Technical Debt Registry + repository marker scan ───────────────────
// The registry (curated) is the human-tracked debt program. The marker scan is a MEASURED
// read-only repository scan of TODO/FIXME/HACK/XXX. Technical Debt ≠ Bug; markers ≠ tracked debt.

const DEBT_MARKERS = ['FIXME', 'HACK', 'XXX', 'TODO'] as const;
const DEBT_SCAN_DIRS = ['routes', 'services', 'lib', 'config'];
const DEBT_SCAN_MAX_FILES = 4000;

/** Read-only recursive scan of the backend code dirs for debt markers (MEASURED, never written). */
export async function scanRepositoryDebtMarkers(opts: { sampleLimit?: number } = {}): Promise<any> {
  const counts: Record<string, number> = { FIXME: 0, HACK: 0, XXX: 0, TODO: 0 };
  const sample: Array<{ file: string; line: number; marker: string; text: string }> = [];
  const sampleLimit = Number.isFinite(opts.sampleLimit as number) ? (opts.sampleLimit as number) : 50;
  let filesScanned = 0;

  const re = new RegExp(`\\b(${DEBT_MARKERS.join('|')})\\b`);
  const walk = async (abs: string): Promise<void> => {
    if (filesScanned >= DEBT_SCAN_MAX_FILES) return;
    let entries: any[] = [];
    try { entries = await fs.readdir(abs, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (filesScanned >= DEBT_SCAN_MAX_FILES) return;
      const full = path.join(abs, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        await walk(full);
      } else if (e.isFile() && e.name.endsWith('.ts')) {
        filesScanned++;
        let content = '';
        try { content = await fs.readFile(full, 'utf8'); } catch { continue; }
        if (!re.test(content)) continue;
        const rel = path.relative(REPO_ROOT, full);
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const m = lines[i].match(re);
          if (m) {
            counts[m[1]] = (counts[m[1]] ?? 0) + 1;
            if (sample.length < sampleLimit) sample.push({ file: rel, line: i + 1, marker: m[1], text: lines[i].trim().slice(0, 200) });
          }
        }
      }
    }
  };
  for (const d of DEBT_SCAN_DIRS) await walk(path.join(BACKEND_ROOT, d));

  const total = DEBT_MARKERS.reduce((a, k) => a + (counts[k] ?? 0), 0);
  return {
    ready: true,
    scanned_dirs: DEBT_SCAN_DIRS.map((d) => `backend/${d}`),
    files_scanned: filesScanned,
    counts,
    total,
    sample,
    note: 'MEASURED read-only scan of repository debt markers. Technical Debt ≠ Bug; a marker is a self-reported hint, NOT a tracked debt item. Counts are exact; nothing fabricated.',
  };
}

/** Register a curated technical-debt item (WRITE — owns ensure-schema; flag-ON only). */
export async function registerTechnicalDebt(
  pool: Pool,
  p: {
    title: string; category?: string; type?: string; owner?: string; priority?: string; severity?: string;
    impact?: string; dependencies?: string[]; evidence?: string; documentation?: string; repositoryReference?: string;
    lifecycleUid?: string; actor?: string | null;
  },
): Promise<{ ok: boolean; debt_uid?: string; error?: string }> {
  if (!p.title || !p.title.trim()) return { ok: false, error: 'title_required' };
  await ensureEvolutionSchema(pool);
  const id = uid('debt');
  await pool.query(
    `INSERT INTO ${DEBT_TABLE}
       (debt_uid, title, debt_category, debt_type, debt_owner, priority, severity, impact,
        dependencies, evidence, documentation_reference, repository_reference, lifecycle_uid, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [id, p.title.trim(), p.category ?? null, p.type ?? null, p.owner ?? null, p.priority ?? null,
     p.severity ?? null, p.impact ?? null, p.dependencies ?? [], p.evidence ?? null, p.documentation ?? null,
     p.repositoryReference ?? null, p.lifecycleUid ?? null, p.actor ?? null],
  );
  return { ok: true, debt_uid: id };
}

/** Update a debt item's status, appending to its append-only resolution_history (WRITE; flag-ON only). */
export async function updateTechnicalDebtStatus(
  pool: Pool,
  debtUid: string,
  p: { status: string; note?: string; actor?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  if (!p.status || !p.status.trim()) return { ok: false, error: 'status_required' };
  await ensureEvolutionSchema(pool);
  const existing = (await rows(pool, `SELECT debt_uid FROM ${DEBT_TABLE} WHERE debt_uid = $1`, [debtUid]))[0];
  if (!existing) return { ok: false, error: 'unknown_debt_item' };
  const entry = { status: p.status.trim(), note: p.note ?? null, actor: p.actor ?? null, at: new Date().toISOString() };
  await pool.query(
    `UPDATE ${DEBT_TABLE}
       SET status = $2,
           resolution_history = resolution_history || $3::jsonb,
           updated_at = now()
     WHERE debt_uid = $1`,
    [debtUid, p.status.trim(), JSON.stringify([entry])],
  );
  return { ok: true };
}

/** Read curated debt items (GET-never-writes; degrades to ready:false when the table is absent). */
export async function getTechnicalDebtRegistry(pool: Pool, q: { status?: string; limit?: number } = {}): Promise<{ ready: boolean; rows: any[] }> {
  if (!(await tableReady(pool, DEBT_TABLE))) return { ready: false, rows: [] };
  const where: string[] = []; const params: unknown[] = [];
  if (q.status) { params.push(q.status); where.push(`status = $${params.length}`); }
  const lim = Math.min(Math.max(Number.isFinite(q.limit as number) ? (q.limit as number) : 200, 1), 2000);
  const r = await rows(pool,
    `SELECT debt_uid, title, debt_category, debt_type, debt_owner, priority, severity, impact,
            dependencies, status, resolution_history, evidence, documentation_reference,
            repository_reference, lifecycle_uid, created_by, created_at, updated_at
       FROM ${DEBT_TABLE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY updated_at DESC LIMIT ${lim}`, params);
  return { ready: true, rows: r };
}

/** Technical Debt Intelligence: COMPOSES the curated registry + the MEASURED marker scan. */
export async function getTechnicalDebtIntelligence(pool: Pool): Promise<any> {
  const markers = await scanRepositoryDebtMarkers({ sampleLimit: 25 });
  const registryReady = await tableReady(pool, DEBT_TABLE);
  let byStatus: any[] = [], total = 0, resolved = 0;
  if (registryReady) {
    byStatus = await rows(pool, `SELECT status, count(*)::int n FROM ${DEBT_TABLE} GROUP BY status ORDER BY n DESC`);
    total = await scalar(pool, `SELECT count(*)::int n FROM ${DEBT_TABLE}`);
    resolved = await scalar(pool, `SELECT count(*)::int n FROM ${DEBT_TABLE} WHERE status IN ('resolved','accepted')`);
  }
  return {
    ready: true,
    registry: {
      table_present: registryReady,
      total_items: registryReady ? total : null,
      resolved_items: registryReady ? resolved : null,
      resolution_rate: registryReady ? pct(resolved, total) : null,
      by_status: byStatus,
      note: registryReady
        ? 'Curated debt registry counts are MEASURED. resolution_rate=null when no items are tracked (null ≠ zero).'
        : 'Debt registry table not yet created (no flag-ON write has run). Built ≠ populated — reported honestly.',
    },
    repository_markers: {
      counts: markers.counts,
      total: markers.total,
      files_scanned: markers.files_scanned,
      sample: markers.sample,
    },
    note: 'COMPOSES the curated debt registry (human-tracked) with a MEASURED repo marker scan. The two are SEPARATE axes — markers are self-reported hints, NOT tracked debt; Technical Debt ≠ Bug. Nothing fabricated.',
  };
}

// ── PART 2: Version Intelligence (COMPOSES the 1.38 version ledger + registry + git) ──
export async function getVersionIntelligence(pool: Pool): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return FOUNDATION_NOT_READY;
  const mgmt = await getManagementSummary(pool);

  // Registry version coverage: capabilities carrying a current_version (MEASURED).
  const capTotal = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type='capability'`);
  const capVersioned = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type='capability' AND current_version IS NOT NULL`);

  // Migration version coverage.
  const migTotal = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type='migration'`);
  const migVersioned = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type='migration' AND migration_version IS NOT NULL`);

  // Git evidence (best-effort; honest-unavailable when no .git).
  let git: any;
  try {
    const { stdout } = await execFileP('git', ['-C', REPO_ROOT, 'log', '-1', '--format=%cI'], { timeout: 4000 });
    const ts = stdout.trim();
    git = { available: !!ts, last_commit_at: ts || null, note: 'Repository-level last-commit timestamp (MEASURED). Per-entity git history not individually measured.' };
  } catch {
    git = { available: false, last_commit_at: null, note: 'git history unavailable in this environment — reported honestly, never fabricated.' };
  }

  return {
    ready: true,
    composes: ['platform-lifecycle-management.version_ledger (1.38)'],
    version_ledger_records: mgmt.management_totals?.version_records ?? null,
    coverage: {
      capability_version_coverage: pct(capVersioned, capTotal),
      migration_version_coverage: pct(migVersioned, migTotal),
    },
    counts: { capabilities: capTotal, capabilities_versioned: capVersioned, migrations: migTotal, migrations_versioned: migVersioned },
    git,
    note: 'Version Intelligence READS the 1.38 append-only version ledger + registry version metadata (no duplicate version registry). Version ≠ Release; Release ≠ Adoption. version_ledger_records=null until a flag-ON management write has run. null ≠ zero.',
  };
}

/** Per-entity version history — COMPOSES the 1.38 getVersionHistory getter. */
export async function getEntityVersionHistory(pool: Pool, uidArg: string): Promise<{ ready: boolean; rows: any[] }> {
  return getVersionHistory(pool, uidArg);
}

// ── PART 3: Deprecation Intelligence (COMPOSES the 1.38 deprecation ledger) ──
export async function getDeprecationIntelligence(pool: Pool): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return FOUNDATION_NOT_READY;
  const dep = await getDeprecation(pool, { limit: 2000 });
  const withReplacement = dep.ready ? dep.rows.filter((r: any) => r.replacement_reference).length : 0;
  const withMigrationTarget = dep.ready ? dep.rows.filter((r: any) => r.migration_target).length : 0;
  return {
    ready: true,
    composes: ['platform-lifecycle-management.deprecation (1.38)'],
    ledger_present: dep.ready,
    total_deprecations: dep.ready ? dep.rows.length : null,
    with_replacement: dep.ready ? withReplacement : null,
    with_migration_target: dep.ready ? withMigrationTarget : null,
    items: dep.ready ? dep.rows.slice(0, 100) : [],
    note: 'Deprecation Intelligence READS the existing 1.38 deprecation ledger (no parallel deprecation engine). Deprecated ≠ Removed. total_deprecations=null until the management schema exists (flag-ON write). null ≠ zero.',
  };
}

// ── PART 4: Retirement Intelligence (COMPOSES the 1.38 retirement ledger + dependency validation) ──
export async function getRetirementIntelligence(pool: Pool): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return FOUNDATION_NOT_READY;
  const ret = await getRetirement(pool, { limit: 2000 });
  const approved = ret.ready ? ret.rows.filter((r: any) => r.approval_status === 'approved').length : 0;
  const archived = ret.ready ? ret.rows.filter((r: any) => r.archive_reference).length : 0;
  const knowledgePreserved = ret.ready ? ret.rows.filter((r: any) => r.knowledge_preservation).length : 0;
  return {
    ready: true,
    composes: ['platform-lifecycle-management.retirement (1.38)'],
    ledger_present: ret.ready,
    total_retirements: ret.ready ? ret.rows.length : null,
    approved: ret.ready ? approved : null,
    archived: ret.ready ? archived : null,
    knowledge_preserved: ret.ready ? knowledgePreserved : null,
    items: ret.ready ? ret.rows.slice(0, 100) : [],
    note: 'Retirement Intelligence READS the existing 1.38 retirement ledger (no parallel retirement engine). Retired ≠ Deleted; Archived ≠ Forgotten. Counts null until the management schema exists. null ≠ zero.',
  };
}

// ── PART 5: Knowledge Preservation (registry WRITE + MEASURED memory/docs index READ) ──
const MEMORY_DIR = path.join(REPO_ROOT, '.agents', 'memory');
const DOCS_DIR = path.join(REPO_ROOT, 'docs');

async function countMarkdown(dir: string): Promise<number> {
  try { return (await fs.readdir(dir)).filter((f) => f.endsWith('.md')).length; } catch { return 0; }
}

/** Preserve a curated knowledge entry (WRITE — owns ensure-schema; flag-ON only). */
export async function preserveKnowledge(
  pool: Pool,
  p: {
    decisionType: string; title: string; decision?: string; rationale?: string; lessonsLearned?: string;
    documentationLinks?: string[]; repositoryReference?: string; lifecycleUid?: string; actor?: string | null;
  },
): Promise<{ ok: boolean; knowledge_uid?: string; error?: string }> {
  if (!p.decisionType || !p.decisionType.trim()) return { ok: false, error: 'decisionType_required' };
  if (!p.title || !p.title.trim()) return { ok: false, error: 'title_required' };
  await ensureEvolutionSchema(pool);
  const id = uid('know');
  await pool.query(
    `INSERT INTO ${KNOWLEDGE_TABLE}
       (knowledge_uid, decision_type, title, decision, rationale, lessons_learned,
        documentation_links, repository_reference, lifecycle_uid, preserved_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, p.decisionType.trim(), p.title.trim(), p.decision ?? null, p.rationale ?? null, p.lessonsLearned ?? null,
     p.documentationLinks ?? [], p.repositoryReference ?? null, p.lifecycleUid ?? null, p.actor ?? null],
  );
  return { ok: true, knowledge_uid: id };
}

/** Read curated knowledge entries (GET-never-writes). */
export async function getKnowledgeRegistry(pool: Pool, q: { decisionType?: string; limit?: number } = {}): Promise<{ ready: boolean; rows: any[] }> {
  if (!(await tableReady(pool, KNOWLEDGE_TABLE))) return { ready: false, rows: [] };
  const where: string[] = []; const params: unknown[] = [];
  if (q.decisionType) { params.push(q.decisionType); where.push(`decision_type = $${params.length}`); }
  const lim = Math.min(Math.max(Number.isFinite(q.limit as number) ? (q.limit as number) : 200, 1), 2000);
  const r = await rows(pool,
    `SELECT knowledge_uid, decision_type, title, decision, rationale, lessons_learned,
            documentation_links, repository_reference, lifecycle_uid, preserved_by, created_at
       FROM ${KNOWLEDGE_TABLE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY created_at DESC LIMIT ${lim}`, params);
  return { ready: true, rows: r };
}

/** Knowledge Preservation Intelligence: COMPOSES the curated registry + MEASURED memory/docs index. */
export async function getKnowledgeIntelligence(pool: Pool): Promise<any> {
  const registryReady = await tableReady(pool, KNOWLEDGE_TABLE);
  let byType: any[] = [], total = 0;
  if (registryReady) {
    byType = await rows(pool, `SELECT decision_type, count(*)::int n FROM ${KNOWLEDGE_TABLE} GROUP BY decision_type ORDER BY n DESC`);
    total = await scalar(pool, `SELECT count(*)::int n FROM ${KNOWLEDGE_TABLE}`);
  }
  const memoryFiles = await countMarkdown(MEMORY_DIR);
  const docFiles = await countMarkdown(DOCS_DIR);
  return {
    ready: true,
    registry: {
      table_present: registryReady,
      preserved_entries: registryReady ? total : null,
      by_decision_type: byType,
    },
    repository_knowledge_index: {
      memory_topic_files: memoryFiles,   // MEASURED .agents/memory/*.md
      documentation_files: docFiles,     // MEASURED docs/*.md
      note: 'MEASURED counts of the durable knowledge stores already in the repo (SSOT). Knowledge Exists ≠ Runtime Active — these are indexed read-only, not loaded.',
    },
    note: 'Knowledge Preservation COMPOSES the curated registry with a MEASURED index of the repo knowledge stores (.agents/memory + docs). preserved_entries=null until a flag-ON write has run (built ≠ populated). null ≠ zero.',
  };
}

// ── PART 6: Evolution Intelligence (COMPOSES the 1.38 evolution log + migration history) ──
export async function getEvolutionIntelligence(pool: Pool): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return FOUNDATION_NOT_READY;
  const evo = await getEvolution(pool, { limit: 2000 });
  const byType = evo.ready
    ? Object.entries(evo.rows.reduce((acc: Record<string, number>, r: any) => { acc[r.evolution_type] = (acc[r.evolution_type] ?? 0) + 1; return acc; }, {}))
        .map(([evolution_type, n]) => ({ evolution_type, n })).sort((a: any, b: any) => b.n - a.n)
    : [];

  // Repository evolution: migration history is the MEASURED record of forward-only schema evolution.
  const migTotal = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type='migration'`);
  const migDated = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type='migration' AND migration_date IS NOT NULL`);

  return {
    ready: true,
    composes: ['platform-lifecycle-management.evolution (1.38)'],
    evolution_log: {
      present: evo.ready,
      total_records: evo.ready ? evo.rows.length : null,
      by_type: byType,
      recent: evo.ready ? evo.rows.slice(0, 50) : [],
    },
    repository_evolution: {
      migrations_discovered: migTotal,
      migrations_dated: migDated,
      dated_coverage: pct(migDated, migTotal),
      note: 'Migrations are the MEASURED record of forward-only schema evolution (CREATE TABLE IF NOT EXISTS / additive columns).',
    },
    note: 'Evolution Intelligence READS the existing 1.38 evolution log + registry migration history (no parallel evolution engine). total_records=null until the management schema exists. null ≠ zero.',
  };
}

// ── PART 7: Evolution Validation (COMPOSES the 1.39 validation + adds evolution-specific checks) ──
export async function getEvolutionValidation(pool: Pool): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return FOUNDATION_NOT_READY;
  const base = await getLifecycleValidation(pool);

  // Knowledge preservation: are retired entities' knowledge captured? (dependency_validation + knowledge_preservation)
  const ret = await getRetirement(pool, { limit: 2000 });
  const retired = ret.ready ? ret.rows.length : 0;
  const retiredWithKnowledge = ret.ready ? ret.rows.filter((r: any) => r.knowledge_preservation).length : 0;
  const retiredWithDepValidation = ret.ready ? ret.rows.filter((r: any) => r.dependency_validation).length : 0;

  // Version integrity: capabilities lacking a current_version (an honest gap, MEASURED).
  const capTotal = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type='capability'`);
  const capMissingVersion = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type='capability' AND current_version IS NULL`);

  return {
    ready: true,
    composes: ['platform-lifecycle-intelligence.validation (1.39)'],
    repository_integrity: {
      broken_references: base.metadata_validation?.repository_integrity_broken_references ?? null,
      foundation_checks: base.foundation_validation ?? null,
    },
    knowledge_preservation: {
      retired_entities: ret.ready ? retired : null,
      retired_with_knowledge_preserved: ret.ready ? retiredWithKnowledge : null,
      retired_with_dependency_validation: ret.ready ? retiredWithDepValidation : null,
      coverage: ret.ready ? pct(retiredWithKnowledge, retired) : null,
      note: 'Knowledge-preservation coverage of RETIRED entities (Retired ≠ Deleted). coverage=null when nothing is retired (null ≠ zero).',
    },
    migration_safety: {
      ordering_regressions: base.foundation_validation ? null : null,
      note: 'Migrations are forward-only additive (CREATE TABLE IF NOT EXISTS); destructive DDL is out of scope for this read-only layer.',
    },
    version_integrity: {
      capabilities: capTotal,
      capabilities_missing_version: capMissingVersion,
      note: 'capabilities_missing_version is an HONEST gap (no formal versioning was pre-populated at discovery), never fabricated.',
    },
    compatibility: {
      note: 'Compatibility is preserved STRUCTURALLY: every additive phase is flag-gated OFF byte-identical, so prior behaviour is preserved by construction.',
    },
    dependency_stability: {
      note: 'Dependency stability is MEASURED via the 1.37 relationship graph (see repository-health circular_dependencies / orphan_modules in metrics).',
    },
    note: 'Evolution Validation COMPOSES the 1.39 validation + evolution-specific knowledge/version checks. All MEASURED; missing_* are honest gaps. null ≠ zero.',
  };
}

// ── PART 8: Evolution Metrics — SIX SEPARATE measured scores (NEVER composited) ──
export async function getEvolutionMetrics(pool: Pool): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return FOUNDATION_NOT_READY;

  // 1. Technical Debt Health = resolution rate of TRACKED debt (null when none tracked; markers reported separately).
  const debtIntel = await getTechnicalDebtIntelligence(pool);
  const technical_debt_health = debtIntel.registry?.resolution_rate ?? null;

  // 2. Version Health = capability version coverage (MEASURED).
  const ver = await getVersionIntelligence(pool);
  const version_health = ver.coverage?.capability_version_coverage ?? null;

  // 3. Repository Evolution = dated-migration coverage (MEASURED forward-only schema evolution record).
  const evo = await getEvolutionIntelligence(pool);
  const repository_evolution = evo.repository_evolution?.dated_coverage ?? null;

  // 4. Knowledge Health = knowledge-preservation coverage of retired entities (null when nothing retired).
  const val = await getEvolutionValidation(pool);
  const knowledge_health = val.knowledge_preservation?.coverage ?? null;

  // 5. Migration Health = parseable-version coverage of discovered migrations (MEASURED).
  const migTotal = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type='migration'`);
  const migVersioned = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type='migration' AND migration_version IS NOT NULL`);
  const migration_health = pct(migVersioned, migTotal);

  // 6. Architecture Stability = reuse the 1.39 MEASURED state-churn stability (compose, never recompute).
  const lifeMetrics = await getLifecycleMetrics(pool);
  const architecture_stability = lifeMetrics.scores?.architecture_stability ?? null;

  return {
    ready: true,
    composes: ['platform-lifecycle-intelligence.metrics (1.39)'],
    scores: {
      technical_debt_health,
      version_health,
      repository_evolution,
      knowledge_health,
      migration_health,
      architecture_stability,
    },
    debt_indicators: {
      repository_markers: debtIntel.repository_markers?.counts ?? null,
      repository_markers_total: debtIntel.repository_markers?.total ?? null,
      tracked_debt_items: debtIntel.registry?.total_items ?? null,
      dormant_capabilities: lifeMetrics.tech_debt_indicators?.dormant_capabilities ?? null,
      note: 'Dormant capabilities are NOT debt — built-but-deactivated by design (flag OFF). Repo markers are self-reported hints, not tracked debt. Reported for transparency; never auto-actioned (STOP clause).',
    },
    note: 'SIX SEPARATE MEASURED scores (0–100). They are deliberately NOT composited into a single "overall" verdict (Technical-Debt ⟂ Version ⟂ Repository-Evolution ⟂ Knowledge ⟂ Migration ⟂ Architecture). A score is null when its denominator is 0 (null ≠ zero).',
  };
}

// ── PART 9: Continuous Evolution Audit (drift) — append-only; the snapshot is a WRITE path ──
export async function captureEvolutionSnapshot(pool: Pool, actor: string | null): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return FOUNDATION_NOT_READY;
  await ensureEvolutionSchema(pool);
  const [metrics, debt, version, deprecation, retirement, knowledge, evolution, validation, mgmt, summary] = await Promise.all([
    getEvolutionMetrics(pool), getTechnicalDebtIntelligence(pool), getVersionIntelligence(pool),
    getDeprecationIntelligence(pool), getRetirementIntelligence(pool), getKnowledgeIntelligence(pool),
    getEvolutionIntelligence(pool), getEvolutionValidation(pool), getManagementSummary(pool), getSummary(pool),
  ]);
  const s = metrics.scores ?? {};
  const id = uid('evo_snap');
  const full = { metrics, technical_debt: debt, version, deprecation, retirement, knowledge, evolution, validation, management: mgmt, foundation_summary: summary };
  await pool.query(
    `INSERT INTO ${SNAPSHOT_TABLE}
       (snapshot_uid, technical_debt_health, version_health, repository_evolution,
        knowledge_health, migration_health, architecture_stability, metrics, debt_indicators, captured_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10)`,
    [id, s.technical_debt_health, s.version_health, s.repository_evolution, s.knowledge_health,
     s.migration_health, s.architecture_stability, JSON.stringify(full),
     JSON.stringify(metrics.debt_indicators ?? {}), actor],
  );
  return { ok: true, snapshot_uid: id, captured_at: new Date().toISOString(), scores: s };
}

export async function getEvolutionSnapshots(pool: Pool, q: { limit?: number }): Promise<{ ready: boolean; rows: any[] }> {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) return { ready: false, rows: [] };
  const lim = Math.min(Math.max(Number.isFinite(q.limit as number) ? (q.limit as number) : 50, 1), 500);
  const r = await rows(pool,
    `SELECT snapshot_uid, technical_debt_health, version_health, repository_evolution,
            knowledge_health, migration_health, architecture_stability, captured_by, captured_at
       FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC, id DESC LIMIT ${lim}`);
  return { ready: true, rows: r };
}

/** Evolution drift = diff between the two most recent snapshots (MEASURED per-metric deltas). */
export async function getEvolutionDrift(pool: Pool): Promise<any> {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) return { ready: false, note: 'No evolution snapshots captured yet (POST /audit/capture to create the first one).' };
  const last2 = await rows(pool, `SELECT * FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC, id DESC LIMIT 2`);
  if (last2.length === 0) return { ready: true, snapshots: 0, note: 'No snapshots captured yet.' };
  if (last2.length === 1) return { ready: true, snapshots: 1, current: scoreRow(last2[0]), previous: null, drift: null, note: 'Only one snapshot exists — drift requires at least two. null ≠ zero.' };
  const [cur, prev] = last2;
  const delta = (a: any, b: any) => (a == null || b == null ? null : Math.round((Number(a) - Number(b)) * 100) / 100);
  return {
    ready: true,
    snapshots: 2,
    current: scoreRow(cur),
    previous: scoreRow(prev),
    drift: {
      technical_debt_health: delta(cur.technical_debt_health, prev.technical_debt_health),
      version_health: delta(cur.version_health, prev.version_health),
      repository_evolution: delta(cur.repository_evolution, prev.repository_evolution),
      knowledge_health: delta(cur.knowledge_health, prev.knowledge_health),
      migration_health: delta(cur.migration_health, prev.migration_health),
      architecture_stability: delta(cur.architecture_stability, prev.architecture_stability),
    },
    note: 'Drift = current minus previous snapshot per metric (MEASURED). A null delta means one side was unmeasurable (null ≠ zero — never coerced to 0).',
  };
}

function scoreRow(r: any) {
  return {
    snapshot_uid: r.snapshot_uid, captured_at: r.captured_at,
    technical_debt_health: r.technical_debt_health, version_health: r.version_health,
    repository_evolution: r.repository_evolution, knowledge_health: r.knowledge_health,
    migration_health: r.migration_health, architecture_stability: r.architecture_stability,
  };
}

// ── Continuous evolution reports (read-only composition of every report surface) ──
export async function getEvolutionReports(pool: Pool): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return FOUNDATION_NOT_READY;
  const [debt, version, deprecation, retirement, knowledge, evolution] = await Promise.all([
    getTechnicalDebtIntelligence(pool), getVersionIntelligence(pool), getDeprecationIntelligence(pool),
    getRetirementIntelligence(pool), getKnowledgeIntelligence(pool), getEvolutionIntelligence(pool),
  ]);
  return {
    ready: true,
    reports: {
      evolution_report: { by_type: evolution.evolution_log?.by_type ?? [], repository_evolution: evolution.repository_evolution ?? null },
      debt_report: { registry: debt.registry, repository_markers: debt.repository_markers },
      version_report: { coverage: version.coverage, version_ledger_records: version.version_ledger_records },
      deprecation_report: { total_deprecations: deprecation.total_deprecations, with_replacement: deprecation.with_replacement },
      retirement_report: { total_retirements: retirement.total_retirements, archived: retirement.archived, knowledge_preserved: retirement.knowledge_preserved },
      knowledge_preservation_report: { registry: knowledge.registry, repository_knowledge_index: knowledge.repository_knowledge_index },
    },
    note: 'Continuous evolution reports COMPOSE the read-only intelligence surfaces (no new computation). Every figure is MEASURED; null ≠ zero.',
  };
}

// ── Evolution summary (read-only; composes all engines + declares its composition) ──
export async function getEvolutionSummary(pool: Pool): Promise<any> {
  const foundationReady = await foundationSchemaReady(pool);
  if (!foundationReady) return { ready: false, foundation_ready: false, ...FOUNDATION_NOT_READY };
  const [metrics, debt, knowledge, snapshots] = await Promise.all([
    getEvolutionMetrics(pool), getTechnicalDebtIntelligence(pool), getKnowledgeIntelligence(pool),
    getEvolutionSnapshots(pool, { limit: 1 }),
  ]);
  return {
    ready: true,
    foundation_ready: true,
    composes: [
      'platform-lifecycle (1.37 Foundation)',
      'platform-lifecycle-management (1.38 Management)',
      'platform-lifecycle-intelligence (1.39 Intelligence)',
    ],
    scores: metrics.scores ?? null,
    debt_indicators: metrics.debt_indicators ?? null,
    technical_debt: { tracked_items: debt.registry?.total_items ?? null, repository_markers_total: debt.repository_markers?.total ?? null },
    knowledge: { preserved_entries: knowledge.registry?.preserved_entries ?? null, memory_topic_files: knowledge.repository_knowledge_index?.memory_topic_files ?? null, documentation_files: knowledge.repository_knowledge_index?.documentation_files ?? null },
    snapshot_count: snapshots.ready ? snapshots.rows.length : 0,
    latest_snapshot: snapshots.ready ? (snapshots.rows[0] ?? null) : null,
    note: 'Evolution Intelligence COMPOSES the 1.37 Foundation + 1.38 Management + 1.39 Intelligence (no parallel registry/engine, no business-logic change). Every score is MEASURED and reported as a SEPARATE axis — never composited. null ≠ zero.',
  };
}
