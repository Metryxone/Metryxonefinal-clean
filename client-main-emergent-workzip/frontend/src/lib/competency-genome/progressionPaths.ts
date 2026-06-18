/**
 * Competency Progression Paths
 * Named career trajectories showing ordered competency development sequences
 * mapped to career stages and role families.
 */

export type PathId =
  | 'engineering-track'
  | 'data-science-track'
  | 'product-track'
  | 'leadership-track'
  | 'design-track'
  | 'consulting-track'
  | 'full-stack-track'
  | 'security-track'
  | 'marketing-tech-track'
  | 'operations-track';

export interface ProgressionStep {
  competencyId: string;
  targetLevel:  1 | 2 | 3 | 4 | 5;
  stage:        'foundation' | 'growth' | 'proficiency' | 'mastery';
  rationale:    string;
  etaWeeks:     number;
}

export interface ProgressionPath {
  id:           PathId;
  label:        string;
  family:       string;
  description:  string;
  steps:        ProgressionStep[];
  peakRoles:    string[];    // MarketRole IDs
  adjacentPaths:PathId[];
}

export const PROGRESSION_PATHS: ProgressionPath[] = [
  {
    id: 'engineering-track', label: 'Software Engineering', family: 'Engineering',
    description: 'Foundation → specialised technical depth → system-level leadership',
    adjacentPaths: ['full-stack-track', 'security-track', 'data-science-track'],
    peakRoles:    ['be-engineer', 'cloud-architect', 'staff-engineer'],
    steps: [
      { competencyId: 'programming',    targetLevel: 3, stage: 'foundation',   rationale: 'Core programming fluency across 2+ languages', etaWeeks: 16 },
      { competencyId: 'collaboration',  targetLevel: 3, stage: 'foundation',   rationale: 'Team code reviews and pair programming habits', etaWeeks: 8  },
      { competencyId: 'process',        targetLevel: 2, stage: 'foundation',   rationale: 'Agile, Git workflow, CI basics', etaWeeks: 8 },
      { competencyId: 'programming',    targetLevel: 4, stage: 'growth',       rationale: 'Deep expertise in primary language/stack', etaWeeks: 20 },
      { competencyId: 'systems-design', targetLevel: 3, stage: 'growth',       rationale: 'Distributed systems, scaling patterns', etaWeeks: 20 },
      { competencyId: 'cloud',          targetLevel: 3, stage: 'growth',       rationale: 'AWS/GCP deployment, containerisation', etaWeeks: 16 },
      { competencyId: 'systems-design', targetLevel: 4, stage: 'proficiency',  rationale: 'Architecture docs, tech design ownership', etaWeeks: 24 },
      { competencyId: 'security',       targetLevel: 3, stage: 'proficiency',  rationale: 'Secure design, threat modelling', etaWeeks: 20 },
      { competencyId: 'mentoring',      targetLevel: 2, stage: 'proficiency',  rationale: 'Junior engineer onboarding and code review', etaWeeks: 16 },
      { competencyId: 'systems-design', targetLevel: 5, stage: 'mastery',      rationale: 'Org-wide technical direction, RFC authoring', etaWeeks: 32 },
      { competencyId: 'strategy',       targetLevel: 2, stage: 'mastery',      rationale: 'Engineering strategy and roadmap input', etaWeeks: 20 },
      { competencyId: 'people-mgmt',    targetLevel: 2, stage: 'mastery',      rationale: 'Leading a small engineering squad', etaWeeks: 24 },
    ],
  },
  {
    id: 'data-science-track', label: 'Data Science & AI', family: 'Data',
    description: 'Analytics foundation → ML expertise → AI leadership',
    adjacentPaths: ['engineering-track', 'consulting-track'],
    peakRoles:    ['ds', 'ml-engineer', 'bi-analyst'],
    steps: [
      { competencyId: 'data-analysis',   targetLevel: 3, stage: 'foundation',   rationale: 'SQL, pandas, descriptive statistics', etaWeeks: 12 },
      { competencyId: 'programming',     targetLevel: 2, stage: 'foundation',   rationale: 'Python for data manipulation', etaWeeks: 12 },
      { competencyId: 'research',        targetLevel: 2, stage: 'foundation',   rationale: 'Literature review, experimental design', etaWeeks: 8 },
      { competencyId: 'statistics',      targetLevel: 3, stage: 'growth',       rationale: 'Probability, A/B testing, regression', etaWeeks: 20 },
      { competencyId: 'data-engineering',targetLevel: 2, stage: 'growth',       rationale: 'Pipelines, warehouses, ETL patterns', etaWeeks: 16 },
      { competencyId: 'storytelling',    targetLevel: 2, stage: 'growth',       rationale: 'Data narrative for non-technical stakeholders', etaWeeks: 10 },
      { competencyId: 'statistics',      targetLevel: 4, stage: 'proficiency',  rationale: 'Deep ML: NLP, CV, time-series', etaWeeks: 28 },
      { competencyId: 'business-acumen', targetLevel: 3, stage: 'proficiency',  rationale: 'Frame ML problems as business impact', etaWeeks: 14 },
      { competencyId: 'statistics',      targetLevel: 5, stage: 'mastery',      rationale: 'Novel model research, LLM fine-tuning', etaWeeks: 36 },
      { competencyId: 'strategy',        targetLevel: 2, stage: 'mastery',      rationale: 'AI strategy for product/org', etaWeeks: 20 },
    ],
  },
  {
    id: 'leadership-track', label: 'People & Org Leadership', family: 'Leadership',
    description: 'Individual contributor → team lead → org strategist',
    adjacentPaths: ['product-track', 'consulting-track', 'operations-track'],
    peakRoles:    ['eng-manager', 'product-director', 'vp-eng'],
    steps: [
      { competencyId: 'collaboration',   targetLevel: 3, stage: 'foundation',   rationale: 'Cross-functional project collaboration', etaWeeks: 8 },
      { competencyId: 'presentation',    targetLevel: 3, stage: 'foundation',   rationale: 'Clear communication to diverse audiences', etaWeeks: 10 },
      { competencyId: 'drive',           targetLevel: 3, stage: 'foundation',   rationale: 'Ownership of outcomes, not just tasks', etaWeeks: 8 },
      { competencyId: 'mentoring',       targetLevel: 3, stage: 'growth',       rationale: 'Formal mentoring of 2+ team members', etaWeeks: 16 },
      { competencyId: 'stakeholder-mgmt',targetLevel: 3, stage: 'growth',       rationale: 'Managing expectations across levels', etaWeeks: 16 },
      { competencyId: 'business-acumen', targetLevel: 3, stage: 'growth',       rationale: 'P&L awareness, OKR fluency', etaWeeks: 14 },
      { competencyId: 'people-mgmt',     targetLevel: 3, stage: 'proficiency',  rationale: 'Performance reviews, hiring, team design', etaWeeks: 24 },
      { competencyId: 'negotiation',     targetLevel: 3, stage: 'proficiency',  rationale: 'Executive alignment and resourcing', etaWeeks: 16 },
      { competencyId: 'strategy',        targetLevel: 3, stage: 'proficiency',  rationale: '3-year roadmap, organisational vision', etaWeeks: 28 },
      { competencyId: 'strategy',        targetLevel: 5, stage: 'mastery',      rationale: 'Board-level strategy, M&A, transformation', etaWeeks: 48 },
      { competencyId: 'people-mgmt',     targetLevel: 5, stage: 'mastery',      rationale: 'Leading leaders, culture shaping', etaWeeks: 40 },
    ],
  },
  {
    id: 'product-track', label: 'Product Management', family: 'Product',
    description: 'Feature ownership → product strategy → market leadership',
    adjacentPaths: ['leadership-track', 'data-science-track', 'design-track'],
    peakRoles:    ['product-manager', 'product-director'],
    steps: [
      { competencyId: 'data-analysis',   targetLevel: 2, stage: 'foundation',   rationale: 'Product metrics, funnel analysis', etaWeeks: 10 },
      { competencyId: 'research',        targetLevel: 3, stage: 'foundation',   rationale: 'User research, competitive analysis', etaWeeks: 10 },
      { competencyId: 'writing',         targetLevel: 3, stage: 'foundation',   rationale: 'PRDs, specs, release notes', etaWeeks: 8 },
      { competencyId: 'business-acumen', targetLevel: 3, stage: 'growth',       rationale: 'Revenue models, pricing, market sizing', etaWeeks: 14 },
      { competencyId: 'stakeholder-mgmt',targetLevel: 3, stage: 'growth',       rationale: 'Engineering, design, exec alignment', etaWeeks: 14 },
      { competencyId: 'design-thinking', targetLevel: 3, stage: 'growth',       rationale: 'User-centred problem framing', etaWeeks: 10 },
      { competencyId: 'strategy',        targetLevel: 3, stage: 'proficiency',  rationale: 'Product vision, multi-quarter roadmap', etaWeeks: 24 },
      { competencyId: 'storytelling',    targetLevel: 3, stage: 'proficiency',  rationale: 'Investor and exec narratives', etaWeeks: 12 },
      { competencyId: 'strategy',        targetLevel: 5, stage: 'mastery',      rationale: 'Platform strategy, market creation', etaWeeks: 40 },
    ],
  },
  {
    id: 'design-track', label: 'UX / Product Design', family: 'Design',
    description: 'Visual execution → UX craft → design systems leadership',
    adjacentPaths: ['product-track', 'marketing-tech-track'],
    peakRoles:    ['ux-designer', 'design-director'],
    steps: [
      { competencyId: 'design-thinking', targetLevel: 3, stage: 'foundation',   rationale: 'Empathy mapping, How Might We, ideation', etaWeeks: 8 },
      { competencyId: 'visual-design',   targetLevel: 3, stage: 'foundation',   rationale: 'Figma proficiency, typography, layout', etaWeeks: 14 },
      { competencyId: 'research',        targetLevel: 2, stage: 'foundation',   rationale: 'Usability testing, interview synthesis', etaWeeks: 8 },
      { competencyId: 'visual-design',   targetLevel: 4, stage: 'growth',       rationale: 'Design systems, component libraries', etaWeeks: 18 },
      { competencyId: 'storytelling',    targetLevel: 3, stage: 'growth',       rationale: 'Design critiques, case study narration', etaWeeks: 10 },
      { competencyId: 'presentation',    targetLevel: 3, stage: 'growth',       rationale: 'Stakeholder design reviews', etaWeeks: 10 },
      { competencyId: 'visual-design',   targetLevel: 5, stage: 'proficiency',  rationale: 'Org-wide design language, brand system', etaWeeks: 24 },
      { competencyId: 'strategy',        targetLevel: 2, stage: 'mastery',      rationale: 'Design strategy, cross-product coherence', etaWeeks: 20 },
    ],
  },
  {
    id: 'consulting-track', label: 'Consulting & Advisory', family: 'Consulting',
    description: 'Analysis → client delivery → thought leadership',
    adjacentPaths: ['leadership-track', 'product-track', 'data-science-track'],
    peakRoles:    ['strategy-consultant', 'management-consultant'],
    steps: [
      { competencyId: 'research',        targetLevel: 3, stage: 'foundation',   rationale: 'Secondary research, benchmark studies', etaWeeks: 10 },
      { competencyId: 'data-analysis',   targetLevel: 3, stage: 'foundation',   rationale: 'Excel modelling, data-driven insights', etaWeeks: 12 },
      { competencyId: 'writing',         targetLevel: 3, stage: 'foundation',   rationale: 'Crisp slide writing, executive summary', etaWeeks: 8 },
      { competencyId: 'business-acumen', targetLevel: 4, stage: 'growth',       rationale: 'Industry analysis, value chain mapping', etaWeeks: 16 },
      { competencyId: 'presentation',    targetLevel: 4, stage: 'growth',       rationale: 'C-suite presentations, pyramid principle', etaWeeks: 12 },
      { competencyId: 'storytelling',    targetLevel: 3, stage: 'growth',       rationale: 'SCQA narrative, engagement management', etaWeeks: 10 },
      { competencyId: 'strategy',        targetLevel: 4, stage: 'proficiency',  rationale: 'Transformation roadmaps, operating model', etaWeeks: 28 },
      { competencyId: 'negotiation',     targetLevel: 3, stage: 'proficiency',  rationale: 'Scope management, proposal negotiation', etaWeeks: 14 },
      { competencyId: 'strategy',        targetLevel: 5, stage: 'mastery',      rationale: 'Practice leadership, IP development', etaWeeks: 48 },
    ],
  },
  {
    id: 'full-stack-track', label: 'Full-Stack Engineering', family: 'Engineering',
    description: 'Frontend + backend depth → product-aware engineering',
    adjacentPaths: ['engineering-track', 'product-track', 'design-track'],
    peakRoles:    ['fullstack-engineer', 'fe-engineer', 'be-engineer'],
    steps: [
      { competencyId: 'programming',    targetLevel: 3, stage: 'foundation',   rationale: 'JS/TS + one backend language', etaWeeks: 14 },
      { competencyId: 'visual-design',  targetLevel: 2, stage: 'foundation',   rationale: 'CSS layouts, responsive design basics', etaWeeks: 8 },
      { competencyId: 'programming',    targetLevel: 4, stage: 'growth',       rationale: 'React + Node.js or equivalent full depth', etaWeeks: 20 },
      { competencyId: 'systems-design', targetLevel: 3, stage: 'growth',       rationale: 'API design, DB schema, caching strategy', etaWeeks: 18 },
      { competencyId: 'cloud',          targetLevel: 2, stage: 'growth',       rationale: 'Deploy, monitor, CI/CD pipelines', etaWeeks: 12 },
      { competencyId: 'design-thinking',targetLevel: 2, stage: 'proficiency',  rationale: 'UX intuition, front-end empathy', etaWeeks: 8 },
      { competencyId: 'systems-design', targetLevel: 4, stage: 'proficiency',  rationale: 'Tech lead on product features', etaWeeks: 22 },
    ],
  },
  {
    id: 'security-track', label: 'Cybersecurity', family: 'Engineering',
    description: 'Systems fluency → threat modelling → security architecture',
    adjacentPaths: ['engineering-track', 'operations-track'],
    peakRoles:    ['security-engineer'],
    steps: [
      { competencyId: 'programming',    targetLevel: 2, stage: 'foundation',   rationale: 'Scripting, reverse engineering basics', etaWeeks: 12 },
      { competencyId: 'systems-design', targetLevel: 2, stage: 'foundation',   rationale: 'Network architecture, protocol understanding', etaWeeks: 14 },
      { competencyId: 'security',       targetLevel: 3, stage: 'growth',       rationale: 'OWASP, pen testing basics, IAM', etaWeeks: 20 },
      { competencyId: 'cloud',          targetLevel: 3, stage: 'growth',       rationale: 'Cloud security posture management', etaWeeks: 16 },
      { competencyId: 'security',       targetLevel: 5, stage: 'proficiency',  rationale: 'Red team operations, zero-day research', etaWeeks: 32 },
      { competencyId: 'process',        targetLevel: 3, stage: 'proficiency',  rationale: 'Incident response, compliance frameworks', etaWeeks: 14 },
    ],
  },
  {
    id: 'marketing-tech-track', label: 'Marketing & Growth', family: 'Marketing',
    description: 'Campaign execution → data-driven growth → brand strategy',
    adjacentPaths: ['product-track', 'design-track', 'consulting-track'],
    peakRoles:    ['marketing-manager'],
    steps: [
      { competencyId: 'writing',         targetLevel: 3, stage: 'foundation',   rationale: 'Copywriting, SEO content, email campaigns', etaWeeks: 8 },
      { competencyId: 'data-analysis',   targetLevel: 2, stage: 'foundation',   rationale: 'GA4, campaign analytics, attribution', etaWeeks: 10 },
      { competencyId: 'design-thinking', targetLevel: 2, stage: 'foundation',   rationale: 'Customer empathy, persona development', etaWeeks: 8 },
      { competencyId: 'business-acumen', targetLevel: 3, stage: 'growth',       rationale: 'Budget management, ROI analysis', etaWeeks: 12 },
      { competencyId: 'storytelling',    targetLevel: 3, stage: 'growth',       rationale: 'Brand narrative, campaign storytelling', etaWeeks: 10 },
      { competencyId: 'strategy',        targetLevel: 2, stage: 'proficiency',  rationale: 'Go-to-market strategy, brand positioning', etaWeeks: 18 },
      { competencyId: 'stakeholder-mgmt',targetLevel: 2, stage: 'proficiency',  rationale: 'Agency management, cross-functional campaigns', etaWeeks: 14 },
    ],
  },
  {
    id: 'operations-track', label: 'Operations & Excellence', family: 'Operations',
    description: 'Process mastery → operational efficiency → org excellence',
    adjacentPaths: ['leadership-track', 'consulting-track', 'engineering-track'],
    peakRoles:    ['ops-manager', 'coo'],
    steps: [
      { competencyId: 'process',         targetLevel: 3, stage: 'foundation',   rationale: 'Lean, Six Sigma, SOPs', etaWeeks: 10 },
      { competencyId: 'data-analysis',   targetLevel: 2, stage: 'foundation',   rationale: 'Operational KPIs, dashboards', etaWeeks: 10 },
      { competencyId: 'project-mgmt',    targetLevel: 3, stage: 'growth',       rationale: 'Cross-team initiative management', etaWeeks: 14 },
      { competencyId: 'business-acumen', targetLevel: 3, stage: 'growth',       rationale: 'Cost analysis, vendor management', etaWeeks: 12 },
      { competencyId: 'negotiation',     targetLevel: 3, stage: 'proficiency',  rationale: 'Procurement, SLA negotiation', etaWeeks: 16 },
      { competencyId: 'strategy',        targetLevel: 3, stage: 'proficiency',  rationale: 'Operating model design, scale planning', etaWeeks: 22 },
      { competencyId: 'people-mgmt',     targetLevel: 3, stage: 'mastery',      rationale: 'Ops org leadership, culture', etaWeeks: 24 },
    ],
  },
];

const PATH_MAP = new Map<PathId, ProgressionPath>(PROGRESSION_PATHS.map(p => [p.id, p]));

export function getPath(id: PathId): ProgressionPath | undefined {
  return PATH_MAP.get(id);
}

/** Find the most suitable progression path for a given set of competency levels. */
export function detectBestPath(
  levels: Record<string, number>,
  roleFamily?: string,
): ProgressionPath {
  let best = PROGRESSION_PATHS[0];
  let bestScore = -1;

  PROGRESSION_PATHS.forEach(path => {
    let score = 0;
    path.steps.forEach(step => {
      const lvl = levels[step.competencyId] ?? 0;
      if (lvl >= step.targetLevel) score += 3;
      else if (lvl > 0)            score += 1;
    });
    if (roleFamily && path.family.toLowerCase() === roleFamily.toLowerCase()) score += 5;
    if (score > bestScore) { bestScore = score; best = path; }
  });

  return best;
}

/** Progress percentage through a named path. */
export function computePathProgress(
  pathId: PathId,
  levels: Record<string, number>,
): { pct: number; completedSteps: number; totalSteps: number; nextStep: ProgressionStep | null } {
  const path = PATH_MAP.get(pathId);
  if (!path) return { pct: 0, completedSteps: 0, totalSteps: 0, nextStep: null };

  const completed = path.steps.filter(s => (levels[s.competencyId] ?? 0) >= s.targetLevel).length;
  const next      = path.steps.find(s => (levels[s.competencyId] ?? 0) < s.targetLevel) ?? null;

  return {
    pct: Math.round((completed / Math.max(1, path.steps.length)) * 100),
    completedSteps: completed,
    totalSteps: path.steps.length,
    nextStep: next,
  };
}
