# Micro-Accurate Stage Guidance — Design Document

**Status:** Proposal · awaiting build approval
**Owner:** MetryxOne Career Intelligence
**Surface:** Career Builder dashboard → "Gap to next stage" card → *Show me how*
**Replaces:** Static `STAGE_GUIDANCE` heuristic in `frontend/src/pages/CareerBuilderPage.tsx`

---

## 1 · Problem statement

The current "Show me how" panel renders **stage-keyed narrative text** (e.g. "Ship one portfolio project · +10 EI"). Every Builder-band user sees the same four steps in the same order, regardless of:

- Which competencies are actually dragging their composite score down
- Whether a competency is **accelerating or flat** in their 90-day trajectory
- Their **target role** (role DNA weights differ — Coaching weight for Eng Manager ≠ for IC Engineer)
- Their **cohort percentile** on each competency vs same-stage peers
- The **psychometric reliability** of their underlying assessment (low-reliability = caveat the advice)
- Whether **adjacent roles** would close the gap with less effort

The EI deltas (`+10 EI`, `+8 EI`) are **designer estimates**, not derived from any model. Two users with the same composite EI score but completely different gap profiles get identical advice.

This document specifies what a **micro-accurate**, evidence-driven replacement looks like and how to build it using infrastructure that already exists in the platform.

---

## 2 · Design principles

| # | Principle | Implication |
|---|---|---|
| P1 | **Every step must trace to a measured gap.** | No hardcoded actions. Every step cites `(your_score, cohort_p50, target_anchor, weight, gap_pts)`. |
| P2 | **EI deltas are computed, not estimated.** | Use the Phase 2 weighting engine + role alignment scorer to project the EI contribution of closing each gap. |
| P3 | **Rank by impact ÷ effort.** | Order steps by *expected EI lift per hour of effort* — not by descending magnitude alone. |
| P4 | **Velocity-aware copy.** | If a competency is already accelerating (Phase 4 EWMA momentum > +5/mo), the action is *"sustain"*, not *"start"*. |
| P5 | **Confidence-tier disclosure.** | When cohort confidence is C or below (n<100), badge it as `~ provisional · cohort building`. Reuses Phase 2 `bench_confidence`. |
| P6 | **Adjacency offramp.** | If the primary target's composite gap is >20 pts AND an adjacent role (Phase 3 `/api/mobility/adjacent`) is reachable in <8 pts, surface it as an alternative path. |
| P7 | **Read-only / non-blocking.** | Panel must render gracefully even if any one API fails. Static fallback (current behaviour) is the safety net, not the source. |
| P8 | **Language policy compliance.** | All copy uses developmental / proximity language only (Phase 5 enforcement). Never asserts hiring or promotion outcomes. |

---

## 3 · Data sources (all already built and live)

All endpoints below are already implemented, smoke-tested, and registered in `backend/routes.ts`.

### 3.1 — Per-competency gap decomposition
**Endpoint:** `GET /api/benchmark/role?session_id=…&role_id=…`
**Returns:** `{ alignment_score, per_competency: [{ competency_id, name, user_score, percentile, cohort_p25/p50/p75/p90, expected_level, gap_pts, weight, weighted_gap, confidence_tier }] }`
**Use:** Source of truth for *which competencies matter* and *how big the gap is*. The `weighted_gap` field is the single most important rank input.

### 3.2 — Velocity / momentum
**Endpoint:** `GET /api/longitudinal/velocity?user_id=…`
**Returns:** Per-competency `{ delta, velocity_per_30d, momentum_ewma_alpha_0_30, consistency, trend ∈ accelerating|stabilizing|declining|flat }`
**Use:** Decides between *Sustain* (accelerating), *Continue* (stabilizing), *Break plateau* (flat), *Intervention* (declining).

### 3.3 — Ranked developmental recommendations
**Endpoint:** `GET /api/mobility/recommendations?session_id=…&target_role_id=…`
**Returns:** `[{ category, priority, competency_id, alignment_indicator, developmental_actions[], pathway_id?, est_effort_hours, est_alignment_lift }]`
**Use:** Pre-ranked competency-level actions with effort estimates. Phase 3 already computes impact/effort scoring.

### 3.4 — Personalised pathways
**Endpoint:** `GET /api/mobility/pathway/:id?session_id=…`
**Returns:** Pathway projected against user's current maturity level per step.
**Use:** Click-through "Show me the path" expansion under any step that references a pathway.

### 3.5 — Adjacent role offramp
**Endpoint:** `GET /api/mobility/adjacent?session_id=…&role_id=…`
**Returns:** Adjacency-scored neighbour roles with composite mobility score.
**Use:** Triggered only when primary target gap >20 pts. Suggests "easier" reachable targets.

### 3.6 — Reliability / quality caveats
**Endpoint:** `GET /api/benchmark/reliability?session_id=…`
**Returns:** `{ composite_reliability, quality_tier: A|B|C|D, contradictions_pct, completion_pct }`
**Use:** If quality_tier < B, prepend a reliability warning to the panel header.

### 3.7 — Behavioural indicators (human-readable)
**Endpoint:** `GET /api/ontology/competencies/:id`
**Returns:** `{ behavioural_indicators[], proficiency_levels[] }`
**Use:** Expanded step view shows the actual behaviours that move the competency from level N → N+1.

### 3.8 — Explainability envelope (Phase 5)
**Source:** Every response above is wrapped with `_explainability` carrying methodology versions, weighting policy, cohort metadata, and language_policy block.
**Use:** Rendered in a footer "How we computed this" disclosure modal — full transparency.

---

## 4 · UX specification

### 4.1 — Panel structure (proposed)

```
┌────────────────────────────────────────────────────────────────┐
│ Gap to next stage                                  Hide ▲      │
│ 13 pts to Career-Ready · target role: Senior Engineer          │
│                                                                │
│ ▸ Composite gap decomposition (weighted)                       │
│                                                                │
│   Stakeholder Mgmt    you 42 · p50 58 · anchor 65   gap 23     │
│   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ weight 0.18  ▢ flat │
│                                                                │
│   Accountability       you 51 · p50 62 · anchor 65   gap 14    │
│   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ weight 0.15  ↑ +8.7  │
│                                                                │
│   Strategic Thinking   you 47 · p50 55 · anchor 60   gap 13    │
│   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ weight 0.12  → 0.0   │
│                                                                │
│ ▸ Recommended sequence  (ranked by EI lift ÷ effort)           │
│                                                                │
│   1.  Stakeholder Mgmt · Coaching Pathway P-3                  │
│       Effort: ~6 h  ·  Projected lift: +5.8 EI  ·  Confidence: B│
│       Why: largest weighted gap (4.14 weighted pts)            │
│       Actions: [3 behavioural indicators…]                     │
│       [Open pathway →] [Go to Skills Lab]                      │
│                                                                │
│   2.  Accountability · Momentum-preserving sprint              │
│       Effort: ~2 h  ·  Projected lift: +2.1 EI  ·  Confidence: A│
│       Why: already trending up (+8.7 EWMA momentum)            │
│                                                                │
│   3.  Strategic Thinking · Break-the-plateau exercises         │
│       Effort: ~4 h  ·  Projected lift: +3.2 EI  ·  Confidence: B│
│       Why: 30-day flat trajectory                              │
│                                                                │
│ ▸ Adjacent path (optional)                                     │
│   "Engineering Lead" is 7 pts closer (gap 6 vs 13). [Compare]  │
│                                                                │
│ ─────────────────────────────────────────────────────────────  │
│ Need a personalised walk-through?                              │
│ [✨ Ask Pragati for a conversational plan]                     │
│ [ⓘ How we computed this · methodology v2.0.0]                  │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 — Step ranking formula

```
score(step) = (projected_ei_lift / max(effort_hours, 0.5))
            × velocity_multiplier
            × confidence_multiplier
            × weight_multiplier

velocity_multiplier:
  accelerating → 1.4  (preserve momentum is highest leverage)
  stabilizing  → 1.1
  flat         → 1.0
  declining    → 1.6  (intervene before further drop)

confidence_multiplier:
  tier A → 1.0
  tier B → 0.9
  tier C → 0.7
  tier D → 0.4

weight_multiplier:
  step.weight (role-DNA normalised) directly multiplied
```

### 4.3 — Empty / degraded states

| Condition | Behaviour |
|---|---|
| No `session_id` in scope | Fall back to current static `STAGE_GUIDANCE`, prepend banner *"Take the core assessment for personalised guidance."* |
| `recommendations` API returns empty | Show static stage steps, prepend banner *"Cohort still calibrating — generic guidance shown."* |
| `reliability.quality_tier ∈ {C, D}` | Prepend yellow banner *"Underlying assessment has low reliability ({tier}). Treat suggestions as directional."* |
| `target_role_id` unset | Show role-picker chip at top; until picked, derive from user's top 3 skills via `/api/onto/roles/resolve` |
| Any API fails | Silently fall back to static guidance for that section; panel never breaks |

### 4.4 — Confidence pill placement

Reuses the **amber "Provisional · cohort building"** treatment already shipped on the peer-benchmark bar. Consistent visual language across the dashboard.

### 4.5 — Accessibility

- All bar graphs in the gap decomposition include `aria-label` of the form *"Stakeholder Management: your score 42, cohort median 58, target anchor 65, gap 23 points"*
- Confidence tiers exposed via `aria-describedby` rather than colour alone
- Panel is keyboard-navigable; expand/collapse uses `aria-expanded`
- Velocity arrows have text equivalents (↑ +8.7 → "accelerating, plus 8.7 per 30 days")

---

## 5 · Build plan

### 5.1 — Backend (no new endpoints — orchestration only)

**New file:** `backend/services/stage-guidance-orchestrator.ts`

A thin orchestrator that fans out to the 6 existing services in parallel, applies the ranking formula, and returns a single composite payload.

```ts
GET /api/career/stage-guidance?session_id=…&target_role_id=…
→ {
    target_role: { id, name, family },
    gap_decomposition: [...],         // from /benchmark/role
    velocity_overlay:  [...],         // from /longitudinal/velocity
    ranked_steps:      [...],         // computed via ranking formula
    adjacent_offramp:  {...} | null,  // from /mobility/adjacent (conditional)
    reliability:       {...},         // from /benchmark/reliability
    static_fallback_used: boolean,
    _explainability:   {...}          // Phase 5 envelope
  }
```

This is the **only** new endpoint. Estimated work: **45 min** including unit tests against demo session ids.

### 5.2 — Frontend

**Rewrite:** `StageGuidancePanel` in `frontend/src/pages/CareerBuilderPage.tsx`
**New hook:** `useStageGuidance(sessionId, targetRoleId)` — same pattern as `usePeerBenchmark`

Estimated work: **2–3 hours** for the panel + degraded-state handling + visual polish.

### 5.3 — Tests

- Unit: ranking formula golden tests with synthetic gap/velocity inputs
- Integration: orchestrator endpoint against `demo_user_alpha…epsilon`
- Visual: panel renders for each degradation state (no session, no recs, low reliability, no target role)

### 5.4 — Rollout

1. Build behind feature flag `career.guidance.micro_v1` (defaults off)
2. Smoke-test against all 5 demo users
3. Enable for demo users only, validate copy + numbers
4. Enable globally; static path stays as fallback for 30 days

---

## 6 · Scientific basis — addressing common questions

**Q: Why weight gap by `weighted_gap` rather than raw `gap_pts`?**
A: Closing a 20-pt gap on a competency with role-DNA weight 0.05 contributes 1.0 to the composite, while closing a 10-pt gap on weight 0.20 contributes 2.0. Raw gaps over-prioritise unimportant competencies.

**Q: Why EWMA momentum α = 0.30?**
A: Matches the constant already used in `backend/services/longitudinal-engine.ts`. α = 0.30 weights the most recent ~6 months heavily while preserving longer-term signal; standard practice for HR analytics where measurement intervals are monthly.

**Q: Why is the velocity multiplier higher for "declining" (1.6) than "accelerating" (1.4)?**
A: Loss aversion is asymmetric — a competency dropping needs intervention before it crystallises into a habit. An accelerating competency only needs sustenance.

**Q: Why use empirical percentile rather than z-score for cohort comparison?**
A: Phase 2 service uses empirical percentile via binary search on `sorted_samples` — no Gaussian assumption. EI score distributions are typically non-normal (bimodal for early-career cohorts). Z-score retained only as a diagnostic field, never as the percentile.

**Q: How does this not become a hiring prediction?**
A: Phase 5 language policy is enforced in the explainability envelope. Every step uses developmental verbs (*close*, *develop*, *strengthen*, *sustain*) and the panel header reads *"Closing this gap unlocks the Career-Ready band"* — never *"This will get you hired"*.

**Q: What stops the panel from drifting back into heuristics over time?**
A: The orchestrator endpoint exposes `static_fallback_used: boolean` in the response, and `_explainability.rationale` carries the data sources used. A dashboard widget could trivially flag "X% of sessions are still falling back to static guidance" — observable, not silent.

---

## 7 · Open decisions (need user confirmation)

These were posed in chat:

| # | Question | Options |
|---|---|---|
| Q1 | How aggressive should the rewrite be? | (a) Full rewrite · (b) Hybrid with static fallback · (c) Minimal — add real numbers to existing static steps |
| Q2 | Target-role default when unset? | (a) Infer from top skills · (b) Block until explicit pick · (c) Generic Career-Ready with banner prompt |

Recommended defaults: **Q1 = (b) Hybrid** (safest, graceful degradation), **Q2 = (a) Infer with override chip** (lowest friction).

---

## 8 · Out of scope (explicit)

- **Re-scoring EI in real-time** as the user completes actions — this stays on the existing scoring cadence
- **Pushing reminders / nudges** based on the recommended sequence — separate notifications system
- **Mentor matching against recommended pathways** — Phase 6 candidate, not this rewrite
- **Multi-target-role comparison** (Eng Manager vs Tech Lead side-by-side) — already covered by `/api/mobility/compare`, not duplicated here
- **Modifying any scoring formula, weight, or benchmark logic** — this is a *presentation* layer, fully read-only against Phases 1–5

---

## 9 · Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Recommendation orchestrator becomes slow (5 fan-out API calls) | Med | Promise.all + 30-second cache keyed on `(session_id, target_role_id)` |
| Confusing UX when reliability tier is C/D | Med | Prepend explicit yellow banner, demote projected-lift figures |
| Users pick targets too far away → demotivation | Low | Adjacent offramp surfaces an easier reachable role |
| Static-fallback path silently masks broken APIs | Low | `static_fallback_used` flag observable in admin dashboard |
| Copy drifts from language policy over time | Low | Phase 5 enforcement intercepts at envelope wrap; CI lint could be added |

---

## 10 · Acceptance criteria

The rewrite is shipped when:

- [ ] Two users with the same composite EI but different gap profiles see **different** step orderings
- [ ] Every step displays cohort context: `you · p50 · target anchor`
- [ ] EI deltas are sourced from `est_alignment_lift`, not hardcoded
- [ ] Velocity arrows surface accelerating / flat / declining state
- [ ] Adjacent offramp shows when target gap > 20 and adjacent < 8
- [ ] All 5 degraded states (no session / no target / no recs / low reliability / API fail) render without breaking
- [ ] "How we computed this" disclosure renders the Phase 5 explainability envelope verbatim
- [ ] Language policy lint passes — no disallowed phrases anywhere in panel copy
- [ ] Panel still works on mobile (320px width minimum)
- [ ] Static `STAGE_GUIDANCE` retained but only used as fallback, with telemetry

---

*Last updated: 2026-05-21*
