# MX-73X · Section 6 — Interview Intelligence Framework

> Documents `deriveInterviewRecommendation` (`services/employer-competency-intelligence.ts`).
> Read-only; generated from the competency-driven match. Never fabricates a gap.

## Generated from
```
Role DNA requirements  →  match.requirements
Measured gaps          →  match.gaps                 (focus areas — real, below-target)
Unassessed reqs        →  match.unassessedRequirements (probe areas — gather evidence)
Readiness gaps         →  match.candidateReadiness
Risk areas             →  coverage-thin / uncalibrated → broaden interview
```

## Outputs
- **Focus areas** (`focusAreas`): top measured gaps ranked by `weight` then shortfall. Each carries
  `targetScore`, `candidateScore`, `shortfall`, `importanceTier`. These are real, measured — never
  invented.
- **Probe areas** (`probeAreas`): role requirements with NO candidate competency data — explicitly
  "gather evidence in interview", never scored.
- **Structure** (`structure`):
  - `baseline_competency_assessment` — no measured profile.
  - `broad_competency_assessment` — coverage thin.
  - `targeted_competency_deep_dive` — sufficient coverage + measured gaps.
  - `confirmation_interview` — sufficient coverage, no gaps.

## Language policy
Allowed: interview focus area, evidence to gather, developmental focus, gap band. Disallowed:
hire/no-hire verdict, suitability score, guaranteed performance. The framework recommends what to
probe — it never asserts a decision.

## Relation to the legacy blueprint
`routes/employer-hiring-intelligence.ts` still contains a heuristic `generateInterviewBlueprint`
(keyword-based). It is the gated fallback; the competency-driven recommendation above is primary
when `employerCompetencyHiring` is on. No new parallel interview engine is introduced.
