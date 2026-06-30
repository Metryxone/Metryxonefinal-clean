# 04 · Persona ↔ Assessment Mapping

For each persona: which assessment content/engine serves it. CAPADEX behavioural assessment keys on **L2
`PersonaKey`**; competency/EI/performance assessments key on **auth-role/product** context. Coverage = a bank/engine
exists; depth/specificity is called out honestly.

## A. Behavioural (CAPADEX) question banks — keyed on `PersonaKey`

Source: `frontend/src/lib/behavioural-insights.ts:246-319` (10 questions each) + `LOCKED_DOMAINS_BY_PERSONA:357-364`
(9 locked premium domains each) + DB `adaptive_question_bank.persona`.

| `PersonaKey` | Static bank (10 Qs) | Locked domains (9) | DB adaptive bank | Notes |
|---|---|---|---|---|
| `student` | ✅ | ✅ | ✅ (`persona='student'`) | also serves competitive/CUET/skill-dev (collapsed) |
| `teacher` | ✅ | ✅ | ❌ (not in `adaptive_question_bank`) | also serves counsellor/placement-cell (collapsed) |
| `campus` | ✅ | ✅ | ❌ | static-only |
| `jobseeker` | ✅ | ✅ | ❌ | also serves fresher/career-transition (collapsed) |
| `parent` | ✅ | ✅ | ✅ (`persona='parent'`) | proxy framing ("their/your child") |
| `professional` | ✅ | ✅ | ✅ (`persona='professional'`) | |

**Measured:** all 6 keys have a complete static bank + locked-domain set. **DB-adaptive** content exists for only
**3 of 6** (`student`/`parent`/`professional`); the other 3 fall back to static (honest, functional, not broken).

## B. Blueprint-declared assessment types per persona (`07_PERSONA_BLUEPRINT.md`)

| Persona | Declared assessments | Evidence |
|---|---|---|
| P1 School student | Entry, Diagnostic, Behaviour, LBI | `07:17` |
| P2 Competitive aspirant | Baseline, Diagnostic, Competency, Learning (curated MCQ) | `07:28` |
| P3 College student | Baseline, Diagnostic, Competency, Performance (partial) | `07:39` |
| P4 Fresher | Baseline, Competency, Performance (role-DNA/talent-match) | `07:51` |
| P5 Professional | Competency, EI, Performance, Future-Readiness | `07:63` |
| P6 Employee | Baseline, Competency, EI, Progress | `07:74` |
| P7 HR | Performance (role-DNA, talent-match, interview-intel) | `07:85` |
| P8 Employer | Performance (org talent-intelligence graph) | `07:96` |
| P9 Institute | aggregate over student assessments (k-anon) | `07:107` |

## C. Honest gaps (→ classified in `10`)

1. **Exam-specificity gap (HIGH):** P2's "Learning (curated MCQ)" is competency-exam content that exists in the
   competency/question-factory subsystem, but the **behavioural** `competitive_aspirant` path uses the **generic
   `student`** behavioural bank — there is no JEE/NEET/CUET-tailored *behavioural* bank. The spec lists these as
   distinct personas; today they are behaviourally identical.
2. **Counsellor assessment (MEDIUM):** `academic_counsellor`/`placement_career_cell` reuse the `teacher` bank; no
   counsellor-specific items.
3. **DB-adaptive coverage (MEDIUM):** `adaptive_question_bank.persona` ⊉ all 6 keys (missing campus/jobseeker/teacher).
4. **Enterprise behavioural (FUTURE):** Employee/Manager/L&D personas have competency/EI assessments (product
   layer) but no dedicated *behavioural* CAPADEX persona bank — blueprint-aligned (those are competency-led).

## Verdict
Every L2 persona has a **complete behavioural assessment**; blueprint personas each have a **declared assessment
type set**. The divergences are **content depth/specificity** (exam-tailoring, counsellor, DB-adaptive breadth),
not missing assessment capability. **No change required to satisfy structural acceptance; depth gaps queued for approval.**
