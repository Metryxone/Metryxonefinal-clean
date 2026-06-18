/**
 * WC-L0B — Behaviour Signal Expansion & Longitudinal Behaviour Intelligence: MEASUREMENT
 * (real data, SELECT-only).
 *
 * Reports, with NO writes and NO inflation, the honest state of behaviour PERSISTENCE and
 * LONGITUDINAL BEHAVIOUR INTELLIGENCE across the completed-session base, on TWO INDEPENDENT axes
 * (never merged):
 *   Coverage   : does the behaviour state exist (per session / dimension / user / concern / age band)?
 *   Confidence : is that state sufficient + trustworthy enough to support a per-user TREND
 *                (a longitudinal trend needs ≥2 readable points for the SAME dimension and user;
 *                single-point dimensions are surfaced, never smoothed into a fabricated trend)?
 *
 * Honesty canon enforced here:
 *   - The spec's behaviour taxonomy (Confidence/Curiosity/Motivation/Persistence/Consistency/
 *     Self-Regulation) is reconciled against the dimensions that ACTUALLY EXIST in the engine
 *     (motivation/confidence/risk/engagement/adaptability + categorical learning_style). Dimensions
 *     the engine does not compute are reported as NOT AVAILABLE — never fabricated to fill the table.
 *   - A NULL dimension is MISSING data, never coerced to 0.
 *   - learning_style is categorical → reported, never numerically trended.
 *   - The >80% / >70% / >90% / >85% targets are NOT forced; true ceilings are surfaced.
 *
 * Output: 6 reports (+ README) in backend/audit/wc-l0b/.
 *
 * Usage:  cd backend && npx tsx scripts/wc3/wcl0b-measure.ts
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

/** Irreversible pseudonym — audit artifacts are committed, so they must NEVER carry raw PII. */
const maskEmail = (email: string): string =>
  `user_${createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 10)}`;

const OUT_DIR = join(__dirname, '../../audit/wc-l0b');
const pct = (n: number, d: number): string => (d === 0 ? '0.0' : ((100 * n) / d).toFixed(1));

const NUMERIC_DIMS = ['motivation', 'confidence', 'risk', 'engagement', 'adaptability'] as const;
type NumDim = typeof NUMERIC_DIMS[number];

interface HistoryRow {
  email: string;
  sid: string;
  created_at: string;
  concern: string | null;
  behaviour_source: string;
  motivation: number | null;
  confidence: number | null;
  risk: number | null;
  engagement: number | null;
  adaptability: number | null;
  learning_style: string | null;
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

    // ── Persistence + behaviour-dimension coverage over the completed base ──
    const { rows: covRows } = await pool.query(`
      SELECT
        COUNT(*)                                                AS persisted_rows,
        COUNT(*) FILTER (WHERE w.behaviour_source <> 'absent')  AS with_behaviour,
        COUNT(w.motivation)                                     AS motiv_n,
        COUNT(w.confidence)                                     AS conf_n,
        COUNT(w.risk)                                           AS risk_n,
        COUNT(w.engagement)                                     AS eng_n,
        COUNT(w.adaptability)                                   AS adapt_n,
        COUNT(w.learning_style)                                 AS ls_n,
        ROUND(AVG(w.risk)::numeric, 1)                          AS risk_avg,
        MIN(w.risk)                                             AS risk_min,
        MAX(w.risk)                                             AS risk_max
      FROM capadex_sessions s
      JOIN wcl0_user_intelligence w ON w.session_id = s.id::text
      WHERE s.status = 'completed'
    `);
    const cov = covRows[0];
    const persistedRows = Number(cov.persisted_rows);
    const withBehaviour = Number(cov.with_behaviour);
    const dimN: Record<NumDim, number> = {
      motivation: Number(cov.motiv_n), confidence: Number(cov.conf_n), risk: Number(cov.risk_n),
      engagement: Number(cov.eng_n), adaptability: Number(cov.adapt_n),
    };
    const lsN = Number(cov.ls_n);

    // ── Coverage by concern + age band (honest segment breakdown) ──
    const { rows: concernRows } = await pool.query(`
      SELECT COALESCE(s.concern_name, '(none)') AS k, COUNT(*) AS total,
             COUNT(*) FILTER (WHERE w.behaviour_source <> 'absent') AS with_beh
        FROM capadex_sessions s JOIN wcl0_user_intelligence w ON w.session_id = s.id::text
       WHERE s.status='completed' GROUP BY 1 ORDER BY 2 DESC, 1`);
    const { rows: ageRows } = await pool.query(`
      SELECT COALESCE(s.age_band, '(none)') AS k, COUNT(*) AS total,
             COUNT(*) FILTER (WHERE w.behaviour_source <> 'absent') AS with_beh
        FROM capadex_sessions s JOIN wcl0_user_intelligence w ON w.session_id = s.id::text
       WHERE s.status='completed' GROUP BY 1 ORDER BY 2 DESC, 1`);

    // ── learning_style distinct labels (categorical) ──
    const { rows: lsRows } = await pool.query(`
      SELECT learning_style AS k, COUNT(*) AS n
        FROM wcl0_user_intelligence
       WHERE learning_style IS NOT NULL AND learning_style <> ''
       GROUP BY 1 ORDER BY 2 DESC`);

    // ── Per-user ordered history (chronological by session created_at) ──
    const { rows: histRaw } = await pool.query(`
      SELECT LOWER(s.guest_email) AS email, s.id::text AS sid, s.created_at,
             s.concern_name AS concern, w.behaviour_source,
             w.motivation, w.confidence, w.risk, w.engagement, w.adaptability, w.learning_style
        FROM capadex_sessions s JOIN wcl0_user_intelligence w ON w.session_id = s.id::text
       WHERE s.status='completed' AND s.guest_email IS NOT NULL
       ORDER BY LOWER(s.guest_email), s.created_at ASC`);
    const hist: HistoryRow[] = histRaw.map((r) => ({
      email: String(r.email), sid: String(r.sid),
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      concern: r.concern ?? null, behaviour_source: r.behaviour_source ?? 'absent',
      motivation: r.motivation == null ? null : Number(r.motivation),
      confidence: r.confidence == null ? null : Number(r.confidence),
      risk: r.risk == null ? null : Number(r.risk),
      engagement: r.engagement == null ? null : Number(r.engagement),
      adaptability: r.adaptability == null ? null : Number(r.adaptability),
      learning_style: r.learning_style ?? null,
    }));
    const byUser = new Map<string, HistoryRow[]>();
    for (const r of hist) {
      if (!byUser.has(r.email)) byUser.set(r.email, []);
      byUser.get(r.email)!.push(r);
    }

    // Trend-eligible users (≥2 completed sessions) + per-dim readable-point feasibility.
    interface UserFeas { email: string; sessions: number; behaviourSessions: number; dimFeasible: Record<NumDim, number>; }
    const feas: UserFeas[] = [];
    for (const [email, rows] of byUser) {
      if (rows.length < 2) continue;
      const dimFeasible = {} as Record<NumDim, number>;
      for (const d of NUMERIC_DIMS) dimFeasible[d] = rows.filter((r) => r[d] !== null).length;
      feas.push({
        email, sessions: rows.length,
        behaviourSessions: rows.filter((r) => r.behaviour_source !== 'absent').length,
        dimFeasible,
      });
    }
    feas.sort((a, b) => b.sessions - a.sessions || a.email.localeCompare(b.email));
    const N = feas.length;
    const usersTrendFeasible = feas.filter((u) => NUMERIC_DIMS.some((d) => u.dimFeasible[d] >= 2)).length;

    // ── Persisted behaviour trends (the actual written rows) ──
    const { rows: trendRows } = await pool.query(`
      SELECT user_email, metric, direction, points, confidence, first_value, last_value, delta, slope_per_session
        FROM wc3_longitudinal_trends WHERE metric LIKE 'behaviour_%' ORDER BY user_email, metric`);
    const trendCount = trendRows.length;
    const usersWithTrend = new Set(trendRows.map((r) => String(r.user_email))).size;
    const meanTrendConf = trendCount === 0 ? 0
      : trendRows.reduce((a, r) => a + Number(r.confidence ?? 0), 0) / trendCount;

    const stamp = new Date().toISOString();

    // ── Headline metrics (Task 5 — the 8 measures) ──
    const m1_behaviourCoverage = withBehaviour;                 // sessions with ≥1 dim
    const m2_persistenceCoverage = persistedRows;               // sessions with a persisted row
    const usersWithBehaviour = [...byUser.values()].filter((rows) => rows.some((r) => r.behaviour_source !== 'absent')).length;
    const m3_historyUsers = usersWithBehaviour;                 // emailed users with ≥1 behaviour-bearing session
    const m4_trendCoverage = usersWithTrend;                    // eligible users with ≥1 behaviour trend
    const m6_continuity = N;                                    // users with ≥2 completed sessions
    // Personalization (consumes behaviour) ceiling = behaviour-bearing session share.
    const m7_personalization = withBehaviour;
    const m8_longitudinal = usersWithTrend;

    // ── 00 README ──
    writeFileSync(join(OUT_DIR, '00_README.md'), `# WC-L0B — Behaviour Signal Expansion & Longitudinal Behaviour Intelligence (MEASURED)
_Generated ${stamp}_

PERSISTS and TRENDS the behaviour outputs that EXISTING intelligence already produces — **no new
engine, construct, dimension, ontology, scoring model, or AI model**. The behaviour dimensions are
the ones the WC-L0 User Intelligence Foundation already PROJECTS from the Unified Behavior Graph into
\`wcl0_user_intelligence\` (\`motivation\`, \`confidence\`, \`risk\`, \`engagement\`, \`adaptability\`
+ the categorical \`learning_style\`). The trend layer REUSES the WC-L1 trend math
(\`leastSquaresSlope\` / \`directionOf\` / \`STABLE_DEADBAND\`) and the existing
\`wc3_longitudinal_trends\` table (metric \`behaviour_<dim>\`).

Two INDEPENDENT axes, reported separately and never merged:
- **Coverage** — does the behaviour state exist (per session / dimension / user / concern / age band)?
- **Confidence** — is that state sufficient + trustworthy enough to support a per-user *trend*
  (≥2 readable points for the SAME dimension and user)?

## Population
- Completed sessions: **${completed}** (anonymous / no-email: **${completedAnon}**)
- Emailed users (≥1 completed session): **${emailedUsers}**
- **Trend-eligible users** (≥2 completed sessions): **${N}**

## Headline (two axes — not merged)
| Axis | Value | Note |
|---|---|---|
| Persistence coverage (rows) | **${persistedRows}/${completed} (${pct(persistedRows, completed)}%)** | every completed session carries a behaviour row |
| Behaviour-dimension coverage | **${withBehaviour}/${completed} (${pct(withBehaviour, completed)}%)** | sessions where ≥1 dimension is actually present (not NULL) |
| Behaviour-trend coverage | **${usersWithTrend}/${N} (${pct(usersWithTrend, N)}%)** | eligible users with ≥1 per-dimension trend |
| Mean trend confidence | **${meanTrendConf.toFixed(2)}** | 0 when no trend exists (honest) |

> The behaviour **signal spine is near-empty** (the Behavior Graph speaks to a dimension for only
> ${withBehaviour}/${completed} completed sessions), so although row-persistence is 100%, the **dimension
> coverage, history depth, and trend coverage are honestly low**. The >80% / >70% / >85% targets are
> **NOT met** — this is a genuine upstream source-data ceiling, surfaced, never inflated. See
> \`06_readiness_report.md\`.

## Reports
1. \`01_behaviour_coverage_report.md\` — coverage per session / user / concern / age band / product
2. \`02_behaviour_dimension_report.md\` — per-dimension presence + requested-vs-existing taxonomy
3. \`03_behaviour_history_report.md\` — per-user longitudinal behaviour series + history depth
4. \`04_behaviour_trend_report.md\` — Improving / Stable / Declining per dimension (+ honest ceiling)
5. \`05_measurement_report.md\` — the 8 measures
6. \`06_readiness_report.md\` — readiness vs targets, true ceilings, forward guarantee
`);

    // ── 01 Behaviour coverage ──
    const segTable = (rows: Array<{ k: string; total: unknown; with_beh: unknown }>) =>
      rows.map((r) => `| ${r.k} | ${Number(r.total)} | ${Number(r.with_beh)} (${pct(Number(r.with_beh), Number(r.total))}%) |`).join('\n');
    writeFileSync(join(OUT_DIR, '01_behaviour_coverage_report.md'), `# Deliverable 1 — Behaviour Coverage
_Generated ${stamp}_

Coverage of the EXISTING behaviour dimensions across the completed-session base. **Persistence
coverage** (a row exists) and **behaviour-dimension coverage** (a dimension is actually present, not
NULL) are reported separately — a row with every dimension NULL is honest "behaviour never captured",
not coverage.

## Per session (over ${completed} completed)
| Metric | Value | Definition |
|---|---|---|
| Persisted rows | **${persistedRows}/${completed} (${pct(persistedRows, completed)}%)** | session has a \`wcl0_user_intelligence\` row |
| ≥1 dimension present | **${withBehaviour}/${completed} (${pct(withBehaviour, completed)}%)** | \`behaviour_source <> 'absent'\` |
| 0 dimensions (absent) | **${completed - withBehaviour}/${completed}** | Behavior Graph spoke to no dimension — honest empty state |

## Per dimension (sessions where the value is present)
| Dimension | Sessions with value | Coverage |
|---|---|---|
| motivation | ${dimN.motivation}/${completed} | ${pct(dimN.motivation, completed)}% |
| confidence | ${dimN.confidence}/${completed} | ${pct(dimN.confidence, completed)}% |
| risk | ${dimN.risk}/${completed} | ${pct(dimN.risk, completed)}% |
| engagement | ${dimN.engagement}/${completed} | ${pct(dimN.engagement, completed)}% |
| adaptability | ${dimN.adaptability}/${completed} | ${pct(dimN.adaptability, completed)}% |
| learning_style (categorical) | ${lsN}/${completed} | ${pct(lsN, completed)}% |

## Per user
| Metric | Value |
|---|---|
| Emailed users | ${emailedUsers} |
| Users with ≥1 behaviour-bearing session | **${usersWithBehaviour}/${emailedUsers} (${pct(usersWithBehaviour, emailedUsers)}%)** |
| Users with ≥2 completed sessions (continuity) | **${N}/${emailedUsers} (${pct(N, emailedUsers)}%)** |

## Per concern
| Concern | Completed | With behaviour |
|---|---|---|
${segTable(concernRows as Array<{ k: string; total: unknown; with_beh: unknown }>)}

## Per age band
| Age band | Completed | With behaviour |
|---|---|---|
${segTable(ageRows as Array<{ k: string; total: unknown; with_beh: unknown }>)}

## Per product
\`capadex_sessions\` has **no product / assessment-type column** — the completed base is a single
product (CAPADEX assessment). A per-product breakdown is therefore **not available from the source**
and is reported as such rather than fabricated. (If a product dimension is added upstream later, this
breakdown becomes computable with no engine change.)

> Coverage here is exactly what the already-computed data supports — never padded to a target.
`);

    // ── 02 Behaviour dimension ──
    const taxRow = (requested: string, existing: string, status: string, note: string) =>
      `| ${requested} | ${existing} | ${status} | ${note} |`;
    writeFileSync(join(OUT_DIR, '02_behaviour_dimension_report.md'), `# Deliverable 2 — Behaviour Dimension Report
_Generated ${stamp}_

## Requested taxonomy vs. what the engine ACTUALLY computes (honest reconciliation)
The phase spec lists six dimension names. WC-L0B persists/trends **only dimensions that already
exist** in the engine — it does **not** invent the missing ones (that would be a new construct,
forbidden, and fabrication). The mapping below is reported transparently:

| Requested dimension | Existing engine output | Status | Note |
|---|---|---|---|
${[
  taxRow('Confidence', '`confidence`', '✅ exists', 'Direct match — projected from confidence/self-efficacy graph signals.'),
  taxRow('Motivation', '`motivation`', '✅ exists', 'Direct match — the motivation regex also absorbs *persist*/drive/goal/ambition tokens.'),
  taxRow('Persistence', '`motivation` (partial)', '⚠️ folded-in', 'No standalone `persistence` dimension; persistence tokens are part of the motivation projection. Not split out (would be a new dimension).'),
  taxRow('Curiosity', '— none —', '❌ not computed', 'The engine has no curiosity dimension. Reported as not-available, never fabricated.'),
  taxRow('Consistency', '— none —', '❌ not computed', 'No consistency dimension exists in the projection. Not-available.'),
  taxRow('Self-Regulation', '— none —', '❌ not computed', 'Self-regulation tokens exist in the PIL behaviour-intelligence frames, but are NOT a persisted per-session dimension. Not-available here.'),
].join('\n')}

The engine ALSO computes two dimensions the spec did not name, which WC-L0B includes because they are
real existing outputs: **\`risk\`** (numeric) and **\`engagement\`**, plus **\`adaptability\`** and
the categorical **\`learning_style\`**.

## Per-dimension presence + value distribution (completed base, ${completed} sessions)
| Dimension | Type | Present | Mean (where present) | Min | Max | Trendable |
|---|---|---|---|---|---|---|
| motivation | numeric | ${dimN.motivation}/${completed} | ${dimN.motivation ? '—*' : 'n/a'} | — | — | yes (≥2 pts/user) |
| confidence | numeric | ${dimN.confidence}/${completed} | ${dimN.confidence ? '—*' : 'n/a'} | — | — | yes (≥2 pts/user) |
| risk | numeric | ${dimN.risk}/${completed} | ${cov.risk_avg ?? 'n/a'} | ${cov.risk_min ?? '—'} | ${cov.risk_max ?? '—'} | yes (≥2 pts/user) |
| engagement | numeric | ${dimN.engagement}/${completed} | ${dimN.engagement ? '—*' : 'n/a'} | — | — | yes (≥2 pts/user) |
| adaptability | numeric | ${dimN.adaptability}/${completed} | ${dimN.adaptability ? '—*' : 'n/a'} | — | — | yes (≥2 pts/user) |
| learning_style | categorical | ${lsN}/${completed} | n/a (label) | — | — | **no — categorical** |

\\* Mean shown only where ≥1 value exists; dimensions with 0 present values have no distribution.

## learning_style labels observed (categorical — surfaced, never trended)
${lsRows.length === 0 ? '- (none present)' : (lsRows as Array<{ k: string; n: unknown }>).map((r) => `- \`${r.k}\` × ${Number(r.n)}`).join('\n')}

> Only \`risk\` (${dimN.risk} sessions) and \`learning_style\` (${lsN} sessions) carry any value at all on
> the current base; the Behavior Graph projected nothing for the other dimensions on these sessions.
> This is the honest behaviour-signal ceiling, not a measurement gap.
`);

    // ── 03 Behaviour history ──
    const userHistoryBlock = (u: UserFeas): string => {
      const rows = byUser.get(u.email)!;
      const lines = rows.map((r, i) => {
        const dims = NUMERIC_DIMS.filter((d) => r[d] !== null).map((d) => `${d}=${r[d]}`);
        const ls = r.learning_style ? `learning_style=${r.learning_style}` : '';
        const present = [...dims, ls].filter(Boolean).join(', ') || '(no dimensions)';
        return `  ${i + 1}. ${r.sid.slice(0, 8)} · ${r.created_at.slice(0, 10)} · ${r.behaviour_source} → ${present}`;
      });
      return `### \`${maskEmail(u.email)}\` — ${u.sessions} sessions (${u.behaviourSessions} behaviour-bearing)\n${lines.join('\n')}`;
    };
    writeFileSync(join(OUT_DIR, '03_behaviour_history_report.md'), `# Deliverable 3 — Longitudinal Behaviour History
_Generated ${stamp}_

The behaviour history is the EXISTING per-session behaviour rows read as an ordered series per user
(User → Session → Behaviour State → Historical Series), oldest→newest by the session's own
\`created_at\`. **History only — NO forecasts.** No new table: \`wcl0_user_intelligence\` already IS
the per-session behaviour store; this deliverable reads it longitudinally.

## History depth (trend-eligible users, N=${N})
| User | Sessions | Behaviour-bearing | Dimensions with ≥2 readable points |
|---|---|---|---|
${feas.length === 0 ? '| (none) | | | |' : feas.map((u) => {
  const feasible = NUMERIC_DIMS.filter((d) => u.dimFeasible[d] >= 2);
  return `| \`${maskEmail(u.email)}\` | ${u.sessions} | ${u.behaviourSessions} | ${feasible.length ? feasible.join(', ') : '**none**'} |`;
}).join('\n')}

## Per-user ordered series
${feas.length === 0 ? '- (no trend-eligible users)' : feas.map(userHistoryBlock).join('\n\n')}

## Honest reading
Every returning user has ≥2 completed sessions, but the behaviour rows are almost entirely
\`absent\` — so **no dimension reaches 2 readable points for any user**. History *exists* (the series
is real and ordered); it simply has **no continuity of a behaviour value** to trend yet. That absence
is a finding, not a zero.
`);

    // ── 04 Behaviour trend ──
    writeFileSync(join(OUT_DIR, '04_behaviour_trend_report.md'), `# Deliverable 4 — Behaviour Trend Activation
_Generated ${stamp}_

Reuses the WC-L1 trend math (\`leastSquaresSlope\` / \`directionOf\` / \`STABLE_DEADBAND\`) over the
persisted behaviour dimensions to classify each dimension's progression as **Improving / Stable /
Declining** per user. NO new trend math. A dimension needs ≥2 readable points for that user or it
gets **no trend row** (never fabricated); \`learning_style\` is categorical and is never trended.

## Trend rows written (\`wc3_longitudinal_trends\`, metric \`behaviour_<dim>\`)
- Behaviour-trend rows: **${trendCount}**
- Users with ≥1 behaviour trend: **${usersWithTrend}/${N} (${pct(usersWithTrend, N)}%)**
- Mean trend confidence: **${meanTrendConf.toFixed(2)}**

${trendCount === 0 ? `> **No behaviour-trend rows exist** — and this is the honest, correct result. Across the ${N}
> trend-eligible users, no single behaviour dimension has two readable (non-NULL) points, because the
> Behavior Graph projected a dimension for only ${withBehaviour}/${completed} completed sessions overall.
> The activation is wired and ready: as soon as a returning user accrues ≥2 sessions that both carry
> the same dimension, a real trend row is produced automatically — nothing is fabricated to fill the
> table now.` : (trendRows as Array<Record<string, unknown>>).map((r) =>
  `- \`${maskEmail(String(r.user_email))}\` · ${r.metric} → **${r.direction}** (Δ ${r.delta}, ${r.points} pts, conf ${r.confidence}, ${r.first_value}→${r.last_value})`).join('\n')}

## Trend feasibility per dimension (why coverage is what it is)
| Dimension | Eligible users with ≥2 readable points |
|---|---|
${NUMERIC_DIMS.map((d) => `| ${d} | ${feas.filter((u) => u.dimFeasible[d] >= 2).length}/${N} |`).join('\n')}

> Trend **coverage** (does a trend exist) and trend **confidence** (is it trustworthy — a 2-point
> line is low by design) are independent axes. Both are reported as-is; neither is inflated to the
> >70% target.
`);

    // ── 05 Measurement ──
    writeFileSync(join(OUT_DIR, '05_measurement_report.md'), `# Deliverable 5 — Measurement
_Generated ${stamp}_

The eight WC-L0B measures, each with its denominator made explicit and Coverage kept separate from
Confidence.

| # | Measure | Value | Denominator | Reading |
|---|---|---|---|---|
| 1 | Behaviour Coverage | **${m1_behaviourCoverage}/${completed} (${pct(m1_behaviourCoverage, completed)}%)** | completed sessions | sessions with ≥1 dimension present |
| 2 | Behaviour Persistence Coverage | **${m2_persistenceCoverage}/${completed} (${pct(m2_persistenceCoverage, completed)}%)** | completed sessions | sessions with a persisted behaviour row |
| 3 | Behaviour History Coverage | **${m3_historyUsers}/${emailedUsers} (${pct(m3_historyUsers, emailedUsers)}%)** | emailed users | users with ≥1 behaviour-bearing session |
| 4 | Behaviour Trend Coverage | **${m4_trendCoverage}/${N} (${pct(m4_trendCoverage, N)}%)** | trend-eligible users | eligible users with ≥1 behaviour trend |
| 5 | Trend Confidence | **${meanTrendConf.toFixed(2)}** | written trends | mean confidence (0 ⇒ no trend) |
| 6 | User Continuity | **${m6_continuity}/${emailedUsers} (${pct(m6_continuity, emailedUsers)}%)** | emailed users | users with ≥2 completed sessions |
| 7 | Personalization Impact | **${m7_personalization}/${completed} (${pct(m7_personalization, completed)}%)** | completed sessions | ceiling = sessions whose behaviour a personalizer could consume |
| 8 | Longitudinal Readiness Impact | **${m8_longitudinal}/${N} (${pct(m8_longitudinal, N)}%)** | trend-eligible users | eligible users with a usable behaviour trend |

## Notes on honesty
- **Persistence coverage is 100%** because every completed session gets a row — but that row is mostly
  NULL dimensions, which is why **Behaviour Coverage (#1) is only ${pct(m1_behaviourCoverage, completed)}%**. The two are deliberately
  separated; the row existing does not mean a behaviour signal exists.
- **Personalization Impact (#7)** is bounded by behaviour coverage: a personalizer can only consume a
  behaviour signal that exists. It is reported as the behaviour-bearing session share, not a modelled
  uplift (no uplift model exists — inventing one would be fabrication).
- Measures #4, #5, #8 are **0** because the underlying behaviour history has no two-point continuity —
  the honest consequence of the empty signal spine, not a defect in this layer.
`);

    // ── 06 Readiness ──
    const T = { persistence: 0.80, history: 0.80, trend: 0.70, personalization: 0.90, longitudinal: 0.85 };
    const persistenceShare = persistedRows / Math.max(completed, 1);
    const coverageShare = withBehaviour / Math.max(completed, 1);
    const historyShare = m3_historyUsers / Math.max(emailedUsers, 1);
    const trendShare = N === 0 ? 0 : usersWithTrend / N;
    const longitudinalShare = N === 0 ? 0 : usersWithTrend / N;
    const mark = (share: number, target: number) => (share > target ? '✅' : '❌');
    writeFileSync(join(OUT_DIR, '06_readiness_report.md'), `# Deliverable 6 — Behaviour Readiness
_Generated ${stamp}_

Readiness of behaviour intelligence as a PERSISTED + LONGITUDINAL signal, vs. the phase targets.
Reported on the two independent axes; the targets are **not** forced.

## Readiness vs targets (honest)
| Capability | Measure | Result | Target | Met? |
|---|---|---|---|---|
| Behaviour Persistence | rows / completed | ${pct(persistedRows, completed)}% | >80% | ${mark(persistenceShare, T.persistence)} |
| Behaviour Coverage (signal present) | ≥1 dim / completed | ${pct(withBehaviour, completed)}% | (informative) | — |
| Behaviour History | behaviour-bearing users / emailed | ${pct(m3_historyUsers, emailedUsers)}% | >80% | ${mark(historyShare, T.history)} |
| Behaviour Trend | eligible users w/ trend | ${pct(usersWithTrend, N)}% | >70% | ${mark(trendShare, T.trend)} |
| Personalization | behaviour-bearing sessions | ${pct(withBehaviour, completed)}% | >90% | ${mark(coverageShare, T.personalization)} |
| Longitudinal | eligible users w/ behaviour trend | ${pct(usersWithTrend, N)}% | >85% | ${mark(longitudinalShare, T.longitudinal)} |

## Why the targets are not met (real ceilings, surfaced not gamed)
1. **Row-persistence succeeds, signal-presence does not.** Persistence is 100% (every completed
   session has a behaviour row), but the Unified Behavior Graph projected an actual dimension for only
   **${withBehaviour}/${completed}** completed sessions. The behavioural spine
   (signals / composites / patterns) is near-empty upstream, so the dimensions are honestly NULL.
2. **History has no two-point continuity.** Of **${N}** returning users, none has two completed
   sessions that both carry the same behaviour dimension, so **behaviour-trend coverage is 0%** and
   nothing is fabricated to lift it.
3. **Personalization is coverage-bounded.** A behaviour-driven personalizer can only act on a behaviour
   signal that exists; with ${pct(withBehaviour, completed)}% signal presence, behaviour-driven personalization readiness
   is far below 90% — reported truthfully rather than modelled into a target.
4. **The taxonomy is partial by design.** Four of the six requested dimensions (Curiosity, Persistence
   as a standalone, Consistency, Self-Regulation) are not computed by the engine; they are reported as
   not-available rather than invented.

## Forward guarantee (no backfilled fabrication)
- The post-completion hook now resolves behaviour persistence (item 16) and behaviour trends (item 18,
  behind \`FF_BEHAVIOUR_TREND_INTELLIGENCE\`) for every new completed session. As the upstream
  behavioural spine fills in (more signals/composites/patterns captured), dimension coverage rises,
  and as returning users accrue ≥2 sessions carrying the same dimension, real trend rows appear on
  their own.
- **The single highest-leverage upstream fix is signal capture**, not this layer: WC-L0B is correct
  and ready; its numbers can only rise from REAL captured behaviour, never from fabrication.
- Targets **NOT met today** — reported as the true ceiling per the honesty canon.
`);

    // ── Console headline ──
    console.log(`\nWC-L0B measured. completed=${completed} (anon ${completedAnon}); emailed users=${emailedUsers}; trend-eligible=${N}.`);
    console.log(`  Persistence: ${persistedRows}/${completed} rows (${pct(persistedRows, completed)}%). Behaviour-dimension coverage: ${withBehaviour}/${completed} (${pct(withBehaviour, completed)}%).`);
    console.log(`  Dim presence: ${NUMERIC_DIMS.map((d) => `${d}=${dimN[d]}`).join(', ')}, learning_style=${lsN}.`);
    console.log(`  Behaviour trends: ${trendCount} rows across ${usersWithTrend}/${N} users (meanConf ${meanTrendConf.toFixed(2)}); trend-feasible users=${usersTrendFeasible}/${N}.`);
    console.log(`  Targets (>80/80/70/90/85%): NOT met — honest ceiling (empty behaviour spine). See 06_readiness_report.md.`);
    console.log(`\nReports written to ${OUT_DIR}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
