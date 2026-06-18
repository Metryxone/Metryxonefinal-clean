/**
 * WC-L3 — Concern Linkage Backfill (IMPLEMENTATION · ADDITIVE · NEVER-OVERWRITE · IDEMPOTENT).
 *
 * Executes the approved WC-L3 recommendation: the WC-L3 audit proved that completed sessions carry a
 * captured `concern_name` whose `master_concern_pk` / `primary_construct_key` simply went UNPERSISTED
 * (stale, not a capture or resolver-quality failure). This script restores that linkage by RE-RUNNING the
 * EXISTING resolvers over the stored text, then lets the EXISTING WC-L2B outcome+trend engine activate.
 *
 * It REUSES existing assets ONLY — no new ontology / constructs / outcome models / scoring:
 *   • Concern PK   : `resolveSeedConcernPk`  (services/concern-signal-seeding.ts, 60% token overlap)
 *   • Construct key: `detectCategory`        (routes/capadex-concern-intelligence.ts)
 *   • Outcome      : `resolveSessionOutcomes` (services/wc3/outcome-intelligence.ts) + L5C crosswalk tier
 *   • Trend        : `persistUserTrends`      (services/wc3/trend-intelligence.ts) — WC-L1
 *   • Forecast meas: `computeUserForecasts`   (services/wc3/forecast-intelligence.ts) — WC-L2
 *
 * HONESTY CONTRACT (user canon — honesty over targets):
 *   • Linkage writes are NEVER-OVERWRITE: each UPDATE is guarded `WHERE <col> IS NULL`, so a non-null
 *     linkage is never touched. Idempotent — a re-run resolves the same text to the same value (no-op).
 *   • Outcome backfill is gated to sessions with ≥1 RESPONSE — an intentional, conservative refinement of
 *     the WC-L2B backfill so we do NOT persist EVIDENCE-FREE outcome rows for the 3 zero-response sessions
 *     (those route structurally but carry no behaviour). This does not affect any forecast: every eligible
 *     owner's sessions have responses. The withheld sessions are reported explicitly, never hidden.
 *   • The resolvers/engine write NOTHING when they cannot map the text → no fabrication.
 *   • DRY-RUN by default (no writes); pass `--apply` to persist. Every before/after number is measured live.
 *   • PII: owner emails are one-way sha256-masked; no raw email reaches any artifact.
 *
 * Run (DRY-RUN):
 *   cd backend && FF_FORECAST_INTELLIGENCE=1 FF_WC3_OUTCOME=1 FF_WC3_OUTCOME_CROSSWALK=1 \
 *     npx tsx scripts/wc3/wcl3-concern-linkage-backfill.ts
 * Run (APPLY):  ... npx tsx scripts/wc3/wcl3-concern-linkage-backfill.ts --apply
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { resolveSeedConcernPk } from '../../services/concern-signal-seeding';
import { detectCategory } from '../../routes/capadex-concern-intelligence';
import { resolveSessionOutcomes } from '../../services/wc3/outcome-intelligence';
import { persistUserTrends, computeUserTrends } from '../../services/wc3/trend-intelligence';
import { computeUserForecasts } from '../../services/wc3/forecast-intelligence';
import { isForecastIntelligenceEnabled, isWc3OutcomeCrosswalkEnabled, isWc3OutcomeEnabled } from '../../config/feature-flags';

const APPLY = process.argv.includes('--apply');
const OUT_DIR = join(process.cwd(), 'audit', 'wc-l3');
const mask = (e: string | null | undefined) => e ? 'user_' + createHash('sha256').update(e.toLowerCase()).digest('hex').slice(0, 10) : 'anon';
const pct = (n: number, d: number) => (d === 0 ? '—' : ((n / d) * 100).toFixed(1) + '%');
const yn = (b: boolean) => (b ? 'yes' : 'no');

interface OwnerMetric {
  owner: string; sessions: number; eligible: boolean;
  outcomeBearing: number; outcomeTrendPoints: number; hasOutcomeTrend: boolean;
  outcomeForecastable: boolean; forecastConfidence: number | null; forecastBand: string | null;
}
interface Snapshot {
  masterLinked: number; constructLinked: number; completed: number;
  outcomeSessionsTotal: number; outcomeSessionsOwned: number; outcomeSessionsAnon: number;
  eligibleOwners: number; outcomeTrendOwners: number; outcomeForecastOwners: number;
  owners: OwnerMetric[];
}

async function ownedEmails(pool: Pool): Promise<Map<string, number>> {
  const { rows } = await pool.query(
    `SELECT LOWER(guest_email) AS email, COUNT(*)::int AS n FROM capadex_sessions
      WHERE status='completed' AND guest_email IS NOT NULL AND guest_email<>'' GROUP BY LOWER(guest_email)`);
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.email, r.n);
  return m;
}

async function snapshot(pool: Pool): Promise<Snapshot> {
  const { rows: c } = await pool.query(`SELECT
      COUNT(*) FILTER (WHERE status='completed')::int AS completed,
      COUNT(*) FILTER (WHERE status='completed' AND master_concern_pk IS NOT NULL)::int AS master,
      COUNT(*) FILTER (WHERE status='completed' AND primary_construct_key IS NOT NULL AND primary_construct_key<>'')::int AS construct
      FROM capadex_sessions`);
  const { rows: st } = await pool.query(
    `SELECT DISTINCT o.session_id::text AS sid, (s.guest_email IS NOT NULL AND s.guest_email<>'') AS owned
       FROM wc3_outcome_state o JOIN capadex_sessions s ON s.id=o.session_id`);
  const owners = await ownedEmails(pool);
  const om: OwnerMetric[] = [];
  for (const [email, n] of owners) {
    const { rows: ob } = await pool.query(
      `SELECT COUNT(DISTINCT o.session_id)::int AS c FROM wc3_outcome_state o
         JOIN capadex_sessions s ON s.id=o.session_id WHERE LOWER(s.guest_email)=$1 AND s.status='completed'`, [email]);
    const trends = await computeUserTrends(pool, email);
    const ot = trends.trends.find((t) => t.lever === 'outcome') ?? null;
    const fc = await computeUserForecasts(pool, email);
    let f = false, conf: number | null = null, band: string | null = null;
    if (fc.enabled && fc.forecasts.outcome.forecastable) { f = true; conf = fc.forecasts.outcome.forecast_confidence; band = fc.forecasts.outcome.confidence_band; }
    om.push({ owner: mask(email), sessions: n, eligible: n >= 2, outcomeBearing: ob[0].c,
      outcomeTrendPoints: ot ? ot.points : 0, hasOutcomeTrend: !!ot, outcomeForecastable: f, forecastConfidence: conf, forecastBand: band });
  }
  const elig = om.filter((o) => o.eligible);
  return {
    masterLinked: c[0].master, constructLinked: c[0].construct, completed: c[0].completed,
    outcomeSessionsTotal: st.length, outcomeSessionsOwned: st.filter((r) => r.owned).length, outcomeSessionsAnon: st.filter((r) => !r.owned).length,
    eligibleOwners: elig.length, outcomeTrendOwners: elig.filter((o) => o.hasOutcomeTrend).length, outcomeForecastOwners: elig.filter((o) => o.outcomeForecastable).length,
    owners: om,
  };
}

interface LinkageCell {
  sid: string; owned: boolean; who: string; concern: string; responses: number;
  hadMaster: boolean; hadPck: boolean;
  reMaster: number | null; rePck: string | null;
  masterWritten: boolean; pckWritten: boolean;
  outcomeWritten: boolean; modelsWritten: string[]; outcomeNote: string;
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const stamp = new Date().toISOString();
  const flags = { forecast: isForecastIntelligenceEnabled(), outcome: isWc3OutcomeEnabled(), crosswalk: isWc3OutcomeCrosswalkEnabled() };

  const before = await snapshot(pool);

  const { rows: sessions } = await pool.query(
    `SELECT s.id::text AS id, (s.guest_email IS NOT NULL AND s.guest_email<>'') AS owned, s.guest_email,
            s.concern_name, s.master_concern_pk, s.primary_construct_key,
            (SELECT count(*) FROM capadex_responses r WHERE r.session_id::text=s.id::text)::int AS responses,
            EXISTS(SELECT 1 FROM wc3_outcome_state o WHERE o.session_id=s.id) AS had_outcome
       FROM capadex_sessions s WHERE s.status='completed' ORDER BY s.created_at`);

  const cells: LinkageCell[] = [];
  for (const r of sessions) {
    const hadMaster = r.master_concern_pk != null;
    const hadPck = !!(r.primary_construct_key && String(r.primary_construct_key).trim() !== '');
    const reMaster = hadMaster ? null : await resolveSeedConcernPk(pool, r.concern_name, true);
    const rePck = hadPck ? null : (detectCategory(String(r.concern_name || '')).construct_key);
    const cell: LinkageCell = {
      sid: r.id, owned: r.owned, who: mask(r.guest_email), concern: String(r.concern_name || ''), responses: r.responses,
      hadMaster, hadPck, reMaster, rePck, masterWritten: false, pckWritten: false,
      outcomeWritten: false, modelsWritten: [], outcomeNote: '',
    };

    // ── Phase 1: additive never-overwrite linkage backfill ──
    if (!hadMaster && reMaster != null) {
      if (APPLY) {
        const u = await pool.query(`UPDATE capadex_sessions SET master_concern_pk=$1 WHERE id=$2 AND master_concern_pk IS NULL`, [reMaster, r.id]);
        cell.masterWritten = (u.rowCount ?? 0) > 0;
      } else cell.masterWritten = true; // planned
    }
    if (!hadPck && rePck) {
      if (APPLY) {
        const u = await pool.query(`UPDATE capadex_sessions SET primary_construct_key=$1 WHERE id=$2 AND (primary_construct_key IS NULL OR primary_construct_key='')`, [rePck, r.id]);
        cell.pckWritten = (u.rowCount ?? 0) > 0;
      } else cell.pckWritten = true; // planned
    }

    // ── Phase 2: outcome backfill (never-overwrite; gated ≥1 response) ──
    const nowLinked = hadMaster || hadPck || cell.masterWritten || cell.pckWritten;
    if (r.had_outcome) {
      cell.outcomeNote = 'skipped — existing outcome state (never-overwrite)';
    } else if (!nowLinked) {
      cell.outcomeNote = 'no linkage even after re-resolve — chain has no input';
    } else if (r.responses === 0) {
      cell.outcomeNote = 'WITHHELD — 0 responses (linkage filled, but no behavioural evidence; excluded to avoid evidence-free outcome)';
    } else if (APPLY) {
      const summary = await resolveSessionOutcomes(pool, { sessionId: r.id, userEmail: r.guest_email ?? null, userId: null });
      if (summary && !summary.unclassified && summary.models.length > 0) {
        cell.outcomeWritten = true; cell.modelsWritten = summary.models.map((m) => m.model_key);
      } else cell.outcomeNote = summary ? `engine UNCLASSIFIED (${summary.reason ?? 'no_model_match'})` : 'engine returned null';
    } else {
      cell.outcomeNote = 'planned — would resolve outcome (dry-run)'; cell.outcomeWritten = true; // planned
    }
    cells.push(cell);
  }

  // ── Phase 3: recompute outcome trends for eligible owners (idempotent upsert) ──
  let trendRecomputes = 0;
  if (APPLY) {
    const owners = await ownedEmails(pool);
    for (const [email, n] of owners) { if (n < 2) continue; await persistUserTrends(pool, email); trendRecomputes++; }
  }

  const after = APPLY ? await snapshot(pool) : before;

  const masterFilled = cells.filter((c) => c.masterWritten).length;
  const pckFilled = cells.filter((c) => c.pckWritten).length;
  const outcomeFilled = cells.filter((c) => c.outcomeWritten).length;
  const withheld = cells.filter((c) => c.outcomeNote.startsWith('WITHHELD')).length;

  const mode = APPLY ? 'APPLY (writes committed)' : 'DRY-RUN (no writes — counts are PLANNED)';
  const flagLine = `Mode: **${mode}**. Flags: \`FF_FORECAST_INTELLIGENCE\`=${flags.forecast ? 'ON' : 'OFF'}, \`FF_WC3_OUTCOME\`=${flags.outcome ? 'ON' : 'OFF'}, \`FF_WC3_OUTCOME_CROSSWALK\`=${flags.crosswalk ? 'ON' : 'OFF'}.`;

  writeFileSync(join(OUT_DIR, '08_backfill_execution_report.md'), `# WC-L3 Deliverable 8 — Concern Linkage Backfill Execution
_Generated ${stamp}_

${flagLine}

Executes the approved WC-L3 recommendation: re-resolve & persist the stale concern/construct linkage with
the EXISTING resolvers (additive, never-overwrite), then activate outcomes/trends via the EXISTING WC-L2B
engine. Outcome backfill is gated to sessions with ≥1 response (no evidence-free rows).

## Coverage before → after
| Metric | Before | After |
|---|---|---|
| Concern linked (\`master_concern_pk\`) | ${before.masterLinked}/${before.completed} (${pct(before.masterLinked, before.completed)}) | ${after.masterLinked}/${after.completed} (${pct(after.masterLinked, after.completed)}) |
| Construct linked (\`primary_construct_key\`) | ${before.constructLinked}/${before.completed} (${pct(before.constructLinked, before.completed)}) | ${after.constructLinked}/${after.completed} (${pct(after.constructLinked, after.completed)}) |
| Outcome-state sessions (total) | ${before.outcomeSessionsTotal} | ${after.outcomeSessionsTotal} |
| — owned / anon | ${before.outcomeSessionsOwned} / ${before.outcomeSessionsAnon} | ${after.outcomeSessionsOwned} / ${after.outcomeSessionsAnon} |
| Eligible owners (≥2 sessions) | ${before.eligibleOwners} | ${after.eligibleOwners} |
| Eligible owners WITH outcome trend | ${before.outcomeTrendOwners} (${pct(before.outcomeTrendOwners, before.eligibleOwners)}) | ${after.outcomeTrendOwners} (${pct(after.outcomeTrendOwners, after.eligibleOwners)}) |
| Eligible owners WITH outcome forecast | ${before.outcomeForecastOwners} (${pct(before.outcomeForecastOwners, before.eligibleOwners)}) | ${after.outcomeForecastOwners} (${pct(after.outcomeForecastOwners, after.eligibleOwners)}) |

Writes this run: master_concern_pk **${masterFilled}**, primary_construct_key **${pckFilled}**, outcome rows **${outcomeFilled}**, withheld (0-response) **${withheld}**, trend recomputes **${trendRecomputes}**.

## Per-session ledger
| Session | Owned | resp | concern | had master | had pck | re_master | re_pck | master written | pck written | outcome |
|---|---|---|---|---|---|---|---|---|---|---|
${cells.map((c) => `| ${c.sid.slice(0, 8)} | ${yn(c.owned)} | ${c.responses} | ${c.concern} | ${yn(c.hadMaster)} | ${yn(c.hadPck)} | ${c.reMaster ?? '—'} | ${c.rePck ?? '—'} | ${yn(c.masterWritten)} | ${yn(c.pckWritten)} | ${c.outcomeWritten ? '**' + (c.modelsWritten.join(', ') || 'resolved') + '**' : c.outcomeNote} |`).join('\n')}

## Per eligible owner (after)
| Owner | Sessions | Outcome-bearing | Trend points | Has trend | Forecastable | Confidence | Band |
|---|---|---|---|---|---|---|---|
${after.owners.filter((o) => o.eligible).map((o) => `| ${o.owner} | ${o.sessions} | ${o.outcomeBearing} | ${o.outcomeTrendPoints} | ${yn(o.hasOutcomeTrend)} | ${yn(o.outcomeForecastable)} | ${o.forecastConfidence ?? '—'} | ${o.forecastBand ?? '—'} |`).join('\n') || '| _(none)_ | | | | | | | |'}

**Honest notes:** linkage writes are guarded \`WHERE <col> IS NULL\` (never overwrite). ${withheld} zero-response
session(s) had linkage filled but outcome WITHHELD (no behavioural evidence — would be an evidence-free row).
Forecast confidence at a 2-point series is the WC-L2 \`low\` (0.33) floor by construction; reaching moderate/high
needs 3–4 outcome-bearing sessions per owner (data-accumulation ceiling, not a linkage defect).
`);

  writeFileSync(join(OUT_DIR, '_backfill_results.json'), JSON.stringify({ generated: stamp, mode, flags, before, after, writes: { masterFilled, pckFilled, outcomeFilled, withheld, trendRecomputes }, cells }, null, 2));

  console.log('WC-L3 Concern Linkage Backfill —', mode);
  console.log('  concern linked:', before.masterLinked, '→', after.masterLinked, '(of', after.completed + ')');
  console.log('  construct linked:', before.constructLinked, '→', after.constructLinked);
  console.log('  writes: master', masterFilled, 'pck', pckFilled, 'outcome', outcomeFilled, 'withheld(0-resp)', withheld);
  console.log('  outcome-state sessions:', before.outcomeSessionsTotal, '→', after.outcomeSessionsTotal, `(owned ${after.outcomeSessionsOwned})`);
  console.log('  eligible owners trend:', `${before.outcomeTrendOwners}/${before.eligibleOwners}`, '→', `${after.outcomeTrendOwners}/${after.eligibleOwners}`,
    '· forecast:', `${before.outcomeForecastOwners}/${before.eligibleOwners}`, '→', `${after.outcomeForecastOwners}/${after.eligibleOwners}`);
  console.log('  →', APPLY ? 'committed' : 'dry-run', '· report: audit/wc-l3/08_backfill_execution_report.md');
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
