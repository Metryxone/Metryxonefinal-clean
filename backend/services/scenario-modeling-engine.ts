/**
 * Scenario Modeling Engine — what-if, capability-uplift, restructuring,
 * and succession simulations. Pure functions on top of workforce-sim primitives.
 */
import { simulateInterventions, projectLeadershipPipeline, type Intervention } from './workforce-simulation-v2';
export const SCENARIO_ENGINE_VERSION = '6.0.0';

export type ScenarioRequest = {
  scenarioKey: string;
  scenarioType: 'what_if' | 'capability_uplift' | 'restructuring' | 'succession';
  baseline: Parameters<typeof simulateInterventions>[1];
  options: Record<string, unknown>;
};

function asNumber(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function runScenario(req: ScenarioRequest) {
  switch (req.scenarioType) {
    case 'what_if': {
      const interventions = Array.isArray(req.options.interventions) ? (req.options.interventions as Intervention[]) : [];
      return { type: 'what_if', ...simulateInterventions(req.scenarioKey, req.baseline, interventions) };
    }
    case 'capability_uplift': {
      const competency = String(req.options.competency ?? 'TEC');
      const uplift = asNumber(req.options.uplift, 5);
      const reach = Math.max(1, Math.floor(asNumber(req.options.reach, 25)));
      return { type: 'capability_uplift', ...simulateInterventions(req.scenarioKey, req.baseline, [{ type: 'training', competency, uplift, reach }]) };
    }
    case 'restructuring': {
      const reach = Math.max(1, Math.floor(asNumber(req.options.reach, 50)));
      const leadershipBoost = asNumber(req.options.leadershipBoost, 6);
      return { type: 'restructuring', ...simulateInterventions(req.scenarioKey, req.baseline, [{ type: 'restructure', reach, leadershipBoost }]) };
    }
    case 'succession': {
      const currentEmergenceMean = asNumber(req.options.currentEmergenceMean, 45);
      const growthPerQuarter = asNumber(req.options.growthPerQuarter, 2);
      const quarters = Math.max(1, Math.floor(asNumber(req.options.quarters, 4)));
      const pipeline = projectLeadershipPipeline(currentEmergenceMean, growthPerQuarter, quarters);
      return { type: 'succession', scenario_key: req.scenarioKey, baseline: req.baseline, pipeline };
    }
  }
}
