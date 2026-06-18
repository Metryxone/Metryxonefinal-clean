# WC-P2 — D01: Learning Behavior Framework Readiness
Generated: 2026-06-10T13:48:42.822Z

## Verdict: ❌ EMPTY — Framework Declared, Not Seeded

The LBI framework is architecturally complete (26 tables, full schema) but contains
zero data across every table. The product page declares 19 domains and 3 age bands,
but these are frontend-only constants — no DB rows back them.

## Domain Coverage

| Declared Domain | DB Rows | Status |
|----------------|---------|--------|
| D01 Academic & cognitive effectiveness | 0 | ❌ Missing |
| D02 Thinking quality under pressure | 0 | ❌ Missing |
| D03 Examination stress & emotional regulation | 0 | ❌ Missing |
| D04 Confidence, self-concept & comparison | 0 | ❌ Missing |
| D05 Adjustment & coping capacity | 0 | ❌ Missing |
| D06 Social & emotional intelligence | 0 | ❌ Missing |
| D07 Discipline, habits & consistency | 0 | ❌ Missing |
| D08 Communication & expression | 0 | ❌ Missing |
| D09 Motivation, values & responsibility | 0 | ❌ Missing |
| D10 Lifestyle & pressure environment | 0 | ❌ Missing |
| D11 Competitive exam readiness | 0 | ❌ Missing |
| D12 Integrated root cause mapping | 0 | ❌ Missing |
| D13 Academic planning & recovery | 0 | ❌ Missing |
| D14 Metacognition & self-regulation | 0 | ❌ Missing |
| D15 Help-seeking & support utilization | 0 | ❌ Missing |
| D16 Academic identity & meaning | 0 | ❌ Missing |
| D17 Transition & change adaptability | 0 | ❌ Missing |
| D18 Teacher-student interaction | 0 | ❌ Missing |
| D19 Over-compliance risk | 0 | ❌ Missing |

**Structural coverage**: 19/19 domains declared in frontend (100% structural)  
**Activation coverage**: 0/19 domains seeded in DB (0%)

## Age Band Coverage

| Band | Range | Declared | DB Rows |
|------|-------|----------|---------|
| A | 6–10 (Primary) | ✅ | 0 |
| B | 11–14 (Middle school) | ✅ | 0 |
| C | 15–18 (Senior secondary) | ✅ | 0 |

## Framework Table State

| Table | Rows | Impact of 0 |
|-------|------|------------|
| lbi_domains | 0 | `GET /api/lbi/domains` returns [] |
| lbi_subdomains | 0 | No subdomain breakdown possible |
| lbi_age_bands | 0 | `GET /api/lbi/age-bands` returns [] |
| lbi_response_scales | 0 | No Likert scale definitions |
| lbi_scoring_rules | 0 | No domain scoring formula |
| lbi_subdomain_norms | 0 | No percentile benchmarks |

## Blocking Gap
The entire System B assessment flow is blocked by a single root cause: **no seed script or
migration has been run to populate framework tables**. The schema is correct. The routes are
wired. The data simply does not exist.

**Quickest fix**: Create a seed script that inserts 19 domain rows, ~70 subdomain rows,
3 age band rows, and at least 1 response scale. This unblocks all System B API routes at once.
