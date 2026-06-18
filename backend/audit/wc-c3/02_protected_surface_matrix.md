# WC-C3 · Deliverable 2 — Protected Surface Matrix
_Generated 2026-06-10T06:54:23.489Z. Systematic static enumeration of the live route surface (143 files, 1941 routes), classified by what guards each surface._

## Guard distribution (whole surface)
| Guard | Count |
|---|---|
| RBAC inline (`requireAuth`/`requireSuperAdmin`/`requireAdmin` as args) | 796 |
| RBAC spread (`...adminChain` / `...adminGuards` → file-local guard array) | 49 |
| RBAC global (covered by `app.use('/prefix', ...guards)`) | 94 |
| **ENTITLEMENT (tier guard)** | **0** |
| none detected (middleware-level) | 1002 |

Global RBAC prefixes found: `/api/admin/bios/runtime-state` · `/api/admin/iil` · `/api/admin/nhda`.

> **Static-analysis limitation:** this is middleware-level detection. In-handler auth checks are not inspected (except the confirmed sample below). A `none` on a public/consumer route is **not** necessarily a gap — the RBAC finding is scoped to `/api/admin/*`, which the codebase convention expects to be guarded.

## Paid-tier CAPADEX surface (the ENTITLEMENT axis) — re-derived fresh from capadex.ts
Every one of these serves paid-tier content with **no entitlement guard and no RBAC** — only a session UUID (+ runtime flag):

| Method | Endpoint | Location | Runtime flag | RBAC | Entitlement |
|---|---|---|---|---|---|
| GET | `/api/capadex/report/:session_id` | routes/capadex.ts:3360 | no | none | none |
| GET | `/api/capadex/report/:session_id/pdf` | routes/capadex.ts:3548 | no | none | none |
| POST | `/api/capadex/report/:session_id/send-email` | routes/capadex.ts:3748 | no | none | none |
| GET | `/api/capadex/session/:id/explain` | routes/capadex.ts:2603 | yes | none | none |
| GET | `/api/capadex/session/:id/grounding` | routes/capadex.ts:2644 | no | none | none |
| GET | `/api/capadex/session/:id/guidance` | routes/capadex.ts:2621 | yes | none | none |
| GET | `/api/capadex/session/:id/omega-x` | routes/capadex.ts:2565 | no | none | none |
| GET | `/api/capadex/session/:id/patterns` | routes/capadex.ts:2590 | no | none | none |
| GET | `/api/capadex/session/:id/pipeline` | routes/capadex.ts:2711 | no | none | none |
| GET | `/api/capadex/session/:id/report` | routes/capadex.ts:3037 | yes | none | none |
| GET | `/api/capadex/session/:id/reports` | routes/capadex.ts:3078 | yes | none | none |
| GET | `/api/capadex/session/:id/signals` | routes/capadex.ts:2580 | no | none | none |
| GET | `/api/capadex/session/:id/stage` | routes/capadex.ts:2734 | no | none | none |

## Payment transaction surface (correctly public)
| Endpoint | Protection | Verdict |
|---|---|---|
| `POST /api/capadex/payment/create-order` | none (order precedes payment) | correct for a gateway |
| `POST /api/capadex/payment/verify` | HMAC signature check in handler | correct |
| `POST /api/capadex/payment/webhook` | webhook signature check in handler | correct |

## Admin surface (RBAC axis — separate from entitlement)
- `/api/admin/*` routes total: **623** · with RBAC guard: **411** · **no guard detected: 212**.
- Sample of unguarded admin routes (static detection):

| Method | Endpoint | Location |
|---|---|---|
| GET | `/api/admin/bios/signals/dashboard` | routes/behavioural-signals.ts:144 |
| GET | `/api/admin/bios/signals/profiles` | routes/behavioural-signals.ts:181 |
| GET | `/api/admin/bios/signals/profiles/:email` | routes/behavioural-signals.ts:212 |
| GET | `/api/admin/bios/agents/status` | routes/bios-agents.ts:75 |
| GET | `/api/admin/bios/agents/events` | routes/bios-agents.ts:87 |
| GET | `/api/admin/bios/population` | routes/bios-agents.ts:160 |
| GET | `/api/admin/bios/federated/norms` | routes/bios-agents.ts:173 |
| GET | `/api/admin/bios/neuro-symbolic/dashboard` | routes/bios-frontier.ts:82 |
| GET | `/api/admin/bios/frontier/dashboard` | routes/bios-frontier.ts:194 |
| GET | `/api/admin/bios/self-healing/log` | routes/bios-frontier.ts:208 |
| GET | `/api/admin/bios/emergent-patterns` | routes/bios-frontier.ts:218 |
| GET | `/api/admin/bios/causal-chains` | routes/bios-frontier.ts:226 |
| GET | `/api/admin/bios/fusion/dashboard` | routes/bios-fusion.ts:193 |
| GET | `/api/admin/bios/latent-traits` | routes/bios-fusion.ts:211 |
| GET | `/api/admin/bios/meta-learning` | routes/bios-fusion.ts:224 |
| GET | `/api/admin/bios/phase-transitions` | routes/bios-fusion.ts:238 |
| GET | `/api/admin/bios/simulations` | routes/bios-simulation.ts:75 |
| GET | `/api/admin/bios/simulations/:id` | routes/bios-simulation.ts:87 |
| GET | `/api/admin/bios/economics` | routes/bios-simulation.ts:131 |
| GET | `/api/admin/bios/knowledge-graph/overview` | routes/bios-simulation.ts:189 |
| GET | `/api/admin/bios/ethics/audit-log` | routes/bios-simulation.ts:231 |
| GET | `/api/admin/capadex/users` | routes/capadex-enterprise.ts:767 |
| GET | `/api/admin/capadex/users/:id/journey` | routes/capadex-enterprise.ts:814 |
| GET | `/api/admin/capadex/analytics` | routes/capadex-enterprise.ts:858 |

…and 188 more (full list in `_wc_c3_snapshot.json` → admin_rbac_gap.by_file).
