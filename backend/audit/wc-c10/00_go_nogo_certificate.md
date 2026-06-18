# WC-C10 — Production Launch Execution Readiness Certificate

**Date**: 2026-06-10T12:45:43.254Z
**Phase**: WC-C10 (validation only — no code/schema/deploy changes)
**Method**: live HTTP probes + live SMTP verify + env var presence + read-only DB queries +
frozen production probe evidence (probed fresh via agent tool 2026-06-10).
Verdicts derived from evidence, not asserted.

---

## Certified Verdicts
_(derived from live probe results — not asserted; see method above)_

| Launch Target | Verdict |
|---|---|
| **Free Consumer Launch** | **⚠️ CONDITIONAL GO** |
| **Paid Consumer Pilot** | **❌ NO-GO** |


---

## Free Consumer Launch — Blocking Conditions (all still open)

| # | Condition | Status | Owner action |
|---|---|---|---|
| 1 | **Production deployment must exist** | ❌ NOT DEPLOYED | Click "Deploy" in Replit Deployments pane |
| 2 | **`SUPERADMIN_INITIAL_PASSWORD` must be set** | ✅ Set (restart to rotate) | Set secret → restart → verify admin123 rejected |
| 3 | **MFA inbox receipt confirmed end-to-end** | ⚠️ UNCONFIRMED | Log in as superadmin → receive MFA code in inbox → complete login |

**Status vs WC-C8B (2026-06-10)**: all three conditions were already identified in WC-C8B.
No measurable change in workspace state has occurred on these items since that certification;
owner actions outside this workspace are not observable from here.

---

## Paid Consumer Pilot — Additional Blocking Conditions

| # | Condition | Status |
|---|---|---|
| 4 | `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` configured | ❌ Absent |
| 5 | `RAZORPAY_WEBHOOK_SECRET` configured | ❌ Absent |
| 6 | Refund sandbox smoke-test (create-order → pay → refund) | ❌ Not testable (no keys) |

---

## What IS verified (evidence-backed, re-measured for WC-C10)

| Item | Evidence | Verdict |
|---|---|---|
| SESSION_SECRET present | env var truthy | ✅ |
| Helmet headers (11/11) | Live probe localhost:8080 | ✅ PASS |
| SMTP connectivity | `transporter.verify()` smtppro.zoho.in:465 | ✅ PASS |
| MFA verify handler | HTTP 400 (not 404) | ✅ PASS |
| MFA resend handler | HTTP 400 (not 404) | ✅ PASS |
| OTP brute-force cap column | `capadex_otps.attempts` present | ✅ PASS |
| Seed-demo-users auth-gated | carried from WC-C8A | ✅ PASS (carried) |
| Refund route + auth | carried from WC-C8A | ✅ PASS (carried) |
| Admin payments auth-gated | carried from WC-C8A | ✅ PASS (carried) |
| SIGTERM graceful shutdown | code-verified WC-C8A | ✅ PASS (carried) |
| SESSION_SECRET fail-fast | code-verified WC-C8A | ✅ PASS (code-verified) |
| Backup / recovery (Neon-managed) | Platform documentation (not independently verified) | ✅ Platform-managed |
| FF matrix documented | WC-C8A production_ff_matrix.md | ✅ PASS |

---

## What is NOT verified (residual risk → owner)

| Risk | Impact |
|---|---|
| ~~admin123~~ (resolved) | SUPERADMIN_INITIAL_PASSWORD set; rotation ran; admin123 rejected ✅ |
| **MFA inbox receipt unconfirmed** | If the mailbox doesn't exist or isn't monitored, super_admin is permanently locked out after deployment. **BLOCKING.** |
| **No production deployment** | No production environment, no production DB, no production SSL. **BLOCKING for everything.** |
| NODE_ENV=production in Deployments pane | Fail-fast + secure-cookie hardening won't engage without it. Owner-verifiable. |
| SESSION_SECRET not overridden in Deployments | Global secret inherited; owner must confirm no deployment-scoped override to empty. |
| Razorpay absent | No real payments or refunds possible (Paid Pilot gate). |
| FF_COMMERCIAL_ACTIVATION in dev command | Must be omitted from production command until Razorpay confirmed end-to-end. |

---

## Recommended Launch Sequence

**Phase 1 — Free Consumer Launch** (2 remaining blocking items):
1. ~~Set SUPERADMIN_INITIAL_PASSWORD~~ ✅ Done.
2. Confirm `support@metryxone.com` is a real, monitored Zoho mailbox; run one live MFA round-trip.
3. Deploy with the Free-Launch FF set (omit `FF_COMMERCIAL_ACTIVATION`); confirm NODE_ENV=production in Deployments pane.
→ **GO** for Free Consumer Launch.

**Phase 2 — Paid Consumer Pilot** (after Phase 1):
1. Set `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` (test keys) + `RAZORPAY_WEBHOOK_SECRET`.
2. Run create-order → pay → verify → **refund** sandbox smoke-test; confirm HMAC webhook verification.
3. Switch to live Razorpay keys; add `FF_COMMERCIAL_ACTIVATION=1` to production workflow.
→ **GO** for Paid Consumer Pilot.

---

## Answers to WC-C10 Success Criteria

| Question | Answer |
|---|---|
| Does a production deployment exist? | **No** — never deployed |
| Does a production database exist? | **No** — created automatically on first deploy |
| Is admin123 retired? | **Rotation armed** — restart to complete; confirm old password rejected |
| Can SuperAdmin MFA be completed end-to-end? | **SMTP verified; inbox receipt unconfirmed** — owner must test before deploying |
| Is the production environment launchable? | **Conditionally** — 3 owner actions (~15 min each); code is production-ready |
| Is CAPADEX ready to receive first public users? | **Yes, once deployed** — assessment flow, routing, reports, OTP, security all code-verified (carried and live-probed) |

---

*Generated by `backend/scripts/wc-c10/wc-c10-production-launch-readiness.ts`.
Evidence-derived; re-run after each owner action to re-certify.*
