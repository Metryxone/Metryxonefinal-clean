/**
 * CAPADEX Concern Intelligence Engine
 * Transforms a free-text concern into structured behavioural intelligence:
 * category, severity, emotional signals, behavioural patterns, subdomains,
 * adaptive clarification questions, behavioural mirror, intelligence preview,
 * and auto-detected persona — all rule-based, no external AI dependency.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { deriveRuntimeContext, persistRuntimeContext } from '../services/runtime-context';
import { CONCERN_TO_CONSTRUCT, CONSTRUCT_MAP, constructToLegacyCategory, normalizeConcernKey } from '../data/behavioural-constructs';
import { isHypothesisDrivenClarityEnabled, isAdaptiveQuestioningEnabled, isSignalGroundingRuntimeEnabled, isRuntimeMetadataActivationEnabled, isWc3PersonalizationEnabled, isRuntimeIntelligenceConsumptionEnabled } from '../config/feature-flags';
import { resolveBridgeTagForConcernId, groundedSummary, loadGroundedRankTokens } from '../services/signal-grounding-runtime';
import {
  scoreQuestionMetadata, metaFromRow, stageRank, canonicalPersonaFor, ageBandForAge,
  META_SELECT_COLS, META_JOIN, type MetadataContext, type QuestionMetadata,
} from '../services/question-metadata-ranking';
import { runAdaptiveSelection } from '../services/adaptive/adaptive-question-pipeline';
import type { PriorAnswer } from '../services/adaptive/trait-inference';
import { buildHypotheses } from '../services/hypothesis-engine';
import { confidenceBand } from '../services/confidence-engine';
import { classifyGovernance } from '../services/hypothesis-question-governance';
import { resolveCoveredBridgeTag } from '../services/bridge-tag-resolver';
import { proxySubjectNoun, rephraseForProxy } from '../services/proxy-language-engine';
import {
  expandResolverToken,
  buildResolverCorpus,
  resolveConcern,
  type ResolverCorpus,
  type ResolutionResult,
} from '../services/concern-resolver-engine';

// Standard 3-point likert options synthesised for DB-sourced questions
// (the `adaptive_question_bank` table only stores `question_text`).
const STANDARD_CHOICE_OPTIONS = ['Yes, often', 'Sometimes', 'Rarely or never'];

// UX cap on clarify-phase questions surfaced per concern (raised from the
// historical 3 so a concern can present a fuller, less repetitive set).
const CLARITY_TARGET = 10;

// ─── Category Detection ──────────────────────────────────────────────────────
// Primary: check the canonical construct map (exact or partial match on concern text).
// Fallback: keyword regex rules for free-text that doesn't match a known concern.

const CATEGORY_RULES: Array<{ cat: string; keywords: RegExp }> = [
  { cat: 'digital',    keywords: /screen|phone|gaming|social.?media|digital|internet|device|app\b|online|tiktok|youtube|instagram|whatsapp|netflix|scroll|reels|video|addicted to (phone|screen|device|social)/i },
  { cat: 'academic',   keywords: /study|exam|homework|academic|school|grade|learning|class|marks|syllabus|university|college|test|assignment|project|tuition|cbse|board|concentrate while study|focus (while|during|for) study|retention/i },
  { cat: 'emotional',  keywords: /anxi|stress|emotion|mood|depress|worry|fear|lonel|mental health|wellbeing|sad|overwhelm|burnout|exhaust|frustrat|hopeless|panic|breakdown|crying|low mood/i },
  { cat: 'behavioural',keywords: /focus|attent|distract|concentrat|procrastin|impulsiv|hyperactiv|restless|fidget|habit|discipline|routine|motivat|lazy|productiv|time.?management|self.?control/i },
  { cat: 'social',     keywords: /social|peer|friend|relation|communicat|conflict|bully|shy|introvert|isolat|loneli|awkward|interacting|crowd|public speaking|group|team/i },
  { cat: 'career',     keywords: /career|job|employ|skill|workplace|interview|professional|future|path|direction|purpose|passion|calling|industry|internship|stuck.*(position|role|job)|same.*(position|role|job).*year|(\d+\s*year|years?.*same).*(position|job|role)|no.*promot|stagnation|plateaued|undervalued|overqualified/i },
  { cat: 'wellness',   keywords: /sleep|eat|health|tired|fatigue|energy|wellness|exercise|weight|nutrition|diet|headache|physical|body|pain/i },
];

export function detectCategory(text: string): { category: string; construct_key: string | null; construct_label: string | null } {
  // 1. Try exact match in CONCERN_TO_CONSTRUCT
  const exactKey = CONCERN_TO_CONSTRUCT[normalizeConcernKey(text)];
  if (exactKey) {
    const construct = CONSTRUCT_MAP[exactKey];
    return {
      category:        constructToLegacyCategory(exactKey),
      construct_key:   exactKey,
      construct_label: construct?.label ?? null,
    };
  }

  // 2. Try substring match against known concern keys.
  // Guard: only match multi-word keys (contain a space) or keys ≥ 8 chars to
  // prevent short/generic words like "use", "position", "more" from falsely
  // matching against a long free-text sentence typed by the user.
  const lower = normalizeConcernKey(text);
  for (const [concern, ck] of Object.entries(CONCERN_TO_CONSTRUCT)) {
    const isSignificant = concern.includes(' ') || concern.length >= 8;
    if (isSignificant && (lower.includes(concern) || concern.includes(lower))) {
      const construct = CONSTRUCT_MAP[ck];
      return {
        category:        constructToLegacyCategory(ck),
        construct_key:   ck,
        construct_label: construct?.label ?? null,
      };
    }
  }

  // 3. Fallback: keyword regex
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.test(text)) {
      return { category: rule.cat, construct_key: null, construct_label: null };
    }
  }
  return { category: 'general', construct_key: null, construct_label: null };
}

// ─── Severity Detection ──────────────────────────────────────────────────────
function detectSeverity(text: string): 'low' | 'moderate' | 'high' {
  const high = /addict|cannot|unable|failing|crisis|desperate|complet|destroy|severe|every day|all the time|constantly|totally|can't stop|can't control|out of control|taking over|lost control/i;
  const low  = /slightly|sometimes|occasion|mild|a bit|a little|now and then|once in a while/i;
  if (high.test(text)) return 'high';
  if (low.test(text))  return 'low';
  return 'moderate';
}

// ─── Emotional Signal Detection ──────────────────────────────────────────────
function detectEmotionalSignals(text: string, category: string): string[] {
  const signals: string[] = [];
  if (/anxi|nervous|panic|scared|fear/i.test(text))         signals.push('Anxiety');
  if (/stress|pressure|overwhelm/i.test(text))              signals.push('Stress');
  if (/frustrat|angry|irritat/i.test(text))                 signals.push('Frustration');
  if (/exhaust|tired|fatigue|drain/i.test(text))            signals.push('Mental fatigue');
  if (/sad|depress|low|hopeless|empty/i.test(text))         signals.push('Low mood');
  if (/confus|uncertain|lost|don\'t know/i.test(text))      signals.push('Confusion');
  if (/worried|worry|concern/i.test(text))                  signals.push('Worry');
  if (/lonely|alone|isolat/i.test(text))                    signals.push('Isolation');
  if (/guilt|ashamed|embarrass/i.test(text))                signals.push('Guilt');

  // Fill from category defaults if not enough signals
  const defaults: Record<string, string[]> = {
    digital:    ['Compulsive urges', 'Restlessness', 'Withdrawal discomfort'],
    academic:   ['Performance anxiety', 'Self-doubt', 'Overwhelm'],
    emotional:  ['Emotional load', 'Mental fatigue', 'Vulnerability'],
    behavioural:['Frustration', 'Low motivation', 'Self-criticism'],
    social:     ['Social anxiety', 'Loneliness', 'Self-consciousness'],
    career:     ['Uncertainty', 'Confusion', 'Pressure'],
    wellness:   ['Physical fatigue', 'Low energy', 'Discomfort'],
    general:    ['Worry', 'Uncertainty', 'Stress'],
  };
  const def = defaults[category] || defaults.general;
  for (const d of def) {
    if (signals.length >= 3) break;
    if (!signals.includes(d)) signals.push(d);
  }
  return signals.slice(0, 3);
}

// ─── Persona Auto-Detection ──────────────────────────────────────────────────
function detectPersona(text: string, suppliedPersona?: string): string {
  if (suppliedPersona && suppliedPersona !== 'null') return suppliedPersona;
  if (/my child|my son|my daughter|my kid|my ward|for my child/i.test(text)) return 'parent';
  if (/my students|my classroom|my class|my pupils|as a teacher/i.test(text)) return 'teacher';
  if (/my employees|my staff|my team|my workers|at workplace|my organisation/i.test(text)) return 'hr';
  if (/career|job|interview|workplace|professional/i.test(text)) return 'professional';
  return 'student';
}

// ─── Detected Behavioural Patterns ───────────────────────────────────────────
const PATTERNS: Record<string, string[]> = {
  digital:    ['Digital Dependency Pattern', 'Attention Fragmentation', 'Reward-Loop Dysregulation'],
  academic:   ['Focus Inconsistency', 'Cognitive Load Imbalance', 'Performance Anxiety Loop'],
  emotional:  ['Emotional Regulation Challenge', 'Stress Response Sensitivity', 'Resilience Depletion'],
  behavioural:['Attention Dysregulation', 'Habit Resistance Pattern', 'Motivation Depletion Loop'],
  social:     ['Social Avoidance Pattern', 'Self-Presentation Anxiety', 'Peer Relation Strain'],
  career:     ['Direction Ambiguity', 'Identity-Role Mismatch', 'Decision Paralysis'],
  wellness:   ['Energy Regulation Imbalance', 'Recovery Deficit Pattern', 'Physical-Mental Fatigue Loop'],
  general:    ['Adaptive Strain Pattern', 'Coping Mechanism Overload', 'Growth Readiness Signal'],
};

// ─── Subdomain Mapping ────────────────────────────────────────────────────────
const SUBDOMAINS: Record<string, string[]> = {
  digital:    ['Digital Self-Regulation', 'Attention Control', 'Habit Architecture', 'Impulse Management'],
  academic:   ['Focus & Concentration', 'Cognitive Retention', 'Study Consistency', 'Exam Readiness'],
  emotional:  ['Emotional Regulation', 'Resilience Capacity', 'Stress Tolerance', 'Emotional Awareness'],
  behavioural:['Behavioural Discipline', 'Habit Formation', 'Self-Motivation', 'Goal Consistency'],
  social:     ['Interpersonal Skills', 'Social Confidence', 'Communication Clarity', 'Peer Integration'],
  career:     ['Career Clarity', 'Skill Mapping', 'Professional Identity', 'Decision Intelligence'],
  wellness:   ['Energy Management', 'Sleep Quality', 'Physical Discipline', 'Recovery Systems'],
  general:    ['Behavioural Awareness', 'Adaptive Thinking', 'Growth Orientation', 'Self-Regulation'],
};

// ─── Intelligence Preview Statements ─────────────────────────────────────────
// Base templates used as fallbacks when no pattern-specific override is found.
const PREVIEW_TEMPLATES: Record<string, string[]> = {
  digital: [
    'A Screen-Pull Pattern — Not a Willpower Problem',
    'Your Brain Has Been Rewired for Constant Stimulation',
    'You Have Strong Re-regulation Capacity — It Just Needs Direction',
  ],
  academic: [
    'Your Mind Isn\'t Broken — It\'s Working Against the Wrong System',
    'Cognitive Overload Is Quietly Draining Your Ability to Focus',
    'Your Learning Potential Is Intact — The Approach Needs to Change',
  ],
  emotional: [
    'You\'re Carrying More Than You\'re Supposed to Handle Alone',
    'Your Nervous System Is Running on Overdrive',
    'You Have Deeper Resilience Than You Realise Right Now',
  ],
  behavioural: [
    'This Isn\'t Laziness — It\'s a Pattern That Needs the Right Key',
    'The Gap Between Intention and Action Has a Specific Cause',
    'Your Drive Is Intact — It Just Needs a Clearer Channel',
  ],
  social: [
    'Social Discomfort Often Comes From Misread Signals, Not Who You Are',
    'Your Inner Critic Is Louder Than It Needs to Be in Social Spaces',
    'The Connections You Want Are More Reachable Than It Feels',
  ],
  career: [
    'You\'re Not Lost — You\'re Between Two Versions of Yourself',
    'What You\'re Doing May Not Yet Match Who You\'re Becoming',
    'The Clarity You\'re Looking for Is Closer Than It Appears',
  ],
  wellness: [
    'Your Body Is Sending Signals That Deserve to Be Taken Seriously',
    'Physical and Mental Energy Are More Connected Than You Think',
    'Small Structural Changes Can Restore Far More Than You Expect',
  ],
  general: [
    'Something Real Is Happening — Even If It\'s Hard to Name',
    'You\'re at a Genuine Turning Point, Not Just a Bad Patch',
    'The Fact You\'re Here Means You\'re Already Ahead of Most',
  ],
};

// Pattern-specific preview overrides — make the preview feel like it is about *this* person.
const PATTERN_PREVIEW_OVERRIDES: Record<string, string> = {
  'Direction Ambiguity':              'Where Your Direction Gap Actually Lives — and What Is Behind It',
  'Identity-Role Mismatch':           'Why What You Do and Who You Are Feel Misaligned Right Now',
  'Decision Paralysis':               'The Specific Loop Causing Your Decision Paralysis — Mapped Precisely',
  'Focus Inconsistency':              'Your Focus Breaks Down in a Predictable Pattern — Here Is the Trigger',
  'Cognitive Load Imbalance':         'Why Your Brain Feels Overloaded Even on Straightforward Tasks',
  'Performance Anxiety Loop':         'The Anxiety-Performance Cycle Keeping You Stuck — Broken Down',
  'Digital Dependency Pattern':       'Your Screen Pull Has a Specific Neural Loop — Here Is What Drives It',
  'Attention Fragmentation':          'How Your Attention Has Been Fragmented — and the Specific Recovery Path',
  'Reward-Loop Dysregulation':        'The Dopamine Loop Running Your Digital Behaviour — Named and Mapped',
  'Social Avoidance Pattern':         'The Avoidance Cycle Is Costing You More Than You Currently Realise',
  'Self-Presentation Anxiety':        'Your Inner Critic Has a Script — and This Report Rewrites It',
  'Peer Relation Strain':             'The Relational Gap Between You and Others — and Why It Exists',
  'Emotional Regulation Challenge':   'Why Your Emotional Responses Feel Bigger Than the Situation Deserves',
  'Stress Response Sensitivity':      'Your Stress System Is Calibrated Too High — Here Is Why and How',
  'Resilience Depletion':             'Your Resilience Has a Specific Drain Point — and a Clear Rebuild Path',
  'Attention Dysregulation':          'Your Attention System Has a Measurable Gap — Not a Willpower Problem',
  'Habit Resistance Pattern':         'Why Every New Habit Stalls at the Same Point for You',
  'Motivation Depletion Loop':        'The Motivation Loop Draining You Has a Structural Cause — Not a Personal Failing',
  'Energy Regulation Imbalance':      'Where Your Energy Is Actually Leaking — and the Structural Fix',
  'Recovery Deficit Pattern':         'Your Recovery System Is Running at a Measurable Deficit — Here Is the Gap',
  'Physical-Mental Fatigue Loop':     'Why Rest Isn\'t Restoring You — the Physical-Mental Fatigue Loop Explained',
};

/** Replaces the first 1–2 preview items with pattern-specific overrides when available. */
function buildPersonalizedPreview(rulesKey: string, patterns: string[]): string[] {
  const base = (PREVIEW_TEMPLATES[rulesKey] || PREVIEW_TEMPLATES.general).slice();
  patterns.slice(0, 2).forEach((pattern, i) => {
    const override = PATTERN_PREVIEW_OVERRIDES[pattern];
    if (override) base[i] = override;
  });
  return base;
}

// ─── Behavioural Mirror Content ───────────────────────────────────────────────
const MIRROR_TEMPLATES: Record<string, string[]> = {
  digital: [
    'Pick up your phone without even deciding to — it just happens',
    'Lose 30–60 minutes without realising time has passed',
    'Feel a quiet restlessness when you\'re not connected — like something\'s missing',
    'Try to stop, manage to for a while, then find yourself back in the same loop',
  ],
  academic: [
    'Sit down with every intention to focus — and watch the minutes slip by anyway',
    'Re-read the same paragraph two or three times and still not absorb it',
    'Walk away from a long study session feeling like you got nowhere',
    'Have days where everything clicks, followed by days where nothing does — and not know why',
  ],
  emotional: [
    'Feel a low, persistent heaviness that\'s hard to explain to others',
    'React more strongly than you intended — and feel worse about that afterwards',
    'Find it impossible to properly switch off, even in moments meant for rest',
    'Feel like your emotional reserves are running lower than they used to',
  ],
  behavioural: [
    'Start the day with a clear plan — then watch it quietly fall apart',
    'Build a routine that works for a week or two, then lose it without a clear reason',
    'Know exactly what you need to do, but feel blocked from doing it',
    'Feel the distance between who you are and who you want to be getting wider',
  ],
  social: [
    'Replay conversations afterwards, wondering what you should have said differently',
    'Feel a quiet relief when plans get cancelled — then guilt about that relief',
    'Find it hard to be fully present in groups — part of you is always watching',
    'Wish you could be more natural, but something makes you hold back',
  ],
  career: [
    'Feel like everyone else has a clearer sense of direction than you do',
    'Explore an option with genuine excitement — then slowly lose confidence in it',
    'Wonder if you\'ve already missed a window, or taken a wrong turn somewhere',
    'Feel pressure from all sides to decide — but more confused the harder you think',
  ],
  wellness: [
    'Wake up tired even after a full night\'s sleep',
    'Push through the day on willpower, then crash harder than expected',
    'Notice that the things that used to restore you — rest, exercise, food — aren\'t working as well',
    'Feel like your body and mind are slightly out of sync with each other',
  ],
  general: [
    'Sense something is off, but struggle to put your finger on exactly what',
    'Feel a growing gap between how life is and how you know it could be',
    'Have moments of real clarity, then feel it slip away before you can act on it',
    'Know something needs to change — but feel stuck on where to even start',
  ],
};

// ─── Adaptive Clarification Questions ─────────────────────────────────────────
// Base set keyed by category (student / general default)
// Written in plain, simple English — relatable to Indian students and families.
const CLARIFICATION_QUESTIONS: Record<string, Array<{ id: string; question: string; options: string[] }>> = {
  digital: [
    {
      id: 'digital_duration',
      question: 'Beyond actual need — how much extra time goes on your phone or screen daily?',
      options: ['Under 1 hour — I manage it fairly well', '1–3 hours — I notice it but carry on', '3–5 hours — it is cutting into studying or sleep', 'More than 5 hours — it feels completely out of control'],
    },
    {
      id: 'digital_trigger',
      question: 'When do you feel the strongest urge to pick up your phone?',
      options: ['The moment I sit down to study or do any work', 'When I am bored or have nothing to keep me busy', 'Late at night when I should be sleeping', 'In social situations — phone feels easier than talking'],
    },
    {
      id: 'digital_impact',
      question: 'How honestly would you describe the impact on your life right now?',
      options: ['I notice it but it is not a serious problem yet', 'It is eating into my focus and time more than I want', 'It is getting in the way of things that actually matter', 'I feel like the phone controls me, not the other way around'],
    },
  ],
  academic: [
    {
      id: 'academic_when',
      question: 'When does your focus break down the most while studying?',
      options: ['Right when I sit down — I cannot even begin properly', 'After 10–15 minutes — I start okay but then lose it', 'During exam or test time — the pressure shuts me down', 'It is random — some days okay, other days nothing works at all'],
    },
    {
      id: 'academic_feel',
      question: 'What actually happens inside you when you lose focus?',
      options: ['My mind drifts off to something completely different', 'A heavy mental fog — slow, dull, and very tired', 'Anxiety underneath — I freeze and cannot move forward', 'I feel blank and disconnected — like I just do not care'],
    },
    {
      id: 'academic_duration',
      question: 'What makes it hardest to push through and keep going?',
      options: ['The mental effort required feels much higher than the task actually deserves', 'The backlog I have built up feels too big to face and catch up on', 'My confidence has quietly dropped — I am starting to doubt whether I can', 'Other pressures keep cutting in before I can properly settle and make progress'],
    },
  ],
  emotional: [
    {
      id: 'emotional_frequency',
      question: 'Which of these describes how it lives in you?',
      options: ['It ambushes me — I am fine and then suddenly I am not', 'It is always quietly there in the background, even on the better days', 'It builds up over time and then releases in waves that drain me', 'It is unpredictable — I never know when or how intensely it will surface'],
    },
    {
      id: 'emotional_impact',
      question: 'Where is it affecting you the most right now?',
      options: ['Inside — I manage on the outside but feel heavy within', 'My relationships — less present with family and friends', 'My studies or work are clearly suffering because of it', 'Everything — it is touching every part of my life'],
    },
    {
      id: 'emotional_intensity',
      question: 'What does carrying this feel like for you day to day?',
      options: ['An invisible weight that never fully lifts, even on the good days', 'Something I actively manage so those around me cannot tell how I really feel', 'A fog that makes ordinary tasks take far more effort than they should', 'An exhaustion that sleep does not fix — it feels deeper than physical tiredness'],
    },
  ],
  behavioural: [
    {
      id: 'behavioural_trigger',
      question: 'When does the problem usually start — what sets it off?',
      options: ['When I am tired or have not slept properly', 'When the task feels too big, boring, or confusing', 'When there is too much noise or distraction around me', 'When I feel overwhelmed — too many things at once'],
    },
    {
      id: 'behavioural_duration',
      question: 'How does the pattern play out when it shows up?',
      options: ['I am already doing it before I have consciously registered that it started', 'I know exactly what triggers it but cannot break the loop once it begins', 'I try to stop and manage for a while, then it quietly creeps back in', 'The harder I try to resist it, the stronger the pull actually becomes'],
    },
    {
      id: 'behavioural_tried',
      question: 'What have you already tried to sort it out?',
      options: ['Nothing yet — I am only just realising it is a problem', 'Tips from YouTube or online — nothing really sticks', 'Talked to friends or family about it — still struggling', 'Almost everything I could think of — that is why I am here'],
    },
  ],
  social: [
    {
      id: 'social_situation',
      question: 'Which situation makes you most uncomfortable?',
      options: ['Being in a group — I always feel a bit out of place', 'One-on-one conversations — I run out of things to say', 'Meeting new people — first impressions feel like too much pressure', 'Speaking up in class, at college, or in front of others'],
    },
    {
      id: 'social_feeling',
      question: 'What actually happens inside you in those moments?',
      options: ['I become very self-conscious and aware of how I appear', 'I just want to leave or not be there at all', 'My mind goes blank — I cannot find the right words', 'I replay the whole thing for hours later and keep worrying'],
    },
    {
      id: 'social_impact',
      question: 'How much is this affecting the choices you make?',
      options: ['I am uncomfortable but I still manage to push through', 'I have started avoiding certain situations more and more', 'It is quietly costing me friendships and opportunities', 'I have pulled back a lot — being alone feels safer now'],
    },
  ],
  career: [
    {
      id: 'career_stage',
      question: 'Which of these feels closest to where you are right now?',
      options: ['Still figuring out what I actually want from a career', 'I know what I want but have no clear path to get there', 'In the middle of my journey and something feels stuck', 'Built something already — but questioning if it is right for me'],
    },
    {
      id: 'career_challenge',
      question: 'What is really at the heart of it — if you had to name it?',
      options: ['I do not know what would actually make me feel fulfilled', 'I know my direction but keep losing confidence in it', 'I compare myself to others and always feel behind', 'Others\' expectations are louder than my own voice right now'],
    },
    {
      id: 'career_duration',
      question: 'What is driving the uncertainty most for you right now?',
      options: ['A gap between where I am and where I thought I would be by now', 'A sense that I am making choices for others rather than truly for myself', 'A feeling that my real strengths are going unused in what I am currently doing', 'Watching others seem so much clearer about their path while I am still searching'],
    },
  ],
  wellness: [
    {
      id: 'wellness_type',
      question: 'Which of these feels most out of balance for you right now?',
      options: ['Sleep — not enough, or waking up still feeling tired', 'Energy — running very low by the afternoon every day', 'Eating — my food habits feel irregular and off-track', 'Exercise — I know I need it but cannot keep it going'],
    },
    {
      id: 'wellness_impact',
      question: 'How is your physical state affecting your daily life?',
      options: ['I notice it but I am still managing reasonably okay', 'My focus and mood take a hit on most days', 'I get through the day but it costs me a lot of effort', 'Running on empty — everything feels harder than it should'],
    },
    {
      id: 'wellness_duration',
      question: 'When does your physical state affect you most noticeably?',
      options: ['In the mornings — I start the day already running on low', 'During demanding tasks — my body lets me down exactly when I need it', 'In the evenings — too depleted to do anything I actually care about', 'In my mood — my physical state quietly pulls my emotions down with it'],
    },
  ],
  general: [
    {
      id: 'general_when',
      question: 'When does this feel heaviest or most difficult for you?',
      options: ['Morning — I already feel the weight when I wake up', 'During the day — at work, college, or while studying', 'At night — when it goes quiet it gets louder inside', 'All the time — no part of the day feels free of it'],
    },
    {
      id: 'general_duration',
      question: 'What does this feel like it is taking from you most?',
      options: ['My focus — I cannot be fully present in things that matter to me', 'My energy — I am running at a fraction of what I know I am capable of', 'My confidence — I am starting to doubt my own abilities more than before', 'My ease — everything feels heavier and harder than it really should'],
    },
    {
      id: 'general_impact',
      question: 'How much of your daily life is this affecting?',
      options: ['In the background — I manage but it is always present', 'Specific areas — my focus, relationships, or energy levels', 'Spreading into most areas of my life now', 'It has taken over — very hard to see past it'],
    },
  ],
};

// ─── Persona/age-aware fallback overrides (2026-06-01) ───────────────────────
// The base CLARIFICATION_QUESTIONS sets lean student-flavoured ("while
// studying", "in class") — fine for learners but jarring for a working
// professional or a proxy rater who hits the static safety net. These overrides
// re-frame the two catch-all categories that free-text misses most often route
// to (`academic`, `general`) per macro-track:
//   • learner       → no override (keeps the existing study-framed sets)
//   • professional  → work framing
//   • proxy         → neutral framing (rephraseForProxy then makes it 3rd-person)
// Only the catch-alls are overridden; concern-specific CONSTRUCT_QUESTIONS and
// the other categories are unchanged.
const FALLBACK_BY_TRACK: Record<
  string,
  Partial<Record<'learner' | 'professional' | 'proxy', Array<{ id: string; question: string; options: string[] }>>>
> = {
  academic: {
    professional: [
      {
        id: 'work_focus_when',
        question: 'When does your focus break down the most during the workday?',
        options: ['Right when I sit down to start — I struggle to get going', 'After a short while — I begin okay then lose momentum', 'During high-pressure tasks or deadlines — the stress shuts me down', 'It is unpredictable — some days fine, other days nothing gets done'],
      },
      {
        id: 'work_focus_feel',
        question: 'What actually happens inside you when you lose focus at work?',
        options: ['My mind drifts to something completely unrelated', 'A heavy mental fog — slow, dull, and drained', 'Anxiety underneath — I freeze and cannot move forward', 'I feel blank and disengaged — like I have stopped caring'],
      },
      {
        id: 'work_focus_push',
        question: 'What makes it hardest to push through and stay productive?',
        options: ['The effort each task demands feels far higher than it should', 'My backlog feels too big to face and catch up on', 'My confidence has quietly dropped — I doubt I can deliver', 'Competing demands keep cutting in before I can settle'],
      },
    ],
    proxy: [
      {
        id: 'focus_when',
        question: 'When does focus tend to break down the most?',
        options: ['Right at the start — getting going is the hardest part', 'After a short while — it starts okay then slips', 'Under pressure — stress makes it shut down', 'It is unpredictable — sometimes fine, other times not at all'],
      },
      {
        id: 'focus_feel',
        question: 'What tends to happen when focus is lost?',
        options: ['The mind drifts to something completely unrelated', 'A heavy fog — slow, dull, and drained', 'Anxiety underneath — freezing, unable to move forward', 'Feeling blank and disconnected — as if it stopped mattering'],
      },
      {
        id: 'focus_push',
        question: 'What makes it hardest to keep going?',
        options: ['Each task demands far more effort than it should', 'The backlog feels too big to face and catch up on', 'Confidence has quietly dropped — self-doubt is creeping in', 'Other pressures keep cutting in before things can settle'],
      },
    ],
  },
  general: {
    professional: [
      {
        id: 'work_general_when',
        question: 'When does this feel heaviest or most difficult?',
        options: ['In the morning — I feel the weight before the day even starts', 'During the workday — when demands pile up', 'In the evening — when it quiets down it gets louder inside', 'All the time — no part of the day feels free of it'],
      },
      {
        id: 'work_general_taking',
        question: 'What does this feel like it is taking from you most?',
        options: ['My focus — I cannot be fully present in what matters', 'My energy — I am running well below what I am capable of', 'My confidence — I am doubting my abilities more than before', 'My ease — everything feels heavier and harder than it should'],
      },
      {
        id: 'work_general_impact',
        question: 'How much of your daily life is this affecting?',
        options: ['In the background — I manage but it is always present', 'Specific areas — my focus, work, or energy', 'Spreading into most areas of my life now', 'It has taken over — hard to see past it'],
      },
    ],
    proxy: [
      {
        id: 'general_neutral_when',
        question: 'When does this feel heaviest or most difficult?',
        options: ['In the morning — the weight is there on waking', 'During the day — when demands build up', 'At night — when it goes quiet it gets louder', 'All the time — no part of the day feels free of it'],
      },
      {
        id: 'general_neutral_taking',
        question: 'What does this feel like it is taking the most?',
        options: ['Focus — being fully present in what matters', 'Energy — running well below what is possible', 'Confidence — more self-doubt than before', 'Ease — everything feels heavier than it should'],
      },
      {
        id: 'general_neutral_impact',
        question: 'How much of daily life is this affecting?',
        options: ['In the background — manageable but always present', 'Specific areas — focus, relationships, or energy', 'Spreading into most areas now', 'It has taken over — hard to see past it'],
      },
    ],
  },
};

// Macro-track of a persona key (mirrors the IntroPhase learner/professional/
// proxy grouping). Proxy is checked first (a rater assessing someone else),
// then professional (working adults incl. job seekers), else learner.
function personaTrack(persona?: string | null): 'learner' | 'professional' | 'proxy' {
  const key = String(persona || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (!key) return 'learner';
  if (/parent|teacher|educator|counsellor|counselor|placement|principal|warden|guardian|mentor|\bhr\b/.test(key)) return 'proxy';
  if (/professional|employee|working|job_seeker|jobseeker|career_transition|leadership_track|manager|executive/.test(key)) return 'professional';
  return 'learner';
}

// ─── Construct-Specific Question Sets ────────────────────────────────────────
// These are checked FIRST (before persona+category overrides) when a concern
// maps to a known construct. This ensures "Procrastination" and "Can't focus"
// feel completely different even though both fall under the behavioural category.
const CONSTRUCT_QUESTIONS: Record<string, Array<{ id: string; question: string; options: string[] }>> = {

  ATTENTION_REGULATION: [
    {
      id: 'attn_breakdown',
      question: 'How quickly does your focus break down when you sit down to study or work?',
      options: [
        'Within a few minutes — I can barely even get started',
        'I focus for a bit and then drift away without noticing',
        'I go in and out — short bursts and then I am gone',
        'It varies a lot — some days fine, other days completely impossible',
      ],
    },
    {
      id: 'attn_puller',
      question: 'What most often pulls your attention away?',
      options: [
        'My phone or a screen — the pull feels almost magnetic',
        'My own thoughts — my mind just starts wandering on its own',
        'Noise or activity happening around me',
        'Everything at once — I cannot even pinpoint the problem',
      ],
    },
    {
      id: 'attn_feeling',
      question: 'When your focus slips, how does it feel inside?',
      options: [
        'Frustrated — I know I should focus but I simply cannot',
        'Restless — almost physically uncomfortable sitting still',
        'Blank or foggy — thinking feels like it takes more effort than I have',
        'Guilty — I watch time disappear and feel worse with each passing minute',
      ],
    },
  ],

  EXECUTIVE_FUNCTION: [
    {
      id: 'exec_struggle',
      question: 'Which feels like your biggest daily struggle?',
      options: [
        'Starting things — getting going is the hardest part every single time',
        'Finishing things — I begin plenty but rarely see them through',
        'Prioritising — everything feels equally urgent and I just freeze',
        'Keeping track — tasks, deadlines, and plans keep falling through the gaps',
      ],
    },
    {
      id: 'exec_mind',
      question: 'What does your mind feel like when you try to organise yourself?',
      options: [
        'Overwhelmed — like too many browser tabs open all at once',
        'Foggy — I cannot think clearly even on perfectly ordinary days',
        'Scattered — good intentions but no system that actually works',
        'Shut down — the more I need to do, the less I am able to start',
      ],
    },
    {
      id: 'exec_duration',
      question: 'When does the disorganisation cause the most damage?',
      options: [
        'Before important tasks — I cannot prepare properly and it costs me',
        'In daily routines — small but important things keep falling through the gaps',
        'Under pressure — I lose the ability to think clearly exactly when I need it most',
        'In how others see me — it affects my image at work or in my studies',
      ],
    },
  ],

  PROCRASTINATION: [
    {
      id: 'proc_escape',
      question: 'When you procrastinate, what do you usually end up doing instead?',
      options: [
        'Scrolling my phone — it just happens automatically without deciding',
        'Something else that feels productive — anything but the real task',
        'Overthinking the task until it feels too big and impossible to start',
        'Nothing — I just sit there, frozen and unable to move',
      ],
    },
    {
      id: 'proc_taskfeel',
      question: 'What does the task feel like just before you avoid it?',
      options: [
        'Too big or unclear — I do not even know where to begin',
        'Boring or pointless — I cannot make myself care enough about it',
        'Scary — afraid of getting it wrong or it not being good enough',
        'Fine on the surface — but something in me just refuses to start',
      ],
    },
    {
      id: 'proc_pattern',
      question: 'What makes the avoidance feel justified to you in the moment?',
      options: [
        'I tell myself I will do it better when I am in the right mood or headspace',
        'The task is not urgent yet — pressure is the only thing that genuinely moves me',
        'I am waiting for the perfect moment or the right conditions to start',
        'I do not even notice I am avoiding — I simply find other things to fill the time',
      ],
    },
  ],

  IMPULSE_CONTROL: [
    {
      id: 'impulse_situation',
      question: 'Which situation is hardest for you to hold back in?',
      options: [
        'Arguments — I say things I regret before I have thought them through',
        'Spending or commitments — I act on impulse and wish I had paused',
        'Habits — I reach for my phone or something else without even deciding',
        'Big decisions — I move too fast and regret not slowing down',
      ],
    },
    {
      id: 'impulse_moment',
      question: 'What is happening inside you in the moment just before you act?',
      options: [
        'Nothing — it is done before I have even registered the impulse',
        'A strong urge that feels almost physical — like I must act right now',
        'Frustration or boredom — I am escaping something uncomfortable',
        'Excitement — it feels right in the moment but regret comes shortly after',
      ],
    },
    {
      id: 'impulse_cost',
      question: 'What has been the biggest cost in your life so far?',
      options: [
        'Broken relationships or conflicts I really wish had not happened',
        'Money spent or decisions I deeply regret financially',
        'Missed opportunities because I did not think things through properly',
        'How others see me — people find me unpredictable or hard to deal with',
      ],
    },
  ],

  HABIT_FORMATION: [
    {
      id: 'habit_pattern',
      question: 'When you try to build a new habit, what usually happens?',
      options: [
        'Strong for 2–3 days, then one slip and I give up entirely',
        'I keep starting over — the intention is there but follow-through is not',
        'I manage when motivated but cannot sustain it when I am not',
        'I have almost given up — nothing seems to stick no matter what I try',
      ],
    },
    {
      id: 'habit_break_feel',
      question: 'What does breaking a habit feel like for you?',
      options: [
        'Defeated — like proof that I am simply not capable of real change',
        'Relieved in the moment, then guilty very soon after',
        'Like I just need to try harder or find a better approach',
        'Normal now — I do not really expect habits to last anymore',
      ],
    },
    {
      id: 'habit_breaker',
      question: 'What usually breaks the streak?',
      options: [
        'One bad day — if I miss once I feel like I have completely failed',
        'Life gets busy — I lose the routine whenever anything changes',
        'It stops feeling rewarding and motivation quietly disappears',
        'I honestly do not know — it just stops happening',
      ],
    },
  ],

  INTRINSIC_MOTIVATION: [
    {
      id: 'motiv_state',
      question: 'How would you honestly describe your motivation right now?',
      options: [
        'I know exactly what I need to do — I just cannot make myself do it',
        'I have lost interest in things I used to genuinely care about',
        'Going through the motions — ticking boxes without any real drive',
        'Flat — like the energy exists in theory but never shows up in practice',
      ],
    },
    {
      id: 'motiv_day',
      question: 'What does a typical day look like when motivation is very low?',
      options: [
        'I start things but lose energy quickly and abandon them',
        'I avoid anything that requires real effort or commitment',
        'I distract myself constantly — phone, sleep, anything to escape',
        'I feel disconnected — watching life happen without really being in it',
      ],
    },
    {
      id: 'motiv_history',
      question: 'What does motivation feel like it is most connected to for you?',
      options: [
        'External recognition — I work hard when others notice and appreciate the effort',
        'Meaning — I engage deeply when I care about the outcome, disengage when I do not',
        'Energy and state — on good days I can do anything, on low days nothing at all',
        'The people around me — I rise and fall based on who I am surrounded by',
      ],
    },
  ],

  ANXIETY: [
    {
      id: 'anx_form',
      question: 'How does anxiety most often show up for you?',
      options: [
        'Racing thoughts I cannot slow down — especially at night',
        'Physical tension — chest tight, stomach knotted, cannot relax',
        'A feeling of dread I cannot explain or locate',
        'Overthinking — playing out every possible bad outcome in my head',
      ],
    },
    {
      id: 'anx_trigger',
      question: 'What triggers it most reliably for you?',
      options: [
        'Social situations — being judged or saying the wrong thing',
        'Performance pressure — exams, evaluations, or important deadlines',
        'Uncertainty — anything I cannot predict or control',
        'Nothing specific — it just appears without any warning at all',
      ],
    },
    {
      id: 'anx_impact',
      question: 'How much is anxiety actually changing what you do?',
      options: [
        'I feel it but still manage to do what I need to do',
        'I avoid certain situations just to keep it manageable',
        'It is starting to limit my choices in ways I really do not like',
        'It is making decisions for me — I organise life around avoiding triggers',
      ],
    },
  ],

  EMOTIONAL_REGULATION: [
    {
      id: 'emreg_pattern',
      question: 'Which of these feels most familiar to you?',
      options: [
        'I go from calm to overwhelmed very quickly — the shift is sudden',
        'Small things trigger big reactions I cannot really explain',
        'I shut down completely when emotions become too intense',
        'I feel everything more intensely than the people around me seem to',
      ],
    },
    {
      id: 'emreg_after',
      question: 'After a strong emotional reaction, what usually happens?',
      options: [
        'I feel embarrassed or ashamed about how I responded',
        'I replay it — wondering why I cannot just control myself better',
        'It fades and I feel normal again, but then it keeps happening',
        'I want to be alone — I prefer to withdraw until it fully passes',
      ],
    },
    {
      id: 'emreg_root',
      question: 'When this happens, what do you think is underneath it?',
      options: [
        'Stress or exhaustion — I am running on empty most of the time',
        'Unresolved things I have not properly dealt with yet',
        'I feel things very deeply — more than I am able to process',
        'Honestly, I do not know — that is part of what I want to understand',
      ],
    },
  ],

  SELF_ESTEEM: [
    {
      id: 'se_location',
      question: 'Where does the self-doubt show up most for you?',
      options: [
        'How I look or come across to the people around me',
        'My abilities — I always feel less capable than others',
        'My decisions — I constantly second-guess what I do or say',
        'Deep inside — a quiet voice that says I am simply not good enough',
      ],
    },
    {
      id: 'se_choices',
      question: 'How does it affect the choices you make every day?',
      options: [
        'I do not speak up even when I have something important to say',
        'I say yes to what I do not want, or no to what I actually do want',
        'I compare myself to others constantly — and always feel behind',
        'I avoid any situation where I might fail or be judged by others',
      ],
    },
    {
      id: 'se_origin',
      question: 'Which of these resonates most with how self-doubt lives in you?',
      options: [
        'A voice that compares me to others and consistently finds me lacking',
        'A feeling that any success I have had was luck — not really me',
        'A belief that if people truly knew me, they would think considerably less of me',
        'A constant bracing for criticism — quietly waiting to be found out or found wanting',
      ],
    },
  ],

  RESILIENCE: [
    {
      id: 'res_response',
      question: 'When something goes wrong — a setback or rejection — what usually happens?',
      options: [
        'I shut down for a while — I cannot function properly right after',
        'I blame myself and replay what I should have done differently',
        'I lose confidence — I start questioning whether I am capable at all',
        'I bounce between feeling fine and falling apart — no clear pattern',
      ],
    },
    {
      id: 'res_recovery',
      question: 'What usually helps you start recovering after a setback?',
      options: [
        'Time alone — I need to process internally before I can move again',
        'Taking a small action — doing anything, however minor, breaks the paralysis',
        'Talking to someone — getting it out helps me see it differently',
        'Honestly, I am still searching for what actually helps me recover',
      ],
    },
    {
      id: 'res_hardest',
      question: 'What is the hardest part of setbacks for you to deal with?',
      options: [
        'The feeling of failing — especially being seen as less capable',
        'The self-doubt that follows — questioning whether to try again',
        'The uncertainty of not knowing what to do next',
        'The loneliness — feeling like I am handling everything completely alone',
      ],
    },
  ],

  STRESS_MANAGEMENT: [
    {
      id: 'stress_form',
      question: 'How does stress most often show up for you?',
      options: [
        'I cannot switch off — my mind keeps running even when I stop',
        'Physical symptoms — tension, headaches, or stomach problems',
        'Irritability — small things feel much bigger than they actually are',
        'Numbness or shutdown — I stop feeling very much at all',
      ],
    },
    {
      id: 'stress_trigger',
      question: 'What usually pushes it to its peak?',
      options: [
        'Deadlines and performance pressure building up together',
        'Family tension or relationship problems I cannot resolve',
        'Financial worries or practical problems I have little control over',
        'Too much to handle and not enough time or support to manage it',
      ],
    },
    {
      id: 'stress_behaviour',
      question: 'When you are really stressed, what changes in you?',
      options: [
        'I make worse decisions — things I would never do in a calm state',
        'I pull away from people who could actually help me',
        'I stop looking after myself — sleep, food, and exercise all go',
        'I keep functioning on the surface but I am barely holding on',
      ],
    },
  ],

  COMMUNICATION: [
    {
      id: 'comm_challenge',
      question: 'Which of these feels most like your communication challenge?',
      options: [
        'Saying what I actually mean — my words do not come out right',
        'Difficult conversations — conflict, feedback, or disagreement',
        'Being assertive — asking for what I need without feeling guilty',
        'Reading the situation — I often misjudge how to say what I mean',
      ],
    },
    {
      id: 'comm_moment',
      question: 'In a challenging conversation, what usually happens?',
      options: [
        'I freeze or go blank — I lose access to my thoughts completely',
        'I agree to avoid conflict and then regret it afterwards',
        'I get defensive and say things I do not actually mean',
        'I overthink it so much that I never start the conversation at all',
      ],
    },
    {
      id: 'comm_cost',
      question: 'How has this been affecting your life?',
      options: [
        'People misunderstand me — that is the biggest cost for me',
        'I have missed out on things because I could not speak up',
        'Relationships have suffered — distance or unresolved issues',
        'My confidence has dropped — I avoid communicating more and more',
      ],
    },
  ],

  SOCIAL_CONFIDENCE: [
    {
      id: 'socconf_hard',
      question: 'What is the hardest part of social situations for you?',
      options: [
        'The feeling of being watched or silently judged by others',
        'Not knowing what to say — silence feels unbearable to me',
        'The build-up — anticipating it is often worse than the actual thing',
        'Afterwards — replaying everything I said or did not say',
      ],
    },
    {
      id: 'socconf_cope',
      question: 'What do you do when a social situation becomes uncomfortable?',
      options: [
        'Find a reason to leave early or avoid going in the first place',
        'Stay but withdraw — physically there but barely participating',
        'Overcompensate — talk too much or act more confident than I feel',
        'Push through but feel completely drained and exhausted afterwards',
      ],
    },
    {
      id: 'socconf_cost',
      question: 'In which areas of your life is this costing you the most?',
      options: [
        'Professional — I hold back in ways that are limiting my career or studies',
        'Relationships — I keep people at a surface level rather than being truly known',
        'Self-image — the way I see myself in social situations has gotten steadily worse',
        'Energy — every social interaction leaves me far more drained than it should',
      ],
    },
  ],

  PEER_RELATIONS: [
    {
      id: 'peer_struggle',
      question: 'Where does connecting with friends or classmates feel hardest?',
      options: [
        'Making new friends — the first few interactions feel very awkward',
        'Keeping friendships going — I am okay at starting but not sustaining',
        'Fitting into a group — I always feel slightly on the outside',
        'Handling conflict — I either avoid it completely or manage it badly',
      ],
    },
    {
      id: 'peer_feel',
      question: 'How do you feel in most group situations?',
      options: [
        'Like I am watching from the outside — present but not really included',
        'Anxious about how I am coming across the entire time',
        'Fine on the surface but exhausted by the effort underneath',
        'Like the odd one out — I never quite feel like I fully belong',
      ],
    },
    {
      id: 'peer_impact',
      question: 'What is this costing you the most on a daily basis?',
      options: [
        'The energy it takes to navigate interactions I find genuinely difficult',
        'Opportunities — things I do not pursue because of the social element involved',
        'Depth of connection — relationships stay shallower than I actually want them to be',
        'Belonging — I often feel like I am on the outside looking in',
      ],
    },
  ],

  DIGITAL_DEPENDENCY: [
    {
      id: 'digdep_time',
      question: 'Which of these pulls you toward your phone or screen the most?',
      options: [
        'The need to check — notifications, messages, what I might have missed',
        'Comfort — scrolling feels easier than sitting with whatever is real right now',
        'Habit — my hand reaches for it before I have even made a conscious decision',
        'Social comparison — seeing what everyone else is doing or achieving',
      ],
    },
    {
      id: 'digdep_trigger',
      question: 'When is the urge to pick up your phone the strongest?',
      options: [
        'The moment I need to focus — it is my automatic way to escape',
        'When I am bored or have a gap in my day',
        'Late at night when I should already be sleeping',
        'In social situations — the phone feels easier than real conversation',
      ],
    },
    {
      id: 'digdep_honest',
      question: 'How honestly would you describe the impact right now?',
      options: [
        'I notice it but it is not a serious problem yet',
        'It is affecting my focus and time more than I want it to',
        'It is getting in the way of things that genuinely matter',
        'I feel like the phone is controlling me — not the other way around',
      ],
    },
  ],

  DIGITAL_DISCIPLINE: [
    {
      id: 'digdisc_context',
      question: 'Where does your screen discipline break down the most?',
      options: [
        'Study or work time — screens are always competing for my attention',
        'Evening — I cannot switch off and it eats into my sleep',
        'Free time — I lose hours without ever meaning to',
        'All the time — no part of my day is screen-free by choice',
      ],
    },
    {
      id: 'digdisc_tried',
      question: 'What have you already tried to manage it?',
      options: [
        'Nothing yet — I am only just realising it is worth addressing',
        'App timers and screen limits — they help briefly then I override them',
        'Keeping the phone out of the room — works sometimes, not always',
        'Most things I can think of — and that is exactly why I am here',
      ],
    },
    {
      id: 'digdisc_cost',
      question: 'What is the biggest cost you are noticing in your life?',
      options: [
        'Concentration — my ability to focus deeply has gone down noticeably',
        'Time — hours disappear and I cannot account for where they went',
        'Sleep and energy — late screens leave me drained every morning',
        'Real connection — more time on screen, less time with people I care about',
      ],
    },
  ],

  MENTAL_HEALTH: [
    {
      id: 'mh_experience',
      question: 'Which of these feels closest to what you are going through?',
      options: [
        'A persistent low mood or flatness that simply will not lift',
        'Anxiety or worry that has become a constant background noise',
        'Feeling disconnected from myself or the people around me',
        'Exhaustion that is emotional — not just physical tiredness',
      ],
    },
    {
      id: 'mh_duration',
      question: 'What does living with this feel like most days?',
      options: [
        'Managing on the surface — but carrying a heaviness underneath that never lifts',
        'The effort to appear okay is exhausting in itself — it takes energy I do not have',
        'Good moments still exist, but there is a ceiling on how well I can actually feel',
        'It has become my baseline — I can barely remember feeling consistently okay',
      ],
    },
    {
      id: 'mh_support',
      question: 'Have you spoken to anyone about this?',
      options: [
        'No — this is the first time I am really naming it properly',
        'Close friends or family — it helped somewhat but not enough',
        'A counsellor at some point — but not consistently or regularly',
        'I keep it to myself — I do not want to be a burden to anyone',
      ],
    },
  ],

  PHYSICAL_WELLBEING: [
    {
      id: 'phys_area',
      question: 'Which feels most out of balance for you right now?',
      options: [
        'Sleep — not getting enough or waking up still feeling tired',
        'Energy — running low by the afternoon every single day',
        'Eating — my food habits feel irregular and off-track',
        'Exercise — I know I need it but I genuinely cannot make it happen',
      ],
    },
    {
      id: 'phys_impact',
      question: 'Which parts of your life is your physical state affecting most?',
      options: [
        'Mental clarity — harder to think, focus, or make good decisions when I need to',
        'Emotional state — my body pulls my mood and patience down along with it',
        'Social energy — I have much less to give to the people and things around me',
        'Consistency — I keep losing momentum because my body will not cooperate',
      ],
    },
    {
      id: 'phys_duration',
      question: 'Which best describes your relationship with your physical health right now?',
      options: [
        'I know what I need to do — I just cannot sustain the habits long enough',
        'My body keeps flagging something but I have not properly addressed it yet',
        'I have tried things that helped briefly but nothing has actually lasted',
        'I have disconnected — I push through and ignore what my body is telling me',
      ],
    },
  ],

  GOAL_ORIENTATION: [
    {
      id: 'goal_stage',
      question: 'Which of these feels closest to where you are right now?',
      options: [
        'I do not have clear goals — not sure what I am really working towards',
        'I have vague goals but no real plan to actually reach them',
        'I have goals but keep not following through on them',
        'Working towards something but doubting whether it is right for me',
      ],
    },
    {
      id: 'goal_block',
      question: 'What is the biggest thing blocking you right now?',
      options: [
        'Clarity — I genuinely do not know what I want',
        'Confidence — I know what I want but do not believe I can do it',
        'Consistency — I start well but keep losing momentum',
        'Direction — too many options and I cannot commit to one',
      ],
    },
    {
      id: 'goal_duration',
      question: 'What does the lack of clarity or direction cost you most?',
      options: [
        'Wasted effort — I work hard but cannot tell if I am heading the right way',
        'Confidence — watching others seem more certain makes me doubt myself',
        'Time — a quiet sense that things are moving while I am still figuring it out',
        'Peace of mind — the uncertainty is a constant mental noise I cannot quiet',
      ],
    },
  ],

  // ── Career Growth & Progression ─────────────────────────────────────────────
  CAREER_GROWTH: [
    {
      id: 'cg_block',
      question: 'What is the biggest thing blocking your career growth right now?',
      options: [
        'I am not being noticed or recognised — the right people do not see my contribution',
        'I feel stuck at the same level with no clear path forward',
        'I do not have the right skills or credentials to move up',
        'Politics and relationships are getting in the way more than my actual performance',
      ],
    },
    {
      id: 'cg_stage',
      question: 'Which of these feels most true about being stuck right now?',
      options: [
        'Invisible — I am working hard but the right people are simply not noticing',
        'Under-skilled — I do not yet have what is needed to move to the next level',
        'Politically stuck — relationships and dynamics matter more than performance here',
        'Direction-lost — I am not even sure the path I am on is the right one anymore',
      ],
    },
    {
      id: 'cg_tried',
      question: 'What have you already tried to move your career forward?',
      options: [
        'Worked harder and taken on more — but it has not translated into anything',
        'Asked for feedback or mentorship — without much useful guidance',
        'Applied for internal or external roles — with limited success',
        'I have not really tried yet — I am not sure where to even start',
      ],
    },
  ],

};

// ─── Construct → Rules Key Mapping ───────────────────────────────────────────
// Maps each of the 32 canonical construct keys to one of the 8 content rule
// buckets. Rule selection in analyzeConcern flows: construct_key → rulesKey →
// PATTERNS / SUBDOMAINS / CLARIFICATION_QUESTIONS / etc.
// The legacy CATEGORY_RULES regex is only used when a concern cannot be mapped
// to a construct (i.e. free-text that doesn't match any known concern area).
const CONSTRUCT_TO_RULES_KEY: Record<string, string> = {
  // Cognitive cluster
  ATTENTION_REGULATION: 'behavioural',
  WORKING_MEMORY:       'academic',
  PROCESSING_SPEED:     'academic',
  CRITICAL_THINKING:    'academic',
  CREATIVITY:           'behavioural',
  // Self-Regulation cluster
  EXECUTIVE_FUNCTION:   'behavioural',
  IMPULSE_CONTROL:      'behavioural',
  PROCRASTINATION:      'behavioural',
  HABIT_FORMATION:      'behavioural',
  // Emotional cluster
  ANXIETY:              'emotional',
  EMOTIONAL_REGULATION: 'emotional',
  SELF_ESTEEM:          'emotional',
  RESILIENCE:           'emotional',
  // Mental Wellbeing cluster
  STRESS_MANAGEMENT:    'emotional',
  MENTAL_HEALTH:        'emotional',
  PHYSICAL_WELLBEING:   'wellness',
  // Motivation cluster
  INTRINSIC_MOTIVATION: 'behavioural',
  GOAL_ORIENTATION:     'career',
  LEARNING_DRIVE:       'academic',
  // Social cluster
  COMMUNICATION:        'social',
  SOCIAL_CONFIDENCE:    'social',
  PEER_RELATIONS:       'social',
  SAFETY_THREATS:       'social',
  // Digital cluster
  DIGITAL_DEPENDENCY:   'digital',
  DIGITAL_DISCIPLINE:   'digital',
  // Academic cluster
  EXAM_PERFORMANCE:     'academic',
  EXAM_READINESS:       'academic',
  LEARNING_APPROACH:    'academic',
  ACADEMIC_RECOVERY:    'academic',
  // Career cluster
  CAREER_CLARITY:       'career',
  CAREER_GROWTH:        'career',
  SKILL_AWARENESS:      'career',
  // Family & Environment cluster
  FAMILY_DYNAMICS:      'social',
};


// Helper: pick the best question set for a given persona + category + construct
// Priority:
//   1. Construct-specific questions — ensures every distinct concern gets unique questions
//      (e.g. Procrastination ≠ Can't focus ≠ Impulse control, even for the same persona)
//   2. Persona+category override — professional/parent/teacher framing when no construct set exists
//   3. Category base questions — broad fallback
//   4. General fallback
// Shared row shape used by both the static fallback paths and `pickQuestionsFromDB`.
// (Previously co-located with the now-removed PERSONA_QUESTIONS block.)
// Static rows are generic by default but MAY carry optional age scoping
// (`ageMin`/`ageMax`). When present, `applyStaticAgeFilter` enforces the same
// numeric interval overlap used by the master tier; rows without age metadata
// remain the generic final safety net.
type CQ = Array<{ id: string; question: string; options: string[]; response_type?: string; ageMin?: number; ageMax?: number }>;

// Filter a static question set by age band where rows carry age scoping.
// Rows with no ageMin/ageMax are always kept (generic safety net). If the
// filter would empty an otherwise-populated set, the unfiltered set is
// returned so the CAPADEX never-empty invariant holds.
function applyStaticAgeFilter(questions: CQ, ageRange?: [number, number] | null): CQ {
  if (!ageRange) return questions;
  const [bandMin, bandMax] = ageRange;
  const filtered = questions.filter(q => {
    if (!Number.isFinite(q.ageMin as number) || !Number.isFinite(q.ageMax as number)) return true;
    return (q.ageMin as number) <= bandMax && (q.ageMax as number) >= bandMin;
  });
  return filtered.length > 0 ? filtered : questions;
}

function pickQuestions(
  category: string,
  persona: string,
  constructKey?: string | null,
  ageRange?: [number, number] | null,
): CQ {
  // 1. Construct-specific questions (highest priority — unique per concern)
  if (constructKey && CONSTRUCT_QUESTIONS[constructKey]) {
    return applyStaticAgeFilter(CONSTRUCT_QUESTIONS[constructKey], ageRange);
  }
  // 2. Persona/age-aware catch-all override. The base academic/general sets are
  //    student-flavoured; a working professional or proxy rater who lands on the
  //    static safety net should not see "while studying" phrasing. learner has no
  //    override and falls through to the existing study-framed sets.
  const track = personaTrack(persona);
  const override = FALLBACK_BY_TRACK[category]?.[track];
  if (override) {
    return applyStaticAgeFilter(override, ageRange);
  }
  // 3. Category base questions / general safety net.
  return applyStaticAgeFilter(CLARIFICATION_QUESTIONS[category] || CLARIFICATION_QUESTIONS.general, ageRange);
}

/**
 * DB-backed clarification-question picker.
 *
 * Queries `adaptive_question_bank` for `concern_bucket = construct_key`
 * (falling back to category when no construct key was detected) AND
 * `persona = persona` AND `status = 'approved'`. Maps each row into the
 * standard CQ shape with the synthesised 3-point likert options.
 *
 * If the query yields zero rows OR the DB drops mid-call, we fall back to
 * the hardcoded static `pickQuestions(...)` above so the user-facing
 * assessment flow NEVER crashes (CAPADEX invariant: concern resolver never 404s).
 */
async function pickQuestionsFromDB(
  pool: Pool | null | undefined,
  category: string,
  persona: string,
  constructKey?: string | null,
  userAge?: number | null,
  seenIds?: string[] | null,
): Promise<{ questions: CQ; source: 'adaptive_bank' | 'static_fallback' }> {
  // Age range carried into every static fallback so Tier-3 honours age scoping
  // where static rows define it (no-op for the current all-generic static set).
  const staticAgeRange: [number, number] | null =
    Number.isFinite(userAge as number) ? [Number(userAge), Number(userAge)] : null;
  // No pool injected → static fallback (e.g. when routes registered without DB)
  if (!pool) return { questions: pickQuestions(category, persona, constructKey, staticAgeRange), source: 'static_fallback' };

  // Age is now a hard requirement for the DB-backed path: rows in
  // `adaptive_question_bank` carry strict (age_min, age_max) bounds, so a
  // query without a known age would always return zero rows. Short-circuit
  // to the static fallback so anon / age-less callers still get questions
  // (preserves the "frontend never freezes" safeguard from step 3).
  if (!Number.isFinite(userAge as number)) {
    return { questions: pickQuestions(category, persona, constructKey, staticAgeRange), source: 'static_fallback' };
  }

  try {
    const bucket = constructKey || category;
    const ageArg = Number(userAge);
    // Already-seen exclusion (2026-05-29): the seen ids the client persists are
    // prefixed (`aqb_<row.id>` for this tier). Strip the prefix to the numeric
    // row id and exclude at the SQL layer so the unseen pool is drawn BEFORE the
    // CLARITY_TARGET slice — otherwise exclusion only operates on the already
    // narrowed 10-row slice and re-serves the same questions every run.
    const seenDbIds = (seenIds || [])
      .map(s => /^aqb_(\d+)$/.exec(String(s)))
      .filter((m): m is RegExpExecArray => m !== null)
      .map(m => Number(m[1]))
      .filter(n => Number.isFinite(n));
    const seenDbArg = seenDbIds.length > 0 ? seenDbIds : null;
    // OR-join against `adaptive_ontology_edges`: a user with primary bucket=X
    // also receives questions for any target bucket where (source=X,
    // status='approved', weight >= 0.60). When the edges table is empty or all
    // rows are draft, the IN-list collapses to just the primary bucket and
    // behaviour is identical to the pre-ontology query.
    const rs = await pool.query<{ id: number; question_text: string }>(
      `SELECT id, question_text
         FROM adaptive_question_bank
        WHERE concern_bucket IN (
                SELECT $1::text
                UNION
                SELECT target_bucket
                  FROM adaptive_ontology_edges
                 WHERE source_bucket = $1
                   AND status        = 'approved'
                   AND weight       >= 0.60
              )
          AND persona = $2
          AND status  = 'approved'
          AND $3     >= age_min
          AND $3     <= age_max
          AND ($4::int[] IS NULL OR id <> ALL($4::int[]))
        ORDER BY (concern_bucket = $1) DESC, random()`,
      [bucket, persona, ageArg, seenDbArg],
    );

    if (rs.rows.length === 0) {
      return { questions: pickQuestions(category, persona, constructKey, staticAgeRange), source: 'static_fallback' };
    }

    // Cap to the UX target. Primary-bucket rows are floated first (the ORDER BY
    // above), and the random tie-break keeps successive analyses of the same
    // concern from always returning the identical fixed set.
    return {
      questions: rs.rows.slice(0, CLARITY_TARGET).map((row) => ({
        id:       `aqb_${row.id}`,
        question: row.question_text,
        // STANDARD_CHOICE_OPTIONS ("Yes, often / Sometimes / Rarely or never")
        // is a one-dimensional frequency scale — tag it so the clarify UI routes
        // it to single-select tap-to-submit, not rank-by-importance.
        response_type: 'frequency',
        options:  [...STANDARD_CHOICE_OPTIONS],
      })),
      source: 'adaptive_bank',
    };
  } catch (err) {
    console.error('[pickQuestionsFromDB] fallback to static:', err);
    return { questions: pickQuestions(category, persona, constructKey, staticAgeRange), source: 'static_fallback' };
  }
}

// ─── Ontology-Curated Question Picker (Tier 1.5) ─────────────────────────────
// Queries ont_assessment_questions via the concern→indicator→question join path.
// Uses concern_name (ILIKE against ont_concerns.name) so it only fires when an
// exact ontology concern exists; returns empty array otherwise (never-throws).
// Seen-id prefix for this tier is `ont_<code>` — stripped when filtering.
async function pickQuestionsFromOntology(
  pool: Pool | null | undefined,
  concernName: string,
  seenIds?: string[] | null,
): Promise<CQ> {
  if (!pool || !concernName?.trim()) return [];
  try {
    const seenCodes = (seenIds || [])
      .map(s => /^ont_(.+)$/.exec(String(s)))
      .filter((m): m is RegExpExecArray => m !== null)
      .map(m => m[1]);
    const bridgeTag = concernName.trim().toUpperCase().replace(/\s+/g, '_');
    const { rows } = await pool.query<{
      id: string; question: string; options: string[] | null;
      response_format: string; age_band_min: number | null; age_band_max: number | null;
    }>(
      `SELECT DISTINCT ON (q.id)
              q.code AS id, q.stem AS question, q.response_format,
              q.age_band_min, q.age_band_max,
              (SELECT array_agg(o.option_text ORDER BY o.sort_order)
                 FROM ont_question_options o WHERE o.question_id = q.id) AS options
         FROM ont_assessment_questions q
         JOIN map_indicator_question miq ON miq.question_id = q.id
         JOIN ont_indicators ind        ON ind.id = miq.indicator_id
         JOIN map_concern_indicator mci ON mci.indicator_id = ind.id
         JOIN ont_concerns c            ON c.id = mci.concern_id
        WHERE (c.name ILIKE $1 OR c.concern_bridge_tag = $2)
          AND q.status   = 'published'
          AND q.is_active = true
          AND ($3::text[] IS NULL OR q.code <> ALL($3::text[]))
        ORDER BY q.id, mci.weight DESC
        LIMIT ${CLARITY_TARGET}`,
      [
        `%${concernName.trim()}%`,
        bridgeTag,
        seenCodes.length ? seenCodes : null,
      ],
    );
    return rows.map(r => ({
      id:            `ont_${r.id}`,
      question:      r.question,
      options:       Array.isArray(r.options) && r.options.length > 0
                       ? r.options
                       : ['Never', 'Sometimes', 'Often', 'Almost always'],
      response_type: r.response_format,
      ...(r.age_band_min != null ? { ageMin: r.age_band_min } : {}),
      ...(r.age_band_max != null ? { ageMax: r.age_band_max } : {}),
    }));
  } catch {
    return [];
  }
}

// ─── Pre-fill Inference ────────────────────────────────────────────────────────
// Maps known answers from persona + age so users don't repeat info they already gave.
function inferPrefillAnswers(questions: CQ, persona: string, age?: number): Record<number, string> {
  const prefill: Record<number, string> = {};
  if (!age || age < 1) return prefill;

  questions.forEach((q, idx) => {
    // Professional: career stage → infer from age (must exactly match option text above)
    if (q.id === 'pro_career_stage') {
      if (age < 26)      prefill[idx] = 'Early stage — still building, the foundation feels uncertain';
      else if (age < 38) prefill[idx] = 'Mid-career — I have achieved things but something feels hollow or stuck';
      else if (age < 52) prefill[idx] = 'Considering a big change — I cannot keep doing what I am doing';
      else               prefill[idx] = 'Senior level — I have the position but I am questioning all of it';
    }
    // Campus: journey stage → infer from age (must exactly match option text above)
    if (q.id === 'campus_career_stage') {
      if (age < 20)       prefill[idx] = 'First or second year — still figuring out if I am in the right place';
      else if (age < 21)  prefill[idx] = 'Pre-final year — placement pressure is building and I am not ready';
      else if (age <= 23) prefill[idx] = 'Final year — placements are here and I feel underprepared';
      else                prefill[idx] = 'Just graduated — out of college but still searching for direction';
    }
    // Base career stage for student / jobseeker personas (must exactly match option text above)
    if (q.id === 'career_stage') {
      if (persona === 'student')   prefill[idx] = 'Still figuring out what I actually want from a career';
      if (persona === 'jobseeker') prefill[idx] = 'I know what I want but have no clear path to get there';
    }
  });

  return prefill;
}

// ─── Growth Readiness ─────────────────────────────────────────────────────────
function estimateGrowthReadiness(severity: string, category: string): string {
  if (severity === 'high') return 'moderate';
  if (severity === 'low') return 'high';
  const highGrowth = ['behavioural', 'academic', 'career'];
  return highGrowth.includes(category) ? 'high' : 'moderate';
}

// ─── Risk Level ───────────────────────────────────────────────────────────────
function estimateRiskLevel(severity: string, category: string): string {
  if (severity === 'high') return 'elevated';
  if (category === 'emotional' && severity === 'moderate') return 'moderate';
  return 'low';
}

// ─── Proxy perspective rewrite (2026-05-29) ───────────────────────────────────
// Clarity questions are authored in self-report second person ("how confident
// are you that you can…"). In proxy mode (a parent / teacher / counsellor
// assessing someone else) that reads wrong — the rater is reporting ON the
// subject, not about themselves. We rewrite the question to refer to the
// assessed person in the third person: the FIRST inverted auxiliary
// ("are you" → "is <subject>") names the subject, and every later reference
// falls back to gender-neutral "they/their/them" so we don't repeat the noun.
// Question ids and options are never touched, so scoring + Likert routing are
// unaffected.
// proxySubjectNoun + rephraseForProxy now live in the hardened pure module
// `../services/proxy-language-engine` (imported above). It removes the Phase-1
// audit runtime defects (mid-sentence subject injection, double substitution,
// broken subject-verb agreement, embedded first-person fragments) and is unit-
// tested in `backend/tests/proxy-language-engine.test.ts`.

// ─── Seen-question exclusion + variety shuffle (2026-05-29) ───────────────────
// Schema-safe and fully in-memory (no migration, no table-shape change). The
// client may pass an array of clarity-question ids the user has already seen
// (from session state) so the same question never repeats within the funnel.
// We exclude those ids, then Fisher–Yates shuffle the eligible pool so
// successive runs surface a different, still-relevant slice instead of always
// re-serving the leading items. Applied UNIFORMLY across all three picker tiers
// (master / adaptive / static). Options are left untouched (still `string[]`,
// matching the frontend `handleClarifyAnswer` contract). If exclusion would
// empty the pool we keep the unfiltered (still shuffled) set so the clarify
// phase never stalls.
function applySeenFilterAndShuffle(questions: CQ, seenIds?: string[] | null): CQ {
  const shuffle = (arr: CQ): CQ => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  if (!Array.isArray(questions) || questions.length === 0) return questions;
  const seen = new Set(
    (seenIds || [])
      .filter(id => typeof id === 'string')
      .map(id => id.trim())
      .filter(id => id.length > 0),
  );
  if (seen.size === 0) return shuffle(questions);
  const filtered = questions.filter(q => !seen.has(String(q.id).trim()));
  return shuffle(filtered.length > 0 ? filtered : questions);
}

// ─── Main Analysis Function ───────────────────────────────────────────────────
// ─── Concern-derived preliminary patterns (2026-05-29) ───────────────────────
// The bridge phase ("What's already visible about you") renders BEFORE any
// scored question, so no telemetry/linguistic signal exists yet. Rather than the
// generic per-category PATTERNS array (identical for every concern in a
// category), derive distinct, concern-specific descriptors from the resolved
// master row's own curated metadata. Developmental signals only — no clinical
// language, no hiring/suitability claims.
const ROUTING_PLACEHOLDER = 'UNASSIGNED_ROUTING_NODE';

interface MasterConcernMeta {
  domain: string | null;
  concern_cluster: string | null;
  concern_category: string | null;
  assessment_dimension: string | null;
  signal_cluster: string | null;
  intelligence_layer: string | null;
  display_label: string | null;
  primary_persona: string | null;
}

function cleanMetaValue(v?: string | null): string | null {
  const t = (v || '').trim();
  if (!t || t.toUpperCase() === ROUTING_PLACEHOLDER) return null;
  return t;
}

// Case-insensitive dedupe that preserves order and first-seen casing.
function dedupePreserve(items: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const v = (raw || '').trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

// Language policy guarantee: bridge patterns/tags are developmental signals
// only — clinical/diagnostic vocabulary must never surface, regardless of what
// the master-table data contains. Allowed developmental terms (e.g. "anxiety",
// "stress") are deliberately NOT listed; only clearly clinical words are.
const CLINICAL_TERMS = /\b(severe|acute|chronic|clinical|disorder|diagnos\w*|patholog\w*|syndrome|psychiatric|dysfunction|comorbid|illness)\b/i;
function isPolicySafe(s: string): boolean {
  return !CLINICAL_TERMS.test(s);
}

// "Focus Drift & Fatigue Signals" → ["Focus Drift", "Fatigue"]
function splitSignalCluster(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/\s*(?:&|\/|,|\band\b)\s*/i)
    .map((s) => s.replace(/\bsignals?\b/gi, '').trim())
    .filter(Boolean);
}

async function fetchMasterConcernMeta(pool: Pool, concernId: string): Promise<MasterConcernMeta | null> {
  try {
    const { rows } = await pool.query(
      `SELECT domain, concern_cluster, concern_category, assessment_dimension,
              signal_cluster, intelligence_layer, display_label, primary_persona
         FROM capadex_concerns_master
        WHERE concern_id = $1
        LIMIT 1`,
      [concernId],
    );
    return rows[0] || null;
  } catch (err) {
    console.error('[fetchMasterConcernMeta]', err);
    return null;
  }
}

function buildPreliminaryPatterns(
  meta: MasterConcernMeta,
  rulesKey: string,
  regexSignals: string[],
): { patterns: string[]; tags: string[] } {
  // Patterns: the concern's own curated descriptors, most specific first.
  const patternCandidates = dedupePreserve([
    cleanMetaValue(meta.concern_category),
    cleanMetaValue(meta.assessment_dimension),
    cleanMetaValue(meta.intelligence_layer),
    cleanMetaValue(meta.display_label),
    cleanMetaValue(meta.domain),
  ]).filter(isPolicySafe);
  const fallbackPatterns = PATTERNS[rulesKey] || PATTERNS.general;
  const patterns = dedupePreserve([...patternCandidates, ...fallbackPatterns]).slice(0, 3);

  // Tags: the concern's signal cluster reads as live behavioural cues; top up
  // with regex-detected emotional cues so the chip row is never empty.
  const tags = dedupePreserve([
    ...splitSignalCluster(cleanMetaValue(meta.signal_cluster)),
    ...regexSignals,
  ]).filter(isPolicySafe).slice(0, 3);

  return { patterns, tags };
}

async function analyzeConcern(
  text: string,
  suppliedPersona?: string,
  age?: number,
  pool?: Pool | null,
  masterConcernId?: string | null,
  ageBand?: string | null,
  primaryPersona?: string | null,
  isProxy?: boolean | null,
  assesseeName?: string | null,
  seenIds?: string[] | null,
) {
  const { category, construct_key, construct_label } = detectCategory(text);
  // Primary: route rule selection through the construct key.
  // Fallback: legacy category (only reached for free-text with no construct match).
  const rulesKey = (construct_key && CONSTRUCT_TO_RULES_KEY[construct_key]) || category;
  const severity        = detectSeverity(text);
  let emotional_signals    = detectEmotionalSignals(text, rulesKey);
  const persona_detected   = detectPersona(text, suppliedPersona);
  let detected_patterns    = PATTERNS[rulesKey]       || PATTERNS.general;
  const subdomains         = (SUBDOMAINS[rulesKey]    || SUBDOMAINS.general).slice(0, 3);
  // ── Clarity-question routing (2026-05-28) ──────────────────────────────
  // Priority order:
  //   1. Master-table join — when the client supplied a canonical concern_id
  //      from the 2,488-row taxonomy, fetch curated rows from
  //      `capadex_clarity_questions` via `master_bridge_tag = relational_bridge_tag`.
  //      Only ~55 of 327 master buckets have curated rows today, so this path
  //      degrades gracefully when no rows exist.
  //   2. `adaptive_question_bank` keyed on construct/category (legacy).
  //   3. Static `pickQuestions` (offline / DB-failure safety net).
  // `clarity_source` is surfaced in the response so the frontend can label
  // the clarify phase honestly ("Tailored to your concern" vs "General
  // behavioural cluster") instead of silently showing generic questions.
  let clarification_questions: CQ = [];
  let clarity_source: 'master_curated' | 'ontology_curated' | 'adaptive_bank' | 'static_fallback' = 'static_fallback';
  if (masterConcernId && pool) {
    clarification_questions = await pickQuestionsFromMaster(pool, masterConcernId, ageBandToRange(ageBand, age), personaCohortFor(primaryPersona), seenIds, { age: Number.isFinite(age as number) ? Number(age) : null, primaryPersona: primaryPersona ?? null });
    if (clarification_questions.length > 0) clarity_source = 'master_curated';
  }
  // Tier 1.5 — Ontology-curated: check ont_assessment_questions linked to this
  // concern via the concern→indicator→question join path. Fires only when an
  // ont_concerns row exists for this concern name; returns empty otherwise.
  // Never-throws: if the tables don't exist yet, falls through silently.
  if (clarification_questions.length === 0) {
    const ontRows = await pickQuestionsFromOntology(pool, text, seenIds);
    if (ontRows.length > 0) {
      clarification_questions = ontRows;
      clarity_source = 'ontology_curated';
    }
  }
  if (clarification_questions.length === 0) {
    // pickQuestionsFromDB now returns `{questions, source}` so `clarity_source`
    // truthfully distinguishes `adaptive_bank` (DB-backed) from
    // `static_fallback` (offline / no pool / no rows / DB error). This was a
    // code-review finding — previously we conflated both into 'adaptive_bank'.
    const dbResult = await pickQuestionsFromDB(pool, rulesKey, persona_detected, construct_key, age, seenIds);
    clarification_questions = dbResult.questions;
    clarity_source = dbResult.source;
  }
  // Exclude already-seen questions and shuffle the eligible pool for run-to-run
  // variety. Applied uniformly across whichever tier produced the pool; options
  // stay `string[]`. (No-op when the client sends no seen ids beyond a shuffle.)
  clarification_questions = applySeenFilterAndShuffle(clarification_questions, seenIds);
  // Proxy reframe: a parent/teacher/counsellor answers ABOUT the assessed
  // person, so flip the self-report second person to third person about them.
  if (isProxy) {
    const subject = proxySubjectNoun(primaryPersona, assesseeName);
    clarification_questions = clarification_questions.map((q) => ({
      ...q,
      question: rephraseForProxy(q.question, subject),
    }));
  }
  // Concern-derived "what's already visible" — override the generic per-category
  // arrays with the resolved master concern's own curated descriptors so each
  // concern shows distinct, relevant patterns/tags. Falls back to the category
  // defaults when no master concern resolved, so the card never renders empty.
  let preliminary_source: 'concern_derived' | 'category_default' = 'category_default';
  if (masterConcernId && pool) {
    const meta = await fetchMasterConcernMeta(pool, masterConcernId);
    if (meta) {
      const built = buildPreliminaryPatterns(meta, rulesKey, emotional_signals);
      if (built.patterns.length > 0) {
        detected_patterns  = built.patterns;
        emotional_signals  = built.tags;
        preliminary_source = 'concern_derived';
      }
    }
  }
  const preliminary_patterns = {
    patterns: detected_patterns,
    tags: emotional_signals,
    source: preliminary_source,
  };

  const behavioural_mirror = MIRROR_TEMPLATES[rulesKey] || MIRROR_TEMPLATES.general;
  const intelligence_preview = buildPersonalizedPreview(rulesKey, detected_patterns);
  const growth_readiness   = estimateGrowthReadiness(severity, rulesKey);
  const risk_level         = estimateRiskLevel(severity, rulesKey);
  const prefilled_answers  = inferPrefillAnswers(clarification_questions, persona_detected, age);

  // Severity labels
  const severityLabel = severity === 'high' ? 'High' : severity === 'low' ? 'Low' : 'Moderate';

  // ── Hypothesis-driven clarity (Phase 0B, behind config flag) ──────────────
  // Default OFF → this block is skipped entirely and the response is
  // byte-identical to historical behaviour. When ON, additively attach a
  // pure (no-DB-write) hypothesis investigation envelope: the ranked
  // hypotheses for this concern, each with its confidence band, plus a
  // governance role describing how to investigate it next. Wrapped so a
  // failure here can never break /analyze.
  let hypothesisEnvelope: Record<string, unknown> = {};
  if (isHypothesisDrivenClarityEnabled()) {
    try {
      const raw = buildHypotheses({
        sessionId:    '',
        concernText:  text,
        constructKey: construct_key || undefined,
      });
      const hypotheses = raw.map(h => {
        const band = confidenceBand(h.confidence);
        const { role, rationale } = classifyGovernance({
          targetConstruct:    h.construct_key,
          band,
          relevance:          h.confidence,
          contradictionProbe: 0,
          confidenceGain:     h.uncertainty,
        });
        return {
          construct_key:   h.construct_key,
          label:           h.label,
          confidence:      h.confidence,
          confidence_band: band,
          uncertainty:     h.uncertainty,
          lifecycle_state: h.lifecycle_state,
          governance_role:      role,
          governance_rationale: rationale,
        };
      });
      hypothesisEnvelope = {
        hypotheses,
        hypothesis_investigation: {
          flag_active:    true,
          generated_at:   new Date().toISOString(),
          construct_key:  construct_key || null,
          hypothesis_count: hypotheses.length,
          top_hypothesis: hypotheses[0] ?? null,
        },
      };
    } catch (err) {
      console.error('[capadex-concern-intelligence] hypothesis envelope error:', err);
    }
  }

  // ── WC-3 L4 Personalization Wiring (Phase A, behind flag) ─────────────────
  // Default OFF → this block is skipped entirely and the response is
  // byte-identical to historical behaviour. When ON, additively attach a
  // `personalization` provenance envelope + `personalized:true` marker
  // describing the dimensions that were available for personalization, and
  // fire-and-forget record the decision. Phase A is WIRING + OBSERVABILITY
  // ONLY — it NEVER re-orders or changes which questions are selected. Wrapped
  // so a failure here can never break /analyze.
  let personalizationEnvelope: Record<string, unknown> = {};
  if (isWc3PersonalizationEnabled()) {
    try {
      const { buildPersonalizationEnvelope, logPersonalizationDecision } = await import('../services/wc3/personalization-wiring');
      const pctx = {
        masterConcernId: masterConcernId ?? null,
        constructKey: construct_key ?? null,
        claritySource: clarity_source,
        age: Number.isFinite(age as number) ? Number(age) : null,
        ageBand: ageBand ?? null,
        primaryPersona: primaryPersona ?? persona_detected ?? null,
        isProxy: isProxy ?? null,
        severity,
        questionCount: clarification_questions.length,
      };
      personalizationEnvelope = buildPersonalizationEnvelope(pctx);
      if (pool) void logPersonalizationDecision(pool, pctx);
    } catch (err) {
      console.error('[capadex-concern-intelligence] personalization envelope error:', err);
    }
  }

  return {
    category,
    construct_key,
    construct_label,
    severity,
    severity_label: severityLabel,
    risk_level,
    growth_readiness,
    emotional_signals,
    detected_patterns,
    preliminary_patterns,
    subdomains,
    clarification_questions,
    clarity_source,
    behavioural_mirror,
    intelligence_preview,
    persona_detected,
    prefilled_answers,
    ...hypothesisEnvelope,
    ...personalizationEnvelope,
  };
}

// ─── Master-curated clarity picker (2026-05-28) ───────────────────────────────
// Resolves a master `concern_id` → its `relational_bridge_tag` → rows in
// `capadex_clarity_questions` sharing that tag. Caps at 3 (matches the
// clarify-phase UX of 3 questions per concern). Returns [] on DB error /
// unknown id / under-quota result so the caller cascades cleanly to Tier 2.
//
// Join condition is case-insensitive AND whitespace-trimmed on both sides
// because the import pipelines for the two tables came from different CSV
// authors — a handful of bridge tags ship with trailing spaces or mixed
// case and would silently miss the equality join. The `LOWER(TRIM(...))` on
// each side makes the picker robust to that data-quality drift without
// requiring a backfill migration.
//
// Quota guard: we pull a wide pool (LIMIT 40) ordered by weight with a random
// tie-break so that (a) after per-row option validation we still clear the
// `>= 2 valid questions` cascade threshold, (b) we can surface up to the UX cap
// of CLARITY_TARGET questions, and (c) successive analyses of the same concern
// vary which questions appear instead of always returning the same fixed set.
// Canonical 5-bracket age-band → numeric [min, max] interval. Mirrors the
// IntroPhase AGE_BANDS canon; `45+` widens to an open-ended upper bound so the
// senior cohort overlaps every age-scoped master row at or above 45. Used to
// turn the user's selected band into an interval for the master-curated age
// filter. Falls back to a [age, age] point when only a numeric age is known.
const AGE_BAND_RANGE: Record<string, [number, number]> = {
  '6-14':  [6, 14],
  '14-17': [14, 17],
  '17-24': [17, 24],
  '24-45': [24, 45],
  '45+':   [45, 200],
};
function ageBandToRange(ageBand?: string | null, age?: number | null): [number, number] | null {
  if (ageBand) {
    const norm = String(ageBand).replace(/[\u2010-\u2015\u2212]/g, '-').trim();
    if (AGE_BAND_RANGE[norm]) return AGE_BAND_RANGE[norm];
  }
  if (Number.isFinite(age as number)) return [Number(age), Number(age)];
  return null;
}

// ─── Orphan bridge-tag → covered-tag resolver ────────────────────────────────
// The resolver constants (COVERED_BRIDGE_TAGS, ORPHAN_BRIDGE_TAG_FALLBACK,
// BRIDGE_TAG_KEYWORD_RULES) and `resolveCoveredBridgeTag` now live in the shared
// module `services/bridge-tag-resolver.ts` so the production picker and the
// read-only coverage tooling share ONE source of truth (no drift). Behaviour is
// unchanged. See that module for the resolution order and the sibling overrides
// that retire GENERAL_CONCERN for the previously-orphaned tags.

// WC-7B Tier A — Runtime Intelligence Consumption helper. Re-orders an ALREADY
// SELECTED clarity batch (each item id `mcq_<clarityId>`) by the derived-but-unconsumed
// WC-3 L5A stage intelligence + L5B context intelligence. Read-only, additive,
// never-throws: any lookup miss / error returns the input order unchanged. Selection is
// never altered (same rows, same count) — only display order. Gated by the caller on
// isRuntimeIntelligenceConsumptionEnabled().
const WC3_STAGE_RANK: Record<string, number> = {
  Awareness: 0, Curiosity: 1, Clarity: 2, Growth: 3, Mastery: 4,
};
// L5B `relevance_risk` is a TEXT band (NONE/LOW/MEDIUM/HIGH), not numeric — map it to a
// small penalty comparable to the 0..1 context_confidence scale. Unknown → 0 (neutral).
const WC3_RELEVANCE_RISK_PENALTY: Record<string, number> = {
  NONE: 0, LOW: 0.1, MEDIUM: 0.2, HIGH: 0.3,
};
async function applyRuntimeIntelligenceConsumption<T extends { id: string }>(
  pool: Pool,
  chosen: T[],
): Promise<T[]> {
  try {
    const ids = chosen
      .map(q => /^mcq_(\d+)$/.exec(String(q.id)))
      .filter((m): m is RegExpExecArray => m !== null)
      .map(m => Number(m[1]))
      .filter(n => Number.isFinite(n));
    if (ids.length === 0) return chosen;
    // L5A stage progression + L5B context quality, joined by clarity row id. Both
    // tables are derived sidecars (no FK into the question set); a missing row leaves
    // that question with neutral signals so it keeps its prior relative position.
    const { rows } = await pool.query<{
      clarity_id: number;
      primary_stage: string | null;
      stage_confidence: number | null;
      context_confidence: number | null;
      relevance_risk: number | null;
    }>(
      `SELECT qi.clarity_id,
              qi.primary_stage,
              qi.stage_confidence,
              qc.context_confidence,
              qc.relevance_risk
         FROM wc3_question_intelligence qi
         FULL OUTER JOIN wc3_question_context qc ON qc.clarity_id = qi.clarity_id
        WHERE COALESCE(qi.clarity_id, qc.clarity_id) = ANY($1::int[])`,
      [ids],
    );
    if (rows.length === 0) return chosen; // intelligence not built → unchanged
    const byId = new Map<number, typeof rows[number]>();
    for (const r of rows) {
      const cid = (r.clarity_id ?? null) as number | null;
      if (cid != null) byId.set(Number(cid), r);
    }
    const stageOf = (q: T): number => {
      const m = /^mcq_(\d+)$/.exec(String(q.id));
      const meta = m ? byId.get(Number(m[1])) : undefined;
      const stage = meta?.primary_stage ?? '';
      return stage in WC3_STAGE_RANK ? WC3_STAGE_RANK[stage] : 99; // unknown → last
    };
    // Context quality tiebreak: higher context confidence, lower relevance risk first.
    const qualityOf = (q: T): number => {
      const m = /^mcq_(\d+)$/.exec(String(q.id));
      const meta = m ? byId.get(Number(m[1])) : undefined;
      const cc = Number(meta?.context_confidence ?? 0);
      const riskBand = String(meta?.relevance_risk ?? '').toUpperCase();
      const rr = WC3_RELEVANCE_RISK_PENALTY[riskBand] ?? 0;
      return cc - rr;
    };
    return chosen
      .map((q, i) => ({ q, i }))
      .sort((a, b) =>
        stageOf(a.q) - stageOf(b.q) ||
        qualityOf(b.q) - qualityOf(a.q) ||
        a.i - b.i, // stable: preserve prior order on full ties
      )
      .map(({ q }) => q);
  } catch (err) {
    console.error('[clarity-picker] runtime-intelligence consumption re-rank failed (continuing):', err);
    return chosen;
  }
}

async function pickQuestionsFromMaster(
  pool: Pool,
  concernId: string,
  ageRange?: [number, number] | null,
  personaCohort?: string[] | null,
  seenIds?: string[] | null,
  metaUser?: { age: number | null; primaryPersona: string | null } | null,
): Promise<CQ> {
  try {
    // AQ-2R — Runtime Metadata Activation (flag-gated, ADDITIVE re-rank only).
    // When ON, each clarity row is LEFT-JOINed to its AQ-2 per-question metadata
    // (`capadex_question_metadata`) and the curated pool is re-ranked to prefer
    // age-matched, persona-matched, high-signal-confidence, construct-bearing
    // questions, then the final batch is ordered by development stage. Flag OFF →
    // no join, no score, no re-rank → byte-identical legacy ordering. Rows with no
    // metadata (join miss) score 0 and sort last but are never dropped.
    const metaActive = isRuntimeMetadataActivationEnabled();
    // WC-7B Tier A — Runtime Intelligence Consumption (flag-gated, ADDITIVE display
    // re-rank only). When ON, the FINAL selected batch is re-ordered by the
    // derived-but-unconsumed WC-3 L5A question stage intelligence
    // (`wc3_question_intelligence`) + L5B question context (`wc3_question_context`),
    // looked up by clarity row id. Selection is NEVER changed (same rows, same count)
    // — only display order. Flag OFF → helper is never called → byte-identical legacy
    // ordering. Lookup miss / error → original order preserved (never throws).
    const consumeActive = isRuntimeIntelligenceConsumptionEnabled();
    const metaCtx: MetadataContext = {
      age: metaUser?.age ?? (ageRange ? Math.round((ageRange[0] + ageRange[1]) / 2) : null),
      ageBand: ageBandForAge(metaUser?.age ?? (ageRange ? Math.round((ageRange[0] + ageRange[1]) / 2) : null)),
      canonicalPersona: canonicalPersonaFor(metaUser?.primaryPersona ?? null),
    };
    // ── Age-band filter (2026-05-29, fixed 2026-06-01) ─────────────────────
    // Clarity-question rows carry no age column of their own; their applicable
    // age range is inherited from the master concern FAMILY they belong to. We
    // recover that range by joining each clarity question back to
    // `capadex_concerns_master` ON the SHARED BRIDGE TAG
    // (LOWER(TRIM(a.relational_bridge_tag)) = LOWER(TRIM(q.master_bridge_tag)))
    // and keep ONLY questions whose family has an age-scoped master row that
    // overlaps the user's band (numeric interval overlap: qmin <= bandMax AND
    // qmax >= bandMin — the same convention IntroPhase.parseAgeRange uses).
    //
    // IMPORTANT (2026-06-01 fix): the join was previously
    // `concern_cluster = q.concern`. `concern_cluster` is NOT a unique key and
    // is re-used verbatim across unrelated concerns spanning different personas
    // and age bands (the two source CSVs were authored independently). That made
    // the join land on an ARBITRARY cross-tag twin master row — e.g. every
    // TRANSITION_READINESS clarity row (student "graduating without a plan",
    // age 15-30) resolved its age/persona from a "Mid-Career Professional"
    // (age 30-55) row that merely shared a cluster string — so a 17-24 student
    // got ZERO survivors and silently fell to the generic static fallback (the
    // reported "irrelevant + repeating" clarify questions). Anchoring on the
    // bridge tag ties eligibility to the correct concern family.
    //
    // When no age band is known (anon/age-less caller) the filter is skipped.
    // Under-fill cascades to Tier-2/Tier-3, so the assessment never stalls.
    // ── Persona filter (2026-05-29, anchored 2026-06-01) ───────────────────
    // A single coarse bridge tag (only ~56 distinct buckets) is shared by many
    // master concerns spanning multiple personas — e.g. EXAMINATION_STRESS
    // carries student exam-anxiety AND workplace-stress questions. We prefer
    // questions whose bridge-tag family contains a master row in the user's
    // persona cohort (same bridge-tag anchor as the age filter; snake-case
    // normalised like the free-text resolver). This is a SOFT preference — see
    // the persona-relaxed retry below — because ~63% of families carry only
    // provider/lens personas in the master taxonomy, so a hard persona gate
    // would dead-end most concerns to the static fallback. Cross-persona age
    // leakage is already guarded by the (hard) age filter above.
    const bandMin = ageRange ? ageRange[0] : null;
    const bandMax = ageRange ? ageRange[1] : null;
    const cohort = personaCohort && personaCohort.length > 0 ? personaCohort : null;
    // Already-seen exclusion (2026-05-29): client-persisted seen ids are prefixed
    // (`mcq_<q.id>` for this tier). Strip to the numeric clarity-row id and
    // exclude in SQL so the unseen rows are drawn BEFORE the top-40 / shuffle /
    // CLARITY_TARGET slice — otherwise exclusion ran only on the final 10-row
    // slice and re-served the same questions across re-runs/concerns.
    const seenMasterIds = (seenIds || [])
      .map(s => /^mcq_(\d+)$/.exec(String(s)))
      .filter((m): m is RegExpExecArray => m !== null)
      .map(m => Number(m[1]))
      .filter(n => Number.isFinite(n));
    const seenMasterArg = seenMasterIds.length > 0 ? seenMasterIds : null;

    // Resolve the concern's own bridge tag up front so we can (a) query clarity
    // rows by tag and (b) detect when that tag is an orphan with no coverage and
    // borrow from a topically-adjacent tag (ORPHAN_BRIDGE_TAG_FALLBACK).
    const tagRes = await pool.query<{
      relational_bridge_tag: string | null;
      display_label: string | null;
      concern_cluster: string | null;
    }>(
      `SELECT relational_bridge_tag, display_label, concern_cluster
         FROM capadex_concerns_master WHERE concern_id = $1 LIMIT 1`,
      [concernId],
    );
    const ownTag = (tagRes.rows[0]?.relational_bridge_tag || '').trim();
    if (!ownTag) return [];
    // Topical match-stems for THIS specific concern (see conceptStemsFromConcern):
    // used to SOFT-rank clarity rows within the (coarse) bridge-tag pool so the
    // ones about this concern's actual subject surface first. Empty array → the
    // relevance score is uniformly 0 and ordering is byte-identical to before.
    const conceptStems = conceptStemsFromConcern(
      tagRes.rows[0]?.display_label,
      tagRes.rows[0]?.concern_cluster,
    );
    // WC-1B-R Phase 4 — grounded ranking nudge (flag-gated, ADDITIVE re-rank only).
    // Append the tag's grounded family/signal vocabulary to this concern's topical
    // stems so clarity rows mentioning grounded vocab surface first. Same question
    // SET + same content — only the `relevance` count (hence ordering) shifts.
    // Flag OFF / ungrounded tag → conceptStems unchanged → byte-identical ordering.
    if (isSignalGroundingRuntimeEnabled() && ownTag) {
      try {
        const groundedTokens = await loadGroundedRankTokens(pool, ownTag, 8);
        for (const tok of groundedTokens) {
          if (!conceptStems.includes(tok)) conceptStems.push(tok);
        }
      } catch (gErr) {
        console.error('[clarity-picker] grounded rank-token nudge failed (continuing):', gErr);
      }
    }
    const conceptArg = conceptStems.length > 0 ? conceptStems : null;
    // If the concern's OWN subject is work/career themed (e.g. a youth
    // career-guidance concern), the youth adult-work demotion below must NOT
    // fire — those very words are on-topic here, so demoting them would bury the
    // most relevant rows. The demotion only guards OFF-topic adult leakage.
    const conceptIsWorkThemed = conceptStems.some(s =>
      /career|profession|workplace|execut|office|corporat|employ|manager|colleag/.test(s),
    );

    // ── Precise concern → clarity sub-topic mapping (2026-06-01) ───────────────
    // ROOT-CAUSE fix for "irrelevant + repeating" clarify questions. The coarse
    // bridge tag (~56 buckets) pools clarity rows for MANY distinct concerns; per
    // request relevance ranking on each QUESTION's prose (above) could never catch
    // a sub-topic question whose individual wording lacks the keyword. The
    // offline-computed `capadex_concern_clarity_map` links THIS master concern to
    // the curated clarity `concern` sub-topic LABEL(s) it actually owns (matched
    // once, reviewable, orphans flagged — see services/concern-clarity-mapping-
    // engine.ts). When a mapping exists we RESTRICT the pool to those sub-topics,
    // which pulls in ALL of a sub-topic's questions and zero sibling-concern noise.
    // Graceful: missing table (fresh env pre-seed) / no mapping / orphan-only →
    // `mappedConcerns` stays null and every runByTag below is byte-identical to the
    // pre-mapping whole-tag picker. Never throws into /analyze.
    let mappedConcerns: string[] | null = null;
    try {
      const mapRes = await pool.query<{ clarity_concern: string }>(
        `SELECT clarity_concern FROM capadex_concern_clarity_map
          WHERE master_concern_id = $1 AND match_method <> 'orphan'`,
        [concernId],
      );
      const texts = mapRes.rows
        .map(r => (r.clarity_concern || '').trim().toLowerCase())
        .filter(s => s.length > 0);
      if (texts.length > 0) mappedConcerns = texts;
    } catch {
      mappedConcerns = null;
    }

    // Pulls clarity rows for one bridge tag, applying the age filter always and
    // the persona filter only when `applyPersona` is true. The fallback retry
    // relaxes persona because the adjacent tag's persona pool differs by design
    // (e.g. CAREER_GROWTH = professional personas, no Job Seeker) — its
    // career-change questions still read correctly for someone re-entering the
    // workforce, and the age filter keeps them age-appropriate.
    const runByTag = async (
      bridgeTag: string,
      applyPersona: boolean,
      restrictConcerns: string[] | null = null,
    ): Promise<CQ> => {
      const personaParam = applyPersona ? cohort : null;
      // AQ-2R: when active, bring the per-question metadata columns alongside the
      // candidate rows via a LEFT JOIN on question_id. Flag OFF → both fragments
      // are empty strings → the SQL is byte-identical to the legacy query and the
      // candidate set is drawn identically.
      const metaCols = metaActive ? `,\n                ${META_SELECT_COLS}` : '';
      const metaJoin = metaActive ? `\n           ${META_JOIN}` : '';
      const rs = await pool.query<{
        id: number; question: string; response_type: string | null;
        option_a: string | null; option_b: string | null;
        option_c: string | null; option_d: string | null; option_e: string | null;
        relevance: number;
        [k: string]: any;
      }>(
        // `relevance` (NEW 2026-06-01): how many of THIS concern's topical stems
        // ($6) appear in the question text. The coarse bridge tag pools clarity
        // rows for many distinct concerns, so without this an "Academic Focus"
        // concern drew generic procrastination/exam-strategy rows from the same
        // ACADEMIC_COGNITIVE family. We surface topical matches first, then fall
        // back to family rows. $6 NULL → unnest yields no rows → relevance is
        // uniformly 0 → ordering is byte-identical to the prior behaviour.
        `SELECT q.id, q.question, q.response_type,
                q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
                (
                  SELECT COUNT(*)::int FROM unnest($6::text[]) tok
                   WHERE POSITION(tok IN LOWER(q.question)) > 0
                ) AS relevance${metaCols}
           FROM capadex_clarity_questions q${metaJoin}
          WHERE LOWER(TRIM(q.master_bridge_tag)) = LOWER(TRIM($1))
            AND q.question IS NOT NULL
            AND TRIM(q.question) <> ''
            AND (
                  $2::int IS NULL
               OR EXISTS (
                    SELECT 1 FROM capadex_concerns_master a
                     WHERE LOWER(TRIM(a.relational_bridge_tag)) = LOWER(TRIM(q.master_bridge_tag))
                       AND a.age_min IS NOT NULL AND a.age_max IS NOT NULL
                       AND a.age_min <= $3 AND a.age_max >= $2
                  )
            )
            AND (
                  $4::text[] IS NULL
               OR EXISTS (
                    SELECT 1 FROM capadex_concerns_master p
                     WHERE LOWER(TRIM(p.relational_bridge_tag)) = LOWER(TRIM(q.master_bridge_tag))
                       AND REGEXP_REPLACE(
                             LOWER(REGEXP_REPLACE(COALESCE(p.primary_persona,''),'[^a-zA-Z0-9]+','_','g')),
                             '^_|_$', '', 'g'
                           ) = ANY($4::text[])
                  )
            )
            AND ($5::int[] IS NULL OR q.id <> ALL($5::int[]))
            -- Precise concern to clarity sub-topic restriction (2026-06-01): when
            -- a mapping exists ($7), keep ONLY rows whose curated concern
            -- sub-topic was matched to THIS master concern. $7 NULL = no
            -- restriction = byte-identical to the pre-mapping whole-tag pool.
            AND ($7::text[] IS NULL OR LOWER(TRIM(q.concern)) = ANY($7::text[]))
          ORDER BY relevance DESC, q.question_weight DESC NULLS LAST, random()
          LIMIT 60`,
        [bridgeTag, bandMin, bandMax, personaParam, seenMasterArg, conceptArg, restrictConcerns],
      );
      // Per-row gate: drop any row that doesn't ship at least 2 selectable
      // options — CapadexClarifyPhase requires ≥2 to render a meaningful
      // choice; a row with 0–1 options would silently dead-end the user.
      const usable = rs.rows
        .map(r => ({
          id: `mcq_${r.id}`,
          question: r.question,
          // Every clarity row carries an ordinal/categorical scale vocabulary
          // (intensity "Slightly…Extremely", coping_effectiveness "Very
          // Ineffective…Very Effective", etc.). Token/regex heuristics cannot
          // cover all 23 vocabularies, so we forward `response_type` and let the
          // clarify UI route any scored single-select scale to tap-to-submit
          // instead of the rank-by-importance UI (which is semantically wrong
          // for a one-dimensional ordinal scale).
          response_type: r.response_type || undefined,
          options: [r.option_a, r.option_b, r.option_c, r.option_d, r.option_e]
            .filter((o): o is string => typeof o === 'string' && o.trim().length > 0),
          _rel: Number(r.relevance) || 0,
          // AQ-2R: per-question metadata + its composite match score. When the
          // flag is OFF (no join) `_meta` is null and `_metaScore` is 0, so every
          // ordering below collapses to the legacy behaviour.
          _meta: metaActive ? metaFromRow(r) : null,
          _metaScore: 0,
        }))
        .filter(q => q.options.length >= 2);
      if (metaActive) {
        for (const q of usable) q._metaScore = scoreQuestionMetadata(q._meta, metaCtx).score;
      }
      // Topical-first sampling (2026-06-01): partition into rows that matched
      // this concern's topical stems vs generic family rows, shuffle EACH so
      // successive analyses still vary (the 2026-05-29 repetition fix), then take
      // topical first and backfill with generic up to CLARITY_TARGET. When no
      // stems matched (conceptArg NULL or zero hits) every row is "generic" → the
      // behaviour collapses to the original single shuffled pool, unchanged.
      const shuffle = <T,>(arr: T[]): T[] => {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      };
      // Youth demotion (2026-06-01): the bridge tag is age-mixed at the FAMILY
      // level and clarity rows carry no per-row age/persona column, so a
      // topically-matched but adult/workplace-flavoured row (e.g. "executive
      // focus / workplace concentration") can out-rank student-framed focus rows
      // for a 14-17 user. Demote (never drop) rows with explicit adult-work
      // markers when the band is sub-24 so they only backfill the quota. Stable
      // sort after shuffle keeps within-tier variety.
      const youth = bandMax != null && bandMax < 24 && !conceptIsWorkThemed;
      const ADULT_WORK_MARKER = /\b(workplace|executive|office|corporate|colleague|colleagues|manager|managers|employee|employees|on the job|at work|career|professional|professionals)\b/i;
      const demote = (q: typeof usable[number]) => (youth && ADULT_WORK_MARKER.test(q.question) ? 1 : 0);
      // Legacy ordering: shuffle then stable youth-demotion. AQ-2R ordering: keep
      // the youth demotion (outermost), then prefer higher metadata match score;
      // shuffle first so equal-score rows still vary run-to-run. Flag OFF →
      // `_metaScore` is uniformly 0, so this collapses to the legacy sort.
      const orderTier = (arr: typeof usable) =>
        metaActive
          ? shuffle(arr).sort((a, b) => demote(a) - demote(b) || b._metaScore - a._metaScore)
          : shuffle(arr).sort((a, b) => demote(a) - demote(b));
      const topical = orderTier(usable.filter(q => q._rel > 0));
      const generic = orderTier(usable.filter(q => q._rel === 0));
      let chosen = [...topical, ...generic].slice(0, CLARITY_TARGET);
      // Phase 4 — development-stage progression: order the FINAL selected batch
      // Awareness → Curiosity → Clarity → Growth → Mastery so the clarify flow
      // builds naturally. Stable: ties (incl. no-stage rows, ranked last) keep the
      // relevance/meta order above. Selection is unchanged — only display order.
      if (metaActive) {
        chosen = chosen
          .map((q, i) => ({ q, i }))
          .sort((a, b) => stageRank(a.q._meta?.dev_stage) - stageRank(b.q._meta?.dev_stage) || a.i - b.i)
          .map(({ q }) => q);
      }
      // WC-7B Tier A — consume L5A/L5B intelligence: additive FINAL display re-rank.
      // Runs last (most accurate per-question stage), only reorders, never throws.
      if (consumeActive && chosen.length > 1) {
        chosen = await applyRuntimeIntelligenceConsumption(pool, chosen);
      }
      return chosen.map(({ _rel, _meta, _metaScore, ...q }) => q);
    };

    // Primary attempt: the concern's own bridge tag, persona-filtered, RESTRICTED
    // to the precise mapped clarity sub-topic(s) when a mapping exists. When no
    // mapping (mappedConcerns null) this is byte-identical to the prior behaviour.
    let valid = await runByTag(ownTag, true, mappedConcerns);

    // Persona-relaxed retry on the OWN tag (2026-06-01): the persona filter
    // checks whether the question's bridge-tag family contains a master row in
    // the user's persona cohort. But ~63% of bridge-tag families (207/328) carry
    // ONLY provider/lens personas in the master taxonomy ("Career Counsellor",
    // "Behavioral Mentor", "Self Discovery", …) — none of which appear in any
    // end-user PERSONA_COHORT. For those families the persona gate dropped EVERY
    // curated question and silently dead-ended the user to the generic static
    // fallback (the reported "repeating and irrelevant" clarify questions). The
    // concern was already persona-vetted at selection time (PERSONA_AFFINITY in
    // /api/concerns/search) and the age filter still guards cross-persona age
    // leakage, so relaxing persona on the own tag is safe: keep the persona
    // preference where the family supports it, but never let it force a fallback.
    if (valid.length < 2 && cohort) {
      valid = await runByTag(ownTag, false, mappedConcerns);
    }

    // Mapping-broaden retry (2026-06-01): a precise mapping existed but the age
    // filter / 2-option gate under-filled the restricted pool. Before leaving the
    // (correct) own tag, retry the WHOLE own-tag family UNRESTRICTED — same-family
    // topical rows beat jumping to a sibling/orphan tag. The conceptStems
    // relevance rank + youth demotion still order them sensibly. Only fires when a
    // mapping was actually applied (else identical to the unmapped path above).
    if (valid.length < 2 && mappedConcerns) {
      valid = await runByTag(ownTag, false, null);
    }

    // Orphan-tag fallback (2026-05-29): when the own tag under-fills and it is a
    // known orphan (zero clarity rows), retry against its topically-adjacent
    // covered tag with persona relaxed. Without this, the "career gap / rejoining
    // workforce" family (all CAREER_TRANSITION) silently dropped to the generic
    // static fallback — the reported "not picking".
    if (valid.length < 2) {
      const fb = resolveCoveredBridgeTag(ownTag);
      if (fb && fb.toUpperCase() !== ownTag.toUpperCase()) {
        valid = await runByTag(fb, false);
      }
    }

    // Out-of-band age re-route (2026-06-01): when every prior attempt under-fills
    // because the concern's WHOLE bridge-tag family sits outside the user's age
    // band (e.g. a 45+ professional landing on a student-only exam concern), the
    // age filter correctly empties the pool — but dropping to the generic static
    // fallback is poor. Instead, find a topical sibling concern (same cluster,
    // else same domain) whose family age band overlaps the user AND whose bridge
    // tag actually has curated clarity rows, then pull from THAT tag (persona
    // relaxed; the age filter still guards correctness). Topical + age-correct
    // beats generic. Only fires when an age band is known.
    if (valid.length < 2 && ageRange) {
      const sib = await pool.query<{ tag: string }>(
        `SELECT m.relational_bridge_tag AS tag
           FROM capadex_concerns_master src
           JOIN capadex_concerns_master m
             ON (m.concern_cluster = src.concern_cluster OR m.domain = src.domain)
          WHERE src.concern_id = $1
            AND m.concern_id <> src.concern_id
            AND m.relational_bridge_tag IS NOT NULL
            AND TRIM(m.relational_bridge_tag) <> ''
            AND m.age_min IS NOT NULL AND m.age_max IS NOT NULL
            AND m.age_min <= $3 AND m.age_max >= $2
            AND EXISTS (
                  SELECT 1 FROM capadex_clarity_questions q
                   WHERE LOWER(TRIM(q.master_bridge_tag)) = LOWER(TRIM(m.relational_bridge_tag))
                     AND q.question IS NOT NULL AND TRIM(q.question) <> ''
                )
          ORDER BY (m.concern_cluster = src.concern_cluster) DESC,
                   (m.domain = src.domain) DESC,
                   m.age_min ASC
          LIMIT 1`,
        [concernId, bandMin, bandMax],
      );
      const sibTag = sib.rows[0]?.tag?.trim();
      if (sibTag && sibTag.toUpperCase() !== ownTag.toUpperCase()) {
        valid = await runByTag(sibTag, false);
      }
    }

    // Cascade gate: if the master taxonomy yielded fewer than 2 usable
    // questions, return [] so the caller drops to Tier 2 (adaptive bank).
    // Surfacing 1 master-curated question alone misleads the provenance
    // pill and leaves the clarify phase under-quota.
    if (valid.length < 2) return [];
    return valid;
  } catch (err) {
    console.error('[pickQuestionsFromMaster] error:', err);
    return [];
  }
}

// ─── Free-text → master concern_id resolver (2026-05-28) ─────────────────────
// When the client doesn't supply a canonical `concern_id` (typical for users
// who type a short phrase and submit without clicking a typeahead chip), we
// best-effort score the typed text against `capadex_concerns_master` and
// adopt the top match's `concern_id` so `pickQuestionsFromMaster` can fire.
// Without this, every free-typed concern silently routes to the adaptive
// bank or the static fallback even when its bridge tag has hundreds of
// curated clarity rows (e.g. "work stress" → EMOTIONAL_REGULATION, 975 rows).
// Returns null on weak matches (score <60) so we don't fabricate a mapping
// for off-topic input — caller falls back to construct/category-based picker.
// ─── Sub-persona cohort map ───────────────────────────────────────────────────
// IntroPhase groups sub-personas under 3 macro-tracks (learner / professional /
// proxy). A user who picks 'mid_career_professional' is contextually closer to
// every other Professional sub-persona than to a Parent or Student, so when the
// resolver restricts to "Primary Persona", we widen to that persona's cohort.
// Keys + values are snake_case-normalised to match master.primary_persona once
// it passes through the same REGEXP_REPLACE that the SQL applies row-side.
const PERSONA_COHORT: Record<string, string[]> = {
  // Learner cohort
  campus_student:                  ['campus_student','competitive_aspirant','career_explorer','skill_development_learner','student','early_career_learner'],
  competitive_aspirant:            ['competitive_aspirant','campus_student','career_explorer','skill_development_learner','student','early_career_learner'],
  career_explorer:                 ['career_explorer','campus_student','competitive_aspirant','skill_development_learner','student','early_career_learner','job_seeker'],
  skill_development_learner:       ['skill_development_learner','campus_student','competitive_aspirant','career_explorer','student','early_career_learner'],
  // Professional cohort
  early_career_professional:       ['early_career_professional','mid_career_professional','career_transition_professional','working_professional','professional_employee','leadership_track_professional','job_seeker'],
  mid_career_professional:         ['mid_career_professional','early_career_professional','career_transition_professional','working_professional','professional_employee','leadership_track_professional','job_seeker'],
  career_transition_professional:  ['career_transition_professional','mid_career_professional','early_career_professional','working_professional','professional_employee','leadership_track_professional','job_seeker'],
  // Proxy cohort
  parent:                          ['parent'],
  teacher_educator:                ['teacher_educator','teacher','academic_counsellor','placement_career_cell','principal_leadership'],
  academic_counsellor:             ['academic_counsellor','teacher_educator','teacher','placement_career_cell','principal_leadership'],
  placement_career_cell:           ['placement_career_cell','teacher_educator','teacher','academic_counsellor','principal_leadership'],
  // Legacy coarse keys (still flow through from older clients)
  student:                         ['student','campus_student','competitive_aspirant','career_explorer','skill_development_learner','early_career_learner'],
  professional:                    ['mid_career_professional','early_career_professional','career_transition_professional','working_professional','professional_employee','leadership_track_professional','job_seeker'],
  teacher:                         ['teacher','teacher_educator','academic_counsellor','placement_career_cell','principal_leadership'],
};

function personaCohortFor(primaryPersona?: string | null): string[] | null {
  if (!primaryPersona) return null;
  const key = String(primaryPersona).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (!key) return null;
  return PERSONA_COHORT[key] ?? [key];
}

// Stemmer + synonym expansion now live in the pure resolver engine
// (`services/concern-resolver-engine.ts`) so the live resolver, the validation
// harness, and `conceptStemsFromConcern` all share one source of truth.

// Generic filler words found in master concern LABELS/CLUSTERS that carry no
// topical routing signal (they describe the *shape* of the concern, not its
// subject) — stripped before deriving topical match stems.
const CONCERN_LABEL_STOPWORDS = new Set([
  'difficulty','difficulties','managing','maintaining','building','balancing','aligning',
  'lack','poor','weak','low','high','during','academic','studies','study','studying',
  'in','of','the','a','an','and','or','to','with','without','your','you','for','on','at',
  'across','large','long','consistent','effective','effectively','still','even','being',
  'ability','skills','skill','issues','issue','problem','problems','trouble','able','unable',
]);

// Derive the set of topical match-stems for a SPECIFIC concern from its own
// display label + cluster (NOT the coarse bridge tag). A broad bridge tag like
// ACADEMIC_COGNITIVE pools ~600 clarity rows spanning many distinct concerns
// (focus, procrastination, exam strategy, conceptual gaps…). These stems let
// `pickQuestionsFromMaster` SOFT-rank the clarity rows so the ones actually
// about THIS concern's subject (e.g. "focus"/"concentration"/"attention" for an
// Academic Focus concern) surface ahead of generic family filler — without ever
// hard-filtering (generic rows still backfill the quota, so it never dead-ends).
function conceptStemsFromConcern(label?: string | null, cluster?: string | null): string[] {
  const raw = `${label || ''} ${cluster || ''}`.toLowerCase();
  const out = new Set<string>();
  for (const t of raw.replace(/[^a-z0-9\s/-]/g, ' ').split(/\s+/)) {
    if (t.length < 4 || CONCERN_LABEL_STOPWORDS.has(t)) continue;
    for (const s of expandResolverToken(t).patterns) {
      if (s.length >= 4) out.add(s);
    }
  }
  return Array.from(out).slice(0, 10);
}

// ── Resolver corpus cache (RRP-1) ────────────────────────────────────────────
// The resolver now ranks in-memory via the pure `concern-resolver-engine` so it
// can apply IDF weighting, the deterministic tie-break cascade, short-intent
// mode, and confidence scoring (none of which SQL can express). We load the
// (~2.5k row) corpus once and cache it with a short TTL; IDF is precomputed at
// build time. Read-only — staleness only affects newly-added concerns until the
// next refresh.
let _resolverCorpus: ResolverCorpus | null = null;
let _resolverCorpusAt = 0;
const RESOLVER_CORPUS_TTL_MS = 5 * 60 * 1000;

async function getResolverCorpus(pool: Pool): Promise<ResolverCorpus | null> {
  const now = Date.now();
  if (_resolverCorpus && now - _resolverCorpusAt < RESOLVER_CORPUS_TTL_MS) return _resolverCorpus;
  try {
    const rs = await pool.query(
      `SELECT concern_id, display_label, concern_cluster, concern_category,
              common_indian_context, domain, relational_bridge_tag,
              primary_persona, age_min, age_max
         FROM capadex_concerns_master`,
    );
    _resolverCorpus = buildResolverCorpus(rs.rows as any[]);
    _resolverCorpusAt = now;
    return _resolverCorpus;
  } catch (err) {
    console.error('[getResolverCorpus]', err);
    return _resolverCorpus; // serve stale on error rather than dropping resolution
  }
}

// Full, explainable resolution (RRP-1): tie-break cascade + IDF + short-intent +
// confidence. Restricts to the active Primary Persona's cohort (per IntroPhase
// macro-track); empty/unknown persona → no restriction. Age band is a tiebreak.
async function resolveMasterConcernDetailed(
  pool: Pool | null | undefined,
  text: string,
  primaryPersona?: string | null,
  ageRange?: [number, number] | null,
): Promise<ResolutionResult | null> {
  if (!pool) return null;
  try {
    const corpus = await getResolverCorpus(pool);
    if (!corpus) return null;
    const personaCohort = personaCohortFor(primaryPersona);
    return resolveConcern(corpus, text, personaCohort, ageRange ?? null);
  } catch (err) {
    console.error('[resolveMasterConcernDetailed]', err);
    return null;
  }
}

// Back-compat shim — callers that only need the id keep the original signature.
async function resolveMasterConcernIdFromText(
  pool: Pool | null | undefined,
  text: string,
  primaryPersona?: string | null,
  ageRange?: [number, number] | null,
): Promise<string | null> {
  const r = await resolveMasterConcernDetailed(pool, text, primaryPersona, ageRange);
  return r ? r.concern_id : null;
}

// ─── Correlation Intelligence ─────────────────────────────────────────────────
// Detects how multiple concerns interact and what the combined pattern suggests.

const CATEGORY_CLUSTER: Record<string, string> = {
  career:       'Identity & Direction',
  professional: 'Performance & Environment',
  academic:     'Learning & Achievement',
  emotional:    'Regulation & Wellbeing',
  behavioural:  'Self-Regulation',
  social:       'Relational',
  digital:      'Digital Behaviour',
  wellness:     'Physical Wellbeing',
  general:      'General',
};

const CORRELATION_PATTERNS: Array<{
  categories: string[];
  title: string;
  insight: string;
  driver: string;
}> = [
  {
    categories: ['career', 'emotional'],
    title: 'Direction Anxiety Pattern',
    insight: 'Career uncertainty is amplifying emotional pressure. The lack of a clear path is not just a career problem — it is creating an ongoing stress loop that affects motivation, sleep, and daily functioning.',
    driver: 'Unresolved identity questions fuel persistent anxiety; resolving direction reduces emotional load.',
  },
  {
    categories: ['career', 'behavioural'],
    title: 'Paralysis-Avoidance Cycle',
    insight: 'Career indecision and behavioural patterns like procrastination or low motivation are reinforcing each other. The uncertainty makes action feel pointless; the inaction makes the uncertainty worse.',
    driver: 'Breaking one loop — even a small behavioural win — disrupts both patterns simultaneously.',
  },
  {
    categories: ['professional', 'emotional'],
    title: 'Burnout-Anxiety Compound',
    insight: 'Work pressure and emotional dysregulation are compounding each other. Professional demands are exceeding your capacity to recover, which is degrading your ability to manage emotions and make clear decisions.',
    driver: 'Recovery capacity, not just task management, is the critical intervention point.',
  },
  {
    categories: ['professional', 'career'],
    title: 'Stagnation-Identity Conflict',
    insight: 'Your current role and your career trajectory feel misaligned. The daily work environment is reinforcing doubts about whether you are in the right place — creating a dual layer of frustration.',
    driver: 'Clarifying the career story makes the current role feel more purposeful or accelerates the transition.',
  },
  {
    categories: ['academic', 'emotional'],
    title: 'Performance-Anxiety Spiral',
    insight: 'Academic pressure and emotional dysregulation are creating a spiral where anxiety hurts performance, and poor performance increases anxiety. Both need to be addressed together.',
    driver: 'Emotional regulation skills directly improve academic performance — they are not separate issues.',
  },
  {
    categories: ['academic', 'behavioural'],
    title: 'Executive Function Gap',
    insight: "Study challenges and behavioural patterns like procrastination or difficulty focusing are often expressions of the same underlying executive function gap — the brain's system for planning, starting, and completing tasks.",
    driver: 'Building one executive function skill (e.g. task initiation) typically improves performance in both areas.',
  },
  {
    categories: ['emotional', 'behavioural'],
    title: 'Regulation-Habit Feedback Loop',
    insight: 'Emotional dysregulation is disrupting behavioural patterns, and inconsistent habits are destabilising emotional regulation. These two dimensions are in a tight feedback loop.',
    driver: 'Stabilising one creates the foundation for stabilising the other — typically starting with the physical (sleep, routine).',
  },
  {
    categories: ['social', 'emotional'],
    title: 'Social-Emotional Integration Gap',
    insight: 'Social difficulties and emotional challenges are co-occurring — likely because the emotional regulation skills needed for internal wellbeing are the same ones needed for relational connection.',
    driver: 'Social confidence improves when emotional regulation improves — they share the same root skill set.',
  },
  {
    categories: ['career', 'professional', 'emotional'],
    title: 'Triple-Layer Burnout Pattern',
    insight: 'You are experiencing pressure across career direction, daily work environment, and emotional regulation simultaneously. This three-layer pattern typically means the system is at or near capacity.',
    driver: 'Addressing emotional regulation first creates the stability needed to make clear decisions on the career and professional layers.',
  },
];

function buildCorrelationInsight(
  concerns: string[],
  constructs: string[],
  categories: string[],
): {
  title: string;
  insight: string;
  driver: string;
  concerns: string[];
  constructs: string[];
  pattern_type: string;
} {
  // Find the best matching correlation pattern
  let bestMatch = CORRELATION_PATTERNS.find(p =>
    p.categories.every(c => categories.includes(c)) &&
    categories.every(c => p.categories.includes(c) || !p.categories.includes(c))
  ) || CORRELATION_PATTERNS.find(p =>
    p.categories.filter(c => categories.includes(c)).length >= 2
  ) || CORRELATION_PATTERNS.find(p =>
    p.categories.some(c => categories.includes(c))
  );

  if (!bestMatch) {
    // Generic fallback
    const clusters = categories.map(c => CATEGORY_CLUSTER[c] || c).filter((v, i, a) => a.indexOf(v) === i);
    bestMatch = {
      categories,
      title: 'Multi-Domain Pattern',
      insight: `Your concerns span ${clusters.join(' and ')} — which means they likely share an underlying driver rather than being separate, independent problems. The assessment will map how they connect.`,
      driver: 'Identifying the shared root cause makes all three more actionable than treating them separately.',
    };
  }

  return {
    title: bestMatch.title,
    insight: bestMatch.insight,
    driver: bestMatch.driver,
    concerns,
    constructs,
    pattern_type: categories.length >= 3 ? 'triple' : 'dual',
  };
}

const CROSS_QUESTIONS: Array<{
  id: string;
  categories: string[];
  question: string;
  options: string[];
}> = [
  {
    id: 'cross_trigger_order',
    categories: ['career', 'emotional', 'professional', 'behavioural'],
    question: 'When you think about these concerns together, which one tends to trigger the others?',
    options: [
      'Work or career pressures start the chain',
      'Emotional state comes first — the rest follows',
      'Behavioural patterns (avoidance, procrastination) lead',
      'They seem to arrive together — no clear order',
    ],
  },
  {
    id: 'cross_duration',
    categories: ['career', 'emotional', 'professional', 'behavioural', 'academic', 'social'],
    question: 'How long have all of these been present together?',
    options: [
      'Less than 3 months — something shifted recently',
      '3 to 12 months — a gradual build',
      '1 to 3 years — this has been a slow background pattern',
      'As long as I can remember — feels like part of who I am',
    ],
  },
  {
    id: 'cross_functional_impact',
    categories: ['career', 'emotional', 'professional', 'behavioural', 'academic', 'social', 'digital'],
    question: 'Which part of your daily life is most affected by these concerns combined?',
    options: [
      'My ability to work or study effectively',
      'My relationships and how I show up for others',
      'My mental and physical energy levels',
      'My sense of direction and long-term plans',
    ],
  },
];

function buildCrossQuestions(
  _concerns: string[],
  categories: string[],
  _persona: string,
): Array<{ id: string; question: string; options: string[] }> {
  return CROSS_QUESTIONS
    .filter(q => q.categories.some(c => categories.includes(c)))
    .map(({ id, question, options }) => ({ id, question, options }));
}

// ─── Route Registration ───────────────────────────────────────────────────────

// 2026-05-28 macro-track envelope: the new IntroPhase ships canonical fields
// (primary_persona / is_proxy / target_age_band / assessee_name /
// contextual_anchor / raw_concern_text) alongside the legacy keys. Validation
// is intentionally non-blocking: a missing/invalid field downgrades that slot
// to `undefined`, the rest of the envelope still flows. The route never 400s
// on shape — analyzeConcern + persistRuntimeContext are themselves defensive.
const AGE_BAND_CANON = ['6-14', '14-17', '17-24', '24-45', '45+'] as const;
const AGE_BAND_MIDPOINT: Record<string, number> = {
  '6-14': 10, '14-17': 15, '17-24': 20, '24-45': 34, '45+': 50,
};
const normaliseDashSrv = (s: string) => s.replace(/[\u2010-\u2015\u2212]/g, '-').trim();

interface AnalyzeEnvelope {
  raw_concern_text: string;            // required slot
  primary_persona: string | undefined;
  is_proxy: boolean | undefined;
  target_age_band: string | undefined; // canonical, dash-normalised
  assessee_name: string | undefined;
  contextual_anchor: string | undefined;
  concern_id: string | undefined;      // master id (CONCERN_*) when client supplied
  session_id: string | null;
  seen_question_ids: string[];         // clarity ids already shown this session
  additional_concerns: string[];
  // Legacy passthroughs — preserved so existing downstream consumers keep working.
  persona: string | undefined;         // coarse legacy persona
  assessee_type: string | undefined;
  age: number | undefined;             // numeric age (legacy) — falls back to band midpoint
}

function parseAnalyzeEnvelope(body: any): { envelope: AnalyzeEnvelope; missing: string[] } {
  const b = body && typeof body === 'object' ? body : {};
  const missing: string[] = [];
  const str = (v: any) => (typeof v === 'string' ? v.trim() : '');
  const bool = (v: any) => (typeof v === 'boolean' ? v : undefined);

  const raw = str(b.raw_concern_text) || str(b.concern_text);
  if (!raw || raw.length < 2) missing.push('raw_concern_text');

  const primary_persona = str(b.primary_persona) || undefined;
  if (!primary_persona) missing.push('primary_persona');

  const is_proxy = bool(b.is_proxy);
  if (is_proxy === undefined) missing.push('is_proxy');

  const bandRaw = str(b.target_age_band);
  const bandNorm = bandRaw ? normaliseDashSrv(bandRaw) : '';
  const target_age_band = (AGE_BAND_CANON as readonly string[]).includes(bandNorm) ? bandNorm : undefined;
  if (!target_age_band) missing.push('target_age_band');

  const assessee_name = str(b.assessee_name) || undefined;
  if (!assessee_name) missing.push('assessee_name');

  const contextual_anchor = str(b.contextual_anchor) || undefined;
  if (!contextual_anchor) missing.push('contextual_anchor');

  const concern_id = typeof b.concern_id === 'string' && /^CONCERN_/.test(b.concern_id) ? b.concern_id : undefined;
  const session_id = typeof b.session_id === 'string' && b.session_id.length > 0 ? b.session_id : null;
  // Already-seen clarity ids. Accepts `seen_question_ids`, the legacy alias
  // `answered_question_ids`, or the frontend camelCase `answeredIds`. In-memory
  // exclusion only — never persisted.
  const seenRaw = Array.isArray(b.seen_question_ids)
    ? b.seen_question_ids
    : Array.isArray(b.answered_question_ids)
      ? b.answered_question_ids
      : Array.isArray(b.answeredIds)
        ? b.answeredIds
        : [];
  const seen_question_ids = seenRaw
    .filter((x: any) => typeof x === 'string' && x.trim().length > 0)
    .slice(0, 200);
  const additional_concerns = Array.isArray(b.additional_concerns)
    ? b.additional_concerns.filter((c: any) => typeof c === 'string' && c.trim().length > 1).slice(0, 2)
    : [];

  // Legacy fallbacks so deriveRuntimeContext still maps cleanly.
  const persona = str(b.persona) || primary_persona || undefined;
  const assessee_type = str(b.assessee_type) || (is_proxy === true ? 'someone-else' : is_proxy === false ? 'myself' : undefined);
  const numericAge = b.age !== undefined ? Number(b.age) : NaN;
  const age = Number.isFinite(numericAge)
    ? numericAge
    : (target_age_band ? AGE_BAND_MIDPOINT[target_age_band] : undefined);

  return {
    envelope: {
      raw_concern_text: raw,
      primary_persona, is_proxy, target_age_band, assessee_name, contextual_anchor,
      concern_id, session_id, seen_question_ids, additional_concerns,
      persona, assessee_type, age,
    },
    missing,
  };
}

function safeStructuralEnvelope(missing: string[]) {
  // Returned (HTTP 200) when the body is unusable. Mirrors the documented
  // analyzeConcern shape so the frontend renders an empty-state clarify
  // phase without crashing, and surfaces the missing fields for diagnostics.
  // Shape mirrors a real analyzeConcern() success envelope so the frontend
  // (`ConcernIntelligenceResult`) renders an empty clarify phase without
  // crashing on missing keys. Severity/risk default to 'low' (lowest tier)
  // so any defensive `.toLowerCase()` calls downstream don't trip on null.
  return {
    error: 'invalid_payload',
    missing_fields: missing,
    category: 'general',
    construct_key: null,
    construct_label: null,
    persona_detected: null,
    severity: 'low',
    severity_label: 'Low',
    risk_level: 'low',
    growth_readiness: 'high',
    emotional_signals: [],
    detected_patterns: [],
    preliminary_patterns: { patterns: [], tags: [], source: 'category_default' as const },
    subdomains: [],
    clarification_questions: [],
    clarity_source: 'static_fallback' as const,
    behavioural_mirror: null,
    intelligence_preview: null,
    resolved_concern_id: null,
    runtime_context: null,
    runtime_envelope: null,
  };
}

export function registerConcernIntelligenceRoutes(app: Express, pool?: Pool) {
  /**
   * POST /api/capadex/concern/analyze
   * Strict envelope (validation non-blocking, see parseAnalyzeEnvelope):
   *   raw_concern_text, primary_persona, is_proxy, target_age_band,
   *   assessee_name, contextual_anchor (+ optional concern_id, session_id,
   *   additional_concerns, legacy persona/assessee_type/age).
   * Returns structured intelligence + runtime_context envelope. Never 500s
   * on persistence; never 400s on field shape (falls through to a safe
   * structural envelope instead).
   */
  app.post('/api/capadex/concern/analyze', async (req: Request, res: Response) => {
    const { envelope, missing } = parseAnalyzeEnvelope(req.body);
    // Hard requirement: without text we cannot run the analyser at all.
    // Other missing fields are tolerated (best-effort derivation continues).
    if (!envelope.raw_concern_text) {
      return res.json(safeStructuralEnvelope(missing));
    }
    try {
      const concernText = envelope.raw_concern_text;
      // `concern_id` (when supplied) routes clarity questions through the
      // master taxonomy → `capadex_clarity_questions` join. See `analyzeConcern`
      // body for the 3-tier fallback chain. When the client did NOT supply a
      // canonical id (typical free-text entry), best-effort resolve it from
      // the typed text so users still get master-curated questions whenever
      // the text clearly maps to a known bucket. The resolver enforces a
      // ≥60 additive-per-token score and restricts lookups to clarity-
      // joinable master buckets (relational_bridge_tag ∈ clarity_questions),
      // so we strictly upgrade the fallback path — never make it worse.
      let masterId: string | null = envelope.concern_id ?? null;
      let resolution: ResolutionResult | null = null;
      if (!masterId) {
        // Pass the user's age band as a resolver tiebreak so a typed phrase that
        // matches concerns across multiple age cohorts (e.g. "exam stress")
        // lands on the cohort-appropriate concern.
        resolution = await resolveMasterConcernDetailed(
          pool,
          concernText,
          envelope.primary_persona,
          ageBandToRange(envelope.target_age_band, envelope.age),
        );
        masterId = resolution ? resolution.concern_id : null;
      }
      const result = await analyzeConcern(
        concernText,
        envelope.persona,
        envelope.age,
        pool,
        masterId,
        envelope.target_age_band,
        envelope.primary_persona,
        envelope.is_proxy,
        envelope.assessee_name,
        envelope.seen_question_ids,
      );
      // Surface the resolved id back so the frontend can persist it into
      // `concernMetaMap` and downstream phases see a canonical anchor.
      (result as { resolved_concern_id?: string | null }).resolved_concern_id = masterId;
      // RRP-1: surface the resolution confidence (0-100) + its explainable
      // components so the frontend can show a "did you mean" / low-confidence
      // affordance. Additive — null when the client supplied an explicit id.
      (result as { resolution_confidence?: number | null }).resolution_confidence =
        resolution ? resolution.confidence : null;
      (result as { resolution_detail?: unknown }).resolution_detail = resolution
        ? {
            confidence: resolution.confidence,
            components: resolution.components,
            short_intent: resolution.short_intent,
            tie_count: resolution.tie_count,
            tie_break_reason: resolution.tie_break_reason,
            score_pct: resolution.score_pct,
          }
        : null;
      // Adaptive Questioning (Phase B): advertise whether the incremental
      // `/adaptive-next` driver is live. Flag OFF → field is `false` and the
      // frontend keeps the existing batch flow (byte-identical behaviour).
      (result as { adaptive_enabled?: boolean }).adaptive_enabled = isAdaptiveQuestioningEnabled();

      // WC-1B-R Phase 3 — resolver grounding evidence (flag-gated, ADDITIVE only).
      // Surface whether the resolved concern's bridge tag is grounded (WC-1B) as
      // supporting evidence + a SEPARATE `resolution_confidence_grounded` score.
      // The existing `resolution_confidence` core score is never mutated. Flag OFF
      // → no keys → byte-identical legacy envelope.
      if (isSignalGroundingRuntimeEnabled() && pool) {
        try {
          const groundedTag = await resolveBridgeTagForConcernId(pool, masterId);
          if (groundedTag) {
            const gs = await groundedSummary(pool, groundedTag);
            (result as { signal_grounding?: typeof gs }).signal_grounding = gs;
            const baseConf = resolution ? resolution.confidence : null;
            if (typeof baseConf === 'number' && gs.grounded) {
              // Additive supporting boost, capped at +8, scaled by mean grounding
              // similarity. Evidence on top of — never a replacement for — the core score.
              const boost = Math.min(8, Math.round(gs.mean_similarity * 10));
              (result as { resolution_confidence_grounded?: number }).resolution_confidence_grounded =
                Math.min(100, baseConf + boost);
            }
          }
        } catch (gErr) {
          console.error('[concern-analyze] grounding evidence failed (continuing):', gErr);
        }
      }

      // ── Orchestration Context: derive actor/target persona + relationship from
      // the canonical envelope, persist a runtime_sessions row (best-effort —
      // never blocks analyze), and attach the context envelope to the response.
      // Downstream consumers (frontend allPhaseProps, FSM, future pickers) read
      // from this single source of truth instead of re-deriving.
      const runtime_context = await persistRuntimeContext(
        pool,
        deriveRuntimeContext({
          persona: envelope.persona,
          assesseeType: envelope.assessee_type,
          age: envelope.age ?? null,
        }),
        envelope.session_id,
      );
      // Echo the (non-column) envelope metadata back so the client and any
      // proxy logger sees the resolved profile. `capadex_runtime_sessions`
      // doesn't yet persist these — they ride on the response only.
      const runtime_envelope = {
        primary_persona:  envelope.primary_persona ?? null,
        is_proxy:         envelope.is_proxy ?? null,
        target_age_band:  envelope.target_age_band ?? null,
        assessee_name:    envelope.assessee_name ?? null,
        contextual_anchor: envelope.contextual_anchor ?? null,
        validation_missing: missing,
      };
      (result as { runtime_envelope?: typeof runtime_envelope }).runtime_envelope = runtime_envelope;
      // Attach via typed key — `analyzeConcern` returns an open-shape result;
      // RuntimeContext is now part of the documented response contract
      // (frontend `ConcernIntelligenceResult.runtime_context`).
      (result as { runtime_context?: typeof runtime_context }).runtime_context = runtime_context;

      // ── Multi-concern: add cross-concern clarify questions + correlation intelligence ──
      const extras = envelope.additional_concerns;

      if (extras.length > 0) {
        // Analyse each additional concern
        const extraResults = await Promise.all(
          extras.map(c => analyzeConcern(c.trim(), envelope.persona, envelope.age, pool)),
        );

        // Build correlation intelligence
        const allConcerns = [concernText, ...extras];
        const allConstructs = [result.construct_label, ...extraResults.map(r => r.construct_label)].filter(Boolean);
        const allCategories = [result.category, ...extraResults.map(r => r.category)];
        const uniqueCategories = [...new Set(allCategories)];

        // Detect cross-concern patterns
        const crossPatterns = buildCorrelationInsight(allConcerns, allConstructs as string[], uniqueCategories);

        // Append cross-concern clarify questions (max 2 extra, deduplicated)
        const crossQuestions = buildCrossQuestions(allConcerns, allCategories, envelope.persona || result.persona_detected);
        const existingIds = new Set(result.clarification_questions.map((q: any) => q.id));
        const newQuestions = crossQuestions.filter(q => !existingIds.has(q.id));

        (result as any).additional_concerns = extras;
        (result as any).concern_correlation = crossPatterns;
        (result as any).clarification_questions = [...result.clarification_questions, ...newQuestions.slice(0, 2)];
      }

      res.json(result);
    } catch (err) {
      // Hardened: never surface a 500 from the analyze handler — the funnel
      // depends on this endpoint always returning a usable envelope. Log the
      // root cause server-side and fall through to the safe structural shape.
      console.error('[concern-analyze]', err);
      res.json({
        ...safeStructuralEnvelope(missing),
        error: 'analysis_failed',
      });
    }
  });

  /**
   * POST /api/capadex/concern/adaptive-next  (Phase B — Adaptive Questioning)
   *
   * Incremental, answer-aware next-question driver. Given the answers so far it
   * runs the pure adaptive pipeline (dynamic pathing + information gain +
   * zero-repetition + contradiction probing + adaptive length) over the live
   * clarity pool and returns either the single best next question or a `done`
   * signal (stop-when-confident).
   *
   * Graceful degradation — the frontend ALWAYS has the batch from `/analyze`:
   *   - flag OFF                 → `{ enabled:false }`
   *   - missing concern text     → `{ enabled:false }`
   *   - any internal error       → `{ enabled:false }` (200, never 500)
   * In every fallback case the client keeps the existing batch flow unchanged.
   *
   * Body: the `/analyze` envelope PLUS `prior_answers: Array<{id, question,
   * response_value (0..1 distress intensity), response_label?}>`. Answered ids
   * are excluded from the candidate pool (passed through as `seen_question_ids`).
   */
  app.post('/api/capadex/concern/adaptive-next', async (req: Request, res: Response) => {
    if (!isAdaptiveQuestioningEnabled()) {
      return res.json({ enabled: false, reason: 'flag_off' });
    }
    try {
      const { envelope } = parseAnalyzeEnvelope(req.body);
      if (!envelope.raw_concern_text) {
        return res.json({ enabled: false, reason: 'missing_concern_text' });
      }

      // Normalise prior answers defensively (untrusted client input).
      const rawAnswers = Array.isArray(req.body?.prior_answers) ? req.body.prior_answers : [];
      const priorAnswers: PriorAnswer[] = rawAnswers
        .filter((a: any) => a && typeof a.id === 'string' && typeof a.question === 'string')
        .slice(0, 50)
        .map((a: any) => ({
          id: a.id,
          question: a.question,
          response_value: clampUnit(Number(a.response_value)),
          response_label: typeof a.response_label === 'string' ? a.response_label : undefined,
        }));

      // Exclude every already-answered id from the candidate pool, on top of any
      // ids the client reports as already seen this session.
      const answeredIds = priorAnswers.map((a) => a.id);
      const excludeIds = Array.from(new Set([...(envelope.seen_question_ids || []), ...answeredIds]));

      // Resolve the canonical concern id exactly as /analyze does, then reuse
      // analyzeConcern to build the (seen-filtered, proxy-reframed) candidate pool.
      let masterId: string | null = envelope.concern_id ?? null;
      if (!masterId) {
        masterId = await resolveMasterConcernIdFromText(
          pool,
          envelope.raw_concern_text,
          envelope.primary_persona,
          ageBandToRange(envelope.target_age_band, envelope.age),
        );
      }
      const poolResult = await analyzeConcern(
        envelope.raw_concern_text,
        envelope.persona,
        envelope.age,
        pool,
        masterId,
        envelope.target_age_band,
        envelope.primary_persona,
        envelope.is_proxy,
        envelope.assessee_name,
        excludeIds,
      );

      const candidates = (poolResult.clarification_questions || []).map((q: any) => ({
        id: String(q.id),
        question: String(q.question ?? ''),
        options: Array.isArray(q.options) ? q.options : undefined,
        response_type: q.response_type,
      }));

      const selection = runAdaptiveSelection({ candidates, priorAnswers });

      return res.json({
        enabled: true,
        clarity_source: poolResult.clarity_source,
        resolved_concern_id: masterId,
        ...selection,
      });
    } catch (err) {
      // Never 500 — the frontend falls back to the batch flow on `enabled:false`.
      console.error('[adaptive-next]', err);
      return res.json({ enabled: false, reason: 'error' });
    }
  });
}

/** Clamp an arbitrary number to the unit interval (NaN → 0). */
function clampUnit(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
