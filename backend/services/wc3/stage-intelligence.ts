/**
 * CAPADEX WC-3 L1 — Stage Intelligence (Phase A).
 *
 * Compose-only: derives a per-session behavioural STAGE for the canonical lifecycle
 * (see `backend/lib/lifecycle.ts` / Blueprint 06) from data that already exists — the
 * session's `stage_code` and the user's CSI profile. It NEVER recomputes any score,
 * NEVER edits ontology / signals / concerns. It persists the current stage state
 * (upsert by session) and an append-only progression log.
 *
 * LIFECYCLE FRAMING (NOT a competing canon): the canon has FOUR coded stages
 * (CAP_CUR Curiosity → CAP_INS Insight → CAP_GRW Growth → CAP_MAS Mastery). This
 * telemetry persists each session on a 0..4 PROGRESSION SCALE that is a projection of
 * those four onto a scale prefixed by the UNCODED pre-stage "Awareness" (index 0, for
 * sessions with no coded stage) and renders CAP_INS under its sanctioned DISPLAY ALIAS
 * "Clarity". The persisted `canonical_stage` strings ('Awareness'/'Curiosity'/
 * 'Clarity'/'Growth'/'Mastery') are LOAD-BEARING — existing rows and downstream
 * consumers (subscription floor, decision text, memory, trend) key on them — so they
 * are preserved verbatim and sourced from the canon.
 *
 * Strictly additive + never-throws: the caller is gated on `isWc3StageEnabled()`.
 */
import type { Pool } from 'pg';
import { ensureWc3StageSchema } from './wc3-schema';
import {
  STAGE_CODE_TO_LABEL,
  INSIGHT_DISPLAY_ALIAS,
  UNCODED_PRE_STAGE,
  STORED_STAGE_ORDER,
  STORED_STAGE_WEIGHT,
} from '../../lib/lifecycle';

/**
 * CAPADEX stage_code → the stage label this WC-3 telemetry persists. Labels are sourced
 * from the canonical lifecycle; CAP_INS is persisted under its sanctioned DISPLAY ALIAS
 * "Clarity" (the SAME stage as Insight — see `backend/lib/lifecycle.ts`).
 */
export const STAGE_ENTITY_MAP: Record<string, string> = {
  CAP_CUR: STAGE_CODE_TO_LABEL.CAP_CUR, // Curiosity
  CAP_INS: INSIGHT_DISPLAY_ALIAS,        // Clarity (display alias of Insight / CAP_INS)
  CAP_GRW: STAGE_CODE_TO_LABEL.CAP_GRW, // Growth
  CAP_MAS: STAGE_CODE_TO_LABEL.CAP_MAS, // Mastery
};

/**
 * WC-3 telemetry PROGRESSION ORDER (index 0..4) — the canonical stored-string projection
 * sourced verbatim from `backend/lib/lifecycle.ts` (`STORED_STAGE_ORDER`), NOT a competing
 * canon. Index 0 is the UNCODED pre-stage "Awareness" (sessions with no coded stage_code);
 * CAP_INS appears under its display alias "Clarity". Re-exported under the WC-3 name so the
 * persisted index math and the `CanonicalStage` union type (derived by
 * question-stage-intelligence) stay byte-identical while having ONE source of truth.
 */
export const WC3_PROGRESSION_ORDER = STORED_STAGE_ORDER;

export const WC3_PROGRESSION_WEIGHT: Record<string, number> = STORED_STAGE_WEIGHT;

export function canonicalStageFor(stageCode: string | null | undefined): string {
  if (!stageCode) return UNCODED_PRE_STAGE;
  return STAGE_ENTITY_MAP[stageCode] || UNCODED_PRE_STAGE;
}

export function stageOrderIndex(canonicalStage: string): number {
  const i = (WC3_PROGRESSION_ORDER as readonly string[]).indexOf(canonicalStage);
  return i < 0 ? 0 : i;
}

export interface StageState {
  session_id: string;
  canonical_stage: string;
  stage_order_index: number;
  stage_weight: number | null;
  source_stage_code: string | null;
  score: number | null;
  score_level: string | null;
  csi_score: number | null;
  csi_stage: string | null;
  confidence: number;
  persisted: boolean;
}

interface ResolveInput {
  sessionId: string;
  userEmail?: string | null;
  userId?: string | null;
  concernName?: string | null;
  stageCode?: string | null;
  score?: number | null;
  scoreLevel?: string | null;
}

/** Best-effort read of the user's already-computed CSI (never recomputes). */
async function readCsi(pool: Pool, email: string | null | undefined): Promise<{ csi_score: number | null; csi_stage: string | null }> {
  if (!email) return { csi_score: null, csi_stage: null };
  try {
    const { rows } = await pool.query(
      `SELECT csi_score, csi_stage FROM csi_profiles WHERE LOWER(user_email) = LOWER($1) LIMIT 1`,
      [email],
    );
    if (rows.length === 0) return { csi_score: null, csi_stage: null };
    const r = rows[0];
    return { csi_score: r.csi_score != null ? Number(r.csi_score) : null, csi_stage: r.csi_stage ?? null };
  } catch {
    return { csi_score: null, csi_stage: null };
  }
}

/**
 * Resolve + persist the per-session stage. Returns the stage state, or null if
 * anything fails (never throws — the post-completion hook must not break).
 */
export async function resolveSessionStage(pool: Pool, input: ResolveInput): Promise<StageState | null> {
  try {
    await ensureWc3StageSchema(pool);
    const canonical = canonicalStageFor(input.stageCode);
    const orderIndex = stageOrderIndex(canonical);
    const weight = WC3_PROGRESSION_WEIGHT[canonical] ?? null;
    const { csi_score, csi_stage } = await readCsi(pool, input.userEmail);
    // Confidence: a recognised stage_code is the primary signal (0.6); a present
    // CSI profile adds corroboration (0.4). An unmapped/absent stage_code with no
    // CSI degrades honestly toward 0.
    const stageKnown = !!(input.stageCode && STAGE_ENTITY_MAP[input.stageCode]);
    const confidence = Math.round(((stageKnown ? 0.6 : 0) + (csi_score != null ? 0.4 : 0)) * 100) / 100;

    await pool.query(
      `INSERT INTO wc3_stage_state
         (session_id, user_email, user_id, source_stage_code, canonical_stage,
          stage_order_index, stage_weight, score, score_level, csi_score, csi_stage,
          confidence, resolved_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now(), now())
       ON CONFLICT (session_id) DO UPDATE SET
         user_email = EXCLUDED.user_email,
         user_id = EXCLUDED.user_id,
         source_stage_code = EXCLUDED.source_stage_code,
         canonical_stage = EXCLUDED.canonical_stage,
         stage_order_index = EXCLUDED.stage_order_index,
         stage_weight = EXCLUDED.stage_weight,
         score = EXCLUDED.score,
         score_level = EXCLUDED.score_level,
         csi_score = EXCLUDED.csi_score,
         csi_stage = EXCLUDED.csi_stage,
         confidence = EXCLUDED.confidence,
         updated_at = now()`,
      [
        input.sessionId, input.userEmail ?? null, input.userId ?? null, input.stageCode ?? null,
        canonical, orderIndex, weight, input.score ?? null, input.scoreLevel ?? null,
        csi_score, csi_stage, confidence,
      ],
    );
    // Append-only progression log.
    await pool.query(
      `INSERT INTO wc3_stage_progression
         (session_id, user_email, canonical_stage, stage_order_index, score, csi_score, csi_stage, trigger)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'session_complete')`,
      [input.sessionId, input.userEmail ?? null, canonical, orderIndex, input.score ?? null, csi_score, csi_stage],
    );

    return {
      session_id: input.sessionId,
      canonical_stage: canonical,
      stage_order_index: orderIndex,
      stage_weight: weight,
      source_stage_code: input.stageCode ?? null,
      score: input.score ?? null,
      score_level: input.scoreLevel ?? null,
      csi_score, csi_stage, confidence,
      persisted: true,
    };
  } catch (err) {
    console.warn('[wc3-stage] resolveSessionStage failed (non-blocking):', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Read-only stage for the GET route. Prefers the persisted state; if none exists
 * (e.g. session completed before the flag was enabled), computes a transient
 * (non-persisted) stage from the session row. Returns null when the session is
 * unknown. Never writes, never throws to the caller's surface.
 */
export async function getSessionStage(pool: Pool, sessionId: string): Promise<(StageState & { progression?: any[] }) | null> {
  await ensureWc3StageSchema(pool);
  const { rows } = await pool.query(
    `SELECT * FROM wc3_stage_state WHERE session_id = $1 LIMIT 1`,
    [sessionId],
  );
  if (rows.length > 0) {
    const r = rows[0];
    const { rows: prog } = await pool.query(
      `SELECT canonical_stage, stage_order_index, score, csi_score, csi_stage, trigger, created_at
         FROM wc3_stage_progression WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId],
    );
    return {
      session_id: r.session_id,
      canonical_stage: r.canonical_stage,
      stage_order_index: Number(r.stage_order_index),
      stage_weight: r.stage_weight != null ? Number(r.stage_weight) : null,
      source_stage_code: r.source_stage_code,
      score: r.score != null ? Number(r.score) : null,
      score_level: r.score_level,
      csi_score: r.csi_score != null ? Number(r.csi_score) : null,
      csi_stage: r.csi_stage,
      confidence: Number(r.confidence),
      persisted: true,
      progression: prog,
    };
  }
  // Transient fallback (read-only).
  const sess = await pool.query(
    `SELECT stage_code, score, guest_email, concern_name FROM capadex_sessions WHERE id = $1 LIMIT 1`,
    [sessionId],
  );
  if (sess.rows.length === 0) return null;
  const s = sess.rows[0];
  const canonical = canonicalStageFor(s.stage_code);
  const { csi_score, csi_stage } = await readCsi(pool, s.guest_email);
  const stageKnown = !!(s.stage_code && STAGE_ENTITY_MAP[s.stage_code]);
  return {
    session_id: sessionId,
    canonical_stage: canonical,
    stage_order_index: stageOrderIndex(canonical),
    stage_weight: WC3_PROGRESSION_WEIGHT[canonical] ?? null,
    source_stage_code: s.stage_code ?? null,
    score: s.score != null ? Number(s.score) : null,
    score_level: null,
    csi_score, csi_stage,
    confidence: Math.round(((stageKnown ? 0.6 : 0) + (csi_score != null ? 0.4 : 0)) * 100) / 100,
    persisted: false,
    progression: [],
  };
}
