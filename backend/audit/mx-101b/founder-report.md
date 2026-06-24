# MX-101B — Assessment Readiness Acceleration — Founder Report

**Task:** MX-101B-ASSESSMENT-READINESS-ACCELERATION · **Mode:** BUILD · **Disposition:** Option A (machinery only)
**Flag:** `assessmentReadiness` (`FF_ASSESSMENT_READINESS`, default **OFF**) · **Status:** built, flag-OFF byte-identical, STOP before deploy.

---

## 1. What this delivers (and what it deliberately does NOT)

MX-101A drove the full 419-competency genome to **100% DRAFT coverage** (~2,514 drafts) with zero inflation.
A draft is a *candidate* question — it never counts toward live coverage. The bottleneck to a sellable
assessment was therefore **human/SME approval throughput**, not generation.

MX-101B builds the **complete machinery** to convert that draft backlog into approved, assessment-ready
coverage efficiently — **certification, a bulk review workbench, a readiness engine, dashboards, and trends** —
so a human reviewer can reach 100+ assessment-ready competencies quickly.

**It does NOT approve anything.** Per the approved Option A:
- The agent **never auto-approves** and **never inflates** coverage.
- The only coverage-changing operation is a **human approval over an explicit, hand-selected id set** in the workbench.
- **Certification ≠ approval.** Certification pre-qualifies a draft on a separate **Confidence** axis; it never flips the live **Coverage** number.
- The live count stays **honest** until a human acts.

---

## 2. Honest current state (live shared DB, at build time)

| Axis | Competencies | % of genome | Notes |
|---|---|---|---|
| Genome (active) | **419** | 100% | denominator |
| Draft coverage | **419** | 100% | 2,545 actionable drafts mapped (candidates only) |
| **Approved coverage** | **7** | **1.7%** | ≥1 approved+active question |
| **Assessment-ready coverage** | **0** | **0%** | needs ≥4 approved, ≥2 types, ≥2 difficulty bands |
| Approved questions (total) | **57** | — | across the 7 approved competencies |
| Certified drafts | **0** | — | certification not yet run by an operator |
| Uncertified actionable drafts | **2,545** | — | the honest certification backlog |

Readiness breakdown: `base_ready=0, ready_assured=0, ready_unverified=0, ready_quality_concern=0`.
Criteria (composes the existing assessment-ready gate, never replaces it):
`min_approved=4, min_types=2, min_difficulty_bands=2, quality_structural_floor=70`.

These zeros are the **honest finding**, not a gap in the machinery: nothing is assessment-ready because a
human has not yet approved the ≥4 correctly-shaped questions per competency. The machinery to do so now exists.

---

## 3. The three axes (kept SEPARATE by design — Coverage ⟂ Confidence)

1. **Coverage** — `base_ready` / assessment-ready: competencies whose **approved** questions are shaped correctly
   (≥4 approved, ≥2 types, ≥2 difficulty bands). This is the live gate, **unchanged** from before.
2. **Confidence** — `ready_assured`: a base-ready competency whose approved questions are **also certified**.
   Always `≤ base_ready`. **Never** composited into the coverage number.
3. **Pipeline** — drafts, certifications, and the review backlog. These are *candidates and signals*, not coverage.

Invariant enforced in code and proven by smoke: `quality_assured ≤ base_ready ≤ approved ≤ draft`.

---

## 4. Machinery built

| Phase | Component | Behaviour |
|---|---|---|
| 1 | `services/question-certification.ts` | Deterministic 5-dim per-question certifier — Duplication / Difficulty / Competency-Alignment (**structural, high-confidence**) + Relevance / Clarity (**heuristic proxies, labelled lower-confidence**; AI hooks inert without key, never fabricate). Append-only `question_certifications` ledger. Idempotent (skips already-certified unless `reCertify`). **Never touches approval/coverage.** |
| 2 | `services/review-workbench.ts` | `bulkReview` iterates the **existing** `reviewQuestion` state machine over an **explicit id set** (optional `certifiedOnly` fast-track), audit-logged per row in `qf_review_audit` with reviewer id. SME queue (tier + cert + age) and reviewer productivity from real `reviewed_by`/`reviewed_at`. **Refuses an empty id set** — no blanket/scheduled approval. |
| 3 | `services/assessment-readiness.ts` | Per-competency 4-criteria readiness with honest reason breakdown; **composes** the existing three-axis coverage + the cert ledger (the quality floor). Append-only snapshot writer + trend reader over `qf_coverage_snapshots`. |
| 4 | `routes/assessment-readiness.ts` + `QuestionFactoryPanel.tsx` | Base `/api/admin/assessment-readiness` (super-admin, `/enabled` probe, flag gate). New **Assessment Readiness** tab (probe-gated) with readiness breakdown, certification ledger, review backlog, reviewer productivity, trends, and Certify / Snapshot actions. |
| 5 | `scripts/mx101b-smoke.ts` + this report | End-to-end smoke against the live DB with full cleanup; founder report. |

**Additive guarantees:** new flag default OFF; new tables only (lazy ensure-schema **POST-only**, GETs use `to_regclass` probe + degrade); flag-OFF path byte-identical incl. schema; reversible; idempotent; never-throws; compose-don't-recompute.

---

## 5. Smoke verification (`FF_ASSESSMENT_READINESS=1 npx tsx scripts/mx101b-smoke.ts`)

**23/23 PASS.** Proves end-to-end against the shared live DB:
- generation does **not** change coverage;
- certification does **not** change coverage (cert ≠ approval);
- a competency is **not** base-ready before approval;
- **bulk approval over explicit ids** is the only thing that raises coverage (rose by exactly the approved set);
- after approval the competency is base-ready and `quality_assured ≤ base_ready` holds;
- snapshot + trends work;
- **empty-id bulk approve is refused** (no blanket approval);
- **malformed (non-uuid) ids are partitioned into errors without throwing** (never-throws — no 500 on bad input);
- `certifiedOnly` fast-track **skips** uncertified drafts (no fabricated approvals);
- **full cleanup restores the live baseline** (coverage 3→…→3, base-ready unchanged) — **zero residue** (verified: 0 certs/snapshots/batches under the smoke marker).

---

## 6. How a human reaches 100+ assessment-ready (the intended path)

1. **Certify** the actionable draft backlog (Confidence signal; one click per competency or bulk).
2. In the **workbench**, filter to cert-passed drafts, **select** the questions to approve, and **bulk-approve** them.
   Each competency needs ≥4 approved spanning ≥2 types and ≥2 difficulty bands to become assessment-ready.
3. **Snapshot** periodically to build the coverage/readiness **trend**.
4. Repeat across competencies. With ~2,545 drafts already staged across all 419 competencies, the only remaining
   input is **human review time** — which this machinery now makes efficient.

The agent stops here. **No deploy.** Coverage stays at the honest live numbers above until a human approves.
