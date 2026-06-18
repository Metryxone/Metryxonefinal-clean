# WC-2 · Output 9 — CAPADEX World-Class Readiness Score + Implementation Roadmap

> Design + honest measurement. Aggregates all tracks into one readiness score and a roadmap-only plan.
> **No implementation executed; STOP for approval.**

## CAPADEX World-Class Readiness Score

### Readiness tiers
`0–40 Forming · 41–60 Developing (Operational) · 61–75 Maturing · 76–88 Advanced · 89–100 World-Class`

### Per-track scorecard (honest current state)

| Track | Current | Stated target | Realistic band | Gap (to realistic) | Mostly fixable by… |
|---|---|---|---|---|---|
| Question Intelligence | **51** | > 90 | 76–82 | 25–31 | C-2 Waves (capability→signal→behaviour) |
| Personalization | **55** | > 90 | 78–85 | 23–30 | Wire context/archetype (no enrich) + Wave 2 |
| Stage Intelligence | **45** | > 90 | 88–92 | 43–47 | **Design only** (most reachable) |
| Outcome Intelligence | **42** | > 85 | 82–88 | 40–46 | **Design** (compose existing) |
| Growth Journey | **50** | > 90 | 80–88 | 30–38 | Design + LBI integration |
| Routing Readiness | **53** | > 90 | 80–88 | 27–35 | Wire context (no enrich) |
| AIS | **60** | > 95 | 78–85 | 18–25 | Credential adoption (not enrich) |
| Trust Score | **60** | > 90 | 76–84 | 16–24 | Verification + Wave 3 |

### Composite

```
World-Class Readiness = 0.80·mean(5 intelligence tracks) + 0.10·AIS + 0.10·Trust
  intelligence-tracks mean = (51+55+45+42+50)/5 = 48.6
  composite = 0.80×48.6 + 0.10×60 + 0.10×60 = 50.9 → 51
```

> **Note:** Routing Readiness (Output 6, 53/100) is reported and tracked as its own deliverable but
> is **excluded from the 5-track composite by design** — it is a sub-capability of Growth Journey
> (already in the composite), so counting it twice would inflate the score.

## **CAPADEX World-Class Readiness Score = 51 / 100 → Tier: "Developing (Operational)"**

**Interpretation (honest):** CAPADEX is a **production-capable diagnostic engine**, not yet a
world-class **development** platform. The gap is concentrated in (a) within-question distinctness
(architectural, needs C-2 waves) and (b) the **absence of design layers** for Stage / Outcome /
Growth-Journey intelligence (reachable by design alone).

### Achievable trajectories (honest)

| Scenario | Reaches | Notes |
|---|---|---|
| **This phase (design specs only, no enrichment)** | **~58–62** | Stage/Outcome/Journey specs + wiring context into routing |
| **+ Smallest-change set (wiring + Wave 2 capability)** | **~66–72** | No flagship signal backfill |
| **+ Full C-2 Waves 2–4 + LBI + credential adoption** | **~82–86** | Repo-wide ceiling; **<90 is honest** given documented limits |
| **Stated WC-2 targets (90+ across the board)** | **Not reachable repo-wide** | Caps: differentiability ~0.55, AIS multiplier 1.3, Exam corpus 0 |

## Smallest set of changes (highest ROI, ranked)

1. **Wire shipped context + archetype into the live picker/QRS** (no enrichment) → biggest immediate
   lift to Personalization + Routing (+39–87 pp proven). *Effort: Low. Impact: High.*
2. **Specify + materialise Stage / Outcome / Growth-Journey as compose-only read layers** over
   existing CSI + behaviour graph + intervention library. *Effort: Medium (design). Impact: High —
   unlocks 3 tracks with no data change.*
3. **Capability Wave 2** (coverage-gated ≥60%) → the highest-yield enrichment after archetype.
   *Effort: Medium. Impact: High on Question Intelligence + Personalization precision.*
4. **Signal Wave 3** (grounding-conditional; 119 weak-grounded first; WC-class grounding for the 25
   ungrounded). *Effort: High. Impact: Medium, lifts Trust/Outcome confidence.*
5. **Behaviour Wave 4 (curated) + Academic/Competitive context corpus** → unblocks Exam pathway/
   Outcome. *Effort: High. Impact: Medium, closes the only 0-scoring context.*

## Implementation Roadmap (roadmap only — not executed)

| Step | Track(s) moved | Type | Gate |
|---|---|---|---|
| R1 | Personalization, Routing | Wiring (no enrich) | flag-gated; AQ-2R routing measure |
| R2 | Stage, Outcome, Growth Journey | Design/compose layers | architect review per layer |
| R3 | Question Intelligence, Personalization | Capability Wave 2 | coverage ≥60%; coverage-weighted diff |
| R4 | Trust, Outcome | Signal Wave 3 | two-key grounding rule |
| R5 | Outcome (Exam), Growth Journey (Exam) | Behaviour curated + context corpus | curated quality gate |
| R6 | AIS, Trust | Credential-verification adoption | separate adoption track |

**Sequencing principle (from C-1AR, unchanged):** measure before/after every step (AQ-2R), gate on the
**coverage-weighted** metric, never fabricate, never claim unmeasured gains, and re-state any 90+
target that exceeds a documented ceiling as a realistic band.

## STOP

Design + honest measurement complete. No engines built, no ontology/signal/concern changes, no
enrichment, no production/code/DB changes. **WAIT FOR APPROVAL.**
