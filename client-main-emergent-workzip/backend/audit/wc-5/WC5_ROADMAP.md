# WC-5 — Top 25 Improvements & Decision Intelligence Roadmap (Outputs #9 and #10)

Per the spec, **every recommendation** carries: Current State · Target State · Gap ·
Business Impact · User Impact · Revenue Impact · Implementation Difficulty · Priority.
All are **proposals for a future approved build phase** — nothing here is implemented.

**Design discipline for any future build (carry WC-3 ethos):** additive · compose-only
(re-shape already-derived data, never re-derive) · flag-gated default OFF · byte-identical
when OFF · never fabricate (orphans/gaps are honest findings).

---

## Top 25 High-Impact Improvements (Output #9)

Priority key: **P0** critical/foundational · **P1** high · **P2** medium.
Difficulty: **S** small · **M** medium · **L** large.

| # | Recommendation | Current | Target | Gap | Business impact | User impact | Revenue impact | Diff | Priority |
|---|----------------|---------|--------|-----|-----------------|-------------|----------------|:---:|:---:|
| 1 | **Decision Composition layer** (fuse Stage+Context+Outcome+Journey+Action → one ranked decision + confidence/ambiguity) | Links queried independently | Single decision envelope per session | No composite exists | Defines CAPADEX as a decision platform | One clear "do this next" | Enables every downstream offer | L | **P0** |
| 2 | **Strengthen Mentoring** (real mentor data + matching) — it is the universal fallback | STUB | Real matched mentoring | Affects all fallback traffic | Raises floor system-wide | Better catch-all outcome | Unlocks coaching upsell | M | **P0** |
| 3 | **Wire M5 Growth Plan into the CAPADEX chain** (extend `m5_career_growth_plans` + AI-coach; don't rebuild) | M5 plan exists but decoupled; CAPADEX uses snapshots/`localStorage` | Durable, trackable, chain-driven plan | Not connected to Concern→…→Journey | Core retention asset | Progress that survives sessions | Subscription anchor | M | **P0** |
| 4 | **Wire context (L5B) into runtime** | Offline sidecar | Context conditions routing/reports | Dormant | Sharpens every cell in Track D | More relevant everything | Higher conversion | M | **P0** |
| 5 | **Commercial-decision rules** (outcome/journey → nudge + tier-gated modules) | UI stubs only | Backend conversion engine | No rule binds intelligence↔billing | Turns insight into revenue | Right offer at right moment | Direct conversion lift | M | **P0** |
| 6 | **Action→Product deep-link** | Actions are text | Action opens the product pathway | Not connected | Closes the activation loop | One-click to act | Drives product usage→upsell | M | **P1** |
| 7 | **Reconcile stage taxonomy** (BE 5-stage vs FE `CAP_*`) | Two taxonomies | One canonical stage model | Split | Prevents wrong stage decisions | Consistent journey | Protects all stage offers | S | **P0** |
| 8 | **Real Employability Index product** (distinct from LBI or formally merged) | STUB | Real index surface | No standalone product | Key job-seeker hook | Clear employability score | High (job-seeker market) | L | **P1** |
| 9 | **Competitive-Exam: build `EXAM_*` corpus + portal APIs** | STUB + corpus_pending | Real exam product | Triple gap | Large exam market | Real exam pathway | High | L | **P1** |
| 10 | **Stage-templated reports** (Snapshot/Curiosity/Deep-Insight/Action-Plan/Coaching) | Report engine not stage-keyed | Stage-keyed report set | Not templated | Productizes each stage | Right report per stage | Tiered report monetization | M | **P1** |
| 11 | **Institutional-admin persona + cohort decision/report product** | B2B2C entry only | Full institutional surface | No admin persona | Highest B2B revenue | Cohort-level decisions | Highest (seat-based) | L | **P1** |
| 12 | **Persist Career Builder server-side + bind to outcomes/journey** | FE/`localStorage` | Server-backed, intelligence-fed | Not persisted | Flagship product credibility | Plan continuity | College-segment conversion | M | **P1** |
| 13 | **Family Support product** (or honest "via mentoring" framing) | STUB remap | Dedicated family path | No family product | Parents segment + Family tier | Family-specific guidance | Family-tier conversion | M | **P1** |
| 14 | **Decision confidence + ambiguity surfacing** | Per-link confidence only | Composite confidence band | No arbitration | Trust & honesty | Knows when to trust | Reduces bad-offer churn | M | **P1** |
| 15 | **Subscription recommendation engine** (segment+outcome → best package) | Manual packages | Recommended package per user | No recommender | Conversion uplift | No tier confusion | Direct ARPU lift | M | **P1** |
| 16 | **Entrepreneurship pathway** (context→product/plan) | Context only | Real entrepreneurship surface | No product | New segment whitespace | Founder-readiness path | New revenue line | L | **P2** |
| 17 | **Human-vs-AI skills taxonomy + scoring** | Absent | Future-readiness score | No taxonomy | Differentiator vs competitors | "Am I AI-proof?" | Premium future-readiness tier | L | **P2** |
| 18 | **AI-exposure scoring per role/path** | Context detectable | Quantified AI-disruption signal | No scoring | Future-of-work narrative→product | Concrete risk insight | Premium reports | M | **P2** |
| 19 | **Counsellor console** (multi-student decision view) | mentoring stub | Counsellor product | No console | Counsellor segment | Caseload decisions | Professional tier | M | **P2** |
| 20 | **Educator/Teacher product surface** | mentoring stub | Teacher decision view | No surface | Teacher segment | Classroom-level insight | Institutional bundle | M | **P2** |
| 21 | **Tier-2 context routing** (6 sub-contexts → dedicated paths) | Fold into Tier-1 | Explicit sub-context routing | Coarse | Finer personalization | More precise paths | Marginal conversion | M | **P2** |
| 22 | **Longitudinal Growth-Plan adaptation** (replan on re-assessment) | none | Plan adapts over time | No loop | Retention/engagement | Living plan | Renewal driver | L | **P2** |
| 23 | **Emerging-careers data backing** (replace FE-only market UI) | FE-only | Backed careers data | No backend | Career-builder credibility | Trustworthy market view | Career-tier value | M | **P2** |
| 24 | **Decision telemetry** (measure real reachability/precision/conversion) | None | Live DIS metrics | Estimates only | Turns this audit's estimates into measured KPIs | — | Optimizes spend | M | **P2** |
| 25 | **Phased flag rollout of the live chain** | Default OFF, dormant | Staged ON with guardrails | Not surfaced | Realizes built intelligence | Users see the intelligence | Activates everything above | S | **P1** |

---

## CAPADEX Decision Intelligence Roadmap (Output #10)

Sequenced by dependency (each phase composes the prior; all additive, flag-gated).

### Phase D1 — Foundation & Hygiene (unlock what already exists) — *P0*
- #7 Reconcile stage taxonomy · #4 Wire L5B context into runtime · #25 Phased flag rollout.
- **Why first:** cheapest, highest effort-to-impact; turns dormant real intelligence
  live and removes the taxonomy hazard before anything is keyed to stage.

### Phase D2 — The Decision Layer (the missing core) — *P0*
- #1 Decision Composition layer · #14 Confidence/ambiguity surfacing · #3 Wire M5
  Growth Plan into the chain · #5 Commercial-decision rules.
- **Why:** this is the literal "Decision Intelligence" the phase is named for; it
  composes existing outputs and binds them to billing and a durable plan.

### Phase D3 — Raise the Product Floor — *P0/P1*
- #2 Strengthen Mentoring (P0 — it's the fallback) · #6 Action→Product deep-link ·
  #12 Persist Career Builder · #10 Stage-templated reports.
- **Why:** makes the destinations the router already chooses actually valuable.

### Phase D4 — Segment & Commercial Expansion — *P1*
- #8 Employability Index · #9 Competitive-Exam corpus+portal · #11 Institutional
  surface · #13 Family Support · #15 Subscription recommender.
- **Why:** highest revenue segments (Institutions B2B, Job Seekers, Exam, Family) once
  the decision/commercial spine (D2) exists.

### Phase D5 — Future-Readiness & Differentiation — *P2*
- #16 Entrepreneurship · #17 Human-vs-AI skills · #18 AI-exposure scoring ·
  #19 Counsellor console · #20 Teacher surface · #21 Tier-2 routing · #22 Longitudinal
  adaptation · #23 Emerging-careers data · #24 Decision telemetry.
- **Why:** differentiation and measurement after the core platform converts.

**Roadmap one-liner:** **D1 unlocks → D2 decides → D3 delivers → D4 monetizes →
D5 differentiates.** The intelligence is largely built; the roadmap is about
**composing, persisting, productizing, commercializing, and measuring** it — honestly.

---

## Closing note

This completes the 11 WC-5 outputs. The audit is deliberately conservative: every gap is
a **real, code-grounded finding**, and every strength is **verified in the
implementation**, not assumed. **No code, schema, migrations, or questions were changed.
Stopping here for approval** before any build phase begins.
