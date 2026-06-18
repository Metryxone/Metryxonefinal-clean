# WC-2 · Output 6 — Routing Readiness Report

> Design + honest measurement. Scores how ready CAPADEX is to route users into the right downstream
> pathway. No routing changes executed.

## Scorecard

| Field | Value |
|---|---|
| **Current Score** | **53 / 100** |
| **Stated WC-2 Target** | > 90 (implied by Growth Journey) |
| **Realistic Target Band** | **80–88** |
| **Gap (to realistic band)** | ~27–35 points |
| **Evidence** | Pilot routing simulation: context-aware routing lifted precision **+86.9 (Learning) / +85.8 (Career) / +85.8 (Employability) / +39.0 (Competency) / 0.0 (Competitive Exam)** pp vs the domain-blind baseline. |
| **Root Cause** | Context is shipped but **not yet wired into the live runtime picker score**; and the **Competitive-Exam context is absent** from the generic pools. |
| **Estimated Effort** | Low–Medium for wiring (no enrichment); High for the Exam corpus. |
| **Expected Impact** | Wiring context into the picker is the **single highest-ROI, no-enrichment change** in WC-2. |

## Routing simulation summary (5 readiness contexts)

| Context | Baseline (domain-blind) | After (context-aware) | Lift (pp) | Status |
|---|---|---|---|---|
| Learning | low | high | **+86.9** | Ready (wire it) |
| Career | low | high | **+85.8** | Ready (live) |
| Employability | low | high | **+85.8** | Ready |
| Competency | low | moderate | **+39.0** | Partial |
| Competitive Exam | 0 | 0 | **0.0** | **Blocked (corpus)** |

## Routing readiness by component

| Component | State |
|---|---|
| Concern resolution (never 404s) | **Strong** |
| 3-tier clarity picker + `clarity_source` provenance | **Strong** |
| Context dimension (shipped) | Present, **not yet scored in picker** |
| QRS (age/persona/context/stage) | **Designed**, not the live default |
| k-anonymity / confidence gating | Present (k_min = 30) |
| Competitive-Exam / Academic corpus | **Absent** |

## Smallest set of changes toward world-class

1. **Wire context + archetype into the live picker score (QRS default-on behind a flag)** — realises
   the +39–87 pp already proven, with **no enrichment**.
2. **Add routing confidence gating** so low-confidence pathways are suppressed, not guessed.
3. **Author the Academic/Competitive-Exam context corpus** (Wave 4) to unblock the Exam pathway.

Lift estimate: steps 1–2 move Routing Readiness **53 → ~80**; step 3 reaches the top of the band and
unblocks the only 0-scoring context.
