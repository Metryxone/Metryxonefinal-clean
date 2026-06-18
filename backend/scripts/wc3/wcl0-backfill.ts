/**
 * WC-L0 — User Intelligence Foundation: BACKFILL (real data, idempotent).
 *
 * Runs the EXISTING persistence layer (`persistUserIntelligence`) over every completed CAPADEX
 * session so the foundation row exists for legacy sessions that completed before WC-L0. It composes
 * already-derived intelligence only (persona via the existing classifier, behaviour via the existing
 * Unified Behavior Graph, snapshot via the existing capture fn) — NO new intelligence engine, no
 * fabrication. UPSERT → safe to re-run. Explicit/manual write step (not part of any auto path).
 *
 * Usage:  cd backend && npx tsx scripts/wc3/wcl0-backfill.ts
 */

// Flag ON for THIS process only (read live by isFlagEnabled → envOverride).
process.env.FF_USER_INTELLIGENCE_FOUNDATION = '1';

import { Pool } from 'pg';
import { persistUserIntelligence } from '../../services/wc3/user-intelligence-foundation';

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query(
      `SELECT id FROM capadex_sessions WHERE status = 'completed' ORDER BY created_at ASC`,
    );
    console.log(`WC-L0 backfill over ${rows.length} completed sessions…`);
    let ok = 0, persona = 0, behaviour = 0, snapshot = 0;
    for (const r of rows) {
      const res = await persistUserIntelligence(pool, String(r.id));
      if (res) {
        ok += 1;
        if (res.persona) persona += 1;
        if (res.behaviour_dims_present > 0) behaviour += 1;
        if (res.snapshot_captured) snapshot += 1;
        console.log(
          `  ✓ ${r.id}  persona=${res.persona ?? '∅'} (${res.persona_source})  ` +
          `behaviour_dims=${res.behaviour_dims_present} (${res.behaviour_source})  snapshot=${res.snapshot_captured}`,
        );
      } else {
        console.log(`  ✗ ${r.id}  (no row / non-blocking failure)`);
      }
    }
    console.log(
      `\nDone. rows=${ok}/${rows.length}  persona=${persona}  behaviour(≥1 dim)=${behaviour}  snapshot=${snapshot}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
