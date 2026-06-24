# MX-77X · Section 12 — Employee Workforce UI (design, not built this phase)

**Status:** DESIGN ONLY. The employee/candidate already has rich career surfaces; this section maps
how the workforce stack reaches the individual without violating privacy or language policy.

## Existing individual substrate (already live)
- **Career Builder** (`CareerBuilderPage.tsx`) — readiness, gap, roadmap, match, recommendation
  (Career Intelligence Phase 4.x).
- **Employability Passport** — published snapshot; **contact NEVER published**.
- **Per-subject readiness trends** — `career_readiness_history` (the only longitudinal individual
  signal the workforce console reads; needs ≥2 points or abstains).

## Reachable employee workforce views (when surfaced)
| View | Source | Employee value |
|---|---|---|
| My readiness trend | `career_readiness_history` | personal readiness over time (≥2 points) |
| My skill gaps | competency runtime + role target | development focus (not a verdict) |
| My mobility options | mobility/career-path tables | internal target roles + readiness gap |
| Future-readiness | obsolescence / emergence | AI-exposure / durability signal for my role |

## Honesty + privacy constraints (must carry into any employee build)
- **Developmental, never evaluative** — no ranking against peers shown to the individual; cohort data
  is k-anon aggregate-only.
- **Self-scope only** — `resolveEffectiveUserId` IDOR guard; an employee sees only their own data.
- **null = missing** — an unmeasured readiness trend says "insufficient history", never 0.
- **No fabricated accuracy** — predictive signals shown as direction + confidence, never "X% likely".

## Reachability ceiling
- The individual surface is fed by the SAME composer; anything the org-level views abstain on
  (department, enterprise readiness) is equally absent at the individual level — disclosed, not faked.
