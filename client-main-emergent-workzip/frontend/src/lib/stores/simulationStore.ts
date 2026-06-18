import { create } from 'zustand';
import { simulationService, SIMULATION_SCENARIOS, type SimulationResult } from '@/lib/services/simulationService';

interface SimulationState {
  results:    SimulationResult[];
  activeId:   string | null;
  scenarios:  typeof SIMULATION_SCENARIOS;

  runAll:    (profile: any) => void;
  runOne:    (profile: any, scenarioId: string) => void;
  setActive: (id: string | null) => void;
  reset:     () => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  results:   [],
  activeId:  null,
  scenarios: SIMULATION_SCENARIOS,

  runAll: (profile) => set({ results: simulationService.runAll(profile) }),

  runOne: (profile, scenarioId) => {
    const result = simulationService.run(profile, scenarioId);
    if (result) set(s => ({ results: [...s.results.filter(r => r.scenarioId !== scenarioId), result] }));
  },

  setActive: (id) => set({ activeId: id }),
  reset:     ()   => set({ results: [], activeId: null }),
}));
