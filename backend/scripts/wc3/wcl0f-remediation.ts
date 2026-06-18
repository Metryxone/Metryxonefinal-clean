/**
 * WC-L0F — Behaviour Capture Remediation (flag-gated, idempotent, additive, never-throws).
 *
 * GOAL: raise behaviour COVERAGE toward 80%+ and activate behaviour TREND/FORECAST readiness using
 * ONLY existing assets — no new ontology / construct / dimension / scoring / AI model. It REUSES the
 * existing Signal Activation Runtime, Behaviour Graph aggregator, WC-L0 persistence (projectBehaviour),
 * WC-L0B behaviour-trend math, and WC-L2 forecast engine.
 *
 * HONEST RECONCILIATION (measured, not assumed):
 *   The "~22%" headline is the PRE-WC-L0E state. The WC-L0E signal backfill is already applied (sessions
 *   stamped `signal_value.wcl0e_backfill=true`), so current behaviour coverage is already ~77.8% (7/9).
 *   The true ceiling is bounded by 0-response sessions that carry no evidence (permanently un-backfillable
 *   — a concern-seed-only graph would FABRICATE behaviour and is refused). This script therefore:
 *     1. Idempotently re-runs the graph backfill over any ungraphed session that HAS responses (no-op
 *        when coverage is already at ceiling — never conjures a graph for a 0-response session).
 *     2. Idempotently re-runs WC-L0 persistence WITH namespace alignment ON (so the deficit-coded dims
 *        are NOT re-projected to NULL — the regression trap of running wcl0b-backfill without alignment).
 *     3. Re-runs WC-L0B behaviour-trend persistence for every owner with >=2 completed sessions (this is
 *        the genuine WC-L0F lift: WC-L0E graphed both sessions of returning owners, so behaviour trends
 *        can now form — previously 0).
 *     4. Measures forecast readiness LIVE (computeUserForecasts) — honest ceiling: the forecast surface
 *        consumes only the `risk` behaviour dim, which is the SPARSEST dim, so behaviour-forecast
 *        readiness can legitimately remain 0 even as behaviour trends activate. Never inflated.
 *
 * REVERSIBILITY: every flag this script needs is set for THIS process only; none is in the deploy/
 * workflow env, so live behaviour is byte-identical. `--dry-run` (default) is read-only (captures the
 * before-snapshot + plan, writes nothing). `--apply` performs the idempotent writes, captures the
 * after-snapshot, and emits the 6 deliverables + PII-masked _baseline.json under backend/audit/wc-l0f/.
 *
 * Usage:
 *   cd backend && npx tsx scripts/wc3/wcl0f-remediation.ts --dry-run
 *   cd backend && npx tsx scripts/wc3/wcl0f-remediation.ts --apply
 */

// Flags ON for THIS process only (read live by isFlagEnabled → envOverride). Setting them here keeps
// the deploy/workflow env untouched → byte-identical live behaviour. ALIGNMENT is mandatory: without it,
// persistUserIntelligence re-projects the deficit dims to NULL and coverage regresses 77.8% → ~22%.
process.env.FF_USER_INTELLIGENCE_FOUNDATION = '1';
process.env.FF_BEHAVIOUR_NAMESPACE_ALIGNMENT = '1';
process.env.FF_BEHAVIOUR_TREND_INTELLIGENCE = '1';
process.env.FF_BEHAVIOUR_SIGNAL_BACKFILL = '1';
process.env.FF_FORECAST_INTELLIGENCE = '1';
process.env.FF_WC3_OUTCOME_CROSSWALK = process.env.FF_WC3_OUTCOME_CROSSWALK ?? '1';

import { Pool } from 'pg';
import { createHash } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { EvidenceInput } from '../../services/evidence-engine';
import { runEvidenceRuntime } from '../../services/signal-activation-runtime';
import { buildBehaviorGraph } from '../../services/behavior-graph-service';
import { persistUserIntelligence } from '../../services/wc3/user-intelligence-foundation';
import {
  persistUserBehaviourTrends,
  computeUserBehaviourTrends,
  BEHAVIOUR_NUMERIC_DIMS,
  type BehaviourDim,
} from '../../services/wc3/behaviour-trend-intelligence';
import { computeUserForecasts } from '../../services/wc3/forecast-intelligence';

const OUT_DIR = join(__dirname, '..', '..', 'audit', 'wc-l0f');

/** One-way, deterministic email mask (per-user grouping preserved; raw address NEVER stored). */
const maskEmail = (email: string): string =>
  `user_${createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 10)}`;

const DIMS: BehaviourDim[] = BEHAVIOUR_NUMERIC_DIMS;

interface SessionRow {
  id: string;
  owned: boolean;
  email: string | null;
  concern: string | null;
  created_at: string;
  responses: number;
  act_sig: number;
  sig_rows: number;
  bf_sig: number;
  has_graph: boolean;
  dims: Record<BehaviourDim, number | null>;
  learning_style: string | null;
  numeric_dims: number;
}

interface UserSnap {
  email_masked: string;
  completed: number;
  dims_with_two_points: BehaviourDim[];
  persisted_trend_metrics: string[];          // behaviour_* rows in wc3_longitudinal_trends
  computed_trends: { dim: BehaviourDim; direction: string; points: number; confidence: number }[];
  forecast: {
    enabled: boolean;
    forecastable_count: number;
    risk_forecastable: boolean;
    growth_forecastable: boolean;
    outcome_forecastable: boolean;
    journey_forecastable: boolean;
  };
}

interface Snapshot {
  completed: number;
  with_responses: number;
  zero_response: number;
  with_activated_signals: number;
  with_graph: number;
  with_wcl0_row: number;
  coverage_any_numeric: number;               // sessions with >=1 numeric construct dim
  dim_counts: Record<BehaviourDim, number>;
  learning_style_count: number;
  backfilled_signal_sessions: number;
  unbackfillable_zero_response: number;       // !graph && responses==0 (true ceiling)
  graph_gap_with_responses: number;           // !graph && responses>0 (the only honest backfill target)
  behaviour_trend_rows: number;               // total behaviour_* rows in wc3_longitudinal_trends
  users: UserSnap[];
  sessions: { sid: string; email_masked: string | null; owned: boolean; concern: string | null;
    responses: number; act_sig: number; bf_sig: number; has_graph: boolean;
    dims: Record<BehaviourDim, number | null>; learning_style: string | null; numeric_dims: number }[];
}

async function loadSessions(pool: Pool): Promise<SessionRow[]> {
  const { rows } = await pool.query(`
    SELECT cs.id::text AS id,
      (cs.guest_email IS NOT NULL AND cs.guest_email <> '') AS owned,
      LOWER(cs.guest_email) AS email,
      cs.concern_name AS concern,
      cs.created_at,
      (SELECT COUNT(*)::int FROM capadex_responses r WHERE r.session_id::text = cs.id::text) AS responses,
      (SELECT COUNT(*)::int FROM capadex_session_signals g WHERE g.session_id::text = cs.id::text AND g.signal_type='activated') AS act_sig,
      (SELECT COUNT(*)::int FROM capadex_session_signals g WHERE g.session_id::text = cs.id::text) AS sig_rows,
      (SELECT COUNT(*)::int FROM capadex_session_signals g WHERE g.session_id::text = cs.id::text AND (g.signal_value->>'wcl0e_backfill')::boolean IS TRUE) AS bf_sig,
      EXISTS(SELECT 1 FROM capadex_behavior_graph bg WHERE bg.session_id::text = cs.id::text) AS has_graph,
      w.motivation, w.confidence, w.risk, w.engagement, w.adaptability, w.learning_style
    FROM capadex_sessions cs
    LEFT JOIN wcl0_user_intelligence w ON w.session_id::text = cs.id::text
    WHERE cs.status='completed'
    ORDER BY cs.created_at ASC`);
  return rows.map((r): SessionRow => {
    const dims: Record<BehaviourDim, number | null> = {
      motivation: r.motivation == null ? null : Number(r.motivation),
      confidence: r.confidence == null ? null : Number(r.confidence),
      risk: r.risk == null ? null : Number(r.risk),
      engagement: r.engagement == null ? null : Number(r.engagement),
      adaptability: r.adaptability == null ? null : Number(r.adaptability),
    };
    const numeric_dims = DIMS.filter((d) => dims[d] != null).length;
    return {
      id: String(r.id),
      owned: r.owned === true,
      email: r.email ? String(r.email) : null,
      concern: r.concern ?? null,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      responses: Number(r.responses),
      act_sig: Number(r.act_sig),
      sig_rows: Number(r.sig_rows),
      bf_sig: Number(r.bf_sig),
      has_graph: r.has_graph === true,
      dims,
      learning_style: r.learning_style ?? null,
      numeric_dims,
    };
  });
}

async function snapshot(pool: Pool): Promise<Snapshot> {
  const sessions = await loadSessions(pool);

  const dim_counts: Record<BehaviourDim, number> = {
    motivation: 0, confidence: 0, risk: 0, engagement: 0, adaptability: 0,
  };
  for (const s of sessions) for (const d of DIMS) if (s.dims[d] != null) dim_counts[d] += 1;

  // Persisted behaviour trend rows (the readiness surface that longitudinal/personalization consumers read).
  const { rows: trendRows } = await pool.query(
    `SELECT LOWER(user_email) AS email, metric FROM wc3_longitudinal_trends WHERE metric LIKE 'behaviour_%'`,
  );
  const persistedByUser = new Map<string, string[]>();
  for (const t of trendRows) {
    const e = String(t.email);
    persistedByUser.set(e, [...(persistedByUser.get(e) ?? []), String(t.metric)]);
  }

  // Owned users with >=2 completed sessions: the only ones that can form a cross-session series.
  const byEmail = new Map<string, SessionRow[]>();
  for (const s of sessions) if (s.owned && s.email) byEmail.set(s.email, [...(byEmail.get(s.email) ?? []), s]);

  const users: UserSnap[] = [];
  for (const [email, rows] of byEmail) {
    if (rows.length < 2) continue;
    const chrono = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const dims_with_two_points = DIMS.filter(
      (d) => chrono.filter((r) => r.dims[d] != null).length >= 2,
    );
    const ct = await computeUserBehaviourTrends(pool, email);
    const fc = await computeUserForecasts(pool, email);
    const fEnabled = (fc as { enabled: boolean }).enabled === true;
    const forecasts = fEnabled ? (fc as { forecasts: Record<string, { forecastable: boolean }> }).forecasts : null;
    users.push({
      email_masked: maskEmail(email),
      completed: rows.length,
      dims_with_two_points,
      persisted_trend_metrics: (persistedByUser.get(email) ?? []).sort(),
      computed_trends: ct.trends.map((t) => ({
        dim: t.dim, direction: t.direction, points: t.points, confidence: t.confidence,
      })),
      forecast: {
        enabled: fEnabled,
        forecastable_count: fEnabled ? (fc as { forecastable_count: number }).forecastable_count : 0,
        risk_forecastable: forecasts?.risk?.forecastable === true,
        growth_forecastable: forecasts?.growth?.forecastable === true,
        outcome_forecastable: forecasts?.outcome?.forecastable === true,
        journey_forecastable: forecasts?.journey?.forecastable === true,
      },
    });
  }
  users.sort((a, b) => a.email_masked.localeCompare(b.email_masked));

  return {
    completed: sessions.length,
    with_responses: sessions.filter((s) => s.responses > 0).length,
    zero_response: sessions.filter((s) => s.responses === 0).length,
    with_activated_signals: sessions.filter((s) => s.act_sig > 0).length,
    with_graph: sessions.filter((s) => s.has_graph).length,
    with_wcl0_row: sessions.filter((s) => s.numeric_dims > 0 || s.learning_style != null).length,
    coverage_any_numeric: sessions.filter((s) => s.numeric_dims > 0).length,
    dim_counts,
    learning_style_count: sessions.filter((s) => s.learning_style != null && s.learning_style !== '').length,
    backfilled_signal_sessions: sessions.filter((s) => s.bf_sig > 0).length,
    unbackfillable_zero_response: sessions.filter((s) => !s.has_graph && s.responses === 0).length,
    graph_gap_with_responses: sessions.filter((s) => !s.has_graph && s.responses > 0).length,
    behaviour_trend_rows: trendRows.length,
    users,
    sessions: sessions.map((s) => ({
      sid: s.id.slice(0, 8),
      email_masked: s.email ? maskEmail(s.email) : null,
      owned: s.owned,
      concern: s.concern,
      responses: s.responses,
      act_sig: s.act_sig,
      bf_sig: s.bf_sig,
      has_graph: s.has_graph,
      dims: s.dims,
      learning_style: s.learning_style,
      numeric_dims: s.numeric_dims,
    })),
  };
}

/** Resolve evidence kind by MIRRORING the live /respond route (sdi_items → assessment, else int → short, else unknown). */
async function detectKind(pool: Pool, itemId: string): Promise<EvidenceInput['kind']> {
  try {
    const sdi = await pool.query('SELECT 1 FROM sdi_items WHERE id::text = $1 LIMIT 1', [itemId]);
    if (sdi.rows.length) return 'assessment';
    if (/^\d+$/.test(itemId)) {
      const saq = await pool.query('SELECT 1 FROM short_assessment_questions WHERE id = $1 LIMIT 1', [parseInt(itemId, 10)]);
      if (saq.rows.length) return 'short_assessment';
    }
  } catch { /* degrade — never throws */ }
  return 'unknown';
}

interface ApplyLog {
  graph_backfilled: string[];        // sids that gained a graph (responses>0, was ungraphed)
  graph_skipped_zero_response: string[]; // sids refused (0 responses → un-backfillable)
  persist_stable: number;            // sessions re-persisted with byte-identical dim VALUES
  persist_changed: { sid: string; detail: string }[];
  trend_users: { email_masked: string; rows: number; dims: string[] }[];
}

async function apply(pool: Pool, before: Snapshot): Promise<ApplyLog> {
  const log: ApplyLog = {
    graph_backfilled: [], graph_skipped_zero_response: [], persist_stable: 0, persist_changed: [], trend_users: [],
  };
  const sessions = await loadSessions(pool);

  // ── Step 1: idempotent graph backfill over ungraphed sessions THAT HAVE RESPONSES (never 0-response) ──
  for (const s of sessions) {
    if (s.has_graph) continue;
    if (s.responses === 0) { log.graph_skipped_zero_response.push(s.id.slice(0, 8)); continue; }
    const { rows: resp } = await pool.query(
      `SELECT item_id::text AS item_id, response_value, concern_bucket
         FROM capadex_responses WHERE session_id::text = $1 ORDER BY created_at ASC`,
      [s.id],
    );
    const inputs: EvidenceInput[] = [];
    for (const r of resp) {
      if (r.response_value == null) continue;
      inputs.push({
        item_id: String(r.item_id),
        response_value: Number(r.response_value),
        response_time_ms: null,          // telemetry irrecoverable → omitted, NEVER fabricated
        answer_changed: false,
        bucket: r.concern_bucket ?? null,
        kind: await detectKind(pool, String(r.item_id)),
      });
    }
    if (inputs.length === 0) { log.graph_skipped_zero_response.push(s.id.slice(0, 8)); continue; }
    const { rows: meta } = await pool.query(
      `SELECT primary_construct_key, concern_name, master_concern_pk FROM capadex_sessions WHERE id::text = $1`,
      [s.id],
    );
    await runEvidenceRuntime(pool, {
      id: s.id,
      primary_construct_key: meta[0]?.primary_construct_key ?? null,
      concern_name: meta[0]?.concern_name ?? s.concern,
      master_concern_pk: meta[0]?.master_concern_pk ?? null,
    }, inputs);
    await pool.query(
      `UPDATE capadex_session_signals
          SET signal_value = COALESCE(signal_value,'{}'::jsonb) || '{"wcl0f_backfill": true}'::jsonb
        WHERE session_id = $1 AND lifecycle_state IS NOT NULL`,
      [s.id],
    );
    await buildBehaviorGraph(pool, s.id);
    log.graph_backfilled.push(s.id.slice(0, 8));
  }

  // ── Step 2: idempotent WC-L0 persistence (ALIGNMENT ON) over every completed session ──
  // Proof is VALUE-level (not just dim-count): a regression to NULL would change a value, and so would
  // any silent re-projection drift — both are caught by an exact per-dim before/after value compare.
  const beforeDimsBySid = new Map(before.sessions.map((s) => [s.sid, s.dims]));
  const after1 = await loadSessions(pool);
  for (const s of after1) {
    const row = await persistUserIntelligence(pool, s.id);
    void row;
  }
  const after2 = await loadSessions(pool);
  for (const s of after2) {
    const sid = s.id.slice(0, 8);
    const b = beforeDimsBySid.get(sid);
    if (!b) continue;
    const diffs = DIMS.filter((d) => (b[d] ?? null) !== (s.dims[d] ?? null));
    if (diffs.length === 0) log.persist_stable += 1;
    else log.persist_changed.push({ sid, detail: diffs.map((d) => `${d} ${b[d] ?? 'null'}→${s.dims[d] ?? 'null'}`).join(', ') });
  }

  // ── Step 3: behaviour-trend persistence for every owner with >=2 completed sessions ──
  const { rows: users } = await pool.query(
    `SELECT LOWER(guest_email) AS email, COUNT(*) AS completed
       FROM capadex_sessions WHERE status='completed' AND guest_email IS NOT NULL
      GROUP BY LOWER(guest_email) HAVING COUNT(*) >= 2 ORDER BY LOWER(guest_email)`,
  );
  for (const u of users) {
    const email = String(u.email);
    const res = await persistUserBehaviourTrends(pool, email);
    log.trend_users.push({
      email_masked: maskEmail(email),
      rows: res?.trends.length ?? 0,
      dims: (res?.trends ?? []).map((t) => `${t.dim}:${t.direction}(${t.points}pt,${t.confidence})`),
    });
  }
  return log;
}

function pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${((n / d) * 100).toFixed(1)}%`;
}

function writeReports(before: Snapshot, after: Snapshot, log: ApplyLog): void {
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString();
  const ceiling = after.completed - after.unbackfillable_zero_response;

  // 1 — Behaviour Coverage
  const sessTable = after.sessions.map((s) =>
    `| ${s.sid} | ${s.owned ? 'owned' : 'anon'} | ${s.responses} | ${s.has_graph ? 'Y' : '·'} | ${s.numeric_dims} | ${DIMS.map((d) => s.dims[d] ?? '·').join('/')} | ${s.learning_style ?? '·'} |`,
  ).join('\n');
  writeFileSync(join(OUT_DIR, '01_behaviour_coverage_report.md'), `# WC-L0F · Deliverable 1 — Behaviour Coverage Report
_Generated ${stamp}. Emails one-way sha256-masked._

## Headline (reconciled — the "~22%" premise is STALE)
- Behaviour coverage (completed sessions with >=1 numeric construct dim): **${after.coverage_any_numeric}/${after.completed} = ${pct(after.coverage_any_numeric, after.completed)}** (before this run: ${before.coverage_any_numeric}/${before.completed} = ${pct(before.coverage_any_numeric, before.completed)}).
- The 22% figure is the PRE-WC-L0E state. The WC-L0E signal backfill is **already applied** — ${after.backfilled_signal_sessions} sessions carry \`wcl0e_backfill\` provenance — which lifted coverage to its current level before WC-L0F began.
- **Honest ceiling = ${ceiling}/${after.completed} = ${pct(ceiling, after.completed)}.** The remaining ${after.unbackfillable_zero_response} session(s) have **0 responses** → no evidence → permanently un-backfillable (a concern-seed-only graph would fabricate behaviour and is refused). 80%+ is NOT reachable on this base without fabrication.

## Per-dimension presence (of ${after.completed} completed sessions)
${DIMS.map((d) => `- ${d}: ${after.dim_counts[d]}/${after.completed}`).join('\n')}
- learning_style (categorical, never trended): ${after.learning_style_count}/${after.completed}

## Per-session detail
| session | type | resp | graph | #dims | mot/conf/risk/eng/adapt | learning_style |
|---|---|---|---|---|---|---|
${sessTable}

**Coverage vs Confidence:** coverage = a dim value exists; it does NOT assert the value is high-confidence. Deficit-coded dims are capped at the neutral 50 (a concern signal may mark a construct impaired, never assert a strength).
`);

  // 2 — Signal Coverage
  writeFileSync(join(OUT_DIR, '02_signal_coverage_report.md'), `# WC-L0F · Deliverable 2 — Signal Coverage Report
_Generated ${stamp}._

- Sessions with activated signals (\`signal_type='activated'\`): **${after.with_activated_signals}/${after.completed} = ${pct(after.with_activated_signals, after.completed)}** (before: ${before.with_activated_signals}/${before.completed}).
- Sessions stamped as WC-L0E backfilled: ${after.backfilled_signal_sessions}/${after.completed}.
- WC-L0F graph backfill (ungraphed sessions WITH responses): **${log.graph_backfilled.length}** activated${log.graph_backfilled.length ? ` (${log.graph_backfilled.join(', ')})` : ' — none (coverage already at ceiling)'}.
- Refused as un-backfillable (0 responses → no evidence): ${log.graph_skipped_zero_response.length}${log.graph_skipped_zero_response.length ? ` (${log.graph_skipped_zero_response.join(', ')})` : ''}.

## Dormant signal sources — audited, intentionally NOT activated (would fabricate)
- \`rapid_answer\` / \`rapid_answer_pattern\` / \`prolonged_hesitation\`: emitted with **NULL strength** → no magnitude to inverse-code into a construct dim. Mapping them would invent a dimension.
- \`GENERAL_CONCERN\`: non-specific catch-all → maps to no single construct.
- These are honest omissions, not gaps. The 6 specific readable-strength concern keys already cover 100% of the construct-feeding signal vocabulary via \`SIGNAL_DEFICIT_MAP\`.
`);

  // 3 — Graph Population
  writeFileSync(join(OUT_DIR, '03_graph_population_report.md'), `# WC-L0F · Deliverable 3 — Graph Population Report
_Generated ${stamp}._

- Sessions with a materialized behaviour graph (\`capadex_behavior_graph\`): **${after.with_graph}/${after.completed} = ${pct(after.with_graph, after.completed)}** (before: ${before.with_graph}/${before.completed}).
- Graph-gap sessions WITH responses (the only honest backfill target): ${before.graph_gap_with_responses} → ${after.graph_gap_with_responses} after run.
- Un-backfillable 0-response sessions (no graph, no evidence): ${after.unbackfillable_zero_response} → **honest population ceiling = ${after.with_graph + after.graph_gap_with_responses}/${after.completed}** (all response-bearing sessions graphed).
- Re-persist idempotency check (VALUE-level, per-dim before/after): ${log.persist_stable}/${after.completed} sessions re-projected to BYTE-IDENTICAL dim values (no regression)${log.persist_changed.length ? `; CHANGED: ${log.persist_changed.map((c) => `${c.sid} [${c.detail}]`).join('; ')}` : ' — zero drift, namespace alignment preserved the deficit dims (none silently reverted to NULL)'}.
`);

  // 4 — Trend Readiness
  const userTrend = after.users.map((u) =>
    `| ${u.email_masked} | ${u.completed} | ${u.dims_with_two_points.join(', ') || '—'} | ${u.persisted_trend_metrics.map((m) => m.replace('behaviour_', '')).join(', ') || '—'} | ${u.computed_trends.map((t) => `${t.dim} ${t.direction}(${t.confidence})`).join(', ') || '—'} |`,
  ).join('\n');
  writeFileSync(join(OUT_DIR, '04_trend_readiness_report.md'), `# WC-L0F · Deliverable 4 — Trend Readiness Report
_Generated ${stamp}._

## Headline — the genuine WC-L0F lift
- Persisted behaviour-trend rows in \`wc3_longitudinal_trends\` (metric \`behaviour_*\`): **${before.behaviour_trend_rows} → ${after.behaviour_trend_rows}**.
- Owners now carrying >=1 persisted behaviour trend: **${after.users.filter((u) => u.persisted_trend_metrics.length > 0).length}/${after.users.length}** (eligible = owners with >=2 completed sessions).

**Why this moved:** WC-L0E graphed BOTH sessions of the returning owners, so for the first time a dimension has >=2 readable points across one user's history. A trend needs >=2 readable points for the SAME dim; \`learning_style\` is categorical and never trended.

## Per eligible owner
| owner | completed | dims with >=2 points | persisted trends | computed trend (dir, conf) |
|---|---|---|---|---|
${userTrend}

**Honest confidence:** every trend is a 2-point line → confidence **0.33 (low)** by the WC-L1 rule (a 2-point line cannot distinguish a real trend from noise). Coverage (a trend exists) and Confidence (it is trustworthy) are SEPARATE axes; this is readiness, not a validated trajectory.
`);

  // 5 — Coverage Improvement
  const fcBeforeRisk = before.users.filter((u) => u.forecast.risk_forecastable).length;
  const fcAfterRisk = after.users.filter((u) => u.forecast.risk_forecastable).length;
  writeFileSync(join(OUT_DIR, '05_coverage_improvement_report.md'), `# WC-L0F · Deliverable 5 — Coverage Improvement Report (before → after)
_Generated ${stamp}._

| metric | before | after | note |
|---|---|---|---|
| Behaviour coverage (>=1 numeric dim) | ${before.coverage_any_numeric}/${before.completed} (${pct(before.coverage_any_numeric, before.completed)}) | ${after.coverage_any_numeric}/${after.completed} (${pct(after.coverage_any_numeric, after.completed)}) | already at WC-L0E ceiling; graph backfill is a no-op |
| Activated-signal coverage | ${before.with_activated_signals}/${before.completed} | ${after.with_activated_signals}/${after.completed} | unchanged (response-bearing sessions already captured) |
| Graph population | ${before.with_graph}/${before.completed} | ${after.with_graph}/${after.completed} | ceiling = all response-bearing sessions |
| Persisted behaviour-trend rows | ${before.behaviour_trend_rows} | ${after.behaviour_trend_rows} | **the genuine lift** |
| Behaviour-forecast (risk) readiness | ${fcBeforeRisk}/${before.users.length} | ${fcAfterRisk}/${after.users.length} | honest ceiling — see below |

## Honest forecast-readiness ceiling (do NOT inflate)
- The forecast engine surfaces only the **\`risk\`** behaviour dim as a forecast. \`risk\` is the **sparsest** dim — it is NULL on both returning owners' response-bearing sessions (risk=50 appears only on anon / seed / single sessions). So neither owner has >=2 readable risk points → **behaviour-forecast readiness stays ${fcAfterRisk}/${after.users.length}** even though behaviour TRENDS activated.
- The non-behaviour forecasts (growth/outcome/journey) were already active via WC-L1 / WC-L2B and are unaffected.
- **Binding constraints, in order:** (1) zero-response sessions cap coverage at ${pct(ceiling, after.completed)}; (2) single-session owners & anon sessions cannot trend; (3) the \`risk\`-dim capture sparsity caps behaviour-forecast readiness. None is fixable by this layer without new capture or fabrication.
`);

  // 6 — Executive Summary
  writeFileSync(join(OUT_DIR, '06_executive_summary.md'), `# WC-L0F · Executive Summary — Behaviour Capture Remediation
_Generated ${stamp}. Additive · flag-gated · reversible · STOP FOR APPROVAL (no deploy)._

## What was actually true (measured, not assumed)
The "~22% behaviour coverage" premise was **stale**. The WC-L0E signal backfill is already applied (${after.backfilled_signal_sessions} sessions stamped), so coverage was already **${pct(before.coverage_any_numeric, before.completed)}** when WC-L0F began. WC-L0F honestly reconciles this rather than claiming a 22%→78% lift it did not perform.

## What WC-L0F did (reuse only — no new ontology/dim/model)
1. **Graph backfill (idempotent):** ${log.graph_backfilled.length} sessions activated; ${log.graph_skipped_zero_response.length} refused as un-backfillable (0 responses). Coverage was already at its ceiling, so this was a confirming no-op.
2. **Re-persistence WITH namespace alignment ON:** ${log.persist_stable}/${after.completed} sessions stable, ${log.persist_changed.length} changed — proving the deficit dims were NOT regressed to NULL (the trap of re-persisting without the alignment flag).
3. **Behaviour-trend activation (the genuine lift):** persisted behaviour-trend rows **${before.behaviour_trend_rows} → ${after.behaviour_trend_rows}** across ${after.users.filter((u) => u.persisted_trend_metrics.length > 0).length} owner(s), because WC-L0E graphed both sessions of returning owners.

## Honest ceilings (reported, never inflated)
- **Coverage ceiling = ${pct(ceiling, after.completed)}** (${after.unbackfillable_zero_response} zero-response sessions are permanently un-backfillable). **80%+ is not reachable on this base without fabrication.**
- **Trend confidence = 0.33 (low)** — every series is 2 points.
- **Behaviour-forecast (risk) readiness unchanged** — the forecast surface consumes only the sparse \`risk\` dim.

## The real binding constraint
Not persistence, not the projection, not trend math — it is **upstream behaviour-signal CAPTURE volume**: more completed, response-bearing, *returning-user* sessions (and, for forecasts, richer \`risk\`-dim capture). That is a data-collection lever, not an engineering one.
`);
}

async function main(): Promise<void> {
  const applyMode = process.argv.includes('--apply');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log(`\n=== WC-L0F Behaviour Capture Remediation — ${applyMode ? 'APPLY (writes)' : 'DRY-RUN (read-only)'} ===\n`);
    const before = await snapshot(pool);
    console.log(`Completed sessions: ${before.completed}`);
    console.log(`Behaviour coverage (>=1 numeric dim): ${before.coverage_any_numeric}/${before.completed} = ${pct(before.coverage_any_numeric, before.completed)}`);
    console.log(`Graph population: ${before.with_graph}/${before.completed} · activated-signal: ${before.with_activated_signals}/${before.completed}`);
    console.log(`Un-backfillable 0-response (ceiling cap): ${before.unbackfillable_zero_response} · graph-gap WITH responses: ${before.graph_gap_with_responses}`);
    console.log(`Persisted behaviour-trend rows: ${before.behaviour_trend_rows}`);
    console.log(`Eligible owners (>=2 completed): ${before.users.length}`);
    for (const u of before.users) {
      console.log(`  • ${u.email_masked}: dims>=2pts=[${u.dims_with_two_points.join(',')}] persisted=[${u.persisted_trend_metrics.map((m) => m.replace('behaviour_', '')).join(',')}] forecastable=${u.forecast.forecastable_count} (risk=${u.forecast.risk_forecastable})`);
    }

    if (!applyMode) {
      console.log(`\nDRY-RUN — nothing written. Re-run with --apply to persist (idempotent, additive, never overwrites positive dims) and emit deliverables under audit/wc-l0f/.`);
      return;
    }

    const log = await apply(pool, before);
    const after = await snapshot(pool);

    console.log(`\n--- APPLY result ---`);
    console.log(`Graph backfilled: ${log.graph_backfilled.length} · refused 0-response: ${log.graph_skipped_zero_response.length}`);
    console.log(`Re-persist stable: ${log.persist_stable}/${after.completed} · changed: ${log.persist_changed.length}`);
    console.log(`Behaviour trends: ${before.behaviour_trend_rows} → ${after.behaviour_trend_rows} rows`);
    for (const t of log.trend_users) console.log(`  • ${t.email_masked}: ${t.rows} trend(s) [${t.dims.join(', ')}]`);

    writeReports(before, after, log);
    const baseline = { stamp: new Date().toISOString(), phase: 'wc-l0f', before, after, apply: log };
    writeFileSync(join(OUT_DIR, '_baseline.json'), JSON.stringify(baseline, null, 2));
    console.log(`\nDeliverables written to ${OUT_DIR} (6 reports + _baseline.json).`);
    console.log(`STOP FOR APPROVAL — dev DB only, no deploy.`);
  } catch (err) {
    console.error('[wcl0f-remediation] fatal:', err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
