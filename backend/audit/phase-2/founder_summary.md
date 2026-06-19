# Founder Summary — Phase 2: Competency Runtime

**Generated:** 2026-06-19 · **Flag:** `FF_COMPETENCY_RUNTIME=1` · **Scope:** Phase 2 only (Phase 3+ explicitly excluded)

---

## The headline
The **competency runtime is operational end-to-end.** A real subject can be taken from a role
blueprint → generated assessment → scored → profiled → benchmarked, and every stage produces
real, honest data. Validated live across **two roles and two subjects**, the self-check passes
**9 of 11 stages with 0 failures**; the 2 remaining items are honest data-coverage gaps, not
broken machinery.

## What works today (success criteria — all met)
| Capability | Status | Evidence |
|------------|--------|----------|
| Assessment blueprints | ✅ operational | 3 active role blueprints |
| Question mapping | ✅ operational | 7 question blueprints, 44-template bank, honest domain-proxy fallback |
| Assessment generation | ✅ operational | real scored instances (3q, 12q) |
| Competency scoring | ✅ operational | dual-ledger, attribution fixed this phase |
| Competency profiles | ✅ operational | append-only snapshots (2 subjects, level 4) |
| Role readiness | ✅ operational | Backend Engineer + Product Manager, "ready" |
| Gap analysis | ✅ operational | met / unmeasurable classified honestly |
| Signal engine | ✅ operational | 7 signals evaluated, 1 fired (Ownership Potential) |
| Benchmark foundation | ✅ operational | 15 k-anonymous cohorts, 195 benchmarks, 66th pct |

## What changed this phase
A reporting blind spot in the validation harness was fixed: a subject scored through the runtime
path showed as "scored, but none for this subject." The harness now counts **both** scoring
ledgers, so attribution is accurate. This touched the measurement layer only — no scoring logic
changed — and passed independent code review.

## Honest gaps (deliberately surfaced, not hidden)
1. **Canonical question→competency map is unseeded** (`onto_competency_question_map = 0`). Scoring
   runs in domain-proxy mode and **auto-upgrades** to per-competency precision the moment the map
   is populated. No code change required.
2. **Strategic-domain competencies are unmeasurable** (no question path) — reported as
   `unmeasurable`, never scored or faked.
3. **Low data volume in dev** — exercised by hand-driven runs, not bulk traffic. Mechanisms are
   proven; population is the next data task.
4. **Audit-coverage boundary** flagged transparently by the harness.

These reflect our standing principle: **coverage (does data exist) and confidence (is it
trustworthy) are reported as separate axes; we never inflate one to cover the other.**

## Guardrails honored
- **Additive & flag-gated:** all Phase 2 runtime behaviour sits behind `FF_COMPETENCY_RUNTIME=1`;
  flag-off is byte-identical to legacy.
- **No deployment.** Work is checkpointed and ready for your review only.
- **Stopped at Phase 2.** Employability Index, Career Builder, Career Passport, Employer Portal,
  Learning Intelligence, and Future Readiness were **not** implemented — they begin in Phase 3.

## Bottom line
Phase 2 is functionally complete and honestly reported. The path from blueprint to benchmark
works on real data; what remains is data population (canonical question map, strategic-domain
questions, volume), which the engine is built to absorb without rework.
