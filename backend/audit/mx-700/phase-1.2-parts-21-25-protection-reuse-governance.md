# CAPADEX 2.0 — Phase 1.2 (cont.): Parts 21–25 — Protection, Reuse & Governance Contracts

> **Execution mode:** ENHANCEMENT-ONLY · governance scaffolding. **No code modified, no restructuring, no dormant activation.** This `.md` is the only artefact.
> **Honesty contract:** *measured* = MEASURED; *judgement* = DERIVED. Criticality/risk ratings are DERIVED engineering judgement from Phase 0/0.1 evidence; paths and counts are MEASURED.
> **Basis:** Phase 0 / 0.1 / Constitution capability report / Phase 1.2 standards manual.

Generated 2026-06-28 · Initiative MX-700 · Phase 1.2 Parts 21–25.

---

## PART 21 — Repository Protection Matrix

Criticality: **C0** = catastrophic IP / data-loss risk · **C1** = high · **C2** = moderate · **C3** = low.
"Can Modify" = may an enhancement edit it at all (additively). "Founder Approval" = required before any change.

| Module | Repository path | Crit | Can Modify | Founder Approval | High-risk area | Safe enhancement pattern | Files NEVER to touch (destructively) | Files SAFE to extend (additively) |
|---|---|---|---|---|---|---|---|---|
| **DB schema** | `backend/shared/schema.ts`, `backend/migrations/*` | C0 | Yes (extend) | **Yes** | DROP/DELETE/relationship break; migration↔ensure-schema drift | new migration + lazy `ensure*Schema()` in lockstep | existing column types/relationships; the 218 historical migrations | new `YYYYMMDD_*.sql`; new nullable columns/tables |
| **Concern Master** | `routes/capadex-concerns-master.ts`, `concerns_master` | C0 | Yes | **Yes** | join-key (`relational_bridge_tag`) integrity | extend taxonomy/labels; new bridge rows | `relational_bridge_tag`/`concern_*` join keys | `display_label`, new metadata cols |
| **Clarity bank** | `routes/capadex-clarity-questions.ts`, `clarity_*` | C0 | Yes | **Yes** | `master_bridge_tag` join (concern_id is DISJOINT) | classifier on import + backfill | `master_bridge_tag` | new clarity rows (tagged) |
| **Signal ontology** | `routes/capadex-ontology-hub.ts`, `ontology-seed.ts` | C0 | Yes | **Yes** | shared `ensureSignalOntologySchema` (wipe risk) | seed via shared ensure path only | the 4-tier ID keys (`atomic_signal_id`) | new atomic/family rows |
| **Competency genome** | `onto_*`, `competency-runtime(-v2).ts` | C0 | Yes | **Yes** | dual ledger; legacy `competency_*` fallback | extend `onto_*`; NEVER new namespace | `onto_competency_profiles`/`score_runs` keys | new `onto_*` rows/cols |
| **Assessment flow** | `FreeAssessmentModal.tsx`, `routes/capadex*.ts` | C1 | Yes (additive) | **Yes** | preview↔report shared canon; resolver fallback | flag-gated new phase; keep resolver order | `CapadexBridgePhase`/`CapadexReportPhase` visual canon | new optional phase components |
| **Decision engine / WC-3** | `wc*` services, orchestrator | C1 | Yes (activation later) | **Yes** | dormant; spine population | ACTIVATE only in its own approved phase | WC-3 contract shapes | new compose-only readers |
| **Pragati** | `routes/pragati.ts`, `PragatiWorkspace.tsx` | C1 | Yes | **Yes** | 13-state FSM, safety middleware | improve reasoning/memory in place | FSM state machine + crisis-escalation mw | new block types behind flag |
| **SuperAdmin** | `SuperAdminDashboard.tsx`, `components/admin/*`, `superadmin/*` | C1 | Yes | No (panel-level) / **Yes** (auth) | single admin system; auth gate | new flag-gated panel + conditional nav | auth/MFA path, per-framework gate | new panels |
| **Report Factory** | `services/report-pack.ts`, pdf-renderer | C1 | Yes | No | k=30 suppression; pack builders | extend narratives/viz additively | `BUILDERS` byte-identical packs | new suite builders |
| **AuthN/Z & security mw** | session, CSRF, rate-limit, CSP, `lib/admin-path-gate.ts` | C0 | Yes | **Yes** | bypass/regression | extend behind kill-switch; keep fail-closed | CSRF/2FA/lockout logic | new allowlist entries |
| **Commercial spine** | entitlement, Razorpay, `invoice-*` | C1 | Yes | **Yes** | fail-closed reads; payment verify/IDOR | extend; keep ledger=paid-only | payment verify linkage, webhook fail-closed | new package/entitlement metadata |
| **Employer Portal** | `EmployerPortalPage.tsx` (10,160), `employer_*`, `tig_*` | C2 | Yes (additive) | No | monolith coupling; `values`→`values_list` trap | additive split; new tab | calibration write-once snapshot | new sub-components |
| **Career Builder** | `CareerBuilderPage.tsx` (8,754) core | C2 | Yes (additive) | No | protected core; TabId canon | new surface, never edit core | core/Gap/Trajectory/Competency dashboards | new tabs/children via props |
| **Flags / config** | `config/feature-flags.ts`, DB `feature_flags`, `docs/ENVIRONMENT.md` | C1 | Yes | No | two systems; prod-OFF default | add flag default-OFF in correct system | existing flag semantics | new `FF_*` (default OFF) |
| **Dead/duplicate** | `frontend/server/*`, `client-main-emergent-workzip/` | C3 | No (RETIRE only) | **Yes** | hardcoded JWT secret; security-parity drift | remove in a dedicated RETIRE phase | n/a (slated for retirement) | n/a |
| **Routes hub** | `backend/routes.ts` (14,464) | C1 | Yes (additive) | No | literal-before-`/:id` order; size | register new module, restart workflow | existing route order | append new route registration |

**Global never-touch rules:** no `DROP TABLE`/`DELETE DATA`/relationship break (C0); no `*V2`/`New*` parallels; no second admin/AI/report system; bare `kg_*` forbidden; protected Career Builder dashboards additive-only.

---

## PART 22 — Reuse Matrix (per subsystem → Preserve/Activate/Consolidate/Enhance/Extend)

| Subsystem | Existing Components | Existing APIs | Existing Services | Existing DB tables | Existing Reports | Existing AI | SuperAdmin | Feature Flags | Class |
|---|---|---|---|---|---|---|---|---|---|
| **CAPADEX assessment** | FreeAssessmentModal, Capadex*Phase | `/api/capadex/*` | capadex resolver, clarity picker | `capadex_sessions/responses/reports/*` | report phase | proxy-language engine | reports console | (live) | **Preserve / Enhance** |
| **Concern taxonomy** | CapadexConcernsMasterPanel | `/api/capadex-concerns-master` | resolver | `concerns_master` | — | — | concerns panel | — | **Preserve / Enhance** |
| **Behaviour ontology** | SignalOntologyHubPanel | `/api/capadex/ontology-hub` | ontology-seed, mapping-engine | `signal_*`, atomic (15,972) | — | insight-explainer | ontology hub | signal_intelligence (DB) | **Preserve / Enhance** |
| **Competency** | CompetencyDashboard, AssessmentTab | `/api/competency/*` | competency-runtime, intelligence-engine | `onto_*` (canonical), `competency_*` (shells) | competency reports | — | CompetencyQuestionsPanel | FF_COMPETENCY_* (ON) | **Preserve / Extend** (+ Consolidate shells) |
| **Question Factory** | QuestionFactoryPanel | `/api/admin/question-factory/*` | question-factory(+population) | `competency_question_templates` | founder report | AI gen (key-gated) | QF panel | questionFactory (ON) | **Preserve / Enhance** |
| **Decision / WC-3** | (no default UX surface) | `/api/intelligence/wcl`, orchestrator | wc* services, orchestrator | wc3/decision tables | dynamic report intel | — | — | FF_WC3_*, FF_DECISION_* (ON, dormant) | **Activate** |
| **Career Builder / OS** | CareerBuilderPage, useCareerBrain | `/api/career/*` | career engines (`lib/intelligence`) | `career_*` (13) | — | — | — | FF_CAREER_* (ON) | **Preserve / Enhance** |
| **Career Graph** | (admin) | `/api/cg/*` | 5 pure engines | `cg_*` (16) | — | — | — | FF_CAREER_GRAPH (ON) | **Activate / Consolidate** |
| **Pragati** | PragatiWorkspace | `/api/pragati/*` | FSM runtime | pragati tables | — | reasoning/fallback | flow-config admin | (live) | **Preserve / Enhance** |
| **Employer / hiring** | EmployerPortalPage, ScreeningTab | `/api/m5/*`, `/api/career/recruiter-postings` | TIG, voice-screening, talent-match | `employer_*` (7), `tig_*` | candidate drawer | Whisper+rubric, HeyGen avatar | employer dashboards | FF_*_HIRING/TALENT (ON) | **Preserve / Enhance** |
| **Institutional** | Unified Institute/Parent dashboards | `/api/institutional/*` | k-anon aggregation | institute/staff tables | role dashboards | — | — | institutionalIntelligence | **Preserve** |
| **Report Factory** | report panels | `/api/rf/*` | report-pack, pdf, benchmark, viz | rf tables | 8/16-pack suites | AI narratives | UnifiedReportsPanel | FF_REPORT_FACTORY (ON) | **Preserve / Enhance** |
| **Future Readiness** | FRP surfaces | `/api/frp/*`, `/api/admin/frp/*` | FRI engine | `frp_*` (10) | — | — | frp-admin | FF_FUTURE_READINESS (ON) | **Activate** |
| **EIOS** | EIOS surfaces | 31 routes | eios-core/intelligence | `eios_*` | cert | — | — | FF_EIOS_* (ON) | **Preserve** |
| **Commercial** | subscription panels | `/api/admin/subscription-packages`, razorpay | entitlement, invoice-gst | `capadex_payments`, invoice | invoice/GST | — | packages panel | FF_COMMERCIAL_* (ON) | **Enhance / Activate** (verify Razorpay) |
| **AI platform** | ChatWidget | (various) | aiClient, prompts inline | — | — | OpenAI/Whisper/HeyGen | — | — | **Enhance / Extend** (prompt registry MISSING) |
| **Analytics** | Mission Control, Platform Intelligence | `/api/admin/mission-control` | aggregators | (composes many) | — | — | consoles | enterpriseAnalytics | **Preserve** |
| **Dead/duplicate** | — | — | `frontend/server`, mirror | — | — | — | — | — | **Retire** |

---

## PART 23 — Engineering Review Board (per-phase sign-off template)

Every future phase requires explicit **APPROVE / REJECT** from each reviewer before merge. Reject by any reviewer blocks the phase.

| Reviewer | Approves when… | Veto trigger |
|---|---|---|
| **Product** | scope matches the approved phase; no scope creep | unrequested features / activation |
| **UX** | loading/empty/error states present; protected cores untouched | edits a protected dashboard; missing states |
| **Frontend** | reuses primitives; no duplicate components; bundle budget respected | `New*` component; >budget bundle |
| **Backend** | reuses services; route order correct; never-throws | duplicate business logic; throwing read engine |
| **Database** | extend-only; migration+ensure-schema lockstep | DROP/DELETE; drift; bare `kg_*` |
| **AI** | reuses Pragati/AI services; null≠fabricated; language policy | parallel AI impl; fabricated output |
| **Behaviour Science** | strengths-canon honored; Coverage⟂Confidence | strength from concern magnitude; composited axes |
| **Enterprise** | k-anonymity (k_min=30); consent; tenant scope | sub-k leak; cross-tenant read |
| **Security** | authz server-side; CSRF/XSS/injection guarded; fail-closed | IDOR; unescaped interpolation; fail-open |
| **QA** | tests updated; frontend build passes; smoke {401/403/503} | broken build; no test for new logic |
| **Performance** | latency/bundle budgets met; no N+1 | regression; unbounded query |

Sign-off block to embed in each phase deliverable:
```
Product[ ] UX[ ] Frontend[ ] Backend[ ] Database[ ] AI[ ]
BehaviourScience[ ] Enterprise[ ] Security[ ] QA[ ] Performance[ ]
Verdict: APPROVE / REJECT — <reason if reject>
```

---

## PART 24 — Definition of Done

A phase is **DONE** only when ALL are true (else it stays IN-PROGRESS):

- [ ] Existing implementation reused (Reuse Matrix entry cited).
- [ ] No duplicate functionality / services / components / APIs / tables.
- [ ] No regression (flag-OFF byte-identical incl. schema verified).
- [ ] Feature flags respected (default OFF; 503-before-auth when OFF).
- [ ] Migration documented (file + ensure-schema mirror, or "no DB change").
- [ ] Rollback documented (flag-OFF and/or reverse migration; reversible=inactive never DELETE).
- [ ] Tests updated (or explicit, justified skip).
- [ ] Documentation updated (`docs/*` SSOT + `.agents/memory/*` + condensed `replit.md`).
- [ ] SuperAdmin impact assessed (panel/auth).
- [ ] Analytics impact assessed (Mission Control / Platform Intelligence counts honest, null≠0).
- [ ] Enterprise impact assessed (k-anonymity, consent, tenant scope).
- [ ] Engineering Review Board sign-off recorded (Part 23).
- [ ] Founder GO recorded (user preference: stop-for-approval before merge/deploy).

---

## PART 25 — Phase Dependency Contract

Prevents out-of-order execution. Each future phase declares these five dependency axes.

**Template per phase:**
```
Phase: <id/name>
Previous required phases: <ids> (must be DONE)
Future dependent phases: <ids> (blocked until this is DONE)
Repository dependencies: <paths/modules that must exist/be stable>
Technical dependencies: <flags ON, populated spine, integration keys, migrations>
Business dependencies: <Founder GO, commercial/consent prerequisites>
```

**MX-700 dependency graph so far (MEASURED from this initiative):**

| Phase | Previous required | Future dependents | Repository deps | Technical deps | Business deps |
|---|---|---|---|---|---|
| **0 — Repository Baseline** | — | all | whole repo | none | Founder GO ✅ |
| **0.1 — Repository Intelligence Model** | 0 | all | whole repo | none | Founder GO ✅ |
| **Engineering Constitution (1.1)** | 0, 0.1 | all enhancement phases | capability report | none | Founder GO ✅ |
| **1.2 — Engineering Standards** | 1.1 | all enhancement phases | standards manual | none | Founder GO ✅ |
| **1.2 — Parts 21–25 (this doc)** | 1.2 manual | all enhancement phases | protection+reuse matrices | none | Founder GO (pending) |
| **(Next) Activation phases** | 1.1, 1.2 | — | Decision/WC-3, FRP, CGI, commercial modules | flags ON **+ populated spine** + integration keys | per-phase Founder GO |

**Hard ordering rules:**
1. No enhancement phase starts before the Engineering Constitution (1.1) and Standards (1.2) are accepted — they are the universal prerequisites.
2. **Activation** phases (Decision/WC-3, FRP, CGI, Razorpay-verify) depend on a **populated behavioural/commercial spine**, not just flags ON — flag-ON without data is a false prerequisite (memory: flags don't seed data).
3. **Cleanup/RETIRE** phases (dead code, `seed`/`seeds`, naming drift) depend on Founder approval and must not block feature phases.
4. A phase whose technical deps are unmet (e.g. empty spine, missing keys) must **abstain and report honestly**, never fabricate readiness.

---

**STOP — Phase 1.2 Parts 21–25 complete. No business logic modified, no workflows redesigned, no dormant capability activated, no repository restructured.** Governance contracts established only.
Honesty caveats: criticality/risk ratings are DERIVED engineering judgement (paths/counts MEASURED); the dependency graph reflects MX-700 phases issued so far and will extend as future specs arrive.
