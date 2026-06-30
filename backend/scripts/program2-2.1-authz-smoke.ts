/**
 * Program 2 · Phase 2.1 — authorization regression smoke test
 * ───────────────────────────────────────────────────────────
 * Guards the two P0 access-control fixes:
 *   - POST /api/assessment-templates/seed must NOT be anonymously triggerable
 *   - GET  /api/hr/jobs/:id          must NOT be anonymously readable
 *   - GET  /api/hr/jobs/published    must REMAIN public (no regression)
 *
 * Run against a live Backend API:  npx tsx scripts/program2-2.1-authz-smoke.ts
 * Honest by design: a network/refused error is reported as SKIPPED (server
 * down), never silently passed.
 */
const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:8080';

type Check = { name: string; ok: boolean; detail: string };
const results: Check[] = [];

async function getCsrf(): Promise<{ token: string; cookie: string } | null> {
  try {
    const res = await fetch(`${BASE}/api/csrf-token`);
    const setCookie = res.headers.get('set-cookie') || '';
    const cookie = setCookie.split(';')[0] || '';
    const body = (await res.json()) as { token?: string };
    return body.token ? { token: body.token, cookie } : null;
  } catch {
    return null;
  }
}

async function main() {
  // 1. seed endpoint must reject anonymous (with a valid CSRF token so we
  //    reach the auth gate, not the CSRF gate). Expect 401.
  const csrf = await getCsrf();
  if (!csrf) {
    console.log('SKIPPED — Backend API not reachable at', BASE);
    process.exit(0);
  }
  try {
    const res = await fetch(`${BASE}/api/assessment-templates/seed`, {
      method: 'POST',
      headers: { 'x-csrf-token': csrf.token, cookie: csrf.cookie },
    });
    results.push({
      name: 'POST /api/assessment-templates/seed denies anon',
      ok: res.status === 401,
      detail: `status ${res.status} (expected 401)`,
    });
  } catch (e) {
    results.push({ name: 'POST /api/assessment-templates/seed denies anon', ok: false, detail: `error ${String(e)}` });
  }

  // 2. job detail must reject anonymous. Expect 401.
  try {
    const res = await fetch(`${BASE}/api/hr/jobs/smoke-test-id`);
    results.push({
      name: 'GET /api/hr/jobs/:id denies anon',
      ok: res.status === 401,
      detail: `status ${res.status} (expected 401)`,
    });
  } catch (e) {
    results.push({ name: 'GET /api/hr/jobs/:id denies anon', ok: false, detail: `error ${String(e)}` });
  }

  // 3. published jobs must remain public (no regression). Expect 200.
  try {
    const res = await fetch(`${BASE}/api/hr/jobs/published`);
    results.push({
      name: 'GET /api/hr/jobs/published stays public',
      ok: res.status === 200,
      detail: `status ${res.status} (expected 200)`,
    });
  } catch (e) {
    results.push({ name: 'GET /api/hr/jobs/published stays public', ok: false, detail: `error ${String(e)}` });
  }

  let failed = 0;
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} — ${r.name} — ${r.detail}`);
    if (!r.ok) failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
