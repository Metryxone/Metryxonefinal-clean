/**
 * Phase 3.5 — Role Risk Engine.
 *
 * PURE, deterministic, never-throws assessment of READINESS RISK for a subject
 * against a role: the risk that the candidate is NOT yet ready for the role's
 * competency profile. Developmental signal only — NEVER a hiring/reject verdict.
 *
 * Composes (never recomputes) the Phase 2 ReadinessResult and, when available,
 * the Phase 3.4 EiProfile (for the confidence axis). Every contribution is
 * surfaced as an explicit factor so the level is fully traceable.
 *
 * Honesty contract:
 *   - Abstains ('Unmeasured') when there is no measured readiness — never a 0.
 *   - Coverage and Confidence enter ONLY as uncertainty modifiers; they never
 *     manufacture a readiness number.
 *   - Risk score is bounded 0..100 (higher = more risk).
 */

import type { ReadinessResult } from './role-competency-profile.js';
import type { EiProfile } from './ei-profile-engine.js';
import { clamp, round1 } from './competency-ei-scoring-shared.js';

export const ROLE_RISK_ENGINE_VERSION = 'phase-3.5';

export interface RoleRiskFactor {
  key: string;
  label: string;
  contribution: number; // points added to the risk score
}

export interface RoleRiskResult {
  level: 'High' | 'Medium' | 'Low' | 'Unmeasured';
  score: number | null; // 0..100 (higher = more risk), null when unmeasured
  blocking_gaps: number;
  factors: RoleRiskFactor[];
  notes: string[];
}

function unmeasured(reason: string): RoleRiskResult {
  return { level: 'Unmeasured', score: null, blocking_gaps: 0, factors: [], notes: [reason] };
}

/**
 * Assess role readiness risk. `readiness` may be null (no role profile / no
 * scored subject) → risk is Unmeasured. `eiProfile` is optional; when present
 * its overall confidence band feeds an uncertainty modifier.
 */
export function assessRoleRisk(
  readiness: ReadinessResult | null | undefined,
  eiProfile?: EiProfile | null,
): RoleRiskResult {
  if (!readiness) return unmeasured('No role readiness available — risk is unmeasured (not assumed).');
  if (!readiness.measured || readiness.readiness_score == null) {
    return unmeasured('Role readiness has no actual scores — risk is unmeasured (not assumed).');
  }

  const factors: RoleRiskFactor[] = [];
  let score = 0;

  // 1. Shortfall from full readiness (primary driver).
  const shortfall = round1((100 - readiness.readiness_score) * 0.4);
  if (shortfall > 0) {
    factors.push({
      key: 'readiness_shortfall',
      label: `Readiness at ${readiness.readiness_score}% (${round1(100 - readiness.readiness_score)} below target)`,
      contribution: shortfall,
    });
    score += shortfall;
  }

  // 2. Blocking (critical) gaps — each is a hard risk, capped.
  const blocking = readiness.blocking_gaps;
  if (blocking > 0) {
    const contribution = Math.min(50, blocking * 25);
    factors.push({
      key: 'blocking_gaps',
      label: `${blocking} critical competenc${blocking === 1 ? 'y' : 'ies'} below required level`,
      contribution,
    });
    score += contribution;
  }

  // 3. Coverage gap — unassessed role weight is uncertainty (provisional risk).
  if (readiness.coverage_pct != null && readiness.coverage_pct < 100) {
    const contribution = round1((100 - readiness.coverage_pct) * 0.15);
    if (contribution > 0) {
      factors.push({
        key: 'coverage_gap',
        label: `${round1(100 - readiness.coverage_pct)}% of role weight unassessed (provisional)`,
        contribution,
      });
      score += contribution;
    }
  }

  // 4. Confidence (from the EI profile) — low confidence raises uncertainty.
  const confBand = eiProfile?.confidence?.band;
  if (confBand === 'Low' || confBand === 'None') {
    factors.push({ key: 'low_confidence', label: `Overall measurement confidence is ${confBand}`, contribution: 10 });
    score += 10;
  } else if (confBand === 'Limited') {
    factors.push({ key: 'limited_confidence', label: 'Overall measurement confidence is Limited', contribution: 5 });
    score += 5;
  }

  score = round1(clamp(score, 0, 100));
  const level: RoleRiskResult['level'] = blocking > 0
    ? (score >= 60 ? 'High' : 'Medium') // a blocking gap can never read as Low risk
    : (score >= 60 ? 'High' : score >= 30 ? 'Medium' : 'Low');

  const notes: string[] = [];
  if (blocking > 0) notes.push(`${blocking} blocking (critical) gap${blocking === 1 ? '' : 's'} prevent a Low-risk classification regardless of the overall score.`);
  if (!eiProfile) notes.push('EI profile confidence unavailable — the confidence modifier was not applied.');

  return { level, score, blocking_gaps: blocking, factors, notes };
}
