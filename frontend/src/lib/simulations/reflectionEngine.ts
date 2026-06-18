/**
 * Reflection Engine — Phase 4
 * Generates context-aware reflection prompts and analyses user responses
 * to extract reasoning quality, tradeoff depth, and behavioral signals.
 */

import type { SimType }       from './scenarioEngine';
import type { DecisionRecord } from './decisionEngine';

/* ── Types ────────────────────────────────────────────────────────── */
export interface ReflectionPrompt {
  id:          string;
  nodeId:      string;
  type:        'reasoning' | 'tradeoff' | 'decision' | 'priority' | 'stakeholder' | 'retrospective';
  question:    string;
  subPrompts:  string[];
  minWords:    number;
}

export interface ReflectionRecord {
  promptId:    string;
  nodeId:      string;
  response:    string;
  wordCount:   number;
  tradeoffCount:number;
  stakeholderMentions:number;
  specificityScore:number;
  qualityScore:number;          // 0-100
  signalTags:  string[];        // behavioral signals extracted from text
  submittedAt: number;
}

export interface ReflectionAnalysis {
  records:             ReflectionRecord[];
  avgQualityScore:     number;
  depthLabel:          'deep' | 'moderate' | 'surface' | 'minimal';
  tradeoffAwareness:   number;  // 0-100
  stakeholderAwareness:number;  // 0-100
  specificityScore:    number;  // 0-100
  keyThemes:           string[];
  textSignals:         { signal:string; evidence:string; polarity:'positive'|'negative' }[];
  coachingFeedback:    string;
}

/* ── Prompt templates ─────────────────────────────────────────────── */
const TYPE_PROMPTS: Record<SimType, { reasoning:string; tradeoff:string; priority:string }> = {
  leadership:    {
    reasoning: 'Walk me through your thinking. Why did you choose this approach over the alternatives?',
    tradeoff:  'Every leadership decision has tradeoffs. What did you consciously give up with this choice, and was that the right call?',
    priority:  'What was your primary consideration here — the individual, the team, the business, or the relationship? Why did you prioritise in that order?',
  },
  strategic:     {
    reasoning: 'Describe the strategic logic behind your decision. What data or assumptions underpinned it?',
    tradeoff:  'What short-term costs did you accept in exchange for longer-term benefit? Were there alternative framings you rejected?',
    priority:  'How did you stack rank the competing priorities? What framework, explicit or implicit, did you use?',
  },
  conflict:      {
    reasoning: 'Explain your approach to this conflict. What did you read about the emotional state of the other party, and how did that shape your response?',
    tradeoff:  'Conflict resolution often means trading short-term discomfort for long-term trust. What was your trade-off here?',
    priority:  'In a conflict, you can prioritise the relationship, the outcome, or the principle. Which did you choose — and why?',
  },
  operational:   {
    reasoning: 'Walk through your triage logic. How did you decide what to address first under pressure?',
    tradeoff:  'Under constraint, you cannot do everything. What explicitly did you deprioritise, and what\'s the risk of that call?',
    priority:  'Speed, quality, and completeness rarely coexist under pressure. Which did you protect? Was that the right hierarchy for this situation?',
  },
  'emotional-intelligence': {
    reasoning: 'What did you read in this person\'s emotional state, and how did that reading inform your response?',
    tradeoff:  'Empathy sometimes conflicts with efficiency or task focus. Where did you feel that tension, and how did you resolve it?',
    priority:  'In emotionally charged interactions, you can prioritise the person\'s feelings, the facts, or the next steps. What guided your choice?',
  },
  negotiation:   {
    reasoning: 'Describe your negotiation strategy. Were you playing to anchor, to explore, or to close — and why at this stage?',
    tradeoff:  'What were you willing to walk away from in this negotiation, and what was non-negotiable? How did that shape your moves?',
    priority:  'Negotiations balance relationship, value, and precedent. Which did you protect most — and what does that tell you about your negotiating identity?',
  },
};

/* ── Prompt builder ───────────────────────────────────────────────── */
export function buildReflectionPrompts(
  nodeId:    string,
  type:      SimType,
  nodePrompt:string,
): ReflectionPrompt[] {
  const templates = TYPE_PROMPTS[type];
  return [
    {
      id:`rp_${nodeId}_reasoning`, nodeId, type:'reasoning', minWords:40,
      question: templates.reasoning,
      subPrompts: ['What specifically influenced your choice?', 'What would you need to see to choose differently?'],
    },
    {
      id:`rp_${nodeId}_tradeoff`, nodeId, type:'tradeoff', minWords:30,
      question: templates.tradeoff,
      subPrompts: ['Name one thing you explicitly gave up.', 'Are you comfortable with that trade-off in hindsight?'],
    },
    {
      id:`rp_${nodeId}_priority`, nodeId, type:'priority', minWords:25,
      question: templates.priority,
      subPrompts: ['What was your #1 consideration?'],
    },
  ];
}

/* ── Text analysis ────────────────────────────────────────────────── */
const TRADEOFF_WORDS = ['however','but','trade-off','tradeoff','sacrifice','cost','risk','downside','alternative','instead','though','whereas','despite','on the other hand','even though','accepted','gave up','deprioritised','deprioritized'];
const STAKEHOLDER_WORDS = ['team','client','manager','director','colleague','stakeholder','executive','ceo','cto','cfo','ravi','priya','vikram','arjun','meera','rahul','kavya','ananya','shreya'];
const SPECIFICITY_WORDS = [/\d+\s?(weeks?|months?|days?|hours?|lpa|cr|percent|%)/i, /specifically/i, /for example/i, /in particular/i, /concretely/i, /the reason is/i];
const POSITIVE_SIGNAL_KW: { pattern:RegExp; signal:string; tag:string }[] = [
  { pattern:/\bempathis|understood their|heard them|felt their|perspective\b/i, signal:'Explicit empathy framing', tag:'empathy' },
  { pattern:/\bstrateg|long.term|downstream|second.order\b/i, signal:'Strategic thinking articulated', tag:'strategy' },
  { pattern:/\bdecided|chose|committed|took action\b/i, signal:'Decisive framing in reflection', tag:'confidence' },
  { pattern:/\btrade.?off|gave up|accepted the (risk|cost)\b/i, signal:'Tradeoff acknowledged', tag:'prioritization' },
  { pattern:/\bpressure|time.constrained|under (pressure|stress)\b/i, signal:'Stress acknowledgment', tag:'stress-handling' },
];
const NEGATIVE_SIGNAL_KW: { pattern:RegExp; signal:string; tag:string }[] = [
  { pattern:/\bnot sure|wasn.t sure|uncertain|didn.t know\b/i, signal:'Uncertainty without resolution strategy', tag:'hesitation' },
  { pattern:/\bavoided|put off|delayed|didn.t want to\b/i, signal:'Avoidance language detected', tag:'hesitation' },
];

function countWords(text: string): number { return text.trim().split(/\s+/).filter(Boolean).length; }
function countTradeoffs(text: string): number { return TRADEOFF_WORDS.filter(w => text.toLowerCase().includes(w)).length; }
function countStakeholders(text: string): number { return STAKEHOLDER_WORDS.filter(w => text.toLowerCase().includes(w)).length; }
function scoreSpecificity(text: string): number {
  const matches = SPECIFICITY_WORDS.filter(p => p.test(text)).length;
  return Math.min(100, matches * 20 + 20);
}

function extractTextSignals(text: string): { signal:string; evidence:string; polarity:'positive'|'negative' }[] {
  const signals: { signal:string; evidence:string; polarity:'positive'|'negative' }[] = [];
  for (const kw of POSITIVE_SIGNAL_KW) {
    const match = text.match(kw.pattern);
    if (match) signals.push({ signal:kw.signal, evidence:match[0], polarity:'positive' });
  }
  for (const kw of NEGATIVE_SIGNAL_KW) {
    const match = text.match(kw.pattern);
    if (match) signals.push({ signal:kw.signal, evidence:match[0], polarity:'negative' });
  }
  return signals;
}

/* ── Quality score ────────────────────────────────────────────────── */
function computeQualityScore(
  wordCount:    number,
  tradeoffs:    number,
  stakeholders: number,
  specificity:  number,
): number {
  const wordScore   = Math.min(40, wordCount * 0.5);      // up to 40pts for 80+ words
  const tradeoffScore= Math.min(25, tradeoffs * 8);        // up to 25pts
  const stakeScore  = Math.min(20, stakeholders * 5);      // up to 20pts
  const specScore   = Math.min(15, specificity * 0.15);    // up to 15pts
  return Math.min(100, Math.round(wordScore + tradeoffScore + stakeScore + specScore));
}

/* ── Main analyser ────────────────────────────────────────────────── */
export function analyseReflection(
  promptId:  string,
  nodeId:    string,
  response:  string,
): ReflectionRecord {
  const wordCount         = countWords(response);
  const tradeoffCount     = countTradeoffs(response);
  const stakeholderMentions = countStakeholders(response);
  const specificityScore  = scoreSpecificity(response);
  const qualityScore      = computeQualityScore(wordCount, tradeoffCount, stakeholderMentions, specificityScore);

  // Signal tags from text
  const textSig  = extractTextSignals(response);
  const signalTags: string[] = [];
  if (tradeoffCount >= 1) signalTags.push('prioritization');
  if (wordCount >= 80)    signalTags.push('communication-structure');
  if (stakeholderMentions >= 2) signalTags.push('empathy');
  textSig.forEach(ts => {
    if (ts.polarity === 'positive') signalTags.push(ts.signal.toLowerCase().replace(/\s/g,'-'));
  });

  return { promptId, nodeId, response, wordCount, tradeoffCount, stakeholderMentions, specificityScore, qualityScore, signalTags, submittedAt:Date.now() };
}

/* ── Aggregate analysis ───────────────────────────────────────────── */
export function aggregateReflections(records: ReflectionRecord[]): ReflectionAnalysis {
  if (records.length === 0) {
    return { records:[], avgQualityScore:0, depthLabel:'minimal', tradeoffAwareness:0, stakeholderAwareness:0, specificityScore:0, keyThemes:[], textSignals:[], coachingFeedback:'No reflections submitted. Deep reflection is essential to translating simulation experience into durable learning.' };
  }

  const avgQuality      = Math.round(records.reduce((s, r) => s + r.qualityScore, 0) / records.length);
  const avgTradeoff     = Math.min(100, Math.round((records.reduce((s, r) => s + r.tradeoffCount, 0) / records.length) * 25));
  const avgStakeholder  = Math.min(100, Math.round((records.reduce((s, r) => s + r.stakeholderMentions, 0) / records.length) * 15));
  const avgSpecificity  = Math.round(records.reduce((s, r) => s + r.specificityScore, 0) / records.length);

  const depthLabel: ReflectionAnalysis['depthLabel'] =
    avgQuality >= 75 ? 'deep' : avgQuality >= 55 ? 'moderate' : avgQuality >= 35 ? 'surface' : 'minimal';

  // Key themes from all text
  const allText = records.map(r => r.response).join(' ').toLowerCase();
  const themes: string[] = [];
  if (TRADEOFF_WORDS.some(w => allText.includes(w)))        themes.push('Trade-off Awareness');
  if (STAKEHOLDER_WORDS.slice(0,5).some(w => allText.includes(w))) themes.push('Stakeholder Consideration');
  if (/strateg|long.term/i.test(allText))                   themes.push('Strategic Orientation');
  if (/empat|understand|felt/i.test(allText))               themes.push('Empathetic Framing');
  if (/data|evidence|metric|number/i.test(allText))         themes.push('Evidence-Based Reasoning');

  const textSignals = records.flatMap(r => extractTextSignals(r.response));

  const coaching =
    depthLabel === 'deep'     ? 'Outstanding reflection depth. Your reasoning transparency is a key indicator of meta-cognitive maturity.' :
    depthLabel === 'moderate' ? 'Good reflection quality. To deepen further: name at least one explicit trade-off and one thing you would change.' :
    depthLabel === 'surface'  ? 'Your reflections are brief. Deeper analysis of why you chose what you chose is where real growth happens.' :
                                'Reflections were minimal. Practice the habit: after every real-world decision, write 3 sentences — what I chose, why, and what I would need to see to choose differently.';

  return { records, avgQualityScore:avgQuality, depthLabel, tradeoffAwareness:avgTradeoff, stakeholderAwareness:avgStakeholder, specificityScore:avgSpecificity, keyThemes:themes, textSignals, coachingFeedback:coaching };
}

/* ── Standalone prompt for a decision node ────────────────────────── */
export function getNodeReflectionQuestion(
  nodePrompt:  string,
  type:        SimType,
  reflectType: 'reasoning' | 'tradeoff' | 'priority' = 'reasoning',
): string {
  return TYPE_PROMPTS[type][reflectType];
}
