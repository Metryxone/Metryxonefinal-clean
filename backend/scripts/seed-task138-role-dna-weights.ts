/**
 * Task #138 — Add ADDITIONAL competencies to the bridged roles' DNA (lever 2a).
 *
 * The employer competency match (computeCompetencyDrivenMatch) builds its CURATED
 * requirement set from a role's DNA: generateRoleDNA(jobTitle) resolves the job
 * title to an ont_role, bridges it via map_ont_onto_role to a curated onto_role,
 * and reads that role's onto_role_weights (see role-dna-expansion-engine.ts
 * curatedRequirementsFor). A competency therefore only contributes to
 * directMatchCount when it is part of the role's onto_role_weights AND has a
 * precise candidate score. Authoring questions alone (Task #130 / lever 1) does
 * NOT count a competency unless it is also a role requirement.
 *
 * Only THREE onto roles are reachable through the live bridge (map_ont_onto_role
 * has non-null ont_role_id for exactly these): role_pm, role_eng_manager,
 * role_credit_analyst. This script adds a SMALL, defensible set of genome
 * competencies — clearly core to each of those roles and NOT previously in any
 * role's DNA — to their current DNA profiles' onto_role_weights.
 *
 * HONESTY: each assignment carries a written rationale and source='task138', is
 * idempotent (skips if the comp is already in that profile's weights), and is fully
 * reversible by deleting rows where source='task138'. No existing weights are
 * mutated. A competency is only added if it exists in onto_competencies (FK target
 * for the downstream blueprint map). Run with --apply to write; default is dry run.
 */
import { Pool } from 'pg';

type Assignment = {
  dnaProfileId: string;
  competencyId: string;
  weight: number;
  expectedLevel: number; // 1..5
  rationale: string;
};

// Defensible, role-core competency assignments BEYOND the 33 role-DNA comps.
const ASSIGNMENTS: Assignment[] = [
  // Product Manager (dna_pm_v1)
  { dnaProfileId: 'dna_pm_v1', competencyId: 'comp_customer_focus', weight: 0.10, expectedLevel: 4, rationale: 'Product managers must continuously represent and prioritise customer needs.' },
  { dnaProfileId: 'dna_pm_v1', competencyId: 'comp_commercial_awareness', weight: 0.10, expectedLevel: 4, rationale: 'PMs own commercial outcomes and must understand market and business value.' },
  { dnaProfileId: 'dna_pm_v1', competencyId: 'comp_negotiation', weight: 0.08, expectedLevel: 3, rationale: 'PMs negotiate scope, priorities and trade-offs across engineering, design and business.' },
  { dnaProfileId: 'dna_pm_v1', competencyId: 'comp_creativity', weight: 0.08, expectedLevel: 3, rationale: 'Product ideation and problem reframing require creative thinking.' },
  { dnaProfileId: 'dna_pm_v1', competencyId: 'comp_change_management', weight: 0.08, expectedLevel: 3, rationale: 'PMs drive product change across stakeholders and must manage adoption.' },

  // Engineering Manager (dna_eng_manager_v1)
  { dnaProfileId: 'dna_eng_manager_v1', competencyId: 'comp_developing_people', weight: 0.12, expectedLevel: 4, rationale: 'A core EM responsibility is developing and growing engineers.' },
  { dnaProfileId: 'dna_eng_manager_v1', competencyId: 'comp_delegation', weight: 0.10, expectedLevel: 4, rationale: 'Engineering managers must delegate effectively to scale the team and output.' },
  { dnaProfileId: 'dna_eng_manager_v1', competencyId: 'comp_constructive_feedback', weight: 0.10, expectedLevel: 4, rationale: 'EMs give regular, actionable feedback to drive performance.' },
  { dnaProfileId: 'dna_eng_manager_v1', competencyId: 'comp_empathy', weight: 0.08, expectedLevel: 3, rationale: 'Effective people leadership requires understanding team members’ perspectives.' },
  { dnaProfileId: 'dna_eng_manager_v1', competencyId: 'comp_change_management', weight: 0.08, expectedLevel: 3, rationale: 'EMs lead teams through process, org and technical change.' },

  // Credit Analyst (dna_credit_v1)
  { dnaProfileId: 'dna_credit_v1', competencyId: 'comp_financial_acumen', weight: 0.12, expectedLevel: 4, rationale: 'Credit analysis requires strong financial-statement and ratio analysis.' },
  { dnaProfileId: 'dna_credit_v1', competencyId: 'comp_enterprise_risk_management', weight: 0.10, expectedLevel: 4, rationale: 'Assessing and managing credit/default risk is central to the role.' },
  { dnaProfileId: 'dna_credit_v1', competencyId: 'comp_balanced_judgment', weight: 0.10, expectedLevel: 4, rationale: 'Weighing competing evidence to reach a sound, defensible credit decision.' },
  { dnaProfileId: 'dna_credit_v1', competencyId: 'comp_conceptual_thinking', weight: 0.08, expectedLevel: 3, rationale: 'Synthesising financial, market and qualitative signals into a credit view.' },
  { dnaProfileId: 'dna_credit_v1', competencyId: 'comp_ethical_decision_making', weight: 0.08, expectedLevel: 3, rationale: 'Credit decisions carry fiduciary and regulatory stakes requiring ethical judgment.' },
];

async function main() {
  const apply = process.argv.includes('--apply');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // Guard 1: competency exists in onto_competencies.
    const compIds = Array.from(new Set(ASSIGNMENTS.map((a) => a.competencyId)));
    const compRes = await pool.query(`SELECT id FROM onto_competencies WHERE id = ANY($1::text[])`, [compIds]);
    const validComps = new Set<string>(compRes.rows.map((r: any) => r.id));

    // Guard 2: DNA profile exists and is current.
    const profIds = Array.from(new Set(ASSIGNMENTS.map((a) => a.dnaProfileId)));
    const profRes = await pool.query(
      `SELECT id FROM onto_dna_profiles WHERE id = ANY($1::text[]) AND is_current = true`,
      [profIds],
    );
    const validProfiles = new Set<string>(profRes.rows.map((r: any) => r.id));

    let inserted = 0;
    let skipped = 0;
    const summary: string[] = [];

    for (const a of ASSIGNMENTS) {
      if (!validComps.has(a.competencyId)) {
        summary.push(`SKIP ${a.competencyId} — not in onto_competencies`);
        skipped++;
        continue;
      }
      if (!validProfiles.has(a.dnaProfileId)) {
        summary.push(`SKIP ${a.dnaProfileId}/${a.competencyId} — DNA profile missing or not current`);
        skipped++;
        continue;
      }
      if (apply) {
        const res = await pool.query(
          `INSERT INTO onto_role_weights
             (dna_profile_id, competency_id, weight, expected_level, rationale, source)
           SELECT $1::text, $2::text, $3::numeric, $4::int, $5::text, 'task138'
            WHERE NOT EXISTS (
              SELECT 1 FROM onto_role_weights
               WHERE dna_profile_id = $1::text AND competency_id = $2::text)
           RETURNING id`,
          [a.dnaProfileId, a.competencyId, a.weight, a.expectedLevel, a.rationale],
        );
        if (res.rowCount && res.rowCount > 0) {
          inserted++;
          summary.push(`ADD  ${a.dnaProfileId} += ${a.competencyId} (w=${a.weight}, lvl=${a.expectedLevel})`);
        } else {
          skipped++;
          summary.push(`KEEP ${a.dnaProfileId}/${a.competencyId} — already a role-DNA competency`);
        }
      } else {
        summary.push(`DRY  ${a.dnaProfileId} += ${a.competencyId} (w=${a.weight}, lvl=${a.expectedLevel})`);
        inserted++;
      }
    }

    console.log(summary.join('\n'));
    console.log('\n' + '='.repeat(60));
    console.log(`${apply ? 'APPLIED' : 'DRY-RUN'}: ${inserted} role-DNA weights added, ${skipped} skipped (existing/invalid).`);
    if (!apply) console.log('Re-run with --apply to write.');
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
