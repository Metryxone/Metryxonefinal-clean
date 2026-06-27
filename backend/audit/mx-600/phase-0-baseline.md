# MX-600 — Enterprise End-to-End Platform Audit & Launch Certification
## Phase 0 — Baseline, Inventory & Environment Health

**Date:** 2026-06-27
**Scope:** Establish an honest, evidence-backed starting baseline for the whole platform before any subsystem-level audit. No product code changed. Read-only.

> **Honesty note (founder preference):** This is the **development/workspace** environment on the **shared** Postgres. Dev is lightly populated by design — empty counts below are reported as honest "no data yet", **never** inflated. Production (GCP Cloud Run + Firebase) is a separate topology and is certified separately in the launch phase.

---

### 1. Service health (evidence: live HTTP probes)

| Service | Process | Endpoint | Result |
|---|---|---|---|
| Node API (`backend/`, :8080) | tsx running | `GET /api/health` | **200** `{"status":"ok","uptime_s":12889}` — 5ms |
| Frontend (`frontend/`, :5000) | vite running | `GET /` | **200** — renders cleanly (screenshot captured) |
| FastAPI upload (`backend-main/`, :8000) | uvicorn running | `GET /docs` / `GET /health` | **200 / 200** (root `/` is 404 by design — no root route) |

All three workflow services are **RUNNING and reachable**. Landing page renders with full nav, hero, and live CAPADEX stage-analysis demo card (visual evidence on file).

### 2. Database scale (evidence: live SQL on shared DB)

| Metric | Value | Reading |
|---|---|---|
| `public` tables | **1,426** | Very large surface area — confirms the breadth this audit must cover |
| `users` | 4 | Dev only (super-admin + test) |
| `capadex_sessions` | 0 | Honest empty — no completed CAPADEX runs in dev |
| `career_seeker_profiles` | 3 | Dev test profiles |

**Implication for the audit:** many engines are *correctly* abstaining / empty in dev. The audit must distinguish **Structural** (code/route/schema exists and behaves) from **Activation/Adoption** (real data flowing) and never composite them — consistent with prior certification discipline.

### 3. Feature-flag posture (evidence: live `/enabled` probes)

| Surface | State (dev) |
|---|---|
| `career-discovery` | enabled |
| `campus-placement` | enabled |
| `validation-loop` | enabled |
| `career/experience` (Launchpad) | **503 — OFF** |
| `student-career-builder` | OFF |
| `employability-studio` | OFF |
| `enterprise-workforce-console` | 503 — OFF |
| `ecosystem` | 404 (flag default OFF) |

Flag-OFF surfaces returning 503/404 is the **expected byte-identical-OFF contract**. The Backend API workflow boots with a large `FF_*=1` set (see workflow command) — the audit will reconcile *workflow-enabled* vs *truly-activated* per phase.

### 4. Known environment caveats (not production-blocking)

- **`mockup-sandbox` workflow: FAILED** — `Cannot find package 'fast-glob'` (ERR_MODULE_NOT_FOUND). This is the known dev-canvas hoisted-deps prune trap; it affects only the Canvas component-preview tooling, **not** the product. Documented in memory.
- **Vite HMR "server connection lost" flapping** — known mockup-sandbox port-hijack interaction; dev-only, does not affect built/prod frontend.

### 5. Recent merge activity (context)

Last 12 merges are concentrated on the **A→I Career Launchpad** chain (MX-302C dashboard, MX-302J cert, Career Discovery NOT-NULL fix, validation-loop outcome capture, frontend test repair). The platform is in active hardening — a good moment for a whole-product certification pass.

---

## Verdict — Phase 0

**BASELINE ESTABLISHED ✅ (environment healthy).** No blockers to proceeding. All three services up, DB reachable, frontend renders. Dev data is honestly sparse; certification will keep Structural ⟂ Activation separate throughout.

---

## Proposed MX-600 Phase Roadmap (for Founder approval)

Each phase is **read-only audit first**, produces evidence (screenshots / API / DB / logs / perf / gap report) into `backend/audit/mx-600/`, and **STOPS for your approval**. New code is written **only** to fix a critical gap the audit surfaces — and that fix is itself flag-gated/additive and re-approved.

| Phase | Title | What it certifies |
|---|---|---|
| **0** | Baseline & Inventory | *(this document — done)* |
| **1** | Identity, Auth & Access Control | Login, super-admin 2FA, RBAC/admin gates, session, CSRF, rate limiting, IDOR guards |
| **2** | CAPADEX Assessment E2E | Public assessment → clarity → questions → report → register → OTP; report tone/canon |
| **3** | Career Builder · Discovery · Launchpad | Student journey end-to-end (the area most recently changed) |
| **4** | Competency Assessment & Ontology | Question selection, scoring ledger, `onto_*` genome authority |
| **5** | Employer / Hiring Ecosystem | Job posting → assessment → interview → offer; TIG calibration |
| **6** | Commercial · Entitlement · Payments | Packages, entitlement enforcement, Razorpay/payment spine (fail-closed) |
| **7** | Super Admin · Governance · Reports | Admin console, RBAC v2, report factory, governance/audit trail |
| **8** | Security Posture | Headers/CSP, XSS escaping, audit-log redaction, secrets hygiene, preflight |
| **9** | Performance & Reliability | Latency baselines, hot endpoints, failure modes, degradation |
| **10** | Launch Certification | Compose all phase verdicts into one dual-axis (Structural ⟂ Activation/Adoption) launch cert — production-readiness withheld unless honestly earned |

**Recommended next:** Phase 1 (Identity, Auth & Access Control) — the security-critical foundation everything else depends on.
