/**
 * WC-L1A · R1 — Verify the live WC-3 completion hook (self-cleaning probe).
 *
 * Disambiguates the audit's open question: are wc3_*_state empty because the hook NEVER FIRED since the
 * flags went live, or because it FIRES BUT WRITES NOTHING? This drives a synthetic completed session
 * through the EXACT flag-gated WC-3 block from postCompletionHooks (stage → longitudinal → outcome →
 * journey), under the SAME flags the Backend API workflow sets, then checks which state rows appeared.
 *
 * Scope (honest): it replicates the WC-3 block (not the full post-completion pipeline) so the blast
 * radius stays inside wc3_* tables and can be fully cleaned up. It proves (a) the flags read ON at
 * runtime and (b) the resolvers write through the gated path. That the HTTP completion endpoint invokes
 * this block is established by code inspection (capadex-enterprise.ts), not exercised here.
 *
 * NON-DESTRUCTIVE: inserts ONE throwaway session + its wc3 rows, then DELETES all of them in `finally`.
 * No flag/config changes (env set in-process only, mirroring the workflow). No source data touched.
 *
 * Usage:  cd backend && npx tsx scripts/wc3/wcl1a-r1-verify-hook.ts
 */

// Mirror the Backend API workflow flags for THIS process only (read live by isFlagEnabled).
process.env.FF_WC3_STAGE = '1';
process.env.FF_WC3_LONGITUDINAL = '1';
process.env.FF_WC3_OUTCOME = '1';
process.env.FF_WC3_JOURNEY = '1';

import { Pool } from 'pg';
import { randomUUID } from 'crypto';

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sessionId = randomUUID();
  const email = `wcl1a-r1-probe+${Date.now()}@test.local`;
  const concernName = 'Career Anxiety';
  const stageCode = 'CAP_CUR';
  const score = 60;
  const scoreLevel = 'Developing';

  const tableHas = async (sid: string, table: string): Promise<number> => {
    try { return (await pool.query(`SELECT count(*)::int n FROM ${table} WHERE session_id = $1`, [sid])).rows[0].n; }
    catch { return -1; }
  };

  try {
    const { isWc3StageEnabled, isWc3LongitudinalEnabled, isWc3OutcomeEnabled, isWc3JourneyEnabled } = await import('../../config/feature-flags');
    console.log('Live flag state (this process, mirroring workflow):');
    console.log(`  stage=${isWc3StageEnabled()} longitudinal=${isWc3LongitudinalEnabled()} outcome=${isWc3OutcomeEnabled()} journey=${isWc3JourneyEnabled()}`);

    // 1) Insert a throwaway completed session (so any read-through has a real row).
    await pool.query(
      `INSERT INTO capadex_sessions (id, concern_name, user_age, age_band, stage_code, status)
       VALUES ($1,$2,$3,$4,$5,'completed')`,
      [sessionId, concernName, 25, '25-34', stageCode],
    );
    console.log(`\nProbe session ${sessionId.slice(0, 8)}… inserted (status=completed).`);

    // 2) Replicate the EXACT WC-3 gated block from postCompletionHooks (capadex-enterprise.ts §14).
    const lowerEmail = email.toLowerCase().trim();
    const userId: string | null = null;
    let stageState: any = null;
    if (isWc3StageEnabled()) {
      const { resolveSessionStage } = await import('../../services/wc3/stage-intelligence');
      stageState = await resolveSessionStage(pool, { sessionId, userEmail: lowerEmail, userId, concernName, stageCode, score, scoreLevel });
    }
    if (isWc3LongitudinalEnabled()) {
      const { captureLongitudinalSnapshot } = await import('../../services/wc3/longitudinal-foundation');
      const { canonicalStageFor } = await import('../../services/wc3/stage-intelligence');
      await captureLongitudinalSnapshot(pool, {
        sessionId, userEmail: lowerEmail, userId, concernName, stageCode,
        canonicalStage: stageState?.canonical_stage ?? canonicalStageFor(stageCode),
        score, scoreLevel, csiScore: stageState?.csi_score ?? null, csiStage: stageState?.csi_stage ?? null,
      });
    }
    let outcomeSummary: any = null;
    if (isWc3OutcomeEnabled()) {
      const { resolveSessionOutcomes } = await import('../../services/wc3/outcome-intelligence');
      outcomeSummary = await resolveSessionOutcomes(pool, { sessionId, userEmail: lowerEmail, userId, stageState });
    }
    if (isWc3JourneyEnabled()) {
      const { resolveSessionJourney } = await import('../../services/wc3/journey-intelligence');
      await resolveSessionJourney(pool, { sessionId, userEmail: lowerEmail, userId, stageState, outcomeSummary });
    }

    // 3) Verify which state rows were written for the probe.
    const stage = await tableHas(sessionId, 'wc3_stage_state');
    const snap = await tableHas(sessionId, 'wc3_longitudinal_snapshots');
    const outcome = await tableHas(sessionId, 'wc3_outcome_state');
    const journey = await tableHas(sessionId, 'wc3_journey_state');

    console.log('\n── Verdict ─────────────────────────────────────────────');
    console.log(`  wc3_stage_state          : ${stage > 0 ? `✅ ${stage} row` : '❌ none'}`);
    console.log(`  wc3_longitudinal_snapshots: ${snap > 0 ? `✅ ${snap} row` : '❌ none'}`);
    console.log(`  wc3_outcome_state         : ${outcome > 0 ? `✅ ${outcome} row` : '⚪ none (expected — empty behavioural spine → honest UNCLASSIFIED)'}`);
    console.log(`  wc3_journey_state         : ${journey > 0 ? `✅ ${journey} row (degraded fallback expected)` : '❌ none'}`);
    const hookWrites = stage > 0 && journey > 0;
    console.log('\n  CONCLUSION: ' + (hookWrites
      ? 'The WC-3 block WRITES under live flags ⇒ a defective WC-3 writer is RULED OUT. The production\n              0-row state is consistent with EITHER no qualifying completion since the flags went live, OR the\n              hook aborting upstream (before §14) on a swallowed exception. This probe replicates the WC-3\n              block (not the full HTTP completion path), so it cannot adjudicate between those two.'
      : 'The WC-3 block did NOT write stage+journey even under live flags — investigate a real defect.'));
    console.log('  (Outcome correctly stays empty — no constructs to classify; never fabricated.)');
  } finally {
    // 4) Full cleanup — leave NO probe data behind (order respects FKs).
    for (const sql of [
      `DELETE FROM wc3_journey_candidates WHERE session_id = $1`,
      `DELETE FROM wc3_journey_state WHERE session_id = $1`,
      `DELETE FROM wc3_outcome_actions WHERE session_id = $1`,
      `DELETE FROM wc3_outcome_state WHERE session_id = $1`,
      `DELETE FROM wc3_longitudinal_snapshots WHERE session_id = $1`,
      `DELETE FROM wc3_stage_progression WHERE session_id = $1`,
      `DELETE FROM wc3_stage_state WHERE session_id = $1`,
      `DELETE FROM capadex_sessions WHERE id = $1`,
    ]) {
      try { await pool.query(sql, [sessionId]); } catch (e) { /* table may not exist; ignore */ }
    }
    console.log(`\nCleanup complete — probe session ${sessionId.slice(0, 8)}… and all its wc3 rows removed.`);
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
