/**
 * Task #145 — bridge role_be_eng / role_sr_be_eng to the curated ontology role
 * library so the employer competency match reaches their curated Role DNA.
 *
 * Problem
 * -------
 * The employer match chain is:
 *   jobTitle -> resolveBestOntRole (ont_roles) -> curatedLayerFor
 *     (map_ont_onto_role WHERE ont_role_id = <resolved id>) -> onto_role_weights.
 * `map_ont_onto_role` already had rows for role_be_eng / role_sr_be_eng but with
 * NULL ont_role_id ('unresolved'), so the chain never reached their curated DNA and
 * the match stayed domain_proxy.
 *
 * Two facts blocked a clean bridge to an existing library role:
 *   - "Backend Engineer" only resolved to the generic O*NET occupation
 *     ONET_15-1252.00 "Software Developers" (id 123), which is SHARED with
 *     "DevOps Engineer" — bridging there would mis-route DevOps to Backend DNA.
 *   - "Senior Backend Engineer" did not resolve to any ont_role at all.
 *
 * Fix
 * ---
 * ontology-seed.ts now seeds two dedicated curated roles, ROLE_BE_ENG /
 * ROLE_SR_BE_ENG (mirroring ROLE_SWE / ROLE_SR_SWE), so each title resolves
 * EXACTLY (exact_title rank beats the shared alias) to a DISTINCT ont_roles id.
 * This script points the bridge rows at those ids by ont_roles.code (resolved at
 * runtime, never hardcoded).
 *
 * Honesty / safety: additive + idempotent (only fills NULL or wrong ont_role_id,
 * re-runnable) and reversible (the bridge can be reset to NULL/'unresolved'). No
 * fabrication: it only links to ont_roles that ACTUALLY exist; if the seeded role
 * is missing it skips and reports. Run with --apply to write; default is a dry run.
 */
import { Pool } from 'pg';

const APPLY = process.argv.includes('--apply');

// onto_role_id (curated) -> ont_roles.code (library) the bridge should point at.
const BRIDGE: { ontoRoleId: string; ontRoleCode: string }[] = [
  { ontoRoleId: 'role_be_eng', ontRoleCode: 'ROLE_BE_ENG' },
  { ontoRoleId: 'role_sr_be_eng', ontRoleCode: 'ROLE_SR_BE_ENG' },
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

      // Confirm the curated bridge row exists (created by the earlier crosswalk run).
      const existing = await pool.query<{ ont_role_id: number | null }>(
        `SELECT ont_role_id FROM map_ont_onto_role WHERE onto_role_id = $1`,
        [b.ontoRoleId],
      );
      if (existing.rowCount === 0) {
        // No bridge row at all — create one (additive).
        console.log(`CREATE bridge ${b.ontoRoleId} -> ${b.ontRoleCode} (id ${ontId})`);
        if (APPLY) {
          await pool.query(
            `INSERT INTO map_ont_onto_role (onto_role_id, ont_role_id, ont_role_code, match_method, confidence, verified, notes)
             VALUES ($1,$2,$3,'exact_title','high',true,'Task #145: bridge to dedicated curated role')
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
                  notes = 'Task #145: bridge to dedicated curated role', updated_at = now()
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
