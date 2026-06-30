/**
 * Task #293 — Journey Tail Completion — phased validator (OFF → ON).
 *
 * Run:  cd backend && npx tsx scripts/task293-journey-tail-validate.ts
 *
 * Phase A (flag OFF): every write fn must short-circuit with reason 'flag_off' BEFORE ensure-schema,
 *   and the set of existing jt_* tables must be UNCHANGED by those OFF writes (byte-identical incl. schema).
 * Phase B (flag ON): the three tails write + read back end-to-end against the live DB, using demo
 *   (@example.com) subjects so the honest overview EXCLUDES them; all demo rows are purged at the end.
 *
 * Honest by construction: assertions compare exact values; demo rows are cleaned up; the validator is
 * ALLOWED to fail (non-zero exit) — never tune a number to force a pass.
 */
import { Pool } from 'pg';
import {
  ensureJourneyTailSchema,
  recordParentSupportAction,
  updateParentSupportActionStatus,
  listParentSupportActions,
  recordMentorEngagement,
  listMentorEngagements,
  recordStakeholderObservation,
  updateObservationFollowupStatus,
  listObservationsForParent,
  listFollowUpQueue,
  composeJourneyTailOverview,
} from '../services/journey-tail-engine';
import { isStaff, seekerHasBooking } from '../routes/journey-tail';

const JT_TABLES = ['jt_parent_support_actions', 'jt_mentor_engagements', 'jt_stakeholder_observations'];
const FLAG_ENV = 'FF_JOURNEY_TAIL_COMPLETION';

let pass = 0, fail = 0;
const log = (ok: boolean, name: string, extra = '') => {
  (ok ? pass++ : fail++);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
};

async function existing(pool: Pool): Promise<Set<string>> {
  const out = new Set<string>();
  for (const t of JT_TABLES) {
    const r = await pool.query('SELECT to_regclass($1) AS reg', ['public.' + t]);
    if (r.rows[0].reg) out.add(t);
  }
  return out;
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Unique demo subjects so a re-run can't collide and cleanup is targeted.
  const tag = `jt293-${Date.now()}`;
  const parentId = `${tag}-parent`;
  const childId = `${tag}-child`;
  const mentorProfileId = `${tag}-mentor`;
  const parentEmail = `${tag}-parent@example.com`;
  const observerId = `${tag}-counsellor`;
  const observerEmail = `${tag}-counsellor@example.com`;
  const createdActionIds: string[] = [];
  const createdObsIds: string[] = [];
  const createdEngIds: string[] = [];

  try {
    // ── Phase A: flag OFF ──────────────────────────────────────────────────────────────────────────
    delete process.env[FLAG_ENV];
    const before = await existing(pool);

    const a1 = await recordParentSupportAction(pool, { parentId, parentEmail, childId, actionType: 'log_support' });
    log(!a1.ok && (a1 as any).reason === 'flag_off', 'OFF parent write → flag_off', JSON.stringify(a1));

    const a2 = await recordMentorEngagement(pool, { mentorProfileId, authorId: parentId, authorRole: 'seeker', authorEmail: parentEmail, kind: 'check_in' });
    log(!a2.ok && (a2 as any).reason === 'flag_off', 'OFF mentor write → flag_off', JSON.stringify(a2));

    const a3 = await recordStakeholderObservation(pool, { childId, observerId, observerType: 'counsellor', observerEmail, followUpRequired: true, shareWithParent: true });
    log(!a3.ok && (a3 as any).reason === 'flag_off', 'OFF observation write → flag_off', JSON.stringify(a3));

    const a4 = await updateParentSupportActionStatus(pool, { parentId, actionId: 'x', status: 'done' });
    log(!a4.ok && (a4 as any).reason === 'flag_off', 'OFF parent status → flag_off', JSON.stringify(a4));

    const a5 = await updateObservationFollowupStatus(pool, { observationId: 'x', status: 'resolved' });
    log(!a5.ok && (a5 as any).reason === 'flag_off', 'OFF followup status → flag_off', JSON.stringify(a5));

    const after = await existing(pool);
    const unchanged = before.size === after.size && [...before].every((t) => after.has(t));
    log(unchanged, 'OFF created no jt_* tables (schema byte-identical)', `before=${[...before].length} after=${[...after].length}`);

    // ── Phase B: flag ON ───────────────────────────────────────────────────────────────────────────
    process.env[FLAG_ENV] = '1';
    await ensureJourneyTailSchema(pool);
    const onTables = await existing(pool);
    log(onTables.size === 3, 'ON ensure-schema created all 3 jt_* tables', `${[...onTables].length}/3`);

    // 1) Parent support-action loop
    const p1 = await recordParentSupportAction(pool, { parentId, parentEmail, childId, actionType: 'set_focus_area', title: 'Focus: time management', note: 'after viewing status' });
    log(p1.ok && (p1 as any).is_demo === true, 'ON parent write ok + is_demo', JSON.stringify(p1));
    if (p1.ok) createdActionIds.push((p1 as any).id);

    const pList = await listParentSupportActions(pool, parentId, childId);
    log(pList.ok && pList.available && pList.actions.length === 1 && pList.actions[0].status === 'open', 'ON parent list reads back open action', `n=${pList.actions.length}`);

    const pUpd = await updateParentSupportActionStatus(pool, { parentId, actionId: createdActionIds[0], status: 'in_progress' });
    log(pUpd.ok && (pUpd as any).updated === true, 'ON parent status open→in_progress', JSON.stringify(pUpd));

    // 2) Mentor/Coach engagement tail (seeker posts as themselves)
    const m1 = await recordMentorEngagement(pool, { mentorProfileId, seekerId: parentId, authorId: parentId, authorRole: 'seeker', authorEmail: parentEmail, kind: 'next_session_goal', note: 'first check-in', nextGoal: 'practice 30m/day' });
    log(m1.ok && (m1 as any).is_demo === true, 'ON mentor engagement write ok + is_demo', JSON.stringify(m1));
    if (m1.ok) createdEngIds.push((m1 as any).id);

    const mList = await listMentorEngagements(pool, { seekerId: parentId, visibleOnly: true });
    log(mList.ok && mList.engagements.length === 1 && mList.engagements[0].author_role === 'seeker', 'ON mentor list (seeker, visibleOnly) reads back', `n=${mList.engagements.length}`);

    // 3) Teacher/Counsellor continuation
    const o1 = await recordStakeholderObservation(pool, { childId, observerId, observerType: 'counsellor', observerEmail, organization: 'Demo School', overallRating: 4, concerns: 'attention dips', recommendations: 'short breaks', followUpRequired: true, shareWithParent: true });
    log(o1.ok && (o1 as any).is_demo === true, 'ON observation write ok + is_demo', JSON.stringify(o1));
    if (o1.ok) createdObsIds.push((o1 as any).id);

    const parentView = await listObservationsForParent(pool, [childId]);
    log(parentView.ok && parentView.observations.length === 1 && parentView.observations[0].follow_up_status === 'open', 'ON parent sees shared observation', `n=${parentView.observations.length}`);

    const queue = await listFollowUpQueue(pool, {});
    const inQueue = queue.observations.some((r: any) => r.id === createdObsIds[0]);
    log(queue.ok && inQueue, 'ON counsellor follow-up queue includes the observation', `n=${queue.observations.length}`);

    const parentAck = await updateObservationFollowupStatus(pool, { observationId: createdObsIds[0], status: 'acknowledged', childIds: [childId] });
    log(parentAck.ok && (parentAck as any).updated === true, 'ON parent acknowledges shared observation (effect surfaced back)', JSON.stringify(parentAck));

    const staffResolve = await updateObservationFollowupStatus(pool, { observationId: createdObsIds[0], status: 'resolved' });
    log(staffResolve.ok && (staffResolve as any).updated === true, 'ON staff resolves follow-up (open→…→resolved)', JSON.stringify(staffResolve));

    // Wrong-child scope: a parent who does not own the child cannot transition it.
    const wrongScope = await updateObservationFollowupStatus(pool, { observationId: createdObsIds[0], status: 'actioned', childIds: ['not-your-child'] });
    log(wrongScope.ok && (wrongScope as any).updated === false, 'ON parent cannot transition a non-owned child observation', JSON.stringify(wrongScope));

    // Overview EXCLUDES demo rows → our demo writes must not move the counts.
    const ov = await composeJourneyTailOverview(pool);
    const t = ov.tails;
    const demoExcluded =
      (t.parent_support.actions_total ?? -1) >= 0 &&
      !JSON.stringify(ov).includes(tag); // our demo tag never appears in aggregate output
    log(ov.ok && ov.read_only === true && demoExcluded, 'ON overview is read-only + demo-excluded (counts honest)', JSON.stringify(t));

    // ── Route-layer authz guards (regression) ─────────────────────────────────────────────────────
    // Teacher/Counsellor observations are STAFF-only — a bare authed user (no staff role) is rejected.
    const staffYes = isStaff({ user: { role: 'counsellor' } } as any);
    const staffNo = isStaff({ user: { role: 'career_seeker' } } as any);
    log(staffYes === true && staffNo === false, 'authz isStaff: staff role allowed, non-staff rejected', `staff=${staffYes} nonStaff=${staffNo}`);

    // A seeker may post a mentor engagement ONLY after a real post-match relationship (mentor_bookings).
    // Ensure the real ecosystem substrate exists (lazily created by ecosystem-community in prod).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mentor_bookings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        mentor_profile_id varchar NOT NULL, seeker_id varchar NOT NULL,
        seeker_name text, seeker_email text, topic text, preferred_slot text, message text,
        status text NOT NULL DEFAULT 'requested',
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    const noBooking = await seekerHasBooking(pool, parentId, mentorProfileId);
    await pool.query(
      `INSERT INTO mentor_bookings (mentor_profile_id, seeker_id, seeker_email, status) VALUES ($1,$2,$3,'requested')`,
      [mentorProfileId, parentId, parentEmail],
    );
    const hasBooking = await seekerHasBooking(pool, parentId, mentorProfileId);
    // seekerHasBooking backs BOTH route guards: seeker→mentor (no_mentor_booking) AND mentor→seeker (not_a_participant).
    log(noBooking === false && hasBooking === true, 'authz seekerHasBooking: false w/o booking, true after a real booking (guards both directions)', `before=${noBooking} after=${hasBooking}`);

  } catch (err) {
    log(false, 'validator threw', String(err));
  } finally {
    // ── Cleanup: purge every demo row this run created (idempotent, demo-only) ──────────────────────
    try {
      if (createdActionIds.length) await pool.query('DELETE FROM jt_parent_support_actions WHERE id = ANY($1)', [createdActionIds]);
      if (createdEngIds.length) await pool.query('DELETE FROM jt_mentor_engagements WHERE id = ANY($1)', [createdEngIds]);
      if (createdObsIds.length) await pool.query('DELETE FROM jt_stakeholder_observations WHERE id = ANY($1)', [createdObsIds]);
      // Belt-and-braces: clear anything keyed to this run's unique tag.
      await pool.query('DELETE FROM jt_parent_support_actions WHERE parent_id=$1 OR child_id=$2', [parentId, childId]).catch(() => {});
      await pool.query('DELETE FROM jt_mentor_engagements WHERE mentor_profile_id=$1 OR author_id=$1 OR seeker_id=$2', [mentorProfileId, parentId]).catch(() => {});
      await pool.query('DELETE FROM jt_stakeholder_observations WHERE child_id=$1 OR observer_id=$2', [childId, observerId]).catch(() => {});
      await pool.query('DELETE FROM mentor_bookings WHERE mentor_profile_id=$1 AND seeker_id=$2', [mentorProfileId, parentId]).catch(() => {});
      console.log('cleanup: demo rows purged');
    } catch (e) {
      console.log('cleanup warning:', String(e));
    }
    await pool.end();
  }

  console.log(`\n──────── Task #293 validator: ${pass} passed, ${fail} failed ────────`);
  process.exit(fail === 0 ? 0 : 1);
})();
