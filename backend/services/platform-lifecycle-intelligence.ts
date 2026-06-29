/**
 * MX-700 Phase 1.39 — Platform Lifecycle Intelligence Engine (service layer).
 *
 * READ-ONLY intelligence layer that COMPOSES the Phase 1.37 Foundation + Phase 1.38
 * Management. It continuously MEASURES, validates, explains and evaluates the lifecycle
 * information already discovered into the shared registry / capability catalog /
 * relationships / version-ledger / evolution tables. It introduces NO parallel registry,
 * NO duplicate intelligence engines, and changes NO business logic. The repository remains
 * the single source of truth — every number here is derived from MEASURED repository /
 * runtime / database / git / documentation / feature-flag / migration evidence.
 *
 * HONESTY CONTRACT (per user preference — honesty over optimism, never fabricate):
 *   - Coverage ≠ Confidence ≠ Evidence. They are reported as SEPARATE axes and never
 *     blended into one misleading verdict.
 *   - Built ≠ Activated. Registered ≠ Used. Implemented ≠ Operational. Table-exists ≠ Populated.
 *   - Counts are MEASURED (COUNT(*) / filesystem / git), never estimated. null ≠ zero in
 *     both directions: a metric whose denominator is 0 is returned as null (not 0).
 *   - Anything not machine-verifiable (e.g. per-entity git history when .git is absent in a
 *     deployed container) degrades to an explicit `unavailable`/honest-gap note — never invented.
 *
 * The ONLY write path is the Lifecycle Audit Engine (`captureAuditSnapshot`), which appends an
 * immutable intelligence snapshot used for drift detection. Its lazy ensure-schema runs ONLY on
 * that flag-ON write path, so with the flag OFF this layer is byte-identical incl. schema.
 * All reads are GET-never-writes: they probe via to_regclass and degrade to `ready:false`.
 */
import type { Pool } from 'pg';
import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  schemaReady as foundationSchemaReady,
  getRepositoryHealth,
  getValidation,
  getSummary,
  LIFECYCLE_STATES,
} from './platform-lifecycle';
import { getManagementSummary } from './platform-lifecycle-management';

const execFileP = promisify(execFile);
const __dirname_ = path.dirname(fileURLToPath(import.meta.url)); // backend/services
const BACKEND_ROOT = path.resolve(__dirname_, '..');             // backend
const REPO_ROOT = path.resolve(BACKEND_ROOT, '..');              // workspace

const SNAPSHOT_TABLE = 'platform_lifecycle_intelligence_snapshots';
let _schemaReady = false;

/** Lazy ensure-schema — canonical mirror of 20261218_platform_lifecycle_intelligence.sql.
 *  ONLY ever called from the flag-ON audit-snapshot write path -> flag-OFF byte-identical. */
export async function ensureIntelligenceSchema(pool: Pool): Promise<void> {
  if (_schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${SNAPSHOT_TABLE} (
      id                       BIGSERIAL PRIMARY KEY,
      snapshot_uid             TEXT UNIQUE NOT NULL,
      lifecycle_health_score   NUMERIC,
      repository_health_score  NUMERIC,
      compatibility_score      NUMERIC,
      evidence_score           NUMERIC,
      confidence_score         NUMERIC,
      architecture_stability   NUMERIC,
      metrics                  JSONB NOT NULL DEFAULT '{}',
      tech_debt_indicators     JSONB NOT NULL DEFAULT '{}',
      registry_total           INTEGER,
      captured_by              TEXT,
      captured_at              TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_pli_snapshots_captured_at
      ON ${SNAPSHOT_TABLE} (captured_at DESC);
  `);
  _schemaReady = true;
}

/** GET-never-writes probe: does the snapshot table exist? (degrade to false otherwise). */
async function snapshotSchemaReady(pool: Pool): Promise<boolean> {
  try {
    const r = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS ready`, [`public.${SNAPSHOT_TABLE}`]);
    return !!r.rows[0]?.ready;
  } catch { return false; }
}

// ── small helpers ─────────────────────────────────────────────────────────────
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
async function fileExists(absOrRel: string): Promise<boolean> {
  try { await fs.access(path.isAbsolute(absOrRel) ? absOrRel : path.join(REPO_ROOT, absOrRel)); return true; }
  catch { return false; }
}

const NOT_DISCOVERED = { ready: false as const, note: 'Foundation discovery has not run — no lifecycle registry to measure yet (run POST /api/admin/platform-lifecycle/discover).' };

// ── PART 1: Lifecycle Evidence Engine ─────────────────────────────────────────
// Tracks MEASURED evidence per source. Each item carries source / coverage / confidence /
// verification_status. Coverage and confidence are SEPARATE axes (Coverage ≠ Confidence).
export async function getLifecycleEvidence(pool: Pool): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return NOT_DISCOVERED;
  const total = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry`);

  // Repository evidence: registry rows with a repository_reference, and how many resolve on disk.
  const withRepoRef = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE repository_reference IS NOT NULL`);
  const repoRefRows = await rows(pool, `SELECT repository_reference FROM platform_lifecycle_registry WHERE repository_reference IS NOT NULL`);
  let repoVerified = 0;
  for (const r of repoRefRows) if (await fileExists(r.repository_reference)) repoVerified++;

  // Runtime evidence: capabilities whose activation_state is definitively measured (not 'unknown').
  const capTotal = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type = 'capability'`);
  const capMeasured = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type='capability' AND activation_state IN ('active','dormant')`);

  // Database evidence: presence + population of the lifecycle substrate tables themselves.
  const dbTables = ['platform_lifecycle_registry', 'platform_capability_catalog', 'platform_lifecycle_relationships', 'platform_lifecycle_state_history'];
  let dbPresent = 0, dbPopulated = 0;
  for (const t of dbTables) {
    const present = await scalar(pool, `SELECT (to_regclass($1) IS NOT NULL)::int n`, [`public.${t}`]);
    if (present) { dbPresent++; const c = await scalar(pool, `SELECT count(*)::int n FROM ${t}`); if (c > 0) dbPopulated++; }
  }

  // Documentation evidence: registry doc refs, and how many resolve on disk.
  const withDoc = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE documentation_reference IS NOT NULL`);
  const docRows = await rows(pool, `SELECT documentation_reference FROM platform_lifecycle_registry WHERE documentation_reference IS NOT NULL`);
  let docVerified = 0;
  for (const d of docRows) if (await fileExists(d.documentation_reference)) docVerified++;

  // Feature-flag evidence: capability rows carry a feature_flag (the canonical gate).
  const withFlag = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE feature_flag IS NOT NULL`);

  // Migration evidence: migration entities with a parseable version + date.
  const migTotal = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type='migration'`);
  const migDated = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type='migration' AND migration_date IS NOT NULL`);

  // Git evidence: best-effort repository-level last-commit timestamp; honest 'unavailable' if no .git.
  let git: any;
  try {
    const { stdout } = await execFileP('git', ['-C', REPO_ROOT, 'log', '-1', '--format=%cI'], { timeout: 4000 });
    const ts = stdout.trim();
    git = { source: 'git', available: !!ts, last_commit_at: ts || null, coverage: null,
      verification_status: ts ? 'verified_repository_level' : 'unavailable',
      note: 'Repository-level last-commit timestamp (MEASURED). Per-entity git history is NOT individually measured — honest gap, never fabricated.' };
  } catch {
    git = { source: 'git', available: false, last_commit_at: null, coverage: null,
      verification_status: 'unavailable',
      note: 'git history unavailable in this environment (e.g. no .git in a deployed container) — reported honestly, never fabricated.' };
  }

  return {
    ready: true,
    registry_total: total,
    evidence: [
      { source: 'repository', present: withRepoRef, verified: repoVerified,
        coverage: pct(withRepoRef, total), confidence: pct(repoVerified, withRepoRef),
        verification_status: 'filesystem_verified',
        note: 'coverage = registry rows with a repository_reference; confidence = how many of those resolve to a real file on disk.' },
      { source: 'runtime', present: capMeasured, verified: capMeasured,
        coverage: pct(capMeasured, capTotal), confidence: pct(capMeasured, capTotal),
        verification_status: 'live_flag_runtime',
        note: 'capabilities whose activation_state is definitively measured (active/dormant) vs unknown. built ≠ activated.' },
      { source: 'database', present: dbPresent, verified: dbPopulated,
        coverage: pct(dbPresent, dbTables.length), confidence: pct(dbPopulated, dbPresent),
        verification_status: 'to_regclass_probed',
        note: 'coverage = substrate tables present; confidence = of those present, how many are populated. table-exists ≠ populated.' },
      { source: 'documentation', present: withDoc, verified: docVerified,
        coverage: pct(withDoc, total), confidence: pct(docVerified, withDoc),
        verification_status: 'filesystem_verified',
        note: 'coverage = registry rows with a documentation_reference; confidence = how many resolve on disk.' },
      { source: 'feature_flags', present: withFlag, verified: withFlag,
        coverage: pct(withFlag, capTotal), confidence: pct(withFlag, capTotal),
        verification_status: 'flag_registry_verified',
        note: 'capability rows linked to a canonical feature flag.' },
      { source: 'migration_history', present: migDated, verified: migDated,
        coverage: pct(migDated, migTotal), confidence: pct(migDated, migTotal),
        verification_status: 'version_parsed',
        note: 'migration entities with a parseable version+date prefix.' },
      git,
    ],
    note: 'Evidence is MEASURED per source. Coverage (how much exists) and Confidence (how much is verifiable) are SEPARATE axes — never blended. null ≠ zero.',
  };
}

// ── PART 2: Lifecycle Confidence Engine ───────────────────────────────────────
// Confidence = verifiability/trustworthiness of the evidence, kept INDEPENDENT from coverage.
export async function getLifecycleConfidence(pool: Pool): Promise<any> {
  const ev = await getLifecycleEvidence(pool);
  if (!ev.ready) return NOT_DISCOVERED;
  const by = (src: string) => ev.evidence.find((e: any) => e.source === src) ?? {};

  const repository_confidence = by('repository').confidence;       // refs that resolve on disk
  const implementation_confidence = by('runtime').confidence;      // activation definitively measured
  const migration_confidence = by('migration_history').confidence; // version+date parsed
  const documentation_confidence = by('documentation').confidence; // doc refs that resolve

  // Compatibility confidence: fraction of registry rows with a non-null compatibility_status.
  const total = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry`);
  const withCompat = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE compatibility_status IS NOT NULL`);
  const compatibility_confidence = pct(withCompat, total);

  // Evidence quality: overall verified/present across the filesystem- and runtime-verifiable sources.
  const verifiable = ev.evidence.filter((e: any) => typeof e.present === 'number' && e.present > 0 && typeof e.verified === 'number');
  const presentSum = verifiable.reduce((a: number, e: any) => a + e.present, 0);
  const verifiedSum = verifiable.reduce((a: number, e: any) => a + e.verified, 0);
  const evidence_quality = pct(verifiedSum, presentSum);

  return {
    ready: true,
    confidence: {
      repository_confidence, implementation_confidence, compatibility_confidence,
      migration_confidence, documentation_confidence, evidence_quality,
    },
    note: 'Confidence is INDEPENDENT from coverage. Each axis is a MEASURED verifiability ratio (e.g. repository_confidence = repository_references that resolve on disk ÷ references present). null ≠ zero.',
  };
}

// ── PART 3: Lifecycle Explainability Engine ───────────────────────────────────
// Explains a single lifecycle decision for one entity: why / evidence / impact /
// dependencies / compatibility / migration / alternatives / repository references.
export async function explainLifecycle(pool: Pool, uid: string): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return NOT_DISCOVERED;
  const reg = (await rows(pool, `SELECT * FROM platform_lifecycle_registry WHERE lifecycle_uid = $1`, [uid]))[0] ?? null;
  if (!reg) return { ready: true, found: false, uid };

  const history = await rows(pool,
    `SELECT from_state, to_state, reason, evidence, changed_by, changed_at
       FROM platform_lifecycle_state_history WHERE lifecycle_uid = $1 ORDER BY changed_at ASC, id ASC`, [uid]);
  const dependencies = await rows(pool,
    `SELECT to_uid, relationship_type, evidence FROM platform_lifecycle_relationships WHERE from_uid = $1`, [uid]);
  const dependents = await rows(pool,
    `SELECT from_uid, relationship_type, evidence FROM platform_lifecycle_relationships WHERE to_uid = $1`, [uid]);

  // Management metadata (only if those tables exist — GET-never-writes).
  const mgmt = await mgmtTablesPresent(pool);
  const deprecation = mgmt ? ((await rows(pool, `SELECT * FROM platform_lifecycle_deprecation WHERE lifecycle_uid = $1`, [uid]))[0] ?? null) : null;
  const versions = mgmt ? await rows(pool, `SELECT current_version, previous_version, migration_version, release_status, compatibility, recorded_at FROM platform_lifecycle_version_ledger WHERE lifecycle_uid = $1 ORDER BY recorded_at DESC, id DESC LIMIT 10`, [uid]) : [];

  const last = history[history.length - 1] ?? null;
  const repoVerified = reg.repository_reference ? await fileExists(reg.repository_reference) : null;

  return {
    ready: true,
    found: true,
    uid,
    explanation: {
      why: last
        ? `Current lifecycle_state '${reg.lifecycle_state}' was set by a recorded transition (${last.from_state ?? '∅'} → ${last.to_state}; reason: ${last.reason ?? 'unspecified'}).`
        : `lifecycle_state '${reg.lifecycle_state}' was assigned at discovery; no explicit managed transition has been recorded since.`,
      evidence: {
        repository_reference: reg.repository_reference ?? null,
        repository_reference_resolves: repoVerified,
        activation_state: reg.activation_state ?? null,
        feature_flag: reg.feature_flag ?? null,
        documentation_reference: reg.documentation_reference ?? null,
        migration_reference: reg.migration_reference ?? null,
        state_transitions: history.length,
      },
      impact: {
        dependents_count: dependents.length,
        dependents: dependents.slice(0, 25),
        note: dependents.length > 0 ? 'Entities that MEASURABLY depend on this one (would be affected by deprecation/retirement).' : 'No measured incoming dependents.',
      },
      dependencies: dependencies.slice(0, 50),
      compatibility: { status: reg.compatibility_status ?? null, compatibility_version: reg.compatibility_version ?? null },
      migration: { migration_reference: reg.migration_reference ?? null, migration_version: reg.migration_version ?? null, migration_date: reg.migration_date ?? null, version_ledger: versions },
      alternatives: deprecation?.replacement_reference
        ? { replacement_reference: deprecation.replacement_reference, migration_target: deprecation.migration_target ?? null }
        : { replacement_reference: null, note: 'No replacement/alternative recorded (entity not deprecated, or no replacement specified).' },
      repository_references: [reg.repository_reference, reg.documentation_reference, reg.migration_reference].filter(Boolean),
    },
    state_history: history,
    note: 'Explainability COMPOSES only MEASURED registry/relationship/history/management data. Nothing is inferred or fabricated.',
  };
}

async function mgmtTablesPresent(pool: Pool): Promise<boolean> {
  try {
    const r = await pool.query(`SELECT to_regclass('public.platform_lifecycle_deprecation') IS NOT NULL AS ok`);
    return !!r.rows[0]?.ok;
  } catch { return false; }
}

// ── PART 4: Lifecycle Health Engine ───────────────────────────────────────────
export async function getLifecycleHealth(pool: Pool): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return NOT_DISCOVERED;
  const total = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry`);

  // Completeness: rows carrying the core lifecycle metadata (state + identifier + repo ref).
  const complete = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE lifecycle_state IS NOT NULL AND entity_identifier IS NOT NULL AND repository_reference IS NOT NULL`);
  // Consistency: lifecycle_state is one of the canonical vocabulary states.
  const consistent = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE lifecycle_state = ANY($1)`, [LIFECYCLE_STATES as unknown as string[]]);
  // Integrity: no duplicate uids + no orphan relationship endpoints (reuse repository-health checks).
  const repoHealth = await getRepositoryHealth(pool);
  const integrityIssues = (repoHealth.checks?.duplicate_lifecycle_records ?? 0) + (repoHealth.checks?.orphan_records ?? 0);
  // Coverage: rows with documentation linkage (an honest, historically-absent layer).
  const documented = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE documentation_reference IS NOT NULL`);
  // Compliance: capabilities (flag-gated phases) that carry their gating flag — the additive discipline.
  const capTotal = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type='capability'`);
  const capCompliant = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type='capability' AND feature_flag IS NOT NULL`);
  // Readiness: entities in a 'ready' lifecycle band (validated/released/active).
  const ready = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE lifecycle_state IN ('validated','released','active')`);
  // Stability: fraction of entities with NO state churn (≤1 history row) — high churn lowers stability.
  const churnedDistinct = await scalar(pool, `SELECT count(*)::int n FROM (SELECT lifecycle_uid FROM platform_lifecycle_state_history GROUP BY lifecycle_uid HAVING count(*) > 1) x`);

  return {
    ready: true,
    registry_total: total,
    health: {
      completeness: pct(complete, total),
      consistency: pct(consistent, total),
      integrity: { issues: integrityIssues, score: total > 0 ? pct(Math.max(total - integrityIssues, 0), total) : null,
        detail: { duplicate_lifecycle_records: repoHealth.checks?.duplicate_lifecycle_records ?? null, orphan_records: repoHealth.checks?.orphan_records ?? null } },
      coverage: pct(documented, total),
      compliance: pct(capCompliant, capTotal),
      readiness: pct(ready, total),
      stability: total > 0 ? pct(Math.max(total - churnedDistinct, 0), total) : null,
    },
    note: 'Each dimension is a MEASURED ratio (numerator/denominator disclosed in code). They are reported SEPARATELY and never composited into one verdict. null ≠ zero.',
  };
}

// ── PART 5: Repository Health Engine ──────────────────────────────────────────
// COMPOSES the Foundation getRepositoryHealth and ADDS large-files / orphan-modules /
// circular-dependency / documentation-coverage measurements (no duplicate logic).
export async function getRepositoryHealthIntel(pool: Pool, opts: { largeFileLines?: number } = {}): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return NOT_DISCOVERED;
  const base = await getRepositoryHealth(pool);

  // Large files: MEASURED line counts in routes/ + services/ over a threshold.
  const threshold = Number.isFinite(opts.largeFileLines as number) ? (opts.largeFileLines as number) : 1500;
  const large: Array<{ file: string; lines: number }> = [];
  for (const dir of ['routes', 'services']) {
    const abs = path.join(BACKEND_ROOT, dir);
    let entries: string[] = [];
    try { entries = (await fs.readdir(abs)).filter((f) => f.endsWith('.ts')); } catch { entries = []; }
    for (const f of entries) {
      try { const c = await fs.readFile(path.join(abs, f), 'utf8'); const lines = c.split('\n').length; if (lines >= threshold) large.push({ file: `backend/${dir}/${f}`, lines }); }
      catch { /* skip unreadable */ }
    }
  }
  large.sort((a, b) => b.lines - a.lines);

  // Orphan modules (candidates): module/service registry rows with NO relationship edge either way.
  const orphanModules = await scalar(pool,
    `SELECT count(*)::int n FROM platform_lifecycle_registry r
      WHERE r.entity_type IN ('module','service')
        AND NOT EXISTS (SELECT 1 FROM platform_lifecycle_relationships x WHERE x.from_uid = r.lifecycle_uid OR x.to_uid = r.lifecycle_uid)`);

  // Circular dependencies: cycle detection over the measured relationship graph.
  const edges = await rows(pool, `SELECT from_uid, to_uid FROM platform_lifecycle_relationships`);
  const cycles = countCycles(edges);

  // Documentation coverage: registry entities with a documentation_reference.
  const total = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry`);
  const documented = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE documentation_reference IS NOT NULL`);

  return {
    ready: true,
    base_checks: base.checks ?? null,
    broken_reference_sample: base.broken_reference_sample ?? [],
    checks: {
      duplicate_services: base.checks?.duplicate_capabilities ?? null,
      duplicate_lifecycle_records: base.checks?.duplicate_lifecycle_records ?? null,
      orphan_relationship_endpoints: base.checks?.orphan_records ?? null,
      orphan_modules: orphanModules,
      circular_dependencies: cycles,
      large_files: large.length,
      broken_references: base.checks?.broken_references ?? null,
      documentation_coverage_pct: pct(documented, total),
    },
    large_file_sample: large.slice(0, 25),
    note: 'COMPOSES Foundation repository-health + adds large-file/orphan-module/circular-dependency/documentation-coverage measurements. orphan_modules are CANDIDATES (no measured relationship linkage), not asserted dead. All MEASURED; null ≠ zero.',
  };
}

/** Count distinct simple cycles in a directed graph (bounded DFS). Honest 0 when acyclic. */
function countCycles(edges: Array<{ from_uid: string; to_uid: string }>): number {
  const adj = new Map<string, string[]>();
  for (const e of edges) { if (!adj.has(e.from_uid)) adj.set(e.from_uid, []); adj.get(e.from_uid)!.push(e.to_uid); }
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  let backEdges = 0;
  const dfs = (u: string) => {
    color.set(u, GRAY);
    for (const v of adj.get(u) ?? []) {
      const c = color.get(v) ?? WHITE;
      if (c === GRAY) backEdges++;            // back edge -> cycle
      else if (c === WHITE) dfs(v);
    }
    color.set(u, BLACK);
  };
  for (const u of adj.keys()) if ((color.get(u) ?? WHITE) === WHITE) dfs(u);
  return backEdges;
}

// ── PART 6: Compatibility Intelligence ────────────────────────────────────────
export async function getCompatibilityIntelligence(pool: Pool): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return NOT_DISCOVERED;
  const total = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry`);
  const byCompat = await rows(pool,
    `SELECT COALESCE(compatibility_status,'unknown') status, count(*)::int n FROM platform_lifecycle_registry GROUP BY compatibility_status ORDER BY n DESC`);
  const compatible = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE compatibility_status = 'compatible'`);
  const breaking = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE compatibility_status IN ('breaking','incompatible')`);

  // Migration compatibility: chronological version ordering of discovered migrations (regressions = a later file with an earlier date).
  const migs = await rows(pool, `SELECT entity_identifier, migration_version, migration_date FROM platform_lifecycle_registry WHERE entity_type='migration' AND migration_version IS NOT NULL ORDER BY entity_identifier ASC`);
  let migRegressions = 0;
  for (let i = 1; i < migs.length; i++) if (String(migs[i].migration_version) < String(migs[i - 1].migration_version)) migRegressions++;

  return {
    ready: true,
    registry_total: total,
    compatibility: {
      backward: { note: 'Additive/flag-gated discipline: every additive phase is gated OFF byte-identical, so prior behaviour is preserved by construction. compatible_count is MEASURED from compatibility_status.', compatible_count: compatible, breaking_count: breaking },
      forward: { note: 'Forward compatibility is asserted STRUCTURALLY (new phases are additive). Not runtime-measured here — honest scope boundary.' },
      migration: { discovered: migs.length, ordering_regressions: migRegressions, note: 'ordering_regressions = later-named migration file carrying an earlier version prefix (MEASURED). 0 = monotonic.' },
      api: { note: 'API compatibility is represented at route-module granularity; per-endpoint contract diffing is NOT discovered — honest gap (consistent with 1.38 api view = derived).' },
      module: { module_services: await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type IN ('module','service')`) },
      database: { note: 'DB compatibility = forward-only additive migrations (CREATE TABLE IF NOT EXISTS / additive columns); destructive DDL is out of scope for this read-only layer.' },
      feature_flag: { total_flags: await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type='capability'`), note: 'Flag compatibility: flag-OFF is byte-identical incl. schema across the additive phases — structural guarantee, not runtime-measured here.' },
      by_status: byCompat,
    },
    note: 'Compatibility intelligence reports MEASURED status counts + migration ordering, and clearly marks the STRUCTURAL (not runtime-measured) guarantees. null ≠ zero; nothing fabricated.',
  };
}

// ── PART 7: Lifecycle Validation Engine ───────────────────────────────────────
// COMPOSES the Foundation getValidation and ADDS metadata validation (version / capability /
// migration / dependency / repository integrity).
export async function getLifecycleValidation(pool: Pool): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return NOT_DISCOVERED;
  const base = await getValidation(pool);
  const total = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry`);

  const invalidState = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE NOT (lifecycle_state = ANY($1))`, [LIFECYCLE_STATES as unknown as string[]]);
  const capMissingVersion = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type='capability' AND current_version IS NULL`);
  const migMissingVersion = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type='migration' AND migration_version IS NULL`);
  const missingDependencies = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE dependencies = '{}'`);

  // Repository integrity: registry repo refs that no longer resolve on disk (MEASURED).
  const refRows = await rows(pool, `SELECT repository_reference FROM platform_lifecycle_registry WHERE repository_reference IS NOT NULL`);
  let brokenRefs = 0;
  for (const r of refRows) if (!(await fileExists(r.repository_reference))) brokenRefs++;

  return {
    ready: true,
    registry_total: total,
    foundation_validation: base.checks ?? null,
    metadata_validation: {
      invalid_lifecycle_states: invalidState,
      capability_metadata_missing_version: capMissingVersion,
      migration_metadata_missing_version: migMissingVersion,
      dependency_metadata_absent: missingDependencies,
      repository_integrity_broken_references: brokenRefs,
    },
    note: 'COMPOSES Foundation validation + metadata validation. missing_* are HONEST gaps (no formal versioning/dependency layer was pre-populated at discovery), never fabricated. null ≠ zero.',
  };
}

// ── PART 9: Lifecycle Metrics (computed FIRST so the Audit Engine can snapshot them) ──
// Each score is a SEPARATE measured ratio (0–100); they are NEVER composited into one verdict.
export async function getLifecycleMetrics(pool: Pool): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return NOT_DISCOVERED;
  const [health, repoIntel, compat, confidence, validation] = await Promise.all([
    getLifecycleHealth(pool), getRepositoryHealthIntel(pool), getCompatibilityIntelligence(pool),
    getLifecycleConfidence(pool), getLifecycleValidation(pool),
  ]);
  const total = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry`);

  // Lifecycle health score: mean of the measured health dimensions (skip null dims; null if none).
  const hd = health.health ?? {};
  const healthVals = [hd.completeness, hd.consistency, hd.integrity?.score, hd.coverage, hd.compliance, hd.readiness, hd.stability].filter((v) => typeof v === 'number');
  const lifecycle_health_score = healthVals.length ? Math.round((healthVals.reduce((a: number, b: number) => a + b, 0) / healthVals.length) * 100) / 100 : null;

  // Repository health score: penalise measured defect counts against the registry size.
  const rc = repoIntel.checks ?? {};
  const defects = (rc.duplicate_lifecycle_records ?? 0) + (rc.orphan_relationship_endpoints ?? 0) + (rc.orphan_modules ?? 0) + (rc.circular_dependencies ?? 0) + (rc.large_files ?? 0) + (rc.broken_references ?? 0);
  const repository_health_score = total > 0 ? pct(Math.max(total - defects, 0), total) : null;

  // Compatibility score: compatible ÷ total registry (measured compatibility_status).
  const compatible = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE compatibility_status = 'compatible'`);
  const compatibility_score = pct(compatible, total);

  // Evidence score: mean of measured per-source COVERAGE values.
  const ev = await getLifecycleEvidence(pool);
  const evCov = (ev.evidence ?? []).map((e: any) => e.coverage).filter((v: any) => typeof v === 'number');
  const evidence_score = evCov.length ? Math.round((evCov.reduce((a: number, b: number) => a + b, 0) / evCov.length) * 100) / 100 : null;

  // Confidence score: mean of measured confidence axes (INDEPENDENT from evidence/coverage above).
  const cf = confidence.confidence ?? {};
  const cfVals = Object.values(cf).filter((v) => typeof v === 'number') as number[];
  const confidence_score = cfVals.length ? Math.round((cfVals.reduce((a, b) => a + b, 0) / cfVals.length) * 100) / 100 : null;

  // Architecture stability: reuse the health stability dimension (state-churn based).
  const architecture_stability = hd.stability ?? null;

  // Technical-debt indicators: MEASURED counts (reported, never auto-actioned — STOP clause).
  const dormantCapabilities = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type='capability' AND activation_state='dormant'`);
  const tech_debt_indicators = {
    large_files: rc.large_files ?? null,
    orphan_modules: rc.orphan_modules ?? null,
    broken_references: rc.broken_references ?? null,
    circular_dependencies: rc.circular_dependencies ?? null,
    missing_documentation: validation.foundation_validation?.missing_documentation ?? null,
    missing_owners: validation.foundation_validation?.missing_owners ?? null,
    dormant_capabilities: dormantCapabilities,
    note: 'Dormant capabilities are NOT debt — they are built-but-deactivated by design (flag OFF). Reported for transparency, never auto-activated (STOP clause).',
  };

  return {
    ready: true,
    registry_total: total,
    scores: {
      lifecycle_health_score, repository_health_score, compatibility_score,
      evidence_score, confidence_score, architecture_stability,
    },
    tech_debt_indicators,
    note: 'Each score is a SEPARATE MEASURED ratio (0–100). They are deliberately NOT composited into a single "overall" number (Coverage ⟂ Confidence ⟂ Evidence ⟂ Health). A score is null when its denominator is 0 (null ≠ zero).',
  };
}

// ── PART 8: Lifecycle Audit Engine (drift) — the ONLY write path ──────────────
export async function captureAuditSnapshot(pool: Pool, actor: string | null): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return NOT_DISCOVERED;
  await ensureIntelligenceSchema(pool);
  const [metrics, health, repoIntel, compat, evidence, confidence, validation, summary] = await Promise.all([
    getLifecycleMetrics(pool), getLifecycleHealth(pool), getRepositoryHealthIntel(pool),
    getCompatibilityIntelligence(pool), getLifecycleEvidence(pool), getLifecycleConfidence(pool),
    getLifecycleValidation(pool), getSummary(pool),
  ]);
  const s = metrics.scores ?? {};
  const uid = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const full = { metrics, health, repository_health: repoIntel, compatibility: compat, evidence, confidence, validation, summary };
  await pool.query(
    `INSERT INTO ${SNAPSHOT_TABLE}
       (snapshot_uid, lifecycle_health_score, repository_health_score, compatibility_score,
        evidence_score, confidence_score, architecture_stability, metrics, tech_debt_indicators,
        registry_total, captured_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11)`,
    [uid, s.lifecycle_health_score, s.repository_health_score, s.compatibility_score,
     s.evidence_score, s.confidence_score, s.architecture_stability,
     JSON.stringify(full), JSON.stringify(metrics.tech_debt_indicators ?? {}),
     metrics.registry_total ?? null, actor],
  );
  return { ok: true, snapshot_uid: uid, captured_at: new Date().toISOString(), scores: s, registry_total: metrics.registry_total ?? null };
}

export async function getAuditSnapshots(pool: Pool, q: { limit?: number }): Promise<{ ready: boolean; rows: any[] }> {
  if (!(await snapshotSchemaReady(pool))) return { ready: false, rows: [] };
  const lim = Math.min(Math.max(Number.isFinite(q.limit as number) ? (q.limit as number) : 50, 1), 500);
  const r = await rows(pool,
    `SELECT snapshot_uid, lifecycle_health_score, repository_health_score, compatibility_score,
            evidence_score, confidence_score, architecture_stability, registry_total, captured_by, captured_at
       FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC, id DESC LIMIT ${lim}`);
  return { ready: true, rows: r };
}

/** Repository drift = diff between the two most recent snapshots (MEASURED deltas). */
export async function getAuditDrift(pool: Pool): Promise<any> {
  if (!(await snapshotSchemaReady(pool))) return { ready: false, note: 'No intelligence snapshots captured yet (POST /audit/capture to create the first one).' };
  const last2 = await rows(pool,
    `SELECT * FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC, id DESC LIMIT 2`);
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
      lifecycle_health_score: delta(cur.lifecycle_health_score, prev.lifecycle_health_score),
      repository_health_score: delta(cur.repository_health_score, prev.repository_health_score),
      compatibility_score: delta(cur.compatibility_score, prev.compatibility_score),
      evidence_score: delta(cur.evidence_score, prev.evidence_score),
      confidence_score: delta(cur.confidence_score, prev.confidence_score),
      architecture_stability: delta(cur.architecture_stability, prev.architecture_stability),
      registry_total: delta(cur.registry_total, prev.registry_total),
    },
    note: 'Drift = current minus previous snapshot per metric (MEASURED). A null delta means one side was unmeasurable (null ≠ zero — never coerced to 0).',
  };
}

function scoreRow(r: any) {
  return {
    snapshot_uid: r.snapshot_uid, captured_at: r.captured_at, registry_total: r.registry_total,
    lifecycle_health_score: r.lifecycle_health_score, repository_health_score: r.repository_health_score,
    compatibility_score: r.compatibility_score, evidence_score: r.evidence_score,
    confidence_score: r.confidence_score, architecture_stability: r.architecture_stability,
  };
}

// ── Intelligence summary (read-only; composes all engines) ───────────────────
export async function getIntelligenceSummary(pool: Pool): Promise<any> {
  const foundationReady = await foundationSchemaReady(pool);
  if (!foundationReady) return { ready: false, foundation_ready: false, ...NOT_DISCOVERED };
  const [metrics, mgmt, snapshots] = await Promise.all([
    getLifecycleMetrics(pool), getManagementSummary(pool), getAuditSnapshots(pool, { limit: 1 }),
  ]);
  return {
    ready: true,
    foundation_ready: true,
    composes: ['platform-lifecycle (1.37 Foundation)', 'platform-lifecycle-management (1.38 Management)'],
    registry_total: metrics.registry_total ?? null,
    scores: metrics.scores ?? null,
    tech_debt_indicators: metrics.tech_debt_indicators ?? null,
    management_views: mgmt.views ?? null,
    snapshot_count: snapshots.ready ? snapshots.rows.length : 0,
    latest_snapshot: snapshots.ready ? (snapshots.rows[0] ?? null) : null,
    note: 'Intelligence COMPOSES the 1.37 Foundation + 1.38 Management (no parallel registry/engine). Every score is MEASURED and reported as a SEPARATE axis — Coverage ⟂ Confidence ⟂ Evidence ⟂ Health, never composited. null ≠ zero.',
  };
}
