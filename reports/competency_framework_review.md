# Competency Framework — Complete Review & Recommendation

*Generated 2026-06-22 · Read-only review · No code or data modified.*
*Authoritative counts via live `COUNT(*)` (not `pg_stat` estimates, which were stale).*
*Scope: the professional Competency Assessment framework. Student LBI and CAPADEX/SDI are separate products and are referenced only where they touch competency.*

---

## 0. Bottom line (honest)

There **is** a real, working competency framework — and it is the `onto_*` genome plus the
`competency-runtime` pipeline. That spine is populated and exercised end-to-end. The problem
is **not** that the framework is broken; the problem is **massive surface-area sprawl** around
that spine: the same concept has been re-built across ~31 route files, ~97 endpoints, and
**348 tables of which only ~19 (~5%) hold any data.** Almost all the "extra" builds are empty
shells gated behind always-on flags.

**Recommendation in one line:** *Declare a single canonical authority (`onto_*` + `competency_question_templates` + `competency-runtime`), then triage everything else into KEEP / DORMANT (flag-off, reversible) / DEAD (drop only after caller + emptiness proof). Do NOT mass-delete; most of the sprawl is reversibly parkable, not safely deletable.*

---

## 1. What is actually working — the spine to protect

| Layer | Table | Rows | Meaning |
|---|---|---:|---|
| Genome | `onto_competencies` | 299 | Canonical competency list |
| Genome | `onto_competency_type_map` | 299 | Every competency typed (100% coverage) |
| Genome | `onto_domains` / `onto_competency_types` / `onto_proficiency_levels` | 5 / 5 / 5 | Taxonomy scaffolding |
| Genome | `onto_indicators` | 66 | Behavioural indicators |
| Roles | `onto_role_weights` / `onto_role_competency_profiles` | 35 / 14 | Role→competency weighting |
| Questions | `onto_competency_question_map` | 25 | Questions linked to competencies |
| Questions | `competency_question_templates` | 44 | V1 selectable question bank |
| **Runtime pipeline (exercised)** | blueprints 6 → question_blueprints 7 → assembled 3 → instances 15 → responses 66 → scores 12 → profiles 8 → score_runs 2 | | A real assessment was assembled, answered, scored, and persisted |
| History | `p4_competency_history` | 8,970 | Large append-only measurement history |

**This pipeline is the product.** It assembles an assessment from the genome, captures
responses, scores them (dual ledger: `onto_competency_scores`/`profiles` for runtime
snapshots, `onto_competency_score_runs` for normalized/benchmark scoring), and writes role
profiles. Everything else should serve this or be retired.

---

## 2. The real problem — sprawl around the spine

**Quantified (live):**
- **348** tables in competency/ontology namespaces; only **~19 populated** (~5%).
- **~12,100 LOC** across **31** competency/ontology route files; **97** distinct API endpoints.
- **Parallel implementations of the same idea:**
  - **3 runtimes:** `competency-runtime.ts`, `competency-runtime-v2.ts`, `competency-assessment-runtime.ts`
  - **2 intelligence engines:** `competency-intelligence.ts`, `competency-intelligence-engine.ts`
  - **Multiple "authority/council" layers:** `scientific-competency.ts`, `vx-competency-science-council.ts`, `talent-competency-dna.ts`, `unified-competency-profile.ts` (UCIP)
  - **CAF family (4 files):** `caf-runtime`, `caf-analytics`, `caf-assessment-builder`, `caf-question-framework`
  - **Ontology family (11+ files):** `ontology-competency-core`, `-taxonomy`, `-governance`, `-import-export`, `-overview`, `-supplementary`, `-career-tracks`, `-future-skills`, `-learning-paths`, `-ai-rules`, `-concerns-mapping`
- **A whole multi-phase flag suite, all defaulting ON** (`advancedCompetencyRuntimeV2`,
  `adaptiveAssessmentRuntimeV2`, `adaptiveOrchestrationV2`, `competencyGraphRuntime`,
  `adaptiveBlueprintRuntime`, `competencyPropagation`, `adaptiveRuntimeAuthority`,
  `competencyFusionEnabled`, `continuousCompetencyMemory`, UCIP, …) — yet their backing
  tables (`competency_graph_*`, `competency_propagation_logs`, `competency_fusion_logs`,
  `competency_memory_history`, `ucip_*`, `sci_*`, etc.) are **all empty**.

**Interpretation:** these are *speculative future phases that were scaffolded (routes + tables
+ flags) but never populated or wired to a live caller.* Flag-ON + empty-table + no-caller is
the signature. They are not "dead legacy" — they are "未-activated future." That distinction
drives the recommendation: **park them (flag-off), don't delete them.**

---

## 3. Three distinct duplication classes (each handled differently)

| Class | Examples | Status | Correct action |
|---|---|---|---|
| **A. Confirmed legacy dup** | `competency_*` tables + legacy admin CRUD + `ASSESSMENT_QUESTIONS` static bank + `AdaptiveAssessmentRuntime` (?debug) | Empty in dev, but **wired to live admin UI** | Converge (already in flight): re-point reads to `onto_*` ✅ done → fold question bank → then retire. **Do not blind-delete.** |
| **B. Unactivated future phases** | `competency_graph_*`, `*_propagation_logs`, `*_fusion_logs`, `ucip_*`, `sci_*`, UCIP/science-council routes | Flag-ON, **empty, no live caller** | **Flip flags OFF** (reversible parking). Decide per-phase: activate (seed + wire) or remove. |
| **C. Out of scope — leave alone** | CAF (`/api/caf/*`), `ont_*`/`map_*` O*NET (prod-seeded), all LBI, `p4_competency_history` | Separate product / prod-only / live history | Do not touch. |

---

## 4. Recommendation (prioritized)

### Tier 1 — Declare canonical authority (decision, ~0 risk)
Make it explicit in `replit.md` / `docs/` that the competency framework **is**:
`onto_*` genome + `competency_question_templates` + `competency-runtime(-v2)` scoring, with
the dual ledger (`onto_competency_profiles` runtime / `onto_competency_score_runs` normalized).
Everything else is **feeder, experimental, or candidate-for-retirement**. Without this single
sentence of authority, the sprawl will keep regrowing. **This is the highest-leverage step.**

### Tier 2 — Finish the in-flight convergence of Class A (low risk, approval-gated)
Already done: legacy admin reads now fall back to `onto_*` (Step 2, merged).
Remaining (pending your approval):
- **Step 3 (adoption):** de-dup `ASSESSMENT_QUESTIONS` against the 44 `competency_question_templates`, fold genuinely-new items in. Nothing of value lost.
- **Step 4 (retire):** unroute the `?debug` `AdaptiveAssessmentRuntime` prototype; remove the now-shadowed legacy CRUD code; **drop only confirmed-empty `competency_*` tables** via migration. Never drop a table with rows.

### Tier 3 — Triage Class B sprawl (medium effort, reversible-first)
1. **Flip the unactivated phase flags OFF** (`competencyGraphRuntime`, `competencyPropagation`,
   `competencyFusionEnabled`, `continuousCompetencyMemory`, UCIP, science-council, etc.).
   Flag-off must be byte-identical (platform convention), so this is safe and reversible.
2. For each parked phase, make a **keep-or-cut decision**: is it on the roadmap (then schedule
   seeding + wiring) or abandoned (then schedule deletion of its routes + empty tables)?
3. **Collapse the triplicate runtimes** to one (`competency-runtime-v2` appears newest; verify
   which the live pipeline calls) and the **two intelligence engines** to one. This is the
   biggest LOC reduction and the biggest clarity win.

### Tier 4 — Close the genuine gaps (only if on roadmap)
- `onto_blueprint_dimension_mix`, `onto_competency_hierarchy`, `onto_competency_master_ext`
  are part of the genome but **empty** — the framework is shallower than its schema implies.
  Either seed them or document them as intentionally deferred.
- O*NET (`ont_*`/`map_role_competency`) is prod-seeded only; confirm it's actually populated
  in production (it powers role-weight derivation), or the "Estimated" role badges stay grey.

---

## 5. Honesty caveats
- Counts are dev-DB (shared dev/prod DB, but prod-only seeds like O*NET won't show here).
- "No live caller" for Class B is inferred from empty tables + flag scaffolding; a per-route
  caller grep should confirm before any deletion (Tier 3 step 2).
- I have **not** changed any code or data for this review. Steps 3/4 and all Tier-3 deletions
  remain **STOP-for-approval** per your stated preference.

---

## 6. What I need from you (decision points)
1. **Approve Tier 1** — let me write the canonical-authority statement into `replit.md`/docs.
2. **Approve Step 3 + Step 4** of the Class-A convergence (fold question bank, then retire empty legacy tables).
3. **Tier 3 direction** — do you want me to (a) just flag-off the unactivated phases now (reversible), or (b) first produce a per-phase keep/cut inventory with caller proof, before anything is turned off or removed?
