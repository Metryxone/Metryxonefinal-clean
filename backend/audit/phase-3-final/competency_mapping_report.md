# Competency → EI Dimension Mapping Report — Phase 3

**Subsystem:** Competency-EI Mapping (Phase 3.2, `competency-ei-dimensions`)
**Status:** ✅ Operational (measured)
**Generated:** 2026-06-20
**Evidence subject:** `demo_subj_pm`

> **Honesty contract.** Mappings and coverage below are read directly from the live
> engine. Unmeasured components are shown as `null` (not 0). Coverage and confidence
> are separate axes.

---

## 1. What the mapping does

Each EI readiness dimension is backed by a set of **competencies**, each carrying a
`contribution_weight`. Every competency resolves through an `onto_domain` (e.g.
`dom_interpersonal`, `dom_behavioral`, `dom_cognitive`, `dom_functional`,
`dom_strategic`). In `domain_proxy` mode a competency inherits its domain's proxy score
until finer-grained per-competency scoring exists.

This is the bridge between the **competency ontology** (Phase 2) and the **employability
dimensions** (Phase 3.2). It is additive and re-shaping only — it never recomputes the
underlying competency scores.

---

## 2. Mapping coverage (measured)

| Dimension | Components total | Measured | Coverage | Unmeasured components |
|---|---|---|---|---|
| Communication Readiness | 12 | 12 | 100% | — |
| Workplace Readiness | 14 | 13 | 92.9% | Time Management (`dom_functional`) |
| Problem-Solving Readiness | 13 | 3 | 23.1% | Analytical/Critical/Conceptual/Creativity, Data-Driven & Decision-Making, Judgment, Root-Cause, Structured & Systems Thinking |
| Leadership Readiness | 14 | 12 | 85.7% | Strategic Thinking (`dom_strategic`), Talent Development |
| Future Readiness | 14 | 4 | 28.6% | (forward-looking competencies largely unmapped/unscored) |

**Example (Communication Readiness, 12/12 mapped):** Communication (w2), Active Listening,
Assertive Communication, Constructive Feedback, Influencing Others, Listening Skills, Open
Communication, Persuasion, Persuasive Communication, Presentation Skills, Public Speaking,
Written Communication — all resolving through `dom_interpersonal` at proxy score 75.

---

## 3. Honest findings

- **Domain concentration is visible.** Problem-Solving's measured 3/13 are exactly the
  `dom_behavioral` competencies (Problem-Solving, Resourcefulness, Solution Orientation);
  the 10 `dom_cognitive` competencies are unmeasured in this environment. The engine
  surfaces this as a coverage fact (`23.1% mapped-competency coverage (−31)`), it does not
  paper over it.
- **`null` is preserved.** `comp_time_management` and the cognitive competencies return
  `proxy_score: null` / `measured: false` — never coerced to 0, which would fabricate a low score.
- **Weights are real.** Anchor competencies carry `contribution_weight: 2`
  (e.g. Communication, Collaboration, Teamwork, Leadership); supporting competencies carry 1.

---

## 4. Success criterion

✅ **Competency-EI mapping operational** — every dimension resolves to a weighted competency
set across named onto-domains, with honest per-component measured/null status and coverage.

## 5. Honest limitations

- Because most competencies currently resolve through a shared domain proxy, intra-dimension
  variance is low. The mapping is correct; the **inputs** are coarse until granular competency
  scoring lands. This is disclosed, not hidden.
