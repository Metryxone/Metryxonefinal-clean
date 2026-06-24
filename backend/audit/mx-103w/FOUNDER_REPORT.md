# MX-103W — Employer Production Gap Closure — Founder Report

**Status:** COMPLETE (pending code review) · **Deploy:** NOT executed (stop-for-approval)
**Flags:** `employerJobStoreSync` (FF_EMPLOYER_JOB_STORE_SYNC), `roleAutoResolution`
(FF_ROLE_AUTO_RESOLUTION) — both default **OFF**, byte-identical-OFF incl. schema.

## What shipped
1. **Phase 1 — Job Store Projection layer** (`services/job-store-projection.ts`):
   one-directional `job_postings → employer_jobs` projection on publish/approve.
   Additive, reversible, idempotent, audit-logged (`job_projection_audit`),
   never-throws, flag-gated. Both bounded contexts retained (no merge).
2. **Phase 2 — Role auto-resolution** (`services/role-auto-resolution.ts` +
   `/api/admin/role-resolution/*`): free-text title → crosswalk (#99) → Role DNA →
   competency profile → blueprint, with confidence, top-5, abstain, human override
   and audit trail (`role_resolution_decisions`). Composes #99 — does not edit it.
3. **Phase 3 — Super-admin visibility**: read-only `/api/admin/employer-production-
   health/*` aggregator (8 groups) surfaced as a probe-gated "Production Health —
   MX-103W" section inside the existing `EmployerEcosystemPanel` (no new nav).
4. **Phase 4 — Re-certification**: `scripts/mx103w-smoke.ts` — **ALL PASS**.

## Structural readiness — 100% (band PASS) · target ≥85% met
`deriveReadiness` checks 8 structural signals (all ✓ on the live DB):
✓ job_postings present · ✓ employer_jobs present · ✓ projection layer active ·
✓ curated roles matchable (13) · ✓ Role DNA profiles present (13) ·
✓ assessment blueprints present · ✓ role-resolution audit reachable ·
✓ hiring funnel substrate present.

**Readiness ≠ Adoption.** Structural readiness measures whether the spine *can* run
end-to-end. Adoption is honestly **0** (0 published postings → 0 projected jobs;
0 role-resolution decisions) because no real production posting has been published
yet. We did **not** inflate adoption to dress up the score.

**Coverage ⟂ Confidence** are reported as separate axes everywhere; title-match
confidence is the crosswalk's own numeric score (not tuned), and abstention on an
unmatchable title is preserved as honest evidence, never fabricated.

## 8 re-certification questions
1. **Is the job-store seam closed without merging the two stores?** Yes — retained
   both contexts; bridged write-side via a one-directional projection (read-side
   already bridged by #98).
2. **Is the manual workaround removed?** Yes — publishing a posting now auto-projects
   a linked `employer_jobs` funnel row (flag ON); no manual funnel-row creation.
3. **Is projection reversible & idempotent with no data loss?** Yes — unproject sets
   `inactive` (no delete); re-project upserts to exactly one row; audit logs all.
4. **Does role auto-resolution work end-to-end (title → DNA → blueprint)?** Yes —
   resolves real titles (e.g. role_be_eng @ conf 92), abstains on nonsense.
5. **Is confidence honest (not inflated) and Coverage⟂Confidence separate?** Yes —
   confidence is the crosswalk's numeric score; coverage is a distinct axis; abstain
   returns null confidence.
6. **Is super-admin visibility integrated without a duplicate screen?** Yes — added
   as a probe-gated section in the existing EmployerEcosystemPanel.
7. **Is everything flag-OFF byte-identical incl. schema?** Yes — ensure-schema runs
   only on POST/hook paths; GETs use to_regclass probes; OFF → 503; smoke verifies.
8. **Does the MX-103V funnel validate (creation→assessment→matching→interview→
   hiring→outcome)?** The substrate for every stage is present and structurally
   ready (100%); real-data adoption per stage remains honestly pending volume.

## Validation evidence
- `scripts/mx103w-smoke.ts` — ALL PASS (OFF-503 gate; projection project/reproject/
  unproject/audit; role resolve/abstain/persist; production-health overview).
- Live read-only snapshot (no writes): 15 roles / 13 with profile (86.7%), 13
  matchable; projection & resolution substrate present; adoption 0 (honest).

## What this task deliberately did NOT touch
`role-title-crosswalk.ts`, `talent-matching-engine.ts`, matching tests
(#102/#103/#104 own them) — composed only. No deploy (stop-for-approval per canon).

## Caveats / honest gaps
- Adoption is 0 until real postings are published and real titles resolved in prod.
- `job_postings.work_mode` has no `employer_jobs` column → folded into description
  (honest carry). `location`/`skills`/`ei_min_score` project as honest empty.
