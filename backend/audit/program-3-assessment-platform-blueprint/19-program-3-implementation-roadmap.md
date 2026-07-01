# 19 · Program 3 Implementation Roadmap

**Mode:** Read-only / planning-only. This is a **proposal**, not an implementation. No changes made. Every item below is additive, flag-gated, and byte-identical-off. Execution begins only after the freeze (doc 20) is approved.

## Sequencing Principles
1. **Additive & flag-gated** — each phase ships behind its own feature flag; flag-off is byte-identical including schema.
2. **Reuse-before-build** — extend the frozen engines; no parallel stacks.
3. **Honesty-preserving** — Coverage ⟂ Confidence ⟂ Adoption stay separate; norms/benchmarks stay distinct; never fabricate a norm.
4. **Stop-for-approval** per phase before merge/deploy (user preference).

## Proposed Phases (priority order)

### Phase 3.1 — Norm Engine Depth (GAP-AP-4/5/6) · Medium · **highest product value**
- Add per-population norm tables using the **existing `lbi-norms-engine.ts` pattern** (per-population reference distributions + versioning + `is_provisional`).
- Populations: education-tier, competitive-exam (JEE/NEET/CUET), and — **only after an ethics/legal decision** — gender.
- **Gate:** a norm exists ONLY when a real, sufficiently-sampled distribution is computed (k-threshold). No fabricated norms.
- Flag: `normEngineExpansion` (new). Byte-identical off.

### Phase 3.2 — Standardization Breadth (GAP-AP-7) · Low
- Add canonical **T-score (SD=10)** and **stanine (1–9)** transforms over the existing z-score.
- **Relabel** the current SD=15 output as a "deviation score" (honesty; not a T-score).
- Flag: `standardizationExpansion` (new).

### Phase 3.3 — Accessibility Layer (GAP-AP-3) · Medium
- Add WCAG semantics, keyboard-only navigation guarantees, screen-reader labels, and contrast modes to the core delivery components (`FreeAssessmentModal.tsx`, `AdaptiveAssessmentRuntime.tsx`, `LbiAssessmentPlayer.tsx`).
- Flag: `assessmentAccessibility` (new); progressive enhancement, no behaviour change off.

### Phase 3.4 — AI Prompt Management (GAP-AP-9) · Medium
- Net-new **versioned, governed prompt registry** (prompt table + version + governance/approval + provenance) extending the admin control plane; wire `ai-orchestration-engine.ts` to read prompts from the registry with code-embedded fallback.
- Flag: `aiPromptManagement` (new). Byte-identical off (falls back to embedded prompts).

### Phase 3.5 — Question Bloom Breadth (GAP-AP-1) · Low
- Extend `cognitive_level` / Bloom coding to the behavioural `psychometric_question_bank`; reuse existing `BLOOM_MULTIPLIERS`.
- Flag: `questionBloomExpansion` (new).

### Phase 3.6 — Country Benchmarks (GAP-AP-8) · Low
- Extend the `ti_*` benchmark pattern with a country dimension + k=30 suppression.
- Flag: `countryBenchmarks` (new).

### Phase 3.7 (Future) — Offline Delivery (GAP-AP-2)
- Offline-capable delivery (local persistence + deferred sync). Future scope; not required for launch.

### Optional — Consolidation Views (OVL-1/2/3) · recommend-only
- Read-only unified provenance views for scoring, benchmarking, and question stores. No engine removal.

## Dependency Notes
- 3.1 (Norms) → 3.2 (Standardization) benefits from norm depth but is independent.
- 3.4 (Prompt mgmt) is independent and parallelizable.
- 3.3 (Accessibility) is frontend-only and parallelizable.
- No phase depends on removing an overlapping stack.

## Non-Goals (freeze protects these)
- No redesign of the 13-layer architecture or the Question→Outcome spine.
- No new parallel scoring/benchmark/report/analytics engine.
- No composited Coverage/Confidence/Adoption metric.
- No fabricated norms, benchmarks, or outcomes.
