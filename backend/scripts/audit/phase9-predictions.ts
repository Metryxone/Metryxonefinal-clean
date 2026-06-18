/**
 * CAPADEX PIL — Phase 9: Predictive & Outcome Intelligence audit + outputs.
 *   Run: cd backend && FF_RUNTIME_INTELLIGENCE_ACTIVATION=1 FF_RUNTIME_INTELLIGENCE_PIPELINE=1 \
 *        npx tsx scripts/audit/phase9-predictions.ts
 *
 * Read-only composition of the descriptive layers (runtime pipeline, reports,
 * recommendations, knowledge graph) into EXPLAINABLE predictions. Drives the REAL
 * engine over REAL sessions + KG archetypes — no mocks. Emits:
 *   - future_readiness_examples.json
 *   - career_readiness_examples.json
 *   - risk_forecast_examples.json
 *   - intervention_impact_examples.json
 *   - prediction_explainability.json   (Prediction Explainability Score)
 *   - platform_completion.json         (Platform Completion Assessment)
 *   - validation.json                  (accuracy framework + coverage)
 *   - PREDICTIVE_INTELLIGENCE.md
 *   → audit/phase9/.
 *
 * HONEST: degraded/absent evidence lowers confidence + is surfaced; nothing is
 * fabricated; NO empirical accuracy is claimed (no realized outcomes exist).
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { isRuntimeIntelligenceActivationEnabled } from '../../config/feature-flags';
import {
  buildPredictionsForSession,
  buildPredictionInputFromArchetype,
  predict,
  type SubjectPrediction,
} from '../../services/pil/prediction-engine';
import {
  buildAccuracyFramework,
  rollupCoverage,
  buildPlatformCompletionAssessment,
  countRealizedOutcomes,
} from '../../services/pil/prediction-validation';

const OUT_DIR = join(process.cwd(), '..', 'audit', 'phase9');
const writeJson = (name: string, data: unknown) =>
  writeFileSync(join(OUT_DIR, name), JSON.stringify(data, null, 2) + '\n', 'utf8');
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

async function realSessions(pool: Pool, limit: number): Promise<string[]> {
  try {
    const { rows } = await pool.query(
      `SELECT session_id FROM capadex_session_signals
        WHERE lifecycle_state IS NOT NULL
        GROUP BY session_id
        ORDER BY COUNT(*) DESC
        LIMIT $1`, [limit],
    );
    return rows.map((r) => String(r.session_id));
  } catch { return []; }
}

async function archetypeKeys(pool: Pool, limit: number): Promise<string[]> {
  // The engine matches archetype anchors on the KG node LABEL — query those directly.
  for (const sql of [
    `SELECT label AS k FROM pil_kg_nodes WHERE node_type ILIKE '%archetype%' ORDER BY label LIMIT $1`,
    `SELECT archetype_name AS k FROM archetype_library ORDER BY archetype_name LIMIT $1`,
  ]) {
    try { const { rows } = await pool.query(sql, [limit]); if (rows.length) return rows.map((r) => String(r.k)); } catch { /* try next */ }
  }
  return [];
}

function readinessExamples(preds: SubjectPrediction[], dim: 'future' | 'career') {
  return preds.map((p) => {
    const r = p.readiness.find((x) => x.dimension === dim)!;
    return {
      subject_id: p.subject_id,
      source: p.source,
      concern_label: p.concern_label,
      archetype: p.archetype.name,
      dimension: dim,
      score: r.score,
      band: r.band,
      confidence: r.confidence,
      confidence_band: r.confidence_band,
      expected_outcome: r.expected_outcome,
      chain_completeness: r.chain_completeness,
      degraded: r.degraded,
      contributions: r.contributions.slice(0, 4),
      intervention_levers: r.intervention_levers.slice(0, 3),
      rationale: r.rationale,
      trace: r.trace.stages,
    };
  });
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const flagOn = isRuntimeIntelligenceActivationEnabled();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    if (!flagOn) {
      console.warn('[phase9] FF_RUNTIME_INTELLIGENCE_ACTIVATION is OFF — predictions return {enabled:false}. Set the flag to generate real outputs.');
    }

    const sessionIds = await realSessions(pool, 25);
    const arcKeys = await archetypeKeys(pool, 8);

    // Build real session predictions (the engine writes its append-only audit row).
    const sessionPreds: SubjectPrediction[] = [];
    for (const id of sessionIds) {
      const p = await buildPredictionsForSession(pool, id).catch(() => null);
      if (p) sessionPreds.push(p);
    }

    // Build KG archetype predictions for breadth (real lineage + library impacts).
    const archetypePreds: SubjectPrediction[] = [];
    for (const k of arcKeys) {
      const input = await buildPredictionInputFromArchetype(pool, k).catch(() => null);
      if (input) archetypePreds.push(predict(input));
    }

    const allPreds = [...sessionPreds, ...archetypePreds];

    // 1 + 2. Future / Career readiness examples (sessions first — richest evidence).
    writeJson('future_readiness_examples.json', {
      generated_at: new Date().toISOString(),
      from_sessions: sessionPreds.length,
      from_archetypes: archetypePreds.length,
      note: sessionPreds.length === 0
        ? 'No sessions with active signals — archetype examples are structural (neutral baseline + real intervention levers).'
        : 'Session examples carry individual evidence; archetype examples are structural breadth.',
      examples: readinessExamples(allPreds, 'future').slice(0, 10),
    });
    writeJson('career_readiness_examples.json', {
      generated_at: new Date().toISOString(),
      examples: readinessExamples(allPreds, 'career').slice(0, 10),
    });

    // 3. Risk forecast examples (active-signal-driven → only sessions populate these).
    const risks = sessionPreds.flatMap((p) =>
      p.future_risks.map((r) => ({ subject_id: p.subject_id, concern_label: p.concern_label, ...r, trace: r.trace.stages })),
    );
    writeJson('risk_forecast_examples.json', {
      generated_at: new Date().toISOString(),
      total_risks: risks.length,
      mitigable: risks.filter((r) => r.trajectory === 'mitigable').length,
      persistent: risks.filter((r) => r.trajectory === 'persistent').length,
      note: risks.length === 0 ? 'No active-signal sessions → no individual risk forecasts (honest).' : undefined,
      examples: risks.slice(0, 12),
    });

    // 4. Intervention impact examples.
    const impacts = allPreds.flatMap((p) =>
      p.intervention_impact.map((im) => ({ subject_id: p.subject_id, source: p.source, ...im, trace: im.trace.stages })),
    ).sort((a, b) => b.predicted_reduction - a.predicted_reduction);
    writeJson('intervention_impact_examples.json', {
      generated_at: new Date().toISOString(),
      total: impacts.length,
      examples: impacts.slice(0, 12),
    });

    // 5. Prediction Explainability Score + validation.
    const framework = buildAccuracyFramework();
    const coverage = rollupCoverage(allPreds);
    const realized = await countRealizedOutcomes(pool).catch(() => 0);
    coverage.outcome_coverage.with_realized_outcome = realized;
    coverage.outcome_coverage.coverage = coverage.outcome_coverage.total ? Math.round((realized / coverage.outcome_coverage.total) * 10000) / 10000 : 0;

    writeJson('prediction_explainability.json', {
      generated_at: new Date().toISOString(),
      prediction_explainability_score: coverage.prediction_explainability_score,
      explainability_coverage: coverage.explainability_coverage,
      prediction_coverage: coverage.prediction_coverage,
      per_subject: allPreds.map((p) => ({ subject_id: p.subject_id, source: p.source, score: p.explainability.score, chain_completeness: p.explainability.chain_completeness })),
    });
    writeJson('validation.json', {
      generated_at: new Date().toISOString(),
      accuracy_framework: framework,
      coverage,
    });

    // 6. Platform Completion Assessment.
    const completion = buildPlatformCompletionAssessment(coverage, framework);
    writeJson('platform_completion.json', { generated_at: new Date().toISOString(), ...completion });

    // Narrative.
    const md: string[] = [];
    md.push('# CAPADEX Phase 9 — Predictive & Outcome Intelligence');
    md.push('');
    md.push(`Generated: ${new Date().toISOString()} · flag ${flagOn ? 'ON' : 'OFF'}`);
    md.push('');
    md.push('Descriptive → **Predictive**, by COMPOSITION (no black box). Every prediction traces the 7-hop spine');
    md.push('`Concern → Capability → Problem → Behavior → Archetype → Intervention → Recommendation`.');
    md.push('');
    md.push('## Inputs');
    md.push(`- Real sessions with active signals: **${sessionPreds.length}** (of ${sessionIds.length} candidates).`);
    md.push(`- KG archetype profiles (structural breadth): **${archetypePreds.length}**.`);
    md.push('');
    md.push('## Validation');
    md.push(`- Internal consistency: **${framework.consistency_passed}/${framework.consistency_total}** invariants${framework.internally_valid ? ' — internally valid' : ' — FAILED (investigate)'}.`);
    md.push(`- Prediction coverage: **${pct(coverage.prediction_coverage.coverage)}** (${coverage.prediction_coverage.produced}/${coverage.prediction_coverage.evaluated}; ${coverage.prediction_coverage.degraded} degraded).`);
    md.push(`- Explainability coverage: **${pct(coverage.explainability_coverage.coverage)}** (${coverage.explainability_coverage.predictions_traced}/${coverage.explainability_coverage.predictions_total} predictions traced).`);
    md.push(`- **Prediction Explainability Score: ${pct(coverage.prediction_explainability_score)}**.`);
    md.push(`- Outcome coverage: **${pct(coverage.outcome_coverage.coverage)}** — ${coverage.outcome_coverage.note}`);
    md.push('');
    md.push('> Empirical accuracy is **not claimed**: no realized longitudinal outcomes exist yet, so predicted-vs-actual is not measurable. Validity rests on internal-consistency invariants + full explainability until outcomes are captured.');
    md.push('');
    md.push('## Platform Completion');
    md.push(`- Completion score: **${pct(completion.completion_score)}** (${completion.layers.filter((l) => l.status === 'present').length}/${completion.layers.length} layers present).`);
    md.push(`- Descriptive complete: **${completion.descriptive_complete}** · Predictive valid: **${completion.predictive_complete}**.`);
    for (const l of completion.layers) md.push(`  - [${l.status}] ${l.name} — ${l.note}`);
    md.push('');
    md.push('### Honest gaps');
    if (completion.honest_gaps.length === 0) md.push('- None surfaced.');
    for (const g of completion.honest_gaps) md.push(`- ${g}`);
    md.push('');
    md.push('## Outputs');
    md.push('- `future_readiness_examples.json` · `career_readiness_examples.json`');
    md.push('- `risk_forecast_examples.json` · `intervention_impact_examples.json`');
    md.push('- `prediction_explainability.json` · `platform_completion.json` · `validation.json`');
    md.push('');
    writeFileSync(join(OUT_DIR, 'PREDICTIVE_INTELLIGENCE.md'), md.join('\n') + '\n', 'utf8');

    console.log('[phase9] wrote outputs → audit/phase9/');
    console.log(`[phase9] sessions=${sessionPreds.length} archetypes=${archetypePreds.length} ` +
      `explainability=${pct(coverage.prediction_explainability_score)} completion=${pct(completion.completion_score)} ` +
      `consistency=${framework.consistency_passed}/${framework.consistency_total}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => { console.error('[phase9] fatal:', err); process.exit(1); });
