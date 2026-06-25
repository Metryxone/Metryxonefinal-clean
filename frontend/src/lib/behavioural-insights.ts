// Shared behavioural intelligence types, constants, and pure utility functions.
// Used by FreeAssessmentModal and its phase components.

import React from 'react';
import {
  Target, Clock, BookOpen, Brain, Star, Sparkles, TrendingUp, CheckCircle,
  Heart, Shield, Users, Zap, Award, Building2, GraduationCap, Briefcase, UserCheck,
} from 'lucide-react';

import { BRAND } from '@/design-system/tokens';
export { BRAND };

export const METRYX_NAVY = '#344E86';
export const CAPADEX_STAGES = [
  { code: 'CAP_CUR', label: 'Curiosity', color: METRYX_NAVY, desc: 'Surface awareness & first signals' },
  { code: 'CAP_INS', label: 'Insight',   color: METRYX_NAVY, desc: 'Patterns & self-understanding'    },
  { code: 'CAP_GRW', label: 'Growth',    color: METRYX_NAVY, desc: 'Strategy & habit formation'       },
  { code: 'CAP_MAS', label: 'Mastery',   color: METRYX_NAVY, desc: 'Control & peak performance'       },
];

export interface CapadexQuestion {
  id: string;
  item_code: string;
  subdomain_code: string;
  question: string;
  weight: string;
  polarity: string;
  age_band: string;
  focus_area: string;
  layer_tag: string;
  anchor: boolean;
  domain: string;
  sub_domain_name: string;
  dimension: string;
  logic: string;
  response_range: string;
  opt_a: string;
  opt_b: string;
  opt_c: string;
  opt_d: string;
  opt_e: string;
  question_type?: string;
  options: { id: string; option_text: string; score_value: number; display_order: number }[];
}
export interface CapadexProgress {
  stage_code: string;
  stage_label: string;
  stage_index: number;
  stage_color: string;
  status: 'available' | 'locked' | 'completed' | 'in_progress';
  score: number | null;
}
export interface CapadexStageResult {
  session_id: string;
  stage_code: string;
  stage_label: string;
  stage_index: number;
  score: number;
  score_level: string;
  level_color: string;
  insight: string;
  subdomains: { subdomain_code: string; subdomain_name: string }[];
  next_stage: { code: string; label: string; index: number; color: string; desc: string } | null;
  concern_name: string;
  progress: CapadexProgress[];
}



export type PersonaKey = 'student' | 'teacher' | 'campus' | 'jobseeker' | 'parent' | 'professional';

export interface Persona {
  key: PersonaKey;
  label: string;
  sublabel: string;
  hint: string;
  icon: React.ElementType;
  color: string;
  contextLabel: string;
  contextPlaceholder: string;
  namePlaceholder: string;
  respondentPrefix: (name: string) => string;
  analyzeLabel: string;
  reportLabel: string;
  ctaLabel: string;
}

export const PERSONAS: Persona[] = [
  {
    key: 'student',
    label: 'Student',
    sublabel: 'Learning Readiness',
    hint: 'Discover your focus gaps & learning style',
    icon: GraduationCap,
    color: '#2EC4B6',
    contextLabel: 'Your school / college',
    contextPlaceholder: 'e.g. DPS Noida, BITS Pilani',
    namePlaceholder: 'e.g. Arjun, Priya',
    respondentPrefix: () => 'I',
    analyzeLabel: 'Analyzing your learning profile...',
    reportLabel: 'Learning Readiness Snapshot',
    ctaLabel: 'Start My Learning Assessment',
  },
  {
    key: 'teacher',
    label: 'Teacher / Educator',
    sublabel: 'Classroom Engagement',
    hint: 'Identify what\'s holding your class back',
    icon: UserCheck,
    color: '#0B3C5D',
    contextLabel: 'Your school / institution',
    contextPlaceholder: 'e.g. Kendriya Vidyalaya, CBSE',
    namePlaceholder: 'e.g. Ms. Sharma, Mr. Patel',
    respondentPrefix: () => 'My students',
    analyzeLabel: 'Analyzing classroom engagement data...',
    reportLabel: 'Classroom Engagement Snapshot',
    ctaLabel: 'Start Classroom Assessment',
  },
  {
    key: 'campus',
    label: 'Campus Student',
    sublabel: 'Employability Check',
    hint: 'Know your readiness score before placements',
    icon: Building2,
    color: '#4ECDC4',
    contextLabel: 'Your college & target industry',
    contextPlaceholder: 'e.g. IIT Delhi → Tech / Finance',
    namePlaceholder: 'e.g. Rahul, Ananya',
    respondentPrefix: () => 'I',
    analyzeLabel: 'Analyzing your employability profile...',
    reportLabel: 'Employability Readiness Snapshot',
    ctaLabel: 'Start My Employability Check',
  },
  {
    key: 'jobseeker',
    label: 'Job Seeker',
    sublabel: 'Role Fitment Assessment',
    hint: 'See how well you match your target role',
    icon: Briefcase,
    color: '#2D4494',
    contextLabel: 'Target role / industry',
    contextPlaceholder: 'e.g. Product Manager, FinTech',
    namePlaceholder: 'e.g. Vikram, Neha',
    respondentPrefix: () => 'I',
    analyzeLabel: 'Analyzing your role-fitment profile...',
    reportLabel: 'Role Fitment Snapshot',
    ctaLabel: 'Start My Fitment Assessment',
  },
  {
    key: 'parent',
    label: 'Parent / Guardian',
    sublabel: "Child's Readiness Check",
    hint: "Understand your child's learning style, focus patterns & readiness gaps",
    icon: Users,
    color: '#25A99D',
    contextLabel: "Child's school / grade",
    contextPlaceholder: "e.g. DPS Noida, Class 7",
    namePlaceholder: "Child's first name",
    respondentPrefix: (name) => name ? name : 'My child',
    analyzeLabel: "Analyzing your child's learning profile...",
    reportLabel: "Child's Learning Readiness Snapshot",
    ctaLabel: "Start Child's Assessment",
  },
  {
    key: 'professional',
    label: 'Working Professional',
    sublabel: 'Workplace Effectiveness',
    hint: 'Pinpoint your leadership gaps, blind spots & growth areas at work',
    icon: Award,
    color: '#0B3C5D',
    contextLabel: 'Your role / industry',
    contextPlaceholder: 'e.g. Senior Manager, FMCG',
    namePlaceholder: 'e.g. Raj, Priya',
    respondentPrefix: () => 'I',
    analyzeLabel: 'Analyzing your workplace effectiveness profile...',
    reportLabel: 'Workplace Effectiveness Snapshot',
    ctaLabel: 'Start My Effectiveness Assessment',
  },
];

export interface Question {
  id: number;
  text: string;
  domain: string;
  domainLabel: string;
  tip: string;
}

export const QUESTION_BANKS: Record<PersonaKey, Question[]> = {
  student: [
    { id: 1, text: "manage my study schedule without reminders from parents or teachers.", domain: "self_management", domainLabel: "Self-Management", tip: "Self-regulation is among the top 3 predictors of academic success." },
    { id: 2, text: "stay focused during class even when the topic feels boring.", domain: "attention", domainLabel: "Attention & Focus", tip: "Sustained attention is a trainable cognitive skill." },
    { id: 3, text: "review my mistakes in tests to understand what went wrong.", domain: "reflection", domainLabel: "Reflective Learning", tip: "Reviewing errors improves retention by 40%." },
    { id: 4, text: "handle exam pressure without it affecting my performance significantly.", domain: "stress", domainLabel: "Exam Stress Handling", tip: "Test anxiety can reduce scores by up to 12%." },
    { id: 5, text: "can explain what I've studied in my own words to someone else.", domain: "comprehension", domainLabel: "Comprehension", tip: "Self-explanation ability indicates true mastery." },
    { id: 6, text: "set weekly study goals and track my progress toward them.", domain: "goal_setting", domainLabel: "Goal Setting", tip: "Goal-setting students outperform peers by 23%." },
    { id: 7, text: "ask questions when I don't understand a concept in class.", domain: "curiosity", domainLabel: "Intellectual Curiosity", tip: "Intrinsic curiosity drives deeper understanding." },
    { id: 8, text: "adapt quickly when my study plan changes unexpectedly.", domain: "adaptability", domainLabel: "Adaptability", tip: "Adaptability predicts performance under uncertainty." },
    { id: 9, text: "take full responsibility for my academic progress.", domain: "responsibility", domainLabel: "Ownership", tip: "Ownership of learning predicts academic growth." },
    { id: 10, text: "stay motivated to study even when there is no upcoming exam.", domain: "motivation", domainLabel: "Intrinsic Motivation", tip: "Intrinsic motivation is the strongest long-term learning driver." },
  ],
  teacher: [
    { id: 1, text: "can sustain attention during a 40-minute lesson without significant distraction.", domain: "attention", domainLabel: "Attention Span", tip: "Attention span under 20 min signals a classroom design issue." },
    { id: 2, text: "ask questions without being prompted during class.", domain: "curiosity", domainLabel: "Intellectual Curiosity", tip: "Student-initiated questions predict deeper learning outcomes." },
    { id: 3, text: "recover quickly from a disappointing test result and re-engage.", domain: "resilience", domainLabel: "Academic Resilience", tip: "Resilience is teachable and dramatically affects outcomes." },
    { id: 4, text: "complete assignments independently without copying from peers.", domain: "responsibility", domainLabel: "Academic Integrity", tip: "Independent work reflects genuine comprehension." },
    { id: 5, text: "show visible signs of test-related anxiety during assessments.", domain: "stress", domainLabel: "Test Anxiety", tip: "Anxiety-aware assessment design improves accuracy by 18%." },
    { id: 6, text: "understand how to apply what they've learned to new situations.", domain: "application", domainLabel: "Concept Application", tip: "Transfer learning is the highest order of understanding." },
    { id: 7, text: "take responsibility for their own learning progress.", domain: "self_management", domainLabel: "Self-Directed Learning", tip: "Self-directed learners outperform by 31% over 3 years." },
    { id: 8, text: "collaborate effectively in group activities and projects.", domain: "social", domainLabel: "Collaborative Learning", tip: "Peer learning improves retention by up to 50%." },
    { id: 9, text: "show curiosity beyond the curriculum — reading extra, asking 'why?'", domain: "beyond_curriculum", domainLabel: "Beyond-Curriculum Drive", tip: "Intrinsically curious students reach mastery 2x faster." },
    { id: 10, text: "adapt easily when classroom routines or topics change suddenly.", domain: "adaptability", domainLabel: "Adaptability", tip: "Adaptability is the #1 skill employers seek in graduates." },
  ],
  campus: [
    { id: 1, text: "can clearly articulate my strengths and career goals in an interview.", domain: "communication", domainLabel: "Communication", tip: "Clear self-presentation is the #1 interview differentiator." },
    { id: 2, text: "solve problems methodically before jumping to conclusions.", domain: "critical_thinking", domainLabel: "Problem Solving", tip: "Structured thinking reduces decision errors by 34%." },
    { id: 3, text: "work comfortably with people from different backgrounds.", domain: "social", domainLabel: "Collaborative Aptitude", tip: "Team diversity drives 35% more innovation." },
    { id: 4, text: "adapt quickly when project requirements or deadlines change.", domain: "adaptability", domainLabel: "Adaptability", tip: "Adaptability is the top quality sought in campus hires." },
    { id: 5, text: "manage stress well during group discussions or high-pressure situations.", domain: "stress", domainLabel: "Stress Management", tip: "Calm under pressure raises team performance by 22%." },
    { id: 6, text: "take initiative in projects without waiting for explicit instructions.", domain: "initiative", domainLabel: "Initiative", tip: "Self-starters are promoted 3x faster in the first year." },
    { id: 7, text: "continuously upskill beyond what is taught in college.", domain: "learning_agility", domainLabel: "Learning Agility", tip: "Learning agility predicts leadership potential." },
    { id: 8, text: "understand current industry trends well enough to discuss them confidently.", domain: "industry_awareness", domainLabel: "Industry Awareness", tip: "Domain knowledge reduces time-to-productivity by 40%." },
    { id: 9, text: "receive and apply feedback without becoming defensive.", domain: "feedback", domainLabel: "Receptivity to Feedback", tip: "Feedback acceptance is linked to 28% faster skill growth." },
    { id: 10, text: "manage my time effectively across academics, personal life, and career prep.", domain: "self_management", domainLabel: "Time Management", tip: "Time management is cited by 72% of employers as critical." },
  ],
  jobseeker: [
    { id: 1, text: "can explain how my past experience maps clearly to the new role I'm targeting.", domain: "role_clarity", domainLabel: "Role Clarity", tip: "Candidates who connect past to future are 2x more hireable." },
    { id: 2, text: "adapt quickly to new tools, technologies, or work environments.", domain: "adaptability", domainLabel: "Adaptability", tip: "Adaptable employees reach full productivity 40% faster." },
    { id: 3, text: "maintain consistent performance during organizational change or uncertainty.", domain: "resilience", domainLabel: "Change Resilience", tip: "Resilience predicts retention rate in volatile roles." },
    { id: 4, text: "build rapport with new colleagues and managers efficiently.", domain: "social", domainLabel: "Relationship Building", tip: "Strong onboarding relationships reduce turnover by 25%." },
    { id: 5, text: "proactively identify workflow problems and suggest improvements.", domain: "initiative", domainLabel: "Proactive Mindset", tip: "Proactive employees drive 22% more process improvements." },
    { id: 6, text: "manage multiple competing priorities and deadlines effectively.", domain: "self_management", domainLabel: "Priority Management", tip: "Priority management is the #1 skill for senior roles." },
    { id: 7, text: "communicate complex ideas clearly to non-technical stakeholders.", domain: "communication", domainLabel: "Cross-functional Communication", tip: "Communication clarity accelerates decisions by 33%." },
    { id: 8, text: "take ownership of outcomes, not just tasks assigned to me.", domain: "ownership", domainLabel: "Ownership Mindset", tip: "Ownership mindset is the #1 leadership predictor." },
    { id: 9, text: "continuously learn and apply emerging industry trends to my work.", domain: "learning_agility", domainLabel: "Learning Agility", tip: "Continuous learners earn 15% more over a 5-year career span." },
    { id: 10, text: "handle ambiguous, undefined situations with confidence and structured thinking.", domain: "ambiguity_tolerance", domainLabel: "Ambiguity Tolerance", tip: "Tolerance for ambiguity is essential in modern senior roles." },
  ],
  parent: [
    { id: 1, text: "manages their study schedule without constant reminders from me.", domain: "self_management", domainLabel: "Self-Management", tip: "Children who self-manage outperform peers by 34% within a year." },
    { id: 2, text: "stays focused on homework or reading for at least 20–30 minutes without distraction.", domain: "attention", domainLabel: "Attention & Focus", tip: "Sustained focus is among the strongest predictors of academic growth." },
    { id: 3, text: "reviews mistakes in tests rather than setting them aside.", domain: "reflection", domainLabel: "Reflective Learning", tip: "Reviewing errors leads to 40% better long-term retention." },
    { id: 4, text: "handles exam pressure without it causing visible anxiety or distress.", domain: "stress", domainLabel: "Exam Stress Handling", tip: "Test anxiety affects up to 25% of school-age children." },
    { id: 5, text: "can explain what they have studied in their own words, not just memorise.", domain: "comprehension", domainLabel: "Deep Comprehension", tip: "Self-explanation is a reliable signal of true understanding." },
    { id: 6, text: "sets their own study goals and tracks progress without being told.", domain: "goal_setting", domainLabel: "Goal Orientation", tip: "Goal-setting children outperform their peers by 23%." },
    { id: 7, text: "asks questions and shows curiosity beyond what is covered in class.", domain: "curiosity", domainLabel: "Intellectual Curiosity", tip: "Curious children develop faster cognitive skills." },
    { id: 8, text: "adapts well when routines, teachers, or learning plans change.", domain: "adaptability", domainLabel: "Adaptability", tip: "Adaptability in learning predicts long-term academic resilience." },
    { id: 9, text: "takes responsibility for their academic progress rather than blaming others.", domain: "responsibility", domainLabel: "Ownership & Accountability", tip: "Ownership mindset drives sustained academic improvement." },
    { id: 10, text: "stays motivated to study even without the pressure of an upcoming exam.", domain: "motivation", domainLabel: "Intrinsic Motivation", tip: "Intrinsic motivation is the strongest driver of lifelong learning." },
  ],
  professional: [
    { id: 1, text: "set clear weekly priorities and protect them from constant interruptions.", domain: "self_management", domainLabel: "Priority Management", tip: "Professionals who protect priorities deliver 31% more high-impact work." },
    { id: 2, text: "stay effective and clear-headed under high-pressure deadlines or conflicting demands.", domain: "stress", domainLabel: "Pressure Performance", tip: "Composure under pressure is the #1 trait cited by senior leaders." },
    { id: 3, text: "give and receive feedback in a way that leads to real, visible improvement.", domain: "feedback", domainLabel: "Feedback Effectiveness", tip: "Effective feedback culture drives 14% faster team performance gains." },
    { id: 4, text: "influence colleagues or stakeholders without relying on positional authority.", domain: "influence", domainLabel: "Influence & Persuasion", tip: "Influence without authority is the defining skill of effective leaders." },
    { id: 5, text: "adapt my communication style to different audiences — executive, technical, or operational.", domain: "communication", domainLabel: "Adaptive Communication", tip: "Communication flexibility reduces misalignment by 40% in cross-functional teams." },
    { id: 6, text: "take initiative beyond my defined role to solve problems proactively.", domain: "initiative", domainLabel: "Proactive Ownership", tip: "Employees who act beyond their role are 3x more likely to be promoted." },
    { id: 7, text: "regulate my emotional responses during conflict or politically charged situations.", domain: "emotional_regulation", domainLabel: "Emotional Regulation", tip: "EQ accounts for 58% of professional performance in senior roles." },
    { id: 8, text: "continuously learn and apply new skills relevant to my evolving role.", domain: "learning_agility", domainLabel: "Learning Agility", tip: "Learning agility is the #1 predictor of long-term leadership potential." },
    { id: 9, text: "build strong, trusting working relationships across teams and hierarchies.", domain: "social", domainLabel: "Relationship Capital", tip: "Strong internal networks reduce time-to-decision by 27%." },
    { id: 10, text: "make clear, confident decisions even when information is incomplete or ambiguous.", domain: "ambiguity_tolerance", domainLabel: "Decision Under Ambiguity", tip: "Ambiguity tolerance separates high-performers from average performers at senior levels." },
  ],
};

export const RATING_OPTIONS = [
  { value: 1, label: "Never",      color: "#94a3b8" },
  { value: 2, label: "Rarely",     color: "#64748b" },
  { value: 3, label: "Sometimes",  color: "#4ECDC4" },
  { value: 4, label: "Often",      color: "#2EC4B6" },
  { value: 5, label: "Always",     color: "#1D3E8B" },
];

export interface DomainResult {
  domain: string;
  label: string;
  score: number;
  percentage: number;
  level: "Needs Support" | "Developing" | "On Track" | "Strong";
  color: string;
}

export const DOMAIN_ICONS: Record<string, React.ElementType> = {
  attention: Target, self_management: Clock, reflection: BookOpen,
  stress: Brain, comprehension: BookOpen, goal_setting: Star,
  curiosity: Sparkles, adaptability: TrendingUp, responsibility: CheckCircle,
  motivation: Heart, resilience: Shield, social: Users, application: Brain,
  beyond_curriculum: Sparkles, communication: Users, critical_thinking: Brain,
  initiative: Zap, learning_agility: TrendingUp, industry_awareness: Building2,
  feedback: CheckCircle, role_clarity: Target, ownership: Award,
  ambiguity_tolerance: Brain, beyond_curriculum2: Sparkles,
  influence: Zap, emotional_regulation: Heart,
};

export function getLevel(pct: number): { level: DomainResult["level"]; color: string } {
  if (pct >= 80) return { level: "Strong", color: "#4ECDC4" };
  if (pct >= 60) return { level: "On Track", color: BRAND.accent };
  if (pct >= 40) return { level: "Developing", color: "#f59e0b" };
  return { level: "Needs Support", color: "#ef4444" };
}

export const LOCKED_DOMAINS_BY_PERSONA: Record<PersonaKey, string[]> = {
  student: ["Memory & Recall", "Creative Thinking", "Peer Influence", "Decision Making", "Goal Persistence", "Emotional Regulation", "Study Style", "Time Perception", "Exam Behaviour"],
  teacher: ["Cohort Pattern Analysis", "Risk Student Flags", "Peer Influence Index", "Classroom Motivation Profile", "Teaching Effectiveness Index", "Learning Style Distribution", "Attention Heat Map", "Academic Anxiety Spread", "Engagement Trajectory"],
  campus: ["Aptitude Score", "Verbal Reasoning", "Logical Reasoning", "Numerical Ability", "Leadership Quotient", "Cultural Fit Score", "Role Suitability Index", "Interview Readiness", "Offer Conversion Probability"],
  jobseeker: ["Cognitive Aptitude Score", "Leadership Readiness", "Cultural Alignment", "Decision Under Pressure", "Salary Negotiation Style", "Career Growth Trajectory", "Lateral Move Risk Score", "Retention Probability", "Influence & Persuasion"],
  parent: ["Sensory Processing Style", "Learning Modality Index", "Peer Influence Score", "Home Environment Impact", "Emotional Regulation Index", "Study Habit Depth", "Parental Alignment Score", "Cognitive Load Sensitivity", "Long-term Academic Trajectory"],
  professional: ["Leadership Index", "Executive Presence Score", "Conflict Resolution Style", "Delegation Effectiveness", "Strategic Thinking Score", "Political Intelligence", "Mentoring Aptitude", "Negotiation & Influence", "Succession Readiness"],
};

export const FAM_TERMS = ['competency', 'learning style', 'memory style', 'focus pattern', 'processing style', 'cognitive strengths', 'behavioural profile'];

/* ── Upgrade tiers ─────────────────────────────────────────────── */
export const UPGRADE_TIERS: {
  key: string; name: string; feel: string; tagline: string;
  icon: React.ElementType; color: string; price: string; priceNote: string;
  popular?: boolean; benefits: string[];
}[] = [
  {
    key: 'clarity', name: 'Clarity', feel: 'Understanding',
    tagline: 'Understand your full behavioral pattern',
    icon: BookOpen, color: '#2EC4B6', price: '₹499', priceNote: 'one-time',
    benefits: ['Complete 19-domain behavioral map', 'Learning & working style identified', 'Domain-by-domain personalised insight', 'Downloadable PDF report'],
  },
  {
    key: 'growth', name: 'Growth', feel: 'Improvement',
    tagline: 'Turn insight into measurable progress',
    icon: TrendingUp, color: '#1D3E8B', price: '₹999', priceNote: 'one-time',
    popular: true,
    benefits: ['Everything in Clarity', '90-day personalised action plan', 'Mentor-match recommendation', 'Progress tracking & re-assessment'],
  },
  {
    key: 'mastery', name: 'Mastery', feel: 'Peak performance',
    tagline: 'Your complete behavioural intelligence blueprint',
    icon: Award, color: '#0B3C5D', price: '₹1,999', priceNote: 'one-time',
    benefits: ['Everything in Growth', 'Career or academic intelligence profile', '1-on-1 mentor session included', 'Succession & growth readiness map'],
  },
];

/* ── Narrative insight generator (no scores, no percentages) ──── */
export function buildInsightNarrative(
  persona: PersonaKey,
  domains: DomainResult[],
  overallLevel: string,
  name: string,
): { snapshot: string; naturalEdge: string; growthSpace: string; whatsNext: string } {
  const sorted = [...domains].sort((a, b) => b.score - a.score);
  const high = sorted.slice(0, 2).map(d => d.label);
  const low  = sorted.slice(-2).map(d => d.label);
  const fn   = name.split(' ')[0] || 'your profile';
  const isAcademic = ['student', 'teacher', 'campus'].includes(persona);
  const isCareer   = ['jobseeker', 'professional'].includes(persona);
  const ctx  = isAcademic ? 'learning' : isCareer ? 'professional' : 'development';
  const subj = isAcademic ? 'learner' : isCareer ? 'professional' : 'individual';

  const snap: Record<string, string> = {
    'Strong':           `${fn}'s responses reflect a ${ctx} orientation marked by consistency and intention. A clear pattern of self-direction emerges across multiple dimensions of this assessment.`,
    'On Track':         `${fn}'s responses suggest a ${ctx} profile that is actively developing and building coherence. More structure is emerging than may be immediately visible from the outside.`,
    'Developing':       `${fn}'s responses reflect someone in an active phase of forming ${ctx} habits. These patterns are directional — not fixed — and respond well to structured insight and support.`,
    'Needs Attention':  `${fn}'s responses suggest a period of friction in their ${ctx} journey. This is a meaningful signal — not a verdict — and one that responds well to the right kind of understanding and guidance.`,
  };
  const edge: Record<string, string> = {
    'Strong':           `Particularly clear indicators of capacity show up around ${high[0]}${high[1] ? ` and ${high[1]}` : ''}. These strengths, when understood and channelled deliberately, tend to compound and create lasting advantage.`,
    'On Track':         `Encouraging patterns emerge around ${high[0]}${high[1] ? ` and ${high[1]}` : ''}. These areas carry the hallmarks of genuine capability — they simply need the right context and clarity to activate fully.`,
    'Developing':       `The responses point to emerging capacity in ${high[0]}${high[1] ? ` and ${high[1]}` : ''}. Even at this stage, these are building blocks worth recognising and developing with intention.`,
    'Needs Attention':  `Even in a more challenging phase, signals worth noting appear around ${high[0]}${high[1] ? ` and ${high[1]}` : ''}. These represent the most accessible starting points for positive change.`,
  };
  const grow: Record<string, string> = {
    'Strong':           `Even strong profiles carry growth edges. Areas like ${low[0]}${low[1] ? ` and ${low[1]}` : ''} represent where continued investment can elevate an already capable ${subj} to an exceptional one.`,
    'On Track':         `Areas like ${low[0]}${low[1] ? ` and ${low[1]}` : ''} suggest where focused, structured effort would yield meaningful returns. These are not weaknesses — they are the natural next frontier.`,
    'Developing':       `Patterns around ${low[0]}${low[1] ? ` and ${low[1]}` : ''} are where the most meaningful development work currently lies. These areas are highly responsive to targeted support and clearer direction.`,
    'Needs Attention':  `${low[0]}${low[1] ? ` and ${low[1]}` : ''} emerge as areas where intentional, supported practice is most likely to create a visible shift. These patterns are not permanent — they are responsive to the right approach.`,
  };
  const next: Record<string, string> = {
    'Strong':           `This Insight snapshot reflects just a fraction of ${fn}'s full behavioral picture. A Clarity or Growth report would reveal the complete map and offer far more precision about where to invest next.`,
    'On Track':         `A deeper assessment would give ${fn} a much more complete and actionable behavioral map — moving from general observations to specific, personalised direction that's grounded in evidence.`,
    'Developing':       `A Clarity Assessment would transform these early signals into a precise, actionable picture — one that gives ${fn} and their support network something concrete and targeted to work with.`,
    'Needs Attention':  `Understanding the underlying patterns in greater depth — through a Clarity or Growth report — would give ${fn} a far clearer and more actionable path forward than general advice alone.`,
  };

  const lvl = overallLevel in snap ? overallLevel : 'Developing';

  return {
    snapshot:   snap[lvl],
    naturalEdge: edge[lvl],
    growthSpace: grow[lvl],
    whatsNext:  next[lvl],
  };
}

// ─── Subdomain intelligence descriptions ────────────────────────────────────

const SUBDOMAIN_DESCRIPTIONS: Record<string, { title: string; description: string; high: string; low: string; action_high: string; action_low: string }> = {
  'self-regulation': {
    title: 'Self-Regulation',
    description: 'Ability to manage emotions, impulses, and behavioural responses.',
    high: 'Demonstrates strong emotional control and consistent self-directed behaviour.',
    low: 'May struggle with impulse control or emotional reactivity under pressure.',
    action_high: 'Your self-regulation is a real asset — use it deliberately in high-pressure moments to anchor others around you.',
    action_low: 'Start small: pause for 3 breaths before reacting to anything frustrating today. That one-second gap is where self-regulation is built.',
  },
  'attention': {
    title: 'Attention',
    description: 'Capacity to focus and sustain cognitive effort on tasks.',
    high: 'Maintains focus effectively, even in distracting environments.',
    low: 'May experience difficulty sustaining attention on longer tasks.',
    action_high: 'Protect your peak focus hours — identify when attention is sharpest and schedule your most important work there.',
    action_low: 'Try one 20-minute focus session with your phone in another room. Notice what happens. That\'s your baseline to build from.',
  },
  'social-cognition': {
    title: 'Social Cognition',
    description: 'Understanding of social cues, empathy, and interpersonal dynamics.',
    high: 'Reads social situations accurately and responds with sensitivity.',
    low: 'May find social nuance challenging; benefits from explicit communication.',
    action_high: 'Your social awareness is an advantage in group settings — use it to spot tensions early and bridge them before they escalate.',
    action_low: 'After your next conversation, spend 2 minutes reflecting on what the other person seemed to need — not just what they said.',
  },
  'adaptability': {
    title: 'Adaptability',
    description: 'Flexibility in adjusting to new situations, environments, or information.',
    high: 'Embraces change with ease and recovers quickly from disruption.',
    low: 'Prefers routine; may find unexpected change stressful.',
    action_high: 'Your adaptability lets you thrive in changing environments — actively seek situations that stretch this strength.',
    action_low: 'Introduce one small, intentional change to your routine this week. The goal is making change feel less disruptive, not more.',
  },
  'motivation': {
    title: 'Motivation',
    description: 'Internal drive to pursue goals and sustain effort over time.',
    high: 'Goal-oriented and self-initiating; maintains effort without external pressure.',
    low: 'May require external encouragement to sustain progress.',
    action_high: 'Your drive is strong — channel it by setting one stretch goal that genuinely excites you and tracking it weekly.',
    action_low: 'Connect today\'s task to something you actually care about. External pressure alone won\'t sustain you — internal meaning will.',
  },
  'working-memory': {
    title: 'Working Memory',
    description: 'Capacity to hold and manipulate information in the short term.',
    high: 'Processes and integrates multiple streams of information efficiently.',
    low: 'May benefit from written notes and structured information delivery.',
    action_high: 'You hold complexity well — use this to tackle multi-step problems that others find overwhelming.',
    action_low: 'Externalise more: write down the key points in any important conversation or task immediately. Your memory works better with support.',
  },
  'executive-function': {
    title: 'Executive Function',
    description: 'Higher-order planning, organisation, and goal management skills.',
    high: 'Plans, prioritises, and executes complex tasks with consistency.',
    low: 'Structured frameworks and step-by-step guidance improve performance.',
    action_high: 'Your planning ability is a real edge — use it to break complex goals into clear phases and help others do the same.',
    action_low: 'Pick one task and write down its 3 smallest next steps before starting. That structure is the scaffold your brain needs right now.',
  },
  'digital-wellbeing': {
    title: 'Digital Wellbeing',
    description: 'Balanced relationship with digital technology and screen use.',
    high: 'Uses technology intentionally with healthy boundaries.',
    low: 'Digital habits may be impacting wellbeing; mindful usage strategies can help.',
    action_high: 'Your digital balance is healthy — share what works with someone in your life who\'s struggling with this.',
    action_low: 'Put your phone in another room for the first 30 minutes after waking up. One boundary, consistently kept, creates the foundation.',
  },
  'peer-relations': {
    title: 'Peer Relations',
    description: 'Quality of relationships with peers and collaborative functioning.',
    high: 'Builds trust, collaborates effectively, and navigates conflict constructively.',
    low: 'May prefer solitary work; peer dynamics can feel demanding.',
    action_high: 'Your relationship-building is a genuine strength — use it intentionally by investing in one professional relationship this week.',
    action_low: 'Initiate one low-stakes conversation with a peer today. Connection builds in small, repeated moments — not big gestures.',
  },
  'academic-resilience': {
    title: 'Academic Resilience',
    description: 'Ability to persist through academic challenges and setbacks.',
    high: 'Treats setbacks as learning opportunities; maintains growth mindset.',
    low: 'Academic pressure may trigger avoidance; structured support is beneficial.',
    action_high: 'Your resilience lets you recover faster than most — model this for peers who struggle after setbacks.',
    action_low: 'After any academic setback today, ask yourself: "What is one thing I can do differently next time?" Write it down. That\'s resilience in practice.',
  },

  // ─── Career & Professional subdomains ────────────────────────────────────

  'career-clarity': {
    title: 'Career Clarity',
    description: 'Degree of certainty about career direction, purpose, and the decisions that drive progression.',
    high: 'Has a well-defined sense of professional direction — goals, motivators, and trajectory are aligned.',
    low: 'Career direction feels uncertain or fragmented; the path forward is not clearly defined yet.',
    action_high: 'Your clarity is a strategic asset — use it to get specific about your 18-month move rather than just staying the course.',
    action_low: 'Write down the last 3 roles or projects where you felt most engaged. Look for the pattern — that\'s where your direction is hiding.',
  },
  'professional-identity': {
    title: 'Professional Identity',
    description: 'Strength and coherence of one\'s sense of self in a professional context — values, strengths, and positioning.',
    high: 'Strong, stable professional identity — knows their value, voice, and what they stand for at work.',
    low: 'Professional identity is still forming or feels inconsistent across contexts.',
    action_high: 'You know who you are professionally — invest in articulating it more deliberately in high-stakes situations like interviews or leadership conversations.',
    action_low: 'Ask three trusted colleagues what they would call your signature contribution. Their answers will surface what you may be undervaluing in yourself.',
  },
  'decision-intelligence': {
    title: 'Decision Intelligence',
    description: 'Quality of career and professional decision-making — how well choices are structured, evaluated, and executed.',
    high: 'Makes career decisions deliberately — weighs options clearly and acts with confidence.',
    low: 'Decision-making around career choices is slow, circular, or prone to second-guessing.',
    action_high: 'Your decision quality is a strength — now focus on speed. Practice committing to a direction within a defined window rather than over-optimising.',
    action_low: 'For your next career decision, write the top 3 criteria that matter most to you. Deciding on your criteria first removes most of the friction.',
  },
  'skill-mapping': {
    title: 'Skill Mapping',
    description: 'Ability to accurately inventory one\'s skills, recognise transferable capabilities, and identify gaps.',
    high: 'Has a clear, realistic picture of current skills and how they translate across roles and contexts.',
    low: 'Skills inventory is unclear or underweighted — may be selling capabilities short or misreading gaps.',
    action_high: 'Your self-awareness around skills is strong — channel it into a crisp narrative about what you bring and where you want to grow.',
    action_low: 'List your last 5 meaningful work outcomes and the skills that produced them. You have more transferable currency than you think.',
  },
  'role-clarity': {
    title: 'Role Clarity',
    description: 'Understanding of one\'s current role expectations, scope, and performance standards.',
    high: 'Operates with a clear understanding of role scope, priorities, and how success is defined.',
    low: 'Role expectations feel ambiguous or misaligned — may cause diffuse effort or under-delivery.',
    action_high: 'Use your role clarity to proactively define what "exceptional" looks like in your current position — most people stop at "meets expectations".',
    action_low: 'This week, have a direct conversation with your manager about the top 2 outcomes that would most signal strong performance. Clarity is a conversation.',
  },
  'transition-readiness': {
    title: 'Transition Readiness',
    description: 'Practical and psychological preparedness to move into a new role, function, or career phase.',
    high: 'Demonstrates the mindset, skills, and groundwork to navigate a career transition effectively.',
    low: 'Transition preparedness is limited — gaps in readiness may create friction when making a move.',
    action_high: 'You\'re well-placed to make a move — identify the one conversation or relationship that would most accelerate it.',
    action_low: 'Pick the single most important capability gap between where you are and where you want to go. Focus all development effort there for the next 60 days.',
  },
  'career-anxiety': {
    title: 'Career Anxiety',
    description: 'Degree to which career-related concerns generate unproductive worry, avoidance, or paralysis.',
    high: 'Career concerns are managed well — uncertainty is tolerated without derailing performance or decisions.',
    low: 'Career anxiety is getting in the way of clear thinking or decisive action.',
    action_high: 'Your composure around career uncertainty is a real edge — lean into ambiguous situations that others avoid.',
    action_low: 'Notice whether your career worry is solving a problem or just cycling. Set a 15-minute "career thinking window" daily and contain it there.',
  },
  'future-anxiety': {
    title: 'Future Anxiety',
    description: 'Ability to hold uncertainty about the future without it driving avoidance or compulsive planning.',
    high: 'Maintains forward momentum even when the future is unclear — uncertainty fuels rather than paralyses.',
    low: 'Uncertainty about what comes next is generating more friction than forward movement.',
    action_high: 'Your tolerance for future uncertainty is an asset in volatile environments — use it to take bolder bets than peers who need certainty to move.',
    action_low: 'Identify the one decision you\'ve been delaying because you\'re waiting for certainty. Make it. Imperfect action generates more clarity than continued waiting.',
  },
  'direction-persistence': {
    title: 'Direction Persistence',
    description: 'Sustained commitment to a chosen professional direction despite setbacks, slow progress, or competing pressures.',
    high: 'Stays focused on long-term professional direction even when short-term conditions shift.',
    low: 'Commitment to direction fluctuates under pressure — may abandon paths before giving them enough time.',
    action_high: 'Your persistence is a significant differentiator — channel it into a path where the compounding effect has room to build.',
    action_low: 'Before changing direction, ask: "Is this not working, or am I just in the hard middle?" The hard middle is where most people quit.',
  },
  'meaning-at-work': {
    title: 'Meaning at Work',
    description: 'Extent to which work feels purposeful, connected to values, and worth the investment of effort.',
    high: 'Finds genuine meaning in their work — aligned with values, energised by contribution.',
    low: 'Current work feels disconnected from what matters — energy leakage is likely.',
    action_high: 'Meaning is your fuel — protect it by being deliberate about what you take on and what you decline.',
    action_low: 'Identify the part of your current role that comes closest to mattering to you. Build more of that in — even if it\'s 20% of your week.',
  },
  'performance-anxiety': {
    title: 'Performance Anxiety',
    description: 'Tendency for performance-related pressure to create unhelpful cognitive or behavioural interference.',
    high: 'Performs well under evaluation — pressure converts to focus rather than interference.',
    low: 'Performance pressure may create cognitive interference that undermines actual capability.',
    action_high: 'Your performance composure is an asset in high-stakes situations — actively seek the rooms where it gives you the most advantage.',
    action_low: 'Before high-pressure moments, write down 3 specific things you have done well recently. This grounds your nervous system in evidence, not speculation.',
  },
  'social-comparison': {
    title: 'Social Comparison',
    description: 'Degree to which comparing one\'s career progress to peers drives helpful ambition versus corrosive self-doubt.',
    high: 'Uses awareness of peers\' progress as useful calibration without letting it undermine self-assessment.',
    low: 'Peer comparison is generating more self-doubt than useful ambition — distorting self-evaluation.',
    action_high: 'You use comparison well — as calibration, not verdict. Keep using it to identify what\'s possible rather than what\'s missing.',
    action_low: 'When you notice comparison pulling you down, ask: "Am I comparing my whole journey to someone else\'s highlight?" That question usually dissolves it.',
  },
  'purpose-clarity': {
    title: 'Purpose Clarity',
    description: 'Clarity about the deeper motivations driving professional choices and the kind of impact one wants to have.',
    high: 'Has a clear, stable sense of professional purpose — decisions and priorities align naturally.',
    low: 'Purpose feels elusive or underdeveloped — work may feel productive but not deeply directional.',
    action_high: 'Purpose clarity is rare — use it as a filter for every major professional decision. If it doesn\'t serve the purpose, it\'s a distraction.',
    action_low: 'Ask yourself: at the end of this chapter of your career, what would need to be true for it to have mattered? Start there.',
  },
  'confidence-under-pressure': {
    title: 'Confidence Under Pressure',
    description: 'Ability to maintain self-belief and decisive action when stakes are high or circumstances are unfavourable.',
    high: 'Confidence holds under pressure — performance and communication remain clear when it counts most.',
    low: 'Confidence is pressure-sensitive — self-doubt tends to surface when it is least useful.',
    action_high: 'Your pressure composure signals genuine self-belief, not just surface confidence — it will compound over time in visible ways.',
    action_low: 'Build a short evidence file: 5 moments where you performed well under pressure. Read it before the next high-stakes situation.',
  },
  'opportunity-anxiety': {
    title: 'Opportunity Anxiety',
    description: 'Ability to evaluate and act on professional opportunities without being paralysed by the weight of the decision.',
    high: 'Evaluates opportunities with clear criteria and acts decisively — neither impulsive nor paralysed.',
    low: 'Opportunity decisions generate disproportionate anxiety — fear of wrong choice may cause inaction.',
    action_high: 'Your opportunity calibration is sound — trust it and move faster. You tend to over-research what you already know.',
    action_low: 'The next time a meaningful opportunity appears, give yourself 72 hours to decide. Most of what feels like risk is actually just unfamiliarity.',
  },
  'leadership-identity': {
    title: 'Leadership Identity',
    description: 'Degree to which one sees themselves as a leader and acts from that identity in professional contexts.',
    high: 'Holds a clear, secure leadership identity — acts from a place of agency and positional ownership.',
    low: 'Leadership identity is still developing — may underplay influence or defer when ownership is needed.',
    action_high: 'Your leadership identity is established — stretch it into more visible contexts where your presence and perspective carry weight.',
    action_low: 'Identify one situation this week where you defaulted to waiting. Step into it instead. Leadership identity is built by taking up more space, consistently.',
  },
  'workplace-effectiveness': {
    title: 'Workplace Effectiveness',
    description: 'Overall capacity to produce results, navigate dynamics, and operate at a high level within an organisation.',
    high: 'Demonstrates strong overall workplace effectiveness — results-oriented, politically astute, and consistently high-impact.',
    low: 'Workplace effectiveness is constrained — specific patterns are reducing impact below actual capability.',
    action_high: 'Your effectiveness is a genuine differentiator — now focus on the few high-leverage situations where your output compounds across the team.',
    action_low: 'Identify the one habit, relationship, or pattern that is most limiting your workplace impact right now. Start there — not everywhere.',
  },
};

/**
 * Return an intelligence insight object for a given subdomain name and score.
 * Falls back to a generic description if the subdomain is not in the registry.
 */
export function getSubdomainInsight(
  subdomain: string,
  score: number,
): { title: string; description: string; insight: string; action: string } {
  const key = subdomain.toLowerCase().replace(/\s+/g, '-');
  const entry = SUBDOMAIN_DESCRIPTIONS[key];

  if (entry) {
    return {
      title: entry.title,
      description: entry.description,
      insight: score >= 65 ? entry.high : entry.low,
      action: score >= 65 ? entry.action_high : entry.action_low,
    };
  }

  // Generic fallback
  const levelKey = score >= 65 ? 'Proficient' : score >= 40 ? 'Developing' : 'Emerging';
  const generics: Record<string, string> = {
    Proficient: `Strong ${subdomain} — a clear behavioural asset in this profile.`,
    Developing: `${subdomain} is developing — targeted focus here will accelerate meaningful progress.`,
    Emerging: `${subdomain} shows the most room for growth in this profile — and is highly responsive to focused effort.`,
  };
  const genericActions: Record<string, string> = {
    Proficient: `Keep using this strength deliberately — apply it in situations where it creates the most impact.`,
    Developing: `Pick one small action this week that directly engages ${subdomain}. Consistency matters more than intensity.`,
    Emerging: `Identify the single most concrete next step you can take in ${subdomain} this week. One well-chosen action builds more momentum than a broad plan.`,
  };
  return {
    title: subdomain,
    description: `Behavioural competency score for ${subdomain}.`,
    insight: generics[levelKey],
    action: genericActions[levelKey],
  };
}

/**
 * Build a behavioural pattern profile from domain results.
 * Returns top strengths, growth areas, and a composite profile summary.
 */
export function buildPatternProfile(domains: DomainResult[]): {
  strengths: DomainResult[];
  growthAreas: DomainResult[];
  profileSummary: string;
  compositeScore: number;
} {
  if (!domains.length) {
    return { strengths: [], growthAreas: [], profileSummary: 'Insufficient data.', compositeScore: 0 };
  }

  // DomainResult uses `score` (raw) and `percentage` (0-100) and `label` for name
  const sorted = [...domains].sort((a, b) => b.percentage - a.percentage);
  const strengths = sorted.filter(d => d.percentage >= 65).slice(0, 3);
  const growthAreas = sorted.filter(d => d.percentage < 50).slice(0, 3);
  const compositeScore = Math.round(domains.reduce((s, d) => s + d.percentage, 0) / domains.length);
  const { level } = getLevel(compositeScore);

  const profileSummary = strengths.length
    ? `${level} profile. Key strengths in ${strengths.map(d => d.label).join(', ')}. ${
        growthAreas.length
          ? `Focus areas: ${growthAreas.map(d => d.label).join(', ')}.`
          : 'No critical growth areas detected.'
      }`
    : `${level} profile — developing across all domains.`;

  return { strengths, growthAreas, profileSummary, compositeScore };
}

/**
 * Detect behavioural patterns from domain results.
 * Returns pattern flags indicating the user's overall orientation.
 */
export function generatePatternDetection(domains: DomainResult[]): {
  dominantPattern: string;
  riskFlags: string[];
  growthIndicators: string[];
  patternConfidence: 'high' | 'medium' | 'low';
} {
  if (!domains.length) {
    return { dominantPattern: 'Insufficient data', riskFlags: [], growthIndicators: [], patternConfidence: 'low' };
  }

  const avg = domains.reduce((s, d) => s + d.percentage, 0) / domains.length;
  const highDomains = domains.filter(d => d.percentage >= 70);
  const lowDomains  = domains.filter(d => d.percentage < 40);
  const midDomains  = domains.filter(d => d.percentage >= 40 && d.percentage < 70);

  const riskFlags: string[] = [];
  if (lowDomains.length >= 3) riskFlags.push('broad_development_gap');
  if (avg < 40) riskFlags.push('overall_low_engagement');
  const scoreVariance = Math.max(...domains.map(d => d.percentage)) - Math.min(...domains.map(d => d.percentage));
  if (scoreVariance > 40) riskFlags.push('high_score_volatility');

  const growthIndicators: string[] = [];
  if (highDomains.length >= 2) growthIndicators.push('multiple_strength_anchors');
  if (midDomains.length >= 4) growthIndicators.push('broad_development_potential');
  if (avg >= 55 && avg < 70) growthIndicators.push('emerging_competency_cluster');

  const dominantPattern = avg >= 70
    ? 'Advanced — consistent high performance across domains'
    : avg >= 55
    ? 'Developing — competency building with identifiable strengths'
    : avg >= 40
    ? 'Building — clear growth pathways identified across key domains'
    : 'Emerging — significant growth potential across the profile';

  const patternConfidence: 'high' | 'medium' | 'low' =
    domains.length >= 8 ? 'high' : domains.length >= 4 ? 'medium' : 'low';

  return { dominantPattern, riskFlags, growthIndicators, patternConfidence };
}

/**
 * Return valid age range and error label for a given persona + assesseeType.
 * Each persona has its own realistic min/max so, e.g., a 15-year-old cannot
 * pass as a Working Professional.
 *
 * Priority order:
 *  1. Assessee-type overrides (my-child, a-student) — persona-independent
 *  2. Persona-specific ranges for myself / someone-else
 *  3. Safe generic fallback
 */
export function getAgeRange(
  persona: string | null,
  aType: string,
): { min: number; max: number; label: string } {
  // ── Child / student being assessed by parent or teacher ──────────────────
  if (aType === 'my-child')
    return { min: 3, max: 25, label: "A child's age should be between 3 and 25." };
  if (aType === 'a-student')
    return { min: 4, max: 30, label: "A student's age should be between 4 and 30." };

  // ── Persona-specific ranges ───────────────────────────────────────────────
  switch (persona) {
    case 'professional':
      // Must be a real working adult — reject teenagers
      if (aType === 'myself')
        return { min: 20, max: 70, label: 'Working professionals must be between 20 and 70 years old.' };
      // Assessing a colleague / report
      return { min: 18, max: 70, label: 'The person being assessed must be between 18 and 70 years old.' };

    case 'teacher':
      if (aType === 'myself')
        return { min: 21, max: 70, label: 'Teachers / educators should be between 21 and 70 years old.' };
      // Could be assessing a student or a peer
      return { min: 4, max: 70, label: "The person's age should be between 4 and 70." };

    case 'campus':
      // University / college students (first-year undergrad to post-grad)
      return { min: 17, max: 30, label: 'Campus students should be between 17 and 30 years old.' };

    case 'jobseeker':
      // Ranges from first-time school-leaver to mid-career switcher
      return { min: 16, max: 65, label: 'Job seekers should be between 16 and 65 years old.' };

    case 'student':
      // School children through college graduates
      return { min: 5, max: 25, label: 'Student age should be between 5 and 25 years old.' };

    case 'parent':
      if (aType === 'myself')
        return { min: 18, max: 80, label: 'Please enter a valid age (18–80).' };
      // someone-else: they're describing another child / dependent
      return { min: 3, max: 25, label: "A child's age should be between 3 and 25." };

    default:
      break;
  }

  // ── Generic fallback ──────────────────────────────────────────────────────
  if (aType === 'myself') return { min: 5, max: 80, label: 'Please enter a valid age (5–80).' };
  return { min: 3, max: 80, label: 'Please enter a valid age (3–80).' };
}
