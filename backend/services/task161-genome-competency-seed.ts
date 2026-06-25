/**
 * task161-genome-competency-seed.ts — Task #161
 *
 * Authors the THREE competencies that the candidate CRA assessment could not map
 * to a genuine same-construct genome row, so all 20 CRA competencies can finally
 * be scored precisely (see .agents/memory/candidate-cra-precise-bridge.md):
 *
 *   • comp_verbal_communication — Verbal Communication (CRA COM01). Distinct from
 *     the umbrella `comp_communication` (broader) and the channel-specific
 *     `comp_written_communication`. This is the SPOKEN/oral channel: real-time,
 *     interactive, audience-adaptive verbal exchange.
 *   • comp_change_leadership — Change Leadership (CRA LEA05). Distinct from
 *     `comp_change_management` (planning/implementing the mechanics of change) and
 *     `comp_change_advocacy` (championing a specific change). Change Leadership is
 *     setting direction through change and mobilising people emotionally toward it.
 *   • comp_digital_fluency — Digital Fluency (CRA TEC02). Distinct from
 *     `comp_technology_adoption` (willingness to embrace new tech). Digital Fluency
 *     is demonstrated PROFICIENCY: confidently selecting and using digital tools,
 *     data, and platforms to get work done well.
 *
 * WHY a startup hook (see .agents/memory/merged-task-data-not-in-live-db.md):
 *   A task merge carries CODE + migration DDL only — NOT seeded rows, and the agent
 *   cannot write to the production DB. The ONLY way these genome rows reach the live
 *   app is a self-running, idempotent seeder on the live backend — the same pattern
 *   this codebase already uses (Task 81 region-native seed, Task #138 competency
 *   seed, occupation/ontology self-seeders). A single publish then activates it.
 *
 * HONESTY / SAFETY CONTRACT:
 *   - Strictly ADDITIVE & reversible: only INSERTs three NEW ids; ON CONFLICT (id)
 *     DO NOTHING so an existing row is NEVER mutated. Rollback = delete the 3 ids.
 *   - No fabrication: each row references an EXISTING domain + family (verified
 *     here); nothing is invented if a referenced parent is missing.
 *   - Idempotent: guards on whether all three ids already exist (no-op once present).
 */
import { Pool } from 'pg';

export type SeededCompetency = {
  id: string;
  canonicalName: string;
  slug: string;
  domainId: string;
  familyId: string;
  scientificType: string;
  definition: string;
  trainability: string;
  stabilityLevel: string;
  complexityLevel: number;
  leadershipRelevance: number;
};

// SME-authored — each is a genuinely DISTINCT construct from its adjacent genome
// neighbour (see file header), not a synonym of an existing row.
export const TASK161_COMPETENCIES: SeededCompetency[] = [
  {
    id: 'comp_verbal_communication',
    canonicalName: 'Verbal Communication',
    slug: 'verbal-communication',
    domainId: 'dom_interpersonal',
    familyId: 'fam_communication',
    scientificType: 'behavioral',
    definition:
      'Verbal Communication — conveying ideas clearly and persuasively through spoken, ' +
      'real-time exchange: structuring a point on the fly, reading and adapting to the ' +
      'listener, and handling interactive dialogue. The spoken/oral channel of the ' +
      'Communication family, parallel to (and distinct from) Written Communication.',
    trainability: 'high',
    stabilityLevel: 'state_like',
    complexityLevel: 2,
    leadershipRelevance: 0.65,
  },
  {
    id: 'comp_change_leadership',
    canonicalName: 'Change Leadership',
    slug: 'change-leadership',
    domainId: 'dom_strategic',
    familyId: 'fam_change_transformation',
    scientificType: 'cognitive',
    definition:
      'Change Leadership — setting direction through change and mobilising people ' +
      'emotionally and behaviourally toward a new future state: building urgency, ' +
      'aligning stakeholders, and sustaining momentum. Distinct from Change Management ' +
      '(planning and implementing the mechanics of change) and Change Advocacy ' +
      '(championing one specific change).',
    trainability: 'moderate',
    stabilityLevel: 'dynamic',
    complexityLevel: 4,
    leadershipRelevance: 0.95,
  },
  {
    id: 'comp_digital_fluency',
    canonicalName: 'Digital Fluency',
    slug: 'digital-fluency',
    domainId: 'dom_functional',
    familyId: 'fam_technical_adoption',
    scientificType: 'functional',
    definition:
      'Digital Fluency — demonstrated proficiency in confidently selecting and using ' +
      'digital tools, data, and platforms to accomplish work effectively, including ' +
      'navigating unfamiliar interfaces and combining tools productively. Distinct ' +
      'from Technology Adoption (the willingness/openness to embrace new technology); ' +
      'fluency is the capability itself, not the attitude toward it.',
    trainability: 'high',
    stabilityLevel: 'state_like',
    complexityLevel: 2,
    leadershipRelevance: 0.45,
  },
];

export type Task161SeedResult = {
  competencies: 'already_present' | 'seeded' | 'skipped_missing_parents';
  inserted: number;
  missingParents?: string[];
};

/**
 * Idempotent: inserts the three Task #161 genome competencies if absent. Each row
 * is verified to reference an existing domain + family; if any parent is missing
 * the seed is skipped (never fabricates a parent). ON CONFLICT (id) DO NOTHING.
 */
export async function ensureTask161GenomeCompetencies(pool: Pool): Promise<Task161SeedResult> {
  const ids = TASK161_COMPETENCIES.map((c) => c.id);

  // No-op fast path: all three already present.
  const present = await pool.query<{ id: string }>(
    `SELECT id FROM onto_competencies WHERE id = ANY($1::text[])`,
    [ids],
  );
  if (present.rows.length === ids.length) {
    return { competencies: 'already_present', inserted: 0 };
  }

  // Verify every referenced domain + family exists (never fabricate a parent).
  const domainIds = [...new Set(TASK161_COMPETENCIES.map((c) => c.domainId))];
  const familyIds = [...new Set(TASK161_COMPETENCIES.map((c) => c.familyId))];
  const [domRes, famRes] = await Promise.all([
    pool.query<{ id: string }>(`SELECT id FROM onto_domains WHERE id = ANY($1::text[])`, [domainIds]),
    pool.query<{ id: string }>(`SELECT id FROM onto_families WHERE id = ANY($1::text[])`, [familyIds]),
  ]);
  const haveDomains = new Set(domRes.rows.map((r) => r.id));
  const haveFamilies = new Set(famRes.rows.map((r) => r.id));
  const missingParents = [
    ...domainIds.filter((d) => !haveDomains.has(d)).map((d) => `domain:${d}`),
    ...familyIds.filter((f) => !haveFamilies.has(f)).map((f) => `family:${f}`),
  ];
  if (missingParents.length > 0) {
    return { competencies: 'skipped_missing_parents', inserted: 0, missingParents };
  }

  let inserted = 0;
  for (const c of TASK161_COMPETENCIES) {
    const r = await pool.query(
      `INSERT INTO onto_competencies
         (id, canonical_name, slug, domain_id, family_id, scientific_type, definition,
          trainability, stability_level, complexity_level, leadership_relevance,
          role_relevance, scoring_metadata, benchmark_metadata, legal_classification, version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
               '{"all":1.0}'::jsonb,
               '{"scale":"0-100","reverse":false}'::jsonb,
               '{"k_anonymity_min":30}'::jsonb,
               'developmental_aggregate', '1.0.0')
       ON CONFLICT (id) DO NOTHING`,
      [
        c.id, c.canonicalName, c.slug, c.domainId, c.familyId, c.scientificType,
        c.definition, c.trainability, c.stabilityLevel, c.complexityLevel, c.leadershipRelevance,
      ],
    );
    inserted += r.rowCount ?? 0;
  }

  return { competencies: inserted > 0 ? 'seeded' : 'already_present', inserted };
}
