# MX-74X · Section 8 — Employability ⟂ Career Alignment (existing asset — documented)

**Status:** EXISTING. **Engines:** `services/employabilityEngine.ts` (8-dim EI),
`services/ei-profile-engine.ts`, the EI dashboard engine (3.10). **Flag:** `competencyEi` /
`careerIntelligence` (inherit suite).

---

## 1. The alignment

The Employability Index (EI) is the single source of the gauge-driving employability score. Career
intelligence COMPOSES the EI profile — it never recomputes EI. The Career Intelligence bridge
(`services/career-intelligence-bridge.ts`) folds EI + readiness + gaps + recommendations into one
read-only envelope across the six career surfaces (Readiness · Pathways · Planning · Growth ·
Development · Builder).

## 2. Honesty rules (already enforced)

- **One EI implementation.** `employabilityEngine.ts` is the formula authority; classifiers are
  never duplicated inline. A separate entity-resolved 6-dim backend score exists but does NOT drive
  the gauge.
- **Coverage ⟂ Confidence** is reported per surface; `domain_proxy` caps are disclosed.
- Trend anchors only on **measured** snapshots (`< 2` → insufficient history, `null` never fake 0).

## 3. MX-74X contribution

The new Career Path / Learning Path engines sit downstream of this aligned EI+readiness substrate
and re-shape it into progression and learning sequences — keeping the alignment intact (no parallel
score, no recompute). The durable suite flag ensures the whole aligned chain is live on a clean
boot.
