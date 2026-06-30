# 7 · UX Enhancement Matrix

Measured from the dashboard/report/AI-explainability surfaces. UX is **functionally rich with genuinely good
AI transparency**; the enhancement themes are **monolith decomposition, accessibility, mobile, and bundle
weight** — none require redesign.

## Dashboards (current state)
| Dashboard | File | Nav / Mobile | Accessibility | UX debt |
|---|---|---|---|---|
| SuperAdmin | `SuperAdminDashboard.tsx` | tabbed, 50+ panels, lazy-loaded, responsive shell | `role="alert"`, `aria-label` | ~1.5k-line orchestrator (acceptable; lazy-loads panels) |
| Employer Portal | `EmployerPortalPage.tsx` | sidebar + tabbed cockpit, flex mobile | strong (`aria-sort/expanded`, `role=menuitem`) | **critical 10k-line monolith, no in-page splitting** |
| Career Builder | `CareerBuilderPage.tsx` | hub-and-spoke, experience-routed | `aria-busy/live/modal` | **8.7k-line monolith** (decomposition in progress) |
| Parent | `UnifiedParentDashboard.tsx` | cross-child switcher | basic roles | ~2k monolith, cohesive |
| Institute | `UnifiedInstituteDashboard.tsx` | multi-school toggles, shadcn/ui | standard | ~2.5k mid monolith; faculty nested here (see persona PC-1) |
| Student Hub | `StudentDashboard.tsx` | gamified cards, sub-tabs | `role=status`, `aria-label` | heavy local state |

## Reports (current state)
- `report-factory.ts` (dynamic assembly, PDF), `pdf-renderer.ts` (pdfkit, A4, WhiteLabel branding:
  org_name/primary_color/logo_url/footer), `report-pack.ts` (16 builders), `omega-report.ts`,
  `enterprise-analytics.ts`. k-anonymity enforced (`benchmark-engine.ts` cohort suppression). Honest "—" for
  null; "Precise" vs "Domain-proxy" labels. **Reports are close to customer-ready.**

## Enhancement opportunities
| ID | Enhancement | Evidence | Customer/Enterprise impact | Risk | Effort | Priority |
|---|---|---|---|---|---|---|
| UXE-1 | **Decompose the Employer Portal (10.1k) & Career Builder (8.7k) monoliths** into domain modules + route-level code-split | `EmployerPortalPage.tsx`, `CareerBuilderPage.tsx` | faster first load, lower regression risk, maintainability | medium (behavior-preserving) | L | **High** |
| UXE-2 | **WCAG 2.1 accessibility pass**, especially complex data-viz (charts, tables) — ARIA exists but no formal audit | all dashboards | enterprise/government procurement requirement | low | M | **High** |
| UXE-3 | **Mobile QA pass** across the heavy portals (flex layouts exist; verify real device breakpoints) | Employer/Career portals | broader reach, esp. student/parent on mobile | low | M | Medium |
| UXE-4 | **Bundle reduction** — lazy-load >1 MB chunks (index 1.62 MB, CareerBuilder 1.23 MB, EmployerPortal 1.16 MB) | `build` output | TTI at scale | medium | M | High |
| UXE-5 | **Report polish to "customer-ready"** — verify branding/white-label across all 16 builders, add export consistency, ensure honest empty states everywhere | `report-pack.ts` | sellable deliverables | low | M | Medium |
| UXE-6 | **Navigation consistency audit** across persona surfaces (shared nav grammar, breadcrumbs, deep-linking) | nav structure findings | reduced cognitive load | low | M | Medium |
| UXE-7 | **Empty/loading/error-state consistency** — confirm every data surface has explicit loading + error + honest-empty (memory records prior gaps) | memory: ui-certification | trust, polish | low | M | Medium |
| UXE-8 *(= PC-1; counted once in 01 under Persona)* | **Faculty first-class surface** — currently nested in Institute dashboard | `UnifiedInstituteDashboard.tsx` | institutional seat completeness | medium | M | Medium |

## UX enhancement summary
- **Strong now:** AI transparency (confidence intervals, source tags, honest null handling) and the reporting
  factory are genuinely good and should be **protected**.
- **Top moves:** UXE-1 (monolith decomposition + code-split) and UXE-2 (WCAG) are the highest-leverage —
  the first is the platform's biggest maintainability/perf lever, the second is a hard enterprise gate.
- All UX enhancements are **behavior-preserving** (no business-logic change), satisfying the constraint.
