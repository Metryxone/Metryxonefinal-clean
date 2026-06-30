# 04 · Product Taxonomy Validation

The product's classification taxonomy as it exists in code (not an idealized one).

## Top-level taxonomy (repo-evidenced)
```
CAPADEX (platform)
├── Products
│   ├── CAPADEX behavioural assessment   (wc3/*, capadex_sessions)
│   ├── SDI (self-discovery index)        (sdi.ts, sdi_*)
│   ├── LBI (learning/behaviour index)    (lbi-intelligence.ts, lbi_*)
│   ├── Competency Assessment             (onto_*, competency_*)
│   ├── Career Builder / Launchpad        (career-*, cg_*)
│   ├── Employer Portal / hiring          (employer_*)
│   └── Future Readiness                  (frp_*)
├── Personas (account_type)               (default 'job_seeker'; student/mentor/employer/parent/...)
├── Lifecycle stages                      (Awareness→Curiosity→Clarity→Growth→Mastery; CAP_* codes)
├── Assessment types                      (entry/diagnostic/progress/exit; behaviour/competency/EI/career)
├── Capabilities                          (587 services; flag-registry of 190)
└── Reports                               (22 report-pack builders + Report Factory)
```

## Taxonomy coherence findings
| Taxonomy axis | Coherent? | Evidence / caveat |
|---|---|---|
| Products | **Yes** | Each product has its own namespace + tables; minimal overlap. |
| Personas | **Mostly** | `account_type` single column; some personas (faculty) are sub-roles via `staff_roles`, not top-level. |
| Lifecycle stages | **Split** | BE 5-stage (`CANONICAL_STAGE_ORDER`) vs FE 4-stage exposure — a **naming/exposure seam**, not two engines. |
| Assessment types | **Partial** | Entry/diagnostic/progress are clear; **exit/continuous assessment under-represented** (see 15). |
| Capabilities | **Sprawling** | 190 flags / 587 services; `-v2` duplication review-candidates; 1,441 live tables vs 134 canonical. |
| Reports | **Yes** | Single report factory + report-pack; consistent builders. |

## Verdict
Taxonomy is **present and largely coherent**, with two named seams to reconcile (lifecycle BE/FE stage naming;
capability/`-v2` duplication review). Both are **clarity** issues, not correctness — no taxonomy is missing or
fabricated. **Recommendation:** publish a single canonical taxonomy doc and resolve stage-naming + `-v2`
duplication review (enhancement-only, no code change required to validate).
