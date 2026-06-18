/**
 * CAPADEX Assessment Item Import
 * Run from project root:  node backend/scripts/import_capadex_items.mjs
 */
import { readFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('pg');

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const TSV = 'attached_assets/Pasted-Assessment-name-Stage-Anchor-Domain-Sub-Domain-Dimensio_1777890183003.txt';

// ── Domain normalisation ─────────────────────────────────────────────────────
const DOMAIN_NORM = {
  'Behavioral':            'Behavioral',
  'Behav':                 'Behavioral',
  'Digital':               'Behavioral',
  'Physio':                'Behavioral',
  'Physiology':            'Behavioral',
  'Sensory':               'Cognitive Development',
  'Cognitive Development': 'Cognitive Development',
  'Metacog':               'Cognitive Development',
  'Emotional':             'Emotional',
  'Diagnostic':            'Diagnostic',
};

const DOMAIN_CODE = {
  'Cognitive Development': 'SDI_COG',
  'Behavioral':            'SDI_BEH',
  'Emotional':             'SDI_EMO',
  'Diagnostic':            'SDI_DGN',
};

const NEW_DOMAINS = [
  { domain_code:'SDI_BEH', domain_name:'Behavioral Intelligence',
    description:'Impulse control, executive function, sensory regulation and environmental adaptation',
    category:'Personal Development', display_order:19 },
  { domain_code:'SDI_DGN', domain_name:'Diagnostic Profiling',
    description:'Cross-domain attention diagnostics: chronotype, hyper-focus, task-switching and metacognitive patterns',
    category:'Academic', display_order:20 },
  { domain_code:'SDI_COG', domain_name:'Cognitive Development',
    description:'Sustained focus, working memory, processing speed and cognitive endurance',
    category:'Academic', display_order:21 },
  { domain_code:'SDI_EMO', domain_name:'Emotional Intelligence',
    description:'Anxiety regulation, self-concept, frustration tolerance and emotional resilience',
    category:'Personal Development', display_order:22 },
];

// ── CAPADEX stages ───────────────────────────────────────────────────────────
const STAGE_MAP = {
  'Curiosity': { stage_code:'CAP_CUR', stage_name:'Curiosity (5–14)',  min_grade:'1',  max_grade:'9',
                 description:'Early-childhood to mid-adolescent attention and focus awareness', display_order:10 },
  'Insight':   { stage_code:'CAP_INS', stage_name:'Insight (15–18)',   min_grade:'10', max_grade:'12',
                 description:'Meta-cognitive insight and executive strategy', display_order:11 },
  'Growth':    { stage_code:'CAP_GRW', stage_name:'Growth (11–18)',    min_grade:'6',  max_grade:'12',
                 description:'Cross-stage behavioural and cognitive growth', display_order:12 },
  'Mastery':   { stage_code:'CAP_MAS', stage_name:'Mastery (19+)',     min_grade:'13', max_grade:'16',
                 description:'Advanced attentional mastery and self-regulation', display_order:13 },
};

// ── Age band normalisation ───────────────────────────────────────────────────
function normAgeBand(raw) {
  const s = (raw || '').trim();
  if (!s) return null;
  // Normalise to clean label
  return s.replace(/\s+/g, '');
}

// ── Scoring type normalisation ───────────────────────────────────────────────
function normLogic(logic) {
  const l = (logic || '').trim().toLowerCase();
  if (l.includes('inverted'))                           return 'inverted';
  if (l.includes('linear') || l === '1=1, 5=5')        return 'standard';
  if (['yes=5, no=1','f=5, s=1','s=5, t=1'].includes(l)) return 'binary';
  if (['yes=1, no=5','1=5, 5+=1'].includes(l))          return 'binary_inverted';
  if (l.includes('neut') || l.includes('neutral'))      return 'neutral';
  if (l.includes('non-linear'))                         return 'non_linear';
  if (l.includes('scale'))                              return 'scaled';
  return 'standard';
}

// ── Slug helper ──────────────────────────────────────────────────────────────
function slug(s) {
  return s.trim().replace(/[^a-zA-Z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').toUpperCase().substring(0, 30);
}

// ── Parse TSV ────────────────────────────────────────────────────────────────
function parseTsv() {
  const lines = readFileSync(TSV, 'utf8').split('\n');
  const rawCols = lines[0].split('\t').map(c => c.trim());
  // Deduplicate columns (e.g. "Dimension" at idx 5 and 8, "Stage" at idx 1 and 20)
  const cols = [];
  const seen = {};
  for (const c of rawCols) {
    if (seen[c] !== undefined) { seen[c]++; cols.push(`${c}_${seen[c]}`); }
    else { seen[c] = 0; cols.push(c); }
  }
  console.log('Columns detected:', cols.join(' | '));

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

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const rows = parseTsv();
  console.log(`Parsed ${rows.length} data rows`);

  // Show stage distribution
  const stageDist = {};
  rows.forEach(r => { const s = r['Stage'] || 'unknown'; stageDist[s] = (stageDist[s]||0)+1; });
  console.log('Stage distribution:', JSON.stringify(stageDist));

  // Show age band distribution
  const ageDist = {};
  rows.forEach(r => { const a = r['Age Band'] || 'unknown'; ageDist[a] = (ageDist[a]||0)+1; });
  console.log('Age band distribution:', JSON.stringify(ageDist));

  const pool = new Pool({ connectionString: DB_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 0. Run tagging migration (idempotent)
    console.log('Ensuring tag columns exist...');
    await client.query(`ALTER TABLE sdi_items ADD COLUMN IF NOT EXISTS age_band    text`);
    await client.query(`ALTER TABLE sdi_items ADD COLUMN IF NOT EXISTS stage_code  text`);
    await client.query(`ALTER TABLE sdi_items ADD COLUMN IF NOT EXISTS concern_name text`);
    await client.query(`ALTER TABLE sdi_items ADD COLUMN IF NOT EXISTS weight      numeric DEFAULT 1.0`);
    await client.query(`ALTER TABLE sdi_items ADD COLUMN IF NOT EXISTS polarity    text`);
    await client.query(`ALTER TABLE sdi_items ADD COLUMN IF NOT EXISTS focus_area  text`);
    await client.query(`ALTER TABLE sdi_items ADD COLUMN IF NOT EXISTS layer_tag   text`);
    console.log('  Tag columns ready');

    // 1. Upsert all domains
    console.log('Upserting domains...');
    for (const d of NEW_DOMAINS) {
      await client.query(`
        INSERT INTO sdi_domains (domain_code, domain_name, description, category, display_order)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (domain_code) DO UPDATE
          SET domain_name=EXCLUDED.domain_name, description=EXCLUDED.description,
              category=EXCLUDED.category, display_order=EXCLUDED.display_order
      `, [d.domain_code, d.domain_name, d.description, d.category, d.display_order]);
    }
    console.log(`  ${NEW_DOMAINS.length} domains ready`);

    // 2. Upsert CAPADEX stages
    console.log('Upserting CAPADEX stages...');
    for (const s of Object.values(STAGE_MAP)) {
      await client.query(`
        INSERT INTO sdi_stages (stage_code, stage_name, min_grade, max_grade, description, display_order)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (stage_code) DO UPDATE
          SET stage_name=EXCLUDED.stage_name, description=EXCLUDED.description,
              min_grade=EXCLUDED.min_grade, max_grade=EXCLUDED.max_grade,
              display_order=EXCLUDED.display_order
      `, [s.stage_code, s.stage_name, s.min_grade, s.max_grade, s.description, s.display_order]);
    }
    console.log(`  ${Object.keys(STAGE_MAP).length} stages ready`);

    // 3. Collect unique (domain_code, subdomain_name) pairs
    console.log('Collecting subdomains...');
    const subdomainMap = new Map(); // key: "DC::SdName" → subdomain_code
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

    // Fetch existing subdomains
    const { rows: existingSd } = await client.query('SELECT subdomain_code FROM sdi_subdomains');
    const existingScSet = new Set(existingSd.map(r => r.subdomain_code));

    let newSdCount = 0;
    let idx = 100;
    for (const [mapKey, sc] of subdomainMap) {
      const [dc, sdName] = mapKey.split('::');
      if (!existingScSet.has(sc)) {
        await client.query(`
          INSERT INTO sdi_subdomains (domain_code, subdomain_code, subdomain_name, display_order)
          VALUES ($1,$2,$3,$4) ON CONFLICT (subdomain_code) DO NOTHING
        `, [dc, sc, sdName, idx++]);
        newSdCount++;
      }
    }
    console.log(`  ${subdomainMap.size} subdomains total, ${newSdCount} newly inserted`);

    // 4. Insert items + options + stage weights
    console.log('Inserting items and options...');
    const OPTION_COLS = ['A (1pt)', 'B (2pt)', 'C (3pt)', 'D (4pt)', 'E (5pt)'];

    // Fetch existing items to avoid duplicates
    const { rows: existingItems } = await client.query('SELECT subdomain_code, left(question,80) AS q FROM sdi_items');
    const existingItemSet = new Set(existingItems.map(r => `${r.subdomain_code}::${r.q}`));

    // Stage weight accumulator
    const stageWeightMap = new Map();

    let itemCount = 0, optionCount = 0, skipped = 0, domainSkip = 0;

    for (const row of rows) {
      const canon = DOMAIN_NORM[row['Domain']] || row['Domain'];
      const dc = DOMAIN_CODE[canon];
      if (!dc) { domainSkip++; skipped++; continue; }

      const sdName = row['Sub-Domain'];
      if (!sdName) { skipped++; continue; }

      const sc = subdomainMap.get(`${dc}::${sdName}`);
      if (!sc) { skipped++; continue; }

      const question = row['Question (Self-Assessment)'];
      if (!question) { skipped++; continue; }

      const dedupKey = `${sc}::${question.substring(0, 80)}`;
      if (existingItemSet.has(dedupKey)) { skipped++; continue; }
      existingItemSet.add(dedupKey);

      const isAnchor   = row['Anchor']?.toLowerCase() === 'yes';
      const scoringType = normLogic(row['Logic']);
      const ageBand    = normAgeBand(row['Age Band']);
      const stageRaw   = row['Stage'];
      const stageEntry = STAGE_MAP[stageRaw];
      const stageCode  = stageEntry?.stage_code || null;
      const concernName = row['Assessment name'] || null;
      const weight     = parseFloat(row['Wt']) || 1.0;
      const polarity   = row['Polarity'] || null;
      const focusArea  = row['Focus Area'] || null;
      const layerTag   = row['Layer (1-12)'] || null;

      const { rows: [item] } = await client.query(`
        INSERT INTO sdi_items
          (subdomain_code, item_type, question, scoring_type, is_active,
           age_band, stage_code, concern_name, weight, polarity, focus_area, layer_tag)
        VALUES ($1,$2,$3,$4,true,$5,$6,$7,$8,$9,$10,$11) RETURNING id
      `, [sc, isAnchor ? 'anchor' : 'standard', question, scoringType,
          ageBand, stageCode, concernName, weight, polarity, focusArea, layerTag]);
      itemCount++;

      // Options A–E
      for (let i = 0; i < OPTION_COLS.length; i++) {
        const text = row[OPTION_COLS[i]];
        if (text && text !== '-') {
          await client.query(`
            INSERT INTO sdi_item_options (item_id, text, score_value, display_order)
            VALUES ($1,$2,$3,$4)
          `, [item.id, text, i + 1, i]);
          optionCount++;
        }
      }

      // Accumulate stage weights
      if (stageCode) {
        const wtVal = Math.round(weight * 50) / 10;
        const wKey = `${stageCode}::${sc}`;
        stageWeightMap.set(wKey, Math.max(stageWeightMap.get(wKey) || 0, wtVal));
      }
    }

    // Upsert stage weights
    console.log(`Upserting ${stageWeightMap.size} stage weights...`);
    for (const [wKey, weight] of stageWeightMap) {
      const [stageCode, subdomainCode] = wKey.split('::');
      await client.query(`
        INSERT INTO sdi_stage_weights (stage_code, subdomain_code, weight)
        VALUES ($1,$2,$3)
        ON CONFLICT (stage_code, subdomain_code) DO UPDATE
          SET weight=GREATEST(sdi_stage_weights.weight,EXCLUDED.weight)
      `, [stageCode, subdomainCode, weight]);
    }

    await client.query('COMMIT');

    console.log('\n✓ Import complete');
    console.log(`  Items inserted:         ${itemCount}`);
    console.log(`  Options inserted:       ${optionCount}`);
    console.log(`  Stage weights upserted: ${stageWeightMap.size}`);
    console.log(`  Rows skipped:           ${skipped} (${domainSkip} unknown domain)`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n✗ Import failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
