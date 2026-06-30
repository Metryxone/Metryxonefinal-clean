# 06 · Technical Debt Resolved

The concrete debt Phase 1.1 retired, and why it was debt.

---

## 1. Resolved

### D1 — Competing "canonical" source of truth (highest-value fix)
**Was:** `backend/services/wc3/stage-intelligence.ts` declared `CANONICAL_STAGE_ORDER` /
`CANONICAL_STAGE_WEIGHT` — constants that *named themselves canonical* and were imported by three sibling WC3
services. Two things in the repo could each legitimately claim to be "the canonical stage order."
**Now:** one backend canon (`backend/lib/lifecycle.ts`). WC3's constants were reframed as a clearly-named
*projection* (`WC3_PROGRESSION_ORDER` / `WC3_PROGRESSION_WEIGHT`) that **sources its labels from the canon**.
There is exactly one source of truth; the projection cannot be mistaken for it.
**Why it was debt:** duplicate authority → silent divergence risk (any future edit to one map could disagree
with the other, with no compile-time signal).

### D2 — Scattered inline stage→label maps (≈11 backend + 5 frontend sites)
**Was:** the four-stage code→label mapping was re-declared inline in ~16 modules (subscription, reports,
entitlement, adaptive, scoring, enterprise routes, main routes, and five React phases). Each was a copy that
could drift independently (e.g. someone "fixing" Insight→Clarity in one place only).
**Now:** every site resolves through `STAGE_CODE_TO_LABEL` / `stageLabel()` (canon per runtime).
**Why it was debt:** N copies of one fact = N places to forget when the canon changes; the exact failure mode
Blueprint 06 calls out (label ambiguity C1/GAP-T1).

### D3 — Hand-maintained stage-code allowlists
**Was:** `routes.ts` `VALID_STAGES` and `routes/capadex-enterprise.ts` `validStages` were literal arrays of the
four codes, maintained by hand and disconnected from the label maps.
**Now:** both derive from `LIFECYCLE_STAGE_CODES`. Adding/removing a coded stage is a one-line canon change.
**Why it was debt:** an allowlist that doesn't share a source with the label map can validate a code that has no
label, or reject a code that does.

### D4 — Alias/pre-stage encoded as bare magic strings
**Was:** "Clarity" and "Awareness" appeared as bare string literals with their semantics living only in
developers' heads (or in comments).
**Now:** `INSIGHT_DISPLAY_ALIAS = 'Clarity'` and `UNCODED_PRE_STAGE = 'Awareness'` are named, documented
constants in the canon, with the alias/pre-stage relationship spelled out in the module doc-comment (mirrored on
the frontend).
**Why it was debt:** the most error-prone parts of the model (the alias that is NOT a 5th stage; the pre-stage
that is NOT a code) had no single authoritative definition.

---

## 2. Explicitly NOT "resolved" (would have been over-reach)

- Stored DB strings were **not** migrated. Rewriting load-bearing stored values is a data migration, not debt
  cleanup, and would risk `subscription-engine` / WC3 trend behaviour. Left as-is by design (report 07).
- Progression-criteria gaps (GAP-P2 evidence-gating, GAP-O1 outcome capture) are **product** forward work, not
  taxonomy debt — untouched (report 04 / 07).

## 3. Net effect

Coded lifecycle terminology and stage ordering now have **exactly one definition per runtime**. The classes of
bug Blueprint 06 was created to prevent (label drift, phantom 5th stage, code/label/allowlist disagreement) are
now structurally impossible without editing the canon.
