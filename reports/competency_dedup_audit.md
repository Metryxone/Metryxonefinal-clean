# Competency Assessment — Duplication & Cleanup Audit (Stage 0)

*Generated 2026-06-22 · Read-only audit · No code or data modified.*
*Scope: the **professional Competency Assessment** only. The student **Learning Behavior Index (LBI)** is a separate product by design and is OUT OF SCOPE.*

---

## 0. Headline (honest)

The competency assessment **was effectively built more than once** — there are parallel route systems, scoring engines, table namespaces, question banks, and frontend flows for the same concept. **However, almost none of the "earlier build" is safely deletable**, because:

- The empty `competency_*` tables are empty **only because the dev DB was never seeded** (seed files exist) — *not* because the feature was abandoned.
- The legacy routes and the legacy static question bank **still have live frontend callers** (the routed `CompetencyAdminPage` admin screen and the in-app scoring engine).

So this is primarily an **architectural-consolidation** problem, **not** a "delete dead modules" problem. Blind quarantine/deletion would break the competency admin panel and the scoring engine. **Recommendation: do NOT proceed to blind Stage 1/2 deletion. See §5.**

---

## 1. Evidence — live DB row counts (dev)

| Table | Rows | Verdict |
|---|---|---|
| `onto_competencies` | **299** | LIVE — canonical genome |
| `onto_domains` | **5** | LIVE |
| `onto_competency_question_map` | **25** | LIVE |
| `onto_competency_profiles` | **8** | LIVE — runtime scoring output |
| `onto_competency_score_runs` | **2** | LIVE |
| `competency_question_templates` | **44** | LIVE — V1 question bank |
| `competencies` | 0 | empty (unseeded) — route LIVE |
| `competency_domains` | 0 | empty (unseeded) — route LIVE |
| `competency_assessment_items` | 0 | empty (unseeded) — route LIVE |
| `competency_library` | 0 | empty (unseeded) |
| `competency_clusters` | 0 | empty (unseeded) — route LIVE |
| `ont_competencies` | 0 | empty — O*NET, seeded in prod only |
| `map_role_competency` | 0 | empty — O*NET, seeded in prod only |
| `competency_stage_norms` | MISSING | not migrated in dev |
| `competency_role_weights` | MISSING | not migrated in dev |

---

## 2. Parallel implementations (the real duplication)

### 2a. Backend route systems (4 parallel)
| System | Endpoints | Backing table | Status |
|---|---|---|---|
| Legacy admin CRUD | `/api/competency/items`, `/domains`, `/competencies`, `/clusters` | `competency_*` | **LIVE-wired** (CompetencyAdminPage + FrameworkPanel), data empty in dev |
| V1 selection | `/api/competency/questions/select` | `competency_question_templates` | **LIVE** (44 rows) |
| V2 runtime | `/api/competency-runtime/*`, `/api/v2/competency/*` | `onto_*` | **LIVE** (canonical) |
| Assessment Factory (CAF) | `/api/caf/*` | own tables | parallel/experimental — **NOT the old build; leave alone** |

### 2b. Scoring engines (3 parallel)
- `services/competency-scoring.ts` — canonical.
- `services/caf/scoring-engine.ts` — CAF factory (separate product surface).
- `services/ai-competency-inference-engine.ts` — LLM-driven inference.
- Frontend `lib/engines/scoringEngine.ts` — runs over the legacy static bank `ASSESSMENT_QUESTIONS`.

### 2c. Frontend question banks (2)
- `data/catalogs/assessment-questions.ts` (`ASSESSMENT_QUESTIONS`) — **legacy**, imported by `scoringEngine.ts`, `competencyStore.ts`, `careerEvents.ts` → **LIVE**.
- `data/catalogs/assessment-question-bank-v2.ts` (`ADAPTIVE_QUESTION_BANK_V2`) — **current**, used by `AdaptiveAssessmentRuntime` + `assessmentSelector.ts`.

### 2d. Frontend flows
- `CareerBuilderPage.AssessmentTab` — **current** primary flow (8k-line monolith).
- `AdaptiveAssessmentRuntime.tsx` — earlier prototype, imported into CareerBuilderPage but gated behind `?debug=1`. Uses the **current** V2 bank.
- `CompetencyDashboard.tsx` (screen `student-competency`/results) — current results view.
- `CompetencyAdminPage.tsx` (screen `admin-competency`) — **live** admin CRUD over `competency_*`.
- Standalone `pages/competency/GapAnalysisPage.tsx`, `IndustryBenchmarksPage.tsx` — routed; logic also duplicated inside CompetencyDashboard.

---

## 3. Classification

**A. LIVE & populated — keep, this is the source of truth**
`onto_*` namespace · `competency_question_templates` · V2 runtime routes · `CareerBuilderPage.AssessmentTab` · `CompetencyDashboard`.

**B. LIVE-wired but EMPTY in dev — NOT deletable (empty ≠ dead)**
`competency_*` tables + their admin routes + `CompetencyAdminPage` + FrameworkPanel competency config + legacy `ASSESSMENT_QUESTIONS` static bank (used by the scoring engine).
→ Empty because dev was never seeded; seed files exist. Deleting these breaks the admin panel and scoring engine.

**C. Candidate for removal — only with per-item proof (small)**
- `AdaptiveAssessmentRuntime.tsx` — superseded prototype, only reachable via `?debug=1`. Low-risk to unroute, but also low value; uses current data.
- Standalone `GapAnalysisPage`/`IndustryBenchmarksPage` IF their routes are unreachable from nav (needs nav-reachability proof before any change).

**D. Out of scope — do not touch**
CAF (`/api/caf/*`), `ai-competency-inference-engine.ts`, all `ont_*`/O*NET (prod-seeded), all LBI.

---

## 4. Adoption — what the "previous build" can contribute to the current framework

The valuable salvage is **content/logic**, not the empty tables themselves:

1. **Seed content** — `scripts/seed-competency-framework.sql` (289 lines, domains/competencies/clusters) and `seed-competency-library.sql` (328 lines) define a richer professional taxonomy. Worth reconciling against `onto_*` (299) to fill genuine gaps, then loading into the canonical store rather than the legacy `competency_*` tables.
2. **Legacy static question bank** `ASSESSMENT_QUESTIONS` — candidate items to migrate into `competency_question_templates` (the live V1 bank, currently only 44 rows) after de-duplication against existing entries.
3. **Scoring logic** — compare `competency-scoring.ts` vs the frontend `scoringEngine.ts` / CAF engine; converge on one canonical scorer; salvage any unique calibration from the legacy path.

Adoption should flow **into the canonical surfaces** (`onto_*` + `competency_question_templates` + `competency-scoring.ts`), never back into the empty legacy tables.

---

## 5. Recommendation (revises the original Stage 1/2 plan)

The original premise ("old build is dead, quarantine then delete") is **not supported by the evidence** — the old build is wired to live UI and empty only due to an unseeded dev DB. Therefore:

- **Do NOT** 410 the legacy routes or drop the `competency_*` tables — that breaks `CompetencyAdminPage` and the scoring engine.
- **Safe, useful next steps instead:**
  1. **Decide the target architecture**: is `competency_*` (admin-managed framework) meant to be retired in favour of `onto_*`, or do both layers stay (admin CRUD vs runtime genome)? This is a product decision.
  2. If retiring `competency_*`: first **re-point `CompetencyAdminPage` + FrameworkPanel competency config to the `onto_*` routes**, migrate `ASSESSMENT_QUESTIONS` → `competency_question_templates`, *then* (and only then) remove the legacy routes/tables.
  3. **Low-risk immediate cleanup** (safe today): unroute the `?debug` `AdaptiveAssessmentRuntime` prototype if confirmed superseded.
  4. **Adoption**: reconcile the two seed files + legacy question bank into the canonical stores (§4).

This keeps the platform working while genuinely converging the duplication.
