# 5 · Customer Journey Enhancement Matrix

Journey stages: Registration → Assessment → AI Analysis → Recommendations → Learning → Intervention →
Reports → Progress → Completion. Verdict per stage + enhancement (no business-logic change).

| Stage | State | Evidence | Enhancement | Priority |
|---|---|---|---|---|
| Registration | COMPLETE | `/api/register` (limiter, password policy, child creation) | persona-aware onboarding hints; confirm consent flows (DPDP) | Low |
| Assessment (entry) | COMPLETE | CAPADEX/SDI entry; LBI/competency progress | **add explicit Exit/re-test view** (see Assessment AC-1) | **High** |
| AI Analysis | COMPLETE (honest degradation) | OpenAI + rule-based fallbacks, source tags | consistency fix AIE-1; quality harness AIE-3 | High |
| Recommendations | COMPLETE | recommendation/intervention engines, confidence-scored | surface confidence+evidence uniformly (AIE-4) | Medium |
| Learning | PARTIAL | learning modules present | thin content/execution depth | Medium |
| Intervention | PARTIAL | `intervention-engine.ts` recommends | **execution loop is fallback-heavy — close "do the intervention"** | **High** |
| Reports | COMPLETE | report-factory/pack/pdf-renderer, white-label, k-anon | polish to customer-ready (UXE-5) | Medium |
| Progress | COMPLETE | longitudinal LBI/competency/EI trends | pre-vs-post growth view (ties to AC-1) | High |
| Completion | PARTIAL | no explicit certification/exit milestone | **add completion/certificate milestone composing existing growth data** | Medium |

## Cross-journey enhancement themes
| ID | Theme | Why | Priority |
|---|---|---|---|
| CJ-1 | **Close the loop: Assessment → Intervention → Re-test → Growth report → Completion** | today the journey is strong entry→analysis→reports but **thin at intervention-execution and exit/completion** — the back half is where retention + proven outcomes live | **High** |
| CJ-2 | **Honest empty states for data-dependent stages** (recommendations/progress/reports read empty pre-traffic) — verify none fabricate | preserve trust at launch | High |
| CJ-3 | **Persona-routed journey continuity** — experience-routing lands users on the right surface; verify each persona's full 9-stage journey is reachable without dead-ends (memory records discovery/launchpad dead-end traps) | completeness | Medium |
| CJ-4 | **Progress notifications / nudges** to pull users back into the loop (background-job infra already exists) | engagement; enhancement not new architecture | Medium |

## Journey enhancement summary
- **Front half (Registration → AI Analysis → Reports): mature.**
- **Back half (Learning → Intervention execution → Completion): the enhancement frontier** — closing
  CJ-1 (the assess→intervene→retest→complete loop) is the single most valuable *journey* enhancement and is
  **compositional** over engines that already exist (intervention-engine, longitudinal runs, report-pack).
