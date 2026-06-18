/**
 * CAPADEX PIL — Phase 5 runner: Intervention Intelligence Layer.
 *
 *   Turns the curated archetypes into ACTION. Per archetype × 5 stakeholders × 6
 *   intervention types = 660 concrete, measurable interventions, each scored on
 *   five 1–5 quality dimensions, carrying an expected outcome / success indicator /
 *   progress indicator + deterministic confidence & risk-reduction PROJECTIONS, and
 *   linked to a real human_problem_library row (problem_id) — NO orphans. It also
 *   rolls the per-archetype × stakeholder developmental arc into growth pathways
 *   and copy-ready action-plan templates.
 *
 *   Prints the required outputs: the FIVE deterministic validators (practicality ·
 *   actionability · alignment · duplicate rate · coverage) against their targets,
 *   SEVEN analytics, a Transformation Readiness Score, and a final recommendation
 *   — then STOPS for human approval.
 *
 * ADDITIVE & SAFE: reads ONLY archetype_library + human_problem_library (read-only);
 * writes ONLY the five Phase-5 `pil_`-prefixed tables. `replace` TRUNCATEs only
 * those five. The validators are recomputed honestly and are ALLOWED to FAIL —
 * never tune to pass.
 *
 *   npx tsx backend/scripts/pil/run-intervention-intelligence.ts [--dry-run]
 */
import { Pool, type PoolClient } from 'pg';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  STAKEHOLDERS, INTERVENTION_TYPES, INTERVENTION_LABELS, HORIZON_DAYS, INTERVENTION_ANCHORS,
  generateInterventions, scoreIntervention, interventionFlags, projectImpacts, auditDuplicates,
  INTERVENTION_VALIDATION_TARGETS,
  type Stakeholder, type InterventionType, type InterventionScores, type DuplicateRow,
} from '../../services/pil/intervention-intelligence-engine.js';

const DRY_RUN = process.argv.includes('--dry-run');
const DUP_THRESHOLD = 0.6;
const OUT_DIR = join(process.cwd(), 'audit', 'pil_phase5');

type Queryable = Pool | PoolClient;
interface ArchetypeRow { archetype_id: number; archetype_key: string; archetype_name: string; }
interface ProblemRow { problem_id: number; archetype_key: string; voice: string; }

// stakeholder → preferred problem voice (falls back to general → any)
const VOICE_PREF: Record<Stakeholder, string> = {
  student: 'student',
  parent: 'general',
  teacher: 'general',
  counselor: 'general',
  professional: 'professional',
};

interface IntRec {
  archetype_id: number;
  archetype_key: string;
  archetype_name: string;
  problem_id: number;
  stakeholder: Stakeholder;
  intervention_type: InterventionType;
  text: string;
  expected_outcome: string;
  success_indicator: string;
  progress_indicator: string;
  confidence_impact: number;
  risk_reduction_impact: number;
  realism_pass: boolean;
  aligned: boolean;
  is_duplicate: boolean;
  q: InterventionScores;
}

function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // formula-injection guard
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function writeCsv(file: string, header: string[], rows: unknown[][]): void {
  const body = [header.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n');
  writeFileSync(join(OUT_DIR, file), body + '\n', 'utf8');
}
function pct(n: number, total: number): string { return total === 0 ? '0.0%' : `${((n / total) * 100).toFixed(1)}%`; }
function avg(ns: number[]): number { return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0; }
function round2(n: number): number { return Math.round(n * 100) / 100; }
function round4(n: number): number { return Math.round(n * 10000) / 10000; }

function placeholders(chunk: unknown[][], cols: number): string {
  return chunk.map((_r, ri) => `(${Array.from({ length: cols }, (_v, ci) => `$${ri * cols + ci + 1}`).join(',')})`).join(',');
}
async function chunkedInsert(db: Queryable, build: (chunk: unknown[][]) => { text: string; values: unknown[] }, rows: unknown[][], size = 400): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { text, values } = build(chunk);
    await db.query(text, values);
  }
}

async function ensureSchema(pool: Pool): Promise<void> {
  // Canonical mirror of migrations/20261123_pil_intervention_intelligence.sql.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pil_intervention_library (
      intervention_id   SERIAL PRIMARY KEY,
      archetype_id      INTEGER NOT NULL,
      archetype_key     TEXT NOT NULL,
      archetype_name    TEXT NOT NULL DEFAULT '',
      problem_id        INTEGER NOT NULL,
      stakeholder_type  TEXT NOT NULL CHECK (stakeholder_type IN ('student','parent','teacher','counselor','professional')),
      intervention_type TEXT NOT NULL CHECK (intervention_type IN ('immediate_actions','seven_day','thirty_day','ninety_day','habit','skill_building')),
      intervention_text TEXT NOT NULL,
      realism_pass      BOOLEAN NOT NULL DEFAULT true,
      aligned           BOOLEAN NOT NULL DEFAULT true,
      is_duplicate      BOOLEAN NOT NULL DEFAULT false,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (archetype_key, stakeholder_type, intervention_type)
    );
    CREATE INDEX IF NOT EXISTS idx_pil_int_archetype   ON pil_intervention_library(archetype_key);
    CREATE INDEX IF NOT EXISTS idx_pil_int_stakeholder ON pil_intervention_library(stakeholder_type);
    CREATE INDEX IF NOT EXISTS idx_pil_int_type        ON pil_intervention_library(intervention_type);
    CREATE INDEX IF NOT EXISTS idx_pil_int_problem     ON pil_intervention_library(problem_id);

    CREATE TABLE IF NOT EXISTS pil_intervention_quality_scores (
      score_id              SERIAL PRIMARY KEY,
      intervention_id       INTEGER NOT NULL REFERENCES pil_intervention_library(intervention_id) ON DELETE CASCADE,
      archetype_key         TEXT NOT NULL,
      stakeholder_type      TEXT NOT NULL,
      intervention_type     TEXT NOT NULL,
      practicality          SMALLINT NOT NULL CHECK (practicality BETWEEN 1 AND 5),
      actionability         SMALLINT NOT NULL CHECK (actionability BETWEEN 1 AND 5),
      outcome_clarity       SMALLINT NOT NULL CHECK (outcome_clarity BETWEEN 1 AND 5),
      stakeholder_relevance SMALLINT NOT NULL CHECK (stakeholder_relevance BETWEEN 1 AND 5),
      archetype_alignment   SMALLINT NOT NULL CHECK (archetype_alignment BETWEEN 1 AND 5),
      composite             NUMERIC(4,2) NOT NULL,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (intervention_id)
    );
    CREATE INDEX IF NOT EXISTS idx_pil_iqs_archetype ON pil_intervention_quality_scores(archetype_key);

    CREATE TABLE IF NOT EXISTS pil_intervention_outcomes (
      outcome_id            SERIAL PRIMARY KEY,
      intervention_id       INTEGER NOT NULL REFERENCES pil_intervention_library(intervention_id) ON DELETE CASCADE,
      archetype_key         TEXT NOT NULL,
      stakeholder_type      TEXT NOT NULL,
      intervention_type     TEXT NOT NULL,
      expected_outcome      TEXT NOT NULL,
      success_indicator     TEXT NOT NULL,
      progress_indicator    TEXT NOT NULL,
      confidence_impact     NUMERIC(5,4) NOT NULL DEFAULT 0,
      risk_reduction_impact NUMERIC(5,4) NOT NULL DEFAULT 0,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (intervention_id)
    );
    CREATE INDEX IF NOT EXISTS idx_pil_iout_archetype ON pil_intervention_outcomes(archetype_key);

    CREATE TABLE IF NOT EXISTS pil_growth_pathways (
      pathway_id            SERIAL PRIMARY KEY,
      pathway_key           TEXT NOT NULL,
      archetype_id          INTEGER NOT NULL,
      archetype_key         TEXT NOT NULL,
      archetype_name        TEXT NOT NULL DEFAULT '',
      stakeholder_type      TEXT NOT NULL,
      problem_id            INTEGER NOT NULL,
      stage_count           SMALLINT NOT NULL DEFAULT 0,
      complete              BOOLEAN NOT NULL DEFAULT false,
      stages                JSONB NOT NULL DEFAULT '[]'::jsonb,
      avg_composite         NUMERIC(4,2) NOT NULL DEFAULT 0,
      avg_confidence_impact NUMERIC(5,4) NOT NULL DEFAULT 0,
      avg_risk_reduction    NUMERIC(5,4) NOT NULL DEFAULT 0,
      summary               TEXT NOT NULL DEFAULT '',
      created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (pathway_key)
    );
    CREATE INDEX IF NOT EXISTS idx_pil_path_archetype ON pil_growth_pathways(archetype_key);

    CREATE TABLE IF NOT EXISTS pil_action_plan_templates (
      template_id      SERIAL PRIMARY KEY,
      template_key     TEXT NOT NULL,
      archetype_id     INTEGER NOT NULL,
      archetype_key    TEXT NOT NULL,
      archetype_name   TEXT NOT NULL DEFAULT '',
      stakeholder_type TEXT NOT NULL,
      problem_id       INTEGER NOT NULL,
      plan_title       TEXT NOT NULL,
      step_immediate   TEXT NOT NULL DEFAULT '',
      step_week        TEXT NOT NULL DEFAULT '',
      step_month       TEXT NOT NULL DEFAULT '',
      step_quarter     TEXT NOT NULL DEFAULT '',
      total_days       SMALLINT NOT NULL DEFAULT 90,
      avg_composite    NUMERIC(4,2) NOT NULL DEFAULT 0,
      is_duplicate     BOOLEAN NOT NULL DEFAULT false,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (template_key)
    );
    CREATE INDEX IF NOT EXISTS idx_pil_plan_archetype ON pil_action_plan_templates(archetype_key);
  `);
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // ── read-only inputs ───────────────────────────────────────────────────────
  const archetypes = (await pool.query<ArchetypeRow>(
    'SELECT archetype_id, archetype_key, archetype_name FROM archetype_library ORDER BY archetype_key',
  )).rows;
  const nameByKey = new Map(archetypes.map((a) => [a.archetype_key, a.archetype_name]));
  const idByKey = new Map(archetypes.map((a) => [a.archetype_key, a.archetype_id]));
  const problems = (await pool.query<ProblemRow>(
    'SELECT problem_id, archetype_key, voice FROM human_problem_library ORDER BY problem_id',
  )).rows;

  // problem_id resolver: voice-pref → general → any (no orphans)
  const byArch = new Map<string, ProblemRow[]>();
  for (const p of problems) { (byArch.get(p.archetype_key) ?? byArch.set(p.archetype_key, []).get(p.archetype_key)!).push(p); }
  function resolveProblemId(archKey: string, stakeholder: Stakeholder): number | null {
    const list = byArch.get(archKey);
    if (!list || !list.length) return null;
    const pref = VOICE_PREF[stakeholder];
    return (list.find((p) => p.voice === pref) ?? list.find((p) => p.voice === 'general') ?? list[0]).problem_id;
  }

  console.log(`\n[PIL 5] read ${archetypes.length} archetypes + ${problems.length} problems (read-only); ${Object.keys(INTERVENTION_ANCHORS).length} intervention anchors authored`);
  const missingAnchor = archetypes.filter((a) => !INTERVENTION_ANCHORS[a.archetype_key]).map((a) => a.archetype_key);
  const noProblems = archetypes.filter((a) => !byArch.get(a.archetype_key)?.length).map((a) => a.archetype_key);
  if (missingAnchor.length) console.log(`  ! archetypes WITHOUT an intervention anchor (no rows authored): ${missingAnchor.join(', ')}`);
  if (noProblems.length) console.log(`  ! archetypes WITHOUT a linkable problem (interventions skipped to avoid orphans): ${noProblems.join(', ')}`);

  // ── generate + score + project + link ──────────────────────────────────────
  const generated = generateInterventions(archetypes.map((a) => a.archetype_key));
  const { rows: dupRows, duplicateMembers } = auditDuplicates(generated, DUP_THRESHOLD);

  const items: IntRec[] = [];
  let skippedOrphan = 0;
  generated.forEach((g, idx) => {
    const pid = resolveProblemId(g.archetype_key, g.stakeholder);
    if (pid == null) { skippedOrphan++; return; } // honest: never persist an orphan
    const outcome = { expected_outcome: g.expected_outcome, success_indicator: g.success_indicator, progress_indicator: g.progress_indicator };
    const q = scoreIntervention(g.text, g.archetype_key, g.stakeholder, outcome);
    const f = interventionFlags(g.text, g.archetype_key, g.stakeholder, outcome);
    const impact = projectImpacts(g.intervention_type, q);
    items.push({
      archetype_id: idByKey.get(g.archetype_key) ?? 0,
      archetype_key: g.archetype_key,
      archetype_name: nameByKey.get(g.archetype_key) ?? '',
      problem_id: pid,
      stakeholder: g.stakeholder,
      intervention_type: g.intervention_type,
      text: g.text,
      expected_outcome: g.expected_outcome,
      success_indicator: g.success_indicator,
      progress_indicator: g.progress_indicator,
      confidence_impact: impact.confidence_impact,
      risk_reduction_impact: impact.risk_reduction_impact,
      realism_pass: f.practical,
      aligned: f.aligned,
      is_duplicate: duplicateMembers.has(idx),
      q,
    });
  });

  const total = items.length;
  const practicalOk = items.filter((i) => i.q.practicality >= 4).length;
  const actionableOk = items.filter((i) => i.q.actionability >= 4).length;
  const alignedOk = items.filter((i) => i.aligned).length;
  const dupCount = items.filter((i) => i.is_duplicate).length;
  const practicalRate = total ? practicalOk / total : 0;
  const actionableRate = total ? actionableOk / total : 0;
  const alignRate = total ? alignedOk / total : 0;
  const dupRate = total ? dupCount / total : 0;
  const orphanCount = skippedOrphan;

  // ── growth pathways (archetype × stakeholder — the full 6-stage arc) ────────
  interface Pathway {
    pathway_key: string; archetype_id: number; archetype_key: string; archetype_name: string;
    stakeholder: Stakeholder; problem_id: number; stage_count: number; complete: boolean;
    stages: { intervention_type: InterventionType; text: string; composite: number; horizon_days: number }[];
    avg_composite: number; avg_confidence_impact: number; avg_risk_reduction: number; summary: string;
  }
  const pathways: Pathway[] = [];
  for (const a of archetypes) {
    for (const s of STAKEHOLDERS) {
      const members = items.filter((i) => i.archetype_key === a.archetype_key && i.stakeholder === s);
      if (!members.length) continue;
      const ordered = INTERVENTION_TYPES
        .map((t) => members.find((m) => m.intervention_type === t))
        .filter((m): m is IntRec => !!m);
      pathways.push({
        pathway_key: `${a.archetype_key}::${s}`,
        archetype_id: a.archetype_id, archetype_key: a.archetype_key, archetype_name: a.archetype_name,
        stakeholder: s, problem_id: ordered[0].problem_id,
        stage_count: ordered.length,
        complete: ordered.length === INTERVENTION_TYPES.length,
        stages: ordered.map((m) => ({ intervention_type: m.intervention_type, text: m.text, composite: m.q.composite, horizon_days: HORIZON_DAYS[m.intervention_type] })),
        avg_composite: round2(avg(ordered.map((m) => m.q.composite))),
        avg_confidence_impact: round4(avg(ordered.map((m) => m.confidence_impact))),
        avg_risk_reduction: round4(avg(ordered.map((m) => m.risk_reduction_impact))),
        summary: `${a.archetype_name} — ${s}: ${ordered.length}-stage growth pathway from immediate action to 90-day development.`,
      });
    }
  }
  const completePathways = pathways.filter((p) => p.complete).length;

  // ── action-plan templates (archetype × stakeholder — copy-ready 4-step plan) ─
  interface PlanTpl {
    template_key: string; archetype_id: number; archetype_key: string; archetype_name: string;
    stakeholder: Stakeholder; problem_id: number; plan_title: string;
    step_immediate: string; step_week: string; step_month: string; step_quarter: string;
    total_days: number; avg_composite: number; is_duplicate: boolean;
  }
  const HORIZON_STEPS: InterventionType[] = ['immediate_actions', 'seven_day', 'thirty_day', 'ninety_day'];
  const plans: PlanTpl[] = [];
  for (const a of archetypes) {
    for (const s of STAKEHOLDERS) {
      const members = items.filter((i) => i.archetype_key === a.archetype_key && i.stakeholder === s);
      if (!members.length) continue;
      const pick = (t: InterventionType) => members.find((m) => m.intervention_type === t);
      const steps = HORIZON_STEPS.map(pick);
      if (steps.some((m) => !m)) continue; // need all four time horizons for a plan
      const [imm, wk, mo, qt] = steps as IntRec[];
      plans.push({
        template_key: `${a.archetype_key}::${s}`,
        archetype_id: a.archetype_id, archetype_key: a.archetype_key, archetype_name: a.archetype_name,
        stakeholder: s, problem_id: imm.problem_id,
        plan_title: `${a.archetype_name} — ${s} action plan`,
        step_immediate: imm.text, step_week: wk.text, step_month: mo.text, step_quarter: qt.text,
        total_days: 90,
        avg_composite: round2(avg([imm, wk, mo, qt].map((m) => m.q.composite))),
        is_duplicate: false,
      });
    }
  }
  // duplicate action plans: identical concatenated step text (honest, same model)
  const planSeen = new Map<string, number>();
  plans.forEach((p, idx) => {
    const key = [p.step_immediate, p.step_week, p.step_month, p.step_quarter].join(' | ');
    if (planSeen.has(key)) p.is_duplicate = true; else planSeen.set(key, idx);
  });
  const dupPlans = plans.filter((p) => p.is_duplicate).length;

  // ── CSV artifacts ──────────────────────────────────────────────────────────
  writeCsv('pil_interventions.csv',
    ['archetype_id', 'archetype_key', 'archetype_name', 'problem_id', 'stakeholder_type', 'intervention_type', 'intervention_text', 'expected_outcome', 'success_indicator', 'progress_indicator', 'confidence_impact', 'risk_reduction_impact', 'realism_pass', 'aligned', 'is_duplicate', 'practicality', 'actionability', 'outcome_clarity', 'stakeholder_relevance', 'archetype_alignment', 'composite'],
    items.map((i) => [i.archetype_id, i.archetype_key, i.archetype_name, i.problem_id, i.stakeholder, i.intervention_type, i.text, i.expected_outcome, i.success_indicator, i.progress_indicator, i.confidence_impact, i.risk_reduction_impact, i.realism_pass, i.aligned, i.is_duplicate, i.q.practicality, i.q.actionability, i.q.outcome_clarity, i.q.stakeholder_relevance, i.q.archetype_alignment, i.q.composite]));
  writeCsv('pil_growth_pathways.csv',
    ['pathway_key', 'archetype_key', 'archetype_name', 'stakeholder_type', 'problem_id', 'stage_count', 'complete', 'avg_composite', 'avg_confidence_impact', 'avg_risk_reduction', 'summary'],
    pathways.map((p) => [p.pathway_key, p.archetype_key, p.archetype_name, p.stakeholder, p.problem_id, p.stage_count, p.complete, p.avg_composite, p.avg_confidence_impact, p.avg_risk_reduction, p.summary]));
  writeCsv('pil_action_plan_templates.csv',
    ['template_key', 'archetype_key', 'archetype_name', 'stakeholder_type', 'problem_id', 'plan_title', 'step_immediate', 'step_week', 'step_month', 'step_quarter', 'total_days', 'avg_composite', 'is_duplicate'],
    plans.map((p) => [p.template_key, p.archetype_key, p.archetype_name, p.stakeholder, p.problem_id, p.plan_title, p.step_immediate, p.step_week, p.step_month, p.step_quarter, p.total_days, p.avg_composite, p.is_duplicate]));
  writeCsv('pil_intervention_duplicate_review.csv',
    ['kind', 'redundant', 'text_a', 'text_b', 'overlap', 'archetype_a', 'archetype_b', 'stakeholder_a', 'stakeholder_b'],
    dupRows.map((d) => [d.kind, d.redundant, d.text_a, d.text_b, d.overlap, d.archetype_a, d.archetype_b, d.stakeholder_a, d.stakeholder_b]));

  // ── persist (single transaction) ───────────────────────────────────────────
  if (!DRY_RUN) {
    await ensureSchema(pool);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE pil_intervention_library, pil_intervention_quality_scores, pil_intervention_outcomes, pil_growth_pathways, pil_action_plan_templates RESTART IDENTITY CASCADE');

      // interventions → capture generated ids in order to link scores + outcomes
      const intIds: number[] = [];
      for (let i = 0; i < items.length; i += 400) {
        const chunk = items.slice(i, i + 400);
        const vals = chunk.flatMap((r) => [r.archetype_id, r.archetype_key, r.archetype_name, r.problem_id, r.stakeholder, r.intervention_type, r.text, r.realism_pass, r.aligned, r.is_duplicate]);
        const res = await client.query<{ intervention_id: number }>(
          `INSERT INTO pil_intervention_library (archetype_id, archetype_key, archetype_name, problem_id, stakeholder_type, intervention_type, intervention_text, realism_pass, aligned, is_duplicate) VALUES ${placeholders(chunk, 10)} RETURNING intervention_id`,
          vals,
        );
        for (const row of res.rows) intIds.push(row.intervention_id);
      }

      const scoreRows = items.map((r, idx) => [intIds[idx], r.archetype_key, r.stakeholder, r.intervention_type, r.q.practicality, r.q.actionability, r.q.outcome_clarity, r.q.stakeholder_relevance, r.q.archetype_alignment, r.q.composite]);
      if (scoreRows.length) await chunkedInsert(client, (chunk) => ({
        text: `INSERT INTO pil_intervention_quality_scores (intervention_id, archetype_key, stakeholder_type, intervention_type, practicality, actionability, outcome_clarity, stakeholder_relevance, archetype_alignment, composite) VALUES ${placeholders(chunk, 10)}`,
        values: chunk.flat(),
      }), scoreRows);

      const outcomeRows = items.map((r, idx) => [intIds[idx], r.archetype_key, r.stakeholder, r.intervention_type, r.expected_outcome, r.success_indicator, r.progress_indicator, r.confidence_impact, r.risk_reduction_impact]);
      if (outcomeRows.length) await chunkedInsert(client, (chunk) => ({
        text: `INSERT INTO pil_intervention_outcomes (intervention_id, archetype_key, stakeholder_type, intervention_type, expected_outcome, success_indicator, progress_indicator, confidence_impact, risk_reduction_impact) VALUES ${placeholders(chunk, 9)}`,
        values: chunk.flat(),
      }), outcomeRows);

      if (pathways.length) await chunkedInsert(client, (chunk) => ({
        text: `INSERT INTO pil_growth_pathways (pathway_key, archetype_id, archetype_key, archetype_name, stakeholder_type, problem_id, stage_count, complete, stages, avg_composite, avg_confidence_impact, avg_risk_reduction, summary) VALUES ${placeholders(chunk, 13)}`,
        values: chunk.flat(),
      }), pathways.map((p) => [p.pathway_key, p.archetype_id, p.archetype_key, p.archetype_name, p.stakeholder, p.problem_id, p.stage_count, p.complete, JSON.stringify(p.stages), p.avg_composite, p.avg_confidence_impact, p.avg_risk_reduction, p.summary]));

      if (plans.length) await chunkedInsert(client, (chunk) => ({
        text: `INSERT INTO pil_action_plan_templates (template_key, archetype_id, archetype_key, archetype_name, stakeholder_type, problem_id, plan_title, step_immediate, step_week, step_month, step_quarter, total_days, avg_composite, is_duplicate) VALUES ${placeholders(chunk, 14)}`,
        values: chunk.flat(),
      }), plans.map((p) => [p.template_key, p.archetype_id, p.archetype_key, p.archetype_name, p.stakeholder, p.problem_id, p.plan_title, p.step_immediate, p.step_week, p.step_month, p.step_quarter, p.total_days, p.avg_composite, p.is_duplicate]));

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // ── required audit outputs ─────────────────────────────────────────────────
  const tag = DRY_RUN ? '[DRY-RUN] ' : '';
  console.log(`\n${tag}=== PHASE 5 — INTERVENTION INTELLIGENCE LAYER ===`);
  console.log(`\nGenerated ${total} interventions across ${archetypes.length} archetypes (× ${STAKEHOLDERS.length} stakeholders × ${INTERVENTION_TYPES.length} intervention types).`);

  // (1) Intervention-type distribution
  console.log('\n## [1] Intervention-type distribution');
  for (const t of INTERVENTION_TYPES) {
    const n = items.filter((i) => i.intervention_type === t).length;
    console.log(`  ${INTERVENTION_LABELS[t].padEnd(18)} ${String(n).padStart(4)}  ${pct(n, total)}`);
  }

  // (2) Stakeholder coverage
  console.log('\n## [2] Stakeholder coverage');
  for (const s of STAKEHOLDERS) {
    const n = items.filter((i) => i.stakeholder === s).length;
    console.log(`  ${s.padEnd(18)} ${String(n).padStart(4)}  ${pct(n, total)}`);
  }

  // (3) Growth-pathway coverage
  console.log('\n## [3] Growth-pathway coverage (target 6 stages each)');
  console.log(`  Complete pathways (all 6 stages): ${completePathways}/${pathways.length}  ${pct(completePathways, pathways.length)}`);
  console.log(`  Action-plan templates (4-horizon): ${plans.length}  · duplicate plans: ${dupPlans}`);

  // (4) Outcome coverage
  console.log('\n## [4] Outcome coverage');
  const withOutcome = items.filter((i) => i.expected_outcome && i.success_indicator && i.progress_indicator).length;
  console.log(`  Interventions with full outcome set: ${withOutcome}/${total}  ${pct(withOutcome, total)}`);
  console.log(`  Avg projected confidence_impact:     ${avg(items.map((i) => i.confidence_impact)).toFixed(4)}`);
  console.log(`  Avg projected risk_reduction_impact: ${avg(items.map((i) => i.risk_reduction_impact)).toFixed(4)}`);

  // (5) Quality-score averages (per dimension)
  console.log('\n## [5] Quality-score averages (1–5)');
  console.log(`  practicality          ${avg(items.map((i) => i.q.practicality)).toFixed(2)}`);
  console.log(`  actionability         ${avg(items.map((i) => i.q.actionability)).toFixed(2)}`);
  console.log(`  outcome_clarity       ${avg(items.map((i) => i.q.outcome_clarity)).toFixed(2)}`);
  console.log(`  stakeholder_relevance ${avg(items.map((i) => i.q.stakeholder_relevance)).toFixed(2)}`);
  console.log(`  archetype_alignment   ${avg(items.map((i) => i.q.archetype_alignment)).toFixed(2)}`);
  console.log(`  composite             ${avg(items.map((i) => i.q.composite)).toFixed(2)}`);

  // (6) Duplicate breakdown
  console.log('\n## [6] Duplicate review breakdown');
  const redund = dupRows.filter((d) => d.redundant).length;
  const variants = dupRows.filter((d) => !d.redundant).length;
  for (const k of ['identical', 'semantic', 'stakeholder'] as DuplicateRow['kind'][]) {
    const n = dupRows.filter((d) => d.kind === k).length;
    console.log(`  ${k.padEnd(12)} ${String(n).padStart(4)}`);
  }
  console.log(`  → redundant (counted): ${redund} · cross-audience variants (not counted): ${variants}`);

  // (7) Problem-link integrity
  console.log('\n## [7] Problem-link integrity');
  console.log(`  interventions linked to a real problem_id: ${total}/${total + orphanCount}  ${pct(total, total + orphanCount)}`);
  console.log(`  ORPHANS (unlinked, not persisted):         ${orphanCount}`);

  // ── validators (REAL — may FAIL) ───────────────────────────────────────────
  const expectedTotal = Object.keys(INTERVENTION_ANCHORS).length * STAKEHOLDERS.length * INTERVENTION_TYPES.length;
  const coverageRate = expectedTotal ? total / expectedTotal : 0;
  console.log('\n## Validation (REAL — allowed to fail)');
  const verdict = (rate: number, target: number, lessIsBetter = false) => (lessIsBetter ? rate <= target : rate >= target) ? 'PASS' : 'FAIL';
  const vPractical = verdict(practicalRate, INTERVENTION_VALIDATION_TARGETS.practicality);
  const vActionable = verdict(actionableRate, INTERVENTION_VALIDATION_TARGETS.actionability);
  const vAlign = verdict(alignRate, INTERVENTION_VALIDATION_TARGETS.archetype_alignment);
  const vDup = verdict(dupRate, INTERVENTION_VALIDATION_TARGETS.duplicate_rate_max, true);
  const vCoverage = verdict(coverageRate, INTERVENTION_VALIDATION_TARGETS.coverage);
  console.log(`  Practicality (≥4/5):  ${(practicalRate * 100).toFixed(1)}%  target >${(INTERVENTION_VALIDATION_TARGETS.practicality * 100).toFixed(0)}%  → ${vPractical}`);
  console.log(`  Actionability (≥4/5): ${(actionableRate * 100).toFixed(1)}%  target >${(INTERVENTION_VALIDATION_TARGETS.actionability * 100).toFixed(0)}%  → ${vActionable}`);
  console.log(`  Archetype alignment:  ${(alignRate * 100).toFixed(1)}%  target >${(INTERVENTION_VALIDATION_TARGETS.archetype_alignment * 100).toFixed(0)}%  → ${vAlign}`);
  console.log(`  Duplicate rate:       ${(dupRate * 100).toFixed(1)}%  target <${(INTERVENTION_VALIDATION_TARGETS.duplicate_rate_max * 100).toFixed(0)}%  → ${vDup}`);
  console.log(`  Coverage:             ${(coverageRate * 100).toFixed(1)}%  target >${(INTERVENTION_VALIDATION_TARGETS.coverage * 100).toFixed(0)}%  → ${vCoverage}`);

  // ── Transformation Readiness Score ─────────────────────────────────────────
  // Weighted blend of the things that decide whether this intervention corpus is
  // ready to drive transformation: practicality, actionability, alignment, low
  // redundancy, full coverage, and zero orphan links. Honest function of metrics.
  const linkRate = (total + orphanCount) ? total / (total + orphanCount) : 0;
  const trs = Math.round(
    (practicalRate * 0.25 + actionableRate * 0.20 + alignRate * 0.15 + (1 - dupRate) * 0.15 + coverageRate * 0.15 + linkRate * 0.10) * 1000,
  ) / 10;
  console.log('\n## Transformation Readiness Score');
  console.log(`  TRS = ${trs.toFixed(1)} / 100`);
  console.log(`     practicality 25% (${(practicalRate * 100).toFixed(0)}%) · actionability 20% (${(actionableRate * 100).toFixed(0)}%) · alignment 15% (${(alignRate * 100).toFixed(0)}%) · non-dup 15% (${((1 - dupRate) * 100).toFixed(0)}%) · coverage 15% (${(coverageRate * 100).toFixed(0)}%) · link 10% (${(linkRate * 100).toFixed(0)}%)`);

  // ── final recommendation ───────────────────────────────────────────────────
  const allPass = vPractical === 'PASS' && vActionable === 'PASS' && vAlign === 'PASS' && vDup === 'PASS' && vCoverage === 'PASS' && orphanCount === 0;
  console.log('\n## Recommendation');
  if (allPass && trs >= 85) {
    console.log('  ✅ READY — all validators pass, no orphan links, TRS ≥ 85. Recommend approval to proceed to Phase 6 (AI Guidance Engine).');
  } else if (allPass) {
    console.log(`  ⚠️  CONDITIONAL — validators pass but TRS ${trs.toFixed(1)} < 85; refine low-scoring interventions before proceeding.`);
  } else {
    console.log('  ❌ REFINE — one or more validators FAILED (see above). This is a real finding; fix the underlying intervention copy, do NOT tune metrics.');
  }

  console.log(`\nCSV artifacts → ${OUT_DIR}`);
  console.log(DRY_RUN ? '\n[DRY-RUN] no DB writes performed.' : '\n[WRITE] persisted to 5 Phase-5 tables.');
  console.log('\n=== STOP — awaiting human approval before any downstream use. ===\n');
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
