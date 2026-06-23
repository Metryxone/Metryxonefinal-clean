# D15 — Workforce Intelligence (NEW domain) · 100X Re-certification

**Verdict: PARTIAL.** **Score: 70/100** (new in Phase 10 — the most data-backed of the Phase 8/9 additions).

## Live evidence
- `wos_*` substrate: workforce_risk **60** · skill_obsolescence **325** · market_signals **81** · role_emergence **6** · ai_exposure **340**.
- `career_readiness_history`: **4** rows / **1** subject.

## What Phase 1–9 added
- **Phase 9 — Enterprise Workforce Console** (`enterprise-workforce-console.ts`): a read-only never-throws aggregator that **composes** the predictive-workforce engine + M5 + the `wos_*` substrate and `career_readiness_history`. Flag-gated; status ≠ score; snapshot is the only write path.

## Honest gaps
- The market/risk/obsolescence/AI-exposure substrate is genuinely populated (real rows), but **readiness history is single-subject (4 rows / 1 subject)** — workforce-level aggregation has a real substrate yet a thin longitudinal population.
- Console is flag-gated (dormant in the running workflow; the MX-100X file-registry flags default OFF and are not in the workflow command).

## Why PARTIAL (and why higher than the other new domain)
Unlike Global Readiness (0 content), Workforce Intelligence has a real populated substrate (risk/market/AI-exposure), so it earns a higher PARTIAL — but single-subject readiness history and flag-OFF dormancy keep it below PASS.
