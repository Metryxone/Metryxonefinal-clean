# WC-P1 — D14: 95% Completion Roadmap

**Current State**: Coverage 32% / Confidence 23%
**Target**: 95% Coverage + 85% Confidence

---

## Prioritised Implementation Sequence

### Phase A — Formula Integrity (Estimated: 1 day | Impact: +15% Coverage, +20% Confidence)

#### A1 — Unify the EI formula
**Problem**: `employabilityEngine.ts` (6-dim) ≠ `eiBreakdown` modal (8-dim) ≠ DB ruleset.
**Action**:
1. Add `assessmentScore?: number` input to `runEmployabilityEngine()`.
2. Add `assessmentScore → (score/100)*25` dimension (cap 25).
3. Add `education → classifyEducation()` dimension (cap 15, already in modal).
4. Reduce `completenessScore` from 45pts cap to 3pts (matching doc; `completeness × 0.03`).
5. Adjust certs cap 6→10, soft cap 10→8, projects cap 6→4 to match doc.
6. Update DB ruleset JSONB config to match.
7. Delete the duplicated local `eiBreakdown` memo in `CareerBuilderPage.tsx` — use the unified engine output.

#### A2 — Unify band labels
**Action**: Adopt doc labels (Getting Started/Building/Career-Ready/Hire-Ready) everywhere — update `tokens.ts`, DB ruleset config, all copy strings.

---

### Phase B — Longitudinal Activation (Estimated: 2 hours | Impact: +12% Coverage, +10% Confidence)

#### B1 — Auto-snapshot on resolve
**Action**: In `/api/ei/resolve`, after writing the calc log, call `takeSnapshot(pool, userId, score, breakdown, profile_hash)`. Already idempotent (unique constraint on user_id+date). No schema changes needed.
**Result**: All future resolve calls will build the trajectory chart. 199 existing calc logs indicate prior resolve activity; those users will get their first snapshot on next resolve.

---

### Phase C — Assessment Integration (Estimated: 4 hours | Impact: +10% Coverage, +15% Confidence)

#### C1 — Wire assessmentScore into useHybridEI
**Action**: In `extractInput()` in `useHybridEI.ts`, read `profile.assessmentScore` and pass it to the unified engine (Phase A1 prerequisite).

#### C2 — Persist assessmentScore on completion
**Action**: After the Career Builder Assessment tab completes, PATCH `career_seeker_profiles.data.assessmentScore` with the numeric result.

---

### Phase D — Reference Data Seeding (Estimated: 1–2 days | Impact: +15% Coverage, +12% Confidence)

#### D1 — Seed institutions (NIRF Top 200)
Download NIRF 2024 data (public JSON) and bulk-insert into `institutions` with `tier_1`/`tier_2`/`tier_3` classification. Target: ≥200 rows.

#### D2 — Seed certifications (Top 50)
Add AWS/Azure/GCP/PMP/CFA/CA/FRM/CISSP to `certifications` with `tier` field. Target: ≥50 rows with tier classification.

#### D3 — Seed skills (ESCO core)
Load ESCO Level-1/Level-2 skills (CSV, public, ~2,000 essential skills). Target: ≥500 rows in `skills`.

#### D4 — Process ref_review_queue
Review the 69 queued items and create aliases for the most frequent inputs.

---

### Phase E — Occupation Expansion (Estimated: 2–3 days | Impact: +10% Coverage, +8% Confidence)

#### E1 — Expand occupation catalog to ≥200
Add occupations for: IT Engineering, Finance, Data, Product, HR, Sales, Operations, Healthcare (Indian titles and seniority levels).

#### E2 — Map ≥8 skills per occupation
Each occupation needs required/important/optional skills from the seeded `skills` table.

#### E3 — Build ≥50 pathways
Common Indian career progressions: Junior Engineer → Engineer → Senior → Lead → Manager → Director chains per vertical.

---

### Phase F — Commercial Gating (Estimated: 4 hours, after Razorpay) | Impact: +5% Coverage)

Enable EI Passport (`employabilityPassport` flag) and gate it behind the Paid tier once Razorpay is configured.

---

## Projected Readiness After Each Phase

| After Phase | Coverage | Confidence |
|---|---|---|
| Baseline (now) | 32% | 23% |
| + A (Formula) | ~47% | ~43% |
| + B (Longitudinal) | ~59% | ~53% |
| + C (Assessment) | ~69% | ~68% |
| + D (Ref Data) | ~84% | ~80% |
| + E (Occupations) | ~94% | ~88% |
| + F (Commercial) | ~97% | ~87% |

**Target (95%/85%) is achievable after all six phases.**

---

## Quick Wins (< 2 hours total, no schema changes)

| Win | Time | Impact |
|---|---|---|
| Auto-snapshot on /api/ei/resolve (Phase B1) | 30 min | Immediately populates longitudinal chart |
| Unify band labels (Phase A2) | 30 min | Eliminates user-visible label confusion |
| Wire assessmentScore into useHybridEI (Phase C1) | 1 hr | Assessment CTA has measurable EI impact |
