/**
 * Canonical Behavioural Construct Taxonomy — Frontend copy.
 * Source of truth lives in backend/data/behavioural-constructs.ts.
 * Keep in sync if constructs are added/renamed.
 */

export type ConstructCluster =
  | 'Cognitive'
  | 'Self-Regulation'
  | 'Emotional'
  | 'Mental Wellbeing'
  | 'Motivation'
  | 'Social'
  | 'Digital'
  | 'Academic'
  | 'Career'
  | 'Family & Environment';

export interface BehaviouralConstruct {
  key: string;
  label: string;
  cluster: ConstructCluster;
  description: string;
  color: string;
}

export const CONSTRUCTS: BehaviouralConstruct[] = [
  { key: 'ATTENTION_REGULATION', label: 'Attention Regulation',      cluster: 'Cognitive',              description: 'Ability to sustain, direct, and control attentional focus over time.',                          color: '#3B82F6' },
  { key: 'WORKING_MEMORY',       label: 'Working Memory',            cluster: 'Cognitive',              description: 'Capacity to hold and manipulate information in mind for short-term use.',                      color: '#6366F1' },
  { key: 'PROCESSING_SPEED',     label: 'Processing Speed',          cluster: 'Cognitive',              description: 'Rate at which cognitive tasks are completed accurately.',                                       color: '#8B5CF6' },
  { key: 'CRITICAL_THINKING',    label: 'Critical Thinking',         cluster: 'Cognitive',              description: 'Ability to analyse, evaluate, and apply reasoning to solve problems.',                         color: '#A855F7' },
  { key: 'CREATIVITY',           label: 'Creativity & Curiosity',    cluster: 'Cognitive',              description: 'Drive to generate novel ideas and explore beyond the known.',                                  color: '#D946EF' },
  { key: 'EXECUTIVE_FUNCTION',   label: 'Executive Function',        cluster: 'Self-Regulation',        description: 'Planning, organisation, time management, and goal-directed behaviour.',                        color: '#F59E0B' },
  { key: 'IMPULSE_CONTROL',      label: 'Impulse Control',           cluster: 'Self-Regulation',        description: 'Ability to resist immediate urges in favour of longer-term outcomes.',                         color: '#EF4444' },
  { key: 'PROCRASTINATION',      label: 'Procrastination',           cluster: 'Self-Regulation',        description: 'Chronic delay of important tasks despite intention and awareness.',                             color: '#F97316' },
  { key: 'HABIT_FORMATION',      label: 'Habit Formation',           cluster: 'Self-Regulation',        description: 'Capacity to build and sustain consistent behavioural routines.',                               color: '#84CC16' },
  { key: 'ANXIETY',              label: 'Anxiety',                   cluster: 'Emotional',              description: 'Persistent fear, worry, or apprehension that interferes with functioning.',                    color: '#EC4899' },
  { key: 'EMOTIONAL_REGULATION', label: 'Emotional Regulation',      cluster: 'Emotional',              description: 'Ability to manage and modulate emotional responses appropriately.',                            color: '#F43F5E' },
  { key: 'SELF_ESTEEM',          label: 'Self-Esteem',               cluster: 'Emotional',              description: "Sense of self-worth and confidence in one's own abilities.",                                   color: '#FB7185' },
  { key: 'RESILIENCE',           label: 'Resilience',                cluster: 'Emotional',              description: 'Capacity to recover from setbacks and adapt to adversity.',                                    color: '#10B981' },
  { key: 'STRESS_MANAGEMENT',    label: 'Stress Management',         cluster: 'Mental Wellbeing',       description: 'Ability to cope with pressure, prevent burnout, and maintain equilibrium.',                    color: '#14B8A6' },
  { key: 'MENTAL_HEALTH',        label: 'Mental Health',             cluster: 'Mental Wellbeing',       description: 'Overall psychological wellbeing including mood stability and emotional health.',                 color: '#06B6D4' },
  { key: 'PHYSICAL_WELLBEING',   label: 'Physical Wellbeing',        cluster: 'Mental Wellbeing',       description: 'Sleep quality, energy regulation, physical activity, and nutritional habits.',                  color: '#0EA5E9' },
  { key: 'INTRINSIC_MOTIVATION', label: 'Intrinsic Motivation',      cluster: 'Motivation',             description: 'Internal drive to engage and persist without external pressure.',                              color: '#22C55E' },
  { key: 'GOAL_ORIENTATION',     label: 'Goal Orientation',          cluster: 'Motivation',             description: 'Ability to set meaningful goals and sustain effort toward them.',                              color: '#4ADE80' },
  { key: 'LEARNING_DRIVE',       label: 'Learning Drive',            cluster: 'Motivation',             description: 'Curiosity, openness, and enthusiasm for acquiring new knowledge.',                             color: '#86EFAC' },
  { key: 'COMMUNICATION',        label: 'Communication',             cluster: 'Social',                 description: 'Clarity, confidence, and effectiveness in expressing thoughts verbally and in writing.',        color: '#344E86' },
  { key: 'SOCIAL_CONFIDENCE',    label: 'Social Confidence',         cluster: 'Social',                 description: 'Ease and assertiveness in social situations and group environments.',                          color: '#4B6FBF' },
  { key: 'PEER_RELATIONS',       label: 'Peer Relations',            cluster: 'Social',                 description: 'Quality of relationships with peers, including teamwork and conflict navigation.',              color: '#60A5FA' },
  { key: 'SAFETY_THREATS',       label: 'Safety & Threat Exposure',  cluster: 'Social',                 description: 'Exposure to bullying (online or offline) and inappropriate content.',                          color: '#DC2626' },
  { key: 'DIGITAL_DEPENDENCY',   label: 'Digital Dependency',        cluster: 'Digital',                description: 'Compulsive or excessive use of digital devices and platforms.',                                color: '#7C3AED' },
  { key: 'DIGITAL_DISCIPLINE',   label: 'Digital Discipline',        cluster: 'Digital',                description: 'Ability to manage screen time and maintain healthy digital habits.',                           color: '#9333EA' },
  { key: 'EXAM_PERFORMANCE',     label: 'Exam Performance',          cluster: 'Academic',               description: 'Actual results and achievement levels in assessments and examinations.',                       color: '#0891B2' },
  { key: 'EXAM_READINESS',       label: 'Exam Readiness',            cluster: 'Academic',               description: 'Preparation quality, strategy, and execution during examination conditions.',                   color: '#0E7490' },
  { key: 'LEARNING_APPROACH',    label: 'Learning Approach',         cluster: 'Academic',               description: 'The quality and depth of learning strategies — from rote to deep understanding.',              color: '#155E75' },
  { key: 'ACADEMIC_RECOVERY',    label: 'Academic Recovery',         cluster: 'Academic',               description: 'Ability to regroup, re-strategise, and recover after academic setbacks.',                     color: '#1E3A5F' },
  { key: 'CAREER_CLARITY',       label: 'Career Clarity',            cluster: 'Career',                 description: 'Clarity about career direction, purpose, and aligned decision-making.',                        color: '#D97706' },
  { key: 'SKILL_AWARENESS',      label: 'Skill Awareness',           cluster: 'Career',                 description: "Understanding of one's actual skills, strengths, and employability gaps.",                    color: '#B45309' },
  { key: 'FAMILY_DYNAMICS',      label: 'Family Dynamics',           cluster: 'Family & Environment',   description: 'Quality of family communication, parenting patterns, and home environment.',                   color: '#78716C' },
];

export const CONSTRUCT_MAP: Record<string, BehaviouralConstruct> = Object.fromEntries(
  CONSTRUCTS.map(c => [c.key, c])
);

export const CLUSTERS: ConstructCluster[] = [
  'Cognitive', 'Self-Regulation', 'Emotional', 'Mental Wellbeing',
  'Motivation', 'Social', 'Digital', 'Academic', 'Career', 'Family & Environment',
];
