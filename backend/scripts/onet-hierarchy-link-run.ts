/**
 * O*NET hierarchy completion + cross-industry bridge — runner.
 * Activates services/onet-hierarchy-link.ts: parents the 23 orphaned SOC-major-group
 * role families to functions/departments and links every industry to the cross-industry
 * functions, then builds the exact-name competency crosswalk. Idempotent (re-run = no-op),
 * additive (no deletes), real-data-only (no fabrication).
 *
 * Usage: cd backend && npx tsx scripts/onet-hierarchy-link-run.ts
 */
import { Pool } from 'pg';
import { linkOnetHierarchy } from '../services/onet-hierarchy-link';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
  try {
    console.log('Linking O*NET hierarchy (SOC→function→department, industry→function, competency crosswalk)…');
    const s = await linkOnetHierarchy(pool);
    console.log('\nSummary:');
    console.log(`  SOC groups processed         ${s.soc_groups_processed}`);
    console.log(`  functions created            ${s.functions_created}`);
    console.log(`  departments created          ${s.departments_created}`);
    console.log(`  role families linked         ${s.role_families_linked}`);
    console.log(`  industry→function links +    ${s.industry_function_links_added}`);
    console.log(`  competency crosswalk rows +  ${s.competency_crosswalk_rows}`);
    if (s.notes.length) {
      console.log('\nNotes:');
      for (const n of s.notes) console.log(`  - ${n}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
