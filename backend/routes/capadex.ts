/**
 * /backend/routes/capadex.ts
 * CAPADEX progressive assessment routes — public (no auth required).
 * Mounted via registerCapadexRoutes() in routes.ts.
 *
 * Stages (ordered):
 *   CAP_CUR → Curiosity   (index 0)
 *   CAP_INS → Insight     (index 1)
 *   CAP_GRW → Growth      (index 2)
 *   CAP_MAS → Mastery     (index 3)
 *
 * Flow:
 *   POST /api/capadex/session/start   — start or auto-resume next stage
 *   POST /api/capadex/session/:id/respond   — save responses
 *   POST /api/capadex/session/:id/complete  — score + advance
 *   GET  /api/capadex/progress              — full journey for email+concern
 *   GET  /api/capadex/concerns              — concern availability map
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { sendCapadexOtp, sendCapadexReport, sendIntroVerificationOtp } from '../email';
import { buildOmegaEmailExtras } from '../services/omega-report-builder';
import { postCompletionHooks } from './capadex-enterprise';
import { buildBehaviorGraph } from '../services/behavior-graph-service';
import { generateInterventionIntelligence } from '../services/intervention-intelligence';
import { explainSession } from '../services/capadex-insight-explainer';
import { discoverStrengths } from '../services/strength-discovery-engine';
import { computeItemScore, computeNormScore, buildSessionScoreTrace } from '../lib/scoring-utils';
import { redactJson } from '../lib/redact';
import { seedInitialState, updateStateOnStageComplete } from '../services/cognitive-state';
import { buildOmegaXSkeleton, isPopulatedOmegaXPayload, calculateBayesianUpdate } from '../services/omega-x-payload';
import { evaluateSafetyTrip, buildSafetyInterceptEnvelope } from '../services/capadex-safety-breaker';
import { isEnabled } from '../services/feature-flags';
import { requireEntitlement } from '../services/wc7c/require-entitlement';
import { detectContradictions } from '../services/contradiction-engine';
import { calculateAndPersistLBI } from './lbi-engine';
import { PRO_CONCERN_BANK, STUDENT_CONCERN_BANK } from '../data/capadex-concern-banks';
import {
  synthesizeArchetype,
  buildBehaviouralEnvelope,
  type BehaviouralSignalInput,
} from '../services/capadex-report-synthesis';
import { snapshotLoad }         from '../services/cognitive-load';
import { broadcastToSession }   from '../services/ws-broadcast';
import { evaluateQuality }      from '../services/conversational-quality';
import { detectCategory }       from './capadex-concern-intelligence';
import { canonicalizeConstructKey } from '../data/behavioural-constructs';
import {
  getSessionSignals,
  getSessionPatterns,
  getSessionExplanation,
} from '../services/capadex-explainability-engine';
import { getSessionComposites } from '../services/composite-signal-engine';
import { getLongitudinalPatterns } from '../services/pattern-engine';
import { runEvidenceRuntime }   from '../services/signal-activation-runtime';
import { resolveSeedConcernPk } from '../services/concern-signal-seeding';
import type { EvidenceInput }   from '../services/evidence-engine';
import { isRuntimeIntelligenceActivationEnabled, isRuntimeIntelligencePipelineEnabled, isSignalGroundingRuntimeEnabled } from '../config/feature-flags';
import { isEvidenceGatedProgressionEnabled } from '../config/feature-flags';
import { resolveBridgeTagForConcernPk, loadGroundedLineage, groundingCoreToken } from '../services/signal-grounding-runtime';
import { buildGuidanceForSession } from '../services/pil/runtime-guidance-engine';
import { buildPipelineForSession } from '../services/pil/pipeline-resolver';
import {
  buildRuntimeSummary,
  buildStakeholderSummary,
  buildRuntimeExplainability,
  isStakeholderLens,
} from '../services/pil/stakeholder-summary-engine';
import {
  buildStakeholderReport,
  buildAllStakeholderReports,
  buildInstitutionReport,
} from '../services/pil/report-builder';
import {
  buildSessionRecommendations,
  buildInstitutionRecommendations,
  persistSessionRecommendations,
} from '../services/pil/recommendation-builder';
import {
  getStats as kgGetStats,
  getNodeDetail as kgGetNodeDetail,
  findPath as kgFindPath,
  getSessionSubgraph as kgGetSessionSubgraph,
  exportSubgraph as kgExportSubgraph,
} from '../services/pil/knowledge-graph-service';

function hashPassword(pw: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString('hex');
    scrypt(pw, salt, 64, (err, hash) => {
      if (err) return reject(err);
      resolve(`${salt}:${hash.toString('hex')}`);
    });
  });
}

function comparePassword(pw: string, stored: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return resolve(false);
    scrypt(pw, salt, 64, (err, derived) => {
      if (err) return reject(err);
      try {
        resolve(timingSafeEqual(Buffer.from(hash, 'hex'), derived));
      } catch {
        resolve(false);
      }
    });
  });
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const ADULT_PERSONAS = new Set(['professional', 'jobseeker', 'campus']);

/**
 * Map any user-entered concern to the best available sdi_items concern_name.
 *
 * Adult-context routing matters: an adult typing a stress/burnout/fatigue
 * concern belongs in the *Work Stress* bank, NOT the student *Exam Stress*
 * bank. Previously adultness was inferred from the persona key alone, so when
 * the caller omitted the persona (anonymous free-text entry, and any path that
 * doesn't forward a canonical persona key) every concern fell through to the
 * student/child branch — mis-routing e.g. an adult "Burnout" to "Exam Stress".
 * We now also treat the assessed age as an adult signal (>= 24, the AGE_BANDS
 * adult boundary) so the fallback resolver routes to the right bank even when
 * the persona key is absent. This only affects the keyword fallback (tier 4):
 * when a concern has its own exact-name seeded bank, tiers 2-3 resolve it
 * directly and this function is never reached.
 */
function resolveCapadexConcern(input: string, persona?: string, age?: number): string {
  const l = input.toLowerCase();
  const isAdult = persona
    ? ADULT_PERSONAS.has(persona)
    : (typeof age === 'number' && Number.isFinite(age) && age >= 24);

  if (isAdult) {
    if (/stress|burnout|overwhelm|exhaust|pressure|overload|burn.?out|strain|tension|toll/.test(l))          return 'Work Stress';
    if (/anxiet|overthink|worry|nervous|panic|fear|dread|apprehens|ruminate/.test(l))                        return 'Work Stress';
    if (/anger|aggress|temper|rage|irritab|outburst|frustrat|hostile|snap/.test(l))                          return 'Work Stress';
    if (/sleep|insomnia|fatigue|tired|exhaust|rest|recover|energy/.test(l))                                   return 'Work Stress';
    if (/stuck.*(position|role|job|career|company)|same.*(position|role|job).*year|(\d+\s*year|years?.*same).*(position|job|role)|no.*promot|stagnation|plateaued|undervalued|overqualified/.test(l)) return 'Career Anxiety';
    if (/career|job|direction|purpose|calling|future|path|confused|clarity|stuck|promot|role|position/.test(l)) return 'Career Anxiety';
    if (/social|interperson|communicat|relation|colleague|team|conflict|assertiv/.test(l))                    return 'Career Anxiety';
    if (/focus|procrastinat|distract|attention|productiv|lazy|avoidance|delay|defer|motivat/.test(l))        return 'Focus at Work';
    if (/screen|social.?media|gaming|digital|device|phone|scroll/.test(l))                                    return 'Digital Distraction';
    return 'Focus at Work';
  }

  // Child / student / parent / teacher — comprehensive keyword map
  if (/screen|phone|tablet|social.?media|gaming|game|internet|online|app\b|reel|scroll|youtube|tiktok/.test(l)) return 'Screen Distraction';
  if (/digital|device|gadget|tech/.test(l))                                                                    return 'Digital Distraction';
  if (/span|short.?att|sustain|concentrat/.test(l))                                                            return 'Short attention Span';
  if (/distract|fidget|restless|wander|drift/.test(l))                                                         return 'Easily distracted';

  // New student concern banks
  if (/stress|exam.*stress|overwhelm|pressure|burn.?out|tension|overload|burden/.test(l))                     return 'Exam Stress';
  if (/anxiet|overthink|worry|nervous|panic|fear|dread|apprehens|ruminate|anxious/.test(l))                   return 'Anxiety & Overthinking';
  if (/motivat|lazy|effort|energy|apathy|inspire|demotiv|bore|uninspir|purpose|drive/.test(l))                return 'Low Motivation';
  if (/anger|aggress|impuls|temper|rage|irritab|outburst|angry|violent|snap|react/.test(l))                   return 'Anger & Impulse';
  if (/social|friend|lonely|isolat|withdraw|shy|introvert|alone|relation|peer|belong|awkward/.test(l))        return 'Social Withdrawal';
  if (/procrastinat|delay|avoid|defer|postpone|putting.?off/.test(l))                                          return 'Easily distracted';
  if (/sleep|insomnia|fatigue|tired|exhaust|rest|night/.test(l))                                               return 'Exam Stress';
  if (/confident|self.?esteem|self.?worth|doubt|insecur|inferior|compari/.test(l))                            return 'Anxiety & Overthinking';
  if (/sad|depress|low|grief|hopeless|empt|numb|withdrawn|unmotivat/.test(l))                                 return 'Low Motivation';

  // General default — "Easily distracted" is the safest fallback (large bank, broad applicability)
  return 'Easily distracted';
}

// ─── Professional Question Bank — seeded to sdi_items on first boot ───────────
// 10 questions × 4 stages × 3 concerns = 120 items
// target_personas: professional, campus, jobseeker
// age_band: 19+
const PRO_QUESTIONS: Array<{
  item_code: string; question: string; weight: number; polarity: string;
  stage_code: string; concern_name: string; subdomain_code: string;
  question_type?: string; opt_a?: string; opt_b?: string; opt_c?: string; opt_d?: string;
}> = [
  // ── WORK STRESS ─ CAP_CUR ────────────────────────────────────────────────
  { item_code:'PRO_STRESS_CUR_01', concern_name:'Work Stress', stage_code:'CAP_CUR', weight:1.2, polarity:'(-)', subdomain_code:'Emotional Regulation',
    question_type:'mcq',
    question:'At the end of a demanding workday, which of these comes closest to your experience?',
    opt_a:'I feel tired but recover quickly once I rest',
    opt_b:'A mild flatness lingers into the evening before I decompress',
    opt_c:'Noticeable depletion — it takes most of the evening to feel like myself again',
    opt_d:'I feel emotionally wrung out and carry it into the next day' },
  { item_code:'PRO_STRESS_CUR_02', concern_name:'Work Stress', stage_code:'CAP_CUR', weight:1.1, polarity:'(-)', subdomain_code:'Work-Life Balance',
    question_type:'likert_agree',
    question:'I find it genuinely difficult to mentally switch off from work once I leave or log off.' },
  { item_code:'PRO_STRESS_CUR_03', concern_name:'Work Stress', stage_code:'CAP_CUR', weight:1.2, polarity:'(-)', subdomain_code:'Stress Tolerance',
    question:'I feel a sense of overwhelm when I look at my workload.' },
  { item_code:'PRO_STRESS_CUR_04', concern_name:'Work Stress', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Physical Wellbeing',
    question_type:'mcq',
    question:'How does work-related pressure most commonly show up in your body?',
    opt_a:'Rarely physically — my stress shows mainly in my mood or thoughts',
    opt_b:'Occasional muscle tension or tiredness during heavy periods',
    opt_c:'Noticeable physical fatigue or tension on most days under pressure',
    opt_d:'Persistent symptoms — tension headaches, exhaustion, or disrupted appetite' },
  { item_code:'PRO_STRESS_CUR_05', concern_name:'Work Stress', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Emotional Reactivity',
    question_type:'likert_agree',
    question:'Work stress makes me noticeably more irritable or short-tempered than I would otherwise be.' },
  { item_code:'PRO_STRESS_CUR_06', concern_name:'Work Stress', stage_code:'CAP_CUR', weight:1.1, polarity:'(-)', subdomain_code:'Worry Management',
    question:'I find myself worrying about work during personal time or while trying to rest.' },
  { item_code:'PRO_STRESS_CUR_07', concern_name:'Work Stress', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Self-Efficacy',
    question_type:'mcq',
    question:'On a typical workday, how much control do you feel over how your time and priorities are managed?',
    opt_a:'I largely direct my own priorities and protect my time effectively',
    opt_b:'I manage well most days, though the list consistently exceeds available time',
    opt_c:"Others' urgency typically determines what I work on",
    opt_d:'I feel mostly reactive — work is happening to me rather than being shaped by me' },
  { item_code:'PRO_STRESS_CUR_08', concern_name:'Work Stress', stage_code:'CAP_CUR', weight:1.1, polarity:'(-)', subdomain_code:'Sleep & Recovery',
    question_type:'likert_agree',
    question:'My sleep is regularly disrupted by work-related thoughts or concerns.' },
  { item_code:'PRO_STRESS_CUR_09', concern_name:'Work Stress', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Motivation',
    question:'I notice my enthusiasm and energy for work declining over time.' },
  { item_code:'PRO_STRESS_CUR_10', concern_name:'Work Stress', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Work Boundaries',
    question:'I feel an implicit or explicit pressure to always be available or switched on for work.' },

  // ── WORK STRESS ─ CAP_INS ────────────────────────────────────────────────
  { item_code:'PRO_STRESS_INS_01', concern_name:'Work Stress', stage_code:'CAP_INS', weight:1.2, polarity:'(+)', subdomain_code:'Self-Awareness',           question:'I can identify the specific triggers that cause me the most stress at work.' },
  { item_code:'PRO_STRESS_INS_02', concern_name:'Work Stress', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Pattern Recognition',      question:'I recognise a pattern in when my stress peaks during the week.' },
  { item_code:'PRO_STRESS_INS_03', concern_name:'Work Stress', stage_code:'CAP_INS', weight:1.1, polarity:'(+)', subdomain_code:'Impact Awareness',         question:'I understand how unresolved work stress affects my home life and relationships.' },
  { item_code:'PRO_STRESS_INS_04', concern_name:'Work Stress', stage_code:'CAP_INS', weight:1.1, polarity:'(+)', subdomain_code:'Early Warning',            question:'I notice early warning signs when I am approaching a burnout state.' },
  { item_code:'PRO_STRESS_INS_05', concern_name:'Work Stress', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Role Clarity',             question:'I understand which roles, people, or tasks drain me the most energy.' },
  { item_code:'PRO_STRESS_INS_06', concern_name:'Work Stress', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Coping Insight',           question:'I can see how my current coping strategies are or are not working.' },
  { item_code:'PRO_STRESS_INS_07', concern_name:'Work Stress', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Stress Literacy',          question:'I understand the difference between productive pressure and harmful stress.' },
  { item_code:'PRO_STRESS_INS_08', concern_name:'Work Stress', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Boundary Awareness',       question:'I recognise when I am absorbing stress from colleagues or the work environment.' },
  { item_code:'PRO_STRESS_INS_09', concern_name:'Work Stress', stage_code:'CAP_INS', weight:1.1, polarity:'(+)', subdomain_code:'Cognitive Insight',        question:'I notice how stress affects my judgment and decision-making quality.' },
  { item_code:'PRO_STRESS_INS_10', concern_name:'Work Stress', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Root Cause Analysis',      question:'I understand the root causes of my work stress beyond just workload volume.' },

  // ── WORK STRESS ─ CAP_GRW ────────────────────────────────────────────────
  { item_code:'PRO_STRESS_GRW_01', concern_name:'Work Stress', stage_code:'CAP_GRW', weight:1.2, polarity:'(+)', subdomain_code:'Decompression Habits',     question:'I use deliberate strategies to decompress before transitioning out of work mode.' },
  { item_code:'PRO_STRESS_GRW_02', concern_name:'Work Stress', stage_code:'CAP_GRW', weight:1.1, polarity:'(+)', subdomain_code:'Work-Life Boundary',       question:'I protect personal time consistently from work-related interruptions.' },
  { item_code:'PRO_STRESS_GRW_03', concern_name:'Work Stress', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Communication',            question:'I communicate workload or boundary concerns proactively to my team or manager.' },
  { item_code:'PRO_STRESS_GRW_04', concern_name:'Work Stress', stage_code:'CAP_GRW', weight:1.1, polarity:'(+)', subdomain_code:'Recovery Practices',       question:'I take structured breaks during the day to reset my stress level.' },
  { item_code:'PRO_STRESS_GRW_05', concern_name:'Work Stress', stage_code:'CAP_GRW', weight:1.2, polarity:'(+)', subdomain_code:'Stress Management',        question:'I use physical exercise, breathing, or mindfulness to manage work stress.' },
  { item_code:'PRO_STRESS_GRW_06', concern_name:'Work Stress', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Priority Management',      question:'I prioritise tasks by impact rather than urgency to reduce unnecessary pressure.' },
  { item_code:'PRO_STRESS_GRW_07', concern_name:'Work Stress', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Schedule Management',      question:'I build buffer time into my schedule to absorb unexpected demands.' },
  { item_code:'PRO_STRESS_GRW_08', concern_name:'Work Stress', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Cognitive Reframing',      question:'I separate what I can control from what I cannot in my work environment.' },
  { item_code:'PRO_STRESS_GRW_09', concern_name:'Work Stress', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Support Seeking',          question:'I seek peer, managerial, or professional support when my stress feels unmanageable.' },
  { item_code:'PRO_STRESS_GRW_10', concern_name:'Work Stress', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Close-Off Ritual',         question:'I end each workday with a habit that helps me mentally close off from work.' },

  // ── WORK STRESS ─ CAP_MAS ────────────────────────────────────────────────
  { item_code:'PRO_STRESS_MAS_01', concern_name:'Work Stress', stage_code:'CAP_MAS', weight:1.2, polarity:'(+)', subdomain_code:'Composure Under Pressure', question:'I remain calm and effective even under significant workplace pressure.' },
  { item_code:'PRO_STRESS_MAS_02', concern_name:'Work Stress', stage_code:'CAP_MAS', weight:1.1, polarity:'(+)', subdomain_code:'Resilience',               question:'I recover quickly from stressful periods without lasting residual impact.' },
  { item_code:'PRO_STRESS_MAS_03', concern_name:'Work Stress', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Boundary Mastery',         question:'My personal work boundaries are clear, consistent, and respected by others.' },
  { item_code:'PRO_STRESS_MAS_04', concern_name:'Work Stress', stage_code:'CAP_MAS', weight:1.2, polarity:'(+)', subdomain_code:'Energy Leadership',        question:'I proactively manage my energy as a strategic professional resource.' },
  { item_code:'PRO_STRESS_MAS_05', concern_name:'Work Stress', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Stress Reframing',         question:'I use stress signals as useful information rather than as threats.' },
  { item_code:'PRO_STRESS_MAS_06', concern_name:'Work Stress', stage_code:'CAP_MAS', weight:1.1, polarity:'(+)', subdomain_code:'Prevention Systems',       question:'I have a personal system that prevents stress from escalating to burnout.' },
  { item_code:'PRO_STRESS_MAS_07', concern_name:'Work Stress', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Perceived Reliability',    question:'Others see me as composed and reliable even in high-pressure situations.' },
  { item_code:'PRO_STRESS_MAS_08', concern_name:'Work Stress', stage_code:'CAP_MAS', weight:1.1, polarity:'(+)', subdomain_code:'Full Disengagement',       question:'I fully disengage from work during recovery and rest time.' },
  { item_code:'PRO_STRESS_MAS_09', concern_name:'Work Stress', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Performance Consistency',  question:'My professional performance stays consistent across high and low pressure cycles.' },
  { item_code:'PRO_STRESS_MAS_10', concern_name:'Work Stress', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Cultural Contribution',    question:'I actively contribute to a lower-stress culture for my team or colleagues.' },

  // ── FOCUS AT WORK ─ CAP_CUR ──────────────────────────────────────────────
  { item_code:'PRO_FOCUS_CUR_01', concern_name:'Focus at Work', stage_code:'CAP_CUR', weight:1.2, polarity:'(-)', subdomain_code:'Task Initiation',
    question_type:'mcq',
    question:'When you need to start an important work task, what most commonly happens?',
    opt_a:'I typically begin within a few minutes of committing to start',
    opt_b:'I do a few smaller tasks first, then get to the main one',
    opt_c:'I delay noticeably — often hours — before actually starting',
    opt_d:'The task stays on my list for days; I usually begin only when deadline pressure forces it' },
  { item_code:'PRO_FOCUS_CUR_02', concern_name:'Focus at Work', stage_code:'CAP_CUR', weight:1.1, polarity:'(-)', subdomain_code:'Sustained Attention',
    question_type:'likert_agree',
    question:'My attention drifts during meetings or focused work sessions even when I intend it not to.' },
  { item_code:'PRO_FOCUS_CUR_03', concern_name:'Focus at Work', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Task Completion',
    question:'I switch between tasks frequently without finishing what I started.' },
  { item_code:'PRO_FOCUS_CUR_04', concern_name:'Focus at Work', stage_code:'CAP_CUR', weight:1.1, polarity:'(-)', subdomain_code:'Cognitive Load',
    question_type:'mcq',
    question:'When you face a large or complex work task, which best describes what typically happens?',
    opt_a:'I break it down and work through it systematically',
    opt_b:'Some friction — but I find a starting point and build from there',
    opt_c:'I feel scattered and struggle to decide where to begin',
    opt_d:'I feel overwhelmed and often stall or avoid the task entirely' },
  { item_code:'PRO_FOCUS_CUR_05', concern_name:'Focus at Work', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Digital Distraction',
    question_type:'likert_agree',
    question:'Notifications and digital interruptions significantly reduce my ability to concentrate throughout the workday.' },
  { item_code:'PRO_FOCUS_CUR_06', concern_name:'Focus at Work', stage_code:'CAP_CUR', weight:1.2, polarity:'(-)', subdomain_code:'Deep Work Capacity',
    question:'I find it hard to enter a state of deep, uninterrupted focus during my workday.' },
  { item_code:'PRO_FOCUS_CUR_07', concern_name:'Focus at Work', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Time Management',
    question_type:'mcq',
    question:'Which of these best describes your typical relationship with work deadlines?',
    opt_a:'I consistently complete work ahead of time with breathing room',
    opt_b:'Usually on time, though it is often a close call',
    opt_c:'I regularly complete work closer to the deadline than I planned',
    opt_d:'I often miss or nearly miss deadlines due to difficulty managing my time' },
  { item_code:'PRO_FOCUS_CUR_08', concern_name:'Focus at Work', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Avoidance',
    question_type:'likert_agree',
    question:'I often spend time on lower-priority tasks as a way to avoid more demanding ones.' },
  { item_code:'PRO_FOCUS_CUR_09', concern_name:'Focus at Work', stage_code:'CAP_CUR', weight:1.1, polarity:'(-)', subdomain_code:'Intention-Action Gap',
    question:'I feel frustrated by the gap between how much I plan to accomplish and how much I actually do.' },
  { item_code:'PRO_FOCUS_CUR_10', concern_name:'Focus at Work', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Cognitive Clarity',
    question:'I experience a lack of mental sharpness or clarity during my work hours.' },

  // ── FOCUS AT WORK ─ CAP_INS ──────────────────────────────────────────────
  { item_code:'PRO_FOCUS_INS_01', concern_name:'Focus at Work', stage_code:'CAP_INS', weight:1.2, polarity:'(+)', subdomain_code:'Self-Awareness',         question:'I can identify which types of tasks I tend to avoid or delay the most.' },
  { item_code:'PRO_FOCUS_INS_02', concern_name:'Focus at Work', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Pattern Recognition',    question:'I notice patterns in when my focus is naturally sharpest during the day.' },
  { item_code:'PRO_FOCUS_INS_03', concern_name:'Focus at Work', stage_code:'CAP_INS', weight:1.1, polarity:'(+)', subdomain_code:'Emotional Drivers',      question:'I understand the emotional drivers behind my avoidance or procrastination.' },
  { item_code:'PRO_FOCUS_INS_04', concern_name:'Focus at Work', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Perfectionism Insight',  question:'I can tell when perfectionism is causing me to stall or overthink before starting.' },
  { item_code:'PRO_FOCUS_INS_05', concern_name:'Focus at Work', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Cascade Awareness',      question:'I notice how procrastinating on one task creates a cascade of delays.' },
  { item_code:'PRO_FOCUS_INS_06', concern_name:'Focus at Work', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Environment Insight',    question:'I understand how my work environment contributes to my distraction.' },
  { item_code:'PRO_FOCUS_INS_07', concern_name:'Focus at Work', stage_code:'CAP_INS', weight:1.1, polarity:'(+)', subdomain_code:'Early Warning',          question:'I recognise the early signs that I am about to go off-task.' },
  { item_code:'PRO_FOCUS_INS_08', concern_name:'Focus at Work', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Productivity Insight',   question:'I understand the difference between being busy and being genuinely productive.' },
  { item_code:'PRO_FOCUS_INS_09', concern_name:'Focus at Work', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Energy-Focus Link',      question:'I see a clear connection between my energy levels and my ability to focus.' },
  { item_code:'PRO_FOCUS_INS_10', concern_name:'Focus at Work', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Team Impact',            question:'I understand how my focus patterns affect my team\'s output and trust in me.' },

  // ── FOCUS AT WORK ─ CAP_GRW ──────────────────────────────────────────────
  { item_code:'PRO_FOCUS_GRW_01', concern_name:'Focus at Work', stage_code:'CAP_GRW', weight:1.2, polarity:'(+)', subdomain_code:'Time Blocking',          question:'I use time-blocking or focus sessions to protect concentration from interruptions.' },
  { item_code:'PRO_FOCUS_GRW_02', concern_name:'Focus at Work', stage_code:'CAP_GRW', weight:1.1, polarity:'(+)', subdomain_code:'Task Breakdown',         question:'I break large tasks into small, concrete next steps to reduce avoidance.' },
  { item_code:'PRO_FOCUS_GRW_03', concern_name:'Focus at Work', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Deliberate Scheduling',  question:'I set a specific start time for tasks I am tempted to delay.' },
  { item_code:'PRO_FOCUS_GRW_04', concern_name:'Focus at Work', stage_code:'CAP_GRW', weight:1.1, polarity:'(+)', subdomain_code:'Digital Hygiene',        question:'I eliminate or mute digital distractions during focused work periods.' },
  { item_code:'PRO_FOCUS_GRW_05', concern_name:'Focus at Work', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Energy Alignment',       question:'I match high-priority tasks to times when my focus is naturally strongest.' },
  { item_code:'PRO_FOCUS_GRW_06', concern_name:'Focus at Work', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Hardest First',          question:'I tackle the most avoided task first thing in the day to build momentum.' },
  { item_code:'PRO_FOCUS_GRW_07', concern_name:'Focus at Work', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Accountability',         question:'I use external accountability — deadlines, check-ins — to stay on track.' },
  { item_code:'PRO_FOCUS_GRW_08', concern_name:'Focus at Work', stage_code:'CAP_GRW', weight:1.1, polarity:'(+)', subdomain_code:'Environment Design',     question:'I structure my physical workspace to minimise interruptions during focus time.' },
  { item_code:'PRO_FOCUS_GRW_09', concern_name:'Focus at Work', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Daily Review',           question:'I review what I achieved versus what I avoided at the end of each workday.' },
  { item_code:'PRO_FOCUS_GRW_10', concern_name:'Focus at Work', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Positive Reinforcement', question:'I use small rewards for task completion to build positive focus momentum.' },

  // ── FOCUS AT WORK ─ CAP_MAS ──────────────────────────────────────────────
  { item_code:'PRO_FOCUS_MAS_01', concern_name:'Focus at Work', stage_code:'CAP_MAS', weight:1.2, polarity:'(+)', subdomain_code:'Execution Discipline',   question:'I consistently start and complete important work ahead of the deadline.' },
  { item_code:'PRO_FOCUS_MAS_02', concern_name:'Focus at Work', stage_code:'CAP_MAS', weight:1.1, polarity:'(+)', subdomain_code:'Self-Directed Focus',    question:'My focus is self-directed — I do not rely on external pressure to activate it.' },
  { item_code:'PRO_FOCUS_MAS_03', concern_name:'Focus at Work', stage_code:'CAP_MAS', weight:1.2, polarity:'(+)', subdomain_code:'Output Consistency',     question:'I maintain consistent work output quality regardless of motivation fluctuations.' },
  { item_code:'PRO_FOCUS_MAS_04', concern_name:'Focus at Work', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Environment Mastery',    question:'My work environment is fully optimised for deep, distraction-free focus.' },
  { item_code:'PRO_FOCUS_MAS_05', concern_name:'Focus at Work', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Interruption Recovery',  question:'I recover from interruptions quickly and return to focused work without effort.' },
  { item_code:'PRO_FOCUS_MAS_06', concern_name:'Focus at Work', stage_code:'CAP_MAS', weight:1.1, polarity:'(+)', subdomain_code:'Priority Clarity',       question:'I operate from a clear priority framework that guides my daily work decisions.' },
  { item_code:'PRO_FOCUS_MAS_07', concern_name:'Focus at Work', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Reliability',            question:'I am recognised for my follow-through and professional reliability.' },
  { item_code:'PRO_FOCUS_MAS_08', concern_name:'Focus at Work', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Intentional Attention',  question:'I use my attention as a strategic resource that I consciously allocate each day.' },
  { item_code:'PRO_FOCUS_MAS_09', concern_name:'Focus at Work', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Habit Elimination',      question:'I have eliminated the habitual distractions that previously derailed my work.' },
  { item_code:'PRO_FOCUS_MAS_10', concern_name:'Focus at Work', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Team Development',       question:'I actively support colleagues in developing better focus and work habits.' },

  // ── CAREER ANXIETY ─ CAP_CUR ─────────────────────────────────────────────
  { item_code:'PRO_CAREER_CUR_01', concern_name:'Career Anxiety', stage_code:'CAP_CUR', weight:1.2, polarity:'(-)', subdomain_code:'Career Clarity',
    question_type:'mcq',
    question:'When you think about whether your current career path is right for you, what comes closest?',
    opt_a:'I feel clear and aligned — the direction fits my values and strengths',
    opt_b:'Some doubts arise, but I mostly feel settled in where I am heading',
    opt_c:'I feel uncertain fairly often and wonder if there is a better fit for me',
    opt_d:'I feel significantly unclear about whether I am heading in the right direction at all' },
  { item_code:'PRO_CAREER_CUR_02', concern_name:'Career Anxiety', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Social Comparison',
    question_type:'likert_agree',
    question:'Comparing my career progress with peers regularly leaves me feeling behind or inadequate.' },
  { item_code:'PRO_CAREER_CUR_03', concern_name:'Career Anxiety', stage_code:'CAP_CUR', weight:1.1, polarity:'(-)', subdomain_code:'Decision Confidence',
    question:'I feel pressure to make career decisions without enough clarity about who I am and what I want.' },
  { item_code:'PRO_CAREER_CUR_04', concern_name:'Career Anxiety', stage_code:'CAP_CUR', weight:1.1, polarity:'(-)', subdomain_code:'Future Anxiety',
    question_type:'mcq',
    question:'When you think about your professional future, which best describes how that typically feels?',
    opt_a:'Mostly optimistic — I see possibility and have a clear enough direction',
    opt_b:'A background uncertainty that surfaces occasionally but does not dominate',
    opt_c:'Noticeable anxiety that shows up regularly when I think about what lies ahead',
    opt_d:'Significant anxiety — my professional future feels unclear or threatening in a way that affects me daily' },
  { item_code:'PRO_CAREER_CUR_05', concern_name:'Career Anxiety', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Purpose Clarity',
    question_type:'likert_agree',
    question:'I feel genuinely unclear about what I want from my career.' },
  { item_code:'PRO_CAREER_CUR_06', concern_name:'Career Anxiety', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Direction Persistence',
    question:'I start exploring a new career direction but lose confidence or momentum before following through.' },
  { item_code:'PRO_CAREER_CUR_07', concern_name:'Career Anxiety', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Role Alignment',
    question_type:'mcq',
    question:'How would you describe the fit between your current role and your genuine strengths?',
    opt_a:'Strong alignment — I do work that genuinely draws on who I am',
    opt_b:'Partial fit — some suits me, but parts feel draining or disconnected',
    opt_c:'More misalignment than fit — much of the work feels off-target for me',
    opt_d:'Significantly stuck — the role feels very misaligned with my strengths and authentic drive' },
  { item_code:'PRO_CAREER_CUR_08', concern_name:'Career Anxiety', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Opportunity Anxiety',
    question_type:'likert_agree',
    question:'I worry that I am missing the right opportunity or permanently falling behind in my career.' },
  { item_code:'PRO_CAREER_CUR_09', concern_name:'Career Anxiety', stage_code:'CAP_CUR', weight:1.1, polarity:'(-)', subdomain_code:'Decision Making',
    question:'I find it hard to make career decisions without second-guessing myself.' },
  { item_code:'PRO_CAREER_CUR_10', concern_name:'Career Anxiety', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Meaning at Work',
    question:'I feel a disconnect between my daily work and a sense of larger purpose.' },

  // ── CAREER ANXIETY ─ CAP_INS ─────────────────────────────────────────────
  { item_code:'PRO_CAREER_INS_01', concern_name:'Career Anxiety', stage_code:'CAP_INS', weight:1.2, polarity:'(+)', subdomain_code:'Fear Identification',  question:'I can identify the specific fears or beliefs driving my career anxiety.' },
  { item_code:'PRO_CAREER_INS_02', concern_name:'Career Anxiety', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'External Influence',   question:'I understand how external expectations are influencing my career choices.' },
  { item_code:'PRO_CAREER_INS_03', concern_name:'Career Anxiety', stage_code:'CAP_INS', weight:1.1, polarity:'(+)', subdomain_code:'Energy Mapping',       question:'I recognise patterns in the types of work that energise versus drain me.' },
  { item_code:'PRO_CAREER_INS_04', concern_name:'Career Anxiety', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Authentic Desire',     question:'I can distinguish between what I genuinely want and what I feel I should want.' },
  { item_code:'PRO_CAREER_INS_05', concern_name:'Career Anxiety', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Anxiety Impact',       question:'I understand how my current anxiety is affecting my professional decisions.' },
  { item_code:'PRO_CAREER_INS_06', concern_name:'Career Anxiety', stage_code:'CAP_INS', weight:1.1, polarity:'(+)', subdomain_code:'Avoidance Awareness',  question:'I notice when I am avoiding career decisions rather than actively making them.' },
  { item_code:'PRO_CAREER_INS_07', concern_name:'Career Anxiety', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Strengths Insight',    question:'I understand how my skills and strengths connect to viable career paths.' },
  { item_code:'PRO_CAREER_INS_08', concern_name:'Career Anxiety', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Peak Moments',         question:'I can identify the moments in my career where I have felt most alive and engaged.' },
  { item_code:'PRO_CAREER_INS_09', concern_name:'Career Anxiety', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Identity Insight',     question:'I understand how my experiences and background shape my professional identity.' },
  { item_code:'PRO_CAREER_INS_10', concern_name:'Career Anxiety', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Fear vs Caution',      question:'I notice when fear of failure is masking as practical caution in my decisions.' },

  // ── CAREER ANXIETY ─ CAP_GRW ─────────────────────────────────────────────
  { item_code:'PRO_CAREER_GRW_01', concern_name:'Career Anxiety', stage_code:'CAP_GRW', weight:1.2, polarity:'(+)', subdomain_code:'Values Clarification', question:'I am actively building clarity about my values and what matters most in my career.' },
  { item_code:'PRO_CAREER_GRW_02', concern_name:'Career Anxiety', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Direction Exploration', question:'I am taking concrete steps to explore new career directions or opportunities.' },
  { item_code:'PRO_CAREER_GRW_03', concern_name:'Career Anxiety', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Skill Building',       question:'I am investing in developing skills aligned with my intended career path.' },
  { item_code:'PRO_CAREER_GRW_04', concern_name:'Career Anxiety', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Network Building',     question:'I am building a professional network of people who can support or guide my career.' },
  { item_code:'PRO_CAREER_GRW_05', concern_name:'Career Anxiety', stage_code:'CAP_GRW', weight:1.1, polarity:'(+)', subdomain_code:'Goal Setting',         question:'I set small, achievable career goals to build momentum and reduce anxiety.' },
  { item_code:'PRO_CAREER_GRW_06', concern_name:'Career Anxiety', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Feedback Seeking',     question:'I seek regular feedback to calibrate my performance and career direction.' },
  { item_code:'PRO_CAREER_GRW_07', concern_name:'Career Anxiety', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Achievement Visibility', question:'I am documenting and communicating my professional achievements more intentionally.' },
  { item_code:'PRO_CAREER_GRW_08', concern_name:'Career Anxiety', stage_code:'CAP_GRW', weight:1.1, polarity:'(+)', subdomain_code:'Coaching & Reflection', question:'I use coaching, mentoring, or structured reflection to gain career clarity.' },
  { item_code:'PRO_CAREER_GRW_09', concern_name:'Career Anxiety', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Self-Worth Separation', question:'I am separating my self-worth from my current career position or title.' },
  { item_code:'PRO_CAREER_GRW_10', concern_name:'Career Anxiety', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Curiosity Mindset',    question:'I approach career uncertainty with curiosity rather than fear or avoidance.' },

  // ── CAREER ANXIETY ─ CAP_MAS ─────────────────────────────────────────────
  { item_code:'PRO_CAREER_MAS_01', concern_name:'Career Anxiety', stage_code:'CAP_MAS', weight:1.2, polarity:'(+)', subdomain_code:'Direction Clarity',    question:'I have a clear and grounded sense of the career direction I want to pursue.' },
  { item_code:'PRO_CAREER_MAS_02', concern_name:'Career Anxiety', stage_code:'CAP_MAS', weight:1.1, polarity:'(+)', subdomain_code:'Decision Confidence',  question:'I make career decisions from a place of clarity and confidence, not fear.' },
  { item_code:'PRO_CAREER_MAS_03', concern_name:'Career Anxiety', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Values Alignment',     question:'I am building a career that genuinely aligns with my values and strengths.' },
  { item_code:'PRO_CAREER_MAS_04', concern_name:'Career Anxiety', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Resilience',           question:'I use career setbacks or rejections as useful data rather than signs of failure.' },
  { item_code:'PRO_CAREER_MAS_05', concern_name:'Career Anxiety', stage_code:'CAP_MAS', weight:1.1, polarity:'(+)', subdomain_code:'Intrinsic Motivation', question:'My career choices are not driven by comparison with what others are doing.' },
  { item_code:'PRO_CAREER_MAS_06', concern_name:'Career Anxiety', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Long-Term Vision',     question:'I have a long-term career vision that I am actively and deliberately working toward.' },
  { item_code:'PRO_CAREER_MAS_07', concern_name:'Career Anxiety', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Sense of Purpose',     question:'I feel a clear sense of purpose and meaning in the work I do day to day.' },
  { item_code:'PRO_CAREER_MAS_08', concern_name:'Career Anxiety', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Peer Influence',        question:'Others seek my perspective on career-related decisions and professional direction.' },
  { item_code:'PRO_CAREER_MAS_09', concern_name:'Career Anxiety', stage_code:'CAP_MAS', weight:1.1, polarity:'(+)', subdomain_code:'Professional Voice',   question:'I confidently articulate my professional value and direction to others.' },
  { item_code:'PRO_CAREER_MAS_10', concern_name:'Career Anxiety', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Proactive Development', question:'I proactively manage my career development rather than waiting for opportunities.' },
];

// ─── Student Question Banks — 5 concerns × 4 stages × 10 questions = 200 items ──
const STUDENT_QUESTIONS: Array<{
  item_code: string; question: string; weight: number; polarity: string;
  stage_code: string; concern_name: string; subdomain_code: string;
  question_type?: string; opt_a?: string; opt_b?: string; opt_c?: string; opt_d?: string;
}> = [
  // ── EXAM STRESS ─ CAP_CUR ─────────────────────────────────────────────────
  { item_code:'STU_STRESS_CUR_01', concern_name:'Exam Stress', stage_code:'CAP_CUR', weight:1.2, polarity:'(-)', subdomain_code:'Stress Reactivity',
    question_type:'mcq',
    question:'When an important exam or assessment is coming up, how does your body typically respond in the days before it?',
    opt_a:'Focused pressure that does not physically disrupt me',
    opt_b:'Some tension or restlessness, but manageable',
    opt_c:'Clear physical signs — racing heart, tight stomach, difficulty relaxing',
    opt_d:'Intense physical responses that significantly disturb my sleep and daily functioning' },
  { item_code:'STU_STRESS_CUR_02', concern_name:'Exam Stress', stage_code:'CAP_CUR', weight:1.1, polarity:'(-)', subdomain_code:'Sleep & Recovery',
    question_type:'likert_agree',
    question:'I struggle to sleep properly in the nights leading up to a test or exam.' },
  { item_code:'STU_STRESS_CUR_03', concern_name:'Exam Stress', stage_code:'CAP_CUR', weight:1.2, polarity:'(-)', subdomain_code:'Cognitive Control',
    question:'I blank out or freeze during exams, even when I know the material well.' },
  { item_code:'STU_STRESS_CUR_04', concern_name:'Exam Stress', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Pressure Tolerance',
    question_type:'mcq',
    question:'How does the academic pressure you are currently carrying feel to you?',
    opt_a:'Like healthy challenge — it pushes me without overwhelming me',
    opt_b:'Heavy at times, but I manage to stay on top of it',
    opt_c:'Often overwhelming — it regularly feels like more than I can handle',
    opt_d:'Crushing — the weight of expectations feels impossible to shake' },
  { item_code:'STU_STRESS_CUR_05', concern_name:'Exam Stress', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Emotional Regulation',
    question_type:'likert_agree',
    question:'Worry about disappointing parents or teachers significantly affects how I feel about myself.' },
  { item_code:'STU_STRESS_CUR_06', concern_name:'Exam Stress', stage_code:'CAP_CUR', weight:1.1, polarity:'(-)', subdomain_code:'Energy Management',
    question:'I feel exhausted from managing study demands on top of everything else in my life.' },
  { item_code:'STU_STRESS_CUR_07', concern_name:'Exam Stress', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Anticipatory Stress',
    question_type:'mcq',
    question:'In the days before a major exam, which best describes the emotional tone you live with?',
    opt_a:'Mostly calm with a productive preparation focus',
    opt_b:'Some nerves — but proportionate and mostly manageable',
    opt_c:'A lingering sense of dread I carry throughout the day',
    opt_d:'Intense anticipatory stress that disrupts my sleep, concentration, and relationships' },
  { item_code:'STU_STRESS_CUR_08', concern_name:'Exam Stress', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Self-Efficacy',
    question_type:'likert_agree',
    question:'No matter how much I study, it never feels like enough to be adequately prepared.' },
  { item_code:'STU_STRESS_CUR_09', concern_name:'Exam Stress', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Social Comparison',
    question:'I compare my academic performance with classmates and feel worse about myself.' },
  { item_code:'STU_STRESS_CUR_10', concern_name:'Exam Stress', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Stress Spillover',
    question:'My stress from school spills over into my home life and personal time.' },
  // ── EXAM STRESS ─ CAP_INS ─────────────────────────────────────────────────
  { item_code:'STU_STRESS_INS_01', concern_name:'Exam Stress', stage_code:'CAP_INS', weight:1.2, polarity:'(+)', subdomain_code:'Self-Awareness',            question:'I can identify the specific moment my stress starts to spiral before exams.' },
  { item_code:'STU_STRESS_INS_02', concern_name:'Exam Stress', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Trigger Recognition',       question:'I understand which subjects or topics trigger my most intense stress.' },
  { item_code:'STU_STRESS_INS_03', concern_name:'Exam Stress', stage_code:'CAP_INS', weight:1.1, polarity:'(+)', subdomain_code:'Cognitive Insight',         question:'I notice how stress affects my memory and recall during exams.' },
  { item_code:'STU_STRESS_INS_04', concern_name:'Exam Stress', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Pressure Insight',          question:'I can recognise when pressure is motivating me versus when it is harming me.' },
  { item_code:'STU_STRESS_INS_05', concern_name:'Exam Stress', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Sleep Insight',             question:'I understand the connection between sleep quality and my exam performance.' },
  { item_code:'STU_STRESS_INS_06', concern_name:'Exam Stress', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Coping Pattern',            question:'I see a pattern in how I cope (or avoid) when study stress builds up.' },
  { item_code:'STU_STRESS_INS_07', concern_name:'Exam Stress', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Thought Awareness',         question:'I understand how thoughts like "I will fail" affect my actual performance.' },
  { item_code:'STU_STRESS_INS_08', concern_name:'Exam Stress', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Body Signals',              question:'I can spot the physical signs that I am getting overwhelmed by study pressure.' },
  { item_code:'STU_STRESS_INS_09', concern_name:'Exam Stress', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Habit Insight',             question:'I know which study habits make my stress worse and which ones help.' },
  { item_code:'STU_STRESS_INS_10', concern_name:'Exam Stress', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Root Cause Analysis',       question:'I understand what causes me more stress — the content, time pressure, or expectations.' },
  // ── EXAM STRESS ─ CAP_GRW ─────────────────────────────────────────────────
  { item_code:'STU_STRESS_GRW_01', concern_name:'Exam Stress', stage_code:'CAP_GRW', weight:1.2, polarity:'(+)', subdomain_code:'Pre-Exam Routine',          question:'I use a pre-exam routine to calm my nerves before starting.' },
  { item_code:'STU_STRESS_GRW_02', concern_name:'Exam Stress', stage_code:'CAP_GRW', weight:1.1, polarity:'(+)', subdomain_code:'Study Planning',            question:'I break study material into manageable chunks to reduce feeling overwhelmed.' },
  { item_code:'STU_STRESS_GRW_03', concern_name:'Exam Stress', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Breathing & Grounding',     question:'I use breathing or grounding techniques when stress spikes during study.' },
  { item_code:'STU_STRESS_GRW_04', concern_name:'Exam Stress', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Support Seeking',            question:'I speak to someone I trust when academic pressure becomes too much.' },
  { item_code:'STU_STRESS_GRW_05', concern_name:'Exam Stress', stage_code:'CAP_GRW', weight:1.1, polarity:'(+)', subdomain_code:'Sleep Discipline',          question:'I prioritise sleep in the days before exams rather than staying up all night.' },
  { item_code:'STU_STRESS_GRW_06', concern_name:'Exam Stress', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Resilient Reframing',       question:'I reframe setbacks like a bad test result as feedback rather than failure.' },
  { item_code:'STU_STRESS_GRW_07', concern_name:'Exam Stress', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Goal Setting',              question:'I set realistic study goals each day instead of trying to do everything at once.' },
  { item_code:'STU_STRESS_GRW_08', concern_name:'Exam Stress', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Rest Discipline',           question:'I take proper breaks during study sessions to prevent mental exhaustion.' },
  { item_code:'STU_STRESS_GRW_09', concern_name:'Exam Stress', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Focus Management',          question:'I reduce distractions deliberately when I notice I am stressed and need to focus.' },
  { item_code:'STU_STRESS_GRW_10', concern_name:'Exam Stress', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Confidence Building',       question:'I remind myself of past successes to balance anxious thoughts about failure.' },
  // ── EXAM STRESS ─ CAP_MAS ─────────────────────────────────────────────────
  { item_code:'STU_STRESS_MAS_01', concern_name:'Exam Stress', stage_code:'CAP_MAS', weight:1.2, polarity:'(+)', subdomain_code:'Composure Under Pressure',  question:'I remain calm and perform at my best even during high-pressure exams.' },
  { item_code:'STU_STRESS_MAS_02', concern_name:'Exam Stress', stage_code:'CAP_MAS', weight:1.1, polarity:'(+)', subdomain_code:'Resilience',                question:'I recover quickly from unexpected results without it derailing my focus.' },
  { item_code:'STU_STRESS_MAS_03', concern_name:'Exam Stress', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Consistency',               question:'My study and wellbeing routines stay consistent even during exam season.' },
  { item_code:'STU_STRESS_MAS_04', concern_name:'Exam Stress', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Expectation Management',    question:'I handle parental or teacher expectations without internalising them as threats.' },
  { item_code:'STU_STRESS_MAS_05', concern_name:'Exam Stress', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Exam Composure',            question:'I can enter an exam hall feeling prepared and composed, not just prepared.' },
  { item_code:'STU_STRESS_MAS_06', concern_name:'Exam Stress', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Productive Pressure',       question:'I use pressure productively — it sharpens my focus rather than distorting it.' },
  { item_code:'STU_STRESS_MAS_07', concern_name:'Exam Stress', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Healthy Perspective',       question:'I maintain perspective about exams as one measure of learning, not my worth.' },
  { item_code:'STU_STRESS_MAS_08', concern_name:'Exam Stress', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Peer Support',              question:'I help peers manage their stress without absorbing their anxiety into myself.' },
  { item_code:'STU_STRESS_MAS_09', concern_name:'Exam Stress', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Preventive Systems',        question:'I have built systems that prevent study stress from accumulating.' },
  { item_code:'STU_STRESS_MAS_10', concern_name:'Exam Stress', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Identity Stability',        question:'My confidence remains stable regardless of my academic results.' },

  // ── ANXIETY & OVERTHINKING ─ CAP_CUR ──────────────────────────────────────
  { item_code:'STU_ANXTY_CUR_01', concern_name:'Anxiety & Overthinking', stage_code:'CAP_CUR', weight:1.2, polarity:'(-)', subdomain_code:'Intrusive Thoughts',
    question_type:'mcq',
    question:'When "what if" thoughts arrive, what best describes how they typically unfold for you?',
    opt_a:'They pass through quickly — I notice them and move on',
    opt_b:'They linger briefly but I can redirect my focus without much difficulty',
    opt_c:'They pull me in and require real effort to escape',
    opt_d:'They spiral — one leads to another and I get caught in loops for extended periods' },
  { item_code:'STU_ANXTY_CUR_02', concern_name:'Anxiety & Overthinking', stage_code:'CAP_CUR', weight:1.1, polarity:'(-)', subdomain_code:'Background Worry',
    question_type:'likert_agree',
    question:'I worry about things going wrong even when everything around me currently seems fine.' },
  { item_code:'STU_ANXTY_CUR_03', concern_name:'Anxiety & Overthinking', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Baseline Anxiety',
    question:'I feel generally on edge or nervous without always knowing why.' },
  { item_code:'STU_ANXTY_CUR_04', concern_name:'Anxiety & Overthinking', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Rumination',
    question_type:'mcq',
    question:'After an awkward or difficult conversation or situation, what tends to happen in your mind?',
    opt_a:'I process it briefly and let it go within the same day',
    opt_b:'I replay it once or twice, then move on fairly quickly',
    opt_c:'I replay it repeatedly over days, wishing I had said something different',
    opt_d:'It stays with me for a long time and the replaying causes real distress' },
  { item_code:'STU_ANXTY_CUR_05', concern_name:'Anxiety & Overthinking', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Avoidance',
    question_type:'likert_agree',
    question:'I avoid situations I believe will make me anxious, even when I genuinely want to face them.' },
  { item_code:'STU_ANXTY_CUR_06', concern_name:'Anxiety & Overthinking', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Somatic Signals',
    question:'I experience physical symptoms (tight chest, stomach discomfort, tension) when anxious.' },
  { item_code:'STU_ANXTY_CUR_07', concern_name:'Anxiety & Overthinking', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Decision Paralysis',
    question_type:'mcq',
    question:'When you face a decision with no obviously right answer, what typically happens?',
    opt_a:'I gather information, commit to a decision, and move on',
    opt_b:'I take longer than I would like but eventually make a choice',
    opt_c:'I cycle through options repeatedly without landing — it becomes tiring',
    opt_d:'I feel genuinely paralysed — the fear of choosing wrongly often stops me from deciding at all' },
  { item_code:'STU_ANXTY_CUR_08', concern_name:'Anxiety & Overthinking', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Catastrophising',
    question_type:'likert_agree',
    question:'My mind tends to jump to worst-case scenarios before events or situations that feel uncertain.' },
  { item_code:'STU_ANXTY_CUR_09', concern_name:'Anxiety & Overthinking', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Uncertainty Tolerance',
    question:'Small unknowns or uncertainties cause me a disproportionate amount of worry.' },
  { item_code:'STU_ANXTY_CUR_10', concern_name:'Anxiety & Overthinking', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Opportunity Cost',
    question:'My anxiety gets in the way of me trying new things or taking up opportunities.' },
  // ── ANXIETY & OVERTHINKING ─ CAP_INS ──────────────────────────────────────
  { item_code:'STU_ANXTY_INS_01', concern_name:'Anxiety & Overthinking', stage_code:'CAP_INS', weight:1.2, polarity:'(+)', subdomain_code:'Trigger Awareness',      question:'I can identify the specific thoughts or situations that start my anxiety.' },
  { item_code:'STU_ANXTY_INS_02', concern_name:'Anxiety & Overthinking', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Pattern Recognition',    question:'I notice a pattern in when my overthinking is most intense.' },
  { item_code:'STU_ANXTY_INS_03', concern_name:'Anxiety & Overthinking', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Worry Distinction',      question:'I understand the difference between useful preparation and harmful rumination.' },
  { item_code:'STU_ANXTY_INS_04', concern_name:'Anxiety & Overthinking', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Avoidance Insight',      question:'I see how my avoidance behaviours make anxiety worse over time.' },
  { item_code:'STU_ANXTY_INS_05', concern_name:'Anxiety & Overthinking', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Reality Testing',        question:'I recognise when my anxiety is based on fact versus an imagined threat.' },
  { item_code:'STU_ANXTY_INS_06', concern_name:'Anxiety & Overthinking', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Relational Impact',      question:'I understand how my anxiety affects those around me or my relationships.' },
  { item_code:'STU_ANXTY_INS_07', concern_name:'Anxiety & Overthinking', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Physical Awareness',     question:'I can spot the physical sensations that signal anxiety is building.' },
  { item_code:'STU_ANXTY_INS_08', concern_name:'Anxiety & Overthinking', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Situational Insight',    question:'I know which environments or situations reliably increase my anxiety level.' },
  { item_code:'STU_ANXTY_INS_09', concern_name:'Anxiety & Overthinking', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Sleep Insight',          question:'I understand how sleep deprivation and overthinking feed each other.' },
  { item_code:'STU_ANXTY_INS_10', concern_name:'Anxiety & Overthinking', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Control Insight',        question:'I see the connection between trying to control outcomes and my anxiety levels.' },
  // ── ANXIETY & OVERTHINKING ─ CAP_GRW ──────────────────────────────────────
  { item_code:'STU_ANXTY_GRW_01', concern_name:'Anxiety & Overthinking', stage_code:'CAP_GRW', weight:1.2, polarity:'(+)', subdomain_code:'Grounding Techniques',   question:'I use a grounding technique (breathing, 5-4-3-2-1) when anxiety spikes.' },
  { item_code:'STU_ANXTY_GRW_02', concern_name:'Anxiety & Overthinking', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Cognitive Challenge',    question:'I challenge anxious thoughts by asking "how likely is this really to happen?"' },
  { item_code:'STU_ANXTY_GRW_03', concern_name:'Anxiety & Overthinking', stage_code:'CAP_GRW', weight:1.1, polarity:'(+)', subdomain_code:'Action Despite Anxiety', question:'I act despite anxiety rather than waiting to feel ready first.' },
  { item_code:'STU_ANXTY_GRW_04', concern_name:'Anxiety & Overthinking', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Worry Time Limits',      question:'I limit how long I spend on "what if" thinking each day.' },
  { item_code:'STU_ANXTY_GRW_05', concern_name:'Anxiety & Overthinking', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Openness',               question:'I communicate my worries to someone I trust instead of bottling them up.' },
  { item_code:'STU_ANXTY_GRW_06', concern_name:'Anxiety & Overthinking', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Media Management',       question:'I reduce exposure to social media or news content that spikes my anxiety.' },
  { item_code:'STU_ANXTY_GRW_07', concern_name:'Anxiety & Overthinking', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Physical Discharge',     question:'I use physical movement — exercise, walks — to release anxious energy.' },
  { item_code:'STU_ANXTY_GRW_08', concern_name:'Anxiety & Overthinking', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Externalising',          question:'I write down worries to externalise them and reduce mental looping.' },
  { item_code:'STU_ANXTY_GRW_09', concern_name:'Anxiety & Overthinking', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Uncertainty Tolerance',  question:'I practise sitting with uncertainty without needing to resolve it immediately.' },
  { item_code:'STU_ANXTY_GRW_10', concern_name:'Anxiety & Overthinking', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Courage Tracking',       question:'I celebrate small acts of courage that push against my avoidance patterns.' },
  // ── ANXIETY & OVERTHINKING ─ CAP_MAS ──────────────────────────────────────
  { item_code:'STU_ANXTY_MAS_01', concern_name:'Anxiety & Overthinking', stage_code:'CAP_MAS', weight:1.2, polarity:'(+)', subdomain_code:'Functional Courage',     question:'I face anxiety-provoking situations and function effectively through them.' },
  { item_code:'STU_ANXTY_MAS_02', concern_name:'Anxiety & Overthinking', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Expanded Agency',        question:'My anxiety no longer significantly limits the choices I make.' },
  { item_code:'STU_ANXTY_MAS_03', concern_name:'Anxiety & Overthinking', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Recovery Speed',         question:'I recover from anxious episodes quickly without days of residual worry.' },
  { item_code:'STU_ANXTY_MAS_04', concern_name:'Anxiety & Overthinking', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Ambiguity Tolerance',    question:'I tolerate ambiguity and uncertainty without significant distress.' },
  { item_code:'STU_ANXTY_MAS_05', concern_name:'Anxiety & Overthinking', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Signal Reading',         question:'I recognise anxiety as useful information, not a threat to suppress.' },
  { item_code:'STU_ANXTY_MAS_06', concern_name:'Anxiety & Overthinking', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Default Orientation',    question:'My default orientation toward new situations is curiosity rather than dread.' },
  { item_code:'STU_ANXTY_MAS_07', concern_name:'Anxiety & Overthinking', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Stability Under Load',   question:'I help others manage anxiety without my own being triggered.' },
  { item_code:'STU_ANXTY_MAS_08', concern_name:'Anxiety & Overthinking', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Protective Habits',      question:'I have built habits that keep my baseline anxiety low consistently.' },
  { item_code:'STU_ANXTY_MAS_09', concern_name:'Anxiety & Overthinking', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Thought Clarity',        question:'I can distinguish between productive caution and unhelpful catastrophising.' },
  { item_code:'STU_ANXTY_MAS_10', concern_name:'Anxiety & Overthinking', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Bold Decision-Making',   question:'I make bold decisions even when outcome certainty is low.' },

  // ── LOW MOTIVATION ─ CAP_CUR ──────────────────────────────────────────────
  { item_code:'STU_MOTIV_CUR_01', concern_name:'Low Motivation', stage_code:'CAP_CUR', weight:1.2, polarity:'(-)', subdomain_code:'Task Initiation',
    question_type:'mcq',
    question:'When you need to start something important, which of these most accurately describes what typically happens?',
    opt_a:'I generally start within a reasonable time after deciding to do it',
    opt_b:'I delay briefly — half an hour or so — then get going',
    opt_c:'Starting takes significant effort — I often spend hours finding ways around beginning',
    opt_d:'I can go days without starting things I care about, depending entirely on external pressure' },
  { item_code:'STU_MOTIV_CUR_02', concern_name:'Low Motivation', stage_code:'CAP_CUR', weight:1.1, polarity:'(-)', subdomain_code:'Energy Depletion',
    question_type:'likert_agree',
    question:'I feel a general lack of energy or enthusiasm for things I used to enjoy.' },
  { item_code:'STU_MOTIV_CUR_03', concern_name:'Low Motivation', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Purpose Gap',
    question:'I feel a sense of "what\'s the point?" when facing academic goals or personal projects.' },
  { item_code:'STU_MOTIV_CUR_04', concern_name:'Low Motivation', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Delay Habit',
    question_type:'mcq',
    question:'When you have something to do and no pressing deadline, what most often happens?',
    opt_a:'I usually get to it the same day or the next',
    opt_b:'I get it done within a few days, even if I need a reminder',
    opt_c:'Without a deadline, I push it back repeatedly over weeks',
    opt_d:'Tasks without deadlines frequently go undone — I depend on external pressure to act' },
  { item_code:'STU_MOTIV_CUR_05', concern_name:'Low Motivation', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Directionlessness',
    question_type:'likert_agree',
    question:'I feel disconnected from any real sense of purpose or direction in my daily life.' },
  { item_code:'STU_MOTIV_CUR_06', concern_name:'Low Motivation', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'External Dependency',
    question:'I rely on parents, teachers, or others to nudge me before I start getting things done.' },
  { item_code:'STU_MOTIV_CUR_07', concern_name:'Low Motivation', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Disengagement',
    question_type:'mcq',
    question:'Across your current activities — school, hobbies, social life — how engaged do you generally feel?',
    opt_a:'Generally engaged — things feel meaningful and I look forward to them',
    opt_b:'Mixed — some things hold my interest; others feel flat',
    opt_c:'Mostly flat — it is hard to feel genuinely interested or excited about most things',
    opt_d:'Largely disengaged — almost nothing feels worth showing up for' },
  { item_code:'STU_MOTIV_CUR_08', concern_name:'Low Motivation', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Persistence Deficit',
    question_type:'likert_agree',
    question:'I notice I give up on things faster than I used to — my follow-through has declined.' },
  { item_code:'STU_MOTIV_CUR_09', concern_name:'Low Motivation', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Helplessness',
    question:'I feel like nothing I do will really make a meaningful difference.' },
  { item_code:'STU_MOTIV_CUR_10', concern_name:'Low Motivation', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Minimum Effort',
    question:'I tend to do only the minimum required rather than pushing myself to go further.' },
  // ── LOW MOTIVATION ─ CAP_INS ──────────────────────────────────────────────
  { item_code:'STU_MOTIV_INS_01', concern_name:'Low Motivation', stage_code:'CAP_INS', weight:1.2, polarity:'(+)', subdomain_code:'Drain Identification',      question:'I can identify what specifically drains my motivation — boredom, fear, or meaninglessness.' },
  { item_code:'STU_MOTIV_INS_02', concern_name:'Low Motivation', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Lifestyle Insight',         question:'I understand the connection between sleep, exercise, and my energy levels.' },
  { item_code:'STU_MOTIV_INS_03', concern_name:'Low Motivation', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Fear-vs-Laziness',          question:'I notice when I am avoiding tasks because of fear of failure, not just laziness.' },
  { item_code:'STU_MOTIV_INS_04', concern_name:'Low Motivation', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Energy Patterns',           question:'I can see a pattern in when my motivation is high versus when it crashes.' },
  { item_code:'STU_MOTIV_INS_05', concern_name:'Low Motivation', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Goal Quality',              question:'I understand how setting unclear or unrealistic goals affects my follow-through.' },
  { item_code:'STU_MOTIV_INS_06', concern_name:'Low Motivation', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Comparison Impact',         question:'I recognise how comparison with others or social media impacts my drive.' },
  { item_code:'STU_MOTIV_INS_07', concern_name:'Low Motivation', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Emotional Drain',           question:'I see how unresolved emotions — stress, sadness, anger — reduce my motivation.' },
  { item_code:'STU_MOTIV_INS_08', concern_name:'Low Motivation', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Action Insight',            question:'I understand that waiting to "feel motivated" before starting usually backfires.' },
  { item_code:'STU_MOTIV_INS_09', concern_name:'Low Motivation', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Recharge Activities',       question:'I know which activities or people tend to restore my energy and enthusiasm.' },
  { item_code:'STU_MOTIV_INS_10', concern_name:'Low Motivation', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Autonomy Insight',          question:'I can see the link between a lack of control over my time and my reduced engagement.' },
  // ── LOW MOTIVATION ─ CAP_GRW ──────────────────────────────────────────────
  { item_code:'STU_MOTIV_GRW_01', concern_name:'Low Motivation', stage_code:'CAP_GRW', weight:1.2, polarity:'(+)', subdomain_code:'Two-Minute Rule',           question:'I use the "2-minute rule" — start for just 2 minutes — to break the inertia.' },
  { item_code:'STU_MOTIV_GRW_02', concern_name:'Low Motivation', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Purpose Linking',           question:'I connect tasks to a personal goal I genuinely care about to find meaning.' },
  { item_code:'STU_MOTIV_GRW_03', concern_name:'Low Motivation', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Energy Habits',             question:'I protect sleep and exercise habits because I know they fuel my energy.' },
  { item_code:'STU_MOTIV_GRW_04', concern_name:'Low Motivation', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Micro-Tasking',             question:'I break large tasks into tiny first steps and focus only on the next one.' },
  { item_code:'STU_MOTIV_GRW_05', concern_name:'Low Motivation', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Progress Tracking',         question:'I track small wins each day to build momentum and a sense of progress.' },
  { item_code:'STU_MOTIV_GRW_06', concern_name:'Low Motivation', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Morning Discipline',        question:'I limit time-wasting habits in the morning that deplete motivation.' },
  { item_code:'STU_MOTIV_GRW_07', concern_name:'Low Motivation', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Energy Sequencing',         question:'I schedule creative or exciting work first to build energy for harder tasks.' },
  { item_code:'STU_MOTIV_GRW_08', concern_name:'Low Motivation', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Drain Reduction',           question:'I identify and reduce energy drains — people, tasks, or environments that exhaust me.' },
  { item_code:'STU_MOTIV_GRW_09', concern_name:'Low Motivation', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Reward Anchoring',          question:'I use a reward or celebration when I complete something I was avoiding.' },
  { item_code:'STU_MOTIV_GRW_10', concern_name:'Low Motivation', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Purpose Reconnect',         question:'I revisit my personal "why" or core values when motivation dips.' },
  // ── LOW MOTIVATION ─ CAP_MAS ──────────────────────────────────────────────
  { item_code:'STU_MOTIV_MAS_01', concern_name:'Low Motivation', stage_code:'CAP_MAS', weight:1.2, polarity:'(+)', subdomain_code:'Autonomous Action',         question:'I initiate action consistently without needing to feel motivated first.' },
  { item_code:'STU_MOTIV_MAS_02', concern_name:'Low Motivation', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Self-Generating Routine',   question:'I have a daily routine that generates energy and momentum automatically.' },
  { item_code:'STU_MOTIV_MAS_03', concern_name:'Low Motivation', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Purpose Anchoring',         question:'I stay engaged with challenging or tedious tasks by connecting them to purpose.' },
  { item_code:'STU_MOTIV_MAS_04', concern_name:'Low Motivation', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Slump Recovery',            question:'I recover from motivational slumps quickly using systems rather than willpower.' },
  { item_code:'STU_MOTIV_MAS_05', concern_name:'Low Motivation', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Environment Design',        question:'I create conditions that make motivation easy — environment, habits, social context.' },
  { item_code:'STU_MOTIV_MAS_06', concern_name:'Low Motivation', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Output Consistency',        question:'My work and study output remain consistent even when enthusiasm fluctuates.' },
  { item_code:'STU_MOTIV_MAS_07', concern_name:'Low Motivation', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Peer Inspiration',          question:'I encourage and motivate others without losing my own drive.' },
  { item_code:'STU_MOTIV_MAS_08', concern_name:'Low Motivation', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Intrinsic Drive',           question:'I have built genuine intrinsic motivation in my most important areas of life.' },
  { item_code:'STU_MOTIV_MAS_09', concern_name:'Low Motivation', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Self-Generated Energy',     question:'I can generate excitement and energy around a goal I have personally chosen.' },
  { item_code:'STU_MOTIV_MAS_10', concern_name:'Low Motivation', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Worth Independence',        question:'I separate my sense of worth from my productivity, which sustains long-term drive.' },

  // ── ANGER & IMPULSE ─ CAP_CUR ─────────────────────────────────────────────
  { item_code:'STU_ANGER_CUR_01', concern_name:'Anger & Impulse', stage_code:'CAP_CUR', weight:1.2, polarity:'(-)', subdomain_code:'Reactive Outbursts',
    question_type:'mcq',
    question:'When you react in anger and later look back on it, which best describes what typically happens?',
    opt_a:'I rarely say or do things I regret — I usually manage to pause first',
    opt_b:'Occasionally I react in a way I later wish I had handled differently',
    opt_c:'Fairly often — I say or do things in anger that I later regret',
    opt_d:'Regularly — my angry reactions create consequences I then have to manage' },
  { item_code:'STU_ANGER_CUR_02', concern_name:'Anger & Impulse', stage_code:'CAP_CUR', weight:1.1, polarity:'(-)', subdomain_code:'Anger Surges',
    question_type:'likert_agree',
    question:'I experience sudden surges of anger that feel very difficult or impossible to control in the moment.' },
  { item_code:'STU_ANGER_CUR_03', concern_name:'Anger & Impulse', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Disproportionate Reaction',
    question:'Small frustrations trigger an emotional reaction that feels disproportionate to the situation.' },
  { item_code:'STU_ANGER_CUR_04', concern_name:'Anger & Impulse', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Recovery Difficulty',
    question_type:'mcq',
    question:'Once you have lost your temper or become really angry, how does recovery typically go for you?',
    opt_a:'I calm down within a few minutes and move past it quickly',
    opt_b:'It takes roughly half an hour to an hour to fully decompress',
    opt_c:'I stay activated for several hours and find it hard to let go',
    opt_d:'It lingers for most of the day or longer — anger does not dissipate easily for me' },
  { item_code:'STU_ANGER_CUR_05', concern_name:'Anger & Impulse', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Conflict Escalation',
    question_type:'likert_agree',
    question:'Arguments tend to escalate quickly when I am involved, becoming more intense than I intended.' },
  { item_code:'STU_ANGER_CUR_06', concern_name:'Anger & Impulse', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Physical Arousal',
    question:'I experience strong physical reactions (flushed face, clenched fists, racing heart) when angry.' },
  { item_code:'STU_ANGER_CUR_07', concern_name:'Anger & Impulse', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Impulsive Action',
    question_type:'mcq',
    question:'When you feel a strong impulse to act or react in a heated moment, what typically happens?',
    opt_a:'I almost always pause and think before I act',
    opt_b:'I sometimes act impulsively but catch myself most of the time',
    opt_c:'My impulses often drive my actions before I have considered the consequences',
    opt_d:'I consistently act on impulse in heated moments — the response comes before any thought' },
  { item_code:'STU_ANGER_CUR_08', concern_name:'Anger & Impulse', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Frustration Intolerance',
    question_type:'likert_agree',
    question:'Waiting, delays, or being interrupted frustrate me in a way that noticeably affects my mood or behaviour.' },
  { item_code:'STU_ANGER_CUR_09', concern_name:'Anger & Impulse', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Assertiveness Deficit',
    question:'I struggle to express disagreement or frustration without it turning into conflict.' },
  { item_code:'STU_ANGER_CUR_10', concern_name:'Anger & Impulse', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Relationship Damage',
    question:'My anger or impulsive behaviour has damaged a relationship or situation I genuinely cared about.' },
  // ── ANGER & IMPULSE ─ CAP_INS ─────────────────────────────────────────────
  { item_code:'STU_ANGER_INS_01', concern_name:'Anger & Impulse', stage_code:'CAP_INS', weight:1.2, polarity:'(+)', subdomain_code:'Trigger Mapping',          question:'I can identify the specific situations or people that set off my anger.' },
  { item_code:'STU_ANGER_INS_02', concern_name:'Anger & Impulse', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Pre-Anger Signals',        question:'I understand the warning signs in my body before I lose control.' },
  { item_code:'STU_ANGER_INS_03', concern_name:'Anger & Impulse', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Anger Pattern',            question:'I see the pattern of what typically happens before, during, and after I get angry.' },
  { item_code:'STU_ANGER_INS_04', concern_name:'Anger & Impulse', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Secondary Emotions',       question:'I recognise that anger is often masking another emotion — fear, hurt, or shame.' },
  { item_code:'STU_ANGER_INS_05', concern_name:'Anger & Impulse', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Impact Awareness',         question:'I understand how my anger response affects people around me.' },
  { item_code:'STU_ANGER_INS_06', concern_name:'Anger & Impulse', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Vulnerability States',     question:'I can spot when fatigue, hunger, or stress makes my anger threshold lower.' },
  { item_code:'STU_ANGER_INS_07', concern_name:'Anger & Impulse', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Assertiveness Insight',    question:'I understand the difference between healthy assertiveness and destructive aggression.' },
  { item_code:'STU_ANGER_INS_08', concern_name:'Anger & Impulse', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Consequence Insight',      question:'I see how my impulsive reactions create problems I later have to fix.' },
  { item_code:'STU_ANGER_INS_09', concern_name:'Anger & Impulse', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Context Awareness',        question:'I know which relationships or environments make my anger more likely.' },
  { item_code:'STU_ANGER_INS_10', concern_name:'Anger & Impulse', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Thought Pattern Insight',  question:'I recognise the thinking patterns (blame, catastrophising) that fuel my anger.' },
  // ── ANGER & IMPULSE ─ CAP_GRW ─────────────────────────────────────────────
  { item_code:'STU_ANGER_GRW_01', concern_name:'Anger & Impulse', stage_code:'CAP_GRW', weight:1.2, polarity:'(+)', subdomain_code:'Pause Response',           question:'I use a physical or mental pause (counting, breathing) before reacting when angry.' },
  { item_code:'STU_ANGER_GRW_02', concern_name:'Anger & Impulse', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Space Taking',             question:'I remove myself from a situation when I feel anger escalating.' },
  { item_code:'STU_ANGER_GRW_03', concern_name:'Anger & Impulse', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Early Expression',         question:'I express frustration verbally and clearly before it builds into anger.' },
  { item_code:'STU_ANGER_GRW_04', concern_name:'Anger & Impulse', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Root Addressing',          question:'I address the underlying emotion (hurt, fear) rather than just reacting to the trigger.' },
  { item_code:'STU_ANGER_GRW_05', concern_name:'Anger & Impulse', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Physical Release',         question:'I use exercise or physical activity to discharge excess emotional tension.' },
  { item_code:'STU_ANGER_GRW_06', concern_name:'Anger & Impulse', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Repair Behaviour',         question:'I repair relationships proactively after an angry episode without deflecting.' },
  { item_code:'STU_ANGER_GRW_07', concern_name:'Anger & Impulse', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Micro-Practice',           question:'I practise responding to minor frustrations calmly to build the habit.' },
  { item_code:'STU_ANGER_GRW_08', concern_name:'Anger & Impulse', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Early Intervention',       question:'I identify my warning signs early and intervene at that stage, not after explosion.' },
  { item_code:'STU_ANGER_GRW_09', concern_name:'Anger & Impulse', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Boundary Setting',         question:'I set clear boundaries in situations that consistently trigger my anger.' },
  { item_code:'STU_ANGER_GRW_10', concern_name:'Anger & Impulse', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Reflective Learning',      question:'I reflect on my anger episodes to understand and not repeat the pattern.' },
  // ── ANGER & IMPULSE ─ CAP_MAS ─────────────────────────────────────────────
  { item_code:'STU_ANGER_MAS_01', concern_name:'Anger & Impulse', stage_code:'CAP_MAS', weight:1.2, polarity:'(+)', subdomain_code:'Composed Response',        question:'I respond to frustrating situations with clear-headed composure, not reaction.' },
  { item_code:'STU_ANGER_MAS_02', concern_name:'Anger & Impulse', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Rare Outbursts',           question:'I rarely lose my temper, and when I do, I recover and repair quickly.' },
  { item_code:'STU_ANGER_MAS_03', concern_name:'Anger & Impulse', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Constructive Channelling', question:'I channel strong emotions into constructive action rather than destructive expression.' },
  { item_code:'STU_ANGER_MAS_04', concern_name:'Anger & Impulse', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Impulse Control',          question:'My impulse control is strong — I consistently think before I act or speak.' },
  { item_code:'STU_ANGER_MAS_05', concern_name:'Anger & Impulse', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Assertive Communication',  question:'I handle conflict and disagreement assertively without aggression.' },
  { item_code:'STU_ANGER_MAS_06', concern_name:'Anger & Impulse', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Emotional Safety',         question:'People experience me as emotionally safe and predictable even under pressure.' },
  { item_code:'STU_ANGER_MAS_07', concern_name:'Anger & Impulse', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Root Resolution',          question:'I have resolved the underlying vulnerabilities that used to trigger my anger easily.' },
  { item_code:'STU_ANGER_MAS_08', concern_name:'Anger & Impulse', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Modelling Regulation',     question:'I model emotional regulation for others in tense situations.' },
  { item_code:'STU_ANGER_MAS_09', concern_name:'Anger & Impulse', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Anger as Signal',          question:'I use anger as useful information about a boundary, then release it cleanly.' },
  { item_code:'STU_ANGER_MAS_10', concern_name:'Anger & Impulse', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Relational Trust',         question:'My relationships have deepened because people trust my emotional steadiness.' },

  // ── SOCIAL WITHDRAWAL ─ CAP_CUR ───────────────────────────────────────────
  { item_code:'STU_SOCWT_CUR_01', concern_name:'Social Withdrawal', stage_code:'CAP_CUR', weight:1.2, polarity:'(-)', subdomain_code:'Avoidance Pattern',
    question_type:'mcq',
    question:'When a social event or gathering comes up, which best describes what typically happens for you?',
    opt_a:'I generally look forward to it and attend without significant internal resistance',
    opt_b:'Some situations require effort, but I usually go and often end up glad I did',
    opt_c:'I often feel a pull to avoid it — and sometimes do, even when I would probably enjoy it',
    opt_d:'I regularly avoid social situations, including ones I consciously want to be part of' },
  { item_code:'STU_SOCWT_CUR_02', concern_name:'Social Withdrawal', stage_code:'CAP_CUR', weight:1.1, polarity:'(-)', subdomain_code:'Social Fatigue',
    question_type:'likert_agree',
    question:'I feel noticeably exhausted after spending time with people, even people I genuinely like.' },
  { item_code:'STU_SOCWT_CUR_03', concern_name:'Social Withdrawal', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Plan Cancellation',
    question:'I cancel plans or find reasons to be alone rather than keeping social commitments.' },
  { item_code:'STU_SOCWT_CUR_04', concern_name:'Social Withdrawal', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Social Anxiety',
    question_type:'mcq',
    question:'In group settings — classrooms, social gatherings, team situations — how do you typically feel?',
    opt_a:'Relatively at ease — I can be present and engage without much anxiety',
    opt_b:'A low background self-consciousness that I can usually manage',
    opt_c:'Noticeably anxious or self-conscious — I feel observed or judged',
    opt_d:'Highly anxious — group settings feel threatening and I am mainly focused on managing discomfort' },
  { item_code:'STU_SOCWT_CUR_05', concern_name:'Social Withdrawal', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Initiation Difficulty',
    question_type:'likert_agree',
    question:'I find it genuinely difficult to initiate conversations or be the one to reach out to people first.' },
  { item_code:'STU_SOCWT_CUR_06', concern_name:'Social Withdrawal', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Belonging Deficit',
    question:'I feel like I do not belong or fit in with most people I meet.' },
  { item_code:'STU_SOCWT_CUR_07', concern_name:'Social Withdrawal', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Excessive Isolation',
    question_type:'mcq',
    question:'How would you describe your current balance between solitude and social connection?',
    opt_a:'A healthy balance — I value time alone and also value meaningful connection',
    opt_b:'I lean toward solitude but maintain enough social contact to feel connected',
    opt_c:'I spend significantly more time alone than feels good or healthy for me',
    opt_d:'I isolate most of the time and the degree of withdrawal feels unhealthy to me' },
  { item_code:'STU_SOCWT_CUR_08', concern_name:'Social Withdrawal', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Friendship Difficulty',
    question_type:'likert_agree',
    question:'Making and maintaining friendships feels genuinely difficult for me.' },
  { item_code:'STU_SOCWT_CUR_09', concern_name:'Social Withdrawal', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Lonely-in-Crowd',
    question:'I feel lonely or disconnected even when I am around other people.' },
  { item_code:'STU_SOCWT_CUR_10', concern_name:'Social Withdrawal', stage_code:'CAP_CUR', weight:1.0, polarity:'(-)', subdomain_code:'Rejection Fear',
    question:'I hold back in social situations because I am worried about being judged or rejected.' },
  // ── SOCIAL WITHDRAWAL ─ CAP_INS ───────────────────────────────────────────
  { item_code:'STU_SOCWT_INS_01', concern_name:'Social Withdrawal', stage_code:'CAP_INS', weight:1.2, polarity:'(+)', subdomain_code:'Root Identification',     question:'I can identify whether my withdrawal comes from introversion, anxiety, or low mood.' },
  { item_code:'STU_SOCWT_INS_02', concern_name:'Social Withdrawal', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Trigger Awareness',       question:'I understand the specific social situations that make me want to pull away.' },
  { item_code:'STU_SOCWT_INS_03', concern_name:'Social Withdrawal', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Need Distinction',        question:'I recognise the difference between needing genuine solitude and avoiding connection.' },
  { item_code:'STU_SOCWT_INS_04', concern_name:'Social Withdrawal', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Cost Awareness',          question:'I see the long-term cost of my social withdrawal on my relationships and wellbeing.' },
  { item_code:'STU_SOCWT_INS_05', concern_name:'Social Withdrawal', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Past Influences',         question:'I understand how past social experiences influence my current avoidance.' },
  { item_code:'STU_SOCWT_INS_06', concern_name:'Social Withdrawal', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Self-Talk Awareness',     question:'I notice the negative self-talk that runs during social interactions.' },
  { item_code:'STU_SOCWT_INS_07', concern_name:'Social Withdrawal', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Pattern Recognition',     question:'I see the pattern in which situations I withdraw from and which I stay in.' },
  { item_code:'STU_SOCWT_INS_08', concern_name:'Social Withdrawal', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Online vs Offline',       question:'I understand how my online social behaviour differs from face-to-face interactions.' },
  { item_code:'STU_SOCWT_INS_09', concern_name:'Social Withdrawal', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Control Barrier',         question:'I recognise when my need for control or predictability prevents me from connecting.' },
  { item_code:'STU_SOCWT_INS_10', concern_name:'Social Withdrawal', stage_code:'CAP_INS', weight:1.0, polarity:'(+)', subdomain_code:'Perception Gap',          question:'I see how my withdrawal is interpreted by others versus how I intend it.' },
  // ── SOCIAL WITHDRAWAL ─ CAP_GRW ───────────────────────────────────────────
  { item_code:'STU_SOCWT_GRW_01', concern_name:'Social Withdrawal', stage_code:'CAP_GRW', weight:1.2, polarity:'(+)', subdomain_code:'Gradual Exposure',        question:'I schedule regular small social interactions to build comfort gradually.' },
  { item_code:'STU_SOCWT_GRW_02', concern_name:'Social Withdrawal', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Weekly Challenge',        question:'I approach at least one social situation each week that I would normally avoid.' },
  { item_code:'STU_SOCWT_GRW_03', concern_name:'Social Withdrawal', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Proactive Contact',       question:'I initiate contact with someone I value rather than waiting for them to reach out.' },
  { item_code:'STU_SOCWT_GRW_04', concern_name:'Social Withdrawal', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Conversation Skills',     question:'I practise conversation-starting approaches to reduce social friction.' },
  { item_code:'STU_SOCWT_GRW_05', concern_name:'Social Withdrawal', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Realistic Expectations',  question:'I set realistic expectations for social interactions — not every one has to be great.' },
  { item_code:'STU_SOCWT_GRW_06', concern_name:'Social Withdrawal', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Clear Communication',     question:'I communicate my need for alone time clearly rather than disappearing.' },
  { item_code:'STU_SOCWT_GRW_07', concern_name:'Social Withdrawal', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Interest-Based Groups',   question:'I join an activity or group centred on an interest to reduce pure social pressure.' },
  { item_code:'STU_SOCWT_GRW_08', concern_name:'Social Withdrawal', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Self-Critic Challenge',   question:'I challenge self-critical thoughts that arise during social situations.' },
  { item_code:'STU_SOCWT_GRW_09', concern_name:'Social Withdrawal', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Isolation Recognition',   question:'I recognise when I am isolating and reach out to someone instead.' },
  { item_code:'STU_SOCWT_GRW_10', concern_name:'Social Withdrawal', stage_code:'CAP_GRW', weight:1.0, polarity:'(+)', subdomain_code:'Positive Memory',         question:'I take note of positive social moments to balance the memory of awkward ones.' },
  // ── SOCIAL WITHDRAWAL ─ CAP_MAS ───────────────────────────────────────────
  { item_code:'STU_SOCWT_MAS_01', concern_name:'Social Withdrawal', stage_code:'CAP_MAS', weight:1.2, polarity:'(+)', subdomain_code:'Comfortable Range',       question:'I engage comfortably in a range of social situations without significant anxiety.' },
  { item_code:'STU_SOCWT_MAS_02', concern_name:'Social Withdrawal', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Active Relationship',      question:'I maintain a network of meaningful relationships through consistent effort.' },
  { item_code:'STU_SOCWT_MAS_03', concern_name:'Social Withdrawal', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Balanced Solitude',        question:'I balance genuine introversion with the connection I need for wellbeing.' },
  { item_code:'STU_SOCWT_MAS_04', concern_name:'Social Withdrawal', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Proactive Initiation',     question:'I initiate conversations and relationships without needing the other person to go first.' },
  { item_code:'STU_SOCWT_MAS_05', concern_name:'Social Withdrawal', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Social Navigation',        question:'I navigate group dynamics and new social environments with ease.' },
  { item_code:'STU_SOCWT_MAS_06', concern_name:'Social Withdrawal', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Full Presence',            question:'I am present and engaged in social interactions rather than mentally planning an exit.' },
  { item_code:'STU_SOCWT_MAS_07', concern_name:'Social Withdrawal', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Authentic Expression',     question:'I express my authentic self in social settings without significant self-censorship.' },
  { item_code:'STU_SOCWT_MAS_08', concern_name:'Social Withdrawal', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Past Healing',             question:'I no longer allow past social wounds to define my current social confidence.' },
  { item_code:'STU_SOCWT_MAS_09', concern_name:'Social Withdrawal', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Full Attention',           question:'I give others the gift of my full presence and attention in conversation.' },
  { item_code:'STU_SOCWT_MAS_10', concern_name:'Social Withdrawal', stage_code:'CAP_MAS', weight:1.0, polarity:'(+)', subdomain_code:'Sustaining Connection',    question:'My social connections enrich and sustain my life consistently.' },
];

const STAGES = [
  { code: 'CAP_CUR', label: 'Curiosity',  index: 0, color: '#3B82F6', desc: 'Surface awareness & first signals'   },
  { code: 'CAP_INS', label: 'Insight',    index: 1, color: '#10B981', desc: 'Patterns & self-understanding'       },
  { code: 'CAP_GRW', label: 'Growth',     index: 2, color: '#F59E0B', desc: 'Strategy & habit formation'          },
  { code: 'CAP_MAS', label: 'Mastery',    index: 3, color: '#8B5CF6', desc: 'Control & peak performance'          },
];

function getAgeBands(age: number): string[] {
  const b: string[] = [];
  if (age >= 5  && age <= 18) b.push('5-18');
  if (age >= 5  && age <= 10) b.push('5-10');
  if (age >= 11 && age <= 14) b.push('11-14');
  if (age >= 11 && age <= 18) b.push('11-18');
  if (age >= 15 && age <= 18) b.push('15-18');
  if (age >= 19)               b.push('19+');
  return b;
}

function resolveAgeBandLabel(age: number): string {
  if (age >= 5  && age <= 10) return '5-10';
  if (age >= 11 && age <= 14) return '11-14';
  if (age >= 15 && age <= 18) return '15-18';
  return '19+';
}

function getScoreLevel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Advanced',   color: '#8B5CF6' };
  if (score >= 60) return { label: 'Proficient', color: '#10B981' };
  if (score >= 40) return { label: 'Developing', color: '#F59E0B' };
  return              { label: 'Emerging',    color: '#EF4444' };
}

/** Normalise legacy 'Mastery' label stored in DB to new 'Advanced' label */
function normLevel(level: string): string {
  return level === 'Mastery' ? 'Advanced' : level;
}

function generateStageInsight(stage: string, score: number, concern: string): string {
  const { label: level } = getScoreLevel(score);

  // Detect concern category for contextually appropriate language
  const cl = concern.toLowerCase();
  const isCareer = /career|job|role|profession|transition|stuck|work|employ|purpose|direction|leadership|promotion|salary|workplace|burnout|meaning|identity/.test(cl);

  if (isCareer) {
    const careerMap: Record<string, Record<string, string>> = {
      Curiosity: {
        Advanced:   `Your assessment on "${concern}" shows strong self-awareness at a professional level. You can see your patterns clearly — which is the most underrated career advantage there is.`,
        Proficient: `Solid self-awareness around "${concern}" at this stage. You're reading the signals accurately — the deeper patterns behind them are what the next stage maps out.`,
        Developing: `You're beginning to name what's been happening with "${concern}" in your career. That honest recognition is where useful change starts — everything else builds from here.`,
        Emerging:   `Your "${concern}" pattern is starting to surface. Getting clear on what's actually driving it — not just what it looks like — is the work the next stage is designed to do.`,
      },
      Insight: {
        Advanced:   `Deep professional self-awareness around "${concern}". You understand the cause-and-effect in your career patterns — a significant advantage when navigating what comes next.`,
        Proficient: `Strong insight into the "${concern}" patterns shaping your career. You're connecting the dots between what happens and why — a rare clarity at this stage.`,
        Developing: `Growing clarity about the deeper drivers of "${concern}" in your professional life. You're moving from reacting to understanding — that shift changes the decisions you'll make.`,
        Emerging:   `The underlying drivers of "${concern}" are becoming visible. With more targeted exploration, the pattern will become actionable — not just recognisable.`,
      },
      Growth: {
        Advanced:   `Strong strategy and deliberate habit formation around "${concern}". You're building professional patterns with intention — the kind that compound over time.`,
        Proficient: `Good progress on developing strategies for "${concern}" in your career. The habits are forming — the next stage is about making them more consistent and conscious.`,
        Developing: `You're actively building better patterns around "${concern}" professionally. Small, well-chosen steps at this stage have an outsized long-term effect.`,
        Emerging:   `Your strategy around "${concern}" is still taking shape. The groundwork you're laying now is what makes the next move sustainable rather than reactive.`,
      },
      Mastery: {
        Advanced:   `Exceptional professional command around "${concern}". You've built an approach that holds under pressure — and that's exactly what separates sustained career performance from short-term results.`,
        Proficient: `Strong mastery indicators around "${concern}" at a professional level. You're operating with real self-command — the next layer is refining how that shows up for others.`,
        Developing: `Solid mastery foundation for "${concern}". You're consolidating what you've learned into durable professional habits — the compounding effect will become more visible over the next few months.`,
        Emerging:   `High-performance professional habits are built in stages. Your "${concern}" profile shows meaningful growth in progress — the patterns are real, they just need more time and deliberate reinforcement.`,
      },
    };
    return careerMap[stage]?.[level] ?? `${stage} assessment complete for "${concern}". Score: ${score}/100.`;
  }

  const map: Record<string, Record<string, string>> = {
    Curiosity: {
      Advanced:   `Your responses on "${concern}" reveal strong self-awareness. You clearly see the patterns in your own behaviour — a powerful starting point.`,
      Proficient: `Good baseline awareness around "${concern}". You recognise the signals — the next step is understanding the deeper patterns behind them.`,
      Developing: `You're beginning to notice "${concern}" patterns in yourself. This awareness is the essential first step toward change.`,
      Emerging:   `Your "${concern}" pattern is beginning to surface. Building this awareness is the foundation for everything that follows.`,
    },
    Insight: {
      Advanced:   `Deep pattern recognition around "${concern}". You understand the why behind your behaviour — a powerful foundation for lasting change.`,
      Proficient: `Good meta-cognitive insight into your "${concern}" patterns. You're connecting cause and effect clearly.`,
      Developing: `Growing insight into the deeper patterns of "${concern}". You're moving from noticing to understanding.`,
      Emerging:   `The connections behind your "${concern}" pattern are becoming visible. Targeted exploration at the next stage will make them actionable.`,
    },
    Growth: {
      Advanced:   `Strong strategy and habit formation around "${concern}". You're actively building new patterns that stick.`,
      Proficient: `Good progress in developing strategies for "${concern}". Your habits are taking shape and compounding.`,
      Developing: `You're actively working on growth strategies for "${concern}". Keep building — small consistent steps compound quickly.`,
      Emerging:   `Growth strategies for "${concern}" are taking shape. Each consistent action at this stage compounds into something durable.`,
    },
    Mastery: {
      Advanced:   `Exceptional self-regulation around "${concern}". You've built a sustainable, high-performance approach that others will notice.`,
      Proficient: `Strong mastery indicators for "${concern}". You're operating at a consistently high level with clear self-command.`,
      Developing: `Good mastery foundation for "${concern}". You're solidifying the gains from earlier stages into durable habits.`,
      Emerging:   `High performance is built in layers. Your "${concern}" profile shows the early patterns of self-command beginning to take root — the trajectory is what matters here.`,
    },
  };
  return map[stage]?.[level] ?? `${stage} assessment complete for "${concern}". Score: ${score}/100.`;
}

export function registerCapadexRoutes(app: Express, pool: Pool) {
  // Lazy ensure: add attempts column to capadex_otps (WC-C8A OTP brute-force cap)
  pool.query(`ALTER TABLE capadex_otps ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0`)
    .catch((e: any) => console.warn('[capadex] ensure-schema otp-attempts:', e.message));

  // T011 — PR0: add user_id to career_recommendations so Career Builder can
  // query recs by user (not just by CAPADEX session_id). Additive, never throws.
  pool.query(`ALTER TABLE career_recommendations ADD COLUMN IF NOT EXISTS user_id TEXT`)
    .then(() => pool.query(
      // Backfill existing rows by joining capadex_sessions.guest_email → users.id.
      // Cast both sides to text to avoid uuid=text operator error when session_id col is uuid-typed.
      `UPDATE career_recommendations cr
          SET user_id = u.id::text
         FROM capadex_sessions cs
         JOIN users u ON lower(u.email) = lower(cs.guest_email)
        WHERE cr.session_id::text = cs.id::text
          AND cr.user_id IS NULL`
    ))
    .catch((e: any) => console.warn('[capadex] ensure career_recommendations.user_id:', e.message));

  // WC-C4 — entitlement-enforcement gates (flag-gated; SYNCHRONOUS no-op pass-through when the flag
  // is OFF → byte-identical legacy behaviour). Two instances differ only by the session-id route
  // param: `:session_id` (report routes) vs `:id` (session sub-resource routes + the /api/assessment
  // omega-x alias). Reuses the existing deriveEntitlement ledger; resolves the billing identity
  // SERVER-SIDE from capadex_sessions.guest_email (never a client-supplied email).
  const gateReportEntitlement  = requireEntitlement(pool, { sessionParam: 'session_id' });
  const gateSessionEntitlement = requireEntitlement(pool, { sessionParam: 'id' });

  // ── Apply migration on startup ───────────────────────────────────────
  // ── Stage pricing table + seed ───────────────────────────────────────
  pool.query(`
    CREATE TABLE IF NOT EXISTS capadex_stage_pricing (
      stage_code   text PRIMARY KEY,
      stage_name   text NOT NULL,
      price        text NOT NULL DEFAULT '₹499',
      price_note   text NOT NULL DEFAULT 'one-time',
      tag          text NOT NULL DEFAULT '',
      description  text NOT NULL DEFAULT '',
      benefits     jsonb NOT NULL DEFAULT '[]',
      whatsapp_number text NOT NULL DEFAULT '919999999999',
      is_active    boolean DEFAULT true,
      updated_at   timestamptz DEFAULT now()
    );
    INSERT INTO capadex_stage_pricing (stage_code, stage_name, price, price_note, tag, description, benefits)
    VALUES
      ('CAP_CUR','Curiosity','₹99','one-time · instant results','Entry Stage',
       'Surface how your concern shows up in daily life — with a precise behavioural intelligence profile built from your 10 responses.',
       '["Personalised Behavioural Intelligence Report","Pattern identification across key dimensions","Benchmark comparison against 10,000+ real profiles","Dimensional score breakdown with severity indicators"]'::jsonb),
      ('CAP_INS','Insight','₹499','one-time · results in 24 hrs','Most Popular',
       'Discover the hidden patterns and root causes behind your concern — mapped to your specific profile.',
       '["Root-cause analysis of your behavioural pattern","Trigger map — what sets off the cycle and when","Emotional & environmental driver identification","How your profile compares to 10,000+ others"]'::jsonb),
      ('CAP_GRW','Growth','₹999','one-time · includes Insight','Best Value',
       'Move from awareness to action. Get a personalised 30-day strategy built around your exact pattern.',
       '["Personalised 30-day habit & strategy plan","Stage-by-stage intervention map","Progress checkpoints and milestone tracking","Behaviour replacement — not just suppression"]'::jsonb),
      ('CAP_MAS','Mastery','₹1,999','one-time · full roadmap','Complete Package',
       'Your complete behavioural intelligence profile — with 1-on-1 expert debrief and career or academic guidance.',
       '["Everything in Insight + Growth stages","Full 19-domain behavioural intelligence profile","1-on-1 analyst debrief session included","Career or academic readiness intelligence map"]'::jsonb)
    ON CONFLICT (stage_code) DO NOTHING;
  `).catch(() => {});

  pool.query(`
    ALTER TABLE capadex_reports ADD COLUMN IF NOT EXISTS admin_notes        text;
    ALTER TABLE capadex_reports ADD COLUMN IF NOT EXISTS score_override     numeric;
    ALTER TABLE capadex_reports ADD COLUMN IF NOT EXISTS headline_override  text;
    ALTER TABLE capadex_reports ADD COLUMN IF NOT EXISTS narrative_override text;
    ALTER TABLE capadex_reports ADD COLUMN IF NOT EXISTS override_reason    text;
    ALTER TABLE capadex_reports ADD COLUMN IF NOT EXISTS review_status      text DEFAULT 'pending';
    ALTER TABLE capadex_reports ADD COLUMN IF NOT EXISTS reviewed_by        text;
    ALTER TABLE capadex_reports ADD COLUMN IF NOT EXISTS reviewed_at        timestamptz;
    ALTER TABLE capadex_reports ADD COLUMN IF NOT EXISTS published_at       timestamptz;
    ALTER TABLE capadex_reports ADD COLUMN IF NOT EXISTS email_sent         boolean DEFAULT false;
    ALTER TABLE capadex_reports ADD COLUMN IF NOT EXISTS updated_at         timestamptz DEFAULT now();
  `).catch(() => {});

  // ── Seed professional question bank to sdi_items (idempotent) ─────────────
  (async () => {
    try {
      // Ensure unique index exists on item_code so ON CONFLICT works
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS sdi_items_item_code_uniq ON sdi_items(item_code)`);
      const esc = (s: string) => `'${s.replace(/'/g, "''")}'`;
      const vals = [...PRO_QUESTIONS, ...PRO_CONCERN_BANK].map(q =>
        `(${esc(q.item_code)},${esc(q.question)},${q.weight},${esc(q.polarity)},'19+',` +
        `${esc(q.stage_code)},${esc(q.concern_name)},true,'{professional,campus,jobseeker}',` +
        `${esc(q.subdomain_code)},${esc(q.subdomain_code)},${esc(q.subdomain_code)},false,'core','professional',` +
        `${esc(q.question_type||'likert')},` +
        `${q.opt_a?esc(q.opt_a):'NULL'},${q.opt_b?esc(q.opt_b):'NULL'},${q.opt_c?esc(q.opt_c):'NULL'},${q.opt_d?esc(q.opt_d):'NULL'})`
      ).join(',');
      await pool.query(
        `INSERT INTO sdi_items
           (item_code, question, weight, polarity, age_band, stage_code, concern_name,
            is_active, target_personas, subdomain_code, sub_domain_name, dimension, anchor, layer_tag, focus_area,
            item_type, opt_a, opt_b, opt_c, opt_d)
         VALUES ${vals}
         ON CONFLICT (item_code) DO UPDATE SET
           question   = EXCLUDED.question,
           item_type  = EXCLUDED.item_type,
           opt_a      = EXCLUDED.opt_a,
           opt_b      = EXCLUDED.opt_b,
           opt_c      = EXCLUDED.opt_c,
           opt_d      = EXCLUDED.opt_d`
      );
      console.log('[capadex-seed] Professional question bank ready');
    } catch (e: any) {
      console.warn('[capadex-seed] Pro questions skipped:', e.message);
    }
  })();

  // ── Seed student question banks (idempotent) ───────────────────────────────
  (async () => {
    try {
      const esc = (s: string) => `'${s.replace(/'/g, "''")}'`;
      const vals = [...STUDENT_QUESTIONS, ...STUDENT_CONCERN_BANK].map(q =>
        `(${esc(q.item_code)},${esc(q.question)},${q.weight},${esc(q.polarity)},'5-18',` +
        `${esc(q.stage_code)},${esc(q.concern_name)},true,'{student,parent,teacher,campus}',` +
        `${esc(q.subdomain_code)},${esc(q.subdomain_code)},${esc(q.subdomain_code)},false,'core','student',` +
        `${esc(q.question_type||'likert')},` +
        `${q.opt_a?esc(q.opt_a):'NULL'},${q.opt_b?esc(q.opt_b):'NULL'},${q.opt_c?esc(q.opt_c):'NULL'},${q.opt_d?esc(q.opt_d):'NULL'})`
      ).join(',');
      await pool.query(
        `INSERT INTO sdi_items
           (item_code, question, weight, polarity, age_band, stage_code, concern_name,
            is_active, target_personas, subdomain_code, sub_domain_name, dimension, anchor, layer_tag, focus_area,
            item_type, opt_a, opt_b, opt_c, opt_d)
         VALUES ${vals}
         ON CONFLICT (item_code) DO UPDATE SET
           question   = EXCLUDED.question,
           item_type  = EXCLUDED.item_type,
           opt_a      = EXCLUDED.opt_a,
           opt_b      = EXCLUDED.opt_b,
           opt_c      = EXCLUDED.opt_c,
           opt_d      = EXCLUDED.opt_d`
      );
      console.log('[capadex-seed] Student question banks ready (Exam Stress, Anxiety, Motivation, Anger, Social)');
    } catch (e: any) {
      console.warn('[capadex-seed] Student questions skipped:', e.message);
    }
  })();

  pool.query(`
    CREATE TABLE IF NOT EXISTS capadex_sessions (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      guest_email  text,
      guest_name   text,
      concern_name text NOT NULL,
      user_age     integer NOT NULL,
      age_band     text NOT NULL,
      stage_code   text NOT NULL,
      stage_index  integer NOT NULL DEFAULT 0,
      status       text NOT NULL DEFAULT 'in_progress',
      total_items  integer DEFAULT 0,
      answered_items integer DEFAULT 0,
      score        numeric,
      created_at   timestamptz DEFAULT now(),
      updated_at   timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS capadex_responses (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id     uuid NOT NULL REFERENCES capadex_sessions(id) ON DELETE CASCADE,
      item_id        uuid NOT NULL,
      stage_code     text NOT NULL,
      response_value integer NOT NULL,
      raw_score      numeric,
      weighted_score numeric,
      created_at     timestamptz DEFAULT now(),
      UNIQUE (session_id, item_id)
    );
    ALTER TABLE capadex_sessions ADD COLUMN IF NOT EXISTS master_concern_pk integer;
    CREATE INDEX IF NOT EXISTS idx_capadex_sessions_email    ON capadex_sessions(guest_email);
    CREATE INDEX IF NOT EXISTS idx_capadex_sessions_concern  ON capadex_sessions(concern_name);
    CREATE INDEX IF NOT EXISTS idx_capadex_responses_session ON capadex_responses(session_id);
    ALTER TABLE sdi_items ADD COLUMN IF NOT EXISTS target_personas TEXT[] NOT NULL DEFAULT '{}';
    ALTER TABLE short_assessment_questions ADD COLUMN IF NOT EXISTS target_personas TEXT[] NOT NULL DEFAULT '{}';
  `).catch(() => {});

  // ── GET /api/capadex/concerns ────────────────────────────────────────
  app.get('/api/capadex/concerns', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const r = await pool.query(`
        SELECT
          concern_name,
          COUNT(*) FILTER (WHERE stage_code = 'CAP_CUR') AS cur_count,
          COUNT(*) FILTER (WHERE stage_code = 'CAP_INS') AS ins_count,
          COUNT(*) FILTER (WHERE stage_code = 'CAP_GRW') AS grw_count,
          COUNT(*) FILTER (WHERE stage_code = 'CAP_MAS') AS mas_count,
          COUNT(*) AS total
        FROM sdi_items
        WHERE concern_name IS NOT NULL AND is_active = true
        GROUP BY concern_name
        HAVING COUNT(*) FILTER (WHERE stage_code = 'CAP_CUR') > 0
        ORDER BY COUNT(*) DESC
      `);
      res.json(r.rows);
    } catch (err) { next(err); }
  });

  // ── GET /api/capadex/stage-check ─────────────────────────────────────
  // Query: { email, concern }
  // Returns completed stages for that email+concern and the next recommended stage.
  // Used by the frontend "returning user" check on the preview screen to allow
  // skipping already-completed stages without retaking them.
  app.get('/api/capadex/stage-check', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email   = ((req.query.email   as string) || '').trim().toLowerCase();
      const concern = ((req.query.concern as string) || '').trim();
      const persona = ((req.query.persona as string) || '').trim();
      if (!email || !concern) {
        return res.status(400).json({ error: 'email and concern are required' });
      }
      const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRx.test(email)) {
        return res.status(400).json({ error: 'invalid email format' });
      }

      // Detect existing persona from ANY completed session for this email+concern
      // (no persona filter — used purely for mismatch detection)
      const existingPersonaRow = await pool.query<{ persona: string }>(
        `SELECT persona FROM capadex_sessions
         WHERE guest_email = $1 AND LOWER(concern_name) = LOWER($2) AND status = 'completed'
           AND persona IS NOT NULL AND persona != ''
         ORDER BY created_at DESC LIMIT 1`,
        [email, concern]
      );
      const existingPersona = existingPersonaRow.rows[0]?.persona ?? null;
      const personaMismatch  = !!(persona && existingPersona && existingPersona !== persona);

      // Fetch completed stages filtered by persona when provided — cross-persona
      // sessions must NOT count as progress for the current persona context.
      const { rows } = await pool.query<{ stage_code: string; stage_index: number }>(
        `SELECT DISTINCT stage_code, stage_index
         FROM capadex_sessions
         WHERE guest_email = $1 AND LOWER(concern_name) = LOWER($2) AND status = 'completed'
           AND ($3 = '' OR persona = $3)
         ORDER BY stage_index`,
        [email, concern, persona]
      );

      const completed = rows.map(r => r.stage_code);

      // Find the first stage not yet completed — that is the "next" stage
      let nextStage: typeof STAGES[number] | null = null;
      for (const s of STAGES) {
        if (!completed.includes(s.code)) {
          nextStage = s;
          break;
        }
      }
      // If all stages are done, allow retake of Mastery
      if (completed.length === STAGES.length) {
        nextStage = STAGES[STAGES.length - 1];
      }

      // Latest completed Curiosity session for this email+concern+persona (for direct report access)
      const lastSessionRow = await pool.query<{ id: string }>(
        `SELECT id FROM capadex_sessions
         WHERE guest_email=$1 AND LOWER(concern_name)=LOWER($2) AND status='completed'
           AND stage_code='CAP_CUR' AND ($3 = '' OR persona = $3)
         ORDER BY created_at DESC LIMIT 1`,
        [email, concern, persona]
      );
      const lastSessionId = lastSessionRow.rows[0]?.id ?? null;

      return res.json({
        completed,
        has_prior_completion: completed.length > 0,
        next_stage_code:   nextStage?.code   ?? null,
        next_stage_label:  nextStage?.label  ?? null,
        next_stage_index:  nextStage?.index  ?? 0,
        next_stage_color:  nextStage?.color  ?? '#344E86',
        concern_matched:   concern,
        last_session_id:   lastSessionId,
        existing_persona:  existingPersona,
        persona_mismatch:  personaMismatch,
      });
    } catch (err) { next(err); }
  });

  // ── POST /api/capadex/session/start ─────────────────────────────────
  // Body: { concern_name, user_age, persona?, guest_email?, guest_name? }
  // Returns: { session_id, stage_code, stage_label, stage_index, total_stages,
  //            total_items, questions, progress, age_band, is_retake }
  app.post('/api/capadex/session/start', async (req: Request, res: Response, next: NextFunction) => {
    const { concern_name, user_age, guest_email, guest_name, persona, tenant_id, construct_key } = req.body || {};
    const tenantId  = (String(tenant_id ?? req.headers['x-tenant-id'] ?? '')).trim() || undefined;
    const personaKey: string = (typeof persona === 'string' && persona.trim()) ? persona.trim() : '';
    if (!concern_name || user_age == null) {
      return res.status(400).json({ error: 'concern_name and user_age are required' });
    }
    const age      = parseInt(String(user_age), 10);
    if (isNaN(age) || age < 3 || age > 99) {
      return res.status(400).json({ error: 'user_age must be between 3 and 99' });
    }
    const ageBand  = resolveAgeBandLabel(age);
    const ageBands = getAgeBands(age);
    const email    = (guest_email || '').toString().trim().toLowerCase() || null;

    try {
      // ── Guard: max 3 free Curiosity assessments per email ──────────────────
      if (email) {
        const limitRow = await pool.query(
          `SELECT COUNT(*)::int AS cnt FROM capadex_sessions
           WHERE LOWER(guest_email)=$1 AND status='completed' AND stage_code='CAP_CUR'`,
          [email]
        );
        if ((limitRow.rows[0]?.cnt ?? 0) >= 3) {
          return res.status(429).json({
            error: 'FREE_ASSESSMENT_LIMIT',
            message: 'You have used all 3 free assessments for this email address.',
          });
        }
      }

      // Determine which stage the user should be on (first not-yet-completed stage)
      let stageIndex = 0;
      let isRetake   = false;
      if (email) {
        const { rows: completed } = await pool.query<{ stage_code: string; stage_index: number }>(
          `SELECT DISTINCT stage_code, stage_index
           FROM capadex_sessions
           WHERE guest_email = $1 AND LOWER(concern_name) = LOWER($2) AND status = 'completed'
             AND ($3 = '' OR persona = $3)
           ORDER BY stage_index`,
          [email, concern_name, personaKey]
        );
        const completedCodes = completed.map(r => r.stage_code);
        // Find first stage not yet completed
        for (let i = 0; i < STAGES.length; i++) {
          if (!completedCodes.includes(STAGES[i].code)) {
            stageIndex = i;
            break;
          }
          stageIndex = i; // If all completed, allow retake of last stage
        }
        // If all 4 stages completed, allow retake of Mastery
        if (completedCodes.length === STAGES.length) {
          stageIndex = STAGES.length - 1;
          isRetake   = true;
        }
      }

      const currentStage = STAGES[stageIndex];

      // ── Helper: persona SQL clause for sdi_items ─────────────────────
      // Empty target_personas array means "show to everyone"
      const personaSql = (idx: number) =>
        personaKey
          ? `AND (i.target_personas = '{}' OR $${idx} = ANY(i.target_personas))`
          : '';

      // ── 1. PRIMARY: check short_assessment_questions (admin-managed bank) ─
      // These are tied to concern_areas by ID and tagged with target_personas.
      // Stage names match: Curiosity / Insight / Growth / Mastery
      let questions: any[] = [];
      let resolvedConcern = concern_name;

      // Target number of questions per stage. Each candidate tier widens the
      // filter progressively (curated bank → concern+age+persona → concern only
      // → keyword) and TOPS UP the pool (dedup by id) until we reach TARGET,
      // instead of stopping at the first tier that clears a minimum. This is
      // what lets a concern surface ~10 questions rather than the 3-5 a single
      // strict tier returns.
      const TARGET_QUESTIONS = 10;
      // Merge `incoming` rows into `base`, de-duplicating by stringified id so a
      // question never appears twice (no within-assessment repeats) while
      // preserving each tier's anchor/weight ordering.
      const mergeQuestions = (base: any[], incoming: any[]): any[] => {
        const seen = new Set(base.map(q => String(q.id)));
        const out = base.slice();
        for (const q of incoming) {
          const key = String(q.id);
          if (!seen.has(key)) { seen.add(key); out.push(q); }
        }
        return out;
      };

      try {
        const saqParams: any[] = [concern_name, currentStage.label];
        if (personaKey) saqParams.push(personaKey);
        const saqPersonaCond = personaKey
          ? `AND (q.target_personas = '{}' OR $3 = ANY(q.target_personas))`
          : '';
        const { rows: saqItems } = await pool.query(`
          SELECT
            q.id::text AS id,
            q.question_code AS item_code,
            q.dimension AS subdomain_code,
            q.question_text AS question,
            q.weight,
            q.polarity,
            q.age_band,
            q.focus_area,
            q.layer AS layer_tag,
            q.is_anchor AS anchor,
            null AS domain,
            q.dimension AS sub_domain_name,
            q.dimension AS dimension,
            q.logic,
            null AS response_range,
            null AS opt_a, null AS opt_b, null AS opt_c, null AS opt_d, null AS opt_e,
            COALESCE(q.question_type,'likert') AS question_type,
            COALESCE(q.options, '[]'::jsonb)::json AS options
          FROM short_assessment_questions q
          JOIN concern_areas ca ON ca.id = q.concern_area_id
          WHERE LOWER(ca.concern_area) = LOWER($1)
            AND q.stage = $2
            AND q.is_active = true
            ${saqPersonaCond}
          ORDER BY q.is_anchor DESC NULLS LAST, (q.weight::numeric) DESC, random()
          LIMIT 30
        `, saqParams);
        questions = mergeQuestions(questions, saqItems);
      } catch (_e) {
        // short_assessment_questions may not exist yet — continue to sdi_items fallback
      }

      // ── 2. sdi_items: exact concern name + age band + persona ────────
      if (questions.length < TARGET_QUESTIONS) {
        const p1: any[] = [concern_name, currentStage.code, ageBands];
        if (personaKey) p1.push(personaKey);
        const { rows: items } = await pool.query(`
          SELECT i.id, i.item_code, i.subdomain_code, i.question, i.weight, i.polarity,
                 i.age_band, i.focus_area, i.layer_tag,
                 i.anchor, i.domain, i.sub_domain_name, i.dimension,
                 i.logic, i.response_range,
                 i.opt_a, i.opt_b, i.opt_c, i.opt_d, i.opt_e,
                 COALESCE(i.item_type,'likert') AS question_type,
                 COALESCE(
                   json_agg(json_build_object('id',o.id,'option_text',o.text,'score_value',o.score_value,'display_order',o.display_order) ORDER BY o.display_order)
                   FILTER (WHERE o.id IS NOT NULL), '[]'::json
                 ) AS options
          FROM sdi_items i
          LEFT JOIN sdi_item_options o ON o.item_id = i.id
          WHERE LOWER(i.concern_name) = LOWER($1)
            AND i.stage_code = $2
            AND i.age_band = ANY($3::text[])
            AND i.is_active = true
            ${personaKey ? `AND (i.target_personas = '{}' OR $4 = ANY(i.target_personas))` : ''}
          GROUP BY i.id
          ORDER BY i.anchor DESC NULLS LAST, i.weight::numeric DESC, random()
          LIMIT 30
        `, p1);
        questions = mergeQuestions(questions, items);
      }

      // ── 3. sdi_items: no age-band filter ────────────────────────────
      if (questions.length < TARGET_QUESTIONS) {
        const p2: any[] = [concern_name, currentStage.code];
        if (personaKey) p2.push(personaKey);
        const { rows: fallback } = await pool.query(`
          SELECT i.id, i.item_code, i.subdomain_code, i.question, i.weight, i.polarity,
                 i.age_band, i.focus_area, i.layer_tag,
                 i.anchor, i.domain, i.sub_domain_name, i.dimension,
                 i.logic, i.response_range,
                 i.opt_a, i.opt_b, i.opt_c, i.opt_d, i.opt_e,
                 COALESCE(i.item_type,'likert') AS question_type,
                 COALESCE(
                   json_agg(json_build_object('id',o.id,'option_text',o.text,'score_value',o.score_value,'display_order',o.display_order) ORDER BY o.display_order)
                   FILTER (WHERE o.id IS NOT NULL), '[]'::json
                 ) AS options
          FROM sdi_items i
          LEFT JOIN sdi_item_options o ON o.item_id = i.id
          WHERE LOWER(i.concern_name) = LOWER($1)
            AND i.stage_code = $2
            AND i.is_active = true
            ${personaKey ? `AND (i.target_personas = '{}' OR $3 = ANY(i.target_personas))` : ''}
          GROUP BY i.id
          ORDER BY i.anchor DESC NULLS LAST, i.weight::numeric DESC, random()
          LIMIT 30
        `, p2);
        questions = mergeQuestions(questions, fallback);
      }

      // ── 4. Keyword-based fallback — persona-aware ────────────────────
      if (questions.length === 0) {
        resolvedConcern = resolveCapadexConcern(concern_name, personaKey || undefined, age);
        const p3: any[] = [resolvedConcern, currentStage.code];
        if (personaKey) p3.push(personaKey);
        const { rows: kbItems } = await pool.query(`
          SELECT i.id, i.item_code, i.subdomain_code, i.question, i.weight, i.polarity,
                 i.age_band, i.focus_area, i.layer_tag,
                 i.anchor, i.domain, i.sub_domain_name, i.dimension,
                 i.logic, i.response_range,
                 i.opt_a, i.opt_b, i.opt_c, i.opt_d, i.opt_e,
                 COALESCE(i.item_type,'likert') AS question_type,
                 COALESCE(
                   json_agg(json_build_object('id',o.id,'option_text',o.text,'score_value',o.score_value,'display_order',o.display_order) ORDER BY o.display_order)
                   FILTER (WHERE o.id IS NOT NULL), '[]'::json
                 ) AS options
          FROM sdi_items i
          LEFT JOIN sdi_item_options o ON o.item_id = i.id
          WHERE LOWER(i.concern_name) = LOWER($1) AND i.stage_code = $2 AND i.is_active = true
            ${personaKey ? `AND (i.target_personas = '{}' OR $3 = ANY(i.target_personas))` : ''}
          GROUP BY i.id
          ORDER BY i.anchor DESC NULLS LAST, i.weight::numeric DESC, random()
          LIMIT 30
        `, p3);
        questions = mergeQuestions(questions, kbItems);
      }

      if (questions.length === 0) {
        return res.status(404).json({
          error: `No questions available for "${concern_name}". Please try a different concern.`,
        });
      }

      // ── Cross-session freshness: never repeat what this user already saw ─
      // The user has a "huge database" of questions but kept seeing repeats on
      // retakes. We look up every item this email already answered for this
      // concern + stage in prior sessions and float UNSEEN questions to the
      // front, keeping previously-seen ones only as filler if the fresh pool
      // is too small. Anchors stay first within each partition (the queries
      // already ordered them). Anonymous / email-less starts skip this step.
      if (email && questions.length > 0) {
        try {
          const { rows: seenRows } = await pool.query(
            `SELECT DISTINCT cr.item_id::text AS id
               FROM capadex_responses cr
               JOIN capadex_sessions s ON s.id = cr.session_id
              WHERE s.guest_email = $1
                AND LOWER(s.concern_name) = LOWER($2)
                AND cr.stage_code = $3`,
            [email, concern_name, currentStage.code],
          );
          const seen = new Set(seenRows.map(r => String(r.id)));
          if (seen.size > 0) {
            const fresh = questions.filter(q => !seen.has(String(q.id)));
            const stale = questions.filter(q =>  seen.has(String(q.id)));
            questions = [...fresh, ...stale];
          }
        } catch (_e) {
          // Freshness is best-effort — never block the assessment on it.
        }
      }

      // Cap to the per-stage target (pool may exceed it after merging tiers).
      questions = questions.slice(0, TARGET_QUESTIONS);

      // Mark any previous in_progress sessions for this email+concern+stage as abandoned
      if (email) {
        await pool.query(`
          UPDATE capadex_sessions
          SET status = 'replaced', updated_at = now()
          WHERE guest_email = $1 AND LOWER(concern_name) = LOWER($2) AND stage_code = $3 AND status = 'in_progress'
        `, [email, resolvedConcern, currentStage.code]);
      }

      // Resolve primary_construct_key anchor for ontology reverse-weighting (Phase 1 Step 1).
      // Priority: explicit client value (from /concern/analyze response) → server-side
      // re-detection from concern_name → null (live single-mean scoring path remains intact
      // when NULL; the back-propagation engine treats NULL as "no anchor → flat scoring").
      //
      // Every candidate is run through `canonicalizeConstructKey` so we ONLY ever persist
      // a value that exists in the canonical CONSTRUCT_MAP registry. Unknown/mixed-case
      // inputs become null, never garbage — guarantees Phase 2 ontology joins are clean.
      let primaryConstructKey: string | null = canonicalizeConstructKey(construct_key);
      if (!primaryConstructKey) {
        try {
          const detected = detectCategory(String(resolvedConcern));
          primaryConstructKey = canonicalizeConstructKey(detected.construct_key);
        } catch { /* detection failure → leave null, flat scoring */ }
      }

      // Resolve the master concern PK once, here, instead of re-matching the
      // concern_name text on every /respond (Task #19). Persisted on the session
      // row so concern→signal seeding is deterministic per session and immune to
      // the resolution cache window. Best-effort: null when no confident match
      // (seeding then falls back to text resolution, byte-identical to before).
      let masterConcernPk: number | null = null;
      try {
        masterConcernPk = await resolveSeedConcernPk(pool, resolvedConcern);
      } catch { /* never block session creation on seeding resolution */ }

      // Create new session (store resolvedConcern so scoring/report work correctly)
      const { rows: [session] } = await pool.query(`
        INSERT INTO capadex_sessions
          (guest_email, guest_name, concern_name, user_age, age_band, stage_code, stage_index, total_items, primary_construct_key, master_concern_pk)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [email, guest_name || null, resolvedConcern, age, ageBand, currentStage.code, stageIndex, questions.length, primaryConstructKey, masterConcernPk]);

      // Seed cognitive runtime state (non-blocking — fail-safe)
      seedInitialState(pool, session.id, {
        concern_name: resolvedConcern,
        stage_code:   currentStage.code,
        stage_index:  stageIndex,
        persona:      personaKey || undefined,
        age,
      });

      // Build progress map for this email+concern
      const progress = await buildProgress(pool, email, resolvedConcern);

      res.json({
        session_id:      session.id,
        stage_code:      currentStage.code,
        stage_label:     currentStage.label,
        stage_color:     currentStage.color,
        stage_desc:      currentStage.desc,
        stage_index:     stageIndex,
        total_stages:    STAGES.length,
        total_items:     questions.length,
        questions,
        progress,
        age_band:        ageBand,
        is_retake:       isRetake,
        primary_construct_key: session.primary_construct_key ?? null,
        // Phase 1 feature flags active for this session (per-tenant where context available)
        phase1_features: {
          adaptive_questioning:    isEnabled('adaptive_questioning',    tenantId),
          contradiction_detection: isEnabled('contradiction_detection', tenantId),
          confidence_engine:       isEnabled('confidence_engine',       tenantId),
          dynamic_reporting:       isEnabled('dynamic_reporting',       tenantId),
          signal_intelligence:     isEnabled('signal_intelligence',     tenantId),
          cognitive_load_engine:   isEnabled('cognitive_load_engine',   tenantId),
          longitudinal_memory:     isEnabled('longitudinal_memory',     tenantId),
        },
      });
    } catch (err) { next(err); }
  });

  // ── POST /api/capadex/session/:id/respond ───────────────────────────
  // Body: { responses: [{ item_id, response_value }] }
  app.post('/api/capadex/session/:id/respond', async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { responses } = req.body || {};
    if (!Array.isArray(responses) || responses.length === 0) {
      return res.status(400).json({ error: 'responses array is required' });
    }
    try {
      const { rows: [session] } = await pool.query(
        'SELECT * FROM capadex_sessions WHERE id = $1', [id]
      );
      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.status === 'completed') return res.status(400).json({ error: 'Session already completed' });
      // Module 2 — once the safety breaker has tripped, the session is terminal.
      // Reject further /respond writes so a client retry can't resurrect a
      // safety-intercepted session into a normal completion flow.
      if (session.status === 'safety_intercepted') {
        return res.status(409).json({
          error: 'session_safety_intercepted',
          safety_intercept: true,
          terminate_assessment: true,
          relief_target: 'immediate_support',
          support_resources: {
            message: "Your well-being is our absolute priority right now. Let's pause the questions and focus on immediate relief.",
            action_type: 'counsellor_routing',
          },
        });
      }

      // Resolve session anchor once — used as the fallback bucket when an item's
      // own concern context yields no construct_key (e.g. NULL concern_name or a
      // term outside the detector vocabulary). Keeps every response row tagged.
      const sessionAnchorBucket: string | null = session.primary_construct_key || null;

      // Phase 2 — collect per-item context for the Evidence Runtime. Built inside
      // the existing loop (no extra queries) and consumed off the request path
      // after the response is sent. Answers -> Evidence -> Signals.
      const evidenceInputs: EvidenceInput[] = [];

      for (const r of responses) {
        if (!r.item_id || r.response_value == null) continue;
        const itemIdStr = String(r.item_id);
        // Try sdi_items first (UUID ids); fall back to short_assessment_questions (integer ids).
        // Pull concern context alongside weight/polarity so we can snapshot the
        // ontology bucket at write time (Phase 1 Step 2). For SAQ we LEFT JOIN
        // concern_areas to surface a human-readable label; for sdi_items the
        // row already carries concern_name.
        let item: {
          weight: number | string; polarity: string; concern_label: string | null;
          dimension?: string | null; subdomain?: string | null;
        } | null = null;
        let itemKind: EvidenceInput['kind'] = 'unknown';
        const sdiRes = await pool.query(
          `SELECT weight, polarity, concern_name AS concern_label,
                  dimension, subdomain_code AS subdomain
             FROM sdi_items WHERE id::text = $1`,
          [itemIdStr]
        );
        if (sdiRes.rows[0]) { item = sdiRes.rows[0]; itemKind = 'assessment'; }
        if (!item && /^\d+$/.test(itemIdStr)) {
          const saqRes = await pool.query(
            `SELECT saq.weight::numeric AS weight, saq.polarity,
                    COALESCE(ca.concern_area, ca.category) AS concern_label
               FROM short_assessment_questions saq
               LEFT JOIN concern_areas ca ON ca.id = saq.concern_area_id
              WHERE saq.id = $1`,
            [parseInt(itemIdStr, 10)]
          );
          if (saqRes.rows[0]) { item = saqRes.rows[0]; itemKind = 'short_assessment'; }
        }
        if (!item) { item = { weight: 1, polarity: '(+)', concern_label: null }; }
        const weight   = parseFloat(String(item.weight)) || 1;
        const polarity = (item.polarity || '(+)') as string;

        // Resolve the per-item bucket. Priority: detectCategory(item.concern_label)
        // → session.primary_construct_key fallback. NULL only when both fail
        // (the scoring engine treats NULL as "session anchor cohort" downstream).
        // Run through canonicalizer so unknown keys never escape into the column.
        let itemBucket: string | null = null;
        if (item.concern_label) {
          try {
            const detected = detectCategory(String(item.concern_label));
            itemBucket = canonicalizeConstructKey(detected.construct_key);
          } catch { /* leave null → fallback */ }
        }
        if (!itemBucket) itemBucket = sessionAnchorBucket; // already canonical or null

        evidenceInputs.push({
          item_id: itemIdStr,
          response_value: Number(r.response_value),
          response_time_ms: r.response_time_ms ?? r.response_time ?? null,
          answer_changed: Boolean(r.answer_changed),
          bucket: itemBucket,
          kind: itemKind,
          // Task #22 — authored behavioural facet for the dimension signal
          // (consumed only when FF_RICH_BEHAVIORAL_SIGNALS is ON).
          dimension: item.dimension ?? null,
          subdomain: item.subdomain ?? null,
          polarity,
        });

        const { rawNorm, weighted } = computeItemScore(
          parseInt(String(r.response_value), 10), polarity, weight
        );

        await pool.query(`
          INSERT INTO capadex_responses (session_id, item_id, stage_code, response_value, raw_score, weighted_score, concern_bucket)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (session_id, item_id) DO UPDATE
            SET response_value = $4, raw_score = $5, weighted_score = $6,
                concern_bucket = COALESCE(EXCLUDED.concern_bucket, capadex_responses.concern_bucket),
                created_at = now()
        `, [id, r.item_id, session.stage_code, r.response_value, rawNorm, weighted, itemBucket]);
      }

      const { rows: [cnt] } = await pool.query(
        'SELECT COUNT(*) AS n FROM capadex_responses WHERE session_id = $1', [id]
      );
      await pool.query(
        'UPDATE capadex_sessions SET answered_items = $1, updated_at = now() WHERE id = $2',
        [parseInt(cnt.n, 10), id]
      );

      // ── Module 2 — Safety Circuit Breaker ("Relief-First" Gateway) ────────
      // Hybrid Channel A (text-based crisis language via safety-layer) +
      // Channel B (telemetry-derived crisis_risk / emotional_breakdown_risk).
      // Both run on every batch. Either firing trips the breaker, halts the
      // questionnaire queue, and returns a unified safety_intercept envelope
      // to the client instead of the standard `{ok, answered}` payload.
      //
      // Always-on. Defensive — evaluator never throws (returns tripped:false on
      // any fault) so a breaker fault cannot brick the assessment.
      const safetyTrip = await evaluateSafetyTrip(pool, String(id), responses);

      // Merge running Channel B risk into omega_x_payload.risk via jsonb_set so
      // the canonical 8-layer payload reflects the live session state. Other
      // risk subkeys (burnout_risk, disengagement_risk) are preserved by the
      // jsonb merge — only crisis_risk + emotional_breakdown_risk are overwritten.
      // Fire-and-forget within the request because the trip decision is already
      // made; persistence drift can't change the response.
      try {
        // jsonb_set can't create intermediate nested paths (PG quirk) — when
        // omega_x_payload starts as '{}', a `{risk,crisis_risk}` path target
        // silently no-ops. Build the risk object once via `||` merge so existing
        // risk subkeys (burnout_risk, disengagement_risk) are preserved while
        // crisis_risk + emotional_breakdown_risk overwrite cleanly.
        await pool.query(
          `UPDATE capadex_sessions
             SET omega_x_payload = jsonb_set(
                   COALESCE(omega_x_payload, '{}'::jsonb),
                   '{risk}',
                   COALESCE(omega_x_payload->'risk', '{}'::jsonb)
                     || jsonb_build_object(
                          'crisis_risk',              $1::numeric,
                          'emotional_breakdown_risk', $2::numeric),
                   true),
                 updated_at = now()
           WHERE id = $3`,
          [safetyTrip.risk.crisis_risk, safetyTrip.risk.emotional_breakdown_risk, id]
        );
      } catch (err) {
        console.error('[safety-breaker] risk-merge UPDATE failed:', err);
      }

      if (safetyTrip.tripped) {
        // Mark session terminated so the report flow / writers skip it and
        // SuperAdmin can audit. status='safety_intercepted' is a new terminal
        // state — additive, doesn't disturb existing 'in_progress'/'completed'.
        try {
          await pool.query(
            `UPDATE capadex_sessions SET status = 'safety_intercepted', updated_at = now() WHERE id = $1`,
            [id]
          );
        } catch (err) {
          console.error('[safety-breaker] status UPDATE failed:', err);
        }
        console.warn('[safety-breaker] TRIPPED', { session_id: id, channel: safetyTrip.channel, reasons: safetyTrip.reasons });
        // Return intercept envelope INSTEAD of the standard answer count.
        // Skip the non-blocking hooks below — the session is terminated.
        return res.status(200).json(buildSafetyInterceptEnvelope(safetyTrip));
      }

      res.json({ ok: true, answered: parseInt(cnt.n, 10) });

      // Non-blocking contradiction detection hook (flag-gated, Phase 1 S5).
      // Called once per submitted response item to match the single-answer API contract.
      // The 60-second dedup window inside detectContradictions prevents duplicate
      // event writes when multiple items in the same batch trigger the same rule.
      const respondTenantId = (String(req.headers['x-tenant-id'] ?? '')).trim() || undefined;
      for (const r of responses) {
        if (!r.item_id || r.response_value == null) continue;
        detectContradictions(
          pool, String(id),
          { item_id: String(r.item_id), response_value: Number(r.response_value) },
          respondTenantId,
        ).catch(err => console.error('[contradiction-engine] detection error:', err));
      }

      // Non-blocking cognitive load snapshot (flag-gated, Phase 1 S6).
      // Called once per batch after all responses are committed. snapshotLoad
      // performs gap-filling internally: it finds the last persisted snapshot
      // index and writes one row per question boundary up to the current count,
      // so every boundary is covered even when responses arrive in a batch.
      snapshotLoad(pool, String(id), respondTenantId)
        .catch(err => console.error('[cognitive-load] snapshot error:', err));

      // Non-blocking conversational quality evaluation (flag-gated, Phase 2 S11).
      // Runs after cognitive load so load snapshots are available for quality scoring.
      // Broadcasts quality_updated WS event and persists snapshot internally.
      evaluateQuality(pool, String(id), respondTenantId)
        .catch(err => console.error('[conversational-quality] evaluate error:', err));

      // Phase 2 — Evidence Runtime + Signal Activation Runtime (non-blocking).
      // Answers -> Evidence -> Signals. Converts this batch's responses into
      // evidence objects, runs the in-memory activation pipeline (<50ms), and
      // asynchronously persists capadex_evidence + capadex_session_signals.
      // Fully defensive internally; never disturbs the response flow.
      runEvidenceRuntime(pool, { id: String(id), primary_construct_key: session.primary_construct_key, concern_name: session.concern_name, master_concern_pk: session.master_concern_pk ?? null }, evidenceInputs)
        .catch(err => console.error('[evidence-runtime] error:', err));

    } catch (err) { next(err); }
  });

  // ── POST /api/capadex/session/:id/complete ──────────────────────────
  app.post('/api/capadex/session/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const completeTenantId = (String(req.body?.tenant_id ?? req.headers['x-tenant-id'] ?? '')).trim() || undefined;
    try {
      const { rows: [session] } = await pool.query(
        'SELECT * FROM capadex_sessions WHERE id = $1', [id]
      );
      if (!session) return res.status(404).json({ error: 'Session not found' });
      // Module 2 — terminal status guard. A safety-intercepted session must not
      // be completed; the user has been routed to counsellor support and the
      // score/report path is intentionally bypassed.
      if (session.status === 'safety_intercepted') {
        return res.status(409).json({
          error: 'session_safety_intercepted',
          safety_intercept: true,
          terminate_assessment: true,
          relief_target: 'immediate_support',
        });
      }

      // ── Pass 1: per-bucket aggregation (Phase 2 ontology back-propagation) ─────
      // Group responses by the `concern_bucket` snapshot captured at /respond time.
      // We sum `weighted_score` (not raw_score) because polarity-negative items are
      // ALREADY sign-flipped inside weighted_score; summing raw_score would silently
      // double-count negative-polarity items the wrong way during back-prop math.
      // NULL bucket → '_unbucketed' group; merged into the primary anchor below
      // (mirrors the write-time fallback so pre-migration rows don't disappear).
      const { rows: resp } = await pool.query(
        'SELECT weighted_score, raw_score, concern_bucket FROM capadex_responses WHERE session_id = $1',
        [id]
      );

      type BucketAgg = { sumWeighted: number; sumRaw: number; count: number };
      const bucketScores: Record<string, BucketAgg> = {};
      let totalW = 0;
      for (const r of resp as any[]) {
        const w = parseFloat(r.weighted_score || 0);
        const rw = parseFloat(r.raw_score || 0);
        totalW += w;
        const bucket = r.concern_bucket || '_unbucketed';
        if (!bucketScores[bucket]) bucketScores[bucket] = { sumWeighted: 0, sumRaw: 0, count: 0 };
        bucketScores[bucket].sumWeighted += w;
        bucketScores[bucket].sumRaw      += rw;
        bucketScores[bucket].count       += 1;
      }
      const primaryKey: string | null = session.primary_construct_key || null;

      // Fold the '_unbucketed' group into the primary anchor when one exists. This
      // matches the /respond-time fallback contract: items that couldn't be tagged
      // are treated as part of the session's anchor cohort, not as a separate bucket.
      // Snapshot the unbucketed footprint BEFORE the fold so the trace preserves
      // data-quality observability — without this we'd silently mask tagging drift.
      let unbucketedSnapshot: { item_count: number; sum_weighted: number } | null = null;
      if (primaryKey && bucketScores._unbucketed) {
        unbucketedSnapshot = {
          item_count:   bucketScores._unbucketed.count,
          sum_weighted: Math.round(bucketScores._unbucketed.sumWeighted * 10) / 10,
        };
        if (!bucketScores[primaryKey]) bucketScores[primaryKey] = { sumWeighted: 0, sumRaw: 0, count: 0 };
        bucketScores[primaryKey].sumWeighted += bucketScores._unbucketed.sumWeighted;
        bucketScores[primaryKey].sumRaw      += bucketScores._unbucketed.sumRaw;
        bucketScores[primaryKey].count       += bucketScores._unbucketed.count;
        delete bucketScores._unbucketed;
      }

      // ── Pass 2: ontology back-propagation ──────────────────────────────────────
      // For each non-primary bucket present in this session, look up an approved
      // edge (primary → secondary, weight >= 0.60) and boost primary's sumWeighted
      // by secondary.sumWeighted * edge_weight. Edge lookups are batched into a
      // single query AND wrapped in try/catch — any DB error degrades to flat
      // single-mean scoring so the report screen never blocks on ontology faults.
      //
      // Why boost only the primary? Cross-bucket evidence should reinforce the
      // user's anchor concern when concerns are correlated (e.g. anxiety responses
      // informing a stress-management primary). Secondary bucket totals are LEFT
      // INTACT so the per-bucket breakdown in the trace stays honest — they aren't
      // double-counted into session.score, only their boost contribution is.
      const appliedEdges: Array<{ target: string; weight: number; boost: number }> = [];
      let scoringMode: 'flat_single_mean' | 'anchor_backprop' | 'anchor_no_boost' = 'flat_single_mean';
      let backpropError: string | null = null;

      if (primaryKey && bucketScores[primaryKey] && bucketScores[primaryKey].count > 0) {
        scoringMode = 'anchor_no_boost';
        const secondaryBuckets = Object.keys(bucketScores).filter(b => b !== primaryKey);
        if (secondaryBuckets.length > 0) {
          try {
            // Dedupe at query time: take MAX(weight) per (source, target) pair so
            // duplicate approved edges (no DB-level unique constraint guarantees
            // they don't exist) can never boost the same secondary bucket twice.
            // The migration below adds a unique partial index as defence-in-depth.
            const edgeRes = await pool.query(
              `SELECT target_bucket, MAX(weight::numeric) AS weight
                 FROM adaptive_ontology_edges
                WHERE source_bucket = $1
                  AND target_bucket = ANY($2::text[])
                  AND status = 'approved'
                  AND weight::numeric >= 0.60
                GROUP BY target_bucket`,
              [primaryKey, secondaryBuckets]
            );
            for (const er of edgeRes.rows as any[]) {
              const target = String(er.target_bucket);
              const weight = parseFloat(er.weight);
              if (!Number.isFinite(weight) || weight < 0.60) continue;
              const secAgg = bucketScores[target];
              if (!secAgg || secAgg.sumWeighted <= 0) continue;
              const boost = secAgg.sumWeighted * weight;
              bucketScores[primaryKey].sumWeighted += boost;
              appliedEdges.push({ target, weight, boost: Math.round(boost * 10) / 10 });
            }
            if (appliedEdges.length > 0) scoringMode = 'anchor_backprop';
          } catch (edgeErr: any) {
            // Safeguard: ontology table missing / timeout / driver error → fall back
            // to flat single-mean scoring (current production behaviour). The user's
            // report renders normally; we capture the error in the trace for audit.
            backpropError = String(edgeErr?.message || edgeErr || 'unknown');
            scoringMode = 'flat_single_mean';
            console.error('[capadex/complete] ontology back-prop failed — flat scoring:', backpropError);
          }
        }
      }

      // ── Final score selection ──────────────────────────────────────────────────
      // anchor_backprop / anchor_no_boost → score from anchor bucket alone.
      // flat_single_mean → existing behaviour (mean of ALL weighted_scores).
      // Either way, computeNormScore clamps to 0-100, so boosts can't overflow.
      let score = 0;
      if (resp.length > 0) {
        if (scoringMode !== 'flat_single_mean' && primaryKey) {
          const anchor = bucketScores[primaryKey];
          score = computeNormScore(anchor.sumWeighted, anchor.count);
        } else {
          score = computeNormScore(totalW, resp.length);
        }
      }

      const stageIndex  = session.stage_index;
      const nextStageData = stageIndex + 1 < STAGES.length ? STAGES[stageIndex + 1] : null;

      // Build score trace — persisted for admin explainability UI
      const subTraceRows = (await pool.query(`
        SELECT
          COALESCE(si.subdomain_code, saq.dimension) AS subdomain_code,
          COALESCE(ss.subdomain_name, saq.dimension, si.subdomain_code) AS subdomain_name,
          ROUND(AVG(cr.raw_score)::numeric, 1) AS avg_score,
          COUNT(*)::int AS item_count
        FROM capadex_responses cr
        LEFT JOIN sdi_items si ON si.id = cr.item_id
        LEFT JOIN short_assessment_questions saq ON saq.id::text = cr.item_id::text
        LEFT JOIN sdi_subdomains ss ON ss.subdomain_code = COALESCE(si.subdomain_code, saq.dimension)
        WHERE cr.session_id = $1::uuid AND COALESCE(si.subdomain_code, saq.dimension) IS NOT NULL
        GROUP BY COALESCE(si.subdomain_code, saq.dimension),
                 COALESCE(ss.subdomain_name, saq.dimension, si.subdomain_code)
        ORDER BY subdomain_name
      `, [id])).rows;

      // Compute the EFFECTIVE numerator/denominator/formula actually used to
      // produce `score` above, so the trace stays internally consistent with
      // the chosen scoring mode. Without this, downstream consumers reading
      // `session.total_weighted` would see the flat sum even when scoring ran
      // on anchor-only — a real interpretability hazard for explainability UI.
      const anchorAgg = primaryKey ? bucketScores[primaryKey] : null;
      const effectiveTotalWeighted =
        scoringMode !== 'flat_single_mean' && anchorAgg ? anchorAgg.sumWeighted : totalW;
      const effectiveResponseCount =
        scoringMode !== 'flat_single_mean' && anchorAgg ? anchorAgg.count : resp.length;
      const effectiveFormula =
        scoringMode === 'anchor_backprop'
          ? 'score = norm(Σ(anchor.weighted) + Σ(edge_weight × secondary.weighted), anchor.count) — only secondaries with approved edges and weight >= 0.60 contribute'
          : scoringMode === 'anchor_no_boost'
            ? 'score = norm(Σ(anchor.weighted), anchor.count) — anchor present but no approved correlated edges'
            : 'score = norm(Σ(all.weighted), all.count) — flat single-mean (no anchor or back-prop fault)';

      const scoreTrace = buildSessionScoreTrace({
        sessionId:       String(id),
        stageCode:       session.stage_code,
        totalWeighted:   effectiveTotalWeighted,
        responseCount:   effectiveResponseCount,
        normScore:       score,
        subdomains:      subTraceRows.map((r: any) => ({
          subdomain_code: r.subdomain_code,
          subdomain_name: r.subdomain_name,
          avg_score:      Number(r.avg_score),
          item_count:     Number(r.item_count),
        })),
      });
      // Override the canned formula string from buildSessionScoreTrace with the
      // mode-aware one; preserves a single source of truth for the trace.
      if ((scoreTrace as any).session) {
        (scoreTrace as any).session.formula = effectiveFormula;
      }

      // Attach ontology back-propagation trace as an additive sub-object so
      // existing OMEGA-X consumers that only read `session.norm_score` keep
      // working. New consumers (admin explainability UI, longitudinal memory)
      // can opt-in to ontology_backprop for the per-bucket breakdown.
      (scoreTrace as any).ontology_backprop = {
        scoring_mode:    scoringMode,           // flat_single_mean | anchor_no_boost | anchor_backprop
        primary_anchor:  primaryKey,
        bucket_breakdown: Object.entries(bucketScores).map(([bucket, agg]) => ({
          bucket,
          sum_weighted: Math.round(agg.sumWeighted * 10) / 10,
          avg_raw:      agg.count > 0 ? Math.round((agg.sumRaw / agg.count) * 10) / 10 : 0,
          item_count:   agg.count,
          is_primary:   bucket === primaryKey,
        })),
        unbucketed_snapshot: unbucketedSnapshot, // pre-fold tagging footprint when '_unbucketed' was merged into anchor, else null
        applied_edges:   appliedEdges,          // [{ target, weight, boost }] — only populated when scoringMode='anchor_backprop'
        backprop_error:  backpropError,         // string when /ontology query failed, else null
        flat_total_weighted: Math.round(totalW * 10) / 10, // raw across-all-buckets sum, for parity with pre-Phase-2 reports
        flat_response_count: resp.length,
        formula:         effectiveFormula,
      };

      // ── OMEGA-X Composite Payload (8-layer profile) ────────────────────────────
      // Builds the dashboard-facing composite per the consolidation-pass spec.
      // Schema lives in backend/services/omega-x-payload.ts — single source of
      // truth shared with the reader endpoint so layer keys cannot drift.
      // Only telemetry-driven behavioural fields (overthinking, indecisiveness,
      // perfectionism) are computed below; everything else stays at spec defaults.
      //
      // Wrapped in try/catch so a telemetry query failure can never block the
      // user's report. On failure we still write defaults so downstream cards
      // render the structure, with `_omega_x_error` captured for audit.
      const omegaXPayload: Record<string, any> = buildOmegaXSkeleton();
      try {
        // 202 race mitigation: POST /api/signals/telemetry replies 202 and persists
        // the upsert fire-and-forget AFTER responding, so the final question's last
        // telemetry beat can still be in flight when /complete fires. If this session
        // already has ANY telemetry row, wait a short grace period so late-buffered
        // records land in Postgres before we aggregate. Gated on existence so
        // telemetry-free sessions (legacy / disabled / failed POST) pay zero latency.
        const { rows: [telePresence] } = await pool.query(
          'SELECT EXISTS (SELECT 1 FROM capadex_session_telemetry WHERE session_id = $1) AS has_rows',
          [String(id)]
        );
        if (telePresence?.has_rows) {
          await new Promise(resolve => setTimeout(resolve, 350));
        }
        // Aggregate telemetry: avg hesitation + total backtracks for this session.
        // COALESCE handles the no-telemetry case (e.g. legacy sessions, telemetry
        // endpoint disabled, client failed to POST) — formulas then no-op.
        const { rows: [tele] } = await pool.query(
          `SELECT COALESCE(AVG(hesitation_ms), 0)::numeric  AS avg_hesitation_ms,
                  COALESCE(SUM(backtrack_count), 0)::int    AS total_backtracks,
                  COUNT(*)::int                              AS telemetry_rows
             FROM capadex_session_telemetry
            WHERE session_id = $1`,
          [String(id)]
        );
        const avgHesitationMs = Number(tele?.avg_hesitation_ms || 0);
        const totalBacktracks = Number(tele?.total_backtracks || 0);

        // ── Module 3 — Bayesian Inference & Probabilistic Persona Modeling ──
        // Replaces the prior additive (+0.12 / +0.15) bumps with a normalised
        // Bayesian update. Each trait's prior is derived from the assessment
        // back-propagation score (low score = higher prior distress), then the
        // telemetry evidence updates the posterior to a confidence-weighted
        // probability in [0, 1]. Sequential application is supported — see
        // burnout_risk below, which folds hesitation evidence first, then
        // backtrack evidence, demonstrating the "running posterior" pattern.
        //
        // Prior derivation: `score` is the back-propagated CAPADEX severity
        // score on 0-100 (lower = more concern). Map to distress prior via
        // (100 - score) / 100, then floor/ceiling at [0.05, 0.95] so a perfect
        // score doesn't lock the posterior at 0 and a floor score doesn't lock
        // it at 1 — both extremes degenerate the Bayesian update.
        const distressPrior = Math.min(0.95, Math.max(0.05, (100 - score) / 100));

        // Likelihoods are calibrated evidence weights. 0.50 = neutral (signal
        // is uninformative; posterior == prior). The thresholds preserve the
        // intent of the original additive triggers (>8000ms hesitation,
        // >=3 backtracks etc.) but route through a probabilistic updater.
        const likOverthinking   = avgHesitationMs > 8000 ? 0.75
                                : avgHesitationMs < 2000 ? 0.30 : 0.50;
        const likIndecisiveness = totalBacktracks  >= 3   ? 0.75
                                : totalBacktracks  === 0  ? 0.30 : 0.50;
        const likPerfectionism  = totalBacktracks  >= 5   ? 0.75
                                : totalBacktracks  <= 1   ? 0.30 : 0.50;

        // Single-evidence updates for the three behavioural traits.
        omegaXPayload.behavioural.overthinking   = calculateBayesianUpdate(distressPrior, likOverthinking);
        omegaXPayload.behavioural.indecisiveness = calculateBayesianUpdate(distressPrior, likIndecisiveness);
        omegaXPayload.behavioural.perfectionism  = calculateBayesianUpdate(distressPrior, likPerfectionism);

        // Sequential evidence chain for burnout_risk — both signals matter
        // independently, so we update on hesitation evidence first, then feed
        // the resulting posterior as the prior for the backtrack evidence.
        // This is the canonical "running posterior" pattern: each new piece
        // of evidence refines the previous estimate.
        const likBurnoutHesitation = avgHesitationMs > 10_000 ? 0.70
                                   : avgHesitationMs < 3_000  ? 0.30 : 0.50;
        const likBurnoutBacktracks = totalBacktracks  >= 4    ? 0.70
                                   : totalBacktracks  === 0   ? 0.30 : 0.50;
        const burnoutAfterHesitation = calculateBayesianUpdate(distressPrior,           likBurnoutHesitation);
        const burnoutFinal           = calculateBayesianUpdate(burnoutAfterHesitation, likBurnoutBacktracks);
        omegaXPayload.risk.burnout_risk = burnoutFinal;

        // Final clamp + round to 2 decimals on the touched fields. Bayesian
        // output is already in [0,1] but rounding keeps the persisted JSON
        // human-readable and avoids floating-point noise in downstream diffs.
        for (const k of ['overthinking','indecisiveness','perfectionism'] as const) {
          omegaXPayload.behavioural[k] = Math.round(omegaXPayload.behavioural[k] * 100) / 100;
        }
        omegaXPayload.risk.burnout_risk = Math.round(omegaXPayload.risk.burnout_risk * 100) / 100;

        // Diagnostics block — surfaced for explainability; downstream dashboards
        // can hide it. Not part of the spec layers; kept under a reserved key.
        // Bayesian inputs included so the admin UI can trace why a posterior
        // landed where it did (prior + each likelihood that fed the update).
        omegaXPayload._telemetry_inputs = {
          avg_hesitation_ms: Math.round(avgHesitationMs),
          total_backtracks:  totalBacktracks,
          telemetry_rows:    Number(tele?.telemetry_rows || 0),
        };
        omegaXPayload._bayesian_trace = {
          method:        'normalised_bayes',
          distress_prior: Math.round(distressPrior * 100) / 100,
          likelihoods:   {
            overthinking:        likOverthinking,
            indecisiveness:      likIndecisiveness,
            perfectionism:       likPerfectionism,
            burnout_hesitation:  likBurnoutHesitation,
            burnout_backtracks:  likBurnoutBacktracks,
          },
          burnout_sequential: {
            after_hesitation: Math.round(burnoutAfterHesitation * 100) / 100,
            after_backtracks: Math.round(burnoutFinal           * 100) / 100,
          },
        };
      } catch (omegaErr: any) {
        // Telemetry table missing / query error → keep defaults, log the error
        // into the payload itself so audit can correlate. Never throws.
        omegaXPayload._omega_x_error = String(omegaErr?.message || omegaErr || 'unknown');
        console.error('[capadex/complete] omega_x telemetry calibration failed:', omegaErr);
      }

      await pool.query(
        'UPDATE capadex_sessions SET status = $1, score = $2, score_trace = $3, omega_x_payload = $4, updated_at = now() WHERE id = $5',
        ['completed', score, JSON.stringify(scoreTrace), JSON.stringify(omegaXPayload), id]
      );

      // Audit: log score_computed event (non-blocking). Now includes the
      // ontology back-prop summary so admins can correlate score changes with
      // edge activations across sessions.
      pool.query(`
        INSERT INTO capadex_audit_events (session_id, event_type, payload, created_at)
        VALUES ($1, 'score_computed', $2, now())
      `, [id, redactJson({
        stage_code:    session.stage_code,
        score,
        response_count: resp.length,
        total_weighted: Math.round(totalW * 10) / 10,
        scoring_mode:  scoringMode,
        primary_anchor: primaryKey,
        applied_edges: appliedEdges,
        formula:       (scoreTrace as any).ontology_backprop.formula,
        score_trace:   scoreTrace,
      }) ?? '{}']).catch(() => {/* non-critical */});

      const stageLabel  = STAGES[stageIndex]?.label || '';
      const insight     = generateStageInsight(stageLabel, score, session.concern_name);
      const { label: scoreLevel, color: levelColor } = getScoreLevel(score);

      // Fire enterprise post-completion hooks (non-blocking — recommendations, risk, gamification, audit)
      const _guestEmail = String(session.guest_email || '').toLowerCase();
      pool.query(`SELECT id FROM capadex_users WHERE LOWER(email)=$1 LIMIT 1`, [_guestEmail])
        .then(ur => postCompletionHooks(pool, String(id), ur.rows[0]?.id || null, session.concern_name, session.stage_code, score, scoreLevel, _guestEmail))
        .catch(console.error);

      // Build the Unified Behavior Graph (non-blocking — aggregates every intelligence
      // system into one persisted graph per session; never breaks completion).
      buildBehaviorGraph(pool, String(id))
        .then(() => generateInterventionIntelligence(pool, String(id)))
        .catch(console.error);

      // LBI post-completion trigger — recalculates and persists the unified Learning
      // Behaviour Index for this user from ALL their CAPADEX sessions. Fire-and-forget;
      // skips silently when email is absent or sessions_analyzed === 0.
      if (_guestEmail) calculateAndPersistLBI(_guestEmail, pool).catch(console.error);

      // Update cognitive runtime state on stage complete (non-blocking — fail-safe)
      updateStateOnStageComplete(pool, String(id), {
        stage_code:      session.stage_code,
        score,
        score_level:     scoreLevel,
        subdomain_count: subTraceRows.length,
      });

      // Broadcast stage transition event — fire-and-forget, flag-gated by `websocket_runtime`.
      // Received by GovernancePanel (RuntimeStateTab drawer) and any future end-user progress UI.
      // Payload shape must stay in sync with the badge renderer in GovernancePanel.tsx.
      broadcastToSession(String(id), {
        type: 'stage_transitioned',
        data: {
          stage_code:   session.stage_code,
          stage_index:  stageIndex,
          score,
          score_level:  scoreLevel,
          next_stage:   nextStageData ? { code: nextStageData.code, label: nextStageData.label } : null,
          has_next:     !!nextStageData,
        },
        explain: `Stage ${session.stage_code} completed with score ${score} (${scoreLevel})${nextStageData ? ` — next: ${nextStageData.label}` : ' — final stage'}`,
      }, completeTenantId);

      // Subdomains assessed — join both sdi_items (UUID) and short_assessment_questions (integer)
      const { rows: subs } = await pool.query(`
        SELECT
          COALESCE(si.subdomain_code, saq.dimension) AS subdomain_code,
          COALESCE(ss.subdomain_name, saq.dimension, si.subdomain_code) AS subdomain_name,
          ROUND(AVG(cr.raw_score)::numeric, 1) AS avg_score,
          COUNT(*)::int AS item_count
        FROM capadex_responses cr
        LEFT JOIN sdi_items si
          ON si.id = cr.item_id
          AND cr.item_id::text !~ '^[0-9]+$'
        LEFT JOIN short_assessment_questions saq
          ON saq.id::text = cr.item_id::text
          AND cr.item_id::text ~ '^[0-9]+$'
        LEFT JOIN sdi_subdomains ss
          ON ss.subdomain_code = COALESCE(si.subdomain_code, saq.dimension)
        WHERE cr.session_id = $1::uuid
          AND COALESCE(si.subdomain_code, saq.dimension) IS NOT NULL
        GROUP BY COALESCE(si.subdomain_code, saq.dimension),
                 COALESCE(ss.subdomain_name, saq.dimension, si.subdomain_code)
        ORDER BY subdomain_name
      `, [id]);

      // ── Persist the report row at completion (Phase 3 fix) ─────────────────────
      // Previously `capadex_reports` was written ONLY lazily on GET /report/:id, so
      // the OMEGA-X enriched endpoint (which requires this row) returned 404 for any
      // session that completed but was never re-fetched — silently hiding every
      // enriched clarity-report section in the UI. Create/refresh it here so the
      // enriched report is available the instant the assessment finishes.
      // Best-effort: a write fault here must never block the completion response.
      try {
        const _normEmail = session.guest_email ? String(session.guest_email).trim().toLowerCase() : null;
        const _userRow = _normEmail
          ? await pool.query(`SELECT id FROM capadex_users WHERE LOWER(email)=$1`, [_normEmail])
          : { rows: [] as Array<{ id: string }> };
        const _userId = _userRow.rows[0]?.id || null;
        const _existing = await pool.query(
          `SELECT id FROM capadex_reports WHERE session_id=$1 LIMIT 1`, [id]
        );
        if (_existing.rows.length > 0) {
          await pool.query(
            `UPDATE capadex_reports
                SET user_id=COALESCE($1,user_id), concern_name=$2, stage_code=$3,
                    score=$4, score_level=$5, insight=$6, participant_name=$7,
                    participant_age=$8, subdomains=$9, updated_at=now()
              WHERE id=$10`,
            [_userId, session.concern_name, session.stage_code, score, scoreLevel,
             insight, session.guest_name, session.user_age, JSON.stringify(subs),
             _existing.rows[0].id]
          );
        } else {
          await pool.query(
            `INSERT INTO capadex_reports
               (user_id, session_id, concern_name, stage_code, score, score_level, insight,
                participant_name, participant_age, subdomains, report_data)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [_userId, id, session.concern_name, session.stage_code, score, scoreLevel,
             insight, session.guest_name, session.user_age, JSON.stringify(subs),
             JSON.stringify({ generatedAt: new Date().toISOString(), source: 'session_complete' })]
          );
        }
      } catch (reportErr: unknown) {
        const m = reportErr instanceof Error ? reportErr.message : String(reportErr);
        console.error('[capadex/complete] report row upsert failed (non-blocking):', m);
      }

      const progress = await buildProgress(pool, session.guest_email, session.concern_name);

      // Contradiction detection (gated by contradiction_detection flag, per-tenant)
      let contradictionDetected = false;
      if (isEnabled('contradiction_detection', completeTenantId) && subs.length > 1) {
        const scores = subs.map((s: any) => Number(s.avg_score));
        const max = Math.max(...scores);
        const min = Math.min(...scores);
        contradictionDetected = (max - min) > 50;
      }

      // Confidence engine (gated by confidence_engine flag, per-tenant)
      const confidenceIntervals = isEnabled('confidence_engine', completeTenantId)
        ? subs.map((s: any) => ({
            subdomain_code: s.subdomain_code,
            confidence:     Math.min(1, Number(s.item_count) / 5),
          }))
        : null;

      res.json({
        ok:                     true,
        session_id:             id,
        stage_code:             session.stage_code,
        stage_label:            stageLabel,
        stage_index:            stageIndex,
        score,
        score_level:            scoreLevel,
        level_color:            levelColor,
        insight,
        subdomains:             subs,
        next_stage:             nextStageData
          ? { code: nextStageData.code, label: nextStageData.label, index: nextStageData.index, color: nextStageData.color, desc: nextStageData.desc }
          : null,
        concern_name:           session.concern_name,
        progress,
        contradiction_detected: contradictionDetected,
        confidence_intervals:   confidenceIntervals,
        omega_x_payload:        omegaXPayload,
      });
    } catch (err) { next(err); }
  });

  // ── GET /api/capadex/progress ────────────────────────────────────────
  app.get('/api/capadex/progress', async (req: Request, res: Response, next: NextFunction) => {
    const email   = ((req.query.email   as string) || '').trim().toLowerCase();
    const concern = (req.query.concern as string) || '';
    if (!email || !concern) return res.status(400).json({ error: 'email and concern are required' });
    try {
      const progress = await buildProgress(pool, email, concern);
      res.json({ progress, email, concern });
    } catch (err) { next(err); }
  });

  // ── POST /api/capadex/auth/register ─────────────────────────────────
  // Password is optional — if omitted the backend generates a random one so
  // the UI can offer a frictionless OTP-only registration flow.
  app.post('/api/capadex/auth/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, phone, name, session_id } = req.body;
      let { password } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required' });
      const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRx.test(email)) return res.status(400).json({ error: 'Invalid email address' });
      // Auto-generate a secure random password when not provided (OTP-only flow)
      if (!password || password.length < 8) {
        const { randomBytes } = await import('crypto');
        password = randomBytes(32).toString('hex');
      }

      const normEmail = email.trim().toLowerCase();
      const displayName = (name || '').trim();

      // Upsert user (allow re-register if not yet verified)
      const existing = await pool.query(
        `SELECT id, name, email_verified FROM capadex_users WHERE LOWER(email) = $1`,
        [normEmail]
      );

      let userId: string;
      if (existing.rows.length > 0) {
        const user = existing.rows[0];
        if (user.email_verified) {
          // Block registration when this email has already completed 3 free (CAP_CUR) assessments.
          const freeCurCount = await pool.query(
            `SELECT COUNT(*)::int AS cnt FROM capadex_sessions
             WHERE LOWER(guest_email)=$1 AND status='completed' AND stage_code='CAP_CUR'`,
            [normEmail]
          );
          if ((freeCurCount.rows[0]?.cnt ?? 0) >= 3) {
            return res.status(409).json({ error: 'FREE_ASSESSMENT_LIMIT', name: user.name });
          }
          // no free session completed — fall through to EMAIL_EXISTS
          return res.status(409).json({ error: 'EMAIL_EXISTS', name: user.name });
        }
        // Not verified — update password + phone
        const hash = await hashPassword(password);
        await pool.query(
          `UPDATE capadex_users SET password_hash=$1, phone=$2, name=COALESCE(NULLIF($3,''),name), updated_at=now() WHERE id=$4`,
          [hash, phone || '', displayName, user.id]
        );
        userId = user.id;
      } else {
        const hash = await hashPassword(password);
        const ins = await pool.query(
          `INSERT INTO capadex_users (name, email, phone, password_hash, email_verified)
           VALUES ($1,$2,$3,$4,false) RETURNING id`,
          [displayName, normEmail, phone || '', hash]
        );
        userId = ins.rows[0].id;
      }

      // Backfill guest_email on the session that was just completed (was started anonymously)
      if (session_id) {
        pool.query(
          `UPDATE capadex_sessions SET guest_email=$1 WHERE id=$2 AND guest_email IS NULL`,
          [normEmail, session_id]
        ).catch(() => {});
      }

      // Reuse an existing valid OTP if there is one (prevents "no active OTP" when
      // the user navigates back from the OTP screen and re-submits the register form)
      const existing_otp = await pool.query(
        `SELECT code FROM capadex_otps
         WHERE LOWER(email)=$1 AND used=false AND expires_at > now()
         ORDER BY created_at DESC LIMIT 1`,
        [normEmail]
      );

      let code: string;
      if (existing_otp.rows.length > 0) {
        // Reuse the already-sent, still-valid code — just resend the email
        code = existing_otp.rows[0].code;
      } else {
        // No valid OTP exists — generate a fresh one
        code = generateOtp();
        await pool.query(
          `INSERT INTO capadex_otps (email, code, expires_at) VALUES ($1,$2, now() + interval '10 minutes')`,
          [normEmail, code]
        );
      }

      // Look up the stage code from the session so the OTP email is stage-aware
      let sessionStageCode: string | undefined;
      if (session_id) {
        try {
          const stageRow = await pool.query(
            `SELECT stage_code FROM capadex_sessions WHERE id=$1 LIMIT 1`,
            [session_id]
          );
          if (stageRow.rows.length > 0) sessionStageCode = stageRow.rows[0].stage_code;
        } catch (_) { /* non-blocking */ }
      }

      // Send OTP email (non-blocking failure)
      sendCapadexOtp(normEmail, displayName, code, sessionStageCode).catch(console.error);

      res.json({ ok: true, userId, email: normEmail });
    } catch (err) { next(err); }
  });

  // ── POST /api/capadex/auth/request-otp ───────────────────────────────
  // Intro-phase email verification: creates user if new (auto-password),
  // then sends a fresh OTP. Called before the Analyse button is unlocked.
  app.post('/api/capadex/auth/request-otp', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, name } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required' });
      const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRx.test(email.trim())) return res.status(400).json({ error: 'Invalid email address' });
      const normEmail = email.trim().toLowerCase();
      const displayName = (name || '').trim();

      const userRow = await pool.query(
        `SELECT id, name, email_verified FROM capadex_users WHERE LOWER(email)=$1 LIMIT 1`,
        [normEmail]
      );

      let userId: string;
      let userName: string;

      if (userRow.rows.length === 0) {
        // New user — create with auto-generated password
        const { randomBytes } = await import('crypto');
        const password = randomBytes(32).toString('hex');
        const hash = await hashPassword(password);
        const guessedName = displayName || normEmail.split('@')[0];
        const inserted = await pool.query(
          `INSERT INTO capadex_users (name, email, password_hash, email_verified)
           VALUES ($1,$2,$3,false) RETURNING id, name`,
          [guessedName, normEmail, hash]
        );
        userId = inserted.rows[0].id;
        userName = inserted.rows[0].name;
      } else {
        const user = userRow.rows[0];
        // Check assessment limit for verified users
        if (user.email_verified) {
          const countRow = await pool.query(
            `SELECT COUNT(*)::int AS cnt FROM capadex_sessions
             WHERE LOWER(guest_email)=$1 AND status='completed' AND stage_code='CAP_CUR'`,
            [normEmail]
          );
          if ((countRow.rows[0]?.cnt ?? 0) >= 3) {
            return res.status(409).json({ error: 'FREE_ASSESSMENT_LIMIT', name: user.name });
          }
        }
        userId = user.id;
        userName = user.name || displayName || normEmail.split('@')[0];
      }

      // Invalidate old OTPs and insert a fresh one
      await pool.query(`UPDATE capadex_otps SET used=true WHERE LOWER(email)=$1 AND used=false`, [normEmail]);
      const code = generateOtp();
      await pool.query(
        `INSERT INTO capadex_otps (email, code, expires_at) VALUES ($1,$2, now() + interval '10 minutes')`,
        [normEmail, code]
      );
      sendIntroVerificationOtp(normEmail, userName, code).catch(console.error);

      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ── GET /api/capadex/auth/check-email ────────────────────────────────
  // Lightweight early-validation endpoint called on email blur in the
  // register form. Returns whether the email is known, verified, and
  // how many completed free (CAP_CUR) assessments this email has used.
  // at_limit = true when assessment_count >= 3 (max free attempts reached).
  app.get('/api/capadex/auth/check-email', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = String(req.query.email || '').trim().toLowerCase();
      const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRx.test(email)) {
        return res.json({ exists: false, verified: false, has_free_assessment: false, assessment_count: 0, at_limit: false, name: '' });
      }
      const userRow = await pool.query(
        `SELECT id, name, email_verified FROM capadex_users WHERE LOWER(email)=$1 LIMIT 1`,
        [email]
      );
      if (userRow.rows.length === 0) {
        return res.json({ exists: false, verified: false, has_free_assessment: false, assessment_count: 0, at_limit: false, name: '' });
      }
      const user = userRow.rows[0];
      if (!user.email_verified) {
        return res.json({ exists: true, verified: false, has_free_assessment: false, assessment_count: 0, at_limit: false, name: user.name });
      }
      const countRow = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM capadex_sessions
         WHERE LOWER(guest_email)=$1 AND status='completed' AND stage_code='CAP_CUR'`,
        [email]
      );
      const assessmentCount: number = countRow.rows[0]?.cnt ?? 0;
      return res.json({
        exists: true,
        verified: true,
        has_free_assessment: assessmentCount > 0,
        assessment_count: assessmentCount,
        at_limit: assessmentCount >= 3,
        name: user.name,
      });
    } catch (err) { next(err); }
  });

  // ── POST /api/capadex/auth/verify-otp ────────────────────────────────
  app.post('/api/capadex/auth/verify-otp', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, otp, session_id } = req.body;
      if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });
      const normEmail = email.trim().toLowerCase();

      // ── OTP brute-force cap (WC-C8A) ────────────────────────────────────────
      // Reject before any code comparison if this email has already hit 5 wrong attempts.
      const attRow = await pool.query(
        `SELECT COALESCE(MAX(attempts), 0) AS max_att FROM capadex_otps
         WHERE LOWER(email)=$1 AND used=false AND expires_at > now()`,
        [normEmail]
      );
      if (parseInt(String(attRow.rows[0]?.max_att ?? '0'), 10) >= 5) {
        return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });
      }

      const enteredCode = String(otp).trim();
      // Match directly on the submitted code so any valid, unexpired OTP works
      // (covers the case where the user navigated back, re-registered, then entered the original code)
      const otpRow = await pool.query(
        `SELECT id, code, expires_at, used FROM capadex_otps
         WHERE LOWER(email)=$1 AND code=$2 AND used=false AND expires_at > now()
         ORDER BY created_at DESC LIMIT 1`,
        [normEmail, enteredCode]
      );
      if (otpRow.rows.length === 0) {
        // Check if there's a valid OTP at all (to give a better error message)
        const anyValid = await pool.query(
          `SELECT 1 FROM capadex_otps WHERE LOWER(email)=$1 AND used=false AND expires_at > now() LIMIT 1`,
          [normEmail]
        );
        if (anyValid.rows.length > 0) {
          // Increment attempt counter before returning the mismatch error
          await pool.query(
            `UPDATE capadex_otps SET attempts = attempts + 1 WHERE LOWER(email)=$1 AND used=false AND expires_at > now()`,
            [normEmail]
          );
          return res.status(400).json({ error: 'Incorrect code. Please check your email and try again.' });
        }
        return res.status(400).json({ error: 'Code has expired or was already used. Please click Resend to get a new code.' });
      }

      const row = otpRow.rows[0];

      // Mark OTP used + verify user
      await pool.query(`UPDATE capadex_otps SET used=true WHERE id=$1`, [row.id]);
      const userRow = await pool.query(
        `UPDATE capadex_users SET email_verified=true, updated_at=now() WHERE LOWER(email)=$1 RETURNING id, name, email, phone`,
        [normEmail]
      );
      const user = userRow.rows[0];

      // Backfill guest_email on the session (non-blocking) — covers cases where
      // register already set it and also the login-via-OTP path
      if (session_id) {
        pool.query(
          `UPDATE capadex_sessions SET guest_email=$1 WHERE id=$2 AND guest_email IS NULL`,
          [normEmail, session_id]
        ).catch(() => {});
      }

      res.json({ ok: true, user });
    } catch (err) { next(err); }
  });

  // ── POST /api/capadex/auth/resend-otp ────────────────────────────────
  app.post('/api/capadex/auth/resend-otp', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required' });
      const normEmail = email.trim().toLowerCase();

      const userRow = await pool.query(`SELECT id, name FROM capadex_users WHERE LOWER(email)=$1`, [normEmail]);
      if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

      await pool.query(`UPDATE capadex_otps SET used=true WHERE LOWER(email)=$1 AND used=false`, [normEmail]);
      const code = generateOtp();
      await pool.query(
        `INSERT INTO capadex_otps (email, code, expires_at) VALUES ($1,$2, now() + interval '10 minutes')`,
        [normEmail, code]
      );
      sendCapadexOtp(normEmail, userRow.rows[0].name, code).catch(console.error);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ── GET /api/capadex/auth/incomplete-session ─────────────────────────
  // Returns the most recent in_progress Curiosity (CAP_CUR) session for an email.
  app.get('/api/capadex/auth/incomplete-session', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = (req.query.email as string || '').trim().toLowerCase();
      if (!email) return res.status(400).json({ error: 'email is required' });
      const { rows } = await pool.query(`
        SELECT id, concern_name, answered_items, total_items, updated_at
        FROM capadex_sessions
        WHERE LOWER(guest_email) = $1
          AND stage_code = 'CAP_CUR'
          AND status     = 'in_progress'
          AND updated_at > now() - interval '7 days'
        ORDER BY updated_at DESC
        LIMIT 1
      `, [email]);
      if (rows.length === 0) return res.json({ has_incomplete: false });
      const s = rows[0];
      res.json({
        has_incomplete: true,
        session: {
          session_id:     s.id,
          concern_name:   s.concern_name,
          answered_items: s.answered_items,
          total_items:    s.total_items,
          updated_at:     s.updated_at,
        },
      });
    } catch (err) { next(err); }
  });

  // ── GET /api/capadex/session/:id/load ────────────────────────────────
  // Reconstructs question list + prior answers for resuming an in_progress session.
  // ── GET /api/capadex/session/:id/omega-x ──────────────────────────────────
  // OMEGA-X composite payload reader for the post-assessment dashboard.
  // Anonymous by design — matches the rest of the CAPADEX funnel (start /
  // respond / complete / telemetry are all session_id-token-based, no login).
  // The session UUID is the implicit ownership token.
  //
  // Returns the persisted `omega_x_payload` from `capadex_sessions`. If the
  // session predates the OMEGA-X column or the payload is still empty (e.g.
  // session never reached /complete), returns a fully-initialised 8-layer
  // skeleton (from the shared factory at backend/services/omega-x-payload.ts)
  // so the frontend never crashes on `payload.behavioural.overthinking` lookups.
  const omegaXReader = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      // Validate UUID-ish shape early so a malformed param doesn't trigger
      // a Postgres CAST error (cleaner 400 than a 500 from the driver).
      if (!id || typeof id !== 'string' || id.length < 8) {
        return res.status(400).json({ error: 'invalid_session_id' });
      }
      const { rows: [row] } = await pool.query(
        `SELECT id, status, omega_x_payload, score, score_trace IS NOT NULL AS has_score_trace
           FROM capadex_sessions WHERE id = $1`,
        [id]
      );
      if (!row) return res.status(404).json({ error: 'session_not_found' });

      // Strict shape guard — `{behavioural:{}}` is now correctly flagged as
      // skeleton (previous truthy-check treated it as populated). UI badge is
      // semantically accurate.
      const raw = row.omega_x_payload;
      const hasPayload = isPopulatedOmegaXPayload(raw);
      const payload = hasPayload ? raw : buildOmegaXSkeleton();

      return res.status(200).json({
        ok:               true,
        session_id:       row.id,
        status:           row.status,
        is_skeleton:      !hasPayload,           // tells UI to show "Preliminary" badge if true
        omega_x_payload:  payload,
      });
    } catch (err) { next(err); }
  };
  app.get('/api/capadex/session/:id/omega-x',     gateSessionEntitlement, omegaXReader);
  // Alias per the build spec — both paths return identical envelopes. Guarded too (WC-C4) so the
  // entitlement gate is not bypassable via the /api/assessment mount of the SAME reader.
  app.get('/api/assessment/session/:id/omega-x',  gateSessionEntitlement, omegaXReader);

  // ── Explainability runtime (Phase 4) ──────────────────────────────────────
  // Read-only lineage over the persisted spine. Anonymous by design like the rest
  // of the CAPADEX funnel — the session UUID is the implicit ownership token.
  // Session ids are gen_random_uuid() — validate strictly so malformed values are
  // rejected with a deterministic 400 before they reach a UUID-typed query (which
  // would otherwise raise a DB cast error and bubble up as a 500).
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const validSessionId = (id: unknown): id is string =>
    typeof id === 'string' && UUID_RE.test(id);

  // GET /api/capadex/session/:id/signals — active atomic signals for the session.
  app.get('/api/capadex/session/:id/signals', gateSessionEntitlement, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!validSessionId(id)) return res.status(400).json({ error: 'invalid_session_id' });
      const signals = await getSessionSignals(pool, id);
      return res.status(200).json({ ok: true, session_id: id, signals });
    } catch (err) { next(err); }
  });

  // GET /api/capadex/session/:id/patterns — synthesised behavioural patterns AND
  // composite signals for this session.  The enriched response shape lets the
  // IntelligenceLayers Patterns tab render both layers from a single request.
  // Response: { ok, session_id, patterns: PatternRow[], composites: CompositeSignal[] }
  app.get('/api/capadex/session/:id/patterns', gateSessionEntitlement, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!validSessionId(id)) return res.status(400).json({ error: 'invalid_session_id' });
      const [patterns, composites] = await Promise.all([
        getSessionPatterns(pool, id),
        getSessionComposites(pool, id),
      ]);
      return res.status(200).json({ ok: true, session_id: id, patterns, composites });
    } catch (err) { next(err); }
  });

  // GET /api/capadex/session/:id/composites — Gap 3: composite signal mid-tier.
  // Returns every composite formed from co-active atomic signals for this session,
  // with full explainability: required_signals, signal_refs, weighting_method.
  app.get('/api/capadex/session/:id/composites', gateSessionEntitlement, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!validSessionId(id)) return res.status(400).json({ error: 'invalid_session_id' });
      const composites = await getSessionComposites(pool, id);
      return res.status(200).json({ ok: true, session_id: id, composites });
    } catch (err) { next(err); }
  });

  // GET /api/capadex/session/:id/explain — report-insight explainability.
  // Returns the user-facing { finding, evidence, signals, patterns, recommendations }
  // (integrating OMEGA-X / Pragati / CSI from stored intelligence) AND the original
  // per-pattern `lineage` (backward-compatible). NO AI / NO recompute — stored only.
  app.get('/api/capadex/session/:id/explain', gateSessionEntitlement, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!validSessionId(id)) return res.status(400).json({ error: 'invalid_session_id' });
      const explanation = await explainSession(pool, id);
      // Additive, read-only, empty-safe strength surface (never from raw signal
      // magnitude). Best-effort: a failure must never break /explain.
      const strengths = await discoverStrengths(pool, id).catch(() => null);
      return res.status(200).json({ ok: true, ...explanation, strengths });
    } catch (err) { next(err); }
  });

  // GET /api/capadex/session/:id/guidance — Phase 6 Runtime Intelligence Activation.
  // Read-only surface of the admin-authored PIL guidance chain for this session
  // (archetype → human problems → behaviours → search intents → interventions →
  // growth path / action plan). Flag-gated: OFF → `{enabled:false}` so the report
  // section hides and behaviour is byte-identical to legacy. Never recomputes,
  // never fabricates, never 500s; an unresolved concern degrades gracefully.
  app.get('/api/capadex/session/:id/guidance', gateSessionEntitlement, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) {
        return res.status(200).json({ ok: true, enabled: false });
      }
      const { id } = req.params;
      if (!validSessionId(id)) return res.status(400).json({ error: 'invalid_session_id' });
      const guidance = await buildGuidanceForSession(pool, id).catch((err) => {
        console.warn('[capadex-guidance] build failed, degrading:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!guidance) {
        return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      }
      return res.status(200).json({ ok: true, session_id: id, ...guidance });
    } catch (err) { next(err); }
  });

  // GET /api/capadex/session/:id/grounding — WC-1B-R Phase 5 explainability lineage.
  // Read-only chain: Concern → Bridge Tag → Grounded Signals (WC-1B) → which of
  // those grounded signals actually ACTIVATED for this session. NO recompute / NO
  // writes / NO fabrication. Flag-gated BEFORE the UUID guard: OFF → {enabled:false}
  // so behaviour is byte-identical to legacy. Never 500s; degrades gracefully.
  app.get('/api/capadex/session/:id/grounding', gateSessionEntitlement, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isSignalGroundingRuntimeEnabled()) {
        return res.status(200).json({ ok: true, enabled: false });
      }
      const { id } = req.params;
      if (!validSessionId(id)) return res.status(400).json({ error: 'invalid_session_id' });

      // Resolve this session's concern → numeric pk → bridge tag.
      const sessRes = await pool.query<{ concern_name: string | null; master_concern_pk: number | null }>(
        'SELECT concern_name, master_concern_pk FROM capadex_sessions WHERE id = $1 LIMIT 1',
        [id],
      );
      if (sessRes.rows.length === 0) return res.status(404).json({ error: 'session_not_found' });
      const row = sessRes.rows[0];
      let pk: number | null =
        typeof row.master_concern_pk === 'number' && Number.isFinite(row.master_concern_pk)
          ? row.master_concern_pk
          : null;
      if (pk === null) pk = await resolveSeedConcernPk(pool, row.concern_name ?? null).catch(() => null);
      const bridgeTag = await resolveBridgeTagForConcernPk(pool, pk).catch(() => null);

      const lineage = await loadGroundedLineage(pool, bridgeTag).catch(() => null);
      if (!lineage || !bridgeTag) {
        return res.status(200).json({
          ok: true, enabled: true, session_id: id,
          concern_name: row.concern_name, bridge_tag: bridgeTag, grounded: false,
          families: [], signals: [], activated_signal_count: 0,
        });
      }

      // Tie grounded signals to this session's actual activation: a grounded signal
      // is "activated" when a session signal shares its core token. Read-only.
      const actRes = await pool.query<{ signal_key: string; strength: string | null }>(
        'SELECT signal_key, strength FROM capadex_session_signals WHERE session_id = $1',
        [id],
      );
      const activeByToken = new Map<string, number>();
      for (const a of actRes.rows) {
        const tok = groundingCoreToken(a.signal_key);
        if (tok) activeByToken.set(tok, Math.max(activeByToken.get(tok) ?? 0, Number(a.strength) || 0));
      }
      const signals = lineage.signals.map((s) => {
        const tok = groundingCoreToken(s.atomic_signal_name ?? s.atomic_signal_id);
        const activated = activeByToken.has(tok);
        return { ...s, activated, activation_strength: activated ? activeByToken.get(tok)! : null };
      });
      const activated_signal_count = signals.filter((s) => s.activated).length;

      return res.status(200).json({
        ok: true, enabled: true, session_id: id,
        concern_name: row.concern_name,
        bridge_tag: bridgeTag,
        grounded: lineage.grounded,
        families: lineage.families,
        signals,
        activated_signal_count,
      });
    } catch (err) { next(err); }
  });

  // GET /api/capadex/session/:id/pipeline — Phase 6A Runtime Intelligence Pipeline.
  // Read-only resolver that walks the full forward lineage for this session:
  // Response → Signal → Concern → Capability → Problem → Behavior → Archetype →
  // Intervention. Composes the existing engines (no writes/recompute/new content).
  // Flag-gated: OFF → `{enabled:false}` so behaviour is byte-identical to legacy.
  // Each hop degrades independently; never fabricates, never mis-routes, never 500s.
  app.get('/api/capadex/session/:id/pipeline', gateSessionEntitlement, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligencePipelineEnabled()) {
        return res.status(200).json({ ok: true, enabled: false });
      }
      const { id } = req.params;
      if (!validSessionId(id)) return res.status(400).json({ error: 'invalid_session_id' });
      const pipeline = await buildPipelineForSession(pool, id).catch((err) => {
        console.warn('[capadex-pipeline] build failed, degrading:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!pipeline) {
        return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      }
      return res.status(200).json({ ok: true, ...pipeline });
    } catch (err) { next(err); }
  });

  // GET /api/capadex/session/:id/stage — WC-3 L1 Stage Intelligence (Phase A).
  // Read-only canonical behavioural stage (Awareness → Curiosity → Clarity →
  // Growth → Mastery) composed from the session's stage_code + CSI. Flag-gated:
  // OFF → `{enabled:false}` (byte-identical legacy). Never recomputes scores,
  // never 500s; an unknown/transient session degrades honestly.
  app.get('/api/capadex/session/:id/stage', gateSessionEntitlement, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { isWc3StageEnabled } = await import('../config/feature-flags');
      if (!isWc3StageEnabled()) {
        return res.status(200).json({ ok: true, enabled: false });
      }
      const { id } = req.params;
      if (!validSessionId(id)) return res.status(400).json({ error: 'invalid_session_id' });
      const { getSessionStage } = await import('../services/wc3/stage-intelligence');
      const stage = await getSessionStage(pool, id).catch((err) => {
        console.warn('[wc3-stage] read failed, degrading:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!stage) {
        return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'no_stage' });
      }
      return res.status(200).json({ ok: true, enabled: true, session_id: id, stage });
    } catch (err) { next(err); }
  });

  // GET /api/capadex/session/:id/outcome — WC-3 L2 Outcome Intelligence (Phase B).
  // Read-only per-session OUTCOME MODELS (Career Clarity, Learning Effectiveness,
  // Employability Readiness, Exam Readiness, Confidence Stability, Decision Quality)
  // composed from L1 Stage Intelligence (current/desired/gap) + LIBRARY-BACKED
  // intervention actions only. Emits an honest UNCLASSIFIED state when the
  // behavioural spine is empty. Flag-gated: OFF → `{enabled:false}` (byte-identical
  // legacy). Never recomputes scores, never 500s; an unknown/transient session
  // degrades honestly.
  app.get('/api/capadex/session/:id/outcome', gateSessionEntitlement, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { isWc3OutcomeEnabled } = await import('../config/feature-flags');
      if (!isWc3OutcomeEnabled()) {
        return res.status(200).json({ ok: true, enabled: false });
      }
      const { id } = req.params;
      if (!validSessionId(id)) return res.status(400).json({ error: 'invalid_session_id' });
      const { getSessionOutcomes } = await import('../services/wc3/outcome-intelligence');
      const outcome = await getSessionOutcomes(pool, id).catch((err) => {
        console.warn('[wc3-outcome] read failed, degrading:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!outcome) {
        return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'no_outcome' });
      }
      return res.status(200).json({ ok: true, enabled: true, session_id: id, outcome });
    } catch (err) { next(err); }
  });

  // GET /api/capadex/session/:id/journey — WC-3 L3 Journey Intelligence (Phase C).
  // Read-only per-session ROUTE recommendation (Primary + Secondary route across
  // LBI / Career Builder / Employability Index / Competitive Exam Intelligence /
  // Mentoring) composed from L1 Stage + L2 Outcome: route confidence + band, route
  // reason, expected outcome, expected stage advancement, and product mapping.
  // Business rules surfaced here: a session is NEVER routeless (deterministic
  // Mentoring fallback → degraded:true), and Competitive Exam is always supported
  // even under a CORPUS_PENDING band. Flag-gated: OFF → `{enabled:false}`
  // (byte-identical legacy). Never recomputes scores, never 500s; an unknown session
  // degrades honestly.
  app.get('/api/capadex/session/:id/journey', gateSessionEntitlement, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { isWc3JourneyEnabled } = await import('../config/feature-flags');
      if (!isWc3JourneyEnabled()) {
        return res.status(200).json({ ok: true, enabled: false });
      }
      const { id } = req.params;
      if (!validSessionId(id)) return res.status(400).json({ error: 'invalid_session_id' });
      const { getSessionJourney } = await import('../services/wc3/journey-intelligence');
      const journey = await getSessionJourney(pool, id).catch((err) => {
        console.warn('[wc3-journey] read failed, degrading:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!journey) {
        return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'no_journey' });
      }
      return res.status(200).json({ ok: true, enabled: true, session_id: id, journey });
    } catch (err) { next(err); }
  });

  // GET /api/capadex/question-intelligence/context/metrics — WC-3 L5B Context Intelligence.
  // Read-only metrics over the derived life-CONTEXT sidecar `wc3_question_context`:
  // per-context Coverage, Ambiguity (the legitimately-neutral GENERAL mass + UNRESOLVED),
  // Relevance Risk distribution (LEADERSHIP/DIGITAL noise made visible), confidence Bands,
  // and the Top-N lowest-coverage contexts (authoring backlog). Purely aggregates what the
  // offline builder stored — never derives at request time, never mutates ontology/signals/
  // concerns. Flag-gated: OFF → `{enabled:false}` (byte-identical legacy). Never 500s; if the
  // sidecar has not been built yet it degrades to zeroed metrics.
  app.get('/api/capadex/question-intelligence/context/metrics', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { isWc3ContextIntelEnabled } = await import('../config/feature-flags');
      if (!isWc3ContextIntelEnabled()) {
        return res.status(200).json({ ok: true, enabled: false });
      }
      const topN = Math.min(20, Math.max(1, parseInt(String(req.query.top ?? '10'), 10) || 10));
      const { getContextMetrics } = await import('../services/wc3/question-context-intelligence');
      const metrics = await getContextMetrics(pool, topN).catch((err) => {
        console.warn('[wc3-context] metrics read failed, degrading:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!metrics) {
        return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'no_context_index' });
      }
      return res.status(200).json({ ok: true, enabled: true, metrics });
    } catch (err) { next(err); }
  });

  // GET /api/capadex/session/:id/longitudinal — WC-3 L6 Longitudinal Foundation (Phase A).
  // Read-only RAW snapshot history for the person behind this session. STORAGE +
  // HISTORY ONLY — NO trend/analytics fields are computed. Session-scoped by design:
  // the session UUID is the implicit bearer/ownership token (same anonymity model as
  // /signals, /explain, /guidance, /pipeline), and the payload is PII-safe (never
  // returns user_email/user_id). Flag-gated: OFF → `{enabled:false}` (byte-identical
  // legacy). Never 500s; unknown session → degraded.
  app.get('/api/capadex/session/:id/longitudinal', gateSessionEntitlement, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { isWc3LongitudinalEnabled } = await import('../config/feature-flags');
      if (!isWc3LongitudinalEnabled()) {
        return res.status(200).json({ ok: true, enabled: false });
      }
      const { id } = req.params;
      if (!validSessionId(id)) return res.status(400).json({ error: 'invalid_session_id' });
      const { getLongitudinalHistoryBySession } = await import('../services/wc3/longitudinal-foundation');
      const history = await getLongitudinalHistoryBySession(pool, id).catch((err) => {
        console.warn('[wc3-longitudinal] read failed, degrading:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!history) {
        return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'no_history' });
      }
      return res.status(200).json({ ok: true, enabled: true, ...history });
    } catch (err) { next(err); }
  });

  // ── Phase 8: Knowledge Graph Intelligence Layer (read-only, flag-gated) ─────
  // Unifies every CAPADEX intelligence asset into one typed, provenance-stamped
  // graph (edges ONLY from real linkage rows). All routes are gated by the
  // activation flag: OFF → {enabled:false} (byte-identical legacy). Never 500s.

  // GET /api/capadex/kg/stats — whole-graph summary: counts by type/relation,
  // connected components, orphan (statically-unlinked) assets, top hubs.
  app.get('/api/capadex/kg/stats', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) return res.status(200).json({ ok: true, enabled: false });
      const refresh = req.query.refresh === '1';
      const stats = await kgGetStats(pool, { refresh }).catch((err) => {
        console.warn('[capadex-kg-stats] degraded:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!stats) return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      return res.status(200).json({ ok: true, enabled: true, ...stats });
    } catch (err) { next(err); }
  });

  // (Materialization into pil_kg_nodes/pil_kg_edges is an INTERNAL operation only — exposed
  // via rebuildAndMaterialize() for scripts/jobs, never as a public mutating route,
  // to keep the /kg/* HTTP surface strictly read-only.)

  // GET /api/capadex/kg/node/:nodeId — one node + its provenance-stamped neighbours.
  app.get('/api/capadex/kg/node/:nodeId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) return res.status(200).json({ ok: true, enabled: false });
      const nodeId = String(req.params.nodeId || '').trim();
      if (!nodeId || nodeId.length > 256) return res.status(400).json({ error: 'invalid_node_id' });
      const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
      const detail = await kgGetNodeDetail(pool, nodeId, limit).catch((err) => {
        console.warn('[capadex-kg-node] degraded:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!detail) return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      if (!detail.node) return res.status(404).json({ ok: false, enabled: true, error: 'node_not_found' });
      return res.status(200).json({ ok: true, enabled: true, ...detail });
    } catch (err) { next(err); }
  });

  // GET /api/capadex/kg/path?source=&target= — shortest provenance-traced path.
  app.get('/api/capadex/kg/path', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) return res.status(200).json({ ok: true, enabled: false });
      const source = String(req.query.source || '').trim();
      const target = String(req.query.target || '').trim();
      if (!source || !target || source.length > 256 || target.length > 256) {
        return res.status(400).json({ error: 'source_and_target_required' });
      }
      const result = await kgFindPath(pool, source, target).catch((err) => {
        console.warn('[capadex-kg-path] degraded:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!result) return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      return res.status(200).json({ ok: true, enabled: true, ...result });
    } catch (err) { next(err); }
  });

  // GET /api/capadex/kg/export?anchor=&depth=&format=cytoscape|graphml
  app.get('/api/capadex/kg/export', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) return res.status(200).json({ ok: true, enabled: false });
      const anchor = String(req.query.anchor || '').trim();
      if (!anchor || anchor.length > 256) return res.status(400).json({ error: 'anchor_required' });
      const depth = Math.min(4, Math.max(1, Number(req.query.depth) || 2));
      const format = req.query.format === 'graphml' ? 'graphml' : 'cytoscape';
      const result = await kgExportSubgraph(pool, anchor, depth, format).catch((err) => {
        console.warn('[capadex-kg-export] degraded:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!result) return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      return res.status(200).json({ ok: true, enabled: true, ...result });
    } catch (err) { next(err); }
  });

  // GET /api/capadex/kg/session/:id — session subgraph anchored on the resolved
  // concern (real induced neighbourhood + pipeline lineage). Strict-UUID guarded.
  app.get('/api/capadex/kg/session/:id', gateSessionEntitlement, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) return res.status(200).json({ ok: true, enabled: false });
      const { id } = req.params;
      if (!validSessionId(id)) return res.status(400).json({ error: 'invalid_session_id' });
      // Session subgraph is the lineage-induced instance slice (no k-hop depth).
      const sub = await kgGetSessionSubgraph(pool, id).catch((err) => {
        console.warn('[capadex-kg-session] degraded:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!sub) return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      return res.status(200).json({ ok: true, ...sub });
    } catch (err) { next(err); }
  });

  // GET /api/capadex/session/:id/runtime-summary — Phase 6B Experience Layer.
  // Read-only: all three stakeholder summaries (student/parent/counselor) for one
  // session, composed from the existing guidance bundle + pipeline lineage + the
  // canon strength profile. Flag-gated by the activation flag: OFF → {enabled:false}
  // so the report section hides and behaviour is byte-identical to legacy. Never
  // recomputes, never fabricates, degrades gracefully, never 500s.
  app.get('/api/capadex/session/:id/runtime-summary', gateSessionEntitlement, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) {
        return res.status(200).json({ ok: true, enabled: false });
      }
      const { id } = req.params;
      if (!validSessionId(id)) return res.status(400).json({ error: 'invalid_session_id' });
      const summary = await buildRuntimeSummary(pool, id).catch((err) => {
        console.warn('[capadex-runtime-summary] build failed, degrading:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!summary) {
        return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      }
      return res.status(200).json({ ok: true, ...summary });
    } catch (err) { next(err); }
  });

  // GET /api/capadex/session/:id/stakeholder-summary?stakeholder=student|parent|counselor
  // Read-only: ONE stakeholder summary for one session. Defaults to `student` when
  // the query param is missing/invalid (the gentlest lens). Same flag gate + canon
  // as runtime-summary above; never fabricates, degrades gracefully, never 500s.
  app.get('/api/capadex/session/:id/stakeholder-summary', gateSessionEntitlement, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) {
        return res.status(200).json({ ok: true, enabled: false });
      }
      const { id } = req.params;
      if (!validSessionId(id)) return res.status(400).json({ error: 'invalid_session_id' });
      const q = String(req.query.stakeholder ?? '').toLowerCase();
      const stakeholder = isStakeholderLens(q) ? q : 'student';
      const summary = await buildStakeholderSummary(pool, id, stakeholder).catch((err) => {
        console.warn('[capadex-stakeholder-summary] build failed, degrading:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!summary) {
        return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed', stakeholder });
      }
      return res.status(200).json({ ok: true, enabled: true, session_id: id, ...summary });
    } catch (err) { next(err); }
  });

  // GET /api/capadex/session/:id/runtime-explainability — Phase 6B "Why am I seeing
  // this?" surface. Read-only: the full Response→…→Intervention lineage (pipeline
  // hops) plus each surfaced recommendation paired with its resolved hop chain. Same
  // flag gate + canon; never fabricates, degrades gracefully, never 500s.
  app.get('/api/capadex/session/:id/runtime-explainability', gateSessionEntitlement, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) {
        return res.status(200).json({ ok: true, enabled: false });
      }
      const { id } = req.params;
      if (!validSessionId(id)) return res.status(400).json({ error: 'invalid_session_id' });
      const explain = await buildRuntimeExplainability(pool, id).catch((err) => {
        console.warn('[capadex-runtime-explainability] build failed, degrading:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!explain) {
        return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      }
      return res.status(200).json({ ok: true, ...explain });
    } catch (err) { next(err); }
  });

  // ── Phase 6C: Dynamic Report Intelligence (read-only, flag-gated) ───────────
  // COMPOSES the existing runtime intelligence (6/6A/6B) into structured,
  // fully-explainable, export-ready reports. Same canon: OFF → {enabled:false}
  // (byte-identical legacy), bad uuid → 400, never recompute/fabricate, never 500.

  // GET /api/capadex/session/:id/report?stakeholder=student|parent|counselor&format=json|print|pdf
  // One stakeholder report (sections + per-statement trace + explainability coverage
  // + readiness score + api/print/pdf export shapes). Defaults to `student`.
  app.get('/api/capadex/session/:id/report', gateSessionEntitlement, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) {
        return res.status(200).json({ ok: true, enabled: false });
      }
      const { id } = req.params;
      if (!validSessionId(id)) return res.status(400).json({ error: 'invalid_session_id' });
      const q = String(req.query.stakeholder ?? '').toLowerCase();
      const stakeholder = isStakeholderLens(q) ? q : 'student';
      const report = await buildStakeholderReport(pool, id, stakeholder).catch((err) => {
        console.warn('[capadex-report] build failed, degrading:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!report) {
        return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed', stakeholder });
      }
      const format = String(req.query.format ?? '').toLowerCase();
      if (format === 'print') {
        res.set('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send(report.exports.print_ready);
      }
      if (format === 'pdf') {
        return res.status(200).json({ ok: true, enabled: true, format: 'pdf', blocks: report.exports.pdf_ready });
      }
      // WC-P2 Lever A — additively surface the WC-7B activation envelope (Growth/Mentor/
      // Commercial consumption slots) when the Decision Orchestrator flag is ON. Read-only,
      // never-throws; flag OFF or build error → field omitted → byte-identical legacy payload.
      let activation: unknown = undefined;
      const { isDecisionOrchestratorEnabled } = await import('../config/feature-flags');
      if (isDecisionOrchestratorEnabled()) {
        const { buildActivationEnvelope } = await import('../services/wc7b/decision-orchestrator');
        activation = await buildActivationEnvelope(pool, id).catch((err) => {
          console.warn('[capadex-report] activation compose failed, omitting:', err instanceof Error ? err.message : String(err));
          return undefined;
        }) ?? undefined;
      }
      return res.status(200).json({ ok: true, ...report, ...(activation ? { activation } : {}) });
    } catch (err) { next(err); }
  });

  // GET /api/capadex/session/:id/reports — all three stakeholder reports at once.
  app.get('/api/capadex/session/:id/reports', gateSessionEntitlement, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) {
        return res.status(200).json({ ok: true, enabled: false });
      }
      const { id } = req.params;
      if (!validSessionId(id)) return res.status(400).json({ error: 'invalid_session_id' });
      const reports = await buildAllStakeholderReports(pool, id).catch((err) => {
        console.warn('[capadex-reports] build failed, degrading:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!reports) {
        return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      }
      return res.status(200).json({ ok: true, enabled: true, session_id: id, reports });
    } catch (err) { next(err); }
  });

  // GET /api/capadex/institution/report?sessions=<uuid,uuid,...> — NEW cohort report.
  // Deterministic aggregate (Cohort Strengths/Risks/Archetype Distribution/Intervention
  // Opportunities) across the supplied sessions. Invalid uuids are dropped; an empty
  // cohort degrades gracefully (never throws).
  app.get('/api/capadex/institution/report', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) {
        return res.status(200).json({ ok: true, enabled: false });
      }
      const raw = String(req.query.sessions ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const bad = raw.filter((s) => !validSessionId(s));
      if (bad.length) return res.status(400).json({ error: 'invalid_session_id', invalid: bad });
      const sessionIds = raw;
      const report = await buildInstitutionReport(pool, sessionIds).catch((err) => {
        console.warn('[capadex-institution-report] build failed, degrading:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!report) {
        return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      }
      const format = String(req.query.format ?? '').toLowerCase();
      if (format === 'print') {
        res.set('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send(report.exports.print_ready);
      }
      if (format === 'pdf') {
        return res.status(200).json({ ok: true, enabled: true, format: 'pdf', blocks: report.exports.pdf_ready });
      }
      return res.status(200).json({ ok: true, ...report });
    } catch (err) { next(err); }
  });

  // ── Phase 7: Recommendation Intelligence (read-only, flag-gated) ────────────
  // COMPOSES the existing runtime intelligence (archetypes · interventions · 6C
  // reports · pipeline · capabilities · behaviours) into personalized, fully
  // explainable recommendations across 4 categories (Career / Learning / Project /
  // Development) per stakeholder. NO new scoring/archetypes. Same canon: OFF →
  // {enabled:false} (byte-identical legacy), bad uuid → 400, never recompute/
  // fabricate, never 500. Every rec traces Concern→…→Intervention→Recommendation.

  const isRecStakeholder = (s: string): s is 'student' | 'parent' | 'counselor' | 'institution' =>
    s === 'student' || s === 'parent' || s === 'counselor' || s === 'institution';
  const isRecCategory = (c: string): c is 'career' | 'learning' | 'project' | 'development' =>
    c === 'career' || c === 'learning' || c === 'project' || c === 'development';

  // GET /api/capadex/session/:id/recommendation-intelligence?stakeholder=&category=&format=
  // One stakeholder's recommendations (4 categories, per-rec 8-node trace,
  // explainability coverage, readiness, export shapes). Defaults stakeholder=student.
  // Optional `category` narrows the response to a single category. Best-effort persist.
  // NOTE: distinct path from the legacy RIE `/session/:id/recommendations`
  // ({recommendations, has_escalation}) — Phase 7 is purely additive, never shadows it.
  app.get('/api/capadex/session/:id/recommendation-intelligence', gateSessionEntitlement, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) {
        return res.status(200).json({ ok: true, enabled: false });
      }
      const { id } = req.params;
      if (!validSessionId(id)) return res.status(400).json({ error: 'invalid_session_id' });
      const q = String(req.query.stakeholder ?? '').toLowerCase();
      const stakeholder = isRecStakeholder(q) && q !== 'institution' ? q : 'student';
      const rec = await buildSessionRecommendations(pool, id, stakeholder).catch((err) => {
        console.warn('[capadex-recommendations] build failed, degrading:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!rec) {
        return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed', stakeholder });
      }
      // Best-effort persist (never throws, never blocks the response).
      void persistSessionRecommendations(pool, rec);
      // Optional single-category narrowing.
      const catQ = String(req.query.category ?? '').toLowerCase();
      const payload = isRecCategory(catQ)
        ? { ...rec, categories: rec.categories.filter((c) => c.category === catQ) }
        : rec;
      const format = String(req.query.format ?? '').toLowerCase();
      if (format === 'print') {
        res.set('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send(payload.exports.print_ready);
      }
      if (format === 'pdf') {
        return res.status(200).json({ ok: true, enabled: true, format: 'pdf', blocks: payload.exports.pdf_ready });
      }
      return res.status(200).json({ ok: true, ...payload });
    } catch (err) { next(err); }
  });

  // GET /api/capadex/institution/recommendation-intelligence?sessions=<uuid,uuid,...>&format=
  // Cohort-level recommendations (union of active constructs + lineage across the
  // supplied sessions). Invalid uuids → 400 (strict); an empty cohort degrades.
  app.get('/api/capadex/institution/recommendation-intelligence', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) {
        return res.status(200).json({ ok: true, enabled: false });
      }
      const raw = String(req.query.sessions ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const bad = raw.filter((s) => !validSessionId(s));
      if (bad.length) return res.status(400).json({ error: 'invalid_session_id', invalid: bad });
      const rec = await buildInstitutionRecommendations(pool, raw).catch((err) => {
        console.warn('[capadex-institution-recommendations] build failed, degrading:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!rec) {
        return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      }
      const format = String(req.query.format ?? '').toLowerCase();
      if (format === 'print') {
        res.set('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send(rec.exports.print_ready);
      }
      if (format === 'pdf') {
        return res.status(200).json({ ok: true, enabled: true, format: 'pdf', blocks: rec.exports.pdf_ready });
      }
      return res.status(200).json({ ok: true, ...rec });
    } catch (err) { next(err); }
  });

  // GET /api/capadex/strengths/:scope — evidence-traced strength profile.
  // Scope may be a user email or a session UUID. Read-only, empty-safe; consolidates
  // CSI positive_factors + longitudinal resilience/growth/recurring constructs.
  app.get('/api/capadex/strengths/:scope', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = String(req.params.scope || '').trim();
      if (!scope) return res.status(400).json({ ok: false, error: 'missing_scope' });
      const profile = await discoverStrengths(pool, scope);
      return res.status(200).json({ ok: true, ...profile });
    } catch (err) { next(err); }
  });

  app.get('/api/capadex/session/:id/load', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { rows: [session] } = await pool.query(
        `SELECT * FROM capadex_sessions WHERE id = $1`, [id]
      );
      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.status !== 'in_progress') return res.status(400).json({ error: 'Session is not in_progress' });

      // ── Load answered responses ────────────────────────────────────────
      const { rows: responses } = await pool.query(
        `SELECT item_id, response_value FROM capadex_responses WHERE session_id = $1 ORDER BY created_at`, [id]
      );
      const answeredIds: string[] = responses.map((r: any) => r.item_id);
      const priorAnswers: Record<string, number> = {};
      for (const r of responses) priorAnswers[r.item_id] = r.response_value;

      // ── Fetch answered question data (try both tables) ─────────────────
      let answeredQuestions: any[] = [];
      if (answeredIds.length > 0) {
        const idPlaceholders = answeredIds.map((_: any, i: number) => `$${i + 1}`).join(',');
        // short_assessment_questions
        const { rows: saqAnswered } = await pool.query(`
          SELECT q.id::text AS id, q.question_code AS item_code, q.dimension AS subdomain_code,
                 q.question_text AS question, q.weight, q.polarity, q.age_band, q.focus_area,
                 q.layer AS layer_tag, q.is_anchor AS anchor, null AS domain,
                 q.dimension AS sub_domain_name, q.dimension AS dimension, q.logic,
                 null AS response_range,
                 null AS opt_a, null AS opt_b, null AS opt_c, null AS opt_d, null AS opt_e,
                 COALESCE(q.question_type,'likert') AS question_type,
                 COALESCE(q.options,'[]'::jsonb)::json AS options
          FROM short_assessment_questions q WHERE q.id::text IN (${idPlaceholders})
        `, answeredIds).catch(() => ({ rows: [] }));
        // sdi_items
        const { rows: sdiAnswered } = await pool.query(`
          SELECT i.id, i.item_code, i.subdomain_code, i.question, i.weight, i.polarity,
                 i.age_band, i.focus_area, i.layer_tag, i.anchor, i.domain, i.sub_domain_name,
                 i.dimension, i.logic, i.response_range,
                 i.opt_a, i.opt_b, i.opt_c, i.opt_d, i.opt_e,
                 COALESCE(i.item_type,'likert') AS question_type,
                 '[]'::json AS options
          FROM sdi_items i WHERE i.id::text IN (${idPlaceholders})
        `, answeredIds).catch(() => ({ rows: [] }));
        const byId: Record<string, any> = {};
        for (const q of [...saqAnswered, ...sdiAnswered]) byId[String(q.id)] = q;
        // Preserve original response order
        answeredQuestions = answeredIds.map((aid: string) => byId[aid]).filter(Boolean);
      }

      // ── Fetch remaining unanswered questions ───────────────────────────
      const remaining = Math.max(0, (session.total_items || 10) - answeredIds.length);
      let freshQuestions: any[] = [];
      if (remaining > 0) {
        const stageData = STAGES[session.stage_index] || STAGES[0];
        const excludeClause = answeredIds.length > 0
          ? `AND q.id::text NOT IN (${answeredIds.map((_: any, i: number) => `$${i + 3}`).join(',')})`
          : '';
        const saqParams = [session.concern_name, stageData.label, ...answeredIds];
        const { rows: saqFresh } = await pool.query(`
          SELECT q.id::text AS id, q.question_code AS item_code, q.dimension AS subdomain_code,
                 q.question_text AS question, q.weight, q.polarity, q.age_band, q.focus_area,
                 q.layer AS layer_tag, q.is_anchor AS anchor, null AS domain,
                 q.dimension AS sub_domain_name, q.dimension AS dimension, q.logic,
                 null AS response_range,
                 null AS opt_a, null AS opt_b, null AS opt_c, null AS opt_d, null AS opt_e,
                 COALESCE(q.question_type,'likert') AS question_type,
                 COALESCE(q.options,'[]'::jsonb)::json AS options
          FROM short_assessment_questions q
          JOIN concern_areas ca ON ca.id = q.concern_area_id
          WHERE LOWER(ca.concern_area) = LOWER($1) AND q.stage = $2 AND q.is_active = true
            ${excludeClause}
          ORDER BY q.is_anchor DESC NULLS LAST, (q.weight::numeric) DESC, random()
          LIMIT $3
        `, [...saqParams.slice(0, 2), remaining, ...answeredIds]).catch(() => ({ rows: [] }));

        if (saqFresh.length < remaining) {
          const sdiExclude = answeredIds.length > 0
            ? `AND i.id::text NOT IN (${answeredIds.map((_: any, i: number) => `$${i + 2}`).join(',')})`
            : '';
          const { rows: sdiFresh } = await pool.query(`
            SELECT i.id, i.item_code, i.subdomain_code, i.question, i.weight, i.polarity,
                   i.age_band, i.focus_area, i.layer_tag, i.anchor, i.domain, i.sub_domain_name,
                   i.dimension, i.logic, i.response_range,
                   i.opt_a, i.opt_b, i.opt_c, i.opt_d, i.opt_e,
                   COALESCE(i.item_type,'likert') AS question_type,
                   '[]'::json AS options
            FROM sdi_items i
            WHERE LOWER(i.concern_name) = LOWER($1) AND i.stage_code = '${stageData.code}'
              ${sdiExclude}
            ORDER BY i.anchor DESC, i.weight DESC, random()
            LIMIT ${remaining}
          `, [session.concern_name, ...answeredIds]).catch(() => ({ rows: [] }));
          freshQuestions = [...saqFresh, ...sdiFresh].slice(0, remaining);
        } else {
          freshQuestions = saqFresh;
        }
      }

      const stageInfo = STAGES[session.stage_index] || STAGES[0];
      res.json({
        session_id:     session.id,
        concern_name:   session.concern_name,
        stage_code:     stageInfo.code,
        stage_label:    stageInfo.label,
        stage_color:    stageInfo.color,
        stage_index:    session.stage_index,
        answered_items: answeredIds.length,
        total_items:    session.total_items,
        questions:      [...answeredQuestions, ...freshQuestions],
        prior_answers:  priorAnswers,
      });
    } catch (err) { next(err); }
  });

  // ── POST /api/capadex/auth/login ─────────────────────────────────────
  app.post('/api/capadex/auth/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
      const normEmail = email.trim().toLowerCase();

      const userRow = await pool.query(
        `SELECT id, name, email, phone, password_hash, email_verified FROM capadex_users WHERE LOWER(email)=$1`,
        [normEmail]
      );
      if (userRow.rows.length === 0) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
      const user = userRow.rows[0];

      const valid = await comparePassword(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

      res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, phone: user.phone } });
    } catch (err) { next(err); }
  });

  // ── GET /api/capadex/report/:session_id ──────────────────────────────
  app.get('/api/capadex/report/:session_id', gateReportEntitlement, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { session_id } = req.params;
      const { email, tenant_id: qTenant } = req.query as { email: string; tenant_id?: string };
      const reportTenantId = (String(qTenant ?? req.headers['x-tenant-id'] ?? '')).trim() || undefined;

      // Get session (score_level and insight are not stored — computed below)
      const sessionRow = await pool.query(
        `SELECT s.id, s.concern_name, s.stage_code, s.stage_index, s.score, s.guest_name, s.user_age
         FROM capadex_sessions s WHERE s.id=$1 AND s.status='completed'`,
        [session_id]
      );
      if (sessionRow.rows.length === 0) return res.status(404).json({ error: 'Session not found or not completed' });
      const session = sessionRow.rows[0];

      // Compute score_level and insight from stored score + stage
      const { label: scoreLevel } = getScoreLevel(Number(session.score) || 0);
      const stageData  = STAGES[session.stage_index] || STAGES[0];
      const insight    = generateStageInsight(stageData.label, Number(session.score) || 0, session.concern_name);

      // Get subdomains summary — join both sdi_items (UUID) and short_assessment_questions (integer)
      const subRows = await pool.query(
        `SELECT
          COALESCE(si.subdomain_code, saq.dimension) AS subdomain_code,
          COALESCE(MAX(ss.subdomain_name), MAX(saq.dimension), MAX(si.subdomain_code)) AS subdomain_name,
          ROUND(AVG(r.raw_score)::numeric, 1) AS avg_score,
          COUNT(*)::int AS item_count
         FROM capadex_responses r
         LEFT JOIN sdi_items si
           ON si.id = r.item_id
           AND r.item_id::text !~ '^[0-9]+$'
         LEFT JOIN short_assessment_questions saq
           ON saq.id::text = r.item_id::text
           AND r.item_id::text ~ '^[0-9]+$'
         LEFT JOIN sdi_subdomains ss
           ON ss.subdomain_code = COALESCE(si.subdomain_code, saq.dimension)
         WHERE r.session_id=$1::uuid
           AND COALESCE(si.subdomain_code, saq.dimension) IS NOT NULL
         GROUP BY COALESCE(si.subdomain_code, saq.dimension)
         ORDER BY 2`,
        [session_id]
      );

      const subdomains = subRows.rows;

      // Upsert report record in DB
      const normEmail = email ? email.trim().toLowerCase() : null;
      const userRow = normEmail
        ? await pool.query(`SELECT id FROM capadex_users WHERE LOWER(email)=$1`, [normEmail])
        : { rows: [] };
      const userId = userRow.rows[0]?.id || null;

      const existingReport = await pool.query(
        `SELECT id FROM capadex_reports WHERE session_id=$1 LIMIT 1`,
        [session_id]
      );

      let reportId: string;
      if (existingReport.rows.length > 0) {
        reportId = existingReport.rows[0].id;
        await pool.query(
          `UPDATE capadex_reports SET user_id=COALESCE($1,user_id), subdomains=$2, updated_at=now()
           WHERE id=$3`,
          [userId, JSON.stringify(subdomains), reportId]
        );
      } else {
        const ins = await pool.query(
          `INSERT INTO capadex_reports
             (user_id, session_id, concern_name, stage_code, score, score_level, insight, participant_name, participant_age, subdomains, report_data)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
          [
            userId, session_id, session.concern_name, session.stage_code,
            session.score, scoreLevel, insight,
            session.guest_name, session.user_age,
            JSON.stringify(subdomains), JSON.stringify({ generatedAt: new Date().toISOString() })
          ]
        );
        reportId = ins.rows[0].id;
      }

      // Read back admin overrides — only active when review_status = 'published'
      const overrideRow = await pool.query(
        `SELECT score_override, headline_override, narrative_override, override_reason,
                review_status, reviewed_by, reviewed_at, published_at
         FROM capadex_reports WHERE id=$1`,
        [reportId]
      );
      const {
        score_override, headline_override, narrative_override, override_reason,
        review_status, reviewed_by, reviewed_at, published_at,
      } = overrideRow.rows[0] || {};

      const isPublished   = review_status === 'published';
      const rawScore      = Number(session.score) || 0;
      const effectiveScore = (isPublished && score_override != null) ? Number(score_override) : rawScore;
      const { label: effectiveLevel } = getScoreLevel(effectiveScore);
      const effectiveInsight = (isPublished && narrative_override)
        ? String(narrative_override)
        : generateStageInsight(stageData.label, effectiveScore, session.concern_name);

      // ── BIOS behavioural synthesis (best-effort; absent rows → null envelopes) ──
      // The signal pipeline may not have produced rows for this session (telemetry
      // blocked, tracking failed, or pipeline idle). Every query is wrapped so the
      // report NEVER 500s on missing behavioural data — explicit metrics always ship.
      let behavioral_signals: ReturnType<typeof buildBehaviouralEnvelope> = null;
      let linguistic_context: {
        absolutism_score: number; intensity_score: number; certainty_score: number;
        has_linguistic: boolean;
      } | null = null;
      let behavioral_archetype: ReturnType<typeof synthesizeArchetype> = null;
      try {
        const profRow = await pool.query(
          `SELECT emotional_load, cognitive_load, engagement_score, volatility_score
           FROM capadex_signal_profiles WHERE session_id=$1 LIMIT 1`,
          [session_id]
        );
        const lingRow = await pool.query(
          `SELECT absolutism_score, intensity_score, certainty_score
           FROM capadex_linguistic_signals WHERE session_id=$1
           ORDER BY detected_at DESC LIMIT 1`,
          [session_id]
        );
        const rapidRow = await pool.query(
          `SELECT 1 FROM capadex_session_signals
           WHERE session_id=$1 AND signal_key='rapid_answer_pattern' LIMIT 1`,
          [session_id]
        );

        if (profRow.rows.length > 0) {
          const pr = profRow.rows[0];
          const lr = lingRow.rows[0] || {};
          const sigInput: BehaviouralSignalInput = {
            emotionalLoad:   Number(pr.emotional_load)   || 0,
            cognitiveLoad:   Number(pr.cognitive_load)   || 0,
            engagementScore: Number(pr.engagement_score) || 0,
            volatilityScore: Number(pr.volatility_score) || 0,
            rapidAnswer:     rapidRow.rows.length > 0,
            absolutismScore: Number(lr.absolutism_score) || 0,
          };
          behavioral_signals  = buildBehaviouralEnvelope(sigInput);
          behavioral_archetype = synthesizeArchetype(effectiveScore, sigInput);
        }
        if (lingRow.rows.length > 0) {
          const lr = lingRow.rows[0];
          linguistic_context = {
            absolutism_score: Number(lr.absolutism_score) || 0,
            intensity_score:  Number(lr.intensity_score)  || 0,
            certainty_score:  Number(lr.certainty_score)  || 0,
            has_linguistic:   true,
          };
        }
      } catch (sigErr: any) {
        console.warn('[capadex/report] behavioural synthesis skipped:', sigErr?.message || sigErr);
      }

      res.json({
        reportId,
        concernName: session.concern_name,
        stageCode: session.stage_code,
        stageLabel: stageData.label,
        score: effectiveScore,
        rawScore,
        scoreLevel: effectiveLevel,
        insight: effectiveInsight,
        // Override fields — only populated when published so frontend knows to render indicators
        scoreOverride:     isPublished && score_override != null ? Number(score_override) : null,
        headlineOverride:  isPublished ? (headline_override  || null) : null,
        narrativeOverride: isPublished ? (narrative_override || null) : null,
        overrideReason:    isPublished ? (override_reason    || null) : null,
        reviewStatus:      review_status || 'pending',
        reviewedBy:        reviewed_by  || null,
        reviewedAt:        reviewed_at  || null,
        publishedAt:       published_at || null,
        participantName: session.guest_name,
        participantAge: session.user_age,
        subdomains,
        generatedAt: new Date().toISOString(),
        // Dynamic reporting gate — tells the client whether narrative enhancement is active (per-tenant)
        dynamic_reporting_enabled: isEnabled('dynamic_reporting', reportTenantId),
        // BIOS behavioural intelligence — null when no signal profile exists for this session
        behavioral_signals,
        linguistic_context,
        behavioral_archetype,
      });
    } catch (err) { next(err); }
  });

  // ── GET /api/capadex/report/:session_id/pdf ──────────────────────────
  app.get('/api/capadex/report/:session_id/pdf', gateReportEntitlement, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { session_id } = req.params;

      const sessionRow = await pool.query(
        `SELECT s.id, s.concern_name, s.stage_code, s.stage_index, s.score, s.guest_name, s.user_age
         FROM capadex_sessions s WHERE s.id=$1 AND s.status='completed'`,
        [session_id]
      );
      if (sessionRow.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
      const session = sessionRow.rows[0];

      const { label: scoreLevel } = getScoreLevel(Number(session.score) || 0);
      const stageData = STAGES[session.stage_index] || STAGES[0];
      const insight   = generateStageInsight(stageData.label, Number(session.score) || 0, session.concern_name);
      const score     = Number(session.score) || 0;

      const subRows = await pool.query(
        `SELECT
           COALESCE(si.subdomain_code, saq.dimension)           AS subdomain_code,
           COALESCE(MAX(ss.subdomain_name), MAX(saq.dimension), MAX(si.subdomain_code)) AS subdomain_name,
           ROUND(AVG(r.raw_score)::numeric, 1)                  AS avg_score,
           COUNT(*)::int                                         AS item_count
         FROM capadex_responses r
         LEFT JOIN sdi_items si        ON si.id = r.item_id  AND r.item_id::text !~ '^[0-9]+$'
         LEFT JOIN short_assessment_questions saq ON saq.id::text = r.item_id::text AND r.item_id::text ~ '^[0-9]+$'
         LEFT JOIN sdi_subdomains ss   ON ss.subdomain_code = COALESCE(si.subdomain_code, saq.dimension)
         WHERE r.session_id=$1::uuid
           AND COALESCE(si.subdomain_code, saq.dimension) IS NOT NULL
         GROUP BY COALESCE(si.subdomain_code, saq.dimension)
         ORDER BY 2`,
        [session_id]
      );
      const subdomains: Array<{ subdomain_name: string; avg_score: string }> = subRows.rows;

      const overrideRow = await pool.query(
        `SELECT score_override, headline_override, narrative_override, review_status
         FROM capadex_reports WHERE session_id=$1 LIMIT 1`,
        [session_id]
      );
      const ovr = overrideRow.rows[0];
      const isPublished    = ovr?.review_status === 'published';
      const effectiveScore = (isPublished && ovr?.score_override != null) ? Number(ovr.score_override) : score;
      const { label: effectiveLevel } = getScoreLevel(effectiveScore);
      const effectiveInsight = (isPublished && ovr?.narrative_override) ? String(ovr.narrative_override) : insight;

      // ── Build PDF with pdfkit ──────────────────────────────────────────
      const PDFDocument = (await import('pdfkit')).default;
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      await new Promise<void>((resolve, reject) => {
        doc.on('end', resolve);
        doc.on('error', reject);

        const W     = 595 - 100;  // usable width
        const TEAL  = '#1B4F72';
        const BLUE  = '#2563EB';
        const GREEN = '#059669';
        const GRAY  = '#6B7280';
        const LIGHT = '#F3F4F6';

        // ── Header bar ──
        doc.rect(0, 0, 595, 60).fill(TEAL);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18)
           .text('MetryxOne', 50, 18);
        doc.font('Helvetica').fontSize(10).fillColor('#CBD5E1')
           .text('Behavioural Intelligence Report', 50, 40);
        doc.fillColor('#ffffff').fontSize(10)
           .text(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), 50, 40, { align: 'right', width: W });

        // ── Participant row ──
        doc.moveDown(0.5);
        let y = 80;
        doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(20)
           .text(String(session.guest_name || 'Participant'), 50, y);
        y += 26;
        doc.font('Helvetica').fontSize(11).fillColor(GRAY)
           .text(`Age ${session.user_age || '—'} · Assessment: ${session.concern_name}`, 50, y);
        y += 16;
        doc.moveTo(50, y).lineTo(545, y).strokeColor('#E5E7EB').stroke();
        y += 14;

        // ── Stage badge ──
        const badgeTxt = `Stage: ${stageData.label}`;
        doc.roundedRect(50, y, 130, 22, 5).fill(BLUE);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10)
           .text(badgeTxt, 50, y + 6, { width: 130, align: 'center' });

        // ── Score circle (text) ──
        const scoreColor = effectiveScore >= 70 ? GREEN : effectiveScore >= 40 ? BLUE : '#DC2626';
        doc.fillColor(scoreColor).font('Helvetica-Bold').fontSize(52)
           .text(String(Math.round(effectiveScore)), 420, y - 4, { width: 80, align: 'center' });
        doc.fillColor(GRAY).font('Helvetica').fontSize(9)
           .text('/ 100', 420, y + 46, { width: 80, align: 'center' });
        doc.fillColor(scoreColor).font('Helvetica-Bold').fontSize(11)
           .text(effectiveLevel, 380, y + 60, { width: 160, align: 'center' });
        y += 34;

        // ── Insight box ──
        doc.roundedRect(50, y, W, 2).fill('#E2E8F0');
        y += 10;
        doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(11).text('Behavioural Insight', 50, y);
        y += 16;
        doc.fillColor('#374151').font('Helvetica').fontSize(10)
           .text(effectiveInsight, 50, y, { width: W, lineGap: 3 });
        y = doc.y + 14;

        // ── Subdomain scores ──
        if (subdomains.length > 0) {
          doc.roundedRect(50, y, W, 2).fill('#E2E8F0');
          y += 10;
          doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(11)
             .text('Dimension Scores', 50, y);
          y += 18;

          const barW = W - 140;
          for (const sd of subdomains) {
            const pct   = Math.min(Math.max(Number(sd.avg_score) || 0, 0), 100);
            const color = pct >= 70 ? GREEN : pct >= 40 ? BLUE : '#DC2626';

            doc.fillColor('#374151').font('Helvetica').fontSize(9)
               .text(sd.subdomain_name || (sd as any).subdomain_code || '—', 50, y, { width: 130, ellipsis: true });
            doc.roundedRect(185, y + 1, barW, 10, 3).fill(LIGHT);
            if (pct > 0) doc.roundedRect(185, y + 1, (barW * pct) / 100, 10, 3).fill(color);
            doc.fillColor(color).font('Helvetica-Bold').fontSize(9)
               .text(Math.round(pct).toString(), 185 + barW + 6, y);
            y += 18;
            if (y > 760) { doc.addPage(); y = 50; }
          }
        }

        // ── Review badge ──
        if (isPublished) {
          y += 6;
          doc.roundedRect(50, y, 160, 22, 5).fill('#D1FAE5');
          doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(9)
             .text('✓ Expert Reviewed & Published', 50, y + 7, { width: 160, align: 'center' });
          y += 30;
        }

        // ── Footer ──
        doc.moveTo(50, 820).lineTo(545, 820).strokeColor('#E5E7EB').stroke();
        doc.fillColor(GRAY).font('Helvetica').fontSize(8)
           .text('Generated by MetryxOne Behavioural Intelligence Platform · metryx.one', 50, 826, { align: 'center', width: W });

        doc.end();
      });

      const pdfBuffer = Buffer.concat(chunks);
      const safeName = String(session.concern_name || 'Report').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="MetryxOne_${safeName}_Report.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.send(pdfBuffer);
    } catch (err) { next(err); }
  });

  // ── GET /api/capadex/runtime-features ─────────────────────────────────
  // Reports which Phase 1 features are currently enabled (incl. websocket_runtime).
  // Used by client to configure the session UX based on live flag state.
  app.get('/api/capadex/runtime-features', (req: Request, res: Response) => {
    // Accept tenant_id via query-param or header so client can get its tenant-specific flag state
    const tenantId = (String(req.query.tenant_id ?? req.headers['x-tenant-id'] ?? '')).trim() || undefined;
    res.json({
      adaptive_questioning:    isEnabled('adaptive_questioning',    tenantId),
      contradiction_detection: isEnabled('contradiction_detection', tenantId),
      signal_intelligence:     isEnabled('signal_intelligence',     tenantId),
      dynamic_reporting:       isEnabled('dynamic_reporting',       tenantId),
      interventions:           isEnabled('interventions',           tenantId),
      longitudinal_memory:     isEnabled('longitudinal_memory',     tenantId),
      cognitive_load_engine:   isEnabled('cognitive_load_engine',   tenantId),
      hypothesis_engine:       isEnabled('hypothesis_engine',       tenantId),
      confidence_engine:       isEnabled('confidence_engine',       tenantId),
      websocket_runtime:       isEnabled('websocket_runtime',       tenantId),
    });
  });

  // ── GET /api/capadex/ws-info ───────────────────────────────────────────
  // WebSocket runtime execution gate — gated by `websocket_runtime` flag.
  // Returns 503 when disabled (safe default). When enabled, returns the WS
  // endpoint descriptor for the client to initiate an upgrade.
  // This is the execution-path gate for the websocket_runtime Phase 1 flag.
  app.get('/api/capadex/ws-info', (req: Request, res: Response) => {
    const tenantId = (String(req.query.tenant_id ?? req.headers['x-tenant-id'] ?? '')).trim() || undefined;
    if (!isEnabled('websocket_runtime', tenantId)) {
      return res.status(503).json({
        available: false,
        reason:    'websocket_runtime flag disabled — real-time sync is not active for this tenant',
      });
    }
    return res.json({
      available: true,
      endpoint:  '/api/capadex/ws',
      protocol:  'capadex-v1',
    });
  });

  // ── POST /api/capadex/report/:session_id/send-email ──────────────────
  app.post('/api/capadex/report/:session_id/send-email', gateReportEntitlement, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session_id = String(req.params.session_id);
      const { email, name, pdfBase64 } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required' });

      const reportRow = await pool.query(
        `SELECT r.id, r.concern_name, r.stage_code, r.score, r.score_level, r.insight,
                r.subdomains, r.dynamic_report, r.report_data,
                r.score_override, r.review_status
         FROM capadex_reports r WHERE r.session_id=$1 LIMIT 1`,
        [session_id]
      );
      if (reportRow.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
      const report = reportRow.rows[0];

      // Map stage_code to a human-readable name and stage-appropriate recommendation domains
      const STAGE_META: Record<string, { label: string; domains: string[]; subtitle: string }> = {
        CAP_CUR: {
          label: 'Curiosity',
          domains: ['learning', 'engagement', 'behavioural', 'emotional'],
          subtitle: 'Foundation steps to start shifting the pattern',
        },
        CAP_INS: {
          label: 'Insight',
          domains: ['emotional', 'behavioural', 'resilience', 'learning', 'engagement'],
          subtitle: 'Root-cause strategies tailored to your trigger profile',
        },
        CAP_GRW: {
          label: 'Growth',
          domains: ['resilience', 'recovery', 'engagement', 'leadership', 'behavioural'],
          subtitle: 'Actionable development moves to accelerate your trajectory',
        },
        CAP_MAS: {
          label: 'Mastery',
          domains: ['leadership', 'employability', 'resilience', 'recovery'],
          subtitle: 'Advanced optimisation for sustained high performance',
        },
      };
      const stageMeta = STAGE_META[report.stage_code] || STAGE_META['CAP_CUR'];

      // Fetch top 3 stage-appropriate RIE recommendations for the session's user
      let recommendations: Array<{ title: string; expected_outcome?: string; rec_type?: string; domain?: string }> = [];
      let emailSendTenantId: string | undefined;
      try {
        const { rows: sessionRows } = await pool.query(
          `SELECT guest_email FROM capadex_sessions WHERE id=$1 AND status='completed' LIMIT 1`,
          [session_id]
        );
        const sessionEmail = sessionRows[0]?.guest_email;
        emailSendTenantId = undefined; // tenant_id not yet on capadex_sessions
        if (sessionEmail) {
          // Primary: stage-specific domains. Fallback: all safe domains if fewer than 3 results.
          const ALL_SAFE = ['learning', 'behavioural', 'engagement', 'emotional', 'resilience', 'employability', 'leadership', 'recovery'];
          const { rows: recs } = await pool.query(
            `SELECT title, expected_outcome, rec_type, domain
             FROM rie_recommendations
             WHERE user_email = $1
               AND domain = ANY($2::text[])
             ORDER BY
               (domain = ANY($3::text[]))::int DESC,
               priority ASC,
               created_at DESC
             LIMIT 3`,
            [sessionEmail, ALL_SAFE, stageMeta.domains]
          );
          recommendations = recs;
        }
      } catch (recErr: any) {
        console.warn('[send-email] Failed to fetch recommendations for email report:', recErr?.message || recErr);
      }

      const appBase = process.env.APP_URL ||
        (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'https://metryx.one');
      const reportUrl = `${appBase}/?session=${encodeURIComponent(session_id)}&tab=report`;

      // Inject dynamic report content when the flag is enabled and data is present.
      // Use session-derived tenantId so tenant-specific flag overrides are respected.
      const dynamicReportData = (isEnabled('dynamic_reporting', emailSendTenantId) && report.dynamic_report)
        ? report.dynamic_report
        : undefined;

      // OMEGA-X intelligence + run telemetry — best-effort; absent data hides sections.
      const { omega, telemetry } = await buildOmegaEmailExtras(pool, session_id);

      // Provenance signals (mirrors SuperAdmin reports console). Pacing falls
      // back to a placeholder until persisted per-report.
      const provMeta = (report.report_data || report.dynamic_report || {}) as Record<string, unknown>;
      const claritySource = (provMeta.clarity_source as string) || 'master_curated';
      const contradictionCount = Number(provMeta.contradiction_count) || 0;
      const pacingMs = Number(provMeta.telemetry_pacing_ms) || 1420;

      // BIOS behavioural archetype for the email body — best-effort, omitted when absent.
      let emailArchetype: ReturnType<typeof synthesizeArchetype> = null;
      try {
        const profRow = await pool.query(
          `SELECT emotional_load, cognitive_load, engagement_score, volatility_score
           FROM capadex_signal_profiles WHERE session_id=$1 LIMIT 1`,
          [session_id]
        );
        if (profRow.rows.length > 0) {
          const rapidRow = await pool.query(
            `SELECT 1 FROM capadex_session_signals
             WHERE session_id=$1 AND signal_key='rapid_answer_pattern' LIMIT 1`,
            [session_id]
          );
          const pr = profRow.rows[0];
          // Override-aware effective score — mirrors GET /report effectiveScore path.
          const emailEffScore = (report.review_status === 'published' && report.score_override != null)
            ? Number(report.score_override)
            : Number(report.score);
          emailArchetype = synthesizeArchetype(Math.round(emailEffScore), {
            emotionalLoad:   Number(pr.emotional_load)   || 0,
            cognitiveLoad:   Number(pr.cognitive_load)   || 0,
            engagementScore: Number(pr.engagement_score) || 0,
            volatilityScore: Number(pr.volatility_score) || 0,
            rapidAnswer:     rapidRow.rows.length > 0,
            absolutismScore: 0,
          });
        }
      } catch (sigErr: any) {
        console.warn('[send-email] behavioural archetype skipped:', sigErr?.message || sigErr);
      }

      const sent = await sendCapadexReport(email.trim(), name || 'User', {
        concernName: report.concern_name,
        stageLabel: stageMeta.label,
        stageCode: report.stage_code,
        actionPlanSubtitle: stageMeta.subtitle,
        score: Math.round(report.score),
        scoreLevel: normLevel(report.score_level),
        insight: report.insight,
        subdomains: Array.isArray(report.subdomains) ? report.subdomains : [],
        reportId: report.id,
        reportUrl,
        recommendations,
        dynamic_report: dynamicReportData,
        omega,
        telemetry,
        claritySource,
        contradictionCount,
        pacingMs,
        behavioralArchetype: emailArchetype
          ? { label: emailArchetype.label, summary: emailArchetype.summary, tone: emailArchetype.tone }
          : null,
      }, pdfBase64 || undefined);

      if (sent) {
        await pool.query(`UPDATE capadex_reports SET email_sent=true WHERE id=$1`, [report.id]);
      }

      res.json({ ok: sent });
    } catch (err) { next(err); }
  });

  // ── GET /api/admin/capadex/reports ───────────────────────────────────
  app.get('/api/admin/capadex/reports', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, concern, stage, level, reviewed, limit = '100', offset = '0' } = req.query as Record<string, string>;
      const conditions: string[] = [];
      const params: unknown[] = [];
      let p = 1;

      if (search) {
        conditions.push(`(r.participant_name ILIKE $${p} OR u.email ILIKE $${p} OR r.concern_name ILIKE $${p})`);
        params.push(`%${search}%`); p++;
      }
      if (concern) { conditions.push(`r.concern_name = $${p}`); params.push(concern); p++; }
      if (stage)   { conditions.push(`r.stage_code = $${p}`); params.push(stage); p++; }
      if (level === 'Advanced' || level === 'Mastery') {
        // 'Mastery' (legacy) and 'Advanced' (current) are the same top tier.
        conditions.push(`r.score_level IN ('Advanced','Mastery')`);
      } else if (level) { conditions.push(`r.score_level = $${p}`); params.push(level); p++; }
      if (reviewed === 'yes') { conditions.push(`r.reviewed_at IS NOT NULL`); }
      if (reviewed === 'no')  { conditions.push(`r.reviewed_at IS NULL`); }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRow = await pool.query(
        `SELECT COUNT(*) FROM capadex_reports r LEFT JOIN capadex_users u ON u.id = r.user_id ${where}`,
        params
      );
      const rows = await pool.query(
        `SELECT r.id, r.participant_name, r.participant_age, r.concern_name, r.stage_code,
                r.score, r.score_override, r.headline_override, r.narrative_override,
                r.override_reason, r.review_status, r.score_level, r.insight,
                r.admin_notes, r.reviewed_by, r.reviewed_at, r.published_at,
                r.email_sent, r.created_at, r.updated_at,
                u.email, u.phone,
                (SELECT COUNT(*) FROM capadex_sessions cs WHERE cs.guest_email = u.email) AS total_sessions
         FROM capadex_reports r
         LEFT JOIN capadex_users u ON u.id = r.user_id
         ${where}
         ORDER BY r.created_at DESC
         LIMIT $${p} OFFSET $${p+1}`,
        [...params, parseInt(limit), parseInt(offset)]
      );

      // Aggregate stats
      const stats = await pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE score_level IN ('Mastery','Advanced'))  AS mastery,
          COUNT(*) FILTER (WHERE score_level = 'Proficient')           AS proficient,
          COUNT(*) FILTER (WHERE score_level = 'Developing')           AS developing,
          COUNT(*) FILTER (WHERE score_level = 'Emerging')             AS emerging,
          COUNT(*) FILTER (WHERE review_status = 'pending')      AS status_pending,
          COUNT(*) FILTER (WHERE review_status = 'in_review')    AS status_in_review,
          COUNT(*) FILTER (WHERE review_status = 'approved')     AS status_approved,
          COUNT(*) FILTER (WHERE review_status = 'published')    AS status_published,
          COUNT(*) FILTER (WHERE score_override IS NOT NULL)     AS overridden,
          COUNT(*) FILTER (WHERE email_sent = true)              AS emailed,
          ROUND(AVG(score)::numeric, 1) AS avg_score
        FROM capadex_reports
      `);

      // Telemetry / provenance enrichment for the SuperAdmin reports console.
      // These metrics are not yet persisted per-report; values are derived from
      // report_data/dynamic_report jsonb when present, else fall back to clean
      // reference scales so the console always renders. Also exposes blueprint
      // field aliases (user_name / concern_area / macro_score) additively.
      const enriched = rows.rows.map((r: Record<string, unknown>) => {
        const meta = (r.report_data || r.dynamic_report || {}) as Record<string, unknown>;
        const clarity_source =
          (r.clarity_source as string) || (meta.clarity_source as string) || 'master_curated';
        const contradiction_count =
          (r.contradiction_count as number) ?? (meta.contradiction_count as number) ?? 0;
        const telemetry_pacing_ms =
          (r.telemetry_pacing_ms as number) || (meta.telemetry_pacing_ms as number) || 1420;
        return {
          ...r,
          clarity_source,
          contradiction_count,
          telemetry_pacing_ms,
          user_name: r.participant_name,
          concern_area: r.concern_name,
          macro_score: r.score,
        };
      });

      res.json({ total: parseInt(countRow.rows[0].count), rows: enriched, stats: stats.rows[0] });
    } catch (err) { next(err); }
  });

  // ── GET /api/admin/capadex/reports/:id ───────────────────────────────
  app.get('/api/admin/capadex/reports/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const row = await pool.query(
        `SELECT r.*, u.email, u.phone,
                s.answered_items, s.total_items, s.created_at AS session_started
         FROM capadex_reports r
         LEFT JOIN capadex_users u ON u.id = r.user_id
         LEFT JOIN capadex_sessions s ON s.id = r.session_id
         WHERE r.id = $1`,
        [id]
      );
      if (row.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json(row.rows[0]);
    } catch (err) { next(err); }
  });

  // ── PATCH /api/admin/capadex/reports/:id ─────────────────────────────
  app.patch('/api/admin/capadex/reports/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const {
        admin_notes, score_override, headline_override, narrative_override,
        override_reason, review_status, reviewed_by,
      } = req.body;

      const fields: string[] = [];
      const vals: unknown[] = [];
      let p = 1;

      if (admin_notes        !== undefined) { fields.push(`admin_notes=$${p++}`);        vals.push(admin_notes || null); }
      if (score_override     !== undefined) { fields.push(`score_override=$${p++}`);     vals.push(score_override !== '' && score_override != null ? Number(score_override) : null); }
      if (headline_override  !== undefined) { fields.push(`headline_override=$${p++}`);  vals.push(headline_override || null); }
      if (narrative_override !== undefined) { fields.push(`narrative_override=$${p++}`); vals.push(narrative_override || null); }
      if (override_reason    !== undefined) { fields.push(`override_reason=$${p++}`);    vals.push(override_reason || null); }

      if (review_status !== undefined) {
        fields.push(`review_status=$${p++}`); vals.push(review_status);
        // Set reviewed_by + reviewed_at on first review action
        if (['in_review', 'approved', 'published'].includes(review_status) && reviewed_by) {
          fields.push(`reviewed_by=$${p++}`); vals.push(reviewed_by);
          fields.push(`reviewed_at=now()`);
        }
        // Stamp published_at when first published
        if (review_status === 'published') {
          fields.push(`published_at=now()`);
        }
      } else if (fields.length > 0 && reviewed_by) {
        fields.push(`reviewed_by=$${p++}`); vals.push(reviewed_by);
        fields.push(`reviewed_at=now()`);
      }

      fields.push(`updated_at=now()`);
      if (fields.length <= 1) return res.json({ ok: true });

      vals.push(id);
      await pool.query(
        `UPDATE capadex_reports SET ${fields.join(', ')} WHERE id=$${p}`,
        vals
      );

      // Return the updated row so the panel can refresh without a separate fetch
      const updated = await pool.query(`SELECT * FROM capadex_reports WHERE id=$1`, [id]);
      res.json({ ok: true, report: updated.rows[0] });
    } catch (err) { next(err); }
  });

  // ── GET /api/admin/capadex/concerns-summary ──────────────────────────
  app.get('/api/admin/capadex/concerns-summary', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await pool.query(`
        SELECT concern_name,
               COUNT(*) AS total,
               ROUND(AVG(score)::numeric, 1) AS avg_score,
               COUNT(*) FILTER (WHERE score_level IN ('Mastery','Advanced')) AS mastery,
               COUNT(*) FILTER (WHERE score_level = 'Proficient')          AS proficient,
               COUNT(*) FILTER (WHERE score_level = 'Developing')          AS developing,
               COUNT(*) FILTER (WHERE score_level = 'Emerging')            AS emerging
        FROM capadex_reports
        GROUP BY concern_name
        ORDER BY total DESC
      `);
      res.json(rows.rows);
    } catch (err) { next(err); }
  });

  // ── POST /api/capadex/upgrade-interest ──────────────────────────────
  // Captures a user's interest in unlocking a paid stage (replaces WhatsApp redirect)
  app.post('/api/capadex/upgrade-interest', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { session_id, stage_code, stage_name, price, phone, concern_name, participant_name, email } = req.body || {};
      // Store as an audit event so it shows up in the admin audit trail
      await pool.query(
        `INSERT INTO capadex_audit_events
           (session_id, event_type, event_data, created_at)
         VALUES ($1, 'upgrade_interest', $2::jsonb, now())`,
        [
          session_id || null,
          redactJson({ stage_code, stage_name, price, phone: phone || null, concern_name, participant_name, email: email || null }) ?? '{}',
        ]
      ).catch(() => {
        // Fallback: just log if table insert fails
        console.log(`[upgrade-interest] ${participant_name || email || 'unknown'} → ${stage_name} (${price}) | phone: ${phone}`);
      });
      console.log(`[upgrade-interest] ${participant_name || email || 'unknown'} → ${stage_name} (${price}) | phone: ${phone}`);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ── GET /api/capadex/public-config  (public — counsellor number etc) ─
  app.get('/api/capadex/public-config', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { rows } = await pool.query(
        `SELECT setting_value FROM platform_settings WHERE setting_key = 'counsellor_whatsapp_number'`
      );
      // Include feature flags relevant to the public assessment flow.
      // websocket_runtime: controls whether FreeAssessmentModal opens a WS connection.
      // cognitive_load_engine: controls whether cognitive load events (and pacing cues)
      //   are emitted by the backend — the frontend pacing cue is therefore only
      //   reachable when this flag is also active on the server, making dual-flag
      //   verification implicit.
      res.json({
        counsellor_whatsapp_number: rows[0]?.setting_value || '919999999999',
        websocket_runtime:          isEnabled('websocket_runtime'),
        cognitive_load_engine:      isEnabled('cognitive_load_engine'),
      });
    } catch (err) { next(err); }
  });

  // ── GET /api/capadex/pricing  (public — used by report) ─────────────
  app.get('/api/capadex/pricing', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { rows } = await pool.query(
        `SELECT stage_code, stage_name, price, price_note, tag, description, benefits, whatsapp_number
         FROM capadex_stage_pricing WHERE is_active = true ORDER BY stage_code`
      );
      res.json(rows);
    } catch (err) { next(err); }
  });

  // ── GET /api/admin/capadex/pricing  (superadmin) ─────────────────────
  app.get('/api/admin/capadex/pricing', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM capadex_stage_pricing ORDER BY stage_code`
      );
      res.json(rows);
    } catch (err) { next(err); }
  });

  // ── PUT /api/admin/capadex/pricing/:stage_code  (superadmin) ─────────
  app.put('/api/admin/capadex/pricing/:stage_code', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { stage_code } = req.params;
      const { price, price_note, tag, description, benefits, whatsapp_number, is_active } = req.body;
      await pool.query(
        `UPDATE capadex_stage_pricing
         SET price=$2, price_note=$3, tag=$4, description=$5,
             benefits=$6::jsonb, whatsapp_number=$7, is_active=$8, updated_at=now()
         WHERE stage_code=$1`,
        [stage_code, price, price_note, tag, description, JSON.stringify(benefits), whatsapp_number, is_active]
      );
      res.json({ ok: true });
    } catch (err) { next(err); }
  });
}

// ── Shared helper: build the 4-stage progress map for a user ──────────
async function buildProgress(pool: Pool, email: string | null, concern: string) {
  if (!email) {
    const base = STAGES.map((s, i) => ({
      stage_code:  s.code,
      stage_label: s.label,
      stage_index: i,
      stage_color: s.color,
      status:      i === 0 ? 'available' : 'locked',
      score:       null as number | null,
    }));
    // Task #304 — evidence gate (flag-gated; OFF → byte-identical legacy array).
    if (isEvidenceGatedProgressionEnabled()) {
      const { enrichProgressWithEvidence } = await import('../services/capadex/evidence-gate');
      return enrichProgressWithEvidence(base, {});
    }
    return base;
  }

  // updated_at / persona / age_band are selected for the evidence-gate
  // freshness + cohort-data-sufficiency signals (Task #304); they are NOT added
  // to the returned shape, so flag-OFF output stays byte-identical.
  const { rows } = await pool.query<{ stage_code: string; status: string; score: string; updated_at: Date; persona: string | null; age_band: string | null }>(
    `SELECT DISTINCT ON (stage_code) stage_code, status, score, updated_at, persona, age_band
     FROM capadex_sessions
     WHERE guest_email = $1 AND LOWER(concern_name) = LOWER($2) AND status IN ('completed', 'in_progress')
     ORDER BY stage_code, updated_at DESC`,
    [email, concern]
  );

  const map: Record<string, { status: string; score: number | null; updatedAt: Date | null }> = {};
  for (const r of rows) {
    map[r.stage_code] = {
      status:    r.status,
      score:     r.score != null ? parseFloat(r.score) : null,
      updatedAt: r.updated_at instanceof Date ? r.updated_at : (r.updated_at ? new Date(r.updated_at) : null),
    };
  }

  const legacy = STAGES.map((s, i) => {
    const entry = map[s.code];
    let status: string;
    if (entry) {
      status = entry.status;
    } else if (i === 0) {
      status = 'available';
    } else if (map[STAGES[i - 1].code]?.status === 'completed') {
      status = 'available';
    } else {
      status = 'locked';
    }
    return {
      stage_code:  s.code,
      stage_label: s.label,
      stage_index: i,
      stage_color: s.color,
      status,
      score:       entry?.score ?? null,
    };
  });

  // Task #304 — when the flag is ON, enrich the legacy array with the read-only
  // evidence gate (GAP-P2 advancement gate + GAP-P1 re-measurement signal).
  // Flag OFF → return the legacy completion-only array untouched (byte-identical).
  if (isEvidenceGatedProgressionEnabled()) {
    const { enrichProgressWithEvidence } = await import('../services/capadex/evidence-gate');
    // Compose cohort-gating for the (non-gating) data-sufficiency axis: resolve
    // this user's cohort from the latest session's persona/age_band and count
    // peers. Read-only; degrades to 0 (masked) on any error.
    const { resolveCohort, countCohort } = await import('../services/cohort-gating');
    const latest = rows[0];
    let cohortN = 0;
    try {
      const cohort = resolveCohort({ persona: latest?.persona ?? null, age_band: latest?.age_band ?? null });
      cohortN = await countCohort(pool, cohort);
    } catch { cohortN = 0; }
    return enrichProgressWithEvidence(legacy, map, { cohortN });
  }
  return legacy;
}

/**
 * Public endpoint — returns top 3 safe RIE recommendations for the user
 * associated with a given CAPADEX session, plus a counsellor flag if an
 * escalation requiring human support exists.
 * Mounted separately after registerCapadexRoutes() in routes.ts.
 */
export function registerCapadexRecommendationsRoute(app: Express, pool: Pool) {
  // Local entitlement gate — same semantics as in registerCapadexRoutes (sessionParam: 'id').
  // Flag-off → synchronous pass-through (byte-identical legacy).
  const gateSessionEntitlement = requireEntitlement(pool, { sessionParam: 'id' });

  // ── GET /api/capadex/longitudinal/patterns — Gap 4 ───────────────────
  // Recurring patterns across all completed sessions for an email address.
  // Ordered by recurrence (session_count DESC) so persistent patterns surface
  // first. Returns [] gracefully when no sessions or no pipeline data yet.
  app.get('/api/capadex/longitudinal/patterns', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = ((req.query.email as string) || '').trim().toLowerCase();
      if (!email) return res.status(400).json({ error: 'email required' });
      const patterns = await getLongitudinalPatterns(pool, email);
      return res.status(200).json({ ok: true, email, patterns });
    } catch (err) { next(err); }
  });

  // ── GET /api/capadex/user/recent-sessions ────────────────────────────
  // Returns all completed sessions for a given email (no time limit).
  // Used by the "Access My Report" returning-user flow in the intro phase.
  app.get('/api/capadex/user/recent-sessions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = ((req.query.email as string) || '').trim().toLowerCase();
      if (!email) return res.status(400).json({ error: 'Email required' });
      const { rows } = await pool.query(
        `SELECT s.id AS session_id, s.concern_name, s.stage_code,
                s.score,
                CASE
                  WHEN s.score IS NULL THEN NULL
                  WHEN s.score >= 75 THEN 'High'
                  WHEN s.score >= 50 THEN 'Moderate'
                  WHEN s.score >= 25 THEN 'Low'
                  ELSE 'Very Low'
                END AS score_level,
                s.created_at
         FROM capadex_sessions s
         WHERE LOWER(s.guest_email) = $1
           AND s.status = 'completed'
         ORDER BY s.created_at DESC
         LIMIT 20`,
        [email]
      );
      res.json({ sessions: rows });
    } catch (err) { next(err); }
  });

  app.get('/api/capadex/session/:id/recommendations', gateSessionEntitlement, async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.id;
      if (!sessionId) return res.status(400).json({ error: 'session id required' });

      const { rows: sessions } = await pool.query(
        `SELECT guest_email FROM capadex_sessions WHERE id = $1 AND status = 'completed' LIMIT 1`,
        [sessionId]
      );
      const email = sessions[0]?.guest_email;
      if (!email) {
        return res.json({ recommendations: [], has_escalation: false });
      }

      const SAFE_DOMAINS = ['learning', 'behavioural', 'engagement', 'emotional', 'resilience', 'employability', 'leadership', 'recovery'];
      const { rows: rawRecs } = await pool.query(
        `SELECT title, expected_outcome, rec_type, domain, timing, intensity, confidence
         FROM rie_recommendations
         WHERE user_email = $1
           AND domain = ANY($2::text[])
         ORDER BY priority ASC, created_at DESC
         LIMIT 15`,
        [email, SAFE_DOMAINS]
      );
      // Deduplicate by title (rie_recommendations may accumulate identical rows across sessions)
      const seenTitles = new Set<string>();
      const recs = rawRecs.filter(r => {
        if (seenTitles.has(r.title)) return false;
        seenTitles.add(r.title);
        return true;
      }).slice(0, 3);

      const { rows: escalations } = await pool.query(
        `SELECT id FROM rie_escalations
         WHERE user_email = $1 AND requires_counsellor = true AND status != 'resolved'
         LIMIT 1`,
        [email]
      );

      return res.json({
        recommendations: recs,
        has_escalation: escalations.length > 0,
      });
    } catch (err) {
      console.error('[recommendations-route]', err);
      return res.json({ recommendations: [], has_escalation: false });
    }
  });
}
