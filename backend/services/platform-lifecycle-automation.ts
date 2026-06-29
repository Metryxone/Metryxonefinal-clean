/**
 * MX-700 Phase 1.41 — Platform Lifecycle Automation & Continuous Governance Engine (service layer).
 *
 * ENHANCEMENT-ONLY. This layer COMPOSES the Phase 1.37 Foundation + Phase 1.38 Management +
 * Phase 1.39 Intelligence + Phase 1.40 Evolution. It establishes lifecycle automation, continuous
 * governance, a policy engine, a compliance engine, orchestration, continuous validation, automated
 * quality gates, continuous audit and automation metrics by REUSING the existing
 * registry/ledgers/validation/metrics getters — it introduces NO duplicate automation/governance/
 * policy/compliance/validation registry, NO parallel engine, and changes NO business logic. The
 * repository + the 1.37–1.40 surfaces remain the single source of truth.
 *
 * HONESTY CONTRACT (per user preference — honesty over optimism, never fabricate):
 *   - Automation ≠ Activation · Validation ≠ Modification · Governance ≠ BusinessLogic
 *     · Compliance ≠ RuntimeUsage · Policy-Exists ≠ Compliant · Gate-Pass ≠ Production-Ready.
 *   - Coverage ≠ Confidence ≠ Evidence — reported as SEPARATE axes, never blended.
 *   - Counts are MEASURED (COUNT(*) / composed measured getters), never estimated. null ≠ zero in
 *     both directions: a metric whose denominator is 0 is returned as null (not 0).
 *   - Automation runs READ-ONLY checks; it never mutates lifecycle state (STOP clause — no
 *     auto-activation, no auto-remediation, no notifications, no AI).
 *
 * Two genuinely-NEW tables are owned here (governance policy registry + governance audit snapshots).
 * Their lazy ensure-schema runs ONLY on flag-ON WRITE paths, so with the flag OFF this layer is
 * byte-identical incl. schema. All reads are GET-never-writes: they probe via to_regclass and degrade
 * to `ready:false`. Compliance is MEASURED on-demand by evaluating policies against the live registry;
 * evaluation results are NOT persisted (a policy existing ≠ a system being compliant).
 */
import type { Pool } from 'pg';
import { schemaReady as foundationSchemaReady, getSummary, getValidation, getRepositoryHealth } from './platform-lifecycle';
import { getManagementSummary } from './platform-lifecycle-management';
import {
  getLifecycleValidation, getLifecycleMetrics, getCompatibilityIntelligence, getRepositoryHealthIntel,
} from './platform-lifecycle-intelligence';
import {
  getEvolutionValidation, getEvolutionMetrics, getTechnicalDebtIntelligence, getEvolutionSummary,
} from './platform-evolution-intelligence';

const POLICY_TABLE = 'platform_governance_policies';
const SNAPSHOT_TABLE = 'platform_governance_audit_snapshots';
let _schemaReady = false;

/** Lazy ensure-schema — canonical mirror of 20261220_platform_lifecycle_automation.sql.
 *  ONLY ever called from a flag-ON WRITE path -> flag-OFF byte-identical incl. schema. */
export async function ensureAutomationSchema(pool: Pool): Promise<void> {
  if (_schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${POLICY_TABLE} (
      policy_uid             TEXT PRIMARY KEY,
      policy_key             TEXT UNIQUE NOT NULL,
      title                  TEXT NOT NULL,
      description            TEXT,
      policy_domain          TEXT NOT NULL,
      scope_entity_type      TEXT,
      rule_kind              TEXT NOT NULL,
      rule_field             TEXT,
      rule_params            JSONB NOT NULL DEFAULT '{}',
      severity               TEXT NOT NULL DEFAULT 'warn',
      enabled                BOOLEAN NOT NULL DEFAULT true,
      evidence               TEXT,
      documentation_reference TEXT,
      lifecycle_uid          TEXT,
      created_by             TEXT,
      created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_pga_policy_domain ON ${POLICY_TABLE} (policy_domain, enabled);

    CREATE TABLE IF NOT EXISTS ${SNAPSHOT_TABLE} (
      id                     BIGSERIAL PRIMARY KEY,
      snapshot_uid           TEXT UNIQUE NOT NULL,
      automation_health      NUMERIC,
      compliance_health      NUMERIC,
      governance_health      NUMERIC,
      validation_success     NUMERIC,
      repository_stability   NUMERIC,
      lifecycle_stability    NUMERIC,
      metrics                JSONB NOT NULL DEFAULT '{}',
      compliance_indicators  JSONB NOT NULL DEFAULT '{}',
      captured_by            TEXT,
      captured_at            TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_pga_audit_captured_at ON ${SNAPSHOT_TABLE} (captured_at DESC);
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
/** A measured check is the unit of automation/governance/validation. status drives the pass-rate. */
type Check = { measured_value: number | null; issues: number | null; status: 'pass' | 'attention' | 'unmeasurable'; basis: string };
function check(issues: number | null, basis: string): Check {
  if (issues == null) return { measured_value: null, issues: null, status: 'unmeasurable', basis };
  return { measured_value: issues, issues, status: issues === 0 ? 'pass' : 'attention', basis };
}
/** Pass-rate (0–100) over a map of checks: passing measurable checks ÷ measurable checks. null if none measurable. */
function passRate(checks: Record<string, Check>): number | null {
  const vals = Object.values(checks).filter((c) => c.status !== 'unmeasurable');
  if (!vals.length) return null;
  const passing = vals.filter((c) => c.status === 'pass').length;
  return pct(passing, vals.length);
}

const FOUNDATION_NOT_READY = { ready: false as const, note: 'Foundation discovery has not run — no lifecycle registry to govern yet (run POST /api/admin/platform-lifecycle/discover).' };

// ── PART 3 fixtures: deterministic BUILT-IN policy set (the honesty contract as machine-checkable rules) ──
// Each built-in policy is evaluated read-only against the SAME measured numbers the 1.37–1.40 validation
// getters already compute (no new fabricated computation). source_path documents which measured number it reads.
type BuiltinPolicy = {
  policy_key: string; title: string; policy_domain: string; severity: 'info' | 'warn' | 'blocking';
  scope: 'registry' | 'capability' | 'migration'; source: string;
};
const BUILTIN_POLICIES: BuiltinPolicy[] = [
  { policy_key: 'builtin.capability_owner_required', title: 'Every capability must declare an owner', policy_domain: 'ownership', severity: 'warn', scope: 'registry', source: 'foundation.missing_owners' },
  { policy_key: 'builtin.documentation_required', title: 'Every registry entity should link documentation', policy_domain: 'documentation', severity: 'warn', scope: 'registry', source: 'foundation.missing_documentation' },
  { policy_key: 'builtin.lifecycle_state_required', title: 'Every registry entity must have a lifecycle state', policy_domain: 'lifecycle', severity: 'blocking', scope: 'registry', source: 'foundation.missing_lifecycle_states' },
  { policy_key: 'builtin.lifecycle_state_valid', title: 'Lifecycle state must be a recognised value', policy_domain: 'lifecycle', severity: 'blocking', scope: 'registry', source: 'metadata.invalid_lifecycle_states' },
  { policy_key: 'builtin.no_duplicate_capability_ids', title: 'Capability keys must be unique', policy_domain: 'repository', severity: 'blocking', scope: 'registry', source: 'foundation.duplicate_capability_ids' },
  { policy_key: 'builtin.no_broken_references', title: 'Registry repository references must resolve on disk', policy_domain: 'repository', severity: 'blocking', scope: 'registry', source: 'metadata.repository_integrity_broken_references' },
  { policy_key: 'builtin.no_orphan_records', title: 'Relationship endpoints must resolve to a known entity', policy_domain: 'repository', severity: 'warn', scope: 'registry', source: 'repo_health.orphan_records' },
  { policy_key: 'builtin.no_duplicate_lifecycle_records', title: 'Lifecycle UIDs must be unique', policy_domain: 'repository', severity: 'blocking', scope: 'registry', source: 'repo_health.duplicate_lifecycle_records' },
  { policy_key: 'builtin.no_circular_dependencies', title: 'Module dependency graph must be acyclic', policy_domain: 'architecture', severity: 'blocking', scope: 'registry', source: 'repo_intel.circular_dependencies' },
  { policy_key: 'builtin.capability_version_present', title: 'Capabilities should carry a current version', policy_domain: 'version', severity: 'warn', scope: 'capability', source: 'metadata.capability_metadata_missing_version' },
  { policy_key: 'builtin.migration_version_present', title: 'Migrations should carry a parseable version', policy_domain: 'migration', severity: 'warn', scope: 'migration', source: 'metadata.migration_metadata_missing_version' },
  { policy_key: 'builtin.no_migration_ordering_regressions', title: 'Migration version ordering must be monotonic', policy_domain: 'migration', severity: 'blocking', scope: 'migration', source: 'compat.migration_ordering_regressions' },
  { policy_key: 'builtin.no_breaking_compatibility', title: 'No registry entity flagged breaking/incompatible', policy_domain: 'compatibility', severity: 'blocking', scope: 'registry', source: 'compat.breaking_count' },
];

// Whitelist of registry columns a CUSTOM policy may inspect (exact-match before any interpolation — injection-safe).
const SAFE_FIELDS = new Set([
  'documentation_reference', 'lifecycle_state', 'activation_state', 'current_version', 'migration_version', 'compatibility_status',
]);

// ── PART 1: Lifecycle Automation Engine (read-only continuous checks; Automation ≠ Activation) ──
export async function getLifecycleAutomation(pool: Pool): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return FOUNDATION_NOT_READY;
  const [val, lval, repoH, repoIntel, compat, eval40] = await Promise.all([
    getValidation(pool), getLifecycleValidation(pool), getRepositoryHealth(pool),
    getRepositoryHealthIntel(pool), getCompatibilityIntelligence(pool), getEvolutionValidation(pool),
  ]);
  const fv = val.checks ?? {};
  const mv = lval.metadata_validation ?? {};
  const rh = repoH.checks ?? {};
  const ri = repoIntel.checks ?? {};
  const ord = compat.compatibility?.migration?.ordering_regressions ?? null;
  const evoKnow = eval40.knowledge_preservation?.coverage ?? null; // % retired with knowledge preserved (null when nothing retired)

  const checks: Record<string, Check> = {
    metadata_sync: check(mv.invalid_lifecycle_states ?? null, 'invalid lifecycle states (1.39 metadata validation)'),
    dependency_verification: check(rh.orphan_records ?? null, 'orphan relationship endpoints (1.37 repository health)'),
    compatibility_verification: check(ord, 'migration ordering regressions (1.39 compatibility)'),
    documentation_verification: check(fv.missing_documentation ?? null, 'entities missing documentation reference (1.37 validation)'),
    repository_consistency: check(mv.repository_integrity_broken_references ?? null, 'broken repository references (1.39 metadata validation)'),
    architecture_consistency: check(ri.circular_dependencies ?? null, 'circular module dependencies (1.39 repository intelligence)'),
  };
  return {
    ready: true,
    composes: ['platform-lifecycle (1.37)', 'platform-lifecycle-intelligence (1.39)', 'platform-evolution-intelligence (1.40)'],
    checks,
    pass_rate: passRate(checks),
    evolution_knowledge_coverage: evoKnow,
    note: 'Lifecycle Automation runs READ-ONLY continuous checks composed from the existing validation getters. Automation ≠ Activation — it never mutates lifecycle state, auto-activates or remediates (STOP clause). Each check is MEASURED; unmeasurable ≠ pass; null ≠ zero.',
  };
}

// ── PART 2: Continuous Governance Engine (MEASURED governance areas; Governance ≠ BusinessLogic) ──
export async function getContinuousGovernance(pool: Pool): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return FOUNDATION_NOT_READY;
  const [val, lval, repoH, repoIntel, compat] = await Promise.all([
    getValidation(pool), getLifecycleValidation(pool), getRepositoryHealth(pool),
    getRepositoryHealthIntel(pool), getCompatibilityIntelligence(pool),
  ]);
  const fv = val.checks ?? {};
  const mv = lval.metadata_validation ?? {};
  const rh = repoH.checks ?? {};
  const ri = repoIntel.checks ?? {};

  const areas: Record<string, Check> = {
    repository_integrity: check((rh.broken_references ?? null) == null ? null : (rh.broken_references ?? 0) + (rh.duplicate_lifecycle_records ?? 0), 'broken references + duplicate lifecycle records (1.37 repository health)'),
    lifecycle_compliance: check((fv.missing_lifecycle_states ?? null) == null ? null : (fv.missing_lifecycle_states ?? 0) + (mv.invalid_lifecycle_states ?? 0), 'missing + invalid lifecycle states (1.37/1.39)'),
    capability_compliance: check(rh.missing_ownership ?? null, 'capabilities without an ownership record (1.37 repository health)'),
    architecture_compliance: check((ri.circular_dependencies ?? null) == null ? null : (ri.circular_dependencies ?? 0) + (ri.orphan_modules ?? 0), 'circular dependencies + orphan modules (1.39 repository intelligence)'),
    migration_compliance: check(compat.compatibility?.migration?.ordering_regressions ?? null, 'migration ordering regressions (1.39 compatibility)'),
    documentation_compliance: check(fv.missing_documentation ?? null, 'entities missing documentation reference (1.37 validation)'),
  };
  return {
    ready: true,
    composes: ['platform-lifecycle (1.37)', 'platform-lifecycle-intelligence (1.39)'],
    areas,
    pass_rate: passRate(areas),
    note: 'Continuous Governance reports MEASURED governance areas composed from the existing validation/health getters (no parallel governance engine). Governance ≠ BusinessLogic — it verifies metadata/integrity, never alters product behaviour. unmeasurable ≠ compliant; null ≠ zero.',
  };
}

// ── PART 3: Policy Engine (deterministic built-ins + curated custom registry) ──
/** Read the policy definitions: deterministic built-ins + any custom registry rows (GET-never-writes). */
export async function getPolicyDefinitions(pool: Pool, q: { domain?: string } = {}): Promise<any> {
  const builtin = BUILTIN_POLICIES
    .filter((p) => !q.domain || p.policy_domain === q.domain)
    .map((p) => ({ ...p, kind: 'builtin', enabled: true }));
  const customReady = await tableReady(pool, POLICY_TABLE);
  let custom: any[] = [];
  if (customReady) {
    const where: string[] = []; const params: unknown[] = [];
    if (q.domain) { params.push(q.domain); where.push(`policy_domain = $${params.length}`); }
    custom = await rows(pool,
      `SELECT policy_uid, policy_key, title, description, policy_domain, scope_entity_type, rule_kind,
              rule_field, rule_params, severity, enabled, evidence, documentation_reference,
              lifecycle_uid, created_by, created_at, updated_at
         FROM ${POLICY_TABLE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
         ORDER BY created_at DESC`, params);
  }
  return {
    ready: true,
    builtin_count: builtin.length,
    custom_registry_present: customReady,
    custom_count: customReady ? custom.length : null,
    builtin,
    custom,
    note: 'Policy definitions = a deterministic BUILT-IN set (in code; the honesty contract as machine-checkable rules) + a curated CUSTOM registry. custom_count=null until a flag-ON write has created the registry (built ≠ populated). Policy-Exists ≠ Compliant. null ≠ zero.',
  };
}

/** Register a curated custom policy (WRITE — owns ensure-schema; flag-ON only). */
export async function registerPolicy(
  pool: Pool,
  p: {
    policyKey: string; title: string; description?: string; policyDomain: string; scopeEntityType?: string;
    ruleKind: string; ruleField?: string; ruleParams?: Record<string, unknown>; severity?: string;
    enabled?: boolean; evidence?: string; documentation?: string; lifecycleUid?: string; actor?: string | null;
  },
): Promise<{ ok: boolean; policy_uid?: string; error?: string }> {
  if (!p.policyKey || !p.policyKey.trim()) return { ok: false, error: 'policyKey_required' };
  if (!p.title || !p.title.trim()) return { ok: false, error: 'title_required' };
  if (!p.policyDomain || !p.policyDomain.trim()) return { ok: false, error: 'policyDomain_required' };
  const VALID_KINDS = ['field_present', 'field_absent', 'value_in', 'count_threshold'];
  if (!VALID_KINDS.includes(p.ruleKind)) return { ok: false, error: 'invalid_rule_kind' };
  if (p.ruleKind !== 'count_threshold' && (!p.ruleField || !SAFE_FIELDS.has(p.ruleField))) {
    return { ok: false, error: 'rule_field_not_in_safe_whitelist' };
  }
  if (p.policyKey.startsWith('builtin.')) return { ok: false, error: 'reserved_builtin_prefix' };
  await ensureAutomationSchema(pool);
  const dup = (await rows(pool, `SELECT policy_uid FROM ${POLICY_TABLE} WHERE policy_key = $1`, [p.policyKey.trim()]))[0];
  if (dup) return { ok: false, error: 'policy_key_exists' };
  const id = uid('pol');
  await pool.query(
    `INSERT INTO ${POLICY_TABLE}
       (policy_uid, policy_key, title, description, policy_domain, scope_entity_type, rule_kind,
        rule_field, rule_params, severity, enabled, evidence, documentation_reference, lifecycle_uid, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15)`,
    [id, p.policyKey.trim(), p.title.trim(), p.description ?? null, p.policyDomain.trim(), p.scopeEntityType ?? null,
     p.ruleKind, p.ruleField ?? null, JSON.stringify(p.ruleParams ?? {}), p.severity ?? 'warn',
     p.enabled !== false, p.evidence ?? null, p.documentation ?? null, p.lifecycleUid ?? null, p.actor ?? null],
  );
  return { ok: true, policy_uid: id };
}

/** Enable/disable a custom policy (WRITE; flag-ON only). */
export async function setPolicyEnabled(
  pool: Pool, policyUid: string, enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  await ensureAutomationSchema(pool);
  const existing = (await rows(pool, `SELECT policy_uid FROM ${POLICY_TABLE} WHERE policy_uid = $1`, [policyUid]))[0];
  if (!existing) return { ok: false, error: 'unknown_policy' };
  await pool.query(`UPDATE ${POLICY_TABLE} SET enabled = $2, updated_at = now() WHERE policy_uid = $1`, [policyUid, enabled]);
  return { ok: true };
}

// ── PART 4: Compliance Engine (MEASURED on-demand vs the live registry; Compliance ≠ RuntimeUsage) ──
export async function evaluateCompliance(pool: Pool): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return FOUNDATION_NOT_READY;
  const [val, lval, repoH, repoIntel, compat] = await Promise.all([
    getValidation(pool), getLifecycleValidation(pool), getRepositoryHealth(pool),
    getRepositoryHealthIntel(pool), getCompatibilityIntelligence(pool),
  ]);
  const totalReg = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry`);
  const totalCap = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type='capability'`);
  const totalMig = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE entity_type='migration'`);

  const fv = val.checks ?? {};
  const mv = lval.metadata_validation ?? {};
  const rh = repoH.checks ?? {};
  const ri = repoIntel.checks ?? {};
  const SRC: Record<string, number | null> = {
    'foundation.missing_owners': fv.missing_owners ?? null,
    'foundation.missing_documentation': fv.missing_documentation ?? null,
    'foundation.missing_lifecycle_states': fv.missing_lifecycle_states ?? null,
    'foundation.duplicate_capability_ids': fv.duplicate_capability_ids ?? null,
    'metadata.invalid_lifecycle_states': mv.invalid_lifecycle_states ?? null,
    'metadata.repository_integrity_broken_references': mv.repository_integrity_broken_references ?? null,
    'metadata.capability_metadata_missing_version': mv.capability_metadata_missing_version ?? null,
    'metadata.migration_metadata_missing_version': mv.migration_metadata_missing_version ?? null,
    'repo_health.orphan_records': rh.orphan_records ?? null,
    'repo_health.duplicate_lifecycle_records': rh.duplicate_lifecycle_records ?? null,
    'repo_intel.circular_dependencies': ri.circular_dependencies ?? null,
    'compat.migration_ordering_regressions': compat.compatibility?.migration?.ordering_regressions ?? null,
    'compat.breaking_count': compat.compatibility?.backward?.breaking_count ?? null,
  };
  const denomOf = (scope: BuiltinPolicy['scope']) => scope === 'capability' ? totalCap : scope === 'migration' ? totalMig : totalReg;

  // Built-in policy evaluation: each maps to an already-MEASURED number (no new fabricated computation).
  const builtinEval = BUILTIN_POLICIES.map((p) => {
    const violations = SRC[p.source.startsWith('compat.migration') ? 'compat.migration_ordering_regressions' : p.source] ?? null;
    const denominator = denomOf(p.scope);
    return {
      policy_key: p.policy_key, title: p.title, policy_domain: p.policy_domain, severity: p.severity, kind: 'builtin',
      evaluated: violations != null,
      violations,
      denominator,
      compliance_ratio: violations == null ? null : pct(Math.max(denominator - violations, 0), denominator),
      source: p.source,
    };
  });

  // Custom policy evaluation: safe, parameterised, whitelist-guarded.
  const customReady = await tableReady(pool, POLICY_TABLE);
  let customEval: any[] = [];
  if (customReady) {
    const custom = await rows(pool, `SELECT * FROM ${POLICY_TABLE} WHERE enabled = true`);
    for (const c of custom) customEval.push(await evaluateCustomPolicy(pool, c));
  }

  const all = [...builtinEval, ...customEval];
  const evaluated = all.filter((p) => p.evaluated);
  const blocking_violations = evaluated.filter((p) => p.severity === 'blocking' && (p.violations ?? 0) > 0).length;

  // Per-domain compliance = mean of evaluated policy compliance_ratios in that domain (SEPARATE axes, never one verdict).
  const byDomain: Record<string, { policies: number; evaluated: number; compliance: number | null }> = {};
  for (const p of all) {
    const d = byDomain[p.policy_domain] ?? (byDomain[p.policy_domain] = { policies: 0, evaluated: 0, compliance: null });
    d.policies++;
    if (p.evaluated) d.evaluated++;
  }
  for (const dom of Object.keys(byDomain)) {
    byDomain[dom].compliance = mean(all.filter((p) => p.policy_domain === dom && p.evaluated).map((p) => p.compliance_ratio));
  }

  return {
    ready: true,
    composes: ['platform-lifecycle (1.37)', 'platform-lifecycle-intelligence (1.39)'],
    totals: { policies: all.length, builtin: builtinEval.length, custom: customEval.length, evaluated: evaluated.length, blocking_violations },
    counts: { registry: totalReg, capabilities: totalCap, migrations: totalMig },
    compliance_by_domain: byDomain,
    overall_compliance: mean(evaluated.map((p) => p.compliance_ratio)),
    policies: all,
    note: 'Compliance is MEASURED on-demand by evaluating every policy against the LIVE registry — results are not persisted (Compliance ≠ RuntimeUsage; Policy-Exists ≠ Compliant). Built-ins read the SAME measured numbers the 1.37–1.40 validators compute (no new computation). overall_compliance is the mean of evaluated policy ratios; per-domain ratios are reported SEPARATELY and a policy is null when unmeasurable (null ≠ zero).',
  };
}

/** Evaluate a single custom policy with a parameterised, whitelist-guarded query (injection-safe). */
async function evaluateCustomPolicy(pool: Pool, c: any): Promise<any> {
  const base = {
    policy_key: c.policy_key, title: c.title, policy_domain: c.policy_domain, severity: c.severity, kind: 'custom' as const,
  };
  const scopeParams: unknown[] = [];
  let scopeWhere = '';
  if (c.scope_entity_type) { scopeParams.push(c.scope_entity_type); scopeWhere = ` WHERE entity_type = $${scopeParams.length}`; }
  let denominator = 0;
  try {
    denominator = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry${scopeWhere}`, scopeParams);
  } catch { return { ...base, evaluated: false, violations: null, denominator: 0, compliance_ratio: null, note: 'scope_unmeasurable' }; }

  // count_threshold operates on the scope count itself (no field needed).
  if (c.rule_kind === 'count_threshold') {
    const max = Number((c.rule_params ?? {}).max);
    if (!Number.isFinite(max)) return { ...base, evaluated: false, violations: null, denominator, compliance_ratio: null, note: 'count_threshold_requires_numeric_max' };
    const violations = Math.max(denominator - max, 0);
    return { ...base, evaluated: true, violations, denominator, compliance_ratio: violations === 0 ? 100 : 0, note: `count ${denominator} vs max ${max}` };
  }

  // field rules: guard the field against the exact-match whitelist BEFORE any interpolation (injection-safe).
  const field = String(c.rule_field ?? '');
  if (!SAFE_FIELDS.has(field)) return { ...base, evaluated: false, violations: null, denominator, compliance_ratio: null, note: 'rule_field_not_in_safe_whitelist' };
  const params = [...scopeParams];
  let cond = '';
  if (c.rule_kind === 'field_present') {
    cond = `${field} IS NULL`;
  } else if (c.rule_kind === 'field_absent') {
    cond = `${field} IS NOT NULL`;
  } else if (c.rule_kind === 'value_in') {
    const allowed = Array.isArray((c.rule_params ?? {}).allowed) ? (c.rule_params.allowed as unknown[]).map(String) : [];
    if (!allowed.length) return { ...base, evaluated: false, violations: null, denominator, compliance_ratio: null, note: 'value_in_requires_allowed_array' };
    params.push(allowed);
    cond = `(${field} IS NULL OR NOT (${field} = ANY($${params.length})))`;
  } else {
    return { ...base, evaluated: false, violations: null, denominator, compliance_ratio: null, note: 'unsupported_rule_kind' };
  }
  const whereParts = [scopeWhere ? scopeWhere.replace(' WHERE ', '') : '', cond].filter(Boolean);
  let violations = 0;
  try {
    violations = await scalar(pool, `SELECT count(*)::int n FROM platform_lifecycle_registry WHERE ${whereParts.join(' AND ')}`, params);
  } catch { return { ...base, evaluated: false, violations: null, denominator, compliance_ratio: null, note: 'evaluation_failed' }; }
  return { ...base, evaluated: true, violations, denominator, compliance_ratio: pct(Math.max(denominator - violations, 0), denominator) };
}

// ── PART 5: Orchestration Engine (read-only coordination of the four tiers; no duplicate logic) ──
export async function getOrchestration(pool: Pool): Promise<any> {
  const foundationReady = await foundationSchemaReady(pool);
  if (!foundationReady) return { ready: false, foundation_ready: false, ...FOUNDATION_NOT_READY };
  const [summary, mgmt, lifeMetrics, evo] = await Promise.all([
    getSummary(pool), getManagementSummary(pool), getLifecycleMetrics(pool), getEvolutionSummary(pool),
  ]);
  return {
    ready: true,
    foundation_ready: true,
    tiers: [
      { tier: '1.37 Foundation', responsibility: 'capability catalog + lifecycle registry + ownership + relationships + append-only state history', ready: summary.ready === true, discovered: summary.discovered === true, registry_entities: summary.totals?.registry ?? null },
      { tier: '1.38 Management', responsibility: 'deprecation / retirement / version ledger / evolution log (managed)', ready: mgmt.ready !== false, version_records: mgmt.management_totals?.version_records ?? null },
      { tier: '1.39 Intelligence', responsibility: 'lifecycle validation / metrics / compatibility / repository + lifecycle health (read-only)', ready: lifeMetrics.ready === true },
      { tier: '1.40 Evolution', responsibility: 'technical debt / version / knowledge / evolution validation + metrics (read-only)', ready: evo.ready === true },
    ],
    note: 'Orchestration COORDINATES the four lifecycle tiers READ-ONLY by composing their summaries (no duplicate registry/engine, no business-logic change). It reports each tier\'s readiness; it does NOT re-run their computations or mutate their state. null ≠ zero.',
  };
}

// ── PART 6: Continuous Validation (composes 1.39 + 1.40 validation into one MEASURED report) ──
export async function getContinuousValidation(pool: Pool): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return FOUNDATION_NOT_READY;
  const [lval, eval40, repoIntel] = await Promise.all([
    getLifecycleValidation(pool), getEvolutionValidation(pool), getRepositoryHealthIntel(pool),
  ]);
  const mv = lval.metadata_validation ?? {};
  const ri = repoIntel.checks ?? {};

  const checks: Record<string, Check> = {
    metadata_validation: check(mv.invalid_lifecycle_states ?? null, 'invalid lifecycle states (1.39)'),
    dependency_validation: check(mv.dependency_metadata_absent ?? null, 'entities with no declared dependencies (1.39)'),
    version_integrity: check((mv.capability_metadata_missing_version ?? null) == null ? null : (mv.capability_metadata_missing_version ?? 0) + (mv.migration_metadata_missing_version ?? 0), 'capabilities/migrations missing version (1.39)'),
    repository_integrity: check(mv.repository_integrity_broken_references ?? null, 'broken repository references (1.39)'),
    documentation_integrity: check(lval.foundation_validation?.missing_documentation ?? null, 'entities missing documentation (1.37 via 1.39)'),
    architecture_integrity: check(ri.circular_dependencies ?? null, 'circular dependencies (1.39 repository intelligence)'),
    knowledge_preservation: check(
      eval40.knowledge_preservation?.retired_entities == null ? null
        : (eval40.knowledge_preservation.retired_entities - (eval40.knowledge_preservation.retired_with_knowledge_preserved ?? 0)),
      'retired entities without preserved knowledge (1.40)'),
  };
  return {
    ready: true,
    composes: ['platform-lifecycle-intelligence (1.39)', 'platform-evolution-intelligence (1.40)'],
    checks,
    validation_success: passRate(checks),
    note: 'Continuous Validation COMPOSES the 1.39 + 1.40 validators into one MEASURED report (no parallel validation engine). Validation ≠ Modification — it only reads. validation_success is the fraction of MEASURABLE checks that pass; unmeasurable checks are excluded (null ≠ zero).',
  };
}

// ── PART 7: Automated Quality Gates (Gate-Pass ≠ Production-Ready) ──
type Gate = { measured_value: number | null; threshold: number | null; comparator: '<=' | '>='; status: 'pass' | 'warn' | 'fail' | 'structural' | 'unmeasurable'; basis: string };
function gateMin(value: number | null, threshold: number, basis: string): Gate {
  // higher-is-better gate: pass when value >= threshold.
  if (value == null) return { measured_value: null, threshold, comparator: '>=', status: 'unmeasurable', basis };
  return { measured_value: value, threshold, comparator: '>=', status: value >= threshold ? 'pass' : (value >= threshold - 15 ? 'warn' : 'fail'), basis };
}
function gateMax(value: number | null, threshold: number, basis: string): Gate {
  // lower-is-better gate: pass when value <= threshold.
  if (value == null) return { measured_value: null, threshold, comparator: '<=', status: 'unmeasurable', basis };
  return { measured_value: value, threshold, comparator: '<=', status: value <= threshold ? 'pass' : 'fail', basis };
}
export async function getQualityGates(pool: Pool): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return FOUNDATION_NOT_READY;
  const [lifeMetrics, evoMetrics, debt] = await Promise.all([
    getLifecycleMetrics(pool), getEvolutionMetrics(pool), getTechnicalDebtIntelligence(pool),
  ]);
  const ls = lifeMetrics.scores ?? {};
  const es = evoMetrics.scores ?? {};
  const trackedDebt = debt.registry?.total_items ?? null; // tracked items (markers reported separately, never as debt)
  const unresolvedDebt = trackedDebt == null ? null : (trackedDebt - Math.round((trackedDebt * ((debt.registry?.resolution_rate ?? 0) as number)) / 100));

  const gates: Record<string, Gate> = {
    repository_health: gateMin(ls.repository_health_score ?? null, 90, 'repository_health_score (1.39 metrics)'),
    technical_debt: unresolvedDebt == null
      ? { measured_value: null, threshold: 0, comparator: '<=', status: 'unmeasurable', basis: 'unresolved tracked debt items (1.40) — null until debt is tracked (markers are NOT debt)' }
      : gateMax(unresolvedDebt, 0, 'unresolved tracked debt items (1.40 registry)'),
    migration_safety: gateMin(es.migration_health ?? null, 100, 'migration_health = parseable-version coverage (1.40 metrics)'),
    compatibility: gateMin(ls.compatibility_score ?? null, 100, 'compatibility_score (1.39 metrics)'),
    documentation: gateMin(es.knowledge_health ?? null, 80, 'knowledge_health = retired-entity knowledge coverage (1.40 metrics)'),
    architecture_stability: gateMin(ls.architecture_stability ?? null, 90, 'architecture_stability (1.39 metrics)'),
    regression_risk: { measured_value: null, threshold: null, comparator: '<=', status: 'structural', basis: 'Regression risk is controlled STRUCTURALLY — every additive phase is flag-gated OFF byte-identical, so prior behaviour is preserved by construction. Not runtime-measured here (honest scope boundary).' },
  };
  const measurable = Object.values(gates).filter((g) => g.status === 'pass' || g.status === 'warn' || g.status === 'fail');
  const passing = measurable.filter((g) => g.status === 'pass').length;
  return {
    ready: true,
    composes: ['platform-lifecycle-intelligence (1.39)', 'platform-evolution-intelligence (1.40)'],
    gates,
    gate_pass_rate: pct(passing, measurable.length),
    note: 'Automated Quality Gates compose the 1.39 + 1.40 MEASURED metrics against explicit thresholds. Gate-Pass ≠ Production-Ready — gates are a quality signal, not a launch verdict (STOP clause: no gate auto-blocks anything). regression_risk is a STRUCTURAL guarantee (flag-OFF byte-identical), not runtime-measured. Repository markers are NOT counted as technical debt. null ≠ zero.',
  };
}

// ── PART 9: Automation Metrics — SIX SEPARATE measured scores (NEVER composited) ──
export async function getAutomationMetrics(pool: Pool): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return FOUNDATION_NOT_READY;
  const [automation, governance, compliance, validation, lifeMetrics] = await Promise.all([
    getLifecycleAutomation(pool), getContinuousGovernance(pool), evaluateCompliance(pool),
    getContinuousValidation(pool), getLifecycleMetrics(pool),
  ]);
  const scores = {
    automation_health: automation.pass_rate ?? null,            // % of measurable automation checks passing
    compliance_health: compliance.overall_compliance ?? null,   // mean evaluated policy compliance ratio
    governance_health: governance.pass_rate ?? null,            // % of measurable governance areas passing
    validation_success: validation.validation_success ?? null,  // % of measurable validation checks passing
    repository_stability: lifeMetrics.scores?.repository_health_score ?? null, // reuse 1.39 (compose, never recompute)
    lifecycle_stability: lifeMetrics.scores?.lifecycle_health_score ?? null,   // reuse 1.39 (compose, never recompute)
  };
  return {
    ready: true,
    composes: ['platform-lifecycle-intelligence.metrics (1.39)'],
    scores,
    compliance_indicators: {
      total_policies: compliance.totals?.policies ?? null,
      evaluated_policies: compliance.totals?.evaluated ?? null,
      blocking_violations: compliance.totals?.blocking_violations ?? null,
      dormant_capabilities: lifeMetrics.tech_debt_indicators?.dormant_capabilities ?? null,
      note: 'Dormant capabilities are NOT non-compliance — built-but-deactivated by design (flag OFF). Blocking violations are MEASURED, reported for transparency, never auto-remediated (STOP clause).',
    },
    note: 'SIX SEPARATE MEASURED scores (0–100). They are deliberately NOT composited into a single "overall" verdict (Automation ⟂ Compliance ⟂ Governance ⟂ Validation ⟂ Repository-Stability ⟂ Lifecycle-Stability). repository/lifecycle stability REUSE the 1.39 measured metrics (compose, never recompute). A score is null when its denominator is 0 (null ≠ zero).',
  };
}

// ── PART 8: Continuous Governance Audit (drift) — append-only; the snapshot is a WRITE path ──
export async function captureGovernanceSnapshot(pool: Pool, actor: string | null): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return FOUNDATION_NOT_READY;
  await ensureAutomationSchema(pool);
  const [metrics, automation, governance, compliance, validation, gates] = await Promise.all([
    getAutomationMetrics(pool), getLifecycleAutomation(pool), getContinuousGovernance(pool),
    evaluateCompliance(pool), getContinuousValidation(pool), getQualityGates(pool),
  ]);
  const s = metrics.scores ?? {};
  const id = uid('gov_snap');
  const full = { metrics, automation, governance, compliance, validation, quality_gates: gates };
  await pool.query(
    `INSERT INTO ${SNAPSHOT_TABLE}
       (snapshot_uid, automation_health, compliance_health, governance_health,
        validation_success, repository_stability, lifecycle_stability, metrics, compliance_indicators, captured_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10)`,
    [id, s.automation_health, s.compliance_health, s.governance_health, s.validation_success,
     s.repository_stability, s.lifecycle_stability, JSON.stringify(full),
     JSON.stringify(metrics.compliance_indicators ?? {}), actor],
  );
  return { ok: true, snapshot_uid: id, captured_at: new Date().toISOString(), scores: s };
}

export async function getGovernanceSnapshots(pool: Pool, q: { limit?: number }): Promise<{ ready: boolean; rows: any[] }> {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) return { ready: false, rows: [] };
  const lim = Math.min(Math.max(Number.isFinite(q.limit as number) ? (q.limit as number) : 50, 1), 500);
  const r = await rows(pool,
    `SELECT snapshot_uid, automation_health, compliance_health, governance_health,
            validation_success, repository_stability, lifecycle_stability, captured_by, captured_at
       FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC, id DESC LIMIT ${lim}`);
  return { ready: true, rows: r };
}

/** Governance drift = diff between the two most recent snapshots (MEASURED per-metric deltas). */
export async function getGovernanceDrift(pool: Pool): Promise<any> {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) return { ready: false, note: 'No governance snapshots captured yet (POST /audit/capture to create the first one).' };
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
      automation_health: delta(cur.automation_health, prev.automation_health),
      compliance_health: delta(cur.compliance_health, prev.compliance_health),
      governance_health: delta(cur.governance_health, prev.governance_health),
      validation_success: delta(cur.validation_success, prev.validation_success),
      repository_stability: delta(cur.repository_stability, prev.repository_stability),
      lifecycle_stability: delta(cur.lifecycle_stability, prev.lifecycle_stability),
    },
    note: 'Drift = current minus previous snapshot per metric (MEASURED). A null delta means one side was unmeasurable (null ≠ zero — never coerced to 0).',
  };
}

function scoreRow(r: any) {
  return {
    snapshot_uid: r.snapshot_uid, captured_at: r.captured_at,
    automation_health: r.automation_health, compliance_health: r.compliance_health,
    governance_health: r.governance_health, validation_success: r.validation_success,
    repository_stability: r.repository_stability, lifecycle_stability: r.lifecycle_stability,
  };
}

/** Continuous Audit view — composes drift + the live governance/compliance read surfaces (read-only). */
export async function getGovernanceAudit(pool: Pool): Promise<any> {
  if (!(await foundationSchemaReady(pool))) return FOUNDATION_NOT_READY;
  const [drift, governance, compliance, validation] = await Promise.all([
    getGovernanceDrift(pool), getContinuousGovernance(pool), evaluateCompliance(pool), getContinuousValidation(pool),
  ]);
  return {
    ready: true,
    audit: {
      compliance_audit: { overall_compliance: compliance.overall_compliance ?? null, by_domain: compliance.compliance_by_domain ?? null, blocking_violations: compliance.totals?.blocking_violations ?? null },
      governance_audit: { areas: governance.areas ?? null, pass_rate: governance.pass_rate ?? null },
      validation_audit: { checks: validation.checks ?? null, validation_success: validation.validation_success ?? null },
      drift,
    },
    note: 'Continuous Audit COMPOSES the live governance/compliance/validation read surfaces + the append-only snapshot drift (no new computation). Every figure is MEASURED; null ≠ zero.',
  };
}

// ── Automation summary (read-only; composes all engines + declares its composition) ──
export async function getAutomationSummary(pool: Pool): Promise<any> {
  const foundationReady = await foundationSchemaReady(pool);
  if (!foundationReady) return { ready: false, foundation_ready: false, ...FOUNDATION_NOT_READY };
  const [metrics, compliance, policies, snapshots] = await Promise.all([
    getAutomationMetrics(pool), evaluateCompliance(pool), getPolicyDefinitions(pool), getGovernanceSnapshots(pool, { limit: 1 }),
  ]);
  return {
    ready: true,
    foundation_ready: true,
    composes: [
      'platform-lifecycle (1.37 Foundation)',
      'platform-lifecycle-management (1.38 Management)',
      'platform-lifecycle-intelligence (1.39 Intelligence)',
      'platform-evolution-intelligence (1.40 Evolution)',
    ],
    scores: metrics.scores ?? null,
    compliance_indicators: metrics.compliance_indicators ?? null,
    policies: { builtin: policies.builtin_count ?? null, custom: policies.custom_count ?? null },
    compliance: { overall: compliance.overall_compliance ?? null, blocking_violations: compliance.totals?.blocking_violations ?? null },
    snapshot_count: snapshots.ready ? snapshots.rows.length : 0,
    latest_snapshot: snapshots.ready ? (snapshots.rows[0] ?? null) : null,
    note: 'Platform Lifecycle Automation COMPOSES the 1.37 Foundation + 1.38 Management + 1.39 Intelligence + 1.40 Evolution (no parallel registry/engine, no business-logic change, no dormant-capability activation). Every score is MEASURED and reported as a SEPARATE axis — never composited. Automation runs read-only checks; it never mutates state (STOP clause). null ≠ zero.',
  };
}
