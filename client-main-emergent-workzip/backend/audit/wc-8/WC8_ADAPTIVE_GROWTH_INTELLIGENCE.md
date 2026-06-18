# WC-8 Track E — Adaptive Growth Intelligence Report

**Evaluates the chain:** Decision → Growth Plan → Mentor → **Future Skill Plan**.

## E.1 Chain status (measured against WC-7B bridges)
| Stage | Mechanism | Status |
|-------|-----------|--------|
| Decision | `decision-orchestrator.ts` `buildActivationEnvelope` (WC-7B) | **Live** — stage/outcome/journey composed per session |
| ↓ Growth Plan | `growth-plan-bridge.ts` → M5 AI coach (read-only, WC-7B) | **Live** — real roadmap from decision |
| ↓ Mentor | `mentor-bridge.ts` decision→mentor_type (WC-7B) | **Live** — decision-driven mentor types |
| ↓ **Future Skill Plan** | — | **MISSING** — no future-skill-specific planner |

## E.2 The five required measures
*(Numeric verdicts below are **directional estimates**, not measured counts; the row-level concern/question counts are measured.)*

| Measure | Verdict | Evidence |
|---------|---------|----------|
| 1. Growth-plan personalization | **Strong (~85, directional)** | Bridge maps real outcome scores → coach input; prefers real user scores |
| 2. Future-skill coverage | **Weak (~30, directional)** | Reskill/upskill 18 concerns / 217 Qs; lifelong-learning 28/79; no skill-forecast corpus |
| 3. Adaptive learning paths | **Moderate** | Growth plan adapts to current/target gap, but to generic outcomes, not skill-demand signals |
| 4. Reskilling support | **Weak** | No skill-obsolescence→replacement-skill mapping |
| 5. Upskilling support | **Weak** | Growth plan can suggest improvement, but not *which future skill* |

## E.3 Honest verdict
The **first three links of the chain are live and good** (Decision→Growth→Mentor is a genuine
WC-7B strength, ~85). The chain **terminates one link early**: there is no Future Skill Plan because
there is no future-skill taxonomy or demand signal to plan against. This is the same missing
reference data identified in Track B (AI skills) — they share one root cause.

## E.4 Recommendation
| Field | Value |
|-------|-------|
| Current State | Decision→Growth→Mentor live (~85); Future Skill Plan absent; reskill/upskill content thin |
| Target State | Add a Future Skills Planner that consumes the existing growth plan + an AI-resilient/future-skill taxonomy |
| Gap | One chain link + the shared skill-taxonomy reference data |
| User Impact | **High** — "what should I learn next" is the top unanswered question (Track B) |
| Business Impact | **High** — completes the activation chain end-to-end |
| Revenue Impact | **Medium-High** — Future Skills Planner as a recurring/premium surface |
| Technical Difficulty | **Medium** — bridge pattern proven (WC-7B); cost is the taxonomy |
| Priority | **P2** (depends on the Track B skill taxonomy) |

**Adaptive Growth coverage ≈ 70/100 (directional)** — strong head, missing tail.
