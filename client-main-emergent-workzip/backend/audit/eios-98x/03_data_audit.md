# EP-EIOS-98X — Data Audit (Live DB Evidence)

**Evidence collected:** 2026-06-13T03:18:58Z  
**Source:** `run-audit.ts` → `evidence.json` (live DB queries, no hardcoding)  
**Environment:** Development (no employers onboarded — correct baseline)

---

## Table Existence & Row Counts

All 18 audited tables EXIST. Row counts reflect dev state (no employers onboarded).

| Table | Exists | Rows | Category | Notes |
|-------|--------|-----:|----------|-------|
| `employer_candidates` | ✅ | 0 | Core | No employers have added candidates in dev |
| `employer_jobs` | ✅ | 0 | Core | No employers have posted jobs in dev |
| `employer_members` | ✅ | 0 | Core | No employer team members in dev |
| `employer_interviews` | ✅ | 0 | Core | No interviews scheduled |
| `employer_offers` | ✅ | 0 | Core | No offers made |
| `employer_activity_logs` | ✅ | 0 | Core | Audit log table ready |
| `ep98_hiring_assessments` | ✅ | 0 | Assessment | No assessments run |
| `tig_nodes` | ✅ | 0 | TIG | No TIG built |
| `tig_edges` | ✅ | 0 | TIG | No TIG built |
| `tig_clusters` | ✅ | 0 | TIG | No TIG built |
| `eios_campaigns` | ✅ | 0 | EIOS | No campaigns created |
| `eios_scenarios` | ✅ | 0 | EIOS | No scenarios run |
| `eios_workforce_plans` | ✅ | 0 | EIOS | No plans saved |
| `eios_outcome_tracking` | ✅ | 0 | EIOS | No outcomes tracked |
| `rf_generated_reports` | ✅ | 0 | RF | Table exists (lazy-created at server start); 0 rows = no P20 generate called yet |
| `wcl0_user_intelligence` | ✅ | **9** | Behavioral spine | 9 CAPADEX users have WCL-0 snapshots |
| `frp_user_readiness` | ✅ | 0 | FRP spine | No FRP readiness computed |
| `capadex_sessions` | ✅ | **31** | CAPADEX | 31 sessions exist (CAPADEX assessment history) |

**Finding:** Zero rows in all employer-specific tables is the correct baseline — the dev environment
has no employer accounts that have completed onboarding and imported/created candidates. This is not
a bug or a gap. The structural layer (routes, schema, auth) is fully in place.

---

## Candidate Enrichment Coverage

All metrics are 0 because `employer_candidates` has 0 rows. Not a structural gap.

| Metric | Count | Coverage |
|--------|------:|---------|
| Total candidates | 0 | — |
| With `ei_score` (non-null) | 0 | 0 / 0 |
| With `match_score` (non-null) | 0 | 0 / 0 |
| With `lbi_score` (non-null) | 0 | 0 / 0 |

---

## Behavioral Spine Linkage

| Spine table | Rows | Linked to employer_candidates | Coverage |
|-------------|-----:|-------------------------------|---------|
| `wcl0_user_intelligence` | 9 | 0 (no candidates to link to) | — |
| `frp_user_readiness` | 0 | 0 | — |

**P7/P8 wcl0 consumption:** The join code is in place and correct. Zero linkage is because there are
zero employer candidates in dev, not because the join is broken. The join logic:
```sql
INNER JOIN wcl0_user_intelligence w ON w.user_email = c.email
```
Will resolve correctly once candidates with matching emails exist.

---

## k-Anonymity State (P18 Benchmarks)

| Metric | Value |
|--------|-------|
| `COUNT(DISTINCT employer_id)` pool size | 0 |
| `k_min` threshold | 30 |
| Benchmark suppression active | **YES** (correct) |
| P18 response | Returns `suppressed: true`, `industry: null`, `vsIndustry: null` |
| Suppression note in response | "Benchmarks suppressed: industry pool (0) below k_min=30" |

**Verdict:** k-anonymity is working correctly. With fewer than 30 distinct employers in the pool,
cross-industry benchmarks are correctly suppressed. This protects individual employer privacy.

---

## Certification Dynamic Check Results (Live)

| Check ID | Condition | Live Value | Pass |
|----------|-----------|:----------:|------|
| `activation_candidates` | `employer_candidates COUNT > 0` | 0 | ❌ |
| `activation_assessments` | `ep98_hiring_assessments COUNT > 0` | 0 | ❌ |
| `activation_nine_box` | `match_score IS NOT NULL COUNT > 0` | 0 | ❌ |
| `src_lbi_scores` | `lbi_score IS NOT NULL COUNT > 0` | 0 | ❌ |
| `src_wcl0_intelligence` | `wcl0_user_intelligence COUNT > 0` | 9 | ✅ |
| `src_capadex_sessions` | `capadex_sessions COUNT > 0` | 31 | ✅ |

**2/6 dynamic checks pass** in dev. All 4 failures are data-bound (no employer data), not code
failures. The checks correctly reflect the state of the system.

---

## Report Factory Archive State

`rf_generated_reports` table exists (created lazily at server start via the P20 generate handler's
`setImmediate` DDL block). Zero rows = no employer has called `POST /p20/generate` yet.

Once an employer calls `POST /api/employer/eios/p20/generate`, a row will be inserted with:
- `report_type`: `eios_<reportType>` (e.g. `eios_executive`)
- `employer_id`: scoped to the calling employer
- `data`: full JSON report payload
- `generated_at`: timestamp

---

## Capadex Sessions (Non-employer Data)

31 `capadex_sessions` rows exist from the CAPADEX free assessment product. These are individual
(non-employer) assessment sessions. They are used only by the `src_capadex_sessions` cert check
to verify the CAPADEX data source is available for integration — they are not employer data.
