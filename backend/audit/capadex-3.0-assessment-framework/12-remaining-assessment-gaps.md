# CAPADEX 3.0 · Phase 1.3 — Remaining Assessment Gaps (classified)

> Deliverable 12 · Generated 2026-06-30T11:44:25.490Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9b3be5dcc291, written 2026-06-30T11:44:25.495Z).
> Honesty: Coverage⟂Confidence⟂Outcome (never composited); null ≠ 0; never fabricated.

Counts: **0 Launch-Critical · 0 High · 1 Medium · 3 Low · 1 Future**.

## Launch-Critical
_None._

## High
_None._

## Medium
### GAP-A-LEARNER-BACKHALF — Learning & learner-side Performance content breadth is uneven (employer-side strong)
- **Evidence**: Learning=PARTIAL (no-sandbox curated MCQ only, uneven across stages/personas); Performance=PARTIAL (strong employer surface, thin learner-facing surface). The CLOSE-THE-LOOP re-measurement (Progress/Exit/Continuous) is now instrumented via reuse — this residual is curated CONTENT breadth (human-authored), not missing engine wiring.
- **Remediation**: Extend curated MCQ/practice + learner-side performance surfaces; reuse exam-ready + role-DNA. Content task — never fabricate items.

## Low
### GAP-A-RUNTIME-DUP — competency-runtime ⟂ competency-runtime-v2 migration not consolidated
- **Evidence**: KNOWN_OVERLAPS CONSOLIDATION_CANDIDATE; two runtimes coexist (migration-in-progress).
- **Remediation**: Plan a deliberate, flag-gated migration; recommend + human approval. Do NOT silently merge (breaking-risk).

### GAP-A-SCORING-DUP — spe-scoring-engine ⟂ caf/scoring-engine share weighted-scoring logic
- **Evidence**: KNOWN_OVERLAPS CONSOLIDATION_CANDIDATE; similar logic in different dirs.
- **Remediation**: Extract a shared scoring util on approval; recommend only.

### GAP-A-LBI-LEGACY — lbi_questions_legacy deprecated table still present
- **Evidence**: Superseded by sdi_items / psychometric_question_bank.
- **Remediation**: Archive (retire) on approval; never delete blindly.

## Future
### GAP-A-CLINICAL-VERTICALS — Government / Healthcare / Clinical-Psychology assessment verticals deferred
- **Evidence**: Persona expansion G-F6 non-clinical scaffold only; "not validated / not for clinical use".
- **Remediation**: Out of scope; boundary marker only. Requires domain validation before any clinical claim.
