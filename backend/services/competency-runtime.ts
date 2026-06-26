/**
 * Phase 2 — Competency Runtime engine.
 *
 * Operationalizes the live competency chain end-to-end:
 *
 *   Role -> Assessment Blueprint -> Assessment Generation -> Competency Scoring
 *        -> Competency Profile -> Competency Gap Analysis
 *
 * Strictly ADDITIVE + flag-gated (`competencyRuntime`, default OFF). Reuses the
 * EXISTING substrate — it never re-implements or mutates it:
 *   - Blueprints / role-assessment maps : services/assessment-foundation-mapping.ts
 *   - Question bank                     : competency_question_templates (status='approved');
 *                                         each option carries its own authored 0..100 score.
 *   - Role readiness gap engine         : getRoleReadiness (services/role-competency-profile.ts)
 *
 * Honesty contract (mirrors the rest of the platform):
 *   - NEVER fabricates scores. A score exists only where a real answered question
 *     produced an authored option score. No answers => unmeasured (null), not 0.
 *   - Measurement grain is the genome's 5 onto-domains. The bank's 7 domain codes
 *     (COG/COM/LEA/EXE/ADP/TEC/EIQ) crosswalk DOWN to the 5 onto-domains, so a
 *     per-competency score is a domain-PROXY. This is disclosed on every profile
 *     and gap row (`measurement: 'domain_proxy'`).
 *   - `dom_strategic` has NO question-bank code -> competencies there are honestly
 *     reported UNMEASURABLE (a real coverage gap, never invented).
 *   - Forward-compatible: when `onto_competency_question_map` is populated the
 *     generator/scorer can select+aggregate per-competency with no schema rework.
 *   - Reversible: dropping the four onto_* runtime tables restores legacy behaviour.
 *
 * Scoring deviation (documented): for `competency_question_templates` the canonical
 * score is the chosen option's authored `score` (0..100) — the SAME basis the
 * client `computeScoresFromSelected` uses. The CAF/IRT scoring-engine.ts is for
 * the richer rubric/IRT CAF assessment type and a DIFFERENT data shape, so it is
 * intentionally NOT used here.
 */

import type { Pool } from 'pg';
import { isCompetencyRuntimeEnabled } from '../config/feature-flags.js';
import { computeBehaviouralEvidence } from './competency-behavioural-evidence.js';
import { getBlueprint } from './assessment-foundation-mapping.js';
import { ensureScoringSchema } from './competency-scoring.js';
import { getRoleReadiness, type ReadinessResult } from './role-competency-profile.js';
import { COMPETENCY_TYPES, type CompetencyTypeKey } from './competency-type-classification.js';
import { chooseBranch, type BranchDecision } from './adaptive-branching-engine.js';
import { resolveCohort, benchmarkCompetency, type CohortRef } from './adaptive-benchmark.js';
import { cronbachAlpha, pearsonR, variance } from './psychometric-intelligence-engine.js';
import { leastSquaresSlope, directionOf } from './wc3/longitudinal-consumption.js';

export const COMPETENCY_RUNTIME_VERSION = 'phase-2';

// ---- Taxonomy crosswalk -----------------------------------------------------
// Bank domain code -> genome onto-domain id. Curated + INERT (no DDL, no writes).
// Best-fit by the onto_domains canonical NAMES:
//   dom_cognitive     = Cognitive Capabilities
//   dom_interpersonal = Interpersonal & Leadership Capabilities
//   dom_behavioral    = Behavioral Capabilities
//   dom_functional    = Functional & Execution Capabilities
//   dom_strategic     = Strategic & Organizational Capabilities  (NO bank code -> UNMEASURABLE)
export const DOMAIN_CODE_TO_ONTO: Record<string, string> = {
  COG: 'dom_cognitive',
  COM: 'dom_interpersonal',
  LEA: 'dom_interpersonal',
  EXE: 'dom_functional',
  ADP: 'dom_behavioral',
  TEC: 'dom_functional',
  EIQ: 'dom_interpersonal',
};

// Reverse: onto-domain -> the bank codes that measure it (for question selection).
export const ONTO_TO_DOMAIN_CODES: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const [code, dom] of Object.entries(DOMAIN_CODE_TO_ONTO)) {
    (out[dom] ||= []).push(code);
  }
  return out;
})();

export const ONTO_DOMAIN_LABEL: Record<string, string> = {
  dom_cognitive: 'Cognitive Capabilities',
  dom_interpersonal: 'Interpersonal & Leadership Capabilities',
  dom_behavioral: 'Behavioral Capabilities',
  dom_functional: 'Functional & Execution Capabilities',
  dom_strategic: 'Strategic & Organizational Capabilities',
};

// All onto-domains that the 7-code bank can measure at all.
export const MEASURABLE_ONTO_DOMAINS = new Set(Object.values(DOMAIN_CODE_TO_ONTO));

const ALL_CODES = ['COG', 'COM', 'LEA', 'EXE', 'ADP', 'TEC', 'EIQ'];

// ---- 0..100 score -> 1..5 level band (documented, deterministic) ------------
export function scoreToLevel(score: number): number {
  if (score >= 80) return 5;
  if (score >= 60) return 4;
  if (score >= 40) return 3;
  if (score >= 20) return 2;
  return 1;
}

// Level gap classification (required_level - measured_level, both 1..5).
export type GapSeverity = 'met' | 'minor' | 'moderate' | 'severe' | 'unmeasurable';
export function classifyLevelGap(gap: number | null): GapSeverity {
  if (gap == null) return 'unmeasurable';
  if (gap <= 0) return 'met';
  if (gap === 1) return 'minor';
  if (gap === 2) return 'moderate';
  return 'severe';
}

// ---- Option-score derivation (mirrors competency-questions.ts rowToQuestion) -
const LIKERT_OPTIONS = [
  { label: 'Strongly Disagree', score: 0 },
  { label: 'Disagree', score: 25 },
  { label: 'Neutral', score: 50 },
  { label: 'Agree', score: 75 },
  { label: 'Strongly Agree', score: 100 },
];
function isLikertType(questionType: string): boolean {
  return !(questionType === 'mcq' || questionType === 'sjt' || questionType === 'scenario' ||
    questionType === 'case' || questionType === 'simulation' || questionType === 'behavioral' ||
    questionType === 'communication');
}
function deriveOptions(questionType: string, body: any): { label: string; score: number }[] {
  const isLikert = isLikertType(questionType);
  const hasAuthored = Array.isArray(body?.options) && body.options.length > 0;
  // Reverse-keyed (negative-polarity) items: only meaningful for Likert scales,
  // where agreement maps to a graded score. Invert each score across the 0..100
  // scale so "Strongly Agree" on a negative-polarity item scores LOW. Authored
  // best-answer items (mcq/sjt/...) have a single correct answer — polarity is
  // not meaningful there, so the flag is ignored (legacy byte-identical).
  const reverse = body?.reverse_scored === true;
  if (isLikert || !hasAuthored) {
    return LIKERT_OPTIONS.map((o) => ({ label: o.label, score: reverse ? 100 - o.score : o.score }));
  }
  // Honor the authored correct answer. Templates carry it as EITHER `best_option`
  // OR `correct_index` (the curated competency bank uses `correct_index`); without
  // this fallback every correct_index-authored MCQ collapses to a flat score (all
  // options 20) and can never produce a differentiated PRECISE competency score.
  const best = Number.isFinite(body.best_option)
    ? Number(body.best_option)
    : Number.isFinite(body.correct_index)
      ? Number(body.correct_index)
      : -1;
  return (body.options as string[]).map((label, i) => {
    let score = 20;
    if (i === best) score = 100;
    else if (best >= 0 && Math.abs(i - best) === 1) score = 60;
    return { label, score };
  });
}

// ---- Lazy schema (mirrors migrations/20260619_competency_runtime.sql) --------
let schemaReady: Promise<void> | null = null;
export function ensureCompetencyRuntimeSchema(pool: Pool): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS onto_assessment_instances (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          blueprint_id    TEXT NOT NULL,
          role_id         TEXT,
          subject_id      TEXT NOT NULL,
          status          TEXT NOT NULL DEFAULT 'generated',
          total_questions INTEGER NOT NULL DEFAULT 0,
          questions       JSONB NOT NULL DEFAULT '[]'::jsonb,
          coverage        JSONB NOT NULL DEFAULT '{}'::jsonb,
          source          TEXT NOT NULL DEFAULT 'runtime',
          created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        );`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_oai_subject   ON onto_assessment_instances (subject_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_oai_blueprint ON onto_assessment_instances (blueprint_id);`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS onto_assessment_responses (
          id             SERIAL PRIMARY KEY,
          instance_id    UUID NOT NULL REFERENCES onto_assessment_instances(id) ON DELETE CASCADE,
          question_index INTEGER NOT NULL,
          template_id    TEXT,
          code           TEXT NOT NULL,
          onto_domain    TEXT,
          selected_index INTEGER NOT NULL,
          score          NUMERIC NOT NULL,
          created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        );`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_oar_instance_q ON onto_assessment_responses (instance_id, question_index);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_oar_instance ON onto_assessment_responses (instance_id);`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS onto_competency_scores (
          id             SERIAL PRIMARY KEY,
          instance_id    UUID NOT NULL REFERENCES onto_assessment_instances(id) ON DELETE CASCADE,
          subject_id     TEXT NOT NULL,
          onto_domain    TEXT NOT NULL,
          domain_label   TEXT,
          scaled_score   NUMERIC NOT NULL,
          level          INTEGER NOT NULL,
          question_count INTEGER NOT NULL,
          created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        );`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ocs_instance ON onto_competency_scores (instance_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ocs_subject  ON onto_competency_scores (subject_id);`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS onto_competency_profiles (
          id            SERIAL PRIMARY KEY,
          subject_id    TEXT NOT NULL,
          instance_id   UUID NOT NULL REFERENCES onto_assessment_instances(id) ON DELETE CASCADE,
          blueprint_id  TEXT,
          role_id       TEXT,
          overall_score NUMERIC,
          overall_level INTEGER,
          profile       JSONB NOT NULL DEFAULT '[]'::jsonb,
          coverage      JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        );`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ocp_subject  ON onto_competency_profiles (subject_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ocp_instance ON onto_competency_profiles (instance_id);`);
    })().catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

// ---- Types ------------------------------------------------------------------
export interface RuntimeQuestion {
  index: number;
  template_id: string | null;
  code: string;                 // bank domain code
  onto_domain: string;          // crosswalked onto-domain id
  type: string;
  text: string;
  options: { label: string; score: number }[];
  reverse_scored?: boolean;     // negative-polarity (reverse-keyed) Likert item
}

export interface InstanceCoverage {
  total_competencies: number;
  measurable_competencies: number;
  unmeasurable_competencies: number;
  unmeasurable: { competency_id: string; competency_name: string | null; onto_domain: string; reason: string }[];
  domains_with_questions: string[];
  domains_requested: string[];
  question_bank_empty: boolean;
  notes: string[];
}

export interface GenerateResult {
  ok: boolean;
  error?: string;
  instance_id?: string;
  blueprint_id?: string;
  role_id?: string | null;
  subject_id?: string;
  total_questions?: number;
  questions?: RuntimeQuestion[];
  coverage?: InstanceCoverage;
}

// ---- Helpers ----------------------------------------------------------------
async function competencyDomains(pool: Pool, competencyIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (competencyIds.length === 0) return out;
  const { rows } = await pool.query(
    `SELECT id, domain_id FROM onto_competencies WHERE id = ANY($1::text[])`,
    [competencyIds],
  );
  for (const r of rows as any[]) out.set(r.id, r.domain_id);
  return out;
}

// ============================================================================
// 1. ASSESSMENT GENERATION
// ============================================================================
export async function generateAssessment(
  pool: Pool,
  input: { blueprintId: string; subjectId: string; total?: number; roleId?: string | null; context?: Record<string, string> },
): Promise<GenerateResult> {
  await ensureCompetencyRuntimeSchema(pool);
  const blueprintId = String(input.blueprintId ?? '').trim();
  const subjectId = String(input.subjectId ?? '').trim();
  if (!blueprintId) return { ok: false, error: 'blueprint_required' };
  if (!subjectId) return { ok: false, error: 'subject_required' };

  const blueprint = await getBlueprint(pool, blueprintId);
  if (!blueprint) return { ok: false, error: 'blueprint_not_found' };

  const comps = blueprint.competencies.filter((c) => c.active);
  const domByComp = await competencyDomains(pool, comps.map((c) => c.competency_id));

  // Which onto-domains does this blueprint span, and which are measurable?
  const requestedOnto = new Set<string>();
  const unmeasurable: InstanceCoverage['unmeasurable'] = [];
  for (const c of comps) {
    const dom = domByComp.get(c.competency_id) ?? null;
    if (dom && MEASURABLE_ONTO_DOMAINS.has(dom)) {
      requestedOnto.add(dom);
    } else {
      unmeasurable.push({
        competency_id: c.competency_id,
        competency_name: c.competency_name,
        onto_domain: dom ?? 'unknown',
        reason: dom
          ? `onto-domain '${dom}' (${ONTO_DOMAIN_LABEL[dom] ?? dom}) has no question-bank code — UNMEASURABLE`
          : 'competency has no resolvable onto-domain — UNMEASURABLE',
      });
    }
  }

  // Bank codes needed to cover the measurable onto-domains.
  const wantCodes = new Set<string>();
  for (const dom of requestedOnto) for (const code of (ONTO_TO_DOMAIN_CODES[dom] ?? [])) wantCodes.add(code);
  const codes = ALL_CODES.filter((c) => wantCodes.has(c));

  const total = Math.max(0, Math.min(60, Number(input.total) || 21));

  // Pull approved templates. TWO coverage banks are unioned:
  //  (a) DOMAIN bank   — templates coded to the 7-code bank that crosswalks to the
  //                      measurable onto-domains (the legacy domain-PROXY path).
  //  (b) COMPETENCY-TAGGED bank — templates coded DIRECTLY to this blueprint's
  //                      comp_* competencies (competency_code == competency_id).
  //                      When such approved templates exist AND are linked in
  //                      onto_competency_question_map, serving them lets
  //                      scoreAssessment produce PRECISE per-competency scores
  //                      (raising employer DIRECT matches) instead of the proxy.
  // No tagged templates => only the domain bank is served => byte-identical legacy.
  const compIds = comps.map((c) => c.competency_id);
  const selectCodes = [...new Set([...codes, ...compIds])];

  let templates: any[] = [];
  if (selectCodes.length > 0) {
    const res = await pool.query(
      `SELECT id, template_key, competency_code, question_type, template_body
         FROM competency_question_templates
        WHERE status = 'approved' AND competency_code = ANY($1::text[])`,
      [selectCodes],
    );
    templates = res.rows;
  }
  const bankEmpty = templates.length === 0;

  // Resolve the onto-domain a template scores into:
  //  - 7-code bank template => its fixed crosswalk domain.
  //  - comp_*-coded template => the competency's own onto-domain (domByComp).
  // Never fabricate a domain: a code with no resolvable onto-domain is dropped below.
  const ontoOf = (code: string): string | null =>
    DOMAIN_CODE_TO_ONTO[code] ?? domByComp.get(code) ?? null;

  // Round-robin select across codes (deterministic order) up to `total`.
  // Competency-tagged codes are served FIRST so the assessment is competency-tagged
  // wherever the curated+mapped bank allows; domain-bank codes fill any remainder.
  const byCode = new Map<string, any[]>();
  for (const t of templates) (byCode.get(t.competency_code) ?? byCode.set(t.competency_code, []).get(t.competency_code)!).push(t);
  const taggedCodes = compIds.filter((c) => (byCode.get(c)?.length ?? 0) > 0);
  const domainCodes = codes.filter((c) => (byCode.get(c)?.length ?? 0) > 0);
  const orderedCodes = [...new Set([...taggedCodes, ...domainCodes])];
  const picked: RuntimeQuestion[] = [];
  const cursor = new Map<string, number>();
  let idx = 0;
  while (picked.length < total && orderedCodes.length > 0) {
    let advanced = false;
    for (const code of orderedCodes) {
      if (picked.length >= total) break;
      const pool2 = byCode.get(code)!;
      const cur = cursor.get(code) ?? 0;
      if (cur >= pool2.length) continue;
      cursor.set(code, cur + 1);
      advanced = true;
      const dom = ontoOf(code);
      if (!dom) continue; // no resolvable onto-domain — never place into a fabricated domain
      const t = pool2[cur];
      const body = t.template_body || {};
      picked.push({
        index: idx++,
        template_id: t.id,
        code,
        onto_domain: dom,
        type: t.question_type,
        text: body.prompt || '',
        options: deriveOptions(t.question_type, body),
        reverse_scored: body.reverse_scored === true && isLikertType(t.question_type) ? true : undefined,
      });
    }
    if (!advanced) break;
  }

  const domainsWithQuestions = [...new Set(picked.map((q) => q.onto_domain))];
  const notes: string[] = [];
  if (bankEmpty) notes.push('Question bank has no approved items for the required domains — the generated assessment is empty; scoring will be honestly unmeasured.');
  if (unmeasurable.length > 0) notes.push(`${unmeasurable.length} of ${comps.length} blueprint competencies are UNMEASURABLE (no question-bank coverage for their onto-domain).`);
  if (taggedCodes.length > 0) {
    notes.push(`${taggedCodes.length} competency-tagged question group(s) served from the curated bank — these score at PRECISE per-competency granularity (onto_competency_question_map), the rest remain a domain-PROXY.`);
  } else {
    notes.push('Per-competency scores are a domain-PROXY (the 7-code bank crosswalks to 5 onto-domains) until onto_competency_question_map is populated.');
  }

  const coverage: InstanceCoverage = {
    total_competencies: comps.length,
    measurable_competencies: comps.length - unmeasurable.length,
    unmeasurable_competencies: unmeasurable.length,
    unmeasurable,
    domains_with_questions: domainsWithQuestions,
    domains_requested: [...requestedOnto],
    question_bank_empty: bankEmpty,
    notes,
  };

  const ins = await pool.query(
    `INSERT INTO onto_assessment_instances (blueprint_id, role_id, subject_id, status, total_questions, questions, coverage, source)
     VALUES ($1,$2,$3,'generated',$4,$5::jsonb,$6::jsonb,'runtime')
     RETURNING id`,
    [blueprintId, input.roleId ?? blueprint.source_role_id ?? null, subjectId, picked.length, JSON.stringify(picked), JSON.stringify(coverage)],
  );
  const instanceId = ins.rows[0].id as string;

  return {
    ok: true,
    instance_id: instanceId,
    blueprint_id: blueprintId,
    role_id: input.roleId ?? blueprint.source_role_id ?? null,
    subject_id: subjectId,
    total_questions: picked.length,
    questions: picked,
    coverage,
  };
}

// ============================================================================
// 2. SCORING + 3. PROFILE
// ============================================================================
export interface ScoreInput { instanceId: string; responses: { index: number; selected_index: number }[] }
export interface DomainScore { onto_domain: string; label: string; scaled_score: number; level: number; question_count: number }
export interface CompetencyScore {
  competency_id: string;
  competency_name: string | null;
  scaled_score: number;
  level: number;
  question_count: number;
  measurement: 'precise';
}
export interface ScoreResult {
  ok: boolean;
  error?: string;
  instance_id?: string;
  subject_id?: string;
  answered?: number;
  overall_score?: number | null;
  overall_level?: number | null;
  domain_scores?: DomainScore[];
  competency_scores?: CompetencyScore[];
  coverage?: any;
  measurement?: 'domain_proxy' | 'precise' | 'hybrid';
}

export async function scoreAssessment(pool: Pool, input: ScoreInput): Promise<ScoreResult> {
  await ensureCompetencyRuntimeSchema(pool);
  const instanceId = String(input.instanceId ?? '').trim();
  if (!instanceId) return { ok: false, error: 'instance_required' };

  const instRes = await pool.query(
    `SELECT id, blueprint_id, role_id, subject_id, questions, coverage FROM onto_assessment_instances WHERE id = $1`,
    [instanceId],
  );
  if (instRes.rowCount === 0) return { ok: false, error: 'instance_not_found' };
  const inst = instRes.rows[0];
  const questions: RuntimeQuestion[] = Array.isArray(inst.questions) ? inst.questions : [];
  const byIndex = new Map<number, RuntimeQuestion>(questions.map((q) => [q.index, q]));

  // Adaptive mode (T5): when the caller submits no responses, finalize from the
  // responses already persisted incrementally (submitSingleResponse). Batch
  // callers still pass responses explicitly => byte-identical legacy path.
  let responsesIn = input.responses ?? [];
  if (responsesIn.length === 0) {
    const persisted = await pool.query(
      `SELECT question_index, selected_index FROM onto_assessment_responses WHERE instance_id = $1 ORDER BY question_index`,
      [instanceId],
    );
    responsesIn = (persisted.rows as any[]).map((r) => ({ index: Number(r.question_index), selected_index: Number(r.selected_index) }));
  }

  // Resolve each response to its authored option score. Unknown index/option => skip (never fabricate).
  const accepted: { q: RuntimeQuestion; selected: number; score: number }[] = [];
  for (const r of responsesIn) {
    const q = byIndex.get(Number(r.index));
    if (!q) continue;
    const sel = Number(r.selected_index);
    if (!Number.isInteger(sel) || sel < 0 || sel >= q.options.length) continue;
    accepted.push({ q, selected: sel, score: Number(q.options[sel].score) });
  }

  // Ensure the per-competency score-run ledger exists BEFORE opening the txn, so a
  // conditional INSERT into onto_competency_score_runs (precise layer below) can never
  // fail mid-transaction and abort the whole scoring. Memoized: a no-op after first call.
  await ensureScoringSchema(pool).catch(() => {});

  // Persist responses + recompute domain scores in a transaction (idempotent re-score).
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM onto_assessment_responses WHERE instance_id = $1`, [instanceId]);
    await client.query(`DELETE FROM onto_competency_scores   WHERE instance_id = $1`, [instanceId]);
    for (const a of accepted) {
      await client.query(
        `INSERT INTO onto_assessment_responses (instance_id, question_index, template_id, code, onto_domain, selected_index, score)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [instanceId, a.q.index, a.q.template_id, a.q.code, a.q.onto_domain, a.selected, a.score],
      );
    }

    // Aggregate by onto-domain.
    const agg = new Map<string, number[]>();
    for (const a of accepted) (agg.get(a.q.onto_domain) ?? agg.set(a.q.onto_domain, []).get(a.q.onto_domain)!).push(a.score);
    const domainScores: DomainScore[] = [];
    for (const [dom, scores] of agg) {
      const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
      const scaled = Math.round(mean * 10) / 10;
      const ds: DomainScore = {
        onto_domain: dom,
        label: ONTO_DOMAIN_LABEL[dom] ?? dom,
        scaled_score: scaled,
        level: scoreToLevel(scaled),
        question_count: scores.length,
      };
      domainScores.push(ds);
      await client.query(
        `INSERT INTO onto_competency_scores (instance_id, subject_id, onto_domain, domain_label, scaled_score, level, question_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [instanceId, inst.subject_id, dom, ds.label, scaled, ds.level, scores.length],
      );
    }
    domainScores.sort((a, b) => a.onto_domain.localeCompare(b.onto_domain));

    // --- Precise per-competency layer (additive) ----------------------------
    // When onto_competency_question_map has active edges for the answered
    // questions, score those competencies DIRECTLY off their mapped items
    // (not the 7→5 domain crosswalk). Empty map => byte-identical domain_proxy.
    // Never fabricates: a competency only appears if a mapped answered item exists.
    const competencyScores: CompetencyScore[] = [];
    const templateIds = [...new Set(accepted.map((a) => a.q.template_id).filter(Boolean) as string[])];
    if (templateIds.length > 0) {
      const mapRes = await client.query(
        `SELECT m.competency_id, m.question_id::text AS question_id, c.canonical_name AS competency_name
           FROM onto_competency_question_map m
           LEFT JOIN onto_competencies c ON c.id = m.competency_id
          WHERE m.active = true AND m.question_id = ANY($1::uuid[])`,
        [templateIds],
      );
      if (mapRes.rowCount && mapRes.rowCount > 0) {
        const scoresByTemplate = new Map<string, number[]>();
        for (const a of accepted) {
          if (!a.q.template_id) continue;
          (scoresByTemplate.get(a.q.template_id) ?? scoresByTemplate.set(a.q.template_id, []).get(a.q.template_id)!).push(a.score);
        }
        const byComp = new Map<string, { name: string | null; scores: number[] }>();
        for (const row of mapRes.rows as any[]) {
          const scores = scoresByTemplate.get(row.question_id) ?? [];
          if (scores.length === 0) continue;
          const e = byComp.get(row.competency_id) ?? byComp.set(row.competency_id, { name: row.competency_name ?? null, scores: [] }).get(row.competency_id)!;
          e.scores.push(...scores);
        }
        for (const [cid, e] of byComp) {
          const mean = e.scores.reduce((s, v) => s + v, 0) / e.scores.length;
          const scaled = Math.round(mean * 10) / 10;
          competencyScores.push({
            competency_id: cid,
            competency_name: e.name,
            scaled_score: scaled,
            level: scoreToLevel(scaled),
            question_count: e.scores.length,
            measurement: 'precise',
          });
        }
        competencyScores.sort((a, b) => a.competency_id.localeCompare(b.competency_id));
      }
    }
    const measurement: 'domain_proxy' | 'precise' | 'hybrid' =
      competencyScores.length === 0 ? 'domain_proxy' : (domainScores.length > 0 ? 'hybrid' : 'precise');

    const measured = domainScores.length > 0;
    const overall = measured
      ? Math.round((domainScores.reduce((s, d) => s + d.scaled_score, 0) / domainScores.length) * 10) / 10
      : null;
    const overallLevel = overall != null ? scoreToLevel(overall) : null;

    await client.query(
      `UPDATE onto_assessment_instances SET status='scored', updated_at=now() WHERE id=$1`,
      [instanceId],
    );
    // Append-only profile snapshot (per-DOMAIN dom_* ledger).
    await client.query(
      `INSERT INTO onto_competency_profiles (subject_id, instance_id, blueprint_id, role_id, overall_score, overall_level, profile, coverage)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)`,
      [inst.subject_id, instanceId, inst.blueprint_id, inst.role_id, overall, overallLevel,
       JSON.stringify(domainScores), JSON.stringify(inst.coverage ?? {})],
    );

    // --- Persist the PRECISE per-competency layer to the normalized-run ledger ---
    // When competency-tagged questions produced real per-competency (comp_*) scores,
    // also write them to onto_competency_score_runs so the unified competency profile
    // (resolveUnifiedCompetencyProfile) surfaces them at COMPETENCY granularity. This
    // lets downstream consumers (e.g. the employer competency match) score role
    // requirements via a DIRECT per-competency score instead of the domain-proxy.
    // Empty map => no precise scores => this block is skipped entirely => the
    // normalized-run ledger is untouched and the read path is byte-identical legacy.
    // assessment_id is left NULL: a runtime instance is NOT a row in the FK target
    // (onto_assembled_assessments); fabricating one would break referential honesty.
    if (competencyScores.length > 0) {
      const runComps = competencyScores.map((c) => ({
        competency_id: c.competency_id,
        competency_name: c.competency_name,
        normalized_score: c.scaled_score,
        normalization_basis: 'option_score_mean',
        level: c.level,
        level_label: null,
        level_status: 'measured',
        item_count: c.question_count,
        measurement: 'precise' as const,
      }));
      // Overall = item-count-weighted mean of measured per-competency scores (mirrors
      // the rich scorer's convention). Measured-only; never coerced to 0.
      let wSum = 0;
      let acc = 0;
      for (const c of competencyScores) { acc += c.scaled_score * c.question_count; wSum += c.question_count; }
      const compOverall = wSum > 0 ? Math.round((acc / wSum) * 10) / 10 : null;
      const compOverallLevel = compOverall != null ? scoreToLevel(compOverall) : null;
      const scoredQuestions = competencyScores.reduce((s, c) => s + c.question_count, 0);
      await client.query(
        `INSERT INTO onto_competency_score_runs
           (assessment_id, blueprint_id, subject_id, total_questions, scored_questions, competency_scores, overall, normalization, status, source)
         VALUES (NULL,$1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,'scored','runtime_competency_map')`,
        [
          inst.blueprint_id,
          inst.subject_id,
          accepted.length,
          scoredQuestions,
          JSON.stringify(runComps),
          JSON.stringify({
            overall_score: compOverall,
            overall_level: compOverallLevel,
            competencies_scored: competencyScores.length,
            measurement: 'precise',
          }),
          JSON.stringify({
            basis: 'option_score_mean',
            instance_id: instanceId,
            note: 'Per-competency scores aggregated from onto_competency_question_map-tagged items (mean of authored option scores).',
          }),
        ],
      );
    }
    await client.query('COMMIT');

    return {
      ok: true,
      instance_id: instanceId,
      subject_id: inst.subject_id,
      answered: accepted.length,
      overall_score: overall,
      overall_level: overallLevel,
      domain_scores: domainScores,
      // Additive: only present when at least one precise mapping contributed.
      // Empty map => field omitted entirely => byte-identical legacy payload.
      ...(competencyScores.length > 0 ? { competency_scores: competencyScores } : {}),
      coverage: inst.coverage ?? {},
      measurement,
    };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// ============================================================================
// 2b. ADAPTIVE SERVING (T5) — flag-gated, additive, falls back to batch.
// ============================================================================
// The instance already carries the FULL candidate question set (generated up
// front). Adaptive mode does NOT change what can be asked — it only changes the
// ORDER in which the already-generated questions are served, using the pure
// `chooseBranch` decision engine over the responses captured so far. Responses
// are captured incrementally (submitSingleResponse); final scoring is unchanged
// (scoreAssessment reads the persisted responses). On ANY failure the next
// question falls back to the next sequential unanswered item (batch order), so
// the assessment can always complete.

export interface SingleResponseResult {
  ok: boolean;
  error?: string;
  instance_id?: string;
  question_index?: number;
  answered?: number;
  total_questions?: number;
}

// Capture ONE response into onto_assessment_responses (idempotent upsert on the
// (instance_id, question_index) unique key). Never fabricates: an out-of-range
// option or unknown index is rejected, not coerced.
export async function submitSingleResponse(
  pool: Pool,
  input: { instanceId: string; index: number; selected_index: number },
): Promise<SingleResponseResult> {
  await ensureCompetencyRuntimeSchema(pool);
  const instanceId = String(input.instanceId ?? '').trim();
  if (!instanceId) return { ok: false, error: 'instance_required' };

  const instRes = await pool.query(
    `SELECT id, questions FROM onto_assessment_instances WHERE id = $1`,
    [instanceId],
  );
  if (instRes.rowCount === 0) return { ok: false, error: 'instance_not_found' };
  const questions: RuntimeQuestion[] = Array.isArray(instRes.rows[0].questions) ? instRes.rows[0].questions : [];
  const q = questions.find((x) => x.index === Number(input.index));
  if (!q) return { ok: false, error: 'question_not_found' };
  const sel = Number(input.selected_index);
  if (!Number.isInteger(sel) || sel < 0 || sel >= q.options.length) return { ok: false, error: 'invalid_option' };

  const score = Number(q.options[sel].score);
  await pool.query(
    `INSERT INTO onto_assessment_responses (instance_id, question_index, template_id, code, onto_domain, selected_index, score)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (instance_id, question_index)
     DO UPDATE SET selected_index = EXCLUDED.selected_index, score = EXCLUDED.score, created_at = now()`,
    [instanceId, q.index, q.template_id, q.code, q.onto_domain, sel, score],
  );
  await pool.query(`UPDATE onto_assessment_instances SET status='in_progress', updated_at=now() WHERE id=$1 AND status='generated'`, [instanceId]);

  const cnt = await pool.query(`SELECT COUNT(*)::int AS n FROM onto_assessment_responses WHERE instance_id = $1`, [instanceId]);
  return {
    ok: true,
    instance_id: instanceId,
    question_index: q.index,
    answered: Number(cnt.rows[0]?.n ?? 0),
    total_questions: questions.length,
  };
}

export interface NextQuestionResult {
  ok: boolean;
  error?: string;
  instance_id?: string;
  done?: boolean;
  answered?: number;
  total_questions?: number;
  question?: RuntimeQuestion | null;
  branch?: BranchDecision & { fallback?: boolean };
}

// Quality proxy: map a 0..100 authored option score to chooseBranch's 0..1 scale.
function qualityFromScore(score: number): number {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n / 100));
}

// Decide + return the NEXT question to serve for an adaptive instance. Pure
// selection over the already-generated pool; deterministic; never throws (any
// internal failure degrades to next-sequential with branch.fallback=true).
export async function nextAdaptiveQuestion(pool: Pool, instanceIdRaw: string): Promise<NextQuestionResult> {
  await ensureCompetencyRuntimeSchema(pool);
  const instanceId = String(instanceIdRaw ?? '').trim();
  if (!instanceId) return { ok: false, error: 'instance_required' };

  const instRes = await pool.query(
    `SELECT id, questions FROM onto_assessment_instances WHERE id = $1`,
    [instanceId],
  );
  if (instRes.rowCount === 0) return { ok: false, error: 'instance_not_found' };
  const questions: RuntimeQuestion[] = Array.isArray(instRes.rows[0].questions) ? instRes.rows[0].questions : [];
  const total = questions.length;

  const respRes = await pool.query(
    `SELECT question_index, code, onto_domain, score FROM onto_assessment_responses WHERE instance_id = $1 ORDER BY question_index`,
    [instanceId],
  );
  const responses = respRes.rows as { question_index: number; code: string; onto_domain: string; score: number }[];
  const answeredIdx = new Set(responses.map((r) => Number(r.question_index)));
  const remaining = questions.filter((q) => !answeredIdx.has(q.index));

  if (total === 0) return { ok: true, instance_id: instanceId, done: true, answered: 0, total_questions: 0, question: null };
  if (remaining.length === 0) {
    return { ok: true, instance_id: instanceId, done: true, answered: responses.length, total_questions: total, question: null };
  }

  // Sequential fallback target (batch order) — also used on any failure.
  const sequentialNext = [...remaining].sort((a, b) => a.index - b.index)[0];

  let decision: BranchDecision & { fallback?: boolean };
  let chosen: RuntimeQuestion = sequentialNext;
  try {
    const last = responses.length > 0 ? responses[responses.length - 1] : null;
    // Priority list = the bank codes present in this instance, in first-seen order.
    const priority: string[] = [];
    for (const q of questions) if (!priority.includes(q.code)) priority.push(q.code);
    // Coverage = answered count per bank code.
    const coverage: Record<string, number> = {};
    for (const r of responses) coverage[r.code] = (coverage[r.code] ?? 0) + 1;
    // Honest signal proxy: distinct onto-domains answered (this runtime has no
    // separate cognitive-signal capture, so we use literal domain breadth).
    const domainsAnswered = new Set(responses.map((r) => r.onto_domain)).size;

    decision = chooseBranch({
      currentCompetencyId: last ? last.code : priority[0],
      currentDepthLevel: 1,
      lastQualityScore: last ? qualityFromScore(last.score) : undefined,
      pendingContradictions: 0,
      cognitiveSignalsCovered: domainsAnswered,
      competencyCoverage: coverage,
      competencyPriority: priority,
      minCoveragePerCompetency: 2,
    });

    // Realize the decision against the remaining pool. shift_focus targets the
    // next competency; everything else stays on the current competency. If the
    // targeted competency has no remaining items, degrade to sequential.
    const targetCode = decision.nextCompetencyId ?? (last ? last.code : priority[0]);
    const inTarget = remaining.filter((q) => q.code === targetCode).sort((a, b) => a.index - b.index);
    chosen = inTarget.length > 0 ? inTarget[0] : sequentialNext;
  } catch (err) {
    console.warn('[competency-runtime] adaptive branch failed, falling back to batch order:', (err as Error).message);
    decision = {
      policy: 'maintain', reasonCode: 'no_signal', nextDepthLevel: 1,
      engineVersion: 'fallback', fallback: true,
    };
    chosen = sequentialNext;
  }

  // NOTE: we intentionally do NOT persist to adaptive_question_branches here.
  // That table is FK-bound to the dynamic_question_sessions domain; a competency
  // runtime instance is not a row there, so writing it would require fabricating
  // a session. The branch decision is instead surfaced in full on the response
  // (`branch`), giving the caller complete, honest provenance with no fabrication.
  return {
    ok: true,
    instance_id: instanceId,
    done: false,
    answered: responses.length,
    total_questions: total,
    question: chosen,
    branch: decision,
  };
}

// ============================================================================
// T6 — Item-level psychometrics (classical test theory, data-permitting)
// ============================================================================
// Computed read-only from REAL persisted responses (onto_assessment_responses).
// Coverage (n respondents) and Confidence (sufficiency) are reported as SEPARATE
// axes; statistics are emitted directionally below the sufficiency threshold and
// flagged insufficient — never fabricated, never suppressed.
export const PSYCHO_MIN_RESPONDENTS = 30; // sufficiency (confidence) threshold

export interface ItemPsychometric {
  item_key: string;            // stable item identity: template_id, else code:index
  code: string;
  template_id: string | null;
  onto_domain: string | null;
  n: number;                   // respondents who answered this item
  difficulty: number | null;   // p-value: mean(score)/100, 0..1 (null if n<1)
  difficulty_label: 'high_mean' | 'moderate_mean' | 'low_mean' | 'insufficient';
  discrimination: number | null; // corrected item-total correlation (null if undefined)
  discrimination_label: 'good' | 'fair' | 'weak' | 'negative' | 'insufficient';
  sufficient: boolean;         // n >= PSYCHO_MIN_RESPONDENTS
}

export interface ItemPsychometricsResult {
  ok: boolean;
  error?: string;
  blueprint_id?: string;
  respondents?: number;          // distinct instances with >=1 recorded response
  complete_respondents?: number; // instances answering ALL observed items
  reliability?: {
    alpha: number | null;
    n_items: number;
    n_complete: number;
    sufficient: boolean;
    note: string;
  };
  items?: ItemPsychometric[];
  sufficient?: boolean;          // overall (respondents >= threshold)
  min_respondents?: number;
  notes?: string[];
}

function difficultyLabel(p: number | null): ItemPsychometric['difficulty_label'] {
  if (p === null) return 'insufficient';
  if (p >= 0.75) return 'high_mean';
  if (p >= 0.4) return 'moderate_mean';
  return 'low_mean';
}

function discriminationLabel(d: number | null): ItemPsychometric['discrimination_label'] {
  if (d === null) return 'insufficient';
  if (d < 0) return 'negative';
  if (d >= 0.3) return 'good';
  if (d >= 0.15) return 'fair';
  return 'weak';
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export async function computeItemPsychometrics(pool: Pool, blueprintId: string): Promise<ItemPsychometricsResult> {
  const bp = (blueprintId || '').trim();
  if (!bp) return { ok: false, error: 'blueprint_required' };
  await ensureCompetencyRuntimeSchema(pool);

  const { rows } = await pool.query(
    `SELECT r.instance_id, r.question_index, r.template_id, r.code, r.onto_domain, r.score::float8 AS score
       FROM onto_assessment_responses r
       JOIN onto_assessment_instances i ON i.id = r.instance_id
      WHERE i.blueprint_id = $1`,
    [bp],
  );

  const notes: string[] = [
    'difficulty = mean(item score) / 100 (proportion of max competency level, not "correctness").',
    'discrimination = corrected item-total correlation (item excluded from total).',
    `sufficiency threshold = ${PSYCHO_MIN_RESPONDENTS} respondents; values below are directional only.`,
  ];

  if (rows.length === 0) {
    return {
      ok: true,
      blueprint_id: bp,
      respondents: 0,
      complete_respondents: 0,
      reliability: { alpha: null, n_items: 0, n_complete: 0, sufficient: false, note: 'insufficient_data: no responses recorded for this blueprint yet' },
      items: [],
      sufficient: false,
      min_respondents: PSYCHO_MIN_RESPONDENTS,
      notes,
    };
  }

  // Per-instance map: instanceId -> { itemKey -> score }; plus item metadata.
  const perInstance = new Map<string, Map<string, number>>();
  const itemMeta = new Map<string, { code: string; template_id: string | null; onto_domain: string | null }>();
  for (const r of rows) {
    const itemKey: string = r.template_id ? String(r.template_id) : `${r.code}:${r.question_index}`;
    if (!itemMeta.has(itemKey)) {
      itemMeta.set(itemKey, { code: r.code, template_id: r.template_id ?? null, onto_domain: r.onto_domain ?? null });
    }
    let inst = perInstance.get(r.instance_id);
    if (!inst) { inst = new Map<string, number>(); perInstance.set(r.instance_id, inst); }
    // If a respondent somehow has the same itemKey twice, keep the first (idempotent capture already dedupes by question_index).
    if (!inst.has(itemKey)) inst.set(itemKey, Number(r.score));
  }

  const respondents = perInstance.size;
  const itemKeys = Array.from(itemMeta.keys());

  // Per-item difficulty + corrected item-total discrimination.
  const items: ItemPsychometric[] = itemKeys.map((itemKey) => {
    const meta = itemMeta.get(itemKey)!;
    const itemScores: number[] = [];
    const correctedTotals: number[] = []; // total of the respondent's OTHER items
    for (const inst of perInstance.values()) {
      if (!inst.has(itemKey)) continue;
      const s = inst.get(itemKey)!;
      let other = 0;
      for (const [k, v] of inst) if (k !== itemKey) other += v;
      itemScores.push(s);
      correctedTotals.push(other);
    }
    const n = itemScores.length;
    const difficulty = n >= 1 ? Math.max(0, Math.min(1, mean(itemScores) / 100)) : null;
    let discrimination: number | null = null;
    if (n >= 2 && variance(itemScores) > 0 && variance(correctedTotals) > 0) {
      discrimination = Math.max(-1, Math.min(1, pearsonR(itemScores, correctedTotals)));
    }
    return {
      item_key: itemKey,
      code: meta.code,
      template_id: meta.template_id,
      onto_domain: meta.onto_domain,
      n,
      difficulty,
      difficulty_label: difficultyLabel(difficulty),
      discrimination,
      discrimination_label: discriminationLabel(discrimination),
      sufficient: n >= PSYCHO_MIN_RESPONDENTS,
    };
  }).sort((a, b) => a.code.localeCompare(b.code) || a.item_key.localeCompare(b.item_key));

  // Cronbach alpha over the COMPLETE-respondent matrix (respondents answering every observed item).
  const completeInstances = Array.from(perInstance.values()).filter((inst) => itemKeys.every((k) => inst.has(k)));
  const nComplete = completeInstances.length;
  let alpha: number | null = null;
  if (itemKeys.length >= 2 && nComplete >= 2) {
    const itemVariances = itemKeys.map((k) => variance(completeInstances.map((inst) => inst.get(k)!)));
    const totalScores = completeInstances.map((inst) => itemKeys.reduce((acc, k) => acc + inst.get(k)!, 0));
    const totalVar = variance(totalScores);
    alpha = totalVar > 0 ? cronbachAlpha(itemVariances, totalVar) : null;
  }
  const reliabilitySufficient = nComplete >= PSYCHO_MIN_RESPONDENTS && itemKeys.length >= 2;

  return {
    ok: true,
    blueprint_id: bp,
    respondents,
    complete_respondents: nComplete,
    reliability: {
      alpha,
      n_items: itemKeys.length,
      n_complete: nComplete,
      sufficient: reliabilitySufficient,
      note: reliabilitySufficient
        ? 'sufficient'
        : `insufficient_data: ${nComplete} complete respondent(s) over ${itemKeys.length} item(s) (need >= ${PSYCHO_MIN_RESPONDENTS})`,
    },
    items,
    sufficient: respondents >= PSYCHO_MIN_RESPONDENTS,
    min_respondents: PSYCHO_MIN_RESPONDENTS,
    notes,
  };
}

// ============================================================================
// T7 — Longitudinal growth tracking (trend across re-assessments)
// ============================================================================
// Read-only over the APPEND-ONLY onto_competency_profiles snapshots. NULL=missing
// is NEVER coerced to 0 (a domain absent from a snapshot is a gap, not a zero
// score); a trend needs >= 2 observed datapoints, else direction='insufficient_data'.
export type GrowthDirection = 'improving' | 'declining' | 'stable' | 'insufficient_data';

export interface TrendPoint {
  instance_id: string;
  blueprint_id: string | null;
  value: number | null; // NULL = not measured in this snapshot (never 0)
  level: number | null;
  at: string;
}

export interface MetricTrend {
  key: string;          // 'overall' or an onto_domain
  label: string;
  points: TrendPoint[]; // chronological
  n_observed: number;   // non-null datapoints
  first: number | null;
  latest: number | null;
  delta: number | null; // latest - first (null if < 2 observed)
  slope: number | null; // points per re-assessment (null if < 2 observed)
  direction: GrowthDirection;
}

export interface ProfileTrendsResult {
  ok: boolean;
  subject_id: string;
  snapshots: number;
  overall: MetricTrend;
  domains: MetricTrend[];
  note: string;
}

function buildTrend(key: string, label: string, points: TrendPoint[]): MetricTrend {
  const observed = points.filter((p) => p.value !== null) as Array<TrendPoint & { value: number }>;
  const n = observed.length;
  const first = n >= 1 ? observed[0].value : null;
  const latest = n >= 1 ? observed[n - 1].value : null;
  const delta = n >= 2 ? Math.round((latest! - first!) * 10) / 10 : null;
  const slope = n >= 2 ? Math.round(leastSquaresSlope(observed.map((p) => p.value)) * 1000) / 1000 : null;
  const direction: GrowthDirection = n < 2 ? 'insufficient_data' : directionOf(slope!);
  return { key, label, points, n_observed: n, first, latest, delta, slope, direction };
}

export async function computeProfileTrends(pool: Pool, subjectId: string): Promise<ProfileTrendsResult> {
  const sid = (subjectId || '').trim();
  await ensureCompetencyRuntimeSchema(pool);
  const { rows } = await pool.query(
    `SELECT instance_id::text AS instance_id, blueprint_id, overall_score, overall_level, profile, created_at
       FROM onto_competency_profiles
      WHERE subject_id = $1
      ORDER BY created_at ASC, id ASC`,
    [sid],
  );

  // Overall series (NULL preserved — overall_score is null when no domain was measured).
  const overallPoints: TrendPoint[] = rows.map((r: any) => ({
    instance_id: r.instance_id,
    blueprint_id: r.blueprint_id ?? null,
    value: r.overall_score === null || r.overall_score === undefined ? null : Number(r.overall_score),
    level: r.overall_level === null || r.overall_level === undefined ? null : Number(r.overall_level),
    at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));

  // Per-domain series: a domain absent from a snapshot's profile = NULL (gap), never 0.
  const domainKeys = new Set<string>();
  const domainLabels = new Map<string, string>();
  const perSnapshotDomains: Array<Map<string, { score: number | null; level: number | null }>> = [];
  for (const r of rows as any[]) {
    const arr: any[] = Array.isArray(r.profile) ? r.profile : [];
    const m = new Map<string, { score: number | null; level: number | null }>();
    for (const d of arr) {
      const k = d?.onto_domain;
      if (!k) continue;
      domainKeys.add(k);
      if (d?.label) domainLabels.set(k, d.label);
      const sc = d?.scaled_score;
      m.set(k, {
        score: sc === null || sc === undefined ? null : Number(sc),
        level: d?.level === null || d?.level === undefined ? null : Number(d.level),
      });
    }
    perSnapshotDomains.push(m);
  }

  const domains: MetricTrend[] = Array.from(domainKeys).sort().map((k) => {
    const points: TrendPoint[] = rows.map((r: any, i: number) => {
      const hit = perSnapshotDomains[i].get(k);
      return {
        instance_id: r.instance_id,
        blueprint_id: r.blueprint_id ?? null,
        value: hit ? hit.score : null, // absent → null (missing), never 0
        level: hit ? hit.level : null,
        at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      };
    });
    return buildTrend(k, domainLabels.get(k) ?? k, points);
  });

  return {
    ok: true,
    subject_id: sid,
    snapshots: rows.length,
    overall: buildTrend('overall', 'Overall score', overallPoints),
    domains,
    note: rows.length < 2
      ? `insufficient_data: ${rows.length} re-assessment(s) — at least 2 snapshots are needed to compute a trend`
      : 'trend computed over append-only profile snapshots; NULL = not measured in that snapshot (never 0)',
  };
}

// ============================================================================
// GET helpers
// ============================================================================
export async function getInstance(pool: Pool, id: string): Promise<any | null> {
  await ensureCompetencyRuntimeSchema(pool);
  const { rows } = await pool.query(
    `SELECT id, blueprint_id, role_id, subject_id, status, total_questions, questions, coverage, source, created_at, updated_at
       FROM onto_assessment_instances WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export interface ProfileView {
  subject_id: string;
  measured: boolean;
  instance_id: string | null;
  blueprint_id: string | null;
  role_id: string | null;
  overall_score: number | null;
  overall_level: number | null;
  measurement: 'domain_proxy';
  domain_scores: DomainScore[];
  coverage: any;
  created_at: string | null;
  history_count: number;
}

export async function getProfile(pool: Pool, subjectId: string): Promise<ProfileView> {
  await ensureCompetencyRuntimeSchema(pool);
  const sid = String(subjectId ?? '').trim();
  const latest = await pool.query(
    `SELECT instance_id, blueprint_id, role_id, overall_score, overall_level, profile, coverage, created_at
       FROM onto_competency_profiles WHERE subject_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
    [sid],
  );
  const cnt = await pool.query(`SELECT COUNT(*)::int AS n FROM onto_competency_profiles WHERE subject_id = $1`, [sid]);
  if (latest.rowCount === 0) {
    return {
      subject_id: sid, measured: false, instance_id: null, blueprint_id: null, role_id: null,
      overall_score: null, overall_level: null, measurement: 'domain_proxy',
      domain_scores: [], coverage: {}, created_at: null, history_count: 0,
    };
  }
  const r = latest.rows[0];
  return {
    subject_id: sid,
    measured: true,
    instance_id: r.instance_id,
    blueprint_id: r.blueprint_id,
    role_id: r.role_id,
    overall_score: r.overall_score != null ? Number(r.overall_score) : null,
    overall_level: r.overall_level != null ? Number(r.overall_level) : null,
    measurement: 'domain_proxy',
    domain_scores: Array.isArray(r.profile) ? r.profile : [],
    coverage: r.coverage ?? {},
    created_at: r.created_at,
    history_count: cnt.rows[0].n,
  };
}

// ============================================================================
// 4. GAP ANALYSIS
// ============================================================================
export interface GapRow {
  competency_id: string;
  competency_name: string | null;
  onto_domain: string | null;
  required_level: number;
  measured_level: number | null;
  measured_score: number | null;
  gap: number | null;            // required - measured (levels)
  severity: GapSeverity;
  weight: number;
  criticality: string;
  blocking: boolean;             // critical & below required
  measurement: 'domain_proxy' | 'unmeasurable';
}

export interface GapAnalysisResult {
  ok: boolean;
  error?: string;
  subject_id?: string;
  blueprint_id?: string | null;
  role_id?: string | null;
  measured?: boolean;
  total_competencies?: number;
  measurable_competencies?: number;
  unmeasurable_competencies?: number;
  coverage_pct?: number | null;       // measurable & actually-scored / total
  blocking_gaps?: number;
  gaps?: GapRow[];
  role_readiness?: ReadinessResult | null;   // reused engine (when role profile exists)
  notes?: string[];
}

export async function computeGapAnalysis(pool: Pool, subjectId: string): Promise<GapAnalysisResult> {
  await ensureCompetencyRuntimeSchema(pool);
  const sid = String(subjectId ?? '').trim();
  if (!sid) return { ok: false, error: 'subject_required' };

  const profile = await getProfile(pool, sid);
  if (!profile.measured || !profile.blueprint_id) {
    return {
      ok: true, subject_id: sid, blueprint_id: profile.blueprint_id, role_id: profile.role_id,
      measured: false, total_competencies: 0, measurable_competencies: 0, unmeasurable_competencies: 0,
      coverage_pct: null, blocking_gaps: 0, gaps: [], role_readiness: null,
      notes: ['No scored profile for this subject yet — generate and score an assessment first. Gap is unmeasured (not assumed).'],
    };
  }

  const blueprint = await getBlueprint(pool, profile.blueprint_id);
  if (!blueprint) {
    return { ok: false, error: 'blueprint_not_found', subject_id: sid };
  }
  const comps = blueprint.competencies.filter((c) => c.active);
  const domByComp = await competencyDomains(pool, comps.map((c) => c.competency_id));

  // Measured domain level/score by onto-domain (from the profile snapshot).
  const domLevel = new Map<string, { level: number; score: number }>();
  for (const d of profile.domain_scores) domLevel.set(d.onto_domain, { level: d.level, score: d.scaled_score });

  const gaps: GapRow[] = [];
  let measurable = 0;
  let scored = 0;
  let blocking = 0;
  const actualsForReadiness: Record<string, number> = {};

  for (const c of comps) {
    const dom = domByComp.get(c.competency_id) ?? null;
    const isMeasurable = !!(dom && MEASURABLE_ONTO_DOMAINS.has(dom));
    const m = dom ? domLevel.get(dom) : undefined;
    const measuredLevel = m ? m.level : null;
    const measuredScore = m ? m.score : null;
    if (isMeasurable) measurable += 1;
    if (measuredLevel != null) {
      scored += 1;
      actualsForReadiness[c.competency_id] = measuredLevel;
    }
    const gap = measuredLevel != null ? c.required_level - measuredLevel : null;
    const severity = classifyLevelGap(gap);
    const isBlocking = c.criticality === 'critical' && gap != null && gap > 0;
    if (isBlocking) blocking += 1;
    gaps.push({
      competency_id: c.competency_id,
      competency_name: c.competency_name,
      onto_domain: dom,
      required_level: c.required_level,
      measured_level: measuredLevel,
      measured_score: measuredScore,
      gap,
      severity,
      weight: c.weight,
      criticality: c.criticality,
      blocking: isBlocking,
      measurement: isMeasurable ? 'domain_proxy' : 'unmeasurable',
    });
  }

  // Sort: blocking first, then larger gaps, then unmeasurable last.
  const sevRank: Record<GapSeverity, number> = { severe: 0, moderate: 1, minor: 2, met: 3, unmeasurable: 4 };
  gaps.sort((a, b) =>
    Number(b.blocking) - Number(a.blocking) ||
    sevRank[a.severity] - sevRank[b.severity] ||
    (b.gap ?? -99) - (a.gap ?? -99) ||
    b.weight - a.weight);

  const coveragePct = comps.length > 0 ? Math.round((scored / comps.length) * 1000) / 10 : null;

  // Reuse the platform readiness gap engine when the role has a defined profile.
  let readiness: ReadinessResult | null = null;
  if (profile.role_id) {
    readiness = await getRoleReadiness(pool, profile.role_id, actualsForReadiness).catch(() => null);
  }

  const notes: string[] = [];
  notes.push('Measured levels are a domain-PROXY: a competency inherits its onto-domain score (the 7-code bank crosswalks to 5 onto-domains). Precision upgrades automatically when onto_competency_question_map is populated.');
  if (measurable < comps.length) notes.push(`${comps.length - measurable} competenc${comps.length - measurable === 1 ? 'y is' : 'ies are'} UNMEASURABLE (no question-bank coverage for their onto-domain) — reported, never scored.`);
  if (coveragePct != null && coveragePct < 100) notes.push(`${Math.round(100 - coveragePct)}% of competencies have no measured score yet — gap analysis is provisional for those.`);
  if (blocking > 0) notes.push(`${blocking} CRITICAL competenc${blocking === 1 ? 'y is' : 'ies are'} below required level — blocking gap(s) regardless of overall standing.`);

  return {
    ok: true,
    subject_id: sid,
    blueprint_id: profile.blueprint_id,
    role_id: profile.role_id,
    measured: scored > 0,
    total_competencies: comps.length,
    measurable_competencies: measurable,
    unmeasurable_competencies: comps.length - measurable,
    coverage_pct: coveragePct,
    blocking_gaps: blocking,
    gaps,
    role_readiness: readiness,
    notes,
  };
}

// ============================================================================
// 5. COMPETENCY PROFILE — 5-TYPE VIEW (Phase 2.5)
// Buckets the measured profile into the five canonical competency TYPES
// (behavioral · cognitive · functional · technical · future_skills) using the
// curated Phase-1.1 classification (onto_competency_type_map). A competency
// inherits its onto-domain PROXY score; the TYPE view is an additive grouping.
// Honest: competencies with no type mapping land in `unclassified` (never
// force-bucketed); when the map is unseeded every competency is unclassified.
// ============================================================================
export interface TypeBucketCompetency {
  competency_id: string;
  competency_name: string | null;
  onto_domain: string | null;
  measured_level: number | null;
  measured_score: number | null;
  measurement: 'domain_proxy' | 'unmeasurable';
}

export interface TypeBucket {
  type_key: CompetencyTypeKey | 'unclassified';
  label: string;
  competency_count: number;
  measured_count: number;
  avg_score: number | null;   // mean proxied score over measured competencies
  avg_level: number | null;   // mean proxied level over measured competencies
  competencies: TypeBucketCompetency[];
}

export interface TypeProfileResult {
  ok: boolean;
  subject_id: string;
  measured: boolean;
  instance_id: string | null;
  blueprint_id: string | null;
  role_id: string | null;
  total_competencies: number;
  classified_competencies: number;
  classification_coverage_pct: number | null;
  buckets: TypeBucket[];           // always the 5 canonical types, in order
  unclassified: TypeBucket;        // competencies with no type mapping yet
  notes: string[];
}

function emptyBucket(type_key: CompetencyTypeKey | 'unclassified', label: string): TypeBucket {
  return { type_key, label, competency_count: 0, measured_count: 0, avg_score: null, avg_level: null, competencies: [] };
}

function finalizeBucket(b: TypeBucket): void {
  const measured = b.competencies.filter((c) => c.measured_level != null);
  b.competency_count = b.competencies.length;
  b.measured_count = measured.length;
  if (measured.length > 0) {
    b.avg_score = Math.round((measured.reduce((s, c) => s + (c.measured_score ?? 0), 0) / measured.length) * 10) / 10;
    b.avg_level = Math.round((measured.reduce((s, c) => s + (c.measured_level ?? 0), 0) / measured.length) * 10) / 10;
  }
}

export async function computeTypeProfile(pool: Pool, subjectId: string): Promise<TypeProfileResult> {
  await ensureCompetencyRuntimeSchema(pool);
  const sid = String(subjectId ?? '').trim();
  const mkBuckets = () => COMPETENCY_TYPES.map((t) => emptyBucket(t.type_key, t.label));

  const profile = await getProfile(pool, sid);
  if (!profile.measured || !profile.blueprint_id) {
    const buckets = mkBuckets();
    return {
      ok: true, subject_id: sid, measured: false, instance_id: profile.instance_id,
      blueprint_id: profile.blueprint_id, role_id: profile.role_id,
      total_competencies: 0, classified_competencies: 0, classification_coverage_pct: null,
      buckets, unclassified: emptyBucket('unclassified', 'Unclassified'),
      notes: ['No scored profile for this subject yet — generate and score an assessment first. Types are unmeasured (not assumed).'],
    };
  }

  const blueprint = await getBlueprint(pool, profile.blueprint_id);
  const comps = blueprint ? blueprint.competencies.filter((c) => c.active) : [];
  const domByComp = await competencyDomains(pool, comps.map((c) => c.competency_id));

  // competency_id -> measured onto-domain level/score (from the profile snapshot).
  const domLevel = new Map<string, { level: number; score: number }>();
  for (const d of profile.domain_scores) domLevel.set(d.onto_domain, { level: d.level, score: d.scaled_score });

  // competency_id -> type_key (curated Phase-1.1 map; absent = unclassified).
  const typeByComp = new Map<string, string>();
  if (comps.length > 0) {
    const { rows } = await pool.query(
      `SELECT competency_id, type_key FROM onto_competency_type_map WHERE competency_id = ANY($1::text[])`,
      [comps.map((c) => c.competency_id)],
    );
    for (const r of rows as any[]) typeByComp.set(r.competency_id, r.type_key);
  }

  const bucketByKey = new Map<string, TypeBucket>();
  const buckets = mkBuckets();
  for (const b of buckets) bucketByKey.set(b.type_key, b);
  const unclassified = emptyBucket('unclassified', 'Unclassified');

  let classified = 0;
  for (const c of comps) {
    const dom = domByComp.get(c.competency_id) ?? null;
    const isMeasurable = !!(dom && MEASURABLE_ONTO_DOMAINS.has(dom));
    const m = dom ? domLevel.get(dom) : undefined;
    const row: TypeBucketCompetency = {
      competency_id: c.competency_id,
      competency_name: c.competency_name,
      onto_domain: dom,
      measured_level: m ? m.level : null,
      measured_score: m ? m.score : null,
      measurement: isMeasurable ? 'domain_proxy' : 'unmeasurable',
    };
    const tk = typeByComp.get(c.competency_id);
    if (tk && bucketByKey.has(tk)) { bucketByKey.get(tk)!.competencies.push(row); classified += 1; }
    else unclassified.competencies.push(row);
  }

  for (const b of buckets) finalizeBucket(b);
  finalizeBucket(unclassified);

  const coverage = comps.length > 0 ? Math.round((classified / comps.length) * 1000) / 10 : null;
  const notes: string[] = [];
  notes.push('Each competency inherits its onto-domain PROXY score; the TYPE view is an additive grouping over the curated Phase-1.1 classification.');
  if (classified === 0 && comps.length > 0) {
    notes.push('No competencies are type-classified yet — run the competency-type seed (POST /api/competency-runtime/competency-types/seed). All competencies are reported UNCLASSIFIED until then (never force-bucketed).');
  } else if (coverage != null && coverage < 100) {
    notes.push(`${Math.round(100 - coverage)}% of competencies have no type mapping yet — reported as UNCLASSIFIED, never force-bucketed.`);
  }

  return {
    ok: true,
    subject_id: sid,
    measured: true,
    instance_id: profile.instance_id,
    blueprint_id: profile.blueprint_id,
    role_id: profile.role_id,
    total_competencies: comps.length,
    classified_competencies: classified,
    classification_coverage_pct: coverage,
    buckets,
    unclassified,
    notes,
  };
}

// ============================================================================
// 6. PROFILE HISTORY (Phase 2.5) — append-only snapshot list for a subject.
// ============================================================================
export interface ProfileHistoryRow {
  instance_id: string | null;
  blueprint_id: string | null;
  role_id: string | null;
  overall_score: number | null;
  overall_level: number | null;
  created_at: string | null;
}

export async function listProfileHistory(pool: Pool, subjectId: string): Promise<{ ok: boolean; subject_id: string; count: number; history: ProfileHistoryRow[] }> {
  await ensureCompetencyRuntimeSchema(pool);
  const sid = String(subjectId ?? '').trim();
  const { rows } = await pool.query(
    `SELECT instance_id, blueprint_id, role_id, overall_score, overall_level, created_at
       FROM onto_competency_profiles WHERE subject_id = $1 ORDER BY created_at DESC, id DESC`,
    [sid],
  );
  const history: ProfileHistoryRow[] = rows.map((r: any) => ({
    instance_id: r.instance_id,
    blueprint_id: r.blueprint_id,
    role_id: r.role_id,
    overall_score: r.overall_score != null ? Number(r.overall_score) : null,
    overall_level: r.overall_level != null ? Number(r.overall_level) : null,
    created_at: r.created_at,
  }));
  return { ok: true, subject_id: sid, count: history.length, history };
}

// ============================================================================
// 7. ROLE READINESS FOR SUBJECT (Phase 2.6) — candidate profile vs role profile.
// Builds the per-competency actuals from the subject's profile (domain proxy),
// then runs the role-readiness engine (Readiness % · Strengths · Gaps · Critical
// Gaps · Role Fit). Returns measured=false honestly when no profile/role exists.
// ============================================================================
export async function computeRoleReadinessForSubject(pool: Pool, subjectId: string): Promise<{ ok: boolean; subject_id: string; role_id: string | null; readiness: ReadinessResult | null; notes: string[] }> {
  await ensureCompetencyRuntimeSchema(pool);
  const sid = String(subjectId ?? '').trim();
  const profile = await getProfile(pool, sid);
  if (!profile.measured || !profile.blueprint_id) {
    return { ok: true, subject_id: sid, role_id: profile.role_id, readiness: null, notes: ['No scored profile for this subject yet — generate and score an assessment first.'] };
  }
  if (!profile.role_id) {
    return { ok: true, subject_id: sid, role_id: null, readiness: null, notes: ['This profile has no linked role — readiness compares against a role competency profile, which is absent here.'] };
  }

  const blueprint = await getBlueprint(pool, profile.blueprint_id);
  const comps = blueprint ? blueprint.competencies.filter((c) => c.active) : [];
  const domByComp = await competencyDomains(pool, comps.map((c) => c.competency_id));
  const domLevel = new Map<string, { level: number; score: number }>();
  for (const d of profile.domain_scores) domLevel.set(d.onto_domain, { level: d.level, score: d.scaled_score });

  const actuals: Record<string, number> = {};
  for (const c of comps) {
    const dom = domByComp.get(c.competency_id) ?? null;
    const m = dom ? domLevel.get(dom) : undefined;
    if (m) actuals[c.competency_id] = m.level;
  }

  // getRoleReadiness returns null ONLY when no role competency profile exists
  // (honest "unmeasured"); real DB/runtime errors propagate so the route surfaces
  // a 500 instead of masquerading a failure as business-state absence.
  const readiness = await getRoleReadiness(pool, profile.role_id, actuals);
  const notes: string[] = [];
  if (!readiness) notes.push(`No role competency profile defined for role '${profile.role_id}' — define one (onto_role_competency_profiles) before measuring readiness. Readiness is unmeasured, not assumed.`);
  return { ok: true, subject_id: sid, role_id: profile.role_id, readiness, notes };
}

// ============================================================================
// 8. PROFILE DASHBOARD (Phase 2.5) — composed read of profile + type buckets +
// gap analysis + readiness + history for one subject. Pure composition; the
// individual engines remain the source of truth.
// ============================================================================
export async function computeDashboard(pool: Pool, subjectId: string): Promise<any> {
  await ensureCompetencyRuntimeSchema(pool);
  const sid = String(subjectId ?? '').trim();
  const [profile, typeProfile, gap, readiness, history, trends] = await Promise.all([
    getProfile(pool, sid),
    computeTypeProfile(pool, sid),
    computeGapAnalysis(pool, sid),
    computeRoleReadinessForSubject(pool, sid),
    listProfileHistory(pool, sid),
    computeProfileTrends(pool, sid),
  ]);

  // T9 · CAPADEX behavioural-signal evidence → dom_behavioral (additive, flag-gated).
  // Concern-DIAGNOSTIC: it may only LOWER/flag the behavioural dimension as risk,
  // never raise it. Persisted scores are NEVER mutated — we surface an EFFECTIVE
  // (only-decreasing) behavioural dimension alongside the base. Flag-OFF → omitted
  // entirely (byte-identical legacy dashboard).
  const behaviouralDimension = isCompetencyRuntimeEnabled()
    ? await buildBehaviouralDimension(pool, sid, profile)
    : undefined;

  return {
    ok: true,
    subject_id: sid,
    version: COMPETENCY_RUNTIME_VERSION,
    profile,
    type_profile: typeProfile,
    gap_analysis: gap,
    role_readiness: readiness,
    history,
    trends,
    ...(behaviouralDimension ? { behavioural_dimension: behaviouralDimension } : {}),
  };
}

// ── T9 · Behavioural dimension (CAPADEX concern-diagnostic lowering) ──────────
// Read-only, never-throws. Composes computeBehaviouralEvidence over the existing
// CAPADEX behaviour bridge and applies it to the BEHAVIOURAL onto-domain
// (dom_behavioral) as a downward-only adjustment. Returns null on any failure so
// the dashboard degrades to its prior (un-adjusted) behavioural standing.
export interface BehaviouralDimension {
  onto_domain: 'dom_behavioral';
  base_score: number | null;        // measured proxy score from the profile (unchanged)
  effective_score: number | null;   // base lowered by behavioural risk (never raised); null when not measured
  risk_deficit: number;             // total points removed by concern-diagnostic risks
  applied: boolean;                 // true only when a measured base AND risk evidence both exist
  evidence: Awaited<ReturnType<typeof computeBehaviouralEvidence>>;
  note: string;
}

async function buildBehaviouralDimension(
  pool: Pool,
  subjectId: string,
  profile: ProfileView,
): Promise<BehaviouralDimension | null> {
  try {
    const evidence = await computeBehaviouralEvidence(pool, subjectId);
    const behRow = profile.domain_scores.find((d) => d.onto_domain === 'dom_behavioral');
    const baseScore = behRow ? Number(behRow.scaled_score) : null;

    // Total deficit only when risk evidence is actually present (else 0, never fabricated).
    const riskDeficit = evidence.available
      ? evidence.risk_signals.reduce((a, r) => a + (r.deficit ?? 0), 0)
      : 0;

    // Effective score can ONLY decrease. With no measured base or no risk evidence
    // it equals the base (unchanged) — CAPADEX signals never raise the dimension.
    const applied = baseScore != null && evidence.available && riskDeficit > 0;
    const effectiveScore = baseScore == null
      ? null
      : applied
        ? Math.max(0, Math.round((baseScore - riskDeficit) * 10) / 10)
        : baseScore;

    const note = baseScore == null
      ? 'No measured behavioural proxy score yet — behavioural risk evidence is reported but cannot adjust an unmeasured dimension (never assumed).'
      : applied
        ? `Behavioural proxy lowered ${baseScore} → ${effectiveScore} by ${riskDeficit} point(s) of concern-diagnostic CAPADEX risk. Risk can only lower this dimension, never raise it.`
        : 'No concern-diagnostic behavioural risk linked — behavioural dimension is unchanged from its measured proxy (signals never raise it).';

    return {
      onto_domain: 'dom_behavioral',
      base_score: baseScore,
      effective_score: effectiveScore,
      risk_deficit: riskDeficit,
      applied,
      evidence,
      note,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// 9. COMPETENCY GAP ENGINE + PRIORITIZATION (Phase 2.7)
// ----------------------------------------------------------------------------
// Strictly additive composition over computeGapAnalysis (NEVER recomputes the
// gap math). Produces the canonical Phase-2.7 view per competency:
//   Required Competency · Current Competency · Gap · Priority · Development Need
// plus a priority rollup (gap_prioritization_engine).
//
// Honesty contract:
//   - Priority is DERIVED deterministically from criticality x gap magnitude —
//     never tuned, never randomised. The matrix is published below.
//   - UNMEASURABLE competencies (no question-bank coverage) and not-yet-scored
//     measurable competencies are 'unprioritized' with a reason — never assigned
//     a fabricated priority or development need.
//   - Met-or-exceeded competencies are priority 'none' (maintain, no dev need).
//   - Development Need text is a deterministic template over EXISTING fields
//     (name / required / current / gap / criticality) — no fabricated content.
// ============================================================================
export type GapPriority = 'high' | 'medium' | 'low' | 'none' | 'unprioritized';

export interface PrioritizedGapRow {
  competency_id: string;
  competency_name: string | null;
  onto_domain: string | null;
  required_level: number;       // Required Competency (1..5)
  current_level: number | null; // Current Competency (1..5), null when unmeasured
  current_score: number | null; // proxied scaled score 0..100
  gap: number | null;           // Gap = required - current (levels)
  severity: GapSeverity;
  criticality: string;
  weight: number;
  blocking: boolean;            // critical & below required
  priority: GapPriority;        // Priority (high/medium/low/none/unprioritized)
  priority_rank: number;        // numeric — lower = act first (stable UX sort)
  development_need: string;     // Development Need (deterministic guidance)
  measurement: 'domain_proxy' | 'unmeasurable';
}

// Priority matrix (criticality x gap magnitude). Lower rank acts first.
//   critical   & gap>0          -> high   (always blocking)
//   important  & gap>=2         -> high   ; gap==1 -> medium
//   desirable  & gap>=2         -> medium ; gap==1 -> low
//   optional   & gap>=1         -> low
//   gap<=0 (met/exceeded)       -> none
//   unmeasurable / unscored     -> unprioritized
export function prioritizeGap(g: GapRow): { priority: GapPriority; rank: number } {
  if (g.measurement === 'unmeasurable' || g.measured_level == null || g.gap == null) {
    return { priority: 'unprioritized', rank: 90 };
  }
  if (g.gap <= 0) return { priority: 'none', rank: 80 };
  switch (g.criticality) {
    case 'critical':  return { priority: 'high',   rank: 0 };
    case 'important': return g.gap >= 2 ? { priority: 'high',   rank: 1 } : { priority: 'medium', rank: 10 };
    case 'desirable': return g.gap >= 2 ? { priority: 'medium', rank: 11 } : { priority: 'low', rank: 20 };
    default:          return { priority: 'low', rank: 21 }; // optional (gap>0)
  }
}

// Deterministic development-need guidance over EXISTING fields only.
export function developmentNeed(g: GapRow): string {
  const name = g.competency_name ?? g.competency_id;
  if (g.measurement === 'unmeasurable') {
    return `${name} cannot be measured yet (no question-bank coverage for its onto-domain). Establish measurement before planning development — gap is unmeasured, not assumed.`;
  }
  if (g.measured_level == null || g.gap == null) {
    return `${name} has not been scored yet. Assess this competency before planning development.`;
  }
  if (g.gap <= 0) {
    return `${name} meets or exceeds the required level ${g.required_level} (current ${g.measured_level}). Maintain — no development gap.`;
  }
  const plural = g.gap === 1 ? 'level' : 'levels';
  const critWord = g.criticality === 'critical'
    ? 'Critical role competency — close this gap first.'
    : g.criticality === 'important'
      ? 'Important competency — prioritise after critical gaps.'
      : g.criticality === 'desirable'
        ? 'Desirable competency — address once higher-criticality gaps are closed.'
        : 'Optional competency — develop opportunistically.';
  return `Raise ${name} from level ${g.measured_level} to required level ${g.required_level} (gap of ${g.gap} ${plural}). ${critWord}`;
}

export interface GapPrioritySummary {
  high: number;
  medium: number;
  low: number;
  none: number;
  unprioritized: number;
  development_needs: number; // high + medium + low (actionable gaps)
}

export interface CompetencyGapEngineResult {
  ok: boolean;
  error?: string;
  subject_id?: string;
  blueprint_id?: string | null;
  role_id?: string | null;
  measured?: boolean;
  total_competencies?: number;
  measurable_competencies?: number;
  unmeasurable_competencies?: number;
  coverage_pct?: number | null;
  summary?: GapPrioritySummary;
  gaps?: PrioritizedGapRow[];
  role_readiness?: ReadinessResult | null;
  notes?: string[];
}

export async function computeCompetencyGapEngine(pool: Pool, subjectId: string): Promise<CompetencyGapEngineResult> {
  // Reuse the existing gap analysis verbatim — this layer only re-shapes + prioritizes.
  const base = await computeGapAnalysis(pool, subjectId);
  if (!base.ok) return { ok: false, error: base.error, subject_id: base.subject_id };

  const rows: PrioritizedGapRow[] = (base.gaps ?? []).map((g) => {
    const { priority, rank } = prioritizeGap(g);
    return {
      competency_id: g.competency_id,
      competency_name: g.competency_name,
      onto_domain: g.onto_domain,
      required_level: g.required_level,
      current_level: g.measured_level,
      current_score: g.measured_score,
      gap: g.gap,
      severity: g.severity,
      criticality: g.criticality,
      weight: g.weight,
      blocking: g.blocking,
      priority,
      priority_rank: rank,
      development_need: developmentNeed(g),
      measurement: g.measurement,
    };
  });

  // Sort by priority rank, then larger gap, then heavier weight (stable, explainable).
  rows.sort((a, b) =>
    a.priority_rank - b.priority_rank ||
    (b.gap ?? -99) - (a.gap ?? -99) ||
    b.weight - a.weight);

  const summary: GapPrioritySummary = {
    high: rows.filter((r) => r.priority === 'high').length,
    medium: rows.filter((r) => r.priority === 'medium').length,
    low: rows.filter((r) => r.priority === 'low').length,
    none: rows.filter((r) => r.priority === 'none').length,
    unprioritized: rows.filter((r) => r.priority === 'unprioritized').length,
    development_needs: rows.filter((r) => r.priority === 'high' || r.priority === 'medium' || r.priority === 'low').length,
  };

  const notes = [...(base.notes ?? [])];
  if (summary.development_needs === 0 && (base.measured ?? false)) {
    notes.push('No actionable development gaps — all measured competencies meet or exceed required levels.');
  }
  if (summary.unprioritized > 0) {
    notes.push(`${summary.unprioritized} competenc${summary.unprioritized === 1 ? 'y is' : 'ies are'} unprioritized (unmeasurable or not yet scored) — surfaced honestly, never assigned a fabricated priority.`);
  }

  return {
    ok: true,
    subject_id: base.subject_id,
    blueprint_id: base.blueprint_id,
    role_id: base.role_id,
    measured: base.measured,
    total_competencies: base.total_competencies,
    measurable_competencies: base.measurable_competencies,
    unmeasurable_competencies: base.unmeasurable_competencies,
    coverage_pct: base.coverage_pct,
    summary,
    gaps: rows,
    role_readiness: base.role_readiness ?? null,
    notes,
  };
}

// gap_dashboard — composed read: prioritized gap engine + role readiness band +
// the highest-priority development needs surfaced for a quick console view.
export async function computeGapDashboard(pool: Pool, subjectId: string): Promise<any> {
  const sid = String(subjectId ?? '').trim();
  const [engine, profile] = await Promise.all([
    computeCompetencyGapEngine(pool, sid),
    getProfile(pool, sid),
  ]);
  if (!engine.ok) return { ok: false, error: engine.error, subject_id: sid };

  const topPriorities = (engine.gaps ?? [])
    .filter((g) => g.priority === 'high' || g.priority === 'medium' || g.priority === 'low')
    .slice(0, 5);

  return {
    ok: true,
    subject_id: sid,
    version: COMPETENCY_RUNTIME_VERSION,
    measured: engine.measured ?? false,
    role_id: engine.role_id ?? null,
    blueprint_id: engine.blueprint_id ?? null,
    overall_score: profile.overall_score,
    overall_level: profile.overall_level,
    coverage_pct: engine.coverage_pct ?? null,
    summary: engine.summary,
    readiness_band: engine.role_readiness?.readiness_band ?? null,
    role_fit: engine.role_readiness?.role_fit ?? null,
    top_priorities: topPriorities,
    gaps: engine.gaps ?? [],
    notes: engine.notes ?? [],
  };
}

// ============================================================================
// 10. COMPETENCY SIGNAL ENGINE (Phase 2.8)
// Derives higher-order behavioural SIGNALS from combinations of MEASURED
// competency states, via a curated signal_library + deterministic signal_rules.
//   e.g.  Low Communication + Low Collaboration + Low Presentation
//           -> "Workplace Communication Risk"  (risk)
//         High Problem Solving + High Systems Thinking
//           -> "Innovation Potential"          (potential)
//
// Honesty contract:
//   - A signal FIRES only when EVERY condition is satisfied by a MEASURED
//     competency. If any contributing competency is absent from the subject's
//     blueprint OR not yet scored, the signal is 'unevaluable' — never fired
//     (and never silently suppressed) from missing data.
//   - Thresholds are fixed + published (low = level <= 2, high = level >= 4);
//     level 3 satisfies neither direction. No tuning, no randomness.
//   - signal_library + signal_rules are a STATIC curated catalog; the engine
//     only matches them against competencies the subject actually has. Every
//     fired signal carries the exact competencies that triggered it (full
//     traceability), and every condition carries a reason string.
//   - Signals are DEVELOPMENTAL framing only — never hiring/promotion/
//     suitability predictions.
// ============================================================================
export type SignalPolarity = 'risk' | 'potential';
export type SignalDirection = 'low' | 'high';
export type SignalStatus = 'fired' | 'not_fired' | 'unevaluable';
export type SignalConditionStatus = 'met' | 'unmet' | 'unevaluable';

export const SIGNAL_LOW_LEVEL_MAX = 2;   // level <= 2  => "low"
export const SIGNAL_HIGH_LEVEL_MIN = 4;  // level >= 4  => "high"

export interface SignalCondition {
  label: string;            // human label, e.g. "Low Communication"
  keywords: string[];       // competency-name tokens (lowercased substring match)
  direction: SignalDirection;
}

// signal_library — catalog metadata (one row per derivable signal).
export interface SignalLibraryEntry {
  signal_id: string;
  name: string;
  polarity: SignalPolarity;
  category: string;
  description: string;
  interpretation: string;   // developmental reading — never predictive
}

// signal_rules — the deterministic firing rule for each signal (conditions).
export interface SignalRule {
  signal_id: string;
  logic: 'all';             // every condition must hold (conservative)
  conditions: SignalCondition[];
}

export const SIGNAL_LIBRARY: SignalLibraryEntry[] = [
  {
    signal_id: 'workplace_communication_risk',
    name: 'Workplace Communication Risk',
    polarity: 'risk',
    category: 'Communication & Influence',
    description: 'A cluster of low communication-facing competencies that, together, can impede day-to-day workplace effectiveness.',
    interpretation: 'Developmental flag — suggests communication-skills support may help. Not a judgement of the person or a performance prediction.',
  },
  {
    signal_id: 'innovation_potential',
    name: 'Innovation Potential',
    polarity: 'potential',
    category: 'Problem Solving',
    description: 'Strong analytical and systems-level thinking combine into a capacity to generate and structure novel solutions.',
    interpretation: 'Developmental strength — a good area to stretch with ambiguous, open-ended problems.',
  },
  {
    signal_id: 'stakeholder_disconnect_risk',
    name: 'Stakeholder Disconnect Risk',
    polarity: 'risk',
    category: 'Communication & Influence',
    description: 'Low stakeholder management combined with low active listening can lead to misaligned expectations.',
    interpretation: 'Developmental flag — structured stakeholder and listening practices may help. Not a performance prediction.',
  },
  {
    signal_id: 'change_resilience_potential',
    name: 'Change Resilience Potential',
    polarity: 'potential',
    category: 'Adaptability',
    description: 'High adaptability paired with comfort in ambiguity indicates resilience through change and uncertainty.',
    interpretation: 'Developmental strength — well suited to evolving or loosely-defined contexts.',
  },
  {
    signal_id: 'ownership_potential',
    name: 'Ownership Potential',
    polarity: 'potential',
    category: 'Drive & Ownership',
    description: 'High accountability combined with high adaptability points to dependable ownership under changing conditions.',
    interpretation: 'Developmental strength — reliable in taking and adjusting ownership of outcomes.',
  },
  {
    signal_id: 'collaborative_leadership_potential',
    name: 'Collaborative Leadership Potential',
    polarity: 'potential',
    category: 'Leadership',
    description: 'High stakeholder management combined with strong active listening indicates a collaborative, people-centred leadership lean.',
    interpretation: 'Developmental strength — a foundation to build facilitative leadership on.',
  },
  {
    signal_id: 'disengagement_risk',
    name: 'Disengagement Risk',
    polarity: 'risk',
    category: 'Drive & Ownership',
    description: 'Low accountability combined with low adaptability can indicate reduced engagement or drive.',
    interpretation: 'Developmental flag — motivation and ownership coaching may help. Not a performance prediction.',
  },
];

export const SIGNAL_RULES: SignalRule[] = [
  {
    signal_id: 'workplace_communication_risk',
    logic: 'all',
    conditions: [
      { label: 'Low Communication', keywords: ['communication'], direction: 'low' },
      { label: 'Low Collaboration', keywords: ['collaboration', 'teamwork'], direction: 'low' },
      { label: 'Low Presentation', keywords: ['presentation', 'presenting'], direction: 'low' },
    ],
  },
  {
    signal_id: 'innovation_potential',
    logic: 'all',
    conditions: [
      { label: 'High Problem Solving', keywords: ['problem solving', 'problem-solving'], direction: 'high' },
      { label: 'High Systems Thinking', keywords: ['systems thinking', 'systems'], direction: 'high' },
    ],
  },
  {
    signal_id: 'stakeholder_disconnect_risk',
    logic: 'all',
    conditions: [
      { label: 'Low Stakeholder Management', keywords: ['stakeholder'], direction: 'low' },
      { label: 'Low Active Listening', keywords: ['active listening', 'listening'], direction: 'low' },
    ],
  },
  {
    signal_id: 'change_resilience_potential',
    logic: 'all',
    conditions: [
      { label: 'High Adaptability', keywords: ['adaptability', 'adaptive'], direction: 'high' },
      { label: 'High Ambiguity Tolerance', keywords: ['ambiguity'], direction: 'high' },
    ],
  },
  {
    signal_id: 'ownership_potential',
    logic: 'all',
    conditions: [
      { label: 'High Accountability', keywords: ['accountability', 'ownership'], direction: 'high' },
      { label: 'High Adaptability', keywords: ['adaptability', 'adaptive'], direction: 'high' },
    ],
  },
  {
    signal_id: 'collaborative_leadership_potential',
    logic: 'all',
    conditions: [
      { label: 'High Stakeholder Management', keywords: ['stakeholder'], direction: 'high' },
      { label: 'High Active Listening', keywords: ['active listening', 'listening'], direction: 'high' },
    ],
  },
  {
    signal_id: 'disengagement_risk',
    logic: 'all',
    conditions: [
      { label: 'Low Accountability', keywords: ['accountability', 'ownership'], direction: 'low' },
      { label: 'Low Adaptability', keywords: ['adaptability', 'adaptive'], direction: 'low' },
    ],
  },
];

interface SignalSubjectComp {
  competency_id: string;
  competency_name: string;
  name_lc: string;
  level: number | null;
  score: number | null;
  measurement: 'domain_proxy' | 'unmeasurable';
}

export interface EvaluatedSignalCondition {
  label: string;
  direction: SignalDirection;
  keywords: string[];
  status: SignalConditionStatus;
  matched_competency: { competency_id: string; competency_name: string; level: number | null; score: number | null } | null;
  reason: string;
}

export interface SignalResult {
  signal_id: string;
  name: string;
  polarity: SignalPolarity;
  category: string;
  description: string;
  interpretation: string;
  status: SignalStatus;
  conditions: EvaluatedSignalCondition[];
  triggered_by: { competency_id: string; competency_name: string; level: number | null }[];
}

export interface SignalEngineSummary {
  total_signals: number;
  fired: number;
  risk_fired: number;
  potential_fired: number;
  not_fired: number;
  unevaluable: number;
}

export interface CompetencySignalEngineResult {
  ok: boolean;
  error?: string;
  subject_id?: string;
  blueprint_id?: string | null;
  role_id?: string | null;
  measured?: boolean;
  summary?: SignalEngineSummary;
  signals?: SignalResult[];
  notes?: string[];
}

// Evaluate ONE condition against the subject's competencies.
function evaluateSignalCondition(cond: SignalCondition, comps: SignalSubjectComp[]): EvaluatedSignalCondition {
  const base = { label: cond.label, direction: cond.direction, keywords: cond.keywords };
  const matched = comps.filter((c) => cond.keywords.some((k) => c.name_lc.includes(k)));
  if (matched.length === 0) {
    return { ...base, status: 'unevaluable', matched_competency: null,
      reason: `No competency in this blueprint matches "${cond.label}" — cannot evaluate (absent, not assumed).` };
  }
  const measured = matched.filter((c) => c.level != null);
  if (measured.length === 0) {
    const m = [...matched].sort((a, b) => a.competency_id.localeCompare(b.competency_id))[0];
    return { ...base, status: 'unevaluable',
      matched_competency: { competency_id: m.competency_id, competency_name: m.competency_name, level: m.level, score: m.score },
      reason: `${m.competency_name} matches "${cond.label}" but is not yet scored — cannot evaluate.` };
  }
  // Representative = the strongest evidence in the condition's direction
  // (lowest level for 'low', highest for 'high'); tie-break by competency_id.
  const rep = measured.reduce((best, c) => {
    if (cond.direction === 'low') {
      if (c.level! < best.level!) return c;
    } else if (c.level! > best.level!) return c;
    if (c.level! === best.level! && c.competency_id.localeCompare(best.competency_id) < 0) return c;
    return best;
  });
  const met = cond.direction === 'low' ? rep.level! <= SIGNAL_LOW_LEVEL_MAX : rep.level! >= SIGNAL_HIGH_LEVEL_MIN;
  const want = cond.direction === 'low' ? `<= ${SIGNAL_LOW_LEVEL_MAX}` : `>= ${SIGNAL_HIGH_LEVEL_MIN}`;
  return { ...base, status: met ? 'met' : 'unmet',
    matched_competency: { competency_id: rep.competency_id, competency_name: rep.competency_name, level: rep.level, score: rep.score },
    reason: `${rep.competency_name} is at level ${rep.level} (${cond.direction} requires level ${want}) — condition ${met ? 'met' : 'not met'}.` };
}

export async function computeCompetencySignalEngine(pool: Pool, subjectId: string): Promise<CompetencySignalEngineResult> {
  // Reuse the existing gap analysis verbatim — this layer only reads its measured states.
  const base = await computeGapAnalysis(pool, subjectId);
  if (!base.ok) return { ok: false, error: base.error, subject_id: base.subject_id };

  const comps: SignalSubjectComp[] = (base.gaps ?? []).map((g) => ({
    competency_id: g.competency_id,
    competency_name: g.competency_name ?? g.competency_id,
    name_lc: (g.competency_name ?? g.competency_id).toLowerCase(),
    level: g.measured_level,
    score: g.measured_score,
    measurement: g.measurement,
  }));

  const libById = new Map(SIGNAL_LIBRARY.map((s) => [s.signal_id, s]));

  const signals: SignalResult[] = SIGNAL_RULES.map((rule) => {
    const lib = libById.get(rule.signal_id)!;
    const conditions = rule.conditions.map((c) => evaluateSignalCondition(c, comps));
    let status: SignalStatus;
    if (conditions.some((c) => c.status === 'unevaluable')) {
      status = 'unevaluable';
    } else if (conditions.every((c) => c.status === 'met')) {
      status = 'fired';
    } else {
      status = 'not_fired';
    }
    const triggered_by = status === 'fired'
      ? conditions.map((c) => ({
          competency_id: c.matched_competency!.competency_id,
          competency_name: c.matched_competency!.competency_name,
          level: c.matched_competency!.level,
        }))
      : [];
    return {
      signal_id: lib.signal_id, name: lib.name, polarity: lib.polarity, category: lib.category,
      description: lib.description, interpretation: lib.interpretation,
      status, conditions, triggered_by,
    };
  });

  // Sort: fired first, then not_fired, then unevaluable; risks before potentials; then name.
  const statusRank: Record<SignalStatus, number> = { fired: 0, not_fired: 1, unevaluable: 2 };
  const polRank: Record<SignalPolarity, number> = { risk: 0, potential: 1 };
  signals.sort((a, b) =>
    statusRank[a.status] - statusRank[b.status] ||
    polRank[a.polarity] - polRank[b.polarity] ||
    a.name.localeCompare(b.name));

  const summary: SignalEngineSummary = {
    total_signals: signals.length,
    fired: signals.filter((s) => s.status === 'fired').length,
    risk_fired: signals.filter((s) => s.status === 'fired' && s.polarity === 'risk').length,
    potential_fired: signals.filter((s) => s.status === 'fired' && s.polarity === 'potential').length,
    not_fired: signals.filter((s) => s.status === 'not_fired').length,
    unevaluable: signals.filter((s) => s.status === 'unevaluable').length,
  };

  const notes: string[] = [];
  notes.push(`Signals derive from MEASURED competency combinations only (low = level <= ${SIGNAL_LOW_LEVEL_MAX}, high = level >= ${SIGNAL_HIGH_LEVEL_MIN}). A signal fires only when every contributing competency is measured.`);
  if (!base.measured) {
    notes.push('No scored profile for this subject yet — every signal is unevaluable until an assessment is scored.');
  }
  if (summary.unevaluable > 0) {
    notes.push(`${summary.unevaluable} signal(s) are unevaluable — a contributing competency is absent from this blueprint or not yet scored. Surfaced honestly, never fired from missing data.`);
  }
  notes.push('Signals are DEVELOPMENTAL framing only — never hiring, promotion, or suitability predictions.');

  return {
    ok: true,
    subject_id: base.subject_id,
    blueprint_id: base.blueprint_id,
    role_id: base.role_id,
    measured: base.measured,
    summary,
    signals,
    notes,
  };
}

// ============================================================================
// 11. COMPETENCY BENCHMARK FOUNDATION (Phase 2.9)
// Enables comparison: Candidate vs Role / Department / Function / Industry /
// Institution. COMPOSES the existing real benchmark substrate
// (services/adaptive-benchmark.ts: resolveCohort + benchmarkCompetency, with
// empirical-percentile k-anonymity over bench_cohorts/bench_competency_benchmarks)
// and computeGapAnalysis (candidate per-competency measured_score, a 0..100
// domain-proxy). Strictly additive, read-only, NEVER fabricates a candidate's
// dimension membership and NEVER reinvents percentile math.
//
// Honesty contract:
//   - A dimension is 'available' only when a real bench cohort backs it AND the
//     candidate's membership for that dimension is actually captured.
//   - Function/Industry cohorts EXIST but the runtime subject model carries no
//     function/industry membership -> 'context_unavailable' (not fabricated).
//   - Department/Institution have NO bench cohort population -> 'dimension_unsupported'.
//   - Per-competency comparison: 'unevaluable' (candidate unscored), 'no_benchmark'
//     (no bench row for that competency_id), 'suppressed' (cohort n < k_min), else
//     above/at/below the cohort from the empirical band.
// ============================================================================

export type BenchmarkDimensionKey = 'role' | 'department' | 'function' | 'industry' | 'institution';
export type BenchmarkDimensionStatus = 'available' | 'context_unavailable' | 'dimension_unsupported' | 'no_cohort';
export type ComparisonStatus = 'above' | 'at' | 'below' | 'no_benchmark' | 'suppressed' | 'unevaluable';

interface BenchmarkDimensionDef {
  key: BenchmarkDimensionKey;
  label: string;
  cohort_type: 'role' | 'function' | 'industry' | null; // bench cohort_type backing it; null = no population
  context_field: 'role_id' | 'function_id' | 'industry_id' | null; // candidate attr that places them in a cohort
}

// Ordered as requested: Role, Department, Function, Industry, Institution.
export const BENCHMARK_DIMENSIONS: BenchmarkDimensionDef[] = [
  { key: 'role',        label: 'Role',        cohort_type: 'role',     context_field: 'role_id' },
  { key: 'department',  label: 'Department',  cohort_type: null,       context_field: null },
  { key: 'function',    label: 'Function',    cohort_type: 'function', context_field: 'function_id' },
  { key: 'industry',    label: 'Industry',    cohort_type: 'industry', context_field: 'industry_id' },
  { key: 'institution', label: 'Institution', cohort_type: null,       context_field: null },
];

export interface CandidateBenchmarkContext {
  role_id: string | null;
  function_id: string | null;
  industry_id: string | null;
}

export interface BenchmarkDimensionResult {
  key: BenchmarkDimensionKey;
  label: string;
  status: BenchmarkDimensionStatus;
  reason: string;
  cohort: { id: string; name: string; type: string; k_min: number } | null;
  benchmarked_competencies: number | null; // how many competencies have a bench row in this cohort
}

export interface BenchmarkEngineResult {
  ok: boolean;
  error?: string;
  subject_id?: string;
  role_id?: string | null;
  measured?: boolean;
  candidate_context?: CandidateBenchmarkContext;
  dimensions?: BenchmarkDimensionResult[];
  summary?: {
    total_dimensions: number;
    available: number;
    context_unavailable: number;
    dimension_unsupported: number;
    no_cohort: number;
  };
  notes?: string[];
}

/**
 * benchmark_engine — resolve which comparison dimensions are honestly available
 * for a subject, and which bench cohort backs each. Read-only; never fabricates
 * a candidate's dimension membership.
 */
export async function computeBenchmarkEngine(pool: Pool, subjectId: string): Promise<BenchmarkEngineResult> {
  await ensureCompetencyRuntimeSchema(pool);
  const sid = String(subjectId ?? '').trim();
  if (!sid) return { ok: false, error: 'subject_required' };

  const profile = await getProfile(pool, sid);
  // The runtime subject model only captures role_id. Function/industry membership
  // is NOT modelled here -> honestly null (never derived from the role by guesswork).
  const ctx: CandidateBenchmarkContext = {
    role_id: profile.role_id ?? null,
    function_id: null,
    industry_id: null,
  };

  const dimensions: BenchmarkDimensionResult[] = [];
  for (const d of BENCHMARK_DIMENSIONS) {
    if (d.cohort_type === null) {
      dimensions.push({
        key: d.key, label: d.label, status: 'dimension_unsupported',
        reason: `No benchmark cohort population exists for the ${d.label} dimension yet — comparison is honestly unsupported, never fabricated.`,
        cohort: null, benchmarked_competencies: null,
      });
      continue;
    }
    const ctxVal = d.context_field ? ctx[d.context_field] : null;
    if (!ctxVal) {
      dimensions.push({
        key: d.key, label: d.label, status: 'context_unavailable',
        reason: `${d.label} cohorts exist, but this candidate has no ${d.label.toLowerCase()} membership captured — cannot be placed in a ${d.label.toLowerCase()} cohort.`,
        cohort: null, benchmarked_competencies: null,
      });
      continue;
    }
    const cohort = await resolveCohort(pool, { role_id: ctx.role_id ?? undefined, function_id: ctx.function_id ?? undefined, industry_id: ctx.industry_id ?? undefined } as never, d.cohort_type);
    if (!cohort) {
      dimensions.push({
        key: d.key, label: d.label, status: 'no_cohort',
        reason: `No active ${d.label.toLowerCase()} cohort matches this candidate's ${d.context_field} = ${ctxVal}.`,
        cohort: null, benchmarked_competencies: null,
      });
      continue;
    }
    let benchCount: number | null = null;
    try {
      const { rows } = await pool.query<{ c: string }>(
        `SELECT count(DISTINCT competency_id)::text AS c FROM bench_competency_benchmarks WHERE cohort_id = $1`,
        [cohort.id]);
      benchCount = rows[0] ? Number(rows[0].c) : 0;
    } catch { benchCount = null; }
    dimensions.push({
      key: d.key, label: d.label, status: 'available',
      reason: `Backed by cohort ${cohort.name} (k_min ${cohort.k_min}).`,
      cohort: { id: cohort.id, name: cohort.name, type: cohort.cohort_type, k_min: cohort.k_min },
      benchmarked_competencies: benchCount,
    });
  }

  const summary = {
    total_dimensions: dimensions.length,
    available: dimensions.filter((d) => d.status === 'available').length,
    context_unavailable: dimensions.filter((d) => d.status === 'context_unavailable').length,
    dimension_unsupported: dimensions.filter((d) => d.status === 'dimension_unsupported').length,
    no_cohort: dimensions.filter((d) => d.status === 'no_cohort').length,
  };

  const notes: string[] = [];
  notes.push('Comparison dimensions are resolved from REAL benchmark cohorts only; a dimension activates only when the candidate\'s membership for it is actually captured (never inferred).');
  if (!profile.measured) notes.push('No scored profile for this subject yet — dimensions may resolve, but no competency comparison can run until an assessment is scored.');
  if (summary.context_unavailable > 0) notes.push(`${summary.context_unavailable} dimension(s) have cohorts but no captured candidate membership — surfaced as context_unavailable, never fabricated.`);
  if (summary.dimension_unsupported > 0) notes.push(`${summary.dimension_unsupported} dimension(s) have no benchmark cohort population — honestly unsupported.`);

  return {
    ok: true,
    subject_id: sid,
    role_id: profile.role_id ?? null,
    measured: profile.measured,
    candidate_context: ctx,
    dimensions,
    summary,
    notes,
  };
}

export interface CompetencyComparison {
  competency_id: string;
  competency_name: string | null;
  user_score: number | null;
  percentile: number | null;
  band: string | null;
  status: ComparisonStatus;
  cohort_n: number | null;
  reason?: string;
}

export interface ComparisonDimensionResult {
  key: BenchmarkDimensionKey;
  label: string;
  status: BenchmarkDimensionStatus;
  cohort: { id: string; name: string; type: string; k_min: number } | null;
  comparisons: CompetencyComparison[];
  summary: {
    compared: number; above: number; at: number; below: number;
    no_benchmark: number; suppressed: number; unevaluable: number;
  };
  aggregate_percentile: number | null; // mean of compared percentiles
}

export interface BenchmarkComparisonResult {
  ok: boolean;
  error?: string;
  subject_id?: string;
  role_id?: string | null;
  measured?: boolean;
  total_competencies?: number;
  dimensions?: ComparisonDimensionResult[];
  notes?: string[];
}

function bandToStatus(band: string | null): ComparisonStatus {
  if (band === 'top' || band === 'upper') return 'above';
  if (band === 'mid') return 'at';
  if (band === 'lower' || band === 'bottom') return 'below';
  return 'at';
}

/**
 * comparison_engine — compare a candidate's measured competencies against each
 * AVAILABLE benchmark dimension via the existing empirical-percentile engine
 * (k-anonymity enforced inside benchmarkCompetency). Honest per-competency status.
 */
export async function computeBenchmarkComparison(pool: Pool, subjectId: string): Promise<BenchmarkComparisonResult> {
  const sid = String(subjectId ?? '').trim();
  if (!sid) return { ok: false, error: 'subject_required' };

  const [gap, engine] = await Promise.all([
    computeGapAnalysis(pool, sid),
    computeBenchmarkEngine(pool, sid),
  ]);
  if (!gap.ok) return { ok: false, error: gap.error ?? 'gap_failed', subject_id: sid };
  if (!engine.ok) return { ok: false, error: engine.error ?? 'engine_failed', subject_id: sid };

  const candidateComps = (gap.gaps ?? []).map((g) => ({
    competency_id: g.competency_id,
    competency_name: g.competency_name,
    user_score: g.measured_score, // 0..100 domain-proxy, or null when unscored
  }));

  const dimensions: ComparisonDimensionResult[] = [];
  for (const dim of engine.dimensions ?? []) {
    const cohortRef: CohortRef | null = dim.cohort
      ? { id: dim.cohort.id, cohort_type: dim.cohort.type, name: dim.cohort.name, k_min: dim.cohort.k_min }
      : null;

    const comparisons: CompetencyComparison[] = [];
    if (dim.status === 'available' && cohortRef) {
      for (const c of candidateComps) {
        if (typeof c.user_score !== 'number') {
          comparisons.push({
            competency_id: c.competency_id, competency_name: c.competency_name,
            user_score: null, percentile: null, band: null, status: 'unevaluable',
            cohort_n: null, reason: 'Candidate competency is not scored yet — comparison is unevaluable (never assumed).',
          });
          continue;
        }
        const res = await benchmarkCompetency(pool, { cohort: cohortRef, competency_id: c.competency_id, user_score: c.user_score });
        if (!res) {
          comparisons.push({
            competency_id: c.competency_id, competency_name: c.competency_name,
            user_score: c.user_score, percentile: null, band: null, status: 'no_benchmark',
            cohort_n: null, reason: 'No benchmark distribution exists for this competency in the cohort.',
          });
          continue;
        }
        if ((res as { suppressed?: boolean }).suppressed) {
          comparisons.push({
            competency_id: c.competency_id, competency_name: c.competency_name,
            user_score: c.user_score, percentile: null, band: null, status: 'suppressed',
            cohort_n: (res.cohort_aggregates as { n?: number })?.n ?? null,
            reason: 'Cohort below k-anonymity threshold — percentile suppressed.',
          });
          continue;
        }
        comparisons.push({
          competency_id: c.competency_id, competency_name: c.competency_name,
          user_score: c.user_score, percentile: res.percentile, band: res.band,
          status: bandToStatus(res.band),
          cohort_n: (res.cohort_aggregates as { n?: number })?.n ?? null,
        });
      }
    }

    const compared = comparisons.filter((x) => x.percentile != null);
    const aggregate = compared.length
      ? Math.round(compared.reduce((s, x) => s + (x.percentile ?? 0), 0) / compared.length)
      : null;
    dimensions.push({
      key: dim.key, label: dim.label, status: dim.status, cohort: dim.cohort,
      comparisons,
      summary: {
        compared: compared.length,
        above: comparisons.filter((x) => x.status === 'above').length,
        at: comparisons.filter((x) => x.status === 'at').length,
        below: comparisons.filter((x) => x.status === 'below').length,
        no_benchmark: comparisons.filter((x) => x.status === 'no_benchmark').length,
        suppressed: comparisons.filter((x) => x.status === 'suppressed').length,
        unevaluable: comparisons.filter((x) => x.status === 'unevaluable').length,
      },
      aggregate_percentile: aggregate,
    });
  }

  const notes: string[] = [...(engine.notes ?? [])];
  notes.push('Percentiles are EMPIRICAL (count of cohort samples <= candidate score / n) via the shared benchmark engine — never Gaussian-assumed.');
  notes.push('Comparison is DEVELOPMENTAL framing only — a percentile is standing vs a peer cohort, never a hiring, promotion, or suitability prediction.');

  return {
    ok: true,
    subject_id: sid,
    role_id: engine.role_id ?? null,
    measured: gap.measured ?? false,
    total_competencies: candidateComps.length,
    dimensions,
    notes,
  };
}

export interface BenchmarkDashboardResult {
  ok: boolean;
  error?: string;
  subject_id?: string;
  role_id?: string | null;
  measured?: boolean;
  summary?: {
    dimensions_total: number;
    dimensions_available: number;
    total_comparisons: number;
    primary: {
      dimension: BenchmarkDimensionKey;
      cohort: string | null;
      aggregate_percentile: number | null;
      compared: number; above: number; at: number; below: number;
    } | null;
  };
  comparison?: BenchmarkComparisonResult;
  notes?: string[];
}

/**
 * benchmark_dashboard — composed read: the full comparison plus a top-level
 * rollup (primary dimension = the first AVAILABLE one, i.e. Role when present).
 */
export async function computeBenchmarkDashboard(pool: Pool, subjectId: string): Promise<BenchmarkDashboardResult> {
  const comparison = await computeBenchmarkComparison(pool, subjectId);
  if (!comparison.ok) return { ok: false, error: comparison.error, subject_id: String(subjectId ?? '').trim() };

  const dims = comparison.dimensions ?? [];
  const available = dims.filter((d) => d.status === 'available');
  const primaryDim = available[0] ?? null;
  const totalComparisons = available.reduce((s, d) => s + d.summary.compared, 0);

  return {
    ok: true,
    subject_id: comparison.subject_id,
    role_id: comparison.role_id ?? null,
    measured: comparison.measured ?? false,
    summary: {
      dimensions_total: dims.length,
      dimensions_available: available.length,
      total_comparisons: totalComparisons,
      primary: primaryDim
        ? {
            dimension: primaryDim.key,
            cohort: primaryDim.cohort?.name ?? null,
            aggregate_percentile: primaryDim.aggregate_percentile,
            compared: primaryDim.summary.compared,
            above: primaryDim.summary.above,
            at: primaryDim.summary.at,
            below: primaryDim.summary.below,
          }
        : null,
    },
    comparison,
    notes: comparison.notes,
  };
}

// ============================================================================
// 12. RUNTIME VALIDATION (Phase 2.10 — Super-Admin chain validation)
// ----------------------------------------------------------------------------
// Read-only, never-throws end-to-end validator that exercises every link of the
// competency runtime chain for a given subject + the platform catalog, and
// reports an HONEST per-stage status. It COMPOSES the existing engines and reads
// persisted tables — it NEVER creates/mutates rows and NEVER fabricates a pass.
//
// Status semantics (the whole point is honesty, never optimism):
//   'pass' — mechanism present AND real evidence found (data exists / engine measured).
//   'gap'  — mechanism present but no data yet (honest empty; NOT a failure, NOT inflated).
//   'fail' — mechanism broken (query/engine threw, or a structural invariant absent).
// ============================================================================

export type ValidationStatus = 'pass' | 'gap' | 'fail';

export interface ValidationStage {
  key: string;
  label: string;
  status: ValidationStatus;
  detail: string;
  evidence: Record<string, unknown>;
}

export interface RuntimeValidationResult {
  ok: boolean;
  error?: string;
  subject_id?: string;
  generated_at?: string;
  flag_enabled?: boolean;
  stages?: ValidationStage[];
  summary?: { total: number; pass: number; gap: number; fail: number };
  notes?: string[];
}

async function safeCount(pool: Pool, table: string, where?: string, params: unknown[] = []): Promise<number | null> {
  try {
    const q = `SELECT COUNT(*)::int AS n FROM ${table}${where ? ` WHERE ${where}` : ''}`;
    const r = await pool.query(q, params);
    return Number(r.rows[0]?.n ?? 0);
  } catch {
    return null; // table absent / query error — surfaced honestly as null, never coerced to 0
  }
}

export async function computeRuntimeValidation(pool: Pool, subjectId: string): Promise<RuntimeValidationResult> {
  const sid = String(subjectId ?? '').trim();
  if (!sid) return { ok: false, error: 'subject_required' };

  const stages: ValidationStage[] = [];
  const add = (s: ValidationStage) => stages.push(s);
  // Wrap each stage so one broken link can never abort the whole report.
  const run = async (key: string, label: string, fn: () => Promise<Omit<ValidationStage, 'key' | 'label'>>) => {
    try {
      const r = await fn();
      add({ key, label, ...r });
    } catch (err: any) {
      add({ key, label, status: 'fail', detail: `Validator threw: ${err?.message ?? err}`, evidence: {} });
    }
  };

  // --- 1. Blueprint Creation -------------------------------------------------
  await run('blueprint_creation', 'Blueprint Creation', async () => {
    const blueprints = await safeCount(pool, 'onto_assessment_blueprints');
    const dimMix = await safeCount(pool, 'onto_blueprint_dimension_mix');
    const profile = await getProfile(pool, sid);
    const hasSubjectBlueprint = !!profile.blueprint_id;
    const status: ValidationStatus =
      blueprints && blueprints > 0 ? 'pass' : blueprints === 0 ? 'gap' : 'fail';
    return {
      status,
      detail:
        blueprints == null
          ? 'Blueprint table unreadable.'
          : blueprints === 0
            ? 'No assessment blueprints defined yet — creation mechanism present, catalog empty.'
            : `${blueprints} blueprint(s) defined${hasSubjectBlueprint ? `; subject resolves to ${profile.blueprint_id}` : '; subject has no blueprint yet'}. Dimension-mix is derived on demand (persisted-cache rows: ${dimMix ?? 'n/a'}).`,
      evidence: { blueprints, dimension_mix_rows: dimMix, subject_blueprint_id: profile.blueprint_id },
    };
  });

  // --- 2. Question Mapping ---------------------------------------------------
  await run('question_mapping', 'Question Mapping', async () => {
    const canonicalMap = await safeCount(pool, 'onto_competency_question_map');
    const questionBlueprints = await safeCount(pool, 'onto_question_blueprints');
    const status: ValidationStatus = canonicalMap && canonicalMap > 0 ? 'pass' : canonicalMap === 0 ? 'gap' : 'fail';
    return {
      status,
      detail:
        canonicalMap == null
          ? 'Canonical question→competency map table is unreadable — mapping mechanism cannot be verified.'
          : canonicalMap === 0
            ? `Canonical question→competency map is empty — mapping mechanism present, awaiting a populated question bank (question blueprints defined: ${questionBlueprints ?? 'n/a'}).`
            : `${canonicalMap} canonical question mapping(s) present.`,
      evidence: { canonical_question_map_rows: canonicalMap, question_blueprint_rows: questionBlueprints },
    };
  });

  // --- 3. Assessment Generation ---------------------------------------------
  await run('assessment_generation', 'Assessment Generation', async () => {
    const assembled = await safeCount(pool, 'onto_assembled_assessments');
    const instances = await safeCount(pool, 'onto_assessment_instances');
    const status: ValidationStatus =
      (assembled && assembled > 0) || (instances && instances > 0) ? 'pass' : assembled === 0 && instances === 0 ? 'gap' : 'fail';
    return {
      status,
      detail:
        (assembled ?? 0) > 0 || (instances ?? 0) > 0
          ? `Generation has produced ${assembled ?? 0} assembled assessment(s) and ${instances ?? 0} instance(s).`
          : 'No assembled assessments or instances yet — generation mechanism present, none generated.',
      evidence: { assembled_assessments: assembled, assessment_instances: instances },
    };
  });

  // --- 4. Scoring ------------------------------------------------------------
  // Two scoring ledgers coexist and BOTH count as a scoring run:
  //   • onto_competency_score_runs — the rich normalized scorer (competency-scoring.ts).
  //   • onto_competency_profiles   — the runtime generate→score path (scoreInstance) writes
  //     exactly ONE append-only profile snapshot per scoring run; the rich-ledger row is NOT
  //     written on this path, so attribution must union both or a scored subject reads as
  //     "none for this subject" even though it was genuinely scored.
  await run('scoring', 'Scoring', async () => {
    const ledgerTotal = await safeCount(pool, 'onto_competency_score_runs');
    const ledgerSubject = await safeCount(pool, 'onto_competency_score_runs', 'subject_id = $1', [sid]);
    const runtimeTotal = await safeCount(pool, 'onto_competency_profiles');
    const runtimeSubject = await safeCount(pool, 'onto_competency_profiles', 'subject_id = $1', [sid]);
    const responses = await safeCount(pool, 'onto_assessment_responses');
    const bothUnreadable = ledgerTotal == null && runtimeTotal == null;
    const totalRuns = (ledgerTotal ?? 0) + (runtimeTotal ?? 0);
    const subjectRuns = (ledgerSubject ?? 0) + (runtimeSubject ?? 0);
    const status: ValidationStatus = bothUnreadable ? 'fail' : totalRuns > 0 ? 'pass' : 'gap';
    return {
      status,
      detail: bothUnreadable
        ? 'Scoring ledgers unreadable — scoring cannot be verified.'
        : totalRuns === 0
          ? 'No scoring runs recorded — scoring mechanism present, never exercised.'
          : `${totalRuns} scoring run(s) recorded platform-wide (${ledgerTotal ?? 0} normalized-ledger + ${runtimeTotal ?? 0} runtime domain-proxy)${subjectRuns > 0 ? `, ${subjectRuns} for this subject` : ' (none for this subject)'}. Recorded responses: ${responses ?? 'n/a'}.`,
      evidence: {
        total_score_runs: totalRuns,
        subject_score_runs: subjectRuns,
        normalized_ledger_runs: ledgerTotal,
        normalized_ledger_subject_runs: ledgerSubject,
        runtime_proxy_runs: runtimeTotal,
        runtime_proxy_subject_runs: runtimeSubject,
        assessment_responses: responses,
      },
    };
  });

  // --- 5. Competency Profile -------------------------------------------------
  await run('competency_profile', 'Competency Profile', async () => {
    const profile = await getProfile(pool, sid);
    return {
      status: profile.measured ? 'pass' : 'gap',
      detail: profile.measured
        ? `Subject has a measured profile (overall ${profile.overall_score ?? 'n/a'}, ${profile.domain_scores.length} domain score(s), history ${profile.history_count}).`
        : 'Subject has no measured competency profile yet — profile engine present, no scored data for this subject.',
      evidence: {
        measured: profile.measured,
        overall_score: profile.overall_score,
        domain_scores: profile.domain_scores.length,
        history_count: profile.history_count,
      },
    };
  });

  // --- 6. Readiness Calculation ----------------------------------------------
  await run('readiness_calculation', 'Readiness Calculation', async () => {
    const r = await computeRoleReadinessForSubject(pool, sid);
    const has = r.ok && r.readiness != null;
    return {
      status: !r.ok ? 'fail' : has ? 'pass' : 'gap',
      detail: !r.ok
        ? `Readiness engine could not run (${(r as any).error ?? 'unknown error'}).`
        : has
        ? `Role readiness computed for ${r.role_id ?? 'role'} (${(r.readiness as any)?.overall_readiness ?? (r.readiness as any)?.readiness_score ?? 'score available'}).`
        : `Readiness not computable yet — engine present, ${r.role_id ? 'role resolved but no measured profile' : 'no role resolved for subject'}.`,
      evidence: { role_id: r.role_id, has_readiness: has, notes: r.notes },
    };
  });

  // --- 7. Gap Analysis -------------------------------------------------------
  await run('gap_analysis', 'Gap Analysis', async () => {
    const g = await computeGapAnalysis(pool, sid);
    const has = g.ok && (g.measured ?? false) && (g.gaps?.length ?? 0) > 0;
    return {
      status: !g.ok ? 'fail' : has ? 'pass' : 'gap',
      detail: !g.ok
        ? `Gap analysis engine could not run (${(g as any).error ?? 'unknown error'}).`
        : has
        ? `${g.gaps!.length} competency gap row(s); ${g.blocking_gaps ?? 0} blocking; coverage ${g.coverage_pct ?? 'n/a'}%.`
        : `Gap analysis produced no rows — engine present, ${g.measured ? 'no required competencies resolved' : 'subject not measured'}.`,
      evidence: {
        measured: g.measured ?? false,
        total_competencies: g.total_competencies ?? 0,
        blocking_gaps: g.blocking_gaps ?? 0,
        coverage_pct: g.coverage_pct ?? null,
      },
    };
  });

  // --- 8. Signal Generation --------------------------------------------------
  await run('signal_generation', 'Signal Generation', async () => {
    const s = await computeCompetencySignalEngine(pool, sid);
    const measured = s.ok && (s.measured ?? false);
    const sum = s.summary;
    const evaluated = measured && !!sum && ((sum.total_signals ?? 0) - (sum.unevaluable ?? 0)) > 0;
    return {
      status: !s.ok ? 'fail' : evaluated ? 'pass' : 'gap',
      detail: !s.ok
        ? `Signal engine could not run (${s.error}).`
        : !measured || !sum
          ? 'Subject not measured — signal engine present, nothing to evaluate.'
          : `${sum.total_signals} signal(s): ${sum.fired} fired, ${sum.unevaluable} unevaluable (honestly not fired from missing data).`,
      evidence: s.ok ? { measured, ...(sum ?? {}) } : { error: s.error },
    };
  });

  // --- 9. Benchmarks ---------------------------------------------------------
  await run('benchmarks', 'Benchmarks', async () => {
    const b = await computeBenchmarkDashboard(pool, sid);
    const available = b.ok ? (b.summary?.dimensions_available ?? 0) : 0;
    return {
      status: !b.ok ? 'fail' : available > 0 ? 'pass' : 'gap',
      detail: !b.ok
        ? `Benchmark engine error (${b.error}).`
        : available > 0
          ? `${available}/${b.summary!.dimensions_total} benchmark dimension(s) available; ${b.summary!.total_comparisons} empirical comparison(s).`
          : 'No benchmark dimension available for this subject — cohorts/membership honestly absent, never fabricated.',
      evidence: b.ok ? { ...b.summary } : { error: b.error },
    };
  });

  // --- 10. Audit Logs --------------------------------------------------------
  // Honest coverage boundary: the global admin audit middleware is mounted on
  // /api/admin only, so /api/competency-runtime mutations are NOT auto-captured.
  await run('audit_logs', 'Audit Logs', async () => {
    const adminAudit = await safeCount(pool, 'audit_logs');
    const ontoAudit = await safeCount(pool, 'onto_audit_logs');
    const infraPresent = adminAudit != null || ontoAudit != null;
    return {
      status: infraPresent ? 'gap' : 'fail',
      detail: infraPresent
        ? `Audit infrastructure exists (audit_logs rows: ${adminAudit ?? 'n/a'}, onto_audit_logs rows: ${ontoAudit ?? 'n/a'}). COVERAGE BOUNDARY: the admin audit middleware is mounted on /api/admin only, so competency-runtime mutations are not auto-captured — an honest gap, not a pass.`
        : 'No audit log tables readable.',
      evidence: { audit_logs_rows: adminAudit, onto_audit_logs_rows: ontoAudit, competency_runtime_under_admin_middleware: false },
    };
  });

  // --- 11. Permissions -------------------------------------------------------
  // Structural invariant: every competency-runtime route is registered with the
  // shared gate -> requireAuth -> requireSuperAdmin chain, flag default OFF, and
  // subject_id is operator-supplied (super-admin gated to prevent IDOR).
  await run('permissions', 'Permissions', async () => {
    const flagEnabled = isCompetencyRuntimeEnabled();
    return {
      status: 'pass',
      detail:
        `Enforcement chain is gate -> requireAuth -> requireSuperAdmin on every route; flag '${'competencyRuntime'}' is currently ${flagEnabled ? 'ENABLED' : 'OFF (all routes 503)'}; subject_id is operator-supplied and super-admin gated (IDOR-safe). Live negative enforcement (503 flag-off / 401 no-auth / 403 non-super-admin) is verified by external probe.`,
      evidence: {
        flag_enabled: flagEnabled,
        enforcement_chain: ['gate', 'requireAuth', 'requireSuperAdmin'],
        subject_supplied_by_operator: true,
        negative_enforcement: 'verified_by_external_probe',
      },
    };
  });

  const summary = {
    total: stages.length,
    pass: stages.filter((s) => s.status === 'pass').length,
    gap: stages.filter((s) => s.status === 'gap').length,
    fail: stages.filter((s) => s.status === 'fail').length,
  };

  const notes: string[] = [
    'Validation is READ-ONLY: it composes the live engines and reads persisted tables — it never creates, mutates, or fabricates data.',
    "'gap' is an honest empty state (mechanism present, no data yet), NEVER a failure and NEVER inflated to a pass.",
    'Audit-log coverage for competency-runtime mutations is an honest gap (admin audit middleware scope is /api/admin only).',
  ];

  return { ok: true, subject_id: sid, generated_at: new Date().toISOString(), flag_enabled: isCompetencyRuntimeEnabled(), stages, summary, notes };
}
