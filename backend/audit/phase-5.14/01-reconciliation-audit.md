# Phase 5.14 — Notifications & Workflows · Reconciliation Audit

**Engine version:** 5.14.0
**Date:** 2026-06-21
**Status:** COMPLETE — smoke 37/37 PASS · vite build PASS · flag-OFF 503 verified
**Contract:** additive · flag-gated (default OFF) · compose-never-recompute · GET-never-writes (PURE READ; NEVER sends) · super-admin gated · IDOR employer-scoped · never-throws · honesty-first

---

## 1. Scope

A PURE read/compose layer that **DERIVES** operational notification items from **operator-recorded**
employer evidence. It composes the Phase 5.13 dashboard evidence (`resolveDashboardEvidence` →
5.12 `resolveWorkforceEvidence`) and adds **one scoped timestamp read** (candidate
applied/interview/decision/updated + job created/updated maps) in the 5.14 shared layer only.

Supports the **7 alert types**:

| Alert type | Builder | Categories | Composition / timestamp source |
| --- | --- | --- | --- |
| Job | `buildJobAlerts` | `job.no_applicants`, `job.newly_posted` | job status (`normJobStatus`) + applicant counts + `jobTimes.created_at` |
| Application | `buildApplicationAlerts` | `application.new`, `application.awaiting_screening` | `candidateTimes.applied_date` + `canonStage` |
| Interview | `buildInterviewAlerts` | `interview.upcoming`, `interview.outcome_overdue` | `candidateTimes.interview_date` + stage |
| Offer | `buildOfferAlerts` | `offer.pending` | stage Offer + `decision_at` null + `updated_at` staleness |
| Status Changes | `buildStatusChangeAlerts` | `status.decision_recorded`, `status.recently_updated` | `candidateTimes.decision_at` / `updated_at` |
| Employer | `buildEmployerAlerts` | `employer.jobs_without_applicants`, `employer.unbound_candidates`, `employer.open_jobs_summary` | job/applicant + unbound aggregates |
| Recruiter | `buildRecruiterAlerts` | `recruiter.stalled_candidates`, `recruiter.offers_pending`, `recruiter.interviews_upcoming` | active-stage aggregates over timestamps |

**Deliverables (composers):**
- `notification_engine` — `buildNotificationsFromEvidence` → the 7-builder alert feed (sorted by type → severity → recency) + `summary` (by_type, by_severity, timestamp_coverage).
- `workflow_notifications` — `buildWorkflowNotificationsFromEvidence` → per active-pipeline candidate the deterministic `next_action` (stage→action) + `stalled` flag (null when no `updated_at`) + by_stage + update_coverage.
- `communication_engine` — `buildCommunicationsFromEvidence` → one message **preview** per alert (audience employer|recruiter, `delivered:false`); **NEVER sends**, **no candidate PII** (id/role/stage only — no email/name/phone).
- `overview` — all three from ONE evidence load.

---

## 2. Files

| File | Role |
| --- | --- |
| `services/notification-engine-shared.ts` | `NOTIFICATION_ENGINE_VERSION 5.14.0`; `NOTIFICATION_DISCLAIMER`; re-export `PROVENANCE`; `ALERT_TYPES[7]`; `SEVERITY_RANK`; `THRESHOLDS` (recent_days 7, stalled_days 14, interview_soon_days 3, offer_pending_days 7); `STAGE_NEXT_ACTION`; `Alert` type + `alert()` factory + `dedupKey` + `sortAlerts`; `daysSince`; `coverage`; `NotificationEvidence`; `resolveNotificationEvidence` (composes `resolveDashboardEvidence` + scoped candidate/job timestamp maps + **single captured `now`**) |
| `services/notification-engine.ts` | 7 alert builders + `buildNotificationsFromEvidence`/`buildWorkflowNotificationsFromEvidence`/`buildCommunicationsFromEvidence`/`buildNotificationOverviewFromEvidence` + 4 pool wrappers (single evidence load) |
| `routes/notifications.ts` | base `/api/notifications`; GET-only; `_meta/status` + `/config` + `/catalog` literal BEFORE `/employer/:employerId/{notifications,workflows,communications,overview}` |
| `config/feature-flags.ts` | `notificationEngine: false` + `isNotificationEngineEnabled()` |
| `routes.ts` | import + `registerNotificationRoutes(app, concernsPool, requireAuth, requireSuperAdmin)` (after employer-dashboards) |
| `scripts/smoke-notification-engine.ts` | 37-assertion seeded smoke (self-cleaning) |

---

## 3. Contract reconciliation

| Contract clause | How satisfied | Evidence |
| --- | --- | --- |
| **Additive** | No edits to 5.13/5.12 engines; new files only + 2 single-line wiring inserts + 1 flag + 1 helper. | git diff |
| **Flag-gated, default OFF** | `notificationEngine:false`; `gate` mw returns 503 before any auth/DB touch. | live `503` on `_meta/status` + `/config`; smoke `flag-OFF: HTTP overview 503` |
| **Compose-never-recompute** | Builders consume `resolveNotificationEvidence` (wraps `resolveDashboardEvidence` → `resolveWorkforceEvidence`) + a scoped timestamp read. No new scoring; only derivations/folds over existing evidence + timestamps. | engine imports |
| **GET-never-writes (PURE READ; NEVER sends)** | No migration, no `ensure*Schema`, no POST. Reads degrade via `resolveWorkforceEvidence` to_regclass probe. communication previews carry `delivered:false`; no email/SMS/push code path exists. | smoke `pg_class count unchanged` + `employer row counts unchanged` + `delivery=none` + every message `delivered=false` |
| **Super-admin gated** | `guards = [gate, requireAuth, requireSuperAdmin]` on every route. | routes file |
| **IDOR employer-scoped** | Every read scoped by `employer_id`; timestamp maps keyed to that employer's candidates/jobs; unbound candidate ⇒ no foreign job leak. | smoke: EMP sees 9 cands / 3 jobs, no EMP2 leak; `cand_other` never appears |
| **Never-throws EngineResult** | `compute*` return `EngineResult`; unknown employer ⇒ `not_found`, never throws. | smoke `not_found: unknown employer` |
| **Honesty-first** | Coverage axis incl. **timestamp coverage**; `unmeasured = null` NOT 0 (no `updated_at` ⇒ `stalled:null`, abstains from stalled count); `provenance: operator_recorded_composite`; disclaimer on every payload; `now` captured ONCE per evidence load ⇒ determinism. | smoke timestamp_coverage 8/9; `cand_noupdate stalled=null`; provenance+disclaimer; determinism byte-identical |
| **Operational reminders, not verdicts** | Alerts are developmental/operational reminders — NOT predictions/hiring/promotion/suitability verdicts. Disclaimer states this. | `NOTIFICATION_DISCLAIMER` |

---

## 4. Honesty axes — worked example (smoke fixture)

EMP fixture: 9 candidates / 3 jobs (JOB_NEW open+recent, JOB_EMPTY open+stale+0 applicants, JOB_CLOSED), 1 unbound (job belongs to EMP2), 1 candidate with NO `updated_at`. `now` captured once.

- **Feed total 21** — by_type job 2 / application 4 / interview 2 / offer 1 / employer 3 / recruiter 3 / status 6; severities urgent 3 / attention 9 / info 9.
- **Job** — `job.no_applicants` fires for JOB_EMPTY only (open + 0 applicants); `job.newly_posted` for JOB_NEW only (created 2d ago); JOB_CLOSED excluded.
- **Application** — `application.new` 2 (applied within 7d); `application.awaiting_screening` 2 (stage Applied).
- **Interview** — `interview.upcoming` 1 (date within 3d); `interview.outcome_overdue` 1. **Honest gate fix:** overdue fires ONLY while the candidate still sits at the **Interview** stage; an Offer/Hired candidate whose interview date passed does NOT fire (stage advancement implicitly records the outcome — firing there would be a false positive against operator-recorded progress).
- **Offer** — `offer.pending` 1, `urgent` (stage Offer, no `decision_at`, `updated_at` > 7d).
- **Status** — `status.decision_recorded` 1 (`decision_at` present); `status.recently_updated` 5 (updated within 7d, no decision).
- **Employer** — `jobs_without_applicants` (JOB_EMPTY), `unbound_candidates` (1), `open_jobs_summary` (info).
- **Recruiter** — `stalled_candidates` 1 urgent (active stage, no update > 14d), `offers_pending` 1, `interviews_upcoming` 1.
- **Workflows** — 8 active (Hired excluded); by_stage Applied 2 / Screened 3 / Interview 2 / Offer 1 / Assessment 0; stalled 1; update_coverage 87.5% (the no-`updated_at` candidate **abstains** → `stalled:null`, not assumed fresh).
- **Communications** — 21 previews (one per alert), audience employer 5 / recruiter 16; all `delivered:false`; no candidate email in payload (employer scope id is email-form by seed convention and is scope, not candidate contact).
- **timestamp_coverage** — 8/9 = 88.9% (the no-`updated_at` candidate is honestly uncounted, not zero-filled).

---

## 5. Verification

- **Smoke:** `cd backend && npx tsx scripts/smoke-notification-engine.ts` → **37 passed, 0 failed** (each alert type on its fixture, stalled/upcoming windows, status decisions, IDOR scoping, timestamp-coverage abstention, NEVER-sends, GET-never-writes pg_class + row snapshot, determinism from one evidence load, flag-OFF 503).
- **Build:** `cd frontend && npx vite build` → PASS.
- **Flag-OFF live:** `GET /api/notifications/_meta/status` + `/config` → `503 {flag:'notificationEngine', env:'FF_NOTIFICATION_ENGINE'}`.

---

## 6. Honest residuals / non-claims

- Dev substrate is empty by default; all numbers above are from the **self-seeded** `@example.com` fixture, removed on exit.
- This layer **DERIVES** reminders from existing operator-recorded timestamps; it introduces no new persisted state, no scoring model, and **sends nothing** — `communication_engine` produces previews only (`delivered:false`).
- Timestamp coverage is reported as a first-class Coverage axis; a candidate with no `updated_at` abstains (`stalled:null`) rather than being assumed fresh or stale.
- `now` is captured ONCE per evidence load, so the same evidence yields byte-identical output (the pool wrappers each capture a fresh `now`; determinism is asserted at the evidence→build boundary).
- Outputs are operational/developmental reminders only — NOT predictions, NOT hiring/promotion/suitability verdicts.
