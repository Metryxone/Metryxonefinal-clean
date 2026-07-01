# CAPADEX 3.0 · Program 3 · Phase 3.4 — API Report (dimension 6 · apis)

> Deliverable 08 · Generated 2026-07-01T10:13:32.658Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:ba8e46395e4d, written 2026-07-01T10:13:32.658Z).
> Scope: CANDIDATE EXPERIENCE ONLY — launch/session/candidate-experience/question-delivery/timing/response/accessibility/delivery-modes/security/notifications/frontend/APIs from launch until final submission; NOT scoring/psychometrics/norms/AI-interpretation/reports/analytics (= Phase 3.5+).
> Honesty: the SEVEN certification dimensions (delivery_engine · candidate_experience · session_management · accessibility · security · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The unified delivery API surface at `/api/admin/assessment-delivery/*` (super-admin cert GETs) + `/api/assessment-delivery/enabled` (flag probe) + the mechanism GET/POST write paths (launch/upsert · sessions/start · responses/save · events/record · notifications/record).

## Launch-mode APIs (6)
**Launch modes:** 6 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (6 total).

| Capability | Status | Evidence present | Anchors |
|---|---|---|---|
| **Invite (candidate)** (`invite`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_launches, test_assignments |
| **Public link** (`public_link`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_launches |
| **Secure (tokenized) link** (`secure_link`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_launches |
| **Scheduled window** (`scheduled`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_launches |
| **Token / access code** (`token_access`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_launches |
| **QR-code entry** (`qr_code`) | SUPPORTED | true | services/assessment-delivery-mechanisms.ts, ad_launches |

## Mapping model (10 launch→submission steps)
Each step → the artifact it produces + the EXISTING engine/table it REUSES (reuse-before-build).

**Mapping status:** 9 SUPPORTED · 1 PARTIAL · 0 DEAD_END · 0 MISSING.

| Step | Target | Source (reused) | Status | Source present |
|---|---|---|---|---|
| **Authored assessment** (`authored_assessment`) | Assessment Builder (3.3) | `config/assessment-builder.ts` | SUPPORTED | true |
| **Question library** (`question_library`) | Question Management Platform (3.2) | `config/question-management-platform.ts` | SUPPORTED | true |
| **Personas** (`personas`) | Persona model | `config/customer-journey.ts` | SUPPORTED | true |
| **Lifecycle** (`lifecycle`) | Lifecycle stages | `lib/lifecycle.ts` | SUPPORTED | true |
| **Customer journey** (`customer_journey`) | Journey spine | `config/customer-journey.ts` | SUPPORTED | true |
| **Cohorts / batches** (`cohorts`) | Cohort gating | `services/cohort-gating.ts` | SUPPORTED | true |
| **Consent** (`consent`) | Consent ledger | `consent_logs` | SUPPORTED | true |
| **Notifications** (`notifications`) | Notification engine | `services/notification-engine-shared.ts` | SUPPORTED | true |
| **Audit trail** (`audit`) | Unified audit trail | `services/governance/unified-audit-trail.ts` | SUPPORTED | true |
| **Scoring handoff** (`scoring_handoff`) | Scoring Engine (3.5) | `config/assessment-delivery.ts` | PARTIAL | true |

## Contract
- Cert GETs are **read-only** (to_regclass / fs probes) — no DDL at read time.
- Mechanism POSTs are the **ONLY** DDL sites, gated by `assessmentDelivery` + super-admin.
- Flag OFF → `/enabled` 503, `/api/admin/assessment-delivery/*` 401, public-config `assessment_delivery:false`; delivery flow + schema byte-identical.
