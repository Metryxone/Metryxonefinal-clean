import type { CareerProfile } from '@/lib/careerIntelligence';
import { runEmployabilityEngine } from '@/lib/engines/employabilityEngine';

export interface SimulationScenario {
  id:          string;
  label:       string;
  description: string;
  changes:     Partial<{
    addTechSkills:  string[];
    addSoftSkills:  string[];
    addCerts:       number;
    addProjects:    number;
    addExpYears:    number;
    setCompleteness:number;
  }>;
}

export interface SimulationResult {
  scenarioId:   string;
  baseScore:    number;
  projectedScore:number;
  scoreDelta:   number;
  profile:      CareerProfile;
}

export const SIMULATION_SCENARIOS: SimulationScenario[] = [
  { id:'add-3-skills', label:'Add 3 technical skills', description:'What if you add Python, Docker, and SQL?',
    changes: { addTechSkills: ['Python','Docker','SQL'] } },
  { id:'add-cert',     label:'Earn one certification',  description:'Add an AWS or PMP certification.',
    changes: { addCerts: 1 } },
  { id:'complete-profile', label:'Complete your profile to 80%', description:'Fill all remaining sections.',
    changes: { setCompleteness: 80 } },
  { id:'add-project',  label:'Add a portfolio project', description:'Ship and document a side project.',
    changes: { addProjects: 1 } },
  { id:'2-years-exp',  label:'2 more years experience', description:'Projected score after 2 additional years.',
    changes: { addExpYears: 2 } },
];

function applyChanges(profile: CareerProfile | null | undefined, scenario: SimulationScenario): CareerProfile {
  const p: CareerProfile = JSON.parse(JSON.stringify(profile ?? {}));
  const ch = scenario.changes;

  if (ch.addTechSkills?.length) {
    p.skills ??= {};
    p.skills.technical = [...(p.skills.technical ?? []), ...ch.addTechSkills];
  }
  if (ch.addSoftSkills?.length) {
    p.skills ??= {};
    p.skills.soft = [...(p.skills.soft ?? []), ...ch.addSoftSkills];
  }
  if (ch.addCerts) {
    const dummy = Array.from({ length: ch.addCerts }, (_, i) => ({ name: `Cert ${i+1}`, issuer: '' }));
    p.certifications = [...(p.certifications ?? [] as unknown[]), ...dummy] as unknown[];
  }
  if (ch.addProjects) {
    const dummy = Array.from({ length: ch.addProjects }, (_, i) => ({ name: `Project ${i+1}` }));
    p.projects = [...(p.projects ?? [] as unknown[]), ...dummy] as unknown[];
  }
  if (ch.addExpYears) {
    p.experience ??= [];
    if (p.experience.length) {
      p.experience[0] = { ...p.experience[0], years: (p.experience[0]?.years ?? 0) + ch.addExpYears };
    } else {
      p.experience.push({ title: 'Current Role', company: '', years: ch.addExpYears, current: true });
    }
  }
  if (ch.setCompleteness !== undefined) {
    p.competencyProfile ??= {};
    p.competencyProfile.completeness = ch.setCompleteness;
  }
  return p;
}

export const simulationService = {
  run(profile: CareerProfile | null | undefined, scenarioId: string): SimulationResult | null {
    const scenario = SIMULATION_SCENARIOS.find(s => s.id === scenarioId);
    if (!scenario) return null;

    const baseScore      = runEmployabilityEngine({ profile }).score;
    const simProfile     = applyChanges(profile, scenario);
    const projectedScore = runEmployabilityEngine({ profile: simProfile }).score;

    return { scenarioId, baseScore, projectedScore, scoreDelta: projectedScore - baseScore, profile: simProfile };
  },

  runAll(profile: CareerProfile | null | undefined): SimulationResult[] {
    return SIMULATION_SCENARIOS
      .map(s => this.run(profile, s.id))
      .filter(Boolean) as SimulationResult[];
  },
};
