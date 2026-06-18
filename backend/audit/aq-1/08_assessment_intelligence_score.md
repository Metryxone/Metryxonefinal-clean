# AQ-1 · Output 8 — Assessment Intelligence Score & Final Classification

**Bank:** `capadex_clarity_questions` · 30,638 questions · **Investigation only — no questions modified or regenerated.**
**Date:** 2026-06-04

## Phase 7 — Question Alignment Score (0–100)
Each question scored on four 25-point components (deterministic, documented):
- **Concern Alignment (25):** concern + bridge tag present; penalised by concern-cluster fan-out on the tag.
- **Behavior Alignment (25):** best `concern_signal_map` confidence band (strong 25 / moderate 17 / weak 10 / none 0).
- **Capability Alignment (25):** 25 if the tag maps to one capability; penalised per extra capability; 0 if none.
- **Construct Alignment (25):** grounded signal-family evidence strength (strong 25 / moderate 15 / weak 8 / none 0) — a **proxy**, since no authoritative per-question construct exists.

### Score distribution (all 30,638)
| Band | Questions | % |
|---|---:|---:|
| 0–39 | 0 | 0% |
| **40–49** | **14,039** | **45.8%** |
| 50–59 | 410 | 1.3% |
| 60–69 | 5,084 | 16.6% |
| 70–79 | 9,485 | 31.0% |
| 80–89 | 0 | 0% |
| 90–100 | 1,620 | 5.3% |

- **Mean alignment: 60 / 100.**
- **Weak floor: 14,039 questions (45.8%) sit at 40–49**, of which **13,979 sit exactly at the floor score 43** — driven by `construct=0` (no atomic grounding on the tag) + ambiguous/absent capability + concern-cluster fan-out. The Top-500 list (Output 6) are the absolute floor and only the tip of this band.
- The strong tail (90–100, 5.3%) are questions on single-capability, well-grounded, strongly-mapped tags.

## Composite Assessment Intelligence Score
`0.6 × mean alignment (60) + 0.4 × metadata-coverage score (53)` = **57.2 / 100**.

(Metadata-coverage score = mean Present% across the 10 Phase-1 fields = 53. "Present" everywhere = resolves to exactly one value; the corrected Signal rule (>1 value = Ambiguous) lowers Signal Present% to 0.3%, which is why coverage is 53 not higher.)

## Critical structural gaps (each a hard finding)
1. **Development-stage taxonomy collapsed** — only 46.7% staged, and the sole non-blank value is "Clarity" (0 of Awareness/Curiosity/Growth/Mastery).
2. **Entrepreneur persona = 0 coverage** in the concern ontology the bank derives from.
3. **Age structurally ambiguous** — 95% of questions inherit a bridge tag whose age span crosses the youth↔adult (18) boundary; 0% resolve to a single clean band.
4. **`concern_id` orphaned** — disjoint from `capadex_concerns_master` (0% join); the bank links to the ontology only through `master_bridge_tag`, leaving no independent cross-check.

## Construct reachability (ontology side)
- Signal families reachable from the bank: **132 / 370**. **238 families (64%) are unreachable** from any bank bridge tag (see Output 7 — Top 100 Missing Constructs).

---

# FINAL CLASSIFICATION: 🔴 RED — Requires Repair

**Score 57.2/100 with four critical structural gaps.**

Classification rule: GREEN (World-Class) ≥ 80 and 0 critical gaps · YELLOW (Needs Enhancement) ≥ 55 and ≤ 1 critical gap · RED (Requires Repair) otherwise.

### Why RED (honest, not tuned)
The bank is **rich in raw content** (100% question/concern/bridge-tag coverage; 99.7% behaviour mapping) but **structurally thin in assessment intelligence**:
- It cannot target by **age** (95% ambiguous), is missing an entire **persona** (Entrepreneur), has no usable **development-stage** taxonomy, and its **construct** layer is a proxy that is absent for 44% of questions.
- Nearly half the questions (45.8%) sit at the alignment floor.
- Every derived attribute hangs off a single hinge (`master_bridge_tag`) because `concern_id` is orphaned — there is no redundancy to validate derivations.

### What would move it toward GREEN (recommendations — NOT executed here)
1. Add per-question **age_min/age_max** (or band) and a real **development-stage** assignment.
2. Re-link `concern_id` to `capadex_concerns_master` (or backfill a valid master concern key per question) so Age/Persona/Capability stop being tag-inherited and ambiguous.
3. Introduce **Entrepreneur** concerns/persona coverage.
4. Establish an authoritative **construct** field per question (retire the grounded-family proxy).
5. Extend governance-registry coverage from 46.7% to 100%.

> Per the task: **STOP. WAIT FOR APPROVAL.** No remediation, no question edits, no regeneration were performed.

## Output index
1. `01_metadata_coverage_report.md` · 2. `02_age_band_coverage.md` · 3. `03_persona_coverage.md` · 4. `04_development_stage_coverage.md` · 5. `05_behavior_coverage.md` · 6. `06_top_500_weak_questions.csv` · 7. `07_top_100_missing_constructs.csv` · 8. this file · machine-readable: `aq1_audit.json`.
