# MX-77X · Section 2 — Talent Intelligence Graph (TIG) Architecture

**Status:** WORKING (the only fully self-populated workforce intelligence asset).
**Backend:** `routes/employer-tig.ts` (graph builder + Engines 1–8), base `/api/employer/tig`.
**Tables (live):** `tig_nodes` 72 · `tig_edges` 1680 · `tig_intelligence` 40 · `tig_clusters` 2 ·
`tig_calibration` 5 · `tig_build_log` 3.

## Graph shape (validated)
- **Node entity types (8):** Candidate, Job/Role, Manager, Skill/Competency, plus supporting refs.
- **Edge types (5):** `MANAGES`, `BELONGS_TO`, `EXHIBITS`, and relationship/readiness links.
- **Source population:** `employer_candidates` (40) + `employer_jobs` (1) → graph build materialises
  nodes/edges; `tig_intelligence` (40) holds per-candidate composed signals; `tig_calibration` (5)
  holds the success-probability calibration snapshot.

## Target flow (asserted by the task) vs. live reality
```
Employee/Candidate → Competencies → Readiness → Career Path → Performance → Potential → TIG
```
- **Reachable today:** Candidate → Competencies (EXHIBITS edges) → Readiness (`tig_intelligence.readiness_index`)
  → Career Path / mobility targets (Engine 6) → Potential (calibration).
- **Reachability ceiling:** "Employee" and "Performance" are EMPLOYER-CANDIDATE scoped, not an
  org-employee HRIS feed. TIG is hiring-pipeline-shaped, so org-wide succession/mobility that expect a
  resident workforce are served by the M5 layer (Sections 3–9), not TIG directly.

## Outputs
- `readiness_index` (composite of match · EI · assessment · experience), clusters, calibration
  (Brier/ECE RAW, borrowed prior never upgrades trust, LEARNED only from Hired/Rejected with ≥30).

## Coverage ⟂ Confidence
- **Coverage:** high for the 40-candidate / 1-job pipeline (1680 edges).
- **Confidence:** calibration is `uncalibrated`/low until ≥30 real decision outcomes accrue
  (write-once snapshot; borrowed prior is flagged, never promoted to TRUST).

## Honest gaps
- Single employer / tiny job set → calibration cannot reach the ≥30 learned-outcome threshold yet.
- No org-employee (HRIS) ingestion → TIG ≠ enterprise workforce census.
