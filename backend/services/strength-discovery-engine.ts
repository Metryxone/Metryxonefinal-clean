/**
 * Strength Discovery Engine (read-only, additive, empty-safe)
 * ─────────────────────────────────────────────────────────────────────────────
 * CAPADEX is a behavioural INVESTIGATION system, not a deficit scanner. The signal
 * runtime (signals → composites → patterns → interventions) is concern-DIAGNOSTIC:
 * its signals describe distress, NOT strengths. This engine therefore NEVER derives
 * a strength from raw signal magnitude. It consolidates ONLY genuinely-positive,
 * already-computed evidence:
 *
 *   • strengths        ← csi_profiles.positive_factors (domain scores ≥ 65)
 *   • resilience       ← longitudinal resilience_recoveries (≥15-pt rebound after a low)
 *   • coping           ← longitudinal growth_patterns (sustained ≥3-session improvement)
 *   • success_patterns ← longitudinal recurring_constructs with an improving trend
 *
 * Every item carries { label, evidence, source, confidence } so the surface is
 * fully evidence-traced. When nothing positive is on record the engine returns
 * empty arrays (never fabricated). It performs NO writes and NO recompute — it
 * reads the same persisted intelligence the rest of the spine already produced.
 */

import type { Pool } from 'pg';
import { buildMemory } from './longitudinal-memory';

export type StrengthSource =
  | 'csi_positive_factors'
  | 'longitudinal_resilience'
  | 'longitudinal_growth'
  | 'longitudinal_behavioural_drift';

export interface StrengthItem {
  label: string;
  evidence: string;
  source: StrengthSource;
  confidence: number; // 0..1
}

export interface StrengthProfile {
  generated_at: string;
  scope: { email: string | null; session_id: string | null };
  strengths: StrengthItem[];
  resilience: StrengthItem[];
  coping: StrengthItem[];
  success_patterns: StrengthItem[];
  /** Which positive subsystems actually contributed (never fabricated). */
  sources: StrengthSource[];
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

/** CSI positive_factors are only captured when a domain scored ≥ 65 (see csi.ts). */
const CSI_POSITIVE_MIN = 65;

function emptyProfile(email: string | null, sessionId: string | null): StrengthProfile {
  return {
    generated_at: new Date().toISOString(),
    scope: { email, session_id: sessionId },
    strengths: [],
    resilience: [],
    coping: [],
    success_patterns: [],
    sources: [],
  };
}

/**
 * Resolve a scope token (which may be an email or a session UUID) to the canonical
 * user_email that CSI + longitudinal memory are keyed by. A session UUID is mapped
 * via capadex_sessions.guest_email. Returns { email, sessionId } — either may be null.
 */
async function resolveScope(
  pool: Pool,
  scope: string,
): Promise<{ email: string | null; sessionId: string | null }> {
  const token = (scope || '').trim();
  if (!token) return { email: null, sessionId: null };

  // Heuristic: an email contains '@'; otherwise treat as a session id.
  if (token.includes('@')) return { email: token.toLowerCase(), sessionId: null };

  try {
    const { rows } = await pool.query(
      `SELECT guest_email FROM capadex_sessions WHERE id = $1 LIMIT 1`,
      [token],
    );
    const email = rows[0]?.guest_email ? String(rows[0].guest_email).toLowerCase() : null;
    return { email, sessionId: token };
  } catch {
    // Invalid UUID / no such session → no email; stay empty-safe.
    return { email: null, sessionId: token };
  }
}

/** CSI positive_factors → strengths. Read-only SELECT, best-effort. */
async function loadCsiStrengths(pool: Pool, email: string): Promise<StrengthItem[]> {
  try {
    const { rows } = await pool.query(
      `SELECT positive_factors FROM csi_profiles WHERE LOWER(user_email) = $1 LIMIT 1`,
      [email],
    );
    const raw = rows[0]?.positive_factors;
    const factors: any[] = Array.isArray(raw) ? raw : [];
    return factors
      .filter((f) => f && typeof f.factor === 'string' && Number(f.score) >= CSI_POSITIVE_MIN)
      .map((f) => {
        const score = Number(f.score);
        const domain = typeof f.domain === 'string' && f.domain ? f.domain : 'overall';
        return {
          label: f.factor,
          evidence: `CSI domain "${domain}" scored ${Math.round(score)} (≥ ${CSI_POSITIVE_MIN} → strength).`,
          source: 'csi_positive_factors' as const,
          confidence: round2(clamp01(score / 100)),
        };
      });
  } catch {
    return [];
  }
}

/**
 * Discover an evidence-traced strength profile for a scope (email or session UUID).
 * Pure-read + empty-safe: any failure degrades to empty arrays, never throws.
 */
export async function discoverStrengths(pool: Pool, scope: string): Promise<StrengthProfile> {
  const { email, sessionId } = await resolveScope(pool, scope);
  if (!email) return emptyProfile(email, sessionId);

  const profile = emptyProfile(email, sessionId);

  // 1. CSI positive factors → strengths (the ONLY positive-magnitude source).
  profile.strengths = await loadCsiStrengths(pool, email);

  // 2 + 3 + 4. Longitudinal memory: resilience recoveries, growth (coping),
  //            recurring improving constructs (success patterns). One read.
  let memory: Awaited<ReturnType<typeof buildMemory>> | null = null;
  try {
    memory = await buildMemory(pool, email);
  } catch {
    memory = null;
  }

  if (memory) {
    // Resilience — a ≥15-pt rebound after a low score is documented resilience.
    profile.resilience = memory.resilience_recoveries.map((r) => ({
      label: `Recovered on "${r.concern_name}"`,
      evidence: `Rebounded ${Math.round(r.rebound_points)} points (${Math.round(r.low_score)} → ${Math.round(r.high_score)}) on ${new Date(r.detected_at).toISOString().slice(0, 10)}.`,
      source: 'longitudinal_resilience' as const,
      // Normalise a rebound against a full 0..100 swing; cap at 1.
      confidence: round2(clamp01(r.rebound_points / 50)),
    }));

    // Coping — a sustained multi-session improvement is evidence of effective coping.
    profile.coping = memory.growth_patterns.map((g) => ({
      label: `Sustained improvement on "${g.concern_name}"`,
      evidence: `Improved ${Math.round(g.improvement)} points over ${g.sessions_span} sessions (${Math.round(g.starting_score)} → ${Math.round(g.current_score)}).`,
      source: 'longitudinal_growth' as const,
      confidence: round2(clamp01(g.improvement / 50)),
    }));

    // Success patterns — an overall IMPROVING behavioural drift is a positive,
    // CSI-level upward trajectory (distinct from a single concern's growth). NOTE:
    // longitudinal `recurring_constructs` are recurring STRUGGLES (avg < 50) by
    // contract, so they are deliberately NOT a strength source here.
    const drift = memory.behavioural_drift;
    if (drift && drift.direction === 'improving') {
      const driftConfidence = drift.confidence === 'high' ? 0.9 : drift.confidence === 'medium' ? 0.6 : 0.3;
      profile.success_patterns = [
        {
          label: 'Improving overall trajectory',
          evidence: `CSI rose from ${Math.round(drift.first_csi)} to ${Math.round(drift.last_csi)} (slope ${drift.slope}, ${drift.confidence} confidence).`,
          source: 'longitudinal_behavioural_drift' as const,
          confidence: round2(driftConfidence),
        },
      ];
    }
  }

  const sources = new Set<StrengthSource>();
  if (profile.strengths.length) sources.add('csi_positive_factors');
  if (profile.resilience.length) sources.add('longitudinal_resilience');
  if (profile.coping.length) sources.add('longitudinal_growth');
  if (profile.success_patterns.length) sources.add('longitudinal_behavioural_drift');
  profile.sources = Array.from(sources);

  return profile;
}
