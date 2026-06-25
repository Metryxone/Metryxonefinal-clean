/**
 * Task #145 — self-running, idempotent activation of the Backend Engineer /
 * Senior Backend Engineer curated Role DNA so the employer competency match
 * reaches PRECISE per-competency scoring for those two roles.
 *
 * WHY THIS IS A BOOT SEEDER (not just CLI scripts)
 * ------------------------------------------------
 * A merged task-agent data backfill only writes to the isolated env DB; a merge
 * carries CODE + migration DDL but NOT data rows (see
 * .agents/memory/merged-task-data-not-in-live-db.md). Shipping CLI seed scripts
 * that nobody runs in prod leaves the live DB unactivated. So — exactly like
 * `role-library-expansion.ts` — this is the single source of truth for the
 * activation and runs fire-and-forget at boot (index.ts), making `publish`/restart
 * alone activate it in production. The CLI scripts in scripts/seed-task145-*.ts are
 * thin wrappers over the step functions exported here, so there is no drift.
 *
 * The activation has four idempotent steps:
 *   1. ensureLibraryRoles  — ROLE_BE_ENG / ROLE_SR_BE_ENG exist in ont_roles
 *      (the O*NET library side the employer match resolves a job title to). Without
 *      these, the bridge below has nothing to point at.
 *   2. seedBridge          — point map_ont_onto_role.role_be_eng / role_sr_be_eng
 *      at those dedicated ont_roles ids so the match chain
 *      (jobTitle -> resolveBestOntRole -> ont_roles -> curatedLayerFor -> onto_role_weights)
 *      reaches the curated Role DNA instead of staying domain_proxy.
 *   3. seedCompetencyQuestions — author + approve + active-map 3 behavioural MCQs
 *      per role-DNA competency that lacked questions (lever 1 of the precise-scoring
 *      gate, see .agents/memory/competency-precise-scoring-blueprint-gate.md).
 *   4. seedBlueprintWiring — wire those competencies into each role's blueprint
 *      competency map (lever 2) so generateAssessment SERVES the comp-tagged
 *      questions and scoreAssessment produces PRECISE scores.
 *
 * Honesty / safety: every write is additive + idempotent (ON CONFLICT / NOT EXISTS),
 * provenance-tagged ('t145' / 't145_sync' / template_key 't145_*'), reversible, and
 * never fabricates — each step verifies its prerequisites EXIST and skips + reports
 * anything missing (a competency absent from onto_competencies, a role absent from
 * onto_roles, a DNA comp with no approved question stays unmeasured).
 */
import type { Pool } from 'pg';

const ROLE_FAMILY_CODE = 'RF_SOFTENGG';

/** onto_role (curated) -> ont_role (library) the bridge should point at. */
export const BRIDGE: { ontoRoleId: string; ontRoleCode: string; title: string; seniority: string }[] = [
  { ontoRoleId: 'role_be_eng', ontRoleCode: 'ROLE_BE_ENG', title: 'Backend Engineer', seniority: 'mid' },
  { ontoRoleId: 'role_sr_be_eng', ontRoleCode: 'ROLE_SR_BE_ENG', title: 'Senior Backend Engineer', seniority: 'senior' },
];

export const TARGET_ROLES = BRIDGE.map((b) => b.ontoRoleId);

type Q = { d: 'foundational' | 'intermediate' | 'advanced'; stem: string; options: string[]; best: number };
type Comp = { code: string; name: string; questions: Q[] };

/**
 * The role-DNA competencies (for Backend / Senior Backend Engineer) that lacked
 * questions. accountability / active_listening / adaptability already had approved
 * questions and are intentionally NOT included here.
 */
export const COMPS: Comp[] = [
  {
    code: 'comp_systems_thinking', name: 'Systems Thinking', questions: [
      { d: 'foundational', stem: 'A change you make in one part of a system causes an unexpected problem elsewhere. What reflects systems thinking?', options: ['Treat the two parts as unrelated', 'Map how the parts connect and trace the ripple effects before acting', 'Fix only the visible symptom', 'Assume the second problem is a coincidence'], best: 1 },
      { d: 'intermediate', stem: 'You must improve a process that touches several teams and tools. What is the strongest systems approach?', options: ['Optimise your own step in isolation', 'Understand the whole flow, dependencies, and feedback loops, then optimise for the overall outcome', 'Change everything at once and see what happens', 'Ignore downstream effects'], best: 1 },
      { d: 'advanced', stem: 'A recurring failure keeps reappearing despite repeated point fixes. What demonstrates strong systems thinking?', options: ['Apply the same point fix again', 'Identify the underlying structure and feedback loops driving the recurrence and change those', 'Blame the people involved', 'Accept the failure as unavoidable'], best: 1 },
    ],
  },
  {
    code: 'comp_collaboration', name: 'Collaboration', questions: [
      { d: 'foundational', stem: 'A teammate needs input to finish their part of a shared task. What reflects good collaboration?', options: ['Wait until they ask twice', 'Share what they need promptly and offer to help', 'Focus only on your own work', 'Tell them it is not your responsibility'], best: 1 },
      { d: 'intermediate', stem: 'Two people on your team disagree on an approach and progress has stalled. What is the collaborative response?', options: ['Pick a side to end it quickly', 'Help surface both views, find common ground, and agree on a path together', 'Let them sort it out alone', 'Escalate immediately without trying to resolve it'], best: 1 },
      { d: 'advanced', stem: 'You are delivering a goal that depends on several teams with different priorities. What demonstrates strong collaboration?', options: ['Push your priority regardless of theirs', 'Align on shared objectives, coordinate dependencies, and keep everyone informed', 'Work in isolation and integrate at the end', 'Assume the other teams will adapt to you'], best: 1 },
    ],
  },
  {
    code: 'comp_learning_agility', name: 'Learning Agility', questions: [
      { d: 'foundational', stem: 'You are assigned work using an unfamiliar tool. What reflects learning agility?', options: ['Refuse until someone trains you fully', 'Actively learn it through docs, practice, and asking targeted questions', 'Avoid the task', 'Use a familiar tool even if it does not fit'], best: 1 },
      { d: 'intermediate', stem: 'Feedback shows your usual method is no longer effective. What is the agile-learner response?', options: ['Keep using the familiar method', 'Unlearn the old habit, try a better approach, and adjust based on results', 'Dismiss the feedback', 'Wait for the problem to resolve itself'], best: 1 },
      { d: 'advanced', stem: 'You enter a domain you know little about, under time pressure. What demonstrates strong learning agility?', options: ['Pretend you already understand it', 'Rapidly build a working model, test assumptions, and refine as you learn', 'Delay all decisions until you are an expert', 'Copy another domain without checking it fits'], best: 1 },
    ],
  },
  {
    code: 'comp_emotional_regulation', name: 'Emotional Regulation', questions: [
      { d: 'foundational', stem: 'You receive frustrating news in the middle of a busy day. What reflects emotional regulation?', options: ['React impulsively to whoever is nearest', 'Notice the reaction, pause, and respond calmly once composed', 'Suppress it and let it build up', 'Take it out on your work'], best: 1 },
      { d: 'intermediate', stem: 'A tense meeting is escalating and you feel your stress rising. What is the best regulated response?', options: ['Match the rising tension', 'Stay composed, slow the pace, and steer toward a constructive focus', 'Shut down and disengage', 'Leave abruptly without explanation'], best: 1 },
      { d: 'advanced', stem: 'You are under sustained pressure and others look to you to stay steady. What demonstrates strong emotional regulation?', options: ['Let your stress set the tone for the team', 'Manage your own state deliberately so you can think clearly and keep others grounded', 'Hide all pressure until you burn out', 'Make high-stakes calls while reactive'], best: 1 },
    ],
  },
  {
    code: 'comp_coaching', name: 'Coaching', questions: [
      { d: 'foundational', stem: 'A teammate asks how to solve a problem you have solved before. What reflects a coaching approach?', options: ['Just give them the answer to save time', 'Ask guiding questions that help them reach the solution and understand why', 'Tell them to figure it out alone', 'Do it for them'], best: 1 },
      { d: 'intermediate', stem: 'Someone you support keeps making the same mistake. What is the strongest coaching response?', options: ['Repeat the instruction more firmly', 'Help them see the pattern, build the underlying skill, and practise it', 'Take the work away from them', 'Ignore it and hope it improves'], best: 1 },
      { d: 'advanced', stem: 'You are developing a capable person toward greater independence. What demonstrates strong coaching?', options: ['Keep directing every decision', 'Set goals together, ask powerful questions, give feedback, and gradually step back', 'Withdraw support entirely and let them sink or swim', 'Only praise and never challenge'], best: 1 },
    ],
  },
  {
    code: 'comp_strategic_thinking', name: 'Strategic Thinking', questions: [
      { d: 'foundational', stem: 'You are choosing what to work on next. What reflects strategic thinking?', options: ['Pick whatever is easiest', 'Choose what best advances the longer-term goal and priorities', 'Do tasks in the order they arrived', 'Wait to be told'], best: 1 },
      { d: 'intermediate', stem: 'A short-term win would set back a more important long-term objective. How do you decide strategically?', options: ['Always take the immediate win', 'Weigh the trade-off against the long-term goal and choose accordingly', 'Ignore the long-term goal', 'Defer the decision indefinitely'], best: 1 },
      { d: 'advanced', stem: 'You must set direction amid uncertainty and limited resources. What demonstrates strong strategic thinking?', options: ['React to whatever is loudest each week', 'Define a clear thesis, focus resources on the highest-leverage bets, and adapt as you learn', 'Try to do everything at once', 'Copy a competitor without analysis'], best: 1 },
    ],
  },
  {
    code: 'comp_persuasion', name: 'Persuasion', questions: [
      { d: 'foundational', stem: 'You want a colleague to support your proposal. What reflects effective persuasion?', options: ['Pressure them into agreeing', 'Explain the benefits in terms they care about and address their concerns', 'Assume they should just agree', 'Hide the downsides'], best: 1 },
      { d: 'intermediate', stem: 'A stakeholder is skeptical of your recommendation. What is the strongest persuasive approach?', options: ['Repeat your point louder', 'Understand their objections, bring relevant evidence, and connect to their priorities', 'Dismiss their skepticism', 'Go around them quietly'], best: 1 },
      { d: 'advanced', stem: 'You need buy-in from several parties with competing interests. What demonstrates strong persuasion?', options: ['Tell each party only what they want to hear', 'Build a credible, honest case that frames shared value and earns genuine commitment', 'Force a decision by authority alone', 'Avoid the difficult stakeholders'], best: 1 },
    ],
  },
];

const EXPECTED_TEMPLATES = COMPS.reduce((n, c) => n + c.questions.length, 0);

export interface RoleBridgeActivationResult {
  ok: boolean;
  noop: boolean;
  library_roles_inserted: number;
  bridge_rows_set: number;
  bridge_rows_skipped: number;
  templates_upserted: number;
  question_map_rows: number;
  comps_skipped: number;
  blueprints_created: number;
  blueprint_comp_rows: number;
  dna_comps_without_questions: number;
  notes: string[];
}

/**
 * Step 1 — ensure the dedicated library roles exist in ont_roles. is_active is set
 * explicitly true (the bridge resolves on `is_active = true`) AND status published,
 * mirroring ontology-seed.ts. Skips (reports) if the role family is missing.
 */
export async function ensureLibraryRoles(pool: Pool): Promise<{ inserted: number; notes: string[] }> {
  const notes: string[] = [];
  const fam = await pool.query<{ id: number }>(
    `SELECT id FROM ont_role_families WHERE code = $1`,
    [ROLE_FAMILY_CODE],
  );
  const familyId = fam.rowCount && fam.rowCount > 0 ? fam.rows[0].id : null;
  if (familyId == null) {
    notes.push(`ensureLibraryRoles: role family ${ROLE_FAMILY_CODE} not found — library roles skipped`);
    return { inserted: 0, notes };
  }
  let inserted = 0;
  for (const r of BRIDGE) {
    const ins = await pool.query(
      `INSERT INTO ont_roles (code, title, role_family_id, seniority_level, is_leadership, is_active, status)
       VALUES ($1,$2,$3,$4,false,true,'published')
       ON CONFLICT (code) DO NOTHING
       RETURNING id`,
      [r.ontRoleCode, r.title, familyId, r.seniority],
    );
    if (ins.rowCount && ins.rowCount > 0) inserted++;
  }
  return { inserted, notes };
}

/**
 * Step 2 — point the curated bridge rows at the dedicated library roles. Only fills
 * a NULL/wrong ont_role_id (or creates the bridge row if absent). Idempotent.
 */
export async function seedBridge(pool: Pool): Promise<{ set: number; skipped: number; notes: string[] }> {
  const notes: string[] = [];
  let set = 0;
  let skipped = 0;
  for (const b of BRIDGE) {
    const role = await pool.query<{ id: number }>(
      `SELECT id FROM ont_roles WHERE code = $1 AND is_active = true`,
      [b.ontRoleCode],
    );
    if (role.rowCount === 0) {
      notes.push(`seedBridge: ${b.ontoRoleId} skipped — ont_roles ${b.ontRoleCode} not found`);
      skipped++;
      continue;
    }
    const ontId = role.rows[0].id;
    const existing = await pool.query<{ ont_role_id: number | null }>(
      `SELECT ont_role_id FROM map_ont_onto_role WHERE onto_role_id = $1`,
      [b.ontoRoleId],
    );
    if (existing.rowCount === 0) {
      await pool.query(
        `INSERT INTO map_ont_onto_role (onto_role_id, ont_role_id, ont_role_code, match_method, confidence, verified, notes)
         VALUES ($1,$2,$3,'exact_title','high',true,'Task #145: bridge to dedicated curated role')
         ON CONFLICT (onto_role_id) DO UPDATE SET
           ont_role_id = EXCLUDED.ont_role_id, ont_role_code = EXCLUDED.ont_role_code,
           match_method = EXCLUDED.match_method, confidence = EXCLUDED.confidence,
           verified = EXCLUDED.verified, notes = EXCLUDED.notes, updated_at = now()`,
        [b.ontoRoleId, ontId, b.ontRoleCode],
      );
      set++;
      continue;
    }
    if (existing.rows[0].ont_role_id === ontId) continue; // already bridged
    await pool.query(
      `UPDATE map_ont_onto_role
          SET ont_role_id = $2, ont_role_code = $3, match_method = 'exact_title',
              confidence = 'high', verified = true,
              notes = 'Task #145: bridge to dedicated curated role', updated_at = now()
        WHERE onto_role_id = $1`,
      [b.ontoRoleId, ontId, b.ontRoleCode],
    );
    set++;
  }
  return { set, skipped, notes };
}

/**
 * Step 3 — author + approve + active-map the per-competency MCQs. Idempotent on
 * template_key. Only authors competencies that EXIST in onto_competencies.
 */
export async function seedCompetencyQuestions(
  pool: Pool,
): Promise<{ templates: number; mapRows: number; skippedComps: number; notes: string[] }> {
  const notes: string[] = [];
  const ontoRes = await pool.query(`SELECT id FROM onto_competencies WHERE id = ANY($1::text[])`, [
    COMPS.map((c) => c.code),
  ]);
  const ontoIds = new Set<string>(ontoRes.rows.map((r: any) => r.id));

  let templates = 0;
  let mapRows = 0;
  let skippedComps = 0;

  for (const comp of COMPS) {
    if (!ontoIds.has(comp.code)) {
      notes.push(`seedCompetencyQuestions: ${comp.code} skipped — not in onto_competencies`);
      skippedComps++;
      continue;
    }
    for (let i = 0; i < comp.questions.length; i++) {
      const q = comp.questions[i];
      const templateKey = `t145_${comp.code}_q${i + 1}`;
      const body = {
        prompt: q.stem,
        stem: q.stem,
        options: q.options,
        best_option: q.best,
        correct_index: q.best,
        rationale: 'Best answer reflects the competency-aligned behaviour; adjacent options are partially credited, off-target options score low.',
      };
      const ins = await pool.query(
        `INSERT INTO competency_question_templates
           (template_key, competency_code, question_type, template_body, difficulty_band,
            language_policy, status, source, provenance, confidence_score, quality_review_status,
            reviewed_by, reviewed_at, notes)
         VALUES ($1,$2,'multiple_choice',$3::jsonb,$4,'{}'::jsonb,'approved','manual','curated_authored',0.7,'approved',
                 'task-145-curation', now(), 'Authored to extend precise per-competency scoring to Backend / Senior Backend Engineer role DNA (Task #145).')
         ON CONFLICT (template_key) DO UPDATE SET
           competency_code = EXCLUDED.competency_code,
           template_body   = EXCLUDED.template_body,
           difficulty_band = EXCLUDED.difficulty_band,
           status          = 'approved',
           quality_review_status = 'approved',
           updated_at      = now()
         RETURNING id`,
        [templateKey, comp.code, JSON.stringify(body), q.d],
      );
      const qid = ins.rows[0].id as string;
      templates++;
      const mres = await pool.query(
        `INSERT INTO onto_competency_question_map (competency_id, question_id, source, active)
         SELECT $1::varchar,$2::uuid,'curated',true
         WHERE NOT EXISTS (
           SELECT 1 FROM onto_competency_question_map WHERE competency_id=$1::varchar AND question_id=$2::uuid)
         RETURNING id`,
        [comp.code, qid],
      );
      if (mres.rowCount && mres.rowCount > 0) mapRows++;
      else {
        await pool.query(
          `UPDATE onto_competency_question_map SET active=true, updated_at=now()
            WHERE competency_id=$1 AND question_id=$2 AND active=false`,
          [comp.code, qid],
        );
      }
    }
  }
  return { templates, mapRows, skippedComps, notes };
}

/**
 * Step 4 — wire the role-DNA competencies (that have approved + active questions)
 * into each role's blueprint competency map. Reuses the role's canonical blueprint;
 * creates bp_<role>_t145 only if none exists. Idempotent (NOT EXISTS).
 */
export async function seedBlueprintWiring(
  pool: Pool,
): Promise<{ blueprintsCreated: number; mapInserted: number; dnaCompsNoQ: number; notes: string[] }> {
  const notes: string[] = [];
  const dna = await pool.query<{ id: string; role_id: string }>(
    `SELECT id, role_id FROM onto_dna_profiles
      WHERE is_current AND role_id = ANY($1::text[]) ORDER BY id`,
    [TARGET_ROLES],
  );

  let blueprintsCreated = 0;
  let mapInserted = 0;
  let dnaCompsNoQ = 0;

  for (const profile of dna.rows) {
    const roleId = profile.role_id;
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
      if (role.rowCount === 0) { notes.push(`seedBlueprintWiring: ${roleId} skipped — not in onto_roles`); continue; }
      const suffix = roleId.replace(/^role_/, '');
      blueprintId = `bp_${suffix}_t145`;
      const key = `${suffix}-t145`;
      const name = `${role.rows[0].title} Assessment`;
      await pool.query(
        `INSERT INTO onto_assessment_blueprints (id, blueprint_key, name, description, source_role_id, source, active)
         VALUES ($1,$2,$3,$4,$5,'t145',true)
         ON CONFLICT (id) DO NOTHING`,
        [blueprintId, key, name, `Auto-wired from Role DNA ${profile.id} (Task #145).`, roleId],
      );
      blueprintsCreated++;
    }

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

    const noq = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM onto_role_weights w
        WHERE w.dna_profile_id = $1
          AND NOT EXISTS (SELECT 1 FROM onto_competency_question_map m
                           WHERE m.competency_id = w.competency_id AND m.active)`,
      [profile.id],
    );
    dnaCompsNoQ += Number(noq.rows[0]?.n ?? 0);

    for (const r of wire.rows) {
      const reqLevel = r.expected_level != null && r.expected_level >= 1 && r.expected_level <= 5
        ? Math.round(r.expected_level) : 3;
      const weight = r.weight != null && r.weight > 0 ? r.weight : 1;
      await pool.query(
        `INSERT INTO onto_blueprint_competency_map
           (blueprint_id, competency_id, required_level, weight, criticality, source, active)
         SELECT $1::varchar, $2::varchar, $3::int, $4::numeric, 'important', 't145_sync', true
          WHERE NOT EXISTS (
            SELECT 1 FROM onto_blueprint_competency_map
             WHERE blueprint_id = $1::varchar AND competency_id = $2::varchar)`,
        [blueprintId, r.competency_id, reqLevel, weight],
      );
      mapInserted++;
    }
  }
  return { blueprintsCreated, mapInserted, dnaCompsNoQ, notes };
}

/** Fast-path probe: true when the activation is already fully present. */
async function probeAlreadyActivated(pool: Pool): Promise<boolean> {
  try {
    const bridged = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM map_ont_onto_role WHERE onto_role_id = ANY($1::text[]) AND ont_role_id IS NOT NULL`,
      [TARGET_ROLES],
    );
    const tmpl = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM competency_question_templates WHERE template_key LIKE 't145\\_%'`,
    );
    const bp = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM onto_blueprint_competency_map WHERE source = 't145_sync'`,
    );
    return (
      Number(bridged.rows[0].n) >= TARGET_ROLES.length &&
      Number(tmpl.rows[0].n) >= EXPECTED_TEMPLATES &&
      Number(bp.rows[0].n) > 0
    );
  } catch {
    return false; // tables not present yet → run normally
  }
}

/**
 * Orchestrate the full activation. Idempotent + fire-and-forget safe. Fast-path
 * no-ops once fully present (a warm restart logs "already present").
 */
export async function runRoleBridgeActivation(pool: Pool): Promise<RoleBridgeActivationResult> {
  if (await probeAlreadyActivated(pool)) {
    return {
      ok: true, noop: true,
      library_roles_inserted: 0, bridge_rows_set: 0, bridge_rows_skipped: 0,
      templates_upserted: 0, question_map_rows: 0, comps_skipped: 0,
      blueprints_created: 0, blueprint_comp_rows: 0, dna_comps_without_questions: 0,
      notes: [],
    };
  }

  const notes: string[] = [];
  const lib = await ensureLibraryRoles(pool);
  notes.push(...lib.notes);
  const bridge = await seedBridge(pool);
  notes.push(...bridge.notes);
  const questions = await seedCompetencyQuestions(pool);
  notes.push(...questions.notes);
  const wiring = await seedBlueprintWiring(pool);
  notes.push(...wiring.notes);

  return {
    ok: true, noop: false,
    library_roles_inserted: lib.inserted,
    bridge_rows_set: bridge.set,
    bridge_rows_skipped: bridge.skipped,
    templates_upserted: questions.templates,
    question_map_rows: questions.mapRows,
    comps_skipped: questions.skippedComps,
    blueprints_created: wiring.blueprintsCreated,
    blueprint_comp_rows: wiring.mapInserted,
    dna_comps_without_questions: wiring.dnaCompsNoQ,
    notes,
  };
}
