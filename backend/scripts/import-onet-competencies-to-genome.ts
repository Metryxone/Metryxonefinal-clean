/**
 * Pilot data import — O*NET Content Model → competency genome (onto_*).
 *
 * Promotes the REAL O*NET Content Model elements (Skills, Abilities, Knowledge,
 * Work Styles) into the canonical competency genome so the Competency Framework
 * pilot is populated with a recognised, public-domain taxonomy rather than
 * hand-authored rows. Source: U.S. Department of Labor O*NET database (public
 * domain / CC-BY), bundled as tab-delimited exports in backend/data/onet/.
 *
 * Honesty contract:
 *   - REAL data only. Every competency is a genuine O*NET Content Model element.
 *     Nothing is invented. O*NET has NO "future skills" elements, so the
 *     future_skills dimension receives ZERO rows from this import — that gap is
 *     reported, never papered over with fabricated entries.
 *   - Strictly ADDITIVE + idempotent. New rows use a disjoint id namespace
 *     (`onet_<elementId>`) under a dedicated domain (`dom_onet`). Curated genome
 *     rows are never mutated. A name/slug that already exists in the genome is
 *     SKIPPED (no duplicate, no override) and reported.
 *   - REVERSIBLE. `--down` removes exactly what this import added (rows tagged
 *     scoring_metadata.source='onet' / id prefix onet_, plus the dedicated
 *     domain + families). Extension + type-map rows cascade / are removed first.
 *   - Dimension classification is DETERMINISTIC from the O*NET element-id
 *     taxonomy (see classify()), so it is auditable and never tuned.
 *
 * Usage:
 *   cd backend && npx tsx scripts/import-onet-competencies-to-genome.ts --dry-run
 *   cd backend && npx tsx scripts/import-onet-competencies-to-genome.ts            # apply
 *   cd backend && npx tsx scripts/import-onet-competencies-to-genome.ts --down     # revert
 */
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import { runCompetencyMasterSeed } from '../services/competency-master';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const DRY = process.argv.includes('--dry-run');
const DOWN = process.argv.includes('--down');

const DATA_DIR = path.resolve(__dirname, '../data/onet');
const SOURCE = 'onet';
const DOMAIN_ID = 'dom_onet';

// O*NET content-model files → category label. Each file is a tab-delimited
// occupation×element×scale export; we keep only the DISTINCT (elementId, name).
const FILES: { file: string; category: string }[] = [
  { file: 'Skills.txt', category: 'Skills' },
  { file: 'Abilities.txt', category: 'Abilities' },
  { file: 'Knowledge.txt', category: 'Knowledge' },
  { file: 'Work_Styles.txt', category: 'Work Styles' },
];

type Dimension = 'behavioral' | 'cognitive' | 'functional' | 'technical' | 'future_skills';

// Dedicated families (under dom_onet), one per O*NET content-model group.
const FAMILIES: { id: string; name: string }[] = [
  { id: 'fam_onet_skills', name: 'O*NET Skills' },
  { id: 'fam_onet_abilities', name: 'O*NET Abilities' },
  { id: 'fam_onet_knowledge', name: 'O*NET Knowledge' },
  { id: 'fam_onet_work_styles', name: 'O*NET Work Styles' },
];
const FAMILY_BY_CATEGORY: Record<string, string> = {
  Skills: 'fam_onet_skills',
  Abilities: 'fam_onet_abilities',
  Knowledge: 'fam_onet_knowledge',
  'Work Styles': 'fam_onet_work_styles',
};

interface OnetElement {
  elementId: string; // e.g. 2.A.1.a
  name: string;
  category: string;
}

interface Classified {
  dimension: Dimension;        // onto_competency_type_map.type_key
  scientificType: 'behavioral' | 'cognitive' | 'functional'; // onto_competencies.scientific_type
  trainability: 'low' | 'moderate' | 'high';
  stability: 'trait_like' | 'state_like' | 'dynamic';
}

/**
 * Deterministic dimension classification from the O*NET element-id taxonomy.
 *   1.A.1  Cognitive Abilities          -> cognitive
 *   1.A.2/3/4 Psychomotor/Physical/Sensory Abilities -> functional
 *   1.C    Work Styles                  -> behavioral
 *   2.A    Basic Skills (content/process)-> cognitive
 *   2.B.1  Social Skills                 -> behavioral
 *   2.B.2  Complex Problem Solving       -> cognitive
 *   2.B.3  Technical Skills              -> technical
 *   2.B.4  Systems Skills                -> cognitive
 *   2.B.5  Resource Management Skills    -> functional
 *   2.C.3  Engineering & Technology      -> technical
 *   2.C.*  (other Knowledge)             -> functional
 * O*NET contributes NOTHING to future_skills (it has no such elements).
 */
function classify(el: OnetElement): Classified {
  const id = el.elementId;
  let dimension: Dimension;
  if (id.startsWith('1.C')) dimension = 'behavioral';
  else if (id.startsWith('1.A.1')) dimension = 'cognitive';
  else if (id.startsWith('1.A')) dimension = 'functional';
  else if (id.startsWith('2.A')) dimension = 'cognitive';
  else if (id.startsWith('2.B.1')) dimension = 'behavioral';
  else if (id.startsWith('2.B.2')) dimension = 'cognitive';
  else if (id.startsWith('2.B.3')) dimension = 'technical';
  else if (id.startsWith('2.B.4')) dimension = 'cognitive';
  else if (id.startsWith('2.B.5')) dimension = 'functional';
  else if (id.startsWith('2.C.3')) dimension = 'technical';
  else if (id.startsWith('2.C')) dimension = 'functional';
  else dimension = 'functional'; // safe default; should not occur for these files

  // scientific_type uses the genome's coarse 3-value axis (no 'technical' value
  // exists there — technical competencies carry scientific_type='functional').
  const scientificType: Classified['scientificType'] =
    dimension === 'behavioral' ? 'behavioral'
      : dimension === 'cognitive' ? 'cognitive'
        : 'functional';

  // Defensible per-category developmental defaults.
  const trainability: Classified['trainability'] =
    el.category === 'Abilities' ? 'low'
      : el.category === 'Work Styles' ? 'moderate'
        : 'high';
  const stability: Classified['stability'] =
    el.category === 'Abilities' || el.category === 'Work Styles' ? 'trait_like' : 'state_like';

  return { dimension, scientificType, trainability, stability };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

function compId(elementId: string): string {
  return 'onet_' + elementId.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function readDistinctElements(): Promise<OnetElement[]> {
  const seen = new Set<string>();
  const out: OnetElement[] = [];
  for (const { file, category } of FILES) {
    const full = path.join(DATA_DIR, file);
    const text = await fs.readFile(full, 'utf8');
    const lines = text.split(/\r?\n/);
    for (let i = 1; i < lines.length; i++) { // skip header
      const line = lines[i];
      if (!line) continue;
      const cols = line.split('\t');
      const elementId = (cols[1] ?? '').trim();
      const name = (cols[2] ?? '').trim();
      if (!elementId || !name) continue;
      if (seen.has(elementId)) continue;
      seen.add(elementId);
      out.push({ elementId, name, category });
    }
  }
  return out;
}

async function down(pool: Pool) {
  console.log('Reverting O*NET genome import…');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tm = await client.query(
      `DELETE FROM onto_competency_type_map WHERE competency_id LIKE 'onet\\_%'`,
    );
    // onto_competency_master_ext cascades on competency delete (ON DELETE CASCADE).
    const comp = await client.query(
      `DELETE FROM onto_competencies WHERE id LIKE 'onet\\_%' OR scoring_metadata->>'source' = $1`,
      [SOURCE],
    );
    const fam = await client.query(`DELETE FROM onto_families WHERE domain_id = $1`, [DOMAIN_ID]);
    const dom = await client.query(`DELETE FROM onto_domains WHERE id = $1`, [DOMAIN_ID]);
    await client.query('COMMIT');
    console.log(`Removed: type_map=${tm.rowCount} competencies=${comp.rowCount} families=${fam.rowCount} domain=${dom.rowCount}`);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* noop */ }
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
  try {
    if (DOWN) { await down(pool); return; }

    const elements = await readDistinctElements();
    const classified = elements.map((el) => ({ el, c: classify(el) }));

    // Per-dimension tally of candidates (before collision skips).
    const byDim: Record<Dimension, number> = {
      behavioral: 0, cognitive: 0, functional: 0, technical: 0, future_skills: 0,
    };
    for (const { c } of classified) byDim[c.dimension]++;

    console.log(`O*NET distinct content-model elements parsed: ${elements.length}`);
    console.log('Candidate dimension distribution (real O*NET elements):');
    (Object.keys(byDim) as Dimension[]).forEach((d) => console.log(`  ${d.padEnd(14)} ${byDim[d]}`));
    console.log('  (future_skills is 0 — O*NET has no future-skills elements; not fabricated.)\n');

    // Skip elements whose name/slug/id already exists in the genome (no dup/override).
    const existing = await pool.query(
      `SELECT LOWER(canonical_name) AS n, slug, id FROM onto_competencies`,
    );
    const names = new Set<string>(existing.rows.map((r: any) => r.n));
    const slugs = new Set<string>(existing.rows.map((r: any) => r.slug));
    const ids = new Set<string>(existing.rows.map((r: any) => r.id));

    // Sets grow as we queue rows, so a name/slug that appears twice WITHIN the
    // O*NET set (e.g. "Mathematics" is both a Skill and a Knowledge area) is
    // deduped too — first occurrence wins, later duplicates are skipped.
    const toInsert: { el: OnetElement; c: Classified; id: string; slug: string }[] = [];
    const skipped: { name: string; reason: string }[] = [];
    for (const { el, c } of classified) {
      const id = compId(el.elementId);
      const slug = slugify(el.name);
      const lname = el.name.toLowerCase();
      if (ids.has(id)) { skipped.push({ name: el.name, reason: 'id exists' }); continue; }
      if (names.has(lname)) { skipped.push({ name: el.name, reason: 'name exists in genome / O*NET set' }); continue; }
      if (slugs.has(slug)) { skipped.push({ name: el.name, reason: 'slug exists in genome / O*NET set' }); continue; }
      ids.add(id); names.add(lname); slugs.add(slug);
      toInsert.push({ el, c, id, slug });
    }

    console.log(`Will insert: ${toInsert.length}   Skipped (already in genome): ${skipped.length}`);
    if (skipped.length) {
      console.log('Skipped (deduped against existing genome):');
      skipped.forEach((s) => console.log(`  - ${s.name} (${s.reason})`));
    }

    if (DRY) { console.log('\nDRY-RUN — no writes performed.'); return; }
    if (toInsert.length === 0) { console.log('\nNothing new to insert (already imported).'); return; }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1) Dedicated domain + families (idempotent).
      await client.query(
        `INSERT INTO onto_domains (id, name, scientific_type, description, display_order)
         VALUES ($1, 'O*NET Content Model', 'functional',
                 'Recognised competency taxonomy imported from the U.S. DoL O*NET database (public domain). Real elements; dimension assigned via the O*NET element-id taxonomy.', 90)
         ON CONFLICT (id) DO NOTHING`,
        [DOMAIN_ID],
      );
      for (const f of FAMILIES) {
        await client.query(
          `INSERT INTO onto_families (id, domain_id, name, description)
           VALUES ($1, $2, $3, 'O*NET Content Model group (public domain).')
           ON CONFLICT (id) DO NOTHING`,
          [f.id, DOMAIN_ID, f.name],
        );
      }

      // 2) Competencies + type-map.
      let inserted = 0;
      let typeMapped = 0;
      for (const { el, c, id, slug } of toInsert) {
        const definition =
          `O*NET Content Model element [${el.elementId}] in the ${el.category} group. ` +
          `Source: U.S. Department of Labor O*NET database (public domain). ` +
          `Official element descriptor not included in this export.`;
        const familyId = FAMILY_BY_CATEGORY[el.category];
        const scoringMeta = JSON.stringify({
          source: SOURCE,
          onet_element_id: el.elementId,
          onet_category: el.category,
          dimension: c.dimension,
        });
        const compRes = await client.query(
          `INSERT INTO onto_competencies
             (id, canonical_name, slug, domain_id, family_id, scientific_type, definition,
              trainability, stability_level, complexity_level, leadership_relevance,
              scoring_metadata, version)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,3,0.5,$10::jsonb,'1.0.0')
           ON CONFLICT (id) DO NOTHING`,
          [id, el.name, slug, DOMAIN_ID, familyId, c.scientificType, definition,
            c.trainability, c.stability, scoringMeta],
        );
        inserted += compRes.rowCount ?? 0;

        const tmRes = await client.query(
          `INSERT INTO onto_competency_type_map
             (competency_id, type_key, confidence, needs_review, provenance, evidence)
           VALUES ($1,$2,'high',false,'onet_import',$3)
           ON CONFLICT (competency_id) DO NOTHING`,
          [id, c.dimension,
            `O*NET element ${el.elementId} (${el.category}) → ${c.dimension} via O*NET element-id taxonomy.`],
        );
        typeMapped += tmRes.rowCount ?? 0;
      }

      await client.query('COMMIT');
      console.log(`\nInserted competencies: ${inserted}   type-map rows: ${typeMapped}`);
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* noop */ }
      throw err;
    } finally {
      client.release();
    }

    // 3) Backfill the master extension so the new rows surface on the page.
    const seed = await runCompetencyMasterSeed(pool);
    console.log(`Master ext backfill: inserted=${seed.rows_inserted} total=${seed.rows_total_after}/${seed.competencies_total}`);

    // 3b) Fail-fast integrity assertion — every imported competency MUST have a
    // type-map row AND an ext row, or the page would show a row with no
    // dimension / no status. Honest failure beats a silently-partial import.
    const chk = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM onto_competencies WHERE id LIKE 'onet\\_%') AS comps,
         (SELECT COUNT(*)::int FROM onto_competency_type_map WHERE competency_id LIKE 'onet\\_%') AS tmap,
         (SELECT COUNT(*)::int FROM onto_competency_master_ext WHERE competency_id LIKE 'onet\\_%') AS ext`,
    );
    const { comps, tmap, ext } = chk.rows[0];
    if (comps !== tmap || comps !== ext) {
      console.error(`\nINTEGRITY FAILURE: onet competencies=${comps} type_map=${tmap} ext=${ext} (must be equal). Run --down and retry.`);
      process.exit(1);
    }
    console.log(`Integrity OK: onet competencies=${comps} type_map=${tmap} ext=${ext} (all aligned).`);

    // 4) Honest final report — genome totals + per-dimension distribution.
    const total = (await pool.query(`SELECT COUNT(*)::int AS n FROM onto_competencies`)).rows[0]?.n ?? 0;
    const dist = await pool.query(
      `SELECT t.type_key, COUNT(tm.competency_id)::int AS n
         FROM onto_competency_types t
         LEFT JOIN onto_competency_type_map tm ON tm.type_key = t.type_key
        GROUP BY t.type_key ORDER BY n DESC`,
    );
    console.log(`\nGenome total now: ${total} competencies`);
    console.log('Dimension distribution (all sources):');
    dist.rows.forEach((r: any) => console.log(`  ${String(r.type_key).padEnd(14)} ${r.n}`));
    console.log('\nNOTE: this is the honest real-data maximum from O*NET (~136 elements).');
    console.log('future_skills remains 0 from O*NET — populate it from a future-skills source, never fabricate.');
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
