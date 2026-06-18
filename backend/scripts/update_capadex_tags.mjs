/**
 * CAPADEX Tag Backfill
 * Updates existing sdi_items with stage_code, age_band, concern_name, weight, polarity, focus_area, layer_tag
 * Run from project root:  node backend/scripts/update_capadex_tags.mjs
 */
import { readFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('pg');

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const TSV = 'attached_assets/Pasted-Assessment-name-Stage-Anchor-Domain-Sub-Domain-Dimensio_1777890183003.txt';

const DOMAIN_NORM = {
  'Behavioral': 'Behavioral', 'Behav': 'Behavioral', 'Digital': 'Behavioral',
  'Physio': 'Behavioral', 'Physiology': 'Behavioral', 'Sensory': 'Cognitive Development',
  'Cognitive Development': 'Cognitive Development', 'Metacog': 'Cognitive Development',
  'Emotional': 'Emotional', 'Diagnostic': 'Diagnostic',
};
const DOMAIN_CODE = {
  'Cognitive Development': 'SDI_COG', 'Behavioral': 'SDI_BEH',
  'Emotional': 'SDI_EMO', 'Diagnostic': 'SDI_DGN',
};
const STAGE_MAP = {
  'Curiosity': 'CAP_CUR', 'Insight': 'CAP_INS', 'Growth': 'CAP_GRW', 'Mastery': 'CAP_MAS',
};

function slug(s) {
  return s.trim().replace(/[^a-zA-Z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').toUpperCase().substring(0, 30);
}

function normLogic(logic) {
  const l = (logic || '').trim().toLowerCase();
  if (l.includes('inverted'))                           return 'inverted';
  if (l.includes('linear') || l === '1=1, 5=5')        return 'standard';
  if (['yes=5, no=1','f=5, s=1','s=5, t=1'].includes(l)) return 'binary';
  if (['yes=1, no=5','1=5, 5+=1'].includes(l))          return 'binary_inverted';
  if (l.includes('neut') || l.includes('neutral'))      return 'neutral';
  return 'standard';
}

function parseTsv() {
  const lines = readFileSync(TSV, 'utf8').split('\n');
  const rawCols = lines[0].split('\t').map(c => c.trim());
  const cols = [];
  const seen = {};
  for (const c of rawCols) {
    if (seen[c] !== undefined) { seen[c]++; cols.push(`${c}_${seen[c]}`); }
    else { seen[c] = 0; cols.push(c); }
  }
  const rows = [];
  for (const line of lines.slice(1)) {
    const parts = line.split('\t');
    if (!parts[0] || parts[0].trim() === '' || parts[0].trim() === 'Assessment name') continue;
    const row = {};
    cols.forEach((c, i) => { row[c] = (parts[i] || '').trim(); });
    rows.push(row);
  }
  return rows;
}

async function main() {
  const rows = parseTsv();
  console.log(`Parsed ${rows.length} rows`);

  const pool = new Pool({ connectionString: DB_URL });
  const client = await pool.connect();

  try {
    // Load all existing items (subdomain_code + first 80 chars of question → id)
    const { rows: existing } = await client.query(
      `SELECT id, subdomain_code, left(question,80) AS q FROM sdi_items`
    );
    const itemIndex = new Map(existing.map(r => [`${r.subdomain_code}::${r.q}`, r.id]));
    console.log(`Loaded ${existing.length} existing items`);

    // Build subdomain map (same logic as importer)
    const subdomainMap = new Map();
    const usedSlugs = new Set();
    for (const row of rows) {
      const canon = DOMAIN_NORM[row['Domain']] || row['Domain'];
      const dc = DOMAIN_CODE[canon];
      if (!dc) continue;
      const sdName = row['Sub-Domain'];
      if (!sdName) continue;
      const mapKey = `${dc}::${sdName}`;
      if (subdomainMap.has(mapKey)) continue;
      let sc = `${dc}_${slug(sdName)}`;
      let n = 2;
      while (usedSlugs.has(sc)) { sc = `${dc}_${slug(sdName)}_${n++}`; }
      usedSlugs.add(sc);
      subdomainMap.set(mapKey, sc);
    }

    await client.query('BEGIN');

    let updated = 0, notFound = 0, inserted = 0, optCount = 0;
    const stageWeightMap = new Map();

    for (const row of rows) {
      const canon = DOMAIN_NORM[row['Domain']] || row['Domain'];
      const dc = DOMAIN_CODE[canon];
      if (!dc) continue;
      const sdName = row['Sub-Domain'];
      if (!sdName) continue;
      const sc = subdomainMap.get(`${dc}::${sdName}`);
      if (!sc) continue;
      const question = row['Question (Self-Assessment)'];
      if (!question) continue;

      const stageCode   = STAGE_MAP[row['Stage']] || null;
      const ageBand     = (row['Age Band'] || '').replace(/\s+/g,'') || null;
      const concernName = row['Assessment name'] || null;
      const weight      = parseFloat(row['Wt']) || 1.0;
      const polarity    = row['Polarity'] || null;
      const focusArea   = row['Focus Area'] || null;
      const layerTag    = row['Layer (1-12)'] || null;
      const isAnchor    = row['Anchor']?.toLowerCase() === 'yes';
      const scoringType = normLogic(row['Logic']);

      const dedupKey = `${sc}::${question.substring(0, 80)}`;
      const existingId = itemIndex.get(dedupKey);

      if (existingId) {
        // UPDATE existing item with tag columns
        await client.query(`
          UPDATE sdi_items SET
            age_band=$1, stage_code=$2, concern_name=$3, weight=$4,
            polarity=$5, focus_area=$6, layer_tag=$7,
            item_type=$8, scoring_type=$9, updated_at=now()
          WHERE id=$10
        `, [ageBand, stageCode, concernName, weight, polarity, focusArea, layerTag,
            isAnchor ? 'anchor' : 'standard', scoringType, existingId]);
        updated++;
      } else {
        // INSERT new item (not seen before)
        const { rows: existSd } = await client.query('SELECT id FROM sdi_subdomains WHERE subdomain_code=$1', [sc]);
        if (existSd.length === 0) { notFound++; continue; }

        const { rows: [item] } = await client.query(`
          INSERT INTO sdi_items
            (subdomain_code, item_type, question, scoring_type, is_active,
             age_band, stage_code, concern_name, weight, polarity, focus_area, layer_tag)
          VALUES ($1,$2,$3,$4,true,$5,$6,$7,$8,$9,$10,$11) RETURNING id
        `, [sc, isAnchor ? 'anchor' : 'standard', question, scoringType,
            ageBand, stageCode, concernName, weight, polarity, focusArea, layerTag]);
        itemIndex.set(dedupKey, item.id);
        inserted++;

        const OPTION_COLS = ['A (1pt)', 'B (2pt)', 'C (3pt)', 'D (4pt)', 'E (5pt)'];
        for (let i = 0; i < OPTION_COLS.length; i++) {
          const text = row[OPTION_COLS[i]];
          if (text && text !== '-') {
            await client.query(
              `INSERT INTO sdi_item_options (item_id, text, score_value, display_order) VALUES ($1,$2,$3,$4)`,
              [item.id, text, i + 1, i]
            );
            optCount++;
          }
        }
      }

      // Stage weights
      if (stageCode) {
        const wtVal = Math.round(weight * 50) / 10;
        const wKey = `${stageCode}::${sc}`;
        stageWeightMap.set(wKey, Math.max(stageWeightMap.get(wKey) || 0, wtVal));
      }
    }

    // Upsert stage weights
    for (const [wKey, w] of stageWeightMap) {
      const [stageCode, subdomainCode] = wKey.split('::');
      await client.query(`
        INSERT INTO sdi_stage_weights (stage_code, subdomain_code, weight)
        VALUES ($1,$2,$3)
        ON CONFLICT (stage_code, subdomain_code) DO UPDATE
          SET weight=GREATEST(sdi_stage_weights.weight,EXCLUDED.weight)
      `, [stageCode, subdomainCode, w]);
    }

    await client.query('COMMIT');
    console.log('\n✓ Tag backfill complete');
    console.log(`  Updated:              ${updated}`);
    console.log(`  Newly inserted:       ${inserted} (options: ${optCount})`);
    console.log(`  Stage weights:        ${stageWeightMap.size}`);
    console.log(`  Not found/skipped:    ${notFound}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n✗ Failed:', err.message, err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
