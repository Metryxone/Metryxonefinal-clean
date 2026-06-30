# 04 · Progression Readiness

Honest assessment of how stage **progression** stands against the frozen Blueprint 06 progression rules.
Phase 1.1 aligns the *taxonomy*; progression *criteria* maturity is largely forward work (Programs 1–6) and is
reported honestly here — nothing is claimed as done that is not.

---

## 1. Progression rules (frozen target) vs current state

| Transition | Frozen rule (Blueprint 06) | Current implementation | Readiness |
|---|---|---|---|
| Curiosity → Insight | advance when diagnostic-coverage threshold met | entry/diagnostic data drives placement; threshold **implicit** | PARTIAL — criteria implicit (T1-resolved label; criteria forward work) |
| Insight → Growth | advance when recommendations accepted/initiated | recommendations + M5 growth plan exist | PARTIAL — initiation exists; not formalized as a gate |
| Growth → Mastery | **evidence-gated** (criteria), separate from monetization | progression today **derived / monetization-gated**, not criteria-gated | GAP-P2 (forward work) |
| Mastery (terminal) | realized, measured outcome closes the loop (D13) | outcome **not yet captured** | GAP-O1 (forward work — keystone) |

## 2. What Phase 1.1 changed for progression

- **Order is now canonical and single-sourced.** Every consumer derives stage order from
  `LIFECYCLE_STAGE_CODES` / `WC3_PROGRESSION_ORDER` (a canon-sourced projection). There is no longer a risk of
  two modules disagreeing on stage order or on what `CAP_INS` is called.
- **Stage-floor / laddering logic is unchanged.** `subscription-engine` still reads the same stored stage
  strings and the same weights; Phase 1.1 did not touch the progression *thresholds*, only the *terminology
  source*. This is deliberate — changing progression criteria is out of scope for a taxonomy-alignment phase.

## 3. Readiness verdict (honest)

- **Taxonomy readiness: COMPLETE.** One canon, four stages, correct order, alias and pre-stage correctly
  modeled, all references routed.
- **Progression-criteria readiness: PARTIAL / forward work.** The two structural gaps named in Blueprint 06
  remain open and are NOT addressed here:
  - **GAP-P2** — Growth→Mastery is not yet *evidence-gated* (it is derived/monetization-gated).
  - **GAP-O1** — realized, measured Mastery outcome is not yet captured (the close-the-loop tail).
- These are explicitly the forward work of later Programs and must not be conflated with the taxonomy alignment
  delivered in Phase 1.1.

**No progression behaviour changed in this phase; progression maturity remains as Blueprint 06 describes it.**
