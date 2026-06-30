# Program 2 · Phase 2.2 — 03 · Duplicate Code Report

## 1. Route-registration duplicates — CLOSED in 2.1 (not re-counted)
The most material duplication — the **same method+path registered twice** in `routes.ts` (Express runs the first; the second is dead) — was found and resolved in Phase 2.1: `GET /api/hr/jobs/:id` and its security-divergent twin (D2), plus 8 further divergent pairs adjudicated per-pair and the shadowed copies removed (D3). Re-scan confirms **no remaining live duplicate route registrations**.

## 2. `-v2` + bare modules — NOT duplicates (intentional)
Several domains register both a `-v2` and a bare module (predictive-intelligence, workforce-os, governance, competency-runtime, adaptive-assessment). The `-v2` modules are the **active runtime** (flags `advancedCompetencyRuntimeV2`, `adaptiveAssessmentRuntimeV2`, `contextualScoringV2`, `workforceOSV2` default ON) registered at distinct base paths. This is specialization, not redundancy. **No action** (confirms 2.1 A4 / report 04 §2).

## 3. Dead / duplicate services — 9 candidates investigated, ALL disproven
An exploratory scan proposed 9 "dead" services and several "superseded" pairs. **Every one was disproven** by `.js`-extension-aware import verification:

| Candidate | Real reference(s) found |
|---|---|
| `services/dispute-override-engine.ts` | imported by `routes/workforce-os.ts`, `routes/workforce-os-v2.ts`, + 2 tests |
| `services/dispute-override-engine-v2.ts` | imported by `routes/workforce-os-v2.ts` |
| `services/functional-competency-seeding-engine.ts` | imported by `services/unified-competency-profile-engine.ts`, `services/role-dna-runtime-engine.ts`, `routes/role-dna-runtime.ts` (`import type { CompetencyTarget }`) |
| `services/stability-analysis-engine.ts` | imported by `routes/psychometrics.ts` + test |
| `services/weighting-engine.ts` | imported by `services/adaptive-benchmark.ts`, `services/stage-guidance-orchestrator.ts`, `routes/adaptive-benchmark.ts`, `services/contextual-weight-engine.ts`, `services/expectation-engine.ts` |
| `services/developmental-sanitizer.ts` | imported by its test (`tests/developmental-sanitizer.test.ts`) |
| `services/question-utility-index.ts` | imported by `services/question-registry-service.ts` |
| `services/scenario-engine.ts` | imported by `routes/career-simulation.ts`, `scripts/smoke-career-simulation.ts` |
| `services/omega-x-scoring.ts` | imported by `tests/omega-x-scoring.test.ts` |

**Conclusion: 0 true duplicate/dead services.** This confirms the Phase 2.1 "0 orphans" finding and is a direct example of the honesty constraint — a naive grep that missed dynamic registration (`registerPersonaExpansionRoutes`) and `import type` would have falsely deleted live code.

## 4. Residual duplication: copy-pasted read-helper idiom (register, on-touch)
A genuine, low-severity DRY signal: a small never-throws DB-read idiom — helpers named `tableReady` / `scalar` / `rows` / `pct` (and close variants) — is **copy-pasted across many composer services** (e.g. `services/engineering-intelligence.ts` and peers) rather than shared from `lib/`.
- **Why not consolidated here:** extracting a shared helper would touch a large number of the 442 services with no behavior change but real regression surface, under a strict no-regression / preserve-architecture mandate. That is rewrite-shaped.
- **Disposition:** registered in report 07 as **Medium, on-touch** — adopt a shared `lib/` read helper opportunistically when a file is already being modified, never as a big-bang sweep.

## 5. Verdict
No live duplicate routes, no duplicate/dead services. The only residual duplication is a stylistic helper idiom whose safe resolution is incremental (on-touch), not a Phase-2.2 bulk refactor.
