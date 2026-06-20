/**
 * smoke-super-validation.ts — Phase 3.12 end-to-end smoke test.
 *
 * Run: npx tsx backend/scripts/smoke-super-validation.ts [subjectId]
 *
 * Runs the read-only Super Admin Validation harness against a real scored
 * subject and prints all 10 areas with their honest PASS/WARN/FAIL statuses.
 * Read-only: composes engines, writes nothing.
 */
import { Pool } from 'pg';
import { runSuperAdminValidation } from '../services/super-admin-validation-engine.js';

async function main() {
  const subjectId = process.argv[2] ?? 'demo_subj_pm';
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const out = await runSuperAdminValidation(pool, subjectId);
    console.log('='.repeat(72));
    console.log(`SUPER ADMIN VALIDATION  v${out.version}  subject=${out.subject_id}`);
    console.log(`ok=${out.ok}  summary=`, JSON.stringify(out.summary));
    console.log('='.repeat(72));
    for (const area of out.areas) {
      const meas = area.measurable === undefined ? '' : `  measurable=${area.measurable}`;
      console.log(`\n[${String(area.status).toUpperCase().padEnd(4)}] ${area.id}  (${area.scope})${meas}  — ${area.label}`);
      for (const c of area.checks) {
        console.log(`    · ${String(c.status).toUpperCase().padEnd(4)} ${c.label}: ${c.detail}`);
      }
      for (const n of area.notes ?? []) console.log(`    note: ${n}`);
    }
    console.log('\n' + '='.repeat(72));
    const counts = out.areas.reduce((a: Record<string, number>, x) => {
      a[x.status] = (a[x.status] ?? 0) + 1; return a;
    }, {});
    console.log('AREA STATUS COUNTS:', JSON.stringify(counts));
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
