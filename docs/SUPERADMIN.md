# SuperAdmin — End-to-End Documentation

**Module**: MetryxOne · SuperAdmin Console
**Audience**: engineers + operators
**Companion**: `backend/audit/superadmin/AUDIT.md` (honest audit of this surface)
**Default creds (dev)**: `support@metryxone.com` / `admin123` (rotate via `SUPERADMIN_INITIAL_PASSWORD`)

> This doc has three lenses on the same system: **Functional** (what it does / who uses it), **Technical** (how it is built), and **Logical** (the rules and data-flow that hold it together), followed by **End-to-end flows** and operational reference. Detail that lives elsewhere is linked, not duplicated (`docs/CAPADEX.md`, `docs/phase-history.md`, `replit.md`).

---

## PART A — FUNCTIONAL

### A1. What the SuperAdmin Console is
A single React shell that is MetryxOne's operations cockpit. One logged-in `super_admin` can manage every platform concern from here: users & organisations, the assessment frameworks lab (LBI · SDI · Competency), the entire CAPADEX behavioural-intelligence stack and its ontology data, the advanced intelligence engines (BIOS · ROIE · PAIE · LDE · IIL · NHDA · SPE · RIE), the Talent / Vision-X / Career-Graph / Employability / Future-Readiness suites, pricing & financials, governance / fairness / ethics, reporting, feature flags, security/audit, and content.

### A2. Who uses it
Exactly one privileged role: `super_admin`. There is no self-service path to this role — `POST /api/register` ignores any `super_admin` request and falls back to `parent`; the account is created only by the server-side seeder. Non-admin "platform access" links (Mentor Marketplace, LBI Assessment, Parent / Student portals) are quick jumps into other product surfaces, not part of the admin authority.

### A3. The navigation map (20 groups)
The sidebar groups ~166 destinations into 20 logical sections (defined in `frontend/src/hooks/useAdminDashboardState.tsx`). Groups collapse by default; the group owning the active tab auto-opens; a search box filters every item by name; "Advanced Labs" holds the experimental engine panels.

| # | Group | What it manages | Representative tab ids |
|---|---|---|---|
| 1 | **Overview** | Home KPIs / live stats | `overview` |
| 2 | **Frameworks** | LBI & Competency framework labs + reports browser | `lbi-fw`, `competency-fw`, `reports` |
| 3 | **CAPADEX** | CAPADEX framework + cohort/funnel/intervention/pricing/reports | `capadex-fw`, `capadex-users`, `capadex-analytics`, `capadex-interventions`, `capadex-pricing`, `capadex-reports` |
| 4 | **CAPADEX Intelligence** | Runtime engines: signals, pipeline, CSI, concern/ontology, coverage, registry, archetype/human/intervention, search-intent, simulation | `signal-intelligence`, `intelligence-pipeline`, `csi-intelligence`, `concern-intelligence`, `concern-signal-map`, `ontology-matrix`, `coverage-dashboard`, `question-registry`, `archetype-intelligence`, `human-intelligence`, `intervention-intelligence`, `search-intent`, `simulation-validation` |
| 5 | **BIOS & Governance** | LBI intelligence, predictive, conversational quality, runtime intelligence, AI governance, tenants | `lbi-intelligence`, `predictive-intelligence`, `conv-quality`, `runtime-intelligence`, `ai-governance`, `tenants` |
| 6 | **Career Intelligence** | Career-graph admin + pathway/occupation/recommendation/forecast/transition analytics | `career-graph-admin`, `career-pathway-analytics`, `occupation-analytics`, `recommendation-analytics`, `forecast-analytics`, `transition-analytics` |
| 7 | **Talent Foundation** | Role families, competency blueprints/mappings, level profiles, scoring, gaps, pipeline | `role-families`, `competency-blueprints`, `blueprint-mappings`, `level-profiles`, `talent-scoring`, `talent-gaps`, `talent-pipeline` |
| 8 | **Talent Intelligence** | Competency intelligence, signal master, concern intelligence, competency DNA, readiness/digital-twin/outcome/benchmark/measurement/warehouse | `competency-intelligence-admin`, `talent-signal-master`, `talent-concern-intelligence`, `talent-competency-dna`, `talent-readiness-engine`, `talent-digital-twin-admin`, `talent-outcome-prediction`, `talent-benchmark-engine`, `talent-measurement-science`, `talent-analytics-warehouse` |
| 9 | **Vision-X Intelligence** | Capability architecture, labor-market, evidence, tenant config, assessment runtime, science council, workforce KG, IRT, report intelligence | `vx-capability-architecture`, `vx-labor-market-intelligence`, `vx-evidence-intelligence`, `vx-tenant-configuration`, `vx-assessment-runtime`, `vx-competency-science-council`, `vx-workforce-knowledge-graph`, `vx-irt-engine`, `vx-report-intelligence` |
| 10 | **Employability & Future Readiness** | EI health, MEI v2 design, FRP admin, FRP enrichment | `ei-health`, `mei-v2-design`, `frp-admin`, `talent-frp-enrichment` |
| 11 | **Learning & Passport** | Learning-intelligence admin, learning catalog, passport stats | `lip-admin`, `talent-learning-catalog`, `passport-stats-admin` |
| 12 | **Competency Ontology** | 12-layer ontology CRUD (industries→roles→competencies→indicators→paths) + AI rules + import/export | `ont-overview`, `ont-industries`, `ont-functions`, `ont-departments`, `ont-role-families`, `ont-roles`, `ont-career-tracks`, `ont-competency-levels`, `ont-indicators`, `ont-benchmarks`, `ont-career-paths`, `ont-learning-paths`, `ont-future-skills`, `ont-layers`, `ont-clusters`, `ont-competencies`, `ont-micro-competencies`, `ont-concerns`, `ont-assessment-questions`, `ont-ai-rules`, `ont-import-export` |
| 13 | **Assessment Factory** | Question bank, scenarios, difficulty, builder, randomization, sessions, scoring, analytics | `caf-question-bank`, `caf-scenarios`, `caf-difficulty-level`, `caf-assessment-builder`, `caf-randomization`, `caf-sessions`, `caf-scoring`, `caf-analytics` |
| 14 | **Assessment Config** | Master question bank, competency questions, custom modules, scoring | `questionbank`, `competency-questions`, `custom-modules`, `scoring` |
| 15 | **Reporting & Analytics** | Report Factory admin, enterprise analytics warehouse | `report-factory-admin`, `enterprise-analytics` |
| 16 | **Users & Orgs** | User mgmt, parents, students, institutions, HR, mentors, employer onboarding | `usermgmt`, `parents`, `students`, `institutions`, `hr`, `mentors`, `employer-onboarding` |
| 17 | **Platform** | Pricing, learning plans, content, documents, entity codes, consents, access control | `pricing`, `learning`, `content`, `documents`, `codes`, `consents`, `access` |
| 18 | **Operations** | Platform audit, approvals, ontology governance | `platform-audit`, `approvals`, `ont-governance` |
| 19 | **System** | Financials, security, notifications, reference intelligence, feature flags, settings | `financials`, `security`, `notifications_mgmt`, `reference-intelligence`, `feature-flags`, `settings` |
| 20 | **Advanced Labs** (collapsible) | Experimental engines: cognitive, digital twin, psychometrics, semantic, memory, ethics/fairness, SPE·BIOS·ROIE·PAIE·LDE·RIE families | `cognitive-intelligence`, `digital-twin`, `psychometrics`, `semantic-reasoning`, `memory-architecture`, `ethics-governance`, `fairness-engine`, `spe-*`, `bios-*`, `roie-*`, `paie-*`, `lde-*`, `rie-*` |

### A4. Primary operator workflows
- **Sign in** with MFA (see D1).
- **Manage a framework** (LBI/SDI/Competency): edit domains/subdomains/norms/weights/versions, import/export CSV — all from one `FrameworkPanel` driven by config.
- **Curate CAPADEX ontology**: Concerns Master (~2,489), Clarity Questions (~30,638), 4-tier Signal Ontology Hub (~15,972 atomic). CRUD + facets + multi-mode CSV import + coverage analysis.
- **Run the reports console**: browse/curate CAPADEX/LBI/SDI/Competency reports through the `pending → in_review → approved → published` lifecycle; preview report emails.
- **Triage crisis**: Crisis Alert Inbox surfaces high-priority RIE escalations needing human review.
- **Toggle features**: flip flags globally or per-tenant.
- **Pricing & financials**: maintain subscription packages and stage pricing; view revenue.
- **Governance**: review decision traces, fairness/ethics audits, the audit log.

---

## PART B — TECHNICAL

### B1. Stack & entry
- Frontend React + Vite (`frontend/`, dev port 5000). Backend Node + Express on `tsx` (`backend/`, port 8080). Postgres via Drizzle + raw `pg` pools. `/api/*` proxied to `:8080` by `frontend/vite.config.ts`.
- Entry: `frontend/src/App.tsx` mounts `SuperAdminDashboard` when `screen === 'admin-dashboard'`. If unauthenticated the dashboard renders `SuperAdminLogin`.

### B2. Frontend architecture
| Concern | Where |
|---|---|
| Shell | `frontend/src/components/SuperAdminDashboard.tsx` — sidebar + sticky header (toggle, active-tab label, global search, Crisis Inbox, notifications, settings) + scrollable content area |
| State | `frontend/src/hooks/useAdminDashboardState.tsx` (~2.9k lines) — single source of truth: `activeTab`, sidebar/collapse, filters, dialogs, selections, search; persists `activeTab` to `localStorage` (`sa_active_tab`), defaults `overview` |
| Context | `frontend/src/contexts/AdminDashboardContext.tsx` — provides the hook's state to the whole tree |
| Sidebar | `frontend/src/components/admin/AdminSidebar.tsx` — search + 20 collapsible accordion groups + Advanced Labs accordion + Platform Access + Logout |
| Routing | **State-based** (not URL). A large conditional block in `SuperAdminDashboard.tsx` maps each `activeTab` id → a panel component. `menuItems = navGroups.flatMap(g => g.items)`; if `activeTab` isn't a known id it falls back to `overview` |
| Panels | ~163 components in `frontend/src/components/superadmin/*` + 8 in `superadmin/caf/*`, plus shared primitives in `admin/*`. Imported **statically** (no `React.lazy`) → instant tab switch, large initial chunk |
| Error isolation | every panel mount is wrapped in `DialogsErrorBoundary` so one panel crash never kills the shell |
| Data fetching | hybrid: TanStack Query for cached server state (overview stats, many panels) + native `fetch` for one-off mutations / older panels |

### B3. Shared admin primitives (`frontend/src/components/admin/`)
| Primitive | Role |
|---|---|
| `CrudTable.tsx` | generic searchable/filterable list with inline create/edit/delete; status workflow rendering; optimistic updates; loading/empty/error states |
| `FrameworkPanel.tsx` + `framework-configs.ts` | config-driven framework UI — one config object (`LBI_CONFIG`, `COMPETENCY_CONFIG`, `SDI_CONFIG`) yields 8–12 tabs (Domains · Subdomains · Norms · Weights · Versions · Concerns · Short Assessments · Scoring · Clusters · Report Types · Import/Export). A new framework needs **no new UI code** |
| `AdminDialogs.tsx` | central modal repository, single mount point |
| `ImportExportPanel.tsx` | reusable CSV/JSON import + export |
| `parity-tabs.tsx` | LBI/SDI framework-parity multi-tab orchestration |

### B4. Backend authentication & session
| Concern | Where / value |
|---|---|
| Login | `POST /api/login` (`backend/routes.ts` ~L431) — `passport-local`, scrypt password compare (`backend/routes.ts` ~L235–252, format `hex(hash).hex(salt)`) |
| Session | `express-session` + `connect-pg-simple`, table `express_sessions`. Cookie `mx.sid`; `httpOnly:true`, `sameSite:lax`, `secure:true` in prod; `trust proxy = 1` |
| `requireAuth` | `backend/routes.ts` ~L354 — checks `req.isAuthenticated()` |
| `requireSuperAdmin` | `backend/routes.ts` ~L4828 — passes only if `req.user.roles.includes('super_admin')` **or** `req.user.role === 'super_admin'`; else **403** (fails closed) |
| Seeding | `backend/storage.ts` `seedSuperAdmin()` ~L4133 — canonical username `support@metryxone.com`, password from `SUPERADMIN_INITIAL_PASSWORD` else `admin123`; setting the env var rotates the password + canonicalises the username on next boot |
| Role model | `users` has both `role` (string) and `roles` (string[]); the platform is migrating single-role → multi-role, so guards check both. `SELF_REGISTER_ROLES` allowlist blocks privilege escalation at registration |

### B5. MFA (mandatory for super_admin)
- On a valid super_admin credential, `/api/login` does **not** create a session. It generates a 6-digit code + a 32-byte `attemptToken`, writes a `mfa_codes` row (5-minute expiry), and emails the code via Zoho (`backend/email.ts` `sendMfaCode`). Response: `{ mfaRequired:true, attemptToken, mfaEmail (masked), emailSent }`.
- `POST /api/admin/mfa/verify` (`backend/routes.ts` ~L470): validates `{code, attemptToken}` against an unused, unexpired row; max **5 attempts** (429 thereafter); marks the row `used=true` atomically; only then `req.login(user)` finalises the session.
- **Dev**: with `ZOHO_EMAIL`/`ZOHO_APP_PASSWORD` absent, `emailSent:false` — read the code from the `mfa_codes` table to finish login.

### B6. Backend admin API surface
All admin endpoints sit under `/api/admin/*` (plus a few framework bases like `/api/lbi/admin/*`, `/api/sdi/admin/*`, `/api/concerns/*`, `/api/short-assessments/*`, `/api/analytics`, `/api/governance/ai`). The guard is `requireAuth, requireSuperAdmin` — now enforced **authoritatively** by one global `app.use('/api/admin', requireAuth, requireSuperAdmin)` gate (mounted right after `requireSuperAdmin` is defined; single exemption: `/api/admin/lbi-catalog`, which allows any authenticated user). Per-route guards (inline, spread arrays `const guard = [requireAuth, requireSuperAdmin]`, and `app.use('/api/admin/<x>', …)`) are retained as defence-in-depth. The pre-login MFA routes (`/api/admin/mfa/verify`, `/api/admin/mfa/resend`) are registered before the gate and stay public.

| Area | Base | Ops | Tables | Cache | Status |
|---|---|---|---|---|---|
| Tenants | `/api/admin/tenants` | CRUD + stats + toggle | `tenants` | none | real |
| Frameworks | `/api/lbi/admin/*`, `/api/sdi/admin/*`, `/api/competency/*` | CRUD domains/subdomains/clusters/norms/weights, versioning, import/export | `lbi_*`, `sdi_*`, `competency_*` | none | real |
| Competency Questions | `/api/admin/competency-questions` | CRUD + stats + AI draft generation (manual POST → `draft`) | `competency_question_templates` | none | real |
| CAPADEX Concerns Master | `/api/admin/capadex/concerns-master` | CRUD + stats + facets + multi-mode CSV import + export | `capadex_concerns_master` | lazy DDL | real |
| Clarity Questions | `/api/admin/capadex/clarity-questions` | CRUD + facets + coverage vs master + export | `capadex_clarity_questions` | none | real |
| Ontology Hub | `/api/admin/capadex/ontology-hub` | read 4-tier + stats + orphan coverage + export | `capadex_domains/families/signals/atomic_signals` | none | real |
| Report Factory | `/api/admin/rf` | CRUD templates/sections/blocks/rules/viz + preview | `rf_*` | **60s** `?refresh=1` | real (`FF_REPORT_FACTORY`) |
| Feature Flags | `/api/admin/feature-flags` | list + WS status + global/tenant override | `feature_flags`, `feature_flag_tenant_overrides` | in-memory cache | real |
| Employer Admin | `/api/admin/employers` | list + onboard (user+org+member+profile) + password reset | `users`, `employer_*` | none | real |
| EI Health | `/api/admin/ei` | health + data quality + events + analytics + consistency | `occupations`, `skills`, `occupation_pathways`, `ei_events`, … | **60s** `?refresh=1` | real |
| RIE Admin | `/api/admin/rie` | dashboard + CRUD interventions/escalations/counsellors + crisis inbox + recovery | `rie_*`, `counsellors` | none | real (⚠ see audit) |
| Career Passport | `/api/passport` (+admin analytics/sync) | sections CRUD + sync + share tokens + verification | `cp_*` | flag-gated | real (`FF_CAREER_PASSPORT`) |
| Enterprise Analytics | `/api/analytics` | status + refresh + executive/KPI/cohort/benchmark/predictive + event lake | `anl_*` | flag-gated | real (`enterpriseAnalytics`) |
| AI Governance | `/api/governance/ai` | dashboard + prompt repo (versioned) + test cases + model registry + workflows | `aig_*` | per-request | real (`FF_AI_GOVERNANCE`); audit-logged + 60/min rate limit |
| PAIE Governance | `/api/admin/paie`, `/api/paie/*` | simulation run, multi-agent invoke/orchestrate, model evolution, meta-prediction, fairness | `paie_*` | per-request | **mix of logic + synthetic stubs** (`rnd()`); now super-admin-gated (global `/api/admin` gate + `app.use('/api/paie', …)`) — audit F1 remediated |

### B7. Feature flags — two distinct systems
1. **File registry** `backend/config/feature-flags.ts` (`FEATURE_FLAGS` const) — every additive V2 phase ships behind a flag; flag-off → protected route returns 503 + the UI panel hides; flag-off path is byte-identical to legacy. All default OFF (overridden on in the `Backend API` workflow command).
2. **DB table** `feature_flags` (+ `feature_flag_tenant_overrides`) — gates signal ingest and engine flags read by `services/feature-flags.ts`; supports per-tenant overrides.

### B8. Audit log
- Write: `backend/lib/audit.ts` `writeAuditEvent(pool, {actor, action, target, metadata})`.
- Storage: append-only per-domain tables (`capadex_audit_events`, etc.) — **never updated in place**.
- Read: `GET /api/admin/audit` (paginated/filterable) → `SecurityPanel.tsx`.

---

## PART C — LOGICAL (the rules that hold it together)

1. **Auth bookends, fail closed.** Every admin action runs `requireAuth` then `requireSuperAdmin`, so a missing/non-admin identity yields 401/403, never a partial result. **This is now enforced by a single authoritative `app.use('/api/admin', …)` global gate** (audit F1/F3 remediated), with per-route guards kept as defence-in-depth. The gate's one exemption is `/api/admin/lbi-catalog` (any authenticated user). The pre-login MFA routes are mounted before the gate and remain public by design.
2. **Additive / flag-gated / never-throws.** New phases re-shape already-computed data behind a flag. Flag-off or absent data ⇒ byte-identical prior behaviour. Engines never fabricate; post-completion hooks are wrapped so the main response never fails because of a side-effect.
3. **Config over code.** Frameworks and most list views are config/`CrudTable`-driven; bespoke panels exist only for non-CRUD workflows (Crisis Inbox, simulators).
4. **Draft → Approved discipline.** Question banks and reflections land any manual creation as `draft`; promotion to `approved`/`published` is an explicit, human-only transition.
5. **Append-only history.** History tables (`p4_competency_history`, `m3_*`, audit events) are never mutated.
6. **Honesty axes.** Coverage (does data exist) and Confidence (is it trustworthy/sufficient) are reported separately; orphans/gaps are honest findings, never hidden. Outputs are **developmental signals only** — never hiring/promotion/suitability predictions.
7. **k-anonymity.** Cohort/peer views suppress below `k_min = 30`.
8. **Lazy ensure-schema.** Many newer tables are created on first endpoint call via `CREATE TABLE IF NOT EXISTS`; where that is missing, the table must be created by migration (this is the root of the RIE finding in the audit).
9. **Route-order rule.** Register literal sub-paths (`/export.csv`) before the catch-all `/:id`, or the param handler swallows them.
10. **State single-source.** All dashboard state lives in `useAdminDashboardState`; panels must not fork local copies of shared state.

---

## PART D — END-TO-END FLOWS

### D1. Login + MFA
```
SuperAdminLogin → POST /api/login (scrypt verify, role check)
   └─ super_admin? → write mfa_codes row + email code (Zoho) → { mfaRequired, attemptToken }
        └─ enter code → POST /api/admin/mfa/verify (≤5 tries, atomic used=true) → req.login()
             └─ SPA sets screen='admin-dashboard' → SuperAdminDashboard mounts
   (dev: ZOHO absent → emailSent:false → read code from mfa_codes table)
```

### D2. CRUD on a managed resource
```
Panel (CrudTable) → GET /api/admin/<resource> (TanStack Query)
   └─ create/edit/delete → POST/PATCH/DELETE → writeAuditEvent → invalidate query key + overview KPIs
```

### D3. Crisis escalation triage
```
RIE pipeline writes rie_escalations → CrisisAlertInbox polls /api/admin/rie/escalations/unread
   └─ super_admin acknowledges / assigns counsellor → PATCH rie_escalations (mandatory_human_review respected)
```

### D4. Report lifecycle
```
Reports console → UnifiedReportsPanel → CapadexReportsPanel
   status: pending → in_review → approved → published
   email preview: X-Preview-Subject header MUST be encodeURIComponent(subject) (ASCII-only headers)
```

### D5. Feature flip
```
FeatureFlagsPanel → PATCH /api/admin/feature-flags (global or tenant override)
   file-registry flags: read per-request via getFeatureFlag(); some engine flags read at startup (restart to apply)
```

---

## PART E — OPERATIONAL REFERENCE

### E1. Debug recipes
| Symptom | Where to look |
|---|---|
| 403 on every admin call | confirm `req.user.role==='super_admin'` or `roles` includes it (`backend/routes.ts` ~L4828) |
| Login stuck after password | you're at the MFA step — fetch the code from `mfa_codes` in dev |
| New backend admin route 404 (`Cannot GET`) | restart the `Backend API` workflow |
| Panel renders empty | check the endpoint in the panel's config/hook in Network |
| New framework tab missing | add the `*Api` key to the config in `framework-configs.ts` |
| Crisis Inbox badge 500s | `rie_escalations` table missing — run its migration (audit F2) |
| Feature toggle no-op | engine flags read at startup — restart; file-registry flags read per request |
| Dashboard state confused across tabs | a panel forked local state instead of `useAdminDashboardState` |

### E2. Related docs
- `docs/CAPADEX.md` — CAPADEX subsystem (engines, runtime modules, API reference)
- `docs/phase-history.md` — phase build logs + index tables (BIOS · ROIE · PAIE · LDE · IIL · NHDA · SPE)
- `replit.md` — feature map + conventions + flag systems
- `backend/audit/superadmin/AUDIT.md` — **the audit of this surface (read alongside this doc)**

> **Doc accuracy note**: prior revisions of this file stated `superadmin@metryx.one` creds, "optional MFA", a 5-group sidebar, and an 84-panel count. Those were stale; the values here are verified against source as of this revision. See audit F4.
