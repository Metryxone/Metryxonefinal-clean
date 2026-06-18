# SuperAdmin Navigation Migration Map (STEP 13)

**Purpose:** document how the SuperAdmin information architecture (IA) was reorganized into
the consolidated nav groups, and confirm that **no screen, route, or panel was deleted** —
every legacy entry either kept its place under a new group or redirects into a consolidated
host panel.

**Sources of truth (code, not assertion):**
- Nav structure declaration: `frontend/src/hooks/useAdminDashboardState.tsx` — `navGroups` (~L2640–L2899)
- Panel render switch: `frontend/src/components/SuperAdminDashboard.tsx` — `activeTab` cases (~L354–L950)
- Sidebar render: `frontend/src/components/admin/AdminSidebar.tsx` (~L172–L254)

> Honesty note: this map reflects the nav as declared in the above files at the time of
> writing. Item ids are quoted exactly as in code. The "Advanced Mode" / "Developer Mode"
> labs groups hold 80+ additional granular panels (VX / BIOS / CAF / SPE / ROIE / PAIE /
> LDE / RIE families) — they remain reachable and are intentionally collapsed by default;
> they are summarised here rather than enumerated to keep this map maintainable.

---

## 1. New IA — top-level groups → items → rendered panel

| Group | Item id | Label | Rendered panel |
| :--- | :--- | :--- | :--- |
| **Mission Control** (overview zone) | `mission-control` | Mission Control | `MissionControlPanel` |
| | `overview` | Overview | `OverviewPanel` |
| **Products** (Command Centers) | `cc-capadex` | CAPADEX Command Center | `ProductCommandCenter productKey="capadex"` |
| | `cc-competency` | Competency Command Center | `ProductCommandCenter productKey="competency"` |
| | `cc-lbi` | LBI Command Center | `ProductCommandCenter productKey="lbi"` |
| | `cc-employability` | Employability Intelligence | `ProductCommandCenter productKey="employability"` |
| | `cc-career` | Career Builder Command Center | `ProductCommandCenter productKey="career"` |
| | `cc-employer` | Employer Intelligence OS | `ProductCommandCenter productKey="employer"` |
| **Intelligence** | `capadex-analytics` | CAPADEX Analytics | `CapadexAnalyticsPanel` |
| | `signal-intelligence` | Signal Intelligence | `SignalIntelligencePanel` |
| | `intelligence-pipeline` | Intelligence Pipeline | `IntelligencePipelinePanel` |
| | `concern-intelligence` | Concern Engine | `ConcernIntelligencePanel` |
| | `csi-intelligence` | CSI Profiles | `CSIPanel` |
| | `runtime-intelligence` | Runtime Intelligence | `GovernancePanel` (runtime-intelligence mode) |
| | `career-graph-admin` | Career Graph Intelligence | `CareerGraphPanel` |
| | `competency-intelligence-admin` | Competency Intelligence | `CompetencyIntelligenceAdminPanel` |
| | `talent-signal-master` | Talent Signal Master | `TalentSignalMasterPanel` |
| | `predictive-intelligence` | Predictive Intelligence | `PredictiveIntelligencePanel` |
| | `ei-health` | EI Health & Analytics | `EIOperationsPanel` + `EIHealthPanel` |
| | `frp-admin` | Future Readiness Platform | `FRPDesignPanel` |
| | `readiness-dashboards` | Readiness Dashboards | `ReadinessDashboardsPanel` |
| | `lip-admin` | Learning Intelligence Platform | `LIPDesignPanel` |
| **Organizations** | `usermgmt` | User Management | `UserMgmtPanel` |
| | `parents` | Parents | `ParentsPanel` |
| | `students` | Students (18+) | `StudentsPanel` |
| | `institutions` | Institutions | `InstitutionsPanel` |
| | `hr` | HR & Jobs | `HRPanel` |
| | `mentors` | Mentors | `MentorsPanel` |
| | `employer-onboarding` | Employer Onboarding | `EmployerOnboardingPanel` |
| | `tenants` | Multi-Tenant | `TenantsPanel` |
| **Operations** | `action-center` | Action Center | `ActionCenterPanel` |
| | `notification-center` | Notification Center | `NotificationCenterPanel` |
| | `health-dashboards` | Health Dashboards | `HealthDashboardsPanel` |
| | `approvals` | Approval Workflow | `ApprovalWorkflowPanel` |
| | `platform-audit` | Platform Audit Log | `PlatformAuditLogPanel` |
| | `capadex-users` | CAPADEX Users & Journeys | `CapadexUsersPanel` |
| | `capadex-interventions` | Risk & Interventions | `CapadexInterventionsPanel` |
| | `rie-escalations` | Crisis Escalations | `RIEEscalationsPanel` |
| **Reports** | `reports` | Reports | `UnifiedReportsPanel` |
| | `capadex-reports` | CAPADEX Reports | `CapadexReportsPanel` |
| | `report-factory-admin` | Report Factory | `ReportFactoryPanel` |
| | `enterprise-analytics` | Enterprise Analytics | `EnterpriseAnalyticsPanel` |
| **Commercial** | `pricing` | Pricing & Packages | `PricingPanel` |
| | `capadex-pricing` | CAPADEX Upgrade Pricing | `CapadexPricingPanel` |
| | `financials` | Financials | `FinancialsPanel` |
| | `learning` | Learning Plans | `LearningPlansPanel` |
| **Governance** | `ai-governance` | AI Governance Platform | `AiGovernancePanel` |
| | `security` | Security & Audit | `SecurityPanel` |
| | `access` | Access Control | `AccessControlPanel` |
| | `consents` | Consents | `ConsentsPanel` |
| | `ont-governance` | Ontology Governance | `OntologyGovernancePanel` |
| | `feature-flags` | Feature Flags | `FeatureFlagsPanel` |
| **Platform** | `content` | Content Manager | `ContentManagerPanel` |
| | `documents` | Documents | `DocumentsPanel` |
| | `codes` | Entity Codes | `EntityCodesPanel` |
| | `notifications_mgmt` | Notifications | `NotificationsMgmtPanel` |
| | `reference-intelligence` | Reference Intelligence | `ReferenceIntelligencePanel` |
| | `settings` | Settings | `SettingsPanel` |
| **Advanced Mode** / **Developer Mode** (labs, collapsed) | (80+ ids) | VX / BIOS / CAF / SPE / ROIE / PAIE / LDE / RIE families | respective panels, all still reachable |

---

## 2. Legacy / standalone screens → new home (NOTHING deleted)

| Legacy screen / tab id | Status | New home | Evidence |
| :--- | :--- | :--- | :--- |
| `capadex-concerns-master` / `capadex_concerns_master` | **Consolidated (redirect)** | CAPADEX Framework panel → Concern Areas inner tab (`FrameworkPanel` w/ `SDI_CONFIG`, `initialTab='concerns'`) | `SuperAdminDashboard.tsx` L392–404 — legacy ids still matched and redirected |
| `capadex-clarity-questions` / `capadex_clarity_questions` | **Consolidated (redirect)** | CAPADEX Framework panel → Clarity Questions inner tab (`initialTab='clarity'`) | `SuperAdminDashboard.tsx` L396–404 |
| `concern-areas` / `concern_areas` | **Retained** (both id spellings) | `ConcernAreasPanel` | `SuperAdminDashboard.tsx` L389 |
| `short-assessments` / `short_assessments` | **Retained** (both id spellings) | `ShortAssessmentsPanel` | `SuperAdminDashboard.tsx` L390 |
| `students_legacy` | **Retained** | `StudentsLegacyPanel` (kept alongside new `students` → `StudentsPanel`) | render switch |
| `behavior` | **Retained** | `AssessmentModulesManagement` | render switch |
| Active Sessions (was a fabricated/static card) | **Replaced with real data** | `security` → `SecurityPanel` Active Sessions view, backed by `GET /api/admin/sessions` (`readActiveSessions` over `express_sessions`) | this work (STEP 12) |
| Permission Matrix (did not exist) | **Added** (read-only) | `security` → `SecurityPanel` Access view, backed by `GET /api/admin/security/permission-matrix` | this work (STEP 12) |

**Deletion audit:** no `activeTab` case was removed. Legacy ids that were dropped from the
*sidebar* (`capadex-concerns-master`, `capadex-clarity-questions`) are still **matched in the
render switch** and redirect into the consolidated Framework panel, so any bookmarked/deep
link continues to resolve. Dual id spellings (hyphen and underscore) are preserved.

---

## 3. STEP 12 security visibility additions (no access changes)

These are **visibility-only** — they read and display existing data; they grant/revoke nothing
and change no enforcement path.

| Surface | Backend | Behaviour |
| :--- | :--- | :--- |
| Permission Matrix | `GET /api/admin/security/permission-matrix` (`backend/routes/security-center.ts`) | roles × permissions via `role_permissions`; when the formal RBAC tables are empty, returns `roles:[]`+`grants:[]` and a `liveReality`/`honesty` block stating the platform enforces a single `super_admin` gate. No fabrication. |
| Audit Log | `GET /api/admin/audit-logs` (existing) over `admin_audit_logs`, now also populated by a global fire-and-forget middleware (`createAdminAuditMiddleware`) on mutating `/api/admin/*` calls | GET requests never write; only mutating calls returning `<400` are recorded. Verified live. |
| Active Sessions | `GET /api/admin/sessions` → `readActiveSessions(express_sessions)` | real session rows (sid, userId, role, expiry); replaces a previously static/fabricated card. |

> Out of scope (left as-is, flagged to owner): pre-existing Compliance / hash-chain cards in
> `SecurityPanel` that show fabricated/illustrative values were **not** part of this
> visibility-only pass and remain unchanged.
