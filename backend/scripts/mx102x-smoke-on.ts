/**
 * MX-102X ON-path smoke (throwaway app, does NOT touch the live workflow).
 * Mounts the routes with the flag ON + stub auth, then asserts:
 *   - /enabled        → 200 {enabled:true}     (flag gate passes)
 *   - /overview       → 200, 6 types, Coverage⟂Confidence, abstained honest
 *   - /type/career    → 200, calibration abstains for career
 *   - /type/bogus     → 400 invalid_outcome_type
 *   - /ledger         → 200, subjects pseudonymised (no raw email)
 *   - /certification  → 200, verdict PARTIAL (honest)
 * Read-only; no writes.
 */
import express from 'express';
import { Pool } from 'pg';

process.env.FF_OUTCOME_INTELLIGENCE_ACTIVATION = '1';

async function main() {
  const { registerOutcomeIntelligenceRoutes } = await import('../routes/outcome-intelligence');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const app = express();
  const pass = (_req: any, _res: any, next: any) => next();
  registerOutcomeIntelligenceRoutes(app, pool, pass, pass);
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const base = `http://localhost:${port}/api/outcome-intelligence`;

  const get = async (p: string) => {
    const r = await fetch(base + p);
    let body: any = null;
    try { body = await r.json(); } catch { /* */ }
    return { status: r.status, body };
  };

  let failures = 0;
  const check = (name: string, cond: boolean, extra = '') => {
    console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}${extra ? ' :: ' + extra : ''}`);
    if (!cond) failures++;
  };

  const enabled = await get('/enabled');
  check('/enabled 200 + enabled:true', enabled.status === 200 && enabled.body?.enabled === true, `status=${enabled.status}`);

  const ov = await get('/overview');
  check('/overview 200', ov.status === 200, `status=${ov.status}`);
  check('/overview has 6 types', Array.isArray(ov.body?.types) && ov.body.types.length === 6, `n=${ov.body?.types?.length}`);
  check('/overview Coverage⟂Confidence keys present',
    ov.body?.platform?.realized_coverage !== undefined && ov.body?.platform?.evidence_pairs !== undefined);
  check('/overview accuracy abstained (honest, dev)', ov.body?.platform?.abstained === true,
    `abstained=${ov.body?.platform?.abstained} pairs=${ov.body?.platform?.evidence_pairs}`);

  const career = await get('/type/career');
  check('/type/career 200 + calibration abstains', career.status === 200 && career.body?.calibration?.method_applies === false);

  const bogus = await get('/type/bogus');
  check('/type/bogus 400 invalid', bogus.status === 400 && bogus.body?.error === 'invalid_outcome_type', `status=${bogus.status}`);

  const ledger = await get('/ledger?limit=10');
  const rows: any[] = ledger.body?.rows ?? [];
  const noRawEmail = rows.every((r) => typeof r.subject !== 'string' || !r.subject.includes('@'));
  check('/ledger 200 + no raw email (pseudonymised)', ledger.status === 200 && noRawEmail, `rows=${rows.length}`);

  const cert = await get('/certification');
  check('/certification 200 + verdict PARTIAL (honest)', cert.status === 200 && cert.body?.verdict === 'PARTIAL', `verdict=${cert.body?.verdict}`);

  server.close();
  await pool.end();
  console.log(failures === 0 ? '\n[mx102x-smoke-on] ALL PASS' : `\n[mx102x-smoke-on] ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
