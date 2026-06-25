/**
 * task138-competency-seed.ts — Task #138 (applied by Task #146)
 *
 * SINGLE source of truth for the Task #138 competency expansion seed. Consolidates the
 * logic that previously lived in three one-shot CLI scripts so it can run from BOTH:
 *   1. the CLI scripts (manual `npx tsx` run — see scripts/seed-task138-*.ts), and
 *   2. an idempotent, guarded backend-startup hook (`ensureTask138CompetencySeed`).
 *
 * WHY a startup hook (see .agents/memory/merged-task-data-not-in-live-db.md):
 *   A task merge carries CODE + migration DDL only — NOT seeded rows. The agent also cannot
 *   write to the production DB (read-only replica). So the ONLY way this data reaches the live
 *   app is a self-running, idempotent seeder on the live backend — exactly the pattern this
 *   codebase already uses (Task 81 region-native seed, occupation/ontology self-seeders). A
 *   single publish then activates it.
 *
 * WHAT IT SEEDS (three levers — see .agents/memory/competency-precise-scoring-blueprint-gate.md):
 *   1. role-DNA weights  — adds defensible genome competencies to the three bridge-reachable
 *                          roles' DNA (onto_role_weights, source='task138').
 *   2. competency Qs      — authors 3 behavioural MCQs per ADDITIONAL genome competency
 *                          (competency_question_templates, template_key 't138_…', approved) and
 *                          ties each to its competency (onto_competency_question_map, active).
 *   3. blueprint wiring   — adds those role-DNA comps (that now have approved questions) to each
 *                          role's served blueprint (onto_blueprint_competency_map, source='t138_sync').
 *
 * HONESTY / SAFETY CONTRACT:
 *   - Strictly ADDITIVE & reversible: every row carries a Task #138 provenance marker
 *     (source='task138' / template_key prefix 't138_' / source='t138'|'t138_sync'); rollback =
 *     delete-by-provenance. No existing weights, questions or maps are mutated.
 *   - No fabrication: a competency is only seeded if it exists in onto_competencies; a blueprint
 *     comp is only wired if it has an approved+active-mapped question; everything else stays
 *     unmeasured (null), never invented.
 *   - Idempotent: each step guards on its own provenance probe (no-op once present); a 2nd
 *     restart logs nothing. The CLI scripts force a re-run via the same functions.
 *   - The downstream consumption is flag-gated: precise employer matching reads this data only
 *     under employerCompetencyHiring; competency-runtime scoring under competencyRuntime.
 */
import { Pool } from 'pg';

// ---------------------------------------------------------------------------
// Lever 1 (role DNA): defensible, role-core competency assignments BEYOND the 33 role-DNA comps.
// ---------------------------------------------------------------------------
export type Assignment = {
  dnaProfileId: string;
  competencyId: string;
  weight: number;
  expectedLevel: number; // 1..5
  rationale: string;
};

export const ROLE_DNA_ASSIGNMENTS: Assignment[] = [
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

// ---------------------------------------------------------------------------
// Lever 2 (questions): 3 behavioural MCQs (foundational/intermediate/advanced) per ADDITIONAL comp.
// ---------------------------------------------------------------------------
export type Q = { d: 'foundational' | 'intermediate' | 'advanced'; stem: string; options: string[]; best: number };
export type Comp = { code: string; name: string; questions: Q[] };

export const COMPETENCY_QUESTIONS: Comp[] = [
  {
    code: 'comp_customer_focus', name: 'Customer Focus', questions: [
      { d: 'foundational', stem: 'A customer reports a problem with your product. What reflects strong customer focus?', options: ['Tell them it works fine for everyone else', 'Listen, understand their need, and help resolve it', 'Ignore it until they escalate', 'Blame them for using it wrong'], best: 1 },
      { d: 'intermediate', stem: 'You must choose between an internally convenient option and one customers prefer. How do you decide?', options: ['Always pick what is easiest internally', 'Weigh customer value seriously and advocate for their needs', 'Decide without considering customers', 'Ask the customer to adapt to your process'], best: 1 },
      { d: 'advanced', stem: 'Customer feedback contradicts a feature your team is invested in. What is the strongest customer-focused response?', options: ['Dismiss the feedback to protect the work', 'Investigate the underlying need and adapt the solution to serve it', 'Ship the feature regardless', 'Stop talking to customers'], best: 1 },
    ],
  },
  {
    code: 'comp_change_management', name: 'Change Management', questions: [
      { d: 'foundational', stem: 'A new process is being rolled out to your team. What supports effective change management?', options: ['Announce it once and expect compliance', 'Explain the why, address concerns, and support adoption', 'Force it without explanation', 'Let people opt out quietly'], best: 1 },
      { d: 'intermediate', stem: 'Some team members resist a needed change. What is the best approach?', options: ['Override them and push harder', 'Understand the resistance and involve them in shaping the change', 'Abandon the change', 'Ignore the resistance'], best: 1 },
      { d: 'advanced', stem: 'You are leading a major change across several teams with uncertain outcomes. What is most effective?', options: ['Mandate the change all at once with no feedback loop', 'Plan stages, communicate continuously, pilot, and adjust based on results', 'Keep the plan secret until launch', 'Let each team change however they like'], best: 1 },
    ],
  },
  {
    code: 'comp_negotiation', name: 'Negotiation', questions: [
      { d: 'foundational', stem: 'You and a colleague want different things from a shared resource. What reflects good negotiation?', options: ['Demand your way', 'Seek a solution that meets both parties’ core interests', 'Give up immediately', 'Avoid the conversation'], best: 1 },
      { d: 'intermediate', stem: 'A vendor’s terms do not fit your needs. How do you negotiate?', options: ['Accept the terms as given', 'Identify your priorities and trade-offs and propose alternatives', 'Threaten to walk away as the only tactic', 'Sign without reading'], best: 1 },
      { d: 'advanced', stem: 'You must negotiate scope across stakeholders with conflicting interests and limited resources. What is strongest?', options: ['Promise everyone everything', 'Surface interests, find creative trade-offs, and aim for a durable agreement', 'Let the most senior person dictate everything', 'Refuse to compromise on anything'], best: 1 },
    ],
  },
  {
    code: 'comp_creativity', name: 'Creativity', questions: [
      { d: 'foundational', stem: 'A familiar approach is not producing good results. What reflects creativity?', options: ['Keep repeating the same approach', 'Generate and try new ideas or angles', 'Wait for someone else to suggest something', 'Conclude the problem is unsolvable'], best: 1 },
      { d: 'intermediate', stem: 'You need fresh ideas for a stuck project. What is the best creative practice?', options: ['Pick the first idea immediately', 'Explore many options, defer judgment, then evaluate', 'Only consider ideas that already exist', 'Avoid brainstorming as a waste of time'], best: 1 },
      { d: 'advanced', stem: 'You must innovate within tight constraints (budget, time, rules). What demonstrates strong creativity?', options: ['Argue the constraints make innovation impossible', 'Use the constraints as a frame to find inventive, workable solutions', 'Ignore the constraints', 'Copy an existing solution without adaptation'], best: 1 },
    ],
  },
  {
    code: 'comp_commercial_awareness', name: 'Commercial Awareness', questions: [
      { d: 'foundational', stem: 'When proposing an initiative, what reflects commercial awareness?', options: ['Ignore cost and revenue implications', 'Consider how it affects revenue, cost, and market position', 'Focus only on internal preferences', 'Assume money is irrelevant'], best: 1 },
      { d: 'intermediate', stem: 'A competitor launches a similar product. What is the commercially aware response?', options: ['Ignore the market move', 'Assess the competitive impact and your differentiation', 'Immediately copy them', 'Cut your prices without analysis'], best: 1 },
      { d: 'advanced', stem: 'You must recommend where to invest limited funds for the best business return. What is strongest?', options: ['Pick the most interesting option', 'Compare market opportunity, margins, and risk to maximise value', 'Spread funds evenly regardless of return', 'Defer the decision indefinitely'], best: 1 },
    ],
  },
  {
    code: 'comp_delegation', name: 'Delegation', questions: [
      { d: 'foundational', stem: 'You are overloaded and a capable teammate has capacity. What reflects good delegation?', options: ['Do everything yourself', 'Assign suitable work clearly with the context they need', 'Dump tasks without explanation', 'Refuse help on principle'], best: 1 },
      { d: 'intermediate', stem: 'You delegated a task and it is not going as expected. What is the best response?', options: ['Take it back and do it yourself', 'Check in, clarify expectations, and provide support', 'Criticise them publicly', 'Ignore it until the deadline'], best: 1 },
      { d: 'advanced', stem: 'You want to grow your team while still hitting goals. What demonstrates strong delegation?', options: ['Delegate only trivial work', 'Delegate meaningful, stretch work with clear ownership and accountability', 'Keep all important work yourself', 'Delegate without any follow-up'], best: 1 },
    ],
  },
  {
    code: 'comp_developing_people', name: 'Developing People', questions: [
      { d: 'foundational', stem: 'A team member wants to grow but is unsure how. What reflects developing people?', options: ['Tell them growth is their problem', 'Discuss their goals and identify development opportunities', 'Ignore the request', 'Promise a promotion you cannot give'], best: 1 },
      { d: 'intermediate', stem: 'A high performer is ready for more responsibility. What is the best development action?', options: ['Keep them in the same role to avoid risk', 'Provide a stretch assignment with coaching and feedback', 'Promote them with no support', 'Wait until they ask repeatedly'], best: 1 },
      { d: 'advanced', stem: 'You manage people with very different strengths and aspirations. What demonstrates strong people development?', options: ['Apply the same plan to everyone', 'Tailor development to each person’s strengths, gaps, and goals', 'Develop only your favourites', 'Leave development to chance'], best: 1 },
    ],
  },
  {
    code: 'comp_constructive_feedback', name: 'Constructive Feedback', questions: [
      { d: 'foundational', stem: 'A colleague made an error you noticed. What reflects constructive feedback?', options: ['Say nothing to avoid awkwardness', 'Raise it privately, specifically, and with a path to improve', 'Criticise them in front of others', 'Complain about them to someone else'], best: 1 },
      { d: 'intermediate', stem: 'You need to give feedback that may be hard to hear. What is the best approach?', options: ['Soften it so much the point is lost', 'Be honest and specific while being respectful and solution-focused', 'Avoid giving it at all', 'List every fault you can think of'], best: 1 },
      { d: 'advanced', stem: 'A talented team member repeatedly resists feedback. What is the strongest response?', options: ['Stop giving them feedback', 'Build trust, link feedback to their goals, and be consistent and specific', 'Escalate to discipline immediately', 'Only give positive feedback'], best: 1 },
    ],
  },
  {
    code: 'comp_empathy', name: 'Empathy', questions: [
      { d: 'foundational', stem: 'A colleague seems stressed and withdrawn. What reflects empathy?', options: ['Ignore it as not your concern', 'Check in genuinely and try to understand their situation', 'Tell them to toughen up', 'Report them for low energy'], best: 1 },
      { d: 'intermediate', stem: 'A teammate reacts strongly to a decision you support. What is the empathetic response?', options: ['Dismiss their reaction as irrational', 'Seek to understand their perspective before responding', 'Argue them down', 'Avoid them'], best: 1 },
      { d: 'advanced', stem: 'You must deliver a decision that negatively affects people you lead. What shows strong empathy?', options: ['Communicate it coldly to stay detached', 'Acknowledge the impact, listen, and support them through it honestly', 'Hide the decision as long as possible', 'Pretend it has no downside'], best: 1 },
    ],
  },
  {
    code: 'comp_financial_acumen', name: 'Financial Acumen', questions: [
      { d: 'foundational', stem: 'You are reviewing a company’s financial statements. What reflects financial acumen?', options: ['Look only at revenue', 'Read income, balance sheet, and cash flow together to understand health', 'Assume profit equals cash', 'Skip the statements and guess'], best: 1 },
      { d: 'intermediate', stem: 'Two firms have similar revenue but very different debt levels. How do you assess them financially?', options: ['Treat them as equivalent', 'Analyse leverage, coverage, and liquidity to compare real risk', 'Prefer the one with more debt automatically', 'Ignore debt entirely'], best: 1 },
      { d: 'advanced', stem: 'A borrower shows strong profit but weak cash flow. What does sound financial analysis conclude?', options: ['Approve on profit alone', 'Probe the cash conversion and sustainability before judging repayment ability', 'Reject purely on the cash gap without analysis', 'Average the two and move on'], best: 1 },
    ],
  },
  {
    code: 'comp_enterprise_risk_management', name: 'Enterprise Risk Management', questions: [
      { d: 'foundational', stem: 'You identify a risk in a decision. What reflects good risk management?', options: ['Ignore it and hope', 'Assess its likelihood and impact and plan a response', 'Stop the work entirely out of fear', 'Hide it from stakeholders'], best: 1 },
      { d: 'intermediate', stem: 'A profitable opportunity carries significant downside risk. How do you handle it?', options: ['Take it without mitigation', 'Quantify the risk, weigh it against reward, and add controls', 'Reject all risky opportunities', 'Pass the decision to avoid blame'], best: 1 },
      { d: 'advanced', stem: 'Multiple correlated risks could compound across the portfolio. What is the strongest response?', options: ['Manage each risk in isolation', 'Assess interdependencies and concentration, and manage aggregate exposure', 'Assume diversification handles everything', 'Focus only on the largest single risk'], best: 1 },
    ],
  },
  {
    code: 'comp_ethical_decision_making', name: 'Ethical Decision Making', questions: [
      { d: 'foundational', stem: 'A choice would benefit you but slightly harm others unfairly. What reflects ethical decision making?', options: ['Take the benefit quietly', 'Weigh the impact on others and choose the fair option', 'Do it if no one will notice', 'Ask others to decide so you avoid responsibility'], best: 1 },
      { d: 'intermediate', stem: 'You are pressured to approve something that meets the letter but not the spirit of the rules. What do you do?', options: ['Approve since it is technically allowed', 'Consider the intent and consequences and decline if it is wrong', 'Approve and document nothing', 'Delay endlessly to avoid deciding'], best: 1 },
      { d: 'advanced', stem: 'An ethical course of action carries real business cost. What demonstrates strong ethical decision making?', options: ['Choose profit and rationalise it', 'Uphold the ethical standard, manage the cost transparently, and seek a legitimate path', 'Cut the corner and disclose only if caught', 'Let the most senior person decide so you are not accountable'], best: 1 },
    ],
  },
  {
    code: 'comp_conceptual_thinking', name: 'Conceptual Thinking', questions: [
      { d: 'foundational', stem: 'You face many scattered details. What reflects conceptual thinking?', options: ['List every detail without synthesis', 'Identify the underlying pattern or theme connecting them', 'Pick details at random', 'Ignore the details'], best: 1 },
      { d: 'intermediate', stem: 'A new situation resembles a past one in non-obvious ways. How do you apply conceptual thinking?', options: ['Treat it as entirely new', 'Recognise the underlying analogy and adapt relevant principles', 'Force the old solution unchanged', 'Avoid drawing any connections'], best: 1 },
      { d: 'advanced', stem: 'You must make sense of ambiguous, multi-source information to form a view. What is strongest?', options: ['Report the raw information as is', 'Synthesise it into a coherent framework that explains the situation', 'Pick one source and ignore the rest', 'Wait until everything is certain'], best: 1 },
    ],
  },
  {
    code: 'comp_balanced_judgment', name: 'Balanced Judgment', questions: [
      { d: 'foundational', stem: 'You must judge a situation with arguments on both sides. What reflects balanced judgment?', options: ['Decide on the first argument you hear', 'Weigh the evidence on each side before concluding', 'Pick the side you personally like', 'Refuse to decide'], best: 1 },
      { d: 'intermediate', stem: 'Strong evidence conflicts with your initial instinct. How do you exercise balanced judgment?', options: ['Stick with your instinct regardless', 'Weigh the evidence fairly and update your view as warranted', 'Discard the evidence', 'Flip-flop with every new opinion'], best: 1 },
      { d: 'advanced', stem: 'You must make a high-stakes call where evidence is mixed and incomplete. What is strongest?', options: ['Overweight the most recent or vivid input', 'Weigh competing evidence proportionately, note assumptions, and reach a defensible decision', 'Choose to avoid criticism rather than on merits', 'Defer indefinitely'], best: 1 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Lever 3 (blueprint wiring): three bridge-reachable roles only.
// ---------------------------------------------------------------------------
export const TARGET_ROLES = ['role_pm', 'role_eng_manager', 'role_credit_analyst'];

export interface RoleDnaSeedResult { inserted: number; skipped: number; summary: string[]; }
export interface QuestionSeedResult { templates: number; mapRows: number; skippedComps: number; }
export interface BlueprintSeedResult { blueprintsCreated: number; mapRows: number; skippedNoQ: number; summary: string[]; }

// ---------------------------------------------------------------------------
// Lever 1 — role-DNA weights.
// ---------------------------------------------------------------------------
export async function seedRoleDnaWeights(pool: Pool, apply: boolean): Promise<RoleDnaSeedResult> {
  const compIds = Array.from(new Set(ROLE_DNA_ASSIGNMENTS.map((a) => a.competencyId)));
  const compRes = await pool.query(`SELECT id FROM onto_competencies WHERE id = ANY($1::text[])`, [compIds]);
  const validComps = new Set<string>(compRes.rows.map((r: any) => r.id));

  const profIds = Array.from(new Set(ROLE_DNA_ASSIGNMENTS.map((a) => a.dnaProfileId)));
  const profRes = await pool.query(
    `SELECT id FROM onto_dna_profiles WHERE id = ANY($1::text[]) AND is_current = true`,
    [profIds],
  );
  const validProfiles = new Set<string>(profRes.rows.map((r: any) => r.id));

  let inserted = 0;
  let skipped = 0;
  const summary: string[] = [];

  for (const a of ROLE_DNA_ASSIGNMENTS) {
    if (!validComps.has(a.competencyId)) { summary.push(`SKIP ${a.competencyId} — not in onto_competencies`); skipped++; continue; }
    if (!validProfiles.has(a.dnaProfileId)) { summary.push(`SKIP ${a.dnaProfileId}/${a.competencyId} — DNA profile missing or not current`); skipped++; continue; }
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
      if (res.rowCount && res.rowCount > 0) { inserted++; summary.push(`ADD  ${a.dnaProfileId} += ${a.competencyId} (w=${a.weight}, lvl=${a.expectedLevel})`); }
      else { skipped++; summary.push(`KEEP ${a.dnaProfileId}/${a.competencyId} — already a role-DNA competency`); }
    } else {
      summary.push(`DRY  ${a.dnaProfileId} += ${a.competencyId} (w=${a.weight}, lvl=${a.expectedLevel})`);
      inserted++;
    }
  }
  return { inserted, skipped, summary };
}

// ---------------------------------------------------------------------------
// Lever 2 — competency questions + active map.
// ---------------------------------------------------------------------------
export async function seedCompetencyQuestions(pool: Pool, apply: boolean): Promise<QuestionSeedResult> {
  const ontoRes = await pool.query(`SELECT id FROM onto_competencies WHERE id = ANY($1::text[])`, [
    COMPETENCY_QUESTIONS.map((c) => c.code),
  ]);
  const ontoIds = new Set<string>(ontoRes.rows.map((r: any) => r.id));

  let templates = 0;
  let mapRows = 0;
  let skippedComps = 0;

  for (const comp of COMPETENCY_QUESTIONS) {
    if (!ontoIds.has(comp.code)) { skippedComps++; continue; }
    for (let i = 0; i < comp.questions.length; i++) {
      const q = comp.questions[i];
      const templateKey = `t138_${comp.code}_q${i + 1}`;
      const body = {
        prompt: q.stem,
        stem: q.stem,
        options: q.options,
        best_option: q.best,
        correct_index: q.best,
        rationale: 'Best answer reflects the competency-aligned behaviour; adjacent options are partially credited, off-target options score low.',
      };
      if (!apply) { templates++; continue; }
      const ins = await pool.query(
        `INSERT INTO competency_question_templates
           (template_key, competency_code, question_type, template_body, difficulty_band,
            language_policy, status, source, provenance, confidence_score, quality_review_status,
            reviewed_by, reviewed_at, notes)
         VALUES ($1,$2,'multiple_choice',$3::jsonb,$4,'{}'::jsonb,'approved','manual','curated_authored',0.7,'approved',
                 'task-138-curation', now(), 'Authored to extend precise per-competency scoring BEYOND the 33 role-DNA competencies (Task #138).')
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
  return { templates, mapRows, skippedComps };
}

// ---------------------------------------------------------------------------
// Lever 3 — blueprint wiring.
// ---------------------------------------------------------------------------
export async function seedBlueprintWiring(pool: Pool, apply: boolean): Promise<BlueprintSeedResult> {
  const dna = await pool.query<{ id: string; role_id: string }>(
    `SELECT id, role_id FROM onto_dna_profiles
      WHERE is_current AND role_id = ANY($1::text[]) ORDER BY id`,
    [TARGET_ROLES],
  );

  let blueprintsCreated = 0;
  let mapRows = 0;
  let skippedNoQ = 0;
  const summary: string[] = [];

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
      summary.push(`REUSE blueprint ${blueprintId} for ${roleId}`);
    } else {
      const role = await pool.query<{ id: string; title: string }>(
        `SELECT id, title FROM onto_roles WHERE id = $1`,
        [roleId],
      );
      if (role.rowCount === 0) { summary.push(`SKIP ${roleId}: role not in onto_roles`); continue; }
      const suffix = roleId.replace(/^role_/, '');
      blueprintId = `bp_${suffix}_t138`;
      const key = `${suffix}-t138`;
      const name = `${role.rows[0].title} Assessment`;
      if (apply) {
        await pool.query(
          `INSERT INTO onto_assessment_blueprints (id, blueprint_key, name, description, source_role_id, source, active)
           VALUES ($1,$2,$3,$4,$5,'t138',true)
           ON CONFLICT (id) DO NOTHING`,
          [blueprintId, key, name, `Auto-wired from Role DNA ${profile.id} (Task #138).`, roleId],
        );
      }
      blueprintsCreated++;
      summary.push(`CREATE blueprint ${blueprintId} for ${roleId}`);
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
    skippedNoQ += Number(noq.rows[0]?.n ?? 0);

    for (const r of wire.rows) {
      const reqLevel = r.expected_level != null && r.expected_level >= 1 && r.expected_level <= 5
        ? Math.round(r.expected_level) : 3;
      const weight = r.weight != null && r.weight > 0 ? r.weight : 1;
      if (apply) {
        await pool.query(
          `INSERT INTO onto_blueprint_competency_map
             (blueprint_id, competency_id, required_level, weight, criticality, source, active)
           SELECT $1::varchar, $2::varchar, $3::int, $4::numeric, 'important', 't138_sync', true
            WHERE NOT EXISTS (
              SELECT 1 FROM onto_blueprint_competency_map
               WHERE blueprint_id = $1::varchar AND competency_id = $2::varchar)`,
          [blueprintId, r.competency_id, reqLevel, weight],
        );
      }
      mapRows++;
    }
    if (wire.rows.length > 0) {
      summary.push(`  ${blueprintId}: +${wire.rows.length} comps [${wire.rows.map((x) => x.competency_id).join(', ')}]`);
    }
  }
  return { blueprintsCreated, mapRows, skippedNoQ, summary };
}

// ---------------------------------------------------------------------------
// Startup hook — idempotent, guarded, never throws. Runs the three levers in order; each step
// no-ops once its own provenance is present. Downstream consumption stays flag-gated.
// ---------------------------------------------------------------------------
export interface EnsureTask138Summary {
  roleWeights: 'seeded' | 'already_present' | 'error';
  questions: 'seeded' | 'already_present' | 'error';
  blueprints: 'seeded' | 'already_present' | 'error';
  detail?: { roleWeights?: RoleDnaSeedResult; questions?: QuestionSeedResult; blueprints?: BlueprintSeedResult };
}

async function scalarCount(pool: Pool, sql: string, params: any[] = []): Promise<number> {
  const r = await pool.query<{ n: string }>(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}

export async function ensureTask138CompetencySeed(pool: Pool): Promise<EnsureTask138Summary> {
  const out: EnsureTask138Summary = { roleWeights: 'already_present', questions: 'already_present', blueprints: 'already_present', detail: {} };

  // (1) Role-DNA weights — guard on source='task138'.
  try {
    const n = await scalarCount(pool, `SELECT count(*) AS n FROM onto_role_weights WHERE source='task138'`);
    if (n > 0) out.roleWeights = 'already_present';
    else { out.detail!.roleWeights = await seedRoleDnaWeights(pool, true); out.roleWeights = 'seeded'; }
  } catch (err) { out.roleWeights = 'error'; console.warn('[task138-seed] role-DNA weights error:', (err as Error)?.message ?? err); }

  // (2) Competency questions + map — guard on the 't138_' template_key prefix.
  try {
    const n = await scalarCount(pool, `SELECT count(*) AS n FROM competency_question_templates WHERE template_key LIKE 't138\\_%'`);
    if (n > 0) out.questions = 'already_present';
    else { out.detail!.questions = await seedCompetencyQuestions(pool, true); out.questions = 'seeded'; }
  } catch (err) { out.questions = 'error'; console.warn('[task138-seed] competency questions error:', (err as Error)?.message ?? err); }

  // (3) Blueprint wiring — guard on source='t138_sync' map rows (or created t138 blueprints).
  try {
    const n = await scalarCount(
      pool,
      `SELECT (SELECT count(*) FROM onto_blueprint_competency_map WHERE source='t138_sync')
            + (SELECT count(*) FROM onto_assessment_blueprints WHERE source='t138') AS n`,
    );
    if (n > 0) out.blueprints = 'already_present';
    else { out.detail!.blueprints = await seedBlueprintWiring(pool, true); out.blueprints = 'seeded'; }
  } catch (err) { out.blueprints = 'error'; console.warn('[task138-seed] blueprint wiring error:', (err as Error)?.message ?? err); }

  return out;
}
