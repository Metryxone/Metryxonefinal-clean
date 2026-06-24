# MX-76X · Section 11 — Super Admin Global UI

**Surface:** `SuperAdminDashboard.tsx` → new lazy panel `GlobalIntelligencePanel.tsx`
(`components/admin/`). **Data:** `GET /api/global-intel/overview` (super-admin gated).
**Visibility:** nav tab conditionally rendered ONLY when `GET /api/global-intel/enabled` → `res.ok`
(flag-OFF → tab hidden → byte-identical legacy UI).

## Status: **IMPLEMENTED** (this task)
The SuperAdmin panel is built and wired in this task as the concrete proof-of-activation. Employer
and candidate panels are design-complete (Sections 12–13) and consume the same flag probe; their
wiring into the employer/candidate shells is staged as a follow-up to avoid unapproved churn in those
shells (declared honestly in `global_certification.md`).

## Panel layout (4 honest cards)
1. **Region Coverage** — table over `overview.regions.regions`: canonical code, label, status
   (`native` / `partial_native` / `empty`), and per-surface coverage (competency_models, role_library,
   demand_intelligence, benchmark_cohorts, market_signals). Empty regions (AFRICA/LATAM) render an
   **"Insufficient Evidence — no content assigned"** badge, never a 0% that implies measured emptiness.
   Crosswalk (`phase8` / `m4_parent` / `m4_coarse`) shown in a tooltip so the three-taxonomy
   reconciliation is transparent.
2. **Country Localization** — `overview.countries.localized`: ISO2, name, m4 region, canonical
   regions, language, labor_regime, resolved currency. Footer states `localized_count` of all
   countries; any other country = `not_localized` (explicit).
3. **Benchmark Tiers** — `overview.benchmarks.tiers` bar; `region_cohorts_latent` flag; country tier
   shows **"Not Measurable"** (no country cohort / no ≥k_min population). k-anonymity note surfaced.
4. **Localization** — report vs UI language coverage, `report_only_languages` highlighted as a gap,
   currency resolver countries + `fx_conversion:false` disclaimer.

## Honesty rules in UI
- Coverage ⟂ Confidence: a region can have high *coverage* (419 inherited competency models) yet low
  *nativeness* (inherited, not region-authored) — both shown, never conflated.
- `null` → "Insufficient Evidence" / "Not Measurable", never rendered as `0`.
- `version` + `honesty` string from the overview payload printed in the panel footer.
- Flag-OFF → panel never mounts (probe fails) → zero new UI.
