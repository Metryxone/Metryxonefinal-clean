# MetryxOne — 18-Month CTO Implementation Roadmap
**Prepared:** June 2026 · **Horizon:** 18 months (6 phases × 3 months each)

---

## Roadmap Philosophy

Every phase is **additive and flag-gated** — flag-off is byte-identical to the prior state. No phase ships without a stop-for-approval checkpoint. Activation (live + data-driven) is reported separately from structural completion (code exists). The roadmap is honest: structural readiness and activation readiness are never composited.

---

## Phase 1 — Foundation Hardening (Months 1–3)

### 1. Career Graph Intelligence System (CGI)
**Status:** IN_PROGRESS (Task #32)
16 `cg_*` tables; 5 pure engines; role graph + skill gap + readiness + recommendations + learning recs. Flag: `FF_CAREER_GRAPH`. Two new Career Builder tabs (`career-graph`, `career-recs`). Admin panel under "Career Intelligence."

### 2. Signal Grounding Completion
Resolve remaining 75% of bridge tags that lack signal bindings. Additive provenance-stamped `signal_reuse_linkage` rows only; never mutate `relational_bridge_tag`. Brings signal coverage from 25/328 → target 80%+. Flag: `FF_SIGNAL_GROUNDING_V2`.

### 3. Entitlement Enforcement Gate (WC-C4)
Every paid `stage_code` route enforces a session-UUID bearer check against `capadex_payments`. Gate reads server-side, never client-asserted. 402 fail-closed (not 503). Covers the 6×5 enforcement matrix established by the WC-C3 audit.

### 4. Clarity Import Quality Remediation
De-collide duplicate `question_id` rows in clarity XLSX imports (upsert-by-id silently drops questions). Apply shared bridge-tag classifier at import time. Backfill UNMAPPED residuals. Target: <5% UNMAPPED after backfill.

### 5. Subscription Package Entitlement Bridge
Migrate `users` table to add `email` column. Build identity bridge `email → children → student_subscriptions`. Confirms ₹299–₹1,499 price ladder is entitlement-wired, not just seeded. Stops for approval before migration runs on production.

### 6. Outcome Chain Crosswalk Activation
`FF_WC3_OUTCOME_CROSSWALK` + populated behavioural spine required. Wire `capadex_session_patterns` construct_key (currently missing → UNCLASSIFIED). Target: outcome routing coverage ≥60% on sessions with ≥3 responses.

### 7. PIL Graph Viability Gate
Add hard viability check to graph certifier: `nodes > 0 AND edges > 0 AND statements > 0` before any READY verdict. Prevents vacuous certification of an empty PIL graph. All `pil_kg_*` namespace, never bare `kg_*`.

### 8. Audit Artifact PII Masking
All audit/measure scripts that write `.md` files must mask user emails to irreversible `user_<sha256>` pseudonyms before `writeFileSync`. Honesty pass FAILS on PII exposure.

### 9. Express Route Order Audit
Full grep across all `routes/*.ts` for `/:id` catch-alls that precede literal sub-paths. Enforce literal-before-param convention platform-wide. Document in `docs/phase-history.md`.

### 10. Backend Compilation Gate (Frontend Only)
Vite build is the only real launch gate (prod runs `tsx` directly). Add a CI-equivalent frontend `vite build` check as the official launch readiness smoke test. Do not add a backend `tsc` gate.

---

## Phase 2 — Intelligence Activation (Months 4–6)

### 1. Learning Intelligence Platform (LIP) — Task #33
Structured learning journey engine: `lip_*` tables (learning paths, modules, progress tracking, completions). Pure orchestration over `cg_learning_recommendations` + ontology learning paths. User-facing "Learning Hub" tab upgrade. Flag: `FF_LIP`.

### 2. Longitudinal Behaviour Trend Activation
Wire `wcl0_user_intelligence` trend dimensions (motivation/confidence/risk/engagement/adaptability) into the WC-L1 trend math. NULL = missing, never 0. Report honest coverage (~22% dim-coverage at cold start). Flag: `FF_BEHAVIOUR_TREND_V2`.

### 3. CAPADEX Outcome Coverage Expansion
Reduce UNMAPPED residual in L5C crosswalk by remapping umbrella-token HIGH overreach vectors. Target: reachability ceiling from ~85.6% → 90%+. Never force a residual into a wrong model.

### 4. Peer Benchmarking Activation
Enforce k-anonymity (k_min=30) on all cohort aggregates. Wire `cg_benchmark_cohorts` with real readiness data once user volume crosses threshold. Report coverage as "not_measurable (0/0)" until threshold met.

### 5. WC-L3 Concern/Construct Linkage Repair
Re-run existing resolvers read-only: master 1→9/9, construct 2→5/9 observed lift. Lifts outcome routing from 3→9 and forecast from 0→2/2 without new capture. Mirror `resolveConstructsFromClarityBank` to measure outcome reachability.

### 6. Competency Assessment → CGI Bridge
Wire `competency_scores` into `cg_role_competency_map` for CGI readiness scoring. `cg_user_role_readiness.competency_score` activates. Requires real assessment volume to lift from null.

### 7. Pragati FSM Audit
13-state FSM smoke-test: verify all 8 block types reach terminal states without deadlock. Crisis-escalation pathway verified end-to-end. Adaptive density calibration validated against real session data.

### 8. Market Signal Seeding
Seed `cg_market_signals` with curated demand indices for top 50 roles. `demand_index` drives recommendation priority. Wire quarterly refresh job (admin-triggered, not auto-scheduled).

### 9. Recommendation Intelligence Deduplication
Grep all `routes/*.ts` for duplicate `method + path` pairs before adding any new route. One silent shadow kill is enough — enforce a route-dedup linting step pre-merge.

### 10. BIOS Intelligence Audit Reconciliation
Reconcile the 25% LBI coverage finding: 3 disconnected systems (A/B/C) all empty. Establish which system is the canonical product path. Stop-for-approval before any LBI consolidation work.

---

## Phase 3 — Future Readiness Platform (Months 7–9)

### 1. Future Readiness Platform (FRP) — Task #34
AI-skill taxonomy + occupation exposure mapping. `frp_*` tables (skill taxonomy, occupation models, user exposure tracking, reskill/upskill pathways). Reuses WC-9 construct vocab so outcomes activate day-1. Flag: `FF_FRP`.

### 2. Predictive Intelligence Activation
`predictive_intelligence` layer composes descriptive layers (never black-box). Wire archetype levers from resolved KG lineage only (never global LIMIT). Outcome coverage = 0 until realized outcomes exist — no accuracy claims before then.

### 3. WC-8 AI-Skill Taxonomy Unification
One shared AI-skill taxonomy (the WC-9 keystone asset). Merge `frp_skill_taxonomy` with `cg_skill_taxonomy` emerging skills. Boundary short-token inflation fix: naive 'ai' token inflated 50× — use compound-token matching.

### 4. Digital Twin Foundation
`dt_*` tables: user capability snapshot + longitudinal delta tracking. Pure read/compose over existing assessments, CAPADEX, EI. Never a new assessment instrument — only a composition layer.

### 5. Employability Passport Activation
`FF_EMPLOYABILITY_PASSPORT`. Snapshot at `career_seeker_profiles.data.passport` JSONB. Contact NEVER published. Wire passport visibility toggle into Career Builder profile tab.

### 6. Occupation Snapshot Schema Completion
W9 occupation targets need O*NET/ESCO bulk import, not manual seed. Implement idempotent batch import with `ON CONFLICT DO NOTHING`. ensureSchema lazy-init must NOT be blocked by `requireAuth`.

### 7. CSI Strengths Surfacing Audit
Strengths come ONLY from CSI `positive_factors` / positive longitudinal growth — NEVER from raw concern-signal magnitude. Audit all strength-display surfaces for compliance. Flag non-compliant surfaces as BLOCKED.

### 8. Learning Path Content Seeding
Seed `cg_learning_recommendations` with 200+ curated resources across top 20 skill gaps. Difficulty × cost_band matrix. Admin-editable; no auto-generation.

### 9. Report Factory Foundation — Task #36
`rf_*` tables: report templates, stakeholder profiles, generation jobs, delivery log. Unified report generation API replacing ad-hoc per-module report routes. Flag: `FF_REPORT_FACTORY`.

### 10. Governance Workflow Hardening
All commercial operations (safety check → ledger ownership → offer fit) must fail CLOSED, not open. Never sell into a stub. D6 low-confidence → show_options, never auto-sell.

---

## Phase 4 — Career Lifecycle Platform (Months 10–12)

### 1. Learning Intelligence Platform Completion (LIP) — Task #35
Full lifecycle: learning path completion tracking, skill evidence auto-update on completion, CEU/certification credit logging, employer-visible achievement export. Integration with EI Passport.

### 2. Longitudinal Career Intelligence
`lci_*` tables: career timeline snapshots, velocity tracking, trajectory analysis. Pure composition over `cg_user_graph_snapshots` + `mei_score_history` + CAPADEX longitudinal. Never a new assessment.

### 3. WC-C6 Subscription Productization
Subscription package → entitlement permanently wired (currently disjoint). Resolver reads ledger + features col (migration required). ₹299–₹1,499 price ladder confirmed sellable with real entitlement delivery. Stop-for-approval before migration.

### 4. Mentor Intelligence Layer
Mentor matching goes beyond universal-fallback stub. `mentor_match_*` tables: mentor profiles (competency-tagged), availability, session records. Matching uses CGI role graph + CAPADEX concern proximity. k-anonymity on aggregate rating display (k≥5).

### 5. Competency Framework Parity Audit
`lbi_*` / `sdi_*` / `competency_*` framework parity check. Every framework must have: question bank populated, scoring rubric defined, and at least one completed assessment in the system. Report gaps honestly — do not hide 0% frameworks.

### 6. CAPADEX Commercial Activation
WC-7C: commerce reads (safety + ledger ownership) fail CLOSED. Stage prices locked in `capadex_payments` and `STAGE_PRICES` kept in lockstep. Duplicate constants = maintenance trap — single source of truth.

### 7. Enterprise Analytics Architecture (EAA) — Task #37
`eaa_*` tables: org-level analytics, cohort intelligence, talent gap dashboards. Aggregates CGI + EI + CAPADEX across org dimensions. k-anonymity k=30 on all cohort outputs. Flag: `FF_EAA`.

### 8. Notification Intelligence
`notification_*` tables: intelligent notification scheduling (not blast). Delivery timing based on session recency + engagement signals. Never send to users who haven't consented. ZOHO email integration required.

### 9. Security Remediation Completion
WC-C8A: MFA verify sanitizes password hash. `crypto.scrypt` (not `crypto.hash` which doesn't exist). G15 Razorpay smoke-test + MFA e2e verified before any commercial launch. CONDITIONAL GO ≠ GO when e2e paths are untested.

### 10. PIL Phase 8 Graph Stabilization
PIL KG is `pil_kg_*` namespace permanently. Graph certifier viability gate live. Similarity engine bulk-upsert (per-row approach, not 40k-row hang). Explainability = refs-resolve not shared>0.

---

## Phase 5 — Intelligence Mesh (Months 13–15)

### 1. AI Governance Platform — Task #38
`aig_*` tables: model card registry, fairness audit logs, bias detection events, governance workflow states. Every AI-adjacent output ships an allowed/disallowed term list. Language policy enforcement automated.

### 2. Cross-Platform Intelligence Bus
Upgrade `adaptive-event-bus.ts` to handle cross-module intelligence sync. Identity-space trap permanently fixed: event-log `user_id` is BIGINT, career-seeker ids are UUID — never `Number()` coerce across boundaries.

### 3. Real-Time Readiness Updates
Career graph readiness updates trigger on: new assessment completion, new skill evidence added, CAPADEX session completion. Fire-and-forget hook at each event source. Uses existing `cg_user_role_readiness` UPSERT.

### 4. Cohort Intelligence Activation
`cg_benchmark_cohorts` population crosses k=10 threshold on major roles. Begin surfacing percentile benchmarks in Career Graph tab. Report cohort size and methodology transparently.

### 5. Multi-Stakeholder Report Intelligence
WC-3 L5 full chain live: stage → outcome → journey → personalization. 4 stakeholder report types (candidate / parent / counsellor / employer) each with tone-appropriate language and allowed/disallowed term enforcement.

### 6. Pragati Longitudinal Activation
Pragati session history feeds `career_behavioural_signals`. Concern pattern evolution visible in Career Builder Behavioural Growth tab. FSM state persisted across sessions (resume capability active).

### 7. SPE (Scientific Psychometric Engine) Activation
IRT calibration + adaptive difficulty for CAPADEX question bank. SPE scoring replaces simple percent-correct. Adaptive bank requires min 300 calibrated items per concern cluster. Stop-for-approval before replacing legacy scorer.

### 8. K-Anonymity Platform Audit
Audit all cohort-display surfaces platform-wide. Document k_min per surface in `docs/SUPERADMIN.md`. Any surface below k_min shows "Insufficient data" — never suppresses silently.

### 9. Workforce Intelligence Activation
Enterprise-level workforce capability gap maps powered by CGI + EAA. Org-level heatmaps aggregate readiness scores with k=30 minimum. Employer dashboard (`?screen=employer-dashboard`) is the entry point.

### 10. Performance & Scalability Baseline
Establish baseline p95 latency per major route. Cache TTL audit: `cg_readiness_weights` and `wcl0_user_intelligence` are hot paths — document cache invalidation policy. Backend restarts on every new route file (documented convention).

---

## Phase 6 — Platform Maturity & Launch Readiness (Months 16–18)

### 1. Production Deployment & Health Monitoring
Deploy to production via `suggest_deploy`. Set deployment-pane secrets (DECISION_REQUIRED for owner-decided gates). Post-deploy health check: all CGI routes return 200 or correct 503 when flag-off. Deployment logs monitored via `fetch_deployment_logs`.

### 2. Revenue Activation
First ₹299 transaction captured in `capadex_payments`. Entitlement delivered to `student_subscriptions`. Renewal ladder activated for `package` model users. Activation = first real revenue, not engineering completion.

### 3. CAPADEX → Career Builder Full Bridge
`career-behavior-adapter.ts` fully adopted: per-job ranking modifiers use per-row feature (not user scalar). `session_id` non-null guard live. Consumer tabs thread optional `behavior?` argument — absent = byte-identical to before.

### 4. Longitudinal Coverage Honest Reporting
Longitudinal trend dashboard shows honest dim-coverage (~22% cold-start). Null = missing, 0 = measured zero. Graph shows "No data" for users with <2 sessions. No fabricated trend lines.

### 5. Launch Validation Evidence Package
Evidence-derived GO/NO-GO per the `launch-validation-evidence-integrity.md` rules: no hardcoded PASS rows, no caught errors masquerading as findings, PII masked in prose, rotation = "mechanism armed (restart required)" not "rotated."

### 6. CAPADEX Assessment Quality Gate
Question Registry governance live: low-signal/unused buckets gate on SYSTEM-WIDE usage (no cold-start flood). Status transitions human-only. Dedup by group key. Adaptive bank requires min 300 calibrated items.

### 7. Competency × CGI Deep Integration
`competency_scores` fully wired into `cg_role_competency_map`. Assessment completion triggers readiness recompute via fire-and-forget hook. MEI v2 score feeds CGI `experience_score` component via `mei_scores` table join.

### 8. Tenant / Multi-Org Readiness
`tenants` table wired to CGI org-level aggregates. Each tenant sees only their cohort data (row-level security via `tenant_id` filter). Enterprise Analytics Architecture (EAA) tenant-scoped by design.

### 9. Full Platform Audit
One complete platform audit: structural coverage (code exists) vs activation coverage (data-driven + live) per module. Report as two independent axes — never composite. Publish findings in `audit/launch-readiness/`.

### 10. Post-Launch Monitoring Baseline
Define SLOs per module. Alert on: readiness computation failures, entitlement enforcement bypass, k-anonymity violation attempts, signal ingest drops. Monitoring dashboard in EAA admin panel. Zero silent failures.

---

## Dimension Summary Table

| Dimension               | Ph 1 | Ph 2 | Ph 3 | Ph 4 | Ph 5 | Ph 6 |
|-------------------------|------|------|------|------|------|------|
| Career Graph (CGI)      | ✅   | 🔧   | 📈   | 📈   | 📈   | ✅   |
| Signal Grounding        | 🔧   | 📈   | ✅   | —    | —    | —    |
| Entitlement / Commerce  | 🔧   | 🔧   | 🔧   | ✅   | —    | ✅   |
| Learning Intelligence   | —    | 🔧   | 📈   | ✅   | —    | —    |
| Future Readiness (FRP)  | —    | —    | 🔧   | 📈   | ✅   | —    |
| Longitudinal / Trend    | —    | 🔧   | —    | 📈   | ✅   | ✅   |
| Predictive Intel        | —    | —    | 🔧   | —    | ✅   | —    |
| Enterprise Analytics    | —    | —    | —    | 🔧   | ✅   | ✅   |
| AI Governance           | —    | —    | —    | —    | 🔧   | ✅   |
| Revenue / Commercial    | 🔧   | 🔧   | —    | ✅   | —    | ✅   |

Legend: ✅ Complete · 🔧 In progress · 📈 Activating · — Not in scope this phase

---

## Hard Constraints (never violate across all phases)

1. **Additive only** — flag-off is byte-identical to prior state.
2. **Stop for approval** before every phase merge/deploy.
3. **Honesty over optimism** — structural ≠ activation; never composite.
4. **k-anonymity** — k=30 cohort outputs, k=10 CGI readiness stats.
5. **Language policy** — developmental signals only; no hiring/promotion/suitability predictions.
6. **Express route order** — literal sub-paths before `/:id` catch-alls, always.
7. **PIL namespace** — `pil_kg_*` only; bare `kg_*` is the live Employability graph.
8. **Strengths canon** — from CSI `positive_factors` / positive growth only; never raw signal magnitude.
9. **Secrets** — via environment-secrets skill only; never in code or audit artifacts.
10. **Never auto-deploy** — user explicit `suggest_deploy` only.
