# WC-3 · Output 6 — Implementation Roadmap

> Design only. Sequenced, gated plan to build the 7 layers. **No code/schema/enrichment executed.**
> Sequencing reuses the WC-2 smallest-change set and the C-1AR rollout governance. STOP for approval.

## Sequencing principle

Build **design-reachable, no-enrichment** layers first (fast, honest 90+ where the ceiling allows),
then the **enrichment-gated** layers (bounded by documented ceilings, dependent on C-2 Waves).
Measure before/after at every step; gate on the coverage-weighted metric; never claim unmeasured gains.

## Phased roadmap

### Phase A — Foundation (no enrichment, highest ROI)
| Step | Layer(s) | Migrations | Gate | Expected track lift |
|---|---|---|---|---|
| A1 | **L4 wiring** (context+archetype+severity in picker) | M1, M2 | flag-gated; AQ-2R routing measure | Personalization 55→~70; Routing 53→~80 |
| A2 | **L1 Stage** (5-stage framework + resolver) | M3 | architect review; monotonicity | Stage 45→~80 |
| A3 | **L6 Longitudinal** (unify existing stores) | M6 | append-only integrity | Longitudinal ~40→~75 |

### Phase B — Composition layers (design-reachable)
| Step | Layer(s) | Migrations | Gate | Expected track lift |
|---|---|---|---|---|
| B1 | **L2 Outcome** (compose-only models) | M4 | explainability/actionability ≥85 | Outcome 42→~80 |
| B2 | **L3 Journey** (routing/journey models) | M5 | confidence-gate; pathway honesty | Journey 50→~78 |
| B3 | **L7 Outcome Validation** (loop) | M7 | calibration on real pairs (allowed to fail) | Validation ~30→~75 |

### Phase C — Enrichment-gated (bounded by ceilings; depends on C-2 Waves)
| Step | Layer(s) | Dependency | Gate | Honest ceiling |
|---|---|---|---|---|
| C1 | **L5 QIS 2.0 promote** + matrix | M1 (done) | coverage-weighted differentiability ≥0.30 | repo-wide 76–82 |
| C2 | **Capability Wave 2** (C-2) → feeds L4/L5 | C-2 enrichment | coverage ≥60% per tag | precision 0.10→0.30 |
| C3 | **Signal Wave 3** (grounding-conditional) | grounding rule | two-key grounding | Trust/Outcome confidence |
| C4 | **Behaviour Wave 4 + Academic/Exam corpus** | corpus authoring | curated quality gate | unblocks Exam outcome/pathway |

### Phase D — Adoption (outside enrichment)
| Step | Layer(s) | Dependency | Note |
|---|---|---|---|
| D1 | AIS/Trust uplift | credential-verification adoption | separate adoption track; AIS>95 unreachable → re-stated bands |
| D2 | LBI integration | next platform project | lights up Learning pathway end-to-end |

## Dependency graph

```
A1(L4 wire) ─┐
A2(L1)──────┼─► B1(L2) ─► B2(L3)
A3(L6)──────┘                 │
                              ▼
                          B3(L7)
C1(L5) ─► C2(Cap Wave2) ─► C3(Signal Wave3) ─► C4(Behaviour+Corpus)
D1(credential adoption)   D2(LBI)   ── independent tracks
```

## Composite trajectory (honest, restated)

| Milestone | World-Class Readiness | Tier |
|---|---|---|
| Today (WC-2 baseline) | 51 | Developing |
| End of Phase A | ~64–68 | Maturing |
| End of Phase B | ~72–76 | Maturing |
| End of Phase C | ~82–86 | Advanced (repo-wide honest ceiling) |
| Stated "90+ all layers" | not reachable repo-wide | bounded — realistic bands reported |

## Governance (from C-1AR, unchanged)

- One layer at a time; architect review + flag-off parity gate before enabling each.
- Measure before/after with the same methodology; report honest deltas (including failures).
- Reversible at every step (`DROP TABLE wc3_*`).
- Never fabricate; never tune validation to force a pass; re-state any 90+ target that exceeds a
  documented ceiling as a realistic band.

## STOP

WC-3 design complete (architecture, data model, runtime design, migration plan, validation plan,
roadmap + 7 layer specs). **No implementation, no schema, no enrichment, no code/DB/production
changes.** WAIT FOR APPROVAL.
