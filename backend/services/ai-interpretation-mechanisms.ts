/**
 * CAPADEX 3.0 — Program 3 · Phase 3.10 Enterprise AI Interpretation & Explainability — MECHANISMS
 * ───────────────────────────────────────────────────────────────────────────
 * The reuse-before-build implementation mechanisms + the ONLY DDL sites for this phase.
 *
 * Every write path FIRST calls `assertEnabled()` (throws if the flag is OFF) and then
 * `ensureAiInterpretationSchema()` (lazy CREATE TABLE IF NOT EXISTS). Because the schema is created ONLY
 * here — and ONLY behind the flag — OFF is byte-identical incl. schema (OFF creates 0 tables). The additive
 * overlay tables are:
 *   aixp_rules          — versioned interpretation rules (kind + structured-AST condition + grounded template).
 *   aixp_prompt_links   — versioned LLM prompt templates linked to a rule + grounded-token whitelist.
 *   aixp_policies       — scoped, versioned interpretation policies (which kinds / personas apply).
 *   aixp_thresholds     — scoped, versioned confidence / review / k_min thresholds.
 *   aixp_runs           — per-subject interpretation run ledger with full traceability provenance +
 *                         confidence + evidence + source tag + suppressed / abstained / human_review.
 *   aixp_governance_log — append-only lifecycle transitions + version history + rollback + audit.
 *   aixp_audit_log      — append-only interpretation audit trail.
 *   aixp_saved_views    — saved interpretation workbench views.
 *
 * The interpretation CORE is DETERMINISTIC. The PURE compute helpers (selectInterpretationRule /
 * renderInterpretation / computeConfidence / detectUnsupportedClaims / verifyReferences /
 * composeExplanation / evaluateInterpretationFormula) have NO DB + NO DDL + NO eval — they are
 * deterministic + side-effect free and REUSE the 3.8 structured-AST formula engine (evaluateFormula /
 * validateFormula — const / var / op / weighted / clamp / standardize nodes, evaluated by a WHITELISTED
 * interpreter — NEVER eval / new Function / string-executed).
 *
 * The LLM narration (`narrateInterpretation`) is an OPTIONAL, honest-degrading seam: it builds the
 * deterministic interpretation FIRST, then (only if aiClient.checkAIHealth is ok) asks the model to REPHRASE
 * within a grounded-token whitelist, validates the output (detectUnsupportedClaims + verifyReferences) and
 * falls back to the deterministic, source-tagged text on ANY failure / unsupported claim. AI output is
 * NEVER fabricated.
 *
 * Interpretation ABSTAINS below k_min real evidence / the confidence floor (abstained:true). Reads are
 * null-safe (`count()` returns null on error, NEVER 0). null (unreadable) ≠ 0 (empty). This module
 * INTERPRETS a standardized + benchmarked result — it never re-scores, re-standardizes or re-benchmarks.
 */
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import { AIXP_K_MIN } from '../config/ai-interpretation';
import { evaluateFormula, validateFormula } from './score-standardization-mechanisms';
import { checkAIHealth, chatJSON } from './aiClient';

function assertEnabled(): void {
  if (!isFlagEnabled('aiInterpretation')) {
    throw new Error('ai_interpretation_disabled');
  }
}

let schemaReady = false;
export async function ensureAiInterpretationSchema(pool: Pool): Promise<void> {
  // Guard: the flag MUST be ON to reach any DDL. OFF → 0 tables (byte-identical).
  assertEnabled();
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aixp_rules (
      id               BIGSERIAL PRIMARY KEY,
      rule_key         TEXT NOT NULL,
      version          INTEGER NOT NULL DEFAULT 1,
      kind             TEXT NOT NULL DEFAULT 'overall',
      priority         INTEGER NOT NULL DEFAULT 0,
      persona          TEXT,
      lifecycle        TEXT,
      condition        JSONB NOT NULL DEFAULT '{}'::jsonb,
      template         TEXT NOT NULL DEFAULT '',
      grounded_tokens  JSONB NOT NULL DEFAULT '[]'::jsonb,
      state            TEXT NOT NULL DEFAULT 'draft',
      detail           JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (rule_key, version)
    );
    CREATE INDEX IF NOT EXISTS aixp_rules_kind_idx ON aixp_rules(kind);
    CREATE INDEX IF NOT EXISTS aixp_rules_key_idx ON aixp_rules(rule_key);
    CREATE TABLE IF NOT EXISTS aixp_prompt_links (
      id               BIGSERIAL PRIMARY KEY,
      prompt_key       TEXT NOT NULL,
      version          INTEGER NOT NULL DEFAULT 1,
      rule_key         TEXT,
      label            TEXT,
      template         TEXT NOT NULL DEFAULT '',
      grounded_tokens  JSONB NOT NULL DEFAULT '[]'::jsonb,
      state            TEXT NOT NULL DEFAULT 'draft',
      detail           JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (prompt_key, version)
    );
    CREATE INDEX IF NOT EXISTS aixp_prompt_links_rule_idx ON aixp_prompt_links(rule_key);
    CREATE TABLE IF NOT EXISTS aixp_policies (
      id               BIGSERIAL PRIMARY KEY,
      policy_key       TEXT NOT NULL,
      version          INTEGER NOT NULL DEFAULT 1,
      scope            TEXT NOT NULL DEFAULT 'assessment',
      scope_ref        TEXT NOT NULL DEFAULT '',
      label            TEXT,
      kinds            JSONB NOT NULL DEFAULT '[]'::jsonb,
      personas         JSONB NOT NULL DEFAULT '[]'::jsonb,
      formula_key      TEXT,
      state            TEXT NOT NULL DEFAULT 'draft',
      detail           JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (policy_key, version)
    );
    CREATE INDEX IF NOT EXISTS aixp_policies_scope_idx ON aixp_policies(scope, scope_ref);
    CREATE TABLE IF NOT EXISTS aixp_thresholds (
      id               BIGSERIAL PRIMARY KEY,
      threshold_key    TEXT NOT NULL,
      version          INTEGER NOT NULL DEFAULT 1,
      scope            TEXT NOT NULL DEFAULT 'assessment',
      scope_ref        TEXT NOT NULL DEFAULT '',
      label            TEXT,
      confidence_min   DOUBLE PRECISION NOT NULL DEFAULT 0.5,
      review_min       DOUBLE PRECISION NOT NULL DEFAULT 0.5,
      k_min            INTEGER NOT NULL DEFAULT ${AIXP_K_MIN},
      state            TEXT NOT NULL DEFAULT 'draft',
      detail           JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (threshold_key, version)
    );
    CREATE INDEX IF NOT EXISTS aixp_thresholds_scope_idx ON aixp_thresholds(scope, scope_ref);
    CREATE TABLE IF NOT EXISTS aixp_runs (
      id                       BIGSERIAL PRIMARY KEY,
      run_key                  TEXT NOT NULL,
      subject_ref              TEXT NOT NULL DEFAULT '',
      assessment_slug          TEXT NOT NULL DEFAULT '',
      kind                     TEXT NOT NULL DEFAULT 'overall',
      persona                  TEXT,
      lifecycle                TEXT,
      interpretation           TEXT NOT NULL DEFAULT '',
      confidence               DOUBLE PRECISION,
      confidence_band          TEXT,
      evidence                 JSONB NOT NULL DEFAULT '{}'::jsonb,
      source                   TEXT NOT NULL DEFAULT 'deterministic',
      ai_available             BOOLEAN NOT NULL DEFAULT false,
      suppressed               BOOLEAN NOT NULL DEFAULT false,
      abstained                BOOLEAN NOT NULL DEFAULT false,
      human_review             BOOLEAN NOT NULL DEFAULT false,
      unsupported_claims       INTEGER NOT NULL DEFAULT 0,
      -- full traceability provenance
      rule_key                 TEXT,
      rule_version             TEXT,
      prompt_version           TEXT,
      assessment_version       TEXT,
      norm_version             TEXT,
      standardization_version  TEXT,
      benchmark_version        TEXT,
      interpretation_version   TEXT,
      detail                   JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (assessment_slug, subject_ref, run_key)
    );
    CREATE INDEX IF NOT EXISTS aixp_runs_subject_idx ON aixp_runs(subject_ref);
    CREATE INDEX IF NOT EXISTS aixp_runs_kind_idx ON aixp_runs(kind);
    CREATE TABLE IF NOT EXISTS aixp_governance_log (
      id               BIGSERIAL PRIMARY KEY,
      artefact_type    TEXT NOT NULL DEFAULT 'rule',
      artefact_key     TEXT NOT NULL,
      artefact_version INTEGER NOT NULL DEFAULT 1,
      from_state       TEXT,
      to_state         TEXT NOT NULL,
      action           TEXT NOT NULL DEFAULT 'transition',
      actor            TEXT,
      note             TEXT,
      snapshot         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS aixp_governance_log_artefact_idx ON aixp_governance_log(artefact_type, artefact_key);
    CREATE TABLE IF NOT EXISTS aixp_audit_log (
      id               BIGSERIAL PRIMARY KEY,
      audit_key        TEXT NOT NULL DEFAULT '',
      action           TEXT NOT NULL DEFAULT 'event',
      actor            TEXT,
      target_type      TEXT,
      target_key       TEXT,
      detail           JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS aixp_audit_log_target_idx ON aixp_audit_log(target_type, target_key);
    CREATE TABLE IF NOT EXISTS aixp_saved_views (
      id               BIGSERIAL PRIMARY KEY,
      view_key         TEXT NOT NULL,
      version          INTEGER NOT NULL DEFAULT 1,
      label            TEXT,
      owner            TEXT,
      config           JSONB NOT NULL DEFAULT '{}'::jsonb,
      state            TEXT NOT NULL DEFAULT 'draft',
      detail           JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (view_key, version)
    );
    CREATE INDEX IF NOT EXISTS aixp_saved_views_key_idx ON aixp_saved_views(view_key);
  `);
  schemaReady = true;
}

/** null on error (unreadable), 0 on no rows (empty). null ≠ 0. */
async function count(pool: Pool, sql: string, params: unknown[] = []): Promise<number | null> {
  try {
    const { rows } = await pool.query(sql, params);
    const v = rows[0] ? Object.values(rows[0])[0] : 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return null;
  }
}

/**
 * Read-only helpers: NEVER touch DDL. If the overlay table is absent (flag never exercised via a write),
 * the query throws → we honestly return empty ([] / null), NEVER CREATE TABLE. DDL lives ONLY on the write
 * paths (via ensureAiInterpretationSchema).
 */
async function safeRows(pool: Pool, sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  try {
    const { rows } = await pool.query(sql, params);
    return rows as Record<string, unknown>[];
  } catch {
    return [];
  }
}

const round2 = (n: number | null): number | null => (n == null || !Number.isFinite(n) ? null : +n.toFixed(2));

// ═════════════════════════════════════════════════════════════════════════════
// PURE COMPUTE — deterministic, NO DB, NO DDL, NO eval, NO AI. REUSE-before-build.
// INTERPRETS a standardized + benchmarked result — NEVER re-scores / re-standardizes / re-benchmarks.
// ═════════════════════════════════════════════════════════════════════════════

export type InterpretationVars = Record<string, string | number | null | undefined>;

/**
 * A structured interpretation-rule condition — NO eval. A rule matches when:
 *  - the (optional) kind / persona / lifecycle scoping matches the context, AND
 *  - the (optional) threshold comparison holds (field op value / between min..max), AND
 *  - the (optional) 3.8 structured-AST `formula` evaluates > 0 (via evaluateFormula — whitelisted, no eval).
 * A condition with none of these is a catch-all (matches everything) — useful as a default rule.
 */
export interface RuleCondition {
  kind?: string; persona?: string; lifecycle?: string;
  field?: string; op?: 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | 'between'; value?: number; min?: number; max?: number;
  formula?: unknown;
}
export interface InterpretationRule {
  rule_key: string; version?: number | string; kind?: string; priority?: number;
  persona?: string | null; lifecycle?: string | null; condition?: RuleCondition;
  template?: string; grounded_tokens?: string[];
}

function num(v: unknown): number | null { const n = Number(v); return v != null && Number.isFinite(n) ? n : null; }

/** Deterministic predicate — does this rule's condition hold for the given context vars? NO eval. */
export function matchRule(condition: RuleCondition | undefined, ctx: InterpretationVars): boolean {
  const c = condition ?? {};
  if (c.kind && String(ctx.kind ?? '') !== c.kind) return false;
  if (c.persona && String(ctx.persona ?? '') !== c.persona) return false;
  if (c.lifecycle && String(ctx.lifecycle ?? '') !== c.lifecycle) return false;
  if (c.field && c.op) {
    const lhs = num(ctx[c.field]);
    if (lhs == null) return false;
    if (c.op === 'gte') { if (!(lhs >= (num(c.value) ?? Infinity))) return false; }
    else if (c.op === 'lte') { if (!(lhs <= (num(c.value) ?? -Infinity))) return false; }
    else if (c.op === 'gt') { if (!(lhs > (num(c.value) ?? Infinity))) return false; }
    else if (c.op === 'lt') { if (!(lhs < (num(c.value) ?? -Infinity))) return false; }
    else if (c.op === 'eq') { if (lhs !== num(c.value)) return false; }
    else if (c.op === 'between') { const lo = num(c.min); const hi = num(c.max); if (lo == null || hi == null || lhs < lo || lhs > hi) return false; }
  }
  if (c.formula != null) {
    try {
      const vars: Record<string, number> = {};
      for (const [k, v] of Object.entries(ctx)) { const n = num(v); if (n != null) vars[k] = n; }
      const r = evaluateFormula(c.formula as never, vars);
      const val = typeof r === 'number' ? r : (r as { value?: number } | null)?.value;
      if (!(typeof val === 'number' && Number.isFinite(val) && val > 0)) return false;
    } catch { return false; }
  }
  return true;
}

/** Highest-priority matching rule for the context, or null. Deterministic; ties broken by version desc. */
export function selectInterpretationRule(rules: InterpretationRule[], ctx: InterpretationVars): InterpretationRule | null {
  const matched = (rules ?? []).filter(r => matchRule(r.condition, ctx));
  if (matched.length === 0) return null;
  matched.sort((a, b) => (Number(b.priority ?? 0) - Number(a.priority ?? 0)) || (Number(b.version ?? 1) - Number(a.version ?? 1)));
  return matched[0];
}

/**
 * Render an interpretation template ({{token}}) using ONLY grounded tokens. A token is substituted only when
 * its key is in the grounded whitelist AND a real value exists; any other {{token}} is stripped (never left
 * as a placeholder, never fabricated). Returns the rendered text + the tokens actually used.
 */
export function renderInterpretation(
  template: string,
  vars: InterpretationVars,
  groundedTokens: string[],
): { text: string; tokens_used: string[] } {
  const allow = new Set((groundedTokens ?? []).map(String));
  const used: string[] = [];
  const text = String(template ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    if (allow.has(key) && vars[key] != null && String(vars[key]).length > 0) {
      used.push(key);
      return String(vars[key]);
    }
    return '';
  }).replace(/\s{2,}/g, ' ').trim();
  return { text, tokens_used: Array.from(new Set(used)) };
}

export interface ConfidenceResult {
  score: number | null; band: 'low' | 'medium' | 'high' | null;
  present: string[]; missing: string[]; human_review: boolean; abstained: boolean; reason: string;
}
/**
 * Confidence COMPUTED from evidence completeness — NEVER guessed. score = present / required facets.
 * ABSTAINS when the cohort is below k_min OR score is below the abstain floor; raises human_review below the
 * review threshold. null (unknown) ≠ 0.
 */
export function computeConfidence(
  evidencePresent: Record<string, boolean>,
  requiredFacets: string[],
  opts: { cohortSize?: number | null; kMin?: number; confidenceMin?: number; reviewMin?: number } = {},
): ConfidenceResult {
  const required = (requiredFacets ?? []).slice();
  if (required.length === 0) return { score: null, band: null, present: [], missing: [], human_review: true, abstained: true, reason: 'no_required_facets' };
  const present = required.filter(f => evidencePresent?.[f] === true);
  const missing = required.filter(f => evidencePresent?.[f] !== true);
  const score = round2(present.length / required.length)!;
  const kMin = opts.kMin ?? AIXP_K_MIN;
  const confidenceMin = opts.confidenceMin ?? 0.34;
  const reviewMin = opts.reviewMin ?? 0.67;
  const cohort = opts.cohortSize == null ? null : Number(opts.cohortSize);
  const cohortBelow = cohort != null && Number.isFinite(cohort) && cohort < kMin;
  const abstained = cohortBelow || score < confidenceMin;
  const band: ConfidenceResult['band'] = score >= reviewMin ? 'high' : score >= confidenceMin ? 'medium' : 'low';
  const human_review = abstained || band !== 'high';
  const reason = cohortBelow ? `cohort_below_k_min(${cohort}<${kMin})` : abstained ? `confidence_below_floor(${score}<${confidenceMin})` : band !== 'high' ? 'below_review_threshold' : 'ok';
  return { score, band, present, missing, human_review, abstained, reason };
}

/**
 * Scan narration text for numeric claims NOT present in the grounded value set — the core hallucination guard.
 * Every number in the narration must appear among the grounded token values (exact or rounded form); any that
 * does not is an unsupported claim. Conservative: catches fabricated statistics the model may invent.
 */
export function detectUnsupportedClaims(text: string, vars: InterpretationVars, groundedTokens: string[]): { claims: string[]; count: number } {
  const allow = new Set((groundedTokens ?? []).map(String));
  const grounded = new Set<string>();
  for (const key of allow) {
    const v = vars[key];
    if (v == null) continue;
    const n = Number(v);
    if (Number.isFinite(n)) {
      grounded.add(String(n));
      grounded.add(String(Math.round(n)));
      grounded.add(n.toFixed(1));
      grounded.add(n.toFixed(2));
    }
  }
  const found = String(text ?? '').match(/\d+(?:\.\d+)?/g) ?? [];
  const claims: string[] = [];
  for (const raw of found) {
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    if (grounded.has(String(n)) || grounded.has(raw) || grounded.has(String(Math.round(n)))) continue;
    claims.push(raw);
  }
  const uniq = Array.from(new Set(claims));
  return { claims: uniq, count: uniq.length };
}

/**
 * Verify every cited reference resolves to a real provenance value. Unresolved refs are DROPPED (never
 * fabricated). Returns the verified subset + the dropped keys.
 */
export function verifyReferences(refs: Record<string, unknown>): { verified: Record<string, unknown>; dropped: string[] } {
  const verified: Record<string, unknown> = {};
  const dropped: string[] = [];
  for (const [k, v] of Object.entries(refs ?? {})) {
    if (v == null || v === '' || (typeof v === 'number' && !Number.isFinite(v))) dropped.push(k);
    else verified[k] = v;
  }
  return { verified, dropped };
}

export interface ExplanationInput {
  why: string;
  evidence_basis: unknown[];
  data_sources: string[];
  rule_reference?: { key: string; version?: number | string } | null;
  score_reference?: unknown;
  benchmark_reference?: unknown;
  assessment_reference?: unknown;
  confidence?: ConfidenceResult | null;
}
/** Compose the 8-facet explanation. References are verified (unresolved dropped, honest null); never fabricated. */
export function composeExplanation(input: ExplanationInput): Record<string, unknown> {
  const { verified } = verifyReferences({
    rule_reference: input.rule_reference ? `${input.rule_reference.key}@v${input.rule_reference.version ?? 1}` : null,
    score_reference: input.score_reference ?? null,
    benchmark_reference: input.benchmark_reference ?? null,
    assessment_reference: input.assessment_reference ?? null,
  });
  return {
    why: input.why ?? '',
    evidence_basis: Array.isArray(input.evidence_basis) ? input.evidence_basis : [],
    data_sources: Array.isArray(input.data_sources) ? input.data_sources : [],
    rule_reference: verified.rule_reference ?? null,
    score_reference: verified.score_reference ?? null,
    benchmark_reference: verified.benchmark_reference ?? null,
    assessment_reference: verified.assessment_reference ?? null,
    confidence_rationale: input.confidence
      ? { score: input.confidence.score, band: input.confidence.band, present: input.confidence.present, missing: input.confidence.missing, reason: input.confidence.reason }
      : null,
  };
}

/** Composite interpretation index via the 3.8 structured-AST formula engine (NO eval). Validated first. */
export function evaluateInterpretationFormula(formula: unknown, vars: Record<string, number>): { value: number | null; valid: boolean; error: string | null } {
  try {
    const v = validateFormula(formula as never);
    const ok = typeof v === 'boolean' ? v : (v as { valid?: boolean } | null)?.valid !== false;
    if (!ok) return { value: null, valid: false, error: (v as { error?: string } | null)?.error ?? 'invalid_formula' };
    const r = evaluateFormula(formula as never, vars ?? {});
    const val = typeof r === 'number' ? r : (r as { value?: number } | null)?.value ?? null;
    return { value: typeof val === 'number' && Number.isFinite(val) ? +val : null, valid: true, error: null };
  } catch (e) {
    return { value: null, valid: false, error: (e as Error)?.message ?? 'formula_error' };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// OPTIONAL AI NARRATION — honest-degrading seam. Deterministic FIRST, LLM only rephrases within grounded
// tokens, output validated, ANY failure → deterministic + source tag. AI output is NEVER fabricated.
// ═════════════════════════════════════════════════════════════════════════════
export interface NarrateInput {
  deterministicText: string;
  vars: InterpretationVars;
  groundedTokens: string[];
  audience?: string;
  model?: string;
}
export interface NarrateResult {
  text: string; source: 'ai' | 'deterministic'; ai_available: boolean;
  unsupported_claims: number; reason: string;
}
/**
 * Rephrase the deterministic interpretation with the LLM — ONLY if the model is healthy — constrained to
 * grounded tokens, then validate. On unhealthy model / error / unsupported claim → the deterministic text is
 * returned with source:'deterministic' + a reason. Never throws; never fabricates.
 */
export async function narrateInterpretation(input: NarrateInput): Promise<NarrateResult> {
  const deterministic = String(input.deterministicText ?? '').trim();
  const base: NarrateResult = { text: deterministic, source: 'deterministic', ai_available: false, unsupported_claims: 0, reason: 'deterministic_only' };
  try {
    const health = await checkAIHealth();
    if (!health?.ok) return { ...base, reason: health?.reason ? `ai_unavailable:${health.reason}` : 'ai_unavailable' };
    const groundedFacts = (input.groundedTokens ?? [])
      .filter(k => input.vars[k] != null)
      .map(k => `${k} = ${input.vars[k]}`)
      .join('; ');
    const system = 'You are a careful assessment interpreter. Rephrase the given interpretation to be clear and supportive. You may ONLY use the facts listed. Do NOT introduce any new number, statistic, percentile, rank, or claim that is not in the facts. Do not invent data. Return strict JSON: {"narration": string}.';
    const user = `Facts (the ONLY grounded values you may reference):\n${groundedFacts || '(none)'}\n\nInterpretation to rephrase (audience: ${input.audience ?? 'candidate'}):\n${deterministic}`;
    const out = await chatJSON({ system, user, model: input.model, temperature: 0.2, max_tokens: 400 });
    const narration = out && typeof out === 'object' ? String((out as { narration?: unknown }).narration ?? '') : '';
    if (!narration.trim()) return { ...base, ai_available: true, reason: 'empty_narration' };
    const scan = detectUnsupportedClaims(narration, input.vars, input.groundedTokens);
    if (scan.count > 0) {
      return { text: deterministic, source: 'deterministic', ai_available: true, unsupported_claims: scan.count, reason: `unsupported_claims:${scan.claims.join(',')}` };
    }
    return { text: narration.trim(), source: 'ai', ai_available: true, unsupported_claims: 0, reason: 'ai_narrated' };
  } catch (e) {
    return { ...base, reason: `ai_error:${(e as Error)?.message ?? 'unknown'}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERLAY WRITES — rules / prompts / policies / thresholds / runs (flag-gated; DDL via ensure-schema)
// ─────────────────────────────────────────────────────────────────────────────
export interface SaveRuleInput {
  rule_key: string; version?: number; kind?: string; priority?: number; persona?: string; lifecycle?: string;
  condition?: RuleCondition; template?: string; grounded_tokens?: string[]; detail?: Record<string, unknown>;
}
export async function saveRule(pool: Pool, input: SaveRuleInput): Promise<Record<string, unknown>> {
  assertEnabled();
  await ensureAiInterpretationSchema(pool);
  const version = Number.isFinite(Number(input.version)) ? Number(input.version) : 1;
  const { rows } = await pool.query(
    `INSERT INTO aixp_rules (rule_key, version, kind, priority, persona, lifecycle, condition, template, grounded_tokens, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10::jsonb)
     ON CONFLICT (rule_key, version) DO UPDATE SET
       kind=EXCLUDED.kind, priority=EXCLUDED.priority, persona=EXCLUDED.persona, lifecycle=EXCLUDED.lifecycle,
       condition=EXCLUDED.condition, template=EXCLUDED.template, grounded_tokens=EXCLUDED.grounded_tokens,
       detail=EXCLUDED.detail, updated_at=now()
     RETURNING *`,
    [input.rule_key, version, input.kind ?? 'overall', Number(input.priority ?? 0), input.persona ?? null, input.lifecycle ?? null,
      JSON.stringify(input.condition ?? {}), input.template ?? '', JSON.stringify(input.grounded_tokens ?? []), JSON.stringify(input.detail ?? {})],
  );
  return rows[0];
}
export async function listRules(pool: Pool, kind?: string): Promise<Record<string, unknown>[]> {
  return kind
    ? safeRows(pool, `SELECT * FROM aixp_rules WHERE kind=$1 ORDER BY priority DESC, rule_key, version DESC LIMIT 500`, [kind])
    : safeRows(pool, `SELECT * FROM aixp_rules ORDER BY priority DESC, rule_key, version DESC LIMIT 500`);
}
/** Read the highest-priority rules and hydrate their condition/grounded_tokens for selectInterpretationRule. */
export async function loadRules(pool: Pool, kind?: string): Promise<InterpretationRule[]> {
  const rows = await listRules(pool, kind);
  return rows.map(r => ({
    rule_key: String(r.rule_key), version: Number(r.version ?? 1), kind: String(r.kind ?? 'overall'),
    priority: Number(r.priority ?? 0), persona: (r.persona as string) ?? null, lifecycle: (r.lifecycle as string) ?? null,
    condition: (r.condition as RuleCondition) ?? {}, template: String(r.template ?? ''),
    grounded_tokens: Array.isArray(r.grounded_tokens) ? (r.grounded_tokens as string[]) : [],
  }));
}

export interface SavePromptLinkInput { prompt_key: string; version?: number; rule_key?: string; label?: string; template?: string; grounded_tokens?: string[]; detail?: Record<string, unknown> }
export async function savePromptLink(pool: Pool, input: SavePromptLinkInput): Promise<Record<string, unknown>> {
  assertEnabled();
  await ensureAiInterpretationSchema(pool);
  const version = Number.isFinite(Number(input.version)) ? Number(input.version) : 1;
  const { rows } = await pool.query(
    `INSERT INTO aixp_prompt_links (prompt_key, version, rule_key, label, template, grounded_tokens, detail)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)
     ON CONFLICT (prompt_key, version) DO UPDATE SET
       rule_key=EXCLUDED.rule_key, label=EXCLUDED.label, template=EXCLUDED.template,
       grounded_tokens=EXCLUDED.grounded_tokens, detail=EXCLUDED.detail, updated_at=now()
     RETURNING *`,
    [input.prompt_key, version, input.rule_key ?? null, input.label ?? null, input.template ?? '', JSON.stringify(input.grounded_tokens ?? []), JSON.stringify(input.detail ?? {})],
  );
  return rows[0];
}
export async function listPromptLinks(pool: Pool, ruleKey?: string): Promise<Record<string, unknown>[]> {
  return ruleKey
    ? safeRows(pool, `SELECT * FROM aixp_prompt_links WHERE rule_key=$1 ORDER BY prompt_key, version DESC LIMIT 500`, [ruleKey])
    : safeRows(pool, `SELECT * FROM aixp_prompt_links ORDER BY prompt_key, version DESC LIMIT 500`);
}

export interface SavePolicyInput { policy_key: string; version?: number; scope?: string; scope_ref?: string; label?: string; kinds?: string[]; personas?: string[]; formula_key?: string; detail?: Record<string, unknown> }
export async function savePolicy(pool: Pool, input: SavePolicyInput): Promise<Record<string, unknown>> {
  assertEnabled();
  await ensureAiInterpretationSchema(pool);
  const version = Number.isFinite(Number(input.version)) ? Number(input.version) : 1;
  const { rows } = await pool.query(
    `INSERT INTO aixp_policies (policy_key, version, scope, scope_ref, label, kinds, personas, formula_key, detail)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9::jsonb)
     ON CONFLICT (policy_key, version) DO UPDATE SET
       scope=EXCLUDED.scope, scope_ref=EXCLUDED.scope_ref, label=EXCLUDED.label, kinds=EXCLUDED.kinds,
       personas=EXCLUDED.personas, formula_key=EXCLUDED.formula_key, detail=EXCLUDED.detail, updated_at=now()
     RETURNING *`,
    [input.policy_key, version, input.scope ?? 'assessment', input.scope_ref ?? '', input.label ?? null,
      JSON.stringify(input.kinds ?? []), JSON.stringify(input.personas ?? []), input.formula_key ?? null, JSON.stringify(input.detail ?? {})],
  );
  return rows[0];
}
export async function listPolicies(pool: Pool, scope?: string): Promise<Record<string, unknown>[]> {
  return scope
    ? safeRows(pool, `SELECT * FROM aixp_policies WHERE scope=$1 ORDER BY policy_key, version DESC LIMIT 500`, [scope])
    : safeRows(pool, `SELECT * FROM aixp_policies ORDER BY policy_key, version DESC LIMIT 500`);
}

export interface SaveThresholdInput { threshold_key: string; version?: number; scope?: string; scope_ref?: string; label?: string; confidence_min?: number; review_min?: number; k_min?: number; detail?: Record<string, unknown> }
export async function saveThreshold(pool: Pool, input: SaveThresholdInput): Promise<Record<string, unknown>> {
  assertEnabled();
  await ensureAiInterpretationSchema(pool);
  const version = Number.isFinite(Number(input.version)) ? Number(input.version) : 1;
  const numOr = (v: unknown, d: number): number => (v != null && Number.isFinite(Number(v)) ? Number(v) : d);
  const { rows } = await pool.query(
    `INSERT INTO aixp_thresholds (threshold_key, version, scope, scope_ref, label, confidence_min, review_min, k_min, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
     ON CONFLICT (threshold_key, version) DO UPDATE SET
       scope=EXCLUDED.scope, scope_ref=EXCLUDED.scope_ref, label=EXCLUDED.label, confidence_min=EXCLUDED.confidence_min,
       review_min=EXCLUDED.review_min, k_min=EXCLUDED.k_min, detail=EXCLUDED.detail, updated_at=now()
     RETURNING *`,
    [input.threshold_key, version, input.scope ?? 'assessment', input.scope_ref ?? '', input.label ?? null,
      numOr(input.confidence_min, 0.34), numOr(input.review_min, 0.67), numOr(input.k_min, AIXP_K_MIN), JSON.stringify(input.detail ?? {})],
  );
  return rows[0];
}
export async function listThresholds(pool: Pool, scope?: string): Promise<Record<string, unknown>[]> {
  return scope
    ? safeRows(pool, `SELECT * FROM aixp_thresholds WHERE scope=$1 ORDER BY threshold_key, version DESC LIMIT 500`, [scope])
    : safeRows(pool, `SELECT * FROM aixp_thresholds ORDER BY threshold_key, version DESC LIMIT 500`);
}

// Scope precedence (most-specific wins) — mirrors the 3.8/3.9 config precedence.
export const CONFIG_SCOPE_PRECEDENCE = [
  'organization', 'institution', 'custom', 'industry', 'country', 'lifecycle', 'persona', 'assessment',
] as const;
export type ConfigScope = typeof CONFIG_SCOPE_PRECEDENCE[number];
const SCOPE_CONTEXT_FIELD: Record<ConfigScope, string> = {
  organization: 'organization', institution: 'institution', custom: 'custom', industry: 'industry',
  country: 'country', lifecycle: 'lifecycle', persona: 'persona', assessment: 'assessment_slug',
};
export interface ResolveScopedContext {
  assessment_slug?: string; persona?: string; lifecycle?: string; industry?: string;
  organization?: string; country?: string; institution?: string; custom?: string;
}
export interface ResolveScopedResult {
  resolved: boolean; scope: ConfigScope | null; scope_ref: string | null;
  row: Record<string, unknown> | null; precedence: readonly ConfigScope[];
  candidates_considered: number; reason: string;
}
/** PURE (read-only) scope resolution over a scoped overlay table (aixp_policies / aixp_thresholds). Never throws. */
async function resolveScoped(pool: Pool, table: 'aixp_policies' | 'aixp_thresholds', context: ResolveScopedContext = {}): Promise<ResolveScopedResult> {
  let considered = 0;
  for (const scope of CONFIG_SCOPE_PRECEDENCE) {
    const raw = (context as Record<string, unknown>)[SCOPE_CONTEXT_FIELD[scope]];
    const ref = raw == null ? '' : String(raw).trim();
    if (!ref) continue;
    considered += 1;
    const rows = await safeRows(pool, `SELECT * FROM ${table} WHERE scope=$1 AND scope_ref=$2 ORDER BY version DESC LIMIT 1`, [scope, ref]);
    if (rows[0]) return { resolved: true, scope, scope_ref: ref, row: rows[0], precedence: CONFIG_SCOPE_PRECEDENCE, candidates_considered: considered, reason: 'matched' };
  }
  return { resolved: false, scope: null, scope_ref: null, row: null, precedence: CONFIG_SCOPE_PRECEDENCE, candidates_considered: considered, reason: considered === 0 ? 'no_context' : 'no_matching_config' };
}
export function resolvePolicy(pool: Pool, context: ResolveScopedContext = {}): Promise<ResolveScopedResult> { return resolveScoped(pool, 'aixp_policies', context); }
export function resolveThreshold(pool: Pool, context: ResolveScopedContext = {}): Promise<ResolveScopedResult> { return resolveScoped(pool, 'aixp_thresholds', context); }

export interface SaveRunInput {
  run_key: string; subject_ref?: string; assessment_slug?: string; kind?: string; persona?: string; lifecycle?: string;
  interpretation?: string; confidence?: number | null; confidence_band?: string | null; evidence?: Record<string, unknown>;
  source?: 'ai' | 'deterministic'; ai_available?: boolean; suppressed?: boolean; abstained?: boolean; human_review?: boolean; unsupported_claims?: number;
  rule_key?: string | null; rule_version?: string | null; prompt_version?: string | null;
  assessment_version?: string | null; norm_version?: string | null; standardization_version?: string | null; benchmark_version?: string | null; interpretation_version?: string | null;
  detail?: Record<string, unknown>;
}
export async function saveRun(pool: Pool, input: SaveRunInput): Promise<Record<string, unknown>> {
  assertEnabled();
  await ensureAiInterpretationSchema(pool);
  const conf = input.confidence != null && Number.isFinite(Number(input.confidence)) ? Number(input.confidence) : null;
  const { rows } = await pool.query(
    `INSERT INTO aixp_runs (run_key, subject_ref, assessment_slug, kind, persona, lifecycle, interpretation, confidence, confidence_band,
       evidence, source, ai_available, suppressed, abstained, human_review, unsupported_claims,
       rule_key, rule_version, prompt_version, assessment_version, norm_version, standardization_version, benchmark_version, interpretation_version, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25::jsonb)
     ON CONFLICT (assessment_slug, subject_ref, run_key) DO UPDATE SET
       kind=EXCLUDED.kind, persona=EXCLUDED.persona, lifecycle=EXCLUDED.lifecycle, interpretation=EXCLUDED.interpretation,
       confidence=EXCLUDED.confidence, confidence_band=EXCLUDED.confidence_band, evidence=EXCLUDED.evidence, source=EXCLUDED.source,
       ai_available=EXCLUDED.ai_available, suppressed=EXCLUDED.suppressed, abstained=EXCLUDED.abstained, human_review=EXCLUDED.human_review,
       unsupported_claims=EXCLUDED.unsupported_claims, rule_key=EXCLUDED.rule_key, rule_version=EXCLUDED.rule_version, prompt_version=EXCLUDED.prompt_version,
       assessment_version=EXCLUDED.assessment_version, norm_version=EXCLUDED.norm_version, standardization_version=EXCLUDED.standardization_version,
       benchmark_version=EXCLUDED.benchmark_version, interpretation_version=EXCLUDED.interpretation_version, detail=EXCLUDED.detail
     RETURNING *`,
    [input.run_key, input.subject_ref ?? '', input.assessment_slug ?? '', input.kind ?? 'overall', input.persona ?? null, input.lifecycle ?? null,
      input.interpretation ?? '', conf, input.confidence_band ?? null, JSON.stringify(input.evidence ?? {}),
      input.source ?? 'deterministic', !!input.ai_available, !!input.suppressed, !!input.abstained, !!input.human_review, Number(input.unsupported_claims ?? 0),
      input.rule_key ?? null, input.rule_version ?? null, input.prompt_version ?? null, input.assessment_version ?? null, input.norm_version ?? null,
      input.standardization_version ?? null, input.benchmark_version ?? null, input.interpretation_version ?? null, JSON.stringify(input.detail ?? {})],
  );
  return rows[0];
}
export async function listRuns(pool: Pool, subjectRef?: string, kind?: string): Promise<Record<string, unknown>[]> {
  if (subjectRef && kind) return safeRows(pool, `SELECT * FROM aixp_runs WHERE subject_ref=$1 AND kind=$2 ORDER BY created_at DESC LIMIT 500`, [subjectRef, kind]);
  if (subjectRef) return safeRows(pool, `SELECT * FROM aixp_runs WHERE subject_ref=$1 ORDER BY created_at DESC LIMIT 500`, [subjectRef]);
  return safeRows(pool, `SELECT * FROM aixp_runs ORDER BY id DESC LIMIT 500`);
}

// ─────────────────────────────────────────────────────────────────────────────
// GOVERNANCE — append-only lifecycle transitions + version history + rollback + audit
// ─────────────────────────────────────────────────────────────────────────────
export const GOVERNANCE_ORDER = ['draft', 'review', 'validate', 'approve', 'publish', 'archive', 'retire'] as const;
export type GovernanceState = typeof GOVERNANCE_ORDER[number];
const ARTEFACT_TABLE: Record<string, string> = {
  rule: 'aixp_rules', prompt: 'aixp_prompt_links', policy: 'aixp_policies', threshold: 'aixp_thresholds', view: 'aixp_saved_views',
};
const ARTEFACT_KEY_COL: Record<string, string> = {
  rule: 'rule_key', prompt: 'prompt_key', policy: 'policy_key', threshold: 'threshold_key', view: 'view_key',
};
export interface GovernanceInput { artefact_type: string; artefact_key: string; artefact_version?: number; to_state: string; actor?: string; note?: string }
export async function recordGovernanceTransition(pool: Pool, input: GovernanceInput): Promise<Record<string, unknown>> {
  assertEnabled();
  await ensureAiInterpretationSchema(pool);
  const table = ARTEFACT_TABLE[input.artefact_type];
  const keyCol = ARTEFACT_KEY_COL[input.artefact_type];
  if (!table || !keyCol) throw new Error('unknown_artefact_type');
  const version = Number.isFinite(Number(input.artefact_version)) ? Number(input.artefact_version) : 1;
  const cur = await safeRows(pool, `SELECT * FROM ${table} WHERE ${keyCol}=$1 AND version=$2`, [input.artefact_key, version]);
  const fromState = cur[0] ? String(cur[0].state ?? '') : null;
  await pool.query(
    `INSERT INTO aixp_governance_log (artefact_type, artefact_key, artefact_version, from_state, to_state, action, actor, note, snapshot)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [input.artefact_type, input.artefact_key, version, fromState, input.to_state, 'transition', input.actor ?? null, input.note ?? null, JSON.stringify(cur[0] ?? {})],
  );
  if (cur[0]) {
    await pool.query(`UPDATE ${table} SET state=$1, updated_at=now() WHERE ${keyCol}=$2 AND version=$3`, [input.to_state, input.artefact_key, version]);
  }
  const { rows } = await pool.query(`SELECT * FROM aixp_governance_log WHERE artefact_type=$1 AND artefact_key=$2 ORDER BY id DESC LIMIT 1`, [input.artefact_type, input.artefact_key]);
  return rows[0];
}
export async function listGovernanceLog(pool: Pool, artefactType?: string, artefactKey?: string): Promise<Record<string, unknown>[]> {
  if (artefactType && artefactKey) return safeRows(pool, `SELECT * FROM aixp_governance_log WHERE artefact_type=$1 AND artefact_key=$2 ORDER BY id DESC LIMIT 200`, [artefactType, artefactKey]);
  return safeRows(pool, `SELECT * FROM aixp_governance_log ORDER BY id DESC LIMIT 200`);
}

export interface AuditInput { audit_key?: string; action: string; actor?: string; target_type?: string; target_key?: string; detail?: Record<string, unknown> }
export async function recordAudit(pool: Pool, input: AuditInput): Promise<Record<string, unknown>> {
  assertEnabled();
  await ensureAiInterpretationSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO aixp_audit_log (audit_key, action, actor, target_type, target_key, detail)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING *`,
    [input.audit_key ?? '', input.action, input.actor ?? null, input.target_type ?? null, input.target_key ?? null, JSON.stringify(input.detail ?? {})],
  );
  return rows[0];
}
export async function listAudit(pool: Pool, targetKey?: string): Promise<Record<string, unknown>[]> {
  return targetKey
    ? safeRows(pool, `SELECT * FROM aixp_audit_log WHERE target_key=$1 ORDER BY id DESC LIMIT 200`, [targetKey])
    : safeRows(pool, `SELECT * FROM aixp_audit_log ORDER BY id DESC LIMIT 200`);
}

export interface SaveViewInput { view_key: string; version?: number; label?: string; owner?: string; config?: Record<string, unknown>; detail?: Record<string, unknown> }
export async function saveView(pool: Pool, input: SaveViewInput): Promise<Record<string, unknown>> {
  assertEnabled();
  await ensureAiInterpretationSchema(pool);
  const version = Number.isFinite(Number(input.version)) ? Number(input.version) : 1;
  const { rows } = await pool.query(
    `INSERT INTO aixp_saved_views (view_key, version, label, owner, config, detail)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)
     ON CONFLICT (view_key, version) DO UPDATE SET
       label=EXCLUDED.label, owner=EXCLUDED.owner, config=EXCLUDED.config, detail=EXCLUDED.detail, updated_at=now()
     RETURNING *`,
    [input.view_key, version, input.label ?? null, input.owner ?? null, JSON.stringify(input.config ?? {}), JSON.stringify(input.detail ?? {})],
  );
  return rows[0];
}
export async function listViews(pool: Pool, owner?: string): Promise<Record<string, unknown>[]> {
  return owner
    ? safeRows(pool, `SELECT * FROM aixp_saved_views WHERE owner=$1 ORDER BY view_key, version DESC LIMIT 200`, [owner])
    : safeRows(pool, `SELECT * FROM aixp_saved_views ORDER BY view_key, version DESC LIMIT 200`);
}

// ═════════════════════════════════════════════════════════════════════════════
// COVERAGE — null-safe counts over the overlay (null on error ≠ 0 on empty)
// ═════════════════════════════════════════════════════════════════════════════
export interface AixpOverlayCoverage {
  rules: number | null; prompt_links: number | null; policies: number | null; thresholds: number | null;
  runs: number | null; ai_runs: number | null; abstained_runs: number | null; human_review_runs: number | null;
  governance_events: number | null; audit_events: number | null; saved_views: number | null;
}
export async function computeOverlayCoverage(pool: Pool): Promise<AixpOverlayCoverage> {
  const [rules, prompt_links, policies, thresholds, runs, ai_runs, abstained_runs, human_review_runs, governance_events, audit_events, saved_views] = await Promise.all([
    count(pool, `SELECT count(*) FROM aixp_rules`),
    count(pool, `SELECT count(*) FROM aixp_prompt_links`),
    count(pool, `SELECT count(*) FROM aixp_policies`),
    count(pool, `SELECT count(*) FROM aixp_thresholds`),
    count(pool, `SELECT count(*) FROM aixp_runs`),
    count(pool, `SELECT count(*) FROM aixp_runs WHERE source='ai'`),
    count(pool, `SELECT count(*) FROM aixp_runs WHERE abstained=true`),
    count(pool, `SELECT count(*) FROM aixp_runs WHERE human_review=true`),
    count(pool, `SELECT count(*) FROM aixp_governance_log`),
    count(pool, `SELECT count(*) FROM aixp_audit_log`),
    count(pool, `SELECT count(*) FROM aixp_saved_views`),
  ]);
  return { rules, prompt_links, policies, thresholds, runs, ai_runs, abstained_runs, human_review_runs, governance_events, audit_events, saved_views };
}
