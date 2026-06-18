# WC-P2 — D05: Report Readiness
Generated: 2026-06-10T13:48:42.825Z

## Verdict: ❌ CRITICAL — Reports Either Fabricated or Structurally Broken

Three separate report mechanisms exist. None produces a real data-backed LBI report.

## Report Mechanism 1: System C Session Results (`/api/lbi/sessions/:id/results`)

**Route**: `GET /api/lbi/sessions/:sessionId/results`  
**Status**: Structurally functional, 0 sessions exist  
**Output**: Hardcoded `generateInsights(score, moduleCode)`  

| Band | Insight Text | Module-specific |
|------|-------------|----------------|
| ≥80% | "Excellent performance" + "Continue developing" | M4/M5/M6 branches |
| ≥60% | "Good foundational skills" + "Focus on practice" | M4/M5/M6 branches |
| ≥40% | "Average performance" + "Targeted exercises" | M4/M5/M6 branches |
| <40% | "Needs focused attention" + "Break into goals" | M4/M5/M6 branches |

⚠️ **Insight quality**: 4 hardcoded text strings per band. 16 module codes exist (M1–M16 implied)
but only M4, M5, M6 have specific branches. All other module codes produce generic text.

## Report Mechanism 2: AI Report Generation (`/api/ai-reports/generate`)

**Route**: `POST /api/ai-reports/generate` (no auth guard)  
**Report types**: learning-analysis, behavioral-insights, performance-prediction, exam-readiness, **lbi-comprehensive**  
**Status**: ❌ FABRICATION RISK

The AI prompt for all 5 report types instructs the model to produce:
`"overallScore": number between 60-95`

This is not a floor/ceiling guard on real data — it is an instruction to **hallucinate a score**.
No LBI data feeds the prompt. The AI generates plausible-sounding JSON from name+age+grade only.

⚠️ **OpenAI key available**: NO — reports will 500  
⚠️ If the key is present, the route will happily fabricate LBI comprehensive reports with no real data.

## Report Mechanism 3: Admin Report Types (`/api/lbi/admin/report-types`)

**Route**: `GET /api/lbi/admin/report-types`  
**Status**: ❌ BROKEN — queries `lbi_report_types` and `lbi_subdomain_report_map` which DO NOT EXIST

Executing this route will return a 500 (table does not exist). The tables were
referenced in routes.ts ~11705 but were never created via migration or ensure-schema.

Missing tables:
- `lbi_report_types` — DOES NOT EXIST
- `lbi_subdomain_report_map` — DOES NOT EXIST

## Subscription Package Report Types

The 13 subscription packages declare report types, but these are metadata strings —
no report generation pipeline reads or validates them against any report engine.

| Report Type | Packages | Rows |
|-------------|---------|------|
| Basic | Mini Learning Check, Stress Check, etc. (5 packages) | 5 |
| Detailed | FOUNDATION, PERFORMANCE, READINESS, Transition (4 packages) | 4 |
| Comprehensive | ExamReadiness Index × 3, EDGE (4 packages) | 4 |

## Summary

| Report Path | Status | Issue |
|-------------|--------|-------|
| Session results (`/api/lbi/sessions/:id/results`) | ⚠️ Hardcoded | Generic 4-band text; 0 sessions |
| AI report generation | ❌ Fabrication | Hallucinated scores 60–95, no data |
| Admin report types | ❌ Broken | Missing tables `lbi_report_types` + `lbi_subdomain_report_map` |
