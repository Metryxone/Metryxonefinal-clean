# WC-C10 · Deliverable 5 — Launch Configuration Matrix

**Generated**: 2026-06-10T12:45:42.943Z
**Scope**: Verification items 6 (FF matrix), 8 (logging), 9 (monitoring)

---

## Item 6 — Feature-Flag Matrix

Source: WC-C8A `production_ff_matrix.md` (canonical). Reproduced here with current-state check.

### Dev workflow command (current, ALL flags active)
```
FF_RUNTIME_INTELLIGENCE_ACTIVATION=1 FF_RUNTIME_INTELLIGENCE_PIPELINE=1
FF_WC3_STAGE=1 FF_WC3_OUTCOME=1 FF_WC3_JOURNEY=1 FF_WC3_PERSONALIZATION=1
FF_WC3_LONGITUDINAL=1 FF_DECISION_ORCHESTRATOR=1 FF_JOURNEY_GROWTH_PLAN_BRIDGE=1
FF_DECISION_MENTOR_BRIDGE=1 FF_COMMERCIAL_ACTIVATION=1 FF_DECISION_PERSISTENCE=1
FF_BEHAVIOUR_NAMESPACE_ALIGNMENT=1
```

⚠️ **Dev workflow includes `FF_COMMERCIAL_ACTIVATION=1`** — classified HOLD in WC-C8A matrix
(requires Razorpay configured end-to-end). Enabling it in production with no payment processor
would surface commercial flows backed by DEMO mode only.

### Free Consumer Launch — recommended production command

```bash
cd backend && \
  FF_RUNTIME_INTELLIGENCE_ACTIVATION=1 \
  FF_RUNTIME_INTELLIGENCE_PIPELINE=1 \
  FF_WC3_STAGE=1 \
  FF_WC3_OUTCOME=1 \
  FF_DECISION_PERSISTENCE=1 \
  FF_BEHAVIOUR_NAMESPACE_ALIGNMENT=1 \
  npm run dev:server
```

*(Source: WC-C8A production_ff_matrix.md — Free Consumer minimum set)*

### Full flag classification (from WC-C8A)

| Flag | Free Launch | Paid Pilot | WC-C8A verdict |
|---|---|---|---|
| `FF_WC3_STAGE` | ✅ ENABLE | ✅ | SAFE_TO_ENABLE |
| `FF_WC3_OUTCOME` | ✅ ENABLE | ✅ | REVIEW_FIRST (verify spine-capture live) |
| `FF_DECISION_PERSISTENCE` | ✅ ENABLE | ✅ | SAFE_TO_ENABLE |
| `FF_BEHAVIOUR_NAMESPACE_ALIGNMENT` | ✅ ENABLE | ✅ | SAFE_TO_ENABLE |
| `FF_RUNTIME_INTELLIGENCE_ACTIVATION` | ✅ ENABLE | ✅ | REVIEW_FIRST |
| `FF_RUNTIME_INTELLIGENCE_PIPELINE` | ✅ ENABLE | ✅ | REVIEW_FIRST |
| `FF_WC3_JOURNEY` | ⏸️ after outcome coverage confirmed | ✅ | REVIEW_FIRST |
| `FF_WC3_PERSONALIZATION` | ⏸️ after content sign-off | ✅ | REVIEW_FIRST |
| `FF_WC3_LONGITUDINAL` | ⏸️ degrades honestly | ✅ | REVIEW_FIRST |
| `FF_DECISION_ORCHESTRATOR` | ⏸️ after L5B penalty map verified | ✅ | REVIEW_FIRST |
| `FF_JOURNEY_GROWTH_PLAN_BRIDGE` | ⏸️ after M5 handoff confirmed | ✅ | REVIEW_FIRST |
| `FF_DECISION_MENTOR_BRIDGE` | ⏸️ recommended | ✅ | REVIEW_FIRST |
| `FF_COMMERCIAL_ACTIVATION` | ❌ HOLD | 🔑 after Razorpay confirmed | HOLD |

---

## Item 8 — Production Logging

| Check | Evidence | Result |
|---|---|---|
| Console logging | `console.log/error/warn` throughout backend | ✅ Basic (present) |
| Structured / APM logging | No Winston / Pino / Sentry found in backend | ❌ Not configured |
| Error stack traces in prod | index.ts:174 — prod mode omits stack traces from HTTP responses | ✅ Code-verified |
| Request ID header | `X-Request-Id` present in live probes (Replit-injected) | ✅ Present |

**Assessment**: console.log logging is adequate for initial launch to diagnose issues via
Replit's deployment log viewer. Structured/APM logging (Sentry, Datadog, Pino) is a
post-launch hardening item, not a launch blocker.

---

## Item 9 — Production Monitoring

| Check | Evidence | Result |
|---|---|---|
| Uptime monitoring (external) | No Uptime Robot / BetterUptime / Pingdom configured | ❌ Not configured |
| Error tracking / alerting | No Sentry or equivalent configured | ❌ Not configured |
| Replit deployment health | Replit provides basic deployment status in its console | ✅ Built-in |
| Database monitoring | Neon dashboard provides query metrics | ✅ Built-in |

**Assessment**: no external monitoring is configured. For a soft consumer launch this is
acceptable — Replit's built-in deployment health and Neon's dashboard provide baseline
visibility. External monitoring (uptime alerts, error tracking) is strongly recommended
before scaling but is not a launch blocker for initial traffic.

---

**Verdicts**
- FF matrix: ✅ Documented (WC-C8A); dev command includes HOLD flag — **omit FF_COMMERCIAL_ACTIVATION from production**
- NODE_ENV: must be set to `production` in Deployments pane — owner action
- Logging: ✅ Adequate for launch (enhancement post-launch)
- Monitoring: ⚠️ No external monitoring — non-blocking for initial launch; recommended before scaling
