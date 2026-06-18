# WC-P2 — D12: 95% Completion Roadmap
Generated: 2026-06-10T13:48:42.831Z

## Starting Point: 25% Structural / 0% Activation

To reach 95% product readiness, six ordered phases are required.

---

## Phase A — Security + Quick Win Scores (Day 1–2, Effort: S)
**Goal**: Close security gaps and generate first real LBI scores immediately.

### A1: Auth-gate all lbi-engine routes (MUST BE FIRST)
Add `requireAuth` + `requireSuperAdmin` to all 5 routes in `backend/routes/lbi-engine.ts`:
- POST /api/lbi/calculate
- GET /api/admin/lbi/profiles
- GET /api/admin/lbi/profiles/:email
- POST /api/admin/lbi/recalculate-all
- GET /api/admin/lbi/analytics

### A2: Trigger System A recalculation for existing users
After A1: call POST /api/admin/lbi/recalculate-all → 5 lbi_scores rows generated
- Populates LBI admin panel immediately
- Provides real behavioral intelligence for 5 existing CAPADEX users
- Activates learning style classification for early users

### A3: Wire calculateLBI() into CAPADEX completion hook
In `routes/capadex.ts` POST /api/capadex/sessions/:id/complete, add:
```typescript
// After session marked complete:
if (session.guest_email) {
  calculateLBIForEmail(session.guest_email).catch(() => {}); // fire-and-forget
}
```

**Phase A delivers**: First real LBI scores, security closed, engine auto-running.

---

## Phase B — Framework Seeding (Days 3–7, Effort: M)
**Goal**: Populate the psychometric framework so System B API routes return real data.

### B1: Domain + subdomain seed
Insert 19 domain rows (D01–D19) + ~70 subdomain rows into lbi_domains / lbi_subdomains.
Data is defined in frontend LBIProductPage.tsx DOMAINS constant — lift and seed.

### B2: Age band seed
Insert 3 age band rows (A: 6–10, B: 11–14, C: 15–18) + response scale definitions.

### B3: Minimum question seed (per domain × per age band)
Target: 5 questions per domain × 3 age bands = 285 minimum viable questions.
Full spec: 800+ questions. Phase B delivers MVP (5/domain); Phase D delivers full bank.

### B4: Scoring rules seed
Insert domain weightage rules (19 rows). Enable POST /api/lbi/calculate-score.

**Phase B delivers**: All System B API routes return real data. Assessment flow unblocked.

---

## Phase C — Report Repair (Days 8–12, Effort: M)
**Goal**: Fix broken report infrastructure and guard against AI fabrication.

### C1: Create missing tables
```sql
CREATE TABLE lbi_report_types (type_code text PRIMARY KEY, name text, description text);
CREATE TABLE lbi_subdomain_report_map (report_type_code text, subdomain_code text, weight real);
```
Seed 4 report types (learning-analysis, behavioral-insights, performance-prediction, exam-readiness).

### C2: Guard AI report generation
Add check in POST /api/ai-reports/generate: if reportType='lbi-comprehensive' AND lbi_scores count=0,
return 503 with `{ error: "No LBI data available for this user" }`.

### C3: Improve generateInsights()
Replace 4-band hardcoded text with domain-specific insight map (19 domain codes × 4 bands = 76 strings).
This is content work, not engineering.

### C4: Data-backed report for System A
Add GET /api/lbi/my-report (requireAuth) that returns lbi_scores + score_trace for the
authenticated user — a real data-backed report without AI dependency.

**Phase C delivers**: Reports are either real-data-backed or properly blocked.

---

## Phase D — Longitudinal Layer (Days 13–18, Effort: M)
**Goal**: Track LBI progression over time.

### D1: Create lbi_score_history table
```sql
CREATE TABLE lbi_score_history (
  id SERIAL PRIMARY KEY,
  user_email text NOT NULL,
  overall_lbi real, consistency_score real, persistence_score real,
  attention_score real, adaptability_score real, velocity_score real,
  learning_style text, sessions_analyzed int, score_trace jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON lbi_score_history(user_email, calculated_at DESC);
```

### D2: INSERT instead of UPSERT for history
Change calculateLBI() to also INSERT into lbi_score_history (keep lbi_scores UPSERT for latest).

### D3: Trend endpoint
Add GET /api/lbi/my-trend (requireAuth) → returns lbi_score_history for the user,
ordered by calculated_at, for visualization of change over time.

**Phase D delivers**: LBI becomes a longitudinal behavioral intelligence product.

---

## Phase E — Personalization + Recommendations (Days 19–28, Effort: L)
**Goal**: Make LBI recommendations data-driven and age-band personalized.

### E1: Recommendation library
Create a recommendation content set: 19 domains × 4 score bands × 3 age bands = 228 entries.
Table: lbi_recommendations (domain_code, age_band, score_band, text).

### E2: Auto-capture behavioural_insights from System A scores
When calculateLBI() fires, insert rows into behavioural_insights for each dimension
scored. This populates the AI test personalization context automatically.

### E3: Age-band question routing
Ensure POST /api/lbi/sessions (System C) passes child.age through to question selection
with age_band_id filter — functional once questions are seeded.

**Phase E delivers**: Personalized recommendations, AI test context populated.

---

## Phase F — Commercial Activation (Days 29–40, Effort: L)
**Goal**: Wire subscription packages to assessment delivery.

### F1: LBI payment ledger
Add `lbi_payments` table or extend capadex_payments with a product_type discriminator.

### F2: Entitlement enforcement
POST /api/lbi/sessions check: user must have active student subscription for the
package covering the requested assessment module.

### F3: Report delivery gate
GET /api/lbi/sessions/:id/results gated on subscription ownership.

**Phase F delivers**: Paid product viable.

---

## Summary Table

| Phase | Effort | Delivers | Coverage After |
|-------|--------|---------|---------------|
| A: Security + Quick Scores | 2 days | 5 real LBI scores, engine auto-running | ~25% |
| B: Framework Seeding | 5 days | All System B API routes real data, assessment flow | ~45% |
| C: Report Repair | 5 days | Reports backed by real data or properly blocked | ~60% |
| D: Longitudinal | 6 days | Trend tracking, progress over time | ~75% |
| E: Personalization | 10 days | Data-driven recommendations, age-band routing | ~87% |
| F: Commercial | 12 days | Paid product viable, entitlement enforced | ~95% |

**Total estimated effort: ~40 engineering days (excludes content/question curation)**

## Content Work (Parallel, Not Engineering)
- 285 minimum viable questions (5/domain × 3 age bands) — content team
- 228 recommendation texts (19 domains × 4 bands × 3 age bands) — content team  
- 19 domain + ~70 subdomain descriptions — can be lifted from product page
