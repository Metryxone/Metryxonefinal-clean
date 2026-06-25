# Career Builder Validation

_MX-301B — Career Intelligence Activation · generated 2026-06-25T14:20:22.510Z_

**Demonstration candidate:** `user_4286d980cc6cc038` (PII-masked).
**Assessment input (the data each engine must receive):** `onto_competency_score_runs`=1 (precise ledger), `onto_competency_profiles`=1 (domain-proxy ledger), profile completeness=85%. A real assessment exists — so every downstream engine HAS data to receive.

Validates the Career Builder activation surface — the four named competency-driven scores the Career Builder UI consumes — receiving the candidate's assessment.

**Summary:** 0/2 engines RECEIVED measured assessment data · 2 flag-gated (not activated).

| Engine | Consumes | Route | Flag | Unauth | Authed | Receives assessment data | Evidence / reason |
|---|---|---|---|---|---|---|---|
| Career Builder (activate) | materializes activation rows | `POST /api/v2/career-builder/activate/user_4286d980cc6cc038` | `FF_CAREER_BUILDER_ACTIVATION` | 503 | n/a | 🔒 FLAG OFF (not activated) | feature flag OFF (503) — activation route gated before any write (read-only safe) |
| Career Builder (intelligence) | composed activation scores | `GET /api/v2/career-builder/intelligence/user_4286d980cc6cc038` | `FF_CAREER_BUILDER_ACTIVATION` | 503 | 503 | 🔒 FLAG OFF (not activated) | feature flag OFF (503) — engine not activated |

## Flag-gated engines (NOT activated)

Wired and secured but the feature flag is OFF (503) — an honest "not activated" state, **not** a defect. NOT flipped by this read-only validator. To activate in DEV (reversible; production stays OFF):

```
FF_CAREER_BUILDER_ACTIVATION=1   # Career Builder (activate)
FF_CAREER_BUILDER_ACTIVATION=1   # Career Builder (intelligence)
```

---
_Honesty contract: RECEIVED requires the engine's own `measurable` signal AND the candidate's measured values flowing through; a default/fabricated composite or a null-actuals comparison is excluded. Read-only — no writes beyond this audit file. PII masked. NO DEPLOY._
