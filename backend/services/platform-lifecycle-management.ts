/**
 * MX-700 Phase 1.38 — Platform Lifecycle Management Engine (service layer).
 *
 * ADDITIVE management tier that COMPOSES the Phase 1.37 Foundation. It reuses the
 * Foundation's registry / capability catalog / append-only state-history and its
 * `transitionState()` engine — it does NOT create a parallel registry or a second
 * lifecycle state machine. The four `platform_lifecycle_*` tables added here hold
 * ONLY the management-tier metadata the Foundation registry does not model in
 * dedicated columns (deprecation policy/replacement, retirement approval/archive,
 * an append-only version ledger, and an append-only evolution log).
 *
 * HONESTY CONTRACT (per user preference — honesty over optimism, never fabricate):
 *   - The Foundation discovery populates entity_type ∈ {capability, module, service,
 *     migration, documentation}. There is NO `feature`, `api`, or `model` entity_type.
 *     The management views map those vocabularies onto the closest MEASURED analog
 *     (flags ARE features; route modules ARE the API surface) or are registration-only
 *     (models are not file-discoverable). Each view declares `derived`/`note` honestly.
 *   - Counts are MEASURED (COUNT(*)), never estimated. null ≠ zero in both directions.
 *   - The authoritative lifecycle_state stays in the Foundation registry and changes
 *     ONLY through transitionState() (append-only history). built ≠ activated.
 *
 * Flag-gated by `platformLifecycleManagement` (default OFF). ensureManagementSchema
 * runs ONLY on flag-ON write paths, so flag-OFF is byte-identical incl. schema.
 */
import type { Pool } from 'pg';
import {
  ensurePlatformLifecycleSchema,
  schemaReady as foundationSchemaReady,
  transitionState,
  isLifecycleState,
  getStateHistory,
} from './platform-lifecycle';

const MGMT_TABLES = [
  'platform_lifecycle_deprecation',
  'platform_lifecycle_retirement',
  'platform_lifecycle_version_ledger',
  'platform_lifecycle_evolution',
] as const;

let _mgmtReady = false;

/** Lazy ensure-schema — canonical mirror of 20261217_platform_lifecycle_management.sql.
 *  Ensures the Foundation schema FIRST (reuse, never duplicate), then the 4 additive
 *  management tables. Only ever called from flag-ON write paths -> flag-OFF byte-identical. */
export async function ensureManagementSchema(pool: Pool): Promise<void> {
  if (_mgmtReady) return;
  await ensurePlatformLifecycleSchema(pool);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_lifecycle_deprecation (
      lifecycle_uid          TEXT PRIMARY KEY,
      deprecation_policy     TEXT,
      deprecation_reason     TEXT,
      replacement_reference  TEXT,
      migration_target       TEXT,
      compatibility_status   TEXT,
      deprecation_timeline   TEXT,
      effective_at           TIMESTAMPTZ,
      deprecated_by          TEXT,
      created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS platform_lifecycle_retirement (
      lifecycle_uid          TEXT PRIMARY KEY,
      approval_status        TEXT,
      approved_by            TEXT,
      archive_reference      TEXT,
      knowledge_preservation TEXT,
      dependency_validation  JSONB,
      retired_by             TEXT,
      created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS platform_lifecycle_version_ledger (
      id                BIGSERIAL PRIMARY KEY,
      lifecycle_uid     TEXT NOT NULL,
      current_version   TEXT,
      previous_version  TEXT,
      migration_version TEXT,
      rollback_version  TEXT,
      release_status    TEXT,
      compatibility     TEXT,
      recorded_by       TEXT,
      recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_plm_version_uid ON platform_lifecycle_version_ledger (lifecycle_uid, recorded_at DESC);
    CREATE TABLE IF NOT EXISTS platform_lifecycle_evolution (
      id              BIGSERIAL PRIMARY KEY,
      lifecycle_uid   TEXT NOT NULL,
      evolution_type  TEXT NOT NULL,
      summary         TEXT,
      from_value      TEXT,
      to_value        TEXT,
      evidence        TEXT,
      recorded_by     TEXT,
      recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_plm_evolution_uid ON platform_lifecycle_evolution (lifecycle_uid, recorded_at DESC);
  `);
  _mgmtReady = true;
}

/** GET-never-writes probe: are the 4 management tables present? (degrade to ready:false otherwise). */
async function mgmtSchemaReady(pool: Pool): Promise<boolean> {
  try {
    const r = await pool.query(
      `SELECT bool_and(to_regclass($1 || t) IS NOT NULL) AS ready FROM unnest($2::text[]) t`,
      ['public.', MGMT_TABLES as unknown as string[]],
    );
    return !!r.rows[0]?.ready;
  } catch { return false; }
}

async function scalar(pool: Pool, sql: string, params: unknown[] = []): Promise<number> {
  const r = await pool.query(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}

async function entityExists(pool: Pool, uid: string): Promise<boolean> {
  return (await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE lifecycle_uid = $1`, [uid])) > 0;
}

const clamp = (v: number | undefined, lo: number, hi: number, dflt: number) =>
  Math.min(Math.max(Number.isFinite(v as number) ? (v as number) : dflt, lo), hi);

// ── Management vocabulary -> MEASURED Foundation entity_types ─────────────────
// Honest mapping. `derived:true` means the view has no native entity_type and is
// surfaced from the closest measured analog (or is registration-only).
export type LifecycleView = 'feature' | 'capability' | 'module' | 'api' | 'model';
const VIEW_MAP: Record<LifecycleView, { entityTypes: string[]; derived: boolean; note: string }> = {
  feature: {
    entityTypes: ['capability'], derived: true,
    note: 'Features are represented by feature-flag capabilities (entity_type=capability). No separate "feature" entity is discovered by the Foundation; net-new features can be registered explicitly.',
  },
  capability: {
    entityTypes: ['capability'], derived: false,
    note: 'Capabilities = discovered feature-flag entities (entity_type=capability).',
  },
  module: {
    entityTypes: ['module', 'service'], derived: false,
    note: 'Modules = discovered route + service files (entity_type ∈ {module, service}).',
  },
  api: {
    entityTypes: ['module'], derived: true,
    note: 'API surface is represented at route-module granularity. A per-endpoint API registry is NOT discovered by the Foundation — honest gap; per-endpoint entries can be registered explicitly.',
  },
  model: {
    entityTypes: ['model'], derived: false,
    note: 'Behaviour/competency/decision/analytics/ontology/AI models are NOT file-discoverable by the Foundation scan. Model lifecycle is registration-only (entity_type=model); the registry stays unpopulated until models are explicitly registered — never fabricated.',
  },
};
export const isLifecycleView = (v: string): v is LifecycleView =>
  Object.prototype.hasOwnProperty.call(VIEW_MAP, v);

// ── PART 1–5: typed lifecycle views (reads, GET-never-writes) ────────────────
export async function getEntityLifecycle(
  pool: Pool,
  view: LifecycleView,
  q: { state?: string; limit?: number },
): Promise<{ ready: boolean; view: LifecycleView; derived: boolean; note: string; rows: any[]; total: number }> {
  const map = VIEW_MAP[view];
  const base = { view, derived: map.derived, note: map.note };
  if (!(await foundationSchemaReady(pool))) return { ready: false, ...base, rows: [], total: 0 };
  const joined = await mgmtSchemaReady(pool);
  const lim = clamp(q.limit, 1, 1000, 200);
  const params: unknown[] = [map.entityTypes];
  let where = `r.entity_type = ANY($1)`;
  if (q.state) { params.push(q.state); where += ` AND r.lifecycle_state = $${params.length}`; }
  const extraSelect = joined
    ? `, d.deprecation_reason, d.replacement_reference, d.migration_target, d.deprecation_timeline,
         t.approval_status AS retirement_approval, t.archive_reference`
    : '';
  const joins = joined
    ? `LEFT JOIN platform_lifecycle_deprecation d ON d.lifecycle_uid = r.lifecycle_uid
       LEFT JOIN platform_lifecycle_retirement  t ON t.lifecycle_uid = r.lifecycle_uid`
    : '';
  const rows = (await pool.query(
    `SELECT r.lifecycle_uid, r.entity_type, r.entity_identifier, r.lifecycle_state, r.activation_state,
            r.feature_flag, r.retirement_status, r.deprecation_status, r.compatibility_status,
            r.current_version, r.compatibility_version, r.repository_reference ${extraSelect}
       FROM platform_lifecycle_registry r ${joins}
      WHERE ${where}
      ORDER BY r.entity_identifier LIMIT ${lim}`, params)).rows;
  const total = await scalar(pool,
    `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type = ANY($1)`, [map.entityTypes]);
  return { ready: true, ...base, rows, total };
}

// ── PART 1–5: explicit registration (write; never auto/fabricated) ───────────
// Lets an operator register a net-new feature/api/model lifecycle entity into the
// SHARED Foundation registry (no parallel registry). Creation is the first
// lifecycle stage; subsequent moves go through transitionState().
export async function registerEntity(
  pool: Pool,
  p: { uid: string; entityType: string; identifier: string; state?: string; activation?: string; featureFlag?: string; repoRef?: string; actor?: string | null },
): Promise<{ ok: boolean; uid: string; state?: string; created?: boolean; error?: string }> {
  if (!p.uid || !p.entityType || !p.identifier) return { ok: false, uid: p.uid, error: 'uid_entityType_identifier_required' };
  await ensureManagementSchema(pool);
  const state = p.state && isLifecycleState(p.state) ? p.state : 'proposed';
  const existed = await entityExists(pool, p.uid);
  await pool.query(
    `INSERT INTO platform_lifecycle_registry
       (lifecycle_uid, entity_type, entity_identifier, lifecycle_state, activation_state, feature_flag, repository_reference)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (lifecycle_uid) DO UPDATE SET
       entity_identifier = EXCLUDED.entity_identifier, last_modified = NOW()`,
    [p.uid, p.entityType, p.identifier, state, p.activation ?? 'unknown', p.featureFlag ?? null, p.repoRef ?? null],
  );
  if (!existed) {
    await pool.query(
      `INSERT INTO platform_lifecycle_state_history (lifecycle_uid, from_state, to_state, reason, evidence, changed_by)
       VALUES ($1, NULL, $2, 'registration', 'Phase 1.38 explicit registration', $3)`,
      [p.uid, state, p.actor ?? null],
    );
  }
  return { ok: true, uid: p.uid, state, created: !existed };
}

// ── PART 7: Deprecation Engine ───────────────────────────────────────────────
export async function deprecateEntity(
  pool: Pool,
  uid: string,
  p: { policy?: string; reason?: string; replacementReference?: string; migrationTarget?: string; compatibilityStatus?: string; timeline?: string; effectiveAt?: string; actor?: string | null },
): Promise<{ ok: boolean; uid: string; transition?: any; error?: string }> {
  await ensureManagementSchema(pool);
  if (!(await entityExists(pool, uid))) return { ok: false, uid, error: 'unknown_entity' };
  await pool.query(
    `INSERT INTO platform_lifecycle_deprecation
       (lifecycle_uid, deprecation_policy, deprecation_reason, replacement_reference, migration_target,
        compatibility_status, deprecation_timeline, effective_at, deprecated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     ON CONFLICT (lifecycle_uid) DO UPDATE SET
       deprecation_policy = EXCLUDED.deprecation_policy, deprecation_reason = EXCLUDED.deprecation_reason,
       replacement_reference = EXCLUDED.replacement_reference, migration_target = EXCLUDED.migration_target,
       compatibility_status = EXCLUDED.compatibility_status, deprecation_timeline = EXCLUDED.deprecation_timeline,
       effective_at = EXCLUDED.effective_at, deprecated_by = EXCLUDED.deprecated_by, updated_at = NOW()`,
    [uid, p.policy ?? null, p.reason ?? null, p.replacementReference ?? null, p.migrationTarget ?? null,
     p.compatibilityStatus ?? null, p.timeline ?? null, p.effectiveAt ?? null, p.actor ?? null],
  );
  // COMPOSE the Foundation engine: sets lifecycle_state=deprecated + deprecation_status + append history.
  const transition = await transitionState(pool, uid, 'deprecated', {
    reason: p.reason ?? 'deprecated',
    evidence: p.replacementReference ? `replacement: ${p.replacementReference}` : undefined,
    actor: p.actor ?? null,
  });
  return { ok: true, uid, transition };
}

// ── PART 8: Retirement Engine (with measured dependency validation) ──────────
export async function retireEntity(
  pool: Pool,
  uid: string,
  p: { approvalStatus?: string; approvedBy?: string; archiveReference?: string; knowledgePreservation?: string; force?: boolean; actor?: string | null },
): Promise<{ ok: boolean; uid: string; transition?: any; dependents?: any[]; error?: string; note?: string }> {
  await ensureManagementSchema(pool);
  if (!(await entityExists(pool, uid))) return { ok: false, uid, error: 'unknown_entity' };
  // Dependency validation: MEASURED incoming edges (who depends_on / consumes / is gated_by this uid).
  const dependents = (await pool.query(
    `SELECT from_uid, relationship_type, evidence FROM platform_lifecycle_relationships WHERE to_uid = $1`, [uid])).rows;
  if (dependents.length > 0 && !p.force) {
    return {
      ok: false, uid, dependents, error: 'has_active_dependents',
      note: 'Retirement blocked by MEASURED incoming dependencies. Re-issue with force=true to override (records the dependency_validation snapshot).',
    };
  }
  await pool.query(
    `INSERT INTO platform_lifecycle_retirement
       (lifecycle_uid, approval_status, approved_by, archive_reference, knowledge_preservation, dependency_validation, retired_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,NOW())
     ON CONFLICT (lifecycle_uid) DO UPDATE SET
       approval_status = EXCLUDED.approval_status, approved_by = EXCLUDED.approved_by,
       archive_reference = EXCLUDED.archive_reference, knowledge_preservation = EXCLUDED.knowledge_preservation,
       dependency_validation = EXCLUDED.dependency_validation, retired_by = EXCLUDED.retired_by, updated_at = NOW()`,
    [uid, p.approvalStatus ?? null, p.approvedBy ?? null, p.archiveReference ?? null, p.knowledgePreservation ?? null,
     JSON.stringify({ checked_at: new Date().toISOString(), dependents, forced: dependents.length > 0 && !!p.force }), p.actor ?? null],
  );
  const transition = await transitionState(pool, uid, 'retired', {
    reason: p.approvalStatus ? `approved by ${p.approvedBy ?? 'unspecified'}` : 'retired',
    evidence: p.archiveReference ? `archive: ${p.archiveReference}` : undefined,
    actor: p.actor ?? null,
  });
  return { ok: true, uid, transition, dependents };
}

// ── PART 6: Version Management (append-only ledger + authoritative registry col) ──
export async function setVersion(
  pool: Pool,
  uid: string,
  p: { currentVersion?: string; previousVersion?: string; migrationVersion?: string; rollbackVersion?: string; releaseStatus?: string; compatibility?: string; actor?: string | null },
): Promise<{ ok: boolean; uid: string; error?: string }> {
  await ensureManagementSchema(pool);
  if (!(await entityExists(pool, uid))) return { ok: false, uid, error: 'unknown_entity' };
  await pool.query(
    `INSERT INTO platform_lifecycle_version_ledger
       (lifecycle_uid, current_version, previous_version, migration_version, rollback_version, release_status, compatibility, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [uid, p.currentVersion ?? null, p.previousVersion ?? null, p.migrationVersion ?? null,
     p.rollbackVersion ?? null, p.releaseStatus ?? null, p.compatibility ?? null, p.actor ?? null],
  );
  // Reuse the Foundation registry column for the AUTHORITATIVE current version (no duplicate column).
  await pool.query(
    `UPDATE platform_lifecycle_registry
        SET current_version = COALESCE($2, current_version), last_modified = NOW()
      WHERE lifecycle_uid = $1`,
    [uid, p.currentVersion ?? null],
  );
  return { ok: true, uid };
}

export async function getVersionHistory(pool: Pool, uid: string): Promise<{ ready: boolean; rows: any[] }> {
  if (!(await mgmtSchemaReady(pool))) return { ready: false, rows: [] };
  const rows = (await pool.query(
    `SELECT current_version, previous_version, migration_version, rollback_version, release_status,
            compatibility, recorded_by, recorded_at
       FROM platform_lifecycle_version_ledger WHERE lifecycle_uid = $1 ORDER BY recorded_at DESC, id DESC`, [uid])).rows;
  return { ready: true, rows };
}

// ── PART 9: Evolution Engine (append-only enhancement/evolution log) ─────────
export async function recordEvolution(
  pool: Pool,
  uid: string,
  p: { evolutionType: string; summary?: string; fromValue?: string; toValue?: string; evidence?: string; actor?: string | null },
): Promise<{ ok: boolean; uid: string; error?: string }> {
  if (!p.evolutionType) return { ok: false, uid, error: 'evolutionType_required' };
  await ensureManagementSchema(pool);
  if (!(await entityExists(pool, uid))) return { ok: false, uid, error: 'unknown_entity' };
  await pool.query(
    `INSERT INTO platform_lifecycle_evolution
       (lifecycle_uid, evolution_type, summary, from_value, to_value, evidence, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [uid, p.evolutionType, p.summary ?? null, p.fromValue ?? null, p.toValue ?? null, p.evidence ?? null, p.actor ?? null],
  );
  return { ok: true, uid };
}

export async function getEvolution(pool: Pool, q: { uid?: string; type?: string; limit?: number }): Promise<{ ready: boolean; rows: any[] }> {
  if (!(await mgmtSchemaReady(pool))) return { ready: false, rows: [] };
  const where: string[] = []; const params: unknown[] = [];
  if (q.uid) { params.push(q.uid); where.push(`lifecycle_uid = $${params.length}`); }
  if (q.type) { params.push(q.type); where.push(`evolution_type = $${params.length}`); }
  const lim = clamp(q.limit, 1, 2000, 300);
  const rows = (await pool.query(
    `SELECT lifecycle_uid, evolution_type, summary, from_value, to_value, evidence, recorded_by, recorded_at
       FROM platform_lifecycle_evolution ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY recorded_at DESC, id DESC LIMIT ${lim}`, params)).rows;
  return { ready: true, rows };
}

// ── Deprecation / Retirement getters ─────────────────────────────────────────
export async function getDeprecation(pool: Pool, q: { uid?: string; limit?: number }): Promise<{ ready: boolean; rows: any[] }> {
  if (!(await mgmtSchemaReady(pool))) return { ready: false, rows: [] };
  const where: string[] = []; const params: unknown[] = [];
  if (q.uid) { params.push(q.uid); where.push(`lifecycle_uid = $${params.length}`); }
  const lim = clamp(q.limit, 1, 2000, 300);
  const rows = (await pool.query(
    `SELECT lifecycle_uid, deprecation_policy, deprecation_reason, replacement_reference, migration_target,
            compatibility_status, deprecation_timeline, effective_at, deprecated_by, created_at, updated_at
       FROM platform_lifecycle_deprecation ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY updated_at DESC LIMIT ${lim}`, params)).rows;
  return { ready: true, rows };
}

export async function getRetirement(pool: Pool, q: { uid?: string; limit?: number }): Promise<{ ready: boolean; rows: any[] }> {
  if (!(await mgmtSchemaReady(pool))) return { ready: false, rows: [] };
  const where: string[] = []; const params: unknown[] = [];
  if (q.uid) { params.push(q.uid); where.push(`lifecycle_uid = $${params.length}`); }
  const lim = clamp(q.limit, 1, 2000, 300);
  const rows = (await pool.query(
    `SELECT lifecycle_uid, approval_status, approved_by, archive_reference, knowledge_preservation,
            dependency_validation, retired_by, created_at, updated_at
       FROM platform_lifecycle_retirement ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY updated_at DESC LIMIT ${lim}`, params)).rows;
  return { ready: true, rows };
}

// ── Full per-entity lifecycle detail (composes Foundation + management metadata) ──
export async function getEntityLifecycleDetail(pool: Pool, uid: string): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return { ready: false };
  const registry = (await pool.query(`SELECT * FROM platform_lifecycle_registry WHERE lifecycle_uid = $1`, [uid])).rows[0] ?? null;
  if (!registry) return { ready: true, found: false, uid };
  const joined = await mgmtSchemaReady(pool);
  const deprecation = joined ? ((await pool.query(`SELECT * FROM platform_lifecycle_deprecation WHERE lifecycle_uid = $1`, [uid])).rows[0] ?? null) : null;
  const retirement = joined ? ((await pool.query(`SELECT * FROM platform_lifecycle_retirement WHERE lifecycle_uid = $1`, [uid])).rows[0] ?? null) : null;
  const versions = joined ? (await getVersionHistory(pool, uid)).rows : [];
  const evolution = joined ? (await getEvolution(pool, { uid })).rows : [];
  const history = await getStateHistory(pool, uid);
  return { ready: true, found: true, uid, registry, deprecation, retirement, versions, evolution, state_history: history };
}

// ── Management summary (read-only; MEASURED counts; honest view coverage) ─────
export async function getManagementSummary(pool: Pool): Promise<any> {
  const foundationReady = await foundationSchemaReady(pool);
  const managementReady = await mgmtSchemaReady(pool);
  if (!foundationReady) {
    return { ready: false, foundation_ready: false, management_ready: managementReady, note: 'Foundation discovery has not run — no registry to manage yet.' };
  }
  const byType = (await pool.query(
    `SELECT entity_type, count(*)::int n FROM platform_lifecycle_registry GROUP BY entity_type ORDER BY n DESC`)).rows;
  const byState = (await pool.query(
    `SELECT lifecycle_state, count(*)::int n FROM platform_lifecycle_registry GROUP BY lifecycle_state ORDER BY n DESC`)).rows;
  const views = await Promise.all((Object.keys(VIEW_MAP) as LifecycleView[]).map(async (v) => ({
    view: v,
    entity_types: VIEW_MAP[v].entityTypes,
    derived: VIEW_MAP[v].derived,
    registry_count: await scalar(pool,
      `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type = ANY($1)`, [VIEW_MAP[v].entityTypes]),
    note: VIEW_MAP[v].note,
  })));
  const totals = managementReady ? {
    deprecations: await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_deprecation`),
    retirements: await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_retirement`),
    version_records: await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_version_ledger`),
    evolution_records: await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_evolution`),
  } : null;
  return {
    ready: true,
    foundation_ready: true,
    management_ready: managementReady,
    by_entity_type: byType,
    by_lifecycle_state: byState,
    views,
    management_totals: totals,
    note: 'Management state COMPOSES the Foundation registry + transitionState() (no parallel registry). feature/api/model views are DERIVED or registration-only; all counts MEASURED, never fabricated. management_totals=null until the management schema is created by a flag-ON write. null ≠ zero.',
  };
}
