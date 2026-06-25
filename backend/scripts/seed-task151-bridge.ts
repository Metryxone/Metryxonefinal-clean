/**
 * Task #151 — bridge the remaining unbridged curated engineering roles to the
 * shared ontology role library so the employer competency match reaches their
 * curated Role DNA. Mirrors the Task #145 recipe (Backend / Senior Backend
 * Engineer) for the rest of the engineering family.
 *
 * Problem
 * -------
 * The employer match chain is:
 *   jobTitle -> resolveBestOntRole (ont_roles) -> curatedLayerFor
 *     (map_ont_onto_role WHERE ont_role_id = <resolved id>) -> onto_role_weights.
 * The curated onto_* roles below ALL carry a current Role DNA (onto_dna_profiles
 * + onto_role_weights) but have NO `map_ont_onto_role` bridge row, so the chain
 * never reaches their curated DNA and the match stays domain_proxy.
 *
 * Fix
 * ---
 * ontology-seed.ts now seeds dedicated curated library roles ROLE_QA_ENG /
 * ROLE_DEVOPS_ENG / ROLE_FE_ENG / ROLE_FULLSTACK_ENG (mirroring ROLE_BE_ENG), so
 * each title resolves EXACTLY to a DISTINCT ont_roles id. "Software Engineer" /
 * "Senior Software Engineer" already resolve to the pre-existing ROLE_SWE /
 * ROLE_SR_SWE library roles. This script points (or creates) the bridge rows at
 * those ids by ont_roles.code (resolved at runtime, never hardcoded).
 *
 * Honesty / safety: additive + idempotent (only fills NULL or wrong ont_role_id,
 * re-runnable) and reversible (the bridge can be reset to NULL/'unresolved'). No
 * fabrication: it only links to ont_roles that ACTUALLY exist; if a seeded role
 * is missing it skips and reports. Run with --apply to write; default is a dry run.
 */
import { Pool } from 'pg';

const APPLY = process.argv.includes('--apply');

// onto_role_id (curated) -> ont_roles.code (library) the bridge should point at.
const BRIDGE: { ontoRoleId: string; ontRoleCode: string }[] = [
  { ontoRoleId: 'role_qa_eng', ontRoleCode: 'ROLE_QA_ENG' },
  { ontoRoleId: 'role_devops_eng', ontRoleCode: 'ROLE_DEVOPS_ENG' },
  { ontoRoleId: 'role_fe_eng', ontRoleCode: 'ROLE_FE_ENG' },
  { ontoRoleId: 'role_fullstack_eng', ontRoleCode: 'ROLE_FULLSTACK_ENG' },
  { ontoRoleId: 'role_software_eng', ontRoleCode: 'ROLE_SWE' },
  { ontoRoleId: 'role_sr_software_eng', ontRoleCode: 'ROLE_SR_SWE' },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    let updated = 0;
    let skipped = 0;
    for (const b of BRIDGE) {
      const role = await pool.query<{ id: number; code: string; title: string }>(
        `SELECT id, code, title FROM ont_roles WHERE code = $1 AND is_active = true`,
        [b.ontRoleCode],
      );
      if (role.rowCount === 0) {
        console.log(`SKIP ${b.ontoRoleId}: ont_roles ${b.ontRoleCode} not found (run ontology-seed first).`);
        skipped++;
        continue;
      }
      const ontId = role.rows[0].id;

      // Confirm the curated onto role actually carries a current Role DNA — never
      // bridge into an empty shell (the match would then have no requirements).
      const dna = await pool.query<{ n: string }>(
        `SELECT count(*) AS n FROM onto_dna_profiles dp
          JOIN onto_role_weights w ON w.dna_profile_id = dp.id
         WHERE dp.role_id = $1 AND dp.is_current = true`,
        [b.ontoRoleId],
      );
      if (Number(dna.rows[0]?.n ?? 0) === 0) {
        console.log(`SKIP ${b.ontoRoleId}: no current Role DNA weights — refusing to bridge an empty role.`);
        skipped++;
        continue;
      }

      const existing = await pool.query<{ ont_role_id: number | null }>(
        `SELECT ont_role_id FROM map_ont_onto_role WHERE onto_role_id = $1`,
        [b.ontoRoleId],
      );
      if (existing.rowCount === 0) {
        console.log(`CREATE bridge ${b.ontoRoleId} -> ${b.ontRoleCode} (id ${ontId})`);
        if (APPLY) {
          await pool.query(
            `INSERT INTO map_ont_onto_role (onto_role_id, ont_role_id, ont_role_code, match_method, confidence, verified, notes)
             VALUES ($1,$2,$3,'exact_title','high',true,'Task #151: bridge to dedicated curated role')
             ON CONFLICT (onto_role_id) DO UPDATE SET
               ont_role_id = EXCLUDED.ont_role_id, ont_role_code = EXCLUDED.ont_role_code,
               match_method = EXCLUDED.match_method, confidence = EXCLUDED.confidence,
               verified = EXCLUDED.verified, notes = EXCLUDED.notes, updated_at = now()`,
            [b.ontoRoleId, ontId, b.ontRoleCode],
          );
        }
        updated++;
        continue;
      }

      if (existing.rows[0].ont_role_id === ontId) {
        console.log(`OK ${b.ontoRoleId} already bridged -> ${b.ontRoleCode} (id ${ontId})`);
        continue;
      }

      console.log(`UPDATE bridge ${b.ontoRoleId}: ont_role_id ${existing.rows[0].ont_role_id ?? 'NULL'} -> ${ontId} (${b.ontRoleCode})`);
      if (APPLY) {
        await pool.query(
          `UPDATE map_ont_onto_role
              SET ont_role_id = $2, ont_role_code = $3, match_method = 'exact_title',
                  confidence = 'high', verified = true,
                  notes = 'Task #151: bridge to dedicated curated role', updated_at = now()
            WHERE onto_role_id = $1`,
          [b.ontoRoleId, ontId, b.ontRoleCode],
        );
      }
      updated++;
    }
    console.log('\n' + '='.repeat(60));
    console.log(`${APPLY ? 'APPLIED' : 'DRY-RUN'}: ${updated} bridge rows set, ${skipped} skipped.`);
    if (!APPLY) console.log('Re-run with --apply to write.');
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
