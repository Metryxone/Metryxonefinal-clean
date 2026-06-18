/**
 * Genome Service
 * Client-side API for the competency genome, benchmark intelligence,
 * success signature, and future map 2.0 endpoints.
 */

import type { CareerProfile } from '@/lib/careerIntelligence';

const BASE = '/api/career';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`genomeService: ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`genomeService: ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

/* ── Genome endpoints ──────────────────────────────────────────────── */

export const genomeService = {
  /** Full competency genome — dependencies, adjacency, unlock graph */
  getGenome:           () => get('/genome/graph'),

  /** Adjacency tree from a given competency (BFS within N hops) */
  getAdjacent:         (id: string, hops = 2) =>
    get(`/genome/adjacent/${id}?hops=${hops}`),

  /** Maturity level descriptors for all or one competency */
  getMaturity:         (id?: string) =>
    get(id ? `/genome/maturity/${id}` : '/genome/maturity'),

  /** Future competency signals */
  getFutureSignals:    () => get('/genome/future-signals'),

  /** Progression paths */
  getProgressionPaths: () => get('/genome/progression-paths'),

  /** Detect best progression path for a given competency level map */
  detectPath: (competencyLevels: Record<string, number>, roleFamily?: string) =>
    post('/genome/detect-path', { competencyLevels, roleFamily }),

  /** Compute unlock chain — which competencies become available given levels */
  computeUnlocks: (competencyLevels: Record<string, number>) =>
    post('/genome/unlocks', { competencyLevels }),

  /** Gap sequence — ordered steps to reach target levels */
  buildGapSequence: (currentLevels: Record<string, number>, targetLevels: Record<string, number>) =>
    post('/genome/gap-sequence', { currentLevels, targetLevels }),

  /* ── Benchmark Intelligence ──────────────────────────────────────── */

  /** Full benchmark intelligence for a profile */
  runBenchmarks: (payload: {
    profile:          CareerProfile | null | undefined;
    eiScore:          number;
    competencyLevels?:Record<string, number>;
    industry?:        string;
    city?:            string;
  }) => post('/genome/benchmarks', payload),

  /* ── Success Signature ────────────────────────────────────────────── */

  /** Cluster analysis, leadership maturity, transformation readiness */
  runSuccessSignature: (payload: {
    profile:          CareerProfile | null | undefined;
    competencyLevels: Record<string, number>;
    eiScore:          number;
    targetRoleFamily?:string;
  }) => post('/genome/success-signature', payload),

  /* ── Future Map 2.0 ───────────────────────────────────────────────── */

  /** Enhanced role recommendations with genome + future signals */
  runFutureMap: (payload: {
    profile:          CareerProfile | null | undefined;
    competencyLevels: Record<string, number>;
    eiScore:          number;
    topN?:            number;
  }) => post('/genome/future-map', payload),

  /* ── Future Readiness ─────────────────────────────────────────────── */

  /** Future readiness score over 1/3/5 year horizon */
  futureReadiness: (payload: {
    competencyLevels: Record<string, number>;
    horizon?:         1 | 3 | 5;
  }) => post('/genome/future-readiness', payload),
};

export type GenomeService = typeof genomeService;
