/**
 * Task #145 — author per-competency questions for the Backend Engineer /
 * Senior Backend Engineer role-DNA competencies that did not yet have any
 * approved + active-mapped question.
 *
 * This is lever 1 of the two-lever rule (see
 * .agents/memory/competency-precise-scoring-blueprint-gate.md): a competency only
 * yields a PRECISE (direct) employer score when the served assessment includes an
 * APPROVED template whose competency_code equals the comp_* id AND an ACTIVE row in
 * onto_competency_question_map ties it to that competency. Lever 2 (role-DNA
 * membership + blueprint serving) is handled by seed-task145-blueprint-wiring.ts.
 * (Role-DNA weights for both roles already existed in onto_role_weights.)
 *
 * It authors 3 defensible behavioural MCQs (foundational/intermediate/advanced)
 * for each competency below. Only the role-DNA competencies that LACKED questions
 * are included here; competencies that already had approved questions
 * (accountability, active_listening, adaptability) are intentionally untouched.
 *
 * Idempotent (ON CONFLICT on template_key); reversible (all rows carry the `t145_`
 * template_key prefix, source='manual', provenance='curated_authored'). No
 * fabrication: only real genome competencies (verified present in
 * onto_competencies) are authored. Run with --apply to write; default is a dry run.
 */
import { Pool } from 'pg';

type Q = { d: 'foundational' | 'intermediate' | 'advanced'; stem: string; options: string[]; best: number };
type Comp = { code: string; name: string; questions: Q[] };

const COMPS: Comp[] = [
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
        const templateKey = `t145_${comp.code}_q${i + 1}`;
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
