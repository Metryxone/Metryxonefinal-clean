/**
 * WC-L1B — Outcome & Journey State Activation: BACKFILL (real data, idempotent).
 *
 * Populates the two longitudinal levers that had no usable history — **Outcome**
 * (`wc3_outcome_state` was 0 rows) and **Journey** (`wc3_journey_state` rows were all degraded
 * fallbacks) — by replaying ONLY the Outcome + Journey halves of the existing post-completion
 * resolver chain over every completed CAPADEX session. It REUSES the existing engines verbatim —
 * no new ontology / construct / outcome model.
 *
 * SCOPE = Outcome + Journey only. **Stage is intentionally NOT re-resolved here.** Stage state was
 * already activated (and persisted) by its own prior phase; both engines read it via
 * `getSessionStage` (`input.stageState` omitted). Re-resolving stage from this job would (a) append
 * to the append-only `wc3_stage_progression` log on every run (breaking idempotency) and (b) risk
 * overwriting the canonical stage with a default when the original completion `stage_code` is not
 * threaded in. Consuming the already-persisted stage keeps this job additive, idempotent, and
 * byte-identical in effect to what the runtime hook produced.
 *
 * Empty-spine sessions reach an outcome only through the existing WC-10 Lever-1 clarity-bank
 * crosswalk (`FF_WC3_OUTCOME_CROSSWALK`, enabled for THIS process only) when the session still
 * carries a `primary_construct_key` or a mapped concern bridge tag. A session with neither stays
 * honestly UNCLASSIFIED — nothing is written (never fabricated).
 *
 * All writes are UPSERT (outcome: per session+model, actions replaced; journey: per session,
 * candidates replaced) → safe to re-run. Explicit/manual step (not part of any auto path).
 *
 * Usage:  cd backend && npx tsx scripts/wc3/wcl1b-backfill.ts
 */

// Flags ON for THIS process only (read live by isFlagEnabled → envOverride).
process.env.FF_WC3_OUTCOME = '1';
process.env.FF_WC3_JOURNEY = '1';
process.env.FF_WC3_OUTCOME_CROSSWALK = '1';

import { Pool } from 'pg';
import { resolveSessionOutcomes } from '../../services/wc3/outcome-intelligence';
import { resolveSessionJourney } from '../../services/wc3/journey-intelligence';

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows: sessions } = await pool.query(
      `SELECT id, LOWER(guest_email) AS email
         FROM capadex_sessions
        WHERE status = 'completed'
        ORDER BY created_at ASC`,
    );
    console.log(`WC-L1B backfill: resolving outcome→journey over ${sessions.length} completed sessions (stage consumed, not re-resolved)…\n`);

    let classified = 0, unclassified = 0, outcomeModelRows = 0;
    let journeyRows = 0, routed = 0, degraded = 0;

    for (const s of sessions) {
      const sessionId = String(s.id);
      const email: string | null = s.email ?? null;

      // Mirror the hook: resolve userId from the email when present (anonymous → null).
      let userId: string | null = null;
      if (email) {
        const { rows: u } = await pool.query(
          `SELECT id FROM capadex_users WHERE LOWER(email) = $1 LIMIT 1`,
          [email],
        );
        userId = u[0]?.id != null ? String(u[0].id) : null;
      }

      // No stageState passed → both engines read the already-persisted stage via getSessionStage.
      const outcomeSummary = await resolveSessionOutcomes(pool, { sessionId, userEmail: email, userId });
      const journey = await resolveSessionJourney(pool, {
        sessionId, userEmail: email, userId,
        outcomeSummary: outcomeSummary ?? undefined,
      });

      if (outcomeSummary && !outcomeSummary.unclassified) {
        classified += 1;
        outcomeModelRows += outcomeSummary.models.length;
      } else {
        unclassified += 1;
      }
      if (journey) {
        journeyRows += 1;
        if (journey.degraded) degraded += 1; else routed += 1;
      }

      const tag = (email ?? '(anonymous)').padEnd(28);
      const ocStr = !outcomeSummary
        ? 'null (non-blocking failure)'
        : outcomeSummary.unclassified
          ? `unclassified (${outcomeSummary.reason})`
          : `${outcomeSummary.models.length} model(s) [${outcomeSummary.models.map((m) => m.model_key).join(', ')}]`;
      const jStr = !journey
        ? 'null'
        : `${journey.degraded ? 'degraded' : 'routed'} → ${journey.primary_route.route_key} (conf ${journey.route_confidence})`;
      console.log(`  • ${sessionId.slice(0, 8)}  ${tag}  outcome=${ocStr}   journey=${jStr}`);
    }

    console.log(`\nDone. completed sessions=${sessions.length}`);
    console.log(`  Outcome: ${classified} classified (${outcomeModelRows} model rows written) · ${unclassified} unclassified (nothing written — honest empty state).`);
    console.log(`  Journey: ${journeyRows} persisted (${routed} non-degraded · ${degraded} degraded fallback).`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
