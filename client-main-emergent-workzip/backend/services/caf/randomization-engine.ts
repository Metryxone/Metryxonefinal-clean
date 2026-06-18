// ============================================================
// Competency Assessment Factory — Randomization Engine
// backend/services/caf/randomization-engine.ts
//
// Strategies:
//   stratified     — draw proportionally by difficulty × domain
//   adaptive (CAT) — maximise item information at current theta
//   fixed_parallel — deterministic form assignment via hash
//   fixed          — same items same order every time
//   purely_random  — shuffle from full pool
// ============================================================

import {
  CAFQuestion,
  RandomizationRule,
  DrawnQuestion,
  DifficultyTier,
  AdaptiveState,
  SessionContext,
} from './types.js';
import { irt3PLProbability, irtItemInformation } from './scoring-engine.js';

// ── Exposure Registry (in-memory, replace with DB query in production) ─

export interface ExposureState {
  /** question_id → number of times administered today */
  dailyCounts:    Map<number, number>;
  /** question_id → last time this user saw the item (ISO date) */
  userLastSeen:   Map<number, string>;
}

// ── Fisher-Yates shuffle ──────────────────────────────────────

function shuffle<T>(arr: T[], seed?: number): T[] {
  const a = [...arr];
  // Simple seeded LCG if seed provided
  let rand = seed !== undefined
    ? lcgRandom(seed)
    : () => Math.random();

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function lcgRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── Deterministic session seed ────────────────────────────────

export function sessionSeed(sessionId: string): number {
  // FNV-1a 32-bit hash of session UUID
  let hash = 2166136261;
  for (let i = 0; i < sessionId.length; i++) {
    hash ^= sessionId.charCodeAt(i);
    hash = (hash * 16777619) & 0xffffffff;
  }
  return hash >>> 0;
}

// ── Exposure checks ──────────────────────────────────────────

function isExposed(
  q: CAFQuestion,
  rule: RandomizationRule,
  exposure: ExposureState,
): boolean {
  const daily = exposure.dailyCounts.get(q.id) ?? 0;
  if (daily >= rule.max_daily_exposure) return true;

  const lastSeen = exposure.userLastSeen.get(q.id);
  if (lastSeen) {
    const daysSince = (Date.now() - new Date(lastSeen).getTime()) / (1000 * 86400);
    if (daysSince < rule.user_cooldown_days) return true;
  }
  return false;
}

// ── Pool filtering ───────────────────────────────────────────

function eligiblePool(
  pool:         CAFQuestion[],
  administered: Set<number>,
  rule:         RandomizationRule,
  exposure:     ExposureState,
): CAFQuestion[] {
  return pool.filter(q =>
    q.is_active &&
    q.status === 'approved' &&
    !administered.has(q.id) &&
    !isExposed(q, rule, exposure),
  );
}

// ── Stratified sampling ───────────────────────────────────────

function stratifiedSample(
  eligible:               CAFQuestion[],
  n:                      number,
  difficultyDist:         Record<DifficultyTier, number>,
  seed:                   number,
): CAFQuestion[] {
  if (eligible.length === 0) return [];

  const buckets: Record<DifficultyTier, CAFQuestion[]> = {
    easy:   eligible.filter(q => q.difficulty_tier === 'easy'),
    medium: eligible.filter(q => q.difficulty_tier === 'medium'),
    hard:   eligible.filter(q => q.difficulty_tier === 'hard'),
  };

  const drawn: CAFQuestion[] = [];
  const tiers: DifficultyTier[] = ['easy', 'medium', 'hard'];

  for (const tier of tiers) {
    const target = Math.round(n * (difficultyDist[tier] ?? 0));
    const shuffled = shuffle(buckets[tier], seed + tier.charCodeAt(0));
    drawn.push(...shuffled.slice(0, target));
  }

  // Fill shortfall with any remaining eligible (any tier)
  if (drawn.length < n) {
    const drawnIds = new Set(drawn.map(q => q.id));
    const remaining = shuffle(eligible.filter(q => !drawnIds.has(q.id)), seed + 99);
    drawn.push(...remaining.slice(0, n - drawn.length));
  }

  return drawn.slice(0, n);
}

// ── CAT item selection ────────────────────────────────────────

function catSelectItem(
  eligible:        CAFQuestion[],
  state:           AdaptiveState,
  minDomainCoverage: Record<string, number>,
  currentCoverage:   Record<string, number>,
): CAFQuestion | null {
  if (eligible.length === 0) return null;

  // Force under-covered domains
  for (const [domain, required] of Object.entries(minDomainCoverage)) {
    const covered = currentCoverage[domain] ?? 0;
    if (covered < required) {
      const domainItems = eligible.filter(q => q.domain_code === domain && q.irt_a !== null);
      if (domainItems.length > 0) {
        // Select maximum-information item in this forced domain
        return domainItems.reduce((best, q) =>
          irtItemInformation(state.theta, q.irt_a!, q.irt_b!, q.irt_c) >
          irtItemInformation(state.theta, best.irt_a!, best.irt_b!, best.irt_c)
            ? q : best,
        );
      }
    }
  }

  // Select maximum-information item from all calibrated eligible
  const calibrated = eligible.filter(q => q.irt_a !== null);
  if (calibrated.length === 0) {
    // Fallback: random from uncalibrated
    return eligible[Math.floor(Math.random() * eligible.length)];
  }

  return calibrated.reduce((best, q) => {
    const infoQ    = irtItemInformation(state.theta, q.irt_a!, q.irt_b!, q.irt_c);
    const infoBest = irtItemInformation(state.theta, best.irt_a!, best.irt_b!, best.irt_c);
    return infoQ > infoBest ? q : best;
  });
}

// ── Scenario grouping ─────────────────────────────────────────

function groupByScenario(questions: CAFQuestion[]): CAFQuestion[] {
  const scenarioGroups: Map<number, CAFQuestion[]> = new Map();
  const nonScenario: CAFQuestion[] = [];

  for (const q of questions) {
    if (q.scenario_id) {
      const group = scenarioGroups.get(q.scenario_id) ?? [];
      group.push(q);
      scenarioGroups.set(q.scenario_id, group);
    } else {
      nonScenario.push(q);
    }
  }

  // Interleave: insert scenario blocks between non-scenario items (round-robin domain)
  const result: CAFQuestion[] = [];
  const scenarioBlocks = [...scenarioGroups.values()];
  let blockIdx = 0;

  for (let i = 0; i < nonScenario.length; i++) {
    // Insert a scenario block every ~3 non-scenario items
    if (blockIdx < scenarioBlocks.length && i > 0 && i % 3 === 0) {
      result.push(...scenarioBlocks[blockIdx++]);
    }
    result.push(nonScenario[i]);
  }

  // Append any remaining scenario blocks
  while (blockIdx < scenarioBlocks.length) {
    result.push(...scenarioBlocks[blockIdx++]);
  }

  return result;
}

// ── Option shuffling ──────────────────────────────────────────

function shuffleOptions(questions: CAFQuestion[], seed: number): Map<number, string[]> {
  const optionOrders = new Map<number, string[]>();
  for (const q of questions) {
    if (
      ['MCQ', 'MULTI_SELECT', 'SCENARIO_MCQ', 'SITUATIONAL_JUDGMENT'].includes(q.question_type)
      && q.options && q.options.length > 0
    ) {
      const shuffled = shuffle(q.options.map(o => o.id), seed + q.id);
      optionOrders.set(q.id, shuffled);
    }
  }
  return optionOrders;
}

// ── Domain allocation ─────────────────────────────────────────

function allocateDomains(
  totalQuestions: number,
  domainWeights:  Record<string, number>,
): Record<string, number> {
  const domains   = Object.keys(domainWeights);
  const totalW    = Object.values(domainWeights).reduce((s, w) => s + w, 0);
  const allocation: Record<string, number> = {};
  let assigned = 0;

  for (const domain of domains) {
    const n = Math.floor(totalQuestions * (domainWeights[domain] / totalW));
    allocation[domain] = n;
    assigned += n;
  }

  // Distribute remainder to highest-weight domains
  let remainder = totalQuestions - assigned;
  const sortedByWeight = [...domains].sort((a, b) => domainWeights[b] - domainWeights[a]);
  for (let i = 0; remainder > 0; i++) {
    allocation[sortedByWeight[i % sortedByWeight.length]]++;
    remainder--;
  }

  return allocation;
}

// ── Public: Draw initial question sequence ────────────────────

export interface DrawInput {
  rule:           RandomizationRule;
  pool:           CAFQuestion[];
  totalQuestions: number;
  domainWeights:  Record<string, number>;
  sessionId:      string;
  administered?:  Set<number>;
  exposure:       ExposureState;
}

export interface DrawResult {
  sequence:     DrawnQuestion[];
  warnings:     string[];
  pool_depth:   Record<string, { required: number; available: number }>;
}

export function drawQuestions(input: DrawInput): DrawResult {
  const { rule, pool, totalQuestions, domainWeights, sessionId, exposure } = input;
  const administered = input.administered ?? new Set<number>();
  const seed = sessionSeed(sessionId);
  const warnings: string[] = [];

  const domainAlloc = allocateDomains(totalQuestions, domainWeights);
  const poolDepth: Record<string, { required: number; available: number }> = {};

  const selectedByDomain: Map<string, CAFQuestion[]> = new Map();

  for (const [domain, n] of Object.entries(domainAlloc)) {
    const domainPool = eligiblePool(
      pool.filter(q => q.domain_code === domain),
      administered,
      rule,
      exposure,
    );

    poolDepth[domain] = { required: n, available: domainPool.length };

    if (domainPool.length < n) {
      warnings.push(`Domain ${domain}: requested ${n} items but only ${domainPool.length} available`);
    }

    let selected: CAFQuestion[];

    if (rule.strategy === 'fixed') {
      selected = domainPool.slice(0, n);
    } else if (rule.strategy === 'purely_random') {
      selected = shuffle(domainPool, seed).slice(0, n);
    } else {
      // stratified (default) or adaptive (adaptive selects differently at runtime)
      selected = stratifiedSample(domainPool, n, rule.difficulty_distribution, seed + domain.charCodeAt(0));
    }

    selectedByDomain.set(domain, selected);
  }

  // Merge all selected questions
  const allSelected = [...selectedByDomain.values()].flat();

  // Group scenarios together, interleave non-scenario items
  const grouped = groupByScenario(allSelected);

  // Shuffle options per question
  const optionOrders = shuffleOptions(grouped, seed);

  // Build DrawnQuestion array
  let scenarioFirst: Set<number> = new Set();
  let lastScenarioId: number | null = null;
  for (const q of grouped) {
    if (q.scenario_id && q.scenario_id !== lastScenarioId) {
      scenarioFirst.add(q.id);
      lastScenarioId = q.scenario_id;
    } else if (!q.scenario_id) {
      lastScenarioId = null;
    }
  }

  const sequence: DrawnQuestion[] = grouped.map((q, i) => ({
    question_id:       q.id,
    domain_code:       q.domain_code,
    difficulty_tier:   q.difficulty_tier,
    position:          i + 1,
    option_order:      optionOrders.get(q.id) ?? null,
    scenario_id:       q.scenario_id ?? null,
    is_scenario_first: scenarioFirst.has(q.id),
  }));

  return { sequence, warnings, pool_depth: poolDepth };
}

// ── Public: CAT next-item selection ──────────────────────────

export interface CATNextInput {
  rule:               RandomizationRule;
  pool:               CAFQuestion[];
  administered:       Set<number>;
  exposure:           ExposureState;
  adaptive_state:     AdaptiveState;
  domainAlloc:        Record<string, number>;        // required per domain
  currentCoverage:    Record<string, number>;        // administered per domain
  sessionId:          string;
}

export function catNextItem(input: CATNextInput): CAFQuestion | null {
  const { rule, pool, administered, exposure, adaptive_state, domainAlloc, currentCoverage } = input;

  const eligible = eligiblePool(pool, administered, rule, exposure);
  if (eligible.length === 0) return null;

  // Compute minimum required per domain for force-domain coverage
  const minCoverage: Record<string, number> = {};
  for (const [domain, required] of Object.entries(domainAlloc)) {
    const current = currentCoverage[domain] ?? 0;
    if (current < required) minCoverage[domain] = required;
  }

  return catSelectItem(eligible, adaptive_state, minCoverage, currentCoverage);
}

// ── Public: Validate pool depth ────────────────────────────────

export interface PoolDepthValidation {
  domain:     string;
  required:   number;
  available:  number;
  sufficient: boolean;
  warning?:   string;
}

export function validatePoolDepth(
  pool:          CAFQuestion[],
  domainWeights: Record<string, number>,
  totalQuestions: number,
  minBuffer:     number = 1.5,
): PoolDepthValidation[] {
  const alloc = allocateDomains(totalQuestions, domainWeights);
  return Object.entries(alloc).map(([domain, required]) => {
    const available = pool.filter(
      q => q.domain_code === domain && q.is_active && q.status === 'approved'
    ).length;
    const sufficient = available >= Math.ceil(required * minBuffer);
    return {
      domain,
      required,
      available,
      sufficient,
      warning: sufficient ? undefined : `Pool too thin: need ${Math.ceil(required * minBuffer)}, have ${available}`,
    };
  });
}
