# WC-P1 — D6: Outcome Intelligence Readiness

**Coverage**: 25% | **Confidence**: 20%

---

## Evidence

| Component | Measured Value |
|---|---|
| Occupations in DB | 30 |
| Occupation skills (total) | 50 |
| Avg skills per occupation | 1.7 |
| Occupation pathways | 3 |
| Trajectory forecasts stored | 1 |
| kg_edges (Employability KG) | 60 |
| iil_employability_network | 0 (empty) |
| Role-fit route | HTTP 500 |
| Role-matches route | HTTP 200 |
| Trajectory route | HTTP 401 |

---

## Occupation Graph Density

30 occupations × avg 1.7 skills = 50 occupation_skills rows.

A production-grade outcome engine needs:
- **≥200 occupations** covering most Indian industry verticals.
- **≥8–10 skills per occupation** on average for meaningful role-fit scoring.
- **≥50 pathways** for realistic career routing.

Current state: 30 occupations, 1.7 skills/occupation, 3 pathways. This is a seed scaffold — not a production dataset.

---

## What Works

- `computeRoleFit()`: real implementation — queries occupation_skills, computes skill match/gap scores, generates recommendations.
- `findTopRoleMatches()`: real implementation — ranks occupations by fit score.
- `forecastTrajectory()`: real implementation — schedules milestones from pathways.
- Routes registered and returning non-404 responses.

---

## What Doesn't Work (for production use)

- With only 3 pathways, trajectory forecasts are meaningful for at most 3 origin→destination pairs.
- With avg 1.7 skills/occupation, skill-match scores are low-signal (most required skills are not mapped).
- `iil_employability_network` is empty — advanced network analysis unavailable.

---

## Actions to Reach 95%

1. Expand to ≥200 occupations covering IT/Finance/Healthcare/Engineering/HR verticals.
2. Map ≥8 skills per occupation (essential/important/optional).
3. Build ≥50 occupation pathways (common Indian career progressions).
4. Seed `iil_employability_network` or deprecate it.
