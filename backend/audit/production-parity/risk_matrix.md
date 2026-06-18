# Risk Matrix — Production Parity Enablement

**Date:** 2026-06-17
**Type:** Read-only audit. **No code modified. No flags enabled.**
**Scope:** Risk of turning each of the 27 divergent `FF_*` flags ON in Production.
**Companion docs:** `production_parity_gap.md`, `production_enablement_plan.md`.

---

## Scoring model

Two independent axes, scored **Low / Med / High**:

- **Enablement Risk** — likelihood that turning the flag ON in prod *causes harm* (error, crash, wrong/misleading output, security regression). This is the "is it dangerous to flip?" axis.
- **Parity Value** — how much honest Dev↔Prod parity is *gained* by enabling it today (data-backed real output = High; inert/empty = Low).

> Because **prod shares the dev database** (gap doc §0), enablement risk is assessed against the *actual* live data, not a hypothetical empty prod DB.

| Color | Meaning |
|---|---|
| 🟢 | Low enablement risk |
| 🟡 | Medium enablement risk |
| 🔴 | High enablement risk |

---

## Master matrix (27 flags)

| Flag | Class | Enablement Risk | Parity Value | Failure mode if enabled now |
|---|---|---|---|---|
| `aiGovernance` | Safe | 🟢 Low | **High** | none — data-backed, serves real warehouse |
| `FF_CAREER_GRAPH` | Safe | 🟢 Low | **High** | none — `cg_*`/`ti_*` populated |
| `FF_FUTURE_READINESS` | Safe | 🟢 Low | **High** | none — `frp_*` populated |
| `reportFactory` | Safe | 🟢 Low | Med | generated reports start empty, accrue at runtime |
| `careerPassport` | Safe | 🟢 Low | Med | lazy-creates `cp_*`; empty until users publish |
| `eiosWorldClassVerifiedV2` | Safe | 🟢 Low | Med | depth partial (`eios_*` snapshots/scenarios empty) |
| `wc3Personalization` | Safe | 🟢 Low | Low | observability envelope only; never changes selection |
| `commercialEntitlementEnforcement` | Safe (security) | 🟡 **Med** | **High (security)** | **fail-closed**: with `capadex_payments` absent, paid surfaces deny-all (402). Security-positive but can lock out paid users |
| `decisionOrchestrator` | Missing Data | 🟢 Low | Low | read-only; returns transient-empty (no session state) |
| `decisionPersistence` | Missing Data | 🟢 Low | Low | lazy table; nothing to persist (no decisions) |
| `wc3Stage` | Missing Data | 🟢 Low | Low | no completed sessions → no stage written |
| `wc3Longitudinal` | Missing Data | 🟢 Low | Low | no sessions → no snapshots |
| `wc3Journey` | Missing Data | 🟢 Low | Low | depends on stage/outcome; routes nothing |
| `userIntelligenceFoundation` | Missing Data | 🟢 Low | Low | lazy `wcl0_*`; no sessions to persist |
| `behaviourNamespaceAlignment` | Missing Data | 🟢 Low | Low | needs WC-L0 backfill; no behaviour graph |
| `trendIntelligence` | Missing Data | 🟢 Low | Low | needs ≥2 sessions/user (zero) |
| `behaviourTrendIntelligence` | Missing Data | 🟢 Low | Low | needs ≥2 behaviour points (zero) |
| `forecastIntelligence` | Missing Data | 🟢 Low | Low | needs a trend to extrapolate (none) |
| `enterpriseAnalytics` | Missing Data | 🟡 Med | Low | **`anl_*` all empty** → exec dashboards render empty/misleading "zeros as truth" |
| `FF_LEARNING_INTELLIGENCE` | Missing Data | 🟡 Med | Low | `lbi_*` data-thin → starved intelligence outputs |
| `FF_COMPETENCY_INTELLIGENCE` | Missing Data | 🟢 Low | Low | `cra_scores`/`cra_profiles` present-but-empty; absent secondary deps **caught** (never-throws) → degrades, inert until competency assessments run |
| `journeyGrowthPlanBridge` | Missing Runtime | 🟢 Low | Low | `ready:false` until `decisionOrchestrator` + outcome exist |
| `decisionMentorBridge` | Missing Runtime | 🟢 Low | Low | `ready:false` until `decisionOrchestrator` exists |
| `runtimeIntelligenceActivation` | Missing Tables | 🟢 Low | Low | reads absent PIL libraries → **degraded 200** (`degraded:true`), no crash; no guidance until substrate exists |
| `runtimeIntelligencePipeline` | Missing Tables | 🟢 Low | Low | reads absent PIL + concern substrate → **degraded 200**, empty lineage; no crash |
| `wc3Outcome` | Missing Tables | 🟢 Low | Low | actions FK to absent `intervention_library` → FK failure **caught**, outcome `UNCLASSIFIED`; no crash |
| `commercialActivation` | Missing Tables | 🟢 Low | Low | reads absent `capadex_payments` → **fail-closed** `ready:false`; needs real Razorpay SKU |

---

## Risk quadrants (decision guide)

### 🟢 Low risk + High value → **enable now** (immediate honest parity)
`aiGovernance`, `FF_CAREER_GRAPH`, `FF_FUTURE_READINESS`. *(+ `reportFactory`, `careerPassport`, `eiosWorldClassVerifiedV2`, `wc3Personalization` — low risk, partial/runtime-accruing value.)*

### 🟡 Medium risk → **enable with a decision**
- `commercialEntitlementEnforcement` — **security-positive**; enable to close the prod protection gap, but accept fail-closed paid access until the ledger exists. **Highest-priority risk item in this audit** (it's the one place prod is *less safe* than dev).
- `enterpriseAnalytics`, `FF_LEARNING_INTELLIGENCE` — enabling shows empty/thin data as if it were real; defer until the warehouse/LBI data is populated, or accept honest-empty dashboards.

> **No flag in this set is High enablement risk.** An earlier draft scored the four Missing-Tables flags 🔴 (risk of 500). That was corrected after inspecting `backend/routes/capadex.ts` + `competency-intelligence-engine.ts`: these handlers are **never-throws** — they catch absent-table/FK failures and return degraded 200 payloads. So they are *low risk to flip* but *low value until substrate exists* (next section).

### 🟥 Missing-Tables flags → **safe to flip, but NO value until substrate exists**
`runtimeIntelligenceActivation`, `runtimeIntelligencePipeline`, `wc3Outcome`, `commercialActivation`. Each reads an **absent table** (PIL libraries / `intervention_library` / `capadex_payments`); flipping them on does **not** crash (degraded 200 / fail-closed), but delivers nothing useful. Create/seed the missing tables **first** — see enablement plan Phases 3 & 5 — then enable for real value.

### ⚪ Low risk + Low value → **enable in dependency order, not standalone**
All the CAPADEX "Missing Data" chain flags (`decisionOrchestrator`, `wc3Stage`, `wc3Longitudinal`, `wc3Journey`, `decisionPersistence`, `userIntelligenceFoundation`, `behaviourNamespaceAlignment`, `trendIntelligence`, `behaviourTrendIntelligence`, `forecastIntelligence`) + the two bridges + `FF_COMPETENCY_INTELLIGENCE`. Safe to flip, but inert until live CAPADEX / competency assessments flow. Enable as a cohort *after* the substrate (Phases 3–4), not piecemeal.

---

## Cross-cutting risks (apply regardless of which flags are enabled)

1. **Deployment-pane blind spot (honesty caveat).** Prod env is not introspectable from the repo. If the pane already carries `FF_*` overrides or a separate `DATABASE_URL`, this entire matrix must be re-derived against that environment. **Requires owner attestation before any flag change.**
2. **"Appearance of parity" trap.** Enabling the 19 Missing-Data/Tables/Runtime flags makes prod *look* like dev (flags on) while serving empty/`{enabled:false}`/`degraded:true` responses (and a hard 503 for the `process.env`-gated routes) — a regression in honesty, not a gain. Parity is real only when flag **and** substrate align.
3. **Shared-DB coupling.** Because prod and dev share one database, any substrate seeding done "for prod" is immediately visible in dev too (and vice-versa). Mark all seeded runtime/demo rows with a provenance marker so honest audits can distinguish reference data from demo data.
4. **Restart dependency.** `process.env` gate flags (`FF_CAREER_GRAPH`, `FF_LEARNING_INTELLIGENCE`, `FF_COMPETENCY_INTELLIGENCE`, `FF_FUTURE_READINESS`) and registry env overrides are read at process start — they require a **deployment restart** to take effect, not just a config save.

---

## One-line recommendation

**Enable the 3 high-value/low-risk flags (`aiGovernance`, `FF_CAREER_GRAPH`, `FF_FUTURE_READINESS`) + the 4 low-risk product flags now; enable `commercialEntitlementEnforcement` as a deliberate security decision; hold the 4 Missing-Tables flags until their substrate is created; enable the CAPADEX data-chain cohort (incl. `FF_COMPETENCY_INTELLIGENCE`) only after the PIL/session/competency substrate exists.** No flags were enabled — **STOP for owner approval.**
