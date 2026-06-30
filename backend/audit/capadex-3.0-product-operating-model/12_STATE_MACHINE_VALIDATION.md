# 12 · State Machine Validation

CAPADEX runs several explicit/implicit state machines. Validated for: defined states, defined transitions,
guards, terminal states, and idempotency.

| State machine | States | Transition driver | Guards / idempotency | Status |
|---|---|---|---|---|
| **Lifecycle stage** | Awareness→Curiosity→Clarity→Growth→Mastery | derived (`index+1`) + monetization | weak (no readiness guard); append-only log | **PARTIAL** (see 11) |
| **Hiring funnel** | 9-stage (posting→assessment→interview→…→outcome) | employer actions / events | snapshot write-once at FIRST terminal move; `ON CONFLICT(type,ref_id)` | **IMPLEMENTED** |
| **Decision orchestration** | observe→diagnose→route→decision-support | `DecisionOrchestrator` fit_score | idempotent snapshot (sole builder; race fixed) | **IMPLEMENTED** |
| **Platform lifecycle** (MX-700) | discovered→managed `lifecycle_state` ⟂ derived `activation_state` | human `transitionState` vs flag runtime | MANAGED state preserved on re-discovery (never clobbered) | **DORMANT (flag-gated)** |
| **MFA / auth** | issued→verified→used; lockout | login + code verify | always-on lockout; codes single-use; 2FA mandatory for super-admin | **IMPLEMENTED** |
| **Payment** | created→paid→(refunded) | gateway webhook | webhook fails CLOSED; idempotency null-replay→409 | **IMPLEMENTED** |
| **Entitlement** | granted/denied per session | server principal | fail-closed quota via advisory lock | **PARTIAL** (package→entitlement gap) |

## Findings (honest)
- **The transactional state machines (hiring, payment, MFA, decision) are well-engineered** — write-once
  snapshots, `ON CONFLICT` idempotency, fail-closed guards. These are production-grade.
- **The lifecycle state machine is the weak one** — soft transitions, no readiness guard (consistent with 11).
- **Platform-lifecycle state machine** is exemplary in design (MANAGED ⟂ DERIVED separation) but **dormant**.
- **No state machine fabricates terminal states or silently swallows transitions** (memory documents the
  fixes: idempotency null-replay→409 not 500; sole-builder race fix).

## Verdict
**State-machine layer: IMPLEMENTED & robust for transactional flows; PARTIAL for the user lifecycle.** The one
to strengthen is the lifecycle SM (add readiness guards) — same root as GAP-P1/P2.
