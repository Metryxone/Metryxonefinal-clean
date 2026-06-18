import { Router, Request, Response } from 'express';
import { pool, query as dbQuery } from '../db/client.js';
import { optionalAuth } from '../middleware/auth.js';
import { t, tActions } from './chat-i18n.js';
import { applyConcisenessFilter } from '../utils/conciseness-filter.js';
import { selectVideos } from '../utils/video-selector.js';

const router = Router();

// ─── Session Store ─────────────────────────────────────────────────────────────
type PreferredLanguage = 'english' | 'hindi' | 'tamil' | 'telugu' | 'marathi';

const LANGUAGE_LABELS: Record<PreferredLanguage, string> = {
  english: 'English',
  hindi: 'Hindi (हिंदी)',
  tamil: 'Tamil (தமிழ்)',
  telugu: 'Telugu (తెలుగు)',
  marathi: 'Marathi (मराठी)',
};

interface Turn { role: 'user' | 'assistant'; text: string; ts: number; }
interface Session {
  turns: Turn[];
  userType: UserType | null;
  detectedTopics: string[];
  lastIntent: IntentType | null;
  emotionalState: 'calm' | 'stressed' | 'uncertain';
  warmthLevel: number;
  createdAt: number;
  stage: 'open' | 'probing' | 'narrowing' | 'recommending';
  concern: string | null;    // 'learning' | 'exam' | 'career' | 'behaviour' | 'hr' | 'school'
  examUrgency: boolean;
  openProbingDone: boolean;  // true after the first diagnostic question has been asked
  preferredLanguage: PreferredLanguage;
}

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 30 * 60 * 1000;

function getSession(id: string): Session {
  const existing = sessions.get(id);
  if (existing) { existing.turns = existing.turns.slice(-20); return existing; }
  const s: Session = {
    turns: [], userType: null, detectedTopics: [],
    lastIntent: null, emotionalState: 'calm', warmthLevel: 0, createdAt: Date.now(),
    stage: 'open', concern: null, examUrgency: false, openProbingDone: false,
    preferredLanguage: 'english',
  };
  sessions.set(id, s);
  return s;
}
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) { if (now - s.createdAt > SESSION_TTL_MS) sessions.delete(id); }
}, 10 * 60 * 1000);

// ─── Types ────────────────────────────────────────────────────────────────────
type UserType = 'student' | 'teacher' | 'parent' | 'hr' | 'institution' | 'job_seeker' | 'career' | 'corporate' | 'coach' | 'guest';
type IntentType = 'informational' | 'advisory' | 'diagnostic' | 'transactional' | 'emotional' | 'greeting' | 'thanks';

// ─── Intent Detection ─────────────────────────────────────────────────────────
const INTENT_PATTERNS: Record<IntentType, RegExp[]> = {
  greeting:     [/\b(hi|hello|hey|good (morning|afternoon|evening)|howdy|namaste|namaskar|jai hind|vanakkam|pranam|adaab)\b/i],
  thanks:       [/\b(thank(s| you)|thx|cheers|great|awesome|perfect|brilliant|helpful)\b/i],
  informational:[/\bwhat (is|are|does|do)\b/i, /\bhow (does|do|is|are|can)\b/i, /\btell me about\b/i, /\bexplain\b/i, /\bdefine\b/i],
  advisory:     [/\bshould i\b/i, /\bwhat.*(recommend|suggest|advise)\b/i, /\bbest (way|approach|path|career)\b/i, /\badvice\b/i, /\bhow to improve\b/i, /\btips?\b/i, /\bhelp me\b/i],
  diagnostic:   [/\bwhy (is|am|are|does|do)\b/i, /\bstruggling\b/i, /\bweak(ness)?\b/i, /\blow score\b/i, /\bnot (good|doing well|passing)\b/i, /\bconcerned about\b/i, /\bproblem with\b/i],
  transactional:[/\b(book|schedule|demo|sign up|register|enroll|start|buy|purchase|subscribe|get started|trial)\b/i, /\bhow to (join|access|login|create account)\b/i],
  emotional:    [/\b(anxious|worried|stress(ed)?|scared|nervous|overwhelmed|frustrated|confused|lost|helpless|hopeless|don.?t know|no idea what|feeling (bad|down|stuck)|can.?t figure)\b/i],
};

function detectIntent(text: string): IntentType {
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS) as [IntentType, RegExp[]][]) {
    if (patterns.some(p => p.test(text))) return intent;
  }
  return 'informational';
}

// ─── User Type Detection ──────────────────────────────────────────────────────
const USER_TYPE_PATTERNS: Record<UserType, RegExp[]> = {
  student:     [/\b(i.m a student|as a student|i study|my (exam|marks|grades|school|college)|student here|i.m in (class|grade|year)|i.m in (10th|12th|11th|9th|8th|class\s*\d+))\b/i],
  teacher:     [/\b(i.m a teacher|teacher here|educator|i teach|my (students|class|classroom))\b/i],
  parent:      [/\b(i.m a parent|my (child|son|daughter|kid|beta|beti)|as a parent|parent here|my (child|son|daughter).{0,30}(marks|exams?|school|class|tuition|coaching|board|studying))\b/i],
  hr:          [/\b(i.m (in hr|an hr|a recruiter)|hiring|talent acquisition|hr here|i recruit)\b/i],
  institution: [/\b(our (school|college|university|institution|campus)|i (manage|run|lead) (a|an|the) (school|college))\b/i],
  job_seeker:  [/\b(looking for (a job|work)|i.m (job hunting|a fresher|seeking)|job seeker)\b/i],
  career:      [/\b(i.m (a career seeker|looking for career|seeking career guidance)|career (advice|guidance|seeker))\b/i],
  corporate:   [/\b(i.m from (a )?corporate|corporate (team|hr|context)|i work (in|at) (a )?(corporate|company|organization|enterprise))\b/i],
  coach:       [/\b(i.m a (coach|counsellor|counselor|life coach|career coach)|i coach|coaching (clients?|practice))\b/i],
  guest:       [],
};

function detectUserType(text: string, existing: UserType | null): UserType | null {
  for (const [type, patterns] of Object.entries(USER_TYPE_PATTERNS) as [UserType, RegExp[]][]) {
    if (type === 'guest') continue;
    if (patterns.some(p => p.test(text))) return type as UserType;
  }
  return existing;
}

// ─── Topic Detection ──────────────────────────────────────────────────────────
const TOPICS: Record<string, RegExp> = {
  lbi:              /\b(lbi|learning behavi(ou)?r(al)? index|behavioral (profile|report|assessment|index))\b/i,
  exam_ready:       /\b(exam.?ready|examreadiness|exam readiness|xri|eri|readiness index)\b/i,
  assessment:       /\b(assessment|test|quiz|evaluation)\b/i,
  career:           /\b(career|job|profession|future|occupation)\b/i,
  cpr_firstaid:     /\b(cpr|first.?aid|emergency|resuscitation|cardiac|choking|burn|fracture|shock)\b/i,
  skills:           /\b(skill(s)?|competency|competencies|employability|aptitude|resilience)\b/i,
  pricing:          /\b(pric(e|ing)|plan(s)?|cost|fee|package|subscription|free|trial)\b/i,
  reports:          /\b(report(s)?|analytics|insight(s)?|score(s)?|result(s)?)\b/i,
  mentor:           /\b(mentor|coach|session|1.on.1|tutor)\b/i,
  parent:           /\b(parent|child|son|daughter|kid|family)\b/i,
  institution:      /\b(school|college|university|campus|institute)\b/i,
  hr_hiring:        /\b(hr|hiring|recruit|candidate|talent|workforce)\b/i,
  glucose:          /\b(glucose|sugar|diabetes|blood sugar|insulin)\b/i,
  exam:             /\b(exam|test|board|entrance|jee|neet|ielts|sat|gcse|12th|10th)\b/i,
  learning:         /\b(learn(ing)?|focus|attention|concentration|retain|absorb|memory|study habits)\b/i,
  behaviour:        /\b(behav(iour|ior)|motivation|attitude|confidence|discipline|distract)\b/i,
  competency:       /\b(competency|competencies|cip|benchmark|industry benchmark|role.?fit)\b/i,
  enterprise:       /\b(enterprise|corporate|company|organisation|organization|workforce)\b/i,
  compliance:       /\b(dpdp|gdpr|soc2|privacy|data.?protect|secure|compliant|compliance)\b/i,
  domains:          /\b(domain(s)?|subdomain(s)?|dimension(s)?|how many (areas|sections|parts))\b/i,
  about:            /\b(about|who (is|are)|what is|company|founded|history|metryxone)\b/i,
  // ── Indian-context topics ──────────────────────────────────────────────────
  tuition:          /\b(tuit(ion|ions)|coaching (class(es)?|centre|center|institute)?|extra class(es)?|private (class(es)?|tutor)|tutor|tuition teacher)\b/i,
  stream_selection: /\b(stream (select(ion)?|choice|change|switch)|science stream|commerce stream|arts stream|pcm|pcb|which stream|after 10th|11th stream|stream confusion)\b/i,
  boards:           /\b(board exam(s)?|cbse board(s)?|icse board(s)?|state board|class 10 board|class 12 board|ssc board|hsc board|pre.?board|board result(s)?|board prep(aration)?)\b/i,
  topper_pressure:  /\b(topper|rank (one|1|holder)|class topper|comparison|comparing|other students?|neighbour.?s kid|relative.?s (child|son|daughter)|everyone else)\b/i,
  phone_screen:     /\b(phone|mobile|youtube|instagram|social media|reel(s)?|tiktok|screen time|gaming|video game(s)?|online video(s)?|addicted to phone|digital distract)\b/i,
  burnout:          /\b(burnout|burn.?out|overwhelm(ed)?|too much pressure|mental (health|stress|fatigue)|breakdown|crying (before|over) (exam|studies|school)|too stressed)\b/i,
  betterment:       /\b(betterment|improvement exam|compartment|back paper|fail(ed)? (in |the )?(board|exam|class)|repeat (the )?(year|class|exam))\b/i,
};

function detectTopics(text: string): string[] {
  return Object.entries(TOPICS).filter(([, r]) => r.test(text)).map(([k]) => k);
}

// ─── Concern Detection ────────────────────────────────────────────────────────
function detectConcern(text: string, topics: string[]): string | null {
  // ── Indian-context: Betterment / compartment / failed board ─────────────────
  if (topics.includes('betterment') || /\b(fail(ed)? (in |the )?(board|10th|12th|class)|compartment exam|improvement exam|betterment exam|back.?paper)\b/i.test(text)) return 'betterment';

  // ── Indian-context: Stream selection ────────────────────────────────────────
  if (topics.includes('stream_selection') || /\b(which stream|after 10th stream|pcm|pcb|science or commerce|arts stream|confused about stream|stream (choice|select))\b/i.test(text)) return 'career';

  // ── Indian-context: Burnout / topper pressure ────────────────────────────────
  if (topics.includes('burnout') || topics.includes('topper_pressure')) return 'behaviour';

  // ── Indian-context: Phone / screen / YouTube addiction ──────────────────────
  if (topics.includes('phone_screen') && /\b(study|studies|prep|board|exam|school|marks|syllabus)\b/i.test(text)) return 'behaviour';

  // ── Indian-context: Tuition / coaching dependency ───────────────────────────
  if (topics.includes('tuition') && /\b(depend(ent|ency|ing)?|rely|relying|without (tuition|coaching)|basic(s)?|weak (in|at)|understanding|concept)\b/i.test(text)) return 'learning';

  // Exam signals — explicit exam words first
  if (topics.includes('exam_ready') || /\b(examreadiness|eri)\b/i.test(text)) return 'exam';
  if (topics.includes('boards') || /\b(board exam(s)?|cbse|icse|ssc|hsc)\b/i.test(text)) return 'exam';
  if (/\b(exams?|boards?|entrance|jee|neet|upsc|sat|ielts|gcse|10th|12th|class\s*10|class\s*12)\b/i.test(text)) return 'exam';
  if (/\b(tests?|scores?|marks|results?|fail(ing|ed)?|pass(ing|ed)?|rank|percentile)\b/i.test(text)) return 'exam';
  if (/\b(worried|anxious|nervous|scared|stressed|panic|overwhelmed)\b.{0,25}\b(exams?|tests?|boards?|school|results?|studying|studies)\b/i.test(text)) return 'exam';
  if (/\b(exams?|tests?|boards?)\b.{0,25}\b(worried|anxious|nervous|scared|stressed|panic|pressure)\b/i.test(text)) return 'exam';
  // Class/grade level — 10th and 12th = boards = exam concern
  if (/\b(class|grade|std|standard|year)\s*(10|12|ten|twelve|x(?!i)|xii)\b/i.test(text)) return 'exam';
  // Class 6–9 or 11 = learning / general concern
  if (/\b(class|grade|std|standard|year)\s*(6|7|8|9|11|six|seven|eight|nine|eleven|vi{1,2}|ix|xi)\b/i.test(text)) return 'learning';

  // Learning / study struggle signals — natural language
  if (topics.includes('lbi') || topics.includes('assessment')) return 'learning';
  if (/\b(struggling|strug(gle|gles)?)\b.{0,30}\b(studies|study|school|learning|class|homework|subject|academic)\b/i.test(text)) return 'learning';
  if (/\b(studies|study|school|academic|homework)\b.{0,30}\b(struggling?|difficult|hard|problem|not going well|not doing well)\b/i.test(text)) return 'learning';
  if (/\b(not (doing|performing) well|poor performance|falling behind|falling grades|marks (have|are) (drop|fallen|gone down)|low marks|bad (results?|grades?|marks?))\b/i.test(text)) return 'learning';
  if (/\b(can.?t (focus|concentrate|sit down|pay attention)|hard to focus|trouble (focusing|concentrating|remembering|retaining))\b/i.test(text)) return 'learning';
  if (/\b(focus|attention|concentrate|distract|memory|absorb|study habit|retain|retention)\b/i.test(text)) return 'learning';
  if (/\b(not (understanding|getting it|keeping up)|behind in (class|school|studies))\b/i.test(text)) return 'learning';
  // Indian academic terms
  if (/\b(marks (have|are|have been) (drop(ped|ping)?|fall(en|ing)?|gone down|declin)|syllabus (not|is not|hasn.?t) (cover|done|finish)|weak in (maths|science|english|hindi|social|history))\b/i.test(text)) return 'learning';
  // Positive improvement-seeking signals
  if (/\b(improve|get better|do better|boost|enhance|work on)\b.{0,30}\b(academic|school|learning|study|studies|performance|grades?|marks?|results?|focus|memory|habits?)\b/i.test(text)) return 'learning';
  if (/\b(looking to|want to|trying to|hope to|need to|like to)\b.{0,20}\b(improve|get better|do better|learn better|study better|perform better|focus better)\b/i.test(text)) return 'learning';
  if (/\b(academic performance|study skills?|learning habits?|study habits?|school performance)\b/i.test(text)) return 'learning';

  // Behaviour / motivation signals
  if (/\b(not motivated|no motivation|unmotivated|lost interest|doesn.?t care|giving up|given up|no interest|refusing to study)\b/i.test(text)) return 'behaviour';
  if (/\b(behav(iour|ior)|attitude|discipline|emotion|mood|confidence|anxiety|anxious|burnout|stress(ed)?|overwhelm)\b/i.test(text)) return 'behaviour';
  if (/\b(motivation|confident|self.?esteem|self.?belief|not trying|procrastinat|worried|panic)\b/i.test(text)) return 'behaviour';

  // Career signals
  if (/\b(career|future|after school|after college|what (should|can) (he|she|they|i) (do|become)|which (stream|subject|course)|college (choice|selection)|stream selection)\b/i.test(text)) return 'career';
  if (/\b(don.?t know what (to do|they want)|no direction|lost|confused about (future|career|stream))\b/i.test(text)) return 'career';

  // HR / enterprise
  if (topics.includes('hr_hiring') || /\b(hr|hiring|recruit|candidate|talent|workforce)\b/i.test(text)) return 'hr';
  if (topics.includes('institution') || /\b(our school|our college|institution)\b/i.test(text)) return 'school';

  return null;
}

function detectExamUrgency(text: string): boolean {
  return /\b(next (week|month|few weeks)|in (\d+) (week|day|month)|coming up|very soon|boards? (are|is) (coming|near|next)|entrance (is|exam) (near|soon))\b/i.test(text);
}

// ─── Platform Knowledge Base ───────────────────────────────────────────────────
// Trained on all MetryxOne product content. Fires on specific factual queries
// before the stage-based diagnostic flow takes over.
//
// ── Sensitive-flag audit (counsellor response branches) ──────────────────────
// A reply is flagged `sensitive: true` when the parent/student is likely in an
// emotionally charged moment and would benefit from the highlighted video tile
// + softer follow-up. Emotional intent (detected upstream) is always sensitive;
// the branch-level flag adds coverage for topics where the *content* is loaded
// even if the user phrased it neutrally.
//
//   Sensitive (highlight video tile):
//     • Betterment / compartment / failed board exam — failure + family shame
//     • Coaching / tuition dependency — parental anxiety about child's basics
//     • Stream selection (PCM/PCB/etc.) — high-stakes life decision
//     • Phone / screen / digital distraction affecting studies — daily stress
//     • Topper pressure / comparative anxiety — self-worth & comparison
//     • Burnout / overwhelm / mental fatigue — mental health concern
//     • Wellbeing / mental health dashboard query — wellbeing context
//
//   Not sensitive (factual product / pricing / B2B / general info):
//     • About MetryxOne, What is LBI, LBI domains list, ExamReadiness, CIP,
//       Age bands, Mentor overview, Pricing, Privacy/compliance,
//       Assessment duration, JEE/NEET/UPSC prep info, K-12 schools,
//       Enterprise hiring, Campus recruitment, LBI report, Coaching institutes,
//       Sample report, Scientific validation, Languages, Pause/resume,
//       LBI vs IQ/aptitude — all informational, no emotional load.
function kbLookup(message: string, session: Session): BotResponse | null {
  const role = session.userType;

  // ── About MetryxOne ────────────────────────────────────────────────────────
  if (/\b(what is|who (is|are)|tell me about|about)\b.{0,20}\bmetryxone\b/i.test(message) ||
      /\bmetryxone\b.{0,20}\b(what|who|about|founded|company|history|story)\b/i.test(message)) {
    return {
      text: `**MetryxOne** is India's leading behavioural intelligence platform for education and enterprise.\n\nFounded in 2022 after identifying the gap between academic effort and outcomes — traditional education measures what students know, but rarely understands how they learn.\n\n**Built by:** Educational psychologists and AI researchers. The LBI™ framework took two years to develop and validate.\n\n**Scale today:**\n• 50,000+ students assessed\n• 500+ partner schools\n• 10+ Indian languages\n• 19 behavioural domains, 97 subdomains\n\n**What we do:** Behavioural intelligence for K-12 schools, JEE/NEET/UPSC coaching institutes, enterprise hiring, campus recruitment, and individual learners.\n\nAnything specific you'd like to understand better?`,
      actions: ['The LBI™ assessment', 'For schools', 'For enterprise hiring', 'Request a demo'],
    };
  }

  // ── What is LBI ────────────────────────────────────────────────────────────
  if (/\b(what is|tell me about|explain|define|about)\b.{0,25}\blbi\b/i.test(message) ||
      /\blbi\b.{0,20}\b(what|how|explain|tell|about|mean)\b/i.test(message) ||
      /\blearning behavi(ou)?r(al)? index\b/i.test(message)) {
    return {
      text: `The **LBI™ (Learning Behaviour Index)** is MetryxOne's core psychometric framework — the most comprehensive behavioural assessment for learners available in India.\n\n**What it measures:** 19 domains and 97 subdomains across academic, cognitive, emotional, social, and metacognitive dimensions.\n\n**Key domains:**\n• Academic & Cognitive Effectiveness\n• Thinking Quality Under Pressure\n• Exam Stress & Emotional Regulation\n• Confidence, Self-Concept & Comparison\n• Metacognition & Self-Regulation\n• Discipline, Habits & Consistency\n• Motivation, Values & Responsibility\n• Transition & Change Adaptability\n\n**Who it's for:** Students aged 6–18, across three age-adaptive bands. Also used in enterprise hiring and career assessment.\n\n**Time:** Full LBI 45–60 min, Mini LBI 25 min. Results are instant.\n\n**Compliance:** DPDP Act 2023, SOC2 Type II certified, GDPR-aligned.\n\nWant to know what the report shows, or how to start?`,
      actions: ['What does the report show?', 'Start LBI free now', 'LBI for schools', 'See pricing'],
    };
  }

  // ── LBI Domains — how many / list ─────────────────────────────────────────
  if ((/\b(how many|number of|list|all|which)\b.{0,20}\b(domains?|subdomains?|areas?|sections?|parts?)\b/i.test(message) ||
       /\b(domains?|subdomains?)\b.{0,20}\b(lbi|assessment|behavioural|behavioral|does|it have|in)\b/i.test(message)) &&
      /\b(lbi|assessment|behavioural|behavioral)\b/i.test(message)) {
    return {
      text: `The LBI™ covers **19 behavioural domains** with **97 subdomains** in total.\n\nThe 19 domains:\n1. Academic & Cognitive Effectiveness\n2. Thinking Quality Under Pressure\n3. Exam Stress & Emotional Regulation\n4. Confidence, Self-Concept & Comparison\n5. Adjustment & Coping Capacity\n6. Social & Emotional Intelligence\n7. Discipline, Habits & Consistency\n8. Communication & Expression\n9. Motivation, Values & Responsibility\n10. Lifestyle & Pressure Environment\n11. Competitive Exam Readiness\n12. Integrated Root Cause Mapping\n13. Academic Planning & Recovery\n14. Metacognition & Self-Regulation\n15. Help-Seeking & Support Utilization\n16. Academic Identity & Meaning\n17. Transition & Change Adaptability\n18. Teacher–Student Interaction\n19. Over-Compliance Risk\n\nThe full assessment (45–60 min) covers all 19. The Mini LBI (25 min) covers a focused subset.`,
      actions: ['Start LBI free now', 'What does the report show?', 'LBI for schools', 'Which domains matter most?'],
    };
  }

  // ── What is ExamReadiness / ERI ────────────────────────────────────────────
  if (/\b(what is|about|explain|tell me)\b.{0,25}\b(examreadiness|exam.?readiness|eri|readiness index)\b/i.test(message) ||
      /\b(examreadiness|exam.?readiness|eri)\b.{0,20}\b(what|how|explain|about)\b/i.test(message)) {
    return {
      text: `The **ExamReadiness Index™ (ERI)** is MetryxOne's exam-specific psychological readiness tool — built for boards, JEE, NEET, UPSC, and any high-stakes exam.\n\n**6 dimensions it measures:**\n1. Cognitive Preparedness — working memory, recall, conceptual readiness under simulated exam conditions\n2. Stress & Anxiety Management — pre-exam anxiety levels, stress reactivity, recovery speed\n3. Exam Execution Strategy — time allocation, question sequencing, skip-return discipline\n4. Focus & Attention Control — sustained attention, distraction resistance\n5. Recovery & Resilience — error recovery speed, mid-exam composure\n6. Self-Belief & Motivation — exam self-efficacy, attribution style\n\n**Output:** 0–100 readiness score per subject + a specific 4-week preparation plan based on where the student actually is — not a generic checklist.\n\n**Time:** 20 minutes. Results are instant.\n\nCoaching institutes using MetryxOne reported a 22% improvement in student confidence scores after just one semester. Want to start?`,
      actions: ['Start ExamReadiness free', 'Do LBI + ExamReadiness together', 'JEE preparation', 'NEET preparation'],
    };
  }

  // ── Competency Intelligence Platform / CIP ─────────────────────────────────
  if (/\b(what is|about|explain|tell me)\b.{0,25}\b(cip|competency intelligence|competency platform)\b/i.test(message) ||
      /\bcompetency (intelligence|platform|benchmarks?)\b/i.test(message)) {
    return {
      text: `The **Competency Intelligence Platform (CIP)** is MetryxOne's enterprise tool for workforce and hiring intelligence.\n\n**What it does:**\n• Benchmarks individuals against 50 competencies across 7 industries\n• Compares against real industry cohorts: 3,200+ in Technology, 1,800+ in Finance, 1,400+ in Healthcare, 1,100+ in Consulting, 900+ in Education, 800+ in E-Commerce, 700+ in Manufacturing\n• Generates role-fit scores, gap analyses, and AI-powered growth simulation paths\n• Predicts hiring success and identifies leadership-ready candidates\n• Supports career stage progression: Junior (0–2 yrs) → Mid → Senior → Lead (10+ yrs)\n\n**Built for:** Enterprise hiring, leadership development, L&D strategy, campus recruitment\n\nWant to see how it fits your use case?`,
      actions: ['Enterprise hiring use case', 'Campus recruitment use case', 'Leadership development', 'Book a demo'],
    };
  }

  // ── Age bands ──────────────────────────────────────────────────────────────
  if (/\b(age|age.?band|age.?group|how old|year(s)?)\b.{0,20}\b(lbi|assessment|child|student|appropriate)\b/i.test(message) ||
      /\b(lbi|assessment)\b.{0,20}\b(age|year|old|band|range)\b/i.test(message)) {
    return {
      text: `The LBI™ uses **3 age-adaptive bands** — questions, scoring norms, and interpretations are all calibrated for each stage of development:\n\n**Band A — Primary (6–10 years):** Foundational learning patterns, early cognitive habits, social-emotional baselines, attention and engagement tracking. 12 domains active.\n\n**Band B — Middle School (11–14 years):** Critical developmental period. Exam stress, peer comparison sensitivity, academic identity formation, self-regulation maturity. 17 domains active.\n\n**Band C — Senior Secondary (15–18 years):** Full 19 domains. Competitive exam readiness, metacognitive maturity, career alignment, complex stress management, college-readiness behavioural index.\n\nThe system selects the right band automatically based on the student's age.`,
      actions: ['Start free assessment', 'Band A (Primary 6–10)', 'Band C (15–18, exams)', 'See sample report'],
    };
  }

  // ── Mentor overview — general "tell me about mentors" queries ─────────────
  if (/\b(mentor(s)?|mentor marketplace|tutor(s)?)\b/i.test(message) &&
      /\b(about|know|tell|what|how|available|services?|explain|overview|describe|work|do you have|are there)\b/i.test(message) &&
      !/\b(pric(e|ing)|cost|rate|fee|how much|rupee|₹|match(ing|ed)?|how (does|is|are)|who are the)\b/i.test(message)) {
    return {
      text: `MetryxOne has a **Mentor Marketplace** — 8 expert mentors, each matched to students based on their LBI™ behavioural profile, not just by subject.\n\n**Who is on the marketplace:**\n• Science & Biology specialist (NEET, Class VI–XII)\n• English & Humanities specialist (CBSE/ICSE)\n• Behavioural Coach (study skills, exam stress, metacognition)\n• Test Prep & Academic Planning Coach\n• Senior Maths & Physics Educator (IIT-Bombay alumna, JEE/NEET)\n• Child Psychologist & Academic Counsellor (M.Phil Clinical Psychology)\n• IIT/IIM Alumni, Senior Career Counsellor (18 years exp)\n\n**How it works:**\n1. Your child completes an LBI™ assessment (25 min)\n2. Our AI matches them to the right mentor based on how they learn — not just subject\n3. Most mentors offer a **free introductory session** before any commitment\n4. Sessions are 1-on-1, online, DPDP Act 2023 compliant (parental consent recorded)\n\nRates range from **₹1,100 to ₹2,500/hr** depending on the mentor's specialisation.\n\nWould you like to browse the marketplace, see pricing, or start the LBI to get matched first?`,
      actions: ['Browse mentor marketplace', 'See mentor pricing', 'Start LBI for matching', 'Book a free intro session'],
    };
  }

  // ── Mentor pricing / rates — checked BEFORE general pricing ───────────────
  if ((/\b(mentor|tutor)\b.{0,20}\b(pric(e|ing)|cost|rate|fee|how much|rupee|₹)\b/i.test(message) ||
       /\b(pric(e|ing)|cost|rate|fee|how much)\b.{0,20}\b(mentor|tutor)\b/i.test(message) ||
       /\bmentor.{0,10}(session|hour|hr)\b/i.test(message)) &&
      !/\blbi\b/i.test(message)) {
    return {
      text: `Mentor sessions on MetryxOne are priced per hour. Our 8 LBI-matched mentors range from:\n\n• **₹1,100/hr** — Science & Biology specialist (NEET Bio, Class VI–XII)\n• **₹1,200/hr** — English & Humanities specialist (CBSE/ICSE)\n• **₹1,500/hr** — Behavioural Coach (study skills, exam stress, metacognition)\n• **₹1,600/hr** — Test Prep & Academic Planning Coach\n• **₹1,800/hr** — Senior Maths & Physics Educator (IIT-Bombay alumna, JEE/NEET)\n• **₹2,200/hr** — Child Psychologist & Academic Counsellor (M.Phil Clinical Psychology)\n• **₹2,500/hr** — IIT/IIM Alumni, Senior Career Counsellor (18 years exp)\n\nMany mentors offer a **free introductory session** to confirm the fit before you commit. Matching is based on your child's LBI™ profile — not just subject preference.\n\nWant to browse the mentor marketplace or start the LBI to get matched?`,
      actions: ['Browse mentors now', 'Start LBI first, then get matched', 'Book a free intro session', 'How does mentor matching work?'],
    };
  }

  // ── Mentor matching process — checked BEFORE general pricing ──────────────
  if (/\b(how does|how is)\b.{0,20}\b(mentor|matching)\b.{0,10}\bwork\b/i.test(message) ||
      /\bmentor.{0,10}match(ing|ed)?\b/i.test(message) ||
      /\bhow.{0,10}(are|do).{0,10}mentors?.{0,10}(matched|selected|chosen)\b/i.test(message)) {
    return {
      text: `Mentor matching on MetryxOne is **profile-based, not random**.\n\nHere's the process:\n\n1. **LBI™ Assessment (25–60 min)** — maps how the student actually learns, focuses, handles stress, and communicates. 19 behavioural domains.\n\n2. **AI Matching Engine** — compares the student's profile against each mentor's behavioural specialisation and coaching approach. Generates a compatibility score shown on each mentor card.\n\n3. **Introductory Session** — most mentors offer a free 30-minute introductory session. No commitment required — just to confirm the fit.\n\n4. **Regular Sessions** — 1-on-1, online, structured around the goals agreed. Three session types: Preliminary (getting started), Deep-Dive (intensive), Ongoing (regular support).\n\nAll video sessions are DPDP Act 2023 compliant — parental consent is recorded before every session involving a minor.\n\nWant to start the LBI to get matched, or browse the mentor marketplace first?`,
      actions: ['Start LBI™ for matching', 'Browse mentor marketplace', 'Book a free intro session', 'See mentor pricing'],
    };
  }

  // ── Pricing — general ──────────────────────────────────────────────────────
  if (/\b(pric(e|ing)|plan|cost|fee|subscription|package|how much|rupee|₹|inr)\b/i.test(message)) {
    if (role === 'institution' || /\b(school|institute|college|university)\b/i.test(message)) {
      return {
        text: `For **schools and institutions**, pricing is annual per-seat and confirmed after a 20-minute demo. Key things to know:\n\n• Volume discounts from 500+ students\n• Includes cohort dashboards, individual LBI reports, admin access, parent communication tools, and ExamReadiness assessments\n• NEP 2020 aligned, DPDP Act compliant out of the box\n• 7-day money-back guarantee for paid plans\n• 500+ schools already on board\n\nThe best first step is the demo — you see live sample reports and get a pricing proposal specific to your school size. Want to book that?`,
        actions: ['Book a school demo', 'What schools get', 'Individual vs cohort reports', 'Contact sales'],
      };
    }
    if (role === 'hr' || role === 'corporate' || /\b(enterprise|corporate|hiring)\b/i.test(message)) {
      return {
        text: `Enterprise pricing is custom — based on assessment volume, features required, and integration needs. It's confirmed after a walkthrough of the platform.\n\n**What's typically included:**\n• Behavioral profiling at any scale (500+ candidates in parallel)\n• 50+ pre-built role assessment templates\n• ATS / HRMS integration\n• Cohort analytics and competency benchmarks\n• Culture-fit scoring\n\nWant to book a 20-minute demo to get a precise quote?`,
        actions: ['Book an enterprise demo', 'See what enterprise includes', 'Campus drive pricing', 'See the platform'],
      };
    }
    return {
      text: `Here's how MetryxOne is structured for individuals and families:\n\n**Free Plan** — basic dashboard, 1 child profile, exam tracking, basic reports. No card needed, ever.\n\n**Starter Plan** — 2 child profiles, full dashboard, 1 Micro LBI Check, AI Study Planner, AI Assistant (10 queries/month), weekly email reports.\n\n**Pro Plan** — 5 child profiles, 1 Full LBI Assessment, unlimited AI Assistant, Mentor Marketplace access, Curriculum Planner, Learning Forum, priority support, custom report schedule.\n\n**LBI Assessment Packages** — one-time add-ons for deep behavioural reports, sold separately from platform plans. Categories: Micro Check (entry-level), Exam-Season Special, Annual Core, Premium, Post-Exam / Transition.\n\n**Schools & Enterprises** — annual per-seat pricing after a demo. Volume discounts apply.\n\nThe Free plan is a good place to start — no card, instant access. Where would you like to go from there?`,
      actions: ['Start free today', 'Tell me about the Pro plan', 'LBI assessment packages', 'School or enterprise pricing'],
    };
  }

  // ── Privacy / compliance ───────────────────────────────────────────────────
  if (/\b(privacy|safe|secure|data|dpdp|gdpr|soc2|compliance|compliant|protect|trust)\b/i.test(message)) {
    return {
      text: `MetryxOne handles sensitive data — especially data involving children — with the highest security standards.\n\n**Compliance certifications:**\n• DPDP Act 2023 (India) — full compliance, explicit parental consent required for all minors\n• GDPR-aligned for international users\n• SOC2 Type II certified\n\n**Data practices:**\n• All data encrypted at rest and in transit\n• No personal data shared with third parties, ever\n• Parental consent recorded before every assessment and every mentor video session involving a minor\n• DPDP consent is re-confirmed at the start of every video call\n• Audit trails maintained for all consent and access actions\n\nWe do not label or rank children publicly. Reports are private and shared only with authorised parties.`,
      actions: ['Start free (no card needed)', 'Parental consent workflow', 'School DPDP compliance', 'Contact for compliance docs'],
    };
  }

  // ── Assessment duration ────────────────────────────────────────────────────
  if (/\b(how long|duration|time|how many minutes|minutes|how much time)\b.{0,20}\b(assessment|lbi|examreadiness|take|complete)\b/i.test(message) ||
      /\b(assessment|lbi|examreadiness)\b.{0,20}\b(how long|duration|time|minutes|take)\b/i.test(message)) {
    return {
      text: `**Assessment durations on MetryxOne:**\n\n• **Full LBI™** — 45–60 minutes. Covers all 19 domains and 97 subdomains. AI adapts question difficulty, so some students finish faster. Progress is auto-saved and can be resumed.\n\n• **Mini LBI (Micro Check)** — approximately 25 minutes. Covers the highest-impact domains.\n\n• **ExamReadiness Index™** — approximately 20 minutes. Focused on 6 exam-readiness dimensions.\n\n• **Free Quick Assessment** — 8–10 questions, 5–7 minutes. Instant snapshot, not a full report.\n\nResults for all assessments are available immediately after completion. No waiting.`,
      actions: ['Start LBI free now', 'Start ExamReadiness free', 'Do the Micro Check', 'Which assessment is right for me?'],
    };
  }

  // ── JEE / NEET / UPSC / competitive exams ─────────────────────────────────
  if (
    /\b(jee|iit|neet|upsc|civil services)\b/i.test(message) ||
    /\b(jee\s+ki\s+taiyar(?:i|aari|ee|aree)|jee\s+padhai|jee\s+prep|iit\s+ki\s+taiyar(?:i|aari|ee|aree)|iit\s+padhai|iit\s+prep)\b/i.test(message) ||
    /\b(neet\s+ki\s+taiyar(?:i|aari|ee|aree)|neet\s+padhai|neet\s+prep|neet\s+ki\s+padhai)\b/i.test(message) ||
    /\b(upsc\s+ki\s+taiyar(?:i|aari|ee|aree)|upsc\s+padhai|upsc\s+prep|ias\s+ki\s+taiyar(?:i|aari|ee|aree)|ias\s+prep|civil\s+services\s+ki\s+taiyar(?:i|aari|ee|aree)|ias\s+banna)\b/i.test(message) ||
    /जेईई|नीट|यूपीएससी|आईएएस|प्रतियोगी\s*परीक्षा|इंजीनियरिंग\s*प्रवेश/.test(message) ||
    /ஜேஈஈ|நீட்|யுபிஎஸ்சி|போட்டித்தேர்வு/.test(message) ||
    /జేఈఈ|నీట్|యుపిఎస్సి|పోటీ\s*పరీక్ష/.test(message) ||
    /\b(jee\s+chi\s+taiyari|jee\s+cha\s+abhyas|jee\s+sathi|iit\s+chi\s+taiyari|iit\s+cha\s+abhyas|iit\s+sathi)\b/i.test(message) ||
    /\b(neet\s+chi\s+taiyari|neet\s+cha\s+abhyas|neet\s+sathi)\b/i.test(message) ||
    /\b(upsc\s+chi\s+taiyari|upsc\s+cha\s+abhyas|upsc\s+sathi|ias\s+chi\s+taiyari|ias\s+sathi|spardha\s+pariksha)\b/i.test(message) ||
    /स्पर्धा\s*परीक्षा/.test(message) ||
    /\b(jee\s+poriksha|jee\s+er\s+(?:preparation|taiyari|provuti)|jee\s+prep\s+korchi)\b/i.test(message) ||
    /\b(neet\s+poriksha|neet\s+er\s+(?:preparation|taiyari|provuti)|neet\s+prep\s+korchi)\b/i.test(message) ||
    /\b(upsc\s+poriksha|upsc\s+er\s+(?:preparation|taiyari|provuti)|ias\s+poriksha|ias\s+er\s+(?:preparation|provuti)|pratiyogita\s+poriksha)\b/i.test(message) ||
    /জেইই|নীট|ইউপিএসসি|আইএএস|প্রতিযোগিতামূলক\s*পরীক্ষা/.test(message)
  ) {
    const exam = /\b(jee|iit)\b/i.test(message) ||
      /\b(jee\s+ki\s+taiyar(?:i|aari|ee|aree)|jee\s+padhai|jee\s+prep|iit\s+ki\s+taiyar(?:i|aari|ee|aree)|iit\s+padhai|iit\s+prep)\b/i.test(message) ||
      /\b(jee\s+chi\s+taiyari|jee\s+cha\s+abhyas|jee\s+sathi|iit\s+chi\s+taiyari|iit\s+cha\s+abhyas|iit\s+sathi)\b/i.test(message) ||
      /\b(jee\s+poriksha|jee\s+er\s+(?:preparation|taiyari|provuti)|jee\s+prep\s+korchi)\b/i.test(message) ||
      /जेईई|ஜேஈஈ|జేఈఈ|জেইই/.test(message)
        ? 'JEE'
        : /\bneet\b/i.test(message) ||
          /\b(neet\s+ki\s+taiyar(?:i|aari|ee|aree)|neet\s+padhai|neet\s+prep|neet\s+ki\s+padhai)\b/i.test(message) ||
          /\b(neet\s+chi\s+taiyari|neet\s+cha\s+abhyas|neet\s+sathi)\b/i.test(message) ||
          /\b(neet\s+poriksha|neet\s+er\s+(?:preparation|taiyari|provuti)|neet\s+prep\s+korchi)\b/i.test(message) ||
          /नीट|நீட்|నీట్|নীট/.test(message)
            ? 'NEET'
            : 'UPSC';
    const lang = session.preferredLanguage;
    const rawTranslation = t('initial_competitive_exam', lang);
    const translatedText = rawTranslation ? rawTranslation.replace('{exam}', exam) : null;
    return {
      text: translatedText ?? `For **${exam} preparation**, two MetryxOne tools work together:\n\n**ExamReadiness Index™** — measures psychological readiness specifically for high-stakes competitive exams. 6 dimensions: cognitive preparedness, stress management, exam execution strategy, focus control, recovery resilience, self-belief. 0–100 score per subject + a specific 4-week plan. 20 minutes.\n\n**LBI™** — the deeper behavioural profile. Reveals *why* you perform a certain way under pressure, where your root-cause study-habit gaps are, and what specific interventions will actually move the needle. 45–60 minutes.\n\nCoaching institutes on MetryxOne have reported:\n• 22% improvement in student confidence scores after one semester\n• Early identification of burnout-risk students before it affects results\n• Batch-level analytics showing which students need intervention\n\nWant to start with ExamReadiness (fastest) or go straight to the full LBI?`,
      actions: tActions('initial_competitive_exam_actions', lang) ?? ['Start ExamReadiness free', 'Start LBI free', 'Do both together', 'For a coaching institute'],
    };
  }

  // ── Indian context: Betterment / compartment / failed board exam ─────────────
  if (
    /\b(betterment exam|improvement exam|compartment exam|fail(ed)? (in |the )?(10th|12th|board)|back.?paper|repeat (year|class))\b/i.test(message) ||
    /\b(betteri pariksha|compartment pariksha|napaas|fail ho gaya|board mein fail|sudhar pariksha|naapas zhalo|tholvvi|board fail aachi|fail ayyadu|10th lo fail|12th lo fail)\b/i.test(message) ||
    /बेहतरी|कम्पार्टमेंट|नापास|फेल हो|बोर्ड में फेल|सुधार परीक्षा|தோல்வி|கம்பார்ட்மென்ட்|బెటర్‌మెంట్|కంపార్ట్‌మెంట్|ఫెయిల్/.test(message)
  ) {
    const lang = session.preferredLanguage;
    return {
      text: t('initial_betterment', lang) ?? `I understand this must be a stressful time — for both you and your child. It's important to know that a **Betterment or Compartment exam is not a dead end**. In fact, many students have used this as a turning point.\n\n**What Pragati can help you understand:**\n\n**The Observation:** This situation often points to a mismatch between how your child learns and how they are being taught — not a lack of intelligence.\n\n**The Indian Context:** In our education system, Class 10/12 results carry enormous social weight. But the "Betterment" path is a valid, government-recognised route. Many successful professionals in India cleared their boards on their second attempt.\n\n**The Pragati Advice:** Before adding more tuition or pressure, let's first understand *why* the performance dipped. Was it conceptual gaps, exam anxiety, poor time management, or external stress? The LBI™ assessment maps exactly this in 25 minutes.\n\nWould you like to start with the LBI assessment to understand the root cause?`,
      actions: tActions('initial_betterment_actions', lang) ?? ['Start LBI to find root cause', 'How does LBI help in board prep?', 'Book a mentor for board prep', 'ExamReadiness for Betterment exam'],
      sensitive: true,
    };
  }

  // ── Indian context: Tuition / coaching dependency ─────────────────────────
  if (
    (
      /\b(tuit(ion|ions)|coaching (class(es)?|centre|center|institute)?|extra class(es)?|private (class(es)?|tutor)|tuition teacher)\b/i.test(message) &&
      /\b(depend|rely|without|basic|concept|weak|always need|can.?t study without)\b/i.test(message)
    ) ||
    (
      /\b(tuition ke bina|coaching ke bina|tuition bina|coaching par nirbhar|tuition par nirbhar|shikavani shivay|tuition illama|tuition lekunte|tuition shivay)\b/i.test(message) ||
      /कोचिंग.*निर्भर|निर्भर.*ट्यूशन|ट्यूशन.*निर्भर|शिकवणी.*शिवाय|ट्यूशन.*बिना|ட்யூஷன்.*இல்லாம|ட்யூஷன் இல்லாம|ట్యూషన్.*లేకుండా|ట్యూషన్ లేకుండా/.test(message)
    )
  ) {
    const lang = session.preferredLanguage;
    return {
      text: t('initial_tuition', lang) ?? `This is one of the most common concerns we hear from Indian parents — and it's a genuine behavioural pattern worth addressing early.\n\n**The Observation:** Your child may be experiencing **Coaching Dependency** — where the brain relies on external instruction rather than building its own understanding and recall pathways.\n\n**The Indian Context:** India's tuition culture has made independent learning less practiced. Studies suggest that nearly 71% of students in metro cities attend coaching alongside school. The issue isn't the coaching — it's whether the child's **Basics** (conceptual foundations) are being built or just exam-answer patterns are being memorised.\n\n**The Pragati Advice:** Instead of adding more tuition, consider starting with 20 minutes of **"Deep Work"** — unaided attempt at problems before looking at solutions. This builds independent thinking capacity.\n\nThe LBI™ assessment can tell us whether this is a **metacognitive gap** (not knowing how to study independently) or a **conceptual gap** (genuinely missing foundational understanding). Both need different interventions.\n\nWould you like to start the assessment to find out which it is?`,
      actions: tActions('initial_tuition_actions', lang) ?? ['Start LBI to diagnose the gap', 'Book a mentor for independent study skills', 'How does LBI map metacognition?', 'See pricing'],
      sensitive: true,
    };
  }

  // ── Indian context: Stream selection after Class 10 ───────────────────────
  if (
    /\b(stream (select(ion)?|choice|change|switch)|science stream|commerce stream|arts stream|pcm|pcb|which stream|after 10th|11th stream|stream confusion|pcm or pcb|science or commerce|arts vs science)\b/i.test(message) ||
    /\b(kaunsi stream|stream chunav|10th ke baad stream|vigyan stream|vanijya stream|kala stream|stream nivad|10th nantar stream|ariviyal padikkalamaa|vanikam stream|stream ela teesukovali|vignanam teesukovalaa|10th tarvad stream)\b/i.test(message) ||
    /स्ट्रीम.*चुनाव|कौन सी स्ट्रीम|विज्ञान.*स्ट्रीम|वाणिज्य.*स्ट्रीम|कला.*स्ट्रीम|10वीं.*बाद.*स्ट्रीम|पीसीएम|पीसीबी|कौन सा विषय.*10वीं/.test(message) ||
    /स्ट्रीम.*निवड|विज्ञान.*शाखा|वाणिज्य.*शाखा|कला.*शाखा|10वी.*नंतर.*शाखा|कोणती.*शाखा/.test(message) ||
    /அறிவியல்.*படிக்க|வணிகம்.*படிக்க|கலை.*படிக்க|எந்த.*stream|stream.*தேர்வு|10ஆம்.*வகுப்பு.*பிறகு|எந்த.*பிரிவு|அறிவியல்.*பிரிவு|வணிக.*பிரிவு/.test(message) ||
    /స్ట్రీమ్.*ఎంపిక|10వ.*తర్వాత.*స్ట్రీమ్|సైన్స్.*తీసుకోవాలా|కామర్స్.*తీసుకోవాలా|ఏ.*స్ట్రీమ్.*తీసుకోవాలి|పీసీఎం|పీసీబీ/.test(message)
  ) {
    const lang = session.preferredLanguage;
    return {
      text: t('initial_stream', lang) ?? `Stream selection after Class 10 is one of the most consequential decisions in an Indian student's life — and it's often made under family pressure or peer influence rather than on actual ability and interest alignment.\n\n**The Observation:** Many students struggle in their chosen stream not because they're not intelligent, but because their **cognitive strengths are misaligned** with stream demands.\n\n**The Indian Context:** The pressure to choose Science (especially PCM/PCB for JEE/NEET) can lead to what we call **"Stream-Ability Misalignment"** — a significant factor behind Class 11 performance drops and motivation loss.\n\n**The Pragati Advice:** Before choosing a stream, do the LBI™ assessment. It maps your child's cognitive strengths — whether they are more analytical-sequential (suited to PCM), conceptual-holistic (PCB/Biology), language-creative (Humanities), or commercial-strategic (Commerce). This takes the guesswork out of stream selection.\n\nWould you like to start?`,
      actions: tActions('initial_stream_actions', lang) ?? ['Start LBI for stream selection guidance', 'How does LBI map stream fit?', 'Book a career counselling session', 'What if they chose the wrong stream already?'],
      sensitive: true,
    };
  }

  // ── Indian context: Phone / YouTube / screen addiction affecting studies ────
  if (
    (
      /\b(phone|mobile|youtube|instagram|social media|reel(s)?|screen time|gaming|video game(s)?|addicted to phone)\b/i.test(message) &&
      /\b(study|studies|board|exam|marks|school|prep|syllabus|homework)\b/i.test(message)
    ) ||
    (
      /\b(phone mein busy|mobile dekhta|youtube pe time|phone ki lat|mobile ki lat|phone paathutu|phone adikku|phone chustune|mobile madhe|phone madhye garkav|mobile madhye|youtube var time|padhai nahi kar raha phone ki wajah)\b/i.test(message) ||
      /फोन.*पढ़ाई|मोबाइल.*पढ़ाई|पढ़ाई.*फोन|फोन की लत|मोबाइल की लत|यूट्यूब.*पढ़ाई|स्क्रीन.*समय.*पढ़ाई|गेमिंग.*पढ़ाई/.test(message) ||
      /फोन.*अभ्यास|मोबाईल.*अभ्यास|यूट्यूब.*अभ्यास|स्क्रीन.*वेळ|फोन.*व्यसन|मोबाइल.*व्यसन/.test(message) ||
      /போன்.*படிப்பு|மொபைல்.*படிப்பு|யூட்யூப்.*படிப்பு|திரை.*நேரம்|கேமிங்.*படிப்பு|போன்.*அடிமை|மொபைல்.*அடிமை/.test(message) ||
      /ఫోన్.*చదువు|మొబైల్.*చదువు|యూట్యూబ్.*చదువు|స్క్రీన్.*సమయం|గేమింగ్.*చదువు|ఫోన్.*వ్యసనం|మొబైల్.*వ్యసనం/.test(message)
    )
  ) {
    const lang = session.preferredLanguage;
    return {
      text: t('initial_phone', lang) ?? `I understand your concern. This is one of the most frequently raised issues by Indian parents today — especially with 10th and 12th board preparation.\n\n**The Observation:** This sounds like **Digital Distraction** leading to **Academic Neglect**. In the lead-up to Boards, this creates a 'Dopamine Dependency' where the brain finds textbooks boring compared to short-form content.\n\n**The Impact:** This doesn't just lower marks — it reduces the **Mental Stamina** needed for 3-hour exam papers. Students who spend 4+ hours on screens before exams show significantly lower focus endurance during actual tests.\n\n**The Pragati Advice:** Have you tried a **'Digital Lockdown'** during study hours — a fixed, agreed phone-free window (e.g., 5pm–8pm)? Research shows 3-week consistency is needed before the brain re-adapts. However, if the phone use is also for YouTube learning, we need to separate productive vs. recreational screen time.\n\nThe LBI™ assessment can map your child's **Discipline & Habit patterns** and **Attention Control** — showing exactly how severe the focus issue is and what interventions will actually work.\n\nWould you like to start?`,
      actions: tActions('initial_phone_actions', lang) ?? ['Start LBI to map focus & discipline', 'Book a behavioural coaching session', 'ExamReadiness for boards', 'Tips for digital lockdown at home'],
      sensitive: true,
    };
  }

  // ── Indian context: Topper pressure / parental comparison ─────────────────
  if (
    /\b(topper|rank (one|1|holder)|class topper|always comparing|neighbour.?s (kid|child|son|daughter)|relative.?s (kid|son|daughter)|compared to (his|her|other|the topper)|class (rank|position)|why can.?t (he|she|my child) be like)\b/i.test(message) ||
    /\b(topper jaisa|tulna karna|padosi ka beta|padosi ki beti|padosi ka bacha|rishtedaron ka bacha|compare karte hain|kyun nahi ban sakta|topper maari|veetu pakkam pillai|compare pannuran|topper laaga|polavadaniki|compare chestunnaru|topper sarkha|shejaracha mulga|tulna karatat)\b/i.test(message) ||
    /टॉपर|पड़ोसी का बच्चा|पड़ोसी का बेटा|रिश्तेदार.*बच्चा|टॉपर जैसा|देखो.*कितने नंबर|उसकी तरह क्यों नहीं/.test(message) ||
    /टॉपर सारखा|शेजारचा मुलगा|नातेवाईकांचा मुलगा|तुलना करतात|बघ किती मार्क/.test(message) ||
    /டாப்பர்|ஒப்பிட்டு|அவங்க பையன் பாரு|எத்தனை மதிப்பெண்|அவனைப் போல் ஏன்|பக்கத்து வீட்டு பையன்/.test(message) ||
    /టాపర్|పోల్చడం|వాళ్ళ అబ్బాయి చూడు|ఎన్ని మార్కులు|టాపర్ లాగా ఎందుకు కాదు|పక్కింటి పిల్లాడు/.test(message)
  ) {
    const lang = session.preferredLanguage;
    return {
      text: t('initial_topper', lang) ?? `This is a deeply human concern — and it comes from a place of love. But I want to gently share something important.\n\n**The Observation:** **"Topper Pressure"** and external comparison can trigger what we call **Comparative Anxiety** — where a child measures self-worth against peers, making intrinsic motivation very difficult to maintain.\n\n**The Indian Context:** India's academic culture heavily valorises rank and marks. This can create what psychologists call a **"Fixed Mindset"** — where children believe intelligence is fixed, failure is shameful, and effort is only worthwhile if it guarantees a top result. This mindset actually reduces performance over time.\n\n**The Pragati Advice:** Instead of focusing on what other children are doing, let's understand what *your* child's natural cognitive strengths and behavioural patterns are. Every child has a unique profile — and peak performance comes from working with that profile, not against it.\n\nThe LBI™ assessment will show you exactly where your child's strengths lie and what conditions help them thrive — giving you a science-backed, child-specific path forward instead of a comparison-based one.\n\nWould you like to start?`,
      actions: tActions('initial_topper_actions', lang) ?? ['Start LBI to find my child\'s strengths', 'How does LBI help with confidence?', 'Book a behavioural coaching session', 'How does comparison affect performance?'],
      sensitive: true,
    };
  }

  // ── Indian context: Burnout / too much pressure ───────────────────────────
  if (
    /\b(burnout|burn.?out|overwhelm(ed)?|too much pressure|mental (health|stress|fatigue)|breakdown|crying (before|over) (exam|studies|school)|too stressed|can.?t take (it|the pressure|anymore)|doesn.?t want to (go to school|study|attend class))\b/i.test(message) ||
    /\b(bahut thaka|bahut dabav|bahut tanav|padhai se dar|school nahi jaana|rona aa raha|padhai nahi karna chahta|thakava alay|stress agiruchu|pressure adhigama|padikka vendam|ottidi ekkuva|stress ga undi|chala ottidi|abhyas nako|khup thakava|jast dadpan|jast taan)\b/i.test(message) ||
    /बहुत दबाव|पढ़ाई से डर|स्कूल नहीं जाना|तनाव ज़्यादा|रोना आ रहा|पढ़ाई नहीं करना चाहता|बहुत थकान/.test(message) ||
    /खूप थकवा|जास्त दडपण|अभ्यास नको|शाळेत जायचे नाही|रडत आहे|खूप ताण|दडपण जास्त/.test(message) ||
    /படிக்க வேண்டாம்|ஸ்ட்ரெஸ் அதிகமா|பள்ளிக்கு போகவே வேண்டாம்|அழுகிறது|மிகவும் சோர்வு|படிப்பு பயமா இருக்கு|அதிக அழுத்தம்/.test(message) ||
    /చాలా ఒత్తిడి|చదువు వద్దు|స్కూల్ కి వెళ్ళాలని లేదు|ఏడుపు వస్తుంది|చాలా అలసిపోయాను|చదువంటే భయం|ఒత్తిడి చాలా ఎక్కువ/.test(message)
  ) {
    const lang = session.preferredLanguage;
    return {
      text: t('initial_burnout', lang) ?? `Please know that your concern is completely valid — and it takes courage to reach out about this.\n\n**The Observation:** What you're describing sounds like **Academic Burnout** — a state where the emotional and cognitive load of studying has exceeded your child's current coping capacity.\n\n**The Indian Context:** Burnout among Class 9–12 students in India has increased significantly. The combination of school, coaching classes, home study, and parental expectations creates a pressure system that many children struggle to sustain. This is a genuine mental health concern, not a sign of weakness or laziness.\n\n**The Pragati Advice (immediate steps):**\n1. Acknowledge the pressure openly — tell your child it's okay to feel overwhelmed\n2. Create **one screen-free, study-free hour** per evening — complete rest, not more tuition\n3. Separate self-worth from marks in daily conversations\n\nFor a deeper understanding of what's causing the burnout and what interventions are most appropriate, the LBI™ assessment maps **Stress & Emotional Regulation, Motivation, and Coping Capacity** — giving you a specific, actionable picture.\n\nWould you like to start, or would a conversation with one of our child psychologist mentors be more useful first?`,
      actions: tActions('initial_burnout_actions', lang) ?? ['Book a child psychologist session', 'Start LBI to map stress patterns', 'ExamReadiness with burnout check', 'What is academic burnout?'],
      sensitive: true,
    };
  }

  // ── K-12 Schools solution ──────────────────────────────────────────────────
  if (/\b(k.?12|cbse|icse|nep.?2020)\b/i.test(message) ||
      (/\b(school(s)?)\b/i.test(message) && /\b(metryxone|lbi|solution|platform|what does|how does|feature|for schools)\b/i.test(message)) ||
      /\b(school mein|school ke liye|school wala|vidyalay|vidyalaya|shala|shale|cbse wala|icse wala|state board wala|board wala|sarkaari school|sarkari school|government school|convent school|english medium school|hindi medium school)\b/i.test(message) ||
      /स्कूल|विद्यालय|शाला|बोर्ड.*परीक्षा|सरकारी स्कूल|इंग्लिश मीडियम/.test(message) ||
      /பள்ளி|பள்ளிக்கூடம்|வாரியம்.*தேர்வு|அரசு பள்ளி|ஆங்கில வழிப்பள்ளி/.test(message) ||
      /పాఠశాల|స్కూల్.*కోసం|బోర్డు.*పరీక్ష|ప్రభుత్వ పాఠశాల/.test(message) ||
      /शाळा|विद्यालय.*साठी|बोर्ड.*परीक्षा|सरकारी शाळा|इंग्रजी माध्यम/.test(message)) {
    const lang = session.preferredLanguage;
    return {
      text: t('initial_school_k12', lang) ?? `MetryxOne's **K-12 school solution** is built for ages 6–18, age-adaptive across three bands.\n\n**What schools get:**\n• Full LBI™ assessment engine — 19 domains, 97 subdomains\n• Cohort-level behavioural dashboards — class, year group, whole school\n• Longitudinal tracking across semesters and years with trend analysis\n• ExamReadiness Index™ before every major exam\n• Wellbeing dashboard with real-time mental health indicators\n• Parent engagement tools — automated, personalised reports and home-support tips\n• Early warning system for at-risk students\n• NEP 2020 aligned, DPDP Act compliant\n\n**Outcomes reported:**\n• 34% improvement in student wellbeing scores\n• 28% reduction in exam-related anxiety\n• 41% increase in parent engagement rates\n• 3.2x faster early intervention identification\n\n500+ schools are already on board.\n\nWant to book a 20-minute demo to see the actual dashboards and sample reports?`,
      actions: tActions('initial_school_k12_actions', lang) ?? ['Book a school demo', 'See sample school reports', 'School pricing', 'NEP 2020 compliance'],
    };
  }

  // ── Enterprise hiring ──────────────────────────────────────────────────────
  if ((/\b(enterprise|corporate)\b/i.test(message) && /\b(hiring|talent|assessment|platform)\b/i.test(message)) ||
      (/\b(hiring|talent|recruitment)\b/i.test(message) && /\b(behavioral|behavioural|metryxone)\b/i.test(message))) {
    return {
      text: `MetryxOne's **enterprise talent assessment** replaces gut-feel hiring with behavioural science.\n\n**What it offers:**\n• Behavioural profiling across 19 domains and 97 competency signals per candidate\n• Culture fit scoring — scientific alignment to org values and team dynamics\n• Cognitive potential mapping — analytical thinking, learning agility, adaptability\n• 50+ pre-built role assessment templates\n• ATS / HRMS integration for automated workflows\n• Bulk candidate processing — 500+ candidates in parallel\n\n**Impact from current enterprise clients:**\n• 34% reduction in mis-hires\n• 2.5x faster hiring decisions\n• 89% hiring manager satisfaction\n• 60% lower Year 1 attrition\n\nUsed for graduate hiring, lateral hiring, and executive leadership assessment.\n\nWant to book a demo or start a pilot?`,
      actions: ['Book an enterprise demo', 'Graduate hiring use case', 'Lateral & leadership hiring', 'See sample reports'],
    };
  }

  // ── Campus recruitment ─────────────────────────────────────────────────────
  if (/\b(campus|placement (drive|season)|university (hiring|recruitment))\b/i.test(message) ||
      (/\b(campus)\b/i.test(message) && /\b(hiring|recruit|placement|drive)\b/i.test(message))) {
    return {
      text: `MetryxOne's **campus recruitment solution** is built for scale.\n\n**What it enables:**\n• Assess 800+ students in a single campus drive\n• Pre-placement behavioural profiling across 19 domains and 97 subdomains\n• AI-powered candidate ranking — by competency match, culture-fit score, and role-specific potential\n• Multi-university management from a single dashboard — compare cohorts across institutions\n• Automated scheduling, proctoring, and real-time tracking\n\n**Impact:**\n• 28% lower first-year attrition\n• 3x faster candidate shortlisting\n• 50+ partner universities\n\nUsed by companies including Infosys and Wipro for large-scale campus drives.\n\nWant to see how it works in practice?`,
      actions: ['Book a campus recruitment demo', 'Engineering college drive', 'Business school drive', 'Multi-campus setup'],
    };
  }

  // ── What does the LBI report show ─────────────────────────────────────────
  if (/\b(what|what.?s)\b.{0,20}\b(report|results?|output|show|tell|gives?)\b.{0,20}\b(lbi|behavioural|assessment)\b/i.test(message) ||
      /\b(lbi|assessment)\b.{0,20}\b(report|results?|output|show|what)\b/i.test(message) ||
      /\bsample report\b/i.test(message)) {
    return {
      text: `The LBI™ report gives you a complete behavioural picture — not just scores, but *what to do with them*.\n\n**What you get:**\n• **19 domain scores** with subdomain breakdowns — colour-coded by strength, developing, and needs-attention zones\n• **Root cause analysis** — cross-domain correlation that identifies *why* patterns exist, not just what they are\n• **Trend analysis** — how patterns have shifted over time (on repeat assessments)\n• **Personalised action plans** — specific strategies tailored to the individual's profile, not generic advice\n• **Age-appropriate interpretation** — language and recommendations calibrated for the student's stage\n\nFor **schools**: cohort dashboards show class-wide distributions, at-risk clusters, and intervention priority.\n\nFor **HR and enterprise**: competency match scores, role-fit indices, and AI-generated hiring recommendations.\n\nReports are available immediately after completion. Would you like to start or see a sample?`,
      actions: ['Start LBI free now', 'LBI for my school', 'LBI for enterprise hiring', 'See pricing'],
    };
  }

  // ── Coaching institutes (JEE/NEET academies) ───────────────────────────────
  if (/\b(coaching institute|coaching center|academy|allen|resonance|aakash|fiitjee|bansal)\b/i.test(message) ||
      /\b(coaching mein|coaching ke liye|coaching wala|coaching class(es)?|coaching centre|padhai kendra|tuition centre|tuition center|tuition class(es)?|shiksha kendra|shikhshan kendra)\b/i.test(message) ||
      /कोचिंग|पढ़ाई केंद्र|शिक्षण संस्था|ट्यूशन/.test(message) ||
      /பயிற்சி நிலையம்|கோச்சிங்|பயிற்சி மையம்|ட்யூஷன்/.test(message) ||
      /కోచింగ్ సెంటర్|కోచింగ్ తరగతి|శిక్షణ కేంద్రం|ట్యూషన్/.test(message) ||
      /शिकवणी|कोचिंग क्लास|कोचिंग केंद्र/.test(message)) {
    const lang = session.preferredLanguage;
    return {
      text: t('initial_coaching_institute', lang) ?? `MetryxOne is purpose-built for **competitive exam coaching institutes** — JEE, NEET, UPSC, and others.\n\n**For your institute:**\n• Exam Psychological Readiness assessments across entire batches\n• Batch-level analytics — identify at-risk students before results are affected\n• Individual readiness scores, stress patterns, and confidence metrics per student\n• Performance Prediction Engine — AI-powered outcome forecasting based on behavioural patterns\n• Parent communication tools — automated updates with personalised recommendations\n\n**Outcomes from coaching institutes using MetryxOne:**\n• 22% improvement in student confidence scores within one semester\n• Identification of burnout-risk students — intervened before scores dropped\n• Better pre-exam batch calibration\n\nInstitutes like Resonance JEE Academy and Allen Career use MetryxOne.\n\nWant to book a demo to see how it works for your batch setup?`,
      actions: tActions('initial_coaching_institute_actions', lang) ?? ['Book a coaching institute demo', 'JEE batch analytics', 'NEET stress mapping', 'Institute pricing'],
    };
  }

  // ── Report / analytics general ─────────────────────────────────────────────
  if (/\bsample (lbi|report|assessment)\b/i.test(message) ||
      /\b(see|view|show me) (a|the|sample|an? example) (report|lbi|assessment)\b/i.test(message)) {
    return {
      text: `A sample LBI™ report covers:\n\n**Individual view:** Domain scores (0–100) across all 19 areas. Subdomains highlighted in green (strength), amber (developing), or red (needs attention). Root-cause cross-domain analysis. Personalised action recommendations.\n\n**Cohort view (schools):** Heatmaps showing class-wide distributions per domain. At-risk student clusters. Intervention priority ranking.\n\n**Enterprise view:** Competency match scores against role benchmarks. Culture-fit index. AI hiring recommendation.\n\nTo request an actual sample report or see a live demo: use the "Request a Demo" option and our team will share relevant samples for your context — school, individual, or enterprise.\n\nAlternatively, you can start the free assessment now and get your own report instantly.`,
      actions: ['Start free — get my own report', 'Request a demo with sample reports', 'School sample reports', 'Enterprise sample reports'],
    };
  }

  // ── Scientific validation / accuracy ──────────────────────────────────────
  if (/\b(scientif(ic|ically)|valid(at|ity|ated)|accurate|accurate|research.?backed|evidence.?based|psychologist|proven|reliable|credible)\b/i.test(message)) {
    return {
      text: `The LBI™ framework was developed over two years by a team of educational psychologists and AI researchers.\n\n**Scientific foundation:**\n• Grounded in educational psychology research — cognitive load theory, self-determination theory, metacognitive learning frameworks\n• Validated against 50,000+ student assessments across diverse school contexts in India\n• 19 domains and 97 subdomains are research-backed, not arbitrarily chosen\n• Age-band calibration ensures developmental appropriateness (Band A: 6–10, B: 11–14, C: 15–18)\n\n**Real-world outcomes:**\n• 34% improvement in student wellbeing scores\n• 28% reduction in exam-related anxiety\n• 34% reduction in mis-hires (enterprise)\n• Used by 500+ schools and major organisations\n\nThe system identifies root causes — not just surface patterns. Cross-domain correlation analysis finds *why* a student performs a certain way, not just *what* their scores are.`,
      actions: ['Start the LBI™ assessment', 'Read research papers', 'Book a demo', 'See LBI pricing'],
    };
  }

  // ── Languages supported ────────────────────────────────────────────────────
  if (/\b(language(s)?|hindi|tamil|telugu|kannada|marathi|bengali|gujarati|multilingual|vernacular|regional)\b/i.test(message)) {
    return {
      text: `MetryxOne supports **10+ Indian languages** — the platform and assessments are available in:\n\nHindi, Tamil, Telugu, Kannada, Marathi, Bengali, Gujarati, Malayalam, Odia, Punjabi, and English.\n\nThis makes the LBI™ assessment more accurate — students respond more authentically in their native language, which improves the quality of behavioural insights.\n\nFor schools in regional-medium settings: the admin and parent communication tools also support the same languages.`,
      actions: ['Start assessment (choose language)', 'Schools in Hindi medium', 'Regional language support for parents', 'Book a demo'],
    };
  }

  // ── Can I pause / resume / save progress ──────────────────────────────────
  if (/\b(pause|resume|save|interrupt|break|come back|stop midway)\b.{0,20}\b(assessment|lbi|test|exam)\b/i.test(message) ||
      /\b(assessment|lbi)\b.{0,20}\b(pause|resume|save|interrupt|stop)\b/i.test(message)) {
    return {
      text: `Yes — progress is **automatically saved** throughout the LBI™ assessment.\n\nIf your child needs a break, they can stop at any point and resume from exactly where they left off. There's no need to restart. The system even adapts question flow dynamically based on what's already been answered.\n\nFor the **ExamReadiness Index™** and **Micro Check**, the sessions are shorter (20–25 min) so most students complete them in one sitting.`,
      actions: ['Start LBI free now', 'How long does it take?', 'Do the Micro Check first', 'See pricing'],
    };
  }

  // ── Difference between LBI and standard tests ─────────────────────────────
  if (/\b(different|difference|vs|versus|compared? to|unlike|not like)\b.{0,30}\b(iq|academic test|marks|grade|aptitude|standard test)\b/i.test(message) ||
      /\b(iq|aptitude|standard test|academic test)\b.{0,30}\b(different|difference|vs|compare|unlike)\b/i.test(message)) {
    return {
      text: `This is an important distinction.\n\n**Standard academic tests** (marks, grades, IQ, aptitude) measure *what* a student knows or *how much* they know — they're output measures.\n\n**The LBI™** measures *how* a student thinks, learns, and performs — the underlying patterns that produce those outputs:\n• Why they freeze under exam pressure (not just that they do)\n• Why they study hard but nothing sticks\n• Why their attitude changes around specific subjects or situations\n• What's holding back potential that effort alone can't unlock\n\nLBI answers **"why"** — academic tests only show **"what."**\n\nThis means LBI gives you something to *act on*, not just another score to worry about.`,
      actions: ['Start LBI free now', 'What does the report show?', 'LBI vs ExamReadiness', 'For schools'],
    };
  }

  // ── Wellbeing / mental health / stress ────────────────────────────────────
  if (/\b(wellbeing|well.?being|mental health|stress|anxiety|burnout|overwhelm|emotional)\b.{0,20}\b(dashboard|report|track|monitor|identify|detect)\b/i.test(message)) {
    return {
      text: `MetryxOne has a **Wellbeing Dashboard** built into the school platform — real-time cohort and individual views of mental health indicators, social-emotional functioning, and adjustment patterns.\n\nThe **LBI™ Domain 3 — Exam Stress & Emotional Regulation** covers 9 subdomains including:\n• Stress reactivity and anticipatory anxiety\n• Emotional regulation during high-pressure situations\n• Cognitive control under stress\n• Recovery speed after setbacks\n• Strategy flexibility when things don't go to plan\n\nFor coaching institutes, the **Stress Mapping** feature identifies students at burnout risk before it affects their results.\n\nAt-risk student clusters are surfaced automatically on the dashboard, 3.2x faster than traditional identification methods.`,
      actions: ['Wellbeing dashboard for schools', 'Stress management domain details', 'Early intervention identification', 'Book a school demo'],
      sensitive: true,
    };
  }

  return null;
}

// ─── Counsellor Response Engine ───────────────────────────────────────────────
// The bot asks questions to diagnose, then recommends the right product.
// Stage: open → probing → recommending

interface BotResponse { text: string; actions: string[]; sensitive?: boolean; }

function counsellorResponse(session: Session, message: string, intent: IntentType, topics: string[]): BotResponse {

  // ── Safety-critical — always answer immediately ───────────────────────────
  if (/\bcpr\b/i.test(message) || /\bfirst.?aid\b/i.test(message) || /\bcardiac\b/i.test(message) || /\bresuscitation\b/i.test(message)) {
    return {
      text: `**If unresponsive and not breathing:** Call 112 → 30 chest compressions (hard, fast, centre of chest) → 2 rescue breaths. Repeat until help arrives. Hands-only CPR works if unsure about rescue breaths.\n\n⚠️ This is guidance — not a substitute for certified training.`,
      actions: ['CPR for children', 'Choking response', 'First Aid modules on MetryxOne'],
    };
  }
  if (/\bchoking\b/i.test(message)) {
    return {
      text: `**Adult/child over 1yr:** 5 firm back blows → 5 abdominal thrusts (Heimlich). Alternate until clear. If unconscious — start CPR and call 112.\n**Infant under 1yr:** 5 back blows + 5 chest thrusts (not abdominal).`,
      actions: ['Tell me about CPR', 'First Aid modules on MetryxOne'],
    };
  }
  if (/glucose|blood sugar|diabetes/i.test(message)) {
    return {
      text: `Post-meal (2 hrs): under 140 mg/dL is normal, 140–199 worth watching, 200+ see a doctor. Quick fix: walk 10–15 min after meals, eat protein before carbs, avoid sugary drinks.`,
      actions: ['Foods that help blood sugar', 'Nutrition and academic performance'],
    };
  }

  // ── KB Lookup — factual product / platform questions ─────────────────────
  // Fires on informational queries before the diagnostic stage logic takes over
  const kbResult = kbLookup(message, session);
  if (kbResult) return kbResult;

  // ── Thanks ────────────────────────────────────────────────────────────────
  if (intent === 'thanks') {
    const role = session.userType;
    const lang = session.preferredLanguage;
    const thankActions = role === 'student'
      ? (tActions('thanks_actions_student', lang) ?? ['Start LBI free now', 'Check exam readiness', 'Book a mentor session'])
      : role === 'hr' || role === 'corporate'
        ? ['Book an enterprise demo', 'See sample reports', 'Start a pilot']
        : role === 'institution'
          ? ['Book a school demo', 'See cohort dashboards', 'School pricing']
          : (tActions('thanks_actions_parent', lang) ?? ["Start my child's LBI free", 'Check exam readiness', 'Book a demo']);
    return {
      text: t('thanks', lang) ?? `Of course. Is there anything else on your mind that would help figure out the right next step?`,
      actions: thankActions,
    };
  }

  // ── Demo ──────────────────────────────────────────────────────────────────
  if (/\b(demo|book a (call|meeting|session|demo)|schedule a (call|demo|meeting))\b/i.test(message)) {
    const role = session.userType;
    if (role === 'institution' || /\b(school|college|university|institute)\b/i.test(message)) {
      return {
        text: `A school demo is 20–30 minutes and gives you a complete walkthrough of the platform — live, with a real person.\n\n**What we cover:**\n• Live LBI™ report for a sample student\n• Cohort dashboards — what the school-wide view looks like\n• ExamReadiness Index™ and how it works before exam season\n• Rollout process, timeline, and admin setup\n• Pricing specific to your school size\n• NEP 2020 and DPDP compliance walkthrough\n\nTo book: use the "Request a Demo" button on the homepage, or just let me know your school name and size and I can route you to the right person.`,
        actions: ['Book a school demo now', 'Tell me about school pricing', 'What does the cohort dashboard look like?', 'NEP 2020 compliance'],
      };
    }
    if (role === 'hr' || role === 'corporate') {
      return {
        text: `An enterprise demo is 20–30 minutes — a live walkthrough of the behavioural profiling and talent assessment platform.\n\n**What we cover:**\n• Candidate behavioural assessment flow end-to-end\n• Sample reports — individual and cohort\n• Culture-fit scoring and role-fit indices\n• ATS / HRMS integration options\n• Competency Intelligence Platform (CIP) — 50 competencies, 7 industry benchmarks\n• Volume pricing based on your hiring scale\n\nTo book: use "Request a Demo" on the homepage. Want me to point you to the enterprise contact?`,
        actions: ['Book an enterprise demo', 'See sample candidate reports', 'ATS integration details', 'Enterprise pricing'],
      };
    }
    return {
      text: `A demo is probably the best 20 minutes you can spend before making a decision.\n\nIt's not a sales call. It's a live walkthrough — tailored to your actual context. You get to see the platform, real sample reports, and ask whatever's genuinely on your mind.\n\n**What's covered:** The features relevant to your specific use case. Sample LBI™ and ExamReadiness reports. How rollout and onboarding work. Pricing transparency.\n\n**Format:** 20–30 minutes, live, with a real person.\n\nIs this for a school, a company, or are you looking at it for your child or yourself?`,
      actions: ['Demo for my school', 'Demo for HR / hiring team', 'Demo for a coaching institute', 'Start LBI free instead'],
    };
  }

  // ── User already knows what they want — LBI ───────────────────────────────
  if (topics.includes('lbi') && session.stage !== 'recommending') {
    session.stage = 'recommending';
    session.concern = session.concern ?? 'learning';
    const role = session.userType;
    if (role === 'student') {
      return {
        text: `The LBI™ maps how *you* actually learn — your focus patterns, retention style, how you handle pressure and process information. 19 behavioural domains, 25 minutes, instant report.\n\nIt tells you exactly what to adjust — not "study harder," but *how* to study in a way that actually works for your brain. Free to start, no card needed. Ready?`,
        actions: ['Start LBI free now', 'What does the report show?', 'How does it help with exams?', 'See pricing'],
      };
    }
    if (role === 'career') {
      return {
        text: `The LBI™ maps your natural cognitive and behavioural strengths — the way you actually think, communicate and perform under pressure. That's the real foundation for finding roles where you'll thrive, not just cope.\n\n25 minutes, instant report. Free to start. Ready?`,
        actions: ['Start LBI free now', 'See a sample report', 'How does it help with career planning?', 'See pricing'],
      };
    }
    if (role === 'teacher') {
      return {
        text: `The LBI™ generates an individual behavioural learning profile for each student — how they focus, retain, respond under pressure and communicate. 25 minutes per student, instant report.\n\nIt tells you *who needs what kind of support*, not just who's struggling. Want to run a classroom pilot?`,
        actions: ['Start a classroom pilot', 'See a sample student report', 'How many students can I assess?', 'Book a school demo'],
      };
    }
    if (role === 'hr' || role === 'corporate') {
      return {
        text: `The LBI™ gives you a behavioural profile for any candidate or team member — 19 domains covering how they communicate, handle pressure, collaborate and lead. It predicts role fit and performance, not just personality type.\n\nFree to pilot. Want to see a sample report or start a team assessment?`,
        actions: ['Run a team pilot', 'See a sample report', 'Candidate assessment flow', 'Book an HR demo'],
      };
    }
    if (role === 'institution') {
      return {
        text: `The LBI™ delivers cohort-level behavioural data across 19 domains — by class, year group or whole school. It immediately surfaces at-risk clusters, learning style distributions and where targeted interventions will have the most impact.\n\nWant to book a walkthrough or see a sample report?`,
        actions: ['Book institutional demo', 'See sample cohort report', 'Deployment timeline', 'Pricing for schools'],
      };
    }
    if (role === 'coach') {
      return {
        text: `The LBI™ gives you a deep behavioural map of each client — 19 domains covering how they think, retain, process stress and communicate. It tells you exactly where to focus the work and gives you a shared language for the change you're trying to create.\n\nWant to see a sample client report?`,
        actions: ['See a sample client report', 'How to share reports with clients', 'Pricing for coaches', 'Book a demo'],
      };
    }
    // Parent or unknown — parent-focused default
    return {
      text: `*Why isn't my child reaching their potential?* — that's what the LBI™ answers. It maps 19 behavioural domains in 25 minutes: how your child focuses, retains, processes pressure, communicates.\n\nThe report tells you *what* to change and *how* — not just "study more." Free to start, instant report. Ready?`,
      actions: ["Start my child's LBI free", 'See a sample LBI report', 'What does the report show?', 'Check exam readiness too'],
    };
  }

  // ── Mentor / tutor request — respond directly ────────────────────────────
  if (topics.includes('mentor') && session.stage !== 'recommending') {
    session.stage = 'probing';
    session.concern = 'mentor' as any;
    const role = session.userType;
    if (role === 'parent' || topics.includes('parent')) {
      return {
        text: `Mentor support for your child — great move.\n\nWe match children with mentors based on their LBI™ behavioural profile, so the fit isn't just about the subject — it's about how your child actually learns, communicates, and what kind of support works best for them.\n\nTo point you to the right mentor: what's the main thing you'd like the mentor to work on with your child?`,
        actions: ['Academic performance & study skills', 'A specific exam coming up', 'Career direction & subject choices', 'Confidence & motivation'],
      };
    }
    if (role === 'student') {
      return {
        text: `Mentor matching is a smart next step. Our mentors are matched to your LBI™ profile — not randomly — so the fit is based on how you actually learn and what kind of support clicks for you.\n\nWhat would you most want the mentor to help you with?`,
        actions: ['Studying smarter', 'Exam preparation', 'Career direction', 'Confidence & focus'],
      };
    }
    if (role === 'teacher' || role === 'institution') {
      return {
        text: `Mentor matching works well as a targeted intervention for students who need more than classroom support. Our mentors are matched to each student's LBI™ behavioural profile.\n\nIs this for specific at-risk students, or are you looking to offer mentor access more broadly across your school?`,
        actions: ['Specific at-risk students', 'Broader access for all students', 'Book a school demo', 'See mentor pricing'],
      };
    }
    return {
      text: `Our mentor matching uses LBI™ behavioural profiles to find the right fit — not just by subject, but by learning style, communication style, and what kind of mentoring actually works for the individual.\n\nWhat's the context — is this for a child, a student, or someone in a professional setting?`,
      actions: ['For my child', 'For me as a student', 'For an employee or team member', 'Tell me more about mentor matching'],
    };
  }

  // ── User already knows what they want — ExamReadiness ────────────────────
  if (topics.includes('exam_ready') && session.stage !== 'recommending') {
    session.stage = 'recommending';
    session.concern = 'exam';
    return {
      text: `The ExamReadiness Index™ gives a 0–100 readiness score per subject and a specific 4-week plan — based on where your child actually is, not a generic checklist. About 20 minutes, and the results are immediate. Would it make sense to start that now?`,
      actions: ['Start ExamReadiness free', 'Do the LBI first', 'What subjects does it cover?', 'Book a demo'],
    };
  }

  // ── Transactional — user wants to sign up / get started ──────────────────
  if (intent === 'transactional' && /\b(start|sign up|register|get started|create account|enroll)\b/i.test(message)) {
    // Already recommended — give a concrete "here's how" response instead of looping back
    if (session.stage === 'recommending') {
      return {
        text: `Click the **"Free Assessment"** button in the navigation above — it opens right here on the page. Under 2 minutes to create your account, 25 minutes for the assessment, and your report is ready the moment you finish. No payment needed at any point.`,
        actions: ['What does the report show?', 'How does the assessment work?', 'See pricing', 'Book a demo instead'],
      };
    }
    return {
      text: `Sign up free → choose your role → start the LBI. Creating an account takes under 2 minutes. The assessment itself is 25 minutes and the report is ready instantly. No card needed to begin.`,
      actions: ['What is the LBI?', 'How accurate is it?', 'Check exam readiness', 'Book a demo instead'],
    };
  }

  // ─── ROLE-AWARE OPENING — first response after role selection ─────────────
  // Always ask a warm, open question — no assumptions about the problem yet

  if (session.stage === 'open') {

    // Greeting without a role — ask who they are
    if (intent === 'greeting' && !session.userType) {
      session.stage = 'probing';
      const lang = session.preferredLanguage;
      return {
        text: t('greeting_no_role', lang) ?? `Good to have you here. Who are you — a parent, student, teacher, or someone from a school or organisation?`,
        actions: tActions('greeting_no_role_actions', lang) ?? ['A parent', 'A student', 'A teacher', 'From a school or organisation'],
      };
    }

    // Emotional signal — check before concern detection and role-specific openings
    // so a user's first message expressing distress is acknowledged warmly
    if (intent === 'emotional') {
      session.emotionalState = 'stressed';
      session.stage = 'probing';
      const role = session.userType as string | null;
      const lang = session.preferredLanguage;
      if (role === 'student') {
        return {
          text: t('emotional_student', lang) ?? `That makes complete sense — and you're not alone in feeling that way. A lot of students feel the pressure but can't always name what's making things harder than they should be. What's the biggest thing on your mind right now — the way you study, your exam results, or what you want to do after school?`,
          actions: tActions('emotional_student_actions', lang) ?? ['How I study', 'My exam results', 'What I want to do after school', 'My focus and motivation'],
        };
      }
      if (role === 'career') {
        return {
          text: t('emotional_career', lang) ?? `That's completely understandable — figuring out where you fit and what you're actually good at is genuinely hard. What's the main thing weighing on you — not knowing your strengths, not knowing which direction to go, or feeling lost in the hiring process?`,
          actions: tActions('emotional_career_actions', lang) ?? ['Not knowing my strengths', 'Which direction to go', 'Feeling lost in hiring', 'All of it honestly'],
        };
      }
      if (role === 'hr' || role === 'corporate') {
        return {
          text: t('emotional_hr_corporate', lang) ?? `Understood — hiring and team decisions carry real weight, and the cost of getting them wrong is significant. What's the core challenge right now — finding candidates who actually fit, keeping good people once you have them, or understanding team dynamics?`,
          actions: tActions('emotional_hr_corporate_actions', lang) ?? ['Candidate fit', 'Retention', 'Team dynamics', 'All of the above'],
        };
      }
      return {
        text: t('emotional_general', lang) ?? `That's completely understandable — a lot of people feel exactly that. What's the main thing on your mind right now?`,
        actions: tActions('emotional_general_actions', lang) ?? ['Learning & focus', 'Exams coming up', 'Confidence & direction', 'All of it honestly'],
      };
    }

    // If the very first message already contains a clear concern, skip generic opening
    // and go straight to the first diagnostic question — more responsive to what user said
    if (session.userType && session.userType !== 'guest') {
      const firstConcern = detectConcern(message, topics);
      if (firstConcern && intent !== 'greeting') {
        session.concern = firstConcern;
        session.stage = 'probing';
        session.openProbingDone = true;
        return openProbingQuestion(session);
      }
    }

    // Parent
    if (session.userType === 'parent' || topics.includes('parent')) {
      session.userType = 'parent';
      session.stage = 'probing';
      const lang = session.preferredLanguage;
      return {
        text: t('parent_opening', lang) ?? `Namaste. Thank you for reaching out — it takes care and effort to seek help for your child.\n\nWhat's the challenge you're facing? Feel free to share in your own words — whether it's about marks, focus, board exam stress, tuition dependency, career confusion, or anything else on your mind.`,
        actions: tActions('parent_opening_actions', lang) ?? ['Marks have dropped', 'Board exam stress (10th/12th)', 'Too much time on phone/YouTube', 'Confused about stream or career'],
      };
    }

    // Student
    if (session.userType === 'student') {
      session.stage = 'probing';
      const lang = session.preferredLanguage;
      return {
        text: t('student_opening', lang) ?? `Good to have you here. Most students come in with one of a few things on their mind — exams not going the way they want, studying hard but nothing seems to stick, no real idea what to do after school, or knowing exactly what they should do but just not being able to make themselves do it. Which of these feels closest to where you are right now?`,
        actions: tActions('student_opening_actions', lang) ?? [
          "How I'm doing in school or exams",
          "The way I actually learn and study",
          "What I want to do with my life",
          "My motivation, focus and drive",
        ],
      };
    }

    // Teacher
    if (session.userType === 'teacher') {
      session.stage = 'probing';
      return {
        text: `Welcome. What would be most useful for you right now — getting to know your students better individually, or getting a sense of where the whole class stands?`,
        actions: ['Individual student insights', 'Class-wide patterns', 'At-risk students', 'Book a school demo'],
      };
    }

    // HR
    if (session.userType === 'hr') {
      session.stage = 'probing';
      return {
        text: `Good to have you here. What's the hiring challenge you're dealing with at the moment?`,
        actions: ['Assessing culture fit', 'Predicting role performance', 'Reducing early attrition', 'Benchmarking candidates'],
      };
    }

    // Institution / school leader
    if (session.userType === 'institution') {
      session.stage = 'probing';
      return {
        text: `Welcome. What would you like to understand better about your students across the school?`,
        actions: ['At-risk student identification', 'Cohort-wide trends', 'Individual profiles', 'Deployment & scale'],
      };
    }

    // Career / job seeker
    if (session.userType === 'job_seeker' || session.userType === 'career') {
      session.userType = 'career';
      session.stage = 'probing';
      return {
        text: `Good to have you here. What are you trying to figure out — what you're naturally good at, what career paths genuinely suit you, or how to position yourself when going after the right role?`,
        actions: ['Understanding my strengths', 'Finding the right career path', 'How to stand out in hiring', 'All of the above'],
      };
    }

    // Corporate / enterprise
    if (session.userType === 'corporate') {
      session.stage = 'probing';
      return {
        text: `Good to have you here. What's the team or organisational challenge you're working on right now — is it around hiring and role fit, understanding how your existing team works together, or building leadership and performance capacity?`,
        actions: ['Hiring & role fit', 'Team dynamics & collaboration', 'Leadership development', 'Performance & retention'],
      };
    }

    // Coach / counsellor
    if (session.userType === 'coach') {
      session.stage = 'probing';
      return {
        text: `Good to have you here. What would be most useful — getting behavioural insight on specific clients to deepen your work with them, or building LBI data into how you run your practice more broadly?`,
        actions: ['Insights on specific clients', 'Building it into my practice', 'See a sample client report', 'Pricing for coaches'],
      };
    }

    // Generic first message — try to detect concern and ask open question
    const concern = detectConcern(message, topics);
    if (concern) {
      session.concern = concern;
      session.stage = 'probing';
      session.openProbingDone = true;
      return openProbingQuestion(session);
    }

    // No role, no concern yet — invite them to share more
    session.stage = 'probing';
    const lang = session.preferredLanguage;
    return {
      text: t('no_role_concern', lang) ?? `I want to make sure I point you in the right direction. Who is this for — your child, yourself, your school, or your team?`,
      actions: tActions('no_role_concern_actions', lang) ?? ['My child', 'Myself', 'My school or institution', 'My hiring team'],
    };
  }

  // ─── PROBING — narrow down with one broad question ────────────────────────
  if (session.stage === 'probing') {
    const newConcern = detectConcern(message, topics);
    if (newConcern && !session.concern) session.concern = newConcern;
    if (detectExamUrgency(message)) session.examUrgency = true;

    // Update user type if we pick it up now
    if (!session.userType) {
      if (/\b(my child|my son|my daughter|my kid|parent)\b/i.test(message)) session.userType = 'parent';
      else if (/\b(i.m a student|i study|my exam)\b/i.test(message)) session.userType = 'student';
    }

    // Grade/class context — pick up and acknowledge even if concern wasn't detected above
    if (!session.concern) {
      const gradeMatch = message.match(/\b(class|grade|std|standard|year)\s*(\d+|ten|eleven|twelve|six|seven|eight|nine|xi{0,2}|x(?!i)|ix|vi{0,2})\b/i);
      if (gradeMatch) {
        const g = gradeMatch[2].toLowerCase();
        const isBoards = /^(10|12|ten|twelve|xii?$|x$)/.test(g);
        session.concern = isBoards ? 'exam' : 'learning';
        const role = session.userType;
        const gradeLabel = gradeMatch[0];
        if (isBoards) {
          return {
            text: `${gradeLabel} — boards aren't far off. Is the concern mainly about specific subjects where ${role === 'student' ? 'you\'re' : 'they\'re'} not where ${role === 'student' ? 'you need' : 'they need'} to be, or more about the overall pressure and confidence going into it?`,
            actions: ['Specific subjects', 'Overall confidence & pressure', 'Time management', 'All of the above'],
          };
        } else {
          return {
            text: `Got it — ${gradeLabel}. Is the challenge more about finding it hard to focus and stay on task, or more that ${role === 'student' ? 'you study' : 'they study'} but things don't seem to stick?`,
            actions: ['Focus & attention', 'Retention & memory', 'Motivation to study', 'All three'],
          };
        }
      }
    }

    if (session.concern) {
      // If we haven't asked the first open diagnostic question yet, ask it now
      if (!session.openProbingDone) {
        session.openProbingDone = true;
        return openProbingQuestion(session);
      }
      // First question already asked — move to the narrowing question
      return narrowingQuestion(session);
    }

    // Still no clear concern — ask a more specific second question (different from the first)
    const role = session.userType;
    const lang2 = session.preferredLanguage;
    if (role === 'parent') {
      return {
        text: t('probing_no_concern_parent', lang2) ?? `To point you in the right direction — is there an exam or assessment coming up that's the main pressure, or is it more about how they learn and study day to day?`,
        actions: tActions('probing_no_concern_parent_actions', lang2) ?? ['Exam coming up', 'Day-to-day learning habits', 'Motivation & attitude', 'Career choices'],
      };
    }
    if (role === 'student') {
      return {
        text: t('probing_no_concern_student', lang2) ?? `Let me be more specific — is there an exam you're preparing for, or is it more about how you study and focus generally?`,
        actions: tActions('probing_no_concern_student_actions', lang2) ?? ['Exam preparation', 'How I study', 'My focus & motivation', 'My future direction'],
      };
    }
    if (role === 'hr' || role === 'corporate') {
      return {
        text: `Is the core challenge finding people who fit well from the start, or more about understanding and developing the team you already have?`,
        actions: ['Finding better candidates', 'Understanding existing team', 'Reducing attrition', 'Leadership development'],
      };
    }
    if (role === 'institution') {
      return {
        text: `Is the priority identifying students who need support early, or getting a broader picture of how the whole cohort is doing?`,
        actions: ['At-risk student identification', 'Cohort-wide patterns', 'Individual profiles', 'Book a demo'],
      };
    }
    return {
      text: t('probing_no_concern_general', lang2) ?? `To point you in the right direction — is this about learning and focus, an upcoming exam, or something longer-term like career or confidence?`,
      actions: tActions('probing_no_concern_general_actions', lang2) ?? ['Learning & focus', 'Upcoming exam', 'Career & direction', 'Confidence & motivation'],
    };
  }

  // ─── NARROWING — second narrowing question (currently only for 'learning') ──
  if (session.stage === 'narrowing') {
    if (detectExamUrgency(message)) session.examUrgency = true;
    return secondNarrowingQuestion(session);
  }

  // ─── RECOMMENDING — give the recommendation ───────────────────────────────
  if (session.stage === 'recommending') {
    const newConcern = detectConcern(message, topics);
    // Allow 'exam' to upgrade 'learning' (class 10/12 mention is a stronger signal)
    if (newConcern && (!session.concern || (newConcern === 'exam' && session.concern === 'learning'))) {
      session.concern = newConcern;
    }
    if (detectExamUrgency(message)) session.examUrgency = true;
    return recommendationResponse(session, message);
  }

  // Role-aware fallback
  const role = session.userType;
  const fallbackLang = session.preferredLanguage;
  if (role === 'student') {
    return {
      text: t('fallback_student', fallbackLang) ?? `Tell me a bit more — what's the main thing you're finding difficult right now?`,
      actions: tActions('fallback_student_actions', fallbackLang) ?? ['My focus and attention', 'Remembering what I study', 'My motivation', 'My exam performance'],
    };
  }
  if (role === 'career') {
    return {
      text: t('fallback_career', fallbackLang) ?? `Tell me a bit more — what's the specific thing you're trying to work out?`,
      actions: tActions('fallback_career_actions', fallbackLang) ?? ['What I\'m good at', 'Which direction to take', 'How to get hired', 'Whether to change careers'],
    };
  }
  if (role === 'teacher') {
    return { text: `Tell me a bit more about what you're seeing in the classroom.`, actions: ['Students falling behind', 'Disengaged learners', 'Preparing for exams', 'At-risk students'] };
  }
  if (role === 'hr' || role === 'corporate') {
    return { text: `Tell me more about the team or hiring challenge you're working on.`, actions: ['Hiring the right people', 'Team performance', 'Reducing turnover', 'Leadership development'] };
  }
  if (role === 'institution') {
    return { text: `Tell me more about what you need across your school.`, actions: ['At-risk student identification', 'Cohort behavioural data', 'Individual student profiles', 'Book a demo'] };
  }
  if (role === 'coach') {
    return { text: `Tell me more about what you're trying to achieve with your clients.`, actions: ['Deeper client understanding', 'Building a structured framework', 'Sharing data with clients', 'Pricing & access'] };
  }
  return {
    text: t('fallback_general', fallbackLang) ?? `Tell me a bit more about the situation — what's going on?`,
    actions: ["Start my child's LBI free", 'Check exam readiness', 'Book a demo'],
  };
}

// ─── Open probing question (after concern detected on first message) ───────────
function openProbingQuestion(session: Session): BotResponse {
  const role = session.userType;
  const lang = session.preferredLanguage;
  const them = (role === 'student') ? 'you' : 'they';
  const their = (role === 'student') ? 'your' : 'their';
  const isStudent = role === 'student';
  switch (session.concern) {
    case 'exam':
      return {
        text: t(isStudent ? 'open_probing_exam_student' : 'open_probing_exam', lang) ??
          `Understood. Is the concern mainly about specific subjects where ${them}'re not where ${them} need to be — or more about how ${them}'re managing the overall pressure, confidence, and anxiety going into the exam?`,
        actions: tActions(isStudent ? 'open_probing_exam_student_actions' : 'open_probing_exam_actions', lang) ??
          ['Specific subjects (Maths, Science, English)', 'Overall confidence & exam anxiety', 'Time management & syllabus coverage', 'All of the above'],
      };
    case 'betterment':
      return {
        text: t('open_probing_betterment', lang) ??
          `I understand — this can be a stressful time. Before anything else, let's understand what happened. Was it mainly one or two subjects that pulled things down, or was it more about exam anxiety and the pressure of the day itself?`,
        actions: tActions('open_probing_betterment_actions', lang) ??
          ['Specific subjects were weak', 'Exam anxiety / panic on the day', 'Both — subjects and anxiety', 'Hard to say'],
      };
    case 'learning':
      return {
        text: t(isStudent ? 'open_probing_learning_student' : 'open_probing_learning', lang) ??
          `Got it. Is this more about finding it hard to focus and stay on task, or more that ${them} study and attend tuition but things still don't seem to stick?`,
        actions: tActions(isStudent ? 'open_probing_learning_student_actions' : 'open_probing_learning_actions', lang) ??
          ['Focus & attention', 'Retention despite studying', 'Tuition-dependent, weak basics', 'Motivation to study'],
      };
    case 'behaviour':
      return {
        text: t(isStudent ? 'open_probing_behaviour_student' : 'open_probing_behaviour', lang) ??
          `Understood. Is it more about motivation — ${them === 'you' ? 'you\'re' : 'they\'re'} just not engaging with studies — or is it more about how ${them} handle the stress and comparison pressure when things get difficult?`,
        actions: tActions(isStudent ? 'open_probing_behaviour_student_actions' : 'open_probing_behaviour_actions', lang) ??
          ['No motivation / lost interest', 'Stress & pressure (exam/topper/family)', 'Too much phone/screen time', 'Confidence & self-belief'],
      };
    case 'career':
      return {
        text: t('open_probing_career', lang) ??
          `Makes sense. Is the question more about choosing the right **stream** (Science/Commerce/Arts after Class 10), or more about what career or college path is genuinely the right fit going forward?`,
        actions: tActions('open_probing_career_actions', lang) ??
          ['Stream selection after Class 10', 'JEE/NEET vs other paths', 'Which career suits their strengths', 'All of the above'],
      };
    default:
      return {
        text: t('open_probing_default', lang) ??
          `What would be most useful to understand first — is it about marks and learning, an upcoming board or entrance exam, or something bigger like stream selection and career direction?`,
        actions: tActions('open_probing_default_actions', lang) ??
          ['Marks & learning', 'Board/entrance exam prep', 'Stream or career direction', 'Behaviour & motivation'],
      };
  }
}

// ─── Second narrowing question — only for learning (asks context after duration) ─
function secondNarrowingQuestion(session: Session): BotResponse {
  session.stage = 'recommending';
  const role = session.userType;
  const lang = session.preferredLanguage;
  const isStudent = role === 'student';
  const theyRe = isStudent ? "you're" : "they're";
  const their   = isStudent ? 'your' : 'their';
  return {
    text: t(isStudent ? 'second_narrowing_student' : 'second_narrowing', lang) ??
      `And does it tend to show up more when ${theyRe} at school — during lessons or group work — or more when ${theyRe} studying on ${their} own at home?`,
    actions: tActions(isStudent ? 'second_narrowing_student_actions' : 'second_narrowing_actions', lang) ??
      ['More at school', 'More when studying alone', 'Both equally', 'Hard to tell'],
  };
}

// ─── Narrowing question — second question before recommendation ────────────────
function narrowingQuestion(session: Session): BotResponse {
  const lang = session.preferredLanguage;
  switch (session.concern) {
    case 'exam':
      session.stage = 'recommending';
      return {
        text: t('narrowing_exam', lang) ??
          `And is this for a specific exam — Class 10/12 Boards, JEE, NEET, or another entrance — or is it more of an ongoing concern across school generally?`,
        actions: tActions('narrowing_exam_actions', lang) ??
          ['Class 10 Boards', 'Class 12 Boards', 'JEE / NEET / competitive entrance', 'Ongoing across school'],
      };
    case 'betterment':
      session.stage = 'recommending';
      return {
        text: t('narrowing_betterment', lang) ??
          `When is the Betterment or Compartment exam scheduled? And is there support at home — or is the child preparing largely on their own?`,
        actions: tActions('narrowing_betterment_actions', lang) ??
          ['Exam is in the next 1–2 months', 'Exam is later in the year', 'Preparing alone', 'Coaching / tuition support available'],
      };
    case 'learning':
      // Ask duration first; context/location comes as a second narrowing question
      session.stage = 'narrowing';
      return {
        text: t('narrowing_learning', lang) ??
          `Got it. Has this been a pattern for a while, or is it something that's come up more recently?`,
        actions: tActions('narrowing_learning_actions', lang) ??
          ['Been there for a while', 'Shifted in the last few months', 'It comes and goes', 'Hard to say'],
      };
    case 'behaviour':
      session.stage = 'recommending';
      return {
        text: t('narrowing_behaviour', lang) ??
          `Does it tend to come up around specific things — like particular subjects, time pressure, or certain situations — or is it more consistent across the board?`,
        actions: tActions('narrowing_behaviour_actions', lang) ??
          ['Specific subjects or situations', 'Pretty consistent', 'Mainly under pressure', 'Hard to say'],
      };
    case 'career':
      session.stage = 'recommending';
      return {
        text: t('narrowing_career', lang) ??
          `What stage are they at — still in school, at a crossroads finishing school, or post-school figuring out the next move?`,
        actions: tActions('narrowing_career_actions', lang) ??
          ['Still in school', 'Finishing school', 'Post-school or college', 'Already working, reconsidering'],
      };
    case 'mentor':
      session.stage = 'recommending';
      return {
        text: t('narrowing_mentor', lang) ??
          `Good. And is this something you'd like to get started on fairly soon, or are you exploring options at this stage?`,
        actions: tActions('narrowing_mentor_actions', lang) ??
          ['Ready to book soon', 'Just exploring for now', 'Depends on the mentor & pricing', 'Tell me more first'],
      };
    default:
      session.stage = 'recommending';
      return {
        text: t('narrowing_default', lang) ??
          `Is there a specific moment coming up — an exam, a decision, a transition — or is this more about ongoing patterns you'd like to understand better?`,
        actions: tActions('narrowing_default_actions', lang) ??
          ['Specific moment coming', 'Ongoing patterns', 'Both', 'Just exploring for now'],
      };
  }
}

// ─── Recommendation Response ──────────────────────────────────────────────────
function recommendationResponse(session: Session, _message: string): BotResponse {
  const role = session.userType;
  const lang = session.preferredLanguage;

  // ── Mentor recommendation ─────────────────────────────────────────────────
  if ((session.concern as string) === 'mentor') {
    if (role === 'parent' || !role || role === 'guest') {
      return {
        text: t('recommendation_mentor_parent', lang) ??
          `Here's how mentor matching works:\n\n1. Your child completes a short LBI™ assessment (25 min) — this maps how they actually learn, focus and communicate.\n2. We match them with a mentor based on that profile, not just subject or grade.\n3. Sessions are 1-on-1, online, and structured around the specific goals you've shared.\n\nThe first session is an introductory session — no commitment, just to make sure the fit is right. Would you like to book that now, or see the LBI™ report first?`,
        actions: tActions('recommendation_mentor_parent_actions', lang) ?? ['Book an introductory mentor session', 'Do the LBI™ first, then book', 'See mentor pricing', 'How are mentors vetted?'],
      };
    }
    if (role === 'student') {
      return {
        text: t('recommendation_mentor_student', lang) ??
          `Here's how it works:\n\n1. You complete a short LBI™ assessment (25 min) — it maps how you actually learn, focus and think.\n2. We match you with a mentor based on that profile, so the relationship actually clicks.\n3. Sessions are 1-on-1, structured around what *you* want to work on.\n\nFirst session is introductory — no commitment. Want to get started?`,
        actions: tActions('recommendation_mentor_student_actions', lang) ?? ['Book an introductory session', 'Do the LBI™ first', 'See pricing', 'How are mentors chosen?'],
      };
    }
    return {
      text: `Our mentor matching is profile-based — we use the LBI™ assessment to understand the learner's style before making the match. This makes the relationship significantly more effective from the first session.\n\nWant to book a demo to see how the matching process works in detail?`,
      actions: ['Book a mentor matching demo', 'See mentor pricing', 'Start with the LBI™', 'Tell me more'],
    };
  }

  // ── Betterment / Compartment exam recommendation ──────────────────────────
  if ((session.concern as string) === 'betterment') {
    return {
      text: t('recommendation_betterment', lang) ??
        `For a Betterment or Compartment exam, the **combination of LBI™ + ExamReadiness** is the most effective starting point.\n\n**Here's why:**\n\n• The **LBI™** (25 min) identifies the *root cause* — was it weak conceptual understanding, exam anxiety, poor time management, or a behavioural pattern? Without knowing the cause, additional tuition may not help.\n\n• The **ExamReadiness Index™** (20 min) then gives a subject-specific readiness score and a **4-week preparation plan** built around where your child actually is right now.\n\n**After that, we'd recommend:** One of our board-specialist mentors for targeted, 1-on-1 support in the specific subjects and skills that need attention.\n\nA Betterment exam is not a setback — it's a second chance with better preparation. Many students score significantly higher on their second attempt when they have the right support.\n\nWould you like to start the LBI first, or do both together?`,
      actions: tActions('recommendation_betterment_actions', lang) ??
        ['Start LBI to find root cause', 'Do LBI + ExamReadiness together', 'Book a board-prep mentor', 'How does the 4-week plan work?'],
    };
  }

  if (session.examUrgency || session.concern === 'exam') {
    if (role === 'student') {
      return {
        text: t('recommendation_exam_student', lang) ??
          `With exams close, ExamReadiness is the right move first. It gives you a 0–100 readiness score per subject and a specific 4-week plan built around *where you actually are* — not a generic checklist. 20 minutes, instant results.\n\nOnce that's done, the LBI gives you the deeper behavioural picture — why you perform the way you do under pressure. But right now — start with ExamReadiness. Shall I walk you through it?`,
        actions: tActions('recommendation_exam_student_actions', lang) ??
          ['Start ExamReadiness free', 'Do both — LBI + ExamReadiness', 'Book a mentor for board prep', 'How does the 4-week plan work?'],
      };
    }
    return {
      text: t('recommendation_exam_parent', lang) ??
        `With the boards or entrance exam approaching, **ExamReadiness** is the right tool to start with. It gives a 0–100 readiness score per subject and a specific **4-week action plan** — not generic advice. 20 minutes, instant results.\n\nOnce that's done, the LBI gives the deeper behavioural picture — the root causes behind current performance. Shall I walk you through it?`,
      actions: tActions('recommendation_exam_parent_actions', lang) ??
        ['Start ExamReadiness free', 'Do both — LBI + ExamReadiness', 'Book a board-prep mentor', 'How does the 4-week plan work?'],
    };
  }

  if (role === 'student') {
    if (session.concern === 'learning' || session.concern === 'behaviour') {
      return {
        text: t('recommendation_lbi_student', lang) ??
          `The LBI™ maps exactly how *you* learn — focus patterns, retention style, how you handle pressure. 19 behavioural domains, 25 minutes.\n\nThe report tells you specifically what to change and how — not "study harder," but *how* to study in a way that actually fits the way your brain works. Free to start, instant report. Ready?`,
        actions: tActions('recommendation_lbi_student_actions', lang) ??
          ['Start LBI free now', 'See a sample report', 'Check exam readiness after', 'See pricing'],
      };
    }
    if (session.concern === 'career') {
      return {
        text: t('recommendation_career_student', lang) ??
          `The LBI™ maps your cognitive and behavioural strengths — how you actually think, process information and work best. That's the starting point for figuring out which directions are genuinely a good fit for you, not just what looks good on paper.\n\nWant to start?`,
        actions: tActions('recommendation_career_student_actions', lang) ?? ['Start LBI free now', 'Book a career guidance session', 'What does the report show?', 'See pricing'],
      };
    }
    return {
      text: t('recommendation_default_student', lang) ??
        `Based on what you've shared, the LBI™ is the right starting point. 25 minutes, instant report — it shows exactly where the gap is and what to do about it. Free to start. Shall we?`,
      actions: tActions('recommendation_default_student_actions', lang) ?? ['Start LBI free now', 'Check exam readiness instead', 'Book a mentor session', 'Tell me more about LBI'],
    };
  }

  if (role === 'career') {
    return {
      text: `The LBI™ maps your natural cognitive and behavioural strengths — the way you actually think, communicate and perform under pressure. That's the real foundation for identifying roles where you'll genuinely thrive.\n\nFrom there, a career guidance session can translate the report into specific paths and next steps. Want to start the LBI first?`,
      actions: ['Start LBI free now', 'Book a career guidance session', 'What does the LBI report show?', 'See pricing'],
    };
  }

  if (role === 'teacher') {
    return {
      text: `The LBI™ gives you an individual behavioural learning profile for each student — how they focus, retain, respond to pressure. It tells you *who needs what*, not just who's falling behind.\n\nA classroom pilot takes a week and gives you data you can actually act on. Want to get started?`,
      actions: ['Start a classroom pilot', 'See a sample student report', 'Book a school demo', 'See pricing'],
    };
  }

  if (role === 'hr') {
    return {
      text: `The LBI™ gives you a behavioural profile for any candidate — 19 domains covering how they communicate, handle pressure and collaborate. It predicts role fit and performance before you make the hire.\n\nFree to pilot with a small team. Want to get started?`,
      actions: ['Run a hiring pilot', 'See a sample candidate report', 'Book an HR demo', 'See enterprise pricing'],
    };
  }

  if (role === 'corporate') {
    return {
      text: `The LBI™ gives your organisation a consistent behavioural language for understanding how people work — individually and as teams. It maps 19 domains and points to where the gaps and strengths actually are.\n\nWant to start with a team pilot or go straight to a demo?`,
      actions: ['Run a team pilot', 'Book a corporate demo', 'See a sample team report', 'See enterprise pricing'],
    };
  }

  if (role === 'institution') {
    return {
      text: `The LBI™ gives you cohort-level behavioural data across your school — class by class, year group by year group. It surfaces at-risk students, learning style clusters and where interventions will have the most impact.\n\nA school deployment takes two weeks. Want to book a walkthrough?`,
      actions: ['Book a school demo', 'See sample cohort data', 'Deployment timeline', 'School pricing'],
    };
  }

  if (role === 'coach') {
    return {
      text: `The LBI™ gives you a deep behavioural map of each client — 19 domains showing how they think, retain, handle stress and communicate. It sharpens your work and gives you and your client a shared language for change.\n\nYou can share the report directly with clients. Want to see a sample?`,
      actions: ['See a sample client report', 'How to share reports with clients', 'Pricing for coaches', 'Book a demo'],
    };
  }

  // Parent or unknown — Indian parent-focused default
  if (session.concern === 'learning' || session.concern === 'behaviour') {
    return {
      text: t('recommendation_lbi_parent', lang) ??
        `Many Indian parents ask the same question: *"My child is intelligent — why aren't their marks reflecting it?"*\n\nThe answer is almost always **behavioural** — not a lack of effort or IQ. The LBI™ maps exactly this: how your child focuses, retains information, handles pressure, and where the real gaps are.\n\n**19 behavioural domains. 25 minutes. Free to start. Instant report.**\n\nThe report doesn't say "study more" — it tells you *how* to study in a way that fits your child's brain. Ready to start?`,
      actions: tActions('recommendation_lbi_parent_actions', lang) ??
        ["Start my child's LBI free", 'See a sample LBI report', 'Check Board exam readiness after', 'Book a parent demo'],
    };
  }
  if (session.concern === 'career') {
    return {
      text: t('recommendation_career_parent', lang) ??
        `Stream and career selection in India often happens under pressure — family expectations, peer choices, or assumptions about JEE/NEET being the only path.\n\nThe LBI™ cuts through that. It maps *how* your child actually thinks — their cognitive strengths, learning style, and behavioural patterns — and shows which streams and career paths are genuinely aligned with who they are.\n\n25 minutes, instant report. Free to start. Want to begin?`,
      actions: tActions('recommendation_career_parent_actions', lang) ?? ['Start LBI for stream & career fit', 'Book a career counselling session', 'What does the LBI report show?', 'See pricing'],
    };
  }
  return {
    text: t('recommendation_default_parent', lang) ??
      `Based on what you've shared, the LBI™ is the right starting point. 25 minutes, instant report — it maps exactly where the gap is and gives you a clear, actionable path forward. Free to start. Shall we?`,
    actions: tActions('recommendation_default_parent_actions', lang) ?? ["Start my child's LBI free", 'Check Board exam readiness instead', 'Book a mentor first', 'Tell me more about LBI'],
  };
}

// ─── Fallback responses ───────────────────────────────────────────────────────
const FALLBACKS = [
  `I'd rather ask than guess. What's the specific situation you're dealing with?`,
  `Tell me a bit more — what's behind the question?`,
  `What would be most useful to understand right now?`,
];
function getFallback(): string { return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)]; }

// ─── Video Catalog ──────────────────────────────────────────────────────────
// VIDEO_CATALOG and selectVideos now live in utils/video-selector.ts



// ─── Route: POST /api/chat/message ───────────────────────────────────────────
router.post('/message', optionalAuth, async (req: Request, res: Response) => {
  const { message, sessionId, language: _language, responseStyle: clientStyle, preferredLanguage: rawPreferredLanguage, context } = req.body as {
    message: string; sessionId: string; language?: string; responseStyle?: string; preferredLanguage?: string; context?: { userRole?: string };
  };

  if (!message || !sessionId) return res.status(400).json({ error: 'message and sessionId are required' });

  // Resolve response style: prefer DB value for authenticated users, fall back to client-provided value
  // Constrain client value to known enum before using as a fallback
  const safeClientStyle = clientStyle === 'concise' ? 'concise' : 'standard';
  let resolvedStyle: 'standard' | 'concise' = safeClientStyle;
  let dbPreferredLanguage: PreferredLanguage | null = null;
  if (req.user?.id) {
    try {
      const prefResult = await pool.query<{ response_style: string; preferred_language: string }>(
        'SELECT response_style, preferred_language FROM chat_preferences WHERE user_id = $1',
        [req.user.id],
      );
      if (prefResult.rows.length > 0) {
        const dbStyle = prefResult.rows[0].response_style;
        resolvedStyle = dbStyle === 'concise' ? 'concise' : 'standard';
        const dbLang = prefResult.rows[0].preferred_language;
        const validLanguages: PreferredLanguage[] = ['english', 'hindi', 'tamil', 'telugu', 'marathi'];
        if (dbLang && validLanguages.includes(dbLang as PreferredLanguage)) {
          dbPreferredLanguage = dbLang as PreferredLanguage;
        }
      }
    } catch { /* fall back to client value on DB error */ }
  }

  const session = getSession(sessionId);

  // Inject language preference: DB value takes precedence for authenticated users,
  // then fall back to client-sent value, leaving the session default (english) otherwise.
  const validLanguages: PreferredLanguage[] = ['english', 'hindi', 'tamil', 'telugu', 'marathi'];
  if (dbPreferredLanguage) {
    session.preferredLanguage = dbPreferredLanguage;
  } else if (rawPreferredLanguage && validLanguages.includes(rawPreferredLanguage as PreferredLanguage)) {
    session.preferredLanguage = rawPreferredLanguage as PreferredLanguage;
  }

  // Update user type from context or message
  const ctxRole = (context?.userRole ?? '') as UserType;
  if (ctxRole && ctxRole !== 'guest' && !session.userType) session.userType = ctxRole;
  const detectedType = detectUserType(message, session.userType);
  if (detectedType) session.userType = detectedType;

  // Detect intent and topics
  const intent  = detectIntent(message);
  const topics  = detectTopics(message);
  session.lastIntent = intent;
  topics.forEach(t => { if (!session.detectedTopics.includes(t)) session.detectedTopics.push(t); });

  // Emotional state update
  if (intent === 'emotional') { session.emotionalState = 'stressed'; session.warmthLevel = Math.min(2, session.warmthLevel + 1); }
  else if (intent === 'diagnostic') { session.emotionalState = 'uncertain'; }
  else if (intent === 'thanks') { session.emotionalState = 'calm'; }

  // Save user turn
  session.turns.push({ role: 'user', text: message, ts: Date.now() });

  // Build counsellor response; apply conciseness instruction when style is 'concise'
  const { text: rawResponseText, actions, sensitive: branchSensitive } = counsellorResponse(session, message, intent, topics);
  const isConcise = resolvedStyle === 'concise';
  const responseText = isConcise ? applyConcisenessFilter(rawResponseText) : rawResponseText;
  const sensitive = intent === 'emotional' || !!branchSensitive;

  // Save assistant turn
  session.turns.push({ role: 'assistant', text: responseText, ts: Date.now() });
  if (session.turns.length > 20) session.turns = session.turns.slice(-20);

  // Select contextual video suggestions
  const videoSuggestions = selectVideos(session, topics, message);

  // Build language system instruction for reply generation (used by AI integrations)
  const languageInstruction = session.preferredLanguage !== 'english'
    ? `Reply in ${LANGUAGE_LABELS[session.preferredLanguage]}.`
    : null;

  return res.json({
    response:            responseText,
    suggestedActions:    actions.map(label => ({ label, message: label })),
    intent,
    userType:            session.userType ?? 'guest',
    emotionalState:      session.emotionalState,
    sensitive,
    videoSuggestions,
    languageInstruction,
    preferredLanguage:   session.preferredLanguage,
  });
});

router.post('/match-concerns', async (req: Request, res: Response) => {
  try {
    const { message } = req.body as { message: string };
    if (!message) return res.json({ matches: [] });

    const text = message.toLowerCase();
    const words = text.split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return res.json({ matches: [] });

    const conditions = words.map((_, i) => `LOWER(search_keywords) LIKE $${i + 1}`);
    const params = words.map(w => `%${w}%`);

    const result = await dbQuery(
      `SELECT id, category, concern_area, parent_worry, impact_on_child, assessment_type
       FROM concern_areas WHERE is_active = true AND (${conditions.join(' OR ')})
       ORDER BY sort_order LIMIT 5`,
      params
    );
    return res.json({ matches: result.rows });
  } catch (err) {
    console.error('[Chat] match-concerns error:', err);
    return res.json({ matches: [] });
  }
});

export default router;
