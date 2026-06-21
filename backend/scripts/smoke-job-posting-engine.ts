/**
 * Smoke test for Phase 5.3 Job Posting Engine.
 * Exercises the full lifecycle in-process against the live DB, then CLEANS UP all
 * demo rows it created (no pollution of the shared dev/prod DB).
 * Usage: cd backend && FF_JOB_POSTING_ENGINE=1 npx tsx scripts/smoke-job-posting-engine.ts
 */
import { Pool } from 'pg';
import {
  JOB_STATUS,
  createJob,
  editJob,
  submitForReview,
  decideStage,
  publishJob,
  pauseJob,
  closeJob,
  archiveJob,
  setVisibility,
  distributeJob,
  unpublishChannel,
  getDistributions,
  getWorkflow,
  listJobs,
  getJob,
} from '../services/job-posting-engine.js';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let pass = 0;
  let fail = 0;
  const createdIds: string[] = [];
  const check = (name: string, ok: boolean, detail = '') => {
    if (ok) { pass++; console.log(`  PASS ${name}`); }
    else { fail++; console.log(`  FAIL ${name} ${detail}`); }
  };

  // Use the seeded super-admin as a valid users.id FK for created_by/actor_id.
  const su = await pool.query(`SELECT id, role FROM users WHERE role='super_admin' ORDER BY created_at LIMIT 1`);
  const actor = { id: su.rows[0]?.id as string, role: su.rows[0]?.role ?? 'super_admin' };
  check('super-admin actor resolved', !!actor.id, JSON.stringify(actor));

  try {
    // ── job_posting_engine: create ───────────────────────────────────────────
    const created = await createJob(pool, actor, {
      title: 'SMOKE Demo Mentor (example.com)',
      roleCategory: 'mentor',
      employmentType: 'full-time',
      workMode: 'remote',
      eligibility: 'demo',
      qualifications: 'demo',
      responsibilities: 'demo',
      kpis: 'demo',
      compensationModel: 'demo',
    });
    check('create -> draft', created.ok && created.data.status === JOB_STATUS.DRAFT, JSON.stringify(created));
    const id = created.ok ? created.data.id : '';
    if (id) createdIds.push(id);

    // ── edit allowed in draft ────────────────────────────────────────────────
    const edited = await editJob(pool, actor, id, { title: 'SMOKE Demo Mentor v2', hiringQuota: 3 });
    check('edit in draft applies', edited.ok && edited.data.title === 'SMOKE Demo Mentor v2' && edited.data.hiring_quota === 3, JSON.stringify(edited));

    // ── illegal transition: publish from draft must 409 (invalid_transition) ──
    const earlyPublish = await publishJob(pool, actor, id);
    check('publish from draft rejected (invalid_transition)', !earlyPublish.ok && earlyPublish.code === 'invalid_transition', JSON.stringify(earlyPublish));

    // ── job_workflows: submit -> hr -> legal -> leadership -> approved ────────
    const submitted = await submitForReview(pool, actor, id, 'ready for review');
    check('submit -> hr_review', submitted.ok && submitted.data.status === JOB_STATUS.HR_REVIEW, JSON.stringify(submitted));

    const hr = await decideStage(pool, actor, id, 'hr', 'approve', 'hr ok');
    check('hr approve -> legal_review', hr.ok && hr.data.status === JOB_STATUS.LEGAL_REVIEW && !!hr.data.hr_review_at, JSON.stringify(hr));

    // wrong-stage guard: leadership decision while in legal_review must 409
    const wrongStage = await decideStage(pool, actor, id, 'leadership', 'approve');
    check('leadership decision out of order rejected', !wrongStage.ok && wrongStage.code === 'invalid_transition', JSON.stringify(wrongStage));

    const legal = await decideStage(pool, actor, id, 'legal', 'approve', 'legal ok');
    check('legal approve -> leadership_approval', legal.ok && legal.data.status === JOB_STATUS.LEADERSHIP_APPROVAL && !!legal.data.legal_review_at, JSON.stringify(legal));

    const lead = await decideStage(pool, actor, id, 'leadership', 'approve', 'leadership ok');
    check('leadership approve -> approved', lead.ok && lead.data.status === JOB_STATUS.APPROVED && !!lead.data.leadership_approval_at, JSON.stringify(lead));

    // ── job_posting_engine: publish (approved -> published) ───────────────────
    const published = await publishJob(pool, actor, id, 'go live');
    check('publish -> published + published_at set', published.ok && published.data.status === JOB_STATUS.PUBLISHED && !!published.data.published_at, JSON.stringify(published));

    // edit blocked once published
    const blockedEdit = await editJob(pool, actor, id, { title: 'should not apply' });
    check('edit blocked when published (invalid_transition)', !blockedEdit.ok && blockedEdit.code === 'invalid_transition', JSON.stringify(blockedEdit));

    // ── job_management_engine: visibility ────────────────────────────────────
    const vis = await setVisibility(pool, actor, id, 'public');
    check('visibility -> public', vis.ok && vis.data.visibility === 'public', JSON.stringify(vis));
    const badVis = await setVisibility(pool, actor, id, 'galaxy');
    check('invalid visibility rejected (invalid_input)', !badVis.ok && badVis.code === 'invalid_input', JSON.stringify(badVis));

    // ── job_management_engine: distribution channels (job_distributions) ──────
    const dist = await distributeJob(pool, actor, id, ['linkedin', 'naukri']);
    check('distribute published job -> 2 posted channels', dist.ok && dist.data.distributions.length === 2 && dist.data.distributions.every((d: any) => d.status === 'posted'), JSON.stringify(dist));
    const badChan = await distributeJob(pool, actor, id, ['myspace']);
    check('distribute unknown channel rejected (invalid_input)', !badChan.ok && badChan.code === 'invalid_input', JSON.stringify(badChan));
    const reDist = await distributeJob(pool, actor, id, ['linkedin']);
    check('re-distribute same channel idempotent (no dupe)', reDist.ok && reDist.data.distributions.length === 2, JSON.stringify(reDist));
    const unpub = await unpublishChannel(pool, actor, id, 'linkedin');
    check('unpublish channel -> unpublished', unpub.ok && unpub.data.status === 'unpublished' && !!unpub.data.unpublished_at, JSON.stringify(unpub));
    const unpubMissing = await unpublishChannel(pool, actor, id, 'indeed');
    check('unpublish channel with no distribution -> not_found', !unpubMissing.ok && unpubMissing.code === 'not_found', JSON.stringify(unpubMissing));
    const distList = await getDistributions(pool, id);
    check('getDistributions reflects channel states', distList.ok && distList.data.distributions.length === 2 && distList.data.distributions.find((d: any) => d.channel === 'linkedin')?.status === 'unpublished', JSON.stringify(distList));
    const jobWithDist = await getJob(pool, id);
    check('getJob embeds distributions', jobWithDist.ok && Array.isArray(jobWithDist.data.distributions) && jobWithDist.data.distributions.length === 2, '');

    // ── job_management_engine: pause -> resume(publish) -> close ──────────────
    const paused = await pauseJob(pool, actor, id, 'pausing');
    check('pause -> paused', paused.ok && paused.data.status === JOB_STATUS.PAUSED, JSON.stringify(paused));
    const resumed = await publishJob(pool, actor, id, 'resume');
    check('publish from paused -> published (resume)', resumed.ok && resumed.data.status === JOB_STATUS.PUBLISHED, JSON.stringify(resumed));
    const closed = await closeJob(pool, actor, id, 'closing');
    check('close -> closed + closed_at set', closed.ok && closed.data.status === JOB_STATUS.CLOSED && !!closed.data.closed_at, JSON.stringify(closed));

    // ── job_management_engine: archive (terminal) ────────────────────────────
    const archived = await archiveJob(pool, actor, id, 'archiving');
    check('archive -> archived', archived.ok && archived.data.status === JOB_STATUS.ARCHIVED, JSON.stringify(archived));
    const visAfterArchive = await setVisibility(pool, actor, id, 'internal');
    check('visibility blocked after archive (invalid_transition)', !visAfterArchive.ok && visAfterArchive.code === 'invalid_transition', JSON.stringify(visAfterArchive));

    // ── job_workflows: audit trail completeness ──────────────────────────────
    const wf = await getWorkflow(pool, id);
    const actions = wf.ok ? wf.data.transitions.map((t: any) => t.action) : [];
    check('workflow logged create+submit+approvals+publish+lifecycle', wf.ok && actions.includes('create') && actions.includes('submit_for_review') && actions.includes('hr_approve') && actions.includes('publish') && actions.includes('archive'), JSON.stringify(actions));
    check('every transition stamped with actor', wf.ok && wf.data.transitions.every((t: any) => t.actor_id === actor.id), '');

    // ── rejection path on a second job ───────────────────────────────────────
    const j2 = await createJob(pool, actor, { title: 'SMOKE Reject Demo', roleCategory: 'mentor', employmentType: 'contract', workMode: 'remote', eligibility: 'd', qualifications: 'd', responsibilities: 'd', kpis: 'd', compensationModel: 'd' });
    if (j2.ok) createdIds.push(j2.data.id);
    if (j2.ok) {
      await submitForReview(pool, actor, j2.data.id);
      const rej = await decideStage(pool, actor, j2.data.id, 'hr', 'reject', 'not a fit');
      check('hr reject -> rejected', rej.ok && rej.data.status === JOB_STATUS.REJECTED, JSON.stringify(rej));
      const reedit = await editJob(pool, actor, j2.data.id, { title: 'SMOKE Reject Demo fixed' });
      check('edit allowed after rejected', reedit.ok && reedit.data.title === 'SMOKE Reject Demo fixed', JSON.stringify(reedit));
    }

    // ── reads ────────────────────────────────────────────────────────────────
    const got = await getJob(pool, id);
    check('getJob returns archived demo', got.ok && got.data.id === id, '');
    const notFound = await getJob(pool, '00000000-0000-0000-0000-000000000000');
    check('getJob unknown id -> not_found', !notFound.ok && notFound.code === 'not_found', JSON.stringify(notFound));
    const list = await listJobs(pool, { status: JOB_STATUS.ARCHIVED });
    check('listJobs(status=archived) includes demo', list.ok && list.data.jobs.some((j: any) => j.id === id), '');

    // ── HTTP flag-OFF guard (default OFF in the running server) ───────────────
    const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:8080';
    try {
      const r = await fetch(`${base}/api/job-posting-engine/jobs`);
      check('HTTP /jobs flag-gated 503 (server flag OFF)', r.status === 503, `got ${r.status}`);
      const r2 = await fetch(`${base}/api/job-posting-engine/_meta/status`);
      check('HTTP /_meta/status flag-gated 503', r2.status === 503, `got ${r2.status}`);
    } catch (e: any) {
      console.log('  SKIP HTTP flag-OFF guard (server unreachable):', e?.message ?? e);
    }
  } catch (e: any) {
    fail++;
    console.log('  FAIL engine threw:', e?.message ?? e);
  } finally {
    // CLEANUP — remove all demo rows + their approval logs (cascade handles logs).
    for (const id of createdIds) {
      try { await pool.query(`DELETE FROM job_postings WHERE id = $1`, [id]); } catch {}
    }
    console.log(`  cleanup: deleted ${createdIds.length} demo job(s)`);
    await pool.end();
  }
  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
