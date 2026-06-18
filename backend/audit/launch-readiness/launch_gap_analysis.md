# MetryxOne — Launch Gap Analysis
### MX-LAUNCH-READINESS-01 · 18 June 2026

Blockers ranked by severity, each with evidence and which tier(s) it gates.
**P0** = blocks even a closed pilot · **P1** = blocks commercial/enterprise · **P2** = blocks public scale / quality debt.

---

## P0 — blocks even an Institution Pilot

### P0-1 · Crisis detection never reaches a human *(SAFETY)*
- **Evidence:** `pragati.ts checkEscalation` flags self-harm signals and steers the conversation, but **no code emits an email/admin-inbox alert**. `capadex_risk_flags`=0.
- **Impact:** Legal/safety liability the moment a real (especially student) user is at risk.
- **Gates:** Institution Pilot, all tiers.

### P0-2 · Email is a single point of failure for login itself
- **Evidence:** OTP/MFA-gated auth via Zoho (`email.ts`); fails silently with `console.error` if creds missing; Zoho absent in dev, **prod status unverified**. No fallback channel.
- **Impact:** If email is down/misconfigured in prod, the **entire user base incl. super-admin is locked out**.
- **Gates:** Institution Pilot, all tiers.

### P0-3 · Activation data is not in the live database
- **Evidence:** Live DB: `mei_scores`=0, `mei_user_recommendations`=0, `ont_competencies`=0, `ont_roles`=0, `cg_user_recommendations`=8, `career_outcomes`=0. The #17/#18/#19 backfills ran in **isolated task environments**; only their code/migrations merged.
- **Impact:** A live user gets the **pre-activation** product despite "activated" code. Any "activated intelligence" claim is false until scripts are run against prod and verified.
- **Gates:** Institution Pilot (quality), all tiers.

### P0-4 · Production database isolation unconfirmed
- **Evidence:** `replit.md` + audit scripts indicate dev and prod **share `DATABASE_URL`**.
- **Impact:** Dev activity can mutate live pilot data; no clean blast radius. Must verify publishing provisions an isolated prod DB before any external user.
- **Gates:** Institution Pilot, all tiers.

---

## P1 — blocks Commercial Pilot & Enterprise

### P1-1 · Payments in demo mode, no production keys
- **Evidence:** `capadex-payments.ts` + `commercial/razorpay-client.ts` default to `DEMO_*` without `RAZORPAY_KEY_ID`; client explicitly warns "TEST KEYS ONLY".
- **Impact:** No real transaction can complete. `capadex_payments`=0.
- **Gates:** Commercial Pilot+.

### P1-2 · Commercial flags OFF → entitlement is a pass-through
- **Evidence:** `FF_COMMERCIAL_ACTIVATION`=false, `FF_COMMERCIAL_ENTITLEMENT_ENFORCEMENT`=false in `feature-flags.ts`; `requireEntitlement` (fail-closed by design) is transparent while off.
- **Impact:** No paid/unpaid distinction. Flipping flags **without** prod keys would fail-closed and block everyone.
- **Gates:** Commercial Pilot+.

### P1-3 · Money paths untested end-to-end
- **Evidence:** Prior security audit (WC-C8A) left MFA e2e + Razorpay smoke test outstanding; `comm_*`=0, `subscription_packages`=0.
- **Impact:** First real payment is also the first real test. Unacceptable for a paid pilot.
- **Gates:** Commercial Pilot+.

### P1-4 · No scientific validity evidence
- **Evidence:** No reliability/validity studies; cohort benchmarks seeded; outcome-validation framework (Brier/ECE/isotonic in `employer-tig.ts`) exists but **0 realized outcomes**; `career_outcomes`=0.
- **Impact:** Cannot defend scores as valid to an enterprise buyer or regulator. Language must stay developmental, not predictive.
- **Gates:** Enterprise, Public (and constrains Commercial claims).

### P1-5 · Operational hardening gaps
- **Evidence:** No `/health` on primary backend; **no rate limiting** on OTP/login or unauthenticated `/api/signals/ingest` (DB-poisoning vector); audit logging swallows its own errors; **CSP disabled** in `index.ts`.
- **Impact:** Abuse, silent security-log loss, no liveness probe.
- **Gates:** Enterprise+ (rate-limit + signals also touch any public exposure).

---

## P2 — blocks Public Launch / quality debt

### P2-1 · No support ticketing
- **Evidence:** `SupportPage.tsx` + `mailto:` only; no `/api/support` backend, no admin ticket workflow.
- **Impact:** Support vacuum at consumer scale.
- **Gates:** Public.

### P2-2 · Institution self-signup missing
- **Evidence:** No public institution-registration route; SuperAdmin must provision.
- **Impact:** Concierge-only; doesn't scale to self-serve.
- **Gates:** Public (acceptable for pilot/enterprise concierge).

### P2-3 · Content/ontology sub-scale
- **Evidence:** Occupation graph 200 roles vs O*NET ~1000; competency ontology starter-grade.
- **Impact:** Coverage gaps surface as "unknown role" at scale.
- **Gates:** Public quality.

### P2-4 · Intelligence depth inert
- **Evidence:** CAPADEX patterns/composites/recommendations/interventions = 0 live; 1-signal-per-session ceiling noted in prior audit.
- **Impact:** Marketed "deep behavioural intelligence" under-delivers until populated.
- **Gates:** Public quality, Enterprise claims.

### P2-5 · No app-level backup/rollback
- **Evidence:** No code-level backup orchestration (platform checkpoints aside).
- **Gates:** Enterprise/Public ops maturity.

### P2-6 · Backend runs uncompiled `tsx` in prod *(accepted risk, not a blocker)*
- **Evidence:** prod run = `npx tsx index.ts`; established convention (only real build gate is the frontend vite build).
- **Impact:** Monitored perf/stability risk; do **not** force a `tsc` gate. Tracked for awareness.

---

## Blocker → tier matrix

| Blocker | Inst. Pilot | Comm. Pilot | Enterprise | Public |
|---|:---:|:---:|:---:|:---:|
| P0-1 Crisis notify | ✋ | ✋ | ✋ | ✋ |
| P0-2 Email SPOF | ✋ | ✋ | ✋ | ✋ |
| P0-3 Activation in live DB | ⚠️ | ✋ | ✋ | ✋ |
| P0-4 DB isolation | ✋ | ✋ | ✋ | ✋ |
| P1-1 Prod payment keys | — | ✋ | ✋ | ✋ |
| P1-2 Entitlement flags | — | ✋ | ✋ | ✋ |
| P1-3 Money e2e tests | — | ✋ | ✋ | ✋ |
| P1-4 Scientific validity | — | ⚠️ | ✋ | ✋ |
| P1-5 Ops hardening | ⚠️ | ⚠️ | ✋ | ✋ |
| P2-1 Ticketing | — | — | ⚠️ | ✋ |
| P2-2 Self-signup | — | — | — | ✋ |
| P2-3/4 Content + depth | — | ⚠️ | ✋ | ✋ |

✋ hard blocker · ⚠️ serious risk / quality gate · — not gating at this tier.
