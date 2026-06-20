/**
 * Phase 3.5 — Role Potential Engine.
 *
 * PURE, deterministic, never-throws assessment of ROLE POTENTIAL: the
 * developmental upside of a subject reaching the role's competency profile with
 * focused development. Developmental signal only — NEVER a hiring prediction.
 *
 * Composes (never recomputes) the Phase 2 ReadinessResult and, when available,
 * the Phase 3.4 EiProfile growth-potential signal. Every contribution is an
 * explicit factor so the level is fully traceable.
 *
 * Honesty contract:
 *   - Abstains ('Unmeasured') when there is no measured readiness — never a 0.
 *   - Potential is closable-gap driven: small, non-blocking gaps are upside;
 *     large or blocking gaps temper it. Already-met readiness yields LOW
 *     potential (little remaining upside) — that is a positive, not a deficit.
 *   - Potential score is bounded 0..100 (higher = more upside).
 */

import type { ReadinessResult } from './role-competency-profile.js';
import type { EiProfile } from './ei-profile-engine.js';
import { clamp, round1 } from './competency-ei-scoring-shared.js';

export const ROLE_POTENTIAL_ENGINE_VERSION = 'phase-3.5';

export interface RolePotentialFactor {
  key: string;
  label: string;
  contribution: number; // signed points into the potential score
}

export interface RolePotentialResult {
  level: 'High' | 'Medium' | 'Low' | 'Unmeasured';
  score: number | null; // 0..100 (higher = more developmental upside)
  closable_gaps: number;
  factors: RolePotentialFactor[];
  notes: string[];
}

function unmeasured(reason: string): RolePotentialResult {
  return { level: 'Unmeasured', score: null, closable_gaps: 0, factors: [], notes: [reason] };
}

const CLOSABLE_GAP_MAX = 2; // a non-blocking gap of <= 2 levels is realistically closable
const READY_THRESHOLD = 85; // readiness at/above this = already near target (minimal upside)
const LOW_POTENTIAL_CEILING = 34; // score ceiling that keeps the level at 'Low'

/**
 * Assess role potential. `readiness` may be null → potential is Unmeasured.
 * `eiProfile` is optional; its growth-potential score (developmental capacity)
 * is folded in when present.
 */
export function assessRolePotential(
  readiness: ReadinessResult | null | undefined,
  eiProfile?: EiProfile | null,
): RolePotentialResult {
  if (!readiness) return unmeasured('No role readiness available — potential is unmeasured (not assumed).');
  if (!readiness.measured || readiness.readiness_score == null) {
    return unmeasured('Role readiness has no actual scores — potential is unmeasured (not assumed).');
  }

  const factors: RolePotentialFactor[] = [];
  let score = 0;

  // 1. Foundation: a mid-range readiness is the sweet spot (room to grow on a
  //    real base). Very low = weak foundation; very high = already ready (little
  //    remaining upside).
  const r = readiness.readiness_score;
  let foundation: number;
  if (r >= READY_THRESHOLD) foundation = 10; // already ready — minimal upside left
  else if (r >= 50) foundation = 35;     // strong base + clear room → best upside
  else if (r >= 30) foundation = 20;     // developing base
  else foundation = 10;                  // weak base — upside exists but less certain
  factors.push({ key: 'foundation', label: `Readiness ${r}% (${r >= READY_THRESHOLD ? 'already near target' : r >= 50 ? 'solid base with room to grow' : 'early base'})`, contribution: foundation });
  score += foundation;

  // 2. Closable gaps: non-blocking gaps within reach are upside.
  const closable = readiness.gap_areas.filter((g) => !g.blocking && g.gap != null && g.gap <= CLOSABLE_GAP_MAX);
  if (closable.length > 0) {
    const contribution = Math.min(30, closable.length * 10);
    factors.push({ key: 'closable_gaps', label: `${closable.length} non-critical gap${closable.length === 1 ? '' : 's'} within ${CLOSABLE_GAP_MAX} level${CLOSABLE_GAP_MAX === 1 ? '' : 's'} of target`, contribution });
    score += contribution;
  }

  // 3. Blocking gaps temper potential (harder, longer path).
  if (readiness.blocking_gaps > 0) {
    const contribution = -Math.min(25, readiness.blocking_gaps * 12);
    factors.push({ key: 'blocking_gaps', label: `${readiness.blocking_gaps} critical gap${readiness.blocking_gaps === 1 ? '' : 's'} lengthen the development path`, contribution });
    score += contribution;
  }

  // 4. Developmental capacity from the EI profile growth-potential signal.
  const gp = eiProfile?.growth_potential;
  if (gp && gp.score != null) {
    const contribution = round1(Math.min(25, gp.score * 0.25));
    factors.push({ key: 'ei_growth_potential', label: `EI growth potential ${gp.level} (headroom ${gp.score})`, contribution });
    score += contribution;
  }

  // 5. Coverage: low coverage makes the upside provisional (mild temper).
  if (readiness.coverage_pct != null && readiness.coverage_pct < 100) {
    const contribution = -round1((100 - readiness.coverage_pct) * 0.05);
    if (contribution < 0) {
      factors.push({ key: 'coverage_gap', label: `${round1(100 - readiness.coverage_pct)}% of role weight unassessed (upside provisional)`, contribution });
      score += contribution;
    }
  }

  // Hard invariant: an already-ready candidate (readiness >= READY_THRESHOLD)
  // has minimal remaining developmental upside, so Role Potential is ALWAYS Low
  // regardless of any positive factors — this is a positive signal, not a deficit.
  const alreadyReady = r >= READY_THRESHOLD;
  if (alreadyReady) {
    if (score > LOW_POTENTIAL_CEILING) {
      factors.push({
        key: 'already_ready_cap',
        label: `Readiness ${r}% ≥ ${READY_THRESHOLD}% — upside capped (already near target)`,
        contribution: round1(LOW_POTENTIAL_CEILING - score),
      });
    }
    score = Math.min(score, LOW_POTENTIAL_CEILING);
  }

  score = round1(clamp(score, 0, 100));
  let level: RolePotentialResult['level'] = score >= 60 ? 'High' : score >= 35 ? 'Medium' : 'Low';
  if (alreadyReady) level = 'Low';

  const notes: string[] = [];
  if (alreadyReady) notes.push('Readiness is already near target — Role Potential is Low because little developmental upside remains (a positive signal).');
  if (!eiProfile?.growth_potential || eiProfile.growth_potential.score == null) notes.push('EI growth-potential signal unavailable — potential derived from readiness gaps alone.');

  return { level, score, closable_gaps: closable.length, factors, notes };
}
