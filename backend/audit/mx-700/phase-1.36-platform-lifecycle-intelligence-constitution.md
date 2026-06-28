# CAPADEX 2.0 — Phase 1.36: Platform Lifecycle Intelligence Constitution (Feature Lifecycle + Capability Lifecycle + Module Lifecycle + API Lifecycle + Model Lifecycle + Version Lifecycle + Deprecation + Sunset + Technical Debt + Evolution Governance)

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Platform Lifecycle Intelligence Constitution. **Do not rebuild, do not create a second lifecycle platform, do not replace platform lifecycle, do not create Lifecycle V2, do not modify business logic, do not activate dormant capabilities, never bypass Product / Engineering / Infrastructure / Delivery / Operations / any intelligence engine.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED via exact inspection of live repo + git history + runtime + DB + documentation on 2026-06-28; *judgement* = DERIVED. **Idea ≠ Requirement ≠ Feature ≠ Capability ≠ Module ≠ Product · Version ≠ Release ≠ Adoption · Deprecated ≠ Removed · Archived ≠ Deleted · Retired ≠ Forgotten · Legacy ≠ Broken · Evolution ≠ Rewrite · Migration ≠ Replacement · Coverage ≠ Confidence · Evidence ≠ Confidence.** built ≠ activated; flag-ON ≠ runtime-active; Null ≠ Zero; table-existence ≠ population; seeded ≠ live. Human remains accountable. Never fabricate; never estimate.
> **Basis:** migration/phase-history audit + flag-registry audit + tech-debt-marker scan + memory (`question-factory` (retire=archive-never-delete), `competency-ontology-architecture` + `competency-vs-lbi-separation` (EMPTY shells / dormant phases), `eios-worldclass-flag-discipline` (byte-identical OFF incl. schema), `n-live-tup-stale-population-audit`, `archived-mirror-security-parity` (mirror removed), `build-and-deploy-tooling` (no semver tags)).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.36. **Lifecycle Intelligence governs how every capability is conceived, designed, implemented, validated, released, operated, measured, enhanced, deprecated, retired, archived, and evolved. Nothing inside CAPADEX exists forever — everything has a lifecycle. Lifecycle never owns business logic.**

---

## PART 1 — Current Platform Lifecycle Audit (MEASURED; n_live_tup NOT used)

### Version, migration & phase history (the de-facto lifecycle ledger)
| Component | **Measured** | Class |
|---|---|---|
| Migration history | **218 files** (`20260502_framework_tables` → `20261215_employability_studio`) — chronological version/lifecycle ledger | **LIVE** |
| **Semantic versions / release tags** | **ZERO git tags** (consistent with 1.34) | **MISSING** |
| **Phase / enhancement history** | **`docs/phase-history.md` (1,302 lines)** — canonical phase index (namespaces, migrations, deep-links) | **LIVE** |
| Knowledge preservation | **`.agents/memory/*`** durable per-subsystem engineering lessons | **LIVE** |
| Documentation coverage | per-subsystem `docs/*.md` SSOTs + `replit.md` feature map | LIVE |

### Feature / capability / flag lifecycle
| Component | **Measured** | Class |
|---|---|---|
| Feature flags | **144 flags** in `backend/config/feature-flags.ts`; **all default OFF; flag-OFF byte-identical (incl. schema)** | **LIVE** |
| Flag lifecycle markers | heavy lifecycle annotation in registry (`feature-flags.ts`) | LIVE |
| Additive phase pattern | every V2 phase ships behind a flag; flag-OFF = byte-identical legacy | LIVE |
| **Capability catalog (formal)** | **NONE — capability inventory is implicit in `replit.md` feature map + phase-history** | PARTIAL/MISSING |
| **Lifecycle / deprecation / retirement dashboard** | **NONE** | MISSING |

### Deprecated / legacy / dormant / retirement candidates
| Component | **Measured** | Class |
|---|---|---|
| Legacy/deprecated code markers | present across `routes.ts` (45), `feature-flags.ts` (123), storage/data/tests | LIVE (tracked) |
| **EMPTY-shell capabilities** | legacy `competency_*` tables are empty shells (admin reads fall back to `onto_*`) | **EMPTY** |
| **Dormant flag-gated phases** | `competency_graph_*/propagation/fusion/ucip_*/sci_*` scaffolded-but-unactivated (parkable flag-OFF) | **DORMANT** |
| Archived mirror | `client-main-emergent-workzip/` **correctly ABSENT** (removed in security remediation, `archived-mirror-security-parity`) | ARCHIVED→removed |
| Retire pattern | retirement = **archive, never delete** (e.g. Question Factory retire; `question-factory`) | LIVE (convention) |

### Technical debt
| Component | **Measured** | Class |
|---|---|---|
| Tech-debt markers | `TODO/FIXME/HACK` present (`routes.ts` (5), `report-pack.ts` (2), `exam-ready.v1.routes.ts` (1) …) — **visible, not hidden** | TECH DEBT (tracked) |
| **Formal debt register** | **NONE — debt lives as inline markers + memory notes, not a prioritized register** | MISSING |
| Known structural debt | prod runs uncompiled tsx (no backend typecheck); 13.2k-line `routes.ts` / 7.8k-line `CareerBuilderPage.tsx` monoliths; two `question_type` vocabularies; dual feature-flag systems | TECH DEBT |

### Capability ownership · duplicate capabilities · legacy pathways · retirement candidates · evolution readiness (explicit, per spec PART 1)
- **Capability ownership:** ownership is **implicit** (code + `replit.md` feature map + phase-history), not a formal owned catalog — DERIVED gap, honestly reported.
- **Duplicate capabilities:** the platform's discipline explicitly forbids parallel namespaces (e.g. "new competency work extends the canonical `onto_*` surfaces — do NOT add parallel namespaces"). No active duplicate platforms found; the only full duplicate (archived client mirror) was removed.
- **Legacy pathways:** legacy `competency_*` tables are EMPTY shells with fallback to `onto_*` (Legacy ≠ Broken — they work via fallback); flag-OFF legacy paths are byte-identical by contract.
- **Retirement candidates (honest):** dormant scaffolded-but-unactivated flag-gated phases (`competency_graph_*`, `ucip_*`, `sci_*`) and EMPTY shells are **retirement OR activation candidates** — but **built ≠ activated, flag-ON ≠ data-flowing, table-existence ≠ population**, so none are asserted live or dead without a population check (`n-live-tup-stale-population-audit`: use exact COUNT, never `n_live_tup`).
- **Evolution readiness:** strong — additive flag-gated discipline + migration ledger + phase-history + memory make incremental evolution safe; weak on formal deprecation/retirement policy + debt register + capability catalog.

**CRITICAL HONEST FINDING (MEASURED + DERIVED):** **CAPADEX has a rich lifecycle SUBSTRATE but no lifecycle SYSTEM.** The raw materials of world-class lifecycle governance are LIVE and disciplined: a 218-file migration ledger, a 1,302-line canonical phase-history, a 144-flag additive registry (all-default-OFF, byte-identical-OFF including schema), an "archive-never-delete" retire convention, and a durable `.agents/memory` knowledge base. **But the formal lifecycle layer is absent: no capability catalog, no lifecycle/deprecation/retirement dashboard, no deprecation policy or timeline, no sunset register, no prioritized technical-debt register, and no semantic version tags.** **No fabrication:** EMPTY `competency_*` shells are reported EMPTY (not "present"); dormant phases are reported DORMANT (not "live"); the removed archived mirror is reported removed (not present); tech debt is surfaced from real markers + known structural facts, not invented; **Deprecated ≠ Removed, Archived ≠ Deleted, Legacy ≠ Broken, built ≠ activated, flag-ON ≠ data-flowing, table-existence ≠ population, Null ≠ Zero** all preserved. The lifecycle gap is *formalization and visibility*, not discipline — the platform already practises additive, reversible, knowledge-preserving evolution; it lacks the catalog/dashboard/policy surface to govern it explicitly.

**Strengths (DERIVED):** migration ledger + phase-history + memory = strong version/enhancement/knowledge lineage; mature additive flag lifecycle (byte-identical OFF); archive-never-delete retirement convention; anti-duplication discipline; tech debt visible. **Technical debt / GAPS (DERIVED):** no capability catalog; no lifecycle/deprecation/retirement dashboard or policy; no debt register; no semver tags; large monoliths; dual flag systems. **Dormant/Missing:** formal deprecation timelines, sunset register, capability-ownership map, lifecycle analytics. **Class legend (per spec):** LIVE · PARTIAL · SEEDED · DORMANT · DEPRECATED · ARCHIVED · BROKEN · TECH DEBT · MISSING.

---

## PART 2 — Lifecycle Philosophy

Lifecycle Intelligence exists to Create · Grow · Stabilize · Enhance · Measure · Govern · Retire · Evolve. **It never destroys platform knowledge, duplicates architecture, or bypasses governance.**

## PART 3 — Lifecycle Domain Architecture

Features · Capabilities · Modules · Services · APIs · Models · Reports · Documentation · Versions · Technical Debt · Governance.

## PART 4 — Feature Lifecycle Constitution

Protect Idea · Proposal · Approval · Implementation · Validation · Release · Enhancement · Deprecation · Retirement. Binding: every additive feature is flag-gated; flag-OFF byte-identical; Founder approval at release.

## PART 5 — Capability Lifecycle Constitution

Protect Capability creation · Ownership · Enhancement · Reuse · Retirement. **Binding: REUSE BEFORE BUILD** (extend canonical `onto_*`/existing surfaces; never add parallel namespaces).

## PART 6 — Module Lifecycle Constitution

Protect Module ownership · Dependencies · Compatibility · Activation · Retirement. Binding: dormant modules are parkable flag-OFF (byte-identical); retire = archive, never delete.

## PART 7 — API Lifecycle Constitution

Protect API evolution · Backward compatibility · Deprecation · Migration · Retirement. **Binding: never break supported APIs;** auth-before-flag ordering (401 unauth, 503 flag-OFF) preserved; literal-before-param route order.

## PART 8 — Model Lifecycle Constitution

Protect Behaviour · Competency · Decision · AI · Analytics · Ontology models. Binding: canonical genome `onto_*`; models versioned via migrations; append-only history tables never mutated in place.

## PART 9 — Version Lifecycle Constitution

Protect Version strategy · Compatibility · Migration · Rollback · Release history. Binding: **migrations are the version ledger; semver tags MISSING (gap);** rollback via checkpoints + Cloud Run revisions.

## PART 10 — Technical Debt Constitution

Protect Debt identification · Classification · Prioritization · Resolution · Documentation. **Binding: technical debt is MEASURED, never hidden.** Current: markers + memory notes exist; **a prioritized debt register is a gap.**

## PART 11 — Deprecation Constitution

Protect Deprecation policy · Timeline · Migration path · Compatibility · Communication. **Binding: Deprecated ≠ Removed.** Current: **no formal deprecation policy/timeline (gap).**

## PART 12 — Retirement Constitution

Protect Retirement approval · Archive · Knowledge preservation · Dependency validation. Binding: **archive-never-delete;** Founder approval; dependency check before retire; Retired ≠ Forgotten.

## PART 13 — Lifecycle Evidence Constitution

Evidence from Repository · Runtime · Usage · Analytics · Documentation · Version history; contains Source · Coverage · Confidence · Quality.

## PART 14 — Lifecycle Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Usage · Adoption · Lifecycle health. Binding: built ≠ activated; flag-ON ≠ adopted; population verified by exact COUNT, never `n_live_tup`.

## PART 15 — Lifecycle Explainability Constitution

Every lifecycle decision explains Why · Evidence · Impact · Migration · Alternatives.

## PART 16 — Compatibility Constitution

Protect Backward compatibility · Forward compatibility · Migration safety · Dependency stability. Binding: additive phases + lazy ensure-schema mirroring migrations; flag-OFF byte-identical.

## PART 17 — Knowledge Preservation Constitution

Protect Architecture knowledge · Engineering decisions · Historical decisions · Documentation · Lessons learned. Binding: **`.agents/memory/*` + `docs/phase-history.md` are the canonical knowledge stores — never destroy platform knowledge.**

## PART 18 — Technical Evolution Constitution

Protect Incremental evolution · Enhancement · Refactoring · Platform sustainability. **Binding: Evolution ≠ Rewrite; Migration ≠ Replacement** — enhance, never rebuild.

## PART 19 — Lifecycle Security Constitution

Protect Retired secrets · Archived credentials · Historical access · Compliance. Binding: secrets in Secret Manager; archived mirror removed to prevent latent bypass (`archived-mirror-security-parity`); auth secrets fail-fast in prod.

## PART 20 — SuperAdmin Lifecycle Constitution

Support Capability catalog · Lifecycle dashboard · Deprecation status · Retirement status. Binding: surfaces read-only; would COMPOSE phase-history + flag registry + migration ledger, never re-derive.

## PART 21 — Lifecycle Testing Constitution

Standardize Compatibility · Migration · Regression · Retirement tests. Binding: flag-OFF byte-identical smoke + isolation/degradation suites.

## PART 22 — Lifecycle Documentation

Maintain Lifecycle catalog · Capability catalog · Retirement guide · Migration guide · Version guide. SSOT: `docs/phase-history.md` + `replit.md` + migration files.

## PART 23 — Lifecycle Governance

Every enhancement answers: Why is Lifecycle changing? · What capability is reused? · Does this duplicate architecture? · Does this preserve compatibility?

## PART 24 — Lifecycle Quality Gates

Verify Compatibility preserved · Knowledge preserved · Documentation updated · Migration validated · No regressions.

## PART 25 — Lifecycle Review Board

```
Founder[ ] ChiefPlatformArchitect[ ] ChiefProductArchitect[ ] EngineeringArchitect[ ] EnterpriseArchitect[ ] SecurityArchitect[ ] Research[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 26 — Lifecycle Definition of Done

- [ ] Compatibility preserved · [ ] Knowledge preserved · [ ] Migration documented · [ ] Documentation updated · [ ] No regressions.

## PART 27 — Lifecycle Maturity Model

| Component | Current (DERIVED) | Target |
|---|---|---|
| Feature Lifecycle | L3 Managed (flag-gated additive + approval) | L4 Intelligent |
| Capability Lifecycle | L2 Guided (reuse discipline; no formal catalog) | L4 Intelligent |
| Module Lifecycle | L3 Managed (parkable flag-OFF; archive-never-delete) | L4 Intelligent |
| API Lifecycle | L3 Managed (compat preserved; no deprecation policy) | L4 Intelligent |
| Version Lifecycle | L2 Guided (migration ledger; no semver tags) | L4 Intelligent |
| Technical Debt | **L1 Operational (visible markers; no register)** | L4 Intelligent |
| Deprecation | **L1 Operational (no policy/timeline)** | L4 Intelligent |
| Retirement | L2 Guided (archive-never-delete convention) | L4 Intelligent |

Levels: 1 Operational · 2 Guided · 3 Managed · 4 Intelligent · 5 Self-Evolving Platform — **human approval ALWAYS mandatory.** **Roadmap (separate approved phases):** publish a read-only capability catalog (compose phase-history + flag registry + migrations) → add a prioritized technical-debt register → define a formal deprecation policy + timeline + sunset register → add semver/release tags (ties to 1.34) → add a lifecycle dashboard (deprecation/retirement status, adoption vs built) → reconcile dual flag systems + decompose monoliths → keep ONE lifecycle framework, reuse-before-build, compatibility + knowledge preserved, human approval mandatory.

## PART 28 — Lifecycle Scientific Validation

Document Software Evolution · Software Maintenance · Technical Debt · Configuration Management · Software Architecture · Lifecycle Engineering · Knowledge Management.

## PART 29 — Lifecycle Evolution Strategy

Future evolution supports New features · modules · APIs · models · versions · platform capabilities — **without breaking** Infrastructure · DevOps & Delivery · Platform Operations · Data · Assessment · Behaviour · Concern · Competency · Decision · Learning · Career · Intervention · Report · Analytics · AI · Enterprise · Security · Integration Intelligence. (Additive; reuse-before-build; compatibility + knowledge preserved; human approval mandatory.)

---

## PART 30 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Platform Lifecycle Intelligence Constitution | all | 14 | Lifecycle Explainability Constitution | P15 |
| 02 | Repository Lifecycle Audit | P1 | 15 | Compatibility Constitution | P16 |
| 03 | Feature Lifecycle Constitution | P4 | 16 | Knowledge Preservation Constitution | P17 |
| 04 | Capability Lifecycle Constitution | P5 | 17 | Technical Evolution Constitution | P18 |
| 05 | Module Lifecycle Constitution | P6 | 18 | Lifecycle Security Constitution | P19 |
| 06 | API Lifecycle Constitution | P7 | 19 | SuperAdmin Lifecycle Constitution | P20 |
| 07 | Model Lifecycle Constitution | P8 | 20 | Lifecycle Governance Constitution | P23 |
| 08 | Version Lifecycle Constitution | P9 | 21 | Lifecycle Quality Gates | P24 |
| 09 | Technical Debt Constitution | P10 | 22 | Lifecycle Review Board | P25 |
| 10 | Deprecation Constitution | P11 | 23 | Lifecycle Definition of Done | P26 |
| 11 | Retirement Constitution | P12 | 24 | Lifecycle Scientific Validation | P28 |
| 12 | Lifecycle Evidence Constitution | P13 | 25 | Lifecycle Evolution Strategy | P29 |
| 13 | Lifecycle Confidence Constitution | P14 | 26 | Lifecycle Maturity Assessment | P27 |

---

**STOP — Phase 1.36 complete; Platform Lifecycle Intelligence Constitution ready to FREEZE on approval. Platform lifecycle not modified, lifecycle governance not replaced, no second lifecycle platform created, no dormant capabilities activated, business logic not changed, Product / Engineering / Infrastructure / Delivery / Operations / no intelligence engine bypassed.**
Honesty caveats: all findings MEASURED via exact inspection of live repo/git/migrations/docs/flags today; population claims would use exact COUNT, never `n_live_tup`; secret values never printed. **CAPADEX has a rich lifecycle SUBSTRATE (218-file migration ledger, 1,302-line phase-history, 144-flag additive registry byte-identical-OFF, archive-never-delete retire convention, `.agents/memory` knowledge base) but no formal lifecycle SYSTEM: no capability catalog, lifecycle/deprecation/retirement dashboard, deprecation policy/timeline, sunset register, prioritized debt register, or semver tags.** EMPTY `competency_*` shells reported EMPTY; dormant `*_graph_*/ucip_*/sci_*` phases reported DORMANT; removed archived mirror reported removed. Deprecated ≠ Removed; Archived ≠ Deleted; Legacy ≠ Broken; Evolution ≠ Rewrite; built ≠ activated; flag-ON ≠ data-flowing; table-existence ≠ population; Null ≠ Zero; human remains accountable.
