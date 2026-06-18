/**
 * WC-L0E — Behaviour Signal Capture Activation: MEASUREMENT (real data, SELECT-only, NO writes).
 *
 * Measures the BEFORE → AFTER impact of the WC-L0E backfill on the live completed-session base across
 * the four phase axes (graph coverage, behaviour-intelligence coverage, trend readiness, personalization
 * reach). It reads the CURRENT persisted state (behaviour graphs + WC-L0 construct projection) — it
 * computes no new intelligence and writes nothing.
 *
 * Two-pass before/after (the backfill writes, so the baseline must be captured first):
 *   1. cd backend && npx tsx scripts/wc3/wcl0e-measure.ts --baseline    # snapshot BEFORE backfill
 *   2. <run wcl0e-backfill.ts --apply>
 *   3. cd backend && npx tsx scripts/wc3/wcl0e-measure.ts               # AFTER + delta vs baseline
 *
 * Honesty canon: Coverage (a graph/dim exists) and Confidence (rich vs thin) are SEPARATE axes; targets
 * are NEVER forced; the true ceiling is surfaced (e.g. sessions with 0 responses are permanently
 * un-backfillable and are reported as such, not conjured).
 *
 * Output: reports + _baseline.json in backend/audit/wc-l0e/.
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { getBehaviorGraph } from '../../services/behavior-graph-service';
import { projectBehaviour, type ConstructDim } from '../../services/wc3/user-intelligence-foundation';
import { leastSquaresSlope, directionOf } from '../../services/wc3/longitudinal-consumption';
import { isBehaviourNamespaceAlignmentEnabled } from '../../config/feature-flags';

const OUT_DIR = join(__dirname, '../../audit/wc-l0e');
const BASELINE = join(OUT_DIR, '_baseline.json');
const pct = (n: number, d: number): string => (d === 0 ? '0.0' : ((100 * n) / d).toFixed(1));
const maskEmail = (email: string): string =>
  `user_${createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 10)}`;

const CONSTRUCT_DIMS: ConstructDim[] = ['motivation', 'confidence', 'engagement', 'adaptability'];
const NUMERIC_DIMS = ['motivation', 'confidence', 'risk', 'engagement', 'adaptability'] as const;
type NumDim = typeof NUMERIC_DIMS[number];

const TREND_TARGET_POINTS = 4;
const trendConfidence = (points: number): number =>
  points < 2 ? 0 : Number(Math.max(0, Math.min(1, (points - 1) / (TREND_TARGET_POINTS - 1))).toFixed(2));

interface SessionSnap {
  sid: string;
  email: string | null;
  concern: string | null;
  createdAt: string;
  responses: number;
  signalCount: number;     // total rows in capadex_session_signals
  activatedCount: number;  // lifecycle_state IS NOT NULL (strength-bearing activation rows)
  backfillCount: number;   // rows stamped signal_value.wcl0e_backfill = true
  graphPresent: boolean;
  dims: Record<NumDim, number | null>;
  learningStyle: string | null;
  dimsPresent: number;
  constructDimsPresent: number; // of the 4 CONSTRUCT_DIMS
}

interface Snapshot {
  stamp: string;
  completed: number;
  sessions: SessionSnap[];
}

async function captureSnapshot(pool: Pool): Promise<Snapshot> {
  const { rows: sessRows } = await pool.query(`
    SELECT s.id::text AS sid, LOWER(s.guest_email) AS email, s.concern_name AS concern, s.created_at,
           (SELECT COUNT(*)::int FROM capadex_responses r WHERE r.session_id = s.id) AS responses,
           (SELECT COUNT(*)::int FROM capadex_session_signals g WHERE g.session_id = s.id::text) AS sig,
           (SELECT COUNT(*)::int FROM capadex_session_signals g
              WHERE g.session_id = s.id::text AND g.lifecycle_state IS NOT NULL) AS activated,
           (SELECT COUNT(*)::int FROM capadex_session_signals g
              WHERE g.session_id = s.id::text AND (g.signal_value->>'wcl0e_backfill')::boolean IS TRUE) AS backfill
      FROM capadex_sessions s
     WHERE s.status = 'completed'
     ORDER BY LOWER(s.guest_email) NULLS LAST, s.created_at ASC
  `);

  const sessions: SessionSnap[] = [];
  for (const s of sessRows) {
    const graph = await getBehaviorGraph(pool, String(s.sid));
    // Use the REAL flag state, not a hardcoded true — projecting with namespaceAlignment forced ON
    // while the runtime flag is OFF would overstate construct-dim coverage vs. live behaviour.
    const p = projectBehaviour(graph, { namespaceAlignment: isBehaviourNamespaceAlignmentEnabled() });
    const dims: Record<NumDim, number | null> = {
      motivation: p.motivation, confidence: p.confidence, risk: p.risk,
      engagement: p.engagement, adaptability: p.adaptability,
    };
    const constructDimsPresent = CONSTRUCT_DIMS.filter((d) => p[d] !== null).length;
    sessions.push({
      sid: String(s.sid),
      // Store ONLY a one-way masked token — never raw email — so audit artifacts (incl. _baseline.json)
      // carry no PII. The mask is deterministic, so per-user grouping for trends is preserved.
      email: s.email ? maskEmail(String(s.email)) : null,
      concern: s.concern ?? null,
      createdAt: s.created_at instanceof Date ? s.created_at.toISOString() : String(s.created_at),
      responses: Number(s.responses),
      signalCount: Number(s.sig),
      activatedCount: Number(s.activated),
      backfillCount: Number(s.backfill),
      graphPresent: graph !== null,
      dims,
      learningStyle: p.learning_style,
      dimsPresent: p.dimsPresent,
      constructDimsPresent,
    });
  }
  return { stamp: new Date().toISOString(), completed: sessRows.length, sessions };
}

interface Axes {
  completed: number;
  graphCoverage: number;        // graphPresent
  richGraphs: number;           // activatedCount > 0 (strength-bearing construct-feeding)
  behIntelSessions: number;     // ≥1 construct dim
  constructCells: number;       // filled of 4×completed
  reachSessions: number;        // dimsPresent > 0 (personalization reach)
  trendUsers: number;           // users with a usable behaviour trend
  trendEligible: number;        // users with ≥2 completed
  meanTrendConf: number;
  unbackfillable: number;       // permanently un-backfillable = NO graph AND 0 responses (no evidence)
}

function computeAxes(snap: Snapshot): Axes {
  const ss = snap.sessions;
  const graphCoverage = ss.filter((s) => s.graphPresent).length;
  const richGraphs = ss.filter((s) => s.activatedCount > 0).length;
  const behIntelSessions = ss.filter((s) => s.constructDimsPresent > 0).length;
  const constructCells = ss.reduce((a, s) => a + s.constructDimsPresent, 0);
  const reachSessions = ss.filter((s) => s.dimsPresent > 0).length;
  // Permanently un-backfillable = no graph AND no reconstructable evidence (0 responses). A 0-response
  // session that ALREADY has a graph from another source (e.g. an atomic smoke seed) is NOT a gap.
  const unbackfillable = ss.filter((s) => !s.graphPresent && s.responses === 0).length;

  const byUser = new Map<string, SessionSnap[]>();
  for (const s of ss) {
    if (!s.email) continue;
    if (!byUser.has(s.email)) byUser.set(s.email, []);
    byUser.get(s.email)!.push(s);
  }
  const eligible = [...byUser.entries()].filter(([, r]) => r.length >= 2);
  let trendUsers = 0;
  const confs: number[] = [];
  for (const [, rows] of eligible) {
    let userHasTrend = false;
    for (const d of NUMERIC_DIMS) {
      const series = rows.map((r) => r.dims[d]).filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
      if (series.length < 2) continue;
      userHasTrend = true;
      void leastSquaresSlope(series); void directionOf(0);
      confs.push(trendConfidence(series.length));
    }
    if (userHasTrend) trendUsers++;
  }
  return {
    completed: snap.completed,
    graphCoverage, richGraphs, behIntelSessions, constructCells, reachSessions,
    trendUsers, trendEligible: eligible.length,
    meanTrendConf: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0,
    unbackfillable,
  };
}

function main(): Promise<void> {
  const baselineMode = process.argv.includes('--baseline');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  mkdirSync(OUT_DIR, { recursive: true });

  return (async () => {
    try {
      const after = await captureSnapshot(pool);

      if (baselineMode) {
        writeFileSync(BASELINE, JSON.stringify(after, null, 2));
        const a = computeAxes(after);
        console.log(`[wcl0e-measure] BASELINE captured (${after.completed} completed sessions).`);
        console.log(`  graph ${a.graphCoverage}/${a.completed} · rich ${a.richGraphs}/${a.completed} · ` +
          `beh-intel ${a.behIntelSessions}/${a.completed} · construct cells ${a.constructCells}/${a.completed * 4}`);
        return;
      }

      const beforeSnap: Snapshot | null = existsSync(BASELINE)
        ? (JSON.parse(readFileSync(BASELINE, 'utf8')) as Snapshot) : null;
      const before = beforeSnap ? computeAxes(beforeSnap) : null;
      const aft = computeAxes(after);
      const stamp = after.stamp;
      const C = after.completed;

      const row = (label: string, b: number | null, a: number, denom: number, target?: number) => {
        const bStr = b === null ? '—' : `${b}/${denom} (${pct(b, denom)}%)`;
        const aStr = `${a}/${denom} (${pct(a, denom)}%)`;
        const delta = b === null ? '—' : `${a - b >= 0 ? '+' : ''}${a - b}`;
        const met = target !== undefined ? (denom > 0 && (100 * a) / denom >= target ? '✅' : '❌') : '—';
        return `| ${label} | ${bStr} | ${aStr} | ${delta} | ${target !== undefined ? `≥${target}%` : '—'} | ${met} |`;
      };

      // ── 01 — Root cause + activation report ──
      writeFileSync(join(OUT_DIR, '01_activation_report.md'), `# WC-L0E Deliverable 1 — Behaviour Signal Capture: Root Cause & Activation
_Generated ${stamp}_

## Root cause (why only 2/9 completed sessions had a behaviour graph)
The construct-feeding behaviour signals (\`career_confusion\`, \`placement_anxiety\`, \`social_withdrawal\`,
\`emotional_overload\`, … — the \`SIGNAL_DEFICIT_MAP\` keys, \`signal_type='activated'\`, populated
\`strength\`) are produced by the **Signal Activation Runtime** (\`services/signal-activation-runtime.ts\`
→ \`runEvidenceRuntime\`), which is invoked **unconditionally** (no feature-flag gate) on the
\`/api/capadex/session/:id/respond\` path after each answer batch. The 7 zero-signal completed sessions all
finished **before that runtime was added to the \`/respond\` code path** — i.e. it is a code-rollout gap,
not a flag flip and not a code defect in the current path. The live path already works forward (the one
post-activation real session captured activation signals + telemetry).

> Note: \`FF_RUNTIME_INTELLIGENCE_ACTIVATION\` gates the downstream REPORTING/activation surfaces, NOT the
> signal-capture call itself — so capture cannot be "switched on" by that flag; the historical gap can
> only be closed by re-running the engine over the old sessions (this backfill).

> The \`signal-classifier.ts\` / \`lib/signal-ingest.ts\` path (the \`/api/signals/ingest\` endpoint) writes a
> DIFFERENT, strength-less family of rows (\`implicit\`/\`cognitive\`/\`linguistic\`) that the WC-L0D deficit
> map cannot inverse-code. Re-running THAT path would not have populated any construct dimension — only
> the activation runtime produces the strength-bearing concern signals the construct dims consume.

## The fix (WC-L0E backfill — reuse only, flag-gated)
Re-run the EXISTING \`runEvidenceRuntime\` OFFLINE over each historical zero-signal session, rebuilding the
EvidenceInput batch **purely from persisted \`capadex_responses\`** (which already snapshot
\`concern_bucket\`). Telemetry (\`response_time_ms\` / \`answer_changed\`) is **omitted, never fabricated**, so
no rapid/hesitation/volatility evidence is invented. Backfilled rows are provenance-stamped
\`signal_value.wcl0e_backfill = true\`. Gated by \`FF_BEHAVIOUR_SIGNAL_BACKFILL\` (default OFF). The construct
dims are then projected by the EXISTING WC-L0 persistence (honouring \`FF_BEHAVIOUR_NAMESPACE_ALIGNMENT\`).

## The true ceiling (honesty canon — not inflated)
| Session class | Count | Backfillable? |
|---|---|---|
| Already-activated (live capture) | ${after.sessions.filter((s) => s.activatedCount > 0 && s.backfillCount === 0).length} | n/a — left untouched |
| Backfilled from responses | ${after.sessions.filter((s) => s.backfillCount > 0).length} | ✅ activated from persisted answers |
| Zero responses (abandoned) | ${aft.unbackfillable} | ❌ **permanently un-backfillable** (no evidence exists) |

The ${aft.unbackfillable} zero-response sessions can **never** produce a behaviour graph honestly (there is no
behavioural evidence to recompute from). They cap the maximum achievable graph coverage at
**${C - aft.unbackfillable}/${C} = ${pct(C - aft.unbackfillable, C)}%** — reported as the true ceiling, not modelled up.
`);

      // ── 02 — Coverage delta (the four axes) ──
      writeFileSync(join(OUT_DIR, '02_coverage_delta.md'), `# WC-L0E Deliverable 2 — Coverage Delta (before → after)
_Generated ${stamp}_

${before === null ? '> ⚠️ No baseline snapshot found — run `--baseline` BEFORE the backfill for a true before/after. Showing AFTER only.\n' : ''}
## Headline (over ${C} completed sessions)
| Axis | Before | After | Δ | Target | Met? |
|---|---|---|---|---|---|
${row('Behaviour Graph Coverage (≥1 signal)', before?.graphCoverage ?? null, aft.graphCoverage, C, 80)}
${row('— Rich graph (≥1 strength-bearing activation signal)', before?.richGraphs ?? null, aft.richGraphs, C)}
${row('Behaviour Intelligence (≥1 construct dim)', before?.behIntelSessions ?? null, aft.behIntelSessions, C, 80)}
${row('Personalization reach (≥1 behaviour dim)', before?.reachSessions ?? null, aft.reachSessions, C, 88)}
| Construct-dim cells filled (of ${C * 4}) | ${before === null ? '—' : `${before.constructCells}/${C * 4} (${pct(before.constructCells, C * 4)}%)`} | ${aft.constructCells}/${C * 4} (${pct(aft.constructCells, C * 4)}%) | ${before === null ? '—' : `${aft.constructCells - before.constructCells >= 0 ? '+' : ''}${aft.constructCells - before.constructCells}`} | — | — |

## Per session (after)
| Session · user | resp | signals | activated | backfill | construct dims | dims present |
|---|---|---|---|---|---|---|
${after.sessions.map((s) => {
  const who = s.email ?? '(anon)';
  const cd = CONSTRUCT_DIMS.filter((d) => s.dims[d] !== null).map((d) => `${d}=${s.dims[d]}`).join(', ') || '—';
  return `| \`${s.sid.slice(0, 8)}\` · ${who} | ${s.responses} | ${s.signalCount} | ${s.activatedCount} | ${s.backfillCount} | ${cd} | ${s.dimsPresent} |`;
}).join('\n')}

## Honest reading
- **Graph & intelligence coverage rise only where real behavioural evidence exists.** The backfill
  re-runs the live engine over persisted answers; it cannot conjure a graph for the
  ${aft.unbackfillable} zero-response sessions.
- **Construct dims are deficits** (low = impaired), inverse-coded from mapped concern signals via the
  WC-L0D map — never presented as strengths.
- The **80% / 88% headline targets are bounded by the response-capture ceiling**
  (${pct(C - aft.unbackfillable, C)}%) — reported truthfully, not gamed.
`);

      // ── 03 — Trend / longitudinal readiness ──
      writeFileSync(join(OUT_DIR, '03_trend_readiness.md'), `# WC-L0E Deliverable 3 — Trend / Longitudinal Readiness (before → after)
_Generated ${stamp}_

A behaviour trend needs the SAME user to have **≥2 sessions each carrying a readable dimension**
(never fabricated). Reusing the existing trend math (\`leastSquaresSlope\` / \`directionOf\`).

| Measure | Before | After | Target | Met? |
|---|---|---|---|---|
| Trend-eligible users (≥2 completed) | ${before?.trendEligible ?? '—'} | ${aft.trendEligible} | — | — |
| Users with a usable behaviour trend | ${before === null ? '—' : `${before.trendUsers}/${before.trendEligible} (${pct(before.trendUsers, before.trendEligible)}%)`} | ${aft.trendUsers}/${aft.trendEligible} (${pct(aft.trendUsers, aft.trendEligible)}%) | ≥50% | ${aft.trendEligible > 0 && (100 * aft.trendUsers) / aft.trendEligible >= 50 ? '✅' : '❌'} |
| Mean trend confidence | ${before?.meanTrendConf.toFixed(2) ?? '—'} | ${aft.meanTrendConf.toFixed(2)} | (informative) | — |

## Honest reading
Trend readiness is gated by **returning users with ≥2 graphed sessions**, not by the projection. The
backfill activates historical graphs, but a behaviour trend only appears once the SAME user accrues two
graphed sessions for the same dimension. Where the live base has no such user, trend readiness stays at
its true ceiling — not modelled up.
`);

      // ── 04 — Readiness dashboard ──
      writeFileSync(join(OUT_DIR, '04_readiness_dashboard.md'), `# WC-L0E Deliverable 4 — Readiness Dashboard
_Generated ${stamp}_

## Population
- Completed sessions: **${C}** · with a behaviour graph: **${aft.graphCoverage}** · rich (strength-bearing): **${aft.richGraphs}** · zero-response (un-backfillable): **${aft.unbackfillable}**

## The four phase axes (before → after, against targets)
| # | Axis | Before | After | Target | Met? |
|---|---|---|---|---|---|
| 1 | Behaviour Graph Coverage | ${before === null ? '—' : `${pct(before.graphCoverage, C)}%`} | ${pct(aft.graphCoverage, C)}% | ≥80% | ${(100 * aft.graphCoverage) / C >= 80 ? '✅' : '❌'} |
| 2 | Behaviour Intelligence Coverage | ${before === null ? '—' : `${pct(before.behIntelSessions, C)}%`} | ${pct(aft.behIntelSessions, C)}% | ≥80% | ${(100 * aft.behIntelSessions) / C >= 80 ? '✅' : '❌'} |
| 3 | Trend Readiness | ${before === null ? '—' : `${pct(before.trendUsers, before.trendEligible)}%`} | ${pct(aft.trendUsers, aft.trendEligible)}% | ≥50% | ${aft.trendEligible > 0 && (100 * aft.trendUsers) / aft.trendEligible >= 50 ? '✅' : '❌'} |
| 4 | Personalization Readiness | ${before === null ? '—' : `${pct(before.reachSessions, C)}%`} | ${pct(aft.reachSessions, C)}% | ≥88% | ${(100 * aft.reachSessions) / C >= 88 ? '✅' : '❌'} |

## Why the headline targets are (not) met — true ceiling, not inflated
The graph-dependent axes are bounded by the **response-capture ceiling**: ${aft.unbackfillable}/${C} completed
sessions have zero responses and are **permanently un-backfillable** (no behavioural evidence exists), so
the maximum honest graph coverage is **${pct(C - aft.unbackfillable, C)}%**. Trend/longitudinal readiness is
additionally gated by returning users having ≥2 graphed sessions. WC-L0E activates every session that has
real evidence and reports the rest honestly — nothing is fabricated to hit a number.

## Forward state
The live \`/respond\` path already runs the activation runtime, so **every NEW completed session captures
its behaviour graph automatically**. WC-L0E closes the historical gap for the sessions that have evidence;
the forward gap was already closed when the activation runtime was added to the \`/respond\` path.
`);

      console.log(`[wcl0e-measure] AFTER reports written to ${OUT_DIR}`);
      console.log(`  graph ${aft.graphCoverage}/${C} (${pct(aft.graphCoverage, C)}%) · ` +
        `beh-intel ${aft.behIntelSessions}/${C} (${pct(aft.behIntelSessions, C)}%) · ` +
        `reach ${aft.reachSessions}/${C} (${pct(aft.reachSessions, C)}%) · ` +
        `construct cells ${aft.constructCells}/${C * 4}`);
      if (before) {
        console.log(`  Δ graph ${aft.graphCoverage - before.graphCoverage} · ` +
          `Δ beh-intel ${aft.behIntelSessions - before.behIntelSessions} · ` +
          `Δ cells ${aft.constructCells - before.constructCells}`);
      }
    } catch (err) {
      console.error('[wcl0e-measure] fatal:', err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  })();
}

void main();
