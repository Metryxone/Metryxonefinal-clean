# 04 · Product Taxonomy

ONE canonical product taxonomy. Promotes the Operating-Model taxonomy (`04`) into the frozen blueprint set and
adopts the canonical chain the brief mandates. Repo-evidenced — not an idealized hierarchy.

## Canonical taxonomy chain (the brief's mandated hierarchy)
```
Domain
  ↓
Persona
  ↓
Lifecycle (stage)
  ↓
Journey
  ↓
Assessment
  ↓
AI
  ↓
Recommendation
  ↓
Intervention
  ↓
Outcome
  ↓
KPI
```
This chain is the **traceability backbone** (see 15). Each level maps down to the next; a break anywhere is a
measured product gap (the universal break is **Outcome → KPI**, see 13/14/15).

## Product / module taxonomy (repo-evidenced)
```
CAPADEX (product on the MetryxOne platform)
├── Products / modules
│   ├── CAPADEX behavioural assessment   (wc3/*, capadex_sessions)        D2
│   ├── SDI — self-discovery index        (sdi.ts, sdi_*)                  D2
│   ├── LBI — learning/behaviour index    (lbi-intelligence.ts, lbi_*)     D3 (⟂ competency, by design)
│   ├── Competency Assessment             (onto_*, competency_*)           D3
│   ├── Career Builder / Launchpad        (career-*, cg_*)                 D4
│   ├── Employer Portal / hiring          (employer_*)                     D9
│   └── Future Readiness                  (frp_*)                          D4 (composes D5)
├── Personas (account_type + staff_roles) (job_seeker default; student/mentor/employer/parent/institute/...)
├── Lifecycle stages                      (Curiosity→Insight→Growth→Mastery; CAP_* codes; 4 coded)
├── Assessment types                      (Entry/Baseline/Diagnostic/Behaviour/Competency/Learning/
│                                          Performance/Progress/Exit/Continuous)
├── Capabilities                          (589 services; file-registry of 192 flags)
└── Reports                               (22 report-pack builders + Report Factory)
```

## Taxonomy coherence (honest)
| Axis | Coherent? | Note |
|---|---|---|
| Products / modules | **Yes** | each product owns its namespace + tables; minimal overlap. |
| Personas | **Mostly** | `account_type` single column; faculty etc. are sub-roles via `staff_roles`, not top-level. |
| Lifecycle stages | **Resolved** | canonical = **4 coded** (Curiosity→Insight→Growth→Mastery); "Clarity"=alias of Insight, "Awareness"=uncoded. The historical "5-stage" prose is a documentation artifact (see 06). |
| Assessment types | **Partial** | front-half mature; **Exit/Continuous absent**, Progress not systematically re-run (see 08). |
| Capabilities | **Sprawling** | 192 flags (32 ON / 160 OFF); `-v2` files = review-candidates (≠redundant); schema sprawl (live tables ≫ canonical). |
| Reports | **Yes** | single report factory + report-pack; consistent builders. |

## Canonical decisions (FROZEN)
1. **Lifecycle stage naming = 4 coded** (resolves the BE/FE "5-vs-4" seam in docs, not code).
2. **"Capability" = product function**; "Competency" = ontology-backed skill (never interchanged).
3. **LBI ⟂ Competency** are two products by design — never merged in the taxonomy.
4. **`-v2` modules are review-candidates**, never assumed redundant; no deletion authorized by this taxonomy.

## Verdict
**ONE product taxonomy, present and largely coherent, with its two seams (stage naming, `-v2` duplication
review) resolved at the documentation level. FROZEN.** No taxonomy node is missing or fabricated.
