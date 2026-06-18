---
name: Post-launch usage audit with no deployment
description: A "post-launch consumer usage" audit collapses when the app was never deployed — check production existence FIRST and never substitute dev/test data.
---

# Post-launch usage audit when nothing was launched

**Rule:** the FIRST step of any "post-launch / production usage" audit is to confirm a
production deployment exists at all — before designing any funnel/retention/conversion
measurement. On Replit, probe with `executeSql({environment:"production"})`. A never-deployed
repl has **no production Neon database** and the probe errors: *"...does not have a production
Neon database. Deploy your app first to create a production database."* No deployment ⇒ no
launch ⇒ **zero post-launch usage, by definition** (not a pessimistic reading — a logical floor).

**Why:** post-launch usage cannot exist without a launch. A readiness phase that ended in
CONDITIONAL-GO / NO-GO often means the owner never actually published, so the production DB
is simply absent. Reporting "0 users / can't measure" with the verbatim probe error as
evidence is the honest result; inventing numbers or quietly using the dev DB as a proxy is
fabrication.

**How to apply:**
- Treat the production-absence error as authoritative evidence; cite it. Run the probe twice.
- The dev DB (`DATABASE_URL`) will hold a small build/test corpus (synthetic emails like
  `*.simulation.*` / `*.test.local`, developer gmail accounts, DEMO payments, back-half state
  rows from build-time backfill). It is **pre-deployment by definition, so it can never be
  post-launch usage.** If you disclose it for transparency, wall it off hard: NON-PRODUCTION
  banner on every section, excluded from every finding, never a usage metric.
- Separate Coverage (real usage = 0) from the one fair positive: the measurement **pipeline**
  is sound if the queries actually ran against the live schema. Don't overclaim "ran cleanly"
  if helpers swallow errors (see below).
- Frozen-evidence script traps (an audit script that hardcodes `productionDbExists=false`):
  (1) add a STALENESS / re-run guard — a post-deployment re-run must NOT silently regenerate a
  confident "NO DATA" verdict; (2) **log** query errors, never swallow silently, so an empty
  result is distinguishable from a failed query; (3) quote evidence **exactly** — redact a
  Repl UUID as "(id redacted)" rather than truncating it to a fabricated suffix like `...-00`.
  Quoting altered text as "verbatim" is the exact error class an honesty audit guards against.
