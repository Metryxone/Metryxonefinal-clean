# MetryxOne — Launch Roadmap
### MX-LAUNCH-READINESS-01 · 18 June 2026

Sequenced path from today (3 NO GO / 1 CONDITIONAL GO) to each launch tier. Effort bands are indicative (S ≤1d · M 2–5d · L 1–2wk · XL >2wk) and assume the existing engines stay as-is (this is activation + hardening, not new science).

---

## Phase 0 — Unlock the Institution Pilot (CONDITIONAL GO → GO)
*Goal: a safe, concierge-onboarded pilot with 1–3 institutions.*

| Step | Blocker | Effort |
|---|---|:---:|
| 0.1 Wire crisis escalation → human (email/admin inbox) + on-call runbook | P0-1 | M |
| 0.2 Verify `ZOHO_*` in prod; add a non-email fallback or alert if mail send fails | P0-2 | S–M |
| 0.3 Confirm publishing provisions an **isolated production DB**; document it | P0-4 | S |
| 0.4 Run activation backfills against the **live** DB (mei, career recs, ontology seed) + verify counts > 0 | P0-3 | S |
| 0.5 Concierge onboarding checklist for institution provisioning (SuperAdmin flow) | P2-2 (pilot scope) | S |
| 0.6 Smoke-test the full student journey on prod (assessment → report → email) | P0-2/P0-3 | M |

**Exit:** safety alerting live · email verified · prod DB isolated · live DB activated · one institution end-to-end. → **Institution Pilot = GO.**

> A **narrow Employer usage pilot** can run in parallel on the same Phase-0 fixes (Employer runtime is already self-serve + end-to-end), provided no real payment is taken yet.

---

## Phase 1 — Unlock the Commercial Pilot (NO GO → CONDITIONAL GO)
*Goal: take real money for CAPADEX stages / packages from a small cohort.*

| Step | Blocker | Effort |
|---|---|:---:|
| 1.1 Add production Razorpay keys; confirm live-mode order→verify→webhook | P1-1 | M |
| 1.2 Seed real `subscription_packages` / `comm_*` with priced, valid SKUs | P1-1 | M |
| 1.3 Turn on `FF_COMMERCIAL_ACTIVATION` + `FF_COMMERCIAL_ENTITLEMENT_ENFORCEMENT`; verify fail-closed blocks unpaid + allows paid | P1-2 | M |
| 1.4 End-to-end money-path tests: MFA login e2e + Razorpay live smoke (success, failure, refund) + entitlement grant | P1-3 | M–L |
| 1.5 Activate GST/invoicing rules for legal compliance (IN) | P1-1 | M |
| 1.6 Rate-limit OTP/login + payment endpoints | P1-5 | S–M |

**Exit:** a real test customer completes a real purchase and gains gated access; refunds work. → **Commercial Pilot = CONDITIONAL GO** (GO after the cohort runs clean).

---

## Phase 2 — Unlock Enterprise Launch (NO GO → CONDITIONAL GO)
*Goal: a contracted enterprise/institution with SLAs.*

| Step | Blocker | Effort |
|---|---|:---:|
| 2.1 Begin scientific validity program: reliability + concurrent/predictive validity; keep language developmental until evidence exists | P1-4 | XL |
| 2.2 Activate the outcome-validation loop with **real** realized outcomes; report Brier/ECE honestly (heuristic until ≥30) | P1-4 | L (data-bound) |
| 2.3 Ops hardening: `/health` + uptime monitoring, structured logging/alerting, audit-log failure surfacing, CSP enabled + tuned | P1-5 | L |
| 2.4 Secure/harden `/api/signals/ingest` (auth or strict rate-limit + abuse detection) | P1-5 | M |
| 2.5 Backup/restore + rollback runbook beyond platform checkpoints | P2-5 | M |
| 2.6 Populate intelligence depth (CAPADEX patterns/composites/recs) + scale ontology toward O*NET | P2-3/4 | XL |

**Exit:** defensible validity story + monitored, hardened ops + isolated prod + depth populated. → **Enterprise = CONDITIONAL GO.**

---

## Phase 3 — Unlock Public Launch (NO GO → CONDITIONAL GO)
*Goal: open self-serve signup at consumer scale.*

| Step | Blocker | Effort |
|---|---|:---:|
| 3.1 Support ticketing backend + admin workflow (replace `mailto:`) | P2-1 | L |
| 3.2 Institution self-signup + self-serve onboarding | P2-2 | L |
| 3.3 Load/scale testing; verify shared-nothing prod DB under concurrency | P0-4/perf | L |
| 3.4 Content coverage to public quality (roles/competencies/signals) | P2-3/4 | XL |
| 3.5 Mature safety operations (24/7 crisis triage, escalation SLAs) | P0-1 (scale) | L |
| 3.6 Public trust: privacy policy, data-retention, consent, abuse handling at scale | new | L |

**Exit:** self-serve onboarding + real support + safety ops + scale-tested + content-complete. → **Public = CONDITIONAL GO.**

---

## Critical path (do these first, in order)
1. **P0-1 crisis notify** → safety unblocks everything.
2. **P0-2 Zoho verify** → prevents login lockout.
3. **P0-4 DB isolation** → clean blast radius for any external user.
4. **P0-3 run live backfills** → product is actually activated for pilot users.
5. → **Launch the Institution Pilot (concierge) and/or Employer usage pilot.**
6. Then Phase 1 to monetize.

> Honesty reminder: do **not** market "activated intelligence", "validated scores", or "live payments" until each is verified in the **production** database with real data. Seeded ≠ computed ≠ validated; demo-mode ≠ live.
