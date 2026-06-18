# Domain Readiness Reports (Deliverables 6–11)

Each report uses the **two-axis** rule: *Coverage* (does data exist, over the eligible base) vs
*Confidence* (is it trustworthy / statistically sufficient). High coverage on a tiny base is NOT
readiness.

---

> All sub-scores below use the same formula as the main scorecard
> (`0.40·Wiring + 0.30·Persistence + 0.30·DataConfidence`); components are in
> `06_SCORING_METHODOLOGY_AND_EVIDENCE.md`.

## 6 · Revenue Readiness Report  — **18 / 100** (W35/P5/D8)

| Dimension | Finding | Coverage | Confidence |
|---|---|---|---|
| Pricing substrate | `subscription_packages` = 0; `capadex_stage_pricing` = 4 (seed) | ~0% | n/a |
| Transactions | `capadex_payments` = 6 | trivial | low |
| Revenue Intelligence | `wc7c/revenue-intelligence.ts` runs at `/admin/revenue-intelligence` but **persists nothing**; aggregates 6 payments + audit events | runtime-only | very low |
| Offer / Conversion | `wc7c/offer-engine.ts` derived in orchestrator; no offer/conversion table; crisis-safety suppression present (✅) | runtime-only | n/a |
| Entitlements / Renewal / Upsell | `subscription-engine.ts` reads payments, **writes no state**; no renewal/upsell tracking | none | n/a |

**Verdict:** no commercial substrate exists. **Cannot launch a paid tier.** Revenue intelligence is a
real-time view over an empty base. Requires CB-3 (pricing/packages + persisted commercial state) before
any monetisation claim is honest.

---

## 7 · Product Readiness Report  — **40 / 100** (W55/P45/D15)

| Surface | Status | Evidence |
|---|---|---|
| Free assessment → clarity → concern → report | ✅ works | 9 completed sessions, 39 reports, 287 runtime sessions |
| Stage surfacing | ⚠️ works, thin | `wc3_stage_state` 9/9, low-confidence base |
| Outcome / Journey product routing | ❌/⚠️ | Outcome 0 (CB-1); Journey 100% degraded; product mapping derived but runtime-only |
| Growth Plan / Mentor product | ⚠️ | wired, flag-ON, but **no persistence** (`persist=false` / ephemeral) |
| Pragati conversational runtime | ⚠️ | 30 sessions; functional but small |
| Reports console / dynamic reporting | ✅ | `dynamic_reporting` DB flag ON; report synthesis present |

**Verdict:** the **core product** (assessment + report) is the only launch-ready surface, and only as a
beta. Intelligence-driven product routing is wired but runs on empty/degraded inputs and stores nothing.
Launch-around: ship the core, hide outcome/journey-dependent surfaces until CB-1.

---

## 8 · Personalization Readiness Report  — **30 / 100** (W40/P35/D12)

| Driver | Status | Evidence |
|---|---|---|
| Persona-driven | ⚠️ | IntroPhase persona picker + `personalization-wiring.ts`; `FF_WC3_PERSONALIZATION` ON; `wc3_personalization_decisions` = 11 |
| Behaviour-driven | ⚠️ | depends on Outcome/constructs (CB-1) → degraded |
| Trend-driven | ❌ | needs trends; only 2 eligible users; `trendIntelligence` OFF |
| Report / Rec personalization | ❌ | `wc3ReportPersonalization`, `wc3RecPersonalization` OFF |
| Runtime consumption | ⚠️ | `runtimeIntelligenceConsumption` OFF |

**Verdict:** persona-level personalization is partially live; behaviour/trend/cohort personalization is
not (no base, flags off, depends on broken Outcome). Coverage 11 decisions / confidence low.

---

## 9 · Longitudinal Readiness Report  — **31 / 100** (W38/P45/D8)

| Dimension | Finding |
|---|---|
| Snapshot coverage | `wc3_longitudinal_snapshots` = 9 (per completed session) ✅ |
| Historical continuity | only **2 users** have ≥2 sessions → continuity exists for 2 people |
| Trend Intelligence | engine real, honest degradation (`<2 points → skip`); `wc3_longitudinal_trends` = 4; **but `trendIntelligence` flag OFF in workflow** (rows from backfill) |
| Outcome trend coverage | **0%** — Outcome state empty (CB-1) |
| Journey trend coverage | exists but built on degraded journey (HG-2) |

**Two-axis honesty:** Stage/Decision trends are *computable* for the 2 eligible users (flat = stable),
but n=2 is below any statistical bar. Outcome/Journey trends are ungroundable. **Confidence is
structurally capped until the user base and Outcome chain grow.**

**Verdict:** mechanism ready, data not. This is the subsystem most likely to become real *first* once
users arrive — provided CB-1 and CB-4 are addressed.

---

## 10 · Future Readiness Report  — **13 / 100** (W22/P8/D6)

| Capability | Status | Evidence |
|---|---|---|
| Forecast engine | 🌱 heuristic | `m4-predictive.ts` `forecastFutureCapability`/`futureReadiness`; needs ≥2 `m4_capability_trajectories` (absent) → degrades to "stable" |
| Forecast data | 🌱 seed | `m4_future_readiness_scores` 3, `m4_future_capability_gaps` 2, `m3_future_skill_forecasts` 4, most `*_forecasts` 0 |
| AI Career Navigator | ❌ aspiration | docs in `audit/wc-9/*` + frontend mockups; **no live navigator backend route** |
| Future Skills Planner | ❌ aspiration | mockup/schema only |
| Employability 2.0 | ⚠️ partial | gated by `employabilityPassport` (passport feature exists; "2.0" framing is aspirational) |
| Entrepreneurship readiness | 🌱 | route consumes static templates/weights |

**Verdict:** future-facing products are **not shippable**; forecasts are heuristic over seed data with no
trajectory history. This is a roadmap area, not a launch area.

---

## 11 · Enterprise Readiness Report  — **9 / 100** (W15/P6/D4)

| Capability | Status | Evidence |
|---|---|---|
| Institution Intelligence | 🌱 stub | `iil-core.ts` uses `rnd(min,max)` for identity/personality/culture-DNA/emotional-climate |
| Cohort Intelligence | ❌ | no live session→cohort aggregation; cohorts need k≥30 (have 4 users) |
| Multi-user / B2B reporting | ❌ | no live bridge from real sessions to institution dashboards |
| m5 enterprise workforce | 🌱 demo | `m5_*` tables 1–15 rows, demo/seed |
| Reference data | ✅ | institutions 67, accreditations 68, rankings 56 (static reference, not intelligence) |

**Verdict:** enterprise/institution intelligence would display **fabricated random values** if exposed.
Must not be shown to B2B customers. Lowest-readiness domain; depends on everything upstream + a real
multi-tenant user base.
