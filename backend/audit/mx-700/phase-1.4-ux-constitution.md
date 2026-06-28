# CAPADEX 2.0 — Phase 1.4: UX Constitution (Experience Bible)

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent UX Constitution. **No UI changes, no frontend rebuild, no business-logic change.** This `.md` is the only artefact.
> **Honesty contract:** *measured* = MEASURED (Phase 0/0.1 frontend inventory); *judgement* = DERIVED. Dormant UX ≠ missing; a view with neither loading nor error state = defect; null≠0 in any progress display.
> **Basis:** Phase 1.2 Engineering Constitution + Phase 1.3 Product Constitution + frontend inventory (89 pages · 541 components · 60 ui primitives · `design-system/tokens.ts` 167 lines · Zustand + react-query) + memory (`introphase-progressive-form`, `capadex-report-tone-palette`, `mx301e-ui-certification-honesty`, `assessment-preview-personalization`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.4.

---

## PART 1 — Current UX Audit (as-built)

| Surface | As-built (MEASURED) | Verdict / Friction |
|---|---|---|
| Landing | `LandingPage.tsx`, marketing + CTA | Strong; value-prop could be sharper (Part 4) |
| Auth / Register / OTP | session + OTP + super-admin 2FA | Functional; multi-step |
| Navigation | `App.tsx` Screen-enum SPA router (1,050 lines) | Coherent but enum-coupled; deep-link gaps |
| Persona selection | IntroPhase progressive-reveal form | Good; CTA label is an ordered cascade (fragile) |
| Concern selection | concern picker | Often unstructured list (Part 6 gap) |
| Assessment flow | `FreeAssessmentModal.tsx` (4.1k): intro→analyze→clarify→preview→questions→result→register→OTP→report | Strong conversational spine |
| Question experience | adaptive picker, proxy-language stems | Strong; explanation surface thin |
| Report experience | `CapadexReportPhase`, Report Factory | Strong; mostly PDF-style (Part 10 gap) |
| Dashboards | SuperAdmin (230 panels), Mission Control, Platform Intelligence, career/employer | Rich; monolith pages |
| Career / Learning | CareerBuilderPage (8.7k), tabs | Strong career; learning thinner |
| Pragati | PragatiWorkspace 3-panel | Strong; memory/history surfacing partial |
| Enterprise | institutional/employer dashboards | Strong, role-scoped |
| Mobile | responsive (Radix/Tailwind) | Not first-class verified (Part 20 gap) |
| Accessibility | Radix baseline only | No formal WCAG (Part 19 gap) |
| Loading / Empty / Error | primitives exist (`empty.tsx`, boundaries) | inconsistent coverage (defect risk) |
| Animations / micro-interactions | ad-hoc | not standardized (Part 22 gap) |

**Strengths:** unified design tokens + 60 primitives; conversational assessment; honest report tone (hopeful/light). **Weaknesses:** monolith pages, enum routing, bundle size. **Friction:** unstructured concern list; score-terminal flows; thin explainability surfaces. **Duplicated experiences:** dead `frontend/server` UI + archived mirror. **Broken/dormant UX:** Decision/journey continuation not on default path (flag-ON, dormant). **Pain points:** "looks the same for every X" personalization gaps; deep-linking limits. **Opportunities:** living reports, universal progression header, Pragati-as-companion.

---

## PART 2 — UX Philosophy

CAPADEX UX must feel: **Intelligent · Personal · Professional · Conversational · Adaptive · Human · Simple · Premium · Continuous · Motivating · Calm · Trustworthy · Explainable.** Every screen reduces cognitive load; every interaction helps the user progress. CAPADEX is **one continuous Behaviour Intelligence experience**, not a collection of pages.

## PART 3 — Experience Principles

Every experience must satisfy: **Clarity · Speed · Consistency · Accessibility · Trust · Personalization · Context-Awareness · Behaviour-Awareness · Journey-Awareness · Progress-Awareness · AI-Explainability · Enterprise-Readiness.** Consistency always beats novelty; enhance before replacing; reuse existing components.

---

## PART 4 — First Impression Constitution

The first **60 seconds** decide retention. The first experience must immediately answer **Why CAPADEX? · Why now? · Why me?** and present: Landing · Welcome · Value proposition · Clear CTA · Persona selection · Concern selection · Assessment entry · Progress preview · Expected outcome · Trust indicators · Privacy · Estimated time · Completion benefits. Rule: one primary CTA per screen; no dead-ends; time-to-first-value minimized.

## PART 5 — Persona Selection Experience

Present personas **visually**, explain each, **recommend likely persona** (age/context-aware), support search, cover enterprise/academic/corporate/future personas. **Never overwhelm — one clear decision.** Binding: persona is SOFT in routing, age is HARD (adultness ≥24) — never mis-route adults to student banks; clear any name sentinel on persona reset.

## PART 6 — Concern Selection Experience

Concern selection becomes **guided** — never an unstructured list. Organize by Categories · Subcategories · Popular · Trending · Recommended · Recently-selected · AI-suggested · Enterprise-required, across all domains (Learning/Career/Leadership/Mental-Health/Relationships/Finance/Technology/Health/Life). Each concern shows: Description · Expected outcomes · Estimated time · Related journeys · Recommended subscription. Honesty: orphan/unmapped concerns hidden or flagged, never fabricated.

## PART 7 — Assessment Experience

Assessments feel like **conversations** (not forms/surveys/exams). Support: adaptive questioning · real-time progress · behaviour insights · contextual guidance · **pause & resume** · estimated completion · confidence indicators · question explanations · encouragement · dynamic transitions. Binding: **every assessment begins a journey, never ends at a score.**

## PART 8 — Question Experience

Every question provides: clear wording · purpose · context · examples when needed · progress indicator · optional clarification · accessibility · keyboard nav · voice compatibility · mobile-friendliness. Personalization must surface the specific entity and never be length-gated (truncate for display only).

## PART 9 — Journey Experience

Every completed assessment starts a journey. Journey dashboard displays: Current/Previous/Next stage · Progress · Achievements · Milestones · Recommendations · Learning · Career · Life · Behaviour · **Decision readiness**. (Reconciles to the Stage Constitution, Phase 1.3 Part 21; continuation path is currently dormant → activation is a separate phase.)

## PART 10 — Report Experience

Reports become **living experiences**, not static PDFs: interactive charts · behaviour trends · evidence · confidence · recommendations + **alternatives** · explainability · AI conversations · progress tracking · benchmark comparisons (k=30 suppression) · action plans. Keep report tone hopeful/light; header/CTA deep enough for white text (~4.5:1).

## PART 11 — Pragati Experience

Pragati = the user's **Behaviour Intelligence Companion**: natural conversation · memory · context/stage/behaviour awareness · career/learning coaching · decision support · explainability · conversation history · suggested follow-ups. One Pragati — enhance, never fork.

## PART 12 — Dashboard Experience

Every dashboard answers **Where am I? · What changed? · What should I do next? · What deserves attention?** via widgets · cards · timelines · insights · recommendations · goals · progress · notifications · achievements · subscriptions. Honesty: every count null≠0; status≠score; absent metric shows "not measured".

## PART 13 — Learning Experience

Personalized: learning path · courses · skills · competencies · behaviour improvements · achievements · certifications · recommendations · learning progress. Reuses learning-intelligence + competency genome; no parallel learning store.

## PART 14 — Career Experience

Presents: career readiness · role match · skill gaps · behaviour fit · market trends · career timeline · interview readiness · growth plan · salary insights · next steps. Reuses Career OS / CGI / role-DNA; provisional labelling when sampleSize<30.

## PART 15 — Enterprise Experience

Org dashboards · department insights · team analytics · behaviour trends · compliance · permissions · reports · actionable insights · bulk operations · governance. Binding: role-aware scope, k-anonymity (k_min=30), consent, tenant isolation on every detail read; scores masked below 30, roster always shown.

## PART 16 — SuperAdmin Experience

Mission Control · Platform Health · Feature Flags · Ontology · Questions · Concerns · Journeys · Subscriptions · AI · Analytics · Configuration · Audit Trails. **No duplicated administration** — one admin; new capability = flag-gated panel + conditional nav (hidden OFF).

---

## PART 17 — Design System Constitution

One design system. Standards for: Typography · Color · Spacing · Icons · Buttons · Inputs · Cards · Tables · Charts · Dialogs · Badges · Notifications · Empty/Loading/Error states · Animations · Responsive · Dark/Light mode · **Design Tokens**.
- **Single source:** `frontend/src/design-system/tokens.ts` (167 lines) + 60 `components/ui/*` primitives. Never hand-roll a primitive that exists; never inline hex/spacing — use tokens.
- Promote any deliberate secondary palette to a **named token** (don't leave magic values).

## PART 18 — Interaction Constitution

Interactions are Predictable · Smooth · Responsive · Accessible. Every action gives feedback across states: Hover · Focus · Pressed · Loading · Success · Failure · **Undo where appropriate**. No silent actions.

## PART 19 — Accessibility Constitution

**Target WCAG 2.2 AA.** Support keyboard · screen readers · high contrast · reduced motion · focus management · ARIA · responsive layouts · readable typography · accessible colours. **Honesty:** today only a Radix baseline exists with no formal audit — this is a GAP to close in a dedicated phase, not asserted compliant.

## PART 20 — Mobile Experience

Mobile is first-class: touch gestures · responsive layouts · offline resilience where applicable · optimized forms · fast loading · accessible navigation. Status: responsive baseline present, first-class mobile NOT verified (GAP).

## PART 21 — Personalization Constitution

Every user gets a personalized home · dashboard · assessments · recommendations · journeys · learning · subscriptions · AI. Binding: personalization keyed on real per-instance data (surface the specific entity), never a coarse bucket that makes everything "look the same".

## PART 22 — Micro-interactions

Standardize transitions · animations · success states · warnings · celebrations · progress · loading · empty states · feedback — all token-driven, all respecting reduced-motion.

## PART 23 — Error & Recovery Experience

Errors explain **what happened · why**, provide **recovery + retry**, never expose technical messages (no stack/DSN leak), and support graceful degradation. A view with **no loading AND no error path is a defect** (mechanically scannable).

## PART 24 — Trust Experience

Every recommendation displays: Evidence · Confidence · Source · Reasoning · Alternatives · Privacy statement · Data usage · Consent. (Realizes Explainability + Evidence/Confidence constitutions, Phase 1.3 Parts 23–24.) Confidence shown as an honest band with basis; provisional when sub-k.

---

## PART 25 — UX Success Metrics

Time-to-first-value · Assessment completion · Journey continuation · Recommendation usage · Pragati engagement · Subscription conversion · Dashboard engagement · User satisfaction · Accessibility · Task completion. Honesty: unmeasurable = null + note; activation never composited with structural.

## PART 26 — UX Governance

Every UX enhancement answers: What existing UX is improved? · What components are reused? · Does it reduce friction? · Improve accessibility? · Improve clarity? · Improve progression? · Align with Product Constitution? · Align with Engineering Constitution? A "no" on reuse/friction/alignment = reject.

## PART 27 — UX Review Board

Approval (APPROVE/REJECT) from: Founder · Product · UX · Behaviour Science · Engineering · AI · Accessibility · Enterprise · QA.
```
Founder[ ] Product[ ] UX[ ] BehaviourScience[ ] Engineering[ ] AI[ ] Accessibility[ ] Enterprise[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 28 — UX Definition of Done

- [ ] Existing UX reused · [ ] No duplicate workflows · [ ] No duplicate components · [ ] Navigation consistent · [ ] Accessibility verified · [ ] Responsive verified · [ ] Loading states · [ ] Error states · [ ] Empty states · [ ] Micro-interactions · [ ] Documentation updated · [ ] Analytics updated · [ ] Founder approval. (Stacks on Engineering DoD 1.2 P24 + Product DoD 1.3 P19.)

## PART 29 — World-Class UX Benchmark

Evaluate against Apple / Google / Microsoft — **not by visual imitation**, by measurable qualities: Simplicity · Discoverability · Consistency · Responsiveness · Accessibility · Performance · Trust · Personalization · Explainability · Continuous engagement. Document gaps + improvements **before** implementation.

---

## PART 30 — Deliverables Index

| # | Deliverable | Section | # | Deliverable | Section |
|---|---|---|---|---|---|
| 1 | UX Constitution | all | 13 | Enterprise Experience | P15 |
| 2 | Experience Principles | P3 | 14 | SuperAdmin Experience | P16 |
| 3 | First Experience | P4 | 15 | Design System | P17 |
| 4 | Persona Experience | P5 | 16 | Accessibility | P19 |
| 5 | Concern Experience | P6 | 17 | Mobile | P20 |
| 6 | Assessment Experience | P7 | 18 | Personalization | P21 |
| 7 | Journey Experience | P9 | 19 | Interaction | P18 |
| 8 | Report Experience | P10 | 20 | Trust Experience | P24 |
| 9 | Pragati Experience | P11 | 21 | UX Governance | P26 |
| 10 | Dashboard Experience | P12 | 22 | UX Success Metrics | P25 |
| 11 | Learning Experience | P13 | 23 | UX Definition of Done | P28 |
| 12 | Career Experience | P14 | 24 | UX Benchmark Framework | P29 |

---

**STOP — Phase 1.4 complete; UX Constitution ready to FREEZE on approval. No UX redesign implemented, no frontend rebuilt, no business logic changed.** All future frontend/design-system/dashboard/assessment/report/Pragati/journey/SuperAdmin phases must comply.
Honesty caveats: WCAG 2.2 AA and first-class mobile are TARGETS — current state is a Radix baseline with no formal audit (GAP, not compliance); journey-continuation UX is defined-but-DORMANT (flag-ON, no default-path data) — activating it is a separate Founder-approved phase; loading/empty/error coverage is inconsistent today and is enforced going forward via the DoD, not retroactively asserted.
