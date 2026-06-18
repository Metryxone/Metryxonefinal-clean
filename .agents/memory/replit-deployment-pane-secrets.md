---
name: Replit deployment-pane secrets
description: Deployment-pane secrets cannot be inspected from the repo — always hedge "confirmed absent" claims about production secrets.
---

## Rule

When auditing production configuration, secrets set via the Replit Deployments pane **cannot be seen** from `.replit` [userenv.production] or any repo grep. `.replit [userenv.production]` only reflects secrets added via that config section, not the deploy-pane.

Never write "SESSION_SECRET is NOT in production. Confirmed." based on a repo grep alone — that grep only covers `.replit [userenv.production]`.

**Why:** The Replit deployment pane has its own secrets store (visible in the Deployments/Publishing UI). A repo grep of `.replit` will show `[userenv.production]` (which only had `APP_URL` for MetryxOne), but deployment-pane secrets are invisible. An audit that says "SESSION_SECRET is absent" is overclaiming; the honest statement is "not present in .replit [userenv.production]; deployment-pane must be verified manually."

**How to apply:**
- G14 phrasing in WC-C8 is the canonical hedged template: "Requires confirming X is set in production secrets."
- `session_secret_in_deployment_pane: 'unverifiable_from_repo'` in snapshot JSON.
- For gate status: use `DECISION_REQUIRED` (not `FAIL`) for items where the owner may have already set the value but the audit cannot see it.

## Corollary: DECISION_REQUIRED gate status

Use `DECISION_REQUIRED` (not `FAIL`) in gate tables for:
- Feature-flag enablement choices (flags are off-by-default; flag-off is often byte-identical to legacy — whether to enable them is an owner decision, not a defect).
- Secrets that the repo can't verify but which may already be set in the deployment pane.

`FAIL` is for definite, code-grounded defects (hardcoded fallback string in routes.ts, MFA commented out, refund route absent). `DECISION_REQUIRED` is for configuration choices the audit cannot resolve from the repo alone.
