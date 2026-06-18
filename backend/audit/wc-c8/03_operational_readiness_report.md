# WC-C8 · Deliverable 3 · Operational Readiness Report

**Generated:** 2026-06-10T09:56:20.133Z

---

## Operational Findings

### P1 — Pre-Launch (must fix before any public launch)

#### OP-1: No Graceful Shutdown
No SIGTERM or SIGINT handlers in backend/index.ts. Deployment target is "autoscale" (instances receive SIGTERM during scale-down/redeploy). Post-completion hooks (stage/outcome/journey persistence) are fire-and-forget — completions can be silently lost on shutdown.

**Evidence:** backend/index.ts — no process.on("SIGTERM"/"SIGINT"/"uncaughtException"/"unhandledRejection") listeners; .replit deploymentTarget = "autoscale"

**Risk:** deploymentTarget = "autoscale" in .replit — instances are routinely SIGTERM'd during redeploy and
scale-down events. Post-completion hooks (stage/outcome/journey state persistence) are fire-and-forget async
calls that will be silently abandoned when the process exits. For a data-collection launch, this means real
user completions can be lost.

**Fix:** Add SIGTERM handler to close DB pool and drain in-flight requests before exit

---

#### OP-2: No Email Queue or Retry
Email delivery is direct SMTP (Zoho, port 465) with no queue, no retry, and fire-and-forget error handling. OTP delivery failure at backend/routes/capadex.ts:2381 is silent (`.catch(console.error)`). User never knows OTP was not sent.

**Evidence:** backend/email.ts — nodemailer transporter with no queue/retry; backend/routes/capadex.ts:2381 — `.catch(console.error)`

**Risk:** OTP email failure is invisible to the user (`.catch(console.error)`) — user sees no error but
receives no code, flow is stuck. Report email failure is also silent. Zoho SMTP outages or rate limits
affect all email delivery.

**Fix:** Add retry logic (1–3 attempts) or a lightweight queue; surface delivery failures to the user

---

### P2 — Post-Launch Hardening

#### OP-3: Response Body Capture in Memory
API logger at backend/index.ts captures the full JSON response body in memory (capturedJsonResponse) before logging. Under high concurrent load or large responses this accumulates in-process memory.
**Fix:** Stream or sample response logging; set a max-body-size cap

#### OP-4: No External Error Tracking
No external error tracking (Sentry, Datadog, etc.). Errors are logged to stdout/stderr only — invisible without log aggregation in production.
**Fix:** Add Sentry (or equivalent) before public launch

---

### Notes

#### OP-5: Health Endpoint
GET /api/health exists for uptime checks. No database connectivity check in the health route.
Acceptable for MVP launch; add DB ping check for production readiness

---

## Infrastructure Summary

| Component | State | Notes |
|---|---|---|
| Express server | ✅ Running | Port 8080; trust proxy configured |
| PostgreSQL (Drizzle) | ✅ Configured | pg.Pool via DATABASE_URL |
| MongoDB | ⚠️ Optional | MONGO_REQUIRED=false; fail-fast only when required |
| FastAPI proxy | ⚠️ Dependency | /api/v1/upload/* → :8002; unavailability breaks uploads |
| Email (Zoho SMTP) | ⚠️ No retry | Direct SMTP, port 465; fire-and-forget |
| Graceful shutdown | ❌ Absent | No SIGTERM/SIGINT handlers |
| Error tracking | ❌ Absent | Console-only; no Sentry/Datadog |
| Rate limiting | ⚠️ In-memory | Resets on restart; not effective under autoscale |

---

## Deployment Config

```
deploymentTarget = "autoscale"
build = "cd frontend && npm run build && rm -rf ../backend/public && mkdir -p ../backend/public && cp -r dist/. ../backend/public/"
run   = "cd backend && NODE_ENV=production npx tsx index.ts"
```

**Critical gap:** No FF_* environment variables in the production run command or [userenv.production].
All WC-3/decision/commercial feature flags run at registry defaults (OFF) in production.
