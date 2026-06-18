# WC-5 Tracks E & F — Future Readiness & Commercial Conversion (Outputs #5 and #6)

---

## Track E — Future Readiness Decision Report (Output #5)

Evaluates CAPADEX's capability to support future-of-work themes, grounded in what the
code actually derives today.

| Future theme | Current capability (real) | Missing capability | Product readiness | Commercial readiness |
|--------------|---------------------------|--------------------|:---:|:---:|
| **AI Disruption** | L5B `AI_FUTURE_OF_WORK` context detectable; outcome `employability_readiness` | Not wired to runtime; no AI-exposure scoring per role | 🟡 (career/employability stub/partial) | ❌ |
| **Career Resilience** | Outcome `confidence_stability` + stage progression history | No resilience index or longitudinal resilience surface | 🟡 | ❌ |
| **Adaptability** | Stage ladder + behavioural constructs | No adaptability metric exposed as a decision | 🟡 | ❌ |
| **Future Employability** | Outcome `employability_readiness`; journey `employability_index` route | Employability Index is a STUB; no AI-future weighting | 🟡 | ❌ |
| **Lifelong Learning** | Outcome `learning_effectiveness`; LBI (real) | No learning-pathway product beyond LBI assessment | 🟡 (LBI real) | 🟡 (LBI monetizable) |
| **Upskilling** | Action layer (recommendation-builder Learning recs) | Recs don't deep-link to a learning product/plan | 🟡 | ❌ |
| **Reskilling** | Career-transition context + Career Builder | No reskilling pathway persistence | 🟡 | ❌ |
| **Human vs AI Skills** | — | No human-vs-AI skill taxonomy/scoring | ❌ | ❌ |
| **Emerging Careers** | Career Builder market-intelligence UI (FE-only) | No backed emerging-careers data/decision | 🟡 (FE only) | ❌ |
| **Entrepreneurship** | L5B `ENTREPRENEURSHIP` context detectable | No entrepreneurship product, plan, or route | ❌ | ❌ |

**Track E verdict:** CAPADEX has the **conceptual vocabulary** for future-readiness
(contexts + outcome models map cleanly onto these themes) but **almost no productized or
commercial** capability behind them. The two genuine strengths are **Lifelong Learning**
(LBI is real and monetizable) and the **employability/AI-disruption narrative** (context
+ outcome exist). The biggest whitespace gaps are **Human-vs-AI skills** and
**Entrepreneurship** (no backing at all). **Future-readiness is a strong marketing
story today but a weak decision/commercial product** — closing it requires wiring the
context axis + building 1–2 real future-readiness surfaces, not new core intelligence.

---

> **Growth Plan note (applies to Track E ❌ "Growth Plan" cells):** a growth-plan
> service exists in the M5 enterprise-workforce module (`m5_career_growth_plans` +
> AI-coach), but it is **decoupled from the CAPADEX/future-readiness chain**; ❌ here
> means "no future-readiness-driven growth plan", not "no growth-plan code anywhere".

## Track F — Commercial Conversion Matrix (Output #6)

Maps Concern → Stage → Context → Outcome → Journey → **Product** to conversion, and
audits monetization readiness against the **real** subscription system
(`subscription_packages`: tiers Basic/Family/Premium, `features` JSONB, `modules`,
`max_students`; CRUD live; linked to institutes/users) — but **no backend rule connects
intelligence to commerce.**

| Segment | Natural product | Conversion readiness | Upsell readiness | Subscription readiness | Revenue potential | Honest blocker |
|---------|-----------------|:---:|:---:|:---:|:---:|----------------|
| School Students | LBI + Family pkg | 🟡 | 🟡 | 🟡 (Family tier exists) | High (B2C+B2B2C) | No outcome→nudge; school product depth thin |
| College Students | Career Builder | 🟡 | 🟡 | 🟡 | High | Career Builder PARTIAL; no plan to upsell into |
| Job Seekers | Employability Index | ❌ | ❌ | 🟡 | High | Employability product is a STUB |
| Competitive-Exam Aspirants | Exam Portal | ❌ | ❌ | 🟡 | High (exam market) | Portal STUB + corpus_pending |
| Parents | Family pkg | 🟡 | 🟡 | ✅ (Family tier real) | High | No family product; nudge logic absent |
| Teachers | Institutional/modules | 🟡 | 🟡 | 🟡 | Medium | No educator product |
| Counsellors | Premium/modules | 🟡 | 🟡 | 🟡 | Medium | No counsellor console |
| Institutions | Institutional pkg + `max_students` | 🟡 | ✅ (`max_students`, modules) | ✅ | **Highest** (B2B) | No institutional-admin persona / cohort decision product |

**Conversion-matrix findings:**
- **The billing substrate is real** (tiers, modules, `max_students`, CRUD) — the
  **conversion *engine* is missing**: nothing maps a detected outcome/journey to a
  subscription nudge or enforces tier-gated module access from a decision.
- **Highest near-term revenue = Institutions** (B2B, `max_students` + modules already
  support seat-based pricing) — gated only by an institutional-admin surface and a
  cohort decision/report product, not by intelligence.
- **Strongest B2C conversion path = Parents/Family** (Family tier is real) — needs the
  outcome→family-nudge rule and a family product to convert into.
- **Job Seekers / Exam Aspirants have high intent but the weakest products** (both
  STUBS) — high revenue potential currently blocked by surface maturity.

**Commercial Conversion verdict:** monetization is **infrastructure-ready but
decision-blind.** The single highest-leverage commercial move is a **backend
commercial-decision rule** (outcome/journey → nudge + tier-gated access) layered on the
existing `subscription_packages` system.
