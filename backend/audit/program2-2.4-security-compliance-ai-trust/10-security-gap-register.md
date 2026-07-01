# 10 · Security Gap Register

Severity: **Launch-Critical** (blocks any prod) · **High** (blocks broad prod) · **Medium** · **Low** · **Future**. No score is composited with any other dimension.

> ## Remediation status (post-certification implementation pass)
> Security controls follow the **default-ON + env kill-switch** convention (mirroring CSRF); new features are flag-gated default-OFF, byte-identical incl. schema.
> - **SEC-M1 — CLOSED (code).** Session lifetime is now env-configurable: `SESSION_MAX_AGE_DAYS` (default 7), `SESSION_ROLLING` (default off), `SESSION_IDLE_MINUTES` (default 0 = disabled). Defaults are byte-identical to prior behaviour. (`backend/routes.ts`)
> - **SEC-H1 — MECHANISM ADDED; owner attestation PENDING.** Boot-time env preflight now emits a `[WARN]` for `PROD_DB_ISOLATION_ATTESTED` until the owner completes `docs/compliance/PROD_DB_ISOLATION_CHECKLIST.md` and sets the attestation var. Verification itself remains an owner/ops action (cannot be code-proven). (`backend/lib/env-preflight.ts`)
> - **SEC-M2 — DECISION RECORDED (owner-approved).** Provider-level at-rest encryption ACCEPTED; app-layer field-level PII encryption intentionally NOT implemented (retrofitting onto populated PII is destructive + key-management-bearing; provider-level is typically acceptable for DPDP/GDPR). See `docs/compliance/SEC-M2-encryption-decision.md` for rationale + re-open conditions.
> - SEC-L1/L2/L3 and SEC-F* unchanged (Low/Future).

## Launch-Critical — 0
None. No active, exploitable vulnerability was found in the live backend path.

## High — 1
| ID | Gap | Evidence | Recommended action (needs approval) |
|---|---|---|---|
| **SEC-H1** | **Environment & data isolation** — verify canonical GCP production uses a dedicated `DATABASE_URL` (Secret Manager) distinct from the workspace/dev DB. `replit.md` documents separate prod DB, but the MFA-hardening rationale cites dev/prod DB sharing. | `replit.md` deployment section vs Super-Admin MFA note | Owner **attestation** + config verification that prod DB ≠ dev DB and no dev writes reach prod. Config/ops item, not code. |

## Medium — 2
| ID | Gap | Evidence | Recommended action |
|---|---|---|---|
| **SEC-M1** | **Session lifetime policy** — 7-day rolling cookie; no absolute/idle timeout or forced re-auth on privilege change. | `backend/routes.ts` ~427–431 | Add absolute + idle timeout (additive, config-driven); optional session revocation on role change. |
| **SEC-M2** | **At-rest encryption is provider-level only** — no application-layer field-level encryption for sensitive PII. | `backend/email.ts`, schema | Decide whether provider-level suffices for target compliance; if not, field-level encryption for defined PII columns. Provider-level is typically acceptable for DPDP/GDPR. |

## Low — 3
| ID | Gap | Evidence | Recommended action |
|---|---|---|---|
| **SEC-L1** | **SSRF egress allowlist absent** — outbound fetch URLs are env/hardcoded (no user-controlled sink today → low exploitability). | `aiClient.ts`, `razorpay-client.ts`, `voice-screening-twilio.ts` | Add egress allowlist / private-IP deny **before** any user-supplied-URL feature ships. |
| **SEC-L2** | **Dormant JWT app hygiene** — `frontend/server` JWT app (hardcoded secret) not in runtime path; archived mirror parity. | `frontend/server/*`, `.agents/memory/frontend-server-latent-jwt-auth.md` | Remove/quarantine dead code or externalize its secret to prevent future foot-gun. |
| **SEC-L3** | **MFA limited to super_admin** — no MFA option for other privileged roles (employer/institution admins). | `backend/routes.ts` ~841 | Optional: extend MFA to elevated non-super roles (reuse existing `mfa_codes` mechanism). |

## Future — 3
| ID | Gap | Recommended action |
|---|---|---|
| **SEC-F1** | KMS/HSM-managed keys + automated secret rotation. |
| **SEC-F2** | Automated DAST/SAST + dependency-audit in CI; periodic pen-test. |
| **SEC-F3** | WAF / bot-mitigation at the edge for broad public exposure. |

**Note (not a gap):** AI provider keys unset in this environment → live AI-path request handling unmeasured here (503 fail-fast). Runtime measurement limitation, reported separately.
