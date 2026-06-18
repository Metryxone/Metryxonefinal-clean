# Competency Assessment — Dependency Analysis

**Audit:** MX-COMPETENCY-WORLDCLASS-LAUNCH-CERTIFICATION-100X · 18 Jun 2026
**Question:** How much do Career Builder, Employability Index, Career Passport, Future Readiness, Employer Portal, and the Recommendation Engine depend on competency quality — and what breaks if competency is weak?

**Headline:** Competency Assessment is the **keystone intelligence layer**. Most downstream value is a *function* of competency quality and activation. Today, because competency is **cold-start activated**, the dependents are correspondingly **degraded — not broken, but thin.**

---

## 1. Dependency Map (data flow)

```
Assessment responses (58 live sessions)
   │
   ├─► CAPADEX reports / signals ──► behavioural constructs
   │
   ▼
Competency scores  ──► p4_competency_history (390 rows)
   │
   ├─► Employability Index (mei-v2: resolveProfile → computeMEIScore)      [mei_scores=0 LIVE → DARK]
   ├─► Career Builder (cg_user_role_readiness, recs)                        [recs=8 LIVE → THIN]
   ├─► Career Passport (cp_* competency snapshots)                          [SPARSE]
   ├─► Future Readiness (frp_* assessment inputs)                           [STUB/SECONDARY]
   ├─► Employer Portal / TIG (employer_candidates.assessment_score)         [GATED — no hiring verdict]
   └─► Recommendation Engine (MEI / PIL-7 / career-graph)                   [near-zero population]
```

---

## 2. Per-Dependent Assessment

### Phase 15 — Career Builder
- **Consumes:** `cg_user_role_readiness`, `mei_scores`, competency → role-DNA gaps.
- **If competency is weak:** recommendations become generic, role-fit and skill-gap outputs lose precision, roadmaps lose grounding.
- **Today:** **materially dependent**; thin competency activation → Career Builder is **Beta**, not Launch.
- **Coupling strength:** **High.**

### Phase 16 — Employability Index
- **Consumes:** competency assessments + CAPADEX report scores are the **primary inputs** to the 6–8 dimension MEI engine.
- **If competency is weak:** the composite score and band ("High Potential" vs "Developing") are directly degraded or impossible.
- **Today:** `mei_scores=0` live → **EI is not activated**. EI **cannot survive without competency** — it *is* a competency-derived score.
- **Coupling strength:** **Critical (existential).**

### Phase 17 — Employer Portal
- **Consumes:** `ei_score`/`assessment_score` on `employer_candidates`; TIG success-probability blends these with skill match.
- **If competency is weak:** talent-intelligence outputs lose signal; matching confidence drops.
- **Guardrail (correct):** hiring/promotion verdicts **disallowed** for AI in production — so employer trust rests on *structured insight*, which still needs competency activation + (eventually) validity.
- **Coupling strength:** **High (for value), but quarantined from decisions.**

### Career Passport
- **Consumes:** competency snapshots into `cp_*` sections.
- **Today:** sparse; passport renders but with thin competency content.
- **Coupling strength:** **Medium.**

### Future Readiness Platform
- **Consumes:** competency/assessment as a secondary input to FRI signals.
- **Today:** stub/secondary; not a hard dependency yet.
- **Coupling strength:** **Low–Medium.**

### Recommendation Engine
- **Consumes:** active constructs + competency gaps to generate dev/learning/cert/career recs.
- **If competency is weak:** recs lose personalisation/explainability grounding.
- **Today:** engines strong, population near-zero (`mei_user_recommendations=0`, recs=8).
- **Coupling strength:** **High.**

---

## 3. "What breaks if competency quality is weak?"

| Dependent | Degradation mode | Severity |
|---|---|---|
| Employability Index | No score / meaningless band | **Existential** |
| Career Builder | Generic recs, ungrounded roadmaps | High |
| Recommendation Engine | Loses personalisation/explainability | High |
| Employer Portal | Weak talent intelligence (decisions already gated) | High (value) |
| Career Passport | Thin competency sections | Medium |
| Future Readiness | Minor signal loss | Low–Medium |

---

## 4. Honest Conclusion

> Competency Assessment is the **single most important dependency in the platform** — Employability Index *is* a competency-derived score, and Career Builder / Recommendations / Employer value are strongly coupled. The architecture for all of these is real. The **binding constraint is activation + validity of competency itself**: until the competency layer is populated and validated live, every dependent is honestly capped at **Beta/Pilot**, and EI specifically is **dark** (`mei_scores=0`). **Fixing competency activation is the highest-leverage action for the entire platform.**
