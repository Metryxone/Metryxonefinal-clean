# WC-5 Track A — Decision Reachability Audit (Output #1)

Can CAPADEX derive, for a given concern, the full chain **Stage → Context → Outcome →
Journey → Product → Action**? This report measures reachability against the **real**
implemented layers, and the Missing Decision Matrix lists where the chain breaks.

> **Definitions used (honest, code-grounded):**
> - *Reachable* = a deterministic, library/ontology-backed path exists in code that
>   produces a non-fabricated result for that link.
> - *Partial* = the link produces a result but with a known honesty caveat (degraded
>   fallback, corpus_pending, or "remap to an adjacent product").
> - *Not reachable* = no backend logic closes the link (UI stub or absent).

---

## A.1 Link-by-link reachability (system-wide)

| Chain link | Implemented by | Reachability | Honest caveat |
|------------|----------------|:---:|---------------|
| Concern | `resolveCapadexConcern` + `capadex_concerns_master` (2,490) + clarity bridge-tag picker | **High** | Keyword/regex fallback never 404s, but free-text → bank mapping is coarse (Adult vs Student tracks) |
| Stage | L1 `stage-intelligence.ts` (`stage_code`+`csi_profiles`) | **High** | Confidence degrades to `unclassified` when neither source present; FE/BE stage taxonomies differ |
| Context | L5B `question-context-intelligence.ts` sidecar | **Partial** | ~26% resolved / ~74% honest GENERAL; **not consumed at runtime** (offline sidecar only) |
| Outcome | L2 `outcome-intelligence.ts` (6 models) | **High** | `exam_readiness` gated; emits `unclassified` when no constructs overlap |
| Journey | L3 `journey-intelligence.ts` (6 routes) | **High** | `competitive_exam` corpus_pending; `family_support` remaps to mentoring; mentoring is universal fallback |
| Product | L3 route → product path mapping | **Partial** | Route resolves, but target product is REAL only for LBI; others PARTIAL/STUB (see Track B) |
| Action | `intervention-intelligence-engine` + `capadex-intervention-engine` + `recommendation-builder` | **High** | Library-backed; produces nothing when ontology→library match absent (honest) |
| **Decision (unify all of the above)** | — | **Not reachable** | **No composition layer exists**; each link is queried independently, never fused into one ranked decision |
| Growth Plan | M5 `m5_career_growth_plans` + AI-coach (decoupled) | **Not reachable from the CAPADEX chain** | A growth-plan exists in M5 but the Concern→…→Journey flow neither produces nor persists one; CAPADEX plan state = session snapshots / `localStorage` |
| Subscription | `subscription_packages` (CRUD) | **Partial** | Packages + modules exist, but **no outcome→subscription decision rule** binds them |

**System-wide Decision Reachability:** the *front half* of the chain
(Concern→Stage→Outcome→Journey, plus Action) is **reachable and real**; the *back half*
(unified Decision → Product activation → Growth Plan → Subscription) is **not closed**.

---

## A.2 Quantified reachability (assessed, grounded in the table above)

These are architectural reachability estimates (whether a code path *can* close each
link), **not** runtime telemetry. They are deliberately conservative.

| Metric | Estimate | Basis |
|--------|:---:|-------|
| **Decision Reachability %** (links 1–8 closable end-to-end for a typical concern) | **~55%** | 5 of 9 links real (Concern, Stage, Outcome, Journey, Action); Context dormant; Decision/Growth/Subscription open |
| **Product Reachability %** (concern → a *real* usable product) | **~30%** | Only LBI is a real product; ~1 of ~6 routes lands on a real surface |
| **Decision Ambiguity %** (links that can return tie/degraded/remap) | **~25%** | Context UNRESOLVED/GENERAL, journey remaps (family→mentoring), exam corpus_pending |
| **Decision Confidence** (where reachable) | **Moderate–High** | Stage/Outcome/Journey carry explicit confidence bands; Context confidence bounded by neutral mass |
| **Missing Decision Paths** | **4 structural** | Unified Decision, Product activation, Growth Plan, Commercial decision |

---

## A.3 Per-segment reachability

Segments are first-class personas (Track-C/D detail in `WC5_DECISION_MATRICES.md`);
reachability differences come from product/corpus maturity, not persona coverage.

| Segment | Concern→Outcome→Journey | Lands on a REAL product? | Action | Biggest reachability gap |
|---------|:---:|:---:|:---:|--------------------------|
| School Students | Reachable | Partial (LBI) | Reachable | No school-specific product depth; Growth Plan absent |
| College Students | Reachable | Partial (Career Builder PARTIAL) | Reachable | Career Builder not persisted; no plan |
| Job Seekers | Reachable | Partial (Employability Index = STUB) | Reachable | Employability product is a stub |
| Competitive-Exam Aspirants | **Partial** | **STUB** (Exam Portal hardcoded) | Reachable | `exam_readiness` gated + exam corpus_pending + portal stub (triple gap) |
| Parents | Reachable | STUB (Family Support→mentoring) | Reachable | No dedicated family product; remaps to mentoring |
| Teachers | Reachable | STUB (mentoring) | Reachable | No educator product surface |
| Counsellors | Reachable | STUB (mentoring) | Reachable | No counsellor console/decision view |
| Institutions | **Partial** (B2B2C entry only) | STUB | Partial | No institutional-admin persona, no cohort decision/reporting product |

---

## A.4 Missing Decision Matrix (Output #1, part 2)

Each row = a place the decision chain breaks, with the honest root cause.

| Broken link | Affected concerns/segments | Root cause (code reality) | Severity |
|-------------|----------------------------|---------------------------|:---:|
| Unified **Decision** envelope | All | No service fuses Stage+Context+Outcome+Journey+Action into one ranked, confidence-scored decision | **Critical** |
| **Context not wired** to runtime | All | L5B sidecar built offline, never read in the assessment/report loop | High |
| **Product activation** | All except LBI | Route resolves to a path, but Career Builder is PARTIAL and Exam/Mentoring/Employability/Family are STUBS | **Critical** |
| **Growth Plan** persistence (in the CAPADEX chain) | All | M5 has a growth-plan (`m5_career_growth_plans` + AI-coach) but it is decoupled; the CAPADEX chain neither produces nor persists one (snapshots/`localStorage`) | High |
| **Commercial decision** | All paid paths | No backend rule maps outcome/journey → subscription nudge or tier-gated module access | High |
| **Exam path** | Competitive-Exam Aspirants | `exam_readiness` gated + journey corpus_pending + portal stub | High |
| **Institutional path** | Institutions | No institutional-admin persona, no cohort-level decision/report product | Medium |
| **Chain dormant** | All | WC-3 layers default flag OFF; not consumed by live UX | Medium (config, not architecture) |
| **Stage taxonomy split** | All stage-keyed decisions | Backend 5-stage canon vs frontend 4-code `CAP_*` set | Medium |

**Reading:** the matrix concentrates on **four critical/high structural links**
(Decision, Product activation, Growth Plan, Commercial) plus the **dormant-chain** and
**taxonomy** hygiene items. None of these require re-deriving intelligence — they
require **composition, persistence, last-mile productization, and wiring**.
