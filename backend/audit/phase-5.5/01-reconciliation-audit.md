# Phase 5.5 — Competency Matching Engine · Reconciliation Audit

**Program:** MX-COMPETENCY-FRAMEWORK-TRANSFORMATION
**Contract:** additive · flag-gated (default OFF) · compose-never-recompute · GET-never-writes ·
IDOR-guarded (super-admin) · never-throws · honesty-first (NEVER fabricate/duplicate). STOP for approval.

---

## 1. Goal

Match a candidate's competencies against a role's required competencies and surface five
**separately-defined, never-composited** axes:

| Axis | Meaning | Source |
|------|---------|--------|
| **Match %** | BREADTH — weighted share of the role's competencies the candidate has *any* evidence for | `coverage_pct` |
| **Readiness %** | DEPTH over ASSESSED weight — weighted attainment across evidenced competencies | `readiness_score` |
| **Fit %** | DEPTH over the WHOLE role — `readiness × coverage / 100`; band critical-capped | derived |
| **Gap %** | weighted shortfall over the whole role — `100 − Fit raw` | derived |
| **Confidence %** | TRUST — evidence-quality-weighted coverage × profile completeness | derived |

Deliverables: `talent_matching_engine`, `fit_engine`, `gap_engine`, `match_explanation_engine`
(all in `services/talent-matching-engine.ts`, exported as pure functions + orchestrators).

---

## 2. Substrate reconciliation (no fabrication, no net-new tables)

### Candidate competencies — `employer_candidates`
- `competency_profile` (jsonb) → explicit per-competency proficiency levels → **measured** evidence.
- `skills` (jsonb keyword list) → keyword match to a competency name → **inferred** evidence (conservative
  proxy level, capped at required; never presented as a measured level).
- `ei_score` / `assessment_score` / `match_score` → carried through as **supporting_signals** only —
  a DIFFERENT (candidate-level, keyword-based) construct, deliberately **not** folded into the five axes.
- **0 rows in dev** — honest. The engine returns honest empties/zeros over absent data; the smoke seeds
  `@example.com` demo rows, asserts, and self-cleans.

### Role requirements — `onto_role_competency_profiles`
- 14 rows · roles `role_be_eng` / `role_pm` / `role_sr_be_eng` (2 further `onto_roles` —
  `role_eng_manager`, `role_credit_analyst` — have **no** profile → `measurable=false`, scores null).
- `required_level` (1–5), `weight`, `criticality`; 299 `onto_competencies` (name col = `canonical_name`).

### Name-collision check
- No table/flag/route-base collision for `talent_matching` / `fit` / `gap` / `match_explanation`.
- **Zero net-new tables · zero DDL** — pure read-only compute. Flag `talentMatching` (`FF_TALENT_MATCHING`).

---

## 3. Compose-never-recompute

The canonical weighted math lives in `services/role-competency-profile.ts` `getRoleReadiness(pool, roleId,
actuals)` → `readiness_score`, `coverage_pct`, `blocking_gaps`, per-competency `gaps[]`, and the
critical-capped `roleFit`. Phase 5.5 **only** resolves the candidate's `actuals` map (measured/inferred/none)
and DERIVES the five axes + per-competency breakdown from that single composed result. It never
re-implements attainment, blocking-gap, or fit-band logic.

---

## 4. Honesty guarantees

- **Evidence tiers are explicit.** measured (trust 1.0) > inferred (0.45) > none (0). Keyword-inferred
  competencies raise Match breadth but heavily discount Confidence and never count as measured depth.
- **Absent ≠ zero where it matters.** A role with no profile → all axes `null` (`measurable=false`).
  A profiled role with a candidate that has no evidence → Match 0 / Fit 0 / Gap 100 / Confidence 0,
  **Readiness null** (nothing assessed) — zeros are reported, depth is not fabricated.
- **Critical cap.** An unmet critical competency forces a blocking gap that caps the Fit band regardless
  of the raw score (`capped_by_critical=true`), surfaced in the explanation.
- **Separate axes.** Match/Readiness/Fit/Gap/Confidence are never collapsed into one number.

---

## 5. Surface

Base `/api/talent-matching-engine` — gate(`talentMatching`) → `requireAuth` → `requireSuperAdmin`,
GET-only, read-only (no ensure-schema). OFF ⇒ every route 503 before any auth/DB touch (byte-identical legacy).

| Method · path | Purpose |
|---|---|
| `GET /_meta/status` | engine/version probe |
| `GET /candidate/:c/role/:r` | full five-axis match + breakdown |
| `GET /candidate/:c/role/:r/explain` | match + per-competency explanation notes |
| `GET /candidate/:c/roles` | rank profiled roles for a candidate |
| `GET /role/:r/candidates` | rank candidates for a role |

Literal/more-specific paths (`/_meta/status`, `/explain`, `/roles`) registered before param routes.

---

## 6. Verification

- `scripts/smoke-talent-matching-engine.ts` — seeds 4 demo candidates exercising every evidence tier:
  measured-strong (Alice → 100/100/100/0/100, strong), measured-blocking (Bob → critical gap caps band to
  partial), inferred-only (Carol → breadth 50, confidence ≤30), no-evidence (Dave → 0/null/0/100/0), a
  profile-less role (`measurable=false`, null scores), ranking both directions, not-found/invalid-input,
  and HTTP flag-OFF 503 on the running server. Self-cleans all demo rows.
- Backend runs on `tsx` (no typecheck gate); real launch gate is the frontend `vite build`.
