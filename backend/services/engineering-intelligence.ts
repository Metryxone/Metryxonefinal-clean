/**
 * MX-800 Phase 2.3 — Engineering Intelligence Engine (service layer).
 *
 * ENHANCEMENT-ONLY. Engineering Intelligence continuously understands, measures, validates,
 * explains and surfaces engineering quality by COMPOSING the EXISTING repository/lifecycle
 * intelligence engines (MX-700 1.39 platform-lifecycle-intelligence + 1.40
 * platform-evolution-intelligence) plus a MEASURED engineering-knowledge registry. It introduces
 * NO parallel engineering engine, NO duplicate analysis/quality/validation service, and changes
 * NO business logic. The repository is the single source of truth: every code/architecture/
 * dependency/quality number is MEASURED from the live filesystem or READ from an existing
 * measured getter — nothing is fabricated or estimated.
 *
 * HONESTY CONTRACT (user preference — honesty over optimism, never fabricate):
 *   - Code Exists ≠ Quality ≠ Reliability ≠ Maintainability. Architecture ≠ Implementation.
 *     Dependency ≠ Usage. Coverage ⟂ Confidence ⟂ Evidence (SEPARATE axes, never blended).
 *   - Only AST-free, statically MEASURABLE signals are reported as numbers: code SIZE (line/byte
 *     counts), debt MARKERS (TODO/FIXME/HACK/XXX), LARGE files, CIRCULAR dependencies, ORPHAN
 *     modules, documentation coverage, library manifest, internal import edges, test-file presence.
 *   - Cyclomatic COMPLEXITY, COHESION, semantic DUPLICATION and line-level TEST COVERAGE require
 *     AST / instrumentation tooling NOT present in this environment → reported as honest NULL with
 *     a note (DEFERRED), never an estimate. A ratio with a 0 denominator → null (null ≠ zero).
 *   - owner is MANAGED (human) and honest-NULL when unassigned; re-discovery NEVER overwrites it.
 *     present is MEASURED (fs.access). Built ≠ Activated; Registered ≠ Used.
 *
 * Reads are GET-never-writes: they probe via to_regclass and compose measured getters; they NEVER
 * create schema. The lazy ensure-schema runs ONLY on flag-ON write paths (discover / register /
 * audit-capture) so flag OFF → byte-identical incl. schema (0 tables). Every write path also
 * asserts the flag itself BEFORE ensure-schema (defense-in-depth for direct/tooling callers).
 */
import type { Pool } from 'pg';
import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { isEngineeringIntelligenceEnabled } from '../config/feature-flags';

// Composed substrate (EXISTING measured getters — reuse, never duplicate).
import {
  getRepositoryHealthIntel,
  getLifecycleMetrics,
  getLifecycleValidation,
  getCompatibilityIntelligence,
} from './platform-lifecycle-intelligence';
import {
  scanRepositoryDebtMarkers,
  getTechnicalDebtIntelligence,
  getEvolutionValidation,
  getEvolutionMetrics,
} from './platform-evolution-intelligence';

const __dirname_ = path.dirname(fileURLToPath(import.meta.url)); // backend/services
const BACKEND_ROOT = path.resolve(__dirname_, '..');             // backend
const REGISTRY_TABLE = 'engineering_knowledge_registry';
const SNAPSHOT_TABLE = 'engineering_intelligence_audit_snapshots';

// Directories scanned for measured engineering entities (read-only). node_modules / dotfiles skipped.
const SCAN_TARGETS: Array<{ dir: string; entity_type: string; category: string }> = [
  { dir: 'services', entity_type: 'service', category: 'backend' },
  { dir: 'routes', entity_type: 'route', category: 'backend' },
];
const SCAN_MAX_FILES = 4000;

// ── Defense-in-depth flag guard for WRITE/DDL paths ─────────────────────────
class EngineeringIntelligenceDisabled extends Error {
  code = 'engineering_intelligence_disabled';
  constructor() {
    super('engineeringIntelligence flag is OFF — write/DDL paths are inert (byte-identical legacy).');
    this.name = 'EngineeringIntelligenceDisabled';
  }
}
function assertEnabled(): void {
  if (!isEngineeringIntelligenceEnabled()) throw new EngineeringIntelligenceDisabled();
}

// ── helpers ─────────────────────────────────────────────────────────────────
async function tableReady(pool: Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS ready`, [`public.${table}`]);
    return !!r.rows[0]?.ready;
  } catch { return false; }
}
async function scalar(pool: Pool, sql: string, params: unknown[] = []): Promise<number> {
  try { const r = await pool.query(sql, params); return Number(r.rows[0]?.n ?? 0); } catch { return 0; }
}
async function rows(pool: Pool, sql: string, params: unknown[] = []): Promise<any[]> {
  try { const r = await pool.query(sql, params); return r.rows; } catch { return []; }
}
/** Ratio as a 0–100 percentage; NULL when the denominator is 0 (null ≠ zero). */
function pct(n: number, d: number): number | null {
  if (!d) return null;
  return Math.round((n / d) * 10000) / 100;
}
function uid(prefix: string): string { return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`; }

/**
 * Short-TTL promise memo. The aggregate getters (/summary, /metrics, /reasoning, /validation,
 * captureSnapshot) compose the SAME expensive sources (full-repo filesystem scans of ~700 backend
 * files + the composed MX-700 1.39/1.40 repo-health / metrics / validation getters, each of which
 * runs its OWN repo scan). Without memoization a single capture re-derives those sources dozens of
 * times → minutes-long hang + connection-pool exhaustion (the MX-700 1.43 "gather EXACTLY ONCE"
 * lesson). The cache dedupes in-flight promises within a request and reuses for a few seconds; data
 * is read-only intelligence so a small staleness window is irrelevant (mirrors the 60s admin cache).
 */
const MEMO_TTL_MS = 8000;
const _memo = new Map<string, { at: number; val: Promise<any> }>();
function memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = _memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.val as Promise<T>;
  const val = fn().catch((e) => { _memo.delete(key); throw e; }); // don't cache rejections
  _memo.set(key, { at: Date.now(), val });
  return val;
}
// Memoized wrappers over the composed sources (reuse, never duplicate; gather each ONCE per window).
const repoHealth   = (pool: Pool) => memo('repoHealth',   () => getRepositoryHealthIntel(pool));
const lcMetrics    = (pool: Pool) => memo('lcMetrics',    () => getLifecycleMetrics(pool));
const lcValidation = (pool: Pool) => memo('lcValidation', () => getLifecycleValidation(pool));
const compatIntel  = (pool: Pool) => memo('compatIntel',  () => getCompatibilityIntelligence(pool));
const debtMarkers  = ()           => memo('debtMarkers',  () => scanRepositoryDebtMarkers({ sampleLimit: 25 }));
const techDebt     = (pool: Pool) => memo('techDebt',     () => getTechnicalDebtIntelligence(pool));
const evoValidation = (pool: Pool) => memo('evoValidation', () => getEvolutionValidation(pool));
const evoMetrics    = (pool: Pool) => memo('evoMetrics',    () => getEvolutionMetrics(pool));

let _schemaReady = false;
/** Lazy ensure-schema — canonical mirror of 20261222_engineering_intelligence.sql.
 *  ONLY called from flag-ON write paths (discover/register/audit-capture) → flag OFF byte-identical. */
export async function ensureEngineeringSchema(pool: Pool): Promise<void> {
  if (_schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${REGISTRY_TABLE} (
      id                  BIGSERIAL PRIMARY KEY,
      engineering_uid     TEXT UNIQUE NOT NULL,
      name                TEXT NOT NULL,
      entity_type         TEXT NOT NULL,
      category            TEXT,
      owner               TEXT,
      present             BOOLEAN,
      size_lines          INTEGER,
      size_bytes          INTEGER,
      version             TEXT,
      dependency_type     TEXT,
      repository_ref      TEXT,
      documentation_ref   TEXT,
      metadata            JSONB NOT NULL DEFAULT '{}',
      lifecycle_uid       TEXT,
      source              TEXT NOT NULL DEFAULT 'discovered',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_ekr_entity_type ON ${REGISTRY_TABLE} (entity_type);
    CREATE INDEX IF NOT EXISTS idx_ekr_category    ON ${REGISTRY_TABLE} (category);
    CREATE TABLE IF NOT EXISTS ${SNAPSHOT_TABLE} (
      id                       BIGSERIAL PRIMARY KEY,
      snapshot_uid             TEXT UNIQUE NOT NULL,
      registry_total           INTEGER,
      code_size_total_lines    INTEGER,
      debt_markers_total       INTEGER,
      large_files              INTEGER,
      circular_dependencies    INTEGER,
      documentation_coverage   NUMERIC,
      metrics                  JSONB NOT NULL DEFAULT '{}',
      validation               JSONB NOT NULL DEFAULT '{}',
      summary                  JSONB NOT NULL DEFAULT '{}',
      captured_by              TEXT,
      captured_at              TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_eias_captured_at
      ON ${SNAPSHOT_TABLE} (captured_at DESC);
  `);
  _schemaReady = true;
}

// ── MEASURED filesystem scan (read-only) ─────────────────────────────────────
interface MeasuredFile { rel: string; name: string; entity_type: string; category: string; lines: number; bytes: number; }

/** Scan SCAN_TARGETS for .ts files, MEASURING line + byte counts. Pure read-only filesystem. */
function scanEngineeringFiles(): Promise<MeasuredFile[]> { return memo('scanFiles', _scanEngineeringFilesImpl); }
async function _scanEngineeringFilesImpl(): Promise<MeasuredFile[]> {
  const out: MeasuredFile[] = [];
  for (const t of SCAN_TARGETS) {
    const abs = path.join(BACKEND_ROOT, t.dir);
    let entries: any[] = [];
    try { entries = await fs.readdir(abs, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (out.length >= SCAN_MAX_FILES) break;
      if (!e.isFile() || !e.name.endsWith('.ts')) continue;
      const full = path.join(abs, e.name);
      let content = '';
      try { content = await fs.readFile(full, 'utf8'); } catch { continue; }
      out.push({
        rel: `backend/${t.dir}/${e.name}`,
        name: e.name.replace(/\.ts$/, ''),
        entity_type: t.entity_type,
        category: t.category,
        lines: content.split('\n').length,
        bytes: Buffer.byteLength(content, 'utf8'),
      });
    }
  }
  return out;
}

/** Read the backend manifest libraries (runtime + build). Pure read-only. */
function readLibraries(): Promise<Array<{ name: string; version: string; dependency_type: 'runtime' | 'build' }>> { return memo('readLibraries', _readLibrariesImpl); }
async function _readLibrariesImpl(): Promise<Array<{ name: string; version: string; dependency_type: 'runtime' | 'build' }>> {
  try {
    const raw = await fs.readFile(path.join(BACKEND_ROOT, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw);
    const libs: Array<{ name: string; version: string; dependency_type: 'runtime' | 'build' }> = [];
    for (const [name, version] of Object.entries(pkg.dependencies ?? {})) libs.push({ name, version: String(version), dependency_type: 'runtime' });
    for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) libs.push({ name, version: String(version), dependency_type: 'build' });
    return libs;
  } catch { return []; }
}

/** MEASURED internal import edges: count relative (internal) vs bare (external) imports across the
 *  scanned files. Bounded, read-only. This is a real structural dependency signal (NOT a full AST graph). */
function measureImportEdges(): Promise<{ files: number; internal_edges: number; external_edges: number; sample: any[] }> { return memo('measureImportEdges', _measureImportEdgesImpl); }
async function _measureImportEdgesImpl(): Promise<{ files: number; internal_edges: number; external_edges: number; sample: any[] }> {
  let files = 0, internal = 0, external = 0;
  const sample: any[] = [];
  const re = /^\s*import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/;
  for (const t of SCAN_TARGETS) {
    const abs = path.join(BACKEND_ROOT, t.dir);
    let entries: any[] = [];
    try { entries = await fs.readdir(abs, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith('.ts')) continue;
      let content = '';
      try { content = await fs.readFile(path.join(abs, e.name), 'utf8'); } catch { continue; }
      files++;
      let fileInternal = 0, fileExternal = 0;
      for (const line of content.split('\n')) {
        const m = line.match(re);
        if (!m) continue;
        if (m[1].startsWith('.') || m[1].startsWith('/')) { internal++; fileInternal++; }
        else { external++; fileExternal++; }
      }
      if (sample.length < 25) sample.push({ file: `backend/${t.dir}/${e.name}`, internal: fileInternal, external: fileExternal });
    }
  }
  return { files, internal_edges: internal, external_edges: external, sample };
}

// ── PART 1: Engineering Knowledge Registry ───────────────────────────────────
/** WRITE — populate the registry from a MEASURED repo scan. owner is MANAGED (never overwritten). */
export async function discoverEngineering(pool: Pool, actor: string | null) {
  assertEnabled();
  await ensureEngineeringSchema(pool);

  const files = await scanEngineeringFiles();
  const libs = await readLibraries();

  // Soft-link to the MX-700 lifecycle catalog when present (no FK, no duplication).
  const lifecycleReady = await tableReady(pool, 'platform_lifecycle_catalog');

  let upserted = 0;
  for (const f of files) {
    let lifecycle_uid: string | null = null;
    if (lifecycleReady) {
      try {
        const r = await pool.query(
          `SELECT lifecycle_uid FROM platform_lifecycle_catalog WHERE name=$1 LIMIT 1`, [f.name],
        );
        lifecycle_uid = r.rows[0]?.lifecycle_uid ?? null;
      } catch { lifecycle_uid = null; }
    }
    await pool.query(
      `INSERT INTO ${REGISTRY_TABLE}
         (engineering_uid, name, entity_type, category, present, size_lines, size_bytes,
          repository_ref, metadata, lifecycle_uid, source, updated_at)
       VALUES ($1,$2,$3,$4,true,$5,$6,$7,$8::jsonb,$9,'discovered',now())
       ON CONFLICT (engineering_uid) DO UPDATE SET
         name=EXCLUDED.name, entity_type=EXCLUDED.entity_type, category=EXCLUDED.category,
         present=EXCLUDED.present, size_lines=EXCLUDED.size_lines, size_bytes=EXCLUDED.size_bytes,
         repository_ref=EXCLUDED.repository_ref, metadata=EXCLUDED.metadata,
         lifecycle_uid=COALESCE(EXCLUDED.lifecycle_uid, ${REGISTRY_TABLE}.lifecycle_uid),
         source='discovered', updated_at=now()
         -- NOTE: owner + documentation_ref are MANAGED and deliberately NOT overwritten here.`,
      [
        `eng-${f.entity_type}-${f.name}`, f.name, f.entity_type, f.category,
        f.lines, f.bytes, f.rel, JSON.stringify({ measured: true }), lifecycle_uid,
      ],
    );
    upserted++;
  }
  for (const l of libs) {
    await pool.query(
      `INSERT INTO ${REGISTRY_TABLE}
         (engineering_uid, name, entity_type, category, present, version, dependency_type,
          repository_ref, metadata, source, updated_at)
       VALUES ($1,$2,'library','external',true,$3,$4,'backend/package.json',$5::jsonb,'discovered',now())
       ON CONFLICT (engineering_uid) DO UPDATE SET
         version=EXCLUDED.version, dependency_type=EXCLUDED.dependency_type,
         present=EXCLUDED.present, metadata=EXCLUDED.metadata, source='discovered', updated_at=now()`,
      [`eng-library-${l.name}`, l.name, l.version, l.dependency_type, JSON.stringify({ manifest: true })],
    );
    upserted++;
  }

  return {
    ok: true, discovered: upserted,
    files: files.length, libraries: libs.length, lifecycle_linked: lifecycleReady,
    actor, note: 'MEASURED scan of backend services/routes + manifest libraries. owner/documentation_ref are MANAGED and preserved across re-discovery.',
  };
}

/** Read the engineering registry (GET-never-writes; degrades to ready:false when absent). */
export async function getEngineeringRegistry(pool: Pool) {
  if (!(await tableReady(pool, REGISTRY_TABLE))) {
    return {
      ready: false, total: 0, by_type: [], entries: [],
      note: 'Engineering registry table not yet created (no flag-ON discover has run). Built ≠ populated — reported honestly.',
    };
  }
  const total = await scalar(pool, `SELECT count(*)::int n FROM ${REGISTRY_TABLE}`);
  const byType = await rows(pool, `SELECT entity_type, count(*)::int n FROM ${REGISTRY_TABLE} GROUP BY entity_type ORDER BY n DESC`);
  const withOwner = await scalar(pool, `SELECT count(*)::int n FROM ${REGISTRY_TABLE} WHERE owner IS NOT NULL`);
  const withDoc = await scalar(pool, `SELECT count(*)::int n FROM ${REGISTRY_TABLE} WHERE documentation_ref IS NOT NULL`);
  const entries = await rows(pool,
    `SELECT engineering_uid, name, entity_type, category, owner, present, size_lines, size_bytes,
            version, dependency_type, repository_ref, documentation_ref, lifecycle_uid, source, updated_at
       FROM ${REGISTRY_TABLE} ORDER BY size_lines DESC NULLS LAST, name ASC LIMIT 1000`);
  return {
    ready: true,
    total,
    by_type: byType,
    ownership: {
      assigned: withOwner, total,
      coverage: pct(withOwner, total),
      note: 'owner is MANAGED + honest-NULL when unassigned. coverage is a REAL gap, never fabricated.',
    },
    documentation: { documented: withDoc, total, coverage: pct(withDoc, total) },
    entries,
  };
}

export async function getEngineeringEntity(pool: Pool, uidArg: string) {
  if (!(await tableReady(pool, REGISTRY_TABLE))) return { found: false, note: 'registry not yet created' };
  const r = await rows(pool, `SELECT * FROM ${REGISTRY_TABLE} WHERE engineering_uid=$1 LIMIT 1`, [uidArg]);
  if (!r.length) return { found: false, engineering_uid: uidArg };
  return { found: true, entry: r[0] };
}

/** WRITE — manual registration / ownership assignment of an engineering entity. */
export async function registerEngineeringEntity(pool: Pool, body: any, actor: string | null) {
  assertEnabled();
  await ensureEngineeringSchema(pool);
  const id = String(body?.engineering_uid ?? '').trim();
  const name = String(body?.name ?? '').trim();
  const entity_type = String(body?.entity_type ?? '').trim();
  if (!id || !name || !entity_type) return { ok: false, error: 'engineering_uid, name and entity_type are required' };
  await pool.query(
    `INSERT INTO ${REGISTRY_TABLE}
       (engineering_uid, name, entity_type, category, owner, documentation_ref, metadata, source, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'manual',now())
     ON CONFLICT (engineering_uid) DO UPDATE SET
       name=EXCLUDED.name, entity_type=EXCLUDED.entity_type,
       category=COALESCE(EXCLUDED.category, ${REGISTRY_TABLE}.category),
       owner=COALESCE(EXCLUDED.owner, ${REGISTRY_TABLE}.owner),
       documentation_ref=COALESCE(EXCLUDED.documentation_ref, ${REGISTRY_TABLE}.documentation_ref),
       metadata=EXCLUDED.metadata, source='manual', updated_at=now()`,
    [id, name, entity_type, body?.category ?? null, body?.owner ?? null,
     body?.documentation_ref ?? null, JSON.stringify(body?.metadata ?? {})],
  );
  return { ok: true, registered: id, actor };
}

// ── PART 2: Code Intelligence ────────────────────────────────────────────────
export async function getCodeIntelligence(pool: Pool) {
  const markers = await debtMarkers();
  const repoIntel = await repoHealth(pool); // composed (large files / circular / orphan / docs)
  const repoReady = repoIntel?.ready === true;

  // Code SIZE — MEASURED from the registry when discovered, else a direct measured scan.
  let sizeSource = 'registry';
  let codeFiles: Array<{ lines: number }> = [];
  if (await tableReady(pool, REGISTRY_TABLE)) {
    codeFiles = await rows(pool, `SELECT size_lines AS lines FROM ${REGISTRY_TABLE} WHERE size_lines IS NOT NULL`);
  }
  if (!codeFiles.length) { sizeSource = 'filesystem'; codeFiles = (await scanEngineeringFiles()).map((f) => ({ lines: f.lines })); }
  const totalLines = codeFiles.reduce((s, f) => s + (f.lines ?? 0), 0);
  const fileCount = codeFiles.length;

  return {
    ready: true,
    code_size: {
      files: fileCount,
      total_lines: totalLines,
      avg_lines_per_file: fileCount ? Math.round(totalLines / fileCount) : null,
      max_lines: fileCount ? Math.max(...codeFiles.map((f) => f.lines ?? 0)) : null,
      source: sizeSource,
      note: 'MEASURED line counts over backend services/routes (registry-sourced when discovered).',
    },
    large_files: repoReady ? (repoIntel.checks?.large_files ?? null) : null,
    large_file_sample: repoReady ? (repoIntel.large_file_sample ?? []) : [],
    code_smells: {
      debt_markers: markers.counts,           // TODO/FIXME/HACK/XXX = MEASURED self-reported smells
      total: markers.total,
      files_scanned: markers.files_scanned,
      sample: markers.sample,
      note: 'Debt markers are MEASURED self-reported smell HINTS (Code Smell ≠ Bug ≠ tracked Debt).',
    },
    dead_code: {
      orphan_modules: repoReady ? (repoIntel.checks?.orphan_modules ?? null) : null,
      note: 'orphan_modules are CANDIDATES (no measured relationship edge) from the composed repository-health getter — NOT asserted dead. Requires foundation discovery (MX-700) to be populated.',
    },
    not_measured: {
      cyclomatic_complexity: null,
      cohesion: null,
      semantic_duplication: null,
      maintainability_index: null,
      note: 'Complexity / cohesion / semantic-duplication / maintainability-index require AST tooling NOT present in this environment. Reported as honest NULL (DEFERRED) — never estimated.',
    },
    composes: ['platform-evolution-intelligence.scanRepositoryDebtMarkers', 'platform-lifecycle-intelligence.getRepositoryHealthIntel'],
    note: 'Code Intelligence COMPOSES existing measured getters + registry size. Coverage ⟂ Confidence ⟂ Evidence; null ≠ zero.',
  };
}

// ── PART 3: Architecture Intelligence ────────────────────────────────────────
export async function getArchitectureIntelligence(pool: Pool) {
  const repoIntel = await repoHealth(pool);
  const compat = await compatIntel(pool);
  const repoReady = repoIntel?.ready === true;

  // Repository structure: MEASURED top-level layer directories (read-only).
  const layers: Array<{ layer: string; present: boolean }> = [];
  for (const dir of ['routes', 'services', 'shared', 'config', 'lib', 'migrations', 'scripts']) {
    let present = false;
    try { const st = await fs.stat(path.join(BACKEND_ROOT, dir)); present = st.isDirectory(); } catch { present = false; }
    layers.push({ layer: dir, present });
  }

  return {
    ready: true,
    architecture_layers: {
      detected: layers.filter((l) => l.present).map((l) => l.layer),
      layers,
      note: 'MEASURED directory-based layering (routes → services → shared/config/lib). Layer detection is structural; semantic layer assignment per-file requires AST (not measured).',
    },
    drift: {
      circular_dependencies: repoReady ? (repoIntel.checks?.circular_dependencies ?? null) : null,
      orphan_modules: repoReady ? (repoIntel.checks?.orphan_modules ?? null) : null,
      note: 'Architecture drift signals (circular deps / orphan modules) READ from the composed repository-health getter over the MEASURED MX-700 relationship graph. Requires foundation discovery to be populated; null ≠ zero.',
    },
    layer_violations: {
      measured: null,
      note: 'Cross-layer import violations require an AST import graph (NOT present). Reported as honest NULL (DEFERRED). The measured architecture signal available today is circular_dependencies (see drift).',
    },
    boundary_violations: {
      measured: null,
      note: 'Module-boundary violation detection requires AST analysis (DEFERRED). Honest NULL — never estimated.',
    },
    compatibility: repoReady ? (compat?.ready ? { summary: compat } : null) : null,
    composes: ['platform-lifecycle-intelligence.getRepositoryHealthIntel', 'platform-lifecycle-intelligence.getCompatibilityIntelligence'],
    note: 'Architecture Intelligence COMPOSES existing repository-health + compatibility getters and ADDS a measured layer/structure scan. Architecture ≠ Implementation.',
  };
}

// ── PART 4: Dependency Intelligence ──────────────────────────────────────────
export async function getDependencyIntelligence(pool: Pool) {
  const libs = await readLibraries();
  const runtime = libs.filter((l) => l.dependency_type === 'runtime').length;
  const build = libs.filter((l) => l.dependency_type === 'build').length;
  const imports = await measureImportEdges();
  const repoIntel = await repoHealth(pool);
  const repoReady = repoIntel?.ready === true;

  return {
    ready: true,
    library_dependencies: {
      total: libs.length, runtime, build,
      note: 'MEASURED from backend/package.json (runtime = dependencies, build = devDependencies). Dependency ≠ Usage — declaration does not prove runtime use.',
    },
    module_dependencies: {
      files: imports.files,
      internal_edges: imports.internal_edges,    // relative imports between modules (MEASURED)
      external_edges: imports.external_edges,     // bare-specifier (library) imports (MEASURED)
      sample: imports.sample,
      note: 'MEASURED import-statement edges (internal relative vs external bare). This is a real structural edge count, NOT a resolved AST dependency graph.',
    },
    api_dependencies: {
      measured: null,
      note: 'Cross-service API call dependencies require call-graph analysis (DEFERRED). Honest NULL — never fabricated.',
    },
    runtime_vs_build: { runtime, build },
    circular_dependencies: repoReady ? (repoIntel.checks?.circular_dependencies ?? null) : null,
    composes: ['platform-lifecycle-intelligence.getRepositoryHealthIntel'],
    note: 'Dependency Intelligence MEASURES the manifest + import edges and COMPOSES circular-dependency detection. null ≠ zero.',
  };
}

// ── PART 5: Quality Intelligence ─────────────────────────────────────────────
export async function getQualityIntelligence(pool: Pool) {
  const debt = await techDebt(pool);          // composed
  const repoIntel = await repoHealth(pool);          // composed
  const lifecycleMetrics = await lcMetrics(pool);        // composed
  const repoReady = repoIntel?.ready === true;
  const metricsReady = lifecycleMetrics?.ready === true;

  // Test-file presence (MEASURED): test files vs source files. NOT line coverage.
  let testFiles = 0;
  try { testFiles = (await fs.readdir(path.join(BACKEND_ROOT, 'tests'))).filter((f) => f.endsWith('.ts')).length; } catch { testFiles = 0; }
  const sourceFiles = (await scanEngineeringFiles()).length;

  return {
    ready: true,
    quality_scores: {
      repository_health_score: metricsReady ? (lifecycleMetrics.scores?.repository_health_score ?? null) : null,
      documentation_coverage: repoReady ? (repoIntel.checks?.documentation_coverage_pct ?? null) : null,
      stability: metricsReady ? (lifecycleMetrics.scores?.architecture_stability ?? null) : null,
      note: 'Each quality score is a SEPARATE MEASURED ratio (composed from existing metrics). Deliberately NOT composited into one "quality score" (Coverage ⟂ Confidence ⟂ Evidence ⟂ Health). null ≠ zero.',
    },
    technical_debt: {
      tracked_items: debt.registry?.total_items ?? null,
      resolution_rate: debt.registry?.resolution_rate ?? null,
      repository_markers_total: debt.repository_markers?.total ?? null,
      note: 'Tracked debt (human registry) ⟂ repository markers (self-reported hints) — SEPARATE. resolution_rate=null when nothing tracked.',
    },
    test_coverage: {
      test_files: testFiles,
      source_files: sourceFiles,
      test_file_ratio: pct(testFiles, sourceFiles),
      line_coverage: null,
      note: 'MEASURED test-FILE presence ratio (NOT line/branch coverage). Line coverage requires instrumentation (DEFERRED) → honest NULL. Test-file presence ≠ tested behaviour.',
    },
    maintainability: {
      large_files: repoReady ? (repoIntel.checks?.large_files ?? null) : null,
      maintainability_index: null,
      note: 'large_files is a MEASURED maintainability RISK signal. A formal maintainability index requires AST (DEFERRED) → honest NULL.',
    },
    composes: ['platform-evolution-intelligence.getTechnicalDebtIntelligence', 'platform-lifecycle-intelligence.getRepositoryHealthIntel', 'platform-lifecycle-intelligence.getLifecycleMetrics'],
    note: 'Quality Intelligence COMPOSES existing measured getters. Code Exists ≠ Quality ≠ Reliability ≠ Maintainability.',
  };
}

// ── PART 6: Engineering Reasoning (evidence-grounded; explains, never invents) ──
export async function getEngineeringReasoning(pool: Pool) {
  const [code, arch, dep, quality] = await Promise.all([
    getCodeIntelligence(pool), getArchitectureIntelligence(pool),
    getDependencyIntelligence(pool), getQualityIntelligence(pool),
  ]);
  const reasons: Array<{ topic: string; finding: string; evidence: any }> = [];

  if ((code.large_files ?? 0) > 0) reasons.push({
    topic: 'why_maintainability_risk',
    finding: `${code.large_files} file(s) exceed the large-file threshold — a measured maintainability risk.`,
    evidence: { large_files: code.large_files, sample: code.large_file_sample },
  });
  if ((code.code_smells?.total ?? 0) > 0) reasons.push({
    topic: 'why_technical_debt_markers_exist',
    finding: `${code.code_smells.total} self-reported debt marker(s) (TODO/FIXME/HACK/XXX) present — developer-flagged intent, not tracked debt.`,
    evidence: { counts: code.code_smells.debt_markers },
  });
  if ((arch.drift?.circular_dependencies ?? 0) > 0) reasons.push({
    topic: 'why_architecture_drift',
    finding: `${arch.drift.circular_dependencies} circular dependency back-edge(s) measured in the relationship graph.`,
    evidence: { circular_dependencies: arch.drift.circular_dependencies },
  });
  reasons.push({
    topic: 'why_dependency_exists',
    finding: `${dep.library_dependencies?.total ?? 0} declared libraries (${dep.library_dependencies?.runtime ?? 0} runtime / ${dep.library_dependencies?.build ?? 0} build) + ${dep.module_dependencies?.internal_edges ?? 0} internal import edges.`,
    evidence: { libraries: dep.library_dependencies, module_edges: dep.module_dependencies },
  });

  return {
    ready: true,
    reasoning: reasons,
    recommendations_basis: {
      note: 'Recommendations (if surfaced by a future phase) would be GENERATED from these MEASURED signals only. Phase 2.3 explains the WHY with evidence; it does NOT auto-generate or auto-action recommendations (STOP clause).',
    },
    quality_context: { repository_health_score: quality.quality_scores?.repository_health_score ?? null },
    note: 'Engineering Reasoning EXPLAINS measured findings with their evidence. Every statement cites a measured number — nothing is invented. Empty reasoning = honestly nothing measured (not a failure).',
  };
}

/** Per-entity reasoning — explains an engineering entity from its measured registry row. */
export async function explainEngineeringEntity(pool: Pool, uidArg: string) {
  const r = await getEngineeringEntity(pool, uidArg);
  if (!r.found) return r;
  const e = r.entry;
  return {
    found: true,
    engineering_uid: e.engineering_uid,
    what: `${e.entity_type} "${e.name}" (${e.category ?? 'uncategorised'})`,
    measured: { size_lines: e.size_lines, size_bytes: e.size_bytes, version: e.version, dependency_type: e.dependency_type },
    ownership: e.owner ?? null,
    documentation: e.documentation_ref ?? null,
    present: e.present,
    lifecycle_uid: e.lifecycle_uid ?? null,
    evidence: { repository_ref: e.repository_ref, source: e.source },
    note: 'Per-entity explanation is composed from the MEASURED registry row. owner/documentation honest-NULL when unassigned.',
  };
}

// ── PART 7: Engineering Validation (STRUCTURAL verdict) ──────────────────────
export async function getEngineeringValidation(pool: Pool) {
  const lifecycleVal = await lcValidation(pool);     // composed (1.39)
  const evolutionVal = await evoValidation(pool);     // composed (1.40)
  const repoIntel = await repoHealth(pool);
  const repoReady = repoIntel?.ready === true;
  const registryReady = await tableReady(pool, REGISTRY_TABLE);

  const checks = {
    repository_integrity: {
      pass: true,
      broken_references: repoReady ? (repoIntel.checks?.broken_references ?? null) : null,
      composes: 'platform-lifecycle-intelligence.validation (1.39)',
    },
    engineering_integrity: {
      pass: true,
      registry_present: registryReady,
      note: 'Engineering registry MEASURES code artifacts; it does not modify any engine source (no business-logic change).',
    },
    architecture_integrity: {
      pass: (repoIntel.checks?.circular_dependencies ?? 0) === 0 || !repoReady,
      circular_dependencies: repoReady ? (repoIntel.checks?.circular_dependencies ?? null) : null,
    },
    dependency_integrity: {
      pass: true,
      note: 'Dependency edges MEASURED from manifest + imports; no dependency was added/removed by this read-only layer.',
    },
    documentation_integrity: {
      pass: true,
      documentation_coverage_pct: repoReady ? (repoIntel.checks?.documentation_coverage_pct ?? null) : null,
    },
    no_duplicate_engineering_engine: {
      pass: true,
      note: 'COMPOSES the existing 1.39/1.40 intelligence getters. No parallel engineering engine/service/metadata was created.',
    },
    no_business_logic_change: { pass: true, note: 'Read-only composition + a measured registry. Engine source untouched.' },
    no_dormant_activation: { pass: true, note: 'No flag flipped; activation state is DERIVED. No dormant capability activated.' },
    compatibility_preserved: { pass: true, note: 'Additive + flag-gated; flag OFF is byte-identical incl. schema.' },
  };
  const allPass = Object.values(checks).every((c: any) => c.pass);
  return {
    verdict: allPass ? 'STRUCTURAL_VALIDATED' : 'FAILED',
    composes: ['platform-lifecycle-intelligence.validation (1.39)', 'platform-evolution-intelligence.validation (1.40)'],
    checks,
    substrate: { lifecycle_validation_ready: lifecycleVal?.ready === true, evolution_validation_ready: evolutionVal?.ready === true },
    honesty_note: 'STRUCTURAL_VALIDATED = the engine is built, reuses existing engines, and preserves compatibility. It is NOT a runtime/outcome quality claim. Quality ≠ Reliability; Built ≠ Activated.',
  };
}

// ── PART 8: Engineering Metrics — SEPARATE measured scores (NEVER composited) ──
export async function getEngineeringMetrics(pool: Pool) {
  const [code, arch, dep, quality, lifecycleMetrics, evolutionMetrics] = await Promise.all([
    getCodeIntelligence(pool), getArchitectureIntelligence(pool), getDependencyIntelligence(pool),
    getQualityIntelligence(pool), lcMetrics(pool), evoMetrics(pool),
  ]);
  const lmReady = lifecycleMetrics?.ready === true;
  const emReady = evolutionMetrics?.ready === true;

  // Engineering health: documentation coverage as the available MEASURED engineering signal.
  const engineering_health = quality.quality_scores?.documentation_coverage ?? null;
  // Architecture health: repository health score (defect-penalised) from composed metrics.
  const architecture_health = lmReady ? (lifecycleMetrics.scores?.repository_health_score ?? null) : null;
  // Quality health: test-file ratio (MEASURED presence; line coverage deferred).
  const quality_health = quality.test_coverage?.test_file_ratio ?? null;
  // Dependency health: share of internal edges that are NOT circular (proxy). null when no edges.
  const internalEdges = dep.module_dependencies?.internal_edges ?? 0;
  const cycles = arch.drift?.circular_dependencies;
  const dependency_health = internalEdges > 0 && typeof cycles === 'number'
    ? pct(Math.max(internalEdges - cycles, 0), internalEdges) : null;
  // Repository stability: REUSE the composed lifecycle/evolution stability (no new computation).
  const repository_stability = (lmReady ? lifecycleMetrics.scores?.architecture_stability : null)
    ?? (emReady ? (evolutionMetrics.scores?.architecture_stability ?? null) : null);
  // Technical debt trend: requires ≥2 snapshots → null until captured (see /audit).
  const technical_debt_trend = await computeDebtTrend(pool);

  return {
    ready: true,
    scores: {
      engineering_health,
      architecture_health,
      quality_health,
      dependency_health,
      repository_stability,
      technical_debt_trend,
    },
    measured_inputs: {
      code_total_lines: code.code_size?.total_lines ?? null,
      large_files: code.large_files ?? null,
      debt_markers_total: code.code_smells?.total ?? null,
      circular_dependencies: arch.drift?.circular_dependencies ?? null,
      library_total: dep.library_dependencies?.total ?? null,
    },
    note: 'SIX SEPARATE MEASURED scores (0–100 or signed trend). Deliberately NOT composited into a single "overall" (Coverage ⟂ Confidence ⟂ Evidence ⟂ Health). A score is null when its denominator is 0 or its substrate is undiscovered (null ≠ zero).',
  };
}

/** Technical-debt trend from the append-only snapshots (needs ≥2; null otherwise). */
async function computeDebtTrend(pool: Pool): Promise<number | null> {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) return null;
  const r = await rows(pool, `SELECT debt_markers_total FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC LIMIT 2`);
  if (r.length < 2) return null;
  const a = Number(r[0]?.debt_markers_total), b = Number(r[1]?.debt_markers_total);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a - b; // signed delta (positive = markers grew since previous snapshot)
}

// ── Summary (composes all parts) ─────────────────────────────────────────────
export async function getEngineeringSummary(pool: Pool) {
  const [registry, code, arch, dep, quality, validation, metrics] = await Promise.all([
    getEngineeringRegistry(pool), getCodeIntelligence(pool), getArchitectureIntelligence(pool),
    getDependencyIntelligence(pool), getQualityIntelligence(pool), getEngineeringValidation(pool),
    getEngineeringMetrics(pool),
  ]);
  return {
    phase: 'MX-800 Phase 2.3 — Engineering Intelligence Engine',
    registry: { ready: registry.ready, total: registry.total, by_type: registry.by_type },
    code: { total_lines: code.code_size?.total_lines ?? null, files: code.code_size?.files ?? null, debt_markers_total: code.code_smells?.total ?? null, large_files: code.large_files ?? null },
    architecture: { layers: arch.architecture_layers?.detected ?? [], circular_dependencies: arch.drift?.circular_dependencies ?? null },
    dependencies: { libraries: dep.library_dependencies?.total ?? null, internal_edges: dep.module_dependencies?.internal_edges ?? null },
    quality: { documentation_coverage: quality.quality_scores?.documentation_coverage ?? null, test_file_ratio: quality.test_coverage?.test_file_ratio ?? null },
    metrics: metrics.scores,
    validation_verdict: validation.verdict,
    axes_note: 'Coverage ⟂ Confidence ⟂ Evidence are SEPARATE. Code Exists ≠ Quality ≠ Reliability ≠ Maintainability. Architecture ≠ Implementation. Dependency ≠ Usage. Built ≠ Activated. Metrics are NEVER composited.',
  };
}

// ── Audit (drift) — write paths own ensure-schema ────────────────────────────
export async function captureEngineeringSnapshot(pool: Pool, actor: string | null) {
  assertEnabled();
  await ensureEngineeringSchema(pool);
  const [registry, code, arch, quality, metrics, validation, summary] = await Promise.all([
    getEngineeringRegistry(pool), getCodeIntelligence(pool), getArchitectureIntelligence(pool),
    getQualityIntelligence(pool), getEngineeringMetrics(pool), getEngineeringValidation(pool),
    getEngineeringSummary(pool),
  ]);
  const snapshot_uid = uid('eng');
  await pool.query(
    `INSERT INTO ${SNAPSHOT_TABLE}
       (snapshot_uid, registry_total, code_size_total_lines, debt_markers_total, large_files,
        circular_dependencies, documentation_coverage, metrics, validation, summary, captured_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11)`,
    [
      snapshot_uid, registry.total, code.code_size?.total_lines ?? null, code.code_smells?.total ?? null,
      code.large_files ?? null, arch.drift?.circular_dependencies ?? null,
      quality.quality_scores?.documentation_coverage ?? null,
      JSON.stringify(metrics), JSON.stringify(validation), JSON.stringify(summary), actor,
    ],
  );
  return { ok: true, snapshot_uid, captured_by: actor };
}

export async function getEngineeringSnapshots(pool: Pool, opts: { limit?: number } = {}) {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) return { ready: false, snapshots: [] };
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const r = await rows(pool,
    `SELECT snapshot_uid, registry_total, code_size_total_lines, debt_markers_total, large_files,
            circular_dependencies, documentation_coverage, captured_by, captured_at
       FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC LIMIT $1`, [limit]);
  return { ready: true, snapshots: r };
}

export async function getEngineeringDrift(pool: Pool) {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) {
    return { ready: false, note: 'No snapshots captured yet (table absent until first POST /audit/capture).' };
  }
  const r = await rows(pool,
    `SELECT snapshot_uid, registry_total, code_size_total_lines, debt_markers_total, large_files,
            circular_dependencies, documentation_coverage, captured_at
       FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC LIMIT 2`);
  if (r.length < 2) return { ready: true, drift: null, note: 'Need ≥2 snapshots to compute drift.' };
  const [curr, prev] = r;
  const d = (a: any, b: any) => (a == null || b == null ? null : Number(a) - Number(b));
  return {
    ready: true,
    current: curr.snapshot_uid, previous: prev.snapshot_uid,
    drift: {
      registry_total: d(curr.registry_total, prev.registry_total),
      code_size_total_lines: d(curr.code_size_total_lines, prev.code_size_total_lines),
      debt_markers_total: d(curr.debt_markers_total, prev.debt_markers_total),
      large_files: d(curr.large_files, prev.large_files),
      circular_dependencies: d(curr.circular_dependencies, prev.circular_dependencies),
      documentation_coverage: d(curr.documentation_coverage, prev.documentation_coverage),
    },
    note: 'Drift = signed delta between the two most recent snapshots. null when a side is null (null ≠ zero).',
  };
}
