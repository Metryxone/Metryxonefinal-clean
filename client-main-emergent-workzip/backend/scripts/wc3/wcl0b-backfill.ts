/**
 * WC-L0B — Behaviour Signal Expansion & Longitudinal Behaviour Intelligence: BACKFILL
 * (real data, idempotent).
 *
 * Two strictly-additive steps over the EXISTING completed-session base — no new ontology / construct
 * / dimension / scoring / AI model:
 *
 *   Step A — Behaviour PERSISTENCE (re-run, idempotent). Replays the EXISTING WC-L0 User Intelligence
 *            Foundation persist (`persistUserIntelligence`) for every completed session, so each one
 *            carries its already-PROJECTED behaviour dimensions (motivation / confidence / risk /
 *            engagement / adaptability + the categorical learning_style) in `wcl0_user_intelligence`.
 *            UPSERT per session → safe to re-run. A dimension stays NULL when the Unified Behavior
 *            Graph never spoke to it — behaviour is NEVER fabricated from score.
 *
 *   Step B — Behaviour TREND (longitudinal). For every user with ≥2 completed sessions, computes and
 *            UPSERTs the per-dimension trend (Improving / Stable / Declining) into the EXISTING
 *            `wc3_longitudinal_trends` table (metric `behaviour_<dim>`), REUSING the WC-L1 trend math.
 *            A dimension with <2 readable points for that user produces NO row (never fabricated).
 *
 * Both steps are UPSERT → safe to re-run. Flags ON for THIS process only. Explicit/manual step
 * (not part of any auto path). NEVER mutates the append-only stage history or any session vector.
 *
 * Usage:  cd backend && npx tsx scripts/wc3/wcl0b-backfill.ts
 */

// Flags ON for THIS process only (read live by isFlagEnabled → envOverride).
process.env.FF_USER_INTELLIGENCE_FOUNDATION = '1';
process.env.FF_BEHAVIOUR_TREND_INTELLIGENCE = '1';

import { Pool } from 'pg';
import { persistUserIntelligence } from '../../services/wc3/user-intelligence-foundation';
import { persistUserBehaviourTrends, BEHAVIOUR_NUMERIC_DIMS } from '../../services/wc3/behaviour-trend-intelligence';

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // ── Step A — behaviour persistence (idempotent) over every completed session ──
    const { rows: sessions } = await pool.query(
      `SELECT id, LOWER(guest_email) AS email
         FROM capadex_sessions
        WHERE status = 'completed'
        ORDER BY created_at ASC`,
    );
    console.log(`WC-L0B backfill — Step A: persisting behaviour foundation over ${sessions.length} completed sessions…\n`);

    let withBehaviour = 0, absent = 0, totalDims = 0;
    for (const s of sessions) {
      const sessionId = String(s.id);
      const row = await persistUserIntelligence(pool, sessionId);
      const dims = row?.behaviour_dims_present ?? 0;
      if (row && row.behaviour_source !== 'absent') withBehaviour += 1; else absent += 1;
      totalDims += dims;
      const tag = (s.email ?? '(anonymous)').padEnd(28);
      console.log(`  • ${sessionId.slice(0, 8)}  ${tag}  behaviour=${row?.behaviour_source ?? 'null'} (dims ${dims})`);
    }
    console.log(`\n  Step A done. ${withBehaviour}/${sessions.length} sessions carry ≥1 behaviour dimension · ${absent} absent (honest empty state) · ${totalDims} dimension values total.`);

    // ── Step B — behaviour trends for every user with ≥2 completed sessions ──
    const { rows: users } = await pool.query(
      `SELECT LOWER(guest_email) AS email, COUNT(*) AS completed
         FROM capadex_sessions
        WHERE status = 'completed' AND guest_email IS NOT NULL
        GROUP BY LOWER(guest_email)
        HAVING COUNT(*) >= 2
        ORDER BY COUNT(*) DESC, LOWER(guest_email)`,
    );
    console.log(`\nWC-L0B backfill — Step B: computing behaviour trends for ${users.length} user(s) with ≥2 completed sessions…\n`);

    let trendRows = 0, usersWithTrend = 0;
    for (const u of users) {
      const email = String(u.email);
      const res = await persistUserBehaviourTrends(pool, email);
      const n = res?.trends.length ?? 0;
      trendRows += n;
      if (n > 0) usersWithTrend += 1;
      const dimStr = n === 0
        ? `no trend (${res?.note ?? 'null'})`
        : res!.trends.map((t) => `${t.dim} ${t.direction}(${t.points}pts,conf ${t.confidence})`).join(', ');
      console.log(`  • ${email.padEnd(28)} completed=${u.completed}  → ${dimStr}`);
    }

    console.log(`\nDone. Behaviour-trend rows written: ${trendRows} across ${usersWithTrend}/${users.length} eligible users (dims tracked: ${BEHAVIOUR_NUMERIC_DIMS.join(', ')}).`);
    console.log('learning_style is categorical → reported in measurement, never numerically trended.');
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
