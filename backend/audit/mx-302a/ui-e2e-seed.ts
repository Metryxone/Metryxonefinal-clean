/**
 * MX-302A — Career Launchpad · UI E2E fixture seeder
 * ----------------------------------------------------------------------------
 * The DB harness (e2e-mx302a.ts) proves the read path (readEffectiveStage →
 * effectiveExperience) resolves a returning no-profile user to Launchpad. This
 * companion seeds the two FK-valid, loginable fixture users the rendered-UI
 * check (ui-e2e-plan.md, run via the Playwright testing subagent) logs in as,
 * to prove the SAME outcome reaches the screen — i.e. CareerBuilderPage actually
 * auto-routes to the `fresher-hub` tab (not `dashboard`) when the careerLaunchpad
 * flag is ON.
 *
 * Both fixtures deliberately have NO `career_seeker_profiles` row (the whole
 * point of the task), so their stage is null-derived (career seeker → blind
 * Launchpad default) or role-derived (student role → 'student' → Launchpad).
 *
 * Honesty: usernames are @example.com so they are purge-safe on the shared dev
 * DB; `clean` deletes everything this script creates. Passwords are scrypt-hashed
 * in the exact `hash.salt` format the passport local strategy expects so a real
 * browser login works. This seeds FIXTURES ONLY — it never seeds a profile row,
 * a stage, or any signal, so it cannot inflate the routing outcome it verifies.
 *
 * Run:  cd backend && npx tsx audit/mx-302a/ui-e2e-seed.ts seed
 *       cd backend && npx tsx audit/mx-302a/ui-e2e-seed.ts clean
 */
import { Pool } from 'pg';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Mirror backend/routes.ts crypto.hash → `${hashHex}.${salt}` (scrypt, 64 bytes).
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

const PREFIX = 'mx302a-ui';
export const FIXTURES = [
  { slug: 'career', username: `${PREFIX}-career@example.com`, role: 'career_seeker' },
  { slug: 'student', username: `${PREFIX}-student@example.com`, role: 'student' },
] as const;
// Plain password used by the browser test (also printed below for convenience).
export const FIXTURE_PASSWORD = 'Launchpad!E2E#2026';

async function clean(pool: Pool) {
  const ids = await pool
    .query<{ id: string }>(`SELECT id FROM users WHERE username LIKE $1`, [`${PREFIX}-%@example.com`])
    .catch(() => ({ rows: [] as { id: string }[] }));
  for (const row of ids.rows) {
    await pool.query(`DELETE FROM career_seeker_profiles WHERE user_id = $1`, [row.id]).catch(() => {});
  }
  await pool.query(`DELETE FROM users WHERE username LIKE $1`, [`${PREFIX}-%@example.com`]).catch(() => {});
}

async function seed(pool: Pool) {
  await clean(pool); // idempotent — re-seed from a known clean slate.
  const hashed = await hashPassword(FIXTURE_PASSWORD);
  for (const f of FIXTURES) {
    await pool.query(
      `INSERT INTO users (username, password, role, roles)
         VALUES ($1, $2, $3, ARRAY[$3]::text[])`,
      [f.username, hashed, f.role],
    );
    // Deliberately NO career_seeker_profiles row — this IS the no-profile case.
  }
}

async function main() {
  const mode = (process.argv[2] ?? 'seed').toLowerCase();
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set — cannot seed UI fixtures.');
    process.exit(2);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    if (mode === 'clean') {
      await clean(pool);
      console.log('[mx302a-ui-seed] cleaned fixtures:', FIXTURES.map((f) => f.username).join(', '));
    } else {
      await seed(pool);
      console.log('[mx302a-ui-seed] seeded fixtures (no profile rows):');
      for (const f of FIXTURES) console.log(`  ${f.role.padEnd(13)} ${f.username}  password=${FIXTURE_PASSWORD}`);
    }
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[mx302a-ui-seed] crashed:', err);
  process.exit(1);
});
