/**
 * MX-302A — Career Launchpad & Experience Routing · end-to-end DB harness
 * ----------------------------------------------------------------------------
 * The pure harness (validate-mx302a.ts) proves the deterministic routing engine
 * in isolation. This complements it with the missing axis: a REAL pre-existing
 * `career_seeker_profiles` row (no stored `career_stage`) loaded through the
 * live read path (`readEffectiveStage` → `effectiveExperience`) with the
 * `careerLaunchpad` flag ON — exactly what a returning user hits on day one of
 * launch — asserting each resolves to a DEFINED experience and never throws.
 *
 * Why this matters: existing seekers have no `career_stage`, so the experience
 * is DERIVED from profile signals (currentRole / yearsExperience / work-history).
 * A wrong or crashing derivation would silently drop returning users into the
 * wrong product. The pure test cannot catch a DB-shape regression (JSONB path,
 * lazy ensure-schema, null handling) — this does.
 *
 * Honesty: this seeds @example.com fixture users (FK to `users`) and DELETEs
 * every row it creates before AND after, so it never pollutes real data and is
 * safe to re-run against the shared dev DB. It measures the DERIVED read path,
 * not live adoption (how many real users picked a stage) — a separate axis.
 *
 * Run: cd backend && npx tsx audit/mx-302a/e2e-mx302a.ts
 * Writes: backend/audit/mx-302a/e2e-results.json
 */

// Flag ON for THIS process only (env override wins in isFlagEnabled).
process.env.FF_CAREER_LAUNCHPAD = process.env.FF_CAREER_LAUNCHPAD ?? '1';

import { writeFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import {
  readEffectiveStage,
  effectiveExperience,
  EXPERIENCES,
  isExperienceId,
  type CareerStage,
  type ExperienceId,
} from '../../services/experience-routing';
import { isCareerLaunchpadEnabled } from '../../config/feature-flags';

interface Check { id: string; name: string; pass: boolean; detail: string; }
const checks: Check[] = [];
const add = (id: string, name: string, pass: boolean, detail: string) =>
  checks.push({ id, name, pass, detail });

const PREFIX = 'mx302a-e2e';
const uname = (slug: string) => `${PREFIX}-${slug}@example.com`;

/**
 * Representative existing profiles. NONE carries a stored career_stage — the
 * stage must be DERIVED from these JSONB signals through the live read path.
 * `expectStage` is the stage the deriver should land on (null = nothing
 * derivable → effective experience defaults to Command Center, no regression).
 * `expectExperience` is the experience the user should ultimately see.
 */
interface Fixture {
  slug: string;
  /** Value written to career_seeker_profiles.data (JSONB). */
  data: Record<string, unknown>;
  expectStage: CareerStage | null;
  expectExperience: ExperienceId;
}

const FIXTURES: Fixture[] = [
  {
    slug: 'exec-by-title',
    data: { careerProfile: { currentRole: 'VP of Engineering' } },
    expectStage: 'executive',
    expectExperience: 'executive-studio',
  },
  {
    slug: 'senior-by-title',
    data: { careerProfile: { currentRole: 'Senior Software Engineer' } },
    expectStage: 'senior-leadership',
    expectExperience: 'leadership-studio',
  },
  {
    slug: 'midcareer-by-years',
    data: { careerProfile: { yearsExperience: 5 } },
    expectStage: 'mid-career',
    expectExperience: 'command-center',
  },
  {
    slug: 'early-by-years',
    data: { careerProfile: { yearsExperience: 2 } },
    expectStage: 'early-career',
    expectExperience: 'launchpad',
  },
  {
    slug: 'graduate-by-zero-years',
    data: { careerProfile: { yearsExperience: 0 } },
    expectStage: 'graduate',
    expectExperience: 'launchpad',
  },
  {
    slug: 'senior-by-experience-title',
    // No currentRole / years: deriver falls back to latest work-history title.
    data: { experience: [{ title: 'Head of Product' }] },
    expectStage: 'senior-leadership',
    expectExperience: 'leadership-studio',
  },
  {
    slug: 'midcareer-by-has-experience',
    // Has work history but no title text & no years → coarse "has experience".
    data: { experience: [{ company: 'Acme' }] },
    expectStage: 'mid-career',
    expectExperience: 'command-center',
  },
  {
    slug: 'empty-profile-present-row',
    // An EXISTING row with an empty careerProfile and no work history. The read
    // path sets hasExperience=false (a row exists, experience[] is empty), so the
    // deriver returns 'graduate' — NOT null. A true null derivation only happens
    // when there is no profile row at all (covered by E2). This documents the
    // real day-one behaviour for a returning user who never filled in a profile.
    data: { careerProfile: {} },
    expectStage: 'graduate',
    expectExperience: 'launchpad',
  },
];

async function cleanup(pool: Pool) {
  // career_seeker_profiles cascades from users(id); delete both, defensively.
  const ids = await pool
    .query<{ id: string }>(`SELECT id FROM users WHERE username LIKE $1`, [`${PREFIX}-%@example.com`])
    .catch(() => ({ rows: [] as { id: string }[] }));
  for (const row of ids.rows) {
    await pool.query(`DELETE FROM career_seeker_profiles WHERE user_id = $1`, [row.id]).catch(() => {});
  }
  await pool.query(`DELETE FROM users WHERE username LIKE $1`, [`${PREFIX}-%@example.com`]).catch(() => {});
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set — cannot run the E2E harness.');
    process.exit(2);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Gate guard: the whole point is to exercise the flag-ON path.
  add('E0', 'careerLaunchpad flag is ON for this process', isCareerLaunchpadEnabled(),
    `isCareerLaunchpadEnabled()=${isCareerLaunchpadEnabled()} (FF_CAREER_LAUNCHPAD=${process.env.FF_CAREER_LAUNCHPAD})`);

  try {
    await cleanup(pool); // pre-clean any leftovers from an aborted run.

    // Seed FK-valid users + their existing profiles (NO career_stage column set).
    const userIds = new Map<string, string>();
    for (const f of FIXTURES) {
      const ins = await pool.query<{ id: string }>(
        `INSERT INTO users (username, password, role, roles) VALUES ($1, 'x', 'career_seeker', ARRAY['career_seeker'])
         RETURNING id`,
        [uname(f.slug)],
      );
      const uid = ins.rows[0].id;
      userIds.set(f.slug, uid);
      await pool.query(
        `INSERT INTO career_seeker_profiles (user_id, data, completeness) VALUES ($1, $2::jsonb, 0)`,
        [uid, JSON.stringify(f.data)],
      );
    }

    // E1 — every representative profile resolves to a DEFINED experience, no throw.
    {
      const rows: string[] = [];
      let ok = true;
      for (const f of FIXTURES) {
        const uid = userIds.get(f.slug)!;
        let line = `${f.slug}`;
        try {
          const eff = await readEffectiveStage(pool, uid);
          const experience = effectiveExperience(eff.stage, eff.preferred);
          const definedExp = isExperienceId(experience.id) && !!EXPERIENCES[experience.id];
          const stageGood = eff.stage === f.expectStage;
          const expGood = experience.id === f.expectExperience;
          // Existing users never have a stored stage → must be derived/null, never "stored".
          const notStored = eff.stored === false;
          const good = definedExp && stageGood && expGood && notStored;
          ok = ok && good;
          line += ` → stage=${eff.stage} (stored=${eff.stored}, derived=${eff.derived}) → exp=${experience.id}${good ? '' : ` ✗ (want stage=${f.expectStage}, exp=${f.expectExperience})`}`;
        } catch (err: any) {
          ok = false;
          line += ` → THREW: ${err?.message ?? err} ✗`;
        }
        rows.push(line);
      }
      add('E1', 'existing profiles resolve to a defined experience (flag ON, no throw)', ok, rows.join(' · '));
    }

    // E2 — the genuine null-derivation case: a returning user with NO profile
    // row at all and a non-student platform role. There is no signal to derive a
    // stage (stage stays null — we never fabricate one), but the PRODUCT DECISION
    // (2026-06-27) routes the unknown-stage default to **Career Launchpad**, the
    // no-presumption entry surface — NOT Command Center. This is exactly what a
    // returning user who registered but never built a profile hits on day one.
    {
      const ins = await pool.query<{ id: string }>(
        `INSERT INTO users (username, password, role, roles) VALUES ($1, 'x', 'career_seeker', ARRAY['career_seeker'])
         RETURNING id`,
        [uname('no-profile-row')],
      );
      const uid = ins.rows[0].id;
      let ok = false;
      let detail = '';
      try {
        const eff = await readEffectiveStage(pool, uid);
        const experience = effectiveExperience(eff.stage, eff.preferred);
        ok = eff.stage === null && eff.stored === false && eff.derived === false &&
          experience.id === 'launchpad';
        detail = `no-row → stage=${eff.stage} stored=${eff.stored} derived=${eff.derived} → exp=${experience.id} (want null → launchpad, NOT command-center)`;
      } catch (err: any) {
        detail = `THREW: ${err?.message ?? err}`;
      }
      add('E2', 'no-profile-row returning user defaults to Career Launchpad (not Command Center), no throw', ok, detail);
    }

    // E3 — the wired additional signal: a returning user with NO profile row but
    // a `student` platform ROLE. The read path joins `users` and feeds the role
    // into the deriver, so the stage is DERIVED to 'student' (derived=true, not a
    // blind default) → Launchpad. This proves the role signal is doing real work
    // and distinguishes a known-junior user from the signal-less E2 case.
    {
      const ins = await pool.query<{ id: string }>(
        `INSERT INTO users (username, password, role, roles) VALUES ($1, 'x', 'student', ARRAY['student'])
         RETURNING id`,
        [uname('no-profile-student-role')],
      );
      const uid = ins.rows[0].id;
      let ok = false;
      let detail = '';
      try {
        const eff = await readEffectiveStage(pool, uid);
        const experience = effectiveExperience(eff.stage, eff.preferred);
        ok = eff.stage === 'student' && eff.stored === false && eff.derived === true &&
          experience.id === 'launchpad';
        detail = `no-row+student-role → stage=${eff.stage} stored=${eff.stored} derived=${eff.derived} → exp=${experience.id} (want student → launchpad via role signal)`;
      } catch (err: any) {
        detail = `THREW: ${err?.message ?? err}`;
      }
      add('E3', 'student platform role derives a real stage with no profile row (role signal wired)', ok, detail);
    }
  } finally {
    await cleanup(pool).catch((err) =>
      console.warn('[mx302a-e2e] cleanup failed — fixture users may remain:', err?.message ?? err));
    await pool.end().catch(() => {});
  }

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  const verdict = passed === total ? 'PASS' : 'FAIL';

  const result = {
    task: 'MX-302A — Career Launchpad & Experience Routing · E2E (flag ON, live DB)',
    generatedAt: new Date().toISOString(),
    verdict,
    passed,
    total,
    checks,
  };

  const outPath = join(__dirname, 'e2e-results.json');
  writeFileSync(outPath, JSON.stringify(result, null, 2));

  console.log(`\nMX-302A E2E — ${verdict} (${passed}/${total})\n`);
  for (const c of checks) {
    console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.id} — ${c.name}`);
    console.log(`         ${c.detail}`);
  }
  console.log(`\nWrote ${outPath}\n`);

  if (verdict !== 'PASS') process.exit(1);
}

main().catch((err) => {
  console.error('MX-302A E2E harness crashed:', err);
  process.exit(1);
});
