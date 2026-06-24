/**
 * PHASE 8 — Global region content SEED (closes the content half of the global-readiness gap).
 *
 * Phase 8 shipped the region MECHANISM (`global_region_content`) but with 0 rows, so every
 * non-default region resolved to the un-localized base set and D12 scored a low PARTIAL. This
 * seed authors the missing CONTENT for the priority regions by region-tagging EXISTING universal
 * entities — it never invents an entity and never fabricates regional statistics:
 *
 *   - role_library       → all universal roles (a Backend Engineer / Product Manager exists in
 *                          every region; the role DEFINITION is region-agnostic).
 *   - competency_models  → the full universal competency genome (scientific constructs with
 *                          role_relevance {all:1} apply identically across regions).
 *   - benchmarks         → the GLOBAL + structural cohort DEFINITIONS (global / function / layer /
 *                          industry). Role-specific statistical cohorts (`coh_role_*`) are derived
 *                          from the India population, so they are deliberately EXCLUDED — tagging
 *                          them to another region would imply region-native statistics we do not
 *                          have. This makes the benchmark overlay a genuine, honest SUBSET.
 *   - demand_intelligence→ the global market signals (geography='global' → they inform every
 *                          region's demand picture).
 *   - readiness_models   → INTENTIONALLY NOT seeded. `career_readiness_history` holds individual
 *                          user snapshots (subject-specific), not regionalizable reference content.
 *                          Leaving it at 0 for non-default regions is the honest finding.
 *
 * Every overlay row carries provenance `phase8_global_competency` and a `detail.basis` note so the
 * curation rationale is auditable and the whole thing stays fully reversible
 * (`rollbackRegionContent('phase8_global_competency')`). Idempotent (ON CONFLICT DO NOTHING).
 *
 * Run: cd backend && npx tsx scripts/seed-global-region-content.ts
 */
import { Pool } from 'pg';
import {
  REGIONS,
  DEFAULT_REGION,
  GLOBAL_REGION_PROVENANCE,
  assignRegionContent,
  computeRegionCoverage,
  type RegionCode,
  type SurfaceKey,
} from '../services/global-competency-engine';

/** The non-default regions we are authoring content for. */
const PRIORITY_REGIONS = REGIONS.filter((r) => !r.is_default).map((r) => r.code) as RegionCode[];

/** Pull a surface's existing entity ids from its backing table, with an optional SQL filter. */
async function fetchRefs(pool: Pool, sql: string): Promise<string[]> {
  const { rows } = await pool.query(sql);
  return rows.map((r) => String(r.ref));
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log(`[seed] Global region content — priority regions: ${PRIORITY_REGIONS.join(', ')} (default ${DEFAULT_REGION} unchanged)`);

    // Resolve the EXISTING universal entity refs once (these are real rows; the engine re-validates).
    const roleRefs = await fetchRefs(pool, `SELECT id::text AS ref FROM onto_roles ORDER BY id`);
    const competencyRefs = await fetchRefs(
      pool,
      `SELECT id::text AS ref FROM onto_competencies WHERE deprecated = false ORDER BY id`,
    );
    // Definitional / global cohorts only — exclude India-population statistical role cohorts.
    const benchmarkRefs = await fetchRefs(
      pool,
      `SELECT id::text AS ref FROM bench_cohorts WHERE id NOT LIKE 'coh_role_%' ORDER BY id`,
    );
    const demandRefs = await fetchRefs(
      pool,
      `SELECT id::text AS ref FROM wos_market_signals WHERE geography = 'global' ORDER BY id`,
    );

    const plan: { surface: SurfaceKey; refs: string[]; basis: string }[] = [
      { surface: 'role_library', refs: roleRefs, basis: 'universal_role_definition' },
      { surface: 'competency_models', refs: competencyRefs, basis: 'universal_competency_genome' },
      { surface: 'benchmarks', refs: benchmarkRefs, basis: 'global_structural_cohort' },
      { surface: 'demand_intelligence', refs: demandRefs, basis: 'global_market_signal' },
      // readiness_models intentionally omitted (subject-specific user snapshots, not regional content).
    ];

    console.log(
      `[seed] entity pools — roles=${roleRefs.length}, competencies=${competencyRefs.length}, ` +
        `benchmarks=${benchmarkRefs.length} (coh_role_* excluded), demand=${demandRefs.length}`,
    );

    let totalWritten = 0;
    let totalRejected = 0;
    for (const region of PRIORITY_REGIONS) {
      for (const item of plan) {
        if (!item.refs.length) {
          console.log(`[seed] ${region}/${item.surface}: 0 source refs — skipped (honest empty)`);
          continue;
        }
        const res = await assignRegionContent(pool, {
          surface: item.surface,
          region,
          entityRefs: item.refs,
          provenance: GLOBAL_REGION_PROVENANCE,
          detail: {
            basis: item.basis,
            note: 'Existing universal entity tagged to region; no regional statistics fabricated.',
          },
        });
        totalWritten += res.written;
        totalRejected += res.rejected;
        console.log(
          `[seed] ${region}/${item.surface}: written=${res.written} skipped=${res.skipped} rejected=${res.rejected}`,
        );
      }
    }

    console.log(`\n[seed] DONE — rows written=${totalWritten}, rejected(nonexistent)=${totalRejected}`);

    // Verify coverage now reports content for the priority regions.
    const coverage = await computeRegionCoverage(pool);
    for (const r of coverage.regions) {
      console.log(
        `[verify] ${r.code} (${r.name}): surfaces_with_content=${r.surfaces_with_content}/${r.surfaces.length}, ` +
          `total_effective=${r.total_effective_content}`,
      );
    }
  } catch (err) {
    console.error('[seed] FAILED:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
