# MX-77X · Section 1 — Enterprise Workforce Intelligence: Current-State Audit

**Generated:** 2026-06-24 · **Mode:** read-only audit · **DB:** shared live PostgreSQL (== production)
**Method:** true `COUNT(*)` per table + running-backend route/flag grep + direct service smoke of the
existing console composer against the live DB.
**Honesty contract:** Coverage ⟂ Confidence reported separately; `0 rows` = honest dormant gap, never
fabricated. Existence of a table ≠ population; registration of a route ≠ data flowing through it.

> **Audit-integrity note (correction logged):** an initial pass read row counts from
> `pg_stat_user_tables.n_live_tup` and reported "all workforce tables 0 rows / dormant". That statistic
> is a **stale estimator** (tables were never `ANALYZE`d), and it was WRONG. Re-counted with true
> `COUNT(*)` + a direct composer smoke. The corrected reality below is materially more positive. Lesson
> recorded so future audits never certify dormancy off `n_live_tup`.

---

## 1. Executive summary (the one honest sentence)

The enterprise workforce architecture is **built, wired, AND operationally activated on seeded
`demo_org` data**: the MX-100X Phase-9 **Enterprise Workforce Intelligence Console**
(`/api/enterprise-workforce/*`, flag `enterpriseWorkforceConsole`, default OFF) already composes all
**8 views** (overview, skill-gap, succession, internal-mobility, workforce-planning, talent-risk,
talent-forecasting, readiness-forecasting) and every view returns `available:true` against real rows.
The genuine remaining gaps are **(a) no SuperAdmin frontend surfacing this console, (b) the flag is OFF,
(c) data is single-org DEMO seed (small-n, k-anon-suppressed cohorts) — not multi-tenant production,
(d) a few sub-layers (EIOS workforce-plan tables, future-capability forecasts, transformation scenarios)
are still empty.** Activation here = *surface + validate + honestly certify* — NOT rebuild, NOT fabricate.

---

## 2. Live data reality — TRUE `COUNT(*)`

| Subsystem | Tables (rows) | Verdict |
|---|---|---|
| **Talent Intelligence Graph** | `tig_nodes` 72 · `tig_edges` 1680 · `tig_intelligence` 40 · `tig_clusters` 2 · `tig_calibration` 5 | **WORKING** |
| **Skill-gap** | `m5_organizational_skill_gaps` 5 · `wos_skill_obsolescence` 325 | **WORKING** |
| **Succession** | `m5_succession_candidates` 5 · `m5_critical_role_successors` 5 · `m5_bench_strength_scores` 3 · `m5_leadership_gap_risks` 3 · (`m5_succession_readiness` 0) | **WORKING** |
| **Capability** | `m5_organizational_capabilities` 5 · `m5_enterprise_capability_indices` 5 | **WORKING** |
| **Workforce planning** | `m5_organizational_simulations` 3 · (`m5_workforce_transformation_scenarios` 0 · `m5_future_capability_forecasts` 0) | **PARTIAL** |
| **Talent-risk** | `wos_workforce_risk` 60 · `m5_strategic_workforce_risks` 3 · `wos_ai_exposure` 340 | **WORKING** |
| **Talent-forecasting** | `wos_market_signals` 94 · `wos_skill_obsolescence` 325 · `wos_role_emergence` 6 → 3 trends available | **WORKING** |
| **Internal mobility** | `mobility_role_transitions` 8 · `mobility_career_paths` 3 (console DERIVES readiness from succession candidates) | **WORKING (derived)** |
| **Readiness-forecasting** | `career_readiness_history` 4 → 1 subject trend (`m5_workforce_readiness_scores` 0) | **PARTIAL** |
| **EIOS workforce planning** | `eios_workforce_plans` 0 · `eios_scenarios` 0 · `eios_employee_profiles` 0 | **DORMANT** (console does not depend on these) |

**Live composer smoke (demo_org), every view `available:true`:** skill-gap `{org_skill_gaps:5,
obsolescence:25}` · succession `{candidates:5, critical:5, bench:3, gap_risks:3}` · mobility
`{candidates:5}` · workforce-planning `{scenarios:3, capability_rows:5}` · talent-risk
`{risk:50, strategic:3, ai:25}` · talent-forecasting `{trends_available:3, emerging:6}` ·
readiness-forecasting `{subject_trends_available:1}`.

---

## 3. Code reality (running `backend/`, port 8080)

- **Composer already exists:** `services/enterprise-workforce-console.ts` (v9.0.0) — PURE read-only,
  compose-never-recompute, `to_regclass`-probed reads, never-throws, k-anon (k=30), forecasts abstain
  below 2 points, unmeasured→null never fabricated 0, developmental-signal disclaimer. Composes
  `m5-workforce-intelligence`, `m5-succession`, `m5-workforce-simulation`, `m5-executive-intelligence`,
  `predictive-workforce-engine`, `wc3/longitudinal-consumption`.
- **Routes registered:** `registerEnterpriseWorkforceConsoleRoutes` → `/api/enterprise-workforce/*`
  (8 GET routes, flag-gated `enterpriseWorkforceConsole`, inline `requireAuth`+`requireSuperAdmin`).
  Also registered: `registerM5Routes`, `registerEnterpriseWorkforceOS`, `registerEmployerTIGRoutes`,
  EIOS core/intelligence/workforce.
- **Flags:** `workforceOSV2:true`, `enterpriseWorkforceOSV2:true`, `workforceIntelligence:false`,
  `enterpriseWorkforceConsole:false`.

## 4. Frontend reality

- Existing surfaces reference `enterprise-workforce-**os**` (`pages/EnterpriseWorkforceOSPage.tsx`,
  `modules/career-builder/workforce/views/EnterpriseWorkforceOSDashboard.tsx`) — a DIFFERENT subsystem.
- **No SuperAdmin panel surfaces the Phase-9 console** (`/api/enterprise-workforce/*`). SuperAdmin has
  `EnterpriseAnalyticsPanel`, `EnterpriseGovernancePanel`, `VXCapabilityArchitecturePanel`,
  `VXWorkforceKnowledgeGraphPanel` — none is the workforce console. ← **the activation gap.**

---

## 5. Classification

- **Working:** TIG; the Phase-9 console's 8 views on demo_org seed; skill-gap, succession, capability,
  talent-risk, talent-forecasting, mobility (derived).
- **Disconnected:** the console has **no frontend** + flag OFF → invisible to operators despite working.
- **Unused / dormant:** EIOS workforce-plan tables; future-capability forecasts; transformation
  scenarios; `m5_workforce_readiness_scores`; a second M5 engine copy under
  `client-main-emergent-workzip/backend/` (NOT the live data path — missing-link decoy).
- **Missing links:** (1) no multi-tenant org population (only `demo_org` seed); (2) cohort aggregates
  k-anon-suppressed because n<30; (3) no UI/probe to expose the console to super-admins.

---

## 6. Activation plan (honest, additive, no rebuild)

1. **Surface** the existing console via a flag-gated SuperAdmin panel (probe `_meta/status`; 503→hide;
   byte-identical when OFF).
2. **Validate** flag-ON live (route smoke) + flag-OFF 503 before any DB touch.
3. **Document** all 8 framework sections grounded in the real composer + true counts.
4. **Certify** honestly: console **operational on demo seed** = the architecture is activated; full
   production certification awaits real multi-tenant org data (n≥30 for cohort signals) + the empty
   forecast/EIOS sub-layers being fed.

**Honest pre-verdict:** **PASS (conditional)** — the console is operational across all 8 views on seeded
data with correct honesty discipline; the conditions are *demo-org / small-n / some empty sub-layers*,
which are disclosed, not hidden.
