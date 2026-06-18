# Feature Activation Matrix — MetryxOne

**Date:** 2026-06-17
**Type:** Read-only audit. No code modified.
**Companion docs:** `feature_flag_inventory.md`, `production_parity_report.md`.

For each of the 10 named products: the gating flag(s), the controlling mechanism, and the **effective activation state** in Development, Preview, and Production. "Core" = always-registered routes (no flag). "Intelligence/depth" = additive flag-gated layers.

> Reminder: **Dev = Preview** (same workflow process). **Production sets zero `FF_*`** in all visible config (see inventory §caveat). Flag-OFF behaviour per code: registry-gated routes return `{enabled:false}` or HTTP 503; the 4 `process.env` gates return **503**.

---

## Legend
- ✅ **Active** — routes served, flag ON
- ⚠️ **Core-only** — base routes work, but additive intelligence layers OFF
- ❌ **Disabled (503)** — flag OFF → routes 503 / `{enabled:false}`

---

## 1. CAPADEX (behavioural assessment)
| Surface | Gating | Dev | Preview | Prod |
|---|---|---|---|---|
| Core assessment flow (`/api/capadex/*`: analyze, clarify, questions, result, report) | **none (always on)** | ✅ | ✅ | ✅ |
| Runtime Intelligence Activation / Pipeline | `runtimeIntelligenceActivation`, `runtimeIntelligencePipeline` | ✅ | ✅ | ❌ |
| WC-3 chain (stage/outcome/journey/personalization/longitudinal) | `wc3Stage`,`wc3Outcome`,`wc3Journey`,`wc3Personalization`,`wc3Longitudinal` | ✅ | ✅ | ❌ |
| Decision orchestration + bridges + persistence | `decisionOrchestrator`,`journeyGrowthPlanBridge`,`decisionMentorBridge`,`decisionPersistence` | ✅ | ✅ | ❌ |
| Commercial activation + entitlement enforcement | `commercialActivation`,`commercialEntitlementEnforcement` | ✅ | ✅ | ❌ |
| User-intelligence / trend / behaviour-trend / forecast | `userIntelligenceFoundation`,`trendIntelligence`,`behaviourTrendIntelligence`,`forecastIntelligence`,`behaviourNamespaceAlignment` | ✅ | ✅ | ❌ |

**Verdict:** Dev/Preview ✅ full · **Prod ⚠️ Core-only** — assessment works, but **every intelligence/commercial layer is OFF** in prod.

---

## 2. Competency Intelligence
| Surface | Gating | Dev | Preview | Prod |
|---|---|---|---|---|
| V2 competency runtime (scoring, blueprints, graph, fusion, narratives…) | registry **default-true** (`advancedCompetencyRuntimeV2`, `competencyGraphRuntime`, etc.) | ✅ | ✅ | ✅ |
| CI Engine D1–D10 + E1–E5 (`competency-intelligence-engine.ts`) | **`FF_COMPETENCY_INTELLIGENCE`** (process.env) | ✅ | ✅ | ❌ (503) |

**Verdict:** Dev/Preview ✅ · **Prod ⚠️** — V2 runtime on (default-true), but the **CI Engine layer 503s** in prod.

---

## 3. LBI (Learning Behaviour Intelligence)
| Surface | Gating | Dev | Preview | Prod |
|---|---|---|---|---|
| LBI intelligence endpoints (`lbi-intelligence.ts`) | **`FF_LEARNING_INTELLIGENCE`** | ✅ | ✅ | ❌ (503) |
| LIP (`lip.ts`), `lbi-unifier.ts` | **`FF_LEARNING_INTELLIGENCE`** | ✅ | ✅ | ❌ (503) |

**Verdict:** Dev/Preview ✅ · **Prod ❌ Disabled** — entire LBI intelligence surface 503s in prod.

---

## 4. EI (Employability Index / Passport)
| Surface | Gating | Dev | Preview | Prod |
|---|---|---|---|---|
| Employability Passport artifact + public recruiter view | `employabilityPassport` **default-true** | ✅ | ✅ | ✅ |
| Employability Index engine / graph (kg_* live graph) | not flag-gated (verified: no `FF_` gate found on EI core) | ✅ | ✅ | ✅ |

**Verdict:** ✅ Active everywhere. **No parity gap** (note: distinct from "Career Passport" #10, which IS gated). *Confidence: medium — EI surface is broad; the Passport + index core are confirmed ungated, but I did not exhaustively enumerate every EI sub-route.*

---

## 5. Career Builder
| Surface | Gating | Dev | Preview | Prod |
|---|---|---|---|---|
| Career Builder page + base career routes (profile/resume/jobs/mentors) | not flag-gated for core | ✅ | ✅ | ✅ |
| Career Graph Intelligence (`career-graph.ts`, `career-pathways-intelligence.ts`) | **`FF_CAREER_GRAPH`** | ✅ | ✅ | ❌ (503) |
| Future Readiness Platform (`frp.ts`) | **`FF_FUTURE_READINESS`** | ✅ | ✅ | ❌ (503) |
| Career Operating System intelligence (additive engines surfaced in tabs) | composed in-tab; degrade-silent when data/flags absent | ✅ | ✅ | ⚠️ degraded |

**Verdict:** Dev/Preview ✅ · **Prod ⚠️ Core-only** — page + base tabs work, but **Career Graph + Future Readiness 503**, and CareerOS intelligence silently degrades.

---

## 6. Employer OS (EIOS)
| Surface | Gating | Dev | Preview | Prod |
|---|---|---|---|---|
| Employer portal core (7 `employer_*` tables, hiring, candidate drawer) | not flag-gated for core | ✅ | ✅ | ✅ |
| Talent Intelligence Graph + talent-* engines (digital-twin, scoring, readiness, signal-master, concern-intelligence, competency-dna) | **`FF_CAREER_GRAPH`** | ✅ | ✅ | ❌ (503) |
| EIOS World-Class Verified V2 (WS15 runtime cert, bulk import, snapshots, export) | `eiosWorldClassVerifiedV2` | ✅ (verified depth) | ✅ | ❌ (static pass, export 503) |

**Verdict:** Dev/Preview ✅ · **Prod ⚠️ Core-only** — employer portal works, but **the entire talent-graph intelligence layer 503s** and EIOS-V2 depth falls back to static.

---

## 7. Report Factory
| Surface | Gating | Dev | Preview | Prod |
|---|---|---|---|---|
| `/api/rf/*` + `/api/admin/rf/*` (8-engine report generation) | `reportFactory` | ✅ | ✅ | ❌ (503) |

**Verdict:** Dev/Preview ✅ · **Prod ❌ Disabled** — all Report Factory routes 503 (per flag comment: "Flag OFF → all `/api/rf/*` … return 503").

---

## 8. AI Governance
| Surface | Gating | Dev | Preview | Prod |
|---|---|---|---|---|
| `/api/governance/ai/*` (15-table `aig_*` warehouse) | `aiGovernance` | ✅ | ✅ | ❌ (503) |

**Verdict:** Dev/Preview ✅ · **Prod ❌ Disabled** — all AI Governance routes 503 (per flag comment).

---

## 9. Enterprise Analytics
| Surface | Gating | Dev | Preview | Prod |
|---|---|---|---|---|
| `/api/analytics/*` (12-table `anl_*` warehouse, KPI/cohort/exec dashboard) | `enterpriseAnalytics` | ✅ | ✅ | ❌ (503) |

**Verdict:** Dev/Preview ✅ · **Prod ❌ Disabled** — all Enterprise Analytics routes 503 (per flag comment). *Note: this is also the backing API for the SA-100X "Executive Intelligence cockpits" — those would 503 in prod.*

---

## 10. Career Passport
| Surface | Gating | Dev | Preview | Prod |
|---|---|---|---|---|
| `/api/passport/*` (12 `cp_*` tables, sharing/verification/privacy/analytics) | `careerPassport` | ✅ | ✅ | ❌ (503) |

**Verdict:** Dev/Preview ✅ · **Prod ❌ Disabled** — all Career Passport routes 503 (per flag comment).

---

## Summary matrix

| # | Product | Dev | Preview | Prod | Parity |
|---|---|---|---|---|---|
| 1 | CAPADEX | ✅ | ✅ | ⚠️ Core-only | ❌ gap |
| 2 | Competency | ✅ | ✅ | ⚠️ Core-only (CI Engine 503) | ❌ gap |
| 3 | LBI | ✅ | ✅ | ❌ Disabled | ❌ gap |
| 4 | EI / Employability Passport | ✅ | ✅ | ✅ | ✅ ok |
| 5 | Career Builder | ✅ | ✅ | ⚠️ Core-only | ❌ gap |
| 6 | Employer OS | ✅ | ✅ | ⚠️ Core-only | ❌ gap |
| 7 | Report Factory | ✅ | ✅ | ❌ Disabled | ❌ gap |
| 8 | AI Governance | ✅ | ✅ | ❌ Disabled | ❌ gap |
| 9 | Enterprise Analytics | ✅ | ✅ | ❌ Disabled | ❌ gap |
| 10 | Career Passport | ✅ | ✅ | ❌ Disabled | ❌ gap |

**9 of 10 products diverge between Dev/Preview and Production.** Only EI (Employability Passport, default-true) is at parity. **5 products fully disabled (503) in prod**; **4 reduced to core-only**.

> **Confidence note (honesty):** "Core works in prod" for CAPADEX / Career Builder / Employer OS / Competency means the *non-flag-gated* base routes are registered regardless of flags; I confirmed the gating flags but did **not** runtime-hit prod (the app's prod deployment is out of scope for an audit-only pass, and prod env is not introspectable). States are derived from `.replit` config + code-level flag gates, not from live prod responses.
