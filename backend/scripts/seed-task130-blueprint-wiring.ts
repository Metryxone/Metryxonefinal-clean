/**
 * Task #130 — blueprint wiring (the second, necessary lever).
 *
 * Approving comp_*-coded question templates (seed-task130-competency-questions.ts)
 * is necessary but NOT sufficient to move the employer match: generateAssessment
 * (competency-runtime.ts ~L314) only SERVES comp-tagged questions for the
 * competencies present in a blueprint's competency map
 * (onto_blueprint_competency_map). A role-DNA competency that has approved
 * questions but is not in any blueprint is never served, so scoreAssessment can
 * never produce a PRECISE score for it, and the match stays domain_proxy.
 *
 * This script closes that gap, additively and reversibly:
 *   1. Ensures every current Role-DNA profile (onto_dna_profiles) has a canonical
 *      assessment blueprint (reuses the existing bp_*_v1 where present; creates
 *      `bp_<role>_t130` otherwise).
 *   2. Syncs each chosen blueprint's competency map to include exactly the role's
 *      DNA competencies (onto_role_weights) that have approved + active-mapped
 *      question templates — so an assessment serves them and scores PRECISELY.
 *
 * No fabrication: only REAL role-DNA competencies that genuinely have approved
 * questions are wired. Competencies without approved questions are skipped and
 * stay domain_proxy/unmeasured. Idempotent (ON CONFLICT / NOT EXISTS); reversible
 * (created blueprints carry source='t130', synced comp rows carry source='t130_sync').
 *
 * Run with --apply to write; default is a dry run.
 */
import { Pool } from 'pg';

const APPLY = process.argv.includes('--apply');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // Current Role-DNA profiles -> role id.
    const dna = await pool.query<{ id: string; role_id: string }>(
      `SELECT id, role_id FROM onto_dna_profiles WHERE is_current AND role_id IS NOT NULL ORDER BY id`,
    );

    let bpCreated = 0;
    let mapInserted = 0;
    let skippedNoQ = 0;
    const summary: string[] = [];

    for (const profile of dna.rows) {
      const roleId = profile.role_id;

      // 1. Resolve / create the canonical blueprint for this role.
      const existing = await pool.query<{ id: string }>(
        `SELECT id FROM onto_assessment_blueprints
          WHERE source_role_id = $1
          ORDER BY (id LIKE 'bp\\_%') DESC, created_at
          LIMIT 1`,
        [roleId],
      );
      let blueprintId: string;
      if (existing.rowCount && existing.rowCount > 0) {
        blueprintId = existing.rows[0].id;
      } else {
        const role = await pool.query<{ id: string; title: string }>(
          `SELECT id, title FROM onto_roles WHERE id = $1`,
          [roleId],
        );
        if (role.rowCount === 0) { summary.push(`SKIP ${roleId}: role not in onto_roles`); continue; }
        const suffix = roleId.replace(/^role_/, '');
        blueprintId = `bp_${suffix}_t130`;
        const key = `${suffix}-t130`;
        const name = `${role.rows[0].title} Assessment`;
        if (APPLY) {
          await pool.query(
            `INSERT INTO onto_assessment_blueprints (id, blueprint_key, name, description, source_role_id, source, active)
             VALUES ($1,$2,$3,$4,$5,'t130',true)
             ON CONFLICT (id) DO NOTHING`,
            [blueprintId, key, name, `Auto-wired from Role DNA ${profile.id} (Task #130).`, roleId],
          );
        }
        bpCreated++;
        summary.push(`CREATE blueprint ${blueprintId} for ${roleId}`);
      }

      // 2. Role-DNA comps that have approved + active-mapped questions and are not
      //    yet in this blueprint's competency map.
      const wire = await pool.query<{ competency_id: string; expected_level: number | null; weight: number | null }>(
        `SELECT w.competency_id, w.expected_level, w.weight
           FROM onto_role_weights w
          WHERE w.dna_profile_id = $1
            AND EXISTS (SELECT 1 FROM onto_competency_question_map m
                         WHERE m.competency_id = w.competency_id AND m.active)
            AND NOT EXISTS (SELECT 1 FROM onto_blueprint_competency_map bcm
                             WHERE bcm.blueprint_id = $2 AND bcm.competency_id = w.competency_id)
          ORDER BY w.competency_id`,
        [profile.id, blueprintId],
      );

      // Count role-DNA comps with NO approved questions (honest: stay unmeasured).
      const noq = await pool.query<{ n: string }>(
        `SELECT count(*) AS n FROM onto_role_weights w
          WHERE w.dna_profile_id = $1
            AND NOT EXISTS (SELECT 1 FROM onto_competency_question_map m
                             WHERE m.competency_id = w.competency_id AND m.active)`,
        [profile.id],
      );
      skippedNoQ += Number(noq.rows[0]?.n ?? 0);

      for (const r of wire.rows) {
        const reqLevel = r.expected_level != null && r.expected_level >= 1 && r.expected_level <= 5
          ? Math.round(r.expected_level) : 3;
        const weight = r.weight != null && r.weight > 0 ? r.weight : 1;
        if (APPLY) {
          await pool.query(
            `INSERT INTO onto_blueprint_competency_map
               (blueprint_id, competency_id, required_level, weight, criticality, source, active)
             SELECT $1::varchar, $2::varchar, $3::int, $4::numeric, 'important', 't130_sync', true
              WHERE NOT EXISTS (
                SELECT 1 FROM onto_blueprint_competency_map
                 WHERE blueprint_id = $1::varchar AND competency_id = $2::varchar)`,
            [blueprintId, r.competency_id, reqLevel, weight],
          );
        }
        mapInserted++;
      }
      if (wire.rows.length > 0) {
        summary.push(`  ${blueprintId}: +${wire.rows.length} comps [${wire.rows.map((x) => x.competency_id).join(', ')}]`);
      }
    }

    console.log(summary.join('\n'));
    console.log('\n' + '='.repeat(60));
    console.log(`${APPLY ? 'APPLIED' : 'DRY-RUN'}: ${bpCreated} blueprints created/reused-missing, ` +
      `${mapInserted} blueprint-competency rows wired, ${skippedNoQ} role-DNA comps skipped (no approved questions → stay unmeasured).`);
    if (!APPLY) console.log('Re-run with --apply to write.');
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
