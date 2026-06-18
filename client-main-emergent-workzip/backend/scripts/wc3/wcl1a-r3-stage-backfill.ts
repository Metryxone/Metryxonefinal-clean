/**
 * WC-L1A · R3 — Stage state backfill (idempotent, coverage parity with snapshots).
 *
 * Populates `wc3_stage_state` for completed sessions by re-running the EXISTING `resolveSessionStage`
 * over the fields already persisted in `wc3_longitudinal_snapshots` (concern/stage/score/level). This
 * is pure coverage parity — snapshots already prove the stage is derivable; this writes the matching
 * stage-state row the live hook never produced for pre-flag sessions. NO new engine/construct/ontology.
 *
 * Idempotency: `wc3_stage_state` is UPSERT, but `wc3_stage_progression` is append-only — so a session
 * that ALREADY has a stage-state row is SKIPPED (re-running never duplicates progression entries).
 *
 * Usage:  cd backend && npx tsx scripts/wc3/wcl1a-r3-stage-backfill.ts
 */

process.env.FF_WC3_STAGE = '1'; // mirror workflow flag for this process

import { Pool } from 'pg';
import { resolveSessionStage } from '../../services/wc3/stage-intelligence';

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // One row per session — latest snapshot wins (snapshots are the persisted completion record).
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (s.session_id)
             s.session_id::text AS session_id, s.user_email, s.concern_name, s.stage_code,
             s.score, s.score_level
        FROM wc3_longitudinal_snapshots s
        JOIN capadex_sessions c ON c.id::text = s.session_id::text AND c.status = 'completed'
       ORDER BY s.session_id, s.captured_at DESC`);
    console.log(`WC-L1A R3 stage backfill over ${rows.length} completed sessions that have a snapshot…`);

    let written = 0, skipped = 0, failed = 0;
    for (const r of rows) {
      const existing = (await pool.query(`SELECT 1 FROM wc3_stage_state WHERE session_id = $1`, [r.session_id])).rowCount ?? 0;
      if (existing > 0) { skipped += 1; continue; }
      const res = await resolveSessionStage(pool, {
        sessionId: r.session_id,
        userEmail: r.user_email ?? null,
        userId: null,
        concernName: r.concern_name ?? null,
        stageCode: r.stage_code ?? null,
        score: r.score != null ? Number(r.score) : null,
        scoreLevel: r.score_level ?? null,
      });
      if (res?.persisted) { written += 1; console.log(`  ✓ ${r.session_id.slice(0, 8)}…  ${res.canonical_stage} (conf ${res.confidence})`); }
      else { failed += 1; console.log(`  ✗ ${r.session_id.slice(0, 8)}…  (non-blocking failure)`); }
    }
    const total = (await pool.query(`SELECT count(*)::int n FROM wc3_stage_state`)).rows[0].n;
    console.log(`\nDone. written=${written} skipped(existing)=${skipped} failed=${failed}. wc3_stage_state total rows=${total}.`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
