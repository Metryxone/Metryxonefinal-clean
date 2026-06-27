/**
 * MX-302F — Employability Studio engine.
 *
 * PURE, deterministic helpers + curated content for the Resume / Portfolio /
 * Interview studios. Everything here is the HONEST rule-based fallback path used
 * when no LLM key is configured (the real AI path lives in the routes via
 * aiClient.chatJSON). Nothing here is ever labelled "AI" — callers tag the
 * source explicitly ('rule-based' vs 'ai') so a heuristic is never mislabelled.
 *
 * Honesty contracts:
 *   - No fabrication: heuristics report what is OBSERVABLE in the input only.
 *   - null ≠ 0: when a signal cannot be measured we say so, we do not score 0.
 *   - Curated coding/GD content is explicitly NON-executing (no sandbox) and is
 *     surfaced as such — MCQ + structured self-review, never "your code passed".
 */

// ── Resume analyzer (rule-based heuristic fallback) ──────────────────────────

const IMPACT_VERBS = [
  'led', 'built', 'designed', 'launched', 'shipped', 'created', 'developed',
  'improved', 'increased', 'reduced', 'optimized', 'optimised', 'automated',
  'delivered', 'drove', 'owned', 'spearheaded', 'architected', 'implemented',
  'scaled', 'streamlined', 'mentored', 'managed', 'founded', 'negotiated',
  'accelerated', 'transformed', 'pioneered', 'established', 'generated',
];

const WEAK_OPENERS = [
  'responsible for', 'worked on', 'helped with', 'involved in', 'tasked with',
  'assisted', 'participated in', 'duties included', 'in charge of',
];

export interface ResumeBulletFinding {
  text: string;
  hasImpactVerb: boolean;
  hasMetric: boolean;
  weakOpener: string | null;
}

export interface ResumeAnalysis {
  source: 'rule-based';
  scores: {
    impactVerbs: number;       // 0-100 — share of bullets opening with an action verb
    quantification: number;    // 0-100 — share of bullets with a metric/number
    overall: number;           // mean of measurable axes
  };
  counts: {
    bullets: number;
    bulletsWithMetric: number;
    bulletsWithImpactVerb: number;
    weakOpeners: number;
  };
  strengths: string[];
  improvements: string[];
  missingSections: string[];   // sections that are empty
  flaggedBullets: ResumeBulletFinding[];
  note: string;
}

const METRIC_RE = /(\d+(\.\d+)?\s?%|\$\s?\d|\d{2,}|\bx\d+\b|\d+\s?(k|m|bn|million|users|customers|hours|days|weeks)\b)/i;

function firstWord(s: string): string {
  return (s.trim().split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z]/g, '');
}

function detectWeakOpener(s: string): string | null {
  const low = s.toLowerCase().trim();
  return WEAK_OPENERS.find((w) => low.startsWith(w)) || null;
}

/**
 * Heuristic resume critique over a structured resume object. Operates purely on
 * what is present — never invents accomplishments. `resume` is the frontend
 * ResumeData shape (loosely typed because it crosses the wire).
 */
export function analyzeResumeRuleBased(resume: any): ResumeAnalysis {
  const experience: any[] = Array.isArray(resume?.experience) ? resume.experience : [];
  const bullets: string[] = experience
    .flatMap((e) => (Array.isArray(e?.bullets) ? e.bullets : []))
    .map((b: any) => String(b || '').trim())
    .filter(Boolean);

  const findings: ResumeBulletFinding[] = bullets.map((text) => ({
    text,
    hasImpactVerb: IMPACT_VERBS.includes(firstWord(text)),
    hasMetric: METRIC_RE.test(text),
    weakOpener: detectWeakOpener(text),
  }));

  const n = findings.length;
  const withVerb = findings.filter((f) => f.hasImpactVerb).length;
  const withMetric = findings.filter((f) => f.hasMetric).length;
  const weak = findings.filter((f) => f.weakOpener).length;

  const impactVerbs = n > 0 ? Math.round((withVerb / n) * 100) : 0;
  const quantification = n > 0 ? Math.round((withMetric / n) * 100) : 0;
  const overall = n > 0 ? Math.round((impactVerbs + quantification) / 2) : 0;

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (n === 0) {
    improvements.push('No experience bullet points found — add 2–4 achievement bullets per role.');
  } else {
    if (impactVerbs >= 60) strengths.push(`${withVerb}/${n} bullets open with a strong action verb.`);
    else improvements.push(`Only ${withVerb}/${n} bullets open with an action verb — start with verbs like Led, Built, Improved.`);

    if (quantification >= 50) strengths.push(`${withMetric}/${n} bullets are quantified with a metric.`);
    else improvements.push(`Only ${withMetric}/${n} bullets include a number — quantify impact (%, $, time, scale) wherever you can.`);

    if (weak > 0) improvements.push(`${weak} bullet(s) start with a weak opener (e.g. "responsible for") — rewrite as a concrete accomplishment.`);
  }

  const summary = String(resume?.summary || '').trim();
  if (summary.length >= 120) strengths.push('Professional summary is present and substantive.');
  else if (summary.length === 0) improvements.push('Add a 2–3 line professional summary at the top.');
  else improvements.push('Professional summary is short — expand to 2–3 lines highlighting your focus and strengths.');

  const skills = resume?.skills || {};
  const skillCount = (skills.technical?.length || 0) + (skills.tools?.length || 0) + (skills.soft?.length || 0);
  if (skillCount >= 6) strengths.push(`${skillCount} skills listed.`);
  else improvements.push('List more relevant skills (technical, tools, soft) — aim for at least 6–8.');

  const missingSections: string[] = [];
  if (!(experience.length)) missingSections.push('experience');
  if (!(resume?.education?.length)) missingSections.push('education');
  if (!(resume?.projects?.length)) missingSections.push('projects');
  if (skillCount === 0) missingSections.push('skills');

  return {
    source: 'rule-based',
    scores: { impactVerbs, quantification, overall },
    counts: { bullets: n, bulletsWithMetric: withMetric, bulletsWithImpactVerb: withVerb, weakOpeners: weak },
    strengths,
    improvements,
    missingSections,
    flaggedBullets: findings.filter((f) => !f.hasImpactVerb || !f.hasMetric || f.weakOpener),
    note: 'Rule-based analysis (AI unavailable — no LLM key configured). These are structural heuristics, not an AI critique.',
  };
}

// ── LinkedIn review (rule-based heuristic fallback) ──────────────────────────

export interface LinkedInReview {
  source: 'rule-based';
  checklist: { item: string; ok: boolean; advice: string }[];
  score: number; // 0-100 share of checklist items satisfied
  note: string;
}

/**
 * Heuristic LinkedIn profile review. Input is the fields the user pastes/derives
 * (headline, about, url, skills count, etc.). Reports only on provided fields.
 */
export function reviewLinkedInRuleBased(input: any): LinkedInReview {
  const headline = String(input?.headline || '').trim();
  const about = String(input?.about || '').trim();
  const url = String(input?.url || '').trim();
  const skillsCount = Number(input?.skillsCount || 0);
  const hasPhoto = !!input?.hasPhoto;
  const connections = Number(input?.connections || 0);

  const checklist: { item: string; ok: boolean; advice: string }[] = [
    {
      item: 'Custom headline (not just a job title)',
      ok: headline.length >= 40 && /[|·,-]/.test(headline),
      advice: 'Write a headline that pairs your role with value/keywords, e.g. "Backend Engineer · Distributed Systems · Go/Python".',
    },
    {
      item: 'Substantive About section',
      ok: about.length >= 200,
      advice: 'Aim for 3–5 short paragraphs in About — who you are, what you build, and what you are looking for.',
    },
    {
      item: 'Custom public URL',
      ok: /linkedin\.com\/in\//i.test(url) && !/[0-9]{6,}/.test(url),
      advice: 'Claim a clean custom URL (linkedin.com/in/yourname) — avoid the auto-generated number suffix.',
    },
    {
      item: 'At least 5 listed skills',
      ok: skillsCount >= 5,
      advice: 'Add and reorder skills so your top 3 reflect your target role; LinkedIn surfaces these in search.',
    },
    {
      item: 'Profile photo present',
      ok: hasPhoto,
      advice: 'Add a clear, professional headshot — profiles with photos get far more views.',
    },
    {
      item: '50+ connections',
      ok: connections >= 50,
      advice: 'Grow to 50+ relevant connections so your activity reaches recruiters in your field.',
    },
  ];

  const ok = checklist.filter((c) => c.ok).length;
  const score = Math.round((ok / checklist.length) * 100);

  return {
    source: 'rule-based',
    checklist,
    score,
    note: 'Rule-based checklist (AI unavailable — no LLM key configured). Based only on the profile fields you provided.',
  };
}

// ── Interview feedback (deterministic fallback) ──────────────────────────────

export interface InterviewFeedback {
  source: 'rule-based';
  score: number | null;     // null when we cannot meaningfully score (null ≠ 0)
  observations: string[];
  suggestions: string[];
  note: string;
}

const STAR_CUES = {
  situation: ['when', 'while', 'during', 'at my', 'in my role', 'the team', 'we had', 'context'],
  task: ['needed to', 'had to', 'goal', 'responsible', 'my job', 'objective', 'asked to'],
  action: ['i ', 'i decided', 'i built', 'i led', 'i created', 'i implemented', 'i analyzed', 'i organized'],
  result: ['result', 'as a result', 'increased', 'reduced', 'improved', 'led to', '%', 'saved', 'grew', 'delivered'],
};

/**
 * Deterministic interview-answer feedback for behavioural / HR questions. Checks
 * STAR coverage, length, and quantification. Returns null score for answers too
 * short to evaluate rather than scoring 0.
 */
export function interviewFeedbackRuleBased(question: string, answer: string): InterviewFeedback {
  const a = String(answer || '').trim();
  const words = a ? a.split(/\s+/).length : 0;
  const low = a.toLowerCase();

  if (words < 15) {
    return {
      source: 'rule-based',
      score: null,
      observations: [`Answer is very short (${words} words) — too brief to evaluate meaningfully.`],
      suggestions: ['Use the STAR structure: Situation → Task → Action → Result, in 4–8 sentences.'],
      note: 'Rule-based feedback (AI unavailable — no LLM key configured). Structural heuristics only.',
    };
  }

  const present = (Object.keys(STAR_CUES) as (keyof typeof STAR_CUES)[]).filter((k) =>
    STAR_CUES[k].some((cue) => low.includes(cue)),
  );
  const hasMetric = METRIC_RE.test(a);

  const observations: string[] = [];
  const suggestions: string[] = [];

  observations.push(`STAR components detected: ${present.length}/4 (${present.join(', ') || 'none'}).`);
  observations.push(`Length: ${words} words.`);
  observations.push(hasMetric ? 'Answer includes a concrete result/metric.' : 'No quantified result detected.');

  if (!present.includes('situation')) suggestions.push('Open by setting the scene (Situation) — where and when this happened.');
  if (!present.includes('result')) suggestions.push('Close with the Result — what changed, ideally with a number.');
  if (!hasMetric) suggestions.push('Add a metric (%, time saved, scale) to make the impact concrete.');
  if (words > 280) suggestions.push('Tighten the answer — aim for under ~250 words so the point lands.');

  // Deterministic score: STAR coverage (up to 80) + metric bonus (20).
  const score = Math.min(100, Math.round((present.length / 4) * 80) + (hasMetric ? 20 : 0));

  return {
    source: 'rule-based',
    score,
    observations,
    suggestions,
    note: 'Rule-based feedback (AI unavailable — no LLM key configured). Structural heuristics only, not an AI critique.',
  };
}

// ── Curated coding assessment (NO execution sandbox) ─────────────────────────
// Scoped per founder decision #1: MCQ + structured self-review only. We do NOT
// run code; "self-review" answers are stored, never auto-graded as pass/fail.

export type CodingTopic = 'Data Structures' | 'Algorithms' | 'SQL' | 'System Design' | 'Language Fundamentals';

export interface CodingMcq {
  id: string;
  topic: CodingTopic;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  question: string;
  options: string[];
  answerIndex: number;       // index into options
  explanation: string;
}

export const CODING_MCQS: CodingMcq[] = [
  {
    id: 'cq-ds-1', topic: 'Data Structures', difficulty: 'Easy',
    question: 'What is the average-case time complexity of a lookup in a hash table?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    answerIndex: 0,
    explanation: 'A well-distributed hash table gives amortised O(1) average lookup; worst case is O(n) with many collisions.',
  },
  {
    id: 'cq-algo-1', topic: 'Algorithms', difficulty: 'Easy',
    question: 'Binary search requires the input array to be:',
    options: ['Sorted', 'Unsorted', 'A linked list', 'Of even length'],
    answerIndex: 0,
    explanation: 'Binary search relies on the array being sorted to discard half the search space each step (O(log n)).',
  },
  {
    id: 'cq-algo-2', topic: 'Algorithms', difficulty: 'Medium',
    question: 'Which algorithm finds the shortest path in a weighted graph with non-negative edges?',
    options: ["Dijkstra's algorithm", 'Depth-first search', 'Bubble sort', 'Kruskal\'s algorithm'],
    answerIndex: 0,
    explanation: "Dijkstra's algorithm computes single-source shortest paths for non-negative weights; Kruskal builds a minimum spanning tree.",
  },
  {
    id: 'cq-sql-1', topic: 'SQL', difficulty: 'Easy',
    question: 'Which SQL clause filters rows AFTER aggregation (GROUP BY)?',
    options: ['HAVING', 'WHERE', 'ORDER BY', 'LIMIT'],
    answerIndex: 0,
    explanation: 'WHERE filters before grouping; HAVING filters the aggregated groups.',
  },
  {
    id: 'cq-sql-2', topic: 'SQL', difficulty: 'Medium',
    question: 'A LEFT JOIN returns:',
    options: [
      'All rows from the left table, plus matching rows from the right (NULLs where no match)',
      'Only rows that match in both tables',
      'All rows from the right table only',
      'The Cartesian product of both tables',
    ],
    answerIndex: 0,
    explanation: 'LEFT JOIN keeps every left-table row; unmatched right-table columns are NULL.',
  },
  {
    id: 'cq-lang-1', topic: 'Language Fundamentals', difficulty: 'Easy',
    question: 'In most languages, what does "pass by reference" mean?',
    options: [
      'The function receives a reference to the original object, so mutations are visible to the caller',
      'A copy of the value is passed and changes do not affect the caller',
      'The value is converted to a string first',
      'The function cannot modify the argument',
    ],
    answerIndex: 0,
    explanation: 'With pass-by-reference the callee operates on the same object, so in-place mutations persist for the caller.',
  },
  {
    id: 'cq-sysd-1', topic: 'System Design', difficulty: 'Medium',
    question: 'A cache primarily helps a system by:',
    options: [
      'Reducing latency and load on a slower backing store for frequently-read data',
      'Permanently storing all application data',
      'Guaranteeing strong consistency across regions',
      'Replacing the need for a database',
    ],
    answerIndex: 0,
    explanation: 'Caches trade some consistency/freshness for much lower read latency and reduced load on the primary store.',
  },
  {
    id: 'cq-ds-2', topic: 'Data Structures', difficulty: 'Medium',
    question: 'Which structure gives O(1) enqueue and dequeue for a FIFO queue?',
    options: ['A doubly-linked list (or ring buffer)', 'A sorted array', 'A binary search tree', 'A hash set'],
    answerIndex: 0,
    explanation: 'A linked list / ring buffer supports O(1) push at the tail and pop at the head; arrays need shifting.',
  },
];

/** Self-review prompts paired with the coding section (open-ended, never auto-graded). */
export const CODING_SELF_REVIEW_PROMPTS = [
  'Describe a coding problem you solved recently and the approach you took.',
  'How would you optimise a function that is too slow? Walk through your process.',
  'How do you test your code before considering it done?',
];

export interface CodingSubmissionResult {
  correct: number;
  total: number;
  score: number;            // 0-100 over the MCQ portion only
  perQuestion: { id: string; chosenIndex: number | null; correct: boolean; answerIndex: number; explanation: string }[];
  note: string;
}

/**
 * Score the MCQ portion of a coding assessment. `answers` maps question id →
 * chosen option index. Self-review free-text is stored separately and NEVER
 * auto-graded (we have no execution sandbox — that is explicit, not hidden).
 */
export function scoreCodingMcqs(answers: Record<string, number>): CodingSubmissionResult {
  const perQuestion = CODING_MCQS.map((q) => {
    const chosen = answers[q.id];
    const chosenIndex = (typeof chosen === 'number') ? chosen : null;
    return {
      id: q.id,
      chosenIndex,
      correct: chosenIndex === q.answerIndex,
      answerIndex: q.answerIndex,
      explanation: q.explanation,
    };
  });
  const answered = perQuestion.filter((p) => p.chosenIndex !== null);
  const correct = perQuestion.filter((p) => p.correct).length;
  const total = CODING_MCQS.length;
  const score = answered.length > 0 ? Math.round((correct / total) * 100) : 0;
  return {
    correct,
    total,
    score,
    perQuestion,
    note: 'MCQ knowledge check only — there is no code-execution sandbox on the platform. Self-review answers are recorded for reflection, not auto-graded.',
  };
}

// ── Curated group-discussion topics ──────────────────────────────────────────

export interface GroupDiscussionTopic {
  id: string;
  title: string;
  category: 'Abstract' | 'Current Affairs' | 'Business' | 'Technology' | 'Social';
  prompt: string;
  pointsFor: string[];
  pointsAgainst: string[];
  tips: string[];
}

export const GROUP_DISCUSSION_TOPICS: GroupDiscussionTopic[] = [
  {
    id: 'gd-1', title: 'Is remote work better than office work?', category: 'Business',
    prompt: 'Discuss the trade-offs of remote vs in-office work for early-career professionals.',
    pointsFor: ['Flexibility and no commute', 'Access to a wider job market', 'Often higher focus time'],
    pointsAgainst: ['Harder mentorship and visibility', 'Collaboration friction', 'Isolation risk'],
    tips: ['Acknowledge both sides before taking a stance', 'Bring a concrete example', 'Invite a quieter member to speak'],
  },
  {
    id: 'gd-2', title: 'Will AI replace entry-level jobs?', category: 'Technology',
    prompt: 'Debate the impact of AI automation on entry-level roles in the next five years.',
    pointsFor: ['Automates routine tasks', 'Raises productivity expectations'],
    pointsAgainst: ['Creates new roles (AI ops, review)', 'Judgement and context still human', 'Adoption is uneven across sectors'],
    tips: ['Define "replace" vs "augment" early', 'Avoid absolutes', 'Cite a real industry example'],
  },
  {
    id: 'gd-3', title: 'Should social media platforms regulate content?', category: 'Social',
    prompt: 'Discuss the responsibilities of platforms in moderating user content.',
    pointsFor: ['Reduces harm and misinformation', 'Protects vulnerable users'],
    pointsAgainst: ['Free-speech concerns', 'Scale makes it hard', 'Who decides the line?'],
    tips: ['Separate principle from implementation', 'Stay neutral in tone', 'Summarise the group view if you speak last'],
  },
  {
    id: 'gd-4', title: 'Is a college degree still worth it?', category: 'Abstract',
    prompt: 'Evaluate the value of a formal degree versus skills-based / self-directed learning.',
    pointsFor: ['Structured foundation and network', 'Signalling to employers'],
    pointsAgainst: ['Cost and opportunity cost', 'Skills can be self-taught', 'Some roles value portfolio over degree'],
    tips: ['Ground it in your field', 'Acknowledge it is context-dependent', 'Lead with a clear thesis'],
  },
];

/** Deterministic structured self-assessment scaffold for a GD attempt (no scoring). */
export const GROUP_DISCUSSION_SELF_REVIEW_DIMENSIONS = [
  { key: 'content', label: 'Content & relevance' },
  { key: 'clarity', label: 'Clarity of expression' },
  { key: 'listening', label: 'Active listening' },
  { key: 'leadership', label: 'Initiative / steering' },
  { key: 'bodyLanguage', label: 'Confidence & body language' },
] as const;

// ── Curated interview question bank (HR · Technical · Behavioural) ────────────
// Practice prompts that feed the Q&A feedback flow. These are static, curated
// starter questions (NOT AI-generated) so a student can rehearse the three core
// interview tracks. Each question carries a short "what good looks like" hint.

export type InterviewCategory = 'hr' | 'technical' | 'behavioral';

export interface InterviewQuestion {
  id: string;
  category: InterviewCategory;
  question: string;
  hint: string;
}

export const INTERVIEW_QUESTION_CATEGORIES: { id: InterviewCategory; label: string; description: string }[] = [
  { id: 'hr', label: 'HR', description: 'Motivation, fit, and self-awareness questions a recruiter / HR round asks.' },
  { id: 'technical', label: 'Technical', description: 'Role/skills questions — explain your approach out loud (no code execution here).' },
  { id: 'behavioral', label: 'Behavioural', description: 'Past-situation questions best answered with the STAR structure.' },
];

export const INTERVIEW_QUESTION_BANK: InterviewQuestion[] = [
  // HR
  { id: 'iq-hr-1', category: 'hr', question: 'Tell me about yourself.', hint: 'Give a 60–90s arc: who you are now → relevant experience → what you want next. Avoid reading your CV verbatim.' },
  { id: 'iq-hr-2', category: 'hr', question: 'Why do you want to work here?', hint: 'Connect something specific about the company/role to your own goals — show you researched it.' },
  { id: 'iq-hr-3', category: 'hr', question: 'What are your greatest strengths and one real weakness?', hint: 'Pick a strength relevant to the role with evidence; for the weakness, name a genuine one and what you do about it.' },
  { id: 'iq-hr-4', category: 'hr', question: 'Where do you see yourself in 3–5 years?', hint: 'Show direction and growth that is plausible within the company — ambition without sounding like you will leave immediately.' },
  // Technical
  { id: 'iq-tech-1', category: 'technical', question: 'Walk me through a technical project you are proud of and the decisions you made.', hint: 'Cover the problem, your role, key trade-offs, and the outcome. Be specific about what YOU did.' },
  { id: 'iq-tech-2', category: 'technical', question: 'How would you debug a feature that works locally but fails in production?', hint: 'Show a structured process: reproduce → isolate → check logs/config/data → form and test a hypothesis.' },
  { id: 'iq-tech-3', category: 'technical', question: 'Explain a core concept from your field to a non-technical person.', hint: 'Clarity over jargon — an analogy plus why it matters demonstrates real understanding.' },
  { id: 'iq-tech-4', category: 'technical', question: 'How do you make sure your work is correct and maintainable?', hint: 'Testing, reviews, readability, and handling edge cases — give a concrete habit, not a slogan.' },
  // Behavioural
  { id: 'iq-beh-1', category: 'behavioral', question: 'Tell me about a time you faced a difficult challenge and how you handled it.', hint: 'Use STAR: Situation → Task → Action → Result. Quantify the result if you can.' },
  { id: 'iq-beh-2', category: 'behavioral', question: 'Describe a conflict you had on a team and how you resolved it.', hint: 'Focus on your actions and the resolution, not blame. Show empathy and ownership.' },
  { id: 'iq-beh-3', category: 'behavioral', question: 'Tell me about a time you failed or made a mistake.', hint: 'Be honest, take ownership, and emphasise what you learned and changed afterwards.' },
  { id: 'iq-beh-4', category: 'behavioral', question: 'Give an example of a goal you set and how you achieved it.', hint: 'Show planning, persistence, and a measurable outcome — STAR works well here too.' },
];
