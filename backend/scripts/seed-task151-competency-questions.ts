/**
 * Task #151 — author per-competency questions for the engineering role-DNA
 * competencies (QA / DevOps / Frontend / Full Stack / Software / Senior Software
 * Engineer) that did not yet have any approved + active-mapped question.
 *
 * This is lever 1 of the two-lever rule (see
 * .agents/memory/competency-precise-scoring-blueprint-gate.md): a competency only
 * yields a PRECISE (direct) employer score when the served assessment includes an
 * APPROVED template whose competency_code equals the comp_* id AND an ACTIVE row in
 * onto_competency_question_map ties it to that competency. Lever 2 (role-DNA
 * membership + blueprint serving) is handled by seed-task151-blueprint-wiring.ts.
 * (Role-DNA weights for all six roles already exist in onto_role_weights.)
 *
 * It authors 3 defensible behavioural MCQs (foundational/intermediate/advanced)
 * for each competency below. Only the role-DNA competencies that LACKED questions
 * are included; competencies that already had approved questions (adaptability)
 * are intentionally untouched.
 *
 * Idempotent (ON CONFLICT on template_key); reversible (all rows carry the `t151_`
 * template_key prefix, source='manual', provenance='curated_authored'). No
 * fabrication: only real genome competencies (verified present in
 * onto_competencies) are authored. Run with --apply to write; default is a dry run.
 */
import { Pool } from 'pg';

type Q = { d: 'foundational' | 'intermediate' | 'advanced'; stem: string; options: string[]; best: number };
type Comp = { code: string; name: string; questions: Q[] };

const COMPS: Comp[] = [
  {
    code: 'comp_quality_assurance', name: 'Quality Assurance', questions: [
      { d: 'foundational', stem: 'You are about to sign off on work before it ships. What reflects good quality assurance?', options: ['Ship it and fix issues if anyone complains', 'Check it against clear acceptance criteria and verify it behaves as intended', 'Assume it works because it looked fine while building it', 'Skip checks to meet the deadline'], best: 1 },
      { d: 'intermediate', stem: 'A defect slipped through to a customer. What is the strongest quality-assurance response?', options: ['Patch that one defect and move on', 'Fix it, then add a check that catches this class of defect before release in future', 'Blame whoever wrote it', 'Tighten nothing and hope it does not recur'], best: 1 },
      { d: 'advanced', stem: 'Quality keeps slipping under release pressure. What demonstrates strong quality assurance?', options: ['Lower the bar so more passes', 'Build quality gates into the process so standards hold even under pressure', 'Rely on heroic last-minute testing each time', 'Test only the parts that are easy to test'], best: 1 },
    ],
  },
  {
    code: 'comp_attention_to_detail', name: 'Attention to Detail', questions: [
      { d: 'foundational', stem: 'You are reviewing a document before sending it. What reflects attention to detail?', options: ['Skim it quickly and send', 'Read it carefully for errors, inconsistencies, and missing information', 'Trust that it is fine', 'Only check the first line'], best: 1 },
      { d: 'intermediate', stem: 'A small inconsistency in the data looks unimportant. What is the most detail-oriented response?', options: ['Ignore it as too minor to matter', 'Investigate it — small inconsistencies often signal a larger underlying issue', 'Delete the row so it looks clean', 'Assume someone else will catch it'], best: 1 },
      { d: 'advanced', stem: 'You handle complex work where small mistakes compound. What demonstrates strong attention to detail?', options: ['Work fast and accept some errors', 'Build systematic checks and reviews so precision is maintained without slowing to a crawl', 'Check everything manually every time, however long it takes', 'Detail only the final step'], best: 1 },
    ],
  },
  {
    code: 'comp_problem_solving', name: 'Problem-Solving', questions: [
      { d: 'foundational', stem: 'You hit a problem you have not seen before. What reflects good problem-solving?', options: ['Give up and escalate immediately', 'Define the problem clearly, explore options, and test a solution', 'Try random fixes until one works', 'Wait for the problem to disappear'], best: 1 },
      { d: 'intermediate', stem: 'Your first solution did not work. What is the strongest problem-solving response?', options: ['Repeat the same approach harder', 'Diagnose why it failed, form a new hypothesis, and try a different approach', 'Conclude the problem is unsolvable', 'Switch to an unrelated task'], best: 1 },
      { d: 'advanced', stem: 'You face an ambiguous problem with several plausible causes. What demonstrates strong problem-solving?', options: ['Pick the first plausible cause and act', 'Break it down, isolate variables, and systematically narrow to the root cause', 'Fix every possible cause at once', 'Wait until the cause becomes obvious'], best: 1 },
    ],
  },
  {
    code: 'comp_analytical_thinking', name: 'Analytical Thinking', questions: [
      { d: 'foundational', stem: 'You are given a set of numbers and asked what they mean. What reflects analytical thinking?', options: ['Guess based on a gut feeling', 'Break the data down, look for patterns, and draw a supported conclusion', 'Report the raw numbers with no interpretation', 'Pick the conclusion you hoped for'], best: 1 },
      { d: 'intermediate', stem: 'Two metrics seem to contradict each other. What is the strongest analytical response?', options: ['Trust the metric you prefer', 'Examine how each is defined and measured to understand why they differ', 'Average them together', 'Ignore both'], best: 1 },
      { d: 'advanced', stem: 'You must reach a decision from incomplete and noisy information. What demonstrates strong analytical thinking?', options: ['Wait for perfect data', 'Identify the key drivers, reason about uncertainty, and make a defensible inference', 'Decide purely on instinct', 'Pick whichever option is easiest to justify later'], best: 1 },
    ],
  },
  {
    code: 'comp_communication', name: 'Communication', questions: [
      { d: 'foundational', stem: 'You need to share an update with a colleague. What reflects good communication?', options: ['Send a vague message and assume they understand', 'Be clear, relevant, and check they have what they need', 'Use jargon to sound expert', 'Wait until they ask'], best: 1 },
      { d: 'intermediate', stem: 'You must explain something technical to a non-technical audience. What is the strongest approach?', options: ['Use full technical detail regardless', 'Adapt the message to their level using plain language and relevant examples', 'Skip the explanation entirely', 'Tell them it is too complex to explain'], best: 1 },
      { d: 'advanced', stem: 'A message was misunderstood and caused confusion. What demonstrates strong communication?', options: ['Repeat the same message verbatim', 'Clarify, confirm understanding, and adjust how you communicate to prevent recurrence', 'Blame the audience for not listening', 'Stop communicating to avoid further confusion'], best: 1 },
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
    code: 'comp_technical_competence', name: 'Technical Competence', questions: [
      { d: 'foundational', stem: 'You are asked to use a core tool of your craft. What reflects technical competence?', options: ['Avoid it and use a workaround', 'Apply it correctly and know why it is the right tool for the job', 'Use it without understanding what it does', 'Wait for someone else to do it'], best: 1 },
      { d: 'intermediate', stem: 'Your usual technical approach is not producing a reliable result. What is the strongest response?', options: ['Keep applying it unchanged', 'Diagnose the limitation and apply a more suitable technique', 'Assume the tools are broken', 'Hand the task off without explanation'], best: 1 },
      { d: 'advanced', stem: 'You must make a technical design choice with long-term consequences. What demonstrates strong technical competence?', options: ['Choose the most familiar option', 'Weigh trade-offs against requirements, constraints, and maintainability, then justify the choice', 'Choose the newest technology available', 'Defer the choice indefinitely'], best: 1 },
    ],
  },
  {
    code: 'comp_quality_focus', name: 'Quality Focus', questions: [
      { d: 'foundational', stem: 'You can finish faster by cutting a corner that affects quality. What reflects quality focus?', options: ['Always cut the corner to save time', 'Maintain the quality standard and find a legitimate way to be efficient', 'Cut the corner and hide it', 'Decide quality does not matter here'], best: 1 },
      { d: 'intermediate', stem: 'You notice the output meets the spec but is not as good as it could be. What is the strongest quality-focused response?', options: ['Ship it — the spec is met', 'Improve it where the effort is worthwhile and flag where it falls short', 'Rewrite everything regardless of value', 'Ignore the gap entirely'], best: 1 },
      { d: 'advanced', stem: 'Sustained delivery pressure is eroding quality across the team. What demonstrates strong quality focus?', options: ['Accept the erosion as the cost of speed', 'Make quality a shared standard with clear expectations and reinforce it consistently', 'Personally redo everyone else’s work', 'Quietly lower the standard'], best: 1 },
    ],
  },
  {
    code: 'comp_decision_quality', name: 'Decision Quality', questions: [
      { d: 'foundational', stem: 'You need to make a choice between two options. What reflects good decision quality?', options: ['Flip a coin', 'Weigh the relevant facts and consequences, then decide', 'Pick whatever is most popular', 'Avoid deciding'], best: 1 },
      { d: 'intermediate', stem: 'New information arrives after you have made a decision. What is the strongest response?', options: ['Stick to the decision regardless', 'Re-evaluate whether the new information changes the right course, and adjust if it does', 'Reverse every decision whenever anything new appears', 'Ignore the new information'], best: 1 },
      { d: 'advanced', stem: 'You must decide under uncertainty with significant stakes. What demonstrates strong decision quality?', options: ['Wait until all uncertainty is gone', 'Make a reasoned call based on the best available evidence and expected outcomes, and own it', 'Decide based on who will be least upset', 'Delegate the decision to avoid responsibility'], best: 1 },
    ],
  },
  {
    code: 'comp_design_thinking', name: 'Design Thinking', questions: [
      { d: 'foundational', stem: 'You are building something for users. What reflects design thinking?', options: ['Build what is easiest for you', 'Start from the user’s real need and design to solve it', 'Copy a competitor exactly', 'Add as many features as possible'], best: 1 },
      { d: 'intermediate', stem: 'Users are not adopting a feature you built. What is the strongest design-thinking response?', options: ['Tell users they are using it wrong', 'Observe how they actually work, find the unmet need, and redesign around it', 'Add more options to the feature', 'Remove the feature without learning why'], best: 1 },
      { d: 'advanced', stem: 'You face an open-ended problem with no obvious solution. What demonstrates strong design thinking?', options: ['Jump to the first idea and build it', 'Explore the problem, prototype multiple options, test with users, and iterate', 'Specify the full solution upfront with no testing', 'Wait for requirements to be handed to you'], best: 1 },
    ],
  },
  {
    code: 'comp_leadership', name: 'Leadership', questions: [
      { d: 'foundational', stem: 'Your team is unsure what to do next. What reflects good leadership?', options: ['Wait for someone else to step up', 'Set a clear direction and help the team move toward it', 'Tell everyone to figure it out alone', 'Take over and do all the work yourself'], best: 1 },
      { d: 'intermediate', stem: 'A team member is struggling to deliver. What is the strongest leadership response?', options: ['Reassign their work without a word', 'Understand the obstacle, support them, and set clear expectations', 'Publicly criticise them', 'Ignore it and hope it resolves'], best: 1 },
      { d: 'advanced', stem: 'Your team must navigate a difficult change. What demonstrates strong leadership?', options: ['Announce the change and leave them to cope', 'Communicate the why, address concerns honestly, and guide the team through it', 'Pretend nothing is changing', 'Let each person fend for themselves'], best: 1 },
    ],
  },
];

async function main() {
  const apply = process.argv.includes('--apply');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const ontoRes = await pool.query(`SELECT id FROM onto_competencies WHERE id = ANY($1::text[])`, [
      COMPS.map((c) => c.code),
    ]);
    const ontoIds = new Set<string>(ontoRes.rows.map((r: any) => r.id));

    let tInserted = 0;
    let mInserted = 0;
    let skippedComp = 0;

    for (const comp of COMPS) {
      if (!ontoIds.has(comp.code)) {
        console.log(`SKIP ${comp.code} — not present in onto_competencies (map FK would fail)`);
        skippedComp++;
        continue;
      }
      for (let i = 0; i < comp.questions.length; i++) {
        const q = comp.questions[i];
        const templateKey = `t151_${comp.code}_q${i + 1}`;
        const body = {
          prompt: q.stem,
          stem: q.stem,
          options: q.options,
          best_option: q.best,
          correct_index: q.best,
          rationale: 'Best answer reflects the competency-aligned behaviour; adjacent options are partially credited, off-target options score low.',
        };
        if (apply) {
          const ins = await pool.query(
            `INSERT INTO competency_question_templates
               (template_key, competency_code, question_type, template_body, difficulty_band,
                language_policy, status, source, provenance, confidence_score, quality_review_status,
                reviewed_by, reviewed_at, notes)
             VALUES ($1,$2,'multiple_choice',$3::jsonb,$4,'{}'::jsonb,'approved','manual','curated_authored',0.7,'approved',
                     'task-151-curation', now(), 'Authored to extend precise per-competency scoring to QA / DevOps / Frontend / Full Stack / Software Engineer role DNA (Task #151).')
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
          tInserted++;
          const mres = await pool.query(
            `INSERT INTO onto_competency_question_map (competency_id, question_id, source, active)
             SELECT $1::varchar,$2::uuid,'curated',true
             WHERE NOT EXISTS (
               SELECT 1 FROM onto_competency_question_map WHERE competency_id=$1::varchar AND question_id=$2::uuid)
             RETURNING id`,
            [comp.code, qid],
          );
          if (mres.rowCount && mres.rowCount > 0) mInserted++;
          else {
            await pool.query(
              `UPDATE onto_competency_question_map SET active=true, updated_at=now()
                WHERE competency_id=$1 AND question_id=$2 AND active=false`,
              [comp.code, qid],
            );
          }
        } else {
          console.log(`DRY ${templateKey} (${comp.code}, ${q.d}) — would approve + active-map`);
          tInserted++;
        }
      }
    }
    console.log(
      `${apply ? 'APPLIED' : 'DRY-RUN'}: ${tInserted} templates, ${mInserted} new active map rows, ${skippedComp} competencies skipped.`,
    );
    if (!apply) console.log('Re-run with --apply to write.');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
