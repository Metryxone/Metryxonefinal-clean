# MetryxOne Competency Ontology
## Normalized Database Architecture v1.0

**Classification:** Engineering Reference Document  
**Date:** 2026-06-10  
**Status:** Design Authority — Stop for Approval Before Migration  

---

## Table of Contents

1. [Conceptual Model](#1-conceptual-model)
2. [Table Prefixes & Conventions](#2-table-prefixes--conventions)
3. [Reference Tables](#3-reference-tables)
4. [Master Ontology Tables](#4-master-ontology-tables)
5. [Mapping Tables](#5-mapping-tables)
6. [Version Control Tables](#6-version-control-tables)
7. [Governance Tables](#7-governance-tables)
8. [Indexes & Constraints](#8-indexes--constraints)
9. [Version Control Rules](#9-version-control-rules)
10. [Lifecycle Rules](#10-lifecycle-rules)
11. [Governance Rules](#11-governance-rules)
12. [Crosswalk to Existing Tables](#12-crosswalk-to-existing-tables)

---

## 1. Conceptual Model

### 1.1 The 12-Level Hierarchy

```
TAXONOMY SPINE (Organisational Context)
────────────────────────────────────────
Level 01: Industry           e.g. Technology, Financial Services, Healthcare
           ↓
Level 02: Function           e.g. Engineering, Product, Finance, Operations
           ↓
Level 03: Department         e.g. Product Engineering, Data Science, Risk
           ↓
Level 04: Role Family        e.g. Software Engineer Family, Data Engineer Family
           ↓
Level 05: Role               e.g. Software Engineer II, Senior Product Manager
           ↓

COMPETENCY SPINE (Capability Framework)
────────────────────────────────────────
Level 06: Layer              e.g. Technical, Behavioural, Leadership, Cognitive
           ↓
Level 07: Competency Cluster e.g. Problem Solving, Communication, Execution
           ↓
Level 08: Competency         e.g. Critical Thinking, Stakeholder Management
           ↓
Level 09: Micro Competency   e.g. Root Cause Analysis, Hypothesis Formation

SIGNAL SPINE (Behavioural Intelligence)
────────────────────────────────────────
Level 10: Concern            e.g. identity_self_worth (CAPADEX concern)
           ↓
Level 11: Indicator          e.g. Avoidance of accountability situations
           ↓
Level 12: Assessment Question e.g. "I approach problems by gathering evidence..."
```

### 1.2 Spine Integration Points

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ONTOLOGY INTEGRATION MAP                         │
│                                                                      │
│  TAXONOMY SPINE          COMPETENCY SPINE        SIGNAL SPINE        │
│  ─────────────          ─────────────────        ────────────        │
│  Industry                                                            │
│  Function                                                            │
│  Department                                                          │
│  Role Family                                                         │
│  Role ───────────────── Layer                                        │
│  (map_role_layer)        Cluster                                     │
│                          Competency ─────────── Concern              │
│  Role ───────────────── Competency  (map_comp_  Indicator            │
│  (map_role_competency)  Micro Comp   concern)   Question             │
│                          ↑                           ↑              │
│                          └───── map_question_micro ──┘              │
│                                  + map_question_concern              │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Entity Relationship Summary

| Parent | Child | Cardinality | Join |
|--------|-------|-------------|------|
| Industry | Function | M:N | `map_industry_function` |
| Function | Department | M:N | `map_function_department` |
| Department | Role Family | M:N | `map_department_role_family` |
| Role Family | Role | M:N | `map_role_family_role` |
| Role | Layer | M:N | `map_role_layer` |
| Layer | Competency Cluster | M:N | `map_layer_cluster` |
| Competency Cluster | Competency | M:N | `map_cluster_competency` |
| Competency | Micro Competency | M:N | `map_competency_micro` |
| Micro Competency | Concern | M:N | `map_micro_competency_concern` |
| Concern | Indicator | 1:N | `ont_indicators.concern_id` |
| Indicator | Question | M:N | `map_question_indicator` |
| Role | Competency | M:N | `map_role_competency` (shortcut join for EI) |
| Micro Competency | Question | M:N | `map_question_micro_competency` |
| Competency | Concern | M:N | `map_competency_concern` (CAPADEX bridge) |

---

## 2. Table Prefixes & Conventions

| Prefix | Group | Purpose |
|--------|-------|---------|
| `ref_` | Reference | Immutable lookup/enum tables; seed data |
| `ont_` | Ontology Master | Canonical entity definitions; versioned |
| `map_` | Mapping | N:M association tables; append-only effective-dated |
| `ver_` | Version | Snapshot history for published ontology changes |
| `gov_` | Governance | Change management, approvals, impact assessments |

### Global Column Conventions
```sql
-- Every ont_ and map_ table includes:
id            UUID        PRIMARY KEY DEFAULT gen_random_uuid()
code          VARCHAR     NOT NULL UNIQUE  -- immutable after publish
status        VARCHAR     NOT NULL DEFAULT 'draft'
                          REFERENCES ref_lifecycle_statuses(code)
created_by    UUID        NOT NULL REFERENCES users(id)
updated_by    UUID        NOT NULL REFERENCES users(id)
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
version       INTEGER     NOT NULL DEFAULT 1  -- increments on publish

-- Every ref_ table includes:
code          VARCHAR     PRIMARY KEY        -- used as FK target
label         VARCHAR     NOT NULL
description   TEXT
sort_order    INTEGER     DEFAULT 0
is_active     BOOLEAN     NOT NULL DEFAULT true
```

---

## 3. Reference Tables

### 3.1 ref_lifecycle_statuses
```sql
CREATE TABLE ref_lifecycle_statuses (
  code          VARCHAR(30) PRIMARY KEY,
  label         VARCHAR(80)  NOT NULL,
  description   TEXT,
  is_terminal   BOOLEAN      NOT NULL DEFAULT false,  -- archived = terminal
  sort_order    INTEGER      NOT NULL DEFAULT 0
);

INSERT INTO ref_lifecycle_statuses (code, label, is_terminal, sort_order) VALUES
  ('draft',       'Draft',       false, 1),
  ('in_review',   'In Review',   false, 2),
  ('approved',    'Approved',    false, 3),
  ('published',   'Published',   false, 4),
  ('deprecated',  'Deprecated',  false, 5),  -- published but scheduled for retirement
  ('archived',    'Archived',    true,  6);
```

### 3.2 ref_seniority_levels
```sql
CREATE TABLE ref_seniority_levels (
  code              VARCHAR(20) PRIMARY KEY,
  label             VARCHAR(60)  NOT NULL,
  numeric_band      SMALLINT     NOT NULL UNIQUE,  -- 1=intern, 10=c_suite
  typical_years_min SMALLINT,
  typical_years_max SMALLINT,
  is_leadership     BOOLEAN      NOT NULL DEFAULT false,
  sort_order        INTEGER      NOT NULL DEFAULT 0
);

INSERT INTO ref_seniority_levels
  (code, label, numeric_band, typical_years_min, typical_years_max, is_leadership) VALUES
  ('intern',      'Intern / Trainee',       1,  0,  1,  false),
  ('junior',      'Junior',                 2,  0,  3,  false),
  ('mid',         'Mid-Level',              3,  2,  6,  false),
  ('senior',      'Senior',                 4,  5,  12, false),
  ('lead',        'Tech / Team Lead',       5,  7,  15, false),
  ('principal',   'Principal / Staff',      6,  8,  20, false),
  ('manager',     'Manager',                7,  5,  20, true),
  ('sr_manager',  'Senior Manager',         8,  8,  25, true),
  ('director',    'Director',               9,  10, 30, true),
  ('vp',          'Vice President',         9,  12, 35, true),
  ('c_suite',     'C-Suite / Executive',   10,  15, 99, true);
```

### 3.3 ref_layer_types
```sql
CREATE TABLE ref_layer_types (
  code              VARCHAR(30) PRIMARY KEY,
  label             VARCHAR(80)  NOT NULL,
  description       TEXT,
  assessment_engine VARCHAR(30),   -- 'lbi' | 'capadex' | 'sdi' | 'custom'
  sort_order        INTEGER        NOT NULL DEFAULT 0
);

INSERT INTO ref_layer_types (code, label, assessment_engine, sort_order) VALUES
  ('technical',      'Technical Skills',            'custom', 1),
  ('behavioural',    'Behavioural Competencies',    'capadex', 2),
  ('cognitive',      'Cognitive Abilities',         'lbi',    3),
  ('leadership',     'Leadership Competencies',     'custom', 4),
  ('social',         'Social & Interpersonal',      'capadex', 5),
  ('digital',        'Digital Literacy',            'custom', 6),
  ('adaptive',       'Adaptive & Future Skills',    'custom', 7),
  ('domain',         'Domain / Functional Knowledge','custom', 8);
```

### 3.4 ref_competency_categories
```sql
CREATE TABLE ref_competency_categories (
  code              VARCHAR(30) PRIMARY KEY,
  label             VARCHAR(80)  NOT NULL,
  parent_code       VARCHAR(30)  REFERENCES ref_competency_categories(code),
  layer_type_code   VARCHAR(30)  REFERENCES ref_layer_types(code),
  description       TEXT,
  sort_order        INTEGER      NOT NULL DEFAULT 0
);

INSERT INTO ref_competency_categories (code, label, layer_type_code, sort_order) VALUES
  ('problem_solving',   'Problem Solving & Analysis',  'cognitive',    1),
  ('communication',     'Communication',               'behavioural',  2),
  ('execution',         'Execution & Delivery',        'behavioural',  3),
  ('leadership_impact', 'Leadership Impact',           'leadership',   4),
  ('learning_agility',  'Learning Agility',            'adaptive',     5),
  ('technical_mastery', 'Technical Mastery',           'technical',    6),
  ('stakeholder_mgmt',  'Stakeholder Management',      'social',       7),
  ('innovation',        'Innovation & Creativity',     'cognitive',    8),
  ('digital_fluency',   'Digital Fluency',             'digital',      9),
  ('self_management',   'Self-Management',             'behavioural',  10);
```

### 3.5 ref_proficiency_levels
```sql
CREATE TABLE ref_proficiency_levels (
  code              VARCHAR(20) PRIMARY KEY,
  label             VARCHAR(60)  NOT NULL,
  level_number      SMALLINT     NOT NULL UNIQUE,  -- 1–5
  score_band_min    NUMERIC(5,2) NOT NULL,
  score_band_max    NUMERIC(5,2) NOT NULL,
  description       TEXT,
  sort_order        INTEGER      NOT NULL DEFAULT 0,
  CONSTRAINT chk_band CHECK (score_band_min < score_band_max),
  CONSTRAINT chk_band_range CHECK (score_band_min >= 0 AND score_band_max <= 100)
);

INSERT INTO ref_proficiency_levels
  (code, label, level_number, score_band_min, score_band_max) VALUES
  ('foundational',  'Foundational',  1,  0.00,  39.99),
  ('developing',    'Developing',    2, 40.00,  59.99),
  ('proficient',    'Proficient',    3, 60.00,  74.99),
  ('advanced',      'Advanced',      4, 75.00,  89.99),
  ('expert',        'Expert',        5, 90.00, 100.00);
```

### 3.6 ref_question_types
```sql
CREATE TABLE ref_question_types (
  code              VARCHAR(30) PRIMARY KEY,
  label             VARCHAR(80)  NOT NULL,
  spine             VARCHAR(20)  NOT NULL,  -- 'competency' | 'concern' | 'both'
  has_options       BOOLEAN      NOT NULL DEFAULT true,
  description       TEXT,
  sort_order        INTEGER      NOT NULL DEFAULT 0
);

INSERT INTO ref_question_types (code, label, spine, has_options, sort_order) VALUES
  ('single_select',    'Single Select',       'both',       true,  1),
  ('multi_select',     'Multi Select',        'both',       true,  2),
  ('likert_5',         'Likert Scale (1–5)',   'competency', true,  3),
  ('likert_7',         'Likert Scale (1–7)',   'competency', true,  4),
  ('slider',           'Slider',              'competency', false, 5),
  ('ranked_choice',    'Ranked Choice',       'competency', true,  6),
  ('open_text',        'Open Text',           'both',       false, 7),
  ('scenario',         'Scenario-Based',      'both',       true,  8),
  ('situational',      'Situational Judgment','both',       true,  9);
```

### 3.7 ref_response_polarities
```sql
CREATE TABLE ref_response_polarities (
  code          VARCHAR(20) PRIMARY KEY,
  label         VARCHAR(40)  NOT NULL,
  score_direction SMALLINT   NOT NULL,  -- +1 positive, -1 negative, 0 neutral
  description   TEXT
);

INSERT INTO ref_response_polarities (code, label, score_direction) VALUES
  ('positive', 'Positive',  1),
  ('negative', 'Negative', -1),
  ('neutral',  'Neutral',   0);
```

### 3.8 ref_concern_types
```sql
CREATE TABLE ref_concern_types (
  code              VARCHAR(30) PRIMARY KEY,
  label             VARCHAR(80)  NOT NULL,
  severity_default  NUMERIC(4,3) NOT NULL DEFAULT 0.500,
  description       TEXT,
  sort_order        INTEGER      NOT NULL DEFAULT 0
);

INSERT INTO ref_concern_types (code, label, severity_default, sort_order) VALUES
  ('acute',          'Acute',          0.850, 1),
  ('chronic',        'Chronic',        0.700, 2),
  ('developmental',  'Developmental',  0.500, 3),
  ('contextual',     'Contextual',     0.400, 4),
  ('aspirational',   'Aspirational',   0.200, 5);
```

### 3.9 ref_signal_types
```sql
CREATE TABLE ref_signal_types (
  code              VARCHAR(30) PRIMARY KEY,
  label             VARCHAR(80)  NOT NULL,
  source_engine     VARCHAR(30),   -- 'capadex' | 'bios' | 'csi' | 'custom'
  description       TEXT,
  sort_order        INTEGER        NOT NULL DEFAULT 0
);

INSERT INTO ref_signal_types (code, label, source_engine, sort_order) VALUES
  ('behavioural',    'Behavioural',             'capadex', 1),
  ('cognitive',      'Cognitive',               'lbi',     2),
  ('emotional',      'Emotional',               'capadex', 3),
  ('contextual',     'Contextual',              'bios',    4),
  ('physiological',  'Physiological Proxy',     'bios',    5),
  ('relational',     'Relational / Social',     'capadex', 6);
```

### 3.10 ref_age_bands
```sql
CREATE TABLE ref_age_bands (
  code              VARCHAR(20) PRIMARY KEY,
  label             VARCHAR(40)  NOT NULL,
  age_min           SMALLINT     NOT NULL,
  age_max           SMALLINT     NOT NULL,
  is_adult          BOOLEAN      NOT NULL,   -- age >= 24 = adult per platform canon
  sort_order        INTEGER      NOT NULL DEFAULT 0,
  CONSTRAINT chk_age_band CHECK (age_min < age_max AND age_min >= 0 AND age_max <= 99)
);

INSERT INTO ref_age_bands (code, label, age_min, age_max, is_adult, sort_order) VALUES
  ('10_14',   '10–14 years',    10, 14, false, 1),
  ('15_17',   '15–17 years',    15, 17, false, 2),
  ('18_21',   '18–21 years',    18, 21, false, 3),
  ('22_25',   '22–25 years',    22, 25, true,  4),
  ('26_30',   '26–30 years',    26, 30, true,  5),
  ('31_40',   '31–40 years',    31, 40, true,  6),
  ('41_50',   '41–50 years',    41, 50, true,  7),
  ('51_60',   '51–60 years',    51, 60, true,  8),
  ('61_plus', '61+ years',      61, 99, true,  9);
```

### 3.11 ref_persona_types
```sql
CREATE TABLE ref_persona_types (
  code              VARCHAR(30) PRIMARY KEY,
  label             VARCHAR(80)  NOT NULL,
  age_band_codes    TEXT[]       NOT NULL,  -- applicable age bands
  is_active         BOOLEAN      NOT NULL DEFAULT true,
  sort_order        INTEGER      NOT NULL DEFAULT 0
);

INSERT INTO ref_persona_types (code, label, age_band_codes, sort_order) VALUES
  ('student',          'Student',                     '{10_14,15_17,18_21}', 1),
  ('early_career',     'Early Career Professional',   '{22_25,26_30}',       2),
  ('professional',     'Established Professional',    '{26_30,31_40,41_50}', 3),
  ('career_changer',   'Career Changer',              '{26_30,31_40,41_50}', 4),
  ('senior_leader',    'Senior Leader',               '{31_40,41_50,51_60}', 5),
  ('returner',         'Career Returner',             '{26_30,31_40,41_50}', 6),
  ('entrepreneur',     'Entrepreneur / Founder',      '{22_25,26_30,31_40}', 7);
```

### 3.12 ref_concern_domains
```sql
CREATE TABLE ref_concern_domains (
  code              VARCHAR(50) PRIMARY KEY,
  label             VARCHAR(100) NOT NULL,
  description       TEXT,
  sort_order        INTEGER      NOT NULL DEFAULT 0
);

INSERT INTO ref_concern_domains (code, label, sort_order) VALUES
  ('self_identity',       'Self & Identity',             1),
  ('relationships',       'Relationships & Belonging',   2),
  ('performance',         'Performance & Achievement',   3),
  ('career_direction',    'Career Direction & Purpose',  4),
  ('wellbeing',           'Wellbeing & Resilience',      5),
  ('cognitive_patterns',  'Cognitive Patterns',          6),
  ('social_dynamics',     'Social Dynamics',             7),
  ('values_ethics',       'Values & Ethics',             8),
  ('transition',          'Life Transitions',            9),
  ('learning_growth',     'Learning & Growth',           10);
```

---

## 4. Master Ontology Tables

### 4.1 ont_industries
```sql
CREATE TABLE ont_industries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(20) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  display_name    VARCHAR(180) NOT NULL,
  parent_sector   VARCHAR(120),
  description     TEXT,
  isco_code       VARCHAR(10),
  esco_uri        VARCHAR(255),
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  status          VARCHAR(30) NOT NULL DEFAULT 'draft'
                              REFERENCES ref_lifecycle_statuses(code),
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  version         INTEGER     NOT NULL DEFAULT 1,
  created_by      UUID        NOT NULL REFERENCES users(id),
  updated_by      UUID        NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_industry_code
    UNIQUE (code),
  CONSTRAINT chk_industry_code_fmt
    CHECK (code ~ '^[A-Z][A-Z0-9_]{1,19}$')
);
```

### 4.2 ont_functions
```sql
CREATE TABLE ont_functions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(20) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  display_name    VARCHAR(180) NOT NULL,
  description     TEXT,
  typical_team_size VARCHAR(20),  -- 'individual'|'small'|'medium'|'large'|'enterprise'
  is_cross_industry BOOLEAN   NOT NULL DEFAULT false,  -- applies to all industries
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  status          VARCHAR(30) NOT NULL DEFAULT 'draft'
                              REFERENCES ref_lifecycle_statuses(code),
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  version         INTEGER     NOT NULL DEFAULT 1,
  created_by      UUID        NOT NULL REFERENCES users(id),
  updated_by      UUID        NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_function_code UNIQUE (code),
  CONSTRAINT chk_function_code_fmt CHECK (code ~ '^[A-Z][A-Z0-9_]{1,19}$')
);
```

### 4.3 ont_departments
```sql
CREATE TABLE ont_departments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                VARCHAR(25) NOT NULL,
  name                VARCHAR(120) NOT NULL,
  display_name        VARCHAR(180) NOT NULL,
  description         TEXT,
  cost_centre_type    VARCHAR(20),   -- 'revenue'|'cost'|'support'|'strategic'
  headcount_min       INTEGER        CHECK (headcount_min >= 1),
  headcount_max       INTEGER        CHECK (headcount_max >= headcount_min),
  reporting_to_id     UUID           REFERENCES ont_departments(id),  -- parent dept
  is_active           BOOLEAN        NOT NULL DEFAULT true,
  status              VARCHAR(30)    NOT NULL DEFAULT 'draft'
                                     REFERENCES ref_lifecycle_statuses(code),
  sort_order          INTEGER        NOT NULL DEFAULT 0,
  version             INTEGER        NOT NULL DEFAULT 1,
  created_by          UUID           NOT NULL REFERENCES users(id),
  updated_by          UUID           NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_department_code UNIQUE (code),
  CONSTRAINT chk_dept_code_fmt CHECK (code ~ '^[A-Z][A-Z0-9_]{1,24}$')
);
```

### 4.4 ont_role_families
```sql
CREATE TABLE ont_role_families (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(30) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  display_name    VARCHAR(180) NOT NULL,
  description     TEXT,
  career_track_archetype  VARCHAR(30),  -- 'ic'|'management'|'specialist'|'cross_functional'
  typical_ei_band         VARCHAR(30),  -- expected EI band for this family
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  status          VARCHAR(30) NOT NULL DEFAULT 'draft'
                              REFERENCES ref_lifecycle_statuses(code),
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  version         INTEGER     NOT NULL DEFAULT 1,
  created_by      UUID        NOT NULL REFERENCES users(id),
  updated_by      UUID        NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_role_family_code UNIQUE (code)
);
```

### 4.5 ont_roles
```sql
CREATE TABLE ont_roles (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  VARCHAR(30) NOT NULL,
  title                 VARCHAR(180) NOT NULL,
  alternate_titles      TEXT[],
  seniority_level_code  VARCHAR(20) NOT NULL
                                    REFERENCES ref_seniority_levels(code),
  description           TEXT,
  responsibilities      TEXT[],    -- up to 20
  occupation_id         UUID       REFERENCES occupations(id),   -- EI graph crosswalk
  ei_target_score       NUMERIC(5,2) CHECK (ei_target_score BETWEEN 0 AND 100),
  min_years_experience  SMALLINT   CHECK (min_years_experience >= 0),
  isco_code             VARCHAR(10),
  esco_code             VARCHAR(20),
  is_leadership         BOOLEAN    NOT NULL DEFAULT false,
  is_active             BOOLEAN    NOT NULL DEFAULT true,
  status                VARCHAR(30) NOT NULL DEFAULT 'draft'
                                    REFERENCES ref_lifecycle_statuses(code),
  sort_order            INTEGER    NOT NULL DEFAULT 0,
  version               INTEGER    NOT NULL DEFAULT 1,
  created_by            UUID       NOT NULL REFERENCES users(id),
  updated_by            UUID       NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_role_code UNIQUE (code),
  CONSTRAINT chk_role_code_fmt CHECK (code ~ '^[A-Z][A-Z0-9_]{1,29}$')
);
```

### 4.6 ont_layers
```sql
CREATE TABLE ont_layers (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code              VARCHAR(30) NOT NULL,
  name              VARCHAR(120) NOT NULL,
  display_name      VARCHAR(180) NOT NULL,
  layer_type_code   VARCHAR(30) NOT NULL REFERENCES ref_layer_types(code),
  description       TEXT,
  weight_default    NUMERIC(5,4) NOT NULL DEFAULT 0.1250
                                 CHECK (weight_default BETWEEN 0 AND 1),
  assessment_engine VARCHAR(30),
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  status            VARCHAR(30) NOT NULL DEFAULT 'draft'
                                REFERENCES ref_lifecycle_statuses(code),
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  version           INTEGER     NOT NULL DEFAULT 1,
  created_by        UUID        NOT NULL REFERENCES users(id),
  updated_by        UUID        NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_layer_code UNIQUE (code)
);

-- Seed canonical layers
INSERT INTO ont_layers (code, name, display_name, layer_type_code, weight_default, assessment_engine, status) VALUES
  ('LAYER_TECHNICAL',   'Technical Skills',            'Technical Skills',          'technical',   0.2000, 'custom',  'published'),
  ('LAYER_BEHAVIOURAL', 'Behavioural Competencies',    'Behavioural Competencies',  'behavioural', 0.2000, 'capadex', 'published'),
  ('LAYER_COGNITIVE',   'Cognitive Abilities',         'Cognitive Abilities',       'cognitive',   0.1500, 'lbi',     'published'),
  ('LAYER_LEADERSHIP',  'Leadership Competencies',     'Leadership Competencies',   'leadership',  0.1500, 'custom',  'published'),
  ('LAYER_SOCIAL',      'Social & Interpersonal',      'Social & Interpersonal',    'social',      0.1000, 'capadex', 'published'),
  ('LAYER_DIGITAL',     'Digital Literacy',            'Digital Literacy',          'digital',     0.0500, 'custom',  'published'),
  ('LAYER_ADAPTIVE',    'Adaptive & Future Skills',    'Adaptive & Future Skills',  'adaptive',    0.1000, 'custom',  'published'),
  ('LAYER_DOMAIN',      'Domain Knowledge',            'Domain Knowledge',          'domain',      0.0500, 'custom',  'published');
```

### 4.7 ont_competency_clusters
```sql
CREATE TABLE ont_competency_clusters (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code              VARCHAR(30) NOT NULL,
  name              VARCHAR(120) NOT NULL,
  display_name      VARCHAR(180) NOT NULL,
  category_code     VARCHAR(30) REFERENCES ref_competency_categories(code),
  description       TEXT,
  is_core           BOOLEAN     NOT NULL DEFAULT false,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  status            VARCHAR(30) NOT NULL DEFAULT 'draft'
                                REFERENCES ref_lifecycle_statuses(code),
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  version           INTEGER     NOT NULL DEFAULT 1,
  created_by        UUID        NOT NULL REFERENCES users(id),
  updated_by        UUID        NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_cluster_code UNIQUE (code)
);
```

### 4.8 ont_competencies
```sql
CREATE TABLE ont_competencies (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  VARCHAR(30) NOT NULL,
  name                  VARCHAR(150) NOT NULL,
  display_name          VARCHAR(200) NOT NULL,
  category_code         VARCHAR(30) REFERENCES ref_competency_categories(code),
  description           TEXT        NOT NULL,
  positive_indicators   TEXT[]      NOT NULL,   -- 3–10 observable positive behaviours
  development_indicators TEXT[]     NOT NULL,   -- 3–10 development-focus behaviours
  is_core               BOOLEAN     NOT NULL DEFAULT false,
  is_leadership         BOOLEAN     NOT NULL DEFAULT false,
  weight_in_ei          NUMERIC(5,4)          CHECK (weight_in_ei BETWEEN 0 AND 1),
  lbi_domain_crosswalk  VARCHAR(100),          -- maps to existing lbi_domains.code
  capadex_bridge_tag    VARCHAR(100),          -- maps to capadex_concerns_master.relational_bridge_tag
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  status                VARCHAR(30) NOT NULL DEFAULT 'draft'
                                    REFERENCES ref_lifecycle_statuses(code),
  sort_order            INTEGER     NOT NULL DEFAULT 0,
  version               INTEGER     NOT NULL DEFAULT 1,
  created_by            UUID        NOT NULL REFERENCES users(id),
  updated_by            UUID        NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_competency_code UNIQUE (code),
  CONSTRAINT chk_competency_code_fmt CHECK (code ~ '^[A-Z][A-Z0-9_]{1,29}$'),
  CONSTRAINT chk_positive_indicators_len CHECK (array_length(positive_indicators, 1) BETWEEN 3 AND 10),
  CONSTRAINT chk_development_indicators_len CHECK (array_length(development_indicators, 1) BETWEEN 3 AND 10)
);
```

### 4.9 ont_micro_competencies
```sql
CREATE TABLE ont_micro_competencies (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code              VARCHAR(40) NOT NULL,
  name              VARCHAR(150) NOT NULL,
  display_name      VARCHAR(200) NOT NULL,
  description       TEXT        NOT NULL,
  observable_definition TEXT,           -- precise observable definition
  positive_anchors  TEXT[]      NOT NULL, -- 2–5 specific observable examples at proficiency
  gap_anchors       TEXT[]      NOT NULL, -- 2–5 examples indicating gap
  mastery_anchors   TEXT[],              -- 2–5 examples at expert level
  is_observable     BOOLEAN     NOT NULL DEFAULT true,
  is_measurable     BOOLEAN     NOT NULL DEFAULT true,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  status            VARCHAR(30) NOT NULL DEFAULT 'draft'
                                REFERENCES ref_lifecycle_statuses(code),
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  version           INTEGER     NOT NULL DEFAULT 1,
  created_by        UUID        NOT NULL REFERENCES users(id),
  updated_by        UUID        NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_micro_competency_code UNIQUE (code),
  CONSTRAINT chk_positive_anchors CHECK (array_length(positive_anchors, 1) BETWEEN 2 AND 5),
  CONSTRAINT chk_gap_anchors CHECK (array_length(gap_anchors, 1) BETWEEN 2 AND 5)
);
```

### 4.10 ont_concerns
```sql
-- Extends / replaces capadex_concerns_master
-- See §12 Crosswalk for migration path

CREATE TABLE ont_concerns (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id               INTEGER     UNIQUE,  -- FK mirror to capadex_concerns_master.id
  code                    VARCHAR(60) NOT NULL,
  display_label           VARCHAR(200) NOT NULL,
  relational_bridge_tag   VARCHAR(100) NOT NULL,  -- bucket-level join key (immutable after publish)
  concern_type_code       VARCHAR(30) NOT NULL REFERENCES ref_concern_types(code),
  domain_code             VARCHAR(50) NOT NULL REFERENCES ref_concern_domains(code),
  sub_domain              VARCHAR(80),
  polarity                VARCHAR(20) NOT NULL CHECK (polarity IN ('concern','strength','neutral')),
  severity_weight         NUMERIC(4,3) CHECK (severity_weight BETWEEN 0 AND 1),
  applicable_age_bands    TEXT[],   -- null = universal; array of ref_age_bands.code
  applicable_personas     TEXT[],   -- null = all; array of ref_persona_types.code
  applicable_dev_stages   TEXT[],
  is_active               BOOLEAN     NOT NULL DEFAULT true,
  status                  VARCHAR(30) NOT NULL DEFAULT 'draft'
                                      REFERENCES ref_lifecycle_statuses(code),
  sort_order              INTEGER     NOT NULL DEFAULT 0,
  version                 INTEGER     NOT NULL DEFAULT 1,
  created_by              UUID        NOT NULL REFERENCES users(id),
  updated_by              UUID        NOT NULL REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_concern_code UNIQUE (code),
  CONSTRAINT uq_concern_bridge_tag UNIQUE (relational_bridge_tag),
  CONSTRAINT chk_concern_code_fmt CHECK (code ~ '^[a-z][a-z0-9_]{2,59}$'),
  -- Polarity canon: strength concerns never have severity_weight > 0
  CONSTRAINT chk_strength_no_severity
    CHECK (polarity != 'strength' OR severity_weight IS NULL OR severity_weight = 0)
);
```

### 4.11 ont_indicators
```sql
CREATE TABLE ont_indicators (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code              VARCHAR(60) NOT NULL,
  label             VARCHAR(200) NOT NULL,
  concern_id        UUID        NOT NULL REFERENCES ont_concerns(id),
  bridge_tag        VARCHAR(100) NOT NULL,   -- must match concern.relational_bridge_tag
  signal_type_code  VARCHAR(30) NOT NULL REFERENCES ref_signal_types(code),
  polarity          VARCHAR(20) NOT NULL REFERENCES ref_response_polarities(code),
  weight            NUMERIC(5,4) NOT NULL    CHECK (weight BETWEEN 0.001 AND 1.000),
  description       TEXT,
  observable_threshold TEXT,                 -- when is this reliably detectable
  applicable_age_bands TEXT[],
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  status            VARCHAR(30) NOT NULL DEFAULT 'draft'
                                REFERENCES ref_lifecycle_statuses(code),
  version           INTEGER     NOT NULL DEFAULT 1,
  created_by        UUID        NOT NULL REFERENCES users(id),
  updated_by        UUID        NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_indicator_code UNIQUE (code),
  CONSTRAINT chk_indicator_bridge_tag_matches_concern
    -- Enforced in application layer (FK to bridge_tag not possible without partial index)
    CHECK (bridge_tag IS NOT NULL)
);
```

### 4.12 ont_questions
```sql
CREATE TABLE ont_questions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  VARCHAR(60) NOT NULL,
  question_type_code    VARCHAR(30) NOT NULL REFERENCES ref_question_types(code),
  spine                 VARCHAR(20) NOT NULL CHECK (spine IN ('competency','concern','both')),
  question_text         TEXT        NOT NULL,
  question_text_short   VARCHAR(220),
  response_format_code  VARCHAR(30) NOT NULL REFERENCES ref_question_types(code),
  response_options      JSONB,       -- [{ value, label, score, polarity }]
  polarity              VARCHAR(20) NOT NULL REFERENCES ref_response_polarities(code),
  reverse_scored        BOOLEAN     NOT NULL DEFAULT false,
  difficulty            VARCHAR(10) CHECK (difficulty IN ('easy','medium','hard')),
  dev_stage             VARCHAR(30) CHECK (dev_stage IN ('exploration','establishment','advancement','leadership')),
  age_band_min          SMALLINT    CHECK (age_band_min >= 0),
  age_band_max          SMALLINT    CHECK (age_band_max <= 99 AND age_band_max >= age_band_min),
  applicable_personas   TEXT[],
  language              VARCHAR(10) NOT NULL DEFAULT 'en',
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  status                VARCHAR(30) NOT NULL DEFAULT 'draft'   -- manual POST always draft
                                    REFERENCES ref_lifecycle_statuses(code),
  version               INTEGER     NOT NULL DEFAULT 1,
  created_by            UUID        NOT NULL REFERENCES users(id),
  updated_by            UUID        NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_question_code UNIQUE (code),
  -- Language policy: question_text must never contain hiring/suitability language
  -- Enforced at application layer, not constraint level
  CONSTRAINT chk_response_options_present
    CHECK (response_format_code = 'open_text' OR response_options IS NOT NULL)
);
```

---

## 5. Mapping Tables

All mapping tables are:
- **Effective-dated**: include `effective_from` / `effective_until` (null = current)
- **Append-only for history**: new row on change, old row's `effective_until` set
- **Never hard-deleted**: set `is_active = false`

### 5.1 map_industry_function
```sql
CREATE TABLE map_industry_function (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id     UUID        NOT NULL REFERENCES ont_industries(id),
  function_id     UUID        NOT NULL REFERENCES ont_functions(id),
  is_primary      BOOLEAN     NOT NULL DEFAULT false,  -- primary industry for this function
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  effective_from  DATE        NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  created_by      UUID        NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_industry_function UNIQUE (industry_id, function_id)
);
```

### 5.2 map_function_department
```sql
CREATE TABLE map_function_department (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  function_id     UUID        NOT NULL REFERENCES ont_functions(id),
  department_id   UUID        NOT NULL REFERENCES ont_departments(id),
  is_primary      BOOLEAN     NOT NULL DEFAULT true,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  effective_from  DATE        NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  created_by      UUID        NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_function_department UNIQUE (function_id, department_id)
);
```

### 5.3 map_department_role_family
```sql
CREATE TABLE map_department_role_family (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id   UUID        NOT NULL REFERENCES ont_departments(id),
  role_family_id  UUID        NOT NULL REFERENCES ont_role_families(id),
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  effective_from  DATE        NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  created_by      UUID        NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_dept_role_family UNIQUE (department_id, role_family_id)
);
```

### 5.4 map_role_family_role
```sql
CREATE TABLE map_role_family_role (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  role_family_id  UUID        NOT NULL REFERENCES ont_role_families(id),
  role_id         UUID        NOT NULL REFERENCES ont_roles(id),
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  effective_from  DATE        NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  created_by      UUID        NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_role_family_role UNIQUE (role_family_id, role_id)
);
```

### 5.5 map_role_layer
```sql
CREATE TABLE map_role_layer (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         UUID        NOT NULL REFERENCES ont_roles(id),
  layer_id        UUID        NOT NULL REFERENCES ont_layers(id),
  weight          NUMERIC(5,4) NOT NULL DEFAULT 0.1250
                               CHECK (weight BETWEEN 0 AND 1),
  is_mandatory    BOOLEAN     NOT NULL DEFAULT true,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  effective_from  DATE        NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  created_by      UUID        NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_role_layer UNIQUE (role_id, layer_id)
  -- Sum of weights per role should = 1.0 (enforced at application layer)
);
```

### 5.6 map_layer_cluster
```sql
CREATE TABLE map_layer_cluster (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id              UUID        NOT NULL REFERENCES ont_layers(id),
  cluster_id            UUID        NOT NULL REFERENCES ont_competency_clusters(id),
  weight                NUMERIC(5,4) NOT NULL DEFAULT 0.2000
                                     CHECK (weight BETWEEN 0 AND 1),
  sort_order            INTEGER     NOT NULL DEFAULT 0,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  effective_from        DATE        NOT NULL DEFAULT CURRENT_DATE,
  effective_until       DATE,
  created_by            UUID        NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_layer_cluster UNIQUE (layer_id, cluster_id)
);
```

### 5.7 map_cluster_competency
```sql
CREATE TABLE map_cluster_competency (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id      UUID        NOT NULL REFERENCES ont_competency_clusters(id),
  competency_id   UUID        NOT NULL REFERENCES ont_competencies(id),
  weight          NUMERIC(5,4) NOT NULL DEFAULT 0.2000
                               CHECK (weight BETWEEN 0 AND 1),
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  effective_from  DATE        NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  created_by      UUID        NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_cluster_competency UNIQUE (cluster_id, competency_id)
);
```

### 5.8 map_competency_micro
```sql
CREATE TABLE map_competency_micro (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id         UUID        NOT NULL REFERENCES ont_competencies(id),
  micro_competency_id   UUID        NOT NULL REFERENCES ont_micro_competencies(id),
  weight                NUMERIC(5,4) NOT NULL DEFAULT 0.1000
                                     CHECK (weight BETWEEN 0 AND 1),
  is_mandatory          BOOLEAN     NOT NULL DEFAULT true,
  sort_order            INTEGER     NOT NULL DEFAULT 0,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  effective_from        DATE        NOT NULL DEFAULT CURRENT_DATE,
  effective_until       DATE,
  created_by            UUID        NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_competency_micro UNIQUE (competency_id, micro_competency_id)
);
```

### 5.9 map_role_competency  *(primary EI scoring join)*
```sql
CREATE TABLE map_role_competency (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id                 UUID        NOT NULL REFERENCES ont_roles(id),
  competency_id           UUID        NOT NULL REFERENCES ont_competencies(id),
  required_level_code     VARCHAR(20) NOT NULL REFERENCES ref_proficiency_levels(code),
  weight                  NUMERIC(5,4) NOT NULL DEFAULT 0.1000
                                       CHECK (weight BETWEEN 0 AND 1),
  is_core                 BOOLEAN     NOT NULL DEFAULT false,
  gap_priority_modifier   NUMERIC(4,3) NOT NULL DEFAULT 1.000
                                       CHECK (gap_priority_modifier BETWEEN 0.1 AND 3.0),
  sort_order              INTEGER     NOT NULL DEFAULT 0,
  is_active               BOOLEAN     NOT NULL DEFAULT true,
  effective_from          DATE        NOT NULL DEFAULT CURRENT_DATE,
  effective_until         DATE,
  created_by              UUID        NOT NULL REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_role_competency UNIQUE (role_id, competency_id)
);
```

### 5.10 map_role_micro_competency  *(granular assessment targeting)*
```sql
CREATE TABLE map_role_micro_competency (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id               UUID        NOT NULL REFERENCES ont_roles(id),
  micro_competency_id   UUID        NOT NULL REFERENCES ont_micro_competencies(id),
  target_level_code     VARCHAR(20) NOT NULL REFERENCES ref_proficiency_levels(code),
  is_differentiating    BOOLEAN     NOT NULL DEFAULT false,  -- differentiates high/low performers
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  effective_from        DATE        NOT NULL DEFAULT CURRENT_DATE,
  effective_until       DATE,
  created_by            UUID        NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_role_micro UNIQUE (role_id, micro_competency_id)
);
```

### 5.11 map_competency_concern  *(CAPADEX bridge)*
```sql
-- Connects the competency spine to the signal/concern spine
-- A concern (behavioural issue) is a root-cause gap driver for a competency

CREATE TABLE map_competency_concern (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id   UUID        NOT NULL REFERENCES ont_competencies(id),
  concern_id      UUID        NOT NULL REFERENCES ont_concerns(id),
  relationship    VARCHAR(20) NOT NULL
                              CHECK (relationship IN ('blocks','reduces','indicates','correlates')),
  strength        NUMERIC(4,3) NOT NULL DEFAULT 0.500
                               CHECK (strength BETWEEN 0 AND 1),
  evidence_source VARCHAR(30) NOT NULL DEFAULT 'expert_curated'
                              CHECK (evidence_source IN ('platform_data','expert_curated','research','inferred')),
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  effective_from  DATE        NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  created_by      UUID        NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_competency_concern UNIQUE (competency_id, concern_id, relationship)
);
```

### 5.12 map_micro_competency_concern
```sql
-- Granular concern↔micro-competency linkage
-- A concern's behavioural expression often maps to a specific micro-competency gap

CREATE TABLE map_micro_competency_concern (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  micro_competency_id   UUID        NOT NULL REFERENCES ont_micro_competencies(id),
  concern_id            UUID        NOT NULL REFERENCES ont_concerns(id),
  relationship          VARCHAR(20) NOT NULL
                                    CHECK (relationship IN ('blocks','reduces','indicates','correlates')),
  strength              NUMERIC(4,3) NOT NULL DEFAULT 0.500
                                     CHECK (strength BETWEEN 0 AND 1),
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  effective_from        DATE        NOT NULL DEFAULT CURRENT_DATE,
  effective_until       DATE,
  created_by            UUID        NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_micro_concern UNIQUE (micro_competency_id, concern_id)
);
```

### 5.13 map_question_micro_competency  *(primary competency-spine join)*
```sql
CREATE TABLE map_question_micro_competency (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id           UUID        NOT NULL REFERENCES ont_questions(id),
  micro_competency_id   UUID        NOT NULL REFERENCES ont_micro_competencies(id),
  is_primary            BOOLEAN     NOT NULL DEFAULT true,   -- one primary per question
  discrimination_index  NUMERIC(4,3),   -- IRT discrimination (if calibrated)
  difficulty_index      NUMERIC(4,3),   -- IRT difficulty (if calibrated)
  information_value     NUMERIC(4,3),   -- item information at target theta
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  effective_from        DATE        NOT NULL DEFAULT CURRENT_DATE,
  effective_until       DATE,
  created_by            UUID        NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_question_micro UNIQUE (question_id, micro_competency_id)
);
```

### 5.14 map_question_concern  *(CAPADEX-spine join)*
```sql
CREATE TABLE map_question_concern (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     UUID        NOT NULL REFERENCES ont_questions(id),
  concern_id      UUID        NOT NULL REFERENCES ont_concerns(id),
  is_primary      BOOLEAN     NOT NULL DEFAULT true,
  bridge_tag      VARCHAR(100) NOT NULL,   -- must match concern.relational_bridge_tag
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  effective_from  DATE        NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  created_by      UUID        NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_question_concern UNIQUE (question_id, concern_id)
);
```

### 5.15 map_question_indicator
```sql
CREATE TABLE map_question_indicator (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     UUID        NOT NULL REFERENCES ont_questions(id),
  indicator_id    UUID        NOT NULL REFERENCES ont_indicators(id),
  response_value  JSONB,      -- which response value(s) trigger this indicator
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  effective_from  DATE        NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  created_by      UUID        NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_question_indicator UNIQUE (question_id, indicator_id)
);
```

### 5.16 map_competency_level_anchors  *(per-role proficiency anchors)*
```sql
-- Defines behavioural anchors at each proficiency level for a competency,
-- potentially role-specific (role_id null = universal anchor)

CREATE TABLE map_competency_level_anchors (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id         UUID        NOT NULL REFERENCES ont_competencies(id),
  proficiency_level_code VARCHAR(20) NOT NULL REFERENCES ref_proficiency_levels(code),
  role_id               UUID        REFERENCES ont_roles(id),  -- null = universal
  behavioural_anchors   TEXT[]      NOT NULL,   -- 3–6 observable anchors
  sample_evidence       TEXT[],                 -- 2–5 example evidence statements
  learning_actions      TEXT[],                 -- 2–5 development actions to advance
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  version               INTEGER     NOT NULL DEFAULT 1,
  created_by            UUID        NOT NULL REFERENCES users(id),
  updated_by            UUID        NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_competency_level_role UNIQUE (competency_id, proficiency_level_code, role_id),
  CONSTRAINT chk_behavioural_anchors CHECK (array_length(behavioural_anchors, 1) BETWEEN 3 AND 6)
);
```

---

## 6. Version Control Tables

Every version table captures a **point-in-time snapshot** when a published entity changes. These tables are **strictly append-only** — no UPDATE or DELETE ever.

### 6.1 ver_competency_snapshots
```sql
CREATE TABLE ver_competency_snapshots (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id     UUID        NOT NULL REFERENCES ont_competencies(id),
  version           INTEGER     NOT NULL,
  snapshot_data     JSONB       NOT NULL,  -- full ont_competencies row at this version
  change_summary    TEXT        NOT NULL,  -- human-readable change description
  changed_fields    TEXT[]      NOT NULL,  -- list of field names that changed
  changed_by        UUID        NOT NULL REFERENCES users(id),
  change_reason     TEXT,                  -- required for published→published changes
  snapshotted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_competency_version UNIQUE (competency_id, version)
);
-- NO UPDATE, NO DELETE EVER ON THIS TABLE
```

### 6.2 ver_micro_competency_snapshots
```sql
CREATE TABLE ver_micro_competency_snapshots (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  micro_competency_id   UUID        NOT NULL REFERENCES ont_micro_competencies(id),
  version               INTEGER     NOT NULL,
  snapshot_data         JSONB       NOT NULL,
  change_summary        TEXT        NOT NULL,
  changed_fields        TEXT[]      NOT NULL,
  changed_by            UUID        NOT NULL REFERENCES users(id),
  change_reason         TEXT,
  snapshotted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_micro_version UNIQUE (micro_competency_id, version)
);
```

### 6.3 ver_question_snapshots
```sql
CREATE TABLE ver_question_snapshots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     UUID        NOT NULL REFERENCES ont_questions(id),
  version         INTEGER     NOT NULL,
  snapshot_data   JSONB       NOT NULL,  -- includes response_options at time of snapshot
  change_summary  TEXT        NOT NULL,
  changed_fields  TEXT[]      NOT NULL,
  changed_by      UUID        NOT NULL REFERENCES users(id),
  change_reason   TEXT,
  snapshotted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_question_version UNIQUE (question_id, version)
);
```

### 6.4 ver_role_competency_profiles
```sql
-- Snapshot of the full role→competency requirement profile at each version change
CREATE TABLE ver_role_competency_profiles (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         UUID        NOT NULL REFERENCES ont_roles(id),
  role_version    INTEGER     NOT NULL,
  profile_data    JSONB       NOT NULL,
  -- { competencies: [{ id, code, required_level, weight, is_core }], layer_weights: {} }
  change_summary  TEXT        NOT NULL,
  changed_by      UUID        NOT NULL REFERENCES users(id),
  change_reason   TEXT,
  snapshotted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_role_profile_version UNIQUE (role_id, role_version)
);
```

### 6.5 ver_concern_snapshots
```sql
CREATE TABLE ver_concern_snapshots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  concern_id      UUID        NOT NULL REFERENCES ont_concerns(id),
  version         INTEGER     NOT NULL,
  snapshot_data   JSONB       NOT NULL,
  change_summary  TEXT        NOT NULL,
  changed_fields  TEXT[]      NOT NULL,
  changed_by      UUID        NOT NULL REFERENCES users(id),
  change_reason   TEXT,                  -- required if relational_bridge_tag changed
  snapshotted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_concern_version UNIQUE (concern_id, version)
);
```

### 6.6 ver_mapping_snapshots
```sql
-- Captures effective-dating history for all map_ table changes
CREATE TABLE ver_mapping_snapshots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  map_table       VARCHAR(60) NOT NULL,   -- e.g. 'map_role_competency'
  map_row_id      UUID        NOT NULL,
  action          VARCHAR(10) NOT NULL CHECK (action IN ('add','remove','modify')),
  before_data     JSONB,
  after_data      JSONB,
  changed_by      UUID        NOT NULL REFERENCES users(id),
  change_reason   TEXT,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ver_mapping_table_row ON ver_mapping_snapshots(map_table, map_row_id);
```

---

## 7. Governance Tables

### 7.1 gov_change_requests
```sql
CREATE TABLE gov_change_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_code    VARCHAR(30) NOT NULL UNIQUE,  -- auto-generated: CHG-2026-001234
  title           VARCHAR(200) NOT NULL,
  description     TEXT        NOT NULL,
  change_type     VARCHAR(30) NOT NULL
                              CHECK (change_type IN (
                                'new_entity',       -- add new row to any ont_ table
                                'edit_published',   -- change published entity
                                'bridge_tag_change',-- high-impact concern bridge change
                                'weight_change',    -- EI/scoring weight change
                                'bulk_import',      -- import affecting > 50 rows
                                'deprecate',        -- mark for deprecation
                                'archive'           -- retire entity
                              )),
  target_table    VARCHAR(60) NOT NULL,
  target_entity_id UUID,               -- null for new_entity requests
  target_entity_code VARCHAR(60),
  priority        VARCHAR(10) NOT NULL DEFAULT 'normal'
                              CHECK (priority IN ('low','normal','high','critical')),
  requires_dual_approval BOOLEAN NOT NULL DEFAULT false,  -- high-impact changes
  requester_id    UUID        NOT NULL REFERENCES users(id),
  status          VARCHAR(30) NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','in_review','approved','rejected','implemented','withdrawn')),
  proposed_changes JSONB      NOT NULL,   -- structured diff of intended changes
  impact_summary  TEXT,
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,
  implemented_at  TIMESTAMPTZ
);
```

### 7.2 gov_approvals
```sql
CREATE TABLE gov_approvals (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  change_request_id UUID        NOT NULL REFERENCES gov_change_requests(id),
  approver_id       UUID        NOT NULL REFERENCES users(id),
  approver_role     VARCHAR(30) NOT NULL,  -- role at time of approval
  approval_round    SMALLINT    NOT NULL DEFAULT 1,  -- 1=maker, 2=checker (dual approval)
  decision          VARCHAR(10) NOT NULL CHECK (decision IN ('approved','rejected','abstained')),
  decision_note     TEXT,
  decided_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_change_approver_round UNIQUE (change_request_id, approver_id, approval_round)
);
```

### 7.3 gov_impact_assessments
```sql
CREATE TABLE gov_impact_assessments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  change_request_id UUID        NOT NULL REFERENCES gov_change_requests(id),
  assessed_by       UUID        NOT NULL REFERENCES users(id),  -- system or human
  assessment_type   VARCHAR(20) NOT NULL
                                CHECK (assessment_type IN ('automated','human_review')),
  downstream_tables TEXT[]      NOT NULL,  -- tables impacted by this change
  affected_row_count INTEGER    NOT NULL DEFAULT 0,
  affects_scoring   BOOLEAN     NOT NULL DEFAULT false,  -- will trigger EI recalc
  affects_active_sessions BOOLEAN NOT NULL DEFAULT false,
  risk_level        VARCHAR(10) NOT NULL DEFAULT 'low'
                                CHECK (risk_level IN ('low','medium','high','critical')),
  impact_detail     JSONB       NOT NULL,  -- per-table impact breakdown
  migration_script  TEXT,                  -- SQL migration if required
  rollback_script   TEXT,                  -- rollback SQL
  assessed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 7.4 gov_ontology_health
```sql
-- Point-in-time health snapshot of the ontology graph
-- Written by automated nightly job + on-demand

CREATE TABLE gov_ontology_health (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_type             VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                                        CHECK (snapshot_type IN ('scheduled','on_demand','pre_publish')),
  total_industries          INTEGER     NOT NULL DEFAULT 0,
  total_functions           INTEGER     NOT NULL DEFAULT 0,
  total_departments         INTEGER     NOT NULL DEFAULT 0,
  total_role_families       INTEGER     NOT NULL DEFAULT 0,
  total_roles               INTEGER     NOT NULL DEFAULT 0,
  total_layers              INTEGER     NOT NULL DEFAULT 0,
  total_clusters            INTEGER     NOT NULL DEFAULT 0,
  total_competencies        INTEGER     NOT NULL DEFAULT 0,
  total_micro_competencies  INTEGER     NOT NULL DEFAULT 0,
  total_concerns            INTEGER     NOT NULL DEFAULT 0,
  total_indicators          INTEGER     NOT NULL DEFAULT 0,
  total_questions           INTEGER     NOT NULL DEFAULT 0,
  orphan_roles              INTEGER     NOT NULL DEFAULT 0,  -- roles with no competencies
  orphan_competencies       INTEGER     NOT NULL DEFAULT 0,  -- competencies with no questions
  orphan_concerns           INTEGER     NOT NULL DEFAULT 0,  -- concerns with no indicators
  unmapped_bridge_tags      INTEGER     NOT NULL DEFAULT 0,  -- bridge tags not in concerns master
  coverage_pct              NUMERIC(5,2) NOT NULL DEFAULT 0, -- % of roles fully mapped
  issues                    JSONB,                           -- array of { level, entity, message }
  snapshotted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  triggered_by              UUID        REFERENCES users(id)
);
```

---

## 8. Indexes & Constraints

```sql
-- ── TAXONOMY SPINE ──────────────────────────────────────────────────

CREATE INDEX idx_ont_industries_status   ON ont_industries(status);
CREATE INDEX idx_ont_functions_status    ON ont_functions(status);
CREATE INDEX idx_ont_departments_status  ON ont_departments(status);
CREATE INDEX idx_ont_role_families_status ON ont_role_families(status);
CREATE INDEX idx_ont_roles_status        ON ont_roles(status);
CREATE INDEX idx_ont_roles_seniority     ON ont_roles(seniority_level_code);
CREATE INDEX idx_ont_roles_occupation    ON ont_roles(occupation_id);

-- ── COMPETENCY SPINE ─────────────────────────────────────────────────

CREATE INDEX idx_ont_clusters_status        ON ont_competency_clusters(status);
CREATE INDEX idx_ont_competencies_status    ON ont_competencies(status);
CREATE INDEX idx_ont_competencies_is_core   ON ont_competencies(is_core) WHERE is_core = true;
CREATE INDEX idx_ont_competencies_capadex   ON ont_competencies(capadex_bridge_tag)
  WHERE capadex_bridge_tag IS NOT NULL;
CREATE INDEX idx_ont_micro_status           ON ont_micro_competencies(status);

-- ── SIGNAL SPINE ─────────────────────────────────────────────────────

CREATE INDEX idx_ont_concerns_status        ON ont_concerns(status);
CREATE INDEX idx_ont_concerns_bridge_tag    ON ont_concerns(relational_bridge_tag);
CREATE INDEX idx_ont_concerns_domain        ON ont_concerns(domain_code);
CREATE INDEX idx_ont_concerns_legacy_id     ON ont_concerns(legacy_id) WHERE legacy_id IS NOT NULL;
CREATE INDEX idx_ont_indicators_concern     ON ont_indicators(concern_id);
CREATE INDEX idx_ont_indicators_status      ON ont_indicators(status);
CREATE INDEX idx_ont_questions_status       ON ont_questions(status);
CREATE INDEX idx_ont_questions_spine        ON ont_questions(spine, status);
CREATE INDEX idx_ont_questions_dev_stage    ON ont_questions(dev_stage) WHERE dev_stage IS NOT NULL;
CREATE INDEX idx_ont_questions_age          ON ont_questions(age_band_min, age_band_max);

-- ── MAPPING TABLES ───────────────────────────────────────────────────

CREATE INDEX idx_map_ind_func_industry   ON map_industry_function(industry_id);
CREATE INDEX idx_map_ind_func_function   ON map_industry_function(function_id);
CREATE INDEX idx_map_role_comp_role      ON map_role_competency(role_id);
CREATE INDEX idx_map_role_comp_comp      ON map_role_competency(competency_id);
CREATE INDEX idx_map_role_comp_core      ON map_role_competency(role_id) WHERE is_core = true;
CREATE INDEX idx_map_q_micro_question    ON map_question_micro_competency(question_id);
CREATE INDEX idx_map_q_micro_micro       ON map_question_micro_competency(micro_competency_id);
CREATE INDEX idx_map_q_concern_question  ON map_question_concern(question_id);
CREATE INDEX idx_map_q_concern_concern   ON map_question_concern(concern_id);
CREATE INDEX idx_map_q_concern_bridge    ON map_question_concern(bridge_tag);
CREATE INDEX idx_map_comp_concern_comp   ON map_competency_concern(competency_id);
CREATE INDEX idx_map_comp_concern_conc   ON map_competency_concern(concern_id);

-- ── VERSION TABLES ───────────────────────────────────────────────────

CREATE INDEX idx_ver_comp_entity     ON ver_competency_snapshots(competency_id, version DESC);
CREATE INDEX idx_ver_micro_entity    ON ver_micro_competency_snapshots(micro_competency_id, version DESC);
CREATE INDEX idx_ver_q_entity        ON ver_question_snapshots(question_id, version DESC);
CREATE INDEX idx_ver_concern_entity  ON ver_concern_snapshots(concern_id, version DESC);

-- ── GOVERNANCE ───────────────────────────────────────────────────────

CREATE INDEX idx_gov_cr_status       ON gov_change_requests(status);
CREATE INDEX idx_gov_cr_table        ON gov_change_requests(target_table, status);
CREATE INDEX idx_gov_approvals_cr    ON gov_approvals(change_request_id);
CREATE INDEX idx_gov_health_time     ON gov_ontology_health(snapshotted_at DESC);
```

---

## 9. Version Control Rules

### Rule V1 — Immutable Published Codes
```
Once any ont_ entity transitions to status='published', its `code` column
is IMMUTABLE. Any code change requires:
  1. Archive the existing entity
  2. Create a new entity with the new code
  3. Migrate all map_ relationships to the new entity ID
  4. gov_change_request of type='archive' + 'new_entity' (linked pair)
```

### Rule V2 — Snapshot on Every Published Change
```
When a published entity is modified:
  1. INSERT into the corresponding ver_*_snapshots table BEFORE applying the change
  2. Increment ont_entity.version by 1
  3. The snapshot must include: changed_fields[], change_summary, change_reason (required)
  4. The snapshot is APPEND-ONLY — no UPDATE or DELETE on ver_ tables ever
```

### Rule V3 — In-Progress Session Protection
```
When a question is modified while active assessment sessions reference it:
  1. The current question_id remains valid for in-progress sessions
  2. The new version creates a new question row (code + '_V{n}')
  3. The old version's status moves to 'deprecated' (not archived)
  4. New sessions route to the new version only
  5. Reports generated from old-version sessions retain old version snapshot
```

### Rule V4 — Bridge Tag Immutability
```
ont_concerns.relational_bridge_tag is IMMUTABLE after publication.
Changing it requires a gov_change_request of type='bridge_tag_change' with:
  - Dual approval (gov_approvals.approval_round IN (1,2))
  - Impact assessment showing affected clarity questions count
  - Migration script updating all map_question_concern.bridge_tag
  - Re-audit of bridge tag coverage (gov_ontology_health snapshot post-change)
```

### Rule V5 — Weight Sum Invariant
```
After any weight change in a mapping table:
  - map_role_layer: SUM(weight) per role_id must = 1.0 (±0.001)
  - map_layer_cluster: SUM(weight) per layer_id must = 1.0 (±0.001)
  - map_cluster_competency: SUM(weight) per cluster_id must = 1.0 (±0.001)
  - map_competency_micro: SUM(weight) per competency_id must = 1.0 (±0.001)
Enforced at application layer with hard 400 error if sum violated.
EI formula weight_in_ei (ont_competencies): SUM per framework = 1.0 (soft warning only).
```

### Rule V6 — Effective Dating on Mapping Changes
```
Map_ table changes on published entities never UPDATE existing rows:
  1. SET old_row.effective_until = CURRENT_DATE - 1, is_active = false
  2. INSERT new row with effective_from = CURRENT_DATE
  3. Write to ver_mapping_snapshots: action='modify', before_data, after_data
This preserves the full history of role-competency profiles over time.
```

---

## 10. Lifecycle Rules

### Rule L1 — Standard Status Transitions

```
ALLOWED TRANSITIONS:
  draft        → in_review     (any curator/admin)
  in_review    → approved      (content_reviewer or super_admin)
  in_review    → draft         (rejected; rejection_reason required)
  approved     → published     (super_admin only)
  published    → deprecated    (super_admin; entity still queryable, flagged)
  published    → archived      (super_admin; blocked if downstream references exist)
  deprecated   → archived      (super_admin; after sunset date)
  archived     → draft         (super_admin; creates new version, old archived)

FORBIDDEN TRANSITIONS:
  draft → published            (must pass through in_review + approved)
  published → draft            (must archive then re-create)
  archived → published         (must re-draft)
```

### Rule L2 — Publish Guards (must all pass before status→published)

**ont_roles:**
- At least 1 published competency linked via `map_role_competency`
- At least 1 published layer linked via `map_role_layer`
- SUM(map_role_layer.weight) = 1.0

**ont_competencies:**
- At least 3 `positive_indicators` and 3 `development_indicators`
- At least 1 `map_competency_level_anchors` row for `proficiency` level

**ont_micro_competencies:**
- At least 2 `positive_anchors` and 2 `gap_anchors`
- At least 1 published question linked via `map_question_micro_competency`

**ont_concerns:**
- `relational_bridge_tag` must resolve to ≥1 row in `capadex_clarity_questions.master_bridge_tag`
- At least 1 published indicator linked

**ont_questions:**
- `status` always starts as `draft` (never auto-published)
- `response_options` valid if not `open_text`
- Language policy check passes (no disallowed terms)

### Rule L3 — Archive Guards

An entity cannot be archived if:
- Any PUBLISHED entity directly references it via a FK or map_ table
- Any active assessment session uses a question linked to this entity
- For `ont_concerns`: any active CAPADEX session has a live concern reference

### Rule L4 — Cascade Deprecation

When a Competency is deprecated:
1. All `map_question_micro_competency` rows for linked micro-competencies get `effective_until = CURRENT_DATE + 90` (90-day sunset)
2. Admin notification: "X questions will lose their primary competency mapping on {date}"
3. Curator must re-map questions before sunset or they move to `unmapped` status

### Rule L5 — Manual Question Creation Always Draft
```
POST /api/admin/questions → status = 'draft' unconditionally.
No API path or import path auto-publishes a question.
This is a hard rule, not a default.
```

---

## 11. Governance Rules

### Rule G1 — Change Request Mandatory for High-Impact Changes
The following always require a `gov_change_request` before execution:
| Change | Type | Approval |
|--------|------|----------|
| `relational_bridge_tag` change | `bridge_tag_change` | Dual |
| `weight_in_ei` change on published competency | `weight_change` | Dual |
| `map_role_layer.weight` change | `weight_change` | Single |
| Adding/removing core competency from role | `edit_published` | Single |
| Bulk import > 50 rows | `bulk_import` | Single |
| Archiving any published entity | `archive` | Single |
| New Industry, Function, Department seed | `new_entity` | Single |

### Rule G2 — Dual Approval (Maker-Checker)
For `requires_dual_approval = true` change requests:
- `gov_approvals.approval_round = 1` (maker): the requester's manager or a content_reviewer
- `gov_approvals.approval_round = 2` (checker): a super_admin
- maker_id ≠ checker_id ≠ requester_id (three distinct people minimum)

### Rule G3 — Impact Assessment Required Before Bridge Tag Change
Before any `bridge_tag_change` is approved:
- `gov_impact_assessments` row must exist with `assessment_type = 'automated'`
- Must report: affected_clarity_questions count, affected_sessions count, affected_map_question_concern count
- `risk_level` auto-calculated: `critical` if affected_sessions > 0, `high` if affected_clarity_questions > 100

### Rule G4 — Ontology Health Threshold
The automated nightly job must complete with:
- `orphan_roles = 0` (every published role has ≥1 competency)
- `orphan_concerns = 0` (every published concern has ≥1 indicator)
- `unmapped_bridge_tags = 0` (every concern's bridge tag resolves in clarity questions)
- `coverage_pct ≥ 80%` (≥80% of published roles fully mapped end-to-end to questions)

Failures page the super_admin and block new publishes until resolved.

### Rule G5 — Language Policy Enforcement
All `ont_questions.question_text` must pass the language policy check before `in_review`:
- **Disallowed terms**: "suitable for", "not suitable", "should be hired", "will succeed at", "reject", "not a fit"
- **Required framing**: developmental, growth-oriented
- Check runs server-side at every create/update, returns 422 with disallowed term list if failed

### Rule G6 — k-Anonymity on All Benchmark Queries
Any query aggregating `map_role_competency` for scoring or benchmarking must include:
```sql
HAVING COUNT(DISTINCT user_id) >= 30
```
Queries falling below this threshold return `{ suppressed: true }` — never zero.

### Rule G7 — Strengths Never From Signal Magnitude
Concerns with `polarity = 'strength'` in `ont_concerns`:
- Must have `severity_weight = NULL or 0` (enforced by DB constraint)
- Must NEVER appear in concern-signal composites (CAPADEX scoring uses only `polarity = 'concern'` for concern weighting)
- Strength data surfaces ONLY from CSI `positive_factors` / positive longitudinal growth

### Rule G8 — PIL Graph Namespace Protection
Tables named `pil_kg_*` are exclusively owned by the Problem Intelligence Layer.
The existing live Employability graph uses `kg_edges` / `kg_nodes` (bare `kg_*`).
Any new ontology graph materialization in the PIL namespace must use `pil_kg_` prefix.
Bare `kg_*` writes from the ontology pipeline are forbidden.

---

## 12. Crosswalk to Existing Tables

### 12.1 Existing → Ontology Entity Mapping

| Existing Table | Ontology Equivalent | Migration Path |
|----------------|--------------------|-|
| `capadex_concerns_master` | `ont_concerns` | Backfill via `legacy_id` FK; preserve `relational_bridge_tag` as-is |
| `capadex_clarity_questions` | `ont_questions` (spine='concern') | Map via `master_bridge_tag` → `ont_concerns.relational_bridge_tag` → `map_question_concern` |
| `competency_question_templates` | `ont_questions` (spine='competency') | Map via `competency_id` → `map_question_micro_competency` |
| `lbi_domains` | `ont_layers` + `ont_competency_clusters` | LBI domains → clusters under `LAYER_COGNITIVE`; crosswalk via `lbi_domain_crosswalk` col on `ont_competencies` |
| `lbi_questions` | `ont_questions` (spine='competency') | Map to micro_competencies via lbi_domain→cluster→competency→micro chain |
| `occupations` | `ont_roles.occupation_id` | FK crosswalk: `ont_roles.occupation_id` → `occupations.id` |
| `skills` | `ont_micro_competencies` (technical layer) | Technical skills → micro_competencies under `LAYER_TECHNICAL` clusters |
| `competency_library` | `ont_competencies` | Migrate display fields; assign to appropriate cluster |
| `psychometric_question_bank` | `ont_questions` (spine='competency') | Map via psychometric domain → cognitive cluster |

### 12.2 Join Key Preservation

**Critical:** The `capadex_clarity_questions` join works via `master_bridge_tag`, not `concern_id`:
```sql
-- CORRECT join through ontology
SELECT q.*, c.display_label
FROM capadex_clarity_questions cq
JOIN ont_concerns c ON c.relational_bridge_tag = cq.master_bridge_tag
-- ont_concerns.legacy_id can be used to verify the row matches capadex_concerns_master

-- WRONG (0% effective - concern_id is DISJOINT)
JOIN ont_concerns c ON c.legacy_id = cq.concern_id  -- DO NOT USE
```

### 12.3 Migration Sequence
```
Phase 1: Seed ref_ tables (no dependencies)
Phase 2: Seed ont_industries, ont_functions, ont_departments (taxonomy foundation)
Phase 3: Backfill ont_concerns from capadex_concerns_master (preserve legacy_id + bridge_tag)
Phase 4: Seed ont_layers (8 canonical layers above)
Phase 5: Seed ont_competency_clusters, then ont_competencies (linked to clusters)
Phase 6: Seed ont_micro_competencies, then map_competency_micro
Phase 7: Migrate existing questions → ont_questions; build map_question_* rows
Phase 8: Seed ont_indicators; build map_indicator_concern, map_question_indicator
Phase 9: Seed ont_role_families, ont_roles; build taxonomy spine maps
Phase 10: Build map_role_competency (core EI scoring join) per role
Phase 11: Run gov_ontology_health check; fix all orphans
Phase 12: Publish all validated rows; run coverage_pct check ≥ 80%
```

### 12.4 Backward Compatibility
- All existing routes (`/api/concerns/*`, `/api/competency/questions/select`, `/api/capadex/*`) continue reading from their original tables during migration
- After Phase 10, new routes can read from `ont_*` tables
- Dual-write period: writes go to both old and `ont_*` tables simultaneously
- Cutover: old table reads deprecated once `coverage_pct ≥ 80%` and all smoke tests pass
