# WC-7A — The Smallest Set of Improvements to 90%+ (Output #3)

The consolidated answer to the phase question. Items are grouped by tier and **deduplicated** —
each appears once, with **every layer it unblocks** listed, so this is a genuinely minimal set,
not a per-layer wishlist. Difficulty: **S**mall / **M**edium / **L**arge. All items inherit
WC-3/WC-6 build discipline (additive · compose-only · flag-gated default OFF · byte-identical when
OFF · honest `ready:false` over fabricated activation). Nothing here is implemented in WC-7A.

The defining insight of this audit: **the activation layers share a small number of unblockers.**
One orchestrator and one bridge move the needle on four layers at once; the genuinely large work
is confined to two layers with hard floors.

---

## Tier A — Small, shared wiring (AIS 61 → 76)

> Mostly **consuming intelligence that is already built but idle**, plus the read-only conductor.
> No new data is produced; flag-gated; byte-identical when OFF.

| # | Improvement | Diff. | Unblocks (layer → lift) | Grounding |
|---|-------------|-------|-------------------------|-----------|
| A1 | **Decision Orchestrator** — read-only `ActivationEnvelope` composing Stage+Context+Outcome+Journey+Action into `{product, growthPlan, mentor, subscription}` each with `ready/reason` + unified confidence | M | **Decision 57→85**; gives Product/Growth/Mentor/Subscription a conductor to fan from | WC-6 O1; DC-1 "decision object absent" |
| A2 | **Journey→M5 growth-plan bridge** — map journey/outcome → `coachInput()` so the real M5 engine runs from the CAPADEX decision | M | **Growth Plan 65→88** (all 6 segments) | WC-6 O2 |
| A3 | **Mentor-match-from-decision** + close the `/book` auth hole | S–M | **Mentor 70→86** | WC-6 O3/O5 |
| A4 | **Consume L5A stage + L5B context in runtime selection** — filter/boost the next-question pool by detected stage/context (turns two idle engines live) | S–M | **Personalization 78→88**; partial Future-Readiness context axis | L5A/L5B "derived, not consumed" |
| A5 | **Surface behaviour-adapter `drivers`** in growth-plan/dashboard UI + **proxy option-reframing** | S | **Personalization →90** | adapter drivers "fetched, rarely displayed" |
| A6 | **Longitudinal automation** — auto snapshot-on-completion · re-assessment interval scheduler · decommission in-memory `career-memory.ts` (unify into DB-backed) · wire OMEGA detections → intervention sequencer | M | **Longitudinal 75→90** | re-assess STUB; manual snapshots; legacy in-memory store |

**Tier A result:** Personalization 90 · Longitudinal 90 · Growth Plan 88 · Mentor 86 · Decision 85
· Product 72 · Subscription 55 · Future Readiness 45 → **AIS 2.0 ≈ 76.**

---

## Tier B — The commercial loop (AIS 76 → 83)

> One medium cluster that closes the DC-2 central revenue tension. Recommend, never hardcode.

| # | Improvement | Diff. | Unblocks (layer → lift) | Grounding |
|---|-------------|-------|-------------------------|-----------|
| B1 | **Decision→subscription mapping** over existing `student_segment` / `is_recommended` | M | **Subscription 45→75** | WC-6 O4; DC-2 SR=1 tension |
| B2 | **Backend entitlement enforcement** (`requireSubscription` / module gate keyed on `student_subscriptions`) | M | Subscription →85; protects Product revenue | WC-6 O5 |
| B3 | **Subscription-schema reconciliation + cross-server seam decision**; add the missing job-seeker package | M | Subscription →85; prerequisite for B2B | WC-6 O0 |

**Tier B result:** Subscription 85 · Decision 87 · Product 78 · Mentor 88 (others unchanged) →
**AIS 2.0 ≈ 83.** *This is the realistic small-and-medium-only ceiling.*

---

## Tier C — The two irreducible large builds (AIS 83 → 90+)

> ⚠️ **No small move reaches 90% for these two layers.** Their floors are architectural, not
> wiring. Included because the phase goal is "all layers ≥ 90%" — honesty requires naming the
> large work rather than pretending wiring covers it.

| # | Improvement | Diff. | Unblocks (layer → lift) | Grounding |
|---|-------------|-------|-------------------------|-----------|
| C1 | **Complete the two stub products** — Employability Index → real score/surface; Competitive-Exam product + corpus (packages already real) | L | **Product Activation 78→90**; unblocks job-seeker/college + exam segments | WC-6 O7; DC-1 product matrix S |
| C2 | **Institutional B2B data layer** — `institution_id` / `max_students` + seat enforcement, institutional-admin persona, cohort decision/action/mentor/plan rollups | L | **Future Readiness 55→90**; completes Mentor cohort + Subscription B2B | WC-6 O6; DC-2 Wave 3 |

**Tier C result:** all eight layers ≥ 90 → **AIS 2.0 = 90+.**

---

## Minimal-set summary

| Tier | Items | Total difficulty | AIS after | What it represents |
|------|-------|------------------|-----------|--------------------|
| **A** | A1–A6 | mostly S/M (one conductor + idle-engine wiring) | **76** | activate what already exists |
| **B** | B1–B3 | M | **83** | the revenue loop (realistic wiring ceiling) |
| **C** | C1–C2 | **L × 2** | **90+** | the only true greenfield builds |

**The smallest set, stated plainly:**
1. **Stand up the conductor and consume idle intelligence** (A1–A6) — biggest AIS gain per effort;
   tops out the two intelligence layers (Personalization, Longitudinal) at 90 and lifts four more
   to 85–88, mostly wiring of already-built engines.
2. **Close the commercial loop** (B1–B3) — one medium cluster, resolves the revenue tension, gets
   the system to a healthy **83**.
3. **Accept two irreducible large builds** (C1 product completion, C2 institutional B2B) — these
   are the *only* places 90% cannot be reached by wiring, and they are exactly the two layers DC-2
   already flagged as Wave-3 expansion.

**Honest bottom line:** *Six of eight layers can reach 90% without a large build (small-to-medium
wiring + minor polish); only two (Product Activation, Future Readiness) require large builds. The
smallest set is small where it can be and honestly large where it must be — and no plan that omits
C1/C2 can truthfully claim 90% across all layers.*

---

## Sequencing (build order, if approved later — not part of this phase)

1. **A1** Decision Orchestrator (the conductor — gates the rest).
2. **A2** Journey→M5 bridge · **A4–A6** consume idle intelligence + longitudinal automation
   (parallelizable; pure wiring).
3. **A3** mentor-from-decision.
4. **B1–B3** commercial loop (after A1 exists to drive recommendations).
5. **C1 / C2** the two large builds (parallel track; C2 needs B3's schema reconciliation first).

Every step: additive · flag-gated default OFF · byte-identical when OFF · honest `ready:false`
over fabricated activation. No tuning a destination to fake readiness.
