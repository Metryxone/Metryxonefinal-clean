/**
 * Transformation Service
 * Client API layer for Phase 3 — trajectory, velocity, and memory endpoints.
 */

import type { CompetencySnapshot }     from '@/lib/engines/longitudinalIntelligenceEngine';
import type { CareerTrajectoryOutput }  from '@/lib/engines/careerTrajectoryEngine';
import type { LearningVelocityOutput }  from '@/lib/engines/learningVelocityEngine';

const BASE = '/api/career';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = params
    ? `${BASE}${path}?${new URLSearchParams(params)}`
    : `${BASE}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

/* ── Trajectory ────────────────────────────────────────────────────── */
export const transformationService = {
  /* Career Trajectory */
  getTrajectory(input: {
    competencyLevels:  Record<string, number>;
    eiScore:           number;
    profile?:          unknown;
    velocityPerMonth?: number;
    topN?:             number;
  }): Promise<CareerTrajectoryOutput> {
    return post('/trajectory/compute', input);
  },

  getAdjacentRoles(input: {
    competencyLevels: Record<string, number>;
    eiScore:          number;
    topN?:            number;
  }): Promise<{ adjacentRoles: CareerTrajectoryOutput['adjacentRoles'] }> {
    return post('/trajectory/adjacent-roles', input);
  },

  getRoleEvolutionForecast(input: {
    competencyLevels: Record<string, number>;
    eiScore:          number;
    horizonMonths?:   number;
  }): Promise<{ steps: CareerTrajectoryOutput['trajectorySteps']; narrative: string }> {
    return post('/trajectory/evolution', input);
  },

  getTransformationProbability(input: {
    competencyLevels: Record<string, number>;
    eiScore:          number;
    targetRoleId:     string;
  }): Promise<{ probability: number; etaMonths: number; barriers: string[]; accelerators: string[] }> {
    return post('/trajectory/probability', input);
  },

  /* Learning Velocity */
  computeVelocity(input: {
    snapshots:     CompetencySnapshot[];
    currentLevels: Record<string, number>;
    currentEI:     number;
    targetEI?:     number;
  }): Promise<LearningVelocityOutput> {
    return post('/velocity/compute', input);
  },

  getVelocityBenchmarks(): Promise<{
    bands: { band: string; minScore: number; description: string; pctOfLearners: number }[];
  }> {
    return get('/velocity/bands');
  },

  /* Career Memory — Snapshots */
  saveSnapshot(input: {
    userId:           string;
    competencyLevels: Record<string, number>;
    eiScore:          number;
    percentile?:      number;
    label?:           string;
  }): Promise<{ snapshotId: string; snapshot: CompetencySnapshot }> {
    return post('/memory/snapshot', input);
  },

  getSnapshots(userId: string): Promise<{
    snapshots: CompetencySnapshot[];
    count: number;
  }> {
    return get('/memory/snapshots', { userId });
  },

  deleteSnapshot(snapshotId: string): Promise<{ deleted: boolean }> {
    return del(`/memory/snapshot/${snapshotId}`);
  },

  /* Career Memory — Interventions */
  logIntervention(input: {
    userId:          string;
    competencyId:    string;
    competencyLabel: string;
    title:           string;
    type:            string;
    eiLiftActual:    number;
    hoursSpent:      number;
    rating?:         1 | 2 | 3 | 4 | 5;
    note?:           string;
  }): Promise<{ id: string; logged: boolean }> {
    return post('/memory/intervention', input);
  },

  getInterventions(userId: string): Promise<{
    interventions: {
      id: string; competencyId: string; competencyLabel: string;
      title: string; type: string; completedAt: number;
      eiLiftActual: number; hoursSpent: number; rating?: number;
    }[];
    totalEILift: number;
    totalHours:  number;
  }> {
    return get('/memory/interventions', { userId });
  },

  /* Career Memory — Evolution summary */
  getEvolutionSummary(userId: string): Promise<{
    longitudinal: unknown;
    patterns:     unknown[];
    milestones:   unknown[];
    stats:        unknown;
  }> {
    return get('/memory/evolution', { userId });
  },

  /* Full memory dump */
  getMemoryDump(userId: string): Promise<{
    snapshots:     CompetencySnapshot[];
    interventions: unknown[];
    evolution:     unknown;
    patterns:      unknown[];
  }> {
    return get('/memory/dump', { userId });
  },
};

export type TransformationService = typeof transformationService;
