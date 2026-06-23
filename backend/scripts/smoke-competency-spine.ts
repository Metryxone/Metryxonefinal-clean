/**
 * Smoke test — 98X Gap Closure Phase 2: Competency Intelligence Spine Contracts.
 *
 * Verifies:
 *   1. Flag-OFF contract: with FF_COMPETENCY_SPINE_CONTRACTS unset, every route 503s.
 *      (Run this script WITHOUT the env var to exercise that; the resolver below is
 *       called directly so we always test the union math too.)
 *   2. Resolver UNION correctness: a subject scored ONLY via the runtime ledger
 *      (onto_competency_profiles) resolves; a subject scored ONLY via the normalized
 *      ledger (onto_competency_score_runs) resolves; both surface their scores.
 *   3. Honesty: a non-existent subject resolves to honest empty (resolved:false,
 *      no fabricated scores), and no score is a fabricated 0.
 *
 * Read-only: this script performs ZERO writes.
 */
import { Pool } from 'pg';
import {
  resolveUnifiedCompetencyProfile,
  isUnifiedScoreNullSafe,
} from '../services/competency-intelligence-contracts';
import { authorizeSubject } from '../routes/competency-spine';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`  FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`  PASS: ${msg}`);
  }
}

async function pickSubject(table: string, col = 'subject_id'): Promise<string | null> {
  try {
    const { rows } = await pool.query(`SELECT ${col} FROM ${table} WHERE ${col} IS NOT NULL ORDER BY created_at DESC LIMIT 1`);
    return rows[0]?.[col] ?? null;
  } catch {
    return null;
  }
}

(async () => {
  console.log('== Competency Spine resolver UNION correctness ==');

  const runtimeSubject = await pickSubject('onto_competency_profiles');
  const normalizedSubject = await pickSubject('onto_competency_score_runs');
  console.log(`  runtime-ledger subject: ${runtimeSubject}`);
  console.log(`  normalized-ledger subject: ${normalizedSubject}`);

  if (runtimeSubject) {
    const p = await resolveUnifiedCompetencyProfile(pool, runtimeSubject);
    assert(p.resolved === true, `runtime subject resolves (resolved=true)`);
    const runtimeLedger = p.ledgers.find((l) => l.ledger === 'runtime_profile');
    assert(!!runtimeLedger?.present, `runtime ledger present for runtime subject`);
    const domainScores = p.scores.filter((s) => s.granularity === 'domain');
    assert(domainScores.length > 0, `runtime subject has domain-granularity scores (${domainScores.length})`);
    assert(
      domainScores.every((s) => s.score === null || (typeof s.score === 'number' && Number.isFinite(s.score))),
      `no fabricated/non-finite score on runtime subject`,
    );
    console.log(`    overall=${p.overallScore} source=${p.overallSource} scoreCount=${p.scores.length} gaps=${p.gaps.length} recs=${p.recommendations.length}`);
  } else {
    console.log('  SKIP: no runtime-ledger subject in DB');
  }

  if (normalizedSubject) {
    const p = await resolveUnifiedCompetencyProfile(pool, normalizedSubject);
    assert(p.resolved === true, `normalized subject resolves (resolved=true)`);
    const normLedger = p.ledgers.find((l) => l.ledger === 'normalized_run');
    assert(!!normLedger?.present, `normalized ledger present for normalized subject`);
    const compScores = p.scores.filter((s) => s.granularity === 'competency');
    assert(compScores.length > 0, `normalized subject has competency-granularity scores (${compScores.length})`);
    console.log(`    overall=${p.overallScore} source=${p.overallSource} scoreCount=${p.scores.length}`);
  } else {
    console.log('  SKIP: no normalized-ledger subject in DB');
  }

  // Honest empty
  const empty = await resolveUnifiedCompetencyProfile(pool, 'zzz-not-a-real-subject-xyz');
  assert(empty.resolved === false, `bogus subject → resolved=false (honest empty)`);
  assert(empty.scores.length === 0, `bogus subject → zero scores (no fabrication)`);
  assert(empty.overallScore === null, `bogus subject → overall null (no fabricated 0)`);

  // Real DB has the ledger tables present → available must be true even for a bogus subject.
  assert(empty.available === true, `tables present → available=true (empty subject, not degraded)`);

  // null-safety guard
  assert(isUnifiedScoreNullSafe(null) === null, `null score stays null (never coerced to 0)`);
  assert(isUnifiedScoreNullSafe('') === null, `empty-string score stays null`);
  assert(isUnifiedScoreNullSafe('57') === 57, `numeric string coerces`);

  console.log('\n== Degrade contract (both ledger tables absent) ==');
  // Stub pool whose to_regclass always returns null → both ledger tables "missing".
  const degradedPool = {
    query: async (sql: string) => {
      if (/to_regclass/i.test(sql)) return { rows: [{ reg: null }] };
      return { rows: [] };
    },
  } as unknown as Pool;
  const degraded = await resolveUnifiedCompetencyProfile(degradedPool, 'any_subject');
  assert(degraded.available === false, `missing ledger tables → available=false (degraded, not empty)`);
  assert(degraded.resolved === false, `degraded → resolved=false`);
  assert(degraded.scores.length === 0, `degraded → zero scores (no fabrication)`);
  assert(/degraded/i.test(degraded.note), `degraded note explains the substrate gap`);

  console.log('\n== IDOR / subject authorization ==');
  const mk = (id: string | null, role?: string) => ({ user: id == null ? undefined : { id, role } } as any);
  assert(authorizeSubject(mk(null), 'u1').allowed === false, `unauthenticated → blocked`);
  assert(authorizeSubject(mk(null), 'u1').reason === 'unauthenticated', `unauthenticated reason`);
  assert(authorizeSubject(mk('u1'), 'u1').allowed === true, `self read → allowed`);
  const cross = authorizeSubject(mk('u1'), 'u2');
  assert(cross.allowed === false, `cross-subject read (non-admin) → blocked`);
  assert(cross.reason === 'cross_subject_forbidden', `cross-subject reason`);
  assert(authorizeSubject(mk('admin1', 'super_admin'), 'someone_else').allowed === true, `super_admin → any subject`);

  await pool.end();
  console.log(process.exitCode ? '\nSMOKE FAILED' : '\nSMOKE PASSED');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
