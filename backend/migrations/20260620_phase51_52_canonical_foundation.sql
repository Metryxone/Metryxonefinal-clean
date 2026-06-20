-- =====================================================================
-- Phase 5.1 (Employer Foundation) + Phase 5.2 (Job Architecture Engine)
-- Canonical compatibility layer.
--
-- CONTRACT: additive · reversible · single-source-of-truth · never-fabricate.
-- The deliverable NAMES requested in the phase specs do not exist physically,
-- but functionally-equivalent, already-populated tables do. Rather than
-- duplicating live infrastructure (split-brain), we expose the deliverable
-- names as READ-ONLY VIEWS over the canonical source tables. No data is
-- copied. `DROP VIEW` fully reverses this. Genuine gaps (no source table at
-- all) are created as thin additive REAL tables.
--
-- IMPORTANT: each view selects from exactly ONE source. The platform has
-- several competing role/family ontologies living in DISJOINT id namespaces
-- (cg_*, onto_*, ont_*, role_families/uuid). Joining them would fabricate a
-- relationship that does not exist, so we do NOT. The chosen source per view
-- is the most-populated coherent spine, recorded in `source_authority`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Phase 5.1 — Employer Foundation deliverables
-- ---------------------------------------------------------------------

-- employer_master  ->  employer_organizations  (the employer / tenant entity)
CREATE OR REPLACE VIEW employer_master AS
SELECT
  o.id              AS employer_id,
  o.name            AS employer_name,
  o.domain          AS domain,
  o.plan            AS plan,
  o.owner_id        AS owner_user_id,
  o.verified        AS verified,
  o.approval_threshold,
  o.max_sessions,
  o.settings,
  'employer_organizations'::text AS source_authority,
  o.created_at,
  o.updated_at
FROM employer_organizations o;

-- organization_master  ->  employer_business_units
-- Represents the Organization -> Business Unit -> Department -> Function
-- hierarchy via the self-referential parent_id chain (depth is derived).
CREATE OR REPLACE VIEW organization_master AS
SELECT
  bu.id             AS unit_id,
  bu.org_id         AS employer_id,
  bu.name           AS unit_name,
  bu.parent_id      AS parent_unit_id,
  bu.head_user_id   AS head_user_id,
  bu.description     AS description,
  CASE WHEN bu.parent_id IS NULL THEN 'business_unit' ELSE 'sub_unit' END AS unit_kind,
  'employer_business_units'::text AS source_authority,
  bu.created_at
FROM employer_business_units bu;

-- employer_rbac  ->  role_definitions x role_permissions x permission_definitions
-- The GLOBAL RBAC catalogue (roles + their granted permissions). Org-scoped
-- role ASSIGNMENT lives in employer_members.role (not duplicated here).
CREATE OR REPLACE VIEW employer_rbac AS
SELECT
  rd.id             AS role_id,
  rd.role_name      AS role_name,
  rd.display_name   AS role_display_name,
  rd.level          AS role_level,
  rd.is_system      AS is_system,
  pd.id             AS permission_id,
  pd.permission_key AS permission_key,
  pd.display_name   AS permission_display_name,
  pd.resource       AS resource,
  pd.action         AS action,
  pd.category       AS category,
  'role_definitions+role_permissions+permission_definitions'::text AS source_authority
FROM role_definitions rd
LEFT JOIN role_permissions rp       ON rp.role_id = rd.id
LEFT JOIN permission_definitions pd ON pd.id = rp.permission_id
WHERE rd.is_active = true;

-- employer_profiles  ->  employer_company_profiles
CREATE OR REPLACE VIEW employer_profiles AS
SELECT
  cp.id             AS profile_id,
  cp.employer_id    AS employer_id,
  cp.name           AS company_name,
  cp.industry       AS industry,
  cp.size           AS company_size,
  cp.website        AS website,
  cp.linkedin       AS linkedin,
  cp.location       AS location,
  cp.about          AS about,
  cp.culture        AS culture,
  cp.benefits       AS benefits,
  cp.tech_stack     AS tech_stack,
  cp.values_list    AS company_values,
  cp.verified       AS verified,
  'employer_company_profiles'::text AS source_authority,
  cp.created_at,
  cp.updated_at
FROM employer_company_profiles cp;

-- ---------------------------------------------------------------------
-- Phase 5.2 — Job Architecture Engine deliverables
-- ---------------------------------------------------------------------

-- job_architecture  ->  cg_roles  (the most-populated role spine: 200 roles)
-- Job Family and Job Category both map to function_area in this spine (there
-- is NO separate category dimension in the populated data -- disclosed, not
-- fabricated). Job Level maps to seniority.
CREATE OR REPLACE VIEW job_architecture AS
SELECT
  r.id              AS role_id,
  r.role_key        AS role_key,
  r.title           AS role_title,
  r.function_area   AS job_family,
  r.function_area   AS job_category,
  r.seniority       AS job_level,
  r.industry_tags   AS industry_tags,
  r.description     AS description,
  r.demand_score    AS demand_score,
  r.automation_risk AS automation_risk,
  r.growth_30mo     AS growth_30mo,
  r.is_active       AS is_active,
  'cg_roles'::text  AS source_authority,
  r.created_at,
  r.updated_at
FROM cg_roles r;

-- job_role_framework  ->  onto_role_competency_profiles  (populated: 14 rows)
-- Role -> Competency Profile requirement mapping. role_id/competency_id are in
-- the onto_* namespace; we do NOT join them to cg_roles (disjoint namespace).
CREATE OR REPLACE VIEW job_role_framework AS
SELECT
  p.role_id         AS role_id,
  p.competency_id   AS competency_id,
  p.required_level  AS required_level,
  p.weight          AS weight,
  p.criticality     AS criticality,
  p.rationale       AS rationale,
  p.source          AS source,
  p.active          AS active,
  'onto_role_competency_profiles'::text AS source_authority,
  p.created_at,
  p.updated_at
FROM onto_role_competency_profiles p;

-- job_templates  ->  GENUINE GAP (no equivalent source table exists).
-- Built as a thin, additive REAL table. Employer-scoped (nullable employer_id
-- allows global/system templates). role_key is a SOFT pointer into
-- job_architecture/cg_roles -- no cross-namespace FK is asserted.
CREATE TABLE IF NOT EXISTS job_templates (
  id               text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employer_id      text,
  template_name    text NOT NULL,
  role_key         text,
  job_family       text,
  job_level        text,
  summary          text,
  responsibilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  requirements     jsonb NOT NULL DEFAULT '[]'::jsonb,
  competencies     jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system        boolean NOT NULL DEFAULT false,
  is_active        boolean NOT NULL DEFAULT true,
  source           text NOT NULL DEFAULT 'manual',
  created_by       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_templates_employer ON job_templates(employer_id);
CREATE INDEX IF NOT EXISTS idx_job_templates_role_key ON job_templates(role_key);
