# 03 · Business Domain Validation

The business domains CAPADEX actually implements (repo-evidenced), classified by maturity.

| # | Business domain | Primary repo surface | Status |
|---|---|---|---|
| 1 | **Behavioural assessment** (CAPADEX/SDI) | `services/wc3/*`, `sdi.ts`, signal/clarity engines, `capadex_sessions` | **IMPLEMENTED** |
| 2 | **Competency assessment & ontology** | `onto_*`/`map_*`/`ref_*` tables, `competency-*` services, 12-layer ontology | **IMPLEMENTED** |
| 3 | **Learning / behavioural index (LBI)** | `lbi-intelligence.ts`, `lbi_*` (W1–W10 consolidated) | **IMPLEMENTED** |
| 4 | **Career intelligence** | Career Builder/Launchpad/Readiness/Graph, `career-*` engines, `cg_*` | **IMPLEMENTED** |
| 5 | **Hiring / employer** | Employer Portal (`employer_*`), talent-match, interview intel, voice/avatar screening | **IMPLEMENTED** |
| 6 | **Emotional intelligence (EI)** | `employabilityEngine.ts`, `ei_*`, EI health panel | **IMPLEMENTED** |
| 7 | **Future readiness** | `frp_*` (10 tables), 5-signal FRI | **IMPLEMENTED (flag-gated)** |
| 8 | **Reports & analytics** | Report Factory + report-pack (22 builders), benchmark engine | **IMPLEMENTED** |
| 9 | **Commerce / monetization** | `capadex_payments`, subscription packages, entitlement enforcement, invoice/GST | **PARTIAL** (package→entitlement gap per memory) |
| 10 | **Institutional intelligence** | k-anon Univ/Faculty/Placement/Parent aggregation (MX-302H) | **IMPLEMENTED (flag-gated)** |
| 11 | **Enterprise / platform governance** | MX-700 lifecycle tiers, MX-800 intelligence tiers, governanceRbacV2 | **DORMANT (default-OFF, honest)** |
| 12 | **Mentoring / coaching marketplace** | mentor pages + `mentor_profiles`, coaching page | **PARTIAL** (mentor real; coach≈mentor) |

## Honest findings
- **Domains 1–8 are the product core and are genuinely implemented.** This is a real multi-domain product, not
  a single-assessment tool.
- **Commerce (9)** is the most material PARTIAL: the spine exists (payments ledger, packages, entitlement
  enforcement) but `subscription package → entitlement` mapping is permanently absent (users table has no email
  col per memory) — a commercial-readiness gap, not a structural absence.
- **Governance/enterprise (11)** is a large **dormant** surface (default-OFF, byte-identical). Built ≠ activated.
- **No domain is fabricated or missing-but-claimed.** Coverage is broad; the gaps are depth (commerce
  entitlement, governance activation, mentoring breadth), not absence.

**Domain count: 12 identified · 8 IMPLEMENTED core · 3 PARTIAL · 1 DORMANT.**
