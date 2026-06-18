# WC-3 — Family Domain Remediation Report

**Scope:** Close the `FAMILY_DYNAMICS` route-coverage gap identified in
`WC3_ROUTE_COVERAGE_AUDIT.md` §5. Strictly additive, flag-gated, byte-identical when
`FF_WC3_OUTCOME` / `FF_WC3_JOURNEY` are OFF.

## 1. The gap (before)
- `FAMILY_DYNAMICS` is a canonical construct with **15 concern-area mappings**
  (the single largest orphan block), and is **grounded** in `intervention_library`
  (4 real interventions).
- Yet **no outcome model** carried it and **no journey route** served it → every
  family/parenting concern fell through to the deterministic **Mentoring fallback**
  with `degraded:true` / `LOW_CONFIDENCE`. Honest, but a weak experience for the
  largest orphan domain.

## 2. What was implemented
| Layer | Change | Grounding |
|---|---|---|
| L2 Outcome model | New `family_wellbeing` (`construct_keys=[FAMILY_DYNAMICS]`, `gated=false`) | `FAMILY_DYNAMICS` has 4 `intervention_library` rows → real, library-backed actions |
| L3 Journey route | New `family_support` ("Family & Parenting Support"), `is_fallback=false`, `corpus_status='ready'`, `model_affinities={family_wellbeing:0.90}` | Affinity is to a real activated model |
| Product mapping | `family_support → product_key='mentoring', path='/mentors'` | **Existing, ready product** — no new product invented |
| Fallback merge | Mentoring fallback affinities gain `family_wellbeing:0.40` | So the universal fallback can still serve family as a secondary |

### Product decision (important)
There is **no standalone family/parenting product** in the app (only a
`/parent-consent/:token` link, which is not a product surface). Per the approved scope
("do not create new products unless a destination already exists"), the family route
maps to the **existing Mentoring product (`/mentors`)** — the natural human-support
destination for family/parenting concerns. The route is nonetheless a *distinct,
non-fallback pathway*, so `FAMILY_DYNAMICS` is now genuinely **covered** rather than
degraded.

## 3. Where the changes live
- Seeds (fresh DBs): `backend/services/wc3/wc3-schema.ts`
  (`ensureWc3OutcomeSchema`, `ensureWc3JourneySchema`).
- Canonical migration (existing DBs): `backend/migrations/20261208_wc3_family_remediation.sql`
  — idempotent (`ON CONFLICT DO NOTHING` + guarded `||` merge); no existing row
  destructively mutated.

## 4. Verification (DEV)
Pure-resolver smoke (`buildJourney`) with a synthetic family-activated L2 summary:

```
FAMILY  primary=family_support product=/mentors degraded=false band=MODERATE_CONFIDENCE secondary=mentoring conf=0.54
        reason: Routed to Family & Parenting Support — strongest product fit from Family Wellbeing
                (route confidence 0.54, MODERATE_CONFIDENCE). Advances stage Clarity → Growth.
EMPTY   primary=mentoring degraded=true band=LOW_CONFIDENCE     ← fallback invariant intact
SMOKE PASS
```

- `FAMILY_DYNAMICS` → `family_wellbeing` (L2) → `family_support` (L3) → Mentoring `/mentors`, **non-degraded**.
- "No concern terminates without a route" invariant still holds (empty spine → Mentoring fallback, degraded).
- Catalog counts after migration: **7 outcome models, 6 journey routes** (was 6 / 5).

## 5. Impact on coverage
- Construct route coverage: **75.8% → 80.6%**; fallback usage **24.2% → 19.4%**.
- Concern route coverage: **66.1% → 74.6%** (the 15 family concern mappings move from
  orphan to covered).
- Orphan outcome models: still **0**; product mapping: still **100%**.

## 6. Flag-OFF behaviour
With `FF_WC3_OUTCOME` / `FF_WC3_JOURNEY` OFF, the resolvers do not run and the new
catalog rows are never read → output is byte-identical to pre-remediation. Reversible
by deleting the two seeded rows (and the migration).
