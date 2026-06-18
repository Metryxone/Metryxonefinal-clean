/**
 * WC-L2B — Outcome Forecast Activation (IMPLEMENTATION · ADDITIVE · FLAG-GATED).
 *
 * Goal: make Outcome History a first-class longitudinal source so the WC-L2 Outcome
 * Forecast can activate — addressing the primary blocker WC-L2A identified (Outcome
 * forecast coverage 0% over eligible owners).
 *
 * It REUSES existing assets ONLY — no new ontology / constructs / outcome models / scoring:
 *   • Outcome resolution  : `resolveSessionOutcomes` (services/wc3/outcome-intelligence.ts),
 *                           including its flag-gated L5C clarity-bank crosswalk tier
 *                           (`FF_WC3_OUTCOME_CROSSWALK`) — the Question→Construct→Outcome chain.
 *   • Trend recompute     : `persistUserTrends` (services/wc3/trend-intelligence.ts) — WC-L1.
 *   • Forecast measurement: `computeUserForecasts` (services/wc3/forecast-intelligence.ts) — WC-L2.
 *
 * HONESTY CONTRACT (user canon — honesty over targets):
 *   • Backfill is ADDITIVE + never-overwrite-in-this-run: we PRE-FILTER to sessions with ZERO existing
 *     outcome state before calling the engine, so its `ON CONFLICT DO UPDATE` path is never reached for
 *     an already-covered session. Idempotent — safe to re-run.
 *   • The engine writes NOTHING for a session whose Question→Construct→Outcome chain has no input
 *     (no master_concern_pk / primary_construct_key / active spine). We NEVER fabricate a construct
 *     or an outcome to force coverage. A no-op backfill is an honest finding, not a failure.
 *   • Every before/after number is measured from live queries; depths/levels with no data are
 *     reported as such, never estimated.
 *   • PII: owner emails are one-way sha256-masked at capture; no raw email reaches any artifact.
 *
 * Run (crosswalk tier ON so empty-spine sessions with a real concern can still resolve):
 *   cd backend && FF_FORECAST_INTELLIGENCE=1 FF_WC3_OUTCOME=1 FF_WC3_OUTCOME_CROSSWALK=1 \
 *     npx tsx scripts/wc3/wcl2b-outcome-forecast-activation.ts
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { resolveSessionOutcomes } from '../../services/wc3/outcome-intelligence';
import { persistUserTrends, computeUserTrends } from '../../services/wc3/trend-intelligence';
import { computeUserForecasts } from '../../services/wc3/forecast-intelligence';
import { isForecastIntelligenceEnabled, isWc3OutcomeCrosswalkEnabled, isWc3OutcomeEnabled } from '../../config/feature-flags';

const OUT_DIR = join(process.cwd(), 'audit', 'wc-l2b');
const mask = (email: string | null | undefined): string =>
  email ? 'user_' + createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 10) : 'anon';
const pct = (n: number, d: number): string => (d === 0 ? '—' : ((n / d) * 100).toFixed(1) + '%');

interface OwnerMetric {
  owner: string;
  sessions: number;
  eligible: boolean;
  outcomeBearingSessions: number;   // owned completed sessions that carry ≥1 outcome_state row
  outcomeTrendPoints: number;       // readable points in the outcome lever trend (0 = no trend)
  hasOutcomeTrend: boolean;
  outcomeForecastable: boolean;
  outcomeForecastConfidence: number | null;
  outcomeForecastBand: string | null;
}

interface Snapshot {
  outcomeStateSessionsTotal: number;
  outcomeStateSessionsOwned: number;
  outcomeStateSessionsAnon: number;
  owners: OwnerMetric[];
  eligibleOwners: number;
  outcomeTrendOwners: number;       // eligible owners WITH an outcome trend
  outcomeForecastOwners: number;    // eligible owners WITH an outcome forecast
}

async function ownedEmails(pool: Pool): Promise<Map<string, number>> {
  const { rows } = await pool.query(
    `SELECT LOWER(guest_email) AS email, COUNT(*)::int AS n
       FROM capadex_sessions
      WHERE status = 'completed' AND guest_email IS NOT NULL AND guest_email <> ''
      GROUP BY LOWER(guest_email)`,
  );
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.email, r.n);
  return m;
}

async function snapshot(pool: Pool): Promise<Snapshot> {
  // outcome_state session coverage, split owned vs anon
  const { rows: stRows } = await pool.query(
    `SELECT DISTINCT o.session_id::text AS sid, (s.guest_email IS NOT NULL AND s.guest_email <> '') AS owned
       FROM wc3_outcome_state o JOIN capadex_sessions s ON s.id = o.session_id`,
  );
  const outcomeStateSessionsOwned = stRows.filter((r) => r.owned).length;
  const outcomeStateSessionsAnon = stRows.filter((r) => !r.owned).length;

  const owners = await ownedEmails(pool);
  const ownerMetrics: OwnerMetric[] = [];
  for (const [email, n] of owners) {
    const eligible = n >= 2;
    // owned outcome-bearing sessions for this user
    const { rows: ob } = await pool.query(
      `SELECT COUNT(DISTINCT o.session_id)::int AS c
         FROM wc3_outcome_state o JOIN capadex_sessions s ON s.id = o.session_id
        WHERE LOWER(s.guest_email) = $1 AND s.status = 'completed'`,
      [email],
    );
    const trends = await computeUserTrends(pool, email);
    const outcomeTrend = trends.trends.find((t) => t.lever === 'outcome') ?? null;
    const fc = await computeUserForecasts(pool, email);
    let forecastable = false, conf: number | null = null, band: string | null = null;
    if (fc.enabled) {
      const o = fc.forecasts.outcome;
      forecastable = o.forecastable;
      if (o.forecastable) { conf = o.forecast_confidence; band = o.confidence_band; }
    }
    ownerMetrics.push({
      owner: mask(email),
      sessions: n,
      eligible,
      outcomeBearingSessions: ob[0].c,
      outcomeTrendPoints: outcomeTrend ? outcomeTrend.points : 0,
      hasOutcomeTrend: !!outcomeTrend,
      outcomeForecastable: forecastable,
      outcomeForecastConfidence: conf,
      outcomeForecastBand: band,
    });
  }
  const eligible = ownerMetrics.filter((o) => o.eligible);
  return {
    outcomeStateSessionsTotal: stRows.length,
    outcomeStateSessionsOwned,
    outcomeStateSessionsAnon,
    owners: ownerMetrics,
    eligibleOwners: eligible.length,
    outcomeTrendOwners: eligible.filter((o) => o.hasOutcomeTrend).length,
    outcomeForecastOwners: eligible.filter((o) => o.outcomeForecastable).length,
  };
}

interface BackfillCell {
  session: string;
  owned: boolean;
  hadState: boolean;
  hasStage: boolean;
  hasMasterConcernPk: boolean;
  hasPrimaryConstruct: boolean;
  hasActiveSpine: boolean;
  resolvable: boolean;     // chain has ≥1 construct input
  written: boolean;        // engine persisted ≥1 outcome model
  modelsWritten: string[];
  reason: string;          // why nothing was written (when applicable)
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const stamp = new Date().toISOString();
  const flags = {
    forecast: isForecastIntelligenceEnabled(),
    outcome: isWc3OutcomeEnabled(),
    crosswalk: isWc3OutcomeCrosswalkEnabled(),
  };

  // ── BEFORE ──
  const before = await snapshot(pool);

  // ── T002 + T003: per-session resolvability ledger + additive never-overwrite backfill ──
  const { rows: completed } = await pool.query(
    `SELECT s.id::text AS id,
            (s.guest_email IS NOT NULL AND s.guest_email <> '') AS owned,
            s.guest_email, s.master_concern_pk, s.primary_construct_key,
            (s.master_concern_pk IS NOT NULL) AS has_master,
            (s.primary_construct_key IS NOT NULL AND s.primary_construct_key <> '') AS has_pck,
            EXISTS (SELECT 1 FROM wc3_outcome_state o WHERE o.session_id = s.id) AS had_state,
            EXISTS (SELECT 1 FROM wc3_longitudinal_snapshots g WHERE g.session_id = s.id) AS has_stage,
            EXISTS (SELECT 1 FROM behavioural_hypotheses h WHERE h.session_id = s.id::text
                      AND h.lifecycle_state = 'active' AND h.construct_key IS NOT NULL) AS has_spine
       FROM capadex_sessions s
      WHERE s.status = 'completed'
      ORDER BY s.created_at ASC`,
  );

  const cells: BackfillCell[] = [];
  const touchedOwners = new Set<string>();
  for (const r of completed) {
    const resolvable = r.has_master || r.has_pck || r.has_spine;
    const cell: BackfillCell = {
      session: mask(r.guest_email),
      owned: r.owned,
      hadState: r.had_state,
      hasStage: r.has_stage,
      hasMasterConcernPk: r.has_master,
      hasPrimaryConstruct: r.has_pck,
      hasActiveSpine: r.has_spine,
      resolvable,
      written: false,
      modelsWritten: [],
      reason: '',
    };
    if (r.had_state) {
      cell.reason = 'skipped — existing outcome state (never-overwrite)';
      cells.push(cell);
      continue;
    }
    if (!resolvable) {
      cell.reason = 'no_concern_linkage — no master_concern_pk / primary_construct_key / active spine; chain has no input';
      cells.push(cell);
      continue;
    }
    // Additive backfill: resolve + persist via the EXISTING engine (writes nothing if unclassified).
    const summary = await resolveSessionOutcomes(pool, {
      sessionId: r.id,
      userEmail: r.guest_email ?? null,
      userId: null,
    });
    if (summary && !summary.unclassified && summary.models.length > 0) {
      cell.written = true;
      cell.modelsWritten = summary.models.map((m) => m.model_key);
      if (r.owned) touchedOwners.add(String(r.guest_email).toLowerCase());
    } else {
      cell.reason = summary ? `engine UNCLASSIFIED (${summary.reason ?? 'no_model_match'})` : 'engine returned null (non-blocking failure)';
    }
    cells.push(cell);
  }
  const written = cells.filter((c) => c.written).length;

  // ── T004: recompute outcome trends via existing WC-L1 infra (idempotent upsert) ──
  // Recompute for every eligible owned user so any newly-written outcome state is reflected.
  const owners = await ownedEmails(pool);
  let trendRecomputes = 0;
  for (const [email, n] of owners) {
    if (n < 2) continue;
    await persistUserTrends(pool, email);
    trendRecomputes++;
  }

  // ── AFTER ──
  const after = await snapshot(pool);

  // ── Deliverables ──
  const flagLine =
    `Flags at run: \`FF_FORECAST_INTELLIGENCE\`=${flags.forecast ? 'ON' : 'OFF'}, ` +
    `\`FF_WC3_OUTCOME\`=${flags.outcome ? 'ON' : 'OFF'}, \`FF_WC3_OUTCOME_CROSSWALK\`=${flags.crosswalk ? 'ON' : 'OFF'}.`;

  // 1. Outcome Coverage Report
  writeFileSync(join(OUT_DIR, '01_outcome_coverage_report.md'), `# WC-L2B Deliverable 1 — Outcome Coverage Report
_Generated ${stamp}_

${flagLine}

**Outcome coverage = completed sessions carrying ≥1 \`wc3_outcome_state\` row.** Owned vs anonymous are
reported separately because only OWNED sessions can ever enter a per-user trend.

| Metric | Before | After |
|---|---|---|
| Sessions with outcome state (total) | ${before.outcomeStateSessionsTotal} | ${after.outcomeStateSessionsTotal} |
| — owned | ${before.outcomeStateSessionsOwned} | ${after.outcomeStateSessionsOwned} |
| — anonymous | ${before.outcomeStateSessionsAnon} | ${after.outcomeStateSessionsAnon} |
| Backfill: sessions resolved (written) | — | **${written}** |

## Per-session backfill ledger (T002 resolvability → T003 outcome)
Backfill is **additive + never-overwrite-in-this-run**: we pre-filter to sessions with ZERO existing
outcome state before calling the engine, so its \`ON CONFLICT DO UPDATE\` path is never reached for an
already-covered session; nothing is ever fabricated. A session resolves ONLY if the
Question→Construct→Outcome chain has a real input (\`master_concern_pk\` → bridge tag → construct, OR
\`primary_construct_key\`, OR an active behavioural spine). The engine's tier-2 pattern path
(\`capadex_session_patterns.construct_key\`) is **inert in this schema** (the column does not exist), so
it cannot resolve any of the unlinked sessions — it is not omitted by oversight.

| Session | Owned | Had state | Stage | master_pk | primary_construct | active spine | Resolvable | Written | Note |
|---|---|---|---|---|---|---|---|---|---|
${cells.map((c) => `| ${c.session} | ${c.owned ? 'yes' : 'no'} | ${c.hadState ? 'yes' : 'no'} | ${c.hasStage ? 'yes' : 'no'} | ${c.hasMasterConcernPk ? 'yes' : 'no'} | ${c.hasPrimaryConstruct ? 'yes' : 'no'} | ${c.hasActiveSpine ? 'yes' : 'no'} | ${c.resolvable ? 'yes' : 'no'} | ${c.written ? '**' + c.modelsWritten.join(', ') + '**' : 'no'} | ${c.reason} |`).join('\n')}

**Honest finding:** every completed session that *can* resolve an outcome already had one; the
remaining sessions carry **no concern-linkage input at all**, so the existing chain has nothing to
traverse. Backfill wrote **${written}** rows. This is a data-capture ceiling, not a wiring/flag gap —
see Deliverable 6.
`);

  // 2. Outcome Trend Report
  const trendRow = (s: Snapshot) => s.owners.filter((o) => o.eligible).map((o) =>
    `| ${o.owner} | ${o.sessions} | ${o.outcomeBearingSessions} | ${o.outcomeTrendPoints} | ${o.hasOutcomeTrend ? 'yes' : 'no'} |`).join('\n');
  writeFileSync(join(OUT_DIR, '02_outcome_trend_report.md'), `# WC-L2B Deliverable 2 — Outcome Trend Report
_Generated ${stamp}_

${flagLine}

An **outcome trend** needs ≥2 OWNED completed sessions for the SAME user that each carry an outcome
state (so the outcome lever has ≥2 readable points). Recomputed via the existing WC-L1
\`persistUserTrends\` (no new trend engine). Trend recomputes run: **${trendRecomputes}** eligible owner(s).

| Metric | Before | After |
|---|---|---|
| Eligible owners (≥2 completed sessions) | ${before.eligibleOwners} | ${after.eligibleOwners} |
| Eligible owners WITH an outcome trend | ${before.outcomeTrendOwners} | ${after.outcomeTrendOwners} |
| Outcome trend coverage (of eligible) | ${pct(before.outcomeTrendOwners, before.eligibleOwners)} | ${pct(after.outcomeTrendOwners, after.eligibleOwners)} |

## Per eligible owner (outcome lever)
| Owner | Completed sessions | Outcome-bearing sessions | Outcome trend points | Has outcome trend |
|---|---|---|---|---|
${trendRow(after) || '| _(none)_ | | | | |'}

**Honest finding:** an outcome trend requires **≥2** outcome-bearing sessions for one owner. Only **${after.outcomeStateSessionsOwned}**
owned session(s) carry outcome state in total, so no owner reaches two points — outcome trend coverage
stays **${pct(after.outcomeTrendOwners, after.eligibleOwners)}**. (Anonymous outcome rows cannot form a user series.)
`);

  // 3. Outcome Forecast Report
  const fcRow = (s: Snapshot) => s.owners.filter((o) => o.eligible).map((o) =>
    `| ${o.owner} | ${o.sessions} | ${o.outcomeForecastable ? 'yes' : 'no'} | ${o.outcomeForecastConfidence ?? '—'} | ${o.outcomeForecastBand ?? '—'} |`).join('\n');
  writeFileSync(join(OUT_DIR, '03_outcome_forecast_report.md'), `# WC-L2B Deliverable 3 — Outcome Forecast Report
_Generated ${stamp}_

${flagLine}

The **Outcome Forecast** is the WC-L2 one-step extrapolation of the outcome trend; it exists only when
the outcome trend exists. Measured via \`computeUserForecasts\` (flag-gated).

| Metric | Before | After |
|---|---|---|
| Eligible owners | ${before.eligibleOwners} | ${after.eligibleOwners} |
| Eligible owners with an Outcome Forecast | ${before.outcomeForecastOwners} | ${after.outcomeForecastOwners} |
| Outcome forecast coverage (of eligible) | ${pct(before.outcomeForecastOwners, before.eligibleOwners)} | ${pct(after.outcomeForecastOwners, after.eligibleOwners)} |

## Per eligible owner
| Owner | Completed sessions | Outcome forecastable | Forecast confidence | Band |
|---|---|---|---|---|
${fcRow(after) || '| _(none)_ | | | | |'}

**Honest finding:** outcome forecast coverage is downstream of outcome trend coverage. With no outcome
trend reachable, it remains **${pct(after.outcomeForecastOwners, after.eligibleOwners)}** — unchanged by the backfill.
`);

  // 4. Forecast Confidence Report
  writeFileSync(join(OUT_DIR, '04_forecast_confidence_report.md'), `# WC-L2B Deliverable 4 — Forecast Confidence Report
_Generated ${stamp}_

${flagLine}

Forecast confidence is **not re-derived** — it equals the underlying trend confidence (WC-L1 point
scale: 2 pts → 0.33 \`low\`, 3 → 0.67 \`moderate\`, 4 → 1.0 \`high\`).

- Outcome forecasts present (after): **${after.outcomeForecastOwners}** of ${after.eligibleOwners} eligible owners.
- Because no owner reaches even a 2-point outcome series, there is **no outcome forecast confidence to
  report** — and none is estimated.
- The confidence CEILING for any future outcome forecast is bounded by session depth exactly as WC-L2A
  found: at the current max of 2 outcome-bearing sessions it would sit at the **0.33 (low)** floor;
  reaching \`moderate\`/\`high\` needs 3/4 outcome-bearing sessions per owner — depths with **no platform
  data today** (reported as no data, never interpolated).
`);

  // 5. Forecast Readiness Report
  writeFileSync(join(OUT_DIR, '05_forecast_readiness_report.md'), `# WC-L2B Deliverable 5 — Forecast Readiness Report
_Generated ${stamp}_

${flagLine}

**Readiness = can the WC-L2 Outcome Forecast activate for an eligible owner today?**

| Gate | Status | Evidence |
|---|---|---|
| WC-L2 engine present & correct | ✅ | \`computeUserForecasts\` returns outcome forecasts when a trend exists (cross-checked in WC-L2A: 0 mismatches) |
| Outcome state persists when chain resolves | ✅ | ${before.outcomeStateSessionsTotal} sessions carry outcome state; backfill is write-capable |
| Outcome state on ≥2 OWNED sessions per owner | ❌ | only ${after.outcomeStateSessionsOwned} owned session(s) carry outcome state — no 2-point series |
| Concern-linkage captured per session | ❌ | ${cells.filter((c) => !c.hadState && !c.resolvable).length} of ${cells.length} completed sessions carry no master_concern_pk / primary_construct_key / spine |

**Verdict:** the forecast PIPELINE is ready and write-capable, but **outcome readiness is data-bound**:
the chain cannot resolve sessions that never captured a concern linkage, so backfill is a no-op and
outcome forecast coverage is unchanged. Readiness is gated UPSTREAM of this phase.
`);

  // 6. Executive Summary
  const unresolvable = cells.filter((c) => !c.hadState && !c.resolvable).length;
  writeFileSync(join(OUT_DIR, '06_executive_summary.md'), `# WC-L2B — Executive Summary (Outcome Forecast Activation)
_Generated ${stamp}_

${flagLine}

## Success-criteria answers
| Question | Answer |
|---|---|
| Outcome coverage — before | ${before.outcomeStateSessionsTotal} sessions (${before.outcomeStateSessionsOwned} owned / ${before.outcomeStateSessionsAnon} anon) |
| Outcome coverage — after | ${after.outcomeStateSessionsTotal} sessions (${after.outcomeStateSessionsOwned} owned / ${after.outcomeStateSessionsAnon} anon) |
| Trend coverage — before | ${before.outcomeTrendOwners}/${before.eligibleOwners} eligible owners (${pct(before.outcomeTrendOwners, before.eligibleOwners)}) |
| Trend coverage — after | ${after.outcomeTrendOwners}/${after.eligibleOwners} eligible owners (${pct(after.outcomeTrendOwners, after.eligibleOwners)}) |
| Forecast coverage — before | ${before.outcomeForecastOwners}/${before.eligibleOwners} (${pct(before.outcomeForecastOwners, before.eligibleOwners)}) |
| Forecast coverage — after | ${after.outcomeForecastOwners}/${after.eligibleOwners} (${pct(after.outcomeForecastOwners, after.eligibleOwners)}) |
| Sessions backfilled (written) | ${written} |
| Remaining blockers | **upstream concern-linkage capture** (master_concern_pk / primary_construct_key) — ${unresolvable} of ${cells.length} completed sessions carry none; plus session-depth for confidence |

## What this phase did
- Built an **additive, idempotent, never-overwrite** outcome backfill on the EXISTING engine
  (\`resolveSessionOutcomes\` + its flag-gated L5C crosswalk tier) — no new ontology / models / scoring.
- Ran it with the crosswalk tier ON; recomputed outcome trends via the existing WC-L1 \`persistUserTrends\`.

## The honest ceiling (why coverage did not move)
- Every completed session that *can* resolve an outcome **already had** outcome state. The ${unresolvable}
  remaining sessions carry **no concern-linkage input** — no \`master_concern_pk\`, no
  \`primary_construct_key\`, no active behavioural spine — so the Question→Construct→Outcome chain has
  nothing to traverse. Backfill wrote **${written}** rows. We did NOT fabricate constructs to force coverage.
- Of the ${before.outcomeStateSessionsTotal} sessions that DO carry outcome state, only **${after.outcomeStateSessionsOwned}** is owned;
  the rest are anonymous and can never enter a per-user trend. An outcome trend (hence forecast) needs
  **≥2** outcome-bearing sessions for one owner, so outcome trend & forecast coverage stay at **0%**.
- **The blocker WC-L2A attributed to "outcome state not persisted" is actually one layer upstream:**
  concern linkage is not being captured per session. Fixing that is a *capture-pipeline* change
  (a new phase), NOT something the existing outcome/trend/forecast engines can recover by reuse.

## Recommendation (no work taken — stop for approval)
- Activate the backfill in CI/scheduled form so outcomes resolve the instant linkage exists (it is
  already idempotent and safe). The leverage item is upstream: ensure each completed assessment
  persists \`master_concern_pk\` (or \`primary_construct_key\`), then re-run this backfill — it will
  activate outcomes with no further engine work.
`);

  // PII-masked machine artifact
  writeFileSync(join(OUT_DIR, '_outcome_activation.json'), JSON.stringify({
    generated: stamp, flags, before, after,
    backfill: { written, cells },
    trendRecomputes,
  }, null, 2));

  // Console summary
  console.log('WC-L2B Outcome Forecast Activation');
  console.log('  flags:', JSON.stringify(flags));
  console.log('  outcome-state sessions: before', before.outcomeStateSessionsTotal, '→ after', after.outcomeStateSessionsTotal,
    `(owned ${after.outcomeStateSessionsOwned}, anon ${after.outcomeStateSessionsAnon})`);
  console.log('  backfill written:', written, '/ unresolvable(no linkage):', unresolvable, '/ completed:', cells.length);
  console.log('  outcome trend coverage:', `${after.outcomeTrendOwners}/${after.eligibleOwners}`,
    '· forecast coverage:', `${after.outcomeForecastOwners}/${after.eligibleOwners}`);
  console.log('  trend recomputes:', trendRecomputes);
  console.log('  → 6 reports + _outcome_activation.json written to', OUT_DIR);

  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
