/**
 * PHASE 4.9 smoke — Career Passport Foundation (engine-level, no HTTP/auth).
 *
 * Verifies the honesty + safety contract directly against the live dev DB:
 *   1. never-throws on a non-existent subject; not measurable; all SIX passport
 *      components present in the shape, each honestly absent (present:false), no
 *      fabricated competency/EI/readiness/achievement/journey data.
 *   2. Coverage vs Confidence are SEPARATE axes on every section; an absent
 *      component has confidence band 'None' (never a fabricated band/score).
 *   3. Career Profile NEVER surfaces contact fields (email/phone/address) — the
 *      summary whitelist is non-PII only.
 *   4. GET-never-writes: generate (read path) creates NO schema (DDL) — neither
 *      this phase's own snapshot table NOR any transitively-composed
 *      competency-runtime relation.
 *   5. history: to_regclass probe => exists:false before any snapshot for THIS
 *      subject; the POST-path persist appends ONE append-only row; list returns
 *      it. (cleans up.)
 */
import { Pool } from 'pg';
import {
  generateCareerPassport,
  persistPassportSnapshot,
  listPassportHistory,
} from '../services/passport-generator.js';
import { COMPETENCY_RUNTIME_RELATIONS } from '../services/career-gap-engine.js';
import { buildPassportProfile } from '../services/passport-profile.js';
import type { PassportSectionKey } from '../services/passport-profile.js';

const SMOKE_SUBJECT = 'smoke-cpf-nonexistent-subject';
const SECTION_KEYS: PassportSectionKey[] = [
  'competency_profile',
  'ei_profile',
  'career_profile',
  'career_readiness',
  'achievements',
  'career_journey',
];

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
  console.log('  ✓ ' + msg);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const pool = new Pool({ connectionString: url });
  let failed = false;
  try {
    console.log('\n[1] non-existent subject — honest absence, no fabrication');
    const p = await generateCareerPassport(pool, SMOKE_SUBJECT);
    assert(p.ok === true, 'envelope ok');
    assert(p.subject_id === SMOKE_SUBJECT, 'subject echoed');
    assert(p.measurable === false, 'not measurable (no sources for subject)');
    assert(p.coverage.sections_total === 6, 'exactly six passport components');
    assert(
      SECTION_KEYS.every((k) => p.sections[k] && p.sections[k].key === k),
      'all six components present in the shape with correct keys',
    );
    assert(
      SECTION_KEYS.every((k) => p.sections[k].present === false),
      'every component honestly absent (present:false) for a non-existent subject',
    );
    assert(p.coverage.sections_present === 0, 'zero present sections');
    assert(p.coverage.coverage_pct === 0, 'coverage_pct 0 for empty subject');

    console.log('\n[2] Coverage vs Confidence are SEPARATE axes; absent => band None');
    assert(
      SECTION_KEYS.every((k) => {
        const s = p.sections[k];
        return (
          typeof s.axes.coverage.present === 'boolean' &&
          typeof s.axes.confidence.band === 'string' &&
          Array.isArray(s.axes.confidence.caps)
        );
      }),
      'each section exposes coverage{present} and confidence{band,caps} independently',
    );
    assert(
      SECTION_KEYS.every((k) => p.sections[k].axes.confidence.band === 'None'),
      'absent component => confidence band None (no fabricated band)',
    );
    assert(p.sections.competency_profile.data === null, 'absent competency => null data (no fabricated levels)');
    assert(p.sections.career_readiness.data === null, 'absent readiness => null data (no fabricated scores)');
    assert(
      (p.sections.achievements.data === null) ||
        ((p.sections.achievements.data as any).count === 0),
      'no achievements fabricated',
    );
    assert(p.sections.career_journey.data === null, 'no journey events fabricated');

    console.log('\n[3] Career Profile NEVER surfaces contact PII');
    const FORBIDDEN = ['email', 'phone', 'mobile', 'address', 'contact'];
    const cpData = p.sections.career_profile.data as any;
    const summaryKeys = cpData?.summary ? Object.keys(cpData.summary) : [];
    assert(
      summaryKeys.every((k) => !FORBIDDEN.some((f) => k.toLowerCase().includes(f))),
      'career profile summary excludes contact fields (email/phone/address)',
    );

    console.log('\n[4] GET-never-writes: read path creates NO schema (DDL)');
    const regclass = async (t: string): Promise<string | null> => {
      const r = await pool.query(`SELECT to_regclass($1) AS t`, [t]).catch(() => ({ rows: [{ t: null }] }));
      return (r.rows[0]?.t as string | null) ?? null;
    };
    // Every relation a GET could create: this phase's own snapshot table + every
    // table AND index the transitively-composed competency-runtime ensure would
    // create (reuse the engine's lockstep list so this can never drift).
    const WATCHED = [
      'public.career_passport_snapshots',
      ...COMPETENCY_RUNTIME_RELATIONS.map((r) => `public.${r}`),
    ];
    const snap = async () => {
      const out: Record<string, string | null> = {};
      for (const t of WATCHED) out[t] = await regclass(t);
      return out;
    };
    const before = await snap();
    await generateCareerPassport(pool, SMOKE_SUBJECT);
    await generateCareerPassport(pool, SMOKE_SUBJECT);
    const after = await snap();
    assert(
      WATCHED.every((t) => before[t] === after[t]),
      'no watched relation created by repeated GET-equivalent generate() calls',
    );

    console.log('\n[5] history: append-only persist + list; honest exists:false first');
    const h0 = await listPassportHistory(pool, SMOKE_SUBJECT);
    assert(h0.items.length === 0, 'no history rows for this subject before any snapshot');
    // POST-path persist (the ONLY write path) — appends ONE row.
    const persisted = await persistPassportSnapshot(pool, p);
    assert(!!persisted.id, 'persist returns a row id (append-only insert)');
    assert(persisted.subject_id === SMOKE_SUBJECT, 'persisted row echoes subject');
    const h1 = await listPassportHistory(pool, SMOKE_SUBJECT);
    assert(h1.exists === true, 'history table exists after first persist');
    assert(h1.items.length === 1, 'exactly one append-only row listed');
    assert(h1.items[0].sections_present === 0, 'persisted coverage honest (0 present)');

    // cleanup — remove only this smoke subject's rows.
    await pool.query(`DELETE FROM career_passport_snapshots WHERE subject_id = $1`, [SMOKE_SUBJECT]);
    const h2 = await listPassportHistory(pool, SMOKE_SUBJECT);
    assert(h2.items.length === 0, 'cleanup removed smoke rows');

    console.log('\n[6] determinism — two generate() calls return identical coverage shape');
    const a = await generateCareerPassport(pool, SMOKE_SUBJECT);
    const b = await generateCareerPassport(pool, SMOKE_SUBJECT);
    assert(
      JSON.stringify(a.coverage) === JSON.stringify(b.coverage),
      'coverage block is deterministic for the same subject',
    );

    console.log('\n[7] Career Profile redacts embedded contact PII from free-text/structured fields');
    const piiCtx = {
      subject_id: SMOKE_SUBJECT,
      runtimeReady: false,
      competencyProfile: null,
      eiProfile: null,
      readiness: null,
      careerProfile: {
        exists: true,
        data: {
          headline: 'Reach me at jane.doe@example.com or +1 (415) 555-0199 anytime',
          title: 'Senior Engineer',
          location: 'Call 9876543210 — San Francisco',
          summary: 'free-text bio with secret@leak.com that must NOT surface',
          bio: 'another free-text field with 415-555-0123',
        },
      },
      journeyEvents: [],
      notes: [],
    };
    const piiProfile = buildPassportProfile(piiCtx as any);
    const cpSection = piiProfile.sections.career_profile;
    const cpJson = JSON.stringify(cpSection ?? {});
    assert(!/@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(cpJson), 'no raw email surfaced anywhere in career profile');
    assert(!/\d[\d\s().-]{6,}\d/.test(cpJson), 'no raw phone-like digit sequence surfaced in career profile');
    assert(!cpJson.includes('jane.doe') && !cpJson.includes('secret@leak'), 'specific contact tokens scrubbed');
    assert(
      !cpJson.includes('must NOT surface') && !cpJson.includes('another free-text field'),
      'free-text summary/bio VALUES are NOT whitelisted into the passport',
    );
    assert(
      !cpSection.data || !('summary_text' in (cpSection.data as any)) === true,
      'no raw free-text body field carried through',
    );
    assert(/redacted-(email|phone)/.test(cpJson), 'contact patterns replaced with explicit redaction markers');

    console.log('\n✅ PHASE 4.9 smoke PASS');
  } catch (e: any) {
    failed = true;
    console.error('\n❌ PHASE 4.9 smoke FAIL:', e?.message ?? e);
  } finally {
    await pool.end();
    process.exit(failed ? 1 : 0);
  }
}

void main();
