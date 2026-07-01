# 13 · Report Intelligence Blueprint (Layer 10)

**Mode:** Read-only / planning-only. No changes. **Layer status: SUPPORTED.**

## Canonical Definition
Report Intelligence assembles interpreted results into audience-specific, multi-format, multi-language reports: dynamic builder, personalized reports (student/parent/teacher/HR/manager/leadership/organization), PDF/HTML/API delivery. Primary implementation: the **Report Factory** — `services/report-factory-schema.ts` (`rf_*` tables), `dynamic-report.ts`, `report-pack.ts`, `pdf-renderer.ts`, and `frontend/src/components/superadmin/ReportFactoryPanel.tsx`.

## Capability Evidence
| Capability | Status | Repository Evidence |
| :-- | :-- | :-- |
| Dynamic Report Builder | SUPPORTED | `report-factory-schema.ts` (`rf_templates`, `rf_template_sections`); `ReportFactoryPanel.tsx` templates tab. |
| Personalized Reports | SUPPORTED | `dynamic-report.ts` adapts by persona + session (score/stage). |
| Student Reports | SUPPORTED | `dynamic-report.ts` (persona `student`). |
| Parent Reports | SUPPORTED | `dynamic-report.ts` (persona `parent`). |
| Teacher Reports | SUPPORTED | `dynamic-report.ts` (persona `teacher`/`counsellor`). |
| HR / Manager / Leadership / Organization Reports | SUPPORTED | `report-pack.ts` (executive summary, candidate comparison); `routes/enterprise-analytics.ts` org intelligence. |
| PDF | SUPPORTED | `pdf-renderer.ts` (pdfkit; branding/white-label). |
| HTML | SUPPORTED | `pdf-renderer.ts` `renderReportToHTML` (branded HTML preview). |
| API | SUPPORTED | `routes/report-factory.ts` (`/api/rf/*`); `routes/dynamic-report.ts` (`/api/reports/dynamic/*`). |
| Multi-language | SUPPORTED | `rf_language_packs` (en, hi, ta, te, bn, mr, ar, fr, de); `ReportFactoryPanel.tsx` languages tab. |

## Report Integrity
- **k-suppression flows into reports:** benchmark sections respect k=30 masking, so a report never shows a fabricated cohort percentile.
- **White-labeling:** `rf_white_label_configs` supports tenant branding across PDF/HTML.
- **Multi-audience by design:** one interpretation → many audience-shaped reports (student vs parent vs HR), consistent with the one-assessment-many-lenses principle.
- **XSS-safe:** report/email HTML escapes all user/AI-authored interpolation (see platform email XSS convention).

## Gaps
None at Layer 10.

## Freeze Position
**FREEZE.** The Report Factory (`rf_*` schema + dynamic-report + report-pack + pdf-renderer) is the canonical report framework. New report audiences/formats extend the factory, never a parallel renderer.
