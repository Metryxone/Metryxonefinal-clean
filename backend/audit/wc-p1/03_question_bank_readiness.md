# WC-P1 — D3: Question Bank Readiness

**Coverage**: 30% | **Confidence**: 25%

---

## Evidence

| Bank | Row Count | Used in EI? | Notes |
|---|---|---|---|
| `competency_question_templates` | 63 | ⚠️ Indirect (via Assessment tab → modal) | Feed path to EI gauge absent |
| LBI sessions | 0 | ❌ No | Never started; no EI dimension for LBI score |
| SDI user responses | 0 | ❌ No | Never used; no SDI→EI bridge |
| CAPADEX sessions | *not probed* | ❌ Not bridged to EI gauge | CAPADEX concerns ≠ EI dimension inputs |

---

## Assessment Framework State

- **Competency question templates (63)**: Seeded. Used via `GET /api/competency/questions/select` in Assessment tab. Score stored on `profile.assessmentScore` only after completion. No completions recorded in available data.
- **LBI (Longitudinal Behavioral Intelligence)**: 0 sessions. 19 domains / 97 subdomains seeded in schema. No EI dimension maps to LBI score.
- **SDI (Self-Discovery Index)**: 0 user responses. No EI dimension maps to SDI score.

---

## Gap

The question banks are seeded but not producing data — there are no completed assessments to feed the EI pipeline. The EI's biggest single lever (Competency Assessment = 25pts) requires a functioning question bank → session → score path. That path exists in code but has produced zero records.

---

## Actions to Reach 95%

1. Run at least one end-to-end assessment session to validate the competency score → EI passthrough.
2. Define whether LBI scores should eventually contribute to an EI dimension (currently no mapping).
3. Ensure `assessmentScore` is persisted on `career_seeker_profiles.data` after session completion.
