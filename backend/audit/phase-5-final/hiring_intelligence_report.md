# Hiring Intelligence Report

**Phase:** 5 (Employer Lifecycle) — Final
**Date:** 2026-06-21
**Scope:** Offer generation, hire decisions, CTC integrity
**Validator:** v5.15.0
**Verdict:** ✅ **OPERATIONAL**

---

## 1. Subsystem

| Concern | Engine / route |
|---------|----------------|
| Hiring intelligence | `services/hiring-intelligence-engine.ts`, `routes/hiring-intelligence.ts`, `routes/employer-hiring-intelligence.ts` |
| Offers | `employer_offers` (ctc_fixed, ctc_variable, ctc_bonus, total_ctc) |
| Decisions | `interview_decisions` (`DECISION_TYPES`), `employer_candidates.decision_at`, `stage` |

## 2. Evidence — persistence (E2E stages 13–14)

```
[13] Offer Generated  ✓ employer_offers persisted (total_ctc=2000 ≥ ctc_fixed=1500, all ≥ 0)
[14] Candidate Hired   ✓ hire decision persisted (decision=hire, canonical)
                       ✓ candidate stage advanced to Hired
```

The offer writes a coherent CTC breakdown (fixed 1500 + variable 300 + bonus 200,
total 2000); the hire writes a canonical `decision='hire'` row and advances the
candidate `stage` to `Hired` with a `decision_at` timestamp.

## 3. Evidence — invariants (validator area `hiring`)

```
[hiring] status=pass measurable=true
   - offers_present: pass — 1 offer(s).
   - ctc_non_negative: pass — CTC components non-negative.
   - total_ctc_coherent: pass — totals coherent with fixed.
   - hire_decisions: pass — 1 hire decision(s).
```

All four checks PASS: every CTC component is non-negative, `total_ctc` is coherent
with its `ctc_fixed` floor, and the hire decision is canonical.

## 4. Honesty notes

- `ctc_non_negative` and `total_ctc_coherent` are **financial invariants** — a
  negative bonus or a total below the fixed component would FAIL, never pass silently.
- **Scope boundary:** this report stops at the *hiring decision and offer record*. It
  does **not** cover Commercial OS, subscriptions, payments, invoices, or revenue
  intelligence — those are Phase 6 and were explicitly out of scope here. `total_ctc`
  is an HR compensation field, **not** a billing/revenue figure.

## 5. Success criteria

| Criterion | Status | Basis |
|-----------|--------|-------|
| Hiring intelligence operational | ✅ | E2E stages 13–14 + `hiring` area PASS (4/4) |
