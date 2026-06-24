# Section 3 — Competency Framework Certification

**Verdict: PARTIAL (PASS structure + genome; FAIL question coverage).**

The competency framework is the platform's spine and is genuinely well-built: a 419-competency
canonical genome with 100% type classification, a real dual-ledger scoring runtime, and disciplined
namespacing. It is held back from full PASS by one decisive gap — **assessable question coverage**.

## 3.1 Genome & taxonomy — PASS
- `onto_competencies` = **419** canonical competencies.
- `onto_competency_type_map` = **419 (100%)** — every competency is typed across the 5 real
  competency TYPES (behavioral / cognitive / functional / technical / future_skills). There is no
  fabricated "Leadership" type; leadership is represented *through* the five via taxonomy notes.
- Namespace authority is clean: the framework IS `onto_*` genome + `competency_question_templates`
  (V1 bank) + competency-runtime scoring. Legacy `competency_*` tables are empty shells whose admin
  reads fall back to `onto_*` — this is documented, intentional de-duplication, not data loss.

## 3.2 Scoring runtime — PASS (dual ledger, correctly unioned)
- Two ledgers exist by design: `onto_competency_profiles` (38, runtime, append-one-row-per-run) and
  `onto_competency_score_runs` (23, normalized). A correct readiness count must UNION both — runtime-
  scored subjects would otherwise read as unscored. This is honored in the canonical spine read.
- Scoring is real: 38 profiles + 23 score-runs were produced (demo/seed subjects). Reverse-scoring
  polarity, domain-proxy crosswalk (7-code bank → 5 onto-domains), and `dom_strategic` marked
  UNMEASURABLE (never fabricated) are all in place.

## 3.3 Question coverage — **FAIL (systemic gap)**
- `onto_competency_question_map` maps questions to only **7 distinct competencies out of 419 = 1.7%**.
- `competency_question_templates` = 88, `assessment_template_questions` = 150 — real banks exist, but
  they are **not mapped through to the genome** at scale.
- **Consequence:** the framework can *describe* 419 competencies but can only *assess* a handful
  through the canonical map today. Scores beyond the mapped set rely on domain-proxy crosswalk, which
  is honestly labelled as proxy and auto-upgrades when the map is populated — but the map is empty.
- This is the single highest-leverage fix for the whole platform (it gates assessment, EI, readiness,
  career match, and employer match downstream).

## 3.4 Role-linked competency expectations — PARTIAL
- `onto_role_competency_profiles` = 14, `onto_role_weights` = 44 over `onto_roles` = 5. Curated role
  requirements exist but only for a **small curated role set**. The large requirement surface lives in
  the O*NET crosswalk (Section 5), which is a *separate* namespace (Estimated, not curated).

## 3.5 Confidence vs Coverage (kept separate)
- **Coverage** (genome breadth) = HIGH (419, fully typed).
- **Confidence** (assessable + scored with real evidence) = LOW (1.7% question coverage, 38 demo
  profiles, 0 real-user scoring). These axes diverge sharply and must not be composited.

## 3.6 Certification table
| Sub-area | Verdict | Evidence |
|---|---|---|
| Genome breadth & typing | PASS | 419 competencies, 419/419 typed |
| Scoring runtime & ledgers | PASS | 38 profiles + 23 score-runs, dual-ledger union honored |
| **Question coverage** | **FAIL** | **7/419 (1.7%) competencies have mapped questions** |
| Role-linked requirements | PARTIAL | 14 role-competency profiles, 5 curated roles |
| Real-user scoring (Usage) | FAIL | 0 real-user scoring runs (demo only) |

**Net: PARTIAL.** Structure and genome are enterprise-grade; the framework cannot be certified for
real assessment until question→competency mapping moves from 1.7% toward broad coverage.
