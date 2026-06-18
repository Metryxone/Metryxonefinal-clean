/**
 * CAPADEX WC-7B Tier A — Decision Orchestrator (Deliverable 1).
 *
 * COMPOSE-ONLY + READ-ONLY + NEVER-THROWS. Stitches the already-derived WC-3 layers
 * — L1 Stage Intelligence, L2 Outcome Intelligence, L3 Journey Intelligence — into ONE
 * unified per-session ACTIVATION ENVELOPE. It calls the WC-3 read-only getters
 * (`getSessionStage` / `getSessionOutcomes` / `getSessionJourney`), all of which fall
 * back to a TRANSIENT (non-persisted) compute when the WC-3 persistence flags were OFF
 * at completion — so the orchestrator works whether or not those flags ever ran, and
 * NEVER writes.
 *
 * The envelope carries:
 *   • decision  — canonical stage, primary activated outcome, the routed product, a
 *                 UNIFIED confidence (weighted blend of the three layers), an ambiguity
 *                 band, and a grounded `why[]`.
 *   • product   — the L3 route → product mapping (ready only when a real route resolved).
 *   • growthPlan / mentor — activation slots filled by the WC-7B bridges when their own
 *                 flags are ON; otherwise an honest `ready:false reason:'bridge_disabled'`.
 *   • subscription — always `ready:false reason:'out_of_scope_tier_b'` (Tier B, not built).
 *
 * Nothing here recomputes scores, edits ontology/signals/concerns, or fabricates — when
 * a layer is empty the envelope degrades honestly. The caller is gated on
 * `isDecisionOrchestratorEnabled()`.
 */
import type { Pool } from 'pg';
import { getSessionStage, type StageState } from '../wc3/stage-intelligence';
import { getSessionOutcomes, type OutcomeSummary, type OutcomeModelResult } from '../wc3/outcome-intelligence';
import { getSessionJourney, type JourneyResult } from '../wc3/journey-intelligence';
import {
  isJourneyGrowthPlanBridgeEnabled,
  isDecisionMentorBridgeEnabled,
  isCommercialActivationEnabled,
} from '../../config/feature-flags';
import { deriveGrowthPlanActivation, type GrowthPlanActivation } from './growth-plan-bridge';
import { deriveMentorActivation, type MentorActivation } from './mentor-bridge';
import {
  deriveSubscriptionActivation,
  checkSafetyOverride,
  type SubscriptionActivation,
} from '../wc7c/subscription-engine';
import { deriveOfferActivation, type OfferActivation } from '../wc7c/offer-engine';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The internal, fully-composed decision context the bridges consume. */
export interface DecisionContext {
  sessionId: string;
  email: string | null;
  userId: string | null;
  concern_name: string | null;
  persona: string | null;
  stage: StageState | null;
  outcome: OutcomeSummary | null;
  journey: JourneyResult | null;
  decision: UnifiedDecision;
}

export interface UnifiedDecision {
  stage: { canonical_stage: string; stage_order_index: number; confidence: number } | null;
  primary_outcome: { model_key: string; display_label: string; gap: number; confidence: number } | null;
  route: { route_key: string; product_path: string | null; confidence_band: string; route_confidence: number } | null;
  confidence: number;
  ambiguity: 'low' | 'moderate' | 'high';
  why: string[];
}

export interface ActivationSlot {
  ready: boolean;
  reason: string;
  [k: string]: unknown;
}

export interface ActivationEnvelope {
  enabled: true;
  session_id: string;
  degraded: boolean;
  reason?: string;
  decision: UnifiedDecision;
  product: { ready: boolean; reason: string; route_key: string | null; product_path: string | null };
  growthPlan: ActivationSlot;
  mentor: ActivationSlot;
  // WC-7C Wave 1: when commercialActivation is OFF the slot stays the byte-identical legacy
  // literal; when ON it carries the composed SubscriptionActivation.
  subscription: { ready: false; reason: 'out_of_scope_tier_b' } | SubscriptionActivation;
  // WC-7C Wave 1: present ONLY when commercialActivation is ON (absent → byte-identical legacy).
  offer?: OfferActivation;
  meta: { composed_from: string[]; bridges: { growthPlan: boolean; mentor: boolean; commercial?: boolean } };
}

interface SessionCore {
  email: string | null;
  userId: string | null;
  concern_name: string | null;
  persona: string | null;
}

/** Read the minimal session core (never throws → nulls). Returns undefined if unknown. */
async function loadSessionCore(pool: Pool, sessionId: string): Promise<SessionCore | undefined> {
  try {
    const { rows } = await pool.query(
      `SELECT guest_email, persona, concern_name FROM capadex_sessions WHERE id = $1 LIMIT 1`,
      [sessionId],
    );
    if (rows.length === 0) return undefined;
    const r = rows[0];
    return {
      email: r.guest_email ?? null,
      // capadex_sessions is keyed by guest_email, not a user FK; userId stays null
      // unless a future linkage resolves one. The growth bridge handles null safely.
      userId: null,
      concern_name: r.concern_name ?? null,
      persona: r.persona ?? null,
    };
  } catch {
    return undefined;
  }
}

/**
 * Compose the unified decision from the three WC-3 layers. Confidence is a weighted
 * blend over only the layers that resolved (re-normalised), so a partial decision is
 * never penalised for an absent layer but also never inflated.
 */
function composeDecision(
  stage: StageState | null,
  outcome: OutcomeSummary | null,
  journey: JourneyResult | null,
): UnifiedDecision {
  const why: string[] = [];

  const stagePart = stage
    ? { canonical_stage: stage.canonical_stage, stage_order_index: stage.stage_order_index, confidence: stage.confidence }
    : null;
  if (stagePart) {
    why.push(`Stage ${stagePart.canonical_stage} (confidence ${stagePart.confidence}).`);
  } else {
    why.push('No stage could be resolved for this session.');
  }

  const activeModels: OutcomeModelResult[] =
    outcome && !outcome.unclassified && Array.isArray(outcome.models) ? outcome.models : [];
  const orderedModels = [...activeModels].sort((a, b) => b.confidence - a.confidence);
  const top = orderedModels[0] ?? null;
  const primary_outcome = top
    ? { model_key: top.model_key, display_label: top.display_label, gap: top.gap, confidence: top.confidence }
    : null;
  if (primary_outcome) {
    why.push(`Primary outcome ${primary_outcome.display_label} (gap ${primary_outcome.gap}, confidence ${primary_outcome.confidence}).`);
  } else {
    why.push(`No outcome model activated (${outcome?.reason ?? 'unclassified'}).`);
  }

  const route = journey
    ? {
        route_key: journey.primary_route.route_key,
        product_path: journey.primary_route.product_path,
        confidence_band: journey.confidence_band,
        route_confidence: journey.route_confidence,
      }
    : null;
  if (route) {
    why.push(`Routed to ${journey!.primary_route.display_label} (${route.confidence_band}, confidence ${route.route_confidence}).`);
  }

  // Unified confidence: weighted blend over the layers that resolved.
  const parts: Array<{ w: number; c: number }> = [];
  if (stagePart) parts.push({ w: 0.3, c: stagePart.confidence });
  if (primary_outcome) parts.push({ w: 0.4, c: primary_outcome.confidence });
  if (route) parts.push({ w: 0.3, c: route.route_confidence });
  const wSum = parts.reduce((s, p) => s + p.w, 0);
  const confidence = wSum > 0 ? r2(parts.reduce((s, p) => s + p.w * p.c, 0) / wSum) : 0;

  // Ambiguity: low/moderate/high from the unified confidence, escalated when two
  // outcome models are near-tied (competing decisions) or the journey degraded.
  let ambiguity: UnifiedDecision['ambiguity'] = confidence >= 0.7 ? 'low' : confidence >= 0.4 ? 'moderate' : 'high';
  const tiedOutcomes =
    orderedModels.length >= 2 && Math.abs(orderedModels[0].confidence - orderedModels[1].confidence) <= 0.1;
  if (tiedOutcomes || journey?.degraded) {
    ambiguity = ambiguity === 'low' ? 'moderate' : 'high';
    if (tiedOutcomes) why.push('Two outcome models are near-tied — decision is competing.');
  }

  return { stage: stagePart, primary_outcome, route, confidence, ambiguity, why };
}

/**
 * Build the per-session activation envelope. NEVER throws — on any failure it returns a
 * fully-degraded (but valid) envelope. Returns null only when the session is unknown.
 */
export async function buildActivationEnvelope(pool: Pool, sessionId: string): Promise<ActivationEnvelope | null> {
  let core: SessionCore | undefined;
  let stage: StageState | null = null;
  let outcome: OutcomeSummary | null = null;
  let journey: JourneyResult | null = null;

  try {
    core = await loadSessionCore(pool, sessionId);
    if (core === undefined) return null; // unknown session
    [stage, outcome, journey] = await Promise.all([
      getSessionStage(pool, sessionId).catch(() => null),
      getSessionOutcomes(pool, sessionId).catch(() => null),
      getSessionJourney(pool, sessionId).catch(() => null),
    ]);
  } catch {
    // fall through to a degraded envelope with whatever resolved
  }

  const decision = composeDecision(stage, outcome, journey);
  const composed_from = [
    stage ? 'stage' : null,
    outcome && !outcome.unclassified ? 'outcome' : null,
    journey ? 'journey' : null,
  ].filter(Boolean) as string[];

  const ctx: DecisionContext = {
    sessionId,
    email: core?.email ?? null,
    userId: core?.userId ?? null,
    concern_name: core?.concern_name ?? null,
    persona: core?.persona ?? null,
    stage,
    outcome,
    journey,
    decision,
  };

  // Product slot — the L3 route → product mapping. Ready only when a real (non-degraded)
  // route with a product path resolved.
  const productPath = journey?.product_mapping?.product_path ?? null;
  const product = journey
    ? {
        ready: !journey.degraded && !!productPath,
        reason: journey.degraded ? 'route_degraded' : productPath ? 'routed' : 'no_product_path',
        route_key: journey.primary_route.route_key,
        product_path: productPath,
      }
    : { ready: false, reason: 'no_route', route_key: null, product_path: null };

  // Growth Plan slot — bridge-gated.
  let growthPlan: ActivationSlot = { ready: false, reason: 'bridge_disabled' };
  const growthBridgeOn = isJourneyGrowthPlanBridgeEnabled();
  if (growthBridgeOn) {
    const g: GrowthPlanActivation = await deriveGrowthPlanActivation(pool, ctx).catch(
      () => ({ ready: false, reason: 'growth_plan_bridge_error', source: null, plan: null }),
    );
    growthPlan = { ready: g.ready, reason: g.reason, source: g.source, plan: g.plan };
  }

  // Mentor slot — bridge-gated.
  let mentor: ActivationSlot = { ready: false, reason: 'bridge_disabled' };
  const mentorBridgeOn = isDecisionMentorBridgeEnabled();
  if (mentorBridgeOn) {
    const m: MentorActivation = deriveMentorActivation(ctx);
    mentor = {
      ready: m.ready,
      reason: m.reason,
      recommended_types: m.recommended_types,
      match_reason: m.match_reason,
      source: m.source,
    };
  }

  // Commercial slots (WC-7C Wave 1) — flag-gated. OFF → byte-identical legacy: the
  // subscription literal is preserved and no `offer` field is emitted.
  let subscription: ActivationEnvelope['subscription'] = { ready: false, reason: 'out_of_scope_tier_b' };
  let offer: OfferActivation | undefined;
  const commercialOn = isCommercialActivationEnabled();
  if (commercialOn) {
    // Safety (D7) overrides commerce — a crisis/escalation event suppresses all offers.
    // Fail CLOSED: if the check itself rejects, block commerce.
    const safetyBlocked = await checkSafetyOverride(pool, sessionId).catch(() => true);
    const sub: SubscriptionActivation = await deriveSubscriptionActivation(
      pool,
      { email: ctx.email, decision: { confidence: decision.confidence, ambiguity: decision.ambiguity, stage: decision.stage } },
      { safetyBlocked },
    ).catch(() => ({
      ready: false,
      reason: 'subscription_engine_error',
      target: null,
      confidence_gated: false,
      already_owned: [],
      upsell: { ready: false, trigger: null, reason: 'error' },
      source: 'capadex_stage_ladder' as const,
    }));
    subscription = sub;
    offer = deriveOfferActivation(
      {
        decisionConfidence: decision.confidence,
        product: { ready: product.ready, reason: product.reason, route_key: product.route_key, product_path: product.product_path },
        growthPlan,
        mentor,
      },
      sub,
      { safetyBlocked },
    );
  }

  const degraded =
    !stage || !outcome || outcome.unclassified || !journey || !!journey.degraded;

  return {
    enabled: true,
    session_id: sessionId,
    degraded,
    ...(degraded ? { reason: outcome?.reason ?? (journey?.degraded ? 'route_degraded' : 'partial_decision') } : {}),
    decision,
    product,
    growthPlan,
    mentor,
    subscription,
    ...(offer ? { offer } : {}),
    meta: {
      composed_from,
      bridges: { growthPlan: growthBridgeOn, mentor: mentorBridgeOn, ...(commercialOn ? { commercial: true } : {}) },
    },
  };
}
