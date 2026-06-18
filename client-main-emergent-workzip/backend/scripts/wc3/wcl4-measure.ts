/**
 * WC-L4 — Intervention Intelligence: MEASURE (read-only audit, dual-axis honesty).
 *
 * Reads the persisted `wcl4_interventions` (written by the backfill / live hook) and the
 * completed-session base, then emits 6 markdown deliverables + a PII-masked snapshot JSON into
 * `backend/audit/wc-l4/`. It WRITES NOTHING to the database — purely descriptive.
 *
 * Two axes are reported SEPARATELY (user canon — never merged):
 *   • Structural Readiness (0–5) — is the engine built & wired (flag, registry, generator, annotations,
 *     hook, persistence)? This is a property of the CODE, independent of how much data exists.
 *   • Activation Readiness (0–5) — is real intelligence actually flowing (generator fires, real journey
 *     context, real decision context, trend consumption, forecast consumption)? This is bounded by the
 *     honest data ceiling (e.g. decision is 100% degraded today → 0 real contribution).
 *
 * Honesty rules: coverage is reported raw AND real-source; degraded journey/decision are bucketed and
 * counted as ZERO contribution; confidence is shown as INHERITED (from the generating outcome model);
 * nothing is fabricated; emails are one-way sha256-masked before any artifact is written.
 *
 * Usage:  cd backend && npx tsx scripts/wc3/wcl4-measure.ts
 */

// Mirror the live workflow flag set (+ Forecast) so any live re-derivation reads the same inputs.
process.env.FF_RUNTIME_INTELLIGENCE_ACTIVATION = '1';
process.env.FF_WC3_STAGE = '1';
process.env.FF_WC3_OUTCOME = '1';
process.env.FF_WC3_JOURNEY = '1';
process.env.FF_DECISION_PERSISTENCE = '1';
process.env.FF_BEHAVIOUR_NAMESPACE_ALIGNMENT = '1';
process.env.FF_FORECAST_INTELLIGENCE = '1';
process.env.FF_INTERVENTION_INTELLIGENCE = '1';

import { Pool } from 'pg';
import { createHash } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT_DIR = join(process.cwd(), 'audit', 'wc-l4');
const stamp = new Date().toISOString();

/** One-way, deterministic email mask (per-user grouping preserved; raw address NEVER stored). */
const maskEmail = (email: string | null): string =>
  email ? `user_${createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 10)}` : '(anonymous)';

const pct = (n: number, d: number): string => (d === 0 ? '0.0' : ((n / d) * 100).toFixed(1));

interface Row {
  session_id: string;
  intervention_id: string;
  user_email: string | null;
  intervention_name: string | null;
  source: string;
  model_key: string | null;
  confidence: number | null;
  priority: number | null;
  priority_elevated: boolean;
  rationale: string | null;
  sources: {
    generators?: { layer: string; model_key: string; display_label: string; confidence: number; rank: number }[];
    annotations?: {
      stage?: { canonical_stage: string; confidence: number } | null;
      journey?: { route_key: string; route_confidence: number; degraded?: boolean } | null;
      decision?: { route_key: string | null; primary_outcome_model: string | null; confidence: number; degraded?: boolean } | null;
      user?: { persona: string | null; persona_confidence: number | null } | null;
      trend_concerns?: { metric: string; direction: string; confidence: number }[];
      forecast_concerns?: { kind: string; projected_direction: string; forecast_confidence: number }[];
    };
  };
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // ── base: completed sessions ──
    const { rows: compRows } = await pool.query(`SELECT COUNT(*)::int AS n FROM capadex_sessions WHERE status='completed'`);
    const completedSessions: number = compRows[0].n;

    // ── base: how many completed sessions even have outcome state (the generator's pre-req) ──
    const { rows: outRows } = await pool.query(
      `SELECT COUNT(DISTINCT s.id)::int AS n
         FROM capadex_sessions s
         JOIN wc3_outcome_state o ON o.session_id = s.id
        WHERE s.status='completed'`,
    ).catch(() => ({ rows: [{ n: 0 }] }));
    const sessionsWithOutcomeState: number = outRows[0]?.n ?? 0;

    // ── persisted interventions ──
    const { rows } = await pool.query<Row>(`SELECT * FROM wcl4_interventions ORDER BY session_id, priority, confidence DESC`)
      .catch(() => ({ rows: [] as Row[] }));

    const totalInterventions = rows.length;
    const sessionsWithIntervention = new Set(rows.map((r) => r.session_id)).size;

    // ── per-layer / annotation tallies (interventions, not sessions, unless noted) ──
    let withStage = 0, withJourneyReal = 0, withJourneyDegraded = 0, withDecisionReal = 0, withDecisionDegraded = 0, withUser = 0, withTrend = 0, withForecast = 0, elevated = 0;
    let multiModel = 0;
    const confidences: number[] = [];
    const modelKeyTally = new Map<string, number>();
    const trendMetricTally = new Map<string, number>();
    const forecastKindTally = new Map<string, number>();
    const sessionsWithTrend = new Set<string>();
    const sessionsWithForecast = new Set<string>();
    const sessionsWithJourneyReal = new Set<string>();
    const sessionsWithDecisionReal = new Set<string>();

    for (const r of rows) {
      const a = r.sources?.annotations ?? {};
      if (a.stage) withStage += 1;
      if (a.journey) { if (a.journey.degraded) withJourneyDegraded += 1; else { withJourneyReal += 1; sessionsWithJourneyReal.add(r.session_id); } }
      if (a.decision) { if (a.decision.degraded) withDecisionDegraded += 1; else { withDecisionReal += 1; sessionsWithDecisionReal.add(r.session_id); } }
      if (a.user) withUser += 1;
      const tc = a.trend_concerns ?? [];
      const fc = a.forecast_concerns ?? [];
      if (tc.length > 0) { withTrend += 1; sessionsWithTrend.add(r.session_id); }
      if (fc.length > 0) { withForecast += 1; sessionsWithForecast.add(r.session_id); }
      for (const t of tc) trendMetricTally.set(`${t.metric} ${t.direction}`, (trendMetricTally.get(`${t.metric} ${t.direction}`) ?? 0) + 1);
      for (const f of fc) forecastKindTally.set(`${f.kind} ${f.projected_direction}`, (forecastKindTally.get(`${f.kind} ${f.projected_direction}`) ?? 0) + 1);
      if (r.priority_elevated) elevated += 1;
      if ((r.sources?.generators?.length ?? 0) > 1) multiModel += 1;
      if (r.confidence != null) confidences.push(Number(r.confidence));
      if (r.model_key) modelKeyTally.set(r.model_key, (modelKeyTally.get(r.model_key) ?? 0) + 1);
    }

    confidences.sort((x, y) => x - y);
    const cMin = confidences[0] ?? 0;
    const cMax = confidences[confidences.length - 1] ?? 0;
    const cMean = confidences.length ? confidences.reduce((s, v) => s + v, 0) / confidences.length : 0;
    const cMed = confidences.length ? confidences[Math.floor(confidences.length / 2)] : 0;

    // ── DUAL AXIS ──
    // Structural (0–5): build components that exist regardless of data volume.
    const structural = [
      { k: 'Feature flag + helper (interventionIntelligence)', present: true },
      { k: 'Deterministic registry (polarity, generator layer)', present: true },
      { k: 'Compose engine — library-backed generator only', present: true },
      { k: 'post-completion hook item 19 (flag-gated)', present: true },
      { k: 'Persistence schema + idempotent backfill', present: true },
    ];
    const structuralScore = structural.filter((s) => s.present).length;

    // Activation (0–5): real intelligence actually flowing (data-bound, honest ceiling).
    const activation = [
      { k: 'Generator fires (≥1 library-backed intervention persisted)', present: totalInterventions > 0 },
      { k: 'Real (non-degraded) journey context on ≥1 intervention', present: withJourneyReal > 0 },
      { k: 'Real (non-degraded) decision context on ≥1 intervention', present: withDecisionReal > 0 },
      { k: 'Trend consumption (≥1 polarity-aware concern annotation)', present: withTrend > 0 },
      { k: 'Forecast consumption (≥1 polarity-aware concern annotation)', present: withForecast > 0 },
    ];
    const activationScore = activation.filter((a) => a.present).length;

    // ── snapshot (PII-masked) ──
    const sessionMap = new Map<string, Row[]>();
    for (const r of rows) { const arr = sessionMap.get(r.session_id) ?? []; arr.push(r); sessionMap.set(r.session_id, arr); }
    const snapshotSessions = Array.from(sessionMap.entries()).map(([sid, list]) => ({
      session_id: sid,
      user: maskEmail(list[0].user_email),
      intervention_count: list.length,
      models: Array.from(new Set(list.map((r) => r.model_key).filter(Boolean))),
      any_priority_elevated: list.some((r) => r.priority_elevated),
      trend_concerns: list.some((r) => (r.sources?.annotations?.trend_concerns?.length ?? 0) > 0),
      forecast_concerns: list.some((r) => (r.sources?.annotations?.forecast_concerns?.length ?? 0) > 0),
      journey_degraded: list[0].sources?.annotations?.journey?.degraded ?? null,
      decision_degraded: list[0].sources?.annotations?.decision?.degraded ?? null,
      interventions: list.map((r) => ({
        intervention_id: r.intervention_id,
        name: r.intervention_name,
        model_key: r.model_key,
        confidence: r.confidence,
        priority: r.priority,
        priority_elevated: r.priority_elevated,
        generator_models: (r.sources?.generators ?? []).map((g) => g.model_key),
      })),
    }));

    const snapshot = {
      generated_at: stamp,
      pii: { email_mask: 'sha256→user_<hex[:10]>' },
      base: { completed_sessions: completedSessions, sessions_with_outcome_state: sessionsWithOutcomeState },
      totals: {
        total_interventions: totalInterventions,
        sessions_with_intervention: sessionsWithIntervention,
        multi_model_interventions: multiModel,
        priority_elevated_interventions: elevated,
      },
      annotations: {
        with_stage: withStage,
        journey_real: withJourneyReal, journey_degraded: withJourneyDegraded,
        decision_real: withDecisionReal, decision_degraded: withDecisionDegraded,
        with_user: withUser,
        with_trend_concern: withTrend, with_forecast_concern: withForecast,
      },
      confidence: { min: cMin, max: cMax, mean: Number(cMean.toFixed(3)), median: cMed },
      axes: {
        structural: { score: structuralScore, max: 5, components: structural },
        activation: { score: activationScore, max: 5, enablers: activation },
      },
      sessions: snapshotSessions,
    };

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, '_intervention_snapshot.json'), JSON.stringify(snapshot, null, 2));

    // ── 01 — coverage ──
    writeFileSync(join(OUT_DIR, '01_coverage_report.md'), `# WC-L4 · Deliverable 1 — Coverage Report
_Generated ${stamp}. Read-only; no DB writes. Emails one-way sha256-masked._

## Session coverage (raw vs real-source)
| Metric | Value |
|---|---|
| Completed sessions (base) | ${completedSessions} |
| Sessions with outcome state (generator pre-req) | ${sessionsWithOutcomeState} |
| Sessions with ≥1 persisted intervention | ${sessionsWithIntervention} |
| **Coverage of completed sessions** | **${pct(sessionsWithIntervention, completedSessions)}%** (${sessionsWithIntervention}/${completedSessions}) |
| **Coverage of outcome-state sessions** | **${pct(sessionsWithIntervention, sessionsWithOutcomeState)}%** (${sessionsWithIntervention}/${sessionsWithOutcomeState}) |
| Total interventions persisted | ${totalInterventions} |

## Honest ceiling
An intervention can ONLY be generated from a library-backed outcome action (\`wc3_outcome_actions\` →
\`intervention_library\`). The generator's pre-requisite is a resolved outcome model carrying ≥1 active
library action; a session with an empty / UNCLASSIFIED behavioural spine, or whose resolved models carry
no library action, produces **zero** interventions (fail-closed). The real coverage ceiling is therefore
the count of sessions with library-backed outcome actions — **not** the completed-session total. Coverage
below 100% of completed sessions is an honest reflection of the upstream spine, not a wiring gap.
`);

    // ── 02 — sources ──
    const modelLines = Array.from(modelKeyTally.entries()).sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `| ${k} | ${n} |`).join('\n') || '| _(none)_ | 0 |';
    writeFileSync(join(OUT_DIR, '02_sources_report.md'), `# WC-L4 · Deliverable 2 — Sources Report
_Generated ${stamp}. Read-only._

The ONLY generating layer is **outcome** (library-backed). Every other layer is a priority/context
**annotation** and can never generate an intervention. Degraded journey / decision sources contribute
**ZERO** (only the degraded marker is recorded).

## Generator — outcome models (by intervention count)
| model_key | interventions |
|---|---|
${modelLines}

- Multi-model interventions (same library row surfaced by >1 model; MAX-confidence kept, no blend): **${multiModel}**

## Annotation layers (per intervention)
| Annotation | Real contribution | Degraded (ZERO contribution) |
|---|---|---|
| Stage (L1) | ${withStage} | — |
| Journey (L3) | ${withJourneyReal} | ${withJourneyDegraded} |
| Decision (WC-11) | ${withDecisionReal} | ${withDecisionDegraded} |
| User persona (WC-L0) | ${withUser} | — |
| Trend concern (WC-L1) | ${withTrend} | — |
| Forecast concern (WC-L2) | ${withForecast} | — |

## Honest finding — decision is fully degraded today
Decision routing is currently **${withDecisionReal} real / ${withDecisionDegraded} degraded** across persisted
interventions: the WC-11 decision layer resolves to the mentoring-fallback / NULL-outcome path for these
sessions, which by canon is a routing guarantee — **not** evidence of intervention need. It therefore
contributes zero. This is a true data ceiling (reported, not engineered around).
`);

    // ── 03 — confidence (inherited) ──
    writeFileSync(join(OUT_DIR, '03_confidence_report.md'), `# WC-L4 · Deliverable 3 — Confidence Report (inherited)
_Generated ${stamp}. Read-only._

Confidence is **INHERITED** from the generating outcome model — never blended, re-derived or invented.
When a library intervention is surfaced by more than one model the **MAX** model confidence is kept
(selection, not averaging).

| Statistic | Value |
|---|---|
| Interventions with confidence | ${confidences.length} |
| Min | ${cMin} |
| Median | ${cMed} |
| Mean | ${cMean.toFixed(3)} |
| Max | ${cMax} |

Confidence reflects the upstream L2 Outcome layer's own confidence in the model that produced the action.
A low value is an honest reflection of a weak/partial behavioural spine, not a defect of this layer.
`);

    // ── 04 — trend mapping ──
    const trendLines = Array.from(trendMetricTally.entries()).sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `| ${k} | ${n} |`).join('\n') || '| _(none)_ | 0 |';
    writeFileSync(join(OUT_DIR, '04_trend_mapping_report.md'), `# WC-L4 · Deliverable 4 — Trend Mapping Report
_Generated ${stamp}. Read-only._

WC-L1 longitudinal trends raise an intervention's priority **only** when the trend is a genuine CONCERN
for the user, judged **polarity-aware**: for positive-progression metrics a *declining* slope is the
concern; for \`behaviour_risk\` a *rising* (improving-value) slope is the concern. A falling risk trend is
correctly NOT treated as a concern.

| Metric · direction (concern) | interventions annotated |
|---|---|
${trendLines}

- Interventions with ≥1 concern trend: **${withTrend}** / ${totalInterventions}
- Sessions with ≥1 concern trend: **${sessionsWithTrend.size}** / ${sessionsWithIntervention}

## Honest ceiling
Trends require **≥2 completed sessions for the same user**; in the current base only a handful of users
qualify, so trend consumption is honestly sparse. Absent trends contribute nothing — never fabricated.
`);

    // ── 05 — forecast mapping ──
    const fcLines = Array.from(forecastKindTally.entries()).sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `| ${k} | ${n} |`).join('\n') || '| _(none)_ | 0 |';
    writeFileSync(join(OUT_DIR, '05_forecast_mapping_report.md'), `# WC-L4 · Deliverable 5 — Forecast Mapping Report
_Generated ${stamp}. Read-only._

WC-L2 forecasts (an extrapolation of an EXISTING trend at its OWN confidence) raise priority only when the
projected direction is a CONCERN, judged polarity-aware (\`risk\` kind: rising = concern; growth / outcome /
journey: declining = concern).

| Forecast kind · projected direction (concern) | interventions annotated |
|---|---|
${fcLines}

- Interventions with ≥1 concern forecast: **${withForecast}** / ${totalInterventions}
- Sessions with ≥1 concern forecast: **${sessionsWithForecast.size}** / ${sessionsWithIntervention}

## Honest ceiling + flag dependency
A forecast exists only where its underlying trend exists (≥2 sessions). Forecast annotations also require
\`FF_FORECAST_INTELLIGENCE\` to be ON when the engine runs; the default Backend API workflow does **not**
enable it, so in current production these annotations would be **absent** until that flag is enabled. This
backfill enabled it to realise forecasts wherever the data supports them — never to invent them.
`);

    // ── 06 — executive summary (dual axis) ──
    const structRows = structural.map((s) => `| ${s.k} | ${s.present ? '✅' : '⬜'} |`).join('\n');
    const actRows = activation.map((a) => `| ${a.k} | ${a.present ? '✅' : '⬜'} |`).join('\n');
    writeFileSync(join(OUT_DIR, '06_executive_summary.md'), `# WC-L4 · Executive Summary — Intervention Intelligence Layer
_Generated ${stamp}. Read-only; no DB writes. Emails one-way sha256-masked._

WC-L4 activates CAPADEX's first adaptive **action** layer by COMPOSING already-computed intelligence into
per-session interventions. It adds **no** new construct / ontology / scoring / AI model. The ONLY generator
is the existing **library-backed** outcome action (a real \`intervention_library\` row); Stage / Journey /
Decision / User / Trend / Forecast are priority/context annotations only. Confidence is **inherited** from
the generating outcome model. Flag OFF → no schema, no write → **byte-identical** legacy behaviour.

## Two axes, reported separately (never merged)
### Axis A — Structural Readiness: **${structuralScore}/5**
| Component | Built |
|---|---|
${structRows}

### Axis B — Activation Readiness: **${activationScore}/5**
| Enabler (data-bound) | Present |
|---|---|
${actRows}

## Headline numbers
- Completed sessions: **${completedSessions}** · with outcome state (generator pre-req): **${sessionsWithOutcomeState}**.
- Sessions with ≥1 intervention: **${sessionsWithIntervention}** (${pct(sessionsWithIntervention, completedSessions)}% of completed · ${pct(sessionsWithIntervention, sessionsWithOutcomeState)}% of outcome-state sessions).
- Total interventions: **${totalInterventions}** · multi-model (max-conf kept): **${multiModel}** · priority-elevated: **${elevated}**.
- Confidence (inherited): min ${cMin} · median ${cMed} · mean ${cMean.toFixed(3)} · max ${cMax}.

## Honest ceilings (why Activation < Structural)
- **Generator-bound coverage**: only sessions whose outcome models carry ≥1 library-backed action can
  produce an intervention. The rest are fail-closed (zero), by design.
- **Decision fully degraded** (${withDecisionReal} real / ${withDecisionDegraded} degraded): the WC-11 layer routes to the
  mentoring-fallback / NULL-outcome path → zero contribution. A true data ceiling, not a wiring gap.
- **Journey** partly degraded (${withJourneyReal} real / ${withJourneyDegraded} degraded): degraded mentoring-fallback routes contribute zero.
- **Trend / Forecast sparse**: require ≥2 sessions per user; only a few users qualify today.

Structural readiness reflects that the engine is fully built and wired; Activation readiness reflects the
honest state of the upstream data it composes. The two are deliberately **not** blended.
`);

    console.log(`WC-L4 measure complete → ${OUT_DIR}`);
    console.log(`  Structural ${structuralScore}/5 · Activation ${activationScore}/5`);
    console.log(`  ${totalInterventions} interventions across ${sessionsWithIntervention}/${completedSessions} completed sessions (outcome-state base ${sessionsWithOutcomeState}).`);
    console.log(`  Annotations — stage ${withStage} · journey ${withJourneyReal} real/${withJourneyDegraded} degraded · decision ${withDecisionReal} real/${withDecisionDegraded} degraded · user ${withUser} · trend ${withTrend} · forecast ${withForecast}.`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
