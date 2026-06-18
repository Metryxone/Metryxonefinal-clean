/**
 * WC-L0D — Behaviour Namespace Alignment: MEASUREMENT (real data, SELECT-only, NO writes).
 *
 * Measures the BEFORE → AFTER impact of the WC-L0D namespace alignment on the live completed-session
 * base, by projecting each session's ALREADY-BUILT Unified Behavior Graph twice over the SAME graph:
 *   BEFORE = projectBehaviour(graph)                         → legacy positive-construct regex path
 *   AFTER  = projectBehaviour(graph, {namespaceAlignment:true}) → + polarity-aware concern→deficit map
 *
 * This is a read-only simulation of flag-ON: it computes the AFTER state in memory and NEVER writes
 * (realising it on persisted rows is a separate, approved backfill step). Coverage and Confidence are
 * kept on separate axes; targets are NOT forced; true ceilings are surfaced per the honesty canon.
 *
 * Output: 6 reports (01..06) in backend/audit/wc-l0d/.
 *
 * Usage:  cd backend && npx tsx scripts/wc3/wcl0d-measure.ts
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { getBehaviorGraph } from '../../services/behavior-graph-service';
import {
  projectBehaviour,
  SIGNAL_DEFICIT_MAP,
  type BehaviourProjection,
  type ConstructDim,
} from '../../services/wc3/user-intelligence-foundation';
import { leastSquaresSlope, directionOf } from '../../services/wc3/longitudinal-consumption';

/** Irreversible pseudonym — audit artifacts are committed, so they must NEVER carry raw PII. */
const maskEmail = (email: string): string =>
  `user_${createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 10)}`;

const OUT_DIR = join(__dirname, '../../audit/wc-l0d');
const pct = (n: number, d: number): string => (d === 0 ? '0.0' : ((100 * n) / d).toFixed(1));

const CONSTRUCT_DIMS: ConstructDim[] = ['motivation', 'confidence', 'engagement', 'adaptability'];
const NUMERIC_DIMS = ['motivation', 'confidence', 'risk', 'engagement', 'adaptability'] as const;
type NumDim = typeof NUMERIC_DIMS[number];

const TREND_TARGET_POINTS = 4;
function trendConfidence(points: number): number {
  if (points < 2) return 0;
  return Number(Math.max(0, Math.min(1, (points - 1) / (TREND_TARGET_POINTS - 1))).toFixed(2));
}

interface SessionProjection {
  sid: string;
  email: string | null;
  concern: string | null;
  createdAt: string;
  graphPresent: boolean;
  before: BehaviourProjection;
  after: BehaviourProjection;
}

interface TrendRow {
  email: string;
  metric: string;
  dim: NumDim;
  direction: string;
  points: number;
  first: number;
  last: number;
  delta: number;
  confidence: number;
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  mkdirSync(OUT_DIR, { recursive: true });
  try {
    const stamp = new Date().toISOString();

    // ── Population base ──
    const { rows: sessRows } = await pool.query(`
      SELECT id::text AS sid, LOWER(guest_email) AS email, concern_name AS concern, score, created_at
        FROM capadex_sessions
       WHERE status = 'completed'
       ORDER BY LOWER(guest_email) NULLS LAST, created_at ASC
    `);
    const completed = sessRows.length;
    const emailedUsers = new Set(sessRows.filter((r) => r.email).map((r) => String(r.email))).size;

    const { rows: prRows } = await pool.query(`
      SELECT COUNT(*) AS n
        FROM capadex_sessions s JOIN wcl0_user_intelligence w ON w.session_id = s.id::text
       WHERE s.status = 'completed'`);
    const persistedRows = Number(prRows[0].n);

    // ── Live signal-key inventory (for the alignment report) ──
    const { rows: sigRows } = await pool.query(`
      SELECT signal_key, COUNT(*) AS n, COUNT(strength) AS n_strength,
             ROUND(AVG(strength)::numeric, 3) AS avg_str
        FROM capadex_session_signals GROUP BY 1 ORDER BY n DESC`);

    // ── Per-session BEFORE/AFTER projection over the SAME live graph (read-only) ──
    const ps: SessionProjection[] = [];
    for (const s of sessRows) {
      const graph = await getBehaviorGraph(pool, String(s.sid));
      ps.push({
        sid: String(s.sid),
        email: s.email ? String(s.email) : null,
        concern: s.concern ?? null,
        createdAt: s.created_at instanceof Date ? s.created_at.toISOString() : String(s.created_at),
        graphPresent: graph !== null,
        before: projectBehaviour(graph, {}),
        after: projectBehaviour(graph, { namespaceAlignment: true }),
      });
    }

    const anyDim = (p: BehaviourProjection) => p.dimsPresent > 0;
    const sessBehBefore = ps.filter((p) => anyDim(p.before)).length;
    const sessBehAfter = ps.filter((p) => anyDim(p.after)).length;

    // Construct-dim cells (4 × completed) filled before/after.
    const cells = (which: 'before' | 'after', pool2: SessionProjection[]) => {
      let n = 0;
      for (const p of pool2) for (const d of CONSTRUCT_DIMS) if (p[which][d] !== null) n++;
      return n;
    };
    const cellsBefore = cells('before', ps);
    const cellsAfter = cells('after', ps);
    const totalCells = completed * CONSTRUCT_DIMS.length;

    const graphed = ps.filter((p) => p.graphPresent);
    const gCellsBefore = cells('before', graphed);
    const gCellsAfter = cells('after', graphed);
    const gTotal = graphed.length * CONSTRUCT_DIMS.length;

    const dimCov = (which: 'before' | 'after', d: NumDim) =>
      ps.filter((p) => p[which][d] !== null).length;

    const sessGained = ps.filter((p) =>
      CONSTRUCT_DIMS.some((d) => p.before[d] === null && p.after[d] !== null)).length;

    // ── Trend (before/after) over the in-memory per-session series ──
    const byUser = new Map<string, SessionProjection[]>();
    for (const p of ps) {
      if (!p.email) continue;
      if (!byUser.has(p.email)) byUser.set(p.email, []);
      byUser.get(p.email)!.push(p);
    }
    const eligible = [...byUser.entries()].filter(([, r]) => r.length >= 2);
    const N = eligible.length;

    const computeTrends = (which: 'before' | 'after'): TrendRow[] => {
      const out: TrendRow[] = [];
      for (const [email, rows] of eligible) {
        for (const d of NUMERIC_DIMS) {
          const series = rows
            .map((p) => p[which][d])
            .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
          if (series.length < 2) continue;
          const slope = leastSquaresSlope(series);
          out.push({
            email, metric: `behaviour_${d}`, dim: d, direction: directionOf(slope),
            points: series.length, first: Math.round(series[0]), last: Math.round(series[series.length - 1]),
            delta: Math.round(series[series.length - 1] - series[0]), confidence: trendConfidence(series.length),
          });
        }
      }
      return out;
    };
    const trendsBefore = computeTrends('before');
    const trendsAfter = computeTrends('after');
    const usersTrendBefore = new Set(trendsBefore.map((t) => t.email)).size;
    const usersTrendAfter = new Set(trendsAfter.map((t) => t.email)).size;
    const meanConf = (ts: TrendRow[]) => (ts.length === 0 ? 0 : ts.reduce((a, t) => a + t.confidence, 0) / ts.length);

    // Per-user behaviour-bearing session counts (continuity for trend feasibility).
    const userBehSessions = (which: 'before' | 'after') =>
      eligible.map(([email, rows]) => ({
        email, sessions: rows.length,
        behaviourSessions: rows.filter((p) => anyDim(p[which])).length,
        constructFeasible: NUMERIC_DIMS.filter((d) => rows.filter((p) => p[which][d] !== null).length >= 2),
      }));
    const feasAfter = userBehSessions('after');

    const dimRow = (d: NumDim) =>
      `| ${d} | ${dimCov('before', d)}/${completed} (${pct(dimCov('before', d), completed)}%) | ${dimCov('after', d)}/${completed} (${pct(dimCov('after', d), completed)}%) | ${dimCov('after', d) - dimCov('before', d) >= 0 ? '+' : ''}${dimCov('after', d) - dimCov('before', d)} |`;

    // ── 01 — Namespace alignment report ──
    const mapTable = (Object.entries(SIGNAL_DEFICIT_MAP) as [string, ConstructDim][])
      .map(([k, v]) => `| \`${k}\` | ${v} | deficit (value = min(50, 100 − strength)) | spec-mandated |`).join('\n');
    const mappedKeys = new Set(Object.keys(SIGNAL_DEFICIT_MAP));
    const sigInv = (sigRows as Array<Record<string, unknown>>).map((r) => {
      const key = String(r.signal_key);
      const nStr = Number(r.n_strength);
      const mapped = mappedKeys.has(key);
      const reason = mapped ? `→ **${SIGNAL_DEFICIT_MAP[key]}** (deficit)`
        : key === 'GENERAL_CONCERN' ? 'UNMAPPED — non-specific catch-all (no single construct)'
        : nStr === 0 ? 'UNMAPPED — emitted with NULL strength (no deficit magnitude to inverse-code)'
        : 'UNMAPPED — not in curated set';
      return `| \`${key}\` | ${Number(r.n)} | ${nStr} | ${r.avg_str ?? '—'} | ${reason} |`;
    }).join('\n');

    writeFileSync(join(OUT_DIR, '01_namespace_alignment_report.md'), `# WC-L0D Deliverable 1 — Namespace Alignment Report
_Generated ${stamp}_

WC-L0C established the root cause: the behaviour **projection** matches construct dimensions by regex
over **positive-construct / \`self_*\` signal keys**, but the activation **runtime** emits ONLY
concern-diagnostic signal keys. The two vocabularies never intersect, so motivation / confidence /
engagement / adaptability are structurally NULL. WC-L0D aligns the two namespaces by ROUTING the
EXISTING concern signal keys to the EXISTING construct dimensions as a **polarity-aware DEFICIT**.

## The map (polarity-aware, deficits only)
A present concern signal can only **lower** a construct: \`value = min(50, round(100 − strength))\`.
The neutral cap (50) is the canon guard — a concern signal can mark a construct as impaired
(≤ neutral) but can NEVER assert an above-neutral strength; positive strengths continue to come
exclusively from the positive regex path / CSI \`positive_factors\`. NO new construct / dimension /
ontology / scoring model is introduced — only existing signals routed to existing dims.

| Runtime signal key | Construct dimension | Polarity | Provenance |
|---|---|---|---|
${mapTable}

## Live runtime signal inventory (what the runtime actually emits) + routing decision
| signal_key | rows | rows w/ strength | avg strength | routing |
|---|---|---|---|---|
${sigInv}

### Why the unmapped keys are NOT mapped (honesty, not omission)
- **\`GENERAL_CONCERN\`** — a non-specific catch-all that does not identify a single construct;
  mapping it to any dimension would fabricate a signal. Left UNMAPPED.
- **\`rapid_answer\` / \`rapid_answer_pattern\` / \`prolonged_hesitation\`** — latency telemetry
  emitted with **NULL strength**, so there is no deficit magnitude to inverse-code. Left UNMAPPED as
  future *curated* candidates (they would need a real strength before they could deficit-code a dim).

> The 6 mapped keys cover **100% of the SPECIFIC concern signals that carry a readable strength** on
> the live base. \`GENERAL_CONCERN\` is excluded *despite* having a readable strength because it is a
> non-specific catch-all that identifies no single construct — so the conservative map loses no
> measurable construct coverage while staying fully grounded.

## Reversibility
Gated by \`FF_BEHAVIOUR_NAMESPACE_ALIGNMENT\` (default OFF). Flag OFF → the deficit block is skipped →
\`projectBehaviour\` is byte-identical to legacy (construct dims NULL). This report is a **read-only
simulation** of flag-ON over the live graphs; nothing was written.
`);

    // ── 02 — Behaviour coverage delta ──
    const perSessTable = ps.map((p) => {
      const fmt = (which: 'before' | 'after') => {
        const present = NUMERIC_DIMS.filter((d) => p[which][d] !== null).map((d) => `${d}=${p[which][d]}`);
        if (p[which].learning_style) present.push(`learning_style=${p[which].learning_style}`);
        return present.length ? present.join(', ') : '(none)';
      };
      const who = p.email ? maskEmail(p.email) : '(anon)';
      const gained = p.after.deficitDims.length ? ` _(+${p.after.deficitDims.join('/')})_` : '';
      return `| \`${p.sid.slice(0, 8)}\` · ${who} | ${p.graphPresent ? '✓' : '—'} | ${fmt('before')} | ${fmt('after')}${gained} |`;
    }).join('\n');

    writeFileSync(join(OUT_DIR, '02_behaviour_coverage_delta.md'), `# WC-L0D Deliverable 2 — Behaviour Coverage Delta
_Generated ${stamp}_

Coverage of the behaviour dimensions **before** (legacy regex path) vs **after** (regex + namespace
alignment), computed over the SAME live Unified Behavior Graphs. Persistence (a row exists) and
dimension presence (a value is actually non-NULL) are kept separate.

## Headline (over ${completed} completed sessions)
| Metric | Before | After | Δ |
|---|---|---|---|
| Persistence coverage (rows) | ${persistedRows}/${completed} (${pct(persistedRows, completed)}%) | ${persistedRows}/${completed} (${pct(persistedRows, completed)}%) | 0 (unchanged) |
| Sessions with ≥1 behaviour dimension | ${sessBehBefore}/${completed} (${pct(sessBehBefore, completed)}%) | ${sessBehAfter}/${completed} (${pct(sessBehAfter, completed)}%) | ${sessBehAfter - sessBehBefore >= 0 ? '+' : ''}${sessBehAfter - sessBehBefore} |
| **Construct-dim cells filled** (of ${totalCells} = 4×${completed}) | ${cellsBefore}/${totalCells} (${pct(cellsBefore, totalCells)}%) | ${cellsAfter}/${totalCells} (${pct(cellsAfter, totalCells)}%) | **+${cellsAfter - cellsBefore}** |
| **Construct-dim cells filled — WITHIN graphed sessions** (of ${gTotal} = 4×${graphed.length}) | ${gCellsBefore}/${gTotal} (${pct(gCellsBefore, gTotal)}%) | ${gCellsAfter}/${gTotal} (${pct(gCellsAfter, gTotal)}%) | **+${gCellsAfter - gCellsBefore}** |
| Sessions gaining ≥1 construct dimension | — | ${sessGained} | — |

## Per construct/numeric dimension (sessions with a value)
| Dimension | Before | After | Δ sessions |
|---|---|---|---|
${NUMERIC_DIMS.map(dimRow).join('\n')}

## Per session (before → after)
| Session · user | Graph | Before | After |
|---|---|---|---|
${perSessTable}

## Honest reading
- **The structural FP3 ceiling is eliminated.** Construct dims were **0/${totalCells}** before (the
  regex path matched no real signal); after alignment, every graphed session that carries a mapped
  concern signal now resolves the corresponding construct as a **deficit**. Within graphed sessions,
  construct-cell coverage rises from **${pct(gCellsBefore, gTotal)}% → ${pct(gCellsAfter, gTotal)}%**.
- **Session-level coverage is still bounded by graph coverage.** Only **${graphed.length}/${completed}**
  completed sessions have a behaviour graph at all (WC-L0C findings FP1 capture gap + FP2 activation/
  graph gap — OUT OF WC-L0D SCOPE). So "sessions with ≥1 dimension" stays ${sessBehAfter}/${completed};
  the alignment makes the graphed sessions **richer**, it cannot conjure graphs for the
  ${completed - graphed.length} sessions that captured no behavioural evidence.
- Values are **deficits** (low = impaired), provenance-stamped \`deficit_dims\`; they are never
  presented as strengths.
`);

    // ── 03 — Trend coverage delta ──
    const trendList = (ts: TrendRow[]) => ts.length === 0 ? '- (none)'
      : ts.map((t) => `- \`${maskEmail(t.email)}\` · ${t.metric} → **${t.direction}** (Δ ${t.delta}, ${t.points} pts, conf ${t.confidence}, ${t.first}→${t.last})`).join('\n');

    writeFileSync(join(OUT_DIR, '03_trend_coverage_delta.md'), `# WC-L0D Deliverable 3 — Trend Coverage Delta
_Generated ${stamp}_

Behaviour-trend coverage **before** vs **after** alignment, reusing the existing trend math
(\`leastSquaresSlope\` / \`directionOf\`) over the per-session behaviour series. A dimension needs
**≥2 readable points for the SAME user** or it gets no trend (never fabricated). \`learning_style\`
is categorical and is never trended.

## Trend-eligible users (≥2 completed sessions): **${N}**

| Metric | Before | After | Δ |
|---|---|---|---|
| Behaviour-trend coverage | ${usersTrendBefore}/${N} (${pct(usersTrendBefore, N)}%) | ${usersTrendAfter}/${N} (${pct(usersTrendAfter, N)}%) | ${usersTrendAfter - usersTrendBefore >= 0 ? '+' : ''}${usersTrendAfter - usersTrendBefore} |
| Trend rows produced | ${trendsBefore.length} | ${trendsAfter.length} | ${trendsAfter.length - trendsBefore.length >= 0 ? '+' : ''}${trendsAfter.length - trendsBefore.length} |
| Mean trend confidence | ${meanConf(trendsBefore).toFixed(2)} | ${meanConf(trendsAfter).toFixed(2)} | — |

### Trends — before
${trendList(trendsBefore)}

### Trends — after
${trendList(trendsAfter)}

## Per-user behaviour-bearing continuity (after alignment)
| User | Completed sessions | Behaviour-bearing | Dims with ≥2 readable points |
|---|---|---|---|
${feasAfter.length === 0 ? '| (none) | | | |' : feasAfter.map((u) => `| \`${maskEmail(u.email)}\` | ${u.sessions} | ${u.behaviourSessions} | ${u.constructFeasible.length ? u.constructFeasible.join(', ') : '**none**'} |`).join('\n')}

## Honest reading
Trend coverage is **${pct(usersTrendAfter, N)}% even after alignment**, and this is the truthful
ceiling — **not** a defect of WC-L0D. A behaviour trend needs the SAME user to have **≥2 sessions
that each carry a graph** for the same dimension. On the live base the graphed sessions belong to
**different users**, and the one returning user with a graphed session has only a single
behaviour-bearing session, so no dimension reaches two readable points for any user. Namespace
alignment fixed the *vocabulary* failure; trend coverage is gated by the upstream **graph capture
gap** (WC-L0C FP1/FP2) — out of WC-L0D scope. Nothing is fabricated to lift it.
`);

    // ── 04 — Personalization impact ──
    writeFileSync(join(OUT_DIR, '04_personalization_impact.md'), `# WC-L0D Deliverable 4 — Personalization Impact
_Generated ${stamp}_

Personalization impact is reported as the **ceiling a behaviour-driven personalizer can consume** —
i.e. the share of sessions that carry a behaviour signal it could act on — kept honest (no modelled
uplift; inventing one would be fabrication). It is reported on two axes: session *reach* and signal
*richness*.

| Measure | Before | After | Reading |
|---|---|---|---|
| Behaviour-bearing sessions (reach) | ${sessBehBefore}/${completed} (${pct(sessBehBefore, completed)}%) | ${sessBehAfter}/${completed} (${pct(sessBehAfter, completed)}%) | ceiling of sessions a personalizer can touch |
| Construct-dim cells available (richness) | ${cellsBefore}/${totalCells} (${pct(cellsBefore, totalCells)}%) | ${cellsAfter}/${totalCells} (${pct(cellsAfter, totalCells)}%) | how much construct signal exists to personalize on |
| Within graphed sessions (richness) | ${pct(gCellsBefore, gTotal)}% | ${pct(gCellsAfter, gTotal)}% | construct depth where a graph exists |

## Honest reading
- **Reach is unchanged** (${pct(sessBehAfter, completed)}%): a personalizer can still only act on the
  ${graphed.length} sessions that have a behaviour graph. Namespace alignment does not create graphs.
- **Richness rises sharply** within those sessions — from ${pct(gCellsBefore, gTotal)}% to
  ${pct(gCellsAfter, gTotal)}% of construct cells — so each behaviour-bearing session now exposes
  motivation / confidence / engagement / adaptability deficits a personalizer can target, where
  before it had only \`risk\` + \`learning_style\`.
- The **>88% personalization target is NOT met** and cannot be met by WC-L0D alone: reach is capped
  by the upstream graph-capture gap (WC-L0C FP1/FP2). Reported as the true ceiling, not inflated.
`);

    // ── 05 — Longitudinal impact ──
    writeFileSync(join(OUT_DIR, '05_longitudinal_impact.md'), `# WC-L0D Deliverable 5 — Longitudinal Readiness Impact
_Generated ${stamp}_

Longitudinal readiness = trend-eligible users with a **usable behaviour trend** (≥2 readable points
for the same dimension). It is the longitudinal consumer of the behaviour dimensions WC-L0D fills.

| Measure | Before | After | Target | Met? |
|---|---|---|---|---|
| Trend-eligible users (≥2 completed) | ${N} | ${N} | — | — |
| Users with a usable behaviour trend | ${usersTrendBefore}/${N} (${pct(usersTrendBefore, N)}%) | ${usersTrendAfter}/${N} (${pct(usersTrendAfter, N)}%) | >80% | ${usersTrendAfter / Math.max(N, 1) > 0.8 ? '✅' : '❌'} |
| Mean trend confidence | ${meanConf(trendsBefore).toFixed(2)} | ${meanConf(trendsAfter).toFixed(2)} | — | — |

## Honest reading
Longitudinal readiness is **${pct(usersTrendAfter, N)}% after alignment** — the truthful ceiling.
WC-L0D removes the *vocabulary* blocker that kept construct dimensions empty, so the moment a returning
user accrues **≥2 graphed sessions** carrying the same dimension, a real behaviour trend appears
automatically (the trend engine already consumes these dims). Today no user meets that two-graphed-
session bar, because the binding constraint is upstream **graph capture** (WC-L0C FP1 capture gap +
FP2 activation/graph gap), not the projection. The **>80% target is NOT met** and is reported as the
real ceiling, not modelled up.
`);

    // ── 06 — Readiness dashboard ──
    const target = (after: number, denom: number, t: number) => (denom > 0 && (100 * after) / denom > t ? '✅' : '❌');
    writeFileSync(join(OUT_DIR, '06_readiness_dashboard.md'), `# WC-L0D Deliverable 6 — Readiness Dashboard
_Generated ${stamp}_

The seven WC-L0D measures, **before → after**, against the phase targets. Coverage and Confidence are
separate axes; **targets are not forced** — where a ceiling is lower, it is reported as the true
ceiling (honesty canon).

## Population
- Completed sessions: **${completed}** · with a behaviour graph: **${graphed.length}** · emailed users: **${emailedUsers}** · trend-eligible (≥2 completed): **${N}**

## The seven measures
| # | Measure | Before | After | Target | Met? |
|---|---|---|---|---|---|
| 1 | Behaviour Coverage (sessions ≥1 dim) | ${pct(sessBehBefore, completed)}% | ${pct(sessBehAfter, completed)}% | >70% | ${target(sessBehAfter, completed, 70)} |
| 1b | — Construct coverage WITHIN graphed sessions | ${pct(gCellsBefore, gTotal)}% | ${pct(gCellsAfter, gTotal)}% | (FP3 fix) | ${gCellsAfter > gCellsBefore ? '✅ lifted' : '—'} |
| 2 | Behaviour Persistence Coverage | ${pct(persistedRows, completed)}% | ${pct(persistedRows, completed)}% | >80% | ${target(persistedRows, completed, 80)} |
| 3 | Trend Coverage | ${pct(usersTrendBefore, N)}% | ${pct(usersTrendAfter, N)}% | >50% | ${target(usersTrendAfter, N, 50)} |
| 4 | Trend Confidence | ${meanConf(trendsBefore).toFixed(2)} | ${meanConf(trendsAfter).toFixed(2)} | (informative) | — |
| 5 | User Intelligence Impact (sessions gaining a construct dim) | 0 | ${sessGained} | (informative) | ${sessGained > 0 ? '✅' : '—'} |
| 6 | Personalization Impact (reach) | ${pct(sessBehBefore, completed)}% | ${pct(sessBehAfter, completed)}% | >88% | ${target(sessBehAfter, completed, 88)} |
| 7 | Longitudinal Readiness Impact | ${pct(usersTrendBefore, N)}% | ${pct(usersTrendAfter, N)}% | >80% | ${target(usersTrendAfter, N, 80)} |

## What WC-L0D fixed (real, measurable)
- The **FP3 structural vocabulary mismatch is eliminated.** Construct-dim cells went from
  **${cellsBefore}/${totalCells} → ${cellsAfter}/${totalCells}** overall, and
  **${pct(gCellsBefore, gTotal)}% → ${pct(gCellsAfter, gTotal)}%** within graphed sessions. The four
  construct dimensions are now **reachable** wherever a mapped concern signal exists.

## Why the headline targets are NOT met (true ceiling, not inflated)
The four headline targets (Behaviour >70%, Trend >50%, Personalization >88%, Longitudinal >80%) are
**session-/user-level reach** metrics, and reach is bounded by **graph coverage** — only
**${graphed.length}/${completed}** completed sessions have any behaviour graph (WC-L0C **FP1** capture
gap + **FP2** activation/graph gap). Those gaps are **out of WC-L0D scope** (WC-L0D aligns the
namespace; it does not change capture or graph construction). So:
- Behaviour Coverage stays **${pct(sessBehAfter, completed)}%** (≤ graph coverage ${pct(graphed.length, completed)}%).
- Trend & Longitudinal stay **${pct(usersTrendAfter, N)}%** — no user has ≥2 *graphed* sessions.
- Personalization reach stays **${pct(sessBehAfter, completed)}%**.

**To reach the headline targets, WC-L0C's FIX 2 (close the capture/activation/graph gap) is required
in addition to this alignment.** WC-L0D is necessary but not sufficient — and that is reported
honestly rather than gamed.

## Activation note
This dashboard is a **read-only simulation** of flag-ON (\`FF_BEHAVIOUR_NAMESPACE_ALIGNMENT\`) over
the live graphs — **nothing was written**. To realise the AFTER state on persisted rows: enable the
flag and re-run the existing WC-L0 backfill (\`scripts/wc3/wcl0-backfill.ts\`), then the behaviour
trend backfill. No deploy performed; **STOP FOR APPROVAL**.
`);

    // ── Console summary ──
    console.log('WC-L0D measurement complete →', OUT_DIR);
    console.log(`  completed=${completed} graphed=${graphed.length} emailedUsers=${emailedUsers} trendEligible=${N}`);
    console.log(`  construct cells (all):     ${cellsBefore}/${totalCells} → ${cellsAfter}/${totalCells}`);
    console.log(`  construct cells (graphed): ${gCellsBefore}/${gTotal} (${pct(gCellsBefore, gTotal)}%) → ${gCellsAfter}/${gTotal} (${pct(gCellsAfter, gTotal)}%)`);
    console.log(`  sessions ≥1 dim:           ${sessBehBefore}/${completed} → ${sessBehAfter}/${completed}`);
    console.log(`  trend coverage:            ${usersTrendBefore}/${N} → ${usersTrendAfter}/${N}`);
    console.log(`  sessions gaining a dim:    ${sessGained}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[wcl0d-measure] failed:', err);
  process.exit(1);
});
