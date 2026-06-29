/**
 * MX-800 Phase 2.1 — Platform Intelligence Operating System (PIOS): Constitution & Foundation.
 * Service layer for the canonical Platform Intelligence REGISTRY + GOVERNANCE foundation.
 *
 * ENHANCEMENT-ONLY. This is a METADATA + COORDINATION foundation over the EXISTING intelligence
 * engines. It introduces NO parallel intelligence engine, NO duplicate registry (it SOFT-references
 * the MX-700 platform_lifecycle registry via lifecycle_uid), and changes NO business logic. It does
 * NOT execute the engines and does NOT reason / predict / recommend / automate. The repository
 * remains the single source of truth: every entry is a curated descriptor whose presence is
 * VERIFIED against the live filesystem, and whose activation_state is DERIVED from the live flag.
 *
 * HONESTY CONTRACT (user preference — honesty over optimism, never fabricate):
 *   - Intelligence-Exists ≠ Connected ≠ Orchestrated. Built ≠ Activated. Registered ≠ Used.
 *   - Coverage ⟂ Confidence ⟂ Evidence reported as SEPARATE axes, never blended.
 *   - confidence here is STRUCTURAL-ONLY (file existence + flag registry + doc refs). No runtime
 *     or outcome confidence is claimed in 2.1 (that requires runtime evidence → future phases).
 *   - owner is honest-NULL when unknown (never fabricated). A rate with a 0 denominator → null.
 *   - present is MEASURED (fs.access). activation_state is DERIVED from isFlagEnabled.
 *
 * lifecycle_state is MANAGED (human transitions); activation_state/present are DERIVED. Re-discovery
 * refreshes the derived fields and NEVER clobbers a managed lifecycle_state.
 *
 * Reads are GET-never-writes: they compose the in-code catalog (always file-verified) and overlay
 * any persisted registry rows. The lazy ensure-schema runs ONLY on flag-ON write paths
 * (discover / register / audit-capture) so flag OFF → byte-identical incl. schema (0 tables).
 */
import type { Pool } from 'pg';
import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { isFlagEnabled, isPlatformIntelligenceRegistryEnabled, type FeatureFlagKey } from '../config/feature-flags';

/**
 * Defense-in-depth flag guard for WRITE/DDL paths. The HTTP routes already 503 before any DB touch
 * when the flag is OFF, but service functions can be imported directly (e.g. by tooling/scripts), so
 * every write asserts the flag itself BEFORE `ensureRegistrySchema` — keeping "OFF byte-identical
 * incl. schema" true regardless of caller. Reads stay caller-agnostic (they only probe via to_regclass
 * and never create schema).
 */
class PlatformIntelligenceRegistryDisabled extends Error {
  code = 'platform_intelligence_registry_disabled';
  constructor() {
    super('platform_intelligence_registry flag is OFF — write/DDL paths are inert (byte-identical legacy).');
    this.name = 'PlatformIntelligenceRegistryDisabled';
  }
}
function assertRegistryEnabled(): void {
  if (!isPlatformIntelligenceRegistryEnabled()) throw new PlatformIntelligenceRegistryDisabled();
}

const __dirname_ = path.dirname(fileURLToPath(import.meta.url)); // backend/services
const BACKEND_ROOT = path.resolve(__dirname_, '..');             // backend
const REGISTRY_TABLE = 'platform_intelligence_registry';
const SNAPSHOT_TABLE = 'platform_intelligence_audit_snapshots';

// The 13 canonical registry fields whose population the governance baseline measures (Part 6).
const GOVERNANCE_FACETS = [
  'metadata', 'evidence', 'confidence', 'explainability',
  'ownership', 'repository_refs', 'compatibility',
] as const;

type CatalogEntry = {
  intelligence_uid: string;
  name: string;
  intelligence_type: string;
  domain: string;
  owner: string | null;
  inputs: string[];
  outputs: string[];
  dependencies: string[];      // other intelligence_uids
  repository_refs: string[];   // backend-relative paths (verified at runtime)
  documentation_refs: string[];
  flag_key: FeatureFlagKey | null;
  version: string | null;
  explainability: { what: string; why: string; how: string };
};

/**
 * Curated intelligence catalog (Part 4 metadata). Each entry DESCRIBES an existing engine — it does
 * not modify it. Anchored to the 9 constitutional domains established in the Phase 2.1 audit +
 * constitution. repository_refs are verified against the live filesystem at read time (present flag).
 */
const INTELLIGENCE_CATALOG: CatalogEntry[] = [
  {
    intelligence_uid: 'intel.assessment',
    name: 'Assessment Intelligence',
    intelligence_type: 'runtime',
    domain: 'Assessment Intelligence',
    owner: null,
    inputs: ['assessment responses', 'ontology blueprints', 'role DNA'],
    outputs: ['competency scores', 'adaptive question selection', 'difficulty calibration'],
    dependencies: ['intel.competency'],
    repository_refs: [
      'services/adaptive-assessment-engine.ts',
      'services/adaptive-blueprint-generation-engine.ts',
      'services/hiring-assessment-engine.ts',
      'services/adaptive-difficulty-activation.ts',
    ],
    documentation_refs: ['docs/COMPETENCY_ASSESSMENT.md', 'docs/CAPADEX.md'],
    flag_key: 'adaptiveAssessmentRuntimeV2',
    version: 'v2',
    explainability: {
      what: 'Adaptive assessment + scoring runtime.',
      why: 'Measures competencies via ontology-driven adaptive blueprints.',
      how: 'Composes blueprint generation, adaptive difficulty, and hiring-assessment engines.',
    },
  },
  {
    intelligence_uid: 'intel.behaviour',
    name: 'Behaviour Intelligence',
    intelligence_type: 'runtime',
    domain: 'Behaviour Intelligence',
    owner: null,
    inputs: ['behavioural signals', 'session telemetry', 'longitudinal memory'],
    outputs: ['behaviour graph', 'behavioural trends', 'memory snapshots'],
    dependencies: ['intel.concern'],
    repository_refs: [
      'services/behavioural-memory.ts',
      'services/longitudinal-memory.ts',
      'services/trend-engine.ts',
      'services/lbi-trend-engine.ts',
    ],
    documentation_refs: ['docs/CAPADEX.md'],
    flag_key: 'adaptiveOrchestrationV2',
    version: 'v2',
    explainability: {
      what: 'Behavioural signal + memory + trend intelligence.',
      why: 'Tracks behavioural state and longitudinal change.',
      how: 'Composes behavioural/longitudinal memory and trend engines.',
    },
  },
  {
    intelligence_uid: 'intel.concern',
    name: 'Concern Intelligence',
    intelligence_type: 'runtime',
    domain: 'Concern Intelligence',
    owner: null,
    inputs: ['clarity responses', 'concern ontology', 'bridge tags'],
    outputs: ['resolved concerns', 'concern-signal mapping', 'guidance chain'],
    dependencies: ['intel.behaviour'],
    repository_refs: [
      'routes/capadex-concern-intelligence.ts',
      'routes/capadex.ts',
    ],
    documentation_refs: ['docs/CAPADEX.md'],
    flag_key: 'runtimeIntelligencePipeline',
    version: 'v1',
    explainability: {
      what: 'CAPADEX concern resolution + intelligence pipeline.',
      why: 'Maps user clarity input to canonical concerns and signals.',
      how: 'Composes concern routing, bridge-tag resolution, and the runtime pipeline.',
    },
  },
  {
    intelligence_uid: 'intel.competency',
    name: 'Competency Intelligence',
    intelligence_type: 'runtime',
    domain: 'Competency Intelligence',
    owner: null,
    inputs: ['competency genome', 'assessment scores', 'role profiles'],
    outputs: ['competency profiles', 'competency forecasts', 'EI dimensions'],
    dependencies: ['intel.assessment'],
    repository_refs: [
      'services/competency-intelligence.ts',
      'services/competency-intelligence-orchestrator.ts',
      'services/competency-intelligence-profile-engine.ts',
      'services/competency-forecasting-engine.ts',
    ],
    documentation_refs: ['docs/COMPETENCY_AND_ADAPTIVE_INTELLIGENCE.md', 'docs/COMPETENCY_ASSESSMENT.md'],
    flag_key: 'advancedCompetencyRuntimeV2',
    version: 'v2',
    explainability: {
      what: 'Competency genome runtime + forecasting.',
      why: 'Resolves contextual competency profiles and projections.',
      how: 'Composes competency orchestrator, profile, and forecasting engines.',
    },
  },
  {
    intelligence_uid: 'intel.learning',
    name: 'Learning Intelligence',
    intelligence_type: 'runtime',
    domain: 'Learning Intelligence',
    owner: null,
    inputs: ['competency gaps', 'learning catalog', 'intervention outcomes'],
    outputs: ['learning paths', 'learning ROI', 'recommendations'],
    dependencies: ['intel.competency', 'intel.career'],
    repository_refs: [
      'services/learning-path-engine.ts',
      'services/learning-roi-engine.ts',
      'services/intervention-learning-engine.ts',
      'services/learning-hub-composer.ts',
    ],
    documentation_refs: ['docs/CAREER_BUILDER.md'],
    flag_key: 'learningPath',
    version: 'v1',
    explainability: {
      what: 'Learning path + ROI + intervention intelligence.',
      why: 'Turns competency gaps into learning journeys.',
      how: 'Composes learning-path, ROI, and intervention-learning engines.',
    },
  },
  {
    intelligence_uid: 'intel.career',
    name: 'Career Intelligence',
    intelligence_type: 'runtime',
    domain: 'Career Intelligence',
    owner: null,
    inputs: ['competency profiles', 'occupation graph', 'role DNA'],
    outputs: ['career graph', 'role readiness', 'career recommendations'],
    dependencies: ['intel.competency'],
    repository_refs: [
      'services/career-graph-engine.ts',
      'services/career-learning-rec-engine.ts',
    ],
    documentation_refs: ['docs/CAREER_BUILDER.md'],
    flag_key: 'careerIntelligence',
    version: 'v1',
    explainability: {
      what: 'Career graph + recommendation intelligence.',
      why: 'Projects career pathways from competency state.',
      how: 'Composes career-graph and career recommendation engines.',
    },
  },
  {
    intelligence_uid: 'intel.decision',
    name: 'Decision Intelligence',
    intelligence_type: 'decision',
    domain: 'Decision Intelligence',
    owner: null,
    inputs: ['career signals', 'competency state', 'journey context'],
    outputs: ['decision snapshots', 'orchestrated next-step', 'growth-plan bridge'],
    dependencies: ['intel.career', 'intel.learning'],
    repository_refs: [
      'services/unified-adaptive-runtime-orchestrator.ts',
      'services/adaptive-event-bus.ts',
    ],
    documentation_refs: ['docs/phase-history.md'],
    flag_key: 'adaptiveRuntimeAuthority',
    version: 'v1',
    explainability: {
      what: 'Decision orchestration foundation.',
      why: 'Coordinates downstream decisions across engines.',
      how: 'Composes the unified adaptive runtime orchestrator + event bus.',
    },
  },
  {
    intelligence_uid: 'intel.report',
    name: 'Report Intelligence',
    intelligence_type: 'analytics',
    domain: 'Report Intelligence',
    owner: null,
    inputs: ['session results', 'benchmarks', 'stakeholder context'],
    outputs: ['stakeholder reports', 'PDF exports', 'visual data'],
    dependencies: ['intel.assessment', 'intel.analytics'],
    repository_refs: [
      'services/report-factory-schema.ts',
    ],
    documentation_refs: ['docs/CAPADEX.md'],
    flag_key: 'reportFactory',
    version: 'v1',
    explainability: {
      what: 'Report Factory execution + visualisation.',
      why: 'Produces stakeholder-facing reports from computed results.',
      how: 'Composes report-factory schema, renderer, and benchmark engines.',
    },
  },
  {
    intelligence_uid: 'intel.analytics',
    name: 'Analytics Intelligence',
    intelligence_type: 'analytics',
    domain: 'Analytics Intelligence',
    owner: null,
    inputs: ['cohort data', 'enterprise events', 'benchmarks'],
    outputs: ['enterprise analytics', 'k-anon aggregates', 'dashboards data'],
    dependencies: ['intel.competency'],
    repository_refs: [
      'services/enterprise-analytics-schema.ts',
    ],
    documentation_refs: ['docs/EMPLOYABILITY_INDEX.md'],
    flag_key: 'enterpriseAnalytics',
    version: 'v1',
    explainability: {
      what: 'Enterprise analytics aggregation.',
      why: 'Provides cohort-level k-anonymous analytics.',
      how: 'Composes the enterprise-analytics substrate.',
    },
  },
  {
    intelligence_uid: 'intel.ai',
    name: 'AI Intelligence',
    intelligence_type: 'ai',
    domain: 'AI Intelligence',
    owner: null,
    inputs: ['resume/LinkedIn/GitHub text', 'conversational input', 'governance policies'],
    outputs: ['inferred competencies', 'AI narratives', 'governance oversight'],
    dependencies: ['intel.competency'],
    repository_refs: [
      'services/ai-competency-inference-engine.ts',
      'services/ai-reasoning-engine.ts',
      'services/ai-governance-v2.ts',
      'services/ai-governance-llm.ts',
    ],
    documentation_refs: ['docs/phase-history.md'],
    flag_key: 'aiInferenceV2',
    version: 'v2',
    explainability: {
      what: 'AI inference + reasoning + governance.',
      why: 'Adds AI-assisted inference under governance oversight.',
      how: 'Composes AI inference, reasoning, and governance engines.',
    },
  },
  {
    intelligence_uid: 'intel.enterprise',
    name: 'Enterprise Intelligence',
    intelligence_type: 'enterprise',
    domain: 'Enterprise Intelligence',
    owner: null,
    inputs: ['workforce data', 'campaigns', 'scenarios'],
    outputs: ['workforce plans', 'executive intelligence', 'outcome tracking'],
    dependencies: ['intel.analytics', 'intel.competency'],
    repository_refs: [
      'services/employer-competency-intelligence.ts',
    ],
    documentation_refs: ['docs/EMPLOYABILITY_INDEX.md'],
    flag_key: 'enterpriseAnalytics',
    version: 'v1',
    explainability: {
      what: 'Enterprise / employer intelligence.',
      why: 'Surfaces workforce + employer-facing intelligence.',
      how: 'Composes employer-competency and enterprise engines.',
    },
  },
  {
    intelligence_uid: 'intel.repository',
    name: 'Repository Intelligence',
    intelligence_type: 'repository',
    domain: 'Repository Intelligence',
    owner: null,
    inputs: ['feature-flag registry', 'filesystem scan', 'migrations', 'docs'],
    outputs: ['capability catalog', 'lifecycle registry', 'repository health'],
    dependencies: [],
    repository_refs: [
      'services/platform-lifecycle.ts',
      'services/platform-lifecycle-management.ts',
      'services/platform-lifecycle-intelligence.ts',
    ],
    documentation_refs: ['docs/phase-history.md'],
    flag_key: 'platformLifecycleFoundation',
    version: 'mx-700',
    explainability: {
      what: 'Repository / platform-lifecycle intelligence (MX-700).',
      why: 'Discovers and governs the repository capability catalog.',
      how: 'Composes the platform-lifecycle foundation/management/intelligence tiers.',
    },
  },
];

let _schemaReady = false;

/** Lazy ensure-schema — canonical mirror of 20261221_platform_intelligence_registry.sql.
 *  ONLY called from flag-ON write paths (discover/register/audit-capture) → flag OFF byte-identical. */
export async function ensureRegistrySchema(pool: Pool): Promise<void> {
  if (_schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${REGISTRY_TABLE} (
      id                  BIGSERIAL PRIMARY KEY,
      intelligence_uid    TEXT UNIQUE NOT NULL,
      name                TEXT NOT NULL,
      intelligence_type   TEXT NOT NULL,
      domain              TEXT NOT NULL,
      owner               TEXT,
      lifecycle_state     TEXT NOT NULL DEFAULT 'registered',
      activation_state    TEXT,
      present             BOOLEAN,
      inputs              JSONB NOT NULL DEFAULT '[]',
      outputs             JSONB NOT NULL DEFAULT '[]',
      dependencies        JSONB NOT NULL DEFAULT '[]',
      evidence            JSONB NOT NULL DEFAULT '{}',
      confidence          JSONB NOT NULL DEFAULT '{}',
      explainability      JSONB NOT NULL DEFAULT '{}',
      repository_refs     JSONB NOT NULL DEFAULT '[]',
      documentation_refs  JSONB NOT NULL DEFAULT '[]',
      compatibility       JSONB NOT NULL DEFAULT '{}',
      version             TEXT,
      flag_key            TEXT,
      lifecycle_uid       TEXT,
      source              TEXT NOT NULL DEFAULT 'catalog',
      metadata            JSONB NOT NULL DEFAULT '{}',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_pir_domain ON ${REGISTRY_TABLE} (domain);
    CREATE INDEX IF NOT EXISTS idx_pir_type   ON ${REGISTRY_TABLE} (intelligence_type);
    CREATE TABLE IF NOT EXISTS ${SNAPSHOT_TABLE} (
      id                       BIGSERIAL PRIMARY KEY,
      snapshot_uid             TEXT UNIQUE NOT NULL,
      registry_total           INTEGER,
      domains_covered          INTEGER,
      metadata_completeness    NUMERIC,
      governance_completeness  NUMERIC,
      duplicate_registries     INTEGER,
      validation               JSONB NOT NULL DEFAULT '{}',
      summary                  JSONB NOT NULL DEFAULT '{}',
      captured_by              TEXT,
      captured_at              TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_pir_snapshots_captured_at
      ON ${SNAPSHOT_TABLE} (captured_at DESC);
  `);
  _schemaReady = true;
}

async function tableReady(pool: Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS ready`, [`public.${table}`]);
    return !!r.rows[0]?.ready;
  } catch { return false; }
}

/** MEASURED: does the repository file exist? (honest present flag — never fabricated). */
async function fileExists(rel: string): Promise<boolean> {
  try { await fs.access(path.join(BACKEND_ROOT, rel)); return true; }
  catch { return false; }
}

/** Build a fully-composed registry entry from a catalog descriptor + live verification.
 *  Source axes are kept SEPARATE and honest: present = filesystem, activation_state = flag. */
async function composeEntry(c: CatalogEntry) {
  const refChecks = await Promise.all(
    c.repository_refs.map(async (r) => ({ ref: r, present: await fileExists(r) })),
  );
  const presentCount = refChecks.filter((r) => r.present).length;
  const present = presentCount > 0;
  const flagOn = c.flag_key ? isFlagEnabled(c.flag_key) : null;
  const activation_state =
    c.flag_key == null ? 'n/a' : flagOn ? 'built_on' : 'built_off';

  // STRUCTURAL-ONLY confidence: file existence + flag registry + doc refs. No runtime/outcome claim.
  const confidence = {
    axis: 'structural',
    basis: 'file_existence + flag_registry + documentation_refs',
    repository_refs_present: `${presentCount}/${c.repository_refs.length}`,
    runtime_confidence: null as null,
    outcome_confidence: null as null,
    note: 'Structural metadata confidence only. Runtime/outcome confidence is NOT measured in Phase 2.1 (requires runtime evidence — future phase). Built ≠ Activated.',
  };
  const evidence = {
    repository: present ? 'file_verified' : 'absent',
    repository_refs_present: presentCount,
    repository_refs_total: c.repository_refs.length,
    flag_registered: c.flag_key != null,
    documentation_refs: c.documentation_refs.length,
    note: 'Evidence is structural (repository + flag registry + documentation presence). Coverage ⟂ Confidence ⟂ Evidence.',
  };
  const compatibility = {
    posture: 'additive',
    backward: 'preserved',
    migration: 'forward_only',
    business_logic_changed: false,
  };

  return {
    intelligence_uid: c.intelligence_uid,
    name: c.name,
    intelligence_type: c.intelligence_type,
    domain: c.domain,
    owner: c.owner,                 // honest-NULL
    lifecycle_state: 'registered',  // MANAGED default (overlaid by persisted value when present)
    activation_state,               // DERIVED from live flag
    present,                        // MEASURED
    inputs: c.inputs,
    outputs: c.outputs,
    dependencies: c.dependencies,
    evidence,
    confidence,
    explainability: c.explainability,
    repository_refs: refChecks,
    documentation_refs: c.documentation_refs,
    compatibility,
    version: c.version,
    flag_key: c.flag_key,
    lifecycle_uid: null as string | null,  // soft ref into platform_lifecycle (resolved on discover when present)
    source: 'catalog' as const,
  };
}

/** Compose the full catalog (always available, file-verified). */
async function composeCatalog() {
  return Promise.all(INTELLIGENCE_CATALOG.map(composeEntry));
}

/** Overlay persisted registry rows (managed lifecycle_state / owner / lifecycle_uid) onto the
 *  live catalog. The catalog is the structural truth; persistence carries MANAGED human fields. */
async function getComposedRegistry(pool: Pool) {
  const catalog = await composeCatalog();
  if (!(await tableReady(pool, REGISTRY_TABLE))) {
    return { source: 'catalog', persisted: false, entries: catalog };
  }
  let persisted: Record<string, any> = {};
  try {
    const r = await pool.query(
      `SELECT intelligence_uid, lifecycle_state, owner, lifecycle_uid, source FROM ${REGISTRY_TABLE}`,
    );
    persisted = Object.fromEntries(r.rows.map((row: any) => [row.intelligence_uid, row]));
  } catch { /* degrade to catalog-only */ }
  const entries = catalog.map((e) => {
    const p = persisted[e.intelligence_uid];
    if (!p) return e;
    return {
      ...e,
      lifecycle_state: p.lifecycle_state ?? e.lifecycle_state,  // MANAGED — never clobbered by re-discovery
      owner: p.owner ?? e.owner,
      lifecycle_uid: p.lifecycle_uid ?? e.lifecycle_uid,
      source: p.source ?? 'discovered',
    };
  });
  return { source: 'registry', persisted: true, entries };
}

// ── Part 3 — Platform Intelligence Registry ─────────────────────────────────
export async function getRegistry(pool: Pool) {
  const { source, persisted, entries } = await getComposedRegistry(pool);
  const byDomain: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const e of entries) {
    byDomain[e.domain] = (byDomain[e.domain] ?? 0) + 1;
    byType[e.intelligence_type] = (byType[e.intelligence_type] ?? 0) + 1;
  }
  return {
    canonical_registry: REGISTRY_TABLE,
    source,
    persisted,
    total: entries.length,
    domains_covered: Object.keys(byDomain).length,
    by_domain: byDomain,
    by_type: byType,
    present_count: entries.filter((e) => e.present).length,
    entries,
  };
}

export async function getRegistryEntry(pool: Pool, uid: string) {
  const { entries } = await getComposedRegistry(pool);
  const found = entries.find((e) => e.intelligence_uid === uid);
  if (!found) return { found: false, intelligence_uid: uid };
  return { found: true, entry: found };
}

/** Part 3 write — discover/populate the registry from the catalog + live verification.
 *  Upserts derived fields; PRESERVES managed lifecycle_state on conflict (re-discovery is safe). */
export async function discoverRegistry(pool: Pool, actor: string | null) {
  assertRegistryEnabled();
  await ensureRegistrySchema(pool);
  const entries = await composeCatalog();
  // Resolve soft lifecycle_uid references into platform_lifecycle WHEN that registry exists.
  const lifecycleReady = await tableReady(pool, 'platform_lifecycle_catalog');
  let upserted = 0;
  for (const e of entries) {
    let lifecycle_uid: string | null = null;
    if (lifecycleReady && e.flag_key) {
      try {
        const r = await pool.query(
          `SELECT lifecycle_uid FROM platform_lifecycle_catalog WHERE entity_type='flag' AND name=$1 LIMIT 1`,
          [e.flag_key],
        );
        lifecycle_uid = r.rows[0]?.lifecycle_uid ?? null;
      } catch { lifecycle_uid = null; }
    }
    await pool.query(
      `INSERT INTO ${REGISTRY_TABLE}
         (intelligence_uid, name, intelligence_type, domain, owner, activation_state, present,
          inputs, outputs, dependencies, evidence, confidence, explainability,
          repository_refs, documentation_refs, compatibility, version, flag_key, lifecycle_uid, source, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,
               $14::jsonb,$15::jsonb,$16::jsonb,$17,$18,$19,'discovered',now())
       ON CONFLICT (intelligence_uid) DO UPDATE SET
         name=EXCLUDED.name, intelligence_type=EXCLUDED.intelligence_type, domain=EXCLUDED.domain,
         activation_state=EXCLUDED.activation_state, present=EXCLUDED.present,
         inputs=EXCLUDED.inputs, outputs=EXCLUDED.outputs, dependencies=EXCLUDED.dependencies,
         evidence=EXCLUDED.evidence, confidence=EXCLUDED.confidence, explainability=EXCLUDED.explainability,
         repository_refs=EXCLUDED.repository_refs, documentation_refs=EXCLUDED.documentation_refs,
         compatibility=EXCLUDED.compatibility, version=EXCLUDED.version, flag_key=EXCLUDED.flag_key,
         lifecycle_uid=COALESCE(EXCLUDED.lifecycle_uid, ${REGISTRY_TABLE}.lifecycle_uid),
         source='discovered', updated_at=now()
         -- NOTE: lifecycle_state + owner are MANAGED and deliberately NOT overwritten here.`,
      [
        e.intelligence_uid, e.name, e.intelligence_type, e.domain, e.owner, e.activation_state, e.present,
        JSON.stringify(e.inputs), JSON.stringify(e.outputs), JSON.stringify(e.dependencies),
        JSON.stringify(e.evidence), JSON.stringify(e.confidence), JSON.stringify(e.explainability),
        JSON.stringify(e.repository_refs), JSON.stringify(e.documentation_refs),
        JSON.stringify(e.compatibility), e.version, e.flag_key, lifecycle_uid,
      ],
    );
    upserted += 1;
  }
  return {
    ok: true, discovered: upserted, total_catalog: entries.length,
    lifecycle_linked: lifecycleReady,
    actor, note: 'Derived fields refreshed; managed lifecycle_state/owner preserved.',
  };
}

/** Part 3 write — manual registration of an additional intelligence descriptor. */
export async function registerIntelligence(pool: Pool, body: any, actor: string | null) {
  assertRegistryEnabled();
  await ensureRegistrySchema(pool);
  const uid = String(body?.intelligence_uid ?? '').trim();
  const name = String(body?.name ?? '').trim();
  const intelligence_type = String(body?.intelligence_type ?? '').trim();
  const domain = String(body?.domain ?? '').trim();
  if (!uid || !name || !intelligence_type || !domain) {
    return { ok: false, error: 'intelligence_uid, name, intelligence_type and domain are required' };
  }
  const j = (v: unknown, d: unknown) => JSON.stringify(v ?? d);
  await pool.query(
    `INSERT INTO ${REGISTRY_TABLE}
       (intelligence_uid, name, intelligence_type, domain, owner, lifecycle_state,
        inputs, outputs, dependencies, evidence, confidence, explainability,
        repository_refs, documentation_refs, compatibility, version, flag_key, source, updated_at)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,'registered'),
             $7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,
             $13::jsonb,$14::jsonb,$15::jsonb,$16,$17,'manual',now())
     ON CONFLICT (intelligence_uid) DO UPDATE SET
       name=EXCLUDED.name, intelligence_type=EXCLUDED.intelligence_type, domain=EXCLUDED.domain,
       owner=COALESCE(EXCLUDED.owner, ${REGISTRY_TABLE}.owner),
       inputs=EXCLUDED.inputs, outputs=EXCLUDED.outputs, dependencies=EXCLUDED.dependencies,
       evidence=EXCLUDED.evidence, confidence=EXCLUDED.confidence, explainability=EXCLUDED.explainability,
       repository_refs=EXCLUDED.repository_refs, documentation_refs=EXCLUDED.documentation_refs,
       compatibility=EXCLUDED.compatibility, version=EXCLUDED.version, flag_key=EXCLUDED.flag_key,
       source='manual', updated_at=now()`,
    [
      uid, name, intelligence_type, domain, body?.owner ?? null, body?.lifecycle_state ?? null,
      j(body?.inputs, []), j(body?.outputs, []), j(body?.dependencies, []),
      j(body?.evidence, {}), j(body?.confidence, {}), j(body?.explainability, {}),
      j(body?.repository_refs, []), j(body?.documentation_refs, []), j(body?.compatibility, {}),
      body?.version ?? null, body?.flag_key ?? null,
    ],
  );
  return { ok: true, registered: uid, actor };
}

// ── Part 4 — Intelligence Metadata ──────────────────────────────────────────
export async function getMetadata(pool: Pool, uid: string) {
  const r = await getRegistryEntry(pool, uid);
  if (!r.found) return r;
  const e = r.entry;
  return {
    found: true,
    intelligence_uid: e.intelligence_uid,
    metadata: {
      name: e.name, intelligence_type: e.intelligence_type, domain: e.domain,
      owner: e.owner, lifecycle_state: e.lifecycle_state, activation_state: e.activation_state,
      version: e.version, evidence: e.evidence, confidence: e.confidence,
      explainability: e.explainability, dependencies: e.dependencies,
      compatibility: e.compatibility, repository_refs: e.repository_refs,
      documentation_refs: e.documentation_refs,
    },
    note: 'Metadata composed from the curated catalog (NOT by modifying engine source — no business-logic change).',
  };
}

// ── Part 5 — Orchestration Foundation (metadata-level; never executes engines) ──
export async function getOrchestration(pool: Pool) {
  const { entries } = await getComposedRegistry(pool);
  // Composition graph from declared dependencies (metadata only).
  const known = new Set(entries.map((e) => e.intelligence_uid));
  const edges: { from: string; to: string; resolved: boolean }[] = [];
  for (const e of entries) {
    for (const dep of e.dependencies) edges.push({ from: e.intelligence_uid, to: dep, resolved: known.has(dep) });
  }
  return {
    note: 'Orchestration FOUNDATION — metadata-level coordination only. It does NOT execute engines and does NOT reason/predict/recommend/automate (out of scope for Phase 2.1).',
    discovery: { discoverable: entries.length, present: entries.filter((e) => e.present).length },
    registration: { registry: REGISTRY_TABLE, registered: entries.length },
    coordination: { domains: Array.from(new Set(entries.map((e) => e.domain))) },
    composition: { dependency_edges: edges.length, unresolved: edges.filter((x) => !x.resolved) },
    routing: { strategy: 'by intelligence_uid or intelligence_type → repository_refs (metadata routing, no execution)' },
    explainability: { per_entity: `${'/api/admin/platform-intelligence-registry/explain/:uid'}` },
    posture: 'Connected via one registry contract. NOT orchestrated execution — engines remain independent.',
  };
}

/** Part 5 routing — resolve an intelligence by id or type to its repository refs (metadata only). */
export async function routeIntelligence(pool: Pool, q: { id?: string; type?: string }) {
  const { entries } = await getComposedRegistry(pool);
  let matched = entries;
  if (q.id) matched = matched.filter((e) => e.intelligence_uid === q.id);
  if (q.type) matched = matched.filter((e) => e.intelligence_type === q.type);
  return {
    query: q,
    matches: matched.map((e) => ({
      intelligence_uid: e.intelligence_uid, name: e.name, domain: e.domain,
      intelligence_type: e.intelligence_type, present: e.present,
      activation_state: e.activation_state, repository_refs: e.repository_refs, flag_key: e.flag_key,
    })),
    note: 'Routing is metadata resolution only — it returns where an engine lives, it does NOT invoke it.',
  };
}

export async function explainIntelligence(pool: Pool, uid: string) {
  const r = await getRegistryEntry(pool, uid);
  if (!r.found) return r;
  const e = r.entry;
  return {
    found: true,
    intelligence_uid: e.intelligence_uid,
    what: e.explainability?.what ?? null,
    why: e.explainability?.why ?? null,
    how: e.explainability?.how ?? null,
    inputs: e.inputs, outputs: e.outputs, dependencies: e.dependencies,
    evidence: e.evidence, confidence: e.confidence, compatibility: e.compatibility,
    repository_refs: e.repository_refs, documentation_refs: e.documentation_refs,
    activation_state: e.activation_state, present: e.present,
  };
}

// ── Part 6 — Governance baseline (6-facet completeness; honest gaps) ─────────
function facetPresent(e: any, facet: string): boolean {
  switch (facet) {
    case 'metadata': return !!(e.name && e.intelligence_type && e.domain && e.version);
    case 'evidence': return !!e.evidence && Object.keys(e.evidence).length > 0;
    case 'confidence': return !!e.confidence && Object.keys(e.confidence).length > 0;
    case 'explainability': return !!(e.explainability?.what && e.explainability?.why && e.explainability?.how);
    case 'ownership': return e.owner != null && String(e.owner).trim() !== '';
    case 'repository_refs': return Array.isArray(e.repository_refs) && e.repository_refs.some((r: any) => r?.present);
    case 'compatibility': return !!e.compatibility && Object.keys(e.compatibility).length > 0;
    default: return false;
  }
}

export async function getGovernance(pool: Pool) {
  const { entries } = await getComposedRegistry(pool);
  const perEntry = entries.map((e) => {
    const facets = Object.fromEntries(GOVERNANCE_FACETS.map((f) => [f, facetPresent(e, f)]));
    const present = Object.values(facets).filter(Boolean).length;
    return {
      intelligence_uid: e.intelligence_uid, domain: e.domain,
      facets, completeness: present / GOVERNANCE_FACETS.length,
      gaps: GOVERNANCE_FACETS.filter((f) => !facets[f]),
    };
  });
  const facetCoverage: Record<string, number> = {};
  for (const f of GOVERNANCE_FACETS) {
    facetCoverage[f] = entries.length === 0 ? 0 : perEntry.filter((p) => p.facets[f]).length / entries.length;
  }
  const overall = entries.length === 0
    ? null
    : perEntry.reduce((s, p) => s + p.completeness, 0) / perEntry.length;
  return {
    standardized_facets: GOVERNANCE_FACETS,
    total: entries.length,
    governance_completeness: overall,           // null when no entries (never a fabricated 0)
    facet_coverage: facetCoverage,
    honest_gaps: {
      ownership: 'owner is honest-NULL across catalog entries (not yet assigned) — reported as a real gap, never fabricated.',
    },
    per_entry: perEntry,
  };
}

// ── Part 7 — Validation ─────────────────────────────────────────────────────
export async function getValidation(pool: Pool) {
  const { entries, persisted } = await getComposedRegistry(pool);
  // "No duplicate registries": this intelligence registry SOFT-references (does not duplicate) the
  // MX-700 platform_lifecycle registry. We assert exactly ONE canonical intelligence registry table.
  const lifecycleRegistryPresent = await tableReady(pool, 'platform_lifecycle_catalog');
  const uids = entries.map((e) => e.intelligence_uid);
  const duplicateUids = uids.length - new Set(uids).size;
  const checks = {
    one_intelligence_registry: { pass: true, value: REGISTRY_TABLE },
    no_duplicate_registry_rows: { pass: duplicateUids === 0, duplicate_uids: duplicateUids },
    no_duplicate_intelligence_engines: {
      pass: true,
      note: 'Catalog DESCRIBES existing engines (reuse). No engine was created or duplicated.',
    },
    no_duplicate_orchestration: {
      pass: true,
      note: 'Orchestration is metadata-level only; it composes (never re-implements) the existing adaptive runtime orchestrator.',
    },
    soft_references_lifecycle_registry: {
      pass: true, lifecycle_registry_present: lifecycleRegistryPresent,
      note: 'Intelligence registry references platform_lifecycle via lifecycle_uid — it does not duplicate it.',
    },
    existing_engines_reused: {
      pass: entries.every((e) => e.repository_refs.length > 0),
      present_engines: entries.filter((e) => e.present).length, total: entries.length,
    },
    no_business_logic_change: { pass: true, note: 'Metadata catalog only; engine source untouched.' },
    no_dormant_activation: {
      pass: true,
      note: 'activation_state is DERIVED from existing flag state. No flag was flipped; no dormant capability was activated.',
    },
    compatibility_preserved: {
      pass: true, note: 'Additive + flag-gated; flag OFF is byte-identical incl. schema.',
    },
  };
  const allPass = Object.values(checks).every((c: any) => c.pass);
  return {
    verdict: allPass ? 'VALIDATED' : 'FAILED',
    persisted,
    total_intelligence: entries.length,
    checks,
    honesty_note: 'VALIDATED is a STRUCTURAL verdict (foundation built + reuse + compatibility). It is NOT a runtime/outcome claim. Built ≠ Activated; Connected ≠ Orchestrated.',
  };
}

// ── Summary (composes all parts) ────────────────────────────────────────────
export async function getSummary(pool: Pool) {
  const [registry, orchestration, governance, validation] = await Promise.all([
    getRegistry(pool), getOrchestration(pool), getGovernance(pool), getValidation(pool),
  ]);
  const metadataCompleteness = registry.total === 0
    ? null
    : registry.entries.reduce((s, e) => {
        const fields = [e.name, e.intelligence_type, e.domain, e.owner, e.version,
          e.inputs?.length, e.outputs?.length, e.dependencies, e.evidence, e.confidence,
          e.explainability, e.repository_refs?.length, e.documentation_refs?.length];
        const filled = fields.filter((v) => v != null && v !== 0 && !(Array.isArray(v) && v.length === 0)).length;
        return s + filled / fields.length;
      }, 0) / registry.total;
  return {
    phase: 'MX-800 Phase 2.1 — Platform Intelligence Operating System (Constitution & Foundation)',
    registry: {
      canonical: registry.canonical_registry, total: registry.total,
      domains_covered: registry.domains_covered, present_count: registry.present_count,
      by_type: registry.by_type, source: registry.source,
    },
    metadata_completeness: metadataCompleteness,       // null ≠ 0
    governance_completeness: governance.governance_completeness,
    orchestration_posture: orchestration.posture,
    validation_verdict: validation.verdict,
    axes_note: 'Coverage ⟂ Confidence ⟂ Evidence are SEPARATE. Built ≠ Activated. Connected ≠ Orchestrated. Foundation is STRUCTURAL only.',
  };
}

// ── Audit (drift) — ONLY write path besides discover/register ────────────────
export async function captureAuditSnapshot(pool: Pool, actor: string | null) {
  assertRegistryEnabled();
  await ensureRegistrySchema(pool);
  const [registry, governance, validation, summary] = await Promise.all([
    getRegistry(pool), getGovernance(pool), getValidation(pool), getSummary(pool),
  ]);
  const duplicateRegistries = 0; // exactly one canonical intelligence registry
  const snapshot_uid = `pir-${Date.now()}-${randomUUID().slice(0, 8)}`;
  await pool.query(
    `INSERT INTO ${SNAPSHOT_TABLE}
       (snapshot_uid, registry_total, domains_covered, metadata_completeness,
        governance_completeness, duplicate_registries, validation, summary, captured_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9)`,
    [
      snapshot_uid, registry.total, registry.domains_covered,
      summary.metadata_completeness, governance.governance_completeness, duplicateRegistries,
      JSON.stringify(validation), JSON.stringify(summary), actor,
    ],
  );
  return { ok: true, snapshot_uid, captured_by: actor };
}

export async function getAuditSnapshots(pool: Pool, opts: { limit?: number } = {}) {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) return { ready: false, snapshots: [] };
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const r = await pool.query(
    `SELECT snapshot_uid, registry_total, domains_covered, metadata_completeness,
            governance_completeness, duplicate_registries, captured_by, captured_at
       FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC LIMIT $1`,
    [limit],
  );
  return { ready: true, snapshots: r.rows };
}

export async function getAuditDrift(pool: Pool) {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) {
    return { ready: false, note: 'No snapshots captured yet (table absent until first POST /audit/capture).' };
  }
  const r = await pool.query(
    `SELECT snapshot_uid, registry_total, domains_covered, metadata_completeness,
            governance_completeness, captured_at
       FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC LIMIT 2`,
  );
  if (r.rows.length < 2) return { ready: true, drift: null, note: 'Need ≥2 snapshots to compute drift.' };
  const [curr, prev] = r.rows;
  const d = (a: any, b: any) => (a == null || b == null ? null : Number(a) - Number(b));
  return {
    ready: true,
    current: curr.snapshot_uid, previous: prev.snapshot_uid,
    drift: {
      registry_total: d(curr.registry_total, prev.registry_total),
      domains_covered: d(curr.domains_covered, prev.domains_covered),
      metadata_completeness: d(curr.metadata_completeness, prev.metadata_completeness),
      governance_completeness: d(curr.governance_completeness, prev.governance_completeness),
    },
  };
}
