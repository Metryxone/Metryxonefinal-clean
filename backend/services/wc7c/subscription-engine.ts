/**
 * CAPADEX WC-7C Wave 1 — Subscription Activation Engine.
 *
 * COMPOSE-ONLY · READ-ONLY · NEVER-THROWS · NO NEW TABLES.
 *
 * Maps the already-composed unified decision (stage + confidence + ambiguity) onto the
 * NEXT purchasable rung of the LIVE CAPADEX progressive-stage ladder (the real Razorpay
 * product), reading only what the user has already paid for (`capadex_payments`). It:
 *   • NEVER sells into a stub — the stage ladder IS the live product, so the target is
 *     always a real SKU; stub products are guarded in the offer engine, not here.
 *   • applies the D6 high-confidence gate — low confidence / ambiguous decisions defer to
 *     `show_options` (the target is surfaced, but `ready:false` → the UI must NOT
 *     auto-recommend).
 *   • honours safety (D7) overriding commerce — a crisis/escalation event suppresses all
 *     commerce (`safety_override`).
 *   • degrades honestly — no billing identity → `no_billing_identity`; whole ladder owned
 *     → `all_stages_owned` (retention path, nothing new to sell).
 *
 * STAGE_PRICES / LADDER MIRROR `routes/capadex-payments.ts` — keep them in lockstep.
 */
import type { Pool } from 'pg';
import { STAGE_CODE_TO_LABEL } from '../../lib/lifecycle';

// Mirror of STAGE_PRICES in routes/capadex-payments.ts — keep in lockstep.
const STAGE_PRICES: Record<string, number> = { CAP_INS: 499, CAP_GRW: 999, CAP_MAS: 1999 };
const LADDER = ['CAP_INS', 'CAP_GRW', 'CAP_MAS'] as const;
// Canonical stage labels — sourced from the single lifecycle source of truth.
const STAGE_LABEL: Record<string, string> = STAGE_CODE_TO_LABEL;
const HIGH_CONFIDENCE = 0.7;

export interface SubscriptionTarget {
  kind: 'capadex_stage';
  code: string;
  label: string;
  price: number;
  currency: 'INR';
}

export interface SubscriptionActivation {
  ready: boolean;
  reason: string;
  target: SubscriptionTarget | null;
  confidence_gated: boolean;
  already_owned: string[];
  upsell: { ready: boolean; trigger: 'stage' | 'renewal' | null; reason: string };
  source: 'capadex_stage_ladder';
}

/** Minimal decision shape the engine consumes (avoids a circular import on DecisionContext). */
export interface CommercialDecisionInput {
  email: string | null;
  decision: {
    confidence: number;
    ambiguity: 'low' | 'moderate' | 'high';
    stage: { canonical_stage: string } | null;
  };
}

function stageFloorIndex(canonical: string | null | undefined): number {
  switch ((canonical || '').toLowerCase()) {
    case 'clarity':
    case 'growth':
      return 1;
    case 'mastery':
      return 2;
    case 'awareness':
    case 'curiosity':
    default:
      return 0;
  }
}

// Reads owned (paid) stages from the live ledger. Deliberately does NOT swallow query
// errors: a read failure must NOT be mistaken for "owns nothing" (that could recommend a
// stage the user already paid for). The caller treats a throw as a degraded billing state.
async function loadOwnedStages(pool: Pool, email: string | null): Promise<string[]> {
  if (!email) return [];
  const { rows } = await pool.query(
    `SELECT DISTINCT stage_code FROM capadex_payments WHERE lower(email) = lower($1) AND status = 'paid'`,
    [email],
  );
  return rows.map((r) => String(r.stage_code)).filter(Boolean);
}

/**
 * Defensive safety gate: a crisis / escalation audit event for the session suppresses ALL
 * commerce. Read-only + never-throws; no match (incl. when no such events are ever logged)
 * → no suppression.
 */
export async function checkSafetyOverride(pool: Pool, sessionId: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM capadex_audit_events
        WHERE session_id = $1
          AND event_type IN ('crisis_escalation','safety_escalation','crisis_detected','escalation')
        LIMIT 1`,
      [sessionId],
    );
    return rows.length > 0;
  } catch {
    // Fail CLOSED: if we cannot verify safety, suppress commerce (safety overrides commerce).
    return true;
  }
}

export async function deriveSubscriptionActivation(
  pool: Pool,
  input: CommercialDecisionInput,
  opts: { safetyBlocked?: boolean } = {},
): Promise<SubscriptionActivation> {
  const base: SubscriptionActivation = {
    ready: false,
    reason: 'unresolved',
    target: null,
    confidence_gated: false,
    already_owned: [],
    upsell: { ready: false, trigger: null, reason: 'none' },
    source: 'capadex_stage_ladder',
  };

  // Safety (D7) overrides commerce.
  if (opts.safetyBlocked) {
    return { ...base, reason: 'safety_override' };
  }

  let owned: string[];
  try {
    owned = await loadOwnedStages(pool, input.email);
  } catch {
    // Live ledger unavailable → never fabricate ownership; block any recommendation.
    return { ...base, reason: 'billing_ledger_unavailable' };
  }
  const ownedSet = new Set(owned);
  base.already_owned = owned;

  const floor = stageFloorIndex(input.decision.stage?.canonical_stage ?? null);
  const candidateCode: string | null =
    LADDER.find((code, i) => i >= floor && !ownedSet.has(code)) ??
    LADDER.find((code) => !ownedSet.has(code)) ??
    null;

  if (!candidateCode) {
    // Whole ladder owned → retention path; nothing new to sell.
    return {
      ...base,
      reason: 'all_stages_owned',
      upsell: { ready: false, trigger: 'renewal', reason: 'renewal_not_applicable_b2c' },
    };
  }

  const target: SubscriptionTarget = {
    kind: 'capadex_stage',
    code: candidateCode,
    label: STAGE_LABEL[candidateCode] ?? candidateCode,
    price: STAGE_PRICES[candidateCode] ?? 0,
    currency: 'INR',
  };

  // No billing identity → cannot confirm ownership; surface the target but never auto-recommend.
  if (!input.email) {
    return { ...base, target, reason: 'no_billing_identity' };
  }

  const upsell = owned.length > 0
    ? { ready: true, trigger: 'stage' as const, reason: 'prior_paid_stage' }
    : { ready: false, trigger: null, reason: 'no_prior_purchase' };

  // D6 high-confidence gate: low confidence / ambiguous → defer to show-options.
  const highConf = input.decision.confidence >= HIGH_CONFIDENCE && input.decision.ambiguity === 'low';
  if (!highConf) {
    return { ...base, target, reason: 'show_options', confidence_gated: true, upsell };
  }

  return { ...base, ready: true, reason: 'recommend', target, upsell };
}
