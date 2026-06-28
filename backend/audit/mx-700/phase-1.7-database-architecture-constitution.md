# CAPADEX 2.0 — Phase 1.7: Database Architecture Constitution

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Database Architecture Constitution. **Do not modify schema, do not create migrations, do not drop tables, do not delete data, do not break relationships, do not rebuild, do not activate dormant DB capabilities, do not change business logic.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED (live `DATABASE_URL` + repo on 2026-06-28); *judgement* = DERIVED. Never assume a table is unused; dormant ≠ deletable; null ≠ 0; measured metrics ≠ derived metrics. Counts reflect the **shared dev/prod Postgres** (one DB).
> **Basis:** live Postgres audit + Phase 1.2–1.6 constitutions + memory (`competency-ontology-architecture`, `kg-table-name-collision`, `merged-task-data-not-in-live-db`, `clarity-bridge-tag-classifier`, `runtime-activation-traps`, `append-only` history canons, `audit-log-redaction-unified-trail`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.7.

---

## PART 1 — Current Database Architecture Audit (MEASURED)

| Dimension | As-built | Note |
|---|---|---|
| **Platforms** | PostgreSQL (primary, Drizzle ORM) + MongoDB (avatar/voice sessions, FastAPI uploads) | shared dev/prod PG |
| **Live tables** (`public`) | **1,420** BASE TABLES | the real surface |
| **Views** | **6** | minimal; analytics mostly computed |
| **Materialized views** | effectively none surfaced | GAP |
| **Foreign keys** | **821** | ~0.58 FK/table avg → many tables relate by convention, not declared FK |
| **Indexes** | **3,202** | incl. PK/unique |
| **Migrations** | **218** `.sql` (1,121 `CREATE TABLE` statements, many `IF NOT EXISTS`) | canonical DDL path |
| **Ensure-schema functions** | **227** files with lazy `ensure*Schema()` | mirror migrations; no runner |
| **Drizzle typed schema** | `shared/schema.ts` **134** `pgTable` defs (3,569 lines) | only **~9%** of live tables are ORM-typed; rest are raw-SQL/lazy |
| **Sequences/functions/triggers** | sequences via SERIAL; minimal stored functions/triggers | logic lives in services, not DB |

**Strengths:** vast, deep schema; dual canonical-migration + lazy-ensure-schema discipline; append-only history tables; world-class ontology (4-tier, 15,972 atomic). **Technical debt (DERIVED):** (1) **schema sprawl** — 1,420 tables, many scaffolded-but-empty (competency `*_graph_*/propagation/fusion/ucip_*/sci_*`, PIL `pil_kg_*`); (2) **typing gap** — 91% of tables untyped by Drizzle; (3) **convention-only relationships** — bridge joins (`master_bridge_tag`, `concern_bridge_tag`) are NOT declared FKs and some are DISJOINT (`clarity.concern_id` 0% join to `concerns_master`); (4) **name-collision risk** (`pil_kg_*` vs live `kg_*` — materialize against bare `kg_*` would WIPE the Employability graph); (5) **few views/MVs** → analytics recomputed each call. **Orphan/empty tables:** present and EXPECTED (honest scaffolding) — flagged, never dropped. **Live-data trap:** task-agent backfills land in isolated envs; merge carries DDL not rows → "table exists" ≠ "table populated."

---

## PART 2 — Database Philosophy

Database exists to **Persist · Protect · Relate · Version · Audit · Explain · Support Intelligence · Support Enterprise · Support AI · Support Behaviour.** The database is the **permanent memory of CAPADEX**; every enhancement preserves data integrity.

## PART 3 — Data Domain Architecture

Domains: Assessment · Behaviour · Concern · Question · Competency · Ontology · Journey · Learning · Career · Life · Decision · AI · Reports · Subscriptions · Payments · Enterprise · Administration · Analytics · Audit · Configuration · Security. **Every table belongs to exactly one primary domain.** Table-prefix map (MEASURED): `onto_*/ont_*/map_*/ref_*` ontology+competency · `capadex_*` runtime/assessment · `lbi_*/sdi_*/competency_*` frameworks · `pil_kg_*` problem-intelligence graph · `kg_*` Employability graph · `frp_*` future-readiness · `cg_*` career-graph · `eios_*` enterprise OS · `tig_*` talent graph · `eco_*/forum_*` community · `feature_flags`/config.

## PART 4 — Master Data Constitution

Protect: Concern Master (~2,489) · Question Master (`competency_question_templates`, Clarity ~30,638) · Competency Master (`onto_competencies`, 419-genome) · Ontology (4-tier) · Persona/Industry/Role/Skill/Assessment/Subscription/Configuration masters. **Never duplicate master data; master data evolves additively.** Legacy `competency_*` tables are EMPTY shells (reads fall back to `onto_*`) — extend the canonical `onto_*` genome, never a parallel namespace.

## PART 5 — Transaction Data Constitution

Protect: Assessments · Responses · Signals · Behaviour/Competency results · Recommendations · Reports · Subscriptions · Payments · AI sessions · Journey/Learning/Career progress · Enterprise activity. **Transactions are immutable history — never overwrite historical truth.** Ledger = `capadex_payments` (paid-only); fire-and-forget writes must be idempotent (write-once snapshot guard).

## PART 6 — Longitudinal Data Constitution

Protect: Behaviour/Learning/Career/Life growth · Journey progress · Historical assessments/recommendations/reports/decisions/AI sessions. **Every longitudinal record preserves time; never replace historical measurements.** Append-only canon: `p4_competency_history`, `m3_*`, `ei_profile_snapshots`, `scoring_runs` never mutated in place. Honesty: 0 snapshots → 0% (NULL never coerced to a fake datapoint).

## PART 7 — Behaviour Data Constitution

Protect: Signals · Composite signals · Behaviour graph · Evidence · Confidence · **Strength factors · Concern factors** · Competency mapping · Behaviour recommendations. **Never bypass behaviour persistence; never fabricate behavioural evidence.** Binding canon: strengths come ONLY from CSI `positive_factors`/positive longitudinal growth — NEVER from raw concern-signal magnitude (signals are concern-DIAGNOSTIC). Runtime keys off `atomic_signal_id`, not bridge tag.

## PART 8 — Concern & Ontology Constitution

Protect: Concern Master · Concern hierarchy · Bridge tags · Relationships · Ontology · Competencies · Signals · Mappings · Dependencies. **Never regenerate ontology — extend it; never break bridge relationships.** ⚠️ Bridge canon: clarity↔master join is bucket-level (`master_bridge_tag = relational_bridge_tag`); `concern_id` is DISJOINT (0% join); CAPADEX↔competency bridge via `concern_bridge_tag` NOT `concern_id`. ⚠️ `pil_kg_*` namespace ONLY — never bare `kg_*`.

## PART 9 — Assessment Data Constitution

Protect: Assessment sessions · Adaptive questions · Answers · Scoring · Evidence · Confidence · Completion · Journey trigger · Versioning. **Assessment history is immutable.** Tables `capadex_sessions/responses/users/otps/reports/runtime_sessions`; `session_signals.session_id` is uuid.

## PART 10 — Decision Data Constitution (DOCUMENT DORMANT — NO ACTIVATION)

Protect: Decision inputs · Evidence · Confidence · Alternatives · Outcome projection · Decision history · Decision audit · Decision versioning. **Document dormant structures; do not activate.** Decision/WC-3 persistence exists behind `FF_DECISION_PERSISTENCE`/`FF_WC3_*` but is DORMANT (no default-path data). Stage taxonomy SPLIT (BE 5-stage vs FE `CAP_*` 4-code) — reconcile before any keyed UX. Activation is a separate approved phase.

## PART 11 — Journey Data Constitution

Protect: Journey · Milestones · Goals · Learning · Career · Life · Decision · Progress · Completion · Interventions. **Every journey remains historically traceable.** Growth-plan already EXISTS in M5 (wire, don't rebuild); journey→growth-plan bridge is the activation seam.

## PART 12 — AI Data Constitution

Protect: Conversation history · Memory · Prompt history · Evidence · Confidence · Recommendations · Feedback · Evaluation · Safety events. **Never fabricate AI history.** AI-inert (no `OPENAI_API_KEY`) → null + source tag, never 0. MongoDB holds avatar/voice session blobs (`voice_avatar_*`); blob-URL cleanup unmount-only.

## PART 13 — Report Data Constitution

Protect: Generated reports · Snapshots · Benchmarks · Comparisons · Visualizations · Recommendations · Evidence · Confidence · Interactive reports · History. Benchmarks suppressed below k_min=30. Exports fire-and-forget to `/tmp/rf_exports` (ephemeral — not persisted history).

## PART 14 — Enterprise Data Constitution

Protect: Organizations · Departments · Teams · Institutions · Universities · Managers · Employees · Students · Faculty · Parents · Permissions · **Tenant isolation**. Role-aware scope (admin_user_id OR institute_staff→staff_roles, faculty batch-confined); parent via consent (distinct axis); SCORE masked <30 but roster always shown.

## PART 15 — Audit Data Constitution

Protect: User activity · System activity · Security events · AI events · Assessment events · Configuration changes · Feature-flag changes · Approvals. **Audit data is append-only.** Binding: redact at WRITE time via shared `redactJson` (every insert routed through it); unified read surfaces METADATA ONLY (legacy unredacted rows can't leak). ⚠️ `admin_audit_logs.admin_user_id` FK (NO ACTION) blocks user purge → purge audit before users.

## PART 16 — Analytics Data Constitution

Protect: Aggregates · KPIs · Benchmarks · Usage · Engagement · Behaviour/Learning/Career/Enterprise trends. **Never mix measured and derived metrics** — Coverage (data exists) ⟂ Confidence (trustworthy/sufficient) kept as SEPARATE axes; report each explicitly. Few persisted aggregates today → most analytics recomputed read-time (MV opportunity, P22).

## PART 17 — Relationship Constitution

Every relationship documents Parent · Child · Cardinality · Ownership · Cascade rules · Delete rules · Update rules · Business meaning. **No orphan relationships.** Honest finding: 821 declared FKs over 1,420 tables → many relationships are **convention-only** (bridge tags, email/`user_email` joins, varchar `users.id`). Document them; do not retro-add FKs that would break lazy-ensure or backfill order without a migration + approval.

## PART 18 — Index Strategy (RECOMMEND ONLY)

Audit Indexes (3,202) · Unique constraints · Composite indexes · Search indexes · Performance · Fragmentation · Duplicate indexes · Missing indexes. **Recommend improvements only — no index DDL here.** Candidates (DERIVED): index high-traffic bridge-join columns (`master_bridge_tag`, `atomic_signal_id`), email/`user_email` lookup keys, and append-only history `(subject, created_at)`.

## PART 19 — Migration Constitution

Every migration: Reversible · Idempotent · Preserve data · Support rollback · Support feature flags · Support zero-downtime. **Never modify production data directly.** Binding (memory): `CREATE TABLE IF NOT EXISTS` is a NO-OP on an existing divergent table → query `information_schema` first; projecting rows needs INSERT mapped to REAL columns; reversible = mark inactive, never DELETE; flag-OFF must be byte-identical incl. schema (gate the DDL). Most newer tables carry BOTH a migration file AND a mirrored `ensure*Schema()`.

## PART 20 — Data Quality Constitution

Validate Integrity · Completeness · Consistency · Accuracy · Timeliness · Uniqueness · Referential integrity · Orphan detection · Duplicate detection. Honesty: orphans/gaps are FINDINGS, never fabricated fills; `pg COUNT()` returns STRINGS (`=== 0` silently upgrades stubs → `Number()` before compare); `Number()` over nullable score cols turns null→0 (fake datapoint) → map null/'' → NaN before `isFinite`.

## PART 21 — Database Security Constitution

Protect PII · Encryption · Secrets · Access · Roles · Permissions · Backups · Recovery · Audit · Tenant isolation. Binding: secrets via secrets manager (never interpolated to stdout); audit-artifact PII masked to `user_<sha256>`; identity from verified session/token only; demo data must be `@example.com`-purgeable (shared dev/prod DB).

## PART 22 — Performance Constitution

Audit Large tables · Query plans · Indexes · Joins · Caching · **Materialized views** · Connection pool · Locking · Concurrency. Binding: `concernsPool` IS the main `DATABASE_URL` pool; fail-closed quota needs `pg_advisory_xact_lock` in a txn; use `COUNT(*)` not stale stats; MV/aggregate persistence is the top read-time-cost reduction opportunity.

## PART 23 — Multi-Tenancy Constitution

Every tenant has Isolation · Security · Ownership · Permissions · Audit · Configuration · Analytics · Subscriptions. **No tenant data leakage** — tenant-scope EVERY detail read (drives/:id, eligibility, company DNA), not just lists; never IDOR-by-guessed-id.

## PART 24 — Database Observability Constitution

Document Schema health · Migration health · Replication · Backups · Integrity · Performance · Slow queries · Storage · Growth. **Honest gap:** no schema-drift dashboard or slow-query monitor today (Replit-managed backups/PITR via checkpoints). Add additively.

## PART 25 — Database Testing Constitution

Standardize Migration · Integrity · Relationship · Performance · Security · Backup · Recovery · Regression tests. Current: isolation/privacy test workflows exist; no migration/integrity test harness (GAP).

## PART 26 — Database Documentation

Maintain ER diagrams · Schema dictionary · Relationship dictionary · Migration catalog · Master-data catalog · Ontology catalog · Audit catalog · Configuration catalog. SSOT: `docs/phase-history.md` (Phase Index Tables = canonical for namespaces/migrations) + `.agents/memory/*` + replit.md.

## PART 27 — Database Quality Gates

Verify: Existing tables/schema reused · No duplicate tables · No duplicate master data · Relationships preserved · Indexes reviewed · Performance maintained · Integrity maintained · Documentation updated.

## PART 28 — Database Review Board

```
Founder[ ] DatabaseArchitect[ ] SolutionArchitect[ ] BackendArchitect[ ] AIArchitect[ ]
EnterpriseArchitect[ ] Security[ ] DevOps[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 29 — Database Definition of Done

- [ ] Existing schema enhanced · [ ] No tables duplicated · [ ] No master data duplicated · [ ] No history lost · [ ] No relationships broken · [ ] Migration reversible · [ ] Rollback verified · [ ] Performance maintained · [ ] Security verified · [ ] Documentation updated · [ ] Tests passing. (Stacks on Engineering 1.2 / Backend 1.6 DoDs.)

## PART 30 — Database Maturity Model

| Domain | Current (DERIVED) | Target |
|---|---|---|
| Assessment | L4 Observable | L5 Intelligent |
| Behaviour | L3 Integrated | L4 Observable |
| Ontology | L3 Integrated | L4 Observable |
| Concern | L3 Integrated | L4 Observable |
| Journey | L2 Reliable | L4 Observable |
| Career | L3 Integrated | L4 Observable |
| Learning | L2 Reliable | L3 Integrated |
| Decision | L2 Reliable (DORMANT) | L5 Intelligent (post-activation) |
| AI | L2 Reliable | L4 Observable |
| Reports | L3 Integrated | L4 Observable |
| Enterprise | L3 Integrated | L4 Observable |
| Analytics | L2 Reliable | L4 Observable (MVs) |
| Security | L4 Observable | L4 Observable (maintain) |
| Configuration | L4 Observable | L4 Observable (maintain) |

Levels: L1 Operational · L2 Reliable · L3 Integrated · L4 Observable · L5 Intelligent. **Roadmap:** add DB observability (schema-drift + slow-query) → introduce materialized views for analytics → grow Drizzle typing coverage beyond 9% → document convention-only relationships in a relationship dictionary → (separate approved phase) activate Decision persistence.

---

## PART 31 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Database Architecture Constitution | all | 16 | Analytics Data Constitution | P16 |
| 02 | Database Architecture Report | P1 | 17 | Relationship Constitution | P17 |
| 03 | Data Domain Architecture | P3 | 18 | Index Strategy | P18 |
| 04 | Master Data Constitution | P4 | 19 | Migration Constitution | P19 |
| 05 | Transaction Data Constitution | P5 | 20 | Data Quality Constitution | P20 |
| 06 | Longitudinal Data Constitution | P6 | 21 | Database Security Constitution | P21 |
| 07 | Behaviour Data Constitution | P7 | 22 | Multi-Tenancy Constitution | P23 |
| 08 | Concern & Ontology Constitution | P8 | 23 | Database Observability Constitution | P24 |
| 09 | Assessment Data Constitution | P9 | 24 | Database Testing Constitution | P25 |
| 10 | Decision Data Constitution | P10 | 25 | Database Documentation Standards | P26 |
| 11 | Journey Data Constitution | P11 | 26 | Database Quality Gates | P27 |
| 12 | AI Data Constitution | P12 | 27 | Database Review Board | P28 |
| 13 | Report Data Constitution | P13 | 28 | Database Definition of Done | P29 |
| 14 | Enterprise Data Constitution | P14 | 29 | Database Maturity Assessment | P30 |
| 15 | Audit Data Constitution | P15 | | | |

---

**STOP — Phase 1.7 complete; Database Architecture Constitution ready to FREEZE on approval. No schema modified, no migrations created, no data deleted, no relationships broken, no architecture rebuilt, no dormant DB capabilities activated, no business logic changed.**
Honesty caveats: counts are MEASURED from the live shared Postgres today (1,420 tables / 6 views / 821 FKs / 3,202 indexes / 218 migrations / 227 ensure-schema files / 134 Drizzle types). Many tables are scaffolded-but-empty BY DESIGN (honest, not deletable); relationships are largely convention-only (only 821 declared FKs); materialized views, schema-drift/slow-query observability, a migration/integrity test harness, and >9% Drizzle typing coverage **do not exist yet** — they are TARGETS, not current state. Decision persistence is dormant and explicitly NOT activated here.
