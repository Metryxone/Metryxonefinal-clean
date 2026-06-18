/**
 * Competency Genome Engine
 * Defines the complete relationship graph between all 24 COMPETENCY_DOMAINS.
 * Provides dependency resolution, adjacency traversal, and unlock path discovery.
 */

export interface CompetencyGene {
  id:                 string;
  label:              string;
  domain:             'technical' | 'analytical' | 'communication' | 'leadership' | 'creative' | 'execution' | 'behavioral';
  prerequisites:      { id: string; minLevel: number }[];
  adjacent:           string[];
  unlocks:            string[];
  learnabilityScore:  number;  // 0-100: how teachable without prior context
  transferability:    number;  // 0-100: transfers across domains / industries
  cooccurrenceRate:   number;  // 0-1: how often this appears with others in job reqs
  complexityTier:     1 | 2 | 3;  // 1=foundational, 2=intermediate, 3=advanced
  consolidationWeeks: number;  // median weeks to level up (level N → N+1)
}

export const COMPETENCY_GENOME: CompetencyGene[] = [
  /* ── TECHNICAL ──────────────────────────────────────────────────────── */
  {
    id: 'programming', label: 'Programming', domain: 'technical',
    prerequisites: [],
    adjacent:      ['systems-design', 'data-engineering', 'cloud', 'security'],
    unlocks:       ['systems-design', 'data-engineering', 'security', 'cloud'],
    learnabilityScore: 78, transferability: 88, cooccurrenceRate: 0.94,
    complexityTier: 1, consolidationWeeks: 16,
  },
  {
    id: 'systems-design', label: 'Systems Design', domain: 'technical',
    prerequisites: [{ id: 'programming', minLevel: 2 }],
    adjacent:      ['programming', 'cloud', 'security', 'data-engineering'],
    unlocks:       ['cloud', 'security', 'strategy'],
    learnabilityScore: 58, transferability: 75, cooccurrenceRate: 0.82,
    complexityTier: 3, consolidationWeeks: 24,
  },
  {
    id: 'cloud', label: 'Cloud & DevOps', domain: 'technical',
    prerequisites: [{ id: 'systems-design', minLevel: 2 }],
    adjacent:      ['systems-design', 'security', 'programming', 'process'],
    unlocks:       ['security', 'strategy'],
    learnabilityScore: 65, transferability: 82, cooccurrenceRate: 0.78,
    complexityTier: 2, consolidationWeeks: 20,
  },
  {
    id: 'data-engineering', label: 'Data Engineering', domain: 'technical',
    prerequisites: [{ id: 'programming', minLevel: 3 }, { id: 'data-analysis', minLevel: 1 }],
    adjacent:      ['programming', 'data-analysis', 'statistics', 'cloud'],
    unlocks:       ['statistics'],
    learnabilityScore: 62, transferability: 80, cooccurrenceRate: 0.71,
    complexityTier: 2, consolidationWeeks: 20,
  },
  {
    id: 'security', label: 'Security', domain: 'technical',
    prerequisites: [{ id: 'systems-design', minLevel: 2 }, { id: 'programming', minLevel: 2 }],
    adjacent:      ['cloud', 'systems-design', 'process'],
    unlocks:       ['process'],
    learnabilityScore: 52, transferability: 72, cooccurrenceRate: 0.64,
    complexityTier: 3, consolidationWeeks: 28,
  },

  /* ── ANALYTICAL ──────────────────────────────────────────────────────── */
  {
    id: 'data-analysis', label: 'Data Analysis', domain: 'analytical',
    prerequisites: [],
    adjacent:      ['statistics', 'business-acumen', 'research', 'data-engineering'],
    unlocks:       ['statistics', 'business-acumen', 'research'],
    learnabilityScore: 80, transferability: 90, cooccurrenceRate: 0.88,
    complexityTier: 1, consolidationWeeks: 12,
  },
  {
    id: 'statistics', label: 'Statistics & ML', domain: 'analytical',
    prerequisites: [{ id: 'data-analysis', minLevel: 2 }],
    adjacent:      ['data-analysis', 'data-engineering', 'research', 'programming'],
    unlocks:       ['research'],
    learnabilityScore: 55, transferability: 76, cooccurrenceRate: 0.70,
    complexityTier: 3, consolidationWeeks: 28,
  },
  {
    id: 'business-acumen', label: 'Business Acumen', domain: 'analytical',
    prerequisites: [{ id: 'data-analysis', minLevel: 1 }],
    adjacent:      ['data-analysis', 'strategy', 'stakeholder-mgmt', 'negotiation'],
    unlocks:       ['strategy', 'negotiation'],
    learnabilityScore: 70, transferability: 92, cooccurrenceRate: 0.84,
    complexityTier: 2, consolidationWeeks: 16,
  },
  {
    id: 'research', label: 'Research', domain: 'analytical',
    prerequisites: [],
    adjacent:      ['data-analysis', 'statistics', 'writing'],
    unlocks:       ['writing'],
    learnabilityScore: 74, transferability: 86, cooccurrenceRate: 0.68,
    complexityTier: 1, consolidationWeeks: 12,
  },

  /* ── COMMUNICATION ──────────────────────────────────────────────────── */
  {
    id: 'writing', label: 'Writing', domain: 'communication',
    prerequisites: [],
    adjacent:      ['presentation', 'storytelling', 'research'],
    unlocks:       ['storytelling', 'stakeholder-mgmt'],
    learnabilityScore: 82, transferability: 95, cooccurrenceRate: 0.89,
    complexityTier: 1, consolidationWeeks: 10,
  },
  {
    id: 'presentation', label: 'Presentation', domain: 'communication',
    prerequisites: [{ id: 'writing', minLevel: 1 }],
    adjacent:      ['writing', 'storytelling', 'stakeholder-mgmt'],
    unlocks:       ['stakeholder-mgmt', 'storytelling', 'negotiation'],
    learnabilityScore: 76, transferability: 93, cooccurrenceRate: 0.86,
    complexityTier: 1, consolidationWeeks: 10,
  },
  {
    id: 'stakeholder-mgmt', label: 'Stakeholder Mgmt', domain: 'communication',
    prerequisites: [{ id: 'presentation', minLevel: 2 }, { id: 'writing', minLevel: 2 }],
    adjacent:      ['presentation', 'strategy', 'negotiation', 'people-mgmt'],
    unlocks:       ['strategy', 'people-mgmt'],
    learnabilityScore: 62, transferability: 88, cooccurrenceRate: 0.78,
    complexityTier: 2, consolidationWeeks: 18,
  },

  /* ── LEADERSHIP ──────────────────────────────────────────────────────── */
  {
    id: 'people-mgmt', label: 'People Management', domain: 'leadership',
    prerequisites: [{ id: 'mentoring', minLevel: 2 }, { id: 'collaboration', minLevel: 3 }],
    adjacent:      ['mentoring', 'strategy', 'stakeholder-mgmt', 'process'],
    unlocks:       ['strategy'],
    learnabilityScore: 55, transferability: 80, cooccurrenceRate: 0.72,
    complexityTier: 3, consolidationWeeks: 32,
  },
  {
    id: 'strategy', label: 'Strategic Thinking', domain: 'leadership',
    prerequisites: [{ id: 'business-acumen', minLevel: 3 }, { id: 'stakeholder-mgmt', minLevel: 2 }],
    adjacent:      ['people-mgmt', 'business-acumen', 'stakeholder-mgmt', 'negotiation'],
    unlocks:       [],
    learnabilityScore: 48, transferability: 85, cooccurrenceRate: 0.74,
    complexityTier: 3, consolidationWeeks: 40,
  },
  {
    id: 'mentoring', label: 'Mentoring', domain: 'leadership',
    prerequisites: [{ id: 'collaboration', minLevel: 2 }, { id: 'resilience', minLevel: 2 }],
    adjacent:      ['people-mgmt', 'collaboration', 'resilience', 'presentation'],
    unlocks:       ['people-mgmt'],
    learnabilityScore: 68, transferability: 82, cooccurrenceRate: 0.64,
    complexityTier: 2, consolidationWeeks: 20,
  },

  /* ── CREATIVE ────────────────────────────────────────────────────────── */
  {
    id: 'design-thinking', label: 'Design Thinking', domain: 'creative',
    prerequisites: [],
    adjacent:      ['visual-design', 'storytelling', 'research', 'presentation'],
    unlocks:       ['visual-design', 'storytelling'],
    learnabilityScore: 84, transferability: 90, cooccurrenceRate: 0.72,
    complexityTier: 1, consolidationWeeks: 8,
  },
  {
    id: 'visual-design', label: 'Visual Design', domain: 'creative',
    prerequisites: [{ id: 'design-thinking', minLevel: 2 }],
    adjacent:      ['design-thinking', 'storytelling', 'presentation'],
    unlocks:       ['storytelling'],
    learnabilityScore: 70, transferability: 76, cooccurrenceRate: 0.58,
    complexityTier: 2, consolidationWeeks: 18,
  },
  {
    id: 'storytelling', label: 'Storytelling', domain: 'creative',
    prerequisites: [{ id: 'writing', minLevel: 2 }, { id: 'presentation', minLevel: 2 }],
    adjacent:      ['writing', 'presentation', 'design-thinking', 'visual-design'],
    unlocks:       [],
    learnabilityScore: 72, transferability: 88, cooccurrenceRate: 0.66,
    complexityTier: 2, consolidationWeeks: 14,
  },

  /* ── EXECUTION ───────────────────────────────────────────────────────── */
  {
    id: 'project-mgmt', label: 'Project Management', domain: 'execution',
    prerequisites: [{ id: 'process', minLevel: 2 }, { id: 'collaboration', minLevel: 2 }],
    adjacent:      ['process', 'negotiation', 'stakeholder-mgmt', 'people-mgmt'],
    unlocks:       ['negotiation', 'people-mgmt'],
    learnabilityScore: 75, transferability: 92, cooccurrenceRate: 0.82,
    complexityTier: 2, consolidationWeeks: 16,
  },
  {
    id: 'process', label: 'Process Excellence', domain: 'execution',
    prerequisites: [],
    adjacent:      ['project-mgmt', 'cloud', 'security', 'data-analysis'],
    unlocks:       ['project-mgmt'],
    learnabilityScore: 80, transferability: 88, cooccurrenceRate: 0.76,
    complexityTier: 1, consolidationWeeks: 10,
  },
  {
    id: 'negotiation', label: 'Negotiation', domain: 'execution',
    prerequisites: [{ id: 'presentation', minLevel: 2 }, { id: 'stakeholder-mgmt', minLevel: 2 }],
    adjacent:      ['stakeholder-mgmt', 'strategy', 'business-acumen', 'people-mgmt'],
    unlocks:       [],
    learnabilityScore: 60, transferability: 90, cooccurrenceRate: 0.62,
    complexityTier: 2, consolidationWeeks: 20,
  },

  /* ── BEHAVIORAL ──────────────────────────────────────────────────────── */
  {
    id: 'drive', label: 'Drive & Ownership', domain: 'behavioral',
    prerequisites: [],
    adjacent:      ['resilience', 'collaboration', 'process'],
    unlocks:       ['resilience'],
    learnabilityScore: 60, transferability: 98, cooccurrenceRate: 0.91,
    complexityTier: 1, consolidationWeeks: 8,
  },
  {
    id: 'collaboration', label: 'Collaboration', domain: 'behavioral',
    prerequisites: [],
    adjacent:      ['drive', 'mentoring', 'project-mgmt', 'people-mgmt'],
    unlocks:       ['mentoring', 'project-mgmt'],
    learnabilityScore: 72, transferability: 96, cooccurrenceRate: 0.94,
    complexityTier: 1, consolidationWeeks: 8,
  },
  {
    id: 'resilience', label: 'Resilience', domain: 'behavioral',
    prerequisites: [],
    adjacent:      ['drive', 'mentoring', 'cloud', 'security'],
    unlocks:       ['mentoring'],
    learnabilityScore: 55, transferability: 95, cooccurrenceRate: 0.87,
    complexityTier: 1, consolidationWeeks: 12,
  },
];

const GENOME_MAP = new Map<string, CompetencyGene>(COMPETENCY_GENOME.map(g => [g.id, g]));

export function getGene(id: string): CompetencyGene | undefined {
  return GENOME_MAP.get(id);
}

export function getAdjacent(id: string): CompetencyGene[] {
  return (GENOME_MAP.get(id)?.adjacent ?? []).map(a => GENOME_MAP.get(a)!).filter(Boolean);
}

export function getPrerequisites(id: string): CompetencyGene[] {
  return (GENOME_MAP.get(id)?.prerequisites ?? []).map(p => GENOME_MAP.get(p.id)!).filter(Boolean);
}

export function getUnlocks(id: string): CompetencyGene[] {
  return (GENOME_MAP.get(id)?.unlocks ?? []).map(u => GENOME_MAP.get(u)!).filter(Boolean);
}

/** Returns true if prerequisites for targetId are met at the given level map. */
export function prereqsMet(targetId: string, levels: Record<string, number>): boolean {
  const gene = GENOME_MAP.get(targetId);
  if (!gene) return false;
  return gene.prerequisites.every(p => (levels[p.id] ?? 0) >= p.minLevel);
}

/** Competencies unlocked by having the given ID at >= minLevel. */
export function computeUnlockChain(levels: Record<string, number>): Set<string> {
  const unlocked = new Set<string>();
  COMPETENCY_GENOME.forEach(gene => {
    if (prereqsMet(gene.id, levels)) unlocked.add(gene.id);
  });
  return unlocked;
}

/** BFS adjacency traversal — returns IDs reachable within N hops. */
export function getAdjacentWithin(id: string, hops = 2): string[] {
  const visited = new Set<string>([id]);
  let frontier  = [id];
  for (let h = 0; h < hops; h++) {
    const next: string[] = [];
    frontier.forEach(n => {
      (GENOME_MAP.get(n)?.adjacent ?? []).forEach(a => {
        if (!visited.has(a)) { visited.add(a); next.push(a); }
      });
    });
    frontier = next;
  }
  visited.delete(id);
  return [...visited];
}

/** Score adjacency overlap between two competency sets (0-100). */
export function adjacencyOverlap(idsA: string[], idsB: string[]): number {
  const setB = new Set(idsB);
  const setA = new Set(idsA);
  const aNeighbours = new Set(idsA.flatMap(id => GENOME_MAP.get(id)?.adjacent ?? []));
  const shared      = [...aNeighbours].filter(n => setB.has(n)).length;
  return Math.round((shared / Math.max(1, setB.size)) * 100);
}

/** Gap sequence: ordered list of competency IDs to develop to reach target levels. */
export function buildGapSequence(
  currentLevels: Record<string, number>,
  targetLevels:  Record<string, number>,
): { id: string; label: string; currentLevel: number; targetLevel: number; gap: number; prereqsMet: boolean }[] {
  return COMPETENCY_GENOME
    .map(gene => {
      const current = currentLevels[gene.id] ?? 0;
      const target  = targetLevels[gene.id] ?? 0;
      const gap     = target - current;
      return {
        id: gene.id, label: gene.label,
        currentLevel: current, targetLevel: target, gap,
        prereqsMet: prereqsMet(gene.id, currentLevels),
      };
    })
    .filter(g => g.gap > 0)
    .sort((a, b) => {
      if (a.prereqsMet !== b.prereqsMet) return a.prereqsMet ? -1 : 1;
      return b.gap - a.gap;
    });
}
