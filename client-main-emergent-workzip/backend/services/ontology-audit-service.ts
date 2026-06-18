/**
 * CAPADEX Ontology Audit Service (read-only).
 *
 * Audits the 4-tier behavioural signal ontology + its relationship,
 * contradiction and intervention layers, and emits both:
 *   1. a compact `summary` (the contract shape requested by Phase 1), and
 *   2. an extended `readiness` report (per-audit detail + a repair plan).
 *
 * This service NEVER writes. It opens a single transaction purely to read a
 * consistent snapshot (per the "use db.transaction()" requirement). Backfill
 * of the gaps it surfaces is performed separately by `scripts/ontology-repair.ts`.
 *
 * Tables audited (see `migrations/20260528_signal_ontology_tables.sql`,
 * `20260524_adaptive_ontology_edges.sql`, `20260509_intervention_engine.sql`):
 *   - capadex_domains          (Tier 1, 20)        -> total_domains
 *   - capadex_families         (Tier 2, 400)       -> total_families
 *   - capadex_atomic_signals   (Tier 4, 15,972)    -> total_signals (atomic leaves)
 *   - capadex_signals          (Tier 3, 20)        -> total_composites (aggregate signals)
 *   - adaptive_ontology_edges                      -> total_relationships
 *   - intervention_library                         -> total_interventions
 *   - contradiction_links (text column on signals/atomic) -> total_contradictions
 *
 * Bridge-tag = `relational_bridge_tag`, the join key wiring buckets to edges
 * and to intervention construct keys.
 */
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

export type Db = NodePgDatabase<Record<string, never>>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** The compact contract shape requested by the Phase 1 brief. */
export interface OntologyAuditSummary {
  total_domains: number;
  total_families: number;
  total_signals: number;
  total_composites: number;
  total_relationships: number;
  total_contradictions: number;
  total_interventions: number;
  orphaned_signals: string[];
  orphaned_composites: string[];
  missing_relationships: string[];
  missing_interventions: string[];
}

export interface InverseEdgeCandidate {
  source_bucket: string;
  target_bucket: string;
  weight: number;
}

export interface OntologyReadinessReport {
  generated_at: string;
  summary: OntologyAuditSummary;
  audits: {
    signal_coverage: {
      total_atomic: number;
      orphaned_count: number;
      with_intervention_mapping: number;
      without_intervention_mapping: number;
      intervention_mapping_coverage_pct: number;
      with_contradiction_links: number;
    };
    composite_coverage: {
      total_composites: number;
      orphaned_count: number;
      buckets_with_atomic_children: number;
    };
    relationship_edges: {
      total_edges: number;
      duplicate_edge_groups: { source_bucket: string; target_bucket: string; count: number }[];
      dangling_edges: { source_bucket: string; target_bucket: string; status: string }[];
      isolated_buckets: string[];
      missing_inverse_edges: InverseEdgeCandidate[];
    };
    contradiction_rules: {
      total_contradiction_tokens: number;
      rows_with_contradictions: number;
      duplicate_within_row: { owner_id: string; token: string; occurrences: number }[];
    };
    intervention_mapping: {
      library_total: number;
      buckets_total: number;
      buckets_mapped: number;
      buckets_missing: string[];
    };
  };
  repair_plan: {
    intervention_backfill: string[];
    inverse_edge_backfill: InverseEdgeCandidate[];
    manual_curation_required: {
      isolated_buckets: string[];
      atomic_signals_without_intervention_mapping: number;
    };
  };
  readiness_score: number;
}

const ARRAY_CAP = 200;
function cap<T>(arr: T[]): T[] {
  return arr.length > ARRAY_CAP ? arr.slice(0, ARRAY_CAP) : arr;
}

/** Split a free-text token column ("a, b; c|d") into normalised tokens. */
function parseTokens(csv: unknown): string[] {
  if (csv === null || csv === undefined) return [];
  return String(csv)
    .split(/[,;|]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

async function rows<T = Record<string, unknown>>(tx: Tx, query: ReturnType<typeof sql>): Promise<T[]> {
  const res = (await tx.execute(query)) as unknown as { rows: T[] };
  return res.rows ?? [];
}

/**
 * Run the full ontology audit against a Drizzle connection.
 * Pass either the app `db` (from storage) or a script-local Drizzle instance.
 */
export async function runOntologyAudit(db: Db): Promise<OntologyReadinessReport> {
  // `repeatable read` gives a true consistent snapshot across every audit query
  // (READ COMMITTED would allow statement-level drift); `read only` enforces the
  // service's no-write contract at the database level.
  return db.transaction(
    async (tx) => {
    // ── Tier counts ──────────────────────────────────────────────────────
    const [counts] = await rows<{
      domains: number;
      families: number;
      composites: number;
      atomic: number;
      edges: number;
      interventions: number;
    }>(
      tx,
      sql`
        SELECT
          (SELECT count(*) FROM capadex_domains)::int        AS domains,
          (SELECT count(*) FROM capadex_families)::int       AS families,
          (SELECT count(*) FROM capadex_signals)::int        AS composites,
          (SELECT count(*) FROM capadex_atomic_signals)::int AS atomic,
          (SELECT count(*) FROM adaptive_ontology_edges)::int AS edges,
          (SELECT count(*) FROM intervention_library)::int   AS interventions
      `,
    );

    // Distinct bridge-tag buckets across all four tiers (the relationship nodes).
    const tagRows = await rows<{ t: string }>(
      tx,
      sql`
        SELECT DISTINCT relational_bridge_tag AS t FROM capadex_atomic_signals
        UNION SELECT DISTINCT relational_bridge_tag FROM capadex_signals
        UNION SELECT DISTINCT relational_bridge_tag FROM capadex_families
        UNION SELECT DISTINCT relational_bridge_tag FROM capadex_domains
      `,
    );
    const buckets = tagRows.map((r) => r.t).filter(Boolean).sort();
    const bucketSet = new Set(buckets);

    // ── 1. Signal Coverage Audit (atomic leaves) ────────────────────────
    const orphanSignalRows = await rows<{ atomic_signal_id: string }>(
      tx,
      sql`
        SELECT a.atomic_signal_id
        FROM capadex_atomic_signals a
        LEFT JOIN capadex_families f ON a.family_id = f.family_id
        LEFT JOIN capadex_domains  d ON a.domain_id = d.domain_id
        WHERE f.family_id IS NULL OR d.domain_id IS NULL
        ORDER BY a.atomic_signal_id
      `,
    );
    const orphanedSignals = orphanSignalRows.map((r) => r.atomic_signal_id);

    const [atomicCoverage] = await rows<{
      total: number;
      mapped: number;
      with_contra: number;
    }>(
      tx,
      sql`
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE trim(coalesce(intervention_mapping,'')) <> '')::int AS mapped,
          count(*) FILTER (WHERE trim(coalesce(contradiction_links,''))  <> '')::int AS with_contra
        FROM capadex_atomic_signals
      `,
    );

    // ── 2. Composite Signal Coverage Audit ──────────────────────────────
    // A composite is orphaned if no atomic signal shares its bridge-tag
    // (i.e. it aggregates no leaf signals).
    const orphanCompositeRows = await rows<{ signal_id: string }>(
      tx,
      sql`
        SELECT s.signal_id
        FROM capadex_signals s
        WHERE NOT EXISTS (
          SELECT 1 FROM capadex_atomic_signals a
          WHERE a.relational_bridge_tag = s.relational_bridge_tag
        )
        ORDER BY s.signal_id
      `,
    );
    const orphanedComposites = orphanCompositeRows.map((r) => r.signal_id);
    const compositeBucketsCovered = counts.composites - orphanedComposites.length;

    // ── 3. Relationship Edge Audit ──────────────────────────────────────
    const edgeRows = await rows<{
      source_bucket: string;
      target_bucket: string;
      weight: string | number;
      status: string;
    }>(tx, sql`SELECT source_bucket, target_bucket, weight, status FROM adaptive_ontology_edges`);

    const dupMap = new Map<string, number>();
    for (const e of edgeRows) {
      const k = `${e.source_bucket}\u0000${e.target_bucket}`;
      dupMap.set(k, (dupMap.get(k) ?? 0) + 1);
    }
    const duplicateEdgeGroups = [...dupMap.entries()]
      .filter(([, c]) => c > 1)
      .map(([k, count]) => {
        const [source_bucket, target_bucket] = k.split('\u0000');
        return { source_bucket, target_bucket, count };
      });

    const danglingEdges = edgeRows
      .filter((e) => !bucketSet.has(e.source_bucket) || !bucketSet.has(e.target_bucket))
      .map((e) => ({ source_bucket: e.source_bucket, target_bucket: e.target_bucket, status: e.status }));

    const connectedBuckets = new Set<string>();
    for (const e of edgeRows) {
      connectedBuckets.add(e.source_bucket);
      connectedBuckets.add(e.target_bucket);
    }
    const isolatedBuckets = buckets.filter((b) => !connectedBuckets.has(b));

    // Missing inverse edges: mirror APPROVED edges only (deterministic, additive).
    const edgePairSet = new Set(edgeRows.map((e) => `${e.source_bucket}\u0000${e.target_bucket}`));
    const missingInverseEdges: InverseEdgeCandidate[] = [];
    for (const e of edgeRows) {
      if (e.status !== 'approved') continue;
      const inverseKey = `${e.target_bucket}\u0000${e.source_bucket}`;
      if (!edgePairSet.has(inverseKey)) {
        missingInverseEdges.push({
          source_bucket: e.target_bucket,
          target_bucket: e.source_bucket,
          weight: Number(e.weight),
        });
      }
    }

    // ── 4. Contradiction Rule Audit ─────────────────────────────────────
    const contraRows = await rows<{ owner_id: string; contradiction_links: string }>(
      tx,
      sql`
        SELECT atomic_signal_id AS owner_id, contradiction_links
        FROM capadex_atomic_signals
        WHERE trim(coalesce(contradiction_links,'')) <> ''
        UNION ALL
        SELECT signal_id AS owner_id, contradiction_links
        FROM capadex_signals
        WHERE trim(coalesce(contradiction_links,'')) <> ''
      `,
    );
    let totalContradictionTokens = 0;
    const duplicateWithinRow: { owner_id: string; token: string; occurrences: number }[] = [];
    for (const r of contraRows) {
      const tokens = parseTokens(r.contradiction_links);
      totalContradictionTokens += tokens.length;
      const seen = new Map<string, number>();
      for (const t of tokens) seen.set(t, (seen.get(t) ?? 0) + 1);
      for (const [token, occ] of seen) {
        if (occ > 1) duplicateWithinRow.push({ owner_id: r.owner_id, token, occurrences: occ });
      }
    }

    // ── 5. Intervention Mapping Audit ───────────────────────────────────
    const ckRows = await rows<{ construct_key: string }>(
      tx,
      sql`SELECT DISTINCT construct_key FROM intervention_library WHERE construct_key IS NOT NULL`,
    );
    const constructKeys = new Set(ckRows.map((r) => r.construct_key));
    const bucketsMissingIntervention = buckets.filter((b) => !constructKeys.has(b));
    const bucketsMapped = buckets.length - bucketsMissingIntervention.length;

    // ── Readiness score (mean of five normalised sub-scores) ────────────
    const subScores = [
      counts.atomic > 0 ? (counts.atomic - orphanedSignals.length) / counts.atomic : 1, // signal FK integrity
      counts.composites > 0 ? compositeBucketsCovered / counts.composites : 1, // composite coverage
      buckets.length > 0 ? (buckets.length - isolatedBuckets.length) / buckets.length : 1, // connectivity
      buckets.length > 0 ? bucketsMapped / buckets.length : 1, // intervention bucket coverage
      counts.atomic > 0 ? atomicCoverage.mapped / counts.atomic : 1, // atomic intervention mapping
    ];
    const readinessScore = Math.round((subScores.reduce((a, b) => a + b, 0) / subScores.length) * 1000) / 10;

    const summary: OntologyAuditSummary = {
      total_domains: counts.domains,
      total_families: counts.families,
      total_signals: counts.atomic,
      total_composites: counts.composites,
      total_relationships: counts.edges,
      total_contradictions: totalContradictionTokens,
      total_interventions: counts.interventions,
      orphaned_signals: cap(orphanedSignals),
      orphaned_composites: cap(orphanedComposites),
      missing_relationships: cap(isolatedBuckets),
      missing_interventions: cap(bucketsMissingIntervention),
    };

    return {
      generated_at: new Date().toISOString(),
      summary,
      audits: {
        signal_coverage: {
          total_atomic: atomicCoverage.total,
          orphaned_count: orphanedSignals.length,
          with_intervention_mapping: atomicCoverage.mapped,
          without_intervention_mapping: atomicCoverage.total - atomicCoverage.mapped,
          intervention_mapping_coverage_pct: pct(atomicCoverage.mapped, atomicCoverage.total),
          with_contradiction_links: atomicCoverage.with_contra,
        },
        composite_coverage: {
          total_composites: counts.composites,
          orphaned_count: orphanedComposites.length,
          buckets_with_atomic_children: compositeBucketsCovered,
        },
        relationship_edges: {
          total_edges: counts.edges,
          duplicate_edge_groups: duplicateEdgeGroups,
          dangling_edges: danglingEdges,
          isolated_buckets: isolatedBuckets,
          missing_inverse_edges: missingInverseEdges,
        },
        contradiction_rules: {
          total_contradiction_tokens: totalContradictionTokens,
          rows_with_contradictions: contraRows.length,
          duplicate_within_row: cap(duplicateWithinRow),
        },
        intervention_mapping: {
          library_total: counts.interventions,
          buckets_total: buckets.length,
          buckets_mapped: bucketsMapped,
          buckets_missing: bucketsMissingIntervention,
        },
      },
      repair_plan: {
        intervention_backfill: bucketsMissingIntervention,
        inverse_edge_backfill: missingInverseEdges,
        manual_curation_required: {
          isolated_buckets: isolatedBuckets,
          atomic_signals_without_intervention_mapping: atomicCoverage.total - atomicCoverage.mapped,
        },
      },
      readiness_score: readinessScore,
    };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}
