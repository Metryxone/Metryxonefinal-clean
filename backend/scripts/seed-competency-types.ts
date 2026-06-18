/**
 * Phase 1.1 — Competency Type classification seed (runner).
 *
 * Seeds the 5-row Competency Type Master and classifies all canonical
 * competencies (onto_competencies) into exactly one type, with provenance +
 * confidence. Strictly ADDITIVE — never mutates scientific_type / domain_id.
 * Idempotent (ON CONFLICT upsert) — safe to re-run in dev or prod.
 *
 * Usage:
 *   cd backend && npx tsx scripts/seed-competency-types.ts            # apply
 *   cd backend && npx tsx scripts/seed-competency-types.ts --dry-run  # classify + print, no writes
 */
import { Pool } from 'pg';
import {
  COMPETENCY_TYPES,
  classifyCompetency,
  runCompetencyTypeSeed,
  type CompetencyRow,
  type CompetencyTypeKey,
} from '../services/competency-type-classification';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const DRY = process.argv.includes('--dry-run');

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
  try {
    if (DRY) {
      console.log('DRY-RUN — classifying without writing.\n');
      const { rows } = await pool.query<CompetencyRow>(
        `SELECT id, canonical_name, definition, scientific_type, domain_id, family_id FROM onto_competencies`,
      );
      const dist: Record<CompetencyTypeKey, number> = { behavioral: 0, cognitive: 0, functional: 0, technical: 0, future_skills: 0 };
      const conf: Record<string, number> = { high: 0, medium: 0, low: 0 };
      const review: string[] = [];
      const technical: string[] = [];
      const future: string[] = [];
      for (const r of rows) {
        const c = classifyCompetency(r);
        dist[c.type_key] += 1;
        conf[c.confidence] += 1;
        if (c.needs_review) review.push(`${r.canonical_name} → ${c.type_key} (${c.provenance}: ${c.evidence})`);
        if (c.type_key === 'technical') technical.push(`${r.canonical_name} (${c.provenance})`);
        if (c.type_key === 'future_skills') future.push(`${r.canonical_name} (${c.provenance})`);
      }
      console.log(`Total competencies: ${rows.length}`);
      console.log('Distribution:');
      for (const t of COMPETENCY_TYPES) console.log(`  ${t.type_key.padEnd(14)} ${dist[t.type_key]}`);
      console.log(`Confidence: high=${conf.high} medium=${conf.medium} low=${conf.low}`);
      console.log(`Technical members (${technical.length}): ${technical.join(', ') || '(none)'}`);
      console.log(`Future Skills members (${future.length}): ${future.join(', ') || '(none — honest gap)'}`);
      console.log(`Needs review (${review.length}):`);
      for (const r of review) console.log(`  - ${r}`);
      return;
    }

    console.log('Seeding Competency Type Master + classifying all competencies…');
    const result = await runCompetencyTypeSeed(pool);
    if (!result.ok) { console.error(`FAILED: ${result.error}`); process.exit(1); }
    console.log(`\nTypes seeded:        ${result.types_seeded}`);
    console.log(`Competencies total:  ${result.competencies_total}`);
    console.log(`Mapped:              ${result.mapped}`);
    if (result.mapped !== result.competencies_total) {
      console.error('\nERROR: not every competency was mapped (coverage < 100%).');
      process.exit(1);
    }
    console.log('Distribution:');
    for (const t of COMPETENCY_TYPES) console.log(`  ${t.type_key.padEnd(14)} ${result.distribution[t.type_key]}`);
    console.log(`Confidence: high=${result.confidence.high} medium=${result.confidence.medium} low=${result.confidence.low}`);
    console.log(`Needs review: ${result.needs_review}`);
    console.log('\nOK — coverage 100%.');
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
