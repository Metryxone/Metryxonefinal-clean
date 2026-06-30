# 03 · Updated Lifecycle Mapping

The canonical mapping after Phase 1.1 — codes, labels, alias, pre-stage, order, weights, and where each is owned.

---

## 1. Stage map (authoritative)

| Order | Code | Canonical label | Display alias | Backend owner | Frontend owner |
|---|---|---|---|---|---|
| 0 | `CAP_CUR` | Curiosity | — | `lib/lifecycle.ts` | `behavioural-insights.ts` |
| 1 | `CAP_INS` | Insight | **Clarity** | `lib/lifecycle.ts` | `behavioural-insights.ts` |
| 2 | `CAP_GRW` | Growth | — | `lib/lifecycle.ts` | `behavioural-insights.ts` |
| 3 | `CAP_MAS` | Mastery | — | `lib/lifecycle.ts` | `behavioural-insights.ts` |

- **Pre-stage:** `Awareness` — UNCODED. `UNCODED_PRE_STAGE = 'Awareness'` (backend). No `CAP_*` code; never a `stage_code`.
- **Alias:** `Clarity = INSIGHT_DISPLAY_ALIAS` (backend) / encoded in the canon doc-comment (frontend). Same stage as `CAP_INS`.

## 2. Code → label (single resolver per runtime)

- Backend: `STAGE_CODE_TO_LABEL` / `stageLabel(code)` in `backend/lib/lifecycle.ts`.
- Frontend: `STAGE_CODE_TO_LABEL` / `stageLabel(code)` in `frontend/src/lib/behavioural-insights.ts`.

```
CAP_CUR → Curiosity
CAP_INS → Insight        (display alias: Clarity)
CAP_GRW → Growth
CAP_MAS → Mastery
```

## 3. Order & progression weight

- **Order (canonical):** `LIFECYCLE_STAGE_CODES = ['CAP_CUR','CAP_INS','CAP_GRW','CAP_MAS']`, orders 0→3.
- **WC3 progression projection** (`stage-intelligence.ts`): `WC3_PROGRESSION_ORDER` / `WC3_PROGRESSION_WEIGHT`
  are a WC3-local projection over the canon. Labels are sourced from the canon; the numeric weights are
  unchanged from the pre-Phase-1.1 values (byte-identical). This is explicitly a *projection*, not a competing
  canon — the naming was changed so it can never again be mistaken for the source of truth.

## 4. Validation surfaces (allowlists)

Stage-code allowlists now derive from the canon, not hand-maintained literals:
- `routes.ts` `VALID_STAGES = LIFECYCLE_STAGE_CODES`.
- `routes/capadex-enterprise.ts` `validStages = LIFECYCLE_STAGE_CODES`.

## 5. Stored values (NOT remapped — by design)

The DB persists human-readable stage strings in places (e.g. `'Clarity'`, `'Awareness'`) that downstream
engines read directly (`subscription-engine` stage-floor index; WC3/WC5/WC7B trend reads). These remain the
stored representation. The canon documents the alias/pre-stage relationship; **it does not rewrite stored data.**
Any future normalization of stored values is forward work (report 07), gated behind its own approved phase.

## 6. Ownership rule (going forward)

> Every coded lifecycle reference resolves through the canon for its runtime
> (`backend/lib/lifecycle.ts` or `frontend/src/lib/behavioural-insights.ts`).
> No module re-declares its own stage→label map or stage-code allowlist.
