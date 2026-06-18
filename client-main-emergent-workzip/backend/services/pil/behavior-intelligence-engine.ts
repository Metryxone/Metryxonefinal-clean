/**
 * CAPADEX Problem Intelligence Layer (PIL) — Phase 1.6: Behavioral Intelligence
 * Layer (pure, deterministic, rule-based — NO external AI).
 *
 * Builds the missing OBSERVABLE-BEHAVIOR layer between capabilities and problems:
 *     Capability ↔ Problem State ↔ Observable Behavior
 * It is the evidence layer for explainable assessments.
 *
 * EXTENSION-ONLY: reads ONLY the Phase-1.5 extension tables (normalized_concern_
 * ontology, capability_problem_map, concern_families, construct_similarity_map)
 * and writes ONLY the new Phase-1.6 tables. Never mutates existing CAPADEX data.
 *
 * HONESTY MODEL (quality over quantity): behaviors come from a CURATED, token-keyed
 * pattern library of real-world observable actions. A concern whose construct tokens
 * match no curated theme receives generic-category placeholders that the quality
 * engine deliberately REJECTS (total < 15) — so weak coverage is surfaced by the
 * family coverage audit instead of being hidden behind fabricated specificity.
 */

// ── Enumerations ─────────────────────────────────────────────────────────────
export type BehaviorCategory =
  | 'Academic' | 'Career' | 'Social' | 'Emotional'
  | 'Cognitive' | 'Leadership' | 'Self-Management' | 'Learning';
export const BEHAVIOR_CATEGORIES: BehaviorCategory[] = [
  'Academic', 'Career', 'Social', 'Emotional',
  'Cognitive', 'Leadership', 'Self-Management', 'Learning',
];

export type Severity = 'Mild' | 'Moderate' | 'Significant';
export const SEVERITIES: Severity[] = ['Mild', 'Moderate', 'Significant'];

export type AgeBand = '10-13' | '14-18' | '19-25' | '26-40' | '40+';
export const AGE_BANDS: AgeBand[] = ['10-13', '14-18', '19-25', '26-40', '40+'];

// Severity is modelled as observable FREQUENCY (measurable), not vague intensity.
const SEVERITY_ADVERB: Record<Severity, string> = {
  Mild: 'Occasionally',
  Moderate: 'Frequently',
  Significant: 'Consistently',
};

// Age-appropriate slot lexicon. Frames reference these slots so the same construct
// yields a genuinely different real-world statement per life stage.
const AGE_SLOTS: Record<string, Record<AgeBand, string>> = {
  task: { '10-13': 'homework', '14-18': 'assignments', '19-25': 'coursework', '26-40': 'work projects', '40+': 'work commitments' },
  setting: { '10-13': 'class', '14-18': 'school', '19-25': 'college', '26-40': 'the workplace', '40+': 'the workplace' },
  peers: { '10-13': 'classmates', '14-18': 'classmates', '19-25': 'peers', '26-40': 'colleagues', '40+': 'colleagues' },
  evaluation: { '10-13': 'tests', '14-18': 'exams', '19-25': 'exams', '26-40': 'performance reviews', '40+': 'performance reviews' },
  authority: { '10-13': 'the teacher', '14-18': 'teachers', '19-25': 'lecturers', '26-40': 'managers', '40+': 'leaders' },
};

function resolveSlots(template: string, age: AgeBand): string {
  return template.replace(/\{(\w+)\}/g, (_m, slot) => AGE_SLOTS[slot]?.[age] ?? slot);
}

// ── Behavior pattern library ────────────────────────────────────────────────
// Each frame is a PROBLEM-SIDE observable behavior (the manifestation of the
// deficit) written as a verb-led action, optionally carrying age slots. `tokens`
// are the construct tokens that trigger the frame.
export interface BehaviorFrame {
  id: string;
  tokens: string[];
  category: BehaviorCategory;
  action: string; // verb-led, may contain {slot}
}

export const BEHAVIOR_FRAMES: BehaviorFrame[] = [
  // Self-Management — time / deadlines / procrastination
  { id: 'time_deadline', tokens: ['time', 'deadline', 'deadlines'], category: 'Self-Management', action: 'misses {task} deadlines' },
  { id: 'time_lastminute', tokens: ['time', 'procrastination', 'deadline'], category: 'Self-Management', action: 'starts {task} at the last minute' },
  { id: 'time_estimate', tokens: ['time', 'planning'], category: 'Self-Management', action: 'underestimates how long {task} will take' },
  { id: 'procrastination_delay', tokens: ['procrastination', 'delay'], category: 'Self-Management', action: 'puts off starting {task} until pressured' },
  { id: 'procrastination_incomplete', tokens: ['procrastination', 'completion'], category: 'Self-Management', action: 'leaves {task} unfinished' },
  // Self-Management — planning / organization
  { id: 'plan_disorganized', tokens: ['planning', 'organization', 'organisation'], category: 'Self-Management', action: 'loses track of {task} and materials' },
  { id: 'plan_noplan', tokens: ['planning', 'goals', 'goal'], category: 'Self-Management', action: 'works without a clear plan for {task}' },
  { id: 'plan_priorities', tokens: ['planning', 'priorities', 'prioritization'], category: 'Self-Management', action: 'struggles to decide what to do first' },
  // Self-Management — discipline / habits / consistency
  { id: 'discipline_inconsistent', tokens: ['discipline', 'consistency', 'habits', 'habit'], category: 'Self-Management', action: 'abandons routines for {task} after a few days' },
  { id: 'discipline_distracted', tokens: ['discipline', 'focus'], category: 'Self-Management', action: 'gets pulled away from {task} by distractions' },
  // Self-Management — motivation / ownership / accountability
  { id: 'motivation_low', tokens: ['motivation', 'engagement', 'drive'], category: 'Self-Management', action: 'shows little energy for starting {task}' },
  { id: 'ownership_blame', tokens: ['ownership', 'accountability', 'responsibility'], category: 'Self-Management', action: 'blames others when {task} goes wrong' },
  { id: 'ownership_passive', tokens: ['ownership', 'initiative'], category: 'Self-Management', action: 'waits to be told what to do next' },

  // Cognitive — focus / attention / distraction
  { id: 'focus_drift', tokens: ['focus', 'attention', 'concentration'], category: 'Cognitive', action: 'loses focus within minutes of starting {task}' },
  { id: 'focus_distract', tokens: ['focus', 'distraction', 'scrolling'], category: 'Cognitive', action: 'checks the phone repeatedly during {task}' },
  { id: 'focus_switch', tokens: ['attention', 'multitasking'], category: 'Cognitive', action: 'switches between tasks without finishing any' },
  // Cognitive — thinking / problem-solving / analysis
  { id: 'think_stuck', tokens: ['thinking', 'problem', 'reasoning'], category: 'Cognitive', action: 'freezes when a problem has no obvious answer' },
  { id: 'think_surface', tokens: ['thinking', 'analysis', 'analytical', 'critical'], category: 'Cognitive', action: 'accepts the first idea without checking it' },
  { id: 'think_overthink', tokens: ['overthinking', 'rumination'], category: 'Cognitive', action: 'replays the same worry without acting' },
  // Cognitive — decision making
  { id: 'decision_delay', tokens: ['decision', 'choice', 'making'], category: 'Cognitive', action: 'puts off making decisions about {task}' },
  { id: 'decision_secondguess', tokens: ['decision', 'doubt'], category: 'Cognitive', action: 'changes the decision repeatedly after making it' },
  // Cognitive — comprehension / understanding / memory
  { id: 'comp_misunderstand', tokens: ['understanding', 'comprehension', 'clarity'], category: 'Cognitive', action: 'misreads instructions for {task}' },
  { id: 'comp_forget', tokens: ['memory', 'recall', 'retention'], category: 'Cognitive', action: 'forgets material learned for {evaluation}' },

  // Academic — study / revision / reading / exams
  { id: 'study_irregular', tokens: ['study', 'revision', 'revise'], category: 'Academic', action: 'skips planned study sessions' },
  { id: 'study_cram', tokens: ['exam', 'exams', 'test', 'preparation', 'revision'], category: 'Academic', action: 'crams the night before {evaluation}' },
  { id: 'study_passive', tokens: ['study', 'learning', 'comprehension'], category: 'Academic', action: 're-reads notes without testing recall' },
  { id: 'academic_avoid', tokens: ['academic', 'subjects', 'subject', 'classroom'], category: 'Academic', action: 'avoids the hardest {task}' },
  { id: 'reading_skip', tokens: ['reading', 'literacy', 'comprehension'], category: 'Academic', action: 'skims readings without absorbing them' },
  { id: 'writing_struggle', tokens: ['writing', 'expression'], category: 'Academic', action: 'struggles to put ideas into writing' },

  // Learning — curiosity / growth / skill / adaptability / feedback
  { id: 'learn_incurious', tokens: ['curiosity', 'learning', 'growth'], category: 'Learning', action: 'rarely explores topics beyond what is required' },
  { id: 'learn_feedback', tokens: ['feedback', 'criticism', 'improvement'], category: 'Learning', action: 'ignores feedback meant to improve {task}' },
  { id: 'learn_giveup', tokens: ['learning', 'persistence', 'resilience'], category: 'Learning', action: 'gives up after the first mistake' },
  { id: 'adapt_resist', tokens: ['adaptability', 'change', 'transition', 'flexibility'], category: 'Learning', action: 'resists new ways of doing {task}' },
  { id: 'skill_plateau', tokens: ['skill', 'skills', 'competence', 'competency', 'mastery'], category: 'Learning', action: 'repeats the same approach despite poor results' },

  // Social — communication / collaboration / peers / conflict
  { id: 'comm_quiet', tokens: ['communication', 'speaking', 'voice'], category: 'Social', action: 'avoids speaking up in {setting}' },
  { id: 'comm_short', tokens: ['communication', 'expression'], category: 'Social', action: 'gives very short, vague answers' },
  { id: 'present_avoid', tokens: ['presentation', 'speaking', 'public'], category: 'Social', action: 'avoids presenting in front of {peers}' },
  { id: 'collab_withdraw', tokens: ['collaboration', 'teamwork', 'team', 'group'], category: 'Social', action: 'stays silent during group work with {peers}' },
  { id: 'social_isolate', tokens: ['social', 'peer', 'relationship', 'belonging'], category: 'Social', action: 'keeps to themselves around {peers}' },
  { id: 'conflict_avoid', tokens: ['conflict', 'disagreement', 'assertiveness'], category: 'Social', action: 'avoids disagreements even when it matters' },

  // Emotional — anxiety / stress / fear / mood / burnout / confidence
  { id: 'anx_worry', tokens: ['anxiety', 'worry', 'nervousness'], category: 'Emotional', action: 'worries excessively before {evaluation}' },
  { id: 'stress_overwhelm', tokens: ['stress', 'pressure', 'overwhelm', 'overload'], category: 'Emotional', action: 'feels overwhelmed by {task}' },
  { id: 'fear_avoid', tokens: ['fear', 'failure', 'dread'], category: 'Emotional', action: 'avoids challenges for fear of failing' },
  { id: 'mood_react', tokens: ['emotional', 'mood', 'regulation', 'reactivity'], category: 'Emotional', action: 'reacts strongly to small setbacks' },
  { id: 'burnout_drained', tokens: ['burnout', 'fatigue', 'exhaustion', 'wellbeing'], category: 'Emotional', action: 'feels drained and disengaged from {task}' },
  { id: 'conf_doubt', tokens: ['confidence', 'self-doubt', 'insecurity', 'esteem'], category: 'Emotional', action: 'doubts their ability to handle {task}' },
  { id: 'compare_self', tokens: ['comparison', 'validation'], category: 'Emotional', action: 'compares themselves unfavourably to {peers}' },

  // Career — career / professional / workplace / visibility / identity
  { id: 'career_unclear', tokens: ['career', 'direction', 'clarity', 'aspirational'], category: 'Career', action: 'cannot describe a clear next career step' },
  { id: 'career_passive', tokens: ['career', 'opportunities', 'readiness'], category: 'Career', action: 'misses opportunities by not acting on them' },
  { id: 'work_visibility', tokens: ['visibility', 'strategic', 'recognition'], category: 'Career', action: 'lets their contributions go unnoticed at {setting}' },
  { id: 'work_network', tokens: ['networking', 'relationship', 'professional'], category: 'Career', action: 'avoids building professional relationships' },
  { id: 'identity_unsure', tokens: ['identity', 'purpose', 'meaning'], category: 'Career', action: 'feels unsure of where they fit at {setting}' },
  { id: 'interview_underprepare', tokens: ['interview', 'interviews', 'preparation'], category: 'Career', action: 'under-prepares for interviews' },

  // Leadership — leadership / influence / delegation / vision
  { id: 'lead_avoid', tokens: ['leadership', 'influence', 'authority'], category: 'Leadership', action: 'avoids taking the lead with {peers}' },
  { id: 'lead_delegate', tokens: ['delegation', 'leadership', 'ownership'], category: 'Leadership', action: 'takes on everything instead of delegating' },
  { id: 'lead_vision', tokens: ['vision', 'strategic', 'direction'], category: 'Leadership', action: 'struggles to set direction for {peers}' },
  { id: 'lead_feedback', tokens: ['leadership', 'feedback'], category: 'Leadership', action: 'hesitates to give others honest feedback' },

  // Additional high-frequency constructs (observable, age-aware)
  { id: 'self_awareness', tokens: ['awareness', 'reflection', 'reflective'], category: 'Emotional', action: 'rarely notices how their actions affect {peers}' },
  { id: 'expectations_meet', tokens: ['expectations', 'expectation'], category: 'Self-Management', action: 'struggles to meet expectations set by {authority}' },
  { id: 'performance_under', tokens: ['performance', 'underperformance'], category: 'Career', action: 'underperforms relative to their ability at {setting}' },
  { id: 'stability_shaky', tokens: ['stability', 'steadiness', 'composure'], category: 'Emotional', action: 'struggles to stay steady when routines change' },
  { id: 'uncertainty_freeze', tokens: ['uncertainty', 'ambiguity', 'unclear'], category: 'Cognitive', action: 'freezes when the path forward is unclear' },
  { id: 'recovery_bounce', tokens: ['recovery', 'recover', 'resilience'], category: 'Emotional', action: 'struggles to bounce back after setbacks' },
  { id: 'culture_fit', tokens: ['culture', 'belonging', 'fit'], category: 'Career', action: 'struggles to fit into the culture at {setting}' },
  { id: 'alignment_drift', tokens: ['alignment', 'align', 'misalignment'], category: 'Career', action: 'works on tasks misaligned with their goals' },
  { id: 'preparation_under', tokens: ['preparation', 'prepare', 'unprepared'], category: 'Self-Management', action: 'arrives underprepared for {task}' },
];

// Generic category fallbacks (deliberately weak; rejected by the quality gate).
const GENERIC_FRAMES: Record<BehaviorCategory, string[]> = {
  Academic: ['shows difficulty with {task}', 'avoids tasks related to {task}', 'needs reminders to complete {task}'],
  Career: ['struggles to make progress at {setting}', 'avoids tasks tied to career growth', 'hesitates to act on opportunities'],
  Social: ['holds back when interacting with {peers}', 'avoids social situations at {setting}', 'gives limited input around {peers}'],
  Emotional: ['shows visible discomfort during {task}', 'struggles to stay composed under pressure', 'reacts negatively to setbacks'],
  Cognitive: ['has difficulty thinking through {task}', 'gets stuck when {task} is unfamiliar', 'avoids mentally demanding {task}'],
  Leadership: ['avoids responsibility around {peers}', 'steps back from leading {task}', 'hesitates to take initiative'],
  'Self-Management': ['struggles to organize {task}', 'needs prompting to keep up with {task}', 'lets {task} slip without follow-through'],
  Learning: ['avoids learning new approaches to {task}', 'repeats the same mistakes with {task}', 'shows little drive to improve'],
};

// ── Token → category (for concerns whose frames are mixed / generic) ─────────
const TOKEN_CATEGORY: Record<string, BehaviorCategory> = {
  academic: 'Academic', study: 'Academic', exam: 'Academic', exams: 'Academic', revision: 'Academic',
  classroom: 'Academic', subjects: 'Academic', reading: 'Academic', writing: 'Academic',
  career: 'Career', professional: 'Career', workplace: 'Career', industry: 'Career', interview: 'Career',
  visibility: 'Career', strategic: 'Career', job: 'Career', promotion: 'Career', identity: 'Career',
  social: 'Social', peer: 'Social', collaboration: 'Social', teamwork: 'Social', communication: 'Social',
  relationship: 'Social', conflict: 'Social', presentation: 'Social',
  emotional: 'Emotional', anxiety: 'Emotional', stress: 'Emotional', fear: 'Emotional', mood: 'Emotional',
  burnout: 'Emotional', fatigue: 'Emotional', pressure: 'Emotional', confidence: 'Emotional', wellbeing: 'Emotional',
  thinking: 'Cognitive', focus: 'Cognitive', attention: 'Cognitive', decision: 'Cognitive', problem: 'Cognitive',
  analysis: 'Cognitive', understanding: 'Cognitive', memory: 'Cognitive', comprehension: 'Cognitive',
  leadership: 'Leadership', influence: 'Leadership', delegation: 'Leadership', vision: 'Leadership',
  time: 'Self-Management', planning: 'Self-Management', organization: 'Self-Management', discipline: 'Self-Management',
  habits: 'Self-Management', procrastination: 'Self-Management', goals: 'Self-Management', motivation: 'Self-Management',
  ownership: 'Self-Management', accountability: 'Self-Management', consistency: 'Self-Management',
  learning: 'Learning', curiosity: 'Learning', skill: 'Learning', growth: 'Learning', adaptability: 'Learning',
  feedback: 'Learning',
};

// ── Tokenization (light; mirrors the ontology engine's intent) ───────────────
const STOP = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'and', 'or', 'for', 'with', 'your', 'you',
  'on', 'at', 'by', 'about', 'is', 'are', 'be', 'more', 'less', 'their', 'when',
  'while', 'as', 'too', 'very', 'this', 'that', 'across', 'during', 'within',
  'difficulty', 'weak', 'weakness', 'poor', 'lack', 'limited', 'inability',
  'managing', 'building', 'developing', 'maintaining', 'handling', 'without',
]);
export function tokenize(s?: string | null): string[] {
  if (!s) return [];
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

// ── Concern category inference ───────────────────────────────────────────────
export function inferCategory(tokens: string[], domain?: string | null): BehaviorCategory {
  const votes = new Map<BehaviorCategory, number>();
  const vote = (c: BehaviorCategory, n = 1) => votes.set(c, (votes.get(c) ?? 0) + n);
  for (const t of tokens) { const c = TOKEN_CATEGORY[t]; if (c) vote(c, 2); }
  for (const t of tokenize(domain)) { const c = TOKEN_CATEGORY[t]; if (c) vote(c, 1); }
  if (votes.size === 0) return 'Self-Management';
  return [...votes.entries()].sort((a, b) =>
    b[1] - a[1] || BEHAVIOR_CATEGORIES.indexOf(a[0]) - BEHAVIOR_CATEGORIES.indexOf(b[0]))[0][0];
}

// ── 1.6A — behavior generation ───────────────────────────────────────────────
export interface GeneratedBehavior {
  statement: string;       // base (age-neutral template) observable behavior
  category: BehaviorCategory;
  frame_id: string;
  source: 'curated' | 'generic_fallback';
}

export function generateBehaviors(concern: {
  concern_id: string;
  concern_name?: string | null;
  domain?: string | null;
}, opts: { min?: number; max?: number } = {}): GeneratedBehavior[] {
  const min = opts.min ?? 3;
  const max = opts.max ?? 5;
  const tokens = new Set(tokenize(concern.concern_name));
  const primaryCategory = inferCategory([...tokens], concern.domain);

  // Score each frame by how many of its tokens the concern contains.
  const scored = BEHAVIOR_FRAMES
    .map((f) => ({ f, hits: f.tokens.filter((t) => tokens.has(t)).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.f.id.localeCompare(b.f.id));

  const out: GeneratedBehavior[] = [];
  const seenStmt = new Set<string>();
  for (const { f } of scored) {
    if (out.length >= max) break;
    if (seenStmt.has(f.action)) continue;
    seenStmt.add(f.action);
    out.push({ statement: f.action, category: f.category, frame_id: f.id, source: 'curated' });
  }

  // Fill to the minimum with generic-category placeholders (weak by design).
  if (out.length < min) {
    for (const g of GENERIC_FRAMES[primaryCategory]) {
      if (out.length >= min) break;
      if (seenStmt.has(g)) continue;
      seenStmt.add(g);
      out.push({ statement: g, category: primaryCategory, frame_id: `generic_${primaryCategory}`, source: 'generic_fallback' });
    }
  }
  return out;
}

// ── 1.6C / 1.6D — severity + age expansion ───────────────────────────────────
export function expandStatement(base: string, severity: Severity, age: AgeBand): string {
  const resolved = resolveSlots(base, age);
  return `${SEVERITY_ADVERB[severity]} ${resolved}`;
}

// ── 1.6F — behavior quality engine (each sub-score 1–5; reject total < 15) ────
export interface QualityScore {
  observability: number;
  human_realism: number;
  distinctiveness: number;
  actionability: number;
  total: number;
  accepted: boolean;
}
export const QUALITY_REJECT_BELOW = 15;

const CONCRETE_VERBS = new Set([
  'misses', 'starts', 'leaves', 'puts', 'loses', 'works', 'struggles', 'abandons',
  'gets', 'shows', 'blames', 'waits', 'checks', 'switches', 'freezes', 'accepts',
  'replays', 'changes', 'misreads', 'forgets', 'skips', 'crams', 're-reads',
  'avoids', 'skims', 'rarely', 'ignores', 'gives', 'repeats', 'stays', 'keeps',
  'worries', 'feels', 'reacts', 'doubts', 'compares', 'cannot', 'lets',
  'takes', 'hesitates', 'underestimates', 'under-prepares', 'underperforms',
  'arrives',
]);

export function scoreQuality(b: GeneratedBehavior, distinctInConcern: boolean): QualityScore {
  const firstWord = b.statement.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  const isConcrete = CONCRETE_VERBS.has(firstWord);
  const curated = b.source === 'curated';

  const observability = curated ? 5 : 3;                 // curated = directly observable action
  const human_realism = curated ? (isConcrete ? 5 : 4) : 2;
  const distinctiveness = distinctInConcern ? (curated ? 4 : 2) : 1;
  const actionability = curated && isConcrete ? 5 : curated ? 4 : 3;
  const total = observability + human_realism + distinctiveness + actionability;
  return { observability, human_realism, distinctiveness, actionability, total, accepted: total >= QUALITY_REJECT_BELOW };
}

// ── 1.6G — duplicate detection (semantic / wording / severity) ───────────────
export interface DuplicatePair {
  a: string;
  b: string;
  reason: 'identical' | 'semantic';
  overlap: number;
}
function stmtTokens(s: string): Set<string> {
  return new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t.length > 2));
}
/** Flags near-duplicate behaviors WITHIN one concern (same severity level implied). */
export function detectDuplicates(statements: string[], threshold = 0.6): DuplicatePair[] {
  const out: DuplicatePair[] = [];
  const sets = statements.map(stmtTokens);
  for (let i = 0; i < statements.length; i++) {
    for (let j = i + 1; j < statements.length; j++) {
      if (statements[i] === statements[j]) { out.push({ a: statements[i], b: statements[j], reason: 'identical', overlap: 1 }); continue; }
      const a = sets[i], b = sets[j];
      let inter = 0; for (const t of a) if (b.has(t)) inter++;
      const ov = inter / (a.size + b.size - inter || 1);
      if (ov >= threshold) out.push({ a: statements[i], b: statements[j], reason: 'semantic', overlap: Math.round(ov * 1000) / 1000 });
    }
  }
  return out;
}

// ── 1.6E — confidence for a capability–problem–behavior mapping row ──────────
export function mappingConfidence(q: QualityScore, conceptConfidence: number, source: GeneratedBehavior['source']): number {
  const qNorm = q.total / 20;                       // 0..1
  const base = 0.5 * qNorm + 0.4 * conceptConfidence + (source === 'curated' ? 0.1 : 0);
  return Math.round(Math.min(0.99, Math.max(0.1, base)) * 10000) / 10000;
}

// ── 1.6 — explainability readiness score (0–100) ─────────────────────────────
export function explainabilityReadiness(input: {
  concernsTotal: number;
  concernsWithBehaviors: number;       // ≥ min accepted behaviors
  capabilitiesMapped: number;
  capabilitiesTotal: number;
  problemsMapped: number;
  problemsTotal: number;
  avgQualityNorm: number;              // 0..1 over accepted behaviors
}): number {
  const safe = (n: number, d: number) => (d === 0 ? 0 : n / d);
  const score =
    40 * safe(input.concernsWithBehaviors, input.concernsTotal) +
    20 * safe(input.capabilitiesMapped, input.capabilitiesTotal) +
    20 * safe(input.problemsMapped, input.problemsTotal) +
    20 * input.avgQualityNorm;
  return Math.round(score * 10) / 10;
}
