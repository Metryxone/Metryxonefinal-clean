# 1 · Complete Capability Inventory

Measured from the live repository (2026-06-30). Grouped by capability class. "Flag" = file-registry flag in
`backend/config/feature-flags.ts`; ON = default true, OFF = default false (built but dormant).

## A. Product capabilities (customer-facing)
| Capability | Primary surface | State | Flag |
|---|---|---|---|
| Registration & user/child creation | `routes.ts /api/register` | COMPLETE | n/a (core) |
| Authentication (session + scrypt) | `routes.ts /api/login`, `firebase-auth.ts` | COMPLETE | n/a |
| Super-admin MFA (always-on, Zoho email) | `routes.ts /api/admin/mfa/*` | COMPLETE | n/a |
| CAPADEX free assessment (4-stage CUR→MAS) | `routes/capadex.ts` | COMPLETE | n/a (core) |
| Concern / clarity / signal intelligence | `routes/capadex-concern-intelligence.ts` (3,117 ln) | COMPLETE | mixed |
| Competency assessment + runtime (onto_*) | `services/competency-runtime.ts` (2,827 ln) | COMPLETE | `advancedCompetencyRuntimeV2` ON |
| Adaptive questioning / difficulty | `routes/adaptive-*-v2.ts` | COMPLETE | `adaptiveAssessmentRuntimeV2` ON |
| Career Builder | `pages/CareerBuilderPage.tsx` (8,754 ln) + `routes/career-seeker.ts` | PARTIAL (read-heavy) | `careerBuilderSuite` ON |
| Learning / interventions | `routes/intervention-engine.ts` | PARTIAL (execution fallback-heavy) | mixed |
| Employer / recruiter hiring funnel | `routes/job-posting-engine.ts`, `interview-intelligence.ts`, `employer-portal.ts` (2,495 ln) | COMPLETE (strongest) | mixed |
| Voice / avatar screening (AI) | `services/voice-screening-engine.ts` | COMPLETE (inert w/o key) | `voiceScreening`, `avatarInterview` |
| Institutional dashboards (univ/faculty/placement/parent) | `routes/institutional-intelligence.ts`, FE Unified*Dashboard | PARTIAL (placement/accreditation honest-stubs) | `institutionalIntelligence` |
| Reports (Omega / report-pack / report-factory) | `routes/omega-report.ts`, `services/report-pack.ts` (1,686 ln) | COMPLETE | mixed |
| Analytics (enterprise/workforce) | `routes/enterprise-analytics.ts`, `workforce-analytics.ts` | COMPLETE | mixed |
| Commercial: payments / subscriptions / entitlements | `routes/capadex-payments.ts`, `services/entitlement.ts` | COMPLETE (Razorpay + demo fallback) | `commercialActivation` etc. |

## B. AI capabilities
| Capability | Surface | State |
|---|---|---|
| Voice transcription + rubric scoring (Whisper + chat) | `voice-screening-engine.ts` | COMPLETE, degrades honestly (503 + abstain) |
| Resume / LinkedIn / interview critique | `routes/employability-studio.ts` | COMPLETE, rule-based fallback w/ source tag |
| Career discovery coach | `services/career-discovery-guidance.ts` | COMPLETE, rule-based fallback |
| AI test/MCQ generation | `services/aiTestGenerator.ts` | PARTIAL — **no rule-based fallback** (hard-fails w/o key) |
| AI governance (hallucination/rubric audit) | `services/ai-governance-llm.ts`, `ai-governance-v2.ts` | COMPLETE, regex fallback |
| AI provenance/confidence tagging | across AI services | COMPLETE (source: ai / rule-based / static) |

8 files reference OpenAI, 4 reference EMERGENT_LLM, 27 `OPENAI_API_KEY` guard sites → AI is consistently
guarded and inert (not fabricating) without keys.

## C. Engineering / platform-intelligence capabilities (meta-layer — mostly DORMANT by design)
| Program | Surface | State |
|---|---|---|
| MX-700 Platform Lifecycle Intelligence (1.37–1.43) | `routes/platform-lifecycle-*.ts`, `services/platform-*.ts` | BUILT, **DORMANT** (all flags OFF) |
| MX-800 Enterprise Intelligence (2.1–2.14) | `routes/*-intelligence*.ts`, `enterprise-intelligence-*.ts` | BUILT, **DORMANT** (all flags OFF) |
| Engineering / Runtime / Knowledge / Decision / Predictive / Recommendation / Continuous-Learning Intelligence | `services/*-intelligence*.ts` | BUILT, **DORMANT** |
| Platform Intelligence Registry + Operations console | `routes/platform-intelligence-*.ts` | BUILT, **DORMANT** |
| Question Factory + coverage population | `routes/question-factory.ts` | BUILT, flag OFF |

These are read-only composers/certifiers over already-computed data; OFF = byte-identical to legacy. They do
not block launch and must not be force-activated without runtime evidence.

## D. Infrastructure capabilities
| Capability | Evidence | State |
|---|---|---|
| Postgres (Drizzle + raw pool) | `DATABASE_URL`, 1,441 live tables | COMPLETE |
| MongoDB | boot log "MongoDB connected" | COMPLETE (optional, `MONGO_REQUIRED=false`) |
| Session store (Postgres-backed) | `express_sessions` | COMPLETE |
| FastAPI bulk-upload service | `backend-main/`, `FASTAPI_URL` proxy | COMPLETE (prod-only wiring) |
| WebSocket (session live) | `/ws/session/:sessionId` | COMPLETE |
| Background scheduler (AI governance) | "monitoring every 5 min" | COMPLETE (running) |
| Email (Zoho) | `backend/email.ts` (2,079 ln) | COMPLETE (needs creds) |
| GCP/Firebase deploy path | `scripts/deploy-gcp.sh`, `firebase.json` | COMPLETE (canonical prod path) |

## E. Enterprise capabilities
| Capability | Surface | State |
|---|---|---|
| RBAC v2 (roles/permissions/groups) | governance seed: 10 roles / 44 perms / 8 groups | COMPLETE (0 grants/members seeded — config-ready, unpopulated) |
| Multi-tenant isolation | `scripts/cross-org-isolation-suite.ts` (`npm run test:isolation`) | COMPLETE (only consolidated test suite) |
| Audit logging + PII redaction | `redactJson`/`redactDeep`, unified trail | COMPLETE |
| Governance / compliance / fairness engines | `routes/governance-v2.ts`, `paie-governance.ts` | COMPLETE (gated) |
| Enterprise certification composers | MX-105X, MX-106X, MX-108, MX-800 2.14 | COMPLETE (read-only, STRUCTURAL verdict only) |

## Inventory totals (measured)
- ~**4,000 API endpoints** across 323 route files + routes.ts.
- **190 capability flags**; **32 ON** (core product + V2 runtime), **158 OFF** (meta-intelligence + additive phases).
- The ON set is the actual product runtime; the OFF set is overwhelmingly the self-referential platform/
  enterprise intelligence meta-layer. **Dormant ≠ debt** — these are deliberately flag-gated.
