# 18 · Workflow Validation

Validates the core operational workflows for completeness, idempotency, and dead-ends.

| Workflow | Path (repo) | Completeness | Notes |
|---|---|---|---|
| Assessment session | register→assess→score→signal pipeline→report | **IMPLEMENTED** | postCompletion hooks fire pipeline fire-and-forget; idempotent session id (uuid). |
| Hiring funnel | post→assess→interview→shortlist→offer→outcome | **IMPLEMENTED** | 9-stage; write-once snapshot; `ON CONFLICT` idempotency; job-store split (posting vs employer_jobs) bridged. |
| Career journey | discovery→builder→readiness→roadmap→intervention | **IMPLEMENTED** (dead-ends) | 8/9 stages built; some dead-ends per memory (career-discovery, launchpad). |
| Intervention chain | signal→intervention→mentor/M5 | **IMPLEMENTED** | chain trigger every session (LBI); growth-plan exists in M5 (wire, don't rebuild). |
| Report generation | request→build→render PDF→deliver | **IMPLEMENTED** | fire-and-forget via setImmediate; pdfkit; honest-state on missing data. |
| Onboarding/registration | register→onboard→profile | **IMPLEMENTED** | account_type server-controlled; CSRF + rate-limit + lockout. |
| Payment/checkout | create→pay→webhook→entitlement | **PARTIAL** | webhook fails closed; package→entitlement mapping gap. |
| Growth loop (assess→intervene→**re-test**) | — | **MISSING** | no mandatory re-assessment closing the loop (GAP-P1). |
| Continuous engagement | notifications→nudge→return | **PARTIAL** | notifications are the weakest per-persona link (06/07). |

## Workflow findings (honest)
- **Transactional workflows are complete and idempotent** (assessment, hiring, report, payment-up-to-
  entitlement). Engineering quality here is high.
- **Two workflows are genuinely incomplete:** (1) the **growth loop** (no re-test) and (2) **continuous
  engagement** (notifications/nudges thin). Both trace to GAP-P1 and the per-persona notification weakness.
- **Dead-ends exist in the career journey** (documented), where a stage produces output but no clear next
  action — a UX/journey completeness issue, not a broken transaction.
- **No duplicate/conflicting workflows** for the same outcome (the `-v2` engines are duplication *candidates*,
  not active competing workflows).

## Verdict
**Workflows: IMPLEMENTED for transactions; INCOMPLETE for the growth loop & continuous engagement.** Highest-
value workflow enhancement = close the assess→intervene→re-test loop (reuses existing assessment + intervention
engines).
