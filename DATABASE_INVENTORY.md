# MetryxOne — Database Inventory
**Generated:** 2026-05-09  
**Tables in live DB:** 340  
**Migration files:** 28 (runner tracks via `_migrations` table)  
**Schema definition files:** 3  
**Live DB introspected:** 2026-05-09 (all findings confirmed against actual column lists)

---

## Schema Files

| File | Tables Defined | Purpose |
|------|---------------|---------|
| `backend/shared/schema.ts` | ~85 | Drizzle ORM for the main Express backend (`db` via Drizzle+pg) |
| `frontend/server/src/db/schema.ts` | ~80 | Drizzle ORM for the Vite/frontend server sub-app |
| `backend/migrations/*.sql` | ~255 tables across 28 files | SQL migration runner (applied via migration runner, tracked in `_migrations`) |

> **Core tables pre-date the migration runner.** Tables like `users`, `children`, `subscription_packages`, and `lbi_sessions` were created by an early Drizzle push from `backend/shared/schema.ts` before the SQL migration system existed. Their baseline DDL is now recorded in `backend/migrations/20260509_core_tables_baseline.sql`.

---

## Schema Drift (CRITICAL)

**Key finding from 2026-05-09 live introspection:** The `frontend/server/src/db/schema.ts` file contains many definitions that do NOT match the actual live database tables. These are aspirational schema designs that haven't been applied via migration yet. Code using these Drizzle definitions may fail at runtime.

| Table | Live DB (actual) | backend/shared/schema.ts | frontend/server/src/db/schema.ts | Drift |
|-------|-----------------|--------------------------|----------------------------------|-------|
| `users` | 7 cols: id varchar, username, password, full_name, role, roles[], created_at | ✅ **MATCHES** | ❌ 15 cols — missing: mobile, email, passwordHash, isActive, isVerified, profilePicture, metadata, platformId, updatedAt | **CRITICAL** — frontend auth routes may fail |
| `children` | 34 cols with snake_case names: school_name, primary_language, education_board, lbi_consent | ✅ subset matches | ❌ Different column names — uses school, language, board, consentGiven | **HIGH** — column name mismatch |
| `subscription_packages` | 14 cols: id, category, student_segment, product_name + 10 more | ✅ **MATCHES** | ❌ 30 cols — 16 extra columns not in live DB | **MEDIUM** — extra cols referenced by frontend admin UI |
| `student_subscriptions` | 11 cols: includes assessment_completed_at, report_generated_at, payment_transaction_id | ✅ **MATCHES** | ❌ Different cols — has institutionId, notes, targetAgeBand (not in live) | **MEDIUM** |
| `lbi_modules` | varchar id, 6 cols, no subModules/domainCodes | ✅ **MATCHES** | ❌ serial integer id + subModules jsonb + domainCodes text[] | **HIGH** — id type mismatch |
| `lbi_sessions` | 6 cols: assessment_id + student_id (institute model) | ✅ **MATCHES** (institute model) | ❌ consumer model: child_id + module_id (NOT in live DB) | **HIGH** — routes using frontend schema will fail |

**Phase 1 priority:** Apply migrations to add missing columns to `users`, align `children` column names, and extend `subscription_packages` before enabling frontend-server auth/LBI/subscription routes in production.

---

## Duplication Map (tables defined in more than one schema file)

| Table | backend/shared (live-match) | frontend/server (aspirational) | Phase 1 Action |
|-------|-----------------------------|-------------------------------|----------------|
| `users` | ✅ matches live (7 cols) | ❌ schema drift (15 cols, diff names) | Migrate live → add missing cols, then consolidate |
| `children` | ✅ subset matches live | ❌ column name drift | Fix column names in frontend schema OR migrate live |
| `subscription_packages` | ✅ matches live (14 cols) | ❌ 30-col aspirational (not applied) | Apply migration to add 16 columns |
| `student_subscriptions` | ✅ matches live (11 cols) | ❌ different column set (not applied) | Reconcile and apply migration |
| `lbi_modules` | ✅ matches live (varchar id, 6 cols) | ❌ serial id + extra cols (not applied) | Migrate live, update type refs in routes |
| `lbi_sessions` | ✅ matches live (institute model) | ❌ consumer model not applied | See lbi_sessions reconciliation below |

---

## lbi_sessions vs lbi_assessment_sessions Reconciliation

| | `lbi_sessions` (live) | `lbi_sessions` (frontend target) | `lbi_assessment_sessions` |
|---|---|---|---|
| **Matches** | backend/shared/schema.ts | frontend/server/src/db/schema.ts | Raw SQL only (no Drizzle) |
| **Columns** | assessment_id, student_id (institute) | child_id, module_id (consumer) | child_id, student_id, age_band_id + 13 more |
| **Written by** | No current active writes (0 rows) | NOT YET APPLIED | backend/routes.ts ~line 10650 |
| **Live rows** | 0 | N/A | 0 |
| **Status** | Live table, old institute schema, 0 rows | Target consumer schema, not yet migrated | Active institute table (raw SQL only) |

**Decision needed (Phase 1):**
- Option A: Repurpose `lbi_sessions` for the consumer model (migrate columns, drop assessment_id/student_id, add child_id/module_id). Institute continues using `lbi_assessment_sessions`.
- Option B: Rename `lbi_sessions` to `lbi_institute_sessions` and create a new `lbi_sessions` table with the consumer model.
- **Recommended:** Option A — live table has 0 rows so migration is safe.

---

## Deprecated / Legacy Tables

| Table | Rows | Reason | Status |
|-------|------|--------|--------|
| `lbi_questions_legacy` | 0 | Old psychopsis question system, superseded by `lbi_questions` | Safe to DROP — @deprecated comment added to backend/shared/schema.ts |
| `mfa_codes` | 0 | MFA disabled May 2026 — routes removed | Safe to DROP after production confirmation |
| `psychopsis_categories` | 0 | Legacy brand name table, aliased as `lbiCategories` in backend schema | Kept for backward compat; no new writes |
| `lbi_assessments` | 0 | Old institute LBI assessment model | Review before Phase 1 drop |

---

## Table Inventory by Domain

### 1 — Core Platform / Auth

| Table | Rows | Live Schema Matches | Schema File | Notes |
|-------|------|-------|-------------|-------|
| `users` | 48 | backend/shared | backend/shared ✅ + frontend/server ❌ | See Schema Drift section |
| `express_sessions` | 62 | N/A | connect-pg-simple only | Session store |
| `mfa_codes` | 0 | backend/shared | backend/shared only | @deprecated — MFA disabled |
| `user_sessions` | 0 | Unknown | No Drizzle schema | Created by migration; check usage |
| `user_devices` | 0 | frontend/server (aspirational) | frontend/server only | Device fingerprint |
| `email_consents` | 0 | frontend/server (aspirational) | frontend/server only | DPDP consent |
| `platform_settings` | 0 | — | frontend/server only | Key-value config |

### 2 — Children & Family

| Table | Rows | Live Schema Matches | Schema File | Notes |
|-------|------|-----|-------------|-------|
| `children` | 0 | backend/shared (subset) | backend/shared ✅ + frontend/server ❌ | Column name drift in frontend schema |
| `parents` | 0 | backend/shared | backend/shared only | |
| `parent_student_links` | 0 | backend/shared | backend/shared only | |
| `consent_logs` | 0 | backend/shared | backend/shared only | |
| `parent_subscriptions` | 0 | frontend/server (aspirational) | frontend/server only | |
| `parent_tests` | 0 | frontend/server (aspirational) | frontend/server only | |
| `parent_test_assignments` | 0 | frontend/server (aspirational) | frontend/server only | |

### 3 — Institutes & Education

| Table | Rows | Schema File | Notes |
|-------|------|-------------|-------|
| `institutes` | 0 | backend/shared only | |
| `batches` | 0 | backend/shared only | |
| `students` | 0 | backend/shared only | Institute students (≠ children) |
| `institute_staff` | 0 | backend/shared only | |
| `staff_roles` | 0 | backend/shared only | |
| `student_enrollments` | 0 | frontend/server only | |
| `enrollment_requests` | 0 | backend/shared only | |
| `exams` | 0 | backend/shared only | |
| `exam_questions` | 0 | backend/shared only | |
| `exam_attempts` | 0 | backend/shared only | |
| `exam_responses` | 0 | backend/shared only | |

### 4 — LBI Framework

| Table | Rows | Live Schema Matches | Schema File | Notes |
|-------|------|-----|-------------|-------|
| `lbi_modules` | 0 | backend/shared | backend/shared ✅ + frontend/server ❌ | id type + columns differ |
| `lbi_sub_modules` | 0 | backend/shared | backend/shared only | |
| `lbi_age_groups` | 0 | backend/shared | backend/shared only | |
| `lbi_question_bank` | 0 | backend/shared | backend/shared only | |
| `lbi_questions` | ~500 | frontend/server (aspirational) | frontend/server only | HAS DATA — consumer question bank |
| `lbi_age_bands` | 0 | frontend/server (aspirational) | frontend/server only | |
| `lbi_domains` | 0 | backend/shared | backend/shared + 20260502_framework_tables.sql | |
| `lbi_subdomains` | 0 | migration only | 20260502_framework_tables.sql | No Drizzle schema |
| `lbi_subdomain_norms` | 0 | migration only | 20260502_framework_tables.sql | |
| `lbi_age_band_weights` | 0 | migration only | 20260502_framework_tables.sql | |
| `lbi_clusters` | 0 | migration only | 20260502_framework_tables.sql | |
| `lbi_cluster_map` | 0 | migration only | 20260502_framework_tables.sql | |
| `lbi_learning_mappings` | 0 | migration only | 20260502_framework_tables.sql | |
| `lbi_versions` | 0 | migration only | 20260502_framework_tables.sql | |
| `lbi_sessions` | 0 | backend/shared (institute cols) | backend/shared ✅ + frontend/server ❌ | See reconciliation above |
| `lbi_assessment_sessions` | 0 | raw SQL only | backend/routes.ts ~line 10650 | Institute flow; no Drizzle |
| `lbi_questions_legacy` | 0 | backend/shared | backend/shared only | **@deprecated** 0 rows |
| `lbi_scores` | 0 | migration only | 20260507_bios_intelligence.sql + lbi-engine.ts | LBI dimension scores |
| `lbi_assessments` | 0 | backend/shared | backend/shared only | Legacy institute assessment model |
| `lbi_types` | 0 | backend/shared | backend/shared only | Old institute lookup |
| `psychopsis_categories` | 0 | backend/shared | backend/shared only | Legacy brand table |

### 5 — SDI Framework (Social Dynamics Intelligence)

| Table | Rows | Schema File |
|-------|------|-------------|
| `sdi_items` | ~1,400 | 20260502_framework_tables.sql | **HAS DATA** |
| `sdi_item_options` | ~1,000 | 20260502_framework_tables.sql | **HAS DATA** |
| `sdi_domains` | 0 | 20260502_framework_tables.sql + backend/routes/sdi.ts |
| `sdi_subdomains` | 0 | 20260502_framework_tables.sql |
| `sdi_stages` | 0 | 20260502_framework_tables.sql |
| `sdi_clusters` | 0 | 20260502_framework_tables.sql |
| `sdi_cluster_map` | 0 | 20260502_framework_tables.sql |
| `sdi_subdomain_norms` | 0 | 20260502_framework_tables.sql |
| `sdi_stage_weights` | 0 | 20260502_framework_tables.sql |
| `sdi_learning_mappings` | 0 | 20260502_framework_tables.sql |
| `sdi_versions` | 0 | 20260502_framework_tables.sql |
| `sdi_user_responses` | 0 | 20260502_framework_tables.sql |
| `item_irt_params` | 0 | 20260502_framework_tables.sql |

### 6 — Competency Framework

| Table | Rows | Schema File |
|-------|------|-------------|
| `competency_domains` | 0 | 20260502_framework_tables.sql |
| `competencies` | 0 | 20260502_framework_tables.sql |
| `competency_clusters` | 0 | 20260502_framework_tables.sql |
| `competency_assessment_items` | 0 | 20260502_framework_tables.sql |
| `competency_assessment_options` | 0 | 20260502_framework_tables.sql |
| `role_competency_weights` | 0 | 20260502_framework_tables.sql |
| `stage_competency_norms` | 0 | 20260502_framework_tables.sql |
| `scoring_configs` | 0 | 20260502_framework_tables.sql |
| `competency_library` | 0 | backend/shared/schema.ts |
| `student_competency_scores` | 0 | backend/shared/schema.ts |

### 7 — CAPADEX (Consumer Assessment Platform)

All created by `20260504_*` and `20260506_*` migration files. No Drizzle schema — accessed via raw SQL in backend route files.

| Table | Rows | Migration File |
|-------|------|----------------|
| `capadex_sessions` | 0 | 20260504_capadex_sessions.sql |
| `capadex_responses` | 0 | 20260504_capadex_sessions.sql |
| `capadex_users` | 0 | 20260504_capadex_auth_reports.sql |
| `capadex_otps` | 0 | 20260504_capadex_auth_reports.sql |
| `capadex_reports` | 0 | 20260504_capadex_auth_reports.sql |
| `capadex_stage_pricing` | 0 | 20260504_capadex_enrich_fields.sql |
| `capadex_recommendations` | 0 | 20260506_capadex_enterprise.sql |
| `capadex_risk_flags` | 0 | 20260506_capadex_enterprise.sql |
| `capadex_interventions` | 0 | 20260506_capadex_enterprise.sql |
| `capadex_gamification` | 0 | 20260506_capadex_enterprise.sql |
| `capadex_audit_events` | 0 | 20260506_capadex_enterprise.sql |
| `capadex_user_profiles` | 0 | 20260506_capadex_enterprise.sql |
| `capadex_consent_records` | 0 | 20260506_capadex_enterprise.sql |
| `capadex_session_signals` | 0 | 20260506_signal_capture.sql |
| `capadex_signal_profiles` | 0 | 20260506_signal_capture.sql |
| `capadex_linguistic_signals` | 0 | 20260506_signal_capture.sql |

### 8 — Short Assessments & Concern Areas

| Table | Rows | Migration File | Notes |
|-------|------|----------------|-------|
| `concern_areas` | ~160 | 20260505_short_assessments.sql | **HAS DATA** — seeded |
| `short_assessment_questions` | ~300 | 20260505_short_assessments.sql | **HAS DATA** — seeded |
| `short_assessment_age_bands` | 3 | 20260505_short_assessments.sql | **HAS DATA** — A/B/C |
| `ci_categories` | 0 | 20260507_concern_intelligence.sql | |
| `ci_clarification_questions` | 0 | 20260507_concern_intelligence.sql | |

### 9 — CSI & Behavioral Intelligence

| Table | Rows | Migration File | Notes |
|-------|------|----------------|-------|
| `csi_profiles` | 0 | 20260507_csi.sql | Career Stage Index |
| `csi_trajectory` | 0 | 20260507_csi.sql | |
| `csi_domain_weights` | 0 | 20260507_csi.sql | |
| `lbi_scores` | 0 | 20260507_bios_intelligence.sql | LBI engine output |
| `behavioural_signals` | 0 | 20260507_bios_intelligence.sql | |
| `signal_patterns` | 0 | 20260507_bios_intelligence.sql | |
| `signal_history` | 0 | 20260507_bios_intelligence.sql | |
| `developmental_trajectory` | 0 | 20260507_bios_intelligence.sql | |
| `tenants` | 0 | Raw SQL only (backend/routes/tenants.ts) | No migration file — Phase 1: add migration |
| `counsellors` | 0 | 20260508_counsellor_directory.sql | |

### 10 — Psychometric Assessment

| Table | Rows | Schema File | Notes |
|-------|------|-------------|-------|
| `psychometric_domains` | ~19 | backend/shared/schema.ts | **HAS DATA** — 19 LBI domains seeded |
| `psychometric_subdomains` | ~97 | backend/shared/schema.ts | **HAS DATA** — 97 subdomains seeded |
| `psychometric_age_bands` | 0 | backend/shared/schema.ts | |
| `psychometric_domain_age_band_config` | 0 | backend/shared/schema.ts | |
| `psychometric_question_bank` | 0 | backend/shared/schema.ts | |
| `psychometric_assessment_results` | 0 | backend/shared/schema.ts | |
| `assessment_templates` | 0 | backend/shared/schema.ts | |
| `assessment_template_questions` | 0 | backend/shared/schema.ts | |
| `custom_assessment_modules` | 0 | frontend/server/src/db/schema.ts | |

### 11 — Subscriptions & Billing

| Table | Rows | Live Schema Matches | Notes |
|-------|------|-----|-------|
| `subscription_packages` | 0 | backend/shared (14 cols) | frontend/server has 30-col aspirational version |
| `student_subscriptions` | 0 | backend/shared (11 cols) | frontend/server has different column set |
| `platform_transactions` | 0 | backend/shared | |
| `payment_reconciliations` | 0 | backend/shared | |

### 12 — Notifications

| Table | Rows | Schema File |
|-------|------|-------------|
| `notifications` | 0 | frontend/server/src/db/schema.ts (aspirational) |
| `notification_preferences` | 0 | frontend/server + 20260506_notification_preferences.sql |
| `notification_templates` | 0 | frontend/server/src/db/schema.ts (aspirational) |
| `notification_broadcasts` | 0 | frontend/server/src/db/schema.ts (aspirational) |
| `notification_scenarios` | 0 | frontend/server/src/db/schema.ts (aspirational) |
| `notification_scheduled_jobs` | 0 | frontend/server/src/db/schema.ts (aspirational) |

### 13 — Mentor & HR

| Table | Rows | Schema File |
|-------|------|-------------|
| `mentors` | 0 | backend/shared/schema.ts |
| `mentor_profiles` | 0 | frontend/server/src/db/schema.ts |
| `mentor_bookings` | 0 | frontend/server/src/db/schema.ts |
| `mentor_reviews` | 0 | frontend/server/src/db/schema.ts |
| `mentor_kpis` | 0 | frontend/server/src/db/schema.ts |
| `mentor_tasks` | 0 | frontend/server/src/db/schema.ts |
| `mentor_payouts` | 0 | frontend/server/src/db/schema.ts |
| `hr_jobs` | 0 | frontend/server/src/db/schema.ts |
| `hr_applications` | 0 | frontend/server/src/db/schema.ts |
| `job_postings` | 0 | backend/shared/schema.ts |
| `job_applications` | 0 | backend/shared/schema.ts |

### 14 — Intelligence Engines (BIOS / LDE / IIL / NHDA / PAIE / ROIE / RIE / SPE)

All tables in this group are created via their respective migration files in `backend/migrations/` and accessed via raw SQL in their respective route files. No Drizzle schema exists for any of these.

| Prefix | Migration File | ~Tables | Route File |
|--------|---------------|---------|-----------|
| `bios_*` | 20260507_bios_frontier.sql + 20260507_bios_ultimate.sql | 18 | backend/routes/behavioural-signals.ts, predictive-intelligence.ts |
| `lde_*` | 20260507_lde.sql | 30 | backend/routes/lde-*.ts |
| `iil_*` | 20260507_iil.sql | 35 | backend/routes/iil-*.ts |
| `nhda_*` | 20260507_nhda.sql | 25 | backend/routes/nhda-*.ts |
| `paie_*` | 20260507_paie.sql | 25 | **RESERVED — schema-only, no active write path.** Routes listed are placeholders; PAIE engine not yet implemented. |
| `roie_*` | 20260507_roie.sql | 25 | **RESERVED — schema-only, no active write path.** Routes listed are placeholders; ROIE engine not yet implemented. |
| `rie_*` | 20260507_rie_engine.sql + 20260508_rie_crisis_inbox.sql | 10 | backend/routes/rie-admin.ts |
| `spe_*` | 20260507_spe.sql | 20 | backend/routes/spe-*.ts |

---

## Tables Missing from Both Drizzle Schemas

These tables exist in the live DB but have no Drizzle ORM representation (raw SQL only):

| Table | Created By | Notes |
|-------|-----------|-------|
| `lbi_assessment_sessions` | Raw SQL in backend/routes.ts | Institute assessment flow; add Drizzle schema in Phase 1 |
| `tenants` | Raw SQL in backend/routes/tenants.ts | No migration file — add both in Phase 1 |
| `lbi_scoring_rules` | Raw SQL | |
| `lbi_report_types` | Raw SQL | |
| `lbi_overall_index` | Raw SQL | |
| `lbi_domain_scores` | Raw SQL | |
| `lbi_performance_correlation` | Raw SQL | |
| All `bios_*`, `lde_*`, `iil_*`, `nhda_*`, `paie_*`, `roie_*`, `rie_*`, `spe_*` | Migration files | Raw SQL only — no Drizzle schemas |

---

## Phase 1 Work Items

1. **CRITICAL:** Apply migrations to add missing columns to `users` (mobile, email, passwordHash, isActive, isVerified, etc.) before enabling frontend-server auth routes
2. **HIGH:** Audit `children` column name drift between frontend/server schema and live DB; apply corrective migration  
3. **HIGH:** Apply migration to extend `lbi_modules` (add subModules jsonb, domainCodes text[], change id to serial)
4. **HIGH:** Decide `lbi_sessions` strategy (Option A: repurpose to consumer model since 0 rows; Option B: rename)
5. **MEDIUM:** Apply migration to extend `subscription_packages` with 16 additional columns
6. **MEDIUM:** Reconcile `student_subscriptions` column sets (backend vs frontend schema)
7. **LOW:** Add Drizzle schema entry + migration for `lbi_assessment_sessions` (institute flow)
8. **LOW:** Add migration file for `tenants` table (currently raw SQL only)
9. **LOW:** DROP `lbi_questions_legacy`, `mfa_codes` after production confirmation of 0 rows
10. **LOW:** Consolidate duplicate schema definitions — once live tables are migrated, remove redundant definitions from `backend/shared/schema.ts` and import from canonical source
