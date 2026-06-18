# CAPADEX WC-2 — World-Class Transformation Program

> **Phase type:** Design + Honest Measurement (per user approval). **No** new engines, **no** ontology
> /signal/concern/archetype/capability/graph expansion, **no** large-scale enrichment, **no**
> re-audit of completed layers, **no** code/DB/production changes. Every target is measured honestly
> against current state; unreachable targets are flagged with realistic bands. **Roadmap only — STOP
> for approval.**

## Headline

**CAPADEX World-Class Readiness Score = 51 / 100 → Tier "Developing (Operational)".**
A production-capable diagnostic engine, not yet a world-class development platform. The gap is
concentrated in (a) within-question distinctness (architectural — needs the gated C-2 waves) and
(b) the absence of *design layers* for Stage / Outcome / Growth-Journey intelligence (reachable by
design alone, no data change).

## Outputs → files

| # | WC-2 Output | File |
|---|---|---|
| 1 | Question Intelligence Report | [WC2_QUESTION_INTELLIGENCE.md](./WC2_QUESTION_INTELLIGENCE.md) |
| 2 | Personalization Readiness Report | [WC2_PERSONALIZATION.md](./WC2_PERSONALIZATION.md) |
| 3 | Stage Intelligence Framework | [WC2_STAGE_INTELLIGENCE.md](./WC2_STAGE_INTELLIGENCE.md) |
| 4 | Outcome Intelligence Framework | [WC2_OUTCOME_INTELLIGENCE.md](./WC2_OUTCOME_INTELLIGENCE.md) |
| 5 | Growth Journey Architecture | [WC2_GROWTH_JOURNEY.md](./WC2_GROWTH_JOURNEY.md) |
| 6 | Routing Readiness Report | [WC2_ROUTING_READINESS.md](./WC2_ROUTING_READINESS.md) |
| 7 | AIS Delta Report | [WC2_AIS_TRUST_DELTA.md](./WC2_AIS_TRUST_DELTA.md) |
| 8 | Trust Score Delta Report | [WC2_AIS_TRUST_DELTA.md](./WC2_AIS_TRUST_DELTA.md) |
| 9 | CAPADEX World-Class Readiness Score | [WC2_ROADMAP_AND_READINESS.md](./WC2_ROADMAP_AND_READINESS.md) |
| — | Machine-readable companion | [wc2.json](./wc2.json) |

## Honest-measurement contract (applied to every track)

Each track is scored with: **Current Score · Stated Target · Realistic Target Band · Gap · Evidence ·
Root Cause · Estimated Effort · Expected Impact**, plus the **smallest set of changes** to move it
toward world-class.

## Per-track summary

| Track | Current | Stated target | Realistic band | Reachable by design alone? |
|---|---|---|---|---|
| Question Intelligence | 51 | > 90 | 76–82 | Partial (needs C-2 waves) |
| Personalization | 55 | > 90 | 78–85 | Partial (wiring helps a lot) |
| Stage Intelligence | 45 | > 90 | 88–92 | **Yes (design-heavy)** |
| Outcome Intelligence | 42 | > 85 | 82–88 | **Yes (compose existing)** |
| Growth Journey | 50 | > 90 | 80–88 | Partial (Exam pathway gated) |
| Routing Readiness | 53 | > 90 | 80–88 | Partial (wiring helps) |
| AIS | 60 | > 95 | 78–85 | No (credential adoption) |
| Trust Score | 60 | > 90 | 76–84 | Partial |

## Unreachable-target flags (per approval)

- **AIS > 95** — mathematically unreachable for uncredentialed sessions (baseline 60, multiplier ceiling 1.3). Realistic: **AIS ≥ 80 credentialed / ≥ 68 mean**.
- **Question Intelligence / Personalization > 90 repo-wide** — bounded by the differentiability ceiling (~0.55). Realistic: **76–85**.
- **Growth Journey > 90 repo-wide** — bounded by the Competitive-Exam corpus gap (routes 0). Realistic: **80–88**.

## Grounding (read-only)

Current-state numbers reuse the canonical audit-chain measurements (AQ / C-1 / C-1A / Pilot / C-1AR)
for consistency with the consolidation package. Live schema spot-checks: 30,638 clarity questions /
325 bridge tags / 2,489 concerns master; `capadex_question_metadata` persists
`question_intelligence_score` + the legacy dimensions (no context/archetype columns — those shipped in
the enrichment layer in the prior C-2).

## STOP — WAIT FOR APPROVAL

Design + measurement only. Nothing was built, enriched, or changed in code/DB/production.
