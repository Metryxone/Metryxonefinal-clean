# 10 · Launch Blockers

Classified by the assessment taxonomy: **Launch Critical · High · Medium · Low · Future Enhancement**.
A "blocker" here means it must be resolved before *enterprise production* launch (charging real customers with
real data). Honest framing: **the platform is structurally ready; the blockers are operational/validation, not
missing features.**

## Launch Critical (must close before charging customers / onboarding real tenants)
| ID | Blocker | Why critical | Evidence |
|---|---|---|---|
| LC-1 | **Payments demo-mode fallback active without keys** | Could silently run non-production payment behavior; cannot take real money safely | `capadex-payments.ts` demo fallback (TD-5) |
| LC-2 | **Production secrets not confirmed set** (`SESSION_SECRET`, `DATABASE_URL`, `MONGODB_URI`, `OPENAI_API_KEY`/`EMERGENT_LLM_KEY`, `ZOHO_EMAIL`/`ZOHO_APP_PASSWORD`, real `UPLOAD_SERVICE_TOKEN`, Razorpay keys) | Missing → boot fail-fast (good) or degraded MFA email / AI / uploads | env-preflight + `<missing_secrets>` (MONGODB_URI, OPENAI_API_KEY, ZOHO_*) |
| LC-3 | **No runtime / outcome evidence** → production-confidence is `null` | Every cert composer withholds Production-Ready by design; accuracy/SLA/performance unmeasured | live DB ~0 real rows; all composers `production_confidence=null` |
| LC-4 | **No load/performance validation** | Concurrency, p95, multi-instance background-job safety unverified | only ad-hoc bench scripts (no standardized/repeatable load gate); 34 schedulers; single-thread ceiling |

## High (close before broad GA; acceptable to defer for a *controlled* pilot)
| ID | Blocker | Evidence |
|---|---|---|
| H-1 | RBAC seeded but **0 grants / 0 members** — enforcement not exercised end-to-end | governance seed log |
| H-2 | No unified test runner / coverage / CI gate (62 ad-hoc scripts, 1 npm test) | TD-3 |
| H-3 | Enterprise SSO (SAML/OIDC) not confirmed as a first-class flow | journey/enterprise report |
| H-4 | Backup / disaster-recovery runbook unverified in repo | enterprise report |
| H-5 | No external observability/APM for SLA monitoring | enterprise report |

## Medium
| ID | Item | Evidence |
|---|---|---|
| M-1 | Career Builder builder-paths + Learning intervention execution are PARTIAL | journeys 4 & 5 |
| M-2 | Institutional placement/accreditation honest-stubs (pending data integration) | journey 7 |
| M-3 | Parallel v1+v2 route families — decide deprecation/retirement | AD-2 |
| M-4 | Front-end >1 MB chunks — code-split heavy pages | AD-6 / performance |
| M-5 | AI Test Generator lacks rule-based fallback; OTP plaintext; UPLOAD_SERVICE_TOKEN hardening | AI-1, SEC-1, SEC-2 |

## Low
| ID | Item |
|---|---|
| L-1 | console.log hygiene / structured logging | 
| L-2 | replit audio client hardcoded "missing" key (cryptic 401) |
| L-3 | framework-admin-path allowlist needs a guard test (SEC-4) |

## Future Enhancement (explicitly NOT launch blockers)
- Activating the MX-700 / MX-800 dormant meta-intelligence layer (only with real runtime evidence; never to
  inflate metrics).
- Decomposing the `routes.ts` (14.5k) and EmployerPortalPage (10.1k) monoliths.
- Converging dual persistence (`storage.ts` vs pool/Drizzle).
- A generated schema catalog + name-collision lint for the 1,441-table surface.

## Blocker summary
- **4 Launch-Critical**, all **operational/validation** (payments mode, secrets, no runtime evidence, no load
  test) — **none are "build a missing feature."**
- **0 structural functional blockers** in the core journeys.
- The honest gating reality: **CAPADEX can enter a controlled enterprise pilot now** (after LC-1/LC-2), but
  **cannot be declared Production-Certified** until LC-3/LC-4 are converted from `null` to measured evidence.
