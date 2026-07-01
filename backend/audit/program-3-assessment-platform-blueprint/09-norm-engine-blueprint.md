# 09 · Norm Engine Blueprint (Layer 6)

**Mode:** Read-only / planning-only. No changes. **Layer status: PARTIAL.**

## Canonical Definition
The Norm Engine provides norm-referenced interpretation: comparing an individual's score against a defined reference population (age, gender, education tier, competitive-exam cohort, job-seeker/professional/leadership band, organization/industry/region/country) with versioning and governance. Primary implementation: `services/lbi-norms-engine.ts` (real population norms) plus `services/weighting-engine.ts` (context policies — **not** population norms).

## Capability Evidence (honest, precise)
| Capability | Status | Repository Evidence / Note |
| :-- | :-- | :-- |
| Age Norms | SUPPORTED | `lbi-norms-engine.ts` (`JOIN lbi_age_bands`); `lbi_subdomain_norms.age_band_code` — **real population norms**. |
| Gender Norms | **MISSING** | No gender-based normalization table or logic. → GAP-AP-4 (Medium; may be a deliberate ethics/privacy decision). |
| Education Norms (student/school/college/university) | **MISSING** | No academic-tier norm tables. Student *segments* exist for benchmarking, but not as norm reference groups. → GAP-AP-5 (Medium). |
| Competitive Norms (JEE/NEET/CUET) | **MISSING** | Persona *question banks* exist for these cohorts, but no competitive-exam **norm tables**. → GAP-AP-6 (Medium). |
| Job-Seeker / Professional / Leadership | PARTIAL | `weighting-engine.ts` seniority modifiers (junior/mid/senior/lead/executive) — these are **weighting policies**, not population norms. |
| Organization / Industry Norms | PARTIAL→SUPPORTED (as benchmarks) | `weighting-engine.ts` industry policies + `ti_industry_benchmarks` (benchmark, not classic norm). |
| Regional / Country Norms | PARTIAL | `weighting-engine.ts` geography policies (apac/emea/amer/global); country-level norms/benchmarks absent (see Layer 8 GAP-AP-8). |
| Norm Versioning | SUPPORTED | `EVALUATION_ENGINE_VERSION` / `WEIGHTING_VERSION`; `lbi_subdomain_norms.computed_at`. |
| Norm Governance | SUPPORTED | `lbi-norms-engine.ts` honesty contract — `is_provisional` for small samples; fabrication forbidden. |

## Critical Honesty Distinction
The platform conflates three different concepts that this blueprint keeps **separate**:
1. **Population norms** (a reference distribution to compare an individual against) — present only for **age** (`lbi_subdomain_norms`).
2. **Weighting policies** (context multipliers by seniority/industry/geography) — present in `weighting-engine.ts`; these tune scoring, they are **not** norms.
3. **Benchmark cohorts** (k-anonymized peer percentiles) — present in `benchmark-engine.ts` / `ti_*` (Layer 8); these are relative comparisons, not standardized norms.

Reporting any weighting policy or benchmark cohort as a "norm" would be a fabrication. The honest verdict: **real norm coverage is age-only; the other populations we serve (gender, education tier, competitive-exam) have NO population norms yet.**

## Gaps
- **GAP-AP-4 (Medium):** Gender population norms — MISSING (evaluate ethics/legal before building).
- **GAP-AP-5 (Medium):** Education-tier population norms — MISSING.
- **GAP-AP-6 (Medium):** Competitive-exam (JEE/NEET/CUET) population norms — MISSING (banks exist, norms don't).

## Freeze Position
**FREEZE the norm ARCHITECTURE** (`lbi-norms-engine.ts` pattern: per-population norm tables + versioning + `is_provisional` governance). The missing populations are **data/coverage gaps filled by the SAME engine**, not architecture changes. Do not fabricate norms; a norm exists only when a real, sufficiently-sampled reference distribution is computed. This is the primary reason the layer is PARTIAL, not SUPPORTED.
