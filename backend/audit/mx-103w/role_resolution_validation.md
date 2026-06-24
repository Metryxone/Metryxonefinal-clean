# MX-103W — Role Auto-Resolution Validation (Phase 2)

Validated by `backend/scripts/mx103w-smoke.ts` (flags ON, live DB).

## Results — all PASS
| Check | Result | Evidence |
|---|---|---|
| OFF → 503 | PASS | resolve/coverage 503 when flag OFF |
| Real title resolves (not abstained) | PASS | role=role_be_eng, confidence=92 |
| Coverage ⟂ Confidence SEPARATE | PASS | conf=92, coverage own axis (=0), not folded |
| Decision persisted | PASS | role_resolution_decisions row id present |
| Abstain on nonsense (no fabrication) | PASS | abstained=true, resolved=null, conf=null |
| Coverage probe readable | PASS | audit_present=true, total reflects decisions |
| Route ON → 200 exercisable | PASS | status=200 |

## Live read-only snapshot
| Metric | Value | Reading |
|---|---|---|
| onto_roles (non-deprecated) | 15 | curated role genome |
| roles with active competency profile | 13 | Role DNA coverage 86.7% |
| matchable curated roles (crosswalk) | 13 | crosswalk can resolve to these |
| role_resolution_decisions total | 0 | **adoption** 0 — no production resolution yet |

**Honesty:** confidence is the crosswalk's own numeric score (not tuned here);
coverage is the separate "does this role carry a profile" axis. Adoption is 0
because the production path has not yet resolved a real title — we do not inflate it.
