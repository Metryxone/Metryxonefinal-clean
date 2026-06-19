# Question Blueprint & Mapping Report — Phase 2

**Generated:** 2026-06-19 · **Flag:** `FF_COMPETENCY_RUNTIME=1` · **Source:** live dev DB
**Verdict:** ✅ Question mapping **operational** (canonical map empty → documented domain-proxy fallback active)

---

## 1. What this covers
The Question Blueprint Engine (Phase 2.2) defines, per role/blueprint, how many questions of
which competency/difficulty should appear, and maintains the **canonical question→competency
crosswalk** (`onto_competency_question_map`) used to score questions against specific competencies.

## 2. Live evidence
| Table | Rows | Meaning |
|-------|------|---------|
| `onto_question_blueprints` | 7 | Per-blueprint question composition rules defined |
| `competency_question_templates` | 44 | Curated question bank available to draw from |
| `onto_competency_question_map` | 0 | Canonical question→competency map **not yet populated** |

## 3. The fallback that keeps scoring honest and operational
Because the canonical map is empty, the runtime does **not** fabricate per-competency precision.
Instead it uses the documented **domain-proxy** path (Phase 2): the 7-code question bank
crosswalks *down* to the 5 onto-domains, and competencies are scored via their domain.

- This is **by design** and self-upgrading: the moment `onto_competency_question_map` is
  populated, scoring auto-upgrades from `domain_proxy` to canonical per-competency measurement
  with no code change.
- It is also why `dom_strategic` competencies (e.g. `comp_agile_collaboration`) currently report
  **`unmeasurable`** rather than a guessed score — there is no question path into the strategic
  domain yet. Reporting "unmeasurable" instead of inventing a number is the honest behaviour.

## 4. Honest gaps
- **`onto_competency_question_map = 0`** — canonical mapping not seeded. Scoring runs in
  domain-proxy mode until it is.
- **Strategic-domain coverage = 0** — no questions crosswalk to `dom_strategic`, so strategic
  competencies are surfaced as unmeasurable, never scored.

## 5. Conclusion
Question blueprints (7) and a real template bank (44) exist; the mapping mechanism and its
honest domain-proxy fallback are **operational**. Outstanding work is data population of the
canonical map, which the engine is built to consume automatically.
