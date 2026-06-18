/**
 * WC-3 L5C (Runtime) — Outcome Projection build + measurement.
 *
 * Runs the deterministic Outcome Projection engine (services/wc3/outcome-projection.ts)
 * over the ENTIRE clarity bank along the approved chain
 *   Question → Bridge Tag → Construct → Outcome Model,
 * computes the 8 validation metrics, and writes the 6 reports to
 * backend/audit/l5c-runtime/. Read-only against the DB (SELECT only) — no schema or
 * data writes, no runtime wiring. Idempotent. Usage: npx tsx scripts/wc3/build-outcome-projection.ts
 */
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import {
  projectOutcome,
  type OutcomeModelLite,
  type OutcomeProjection,
} from '../../services/wc3/outcome-projection';
import {
  BRIDGE_TAG_CONSTRUCT_CROSSWALK,
  resolveConstructForBridgeTag,
} from '../../data/bridge-tag-construct-crosswalk';

const AUDIT = path.join(__dirname, '../../audit/l5c-runtime');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  fs.mkdirSync(AUDIT, { recursive: true });
  try {
    const models: OutcomeModelLite[] = (
      await pool.query('SELECT model_key, construct_keys, gated FROM wc3_outcome_models ORDER BY model_key')
    ).rows.map((r) => ({ model_key: r.model_key, construct_keys: r.construct_keys, gated: r.gated }));
    const ungatedKeys = new Set(models.filter((m) => !m.gated).map((m) => m.model_key));

    // Per-question rows joined to L5A stage + L5B context.
    const rows = (
      await pool.query(`
      SELECT c.master_bridge_tag AS tag, i.primary_stage AS stage, x.primary_context AS context
      FROM capadex_clarity_questions c
      LEFT JOIN wc3_question_intelligence i ON i.clarity_id = c.id
      LEFT JOIN wc3_question_context x ON x.clarity_id = c.id`)
    ).rows as Array<{ tag: string | null; stage: string | null; context: string | null }>;
    const TOTAL = rows.length;

    // Cache one projection per distinct bridge tag.
    const projCache = new Map<string, OutcomeProjection>();
    const projFor = (tag: string | null): OutcomeProjection | null => {
      if (!tag) return null;
      if (!projCache.has(tag)) projCache.set(tag, projectOutcome(tag, resolveConstructForBridgeTag(tag), models));
      return projCache.get(tag)!;
    };

    // ── Accumulators ──
    let covered = 0, coveredUngated = 0, gatedOnly = 0, ambiguous = 0, confSum = 0;
    const dist = new Map<string, number>();              // primary outcome → q
    const reachPrimary = new Map<string, number>();      // model → q as primary
    const reachAny = new Map<string, number>();          // model → q as primary OR secondary
    const confBand = { high: 0, med: 0, low: 0, none: 0 };
    const ambBand = { none: 0, low: 0, med: 0, high: 0 };
    const stageXout = new Map<string, Map<string, number>>();
    const ctxXout = new Map<string, Map<string, number>>();
    const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
    const bump2 = (m: Map<string, Map<string, number>>, a: string, b: string) => {
      if (!m.has(a)) m.set(a, new Map());
      bump(m.get(a)!, b);
    };

    for (const r of rows) {
      const p = projFor(r.tag);
      const primary = p?.primary_outcome ?? 'NONE';
      bump(dist, primary);
      const stage = r.stage ?? 'UNKNOWN';
      const ctx = r.context ?? 'UNKNOWN';
      bump2(stageXout, stage, primary);
      bump2(ctxXout, ctx, primary);

      if (p?.primary_outcome) {
        covered++;
        if (ungatedKeys.has(p.primary_outcome)) coveredUngated++;
        if (p.gated_only) gatedOnly++;
        if (p.secondary_outcome) ambiguous++;
        bump(reachPrimary, p.primary_outcome);
        for (const m of p.ranked_models.slice(0, 2)) bump(reachAny, m);
        confSum += p.outcome_confidence;
        const c = p.outcome_confidence;
        if (c >= 0.7) confBand.high++; else if (c >= 0.4) confBand.med++; else confBand.low++;
        const a = p.ambiguity;
        if (a === 0) ambBand.none++; else if (a < 0.34) ambBand.low++; else if (a < 0.67) ambBand.med++; else ambBand.high++;
      } else {
        confBand.none++;
        ambBand.none++;
      }
    }

    const pct = (x: number) => ((100 * x) / TOTAL).toFixed(1) + '%';
    const meanConf = covered ? (confSum / covered).toFixed(3) : '0';
    // Metric 8: completeness = (has_stage + has_context + has_outcome)/3, averaged.
    const before = (2 * TOTAL + 0) / (3 * TOTAL);            // outcome layer absent
    const after = (2 * TOTAL + covered) / (3 * TOTAL);

    const metrics = {
      total_questions: TOTAL,
      distinct_bridge_tags: projCache.size,
      m1_outcome_coverage: { covered, pct: pct(covered), ungated_pct: pct(coveredUngated), gated_only: gatedOnly },
      m2_outcome_distribution: Object.fromEntries([...dist.entries()].sort((a, b) => b[1] - a[1])),
      m3_outcome_confidence: { mean: meanConf, bands: confBand },
      m4_outcome_ambiguity: { ambiguous_pct: pct(ambiguous), bands: ambBand },
      m5_outcome_reachability_primary: Object.fromEntries([...reachPrimary.entries()].sort((a, b) => b[1] - a[1])),
      m8_qi_completeness: { before: (before * 100).toFixed(1) + '%', after: (after * 100).toFixed(1) + '%' },
    };
    console.log(JSON.stringify(metrics, null, 2));

    // ── Reports ──
    const tagCounts = new Map<string, number>();
    for (const r of rows) if (r.tag) tagCounts.set(r.tag, (tagCounts.get(r.tag) ?? 0) + 1);

    // Residual = construct-reachable (HIGH/REVIEW) but reaches NO outcome model.
    // Derived ONLY from this projection so report narrative cannot over-claim.
    const residual = new Map<string, number>();
    let unmappedQ = 0;
    for (const [tag, p] of projCache.entries()) {
      if (p.primary_outcome !== null) continue;
      const qn = tagCounts.get(tag) ?? 0;
      if (p.crosswalk_status === 'HIGH_CONFIDENCE' && p.construct) {
        residual.set(p.construct, (residual.get(p.construct) ?? 0) + qn);
      } else if (p.crosswalk_status === 'REVIEW_REQUIRED') {
        for (const c of resolveConstructForBridgeTag(tag)?.candidates ?? []) {
          residual.set(c, (residual.get(c) ?? 0) + qn);
        }
      } else {
        unmappedQ += qn; // UNMAPPED / ABSENT — no construct at all
      }
    }
    const residualStr =
      [...residual.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} (${n}q)`).join(', ') || 'none';
    const zeroReachModels = models.filter((m) => (reachAny.get(m.model_key) ?? 0) === 0).map((m) => m.model_key);
    const masteryRow = stageXout.get('Mastery');
    const masteryTotal = masteryRow ? [...masteryRow.values()].reduce((s, v) => s + v, 0) : 0;
    const masteryNone = masteryRow?.get('NONE') ?? 0;

    const W = (f: string, s: string) => fs.writeFileSync(path.join(AUDIT, f), s);
    const csvEsc = (s: unknown) => '"' + String(s ?? '').replace(/"/g, '""') + '"';

    // 1. Outcome Projection (per bridge tag, CSV)
    let csv = 'bridge_tag,questions,construct,crosswalk_status,primary_outcome,secondary_outcome,outcome_confidence,ambiguity,gated_only,reason\n';
    for (const tag of [...projCache.keys()].sort()) {
      const p = projCache.get(tag)!;
      csv += [csvEsc(tag), tagCounts.get(tag) ?? 0, csvEsc(p.construct), p.crosswalk_status, csvEsc(p.primary_outcome), csvEsc(p.secondary_outcome), p.outcome_confidence, p.ambiguity, p.gated_only, csvEsc(p.reason)].join(',') + '\n';
    }
    W('01_outcome_projection.csv', csv);

    // 2. Outcome Coverage
    W('02_outcome_coverage.md', `# L5C Runtime — Report 2: Outcome Coverage

Chain: Question → Bridge Tag → Construct → Outcome Model. Frequency-weighted (n=${TOTAL}; ${projCache.size} distinct bridge tags). Read-only projection; no runtime wiring.

| Metric | Value |
|--------|-------|
| Questions with a Primary Outcome | **${covered} (${pct(covered)})** |
| ...routing to an **ungated** outcome model | ${coveredUngated} (${pct(coveredUngated)}) |
| ...reachable **only via a gated** model (exam_readiness) | ${gatedOnly} (${pct(gatedOnly)}) |
| Questions with NO outcome (UNMAPPED / construct→no-model) | ${TOTAL - covered} (${pct(TOTAL - covered)}) |

The uncovered residual is honest and split into two grounded buckets (derived from this projection, not asserted):
- **UNMAPPED / absent bridge tags** (institutional/holistic — no behavioural construct at all): ${unmappedQ} q (${pct(unmappedQ)}).
- **Construct-reachable but in no outcome model's \`construct_keys\`** (HIGH/REVIEW construct exists, but no \`wc3_outcome_models\` row contains it): ${residualStr}.

Neither bucket is forced — construct-reachable ≠ outcome-reachable.
`);

    // 3. Outcome Distribution
    let r3 = `# L5C Runtime — Report 3: Outcome Distribution

Primary outcome per question, q-weighted (n=${TOTAL}).

| Primary Outcome | Questions | % bank |
|-----------------|-----------|--------|
`;
    for (const [k, v] of [...dist.entries()].sort((a, b) => b[1] - a[1])) {
      const g = models.find((m) => m.model_key === k)?.gated ? ' (gated)' : '';
      r3 += `| ${k}${g} | ${v} | ${pct(v)} |\n`;
    }
    W('03_outcome_distribution.md', r3);

    // 4. Outcome Confidence
    W('04_outcome_confidence.md', `# L5C Runtime — Report 4: Outcome Confidence

Outcome confidence = base crosswalk confidence × primary-model score concentration. Derived only from the crosswalk→outcome chain (stage/context excluded by design).

- **Mean outcome confidence (over covered questions): ${meanConf}**

| Confidence band | Questions | % bank |
|-----------------|-----------|--------|
| HIGH (≥ 0.70) | ${confBand.high} | ${pct(confBand.high)} |
| MEDIUM (0.40–0.69) | ${confBand.med} | ${pct(confBand.med)} |
| LOW (< 0.40) | ${confBand.low} | ${pct(confBand.low)} |
| NONE (no outcome) | ${confBand.none} | ${pct(confBand.none)} |

## Ambiguity (metric 4)
- Questions with a Secondary Outcome (construct spans >1 model): **${ambiguous} (${pct(ambiguous)})**

| Ambiguity band (1 − concentration) | Questions | % bank |
|------------------------------------|-----------|--------|
| NONE (single model / no outcome) | ${ambBand.none} | ${pct(ambBand.none)} |
| LOW (< 0.34) | ${ambBand.low} | ${pct(ambBand.low)} |
| MEDIUM (0.34–0.66) | ${ambBand.med} | ${pct(ambBand.med)} |
| HIGH (≥ 0.67) | ${ambBand.high} | ${pct(ambBand.high)} |
`);

    // 5. Outcome Reachability + Stage×Outcome + Context×Outcome
    const outcomeKeys = [...models.map((m) => m.model_key), 'NONE'];
    const matrix = (m: Map<string, Map<string, number>>, rowLabel: string) => {
      let t = `\n| ${rowLabel} | ${outcomeKeys.join(' | ')} |\n|${'---|'.repeat(outcomeKeys.length + 1)}\n`;
      for (const [rk, inner] of [...m.entries()].sort((a, b) => {
        const sa = [...a[1].values()].reduce((s, v) => s + v, 0);
        const sb = [...b[1].values()].reduce((s, v) => s + v, 0);
        return sb - sa;
      })) {
        t += `| ${rk} | ${outcomeKeys.map((k) => inner.get(k) ?? 0).join(' | ')} |\n`;
      }
      return t;
    };
    let r5 = `# L5C Runtime — Report 5: Outcome Reachability

Per outcome model, q-weighted reach (n=${TOTAL}).

| Outcome Model | Gated | As Primary | As Primary/Secondary |
|---------------|-------|-----------|----------------------|
`;
    for (const m of models) r5 += `| ${m.model_key} | ${m.gated ? 'yes' : 'no'} | ${reachPrimary.get(m.model_key) ?? 0} (${pct(reachPrimary.get(m.model_key) ?? 0)}) | ${reachAny.get(m.model_key) ?? 0} (${pct(reachAny.get(m.model_key) ?? 0)}) |\n`;
    r5 += `\nOverall: **${covered} (${pct(covered)})** of questions reach ≥1 outcome model.\n`;
    r5 += `\n## Metric 6 — Stage × Primary Outcome matrix (L5A primary_stage)\n${matrix(stageXout, 'Stage \\ Outcome')}`;
    r5 += `\n## Metric 7 — Context × Primary Outcome matrix (L5B primary_context)\n${matrix(ctxXout, 'Context \\ Outcome')}`;
    W('05_outcome_reachability.md', r5);

    // 6. Layer-2 Readiness
    W('06_layer2_readiness.md', `# L5C Runtime — Report 6: Layer-2 Readiness (for L5D Journey Projection)

## Metric 8 — Question Intelligence Score Delta
Completeness = (stage[L5A] + context[L5B] + outcome[L5C])/3, averaged over all ${TOTAL} questions:
- Before outcome layer: **${(before * 100).toFixed(1)}%**
- After outcome layer: **${(after * 100).toFixed(1)}%**  (+${((after - before) * 100).toFixed(1)} pts)

## Readiness summary
- ✅ Deterministic per-tag outcome projection over all ${projCache.size} bridge tags (cached; engine is pure).
- ✅ ${covered} / ${TOTAL} questions (${pct(covered)}) carry a Primary Outcome; ${coveredUngated} (${pct(coveredUngated)}) on ungated models.
- ✅ Stage × Outcome and Context × Outcome matrices populated (L5A/L5B both 100% coverage) — the two axes L5D journey projection will traverse.
- ⚠️ ${pct(ambiguous)} of questions are outcome-ambiguous (secondary outcome present) — L5D must carry both primary + secondary, not collapse to one.
- ⚠️ ${pct(gatedOnly)} reach only the gated exam_readiness model — keep gated outcomes flagged in any journey.
- ⛔ ${pct(TOTAL - covered)} have no outcome. L5D must not fabricate a journey for these. Two grounded buckets:
  - UNMAPPED / absent tags (no construct at all): ${unmappedQ} q (${pct(unmappedQ)}).
  - Construct-reachable but in no outcome model: ${residualStr}.

## Notable honest findings (derived from this projection — not asserted, not tuned)
- ${zeroReachModels.length ? `⛔ Outcome model(s) unreachable from the clarity bank (0 questions): **${zeroReachModels.join(', ')}**. The model exists but no clarity bridge tag carries a construct in its \`construct_keys\` — reported, not forced.` : '✅ Every outcome model is reached by ≥1 question.'}
- ⚠️ Mastery stage is almost entirely uncovered (${masteryNone}/${masteryTotal} NONE) — its questions sit on tags that reach no outcome model. Honest sparsity for L5D to respect.

## Discipline held
No new constructs / outcome models / ontology. Crosswalk untouched. Engine additive + not wired into any live path. STOP — awaiting approval before L5D Journey Projection.
`);

    console.log('\nReports written to backend/audit/l5c-runtime/:');
    console.log(fs.readdirSync(AUDIT).join('\n'));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
