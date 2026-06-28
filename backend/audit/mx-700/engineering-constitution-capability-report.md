# CAPADEX 2.0 — Engineering Constitution: Existing Capability Report & Classification

> **Mode:** ENHANCEMENT program (not new / not rebuild / not rewrite). Repository = primary source of truth.
> **This document = Constitution STEP 1 (search) → STEP 2 (Existing Capability Report) → STEP 3 (Classification).** It is the mandatory pre-work before ANY modification. **No code modified.**
> **Honesty contract:** *measured* = MEASURED; *judgement* = DERIVED; **built ≠ activated**; **flag-ON ≠ data-flowing**; **null ≠ 0**; conflicting/duplicate implementations are documented, never silently resolved.
> **Basis:** grounded in `phase-0-repository-baseline.md`, `phase-0.1-repository-intelligence-model.md`, the **live `Backend API` workflow flag-set (MEASURED: ~61 `FF_*` ON)**, table taxonomy, and `.agents/memory/*`.

Generated 2026-06-28 · Initiative MX-700 · Engineering Constitution pre-work.

---

## Constitution acknowledgement (operating contract)

I will operate under every rule in the Constitution. The load-bearing ones for this codebase:

- **Reuse-first, never duplicate.** No `*V2`/`New*` parallel engines. The repo *already* punishes parallel namespaces (e.g. competency work MUST extend `onto_*`, never a new prefix — memory `competency-ontology-architecture.md`).
- **DB: extend/version/index only — never DROP/DELETE/break relationships.** This matches the platform's append-only history + migration+lazy-ensure-schema convention.
- **APIs: extend response models, don't break contracts; version only when unavoidable.** Matches the additive-flag discipline (flag-OFF byte-identical).
- **One SuperAdmin, one Pragati, one Report engine, one Concern Master, one Behaviour Ontology — enhance, never fork.**
- **Every enhancement flag-gated; flag-OFF byte-identical (incl. schema).**
- **If a rule cannot be satisfied, STOP and explain before changing anything.**

Two existing realities the Constitution must reconcile with (documented, not resolved here):
1. **TWO feature-flag systems coexist by design** (file registry `config/feature-flags.ts` + DB `feature_flags`). "Reuse the flag system" = use the correct one per scope, not merge them.
2. **TWO `question_type` vocabularies + SPLIT stage taxonomy** (BE 5-stage vs FE `CAP_*` 4-code) already exist. Any stage/question enhancement must bridge, not re-decide.

---

## STEP 1 — Repository search (coverage confirmation)

Search basis is the completed Phase 0 + Phase 0.1 inventory (no re-derivation needed; numbers MEASURED there):

| Surface | Measured |
|---|---|
| Frontend | 89 pages · 541 components · 9 hooks · 11 Zustand stores · 5 contexts · 60 ui primitives |
| Backend | 303 route modules · 569 services · 319 scripts · ~3,241 endpoint registrations · 51 `/api` mounts |
| Database | ~1,304 declared table names · 218 migrations + lazy ensure-schema mirrors |
| Flags | 536 `FF_*` tokens declared · **~61 ON in live workflow (MEASURED)** |
| Integrations | OpenAI(205) · Mongo(136) · Razorpay(64) · Zoho(26) · Whisper(22) · HeyGen(8) · Twilio(3) · Firebase(2) |
| Background | in-process only (setImmediate 35 / setInterval 22 files; **no cron/queue**) |

No capability below is asserted "missing" without a search — absences are MEASURED absences (Parts 32/35/36/37 of Phase 0.1).

---

## Live flag reality (MEASURED — corrects a common misread)

The decision/career/employer flags **are ON** in the live `Backend API` workflow (FF_WC3_STAGE/OUTCOME/JOURNEY/PERSONALIZATION/LONGITUDINAL, FF_DECISION_ORCHESTRATOR, FF_DECISION_PERSISTENCE, FF_JOURNEY_GROWTH_PLAN_BRIDGE, FF_CAREER_*, FF_TALENT_MATCHING, FF_REPORT_FACTORY, FF_FUTURE_READINESS, …). **But flag-ON ≠ activated:** memory `cert-flagset-must-match-live-workflow.md` — *"flags don't seed data; dormant pipes stay 0."* So "DORMANT" below means **the consuming user-journey path is not the default served flow AND/OR the behavioural spine that feeds it is unpopulated**, even though the gate is open. This is the single most important honesty distinction in the whole report.

---

## STEP 2 + STEP 3 — Existing Capability Report & Classification

Status ∈ {EXISTS · PARTIAL · DORMANT · DUPLICATE · BROKEN · TECH-DEBT · OBSOLETE · MISSING}.
Class ∈ {PRESERVE · ACTIVATE · CONSOLIDATE · ENHANCE · EXTEND · REPLACE · RETIRE}. (REPLACE permitted only when enhancement is impossible — used **zero** times below.)

### A. Identity, security & platform spine
| Capability | Path (representative) | Status | Class | Note |
|---|---|---|---|---|
| Landing / SPA router | `App.tsx`, `LandingPage.tsx` | EXISTS | PRESERVE | 1,050-line Screen enum |
| Auth / session / register | `routes.ts`, session mw | EXISTS | PRESERVE | varchar `users.id` |
| Super-admin always-2FA | `SuperAdminLogin.tsx`, `/api/admin/mfa/verify` | EXISTS | PRESERVE | no password-only path |
| CSRF / rate-limit / CSP / audit-redaction | global mw | EXISTS | PRESERVE | kill-switches present |
| Per-framework admin gate | `lib/admin-path-gate.ts` | EXISTS | PRESERVE | lowercase classifier |
| `frontend/server` JWT app | `frontend/server/*` | OBSOLETE/DEPRECATED | RETIRE | dormant, empty node_modules, hardcoded secret |
| Archived mirror | `client-main-emergent-workzip/` | DUPLICATE | RETIRE | security-parity trap (memory) |

### B. CAPADEX core IP (the crown jewels — do not touch carelessly)
| Capability | Path | Status | Class | Note |
|---|---|---|---|---|
| Assessment flow (intro→report) | `FreeAssessmentModal.tsx`, `routes/capadex*` | EXISTS (live) | PRESERVE / ENHANCE | shared preview↔report canon |
| Concern Master (~2,489) | `routes/capadex-concerns-master.ts` | EXISTS | PRESERVE / ENHANCE (taxonomy) | display_label vs join keys |
| Clarity questions (~30,638) | `routes/capadex-clarity-questions.ts` | EXISTS | PRESERVE | ⚠ `concern_id` DISJOINT (TECH-DEBT, bridge-tag only) |
| Signal ontology (4-tier, ~15,972 atomic) | `routes/capadex-ontology-hub.ts`, `ontology-seed.ts` | EXISTS | PRESERVE | existence ≠ population |
| Behaviour engine (signal→composite→pattern→graph) | signal-capture, aggregators | PARTIAL | PRESERVE / ENHANCE (confidence, mapping) | spine sparsely populated |
| Pragati conversation (13-state FSM) | `routes/pragati.ts`, `PragatiWorkspace.tsx` | EXISTS | PRESERVE / ENHANCE (memory, reasoning) | safety mw + deterministic fallback |

### C. Competency framework
| Capability | Path | Status | Class | Note |
|---|---|---|---|---|
| Competency genome (`onto_*`) | `onto_*`, `competency-runtime.ts` | EXISTS (canonical) | PRESERVE / EXTEND | extend here, never fork |
| Competency runtime scoring (dual ledger) | `competency-runtime(-v2)` | EXISTS | PRESERVE | profiles + score_runs |
| Legacy `competency_*` tables | `competency_*` | OBSOLETE (empty shells) | CONSOLIDATE (keep read-fallback) | admin reads fall back to `onto_*` |
| Question Factory (DRAFT-only) | `routes/question-factory.ts`, `QuestionFactoryPanel.tsx` | EXISTS (flag ON) | PRESERVE / ENHANCE | human approval = only coverage-changing op |
| Competency EI / framework intelligence | `competency-intelligence-engine.ts` | PARTIAL/DORMANT | ACTIVATE | flags ON, data thin |

### D. Decision intelligence (highest-value gap)
| Capability | Path | Status | Class | Note |
|---|---|---|---|---|
| WC-3 chain (stage/outcome/journey/personalization/longitudinal) | `wc*` services | **DORMANT** (flags ON, path not default, spine unpopulated) | **ACTIVATE** | needs populated spine + `FF_WC3_OUTCOME_CROSSWALK` |
| Decision Orchestrator | orchestrator service | DORMANT | ACTIVATE | conductor + provenance |
| Journey→M5 growth-plan bridge | bridge service | PARTIAL | ACTIVATE | M5 growth-plan EXISTS — wire, don't rebuild |
| Decision→mentor / →subscription mapping | bridges | PARTIAL | ACTIVATE / ENHANCE | mentoring catch-all dilutes (honest) |

### E. Career, employer & institution products
| Capability | Path | Status | Class | Note |
|---|---|---|---|---|
| Career Builder | `CareerBuilderPage.tsx` (8,754) | EXISTS | PRESERVE / ENHANCE (additive split) | monolith = TECH-DEBT |
| Career OS (`useCareerBrain`) | `lib/intelligence/` | EXISTS | PRESERVE | never-throws aggregator |
| Career Graph Intelligence (`cg_*`) | `cgi` engines | PARTIAL/DORMANT | ACTIVATE / CONSOLIDATE | k=10 cohort |
| Employability Passport | `routes/employability-passport.ts` | EXISTS (flag) | PRESERVE | contact never published |
| Employer Portal | `EmployerPortalPage.tsx` (10,160) | EXISTS | PRESERVE / ENHANCE (split) | largest page |
| Talent Intelligence Graph (`tig_*`) | `employer-tig.ts` | EXISTS | PRESERVE | calibration write-once |
| Voice screening + avatar | `voice-screening.ts`, `/avatar/*` | EXISTS (flag, key-gated) | PRESERVE | honest-503 without keys |
| Institutional dashboards | Unified Institute/Parent | EXISTS | PRESERVE | role-distinct (not duplicate) |
| Future Readiness Platform | `routes/frp.ts` | PARTIAL (flag ON) | ACTIVATE | back-half models seed-ready |
| EIOS 28-pillar | `eios-*.ts` | EXISTS (flag) | PRESERVE | lazy schema |
| Scaffolded phases (`sci_/roie_/paie_/gro_`) | various | DORMANT (empty) | CONSOLIDATE (parkable) | flag-OFF parkable |

### F. Reports, AI & analytics
| Capability | Path | Status | Class | Note |
|---|---|---|---|---|
| Report Factory | `report-pack.ts`, pdf-renderer, benchmark-engine | EXISTS | PRESERVE / ENHANCE (AI narratives, viz) | k=30 suppression |
| AI layer (OpenAI/Whisper/HeyGen) | 205/22/8 files | PARTIAL (key-gated) | ENHANCE | degrades to null in dev |
| AI prompt registry / versioning / eval | — | **MISSING** | **EXTEND** (additive, flag-gated) | prompts inline today |
| Analytics (Mission Control, Platform Intelligence) | aggregators | EXISTS | PRESERVE | null≠0 discipline |
| Adaptive event bus | `services/adaptive-event-bus.ts` | EXISTS | PRESERVE / EXTEND | connect, don't rebuild |

### G. Commercial spine
| Capability | Path | Status | Class | Note |
|---|---|---|---|---|
| Subscription packages CRUD | `/api/admin/subscription-packages` | EXISTS | PRESERVE | |
| Package→entitlement link | entitlement svc | PARTIAL (gap: `users` has no email col) | ENHANCE | documented permanent gap |
| Razorpay payments | `routes` + 64 files | PARTIAL / e2e-UNVERIFIED | ACTIVATE / ENHANCE (verify) | verify needs local↔gateway linkage; webhook fail-closed |
| Invoice / GST engine | invoice svc (flag) | EXISTS | PRESERVE | refund abstains when no refund ledger |
| Entitlement enforcement | gates | EXISTS (flags ON) | PRESERVE | fail-closed |

### H. Cross-cutting / infra
| Capability | Status | Class | Note |
|---|---|---|---|
| Two flag systems (file + DB) | EXISTS | PRESERVE (document, don't merge) | different scopes |
| Background jobs (in-process) | EXISTS | ENHANCE (only if scale demands) | no cron/queue |
| Notifications: email (Zoho) | EXISTS | PRESERVE | XSS-escaped |
| Notifications: SMS/push/WhatsApp | MISSING | EXTEND (only if required) | Twilio = voice seam only |
| Search (SQL + token/IDF) | EXISTS (no engine) | EXTEND (only if required) | no semantic search |
| Audit trail + append-only history | EXISTS | PRESERVE | write-time redaction |
| Compliance: k-anon/consent/retention | EXISTS | PRESERVE | |
| Accessibility (formal WCAG) | MISSING (Radix baseline only) | ENHANCE | honest gap |
| Monoliths (routes.ts 14,464; 2 mega-pages) | TECH-DEBT | CONSOLIDATE / ENHANCE (additive) | route-order traps |
| Bundle >1 MB | TECH-DEBT | ENHANCE | code-split |
| Schema mirror drift | TECH-DEBT | ENHANCE | drift guard |

---

## Classification rollup

| Class | Count (approx) | Headline items |
|---|---|---|
| PRESERVE | ~25 | All core IP: ontology, assessment, Pragati, genome, TIG, reports, security |
| ACTIVATE | ~7 | **WC-3 / Decision Orchestrator / journey bridges**, CGI, FRP, Razorpay verify |
| ENHANCE | ~12 | AI narratives, confidence/mapping, monolith splits, bundle, entitlement, a11y |
| EXTEND | ~3 | AI prompt registry, event bus, (optional) SMS/search |
| CONSOLIDATE | ~4 | Legacy `competency_*`, scaffolded phases, monoliths |
| RETIRE | ~2 | `frontend/server` JWT app, archived mirror |
| REPLACE | **0** | enhancement always possible — Constitution satisfied |

**Top finding (unchanged across phases):** the highest-value move is **ACTIVATE the dormant Decision layer on a populated spine** — every gate is already open; what's missing is *flowing data + the default-path wiring*, not new code.

---

## Implementation workflow template (Constitution §"Before coding produce 1–10")

Every future enhancement task in this program will ship its plan in this exact shape **before** any edit:

1. Existing capability found · 2. Repository paths · 3. Components impacted · 4. Services impacted · 5. APIs impacted · 6. Database impacted · 7. Feature flags impacted · 8. SuperAdmin impacted · 9. AI impacted · 10. Risks → **then** implement → then report Files Modified/Created/Deleted · DB changes · API changes · Migration/Rollback · Tests · Docs.

---

## Rules that would force a STOP (pre-registered)

- A request to create any `*V2`/`New*` engine, a 2nd admin system, a parallel competency namespace, or a duplicate report system → STOP (violates reuse rules).
- A request to `DROP TABLE` / `DELETE DATA` / break a relationship → STOP (DB rules).
- A breaking API contract change without versioning → STOP (API rules).
- Any enhancement that cannot be flag-gated byte-identical-OFF → STOP (flag rules).

---

**STOP — Constitution pre-work (STEP 1–3) complete. No code modified.** Awaiting Founder direction:
**which capability do you want to enhance first?** Given the report, the highest-leverage, lowest-duplication candidate is **ACTIVATE the Decision Engine (WC-3 + Orchestrator) on a populated behavioural spine** — but per your stop-for-approval preference, I will not touch code until you pick the target and approve the 10-point plan for it.
