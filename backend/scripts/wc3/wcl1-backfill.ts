/**
 * WC-L1 — Trend Intelligence: BACKFILL (real data, idempotent).
 *
 * Runs the EXISTING trend persistence (`persistUserTrends`) over every user with ≥2 completed
 * CAPADEX sessions, so the four lever trends (Stage/Outcome/Journey/Decision) exist for users who
 * returned before WC-L1. It REUSES the existing longitudinal trend math over already-persisted state
 * — NO new intelligence engine, no fabrication (a lever with <2 readable points gets no trend row).
 * UPSERT → safe to re-run. Explicit/manual write step (not part of any auto path).
 *
 * Usage:  cd backend && npx tsx scripts/wc3/wcl1-backfill.ts
 */

// Flag ON for THIS process only (read live by isFlagEnabled → envOverride).
process.env.FF_TREND_INTELLIGENCE = '1';

import { Pool } from 'pg';
import { persistUserTrends } from '../../services/wc3/trend-intelligence';

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query(
      `SELECT LOWER(guest_email) AS email, COUNT(*) AS c
         FROM capadex_sessions
        WHERE status = 'completed' AND guest_email IS NOT NULL
        GROUP BY LOWER(guest_email)
       HAVING COUNT(*) >= 2
        ORDER BY COUNT(*) DESC`,
    );
    console.log(`WC-L1 backfill over ${rows.length} trend-eligible users (≥2 completed sessions)…`);
    let users = 0, trendRows = 0;
    for (const r of rows) {
      const res = await persistUserTrends(pool, String(r.email));
      if (res) {
        users += 1;
        trendRows += res.trends.length;
        const summary = res.trends.length
          ? res.trends.map((t) => `${t.lever}=${t.direction}(n=${t.points},conf=${t.confidence})`).join('  ')
          : `(no lever had ≥2 readable points — ${res.note ?? ''})`;
        console.log(`  ✓ ${r.email}  sessions=${res.sessions}  ${summary}`);
      } else {
        console.log(`  ✗ ${r.email}  (non-blocking failure)`);
      }
    }
    console.log(`\nDone. users=${users}/${rows.length}  trend rows written=${trendRows}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
