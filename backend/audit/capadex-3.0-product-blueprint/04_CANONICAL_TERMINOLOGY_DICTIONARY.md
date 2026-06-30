# 04 · Canonical Terminology Dictionary

ONE canonical term per concept. For each: the **canonical term**, its definition, the **variants/aliases**
found in the repo, and the disambiguation rule. This dictionary is the authority the Blueprint (12) references.
**This is a naming/definition reconciliation only — no code is renamed (that would be a future, separate
implementation phase).**

## A. Lifecycle vocabulary
| Canonical term | Definition | Variants found in repo | Rule |
|---|---|---|---|
| **Lifecycle** | The end-to-end progressive path a person travels | "journey" (overloaded), "stage flow" | "Lifecycle" = whole path; "journey" reserved for per-persona traversal (see G). |
| **Stage** | A named phase within the lifecycle | "phase" (also = build phase!), "level" | "Stage" = lifecycle phase ONLY; "phase" = engineering build phase. |
| **Curiosity (CAP_CUR)** | Early exploratory stage | — | canonical, code-backed. |
| **Insight (CAP_INS)** | Self-understanding / clarity stage | **"Clarity"** (heavy alias) | ⚠️ **CAP_INS is labeled both "Insight" and "Clarity."** Canonical label = **Insight**; "Clarity" = display alias of the SAME code. (see 05/10) |
| **Growth (CAP_GRW)** | Active development stage | "Development" (process sense) | "Growth" = the stage; "Development" = the activity within it. |
| **Mastery (CAP_MAS)** | Demonstrated-capability stage | — | canonical, code-backed. |
| **Awareness** | Pre-Curiosity narrative stage | (BE narrative only) | ⚠️ **No CAP_ code exists.** Conceptual only — do NOT claim a coded 5th stage. |

## B. Assessment-subject vocabulary (the most-confused cluster)
| Canonical term | Definition | Variants | Rule |
|---|---|---|---|
| **Concern** | A user-facing problem/worry the person reports | "issue", "worry" | Concern = USER-stated problem (diagnostic input). |
| **Signal** | A measured behavioral indicator derived from responses | "behavioural signal", "atomic signal" | Signal = MEASURED indicator; concern-diagnostic, NOT a strength source. |
| **Behaviour** | Observed pattern across signals | "behavioral pattern" | Behaviour = pattern over Signals. |
| **Competency** | A structured, frameworked skill/ability | "skill", "capability" (overloaded) | Competency = ontology-backed skill; "capability" reserved for PRODUCT capability. |
| **Construct** | A psychometric grouping of items | "factor", "dimension" | Construct = measurement grouping; internal to assessment. |
| **Capability** | A product feature/function | "feature", "capability" | Capability = PRODUCT function (see 09 traceability), NOT a competency. |

## C. Outcome vocabulary (the weakest-defined cluster)
| Canonical term | Definition | Variants | Rule |
|---|---|---|---|
| **Recommendation** | A suggested next action | "guidance", "next step" | Recommendation = suggested action (not yet acted on). |
| **Intervention** | A delivered support action | "nudge", "support action" | Intervention = DELIVERED action. |
| **Growth** | (see A) the stage | conflated with outcome | Growth = STAGE, never "the result." |
| **Development** | The process of improving | conflated with growth | Development = PROCESS. |
| **Outcome** | A **realized, measured** result (e.g. placed, promoted, improved score) | "result", "impact", "growth" | ⚠️ **Outcome = REALIZED + MEASURED only.** Not a recommendation, not a stage. Currently mostly null (see 11). |
| **KPI** | A bound success metric for a capability/outcome | "metric" (overloaded) | KPI = a metric *bound to a success target*. |

## D. Intelligence-layer vocabulary
| Canonical term | Definition | Variants | Rule |
|---|---|---|---|
| **Concern Intelligence** | Reasoning over Concerns | — | scoped to D2 concern layer. |
| **Signal Intelligence** | Reasoning over Signals | "behavioural intelligence" | Signal Intelligence = signal-layer; distinct from Behaviour. |
| **Behavioural Intelligence** | Reasoning over Behaviour patterns | conflated with Signal | Behaviour-pattern layer; ⚠️ boundary historically loose (see 10). |
| **Competency Intelligence** | Reasoning over Competency | — | D3 layer. |
| **Career Intelligence** | Reasoning over career fit/readiness | — | D4 layer. |

## E. Persona vs Role
| Canonical term | Definition | Rule |
|---|---|---|
| **Persona** | A market/user archetype (Student, Parent, …) | market axis (see 06). |
| **Role** | An authorization identity (super_admin, employer, …) | auth axis (distinct from persona). |
| **Mentor / Coach** | ⚠️ separate personas, **same code substrate** | treat as ONE substrate, two market labels (see 06/10). |

## F. Maturity vocabulary
| Canonical term | Definition |
|---|---|
| **Maturity ladder** | Concept → Operational → Guided → **Managed (ceiling)** → Intelligent → Enterprise → World-Class. |
| **Coverage ⟂ Confidence ⟂ Evidence** | three independent axes, NEVER blended into one score. |
| **null ≠ 0** | absent/unmeasured (null) is never reported as empty/zero (0). |

## G. Journey
| Canonical term | Definition | Rule |
|---|---|---|
| **Journey** | A specific persona's traversal of the Lifecycle | per-persona (see 08); NOT a synonym for Lifecycle (A). |

## Top reconciliations (the dictionary's whole point)
1. **CAP_INS = "Insight" canonical; "Clarity" is a display alias of the SAME stage** — not a separate stage.
2. **"Awareness" has no code** — conceptual 5th stage; the engine is 4-coded.
3. **Concern ≠ Signal ≠ Behaviour ≠ Competency ≠ Construct** — five distinct subjects, often blurred.
4. **Outcome = realized + measured only** — not Growth (stage), not Development (process), not Recommendation.
5. **Capability (product) ≠ Competency (skill)** — the word "capability" must mean product function.
6. **Mentor and Coach are one substrate, two labels.**
