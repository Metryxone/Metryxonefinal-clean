/**
 * PHASE 5.14 — notification_engine / workflow_notifications / communication_engine.
 *
 * Three role-relevant NOTIFICATION views, each a deterministic, coverage-gated, null-abstaining
 * DERIVATION of operator-recorded evidence (compose-never-recompute; PURE READ; SENDS NOTHING):
 *   - notification_engine     : the alert feed across all 7 alert types (Job / Application /
 *                               Interview / Offer / Employer / Recruiter Alerts + Status Changes).
 *   - workflow_notifications  : per active-pipeline candidate, the deterministic next action for the
 *                               current stage + a stalled flag (no update within the stalled window).
 *   - communication_engine    : message PREVIEWS for each alert (audience + channel + subject + body)
 *                               — never delivered, never includes candidate contact details.
 *
 * None of these is a prediction or a hiring/promotion/suitability verdict — they are operational
 * reminders derived from recorded state. Missing dates abstain (null) with an explicit Coverage axis;
 * the reference instant is captured once and echoed as `evaluated_at` (determinism).
 */

import type { Pool } from 'pg';
import { type EngineResult, ok, workforceSummary } from './workforce-intelligence-shared';
import { canonStage, normJobStatus, FUNNEL_ACTIVE } from './employer-dashboard-shared';
import {
  type NotificationEvidence, type Alert, type AlertType, type Severity,
  NOTIFICATION_ENGINE_VERSION, NOTIFICATION_DISCLAIMER, PROVENANCE,
  ALERT_TYPES, THRESHOLDS, STAGE_NEXT_ACTION,
  alert, sortAlerts, daysSince, coverage,
  resolveNotificationEvidence,
} from './notification-engine-shared';

const ACTIVE = new Set<string>(FUNNEL_ACTIVE);

// ── small derivations shared by builders ─────────────────────────────────────
function applicantCountByJob(ev: NotificationEvidence): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of ev.dashboard.workforce.candidates) {
    if (c.bound_to_employer_job && c.job_id != null) m.set(c.job_id, (m.get(c.job_id) ?? 0) + 1);
  }
  return m;
}

// ── JOB ALERTS ───────────────────────────────────────────────────────────────
export function buildJobAlerts(ev: NotificationEvidence): Alert[] {
  const out: Alert[] = [];
  const counts = applicantCountByJob(ev);
  for (const j of ev.dashboard.workforce.jobs) {
    const status = normJobStatus(ev.dashboard.jobStatusById.get(j.id) ?? null);
    const applicants = counts.get(j.id) ?? 0;
    const jt = ev.jobTimes.get(j.id);
    if (status === 'open' && applicants === 0) {
      out.push(alert({
        type: 'job_alert', category: 'job.no_applicants', severity: 'attention',
        subject_kind: 'job', subject_id: j.id, subject_label: j.title,
        message: `Open role "${j.title ?? j.id}" has no applicants yet.`,
        evidence: { status, applicant_count: 0 },
      }));
    }
    const postedDays = daysSince(ev.now, jt?.created_at ?? null);
    if (postedDays != null && postedDays >= 0 && postedDays <= THRESHOLDS.recent_days) {
      out.push(alert({
        type: 'job_alert', category: 'job.newly_posted', severity: 'info',
        subject_kind: 'job', subject_id: j.id, subject_label: j.title,
        message: `Role "${j.title ?? j.id}" was posted ${postedDays} day(s) ago.`,
        evidence: { days_since_posted: postedDays, applicant_count: applicants },
      }));
    }
  }
  return out;
}

// ── APPLICATION ALERTS ───────────────────────────────────────────────────────
export function buildApplicationAlerts(ev: NotificationEvidence): Alert[] {
  const out: Alert[] = [];
  for (const c of ev.dashboard.workforce.candidates) {
    const st = canonStage(c.stage);
    const ct = ev.candidateTimes.get(c.id);
    const appliedDays = daysSince(ev.now, ct?.applied_date ?? null);
    if (appliedDays != null && appliedDays >= 0 && appliedDays <= THRESHOLDS.recent_days) {
      out.push(alert({
        type: 'application_alert', category: 'application.new', severity: 'attention',
        subject_kind: 'candidate', subject_id: c.id, subject_label: c.role,
        message: `New application received ${appliedDays} day(s) ago${c.role ? ` for ${c.role}` : ''}.`,
        evidence: { days_since_applied: appliedDays, stage: st },
      }));
    }
    if (st === 'Applied') {
      out.push(alert({
        type: 'application_alert', category: 'application.awaiting_screening', severity: 'attention',
        subject_kind: 'candidate', subject_id: c.id, subject_label: c.role,
        message: `Application is awaiting screening${c.role ? ` for ${c.role}` : ''}.`,
        evidence: { stage: st },
      }));
    }
  }
  return out;
}

// ── INTERVIEW ALERTS ─────────────────────────────────────────────────────────
export function buildInterviewAlerts(ev: NotificationEvidence): Alert[] {
  const out: Alert[] = [];
  for (const c of ev.dashboard.workforce.candidates) {
    const st = canonStage(c.stage);
    const ct = ev.candidateTimes.get(c.id);
    const dd = daysSince(ev.now, ct?.interview_date ?? null); // >0 past, <0 future
    if (dd == null) continue;
    if (dd <= 0 && dd >= -THRESHOLDS.interview_soon_days) {
      const until = -dd;
      out.push(alert({
        type: 'interview_alert', category: 'interview.upcoming', severity: 'attention',
        subject_kind: 'candidate', subject_id: c.id, subject_label: c.role,
        message: `Interview is ${until === 0 ? 'scheduled for today' : `in ${until} day(s)`}${c.role ? ` for ${c.role}` : ''}.`,
        evidence: { days_until_interview: until, stage: st },
      }));
    } else if (dd > 0 && st === 'Interview') {
      // interview date is in the past but the candidate still sits at the Interview stage => outcome not
      // recorded. Advancement to Offer/Hired (or exit via Rejected) implicitly records the outcome, so we
      // do NOT fire there — that would be a false positive against operator-recorded stage progress.
      out.push(alert({
        type: 'interview_alert', category: 'interview.outcome_overdue', severity: 'urgent',
        subject_kind: 'candidate', subject_id: c.id, subject_label: c.role,
        message: `Interview was ${dd} day(s) ago but no outcome is recorded (stage: ${st}).`,
        evidence: { days_since_interview: dd, stage: st },
      }));
    }
  }
  return out;
}

// ── OFFER ALERTS ─────────────────────────────────────────────────────────────
export function buildOfferAlerts(ev: NotificationEvidence): Alert[] {
  const out: Alert[] = [];
  for (const c of ev.dashboard.workforce.candidates) {
    const st = canonStage(c.stage);
    if (st !== 'Offer') continue;
    const ct = ev.candidateTimes.get(c.id);
    if (ct?.decision_at == null) {
      const sinceUpdate = daysSince(ev.now, ct?.updated_at ?? null);
      const urgent = sinceUpdate != null && sinceUpdate > THRESHOLDS.offer_pending_days;
      out.push(alert({
        type: 'offer_alert', category: 'offer.pending', severity: urgent ? 'urgent' : 'attention',
        subject_kind: 'candidate', subject_id: c.id, subject_label: c.role,
        message: `Offer is pending a decision${c.role ? ` for ${c.role}` : ''}${sinceUpdate != null ? ` (last updated ${sinceUpdate} day(s) ago)` : ''}.`,
        evidence: { stage: st, days_since_update: sinceUpdate, offer_amount: ct?.offer_amount ?? null },
      }));
    }
  }
  return out;
}

// ── STATUS CHANGES ───────────────────────────────────────────────────────────
// Derived from CURRENT recorded state (decision_at / updated_at) — NOT a true transition log.
export function buildStatusChanges(ev: NotificationEvidence): Alert[] {
  const out: Alert[] = [];
  for (const c of ev.dashboard.workforce.candidates) {
    const st = canonStage(c.stage);
    const ct = ev.candidateTimes.get(c.id);
    const decidedDays = daysSince(ev.now, ct?.decision_at ?? null);
    if (decidedDays != null) {
      out.push(alert({
        type: 'status_change', category: 'status.decision_recorded', severity: 'info',
        subject_kind: 'candidate', subject_id: c.id, subject_label: c.role,
        message: `A decision was recorded ${decidedDays} day(s) ago (stage: ${st ?? 'unknown'}).`,
        evidence: { stage: st, days_since_decision: decidedDays },
      }));
      continue; // a decision supersedes a generic recent-update note
    }
    const updatedDays = daysSince(ev.now, ct?.updated_at ?? null);
    if (updatedDays != null && updatedDays >= 0 && updatedDays <= THRESHOLDS.recent_days) {
      out.push(alert({
        type: 'status_change', category: 'status.recently_updated', severity: 'info',
        subject_kind: 'candidate', subject_id: c.id, subject_label: c.role,
        message: `Record was updated ${updatedDays} day(s) ago (stage: ${st ?? 'unknown'}).`,
        evidence: { stage: st, days_since_update: updatedDays },
      }));
    }
  }
  return out;
}

// ── EMPLOYER ALERTS (org rollups) ────────────────────────────────────────────
export function buildEmployerAlerts(ev: NotificationEvidence): Alert[] {
  const out: Alert[] = [];
  const empId = ev.dashboard.workforce.employer_id;
  const jobs = ev.dashboard.workforce.jobs;
  const counts = applicantCountByJob(ev);
  let openJobs = 0; let openNoApplicants = 0;
  for (const j of jobs) {
    if (normJobStatus(ev.dashboard.jobStatusById.get(j.id) ?? null) === 'open') {
      openJobs += 1;
      if ((counts.get(j.id) ?? 0) === 0) openNoApplicants += 1;
    }
  }
  if (openNoApplicants > 0) {
    out.push(alert({
      type: 'employer_alert', category: 'employer.jobs_without_applicants', severity: 'attention',
      subject_kind: 'employer', subject_id: empId, subject_label: empId,
      message: `${openNoApplicants} open role(s) have no applicants yet.`,
      evidence: { open_jobs_without_applicants: openNoApplicants, open_jobs: openJobs },
    }));
  }
  const unbound = ev.dashboard.workforce.candidates.filter((c) => !c.bound_to_employer_job).length;
  if (unbound > 0) {
    out.push(alert({
      type: 'employer_alert', category: 'employer.unbound_candidates', severity: 'attention',
      subject_kind: 'employer', subject_id: empId, subject_label: empId,
      message: `${unbound} candidate(s) are not linked to any of your job postings.`,
      evidence: { unbound_candidates: unbound },
    }));
  }
  out.push(alert({
    type: 'employer_alert', category: 'employer.open_jobs_summary', severity: 'info',
    subject_kind: 'employer', subject_id: empId, subject_label: empId,
    message: `${openJobs} open role(s) across ${jobs.length} total posting(s).`,
    evidence: { open_jobs: openJobs, total_jobs: jobs.length },
  }));
  return out;
}

// ── RECRUITER ALERTS (ops rollups) ───────────────────────────────────────────
export function buildRecruiterAlerts(ev: NotificationEvidence): Alert[] {
  const out: Alert[] = [];
  const empId = ev.dashboard.workforce.employer_id;
  const cands = ev.dashboard.workforce.candidates;
  let stalled = 0; let offersPending = 0; let interviewsUpcoming = 0;
  for (const c of cands) {
    const st = canonStage(c.stage);
    const ct = ev.candidateTimes.get(c.id);
    if (st != null && ACTIVE.has(st)) {
      const sinceUpdate = daysSince(ev.now, ct?.updated_at ?? null);
      if (sinceUpdate != null && sinceUpdate > THRESHOLDS.stalled_days) stalled += 1;
    }
    if (st === 'Offer' && ct?.decision_at == null) offersPending += 1;
    const dd = daysSince(ev.now, ct?.interview_date ?? null);
    if (dd != null && dd <= 0 && dd >= -THRESHOLDS.interview_soon_days) interviewsUpcoming += 1;
  }
  if (stalled > 0) {
    out.push(alert({
      type: 'recruiter_alert', category: 'recruiter.stalled_candidates', severity: 'urgent',
      subject_kind: 'employer', subject_id: empId, subject_label: empId,
      message: `${stalled} active candidate(s) have had no update in over ${THRESHOLDS.stalled_days} days.`,
      evidence: { stalled_candidates: stalled, stalled_days: THRESHOLDS.stalled_days },
    }));
  }
  if (offersPending > 0) {
    out.push(alert({
      type: 'recruiter_alert', category: 'recruiter.offers_pending', severity: 'attention',
      subject_kind: 'employer', subject_id: empId, subject_label: empId,
      message: `${offersPending} offer(s) are awaiting a decision.`,
      evidence: { offers_pending: offersPending },
    }));
  }
  if (interviewsUpcoming > 0) {
    out.push(alert({
      type: 'recruiter_alert', category: 'recruiter.interviews_upcoming', severity: 'info',
      subject_kind: 'employer', subject_id: empId, subject_label: empId,
      message: `${interviewsUpcoming} interview(s) are scheduled within the next ${THRESHOLDS.interview_soon_days} days.`,
      evidence: { interviews_upcoming: interviewsUpcoming, window_days: THRESHOLDS.interview_soon_days },
    }));
  }
  return out;
}

// ── feed assembly ────────────────────────────────────────────────────────────
function allAlerts(ev: NotificationEvidence): Alert[] {
  return [
    ...buildJobAlerts(ev),
    ...buildApplicationAlerts(ev),
    ...buildInterviewAlerts(ev),
    ...buildOfferAlerts(ev),
    ...buildEmployerAlerts(ev),
    ...buildRecruiterAlerts(ev),
    ...buildStatusChanges(ev),
  ];
}

function alertSummary(alerts: Alert[], ev: NotificationEvidence) {
  const by_type: Record<AlertType, number> = {
    job_alert: 0, application_alert: 0, interview_alert: 0, offer_alert: 0,
    employer_alert: 0, recruiter_alert: 0, status_change: 0,
  };
  const by_severity: Record<Severity, number> = { urgent: 0, attention: 0, info: 0 };
  for (const a of alerts) { by_type[a.type] += 1; by_severity[a.severity] += 1; }
  const cands = ev.dashboard.workforce.candidates;
  const withUpdated = cands.filter((c) => ev.candidateTimes.get(c.id)?.updated_at != null).length;
  return {
    total: alerts.length,
    by_type,
    by_severity,
    // Coverage axis: time-based alerts depend on recorded timestamps — disclose how many we had.
    timestamp_coverage: {
      candidates: cands.length,
      with_updated_at: withUpdated,
      coverage_pct: coverage(withUpdated, cands.length),
    },
  };
}

// ── envelope ─────────────────────────────────────────────────────────────────
function envelope(ev: NotificationEvidence, output: string, body: Record<string, unknown>) {
  return {
    engine: 'notification_engine',
    output,
    version: NOTIFICATION_ENGINE_VERSION,
    employer_id: ev.dashboard.workforce.employer_id,
    evaluated_at: new Date(ev.now).toISOString(),
    ...body,
    evidence: workforceSummary(ev.dashboard.workforce),
    delivery: 'none (read-only preview; this engine sends nothing)',
    provenance: PROVENANCE,
    disclaimer: NOTIFICATION_DISCLAIMER,
  };
}

// ── deliverable 1: notification_engine (the alert feed) ──────────────────────
export function buildNotificationsFromEvidence(ev: NotificationEvidence) {
  const alerts = sortAlerts(allAlerts(ev));
  return envelope(ev, 'notifications', { summary: alertSummary(alerts, ev), alerts });
}

// ── deliverable 2: workflow_notifications ────────────────────────────────────
export function buildWorkflowNotificationsFromEvidence(ev: NotificationEvidence) {
  const cands = ev.dashboard.workforce.candidates;
  const items = cands
    .map((c) => {
      const st = canonStage(c.stage);
      if (st == null || !ACTIVE.has(st)) return null;
      const ct = ev.candidateTimes.get(c.id);
      const sinceUpdate = daysSince(ev.now, ct?.updated_at ?? null);
      return {
        candidate_id: c.id,
        role: c.role,
        department: c.department,
        stage: st,
        next_action: STAGE_NEXT_ACTION[st] ?? null,
        days_since_update: sinceUpdate,
        // null when no updated_at recorded — abstain, never assume "fresh".
        stalled: sinceUpdate == null ? null : sinceUpdate > THRESHOLDS.stalled_days,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) =>
      FUNNEL_ACTIVE.indexOf(a.stage as any) - FUNNEL_ACTIVE.indexOf(b.stage as any) ||
      a.candidate_id.localeCompare(b.candidate_id));

  const by_stage: Record<string, number> = {};
  for (const s of FUNNEL_ACTIVE) by_stage[s] = 0;
  for (const it of items) by_stage[it.stage] += 1;
  const stalledCount = items.filter((i) => i.stalled === true).length;
  const withUpdated = items.filter((i) => i.days_since_update != null).length;

  return envelope(ev, 'workflows', {
    summary: {
      active_candidates: items.length,
      by_stage,
      stalled: stalledCount,
      stalled_window_days: THRESHOLDS.stalled_days,
      update_coverage_pct: coverage(withUpdated, items.length),
    },
    stage_actions: STAGE_NEXT_ACTION,
    items,
  });
}

// ── deliverable 3: communication_engine (message previews; never delivered) ──
const AUDIENCE_BY_TYPE: Record<AlertType, 'employer' | 'recruiter'> = {
  job_alert: 'employer',
  application_alert: 'recruiter',
  interview_alert: 'recruiter',
  offer_alert: 'recruiter',
  employer_alert: 'employer',
  recruiter_alert: 'recruiter',
  status_change: 'recruiter',
};
const SUBJECT_BY_TYPE: Record<AlertType, string> = {
  job_alert: 'Job posting update',
  application_alert: 'New / pending application',
  interview_alert: 'Interview reminder',
  offer_alert: 'Offer pending decision',
  employer_alert: 'Hiring overview',
  recruiter_alert: 'Recruiting action needed',
  status_change: 'Candidate status update',
};

export function buildCommunicationsFromEvidence(ev: NotificationEvidence) {
  const alerts = sortAlerts(allAlerts(ev));
  const messages = alerts.map((a) => ({
    audience: AUDIENCE_BY_TYPE[a.type],
    channel: 'in_app',          // a hint only — nothing is dispatched
    severity: a.severity,
    subject: SUBJECT_BY_TYPE[a.type],
    // body is composed only from the derived alert message + the non-PII subject label.
    body_preview: a.subject_label ? `${a.subject_label}: ${a.message}` : a.message,
    alert_type: a.type,
    alert_category: a.category,
    alert_ref: a.dedup_key,
    delivered: false,
  }));
  const by_audience: Record<string, number> = { employer: 0, recruiter: 0 };
  for (const m of messages) by_audience[m.audience] += 1;
  return envelope(ev, 'communications', {
    summary: { total: messages.length, by_audience },
    note: 'Previews are composed from derived alerts and contain NO candidate contact details. ' +
      'Nothing is sent; "delivered" is always false.',
    messages,
  });
}

// ── combined overview ────────────────────────────────────────────────────────
export function buildNotificationOverviewFromEvidence(ev: NotificationEvidence) {
  return {
    engine: 'notification_engine',
    output: 'overview',
    version: NOTIFICATION_ENGINE_VERSION,
    employer_id: ev.dashboard.workforce.employer_id,
    evaluated_at: new Date(ev.now).toISOString(),
    notification_engine: buildNotificationsFromEvidence(ev),
    workflow_notifications: buildWorkflowNotificationsFromEvidence(ev),
    communication_engine: buildCommunicationsFromEvidence(ev),
    evidence: workforceSummary(ev.dashboard.workforce),
    delivery: 'none (read-only preview; this engine sends nothing)',
    provenance: PROVENANCE,
    disclaimer: NOTIFICATION_DISCLAIMER,
  };
}

// ── pool wrappers (single evidence load each) ────────────────────────────────
export async function computeNotifications(pool: Pool, employerId: string): Promise<EngineResult> {
  const r = await resolveNotificationEvidence(pool, employerId);
  if (!r.ok) return r;
  return ok(buildNotificationsFromEvidence(r.data));
}
export async function computeWorkflowNotifications(pool: Pool, employerId: string): Promise<EngineResult> {
  const r = await resolveNotificationEvidence(pool, employerId);
  if (!r.ok) return r;
  return ok(buildWorkflowNotificationsFromEvidence(r.data));
}
export async function computeCommunications(pool: Pool, employerId: string): Promise<EngineResult> {
  const r = await resolveNotificationEvidence(pool, employerId);
  if (!r.ok) return r;
  return ok(buildCommunicationsFromEvidence(r.data));
}
export async function computeNotificationOverview(pool: Pool, employerId: string): Promise<EngineResult> {
  const r = await resolveNotificationEvidence(pool, employerId);
  if (!r.ok) return r;
  return ok(buildNotificationOverviewFromEvidence(r.data));
}

export { ALERT_TYPES };
