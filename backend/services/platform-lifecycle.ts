/**
 * MX-700 Phase 1.37 — Platform Lifecycle Foundation (service layer).
 *
 * Implements the missing lifecycle foundations identified in Phase 1.36:
 *   - Capability Catalog (discovered from the live repository, never duplicated)
 *   - Platform Lifecycle Registry + Lifecycle Metadata
 *   - Capability Ownership (owners NULL when unassigned — honest, never fabricated)
 *   - Lifecycle State Engine (append-only history; never deletes lifecycle history)
 *   - Lifecycle Relationships (measured edges)
 *   - Repository Discovery / Validation / Repository Health
 *
 * HONESTY CONTRACT: discovery records only what is MEASURED from the repository
 * (file existence, paths, migration dates, flag runtime state). Anything not
 * machine-derivable (business/engineering/architect owner, documentation link,
 * dependencies) is left NULL/empty and surfaced by validation as a real gap —
 * never invented. built<>activated; flag-ON<>runtime-active; null<>zero.
 *
 * REUSE-BEFORE-BUILD: discovery imports the canonical FEATURE_FLAGS registry and
 * scans the existing migrations/routes/services/docs directories. It is a READ
 * index over the single-source-of-truth repository — it does NOT create a
 * parallel registry of flags/migrations/etc.
 *
 * Flag-gated: the route gate (services consumed only when ON) means the
 * ensure-schema below never runs with the flag OFF -> byte-identical incl. schema.
 */
import type { Pool } from 'pg';
import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { FEATURE_FLAGS, isFlagEnabled, type FeatureFlagKey } from '../config/feature-flags';

const __dirname_ = path.dirname(fileURLToPath(import.meta.url)); // backend/services
const BACKEND_ROOT = path.resolve(__dirname_, '..');             // backend
const REPO_ROOT = path.resolve(BACKEND_ROOT, '..');              // workspace

/** Canonical lifecycle states (Part 4/5). Ordered roughly birth -> end-of-life.
 *  Covers the full Phase 1.37 PART 4 vocabulary. Per "Map existing values, do not
 *  replace existing repository semantics", spec "Live" maps to the existing `active`
 *  (not renamed); `validated`/`released` are retained existing stages; the four spec
 *  states absent from the first cut — `partial`, `experimental`, `blocked`, `removed`
 *  — are added so every PART 4 state is representable as a transition target. */
export const LIFECYCLE_STATES = [
  'proposed', 'approved', 'implemented', 'partial', 'validated', 'released',
  'active', 'dormant', 'experimental', 'deprecated', 'retired', 'archived',
  'blocked', 'removed',
] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];
export const isLifecycleState = (s: string): s is LifecycleState =>
  (LIFECYCLE_STATES as readonly string[]).includes(s);

const TABLES = [
  'platform_capability_catalog',
  'platform_capability_ownership',
  'platform_lifecycle_registry',
  'platform_lifecycle_state_history',
  'platform_lifecycle_relationships',
] as const;

let _schemaReady = false;

/** Lazy ensure-schema — canonical mirror of 20261216_platform_lifecycle_foundation.sql.
 *  Only ever called from write paths (discover / transition), so flag-OFF is byte-identical. */
export async function ensurePlatformLifecycleSchema(pool: Pool): Promise<void> {
  if (_schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_capability_catalog (
      id SERIAL PRIMARY KEY,
      capability_key TEXT UNIQUE NOT NULL,
      canonical_name TEXT NOT NULL,
      description TEXT,
      business_domain TEXT,
      technical_domain TEXT,
      source_kind TEXT NOT NULL,
      repository_reference TEXT,
      feature_flags TEXT[] DEFAULT '{}',
      dependencies TEXT[] DEFAULT '{}',
      consumers TEXT[] DEFAULT '{}',
      activation_status TEXT,
      compatibility_status TEXT DEFAULT 'compatible',
      lifecycle_state TEXT,
      discovered_at TIMESTAMPTZ DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ DEFAULT NOW(),
      metadata JSONB DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS platform_capability_ownership (
      id SERIAL PRIMARY KEY,
      capability_key TEXT UNIQUE NOT NULL REFERENCES platform_capability_catalog(capability_key) ON DELETE CASCADE,
      business_owner TEXT,
      engineering_owner TEXT,
      architect_owner TEXT,
      repository_location TEXT,
      documentation_location TEXT,
      migration_references TEXT[] DEFAULT '{}',
      feature_flag_references TEXT[] DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS platform_lifecycle_registry (
      id SERIAL PRIMARY KEY,
      lifecycle_uid TEXT UNIQUE NOT NULL,
      entity_type TEXT NOT NULL,
      entity_identifier TEXT NOT NULL,
      lifecycle_state TEXT NOT NULL DEFAULT 'implemented',
      lifecycle_stage TEXT,
      lifecycle_version TEXT,
      owner TEXT,
      dependencies TEXT[] DEFAULT '{}',
      activation_state TEXT,
      feature_flag TEXT,
      retirement_status TEXT DEFAULT 'none',
      deprecation_status TEXT DEFAULT 'none',
      compatibility_status TEXT DEFAULT 'compatible',
      documentation_reference TEXT,
      migration_reference TEXT,
      migration_version TEXT,
      migration_date TEXT,
      repository_reference TEXT,
      introduced_phase TEXT,
      current_version TEXT,
      compatibility_version TEXT,
      last_validation TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_modified TIMESTAMPTZ DEFAULT NOW(),
      metadata JSONB DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS platform_lifecycle_state_history (
      id SERIAL PRIMARY KEY,
      lifecycle_uid TEXT NOT NULL,
      from_state TEXT,
      to_state TEXT NOT NULL,
      reason TEXT,
      evidence TEXT,
      changed_by TEXT,
      changed_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS platform_lifecycle_relationships (
      id SERIAL PRIMARY KEY,
      from_uid TEXT NOT NULL,
      to_uid TEXT NOT NULL,
      relationship_type TEXT NOT NULL,
      evidence TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (from_uid, to_uid, relationship_type)
    );
    CREATE INDEX IF NOT EXISTS idx_plc_registry_state ON platform_lifecycle_registry(lifecycle_state);
    CREATE INDEX IF NOT EXISTS idx_plc_registry_type  ON platform_lifecycle_registry(entity_type);
    CREATE INDEX IF NOT EXISTS idx_plc_catalog_domain ON platform_capability_catalog(business_domain);
    CREATE INDEX IF NOT EXISTS idx_plc_catalog_source ON platform_capability_catalog(source_kind);
    CREATE INDEX IF NOT EXISTS idx_plc_state_hist_uid ON platform_lifecycle_state_history(lifecycle_uid);
    CREATE INDEX IF NOT EXISTS idx_plc_rel_from       ON platform_lifecycle_relationships(from_uid);
    CREATE INDEX IF NOT EXISTS idx_plc_rel_to         ON platform_lifecycle_relationships(to_uid);
  `);
  _schemaReady = true;
}

/** Probe whether the foundation tables exist WITHOUT creating them (GET-never-writes). */
export async function schemaReady(pool: Pool): Promise<boolean> {
  try {
    const r = await pool.query(
      `SELECT bool_and(to_regclass($1 || t) IS NOT NULL) AS ready
         FROM unnest($2::text[]) t`,
      ['public.', TABLES as unknown as string[]],
    );
    return !!r.rows[0]?.ready;
  } catch { return false; }
}

// ── Repository discovery helpers ──────────────────────────────────────────────

async function listDir(dir: string, ext: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith(ext)).map((e) => e.name).sort();
  } catch { return []; }
}

async function readFileSafe(p: string): Promise<string> {
  try { return await fs.readFile(p, 'utf8'); } catch { return ''; }
}

const rel = (abs: string) => path.relative(REPO_ROOT, abs).split(path.sep).join('/');

/** Derive a coarse business domain from a flag/module name (DERIVED, best-effort, never asserted as truth). */
function deriveDomain(name: string): string {
  const n = name.toLowerCase();
  const map: Array<[RegExp, string]> = [
    [/career|launchpad|fresher|passport|resume|mentor/, 'Career Intelligence'],
    [/competency|onto|capability|adaptive|question|difficulty/, 'Competency Intelligence'],
    [/capadex|concern|signal|behaviour|behavior|pragati|clarity/, 'Behaviour & Concern Intelligence'],
    [/employer|hiring|talent|interview|screening|avatar|recruit|job/, 'Employer & Hiring Intelligence'],
    [/decision|journey|outcome|growth|intervention/, 'Decision & Outcome Intelligence'],
    [/report|analytic|enterprise|governance|institution|dashboard|mission/, 'Enterprise & Reporting Intelligence'],
    [/commercial|entitlement|invoice|gst|subscription|billing|payment|metering/, 'Commercial Intelligence'],
    [/learning|forecast|future|trend|memory|readiness/, 'Learning & Future Intelligence'],
    [/security|csrf|rbac|audit|mfa|password|rate/, 'Security Intelligence'],
    [/lifecycle|platform|infra|deploy|workflow|env/, 'Platform Intelligence'],
  ];
  for (const [re, dom] of map) if (re.test(n)) return dom;
  return 'Unclassified';
}

export interface DiscoveryResult {
  ok: true;
  ran_at: string;
  counts: {
    flags: number; capabilities: number; modules: number; services: number;
    migrations: number; docs: number; registry_total: number; relationships: number;
  };
  notes: string[];
}

/**
 * Repository discovery (Parts 2, 6, 7, 12, 13). Idempotent — upserts by canonical key.
 * Records ONLY measured facts; owners/docs/deps left empty when not machine-derivable.
 */
export async function runDiscovery(pool: Pool, actor: string | null): Promise<DiscoveryResult> {
  await ensurePlatformLifecycleSchema(pool);
  const notes: string[] = [];

  // 1) Flags = canonical capability units (each additive phase is gated by a flag).
  const flagKeys = Object.keys(FEATURE_FLAGS) as FeatureFlagKey[];
  let capabilities = 0;
  for (const key of flagKeys) {
    const active = isFlagEnabled(key);
    const activation = active ? 'active' : 'dormant'; // built<>activated: dormant when flag OFF
    const state: LifecycleState = active ? 'active' : 'dormant';
    const capKey = `capability:${key}`;
    const domain = deriveDomain(key);
    await pool.query(
      `INSERT INTO platform_capability_catalog
         (capability_key, canonical_name, business_domain, technical_domain, source_kind,
          repository_reference, feature_flags, activation_status, lifecycle_state, last_seen_at)
       VALUES ($1,$2,$3,$4,'flag','backend/config/feature-flags.ts',$5,$6,$7,NOW())
       ON CONFLICT (capability_key) DO UPDATE SET
         activation_status = EXCLUDED.activation_status,
         business_domain   = EXCLUDED.business_domain,
         last_seen_at      = NOW()`,
      // activation_status tracks the LIVE flag runtime each scan; lifecycle_state is managed
      // (set once on first discovery, then only by an explicit transition) — never clobbered here.
      [capKey, key, domain, 'Feature Flag', [key], activation, state],
    );
    await pool.query(
      `INSERT INTO platform_capability_ownership
         (capability_key, repository_location, feature_flag_references)
       VALUES ($1,'backend/config/feature-flags.ts',$2)
       ON CONFLICT (capability_key) DO UPDATE SET
         feature_flag_references = EXCLUDED.feature_flag_references, updated_at = NOW()`,
      [capKey, [key]],
    );
    await upsertRegistry(pool, {
      uid: capKey, entityType: 'capability', identifier: key, state,
      activation, featureFlag: key, repoRef: 'backend/config/feature-flags.ts',
    });
    capabilities++;
  }

  // 2) Route modules + 3) services — discovered modules. Scan content for flag refs -> gated_by edges.
  const routeDir = path.join(BACKEND_ROOT, 'routes');
  const serviceDir = path.join(BACKEND_ROOT, 'services');
  const routeFiles = await listDir(routeDir, '.ts');
  const serviceFiles = await listDir(serviceDir, '.ts');
  const flagRegexes = flagKeys.map((k) => ({ key: k, re: new RegExp(`\\b${k}\\b`) }));

  const scanModule = async (file: string, dir: string, kind: 'module' | 'service', entityType: string) => {
    const abs = path.join(dir, file);
    const content = await readFileSafe(abs);
    const repoRef = rel(abs);
    const uid = `${kind}:${file}`;
    const refFlags = flagRegexes.filter((f) => f.re.test(content)).map((f) => f.key);
    const domain = deriveDomain(file);
    if (kind === 'module') {
      await pool.query(
        `INSERT INTO platform_capability_catalog
           (capability_key, canonical_name, business_domain, technical_domain, source_kind,
            repository_reference, feature_flags, activation_status, lifecycle_state, last_seen_at)
         VALUES ($1,$2,$3,'Express Route','module',$4,$5,'unknown','implemented',NOW())
         ON CONFLICT (capability_key) DO UPDATE SET
           feature_flags = EXCLUDED.feature_flags, business_domain = EXCLUDED.business_domain, last_seen_at = NOW()`,
        [uid, file, domain, repoRef, refFlags],
      );
      await pool.query(
        `INSERT INTO platform_capability_ownership (capability_key, repository_location, feature_flag_references)
         VALUES ($1,$2,$3)
         ON CONFLICT (capability_key) DO UPDATE SET
           feature_flag_references = EXCLUDED.feature_flag_references, updated_at = NOW()`,
        [uid, repoRef, refFlags],
      );
    }
    await upsertRegistry(pool, {
      uid, entityType, identifier: file, state: 'implemented',
      activation: 'unknown', repoRef,
    });
    // measured gated_by relationships (the file literally references the flag key)
    for (const fk of refFlags) {
      await pool.query(
        `INSERT INTO platform_lifecycle_relationships (from_uid, to_uid, relationship_type, evidence)
         VALUES ($1,$2,'gated_by',$3)
         ON CONFLICT (from_uid, to_uid, relationship_type) DO NOTHING`,
        [uid, `capability:${fk}`, `flag key referenced in ${repoRef}`],
      );
    }
  };
  for (const f of routeFiles) await scanModule(f, routeDir, 'module', 'module');
  for (const f of serviceFiles) await scanModule(f, serviceDir, 'service', 'service');

  // 4) Migrations — version ledger (Part 12). migration_date from YYYYMMDD prefix.
  const migDir = path.join(BACKEND_ROOT, 'migrations');
  const migFiles = await listDir(migDir, '.sql');
  for (const f of migFiles) {
    const m = f.match(/^(\d{8})/);
    const ver = m ? m[1] : null;
    const dt = ver ? `${ver.slice(0, 4)}-${ver.slice(4, 6)}-${ver.slice(6, 8)}` : null;
    await upsertRegistry(pool, {
      uid: `migration:${f}`, entityType: 'migration', identifier: f, state: 'released',
      activation: 'unknown', repoRef: `backend/migrations/${f}`, migrationRef: f,
      migrationVersion: ver, migrationDate: dt,
    });
  }

  // 5) Docs — documentation assets (Part 13).
  const docDir = path.join(REPO_ROOT, 'docs');
  const docFiles = await listDir(docDir, '.md');
  for (const f of docFiles) {
    await upsertRegistry(pool, {
      uid: `documentation:${f}`, entityType: 'documentation', identifier: f, state: 'released',
      activation: 'unknown', repoRef: `docs/${f}`, docRef: `docs/${f}`,
    });
  }

  notes.push('Owners (business/engineering/architect) recorded NULL where unassigned — surfaced honestly by validation, never fabricated.');
  notes.push('Activation derived from live flag runtime; modules/migrations/docs = unknown (presence != runtime-active).');

  const regTotal = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry`);
  const relTotal = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_relationships`);

  return {
    ok: true,
    ran_at: new Date().toISOString(),
    counts: {
      flags: flagKeys.length, capabilities, modules: routeFiles.length, services: serviceFiles.length,
      migrations: migFiles.length, docs: docFiles.length,
      registry_total: regTotal, relationships: relTotal,
    },
    notes,
  };
}

async function upsertRegistry(pool: Pool, e: {
  uid: string; entityType: string; identifier: string; state: string;
  activation?: string; featureFlag?: string; repoRef?: string;
  migrationRef?: string; migrationVersion?: string | null; migrationDate?: string | null;
  docRef?: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO platform_lifecycle_registry
       (lifecycle_uid, entity_type, entity_identifier, lifecycle_state, activation_state,
        feature_flag, repository_reference, migration_reference, migration_version, migration_date,
        documentation_reference, last_modified)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
     ON CONFLICT (lifecycle_uid) DO UPDATE SET
       activation_state = EXCLUDED.activation_state,
       -- lifecycle_state is MANAGED (set once on first discovery, thereafter only by an explicit
       -- transition + history row). Re-discovery refreshes the derived activation_state but must
       -- never silently revert a human/managed lifecycle_state, so it is preserved here.
       repository_reference = EXCLUDED.repository_reference,
       last_modified = NOW()`,
    [e.uid, e.entityType, e.identifier, e.state, e.activation ?? null, e.featureFlag ?? null,
     e.repoRef ?? null, e.migrationRef ?? null, e.migrationVersion ?? null, e.migrationDate ?? null, e.docRef ?? null],
  );
}

async function scalar(pool: Pool, sql: string, params: unknown[] = []): Promise<number> {
  const r = await pool.query(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}

// ── Lifecycle State Engine (Part 5) — append-only; never deletes history ──────

export interface TransitionResult { ok: boolean; uid: string; from: string | null; to: string; error?: string; }

export async function transitionState(
  pool: Pool,
  uid: string,
  toState: string,
  opts: { reason?: string; evidence?: string; actor?: string | null },
): Promise<TransitionResult> {
  await ensurePlatformLifecycleSchema(pool);
  const to = toState.toLowerCase();
  if (!isLifecycleState(to)) return { ok: false, uid, from: null, to, error: 'invalid_state' };
  const cur = await pool.query(`SELECT lifecycle_state FROM platform_lifecycle_registry WHERE lifecycle_uid = $1`, [uid]);
  if (cur.rowCount === 0) return { ok: false, uid, from: null, to, error: 'unknown_entity' };
  const from = cur.rows[0].lifecycle_state as string;
  // append-only history FIRST (preserve history even if the update is a no-op)
  await pool.query(
    `INSERT INTO platform_lifecycle_state_history (lifecycle_uid, from_state, to_state, reason, evidence, changed_by)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [uid, from, to, opts.reason ?? null, opts.evidence ?? null, opts.actor ?? null],
  );
  const retirement = (to === 'retired' || to === 'archived' || to === 'removed') ? 'retired' : (to === 'dormant' ? 'candidate' : 'none');
  const deprecation = to === 'deprecated' ? 'deprecated' : 'none';
  await pool.query(
    `UPDATE platform_lifecycle_registry
        SET lifecycle_state = $2,
            retirement_status = CASE WHEN $3 = 'none' THEN retirement_status ELSE $3 END,
            deprecation_status = CASE WHEN $4 = 'none' THEN deprecation_status ELSE $4 END,
            last_modified = NOW()
      WHERE lifecycle_uid = $1`,
    [uid, to, retirement, deprecation],
  );
  // mirror into catalog where the entity is a catalogued capability/module
  await pool.query(
    `UPDATE platform_capability_catalog SET lifecycle_state = $2 WHERE capability_key = $1`,
    [uid, to],
  );
  return { ok: true, uid, from, to };
}

export async function getStateHistory(pool: Pool, uid: string): Promise<any[]> {
  if (!(await schemaReady(pool))) return [];
  const r = await pool.query(
    `SELECT from_state, to_state, reason, evidence, changed_by, changed_at
       FROM platform_lifecycle_state_history WHERE lifecycle_uid = $1 ORDER BY changed_at ASC, id ASC`, [uid]);
  return r.rows;
}

// ── Query getters (GET-never-writes — degrade to empty when schema absent) ────

export async function getCapabilities(pool: Pool, q: {
  domain?: string; source?: string; activation?: string; state?: string; search?: string; limit?: number;
}): Promise<{ ready: boolean; rows: any[] }> {
  if (!(await schemaReady(pool))) return { ready: false, rows: [] };
  const where: string[] = []; const params: unknown[] = [];
  const add = (clause: string, val: unknown) => { params.push(val); where.push(clause.replace('$?', `$${params.length}`)); };
  if (q.domain) add('business_domain = $?', q.domain);
  if (q.source) add('source_kind = $?', q.source);
  if (q.activation) add('activation_status = $?', q.activation);
  if (q.state) add('lifecycle_state = $?', q.state);
  if (q.search) add('(canonical_name ILIKE $? OR capability_key ILIKE $?)'.replace('$?', `$${params.length + 1}`).replace('$?', `$${params.length + 1}`), `%${q.search}%`);
  const lim = Math.min(Math.max(q.limit ?? 200, 1), 1000);
  const r = await pool.query(
    `SELECT capability_key, canonical_name, business_domain, technical_domain, source_kind,
            repository_reference, feature_flags, activation_status, compatibility_status,
            lifecycle_state, discovered_at, last_seen_at
       FROM platform_capability_catalog
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY source_kind, canonical_name LIMIT ${lim}`, params);
  return { ready: true, rows: r.rows };
}

export async function getCapabilityDetail(pool: Pool, key: string): Promise<{ ready: boolean; capability: any; ownership: any; registry: any; relationships: any[]; history: any[] }> {
  if (!(await schemaReady(pool))) return { ready: false, capability: null, ownership: null, registry: null, relationships: [], history: [] };
  const cap = (await pool.query(`SELECT * FROM platform_capability_catalog WHERE capability_key = $1`, [key])).rows[0] ?? null;
  const own = (await pool.query(`SELECT * FROM platform_capability_ownership WHERE capability_key = $1`, [key])).rows[0] ?? null;
  const reg = (await pool.query(`SELECT * FROM platform_lifecycle_registry WHERE lifecycle_uid = $1`, [key])).rows[0] ?? null;
  const rels = (await pool.query(
    `SELECT from_uid, to_uid, relationship_type, evidence FROM platform_lifecycle_relationships
      WHERE from_uid = $1 OR to_uid = $1 ORDER BY relationship_type`, [key])).rows;
  const hist = await getStateHistory(pool, key);
  return { ready: true, capability: cap, ownership: own, registry: reg, relationships: rels, history: hist };
}

export async function getRegistry(pool: Pool, q: { entityType?: string; state?: string; limit?: number }): Promise<{ ready: boolean; rows: any[] }> {
  if (!(await schemaReady(pool))) return { ready: false, rows: [] };
  const where: string[] = []; const params: unknown[] = [];
  if (q.entityType) { params.push(q.entityType); where.push(`entity_type = $${params.length}`); }
  if (q.state) { params.push(q.state); where.push(`lifecycle_state = $${params.length}`); }
  const lim = Math.min(Math.max(q.limit ?? 300, 1), 2000);
  const r = await pool.query(
    `SELECT lifecycle_uid, entity_type, entity_identifier, lifecycle_state, activation_state, feature_flag,
            retirement_status, deprecation_status, compatibility_status, repository_reference,
            migration_reference, migration_date, documentation_reference, owner, last_modified
       FROM platform_lifecycle_registry
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY entity_type, entity_identifier LIMIT ${lim}`, params);
  return { ready: true, rows: r.rows };
}

export async function getOwnership(pool: Pool, q: { missingOnly?: boolean; limit?: number }): Promise<{ ready: boolean; rows: any[] }> {
  if (!(await schemaReady(pool))) return { ready: false, rows: [] };
  const lim = Math.min(Math.max(q.limit ?? 300, 1), 2000);
  const filter = q.missingOnly ? `WHERE business_owner IS NULL AND engineering_owner IS NULL AND architect_owner IS NULL` : '';
  const r = await pool.query(
    `SELECT capability_key, business_owner, engineering_owner, architect_owner,
            repository_location, documentation_location, migration_references, feature_flag_references, updated_at
       FROM platform_capability_ownership ${filter} ORDER BY capability_key LIMIT ${lim}`);
  return { ready: true, rows: r.rows };
}

export async function getRelationships(pool: Pool, q: { uid?: string; type?: string; limit?: number }): Promise<{ ready: boolean; rows: any[] }> {
  if (!(await schemaReady(pool))) return { ready: false, rows: [] };
  const where: string[] = []; const params: unknown[] = [];
  if (q.uid) { params.push(q.uid); where.push(`(from_uid = $${params.length} OR to_uid = $${params.length})`); }
  if (q.type) { params.push(q.type); where.push(`relationship_type = $${params.length}`); }
  const lim = Math.min(Math.max(q.limit ?? 500, 1), 5000);
  const r = await pool.query(
    `SELECT from_uid, to_uid, relationship_type, evidence FROM platform_lifecycle_relationships
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY from_uid LIMIT ${lim}`, params);
  return { ready: true, rows: r.rows };
}

// ── Validation (Part 11) & Repository Health (Part 14) ────────────────────────

export async function getValidation(pool: Pool): Promise<any> {
  if (!(await schemaReady(pool))) return { ready: false };
  const dupCapIds = await scalar(pool,
    `SELECT count(*)::int n FROM (SELECT capability_key FROM platform_capability_catalog GROUP BY capability_key HAVING count(*) > 1) x`);
  const dupOwnership = await scalar(pool,
    `SELECT count(*)::int n FROM (SELECT capability_key FROM platform_capability_ownership GROUP BY capability_key HAVING count(*) > 1) x`);
  const missingDocs = await scalar(pool,
    `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE documentation_reference IS NULL`);
  const missingOwners = await scalar(pool,
    `SELECT count(*)::int n FROM platform_capability_ownership
      WHERE business_owner IS NULL AND engineering_owner IS NULL AND architect_owner IS NULL`);
  const missingDeps = await scalar(pool,
    `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE dependencies = '{}'`);
  const missingState = await scalar(pool,
    `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE lifecycle_state IS NULL`);
  const totalReg = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry`);
  const totalOwn = await scalar(pool, `SELECT count(*)::int n FROM platform_capability_ownership`);
  return {
    ready: true,
    checks: {
      duplicate_capability_ids: dupCapIds,
      duplicate_ownership: dupOwnership,
      missing_documentation: missingDocs,
      missing_owners: missingOwners,
      missing_dependencies: missingDeps,
      missing_lifecycle_states: missingState,
    },
    totals: { registry: totalReg, ownership: totalOwn },
    note: 'missing_* are HONEST gaps (no formal ownership/doc-linkage layer existed pre-1.37) — not fabricated. null<>zero.',
  };
}

export async function getRepositoryHealth(pool: Pool): Promise<any> {
  if (!(await schemaReady(pool))) return { ready: false };
  const dupCapabilities = await scalar(pool,
    `SELECT count(*)::int n FROM (SELECT canonical_name, source_kind FROM platform_capability_catalog GROUP BY canonical_name, source_kind HAVING count(*) > 1) x`);
  const dupLifecycle = await scalar(pool,
    `SELECT count(*)::int n FROM (SELECT lifecycle_uid FROM platform_lifecycle_registry GROUP BY lifecycle_uid HAVING count(*) > 1) x`);
  // orphan relationship endpoints (point at a uid absent from registry AND catalog)
  const orphanRels = await scalar(pool,
    `SELECT count(*)::int n FROM platform_lifecycle_relationships r
      WHERE NOT EXISTS (SELECT 1 FROM platform_lifecycle_registry g WHERE g.lifecycle_uid = r.to_uid)
        AND NOT EXISTS (SELECT 1 FROM platform_capability_catalog c WHERE c.capability_key = r.to_uid)`);
  const missingOwnership = await scalar(pool,
    `SELECT count(*)::int n FROM platform_capability_catalog c
      WHERE NOT EXISTS (SELECT 1 FROM platform_capability_ownership o WHERE o.capability_key = c.capability_key)`);
  // broken references: sample registry rows whose repository_reference no longer exists on disk
  let brokenRefs = 0; const brokenSample: string[] = [];
  const refs = await pool.query(
    `SELECT lifecycle_uid, repository_reference FROM platform_lifecycle_registry
      WHERE repository_reference IS NOT NULL ORDER BY lifecycle_uid`);
  for (const row of refs.rows) {
    const abs = path.join(REPO_ROOT, row.repository_reference);
    try { await fs.access(abs); } catch { brokenRefs++; if (brokenSample.length < 25) brokenSample.push(row.repository_reference); }
  }
  return {
    ready: true,
    checks: {
      duplicate_capabilities: dupCapabilities,
      duplicate_lifecycle_records: dupLifecycle,
      orphan_records: orphanRels,
      missing_ownership: missingOwnership,
      broken_references: brokenRefs,
    },
    broken_reference_sample: brokenSample,
    note: 'broken_references compares stored repository paths against the live filesystem (MEASURED).',
  };
}

export async function getSummary(pool: Pool): Promise<any> {
  if (!(await schemaReady(pool))) return { ready: false, discovered: false };
  const byType = (await pool.query(
    `SELECT entity_type, count(*)::int n FROM platform_lifecycle_registry GROUP BY entity_type ORDER BY n DESC`)).rows;
  const byState = (await pool.query(
    `SELECT lifecycle_state, count(*)::int n FROM platform_lifecycle_registry GROUP BY lifecycle_state ORDER BY n DESC`)).rows;
  const byActivation = (await pool.query(
    `SELECT COALESCE(activation_state,'unknown') activation_state, count(*)::int n
       FROM platform_lifecycle_registry GROUP BY activation_state ORDER BY n DESC`)).rows;
  const catBySource = (await pool.query(
    `SELECT source_kind, count(*)::int n FROM platform_capability_catalog GROUP BY source_kind ORDER BY n DESC`)).rows;
  const totals = {
    registry: await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry`),
    catalog: await scalar(pool, `SELECT count(*)::int n FROM platform_capability_catalog`),
    relationships: await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_relationships`),
    state_transitions: await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_state_history`),
  };
  const last = (await pool.query(
    `SELECT max(last_seen_at) ts FROM platform_capability_catalog`)).rows[0]?.ts ?? null;
  return {
    ready: true,
    discovered: totals.registry > 0,
    totals,
    by_entity_type: byType,
    by_lifecycle_state: byState,
    by_activation: byActivation,
    catalog_by_source: catBySource,
    last_discovery_at: last,
    states: LIFECYCLE_STATES,
  };
}
