# WC-P2 — D11: Executive Gap Analysis
Generated: 2026-06-10T13:48:42.830Z

## Overall Readiness: Coverage 25% / Confidence 0%

- **Coverage** measures whether the structural elements (routes, tables, schemas) exist.
- **Confidence** measures whether those elements produce real, correct outputs from real data.
- **Methodology**: Structural coverage = unweighted average of 10 dimension structural scores (measured below); Activation confidence = 0% because no dimension produces real data output.

| Axis | Score | Rationale |
|------|-------|-----------|
| Structural Coverage | 25% | Unweighted average of 10 dimension scores: Framework=5%, Concern Intell.=20%, Behavior Engine=80%, Learning Pattern=10%, Reports=20%, Recommendations=15%, Personalization=30%, Longitudinal=0%, Product UX=10%, Commercial=60% |
| Activation Confidence | 0% | 0 LBI scores, 0 framework rows, 0 students, 0 sessions, 0 domain scores, reports fabricated or broken |

## Top 5 Blocking Gaps

### G1 — Framework Not Seeded (CRITICAL BLOCKER)
**Impact**: Blocks entire System B assessment flow — 19 domains, 3 age bands, all questions, all routes.  
**Root cause**: No seed script or migration has been run. Schema is correct, data absent.  
**Evidence**: lbi_domains=0, lbi_subdomains=0, lbi_age_bands=0, lbi_questions=0, lbi_response_scales=0  
**Fix complexity**: Medium — requires domain/subdomain/age-band seed data + question curation  
**Quickest unblock**: Seed just the 19 domain rows + 3 age band rows to make API non-empty (~2 hours)

### G2 — CAPADEX Engine Never Called (HIGH PRIORITY, QUICK WIN)
**Impact**: System A cannot score any user despite 27 existing CAPADEX sessions (9 completed, 5 unique users).  
**Root cause**: `POST /api/lbi/calculate` is never called automatically. No post-completion hook.  
**Evidence**: lbi_scores=0 rows, 27 CAPADEX sessions available  
**Fix complexity**: Low — add a call to calculateLBI() in the CAPADEX session completion hook  
**Quickest unblock**: Admin manually calls `POST /api/admin/lbi/recalculate-all` — would populate 5 lbi_scores rows immediately  
**Security pre-req**: Add auth guards to all 5 lbi-engine routes FIRST

### G3 — Report Infrastructure Broken / Fabricated (CRITICAL — PRODUCT INTEGRITY)
**Impact**: Two of three report paths are broken or hallucinate data.  
**Sub-gaps**:
- `lbi_report_types` + `lbi_subdomain_report_map` tables missing → admin report routes 500
- AI report generation fabricates scores (60–95 hardcoded range in prompt)
- Session results use 4-band hardcoded text (not data-driven)
**Fix complexity**: Low for table creation; Medium for honoring real data in AI reports  
**Quickest unblock**: Create the 2 missing tables; Add a guard on AI reports that blocks generation when no LBI data exists

### G4 — No Longitudinal Layer (HIGH PRIORITY)
**Impact**: Cannot show behavioral progress over time — core product promise broken.  
**Root cause**: lbi_scores is a single UPSERT row; no history table; no snapshot trigger; no trend engine.  
**Fix complexity**: Medium — add lbi_score_history table + insert (not UPSERT) on each calculate  
**Quickest unblock**: ALTER TABLE to add `calculated_at_previous` and `previous_score` columns as a minimal delta record

### G5 — Security: All lbi-engine Admin Routes Unauthenticated (CRITICAL — SECURITY)
**Impact**: Any caller can enumerate all users' LBI scores and emails, trigger bulk recalculation.  
**Evidence**: lbi-engine.ts — 0 requireAuth/requireSuperAdmin calls  
**Fix complexity**: Low — add requireAuth + requireSuperAdmin to 5 routes  
**Note**: This must be fixed BEFORE triggering recalculate-all, or user emails become publicly accessible

## Secondary Gaps

| Gap | Severity | Quick Fix Available |
|-----|----------|-------------------|
| generateInsights() hardcoded 4-band text | Medium | Requires content work |
| No recommendation engine | Medium | Requires data first |
| No personalization pipeline | Medium | Requires framework seeding first |
| 0 behavioural_insights rows (no auto-capture) | Medium | Add capture in session complete hook |
| commercial entitlement not enforced | Medium | Requires framework + payment routing |
| AI report fabrication flag | High | Guard: block if lbi_scores = 0 |

## Coverage by Product Dimension

| Dimension | Structural | Activation |
|-----------|-----------|-----------|
| Framework (domains/questions) | 5% | 0% |
| Assessment flow | 70% | 0% |
| Scoring engine | 80% | 0% |
| Report generation | 20% | 0% |
| Recommendations | 15% | 0% |
| Personalization | 30% | 0% |
| Longitudinal | 0% | 0% |
| Commercial | 60% | 0% |
| Security | 40% | N/A |
