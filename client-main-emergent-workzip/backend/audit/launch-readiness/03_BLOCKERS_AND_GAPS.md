# 4 · Critical Blockers  ·  5 · High-Priority Gaps

A **Critical Blocker** prevents an honest launch of the platform vision (or any tier that depends on it).
A **High-Priority Gap** materially limits value/trust but can be launched-around with scope cuts.

---

## 4 · Critical Blockers

### CB-1 — Outcome chain produces zero state (keystone break)
- **Evidence:** `wc3_outcome_state` = 0 rows across all 9 completed sessions.
- **Root cause (code-grounded):** `resolveSessionOutcomes` → `loadSessionConstructs` returns `[]`
  because the behavioural spine (`behavioural_hypotheses` active / `capadex_session_patterns.construct_key`)
  is empty for these sessions, and the Tier-3 crosswalk fallback is gated by `FF_WC3_OUTCOME_CROSSWALK`,
  which is **OFF**. Result: `{unclassified, reason:'no_constructs'}`, no INSERT.
- **Blast radius:** Journey (100% degraded), Decision (degraded inputs), Product/Growth/Mentor routing,
  Outcome-trend, report Outcome surfaces. This single break degrades the whole downstream chain.
- **Fix direction (not done — needs approval):** supply constructs to sessions (populate the spine via
  the signal/pattern runtime) **or** enable `FF_WC3_OUTCOME_CROSSWALK` so the clarity-bank crosswalk
  can resolve constructs. Both are config/data moves, not re-architecture.

### CB-2 — Activation & commercial layers persist nothing
- **Evidence:** of Decision/Product/Growth/Mentor/Subscription/Offer/Revenue, only **Decision
  Persistence** writes (`wc7b_decision_state`). Growth bridge calls `persist=false`; mentor/subscription/
  offer/revenue are pure runtime aggregation.
- **Impact:** no durable activation or commercial record exists; nothing to report on, bill from, or
  learn from; longitudinal/forecast layers have no activation history to consume.

### CB-3 — No commercial substrate
- **Evidence:** `subscription_packages` = 0, `student_subscriptions` = 0, `wc7c_*` tables do not exist,
  `capadex_payments` = 6. Revenue/offer/conversion intelligence is computed over an empty/near-empty base.
- **Impact:** **cannot launch any paid tier.** Commercial Readiness ≈ 12/100.

### CB-4 — Data-sufficiency floor unmet for all comparative/temporal intelligence
- **Evidence:** 9 completed sessions; **2** users with ≥2 sessions; 4 platform users; 2 career-seeker
  profiles. Trend needs ≥2 points/user; forecasts need ≥2 trajectory snapshots; cohorts need k≥30.
- **Impact:** Longitudinal, Forecast, Enterprise/Cohort, and cohort-personalization are **statistically
  ungroundable today** regardless of code quality. This is a *population* blocker, not a code blocker —
  it resolves only by acquiring real users.

### CB-5 — Enterprise/Institution intelligence is stubbed with random values
- **Evidence:** `iil-core.ts` generates identity/personality/culture-DNA/emotional-climate via
  `rnd(min,max)`; no live bridge from `capadex_sessions` to `iil_signals`.
- **Impact:** any institution/B2B dashboard would display **fabricated** numbers. Must not be exposed to
  customers. Enterprise Readiness ≈ 8/100.

---

## 5 · High-Priority Gaps

### HG-1 — 30,638-row question-intelligence build is dark
L5A–L5D artifacts exist but no live caller consumes them; `wc3QuestionIntel`/`wc3ContextIntel` OFF.
Significant sunk work delivering zero runtime value until wired (or consciously deferred).

### HG-2 — Journey ships as "covered" but is 100% degraded
All 9 `wc3_journey_state` rows are confidence 0.2 (downstream of CB-1). Coverage metrics look healthy
(100%) while confidence is ~0 — a classic inflation trap. Must be reported on the confidence axis and
hidden from users until CB-1 is fixed.

### HG-3 — User Intelligence Foundation rows exist with its flag OFF
`wcl0_user_intelligence` = 9 while `userIntelligenceFoundation` is OFF in the workflow. The data is from
a backfill, not a live flagged path — so the "foundation" isn't actually running in the current config.

### HG-4 — Forecast/Future is heuristic + seed, products are mockups
`m4-predictive` is heuristic; AI Career Navigator / Future Skills Planner / Employability 2.0 /
Entrepreneurship have no live navigator route. Marketed future features are not shippable.

### HG-5 — Trend/Longitudinal automation OFF in the running workflow
The healthiest new subsystem (trend engine) isn't actually active: `trendIntelligence` and
`longitudinalAutomation` are OFF; the 4 trend rows came from a backfill, not live operation.

### HG-6 — Massive empty schema surface (operational + audit risk)
531/980 tables (54%) are empty. This inflates apparent capability, complicates migrations/backups, and
makes it hard to distinguish real features from aspirational schema. Needs a clear "active vs aspirational"
table inventory before launch.

### HG-7 — Personalization has no cohort base
`wc3_personalization_decisions` = 11 and report/rec personalization flags are OFF; persona/behaviour
personalization can't be cohort-calibrated with 4 users.

### HG-8 — `pg_stat` estimates unreliable (no ANALYZE)
Row estimates were wildly wrong (capadex_sessions est 0 vs real 27). Any internal dashboard reading
`n_live_tup` will mis-report. Routine `ANALYZE` / autovacuum tuning needed before trusting any stat-based
metric.
