---
name: Enterprise Question Management Platform (CAPADEX 3.0 Phase 3.2)
description: Phase 3.2 certifies the ONE canonical Question Management Platform over the EXISTING question services AND engineering-closes all 8 gaps (QM-1..8) via REUSE-before-build additive qmp_* overlay; adoption is a separate axis, never fabricated.
---

# Enterprise Question Management Platform (CAPADEX 3.0 · Program 3 · Phase 3.2)

Flag `questionManagementPlatform` (`FF_QUESTION_MANAGEMENT_PLATFORM`), default OFF. A CERTIFICATION deliverable mirroring 1.3–1.7 / 3.1 that ALSO engineering-closes 8 gaps (QM-1..QM-8) via reuse-before-build over the EXISTING `capadex_question_registry` + an additive `qmp_*` overlay — NO duplicate platform, NO V2. Certifies EIGHT INDEPENDENT dimensions, **NEVER composited**.

## Durable decisions / traps
- **Byte-identical OFF incl. schema:** DDL runs ONLY on the flag-gated mechanism POSTs (they create the `qmp_*` overlay). Cert GETs are read-only `to_regclass`/fs probes. **Why:** the contract forbids any schema drift while OFF.
- **6 overlay tables read ABSENT in repository-alignment (tbl 9/15) — HONEST, not a defect.** The `qmp_*` tables only exist after a flag-gated mechanism POST runs. Do NOT "fix" this by creating them at read time — that breaks byte-identical-OFF. **How to apply:** when the alignment count looks low, confirm the missing tables are exactly the overlay tables before treating it as a bug.
- **public-config is a dual import-site:** `routes/capadex.ts` `/public-config` must IMPORT `isQuestionManagementPlatformEnabled` or the endpoint 500s (no tsc here).
- **OFF smoke ∈ {401,403,503}:** `/enabled` is 503-before-auth (flagGate first); the super-admin `/api/admin/question-management/*` routes return 401 OFF because the GLOBAL `/api/admin` auth gate precedes route-level flagGate.
- **New route → restart Backend API before smoke-testing** (else `/enabled` 404s and public-config key is absent — both symptoms of a stale workflow, not a code bug).
- **Engineering closure ⟂ Adoption (honesty invariant):** the mechanism EXISTS for every gap, but real authored-question VOLUME is honest-low/0 in dev. Adoption is a SEPARATE usage axis — never a gap, never fabricated as adopted. Types without a dedicated renderer are honestly PARTIAL. Coverage⟂Confidence⟂Adoption never composited; null≠0.
- **Deliverables are scan-locked:** generator reads ONLY `scan.json` (SCAN_HASH sha256). Frontend evidence depends on `QuestionManagementPanel.tsx` existing — create the panel BEFORE the final scan or fe counts read low, then re-run scan THEN generator.
- Validate via esbuild parse (vite build pathologically slow); run scan + generator from `backend/` with `npx tsx`; NEVER pkill.
