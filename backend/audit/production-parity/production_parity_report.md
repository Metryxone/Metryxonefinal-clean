# Production Parity Report — MetryxOne

**Date:** 2026-06-17
**Type:** Read-only audit. **No code modified.**
**Mission:** Verify Development, Preview, and Production behave identically.
**Companion docs:** `feature_flag_inventory.md`, `feature_activation_matrix.md`.

---

## Verdict

**Development and Production do NOT behave identically.** Preview is identical to Development (same workflow process), so the real divide is **Dev/Preview vs Production**.

**Root cause (single):** The dev `Backend API` workflow command sets **28 `FF_*` env vars** that turn on additive intelligence/commercial layers. The production deployment run command (`cd backend && NODE_ENV=production npx tsx index.ts`) and `[userenv.production]` set **zero `FF_*` vars**. Therefore every flag the dev workflow flips ON falls back to its **registry default (`false`)** — or, for the four non-registry `process.env` gates, to **absent → 503** — in production.

**Scale of divergence:** **27 feature sets** behave differently (23 default-false registry flags overridden ON in dev + 4 non-registry `process.env` gates). This affects **9 of the 10 audited products**.

---

## 1. Features working in Dev but DISABLED in Production

These work in Dev/Preview and are **off (503 / `{enabled:false}` / silently degraded)** in Production.

### 1a. Fully disabled in prod (entire surface 503)
| Feature | Flag | Prod behaviour |
|---|---|---|
| **Report Factory** | `reportFactory` | all `/api/rf/*` + `/api/admin/rf/*` → 503 |
| **AI Governance** | `aiGovernance` | all `/api/governance/ai/*` → 503 |
| **Enterprise Analytics** | `enterpriseAnalytics` | all `/api/analytics/*` → 503 |
| **Career Passport** | `careerPassport` | all `/api/passport/*` → 503 |
| **LBI intelligence** | `FF_LEARNING_INTELLIGENCE` (process.env) | `lbi-intelligence.ts` / `lip.ts` → 503 |
| **Competency CI Engine** | `FF_COMPETENCY_INTELLIGENCE` (process.env) | `competency-intelligence-engine.ts` D1–D10/E1–E5 → 503 |
| **Career Graph + Talent Graph** | `FF_CAREER_GRAPH` (process.env) | `career-graph.ts`, `career-pathways-intelligence.ts`, `vx-workforce-knowledge-graph.ts`, ~8 `talent-*.ts` → 503 |
| **Future Readiness Platform** | `FF_FUTURE_READINESS` (process.env) | `frp.ts` → 503 |

### 1b. Layer disabled in prod (core works, intelligence/commercial layer off)
| Feature | Flag(s) | Prod behaviour |
|---|---|---|
| **CAPADEX Runtime Intelligence** | `runtimeIntelligenceActivation`, `runtimeIntelligencePipeline` | `/api/capadex/session/:id/guidance` & `/pipeline` → `{enabled:false}` |
| **CAPADEX WC-3 chain** | `wc3Stage/Outcome/Journey/Personalization/Longitudinal` | per-session `/stage`,`/outcome`,`/journey`,`/longitudinal` → `{enabled:false}`; no post-completion writes |
| **CAPADEX Decision orchestration** | `decisionOrchestrator`, `journeyGrowthPlanBridge`, `decisionMentorBridge`, `decisionPersistence` | `/activation` → `{enabled:false}`; no decision persistence |
| **CAPADEX Commercial** | `commercialActivation`, `commercialEntitlementEnforcement` | subscription/offer slots stay `ready:false`; **entitlement enforcement middleware becomes a pass-through** (see §4 risk) |
| **CAPADEX User/Trend/Forecast intelligence** | `userIntelligenceFoundation`, `trendIntelligence`, `behaviourTrendIntelligence`, `forecastIntelligence`, `behaviourNamespaceAlignment` | no longitudinal/trend/forecast writes; getters report disabled |
| **EIOS World-Class V2 depth** | `eiosWorldClassVerifiedV2` | WS15 checks keep static pass; snapshot capture off; export routes 503 |

---

## 2. Features VISIBLE in UI but returning 503

**Mechanism:** Production serves the **same frontend build** as dev (deployment build copies `frontend/dist` into `backend/public`). The frontend is **not flag-aware at build time** — it has no compile-time knowledge of which backend `FF_*` are set in prod. So any admin panel / nav entry whose data calls a flag-gated backend route will **render its shell and then receive 503** in production, unless that panel first calls an `enabled`-probe endpoint and self-hides.

| UI surface (likely visible) | Backing route (503 in prod) | Self-hides? |
|---|---|---|
| Report Factory panel (SuperAdmin) | `/api/rf/*`, `/api/admin/rf/*` | Unverified — likely shows then 503 |
| AI Governance panel | `/api/governance/ai/*` | Unverified |
| Enterprise Analytics / Executive cockpits | `/api/analytics/*` | Unverified |
| Career Passport UI | `/api/passport/*` | Unverified |
| LBI intelligence surfaces | `FF_LEARNING_INTELLIGENCE` routes | Unverified |
| Career Graph / Talent Graph admin + career tabs | `FF_CAREER_GRAPH` routes | Unverified |
| Future Readiness tab (`future-readiness`) | `frp.ts` routes | Unverified |
| Competency CI Engine surfaces | `FF_COMPETENCY_INTELLIGENCE` routes | Unverified |

> **Honesty note:** Some flag comments explicitly say "the dashboard panel hides" (e.g. `simulationHarness`), which means *certain* panels do gate on a status probe. But panel-hide depends on whether each component queries an enabled-flag endpoint — and the frontend cannot read backend env directly. **I did not exhaustively trace every panel's mount-time gating**, so "self-hides?" is marked *Unverified* rather than guessed. **Confidence: medium.** A definitive answer requires either (a) a flag-status API the frontend consumes, or (b) hitting prod live (out of scope for audit-only).

---

## 3. Features hidden due to flag configuration

These are **dormant in ALL environments** (default-false, never overridden) — so they are *consistent* (no Dev↔Prod gap) but are **shipped-but-dark** code:

`hypothesisDrivenClarity`, `simulationHarness`, `signalGroundingRuntime`, `runtimeMetadataActivation`, `wc3QuestionIntel`, `wc3ContextIntel`, `wc3OutcomeCrosswalk`, `runtimeIntelligenceConsumption`, `longitudinalAutomation`, `behaviourSignalBackfill`, `revenueIntelligence`, `commercialEntitlement`, `commercialRenewal`, `commercialUpsell`, `commercialLifecycleState`, `commercialForecastInputs`, `wc3ReportPersonalization`, `wc3RecPersonalization`, `wc3LongitudinalConsumption`, `interventionIntelligence` **(20 flags)**.

Plus the **DB flag system** (`feature_flags` table, **10 rows, all `enabled=false`** — 0 enabled; 0 tenant overrides): the 10 keys (`adaptive_questioning`, `cognitive_load_engine`, `confidence_engine`, `contradiction_detection`, `dynamic_reporting`, `hypothesis_engine`, `interventions`, `longitudinal_memory`, `signal_intelligence`, `websocket_runtime`) all exist but are OFF, so any consumer gated by it (e.g. `POST /api/signals/ingest` `signal_intelligence`) is **dark in every environment** — consistent, but also un-activatable until a row is flipped `enabled=true`.

---

## 4. Security-relevant parity finding (flag-off is NOT always neutral)

> Most flags are designed so flag-OFF = byte-identical legacy behaviour. **One is not neutral in the way it matters for prod:**

- **`commercialEntitlementEnforcement` is ON in Dev/Preview but OFF in Prod.** Per the flag comment, flag-OFF makes `requireEntitlement` a **synchronous pass-through (`next()` before any await)**. That means the paid CAPADEX report/intelligence surfaces (insight/growth/mastery reports) that are **entitlement-gated in dev are NOT enforced in production**. If those paid surfaces are reachable in prod, they would serve **without the entitlement check**. This is the inverse of a normal "feature missing in prod" gap — here a **protection present in dev is absent in prod**. Flagged for owner attention (audit-only; not changed).

---

## 5. Recommendations (NOT applied — audit only; owner decision required)

1. **Decide the intended production flag posture.** Either (a) replicate the dev `FF_*=1` set into the deployment (`.replit [deployment]` env or Deployment-pane), or (b) accept that prod ships core-only and remove the misleading UI entries. Today prod silently runs a **different product** than dev/preview.
2. **Close the verification caveat.** Confirm whether the **Deployment pane** carries any `FF_*` overrides (not visible from the repo). Until confirmed, prod state is "derived from visible config," not proven.
3. **Prioritise the entitlement-enforcement gap (§4)** — confirm whether paid surfaces are live in prod; if so, enabling `FF_COMMERCIAL_ENTITLEMENT_ENFORCEMENT` in prod (or gating the paid routes another way) is a revenue/security concern, not just a feature gap.
4. **Make the frontend flag-aware** (a single `/api/flags/public` probe the panels consume) so UI entries self-hide instead of rendering → 503 (§2).
5. **Triage the 20 dark flags + empty DB flag table** — either activate, or remove dead code paths, so "shipped" matches "reachable."

---

## Appendix — evidence & method

- **Flag registry:** `backend/config/feature-flags.ts` — 72 flags (29 `true` / 43 `false`); override algorithm `FF_ + key.replace(/([A-Z])/g,'_$1').toUpperCase()`; resolution `envOverride ?? default`.
- **Dev/Preview env:** `.replit` → `[[workflows.workflow]] name="Backend API"` command, 28 `FF_*=1`. Preview proxies this same process (no separate env).
- **Prod env:** `.replit [deployment].run` (no `FF_*`); `[userenv.production]` = `APP_URL` only; `[userenv.shared]` = Firebase only.
- **Non-registry gates:** grep of `const FLAG = 'FF_*'` / `process.env.FF_*` across `routes/*.ts` → `FF_CAREER_GRAPH`, `FF_LEARNING_INTELLIGENCE`, `FF_COMPETENCY_INTELLIGENCE`, `FF_FUTURE_READINESS`.
- **DB flag system:** `backend/services/feature-flags.ts` over `feature_flags`. Measured: `count(*)` = 10, `count(*) filter (where enabled)` = 0, `feature_flag_tenant_overrides` count = 0.
- **Not performed (out of scope / not possible for audit-only):** live HTTP probes against the production deployment; exhaustive per-panel frontend mount-gating trace; Deployment-pane env introspection. These are the source of every "Unverified"/"medium confidence" marker above and are **honestly disclosed rather than assumed**.
