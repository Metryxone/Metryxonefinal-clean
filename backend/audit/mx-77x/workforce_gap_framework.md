# MX-77X · Section 4 — Workforce Skill-Gap Intelligence

**Status:** WORKING on demo_org seed.
**View:** `/api/enterprise-workforce/skill-gap` (`skillGapView`).
**Engines:** `m5-workforce-intelligence.skillGaps`, `predictive-workforce-engine.listObsolescence`.
**Tables (live):** `m5_organizational_skill_gaps` 5 · `wos_skill_obsolescence` 325.

## Inputs → outputs
```
Current Skills · Required Skills · Emerging Skills · Future Skills
```
- **Current vs Required** → `m5_organizational_skill_gaps` (5 org gap rows: current vs role-target proficiency).
- **Emerging / Future** → `wos_skill_obsolescence` (325 obsolescence rows = decline signal) +
  `wos_role_emergence` (6, forward indicator surfaced in talent-forecasting).

## Outputs
- **Critical Gaps** — org skill-gap rows ranked by gap magnitude (coverage 5).
- **Emerging Risks** — obsolescence rows (coverage 325, the richest signal).
- **Capability Risks** — joined into talent-risk (Section 9) via strategic + workforce risk.
- **Future Readiness Risks** — obsolescence + emergence trend (talent-forecasting, 3 trends available).

## Coverage ⟂ Confidence
- **Coverage:** obsolescence very high (325); org-specific gaps small (5, seed).
- **Confidence:** obsolescence is market-derived (broad, trustworthy as a signal); org gaps are seed and
  single-org → directional, not benchmarked (k-anon suppresses cohort comparison at n<30).

## Honest gaps
- "Future Skills" has no independent taxonomy here — it is proxied by obsolescence decline + emergence;
  this is disclosed in provenance, never presented as a distinct measured dimension.
