# WC-5 Track G + Benchmark — Scorecard & World-Class Gap (Outputs #7 and #8)

---

## Track G — Decision Intelligence Scorecard (Output #7)

A **Decision Intelligence Score (DIS)** over six components. Scores are an **architect's
assessment grounded in the audited code reality** (Tracks A–F), on a 0–10 scale — **not**
runtime telemetry. *Effort* and *Impact* are relative (Low/Med/High).

| Component | What it measures | Current | Target | Gap | Effort | Impact | Basis (real state) |
|-----------|------------------|:---:|:---:|:---:|:---:|:---:|--------------------|
| **Stage Intelligence** | Derive & track user stage | **7** | 9 | 2 | Low | Med | L1 real (5-stage ladder + history); blocker = FE/BE taxonomy split + not surfaced |
| **Context Intelligence** | Derive life-context | **4** | 9 | 5 | Med | High | L5B real (16 contexts) but **dormant offline sidecar** |
| **Outcome Intelligence** | Derive outcome models | **7** | 9 | 2 | Low | Med | L2 real (6 models + honest gating); blocker = exam corpus, runtime wiring |
| **Journey Intelligence** | Route to a product | **6** | 9 | 3 | Med | High | L3 router real & deterministic; destinations mostly STUB |
| **Product Intelligence** | Land on a real, usable product | **3** | 9 | 6 | High | High | Only LBI real; others PARTIAL/STUB; no Growth Plan |
| **Action Intelligence** | Recommend next best action | **7** | 9 | 2 | Low | Med | Action layer real & library-backed; blocker = no product deep-link/persistence |
| **Decision (composite)** | Fuse all into one ranked decision + commerce | **2** | 9 | 7 | High | High | **No composition/commercial-decision layer exists** |

**Overall DIS ≈ 5.1 / 10 (weighted toward the missing composite).**

**Scorecard reading:**
- **Strengths:** Stage, Outcome, Action (all ~7) — the *derivation and recommendation*
  engines are genuinely strong.
- **Biggest gaps (highest impact × largest gap):** **Decision composite (gap 7)**,
  **Product (gap 6)**, **Context (gap 5)**. These three define the roadmap.
- **Cheapest high-impact win:** **Context** (gap 5, effort Med) — the intelligence
  already exists; it just needs wiring. Best effort-to-impact ratio in the system.

---

## World-Class Benchmark — Decision Gap Report (Output #8)

CAPADEX compared against the categories it competes with. Ratings reflect **audited
reality**, not roadmap intent.

| Capability dimension | World-class bar | CAPADEX today | Gap |
|----------------------|-----------------|---------------|:---:|
| **Assessment depth** | Strong psychometric/behavioural base | **Meets/exceeds** — ontology (2,490 concerns), LBI, signals, PIL | **None** |
| **Insight & explainability** | Clear "what + why" with lineage | **Meets** — PIL explainability, report engine, lineage | Small |
| **Decision composition** | One ranked "next best decision" with confidence | **Missing** — links exist but never fused | **Large** |
| **Product routing/activation** | Deep-link user into the right product/pathway | **Partial** — router real, destinations stub | **Large** |
| **Growth-plan layer** | Persistent, trackable plan that adapts | **Missing** — no persistence | **Large** |
| **Recommendation breadth** | Action/learning/career/coaching recs | **Meets** — library-backed multi-type recs | Small |
| **Commercial/conversion** | Outcome → tiered offer/upsell/seat pricing | **Partial** — billing real, decision logic absent | **Large** |
| **Future-readiness** | AI-exposure, human-vs-AI, reskilling pathways | **Weak** — vocabulary only, little product | **Large** |
| **Personalization at scale** | Context-conditioned everywhere | **Partial** — context derived but dormant | Medium |
| **Segment coverage** | Multi-stakeholder personas | **Meets** — 7/8 first-class; Institutions partial | Small |

### Missing layers (the four "world-class" gaps the spec asks for)
- **Missing Decision Layers:** a unified decision-composition service; confidence +
  ambiguity arbitration across Stage/Context/Outcome/Journey; runtime consumption of the
  (currently dormant) chain.
- **Missing Product Layers:** real Employability Index, Competitive-Exam, Mentoring,
  Family surfaces (today PARTIAL/STUB); an Entrepreneurship surface (absent); a
  Human-vs-AI / future-readiness surface (absent).
- **Missing Recommendation Layers:** action→product deep-linking; stage-templated
  reports (Snapshot/Curiosity/Deep-Insight/Action-Plan/Coaching); context-conditioned
  recommendations.
- **Missing Growth Layers (in the CAPADEX chain):** a growth-plan service *does* exist
  in M5 (`m5_career_growth_plans` + AI-coach) but is **decoupled** from the
  Concern→…→Journey flow; what's missing is chain-driven plan persistence, longitudinal
  plan adaptation, and plan→subscription conversion (wire M5 in rather than rebuild).

**Benchmark verdict:** CAPADEX is **world-class on the inputs (assessment, insight,
recommendation breadth, segment coverage)** and **below-bar on the decision/activation/
commercial outputs.** It is an **excellent Assessment & Insight platform that is roughly
half-built as a Decision Intelligence platform** — and crucially, the remaining half is
**composition, productization, persistence, and commerce wiring**, all of which sit on
top of intelligence that already exists and is honest.
