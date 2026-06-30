# 13 · Assessment Architecture

The assessment products and how they fit together.

## Assessment products (repo-evidenced)
| Assessment | Engine surface | Type | Persona reach | Status |
|---|---|---|---|---|
| **CAPADEX behavioural** | `wc3/*`, `capadex_sessions`, signal→clarity→construct | behaviour/psychometric | students, freshers, professionals | **IMPLEMENTED** |
| **SDI** | `sdi.ts`, `sdi_*`, `sdi_items` | self-discovery | students/career | **IMPLEMENTED** |
| **LBI** | `lbi-intelligence.ts`, `lbi_*` | learning/behaviour index | students | **IMPLEMENTED** |
| **Competency** | `onto_*`, `competency-*`, runtime weights | competency/role | professionals/enterprise | **IMPLEMENTED** |
| **Adaptive difficulty** | `adaptiveDifficultyActivation`, question bank | adaptive | all | **PARTIAL** (served bank ~100% medium → difficulty ceiling) |
| **EI** | `employabilityEngine.ts`, 8-dim | emotional intelligence | all | **IMPLEMENTED** |
| **Competency Question Factory** | `question-factory.ts`, draft pipeline | item generation | admin | **DORMANT (flag-gated, AI-inert w/o key)** |
| **Voice / avatar screening** | employer screening, Whisper→LLM rubric | hiring assessment | employer | **IMPLEMENTED (AI degrades honestly)** |

## Architecture findings
- **One canonical competency substrate** (`onto_*`) feeds multiple persona lenses — "one assessment, many
  views" is real (memory: mx301d). This is a genuine architectural strength.
- **Psychometric grounding exists** (signal→clarity→construct→bridge-tag; IDF-weighted concern resolution;
  proxy-language reframing) — assessments are not naive quizzes.
- **Adaptive difficulty is structurally present but content-limited:** the served bank is ~100% medium, so
  *served* difficulty can't truly shift (honest ceiling per memory: adaptive-difficulty-activation).
- **Item generation (Question Factory) is dormant and AI-inert without `OPENAI_API_KEY`** — human approval is
  the only coverage-changing op; coverage is honestly separated into Draft/Approved/Assessment-Ready.

## Verdict
**Assessment architecture: IMPLEMENTED & psychometrically grounded.** Gaps are *depth* (adaptive content
breadth, item-bank difficulty distribution) and *exit/continuous* coverage (see 15), not missing assessment
types.
