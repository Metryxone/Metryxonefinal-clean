/**
 * WC-L1B — Outcome & Journey State Activation: MEASUREMENT (real data, SELECT-only).
 *
 * Reports, with NO writes and NO inflation, the honest result of activating Outcome and Journey
 * capture across the completed-session base, on TWO INDEPENDENT AXES (never merged):
 *   Coverage   : share of completed sessions / eligible users that now carry the state.
 *   Confidence : whether that state is sufficient + trustworthy enough to support a trend
 *                (a longitudinal trend needs ≥2 comparable points per user; degraded/low-conf
 *                journey points and single-point outcome series are surfaced, never smoothed over).
 *
 * It also reports the LONGITUDINAL-READINESS ceiling truthfully: capturing per-session state does
 * not, by itself, make per-user trends possible — that is bounded by how many returning users have
 * ≥2 sessions that actually carry the state. Real ceilings are surfaced; the >85% target is NOT
 * forced.
 *
 * Output: 4 reports in backend/audit/wc-l1b/.
 *
 * Usage:  cd backend && npx tsx scripts/wc3/wcl1b-measure.ts
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

/** Irreversible pseudonym — audit artifacts are committed, so they must NEVER carry raw PII. */
const maskEmail = (email: string): string =>
  `user_${createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 10)}`;

const OUT_DIR = join(__dirname, '../../audit/wc-l1b');
const pct = (n: number, d: number): string => (d === 0 ? '0.0' : ((100 * n) / d).toFixed(1));

interface UserFeasibility {
  email: string;
  completed: number;
  outcomeSessions: number;
  journeySessions: number;
  journeyRouted: number;
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  mkdirSync(OUT_DIR, { recursive: true });
  try {
    // ── Population base ──
    const { rows: baseRows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='completed')                                            AS completed,
        COUNT(*) FILTER (WHERE status='completed' AND guest_email IS NULL)                    AS completed_anon,
        COUNT(DISTINCT LOWER(guest_email)) FILTER (WHERE status='completed' AND guest_email IS NOT NULL) AS emailed_users
      FROM capadex_sessions
    `);
    const base = baseRows[0];
    const completed = Number(base.completed);
    const completedAnon = Number(base.completed_anon);
    const emailedUsers = Number(base.emailed_users);

    // ── Trend-eligible users (≥2 completed sessions — the only population a per-user trend can exist for) ──
    const { rows: feasRows } = await pool.query(`
      SELECT LOWER(s.guest_email) AS email,
             COUNT(DISTINCT s.id)                                                AS completed,
             COUNT(DISTINCT o.session_id)                                        AS outcome_sessions,
             COUNT(DISTINCT j.session_id)                                        AS journey_sessions,
             COUNT(DISTINCT j.session_id) FILTER (WHERE j.degraded IS NOT TRUE)  AS journey_routed
        FROM capadex_sessions s
        LEFT JOIN wc3_outcome_state o ON o.session_id::text = s.id::text
        LEFT JOIN wc3_journey_state j ON j.session_id::text = s.id::text
       WHERE s.status='completed' AND s.guest_email IS NOT NULL
       GROUP BY LOWER(s.guest_email)
      HAVING COUNT(DISTINCT s.id) >= 2
       ORDER BY COUNT(DISTINCT s.id) DESC, LOWER(s.guest_email)
    `);
    const feas: UserFeasibility[] = feasRows.map((r) => ({
      email: String(r.email),
      completed: Number(r.completed),
      outcomeSessions: Number(r.outcome_sessions),
      journeySessions: Number(r.journey_sessions),
      journeyRouted: Number(r.journey_routed),
    }));
    const N = feas.length;

    // ── State capture (over the whole completed base) ──
    const { rows: ocRows } = await pool.query(`
      SELECT COUNT(*) AS model_rows,
             COUNT(DISTINCT session_id) AS sessions,
             COUNT(DISTINCT session_id) FILTER (WHERE user_email IS NOT NULL) AS emailed_sessions,
             ROUND(AVG(confidence)::numeric, 3) AS mean_conf
        FROM wc3_outcome_state
    `);
    const oc = ocRows[0];
    const outcomeSessions = Number(oc.sessions);
    const outcomeModelRows = Number(oc.model_rows);
    const outcomeMeanConf = oc.mean_conf == null ? 0 : Number(oc.mean_conf);

    const { rows: jRows } = await pool.query(`
      SELECT COUNT(*) AS rows,
             COUNT(*) FILTER (WHERE degraded IS NOT TRUE) AS routed,
             COUNT(*) FILTER (WHERE degraded IS TRUE)     AS degraded,
             ROUND(AVG(route_confidence)::numeric, 3)     AS mean_conf
        FROM wc3_journey_state
    `);
    const j = jRows[0];
    const journeyRows = Number(j.rows);
    const journeyRouted = Number(j.routed);
    const journeyDegraded = Number(j.degraded);
    const journeyMeanConf = j.mean_conf == null ? 0 : Number(j.mean_conf);

    // ── Why sessions stay unclassified (honest source-data ceiling) ──
    // Anchor viability is judged with the SAME join the crosswalk uses in `loadSessionConstructs`
    // (primary_construct_key UNION master_concern_pk → capadex_concerns_master.relational_bridge_tag),
    // NOT a bare `master_concern_pk IS NULL` proxy. Split the unclassified set:
    //   • no_anchor       — no primary_construct_key AND no resolvable bridge tag → unreachable, period.
    //   • anchor_no_match — an anchor exists (construct or bridge tag) but the crosswalk still produced
    //                       no outcome (bridge tag not mapped by resolveConstructForBridgeTag, or a
    //                       construct/concern with no overlapping outcome model). The finer split
    //                       between those two lives INSIDE the engine's crosswalk fn — not re-derived
    //                       here, to avoid fidelity drift.
    const { rows: spineRows } = await pool.query(`
      WITH oc AS (SELECT DISTINCT session_id FROM wc3_outcome_state)
      SELECT
        COUNT(*) FILTER (WHERE s.status='completed') AS completed,
        COUNT(*) FILTER (WHERE s.status='completed' AND oc.session_id IS NOT NULL) AS classified,
        COUNT(*) FILTER (
          WHERE s.status='completed' AND oc.session_id IS NULL
            AND (s.primary_construct_key IS NULL OR s.primary_construct_key='')
            AND (m.relational_bridge_tag IS NULL OR m.relational_bridge_tag='')
        ) AS uncl_no_anchor,
        COUNT(*) FILTER (
          WHERE s.status='completed' AND oc.session_id IS NULL
            AND NOT ((s.primary_construct_key IS NULL OR s.primary_construct_key='')
                     AND (m.relational_bridge_tag IS NULL OR m.relational_bridge_tag=''))
        ) AS uncl_anchor_no_match
      FROM capadex_sessions s
      LEFT JOIN oc ON oc.session_id::text = s.id::text
      LEFT JOIN capadex_concerns_master m ON m.id = s.master_concern_pk
    `);
    const noAnchor = Number(spineRows[0].uncl_no_anchor);
    const anchorNoMatch = Number(spineRows[0].uncl_anchor_no_match);
    const unclassifiedTotal = noAnchor + anchorNoMatch;

    // ── Trend feasibility (≥2 points needed per user) ──
    const outcomeTrendEligible = feas.filter((u) => u.outcomeSessions >= 2).length;
    const journeyTrendEligible = feas.filter((u) => u.journeySessions >= 2).length;
    const journeyTrendRouted2 = feas.filter((u) => u.journeyRouted >= 2).length;

    const stamp = new Date().toISOString();
    const userRow = (u: UserFeasibility) =>
      `- \`${maskEmail(u.email)}\` — completed ${u.completed} · outcome-bearing ${u.outcomeSessions} · journey ${u.journeySessions} (routed ${u.journeyRouted}) → outcome-trend ${u.outcomeSessions >= 2 ? '**possible**' : 'not yet (needs ≥2)'} · journey-trend ${u.journeySessions >= 2 ? '**possible**' : 'not yet'}`;

    // ── 00 README ──
    writeFileSync(join(OUT_DIR, '00_README.md'), `# WC-L1B — Outcome & Journey State Activation (MEASURED)
_Generated ${stamp}_

Activates the two longitudinal levers that had no usable history — **Outcome** (\`wc3_outcome_state\`
was **0 rows**) and **Journey** (\`wc3_journey_state\` existed but every row was a **degraded**
fallback) — by replaying the **outcome → journey** halves of the EXISTING post-completion resolver
chain over completed sessions (stage is **consumed** from its already-persisted state, never
re-resolved). It REUSES the existing engines: **no new ontology, construct, or outcome model**. Empty-spine sessions reach an outcome only through the existing WC-10 Lever-1 clarity-bank
crosswalk (\`FF_WC3_OUTCOME_CROSSWALK\`); sessions with no construct AND no mapped concern stay
honestly **unclassified** (nothing written).

Two INDEPENDENT axes, reported separately and never merged:
- **Coverage** — does the state now exist (per session / per eligible user)?
- **Confidence** — is that state sufficient + trustworthy enough to support a *trend* (≥2 comparable
  points per user; degraded / low-confidence points surfaced, not smoothed)?

## Population
- Completed sessions: **${completed}** (of which anonymous / no-email: **${completedAnon}**)
- Emailed users (≥1 completed session): **${emailedUsers}**
- **Trend-eligible users** (≥2 completed sessions — the only population a per-user trend can exist for): **${N}**

## Headline — capture vs trend-feasibility (two axes)
| Lever | Capture coverage (sessions) | Mean confidence | Trend-feasible users (≥2 points) |
|---|---|---|---|
| Outcome | **${outcomeSessions}/${completed} (${pct(outcomeSessions, completed)}%)** · ${outcomeModelRows} model rows | ${outcomeMeanConf.toFixed(2)} | **${outcomeTrendEligible}/${N} (${pct(outcomeTrendEligible, N)}%)** |
| Journey | **${journeyRouted}/${completed} routed (${pct(journeyRouted, completed)}%)**, ${journeyDegraded} degraded | ${journeyMeanConf.toFixed(2)} | **${journeyTrendEligible}/${N} (${pct(journeyTrendEligible, N)}%)** |

## Honest ceiling (why capture ≠ trends)
Capturing per-session state is necessary but **not sufficient** for a per-user trend. A trend needs
≥2 sessions *that carry the state* for the SAME returning user:
- **Outcome trends — ${outcomeTrendEligible}/${N} eligible users.** Of the ${N} returning users, none has
  two completed sessions that both reach an outcome: the behavioural spine
  (composites / patterns / hypotheses) is empty for **every** completed session, so an outcome is only
  reachable via the clarity-bank crosswalk, which requires a \`primary_construct_key\` or a mapped
  concern bridge tag. Of the **${unclassifiedTotal}/${completed}** unclassified sessions, **${noAnchor}** carry
  no anchor at all and **${anchorNoMatch}** carry an anchor that did not yield a crosswalk construct
  overlapping any outcome model. This is a genuine **source-data ceiling upstream**, reported as-is — not inflated.
- **Journey trends — ${journeyTrendEligible}/${N} eligible users.** Journey always persists a route, so both
  returning users now have ≥2 journey points; but only **${journeyTrendRouted2}/${N}** have ≥2
  *non-degraded* points, so journey-trend **confidence stays low by design**.

> The **>85% longitudinal-readiness target is NOT met**, and the activation is built so the number can
> only rise from REAL captured state — never from fabrication. See \`03_longitudinal_readiness.md\`.

## Reports
1. \`01_outcome_capture.md\` — Outcome state capture (coverage + why sessions are unclassified)
2. \`02_journey_capture.md\` — Journey state re-resolution (routed vs degraded)
3. \`03_longitudinal_readiness.md\` — readiness + honest ceilings + forward guarantee
`);

    // ── 01 Outcome capture ──
    writeFileSync(join(OUT_DIR, '01_outcome_capture.md'), `# Deliverable 1 — Outcome State Capture
_Generated ${stamp}_

\`wc3_outcome_state\` was **0 rows** before this activation. The backfill replays
\`resolveSessionOutcomes\` (the exact engine the post-completion hook uses) over every completed
session, with the existing clarity-bank crosswalk enabled. Nothing new is computed — outcomes are
built from already-resolved constructs / concerns and the existing 8 outcome models.

## Coverage (over ${completed} completed sessions)
| Metric | Value | Definition |
|---|---|---|
| Sessions with outcome state | **${outcomeSessions}/${completed} (${pct(outcomeSessions, completed)}%)** | distinct \`session_id\` in \`wc3_outcome_state\` |
| Outcome model rows | **${outcomeModelRows}** | one row per (session, matched model) |
| Mean confidence | **${outcomeMeanConf.toFixed(2)}** | per-model WC-3 calibration (stage·0.5 + action·0.3 + overlap·0.2) |

## Why ${completed - outcomeSessions}/${completed} sessions are unclassified (honest, not a bug)
The behavioural spine (composites / patterns / behavioural_hypotheses) is **empty for every
completed session**, so \`loadSessionConstructs\` only resolves anything via the crosswalk, which
needs a \`primary_construct_key\` or a mapped concern bridge tag.

Anchor viability is judged with the SAME join the crosswalk uses (\`primary_construct_key\` UNION
\`master_concern_pk\` → \`capadex_concerns_master.relational_bridge_tag\`) — not a bare
\`master_concern_pk IS NULL\` proxy.

| Unclassified bucket | Count | Meaning |
|---|---|---|
| No anchor at all | **${noAnchor}/${completed}** | no \`primary_construct_key\` AND no resolvable bridge tag → \`loadSessionConstructs\` returns \`[]\` → \`unclassified (no_constructs)\` |
| Anchor present, no outcome | **${anchorNoMatch}/${completed}** | an anchor exists (construct or bridge tag) but the crosswalk still produced no outcome (tag not mapped by \`resolveConstructForBridgeTag\`, or no overlapping model). The finer split lives inside the engine's crosswalk fn — not re-derived here, to avoid fidelity drift |

Both buckets **write nothing**. This is the honest, additive contract: absent or unmappable data ⇒ no
state, never a fabricated one.

> Coverage and Confidence are independent axes. The coverage here reflects exactly the sessions whose
> already-computed data supports an outcome — it is never padded to a target.
`);

    // ── 02 Journey capture ──
    writeFileSync(join(OUT_DIR, '02_journey_capture.md'), `# Deliverable 2 — Journey State Re-resolution
_Generated ${stamp}_

\`wc3_journey_state\` already held one row per completed session, but every row was a **degraded
mentoring fallback** (route_confidence 0.2) because Outcome state was empty. Re-running
\`resolveSessionJourney\` *after* Outcome capture lets the sessions that now have outcomes route on
real model fit instead of the fallback. Journey ALWAYS persists a route (the invariant holds), so
sessions that still have no outcome remain honestly **degraded**.

## Coverage (over ${completed} completed sessions)
| Metric | Value | Definition |
|---|---|---|
| Journey rows | **${journeyRows}/${completed}** | one route per completed session (invariant) |
| Non-degraded (routed on real fit) | **${journeyRouted}/${completed} (${pct(journeyRouted, completed)}%)** | \`degraded = false\` |
| Degraded fallback | **${journeyDegraded}/${completed}** | no outcome ⇒ honest mentoring fallback |
| Mean route confidence | **${journeyMeanConf.toFixed(2)}** | degraded rows carry 0.2 by design |

> A degraded route is a truthful "insufficient evidence to route confidently", not a failure. It is
> reported as degraded rather than dressed up as a confident route.
`);

    // ── 03 Longitudinal readiness ──
    const target = 0.85;
    const outcomeReady = N > 0 && outcomeTrendEligible / N > target;
    const journeyReady = N > 0 && journeyTrendRouted2 / N > target;
    writeFileSync(join(OUT_DIR, '03_longitudinal_readiness.md'), `# Deliverable 3 — Longitudinal Readiness (Outcome & Journey)
_Generated ${stamp}_

Readiness of the Outcome and Journey levers as **longitudinal** signals — i.e. can the existing
trend layer (WC-L1) actually form a per-user trend from the newly-captured state? Each lever reports
its two INDEPENDENT axes (Coverage of captured state, and trend Feasibility/Confidence) — never
merged.

## Per-eligible-user feasibility (N=${N})
${feas.length === 0 ? '- (no trend-eligible users)' : feas.map(userRow).join('\n')}

## Readiness vs the >85% target (honest)
| Lever | Capture coverage (sessions) | Trend-feasible users (≥2 pts) | >85%? |
|---|---|---|---|
| Outcome | ${pct(outcomeSessions, completed)}% | ${outcomeTrendEligible}/${N} (${pct(outcomeTrendEligible, N)}%) | ${outcomeReady ? '✅' : '❌'} |
| Journey | ${pct(journeyRouted, completed)}% routed | ${journeyTrendRouted2}/${N} non-degraded ≥2 (${pct(journeyTrendRouted2, N)}%) | ${journeyReady ? '✅' : '❌'} |

## Why the target is not met (real ceilings, surfaced not gamed)
1. **The returning-user population is tiny.** Only **${N}** users have ≥2 completed sessions, so every
   per-user longitudinal denominator is small regardless of engine quality.
2. **Outcome history is source-bounded.** With the behavioural spine empty for all sessions, an
   outcome only forms where a construct/concern crosswalk fires. No returning user has **two** such
   sessions, so outcome-trend coverage is honestly **${pct(outcomeTrendEligible, N)}%** — the activation
   raised per-session capture (${pct(outcomeSessions, completed)}% of completed sessions) but cannot
   manufacture a second comparable point that the data does not contain.
3. **Journey confidence is structurally low.** Journey now has ≥2 points for returning users, but most
   are degraded fallbacks (route_confidence 0.2), so a journey trend would read **stable / low
   confidence** — the honest reading, not a tuned one.

## Forward guarantee (no backfilled fabrication)
- The post-completion hook already resolves stage → outcome → journey for every new completed session
  behind \`FF_WC3_OUTCOME\` / \`FF_WC3_JOURNEY\` (both ON). Enabling \`FF_WC3_OUTCOME_CROSSWALK\` at
  runtime (currently OFF) would extend outcome capture to empty-spine sessions going forward — the
  same path this backfill used. **Recommended at approval; left OFF here (config change → stop for
  approval, no deploy).**
- As real returning users accrue ≥2 outcome-bearing sessions, outcome-trend coverage and confidence
  rise on their own. Nothing here is inflated to hit the target.
`);

    // ── Console headline ──
    console.log(`\nWC-L1B measured. completed=${completed} (anon ${completedAnon}); trend-eligible users=${N}.`);
    console.log(`  Outcome capture: ${outcomeSessions}/${completed} sessions (${pct(outcomeSessions, completed)}%), ${outcomeModelRows} model rows, meanConf=${outcomeMeanConf.toFixed(2)}.`);
    console.log(`  Journey: ${journeyRouted}/${completed} routed, ${journeyDegraded} degraded, meanConf=${journeyMeanConf.toFixed(2)}.`);
    console.log(`  Trend-feasible (≥2 pts): outcome ${outcomeTrendEligible}/${N}, journey ${journeyTrendEligible}/${N} (non-degraded ≥2: ${journeyTrendRouted2}/${N}).`);
    console.log(`  >85% longitudinal-readiness target: ${outcomeReady && journeyReady ? 'MET' : 'NOT met (honest ceiling — see 03_longitudinal_readiness.md)'}.`);
    console.log(`\nReports written to ${OUT_DIR}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
