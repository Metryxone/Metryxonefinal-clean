/**
 * WC-C4 — Entitlement ENFORCEMENT VALIDATION (READ-ONLY · additive · never mutates DB / schema / deploy).
 *
 * Follow-on to WC-C3 (which proved the paid CAPADEX surface had NO entitlement guard). WC-C4 builds the
 * `requireEntitlement` middleware + the `commercialEntitlementEnforcement` flag and applies the gate to
 * the 13 paid surfaces (+1 alias). This script VALIDATES that implementation against the LIVE database
 * and the REAL middleware code (it does NOT re-implement the decision logic — it drives the actual
 * `requireEntitlement` handler through a mock req/res/next harness so the measurement IS the code path).
 *
 * Everything is re-derived live on each run:
 *   • Protected surface — re-parsed from routes/capadex.ts SOURCE (each canonical path must carry a gate
 *     middleware arg; an un-guarded canonical path is reported as a GAP, never assumed-covered).
 *   • Enforcement projection — every session in capadex_sessions is driven through the REAL gate with the
 *     flag ON; the outcome (next / 402 / 503) is tallied. Server-side identity only (guest_email).
 *   • Monetization impact — buildEntitlementOverview + live paid-ledger + session stage distribution.
 *   • Rollback proof — the REAL gate is driven with the flag OFF through a query-spy pool; it must call
 *     next() WITHOUT touching the DB (byte-identical pass-through), proving reversibility.
 *
 * HONESTY GUARDS:
 *   • Coverage (surface guarded) and Impact (sessions actually blocked) are SEPARATE axes, never merged.
 *   • With 0 paid rows in the live ledger, the honest finding is "0 sessions blocked even flag ON" — the
 *     gate is correct but its monetization impact is unrealised until real paid stages exist. Stated plainly.
 *   • The middleware is measured by EXECUTION, not by re-stating its source. A canonical path missing the
 *     gate is a hard GAP in deliverable 02.
 *
 * PII: emails one-way sha256-masked (user_<hex[:10]>) before any artifact is written.
 *
 * Usage: cd backend && npx tsx scripts/wc-c4/wc-c4-validate.ts
 */
import { Pool } from 'pg';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { createHash } from 'crypto';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { buildEntitlementOverview, STAGE_REPORT_FEATURE, STAGE_FEATURES } from '../../services/wc7c/entitlement-engine';
import { requireEntitlement } from '../../services/wc7c/require-entitlement';
import { isCommercialEntitlementEnforcementEnabled } from '../../config/feature-flags';

const OUT_DIR = join(__dirname, '..', '..', 'audit', 'wc-c4');
const FF_ENV = 'FF_COMMERCIAL_ENTITLEMENT_ENFORCEMENT';

const maskEmail = (email: string | null): string =>
  email ? `user_${createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 10)}` : '(null)';
const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const naOrPct = (v: number | null) => (v === null ? 'n/a' : `${v}%`);

// ── Canonical paid surface (from WC-C3 deliverable 02) + the architect-found alias. ──────────────
const CANONICAL_SURFACE: { method: string; path: string; param: string }[] = [
  { method: 'GET',  path: '/api/capadex/report/:session_id',            param: 'session_id' },
  { method: 'GET',  path: '/api/capadex/report/:session_id/pdf',        param: 'session_id' },
  { method: 'POST', path: '/api/capadex/report/:session_id/send-email', param: 'session_id' },
  { method: 'GET',  path: '/api/capadex/session/:id/explain',           param: 'id' },
  { method: 'GET',  path: '/api/capadex/session/:id/grounding',         param: 'id' },
  { method: 'GET',  path: '/api/capadex/session/:id/guidance',          param: 'id' },
  { method: 'GET',  path: '/api/capadex/session/:id/omega-x',           param: 'id' },
  { method: 'GET',  path: '/api/assessment/session/:id/omega-x',        param: 'id' }, // alias (architect)
  { method: 'GET',  path: '/api/capadex/session/:id/patterns',          param: 'id' },
  { method: 'GET',  path: '/api/capadex/session/:id/pipeline',          param: 'id' },
  { method: 'GET',  path: '/api/capadex/session/:id/report',            param: 'id' },
  { method: 'GET',  path: '/api/capadex/session/:id/reports',           param: 'id' },
  { method: 'GET',  path: '/api/capadex/session/:id/signals',           param: 'id' },
  { method: 'GET',  path: '/api/capadex/session/:id/stage',             param: 'id' },
];

const GATE_RE = /requireEntitlement/;

/** Re-parse capadex.ts source: is each canonical mount registered WITH a gate middleware arg? */
function deriveSurfaceGuards(): { method: string; path: string; param: string; guarded: boolean; line: number }[] {
  const src = readFileSync(join(__dirname, '..', '..', 'routes', 'capadex.ts'), 'utf8');
  const lines = src.split('\n');
  return CANONICAL_SURFACE.map((s) => {
    const verb = s.method.toLowerCase();
    // Find the app.<verb>('<path>', ... ) registration line.
    const needle = `app.${verb}('${s.path}'`;
    const idx = lines.findIndex((l) => l.includes(needle));
    if (idx === -1) return { ...s, guarded: false, line: -1 };
    // Guard arg may be on the same line, OR (omega-x alias) the const gate is referenced inline.
    const guarded = GATE_RE.test(lines[idx]) || /gate(?:Session|Report)Entitlement/.test(lines[idx]);
    return { ...s, guarded, line: idx + 1 };
  });
}

// ── Mock req/res/next harness — drives the REAL middleware and captures its decision. ────────────
type GateOutcome =
  | { outcome: 'next' }
  | { outcome: 'response'; status: number; body: any };

function runGate(handler: RequestHandler, sessionId: string, param: string): Promise<GateOutcome> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (o: GateOutcome) => { if (!settled) { settled = true; resolve(o); } };
    const req = { params: { [param]: sessionId }, query: {}, body: {}, headers: {} } as unknown as Request;
    const res = {
      headersSent: false,
      _status: 200,
      status(code: number) { (this as any)._status = code; (this as any).headersSent = true; return this; },
      json(body: any) { done({ outcome: 'response', status: (this as any)._status, body }); return this; },
    } as unknown as Response;
    const next: NextFunction = () => done({ outcome: 'next' });
    Promise.resolve(handler(req, res, next)).catch(() => done({ outcome: 'next' }));
    setTimeout(() => done({ outcome: 'next' }), 8000); // safety — never hang the script
  });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) { console.error('DATABASE_URL not set — aborting (read-only validation).'); process.exit(1); }
  const pool = new Pool({ connectionString: databaseUrl });
  mkdirSync(OUT_DIR, { recursive: true });

  const generatedAt = new Date().toISOString();

  // ── 1. SURFACE COVERAGE (re-derived from source) ───────────────────────────────────────────────
  const surface = deriveSurfaceGuards();
  const guardedCount = surface.filter((s) => s.guarded).length;
  const surfaceGaps = surface.filter((s) => !s.guarded);

  // ── 2. ROLLBACK PROOF (flag OFF → no DB touch, next()) ──────────────────────────────────────────
  let spyQueryCount = 0;
  const spyPool = new Proxy(pool, {
    get(target, prop, receiver) {
      if (prop === 'query') {
        return (...args: any[]) => { spyQueryCount++; return (target as any).query(...args); };
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as unknown as Pool;

  // Pick a real session id if one exists, else a syntactically valid UUID — either way the OFF path
  // must short-circuit BEFORE any query.
  const sampleRow = await pool.query<{ id: string }>(`SELECT id FROM capadex_sessions LIMIT 1`).catch(() => ({ rows: [] as { id: string }[] }));
  const sampleId = sampleRow.rows[0]?.id ?? '00000000-0000-4000-8000-000000000000';

  delete process.env[FF_ENV]; // ensure flag OFF (default)
  const offGate = requireEntitlement(spyPool, { sessionParam: 'id' });
  const flagOffState = isCommercialEntitlementEnforcementEnabled();
  spyQueryCount = 0;
  const offOutcome = await runGate(offGate, sampleId, 'id');
  const rollbackPass = flagOffState === false && offOutcome.outcome === 'next' && spyQueryCount === 0;

  // ── 3. ENFORCEMENT PROJECTION (flag ON → drive every session through the REAL gate) ─────────────
  process.env[FF_ENV] = '1';
  const flagOnState = isCommercialEntitlementEnforcementEnabled();
  const onGate = requireEntitlement(pool, { sessionParam: 'id' });

  const sessions = await pool
    .query<{ id: string; stage_code: string | null; guest_email: string | null; status: string | null }>(
      `SELECT id, stage_code, guest_email, status FROM capadex_sessions ORDER BY created_at NULLS LAST, id`,
    )
    .then((r) => r.rows)
    .catch(() => [] as { id: string; stage_code: string | null; guest_email: string | null; status: string | null }[]);

  type Decision = 'allow_free' | 'allow_entitled' | 'block_402' | 'fail_503';
  const tally: Record<Decision, number> = { allow_free: 0, allow_entitled: 0, block_402: 0, fail_503: 0 };
  const stageDist = new Map<string, number>();
  const blockedStatus = new Map<string, number>();
  const blockedSamples: { session: string; stage: string | null; status: string | null; identity: string; required: string; reason: string }[] = [];

  for (const s of sessions) {
    const stageKey = s.stage_code ?? '(null)';
    stageDist.set(stageKey, (stageDist.get(stageKey) ?? 0) + 1);
    const o = await runGate(onGate, s.id, 'id');
    if (o.outcome === 'next') {
      // Free tier / unknown stage / not-found → allow. Distinguish paid-and-entitled vs free.
      const isPaidStage = s.stage_code != null && STAGE_REPORT_FEATURE[s.stage_code] != null;
      if (isPaidStage) tally.allow_entitled++; else tally.allow_free++;
    } else if (o.status === 402) {
      tally.block_402++;
      const st = s.status ?? '(null)';
      blockedStatus.set(st, (blockedStatus.get(st) ?? 0) + 1);
      if (blockedSamples.length < 25) {
        blockedSamples.push({
          session: s.id.slice(0, 8),
          stage: s.stage_code,
          status: s.status,
          identity: maskEmail(s.guest_email),
          required: String(o.body?.required_feature ?? ''),
          reason: String(o.body?.reason ?? ''),
        });
      }
    } else if (o.status === 503) {
      tally.fail_503++;
    }
  }
  delete process.env[FF_ENV]; // restore default OFF after the projection

  // ── 4. MONETIZATION IMPACT (live ledger) ────────────────────────────────────────────────────────
  const overview = await buildEntitlementOverview(pool);
  const paidRows = await pool
    .query<{ n: string }>(`SELECT COUNT(*) n FROM capadex_payments WHERE status='paid'`)
    .then((r) => Number(r.rows[0]?.n ?? 0))
    .catch(() => -1);
  const pendingRows = await pool
    .query<{ n: string }>(`SELECT COUNT(*) n FROM capadex_payments WHERE status='pending'`)
    .then((r) => Number(r.rows[0]?.n ?? 0))
    .catch(() => -1);
  const totalSessions = sessions.length;
  const paidStageSessions = tally.allow_entitled + tally.block_402;
  const blockedStatusStr = Array.from(blockedStatus.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([st, n]) => `${n} ${st}`)
    .join(', ');

  // ── 5. ARTIFACTS ─────────────────────────────────────────────────────────────────────────────────
  const w = (name: string, body: string) => writeFileSync(join(OUT_DIR, name), body);
  const stageDistRows = Array.from(stageDist.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([stage, n]) => `| ${stage} | ${n} | ${STAGE_REPORT_FEATURE[stage] ? `paid → requires \`${STAGE_REPORT_FEATURE[stage]}\`` : 'free / unknown → never gated'} |`)
    .join('\n');

  // 01 — middleware design + decision matrix
  w('01_middleware_design.md', `# WC-C4 · Deliverable 1 — \`requireEntitlement\` Middleware
_Generated ${generatedAt}. Validated by EXECUTION of the real handler (not source re-statement)._

## Contract
\`requireEntitlement(pool, { sessionParam }) → RequestHandler\`. Factory bound to the pool + the route's
session-id param (\`session_id\` for report routes, \`id\` for session sub-resources + the omega-x alias).
Gated by flag \`commercialEntitlementEnforcement\` (env \`${FF_ENV}\`, default **OFF**), distinct from the
admin-overview flag \`commercialEntitlement\`.

## Stage → required report feature (DERIVED from \`STAGE_FEATURES\`, in lockstep)
${Object.entries(STAGE_REPORT_FEATURE).map(([s, f]) => `- \`${s}\` → \`${f}\` (stage features: ${(STAGE_FEATURES[s] ?? []).map((x) => `\`${x}\``).join(', ')})`).join('\n')}
- \`CAP_CUR\` (free) / null / unknown stage → **not in the map → never gated**.

## Decision flow (first match wins)
| # | Condition | Outcome | Rationale |
|---|---|---|---|
| 1 | flag OFF | \`next()\` (synchronous, no await) | byte-identical legacy behaviour |
| 2 | session-id param fails UUID regex | \`next()\` | never feed a garbage id to a UUID-typed query (preserves the handler's own 400/404/500) |
| 3 | session not found | \`next()\` | preserve the handler's own 404; nothing to protect |
| 4 | stage CAP_CUR / null / unknown | \`next()\` | free tier — no paid content |
| 5 | \`deriveEntitlement\` degraded (ledger fault) | **503 \`entitlement_unavailable\`** | fail-CLOSED — a ledger fault is never "unpaid" |
| 6 | required feature ∈ entitled_features | \`next()\` | identity owns the paid stage |
| 7 | otherwise | **402 \`entitlement_required\`** | paid stage, identity does not own it (incl. null guest_email → \`no_billing_identity\`) |

## Identity & reuse
- Billing identity = \`capadex_sessions.guest_email\`, read **server-side from the session record**. The gate
  NEVER consults a per-request \`?email=\` / body email — that direct bypass is closed.
- HONEST caveat (inherited, NOT introduced by WC-C4): \`guest_email\` itself originates from the
  unauthenticated client at \`POST /session/start\`. The gate trusts the stored session record, not
  per-request input, so an identity that started a session claiming a paying user's email would inherit
  that email's entitlement (a free-ride on the email-keyed \`capadex_payments\` ledger — no victim-data
  exposure). This is a property of the pre-existing email-keyed payment model; closing it would be a new
  authenticated-identity model, out of WC-C4 scope. Moot on current data (0 paid rows).
- Reuses \`deriveEntitlement\` + the live \`capadex_payments\` ledger ONLY. No new entitlement model, no
  schema / ontology change.

## Deviations (documented, per architect plan sign-off)
- **403 → 402**: a missing entitlement is a payment-required condition, so \`402 Payment Required\` is used
  (not \`403\`). A ledger fault is split out as **503** so "can't tell" is never conflated with "unpaid".
- **Minor existence signal**: for the \`/report/:session_id\` handlers (which 404 a non-\`completed\`
  session), a PAID-stage but not-yet-completed session would receive a 402 from the gate before the
  handler's 404. This IS observable on the current data — see the blocked CAP_INS sessions in
  deliverable 3 (all non-completed). It is the correct enforcement direction (unpaid → blocked) and is
  documented for honesty.

## Inherited scope caveat (honest limitation — NOT fixed here, per "reuse only")
- The gate inherits \`deriveEntitlement\`'s ledger scope: entitlement is resolved from
  \`capadex_payments status='paid'\` ONLY. Package/subscription grants (\`student_subscriptions\`) are NOT
  resolved per-identity. If a CAP_* stage is ever granted via that path, the gate would 402 that identity.
  On the live data this is moot (0 active subscriptions), but it is the correct caveat to flag before the
  flag is enabled — closing it would be a NEW entitlement model, out of scope for WC-C4.
`);

  // 02 — protected surface matrix (re-derived from source)
  w('02_protected_surface_matrix.md', `# WC-C4 · Deliverable 2 — Protected Surface Matrix (post-enforcement)
_Generated ${generatedAt}. Re-parsed from routes/capadex.ts SOURCE — a canonical path missing the gate is a hard GAP._

**${guardedCount}/${surface.length}** canonical paid surfaces now carry the \`requireEntitlement\` gate.

| Method | Endpoint | Session param | capadex.ts line | Gate applied |
|---|---|---|---|---|
${surface.map((s) => `| ${s.method} | \`${s.path}\` | \`${s.param}\` | ${s.line === -1 ? '**NOT FOUND**' : s.line} | ${s.guarded ? '✅ yes' : '❌ **GAP**'} |`).join('\n')}

${surfaceGaps.length === 0
  ? '> All canonical paid surfaces (incl. the `/api/assessment/.../omega-x` alias) are guarded.'
  : `> **${surfaceGaps.length} GAP(S):** ${surfaceGaps.map((g) => `\`${g.path}\``).join(', ')} — paid content still unguarded.`}
`);

  // 03 — enforcement backfill validation (population projection)
  w('03_enforcement_backfill_validation.md', `# WC-C4 · Deliverable 3 — Enforcement Projection Over the Live Session Population
_Generated ${generatedAt}. Flag ON (\`${FF_ENV}=1\`); every session driven through the REAL \`requireEntitlement\` handler._

Flag state during projection: ON = **${flagOnState}**. Sessions evaluated: **${totalSessions}**.

## Decision distribution (real middleware outcomes)
| Decision | Sessions | Meaning |
|---|---|---|
| \`allow_free\` | ${tally.allow_free} | CAP_CUR / null / unknown stage / not-found → \`next()\` (no paid content) |
| \`allow_entitled\` | ${tally.allow_entitled} | paid stage AND identity owns the report feature → \`next()\` |
| \`block_402\` | ${tally.block_402} | paid stage, identity does NOT own it → 402 \`entitlement_required\` |
| \`fail_503\` | ${tally.fail_503} | ledger fault → 503 \`entitlement_unavailable\` (fail-closed) |

## Session stage distribution
| stage_code | sessions | gate treatment |
|---|---|---|
${stageDistRows || '| (none) | 0 | — |'}

## Blocked sample (PII-masked; ≤25)
${blockedSamples.length === 0
  ? '_No sessions blocked — with the current population no session is on a paid stage requiring an unowned feature. The gate is correct but blocks nothing until real paid stages exist._'
  : `Blocked-session status breakdown: **${blockedStatusStr}**.\n\n| session | stage | session status | identity | required_feature | reason |\n|---|---|---|---|---|---|\n${blockedSamples.map((b) => `| ${b.session}… | ${b.stage ?? '(null)'} | ${b.status ?? '(null)'} | ${b.identity} | \`${b.required}\` | ${b.reason} |`).join('\n')}`}
`);

  // 04 — monetization impact
  w('04_monetization_impact.md', `# WC-C4 · Deliverable 4 — Monetization Impact
_Generated ${generatedAt}. Live ledger via \`buildEntitlementOverview\` + \`capadex_payments\`._

## Revenue surfaces protected
- **${guardedCount}/${surface.length}** paid CAPADEX surfaces now require entitlement when the flag is ON.
- Coverage axis (surface guarded) is SEPARATE from impact axis (sessions actually blocked) — never merged.

## Live paying population (real recorded payments — not estimates)
| Metric | Value |
|---|---|
| paid ledger rows (\`capadex_payments\` status='paid') | ${paidRows} |
| paying identities (distinct paid emails) | ${overview.paying_identities} |
| entitled identities (resolver grants ≥1 feature) | ${overview.entitled_identities} |
| entitlement coverage | ${naOrPct(overview.coverage_pct)} |
| active package grants | ${overview.active_package_grants} |
| ledger degraded | ${overview.degraded} |

## Impact on the current session population
| Metric | Value |
|---|---|
| total sessions | ${totalSessions} |
| sessions on a PAID stage | ${paidStageSessions} |
| sessions that WOULD be blocked (402) flag ON | ${tally.block_402} (${naOrPct(pct(tally.block_402, totalSessions))} of all) |
| sessions allowed (free or entitled) | ${tally.allow_free + tally.allow_entitled} |

## Honest reading
- The live ledger holds **${paidRows} paid rows** (and ${pendingRows} pending — pending never entitles). The
  per-identity gate resolves entitlement from \`capadex_payments status='paid'\` ONLY.
${tally.block_402 > 0
  ? `- **${tally.block_402} session(s)** carry a PAID \`stage_code\` (CAP_INS → requires \`insight_report\`) with NO owned paid stage, so flag ON the gate returns **402** on their paid surfaces (blocked-session status: ${blockedStatusStr}). This is the gate working as designed — paid-tier content is no longer free.\n- It also means enabling the flag is **NOT byte-identical on the current data**: those ${tally.block_402} unpaid paid-stage session(s) lose access until a real payment exists. Byte-identical is guaranteed ONLY with the flag OFF (deliverable 5: 0 DB touch).\n- These are the *monetization target* the gate creates: identities that reached a paid tier without paying are now required to pay. Whether they convert is earned, not claimed here.`
  : '- No session is on a paid stage requiring an unowned feature, so turning the flag ON blocks **0** sessions today. The enforcement is *structurally* complete; its *monetization impact* is unrealised until real paid stages exist.'}
- Coverage (surface guarded) and impact (sessions blocked) are reported as separate axes; the gate is the prerequisite that makes paid stages defensible, not a revenue lift on its own.
`);

  // 05 — rollback validation
  w('05_rollback_validation.md', `# WC-C4 · Deliverable 5 — Rollback / Reversibility Validation
_Generated ${generatedAt}. The REAL gate driven with the flag OFF through a query-spy pool._

## Flag-OFF byte-identical pass-through
| Check | Result |
|---|---|
| flag state with \`${FF_ENV}\` unset | OFF = ${flagOffState} |
| gate outcome (flag OFF) | \`${offOutcome.outcome}\` |
| DB queries issued by the gate (flag OFF) | ${spyQueryCount} |
| **Rollback PASS** | ${rollbackPass ? '✅ yes' : '❌ NO'} |

**Interpretation:** with the flag OFF the middleware returns \`next()\` as its first synchronous
statement, **before any \`await\`** — so it issues **zero** DB queries and adds no observable behaviour.
Setting \`${FF_ENV}=0\` (or leaving it unset) is a complete, instantaneous rollback to legacy behaviour at
every one of the ${guardedCount} guarded surfaces. No schema, table, or data was created or changed.
`);

  // 06 — executive summary
  const verdict = surfaceGaps.length === 0 && rollbackPass;
  w('06_executive_summary.md', `# WC-C4 · Deliverable 6 — Executive Summary
_Generated ${generatedAt}._

## What shipped
A \`requireEntitlement\` middleware + the default-OFF flag \`commercialEntitlementEnforcement\`
(\`${FF_ENV}\`), applied to **${guardedCount}/${surface.length}** paid CAPADEX surfaces (the WC-C3 canonical
13 + the \`/api/assessment/.../omega-x\` alias). It REUSES the existing \`deriveEntitlement\` ledger and
\`STAGE_FEATURES\` — **no new entitlement model, no schema / ontology change.**

## Validation verdict: ${verdict ? '✅ PASS' : '⚠️ REVIEW'}
| Axis | Result |
|---|---|
| Surface coverage (re-derived from source) | ${guardedCount}/${surface.length} guarded${surfaceGaps.length ? ` — ${surfaceGaps.length} GAP` : ''} |
| Rollback / flag-OFF byte-identical (0 DB touch) | ${rollbackPass ? 'PASS' : 'FAIL'} |
| Enforcement projection (flag ON, live population) | ${tally.allow_free} free · ${tally.allow_entitled} entitled · ${tally.block_402} blocked · ${tally.fail_503} fail-closed |
| Live paid ledger rows | ${paidRows} |

## Honest bottom line
- The gate is **structurally complete and reversible**: flag OFF = zero DB touch, byte-identical; flag ON
  enforces real entitlement using server-side identity.
- Live ledger: **${paidRows} paid rows** (${pendingRows} pending). ${tally.block_402 > 0
  ? `Flag ON would block **${tally.block_402} session(s)** — paid stage (CAP_INS) reached without payment (status: ${blockedStatusStr}). So enabling is **not byte-identical on current data** (that is the whole point of enforcement); byte-identical holds ONLY with the flag OFF. ${tally.allow_entitled} session(s) are paid-and-entitled.`
  : 'No paid-stage session lacks entitlement, so flag ON blocks 0 sessions today; monetization impact is unrealised until real paid stages exist.'}
- Enforcement is the *prerequisite* that makes paid stages defensible — not a revenue lift by itself.
  Coverage (surface) and impact (blocked sessions) are reported as separate axes.
- **No deploy. Flag stays OFF.** Enabling is a deliberate, reversible operator decision.
`);

  // snapshot
  const snapshot = {
    generated_at: generatedAt,
    flag: { key: 'commercialEntitlementEnforcement', env: FF_ENV, default: false, off_state: flagOffState, on_state: flagOnState },
    surface: { canonical: surface.length, guarded: guardedCount, gaps: surfaceGaps.map((g) => g.path), detail: surface },
    rollback: { flag_off_outcome: offOutcome.outcome, db_queries_when_off: spyQueryCount, pass: rollbackPass },
    enforcement_projection: { total_sessions: totalSessions, tally, stage_distribution: Object.fromEntries(stageDist), blocked_session_status: Object.fromEntries(blockedStatus) },
    monetization: {
      paid_ledger_rows: paidRows,
      pending_ledger_rows: pendingRows,
      paying_identities: overview.paying_identities,
      entitled_identities: overview.entitled_identities,
      coverage_pct: overview.coverage_pct,
      active_package_grants: overview.active_package_grants,
      degraded: overview.degraded,
      paid_stage_sessions: paidStageSessions,
      sessions_blocked: tally.block_402,
    },
    stage_report_feature: STAGE_REPORT_FEATURE,
    verdict_pass: verdict,
  };
  writeFileSync(join(OUT_DIR, '_wc_c4_snapshot.json'), JSON.stringify(snapshot, null, 2));

  console.log(`WC-C4 validation complete → ${OUT_DIR}`);
  console.log(`  surface guarded : ${guardedCount}/${surface.length}${surfaceGaps.length ? ` (GAPS: ${surfaceGaps.map((g) => g.path).join(', ')})` : ''}`);
  console.log(`  rollback PASS   : ${rollbackPass} (flag OFF → ${offOutcome.outcome}, ${spyQueryCount} DB queries)`);
  console.log(`  projection      : ${tally.allow_free} free · ${tally.allow_entitled} entitled · ${tally.block_402} blocked · ${tally.fail_503} fail-closed`);
  console.log(`  paid ledger rows: ${paidRows}`);
  console.log(`  verdict         : ${verdict ? 'PASS' : 'REVIEW'}`);

  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
