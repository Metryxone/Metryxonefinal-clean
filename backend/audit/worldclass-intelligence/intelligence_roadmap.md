# MetryxOne — Intelligence Roadmap to World-Class
### MX-WORLDCLASS-INTELLIGENCE-01 · 18 June 2026

Ordered by **what actually moves intelligence quality**, not by engineering convenience. The certification found the constraint is **evidence, grounding, and activation — not machinery.** So this roadmap activates and grounds what exists *before* building net-new, and treats the **outcome-validation framework as already-built infrastructure to switch on, not to re-create.**

Per the brief: **no new dashboards, admin screens, or reports.** Every item below improves *intelligence* (data, derivation, validation), surfaced through existing UI.

---

## The keystone
> **Switch on the outcome-validation loop that already exists, and route every product's scores through it.**

`employer-tig.ts` already computes Brier score, ECE, isotonic/PAV calibration, and `cold_start→provisional→calibrated` trust states. It has simply never seen a realized outcome. The moment real outcomes flow in and the other four products inherit this calibration discipline, MetryxOne gains the one thing no amount of UI provides: **a measured link between its scores and reality.** This is the precondition for every "Predictive/Outcome Readiness > 90%" target.

---

## Phase 0 — Stop emitting un-earned numbers *(immediate; integrity)*
*Prevents a knowledgeable evaluator from disqualifying the platform on contact.*
1. **Label seeded benchmarks as seeded.** `ti_industry_benchmarks`/`ti_role_benchmarks` carry literal `sample_size` (50/200) that implies real cohorts. Mark provenance = seeded until empirically recomputed (no UI change — a data/field-level honesty fix).
2. **Stop presenting the AI-generated LBI score as a measurement** (replace with a real derivation or mark preview).
3. **Mark `[DEMO]` predictions as demo** so `ti_outcome_predictions` can't be mistaken for live intelligence.

## Phase 1 — Activate the DORMANT machinery *(highest ROI; weeks)*
*Engines exist; data doesn't reach them. This is the cheapest path off the floor.*
1. **Compute & persist `mei_scores`** for the existing population. This single act (a) gives every user an employability score and (b) lets `mei-benchmark-engine`'s empirical `refreshCohortBenchmark` fire at k≥10 — converting SEEDED benchmarks toward EMPIRICAL automatically.
2. **Fire the CAPADEX pattern/composite layer** (`capadex_session_patterns`/`composites`=0 today) so behaviour-model and pattern intelligence actually exist for the 58 sessions.
3. **Generate skill-gap & readiness rows** for the 101 career profiles (`talent_gaps`=0, `cg_user_skill_gaps`=6).
4. **Begin recording realized outcomes** through the *existing* ingestion paths (`eios_outcome_tracking`, `rie_outcomes`) — even a small pilot cohort starts the calibration clock.

## Phase 2 — Earn the constructs (de-SEED) *(needs Phase-1 data)*
1. **Recompute benchmarks from real scores** once volume exists — replace ti_*/mei seed constants with computed percentiles; keep k-anonymity (k≥30 to leave "Provisional").
2. **Derive calibration multipliers** (industry/role/layer) from data instead of hardcoded 1.2-type constants.
3. **Ground FRP automation-risk** in a citable, versioned source rather than inline constants.

## Phase 3 — Validate (move Scientific/Predictive readiness) *(the hard, decisive work)*
1. **Run reliability/validity studies** on CAPADEX and Competency constructs (internal consistency α, test–retest, factor structure). This is the only lever that lifts Scientific Readiness above ~40.
2. **Route all four products' predictions through the employer-TIG calibration engine**; report Brier/ECE + trust state per product. Predictive Readiness becomes *measured*, not asserted.
3. **Close the realized-outcome loops** for retention/promotion currently scaffolded as `pending_*`.

## Phase 4 — Build the MISSING depth *(parallelizable, longer)*
1. **Unify + scale the competency ontology** toward 1000+/5000+: merge `mei_*`/`capability_*`/`cb_*`/`competency_dna_*` into the canonical `ont_*` layer, then bulk-import O*NET/ESCO.
2. **Rebuild LBI** on a real derivation engine + real behavioural signals (time-on-task, retries) + populated norms/clusters.
3. **Deepen the career graph** (200 → thousands of roles via O*NET/ESCO) and add validated multi-step transition probabilities + real future-role prediction (retire `[DEMO]`).
4. **Materialise CAPADEX archetypes & growth intelligence** (currently absent / unfired).

---

## Sequenced path to the certification thresholds

| Threshold | Today | Lever | Phase |
|---|---|---|---|
| Outcome-validation framework *established* | code exists, 0 data | capture realized outcomes; route all products through TIG calibration | 1 → 3 |
| Intelligence *foundations* > 95% | Ontology 22 / Outcome 35 | ontology unify+import; activate outcome loop | 1 + 4 |
| Intelligence *products* > 90% | avg ≈ 32 | activate (P1) → de-seed (P2) → validate (P3) → deepen (P4) | 1 → 4 |

**Fastest visible gains:** Phase 0–1 (weeks) lift **Activation** across WS2/WS4/WS5/WS6 with no new engines.
**Decisive gains:** Phase 2–3 lift **Scientific + Predictive + Outcome** readiness — the axes that actually separate MetryxOne from a polished demo, and the only ones that make an institution or employer choose it on intelligence quality.
**Moat:** Phase 4 ontology/graph depth + LBI rebuild — worth doing only *after* the platform can prove its existing intelligence is real (else it scales an unvalidated product).

## Definition of world-class intelligence for MetryxOne
A product crosses ~90% when: its constructs are **empirically derived** (not seeded), it produces **calibrated predictions with a measured Brier/ECE**, those predictions are **linked to realized outcomes** through the (already-built) validation framework, and its ontology/graph is **deep enough to be credible**. On today's evidence the nearest products are **Career (45)** and **Employability (35)**; the cheapest portfolio-wide gain is **activating dormant machinery and switching on the outcome loop that already exists.**
