/**
 * PHASE 5.14 — Notifications & Workflows smoke test.
 *
 * Seeds two @example.com employers (org + jobs with created_at/status + candidates carrying
 * applied/interview/decision/updated timestamps engineered to fire each alert type), exercises the
 * notification feed + workflows + communications + overview in-process, and asserts:
 *   - JOB alerts: job.no_applicants (open job, 0 applicants) + job.newly_posted (recent created_at),
 *   - APPLICATION alerts: application.new (recent applied_date) + application.awaiting_screening (Applied),
 *   - INTERVIEW alerts: interview.upcoming (date within window) + interview.outcome_overdue (past date, still active),
 *   - OFFER alerts: offer.pending (Offer stage, no decision; urgent when stale),
 *   - STATUS changes: status.decision_recorded (decision_at) + status.recently_updated (recent updated_at),
 *   - EMPLOYER alerts: jobs_without_applicants + unbound_candidates + open_jobs_summary,
 *   - RECRUITER alerts: stalled_candidates + offers_pending + interviews_upcoming,
 *   - WORKFLOWS: active candidates by stage + next_action + stalled flag (null when no updated_at),
 *   - COMMUNICATIONS: one preview per alert, delivered:false, audience split, NO contact (@example.com) leak,
 *   - timestamp Coverage abstention (candidate with NULL updated_at => stalled null, not counted),
 *   - IDOR employer-scoping (EMP2 rows never leak),
 *   - GET-never-writes (pg_class relation count + employer row counts unchanged),
 *   - determinism (overview built twice from ONE evidence load is byte-identical),
 *   - flag-OFF HTTP 503.
 * Self-cleans all seeded rows (PASS or FAIL).
 *
 * Run from backend/:  npx tsx scripts/smoke-notification-engine.ts
 */

import { Pool } from 'pg';
import { execSync } from 'node:child_process';
import { resolveNotificationEvidence } from '../services/notification-engine-shared';
import {
  computeNotifications, computeWorkflowNotifications, computeCommunications, computeNotificationOverview,
  buildNotificationOverviewFromEvidence,
} from '../services/notification-engine';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const EMP = 'emp_notif_smoke@example.com';
const EMP2 = 'emp_notif_other@example.com';
const JOB_NEW = 'job_notif_new';        // EMP open, created 2d ago, has applicants
const JOB_EMPTY = 'job_notif_empty';    // EMP open, created 30d ago, 0 applicants
const JOB_CLOSED = 'job_notif_closed';  // EMP Closed
const JOB_C = 'job_notif_other';        // EMP2 (cross-employer)

let pass = 0; let fail = 0;
const ok = (name: string, cond: boolean, extra?: any) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`, extra != null ? JSON.stringify(extra) : ''); }
};

async function relCount(): Promise<number> {
  const r = await pool.query(`SELECT count(*)::int AS n FROM pg_class WHERE relnamespace = 'public'::regnamespace`);
  return Number(r.rows[0].n);
}
async function empRowCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of ['employer_jobs', 'employer_candidates', 'employer_organizations']) {
    const col = t === 'employer_organizations' ? 'id' : 'employer_id';
    const r = await pool.query(`SELECT count(*)::int AS n FROM ${t} WHERE ${col} = ANY($1)`, [[EMP, EMP2]]);
    out[t] = Number(r.rows[0].n);
  }
  return out;
}
async function cleanup() {
  await pool.query(`DELETE FROM employer_candidates WHERE employer_id = ANY($1)`, [[EMP, EMP2]]).catch(() => {});
  await pool.query(`DELETE FROM employer_jobs WHERE employer_id = ANY($1)`, [[EMP, EMP2]]).catch(() => {});
  await pool.query(`DELETE FROM employer_organizations WHERE id = ANY($1)`, [[EMP, EMP2]]).catch(() => {});
}

const d = (n: number) => `now() - interval '${n} days'`;  // past
const f = (n: number) => `now() + interval '${n} days'`;  // future

const CAND_COLS =
  '(id, employer_id, job_id, name, email, candidate_role, stage, applied_date, interview_date, decision_at, updated_at, offer_amount, skills, competency_profile)';

// applied/interview/decision/updated are SQL exprs or 'NULL'; offer is a number literal or 'NULL'.
function ins(
  id: string, employer: string, jobId: string, role: string, stage: string,
  t: { applied: string; interview: string; decision: string; updated: string; offer: string },
) {
  return pool.query(
    `INSERT INTO employer_candidates ${CAND_COLS}
       VALUES ($1,$2,$3,$4,$5,$6,$7, ${t.applied}, ${t.interview}, ${t.decision}, ${t.updated}, ${t.offer}, $8::jsonb, $9::jsonb)
       ON CONFLICT (id) DO NOTHING`,
    [id, employer, jobId, id, `${id}@example.com`, role, stage, JSON.stringify([]), JSON.stringify({})],
  );
}

async function seed() {
  await pool.query(
    `INSERT INTO employer_organizations (id, name, owner_id) VALUES ($1,'Notif Smoke Org',$1),($2,'Notif Other Org',$2)
       ON CONFLICT (id) DO NOTHING`,
    [EMP, EMP2],
  );
  // jobs with explicit created_at + status (mixed case to exercise normJobStatus).
  await pool.query(
    `INSERT INTO employer_jobs (id, employer_id, title, department, status, skills, created_at) VALUES
       ($1,$2,'New Engineer','Engineering','open',$3::jsonb, ${d(2)}),
       ($4,$2,'Stale Role','Engineering','open',$3::jsonb, ${d(30)}),
       ($5,$2,'Closed Role','Sales','Closed',$3::jsonb, ${d(30)})
       ON CONFLICT (id) DO NOTHING`,
    [JOB_NEW, EMP, JSON.stringify(['JavaScript']), JOB_EMPTY, JOB_CLOSED],
  );
  await pool.query(
    `INSERT INTO employer_jobs (id, employer_id, title, department, status, skills, created_at) VALUES
       ($1,$2,'Other Role','Other','open',$3::jsonb, ${d(30)}) ON CONFLICT (id) DO NOTHING`,
    [JOB_C, EMP2, JSON.stringify(['Leadership'])],
  );

  // EMP candidates (all bound to JOB_NEW unless noted) — timestamps engineered per alert type.
  await ins('cand_applied_new', EMP, JOB_NEW, 'Engineer', 'applied',
    { applied: d(1), interview: 'NULL', decision: 'NULL', updated: d(1), offer: 'NULL' });        // application.new + awaiting_screening
  await ins('cand_iv_soon', EMP, JOB_NEW, 'Engineer', 'interview',
    { applied: d(10), interview: f(2), decision: 'NULL', updated: d(1), offer: 'NULL' });          // interview.upcoming
  await ins('cand_iv_overdue', EMP, JOB_NEW, 'Engineer', 'interview',
    { applied: d(10), interview: d(5), decision: 'NULL', updated: d(1), offer: 'NULL' });          // interview.outcome_overdue (urgent)
  await ins('cand_offer_pending', EMP, JOB_NEW, 'Engineer', 'Offer',
    { applied: d(20), interview: d(12), decision: 'NULL', updated: d(10), offer: '50000' });       // offer.pending (urgent, updated>7)
  await ins('cand_stalled', EMP, JOB_NEW, 'Engineer', 'screened',
    { applied: d(30), interview: 'NULL', decision: 'NULL', updated: d(20), offer: 'NULL' });       // recruiter.stalled (updated>14)
  await ins('cand_hired', EMP, JOB_NEW, 'Engineer', 'Hired',
    { applied: d(30), interview: d(10), decision: d(3), updated: d(3), offer: 'NULL' });           // status.decision_recorded
  await ins('cand_recent', EMP, JOB_NEW, 'Engineer', 'screened',
    { applied: d(30), interview: 'NULL', decision: 'NULL', updated: d(2), offer: 'NULL' });        // status.recently_updated
  await ins('cand_unbound', EMP, JOB_C, 'Engineer', 'applied',
    { applied: d(3), interview: 'NULL', decision: 'NULL', updated: d(1), offer: 'NULL' });         // unbound (job belongs to EMP2)
  await ins('cand_noupdate', EMP, JOB_CLOSED, 'Engineer', 'screened',
    { applied: 'NULL', interview: 'NULL', decision: 'NULL', updated: 'NULL', offer: 'NULL' });     // timestamp-coverage abstention

  // EMP2 candidate (must NOT leak).
  await ins('cand_other', EMP2, JOB_C, 'Other Role', 'applied',
    { applied: d(1), interview: 'NULL', decision: 'NULL', updated: d(1), offer: 'NULL' });
}

async function main() {
  await cleanup();
  try {
    await seed();
    const relBefore = await relCount();
    const empBefore = await empRowCounts();

    // ── notification feed ─────────────────────────────────────────────────────
    const nR = await computeNotifications(pool, EMP);
    ok('notifications: engine ok', nR.ok);
    if (nR.ok) {
      const data = nR.data as any;
      const sum = data.summary;
      const cats = new Set<string>(data.alerts.map((a: any) => a.category));

      ok('feed: total 21 alerts', sum.total === 21, sum);
      ok('feed: by_type job 2 / application 4 / interview 2 / offer 1 / employer 3 / recruiter 3 / status 6',
        sum.by_type.job_alert === 2 && sum.by_type.application_alert === 4 && sum.by_type.interview_alert === 2 &&
        sum.by_type.offer_alert === 1 && sum.by_type.employer_alert === 3 && sum.by_type.recruiter_alert === 3 &&
        sum.by_type.status_change === 6, sum.by_type);
      ok('feed: severities urgent 3 / attention 9 / info 9',
        sum.by_severity.urgent === 3 && sum.by_severity.attention === 9 && sum.by_severity.info === 9, sum.by_severity);

      ok('JOB: job.no_applicants + job.newly_posted both present', cats.has('job.no_applicants') && cats.has('job.newly_posted'));
      ok('APPLICATION: application.new + application.awaiting_screening present', cats.has('application.new') && cats.has('application.awaiting_screening'));
      ok('INTERVIEW: interview.upcoming + interview.outcome_overdue present', cats.has('interview.upcoming') && cats.has('interview.outcome_overdue'));
      ok('OFFER: offer.pending present + urgent', (() => {
        const a = data.alerts.find((x: any) => x.category === 'offer.pending');
        return !!a && a.severity === 'urgent';
      })());
      ok('STATUS: decision_recorded + recently_updated present', cats.has('status.decision_recorded') && cats.has('status.recently_updated'));
      ok('STATUS: recently_updated count 5', data.alerts.filter((a: any) => a.category === 'status.recently_updated').length === 5);
      ok('EMPLOYER: jobs_without_applicants + unbound + open_jobs_summary present',
        cats.has('employer.jobs_without_applicants') && cats.has('employer.unbound_candidates') && cats.has('employer.open_jobs_summary'));
      ok('RECRUITER: stalled(urgent) + offers_pending + interviews_upcoming present', (() => {
        const st = data.alerts.find((x: any) => x.category === 'recruiter.stalled_candidates');
        return !!st && st.severity === 'urgent' && cats.has('recruiter.offers_pending') && cats.has('recruiter.interviews_upcoming');
      })());

      ok('feed: timestamp_coverage 8/9 = 88.9% (cand_noupdate has no updated_at)',
        sum.timestamp_coverage.candidates === 9 && sum.timestamp_coverage.with_updated_at === 8 && sum.timestamp_coverage.coverage_pct === 88.9,
        sum.timestamp_coverage);
      ok('feed: dedup_keys unique', new Set(data.alerts.map((a: any) => a.dedup_key)).size === data.alerts.length);
      ok('feed: provenance + disclaimer + delivery=none', data.provenance === 'operator_recorded_composite' &&
        typeof data.disclaimer === 'string' && /sends nothing/i.test(data.delivery));
    }

    // ── workflows ─────────────────────────────────────────────────────────────
    const wR = await computeWorkflowNotifications(pool, EMP);
    ok('workflows: engine ok', wR.ok);
    if (wR.ok) {
      const data = wR.data as any;
      ok('workflows: 8 active candidates (Hired excluded)', data.summary.active_candidates === 8, data.summary);
      ok('workflows: by_stage Applied 2 / Screened 3 / Interview 2 / Offer 1 / Assessment 0',
        data.summary.by_stage.Applied === 2 && data.summary.by_stage.Screened === 3 &&
        data.summary.by_stage.Interview === 2 && data.summary.by_stage.Offer === 1 && data.summary.by_stage.Assessment === 0,
        data.summary.by_stage);
      ok('workflows: stalled 1, update_coverage 87.5 (cand_noupdate abstains)',
        data.summary.stalled === 1 && data.summary.update_coverage_pct === 87.5, data.summary);
      const noUpd = data.items.find((i: any) => i.candidate_id === 'cand_noupdate');
      ok('workflows: cand_noupdate stalled=null (abstain, not assumed fresh)', !!noUpd && noUpd.stalled === null, noUpd);
      const applied = data.items.find((i: any) => i.candidate_id === 'cand_applied_new');
      ok('workflows: Applied next_action is screening', !!applied && /screen/i.test(applied.next_action), applied);
    }

    // ── communications (never sent; no contact leak) ──────────────────────────
    const cR = await computeCommunications(pool, EMP);
    ok('communications: engine ok', cR.ok);
    if (cR.ok) {
      const data = cR.data as any;
      ok('communications: one preview per alert (21)', data.summary.total === 21, data.summary);
      ok('communications: audience employer 5 / recruiter 16',
        data.summary.by_audience.employer === 5 && data.summary.by_audience.recruiter === 16, data.summary.by_audience);
      ok('communications: every message delivered=false (never sent)', data.messages.every((m: any) => m.delivered === false));
      // Contract: NO candidate PII (email/name/phone). Employer scope id is email-form by seed convention
      // and legitimately appears (scope, not candidate contact) — assert no CANDIDATE email leaks.
      const payload = JSON.stringify(data.messages);
      const candEmails = ['cand_applied_new', 'cand_iv_soon', 'cand_iv_overdue', 'cand_offer_pending',
        'cand_stalled', 'cand_hired', 'cand_recent', 'cand_unbound', 'cand_noupdate'].map((c) => `${c}@example.com`);
      ok('communications: NO candidate email leak in payload', candEmails.every((e) => !payload.includes(e)));
    }

    // ── IDOR employer-scoping ─────────────────────────────────────────────────
    const ovR = await computeNotificationOverview(pool, EMP);
    ok('overview: engine ok', ovR.ok);
    if (ovR.ok) {
      const data = ovR.data as any;
      ok('IDOR: EMP has 9 candidates (no EMP2 leak)', data.evidence.candidates === 9, data.evidence.candidates);
      ok('IDOR: EMP has 3 jobs (JOB_C excluded)', data.evidence.jobs === 3, data.evidence.jobs);
      ok('IDOR: cand_other never appears in EMP overview', !JSON.stringify(data).includes('cand_other'));
      ok('overview: has all three deliverables', !!data.notification_engine && !!data.workflow_notifications && !!data.communication_engine);
    }

    // ── not_found ─────────────────────────────────────────────────────────────
    const nf = await computeNotifications(pool, 'emp_notif_missing@example.com');
    ok('not_found: unknown employer', !nf.ok && (nf as any).code === 'not_found', nf);

    // ── determinism (ONE evidence load, built twice) ──────────────────────────
    const evR = await resolveNotificationEvidence(pool, EMP);
    ok('determinism: evidence resolves', evR.ok);
    if (evR.ok) {
      const a = JSON.stringify(buildNotificationOverviewFromEvidence(evR.data));
      const b = JSON.stringify(buildNotificationOverviewFromEvidence(evR.data));
      ok('determinism: same evidence => byte-identical output', a === b);
    }

    // ── GET-never-writes ──────────────────────────────────────────────────────
    const relAfter = await relCount();
    const empAfter = await empRowCounts();
    ok('GET-never-writes: pg_class relation count unchanged', relBefore === relAfter, { relBefore, relAfter });
    ok('GET-never-writes: employer row counts unchanged', JSON.stringify(empBefore) === JSON.stringify(empAfter), { empBefore, empAfter });

    // ── flag-OFF HTTP 503 ─────────────────────────────────────────────────────
    try {
      const code = execSync(
        `curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/api/notifications/employer/${EMP}/overview"`,
      ).toString().trim();
      ok('flag-OFF: HTTP overview route returns 503', code === '503', code);
    } catch (e: any) {
      ok('flag-OFF: HTTP overview route returns 503', false, e?.message);
    }
  } catch (e: any) {
    fail++; console.log('  ✗ UNCAUGHT', e?.message, e?.stack);
  } finally {
    await cleanup();
    await pool.end();
  }

  console.log(`\nPhase 5.14 smoke: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
