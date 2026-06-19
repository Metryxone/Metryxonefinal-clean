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
import { getBlueprint } from './assessment-foundation-mapping.js';
import { getRoleReadiness, type ReadinessResult } from './role-competency-profile.js';

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
function deriveOptions(questionType: string, body: any): { label: string; score: number }[] {
  const isLikert = !(questionType === 'mcq' || questionType === 'sjt' || questionType === 'scenario' ||
    questionType === 'case' || questionType === 'simulation' || questionType === 'behavioral' ||
    questionType === 'communication');
  const hasAuthored = Array.isArray(body?.options) && body.options.length > 0;
  if (isLikert || !hasAuthored) return LIKERT_OPTIONS.map((o) => ({ ...o }));
  const best = Number.isFinite(body.best_option) ? Number(body.best_option) : -1;
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

  // Pull approved templates for the needed codes.
  let templates: any[] = [];
  if (codes.length > 0) {
    const res = await pool.query(
      `SELECT id, template_key, competency_code, question_type, template_body
         FROM competency_question_templates
        WHERE status = 'approved' AND competency_code = ANY($1::text[])`,
      [codes],
    );
    templates = res.rows;
  }
  const bankEmpty = templates.length === 0;

  // Round-robin select across codes (deterministic order) up to `total`.
  const byCode = new Map<string, any[]>();
  for (const t of templates) (byCode.get(t.competency_code) ?? byCode.set(t.competency_code, []).get(t.competency_code)!).push(t);
  const orderedCodes = codes.filter((c) => (byCode.get(c)?.length ?? 0) > 0);
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
      const t = pool2[cur];
      const body = t.template_body || {};
      picked.push({
        index: idx++,
        template_id: t.id,
        code,
        onto_domain: DOMAIN_CODE_TO_ONTO[code],
        type: t.question_type,
        text: body.prompt || '',
        options: deriveOptions(t.question_type, body),
      });
      advanced = true;
    }
    if (!advanced) break;
  }

  const domainsWithQuestions = [...new Set(picked.map((q) => q.onto_domain))];
  const notes: string[] = [];
  if (bankEmpty) notes.push('Question bank has no approved items for the required domains — the generated assessment is empty; scoring will be honestly unmeasured.');
  if (unmeasurable.length > 0) notes.push(`${unmeasurable.length} of ${comps.length} blueprint competencies are UNMEASURABLE (no question-bank coverage for their onto-domain).`);
  notes.push('Per-competency scores are a domain-PROXY (the 7-code bank crosswalks to 5 onto-domains) until onto_competency_question_map is populated.');

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
export interface ScoreResult {
  ok: boolean;
  error?: string;
  instance_id?: string;
  subject_id?: string;
  answered?: number;
  overall_score?: number | null;
  overall_level?: number | null;
  domain_scores?: DomainScore[];
  coverage?: any;
  measurement?: 'domain_proxy';
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

  // Resolve each response to its authored option score. Unknown index/option => skip (never fabricate).
  const accepted: { q: RuntimeQuestion; selected: number; score: number }[] = [];
  for (const r of input.responses ?? []) {
    const q = byIndex.get(Number(r.index));
    if (!q) continue;
    const sel = Number(r.selected_index);
    if (!Number.isInteger(sel) || sel < 0 || sel >= q.options.length) continue;
    accepted.push({ q, selected: sel, score: Number(q.options[sel].score) });
  }

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

    const measured = domainScores.length > 0;
    const overall = measured
      ? Math.round((domainScores.reduce((s, d) => s + d.scaled_score, 0) / domainScores.length) * 10) / 10
      : null;
    const overallLevel = overall != null ? scoreToLevel(overall) : null;

    await client.query(
      `UPDATE onto_assessment_instances SET status='scored', updated_at=now() WHERE id=$1`,
      [instanceId],
    );
    // Append-only profile snapshot.
    await client.query(
      `INSERT INTO onto_competency_profiles (subject_id, instance_id, blueprint_id, role_id, overall_score, overall_level, profile, coverage)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)`,
      [inst.subject_id, instanceId, inst.blueprint_id, inst.role_id, overall, overallLevel,
       JSON.stringify(domainScores), JSON.stringify(inst.coverage ?? {})],
    );
    await client.query('COMMIT');

    return {
      ok: true,
      instance_id: instanceId,
      subject_id: inst.subject_id,
      answered: accepted.length,
      overall_score: overall,
      overall_level: overallLevel,
      domain_scores: domainScores,
      coverage: inst.coverage ?? {},
      measurement: 'domain_proxy',
    };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
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
