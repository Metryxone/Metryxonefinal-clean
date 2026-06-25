/**
 * Task #130 — Expand per-competency scoring to more roles.
 *
 * The precise per-competency layer in competency-runtime.ts only fires for a
 * competency when the SERVED assessment includes an APPROVED template whose
 * `competency_code` equals the comp_* competency id (e.g. acc_q1 for
 * comp_accountability) AND an ACTIVE row in onto_competency_question_map ties
 * that template to the competency.
 *
 * The ~2,514 MX-101A drafts are TYPE-coded (TEC/EIQ/ADP/...), not comp_*-coded,
 * so approving them cannot drive precise per-competency scoring (and force-
 * activating their generic map rows would fabricate identical scores across
 * dozens of competencies). The honest lever is to AUTHOR genuine comp_*-coded
 * MCQs for additional role-blueprint competencies — mirroring the demo PM
 * pattern (acc_q1, sm_q1, ...) — then approve + active-map them.
 *
 * This script authors 3 defensible behavioural MCQs (foundational/intermediate/
 * advanced) for each of the 29 role-blueprint competencies (present in
 * onto_role_weights) that were not yet covered by an active map row. It is
 * idempotent (ON CONFLICT on template_key) and reversible (all rows carry the
 * `t130_` template_key prefix and source='manual', provenance='curated_authored').
 *
 * Untouched competencies remain unmeasured (null) — no fabrication.
 */
import { Pool } from 'pg';

type Q = { d: 'foundational' | 'intermediate' | 'advanced'; stem: string; options: string[]; best: number };
type Comp = { code: string; name: string; questions: Q[] };

const COMPS: Comp[] = [
  {
    code: 'comp_collaboration', name: 'Collaboration', questions: [
      { d: 'foundational', stem: 'A teammate asks for help on a task while you are busy. What is the most collaborative response?', options: ['Ignore the request until you finish everything', 'Acknowledge them and agree a time you can help', 'Tell them to figure it out alone', 'Report them for interrupting you'], best: 1 },
      { d: 'intermediate', stem: 'Two members of your project group disagree on an approach and progress has stalled. What do you do?', options: ['Pick the louder person’s idea to move on', 'Facilitate a discussion to surface the merits of each option and align on a path', 'Wait for a manager to decide', 'Quietly do it your own way'], best: 1 },
      { d: 'advanced', stem: 'You are coordinating across three teams with competing priorities on a shared deliverable. What best builds collaboration?', options: ['Escalate every conflict to leadership immediately', 'Create a shared plan with clear interfaces, owners, and a forum to resolve trade-offs jointly', 'Let each team optimise for itself', 'Hide dependencies to avoid friction'], best: 1 },
    ],
  },
  {
    code: 'comp_communication', name: 'Communication', questions: [
      { d: 'foundational', stem: 'You need to share a status update with a non-technical stakeholder. What is most effective?', options: ['Send the raw technical logs', 'Summarise progress, risks, and next steps in plain language', 'Say nothing until it is done', 'Use as much jargon as possible to sound credible'], best: 1 },
      { d: 'intermediate', stem: 'A stakeholder misunderstood your earlier message and acted on the wrong assumption. What do you do?', options: ['Blame them for not reading carefully', 'Clarify directly, confirm shared understanding, and adjust how you communicate', 'Ignore it and hope it resolves', 'Escalate without explaining'], best: 1 },
      { d: 'advanced', stem: 'You must deliver unwelcome news (a slipped deadline) to senior leadership. What is the strongest approach?', options: ['Delay telling them as long as possible', 'Communicate early with the cause, impact, options, and your recommendation', 'Downplay the impact to avoid concern', 'Let someone else deliver it'], best: 1 },
    ],
  },
  {
    code: 'comp_problem_solving', name: 'Problem-Solving', questions: [
      { d: 'foundational', stem: 'A process you run fails unexpectedly. What is the best first step?', options: ['Retry randomly until it works', 'Reproduce and understand the failure before changing anything', 'Rewrite the whole process from scratch', 'Ask someone else to fix it'], best: 1 },
      { d: 'intermediate', stem: 'You face a recurring issue with several plausible causes. How do you proceed?', options: ['Fix the first cause you think of', 'Isolate variables and test hypotheses to find the root cause', 'Apply every possible fix at once', 'Ignore it since it is intermittent'], best: 1 },
      { d: 'advanced', stem: 'A complex problem has no clear precedent and high uncertainty. What is most effective?', options: ['Wait for perfect information before acting', 'Decompose it, run small experiments, and iterate on evidence', 'Copy a solution from an unrelated context without checking fit', 'Pick a solution and refuse to revisit it'], best: 1 },
    ],
  },
  {
    code: 'comp_attention_to_detail', name: 'Attention to Detail', questions: [
      { d: 'foundational', stem: 'You are about to submit a report. What best reflects attention to detail?', options: ['Submit immediately to be fast', 'Review for accuracy, completeness, and errors before submitting', 'Assume it is fine because you are usually careful', 'Ask a colleague to check it without reading it yourself'], best: 1 },
      { d: 'intermediate', stem: 'You notice a small inconsistency in data that does not affect the headline result. What do you do?', options: ['Ignore it since the result is unchanged', 'Investigate and resolve it to ensure integrity of the work', 'Hide it so no one asks', 'Round it away'], best: 1 },
      { d: 'advanced', stem: 'Under time pressure on a high-stakes deliverable, how do you maintain accuracy?', options: ['Skip checks to hit the deadline', 'Prioritise verification of the highest-risk elements and use checklists', 'Rely entirely on memory', 'Submit and fix errors later if anyone complains'], best: 1 },
    ],
  },
  {
    code: 'comp_technical_competence', name: 'Technical Competence', questions: [
      { d: 'foundational', stem: 'You are asked to use a tool you have not used before. What is the best approach?', options: ['Refuse the task', 'Learn the fundamentals and apply them carefully to the task', 'Guess and hope it works', 'Pretend you already know it'], best: 1 },
      { d: 'intermediate', stem: 'Your usual technical approach is not working for the current problem. What do you do?', options: ['Keep forcing the same approach', 'Evaluate alternative techniques suited to the problem and validate the choice', 'Abandon the task', 'Blame the tools'], best: 1 },
      { d: 'advanced', stem: 'You must choose a technical solution with long-term maintainability implications. What is strongest?', options: ['Pick whatever is fastest to build now', 'Weigh trade-offs (performance, maintainability, risk) against requirements and justify the decision', 'Choose the newest technology regardless of fit', 'Defer the decision indefinitely'], best: 1 },
    ],
  },
  {
    code: 'comp_analytical_thinking', name: 'Analytical Thinking', questions: [
      { d: 'foundational', stem: 'You are given a dataset and a question to answer. What is the best first step?', options: ['Guess the answer', 'Clarify the question and examine the data before drawing conclusions', 'Pick the answer you prefer', 'Average everything and report it'], best: 1 },
      { d: 'intermediate', stem: 'Two metrics seem to contradict each other. How do you analyse this?', options: ['Report only the metric you like', 'Examine definitions, segments, and confounders to reconcile them', 'Conclude the data is useless', 'Average the two numbers'], best: 1 },
      { d: 'advanced', stem: 'A trend appears in the data. How do you decide whether it is meaningful?', options: ['Assume any pattern is real', 'Test for significance, sample size, and alternative explanations before concluding', 'Report it immediately as a finding', 'Ignore it because trends are usually noise'], best: 1 },
    ],
  },
  {
    code: 'comp_systems_thinking', name: 'Systems Thinking', questions: [
      { d: 'foundational', stem: 'A change in one part of a process causes problems elsewhere. What does this illustrate?', options: ['Parts are fully independent', 'Components are interconnected, so changes have downstream effects', 'The problem is unrelated', 'Nothing can be predicted'], best: 1 },
      { d: 'intermediate', stem: 'You are optimising one team’s throughput. What should you also consider?', options: ['Only that team’s numbers', 'The impact on upstream/downstream teams and the overall flow', 'Nothing beyond the local metric', 'Maximising local output at any cost'], best: 1 },
      { d: 'advanced', stem: 'A persistent issue keeps recurring despite repeated local fixes. What is the systems-thinking response?', options: ['Keep applying the same local fix', 'Map the feedback loops and structural causes to address the system, not the symptom', 'Accept it as unavoidable', 'Blame the people involved'], best: 1 },
    ],
  },
  {
    code: 'comp_persuasion', name: 'Persuasion', questions: [
      { d: 'foundational', stem: 'You want a colleague to adopt your idea. What is most persuasive?', options: ['Demand they comply', 'Explain the benefits relevant to their goals and invite their input', 'Repeat your idea louder', 'Go around them'], best: 1 },
      { d: 'intermediate', stem: 'A stakeholder is sceptical of your proposal. How do you persuade them?', options: ['Dismiss their concerns', 'Acknowledge their concerns and address them with evidence and trade-offs', 'Pressure them with a deadline', 'Withhold information'], best: 1 },
      { d: 'advanced', stem: 'You need buy-in from multiple parties with differing interests. What works best?', options: ['Use the same pitch for everyone', 'Tailor the case to each party’s interests while keeping a consistent, honest core message', 'Promise each whatever they want', 'Force a decision by escalation'], best: 1 },
    ],
  },
  {
    code: 'comp_critical_thinking', name: 'Critical Thinking', questions: [
      { d: 'foundational', stem: 'Someone presents a claim as fact. What is the critical-thinking response?', options: ['Accept it because they sound confident', 'Ask what evidence supports it before accepting', 'Reject it outright', 'Repeat it to others'], best: 1 },
      { d: 'intermediate', stem: 'You receive a recommendation backed by a single example. How do you evaluate it?', options: ['Treat the example as proof', 'Assess whether the example is representative and seek additional evidence', 'Ignore the recommendation', 'Adopt it to avoid conflict'], best: 1 },
      { d: 'advanced', stem: 'A popular conclusion is widely accepted on your team. What does strong critical thinking require?', options: ['Agree to fit in', 'Examine assumptions and evidence independently, even against consensus', 'Disagree on principle', 'Avoid the topic'], best: 1 },
    ],
  },
  {
    code: 'comp_decision_quality', name: 'Decision Quality', questions: [
      { d: 'foundational', stem: 'You must make a routine decision. What supports a good decision?', options: ['Decide on instinct alone', 'Consider the relevant facts and options before deciding', 'Always defer to others', 'Flip a coin'], best: 1 },
      { d: 'intermediate', stem: 'You have to decide with incomplete information and a deadline. What is best?', options: ['Wait indefinitely for full information', 'Make a reasoned decision on the best available evidence and note key assumptions', 'Decide randomly', 'Avoid deciding'], best: 1 },
      { d: 'advanced', stem: 'A past decision turned out poorly. What most improves future decision quality?', options: ['Blame circumstances and move on', 'Review the decision process and assumptions to learn, separating outcome from process', 'Stop making decisions', 'Only judge by the outcome'], best: 1 },
    ],
  },
  {
    code: 'comp_integrity', name: 'Integrity', questions: [
      { d: 'foundational', stem: 'You make a mistake that no one else noticed. What does integrity call for?', options: ['Hide it', 'Disclose it and take steps to correct it', 'Blame someone else', 'Wait to see if it matters'], best: 1 },
      { d: 'intermediate', stem: 'You are asked to misrepresent results slightly to please a stakeholder. What do you do?', options: ['Comply to avoid conflict', 'Decline and present the accurate results with context', 'Exaggerate just a little', 'Pass the request to someone else'], best: 1 },
      { d: 'advanced', stem: 'Following the rules will cost your team a deadline, but cutting a corner is tempting. What reflects integrity?', options: ['Cut the corner quietly', 'Uphold the standard, communicate the impact, and seek a legitimate path', 'Cut the corner and disclose only if caught', 'Let others decide so you are not responsible'], best: 1 },
    ],
  },
  {
    code: 'comp_strategic_thinking', name: 'Strategic Thinking', questions: [
      { d: 'foundational', stem: 'When planning work, what reflects strategic thinking?', options: ['Focus only on today’s tasks', 'Connect the work to longer-term goals and priorities', 'Do whatever is easiest', 'Ignore goals entirely'], best: 1 },
      { d: 'intermediate', stem: 'You can pursue a quick win or invest in a longer-term capability. How do you decide strategically?', options: ['Always take the quick win', 'Weigh the long-term value against short-term needs and the broader goal', 'Always pick the long-term option', 'Decide arbitrarily'], best: 1 },
      { d: 'advanced', stem: 'The market shifts and your current plan is becoming less relevant. What is the strategic response?', options: ['Stick rigidly to the plan', 'Reassess assumptions and adapt the strategy to the new reality', 'Abandon planning altogether', 'Wait for instructions'], best: 1 },
    ],
  },
  {
    code: 'comp_coaching', name: 'Coaching', questions: [
      { d: 'foundational', stem: 'A junior colleague is struggling with a task. What is the best coaching response?', options: ['Do it for them', 'Ask questions and guide them to find the solution themselves', 'Tell them they are not capable', 'Ignore the struggle'], best: 1 },
      { d: 'intermediate', stem: 'You are giving development feedback. What makes it most useful?', options: ['Only praise to keep morale high', 'Be specific, balanced, and focused on actionable improvement', 'List every fault at once', 'Compare them unfavourably to peers'], best: 1 },
      { d: 'advanced', stem: 'A capable team member has plateaued. How do you coach for growth?', options: ['Leave them alone', 'Co-create stretch goals and provide support and accountability', 'Threaten consequences', 'Reassign them without discussion'], best: 1 },
    ],
  },
  {
    code: 'comp_data_driven_decision_making', name: 'Data-Driven Decision Making', questions: [
      { d: 'foundational', stem: 'You must choose between two options. What reflects data-driven decision making?', options: ['Go with a gut feeling', 'Gather and weigh relevant data before deciding', 'Pick the option a friend likes', 'Choose at random'], best: 1 },
      { d: 'intermediate', stem: 'The data points to a conclusion you did not expect. What do you do?', options: ['Ignore the data and trust intuition', 'Validate the data quality, then update your view accordingly', 'Change the data to fit your view', 'Delay until the data agrees with you'], best: 1 },
      { d: 'advanced', stem: 'You have data, but it is incomplete and partly conflicting. How do you decide?', options: ['Pretend the data is conclusive', 'Quantify uncertainty, state assumptions, and decide while planning to revisit as data improves', 'Discard all data and guess', 'Wait indefinitely for perfect data'], best: 1 },
    ],
  },
  {
    code: 'comp_emotional_regulation', name: 'Emotional Regulation', questions: [
      { d: 'foundational', stem: 'You receive frustrating feedback. What reflects good emotional regulation?', options: ['React angrily in the moment', 'Pause, manage your reaction, and respond constructively', 'Suppress it and resent it later', 'Walk out'], best: 1 },
      { d: 'intermediate', stem: 'A high-pressure situation is making you anxious. What is the best response?', options: ['Let the anxiety drive impulsive actions', 'Acknowledge the feeling and use coping strategies to stay focused', 'Pretend nothing is wrong and burn out', 'Pass the stress to others'], best: 1 },
      { d: 'advanced', stem: 'A colleague provokes you in a meeting. What demonstrates strong emotional regulation?', options: ['Retaliate publicly', 'Stay composed, address the issue calmly, and follow up privately if needed', 'Shut down and disengage', 'Escalate emotionally'], best: 1 },
    ],
  },
  {
    code: 'comp_learning_agility', name: 'Learning Agility', questions: [
      { d: 'foundational', stem: 'You are placed in an unfamiliar area. What reflects learning agility?', options: ['Resist the change', 'Embrace it and quickly build the knowledge you need', 'Wait to be trained on everything', 'Avoid the work'], best: 1 },
      { d: 'intermediate', stem: 'A new method makes your current expertise less relevant. What do you do?', options: ['Dismiss the new method', 'Learn it and integrate it with your existing knowledge', 'Refuse to change', 'Hope it goes away'], best: 1 },
      { d: 'advanced', stem: 'You repeatedly face novel problems with no playbook. What best supports learning agility?', options: ['Apply old solutions unchanged', 'Extract lessons from each experience and adapt your approach rapidly', 'Avoid novel problems', 'Wait for someone to provide answers'], best: 1 },
    ],
  },
  {
    code: 'comp_quality_focus', name: 'Quality Focus', questions: [
      { d: 'foundational', stem: 'You finish a task quickly but are unsure it meets standards. What reflects quality focus?', options: ['Submit it as is', 'Verify it meets the required standard before completing', 'Assume good enough is fine', 'Ask someone to lower the standard'], best: 1 },
      { d: 'intermediate', stem: 'A shortcut would save time but reduce quality. How do you decide?', options: ['Always take the shortcut', 'Weigh the quality impact against the need and protect essential standards', 'Never consider time at all', 'Hide the quality reduction'], best: 1 },
      { d: 'advanced', stem: 'Recurring quality issues appear in your team’s output. What is the strongest response?', options: ['Fix each defect individually forever', 'Identify root causes and improve the process to prevent recurrence', 'Accept defects as normal', 'Blame individuals'], best: 1 },
    ],
  },
  {
    code: 'comp_business_acumen', name: 'Business Acumen', questions: [
      { d: 'foundational', stem: 'When proposing work, what reflects business acumen?', options: ['Ignore cost and value', 'Consider how it creates value for customers and the business', 'Focus only on technical elegance', 'Assume budget is unlimited'], best: 1 },
      { d: 'intermediate', stem: 'Two initiatives compete for limited budget. How do you evaluate them?', options: ['Pick the one you find interesting', 'Compare expected business impact, cost, and risk', 'Fund both regardless of resources', 'Defer to whoever asks loudest'], best: 1 },
      { d: 'advanced', stem: 'A profitable product conflicts with a long-term strategic goal. What shows strong business acumen?', options: ['Maximise short-term profit only', 'Weigh financial returns against strategic positioning and sustainability', 'Ignore profit entirely', 'Avoid the decision'], best: 1 },
    ],
  },
  {
    code: 'comp_conflict_resolution', name: 'Conflict Resolution', questions: [
      { d: 'foundational', stem: 'Two colleagues have a disagreement that affects your work. What is the best response?', options: ['Take a side immediately', 'Help them communicate and find common ground', 'Avoid them both', 'Escalate without trying to help'], best: 1 },
      { d: 'intermediate', stem: 'You are in conflict with a peer over priorities. How do you resolve it?', options: ['Insist you are right', 'Seek to understand their perspective and find a mutually acceptable solution', 'Give in to avoid discomfort', 'Go silent'], best: 1 },
      { d: 'advanced', stem: 'A long-running team conflict is hurting performance. What is the strongest approach?', options: ['Hope it resolves itself', 'Address the underlying issues openly and establish agreed working norms', 'Separate everyone permanently', 'Punish those involved'], best: 1 },
    ],
  },
  {
    code: 'comp_dependability', name: 'Dependability', questions: [
      { d: 'foundational', stem: 'You realise you cannot meet a commitment. What reflects dependability?', options: ['Say nothing and miss it', 'Inform stakeholders early and propose a plan', 'Blame others', 'Disappear until it blows over'], best: 1 },
      { d: 'intermediate', stem: 'You have several commitments and limited time. What best maintains dependability?', options: ['Drop commitments silently', 'Communicate, prioritise, and renegotiate scope or timing transparently', 'Promise everything and deliver none', 'Ignore the less visible ones'], best: 1 },
      { d: 'advanced', stem: 'A teammate consistently relies on you in a crunch. How do you remain dependable sustainably?', options: ['Always sacrifice yourself until you burn out', 'Deliver reliably while setting realistic expectations and boundaries', 'Become unavailable to avoid pressure', 'Over-promise to look good'], best: 1 },
    ],
  },
  {
    code: 'comp_design_thinking', name: 'Design Thinking', questions: [
      { d: 'foundational', stem: 'You are designing a solution for users. What is the best starting point?', options: ['Build what you personally prefer', 'Understand the users’ needs and context first', 'Copy a competitor exactly', 'Start coding immediately'], best: 1 },
      { d: 'intermediate', stem: 'Your first prototype tests poorly with users. What does design thinking suggest?', options: ['Ship it anyway', 'Learn from the feedback and iterate the design', 'Blame the users', 'Abandon the project'], best: 1 },
      { d: 'advanced', stem: 'Stakeholders want features users have not asked for. How do you apply design thinking?', options: ['Build all requested features', 'Validate real user needs and balance them against stakeholder goals', 'Ignore stakeholders entirely', 'Add features without testing'], best: 1 },
    ],
  },
  {
    code: 'comp_initiative', name: 'Initiative', questions: [
      { d: 'foundational', stem: 'You notice a small problem outside your assigned tasks. What reflects initiative?', options: ['Ignore it as not your job', 'Raise it or address it appropriately without being asked', 'Wait until told to act', 'Complain about it'], best: 1 },
      { d: 'intermediate', stem: 'You see an opportunity to improve a process. What is the best action?', options: ['Wait for someone else to suggest it', 'Propose the improvement with a clear rationale and offer to help', 'Implement it secretly with no communication', 'Do nothing'], best: 1 },
      { d: 'advanced', stem: 'No one owns a recurring gap that hurts the team. What demonstrates strong initiative?', options: ['Assume it is someone else’s responsibility', 'Step up to coordinate a solution and bring others along', 'Point out the gap repeatedly without acting', 'Avoid it to stay safe'], best: 1 },
    ],
  },
  {
    code: 'comp_leadership', name: 'Leadership', questions: [
      { d: 'foundational', stem: 'Your team is unsure how to proceed. What reflects leadership?', options: ['Wait for someone else to act', 'Provide direction and align the team on a path forward', 'Let everyone do whatever they want', 'Avoid responsibility'], best: 1 },
      { d: 'intermediate', stem: 'A team member is underperforming. What is the best leadership response?', options: ['Ignore it', 'Address it directly and supportively, with clear expectations and help', 'Publicly criticise them', 'Do their work for them indefinitely'], best: 1 },
      { d: 'advanced', stem: 'The team faces a setback and morale is low. What shows strong leadership?', options: ['Blame the team', 'Take accountability, refocus on goals, and rebuild confidence and momentum', 'Pretend nothing happened', 'Distance yourself from the outcome'], best: 1 },
    ],
  },
  {
    code: 'comp_planning_and_organizing', name: 'Planning and Organizing', questions: [
      { d: 'foundational', stem: 'You are given a multi-step task. What reflects good planning?', options: ['Start immediately with no plan', 'Break it into steps and sequence them sensibly', 'Do the easiest parts only', 'Wait until the deadline'], best: 1 },
      { d: 'intermediate', stem: 'Several tasks have dependencies and deadlines. How do you organise them?', options: ['Work in random order', 'Map dependencies and schedule work to meet deadlines', 'Do whatever feels urgent', 'Ignore deadlines'], best: 1 },
      { d: 'advanced', stem: 'Your plan is disrupted by an unexpected change. What is the strongest response?', options: ['Abandon planning', 'Re-prioritise and adjust the plan while protecting critical outcomes', 'Stick rigidly to the old plan', 'Wait for the disruption to pass'], best: 1 },
    ],
  },
  {
    code: 'comp_prioritization', name: 'Prioritization', questions: [
      { d: 'foundational', stem: 'You have more tasks than time. What reflects good prioritisation?', options: ['Do them in the order received', 'Rank by importance and urgency and tackle the highest-value first', 'Do the easiest ones only', 'Do a little of everything and finish nothing'], best: 1 },
      { d: 'intermediate', stem: 'A new urgent request arrives mid-day. How do you prioritise?', options: ['Drop everything for it automatically', 'Assess its importance against current work and reprioritise deliberately', 'Ignore it', 'Always finish current work first regardless'], best: 1 },
      { d: 'advanced', stem: 'Multiple stakeholders insist their work is top priority. What is the strongest approach?', options: ['Please whoever is loudest', 'Use clear criteria and transparent trade-offs to set priorities and communicate them', 'Treat everything as equally urgent', 'Avoid deciding'], best: 1 },
    ],
  },
  {
    code: 'comp_project_management', name: 'Project Management', questions: [
      { d: 'foundational', stem: 'You start a small project. What reflects good project management?', options: ['Begin work with no scope or timeline', 'Define scope, milestones, and responsibilities up front', 'Avoid tracking progress', 'Keep all details in your head'], best: 1 },
      { d: 'intermediate', stem: 'A project is falling behind schedule. What is the best response?', options: ['Hide it and hope to catch up', 'Identify the cause, adjust scope/resources/timeline, and communicate transparently', 'Add people without a plan', 'Cut quality silently'], best: 1 },
      { d: 'advanced', stem: 'A project has many risks and dependencies across teams. What shows strong project management?', options: ['React to problems as they occur only', 'Proactively manage risks, dependencies, and stakeholders with a clear plan', 'Avoid stakeholder communication', 'Assume risks will not materialise'], best: 1 },
    ],
  },
  {
    code: 'comp_quality_assurance', name: 'Quality Assurance', questions: [
      { d: 'foundational', stem: 'Before releasing work, what reflects good quality assurance?', options: ['Release without checks', 'Test against requirements to catch defects before release', 'Assume it works because it did last time', 'Let users find the bugs'], best: 1 },
      { d: 'intermediate', stem: 'You find a defect late in the process. What is the best QA response?', options: ['Ignore it to keep the schedule', 'Assess severity, fix or mitigate it, and check for similar issues', 'Hide it', 'Release and patch later regardless of impact'], best: 1 },
      { d: 'advanced', stem: 'Defects keep escaping to production. What is the strongest QA improvement?', options: ['Add more manual checks only after release', 'Strengthen prevention and earlier detection by improving the QA process and coverage', 'Accept escapes as inevitable', 'Blame the testers'], best: 1 },
    ],
  },
  {
    code: 'comp_self_control', name: 'Self-Control', questions: [
      { d: 'foundational', stem: 'You feel the urge to send an angry reply. What reflects self-control?', options: ['Send it immediately', 'Pause and respond calmly once the urge passes', 'Vent to everyone first', 'Escalate emotionally'], best: 1 },
      { d: 'intermediate', stem: 'A tempting distraction appears during important work. What is best?', options: ['Give in to the distraction', 'Resist it and stay focused on the priority', 'Multitask between both', 'Abandon the work'], best: 1 },
      { d: 'advanced', stem: 'Under sustained pressure, impulses to cut corners grow. What demonstrates strong self-control?', options: ['Act on impulse for relief', 'Maintain disciplined standards and use strategies to manage the pressure', 'Ignore the pressure until you snap', 'Pass the pressure to others'], best: 1 },
    ],
  },
  {
    code: 'comp_stress_tolerance', name: 'Stress Tolerance', questions: [
      { d: 'foundational', stem: 'A deadline creates pressure. What reflects healthy stress tolerance?', options: ['Panic and freeze', 'Stay focused and work through the priorities calmly', 'Give up', 'Take it out on others'], best: 1 },
      { d: 'intermediate', stem: 'Several stressful demands hit at once. What is the best response?', options: ['Try to do everything at once and burn out', 'Manage your workload, seek support, and maintain performance', 'Shut down', 'Ignore the demands'], best: 1 },
      { d: 'advanced', stem: 'You face prolonged high-pressure conditions. What best sustains performance?', options: ['Push without rest until you collapse', 'Use coping strategies, pace yourself, and protect well-being to stay effective', 'Disengage entirely', 'Deny the stress exists'], best: 1 },
    ],
  },
];

async function main() {
  const apply = process.argv.includes('--apply');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // Restrict to comp_* codes that are genuine role-blueprint competencies AND
    // not yet active-mapped — verified against the live DB so we never seed a
    // competency that is already covered or is not in any role DNA.
    const guardRes = await pool.query(
      `SELECT DISTINCT competency_id FROM onto_role_weights
        WHERE competency_id NOT IN (SELECT competency_id FROM onto_competency_question_map WHERE active)`,
    );
    const eligible = new Set<string>(guardRes.rows.map((r: any) => r.competency_id));
    // Confirm the comp_* id exists in onto_competencies (FK target for the map).
    const ontoRes = await pool.query(`SELECT id FROM onto_competencies WHERE id = ANY($1::text[])`, [
      COMPS.map((c) => c.code),
    ]);
    const ontoIds = new Set<string>(ontoRes.rows.map((r: any) => r.id));

    let tInserted = 0;
    let mInserted = 0;
    let skippedComp = 0;

    for (const comp of COMPS) {
      if (!eligible.has(comp.code)) {
        console.log(`SKIP ${comp.code} — not an uncovered role-blueprint competency in the live DB`);
        skippedComp++;
        continue;
      }
      if (!ontoIds.has(comp.code)) {
        console.log(`SKIP ${comp.code} — not present in onto_competencies (map FK would fail)`);
        skippedComp++;
        continue;
      }
      for (let i = 0; i < comp.questions.length; i++) {
        const q = comp.questions[i];
        const templateKey = `t130_${comp.code}_q${i + 1}`;
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
                     'task-130-curation', now(), 'Authored to expand precise per-competency scoring to more role blueprints (Task #130).')
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
          // Active map row (idempotent: only insert if not present).
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
            // Already mapped — ensure it is active.
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
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
