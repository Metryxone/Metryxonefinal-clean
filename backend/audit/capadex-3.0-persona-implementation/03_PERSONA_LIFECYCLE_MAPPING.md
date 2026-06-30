# 03 · Persona ↔ Lifecycle Mapping

Confirms every persona maps to the **canonical 4-coded lifecycle** frozen in Phase 1.1
(`backend/lib/lifecycle.ts`): `CAP_CUR` (Curiosity, free) → `CAP_INS` (Insight) → `CAP_GRW` (Growth) →
`CAP_MAS` (Mastery). "Clarity" = display alias of Insight; "Awareness" = uncoded pre-stage. Per-persona stage spans
are read from the blueprint (`07_PERSONA_BLUEPRINT.md:13-112`); the lifecycle engine itself is **persona-agnostic**
(stages are universal, persona modulates *content/journey within* a stage, not the stage codes).

| Persona (L2 / blueprint) | Canonical stages spanned | Status (blueprint) | Evidence |
|---|---|---|---|
| School Student (P1) | CUR → INS → (GRW) | journey present, exit/re-run = future | `07:16` |
| Competitive Aspirant (P2) | CUR → INS → GRW | present | `07:27` |
| College Student / `campus` (P3) | CUR → INS → GRW | present | `07:38` |
| Fresher / `jobseeker` (P4) | CUR → INS → GRW | **SUPPORTED** | `07:49` |
| Professional (P5) | INS → GRW → MAS | **PARTIAL** — Growth→Mastery is *derived*, not criteria-gated | `07:61-62` |
| Employee (P6) | INS → GRW | **SUPPORTED** | `07:73` |
| HR / recruiter (P7) | (funnel, not learner-lifecycle) | SUPPORTED | `07:84` |
| Employer (P8) | (org funnel) | SUPPORTED | `07:95` |
| Institute (P9) | (aggregate) | SUPPORTED | `07:106` |
| Parent | mirrors child's lifecycle (proxy) | segment ✓ / journey tail thin | `06:29` |
| Teacher / Counsellor | survey snapshot only | **PARTIAL** — no downstream stage progression | `06:15`,`07:120` |

## Key honest observations

1. **The lifecycle is single-sourced and persona-independent** — Phase 1.1 routed all stage reads through
   `lib/lifecycle.ts`. No persona re-defines stage codes/order. ✅ (no persona-specific lifecycle fork exists).
2. **Learner personas (P1–P6) ride the 4-coded lifecycle**; **funnel personas (P7–P8)** and the **aggregate
   persona (P9)** are **not** on the learner lifecycle by design — they use the 9-stage hiring funnel /
   k-anon aggregate respectively. This is correct, not a gap.
3. **P5 Professional Growth→Mastery is the one lifecycle-gating gap** the blueprint flags PARTIAL — this is the
   surface that the *separate* `evidenceGatedProgression` flag (already merged) addresses; persona-wise it means
   the Professional persona's Mastery stage is reachable but not yet evidence-criteria-gated for all personas. Tracked, not re-opened here.
4. **Proxy personas (Parent)** map to the lifecycle of the **assessed subject**, not their own — correct under the
   `actor_persona`/`target_persona` runtime-context model (`capadex_runtime_contexts`).

## Verdict
Every persona has a **correct, non-conflicting** lifecycle mapping. No persona introduces a competing stage
taxonomy. The only lifecycle-*gating* maturity gap (P5 Growth→Mastery) is already owned by a separate, merged
workstream. **No change required in this phase.**
