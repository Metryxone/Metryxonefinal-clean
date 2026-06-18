# Deliverable 5 — 90%+ Personalization Plan

Goal: lift **Live PCI ≈ 16% → ≥ 90%** by consumption/activation only. Numbers use the rubric in
`00_README.md` and are **code-derived estimates**, shown with arithmetic so they are auditable, not
fabricated. "Production capability ~80%" (the brief's baseline) is the producer maturity; this plan
moves the **consumed** figure to meet/exceed it.

## Target matrix (after Levers A–D)
| Surface | P | S | O | J | B | L | E | Target depth | Live? |
|---------|---|---|---|---|---|---|---|--------------|-------|
| Report | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **0.96** | LIVE |
| Recommendation | ✓ | ✓ | ✓ | ✓ | ✓ | ◑ | ✓ | **0.90** | LIVE |
| Growth Plan | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **0.94** | LIVE |
| Mentor | ✓ | ✓ | ✓ | N/A | ✓ | ◑ | ✓ | **0.86** | LIVE |
| Commercial Offer | ✓ | ✓ | ✓ | ◑ | ◑ | N/A | ✓ | **0.88** | LIVE |

**Target Live PCI ≈ (0.96+0.90+0.94+0.86+0.88)/5 = 0.91 (91%)**, activation rate 5/5.

Residual (why not 100%, honestly): longitudinal degrades to "no trend" on first sessions; persona is
coarse for anonymous self-assessment; commercial behaviour tailoring stays partial by design (offer
intensity, not full profile). These honest residuals keep the ceiling around ~91%, clearing 90%.

## Expected lift decomposition (Live PCI)
| Step | Closes | Live PCI after | Δ |
|------|--------|----------------|---|
| Baseline | — | **~16%** | — |
| Lever A — activate consumer chain | G1 | **~37%** | +21 |
| Lever B — persona + envelope injection | G2, G3 | **~59%** | +22 |
| Lever C — WC-3 routing into Reports/Recs | G4 | **~79%** | +20 |
| Lever D — longitudinal + behaviour | G5, G6 | **~91%** | +12 |

- **Lever A** simply realizes existing coded depth live (Growth/Mentor/Commercial 0 → 0.50/0.33/0.25).
- **Lever B** raises persona utilization 40%→100% and envelope 0%→~90%.
- **Lever C** raises stage/journey utilization on the two live content surfaces.
- **Lever D** raises longitudinal utilization ~10%→~70% and finishes behaviour threading.

> **Lift caveat (grounded):** the Lever-A arithmetic assumes ALL existing flags each bridge requires
> are enabled — gating is two-level, so Growth/Mentor/Commercial need their per-bridge flags
> (`journeyGrowthPlanBridge`, `decisionMentorBridge`, `commercialActivation`) ON **in addition to**
> `decisionOrchestrator`. With only the orchestrator ON, those slots stay `bridge_disabled` and the
> +21pt Lever-A lift is NOT realized. All projections are code-derived estimates (see `00_README.md`),
> not telemetry.

## Cost / risk profile
- All levers are **additive, flag-gated, no-schema, read-only composition** over producers that
  already run every session. Each is independently reversible (flag OFF → legacy).
- Highest ROI / lowest risk = **Lever A** (no new logic; flip the existing gated chain into the live
  flow). Recommended first.

## Definition of done (for the eventual build phase, not this audit)
- 5/5 surfaces consume persona + envelope + stage/outcome/journey; longitudinal consumed where ≥2
  sessions exist; behaviour profile threaded into bridges.
- Live PCI ≥ 90% measured by re-running this matrix against the code after the build.
- Honest degradation verified: every dimension omits cleanly when absent (no fabricated trajectory,
  stage, or persona).

---
**STATUS: AUDIT COMPLETE — STOP. Awaiting approval before any implementation.**
No code changed, no schema changed, no flags flipped. Levers A–D are proposals only.
