# Global Scale Readiness

**Task:** MX-98X-ENTERPRISE-COMPETENCY-TRANSFORMATION · Section 7
**Date:** 2026-06-23 · Read-only. Evidence = live counts + explorer trace of tenant/governance/i18n services.

## Headline
**Tenant + governance + enterprise-analytics architecture is built and structurally multi-everything; the gaps are international (country/currency/residency) and activation (4 tenant records exist but no real workforce data — `tenant_capability_profiles` = 0).** A `tenants` table already models 5 tenant *types* (school/university/enterprise/government/ngo); isolation, RBAC (Governance V2), and EIOS enterprise pillars exist. What's missing for true global scale is locale/currency awareness in the *intelligence engines* and real multi-tenant data volume.

---

## Readiness per scale axis

| Axis | State | Evidence | Gap |
|---|---|---|---|
| **Multi-Industry** | 🟡 ready (breadth on reference) | `ont_industries` 206; curated 2; `m3_industry_demand` 4 | seed curated industries; live market depth |
| **Multi-Country** | ⬜ **not ready** | i18n locale files exist (`frontend/src/locales`) but engines are **locale-agnostic**; no data-residency, no region in core schemas | add country dimension + residency policy |
| **Multi-Employer** | 🟡 structurally ready, unexercised | employer stack + `tenants` (enterprise type); `employer_*` 0 | onboard real employers |
| **Multi-Assessment** | ✅ ready | `onto_assessment_blueprints` 6, `custom_assessment_modules`, LBI/SDI/competency frameworks coexist | scale item banks |
| **Multi-Tenant** | 🟡 built, pilot data | `tenants` **4**; isolation via `tenant-isolation-enforcement.ts` + `org_id`/`tenant_id`; `tenant_capability_profiles` **0** | real tenant data; verify isolation under load |
| **Enterprise Scale** | 🟡 built, empty | `m5_*` ~60 tables, EIOS P3/P7/P8; pilot 5-row seeds; forecasts 0 | real org onboarding |
| **Government Scale** | 🟡 type modelled | `tenants.tenant_type='government'` | compliance/residency requirements likely; not yet addressed |
| **University Scale** | 🟡 type modelled + product fit | `tenant_type='university'`; LBI student product mature | cohort/institution analytics activation |
| **Staffing Scale** | 🟡 substrate present | employer + TIG + calibration; volume-dependent | high-throughput candidate pipeline + calibration data |

---

## Cross-cutting readiness

### Tenant isolation & RBAC ✅ (structural)
- `tenants` table: `tenant_code`, `tenant_name`, `tenant_type`, `subscription_tier`, `settings` JSONB.
- Isolation: `tenant-isolation-enforcement.ts` / `tenant-isolation-engine.ts`; TIG scoped by `org_id` (`tig_nodes/edges/intelligence`).
- RBAC: Governance V2 (`governance-v2.ts`) — human overrides (Art. 22), model registry, explainability chains.
- **Gap:** most route protection is `requireAuth` + `orgId` injection; per-tenant isolation should be **verified under adversarial/load test** before scale (no evidence of an isolation test suite).

### Internationalization ⬜ (the real global-scale gap)
- Locale files exist frontend-side, but **backend intelligence engines do not consume locale/currency/region**.
- `eios-core.ts` workforce-cost impacts appear **hardcoded** (no currency conversion).
- **No data-residency** strategy evident.
- → Multi-country is the **least-ready axis** and the one that most blocks "global" claims.

### Enterprise analytics ✅ (structural) / ⬜ (data)
- EIOS pillars P3 (capability/readiness), P7 (9-box performance×potential), P8 (succession/bench strength) implemented; `eios_*` tables **all 0**.
- M5 workforce intelligence (department health, AI readiness, future workforce) — pilot 5-row seeds.

### Anonymity / compliance
- k-anonymity (k_min=30) **enforced** for peer-benchmarking (cohort-widen → hard-redact).
- **Gap:** not explicitly enforced for EIOS department heatmaps → small-department leakage risk (must close before government/enterprise scale).

---

## Recommendation (additive, no rebuild) — order
1. **Add the country/currency/region dimension** to tenant + intelligence engines (the keystone for "global"); start with currency in cost models + region tag on tenants.
2. **Verify tenant isolation** with an explicit isolation test suite before onboarding multiple real tenants.
3. **Extend k-anonymity** to EIOS department heatmaps (compliance prerequisite for gov/enterprise).
4. **Onboard one real tenant per type** (university, enterprise, staffing) to move from 5-row pilots to real-scale data.
5. **Define data-residency policy** for government/regulated tenants.

The platform is **multi-tenant and multi-type by design today**; "global scale" specifically requires the **international layer (country/currency/residency) + isolation verification + real tenant volume** — all additive.

---

## Evidence ledger
- **Counts** (`tenants` 4 with types school/university/enterprise/government/ngo; `tenant_capability_profiles` 0; `tenant_relationships` 0; `eios_*` 0; `m5_*` pilot 0–5; `ont_industries` 206; `m3_industry_demand` 4; `ti_industry_benchmarks` 66) → live shared-DB `count(*)`, 2026-06-23 session.
- **Tenant model, isolation, RBAC, EIOS pillars, i18n state** (`tenants` schema fields; `tenant-isolation-enforcement.ts`/`-engine.ts`; TIG `org_id` scoping; Governance V2 Art. 22 overrides; EIOS P3/P7/P8; frontend `frontend/src/locales` present but engines locale-agnostic; hardcoded cost in `eios-core.ts`; k-anon enforced for peer-benchmark but not EIOS heatmaps) → explorer trace of `tenants.ts` / `eios-core.ts` / `governance-v2.ts` / `m5-enterprise-workforce.ts` (this session) + memory `.agents/memory/eios-architecture.md`, `employer-tig-architecture.md`.
- **"No data-residency / no currency conversion / no isolation test suite"** are asserted absences from the trace; verify before implementation.
- Per-axis readiness glyphs are author classifications, not measured metrics.
