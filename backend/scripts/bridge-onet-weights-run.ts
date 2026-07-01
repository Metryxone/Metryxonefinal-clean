/**
 * O*NET → Role-DNA estimated-weight bridge — runner.
 *
 * Thin CLI wrapper over services/onet-onto-weight-bridge.ts. Rebuilds the
 * `source = 'onet_derived'` rows in onto_role_weights from the already-imported
 * O*NET library so the user-facing "Estimated / inherited" honesty badge lights
 * up on genuinely estimated competencies (and only those). Idempotent + additive
 * (curated weights are never touched); this is the SAME function the boot seeder
 * (index.ts) and the admin endpoint (POST /api/ontology/overview/bridge-onet-weights)
 * call, so there is no drift.
 *
 * Usage:
 *   cd backend && npx tsx scripts/bridge-onet-weights-run.ts
 *   cd backend && npx tsx scripts/bridge-onet-weights-run.ts --twice   (idempotency check)
 */
import { Pool } from 'pg';
import { bridgeOnetDerivedWeights } from '../services/onet-onto-weight-bridge';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

async function derivedCount(pool: Pool): Promise<number> {
  const r = await pool.query<{ n: string }>(
    `SELECT count(*) AS n FROM onto_role_weights WHERE source = 'onet_derived'`,
  );
  return Number(r.rows[0]?.n ?? 0);
}

async function main() {
  const twice = process.argv.includes('--twice');
  const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
  try {
    const before = await derivedCount(pool);
    console.log(`derived rows before: ${before}`);

    const r1 = await bridgeOnetDerivedWeights(pool);
    console.log('run #1:', JSON.stringify(r1, null, 2));
    const after1 = await derivedCount(pool);
    console.log(`derived rows after run #1: ${after1}`);
    if (!r1.ok) process.exit(1);

    if (twice) {
      const r2 = await bridgeOnetDerivedWeights(pool);
      const after2 = await derivedCount(pool);
      console.log(`run #2 linksBridged: ${r2.linksBridged}, derived rows after run #2: ${after2}`);
      console.log(`idempotent: ${after1 === after2 && r1.linksBridged === r2.linksBridged}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
