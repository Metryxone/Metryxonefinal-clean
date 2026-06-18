# WC-5 Track B — Product Routing Audit (Output #2)

Evaluates routing quality from the **real** L3 Journey layer
(`backend/services/wc3/journey-intelligence.ts`, catalog `wc3_journey_routes`) into the
actual product surfaces, plus the Product Gap Report.

> Routing logic is **real and deterministic**: per route,
> `fit = Σ(route_affinity × model_confidence)` over the activated L2 outcome models;
> rank by fit → fallback_priority → route_key; mentoring is the universal fallback so
> "no concern terminates without a route." The **routing decision is sound**; the
> weakness is the **maturity of the surfaces it routes to.**

---

## B.1 Per-route routing report

| Route (`route_key`) | Product path | Routing coverage | Precision | Ambiguity | Surface reality |
|---------------------|--------------|:---:|:---:|:---:|-----------------|
| `lbi` | `/lbi` | High | High | Low | **REAL** — deep backend (domains/subdomains/age-bands/scoring) + full product & admin pages |
| `career_builder` | `/career-builder` | High | Medium | Medium | **PARTIAL** — rich UI (7.9k lines) but `localStorage`/frontend logic; no persistent growth plan |
| `employability_index` | `/employability-index` | Medium | Medium | Medium | **STUB** — exists as sections within Career Builder/LBI, not a standalone product |
| `competitive_exam` | `/exam-intelligence` | **corpus_pending** | Low | High | **STUB** — `CompetitiveExamPortal.tsx` driven by hardcoded `EXAM_CONFIG`/`MENTOR_POOL`; APIs largely absent |
| `mentoring` | `/mentors` | High (fallback) | Low | High | **STUB** — `MentorMarketplacePage.tsx` UI over hardcoded/generic mentor data; no matching logic |
| `family_support` | `/mentors` (remap) | Medium | Low | High | **STUB** — no dedicated family product; remaps to mentoring |

**Routing-quality summary:** the **router is better than its destinations.** Fit
scoring, fallback safety, and the exam-guard demotion (competitive_exam → secondary
when it wins only on shared constructs like *Stress* without dedicated `EXAM_*`
evidence) are all real and honest. But **5 of 6 destinations are PARTIAL/STUB**, so
precision-to-value collapses after the route is chosen.

---

## B.2 Missing signals & missing contexts per route

| Route | Missing signals (to route precisely) | Missing contexts (L5B not wired) |
|-------|--------------------------------------|----------------------------------|
| `lbi` | — (strongest) | Context axis not consumed even though LBI could segment by it |
| `career_builder` | Persistent outcome→plan linkage; resume/market signals are FE-only | `CAREER_CLARITY`, `CAREER_TRANSITION`, `EMPLOYABILITY` not fed in |
| `employability_index` | A real scoring backend distinct from LBI | `EMPLOYABILITY`, `AI_FUTURE_OF_WORK` |
| `competitive_exam` | Dedicated `EXAM_*` constructs/corpus (today rides shared stress signals) | `COMPETITIVE_EXAM_PRESSURE`, `PLACEMENT_ANXIETY` |
| `mentoring` | Mentor-matching features (domain, persona, severity, availability) | All — used as catch-all without context conditioning |
| `family_support` | Family-specific constructs and a family product | `FAMILY_PRESSURE`, `IDENTITY_BELONGING` |

---

## B.3 Product Gap Report (Output #2, part 2)

| Product | Current state | Gap to "real, routable, monetizable" | Severity |
|---------|---------------|--------------------------------------|:---:|
| **LBI** | REAL | Consume Stage/Context to personalize; expose as a decision destination, not just an assessment | Low |
| **Career Builder** | PARTIAL | Persist state server-side; add a real Growth Plan; bind to outcomes/journey | **High** |
| **Employability Index** | STUB | Stand up a real index/score surface distinct from LBI, or formally fold into LBI | **High** |
| **Competitive Exam** | STUB + corpus_pending | Build `EXAM_*` corpus + real portal APIs before routing users with confidence | **High** |
| **Mentoring** | STUB | Real mentor data + matching (this is also the universal fallback, so its weakness amplifies system-wide) | **Critical** |
| **Family Support** | STUB (remap) | Dedicated family product or an explicit, honest "via mentoring" framing | Medium |

**Critical call-out:** because **mentoring is the universal fallback**, its STUB status
means *every* concern that doesn't score onto a stronger route lands on a weak surface.
Strengthening mentoring (data + matching) is the **highest-leverage routing fix** — it
raises the floor for the entire system.

**Honest positive:** the routing *architecture* (catalog-driven, affinity-scored,
fallback-safe, corpus-aware) is genuinely good and reusable; the work is **surface
maturity + feeding the Context axis into routing**, not redesigning the router.
