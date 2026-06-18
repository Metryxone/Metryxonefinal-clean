# Production Parity Gap — MetryxOne

**Date:** 2026-06-17
**Type:** Read-only audit. **No code modified. No flags enabled.**
**Mission:** Production must behave identically to Development. This document inventories every `FF_*` flag, compares Development / Preview / Production, and isolates the exact divergence set.
**Companion docs:** `production_enablement_plan.md`, `risk_matrix.md`, and the prior audit (`feature_flag_inventory.md`, `feature_activation_matrix.md`, `production_parity_report.md`).

---

## 0. The single most important finding (read first)

**Production and Development almost certainly share the SAME database.** The deployment is `deploymentTarget = "autoscale"`; `[userenv.production]` sets only `APP_URL`, `[userenv.shared]` sets only Firebase keys — **neither sets a separate `DATABASE_URL`/`PGDATABASE`.** So on the repo-visible evidence the autoscale deployment inherits the workspace's built-in `DATABASE_URL`, i.e. **the same Postgres instance dev uses** (pending the deployment-pane attestation below).

Consequence (best inference from repo-visible config + the current DB session):
- **Table existence and row data are expected to be the same in dev and prod** — on the evidence available they resolve to the same database instance.
- Therefore the **primary** thing that makes prod behave differently from dev is the set of **`FF_*` environment flags** the dev workflow sets and the prod run command does not.
- "Blocked By Missing Tables / Missing Data" below is assessed against **this shared database's actual state** (measured live), on the assumption — pending owner attestation — that prod resolves to the same instance.

> ⚠️ **Honesty caveat (unchanged from prior audit):** I cannot introspect the Replit **Deployment pane**, so I cannot cryptographically prove no `FF_*` or alternate `DATABASE_URL` was set there. All statements are derived from visible config + the live DB. **Owner attestation required** to fully close this. If a separate prod DB *was* provisioned via the pane, every "table/data present" claim must be re-checked against that DB.

---

## 1. Flag inventory (full census)

Three flag mechanisms (detail in `feature_flag_inventory.md`):

| Mechanism | Count | Env resolution |
|---|---|---|
| **Registry** (`backend/config/feature-flags.ts`) | **72** (29 default-true, 43 default-false) | `FF_<UPPER_SNAKE(key)>` overrides default; else default |
| **Raw `process.env` gates** (in route files, no registry default) | **4** | absent env = OFF → **503** |
| **DB table** (`feature_flags`) | 10 rows, **0 enabled** | per-row `enabled` boolean (none on) |

---

## 2. Dev / Preview / Production comparison

**Preview == Development** (the webview proxies the *same* dev workflow process — no separate runtime or env). So every divergence is **Dev/Preview vs Production.**

| Bucket | Count | Dev | Preview | Prod | Parity |
|---|---|---|---|---|---|
| Registry default-true | 29 | ON | ON | ON | ✅ identical |
| Registry default-false, **dev workflow sets `FF_*=1`** | **23** | ON | ON | **OFF** | ❌ **divergent** |
| Registry default-false, never set | 20 | OFF | OFF | OFF | ✅ identical (dormant) |
| **Raw `process.env` gates** (`FF_CAREER_GRAPH`, `FF_LEARNING_INTELLIGENCE`, `FF_COMPETENCY_INTELLIGENCE`, `FF_FUTURE_READINESS`) | **4** | ON | ON | **OFF (503)** | ❌ **divergent** |
| DB `feature_flags` (0 enabled) | 10 | none active | none active | none active | ✅ identical |

**Net divergence = 27 flag-controlled feature sets** (23 registry + 4 process.env) ON in Dev/Preview, OFF in Production.

---

## 3. The 27 divergent flags — ON in Development, OFF in Production

> This is the answer to task #4 ("flags ON in Development and OFF in Production"). Full per-flag classification is in §4 + `production_enablement_plan.md`.

### 3a. Registry flags (23) — dev workflow `FF_*=1`, prod default `false`
`runtimeIntelligenceActivation`, `runtimeIntelligencePipeline`, `wc3Stage`, `wc3Personalization`, `wc3Longitudinal`, `wc3Outcome`, `wc3Journey`, `decisionOrchestrator`, `journeyGrowthPlanBridge`, `decisionMentorBridge`, `commercialActivation`, `commercialEntitlementEnforcement`, `decisionPersistence`, `behaviourNamespaceAlignment`, `userIntelligenceFoundation`, `trendIntelligence`, `behaviourTrendIntelligence`, `forecastIntelligence`, `careerPassport`, `reportFactory`, `enterpriseAnalytics`, `aiGovernance`, `eiosWorldClassVerifiedV2`.

### 3b. Raw `process.env` gates (4) — dev workflow `FF_*=1`, prod absent (→503)
`FF_CAREER_GRAPH`, `FF_LEARNING_INTELLIGENCE`, `FF_COMPETENCY_INTELLIGENCE`, `FF_FUTURE_READINESS`.

---

## 4. Classification summary (task #5)

Each divergent flag is classified into exactly one **primary** blocker (full reasoning + secondary blockers in `production_enablement_plan.md`; risk scoring in `risk_matrix.md`). Classification is grounded in the **live shared-DB state** measured on 2026-06-17.

| Classification | Count | Flags |
|---|---|---|
| ✅ **Safe To Enable** | **8** | `aiGovernance`, `FF_CAREER_GRAPH`, `FF_FUTURE_READINESS`, `reportFactory`, `careerPassport`, `eiosWorldClassVerifiedV2`, `wc3Personalization`, `commercialEntitlementEnforcement` (security-positive, fail-closed) |
| 🟥 **Blocked By Missing Tables** | **4** | `runtimeIntelligenceActivation`, `runtimeIntelligencePipeline`, `wc3Outcome`, `commercialActivation` |
| 🟧 **Blocked By Missing Runtime** | **2** | `journeyGrowthPlanBridge`, `decisionMentorBridge` |
| 🟨 **Blocked By Missing Data** | **13** | `wc3Stage`, `wc3Longitudinal`, `wc3Journey`, `decisionOrchestrator`, `decisionPersistence`, `behaviourNamespaceAlignment`, `userIntelligenceFoundation`, `trendIntelligence`, `behaviourTrendIntelligence`, `forecastIntelligence`, `enterpriseAnalytics`, `FF_LEARNING_INTELLIGENCE`, `FF_COMPETENCY_INTELLIGENCE` |

> "Safe To Enable" means **enabling the flag will not error** (additive / read-only / lazy-ensure schema) AND the backing tables+data already exist to produce real output. "Blocked" flags do **not** crash on enable — the CAPADEX/competency handlers are never-throws (they catch read/FK failures and return `degraded:true` / `ready:false` / `UNCLASSIFIED` 200 payloads). The bucket names the **root cause** of the blocked-but-degraded output: a required table is absent (Missing Tables), an upstream engine/flag/external service is inactive (Missing Runtime), or the tables exist but carry no runtime data (Missing Data → **honest-empty** output).

---

## 5. Live database evidence (the basis for §4)

Measured against the shared `DATABASE_URL` on 2026-06-17 (224 public tables total). **Row counts are point-in-time snapshots** — live/volatile tables (e.g. `aig_monitoring_metrics`) drift between reads; treat them as order-of-magnitude evidence, not fixed values.

### Present **with data** → supports "Safe To Enable"
| Subsystem | Representative tables (row counts) |
|---|---|
| AI Governance (`aig_*`) | `aig_monitoring_metrics` ~2450 (volatile), `aig_alerts` 185, `aig_insight_rules` 111, `aig_governance_policies` 6, `aig_models` 4 |
| Career Graph (`cg_*`) | `cg_skill_requirements` 711, `cg_role_edges` 500, `cg_skill_resource_map` 256, `cg_roles` 200, `cg_tracks` 15 |
| Future Readiness (`frp_*`) | `frp_role_evolution` 1225, `frp_ai_impact` 41, `frp_skill_library` 41, `frp_skill_taxonomy` 27, `frp_user_readiness` 8 |
| Talent Intelligence (`ti_*`) | `ti_signal_master` 300, `ti_industry_benchmarks` 66, `ti_role_benchmarks` 60, `ti_signal_competency_map` 45 |
| Report Factory (`rf_*`) | `rf_blueprint_mapping` 47, `rf_master` 15 |
| EIOS (`eios_*`) | `eios_competency_roles` 14, `eios_employee_profiles` 8, `eios_campaigns` 4, `eios_workforce_plans` 3 |
| CAPADEX **config** | `capadex_clarity_questions` 360, `capadex_question_registry` 360, `capadex_signal_profiles` 40, `capadex_linguistic_signals` 40, `capadex_stage_pricing` 4 |

### Present but **EMPTY** → "Blocked By Missing Data"
`anl_*` (Enterprise Analytics warehouse) — **every table 0 rows** (`anl_fact_sessions`, `anl_fact_scores`, `anl_kpi_daily`, `anl_event_lake`, all dims = 0). `lbi_*` is thin (`lbi_report_types` 3, `lbi_score_history` 8 only). `ont_*` ontology tables all 0. `capadex_users` 0. **Competency engine** (`competency-intelligence-engine.ts`) reads `cra_scores` (0) + `cra_profiles` (0) — present but empty.

### **ABSENT** (do not exist in this DB) → "Blocked By Missing Tables / degraded output"
- CAPADEX live runtime: `capadex_sessions`, `capadex_responses`, `capadex_reports`, `capadex_runtime_sessions`, `capadex_otps`.
- PIL libraries: `intervention_library`, `archetype_library`, `behavior_library`, `archetype_concern_map`.
- Behavioural spine: `behavioural_hypotheses`, `capadex_session_patterns`.
- Commerce: `capadex_payments`.
- WC-3 / WC-L0 / WC-7B persistence: **no** `wc3_*`, `wcl0_*`, `wc7b_*` tables (lazy-created on first write when their flag is ON — see plan).
- Career Passport: **no** `cp_*` tables (lazy-created by `career-passport.ts` ensure-schema).
- Competency engine secondary deps: `competency_forecasts`, `p4_development_velocity`, `intervention_library` are also absent (engine catches these and degrades; it does **not** read `user_competency_scores`/`role_families` — those were misattributed in an earlier draft and corrected here).

> **Why CAPADEX intelligence flags are mostly blocked:** the config layer is seeded (360 clarity questions, 360 registry, signal profiles) but **no CAPADEX assessment has ever completed in this database** — `capadex_users` is 0 and the entire sessions/responses/reports/PIL/wc3 substrate is absent. The intelligence chain (stage → outcome → journey → decision → trend → forecast) has nothing to compose over. This is an **honest data/substrate gap**, not a code defect.

---

## 6. Bottom line

- **Parity is achievable purely by aligning the 27 env flags** (same DB → no data migration needed for the flags that are already data-backed).
- **8 flags are safe to turn on in prod today** and would immediately reach dev parity (warehouse/config data already present).
- **19 flags would be "on" in prod but functionally inert (degraded, not crashing)** until either (a) lazy tables/PIL substrate are created and (b) live CAPADEX assessment data flows. The handlers are never-throws, so they return degraded/empty 200 payloads rather than 500s — but turning these on without the substrate still gives the *appearance* of parity while delivering empty/`{enabled:false}`/`degraded:true` responses, the opposite of honest parity. (`process.env`-gated routes are the exception: absent env = a hard 503, not degraded.)
- **`commercialEntitlementEnforcement`** is the one flag where prod is *less protected* than dev (see `risk_matrix.md` — security-positive to enable, fail-closed).

**No flags were enabled. Recommendation and sequencing are in `production_enablement_plan.md`; risk scoring in `risk_matrix.md`. STOP for owner approval before any change.**
