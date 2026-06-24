# MX-74X · Section 3 — Role Readiness Framework (existing asset — activated, not built)

**Status:** EXISTING. MX-74X activates + documents it; no code change to the readiness math.
**Engines:** `services/role-readiness-v2.ts` (`computeRoleReadinessV2`),
`services/career-readiness-aggregator.ts`, `services/industry-readiness-engine.ts`,
`services/function-readiness-engine.ts`. **Flag:** `careerReadiness` (inherits suite).

---

## 1. The chain

```
measured competency profile ──▶ Role DNA target weights ──▶ Role Readiness V2 ──▶ fit band
   (onto_competency_profiles /        (onto_role_competency_         (per-role weighted
    onto_competency_score_runs)        profiles)                      readiness 0–100)
                                                           │
                              Industry readiness ◀─────────┤  (role_aggregation: demand = MAX
                              Function readiness ◀─────────┘   required, weight = prevalence
                                                                across onto_role_competency_profiles)
```

## 2. Key honesty rules (already enforced; MX-74X preserves them)

- **Role DNA empty → null, never coerced.** The expected-level read path
  (role → `onto_roles` → DNA profile → runtime weights) returns `null` when no DNA exists; the
  engine anchors to a stage default rather than fabricating a target.
- **Already-ready cap.** `readiness ≥ 85` caps Role *Potential* to "Low" in code (a positive
  signal, not a risk) — a blocking gap is never reported as Low risk.
- **Coverage ⟂ Confidence.** Coverage = how many required competencies are measured; Confidence is
  capped to "domain_proxy" when scores come from the 5-domain crosswalk rather than the 7-code bank.
- **Industry/Function have no direct competency source**, so demand is *derived* by aggregating
  `onto_role_competency_profiles` across roles and stamped `requirement_source='role_aggregation'`.
  Coverage ≠ readiness; the derivation is disclosed, never presented as authored data.

## 3. How MX-74X uses it

The new Career Path engine consumes `computeRoleReadinessV2` for anchor readiness context, and the
Career Intelligence panel already surfaces role/industry/function readiness. MX-74X adds the
durable suite flag so this chain is live on a clean boot, and surfaces the graph-backed path that
sits downstream of the anchor's readiness.
