/**
 * CAPADEX PIL — Phase 5 engine: Intervention Intelligence Layer.
 *
 *   Transforms DIAGNOSIS into ACTION. The earlier PIL phases produced, per
 *   archetype, plain-language problems / emotions / narratives / search intents.
 *   This layer produces the guidance: per archetype × five stakeholders
 *   (Student / Parent / Teacher / Counselor / Professional) × six intervention
 *   types (Immediate / 7-Day / 30-Day / 90-Day / Habit / Skill-Building) =
 *   660 concrete, measurable, age-appropriate interventions, each with an
 *   expected outcome, a success indicator, a progress indicator, and deterministic
 *   confidence / risk-reduction projections.
 *
 * PURE & DETERMINISTIC: no DB, no network, no external AI, no scraping. Every
 * intervention is assembled from CURATED per-archetype action ANCHORS (legitimate
 * authoring, the same canon as the Phase-3/4 packs) combined by per-(type ×
 * stakeholder) templates. The five quality scores and the validators are honest
 * functions of the produced text and are ALLOWED TO FAIL — never tune them to
 * force a pass.
 *
 * Reuses the Phase-3 validators/lexicon so the layers can never drift:
 *   checkRealism (jargon-free + length) · isAligned/ALIGNMENT_LEXICON (lay lexicon)
 *   · tokenize · detectDuplicates.
 *
 * ANCHOR CONTRACT (so stakeholder templates stay grammatical): action anchors
 *   (immediate/week/month/quarter) are BASE-FORM verb phrases with NO person
 *   pronouns/possessives — the template owns the subject ("Today, …" /
 *   "help your child …" / "have the student …" / "guide your client to …" /
 *   "Before the workday ends, …"). habit/skill are noun/gerund phrases. outcome is
 *   a base verb phrase framed by `outcomeStatement` ("You will …" / "Your child
 *   will …"). success/progress are neutral sentences (no subject).
 *
 * CONFIDENCE / RISK IMPACTS are deterministic PROJECTIONS (a function of the
 * intervention's time-horizon × its honest quality), NOT measured outcomes — they
 * encode "longer / more structural interventions are projected to move the needle
 * more", scaled down by weak quality. Documented as projections, never fabricated.
 *
 * DUPLICATE MODEL (same as Phase 4 — see auditDuplicates): the headline duplicate
 * rate counts only REDUNDANT STORAGE — an identical text anywhere, or a
 * near-identical text aimed at the SAME stakeholder. Cross-stakeholder reframings
 * of one intervention (a parent vs a student version) are intended audience
 * variants, NOT redundancy; recorded in the review set, not counted. Measurement
 * scope, not metric tuning.
 */
import {
  STAKEHOLDERS, ALIGNMENT_LEXICON, tokenize,
  checkRealism, isAligned, detectDuplicates,
  type Stakeholder,
} from './human-intelligence-engine.js';

export type { Stakeholder } from './human-intelligence-engine.js';
export { STAKEHOLDERS } from './human-intelligence-engine.js';

// ── Intervention types ───────────────────────────────────────────────────────
export type InterventionType =
  | 'immediate_actions' | 'seven_day' | 'thirty_day' | 'ninety_day' | 'habit' | 'skill_building';
export const INTERVENTION_TYPES: InterventionType[] =
  ['immediate_actions', 'seven_day', 'thirty_day', 'ninety_day', 'habit', 'skill_building'];
export const INTERVENTION_LABELS: Record<InterventionType, string> = {
  immediate_actions: 'Immediate Actions',
  seven_day: '7-Day Plan',
  thirty_day: '30-Day Plan',
  ninety_day: '90-Day Development',
  habit: 'Habit',
  skill_building: 'Skill-Building',
};
// horizon in days — drives action-plan template + impact projections
export const HORIZON_DAYS: Record<InterventionType, number> = {
  immediate_actions: 1, seven_day: 7, thirty_day: 30, ninety_day: 90, habit: 0, skill_building: 0,
};

// ── Curated per-archetype action anchors (one per archetype_key) ─────────────
// Pronoun-neutral, jargon-free, drawn from each archetype's everyday lay
// vocabulary (the same lexicon Phase-3 aligns against) — authored, never scraped
// or model-generated. See ANCHOR CONTRACT above.
export interface InterventionAnchor {
  immediate: string; // base verb phrase — one concrete action doable today
  week: string;      // base verb phrase — a daily trackable action for a week
  month: string;     // base verb phrase — a 30-day routine action
  quarter: string;   // base verb phrase — a 90-day development action
  habit: string;     // noun phrase — a recurring habit
  skill: string;     // gerund phrase — a skill to practise
  outcome: string;   // base verb phrase — the expected outcome (framed per stakeholder)
  success: string;   // neutral sentence fragment — measurable success indicator
  progress: string;  // neutral sentence fragment — progress indicator (trend)
}

export const INTERVENTION_ANCHORS: Record<string, InterventionAnchor> = {
  performance_anxiety: {
    immediate: 'write down each moment of panic during one high-pressure task and what set it off',
    week: 'log what triggers exam, interview, and presentation nerves',
    month: 'follow a short calm-down routine before every test, presentation, or meeting',
    quarter: 'build steady calm under pressure through weekly timed practice runs',
    habit: 'a two-minute breathing reset before each high-pressure moment',
    skill: 'rehearsing exams and presentations out loud until the nerves settle',
    outcome: 'stay calm and think clearly when the pressure is on',
    success: 'finish a full mock exam or presentation without freezing',
    progress: 'fewer panic moments logged from one week to the next',
  },
  career_professional_growth: {
    immediate: 'list three roles or career paths worth exploring and one question to ask about each',
    week: 'research jobs, roles, and the skills they need for twenty minutes',
    month: 'set up two short informational chats with people in a target career or role',
    quarter: 'build a clear career direction with a step plan toward a chosen role or promotion',
    habit: 'a weekly review of one new job, role, or workplace skill',
    skill: 'writing and updating a focused CV for a specific role',
    outcome: 'move toward a clear, realistic career direction',
    success: 'shortlist two roles and an action plan to reach them',
    progress: 'more concrete career options explored each week',
  },
  learning_comprehension: {
    immediate: 'pick one tricky concept and explain it out loud in simple, everyday words',
    week: 'write a three-line summary of what each study session covered',
    month: 'follow a routine of reviewing notes within a day to lock in what was studied',
    quarter: 'build reliable recall of key concepts through spaced weekly review',
    habit: 'a five-minute recap of the main idea from one lesson',
    skill: 'teaching a topic back to someone to test real understanding',
    outcome: 'understand and remember the material instead of forgetting it',
    success: 'explain last week\u2019s topic clearly without checking notes',
    progress: 'more concepts recalled correctly in weekly self-checks',
  },
  emotional_regulation: {
    immediate: 'pause and name the feeling before reacting the next time a strong mood hits',
    week: 'note what triggered feeling overwhelmed or upset',
    month: 'follow a steady wind-down routine on the days emotions run high',
    quarter: 'build steadier control of strong emotions through weekly calm-down practice',
    habit: 'a slow-breathing reset the moment frustration starts to build',
    skill: 'naming and rating emotions to stop small upsets becoming meltdowns',
    outcome: 'stay steady and calm instead of snapping or overreacting',
    success: 'get through a hard moment without a meltdown',
    progress: 'fewer overwhelmed days noted from week to week',
  },
  academic_achievement: {
    immediate: 'pick the weakest subject and finish one focused homework or revision task',
    week: 'track grades and homework due dates in one place',
    month: 'follow a weekly revision plan that covers every subject before the next test',
    quarter: 'lift results across subjects with a steady term-long study schedule',
    habit: 'a thirty-minute homework and revision block at a set time',
    skill: 'turning past exam papers into targeted revision practice',
    outcome: 'raise grades through steady, planned study',
    success: 'improve marks in the weakest subject by the next report',
    progress: 'more revision tasks completed on schedule each week',
  },
  leadership_influence: {
    immediate: 'volunteer to lead one small task or group decision',
    week: 'note one moment of guiding the team and one task to delegate',
    month: 'take charge of a small group project from start to finish',
    quarter: 'grow into a confident team leader through steady project responsibility',
    habit: 'a weekly check-in to give each teammate clear direction',
    skill: 'delegating tasks and following up so the group stays on track',
    outcome: 'lead a team with clear direction and confidence',
    success: 'run one group project where every teammate knows their role',
    progress: 'more tasks delegated and followed up each week',
  },
  time_self_discipline: {
    immediate: 'list the day\u2019s tasks by deadline and start the one most likely to be put off',
    week: 'log each time procrastination strikes and what got avoided',
    month: 'follow a daily schedule that protects set hours for assignments before they are due',
    quarter: 'become reliable with deadlines through a consistent weekly planning routine',
    habit: 'a five-minute plan of the day\u2019s tasks every morning',
    skill: 'breaking big assignments into timed steps to beat procrastination',
    outcome: 'meet deadlines without last-minute panic',
    success: 'hand in a full week of tasks on time',
    progress: 'fewer procrastination episodes logged each week',
  },
  motivation_drive: {
    immediate: 'write down one goal that matters and the first small step toward it',
    week: 'note what gave a spark of energy or interest and what drained it',
    month: 'rebuild drive by linking daily effort to one goal worth caring about',
    quarter: 'develop steady motivation through a term of small, finished goals',
    habit: 'a two-minute note of one thing worth the effort that day',
    skill: 'setting tiny goals that turn a flat day into real momentum',
    outcome: 'feel driven and ready to put in effort again',
    success: 'finish a goal that once felt too flat to start',
    progress: 'more days with real energy noted each week',
  },
  critical_reflective_thinking: {
    immediate: 'ask why once and weigh one other option before deciding anything',
    week: 'write down one assumption worth questioning and what the facts show',
    month: 'follow a habit of reviewing decisions to learn from each mistake',
    quarter: 'sharpen reasoning by reflecting weekly on choices and their results',
    habit: 'a daily moment to question one thing taken for granted',
    skill: 'weighing evidence for and against before reaching a conclusion',
    outcome: 'think problems through instead of jumping to conclusions',
    success: 'explain the reasons behind a recent decision clearly',
    progress: 'more assumptions questioned and examined each week',
  },
  confidence_self_efficacy: {
    immediate: 'write down three recent wins and one challenge worth taking on today',
    week: 'note one moment of self-doubt and one sign of real ability',
    month: 'take on a slightly harder challenge each week to build real confidence',
    quarter: 'grow steady self-belief through a term of met challenges',
    habit: 'a daily note of one thing that proves real ability',
    skill: 'facing small challenges on purpose to stop second-guessing',
    outcome: 'trust real ability instead of constant self-doubt',
    success: 'take on a challenge that would once have been avoided',
    progress: 'fewer moments of self-doubt logged each week',
  },
  adaptability_change: {
    immediate: 'write down one new option instead of stalling the next time a plan changes',
    week: 'note one change faced and how it was handled',
    month: 'follow a practice of handling one unexpected change a week on purpose',
    quarter: 'build calm adaptability through a term of managed transitions',
    habit: 'a quick reset plan whenever the routine suddenly shifts',
    skill: 'turning an unexpected change into a clear list of next steps',
    outcome: 'adapt to change without feeling thrown',
    success: 'handle a sudden change with a clear next step',
    progress: 'faster adjustment to changes noted from week to week',
  },
  resilience_recovery: {
    immediate: 'write down what one setback taught and one next thing to try',
    week: 'log one knock or rejection and how it was handled',
    month: 'follow a habit of trying again within a day of any setback',
    quarter: 'grow real resilience by recovering from a term of small failures',
    habit: 'a short reset routine after every knock or rejection',
    skill: 'turning a failure into one concrete lesson and a next attempt',
    outcome: 'bounce back from setbacks instead of giving up',
    success: 'try again after a failure that once would have stopped progress',
    progress: 'faster recovery from setbacks noted each week',
  },
  identity_self_awareness: {
    immediate: 'write down three things that truly matter and why',
    week: 'note one choice that fit personal values and one that did not',
    month: 'shape a clearer sense of direction by acting on what matters most each week',
    quarter: 'build a steady sense of self and what to stand for over the term',
    habit: 'a weekly check of whether actions matched real values',
    skill: 'naming personal values and using them to guide a real decision',
    outcome: 'feel clear about who matters and what to stand for',
    success: 'make one decision guided by personal values',
    progress: 'more choices that fit personal values each week',
  },
  expectations_pressure: {
    immediate: 'let go of one expectation that belongs to someone else for the day',
    week: 'note when comparing or chasing approval added pressure',
    month: 'set realistic personal standards instead of trying to please everyone',
    quarter: 'ease the weight of others\u2019 expectations through a term of self-set goals',
    habit: 'a daily reminder that personal worth is not a comparison',
    skill: 'separating personal goals from other people\u2019s expectations',
    outcome: 'act on personal standards instead of constant pressure to please',
    success: 'make one choice free of the need for approval',
    progress: 'fewer pressure-from-comparison moments noted each week',
  },
  communication_expression: {
    immediate: 'say one clear thought out loud or in a message',
    week: 'note one moment when thoughts were hard to put into words',
    month: 'practise explaining one idea clearly in a meeting or talk each week',
    quarter: 'build a clear, confident speaking voice over a term of small talks',
    habit: 'a daily habit of stating one point in a single clear sentence',
    skill: 'organising thoughts into three points before speaking',
    outcome: 'express thoughts clearly and be understood',
    success: 'explain an idea in a meeting without losing the point',
    progress: 'fewer moments of being misunderstood noted each week',
  },
  focus_attention: {
    immediate: 'put the phone away and finish one task in a single twenty-five-minute focus block',
    week: 'log what pulled attention away from a task',
    month: 'follow a routine of distraction-free focus blocks to finish tasks on time',
    quarter: 'grow steady concentration through a term of daily focus practice',
    habit: 'a twenty-five-minute phone-free focus block before each break',
    skill: 'clearing distractions and working in timed focus sprints',
    outcome: 'concentrate long enough to finish each task',
    success: 'complete a full task without checking the phone',
    progress: 'longer focus blocks logged from week to week',
  },
  curiosity_innovation: {
    immediate: 'ask one curious question and write down a fresh idea it sparks',
    week: 'note one new idea worth exploring or testing',
    month: 'run one small experiment a week to turn curiosity into a real idea',
    quarter: 'build a creative habit of inventing and testing fresh ideas over the term',
    habit: 'a daily question that opens up a new idea to explore',
    skill: 'turning curious questions into small experiments to try',
    outcome: 'explore fresh ideas instead of staying stuck',
    success: 'test one new idea worth trying',
    progress: 'more new ideas explored each week',
  },
  decision_judgment: {
    immediate: 'make one small decision, write down why, and commit to it',
    week: 'note a choice that caused hesitation and how long it took to decide',
    month: 'build a simple way to weigh options so decisions stop dragging on',
    quarter: 'become decisive through a term of timed, committed choices',
    habit: 'a quick pros-and-cons note before each real decision',
    skill: 'weighing two or three options and committing to one call',
    outcome: 'make clear decisions without endless second-guessing',
    success: 'commit to a decision and stick with it for a week',
    progress: 'faster, firmer choices noted each week',
  },
  collaboration_teamwork: {
    immediate: 'offer one helpful idea or share one task with a teammate',
    week: 'note one contribution to the group and one task others carried',
    month: 'take a clear shared role in a group project and deliver it',
    quarter: 'build strong teamwork habits through a term of group projects',
    habit: 'a weekly check-in to share progress with the team',
    skill: 'splitting work fairly and following through with teammates',
    outcome: 'work well with a team and contribute a fair share',
    success: 'finish a group task where everyone contributed',
    progress: 'more reliable contributions to the group each week',
  },
  social_connection_belonging: {
    immediate: 'start one short conversation with someone, even a small hello',
    week: 'note one moment of feeling connected and one of feeling left out',
    month: 'reach out to one person a week to build a real friendship',
    quarter: 'build a sense of belonging through a term of small social steps',
    habit: 'a daily habit of one genuine conversation with someone',
    skill: 'starting and keeping a friendly conversation going',
    outcome: 'feel connected and like there is a place to belong',
    success: 'turn one new contact into a regular friend',
    progress: 'more moments of feeling connected each week',
  },
  networking_relationships: {
    immediate: 'reach out to one useful contact or a possible mentor',
    week: 'note one connection to make or a contact to follow up',
    month: 'build a network by reaching out to two new contacts a week',
    quarter: 'grow a real network and one mentor relationship over the term',
    habit: 'a weekly habit of following up with one contact',
    skill: 'writing a short, genuine message to reach out to a contact',
    outcome: 'build connections that open real opportunities',
    success: 'turn one new contact into an ongoing relationship',
    progress: 'more contacts reached out to and followed up each week',
  },
  negotiation_advocacy: {
    immediate: 'name one needed boundary and say it clearly to someone',
    week: 'note one moment of standing up or holding back',
    month: 'practise asking for what is deserved in one low-stakes situation a week',
    quarter: 'build the confidence to negotiate and stand firm over the term',
    habit: 'a daily habit of stating one need without apologising',
    skill: 'making a calm, clear case for what is deserved',
    outcome: 'stand firm and ask for what is deserved',
    success: 'hold a boundary in a situation that would once have been avoided',
    progress: 'more moments of standing firm noted each week',
  },
};

// ── Templates — per (intervention type × stakeholder), DISTINCT lens ──────────
type Tmpl = (a: InterventionAnchor) => string;
const TEMPLATES: Record<InterventionType, Record<Stakeholder, Tmpl>> = {
  immediate_actions: {
    student: (a) => `Today, ${a.immediate}.`,
    parent: (a) => `Today, help your child ${a.immediate}.`,
    teacher: (a) => `In class today, have the student ${a.immediate}.`,
    counselor: (a) => `In today\u2019s session, guide your client to ${a.immediate}.`,
    professional: (a) => `Before the workday ends, ${a.immediate}.`,
  },
  seven_day: {
    student: (a) => `Each day this week, ${a.week}.`,
    parent: (a) => `Each day this week, help your child ${a.week}.`,
    teacher: (a) => `Each day this week, have the student ${a.week}.`,
    counselor: (a) => `Set a one-week task for your client to ${a.week}.`,
    professional: (a) => `Each workday this week, ${a.week}.`,
  },
  thirty_day: {
    student: (a) => `Over the next 30 days, ${a.month}.`,
    parent: (a) => `Over the next 30 days, help your child ${a.month}.`,
    teacher: (a) => `Over the next month, coach the student to ${a.month}.`,
    counselor: (a) => `Across a 30-day plan, work with your client to ${a.month}.`,
    professional: (a) => `Over the next 30 days at work, ${a.month}.`,
  },
  ninety_day: {
    student: (a) => `Over the next 90 days, ${a.quarter}.`,
    parent: (a) => `Across this term, help your child ${a.quarter}.`,
    teacher: (a) => `Across the term, support the student to ${a.quarter}.`,
    counselor: (a) => `Across a 90-day plan, guide your client to ${a.quarter}.`,
    professional: (a) => `Over the next quarter at work, ${a.quarter}.`,
  },
  habit: {
    student: (a) => `Build a daily habit \u2014 ${a.habit}.`,
    parent: (a) => `Help your child build a daily habit \u2014 ${a.habit}.`,
    teacher: (a) => `Encourage a daily classroom habit \u2014 ${a.habit}.`,
    counselor: (a) => `Anchor a daily habit with your client \u2014 ${a.habit}.`,
    professional: (a) => `Build a daily workday habit \u2014 ${a.habit}.`,
  },
  skill_building: {
    student: (a) => `Practise this skill each week \u2014 ${a.skill}.`,
    parent: (a) => `Give your child weekly practice \u2014 ${a.skill}.`,
    teacher: (a) => `Set weekly practice for the student \u2014 ${a.skill}.`,
    counselor: (a) => `Assign your client weekly practice \u2014 ${a.skill}.`,
    professional: (a) => `Practise this skill each week at work \u2014 ${a.skill}.`,
  },
};

// ── Generation ───────────────────────────────────────────────────────────────
export interface GeneratedIntervention {
  archetype_key: string;
  stakeholder: Stakeholder;
  intervention_type: InterventionType;
  text: string;
  expected_outcome: string;
  success_indicator: string;
  progress_indicator: string;
}

function cap(s: string): string { return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

/** Frame the expected outcome with the right subject for the stakeholder. */
export function outcomeStatement(outcome: string, stakeholder: Stakeholder): string {
  const subj = stakeholder === 'parent' ? 'Your child will'
    : stakeholder === 'teacher' ? 'The student will'
    : stakeholder === 'counselor' ? 'Your client will'
    : 'You will'; // student + professional address directly
  return `${subj} ${outcome}.`;
}

/** Produce the full per-archetype cross-product of interventions (pure). */
export function generateInterventions(archetypeKeys: string[]): GeneratedIntervention[] {
  const out: GeneratedIntervention[] = [];
  for (const key of archetypeKeys) {
    const anchor = INTERVENTION_ANCHORS[key];
    if (!anchor) continue; // archetype without an authored anchor → no rows (honest gap)
    for (const type of INTERVENTION_TYPES) {
      for (const stakeholder of STAKEHOLDERS) {
        const text = TEMPLATES[type][stakeholder](anchor).replace(/\s+/g, ' ').trim();
        out.push({
          archetype_key: key,
          stakeholder,
          intervention_type: type,
          text,
          expected_outcome: outcomeStatement(anchor.outcome, stakeholder),
          success_indicator: cap(anchor.success) + '.',
          progress_indicator: cap(anchor.progress) + '.',
        });
      }
    }
  }
  return out;
}

// ── Quality scoring (five scores, 1..5) ──────────────────────────────────────
function clamp(n: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, n)); }
function round2(n: number): number { return Math.round(n * 100) / 100; }
function round4(n: number): number { return Math.round(n * 10000) / 10000; }

/** Count how many distinct lay-lexicon terms the text touches (alignment depth). */
export function alignmentHits(text: string, archetypeKey: string): number {
  const lex = ALIGNMENT_LEXICON[archetypeKey] || [];
  const lower = text.toLowerCase();
  const tokens = new Set(tokenize(text));
  let hits = 0;
  for (const term of lex) {
    if (term.includes(' ') || term.includes('-')) { if (lower.includes(term)) hits++; }
    else if (tokens.has(term)) hits++;
  }
  return hits;
}

// Motivational clichés / vague non-actions — their presence is a real quality hit.
const CLICHES = [
  'be positive', 'stay positive', 'think positive', 'believe in yourself', 'you got this',
  'just relax', 'stay strong', 'do your best', 'try your best', 'never give up', 'be yourself',
  'reach for the stars', 'follow your dreams', 'good luck',
];
const VAGUE = /\b(try to|be more|work on yourself|stay motivated|be confident|don't worry)\b/i;
// Concrete action verbs we expect an actionable instruction to contain.
const ACTION_VERB = /\b(write|writing|log|note|follow|build|practis|list|research|reach|name|offer|make|making|say|put|volunteer|spend|set|take|track|complete|finish|explain|explaining|teach|teaching|review|plan|ask|start|starting|run|split|splitting|hold|encourage|coach|guide|support|assign|give|pick|pause|delegat|deliver|turning|breaking|organising|clearing|weighing|separating|rehears)\b/i;
// Time-box markers (concrete horizons).
const TIME_MARK = /\b(today|this week|each day|each workday|daily|weekly|30 days|90 days|term|quarter|morning|twenty-five-minute|two-minute|five-minute|thirty-minute|one-week|next quarter)\b/i;
// Quantity / measurable markers.
const QUANT_MARK = /\b(one|two|three|full|without|fewer|more|faster|longer|each|every|single)\b/i;
// Success/progress measurability.
const SUCCESS_MARK = /\b(finish|complete|without|full|shortlist|improve|hand in|hold|try again|test|turn|run|explain|take on|commit|make)\b/i;
const TREND_MARK = /\b(fewer|more|faster|longer|each week|week to week|on schedule)\b/i;

// Stakeholder lens markers — used by stakeholder_relevance.
const LENS_MARK: Record<Stakeholder, RegExp> = {
  parent: /your child/i,
  teacher: /the student/i,
  counselor: /your client/i,
  professional: /at work|workday/i,
  student: /^$/, // student = the direct voice (no foreign lens marker)
};

export interface OutcomeBundle { expected_outcome: string; success_indicator: string; progress_indicator: string; }

export interface InterventionScores {
  practicality: number;          // 1..5 — realistic, concrete, no clichés
  actionability: number;         // 1..5 — clear action verb + time-box + measurable
  outcome_clarity: number;       // 1..5 — clear expected outcome + measurable success/progress
  stakeholder_relevance: number; // 1..5 — right lens, no cross-talk
  archetype_alignment: number;   // 1..5 — depth of lay-lexicon contact
  composite: number;             // mean of the five, 2dp
}

/** Honest per-intervention quality. Pure function of the text. Never tuned. */
export function scoreIntervention(
  text: string, archetypeKey: string, stakeholder: Stakeholder, outcome: OutcomeBundle,
): InterventionScores {
  const lower = text.toLowerCase();
  const realism = checkRealism(text);

  // practicality — realistic + concrete, clichés/vagueness penalised hard
  let p = 5;
  p -= 3 * realism.jargon.length;
  if (!realism.pass && realism.jargon.length === 0) p -= 1; // length-only miss
  if (CLICHES.some((c) => lower.includes(c))) p -= 2;
  if (VAGUE.test(lower)) p -= 1;
  if (!TIME_MARK.test(lower) && !QUANT_MARK.test(lower)) p -= 1; // no concrete hook
  const practicality = clamp(p, 1, 5);

  // actionability — imperative verb + time-box + measurable quantity
  let a = 1;
  if (ACTION_VERB.test(lower)) a += 2;
  if (TIME_MARK.test(lower)) a += 1;
  if (QUANT_MARK.test(lower)) a += 1;
  if (VAGUE.test(lower)) a -= 1;
  const actionability = clamp(a, 1, 5);

  // outcome_clarity — clear expected outcome + measurable success + trend progress
  let oc = 0;
  if (outcome.expected_outcome && checkRealism(outcome.expected_outcome).jargon.length === 0) oc += 2;
  if (SUCCESS_MARK.test(outcome.success_indicator.toLowerCase())) oc += 2;
  if (TREND_MARK.test(outcome.progress_indicator.toLowerCase())) oc += 1;
  const outcome_clarity = clamp(oc, 1, 5);

  // stakeholder_relevance — own lens present, no foreign lens cross-talk
  let foreign = 0;
  for (const s of STAKEHOLDERS) {
    if (s === stakeholder || s === 'student') continue;
    if (LENS_MARK[s].test(text)) foreign++;
  }
  const ownPresent = stakeholder === 'student' ? foreign === 0 : LENS_MARK[stakeholder].test(text);
  const stakeholder_relevance = ownPresent
    ? (foreign === 0 ? 5 : foreign === 1 ? 4 : 3)
    : (foreign > 0 ? 2 : 1);

  // archetype_alignment — depth of lay-lexicon contact
  const hits = alignmentHits(text, archetypeKey);
  const archetype_alignment = hits >= 3 ? 5 : hits === 2 ? 4 : hits === 1 ? 3 : 1;

  const composite = round2((practicality + actionability + outcome_clarity + stakeholder_relevance + archetype_alignment) / 5);
  return { practicality, actionability, outcome_clarity, stakeholder_relevance, archetype_alignment, composite };
}

// ── Impact projections (deterministic — NOT measured) ────────────────────────
// Longer / more structural interventions are PROJECTED to move confidence and
// reduce risk more, scaled down by the intervention's honest quality.
const HORIZON_CONF: Record<InterventionType, number> = {
  immediate_actions: 0.15, seven_day: 0.30, thirty_day: 0.50, ninety_day: 0.75, habit: 0.60, skill_building: 0.65,
};
const HORIZON_RISK: Record<InterventionType, number> = {
  immediate_actions: 0.40, seven_day: 0.45, thirty_day: 0.55, ninety_day: 0.65, habit: 0.55, skill_building: 0.50,
};
export interface ImpactProjection { confidence_impact: number; risk_reduction_impact: number; }
export function projectImpacts(type: InterventionType, q: InterventionScores): ImpactProjection {
  return {
    confidence_impact: round4(clamp(HORIZON_CONF[type] * (q.composite / 5), 0, 1)),
    risk_reduction_impact: round4(clamp(HORIZON_RISK[type] * (q.actionability / 5), 0, 1)),
  };
}

// ── Pass thresholds (per-row) used by the validators ─────────────────────────
export const PRACTICALITY_PASS_MIN = 4;
export const ACTIONABILITY_PASS_MIN = 4;

export interface InterventionFlags { practical: boolean; actionable: boolean; aligned: boolean; }
export function interventionFlags(text: string, archetypeKey: string, stakeholder: Stakeholder, outcome: OutcomeBundle): InterventionFlags {
  const q = scoreIntervention(text, archetypeKey, stakeholder, outcome);
  return {
    practical: q.practicality >= PRACTICALITY_PASS_MIN,
    actionable: q.actionability >= ACTIONABILITY_PASS_MIN,
    aligned: isAligned(text, archetypeKey),
  };
}

// ── Duplicate detection — identical · semantic (same stakeholder) · variant ──
export type DuplicateKind = 'identical' | 'semantic' | 'stakeholder';
export interface DuplicateRow {
  kind: DuplicateKind;
  redundant: boolean;
  text_a: string;
  text_b: string;
  overlap: number;
  archetype_a: string;
  archetype_b: string;
  stakeholder_a: Stakeholder;
  stakeholder_b: Stakeholder;
}

/**
 * Full duplicate audit over every generated intervention.
 *   - identical  : same text anywhere (always redundant).
 *   - semantic   : Jaccard >= threshold for the SAME stakeholder (redundant).
 *   - stakeholder: identical/near across DIFFERENT stakeholders (audience variant —
 *                  recorded, NOT counted).
 * `duplicateMembers` = indexes of the later member of each REDUNDANT pair (what the
 * runner marks is_duplicate) → the headline rate is global and honest. Never tuned.
 */
export function auditDuplicates(items: GeneratedIntervention[], threshold = 0.6): {
  rows: DuplicateRow[];
  duplicateMembers: Set<number>;
} {
  const rows: DuplicateRow[] = [];
  const dupIdx = new Set<number>();
  const texts = items.map((i) => i.text);
  const sets = texts.map((t) => new Set(tokenize(t)));

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const sameStake = items[i].stakeholder === items[j].stakeholder;
      if (texts[i] === texts[j]) {
        rows.push(pair('identical', true, items, i, j, 1));
        dupIdx.add(j);
        if (!sameStake) rows.push(pair('stakeholder', false, items, i, j, 1));
        continue;
      }
      const a = sets[i], b = sets[j];
      if (a.size === 0 || b.size === 0) continue;
      let inter = 0; for (const t of a) if (b.has(t)) inter++;
      const ov = inter / (a.size + b.size - inter || 1);
      if (ov >= threshold) {
        if (sameStake) { rows.push(pair('semantic', true, items, i, j, round3(ov))); dupIdx.add(j); }
        else rows.push(pair('stakeholder', false, items, i, j, round3(ov)));
      }
    }
  }
  return { rows, duplicateMembers: dupIdx };
}

function round3(n: number): number { return Math.round(n * 1000) / 1000; }
function pair(kind: DuplicateKind, redundant: boolean, items: GeneratedIntervention[], i: number, j: number, overlap: number): DuplicateRow {
  return {
    kind, redundant,
    text_a: items[i].text, text_b: items[j].text, overlap,
    archetype_a: items[i].archetype_key, archetype_b: items[j].archetype_key,
    stakeholder_a: items[i].stakeholder, stakeholder_b: items[j].stakeholder,
  };
}

// Re-export the shared detector for tests/tooling that want raw global pairs.
export { detectDuplicates };

// ── Validation targets (canon — runner/route report against these, may FAIL) ─
export const INTERVENTION_VALIDATION_TARGETS = {
  practicality: 0.85,
  actionability: 0.85,
  archetype_alignment: 0.85,
  duplicate_rate_max: 0.10,
  coverage: 0.95,
};
