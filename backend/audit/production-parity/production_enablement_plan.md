# Production Enablement Plan — MetryxOne

**Date:** 2026-06-17
**Type:** Read-only audit & classification. **No code modified. No flags enabled.** (Task #7: "Do not enable flags automatically. Audit and classify only.")
**Mission:** A per-flag plan to bring Production to parity with Development.
**Companion docs:** `production_parity_gap.md` (gap + evidence), `risk_matrix.md` (risk scoring).

---

## How to read this

For each of the **27 divergent flags** (ON in Dev/Preview, OFF in Prod):
- **Class** — primary blocker (Safe / Missing Tables / Missing Runtime / Missing Data).
- **What enabling does** — the runtime effect per the flag's own contract (`backend/config/feature-flags.ts`).
- **Backing in shared DB** — measured 2026-06-17 (prod uses the *same* DB; see gap doc §0).
- **Prerequisite to honest parity** — what must be true before the flag delivers real (non-empty, non-erroring) output.

> **Definition of "Safe To Enable":** turning the flag ON in prod (a) raises no error — the path is additive / read-only / lazy-ensure-schema — **and** (b) the backing tables and data already exist to produce real output. A flag that would run but return empty is **not** "Safe"; it is **Missing Data**.

---

## A. ✅ Safe To Enable (8) — enable for immediate, honest parity

These are data-backed today. Enabling each in prod reaches dev parity with real output.

| Flag | Mechanism | What enabling does | Backing in shared DB |
|---|---|---|---|
| **`aiGovernance`** | registry → `FF_AI_GOVERNANCE` | serves `/api/governance/ai/*` (15-table warehouse) | **populated** — `aig_monitoring_metrics` 2450, `aig_alerts` 185, policies/models seeded |
| **`FF_CAREER_GRAPH`** | process.env | enables `career-graph.ts`, `career-pathways-intelligence.ts`, `talent-*` | **populated** — `cg_roles` 200, `cg_role_edges` 500, `cg_skill_requirements` 711, `ti_signal_master` 300 |
| **`FF_FUTURE_READINESS`** | process.env | enables `frp.ts` Future Readiness Platform | **populated** — `frp_role_evolution` 1225, `frp_ai_impact` 41, `frp_skill_library` 41 |
| **`reportFactory`** | registry → `FF_REPORT_FACTORY` | serves `/api/rf/*` + `/api/admin/rf/*` (8 engines) | tables + config present (`rf_master` 15, `rf_blueprint_mapping` 47); generated reports accrue at runtime |
| **`careerPassport`** | registry → `FF_CAREER_PASSPORT` | serves `/api/passport/*` (12 `cp_*` tables) | tables **lazily ensured** by `career-passport.ts` on first hit (no migration needed); passport rows accrue as users publish |
| **`eiosWorldClassVerifiedV2`** | registry → `FF_EIOS_WORLD_CLASS_VERIFIED_V2` | WS15 runtime cert depth, snapshots, export | `eios_*` present (`eios_competency_roles` 14, `eios_employee_profiles` 8, campaigns 4) |
| **`wc3Personalization`** | registry → `FF_WC3_PERSONALIZATION` | attaches a provenance envelope to `/analyze` (observability only — **never** re-orders selection) | no table dep; pure additive envelope. Lowest-risk flag in the whole set |
| **`commercialEntitlementEnforcement`** | registry → `FF_COMMERCIAL_ENTITLEMENT_ENFORCEMENT` | makes `requireEntitlement` actually enforce (currently pass-through in prod) | **security-positive** — see callout below |

### ⚠️ Callout: `commercialEntitlementEnforcement` is special
This is the **only** flag where Production is *less safe* than Development. Flag-OFF makes `requireEntitlement` a synchronous pass-through, so any entitlement-gated paid surface is **unprotected in prod**. Enabling it:
- **Restores the protection that dev already has** (security-positive).
- Reads `capadex_payments` (the ledger). **That table is ABSENT in this DB**, so the guard will **fail-closed** (deny / 402) — safe by design, but it means *no one* can access paid surfaces until the ledger exists and carries real purchases.
- **Recommendation:** enable for security parity, but understand it gates paid access to "deny-all" until commerce data exists. If paid surfaces are not yet live in prod, this is harmless and correct. Pair with the commerce substrate work (§B `commercialActivation`) before selling.

---

## B. 🟥 Blocked By Missing Tables (4) — create/seed the substrate first

Enabling these in prod **does not crash** — the CAPADEX/commerce handlers are never-throws and return a degraded 200 (`degraded:true` / `ready:false` / `UNCLASSIFIED`) when a required table is absent. But they deliver **nothing useful** because a hard table dependency does not exist.

| Flag | What enabling does | Missing table(s) | Failure mode if enabled now | Prerequisite to honest parity |
|---|---|---|---|---|
| **`runtimeIntelligenceActivation`** | `/api/capadex/session/:id/guidance` surfaces the PIL guidance chain | `intervention_library`, `archetype_library`, `behavior_library`, `archetype_concern_map` (all absent) | degraded 200 (`enabled:true,degraded:true`), no guidance | Materialize the PIL curated libraries in this DB; needs ≥1 assessed session |
| **`runtimeIntelligencePipeline`** | `/api/capadex/session/:id/pipeline` returns Response→Signal→Concern→…→Intervention lineage | PIL libraries + concern master substrate (absent); only `capadex_session_signals` exists | degraded 200, empty lineage | Materialize PIL + concern master; needs ≥1 assessed session |
| **`wc3Outcome`** | composes per-session outcome models; actions are **FK to `intervention_library`** | `intervention_library` (absent) + behavioural spine | degraded 200, every outcome `UNCLASSIFIED` (FK write caught, not a crash) | Create `intervention_library` (the FK target) and have completed sessions |
| **`commercialActivation`** | fills `subscription`/`offer` slots from the live stage ladder, reads `capadex_payments` | `capadex_payments` (absent) | degraded 200, `ready:false` (fail-closed) | Create the payments ledger + wire real Razorpay SKU (also a runtime dep, §C); depends on `decisionOrchestrator` |

---

## C. 🟧 Blocked By Missing Runtime (2) — upstream engine/flag/service required

Enabling these alone is a **no-op**: they depend on another flag/engine being active first.

| Flag | What enabling does | Missing runtime | Prerequisite |
|---|---|---|---|
| **`journeyGrowthPlanBridge`** | maps the unified decision into the M5 coach `growthPlan` (read-only) | requires **`decisionOrchestrator` ON** to produce the decision envelope + the M5 coach engine + an activated L2 outcome | enable `decisionOrchestrator` first; have outcome state to map |
| **`decisionMentorBridge`** | derives mentor-type recs from the unified decision | requires **`decisionOrchestrator` ON** + a resolved concern domain | enable `decisionOrchestrator` first |

> Both are byte-identical (`ready:false, reason:'bridge_disabled'`) when their upstream is off — so they cause no error, but they deliver nothing until the orchestrator + outcome chain produce a decision.

---

## D. 🟨 Blocked By Missing Data (13) — safe to enable, but inert until data flows

These are structurally safe (additive / read-only / lazy-ensure-schema) — enabling them **raises no error** — but they produce **honest-empty / `{enabled:false}` / `UNCLASSIFIED`** output because the runtime data they compose over does not exist yet. Turning them on in prod would create the *appearance* of parity while returning nothing.

| Flag | What enabling does | Why inert in this DB |
|---|---|---|
| **`wc3Stage`** | composes + persists per-session behavioural stage | no completed CAPADEX sessions / CSI to derive a stage from |
| **`wc3Longitudinal`** | appends per-session longitudinal snapshots | no completed sessions to snapshot |
| **`wc3Journey`** | composes a route recommendation (mentoring fallback always routes) | depends on stage+outcome; no session state |
| **`decisionOrchestrator`** | read-only `/activation` composing L1/L2/L3 | the L1/L2/L3 getters return transient-empty — no session state |
| **`decisionPersistence`** | UPSERTs the composed decision into `wc7b_decision_state` (lazy) | no decision envelope to persist (no sessions) |
| **`behaviourNamespaceAlignment`** | routes concern signals into construct deficit dims | realized only by re-running the WC-L0 backfill; no behaviour graph yet |
| **`userIntelligenceFoundation`** | persists per-session user-intelligence into `wcl0_user_intelligence` (lazy) | no completed sessions |
| **`trendIntelligence`** | trends Stage/Outcome/Journey/Decision across history | needs ≥2 comparable sessions per user (zero exist) |
| **`behaviourTrendIntelligence`** | trends behaviour dims across history | needs ≥2 behaviour points per user (zero exist) |
| **`forecastIntelligence`** | extrapolates an existing trend (`last+slope`) | needs ≥2 sessions to have a trend to extrapolate |
| **`enterpriseAnalytics`** | serves `/api/analytics/*` | every `anl_*` warehouse table is **empty** (0 rows) — KPIs/cohorts/exec dashboards return empty |
| **`FF_LEARNING_INTELLIGENCE`** | enables `lbi-intelligence.ts` / `lip.ts` | `lbi_*` is thin (`lbi_report_types` 3, `lbi_score_history` 8) — intelligence outputs are data-starved |
| **`FF_COMPETENCY_INTELLIGENCE`** | enables `competency-intelligence-engine.ts` (D1–D10 + E1–E5); reads `cra_scores`/`cra_profiles`, lazy-ensures its write tables | `cra_scores` (0) + `cra_profiles` (0) are present but empty; secondary deps `competency_forecasts`/`p4_development_velocity`/`intervention_library` absent but **caught** (21 catch blocks → degrades, never 500). It does **not** read `user_competency_scores`/`role_families` (earlier-draft misattribution, corrected). Inert until competency assessments produce `cra_*` rows |

---

## E. Recommended sequencing (NOT executed — owner decision required)

> User preference: audits/additive phases **STOP for approval**; never auto-deploy. The steps below are a *plan*, not actions taken.

**Phase 1 — Immediate parity (data-backed, low risk).** Set in the prod deployment env: `FF_AI_GOVERNANCE`, `FF_CAREER_GRAPH`, `FF_FUTURE_READINESS`, `FF_REPORT_FACTORY`, `FF_CAREER_PASSPORT`, `FF_EIOS_WORLD_CLASS_VERIFIED_V2`, `FF_WC3_PERSONALIZATION`. → 7 products reach honest dev parity immediately.

**Phase 2 — Security parity.** Enable `FF_COMMERCIAL_ENTITLEMENT_ENFORCEMENT` (restores the dev-only protection; fail-closed). Confirm whether paid surfaces are live before relying on the ledger.

**Phase 3 — CAPADEX intelligence substrate.** Before enabling the CAPADEX chain, materialize the substrate **in the shared DB**: PIL libraries (`intervention_library`, `archetype_library`, `behavior_library`, `archetype_concern_map`), `capadex_payments`, and confirm the lazy `wc3_*`/`wcl0_*`/`wc7b_*` writers fire on completion. Then enable in dependency order: `decisionOrchestrator` → `wc3Stage`/`wc3Outcome`/`wc3Journey` → `decisionPersistence` → bridges (`journeyGrowthPlanBridge`, `decisionMentorBridge`) → `runtimeIntelligenceActivation`/`runtimeIntelligencePipeline` → trend/forecast (`trendIntelligence`, `behaviourTrendIntelligence`, `forecastIntelligence`, `userIntelligenceFoundation`, `behaviourNamespaceAlignment`, `wc3Longitudinal`).

**Phase 4 — Competency + Analytics data.** Drive real competency assessments so `cra_scores`/`cra_profiles` populate (→ `FF_COMPETENCY_INTELLIGENCE`; optionally materialize its absent secondary deps `competency_forecasts`/`p4_development_velocity`/`intervention_library`); populate the `anl_*` warehouse (→ `enterpriseAnalytics`); enrich `lbi_*` (→ `FF_LEARNING_INTELLIGENCE`).

**Phase 5 — Commerce.** Wire `capadex_payments` + real Razorpay SKU, then `commercialActivation`.

> **Operational note:** because prod is **autoscale sharing the dev DB**, every flag set in the Deployment env takes effect against the same data dev sees — there is no separate prod data to migrate. The remaining work is **substrate creation + real runtime usage**, not data copying. Verify the Deployment pane for any pre-existing overrides before changing anything (honesty caveat, gap doc §0).
