# 02 · Product Vision Validation

Validates vision/mission/scope against what the **repository actually implements** (not aspiration).

## Stated vision (from `replit.md` + repo structure)
**MetryxOne / CAPADEX = a behavioral-intelligence SaaS platform** that assesses behaviour & competency,
interprets it with AI, and drives career/learning/hiring outcomes across education, career, and enterprise
segments, through a staged lifecycle (Curiosity → Insight → Growth → Mastery).

## Vision ↔ implementation (honest)
| Vision pillar | Repo evidence | Status |
|---|---|---|
| Behavioural assessment (CAPADEX/SDI) | `services/wc3/*`, `sdi.ts`, signal/clarity engines | **IMPLEMENTED** |
| Competency assessment & ontology | `onto_*` tables, `competency-*` services, 12-layer ontology | **IMPLEMENTED** |
| Learning/behavioural index (LBI) | `lbi-intelligence.ts`, `lbi_*` | **IMPLEMENTED** |
| AI interpretation | `ai-reasoning-engine.ts`, `runtime-explainability-engine.ts`, `aiClient.ts` | **IMPLEMENTED (accuracy unvalidated)** |
| Career outcomes | Career Builder/Launchpad/Readiness, `career-*` engines | **IMPLEMENTED** |
| Hiring/employer outcomes | Employer Portal, talent-match, interview intel | **IMPLEMENTED** |
| Staged lifecycle | `CANONICAL_STAGE_ORDER` (5 stages) | **IMPLEMENTED (progression weak — see 10)** |
| Reports as business outcome | Report Factory + report-pack (22 builders) | **IMPLEMENTED (report ≠ realized outcome)** |
| Enterprise governance / meta-intelligence | MX-700/MX-800 tiers | **DORMANT (default-OFF, honest)** |

## Scope drift (measured, not asserted)
- **190 feature flags, 158 OFF (83%).** Large built-but-dormant surface (MX-700 lifecycle tiers, MX-800
  intelligence tiers). This is **honest dormancy** (default-OFF, byte-identical) **not scope drift** — but it
  is a *coordination* signal: the platform is **Connected, not yet Orchestrated**.
- **Parallel `-v2` engines** (≥11 `-v2` files; e.g. predictive-intelligence vs -engine vs -v2) — duplication
  **REVIEW CANDIDATES**, not confirmed redundancy.
- **1,441 live tables vs 134 canonical Drizzle `pgTable`** — schema sprawl from lazy ensure-schema patterns;
  a coherence (not correctness) risk.

## Duplicate concepts (candidates, repo-evidenced)
- Multiple adaptive variants (`V2` / `AdaptiveCausal` / `AdaptiveOrchestration`).
- Three predictive-intelligence route files (older system / real 2.7 engine / v2-of-older).
- Mentor vs Coach vs Counsellor surfaces overlap conceptually.

## Missing product areas (vs stated multi-segment ambition)
- No dedicated **government / healthcare / NGO** vertical experience (sector-tag only — see 03).
- No explicit **user-facing certification** artifact (see 10).
- No **AI accuracy/quality** product surface (see 11).

## Verdict
**Vision is coherent and ~90% structurally realized.** The gap is **maturation + orchestration + validation**,
not missing architecture. No redesign warranted.
