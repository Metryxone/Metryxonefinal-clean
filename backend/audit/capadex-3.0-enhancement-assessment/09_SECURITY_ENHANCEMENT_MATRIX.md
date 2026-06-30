# 9 · Security Enhancement Matrix

**Honesty:** Security is one of the platform's **strongest** areas — controls are present, default-ON, and
fail-closed. Enhancements are **hardening and verification**, not gap-filling.

## Measured controls present (strong)
- **CSRF:** signed double-submit, default-ON (kill-switch `CSRF_PROTECTION_DISABLED`), mounted first, fails
  closed, frontend fetch monkey-patch covers all calls.
- **Rate limiting:** sliding-window on login/register/mfa-verify/mfa-resend, always-on, trust-proxy=1.
- **Auth:** scrypt hashing, MFA always-gated for super-admin (no password-only path, dev bypass removed),
  login lockout always-on.
- **Headers:** helmet CSP allowlisting Razorpay/Google Fonts/blob/youtube; kill-switch `CSP_DISABLED`.
- **Password policy:** shared validator (complexity always-on hard floor ⟂ HIBP best-effort fail-open),
  prod fail-fast on weak seed-admin pw.
- **Audit logging:** write-time redaction through shared `redactJson`; unified read surfaces metadata-only.
- **Input validation:** Zod pure-gate (`lib/validate`), never-throws, coverage tracker exists.
- **XSS:** backend email/report HTML escaping of all user/AI interpolation.
- **Env preflight:** prod boot aborts on missing `SESSION_SECRET`/`DATABASE_URL`.
- **Per-framework admin gate:** structural 2nd mount closing `/api/<fw>/admin/*`.

## Enhancement opportunities
| ID | Enhancement | Evidence | Impact | Risk | Effort | Priority |
|---|---|---|---|---|---|---|
| SE-1 | **Production demo-mode lockout** — ensure payment/demo fallbacks (Razorpay demo, `@example.com` seeds, default `UPLOAD_SERVICE_TOKEN` placeholder) are disabled/replaced in prod | replit.md deploy notes; commercial memory | prevents fake-payment / weak-token exposure | medium | S | **Launch Critical** |
| SE-2 | **Run the security scan suite pre-launch** (dependency audit + SAST + secrets scan) and triage criticals/highs | `security_scan` skill | known-vuln/secret-leak assurance for buyers | low | S | **High** |
| SE-3 | **Remove residual hardcoded secrets/bypasses in latent/mirrored code** — `frontend/server` JWT hardcoded secret; archived mirror parity | memory: frontend-server-latent-jwt, archived-mirror | eliminate latent bypass even if dormant | low | S | High |
| SE-4 | **Secret rotation evidence** — presence ≠ rotation; record rotation of session/DB/LLM secrets before go-live | memory: launch-validation-evidence | enterprise compliance | low | S | Medium |
| SE-5 | **Penetration test / threat-model refresh** (threat_modeling skill exists) on auth, multi-tenant isolation, IDOR | `threat_modeling` skill; tenant-scope memory | external assurance | medium | M | Medium |
| SE-6 | **Multi-tenant isolation regression tests** in CI (isolation workflow already exists — promote to a gate) | `isolation` workflow | prevent cross-tenant leakage regressions | low | M | Medium |
| SE-7 | **DPDP/consent completeness audit** for minors (student/parent consent flows) | parents/consent tables | India data-law compliance | medium | M | High |

## Security enhancement summary
The security **foundation is enterprise-grade and fails closed**. The only **launch-critical** item is
**SE-1** (make sure no demo/placeholder credential path is live in production). **SE-2** (run the scanners)
and **SE-7** (DPDP/minor-consent) are the next priorities. Nothing here requires new architecture — it is
verification, rotation evidence, and disabling dev fallbacks in prod.
