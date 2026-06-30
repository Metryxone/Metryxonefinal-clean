# 02 · Repository Alignment

How the repository's lifecycle references stand relative to the frozen 4-stage canon (Blueprint 06),
**after** Phase 1.1.

---

## 1. Classification method

Every lifecycle reference found in T001 discovery was classified on four axes against the canon:
**name** (Curiosity/Insight/Growth/Mastery), **code** (`CAP_CUR/CAP_INS/CAP_GRW/CAP_MAS`), **order**
(0→3), and **criteria** (the stage's meaning/role). A reference is *aligned* if it agrees on all four,
*inconsistent* otherwise.

---

## 2. Pre-existing state (T001/T002 finding)

- The **vast majority** of label maps already agreed on the canonical 4 stages, names, codes and order
  (~16 backend/frontend maps + the frontend `CAPADEX_STAGES`). The platform was **already substantially aligned**.
- The **only structural divergence** was the WC3 service layer (`backend/services/wc3/stage-intelligence.ts`),
  whose `CANONICAL_STAGE_ORDER` / `CANONICAL_STAGE_WEIGHT` constants *named themselves* as a canon and were
  imported by three sibling WC3 services — i.e. duplicate-logic / competing-source-of-truth risk, not a wrong
  taxonomy. Values agreed with the canon; the *naming and ownership* did not.
- No 5-stage model, no `CAP_AWA`/`CAP_CLA` code, and no numeric/legacy stage names were found anywhere in code.
  "Clarity" appears only as (a) sanctioned display copy and (b) load-bearing **stored** strings; "Awareness"
  only as conceptual copy. Both are consistent with the canon.

---

## 3. Alignment table (post Phase 1.1)

| Area | File(s) | Pre-state | Action | Post-state |
|---|---|---|---|---|
| Backend canon | `backend/lib/lifecycle.ts` | absent | **created** | ✅ single SoT |
| WC3 stage engine | `services/wc3/stage-intelligence.ts` | inconsistent (competing canon name) | reframed to WC3 projection sourcing labels from canon | ✅ aligned |
| WC3 importers | `services/wc3/{question-stage,outcome,journey}-intelligence.ts` | imported old names | updated to `WC3_PROGRESSION_ORDER` | ✅ aligned |
| Subscription | `services/wc7c/subscription-engine.ts` | inline label map | → `STAGE_CODE_TO_LABEL` | ✅ aligned |
| Reports | `services/omega-report-builder.ts` | inline label map | → `STAGE_CODE_TO_LABEL` | ✅ aligned |
| Entitlement | `services/entitlement-bridge.ts` | inline label map | → `STAGE_CODE_TO_LABEL` | ✅ aligned |
| Adaptive svc | `services/adaptive-assessment.ts` | inline label map | → `STAGE_CODE_TO_LABEL` | ✅ aligned |
| Adaptive route | `routes/adaptive-assessment.ts` | inline label map | → `STAGE_CODE_TO_LABEL` | ✅ aligned |
| Scoring | `lib/scoring-utils.ts` | inline label map | → `STAGE_CODE_TO_LABEL` | ✅ aligned |
| Enterprise route | `routes/capadex-enterprise.ts` | inline map + valid-stage array | → `STAGE_CODE_TO_LABEL` + `LIFECYCLE_STAGE_CODES` | ✅ aligned |
| Main routes | `routes.ts` | inline map + `VALID_STAGES` array | → `STAGE_CODE_TO_LABEL` + `LIFECYCLE_STAGE_CODES` | ✅ aligned |
| Frontend canon | `frontend/src/lib/behavioural-insights.ts` | `CAPADEX_STAGES` only | + `STAGE_CODE_TO_LABEL` + `stageLabel()` + canon doc | ✅ frontend SoT |
| Frontend dupes | `SDIAdminPage.tsx`, `Capadex{Result,Report,Register,Preview}Phase.tsx` | inline maps/ternaries | → frontend canon | ✅ aligned |

---

## 4. Residual (documented, intentionally untouched — detail in report 07)

- Stored DB strings `'Clarity'` / `'Awareness'` — sanctioned alias / pre-stage; load-bearing; **not** changed.
- `frontend/server/src/routes/short-assessments.ts` — dormant second (JWT) app, not run by any workflow.
- `update_capadex_tags.mjs` — one-off reverse-map script.
- `CapadexPackageSelectionPhase.tsx` — package-content arrays, not stage-label definitions.

**Verdict: the repository now resolves all coded lifecycle references through exactly one canon per runtime.**
