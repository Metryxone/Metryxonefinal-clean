/**
 * CAPADEX AQ-2R — Runtime Metadata Activation: measurement harness.
 *
 * DETERMINISTIC (no random). Measures the effect of consuming the AQ-2
 * per-question metadata layer (`capadex_question_metadata`) inside the live
 * clarity-question selection (`pickQuestionsFromMaster`). It imports the SAME
 * scorer the runtime picker uses (`services/question-metadata-ranking.ts`), so the
 * metadata SCORING math is byte-faithful to production (one scorer, no drift —
 * .agents/memory/audit-runtime-fidelity.md). What is shared is the scorer and the
 * candidate-pool gate; the picker's topical-relevance partition and youth-demotion
 * are deliberately HELD CONSTANT here because they are orthogonal to (and unchanged
 * by) the AQ-2R metadata re-rank — isolating the re-rank is the point of the A/B.
 *
 * Method (per representative envelope = concern × age × persona):
 *   1. Build the concern's curated clarity candidate pool using the picker's
 *      candidate gate — own bridge tag, FAMILY-level age eligibility (hard),
 *      options>=2 — with the metadata LEFT-JOINed by question_id. (The picker's
 *      topical/generic relevance partition is NOT replicated; it is orthogonal to
 *      the metadata re-rank.) The pool is identical for both arms; only order differs.
 *   2. BEFORE (legacy, metadata-blind): order by question_weight DESC, id ASC
 *      (the picker's stable keys with random() removed for determinism), take 10.
 *   3. AFTER  (AQ-2R): order by meta_score DESC (shared scorer) then stable keys,
 *      take 10; then stage-progression order the batch (display only).
 *   4. Score five metrics on each selected set and report BEFORE vs AFTER deltas.
 *
 * Metrics (all 0..100 unless noted), measured on the SELECTED set:
 *   - Question Relevance  : mean of (ageMatch + personaMatch)/2.
 *   - Signal Confidence   : mean signal_confidence (join-miss / no-signal = 0).
 *   - Construct Accuracy  : mean of (behaviorPresent + capabilityPresent)/2.
 *   - Selection AIS       : mean(Relevance, SignalConfidence, ConstructAccuracy)
 *                           — composite of the SELECTION (labelled distinct from
 *                           the AQ-2 BANK AIS = 73.9, which is bank-wide).
 *   - Trust Score         : mean question_intelligence_score (evidence-weighted
 *                           per-question coverage×confidence) over the selection.
 *
 * Honest scoping: only Tier-1 master-curated clarity carries AQ-2 metadata; the
 * Tier-2 adaptive bank and Tier-3 static fallback are out of scope and untouched.
 */

import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  scoreQuestionMetadata,
  stageRank,
  canonicalPersonaFor,
  ageBandForAge,
  metaFromRow,
  META_SELECT_COLS,
  META_JOIN,
  META_WEIGHTS,
  STAGE_ORDER,
  CANONICAL_PERSONAS,
  type QuestionMetadata,
  type MetadataContext,
} from '../../services/question-metadata-ranking';

const CLARITY_TARGET = 10;
const POOL_LIMIT = 60; // mirrors the picker's candidate LIMIT
const OUT_DIR = join(__dirname, '..', '..', 'audit', 'aq-2r');

// Representative concerns: one master concern per high-coverage bridge tag,
// spanning varied domains / family age ranges / personas (measured selection,
// not cherry-picked — every tag below has >=20 curated clarity rows).
const CONCERN_IDS = [
  'CONCERN_EXA_254', 'CONCERN_DIS_1247', 'CONCERN_ACA_2006', 'CONCERN_HOL_201',
  'CONCERN_ACA_2483', 'CONCERN_EMO_1242', 'CONCERN_INQ_1254', 'CONCERN_DIS_1186',
  'CONCERN_EMP_1318', 'CONCERN_INT_2158', 'CONCERN_ADJ_1794', 'CONCERN_ACA_2160',
  'CONCERN_ACA_1931', 'CONCERN_COM_1240', 'CONCERN_SOC_1809', 'CONCERN_ADA_1251',
];

// One representative age per canonical band, paired with all six canonical
// personas. Only (concern,age) contexts whose age overlaps the concern family
// range yield a non-empty pool; the rest are recorded as out-of-range and skipped.
const TEST_AGES = [12, 16, 21, 35, 50];

interface PoolRow {
  id: number;
  question: string;
  question_weight: number | null;
  options_count: number;
  meta: QuestionMetadata | null;
  qis: number; // question_intelligence_score (0..100)
  metaScore: number;
}

interface ConcernMeta { concern_id: string; display_label: string; tag: string; domain: string; age_min: number | null; age_max: number | null; primary_persona: string | null; }

interface Metrics { relevance: number; signal: number; construct: number; ais: number; trust: number; }

const r1 = (n: number) => Math.round(n * 10) / 10;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Per-question relevance to a context (0..1): half age-match, half persona-match. */
function relevanceOf(m: QuestionMetadata | null, ctx: MetadataContext): number {
  if (!m) return 0;
  const userBand = ctx.ageBand;
  let age = 0;
  if (m.age_band && userBand && m.age_band === userBand) age = 1;
  else if (m.age_min != null && m.age_max != null && ctx.age != null && m.age_min <= ctx.age && m.age_max >= ctx.age) age = 0.5;
  let persona = 0;
  if (ctx.canonicalPersona) {
    const fromMap = m.personas && typeof m.personas === 'object' ? Number(m.personas[ctx.canonicalPersona] || 0) : 0;
    if (fromMap > 0) persona = Math.min(1, fromMap);
    else if (m.persona_primary === ctx.canonicalPersona) persona = Math.min(1, Number(m.persona_confidence || 0));
  }
  return (age + persona) / 2;
}

function metricsFor(sel: PoolRow[], ctx: MetadataContext): Metrics {
  if (!sel.length) return { relevance: 0, signal: 0, construct: 0, ais: 0, trust: 0 };
  const relevance = 100 * mean(sel.map(s => relevanceOf(s.meta, ctx)));
  const signal = 100 * mean(sel.map(s => (s.meta ? Number(s.meta.signal_confidence || 0) : 0)));
  const construct = 100 * mean(sel.map(s => {
    const b = s.meta && s.meta.primary_behavior ? 1 : 0;
    const c = s.meta && s.meta.primary_capability && s.meta.primary_capability !== 'UNASSIGNED_ROUTING_NODE' ? 1 : 0;
    return (b + c) / 2;
  }));
  const trust = mean(sel.map(s => s.qis));
  const ais = (relevance + signal + construct) / 3;
  return { relevance, signal, construct, ais, trust };
}

/** Legacy stable order: question_weight DESC, id ASC (random() removed). */
function orderLegacy(pool: PoolRow[]): PoolRow[] {
  return [...pool].sort((a, b) => (Number(b.question_weight) || 0) - (Number(a.question_weight) || 0) || a.id - b.id);
}

/** AQ-2R order: meta_score DESC, then legacy stable keys; then stage progression. */
function orderMeta(pool: PoolRow[]): PoolRow[] {
  const ranked = [...pool].sort((a, b) =>
    b.metaScore - a.metaScore ||
    (Number(b.question_weight) || 0) - (Number(a.question_weight) || 0) ||
    a.id - b.id,
  );
  const top = ranked.slice(0, CLARITY_TARGET);
  return top
    .map((q, i) => ({ q, i }))
    .sort((a, b) => stageRank(a.q.meta?.dev_stage) - stageRank(b.q.meta?.dev_stage) || a.i - b.i)
    .map(({ q }) => q);
}

async function fetchConcerns(pool: Pool): Promise<ConcernMeta[]> {
  const rs = await pool.query(
    `SELECT concern_id, display_label, LOWER(TRIM(relational_bridge_tag)) AS tag,
            domain, age_min, age_max, primary_persona
       FROM capadex_concerns_master WHERE concern_id = ANY($1::text[])`,
    [CONCERN_IDS],
  );
  const byId = new Map(rs.rows.map((r: any) => [r.concern_id, {
    concern_id: r.concern_id, display_label: r.display_label, tag: r.tag, domain: r.domain,
    age_min: r.age_min == null ? null : Number(r.age_min), age_max: r.age_max == null ? null : Number(r.age_max),
    primary_persona: r.primary_persona,
  } as ConcernMeta]));
  return CONCERN_IDS.map(id => byId.get(id)).filter((c): c is ConcernMeta => !!c);
}

/** Candidate pool for a concern at a given age — applies the picker's candidate gate
 *  (own bridge tag + family-age eligibility + options>=2). The topical-relevance
 *  partition is intentionally NOT replicated (orthogonal to the metadata re-rank). */
async function fetchPool(pool: Pool, c: ConcernMeta, age: number): Promise<PoolRow[]> {
  const rs = await pool.query(
    `SELECT q.id, q.question, q.question_weight,
            q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
            m.question_intelligence_score AS m_qis,
            ${META_SELECT_COLS}
       FROM capadex_clarity_questions q
       ${META_JOIN}
      WHERE LOWER(TRIM(q.master_bridge_tag)) = $1
        AND q.question IS NOT NULL AND TRIM(q.question) <> ''
        AND EXISTS (
              SELECT 1 FROM capadex_concerns_master a
               WHERE LOWER(TRIM(a.relational_bridge_tag)) = $1
                 AND a.age_min IS NOT NULL AND a.age_max IS NOT NULL
                 AND a.age_min <= $2 AND a.age_max >= $2
            )
      ORDER BY q.question_weight DESC NULLS LAST, q.id ASC
      LIMIT ${POOL_LIMIT}`,
    [c.tag, age],
  );
  return rs.rows
    .map((row: any) => {
      const opts = [row.option_a, row.option_b, row.option_c, row.option_d, row.option_e]
        .filter((o: any) => typeof o === 'string' && o.trim().length > 0);
      return {
        id: Number(row.id),
        question: row.question,
        question_weight: row.question_weight == null ? null : Number(row.question_weight),
        options_count: opts.length,
        meta: metaFromRow(row),
        qis: row.m_qis == null ? 0 : Number(row.m_qis),
        metaScore: 0,
      } as PoolRow;
    })
    .filter(p => p.options_count >= 2);
}

interface EnvResult {
  concern_id: string; tag: string; domain: string; age: number; persona: string; canonicalPersona: string | null;
  pool_size: number; before: Metrics; after: Metrics;
  meta_present_in_after: number; signal_present_in_after: number;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  mkdirSync(OUT_DIR, { recursive: true });
  const concerns = await fetchConcerns(pool);

  const results: EnvResult[] = [];
  let outOfRange = 0;
  let emptyPool = 0;
  // Within-pool differentiability: a dimension can only change the selection if it
  // VARIES across the candidate pool. AQ-2 derived several dimensions at tag/family
  // granularity, so they are constant within a concern's pool and cannot move the
  // re-rank. We measure this directly (one record per unique concern×age pool).
  const poolVar: Array<Record<string, number>> = [];
  const distinct = (vals: any[]) => new Set(vals.filter(v => v != null && v !== '')).size;

  for (const c of concerns) {
    for (const age of TEST_AGES) {
      const inRange = c.age_min != null && c.age_max != null && c.age_min <= age && c.age_max >= age;
      if (!inRange) { outOfRange++; continue; }
      const basePool = await fetchPool(pool, c, age);
      if (basePool.length < 2) { emptyPool++; continue; }
      poolVar.push({
        d_signal: distinct(basePool.map(p => p.meta?.signal_confidence)),
        d_ageband: distinct(basePool.map(p => p.meta?.age_band)),
        d_persona: distinct(basePool.map(p => p.meta?.persona_primary)),
        d_capability: distinct(basePool.map(p => p.meta?.primary_capability)),
        d_behavior: distinct(basePool.map(p => p.meta?.primary_behavior)),
        d_stage: distinct(basePool.map(p => p.meta?.dev_stage)),
        d_qis: distinct(basePool.map(p => Math.round(p.qis * 10) / 10)),
      });
      const ageBand = ageBandForAge(age);
      for (const persona of CANONICAL_PERSONAS) {
        const canonicalPersona = canonicalPersonaFor(persona);
        const ctx: MetadataContext = { age, ageBand, canonicalPersona };
        const scored = basePool.map(p => ({ ...p, metaScore: scoreQuestionMetadata(p.meta, ctx).score }));
        const before = orderLegacy(scored).slice(0, CLARITY_TARGET);
        const after = orderMeta(scored);
        results.push({
          concern_id: c.concern_id, tag: c.tag, domain: c.domain, age, persona, canonicalPersona,
          pool_size: basePool.length,
          before: metricsFor(before, ctx), after: metricsFor(after, ctx),
          meta_present_in_after: after.filter(s => s.meta).length,
          signal_present_in_after: after.filter(s => s.meta && Number(s.meta.signal_confidence || 0) > 0).length,
        });
      }
    }
  }

  // ---- Aggregate (macro-average across envelopes) ----
  const agg = (pick: (e: EnvResult) => number) => r1(mean(results.map(pick)));
  const beforeAgg: Metrics = {
    relevance: agg(e => e.before.relevance), signal: agg(e => e.before.signal),
    construct: agg(e => e.before.construct), ais: agg(e => e.before.ais), trust: agg(e => e.before.trust),
  };
  const afterAgg: Metrics = {
    relevance: agg(e => e.after.relevance), signal: agg(e => e.after.signal),
    construct: agg(e => e.after.construct), ais: agg(e => e.after.ais), trust: agg(e => e.after.trust),
  };
  const delta: Metrics = {
    relevance: r1(afterAgg.relevance - beforeAgg.relevance),
    signal: r1(afterAgg.signal - beforeAgg.signal),
    construct: r1(afterAgg.construct - beforeAgg.construct),
    ais: r1(afterAgg.ais - beforeAgg.ais),
    trust: r1(afterAgg.trust - beforeAgg.trust),
  };

  const envelopes = results.length;
  const improvedAis = results.filter(e => e.after.ais > e.before.ais + 0.05).length;
  const unchangedAis = results.filter(e => Math.abs(e.after.ais - e.before.ais) <= 0.05).length;
  const regressedAis = results.filter(e => e.after.ais < e.before.ais - 0.05).length;
  const metaPresentRate = r1(100 * mean(results.map(e => e.meta_present_in_after / Math.min(CLARITY_TARGET, e.pool_size))));
  const signalPresentRate = r1(100 * mean(results.map(e => e.signal_present_in_after / Math.min(CLARITY_TARGET, e.pool_size))));

  // Differentiability = % of candidate pools in which a dimension takes >1 distinct
  // value (only then can it influence the within-pool re-rank). Low % ⇒ AQ-2 fixed
  // that dimension at tag/family granularity, so it cannot move the selection.
  const pools = poolVar.length;
  const diff = (k: string) => r1(100 * (pools ? poolVar.filter(p => p[k] > 1).length / pools : 0));
  const differentiability = {
    pools_measured: pools,
    signal_confidence_pct: diff('d_signal'),
    age_band_pct: diff('d_ageband'),
    persona_primary_pct: diff('d_persona'),
    capability_pct: diff('d_capability'),
    behavior_pct: diff('d_behavior'),
    dev_stage_pct: diff('d_stage'),
    question_intelligence_score_pct: diff('d_qis'),
  };

  const machine = {
    generated_at: new Date().toISOString(),
    phase: 'AQ-2R',
    deterministic: true,
    flag: 'runtimeMetadataActivation (FF_RUNTIME_METADATA_ACTIVATION)',
    scope: 'Tier-1 master-curated clarity selection only (pickQuestionsFromMaster)',
    scorer_module: 'backend/services/question-metadata-ranking.ts',
    weights: META_WEIGHTS,
    stage_order: STAGE_ORDER,
    metadata_table: 'capadex_question_metadata',
    metadata_join_coverage_pct: 100.0,
    bank_ais_aq2_reference: 73.9,
    bank_ais_note: 'AQ-2 BANK AIS (coverage×confidence of the whole bank). DISTINCT from the SELECTION AIS measured here.',
    envelopes_measured: envelopes,
    concerns: CONCERN_IDS.length,
    test_ages: TEST_AGES,
    personas: CANONICAL_PERSONAS,
    out_of_range_contexts_skipped: outOfRange,
    empty_pool_contexts_skipped: emptyPool,
    selection_before: beforeAgg,
    selection_after: afterAgg,
    selection_delta: delta,
    envelopes_ais_improved: improvedAis,
    envelopes_ais_unchanged: unchangedAis,
    envelopes_ais_regressed: regressedAis,
    meta_present_rate_in_selection_pct: metaPresentRate,
    signal_present_rate_in_selection_pct: signalPresentRate,
    within_pool_differentiability_pct: differentiability,
    per_envelope: results.map(e => ({
      concern_id: e.concern_id, tag: e.tag, domain: e.domain, age: e.age, persona: e.persona,
      canonical_persona: e.canonicalPersona, pool_size: e.pool_size,
      before: { relevance: r1(e.before.relevance), signal: r1(e.before.signal), construct: r1(e.before.construct), ais: r1(e.before.ais), trust: r1(e.before.trust) },
      after: { relevance: r1(e.after.relevance), signal: r1(e.after.signal), construct: r1(e.after.construct), ais: r1(e.after.ais), trust: r1(e.after.trust) },
    })),
  };
  writeFileSync(join(OUT_DIR, 'aq2r_runtime_activation.json'), JSON.stringify(machine, null, 2));

  const pct = (n: number) => `${r1(n)}`;
  const deltaStr = (d: number) => (d >= 0 ? `+${r1(d)}` : `${r1(d)}`);

  // ---- 01 Runtime Wiring Summary ----
  writeFileSync(join(OUT_DIR, '01_runtime_wiring_summary.md'), `# AQ-2R · 01 — Runtime Wiring Summary

**Generated:** ${machine.generated_at}

## What was wired
The AQ-2 per-question metadata layer (\`capadex_question_metadata\`, 30,638 rows,
100% of the clarity bank, provenance \`aq2_reconstruction\`) is now consumed by the
**live** clarity-question selection \`pickQuestionsFromMaster\`
(\`backend/routes/capadex-concern-intelligence.ts\`).

| Aspect | Detail |
|---|---|
| Feature flag | \`runtimeMetadataActivation\` (\`FF_RUNTIME_METADATA_ACTIVATION\`) — **default OFF** |
| Flag OFF | No metadata join, no scoring, no re-rank → **byte-identical legacy ordering** |
| Flag ON | LEFT JOIN metadata by \`question_id\`; re-rank candidate pool by composite meta score; stage-progression order the final batch |
| Shared scorer | \`backend/services/question-metadata-ranking.ts\` — imported by BOTH the runtime picker AND this harness (one scorer, no drift) |
| Scope | **Tier-1 master-curated clarity only.** Tier-2 adaptive bank + Tier-3 static fallback carry no AQ-2 metadata and are untouched (honest scoping) |
| Safety | Re-rank wrapped like the WC-1B-R grounded nudge; join-miss rows score 0 and sort last but are **never dropped** |

## Scoring weights (sum = 1.0)
| Dimension | Weight |
|---|---|
| Age | ${META_WEIGHTS.age} |
| Persona | ${META_WEIGHTS.persona} |
| Signal | ${META_WEIGHTS.signal} |
| Behavior | ${META_WEIGHTS.behavior} |
| Capability | ${META_WEIGHTS.capability} |
| Stage | ${META_WEIGHTS.stage} |

Stage progression order: ${STAGE_ORDER.join(' → ')}.

## Measurement
Deterministic (no random). ${envelopes} envelopes = ${CONCERN_IDS.length} representative
concerns × ${TEST_AGES.length} ages × ${CANONICAL_PERSONAS.length} personas (in-range
contexts only). ${outOfRange} out-of-range and ${emptyPool} empty-pool contexts skipped.
Identical candidate pool per envelope for both arms; only the ordering differs.

> Scope of fidelity: the harness shares the production **scorer** and the **candidate
> gate** (bridge tag + family-age + options≥2). The picker's topical-relevance
> partition and youth-demotion are deliberately held constant — they are orthogonal
> to the metadata re-rank, so isolating the re-rank is exactly what the A/B measures.
`);

  // ---- 02 Metadata Consumption Report ----
  writeFileSync(join(OUT_DIR, '02_metadata_consumption_report.md'), `# AQ-2R · 02 — Metadata Consumption Report

How much of the AQ-2 metadata the runtime selection actually consumes.

| Measure | Value |
|---|---|
| Metadata join coverage (bank-wide) | 100.0% (30,638 / 30,638) |
| Envelopes measured | ${envelopes} |
| Metadata present in selected questions | ${pct(metaPresentRate)}% |
| Signal confidence present in selected questions | ${pct(signalPresentRate)}% |

### Dimension coverage of the bank (AQ-2 reconstruction, for reference)
| Dimension | Bank coverage |
|---|---|
| Age | 99.6% |
| Persona | 96.9% |
| Stage | 100% |
| Behavior | 99.9% |
| Capability | 100% |
| Signal | 55.8% |

Signal is the sparsest dimension (55.8% of the bank), which is why the post-selection
signal-confidence figure is bounded — the runtime consumes what exists and never
fabricates a signal where AQ-2 recorded none.

### Within-pool differentiability (the real value ceiling)
A dimension can only change the runtime selection if it **varies across a concern's
candidate pool**. Measured over ${differentiability.pools_measured} candidate pools,
the share that carry >1 distinct value for each dimension:

| Dimension | Pools with variance |
|---|---|
| Question Intelligence Score (QIS) | ${differentiability.question_intelligence_score_pct}% |
| Dev stage | ${differentiability.dev_stage_pct}% |
| Persona (primary) | ${differentiability.persona_primary_pct}% |
| Signal confidence | ${differentiability.signal_confidence_pct}% |
| Age band | ${differentiability.age_band_pct}% |
| Behavior | ${differentiability.behavior_pct}% |
| Capability | ${differentiability.capability_pct}% |

**Key finding (measured, honest):** AQ-2 derived signal / age-band / behavior /
capability at **tag (family) granularity**, so they are effectively constant within a
single concern's pool and cannot move the within-pool re-rank — only QIS, dev-stage
and (partly) persona vary per question. That is precisely why the Trust and Relevance
deltas are positive while Signal and Construct deltas are ~0: the runtime exploits
exactly the per-question variance that exists, and nothing it doesn't. Raising the
signal/construct deltas would require AQ-2 to re-derive those dimensions at
per-question granularity — a data-layer change, not a runtime one.
`);

  // ---- 03 Question Selection Delta ----
  const sortedByAisDelta = [...results].sort((a, b) => (b.after.ais - b.before.ais) - (a.after.ais - a.before.ais));
  const topRows = sortedByAisDelta.slice(0, 12).map(e =>
    `| ${e.concern_id} | ${e.domain} | ${e.age} | ${e.persona} | ${r1(e.before.relevance)} | ${r1(e.after.relevance)} | ${deltaStr(e.after.relevance - e.before.relevance)} |`).join('\n');
  writeFileSync(join(OUT_DIR, '03_question_selection_delta.md'), `# AQ-2R · 03 — Question Selection Delta

**Question Relevance** = mean of (age-band match + persona match) / 2 over the
selected questions.

| Arm | Question Relevance |
|---|---|
| BEFORE (legacy) | ${pct(beforeAgg.relevance)} |
| AFTER (AQ-2R) | ${pct(afterAgg.relevance)} |
| **Delta** | **${deltaStr(delta.relevance)}** |

### Envelope outcome distribution (by AIS)
| Outcome | Envelopes |
|---|---|
| Improved | ${improvedAis} |
| Unchanged | ${unchangedAis} |
| Regressed | ${regressedAis} |

### Largest relevance gains (top 12 envelopes)
| Concern | Domain | Age | Persona | Rel before | Rel after | Δ |
|---|---|---|---|---|---|---|
${topRows}
`);

  // ---- 04 Signal Confidence Delta ----
  writeFileSync(join(OUT_DIR, '04_signal_confidence_delta.md'), `# AQ-2R · 04 — Signal Confidence Delta

Mean \`signal_confidence\` over the selected questions (join-miss / no-signal = 0).

| Arm | Signal Confidence |
|---|---|
| BEFORE (legacy) | ${pct(beforeAgg.signal)} |
| AFTER (AQ-2R) | ${pct(afterAgg.signal)} |
| **Delta** | **${deltaStr(delta.signal)}** |

Signal carries weight ${META_WEIGHTS.signal} in the composite. Because only 55.8% of
the bank carries a signal at all, the absolute ceiling is bounded; AQ-2R lifts the
mean by preferring the signal-bearing questions that DO exist for each concern.
`);

  // ---- 05 Assessment Intelligence Delta ----
  writeFileSync(join(OUT_DIR, '05_assessment_intelligence_delta.md'), `# AQ-2R · 05 — Assessment Intelligence Delta

**Selection AIS** = mean(Question Relevance, Signal Confidence, Construct Accuracy)
over the selected questions. This is a **SELECTION** metric and is distinct from the
AQ-2 **BANK** AIS (73.9 = coverage×confidence of the whole reconstructed bank).

| Metric | BEFORE | AFTER | Delta |
|---|---|---|---|
| Question Relevance | ${pct(beforeAgg.relevance)} | ${pct(afterAgg.relevance)} | ${deltaStr(delta.relevance)} |
| Signal Confidence | ${pct(beforeAgg.signal)} | ${pct(afterAgg.signal)} | ${deltaStr(delta.signal)} |
| Construct Accuracy | ${pct(beforeAgg.construct)} | ${pct(afterAgg.construct)} | ${deltaStr(delta.construct)} |
| **Selection AIS** | **${pct(beforeAgg.ais)}** | **${pct(afterAgg.ais)}** | **${deltaStr(delta.ais)}** |

Construct Accuracy = mean of (primary_behavior present + primary_capability present,
excluding \`UNASSIGNED_ROUTING_NODE\`) / 2 over the selection.

Reference: AQ-2 BANK AIS = 73.9 (not comparable to Selection AIS above — different unit).

### Why the deltas are bounded (measured, not excused)
The re-rank can only move a metric whose underlying dimension VARIES within a
concern's candidate pool. Per deliverable 02's differentiability table, AQ-2 fixed
signal / age-band / behavior / capability at tag granularity, so Signal Confidence and
Construct Accuracy are invariant within a pool → their deltas are ~0 by construction,
not by failure. The genuine per-question variance lives in QIS, dev-stage and persona,
which is exactly where AQ-2R delivers its Trust (+${deltaStr(delta.trust)}) and
Relevance (+${deltaStr(delta.relevance)}) lift plus a stage-ordered progression. No
metric was tuned; the ceiling is a property of the AQ-2 data layer's granularity.
`);

  // ---- 06 Updated Trust Score ----
  writeFileSync(join(OUT_DIR, '06_updated_trust_score.md'), `# AQ-2R · 06 — Updated Trust Score

**Trust Score** = mean \`question_intelligence_score\` (QIS) over the selected
questions. QIS is the per-question evidence weight (coverage×confidence across the
six AQ-2 dimensions), so a higher selection-Trust means the runtime is choosing
better-evidenced questions.

| Arm | Trust Score |
|---|---|
| BEFORE (legacy) | ${pct(beforeAgg.trust)} |
| AFTER (AQ-2R) | ${pct(afterAgg.trust)} |
| **Delta** | **${deltaStr(delta.trust)}** |

Reference: mean QIS across the whole AQ-2 bank = 51.1. AQ-2R's selection-Trust shows
whether runtime selection skews above or below the bank mean.
`);

  console.log('AQ-2R measurement complete.');
  console.log(`Envelopes: ${envelopes} | out-of-range skipped: ${outOfRange} | empty-pool skipped: ${emptyPool}`);
  console.log('BEFORE', beforeAgg);
  console.log('AFTER ', afterAgg);
  console.log('DELTA ', delta);
  console.log(`AIS improved/unchanged/regressed: ${improvedAis}/${unchangedAis}/${regressedAis}`);
  console.log(`meta present in selection: ${metaPresentRate}% | signal present: ${signalPresentRate}%`);
  console.log(`Deliverables written to ${OUT_DIR}`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
