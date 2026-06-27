/**
 * MX-302A — seed/cleanup career-seeker fixtures for the live-UI E2E test.
 *
 * Creates three @example.com career_seeker users with a STORED career_stage
 * (senior-leadership, executive, mid-career) so the experience-routing nav gate
 * can be exercised through the real browser UI with FF_CAREER_LAUNCHPAD ON.
 *
 * Usage:
 *   cd backend && npx tsx audit/mx-302a/seed-ui-test-users.ts seed
 *   cd backend && npx tsx audit/mx-302a/seed-ui-test-users.ts cleanup
 *
 * Honesty: all fixtures are @example.com and removed by `cleanup`. This seeds
 * test users only — it does not measure real adoption.
 */
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { Pool } from 'pg';
import { persistCareerStage, type CareerStage } from '../../services/experience-routing';

const scryptAsync = promisify(scrypt);

async function hash(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

export const PASSWORD = 'Studio!Test#2026xZ';
const PREFIX = 'mx302a-uitest';

export const FIXTURES: { slug: string; stage: CareerStage }[] = [
  { slug: 'seniorleadership', stage: 'senior-leadership' },
  { slug: 'executive', stage: 'executive' },
  { slug: 'midcareer', stage: 'mid-career' },
];

const uname = (slug: string) => `${PREFIX}-${slug}@example.com`;

async function cleanup(pool: Pool) {
  const ids = await pool
    .query<{ id: string }>(`SELECT id FROM users WHERE username LIKE $1`, [`${PREFIX}-%@example.com`])
    .catch(() => ({ rows: [] as { id: string }[] }));
  for (const row of ids.rows) {
    await pool.query(`DELETE FROM career_seeker_profiles WHERE user_id = $1`, [row.id]).catch(() => {});
  }
  await pool.query(`DELETE FROM users WHERE username LIKE $1`, [`${PREFIX}-%@example.com`]).catch(() => {});
}

async function seed(pool: Pool) {
  await cleanup(pool);
  const hashed = await hash(PASSWORD);
  for (const f of FIXTURES) {
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO users (username, password, full_name, role, roles)
         VALUES ($1, $2, $3, 'job_seeker', ARRAY['job_seeker'])
       RETURNING id`,
      [uname(f.slug), hashed, `Test ${f.slug}`],
    );
    const uid = ins.rows[0].id;
    await persistCareerStage(pool, uid, f.stage, {});
    console.log(`seeded ${uname(f.slug)} (id=${uid}) stage=${f.stage}`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(2);
  }
  const mode = process.argv[2] ?? 'seed';
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    if (mode === 'cleanup') {
      await cleanup(pool);
      console.log('cleaned up mx302a-uitest fixtures');
    } else {
      await seed(pool);
      console.log('\nLogin credentials (all):');
      for (const f of FIXTURES) console.log(`  ${uname(f.slug)} / ${PASSWORD}  → ${f.stage}`);
    }
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error('seed crashed:', err);
  process.exit(1);
});
