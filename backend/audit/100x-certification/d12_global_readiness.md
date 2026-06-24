# D12 — Global Readiness (NEW domain) · 100X Re-certification

**Verdict: PARTIAL (strong).** **Score: 75/100** (was 42/100 — the content half of the 99X "no country dimension" gap is now authored, not just the mechanism).

## Live evidence
- `global_region_content` table: **EXISTS** (`to_regclass` resolves).
- Region content rows: **2,060** (provenance `phase8_global_competency`), distributed **515 per priority region** across `ME`, `EU`, `US`, `APAC`.
- Per priority region: **4/5 surfaces** now carry curated content — `role_library` (5), `competency_models` (419), `benchmarks` (10), `demand_intelligence` (81).
- Region-aware read (`GET /api/global-competency/content/:region`): non-default regions now resolve to their **curated overlay** (`source:"overlay"`, `localized:true`) instead of silently falling back to the base/un-localized set.

## What changed since the 42/100 baseline
- **Content authored.** The Phase 8 region overlay is no longer empty: existing **universal** entities (region-agnostic role definitions, the scientific competency genome, global/structural benchmark cohorts, and global market signals) are region-tagged into `global_region_content` for the four priority non-default regions. Every row carries a `detail.basis` curation note and is fully reversible via provenance.
- **Localized read path added.** `resolveRegionContent` serves the default region from the base tables (== today, India-centric) and every non-default region from its curated overlay **only** — surfaces with no curated content resolve to an honest `empty`, never a silent base fallback.

## Honest gaps (why 75, not higher)
- The authored content is **universal-inheritance curation**, not region-native data: it declares which existing universal entities constitute each region's deployable set. It does **not** add region-specific benchmark *statistics*, region-native roles, or localized demand figures — that is content acquisition we will not fabricate.
- **`readiness_models` is intentionally empty for non-default regions.** `career_readiness_history` holds individual user snapshots (subject-specific), not regionalizable reference content; leaving it at 0 is the honest finding (each priority region is 4/5, not 5/5).
- **Role-specific statistical benchmark cohorts (`coh_role_*`) are deliberately excluded** from the overlay because their statistics are India-population-derived; tagging them to another region would imply region-native statistics we do not have. The benchmark overlay is therefore an honest **subset** (10 of 15 cohorts).

## Why not PASS
The structural gap (no country/region dimension) is closed and the dimension now carries real, auditable content with a localized read path. A full PASS would require region-native statistics (benchmarks, demand, roles) per region — genuine content acquisition — which is out of scope and would be fabrication if invented.
