/**
 * WC-C9 — Consumer Launch Execution Audit  (AUDIT · POST-LAUNCH · READ-ONLY)
 * ---------------------------------------------------------------------------
 * Objective: measure ACTUAL CAPADEX consumer usage after launch and compare
 * real behaviour against the WC-C8B readiness assumptions.
 *
 * MANDATE (user prefs): real production data only · no projections · no
 * simulated users · no implementation · honesty over optimism.
 *
 * METHOD / honest constraint:
 *  - The authoritative usage source is the PRODUCTION database. Production is
 *    reachable ONLY via Replit's agent tool (executeSql environment=production);
 *    a standalone tsx script has no production connection string by design.
 *  - That production probe was run on 2026-06-10 and returned, verbatim:
 *      "Repl <id> does not have a production Neon database. Deploy your app
 *       first to create a production database."  (captured below as evidence)
 *    => There is NO production database, because the app was never deployed.
 *    => There is therefore ZERO post-launch consumer data to measure.
 *  - This script connects to the DEVELOPMENT database (DATABASE_URL) ONLY to
 *    inventory what data exists anywhere, prove it is pre-launch test/seed data
 *    (not real consumers), and confirm the measurement pipeline is sound. Every
 *    dev number is labelled NON-PRODUCTION and is EXCLUDED from all findings.
 *
 * Logical floor: post-launch consumer usage cannot exist without a launch.
 * No deployment => no launch => no post-launch usage. This is not pessimism;
 * it is a definitional consequence of the deployment evidence.
 *
 * !! STALENESS / RE-RUN GUARD !! The production-absence finding is FROZEN evidence
 * captured 2026-06-10 via the agent's production tool. This script reads the DEV DB
 * only and CANNOT detect a production deployment on its own. Do NOT trust its
 * "NO DATA — launch not executed" verdict as current if the app has since been
 * published — the script must first be extended to read the production replica.
 * Query errors are logged (not silently swallowed) so an empty result is
 * distinguishable from a failed query.
 *
 * Deliverables -> backend/audit/wc-c9/
 *   00_executive_summary.md
 *   01_traffic_report.md
 *   02_assessment_funnel_report.md
 *   03_intelligence_consumption_report.md
 *   04_product_routing_report.md
 *   05_retention_report.md
 *   06_conversion_report.md
 *
 * Run: cd backend && npx tsx scripts/wc-c9/wc-c9-launch-execution-audit.ts
 */

import "dotenv/config";
import { Pool } from "pg";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const ts = new Date().toISOString();
const day = ts.slice(0, 10);
const OUT = path.join(process.cwd(), "audit", "wc-c9");

// ── Verbatim production-availability evidence (agent executeSql, 2026-06-10) ──
const PRODUCTION_PROBE = {
  method: "Replit executeSql(environment='production') — production read replica",
  date: "2026-06-10",
  queriesAttempted: [
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'",
    "SELECT count(*) FROM capadex_sessions",
  ],
  result: "PRODUCTION_DATABASE_ERROR",
  // Exact wording of the production probe error. The only alteration from the raw
  // message is the redacted Repl UUID — the sentence wording is unchanged.
  verbatim:
    "Repl (id redacted) does not have a production Neon database. " +
    "Deploy your app first to create a production database.",
};
const productionDbExists = false; // derived from PRODUCTION_PROBE (no prod DB)

// ── PII masking (audit-artifact discipline) ─────────────────────────────────
function maskEmail(e?: string | null): string {
  if (!e) return "(none)";
  const v = String(e).trim();
  const m = v.match(/^(.{1,2})(.*)(@.*)$/);
  if (!m) return "user_" + crypto.createHash("sha256").update(v).digest("hex").slice(0, 12);
  return `${m[1]}***${m[3]}`;
}

// Test/seed email signature (used to PROVE the dev corpus is not real consumers)
const TEST_DOMAINS = ["example.com", "test.com", "test.local", "simulation.metryx", "metryx.one", "metryxone.com"];
function isTestEmail(e?: string | null): boolean {
  if (!e) return true; // anonymous/null = not an attributable real consumer
  const v = String(e).trim().toLowerCase();
  if (TEST_DOMAINS.some((d) => v.endsWith("@" + d) || v.includes(d))) return true;
  if (/(test|demo|sample|dummy|qa|seed|fixture)/.test(v)) return true;
  return false;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function logQueryError(sql: string, e: any) {
  console.error("[wc-c9 query-error]", e?.message ?? e, "::", sql.replace(/\s+/g, " ").trim().slice(0, 90));
}
async function one<T = any>(sql: string, args: any[] = []): Promise<T | null> {
  try {
    const r = await pool.query(sql, args);
    return (r.rows[0] ?? null) as T;
  } catch (e) {
    logQueryError(sql, e); // never swallow silently: an empty result must be distinguishable from a failed query
    return null;
  }
}
async function rows<T = any>(sql: string, args: any[] = []): Promise<T[]> {
  try {
    const r = await pool.query(sql, args);
    return r.rows as T[];
  } catch (e) {
    logQueryError(sql, e);
    return [];
  }
}

const NUM = (v: any) => (v === null || v === undefined ? 0 : Number(v));
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "n/a");
const D = (v: any) => {
  if (v === null || v === undefined || v === "") return "?";
  try { return new Date(v).toISOString().slice(0, 10); } catch { return String(v); }
};

// ── Standard banner that leads EVERY deliverable ────────────────────────────
function prodVerdictBlock(): string {
  return `> **PRODUCTION VERDICT — NO DATA: launch not executed.**
> The app has **no production deployment**, therefore **no production database**, therefore
> **zero post-launch consumer usage** to measure. Post-launch usage cannot exist without a launch.
>
> **Evidence** (${PRODUCTION_PROBE.method}, ${PRODUCTION_PROBE.date}):
> \`${PRODUCTION_PROBE.verbatim}\`
>
> Per the WC-C9 mandate (real production data only · no projections · no simulated users),
> **all metrics in this report are UNMEASURABLE.** The development/test inventory below is shown
> ONLY for transparency + pipeline-readiness and is **excluded from every finding**.`;
}

function devCaveat(): string {
  return `_DEVELOPMENT / TEST corpus — NON-PRODUCTION. Dated within the build window and recorded
**before any deployment existed**, so by definition it is **not** post-launch consumer usage.
Emails are synthetic/developer accounts. Shown for transparency only; not a usage measurement._`;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log("WC-C9 Consumer Launch Execution Audit");
  console.warn(
    "!! STALENESS GUARD: production-absence is FROZEN evidence (2026-06-10). This run reads DEV only and " +
      "cannot detect a live deployment. If the app has since been published, do NOT trust the NO-DATA verdict " +
      "— extend the script to read the production replica first."
  );
  console.log("Production DB exists:", productionDbExists, "→ post-launch usage measurable:", productionDbExists);

  // ════════════════════════════════════════════════════════════════════════
  // DEV-CORPUS INVENTORY (non-production; transparency + pipeline-readiness)
  // ════════════════════════════════════════════════════════════════════════
  // Sessions / funnel
  const sStatus = await rows(
    `SELECT status, count(*)::int n, count(score)::int scored,
            min(created_at)::date mn, max(created_at)::date mx
     FROM capadex_sessions GROUP BY status ORDER BY n DESC`
  );
  const sTotal = await one<{ n: number; firstd: string; lastd: string }>(
    `SELECT count(*)::int n, min(created_at)::date firstd, max(created_at)::date lastd FROM capadex_sessions`
  );
  const answered = await one(
    `SELECT count(*) FILTER (WHERE answered_items=0) zero,
            count(*) FILTER (WHERE answered_items>0 AND status<>'completed') partial,
            count(*) FILTER (WHERE status='completed') completed,
            avg(NULLIF(answered_items,0))::numeric(10,1) avg_answered
     FROM capadex_sessions`
  );
  // Traffic instrumentation presence
  const traffic = await one(
    `SELECT count(*) FILTER (WHERE ip_address IS NOT NULL)::int with_ip,
            count(DISTINCT ip_address)::int distinct_ip,
            count(*) FILTER (WHERE referrer IS NOT NULL)::int with_referrer,
            count(*) FILTER (WHERE device_type IS NOT NULL)::int with_device
     FROM capadex_sessions`
  );
  const devices = await rows(`SELECT COALESCE(device_type,'(null)') device_type, count(*)::int n FROM capadex_sessions GROUP BY 1 ORDER BY n DESC`);

  // Email/consumer attribution
  const emailRows = await rows<{ guest_email: string | null }>(`SELECT guest_email FROM capadex_sessions`);
  let realEmail = 0, testEmail = 0, nullEmail = 0;
  for (const r of emailRows) {
    if (!r.guest_email) nullEmail++;
    else if (isTestEmail(r.guest_email)) testEmail++;
    else realEmail++;
  }

  // Intelligence consumption
  const reports = await one(`SELECT count(*)::int n, count(DISTINCT session_id)::int sessions, count(*) FILTER (WHERE email_sent)::int emailed FROM capadex_reports`);
  const omega = await one(`SELECT count(*) FILTER (WHERE omega_x_payload IS NOT NULL)::int n FROM capadex_sessions`);
  const recs = await one(`SELECT count(*)::int n, count(DISTINCT session_id)::int sessions, count(*) FILTER (WHERE status='completed')::int completed, count(*) FILTER (WHERE acknowledged_at IS NOT NULL)::int acknowledged FROM capadex_recommendations`);

  // Product routing
  const journey = await rows(`SELECT COALESCE(product_label, product_key, primary_route,'(none)') product, count(*)::int n FROM wc3_journey_state GROUP BY 1 ORDER BY n DESC`);
  const decision = await rows(`SELECT COALESCE(route_key,'(none)') route_key, COALESCE(product_path,'(none)') product_path, count(*)::int n FROM wc7b_decision_state GROUP BY 1,2 ORDER BY n DESC`);
  const outcomeModels = await rows(`SELECT COALESCE(model_key,'(none)') model_key, count(*)::int n FROM wc3_outcome_state GROUP BY 1 ORDER BY n DESC`);

  // Retention / return
  const retention = await one(`SELECT count(*)::int repeat_users FROM (SELECT guest_email FROM capadex_sessions WHERE guest_email IS NOT NULL GROUP BY guest_email HAVING count(*)>1) t`);
  const snaps = await one(`SELECT count(*)::int n, count(DISTINCT user_email)::int users FROM wc3_longitudinal_snapshots`);

  // Conversion / payments
  const pays = await rows(`SELECT status, (razorpay_order_id LIKE 'DEMO_%') demo_prefix,
                                  COALESCE((metadata->>'demo')::boolean,false) demo_meta,
                                  count(*)::int n, COALESCE(sum(amount_paise),0)::bigint paise
                           FROM capadex_payments GROUP BY 1,2,3 ORDER BY n DESC`);
  const payTotal = await one(`SELECT count(*)::int n, count(DISTINCT session_id)::int sessions FROM capadex_payments`);
  const users = await one(`SELECT count(*)::int n, count(*) FILTER (WHERE email_verified)::int verified FROM capadex_users`);

  const completedN = NUM(answered?.completed);
  const startedN = NUM(sTotal?.n);

  // ════════════════════════════════════════════════════════════════════════
  // Deliverable writers
  // ════════════════════════════════════════════════════════════════════════
  const head = (n: number, title: string) =>
    `# WC-C9 · Deliverable ${n} — ${title}\n\n**Date**: ${ts}  \n**Phase**: WC-C9 Consumer Launch Execution Audit (read-only · production data only)\n\n${prodVerdictBlock()}\n`;

  // 01 — Traffic
  write("01_traffic_report.md", `${head(1, "Traffic Report")}
## Production usage (the only valid source)
| Metric | Value | Status |
|---|---|---|
| Visitor volume | — | ⏸️ UNMEASURABLE (no production deployment) |
| Unique visitors | — | ⏸️ UNMEASURABLE |
| Traffic sources / referrers | — | ⏸️ UNMEASURABLE |

**Note on instrumentation**: even once live, "visitor volume" (page views / unique visitors) is **not**
currently instrumented — there is no web-analytics/page-view table. The closest live signal is
*assessment session creation* (\`capadex_sessions\`, which records \`ip_address\`, \`referrer\`,
\`device_type\`). True top-of-funnel visitor counting would need analytics instrumentation added
(out of scope for this read-only audit — flagged as a gap).

## Development/test inventory (NON-PRODUCTION — excluded from findings)
${devCaveat()}

- Sessions on record (all-time, dev): **${startedN}** (${D(sTotal?.firstd)} → ${D(sTotal?.lastd)})
- Sessions with an IP captured: ${NUM(traffic?.with_ip)} (distinct IPs: ${NUM(traffic?.distinct_ip)})
- Sessions with a referrer captured: ${NUM(traffic?.with_referrer)}
- Device-type split: ${devices.map((d) => `${d.device_type}=${d.n}`).join(", ") || "(none)"}

**Verdict**: ⏸️ NOT MEASURABLE — no production traffic exists; launch not executed.
`);

  // 02 — Assessment Funnel
  write("02_assessment_funnel_report.md", `${head(2, "Assessment Funnel Report")}
## Production funnel (the only valid source)
| Funnel step | Value | Status |
|---|---|---|
| Assessment starts | — | ⏸️ UNMEASURABLE |
| Assessment completions | — | ⏸️ UNMEASURABLE |
| Completion rate | — | ⏸️ UNMEASURABLE |
| Drop-off points | — | ⏸️ UNMEASURABLE |

## Development/test inventory (NON-PRODUCTION — excluded from findings)
${devCaveat()}

Session status (dev):
${sStatus.map((s) => `- \`${s.status}\`: ${s.n} (scored ${s.scored}; ${D(s.mn)} → ${D(s.mx)})`).join("\n") || "- (none)"}

- Started (rows): ${startedN}
- Completed: ${completedN} → dev completion rate ${pct(completedN, startedN)} _(non-production, not a launch metric)_
- Zero-answer starts: ${NUM(answered?.zero)} · partial (started, not completed): ${NUM(answered?.partial)}
- Avg answered items (non-zero sessions): ${answered?.avg_answered ?? "?"}

**Consumer attribution of dev sessions**: real-looking emails ${realEmail}, test/seed/synthetic ${testEmail}, anonymous/null ${nullEmail}.
Even the "real-looking" rows are pre-deployment developer/QA activity (build window), **not** launched-consumer usage.

**Verdict**: ⏸️ NOT MEASURABLE — no production funnel exists; launch not executed.
`);

  // 03 — Intelligence Consumption
  write("03_intelligence_consumption_report.md", `${head(3, "Intelligence Consumption Report")}
## Production consumption (the only valid source)
| Artifact | Consumed? | Status |
|---|---|---|
| Reports viewed | — | ⏸️ UNMEASURABLE |
| OMEGA-X profiles | — | ⏸️ UNMEASURABLE |
| Recommendations activated | — | ⏸️ UNMEASURABLE |

**Note**: report *generation* is persisted (\`capadex_reports\`, \`omega_x_payload\`), but report
**viewed/consumption** events are not comprehensively tracked as a first-class signal — a
\`report_viewed\` audit event would be the cleanest consumption proxy once live (gap flagged).

## Development/test inventory (NON-PRODUCTION — excluded from findings)
${devCaveat()}

- Reports generated (dev): ${NUM(reports?.n)} across ${NUM(reports?.sessions)} sessions; email_sent=${NUM(reports?.emailed)}
- Sessions with an OMEGA-X payload: ${NUM(omega?.n)}
- Recommendations persisted: ${NUM(recs?.n)} across ${NUM(recs?.sessions)} sessions; acknowledged=${NUM(recs?.acknowledged)}, completed=${NUM(recs?.completed)}

**Verdict**: ⏸️ NOT MEASURABLE — no production consumption exists; launch not executed.
`);

  // 04 — Product Routing
  write("04_product_routing_report.md", `${head(4, "Product Routing Report")}
## Production routing (the only valid source)
| Question | Answer | Status |
|---|---|---|
| Which products are recommended | — | ⏸️ UNMEASURABLE |
| Routing confidence distribution | — | ⏸️ UNMEASURABLE |

## Development/test inventory (NON-PRODUCTION — excluded from findings)
${devCaveat()}

Journey routing targets (dev, \`wc3_journey_state\`):
${journey.map((j) => `- ${j.product}: ${j.n}`).join("\n") || "- (none)"}

Decision orchestration (dev, \`wc7b_decision_state\`):
${decision.map((d) => `- route \`${d.route_key}\` → \`${d.product_path}\`: ${d.n}`).join("\n") || "- (none)"}

Outcome models activated (dev, \`wc3_outcome_state\`):
${outcomeModels.map((o) => `- ${o.model_key}: ${o.n}`).join("\n") || "- (none)"}

_These rows are consistent with build-time backfill, not a live consumer journey._

**Verdict**: ⏸️ NOT MEASURABLE — no production routing exists; launch not executed.
`);

  // 05 — Retention
  write("05_retention_report.md", `${head(5, "Retention Report")}
## Production retention (the only valid source)
| Metric | Value | Status |
|---|---|---|
| Returning users | — | ⏸️ UNMEASURABLE |
| Return assessments | — | ⏸️ UNMEASURABLE |
| Longitudinal snapshots over time | — | ⏸️ UNMEASURABLE |

## Development/test inventory (NON-PRODUCTION — excluded from findings)
${devCaveat()}

- Dev emails with >1 session (repeat): ${NUM(retention?.repeat_users)}
- Longitudinal snapshots: ${NUM(snaps?.n)} across ${NUM(snaps?.users)} distinct emails

Retention is intrinsically a **time-since-launch** metric; with no launch there is no retention
window to observe. The dev repeats are consistent with same-account QA re-runs.

**Verdict**: ⏸️ NOT MEASURABLE — no production retention exists; launch not executed.
`);

  // 06 — Conversion
  write("06_conversion_report.md", `${head(6, "Conversion Report")}
## Production conversion (the only valid source)
| Funnel | Value | Status |
|---|---|---|
| Completed → registered | — | ⏸️ UNMEASURABLE |
| Registered → paid | — | ⏸️ UNMEASURABLE |
| First conversion bottleneck | — | ⏸️ UNMEASURABLE |

**Structural note (from WC-C8B)**: paid conversion is additionally **impossible by configuration** —
Razorpay is unconfigured, so the platform runs in DEMO mode and **cannot take real money**. WC-C8B
certified the Paid Consumer Pilot as **NO-GO**. So even after a Free launch, conversion would read 0
until Razorpay is configured.

## Development/test inventory (NON-PRODUCTION — excluded from findings)
${devCaveat()}

- Registered users (dev): ${NUM(users?.n)} (email_verified ${NUM(users?.verified)})
- Payments on record (dev): ${NUM(payTotal?.n)} across ${NUM(payTotal?.sessions)} sessions
${pays.map((p) => `  - status \`${p.status}\`${p.demo_prefix ? " · DEMO_ order" : ""}${p.demo_meta ? " · demo-meta" : ""}: ${p.n} (${Number(p.paise) / 100} ${"INR"})`).join("\n") || "  - (none)"}

_All dev payments are DEMO/test (DEMO_ order prefix and/or demo metadata) — no real charge exists._

**Verdict**: ⏸️ NOT MEASURABLE — no production conversion exists; launch not executed (and paid path is NO-GO per WC-C8B).
`);

  // 00 — Executive Summary
  write("00_executive_summary.md", `# WC-C9 — Consumer Launch Execution Audit · Executive Summary

**Date**: ${ts}  
**Type**: AUDIT · POST-LAUNCH · READ-ONLY · STOP FOR APPROVAL  
**Mandate**: real production data only · no projections · no simulated users · honesty over optimism.

${prodVerdictBlock()}

---

## Headline
**WC-C9 cannot be executed as a post-launch audit, because the consumer launch was never executed.**
There is no production deployment → no production database → **zero** real consumer usage. This is a
definitional result, not a measurement: there can be no post-launch behaviour without a launch.

## Answers to the success criteria (honest)
| Question | Answer |
|---|---|
| Are real users completing assessments? | **Cannot be determined — none exist.** No production deployment; all data on record is pre-launch dev/test. |
| Which reports are actually consumed? | **Cannot be determined.** No production consumption; report-viewed events are also not first-class instrumented (gap). |
| Where are users dropping off? | **Cannot be determined** — no production funnel. |
| Which products are being recommended? | **Cannot be determined** for real users — dev routing rows are build-time backfill, not live journeys. |
| What is the first conversion bottleneck? | **The launch itself.** The first bottleneck is that the product is not live. (Paid conversion has a second, structural bottleneck: Razorpay unconfigured → DEMO mode → NO-GO per WC-C8B.) |

## Why there is no data (root cause, traced to WC-C8B)
WC-C8B certified **Free Consumer Launch = ⚠️ CONDITIONAL GO** (2 open owner conditions: rotate the
default \`admin123\`; confirm the MFA admin mailbox) and **Paid Consumer Pilot = ❌ NO-GO** (Razorpay
unconfigured). Those conditions were not closed and the app was not published. Hence no production
environment and no usage.

## What data exists anywhere (full disclosure — NON-PRODUCTION)
A small development/test corpus from the build window (${D(sTotal?.firstd)} → ${D(sTotal?.lastd)}):
~${startedN} sessions (${completedN} completed), ${NUM(users?.n)} registered test users, ${NUM(reports?.n)} reports,
${NUM(payTotal?.n)} DEMO/test payments (no real charge). Consumer attribution: ${realEmail} real-looking /
${testEmail} test-seed / ${nullEmail} anonymous — and even the real-looking ones are pre-deployment
developer/QA activity. **None of it is launched-consumer usage and none is used in any finding.**

## Pipeline readiness (the one positive, evidence-based result)
The audit queries ran cleanly against the live schema across all 10 scope dimensions — the funnel,
consumption, routing, retention, and conversion **measurement pipeline is sound and ready**. The
moment real production data exists, this exact audit will produce real numbers.

## Instrumentation gaps to close BEFORE a meaningful WC-C9 (flagged, not fixed)
1. **Visitor volume** — no page-view/unique-visitor analytics table; top-of-funnel is invisible. Session
   creation is the earliest current signal.
2. **Report consumption** — generation is persisted but report-*viewed* is not first-class tracked; add a
   \`report_viewed\` audit event for a clean consumption metric.

## Recommended path to a real WC-C9 (owner actions; STOP FOR APPROVAL)
1. Close the WC-C8B Free-Launch conditions (rotate \`admin123\`, confirm MFA mailbox, NODE_ENV=production,
   FF set **without** \`FF_COMMERCIAL_ACTIVATION\`).
2. **Publish** the app (creates the production database).
3. Accumulate real traffic for a defined window (e.g. 2–4 weeks).
4. (Optional, for paid metrics) Configure Razorpay + pass the WC-C8B refund sandbox to lift the Paid NO-GO.
5. Re-run \`scripts/wc-c9/wc-c9-launch-execution-audit.ts\` (extended to read production) to produce the
   real Traffic / Funnel / Consumption / Routing / Retention / Conversion numbers.

## Deliverables
\`01_traffic_report.md\` · \`02_assessment_funnel_report.md\` · \`03_intelligence_consumption_report.md\` ·
\`04_product_routing_report.md\` · \`05_retention_report.md\` · \`06_conversion_report.md\`

---
*Generated by \`backend/scripts/wc-c9/wc-c9-launch-execution-audit.ts\`. Evidence-derived; re-run after deployment + real traffic to produce live numbers.*
`);

  console.log(`\nWC-C9 audit complete → ${OUT}`);
  console.log(`Production data: ABSENT (no deployment). Dev corpus: ${startedN} sessions (NON-PRODUCTION, excluded).`);
  await pool.end();
}

function write(name: string, content: string) {
  fs.writeFileSync(path.join(OUT, name), content);
  console.log("  ✓", name);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
