# WC-P1 — D8: Career Routing Readiness

**Coverage**: 20% | **Confidence**: 15%

---

## Evidence

| Component | Value |
|---|---|
| Occupations available | 30 |
| Occupation pathways | 3 |
| Occupation skills (total) | 50 |
| Role-family coverage | IT/Finance/Product/Data/Engineering (from sample) |
| Seniority levels mapped | mid, senior, director, c_suite confirmed |
| `/api/employability/occupations/:id/pathways` | HTTP 200 (route present) |
| Market demand data | Not probed (occupationId required) |

---

## Routing Graph Assessment

With 3 pathways, career routing can serve at most 3 direct-progression recommendations. Realistic career routing requires:

- **Entry → Mid → Senior → Lead → Director** chains across major role families.
- **Lateral move** pathways (e.g., Data Analyst → Product Analyst → Product Manager).
- **Domain transition** pathways (e.g., QA Engineer → DevOps → Platform Engineering).

The 3 currently seeded pathways cannot cover any of these patterns meaningfully.

---

## What Works

- `forecastTrajectory()`: queries pathways, schedules milestones — real code.
- `findTopRoleMatches()`: ranks occupations by fit score — real code.
- The routing infrastructure (tables, routes, services) is production-grade.

---

## What Doesn't Work (for end users today)

- Trajectory forecasts are only meaningful for 3 predefined progression pairs.
- Most users will receive a trajectory with 0 milestones (no pathway from their current role to target).
- The 30-occupation catalog covers a narrow band of tech/product/data roles; healthcare, finance, manufacturing, etc. are absent.

---

## Actions to Reach 95%

1. Expand to ≥200 occupations across 8–10 industry verticals.
2. Seed ≥50 occupation pathways (prioritise common Indian career progressions).
3. Add lateral and domain-transition pathway types.
4. Wire market demand data (`occupation_market_demand` table — confirm if seeded).
