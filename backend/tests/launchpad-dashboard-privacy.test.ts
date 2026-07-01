/**
 * Launchpad Dashboard + Career Discovery — Privacy / Flag-Gate / Self-Only
 * Regression Test
 * ----------------------------------------------------------------------------
 * Two flag-gated student-facing read surfaces resolve their subject from the
 * authenticated SESSION principal only — never a client-supplied id — so there
 * is no IDOR surface:
 *
 *   • MX-302C  `/api/launchpad-dashboard/*`  (`launchpadDashboard` /
 *              FF_LAUNCHPAD_DASHBOARD, default OFF) — reads a seeker's OWN
 *              placement-readiness profile.
 *   • MX-302B  `/api/career-discovery/*`     (`careerDiscovery` /
 *              FF_CAREER_DISCOVERY, default OFF) — composes a seeker's OWN
 *              discovery profile + AI guidance.
 *
 * This test locks in the privacy guarantees so a future server refactor (e.g.
 * one that "refactors the dashboard reads to take an id") cannot silently open
 * the surface or introduce an IDOR that the frontend regression alone (task
 * #266) would not catch:
 *
 *   (a) flag OFF  → data routes 503 BEFORE any auth/DB touch (byte-identical
 *                   legacy: requireAuth never runs, pool never queried), and
 *                   /enabled → 200 {enabled:false}
 *   (b) flag ON   → /enabled → 200 {enabled:true}; the data routes fall through
 *                   the gate to requireAuth (401 without a session)
 *   (c) flag ON   → the read resolves the subject from the SESSION principal
 *                   ONLY — a client-supplied id/user_id/subject in the query or
 *                   body is NEVER honored. The DB layer is keyed by the SESSION
 *                   uid, and an attacker's id NEVER reaches a query param — so
 *                   an authenticated student A cannot retrieve student B's
 *                   readiness (/summary) or AI guidance (/guidance) by passing
 *                   B's id. This is asserted for BOTH surfaces.
 *   (d) flag ON   → the SAME self-only guarantee is locked across the OTHER
 *                   Career Discovery composing reads (`/status`, `/battery`,
 *                   `/profile`, `/explorer`, `/explorer/market`,
 *                   `/explorer/role/:roleId`). Task #268 covered `/guidance`;
 *                   these reads also expose a seeker's private discovery status,
 *                   compatibility score and role matches, so each is asserted to
 *                   scope every composed DB read to the SESSION uid and to keep
 *                   an attacker's id out of every query param.
 *   (e) flag ON   → the higher-impact WRITE routes carry the SAME guarantee.
 *                   `POST /values` persists the Work Values inventory,
 *                   `POST /complete` marks discovery complete + snapshots the
 *                   composed profile, and `POST /explorer/simulate` runs a
 *                   self-scoped what-if. Each resolves its subject from the
 *                   SESSION principal only, so a future refactor that added an id
 *                   parameter would let student A OVERWRITE student B's stored
 *                   values / completion status / snapshot. Each is asserted to
 *                   503 before auth/DB when OFF, and — when ON — to persist the
 *                   `career_discovery_results` UPSERT keyed on the SESSION uid
 *                   while an attacker's id NEVER reaches any query param.
 *
 * It mounts the REAL `registerLaunchpadDashboardRoutes` +
 * `registerCareerDiscoveryRoutes` onto a throwaway Express server (listen(0))
 * with a stub requireAuth and a stub pool that record whether they were touched
 * and with what params — so the assertions exercise the actual production gate +
 * handler code (and, for guidance, the real composing engines), headlessly,
 * without a real database. The flags are read from process.env at request time
 * (`envOverride`), so a single server can be driven through OFF and ON states
 * deterministically.
 *
 * Run with:  npx tsx backend/tests/launchpad-dashboard-privacy.test.ts
 */
import http, { type Server } from 'node:http';
import assert from 'node:assert/strict';
import express, { type Request, type Response } from 'express';
import { registerLaunchpadDashboardRoutes } from '../routes/launchpad-dashboard';
import { registerCareerDiscoveryRoutes } from '../routes/career-discovery';

// Force the AI coach down its DETERMINISTIC rule-based path so the guidance
// composition never attempts a network call (no LLM key/base URL in the test).
delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
delete process.env.OPENAI_API_KEY;
delete process.env.OPENAI_BASE_URL;
delete process.env.EMERGENT_LLM_KEY;

const FF = 'FF_LAUNCHPAD_DASHBOARD';
const FF_CD = 'FF_CAREER_DISCOVERY';
const SESSION_UID = 'session-self-001';
const ATTACKER_UID = 'victim-other-999';

// ── Tiny assert harness (mirrors the repo's other headless tests). ───────────
let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`PASS — ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`FAIL — ${name}\n       ${String(e?.message ?? e)}`);
  }
}

// ── Instrumentation: did the auth layer / DB get touched, and with what id? ───
const probe = {
  authCalls: 0,
  dbQueries: [] as Array<{ sql: string; params: any[] }>,
  reset() {
    this.authCalls = 0;
    this.dbQueries = [];
  },
};

// Capture any unhandled promise rejection so the telemetry resilience test can
// prove the fire-and-forget `void logAudit(...)` never leaks one — even when the
// audit write throws. If a future refactor stripped logAudit's try/catch, the
// rejected promise would surface here and fail the assertion.
const unhandledRejections: unknown[] = [];
process.on('unhandledRejection', (reason) => {
  unhandledRejections.push(reason);
});

// Stub requireAuth mirroring production semantics: reject (401) without a
// session, otherwise pin req.user to the SESSION principal and continue. It
// increments a counter so we can prove the flag gate runs BEFORE auth when OFF.
const requireAuth = (req: Request, res: Response, next: () => void) => {
  probe.authCalls++;
  if (req.headers['x-test-auth'] === '1') {
    (req as any).user = { id: SESSION_UID };
    return next();
  }
  return res.status(401).json({ ok: false, message: 'Unauthorized' });
};

// Pool behaviour mode — lets a single stub pool exercise the summary handler's
// honest-empty / degraded branches deterministically without a real database:
//   • 'default'    — table present + a populated profile (full read path)
//   • 'no_profile' — table present but the seeker has NO profile row
//   • 'absent'     — the substrate itself is missing (to_regclass → null)
//   • 'error'      — every query throws (internal DB failure)
// All flag-gate / IDOR assertions run in 'default'; the honest-empty/degraded
// tests flip it and restore it so downstream (tracker / career-discovery) tests
// keep seeing the populated substrate they expect.
type PoolMode = 'default' | 'no_profile' | 'absent' | 'error';
let poolMode: PoolMode = 'default';

// When true, ANY query touching the audit substrate (`platform_audit_log` — the
// ensure-schema DDL or the INSERT) rejects, simulating "audit DB down / schema
// DDL fails". Scoped to the audit path ONLY so the telemetry handler's own code
// still runs normally; only the fire-and-forget logAudit write blows up.
let auditPoolThrows = false;

// Stub pg Pool: records every query (so we can assert "DB untouched when OFF"
// and "the data read used the SESSION uid, not a client id"). Returns a present
// table + a populated profile so the summary handler reaches its full read path.
const pool = {
  query: async (sql: string, params?: any[]) => {
    probe.dbQueries.push({ sql, params: params ?? [] });
    // Audit substrate down: reject the ensure-schema DDL / INSERT so the
    // fire-and-forget logAudit path throws (recorded above so the test can prove
    // the throwing path was actually exercised).
    if (auditPoolThrows && /platform_audit_log/i.test(sql)) {
      throw new Error('simulated audit write failure (DB down / schema DDL failed)');
    }
    if (poolMode === 'error') {
      throw new Error('simulated internal DB failure');
    }
    // competencyRuntimeReady() probe: count how many of the supplied relations
    // exist. Report ALL present so the composed career-match engine proceeds to
    // its subject-keyed signal composition (instead of short-circuiting) — this
    // lets the explorer reads exercise their real self-scoped DB path.
    if (/unnest\(\$1::text\[\]\)/i.test(sql) && /to_regclass/i.test(sql)) {
      const arr = Array.isArray(params?.[0]) ? params![0] : [];
      return { rows: [{ n: arr.length }] };
    }
    if (/to_regclass/i.test(sql)) {
      if (poolMode === 'absent') {
        // Substrate missing — both column aliases resolve to null.
        return { rows: [{ t: null, reg: null }] };
      }
      // Both shapes used in the codebase: `... AS t` (launchpad) and
      // `to_regclass($1) AS reg` (career-discovery tableExists).
      return { rows: [{ t: 'public.career_seeker_profiles', reg: params?.[0] ?? 'public.career_seeker_profiles' }] };
    }
    if (/career_seeker_profiles\s+WHERE\s+user_id/i.test(sql)) {
      if (poolMode === 'no_profile') {
        // Table present, but this seeker has no profile row yet.
        return { rows: [] };
      }
      return {
        rows: [
          {
            data: {
              education: [{ degree: 'BSc' }],
              skills: { technical: ['ts', 'sql'] },
              targetRole: 'Engineer',
            },
          },
        ],
      };
    }
    return { rows: [] };
  },
} as any;

function buildServer(): Promise<{ server: Server; base: string }> {
  const app = express();
  app.use(express.json());
  registerLaunchpadDashboardRoutes(app, pool, requireAuth);
  registerCareerDiscoveryRoutes(app, pool, requireAuth);
  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

type Resp = { status: number; json: any };
async function call(
  base: string,
  method: string,
  path: string,
  opts: { auth?: boolean; body?: any } = {},
): Promise<Resp> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.auth) headers['x-test-auth'] = '1';
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: ['GET', 'HEAD'].includes(method) ? undefined : JSON.stringify(opts.body ?? {}),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

// The telemetry handler fires `logAudit` fire-and-forget (`void`), so the audit
// INSERT lands on the stub pool AFTER the HTTP response resolves. Poll the probe
// for the platform_audit_log INSERT so the metadata-only assertions read the row
// the production logger actually persisted.
async function waitForAuditInsert(): Promise<{ sql: string; params: any[] } | null> {
  for (let i = 0; i < 100; i++) {
    const ins = probe.dbQueries.find((q) => /INSERT\s+INTO\s+platform_audit_log/i.test(q.sql));
    if (ins) return ins;
    await new Promise((r) => setTimeout(r, 5));
  }
  return null;
}

async function main() {
  const { server, base } = await buildServer();

  console.log('\nLaunchpad Dashboard privacy / flag-gate / self-only');

  // ── (a) Flag OFF: data routes 503 BEFORE auth/DB; /enabled honest false. ──
  delete process.env[FF];
  process.env[FF] = 'false';

  probe.reset();
  const offSummary = await call(base, 'GET', '/api/launchpad-dashboard/summary', { auth: true });
  test('flag OFF → GET /summary returns 503', () => {
    assert.equal(offSummary.status, 503);
    assert.equal(offSummary.json?.enabled, false);
  });
  test('flag OFF → /summary 503 fires BEFORE auth (requireAuth not reached)', () => {
    assert.equal(probe.authCalls, 0, 'requireAuth ran before the flag gate');
  });
  test('flag OFF → /summary 503 fires BEFORE any DB touch (pool not queried)', () => {
    assert.equal(probe.dbQueries.length, 0, 'the DB was queried while the flag was OFF');
  });

  probe.reset();
  const offTelemetry = await call(base, 'POST', '/api/launchpad-dashboard/telemetry', { auth: true, body: {} });
  test('flag OFF → POST /telemetry returns 503', () => {
    assert.equal(offTelemetry.status, 503);
    assert.equal(offTelemetry.json?.enabled, false);
  });
  test('flag OFF → /telemetry 503 fires BEFORE auth (requireAuth not reached)', () => {
    assert.equal(probe.authCalls, 0, 'requireAuth ran before the flag gate');
  });

  const offEnabled = await call(base, 'GET', '/api/launchpad-dashboard/enabled');
  test('flag OFF → GET /enabled returns 200 {enabled:false}', () => {
    assert.equal(offEnabled.status, 200);
    assert.equal(offEnabled.json?.ok, true);
    assert.equal(offEnabled.json?.enabled, false);
  });

  // ── (b) Flag ON: probe true; data routes pass the gate to requireAuth. ──
  process.env[FF] = 'true';

  const onEnabled = await call(base, 'GET', '/api/launchpad-dashboard/enabled');
  test('flag ON → GET /enabled returns 200 {enabled:true}', () => {
    assert.equal(onEnabled.status, 200);
    assert.equal(onEnabled.json?.enabled, true);
  });

  probe.reset();
  const onNoAuth = await call(base, 'GET', '/api/launchpad-dashboard/summary');
  test('flag ON → GET /summary without a session returns 401 (gate fell through to auth)', () => {
    assert.equal(onNoAuth.status, 401);
    assert.ok(probe.authCalls >= 1, 'requireAuth should run once the flag is ON');
  });

  // ── (c) Flag ON: subject resolved from the SESSION only — no client id. ──
  probe.reset();
  const idor = await call(
    base,
    'GET',
    `/api/launchpad-dashboard/summary?id=${ATTACKER_UID}&user_id=${ATTACKER_UID}&subject=${ATTACKER_UID}`,
    { auth: true, body: { id: ATTACKER_UID, user_id: ATTACKER_UID, subject: ATTACKER_UID } },
  );
  test('flag ON → /summary 200 for an authenticated seeker', () => {
    assert.equal(idor.status, 200);
    assert.equal(idor.json?.ok, true);
  });
  test('flag ON → /summary subject is the SESSION principal, NOT the client-supplied id', () => {
    assert.equal(idor.json?.subject, SESSION_UID, `subject leaked: got ${idor.json?.subject}`);
    assert.notEqual(idor.json?.subject, ATTACKER_UID);
  });
  test('flag ON → the profile read was keyed by the SESSION uid (no IDOR at the DB layer)', () => {
    const read = probe.dbQueries.find((q) => /career_seeker_profiles\s+WHERE\s+user_id/i.test(q.sql));
    assert.ok(read, 'expected a profile read query');
    assert.equal(read!.params[0], SESSION_UID, `DB read used a client-supplied id: ${read!.params[0]}`);
    assert.ok(
      !probe.dbQueries.some((q) => (q.params ?? []).includes(ATTACKER_UID)),
      'a client-supplied id reached the DB layer',
    );
  });

  // ── Telemetry (metadata-only render audit): POST /telemetry records a render
  //    audit through the shared REDACTING platform-audit logger. Its documented
  //    guarantee is "metadata only — never user content or scores". Lock that in
  //    so a future refactor cannot start logging profile text, scores, or another
  //    seeker's id into the audit trail without a test failing:
  //      • the persisted audit row carries ONLY metadata (widget counts + a
  //        boolean availability map);
  //      • free-text / score-like body fields are NEVER persisted;
  //      • the audited entityId is the SESSION uid, never a client-supplied id.
  //    logAudit is fire-and-forget (`void`), so the stub pool records the INSERT
  //    after the response resolves — waitForAuditInsert() polls for it. The flag
  //    is ON here (set above). ──
  const SECRET_TEXT = 'MY_PRIVATE_ESSAY_ABOUT_MYSELF';
  const SECRET_NAME = 'Alice Very Secret Name';
  const SECRET_SCORE = 987654;

  probe.reset();
  const telemetry = await call(
    base,
    'POST',
    `/api/launchpad-dashboard/telemetry?id=${ATTACKER_UID}&user_id=${ATTACKER_UID}&subject=${ATTACKER_UID}`,
    {
      auth: true,
      body: {
        // Legitimate metadata the handler is allowed to record:
        event: 'launchpad_dashboard_render',
        widgets_total: 8,
        widget_availability: { profile: true, skills: false, resume: SECRET_TEXT },
        ai_mode: 'rule_based',
        // Free-text / score-like / identity fields the handler must NEVER persist:
        profile_text: SECRET_TEXT,
        summary: SECRET_TEXT,
        notes: SECRET_TEXT,
        full_name: SECRET_NAME,
        readiness_score: SECRET_SCORE,
        score: SECRET_SCORE,
        percent: SECRET_SCORE,
        id: ATTACKER_UID,
        user_id: ATTACKER_UID,
        subject: ATTACKER_UID,
      },
    },
  );
  test('flag ON → POST /telemetry 200 for an authenticated seeker', () => {
    assert.equal(telemetry.status, 200);
    assert.equal(telemetry.json?.ok, true);
  });

  const auditInsert = await waitForAuditInsert();
  test('flag ON → POST /telemetry persists a platform-audit row', () => {
    assert.ok(auditInsert, 'expected an INSERT INTO platform_audit_log from the fire-and-forget logAudit');
  });

  // The INSERT binds: [actor_id, actor_email, action, entity_type, entity_id,
  // entity_label, before, after, metadata, ip] → entity_id = params[4],
  // metadata (redactJson string) = params[8].
  const auditParams = auditInsert?.params ?? [];
  const auditEntityId = auditParams[4];
  let auditMeta: any = null;
  try {
    auditMeta = typeof auditParams[8] === 'string' ? JSON.parse(auditParams[8]) : null;
  } catch {
    auditMeta = null;
  }

  test('flag ON → telemetry audit entityId is the SESSION uid, NEVER a client-supplied id', () => {
    assert.equal(auditEntityId, SESSION_UID, `audit entity_id leaked: got ${auditEntityId}`);
    assert.notEqual(auditEntityId, ATTACKER_UID);
  });

  test('flag ON → telemetry audit metadata contains ONLY metadata keys (counts + availability map)', () => {
    assert.ok(auditMeta && typeof auditMeta === 'object', 'expected a parsed metadata object');
    const keys = Object.keys(auditMeta).sort();
    assert.deepEqual(
      keys,
      ['ai_mode', 'event', 'widget_availability', 'widgets_total', 'widgets_with_data'],
      `unexpected metadata keys persisted: ${keys.join(', ')}`,
    );
  });

  test('flag ON → telemetry metadata: widget totals are numbers, availability is a boolean-only map', () => {
    assert.equal(typeof auditMeta.widgets_total, 'number', 'widgets_total should be a number');
    assert.equal(typeof auditMeta.widgets_with_data, 'number', 'widgets_with_data should be a number');
    const vals = Object.values(auditMeta.widget_availability ?? {});
    assert.ok(vals.length > 0, 'expected a non-empty availability map');
    assert.ok(vals.every((v) => typeof v === 'boolean'), 'availability map carried a non-boolean value');
  });

  test('flag ON → telemetry metadata: a non-boolean availability value is coerced to false (text not persisted)', () => {
    // `resume` was sent as free text; it must be coerced to false and its text
    // must not survive, and it must not be counted as a widget-with-data.
    assert.equal(auditMeta.widget_availability.resume, false, 'a free-text availability value was not coerced to false');
    assert.equal(auditMeta.widgets_with_data, 1, 'only genuinely-true widgets should be counted (got a miscount)');
  });

  test('flag ON → telemetry audit trail does NOT persist free-text / score-like body fields', () => {
    const serialized = JSON.stringify(auditMeta);
    assert.ok(!serialized.includes(SECRET_TEXT), 'free-text body content leaked into the audit metadata');
    assert.ok(!serialized.includes(SECRET_NAME), 'a free-text name leaked into the audit metadata');
    assert.ok(!serialized.includes(String(SECRET_SCORE)), 'a score-like value leaked into the audit metadata');
  });

  test("flag ON → telemetry: no client-supplied id reaches ANY audit column (entity or metadata)", () => {
    const leaked = auditParams.filter((p) => typeof p === 'string' && p.includes(ATTACKER_UID));
    assert.equal(
      leaked.length,
      0,
      `a client-supplied id leaked into the audit row: ${JSON.stringify(leaked)}`,
    );
  });

  // ── Resilience contract (broken audit logger must NEVER drop the render): the
  //    telemetry handler fires the shared audit logger fire-and-forget
  //    (`void logAudit(...)`), and logAudit is best-effort by design ("never
  //    propagate"). If the audit write throws — DB down, ensure-schema DDL fails
  //    — the endpoint MUST still return 200 to the client, MUST NOT reject the
  //    request, and MUST NOT leave an unhandled promise rejection. Task #256
  //    verified WHAT gets persisted on success; this locks the failure contract
  //    so a future change that `await`ed the logger, or stripped its try/catch,
  //    cannot turn a transient DB blip into a user-visible 500 on every dashboard
  //    render without a test failing. Flag stays ON; `auditPoolThrows` makes the
  //    audit substrate (and ONLY the audit substrate) reject. ──
  process.env[FF] = 'true';
  const rejectionsBefore = unhandledRejections.length;
  auditPoolThrows = true;
  probe.reset();
  const telemetryThrow = await call(
    base,
    'POST',
    '/api/launchpad-dashboard/telemetry',
    {
      auth: true,
      body: { event: 'launchpad_dashboard_render', widgets_total: 8, widget_availability: { profile: true } },
    },
  );
  test('flag ON → POST /telemetry still returns 200 even when the audit INSERT rejects', () => {
    assert.equal(telemetryThrow.status, 200, `expected 200 despite a failing audit write, got ${telemetryThrow.status}`);
    assert.equal(telemetryThrow.json?.ok, true);
  });
  test('flag ON → POST /telemetry attempted the audit write (the throwing path was actually exercised)', () => {
    const attempted = probe.dbQueries.some((q) => /platform_audit_log/i.test(q.sql));
    assert.ok(attempted, 'expected the handler to attempt the audit write, so the reject was actually hit');
  });
  // The fire-and-forget `void logAudit(...)` settles AFTER the HTTP response, so
  // give any (mis)handled promise a few event-loop ticks to surface as an
  // unhandledRejection before asserting none leaked.
  await new Promise((r) => setTimeout(r, 50));
  test('flag ON → a throwing audit write does NOT reject the request or leave an unhandled promise rejection', () => {
    assert.equal(
      unhandledRejections.length,
      rejectionsBefore,
      'the failing audit write leaked an unhandled promise rejection: ' +
        String(unhandledRejections[unhandledRejections.length - 1]),
    );
  });
  auditPoolThrows = false;

  // ── Honest-empty / degraded: the summary must NEVER invent readiness. When
  //    the seeker has no profile row, when the substrate itself is absent, or on
  //    an internal DB error, it must return null (never a fabricated 0% or fake
  //    checklist) and must never throw / 500. Flag stays ON; poolMode flips per
  //    case and is restored to 'default' so downstream tests are unaffected. ──

  // (1) Authenticated seeker with NO profile row → honest empty (null ≠ 0).
  poolMode = 'no_profile';
  probe.reset();
  const noProfile = await call(base, 'GET', '/api/launchpad-dashboard/summary', { auth: true });
  poolMode = 'default';
  test('flag ON → /summary with NO profile row returns has_profile:false + readiness:null + widgets:null (not 0)', () => {
    assert.equal(noProfile.status, 200);
    assert.equal(noProfile.json?.ok, true);
    assert.equal(noProfile.json?.has_profile, false);
    assert.strictEqual(noProfile.json?.readiness, null, 'readiness must be null, not a fabricated 0%');
    assert.strictEqual(noProfile.json?.widgets, null, 'widgets must be null, not a fabricated empty checklist');
  });
  test('flag ON → /summary with NO profile row keyed the read by the SESSION uid', () => {
    const read = probe.dbQueries.find((q) => /career_seeker_profiles\s+WHERE\s+user_id/i.test(q.sql));
    assert.ok(read, 'expected a profile read query');
    assert.equal(read!.params[0], SESSION_UID);
  });

  // (2) Absent substrate (to_regclass → null) → honest empty state.
  poolMode = 'absent';
  probe.reset();
  const absent = await call(base, 'GET', '/api/launchpad-dashboard/summary', { auth: true });
  poolMode = 'default';
  test('flag ON → /summary with ABSENT substrate returns has_profile:false + readiness:null + widgets:null', () => {
    assert.equal(absent.status, 200);
    assert.equal(absent.json?.ok, true);
    assert.equal(absent.json?.has_profile, false);
    assert.strictEqual(absent.json?.readiness, null, 'readiness must be null when the substrate is absent');
    assert.strictEqual(absent.json?.widgets, null, 'widgets must be null when the substrate is absent');
  });
  test('flag ON → /summary with ABSENT substrate never queries the profile row (probe short-circuits)', () => {
    const read = probe.dbQueries.find((q) => /career_seeker_profiles\s+WHERE\s+user_id/i.test(q.sql));
    assert.ok(!read, 'the profile row should NOT be read once the to_regclass probe returns null');
  });

  // (3) Internal DB error → honest-degraded envelope; never throws / never 500s.
  poolMode = 'error';
  probe.reset();
  const degraded = await call(base, 'GET', '/api/launchpad-dashboard/summary', { auth: true });
  poolMode = 'default';
  test('flag ON → /summary on an internal DB error degrades to {ok:true, degraded:true} (never 500, never throws)', () => {
    assert.equal(degraded.status, 200, `expected 200 (degraded), got ${degraded.status}`);
    assert.equal(degraded.json?.ok, true);
    assert.equal(degraded.json?.degraded, true);
    assert.strictEqual(degraded.json?.has_profile, null, 'has_profile must be null (unknown), not a fabricated value');
    assert.strictEqual(degraded.json?.readiness, null, 'readiness must be null on a degraded read');
    assert.strictEqual(degraded.json?.widgets, null, 'widgets must be null on a degraded read');
  });

  // ── Tracker (WRITE surface): the higher-impact IDOR. PUT /tracker persists
  //    campus-drive / project / checklist data into
  //    `career_seeker_profiles.data.fresherHub`. Lock in that BOTH the read AND
  //    the UPDATE key on the SESSION principal — a client-supplied id in the
  //    query OR body must NEVER reach the WHERE clause, so student A cannot
  //    overwrite student B's profile data. ──

  // (a) Flag OFF: the WRITE surface 503s BEFORE any auth/DB touch (byte-identical).
  process.env[FF] = 'false';
  probe.reset();
  const trackerOffPut = await call(base, 'PUT', '/api/launchpad-dashboard/tracker', {
    auth: true,
    body: { drives: [{ company: 'Acme' }] },
  });
  test('flag OFF → PUT /tracker returns 503', () => {
    assert.equal(trackerOffPut.status, 503);
    assert.equal(trackerOffPut.json?.enabled, false);
  });
  test('flag OFF → PUT /tracker 503 fires BEFORE auth (requireAuth not reached)', () => {
    assert.equal(probe.authCalls, 0, 'requireAuth ran before the flag gate');
  });
  test('flag OFF → PUT /tracker 503 fires BEFORE any DB touch (pool not queried)', () => {
    assert.equal(probe.dbQueries.length, 0, 'the DB was queried while the flag was OFF');
  });

  // (b) Flag ON again for the IDOR assertions.
  process.env[FF] = 'true';

  // GET /tracker — read keyed by the SESSION uid; attacker id never reaches DB.
  probe.reset();
  const trackerGet = await call(
    base,
    'GET',
    `/api/launchpad-dashboard/tracker?id=${ATTACKER_UID}&user_id=${ATTACKER_UID}&subject=${ATTACKER_UID}`,
    { auth: true },
  );
  test('flag ON → GET /tracker 200 for an authenticated seeker', () => {
    assert.equal(trackerGet.status, 200);
    assert.equal(trackerGet.json?.ok, true);
  });
  test('flag ON → GET /tracker subject is the SESSION principal, NOT the client-supplied id', () => {
    assert.equal(trackerGet.json?.subject, SESSION_UID, `subject leaked: got ${trackerGet.json?.subject}`);
    assert.notEqual(trackerGet.json?.subject, ATTACKER_UID);
  });
  test('flag ON → GET /tracker read was keyed by the SESSION uid (no IDOR at the DB layer)', () => {
    const read = probe.dbQueries.find((q) => /career_seeker_profiles\s+WHERE\s+user_id/i.test(q.sql));
    assert.ok(read, 'expected a profile read query');
    assert.equal(read!.params[0], SESSION_UID, `DB read used a client-supplied id: ${read!.params[0]}`);
    assert.ok(
      !probe.dbQueries.some((q) => (q.params ?? []).some((p) => String(p) === ATTACKER_UID)),
      "a client-supplied id reached the DB layer on the tracker read",
    );
  });

  // PUT /tracker — the WRITE. Both the SELECT and the UPDATE must key on the
  // SESSION uid; the attacker's id (query OR body) must NEVER appear in any
  // query param, so the UPDATE's WHERE can only ever target the session row.
  probe.reset();
  const trackerPut = await call(
    base,
    'PUT',
    `/api/launchpad-dashboard/tracker?id=${ATTACKER_UID}&user_id=${ATTACKER_UID}&subject=${ATTACKER_UID}`,
    {
      auth: true,
      body: {
        // A real slice so the handler reaches its UPDATE (not the 400 no-op),
        // alongside attacker ids the handler must ignore for subject resolution.
        drives: [{ company: 'Acme', stage: 'applied' }],
        id: ATTACKER_UID,
        user_id: ATTACKER_UID,
        subject: ATTACKER_UID,
      },
    },
  );
  test('flag ON → PUT /tracker 200 for an authenticated seeker', () => {
    assert.equal(trackerPut.status, 200);
    assert.equal(trackerPut.json?.ok, true);
  });
  test('flag ON → PUT /tracker subject is the SESSION principal, NOT the client-supplied id', () => {
    assert.equal(trackerPut.json?.subject, SESSION_UID, `subject leaked: got ${trackerPut.json?.subject}`);
    assert.notEqual(trackerPut.json?.subject, ATTACKER_UID);
  });
  test('flag ON → PUT /tracker SELECT was keyed by the SESSION uid', () => {
    const read = probe.dbQueries.find((q) => /SELECT\s+data\s+FROM\s+career_seeker_profiles\s+WHERE\s+user_id/i.test(q.sql));
    assert.ok(read, 'expected a pre-update profile read query');
    assert.equal(read!.params[0], SESSION_UID, `pre-update read used a client-supplied id: ${read!.params[0]}`);
  });
  test("flag ON → PUT /tracker UPDATE's WHERE keys on the SESSION uid (cannot target student B's row)", () => {
    const update = probe.dbQueries.find((q) => /UPDATE\s+career_seeker_profiles\s+SET/i.test(q.sql));
    assert.ok(update, 'expected an UPDATE query');
    // The UPDATE is `... WHERE user_id = $2` with params [json, uid].
    assert.equal(update!.params[1], SESSION_UID, `UPDATE WHERE used a client-supplied id: ${update!.params[1]}`);
    assert.notEqual(update!.params[1], ATTACKER_UID);
  });
  test("flag ON → PUT /tracker: an attacker's id NEVER reaches ANY DB query param (no write IDOR A→B)", () => {
    assert.ok(probe.dbQueries.length > 0, 'expected the tracker write to query the DB');
    const leaked = probe.dbQueries.filter((q) => (q.params ?? []).some((p) => String(p).includes(ATTACKER_UID)));
    assert.equal(
      leaked.length,
      0,
      `a client-supplied id reached the DB layer in ${leaked.length} quer${leaked.length === 1 ? 'y' : 'ies'}: ` +
        leaked.map((q) => q.sql.replace(/\s+/g, ' ').trim().slice(0, 80)).join(' | '),
    );
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Career Discovery (MX-302B) — same self-only guarantee on /guidance.
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\nCareer Discovery privacy / flag-gate / self-only');

  // ── (a) Flag OFF: /guidance 503 BEFORE auth/DB; /enabled honest false. ──
  delete process.env[FF_CD];
  process.env[FF_CD] = 'false';

  probe.reset();
  const cdOff = await call(base, 'GET', '/api/career-discovery/guidance', { auth: true });
  test('CD flag OFF → GET /guidance returns 503', () => {
    assert.equal(cdOff.status, 503);
    assert.equal(cdOff.json?.enabled, false);
  });
  test('CD flag OFF → /guidance 503 fires BEFORE auth (requireAuth not reached)', () => {
    assert.equal(probe.authCalls, 0, 'requireAuth ran before the flag gate');
  });
  test('CD flag OFF → /guidance 503 fires BEFORE any DB touch (pool not queried)', () => {
    assert.equal(probe.dbQueries.length, 0, 'the DB was queried while the flag was OFF');
  });

  const cdOffEnabled = await call(base, 'GET', '/api/career-discovery/enabled');
  test('CD flag OFF → GET /enabled returns 200 {enabled:false}', () => {
    assert.equal(cdOffEnabled.status, 200);
    assert.equal(cdOffEnabled.json?.ok, true);
    assert.equal(cdOffEnabled.json?.enabled, false);
  });

  // ── (b) Flag ON: probe true; /guidance passes the gate to requireAuth. ──
  process.env[FF_CD] = 'true';

  const cdOnEnabled = await call(base, 'GET', '/api/career-discovery/enabled');
  test('CD flag ON → GET /enabled returns 200 {enabled:true}', () => {
    assert.equal(cdOnEnabled.status, 200);
    assert.equal(cdOnEnabled.json?.enabled, true);
  });

  probe.reset();
  const cdNoAuth = await call(base, 'GET', '/api/career-discovery/guidance');
  test('CD flag ON → GET /guidance without a session returns 401 (gate fell through to auth)', () => {
    assert.equal(cdNoAuth.status, 401);
    assert.ok(probe.authCalls >= 1, 'requireAuth should run once the flag is ON');
  });

  // ── (c) Flag ON: subject resolved from the SESSION only — no client id. The
  //    guidance envelope has no client-facing `subject` field, so the IDOR
  //    guarantee is proven at the DB layer: every composed read is keyed by the
  //    SESSION uid and the attacker's id NEVER reaches a query param. ──
  probe.reset();
  const cdIdor = await call(
    base,
    'GET',
    `/api/career-discovery/guidance?id=${ATTACKER_UID}&user_id=${ATTACKER_UID}&subject=${ATTACKER_UID}`,
    { auth: true, body: { id: ATTACKER_UID, user_id: ATTACKER_UID, subject: ATTACKER_UID } },
  );
  test('CD flag ON → /guidance 200 for an authenticated seeker', () => {
    assert.equal(cdIdor.status, 200);
    assert.equal(cdIdor.json?.ok, true);
  });
  test('CD flag ON → /guidance composed reads are keyed by the SESSION uid (the profile substrate was read for self)', () => {
    const read = probe.dbQueries.find((q) => /career_seeker_profiles\s+WHERE\s+user_id/i.test(q.sql));
    assert.ok(read, 'expected a profile read query during guidance composition');
    assert.equal(read!.params[0], SESSION_UID, `DB read used a client-supplied id: ${read!.params[0]}`);
  });
  test("CD flag ON → an attacker's id NEVER reaches any DB query param (no IDOR student A→B)", () => {
    assert.ok(probe.dbQueries.length > 0, 'expected the guidance composition to query the DB');
    const leaked = probe.dbQueries.filter((q) => (q.params ?? []).some((p) => String(p) === ATTACKER_UID));
    assert.equal(
      leaked.length,
      0,
      `a client-supplied id reached the DB layer in ${leaked.length} quer${leaked.length === 1 ? 'y' : 'ies'}: ` +
        leaked.map((q) => q.sql.replace(/\s+/g, ' ').trim().slice(0, 80)).join(' | '),
    );
  });

  // ── (d) Flag ON: the OTHER self-only Career Discovery reads are scoped the
  //    SAME way. Task #268 locked `/guidance`; this composes a seeker's private
  //    data through several MORE self-only reads (`/status`, `/battery`,
  //    `/profile`, `/explorer`, `/explorer/market`, `/explorer/role/:roleId`).
  //    Each resolves its subject from `selfId(req)` (the SESSION principal) — so
  //    a future refactor that added an id parameter to any of them would leak one
  //    student's discovery status / compatibility score / role matches to
  //    another. Each route is hit with an attacker's id planted in EVERY
  //    client-controllable channel (?id / ?user_id / ?subject in the query string
  //    AND the JSON body). The guarantee is proven at the DB layer: every
  //    composed read is keyed by the SESSION uid and the attacker's id NEVER
  //    reaches a query param, so student A can never pull student B's data. ──
  const ATTACK_QS = `id=${ATTACKER_UID}&user_id=${ATTACKER_UID}&subject=${ATTACKER_UID}`;
  const selfOnlyReads: Array<{ name: string; path: string }> = [
    { name: '/status', path: `/api/career-discovery/status?${ATTACK_QS}` },
    { name: '/battery', path: `/api/career-discovery/battery?${ATTACK_QS}` },
    { name: '/profile', path: `/api/career-discovery/profile?${ATTACK_QS}` },
    { name: '/explorer', path: `/api/career-discovery/explorer?${ATTACK_QS}` },
    { name: '/explorer/market', path: `/api/career-discovery/explorer/market?${ATTACK_QS}` },
    { name: '/explorer/role/:roleId', path: `/api/career-discovery/explorer/role/42?${ATTACK_QS}` },
  ];

  for (const route of selfOnlyReads) {
    probe.reset();
    const r = await call(base, 'GET', route.path, {
      auth: true,
      body: { id: ATTACKER_UID, user_id: ATTACKER_UID, subject: ATTACKER_UID },
    });
    test(`CD flag ON → GET ${route.name} 200 for an authenticated seeker`, () => {
      assert.equal(r.status, 200, `expected 200, got ${r.status}`);
      assert.equal(r.json?.ok, true);
    });
    test(`CD flag ON → ${route.name} composed reads ran keyed by the SESSION uid`, () => {
      assert.ok(probe.dbQueries.length > 0, 'expected the read to query the DB');
      assert.ok(
        probe.dbQueries.some((q) => (q.params ?? []).some((p) => String(p) === SESSION_UID)),
        'no composed DB read was keyed by the SESSION uid',
      );
    });
    test(`CD flag ON → ${route.name} attacker id NEVER reaches any DB query param (no IDOR A→B)`, () => {
      const leaked = probe.dbQueries.filter((q) => (q.params ?? []).some((p) => String(p) === ATTACKER_UID));
      assert.equal(
        leaked.length,
        0,
        `a client-supplied id reached the DB layer in ${leaked.length} quer${leaked.length === 1 ? 'y' : 'ies'}: ` +
          leaked.map((q) => q.sql.replace(/\s+/g, ' ').trim().slice(0, 80)).join(' | '),
      );
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Career Discovery (MX-302B) — WRITE routes. Same self-only guarantee, higher
  // impact: these PERSIST. `/values` stores the Work Values inventory,
  // `/complete` marks discovery complete + snapshots the composed profile, and
  // `/explorer/simulate` runs a self-scoped what-if. Each resolves its subject
  // from `selfId(req)` (the SESSION principal) — a future refactor that added an
  // id parameter to any of them would let student A overwrite / act on student
  // B's discovery row. Each route is hit with an attacker's id planted in EVERY
  // client-controllable channel (?id / ?user_id / ?subject in the query string
  // AND the JSON body). The guarantee is proven at the DB layer: the write is
  // keyed by the SESSION uid and the attacker's id NEVER reaches a query param.
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\nCareer Discovery WRITE privacy / flag-gate / self-only');

  // Each body carries a legitimate payload alongside the attacker ids the
  // handler must ignore for subject resolution. The Values payload lives under
  // `responses` (a distinct key) so the stored inventory blob can never itself
  // carry an attacker id — the ONLY leak vector under test is subject resolution.
  const writeRoutes: Array<{ name: string; path: string; body: any }> = [
    {
      name: 'POST /values',
      path: `/api/career-discovery/values?${ATTACK_QS}`,
      body: {
        responses: { work_life_balance: 5, compensation: 3 },
        id: ATTACKER_UID,
        user_id: ATTACKER_UID,
        subject: ATTACKER_UID,
      },
    },
    {
      name: 'POST /complete',
      path: `/api/career-discovery/complete?${ATTACK_QS}`,
      body: { id: ATTACKER_UID, user_id: ATTACKER_UID, subject: ATTACKER_UID },
    },
    {
      name: 'POST /explorer/simulate',
      path: `/api/career-discovery/explorer/simulate?${ATTACK_QS}`,
      body: {
        changes: [{ target: 'dom_communication', to_level: 4 }],
        id: ATTACKER_UID,
        user_id: ATTACKER_UID,
        subject: ATTACKER_UID,
      },
    },
  ];

  // (a) Flag OFF: every write 503s BEFORE any auth/DB touch (byte-identical).
  process.env[FF_CD] = 'false';
  for (const route of writeRoutes) {
    probe.reset();
    const r = await call(base, 'POST', route.path, { auth: true, body: route.body });
    test(`CD write flag OFF → ${route.name} returns 503`, () => {
      assert.equal(r.status, 503);
      assert.equal(r.json?.enabled, false);
    });
    test(`CD write flag OFF → ${route.name} 503 fires BEFORE auth (requireAuth not reached)`, () => {
      assert.equal(probe.authCalls, 0, 'requireAuth ran before the flag gate');
    });
    test(`CD write flag OFF → ${route.name} 503 fires BEFORE any DB touch (pool not queried)`, () => {
      assert.equal(probe.dbQueries.length, 0, 'the DB was queried while the flag was OFF');
    });
  }

  // (b) Flag ON: each write scopes to the SESSION uid; attacker id never leaks.
  process.env[FF_CD] = 'true';
  for (const route of writeRoutes) {
    probe.reset();
    const r = await call(base, 'POST', route.path, { auth: true, body: route.body });
    test(`CD write flag ON → ${route.name} 200 for an authenticated seeker`, () => {
      assert.equal(r.status, 200, `expected 200, got ${r.status}`);
      assert.equal(r.json?.ok, true);
    });
    test(`CD write flag ON → ${route.name} persisted/composed query was keyed by the SESSION uid`, () => {
      assert.ok(probe.dbQueries.length > 0, 'expected the write to query the DB');
      assert.ok(
        probe.dbQueries.some((q) => (q.params ?? []).some((p) => String(p) === SESSION_UID)),
        'no DB query was keyed by the SESSION uid',
      );
    });
    test(`CD write flag ON → ${route.name} attacker id NEVER reaches any DB query param (no write IDOR A→B)`, () => {
      const leaked = probe.dbQueries.filter((q) => (q.params ?? []).some((p) => String(p).includes(ATTACKER_UID)));
      assert.equal(
        leaked.length,
        0,
        `a client-supplied id reached the DB layer in ${leaked.length} quer${leaked.length === 1 ? 'y' : 'ies'}: ` +
          leaked.map((q) => q.sql.replace(/\s+/g, ' ').trim().slice(0, 80)).join(' | '),
      );
    });
  }

  // (c) The PERSISTING writes (`/values`, `/complete`) key their UPSERT into
  //     `career_discovery_results` on the SESSION uid: the first bind is the PK /
  //     conflict target `user_id`, so the row written / updated can ONLY ever be
  //     the caller's OWN discovery row — student A can never overwrite student B.
  process.env[FF_CD] = 'true';
  for (const route of [writeRoutes[0], writeRoutes[1]]) {
    probe.reset();
    await call(base, 'POST', route.path, { auth: true, body: route.body });
    test(`CD write flag ON → ${route.name} UPSERT into career_discovery_results keys user_id on the SESSION uid`, () => {
      const write = probe.dbQueries.find((q) => /INSERT\s+INTO\s+career_discovery_results/i.test(q.sql));
      assert.ok(write, 'expected an INSERT/UPSERT into career_discovery_results');
      assert.equal(write!.params[0], SESSION_UID, `write keyed user_id on a client-supplied id: ${write!.params[0]}`);
      assert.notEqual(write!.params[0], ATTACKER_UID);
    });
  }

  await new Promise<void>((resolve) => server.close(() => resolve()));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
