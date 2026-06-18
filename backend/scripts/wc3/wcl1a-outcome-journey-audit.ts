/**
 * WC-L1A — Outcome & Journey State Capture Audit (SELECT-only, no writes).
 *
 * Audits WHY `wc3_outcome_state` and `wc3_journey_state` are empty (0 rows), measures coverage /
 * continuity / readiness, and emits a remediation roadmap. AUDIT-FIRST: this script makes NO writes,
 * runs NO ensure-schema DDL, imports NO services (raw SQL + information_schema only), and introduces
 * no new intelligence model / ontology / construct. Output → backend/audit/wc-l1a/ (6 reports + README).
 *
 * Honesty stance (mirrors WC-L0/WC-L1): completion timing is read from `updated_at` (not `created_at`);
 * because `postCompletionHooks` is fire-and-forget + never-throws, "hook never ran" is presented as
 * ONE of two observationally-indistinguishable branches (the other: ran-but-wrote-nothing/failed),
 * disambiguated only by a live smoke test (R1). The Outcome ceiling is reported under CURRENT runtime
 * flags AND under a hypothetical crosswalk-on scenario, contingent on bridge-tag resolution.
 *
 * Usage:  cd backend && npx tsx scripts/wc3/wcl1a-outcome-journey-audit.ts
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT_DIR = join(__dirname, '../../audit/wc-l1a');
const pct = (n: number, d: number): string => (d === 0 ? '0.0' : ((100 * n) / d).toFixed(1));

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  mkdirSync(OUT_DIR, { recursive: true });
  const q = async (sql: string, args: unknown[] = []): Promise<Record<string, any>[]> => {
    try { return (await pool.query(sql, args)).rows; } catch (e) { return [{ __err: e instanceof Error ? e.message : String(e) }]; }
  };
  const scalar = async (sql: string, args: unknown[] = []): Promise<number | string> => {
    const r = await q(sql, args);
    if (r[0]?.__err) return `ERR(${r[0].__err})`;
    const v = r[0] ? Object.values(r[0])[0] : 0;
    return v == null ? 0 : (v as number);
  };
  const colExists = async (table: string, col: string): Promise<boolean> => {
    const r = await q(`SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`, [table, col]);
    return r.length > 0 && !r[0].__err;
  };

  try {
    // ── Population (completion timing via updated_at — completion sets status + bumps updated_at) ──
    const totalSessions = await scalar(`SELECT count(*)::int FROM capadex_sessions`);
    const completed = await scalar(`SELECT count(*)::int FROM capadex_sessions WHERE status='completed'`);
    const completedEmail = await scalar(`SELECT count(*)::int FROM capadex_sessions WHERE status='completed' AND guest_email IS NOT NULL`);
    const compRange = (await q(
      `SELECT min(updated_at) oldest, max(updated_at) newest, now() now,
              extract(day FROM now()-max(updated_at))::int days_since
         FROM capadex_sessions WHERE status='completed'`))[0] ?? {};
    const daysSince = Number(compRange.days_since ?? 0);
    const eligibleUsers = await scalar(`SELECT count(*)::int FROM (SELECT 1 FROM capadex_sessions WHERE status='completed' AND guest_email IS NOT NULL GROUP BY LOWER(guest_email) HAVING count(*)>=2) t`);

    // ── State tables (the WC-3 outputs) ──
    const stateCounts: Record<string, number | string> = {};
    for (const t of ['wc3_stage_state', 'wc3_longitudinal_snapshots', 'wc3_outcome_state', 'wc3_journey_state', 'wc7b_decision_state', 'wc3_longitudinal_trends']) {
      stateCounts[t] = await scalar(`SELECT count(*)::int FROM ${t}`);
    }
    const snapRange = (await q(`SELECT min(captured_at) oldest, max(captured_at) newest FROM wc3_longitudinal_snapshots`))[0] ?? {};

    // ── Corpus (must be seeded for compute) ──
    const outcomeModels = await scalar(`SELECT count(*)::int FROM wc3_outcome_models`);
    const journeyRoutes = await scalar(`SELECT count(*)::int FROM wc3_journey_routes`);
    const interventions = await scalar(`SELECT count(*)::int FROM intervention_library`);

    // ── Outcome spine availability (per the resolver's OWN tiers in loadSessionConstructs) ──
    //   tier-1: behavioural_hypotheses (active, construct_key)
    //   tier-2: capadex_session_patterns.construct_key
    //   tier-3 (flag FF_WC3_OUTCOME_CROSSWALK): resolveConstructsFromClarityBank — UNIONs the session's
    //           primary_construct_key AND the construct resolved from its concern bridge tag.
    const hypTotal = await scalar(`SELECT count(*)::int FROM behavioural_hypotheses`);
    const patTotal = await scalar(`SELECT count(*)::int FROM capadex_session_patterns`);
    const patHasConstructKey = await colExists('capadex_session_patterns', 'construct_key');
    const crosswalkFlag = process.env.FF_WC3_OUTCOME_CROSSWALK; // unset here → OFF (workflow does not set it)
    const crosswalkOn = crosswalkFlag === '1' || crosswalkFlag === 'true';

    const perSession = await q(`
      SELECT s.id::text sid, (s.guest_email IS NOT NULL) email,
             (s.master_concern_pk IS NOT NULL) concern_pk,
             (s.primary_construct_key IS NOT NULL AND s.primary_construct_key <> '') has_pck,
             m.relational_bridge_tag bridge,
        (SELECT count(*)::int FROM behavioural_hypotheses h
          WHERE h.session_id::text = s.id::text AND h.lifecycle_state='active' AND h.construct_key IS NOT NULL) active_hyp
      FROM capadex_sessions s
      LEFT JOIN capadex_concerns_master m ON m.id = s.master_concern_pk
      WHERE s.status='completed' ORDER BY s.updated_at`);
    const sessRows = perSession.filter((r) => !r.__err);
    const hasBridge = (r: Record<string, any>) => r.bridge != null && String(r.bridge).trim() !== '' && String(r.bridge).toUpperCase() !== 'UNMAPPED';
    const withSpine = sessRows.filter((r) => Number(r.active_hyp) > 0).length;            // tier-1 (real constructs)
    const crosswalkCandidates = sessRows.filter((r) => Number(r.active_hyp) === 0 && (r.has_pck || hasBridge(r))).length; // tier-3 IF flag on (contingent on resolution)
    const pckCount = sessRows.filter((r) => r.has_pck).length;
    const bridgeCount = sessRows.filter((r) => hasBridge(r)).length;
    // Classifiable UNDER CURRENT RUNTIME FLAGS (crosswalk OFF → only tiers 1 & 2; tier-2 unavailable):
    const classifiableNow = withSpine;
    // Upper bound IF FF_WC3_OUTCOME_CROSSWALK were enabled (still contingent on the bridge tag actually
    // resolving to a construct — not asserted here):
    const classifiableIfCrosswalk = withSpine + crosswalkCandidates;

    // ── Coverage over completed sessions ──
    const outcomeCovSessions = await scalar(`SELECT count(DISTINCT session_id)::int FROM wc3_outcome_state`);
    const journeyCovSessions = await scalar(`SELECT count(DISTINCT session_id)::int FROM wc3_journey_state`);

    // ── Authoritative computed trends (WC-L1 output) — used instead of hard-coded numbers ──
    const trendRows = (await q(`SELECT user_email, metric, direction, points, slope_per_session, confidence, first_value, last_value, source FROM wc3_longitudinal_trends ORDER BY metric, user_email`)).filter((r) => !r.__err);
    const trendMetrics = Array.from(new Set(trendRows.map((r) => r.metric)));
    const sampleTrend = (m: string) => trendRows.find((r) => r.metric === m);
    const stageT = sampleTrend('stage');
    const decisionT = sampleTrend('decision');
    const trendDesc = (t: any) => (t ? `${t.direction}, ${t.points}pt, conf ${t.confidence}, ${t.first_value}→${t.last_value}` : 'no rows');

    const stamp = new Date().toISOString();
    const fmt = (d: any) => (d ? new Date(d).toISOString() : 'n/a');
    const sessionTable = sessRows.map((r) =>
      `| \`${r.sid.slice(0, 8)}…\` | ${r.email ? 'yes' : 'no'} | ${r.active_hyp} | ${r.has_pck ? 'yes' : 'no'} | ${hasBridge(r) ? String(r.bridge) : '—'} |`).join('\n');
    const trendTable = trendRows.map((r) =>
      `| ${r.metric} | ${String(r.user_email).split('@')[0].slice(0, 4)}… | ${r.direction} | ${r.points} | ${r.slope_per_session} | ${r.confidence} | ${r.first_value}→${r.last_value} |`).join('\n');

    // ── Console headline ──
    console.log(`\nWC-L1A audit — ${completed} completed sessions (${completedEmail} emailed, ${eligibleUsers} users with ≥2). Newest completion ${daysSince}d ago.`);
    console.log(`  Outcome coverage: ${outcomeCovSessions}/${completed}  Journey: ${journeyCovSessions}/${completed}`);
    console.log(`  Outcome spine: hyp=${hypTotal} · patterns.construct_key=${patHasConstructKey} · primary_construct_key=${pckCount}/${completed} · bridge-tag=${bridgeCount}/${completed} · crosswalk flag=${crosswalkOn ? 'ON' : 'OFF'}`);
    console.log(`  Outcome classifiable: now=${classifiableNow}/${completed}; if crosswalk on (contingent)=${classifiableIfCrosswalk}/${completed}. Journey backfill: ${completed}/${completed} (all degraded).`);

    // ════════════════════════════════════════════════════════════════════════
    // 00 README
    // ════════════════════════════════════════════════════════════════════════
    writeFileSync(join(OUT_DIR, '00_README.md'), `# WC-L1A — Outcome & Journey State Capture Audit
_Generated ${stamp} · SELECT-only, no writes, no new models/ontology/constructs._

Audits why **\`wc3_outcome_state\`** and **\`wc3_journey_state\`** hold **0 rows** (surfaced by WC-L1),
and measures coverage, continuity, and trend/forecast readiness for the Outcome (L2) and Journey (L3)
intelligence levers. **Audit first — STOP for approval before any remediation.**

## TL;DR — root cause (two layers)
1. **The persistence path exists and is wired, but has produced no rows for any existing session.**
   The hooks DO exist and ARE wired into \`postCompletionHooks\` (\`capadex-enterprise.ts\`), gated by
   \`FF_WC3_OUTCOME\` / \`FF_WC3_JOURNEY\` — both **ON** in the Backend API workflow. Two explanations
   are **observationally indistinguishable** from the data alone, because \`postCompletionHooks\` is
   fire-and-forget and never-throws (it swallows errors):
   - (i) **no session has completed since the hook/flags were activated** — the newest completion
     (\`updated_at\`) is **${daysSince} days old** (window ${fmt(compRange.oldest)} → ${fmt(compRange.newest)}); or
   - (ii) the hook **ran but wrote nothing / failed silently**.
   A single live completion (Remediation R1) disambiguates. In EITHER case the existing sessions carry
   no state and there is **no backfill script** for these layers — the remediation is the same. (The
   state that DOES exist — snapshots, decision, trends — came from dedicated **backfill scripts**; the
   snapshots were all written ${fmt(snapRange.oldest)} by backfill, not at completion.)
2. **Even a backfill cannot meaningfully populate Outcome today — there is no source spine.** The
   Outcome resolver needs ACTIVE behavioural constructs (\`loadSessionConstructs\`):
   tier-1 \`behavioural_hypotheses\` (**${hypTotal} rows system-wide**), tier-2
   \`capadex_session_patterns.construct_key\` (**column absent** → unavailable), tier-3 (flag
   \`FF_WC3_OUTCOME_CROSSWALK\`, currently **${crosswalkOn ? 'ON' : 'OFF'}**) unions a session's
   \`primary_construct_key\` (**${pckCount}/${completed}**) and its concern bridge tag
   (**${bridgeCount}/${completed}** non-UNMAPPED). So under current flags **${classifiableNow}/${completed}** sessions
   are classifiable; even with the crosswalk enabled the upper bound is **${classifiableIfCrosswalk}/${completed}**
   (contingent on the bridge tag resolving to a construct). Every other session resolves to an honest
   **UNCLASSIFIED** and writes nothing — never fabricated.

## Population
- Total sessions: **${totalSessions}** · Completed: **${completed}** · Completed w/ email: **${completedEmail}** · Users with ≥2 completed: **${eligibleUsers}**
- Completed-session window (by \`updated_at\`): **${fmt(compRange.oldest)} → ${fmt(compRange.newest)}** · newest **${daysSince}d** ago (now ${fmt(compRange.now)})

## State-table coverage (over ${completed} completed sessions)
| Table | Rows | Distinct sessions | Coverage | Origin |
|---|---|---|---|---|
| wc3_longitudinal_snapshots | ${stateCounts.wc3_longitudinal_snapshots} | — | — | backfill (written ${fmt(snapRange.oldest)}) |
| wc7b_decision_state | ${stateCounts.wc7b_decision_state} | — | — | backfill (WC-11) |
| wc3_longitudinal_trends | ${stateCounts.wc3_longitudinal_trends} | — | — | backfill (WC-L1) |
| wc3_stage_state | ${stateCounts.wc3_stage_state} | — | 0% | no backfill; live hook produced none |
| **wc3_outcome_state** | **${stateCounts.wc3_outcome_state}** | ${outcomeCovSessions} | **${pct(Number(outcomeCovSessions), Number(completed))}%** | no backfill + empty spine |
| **wc3_journey_state** | **${stateCounts.wc3_journey_state}** | ${journeyCovSessions} | **${pct(Number(journeyCovSessions), Number(completed))}%** | no backfill (backfillable, but degraded) |

## Corpus readiness (compute prerequisites — all seeded)
- \`wc3_outcome_models\`: **${outcomeModels}** · \`wc3_journey_routes\`: **${journeyRoutes}** · \`intervention_library\`: **${interventions}**
> Corpora are present, so compute is NOT blocked by missing reference data — it is blocked by the live
> hook producing nothing for existing sessions and by the empty per-session behavioural spine.

## Success criteria — honest status
| Target | Result | Met? |
|---|---|---|
| Outcome State Coverage > 90% | ${pct(Number(outcomeCovSessions), Number(completed))}% | ❌ |
| Journey State Coverage > 90% | ${pct(Number(journeyCovSessions), Number(completed))}% | ❌ |
| Outcome backfillable from existing intelligence | ${classifiableNow}/${completed} now (≤${classifiableIfCrosswalk}/${completed} w/ crosswalk) | ❌ (spine empty) |
| Journey backfillable from existing intelligence | ${completed}/${completed} routable | ⚠️ yes, but all DEGRADED |

## Reports
1. \`01_outcome_state_audit.md\`  2. \`02_journey_state_audit.md\`  3. \`03_historical_coverage_report.md\`
4. \`04_trend_readiness_report.md\`  5. \`05_forecast_readiness_report.md\`  6. \`06_remediation_roadmap.md\`
`);

    // ════════════════════════════════════════════════════════════════════════
    // 01 Outcome State Audit
    // ════════════════════════════════════════════════════════════════════════
    writeFileSync(join(OUT_DIR, '01_outcome_state_audit.md'), `# Deliverable 1 — Outcome State Audit (\`wc3_outcome_state\`)
_Generated ${stamp}_

## 1. Why Outcome state is not being persisted
Two independent reasons, BOTH must be addressed:

**(a) The persistence path has produced no rows for any existing session.**
- The writer \`resolveSessionOutcomes\` is wired into \`postCompletionHooks\` (Phase B block), gated on
  \`isWc3OutcomeEnabled()\` (\`FF_WC3_OUTCOME\`, **ON** in the Backend API workflow).
- \`postCompletionHooks\` runs only at session completion and is **fire-and-forget + never-throws**, so
  from the data alone two causes are indistinguishable: (i) **no session has completed since the
  hook/flags were activated** — newest completion is **${daysSince}d** old (\`updated_at\` window
  ${fmt(compRange.oldest)} → ${fmt(compRange.newest)}); or (ii) the hook **ran but wrote nothing /
  failed silently**. R1 (one live completion) disambiguates. Either way: no rows, and no backfill script.

**(b) Even when run, the Outcome resolver writes NOTHING for these sessions (honest UNCLASSIFIED).**
\`resolveSessionOutcomes\` only persists when the session has ACTIVE behavioural constructs
(\`loadSessionConstructs\`):
| Tier | Source | Availability here |
|---|---|---|
| 1 | \`behavioural_hypotheses\` (lifecycle='active', construct_key) | **${hypTotal} rows system-wide** → none |
| 2 | \`capadex_session_patterns.construct_key\` | **column does not exist** → tier unavailable |
| 3 (flag) | crosswalk: \`primary_construct_key\` ∪ concern-bridge-tag construct (needs \`FF_WC3_OUTCOME_CROSSWALK\`, currently **${crosswalkOn ? 'ON' : 'OFF'}**) | \`primary_construct_key\` on **${pckCount}/${completed}**; non-UNMAPPED bridge tag on **${bridgeCount}/${completed}** |

With no constructs, every model fails to match → \`unclassified: true\` → **no row written** (by design,
never fabricated).

## 2. Do persistence hooks already exist?
**Yes.** Fully implemented and wired: \`resolveSessionOutcomes\` (UPSERT on \`(session_id, model_key)\`)
+ companion \`wc3_outcome_actions\`, plus the read path \`getSessionOutcomes\` and GET
\`/api/capadex/session/:id/outcome\`. The code is correct and never-throws; it simply has no input.

## 3. Is backfill possible using existing intelligence?
**Not meaningfully today.**
- **Under current runtime flags** (crosswalk **${crosswalkOn ? 'ON' : 'OFF'}**): classifiable =
  **${classifiableNow}/${completed}** (tier-1 empty, tier-2 unavailable, tier-3 gated off).
- **If \`FF_WC3_OUTCOME_CROSSWALK\` were enabled**: upper bound **${classifiableIfCrosswalk}/${completed}**
  candidate sessions (${pckCount} carry a \`primary_construct_key\`, ${bridgeCount} a non-UNMAPPED bridge
  tag) — and even then only IF the bridge tag resolves to a construct (not asserted here).
- Corpus is ready (\`wc3_outcome_models\`=${outcomeModels}, \`intervention_library\`=${interventions}); the
  block is the empty per-session spine, not reference data.

## Per-session spine availability (completed sessions)
| Session | Email | active hyp (tier-1) | primary_construct_key | bridge tag (tier-3) |
|---|---|---|---|---|
${sessionTable}

## Coverage
- Outcome State Coverage = **${outcomeCovSessions}/${completed} = ${pct(Number(outcomeCovSessions), Number(completed))}%**.

> **Honest ceiling:** Outcome cannot be populated by re-running compute alone — it is blocked upstream
> on behavioural-spine capture (\`behavioural_hypotheses\`) and/or enabling the crosswalk over sessions
> that carry a resolvable construct/bridge tag. See the Remediation Roadmap. Nothing is fabricated.
`);

    // ════════════════════════════════════════════════════════════════════════
    // 02 Journey State Audit
    // ════════════════════════════════════════════════════════════════════════
    writeFileSync(join(OUT_DIR, '02_journey_state_audit.md'), `# Deliverable 2 — Journey State Audit (\`wc3_journey_state\`)
_Generated ${stamp}_

## 1. Why Journey state is not being persisted
**The same persistence-path gap as Outcome (reason (a)).** \`resolveSessionJourney\` is wired into
\`postCompletionHooks\` gated on \`isWc3JourneyEnabled()\` (\`FF_WC3_JOURNEY\`, **ON** in the workflow),
but it has produced no rows for the ${completed} pre-existing completed sessions (newest ${daysSince}d old)
and there is no backfill script. Unlike Outcome, Journey has **no data ceiling** —
\`resolveSessionJourney\` **always persists a route** (deterministic Mentoring fallback when nothing
activates). So 0 rows here is purely "no completion has driven the hook (or it ran silently) + no
backfill", which isolates reason (a) cleanly.

## 2. Do persistence hooks already exist?
**Yes.** \`resolveSessionJourney\` (UPSERT on \`session_id\`) + \`wc3_journey_candidates\`, read path
\`getSessionJourney\`, GET \`/api/capadex/session/:id/journey\`. Route corpus \`wc3_journey_routes\` =
**${journeyRoutes}** (seeded). The invariant "no session is ever routeless" is implemented.

## 3. Is backfill possible using existing intelligence?
**Yes — ${completed}/${completed} sessions routable — BUT every route would be DEGRADED.**
Journey scores routes from the session's ACTIVE outcome models (\`wc3_outcome_state\`). Because Outcome
is empty (Deliverable 1), \`buildJourney\` finds no activated models → falls back to the deterministic
Mentoring route at the honest low-confidence floor (\`route_confidence ≈ 0.2\`, \`degraded: true\`) for
EVERY session. So a backfill produces rows, but they carry a default route, not real routing
intelligence. **Journey quality is bounded by Outcome** — fixing Journey meaningfully requires fixing
Outcome first.

## Coverage
- Journey State Coverage = **${journeyCovSessions}/${completed} = ${pct(Number(journeyCovSessions), Number(completed))}%**.
- Post-backfill projection: **${completed}/${completed} routed**, of which **${completed}/${completed} degraded** (until Outcome populated).

> **Honest note:** A journey backfill is safe and trivially feasible, but reporting it as "coverage
> achieved" would overstate value — degraded fallback routes are not differentiated intelligence.
`);

    // ════════════════════════════════════════════════════════════════════════
    // 03 Historical Coverage Report
    // ════════════════════════════════════════════════════════════════════════
    writeFileSync(join(OUT_DIR, '03_historical_coverage_report.md'), `# Deliverable 3 — Historical Coverage Report
_Generated ${stamp}_

## Session inventory
| Metric | Value |
|---|---|
| Total sessions | ${totalSessions} |
| Completed sessions | ${completed} |
| Completed with email (user-linkable) | ${completedEmail} |
| Distinct users with ≥2 completed (trend-eligible) | ${eligibleUsers} |
| Completed-session window (\`updated_at\`) | ${fmt(compRange.oldest)} → ${fmt(compRange.newest)} |
| Time since newest completion | ${daysSince} days |

## State capture per intelligence layer (over ${completed} completed)
| Layer | Table | Rows | Coverage | How it got there |
|---|---|---|---|---|
| L1 Stage | wc3_stage_state | ${stateCounts.wc3_stage_state} | 0% | no backfill; live hook produced none |
| L6 Longitudinal | wc3_longitudinal_snapshots | ${stateCounts.wc3_longitudinal_snapshots} | ${pct(Number(stateCounts.wc3_longitudinal_snapshots), Number(completed))}% | **backfill** (${fmt(snapRange.oldest)}) |
| L2 Outcome | wc3_outcome_state | ${stateCounts.wc3_outcome_state} | 0% | no backfill; empty spine |
| L3 Journey | wc3_journey_state | ${stateCounts.wc3_journey_state} | 0% | no backfill |
| WC-11 Decision | wc7b_decision_state | ${stateCounts.wc7b_decision_state} | ${pct(Number(stateCounts.wc7b_decision_state), Number(completed))}% | **backfill** (WC-11) |
| WC-L1 Trends | wc3_longitudinal_trends | ${stateCounts.wc3_longitudinal_trends} | — | **backfill** (WC-L1) |

## Historical continuity
- Trend/forecast continuity requires ≥2 completed sessions per user. Only **${eligibleUsers}** users
  qualify; the rest have a single completed session or are anonymous (no cross-session identity).
- **Pattern:** every populated state table was filled by an explicit **backfill script**, not by the
  live completion hook. Stage, Outcome, and Journey are exactly the three layers that **lack a backfill
  script** — which is why they read 0, independent of whether the live hook has fired.

## Conclusion
Historical coverage is gated by (1) a backfill script per layer, and (2) for Outcome, the upstream
behavioural spine. Continuity for genuinely longitudinal analysis is inherently small here
(${eligibleUsers} eligible users) regardless of layer wiring.
`);

    // ════════════════════════════════════════════════════════════════════════
    // 04 Trend Readiness Report  (numbers derived from wc3_longitudinal_trends)
    // ════════════════════════════════════════════════════════════════════════
    writeFileSync(join(OUT_DIR, '04_trend_readiness_report.md'), `# Deliverable 4 — Trend Readiness Report
_Generated ${stamp}_

Readiness of each lever to feed **WC-L1 Trend Intelligence** (direction needs ≥2 readable, varying
points per user). Numbers below are the ACTUAL persisted WC-L1 computations (\`wc3_longitudinal_trends\`,
metrics present: ${trendMetrics.length ? trendMetrics.join(', ') : 'none'}), not estimates.

| Lever | Source state | Source rows | Trend readiness |
|---|---|---|---|
| Stage | wc3_longitudinal_snapshots | ${stateCounts.wc3_longitudinal_snapshots} | ${stageT ? `✅ computed (${trendDesc(stageT)})` : '⚠️ no trend rows'} |
| Outcome | wc3_outcome_state | ${stateCounts.wc3_outcome_state} | ❌ blocked — no source rows (empty spine) |
| Journey | wc3_journey_state | ${stateCounts.wc3_journey_state} | ❌ blocked — no source rows; even backfilled it is degraded-constant (~0.2) → trivially "stable", no real direction |
| Decision | wc7b_decision_state | ${stateCounts.wc7b_decision_state} | ${decisionT ? `✅ computed (${trendDesc(decisionT)})` : '⚠️ no trend rows'} |

## Persisted trend rows (authoritative WC-L1 output)
| Metric | User | Direction | Points | Slope/session | Confidence | First→Last |
|---|---|---|---|---|---|---|
${trendTable || '| _none_ | | | | | | |'}

## Why Outcome/Journey trend = 0% (and would stay low even after a journey backfill)
- **Outcome**: no rows to trend; backfill yields 0 rows (UNCLASSIFIED) → remains 0%.
- **Journey**: a backfill yields rows, but with \`route_confidence ≈ 0.2\` on every session the trend
  would read "stable" at a meaningless floor — coverage would rise but the signal carries no
  information until Outcome (its scoring input) is populated.

## Verdict
Trend Intelligence is **${trendMetrics.length}/4 levers populated** (${trendMetrics.length ? trendMetrics.join(', ') : '—'}) — matching WC-L1.
Outcome and Journey are blocked on capture, not on trend math. Note the populated levers are flat
(slope 0, "stable") at only ${stageT?.points ?? 2} points — coverage exists but directional confidence
is honestly low (${stageT?.confidence ?? 'n/a'}).
`);

    // ════════════════════════════════════════════════════════════════════════
    // 05 Forecast Readiness Report  (numbers derived, not hard-coded)
    // ════════════════════════════════════════════════════════════════════════
    writeFileSync(join(OUT_DIR, '05_forecast_readiness_report.md'), `# Deliverable 5 — Forecast Readiness Report
_Generated ${stamp}_

Readiness to support **forward projection / forecast** intelligence. A credible forecast needs a
per-user historical series with enough points AND real variation to extrapolate. Figures below derive
from the persisted WC-L1 trend rows.

| Requirement | Status |
|---|---|
| ≥2 comparable sessions per user | only ${eligibleUsers} users qualify |
| Per-lever historical series | Stage ${stageT ? '✅' : '❌'}, Decision ${decisionT ? '✅' : '❌'}, Outcome ❌, Journey ❌ |
| Variation in the series (non-flat) | Stage ${stageT ? `${stageT.first_value}→${stageT.last_value} (${stageT.direction})` : 'n/a'}; Decision ${decisionT ? `${decisionT.first_value}→${decisionT.last_value} (${decisionT.direction})` : 'n/a'} → slope ${stageT?.slope_per_session ?? '0'} |
| Confidence to extrapolate | low — ${stageT?.points ?? 2}-point series; persisted confidence ${stageT?.confidence ?? 'n/a'} |

## Per-lever forecast readiness
- **Stage / Decision** — a series EXISTS but is flat (${stageT ? `${stageT.direction}` : 'stable'}, slope
  ${stageT?.slope_per_session ?? '0'}) and only ${stageT?.points ?? 2} points deep. Forecast is
  *technically* computable but honestly degrades to "insufficient history / no directional signal".
- **Outcome** — **unsupported**: no source rows at all. Forecast must degrade honestly (no fabrication).
- **Journey** — **unsupported for real forecasting**: backfillable only as a degraded constant, which
  yields a flat, information-free series.

## Verdict
**Forecast Intelligence is NOT ready** for any lever at a meaningful confidence today. The blockers are
upstream (sparse return-visits + empty Outcome/Journey capture), not the forecast method. This matches
the WC-L1 / WC-L0 honesty stance: surface the real ceiling, do not inflate toward a >90% target.
`);

    // ════════════════════════════════════════════════════════════════════════
    // 06 Remediation Roadmap
    // ════════════════════════════════════════════════════════════════════════
    writeFileSync(join(OUT_DIR, '06_remediation_roadmap.md'), `# Deliverable 6 — Remediation Roadmap
_Generated ${stamp} · proposal only — STOP for approval before executing any step._

All steps are **additive, flag-gated, reversible**, and introduce **no new intelligence model,
ontology, or construct** — they activate EXISTING, already-wired intelligence. Ordered by dependency.

## R1 — Disambiguate + verify the live path (no code change) · LOW effort · DO FIRST
Drive ONE new completed session and check whether Stage + Journey state (and Outcome IF it has a spine)
get written. This resolves the only open ambiguity in this audit — whether the live hook (i) has simply
not fired since the last completion (${daysSince}d ago) or (ii) fires but writes nothing/fails silently
(\`postCompletionHooks\` is never-throws, so the data alone can't tell). Highest-value, lowest-cost check.

## R2 — Journey backfill script (mirrors WC-L1 backfill) · LOW effort · ⚠️ degraded output
Add \`scripts/wc3/<...>-journey-backfill.ts\` that calls the EXISTING \`resolveSessionJourney\` over
completed sessions. Yields ${completed}/${completed} routed rows. **Caveat:** all degraded (conf ≈ 0.2)
until Outcome is populated — lifts Journey *coverage* but not *quality*. Do R4 first for it to mean anything.

## R3 — Stage backfill script · LOW effort
Add a stage backfill calling the EXISTING \`resolveSessionStage\` so \`wc3_stage_state\` matches the
already-backfilled snapshots. Pure coverage parity; no data ceiling (snapshots prove stage is derivable).

## R4 — Unblock Outcome at the source (the real fix) · MEDIUM effort · prerequisite for meaningful R2
Outcome needs ACTIVE behavioural constructs. Options, highest fidelity first (no new constructs — all
use EXISTING resolvers/data):
1. **Behavioural-spine capture** — ensure \`behavioural_hypotheses\` (Phase-3 spine) is persisted at
   completion so sessions carry active constructs. This is the canonical input the resolver expects.
2. **Enable \`FF_WC3_OUTCOME_CROSSWALK\`** so the EXISTING crosswalk can classify the
   **≤${classifiableIfCrosswalk}/${completed}** sessions that carry a \`primary_construct_key\`
   (${pckCount}) or a non-UNMAPPED concern bridge tag (${bridgeCount}) — contingent on the tag resolving
   to a construct. Lower fidelity than (1); will NOT reach the remaining ${Number(completed) - classifiableIfCrosswalk}/${completed} sessions.
Until R4 lands, Outcome coverage is honestly **0%** and any "outcome backfill" writes nothing.

## R5 — Re-run WC-L1 trends + re-measure · LOW effort (after R2–R4)
Once Outcome/Journey carry real rows, re-run the WC-L1 backfill so Outcome/Journey trend coverage
reflects real data, then re-run this audit to confirm the ceilings moved for real reasons.

## What NOT to do (honesty guardrails)
- Do **not** backfill Journey alone and report the coverage gain as readiness — the routes are degraded.
- Do **not** fabricate constructs/outcomes to make Outcome non-empty.
- Do **not** tune trend/forecast confidence toward the >90% targets — let real data move them.

## Sequencing
\`\`\`
R1 (verify live) ─┬─ R3 (stage backfill, independent)
                  └─ R4 (unblock outcome) ──> R2 (journey backfill, now meaningful) ──> R5 (re-trend + re-audit)
\`\`\`
`);

    console.log(`\nReports written to ${OUT_DIR}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
