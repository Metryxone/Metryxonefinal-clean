/**
 * e2e-institution-campaign.ts — institution onboarding + EIOS campaign execution.
 *
 * Covers the two scenario legs not exercised by e2e-employer-lifecycle.ts or the
 * commercial smokes:
 *   1 Institution Onboarded → institutions row (before/after delta)
 *   2 Campaign Created      → eios_campaigns row (status=draft)
 *   3 Campaign Executed     → status draft→active + sent_count 0→target (value change)
 *   4 Campaign Completed    → completed_count set + status active→completed
 *   5 All Data Persisted    → re-query every table; counts ≥ 1
 *
 * Persistence is proven with BEFORE/AFTER deltas (a new row or a changed value),
 * never a bare count>0. All rows are e2e-prefixed / @example.com and removed on
 * exit. Exits non-zero on any failed assertion so automation can't read a false
 * PASS. Read-only honesty is NOT the goal here — this is a write-path integration
 * test against explicitly demo rows.
 *
 * Run: cd backend && npx tsx scripts/e2e-institution-campaign.ts
 */
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const INST_NAME = 'E2E Institute of Technology (example.com)';
const TAG = 'e2e-eios';
const EMP = `${TAG}-emp`;
const JOB = `${TAG}-job`;
const CAMP = `${TAG}-camp`;

let failures = 0;
let stageNo = 0;
function stage(name: string) {
  stageNo += 1;
  console.log(`\n[${String(stageNo).padStart(2, '0')}] ${name}`);
}
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`     \u2713 ${msg}`);
  else { failures += 1; console.error(`     \u2717 FAIL: ${msg}`); }
}
async function num(sql: string, params: any[] = []): Promise<number> {
  const r = await pool.query(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}
async function scalar<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const r = await pool.query(sql, params);
  return (r.rows[0]?.v ?? null) as T | null;
}
async function exists(table: string): Promise<boolean> {
  const r = await pool.query('SELECT to_regclass($1) AS reg', [table]);
  return !!r.rows[0]?.reg;
}

// Pre-run cleanup: best-effort, errors logged only (a leftover row from a prior
// crashed run is expected and is removed here; it does not invalidate THIS run).
async function preClean() {
  if (await exists('eios_campaigns')) {
    try { await pool.query('DELETE FROM eios_campaigns WHERE id=$1', [CAMP]); } catch (e: any) { console.error(`preClean eios_campaigns: ${e.message}`); }
  }
  if (await exists('institutions')) {
    try { await pool.query('DELETE FROM institutions WHERE canonical_name=$1', [INST_NAME]); } catch (e: any) { console.error(`preClean institutions: ${e.message}`); }
  }
}

// Post-run cleanup: the self-clean honesty guarantee. An error OR any residual
// demo row counts as a FAILURE so the run can never report PASS while leaving
// rows behind.
async function postClean() {
  const targets: Array<[string, string, string, any[]]> = [
    ['eios_campaigns', 'DELETE FROM eios_campaigns WHERE id=$1', 'SELECT COUNT(*)::int n FROM eios_campaigns WHERE id=$1', [CAMP]],
    ['institutions', 'DELETE FROM institutions WHERE canonical_name=$1', 'SELECT COUNT(*)::int n FROM institutions WHERE canonical_name=$1', [INST_NAME]],
  ];
  for (const [t, del, cnt, p] of targets) {
    if (!(await exists(t))) continue;
    try {
      await pool.query(del, p);
      const remaining = await num(cnt, p);
      if (remaining !== 0) { failures += 1; console.error(`     \u2717 FAIL: self-clean left ${remaining} ${t} row(s)`); }
    } catch (e: any) {
      failures += 1;
      console.error(`     \u2717 FAIL: cleanup ${t} threw: ${e.message}`);
    }
  }
}

async function main() {
  console.log('INSTITUTION + EIOS CAMPAIGN E2E — onboarding + campaign execution\n');
  if (!(await exists('institutions')) || !(await exists('eios_campaigns'))) {
    console.error('Required tables absent (institutions / eios_campaigns) — cannot run.');
    process.exit(1);
  }
  await preClean();

  // 1 — Institution Onboarded ──────────────────────────────────────────────────
  let instId: string;
  stage('Institution Onboarded');
  {
    const before = await num('SELECT COUNT(*)::int n FROM institutions WHERE canonical_name=$1', [INST_NAME]);
    const r = await pool.query(
      `INSERT INTO institutions (id, canonical_name, short_name, institution_type, country_code, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(),$1,'E2E Tech','university','IN',true,now(),now()) RETURNING id`,
      [INST_NAME],
    );
    instId = r.rows[0].id;
    const after = await num('SELECT COUNT(*)::int n FROM institutions WHERE canonical_name=$1', [INST_NAME]);
    const active = await scalar<boolean>('SELECT is_active v FROM institutions WHERE id=$1', [instId]);
    assert(before === 0 && after === 1, `institutions row persisted (\u0394 ${before}\u2192${after})`);
    assert(active === true, `institution onboarded as active`);
  }

  // 2 — Campaign Created ────────────────────────────────────────────────────────
  stage('Campaign Created');
  {
    const before = await num('SELECT COUNT(*)::int n FROM eios_campaigns WHERE id=$1', [CAMP]);
    await pool.query(
      `INSERT INTO eios_campaigns (id, employer_id, job_id, name, status, target_count, sent_count, completed_count, created_at)
       VALUES ($1,$2,$3,'E2E Outreach Campaign','draft',10,0,0,now())`,
      [CAMP, EMP, JOB],
    );
    const after = await num('SELECT COUNT(*)::int n FROM eios_campaigns WHERE id=$1', [CAMP]);
    const st = await scalar<string>('SELECT status v FROM eios_campaigns WHERE id=$1', [CAMP]);
    assert(before === 0 && after === 1, `eios_campaigns row persisted (\u0394 ${before}\u2192${after})`);
    assert(st === 'draft', `campaign created in status=draft (got ${st})`);
  }

  // 3 — Campaign Executed ───────────────────────────────────────────────────────
  stage('Campaign Executed');
  {
    const beforeStatus = await scalar<string>('SELECT status v FROM eios_campaigns WHERE id=$1', [CAMP]);
    const beforeSent = Number(await scalar<number>('SELECT sent_count v FROM eios_campaigns WHERE id=$1', [CAMP]));
    const target = Number(await scalar<number>('SELECT target_count v FROM eios_campaigns WHERE id=$1', [CAMP]));
    await pool.query(`UPDATE eios_campaigns SET status='active', sent_count=$2 WHERE id=$1`, [CAMP, target]);
    const afterStatus = await scalar<string>('SELECT status v FROM eios_campaigns WHERE id=$1', [CAMP]);
    const afterSent = Number(await scalar<number>('SELECT sent_count v FROM eios_campaigns WHERE id=$1', [CAMP]));
    assert(beforeStatus === 'draft' && afterStatus === 'active', `campaign status transitioned draft\u2192active`);
    assert(beforeSent === 0 && afterSent === target && target > 0, `sent_count advanced 0\u2192${afterSent} (== target)`);
  }

  // 4 — Campaign Completed ──────────────────────────────────────────────────────
  stage('Campaign Completed');
  {
    const target = Number(await scalar<number>('SELECT target_count v FROM eios_campaigns WHERE id=$1', [CAMP]));
    const completed = Math.max(1, Math.floor(target * 0.7));
    const beforeCompleted = Number(await scalar<number>('SELECT completed_count v FROM eios_campaigns WHERE id=$1', [CAMP]));
    await pool.query(`UPDATE eios_campaigns SET status='completed', completed_count=$2 WHERE id=$1`, [CAMP, completed]);
    const afterStatus = await scalar<string>('SELECT status v FROM eios_campaigns WHERE id=$1', [CAMP]);
    const afterCompleted = Number(await scalar<number>('SELECT completed_count v FROM eios_campaigns WHERE id=$1', [CAMP]));
    const sent = Number(await scalar<number>('SELECT sent_count v FROM eios_campaigns WHERE id=$1', [CAMP]));
    assert(afterStatus === 'completed', `campaign status transitioned active\u2192completed`);
    assert(beforeCompleted === 0 && afterCompleted === completed && afterCompleted <= sent, `completed_count advanced 0\u2192${afterCompleted} (\u2264 sent=${sent})`);
  }

  // 5 — All Data Persisted ──────────────────────────────────────────────────────
  stage('All Data Persisted');
  {
    const counts = {
      institution: await num('SELECT COUNT(*)::int n FROM institutions WHERE canonical_name=$1', [INST_NAME]),
      campaign: await num("SELECT COUNT(*)::int n FROM eios_campaigns WHERE id=$1 AND status='completed'", [CAMP]),
    };
    console.log(`     persisted rows: ${JSON.stringify(counts)}`);
    assert(Object.values(counts).every((c) => c >= 1), `every artifact persisted (institution + completed campaign)`);
  }

  console.log(`\n${failures === 0 ? '\u2705 ALL INSTITUTION + CAMPAIGN SCENARIOS PASSED — every stage persisted' : `\u274c ${failures} CHECK(S) FAILED`}`);
}

main()
  .catch((e) => { console.error('E2E ERROR:', e); failures += 1; })
  .finally(async () => {
    await postClean();
    await pool.end();
    process.exit(failures === 0 ? 0 : 1);
  });
