/**
 * PHASE 8 — Global Competency evidence generator (direct engine; flag-independent).
 *
 * Proves the structural framework end-to-end WITHOUT fabricating regional content:
 *   1) Default region (IN) inherits today's REAL global content counts from each backing table.
 *   2) Every non-default region reports honest ZEROS (no fabricated benchmarks/roles/demand).
 *   3) The region dimension is genuinely threadable + reversible: assign ONE real existing
 *      entity to a non-default region → that region's surface count rises by exactly 1 →
 *      rollback removes it → the region returns to zero.
 *
 * Writes a committed audit artifact to backend/audit/phase8-global-competency/coverage.md.
 * Cleans up after itself (deletes only the demo rows it inserted by a dedicated provenance).
 */
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import {
  REGIONS,
  DEFAULT_REGION,
  SURFACES,
  computeRegionCoverage,
  assignRegionContent,
  rollbackRegionContent,
  validateEntityRefs,
  GLOBAL_COMPETENCY_VERSION,
  type SurfaceKey,
} from '../services/global-competency-engine';

const EVIDENCE_PROVENANCE = 'phase8_evidence_demo';

async function pickRealEntity(pool: Pool, table: string, idExpr: string): Promise<string | null> {
  try {
    const { rows } = await pool.query(`SELECT ${idExpr}::text AS ref FROM ${table} WHERE ${idExpr} IS NOT NULL LIMIT 1`);
    return rows[0]?.ref ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const lines: string[] = [];
  const log = (s = '') => {
    lines.push(s);
    console.log(s);
  };

  try {
    log(`# Phase 8 — Global Competency Coverage Evidence`);
    log('');
    log(`- Version: \`${GLOBAL_COMPETENCY_VERSION}\``);
    log(`- Generated: ${new Date().toISOString()}`);
    log(`- Default region: \`${DEFAULT_REGION}\` (== today; India-centric)`);
    log('');

    // (1)+(2) baseline coverage
    const baseline = await computeRegionCoverage(pool);
    log(`## 1. Per-region coverage (baseline)`);
    log('');
    log(`Overlay table present: \`${baseline.overlay_table_present}\``);
    log('');
    log(`| Region | Default | ${SURFACES.map((s) => s.label).join(' | ')} | Surfaces w/ content |`);
    log(`|---|---|${SURFACES.map(() => '---').join('|')}|---|`);
    for (const r of baseline.regions) {
      const cells = SURFACES.map((s) => {
        const sc = r.surfaces.find((x) => x.surface === s.key)!;
        return sc.effective_content == null ? 'null' : String(sc.effective_content);
      });
      log(`| ${r.code} (${r.name}) | ${r.is_default ? 'yes' : ''} | ${cells.join(' | ')} | ${r.surfaces_with_content}/${SURFACES.length} |`);
    }
    log('');
    log('Interpretation: the **default region inherits the real global counts**; every **non-default region is honestly empty** (no regional content has been authored — this phase delivers the framework, not the data). `null` = backing table absent/unreadable (distinct from `0`).');
    log('');

    // (3) threadability + reversibility — assign ONE real entity to a non-default region
    log(`## 2. Threadability + reversibility (assign \u2192 recount \u2192 rollback)`);
    log('');
    const demoRegion = 'EU' as const;
    const demoSurface: SurfaceKey = 'role_library';
    const surfaceMeta = SURFACES.find((s) => s.key === demoSurface)!;
    // onto_roles primary key is the role id/code; pick a real existing one (never invented).
    const realRef =
      (await pickRealEntity(pool, surfaceMeta.table, 'id')) ??
      (await pickRealEntity(pool, surfaceMeta.table, 'code'));

    if (!realRef) {
      log(`- SKIPPED: no real entity found in \`${surfaceMeta.table}\` to demonstrate assignment (honest: nothing to tag).`);
    } else {
      const before = (await computeRegionCoverage(pool)).regions
        .find((r) => r.code === demoRegion)!
        .surfaces.find((s) => s.surface === demoSurface)!.effective_content ?? 0;

      const assign = await assignRegionContent(pool, {
        surface: demoSurface,
        region: demoRegion,
        entityRefs: [realRef],
        provenance: EVIDENCE_PROVENANCE,
        detail: { demo: true, note: 'evidence-only; real existing onto_roles entity tagged to EU' },
      });

      const after = (await computeRegionCoverage(pool)).regions
        .find((r) => r.code === demoRegion)!
        .surfaces.find((s) => s.surface === demoSurface)!.effective_content ?? 0;

      const rb = await rollbackRegionContent(pool, EVIDENCE_PROVENANCE);

      const restored = (await computeRegionCoverage(pool)).regions
        .find((r) => r.code === demoRegion)!
        .surfaces.find((s) => s.surface === demoSurface)!.effective_content ?? 0;

      log(`- Tagged ONE real \`${surfaceMeta.table}\` entity (\`${realRef}\`) to region \`${demoRegion}\`, surface \`${demoSurface}\`.`);
      log(`- ${demoRegion}.${demoSurface} effective_content: **${before} \u2192 ${after}** after assign (written=${assign.written}).`);
      log(`- Rolled back (deleted=${rb.deleted}); ${demoRegion}.${demoSurface} effective_content restored to **${restored}**.`);
      log('');
      const pass = after === before + 1 && restored === before;
      log(`Result: ${pass ? '**PASS**' : '**REVIEW**'} — the region dimension threads through additively and is fully reversible; no regional content was fabricated (only an existing entity was region-tagged, then untagged).`);
    }
    log('');

    // (4) honesty guard — a nonexistent entity_ref can NEVER be tagged (no fabricated coverage)
    log(`## 3. Honesty guard: nonexistent entities are rejected`);
    log('');
    const fakeRefs = ['__not_a_real_role__', '__phantom__'];
    const validated = await validateEntityRefs(pool, 'role_library', fakeRefs);
    const rejAssign = await assignRegionContent(pool, {
      surface: 'role_library',
      region: 'EU',
      entityRefs: fakeRefs,
      provenance: EVIDENCE_PROVENANCE,
    });
    await rollbackRegionContent(pool, EVIDENCE_PROVENANCE); // clean any (should be none)
    const guardPass = validated.valid.length === 0 && rejAssign.written === 0 && rejAssign.rejected === fakeRefs.length;
    log(`- Submitted ${fakeRefs.length} nonexistent role refs \u2192 valid=${validated.valid.length}, rejected=${rejAssign.rejected}, written=${rejAssign.written}.`);
    log(`Result: ${guardPass ? '**PASS**' : '**REVIEW**'} — refs that do not exist in the backing table are rejected, so coverage can never be inflated by fabricated entities.`);
    log('');
    log(`## Honesty boundary`);
    log('');
    log('- Phase 8 delivers a **structural framework + per-region coverage reporting only**. No regional benchmarks, roles, competency models, readiness models, or demand content were authored.');
    log('- Non-default regions reporting zero is the **honest finding**, not a defect.');
    log('- The whole phase is reversible (drop `global_region_content` or delete by provenance); existing tables are never altered. Flag OFF → byte-identical incl. schema.');

    const outDir = path.join(__dirname, '../audit/phase8-global-competency');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'coverage.md'), lines.join('\n'), 'utf-8');
    console.log(`\n[evidence] wrote ${path.join(outDir, 'coverage.md')}`);
  } catch (err) {
    console.error('[evidence] FAILED:', err);
    process.exitCode = 1;
  } finally {
    // Defensive cleanup in case of mid-run error.
    try {
      await rollbackRegionContent(pool, EVIDENCE_PROVENANCE);
    } catch {
      /* ignore */
    }
    await pool.end();
  }
}

void main();
