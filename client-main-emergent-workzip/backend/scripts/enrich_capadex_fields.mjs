/**
 * enrich_capadex_fields.mjs
 * Parses the master CAPADEX TSV and enriches sdi_items + sdi_item_options
 * with: anchor, domain, sub_domain_name, dimension, logic, response_range,
 *       opt_a..opt_e labels, and corrects weight/polarity from the source.
 *
 * Usage: node backend/scripts/enrich_capadex_fields.mjs
 */

import fs   from 'fs';
import path from 'path';
import pg   from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TSV_PATH  = path.resolve(__dirname, '../../attached_assets/Pasted-Assessment-name-Stage-Anchor-Domain-Sub-Domain-Dimensio_1777894859545.txt');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ── Column indices (0-based) ─────────────────────────────────────────────────
const C = {
  concern_name:  0,
  stage_label:   1,
  anchor:        2,   // "Yes" | "No"
  domain:        3,
  sub_domain:    4,
  dimension:     5,
  focus_area:    6,
  layer_tag:     7,
  dim2:          8,   // duplicate Dimension column (readable label)
  question:      9,
  response_range:10,
  opt_a:         11,
  opt_b:         12,
  opt_c:         13,
  opt_d:         14,
  opt_e:         15,
  polarity:      16,
  weight:        17,
  logic:         18,
  age_band:      19,
};

// Stage label → stage_code map
const STAGE_MAP = {
  'Curiosity': 'CAP_CUR',
  'Insight':   'CAP_INS',
  'Growth':    'CAP_GRW',
  'Mastery':   'CAP_MAS',
};

function parseRows(tsvContent) {
  const lines = tsvContent.split('\n');
  const rows  = [];
  for (let i = 1; i < lines.length; i++) {         // skip header
    const cols = lines[i].split('\t');
    if (cols.length < 20) continue;
    const q = cols[C.question]?.trim();
    if (!q || q === 'Question (Self-Assessment)') continue;
    rows.push(cols);
  }
  return rows;
}

// Score-value override from option label for Yes/No and special-logic items
function buildOptionUpdates(cols) {
  // opts come as [A(1pt), B(2pt), C(3pt), D(4pt), E(5pt)]
  return [
    { label: cols[C.opt_a]?.trim() || null, score: 1 },
    { label: cols[C.opt_b]?.trim() || null, score: 2 },
    { label: cols[C.opt_c]?.trim() || null, score: 3 },
    { label: cols[C.opt_d]?.trim() || null, score: 4 },
    { label: cols[C.opt_e]?.trim() || null, score: 5 },
  ].filter(o => o.label && o.label !== '-' && o.label !== '');
}

async function main() {
  const content = fs.readFileSync(TSV_PATH, 'utf8');
  const rows    = parseRows(content);
  console.log(`Parsed ${rows.length} rows from TSV`);

  let updated = 0;
  let notFound = 0;
  const missing = [];

  for (const cols of rows) {
    const question       = cols[C.question]?.trim();
    const concern_name   = cols[C.concern_name]?.trim();
    const stage_code     = STAGE_MAP[cols[C.stage_label]?.trim()] || null;
    const anchor         = cols[C.anchor]?.trim().toLowerCase() === 'yes';
    const domain         = cols[C.domain]?.trim() || null;
    const sub_domain_name= cols[C.sub_domain]?.trim() || null;
    const dimension      = cols[C.dimension]?.trim() || null;
    const focus_area     = cols[C.focus_area]?.trim() || null;
    const layer_tag      = cols[C.layer_tag]?.trim() || null;
    const response_range = cols[C.response_range]?.trim() || null;
    const opt_a          = cols[C.opt_a]?.trim() || null;
    const opt_b          = cols[C.opt_b]?.trim() || null;
    const opt_c          = cols[C.opt_c]?.trim() || null;
    const opt_d          = cols[C.opt_d]?.trim() || null;
    const opt_e          = cols[C.opt_e]?.trim() || null;
    const polarity       = cols[C.polarity]?.trim() || null;
    const weight_raw     = cols[C.weight]?.trim();
    const weight         = weight_raw && !isNaN(parseFloat(weight_raw)) ? parseFloat(weight_raw) : null;
    const logic          = cols[C.logic]?.trim() || null;
    const age_band       = cols[C.age_band]?.trim() || null;

    // Match by question text (case-insensitive), concern, stage
    const { rows: found } = await pool.query(
      `SELECT id FROM sdi_items
       WHERE LOWER(TRIM(question)) = LOWER($1)
         AND LOWER(TRIM(concern_name)) = LOWER($2)
         AND stage_code = $3
       LIMIT 1`,
      [question, concern_name, stage_code]
    );

    // Fallback: match by question + concern only (stage may differ)
    let itemId = found[0]?.id;
    if (!itemId) {
      const { rows: fb } = await pool.query(
        `SELECT id FROM sdi_items
         WHERE LOWER(TRIM(question)) = LOWER($1)
           AND LOWER(TRIM(concern_name)) = LOWER($2)
         LIMIT 1`,
        [question, concern_name]
      );
      itemId = fb[0]?.id;
    }

    // Final fallback: question text only
    if (!itemId) {
      const { rows: fb2 } = await pool.query(
        `SELECT id FROM sdi_items WHERE LOWER(TRIM(question)) = LOWER($1) LIMIT 1`,
        [question]
      );
      itemId = fb2[0]?.id;
    }

    if (!itemId) {
      notFound++;
      missing.push({ concern_name, stage_code, question: question.substring(0, 60) });
      continue;
    }

    // Update sdi_items with all enriched fields
    await pool.query(
      `UPDATE sdi_items SET
        anchor          = $1,
        domain          = $2,
        sub_domain_name = $3,
        dimension       = $4,
        focus_area      = COALESCE($5, focus_area),
        layer_tag       = COALESCE($6, layer_tag),
        response_range  = $7,
        opt_a           = $8,
        opt_b           = $9,
        opt_c           = $10,
        opt_d           = $11,
        opt_e           = $12,
        polarity        = COALESCE($13, polarity),
        weight          = COALESCE($14, weight),
        logic           = $15,
        age_band        = COALESCE($16, age_band),
        updated_at      = now()
       WHERE id = $17`,
      [
        anchor, domain, sub_domain_name, dimension,
        focus_area, layer_tag,
        response_range,
        opt_a !== '-' ? opt_a : null,
        opt_b !== '-' ? opt_b : null,
        opt_c !== '-' ? opt_c : null,
        opt_d !== '-' ? opt_d : null,
        opt_e !== '-' ? opt_e : null,
        polarity, weight, logic, age_band,
        itemId,
      ]
    );

    // Update sdi_item_options labels from spreadsheet
    const optUpdates = buildOptionUpdates(cols);
    for (const opt of optUpdates) {
      await pool.query(
        `UPDATE sdi_item_options
         SET text = $1
         WHERE item_id = $2 AND score_value = $3`,
        [opt.label, itemId, opt.score]
      );
    }

    updated++;
  }

  console.log(`\n✅ Updated : ${updated} items`);
  console.log(`⚠️  Not found: ${notFound} items`);
  if (missing.length > 0) {
    console.log('\nMissing items (first 20):');
    missing.slice(0, 20).forEach(m =>
      console.log(`  [${m.stage_code}] ${m.concern_name} — "${m.question}"`)
    );
  }

  // Summary of what's now populated
  const { rows: summary } = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(anchor::text)       AS has_anchor,
      COUNT(domain)             AS has_domain,
      COUNT(sub_domain_name)    AS has_sub_domain,
      COUNT(dimension)          AS has_dimension,
      COUNT(logic)              AS has_logic,
      COUNT(response_range)     AS has_response_range,
      COUNT(opt_a)              AS has_opt_a
    FROM sdi_items
    WHERE stage_code IS NOT NULL
  `);
  console.log('\nDB field coverage (CAPADEX items only):');
  console.log(summary[0]);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
