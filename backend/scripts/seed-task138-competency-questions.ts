/**
 * Task #138 — Author per-competency questions BEYOND the 33 role-DNA competencies.
 *
 * Task #130 covered the 33 competencies that were ALREADY in role DNA
 * (onto_role_weights) with genuine comp_*-coded MCQs, so they drive PRECISE
 * (direct) employer matches. This task extends precise scoring to ADDITIONAL
 * genome competencies that are genuinely core to specific roles but were not yet
 * part of any role's DNA.
 *
 * This is lever 1 of the two-lever rule (see
 * .agents/memory/competency-precise-scoring-blueprint-gate.md): a competency only
 * yields a PRECISE score when the served assessment includes an APPROVED template
 * whose competency_code equals the comp_* id AND an ACTIVE row in
 * onto_competency_question_map ties it to that competency. Lever 2 (role-DNA
 * membership + blueprint serving) is handled by the companion scripts
 * seed-task138-role-dna-weights.ts and seed-task138-blueprint-wiring.ts.
 *
 * This script authors 3 defensible behavioural MCQs (foundational/intermediate/
 * advanced) for each of 14 additional genome competencies. It is idempotent
 * (ON CONFLICT on template_key) and reversible (all rows carry the `t138_`
 * template_key prefix, source='manual', provenance='curated_authored').
 *
 * No fabrication: only real genome competencies (verified present in
 * onto_competencies) are authored; competencies without authored questions remain
 * unmeasured (null). Run with --apply to write; default is a dry run.
 */
import { Pool } from 'pg';

type Q = { d: 'foundational' | 'intermediate' | 'advanced'; stem: string; options: string[]; best: number };
type Comp = { code: string; name: string; questions: Q[] };

const COMPS: Comp[] = [
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

async function main() {
  const apply = process.argv.includes('--apply');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // Confirm the comp_* id exists in onto_competencies (FK target for the map).
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
        const templateKey = `t138_${comp.code}_q${i + 1}`;
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
