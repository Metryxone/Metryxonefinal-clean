// C-2 Question Semantic Enrichment — deterministic, evidence-based classifiers.
// Single source of truth: imported by the populate run AND any future runtime consumer.
// Derives the two dimensions C-1 found at 0% coverage: Context + Archetype.
// Evidence = existing structured fields (narrative_style, response_type) + question text + bridge tag.
// Quality gate: returns UNCLASSIFIED (confidence 0) when no evidence — NEVER fabricates.

export const ARCHETYPES = [
  'Reflective', 'Behavioral', 'Situational', 'Decision-Based',
  'Evidence-Based', 'Preference-Based', 'Future-Oriented', 'Historical',
];
export const CONTEXTS = [
  'Academic', 'Learning', 'Career', 'Employment', 'Competitive Exams',
  'Skill Development', 'Personal Development', 'Social', 'Family',
  'Financial', 'Entrepreneurship', 'Leadership', 'Digital Literacy',
];
export const UNCLASSIFIED = 'UNCLASSIFIED';

// narrative_style -> base archetype (the strongest single structured signal)
const NS_ARCHETYPE = {
  reflective: 'Reflective', 'self-perception': 'Reflective', emotional: 'Reflective', cognitive: 'Reflective',
  'action-oriented': 'Behavioral', behavioral: 'Behavioral',
  scenario_based: 'Situational', situational: 'Situational', 'social-contextual': 'Situational',
  'future-oriented': 'Future-Oriented', 'growth-oriented': 'Future-Oriented', hopeful: 'Future-Oriented',
  timeline_based: 'Historical',
};
// response_type -> archetype hint (secondary structured signal)
const RT_ARCHETYPE = {
  situational_fit: 'Situational', likelihood: 'Future-Oriented',
  behavioral_consistency: 'Behavioral', frequency: 'Behavioral',
};

// Explicit phrasing overrides — highest-confidence evidence, taken from the text itself.
function archetypeFromText(t) {
  if (/\b(describe a time|give an example|recall a (time|moment)|tell me about a time|have you ever|think of a (time|situation) when)\b/.test(t)) return 'Evidence-Based';
  if (/\b(over the past|in the last|in the past (year|month|week)|used to|previously|looking back|a year ago)\b/.test(t)) return 'Historical';
  if (/\b(would you rather|which matters more|which is more important|choose between|rather .* or )\b/.test(t)) return 'Decision-Based';
  if (/\b(how much do you (enjoy|like|prefer)|how interested are you|do you enjoy|appeals to you most|interests you most|what interests you most)\b/.test(t)) return 'Preference-Based';
  if (/\b(where do you see yourself|do you plan to|do you intend|will you be able|prepare you for|see yourself in)\b/.test(t)) return 'Future-Oriented';
  if (/^\s*"?(if|suppose|imagine|when faced)\b/.test(t) || /\bwhat (is|would be) your (typical |usual )?response\b/.test(t)) return 'Situational';
  return null;
}

export function classifyArchetype({ question, narrative_style, response_type } = {}) {
  const t = (question || '').toLowerCase();
  const textArch = archetypeFromText(t);
  if (textArch) return { archetype: textArch, confidence: 0.9, source: 'text' };
  const ns = (narrative_style || '').toLowerCase();
  const nsArch = NS_ARCHETYPE[ns];
  if (nsArch) {
    // refine reflective base when phrasing is plainly an action/frequency report
    if (nsArch === 'Reflective' && /\bhow often do you (take|do|avoid|withdraw|prioriti|complete|start|finish|practice)\b/.test(t)) {
      return { archetype: 'Behavioral', confidence: 0.75, source: 'narrative_style+text' };
    }
    return { archetype: nsArch, confidence: 0.8, source: 'narrative_style' };
  }
  const rtArch = RT_ARCHETYPE[(response_type || '').toLowerCase()];
  if (rtArch) return { archetype: rtArch, confidence: 0.55, source: 'response_type' };
  return { archetype: UNCLASSIFIED, confidence: 0, source: 'none' };
}

// bridge tag -> dominant context (the tag is reliable semantic evidence)
function contextFromTag(tag) {
  const T = (tag || '').toUpperCase();
  if (/COMPETITIVE|ENTRANCE|JEE|NEET|UPSC/.test(T)) return 'Competitive Exams';
  if (/EXAM|EXAMINATION|TEST/.test(T)) return 'Academic';
  if (/WORKPLACE|EMPLOY|OCCUPATION|PROFESSIONAL_ADAPT/.test(T)) return 'Employment';
  if (/CAREER|VOCATION/.test(T)) return 'Career';
  if (/ACADEMIC|STUDENT|STUDY|SCHOOL|COLLEGE/.test(T)) return 'Academic';
  if (/LEAD|MANAG/.test(T)) return 'Leadership';
  if (/ENTREPRENE|VENTURE|STARTUP/.test(T)) return 'Entrepreneurship';
  if (/FINANC|MONEY/.test(T)) return 'Financial';
  if (/FAMILY|PARENT|HOME/.test(T)) return 'Family';
  if (/SOCIAL|PEER|RELATION/.test(T)) return 'Social';
  if (/DIGITAL|TECH|ONLINE/.test(T)) return 'Digital Literacy';
  if (/SKILL|COMPETENC/.test(T)) return 'Skill Development';
  if (/LEARN|COGNI|THINK|CURIOSIT|ACADEMIC_COGNITIVE/.test(T)) return 'Learning';
  if (/CONFIDENCE|EMOTION|MOTIVATION|DISCIPLINE|HABIT|WELLBEING|RESILIEN|STRESS|COPING|LIFESTYLE|ADJUSTMENT|HOLISTIC|SELF/.test(T)) return 'Personal Development';
  return null;
}

// ordered specific -> general text lexicon
const CONTEXT_LEXICON = [
  ['Competitive Exams', /\b(jee|neet|upsc|gate exam|entrance exam|competitive exam|cut-?off|rank list|board exam)\b/],
  ['Employment', /\b(job|workplace|at work|office|boss|manager|colleague|employer|industry|organizational|restructuring|interview|real job|workplace expectations)\b/],
  ['Career', /\b(career|profession|career path|career values|career setback|vocation)\b/],
  ['Academic', /\b(exam|test|marks|grade|score|study|studying|school|college|classroom|academic|syllabus|assignment|faculty|student)\b/],
  ['Leadership', /\b(leadership|lead a|manage others|responsible for others|accountability|delegate|team .* lead)\b/],
  ['Entrepreneurship', /\b(startup|venture|business of (my|your) own|entrepreneur)\b/],
  ['Financial', /\b(financ|money|afford|salary|debt|budget|economic)\b/],
  ['Family', /\b(family|parent|mother|father|relatives|household)\b/],
  ['Social', /\b(friend|peers?|social comparison|belonging|group setting|relationship|others)\b/],
  ['Digital Literacy', /\b(digital|online|technolog|software|internet|device)\b/],
  ['Skill Development', /\b(skill|framework|technique|practical .* (skill|framework))\b/],
  ['Learning', /\b(learn|understand|curiosity|knowledge|concept|comprehen|deep understanding)\b/],
  ['Personal Development', /\b(self-worth|self worth|personal growth|habit|mindset|resilience|wellbeing|emotional balance|problem-solving style|rest and emotional|burnout)\b/],
];

export function classifyContext({ question, master_bridge_tag } = {}) {
  const t = (question || '').toLowerCase();
  const matches = [];
  for (const [ctx, re] of CONTEXT_LEXICON) {
    if (re.test(t) && !matches.includes(ctx)) matches.push(ctx);
  }
  const tagCtx = contextFromTag(master_bridge_tag);
  // primary: tag evidence wins (reliable semantic); else strongest text match
  let primary = tagCtx || matches[0] || null;
  let secondary = matches.find((m) => m !== primary) || null;
  if (!primary) return { context_primary: UNCLASSIFIED, context_secondary: null, confidence: 0, source: 'none' };
  const source = tagCtx ? (matches.length ? 'tag+text' : 'tag') : 'text';
  const confidence = tagCtx ? (matches.includes(primary) ? 0.9 : 0.7) : 0.65;
  return { context_primary: primary, context_secondary: secondary, confidence, source };
}

export function classifyQuestion(row) {
  const a = classifyArchetype(row);
  const c = classifyContext(row);
  return {
    question_id: row.question_id,
    master_bridge_tag: row.master_bridge_tag || null,
    archetype: a.archetype,
    archetype_confidence: a.confidence,
    archetype_source: a.source,
    context_primary: c.context_primary,
    context_secondary: c.context_secondary,
    context_confidence: c.confidence,
    context_source: c.source,
  };
}
