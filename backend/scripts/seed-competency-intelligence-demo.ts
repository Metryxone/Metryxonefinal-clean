/**
 * Seed — Competency Intelligence (D9 Admin) DEMO cohort  [LIVE / shared DB]
 *
 * Populates the canonical scoring ledger + forecast/velocity tables with a clearly
 * labelled, fully purgeable demo cohort so every panel on the D9 admin dashboard
 * (KPIs · Competency Scores · Top Gaps · Trend Distribution · Forecast coverage)
 * renders with realistic data for demos.
 *
 * Honesty / safety:
 *   - Every row is prefixed `demo_ci_` (subject_id / user_id / velocity id) → trivially
 *     purgeable on the shared dev/prod DB. Re-running first deletes the prior demo cohort,
 *     so the script is idempotent and never double-seeds.
 *   - Writes ONLY to onto_competency_profiles, competency_forecasts, p4_development_velocity.
 *   - It does NOT touch any real subject rows (those keep whatever ids they already have).
 *
 * Run:    cd backend && npx tsx scripts/seed-competency-intelligence-demo.ts
 * Purge:  cd backend && npx tsx scripts/seed-competency-intelligence-demo.ts --purge
 */
import pg from 'pg';

const PREFIX = 'demo_ci_';
const COHORT_SIZE = 30;

const DOMAINS = [
  { code: 'dom_cognitive',     label: 'Cognitive Capabilities',      base: 72 },
  { code: 'dom_behavioral',    label: 'Behavioral Capabilities',     base: 68 },
  { code: 'dom_interpersonal', label: 'Interpersonal & Leadership',  base: 64 },
  { code: 'dom_functional',    label: 'Functional & Execution',      base: 58 },
  { code: 'dom_strategic',     label: 'Strategic & Organizational',  base: 52 },
];

const TRENDS = ['accelerating', 'steady', 'plateau', 'decelerating'];

const ROLES = ['Product Manager', 'Software Engineer', 'Data Analyst', 'Designer', 'Operations Lead', 'Marketing Manager'];

// Deterministic pseudo-random so re-seeds are reproducible.
function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function clamp(n: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, n)); }
function levelFromScore(s: number) { return s >= 85 ? 5 : s >= 70 ? 4 : s >= 55 ? 3 : s >= 40 ? 2 : 1; }

async function main() {
  const purgeOnly = process.argv.includes('--purge');
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
  const pool = new pg.Pool({ connectionString: url });

  try {
    // Idempotent purge of the prior demo cohort.
    // profiles FK -> onto_assessment_instances(instance_id), so delete profiles BEFORE instances.
    const del1 = await pool.query(`DELETE FROM onto_competency_profiles  WHERE subject_id LIKE $1`, [PREFIX + '%']);
    const del2 = await pool.query(`DELETE FROM competency_forecasts      WHERE user_id    LIKE $1`, [PREFIX + '%']);
    const del3 = await pool.query(`DELETE FROM p4_development_velocity    WHERE id         LIKE $1`, [PREFIX + '%']);
    const del4 = await pool.query(`DELETE FROM onto_assessment_instances WHERE subject_id LIKE $1`, [PREFIX + '%']);
    console.log(`Purged prior demo cohort: profiles=${del1.rowCount} forecasts=${del2.rowCount} velocity=${del3.rowCount} instances=${del4.rowCount}`);
    if (purgeOnly) { console.log('Purge-only mode — done.'); return; }

    const rand = rng(20260622);
    let profileRows = 0, forecastRows = 0, velocityRows = 0;

    for (let i = 1; i <= COHORT_SIZE; i++) {
      const subject = `${PREFIX}${String(i).padStart(3, '0')}`;
      const role = ROLES[i % ROLES.length];
      const ability = (rand() - 0.5) * 24; // per-subject ability shift, ±12

      // Per-domain scaled scores → profile JSONB
      const profile = DOMAINS.map(d => {
        const score = Math.round(clamp(d.base + ability + (rand() - 0.5) * 16));
        return {
          label: d.label,
          level: levelFromScore(score),
          onto_domain: d.code,
          scaled_score: score,
          question_count: 3 + Math.floor(rand() * 8),
        };
      });
      const overall = Math.round(profile.reduce((s, p) => s + p.scaled_score, 0) / profile.length);

      // onto_competency_profiles.instance_id has a FK to onto_assessment_instances —
      // create a demo instance first and reference its id.
      const inst = await pool.query<{ id: string }>(
        `INSERT INTO onto_assessment_instances
           (blueprint_id, role_id, subject_id, status, total_questions, coverage, source)
         VALUES ($1, $2, $3, 'scored', $4, $5::jsonb, 'demo_seed')
         RETURNING id`,
        [
          'demo_ci_blueprint',
          role,
          subject,
          profile.reduce((s, p) => s + p.question_count, 0),
          JSON.stringify({ source: 'demo_seed', domains_measured: profile.length }),
        ],
      );
      const instanceId = inst.rows[0].id;

      await pool.query(
        `INSERT INTO onto_competency_profiles
           (subject_id, instance_id, blueprint_id, role_id, overall_score, overall_level, profile, coverage, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, now() - ($9 || ' days')::interval)`,
        [
          subject,
          instanceId,
          'demo_ci_blueprint',
          role,
          overall,
          levelFromScore(overall),
          JSON.stringify(profile),
          JSON.stringify({ source: 'demo_seed', domains_measured: profile.length }),
          String(Math.floor(rand() * 40)),
        ],
      );
      profileRows++;

      // Forecasts — a couple of horizons across the two lowest domains
      const ranked = [...profile].sort((a, b) => a.scaled_score - b.scaled_score);
      for (const d of ranked.slice(0, 2)) {
        for (const horizon of [3, 6]) {
          const predicted = clamp(levelFromScore(d.scaled_score) + (horizon === 6 ? 1 : 0.5), 1, 5);
          await pool.query(
            `INSERT INTO competency_forecasts
               (user_id, competency_key, horizon_months, predicted_level, confidence, method, inputs, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())`,
            [
              subject,
              d.onto_domain,
              horizon,
              Number(predicted.toFixed(1)),
              Number((0.55 + rand() * 0.35).toFixed(2)),
              'demo_seed',
              JSON.stringify({ from_level: d.level, from_score: d.scaled_score }),
            ],
          );
          forecastRows++;
        }
      }

      // Velocity — one snapshot per domain with a varied trend
      for (let di = 0; di < profile.length; di++) {
        const d = profile[di];
        const trend = TRENDS[(i + di) % TRENDS.length];
        const delta = trend === 'accelerating' ? 8 + rand() * 6
          : trend === 'steady' ? 2 + rand() * 3
          : trend === 'plateau' ? (rand() - 0.5) * 2
          : -(3 + rand() * 5);
        const end = clamp(d.scaled_score);
        const start = clamp(end - delta);
        await pool.query(
          `INSERT INTO p4_development_velocity
             (id, user_id, competency_id, period_start, period_end, start_score, end_score,
              delta_score, velocity_pts_per_30d, trend, momentum_score, consistency, sample_count, computed_at)
           VALUES ($1, $2, $3, now()::date - 60, now()::date, $4, $5, $6, $7, $8, $9, $10, $11, now())`,
          [
            `${PREFIX}${String(i).padStart(3, '0')}_${d.onto_domain}`,
            subject,
            d.onto_domain,
            Number(start.toFixed(1)),
            Number(end.toFixed(1)),
            Number(delta.toFixed(1)),
            Number((delta / 2).toFixed(1)),
            trend,
            Number((0.4 + rand() * 0.5).toFixed(2)),
            Number((0.5 + rand() * 0.4).toFixed(2)),
            2 + Math.floor(rand() * 3),
          ],
        );
        velocityRows++;
      }
    }

    console.log(`Seeded demo cohort (${COHORT_SIZE} subjects): profiles=${profileRows} forecasts=${forecastRows} velocity=${velocityRows}`);
    console.log(`All rows labelled '${PREFIX}*' — purge with: npx tsx scripts/seed-competency-intelligence-demo.ts --purge`);
  } finally {
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
