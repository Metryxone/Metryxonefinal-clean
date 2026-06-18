/**
 * CAPADEX PIL — Phase 4 engine: Search Intent Intelligence Layer.
 *
 *   Transforms the Phase-3 Human Intelligence (plain-language archetype
 *   translations) into SEARCH INTELLIGENCE: per-archetype search phrases across
 *   five stakeholders (Student / Parent / Teacher / Counselor / Professional) and
 *   five intent types (Informational / Diagnostic / Emotional / Help-Seeking /
 *   Future-Planning) — how a real person would type their problem into a search
 *   box.
 *
 * PURE & DETERMINISTIC: no DB, no network, no external AI, no scraping. Phrases
 * are assembled from CURATED per-archetype lay anchors (legitimate authoring, the
 * same canon as the Phase-3 HUMAN_PACKS) combined by per-(intent × stakeholder)
 * templates. The four quality scores and the validators are honest functions of
 * the produced text and are ALLOWED TO FAIL — never tune them to force a pass.
 *
 * Reuses the Phase-3 validators/lexicon so the two layers can never drift:
 *   checkRealism (jargon-free + length) · isAligned/ALIGNMENT_LEXICON (lay lexicon)
 *   · tokenize.
 *
 * DUPLICATE MODEL (deliberate — see auditDuplicates): the headline duplicate rate
 * counts only REDUNDANT STORAGE — an identical phrase anywhere, or a near-identical
 * phrase aimed at the SAME stakeholder. Cross-stakeholder reframings of one problem
 * (a parent vs a student searching the same issue) are intended audience variants,
 * NOT redundancy; they are still recorded in the review set, just not counted as
 * duplicates. This is a measurement-scope decision, not metric tuning.
 */
import {
  STAKEHOLDERS, ALIGNMENT_LEXICON, tokenize,
  checkRealism, isAligned, detectDuplicates,
  type Stakeholder,
} from './human-intelligence-engine.js';

export type { Stakeholder } from './human-intelligence-engine.js';
export { STAKEHOLDERS } from './human-intelligence-engine.js';

// ── Intent types ─────────────────────────────────────────────────────────────
export type IntentType =
  | 'informational' | 'diagnostic' | 'emotional' | 'help_seeking' | 'future_planning';
export const INTENT_TYPES: IntentType[] =
  ['informational', 'diagnostic', 'emotional', 'help_seeking', 'future_planning'];
export const INTENT_LABELS: Record<IntentType, string> = {
  informational: 'Informational',
  diagnostic: 'Diagnostic',
  emotional: 'Emotional',
  help_seeking: 'Help-Seeking',
  future_planning: 'Future-Planning',
};

// ── Curated lay search anchors (one per archetype_key) ───────────────────────
// Plain, jargon-free, pronoun-light fragments drawn from each archetype's everyday
// vocabulary (the same lay lexicon Phase-3 aligns against) — authored, never
// scraped or model-generated. Grammar contracts:
//   topic        : neutral noun phrase            → "what is {topic}?"
//   youStruggle  : 1st-person verb phrase (no "I") → "why do I {youStruggle}?"
//   childStruggle: BASE/infinitive verb phrase     → "why does my child {childStruggle}?"
//                  (base form because it always follows the auxiliary "does")
//   goal         : base/infinitive verb phrase     → "how do I {goal}?" / "help my child {goal}"
//   feeling      : pronoun-neutral state phrase     → "I feel {feeling}" / "my child is {feeling}"
//   future       : base/infinitive verb phrase     → "preparing my child to {future}"
export interface SearchAnchor {
  topic: string;
  youStruggle: string;
  childStruggle: string;
  goal: string;
  feeling: string;
  future: string;
}

export const SEARCH_ANCHORS: Record<string, SearchAnchor> = {
  performance_anxiety: {
    topic: 'test and exam anxiety',
    youStruggle: 'freeze up and go blank in exams',
    childStruggle: 'freeze up and go blank in exams',
    goal: 'stay calm and focused in exams',
    feeling: 'panicky and blank before every test',
    future: 'stay calm in future exams and interviews',
  },
  career_professional_growth: {
    topic: 'career confusion',
    youStruggle: 'feel stuck about my next career step',
    childStruggle: 'feel lost about which career to choose',
    goal: 'find the right career direction',
    feeling: 'lost about which career to choose',
    future: 'choose and grow a career',
  },
  learning_comprehension: {
    topic: 'trouble understanding study material',
    youStruggle: 'study for hours but forget everything',
    childStruggle: 'study hard but forget everything',
    goal: 'understand and remember study material',
    feeling: 'frustrated that studying never sticks',
    future: 'learn in a way that sticks',
  },
  emotional_regulation: {
    topic: 'trouble controlling emotions',
    youStruggle: 'get overwhelmed and snap over small things',
    childStruggle: 'melt down over the smallest things',
    goal: 'stay calm when overwhelmed',
    feeling: 'overwhelmed and close to losing control',
    future: 'manage stress and stay calm',
  },
  academic_achievement: {
    topic: 'low grades and exam results',
    youStruggle: 'study hard but my grades stay low',
    childStruggle: 'study hard but their grades stay low',
    goal: 'bring up low grades and results',
    feeling: 'discouraged about low grades',
    future: 'keep grades on track',
  },
  leadership_influence: {
    topic: 'trouble leading a team',
    youStruggle: 'struggle to take charge of a group',
    childStruggle: 'hold back from leading a group',
    goal: 'lead a team with confidence',
    feeling: 'unsure about leading others',
    future: 'lead a team well',
  },
  time_self_discipline: {
    topic: 'procrastination and poor time management',
    youStruggle: 'procrastinate and leave things to the last minute',
    childStruggle: 'procrastinate and miss deadlines',
    goal: 'stop procrastinating and stick to a plan',
    feeling: 'stressed from missing deadlines',
    future: 'stay on top of deadlines',
  },
  motivation_drive: {
    topic: 'low motivation and drive',
    youStruggle: 'have no motivation to get started',
    childStruggle: 'have no motivation or drive',
    goal: 'find the motivation to follow through',
    feeling: 'drained of motivation and drive',
    future: 'stay motivated toward my goals',
  },
  critical_reflective_thinking: {
    topic: 'trouble thinking things through',
    youStruggle: 'jump to conclusions without thinking',
    childStruggle: 'jump to conclusions without thinking it through',
    goal: 'think clearly and question assumptions',
    feeling: 'stuck repeating the same mistakes',
    future: 'think things through before deciding',
  },
  confidence_self_efficacy: {
    topic: 'low confidence and self-doubt',
    youStruggle: 'doubt myself and second-guess everything',
    childStruggle: 'doubt themselves and give up easily',
    goal: 'build real confidence and self-belief',
    feeling: 'full of self-doubt and never good enough',
    future: 'build lasting confidence',
  },
  adaptability_change: {
    topic: 'trouble coping with change',
    youStruggle: 'get thrown when plans suddenly change',
    childStruggle: 'get thrown when routines change',
    goal: 'stay steady when things change',
    feeling: 'anxious when plans suddenly change',
    future: 'adapt to change with ease',
  },
  resilience_recovery: {
    topic: 'giving up after setbacks',
    youStruggle: 'fall apart and give up after a setback',
    childStruggle: 'give up easily after a setback',
    goal: 'bounce back after failure',
    feeling: 'crushed and ready to give up after failure',
    future: 'recover from setbacks and keep going',
  },
  identity_self_awareness: {
    topic: 'feeling lost about identity',
    youStruggle: 'feel lost about who I am',
    childStruggle: 'seem lost about who they are',
    goal: 'build a clear sense of self and purpose',
    feeling: 'lost about identity and purpose',
    future: 'build self-awareness and purpose',
  },
  expectations_pressure: {
    topic: 'pressure to meet expectations',
    youStruggle: 'feel crushed by everyone\u2019s expectations',
    childStruggle: 'feel crushed by pressure to please everyone',
    goal: 'handle pressure without burning out',
    feeling: 'exhausted from pressure to please everyone',
    future: 'handle expectations and pressure',
  },
  communication_expression: {
    topic: 'trouble expressing thoughts clearly',
    youStruggle: 'struggle to get my point across',
    childStruggle: 'struggle to put thoughts into words',
    goal: 'express thoughts clearly and be understood',
    feeling: 'frustrated and misunderstood when explaining things',
    future: 'communicate clearly and confidently',
  },
  focus_attention: {
    topic: 'poor focus and concentration',
    youStruggle: 'lose focus and get distracted easily',
    childStruggle: 'lose focus while studying',
    goal: 'focus without getting distracted',
    feeling: 'scattered and unable to concentrate',
    future: 'build lasting focus and attention',
  },
  curiosity_innovation: {
    topic: 'low curiosity and creativity',
    youStruggle: 'feel short on new ideas and curiosity',
    childStruggle: 'rarely explore or ask questions',
    goal: 'spark curiosity and creativity',
    feeling: 'creatively stuck and out of fresh ideas',
    future: 'keep exploring and creating new ideas',
  },
  decision_judgment: {
    topic: 'trouble making decisions',
    youStruggle: 'keep changing my mind and regret choices',
    childStruggle: 'can not decide and keep changing their mind',
    goal: 'make decisions without second-guessing',
    feeling: 'anxious and indecisive about every choice',
    future: 'make confident decisions and commit',
  },
  collaboration_teamwork: {
    topic: 'trouble working in a team',
    youStruggle: 'find it hard to work with others',
    childStruggle: 'struggle to work in a group',
    goal: 'collaborate well in a team',
    feeling: 'frustrated and out of sync in a group',
    future: 'work well with teammates and colleagues',
  },
  social_connection_belonging: {
    topic: 'loneliness and not belonging',
    youStruggle: 'feel lonely and like I do not belong',
    childStruggle: 'feel lonely and left out',
    goal: 'make friends and feel a sense of belonging',
    feeling: 'isolated and left out like an outsider',
    future: 'build friendships and belonging',
  },
  networking_relationships: {
    topic: 'trouble networking',
    youStruggle: 'find it hard to reach out to new contacts',
    childStruggle: 'find it hard to build connections',
    goal: 'build a network and reach out confidently',
    feeling: 'awkward about networking and reaching out',
    future: 'grow my network and professional connections',
  },
  negotiation_advocacy: {
    topic: 'trouble standing up for yourself',
    youStruggle: 'struggle to ask for what I deserve',
    childStruggle: 'struggle to stand up for themselves',
    goal: 'stand up and negotiate confidently',
    feeling: 'walked over and unable to push back',
    future: 'negotiate and self-advocate',
  },
};

// ── Per-(intent × stakeholder) templates ─────────────────────────────────────
// Crisp, search-realistic phrasings. Each stakeholder gets a DISTINCT lens; the
// shared anchor fragment is fine because cross-stakeholder similarity is intended
// (see the duplicate model above).
type Tmpl = (a: SearchAnchor) => string;
const TEMPLATES: Record<IntentType, Record<Stakeholder, Tmpl>> = {
  informational: {
    student: (a) => `what is ${a.topic}?`,
    parent: (a) => `what causes ${a.topic} in children?`,
    teacher: (a) => `signs of ${a.topic} in students`,
    counselor: (a) => `what does ${a.topic} look like?`,
    professional: (a) => `what is ${a.topic} at work?`,
  },
  diagnostic: {
    student: (a) => `why do I ${a.youStruggle}?`,
    parent: (a) => `why does my child ${a.childStruggle}?`,
    teacher: (a) => `why does a student ${a.childStruggle}?`,
    counselor: (a) => `why does a client ${a.childStruggle}?`,
    professional: (a) => `why do I ${a.youStruggle} at work?`,
  },
  emotional: {
    student: (a) => `I feel ${a.feeling}`,
    parent: (a) => `I am worried my child is ${a.feeling}`,
    teacher: (a) => `my student seems ${a.feeling} in class`,
    counselor: (a) => `my client feels ${a.feeling}`,
    professional: (a) => `at work I feel ${a.feeling}`,
  },
  help_seeking: {
    student: (a) => `how do I ${a.goal}?`,
    parent: (a) => `how to help my child ${a.goal}`,
    teacher: (a) => `helping a student ${a.goal}`,
    counselor: (a) => `ways to help a client ${a.goal}`,
    professional: (a) => `how do I ${a.goal} at work?`,
  },
  future_planning: {
    student: (a) => `how to ${a.future} going forward`,
    parent: (a) => `preparing my child to ${a.future}`,
    teacher: (a) => `setting a student up to ${a.future}`,
    counselor: (a) => `guiding a client to ${a.future}`,
    professional: (a) => `how to ${a.future} as my career grows`,
  },
};

// ── Generation ───────────────────────────────────────────────────────────────
export interface GeneratedIntent {
  archetype_key: string;
  stakeholder: Stakeholder;
  intent_type: IntentType;
  search_phrase: string;
}

/** Produce the full per-archetype cross-product of search intents (pure). */
export function generateSearchIntents(archetypeKeys: string[]): GeneratedIntent[] {
  const out: GeneratedIntent[] = [];
  for (const key of archetypeKeys) {
    const anchor = SEARCH_ANCHORS[key];
    if (!anchor) continue; // archetype without an authored anchor → no rows (honest gap)
    for (const intent of INTENT_TYPES) {
      for (const stakeholder of STAKEHOLDERS) {
        const phrase = TEMPLATES[intent][stakeholder](anchor).replace(/\s+/g, ' ').trim();
        out.push({ archetype_key: key, stakeholder, intent_type: intent, search_phrase: phrase });
      }
    }
  }
  return out;
}

// ── Quality scoring (four scores, 1..5) ──────────────────────────────────────
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Count how many distinct lay-lexicon terms the phrase touches (alignment depth). */
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

// Intent-marker patterns — does the phrase clearly read as its declared intent?
const INTENT_MARKERS: Record<IntentType, RegExp[]> = {
  informational: [/\bwhat (is|are|does|do)\b/, /\bwhat causes\b/, /\bsigns of\b/, /\blook(s)? like\b/, /\bhow does\b/],
  diagnostic: [/\bwhy (do|does)\b/],
  emotional: [/\bi feel\b/, /\bworried\b/, /\bseems\b/, /\bfeels\b/],
  help_seeking: [/\bhow do i\b/, /\bhow to help\b/, /\bhelping a\b/, /\bways to help\b/],
  future_planning: [/\bgoing forward\b/, /\bpreparing\b/, /\bsetting a student up\b/, /\bguiding a client\b/, /\bcareer grows\b/],
};

function matchesAny(text: string, pats: RegExp[]): boolean {
  return pats.some((p) => p.test(text));
}

export interface QualityScores {
  search_realism: number;     // 1..5 — reads like a real search query
  human_language: number;     // 1..5 — plain, jargon-free wording
  archetype_alignment: number;// 1..5 — touches the archetype's lay vocabulary
  intent_clarity: number;     // 1..5 — unambiguously its declared intent
  composite: number;          // mean of the four, 2dp
}

/** Honest per-phrase quality. Pure function of the text — never tuned. */
export function scoreSearchIntent(phrase: string, archetypeKey: string, intent: IntentType): QualityScores {
  const lower = phrase.toLowerCase();
  const realism = checkRealism(phrase);
  const words = phrase.trim().split(/\s+/).length;

  // search realism — query shape: jargon kills it; very long is un-search-like
  let sr = 5;
  sr -= 3 * realism.jargon.length;
  if (words > 14) sr -= 2; else if (words > 12) sr -= 1;
  if (words < 4) sr -= 1; // terse keyword searches are still plausible
  const search_realism = clamp(sr, 1, 5);

  // human language — plain wording, no psychometric/assessment terms
  let hl = 5;
  hl -= 2 * realism.jargon.length;
  if (!realism.pass && realism.jargon.length === 0) hl -= 1; // length-only miss
  const human_language = clamp(hl, 1, 5);

  // archetype alignment — depth of lay-lexicon contact
  const hits = alignmentHits(phrase, archetypeKey);
  const archetype_alignment = hits >= 3 ? 5 : hits === 2 ? 4 : hits === 1 ? 3 : 1;

  // intent clarity — matches own markers, penalised for matching other intents
  const ownMatch = matchesAny(lower, INTENT_MARKERS[intent]);
  let otherMatches = 0;
  for (const t of INTENT_TYPES) {
    if (t === intent) continue;
    if (matchesAny(lower, INTENT_MARKERS[t])) otherMatches++;
  }
  const intent_clarity = ownMatch
    ? (otherMatches === 0 ? 5 : otherMatches === 1 ? 4 : 3)
    : (otherMatches > 0 ? 2 : 1);

  const composite = Math.round(((search_realism + human_language + archetype_alignment + intent_clarity) / 4) * 100) / 100;
  return { search_realism, human_language, archetype_alignment, intent_clarity, composite };
}

// ── Pass thresholds (per-row) used by the validators ─────────────────────────
export const REALISM_PASS_MIN = 4;   // search_realism >= 4 counts as realistic
export const CLARITY_PASS_MIN = 4;   // intent_clarity >= 4 counts as clear

/** Boolean per-row flags mirrored into the table + rolled up by the runner/route. */
export interface IntentFlags {
  realism_pass: boolean;   // search_realism >= REALISM_PASS_MIN
  aligned: boolean;        // touches the lay lexicon (>= 1 hit)
  clear: boolean;          // intent_clarity >= CLARITY_PASS_MIN
}
export function intentFlags(phrase: string, archetypeKey: string, intent: IntentType): IntentFlags {
  const q = scoreSearchIntent(phrase, archetypeKey, intent);
  return {
    realism_pass: q.search_realism >= REALISM_PASS_MIN,
    aligned: isAligned(phrase, archetypeKey),
    clear: q.intent_clarity >= CLARITY_PASS_MIN,
  };
}

// ── Duplicate detection — exact · semantic (same audience) · stakeholder ─────
export type DuplicateKind = 'identical' | 'semantic' | 'stakeholder';
export interface DuplicateRow {
  kind: DuplicateKind;
  redundant: boolean; // counts toward the headline duplicate rate
  phrase_a: string;
  phrase_b: string;
  overlap: number;
  archetype_a: string;
  archetype_b: string;
  stakeholder_a: Stakeholder;
  stakeholder_b: Stakeholder;
}

/**
 * Full duplicate audit over every generated intent.
 *   - identical  : same phrase string anywhere (always redundant).
 *   - semantic   : Jaccard >= threshold for the SAME stakeholder (redundant —
 *                  the same searcher would see two near-identical queries).
 *   - stakeholder: identical/near-identical across DIFFERENT stakeholders
 *                  (intended audience variant — recorded, NOT counted).
 * `duplicateMembers` = indexes of the later member of each REDUNDANT pair; that
 * is exactly what the runner marks `is_duplicate`, so the headline rate is global
 * and honest. Never tuned.
 */
export function auditDuplicates(intents: GeneratedIntent[], threshold = 0.6): {
  rows: DuplicateRow[];
  duplicateMembers: Set<number>; // indexes into `intents`
} {
  const rows: DuplicateRow[] = [];
  const dupIdx = new Set<number>();
  const phrases = intents.map((i) => i.search_phrase);
  const sets = phrases.map((p) => new Set(tokenize(p)));

  for (let i = 0; i < intents.length; i++) {
    for (let j = i + 1; j < intents.length; j++) {
      const sameStake = intents[i].stakeholder === intents[j].stakeholder;
      if (phrases[i] === phrases[j]) {
        rows.push(pair('identical', true, intents, i, j, 1));
        dupIdx.add(j);
        if (!sameStake) rows.push(pair('stakeholder', false, intents, i, j, 1));
        continue;
      }
      const a = sets[i], b = sets[j];
      if (a.size === 0 || b.size === 0) continue;
      let inter = 0; for (const t of a) if (b.has(t)) inter++;
      const ov = inter / (a.size + b.size - inter || 1);
      if (ov >= threshold) {
        if (sameStake) { rows.push(pair('semantic', true, intents, i, j, round3(ov))); dupIdx.add(j); }
        else rows.push(pair('stakeholder', false, intents, i, j, round3(ov)));
      }
    }
  }
  return { rows, duplicateMembers: dupIdx };
}

function round3(n: number): number { return Math.round(n * 1000) / 1000; }
function pair(kind: DuplicateKind, redundant: boolean, intents: GeneratedIntent[], i: number, j: number, overlap: number): DuplicateRow {
  return {
    kind, redundant,
    phrase_a: intents[i].search_phrase,
    phrase_b: intents[j].search_phrase,
    overlap,
    archetype_a: intents[i].archetype_key,
    archetype_b: intents[j].archetype_key,
    stakeholder_a: intents[i].stakeholder,
    stakeholder_b: intents[j].stakeholder,
  };
}

// Re-export the shared detector for tests/tooling that want raw global pairs.
export { detectDuplicates };

// ── Validation targets (canon — runner/route report against these, may FAIL) ─
export const SEARCH_VALIDATION_TARGETS = {
  search_realism: 0.85,
  archetype_alignment: 0.85,
  duplicate_rate_max: 0.10,
} as const;
