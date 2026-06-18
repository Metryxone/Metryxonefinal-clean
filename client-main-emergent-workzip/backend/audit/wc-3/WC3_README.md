# CAPADEX WC-3 — Intelligence Layer Implementation Design

> **Phase type:** Design only (per request). No implementation, no schema/runtime changes executed,
> no enrichment, no code/DB/production changes. Designs *how* to build the 7 layers that raise the five
> WC-2 tracks toward 90+. **STOP — WAIT FOR APPROVAL.**

## Headline

WC-3 designs 7 additive, flag-gated intelligence layers on top of the WC-2 baseline
(**World-Class Readiness 51/100**). The design **fully closes the design-reachable gap** (Stage /
Outcome / Longitudinal / Outcome-Validation to 85–92, plus the no-enrichment Personalization/Routing
wiring) and **sequences the enrichment-gated gains** (Question Intelligence 2.0 + full Personalization)
behind the C-2 Waves and the Exam corpus. Honest repo-wide ceiling ≈ **82–86 (Advanced)**;
**90+ across all layers is not reachable repo-wide** (carried forward from WC-2 and flagged below).

## Produced artifacts (the 6 required outputs)

| # | WC-3 Output | File |
|---|---|---|
| 1 | WC-3 Architecture | [WC3_ARCHITECTURE.md](./WC3_ARCHITECTURE.md) (incl. all 7 layer specs) |
| 2 | Data Model | [WC3_DATA_MODEL.md](./WC3_DATA_MODEL.md) |
| 3 | Runtime Design | [WC3_RUNTIME_DESIGN.md](./WC3_RUNTIME_DESIGN.md) |
| 4 | Migration Plan | [WC3_MIGRATION_PLAN.md](./WC3_MIGRATION_PLAN.md) |
| 5 | Validation Plan | [WC3_VALIDATION_PLAN.md](./WC3_VALIDATION_PLAN.md) |
| 6 | Implementation Roadmap | [WC3_ROADMAP.md](./WC3_ROADMAP.md) |
| — | Machine-readable companion | [wc3.json](./wc3.json) |

## The 7 layers (each spec'd with Current/Target/Architecture/Schema/Runtime/Reports/Validation/Success in the Architecture doc)

| # | Layer | Current | Target | Realistic band | Design-reachable? |
|---|---|---|---|---|---|
| L1 | Stage Intelligence | 45 | 90 | 88–92 | **Yes** |
| L2 | Outcome Intelligence | 42 | 90 | 85–90 | **Yes** (Exam gated) |
| L3 | Journey Intelligence | 50 | 90 | 80–88 | Partial (Exam corpus) |
| L4 | Dynamic Personalization | 55 | 90 | 78–85 | Partial (enrichment-gated) |
| L5 | Question Intelligence 2.0 | 51 | 90 | 76–82 | Partial (C-2 Waves) |
| L6 | Longitudinal Intelligence | ~40 | 90 | 85–92 | **Yes** (accrues over time) |
| L7 | Outcome Validation | ~30 | 90 | 85–92 | **Yes** (accrues over time) |

## Unreachable-target flags (carried from WC-2, per prior approval)

- **Repo-wide 90+ for L4/L5/L3** is bounded by the differentiability ceiling (~0.55) and the
  Competitive-Exam corpus gap (routes 0). Achievable on enriched cohorts / specific pathways, not as a
  repo-wide mean, until the C-2 enrichment waves run and the corpus is authored.
- **AIS > 95 / Trust > 90** remain credential-adoption-bound (separate track), not addressable by
  WC-3 layers.

## What WC-3 does NOT do

No new ontology/signals/concerns/archetypes/capabilities, no enrichment, no engines built, no tables
created, no migrations run, no runtime changes deployed, no `replit.md`/production changes. Every
proposed table is additive `wc3_*` with a reversible `DROP TABLE` down-path.

## Relationship to prior phases

Builds directly on the WC-2 honest-measurement package (`backend/audit/wc-2/`) and reuses the C-1AR
rollout governance + C-1A pilot evidence. Current-state scores are the WC-2 baseline, unchanged.

## STOP — WAIT FOR APPROVAL
