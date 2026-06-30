/**
 * CAPADEX Canonical Lifecycle — SINGLE SOURCE OF TRUTH (backend).
 *
 * Frozen by Product Blueprint 06:
 *   backend/audit/capadex-3.0-product-blueprint-final/06_CANONICAL_LIFECYCLE.md
 *
 * FOUR coded stages, in order:
 *   CAP_CUR  Curiosity  (order 0)
 *   CAP_INS  Insight    (order 1)   ← display alias: "Clarity"
 *   CAP_GRW  Growth     (order 2)
 *   CAP_MAS  Mastery    (order 3)
 *
 * "Clarity" is the user-facing DISPLAY ALIAS of Insight (CAP_INS) — the SAME stage,
 * NEVER a fifth stage. "Awareness" is the UNCODED pre-stage (a session that has not
 * yet reached Curiosity / carries no coded `stage_code`) — conceptual only, NEVER a
 * CAP_* code and NEVER persisted as a `stage_code`.
 *
 * Every backend lifecycle reference MUST resolve its stage codes/labels through this
 * module. The frontend mirrors this canon in `frontend/src/lib/behavioural-insights.ts`
 * (`CAPADEX_STAGES`) because the Vite app cannot import backend modules.
 *
 * Pure constants + helpers: no DB, no I/O, no side effects.
 */

export type LifecycleStageCode = 'CAP_CUR' | 'CAP_INS' | 'CAP_GRW' | 'CAP_MAS';

export interface LifecycleStage {
  /** Canonical stage code. */
  code: LifecycleStageCode;
  /** Canonical label (what the platform calls the stage). */
  label: string;
  /** 0-based order among the FOUR coded stages. */
  order: number;
  /** User-facing display alias, when one is sanctioned (CAP_INS → "Clarity"). */
  displayAlias?: string;
  /** Short description. */
  description: string;
}

/** The FOUR canonical coded stages, in progression order. */
export const LIFECYCLE_STAGES: readonly LifecycleStage[] = [
  { code: 'CAP_CUR', label: 'Curiosity', order: 0, description: 'Surface awareness & first signals' },
  { code: 'CAP_INS', label: 'Insight',   order: 1, displayAlias: 'Clarity', description: 'Patterns & self-understanding' },
  { code: 'CAP_GRW', label: 'Growth',    order: 2, description: 'Strategy & habit formation' },
  { code: 'CAP_MAS', label: 'Mastery',   order: 3, description: 'Control & peak performance' },
] as const;

/** Ordered list of the four canonical codes: ['CAP_CUR','CAP_INS','CAP_GRW','CAP_MAS']. */
export const LIFECYCLE_STAGE_CODES: readonly LifecycleStageCode[] =
  LIFECYCLE_STAGES.map((s) => s.code) as LifecycleStageCode[];

/** Canonical code → canonical label (Curiosity / Insight / Growth / Mastery). */
export const STAGE_CODE_TO_LABEL: Record<string, string> = Object.fromEntries(
  LIFECYCLE_STAGES.map((s) => [s.code, s.label]),
);

/**
 * Insight's sanctioned user-facing DISPLAY ALIAS. The SAME stage as CAP_INS — never a
 * separate / fifth stage. Use only for display copy; the canonical label is "Insight".
 */
export const INSIGHT_DISPLAY_ALIAS = 'Clarity';

/**
 * The UNCODED pre-stage. Conceptual only — never a CAP_* code, never persisted as a
 * `stage_code`. Represents a subject who has not yet entered the coded lifecycle.
 */
export const UNCODED_PRE_STAGE = 'Awareness';

/** Canonical label for a stage code, or null when the code is not a lifecycle stage. */
export function stageLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return STAGE_CODE_TO_LABEL[code] ?? null;
}

/** 0-based order of a coded stage, or -1 when the code is not a lifecycle stage. */
export function stageOrder(code: string | null | undefined): number {
  const s = LIFECYCLE_STAGES.find((x) => x.code === code);
  return s ? s.order : -1;
}

/** Type guard: is the value one of the four canonical coded stages? */
export function isLifecycleStageCode(code: string | null | undefined): code is LifecycleStageCode {
  return !!code && (LIFECYCLE_STAGE_CODES as readonly string[]).includes(code);
}
