# 06 · Canonical Lifecycle

ONE canonical lifecycle, **4 coded stages**, each defined in full (Purpose · Description · Entry · Exit ·
Success · AI Responsibilities · Assessments · Reports · Outcomes · KPIs · Progression Rules · Dependencies).
Code-backed (`backend/routes/capadex.ts`, `backend/data/capadex-concern-banks.ts`). Promotes the Phase 0.1
consolidation (05) to full blueprint depth.

> **Coded lifecycle = Curiosity (CAP_CUR) → Insight (CAP_INS) → Growth (CAP_GRW) → Mastery (CAP_MAS).**
> "Clarity" = display alias of Insight (CAP_INS), not a 5th stage. "Awareness" = pre-Curiosity narrative
> concept, **uncoded** — documented as conceptual, never claimed as an active coded stage.

---

## Stage 1 — Curiosity (CAP_CUR)
- **Purpose:** first-touch exploration; surface the person's concerns and context.
- **Description:** entry stage where a person engages CAPADEX, declares concerns, and is placed.
- **Entry criteria:** registration / persona capture / free-assessment start.
- **Exit criteria:** sufficient concern + entry-assessment data to diagnose.
- **Success criteria:** a populated concern profile with enough coverage to route to Insight.
- **AI responsibilities:** observation (signal extraction), persona/context inference; **no verdicts.**
- **Assessments:** Entry (persona capture, free-assessment modal), initial Behaviour signals.
- **Reports:** entry snapshot.
- **Outcomes (target):** *engagement / activation* (realized-capture = forward work, 13).
- **KPIs (target):** entry-completion rate (operational; outcome KPI deferred, 14).
- **Progression rules:** advance to Insight when diagnostic coverage threshold met.
- **Dependencies:** D1 Identity, D2 Assessment Core; signal ontology seeded.

## Stage 2 — Insight (CAP_INS) *(display alias: "Clarity")*
- **Purpose:** honest diagnosis — what's going on and why.
- **Description:** the deepest, most mature surface (concern banks, signal analysis, clarity mapping).
- **Entry criteria:** Curiosity exit met (diagnostic data present).
- **Exit criteria:** a confident diagnosis (Coverage ⟂ Confidence reported separately) + recommendations ready.
- **Success criteria:** diagnosis with explicit Coverage and Confidence; concerns mapped to constructs.
- **AI responsibilities:** diagnosis (`why_inferred`), explainability, confidence (capped 0.95), provenance.
- **Assessments:** Diagnostic (concern banks, clarity mapping), Behaviour, Baseline, Competency.
- **Reports:** diagnostic report-pack (with k-anon where aggregated).
- **Outcomes (target):** *self-understanding / readiness uplift* (realized-measure = forward work).
- **KPIs (target):** diagnosis confidence distribution; coverage rate.
- **Progression rules:** advance to Growth when recommendations are accepted/initiated.
- **Dependencies:** D2, D3, D6 (AI), D8 (reports).
- **⚠️ Canonical cleanup:** label = **Insight**; "Clarity" is user-facing copy of the SAME code — never a 5th
  stage (resolves conflict C1 / GAP-T1).

## Stage 3 — Growth (CAP_GRW)
- **Purpose:** active development against the diagnosis.
- **Description:** interventions + growth plan (M5) move the person forward.
- **Entry criteria:** recommendation accepted / development plan started.
- **Exit criteria:** **evidence-gated** demonstration of improvement (target) — *today derived/monetization-
  gated, not criteria-gated* (GAP-P2, forward work).
- **Success criteria:** measured progress vs baseline (re-measure) — *Progress not yet systematically
  re-administered* (GAP-P1, forward work).
- **AI responsibilities:** recommendation, coaching (PARTIAL), personalization (applied modifiers), override.
- **Assessments:** Competency, Learning, Performance, Progress (re-measure) — Progress partial.
- **Reports:** growth/progress report-pack, roadmap.
- **Outcomes (target):** *skill gain, role readiness improvement* (realized-measure = forward work).
- **KPIs (target):** progress-delta rate; intervention uptake.
- **Progression rules (FROZEN target):** Growth→Mastery must be **evidence-gated** (criteria), separate from the
  monetization gate.
- **Dependencies:** D7 (recommendation/intervention), D3/D4, D5 progression engine.

## Stage 4 — Mastery (CAP_MAS)
- **Purpose:** demonstrated capability; the proof endpoint.
- **Description:** defined lifecycle endpoint where mastery is evidenced and outcomes realized.
- **Entry criteria:** Growth exit (evidence of improvement).
- **Exit criteria:** demonstrated-mastery evidence — *not yet evidence-gated* (GAP-P2, forward work).
- **Success criteria:** a **realized, measured outcome** (placed / promoted / improved) — *not yet captured*
  (GAP-O1, forward work; the keystone gap).
- **AI responsibilities:** explainability + evidence/provenance of mastery; **no autonomous certification.**
- **Assessments:** Performance, Exit (**MISSING** — forward work A4), Continuous (**MISSING** — forward work).
- **Reports:** mastery / passport / outcome report-pack.
- **Outcomes (target):** the **realized outcome** (D13) — the close-the-loop tail (forward work).
- **KPIs (target):** placement/hire/promotion/growth rate — outcome KPIs (deferred until realized, 14).
- **Progression rules:** terminal; feeds the re-measure → outcome → KPI loop (D13).
- **Dependencies:** D8 (reports), D13 (outcome capture — not yet realized), Exit/Continuous assessments.

---

## (Pre-stage) Awareness — conceptual, UNCODED
A pre-Curiosity marketing/narrative concept. **No `CAP_AWA` code exists.** Documented as conceptual only; the
engine is **4-coded**. Do not claim a coded 5th stage (resolves conflict C2 / GAP-T2).

## Stage-quality summary (honest)
| Stage | Strength | Gap (forward work) |
|---|---|---|
| Curiosity | rich concern banks, strong entry | entry criteria implicit |
| Insight | deepest/most mature; clarity mapping | label ambiguity (resolved: "Insight") |
| Growth | interventions + M5 growth plan exist | progression derived + monetization-gated, not criteria-gated (P2) |
| Mastery | defined endpoint | not evidence-gated (P2); realized outcome not captured (O1); Exit/Continuous absent (A4) |

## Verdict
**ONE canonical 4-stage lifecycle, fully defined per stage, code-backed. FROZEN.** Back-half maturity
(evidence-gated progression, systematic Progress, Exit/Continuous, realized Outcome) is the forward work for
Programs 1–6 — the close-the-loop spine.
