# CAPADEX 2.0 — Phase 1.30: Security Intelligence Constitution (Zero Trust + Identity + Authentication + Authorization + Security Governance + Threat Intelligence + Audit Intelligence)

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Security Intelligence Constitution. **Do not rebuild, do not create a second security engine, do not replace the security architecture, do not create Security V2, do not duplicate security middleware, do not modify business logic, do not activate dormant security capabilities, never bypass Identity / Authentication / Authorization / RBAC / Tenant Isolation / any intelligence engine.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED via **exact `SELECT COUNT(*)`** (live `DATABASE_URL` + repo on 2026-06-28 — **NEVER `n_live_tup`**, per spec); *judgement* = DERIVED. **Security is never a feature; it is a platform capability that protects every intelligence layer.** **Authentication ≠ Authorization ≠ Permission ≠ Role · Identity ≠ User · Session ≠ Identity · Token ≠ Authentication · Encryption ≠ Security · Compliance ≠ Security · Audit ≠ Security · Logging ≠ Monitoring · Monitoring ≠ Detection · Detection ≠ Prevention · Threat ≠ Vulnerability · Risk ≠ Incident · Incident ≠ Breach · Evidence ≠ Confidence · Coverage ≠ Confidence.** built ≠ activated; flag-ON ≠ runtime-active; null ≠ 0. Human remains accountable. Never fabricate; never estimate.
> **Basis:** exact-count audit of the security substrate + Phase 1.29 (RBAC live) + memory (`csrf-protection`, `auth-rate-limiting`, `security-headers-csp`, `password-policy-and-lockout`, `secrets-handling-hygiene`, `audit-log-redaction-unified-trail`, `wc-c8a-security-patterns`, `env-preflight-and-deploy-contract`, `frontend-server-latent-jwt-auth`, `archived-mirror-security-parity`, `email-html-xss-escaping`, `input-validation-pure-gate`, `n-live-tup-stale-population-audit`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.30.

---

## PART 1 — Current Security Intelligence Audit (MEASURED, exact COUNT\*; n_live_tup NOT used)

### Repository implementation (code) — security is middleware-first, not table-first
| Control | Files / source | Class |
|---|---|---|
| CSRF (signed double-submit, default-ON, env kill-switch) | `lib/csrf.ts` | **LIVE** |
| Auth rate limiting (sliding-window, always-ON) | route-level (`auth-rate-limiting`) | **LIVE** |
| Security headers / CSP (helmet, kill-switch) | `services/security-middleware.ts` (`security-headers-csp`) | **LIVE** |
| Password policy + login lockout (complexity + HIBP best-effort) | shared validator (`password-policy-and-lockout`) | **LIVE** |
| MFA / 2FA (super-admin always-gated, Zoho-emailed code) | `mfa_codes` + `routes.ts` (`wc-c8a-security-patterns`) | **LIVE** |
| Env preflight (prod fail-fast on missing secrets) | `lib/env-preflight.ts` (`env-preflight-and-deploy-contract`) | **LIVE** |
| Audit-log redaction + unified trail (redact-at-write) | `services/governance/unified-audit-trail.ts` (`audit-log-redaction-unified-trail`) | **LIVE** |
| Identity / OAuth seam | `routes/firebase-auth.ts` (Google/Microsoft/SSO) | **LIVE (code), provider-keyed** |
| Security center | `routes/security-center.ts` · `routes/employer-security.ts` | **LIVE (code)** |
| Runtime authority transitions | `routes/adaptive-runtime-authority.ts` | **LIVE (code), data 0** |
| Input validation pure-gate (Zod) | `lib/validate` (`input-validation-pure-gate`) | **LIVE** |

### Database population (exact COUNT\*)
| Domain | Table | **Live count** | Class |
|---|---|---|---|
| **Session store (runtime)** | `express_sessions` | **192** | **LIVE (runtime-active)** |
| **Auth failure telemetry** | `rbac_failed_logins` **53** · `auth_login_attempts` **7** | populated | **LIVE (runtime-active)** |
| **MFA / OTP** | `mfa_codes` **12** · `capadex_otps` **1** | populated | **LIVE (runtime-active)** |
| Employer sessions | `employer_sessions` | **3** | **LIVE (small)** |
| **Admin / platform audit** | `admin_audit_logs` **24** · `platform_audit_log` **5** | populated | **LIVE (runtime-active)** |
| Security configurations | `security_configurations` | **0** | **EMPTY** |
| **Security incidents (detection)** | `security_incidents` | **0** | **DORMANT** |
| Threat / risk events | `employer_risk_events` | **0** | **DORMANT** |
| Compliance audit | `compliance_audit_logs` | **0** | **DORMANT** |
| Runtime authority transitions | `runtime_authority_transitions` | **0** | **DORMANT** |
| Alt session / share tokens | `user_sessions` **0** · `cp_share_tokens` **0** | **0** | **EMPTY** |

### Runtime activation · duplicates · broken auth / authz / session / API protection (explicit, per spec PART 1)
- **Runtime activation:** **STRONG preventive floor, dormant detective ceiling.** The *preventive* security stack is genuinely LIVE and runtime-active — an active session store (`express_sessions`=192), real auth-failure telemetry (`rbac_failed_logins`=53, `auth_login_attempts`=7), live MFA/OTP issuance (`mfa_codes`=12, `capadex_otps`=1), and live admin/platform audit (`admin_audit_logs`=24, `platform_audit_log`=5). The *detective* stack — threat detection, security incidents, risk events, compliance audit, runtime authority transitions — is **0 across the board**.
- **Broken authentication / authorization / session / API protection:** **none observed as broken.** Prior structural security gaps were already closed: per-framework admin gate (`per-framework-admin-gate-gap`), `x-user-id` impersonation removed (`frontend-server-latent-jwt-auth`, `archived-mirror-security-parity`), MFA dev-bypass removed (super-admin always 2FA-gated), CSRF mounted first for full `/api` coverage, rate limiting + lockout always-ON, secrets fail-fast in prod. The honest weakness is **unexercised detection/threat-intelligence**, not broken enforcement.
- **Duplicate security middleware:** none harmful — a dormant 2nd Express+JWT app exists (`frontend-server-latent-jwt-auth`, empty `node_modules`, not run by any workflow) and an archived mirror (`archived-mirror-security-parity`) that must receive security fixes in lockstep; both are documented latent surfaces, not active duplicates. `jwt.ts` hardcoded secret in the dormant app remains an open note.
- **Secrets:** secrets live in env / Secret Manager only (`secrets-handling-hygiene`, `env-preflight-and-deploy-contract`); none in source. `OPENAI_API_KEY` absent (AI inert, honest); auth secrets fail-fast in prod.

**CRITICAL HONEST FINDING (MEASURED + DERIVED):** **Security Intelligence is — alongside RBAC (1.29) — the most genuinely-activated layer in the entire MX-700 series, but the activation is concentrated entirely in PREVENTION, not DETECTION.** Every preventive/authentication control is live and runtime-exercised (active sessions 192, failed-logins 53, login attempts 7, MFA codes 12, admin audits 24) and the structural attack surfaces flagged in prior security work are closed. **However, the detective layer is dormant: `security_incidents`=0, `security_configurations`=0, `employer_risk_events`=0, `compliance_audit_logs`=0, `runtime_authority_transitions`=0.** Per the spec's own honesty pair **Detection ≠ Prevention** — and crucially, **0 security incidents does NOT mean "secure"; it means detection is unexercised/unpopulated** (a silent-zero reads as *unmeasured*, never *clean*). **No fabrication:** empty incident/threat/config stores are reported EMPTY/DORMANT, never inferred-safe from the populated auth telemetry; "control coded" (CSRF/CSP/rate-limit middleware) is reported separately from "threat observed" (0); session/MFA runtime is not conflated with threat-detection runtime. Compliance (ISO/SOC/GDPR/DPDP) is **Compliance ≠ Security** — coded scaffolding, not attested certification.

**Strengths (DERIVED):** production-grade preventive security — CSRF, rate limiting, CSP/headers, password policy + lockout, MFA always-gated for super-admin, env-preflight fail-fast, redact-at-write audit, server-authoritative RBAC, input-validation pure-gate, XSS escaping in email/report. **Technical debt / GAPS (DERIVED):** threat detection / security-incident / security-analytics dormant; dormant JWT app with hardcoded secret; archived mirror must stay in security parity; compliance attestation not evidenced; encryption-at-rest is DB/platform-managed (not app-attested). **Dormant:** security incidents, threat/risk events, security configurations, compliance audit, runtime authority transitions, security analytics. **Class legend (per spec):** LIVE · PARTIAL · SEEDED · DORMANT · BROKEN · EMPTY · TECH DEBT · MISSING.

---

## PART 2 — Security Philosophy

Security Intelligence exists to Protect · Authenticate · Authorize · Monitor · Detect · Prevent · Respond · Recover. **It never blocks intelligence, duplicates governance, weakens usability, or bypasses privacy.**

## PART 3 — Security Domain Architecture

Identity · Authentication · Authorization · RBAC · Sessions · Secrets · Encryption · Zero Trust · Threat Intelligence · Audit Intelligence · Security Analytics · Security Monitoring · Security Governance.

## PART 4 — Identity Constitution

Identity remains **the canonical user identity layer.** Protect Identity · Profiles · Federation · Provider mapping · Identity lifecycle. **Never duplicate identity systems.** Binding: identity ONLY from verified token/session; `x-user-id` header-trust removed (`frontend-server-latent-jwt-auth`).

## PART 5 — Authentication Constitution

Protect Password auth · OAuth · Google · Microsoft · SSO · 2FA · MFA · Session creation · Token issuance. **Never bypass authentication.** Binding: `mfa_codes`=12 live; super-admin always 2FA-gated (no `mfaBypassed` path); lockout + rate-limit always-ON; password policy complexity hard-floor + HIBP best-effort.

## PART 6 — Authorization Constitution

Authorization remains **server-authoritative.** Protect RBAC · Permissions · Scopes · Tenant context · Session context · Resource ownership. **Never authorize in frontend only.** Binding: RBAC live (1.29: `role_permissions`=144); dual admin-path gate; classifier lowercases paths.

## PART 7 — Session Constitution

Protect Sessions · Refresh tokens · Access tokens · Expiration · Revocation · Replay protection · Session rotation. Binding: `express_sessions`=192 (active store); `SESSION_SECRET` required in prod (env-preflight fail-fast).

## PART 8 — Zero Trust Constitution

Every request validates Identity · Authentication · Authorization · Tenant · Permission · Context · Resource. **Never trust client state.** Binding: CSRF signed double-submit mounted first (100% `/api` coverage, fail-closed); server-authoritative throughout.

## PART 9 — API Security Constitution

Protect REST · Internal · External APIs · Rate limits · CSRF · CORS · Headers · Validation · Input sanitization. Binding: CSP allowlist (Razorpay/fonts/blob/youtube), `CSP_DISABLED` kill-switch; input-validation pure-gate (never-throws, no req mutation); webhooks fail-closed.

## PART 10 — Secrets Constitution

Protect API keys · JWT secrets · Encryption keys · OAuth secrets · DB credentials · Third-party credentials. **Secrets never exist in source code.** Binding: env/Secret Manager only; prod fail-fast on missing auth secrets; seed/dev scripts print identifiers only, never credential values (`secrets-handling-hygiene`). ⚠️ dormant `jwt.ts` hardcoded secret = open note.

## PART 11 — Encryption Constitution

Protect Passwords · Tokens · Secrets · Sensitive data · PII · Backups · At-rest · In-transit. Binding: password hashing = scrypt (`crypto.hash()` doesn't exist — `wc-c8a-security-patterns`); in-transit TLS via GCP/Firebase; at-rest = platform/DB-managed (not app-attested — honest).

## PART 12 — Security Evidence Constitution

Evidence from Authentication · Authorization · Audit logs · Threat detection · Security monitoring · Security events · Security analytics; contains Source · Coverage · Confidence · Quality. **Never fabricate.**

## PART 13 — Security Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Threat confidence · Risk confidence · Trust. Binding: Coverage ≠ Confidence; 0 incidents = unmeasured, not high-trust.

## PART 14 — Security Explainability Constitution

Every security event explains What happened · Why · Evidence · Risk · Impact · Resolution.

## PART 15 — Threat Intelligence Constitution

Protect Threat detection · Classification · Severity · Timeline · Correlation · Incident mapping. Binding: `security_incidents`=0 / `employer_risk_events`=0 — **DORMANT (first activation lever);** Detection ≠ Prevention.

## PART 16 — Audit Intelligence Constitution

Protect Audit logs · Admin audit · Platform audit · RBAC audit · Enterprise audit · Immutable history. **Audit history remains append-only.** Binding: `admin_audit_logs`=24 + `platform_audit_log`=5 live; redact-at-write; `compliance_audit_logs`=0.

## PART 17 — Security Analytics Constitution

Measure Authentication · Authorization · Threats · Incidents · Failures · Success rate · Attack patterns. Binding: auth-failure data exists (`rbac_failed_logins`=53) but no analytics rollup yet.

## PART 18 — Security Observability Constitution

Monitor Authentication · Authorization · Latency · Security events · Failures · Threats · Rate limits · Secrets. Binding: failed-logins + audit live; threat/incident streams 0 — silent-zero = unmeasured.

## PART 19 — Security AI Constitution

**AI explains · classifies · summarizes · prioritizes. Never approves security actions, never changes security policy. Human approval mandatory.** Cross-ref 1.28 (AI runtime dormant).

## PART 20 — Enterprise Security Constitution

Support Compliance · ISO · SOC · GDPR · DPDP · Audit · Governance. Binding: Compliance ≠ Security; scaffolding present, attestation not evidenced; `threat_model.md` via threat-modeling skill.

## PART 21 — SuperAdmin Security Constitution

Support Security policies · Identity · RBAC · Secrets · Monitoring · Incident review. Binding: SuperAdmin single canonical admin layer, always 2FA-gated.

## PART 22 — Security Testing Constitution

Standardize Authentication · Authorization · RBAC · CSRF · CSP · Session · Penetration · Regression tests. Binding: isolation suite (`test:isolation`); CSRF/rate-limit smoke `{401,403,429,503}`; pen-test = open.

## PART 23 — Security Documentation

Maintain Security catalog · Threat catalog · Identity guide · RBAC guide · Security API guide · Incident guide. SSOT: `docs/SUPERADMIN.md` + `.agents/memory/*` security topics + `threat_model.md`.

## PART 24 — Security Governance

Every enhancement answers: Why is Security changing? · What existing capability is reused? · Does this duplicate Security Intelligence? · Does this preserve Zero Trust? · Does this preserve RBAC?

## PART 25 — Security Quality Gates

Verify Authentication reused · Authorization reused · RBAC reused · Tenant isolation preserved · Secrets protected · Evidence exposed · Confidence exposed · Documentation updated.

## PART 26 — Security Review Board

```
Founder[ ] ChiefSecurityArchitect[ ] PlatformArchitect[ ] EnterpriseArchitect[ ] RBACArchitect[ ] ComplianceLead[ ] SecurityOps[ ]
Research[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 27 — Security Definition of Done

- [ ] Authentication preserved · [ ] Authorization preserved · [ ] RBAC preserved · [ ] Sessions protected · [ ] Secrets protected · [ ] Evidence exposed · [ ] Confidence exposed · [ ] Documentation updated · [ ] No regressions.

## PART 28 — Security Maturity Model

| Component | Current (DERIVED, exact-count) | Target |
|---|---|---|
| Identity | L3 Adaptive (sessions + OAuth seam live) | L4 Intelligent |
| Authentication | **L4 Intelligent** (password+MFA+lockout+rate-limit live) | L5 Continuous Zero Trust |
| Authorization | **L4 Intelligent** (RBAC live, server-authoritative) | L5 Continuous Zero Trust |
| RBAC | **L4 Intelligent** (144 perms — 1.29) | L5 Continuous Zero Trust |
| Secrets | L3 Adaptive (env/Secret Mgr, fail-fast) | L4 Intelligent |
| Encryption | L2 Guided (scrypt + TLS; at-rest platform-managed) | L4 Intelligent |
| Threat Detection | L1 Operational (`security_incidents`=0) | L4 Intelligent |
| Security Analytics | L1 Operational (no rollup) | L3 Adaptive |
| Observability | L2 Guided (failed-logins + audit live; threat stream 0) | L4 Intelligent |

Levels: 1 Operational · 2 Guided · 3 Adaptive · 4 Intelligent · 5 Continuous Zero Trust Security — **human approval ALWAYS mandatory.** **Roadmap (separate approved phases):** activate threat detection / security-incident capture (lift the dormant detective layer — make 0 mean *measured-zero*, not *unmeasured*) → add security analytics rollups over the live auth-failure data → seed `security_configurations` + compliance audit → remediate the dormant JWT app hardcoded secret + keep the archived mirror in parity → pursue ISO/SOC/GDPR/DPDP attestation (Compliance ≠ Security) → keep ONE security architecture, Zero Trust, server-authoritative authz, secrets out of source, human approval mandatory.

## PART 29 — Security Scientific Validation

Document Zero Trust · Identity architecture · Access control · Cryptography · Threat modeling · Security engineering · Risk management · Privacy engineering · Compliance.

## PART 30 — Security Evolution Strategy

Future evolution supports New identity providers · authentication models · security policies · threat engines · security analytics · compliance standards — **without breaking** Assessment · Behaviour · Concern · Competency · Decision · Learning · Career · Intervention · Report · Analytics · AI · Enterprise Intelligence. (Additive + flag-gated; byte-identical flag-OFF; Zero Trust + RBAC never bypassed.)

---

## PART 31 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Security Intelligence Constitution | all | 15 | Audit Intelligence Constitution | P16 |
| 02 | Repository Security Audit | P1 | 16 | Security Analytics Constitution | P17 |
| 03 | Identity Constitution | P4 | 17 | Security Observability Constitution | P18 |
| 04 | Authentication Constitution | P5 | 18 | Security AI Constitution | P19 |
| 05 | Authorization Constitution | P6 | 19 | Enterprise Security Constitution | P20 |
| 06 | Session Constitution | P7 | 20 | SuperAdmin Security Constitution | P21 |
| 07 | Zero Trust Constitution | P8 | 21 | Security Governance Constitution | P24 |
| 08 | API Security Constitution | P9 | 22 | Security Quality Gates | P25 |
| 09 | Secrets Constitution | P10 | 23 | Security Review Board | P26 |
| 10 | Encryption Constitution | P11 | 24 | Security Definition of Done | P27 |
| 11 | Security Evidence Constitution | P12 | 25 | Security Scientific Validation | P29 |
| 12 | Security Confidence Constitution | P13 | 26 | Security Evolution Strategy | P30 |
| 13 | Security Explainability Constitution | P14 | 27 | Security Maturity Assessment | P28 |
| 14 | Threat Intelligence Constitution | P15 | | | |

---

**STOP — Phase 1.30 complete; Security Intelligence Constitution ready to FREEZE on approval. Security architecture not modified, Authentication / Authorization / RBAC not replaced, no second security engine created, no dormant security capabilities activated, business logic not changed, Identity / Authentication / Authorization / Tenant Isolation / no intelligence engine bypassed.**
Honesty caveats: counts are MEASURED via exact `SELECT COUNT(*)` from the live shared Postgres today (`n_live_tup` NOT used, per spec). **Security is among the two most genuinely-activated layers in the series — but activation is concentrated in PREVENTION, not DETECTION.** Preventive/auth controls are live and runtime-exercised (`express_sessions`=192, `rbac_failed_logins`=53, `mfa_codes`=12, `admin_audit_logs`=24) and prior structural attack surfaces are closed; the detective layer is dormant (`security_incidents`/`security_configurations`/`employer_risk_events`/`compliance_audit_logs`/`runtime_authority_transitions`=0). Detection ≠ Prevention; **0 incidents = unmeasured, never "secure"**; control-coded ≠ threat-observed; Compliance ≠ Security (scaffolding, not attestation); secrets never in source; human remains accountable.
