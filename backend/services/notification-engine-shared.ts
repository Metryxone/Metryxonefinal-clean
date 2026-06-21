/**
 * PHASE 5.14 — Notifications & Workflows: shared composition util.
 *
 * A PURE READ / compose-never-recompute layer that DERIVES operational notification items from
 * operator-recorded employer evidence. It composes the Phase 5.13 dashboard evidence (which itself
 * composes the Phase 5.12 workforce evidence) and ADDS only the notification-specific reads it needs
 * (per-candidate / per-job timestamps) plus a SINGLE reference instant captured once per load. It
 * defines:
 *   - the engine VERSION + disclaimer (reuses the 5.12 EngineResult/ok/err + PROVENANCE),
 *   - the alert-type catalog (Job / Application / Interview / Offer / Employer / Recruiter Alerts +
 *     Status Changes), severity levels, and the time-window thresholds,
 *   - a small typed Alert + an alert() factory with a stable dedup key,
 *   - resolveNotificationEvidence(): ONE read that composes resolveDashboardEvidence (IDOR-scoped,
 *     existence guard) + employer-scoped candidate/job timestamp maps + one captured `now`,
 *   - day-difference + coverage helpers.
 *
 * Design contract (mirrors the program):
 *   - PURE READ. Phase 5.14 creates NO tables and writes NO rows, and SENDS NOTHING. No POST, no
 *     ensure-schema, no DDL, no email/SMS/push. It only COMPUTES which reminders are due.
 *   - Notifications are read-only DERIVATIONS of recorded state — operational reminders to support
 *     human action, NOT predictions and NOT hiring/promotion/suitability verdicts.
 *   - IDOR-safe: every read scoped by employer_id (delegated to the 5.13/5.12 resolver + scoped reads).
 *   - never-throws: typed EngineResult; absent data / missing timestamps degrade to honest
 *     null/empty with an explicit Coverage axis, never fabricated.
 *   - Determinism: `now` is captured ONCE per evidence load and threaded through, so the SAME
 *     evidence object always yields byte-identical output (the reference instant is echoed as
 *     `evaluated_at`).
 */

import type { Pool } from 'pg';
import {
  type EngineResult, ok, relExists, round1, PROVENANCE,
} from './workforce-intelligence-shared';
import {
  type DashboardEvidence, resolveDashboardEvidence,
} from './employer-dashboard-shared';

export const NOTIFICATION_ENGINE_VERSION = '5.14.0';

export const NOTIFICATION_DISCLAIMER =
  'Read-only notifications & workflows: deterministic, coverage-gated reminders DERIVED from ' +
  'operator-recorded evidence (jobs, candidate pipeline stages, and recorded dates such as applied / ' +
  'interview / decision / last-updated). This engine only COMPUTES which reminders are due — it ' +
  'SENDS nothing (no email/SMS/push) and writes nothing. Alerts reflect current recorded state, not ' +
  'a true transition log, and are operational prompts for human action — NOT predictions and NOT ' +
  'algorithmic hiring/promotion/suitability verdicts. Missing dates abstain (null), never 0.';

export { PROVENANCE };

// ── alert-type catalog ───────────────────────────────────────────────────────
export type AlertType =
  | 'job_alert' | 'application_alert' | 'interview_alert' | 'offer_alert'
  | 'employer_alert' | 'recruiter_alert' | 'status_change';

export const ALERT_TYPES: AlertType[] = [
  'job_alert', 'application_alert', 'interview_alert', 'offer_alert',
  'employer_alert', 'recruiter_alert', 'status_change',
];

export type Severity = 'urgent' | 'attention' | 'info';
export const SEVERITY_RANK: Record<Severity, number> = { urgent: 3, attention: 2, info: 1 };

/** Time-window thresholds (days). Surfaced in /config so the windows are inspectable, not magic. */
export const THRESHOLDS = {
  recent_days: 7,        // "new" job / application window
  stalled_days: 14,      // active-stage candidate with no update => stalled
  interview_soon_days: 3,// upcoming-interview window
  offer_pending_days: 7, // offer with no decision older than this => urgent
} as const;

/** Deterministic stage → next-action map (workflow_notifications). Not a recommendation engine —
 *  a fixed operational mapping of "what a human does next at this stage". */
export const STAGE_NEXT_ACTION: Record<string, string> = {
  Applied: 'Review application and screen candidate',
  Screened: 'Schedule an interview',
  Interview: 'Record interview outcome / assessment',
  Assessment: 'Review assessment and decide on an offer',
  Offer: 'Await response and record the decision',
};

export const MS_PER_DAY = 86_400_000;

// ── alert shape ──────────────────────────────────────────────────────────────
export interface Alert {
  type: AlertType;
  /** fine-grained machine code, e.g. 'job.no_applicants', 'offer.pending'. */
  category: string;
  severity: Severity;
  subject_kind: 'job' | 'candidate' | 'employer';
  subject_id: string;
  subject_label: string | null;
  message: string;
  /** the WHY behind the alert (days_since_update, applicant_count, stage, …). */
  evidence: Record<string, unknown>;
  dedup_key: string;
}

export function dedupKey(type: AlertType, category: string, subjectId: string): string {
  return `${type}:${category}:${subjectId}`;
}

export function alert(a: Omit<Alert, 'dedup_key'>): Alert {
  return { ...a, dedup_key: dedupKey(a.type, a.category, a.subject_id) };
}

/** Sort alerts by severity (urgent first) then type order then subject id — fully deterministic. */
export function sortAlerts(alerts: Alert[]): Alert[] {
  const typeIdx = (t: AlertType) => ALERT_TYPES.indexOf(t);
  return [...alerts].sort(
    (a, b) =>
      (SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]) ||
      (typeIdx(a.type) - typeIdx(b.type)) ||
      a.category.localeCompare(b.category) ||
      a.subject_id.localeCompare(b.subject_id),
  );
}

// ── time helpers ─────────────────────────────────────────────────────────────
function toMs(v: unknown): number | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v as any);
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

/** Whole-day difference (now - ts) in days; null when the timestamp is absent/invalid. Positive =
 *  in the past, negative = in the future. Floor so the value is stable within a day. */
export function daysSince(nowMs: number, ts: number | null): number | null {
  if (ts == null) return null;
  return Math.floor((nowMs - ts) / MS_PER_DAY);
}

// ── notification evidence (composes 5.13 + scoped timestamp reads) ───────────
export interface CandidateTimes {
  applied_date: number | null;
  interview_date: number | null;
  decision_at: number | null;
  created_at: number | null;
  updated_at: number | null;
  offer_amount: number | null;
}
export interface JobTimes {
  created_at: number | null;
  updated_at: number | null;
  application_count: number | null;
}
export interface NotificationEvidence {
  dashboard: DashboardEvidence;
  candidateTimes: Map<string, CandidateTimes>;
  jobTimes: Map<string, JobTimes>;
  /** reference instant captured ONCE for this load (ms). Echoed as evaluated_at. */
  now: number;
}

/**
 * resolveNotificationEvidence — ONE read-only, never-throws load for every notification view.
 * Composes the 5.13 dashboard evidence (IDOR-scoped jobs/candidates/targets + status map + skills
 * ref + existence guard) and ADDS employer-scoped candidate/job timestamp maps + a single `now`.
 * compose-never-recompute; SENDS nothing; writes nothing.
 */
export async function resolveNotificationEvidence(
  pool: Pool,
  employerIdRaw: string,
): Promise<EngineResult<NotificationEvidence>> {
  const dash = await resolveDashboardEvidence(pool, employerIdRaw);
  if (!dash.ok) return dash;
  const employerId = dash.data.workforce.employer_id;
  const now = Date.now();

  const candidateTimes = new Map<string, CandidateTimes>();
  if (await relExists(pool, 'employer_candidates')) {
    try {
      const r = await pool.query(
        `SELECT id, applied_date, interview_date, decision_at, created_at, updated_at, offer_amount
           FROM employer_candidates WHERE employer_id = $1`,
        [employerId],
      );
      for (const row of r.rows) {
        const amt = row.offer_amount == null ? null : Number(row.offer_amount);
        candidateTimes.set(String(row.id), {
          applied_date: toMs(row.applied_date),
          interview_date: toMs(row.interview_date),
          decision_at: toMs(row.decision_at),
          created_at: toMs(row.created_at),
          updated_at: toMs(row.updated_at),
          offer_amount: Number.isFinite(amt as number) ? (amt as number) : null,
        });
      }
    } catch { /* degrade to empty timestamp map */ }
  }

  const jobTimes = new Map<string, JobTimes>();
  if (await relExists(pool, 'employer_jobs')) {
    try {
      const r = await pool.query(
        `SELECT id, created_at, updated_at, application_count
           FROM employer_jobs WHERE employer_id = $1`,
        [employerId],
      );
      for (const row of r.rows) {
        const ac = row.application_count == null ? null : Number(row.application_count);
        jobTimes.set(String(row.id), {
          created_at: toMs(row.created_at),
          updated_at: toMs(row.updated_at),
          application_count: Number.isFinite(ac as number) ? (ac as number) : null,
        });
      }
    } catch { /* degrade to empty timestamp map */ }
  }

  return ok({ dashboard: dash.data, candidateTimes, jobTimes, now });
}

// ── coverage helper ──────────────────────────────────────────────────────────
/** Coverage = present/total as a rounded pct; 0 total ⇒ 0 (no data, honest). */
export function coverage(present: number, total: number): number {
  return total > 0 ? round1((present / total) * 100) : 0;
}
