# MX-301A — Database Evidence

Canonical-table row counts for candidate `user_4286d980cc6cc038` (PII masked). null≠0: a count of 0 is an
honest empty, distinct from a query error.

| Table | Rows for candidate |
|-------|--------------------|
| `users` | 1 |
| `career_seeker_profiles` | 1 |
| `onto_competency_score_runs` | 1 |
| `onto_competency_profiles` | 1 |

## Per-stage DB assertions

| # | Stage | DB state |
|---|-------|----------|
| 1 | Registration | users=1, career_seeker_profiles=1 |
| 2 | Authentication | super-admin session established=true (mode=direct) |
| 3 | Profile completion | completeness=85%, data_present=true |
| 4 | Role selection | target role = Director of Product (demo role: "Senior Product Manager") |
| 5 | Role DNA resolution | resolved role_id=role_pm, requirement competencies=0 |
| 6 | Adaptive assessment (question engine) | approved + active competency-mapped questions available = 23 |
| 7 | Response capture (scorer executes) | scorer ran persist:false (read-only) — no DB write expected by design; responses=23, scored=23 validated via the ENGINE lens |
| 8 | Competency scoring | onto_competency_score_runs=1 (precise ledger), onto_competency_profiles=1 (domain-proxy ledger) |
| 9 | Competency profile | measured=true, history_count=1 |
| 10 | Competency radar (type profile) | no dedicated radar table — backed by competency ledgers (runs=1, profiles=1); classified=6/6 |
| 11 | Competency heatmap | no dedicated heatmap table — shares the competency-ledger substrate (runs=1, profiles=1); classification coverage=100% |
| 12 | Strength analysis | strengths derived from the competency ledgers (runs=1, profiles=1) — no dedicated strengths table; EI strengths surfaced=0 |
| 13 | Development areas (gap engine) | gaps derived from the competency ledgers (runs=1, profiles=1) against role requirements — no dedicated gap table; measurable_competencies=5/6 |

**Note:** the scorer was run with `persist:false` (read-only validation) — it proves the scoring
transaction executes without writing a duplicate ledger row. The ledger rows shown above were
written during candidate provisioning (mx301-demo-candidate.ts), not by this validation run.
