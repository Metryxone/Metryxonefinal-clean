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

/**
 * STORED-STRING PROGRESSION PROJECTION — the SINGLE source of truth for the 5-element
 * order that the DB persists and that string-keyed readers work in.
 *
 * The platform stores human-readable stage STRINGS (not CAP_* codes) in WC-3 telemetry
 * (`wc3_stage_state.canonical_stage`, `wc3_stage_definitions`) and ranks questions by
 * the same labels. That stored representation is a PROJECTION of the four coded stages:
 * it prefixes them with the UNCODED pre-stage "Awareness" (index 0, for sessions with no
 * coded stage) and renders CAP_INS under its sanctioned DISPLAY ALIAS "Clarity". It is
 * NEVER a competing five-stage canon.
 *
 * Every reader that works in stored strings imports THIS constant (and `STORED_STAGE_WEIGHT`)
 * so a user's lifecycle stage orders/weights identically everywhere — no per-module copy
 * can drift. Values are byte-identical to the prior per-module literals; this is a
 * read-layer single-sourcing, NOT a data migration (existing rows are untouched).
 */
export const STORED_STAGE_ORDER = [UNCODED_PRE_STAGE, 'Curiosity', INSIGHT_DISPLAY_ALIAS, 'Growth', 'Mastery'] as const;

/** A value of the stored-string progression projection ('Awareness' | … | 'Mastery'). */
export type StoredStage = typeof STORED_STAGE_ORDER[number];

/** Stored-stage → progression weight (the canonical projection weights). */
export const STORED_STAGE_WEIGHT: Record<string, number> = {
  [UNCODED_PRE_STAGE]: 0.25,
  Curiosity: 0.50,
  [INSIGHT_DISPLAY_ALIAS]: 0.75,
  Growth: 1.00,
  Mastery: 1.25,
};

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

/**
 * The resolution of a STORED stage value against the canon.
 *  - `code`             canonical code (CAP_*), or null for the uncoded pre-stage / unrecognized.
 *  - `label`            canonical label (Curiosity/Insight/Growth/Mastery), or null otherwise.
 *  - `order`            0-based order among the four coded stages, or -1 otherwise.
 *  - `isUncodedPreStage` true only for the sanctioned uncoded pre-stage ("Awareness").
 *  - `recognized`       true when the input mapped to a coded stage OR the pre-stage.
 */
export interface ResolvedStoredStage {
  code: LifecycleStageCode | null;
  label: string | null;
  order: number;
  isUncodedPreStage: boolean;
  recognized: boolean;
}

/**
 * Lookup of every STORED representation → canonical code, built from the canon so it can
 * never drift: each stage's code (e.g. `cap_ins`), its canonical label (`insight`), and
 * its sanctioned display alias (`clarity` → CAP_INS) all resolve to the same code.
 * Keys are lower-cased.
 */
const STORED_STAGE_TO_CODE: Readonly<Record<string, LifecycleStageCode>> = (() => {
  const m: Record<string, LifecycleStageCode> = {};
  for (const s of LIFECYCLE_STAGES) {
    m[s.code.toLowerCase()] = s.code;       // CAP_INS
    m[s.label.toLowerCase()] = s.code;      // insight
    if (s.displayAlias) m[s.displayAlias.toLowerCase()] = s.code; // clarity → CAP_INS
  }
  return m;
})();

/**
 * The stored representations of the UNCODED pre-stage ("Awareness"). It is NOT a coded
 * stage — it carries no CAP_* code — but it IS a sanctioned value that downstream reads
 * (subscription floor, WC3 trend) recognize. `cap_awr` is the legacy pseudo-code some
 * older WC3 rows / maps used for it.
 */
const UNCODED_PRE_STAGE_KEYS: ReadonlySet<string> = new Set([
  UNCODED_PRE_STAGE.toLowerCase(),
  'cap_awr',
]);

/**
 * BACKWARD-COMPATIBLE READ-LAYER NORMALIZER — the single source of truth for resolving any
 * persisted stage string to the canon. Accepts the canonical code (`CAP_INS`), the canonical
 * label (`Insight`), the sanctioned display alias (`Clarity`), or the uncoded pre-stage
 * (`Awareness` / `CAP_AWR`) — case-insensitively, trimmed. Pure; never throws.
 *
 * This formalizes the sanctioned aliases AT THE READ LAYER (Clarity = CAP_INS, Awareness =
 * uncoded pre-stage), so stored data and the canon agree without rewriting any rows. Stored
 * `canonical_stage` strings stay verbatim; every consumer resolves them through this helper.
 */
export function normalizeStoredStage(value: string | null | undefined): ResolvedStoredStage {
  const key = (value ?? '').toString().trim().toLowerCase();
  if (key !== '' && UNCODED_PRE_STAGE_KEYS.has(key)) {
    return { code: null, label: null, order: -1, isUncodedPreStage: true, recognized: true };
  }
  const code = key === '' ? undefined : STORED_STAGE_TO_CODE[key];
  if (!code) {
    return { code: null, label: null, order: -1, isUncodedPreStage: false, recognized: false };
  }
  return {
    code,
    label: STAGE_CODE_TO_LABEL[code],
    order: stageOrder(code),
    isUncodedPreStage: false,
    recognized: true,
  };
}
