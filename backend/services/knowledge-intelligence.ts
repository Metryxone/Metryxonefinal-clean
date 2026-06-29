/**
 * MX-800 Phase 2.5 — Knowledge Intelligence Engine (service layer).
 *
 * ENHANCEMENT-ONLY. Knowledge Intelligence continuously understands, measures, validates, explains
 * and surfaces the platform's KNOWLEDGE by COMPOSING/CONNECTING the EXISTING ontology + knowledge
 * assets into ONE Enterprise Knowledge Graph that is COMPUTED ON READ. It introduces NO parallel
 * knowledge graph, NO duplicate ontology, NO duplicate registry, and changes NO business logic. The
 * existing tables are the single source of truth; every node/edge/relationship count is MEASURED
 * live with exact COUNT(*) (NEVER pg_stat n_live_tup — that reads 0 for bulk-seeded tables until
 * autovacuum analyzes them). Nothing is fabricated or estimated.
 *
 * Composed substrate (READ-ONLY — reuse, never duplicate, never write):
 *   - Ontology taxonomy:        ont_*  (sectors→industries→functions→roles→layers→clusters→competencies→micros)
 *   - Competency genome:        onto_* (competencies / roles / role-competency & dna profiles / types)
 *   - Ontology edges:           map_*  (role↔competency, cluster↔competency, layer↔cluster, industry↔function …)
 *   - Cross-ontology bridge:    map_ont_onto_role / map_ont_onto_competency  (ont_ ↔ onto_)
 *   - Semantic relationships:   onto_relationships / onto_aliases / onto_competency_hierarchy
 *                               sci_competency_relationships / _dependency_paths / _influence_weights /
 *                               _capability_evolution_paths
 *   - Knowledge graphs:         kg_edges (LIVE employability graph — COUNT ONLY, never written),
 *                               pil_kg_nodes / pil_kg_edges, tig_nodes / tig_edges
 *   - Career graph:             cg_roles / cg_role_edges / cg_skill_requirements
 *   - Versioning:               onto_competency_versions / ver_change_history / ver_entity_snapshots
 *   - Prior intelligence tiers: platform_intelligence_registry (2.1) / engineering_knowledge_registry (2.3) /
 *                               runtime_component_registry (2.4) / platform_lifecycle_catalog (MX-700),
 *                               and their read-only getSummary getters for the Context view.
 *
 * HONESTY CONTRACT (user preference — honesty over optimism, never fabricate):
 *   - Data ≠ Information ≠ Knowledge ≠ Understanding ≠ Reasoning ≠ Decision. Ontology ≠ Knowledge Graph.
 *     Relationship ≠ Dependency. Coverage ⟂ Confidence ⟂ Evidence (SEPARATE axes, never blended).
 *     Built ≠ Activated. Present ≠ Populated. Computed-on-read ≠ Materialized.
 *   - Population is MEASURED with exact COUNT(*). An ABSENT table → present:false, count NULL (not 0).
 *     A PRESENT but unreadable table → count NULL (query error ≠ empty). Empty table → 0.
 *   - The Enterprise Knowledge Graph is a READ-ONLY PROJECTION over the existing tables. It is NEVER
 *     materialized into a new graph table (that would duplicate the live kg_edges / pil_kg_* / tig_* graphs).
 *   - Metrics are 6 SEPARATE measured scores — NEVER composited into one "overall".
 *     knowledge_confidence is STRUCTURAL only (verifiability/integrity), NOT runtime/outcome confidence.
 *   - Contextual-meaning / NLP / embedding semantics are NOT present in this environment → honest NULL
 *     (DEFERRED), never an estimate. A ratio with a 0/null denominator → null (null ≠ zero).
 *   - owner is MANAGED (human) and honest-NULL when unassigned; re-discovery NEVER overwrites it.
 *     present is DERIVED (to_regclass existence) — it is NOT a quality/health verdict.
 *   - STOP clause: NO Decision / Predictive / Recommendation / AI-orchestration. Reasoning is the
 *     evidence-grounded WHY a relationship exists — never a prediction or a recommendation.
 *
 * Reads are GET-never-writes: they probe via to_regclass and compose measured sources; they NEVER
 * create schema. The lazy ensure-schema runs ONLY on flag-ON write paths (discover / register /
 * audit-capture) so flag OFF → byte-identical incl. schema (0 tables). Every write path also asserts
 * the flag itself BEFORE ensure-schema (defense-in-depth for direct/tooling callers).
 */
import type { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { isKnowledgeIntelligenceEngineEnabled } from '../config/feature-flags';

// Composed prior-tier summaries (EXISTING intelligence engines — reuse, never duplicate).
// These getters are GET-never-writes (to_regclass-probed reads, no ensure-schema).
import { getSummary as getPlatformSummary } from './platform-intelligence-registry';
import { getEngineeringSummary } from './engineering-intelligence';
import { getRuntimeSummary } from './runtime-intelligence';

const REGISTRY_TABLE = 'knowledge_source_registry';
const SNAPSHOT_TABLE = 'knowledge_intelligence_audit_snapshots';

// ── Defense-in-depth flag guard for WRITE/DDL paths ─────────────────────────
class KnowledgeIntelligenceDisabled extends Error {
  code = 'knowledge_intelligence_disabled';
  constructor() {
    super('knowledgeIntelligenceEngine flag is OFF — write/DDL paths are inert (byte-identical legacy).');
    this.name = 'KnowledgeIntelligenceDisabled';
  }
}
function assertEnabled(): void {
  if (!isKnowledgeIntelligenceEngineEnabled()) throw new KnowledgeIntelligenceDisabled();
}

// ── helpers ─────────────────────────────────────────────────────────────────
async function tableReady(pool: Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS ready`, [`public.${table}`]);
    return !!r.rows[0]?.ready;
  } catch { return false; }
}
/** Measured scalar. Returns the value, 0 for a genuinely empty result, or NULL on a query ERROR
 *  (unmeasurable ≠ zero — honesty contract null ≠ 0). */
async function scalar(pool: Pool, sql: string, params: unknown[] = []): Promise<number | null> {
  try { const r = await pool.query(sql, params); return Number(r.rows[0]?.n ?? 0); } catch { return null; }
}
/** Multi-row read. Returns the rows, [] for a genuinely empty result, or NULL on a query ERROR. */
async function rows(pool: Pool, sql: string, params: unknown[] = []): Promise<any[] | null> {
  try { const r = await pool.query(sql, params); return r.rows; } catch { return null; }
}
/** A safe, unquoted Postgres table identifier (≤63 chars, no quotes/semicolons/whitespace). Used to
 *  REJECT user-supplied identifiers BEFORE any interpolation — the curated catalog is always safe, but
 *  manual /register passes user input through countTable's `FROM "${table}"`. A to_regclass probe does
 *  NOT sanitise identifier injection, so this regex gate is the actual injection defence. */
function isSafeTableIdentifier(s: string): boolean {
  return typeof s === 'string' && s.length > 0 && s.length <= 63 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);
}
/** Exact MEASURED row count for a SAFE table identifier. Callers MUST pass either a curated-catalog
 *  table or an isSafeTableIdentifier()-validated name. A non-conforming identifier → null (never
 *  interpolated). ABSENT table → null (present:false, count unmeasured — null ≠ 0). PRESENT table →
 *  exact COUNT(*) (NEVER n_live_tup), or null on error. */
async function countTable(pool: Pool, table: string): Promise<number | null> {
  if (!isSafeTableIdentifier(table)) return null;            // defence-in-depth: never interpolate an unsafe identifier
  if (!(await tableReady(pool, table))) return null;
  return scalar(pool, `SELECT COUNT(*)::int AS n FROM "${table}"`);
}
async function columnExists(pool: Pool, table: string, col: string): Promise<boolean> {
  try {
    const r = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2 LIMIT 1`,
      [table, col],
    );
    return r.rows.length > 0;
  } catch { return false; }
}
/** Honest grouped distribution — only when BOTH the table and the column actually exist; else null. */
async function groupCount(pool: Pool, table: string, col: string, limit = 20): Promise<any[] | null> {
  if (!(await tableReady(pool, table)) || !(await columnExists(pool, table, col))) return null;
  return rows(pool, `SELECT "${col}"::text AS key, COUNT(*)::int AS n FROM "${table}" GROUP BY "${col}" ORDER BY n DESC LIMIT ${limit}`);
}
/** Ratio as a 0–100 percentage; NULL when the numerator is unmeasured OR the denominator is 0/null. */
function pct(n: number | null, d: number | null): number | null {
  if (n == null || d == null || !d) return null;
  return Math.round((n / d) * 10000) / 100;
}
function uid(prefix: string): string { return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`; }
const sum = (xs: (number | null)[]): number | null => {
  const m = xs.filter((x): x is number => x != null);
  return m.length ? m.reduce((a, b) => a + b, 0) : null;
};

/**
 * Short-TTL promise memo. /summary, /metrics, /validation, /context and captureSnapshot all compose
 * the SAME expensive measurement (per-source COUNT(*) over ~50 tables + three prior-tier summaries).
 * Memoization dedupes that within a request and reuses for a few seconds (MX-700 1.43 "gather ONCE").
 */
const MEMO_TTL_MS = 8000;
const _memo = new Map<string, { at: number; val: Promise<any> }>();
function memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = _memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.val as Promise<T>;
  const val = fn().catch((e) => { _memo.delete(key); throw e; });
  _memo.set(key, { at: Date.now(), val });
  return val;
}

// ── Curated, file/table-verified KNOWLEDGE SOURCE catalog ────────────────────
// Every `table` below was verified to EXIST in this database. graph_role projects each source onto
// the computed-on-read Enterprise Knowledge Graph: node (entities), edge (relationships), meta
// (registries / version stores — context, not graph topology). kind classifies the substrate family.
type KnowledgeSource = {
  uid: string; name: string; domain: string; table: string;
  kind: 'entity' | 'relation' | 'graph' | 'registry' | 'version';
  graph_role: 'node' | 'edge' | 'meta';
  description: string;
};
const KNOWLEDGE_SOURCES: KnowledgeSource[] = [
  // ── Ontology taxonomy (ont_) — nodes ──
  ['ont_sectors', 'Sectors', 'taxonomy', 'entity', 'node', 'Top-level industrial sectors'],
  ['ont_industries', 'Industries', 'taxonomy', 'entity', 'node', 'Core industries'],
  ['ont_industry_segments', 'Industry segments', 'taxonomy', 'entity', 'node', 'Sub-sectors within industries'],
  ['ont_functions', 'Functions', 'taxonomy', 'entity', 'node', 'Cross-industry functional domains'],
  ['ont_departments', 'Departments', 'taxonomy', 'entity', 'node', 'Department subdivisions'],
  ['ont_role_families', 'Role families', 'taxonomy', 'entity', 'node', 'Groups of related roles'],
  ['ont_roles', 'Roles (internal)', 'taxonomy', 'entity', 'node', 'Internal ontology job roles'],
  ['ont_layers', 'Proficiency layers', 'taxonomy', 'entity', 'node', 'Core/Functional/Leadership layers'],
  ['ont_competency_clusters', 'Competency clusters', 'taxonomy', 'entity', 'node', 'Groups of competencies'],
  ['ont_competencies', 'Competencies (taxonomy)', 'taxonomy', 'entity', 'node', 'Measurable competencies'],
  ['ont_micro_competencies', 'Micro-competencies', 'taxonomy', 'entity', 'node', 'Granular behaviours/skills'],
  ['ont_indicators', 'Indicators (taxonomy)', 'taxonomy', 'entity', 'node', 'Measurement indicators'],
  ['ont_concerns', 'Concerns (taxonomy)', 'taxonomy', 'entity', 'node', 'Behavioural concern catalog'],
  // ── Competency genome (onto_) — nodes ──
  ['onto_competencies', 'Competency genome', 'competency_genome', 'entity', 'node', 'Canonical competency master genome'],
  ['onto_roles', 'Roles (genome)', 'competency_genome', 'entity', 'node', 'External reference role ontology'],
  ['onto_role_competency_profiles', 'Role-competency profiles', 'competency_genome', 'entity', 'node', 'Role DNA competency profiles'],
  ['onto_dna_profiles', 'Role DNA profiles', 'competency_genome', 'entity', 'node', 'Role DNA weight profiles'],
  ['onto_competency_types', 'Competency types', 'competency_genome', 'entity', 'node', 'Competency type taxonomy'],
  // ── Ontology edges (map_) — edges ──
  ['map_role_competency', 'Role ↔ competency', 'ontology_edges', 'relation', 'edge', 'Core/target competency requirements per role'],
  ['map_cluster_competency', 'Cluster ↔ competency', 'ontology_edges', 'relation', 'edge', 'Competencies grouped into clusters'],
  ['map_layer_cluster', 'Layer ↔ cluster', 'ontology_edges', 'relation', 'edge', 'Clusters grouped into layers (weighted)'],
  ['map_role_layer', 'Role ↔ layer', 'ontology_edges', 'relation', 'edge', 'Proficiency layers per role'],
  ['map_industry_function', 'Industry ↔ function', 'ontology_edges', 'relation', 'edge', 'Industries connected to functions'],
  ['map_competency_proficiency', 'Competency ↔ proficiency', 'ontology_edges', 'relation', 'edge', 'Behavioural anchors per proficiency level'],
  ['map_industry_competency', 'Industry ↔ competency', 'ontology_edges', 'relation', 'edge', 'Industry-weighted competencies'],
  // ── Cross-ontology bridge (ont_ ↔ onto_) — edges ──
  ['map_ont_onto_role', 'Bridge: role (ont↔onto)', 'cross_ontology', 'relation', 'edge', 'Internal roles ↔ external genome roles'],
  ['map_ont_onto_competency', 'Bridge: competency (ont↔onto)', 'cross_ontology', 'relation', 'edge', 'Internal competencies ↔ external genome competencies'],
  // ── Semantic relationships — edges ──
  ['onto_relationships', 'Genome relationships', 'semantic', 'relation', 'edge', 'Typed relationships between genome entities'],
  ['onto_aliases', 'Genome aliases', 'semantic', 'relation', 'edge', 'Lexical/semantic aliases for entities'],
  ['onto_competency_hierarchy', 'Competency hierarchy', 'semantic', 'relation', 'edge', 'Parent/child competency hierarchy'],
  ['sci_competency_relationships', 'Competency relationships (sci)', 'semantic', 'relation', 'edge', 'Prerequisite/dependency competency graph'],
  ['sci_competency_dependency_paths', 'Competency dependency paths', 'semantic', 'relation', 'edge', 'Derived competency dependency paths'],
  ['sci_competency_influence_weights', 'Competency influence weights', 'semantic', 'relation', 'edge', 'Statistical inter-competency influence'],
  ['sci_capability_evolution_paths', 'Capability evolution paths', 'semantic', 'relation', 'edge', 'Guided role-to-role development roadmaps'],
  // ── Knowledge graphs — nodes & edges ──
  ['kg_edges', 'Employability KG edges', 'knowledge_graph', 'graph', 'edge', 'LIVE employability knowledge graph edges (read-only)'],
  ['pil_kg_nodes', 'PIL KG nodes', 'knowledge_graph', 'graph', 'node', 'Problem-Intelligence knowledge-graph nodes'],
  ['pil_kg_edges', 'PIL KG edges', 'knowledge_graph', 'graph', 'edge', 'Problem-Intelligence knowledge-graph edges'],
  ['tig_nodes', 'Talent intelligence nodes', 'knowledge_graph', 'graph', 'node', 'Talent intelligence graph nodes'],
  ['tig_edges', 'Talent intelligence edges', 'knowledge_graph', 'graph', 'edge', 'Talent intelligence graph edges'],
  // ── Career graph — nodes & edges ──
  ['cg_roles', 'Career graph roles', 'career_graph', 'graph', 'node', 'Career graph role nodes'],
  ['cg_role_edges', 'Career graph role edges', 'career_graph', 'graph', 'edge', 'Career graph role transitions'],
  ['cg_skill_requirements', 'Career graph skill reqs', 'career_graph', 'graph', 'edge', 'Role → skill requirement edges'],
  // ── Versioning / evolution — meta ──
  ['onto_competency_versions', 'Competency versions', 'versioning', 'version', 'meta', 'Append-only competency version history'],
  ['ver_change_history', 'Change history', 'versioning', 'version', 'meta', 'Ontology change history'],
  ['ver_entity_snapshots', 'Entity snapshots', 'versioning', 'version', 'meta', 'Ontology entity snapshots'],
  // ── Prior intelligence-tier registries (compose, never duplicate) — meta ──
  ['platform_intelligence_registry', 'Platform Intelligence Registry (2.1)', 'intelligence_registry', 'registry', 'meta', 'MX-800 2.1 canonical intelligence registry'],
  ['engineering_knowledge_registry', 'Engineering Knowledge Registry (2.3)', 'intelligence_registry', 'registry', 'meta', 'MX-800 2.3 engineering artifact registry'],
  ['runtime_component_registry', 'Runtime Component Registry (2.4)', 'intelligence_registry', 'registry', 'meta', 'MX-800 2.4 runtime component registry'],
  ['platform_lifecycle_catalog', 'Platform Lifecycle Catalog (MX-700)', 'intelligence_registry', 'registry', 'meta', 'MX-700 lifecycle capability catalog'],
].map(([table, name, domain, kind, graph_role, description]) => ({
  uid: `ki-src-${table}`, table, name, domain, kind, graph_role, description,
} as KnowledgeSource));

/** Measure every catalog source ONCE (exact COUNT(*) + present probe). Memoized per request window. */
type MeasuredSource = KnowledgeSource & { present: boolean; count: number | null };
function measureSources(pool: Pool): Promise<MeasuredSource[]> {
  return memo('ki:sources', async () => {
    return Promise.all(KNOWLEDGE_SOURCES.map(async (s) => {
      const present = await tableReady(pool, s.table);
      const count = present ? await countTable(pool, s.table) : null; // absent → null (≠ 0)
      return { ...s, present, count };
    }));
  });
}

let _schemaReady = false;
/** Lazy ensure-schema — canonical mirror of 20261224_knowledge_intelligence.sql.
 *  ONLY called from flag-ON write paths (discover/register/audit-capture) → flag OFF byte-identical. */
export async function ensureKnowledgeSchema(pool: Pool): Promise<void> {
  if (_schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${REGISTRY_TABLE} (
      id              BIGSERIAL PRIMARY KEY,
      knowledge_uid   TEXT UNIQUE NOT NULL,
      name            TEXT NOT NULL,
      source_type     TEXT NOT NULL,            -- entity|relation|graph|registry|version
      domain          TEXT,                     -- taxonomy|competency_genome|ontology_edges|cross_ontology|semantic|knowledge_graph|career_graph|versioning|intelligence_registry
      graph_role      TEXT,                     -- node|edge|meta (projection onto the computed graph)
      physical_table  TEXT NOT NULL,            -- the EXISTING source table (read-only)
      present         BOOLEAN,                  -- DERIVED: to_regclass existence — NOT a quality verdict
      measured_count  INTEGER,                  -- exact COUNT(*) at discovery; honest-NULL when unmeasured (≠ 0)
      owner           TEXT,                     -- MANAGED, honest-NULL when unassigned (never fabricated)
      lifecycle_uid   TEXT,                     -- SOFT reference into platform_lifecycle (no FK; may be null)
      metadata        JSONB NOT NULL DEFAULT '{}',
      source          TEXT NOT NULL DEFAULT 'discovered',  -- discovered|manual
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_ksr_source_type ON ${REGISTRY_TABLE} (source_type);
    CREATE INDEX IF NOT EXISTS idx_ksr_domain      ON ${REGISTRY_TABLE} (domain);
    CREATE TABLE IF NOT EXISTS ${SNAPSHOT_TABLE} (
      id                          BIGSERIAL PRIMARY KEY,
      snapshot_uid                TEXT UNIQUE NOT NULL,
      registry_total              INTEGER,
      sources_present             INTEGER,
      graph_nodes                 INTEGER,
      graph_edges                 INTEGER,
      knowledge_completeness_pct  NUMERIC,
      relationship_coverage_pct   NUMERIC,
      ontology_health_pct         NUMERIC,
      semantic_consistency_pct    NUMERIC,
      knowledge_confidence_pct    NUMERIC,
      context_quality_pct         NUMERIC,
      metrics                     JSONB NOT NULL DEFAULT '{}',
      validation                  JSONB NOT NULL DEFAULT '{}',
      summary                     JSONB NOT NULL DEFAULT '{}',
      captured_by                 TEXT,
      captured_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_kias_captured_at ON ${SNAPSHOT_TABLE} (captured_at DESC);
  `);
  _schemaReady = true;
}

const AXES_NOTE =
  'Data ≠ Information ≠ Knowledge ≠ Understanding ≠ Reasoning ≠ Decision. Ontology ≠ Knowledge Graph. ' +
  'Relationship ≠ Dependency. Coverage ⟂ Confidence ⟂ Evidence (SEPARATE axes). Present ≠ Populated. ' +
  'Computed-on-read ≠ Materialized. Built ≠ Activated. Metrics are NEVER composited.';

// ════════════════════════════════════════════════════════════════════════════
// Part 1 — Enterprise Knowledge Graph (COMPUTED ON READ, never materialized)
// ════════════════════════════════════════════════════════════════════════════
export async function getKnowledgeGraph(pool: Pool) {
  return memo('ki:graph', async () => {
    const measured = await measureSources(pool);
    const domains: Record<string, { domain: string; sources: number; present: number; nodes: number | null; edges: number | null; meta: number | null }> = {};
    for (const s of measured) {
      const d = (domains[s.domain] ??= { domain: s.domain, sources: 0, present: 0, nodes: null, edges: null, meta: null });
      d.sources++;
      if (s.present) d.present++;
      const bucket = s.graph_role === 'node' ? 'nodes' : s.graph_role === 'edge' ? 'edges' : 'meta';
      if (s.count != null) d[bucket] = (d[bucket] ?? 0) + s.count;
    }
    const total_nodes = sum(measured.filter((s) => s.graph_role === 'node').map((s) => s.count));
    const total_edges = sum(measured.filter((s) => s.graph_role === 'edge').map((s) => s.count));
    const total_meta = sum(measured.filter((s) => s.graph_role === 'meta').map((s) => s.count));
    return {
      phase: 'MX-800 Phase 2.5 — Enterprise Knowledge Graph',
      computed_on_read: true,
      materialized: false,
      materialization_note:
        'This graph is a READ-ONLY PROJECTION over the EXISTING ontology / knowledge tables. It is ' +
        'never persisted into a new graph table — the live kg_edges / pil_kg_* / tig_* graphs remain the ' +
        'sole materialized graphs and are read COUNT-ONLY, never written.',
      totals: {
        source_tables: measured.length,
        present_tables: measured.filter((s) => s.present).length,
        nodes: total_nodes,                 // null ≠ 0
        edges: total_edges,
        meta_records: total_meta,
      },
      by_domain: Object.values(domains).sort((a, b) => a.domain.localeCompare(b.domain)),
      sources: measured.map((s) => ({
        uid: s.uid, name: s.name, domain: s.domain, table: s.table,
        graph_role: s.graph_role, kind: s.kind, present: s.present, count: s.count,
      })),
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 2 — Semantic Intelligence (relationships / aliases / hierarchy)
// ════════════════════════════════════════════════════════════════════════════
export async function getSemanticIntelligence(pool: Pool) {
  return memo('ki:semantic', async () => {
    const measured = await measureSources(pool);
    const sem = measured.filter((s) => s.domain === 'semantic');
    const [relTypeDist, relKindDist, aliasTypeDist] = await Promise.all([
      groupCount(pool, 'onto_relationships', 'relationship_type'),
      groupCount(pool, 'sci_competency_relationships', 'relationship_type'),
      groupCount(pool, 'onto_aliases', 'alias_type'),
    ]);
    return {
      phase: 'MX-800 Phase 2.5 — Semantic Intelligence',
      relationship_stores: sem.map((s) => ({ uid: s.uid, name: s.name, table: s.table, present: s.present, count: s.count })),
      total_semantic_relationships: sum(sem.map((s) => s.count)), // null ≠ 0
      distributions: {
        onto_relationship_type: relTypeDist,          // null when column/table absent (honest, not 0)
        sci_relationship_type: relKindDist,
        onto_alias_type: aliasTypeDist,
      },
      contextual_meaning: {
        measurable: false,
        value: null,
        note:
          'Contextual-meaning / NLP / embedding-based semantic similarity is NOT present in this ' +
          'environment (no embedding store / model). Semantic structure is reported from the EXISTING ' +
          'typed-relationship tables only; deeper meaning is honest-NULL (DEFERRED), never estimated.',
      },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 3 — Ontology Intelligence (cross-ontology mapping / structural validation / evolution)
// ════════════════════════════════════════════════════════════════════════════
export async function getOntologyIntelligence(pool: Pool) {
  return memo('ki:ontology', async () => {
    const measured = await measureSources(pool);
    const find = (table: string) => measured.find((s) => s.table === table) ?? null;
    const ontRoles = find('ont_roles')?.count ?? null;
    const ontoRoles = find('onto_roles')?.count ?? null;
    const ontComps = find('ont_competencies')?.count ?? null;
    const ontoComps = find('onto_competencies')?.count ?? null;
    const bridgeRole = find('map_ont_onto_role')?.count ?? null;
    const bridgeComp = find('map_ont_onto_competency')?.count ?? null;
    const taxonomy = measured.filter((s) => s.domain === 'taxonomy');
    const genome = measured.filter((s) => s.domain === 'competency_genome');
    const versioning = measured.filter((s) => s.domain === 'versioning');
    return {
      phase: 'MX-800 Phase 2.5 — Ontology Intelligence',
      reuse_note: 'Reads and CROSS-MAPS the two existing ontologies (internal ont_ taxonomy ⇄ external onto_ genome). It NEVER replaces, rebuilds or mutates either ontology.',
      cross_ontology_mapping: {
        internal_roles: ontRoles, external_roles: ontoRoles, role_bridge_edges: bridgeRole,
        role_bridge_coverage_pct: pct(bridgeRole, ontRoles),       // null when denom 0/null
        internal_competencies: ontComps, external_competencies: ontoComps, competency_bridge_edges: bridgeComp,
        competency_bridge_coverage_pct: pct(bridgeComp, ontComps),
      },
      structural_validation: {
        taxonomy_tables: { total: taxonomy.length, present: taxonomy.filter((s) => s.present).length },
        genome_tables: { total: genome.length, present: genome.filter((s) => s.present).length },
        bridge_present: (find('map_ont_onto_role')?.present ?? false) && (find('map_ont_onto_competency')?.present ?? false),
        referential_orphan_scan: {
          measurable: false, value: null,
          note: 'A deep referential orphan scan (edges pointing at missing nodes) requires per-table foreign-key column introspection across heterogeneous schemas → honest-NULL (DEFERRED), never fabricated. Presence + populated counts are reported instead.',
        },
        verdict: 'STRUCTURAL',
      },
      evolution: {
        version_stores: versioning.map((s) => ({ uid: s.uid, name: s.name, table: s.table, present: s.present, count: s.count })),
        total_version_records: sum(versioning.map((s) => s.count)),
      },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 4 — Knowledge Reasoning (evidence-grounded WHY a relationship exists; NOT prediction)
// ════════════════════════════════════════════════════════════════════════════
export async function getKnowledgeReasoning(pool: Pool) {
  return memo('ki:reasoning', async () => {
    const measured = await measureSources(pool);
    const c = (table: string) => measured.find((s) => s.table === table)?.count ?? null;
    const facet = (claim: string, table: string, basis: string) => {
      const edges = c(table);
      return {
        claim, evidence: { table, measured_edges: edges },     // null ≠ 0
        confidence: 'structural', basis,
        grounded: edges != null,                               // grounded only when measured
      };
    };
    return {
      phase: 'MX-800 Phase 2.5 — Knowledge Reasoning',
      reasoning_kind: 'evidence-grounded WHY (structural). NOT prediction, recommendation or decision (STOP clause).',
      facets: [
        facet('Competencies are required by roles', 'map_role_competency', 'A measured role↔competency edge set is the evidence that roles demand competencies.'),
        facet('Competencies are organised into clusters', 'map_cluster_competency', 'Cluster membership edges evidence the competency grouping structure.'),
        facet('Competencies form a parent/child hierarchy', 'onto_competency_hierarchy', 'Hierarchy edges evidence competency containment / specialisation.'),
        facet('The internal taxonomy bridges to the external genome', 'map_ont_onto_competency', 'Cross-ontology bridge edges evidence the two ontologies are reconciled, not parallel.'),
        facet('Competencies have typed semantic relationships', 'sci_competency_relationships', 'Prerequisite/dependency edges evidence ordered competency development.'),
        facet('Competencies influence one another statistically', 'sci_competency_influence_weights', 'Influence-weight edges evidence measured inter-competency lift.'),
      ],
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 5 — Context Intelligence (compose prior intelligence tiers + ontology context)
// ════════════════════════════════════════════════════════════════════════════
export async function getKnowledgeContext(pool: Pool) {
  return memo('ki:context', async () => {
    // Each prior-tier summary is GET-never-writes; wrap so an unavailable tier degrades to honest-null.
    const safe = async (label: string, fn: () => Promise<any>) => {
      try { return { reachable: true, summary: await fn() }; }
      catch (e: any) { return { reachable: false, summary: null, note: `context source unavailable: ${e?.code || e?.message || 'error'}` }; }
    };
    const [platform, engineering, runtime, graph] = await Promise.all([
      safe('platform', () => getPlatformSummary(pool)),
      safe('engineering', () => getEngineeringSummary(pool)),
      safe('runtime', () => getRuntimeSummary(pool)),
      getKnowledgeGraph(pool),
    ]);
    const reachable = [platform, engineering, runtime].filter((t) => t.reachable).length;
    return {
      phase: 'MX-800 Phase 2.5 — Context Intelligence',
      compose_note: 'COMPOSES the read-only summaries of the prior intelligence tiers (2.1 platform / 2.3 engineering / 2.4 runtime) with the knowledge-graph projection. It re-issues NO ad-hoc analysis and re-runs NO engine.',
      tiers: { platform, engineering, runtime },
      knowledge_context: {
        domains: graph.by_domain.length,
        nodes: graph.totals.nodes, edges: graph.totals.edges,
      },
      tier_reachability: { reachable, of: 3 },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 6 — Knowledge Validation (STRUCTURAL integrity only)
// ════════════════════════════════════════════════════════════════════════════
export async function getKnowledgeValidation(pool: Pool) {
  return memo('ki:validation', async () => {
    const measured = await measureSources(pool);
    const present = measured.filter((s) => s.present);
    const populated = measured.filter((s) => (s.count ?? 0) > 0);
    const registryReady = await tableReady(pool, REGISTRY_TABLE);
    const fileCheck = (rel: string) => { try { return fs.existsSync(path.join(process.cwd(), rel)); } catch { return false; } };

    const checks = [
      { check: 'knowledge_sources_present', status: present.length === measured.length ? 'pass' : present.length > 0 ? 'partial' : 'absent', detail: `${present.length}/${measured.length} catalog source tables exist` },
      { check: 'relationship_integrity', status: measured.some((s) => s.graph_role === 'edge' && (s.count ?? 0) > 0) ? 'pass' : 'partial', detail: 'at least one relationship/edge store is populated' },
      { check: 'cross_ontology_integrity', status: (measured.find((s) => s.table === 'map_ont_onto_role')?.present && measured.find((s) => s.table === 'map_ont_onto_competency')?.present) ? 'pass' : 'partial', detail: 'both ont_↔onto_ bridge tables exist' },
      { check: 'semantic_integrity', status: measured.some((s) => s.domain === 'semantic' && s.present) ? 'pass' : 'absent', detail: 'semantic relationship stores exist' },
      { check: 'graph_substrate_integrity', status: measured.some((s) => s.domain === 'knowledge_graph' && s.present) ? 'pass' : 'absent', detail: 'live knowledge-graph substrate (kg/pil_kg/tig) exists' },
      { check: 'registry_metadata_integrity', status: registryReady ? 'pass' : 'absent', detail: registryReady ? 'knowledge_source_registry exists (discovered)' : 'registry not yet discovered (flag-OFF or never run) — honest absent' },
      { check: 'repository_integrity', status: (fileCheck('services/knowledge-intelligence.ts') && fileCheck('routes/knowledge-intelligence.ts') && fileCheck('migrations/20261224_knowledge_intelligence.sql')) ? 'pass' : 'partial', detail: 'service + route + migration files present' },
    ];
    const pass = checks.filter((c) => c.status === 'pass').length;
    return {
      phase: 'MX-800 Phase 2.5 — Knowledge Validation',
      validation_kind: 'STRUCTURAL only (existence + population). NOT a runtime / accuracy / outcome verdict.',
      checks,
      populated_sources: populated.length,
      verdict: pass === checks.length ? 'STRUCTURAL_VALIDATED' : pass > 0 ? 'PARTIAL' : 'ABSENT',
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 7 — Knowledge Metrics (6 SEPARATE measured scores — NEVER composited)
// ════════════════════════════════════════════════════════════════════════════
export async function getKnowledgeMetrics(pool: Pool) {
  return memo('ki:metrics', async () => {
    const measured = await measureSources(pool);
    const total = measured.length;
    const present = measured.filter((s) => s.present).length;
    const edgeSrc = measured.filter((s) => s.graph_role === 'edge');
    const edgePresent = edgeSrc.filter((s) => s.present).length;
    const sem = measured.filter((s) => s.domain === 'semantic');
    const semPopulated = sem.filter((s) => (s.count ?? 0) > 0).length;
    const measuredCount = measured.filter((s) => s.count != null).length; // count actually obtained
    const populated = measured.filter((s) => (s.count ?? 0) > 0).length;
    // ontology health: cross-ontology bridge present + populated, version store present
    const bridgeRole = measured.find((s) => s.table === 'map_ont_onto_role');
    const bridgeComp = measured.find((s) => s.table === 'map_ont_onto_competency');
    const versionStores = measured.filter((s) => s.domain === 'versioning');
    const ontChecks = [
      bridgeRole?.present ?? false, bridgeComp?.present ?? false,
      (bridgeRole?.count ?? 0) > 0, (bridgeComp?.count ?? 0) > 0,
      versionStores.some((s) => s.present),
    ];
    // context quality: prior-tier summaries reachable / 3
    const ctx = await getKnowledgeContext(pool);

    return {
      phase: 'MX-800 Phase 2.5 — Knowledge Metrics',
      composite: null,
      composite_note: 'There is deliberately NO composite / overall score — the six axes measure DIFFERENT things and blending them would hide honest gaps.',
      scores: [
        { metric: 'knowledge_completeness', axis: 'coverage', score: pct(present, total), basis: { measured: present, of: total }, note: 'Catalog source tables that EXIST. Present ≠ Populated.' },
        { metric: 'relationship_coverage', axis: 'coverage', score: pct(edgePresent, edgeSrc.length), basis: { measured: edgePresent, of: edgeSrc.length }, note: 'Relationship/edge stores that exist. Relationship ≠ Dependency.' },
        { metric: 'ontology_health', axis: 'structural', score: pct(ontChecks.filter(Boolean).length, ontChecks.length), basis: { measured: ontChecks.filter(Boolean).length, of: ontChecks.length }, note: 'Cross-ontology bridge present+populated and a version store present.' },
        { metric: 'semantic_consistency', axis: 'coverage', score: pct(semPopulated, sem.length), basis: { measured: semPopulated, of: sem.length }, note: 'Semantic relationship stores that are populated.' },
        { metric: 'knowledge_confidence', axis: 'confidence', score: pct(measuredCount, total), basis: { measured: measuredCount, of: total }, note: 'STRUCTURAL verifiability only: sources whose population could be MEASURED (COUNT obtained). NOT runtime/outcome confidence.' },
        { metric: 'context_quality', axis: 'evidence', score: pct(ctx.tier_reachability.reachable, ctx.tier_reachability.of), basis: ctx.tier_reachability, note: 'Prior intelligence-tier summaries reachable for cross-domain context.' },
      ],
      population: { present, populated, total },
      axes_note: AXES_NOTE,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Part 8 — Knowledge Explainability (/explain/:uid)
// ════════════════════════════════════════════════════════════════════════════
export async function explainKnowledgeSource(pool: Pool, uidArg: string) {
  const src = KNOWLEDGE_SOURCES.find((s) => s.uid === uidArg || s.table === uidArg);
  if (!src) return { found: false, uid: uidArg, note: 'No such knowledge source in the curated catalog.' };
  const present = await tableReady(pool, src.table);
  const count = present ? await countTable(pool, src.table) : null;
  const siblings = KNOWLEDGE_SOURCES.filter((s) => s.domain === src.domain && s.uid !== src.uid);
  return {
    found: true,
    uid: src.uid, name: src.name, domain: src.domain, table: src.table,
    why: `${src.description}. It participates in the Enterprise Knowledge Graph as a '${src.graph_role}' (${src.kind}).`,
    evidence: { physical_table: src.table, present, measured_count: count }, // null ≠ 0
    confidence: { level: 'structural', basis: present ? (count != null ? 'table exists and population was measured' : 'table exists but population unmeasured') : 'table absent', note: 'STRUCTURAL confidence only — NOT runtime / accuracy / outcome.' },
    context: { domain: src.domain, graph_role: src.graph_role, kind: src.kind },
    dependencies: siblings.filter((s) => s.kind === 'entity' || src.kind === 'relation').slice(0, 8).map((s) => ({ uid: s.uid, name: s.name, table: s.table })),
    alternatives: siblings.filter((s) => s.graph_role === src.graph_role).slice(0, 8).map((s) => ({ uid: s.uid, name: s.name, table: s.table })),
    repository_refs: ['backend/services/knowledge-intelligence.ts', 'backend/routes/knowledge-intelligence.ts', 'backend/migrations/20261224_knowledge_intelligence.sql'],
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Registry + discovery (knowledge_source_registry — catalog of knowledge SOURCES)
// ════════════════════════════════════════════════════════════════════════════
export async function getKnowledgeRegistry(pool: Pool) {
  if (!(await tableReady(pool, REGISTRY_TABLE))) {
    return { ready: false, total: 0, by_type: {}, by_domain: {}, entries: [], note: 'Registry not yet discovered (flag-OFF or POST /discover never run). null ≠ 0.' };
  }
  const entries = (await rows(pool, `SELECT knowledge_uid, name, source_type, domain, graph_role, physical_table, present, measured_count, owner, lifecycle_uid, source, updated_at FROM ${REGISTRY_TABLE} ORDER BY domain, name`)) ?? [];
  const by_type: Record<string, number> = {};
  const by_domain: Record<string, number> = {};
  for (const e of entries) {
    by_type[e.source_type] = (by_type[e.source_type] ?? 0) + 1;
    by_domain[e.domain] = (by_domain[e.domain] ?? 0) + 1;
  }
  return { ready: true, total: entries.length, by_type, by_domain, entries };
}

export async function getKnowledgeSource(pool: Pool, uidArg: string) {
  if (!(await tableReady(pool, REGISTRY_TABLE))) return { found: false, uid: uidArg, note: 'Registry not discovered.' };
  const r = await rows(pool, `SELECT * FROM ${REGISTRY_TABLE} WHERE knowledge_uid=$1 LIMIT 1`, [uidArg]);
  if (!r || !r.length) return { found: false, uid: uidArg };
  return { found: true, entry: r[0] };
}

export async function discoverKnowledge(pool: Pool, actor: string | null) {
  assertEnabled();
  await ensureKnowledgeSchema(pool);
  const measured = await measureSources(pool);
  let upserted = 0;
  for (const s of measured) {
    await pool.query(
      `INSERT INTO ${REGISTRY_TABLE} (knowledge_uid, name, source_type, domain, graph_role, physical_table, present, measured_count, metadata, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'discovered')
       ON CONFLICT (knowledge_uid) DO UPDATE SET
         name=EXCLUDED.name, source_type=EXCLUDED.source_type, domain=EXCLUDED.domain,
         graph_role=EXCLUDED.graph_role, physical_table=EXCLUDED.physical_table,
         present=EXCLUDED.present, measured_count=EXCLUDED.measured_count,
         metadata=EXCLUDED.metadata, updated_at=now()`,
      // owner is MANAGED — DELIBERATELY excluded from the UPDATE set so re-discovery never clobbers it.
      [s.uid, s.name, s.kind, s.domain, s.graph_role, s.table, s.present, s.count, JSON.stringify({ description: s.description, discovered_by: actor })],
    );
    upserted++;
  }
  return { ok: true, discovered: upserted, total_catalog: KNOWLEDGE_SOURCES.length, by: actor };
}

export async function registerKnowledgeSource(pool: Pool, body: any, actor: string | null) {
  assertEnabled();
  await ensureKnowledgeSchema(pool);
  const name = body?.name ? String(body.name) : null;
  const table = body?.physical_table ? String(body.physical_table) : null;
  if (!name || !table) return { ok: false, error: 'name and physical_table are required' };
  // Reject user-supplied identifiers that are not safe to interpolate (injection defence — the regex
  // gate, not the to_regclass probe, is what makes the downstream countTable() FROM "${table}" safe).
  if (!isSafeTableIdentifier(table)) {
    return { ok: false, error: 'physical_table must be a valid unquoted table identifier ([A-Za-z_][A-Za-z0-9_]*, ≤63 chars)' };
  }
  const u = body?.knowledge_uid ? String(body.knowledge_uid) : uid('ki-man');
  const present = await tableReady(pool, table);
  const count = present ? await countTable(pool, table) : null;
  await pool.query(
    `INSERT INTO ${REGISTRY_TABLE} (knowledge_uid, name, source_type, domain, graph_role, physical_table, present, measured_count, owner, lifecycle_uid, metadata, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'manual')
     ON CONFLICT (knowledge_uid) DO UPDATE SET
       name=EXCLUDED.name, source_type=EXCLUDED.source_type, domain=EXCLUDED.domain,
       graph_role=EXCLUDED.graph_role, physical_table=EXCLUDED.physical_table,
       present=EXCLUDED.present, measured_count=EXCLUDED.measured_count,
       owner=COALESCE(EXCLUDED.owner, ${REGISTRY_TABLE}.owner),
       lifecycle_uid=COALESCE(EXCLUDED.lifecycle_uid, ${REGISTRY_TABLE}.lifecycle_uid),
       metadata=EXCLUDED.metadata, updated_at=now()`,
    [u, name, body?.source_type ? String(body.source_type) : 'entity', body?.domain ? String(body.domain) : null,
     body?.graph_role ? String(body.graph_role) : null, table, present, count,
     body?.owner ? String(body.owner) : null, body?.lifecycle_uid ? String(body.lifecycle_uid) : null,
     JSON.stringify({ ...(body?.metadata ?? {}), registered_by: actor })],
  );
  return { ok: true, knowledge_uid: u, present, count };
}

// ════════════════════════════════════════════════════════════════════════════
// Summary (composes all parts)
// ════════════════════════════════════════════════════════════════════════════
export async function getKnowledgeSummary(pool: Pool) {
  const [registry, graph, metrics, validation] = await Promise.all([
    getKnowledgeRegistry(pool), getKnowledgeGraph(pool), getKnowledgeMetrics(pool), getKnowledgeValidation(pool),
  ]);
  return {
    phase: 'MX-800 Phase 2.5 — Knowledge Intelligence Engine',
    registry: { ready: registry.ready, total: registry.total, by_domain: registry.by_domain },
    graph: { source_tables: graph.totals.source_tables, present_tables: graph.totals.present_tables, nodes: graph.totals.nodes, edges: graph.totals.edges, domains: graph.by_domain.length },
    metrics: metrics.scores,
    validation_verdict: validation.verdict,
    axes_note: AXES_NOTE,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Audit (drift) — write paths own ensure-schema; capture is the ONLY mutation here
// ════════════════════════════════════════════════════════════════════════════
export async function captureKnowledgeSnapshot(pool: Pool, actor: string | null) {
  assertEnabled();
  await ensureKnowledgeSchema(pool);
  const [registry, graph, metrics, validation, summary] = await Promise.all([
    getKnowledgeRegistry(pool), getKnowledgeGraph(pool), getKnowledgeMetrics(pool), getKnowledgeValidation(pool), getKnowledgeSummary(pool),
  ]);
  const score = (m: string) => metrics.scores.find((s: any) => s.metric === m)?.score ?? null;
  const snapshot_uid = uid('ki-snap');
  await pool.query(
    `INSERT INTO ${SNAPSHOT_TABLE}
      (snapshot_uid, registry_total, sources_present, graph_nodes, graph_edges,
       knowledge_completeness_pct, relationship_coverage_pct, ontology_health_pct,
       semantic_consistency_pct, knowledge_confidence_pct, context_quality_pct,
       metrics, validation, summary, captured_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [snapshot_uid, registry.total, graph.totals.present_tables, graph.totals.nodes, graph.totals.edges,
     score('knowledge_completeness'), score('relationship_coverage'), score('ontology_health'),
     score('semantic_consistency'), score('knowledge_confidence'), score('context_quality'),
     JSON.stringify(metrics), JSON.stringify(validation), JSON.stringify(summary), actor],
  );
  return { ok: true, snapshot_uid, captured_by: actor };
}

export async function getKnowledgeSnapshots(pool: Pool, opts: { limit?: number } = {}) {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) return { ready: false, total: 0, snapshots: [] };
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const snaps = (await rows(pool, `SELECT snapshot_uid, registry_total, sources_present, graph_nodes, graph_edges, knowledge_completeness_pct, relationship_coverage_pct, ontology_health_pct, semantic_consistency_pct, knowledge_confidence_pct, context_quality_pct, captured_by, captured_at FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC LIMIT ${limit}`)) ?? [];
  return { ready: true, total: snaps.length, snapshots: snaps };
}

export async function getKnowledgeDrift(pool: Pool) {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) return { ready: false, note: 'No snapshots — drift needs ≥2 captures.' };
  const last = (await rows(pool, `SELECT * FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC LIMIT 2`)) ?? [];
  if (last.length < 2) return { ready: true, comparable: false, note: 'Need ≥2 snapshots to compute drift.' };
  const [cur, prev] = last;
  const delta = (k: string) => (cur[k] == null || prev[k] == null) ? null : Number(cur[k]) - Number(prev[k]); // null ≠ 0
  return {
    ready: true, comparable: true,
    from: prev.captured_at, to: cur.captured_at,
    deltas: {
      registry_total: delta('registry_total'),
      sources_present: delta('sources_present'),
      graph_nodes: delta('graph_nodes'),
      graph_edges: delta('graph_edges'),
      knowledge_completeness_pct: delta('knowledge_completeness_pct'),
      relationship_coverage_pct: delta('relationship_coverage_pct'),
      ontology_health_pct: delta('ontology_health_pct'),
      semantic_consistency_pct: delta('semantic_consistency_pct'),
      knowledge_confidence_pct: delta('knowledge_confidence_pct'),
      context_quality_pct: delta('context_quality_pct'),
    },
    note: 'null delta = at least one side unmeasured (null ≠ 0 change).',
  };
}
