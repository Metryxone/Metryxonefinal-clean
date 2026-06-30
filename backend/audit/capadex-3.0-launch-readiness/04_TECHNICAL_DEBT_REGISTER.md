# 4 · Technical Debt Register

Measured, not estimated. Each item carries severity and evidence. Note up front: **the codebase is NOT
litter-prone** — only ~2 genuine source TODO/FIXME markers exist; the larger debt is structural (monoliths,
schema fragmentation, parallel runtimes).

## TD-1 · Self-reported markers — LOW (honest positive)
- **Measured:** raw scan matched 11 marker lines, but reading them shows **most are scanner pattern-strings**
  inside `services/engineering-intelligence.ts` and `services/platform-evolution-intelligence.ts` (they
  literally search for `TODO/FIXME/HACK/XXX`). Genuine markers:
  - `routes.ts:6699` — `TODO: Send password reset email to mentor with temporary credentials` (real).
  - `routes.ts:12117` — `XXX` appears in a doc-comment example, not a defect.
- **Severity:** LOW. The platform has effectively ~1 real outstanding code TODO. **Do not inflate.**

## TD-2 · Monolithic files — MEDIUM/HIGH (maintainability)
| File | Lines | Risk |
|---|---|---|
| `frontend/src/pages/EmployerPortalPage.tsx` | **10,160** | very high — single-file page, hard to review/test |
| `backend/routes.ts` | **14,504** | very high — central monolith; route-order traps (memory) |
| `frontend/src/pages/CareerBuilderPage.tsx` | **8,754** | high |
| `backend/storage.ts` | 5,057 | high |
| `frontend/src/components/UnifiedParentDashboard.tsx` | 5,948 | high |
| `frontend/src/components/UnifiedInstituteDashboard.tsx` | 4,742 | high |
| `backend/routes/capadex.ts` | 4,391 | medium |
- **Severity:** MEDIUM–HIGH. Not launch-blocking (they build and run) but a sustained velocity/risk tax.
  Recommend incremental extraction post-launch, **not** a big-bang rewrite (forbidden by scope anyway).

## TD-3 · Test coverage shape — MEDIUM
- **Measured:** 62 backend test files, but **only one `npm` test script** (`test:isolation`). The rest are
  individual `tsx` scripts run as ad-hoc Replit workflows (degradation/smoke/engine unit tests).
- **No unified test runner, no coverage measurement, no CI gate.** Frontend production build is the only
  consistently-enforced gate (it passes).
- **Severity:** MEDIUM. Enterprise customers expect a repeatable test+coverage pipeline. See roadmap.

## TD-4 · Logging hygiene — LOW
- **Measured:** 84 `console.*` in frontend `src`; 34 background `setInterval/setImmediate` occurrences.
- **Severity:** LOW. Acceptable; recommend a structured logger + stripping noisy `console.log` before GA.

## TD-5 · Payments demo-mode fallback — HIGH (launch-gating behavior)
- `capadex-payments.ts` falls back to a **demo mode** when Razorpay keys are absent. Safe in dev, but if
  deployed without keys it silently does not take real money / or behaves non-productionally.
- **Severity:** HIGH (operational). Must be keyed + demo path disabled before charging customers. (Also in
  Launch Blockers.)

## TD-6 · AI Test Generator has no rule-based fallback — MEDIUM
- `services/aiTestGenerator.ts:204` hard-fails without `OPENAI_API_KEY`, unlike Employability Studio / Career
  Discovery which degrade to rule-based with a source tag.
- **Severity:** MEDIUM. Inconsistent degradation; add an honest fallback or a clean 503.

## TD-7 · Replit audio client hardcoded "missing" key — LOW
- `replit_integrations/audio/client.ts` defaults the key to the literal `"missing"`, producing cryptic 401s
  instead of the clean 503 used elsewhere.
- **Severity:** LOW.

## TD-8 · OTP plaintext storage for standard users — LOW/MEDIUM
- Standard-user OTPs appear stored in plaintext in the `capadex` table (per prior `wc-c8` audit), whereas
  passwords use scrypt.
- **Severity:** LOW–MEDIUM. Short-lived codes, but hashing/expiry hardening is advisable for enterprise.

## Debt rollup
| Severity | Items |
|---|---|
| HIGH | TD-2 (monoliths, maintainability) · TD-5 (payments demo-mode, operational) |
| MEDIUM | TD-3 (no unified test/CI) · TD-6 (AI gen fallback) · TD-8 (OTP storage) |
| LOW | TD-1 (markers) · TD-4 (logging) · TD-7 (audio key) |
