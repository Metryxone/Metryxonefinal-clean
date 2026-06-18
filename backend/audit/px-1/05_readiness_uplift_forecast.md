# P-X1 · Deliverable 5 — Readiness Uplift Forecast
_Generated 2026-06-10T14:38:00.263Z_

## Methodology
- Baseline scores are from published audit scorecards (WC-P1/P2/P3), grounded in code + DB.
- Phase uplift is estimated per-dimension based on the capability each phase implements.
- Two axes reported separately: **Coverage** (structural) and **Confidence** (activation/data).
- Estimates are conservative: no dimension is upgraded without an identified mechanical cause.
- Bounded items (occupation data, domain seeding, real user volume) are NOT inflated.

---

## EI — Employability Index

| Phase | Coverage | Confidence |
|---|---|---|
| Baseline | 32% | 23% |
| After F1 | 34% | 24% |
| After F2 | 37% | 26% |
| After F3 | 43% | 31% |
| After F4 | 49% | 36% |

**EI uplift by phase:**
| Dimension | Baseline | After F4 | Lever |
|---|---|---|---|
| Assessment Readiness | 35%/20% | 60%/45% | F4.1 competency→gauge wire is the key lever |
| Question Bank | 30%/25% | 35%/30% | Bounded by real user completions (data, not code) |
| Competency Framework | 20%/15% | 45%/30% | F4.1 wires framework → gauge (major uplift) |
| Employability Scoring | 65%/40% | 80%/60% | F4.1 formula unification (removes divergence) |
| Outcome Intelligence | 25%/20% | 30%/25% | Bounded by occupation data (owner action) |
| Recommendations | 40%/25% | 55%/35% | S4 user-keyed recs (F2/F3) |
| Career Routing | 20%/15% | 22%/18% | Bounded by occupation data (owner action) |
| Reporting | 65%/55% | 80%/70% | F4.1 gauge unification; F3 longitudinal panel |
| Personalization | 30%/25% | 55%/40% | F3.1+F3.2 wcl0 consumption (largest EI lever in F3) |
| Longitudinal | 15%/10% | 55%/35% | F2.1 snapshot trigger; F3.4 trend activation |
| Commercial | 10%/5% | 25%/12% | F1.3 entitlement guard; bounded by Razorpay config (owner) |

### EI honest ceiling analysis
- **70% coverage target**: Reachable only if occupation data is expanded (GAP-3, owner data action),
  and if real users complete assessments (GAP-Q, demand-side).
  After F4: ~49% — still below 70%. **Product-specific gap (GAP-3 occupation expansion)
  is the binding constraint after shared capabilities are applied.**
- **70% confidence target**: Contingent on formula unification (F4.1). After F4: ~36% — below 70%.
  Confidence rises primarily from real user volume and formula integrity.

---

## LBI — Learning Behavior Index

| Phase | Coverage | Confidence |
|---|---|---|
| Baseline | 33% | 1% |
| After F1 | 40% | 2% |
| After F2 | 43% | 3% |
| After F3 | 48% | 6% |
| After F4 | 50% | 8% |

**LBI uplift by phase:**
| Dimension | Baseline | After F4 | Lever |
|---|---|---|---|
| Framework (Domain/Qs) | 5%/0% | 5%/0% | Owner action: domain seeding (not shared cap) |
| Assessment Flow | 70%/0% | 70%/5% | Structurally ready; bounded by 0 sessions |
| Scoring Engine | 80%/0% | 80%/25% | F1.2.1 trigger fires calculateLBI (G2 quick win) |
| Report Generation | 20%/0% | 55%/20% | F1.3 tables + F4.2 AI guard |
| Recommendations | 15%/0% | 40%/10% | S4 activation via F2/F3; bounded by data |
| Personalization | 30%/0% | 48%/5% | F3.1+F3.2 wcl0 consumption |
| Longitudinal | 0%/0% | 35%/5% | F2.2 history table; F3.4 trend |
| Commercial | 60%/0% | 60%/0% | Infrastructure ready; cold-start (data) |
| Security | 40%/0% | 85%/0% | F1.1 auth hardening (5 unauth routes) |
| Product UX | 10%/5% | 18%/8% | Incremental UI improvements |

### LBI honest ceiling analysis
- **70% coverage target**: Reachable only after framework seeding (19 domains, G1 — OWNER/PRODUCT action).
  After F4: ~50% — Framework at 5% is a structural product gap, not a shared capability.
  **G1 framework seeding is the single largest LBI blocker and has no shared-platform equivalent.**
- **70% confidence target**: Requires real LBI sessions (data volume). After F4: ~8%.
  The scoring engine is ready (80% structural) but 0 sessions produce 0 confidence.

---

## Career Builder

| Phase | Coverage | Confidence |
|---|---|---|
| Baseline | 33% | 16% |
| After F1 | 35% | 18% |
| After F2 | 41% | 21% |
| After F3 | 48% | 27% |
| After F4 | 53% | 32% |

**CB uplift by phase:**
| Dimension | Baseline | After F4 | Lever |
|---|---|---|---|
| Career Discovery | 45%/20% | 60%/35% | S5/S6 personalisation depth |
| Career Mapping | 45%/25% | 60%/38% | S6 intelligence store enrichment |
| Recommendations | 35%/15% | 65%/40% | F2.3 user-keyed recs; F3 bridge activation |
| Growth Planning | 30%/10% | 45%/25% | S4 recs feed growth plan |
| Career Pathway | 25%/15% | 35%/22% | Bounded by occupation data |
| Outcome Intelligence | 25%/15% | 38%/25% | S8 CAPADEX→CB bridge activation |
| Longitudinal | 15%/5% | 65%/35% | F2.3 DB-backed memory; F3.3+F3.4 trend |
| Report Intelligence | 35%/20% | 60%/40% | F4.3 dedicated report surface |
| Personalization | 55%/25% | 72%/42% | F3.2 wcl0 full depth; already partially real |
| Commercial | 20%/10% | 30%/18% | Bounded by Razorpay config + real users (owner) |

### CB honest ceiling analysis
- **70% coverage target**: After F4: ~53% — approaching 70%.
  **CB has the most to gain from shared capabilities** because its existing infrastructure is the most complete.
  The binding constraint after F4 is job supply (0 postings) and mentor supply (0 mentors) — both data/market.
- **70% confidence target**: After F4: ~32% — below 70%.
  Confidence is data-starved across all three products.

---

## Cross-Product Readiness Forecast Summary

| Product | Baseline Coverage | After F1 | After F2 | After F3 | After F4 | 70% reachable? |
|---|---|---|---|---|---|---|
| **EI** | 32% | 34% | 37% | 43% | **49%** | ⚠️ Need occupation data + real users |
| **LBI** | 25% | 40% | 43% | 48% | **50%** | ⚠️ Need framework seeding + real users |
| **CB** | 37% | 35% | 41% | 48% | **53%** | ⚠️ Need job/mentor supply (market) |

| Product | Baseline Confidence | After F4 | 70% confidence reachable? |
|---|---|---|---|
| **EI** | 23% | **36%** | ❌ Requires formula fix (F4.1) + real user volume |
| **LBI** | 0% | **8%** | ❌ Requires framework seeding + sessions |
| **CB** | 17% | **32%** | ❌ Requires job/mentor supply + user volume |

**Honest conclusion**: 70% Coverage/Confidence is NOT reachable through shared-capability engineering alone.
Each product has a critical **data/market gap** that engineering cannot substitute:
- EI: occupation graph expansion (30 → 300+ occupations)
- LBI: framework seeding (19 domains, 3 age bands) + real assessment sessions
- CB: job postings supply + mentor profiles

Shared capabilities are necessary but not sufficient. The forecast above shows the realistic
ceiling from engineering alone, reported honestly without inflation.
