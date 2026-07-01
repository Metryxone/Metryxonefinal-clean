# CAPADEX 3.0 · Program 3 · Phase 3.4 — Remaining Gaps (OPEN Future/Low · engineering-closed via reuse)

> Deliverable 11 · Generated 2026-07-01T09:39:51.721Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:6c0930a1b4b1, written 2026-07-01T09:39:51.722Z).
> Scope: CANDIDATE EXPERIENCE ONLY — launch/session/candidate-experience/question-delivery/timing/response/accessibility/delivery-modes/security/notifications/frontend/APIs from launch until final submission; NOT scoring/psychometrics/norms/AI-interpretation/reports/analytics (= Phase 3.5+).
> Honesty: the SEVEN certification dimensions (delivery_engine · candidate_experience · session_management · accessibility · security · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

**4 OPEN gaps: 0 Launch-Critical · 0 High · 0 Medium · 1 Low · 3 Future.**

The seven former engineering gaps (AD-1..AD-7) are **ENGINEERING-CLOSED** via REUSE-before-build, each gated by `assessmentDelivery` (byte-identical OFF incl. schema; DDL only on the flag-gated write paths). The remaining OPEN gaps are genuine Future/Low deferrals — **none Launch-Critical**. What remains beyond them is **ADOPTION** — real delivered-session volume — a usage axis reported SEPARATELY, NEVER a gap. Coverage⟂Confidence⟂Adoption never composited; never fabricated.

## Open gaps
### Low
#### GAP-AD-4 — Browser lockdown / hardware proctoring (webcam, screen-lock, secure browser) is a placeholder — copy-prevention + audit events exist, but no OS-level lockdown.
- **Dimension**: security

### Future
#### GAP-AD-1 — Coding-assessment delivery mode (in-browser code editor + execution sandbox) is a placeholder — no runner at delivery time.
- **Dimension**: delivery_engine

#### GAP-AD-2 — Video / simulation delivery modes are placeholders — recorded-response + interactive-simulation runners are not first-class here.
- **Dimension**: delivery_engine

#### GAP-AD-3 — Real adaptive per-response routing depends on the Phase 3.5 scoring engine; delivery exposes the seam but cannot route on ability yet.
- **Dimension**: delivery_engine

## Resolved gaps (7) — engineering-closed via reuse
Severity of resolved work: 0 Launch-Critical · 2 High · 3 Medium · 2 Low · 0 Future.

| ID | Severity (was) | Dimension | Gap | Mechanism (reuse-before-build) |
|---|---|---|---|---|
| **AD-1** | High | `delivery_engine` | No unified launch record across invite/link/secure/scheduled/token/qr. | ad_launches overlay + composeLaunchModes (reuse test_assignments + cohort gating). |
| **AD-2** | High | `session_management` | No unified session lifecycle (resume/pause/auto-save/recover/reconnect/timeout/expiry/multi-device). | ad_sessions overlay + session mechanisms (reuse capadex_sessions + express_sessions). |
| **AD-3** | Medium | `candidate_experience` | Candidate journey (welcome→consent→verify→practice→completion) not certified as one canonical flow. | 11-step CANDIDATE_EXPERIENCE_STEPS catalog over the reused player + consent ledger. |
| **AD-4** | Medium | `security` | Delivery security events (secure session/validation/multi-login/copy-prevention) not captured as a delivery-scoped ledger. | ad_events overlay + composeSecurityControls (reuse security-middleware + unified audit trail). |
| **AD-5** | Medium | `apis` | No unified delivery API surface (launch/session/response/progress/submission/notification). | routes/assessment-delivery.ts composing the existing runtime routes under one gated surface. |
| **AD-6** | Low | `frontend` | No single delivery certification console. | components/superadmin/AssessmentDeliveryPanel.tsx reusing the candidate player surfaces. |
| **AD-7** | Low | `apis` | Delivery notifications (invitation/reminder/timeout/completion) not wired to a delivery-scoped ledger. | ad_notifications overlay + composeNotificationTypes (reuse notification-engine-shared). |

## Adoption (SEPARATE axis, never a gap)
ADOPTION is real delivered-session volume across the ad_* overlay. It is a usage axis reported SEPARATELY from engineering closure — NEVER a gap, NEVER fabricated. null (unreadable) ≠ 0 (empty).

| Overlay | Measured |
|---|---|
| Launches | — (active — · scheduled —) |
| Sessions | — (active — · submitted — · resumed —) |
| Responses | — (final — · drafts — · sessions-with-responses —) |
| Events | — (security — · sessions —) |
| Notifications | — (sent — · launches —) |

_All `—` values are honest null (overlay unreadable/not yet written while OFF), NEVER fabricated as adopted._
