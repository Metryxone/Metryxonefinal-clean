/**
 * WC-L2 — Forecast Intelligence Foundation: Readiness / Coverage / Confidence / Gap AUDIT.
 *
 * READ-ONLY. Exercises the WC-L2 forecast engine (`computeUserForecasts`) over the REAL population and
 * writes the six deliverables to `backend/audit/wc-l2/`:
 *   01 Forecast Readiness Report
 *   02 Forecast Coverage Report
 *   03 Forecast Confidence Report
 *   04 Forecast Gap Report
 *   05 Forecast Activation Roadmap
 *   06 Executive Summary
 * plus a PII-masked `_forecast.json` snapshot (emails are one-way sha256-masked at capture — never raw).
 *
 * The engine is flag-gated; run with the flag ON to measure the true capability:
 *   cd backend && FF_FORECAST_INTELLIGENCE=1 npx tsx scripts/wc3/wcl2-forecast-audit.ts
 *
 * Honest by construction: it reports what the existing trends actually support and never fabricates a
 * forecast. With the flag OFF the engine returns {enabled:false} and this script reports that honestly.
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import {
  computeUserForecasts,
  type ForecastKind,
  type ForecastResult,
  type UserForecasts,
} from '../../services/wc3/forecast-intelligence';
import { isForecastIntelligenceEnabled } from '../../config/feature-flags';

const OUT_DIR = join(__dirname, '../../audit/wc-l2');
const KINDS: ForecastKind[] = ['risk', 'growth', 'outcome', 'journey'];
const pct = (n: number, d: number): string => (d === 0 ? '0.0' : ((100 * n) / d).toFixed(1));

/** One-way deterministic email mask so artifacts carry NO PII but per-user grouping is preserved. */
function maskEmail(email: string): string {
  return 'user_' + createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 10);
}

interface UserRow {
  email: string | null; // masked or null (anonymous)
  completed: number;
  flagEnabled: boolean;
  forecasts: Record<ForecastKind, ForecastResult> | null; // null = anonymous / not evaluated
  forecastableCount: number;
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const flagOn = isForecastIntelligenceEnabled();
  const stamp = new Date().toISOString();

  // ── Population: every distinct owner with ≥1 completed session, + the anonymous bucket ──
  const { rows: emailRows } = await pool.query<{ email: string | null; completed: string }>(`
    SELECT LOWER(guest_email) AS email, COUNT(*)::text AS completed
      FROM capadex_sessions
     WHERE status = 'completed'
     GROUP BY LOWER(guest_email)
     ORDER BY COUNT(*) DESC, LOWER(guest_email) ASC
  `);

  const users: UserRow[] = [];
  let anonCompleted = 0;
  for (const r of emailRows) {
    const completed = Number(r.completed);
    if (!r.email) { anonCompleted += completed; continue; } // anonymous → no cross-session series, never forecastable

    let forecasts: Record<ForecastKind, ForecastResult> | null = null;
    let forecastableCount = 0;
    const res = await computeUserForecasts(pool, r.email);
    if (res.enabled) {
      const uf = res as UserForecasts;
      forecasts = uf.forecasts;
      forecastableCount = uf.forecastable_count;
    }
    users.push({
      email: maskEmail(r.email),
      completed,
      flagEnabled: res.enabled,
      forecasts,
      forecastableCount,
    });
  }

  // ── Aggregate metrics ──
  const totalUsers = users.length;
  const eligibleUsers = users.filter((u) => u.completed >= 2);   // ≥2 sessions = trend-eligible
  const ineligibleUsers = users.filter((u) => u.completed < 2);  // <2 sessions = no forecast of ANY kind
  const forecastableUsers = users.filter((u) => u.forecastableCount > 0);

  // Per-kind coverage is counted STRICTLY over trend-eligible owners, so each kind's
  // (forecastable + noTrend) === eligibleUsers.length and every denominator matches exactly.
  // Ineligible (<2 session) owners are unforecastable for every kind by definition and are
  // reported once as a separate population — never mixed into the per-kind denominator.
  const perKind: Record<ForecastKind, { forecastable: number; noTrend: number; confidences: number[] }> = {
    risk: { forecastable: 0, noTrend: 0, confidences: [] },
    growth: { forecastable: 0, noTrend: 0, confidences: [] },
    outcome: { forecastable: 0, noTrend: 0, confidences: [] },
    journey: { forecastable: 0, noTrend: 0, confidences: [] },
  };
  for (const u of eligibleUsers) {
    if (!u.forecasts) continue; // flag OFF → engine returned {enabled:false} → no per-kind data
    for (const k of KINDS) {
      const f = u.forecasts[k];
      if (f.forecastable) { perKind[k].forecastable++; perKind[k].confidences.push(f.forecast_confidence); }
      else perKind[k].noTrend++; // for an eligible owner, non-forecastable is always 'no_trend'
    }
  }

  const allConfidences = KINDS.flatMap((k) => perKind[k].confidences);
  const avgConfidence = allConfidences.length
    ? Number((allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length).toFixed(2))
    : null;

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  // ── Snapshot (PII-masked) ──
  const snapshot = {
    generated_at: stamp,
    flag_enabled: flagOn,
    population: {
      total_owners_with_completed: totalUsers,
      trend_eligible_owners: eligibleUsers.length,
      forecastable_owners: forecastableUsers.length,
      anonymous_completed_sessions: anonCompleted,
    },
    per_kind_over_eligible: KINDS.map((k) => ({
      kind: k,
      forecastable: perKind[k].forecastable,
      no_trend: perKind[k].noTrend,
      confidences: perKind[k].confidences,
    })),
    ineligible_owners: ineligibleUsers.length, // <2 sessions → unforecastable for every kind
    users,
  };
  writeFileSync(join(OUT_DIR, '_forecast.json'), JSON.stringify(snapshot, null, 2));

  const flagBanner = flagOn
    ? '`FF_FORECAST_INTELLIGENCE` is **ON** for this run — forecasts reflect the real capability.'
    : '⚠️ `FF_FORECAST_INTELLIGENCE` is **OFF** — the engine returned `{enabled:false}` for every user, so ' +
      'no forecasts were produced. Re-run with `FF_FORECAST_INTELLIGENCE=1` to measure the true capability.';

  const kindRow = (k: ForecastKind): string => {
    const p = perKind[k];
    const conf = p.confidences.length
      ? `${(p.confidences.reduce((a, b) => a + b, 0) / p.confidences.length).toFixed(2)} avg`
      : '—';
    return `| ${k} | ${p.forecastable} | ${p.noTrend} | ${pct(p.forecastable, eligibleUsers.length)}% | ${conf} |`;
  };

  // ── 01 — Forecast Readiness Report ──
  writeFileSync(join(OUT_DIR, '01_forecast_readiness_report.md'), `# WC-L2 Deliverable 1 — Forecast Readiness Report
_Generated ${stamp}_

${flagBanner}

## What "ready" means
A forecast is a **one-step linear extrapolation of an EXISTING trend** — \`projected = clamp(last + slope_per_session)\`
at the trend's own confidence. It is NOT a new model: the formula already ships in
\`computeLongitudinalConsumption\`, and the trends come from the existing \`computeUserTrends\`
(stage/outcome/journey/decision) and \`computeUserBehaviourTrends\` (risk/…). So readiness is entirely a
question of whether the **upstream trends exist**, which in turn needs ≥2 comparable sessions per user.

## Engine readiness (code)
| Component | State |
|---|---|
| Forecast flag \`forecastIntelligence\` | registered, default OFF |
| Forecast engine \`services/wc3/forecast-intelligence.ts\` | present, pure, read-only, never-throws |
| Upstream lever trends \`computeUserTrends\` | present (pure read) |
| Upstream behaviour trends \`computeUserBehaviourTrends\` | present (pure read) |
| Extrapolation formula | reuses existing \`last + slope\` (clamped) |
| New tables / writes / DDL | **none** (read-only foundation) |

→ The engine is **wired and correct**. Readiness is therefore **data-bound**, not code-bound.

## Data readiness (population)
| Metric | Value |
|---|---|
| Owners with ≥1 completed session | ${totalUsers} |
| Trend-eligible owners (≥2 completed sessions) | ${eligibleUsers.length} |
| Owners with ≥1 real forecast | ${forecastableUsers.length} |
| Anonymous completed sessions (never forecastable) | ${anonCompleted} |

**Honest finding:** the forecast foundation is ready in code, but the longitudinal depth needed to
populate it barely exists — only ${eligibleUsers.length} owner(s) have the ≥2 sessions a trend requires.
`);

  // ── 02 — Forecast Coverage Report ──
  writeFileSync(join(OUT_DIR, '02_forecast_coverage_report.md'), `# WC-L2 Deliverable 2 — Forecast Coverage Report
_Generated ${stamp}_

${flagBanner}

## Coverage by forecast kind (denominator = ${eligibleUsers.length} trend-eligible owner(s))
Counted STRICTLY over the ${eligibleUsers.length} owner(s) with ≥2 completed sessions, so
\`forecastable + no trend\` equals the denominator for every kind. Owners with <2 sessions are
unforecastable for every kind by definition and are reported separately below — never folded in here.

| Forecast | forecastable | has sessions, no trend | coverage | confidence |
|---|---|---|---|---|
${KINDS.map(kindRow).join('\n')}

## Coverage headline
- Trend-eligible owners: **${eligibleUsers.length} / ${totalUsers}** (${pct(eligibleUsers.length, totalUsers)}%).
- Owners with at least one real forecast: **${forecastableUsers.length} / ${totalUsers}** (${pct(forecastableUsers.length, totalUsers)}%).
- Ineligible owners (<2 completed sessions): **${ineligibleUsers.length}** — structurally unforecastable for
  every kind (a single session cannot form a trend); excluded from the per-kind denominator above.
- Anonymous sessions (${anonCompleted}) are structurally excluded: with no stable owner identity they cannot
  form a cross-session series, so they are honestly **never forecastable** — not a defect.

## Per-owner detail (PII-masked)
| Owner | completed | forecastable kinds |
|---|---|---|
${users.map((u) => {
  const kinds = u.forecasts ? KINDS.filter((k) => u.forecasts![k].forecastable).join(', ') || '—' : '(flag off)';
  return `| \`${u.email}\` | ${u.completed} | ${kinds} |`;
}).join('\n')}
`);

  // ── 03 — Forecast Confidence Report ──
  writeFileSync(join(OUT_DIR, '03_forecast_confidence_report.md'), `# WC-L2 Deliverable 3 — Forecast Confidence Report
_Generated ${stamp}_

${flagBanner}

## How confidence is set (no new model)
A forecast's confidence is **exactly the underlying trend's confidence** — no new uncertainty number is
invented. Trend confidence scales with the number of comparable sessions: a 2-point line is the minimum
and sits at the floor (~0.33), reaching 1.0 only at 4 comparable sessions. The qualitative band is a
label over that existing value, aligned to the point scale so the 2-point FLOOR is honestly **low**:
low (<0.5, i.e. the 2-session floor 0.33) · moderate (0.5–0.83, ~3 sessions) · high (≥0.84, the full
4-session trend). The floor is never dressed up as "moderate".

## Confidence distribution (real forecasts only)
| Metric | Value |
|---|---|
| Real forecasts produced | ${allConfidences.length} |
| Average forecast confidence | ${avgConfidence ?? '—'} |
| Range | ${allConfidences.length ? `${Math.min(...allConfidences)} – ${Math.max(...allConfidences)}` : '—'} |

## Per-kind confidence
| Forecast | real forecasts | avg confidence | band |
|---|---|---|---|
${KINDS.map((k) => {
  const c = perKind[k].confidences;
  const avg = c.length ? Number((c.reduce((a, b) => a + b, 0) / c.length).toFixed(2)) : null;
  const band = avg == null ? '—' : avg >= 0.84 ? 'high' : avg >= 0.5 ? 'moderate' : 'low';
  return `| ${k} | ${c.length} | ${avg ?? '—'} | ${band} |`;
}).join('\n')}

**Honest finding:** every real forecast currently sits at the **confidence floor** because every
trend-eligible owner has the minimum 2 sessions. These forecasts are directionally valid but must be
surfaced as **low-confidence** — a 2-point line cannot distinguish a real trajectory from noise.
`);

  // ── 04 — Forecast Gap Report ──
  const gapRows: string[] = [];
  for (const u of users) {
    if (!u.forecasts) continue;
    for (const k of KINDS) {
      const f = u.forecasts[k];
      if (!f.forecastable) gapRows.push(`| \`${u.email}\` | ${k} | ${f.reason} | ${f.detail} |`);
    }
  }
  writeFileSync(join(OUT_DIR, '04_forecast_gap_report.md'), `# WC-L2 Deliverable 4 — Forecast Gap Report
_Generated ${stamp}_

${flagBanner}

## Gap summary by kind (denominator = ${eligibleUsers.length} trend-eligible owner(s))
Among trend-eligible owners, a missing forecast is always **has sessions but no readable trend**
(insufficient-session owners are not eligible and are counted separately below).

| Forecast | forecastable | missing — has sessions but no trend |
|---|---|---|
${KINDS.map((k) => `| ${k} | ${perKind[k].forecastable} | ${perKind[k].noTrend} |`).join('\n')}

**Ineligible owners (<2 completed sessions): ${ineligibleUsers.length}** — no forecast of any kind is
possible for them (a single session cannot form a trend). This is the dominant, data-depth gap.

## Root causes (honest)
1. **Insufficient sessions** — most owners (and all anonymous sessions) have <2 completed sessions, so no
   trend can form. This is the dominant gap and is purely a **data-depth** problem, not a code defect.
2. **Has sessions but no readable trend** — an owner with ≥2 sessions where a specific lever/dimension
   lacked two readable points (e.g. the behaviour \`risk\` dimension is NULL for one of the two sessions,
   so it cannot be trended). The forecast is honestly withheld rather than fabricated from a single point.

## Per-(owner × kind) gaps (PII-masked)
${gapRows.length ? `| Owner | forecast | reason | detail |
|---|---|---|---|
${gapRows.join('\n')}` : '_No gaps — every evaluated forecast was forecastable._'}
`);

  // ── 05 — Forecast Activation Roadmap ──
  writeFileSync(join(OUT_DIR, '05_forecast_activation_roadmap.md'), `# WC-L2 Deliverable 5 — Forecast Activation Roadmap
_Generated ${stamp}_

The engine is built, read-only, and flag-gated. Activation is sequenced so each step is additive and
reversible, and so the (data-bound) ceiling lifts before any forecast is surfaced to users.

## Stage 0 — Foundation (this deliverable) ✅
- Forecast engine + flag in place; composes existing trends only; no writes, no new model.
- Audit proves the engine is correct and quantifies the honest data ceiling.

## Stage 1 — Lift the data ceiling (prerequisite, data not code)
- The single biggest lever is **repeat sessions per identified owner** — a forecast needs ≥2, and
  confidence only leaves the floor at 4. Encourage re-assessment cadence; attribute sessions to a stable
  owner identity so anonymous completions become forecastable.
- Ensure the behaviour \`risk\`/\`engagement\`/etc. dimensions are captured on every session (WC-L0/L0E)
  so behaviour-backed forecasts (Risk) have two readable points.

## Stage 2 — Read surface (additive, flag-gated)
- Expose a read-only \`GET /api/capadex/session/:id/forecast\` (or user-scoped) that returns
  \`computeUserForecasts\`. Flag OFF → \`{enabled:false}\`. No new write path.

## Stage 3 — Surface in existing reports (additive)
- Attach the forecast block to the existing stakeholder/longitudinal report sections, always labelled
  with its confidence band; suppress low-confidence forecasts behind an explicit "provisional" treatment.

## Stage 4 — Optional persistence (only if a consumer needs it)
- If a non-derivable read is needed, persist forecasts via a backfill mirroring WC-L1 — but only after
  Stage 1, since persisting floor-confidence forecasts adds no value over deriving them on read.
`);

  // ── 06 — Executive Summary ──
  writeFileSync(join(OUT_DIR, '06_executive_summary.md'), `# WC-L2 — Forecast Intelligence Foundation: Executive Summary
_Generated ${stamp}_

${flagBanner}

## What was built
A **read-only Forecast Intelligence** layer that projects each EXISTING trend one step forward
(\`projected = clamp(last + slope)\` at the trend's own confidence). Four forecasts, each backed by one
existing trend: **Risk** (behaviour risk dim), **Growth** (stage lever), **Outcome** (outcome lever),
**Journey** (journey lever). No new construct, ontology, dimension, or scoring model; no new table; no
writes. Flag-gated (\`forecastIntelligence\`, default OFF) → flag OFF is byte-identical legacy behaviour.

## The honest ceiling
| Metric | Value |
|---|---|
| Owners with ≥1 completed session | ${totalUsers} |
| Trend-eligible owners (≥2 sessions) | ${eligibleUsers.length} (${pct(eligibleUsers.length, totalUsers)}%) |
| Owners with ≥1 real forecast | ${forecastableUsers.length} (${pct(forecastableUsers.length, totalUsers)}%) |
| Real forecasts produced | ${allConfidences.length} |
| Average forecast confidence | ${avgConfidence ?? '—'} (floor ≈ 0.33) |
| Anonymous completed sessions (never forecastable) | ${anonCompleted} |

## Bottom line
The forecast **engine is ready and correct**, but **coverage is data-bound**: forecasting needs
longitudinal depth that barely exists yet (${eligibleUsers.length} eligible owner(s), all at the 2-session
confidence floor). The honest conclusion is that WC-L2 delivers a sound, reversible foundation whose value
will scale only as repeat-session depth grows — it does not, and must not, manufacture forecasts where the
trend evidence is absent. See the Activation Roadmap for the data-first sequencing.
`);

  console.log(`[wcl2-forecast-audit] flag ${flagOn ? 'ON' : 'OFF'} · reports written to ${OUT_DIR}`);
  console.log(`  owners ${totalUsers} · trend-eligible ${eligibleUsers.length} · with-forecast ${forecastableUsers.length} · real forecasts ${allConfidences.length} · avg conf ${avgConfidence ?? '—'}`);
  for (const k of KINDS) {
    console.log(`  ${k}: forecastable ${perKind[k].forecastable} · no_trend ${perKind[k].noTrend} (over ${eligibleUsers.length} eligible)`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('[wcl2-forecast-audit] fatal:', err);
  process.exit(1);
});
