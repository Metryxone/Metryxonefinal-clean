# MetryxOne — Hidden Intelligence Inventory

**Date:** 30 May 2026
**Question:** What intelligence does MetryxOne already compute that the end-user never sees?
**Method:** Producer→store→surface trace across backend services, routes, tables, and the frontend, verified by grep + the two prior audits (`intelligence-waste-report.md`, `career-builder-dependency-map.md`).
**Constraint honoured:** Analysis only. No code modified.

### Surfacing legend
- 🔴 **Hidden** — computed + persisted, never reaches any user-facing surface.
- 🟠 **Admin-only** — visible in SuperAdmin/advanced screens, never to the end-user.
- 🟡 **Partial** — shown in the post-assessment CAPADEX report, but absent from Career Builder.
- 🔵 **Staged** — built and fetched, awaiting a render (intentional groundwork).
- ⚪ **Latent** — the *inputs* exist hidden, but no engine assembles the named capability yet.

> **The pattern:** the spine **Signals → Composites → Patterns → Interventions → Recommendations → Graph → Lineage** runs and persists on *every* session inside an advisory-locked transaction, then is **collapsed to 5 readiness scalars** or never read. The most valuable, most differentiating intelligence is the least visible.

---

## Ranked by business impact

| # | Hidden capability | Generated in | Stored in | Surfaced? | Why it's valuable to the user |
|---|---|---|---|---|---|
| 1 | **Best Next Action — Intervention Ranking (Top-5)** | `intervention-intelligence.ts` (re-ranks the library-backed engine) | `capadex_intervention_recommendations` | 🔴 Hidden (0%) | The single most actionable, monetisable output — "the 5 things to do next," ranked by impact×confidence, never generic. |
| 2 | **Insight-Explainer — "Why this result" lineage** | `capadex-insight-explainer.ts` + `capadex-explainability-engine.ts` → `GET /api/capadex/session/:id/explain` | read-only over the persisted spine | 🔴 Hidden (frontend never calls `/explain`,`/signals`,`/patterns`) | Trust & transparency: per-pattern lineage (Concern→Signals→Patterns→Interventions). Turns a score into an explanation. |
| 3 | **Pattern Detection (behavioural patterns)** | `pattern-engine.ts` | `capadex_session_patterns` | 🔴 Hidden (collapsed into scalars) | "We detected these behavioural patterns in how you responded" — headline differentiator vs generic quizzes. |
| 4 | **Unified Behavior Graph (full structure)** | `behavior-graph-service.ts` (`buildBehaviorGraph` per session; `buildBehaviorGraphForUser` per user) | `capadex_behavior_graph` | 🔵 Staged per-user (P2 endpoint exists, unrendered); 🟡 per-session only as 5 readiness scalars via the adapter | One coherent picture: strengths · risks · patterns · growth drivers/blockers · competency signals. Today flattened to 5 numbers. |
| 5 | **Session Interventions (library-backed, non-generic)** | `capadex-intervention-engine.ts` | `capadex_session_interventions` | 🔴 Hidden (only via `/explain`) | Concrete, construct-matched interventions (effort/duration/expected impact) — the "how to improve" the user never sees. |
| 6 | **Growth Drivers / Growth Blockers (longitudinal)** | OMEGA-X `longitudinal-memory.ts` (`buildMemory`) → `graph.growthIndicators` | OMEGA-X memory + behavior graph | 🟡 Partial (Behavioural Memory card in the report) · 🔴 absent from Career Builder | Motivation & direction: "what's accelerating you" vs "what's holding you back," over time. |
| 7 | **Behavioural Memory (improving / worsening trends)** | `behavioural-memory.ts` (latest-vs-previous snapshot diff) | `capadex_behavioural_memory` + `career_memory_snapshots` | 🔴 Hidden (deltas computed but not rendered; brain reads raw signals only) | "You're improving here, slipping there" — longitudinal progress the Career Memory tab is meant to show. |
| 8 | **Risk Flags (safety / low-score)** | `postCompletionHooks` (score-gated <40) | `capadex_risk_flags` | 🟠 Admin-only (CapadexInterventionsPanel) · feeds graph `risks` (unrendered) | Early-warning + safety-relevant nudges; currently only an admin sees them. |
| 9 | **CSI — Career Stage Index (+ positive factors)** | `csi.ts` (auto in `postCompletionHooks`) | `csi_profiles` / `csi_trajectory` / `csi_domain_weights` | 🟠 Admin-only (CSIPanel) · feeds graph `strengths` (unrendered) | "What career stage are you in" + your genuine strengths (CSI positive factors) — the only true strengths source. |
| 10 | **Composite Signals (higher-order constructs)** | `composite-signal-engine.ts` | `capadex_session_composites` | 🔴 Hidden | Aggregates raw signals into meaningful constructs — richer than single signals, never shown. |
| 11 | **Trajectory / Employability Forecasting** | `trajectory-engine.ts` (employability knowledge graph) | `trajectory_forecasts` | 🟠 Partial/Admin (AdaptiveCausalPage `expected_ei_lift`) · absent from Career Builder | "Where you'll be in 90 days" + expected EI lift — forward-looking projection the career user never sees. |
| 12 | **Career Constraints** | ⚪ no dedicated engine yet (P3) — inputs = graph `risks` + `growthBlockers` + IDP gaps | (derivable from existing tables) | ⚪ Latent | "What is structurally blocking your next move" — the constraint framing is absent though all inputs exist hidden. |
| 13 | **Contradiction / Response Intelligence** | `contradiction-engine.ts` | `contradiction_events` | 🟡 Partial (OMEGA-X Response Intelligence card) · absent from Career Builder | Response consistency / authenticity signal — "where your answers conflicted," a credibility cue. |
| 14 | **Linguistic Signals / Signal Profiles (BIOS)** | `signal-classifier.ts` / `signal-ingest.ts` | `capadex_linguistic_signals` / `capadex_signal_profiles` / `capadex_session_signals` | 🔴 Hidden (SignalIntelligencePanel is a stub) | Communication-style & linguistic insight derived from how the user writes — fully captured, never surfaced. |
| 15 | **Adaptive Causal / Neuro-Symbolic / Emergent (BIOS Frontier)** | BIOS frontier routes/services | BIOS frontier tables | 🟠 Admin-only (BIOSFrontierPanel, AdaptiveCausalPage) | Causal "what actually drives your improvement" — powerful but locked to advanced/admin screens. |
| 16 | **Success Signature** | `successSignatureEngine.ts` (frontend, orphan) | — (never computed at runtime) | 🔴 Hidden / dormant | Intended "your success pattern" archetype — engine exists but is wired to nothing. |

---

## Detail notes (verification caveats)
- **#1, #2, #3, #5, #10** — confirmed persisted every session via the advisory-locked completion transaction; the frontend report only fetches `/report/:id`, `/report/:id/omega`, `/session/:id/omega-x` — never `/explain`, `/signals`, `/patterns`, or recommendations. So these are *generated-and-stored, zero-surface*.
- **#4** — the per-session graph **is** consumed, but only by `career-behavior-adapter.ts`, which reduces the whole graph to 5 readiness scalars (`/api/career/behavior-profile`). The richer structure is discarded at the glass. The per-user graph endpoint (P2) is built + fetched into `brain.behaviorGraph` but has **0 tab consumers** (staged).
- **#6, #13** — surfaced in the *post-assessment CAPADEX report* (OMEGA-X cards) but **not** carried into Career Builder's Behavioural Growth / Career Memory tabs, where users actually live.
- **#8, #9, #15** — exist as admin/SuperAdmin panels; the end-user never sees them. CSI positive factors are the canonical source of "strengths," yet unrendered for the user.
- **#11** — `trajectory_forecasts` is written by `trajectory-engine.ts`; whether it's reliably triggered per user is uncertain (the `/predictions/compute` path had no obvious trigger). Surfaced only on the advanced AdaptiveCausalPage.
- **#12** — there is **no** "Constraint Engine" yet (roadmap P3). But its inputs (graph risks, growth blockers, IDP gaps) are already computed and hidden, so the capability is one orchestration layer away.
- **#16** — `successSignatureEngine` is an orphan: present in the engines barrel, never invoked. Listed for completeness; not a runtime asset.

---

## Top 5 to unlock first (impact ÷ effort)
1. **Top-5 Best Next Actions (#1)** — persisted, read via existing reader; surface in report + Next Best Actions tab.
2. **Behavior Graph render (#4)** — already fetched into `brain.behaviorGraph`; render in the existing Behavioural Growth tab.
3. **"Why this result" lineage (#2)** — `/explain` endpoint exists; add a report card.
4. **Patterns (#3)** — persisted; render in the report.
5. **Growth Drivers/Blockers + Memory trends (#6, #7)** — already computed; carry the OMEGA-X memory + improving/worsening deltas into Career Builder.

> Net: the highest-value behavioural intelligence in MetryxOne is **already computed and persisted** — it is a *surfacing* problem, not a *compute* problem.
