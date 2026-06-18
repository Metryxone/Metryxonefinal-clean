---
name: CAPADEX decision-chain gaps & taxonomy traps
description: Non-obvious facts about the CAPADEX Concern→…→Journey decision chain that are easy to get wrong in future "decision intelligence"/routing work.
---

# CAPADEX decision-chain gaps & taxonomy traps

Surfaced during the WC-5 Decision Intelligence audit (`backend/audit/wc-5/`). These are
relationships you'd otherwise rediscover painfully; the audit docs hold the full detail.

## Stage taxonomy is SPLIT (backend ≠ frontend)
- Backend canon (`backend/services/wc3/stage-intelligence.ts` + `wc3_stage_definitions`)
  = **5 stages**: Awareness → Curiosity → Clarity → Growth → Mastery.
- Frontend `frontend/src/lib/behavioural-insights.ts` `CAPADEX_STAGES` = **4 codes**
  `CAP_CUR` (Curiosity) / `CAP_INS` (Insight) / `CAP_GRW` (Growth) / `CAP_MAS` (Mastery).
- **Why it matters:** any stage-keyed decision/report/offer surfaced to users will be
  inconsistent until these are reconciled. **Reconcile the taxonomy BEFORE keying
  user-facing decisions to stage.**

## A growth-plan EXISTS — but in M5, decoupled from CAPADEX
- Do NOT claim "no growth-plan table/service exists." It does: **M5 enterprise-workforce**
  has `m5_career_growth_plans` + `createAICoach().growthPlan()` +
  `/api/m5/coach/growth-plan[/persist]`.
- **The trap:** it is **decoupled from the CAPADEX decision chain** — the
  Concern→Stage→Context→Outcome→Journey flow neither produces nor persists a plan
  (CAPADEX plan state lives in session-intervention snapshots / `localStorage`).
- **How to apply:** to add CAPADEX growth-plan persistence, **wire/extend M5's existing
  plan**, don't build a parallel `growth_plans` table.

## What's REAL vs MISSING in the chain (one-liner)
- REAL (but flag-gated OFF + dormant, not in the live loop): L1 stage, L2 outcome
  (6 models; `exam_readiness` gated), L3 journey routing (table-driven `wc3_journey_routes`;
  mentoring = universal fallback; `competitive_exam` = corpus_pending; `family_support`
  remaps to mentoring), Action layer (intervention + recommendation, library-backed).
- MISSING: unified **Decision composition** layer; **commercial-decision** rule
  (outcome/journey → subscription nudge / tier-gated module access); **L5B context wired
  to runtime** (offline sidecar only). Products: only **LBI is real**; Career Builder
  PARTIAL; Employability Index / Competitive-Exam / Mentoring / Family = STUBS.
- **Routing weakness amplifier:** mentoring is the universal fallback AND a stub, so its
  weakness affects all fallback traffic — strengthening it raises the whole floor.
