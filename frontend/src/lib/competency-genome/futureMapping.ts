/**
 * Future Competency Mapping
 * Projects competency relevance over 1, 3, and 5 year horizons.
 * Based on AI impact, automation trends, and workforce intelligence.
 */

export type GrowthTrajectory = 'hot' | 'rising' | 'stable' | 'declining';
export type AIImpact         = 'augments' | 'replaces' | 'neutral' | 'creates';

export interface FutureCompetencySignal {
  competencyId:      string;
  relevanceNow:      number;  // 0-100
  relevanceIn1Yr:    number;  // 0-100
  relevanceIn3Yr:    number;  // 0-100
  relevanceIn5Yr:    number;  // 0-100
  growthTrajectory:  GrowthTrajectory;
  aiImpact:          AIImpact;
  aiImpactNote:      string;
  emergingSignals:   string[];
  salaryPremium1Yr:  number;  // % premium vs average
  demandDrivers:     string[];
}

export const FUTURE_COMPETENCY_MAP: FutureCompetencySignal[] = [
  {
    competencyId: 'programming', relevanceNow: 94, relevanceIn1Yr: 90, relevanceIn3Yr: 82, relevanceIn5Yr: 72,
    growthTrajectory: 'stable', aiImpact: 'augments',
    aiImpactNote: 'AI coding assistants raise bar but do not replace — shifts value to design, review, and architecture',
    emergingSignals: ['Vibe coding', 'AI-pair programming', 'LLM-native development'],
    salaryPremium1Yr: 18, demandDrivers: ['Software proliferation', 'API economy', 'Mobile-first products'],
  },
  {
    competencyId: 'systems-design', relevanceNow: 88, relevanceIn1Yr: 91, relevanceIn3Yr: 93, relevanceIn5Yr: 92,
    growthTrajectory: 'rising', aiImpact: 'augments',
    aiImpactNote: 'AI generates code but cannot yet architect systems — design judgment becomes premium',
    emergingSignals: ['AI-native architectures', 'Event-driven systems', 'Edge computing'],
    salaryPremium1Yr: 28, demandDrivers: ['Scale demands', 'Distributed systems growth', 'Cost of tech debt'],
  },
  {
    competencyId: 'cloud', relevanceNow: 86, relevanceIn1Yr: 90, relevanceIn3Yr: 92, relevanceIn5Yr: 90,
    growthTrajectory: 'rising', aiImpact: 'augments',
    aiImpactNote: 'AI workloads drive massive cloud infrastructure demand — cloud expertise at premium',
    emergingSignals: ['GPU cloud', 'Serverless AI', 'Multi-cloud governance', 'FinOps'],
    salaryPremium1Yr: 25, demandDrivers: ['AI infrastructure', 'Digital transformation', 'Cloud migration wave'],
  },
  {
    competencyId: 'data-engineering', relevanceNow: 84, relevanceIn1Yr: 90, relevanceIn3Yr: 94, relevanceIn5Yr: 96,
    growthTrajectory: 'hot', aiImpact: 'creates',
    aiImpactNote: 'AI models need clean data — data engineering becomes the foundation of the AI economy',
    emergingSignals: ['Data mesh', 'Lakehouse architecture', 'Streaming AI pipelines', 'Vector databases'],
    salaryPremium1Yr: 30, demandDrivers: ['AI adoption', 'Data monetisation', 'Real-time analytics'],
  },
  {
    competencyId: 'security', relevanceNow: 89, relevanceIn1Yr: 93, relevanceIn3Yr: 96, relevanceIn5Yr: 97,
    growthTrajectory: 'hot', aiImpact: 'creates',
    aiImpactNote: 'AI creates new attack surfaces — cybersecurity demand grows exponentially',
    emergingSignals: ['AI adversarial attacks', 'Zero-trust architecture', 'Quantum cryptography', 'AI governance'],
    salaryPremium1Yr: 35, demandDrivers: ['Cyber threat escalation', 'Regulation (DPDP, GDPR)', 'AI risk'],
  },
  {
    competencyId: 'data-analysis', relevanceNow: 85, relevanceIn1Yr: 83, relevanceIn3Yr: 78, relevanceIn5Yr: 68,
    growthTrajectory: 'stable', aiImpact: 'augments',
    aiImpactNote: 'AI automates routine analysis — value shifts to interpretation, judgment, and framing',
    emergingSignals: ['NL-to-SQL tools', 'AI analytics copilots', 'Embedded analytics'],
    salaryPremium1Yr: 12, demandDrivers: ['Data democratisation', 'BI tooling growth', 'Decision intelligence'],
  },
  {
    competencyId: 'statistics', relevanceNow: 82, relevanceIn1Yr: 88, relevanceIn3Yr: 92, relevanceIn5Yr: 93,
    growthTrajectory: 'hot', aiImpact: 'creates',
    aiImpactNote: 'Foundation of AI/ML — statistical thinking is the most durable intellectual skill of the AI era',
    emergingSignals: ['Causal inference', 'Bayesian methods', 'LLM fine-tuning', 'AI alignment research'],
    salaryPremium1Yr: 32, demandDrivers: ['AI proliferation', 'Drug discovery', 'Quantitative finance'],
  },
  {
    competencyId: 'business-acumen', relevanceNow: 78, relevanceIn1Yr: 82, relevanceIn3Yr: 85, relevanceIn5Yr: 88,
    growthTrajectory: 'rising', aiImpact: 'augments',
    aiImpactNote: 'AI handles data crunching — human business judgment and contextual insight become scarce',
    emergingSignals: ['AI strategy', 'Digital business models', 'Platform economics'],
    salaryPremium1Yr: 20, demandDrivers: ['Digital transformation leadership', 'Monetisation complexity', 'Global markets'],
  },
  {
    competencyId: 'research', relevanceNow: 74, relevanceIn1Yr: 76, relevanceIn3Yr: 80, relevanceIn5Yr: 82,
    growthTrajectory: 'rising', aiImpact: 'augments',
    aiImpactNote: 'AI accelerates literature review but synthesis and experimental design remain human',
    emergingSignals: ['AI research tools', 'Rapid prototyping', 'Mixed methods', 'AI ethics research'],
    salaryPremium1Yr: 14, demandDrivers: ['Innovation imperative', 'UX research demand', 'R&D investment growth'],
  },
  {
    competencyId: 'writing', relevanceNow: 80, relevanceIn1Yr: 72, relevanceIn3Yr: 65, relevanceIn5Yr: 58,
    growthTrajectory: 'declining', aiImpact: 'replaces',
    aiImpactNote: 'LLMs handle routine writing — value shifts to judgment, voice, and high-stakes communication',
    emergingSignals: ['AI editing tools', 'Ghost-writing AI', 'Prompt engineering'],
    salaryPremium1Yr: 5, demandDrivers: ['Content demand', 'Documentation', 'Legal/regulatory writing'],
  },
  {
    competencyId: 'presentation', relevanceNow: 82, relevanceIn1Yr: 82, relevanceIn3Yr: 84, relevanceIn5Yr: 85,
    growthTrajectory: 'stable', aiImpact: 'augments',
    aiImpactNote: 'AI creates slides but cannot read the room — live presence and Q&A remain irreplaceable',
    emergingSignals: ['AI slide generators', 'Virtual keynotes', 'Holographic presentations'],
    salaryPremium1Yr: 15, demandDrivers: ['Executive communication', 'Remote-first work', 'Investor relations'],
  },
  {
    competencyId: 'stakeholder-mgmt', relevanceNow: 76, relevanceIn1Yr: 80, relevanceIn3Yr: 84, relevanceIn5Yr: 86,
    growthTrajectory: 'rising', aiImpact: 'neutral',
    aiImpactNote: 'Human trust and political navigation cannot be automated — influence becomes premium',
    emergingSignals: ['AI governance stakeholders', 'ESG pressure groups', 'Distributed decision-making'],
    salaryPremium1Yr: 22, demandDrivers: ['Organisational complexity', 'Global stakeholder needs', 'Board expectations'],
  },
  {
    competencyId: 'people-mgmt', relevanceNow: 74, relevanceIn1Yr: 76, relevanceIn3Yr: 80, relevanceIn5Yr: 82,
    growthTrajectory: 'rising', aiImpact: 'neutral',
    aiImpactNote: 'Managing human-AI hybrid teams requires evolved leadership capability',
    emergingSignals: ['AI team integration', 'Remote leadership', 'Psychological safety at scale'],
    salaryPremium1Yr: 20, demandDrivers: ['Talent scarcity', 'Manager effectiveness studies', 'Hybrid work models'],
  },
  {
    competencyId: 'strategy', relevanceNow: 76, relevanceIn1Yr: 80, relevanceIn3Yr: 86, relevanceIn5Yr: 90,
    growthTrajectory: 'hot', aiImpact: 'augments',
    aiImpactNote: 'AI disruption makes strategic thinking the most premium executive capability',
    emergingSignals: ['AI transformation strategy', 'Platform strategy', 'Geopolitical business risk'],
    salaryPremium1Yr: 35, demandDrivers: ['Digital disruption', 'Market volatility', 'AI transformation needs'],
  },
  {
    competencyId: 'mentoring', relevanceNow: 68, relevanceIn1Yr: 72, relevanceIn3Yr: 76, relevanceIn5Yr: 80,
    growthTrajectory: 'rising', aiImpact: 'neutral',
    aiImpactNote: 'AI coaches assist but human mentoring of junior AI-era professionals grows in importance',
    emergingSignals: ['Reverse mentoring on AI', 'AI skill development coaching', 'Peer coaching circles'],
    salaryPremium1Yr: 15, demandDrivers: ['Talent development ROI', 'Succession planning', 'Knowledge transfer'],
  },
  {
    competencyId: 'design-thinking', relevanceNow: 78, relevanceIn1Yr: 82, relevanceIn3Yr: 88, relevanceIn5Yr: 90,
    growthTrajectory: 'hot', aiImpact: 'augments',
    aiImpactNote: 'AI generates options but human empathy drives the right problems — DT becomes the AI filter',
    emergingSignals: ['Human-centred AI design', 'Responsible AI', 'Co-creation with AI tools'],
    salaryPremium1Yr: 20, demandDrivers: ['Innovation culture', 'UX maturity', 'AI product design needs'],
  },
  {
    competencyId: 'visual-design', relevanceNow: 72, relevanceIn1Yr: 68, relevanceIn3Yr: 60, relevanceIn5Yr: 55,
    growthTrajectory: 'declining', aiImpact: 'replaces',
    aiImpactNote: 'Generative AI handles asset creation — value shifts to creative direction and brand judgment',
    emergingSignals: ['Midjourney / DALL-E 3', 'Motion AI', 'AI-generated UI components'],
    salaryPremium1Yr: 8, demandDrivers: ['Brand differentiation', 'Game design', 'Physical product design'],
  },
  {
    competencyId: 'storytelling', relevanceNow: 76, relevanceIn1Yr: 78, relevanceIn3Yr: 82, relevanceIn5Yr: 86,
    growthTrajectory: 'rising', aiImpact: 'augments',
    aiImpactNote: 'Authentic human narrative is increasingly valued as AI content floods the world',
    emergingSignals: ['AI-augmented content creation', 'Podcast/video growth', 'Brand storytelling'],
    salaryPremium1Yr: 18, demandDrivers: ['Content saturation forces quality', 'Exec communication premium', 'Brand trust'],
  },
  {
    competencyId: 'project-mgmt', relevanceNow: 75, relevanceIn1Yr: 72, relevanceIn3Yr: 65, relevanceIn5Yr: 58,
    growthTrajectory: 'stable', aiImpact: 'augments',
    aiImpactNote: 'AI automates status tracking and scheduling — PM value shifts to risk judgment and stakeholder navigation',
    emergingSignals: ['AI PM tools (Linear AI, Asana AI)', 'Autonomous sprints', 'AI-generated project plans'],
    salaryPremium1Yr: 10, demandDrivers: ['Project complexity', 'Digital transformation programmes', 'M&A integration'],
  },
  {
    competencyId: 'process', relevanceNow: 72, relevanceIn1Yr: 68, relevanceIn3Yr: 62, relevanceIn5Yr: 55,
    growthTrajectory: 'declining', aiImpact: 'replaces',
    aiImpactNote: 'AI automates routine process optimisation — value is in human judgment for novel processes',
    emergingSignals: ['Process mining AI', 'Robotic process automation', 'AI workflow orchestration'],
    salaryPremium1Yr: 6, demandDrivers: ['Compliance requirements', 'Quality certifications', 'Manufacturing excellence'],
  },
  {
    competencyId: 'negotiation', relevanceNow: 72, relevanceIn1Yr: 74, relevanceIn3Yr: 78, relevanceIn5Yr: 80,
    growthTrajectory: 'rising', aiImpact: 'neutral',
    aiImpactNote: 'Human-to-human trust negotiation cannot be automated — rare and valuable',
    emergingSignals: ['AI negotiation advisors', 'Complex multi-party deals', 'Global procurement'],
    salaryPremium1Yr: 18, demandDrivers: ['Deal complexity', 'Vendor relationships', 'Labour negotiations'],
  },
  {
    competencyId: 'drive', relevanceNow: 88, relevanceIn1Yr: 90, relevanceIn3Yr: 92, relevanceIn5Yr: 94,
    growthTrajectory: 'hot', aiImpact: 'augments',
    aiImpactNote: 'AI empowers driven individuals exponentially — ownership mindset is the force multiplier',
    emergingSignals: ['Indie hacking', 'AI-native startups', 'One-person businesses at scale'],
    salaryPremium1Yr: 22, demandDrivers: ['Entrepreneurial economy', 'Intrapreneurship demand', 'Execution scarcity'],
  },
  {
    competencyId: 'collaboration', relevanceNow: 90, relevanceIn1Yr: 88, relevanceIn3Yr: 88, relevanceIn5Yr: 90,
    growthTrajectory: 'stable', aiImpact: 'augments',
    aiImpactNote: 'Async-first tools help but human collaboration quality remains a differentiator',
    emergingSignals: ['Human-AI collaboration', 'Cross-cultural remote work', 'Open source models'],
    salaryPremium1Yr: 14, demandDrivers: ['Remote work norm', 'Complex cross-functional orgs', 'Open innovation'],
  },
  {
    competencyId: 'resilience', relevanceNow: 84, relevanceIn1Yr: 88, relevanceIn3Yr: 92, relevanceIn5Yr: 94,
    growthTrajectory: 'hot', aiImpact: 'augments',
    aiImpactNote: 'AI era brings constant disruption — resilient professionals thrive while others burn out',
    emergingSignals: ['AI displacement anxiety', 'Burnout epidemic', 'Continuous learning demands'],
    salaryPremium1Yr: 18, demandDrivers: ['Pace of change', 'VUCA environments', 'Mental health awareness'],
  },
];

const FUTURE_MAP = new Map<string, FutureCompetencySignal>(FUTURE_COMPETENCY_MAP.map(f => [f.competencyId, f]));

export function getFutureSignal(competencyId: string): FutureCompetencySignal | undefined {
  return FUTURE_MAP.get(competencyId);
}

export function getRisingCompetencies(topN = 5): FutureCompetencySignal[] {
  return [...FUTURE_COMPETENCY_MAP]
    .sort((a, b) => b.relevanceIn3Yr - a.relevanceIn3Yr)
    .slice(0, topN);
}

export function getDecliningCompetencies(): FutureCompetencySignal[] {
  return FUTURE_COMPETENCY_MAP.filter(f => f.growthTrajectory === 'declining');
}

export function getFutureRelevanceScore(competencyId: string, yearsAhead: 1 | 3 | 5): number {
  const sig = FUTURE_MAP.get(competencyId);
  if (!sig) return 50;
  if (yearsAhead === 1) return sig.relevanceIn1Yr;
  if (yearsAhead === 3) return sig.relevanceIn3Yr;
  return sig.relevanceIn5Yr;
}

/** Score a user's portfolio against future demand (0-100). */
export function computeFutureReadinessScore(
  competencyLevels: Record<string, number>,
  horizon: 1 | 3 | 5 = 3,
): { score: number; hotCompetencies: string[]; riskCompetencies: string[] } {
  let weightedSum = 0, totalWeight = 0;
  const hot: string[] = [], risk: string[] = [];

  FUTURE_COMPETENCY_MAP.forEach(sig => {
    const lvl     = competencyLevels[sig.competencyId] ?? 0;
    const futureRel = getFutureRelevanceScore(sig.competencyId, horizon);
    const weight    = futureRel / 100;
    weightedSum    += (lvl / 5) * 100 * weight;
    totalWeight    += weight;

    if (sig.growthTrajectory === 'hot' && lvl >= 3)       hot.push(sig.competencyId);
    if (sig.growthTrajectory === 'declining' && lvl < 2)   risk.push(sig.competencyId);
  });

  return {
    score: Math.round(weightedSum / Math.max(1, totalWeight)),
    hotCompetencies:  hot,
    riskCompetencies: risk,
  };
}
