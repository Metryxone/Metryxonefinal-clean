# WC-C4 · Deliverable 2 — Protected Surface Matrix (post-enforcement)
_Generated 2026-06-10T07:29:55.423Z. Re-parsed from routes/capadex.ts SOURCE — a canonical path missing the gate is a hard GAP._

**14/14** canonical paid surfaces now carry the `requireEntitlement` gate.

| Method | Endpoint | Session param | capadex.ts line | Gate applied |
|---|---|---|---|---|
| GET | `/api/capadex/report/:session_id` | `session_id` | 3370 | ✅ yes |
| GET | `/api/capadex/report/:session_id/pdf` | `session_id` | 3558 | ✅ yes |
| POST | `/api/capadex/report/:session_id/send-email` | `session_id` | 3758 | ✅ yes |
| GET | `/api/capadex/session/:id/explain` | `id` | 2613 | ✅ yes |
| GET | `/api/capadex/session/:id/grounding` | `id` | 2654 | ✅ yes |
| GET | `/api/capadex/session/:id/guidance` | `id` | 2631 | ✅ yes |
| GET | `/api/capadex/session/:id/omega-x` | `id` | 2574 | ✅ yes |
| GET | `/api/assessment/session/:id/omega-x` | `id` | 2577 | ✅ yes |
| GET | `/api/capadex/session/:id/patterns` | `id` | 2600 | ✅ yes |
| GET | `/api/capadex/session/:id/pipeline` | `id` | 2721 | ✅ yes |
| GET | `/api/capadex/session/:id/report` | `id` | 3047 | ✅ yes |
| GET | `/api/capadex/session/:id/reports` | `id` | 3088 | ✅ yes |
| GET | `/api/capadex/session/:id/signals` | `id` | 2590 | ✅ yes |
| GET | `/api/capadex/session/:id/stage` | `id` | 2744 | ✅ yes |

> All canonical paid surfaces (incl. the `/api/assessment/.../omega-x` alias) are guarded.
