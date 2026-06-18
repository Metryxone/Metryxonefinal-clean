# MetryxOne — Launch Readiness Report
### MX-LAUNCH-READINESS-01 · 18 June 2026

**Question.** Is MetryxOne ready for (1) Institution Pilot, (2) Commercial Pilot, (3) Enterprise Launch, (4) Public Launch?

**Method.** Evidence-based, no fabrication. Live database counts (18 Jun 2026, the shared dev/prod DB) + four code-area explorers (commercial, support/ops, runtime, deployment/superadmin) + reuse of the `worldclass-intelligence` and `core-business` audits. Three axes are kept separate throughout:
- **Structural** — code/engine exists and runs.
- **Activation** — real data/customers flow through it *in the live database*.
- **Validity** — outputs are empirically derived and/or validated against ground truth.

Readiness levels per area/dimension: **Launch Ready · Pilot Ready · Beta Ready · Not Ready.**

---

## FINAL VERDICTS

| Launch tier | Verdict | One-line reason |
|---|:---:|---|
| **Institution Pilot** | **CONDITIONAL GO** | Institution runtime is structurally solid and a concierge-onboarded pilot is feasible — **but four conditions must clear first: (1) crisis-escalation must notify a human, (2) Zoho email verified in prod, (3) production DB isolation confirmed, (4) activation backfills run against the live DB and verified.** |
| **Commercial Pilot** | **NO GO** | Payments run in **demo mode** (no prod keys), both commercial flags are **OFF**, entitlement enforcement is a **pass-through**, and MFA-login + Razorpay paths are **untested end-to-end**. The platform cannot reliably take money today. |
| **Enterprise Launch** | **NO GO** | No scientific validity evidence, outcome-validation loop un-activated, operational/support immaturity (no health checks, no rate limiting, crisis no-notify), shared dev/prod DB. |
| **Public Launch** | **NO GO** | All of the above **at scale**, plus a support vacuum (no ticketing) and a safety liability (self-harm detection with no human alert). |

> **Most defensible near-term move:** a **concierge Institution Pilot** *or* a **narrow Employer usage pilot** (the Employer runtime is the single most launch-ready surface) — both gated on the safety, email, and DB-isolation fixes. Taking real money (Commercial Pilot) is the furthest off.

---

## The cross-cutting findings that drive every verdict

### 1. Activation CODE shipped, activation DATA is not in the live DB *(critical, honest correction)*
The recent activation work (outcome-evidence loop, MEI/career backfills, ontology seed, LBI real engine) **merged as code**, and its post-merge **migrations** ran — but the **data backfill scripts ran inside isolated task environments and were never executed against the shared/live database.** Live-DB evidence:
- `mei_scores` = **0** (task env reported 0→101), `mei_user_recommendations` = **0**
- `ont_competencies` = **0** (task env seeded 686), `ont_roles` = **0**
- `cg_user_recommendations` = **8** (task env reported 8→2028), `cg_user_skill_gaps` = **6**
- `career_outcomes` = **0**

So a user hitting the *live* product today still gets the pre-activation state. **The scripts exist and work; they must be run against the production database** (an operational step, not new engineering). Any launch claim of "activated intelligence" is false until that is done and verified in the live DB.

### 2. Safety liability — crisis detected, no human notified
`pragati.ts checkEscalation` detects high-severity self-harm signals and steers the conversation, **but there is no outbound notification to any human/admin inbox.** For any pilot involving students or vulnerable users this is a **launch blocker**, not a nice-to-have.

### 3. Email is a single point of failure for *login itself*
Auth is OTP/MFA-gated via Zoho (`ZOHO_EMAIL`/`ZOHO_APP_PASSWORD`). If email is misconfigured or down in prod, **the entire user base — including super-admin — is locked out.** Zoho is absent in dev; its prod status is unverified. There is no fallback channel.

### 4. Commercial stack is wired but dormant
Razorpay is integrated (CAPADEX stages ₹499/₹999/₹1999) but **defaults to demo mode without prod keys**; `FF_COMMERCIAL_ACTIVATION` and `FF_COMMERCIAL_ENTITLEMENT_ENFORCEMENT` are **both false** (so entitlement is a transparent pass-through); `subscription_packages`/`comm_*`/`capadex_payments` are all **0**. Zero revenue has ever flowed. GST/invoicing is structural-only.

### 5. Operational hardening gaps
No `/health` endpoint on the primary backend; **no rate limiting** on OTP/login or the deliberately-unauthenticated `/api/signals/ingest` (DB-poisoning vector); audit logging is best-effort (swallows its own failures); **CSP is disabled** in `index.ts`; no app-level backup/rollback orchestration (platform checkpoints aside).

### 6. Shared dev/prod database
Per `replit.md` and audit scripts, dev and prod currently share one `DATABASE_URL`. For anything beyond a closed pilot this is a **blocker** (dev activity mutates live data); for a pilot it is a **serious risk requiring verification** that publishing provisions an isolated production DB.

### 7. Backend runs uncompiled `tsx` in production
This is an **accepted, established architecture choice** for MetryxOne (the only real build gate is the frontend vite build), not a defect — but it remains a monitored performance/stability risk to acknowledge, not "fix" by forcing a `tsc` gate.

---

## Area-by-area readiness (10 areas)

### CAPADEX — **Pilot Ready (assessment) / Beta (intelligence)**
Real, exercised flow (58 sessions/reports in the live DB, explainable rule-based scoring). But the deeper layer (patterns/composites/recommendations/interventions/archetypes) is inert in the live DB (`capadex_risk_flags`=0; patterns/composites empty per prior `worldclass-intelligence` audit), and there is **no psychometric validation**. Usable for a guided pilot; not yet a validated instrument.

### Competency Intelligence — **Beta Ready**
Real hierarchical engine + a curated 686-row starter ontology *in code*, but the live `ont_*` tables are **empty** (seed not run in prod) and the target is 1000+/5000+. Foundation-grade gaps remain.

### Employability Index (MEI/EI) — **Beta Ready**
The best-engineered intelligence (genuine 3-tier computed engine + empirical cohort-benchmark path). But `mei_scores`=**0** in the live DB → no user has a score, empirical benchmarks can't fire, calibration is seeded. Pilot-ready only after the backfill is run live.

### Learning Behavior Intelligence — **Beta Ready**
Materially improved: LLM-fabricated scores were replaced with a real, auditable engine that returns a clearly-marked **preview** state when real data is absent (which it is — `lbi_score_history`=8, no real response data). Honest now, but not yet producing real scores.

### Career Builder — **Pilot Ready**
Strongest activated content: real occupation graph (200 roles / 500 edges / 711 skill reqs), 101 real profiles, and a shipped **outcome-evidence loop** (honest n + confidence, never fabricated). Recommendation backfill exists but the live DB still shows pre-backfill counts. Graph is sub-O*NET scale.

### Commercial Systems — **Not Ready**
See cross-cutting #4. Wired, demo-mode, flags off, zero revenue, untested money paths.

### Support Systems — **Not Ready**
See cross-cutting #2, #3, #5. Crisis no-notify, email SPOF, no ticketing backend (`SupportPage` + `mailto:` only).

### Institution Runtime — **Pilot Ready (concierge)**
Structurally solid multi-tenant portal (`institutes`/`batches`/`students`/`exams` + cohort analytics, tenant-scoped queries). No self-signup → ops must provision each institution. Viable for a concierge pilot.

### Employer Runtime — **Pilot Ready (closest to Launch)**
Most mature end-to-end surface: self-registration (`/api/employer/register`), public job links, candidate apply/upload, and a **real** TIG calibration engine (heuristic→calibrated at ≥30 outcomes). Seed-heavy (`employer_candidates`=8, `employer_offers`=0) but genuinely usable for a live pilot.

### SuperAdmin — **Beta/Pilot Ready**
Guarded (`requireAuth`+`requireSuperAdmin`), MFA, audit logging, RBAC. But recent audits keep finding individual unauthenticated admin endpoints (since fixed), CSP is disabled, and MFA depends on email being up.

---

## Dimension-by-dimension readiness (7 dimensions)

| Dimension | Level | Why |
|---|:---:|---|
| **Product Readiness** | **Beta/Pilot** | Five products exist and are usable; depth/validation and live-DB activation are the gaps. Career + Employer are pilot-grade. |
| **Scientific Readiness** | **Not Ready** | No reliability/validity evidence anywhere; benchmarks seeded; outcome-validation framework exists but un-activated (0 realized outcomes). |
| **Commercial Readiness** | **Not Ready** | Demo-mode payments, flags off, pass-through entitlement, zero revenue, untested money paths. |
| **Operational Readiness** | **Beta / Not Ready** | No health checks, no rate limiting, best-effort audit, shared DB, activation scripts not run in prod. |
| **Support Readiness** | **Not Ready** | Crisis no-notify (safety), email SPOF, no ticketing. |
| **Deployment Readiness** | **Beta** | Frontend build + static serving solid; `tsx` prod accepted; blockers are DB isolation + secret verification + CSP. |
| **Customer Readiness** | **Beta** | Individual usable today; Institution needs concierge; Employer pilot-ready; no self-serve support. |

---

See `launch_scorecard.md` for the at-a-glance matrices, `launch_gap_analysis.md` for the blocker list with severity and evidence per tier, and `launch_roadmap.md` for the sequenced path to each GO.
