# CAPADEX 3.0 · Phase 1.2 Persona Model — Implementation Report

**Mode:** Enhancement-Only · Reuse-Before-Build · No-V2 · No-Breaking-Changes · ONE flag `personaModelAlignment` (`FF_PERSONA_MODEL_ALIGNMENT`, default OFF).

**Schema-parity scope (precise):** the flag `personaModelAlignment` touches **zero schema** — it is byte-identical OFF including schema, and the same OFF/ON code paths run regardless of any table. The G-M3 data seed (T008) is a **separate, manually-run dev op that is NOT gated by this flag** (by design — it is gated by the adaptive-questioning activation flags at *serving* time). It creates the pre-existing `adaptive_question_bank` table only IF ABSENT (no prior migration ever owned it) and inserts inert DRAFT rows; it never ALTERs an existing table. So: **flag = no schema change; seed = a one-off dev schema/data side-effect outside the flag.** The two are reported separately below — runtime byte-identity is not the same axis as the seed's schema behaviour.
**Scope:** Alignments A–G + G-M4 from deliverables 09/10. **Excluded** (honest): Future/DO-NOT-CLAIM verticals G-F1–G-F6 (govt/healthcare/clinical) — not implemented, not claimed.

## What changed

| Task | Alignment | File(s) | OFF behaviour |
|---|---|---|---|
| T001 | Flag + public-config | `backend/config/feature-flags.ts` (`personaModelAlignment` + `isPersonaModelAlignmentEnabled()`), `backend/routes/capadex.ts` (`persona_model_alignment` in public-config) | flag false; endpoint returns boolean |
| T002 | Sub-persona banks + resolver (G-H1/H3/M1, D) | `frontend/src/lib/behavioural-insights.ts` (`SUB_PERSONA_QUESTION_BANKS`, `resolveQuestionBank`, `getQuestionBankProvenance`) | resolver → `QUESTION_BANKS[legacyKey]` |
| T003 | IntroPhase exam split + labels (G-H2/L2) | `frontend/.../phases/IntroPhase.tsx` | single competitive-aspirant entry; TRACK_GROUPS identical |
| T004 | Wire flag + resolver | `frontend/src/components/FreeAssessmentModal.tsx` | bank selection byte-identical |
| T005 | cohort-gating drift (G-M2) | `backend/services/cohort-gating.ts` (`ALIGNMENT_SUB_PERSONA_TO_TRACK`, `personasForTrack()`) | base map only; counts unchanged |
| T006 | PIL campus/jobseeker lenses + counsellor provenance (G-M4, D) | `backend/services/pil/runtime-guidance-engine.ts` (`ReaderLens`, `classifyReaderLens`, `resolveStakeholderProvenance`, optional `stakeholder_provenance`) | borrowed lens; key absent |
| T007 | Legacy label consolidation (G-L1) | `frontend/.../phases/CapadexRegisterPhase.tsx` (`PERSONA_LABELS`) | legacy labels |
| T008 | adaptive_question_bank seed (G-M3) | `backend/scripts/seed-adaptive-question-bank-personas.ts` | DRAFT-only → runtime serves `approved` → byte-identical |
| T009 | Docs SSoT (A) | `docs/PERSONA_MODEL.md` + `replit.md` Feature-Map pointer | n/a |

## Verification (T010)

- **Flag OFF (default):** `GET /api/capadex/public-config` → `persona_model_alignment = false`. ✅
- **Flag ON:** `isPersonaModelAlignmentEnabled()` returns `true` with `FF_PERSONA_MODEL_ALIGNMENT=1`. ✅
- **Frontend esbuild parse** (NEVER pkill): `behavioural-insights.ts`, `FreeAssessmentModal.tsx`, `IntroPhase.tsx`, `CapadexRegisterPhase.tsx` — all PARSE OK. ✅
- **Backend API** restarted and responding. ✅
- **G-M3 seed:** ran idempotently — 15 new DRAFT rows (campus/jobseeker/teacher × 5); re-run inserts 0. ✅
- **Sub-persona id parity** verified across IntroPhase / `SUB_PERSONA_QUESTION_BANKS` / cohort `ALIGNMENT_SUB_PERSONA_TO_TRACK`.

## Honesty notes
- **G-M3 draft-only:** runtime consumer `pickQuestionsFromDB` serves ONLY `status='approved'` rows; seeded rows are `draft`, so runtime is byte-identical. Promotion is a human op gated by adaptive-questioning activation flags — NOT `personaModelAlignment`. Human approval remains the only coverage-changing op.
- **Borrowed content disclosed, never fabricated:** sub-persona banks / PIL lenses reusing a parent's content carry an explicit provenance label/field.
- **Shared dev/prod DB:** the seed targets `adaptive_question_bank` (which did not previously exist); `CREATE TABLE IF NOT EXISTS` mirrors the columns used by the admin CRUD route. Drafts are inert at runtime.

## STOP
Per project rule "Audits & additive phases STOP for approval" — no deploy performed.
