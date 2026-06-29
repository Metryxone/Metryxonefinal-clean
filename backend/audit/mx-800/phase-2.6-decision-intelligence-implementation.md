# MX-800 Phase 2.6 — Decision Intelligence Engine (Implementation)

**Status:** Built · flag-gated OFF byte-identical (incl. schema) · validator 54/54 · architect reviewed (PASS; 1 non-blocking `explainDecision` basis nit RAISED → FIXED → re-validated) · **STOP for approval — NO deploy.**

## What this is
An **ENHANCEMENT-ONLY, read-only** intelligence tier that **CATALOGS** the platform's already-shipped
**decision capabilities** and **COMPOSES** the prior intelligence tiers (2.1 platform / 2.3 engineering /
2.4 runtime / 2.5 knowledge) into **EXPLAINABLE DECISION SUPPORT**. It introduces no new business logic,
no rebuild/V2, no parallel/duplicate decision/rule/recommendation engine, and **no dormant activation** —
building it turns nothing on. It composes the EXISTENCE and PERSISTED OUTPUT of the dormant decision
engines (decisionOrchestrator / decisionPersistence / decisionMentorBridge) read-only; it **NEVER
invokes** them. This tier **SUGGESTS support, never DECIDES**; human approval remains mandatory.

- **Flag:** `decisionIntelligenceEngine` / `FF_DECISION_INTELLIGENCE_ENGINE` (default **OFF**).
  Helper `isDecisionIntelligenceEngineEnabled()` in `backend/config/feature-flags.ts`.
- **Base:** `/api/admin/decision-intelligence`
- **Service:** `backend/services/decision-intelligence.ts`
- **Route:** `backend/routes/decision-intelligence.ts`
  (`registerDecisionIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin)`), wired in `routes.ts`.
- **Migration:** `backend/migrations/20261225_decision_intelligence.sql` — 2 tables
  `decision_registry` + `decision_intelligence_audit_snapshots` (the ONLY tables this engine owns).
- **Read-only substrate (NEVER written, COUNT-only):** `wc7b_decision_state`, `ai_decision_audits`,
  `executive_decision_models`, `interview_decisions`, `role_resolution_decisions`,
  `wc3_personalization_decisions`, `archetype_governance_decisions`, `m4_ai_decision_logs`,
  `m5_executive_decision_audits`, plus the prior-tier read-only getters
  (`getPlatformSummary` / `getEngineeringSummary` / `getRuntimeSummary` / `getKnowledgeSummary`) and the
  MX-800 2.1 `platform_intelligence_registry` (`intel.decision`) / MX-700 `platform_lifecycle_catalog`
  soft links.

## 9 parts (+ registry / summary / audit)
1. **Decision Registry / Catalog** — `/catalog` + `/registry` + `/registry/:uid` + `POST /discover` +
   `POST /register`: an 11-entry **curated catalog of EXISTING decision capabilities** (all engine files
   + 9 decision tables DB-verified). `present` is DERIVED (table OR engine substrate present);
   `table_count` is exact `COUNT(*)` or honest-null; `flag_state` reported (Built ≠ Activated; null when
   unverified). `lifecycle_uid` SOFT-links `platform_lifecycle_catalog`, `intelligence_uid` SOFT-links
   `platform_intelligence_registry` (incl. `intel.decision`) — only when present, else honest null.
   `owner`/metadata MANAGED (preserved on re-discover) ⟂ measurement DERIVED.
2. **Decision Reasoning** — `/reasoning`: evidence-grounded **WHY a decision type is supported**
   (evidence = persisted trail / engine source / governing flag); **NOT a prediction / decision /
   recommendation** (STOP clause). Every facet asserts the human-approval constraint
   (`Approval ≠ Automation`).
3. **Decision Evidence Engine** — `/evidence`: collects evidence by **READING** the decision tables
   (COUNT-only) + **COMPOSING** the platform / engineering / runtime / knowledge tier summaries + flags +
   metadata. Tier reachability measured `/4`. AI evidence is **audit-trail only** (auditability, not
   autonomy). **NEVER invokes a decision engine.**
4. **Decision Confidence Engine** — `/confidence`: **SIX SEPARATE confidence axes**
   (evidence_quality / repository / runtime / engineering / knowledge / decision); **STRUCTURAL only**
   (evidence presence/integrity — NOT runtime/outcome accuracy). `composite:null`. **accuracy_confidence
   is honest-null** (`measurable:false`, `value:null` — no labeled outcomes). evidence ⟂ coverage ⟂
   confidence kept separate.
5. **Decision Governance** — `/governance`: human-approval posture (`mandatory:true`,
   `automated_approval_supported:false`), ownership (honest unknown ≠ 0), history/traceability/audit, and
   STRUCTURAL policy validation — composing existing governance read-only. **Approval ≠ Automation.**
6. **Decision Explainability** — `/explain/:uid`: why / evidence / structural-confidence / alternatives /
   dependencies / repository + knowledge + runtime refs; governance asserts `human_approval:mandatory` +
   `automated_action:false`. Unknown uid → `found:false` (no fabrication). Confidence basis is DERIVED
   from measured substrate presence.
7. **Decision Validation** — `/validation`: **STRUCTURAL only** (repository / rule / evidence / decision /
   knowledge integrity); verdict ∈ {STRUCTURAL_VALIDATED, PARTIAL, ABSENT}.
8. **Decision Metrics** — `/metrics`: **SIX SEPARATE measured scores**
   `decision_quality` / `decision_confidence` / `decision_coverage` / `recommendation_quality` /
   `governance_compliance` / `explainability_score`; **deliberately NO composite/overall**
   (`composite:null`). `decision_confidence` is STRUCTURAL; **`recommendation_quality` is honest-null**
   (accuracy unmeasurable — no labeled outcomes).
9. **Summary + Audit** — `/summary` composes all parts; `POST /audit/capture` = the ONLY write path
   (owns lazy ensure-schema), `/audit/drift` (not comparable < 2 snapshots) + `/audit/snapshots`.
   `/enabled` + gate→auth→superadmin `/feature-flag` probes.

## Honesty contract (baked into the DB helpers + service)
- **Exact `COUNT(*)` for population — NEVER `n_live_tup`** (stale stats read 0 for seeded tables).
- `scalar()` / `rows()` return **NULL on query ERROR** (0/`[]` only for a genuinely-empty result);
  `pct()` returns null on null-num or 0/null-denom. **null ≠ 0** throughout.
- **Recommendation ≠ Decision ≠ Automation ≠ Approval · Evidence ≠ Confidence ≠ Accuracy ·
  Prediction ≠ Outcome · Coverage ⟂ Confidence ⟂ Evidence.**
- **Built ≠ Activated** — dormant decision flags reported as `flag_state`, never counted as live.
- Metrics 6 SEPARATE, never composited; accuracy-class metrics (`recommendation_quality`,
  `accuracy_confidence`) honest-null — no labeled outcomes exist to measure them.
- **READ-ONLY**: the engine owns ONLY 2 tables; every read of the existing decision tables is COUNT-only;
  write paths (`discover` / `register` / `audit/capture`) each assert the flag in the **service layer**
  before any `ensureDecisionSchema()` DDL, so direct/tooling callers cannot create schema when OFF.
- **No dormant activation**: the dormant decision engines are composed by file existence / persisted
  output only; they are never imported or invoked.

## Security
- `/register` `physical_table` is validated against an unquoted-identifier allowlist
  (`isSafeTableIdentifier`) **before** any interpolation — SQL identifier injection rejected (`ok:false`,
  no row written, target table survives).

## Flag-gate / OFF behaviour
- Route flag-gate returns 503 **before** auth/DDL. The platform's global `app.use('/api/admin')` auth gate
  intercepts first, so the OFF smoke yields **{401, 403, 503}** depending on path/method (documented
  platform convention — same as 2.1/2.3/2.4/2.5). `/enabled` returns 401 under the global gate (not a
  bug; consistent across MX-800 tiers).
- **OFF byte-identical incl. schema**: flag OFF → 0 owned tables created; reads `to_regclass`-probe →
  `ready:false`.

## Verification
- **OFF smoke** (flag default OFF): all 17 routes ∈ {401, 403, 503}; `decision_registry` +
  `decision_intelligence_audit_snapshots` do NOT exist.
- **Validator** `backend/scripts/mx800-2.6-decision-validate.ts`
  (`FF_DECISION_INTELLIGENCE_ENGINE=1 npx tsx scripts/mx800-2.6-decision-validate.ts`): **54/54 pass** —
  all 9 parts; honesty contract (null≠0, no composite, STRUCTURAL confidence, `recommendation_quality`
  null); **sentinel `COUNT(*)` unchanged on all 9 existing decision tables** (reads never write; dormant
  engines never invoked — `wc7b_decision_state` asserted unchanged); injection-rejection on `/register`;
  cleanup restores 0 owned tables.
- **architect review:** PASS. One non-blocking nit (`explainDecision` confidence basis always resolved to
  `'unknown'` via a non-existent `src.present` field) RAISED → FIXED (derive from measured substrate
  presence) → re-validated 54/54.

## No frontend (STOP clause)
No SuperAdmin panel in this phase (consistent with 2.1/2.3/2.4/2.5 backend-tier phases). Frontend exposure
is a separate future phase.
