# 07 · Assessment Delivery Blueprint (Layer 4)

**Mode:** Read-only / planning-only. No changes. **Layer status: SUPPORTED (2 gaps: offline, accessibility).**

## Canonical Definition
Assessment Delivery is the runtime that presents an assessment to a taker: online/adaptive/timed delivery, resume, auto-save, navigation, accessibility, localization, and proctoring hooks. Primary surfaces: `FreeAssessmentModal.tsx` (CAPADEX consumer flow), `AdaptiveAssessmentRuntime.tsx` (V2 adaptive), `LbiAssessmentPlayer.tsx` (LBI), and `routes/caf-runtime.ts` (CAF sessions).

## Capability Evidence
| Capability | Status | Repository Evidence |
| :-- | :-- | :-- |
| Online Delivery | SUPPORTED | `FreeAssessmentModal.tsx`; `LbiAssessmentPlayer.tsx`. |
| Offline Delivery | **MISSING** | Only internal validation harnesses reference "offline"; no end-user offline mode. → GAP-AP-2 (Future). |
| Adaptive Delivery | SUPPORTED | `AdaptiveAssessmentRuntime.tsx`; `FreeAssessmentModal.tsx` `advanceAdaptive` → `/api/capadex/concern/adaptive-next`. |
| Timed Assessment | SUPPORTED | `caf_assessments.time_limit_mins`; `caf_sessions.time_elapsed_secs`. |
| Resume | SUPPORTED | `FreeAssessmentModal.tsx` localStorage draft resume; `/api/caf/sessions/:id/resume`. |
| Auto-save | SUPPORTED | `/respond` per-answer persistence; fire-and-forget telemetry to `/api/signals/telemetry`. |
| Navigation | SUPPORTED | Linear progression; `allow_review` authoring flag. |
| Accessibility | **MISSING** | No dedicated WCAG / screen-reader / high-contrast utilities in the core assessment components. → GAP-AP-3 (Medium). |
| Localization | SUPPORTED | `frontend/src/locales/` (10+ languages: hi, bn, te, ta, …); `services/global-intelligence.ts` `createLocalization` (m4-localization). |
| Proctoring Hooks | SUPPORTED | `caf_assessments.proctoring_level` (none/basic/full); `caf_sessions.proctoring_events` (JSONB). |

## Delivery Integrity
- **Resume + auto-save** are dual-pathed (localStorage client draft + server `/respond`), so a dropped connection does not lose progress.
- **Adaptive fallback** — the adaptive-next path always degrades to the batch pool (HTTP 200), never a 500, preserving delivery even when adaptive selection fails.

## Gaps
- **GAP-AP-2 (Future):** no end-user offline delivery mode.
- **GAP-AP-3 (Medium):** no dedicated accessibility layer (screen-reader semantics, keyboard-only navigation guarantees, contrast modes). Localization ≠ accessibility.

## Freeze Position
**FREEZE** the delivery model (online/adaptive/timed/resume/auto-save/proctoring/localization). Accessibility is a **high-value additive enhancement** to schedule (roadmap), and offline delivery is a future capability — neither requires an architecture change.
