# MetryxOne Super Admin Platform
## Implementation-Ready Specification v1.0

**Classification:** Engineering Reference Document  
**Date:** 2026-06-10  
**Status:** Design Authority — Stop for Approval Before Build  

---

## Global Conventions (apply to every module)

### Role Definitions
| Role | Code | Scope |
|------|------|-------|
| Super Administrator | `super_admin` | All tenants, all modules, all actions |
| Content Curator | `content_curator` | Create, edit, submit for review; own drafts only |
| Content Reviewer | `content_reviewer` | Approve or reject submitted items; cannot create |
| Org Admin | `org_admin` | Read-only; tenant-scoped data only |
| Viewer | `viewer` | Read-only; own tenant only |

### Universal Status Lifecycle
```
draft → in_review → approved → published → archived
         ↑               ↓
         └── rejected ───┘
```

### Standard API Pattern
```
GET    /api/admin/{module}               list  (paginated)
GET    /api/admin/{module}/:id           single
POST   /api/admin/{module}              create
PUT    /api/admin/{module}/:id          full update
PATCH  /api/admin/{module}/:id          partial update
DELETE /api/admin/{module}/:id          soft-delete (sets status='archived')
POST   /api/admin/{module}/:id/submit   submit draft for review
POST   /api/admin/{module}/:id/approve  approve (reviewer only)
POST   /api/admin/{module}/:id/reject   reject with reason
POST   /api/admin/{module}/:id/publish  publish approved record
POST   /api/admin/{module}/import       multipart/form-data CSV upload
GET    /api/admin/{module}/export.csv   CSV export (all active records)
GET    /api/admin/{module}/template.csv blank import template
```

### Standard Request / Response Envelopes
```typescript
// List response
{ ok: true, data: T[], total: number, page: number, per_page: number }

// Single response
{ ok: true, data: T }

// Create / update response
{ ok: true, data: T, created?: true, updated?: true }

// Error response
{ ok: false, error: string, code: string, field_errors?: Record<string,string> }

// Import response
{ ok: true, inserted: number, updated: number, skipped: number, errors: ImportError[] }
```

### Standard Audit Event Schema
Every write action emits to `admin_audit_log`:
```typescript
{
  id:          uuid,
  module:      string,         // e.g. 'industries'
  entity_id:   string,
  action:      string,         // 'create'|'update'|'delete'|'approve'|'reject'|'publish'|'import'|'export'
  actor_id:    uuid,           // super admin user id
  actor_role:  string,
  old_value:   jsonb | null,   // full previous record on update/delete
  new_value:   jsonb | null,   // full new record
  note:        string | null,  // rejection reason, import file name, etc.
  ip_address:  string,
  created_at:  timestamp
}
```

### Screen Layout Pattern
Every module screen follows this layout:
```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER BAR                                                       │
│ [Module Title]  [Status filter] [Search]  [Import] [Export] [+] │
├─────────────────────────────────────────────────────────────────┤
│ CONTENT AREA                                                     │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │  DATA TABLE  (sortable columns, row actions)              │   │
│ │  [col1] [col2] [col3] ... [Status badge] [Actions]        │   │
│ └───────────────────────────────────────────────────────────┘   │
│ Pagination: ← 1 2 3 ... 12 →  Showing 1-25 of 287              │
├─────────────────────────────────────────────────────────────────┤
│ SLIDE-OVER / DRAWER  (open on row click or + button)            │
│ [Form fields]  [Audit trail tab]  [Related items tab]           │
│                     [Cancel] [Save Draft] [Submit for Review]   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Module 01 — Industries

### 1. Navigation Structure
```
Super Admin Dashboard
└── Taxonomy
    └── Industries  [M01]
        ├── All Industries (default tab)
        ├── Pending Review
        └── Archived
```

### 2. Screen Layout
- **Header:** "Industries" · Status filter (All / Draft / In Review / Published / Archived) · Search by name or code · `[Import CSV]` `[Export CSV]` `[+ New Industry]`
- **Table columns:** Code · Name · Parent Sector · Sub-industries count · Roles count · Status · Last updated · Actions
- **Drawer fields:** see §3
- **Tabs in drawer:** Details · Related Functions · Roles Count · Audit Trail

### 3. Fields
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID | auto | PK |
| `code` | VARCHAR(20) | ✓ | Uppercase, alphanumeric + `_`, unique, immutable after publish |
| `name` | VARCHAR(120) | ✓ | Unique (case-insensitive), min 3 chars |
| `display_name` | VARCHAR(180) | ✓ | User-facing label |
| `parent_sector` | VARCHAR(120) | — | Broad grouping (e.g. "Technology", "Financial Services") |
| `description` | TEXT | — | Max 800 chars |
| `isco_code` | VARCHAR(10) | — | ISCO-08 / O*NET cross-reference code |
| `esco_uri` | VARCHAR(255) | — | ESCO taxonomy URI |
| `is_active` | BOOLEAN | ✓ | Default true |
| `status` | ENUM | ✓ | draft / in_review / approved / published / archived |
| `sort_order` | INTEGER | — | Display order, default 0 |
| `created_by` | UUID | auto | FK → users |
| `updated_by` | UUID | auto | FK → users |
| `created_at` | TIMESTAMP | auto | |
| `updated_at` | TIMESTAMP | auto | |

### 4. Permissions
| Action | super_admin | content_curator | content_reviewer | org_admin | viewer |
|--------|:-----------:|:---------------:|:----------------:|:---------:|:------:|
| View all | ✓ | ✓ | ✓ | ✓ (published) | ✓ (published) |
| Create / Edit draft | ✓ | ✓ | — | — | — |
| Submit for review | ✓ | ✓ | — | — | — |
| Approve / Reject | ✓ | — | ✓ | — | — |
| Publish | ✓ | — | — | — | — |
| Archive | ✓ | — | — | — | — |
| Import | ✓ | ✓ | — | — | — |
| Export | ✓ | ✓ | ✓ | ✓ | — |
| Delete (hard) | ✓ | — | — | — | — |

### 5. Approval Workflow
1. Curator creates → status `draft`
2. Curator submits → status `in_review`; email notification to all `content_reviewer` users
3. Reviewer approves → status `approved`; or rejects → back to `draft` with `rejection_reason`
4. Super Admin publishes → status `published`; downstream modules (Functions, Roles) can now reference this industry
5. Archive: only possible if no published Roles or Competencies reference it; system checks before allowing

### 6. Audit Requirements
- Log on: create, update (every field change), status transition, import, export, hard delete
- Retention: 7 years
- Alert: notify super_admin if `code` or `name` changes on a published record

### 7. Import Template (CSV)
```
code,name,display_name,parent_sector,description,isco_code,esco_uri,sort_order
TECH,Technology,Technology & Digital,"Information Services","...",,https://esco.ec.europa.eu/...,1
```
**Rules:** `code` must be unique; existing codes → update; missing required fields → skip with error row

### 8. Export Template (CSV)
```
id,code,name,display_name,parent_sector,description,isco_code,esco_uri,is_active,status,sort_order,created_at,updated_at
```

### 9. API Contracts
```
GET    /api/admin/industries?page=1&per_page=25&status=published&q=tech
GET    /api/admin/industries/:id
POST   /api/admin/industries          body: { code, name, display_name, parent_sector?, description?, isco_code?, esco_uri?, sort_order? }
PUT    /api/admin/industries/:id      body: all fields except id, created_by
PATCH  /api/admin/industries/:id/status  body: { status: 'in_review'|'approved'|'rejected'|'published'|'archived', reason?: string }
POST   /api/admin/industries/import   multipart: file=CSV
GET    /api/admin/industries/export.csv?status=published
GET    /api/admin/industries/template.csv
```

### 10. Validation Rules
- `code`: `^[A-Z][A-Z0-9_]{1,19}$`; unique across all non-archived records
- `name`: min 3, max 120 chars; unique case-insensitive; no leading/trailing whitespace
- `isco_code`: if provided, `^\d{1,4}(-\d+)?$`
- `esco_uri`: if provided, valid HTTPS URI, max 255 chars
- Status transitions: only allowed transitions per workflow (§5); no skip transitions
- Archive guard: `SELECT COUNT(*) FROM roles WHERE industry_code = ? AND status != 'archived'` must be 0

---

## Module 02 — Functions

### 1. Navigation Structure
```
Super Admin Dashboard
└── Taxonomy
    └── Functions  [M02]
        ├── All Functions
        ├── By Industry
        └── Pending Review
```

### 2. Screen Layout
- **Header:** "Functions" · Industry filter dropdown · Status filter · Search · `[Import]` `[Export]` `[+ New Function]`
- **Table columns:** Code · Name · Industry · Departments count · Roles count · Status · Actions
- **Drawer:** Details · Linked Departments · Linked Competencies · Audit Trail

### 3. Fields
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID | auto | |
| `code` | VARCHAR(20) | ✓ | Uppercase, unique per industry |
| `name` | VARCHAR(120) | ✓ | Unique within industry |
| `display_name` | VARCHAR(180) | ✓ | |
| `industry_id` | UUID | ✓ | FK → industries (must be published) |
| `description` | TEXT | — | Max 800 chars |
| `typical_team_size` | ENUM | — | `individual` / `small` / `medium` / `large` / `enterprise` |
| `seniority_range` | JSONB | — | `{ min: 'junior', max: 'executive' }` |
| `key_outputs` | TEXT[] | — | Up to 10 outcome tags |
| `is_active` | BOOLEAN | ✓ | Default true |
| `status` | ENUM | ✓ | Standard lifecycle |
| `sort_order` | INTEGER | — | |
| `created_by`, `updated_by` | UUID | auto | |
| `created_at`, `updated_at` | TIMESTAMP | auto | |

### 4. Permissions
Same matrix as Industries (§01.4). `content_curator` limited to own draft records.

### 5. Approval Workflow
Same lifecycle as Industries. Additional rule: parent Industry must be `published` before Function can be published.

### 6. Audit Requirements
Same as Industries. Additionally: log when `industry_id` changes (impact on downstream departments/roles).

### 7. Import Template (CSV)
```
code,name,display_name,industry_code,description,typical_team_size,sort_order
ENG,Engineering,Engineering & Product,TECH,"...",medium,1
```

### 8. Export Template (CSV)
```
id,code,name,display_name,industry_code,industry_name,description,typical_team_size,is_active,status,sort_order
```

### 9. API Contracts
```
GET    /api/admin/functions?industry_id=&page=&per_page=&status=&q=
GET    /api/admin/functions/:id
POST   /api/admin/functions          body: { code, name, display_name, industry_id, description?, typical_team_size?, sort_order? }
PUT    /api/admin/functions/:id
PATCH  /api/admin/functions/:id/status
POST   /api/admin/functions/import
GET    /api/admin/functions/export.csv
GET    /api/admin/functions/template.csv
```

### 10. Validation Rules
- `code`: unique within the same `industry_id`
- `industry_id`: must reference a `published` industry; validated server-side
- Archive guard: no published Departments or Roles reference this function

---

## Module 03 — Departments

### 1. Navigation Structure
```
Super Admin Dashboard
└── Taxonomy
    └── Departments  [M03]
        ├── All Departments
        ├── By Function
        └── Pending Review
```

### 2. Screen Layout
- **Header:** Industry → Function cascade filter · Status filter · Search · `[Import]` `[Export]` `[+ New]`
- **Table:** Code · Name · Function · Industry · Roles count · Head count range · Status · Actions
- **Drawer:** Details · Linked Roles · Typical Competencies · Audit Trail

### 3. Fields
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID | auto | |
| `code` | VARCHAR(20) | ✓ | Unique within function |
| `name` | VARCHAR(120) | ✓ | |
| `display_name` | VARCHAR(180) | ✓ | |
| `function_id` | UUID | ✓ | FK → functions (published) |
| `industry_id` | UUID | auto | Derived from function.industry_id |
| `description` | TEXT | — | Max 800 chars |
| `cost_centre_type` | ENUM | — | `revenue` / `cost` / `support` / `strategic` |
| `headcount_range` | JSONB | — | `{ min: 1, max: 500 }` |
| `reporting_to` | UUID | — | FK → departments (parent dept) |
| `is_active` | BOOLEAN | ✓ | Default true |
| `status` | ENUM | ✓ | Standard lifecycle |
| `sort_order` | INTEGER | — | |

### 4. Permissions
Same as Industries. Parent Function must be published before Department can be published.

### 5. Approval Workflow
Same lifecycle. Additional: any change to `function_id` re-triggers in_review (because downstream roles may be affected).

### 6. Audit Requirements
Log function_id changes; log when headcount_range changes (used in workforce analytics).

### 7. Import Template (CSV)
```
code,name,display_name,function_code,industry_code,description,cost_centre_type,headcount_min,headcount_max
PROD_ENG,Product Engineering,Product Engineering,ENG,TECH,"...",revenue,10,150
```

### 8. Export Template (CSV)
```
id,code,name,display_name,function_code,function_name,industry_code,cost_centre_type,headcount_min,headcount_max,status
```

### 9. API Contracts
```
GET    /api/admin/departments?function_id=&industry_id=&page=&per_page=&status=&q=
GET    /api/admin/departments/:id
POST   /api/admin/departments
PUT    /api/admin/departments/:id
PATCH  /api/admin/departments/:id/status
POST   /api/admin/departments/import
GET    /api/admin/departments/export.csv
GET    /api/admin/departments/template.csv
```

### 10. Validation Rules
- `code`: unique within same `function_id`
- `function_id`: must be published
- `reporting_to`: if provided, must not create circular reference (server validates up-chain)
- `headcount_range`: min ≥ 1, max ≥ min, max ≤ 100,000

---

## Module 04 — Roles

### 1. Navigation Structure
```
Super Admin Dashboard
└── Taxonomy
    └── Roles  [M04]
        ├── All Roles
        ├── By Department
        ├── By Seniority
        └── Pending Review
```

### 2. Screen Layout
- **Header:** Industry → Function → Department cascade filter · Seniority filter · Status filter · Search · `[Import]` `[Export]` `[+ New Role]`
- **Table:** Code · Title · Department · Seniority · Career Track · Competency count · EI Target · Status · Actions
- **Drawer tabs:** Definition · Competency Requirements · Occupation Graph Link · Career Paths · Audit Trail

### 3. Fields
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID | auto | |
| `code` | VARCHAR(30) | ✓ | Unique platform-wide, immutable after publish |
| `title` | VARCHAR(180) | ✓ | |
| `alternate_titles` | TEXT[] | — | Up to 5 synonyms |
| `department_id` | UUID | ✓ | FK → departments (published) |
| `function_id` | UUID | auto | Derived |
| `industry_id` | UUID | auto | Derived |
| `seniority_level` | ENUM | ✓ | `intern` / `junior` / `mid` / `senior` / `lead` / `principal` / `manager` / `director` / `vp` / `c_suite` |
| `career_track_id` | UUID | — | FK → career_tracks |
| `occupation_id` | UUID | — | FK → occupations (EI graph) |
| `employment_type` | ENUM | — | `full_time` / `part_time` / `contract` / `freelance` |
| `description` | TEXT | — | Max 1500 chars |
| `responsibilities` | TEXT[] | — | Up to 20 bullet points |
| `ei_target_score` | DECIMAL(5,2) | — | 0–100, target EI for this role |
| `min_years_experience` | INTEGER | — | ≥ 0 |
| `isco_code` | VARCHAR(10) | — | |
| `esco_code` | VARCHAR(20) | — | |
| `is_leadership` | BOOLEAN | ✓ | Default false |
| `is_active` | BOOLEAN | ✓ | Default true |
| `status` | ENUM | ✓ | Standard lifecycle |

### 4. Permissions
| Action | super_admin | content_curator | content_reviewer | org_admin |
|--------|:-----------:|:---------------:|:----------------:|:---------:|
| View published | ✓ | ✓ | ✓ | ✓ |
| Create / Edit | ✓ | ✓ | — | — |
| Link to Occupation | ✓ | ✓ | — | — |
| Set EI target | ✓ | — | — | — |
| Approve / Publish | ✓ | — | ✓ | — |

### 5. Approval Workflow
Same lifecycle. Roles with `ei_target_score` set require super_admin approval before publish (score sets a platform-level benchmark — high impact). Org Admins can request a role mapping to an existing published role (does not trigger re-review).

### 6. Audit Requirements
- Log every competency requirement add/remove
- Log EI target score changes (before/after value)
- Log occupation_id linkage changes

### 7. Import Template (CSV)
```
code,title,department_code,function_code,industry_code,seniority_level,description,ei_target_score,is_leadership,min_years_experience
SWE_MID,Software Engineer (Mid),PROD_ENG,ENG,TECH,mid,"...",65,false,3
```

### 8. Export Template (CSV)
```
id,code,title,department_code,function_code,industry_code,seniority_level,career_track_code,occupation_id,ei_target_score,is_leadership,min_years_experience,status
```

### 9. API Contracts
```
GET    /api/admin/roles?department_id=&seniority_level=&career_track_id=&q=&page=&per_page=
GET    /api/admin/roles/:id
POST   /api/admin/roles
PUT    /api/admin/roles/:id
PATCH  /api/admin/roles/:id/status
POST   /api/admin/roles/:id/competencies          body: { competency_id, required_level, weight }
DELETE /api/admin/roles/:id/competencies/:cid
POST   /api/admin/roles/import
GET    /api/admin/roles/export.csv
GET    /api/admin/roles/template.csv
```

### 10. Validation Rules
- `code`: `^[A-Z][A-Z0-9_]{1,29}$`; unique, immutable after first publish
- `seniority_level`: must be in the defined enum
- `ei_target_score`: 0.00–100.00; if set, triggers super_admin approval gate
- `min_years_experience`: integer 0–50
- Publish guard: at least 1 published Competency must be linked before role can be published

---

## Module 05 — Career Tracks

### 1. Navigation Structure
```
Super Admin Dashboard
└── Taxonomy
    └── Career Tracks  [M05]
        ├── All Tracks
        ├── By Industry
        └── Progression Maps
```

### 2. Screen Layout
- **Header:** Industry filter · Track type filter · `[Import]` `[Export]` `[+ New Track]`
- **Table:** Code · Name · Type · Industry · Levels count · Roles count · Status · Actions
- **Drawer tabs:** Track Definition · Levels & Milestones · Linked Roles · Progression Rules · Audit Trail

### 3. Fields
**Track:**
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID | auto | |
| `code` | VARCHAR(30) | ✓ | Unique, immutable after publish |
| `name` | VARCHAR(120) | ✓ | |
| `track_type` | ENUM | ✓ | `technical` / `managerial` / `specialist` / `entrepreneurial` / `cross_functional` |
| `industry_id` | UUID | — | If null, applies to all industries |
| `description` | TEXT | — | Max 1000 chars |
| `entry_seniority` | ENUM | ✓ | Minimum seniority_level to enter this track |
| `max_levels` | INTEGER | ✓ | 2–12 |
| `progression_basis` | ENUM | ✓ | `time_based` / `competency_based` / `performance_based` / `hybrid` |
| `status` | ENUM | ✓ | Standard lifecycle |

**Track Level (child rows):**
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID | auto | |
| `track_id` | UUID | ✓ | FK → career_tracks |
| `level_number` | INTEGER | ✓ | 1..max_levels, unique within track |
| `label` | VARCHAR(80) | ✓ | e.g. "Associate", "Senior", "Staff" |
| `seniority_level` | ENUM | ✓ | Must be ≥ track.entry_seniority |
| `min_months` | INTEGER | — | Minimum tenure at this level |
| `ei_threshold` | DECIMAL(5,2) | — | Minimum EI to advance |
| `competency_gates` | JSONB | — | `[{ competency_id, min_score }]` |

### 4. Permissions
Same as Roles. Competency gates on levels require `content_reviewer` approval before publish.

### 5. Approval Workflow
Same lifecycle. Changing `max_levels` on a published track is blocked if Roles already reference track levels — must be archived and re-created.

### 6. Audit Requirements
Log every level add/remove/change, every competency gate change, every progression_basis change.

### 7. Import Template (CSV)
**Tracks:**
```
code,name,track_type,industry_code,description,entry_seniority,max_levels,progression_basis
IC_TECH,Individual Contributor Tech,technical,TECH,"...",junior,8,hybrid
```
**Levels (separate file):**
```
track_code,level_number,label,seniority_level,min_months,ei_threshold
IC_TECH,1,Associate Engineer,junior,12,50
IC_TECH,2,Engineer,mid,18,60
```

### 8. Export Template (CSV)
Tracks + Levels as two separate sheets / files.

### 9. API Contracts
```
GET    /api/admin/career-tracks?industry_id=&track_type=&q=&page=&per_page=
GET    /api/admin/career-tracks/:id
POST   /api/admin/career-tracks
PUT    /api/admin/career-tracks/:id
PATCH  /api/admin/career-tracks/:id/status
GET    /api/admin/career-tracks/:id/levels
POST   /api/admin/career-tracks/:id/levels     body: { level_number, label, seniority_level, min_months?, ei_threshold? }
PUT    /api/admin/career-tracks/:id/levels/:lid
DELETE /api/admin/career-tracks/:id/levels/:lid
POST   /api/admin/career-tracks/import
GET    /api/admin/career-tracks/export.csv
GET    /api/admin/career-tracks/template.csv
```

### 10. Validation Rules
- `max_levels`: integer 2–12; levels cannot exceed this count
- `level_number`: sequential 1..max_levels; no gaps
- `ei_threshold`: if set, 0–100; must be ≥ previous level's threshold (monotone)
- `progression_basis = 'competency_based'`: at least one competency_gate required per level
- Publish guard: all levels 1..max_levels must exist before track can be published

---

## Module 06 — Competencies

### 1. Navigation Structure
```
Super Admin Dashboard
└── Assessment
    └── Competencies  [M06]
        ├── All Competencies
        ├── By Framework
        ├── By Dimension
        └── Pending Review
```

### 2. Screen Layout
- **Header:** Framework filter · Dimension filter · Status filter · Search · `[Import]` `[Export]` `[+ New Competency]`
- **Table:** Code · Name · Framework · Dimension · Levels defined · Questions count · Status · Actions
- **Drawer tabs:** Definition · Levels · Mapped Roles · Indicators · Audit Trail

### 3. Fields
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID | auto | |
| `code` | VARCHAR(30) | ✓ | Unique per framework, immutable after publish |
| `name` | VARCHAR(150) | ✓ | |
| `display_name` | VARCHAR(200) | ✓ | |
| `framework_id` | UUID | ✓ | FK → competency_frameworks |
| `dimension` | VARCHAR(80) | ✓ | Dimension within framework |
| `category` | ENUM | ✓ | `cognitive` / `behavioural` / `technical` / `leadership` / `social` / `digital` / `adaptive` |
| `description` | TEXT | ✓ | Max 1500 chars |
| `positive_indicators` | TEXT[] | ✓ | 3–10 observable positive behaviours |
| `development_indicators` | TEXT[] | ✓ | 3–10 development-focus behaviours |
| `is_core` | BOOLEAN | ✓ | Default false (core competencies appear in all assessments) |
| `is_leadership` | BOOLEAN | ✓ | Default false |
| `weight_in_ei` | DECIMAL(5,4) | — | Contribution to EI formula (0–1, sum across framework = 1.0) |
| `status` | ENUM | ✓ | Standard lifecycle |
| `version` | INTEGER | auto | Increments on update to published record |

### 4. Permissions
| Action | super_admin | content_curator | content_reviewer |
|--------|:-----------:|:---------------:|:----------------:|
| View | ✓ | ✓ | ✓ |
| Create / Edit | ✓ | ✓ | — |
| Set `weight_in_ei` | ✓ | — | — |
| Set `is_core` | ✓ | — | — |
| Approve / Publish | ✓ | — | ✓ |

### 5. Approval Workflow
Same lifecycle. Changing `positive_indicators` or `development_indicators` on a published competency creates a new version (old version retained for historical scoring). Changing `weight_in_ei` on a published record triggers EI recalculation flag on next snapshot.

### 6. Audit Requirements
- Version every published change
- Log `weight_in_ei` changes with before/after
- Log `is_core` toggles with actor

### 7. Import Template (CSV)
```
code,name,display_name,framework_code,dimension,category,description,is_core,is_leadership,positive_indicators_1..10,development_indicators_1..10
CRIT_THINK,Critical Thinking,Critical Thinking & Analysis,LBI,Cognitive,cognitive,"...",false,false,"Analyses complex problems","Seeks evidence before deciding","..."
```

### 8. Export Template (CSV)
```
id,code,name,framework_code,dimension,category,is_core,is_leadership,weight_in_ei,status,version,created_at
```

### 9. API Contracts
```
GET    /api/admin/competencies?framework_id=&dimension=&category=&is_core=&q=&page=&per_page=
GET    /api/admin/competencies/:id
POST   /api/admin/competencies
PUT    /api/admin/competencies/:id
PATCH  /api/admin/competencies/:id/status
GET    /api/admin/competencies/:id/versions     (history of published versions)
POST   /api/admin/competencies/import
GET    /api/admin/competencies/export.csv
GET    /api/admin/competencies/template.csv
```

### 10. Validation Rules
- `code`: unique within framework; `^[A-Z][A-Z0-9_]{1,29}$`
- `positive_indicators`: 3–10 items; each 10–500 chars; no duplicates within array
- `development_indicators`: 3–10 items; each 10–500 chars
- `weight_in_ei`: if set, 0 < value ≤ 1; sum across all competencies in a framework should = 1.0 (soft warning, not hard block)
- Publish guard: at least 3 positive_indicators and 3 development_indicators required

---

## Module 07 — Competency Levels

### 1. Navigation Structure
```
Super Admin Dashboard
└── Assessment
    └── Competency Levels  [M07]
        ├── All Levels
        └── By Competency
```

### 2. Screen Layout
- **Header:** Competency search/select · `[Import]` `[Export]` `[+ Add Level]`
- **Table:** Competency · Level Number · Label · Score Band · Behavioural Anchors count · Status · Actions
- **Drawer:** Level definition, score band, anchors, sample evidence, audit trail

### 3. Fields
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID | auto | |
| `competency_id` | UUID | ✓ | FK → competencies |
| `level_number` | INTEGER | ✓ | 1–5 (most frameworks); unique per competency |
| `label` | VARCHAR(80) | ✓ | e.g. "Foundational", "Developing", "Proficient", "Advanced", "Expert" |
| `score_band_min` | DECIMAL(5,2) | ✓ | 0–100 |
| `score_band_max` | DECIMAL(5,2) | ✓ | score_band_min < score_band_max ≤ 100 |
| `description` | TEXT | ✓ | What it means to be at this level (Max 800 chars) |
| `behavioural_anchors` | TEXT[] | ✓ | 3–6 observable anchors specific to this level |
| `sample_evidence` | TEXT[] | — | 2–5 example evidence statements |
| `learning_actions` | TEXT[] | — | 2–5 development actions to advance to next level |
| `status` | ENUM | ✓ | Standard lifecycle |

### 4. Permissions
Same as Competencies. Level changes on published competencies auto-increment competency version.

### 5. Approval Workflow
Levels are approved as part of their parent competency. A standalone level update (e.g. revising anchors) follows same workflow. Level score bands must be non-overlapping and contiguous for the competency before publish.

### 6. Audit Requirements
Log every anchor/band/description change; version history tied to parent competency version.

### 7. Import Template (CSV)
```
competency_code,level_number,label,score_band_min,score_band_max,description,anchor_1..6,sample_evidence_1..5
CRIT_THINK,1,Foundational,0,40,"Demonstrates basic analytical skills","Identifies obvious problems","..."
CRIT_THINK,2,Developing,40,60,"..."
```

### 8. Export Template (CSV)
```
id,competency_code,competency_name,level_number,label,score_band_min,score_band_max,description,anchors_json,status
```

### 9. API Contracts
```
GET    /api/admin/competency-levels?competency_id=&q=&page=&per_page=
GET    /api/admin/competency-levels/:id
POST   /api/admin/competency-levels         body: { competency_id, level_number, label, score_band_min, score_band_max, description, behavioural_anchors[] }
PUT    /api/admin/competency-levels/:id
PATCH  /api/admin/competency-levels/:id/status
POST   /api/admin/competency-levels/import
GET    /api/admin/competency-levels/export.csv
GET    /api/admin/competency-levels/template.csv
```

### 10. Validation Rules
- `level_number`: 1–5 (configurable per framework); unique within competency
- `score_band_min` < `score_band_max`; bands across all levels must be non-overlapping
- `behavioural_anchors`: 3–6 items, each 20–300 chars
- Contiguity check: level bands must cover 0–100 without gaps before competency can publish

---

## Module 08 — Concerns

### 1. Navigation Structure
```
Super Admin Dashboard
└── CAPADEX
    └── Concerns  [M08]
        ├── Concerns Master (~2,489)
        ├── By Domain
        ├── Bridge Tag Coverage
        └── Pending Review
```

> **Platform note:** Concerns Master already exists (`capadex_concerns_master`, ~2,489 rows). This module manages that table via the admin interface. `concern_id` in this table is DISJOINT from `capadex_clarity_questions.concern_id` — the only working join key is `relational_bridge_tag` → `master_bridge_tag`.

### 2. Screen Layout
- **Header:** Domain filter · Age band filter · Persona filter · Status filter · Search (name/bridge tag) · `[Import]` `[Export]` `[+ New Concern]`
- **Table:** ID · Display Label · Domain · Bridge Tag · Clarity Q count · Signal count · Status · Actions
- **Drawer tabs:** Definition · Bridge Tag Coverage · Clarity Questions · Signal Mappings · Audit Trail

### 3. Fields
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | SERIAL | auto | Immutable; used as system join key |
| `concern_code` | VARCHAR(50) | ✓ | Unique, immutable, snake_case |
| `display_label` | VARCHAR(200) | ✓ | User-facing copy (max 200 chars) |
| `relational_bridge_tag` | VARCHAR(100) | ✓ | Bucket-level join tag; shared with clarity_questions |
| `domain` | VARCHAR(80) | ✓ | Broad domain (e.g. "Self & Identity", "Relationships") |
| `sub_domain` | VARCHAR(80) | — | |
| `concern_type` | ENUM | ✓ | `acute` / `chronic` / `developmental` / `contextual` |
| `age_bands` | TEXT[] | — | Applicable age bands; null = universal |
| `persona_codes` | TEXT[] | — | Applicable personas; null = all |
| `dev_stage_codes` | TEXT[] | — | Development stage codes |
| `polarity` | ENUM | ✓ | `concern` / `strength` / `neutral` |
| `severity_weight` | DECIMAL(4,3) | — | 0–1; used in CSI scoring |
| `is_active` | BOOLEAN | ✓ | Default true |
| `status` | ENUM | ✓ | Standard lifecycle |

### 4. Permissions
| Action | super_admin | content_curator | content_reviewer |
|--------|:-----------:|:---------------:|:----------------:|
| View | ✓ | ✓ | ✓ |
| Create / Edit `relational_bridge_tag` | ✓ | ✓ | — |
| Edit `severity_weight` | ✓ | — | — |
| Approve / Publish | ✓ | — | ✓ |

### 5. Approval Workflow
Standard lifecycle. Changing `relational_bridge_tag` on a published concern is HIGH IMPACT (breaks clarity-question join) — requires super_admin sign-off and triggers a bridge-tag coverage re-audit.

### 6. Audit Requirements
- Log every `relational_bridge_tag` change with full before/after
- Log `severity_weight` changes
- Alert super_admin when bridge tag changes on a concern with >100 linked clarity questions

### 7. Import Template (CSV)
```
concern_code,display_label,relational_bridge_tag,domain,sub_domain,concern_type,age_bands,persona_codes,polarity,severity_weight
identity_self_worth,"Feeling unsure of self-worth",self_identity,Self & Identity,Self-Esteem,chronic,"['15-18','19-24']","['student']",concern,0.750
```

### 8. Export Template (CSV)
```
id,concern_code,display_label,relational_bridge_tag,domain,sub_domain,concern_type,age_bands_json,persona_codes_json,polarity,severity_weight,is_active,status
```

### 9. API Contracts
```
GET    /api/admin/concerns?domain=&concern_type=&polarity=&q=&page=&per_page=
GET    /api/admin/concerns/:id
POST   /api/admin/concerns
PUT    /api/admin/concerns/:id
PATCH  /api/admin/concerns/:id/status
GET    /api/admin/concerns/:id/clarity-questions    (linked via bridge tag)
GET    /api/admin/concerns/:id/signals              (linked signal ontology)
GET    /api/admin/concerns/bridge-coverage          (coverage report by bridge tag)
POST   /api/admin/concerns/import
GET    /api/admin/concerns/export.csv
GET    /api/admin/concerns/template.csv
```

### 10. Validation Rules
- `concern_code`: snake_case, `^[a-z][a-z0-9_]{2,49}$`, unique across non-archived
- `relational_bridge_tag`: snake_case, max 100 chars; must match a tag present in `capadex_clarity_questions.master_bridge_tag` (soft warning if not yet — hard block on publish)
- `severity_weight`: 0.000–1.000
- Polarity `strength` concerns: `severity_weight` must be null or 0 (strengths are not concern-weighted per platform canon)

---

## Module 09 — Indicators

### 1. Navigation Structure
```
Super Admin Dashboard
└── CAPADEX
    └── Indicators  [M09]
        ├── All Indicators
        ├── By Concern
        ├── By Signal Type
        └── Unmapped Indicators
```

### 2. Screen Layout
- **Header:** Concern filter · Signal type filter · Status filter · Search · `[Import]` `[Export]` `[+ New Indicator]`
- **Table:** Code · Label · Concern · Signal Type · Weight · Polarity · Status · Actions
- **Drawer tabs:** Definition · Linked Questions · Signal Ontology Link · Audit Trail

### 3. Fields
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID | auto | |
| `code` | VARCHAR(50) | ✓ | Unique, snake_case |
| `label` | VARCHAR(200) | ✓ | |
| `concern_id` | INTEGER | ✓ | FK → capadex_concerns_master.id |
| `bridge_tag` | VARCHAR(100) | ✓ | Must match concern.relational_bridge_tag |
| `signal_type` | ENUM | ✓ | `behavioural` / `cognitive` / `emotional` / `contextual` / `physiological` |
| `polarity` | ENUM | ✓ | `positive` / `negative` / `neutral` |
| `weight` | DECIMAL(5,4) | ✓ | 0.001–1.000; contribution to concern signal |
| `description` | TEXT | — | Max 600 chars |
| `observable_threshold` | TEXT | — | When is this indicator reliably detectable |
| `age_band_applicability` | TEXT[] | — | null = all age bands |
| `status` | ENUM | ✓ | Standard lifecycle |

### 4. Permissions
Same as Concerns. `weight` changes require content_reviewer approval.

### 5. Approval Workflow
Standard lifecycle. A concern cannot have its last published indicator archived (minimum 1 active indicator per published concern).

### 6. Audit Requirements
Log `weight` changes, `polarity` changes, `concern_id` changes.

### 7. Import Template (CSV)
```
code,label,concern_code,signal_type,polarity,weight,description
avoid_social,Avoidance of social situations,identity_self_worth,behavioural,negative,0.650,"..."
```

### 8. Export Template (CSV)
```
id,code,label,concern_code,bridge_tag,signal_type,polarity,weight,status
```

### 9. API Contracts
```
GET    /api/admin/indicators?concern_id=&signal_type=&polarity=&q=&page=&per_page=
GET    /api/admin/indicators/:id
POST   /api/admin/indicators
PUT    /api/admin/indicators/:id
PATCH  /api/admin/indicators/:id/status
POST   /api/admin/indicators/import
GET    /api/admin/indicators/export.csv
GET    /api/admin/indicators/template.csv
```

### 10. Validation Rules
- `bridge_tag` must equal the parent concern's `relational_bridge_tag` (server validates)
- `weight`: sum of all active indicator weights for a concern should be ≤ 1.0 (soft warning)
- `polarity = 'positive'`: signals are concern-DIAGNOSTIC; positive polarity indicators are evidence of ABSENCE of the concern (never raw strength measurement)

---

## Module 10 — Questions

### 1. Navigation Structure
```
Super Admin Dashboard
└── Assessment
    └── Questions  [M10]
        ├── All Questions
        ├── Competency Questions
        ├── CAPADEX Clarity Questions (~30,638)
        ├── LBI Questions
        ├── Short Assessment Questions
        └── Pending Review
```

### 2. Screen Layout
- **Header:** Question type filter · Framework/module filter · Status filter · Search (full text) · `[Import]` `[Export]` `[+ New Question]`
- **Table:** ID · Text preview (80 chars) · Type · Framework · Dimension · Status · Last used · Actions
- **Drawer tabs:** Question Definition · Response Options · Psychometric Properties · Usage Stats · Audit Trail

### 3. Fields
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID | auto | |
| `question_code` | VARCHAR(50) | ✓ | Unique per framework+type |
| `question_type` | ENUM | ✓ | `competency` / `clarity` / `lbi` / `short_assessment` / `future_skills` / `leadership` |
| `framework_id` | UUID | — | FK → competency_frameworks (for competency/lbi type) |
| `competency_id` | UUID | — | FK → competencies |
| `concern_id` | INTEGER | — | FK → capadex_concerns_master (for clarity type) |
| `master_bridge_tag` | VARCHAR(100) | — | Bucket-level join key (clarity type) |
| `question_text` | TEXT | ✓ | Max 1000 chars; developmental framing only |
| `question_text_short` | VARCHAR(200) | — | Compact version for mobile |
| `response_type` | ENUM | ✓ | `single_select` / `multi_select` / `likert_5` / `likert_7` / `slider` / `text` / `ranking` |
| `response_options` | JSONB | — | Array of `{ value, label, score, polarity }` |
| `polarity` | ENUM | ✓ | `positive` / `negative` / `neutral` |
| `reverse_scored` | BOOLEAN | ✓ | Default false |
| `difficulty` | ENUM | — | `easy` / `medium` / `hard` |
| `dev_stage` | ENUM | — | `exploration` / `establishment` / `advancement` / `leadership` |
| `age_band_min` | INTEGER | — | Minimum age (inclusive) |
| `age_band_max` | INTEGER | — | Maximum age (inclusive) |
| `persona_codes` | TEXT[] | — | null = all personas |
| `language` | VARCHAR(10) | ✓ | ISO 639-1, default `en` |
| `is_active` | BOOLEAN | ✓ | Default true |
| `status` | ENUM | ✓ | Standard lifecycle; manual-create always `draft` |
| `version` | INTEGER | auto | |

### 4. Permissions
| Action | super_admin | content_curator | content_reviewer |
|--------|:-----------:|:---------------:|:----------------:|
| View all | ✓ | ✓ | ✓ |
| Create (always draft) | ✓ | ✓ | — |
| Edit published (creates new version) | ✓ | ✓ | — |
| Approve / Publish | ✓ | — | ✓ |
| Retire / Archive | ✓ | — | — |

### 5. Approval Workflow
Standard lifecycle. Published question changes always create a new version; old version retained for sessions already in progress. Questions with `status = 'draft'` are never served to end users.

### 6. Audit Requirements
- Version every publish event
- Log age/persona changes (impacts user eligibility)
- Alert if a question is removed from active pool while in-flight sessions reference it

### 7. Import Template (CSV)
```
question_code,question_type,framework_code,competency_code,question_text,response_type,polarity,reverse_scored,difficulty,dev_stage,age_band_min,age_band_max,options_json
CT_Q001,competency,LBI,CRIT_THINK,"I approach problems by gathering evidence before deciding",likert_5,positive,false,medium,establishment,18,65,"[{\"value\":1,\"label\":\"Strongly Disagree\",\"score\":1,\"polarity\":\"negative\"}...]"
```

### 8. Export Template (CSV)
```
id,question_code,question_type,framework_code,competency_code,question_text,response_type,polarity,reverse_scored,dev_stage,age_band_min,age_band_max,status,version
```

### 9. API Contracts
```
GET    /api/admin/questions?question_type=&framework_id=&competency_id=&concern_id=&status=&q=&page=&per_page=
GET    /api/admin/questions/:id
GET    /api/admin/questions/:id/versions
POST   /api/admin/questions                   body: always creates status='draft'
PUT    /api/admin/questions/:id
PATCH  /api/admin/questions/:id/status
GET    /api/admin/questions/select?competency_id=&dev_stage=&age=&persona= (public endpoint for assessment delivery)
POST   /api/admin/questions/import
GET    /api/admin/questions/export.csv
GET    /api/admin/questions/template.csv
```

### 10. Validation Rules
- Manual POST always creates `status = 'draft'`; never auto-publish
- `question_text`: no hiring/suitability language (server-side language policy check against disallowed term list)
- `response_options`: required for all types except `text`; each option must have unique `value`; `score` must be numeric
- `reverse_scored = true`: response options scores must be in descending order of `value`
- Clarity questions: `master_bridge_tag` must exist in `capadex_concerns_master.relational_bridge_tag`

---

## Module 11 — Assessments

### 1. Navigation Structure
```
Super Admin Dashboard
└── Assessment
    └── Assessments  [M11]
        ├── All Assessments
        ├── Active Configurations
        ├── Assessment Modules
        └── Session Analytics
```

### 2. Screen Layout
- **Header:** Assessment type filter · Status filter · Search · `[Import Config]` `[Export Config]` `[+ New Assessment]`
- **Table:** Code · Name · Type · Framework · Question count · Avg duration · Active sessions · Status · Actions
- **Drawer tabs:** Configuration · Question Selection · Branching Logic · Scoring Configuration · Preview · Audit Trail

### 3. Fields
**Assessment Configuration:**
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID | auto | |
| `code` | VARCHAR(40) | ✓ | Unique, immutable after first use |
| `name` | VARCHAR(150) | ✓ | |
| `assessment_type` | ENUM | ✓ | `competency` / `capadex` / `lbi` / `sdi` / `short` / `future_skills` / `leadership` / `360` |
| `framework_id` | UUID | — | FK → competency_frameworks |
| `description` | TEXT | — | Max 1000 chars |
| `instruction_text` | TEXT | — | Pre-assessment instructions, max 2000 chars |
| `time_limit_minutes` | INTEGER | — | null = untimed |
| `question_selection` | ENUM | ✓ | `fixed` / `adaptive` / `random_stratified` |
| `question_count` | INTEGER | ✓ | Total questions to deliver |
| `question_pool` | JSONB | ✓ | `[{ competency_id, count, min_difficulty, max_difficulty }]` |
| `branching_rules` | JSONB | — | Conditional routing rules |
| `scoring_rule_id` | UUID | ✓ | FK → scoring_rules |
| `benchmark_id` | UUID | — | FK → benchmarks (for comparative reporting) |
| `persona_restriction` | TEXT[] | — | null = all personas |
| `age_restriction` | JSONB | — | `{ min: 15, max: 65 }` |
| `is_proctored` | BOOLEAN | ✓ | Default false |
| `allows_retake` | BOOLEAN | ✓ | Default true |
| `retake_cooldown_days` | INTEGER | — | Days before retake allowed |
| `is_active` | BOOLEAN | ✓ | Default true |
| `status` | ENUM | ✓ | Standard lifecycle |

### 4. Permissions
| Action | super_admin | content_curator | content_reviewer |
|--------|:-----------:|:---------------:|:----------------:|
| View / Clone | ✓ | ✓ | ✓ |
| Create / Configure | ✓ | ✓ | — |
| Set `scoring_rule_id` | ✓ | ✓ | — |
| Set `is_proctored` | ✓ | — | — |
| Activate (publish) | ✓ | — | ✓ |

### 5. Approval Workflow
Standard lifecycle. Additionally: before publish, system validates that `question_pool` has at least `question_count × 1.5` eligible questions (ensures adaptive selection has a real pool). Branching rules are validated for logical loops before approval.

### 6. Audit Requirements
- Log every question_pool change with before/after counts
- Log retake_cooldown_days changes
- Log activation/deactivation events with timestamp (active sessions count at time of event)

### 7. Import/Export Template
JSON format (too complex for flat CSV):
```json
{
  "code": "LBI_STANDARD_V3",
  "name": "LBI Standard Assessment v3",
  "assessment_type": "lbi",
  "question_count": 40,
  "question_selection": "adaptive",
  "question_pool": [{ "competency_id": "...", "count": 8 }],
  "scoring_rule_id": "..."
}
```

### 8. API Contracts
```
GET    /api/admin/assessments?type=&status=&q=&page=&per_page=
GET    /api/admin/assessments/:id
GET    /api/admin/assessments/:id/preview              (simulated question sequence)
POST   /api/admin/assessments
PUT    /api/admin/assessments/:id
PATCH  /api/admin/assessments/:id/status
POST   /api/admin/assessments/:id/clone                (creates draft copy)
GET    /api/admin/assessments/:id/sessions?date_from=&date_to=
GET    /api/admin/assessments/:id/analytics
POST   /api/admin/assessments/import
GET    /api/admin/assessments/:id/export
GET    /api/admin/assessments/template
```

### 9. Validation Rules
- `question_count`: 5–200
- Pool validation: total questions in pool ≥ question_count × 1.5 (before publish)
- Branching loops: cycle detection on branching_rules graph (BFS/DFS, max depth 20)
- `scoring_rule_id`: must reference a published scoring rule
- `retake_cooldown_days`: if `allows_retake = true` and value null → defaults to 0 (immediate retake)

---

## Module 12 — Scoring Rules

### 1. Navigation Structure
```
Super Admin Dashboard
└── Assessment
    └── Scoring Rules  [M12]
        ├── All Rules
        ├── By Framework
        └── Formula Audit Log
```

### 2. Screen Layout
- **Header:** Framework filter · Rule type filter · `[Import]` `[Export]` `[+ New Rule]`
- **Table:** Code · Name · Framework · Rule Type · Formula summary · Assessments using · Status · Actions
- **Drawer tabs:** Rule Definition · Formula Builder · Normalisation · Confidence Rules · Audit Trail

### 3. Fields
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID | auto | |
| `code` | VARCHAR(40) | ✓ | Unique |
| `name` | VARCHAR(150) | ✓ | |
| `framework_id` | UUID | — | FK → competency_frameworks; null = universal |
| `rule_type` | ENUM | ✓ | `raw_average` / `weighted_average` / `irt_based` / `band_lookup` / `custom_formula` |
| `scoring_formula` | JSONB | ✓ | Declarative formula definition |
| `normalisation` | ENUM | ✓ | `none` / `z_score` / `percentile` / `min_max` |
| `band_definitions` | JSONB | — | `[{ label, min, max, description }]` for band_lookup type |
| `confidence_rules` | JSONB | — | Rules for computing confidence band (e.g. min_responses threshold) |
| `missing_response_handling` | ENUM | ✓ | `exclude` / `median_impute` / `zero` |
| `output_scale` | JSONB | ✓ | `{ min: 0, max: 100, precision: 2 }` |
| `version` | INTEGER | auto | Increment on change to published rule |
| `status` | ENUM | ✓ | Standard lifecycle |

#### Scoring Formula Structure (JSONB)
```json
{
  "type": "weighted_average",
  "components": [
    { "competency_id": "uuid", "weight": 0.25 },
    { "dimension": "cognitive", "weight": 0.35, "aggregation": "mean" }
  ],
  "post_process": ["clamp_0_100", "round_2dp"]
}
```

### 4. Permissions
| Action | super_admin | content_curator | content_reviewer |
|--------|:-----------:|:---------------:|:----------------:|
| View | ✓ | ✓ | ✓ |
| Create / Edit | ✓ | — | — |
| Approve / Publish | ✓ | — | — |
| Change formula on published rule | ✓ only | — | — |

> Scoring rules are **super_admin only** for create/edit. No content_curator access — formula errors are high impact.

### 5. Approval Workflow
Standard lifecycle. Formula changes on published rules: new version created, old version retained for in-progress sessions. EI formula authority remains in `ei-engine.ts`; this module manages per-framework/assessment scoring rules only.

### 6. Audit Requirements
- Version every formula change with full before/after JSONB
- Alert when a scoring rule change affects > 100 already-scored sessions (batch re-score advisory)

### 7. Import/Export Template
JSON only (formula is JSONB, not flat CSV representable).

### 8. API Contracts
```
GET    /api/admin/scoring-rules?framework_id=&rule_type=&q=&page=&per_page=
GET    /api/admin/scoring-rules/:id
GET    /api/admin/scoring-rules/:id/versions
POST   /api/admin/scoring-rules                  (super_admin only)
PUT    /api/admin/scoring-rules/:id              (super_admin only)
PATCH  /api/admin/scoring-rules/:id/status       (super_admin only)
POST   /api/admin/scoring-rules/:id/simulate     body: { sample_responses[] } → simulated score output
GET    /api/admin/scoring-rules/export
GET    /api/admin/scoring-rules/template
```

### 9. Validation Rules
- `scoring_formula`: validated against JSON Schema before save; components must reference valid competency/dimension IDs
- `band_definitions`: bands must be non-overlapping; must cover full output scale; sorted by min ascending
- `output_scale.min < output_scale.max`; max ≤ 10,000
- `normalisation = 'z_score'`: requires population data; cannot publish without a reference population defined
- Formula simulation (POST `/simulate`) is idempotent and does not persist results

---

## Module 13 — Benchmarks

### 1. Navigation Structure
```
Super Admin Dashboard
└── Assessment
    └── Benchmarks  [M13]
        ├── All Benchmarks
        ├── Role Benchmarks
        ├── Cohort Benchmarks
        └── Coverage Dashboard
```

### 2. Screen Layout
- **Header:** Benchmark type filter · Industry filter · Status filter · `[Import]` `[Export]` `[+ New Benchmark]`
- **Table:** Code · Name · Type · Scope · Sample size · k-anon status · Last updated · Status · Actions
- **Drawer tabs:** Benchmark Definition · Score Distributions · Linked Roles · Suppression Status · Audit Trail

### 3. Fields
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID | auto | |
| `code` | VARCHAR(40) | ✓ | Unique |
| `name` | VARCHAR(150) | ✓ | |
| `benchmark_type` | ENUM | ✓ | `role` / `industry` / `function` / `seniority` / `global` / `custom_cohort` |
| `scope_id` | UUID | — | FK → roles/industries/functions depending on type |
| `competency_scores` | JSONB | — | `{ competency_id: { p25, p50, p75, p90, mean, stddev, n } }` |
| `ei_distribution` | JSONB | — | `{ p25, p50, p75, p90, mean, stddev, n, band_distribution: {} }` |
| `sample_size` | INTEGER | auto | Computed from underlying data |
| `k_anonymity_status` | ENUM | auto | `sufficient` / `suppressed` (sample_size < 30) |
| `reference_period` | JSONB | — | `{ from: "2025-01", to: "2026-06" }` |
| `is_normative` | BOOLEAN | ✓ | true = used in EI comparative scoring |
| `data_source` | ENUM | ✓ | `platform_data` / `manual_import` / `external_research` |
| `external_citation` | TEXT | — | If data_source = external_research |
| `status` | ENUM | ✓ | Standard lifecycle |

### 4. Permissions
| Action | super_admin | content_curator | content_reviewer |
|--------|:-----------:|:---------------:|:----------------:|
| View | ✓ | ✓ (published) | ✓ |
| Create / Edit | ✓ | — | — |
| Set `is_normative` | ✓ | — | — |
| Approve / Publish | ✓ | — | — |

> Benchmarks are super_admin only for create/edit. They directly affect EI comparative scoring for all users.

### 5. Approval Workflow
Standard lifecycle. `is_normative` benchmarks require super_admin approval. Benchmarks with `k_anonymity_status = 'suppressed'` cannot be published.

### 6. Audit Requirements
- Log every `competency_scores` or `ei_distribution` update
- Log `is_normative` toggle with full before/after
- Record `sample_size` at every publish event

### 7. Import Template (CSV / JSON)
CSV for manual benchmarks:
```
competency_code,p25,p50,p75,p90,mean,stddev,sample_size
CRIT_THINK,45,62,74,85,61.3,14.2,342
```

### 8. Export Template
```
id,code,name,type,scope,competency_code,p25,p50,p75,p90,mean,stddev,sample_size,k_status,reference_period
```

### 9. API Contracts
```
GET    /api/admin/benchmarks?type=&industry_id=&is_normative=&q=&page=&per_page=
GET    /api/admin/benchmarks/:id
POST   /api/admin/benchmarks            (super_admin only)
PUT    /api/admin/benchmarks/:id        (super_admin only)
PATCH  /api/admin/benchmarks/:id/status (super_admin only)
POST   /api/admin/benchmarks/:id/recompute  (recompute from platform data)
POST   /api/admin/benchmarks/import
GET    /api/admin/benchmarks/export.csv
GET    /api/admin/benchmarks/template.csv
```

### 10. Validation Rules
- `sample_size` < 30 → `k_anonymity_status = 'suppressed'`; cannot publish
- `competency_scores`: for each competency, p25 ≤ p50 ≤ p75 ≤ p90; all values 0–100
- `ei_distribution.band_distribution` values must sum to 1.0 (±0.001 tolerance)
- `is_normative = true`: only ONE active normative benchmark per `benchmark_type + scope_id` (previous normative benchmark auto-demoted to non-normative on publish)

---

## Module 14 — Career Paths

### 1. Navigation Structure
```
Super Admin Dashboard
└── Career Intelligence
    └── Career Paths  [M14]
        ├── All Paths
        ├── By Source Role
        ├── Lateral Moves
        └── Pathway Graph
```

### 2. Screen Layout
- **Header:** Industry filter · Source role filter · Path type filter · `[Import]` `[Export]` `[+ New Path]`
- **Table:** Code · From Role · To Role · Type · Transition cost · Confidence · Status · Actions
- **Drawer tabs:** Path Definition · Transition Requirements · EI Delta · Evidence Base · Audit Trail
- **Pathway Graph tab:** D3 force-directed graph of role-to-role transitions

### 3. Fields
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID | auto | |
| `code` | VARCHAR(40) | ✓ | Unique |
| `from_role_id` | UUID | ✓ | FK → roles (published) |
| `to_role_id` | UUID | ✓ | FK → roles (published); ≠ from_role_id |
| `path_type` | ENUM | ✓ | `promotion` / `lateral` / `pivot` / `return` / `external` |
| `transition_difficulty` | ENUM | ✓ | `easy` / `moderate` / `challenging` / `major_pivot` |
| `estimated_months` | INTEGER | ✓ | 1–120 |
| `required_ei_delta` | DECIMAL(5,2) | — | EI improvement required (can be 0 or negative for lateral) |
| `required_competencies` | JSONB | — | `[{ competency_id, from_level, to_level }]` |
| `required_experiences` | TEXT[] | — | Qualitative experience requirements |
| `evidence_source` | ENUM | ✓ | `platform_data` / `labour_market` / `expert_curated` / `inferred` |
| `confidence_score` | DECIMAL(4,3) | — | 0–1; based on evidence quality |
| `occurrence_count` | INTEGER | auto | How many users have made this transition (platform data) |
| `is_active` | BOOLEAN | ✓ | Default true |
| `status` | ENUM | ✓ | Standard lifecycle |

### 4. Permissions
| Action | super_admin | content_curator | content_reviewer |
|--------|:-----------:|:---------------:|:----------------:|
| View | ✓ | ✓ | ✓ |
| Create / Edit (curated paths) | ✓ | ✓ | — |
| Approve / Publish | ✓ | — | ✓ |
| View `occurrence_count` | ✓ | — | — |

### 5. Approval Workflow
Standard lifecycle. Paths with `evidence_source = 'inferred'` are flagged for prioritised human review. Paths with `confidence_score < 0.3` are suppressed from user-facing recommendations until curator review.

### 6. Audit Requirements
- Log `from_role_id` and `to_role_id` changes (never allow change on published path — must archive and re-create)
- Log `confidence_score` updates

### 7. Import Template (CSV)
```
code,from_role_code,to_role_code,path_type,transition_difficulty,estimated_months,confidence_score,evidence_source
SWE_MID_TO_SWE_SNR,SWE_MID,SWE_SNR,promotion,moderate,18,0.85,platform_data
```

### 8. Export Template (CSV)
```
id,code,from_role_code,from_role_name,to_role_code,to_role_name,path_type,transition_difficulty,estimated_months,confidence_score,status
```

### 9. API Contracts
```
GET    /api/admin/career-paths?from_role_id=&to_role_id=&path_type=&industry_id=&q=&page=&per_page=
GET    /api/admin/career-paths/:id
POST   /api/admin/career-paths
PUT    /api/admin/career-paths/:id
PATCH  /api/admin/career-paths/:id/status
GET    /api/admin/career-paths/graph?industry_id=&function_id=   (D3 graph data)
POST   /api/admin/career-paths/import
GET    /api/admin/career-paths/export.csv
GET    /api/admin/career-paths/template.csv
```

### 10. Validation Rules
- `from_role_id ≠ to_role_id`; no duplicate (from, to) pairs
- Circular promotion chains: warn if > 2 hops create a cycle (soft warning)
- `estimated_months`: 1–120
- `confidence_score`: if `evidence_source = 'platform_data'`, computed from `occurrence_count` (not manual); if `inferred`, manual value required

---

## Module 15 — Learning Paths

### 1. Navigation Structure
```
Super Admin Dashboard
└── Career Intelligence
    └── Learning Paths  [M15]
        ├── All Paths
        ├── By Competency Gap
        ├── By Career Path
        └── Provider Catalogue
```

### 2. Screen Layout
- **Header:** Competency filter · Provider filter · Duration filter · Status filter · `[Import]` `[Export]` `[+ New Path]`
- **Table:** Code · Title · Target Competency · Steps count · Est. hours · Providers · Status · Actions
- **Drawer tabs:** Definition · Steps Sequence · Linked Resources · Outcomes · Audit Trail

### 3. Fields
**Learning Path:**
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID | auto | |
| `code` | VARCHAR(40) | ✓ | Unique |
| `title` | VARCHAR(200) | ✓ | |
| `target_competency_id` | UUID | ✓ | FK → competencies |
| `from_level` | INTEGER | ✓ | 1–4; source competency level |
| `to_level` | INTEGER | ✓ | from_level < to_level ≤ 5 |
| `description` | TEXT | — | Max 1000 chars |
| `estimated_hours` | DECIMAL(6,1) | ✓ | Total learning hours |
| `learning_modality` | ENUM[] | ✓ | `online_self_paced` / `live_online` / `in_person` / `on_the_job` / `coaching` / `reading` |
| `prerequisite_path_ids` | UUID[] | — | FK → learning_paths |
| `status` | ENUM | ✓ | Standard lifecycle |

**Learning Step (child rows):**
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID | auto | |
| `path_id` | UUID | ✓ | FK → learning_paths |
| `step_number` | INTEGER | ✓ | Sequential 1..N |
| `title` | VARCHAR(200) | ✓ | |
| `resource_id` | UUID | — | FK → learning_resources |
| `resource_url` | VARCHAR(500) | — | External URL if no FK |
| `provider_name` | VARCHAR(100) | — | |
| `duration_hours` | DECIMAL(5,1) | ✓ | |
| `is_mandatory` | BOOLEAN | ✓ | Default true |
| `completion_criteria` | ENUM | ✓ | `completion` / `assessment_pass` / `certificate` / `evidence_upload` |

### 4. Permissions
Same as Career Paths. Learning steps can be added by `content_curator`.

### 5. Approval Workflow
Standard lifecycle. Prerequisites must all be published before this path can be published. EI attribution mapping (step → competency credit) reviewed by content_reviewer before publish.

### 6. Audit Requirements
- Log step additions/removals/reorders
- Log provider URL changes

### 7. Import Templates (two CSV files)
**Paths:**
```
code,title,competency_code,from_level,to_level,estimated_hours,description
CRIT_L1_L2,Critical Thinking: Foundation to Developing,CRIT_THINK,1,2,12.5,"..."
```
**Steps:**
```
path_code,step_number,title,resource_url,provider_name,duration_hours,is_mandatory,completion_criteria
CRIT_L1_L2,1,Intro to Analytical Frameworks,https://...,Coursera,2.5,true,completion
```

### 8. Export Templates (Paths + Steps)

### 9. API Contracts
```
GET    /api/admin/learning-paths?competency_id=&from_level=&to_level=&q=&page=&per_page=
GET    /api/admin/learning-paths/:id
POST   /api/admin/learning-paths
PUT    /api/admin/learning-paths/:id
PATCH  /api/admin/learning-paths/:id/status
GET    /api/admin/learning-paths/:id/steps
POST   /api/admin/learning-paths/:id/steps
PUT    /api/admin/learning-paths/:id/steps/:sid
DELETE /api/admin/learning-paths/:id/steps/:sid
POST   /api/admin/learning-paths/:id/steps/reorder   body: { step_ids: [] }
POST   /api/admin/learning-paths/import
GET    /api/admin/learning-paths/export.csv
GET    /api/admin/learning-paths/template.csv
```

### 10. Validation Rules
- `from_level < to_level`; both in 1–5
- `estimated_hours`: sum of step `duration_hours` must equal path `estimated_hours` (±0.5h tolerance)
- `prerequisite_path_ids`: cycle detection required; no circular prerequisites
- At least 1 mandatory step per learning path before publish
- Duplicate (competency_id, from_level, to_level) pairs: soft warning (multiple paths to same destination allowed)

---

## Module 16 — Future Skills

### 1. Navigation Structure
```
Super Admin Dashboard
└── Future Readiness
    └── Future Skills  [M16]
        ├── All Skills
        ├── AI & Automation Skills
        ├── Skill Taxonomy
        ├── Occupation Exposure
        └── Labour Market Signals
```

### 2. Screen Layout
- **Header:** Skill category filter · Relevance horizon filter · Status filter · `[Import]` `[Export]` `[+ New Skill]`
- **Table:** Code · Name · Category · Demand trend · Automation risk · Occupation count · Status · Actions
- **Drawer tabs:** Skill Definition · Occupation Mappings · Assessment Questions · Demand Signals · Audit Trail

### 3. Fields
**Future Skill:**
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID | auto | |
| `code` | VARCHAR(40) | ✓ | Unique, snake_case |
| `name` | VARCHAR(150) | ✓ | |
| `canonical_name` | VARCHAR(150) | ✓ | Normalised form for deduplication |
| `category` | ENUM | ✓ | `ai_ml` / `data_analytics` / `digital_literacy` / `automation` / `sustainability` / `critical_thinking` / `creativity` / `social_emotional` / `adaptability` / `other` |
| `description` | TEXT | ✓ | Max 1000 chars |
| `demand_trend` | ENUM | ✓ | `rising_fast` / `rising` / `stable` / `declining` / `emerging` |
| `automation_exposure_score` | DECIMAL(4,3) | ✓ | 0–1; probability this skill is automated within 5 years |
| `future_relevance_score` | DECIMAL(4,3) | ✓ | 0–1; 5-year strategic importance |
| `esco_skill_uri` | VARCHAR(255) | — | |
| `onet_element_id` | VARCHAR(20) | — | |
| `reference_year` | INTEGER | ✓ | Year this demand signal was curated |
| `data_sources` | TEXT[] | — | WEF / OECD / LinkedIn / O*NET etc. |
| `reskilling_effort_weeks` | INTEGER | — | Estimated weeks for an adult to acquire functional level |
| `status` | ENUM | ✓ | Standard lifecycle |

**Occupation Exposure (child rows):**
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `skill_id` | UUID | ✓ | FK → future_skills |
| `occupation_id` | UUID | ✓ | FK → occupations |
| `exposure_level` | ENUM | ✓ | `core` / `adjacent` / `displaced` |
| `impact_horizon_years` | INTEGER | ✓ | 2–10 |

### 4. Permissions
| Action | super_admin | content_curator | content_reviewer |
|--------|:-----------:|:---------------:|:----------------:|
| View | ✓ | ✓ | ✓ |
| Create / Edit | ✓ | ✓ | — |
| Set `automation_exposure_score` | ✓ | ✓ | — |
| Approve / Publish | ✓ | — | ✓ |

### 5. Approval Workflow
Standard lifecycle. Changes to `automation_exposure_score` or `future_relevance_score` on published skills trigger a re-audit of the Future-Readiness index for affected occupation mappings.

### 6. Audit Requirements
- Log every score change with before/after
- Log occupation exposure changes
- Record `reference_year` at publish (immutable)

### 7. Import Template (CSV)
```
code,name,canonical_name,category,description,demand_trend,automation_exposure_score,future_relevance_score,reskilling_effort_weeks,reference_year,data_sources
ai_literacy,"AI Literacy","ai literacy",ai_ml,"Understanding and working with AI tools",rising_fast,0.150,0.920,8,2026,"WEF;LinkedIn"
```

### 8. Export Template (CSV)
```
id,code,name,category,demand_trend,automation_exposure_score,future_relevance_score,reskilling_effort_weeks,reference_year,status
```

### 9. API Contracts
```
GET    /api/admin/future-skills?category=&demand_trend=&q=&page=&per_page=
GET    /api/admin/future-skills/:id
POST   /api/admin/future-skills
PUT    /api/admin/future-skills/:id
PATCH  /api/admin/future-skills/:id/status
GET    /api/admin/future-skills/:id/occupations
POST   /api/admin/future-skills/:id/occupations    body: { occupation_id, exposure_level, impact_horizon_years }
DELETE /api/admin/future-skills/:id/occupations/:oid
GET    /api/admin/future-skills/taxonomy            (grouped by category, demand tier)
GET    /api/admin/future-skills/labour-signals      (demand trend summary by category)
POST   /api/admin/future-skills/import
GET    /api/admin/future-skills/export.csv
GET    /api/admin/future-skills/template.csv
```

### 10. Validation Rules
- `automation_exposure_score` + `future_relevance_score`: 0.000–1.000 (3dp)
- `reference_year`: current year or prior (not future)
- `canonical_name`: normalised (lowercase, trimmed); server enforces deduplication check (soft warning if near-duplicate exists)
- Taxonomy uniqueness: `(canonical_name, category)` pair should be unique (soft warning)

---

## Module 17 — AI Rules

### 1. Navigation Structure
```
Super Admin Dashboard
└── Governance
    └── AI Rules  [M17]
        ├── Language Policy
        ├── Confidence Thresholds
        ├── Model Gates
        ├── Prompt Templates
        └── Safety Rules
```

### 2. Screen Layout
- **Header:** Rule type filter · Status filter · `[Import]` `[Export]` `[+ New Rule]`
- **Table:** Code · Name · Type · Affects · Enforcement level · Status · Actions
- **Drawer tabs:** Rule Definition · Test Console · Enforcement Log · Audit Trail

### 3. Fields
**AI Rule:**
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID | auto | |
| `code` | VARCHAR(50) | ✓ | Unique, snake_case |
| `name` | VARCHAR(150) | ✓ | |
| `rule_type` | ENUM | ✓ | `language_policy` / `confidence_threshold` / `model_gate` / `prompt_template` / `safety_rule` / `suppression_rule` |
| `scope` | ENUM | ✓ | `global` / `narrative` / `coaching` / `recommendations` / `assessment` / `reports` |
| `enforcement_level` | ENUM | ✓ | `hard` (block output) / `soft` (flag for review) / `log_only` |
| `rule_definition` | JSONB | ✓ | Type-specific configuration (see §3a below) |
| `is_active` | BOOLEAN | ✓ | Default true |
| `applies_from` | DATE | — | Effective date |
| `applies_until` | DATE | — | Expiry date (null = permanent) |
| `status` | ENUM | ✓ | Standard lifecycle |

**§3a. rule_definition structures by type:**

**language_policy:**
```json
{
  "disallowed_terms": ["suitable for", "not suitable", "hire", "reject"],
  "disallowed_patterns": [".*is a bad fit.*"],
  "required_framing": "developmental",
  "replacement_suggestions": { "suitable for": "shows readiness for" }
}
```

**confidence_threshold:**
```json
{
  "min_confidence_to_show": 0.3,
  "below_threshold_action": "suppress",
  "label_map": { "0.7": "High", "0.4": "Moderate", "0.0": "Early-stage signal" }
}
```

**prompt_template:**
```json
{
  "template_id": "career_narrative_v3",
  "system_prompt": "You are a developmental career advisor...",
  "user_prompt_template": "Given this profile: {{profile}}, generate...",
  "max_tokens": 500,
  "temperature": 0.7,
  "grounding_required": true,
  "grounding_refs_min": 2
}
```

**safety_rule:**
```json
{
  "trigger_patterns": ["I want to hurt", "hopeless", "end it all"],
  "action": "escalate",
  "escalation_target": "crisis_inbox",
  "response_template": "I hear you. It sounds like things are really difficult right now..."
}
```

### 4. Permissions
| Action | super_admin | content_curator | content_reviewer |
|--------|:-----------:|:---------------:|:----------------:|
| View non-safety rules | ✓ | ✓ | ✓ |
| View safety rules | ✓ | — | — |
| Create / Edit | ✓ | — | — |
| Test in console | ✓ | ✓ | ✓ |
| Activate / Deactivate | ✓ | — | — |

> AI Rules are **super_admin only** for create/edit/activate. These rules govern all AI outputs platform-wide.

### 5. Approval Workflow
Standard lifecycle. `enforcement_level = 'hard'` rules require dual super_admin approval (maker-checker) before activation. Safety rules require mandatory test console validation before publish.

### 6. Audit Requirements
- Log every rule change with full JSONB diff
- Log every activation / deactivation
- Log every enforcement event with rule_code, actor, output blocked/flagged, timestamp
- Retain enforcement log for 3 years (compliance)

### 7. Import/Export Template
JSON only. Rules contain complex JSONB; CSV is not appropriate.

### 8. API Contracts
```
GET    /api/admin/ai-rules?rule_type=&scope=&enforcement_level=&q=&page=&per_page=
GET    /api/admin/ai-rules/:id
POST   /api/admin/ai-rules             (super_admin only)
PUT    /api/admin/ai-rules/:id         (super_admin only)
PATCH  /api/admin/ai-rules/:id/status  (super_admin only)
POST   /api/admin/ai-rules/:id/test    body: { input_text, context? } → { passed, flags[], blocked_terms[] }
GET    /api/admin/ai-rules/:id/enforcement-log?page=&per_page=
POST   /api/admin/ai-rules/import
GET    /api/admin/ai-rules/export
```

### 9. Validation Rules
- `language_policy.disallowed_terms`: at least 1 term; each ≤ 200 chars
- `prompt_template.system_prompt`: 100–5000 chars
- `prompt_template.max_tokens`: 50–4000
- `prompt_template.temperature`: 0.0–1.0
- `safety_rule.trigger_patterns`: at least 3 patterns; validated as valid regex
- `enforcement_level = 'hard'`: requires dual super_admin sign-off (maker_id ≠ checker_id)
- Active rule count per scope: no more than 50 active rules per scope (system performance guard)

---

## Module 18 — Reports

### 1. Navigation Structure
```
Super Admin Dashboard
└── Reports & Analytics  [M18]
    ├── CAPADEX Reports
    ├── LBI Reports
    ├── SDI Reports
    ├── Competency Reports
    ├── EI Reports
    ├── Report Templates
    ├── Delivery Rules
    └── Report Queue
```

### 2. Screen Layout
- **Header:** Report type filter · Status filter · Date range filter · Search (user, session) · `[Export All]` `[+ Report Template]`
- **Table:** Session ID · User · Type · Score/Band · Status · Generated · Approved by · Actions
- **Drawer tabs:** Report Preview · Score Detail · Approval Workflow · Delivery Log · Audit Trail

### 3. Fields
**Report Record:**
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID | auto | |
| `session_id` | UUID | ✓ | FK → assessment session |
| `user_id` | UUID | ✓ | FK → users |
| `report_type` | ENUM | ✓ | `capadex` / `lbi` / `sdi` / `competency` / `ei` / `career_passport` |
| `status` | ENUM | ✓ | `pending` / `in_review` / `approved` / `published` / `rejected` |
| `overall_score` | DECIMAL(6,2) | — | Overall assessment score |
| `band` | VARCHAR(30) | — | Readiness band label |
| `score_breakdown` | JSONB | — | Per-dimension scores |
| `report_html` | TEXT | — | Generated report HTML (stored for re-delivery) |
| `report_pdf_url` | VARCHAR(500) | — | S3/R2 object URL |
| `reviewed_by` | UUID | — | FK → users (admin reviewer) |
| `reviewed_at` | TIMESTAMP | — | |
| `rejection_reason` | TEXT | — | If rejected |
| `delivered_at` | TIMESTAMP | — | When emailed/made available to user |
| `generated_at` | TIMESTAMP | auto | |

**Report Template:**
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID | auto | |
| `code` | VARCHAR(40) | ✓ | Unique |
| `name` | VARCHAR(150) | ✓ | |
| `report_type` | ENUM | ✓ | |
| `stakeholder` | ENUM | ✓ | `individual` / `parent` / `counsellor` / `employer` / `institution` |
| `template_html` | TEXT | ✓ | Handlebars/Mustache template |
| `sections` | JSONB | ✓ | Ordered sections with visibility rules |
| `palette` | JSONB | — | `{ primary, secondary, header_bg, cta_bg }` — must maintain ≥4.5:1 contrast |
| `tone` | ENUM | ✓ | `hopeful` / `professional` / `clinical` — default `hopeful` |
| `is_default` | BOOLEAN | ✓ | Default false; one default per report_type+stakeholder |
| `status` | ENUM | ✓ | Standard lifecycle |

**Delivery Rule:**
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | UUID | auto | |
| `report_type` | ENUM | ✓ | |
| `trigger` | ENUM | ✓ | `on_complete` / `on_approve` / `on_publish` / `scheduled` |
| `channel` | ENUM | ✓ | `email` / `in_app` / `webhook` / `download_link` |
| `template_id` | UUID | ✓ | FK → report_templates |
| `delay_hours` | INTEGER | — | Delay before delivery (0 = immediate) |
| `requires_otp` | BOOLEAN | ✓ | Default false (CAPADEX: true) |
| `is_active` | BOOLEAN | ✓ | Default true |

### 4. Permissions
| Action | super_admin | content_curator | content_reviewer | org_admin |
|--------|:-----------:|:---------------:|:----------------:|:---------:|
| View reports (own tenant) | ✓ | ✓ | ✓ | ✓ |
| View report HTML/PDF | ✓ | — | ✓ | ✓ |
| Approve / Reject reports | ✓ | — | ✓ | — |
| Publish (send to user) | ✓ | — | — | — |
| Edit templates | ✓ | ✓ | — | — |
| Configure delivery rules | ✓ | — | — | — |
| Export bulk | ✓ | — | — | — |

### 5. Approval Workflow
Reports follow: `pending → in_review → approved → published`. 
- `STATUS_STEPS = ['pending', 'in_review', 'approved', 'published']` (matches current platform)
- Score band: `getLevelFromScore` — ≥80 High / ≥60 Medium / ≥40 Developing / <40 Early
- Published = report delivered to user via configured delivery rule
- Rejection sends user notification with non-alarming developmental framing

### 6. Audit Requirements
- Log every status transition with reviewer identity and timestamp
- Log every delivery attempt with channel, template, success/failure
- Log report HTML regeneration events
- Never log report content to `admin_audit_log` (privacy) — log event metadata only

### 7. Report Template Import/Export
JSON format:
```json
{
  "code": "CAPADEX_INDIVIDUAL_V4",
  "report_type": "capadex",
  "stakeholder": "individual",
  "tone": "hopeful",
  "palette": { "primary": "#0A6E7C", "header_bg": "#0A4A6E", "cta_bg": "#0A6E7C" },
  "sections": [
    { "id": "header", "type": "hero", "visible": true },
    { "id": "score_summary", "type": "score_card", "visible": true },
    { "id": "concern_areas", "type": "concern_list", "visible": true, "max_items": 5 }
  ]
}
```

### 8. API Contracts
```
GET    /api/admin/reports?type=&status=&date_from=&date_to=&q=&page=&per_page=
GET    /api/admin/reports/:id
GET    /api/admin/reports/:id/preview          (rendered HTML — no PII in audit log)
PATCH  /api/admin/reports/:id/status           body: { status, reason? }
POST   /api/admin/reports/:id/redeliver        (re-send to user)
GET    /api/admin/reports/export.csv?type=&status=&date_from=&date_to=

GET    /api/admin/report-templates?type=&stakeholder=&q=&page=&per_page=
GET    /api/admin/report-templates/:id
POST   /api/admin/report-templates
PUT    /api/admin/report-templates/:id
PATCH  /api/admin/report-templates/:id/status
GET    /api/admin/report-templates/:id/preview
POST   /api/admin/report-templates/import
GET    /api/admin/report-templates/export

GET    /api/admin/report-delivery-rules?type=&q=&page=&per_page=
POST   /api/admin/report-delivery-rules
PUT    /api/admin/report-delivery-rules/:id
PATCH  /api/admin/report-delivery-rules/:id/toggle
```

### 9. Validation Rules
- `palette`: each colour must pass 4.5:1 contrast ratio against white (header/CTA) or black (body text); validated server-side using WCAG algorithm
- `tone`: `clinical` is disallowed for `individual` stakeholder (platform language policy)
- Report `status` transitions: strictly sequential per `STATUS_STEPS`; no skip transitions
- `requires_otp = true`: delivery rule cannot use `webhook` channel
- `report_html`: sanitised via DOMPurify-equivalent before storage (no script tags)
- Email delivery (Zoho): subject must be `encodeURIComponent(subject)` (em-dash safe; platform convention)

---

## Appendix A: Navigation Master Structure

```
Super Admin Dashboard
├── Overview
│   ├── Platform Health
│   ├── Recent Activity
│   └── Pending Approvals (count badge)
│
├── Taxonomy
│   ├── Industries     [M01]
│   ├── Functions      [M02]
│   ├── Departments    [M03]
│   ├── Roles          [M04]
│   └── Career Tracks  [M05]
│
├── Assessment
│   ├── Competencies        [M06]
│   ├── Competency Levels   [M07]
│   ├── Questions           [M10]
│   ├── Assessments         [M11]
│   └── Scoring Rules       [M12]
│
├── CAPADEX
│   ├── Concerns        [M08]
│   ├── Indicators      [M09]
│   └── (Clarity Qs — existing CapadexClarityQuestionsPanel)
│
├── Career Intelligence
│   ├── Benchmarks     [M13]
│   ├── Career Paths   [M14]
│   └── Learning Paths [M15]
│
├── Future Readiness
│   └── Future Skills  [M16]
│
├── Governance
│   ├── AI Rules             [M17]
│   ├── Feature Flags        (existing FeatureFlagsPanel)
│   └── Ethics & Fairness    (existing EthicsGovernancePanel)
│
└── Reports & Analytics
    ├── Reports          [M18]
    ├── EI Health        (existing EIHealthPanel)
    └── Analytics        (existing CapadexAnalyticsPanel)
```

---

## Appendix B: Cross-Module Dependency Table

| Module | Depends On (must be published first) |
|--------|--------------------------------------|
| Functions (M02) | Industries (M01) |
| Departments (M03) | Functions (M02) |
| Roles (M04) | Departments (M03), Competencies (M06) |
| Career Tracks (M05) | — (optionally references Roles) |
| Competency Levels (M07) | Competencies (M06) |
| Indicators (M09) | Concerns (M08) |
| Questions (M10) | Competencies (M06) or Concerns (M08) |
| Assessments (M11) | Questions (M10), Scoring Rules (M12) |
| Benchmarks (M13) | Roles (M04), Competencies (M06) |
| Career Paths (M14) | Roles (M04) |
| Learning Paths (M15) | Competency Levels (M07) |
| Future Skills (M16) | Occupations (EI Graph) |
| AI Rules (M17) | — (stand-alone, activates platform-wide) |
| Reports (M18) | All modules (aggregates outputs) |

---

## Appendix C: Universal Table Schema (admin_audit_log)

```sql
CREATE TABLE admin_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module        VARCHAR(50) NOT NULL,
  entity_id     VARCHAR(100) NOT NULL,
  action        VARCHAR(30) NOT NULL
                  CHECK (action IN ('create','update','delete','approve','reject',
                                    'publish','archive','import','export',
                                    'status_change','version_create')),
  actor_id      UUID NOT NULL REFERENCES users(id),
  actor_role    VARCHAR(30) NOT NULL,
  old_value     JSONB,
  new_value     JSONB,
  note          TEXT,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_module_entity ON admin_audit_log(module, entity_id);
CREATE INDEX idx_audit_actor        ON admin_audit_log(actor_id);
CREATE INDEX idx_audit_created_at   ON admin_audit_log(created_at DESC);
```

---

## Appendix D: Shared Status Transition Table

| From | To | Who can trigger | Conditions |
|------|-----|-----------------|-----------|
| — | `draft` | content_curator, super_admin | On create |
| `draft` | `in_review` | content_curator, super_admin | All required fields populated |
| `in_review` | `approved` | content_reviewer, super_admin | Passes validation rules |
| `in_review` | `draft` (rejected) | content_reviewer, super_admin | `rejection_reason` required |
| `approved` | `published` | super_admin | Module-specific publish guards pass |
| `published` | `archived` | super_admin | No active downstream references |
| `archived` | `draft` | super_admin | Restore as new draft (new version) |

---

## Appendix E: Import / Export Global Rules

1. **CSV Encoding:** UTF-8, comma delimiter, double-quote text qualifier
2. **Column headers:** snake_case, matching field names in §3 of each module
3. **Reference fields:** Use `_code` suffix (e.g. `industry_code`) for human-readable keys; server resolves to internal UUIDs
4. **Import idempotency:** If `code` already exists → update; if new → insert; never hard-delete via import
5. **Error handling:** Each row that fails validation is returned in `errors[]` array with `row_number`, `field`, `message`; valid rows are still processed
6. **Import size limit:** 10,000 rows per file; 5 MB max
7. **Export format:** Always includes `id` (UUID), `status`, `created_at`, `updated_at` as last columns
8. **Literal route registration:** Export endpoints (`/export.csv`) must be registered BEFORE any `/:id` catch-all routes in Express (platform convention)
