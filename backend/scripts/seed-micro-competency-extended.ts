/**
 * Micro Competency Framework — extended, family-grounded seed.
 *
 * Additive · idempotent · reversible · honest (no fabrication).
 *
 * For each curated competency family it designates an anchor PARENT competency
 * and LINKS every other member of that family as a child micro-competency.
 * Every parent and every child is a REAL row in onto_competencies — nothing is
 * invented and the canonical genome (onto_competencies) is NEVER mutated. The
 * raw O*NET library families (fam_onet_*) are intentionally excluded: they are
 * imported reference content, not curated framework themes.
 *
 * Rows are tagged source='family_seed' so the whole batch is independently
 * reversible without touching the baseline seed:
 *     DELETE FROM onto_competency_hierarchy WHERE source = 'family_seed';
 *
 * ON CONFLICT DO NOTHING means re-running is safe and existing baseline rows
 * (Communication / Leadership / Problem-Solving) are preserved untouched.
 *
 * Run FROM the backend dir:  npx tsx scripts/seed-micro-competency-extended.ts
 */

import { Pool } from 'pg';
import { ensureMicroCompetencySchema, slugify } from '../services/micro-competency.js';

const SOURCE = 'family_seed';

/**
 * Anchor parent competency per curated family. Each id is a real
 * onto_competencies row chosen as the most general/representative competency in
 * its family. Families absent here (fam_onet_*) are deliberately skipped.
 */
const FAMILY_ANCHORS: Record<string, string> = {
  fam_analytical_reasoning: 'comp_analytical_thinking',
  fam_change_transformation: 'comp_change_management',
  fam_coaching_mentoring: 'comp_coaching',
  fam_communication: 'comp_communication',
  fam_critical_thinking: 'comp_critical_thinking',
  fam_customer_excellence: 'comp_customer_focus',
  fam_decision_making: 'comp_decision_making',
  fam_empathy_diversity: 'comp_empathy',
  fam_execution: 'comp_results_orientation',
  fam_financial_commercial: 'comp_financial_acumen',
  fam_governance_ethics: 'comp_integrity',
  fam_growth_orientation: 'comp_self_development',
  fam_innovation: 'comp_innovation',
  fam_leadership: 'comp_leadership',
  fam_learning_agility: 'comp_learning_agility',
  fam_operational_excellence: 'comp_process_improvement',
  fam_project_delivery: 'comp_project_management',
  fam_quality_compliance: 'comp_quality_assurance',
  fam_relationship_management: 'comp_relationship_management',
  fam_resilience: 'comp_resilience',
  fam_risk_sustainability: 'comp_risk_management',
  fam_self_regulation: 'comp_emotional_intelligence',
  fam_stakeholder_influence: 'comp_stakeholder_mgmt',
  fam_strategic_reasoning: 'comp_strategic_thinking',
  fam_systems_cognition: 'comp_systems_thinking',
  fam_team_dynamics: 'comp_teamwork',
  fam_technical_adoption: 'comp_technical_competence',
  fam_vision_foresight: 'comp_vision',
  fam_work_ethic: 'comp_work_ethic',
};

/**
 * Existing top-level parents from the baseline seed. Never nest these as
 * children of a family anchor (keeps the hierarchy a clean two-level tree and
 * avoids a competency being both a top-level parent and a child).
 */
const EXISTING_PARENTS = new Set<string>([
  'comp_communication',
  'comp_leadership',
  'comp_problem_solving',
]);

interface ExtendedSeedResult {
  ok: boolean;
  families_processed: number;
  parents_seeded: number;
  relationships_inserted: number;
  skipped: { family: string; anchor: string; reason: string }[];
}

async function runExtendedSeed(pool: Pool): Promise<ExtendedSeedResult> {
  await ensureMicroCompetencySchema(pool);

  let familiesProcessed = 0;
  let parentsSeeded = 0;
  let inserted = 0;
  const skipped: { family: string; anchor: string; reason: string }[] = [];

  for (const [family, anchor] of Object.entries(FAMILY_ANCHORS)) {
    // Confirm the anchor exists and actually belongs to the family it anchors.
    const a = await pool.query(
      `SELECT id FROM onto_competencies WHERE id = $1 AND family_id = $2 AND deprecated IS NOT TRUE`,
      [anchor, family],
    );
    if (a.rowCount === 0) {
      skipped.push({ family, anchor, reason: 'anchor_not_found_in_family' });
      continue;
    }
    familiesProcessed += 1;

    // Real family members become children. The genome supplies both label and
    // id, so nothing is fabricated. Deduplicated by the table's unique indexes.
    const members = await pool.query(
      `SELECT id, canonical_name
         FROM onto_competencies
        WHERE family_id = $1
          AND id <> $2
          AND deprecated IS NOT TRUE
        ORDER BY canonical_name`,
      [family, anchor],
    );

    let order = 0;
    let familyInserts = 0;
    for (const m of members.rows as { id: string; canonical_name: string }[]) {
      if (EXISTING_PARENTS.has(m.id)) continue; // don't nest a baseline parent
      order += 10;
      const ins = await pool.query(
        `INSERT INTO onto_competency_hierarchy
           (parent_competency_id, child_competency_id, micro_label, micro_slug, sort_order, source)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [anchor, m.id, m.canonical_name, slugify(m.canonical_name), order, SOURCE],
      );
      if (ins.rowCount && ins.rowCount > 0) familyInserts += 1;
    }
    if (familyInserts > 0) parentsSeeded += 1;
    inserted += familyInserts;
  }

  return {
    ok: true,
    families_processed: familiesProcessed,
    parents_seeded: parentsSeeded,
    relationships_inserted: inserted,
    skipped,
  };
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[seed-micro-competency-extended] DATABASE_URL is not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString, max: 3 });
  try {
    const result = await runExtendedSeed(pool);
    console.log('[seed-micro-competency-extended] result:', JSON.stringify(result, null, 2));
    if (!result.ok) process.exit(1);
  } catch (err: any) {
    console.error('[seed-micro-competency-extended] failed:', err?.message ?? err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void main();
