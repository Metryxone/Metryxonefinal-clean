# CAPADEX 2.0 — Phase 1.31: Data Intelligence Constitution (Master Data + Data Governance + Data Quality + Data Lineage + Data Lifecycle + Data Observability)

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Data Intelligence Constitution. **Do not rebuild, do not create a second data platform, do not replace the data architecture, do not create Data V2, do not duplicate master data / schemas / entity ownership, do not modify business logic, do not activate dormant data capabilities, never bypass Data Governance / Data Integrity / Master Data / any intelligence engine.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED via **exact `SELECT COUNT(*)`** (live `DATABASE_URL` + repo on 2026-06-28, via `query_to_xml` per-table counts — **NEVER `n_live_tup`**, per spec); *judgement* = DERIVED. **Data ≠ Information ≠ Knowledge ≠ Intelligence · Schema ≠ Data · Table ≠ Entity ≠ Record ≠ Truth · Null ≠ Zero · Missing ≠ Empty · Duplicate ≠ Same · Snapshot ≠ History ≠ Version · Archive ≠ Backup ≠ Recovery · Migration ≠ Synchronization · Validation ≠ Cleansing · Lineage ≠ Ownership ≠ Stewardship · Coverage ≠ Confidence · Evidence ≠ Confidence.** built ≠ activated; flag-ON ≠ runtime-active. Human remains accountable. Never fabricate; never estimate.
> **Basis:** database-wide exact census + integrity-primitive audit + Phases 1.1–1.30 (per-domain population already established) + memory (`n-live-tup-stale-population-audit`, `competency-ontology-architecture`, `kg-table-name-collision`, `clarity-bridge-tag-classifier`, `merged-task-data-not-in-live-db`, `pg-count-string-coercion`, `audit-artifact-pii-masking`, `audit-log-redaction-unified-trail`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.31. **Data Intelligence is the foundation upon which every other intelligence layer operates** — it ensures information remains accurate, trusted, governed, traceable, recoverable, auditable, reusable.

---

## PART 1 — Current Data Intelligence Audit (MEASURED, exact COUNT\*; n_live_tup NOT used)

### Database-wide census (exact, all base tables)
| Metric | **Measured value** | Class / note |
|---|---:|---|
| **Total base tables** | **1,420** | structural |
| **EMPTY tables (count=0)** | **903 (63.6%)** | **schema-ahead-of-data** |
| **Populated tables (count>0)** | **517 (36.4%)** | LIVE/SEEDED mix |
| Tables ≥ 1,000 rows | **21** | the true data mass |
| **Total rows (all tables)** | **273,682** | exact sum |

### Integrity primitives (exact)
| Primitive | **Count** | Class |
|---|---:|---|
| Primary keys | **1,419** (of 1,420 tables) | **LIVE — 1 gap** |
| Foreign keys | **821** | **LIVE** |
| Unique constraints | **516** | **LIVE** |
| Check constraints | **470** | **LIVE** |
| Indexes | **3,202** | **LIVE** |
| Views | **6** | PARTIAL |
| **Materialized views** | **0** | **MISSING** |
| Migration files (`backend/migrations/`) | **218** | **LIVE** |
| Drizzle schema (`shared/schema.ts`) | **3,569 lines** | **LIVE** |

### Domain population (from Phases 1.1–1.30, exact-counted earlier — the 21 high-mass + key masters)
| Domain | Representative master/transactional | State |
|---|---|---|
| **Ontology / Competency master** | `onto_competencies`=419 genome · `map_role_competency`=52,362 · `competency_question_templates` (drafts) | **LIVE (data mass)** |
| **CAPADEX concern master** | `concerns_master`≈2,489 · clarity questions≈30,638 · signal ontology (15,972 atomic) | **LIVE (data mass)** |
| **Identity / RBAC / security** | `users` · `role_permissions`=144 · `express_sessions`=192 · `rbac_failed_logins`=53 | **LIVE** |
| **Assessment / runtime** | `capadex_sessions` + responses · runtime sessions | **LIVE (small)** |
| **AI runtime** (1.28) | `aig_*` seeded config / runtime tables=0 | **SEEDED + DORMANT** |
| **Enterprise institution** (1.29) | `institutes/institutions/staff`=0 | **DORMANT** |
| **Detective security** (1.30) | `security_incidents/configurations/risk_events`=0 | **DORMANT** |

### Runtime activation · duplicates · broken relationships / FKs / migrations / integrity (explicit, per spec PART 1)
- **Runtime activation:** **the platform is profoundly schema-ahead-of-data — 63.6% of all tables are exactly EMPTY.** The data mass is concentrated: only 21 tables hold ≥1,000 rows (ontology crosswalks, concern/clarity masters, signal ontology) and these carry the bulk of the 273,682 total rows. The vast empty majority is the cumulative dormant/scaffolded substrate catalogued across Phases 1.1–1.30 (AI runtime, institution engine, detective security, many flag-gated competency/career graph phases).
- **Broken integrity:** **one table lacks a primary key — `learn_effectiveness`** (1,419 PKs / 1,420 tables). This is the single measured structural-integrity gap. FK referential integrity is otherwise broad (821 FKs); no broken-FK or failed-migration evidence surfaced.
- **Duplicate entities / master data:** documented collision risks rather than active duplication — PIL knowledge graph MUST namespace `pil_kg_*` (bare `kg_*` is the live Employability graph; materialize would WIPE it — `kg-table-name-collision`); legacy `competency_*` tables are EMPTY shells aliased to the `onto_*` genome (intentional, not duplication — `competency-ontology-architecture`). No harmful duplicate master entities found.
- **Migration vs synchronization:** 218 migration files + lazy `ensure*Schema()` mirrors; **Migration ≠ Synchronization** — merged task-agent backfills carry CODE + DDL only, NOT rows, so live-DB population must be verified directly (`merged-task-data-not-in-live-db`). Most newer tables have a migration file AND a lazy ensure-schema (no runner).
- **Observability gap:** 0 materialized views and only 6 plain views — there is no materialized data-observability/freshness layer; data quality is enforced at write time (constraints) not monitored at rest.

**CRITICAL HONEST FINDING (MEASURED + DERIVED):** **CAPADEX's data foundation is structurally strong but populationally thin — a 1,420-table schema with first-class integrity (1,419 PKs, 821 FKs, 516 unique, 470 check, 3,202 indexes, 218 migrations) of which 63.6% (903) is exactly EMPTY, with 273,682 rows concentrated in ~21 tables.** This is the cumulative, exact-counted confirmation of every prior phase's finding: **Schema ≠ Data, Table ≠ Record, Built ≠ Activated.** The genuine data assets are the curated reference/master masses (competency genome + role crosswalk ~52k, concern/clarity masters ~33k, signal ontology ~16k); the runtime/transactional and downstream-intelligence tables are overwhelmingly empty-pending-activation. **No fabrication:** empty is reported EMPTY (count=0), never inferred from schema presence; populated reference masses are not conflated with live transactional throughput; the single PK gap is reported as a real defect, not smoothed over; **Null ≠ Zero and Missing ≠ Empty** are preserved (a table absent ≠ a table present-but-0). **Backup ≠ Recovery** and **Archive ≠ Backup**: backups are GCP/platform-managed and **not app-attested or restore-validated here** — reported as MISSING evidence, not assumed.

**Strengths (DERIVED):** first-class referential integrity + indexing; large curated master/reference data (the real moat); typed Drizzle schema as code SSOT; idempotent migrations + lazy ensure-schema; redact-at-write audit governance. **Technical debt / GAPS (DERIVED):** 903 empty tables (schema sprawl / activation backlog); `learn_effectiveness` missing PK; 0 materialized views / minimal view layer (no at-rest observability); no app-attested backup/restore validation; lineage/stewardship metadata not formalized as data. **Dormant:** the empty 63.6% (downstream intelligence, AI runtime, institution, detective security). **Class legend (per spec):** LIVE · PARTIAL · SEEDED · DORMANT · BROKEN · EMPTY · TECH DEBT · MISSING.

---

## PART 2 — Data Philosophy

Data Intelligence exists to Store · Protect · Validate · Govern · Relate · Version · Recover · Reuse. **It never creates intelligence, changes business meaning, duplicates ownership, or breaks integrity.**

## PART 3 — Data Domain Architecture

Master Data · Reference Data · Transactional Data · Ontology · Metadata · Lineage · Governance · Lifecycle · Observability · Integrity · Contracts · Recovery.

## PART 4 — Master Data Constitution

Master Data remains **the canonical source.** Protect Concern Master · Competency Master · Ontology · Persona Master · Role Master · Permission Master · Organization Master. **Never duplicate master entities.** Binding: `onto_*` genome + `concerns_master` + signal ontology are canonical; `pil_kg_*` namespace mandatory (never bare `kg_*`); legacy `competency_*` shells alias `onto_*`.

## PART 5 — Reference Data Constitution

Protect Lookup tables · Enums · Categories · Domains · Status codes · Mappings · Localization. Binding: reference masses (`map_role_competency`=52,362, clarity bridge tags) are curated, not authored at runtime; `clarity-bridge-tag-classifier` derivation on import.

## PART 6 — Data Lineage Constitution

Every data element records Origin · Transformation · Ownership · Consumers · Dependencies · Version. **Never lose lineage.** Binding: lineage/stewardship not yet formalized as queryable metadata — DERIVED gap; provenance fields exist per-domain (e.g. `clarity_source`, question-factory provenance/confidence).

## PART 7 — Data Quality Constitution

Protect Completeness · Consistency · Validity · Accuracy · Uniqueness · Timeliness · Integrity. Binding: enforced at write-time via 516 unique + 470 check constraints; no at-rest quality monitor (0 matviews).

## PART 8 — Data Integrity Constitution

Protect Primary keys · Foreign keys · Constraints · Transactions · Relationships · Referential integrity. Binding: **1,419 PK / 821 FK / 516 U / 470 C live;** ⚠️ `learn_effectiveness` missing PK (sole gap).

## PART 9 — Data Contract Constitution

Protect API contracts · Schema contracts · Integration contracts · Version compatibility · Backward compatibility. Binding: Drizzle schema (3,569 lines) is the typed contract; additive flag-gated phases preserve backward compatibility (byte-identical flag-OFF).

## PART 10 — Data Lifecycle Constitution

Protect Creation · Validation · Storage · Usage · Versioning · Archival · Retention · Deletion. Binding: append-only history tables (`p4_competency_history`, `m3_*`) never mutated in place; demo `@example.com` purge path (FK-ordered).

## PART 11 — Data Versioning Constitution

Protect Schema versions · Entity versions · Migration history (218 files) · Audit versions · Historical snapshots. Binding: append-only snapshots; ensure-schema mirrors migrations.

## PART 12 — Data Evidence Constitution

Evidence from Assessment · Behaviour · Concern · Competency · Decision · Learning · Career · Reports · Analytics · AI · Enterprise · Security; contains Source · Coverage · Confidence · Quality.

## PART 13 — Data Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Integrity · Trust. Binding: Coverage (data exists) ⟂ Confidence (trustworthy); empty ≠ low-confidence-populated.

## PART 14 — Data Explainability Constitution

Every dataset documents Purpose · Owner · Source · Lineage · Consumers · Limitations. SSOT: `docs/phase-history.md` Phase Index Tables.

## PART 15 — Data Observability Constitution

Monitor Freshness · Completeness · Latency · Failures · Replication · Integrity · Schema drift. Binding: **0 materialized views, 6 views — no materialized observability layer (DERIVED gap);** schema drift caught via ensure-schema + Drizzle.

## PART 16 — Data Governance Constitution

Protect Ownership · Stewardship · Classification · Retention · Compliance · Approval. Binding: redact-at-write unified audit trail; human approval is the only coverage-changing op (question factory).

## PART 17 — Data Security Constitution

Protect PII · Sensitive data · Encryption · Masking · Access control · Consent. Binding: audit-artifact PII masking (`user_<sha256>`); contact NEVER published (Employability Passport); redact-at-write (1.30 cross-ref).

## PART 18 — Backup & Recovery Constitution

Protect Backups · Snapshots · Recovery · Disaster recovery · Restore validation. Binding: **Backup ≠ Recovery** — GCP/platform-managed backups; **app-attested restore validation MISSING (honest gap).**

## PART 19 — Data Migration Constitution

Protect Migration scripts (218) · Rollback · Forward compatibility · Idempotency · Schema evolution. Binding: **Migration ≠ Synchronization** — merged DDL carries no rows (`merged-task-data-not-in-live-db`); migrations idempotent + lazy ensure-schema.

## PART 20 — Data Archival Constitution

Protect Cold storage · Historical data · Retention · Legal hold · Recovery. Binding: append-only history; no separate cold-storage tier evidenced.

## PART 21 — SuperAdmin Data Constitution

Support Schema management · Reference data · Master data · Policies · Monitoring. Binding: admin panels over ontology/concern/clarity masters (read + curated edit; human-approval gated).

## PART 22 — Data Testing Constitution

Standardize Schema · Migration · Integrity · Contract · Regression tests. Binding: isolation suite + per-phase smoke; pg COUNT returns STRINGS (`Number()` before compare — `pg-count-string-coercion`).

## PART 23 — Data Documentation

Maintain Data dictionary · Entity catalog · Schema catalog · Lineage catalog · Migration guide · Data API guide. SSOT: `docs/phase-history.md` + `shared/schema.ts` + `.agents/memory/*`.

## PART 24 — Data Governance Review

Every enhancement answers: Why is Data changing? · What existing capability is reused? · Does this duplicate master data? · Does this preserve integrity? · Does this preserve lineage?

## PART 25 — Data Quality Gates

Verify Master data reused · Integrity preserved · Lineage preserved · Contracts preserved · Evidence exposed · Confidence exposed · Documentation updated.

## PART 26 — Data Review Board

```
Founder[ ] ChiefDataArchitect[ ] DatabaseArchitect[ ] EnterpriseArchitect[ ] DataGovernanceLead[ ] SecurityArchitect[ ]
Research[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 27 — Data Definition of Done

- [ ] Master data preserved · [ ] Integrity preserved · [ ] Lineage preserved · [ ] Contracts preserved · [ ] Documentation updated · [ ] No regressions.

## PART 28 — Data Maturity Model

| Component | Current (DERIVED, exact-count) | Target |
|---|---|---|
| Master Data | **L4 Intelligent** (curated genome + concern/signal masses) | L5 Self-Governing |
| Reference Data | **L4 Intelligent** (52k crosswalk, classifiers) | L5 Self-Governing |
| Lineage | L2 Guided (per-domain provenance, not unified metadata) | L4 Intelligent |
| Quality | L3 Managed (write-time constraints; no at-rest monitor) | L4 Intelligent |
| Governance | L3 Managed (redact-at-write, human-approval) | L4 Intelligent |
| Observability | L1 Operational (0 matviews, 6 views) | L4 Intelligent |
| Contracts | **L4 Intelligent** (typed Drizzle + backward-compat) | L5 Self-Governing |
| Recovery | L2 Guided (platform backups, no attested restore) | L4 Intelligent |

Levels: 1 Operational · 2 Guided · 3 Managed · 4 Intelligent · 5 Self-Governing Data Platform — **human approval ALWAYS mandatory.** **Roadmap (separate approved phases):** add PK to `learn_effectiveness` (close the integrity gap) → triage the 903 empty tables (activate-or-retire, distinguishing dormant-by-design from dead) → introduce a materialized data-observability/freshness layer → formalize lineage/stewardship as queryable metadata → add app-attested backup/restore validation → keep ONE data platform, never duplicate master data, integrity + lineage preserved, human approval mandatory.

## PART 29 — Data Scientific Validation

Document Database engineering · Data governance · Information architecture · Metadata management · Master data management · Data quality · Data modeling · Distributed databases · Privacy engineering.

## PART 30 — Data Evolution Strategy

Future evolution supports New domains · schemas · ontologies · master data · integrations · data products — **without breaking** Assessment · Behaviour · Concern · Competency · Decision · Learning · Career · Intervention · Report · Analytics · AI · Enterprise · Security Intelligence. (Additive + flag-gated; byte-identical flag-OFF; master data + integrity + lineage never bypassed.)

---

## PART 31 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Data Intelligence Constitution | all | 15 | Data Governance Constitution | P16 |
| 02 | Repository Data Audit | P1 | 16 | Data Security Constitution | P17 |
| 03 | Master Data Constitution | P4 | 17 | Backup & Recovery Constitution | P18 |
| 04 | Reference Data Constitution | P5 | 18 | Data Migration Constitution | P19 |
| 05 | Data Lineage Constitution | P6 | 19 | Data Archival Constitution | P20 |
| 06 | Data Quality Constitution | P7 | 20 | SuperAdmin Data Constitution | P21 |
| 07 | Data Integrity Constitution | P8 | 21 | Data Governance Review | P24 |
| 08 | Data Contract Constitution | P9 | 22 | Data Quality Gates | P25 |
| 09 | Data Lifecycle Constitution | P10 | 23 | Data Review Board | P26 |
| 10 | Data Versioning Constitution | P11 | 24 | Data Definition of Done | P27 |
| 11 | Data Evidence Constitution | P12 | 25 | Data Scientific Validation | P29 |
| 12 | Data Confidence Constitution | P13 | 26 | Data Evolution Strategy | P30 |
| 13 | Data Explainability Constitution | P14 | 27 | Data Maturity Assessment | P28 |
| 14 | Data Observability Constitution | P15 | | | |

---

**STOP — Phase 1.31 complete; Data Intelligence Constitution ready to FREEZE on approval. Data architecture not modified, master data not replaced, no second data platform created, no dormant data capabilities activated, business logic not changed, Data Governance / Data Integrity / Master Data / no intelligence engine bypassed.**
Honesty caveats: all counts MEASURED via exact `SELECT COUNT(*)` (per-table `query_to_xml`) from the live shared Postgres today — `n_live_tup` NOT used (per spec). **63.6% of the 1,420-table schema is exactly EMPTY; 273,682 rows concentrate in ~21 tables; one table (`learn_effectiveness`) lacks a PK; 0 materialized views.** Schema ≠ Data; Table ≠ Record; Built ≠ Activated; Null ≠ Zero; Missing ≠ Empty; Migration ≠ Synchronization; Backup ≠ Recovery (restore validation not attested here); curated reference mass ≠ live transactional throughput; human remains accountable.
