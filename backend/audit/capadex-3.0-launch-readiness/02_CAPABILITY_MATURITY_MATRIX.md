# 2 · Capability Maturity Matrix

Classification per the assessment taxonomy: **COMPLETE · PARTIAL · DORMANT · DUPLICATED · TECHNICAL DEBT ·
BLOCKED · MISSING**. A capability can carry more than one tag (e.g. COMPLETE + DUPLICATED). Verdicts are
*structural* (code exists and is wired); production-confidence is a separate axis (see note at end).

## Core product runtime (flags ON)
| Capability | Maturity | Evidence / caveat |
|---|---|---|
| Registration | COMPLETE | `/api/register` with limiter, password policy, child creation |
| Authentication + session | COMPLETE | scrypt, lockout, Postgres session store |
| Super-admin MFA | COMPLETE | always-on; dev code → console; needs Zoho creds for email delivery |
| CAPADEX free assessment | COMPLETE | 4-stage flow, scoring, cognitive-state mgmt |
| Concern/clarity/signal intelligence | COMPLETE | large engine, idempotent boot seeding |
| Competency runtime (V2) | COMPLETE + DUPLICATED | `competency-runtime-v2` ON; v1 route sibling still mounted |
| Adaptive assessment/difficulty (V2) | COMPLETE + DUPLICATED | `adaptive-assessment-v2` ON; v1 sibling mounted |
| Reports (Omega/report-pack) | COMPLETE | enriched ontology reporting |
| Career Builder | **PARTIAL** | read/analytical paths rich; active "builder"/roadmap-mutation paths thin |
| Learning / interventions | **PARTIAL** | recommendation generation present; intervention *execution* fallback-heavy |

## Employer / commercial
| Capability | Maturity | Evidence / caveat |
|---|---|---|
| Employer hiring funnel | COMPLETE | strongest journey; FSM job posting + interview intelligence + audit trail |
| Voice/avatar screening | COMPLETE (AI-gated) | inert (503/abstain) without `OPENAI_API_KEY` |
| Payments (Razorpay) | COMPLETE | order→verify→webhook; **demo-mode fallback when keys absent** (must disable for prod) |
| Subscriptions / entitlements | COMPLETE | entitlement engine; package→entitlement linkage gap noted in memory (`users` has no email col) |

## Institutional / enterprise
| Capability | Maturity | Evidence / caveat |
|---|---|---|
| University/Faculty/Parent dashboards | PARTIAL | implemented behind `institutionalIntelligence` flag |
| Placement / Accreditation | PARTIAL (honest-stub) | endpoints return "honest unavailable/empty" pending data integration |
| RBAC v2 | COMPLETE (unpopulated) | 10 roles/44 perms/8 groups seeded; **0 grants, 0 members** → config-ready, not exercised |
| Multi-tenant isolation | COMPLETE | only consolidated automated suite (`test:isolation`) |
| Audit + PII redaction | COMPLETE | redact-at-write, unified read trail |

## Meta-intelligence layer (flags OFF — built but dormant *by design*)
| Program | Maturity | Note |
|---|---|---|
| MX-700 Platform Lifecycle Intelligence 1.37–1.43 | **DORMANT** (not debt) | read-only composers; OFF = byte-identical |
| MX-800 Enterprise Intelligence 2.1–2.14 | **DORMANT** (not debt) | certification composers; verdict STRUCTURAL only |
| Engineering/Runtime/Knowledge/Decision/Predictive/Recommendation/Continuous-Learning Intelligence | **DORMANT** | self-referential meta-layer |
| Question Factory | DORMANT | draft-only pipeline, human approval gated |

## Tag rollup (measured)
| Tag | Count / scope | Notes |
|---|---|---|
| COMPLETE | Core product + employer + commercial + admin/superadmin journeys (8 of 11 journeys) | structurally implemented & wired |
| PARTIAL | Career Builder, Learning/interventions, Institutional dashboards (3 of 11 journeys) | thin action/execution paths or honest stubs |
| DORMANT | ~**158** of 190 flags | overwhelmingly the MX-700/MX-800 meta-layer — deliberate, **not** technical debt |
| DUPLICATED | **20** `-v2` files (5 with v1 route sibling still mounted) | parallel route families — see Architecture Debt Register |
| TECHNICAL DEBT | low marker count (~2 TODO); large-file/monolith debt is the real item | see Technical Debt Register |
| BLOCKED | none structurally blocked | blockers are operational/validation (no prod data, demo-mode payments, secrets) |
| MISSING | no large missing product feature found | gaps are completion/validation, not absence |

## Maturity ceiling (honest)
Per the platform's own constitution and certification engines, the achievable maturity today is **Managed
(Level 3)**. **Levels 4–5 are WITHHELD** because there is **no runtime-adoption or outcome data** to
demonstrate Optimizing/Self-Optimizing behavior. Structural maturity is high; **production confidence is a
separate, currently-unmeasurable axis (null, not zero).**
