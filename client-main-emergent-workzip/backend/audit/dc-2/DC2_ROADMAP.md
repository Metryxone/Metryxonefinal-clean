# DC-2 — CAPADEX Decision Activation Roadmap (#9)

Sequences the 50 decisions into three waves following the DC-2 tiers. **DIS = Decision
Intelligence Score** (DC-1 baseline ≈ 5–6/10). **All DIS / activation-lift / subscription-lift
figures are directional planning hypotheses, not telemetry forecasts** — CAPADEX has no
decision-conversion analytics yet (no decision object exists), so any precise % would be
fabrication. Validate after each wave; do not tune a surface to hit a number.

---

## Sequencing principle
1. **Activate before orchestrate before expand.** Ship the decision object over real assets
   first → it produces the **first decision-conversion telemetry**, which is the prerequisite
   for trusting any Wave-2/3 revenue estimate.
2. **One build can unblock a whole cluster.** Three orchestration builds (journey→M5 bridge ·
   decision→subscription mapping · confidence centralization) unlock all of Tier 2.
3. **Safety is not sequenced.** Crisis escalation (#10) ships in Wave 1 regardless of score.

---

## Wave 1 — ACTIVATE (Tier 1 · existing assets) — *foundation*

**Scope:** decisions 1,2,3,4,5,6,7,8,9,10,35,48,49,50 (14). Build = the **decision object +
confidence gate**, lit over already-real surfaces; flip flags on for gated PIL/OMEGA reports.

| Aspect | Detail |
|--------|--------|
| Current State | Surfaces real; no explicit decision is ever formed or logged |
| Target State | Confidence-gated decision object emitted + logged for every Tier-1 trigger |
| Gap | the decision wrapper + confidence gate + report flag-on; crisis unification |
| User Impact | High — right report/mentor/assessment at the right moment |
| Business Impact | High — trust, product utilization, B2B cohort reporting |
| Revenue Impact | Indirect — drives retention + sets up upsell telemetry |
| Technical Difficulty | **Low** |
| Priority | **Do first** |
| Est. DIS | 5.5 → **~6.5** |
| Est. product-activation lift | **+15–25%** (reports/LBI/mentor surfaced by decision vs buried) |
| Est. subscription lift | ~0 directly (no commercial decision yet) — but enables Wave 2 measurement |

**Exit criterion:** decision object live + logging conversion; gated reports flag-on; crisis
path unified under the safety-override gate. **Telemetry now exists.**

---

## Wave 2 — ORCHESTRATE (Tier 2 · no new products) — *revenue*

**Scope:** decisions 11–13,15–24,26,29–32,34,41,44,46,47 (23). Three builds:
- **(a) journey→M5 growth-plan bridge** → unlocks plans 11,12,15,16,17,18,19,20.
- **(b) decision→subscription mapping + entitlement gate** → unlocks commercial 21–24,26,29,30,31.
- **(c) confidence centralization** (L2 + hypothesis governance → one gate) → unlocks 46,47 and
  hardens every decision's gating.

| Aspect | Detail |
|--------|--------|
| Current State | M5 real but anchored to M-series; packages real but **no decision→package mapping**; confidence not centralized |
| Target State | Decisions seed M5 plans; decisions recommend packages + enforce entitlement; defer/tie-break on centralized confidence |
| Gap | the three orchestration builds above (no new product) |
| User Impact | High — personalized plans + right-fit package + honest "we're not sure yet" |
| Business Impact | High — converts intent to plan + purchase; teacher/counselor B2B workflows |
| Revenue Impact | **Highest near-term** — turns 8 design-only commercial decisions live |
| Technical Difficulty | **Medium** (entitlement is the one High sub-item) |
| Priority | **Do second — the revenue wave** |
| Est. DIS | 6.5 → **~8** |
| Est. product-activation lift | **+20–35%** (growth-plan starts from real decisions) |
| Est. subscription lift | **+10–20%** (first time a decision can recommend a package) |

**Exit criterion:** a session can be routed to a growth plan AND recommended a real package
with entitlement enforced — end to end, confidence-gated, byte-identical when flag-off.

---

## Wave 3 — EXPAND (Tier 3 · new products / platform) — *future readiness*

**Scope:** decisions 14,25,27,28,33,36,37,38,39,40,42,43,45 (13). Three platform builds:
- **Context axis** (operationalize `wc3_question_context` into the decision chain) → 37–42.
- **Product completion** (Employability Index, Competitive-Exam from stub → real) → 14,25,43,45.
- **Institution B2B data layer** (`institution_id`/`max_students` + cohort surfaces) → 28,33,36.

| Aspect | Detail |
|--------|--------|
| Current State | Context axis not wired; Employability/Exam products stub; no B2B data layer / teacher surface |
| Target State | Context-triggered decisions fire; real employability/exam products; B2B institutional contracts via decision |
| Gap | platform expansion (context axis · two products · B2B data layer · teacher surface) |
| User Impact | High — the AI-era / employability / placement decisions users most need |
| Business Impact | High — opens B2B (institution) and the future-workforce narrative |
| Revenue Impact | **Highest ceiling, longest horizon** (institutional B2B + employability) |
| Technical Difficulty | **High** |
| Priority | **Do third — the strategic bets** |
| Est. DIS | 8 → **~9** |
| Est. product-activation lift | **+15–30%** (two stub products become real) |
| Est. subscription lift | **+15–30%** (B2B + exam/employability packages become deliverable) |

**Exit criterion:** at least one context-triggered decision live end-to-end; Employability OR
Exam product real with its package mapped; institution B2B contract path functional.

---

## Roadmap-at-a-glance

| Wave | Theme | Decisions | Difficulty | DIS | Key unlock |
|------|-------|-----------|-----------|-----|-----------|
| 1 | Activate | 14 (Tier 1) | Low | →~6.5 | decision object + confidence gate over real assets |
| 2 | Orchestrate (revenue) | 23 (Tier 2) | Med | →~8 | M5 bridge · **subscription mapping** · confidence |
| 3 | Expand (future) | 13 (Tier 3) | High | →~9 | context axis · product completion · B2B data layer |

## Cross-wave recommendations (Current → Target → Gap → Impact → Difficulty → Priority)

| Recommendation | Current | Target | Gap | Impact (U/B/R) | TD | Priority |
|----------------|---------|--------|-----|----------------|----|----------|
| Build the decision object + confidence gate | none | confidence-gated decision emitted+logged | core infra | H/H/Ind | Low | **P0 (Wave 1)** |
| Unify crisis escalation into the gate | Pragati-local | safety-override decision | unify | H/H/L | Med | **P0 (safety)** |
| journey→M5 growth-plan bridge | M-series anchored | decision-seeded plans | bridge | H/H/M | Med | **P1 (Wave 2)** |
| decision→subscription mapping + entitlement | no mapping | decision recommends+gates packages | mapping+gate | M/H/**H** | Med–High | **P1 (revenue)** |
| Centralize confidence (L2 + hypothesis) | scattered | one gate (defer/tie-break) | fuse | H/M/L | Med | **P1 (Wave 2)** |
| Operationalize the context axis | sidecar only | context-triggered decisions | wire `wc3_question_context` | H/H/M | High | **P2 (Wave 3)** |
| Complete Employability + Exam products | stub | real products + mapped pkgs | build | H/H/**H** | High | **P2 (Wave 3)** |
| Institution B2B data layer + surfaces | absent | B2B contracts via decision | data layer + cohort surfaces | M/H/**H** | High | **P2 (highest ceiling)** |

**Bottom line:** ship Wave 1 to make decisions real and start measuring; ship Wave 2 to turn
intent into revenue with **no new product** (the mapping build is the master key); ship Wave 3
to claim the future-workforce / B2B ceiling. Every estimate here is a hypothesis to validate
against Wave-1 telemetry — not a forecast, and never a target to tune a surface toward.

**Scope reminder:** audit/design only. No code, schema, or migrations changed. STOP for approval.
