# SuperAdmin — Technical Document

**Module**: MetryxOne · SuperAdmin Console
**Status**: Production
**Default creds (dev)**: `superadmin@metryx.one` / `admin123`

---

## 1. Overview

The SuperAdmin Console is MetryxOne's all-in-one operations cockpit. A single React shell hosts **80+ purpose-built panels** covering: user/tenant management, CAPADEX behavioural-intelligence ops, the assessment-frameworks lab (LBI · SDI · Competency), advanced AI engines (BIOS · ROIE · PAIE · LDE · RIE · IIL · NHDA · SPE), pricing/financials, governance/fairness/ethics, feature flags, security, audit, and content management.

The console is **config-driven where possible** (`FrameworkPanel` + `CrudTable` + `framework-configs.ts` cover ~12 framework tabs without bespoke code) and **bespoke where needed** (one panel per non-CRUD workflow like Crisis Alerts, BIOS Simulation, Counterfactual Simulator).

---

## 2. Auth & Entry

| File | Lines | Purpose |
|---|---|---|
| `frontend/src/components/SuperAdminLogin.tsx` | 554 | Login form, credential submit, post-login routing |

**Flow**:
1. User submits to `POST /api/login` (passport-local strategy).
2. Backend checks `user.role === 'super_admin'` (or membership in `user.roles[]`).
3. Session set via `express-session` + `connect-pg-simple` Postgres store (table: `express_sessions`).
4. SPA navigates to `screen = 'admin-dashboard'`; `App.tsx` mounts `SuperAdminDashboard`.
5. Token mirrored to `localStorage` (`metryx_token`) for any client → API authorization headers that bypass the cookie session.

**MFA** (optional / toggleable in dev): `POST /api/admin/mfa/verify` hook in `backend/routes.ts`.

---

## 3. Dashboard Shell

| File | Lines | Role |
|---|---|---|
| `frontend/src/components/SuperAdminDashboard.tsx` | 513 | Shell — sidebar + outlet + boundary |
| `frontend/src/hooks/useAdminDashboardState.tsx` | 2,905 | Centralised state: active panel, filters, dialogs, search, selections (100+ vars) |
| `frontend/src/components/admin/AdminSidebar.tsx` | 209 | Grouped nav (Core · Assessment Lab · Intelligence Suite · AI Labs · Platform Ops) |
| `frontend/src/components/superadmin/CrisisAlertInbox.tsx` | 419 | Header drawer — high-priority intervention queue |

**Layout**: persistent left sidebar · sticky top bar with Crisis Inbox · right pane renders the active panel inside a `DialogsErrorBoundary` so one panel crash never kills the shell.

---

## 4. Shared Admin Primitives (`frontend/src/components/admin/`)

| File | Lines | Used for |
|---|---|---|
| `CrudTable.tsx` | 661 | Generic searchable/filterable list table with inline create/edit/delete. Drives most list views. |
| `FrameworkPanel.tsx` | 420 | Higher-order panel renderer — consumes a config and outputs 8–12 tabs (Domains · Subdomains · Norms · Weights · Versions · Concerns · Short Assessments · Scoring · Clusters · Report Types · Import/Export) |
| `framework-configs.ts` | 407 | Config bag: `LBI_CONFIG`, `COMPETENCY_CONFIG`, `SDI_CONFIG` (= CAPADEX) — each declares endpoints, column defs, available tabs |
| `AdminDialogs.tsx` | 2,985 | Central modal repository (approve user, reject KYC, edit job, etc.) — single mount point in shell |
| `AdminSidebar.tsx` | 209 | Nav grouping + screen routing |
| `ImportExportPanel.tsx` | 546 | Reusable CSV/JSON import + export for any framework |
| `parity-tabs.tsx` | 1,742 | LBI/SDI framework-parity multi-tab orchestration |

**Pattern**: a brand-new assessment framework can be added by registering one config object in `framework-configs.ts` — no UI code required.

---

## 5. Panel Inventory (all 84 panels)

All under `frontend/src/components/superadmin/`. Grouped functionally; line counts shown for top panels.

### 5.1 Overview & Users
| Panel | Lines | Purpose |
|---|---|---|
| `OverviewPanel.tsx` | 584 | Home dashboard — KPIs, live stats |
| `UserMgmtPanel.tsx` | 1,624 | CRUD over `users`, role switching, KYC |
| `HRPanel.tsx` | 1,443 | HR/recruiter accounts |
| `MentorsPanel.tsx` | 1,919 | Mentor directory + verification |
| `ParentsPanel.tsx` | 1,232 | Parent accounts + child links |
| `StudentsPanel.tsx` | 1,076 | Active students |
| `StudentsLegacyPanel.tsx` | 594 | Legacy student records |
| `InstitutionsPanel.tsx` | 960 | Schools/colleges/enterprises |
| `TenantsPanel.tsx` | — | Multi-tenant orgs (`/api/admin/tenants`) |
| `AccessControlPanel.tsx` | — | RBAC role ↔ permission matrix |
| `ConsentsPanel.tsx` | — | GDPR consent ledger |
| `CounsellorDirectoryPanel.tsx` | — | Counsellor list (Pragati escalation routing) |
| `EntityCodesPanel.tsx` | — | Tax / regulatory entity codes |

### 5.2 CAPADEX
| Panel | Lines | Purpose |
|---|---|---|
| `CapadexUsersPanel.tsx` | — | Cohort table |
| `CapadexAnalyticsPanel.tsx` | — | Funnel + stage conversion |
| `CapadexInterventionsPanel.tsx` | — | Counsellor recommendation queue |
| `CapadexPricingPanel.tsx` | — | 4-stage price/benefit CMS |
| `CapadexReportsPanel.tsx` | 1,345 | All-reports browser, OMEGA snapshots |
| `ConcernAreasPanel.tsx` | 533 | CRUD over `capadex_concerns` (12-concern ontology) |
| `ConcernIntelligencePanel.tsx` | — | Per-concern intelligence rules |
| `ShortAssessmentsPanel.tsx` | 1,298 | Active-Age-Band reflection CRUD |
| `ActiveAgeBandsReflection.tsx` | — | Per-age-band reflection config |
| `SignalIntelligencePanel.tsx` | — | Per-session signal profile inspector (BIOS Signal Capture) |

See `docs/CAPADEX.md` for the full CAPADEX subsystem doc.

### 5.3 Assessment Frameworks (LBI · SDI · Competency)
| Panel | Lines | Purpose |
|---|---|---|
| `LBIPanel.tsx` | — | Life Balance Index — uses `FrameworkPanel(LBI_CONFIG)` |
| `QuestionBankPanel.tsx` | 661 | Master question bank (draft/approved status) |
| `CompetencyQuestionsPanel.tsx` | — | Competency question curation (generate/promote drafts) — see `replit.md` §Question Curation |
| `ScoringPanel.tsx` | 1,875 | Scoring-rule CMS (per-framework) |
| `PsychometricsPanel.tsx` | — | Age-band × domain calibration |

### 5.4 Intelligence Engines
| Panel | Lines | Engine |
|---|---|---|
| `CSIPanel.tsx` | — | Career Stage Index (`csi_*` tables) |
| `LDEIntelligencePanel.tsx` | 588 | LDE — temporal logic engine, intelligence layer |
| `LDEEvolutionPanel.tsx` | 483 | LDE — competency evolution traces |
| `LDEGraphPanel.tsx` | 463 | LDE — relationship graph viewer |
| `LDEGovernancePanel.tsx` | 474 | LDE — fairness/explainability |
| `LDETemporalPanel.tsx` | — | LDE — temporal slice viewer |
| `PredictiveIntelligencePanel.tsx` | — | BIOS Predictive Intelligence |
| `CognitiveIntelligencePanel.tsx` | — | Cognitive-load profiles |
| `ConversationalQualityPanel.tsx` | 547 | Pragati turn-level quality scoring |
| `ReferenceIntelligencePanel.tsx` | 668 | Reference data ops |
| `UnifiedReportsPanel.tsx` | — | Cross-engine report browser |
| `MemoryArchitecturePanel.tsx` | — | Longitudinal-memory inspector |
| `DigitalTwinPanel.tsx` | — | User-state digital twin |

### 5.5 BIOS (Behavioural Intelligence Operating System)
| Panel | Purpose |
|---|---|
| `BIOSAgentsPanel.tsx` | Agentic runtime monitor |
| `BIOSFrontierPanel.tsx` | Frontier-model routing |
| `BIOSFusionPanel.tsx` | Multi-signal fusion ops |
| `BIOSSimulationPanel.tsx` | Counterfactual signal simulation |

### 5.6 ROIE (Risk + Opportunity Intelligence Engine)
| Panel | Lines | Purpose |
|---|---|---|
| `ROIERiskPanel.tsx` | 506 | Risk surface |
| `ROIEOpportunityPanel.tsx` | 453 | Opportunity surface |
| `ROIESemanticPanel.tsx` | 439 | Semantic risk reasoning |
| `ROIEGovernancePanel.tsx` | 495 | Risk-engine governance |

### 5.7 RIE (Real-time Intervention Engine)
| Panel | Lines | Purpose |
|---|---|---|
| `RIEDashboardPanel.tsx` | — | Active interventions overview |
| `RIEEscalationsPanel.tsx` | 475 | Crisis/risk escalations queue |
| `RIEInterventionsPanel.tsx` | — | Per-user intervention tracker |
| `RIEOpportunityPanel.tsx` | — | Positive-action surface |
| `RIERecommendationsPanel.tsx` | — | Counsellor rec dispatch |
| `RIERecoveryPanel.tsx` | — | Post-intervention recovery tracking |

### 5.8 PAIE (Predictive AI Engine)
| Panel | Lines | Purpose |
|---|---|---|
| `PAIEForecastingPanel.tsx` | 492 | Trajectory forecasts |
| `PAIEIntelligencePanel.tsx` | — | Inference inspector |
| `PAIEOpportunityPanel.tsx` | — | Opportunity prediction |
| `PAIEGovernancePanel.tsx` | 481 | Prediction governance + explainability |

### 5.9 IIL (Integrated Intelligence Layer)
| Panel | Purpose |
|---|---|
| `IILCorePanel.tsx` | Core layer ops |
| `IILEvolutionPanel.tsx` | Time-series intelligence |
| `IILIntelligencePanel.tsx` | Fusion outputs |
| `IILGovernancePanel.tsx` | Governance |

### 5.10 NHDA (Neuro-Holistic Development Architecture)
| Panel | Lines | Purpose |
|---|---|---|
| `NHDACorePanel.tsx` | 421 | Core developmental architecture |
| `NHDAIntelligencePanel.tsx` | — | Holistic-development intelligence |
| `NHDAGovernancePanel.tsx` | — | NHDA fairness/audit |

### 5.11 SPE (Standardised Psychometric Engine)
| Panel | Purpose |
|---|---|
| `SPEScoringPanel.tsx` | Scoring engine ops |
| `SPEPsychometricsPanel.tsx` | Psychometric configs |
| `SPELongitudinalPanel.tsx` | Long-term score evolution |
| `SPEGovernancePanel.tsx` | SPE audit / explainability |

### 5.12 Pricing & Financials
| Panel | Lines | Purpose |
|---|---|---|
| `PricingPanel.tsx` | 3,030 | Master pricing CMS (subscription packages · stage pricing · feature gating) |
| `FinancialsPanel.tsx` | 553 | Revenue, MRR, refunds, payout ops |

### 5.13 Governance & Security
| Panel | Lines | Purpose |
|---|---|---|
| `GovernancePanel.tsx` | 1,178 | Cross-engine governance console (decision traces, calibration) |
| `EthicsGovernancePanel.tsx` | 406 | Ethics/policy ops |
| `FairnessPanel.tsx` | — | Bias / fairness audits |
| `SecurityPanel.tsx` | 762 | Audit log viewer (`/api/admin/audit`), security incidents |
| `CounterfactualSimulatorPanel.tsx` | 533 | "What if we changed this rule?" simulator |
| `CrisisAlertInbox.tsx` | 419 | High-priority intervention triage |

### 5.14 Platform Operations
| Panel | Lines | Purpose |
|---|---|---|
| `FeatureFlagsPanel.tsx` | 527 | Toggle flags from `backend/config/feature-flags.ts` at runtime |
| `SettingsPanel.tsx` | 972 | Global platform settings |
| `NotificationsMgmtPanel.tsx` | 1,076 | Email/SMS/WhatsApp template CMS |
| `DocumentsPanel.tsx` | 526 | Document/template management |
| `ContentManagerPanel.tsx` | — | Marketing / landing-page content |
| `LearningPlansPanel.tsx` | 399 | Curriculum plan CMS |
| `SemanticReasoningPanel.tsx` | — | Semantic-reasoning engine ops |

> **Total**: 84 panels across `frontend/src/components/superadmin/`; 7 shared primitives in `frontend/src/components/admin/`.

---

## 6. Backend Protection & Endpoints

### 6.1 Middleware

`requireSuperAdmin` is defined inline in `backend/routes.ts` at **L4546**:

```ts
const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'super_admin') return res.status(403)…
  next();
};
```

It is applied **after** `requireAuth` on every admin endpoint, e.g.:

```ts
app.post('/api/admin/seed-education-data', requireAuth, requireSuperAdmin, async (req, res, next) => { … });
```

### 6.2 Route files that use `requireSuperAdmin`

(23+ files)

- `backend/routes/competency-questions.ts`
- `backend/routes/intervention-engine.ts`
- `backend/routes/conversational-quality.ts`
- `backend/routes/import-export.ts`
- `backend/routes/contradiction-engine.ts`
- `backend/routes/competency-cohorts.ts`
- `backend/routes/audit.ts`
- `backend/routes/governance.ts`
- `backend/routes/cognitive-load.ts`
- `backend/routes/framework-parity.ts`
- `backend/routes/adaptive-assessment.ts`
- `backend/routes/feature-flags.ts`
- `backend/routes/engines.ts`
- `backend/routes/dynamic-report.ts`
- `backend/routes/rie-engine.ts`
- `backend/routes/rie-admin.ts`
- `backend/routes/sdi.ts`
- `backend/routes/employability-graph.ts`
- `backend/routes/ei-governance.ts`
- `backend/routes/longitudinal-memory.ts`
- `backend/routes/verification.ts`
- `backend/routes/reference-intelligence.ts`
- `backend/routes/short-assessments.ts`

### 6.3 Common `/api/admin/*` prefixes

| Prefix | Owner panel |
|---|---|
| `/api/admin/users` | `UserMgmtPanel` |
| `/api/admin/tenants` | `TenantsPanel` |
| `/api/admin/subscription-packages` | `PricingPanel` |
| `/api/admin/pricing` | `PricingPanel`, `CapadexPricingPanel` |
| `/api/admin/audit` | `SecurityPanel` |
| `/api/admin/capadex/*` | All `Capadex*Panel` |
| `/api/admin/pragati/*` | (Pragati sessions/escalations) |
| `/api/admin/signals/*` | `SignalIntelligencePanel` |
| `/api/admin/competency-questions` | `CompetencyQuestionsPanel` |
| `/api/admin/psychometric/*` | `PsychometricsPanel` |
| `/api/admin/curriculum/*` | `LearningPlansPanel` |
| `/api/admin/governance/*` | `GovernancePanel`, `EthicsGovernancePanel` |
| `/api/admin/feature-flags` | `FeatureFlagsPanel` |
| `/api/admin/rie/*` | All `RIE*Panel` |
| `/api/admin/roie/*` | All `ROIE*Panel` |
| `/api/admin/paie/*` | All `PAIE*Panel` |
| `/api/admin/lde/*` | All `LDE*Panel` |
| `/api/admin/iil/*` | All `IIL*Panel` |
| `/api/admin/nhda/*` | All `NHDA*Panel` |
| `/api/admin/spe/*` | All `SPE*Panel` |
| `/api/admin/bios/*` | All `BIOS*Panel` |
| `/api/concerns/admin/*` | `ConcernAreasPanel` |
| `/api/short-assessments/*` | `ShortAssessmentsPanel` |

---

## 7. Feature Flags

| File | Purpose |
|---|---|
| `backend/config/feature-flags.ts` | Source-of-truth flag registry (`FEATURE_FLAGS` const at L10) |
| `backend/routes/feature-flags.ts` | `/api/admin/feature-flags` GET/PATCH endpoints |
| `frontend/src/components/superadmin/FeatureFlagsPanel.tsx` (527 L) | UI to toggle, scope (global/tenant/user), and see live state |

Per `replit.md`, 10+ flags initialised at startup; every additive V2 phase is flag-gated (flag-off → protected routes 503 + UI panel hides).

---

## 8. Framework Panels Deep-Dive

`FrameworkPanel` renders a tabbed UI from a single config:

```ts
<FrameworkPanel config={LBI_CONFIG} />
<FrameworkPanel config={COMPETENCY_CONFIG} />
<FrameworkPanel config={SDI_CONFIG} />   // = CAPADEX
```

**Tabs derived from config**:

| Tab | Shown when config defines… |
|---|---|
| Domains | `domainsApi` |
| Subdomains | `subdomainsApi` |
| Norms | `normsApi` |
| Weights | `weightsApi` |
| Versions | `versionsApi` |
| Concerns | `concernsApi` |
| Short Assessments | `shortAssessmentsPanel: true` |
| Scoring Rules | `scoringRulesApi` |
| Clusters | `clusterCorrelationsApi` |
| Report Types | `reportTypesApi` |
| Import / Export | `exportApi` + `importApi` |

This config-driven approach means a fourth framework can be added by registering one more config object — no new UI code.

---

## 9. CRUD Pattern (`CrudTable`)

Every list/CRUD view follows the same shape:

```tsx
<CrudTable
  endpoint="/api/admin/<resource>"
  columns={[…]}
  formFields={[…]}
  searchableFields={[…]}
  onRowAction={…}
/>
```

`CrudTable` handles:
- Paginated fetch via TanStack Query (key = endpoint)
- Inline create / edit / delete
- Search + per-column filter
- Optimistic updates with toast feedback
- Empty / loading / error states
- Status workflow rendering (draft / approved / rejected / archived) when a `status` column exists

**Cache invalidation convention**: any mutation invalidates the resource's query key + the overview KPI key, so the home dashboard stays fresh.

---

## 10. Audit Log

| Concern | Where |
|---|---|
| Write helper | `backend/lib/audit.ts` → `writeAuditEvent(pool, { actor, action, target, metadata })` |
| Storage | Append-only audit tables per domain (`capadex_audit_events`, `wos_audit_logs`, etc.) |
| Read API | `GET /api/admin/audit` (paginated, filterable by actor/action/date) |
| Viewer | `SecurityPanel.tsx` |

Audit invariant: **never updated in place** — every change is a new row.

---

## 11. Conventions & Patterns

| Convention | Where it shows up |
|---|---|
| **Auth bookends** | `requireAuth, requireSuperAdmin` together on every admin route |
| **Envelope responses** | `{ data, requestId, …meta }` on most newer routes (`withEnvelope` helper) |
| **Draft → Approved workflow** | `QuestionBankPanel`, `CompetencyQuestionsPanel`, `ShortAssessmentsPanel` — manual POST always lands as `draft`; admins must explicitly PATCH to promote |
| **Lazy table creation** | New runtime tables created via `CREATE TABLE IF NOT EXISTS` on first endpoint call (`cra_profiles`, `employer_jobs`, etc.) |
| **Non-blocking hooks** | Post-completion / post-update side-effects always wrapped in try/catch — main response never fails because of a hook |
| **Append-only history** | `p4_competency_history`, `m3_*` history, `capadex_audit_events` — never mutated |
| **`DialogsErrorBoundary`** | Wraps every panel mount so one crash never kills the shell |
| **Feature-flag gating** | Every additive V2 phase ships behind a flag; flag-off → 503 backend + hidden UI panel |
| **k-anonymity** | Peer benchmarks suppressed below `k_min=30` in any cohort-aware admin view |

---

## 12. Common Debug Recipes

| Symptom | Where to look |
|---|---|
| 403 on every admin call | Verify `req.user.role === 'super_admin'` (`backend/routes.ts:4546`) |
| Login succeeds but redirects to user dashboard | `SuperAdminLogin` post-login screen routing (~L300) |
| Panel renders empty list | Open Network — check the endpoint declared in the panel's config / hook |
| New framework tab missing | Add the corresponding `*Api` key to the framework config in `framework-configs.ts` |
| Crisis Alert Inbox not updating | Polling interval in `CrisisAlertInbox.tsx` + `/api/admin/rie/escalations` |
| Feature-flag toggle does nothing | Most flags are read once at startup — confirm route reads via `getFeatureFlag(key)` per request |
| Pricing change not visible to users | `CapadexPricingPanel` writes to `capadex_stage_pricing`; users get fresh data via `/api/capadex/pricing` (no cache) |
| Audit row missing | Confirm endpoint calls `writeAuditEvent(...)` (`backend/lib/audit.ts`) |
| Dashboard state confused across tabs | Single source of truth is `useAdminDashboardState` — check if a panel forked local state |

---

## 13. Related Docs

- `docs/CAPADEX.md` — CAPADEX subsystem
- `docs/CAREER_BUILDER.md` — Career Builder
- `docs/COMPETENCY_ASSESSMENT.md` — Competency Assessment runtime
- `docs/phase-history.md` — Build logs for archived phases (BIOS · ROIE · PAIE · LDE · IIL · NHDA · SPE deep dives)
- `replit.md` — Feature map + Phase Index
