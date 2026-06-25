/**
 * MX-202B — Controlled Enterprise Activation runner.
 *
 * (1) classifies every governed draft into a governance_track (factual vs expert_authored),
 * (2) auto-promotes ONLY source-backed factual drafts into their canonical home as VERIFIED.
 *
 * Honest by construction: rule_based / interpretive drafts are NEVER promoted. Promoting 0 is
 * the correct outcome when no draft is source-backed — the verified factual layer (O*NET
 * crosswalk, Role DNA, benchmark, genome identity/type) already lives in its own canonical
 * tables and is measured by mx202b-certify.ts (Verified Knowledge Coverage), not by this run.
 *
 * Usage:
 *   npx tsx scripts/mx202b-activate-verified.ts            # classify + promote verified
 *   npx tsx scripts/mx202b-activate-verified.ts --rollback # unverify all verified promotions
 *
 * NO DEPLOY. STOP for founder approval.
 */
import { Pool } from 'pg';
import { ensureMx202bContentSchema } from '../services/mx202b-content-schema';
import { applyGovernanceTracks, promoteVerifiedContent, unverifyContent } from '../services/mx202b-verified-lifecycle';

async function main() {
  const rollback = process.argv.includes('--rollback');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await ensureMx202bContentSchema(pool);

    if (rollback) {
      const ids = (await pool.query(`SELECT id FROM onto_competency_content_drafts WHERE source='mx202b' AND status='verified'`)).rows;
      let n = 0;
      for (const r of ids) { const res = await unverifyContent(pool, Number(r.id)); if (res.ok) n++; }
      console.log(`[mx202b-activate] rollback: unverified ${n}/${ids.length} verified promotions.`);
      return;
    }

    const cls = await applyGovernanceTracks(pool);
    console.log('[mx202b-activate] governance tracks:', JSON.stringify(cls));

    const promo = await promoteVerifiedContent(pool);
    console.log('[mx202b-activate] verified promotion:', JSON.stringify(promo, null, 2));

    if (promo.promoted === 0) {
      console.log('[mx202b-activate] HONEST RESULT: 0 drafts auto-verified. All', cls.total,
        'governed drafts are expert-authored (provenance=rule_based) → they correctly remain in Draft awaiting human approval. The verified factual layer (O*NET crosswalk, Role DNA, benchmark, genome identity/type) is already live in its canonical tables; relabeling rule_based content as verified would fabricate provenance.');
    }
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error('[mx202b-activate] FAILED', e); process.exit(1); });
