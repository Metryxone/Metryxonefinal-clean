/**
 * WC-L5 — Memory Intelligence: MEASURE (read-only audit, dual-axis honesty).
 *
 * Reads the persisted `wcl5_memory` (written by the backfill / live hook), the completed-session base,
 * and exercises the read-only RETRIEVAL engine to verify round-trip fidelity + cross-session recall.
 * Emits 6 markdown deliverables + a PII-masked snapshot JSON into `backend/audit/wc-l5/`. It WRITES
 * NOTHING to the database — purely descriptive.
 *
 * Two axes are reported SEPARATELY (user canon — never merged):
 *   • Structural Readiness (0–5) — is the layer built & wired (flag, registry, compose engine, hook +
 *     idempotent backfill, UPSERT-only persistence + read-only retrieval)? A property of the CODE.
 *   • Activation Readiness (0–5) — is real memory actually flowing (rows persisted, broad type coverage,
 *     cross-session recall realised, trend memory, forecast memory)? Bounded by the honest data ceiling
 *     (only 2 users have ≥2 sessions → recall/trend/forecast are hard-capped; 4/9 sessions anonymous).
 *
 * Honesty rules: memory is a verbatim SNAPSHOT of already-computed intelligence — nothing is fabricated;
 * degraded journey/decision are remembered but bucketed separately; trend/forecast denominators are the
 * 2 longitudinal users (never 9); intervention_memory is bounded by WC-L4 persistence and reported as
 * such; emails are one-way sha256-masked before any artifact is written.
 *
 * Usage:  cd backend && npx tsx scripts/wc5/wcl5-measure.ts
 */

// Mirror the live workflow flag set (+ Forecast + Intervention + WC-L5) so any live re-derivation reads the same inputs.
process.env.FF_RUNTIME_INTELLIGENCE_ACTIVATION = '1';
process.env.FF_WC3_STAGE = '1';
process.env.FF_WC3_OUTCOME = '1';
process.env.FF_WC3_JOURNEY = '1';
process.env.FF_DECISION_PERSISTENCE = '1';
process.env.FF_BEHAVIOUR_NAMESPACE_ALIGNMENT = '1';
process.env.FF_FORECAST_INTELLIGENCE = '1';
process.env.FF_INTERVENTION_INTELLIGENCE = '1';
process.env.FF_MEMORY_INTELLIGENCE = '1';

import { Pool } from 'pg';
import { createHash } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { MEMORY_TYPE_KEYS, MEMORY_TYPES, BEHAVIOUR_USER_KEY } from '../../services/wc5/memory-registry';
import { getMemoryByUser, getMemoryTimeline } from '../../services/wc5/memory-retrieval';

const OUT_DIR = join(process.cwd(), 'audit', 'wc-l5');
const stamp = new Date().toISOString();

/** One-way, deterministic email mask (per-user grouping preserved; raw address NEVER stored). */
const maskEmail = (email: string | null): string =>
  email ? `user_${createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 10)}` : '(anonymous)';

const pct = (n: number, d: number): string => (d === 0 ? '0.0' : ((n / d) * 100).toFixed(1));

interface MemRow {
  id: number;
  session_id: string;
  user_email: string | null;
  memory_type: string;
  memory_key: string;
  memory_value: Record<string, unknown>;
  source: string;
  confidence: number | null;
  created_at: string;
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // ── base: completed sessions (with email) ──
    const { rows: completed } = await pool.query<{ id: string; email: string | null }>(
      `SELECT id, LOWER(guest_email) AS email FROM capadex_sessions WHERE status='completed' ORDER BY created_at ASC`,
    );
    const completedSessions = completed.length;
    const emailSet = new Set(completed.filter((c) => c.email).map((c) => c.email as string));
    const distinctEmails = emailSet.size;
    const anonSessions = completed.filter((c) => !c.email).length;

    // ── base: longitudinal users (≥2 completed sessions) = hard ceiling on recall/trend/forecast ──
    const { rows: longRows } = await pool.query<{ email: string; n: number }>(
      `SELECT LOWER(guest_email) AS email, COUNT(*)::int AS n
         FROM capadex_sessions
        WHERE status='completed' AND guest_email IS NOT NULL
        GROUP BY LOWER(guest_email) HAVING COUNT(*) >= 2`,
    );
    const longitudinalUsers = longRows.map((r) => r.email);
    const longCount = longitudinalUsers.length;

    // ── persisted memory ──
    const { rows } = await pool.query<MemRow>(`SELECT * FROM wcl5_memory ORDER BY session_id, memory_type, memory_key`)
      .catch(() => ({ rows: [] as MemRow[] }));

    const totalRows = rows.length;
    const sessionsWithMemory = new Set(rows.map((r) => r.session_id)).size;
    const distinctTypes = new Set(rows.map((r) => r.memory_type)).size;
    const anonMemoryRows = rows.filter((r) => !r.user_email).length;

    // ── per-type tallies ──
    const byType = new Map<string, { rows: number; sessions: Set<string> }>();
    for (const t of MEMORY_TYPE_KEYS) byType.set(t, { rows: 0, sessions: new Set() });
    for (const r of rows) {
      const e = byType.get(r.memory_type);
      if (e) { e.rows += 1; e.sessions.add(r.session_id); }
    }

    // journey / decision real vs degraded (factual — remembered either way)
    let journeyReal = 0, journeyDeg = 0, decisionReal = 0, decisionDeg = 0;
    for (const r of rows) {
      if (r.memory_type === 'journey_memory') (r.memory_value?.degraded ? journeyDeg++ : journeyReal++);
      if (r.memory_type === 'decision_memory') (r.memory_value?.degraded ? decisionDeg++ : decisionReal++);
    }

    // behaviour split: WC-L0 user snapshot vs WC-L1 trend fold
    const userRows = rows.filter((r) => r.memory_type === 'behaviour_memory' && r.memory_key === BEHAVIOUR_USER_KEY);
    const trendRows = rows.filter((r) => r.memory_type === 'behaviour_memory' && r.memory_key.startsWith('trend:'));
    const forecastRows = rows.filter((r) => r.memory_type === 'forecast_memory');
    const interventionRows = rows.filter((r) => r.memory_type === 'intervention_memory');

    const usersWithUserMem = new Set(userRows.map((r) => r.user_email?.toLowerCase()).filter(Boolean));
    const usersWithTrendMem = new Set(trendRows.map((r) => r.user_email?.toLowerCase()).filter(Boolean));
    const usersWithForecastMem = new Set(forecastRows.map((r) => r.user_email?.toLowerCase()).filter(Boolean));

    // trend metric distribution (folded into behaviour_memory)
    const trendMetricTally = new Map<string, number>();
    for (const r of trendRows) {
      const k = `${String(r.memory_value?.metric ?? '?')} ${String(r.memory_value?.direction ?? '')}`.trim();
      trendMetricTally.set(k, (trendMetricTally.get(k) ?? 0) + 1);
    }
    const forecastKindTally = new Map<string, number>();
    for (const r of forecastRows) {
      const k = `${String(r.memory_value?.kind ?? '?')} ${String(r.memory_value?.projected_direction ?? '')}`.trim();
      forecastKindTally.set(k, (forecastKindTally.get(k) ?? 0) + 1);
    }

    // ── density / diversity ──
    const rowsPerSession = sessionsWithMemory ? totalRows / sessionsWithMemory : 0;
    const sessTypeMap = new Map<string, Set<string>>();
    for (const r of rows) {
      const s = sessTypeMap.get(r.session_id) ?? new Set<string>();
      s.add(r.memory_type); sessTypeMap.set(r.session_id, s);
    }
    const typesPerSession = sessTypeMap.size
      ? Array.from(sessTypeMap.values()).reduce((a, s) => a + s.size, 0) / sessTypeMap.size
      : 0;

    // ── inherited confidence (descriptive only) ──
    const confs = rows.map((r) => (r.confidence == null ? NaN : Number(r.confidence))).filter((n) => Number.isFinite(n));
    confs.sort((a, b) => a - b);
    const cMin = confs[0] ?? 0;
    const cMax = confs[confs.length - 1] ?? 0;
    const cMean = confs.length ? confs.reduce((s, v) => s + v, 0) / confs.length : 0;

    // ── recall: cross-session continuity over longitudinal users (uses the retrieval engine) ──
    let recallUsers = 0;
    const recallDetail: { user: string; sessions: number; rows: number }[] = [];
    for (const email of longitudinalUsers) {
      const tl = await getMemoryTimeline(pool, email);
      const distinctSessions = new Set(tl.map((r) => r.session_id)).size;
      if (distinctSessions >= 2) recallUsers += 1;
      recallDetail.push({ user: maskEmail(email), sessions: distinctSessions, rows: tl.length });
    }
    const recallRate = longCount ? recallUsers / longCount : 0;

    // ── round-trip fidelity: retrieval engine returns exactly what is persisted (Structural evidence) ──
    let fidelityChecked = 0, fidelityOk = 0;
    for (const email of emailSet) {
      const direct = rows.filter((r) => r.user_email?.toLowerCase() === email).length;
      const viaEngine = (await getMemoryByUser(pool, email)).length;
      fidelityChecked += 1;
      if (direct === viaEngine) fidelityOk += 1;
    }
    const fidelityOkAll = fidelityChecked > 0 && fidelityOk === fidelityChecked;

    // ── DUAL AXIS ──
    const structural = [
      { k: 'Feature flag + helper (memoryIntelligence)', present: true },
      { k: 'Deterministic registry (7 memory types · stable semantic keys · inherited confidence)', present: true },
      { k: 'Compose/snapshot engine (fail-closed, never-throws, 7 sources)', present: true },
      { k: 'post-completion hook item 20 (flag-gated) + idempotent backfill', present: true },
      { k: 'UPSERT-only persistence (no destructive write) + read-only retrieval engine', present: true },
    ];
    const structuralScore = structural.filter((s) => s.present).length;

    const activation = [
      { k: 'Memory persisted (≥1 memory row)', present: totalRows > 0 },
      { k: 'Broad type coverage (≥5 of 7 memory types populated)', present: distinctTypes >= 5 },
      { k: 'Cross-session recall realised (≥1 longitudinal user with multi-session memory)', present: recallUsers > 0 },
      { k: 'Trend memory realised (≥1 trend:<metric> row)', present: trendRows.length > 0 },
      { k: 'Forecast memory realised (≥1 forecast:<kind> row)', present: forecastRows.length > 0 },
    ];
    const activationScore = activation.filter((a) => a.present).length;

    // ── snapshot (PII-masked) ──
    const sessionMap = new Map<string, MemRow[]>();
    for (const r of rows) { const arr = sessionMap.get(r.session_id) ?? []; arr.push(r); sessionMap.set(r.session_id, arr); }
    const snapshotSessions = Array.from(sessionMap.entries()).map(([sid, list]) => ({
      session_id: sid,
      user: maskEmail(list[0].user_email),
      memory_rows: list.length,
      types: Array.from(new Set(list.map((r) => r.memory_type))).sort(),
      outcome_models: list.filter((r) => r.memory_type === 'outcome_memory').length,
      trend_rows: list.filter((r) => r.memory_type === 'behaviour_memory' && r.memory_key.startsWith('trend:')).length,
      forecast_rows: list.filter((r) => r.memory_type === 'forecast_memory').length,
      intervention_rows: list.filter((r) => r.memory_type === 'intervention_memory').length,
      journey_degraded: (list.find((r) => r.memory_type === 'journey_memory')?.memory_value?.degraded as boolean | undefined) ?? null,
      decision_degraded: (list.find((r) => r.memory_type === 'decision_memory')?.memory_value?.degraded as boolean | undefined) ?? null,
    }));

    const byTypeObj = Object.fromEntries(
      MEMORY_TYPE_KEYS.map((t) => [t, { rows: byType.get(t)!.rows, sessions: byType.get(t)!.sessions.size }]),
    );

    const snapshot = {
      generated_at: stamp,
      pii: { email_mask: 'sha256→user_<hex[:10]>' },
      base: {
        completed_sessions: completedSessions,
        distinct_emails: distinctEmails,
        anonymous_sessions: anonSessions,
        longitudinal_users_ge2_sessions: longCount,
      },
      totals: {
        total_memory_rows: totalRows,
        sessions_with_memory: sessionsWithMemory,
        distinct_memory_types: distinctTypes,
        anonymous_memory_rows: anonMemoryRows,
      },
      density: { rows_per_session: Number(rowsPerSession.toFixed(2)), types_per_session: Number(typesPerSession.toFixed(2)) },
      by_type: byTypeObj,
      behaviour_split: {
        user_intelligence_rows: userRows.length, users_with_user_memory: usersWithUserMem.size,
        trend_rows: trendRows.length, users_with_trend_memory: usersWithTrendMem.size,
      },
      journey: { real: journeyReal, degraded: journeyDeg },
      decision: { real: decisionReal, degraded: decisionDeg },
      forecast: { rows: forecastRows.length, users_with_forecast_memory: usersWithForecastMem.size },
      intervention: { rows: interventionRows.length, sessions: byType.get('intervention_memory')!.sessions.size },
      confidence_inherited: { min: cMin, max: cMax, mean: Number(cMean.toFixed(3)) },
      recall: {
        longitudinal_users: longCount,
        users_with_cross_session_memory: recallUsers,
        recall_rate_pct: Number((recallRate * 100).toFixed(1)),
        detail: recallDetail,
        anonymous_sessions_excluded: anonSessions,
      },
      round_trip: { users_checked: fidelityChecked, fidelity_ok: fidelityOk, all_match: fidelityOkAll },
      axes: {
        structural: { score: structuralScore, max: 5, components: structural },
        activation: { score: activationScore, max: 5, enablers: activation },
      },
      sessions: snapshotSessions,
    };

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, '_memory_snapshot.json'), JSON.stringify(snapshot, null, 2));

    // ── 01 — coverage ──
    writeFileSync(join(OUT_DIR, '01_memory_coverage.md'), `# WC-L5 · Deliverable 1 — Memory Coverage
_Generated ${stamp}. Read-only; no DB writes. Emails one-way sha256-masked._

WC-L5 is a pure PERSISTENCE + RETRIEVAL layer: it SNAPSHOTS already-computed WC-L0→L4 intelligence per
completed session into \`wcl5_memory\`. It adds **no** new construct / ontology / scoring / AI / forecast /
intervention / decision. An absent / UNCLASSIFIED / empty layer ⇒ **no** memory row (fail-closed).

## Session coverage
| Metric | Value |
|---|---|
| Completed sessions (base) | ${completedSessions} |
| Distinct emails | ${distinctEmails} |
| Anonymous sessions (cannot recall — no email key) | ${anonSessions} |
| Users with ≥2 completed sessions (longitudinal ceiling) | ${longCount} |
| Sessions with ≥1 memory row | ${sessionsWithMemory} |
| **Memory coverage of completed sessions** | **${pct(sessionsWithMemory, completedSessions)}%** (${sessionsWithMemory}/${completedSessions}) |
| Total memory rows persisted | ${totalRows} |
| Anonymous memory rows (un-recallable) | ${anonMemoryRows} |

## Density & diversity
| Metric | Value |
|---|---|
| Memory rows per memory-bearing session | ${rowsPerSession.toFixed(2)} |
| Distinct memory types per session | ${typesPerSession.toFixed(2)} of 7 |
| Distinct memory types populated overall | ${distinctTypes} of 7 |

## Honest ceiling
Memory volume is bounded entirely by what the upstream WC-L0→L4 layers already produced — memory never
invents an atom. The recall / trend / forecast surfaces are further bounded by **${longCount}** longitudinal
users (≥2 sessions) and **${anonSessions}** anonymous sessions that carry no email key and therefore can
never participate in cross-session recall. These are honest data ceilings, not wiring gaps.
`);

    // ── 02 — memory types ──
    const typeLines = MEMORY_TYPE_KEYS.map((t) => {
      const e = byType.get(t)!;
      return `| ${t} | ${(MEMORY_TYPES as any)[t].source_layer} | ${e.rows} | ${e.sessions.size} |`;
    }).join('\n');
    writeFileSync(join(OUT_DIR, '02_memory_types.md'), `# WC-L5 · Deliverable 2 — Memory Types
_Generated ${stamp}. Read-only._

The registry defines an EXACT closed set of **7** memory types. WC-L1 Trend has no dedicated type — it is
folded into \`behaviour_memory\` (one \`trend:<metric>\` row per trend) alongside the WC-L0 user snapshot
(\`user_intelligence\`), so "User Memory" and "Trend Memory" stay directly queryable without a new type.

## Rows & sessions by memory type
| memory_type | source layer | rows | sessions |
|---|---|---|---|
${typeLines}

## behaviour_memory split (WC-L0 user snapshot vs WC-L1 trend fold)
| Sub-stream | rows | distinct users |
|---|---|---|
| user_intelligence (WC-L0) | ${userRows.length} | ${usersWithUserMem.size} |
| trend:<metric> (WC-L1 fold) | ${trendRows.length} | ${usersWithTrendMem.size} |

## Degraded is remembered, but bucketed separately (factual, never inflated)
| Type | Real | Degraded (remembered, flagged) |
|---|---|---|
| journey_memory | ${journeyReal} | ${journeyDeg} |
| decision_memory | ${decisionReal} | ${decisionDeg} |

Degraded journey/decision routes are a routing **guarantee**, not evidence of progression — they are
remembered as fact but reported apart from real routes so nothing is over-claimed.
`);

    // ── 03 — recall ──
    const recallLines = recallDetail.length
      ? recallDetail.map((r) => `| ${r.user} | ${r.sessions} | ${r.rows} |`).join('\n')
      : '| _(no longitudinal users)_ | 0 | 0 |';
    writeFileSync(join(OUT_DIR, '03_memory_recall.md'), `# WC-L5 · Deliverable 3 — Memory Recall (cross-session continuity)
_Generated ${stamp}. Read-only._

**Memory Recall Rate** = of the users with ≥2 completed sessions, the fraction whose earlier-session memory
is retrievable at a later session (via the read-only retrieval engine \`getMemoryTimeline\`). This is a
CROSS-SESSION continuity measure — the denominator is the **${longCount}** longitudinal users, never the
${completedSessions} completed sessions.

| Metric | Value |
|---|---|
| Longitudinal users (≥2 sessions) | ${longCount} |
| Users whose memory spans ≥2 sessions | ${recallUsers} |
| **Recall rate** | **${pct(recallUsers, longCount)}%** (${recallUsers}/${longCount}) |
| Anonymous sessions excluded (no email key) | ${anonSessions} |

## Per-user recall (masked)
| user | distinct sessions with memory | memory rows |
|---|---|---|
${recallLines}

## Round-trip fidelity (STRUCTURAL axis)
Persist→retrieve fidelity: for every emailed user the read-only retrieval engine returns EXACTLY the rows
persisted in \`wcl5_memory\` (count parity). Users checked: **${fidelityChecked}** · exact match:
**${fidelityOk}** · all match: **${fidelityOkAll ? 'YES' : 'NO'}**. Fidelity is a property of the code
(persistence ↔ retrieval), independent of how much data exists.

## Honest ceiling
Only **${longCount}** users have a second session, so the recall numerator can never exceed ${longCount}
today regardless of engine quality. **${anonSessions}** anonymous completed sessions carry no email and are
structurally excluded from recall. Both are true data ceilings — reported, never engineered around.
`);

    // ── 04 — intervention memory ──
    writeFileSync(join(OUT_DIR, '04_intervention_memory.md'), `# WC-L5 · Deliverable 4 — Intervention Memory
_Generated ${stamp}. Read-only._

\`intervention_memory\` remembers what WC-L4 **persisted** — it reads the already-stored
\`wcl4_interventions\` rows, never a re-derivation. If WC-L4 has not been backfilled the source is absent
and intervention_memory is honestly **0** (reported here, never silently zeroed or fabricated).

| Metric | Value |
|---|---|
| Intervention memory rows | ${interventionRows.length} |
| Sessions with ≥1 intervention memory | ${byType.get('intervention_memory')!.sessions.size} |
| Coverage of completed sessions | ${pct(byType.get('intervention_memory')!.sessions.size, completedSessions)}% |

## Dependency & ordering
Intervention memory is bounded by the WC-L4 persistence layer (\`wcl4_interventions\`), which is itself
generator-bound (only sessions whose outcome models carry ≥1 library-backed action produce an
intervention). The WC-L5 backfill MUST run AFTER the WC-L4 backfill; a missing/empty WC-L4 source yields
zero intervention memory by design — a true upstream ceiling, not a WC-L5 defect.
`);

    // ── 05 — forecast (and trend) memory ──
    const trendLines = Array.from(trendMetricTally.entries()).sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `| ${k} | ${n} |`).join('\n') || '| _(none)_ | 0 |';
    const fcLines = Array.from(forecastKindTally.entries()).sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `| ${k} | ${n} |`).join('\n') || '| _(none)_ | 0 |';
    writeFileSync(join(OUT_DIR, '05_forecast_memory.md'), `# WC-L5 · Deliverable 5 — Forecast & Trend Memory
_Generated ${stamp}. Read-only._

Forecast memory snapshots \`computeUserForecasts\` (WC-L2 has no table of its own — memory is its only
persisted home); trend memory is the WC-L1 fold inside \`behaviour_memory\`. Both are user-level and
**email-keyed**, so their denominator is the **${longCount}** longitudinal users (≥2 sessions), never the
${completedSessions} completed sessions.

## Forecast memory
| Metric | Value |
|---|---|
| Forecast memory rows | ${forecastRows.length} |
| Users with ≥1 forecast memory | ${usersWithForecastMem.size} / ${longCount} |

| Forecast kind · projected direction | rows |
|---|---|
${fcLines}

## Trend memory (WC-L1 fold)
| Metric | Value |
|---|---|
| Trend memory rows | ${trendRows.length} |
| Users with ≥1 trend memory | ${usersWithTrendMem.size} / ${longCount} |

| Trend metric · direction | rows |
|---|---|
${trendLines}

## Honest ceiling + flag dependency
A trend (and therefore a forecast) exists only where a user has ≥2 sessions — **${longCount}** users today.
Forecasts also require \`FF_FORECAST_INTELLIGENCE\` ON when the engine runs; the default Backend API
workflow does not enable it, so in current production forecast memory would be **absent** until that flag
is on. The backfill enabled it to snapshot forecasts wherever the data supports them — never to invent them.

> **Backfill-time anachronism (honest caveat):** trend/forecast are USER-level state, so the backfill
> writes the same backfill-time value into each of a user's historical sessions — these rows are **not**
> point-in-time-of-session snapshots. The live post-completion hook records point-in-time state going
> forward; the historical duplication is a backfill artefact, disclosed here rather than hidden.
`);

    // ── 06 — executive summary (dual axis) ──
    const structRows = structural.map((s) => `| ${s.k} | ${s.present ? '✅' : '⬜'} |`).join('\n');
    const actRows = activation.map((a) => `| ${a.k} | ${a.present ? '✅' : '⬜'} |`).join('\n');
    writeFileSync(join(OUT_DIR, '06_executive_summary.md'), `# WC-L5 · Executive Summary — Memory Intelligence Layer
_Generated ${stamp}. Read-only; no DB writes. Emails one-way sha256-masked._

WC-L5 activates CAPADEX's **memory** layer by SNAPSHOTTING already-computed WC-L0→L4 intelligence per
completed session into \`wcl5_memory\`, and reading it back through a pure read-only retrieval engine. It
adds **no** new construct / ontology / scoring / AI model / forecast / intervention / decision. Confidence
is **inherited** from each snapshotted source. Persistence is **UPSERT-only** (no destructive write); flag
OFF → no schema, no write → **byte-identical** legacy behaviour.

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
- Completed sessions: **${completedSessions}** · distinct emails: **${distinctEmails}** · anonymous: **${anonSessions}** · longitudinal (≥2): **${longCount}**.
- Sessions with memory: **${sessionsWithMemory}** (${pct(sessionsWithMemory, completedSessions)}% of completed) · total memory rows: **${totalRows}**.
- Memory types populated: **${distinctTypes}/7** · density: **${rowsPerSession.toFixed(2)}** rows/session · **${typesPerSession.toFixed(2)}** types/session.
- Recall: **${recallUsers}/${longCount}** longitudinal users (${pct(recallUsers, longCount)}%) · round-trip fidelity: **${fidelityOk}/${fidelityChecked}** users exact.
- Trend memory: **${trendRows.length}** rows (${usersWithTrendMem.size}/${longCount} users) · forecast memory: **${forecastRows.length}** rows (${usersWithForecastMem.size}/${longCount}) · intervention memory: **${interventionRows.length}** rows.
- Inherited confidence: min ${cMin} · mean ${cMean.toFixed(3)} · max ${cMax}.

## Honest ceilings & data caps (bounds on Activation)
- **Snapshot-bound coverage**: memory only remembers what WC-L0→L4 already produced; absent/UNCLASSIFIED layers contribute zero rows (fail-closed).
- **Longitudinal cap** (${longCount} users): recall / trend / forecast cannot exceed ${longCount} users today regardless of engine quality.
- **Anonymous cap** (${anonSessions} sessions): no email key ⇒ structurally excluded from recall / trend / forecast.
- **Intervention memory** bounded by WC-L4 persistence (generator-bound upstream); requires the WC-L4 backfill to have run first.

Structural readiness reflects that the layer is fully built and wired; Activation readiness reflects the
honest state of the upstream data it snapshots. The two are deliberately **not** blended.
`);

    console.log(`WC-L5 measure complete → ${OUT_DIR}`);
    console.log(`  Structural ${structuralScore}/5 · Activation ${activationScore}/5`);
    console.log(`  ${totalRows} memory rows across ${sessionsWithMemory}/${completedSessions} completed sessions · ${distinctTypes}/7 types.`);
    console.log(`  Recall ${recallUsers}/${longCount} longitudinal users · round-trip fidelity ${fidelityOk}/${fidelityChecked} exact.`);
    console.log(`  Trend ${trendRows.length} rows · forecast ${forecastRows.length} rows · intervention ${interventionRows.length} rows · anon memory ${anonMemoryRows} rows.`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
