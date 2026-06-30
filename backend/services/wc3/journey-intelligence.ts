/**
 * CAPADEX WC-3 L3 — Journey Intelligence (Phase C).
 *
 * COMPOSE-ONLY. After a session completes, this resolves a per-session ROUTE
 * recommendation — which product pathway the assessed person should be routed to —
 * using L1 Stage Intelligence and L2 Outcome Intelligence as the ONLY dependencies.
 * It NEVER recomputes any score and NEVER touches ontology / signals / concerns.
 *
 * Supported routes (seeded catalog `wc3_journey_routes`):
 *   LBI · Career Builder · Employability Index · Competitive Exam Intelligence · Mentoring.
 *
 * Composition:
 *   • route fit  = Σ over the session's ACTIVATED L2 outcome models of
 *                  (route.model_affinity[model] × model.confidence). Only real,
 *                  activated outcome models contribute — never fabricated.
 *   • Primary    = highest-fit route; Secondary = next-best real route (or the
 *                  Mentoring fallback as the alternative).
 *   • Expected Outcome = the highest-confidence outcome model the primary route serves.
 *   • Expected Stage Advancement = current canonical stage → next stage up (from L1).
 *   • Product Mapping = the primary route's product key / label / path.
 *
 * Business invariants (enforced here AND in the schema):
 *   (a) NO session/concern ever terminates without a route. When no outcome model
 *       activates (empty behavioural spine / UNCLASSIFIED L2), this DETERMINISTICALLY
 *       routes to the Mentoring fallback with `degraded:true` + a LOW_CONFIDENCE band.
 *   (b) Competitive Exam pathways are ALWAYS supported even when the corpus is still
 *       expanding: that route ships `corpus_status='corpus_pending'`, so when it wins
 *       (or ties) it is routed to under a CORPUS_PENDING band rather than dropped.
 *
 * Strictly additive + never-throws: the caller is gated on `isWc3JourneyEnabled()`.
 */
import type { Pool } from 'pg';
import { ensureWc3JourneySchema } from './wc3-schema';
import { getSessionStage, WC3_PROGRESSION_ORDER, type StageState } from './stage-intelligence';
import { getSessionOutcomes, type OutcomeSummary } from './outcome-intelligence';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Calibration R2: the corpus-pending exam route + the model whose DEDICATED
 *  (EXAM_*-prefixed) constructs qualify it to be PRIMARY. */
const EXAM_ROUTE_KEY = 'competitive_exam';
const EXAM_MODEL_KEY = 'exam_readiness';

export type ConfidenceBand =
  | 'HIGH_CONFIDENCE'
  | 'MODERATE_CONFIDENCE'
  | 'LOW_CONFIDENCE'
  | 'CORPUS_PENDING';

export interface JourneyRouteRef {
  route_key: string;
  display_label: string;
  product_key: string;
  product_label: string;
  product_path: string | null;
  corpus_status: string;
}

export interface JourneyCandidate {
  route_key: string;
  display_label: string;
  fit_score: number;
  corpus_status: string;
  contributing_models: string[];
  rank: number;
}

export interface JourneyResult {
  session_id: string;
  status: 'routed';
  degraded: boolean;
  reason?: string;
  primary_route: JourneyRouteRef;
  secondary_route: JourneyRouteRef | null;
  route_confidence: number;
  confidence_band: ConfidenceBand;
  route_reason: string;
  expected_outcome: string | null;
  expected_outcome_key: string | null;
  expected_stage: {
    current: string | null;
    desired: string | null;
    advancement: string;
  };
  product_mapping: {
    product_key: string;
    product_label: string;
    product_path: string | null;
  };
  contributing_models: string[];
  candidates: JourneyCandidate[];
}

interface RouteRow {
  route_key: string;
  display_label: string;
  product_key: string;
  product_label: string;
  product_path: string | null;
  model_affinities: Record<string, number>;
  corpus_status: string;
  is_fallback: boolean;
  fallback_priority: number;
  description: string | null;
}

interface ContribModel {
  model_key: string;
  display_label: string;
  confidence: number;
  affinity: number;
}

interface RouteFit {
  route: RouteRow;
  fit: number;
  contributing: ContribModel[];
}

interface ResolveInput {
  sessionId: string;
  userEmail?: string | null;
  userId?: string | null;
  /** Pass the freshly-resolved L1 stage to avoid a redundant read. */
  stageState?: StageState | null;
  /** Pass the freshly-resolved L2 outcome summary to avoid a redundant read. */
  outcomeSummary?: OutcomeSummary | null;
}

function toRef(r: RouteRow): JourneyRouteRef {
  return {
    route_key: r.route_key,
    display_label: r.display_label,
    product_key: r.product_key,
    product_label: r.product_label,
    product_path: r.product_path,
    corpus_status: r.corpus_status,
  };
}

function bandFor(confidence: number, corpusStatus: string): ConfidenceBand {
  if (corpusStatus === 'corpus_pending') return 'CORPUS_PENDING';
  if (confidence >= 0.7) return 'HIGH_CONFIDENCE';
  if (confidence >= 0.4) return 'MODERATE_CONFIDENCE';
  return 'LOW_CONFIDENCE';
}

async function loadRoutes(pool: Pool): Promise<RouteRow[]> {
  const { rows } = await pool.query(
    `SELECT route_key, display_label, product_key, product_label, product_path,
            model_affinities, corpus_status, is_fallback, fallback_priority, description
       FROM wc3_journey_routes
      ORDER BY fallback_priority ASC, route_key ASC`,
  );
  return rows.map((r) => ({
    route_key: r.route_key,
    display_label: r.display_label,
    product_key: r.product_key,
    product_label: r.product_label,
    product_path: r.product_path ?? null,
    model_affinities:
      r.model_affinities && typeof r.model_affinities === 'object'
        ? (r.model_affinities as Record<string, number>)
        : {},
    corpus_status: r.corpus_status ?? 'ready',
    is_fallback: !!r.is_fallback,
    fallback_priority: Number(r.fallback_priority ?? 100),
    description: r.description ?? null,
  }));
}

/** Stable sort: fit desc → fallback_priority asc → route_key asc. */
function rankFits(fits: RouteFit[]): RouteFit[] {
  return [...fits].sort((a, b) => {
    if (b.fit !== a.fit) return b.fit - a.fit;
    if (a.route.fallback_priority !== b.route.fallback_priority) {
      return a.route.fallback_priority - b.route.fallback_priority;
    }
    return a.route.route_key.localeCompare(b.route.route_key);
  });
}

function pickFallbackRoute(routes: RouteRow[]): RouteRow {
  const fallbacks = routes.filter((r) => r.is_fallback).sort((a, b) => a.fallback_priority - b.fallback_priority);
  if (fallbacks.length > 0) return fallbacks[0];
  // Defensive: if no route is flagged as fallback, use the lowest-priority route so a
  // route is ALWAYS produced (business invariant: never terminate without a route).
  return [...routes].sort((a, b) => a.fallback_priority - b.fallback_priority)[0];
}

function topContributor(contributing: ContribModel[]): ContribModel | null {
  if (contributing.length === 0) return null;
  return [...contributing].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (b.affinity !== a.affinity) return b.affinity - a.affinity;
    return a.model_key.localeCompare(b.model_key);
  })[0];
}

function stageAdvancement(stage: StageState | null): { current: string | null; desired: string | null; advancement: string } {
  const current = stage?.canonical_stage ?? null;
  if (!current) return { current: null, desired: null, advancement: 'unavailable' };
  const idx = (WC3_PROGRESSION_ORDER as readonly string[]).indexOf(current);
  const last = WC3_PROGRESSION_ORDER.length - 1;
  const desiredIdx = idx < 0 ? 0 : Math.min(idx + 1, last);
  const desired = WC3_PROGRESSION_ORDER[desiredIdx];
  return { current, desired, advancement: `${current} → ${desired}` };
}

/**
 * Pure compute (NO writes): build the per-session route recommendation. ALWAYS
 * returns a routed result (never null) — the Mentoring fallback guarantees the
 * "never terminate without a route" invariant.
 */
export async function buildJourney(pool: Pool, input: ResolveInput): Promise<JourneyResult> {
  const sessionId = input.sessionId;
  const routes = await loadRoutes(pool);

  const stage = input.stageState ?? (await getSessionStage(pool, sessionId));
  const outcome = input.outcomeSummary ?? (await getSessionOutcomes(pool, sessionId));
  const activeModels =
    outcome && !outcome.unclassified && Array.isArray(outcome.models) ? outcome.models : [];

  const stageAdv = stageAdvancement(stage);

  // Score every route from the REAL activated outcome models.
  const fits: RouteFit[] = routes.map((route) => {
    let fit = 0;
    const contributing: ContribModel[] = [];
    for (const m of activeModels) {
      const affinity = route.model_affinities[m.model_key];
      if (affinity && affinity > 0) {
        fit += affinity * m.confidence;
        contributing.push({
          model_key: m.model_key,
          display_label: m.display_label,
          confidence: m.confidence,
          affinity,
        });
      }
    }
    return { route, fit: r2(fit), contributing };
  });

  const ranked = rankFits(fits);
  const realCandidates = ranked.filter((f) => f.fit > 0);

  const candidates: JourneyCandidate[] = (realCandidates.length > 0 ? realCandidates : []).map((f, i) => ({
    route_key: f.route.route_key,
    display_label: f.route.display_label,
    fit_score: f.fit,
    corpus_status: f.route.corpus_status,
    contributing_models: f.contributing.map((c) => c.model_key),
    rank: i,
  }));

  let degraded = false;
  let reason: string | undefined;
  let primaryFit: RouteFit;
  let secondaryRoute: RouteRow | null = null;
  let routeConfidence: number;
  let examGuardApplied = false;

  if (realCandidates.length === 0) {
    // Invariant (a): nothing activated → deterministic Mentoring fallback.
    const fallback = pickFallbackRoute(routes);
    primaryFit = { route: fallback, fit: 0, contributing: [] };
    degraded = true;
    reason = outcome?.reason ?? (outcome ? 'no_outcome_activation' : 'outcome_unavailable');
    routeConfidence = 0.2; // honest low floor — a routed-by-default recommendation.
    candidates.push({
      route_key: fallback.route_key,
      display_label: fallback.display_label,
      fit_score: 0,
      corpus_status: fallback.corpus_status,
      contributing_models: [],
      rank: 0,
    });
  } else {
    // Calibration R2: the corpus-pending Competitive Exam route must have DEDICATED
    // exam evidence (≥1 EXAM_*-prefixed construct matched the exam_readiness model)
    // before it can be PRIMARY. Otherwise it would win on a construct it SHARES with
    // other models (e.g. STRESS_MANAGEMENT, also in confidence_stability), steering a
    // non-exam concern (a parent's family stress) into exam prep. When the guard
    // fires, the exam pathway is RETAINED as the secondary route (invariant (b):
    // always supported) — only demoted from primary; candidate ranking stays honest
    // (it keeps its true raw-fit rank), and the route_reason explains the demotion.
    const hasDedicatedExamEvidence = activeModels.some(
      (m) =>
        m.model_key === EXAM_MODEL_KEY &&
        Array.isArray(m.matched_constructs) &&
        m.matched_constructs.some((c) => String(c).startsWith('EXAM_')),
    );
    let primaryIndex = 0;
    if (
      !hasDedicatedExamEvidence &&
      realCandidates[0].route.route_key === EXAM_ROUTE_KEY &&
      realCandidates.length >= 2
    ) {
      const altIndex = realCandidates.findIndex(
        (f, i) => i > 0 && f.route.route_key !== EXAM_ROUTE_KEY,
      );
      if (altIndex > 0) {
        primaryIndex = altIndex;
        examGuardApplied = true;
        reason = 'exam_guard_demoted';
      }
    }
    primaryFit = realCandidates[primaryIndex];
    routeConfidence = Math.min(r2(primaryFit.fit), 1);
    if (examGuardApplied) {
      // Keep the higher-raw-fit Competitive Exam route visible as the secondary.
      secondaryRoute = realCandidates[0].route;
    } else if (realCandidates.length >= 2) {
      secondaryRoute = realCandidates[1].route;
    } else {
      const fb = pickFallbackRoute(routes);
      secondaryRoute = fb.route_key !== primaryFit.route.route_key ? fb : null;
    }
  }

  const primaryRoute = primaryFit.route;
  const band = bandFor(routeConfidence, primaryRoute.corpus_status);
  const topModel = topContributor(primaryFit.contributing);

  // Route reason — honest, grounded in the real contributing models.
  let routeReason: string;
  if (degraded) {
    routeReason =
      `No outcome model activated for this session (${reason}); ` +
      `defaulted to ${primaryRoute.display_label} so the concern is never left without a route.`;
  } else {
    const labels = primaryFit.contributing
      .slice()
      .sort((a, b) => b.confidence - a.confidence)
      .map((c) => c.display_label);
    routeReason =
      `Routed to ${primaryRoute.display_label} — strongest product fit from ` +
      `${labels.join(', ')} (route confidence ${routeConfidence}, ${band}).` +
      (stageAdv.current ? ` Advances stage ${stageAdv.advancement}.` : '');
    if (examGuardApplied) {
      routeReason +=
        ` Competitive Exam Intelligence had a higher raw fit but matched only via a ` +
        `construct shared with other models (no dedicated exam evidence), so it was ` +
        `retained as the secondary pathway rather than the primary route.`;
    }
    if (band === 'CORPUS_PENDING') {
      routeReason +=
        ` The ${primaryRoute.display_label} pathway is corpus-pending; routed under ` +
        `CORPUS_PENDING pending corpus expansion (pathway always supported).`;
    }
  }

  return {
    session_id: sessionId,
    status: 'routed',
    degraded,
    ...(reason ? { reason } : {}),
    primary_route: toRef(primaryRoute),
    secondary_route: secondaryRoute ? toRef(secondaryRoute) : null,
    route_confidence: routeConfidence,
    confidence_band: band,
    route_reason: routeReason,
    expected_outcome: topModel?.display_label ?? null,
    expected_outcome_key: topModel?.model_key ?? null,
    expected_stage: stageAdv,
    product_mapping: {
      product_key: primaryRoute.product_key,
      product_label: primaryRoute.product_label,
      product_path: primaryRoute.product_path,
    },
    contributing_models: primaryFit.contributing.map((c) => c.model_key),
    candidates,
  };
}

/**
 * Resolve + persist the per-session route. Returns the journey result, or null if
 * anything fails (never throws — the post-completion hook must not break). ALWAYS
 * persists a route (primary_route is NOT NULL) so the invariant holds end-to-end.
 */
export async function resolveSessionJourney(pool: Pool, input: ResolveInput): Promise<JourneyResult | null> {
  try {
    await ensureWc3JourneySchema(pool);
    const result = await buildJourney(pool, input);

    const { rows } = await pool.query(
      `INSERT INTO wc3_journey_state
         (session_id, user_email, user_id, primary_route, secondary_route,
          route_confidence, confidence_band, route_reason, expected_outcome_key,
          expected_outcome, expected_stage_current, expected_stage_desired,
          expected_stage_advancement, product_key, product_label, product_path,
          contributing_models, degraded, status, resolved_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'routed', now(), now())
       ON CONFLICT (session_id) DO UPDATE SET
         user_email = EXCLUDED.user_email,
         user_id = EXCLUDED.user_id,
         primary_route = EXCLUDED.primary_route,
         secondary_route = EXCLUDED.secondary_route,
         route_confidence = EXCLUDED.route_confidence,
         confidence_band = EXCLUDED.confidence_band,
         route_reason = EXCLUDED.route_reason,
         expected_outcome_key = EXCLUDED.expected_outcome_key,
         expected_outcome = EXCLUDED.expected_outcome,
         expected_stage_current = EXCLUDED.expected_stage_current,
         expected_stage_desired = EXCLUDED.expected_stage_desired,
         expected_stage_advancement = EXCLUDED.expected_stage_advancement,
         product_key = EXCLUDED.product_key,
         product_label = EXCLUDED.product_label,
         product_path = EXCLUDED.product_path,
         contributing_models = EXCLUDED.contributing_models,
         degraded = EXCLUDED.degraded,
         status = 'routed',
         updated_at = now()
       RETURNING id`,
      [
        input.sessionId, input.userEmail ?? null, input.userId ?? null,
        result.primary_route.route_key, result.secondary_route?.route_key ?? null,
        result.route_confidence, result.confidence_band, result.route_reason,
        result.expected_outcome_key, result.expected_outcome,
        result.expected_stage.current, result.expected_stage.desired,
        result.expected_stage.advancement,
        result.product_mapping.product_key, result.product_mapping.product_label,
        result.product_mapping.product_path,
        result.contributing_models, result.degraded,
      ],
    );
    const stateId = rows[0]?.id;
    if (stateId != null) {
      await pool.query(`DELETE FROM wc3_journey_candidates WHERE journey_state_id = $1`, [stateId]);
      for (const c of result.candidates) {
        await pool.query(
          `INSERT INTO wc3_journey_candidates
             (journey_state_id, session_id, route_key, fit_score, corpus_status, contributing_models, rank)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [stateId, input.sessionId, c.route_key, c.fit_score, c.corpus_status, c.contributing_models, c.rank],
        );
      }
    }
    return result;
  } catch (err) {
    console.warn('[wc3-journey] resolveSessionJourney failed (non-blocking):', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Read-only route for the GET endpoint. Prefers the persisted state (joins
 * `wc3_journey_routes` so product labels are always catalog-sourced); if none
 * exists (e.g. session completed before the flag was enabled), computes a transient
 * (non-persisted) route. ALWAYS returns a routed result for a known session. Never
 * writes; returns null only when the session is unknown or a read fails.
 */
export async function getSessionJourney(pool: Pool, sessionId: string): Promise<JourneyResult | null> {
  try {
    await ensureWc3JourneySchema(pool);
    const { rows } = await pool.query(
      `SELECT s.*,
              p.display_label AS primary_label, p.product_key AS primary_product_key,
              p.product_label AS primary_product_label, p.product_path AS primary_product_path,
              p.corpus_status AS primary_corpus_status,
              x.display_label AS secondary_label, x.product_key AS secondary_product_key,
              x.product_label AS secondary_product_label, x.product_path AS secondary_product_path,
              x.corpus_status AS secondary_corpus_status
         FROM wc3_journey_state s
         JOIN wc3_journey_routes p ON p.route_key = s.primary_route
         LEFT JOIN wc3_journey_routes x ON x.route_key = s.secondary_route
        WHERE s.session_id = $1
        LIMIT 1`,
      [sessionId],
    );

    if (rows.length > 0) {
      const r = rows[0];
      const { rows: cand } = await pool.query(
        `SELECT c.route_key, rt.display_label, c.fit_score, c.corpus_status, c.contributing_models, c.rank
           FROM wc3_journey_candidates c
           JOIN wc3_journey_routes rt ON rt.route_key = c.route_key
          WHERE c.journey_state_id = $1
          ORDER BY c.rank ASC`,
        [r.id],
      );
      return {
        session_id: r.session_id,
        status: 'routed',
        degraded: !!r.degraded,
        ...(r.degraded ? { reason: 'persisted_fallback' } : {}),
        primary_route: {
          route_key: r.primary_route,
          display_label: r.primary_label,
          product_key: r.primary_product_key,
          product_label: r.primary_product_label,
          product_path: r.primary_product_path ?? null,
          corpus_status: r.primary_corpus_status ?? 'ready',
        },
        secondary_route: r.secondary_route
          ? {
              route_key: r.secondary_route,
              display_label: r.secondary_label,
              product_key: r.secondary_product_key,
              product_label: r.secondary_product_label,
              product_path: r.secondary_product_path ?? null,
              corpus_status: r.secondary_corpus_status ?? 'ready',
            }
          : null,
        route_confidence: Number(r.route_confidence),
        confidence_band: r.confidence_band as ConfidenceBand,
        route_reason: r.route_reason,
        expected_outcome: r.expected_outcome ?? null,
        expected_outcome_key: r.expected_outcome_key ?? null,
        expected_stage: {
          current: r.expected_stage_current ?? null,
          desired: r.expected_stage_desired ?? null,
          advancement: r.expected_stage_advancement ?? 'unavailable',
        },
        product_mapping: {
          product_key: r.product_key,
          product_label: r.product_label,
          product_path: r.product_path ?? null,
        },
        contributing_models: Array.isArray(r.contributing_models) ? r.contributing_models.map(String) : [],
        candidates: cand.map((c) => ({
          route_key: c.route_key,
          display_label: c.display_label,
          fit_score: Number(c.fit_score),
          corpus_status: c.corpus_status ?? 'ready',
          contributing_models: Array.isArray(c.contributing_models) ? c.contributing_models.map(String) : [],
          rank: Number(c.rank),
        })),
      };
    }

    // No persisted state — verify the session exists, then compute transiently.
    const sess = await pool.query(`SELECT id FROM capadex_sessions WHERE id = $1 LIMIT 1`, [sessionId]);
    if (sess.rows.length === 0) return null;
    return await buildJourney(pool, { sessionId });
  } catch (err) {
    console.warn('[wc3-journey] getSessionJourney failed, degrading:', err instanceof Error ? err.message : String(err));
    return null;
  }
}
