# MetryxOne — Launch Scorecard
### MX-LAUNCH-READINESS-01 · 18 June 2026

Levels: **🟢 Launch Ready · 🔵 Pilot Ready · 🟡 Beta Ready · 🔴 Not Ready.**
Axes kept separate: **S**=Structural (code exists), **A**=Activation (real data in *live* DB), **V**=Validity (empirically derived/validated).

---

## 1. Final tier verdicts

| Launch tier | Verdict | Gating conditions |
|---|:---:|---|
| **Institution Pilot** | 🟠 **CONDITIONAL GO** | Crisis→human notify · Zoho verified in prod · prod DB isolation confirmed |
| **Commercial Pilot** | 🔴 **NO GO** | Prod payment keys + flags on + entitlement enforced + MFA/Razorpay e2e tested |
| **Enterprise Launch** | 🔴 **NO GO** | + scientific validity + outcome loop activated + ops/support hardening |
| **Public Launch** | 🔴 **NO GO** | + support at scale + safety + self-serve onboarding + scale testing |

---

## 2. Area readiness (10 areas)

| # | Area | Level | S | A | V | Evidence (live DB / code) |
|---|---|:---:|:---:|:---:|:---:|---|
| 1 | CAPADEX | 🔵/🟡 | ✅ | ◑ | ❌ | 58 sessions/reports; patterns/risk_flags=0; no psychometric validation |
| 2 | Competency Intelligence | 🟡 | ✅ | ❌ | ❌ | engine real; `ont_competencies`=0/`ont_roles`=0 (686 seed not run live) |
| 3 | Employability Index (MEI) | 🟡 | ✅ | ❌ | ❌ | strongest engine; `mei_scores`=0/`mei_user_recommendations`=0 live |
| 4 | Learning Behavior Intelligence | 🟡 | ✅ | ❌ | ❌ | real engine replaced LLM; preview-state; `lbi_score_history`=8, no real responses |
| 5 | Career Builder | 🔵 | ✅ | ◑ | ◑ | graph 200/500/711; 101 profiles; outcome loop shipped; recs live=8 (pre-backfill) |
| 6 | Commercial Systems | 🔴 | ✅ | ❌ | — | Razorpay demo-mode; flags OFF; `capadex_payments`=0; `comm_*`=0; zero revenue |
| 7 | Support Systems | 🔴 | ◑ | ❌ | — | crisis no-notify; email SPOF; no ticketing backend |
| 8 | Institution Runtime | 🔵 | ✅ | ◑ | — | multi-tenant solid; `tenants`=4; no self-signup (concierge) |
| 9 | Employer Runtime | 🔵 | ✅ | ◑ | ◑ | self-register + public apply + real TIG calibration; seed-heavy (8 cand / 0 offers) |
| 10 | SuperAdmin | 🟡/🔵 | ✅ | ✅ | — | guarded + MFA + audit; CSP disabled; recurring unauth-endpoint findings |

Legend: ✅ present/strong · ◑ partial/seeded · ❌ absent · — n/a.

---

## 3. Dimension readiness (7 dimensions)

| Dimension | Level | Headline |
|---|:---:|---|
| Product Readiness | 🔵/🟡 | 5 products usable; Career + Employer pilot-grade; depth + live activation pending |
| Scientific Readiness | 🔴 | no reliability/validity evidence; benchmarks seeded; 0 realized outcomes |
| Commercial Readiness | 🔴 | demo-mode, flags off, pass-through entitlement, zero revenue, untested money paths |
| Operational Readiness | 🔴/🟡 | no /health, no rate-limit, best-effort audit, shared DB, activation not run live |
| Support Readiness | 🔴 | crisis no-notify (safety), email SPOF, no ticketing |
| Deployment Readiness | 🟡 | builds OK, tsx accepted; DB isolation + secret verify + CSP outstanding |
| Customer Readiness | 🟡 | individual usable; institution concierge; employer pilot; no self-serve support |

---

## 4. Readiness by tier × dimension (where each tier fails)

| Dimension | Inst. Pilot | Comm. Pilot | Enterprise | Public |
|---|:---:|:---:|:---:|:---:|
| Product | 🔵 | 🟡 | 🟡 | 🟡 |
| Scientific | 🟡¹ | 🔴 | 🔴 | 🔴 |
| Commercial | 🟢² | 🔴 | 🔴 | 🔴 |
| Operational | 🟠³ | 🔴 | 🔴 | 🔴 |
| Support | 🔴⁴ | 🔴 | 🔴 | 🔴 |
| Deployment | 🟠³ | 🟡 | 🔴 | 🔴 |
| Customer | 🔵 | 🟡 | 🟡 | 🔴 |
| **Tier verdict** | **🟠 COND. GO** | **🔴 NO GO** | **🔴 NO GO** | **🔴 NO GO** |

¹ Validity tolerable for a *pilot* if framed as developmental/exploratory, not validated. ² No payment needed for a concierge pilot. ³ Conditional on DB isolation + Zoho verified. ⁴ Crisis-notify is the hard pilot blocker.

---

## 5. The shortest path to a first "GO"
1. **Crisis escalation → human notification** (safety; pilot blocker).
2. **Verify `ZOHO_*` in production** (prevents total login lockout).
3. **Confirm production DB isolation** (publishing provisions a separate prod DB).
4. **Run activation backfills against the live DB** (mei/career/ontology) + verify counts.
→ Unlocks **Institution Pilot (concierge)** and a **narrow Employer usage pilot**. Commercial Pilot remains NO GO until prod payment keys + flags + entitlement + e2e money-path tests.
