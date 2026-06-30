# 08 · Assessment Blueprint

ONE assessment framework. Defines every assessment type, maps each to **lifecycle stages × personas**, and
flags depth gaps. Promotes Phase 0.1 (07) + Operating-Model (`13–15`) to blueprint depth.

## Canonical assessment-type taxonomy (FROZEN)
| Type | Definition | Repo evidence | Status |
|---|---|---|---|
| **Entry** | First-touch placement | CAPADEX intro/persona capture, free-assessment modal | IMPLEMENTED |
| **Baseline** | Initial level snapshot | first competency/EI run, `scoring_runs` | IMPLEMENTED |
| **Diagnostic** | Concern/behavior diagnosis | concern banks, signal analysis, clarity mapping | IMPLEMENTED (deepest surface) |
| **Behaviour** | Behavioral signal patterns | signal ontology (4-tier), behaviour namespace | IMPLEMENTED |
| **Competency** | Frameworked skill assessment | `onto_*`/`competency_*`, adaptive question bank | IMPLEMENTED |
| **Learning** | Knowledge/learning checks | curated coding MCQ, learning paths | PARTIAL (uneven across stages) |
| **Performance** | Applied/role performance | role-DNA, talent match, interview intel | PARTIAL overall (STRONG employer, thin learner) |
| **Progress** | Re-measure vs baseline | `scoring_runs` deltas exist; not systematically re-administered | PARTIAL → MISSING (systematic) |
| **Exit** | Stage/lifecycle exit gate | — | **MISSING** (forward work, GAP-A4) |
| **Continuous** | Ongoing re-assessment | — | **MISSING** (forward work) |

## Assessment × lifecycle-stage map
| Type | Curiosity | Insight | Growth | Mastery |
|---|---|---|---|---|
| Entry | ● | | | |
| Baseline | ◐ | ● | | |
| Diagnostic | ◐ | ● | | |
| Behaviour | ◐ | ● | | |
| Competency | | ● | ● | ◐ |
| Learning | | ◐ | ● | |
| Performance | | ◐ | ● | ● (employer) |
| Progress | | | ◐ | ◐ |
| Exit | | | ○ | ○ |
| Continuous | | ○ | ○ | ○ |

● implemented · ◐ partial · ○ target/forward-work

## Assessment × persona map
| Type | Students (P1–P3) | Fresher/Prof (P4–P5) | Employee (P6) | HR/Employer (P7–P8) | Institute (P9) |
|---|---|---|---|---|---|
| Entry | ● | ● | ● | n/a | aggregate |
| Baseline | ● | ● | ● | n/a | aggregate |
| Diagnostic | ● | ● | ◐ | n/a | aggregate |
| Behaviour | ● | ◐ | ◐ | n/a | aggregate |
| Competency | ● | ● | ● | candidate-side | aggregate |
| Learning | ◐ | ◐ | ◐ | n/a | ◐ |
| Performance | ◐ | ● | ● | ● | aggregate |
| Progress | ◐ | ◐ | ◐ | ◐ | ◐ |
| Exit | ○ | ○ | ○ | ○ | ○ |
| Continuous | ○ | ○ | ○ | ○ | ○ |

## Overlaps / duplicates (resolved)
- **Concern-diagnostic vs Behaviour-signal** overlap in input but are distinct subjects (04 dictionary) — keep
  separate; document the boundary, do not merge.
- **LBI (`lbi_*`) ⟂ Competency (`onto_*`)** are two products by design — NOT a duplicate to consolidate.
- **Adaptive question bank** served set is ~100% medium difficulty → effective difficulty ceiling (depth gap,
  not a duplicate).

## Canonical decision (FROZEN)
> Keep the strong core (Entry, Baseline, Diagnostic, Behaviour, Competency, + employer Performance). Treat
> **Progress** as PARTIAL (data exists, not systematically re-run). Treat **Exit + Continuous** as the priority
> MISSING types to instrument — by **re-administering existing assessments** at exit/interval, NOT building
> net-new assessment engines. This is the assessment expression of close-the-loop.

## Verdict
**ONE assessment framework; front-half mature and non-duplicative. FROZEN.** Back-half (systematic Progress,
Exit, Continuous) is the depth gap — forward work for Programs 1–6. LBI ⟂ Competency preserved.
