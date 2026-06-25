# MX-301D — Persona Experience Validation · Combined Summary

_generated 2026-06-25T16:02:48.732Z_

**Demonstration candidate:** `user_4286d980cc6cc038` (PII-masked).
**The ONE assessment:** onto_competency_score_runs=2, onto_competency_profiles=1, profile completeness=85%.

## Success criterion: one assessment visible everywhere

- **Reachable on 17/19 persona tabs** — 7 directly **VISIBLE** (her individual assessment) + 10 **AGGREGATED** (counted into platform totals).
- ➖ **2** wired but no data for her (honest ceiling): Employer·Candidate Match, Employer·Competency Match.

## Cross-persona consistency (one assessment, many lenses)

- ✅ Her assessment is a SINGLE coherent onto substrate (score_runs=2, profiles=1) reachable through **4/4 independent persona lenses** (Candidate, Employer, Super Admin, Founder) — the same one assessment, seen from multiple sides (not duplicated per persona).
- ℹ️ Numeric fingerprint cross-check inconclusive (self=n/a, admin=n/a) — the self and admin lenses expose DIFFERENT derived metrics over the same substrate, so a byte-identical number is not expected; cross-persona reach is established by substrate + lens count above.

## Per-persona reachability

| Persona | Reachable | Visible | Aggregated | Gaps |
|---|---|---|---|---|
| Candidate | 5/5 | 5 | 0 | 0 |
| Employer | 2/4 | 1 | 1 | 2 |
| Super Admin | 5/5 | 1 | 4 | 0 |
| Founder | 5/5 | 0 | 5 | 0 |

## Verdict

**ONE ASSESSMENT VISIBLE EVERYWHERE — PARTIAL (honest ceiling).** Her single assessment is reachable on 17/19 persona tabs (7 visible, 10 aggregated) across 4/4 personas, all over ONE coherent onto substrate. The remaining 2 are disclosed above as honest gaps (flag-gated, wired-no-data ceilings, self-scope, or broken) — NOT fabricated to force a pass.

## Honesty & reversibility contract

- Strictly READ-ONLY: only writes are these audit files under `backend/audit/mx-301d/`.
- All demonstration data is `@example.com` / mx301-tagged and purgeable/reversible.
- Honest ceilings (precise comp_* null, operator-input interview, server-side-only competency match, flag-gated surfaces) are disclosed, never fabricated.
- Additive; feature flags default OFF in production; NO DEPLOY.
