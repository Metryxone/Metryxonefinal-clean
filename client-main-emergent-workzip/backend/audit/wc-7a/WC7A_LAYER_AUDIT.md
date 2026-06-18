# WC-7A — Per-Layer Maturity Audit (Layers 1–8)

Each layer: **current maturity %** (grounded), the **mechanism inventory** (real-vs-stub
evidence), the **gap to 90%**, and the **smallest improvement set** to close it. Maturity % per
the WC7A_README banding rubric. Lift estimates are directional design estimates (no activation
telemetry exists).

Legend: ✅ REAL & consumed · 🟡 REAL but idle / not orchestrated · 🟠 PARTIAL · 🔴 STUB · ⛔ ABSENT.

---

## Layer 1 — Personalization Intelligence · **78%**

| Mechanism | Status | Evidence / what's missing |
|-----------|--------|---------------------------|
| IntroPhase persona picker (3 tracks × 11 sub-personas) | ✅ | `IntroPhase.tsx` drives labels/placeholders/age-band validation. Missing: an Institution/B2B onboarding track. |
| Proxy-language reframing engine | ✅ | `proxy-language-engine.ts` rewrites self-report → third-person on a subject-position `you`. Missing: option-level reframing (Likert stems stay first-person). |
| Adaptive questioning pipeline | ✅ | `adaptive/*` orchestrates info-gain, zero-repetition, contradiction probes, adaptive length, dynamic pathing. Missing: zero-repetition is a regex "Lite" check, not vector similarity. |
| Stage Intelligence (L5A) | 🟡 | Derived 5-stage metadata stored in `wc3_question_intelligence` — **but the adaptive pipeline does not filter the next-question pool by stage.** Built, idle. |
| Context Intelligence (L5B) | 🟡 | Derived life-context tags stored — **not consumed at runtime selection.** Built, idle. |
| Concern routing + clarity picker filters | ✅ | `bridge-tag-resolver.ts` maps tags→covered buckets, filters by persona + age band. Missing: automated semantic remap for unknown tags (manual overrides today). |
| Per-stakeholder report personalization | ✅ | `pil/report-section-engine.ts` reshapes 4 stakeholder views. Missing: Institution PDF styling is generic. |
| Recommendation personalization | 🟠 | `pil/recommendation-generator.ts` selects by active construct + stakeholder. Missing: no use-feedback loop to re-rank. |
| Career-behavior-adapter (ranking / plans) | 🟠 | reduces behaviour graph to 5 readiness scalars; **"drivers" (the why) are fetched but rarely displayed**, so growth plans read generic. |

**Why 78 and not higher:** the core diagnostic/report personalization is genuinely REAL (~85),
but two mature engines are **idle** (L5A/L5B derived-not-consumed) and the Career-Builder side is
PARTIAL — the average lands at 78.

**Gap to 90% — smallest set (all SMALL):**
1. **Consume L5B context (and L5A stage) in runtime selection** — filter/boost the next-question
   pool by the user's detected context (e.g. exam → competitive-exam-pressure questions). Turns
   two idle engines live. *Highest-leverage personalization move.*
2. **Surface the behaviour-adapter `drivers`** in the growth-plan / dashboard UI — convert
   "generic + scalars" into "tailored narrative" using data already computed.
3. **Proxy option-reframing pass** — reframe Likert option labels for raters, not just stems.

---

## Layer 2 — Longitudinal Intelligence · **75%**

| Mechanism | Status | Evidence / what's missing |
|-----------|--------|---------------------------|
| OMEGA longitudinal-memory | ✅ | `longitudinal-memory.ts` detects recurring constructs, behavioural drift (CSI slope), burnout streaks, resilience recoveries, growth patterns. Missing: detections don't trigger any UX. |
| Behavioural-memory backend | ✅ | `behavioural-memory.ts` + `capadex_behavioural_memory` / `career_memory_snapshots`; `computeGrowth` diffs last two snapshots. Missing: snapshots are posted **manually**, not auto-triggered. |
| CSI trajectory | ✅ | `csi_trajectory` + linear-slope direction; feeds OMEGA. Missing: single-scalar `csi_score` only (no multi-signal trajectory vector). |
| Append-only history (`p4_competency_history`, `m3_*`) | ✅ | `longitudinal-engine.ts` computes velocity / momentum / consistency via EWMA. Missing: only a long-horizon archival strategy (low priority). |
| Behaviour-graph aggregator | ✅ | `behavior-graph-service.ts` stitches signals/patterns/risks/interventions/OMEGA into one JSONB graph. Missing: per-session generation only — no inter-session refresh. |
| Progress ledger + outcome attribution | 🟡 | `progressLedger.ts` / `outcomeAttributionEngine.ts` map snapshots to 5 axes with pre/post baseline-netted attribution — **but entirely client-side**, unavailable to server reporting/analytics. |
| Re-assessment scheduling | 🔴 | only manual reschedule UI + an interview auto-threshold; **no interval-based "re-assess after N days" trigger.** |
| In-memory career-memory (`career-memory.ts`) | 🔴 | legacy parallel store; pattern defs (`burst-learner`, `steady-grower`) but **lost on restart**; duplicates the DB-backed system. |

**Why 75:** the analytical core is highly mature (REAL engines, real math), but the **activation
edges are stubbed** — nothing auto-captures snapshots, nothing schedules re-assessment, detections
are inert, and a legacy in-memory store duplicates the real one.

**Gap to 90% — smallest set (all SMALL–MEDIUM):**
1. **Auto snapshot-on-completion** — fire `behavioural-memory/snapshot` at session end instead of
   relying on manual POST. Makes longitudinal tracking actually accumulate.
2. **Re-assessment interval scheduler** — a backend trigger ("re-assess EI after 90 days").
3. **Decommission in-memory `career-memory.ts`** — migrate its unique pattern defs into the
   DB-backed `behavioural-memory.ts` (one source of truth, survives restart).
4. **Wire detections → interventions** — connect OMEGA burnout/plateau/drift to the existing
   intervention sequencer (act on what's already detected). Optional server-side attribution
   verification if global analytics are needed.

---

## Layer 3 — Decision Intelligence · **57%**

| Mechanism | Status | Evidence / what's missing |
|-----------|--------|---------------------------|
| Decision *ingredients* (Stage L1, Outcome L2, Journey L3, Action/intervention, concern journey) | ✅ | all REAL and producing structured outputs (WC-5/WC-6/DC-1). |
| First-class **decision object / orchestrator** | ⛔ | DC-1: "decision object absent everywhere." Nothing composes the ingredients into one decision that can be activated, audited, or measured. |
| Confidence / ambiguity arbitration across layers | 🟠 | per-layer confidence exists; no unified `decision.confidence/why[]`. |
| Decision telemetry | ⛔ | no decision is persisted, so no conversion can be measured (root of DC-2's "directional only" caveat). |

**Why 57:** the raw materials are all REAL, but the layer that *is* "decision intelligence" — a
conductor that emits one structured, confidence-arbitrated, activatable decision — does not exist.

**Gap to 90% — smallest set:**
1. **Decision Orchestrator (read-only `ActivationEnvelope`)** — compose Stage+Context+Outcome+
   Journey+Action into `{product, growthPlan, mentor, subscription}` each with `ready/reason`.
   This single move *is* the Decision layer; it also seeds telemetry. (WC-6 Phase O1.) → ~85.
2. **Unified confidence/ambiguity arbitration** (reuse L2/L3). → 90.

---

## Layer 4 — Product Activation · **60%**

| Mechanism | Status | Evidence / what's missing |
|-----------|--------|---------------------------|
| LBI product | ✅ | real, DB-backed. |
| Mentor product | ✅ | real (see Layer 6). |
| Base assessment + report + OMEGA | ✅ | real, served. |
| PIL stakeholder reports | 🟡 | real but **flag-gated** (off by default). |
| Career Builder | 🟠 | partial; plan persistence incomplete. |
| Employability Index | 🔴 | stub. |
| Competitive-Exam product | 🔴 | stub (+ corpus_pending) — *inversion:* the packages are real, the product isn't. |
| Decision→product **activation / deep-link** | ⛔ | routing (L3) is real but nothing deep-links a decision into the product entry. |

**Why 60 — and the hard-floor note:** real products exist, but **two segments' products are
stubs** and activation deep-linking is absent. ⚠️ **This layer cannot reach 90% via small moves.**
Orchestration deep-links + flipping the PIL flag lift it to ~78; the last ~12 points require
**completing the two stub products**, which is a LARGE build (Tier C).

**Gap to 90% — set (mixed):**
1. *(Small)* Product deep-link activation from the orchestrator + enable PIL reports. → ~78.
2. *(Large, irreducible)* Make Employability Index + Competitive-Exam real products. → 90.

---

## Layer 5 — Growth Plan Activation · **65%**

| Mechanism | Status | Evidence / what's missing |
|-----------|--------|---------------------------|
| M5 growth-plan engine | ✅ | `m5-ai-coaching.ts` + `m5_career_growth_plans`; persists, segment-aware (`orgId`), persona-aware (`targetRoleId`); pulls `realUserScores()`. |
| Plan anchoring | 🟠 | anchored to **M-series role/competency scores, not the CAPADEX concern-journey decision** — so the plan engine is real but isn't seeded by the diagnostic decision. |
| Segment plan templates | 🟠 | role-oriented; no school/exam age-appropriate variants. |
| Journey→M5 bridge | ⛔ | the missing connective tissue. |

**Why 65:** the plan engine is genuinely REAL and persistent — the gap is purely **activation**:
the decision doesn't seed it.

**Gap to 90% — smallest set (SMALL–MEDIUM, highest leverage in the whole audit):**
1. **Journey→M5 bridge** — map journey/outcome → `coachInput()` so the real plan engine runs from
   the CAPADEX decision. *One move improves the Growth Plan row for all six segments.* (WC-6 O2.)
   → ~88.
2. *(Medium)* Age/segment plan templates. → 90.

---

## Layer 6 — Mentor Activation · **70%**

| Mechanism | Status | Evidence / what's missing |
|-----------|--------|---------------------------|
| Mentor marketplace + booking/messaging/notes lifecycle | ✅ | DB-backed (`mentor_profiles`, `mentor_bookings`, `booking_messages`, `mentor_session_notes`). |
| Assessment-driven matching | ✅ | `/suggestions` builds a domain-weakness map from LBI scores → `mentor_type`. |
| Match basis | 🟠 | keys off **raw LBI scores, not the unified decision** (stage+outcome+concern). |
| Live-DB reliability | 🟠 | `/suggestions` depends on `lbi_sessions`/`lbi_modules` flagged "NOT YET IN LIVE DB" — logic real, live path not guaranteed. |
| Crisis-escalation routing | 🟠 | partial (DC-2 corrected to status P). |
| `/book` auth | 🔴 | `POST /api/mentor-marketplace/:id/book` lacks `requireAuth` — books with a null parent (access-control hole). |
| Institution cohort / bulk allocation | ⛔ | absent (DC-2 corrected to ✗). |

**Why 70:** mentor is the **closest-to-orchestrated** surface — real product, real matching — but
matching isn't decision-driven, there's an auth hole, and B2B cohort allocation is absent.

**Gap to 90% — smallest set:**
1. *(Small–Medium)* Upgrade match basis LBI→decision (WC-6 O3). → ~86.
2. *(Small)* Close the `/book` auth hole. → ~88.
3. *(Medium, B2B)* Exam-mentor taxonomy + cohort/bulk allocation. → 90 *(overlaps Tier C B2B).*

---

## Layer 7 — Subscription Intelligence · **45%** (weakest link)

| Mechanism | Status | Evidence / what's missing |
|-----------|--------|---------------------------|
| Billing CRUD + seeded segment-labelled packages | ✅ | `subscription_packages` real, `student_segment` + `is_recommended`, seeded packages. |
| Decision→package mapping | ⛔ | no mapping from a decision/segment/outcome to a recommended package (manual "Recommended" badge only). |
| Backend entitlement enforcement | 🟠 | partial / non-blocking (frontend PLAN_ORDER; one path logs an outcome but still allows the flow); no general server gate. |
| Schema completeness | 🟠 | live table lacks `tier/features/modules/institution_id/max_students`; rich columns live in a different `frontend/server` surface (cross-server seam). |
| Job-seeker / employability package | ⛔ | missing segment package. |

**Why 45:** billing exists, but the **intelligence** of subscription (decision-driven
recommendation + enforced entitlement) is absent — exactly the DC-2 central revenue tension.

**Gap to 90% — set (MEDIUM, the commercial loop):**
1. **Decision→subscription mapping** over existing `student_segment`/`is_recommended` (recommend,
   don't hardcode). (WC-6 O4.)
2. **Backend entitlement enforcement** (`requireSubscription` / module gate). (WC-6 O5.)
3. **Subscription-schema reconciliation** + cross-server seam decision (WC-6 O0); add the
   job-seeker package. → 85–90.

---

## Layer 8 — Future Readiness Intelligence · **40%**

| Mechanism | Status | Evidence / what's missing |
|-----------|--------|---------------------------|
| Institutional B2B data layer (`institution_id`, `max_students`, seat enforcement) | ⛔ | absent → B2B non-functional despite being the highest-revenue segment. |
| Institutional-admin persona | ⛔ | only `placement_career_cell` partial; no admin onboarding track. |
| Cohort decision/action/mentor/plan rollups | ⛔ | per-student only. |
| Context axis (org-level / future-scenario) | 🟡 | overlaps the idle L5B context engine (Layer 1) — derived, not consumed. |
| Multi-dimensional trajectory | 🟠 | CSI is single-scalar (Layer 2 dependency). |

**Why 40 — and the hard-floor note:** this is the expansion frontier (DC-2 Wave 3). ⚠️ **No small
move reaches 90% here** — institutional B2B is an architecturally LARGE build (data layer + admin
persona + cohort orchestration). Small moves (consuming L5B, multi-dim trajectory) lift it to
~55; the rest is irreducibly large (Tier C).

**Gap to 90% — set:**
1. *(Small, shared with L1/L2)* Consume L5B context + multi-dim trajectory. → ~55.
2. *(Large, irreducible)* Institutional B2B data layer + admin persona + cohort rollups (WC-6
   O6). → 90.

---

## Layer summary table

| # | Layer | Current | Floor type | Path to 90% |
|---|-------|---------|-----------|-------------|
| 1 | Personalization | 78 | soft | Tier A (small) |
| 2 | Longitudinal | 75 | soft | Tier A (small) |
| 3 | Decision | 57 | soft | Tier A (orchestrator) |
| 4 | Product Activation | 60 | **hard** | Tier A partial → **Tier C large** |
| 5 | Growth Plan | 65 | soft | Tier A (one bridge) |
| 6 | Mentor | 70 | soft | Tier A + small B2B from Tier C |
| 7 | Subscription | 45 | medium | **Tier B** (commercial loop) |
| 8 | Future Readiness | 40 | **hard** | small lift → **Tier C large (B2B)** |

**Two hard floors (Layers 4 & 8) are the only places where 90% is impossible without a large
build.** Everything else is small-to-medium wiring. → see `WC7A_MINIMAL_SET.md`.
