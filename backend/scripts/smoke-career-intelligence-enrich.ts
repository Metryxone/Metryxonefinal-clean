/**
 * smoke-career-intelligence-enrich.ts — PHASE 4 enrichment-path smoke test.
 *
 * Run: npx tsx backend/scripts/smoke-career-intelligence-enrich.ts [subjectId]
 *
 * Proves the additive `attachCareerIntelligence` wiring end-to-end:
 *   1. Flag OFF  => legacy payload returned UNTOUCHED (byte-identical; no enrichment key).
 *   2. Flag ON   => super-admin principal resolved via the resolveEffectiveUserId IDOR
 *                   guard, bridge composed, additive `career_intelligence` slice attached.
 *   3. IDOR      => a non-super-admin requesting another user's id gets NO enrichment.
 * Read-only: composes engines, writes nothing.
 */
import { Pool } from 'pg';
import { attachCareerIntelligence } from '../routes/career-intelligence-enrich.js';

// Flags resolve from the FF_<UPPER_SNAKE> env var; toggle it directly for the test.
function setCareerIntelligenceFlag(on: boolean): void {
  process.env.FF_CAREER_INTELLIGENCE = on ? '1' : '0';
}

function mockReq(user: any): any {
  return { user } as any;
}

async function main() {
  const subjectId = process.argv[2] ?? 'demo_subj_pm';
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) { console.error('DATABASE_URL not set'); process.exit(1); }
  const pool = new Pool({ connectionString: databaseUrl });
  const base = { ok: true, readiness: { legacy: true }, cohort: { n: 0 } };
  let failures = 0;
  const assert = (cond: boolean, label: string) => {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
    if (!cond) failures++;
  };

  try {
    // 1. Flag OFF => byte-identical (no career_intelligence key, same object content).
    setCareerIntelligenceFlag(false);
    const off = await attachCareerIntelligence(pool, mockReq({ id: subjectId, role: 'super_admin' }), subjectId, base);
    assert(!('career_intelligence' in off), 'flag OFF: no career_intelligence key (byte-identical)');
    assert(JSON.stringify(off) === JSON.stringify(base), 'flag OFF: payload identical to legacy');

    // 2. Flag ON + super-admin => additive enrichment attached.
    setCareerIntelligenceFlag(true);
    const on = await attachCareerIntelligence(pool, mockReq({ id: subjectId, role: 'super_admin' }), subjectId, base,
      e => ({ measurable: e.measurable, axes: e.axes }));
    assert('career_intelligence' in on, 'flag ON: career_intelligence key attached');
    assert((on as any).ok === true && (on as any).readiness?.legacy === true, 'flag ON: legacy fields preserved alongside enrichment');
    const ci = (on as any).career_intelligence;
    assert(ci && typeof ci.measurable === 'boolean', 'flag ON: enrichment carries honest measurable flag');
    console.log('   enrichment slice:', JSON.stringify(ci));

    // 3. IDOR guard: non-super-admin requesting ANOTHER user's id => no enrichment.
    const idor = await attachCareerIntelligence(pool, mockReq({ id: 'someone_else', role: 'user' }), subjectId, base);
    assert(!('career_intelligence' in idor), 'IDOR: cross-user request blocked, no enrichment leaked');

    console.log('\n' + (failures === 0 ? 'ALL ENRICHMENT SMOKE CHECKS PASSED' : `${failures} CHECK(S) FAILED`));
  } finally {
    setCareerIntelligenceFlag(false);
    await pool.end();
  }
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
