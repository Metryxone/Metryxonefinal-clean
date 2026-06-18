// Generate detailed, context-aware answer options for `confidence`-type CAPADEX
// clarity questions that currently carry the bland generic
// "Very Low / Low / Moderate / High / Very High" scale.
//
// The scale is chosen from the question's "feeling word" (confident, hopeful,
// ready, prepared, emotionally stable/balanced, etc.) so each option reads
// naturally for that question. Only the option *text* (option_a..option_e) is
// rewritten — the *_score columns and ascending A->E intensity are preserved.
//
//   node scripts/generate-confidence-options.mjs            # dry-run -> CSV only
//   node scripts/generate-confidence-options.mjs --apply    # write to DB
//
// CSV review file: scripts/out/confidence-options-review.csv
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const APPLY = process.argv.includes('--apply');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Ascending 5-point scales (A = lowest intensity, E = highest), each keyed to a
// feeling dimension. Phrases pair an intensity label with a short lived clause.
const SCALES = {
  confident: [
    'Not confident at all — I really doubt I can',
    'Slightly confident — I have strong doubts',
    'Moderately confident — it could go either way',
    'Quite confident — I believe I can with effort',
    "Completely confident — I'm sure I can",
  ],
  hopeful: [
    "Not hopeful at all — I can't see it improving",
    'Slightly hopeful — but I have real doubts',
    'Moderately hopeful — it might improve',
    'Quite hopeful — I believe it can improve',
    "Very hopeful — I'm confident it will improve",
  ],
  ready: [
    "Not ready at all — I'd struggle to begin",
    "Slightly ready — I'd need much more",
    'Moderately ready — I could manage parts of it',
    "Mostly ready — I'd handle it with some effort",
    'Fully ready — I could begin right now',
  ],
  prepared: [
    "Not prepared at all — I'd struggle to begin",
    "Slightly prepared — I'd need much more",
    'Moderately prepared — I could manage parts of it',
    "Well prepared — I'd handle it with some effort",
    "Fully prepared — I'm ready right now",
  ],
  stable: [
    'Not stable at all — I feel easily shaken',
    'Slightly stable — I waver often',
    'Moderately stable — it varies a lot',
    'Mostly stable — I stay steady most times',
    'Very stable — I stay calm and grounded',
  ],
  balanced: [
    'Not balanced at all — I feel pulled apart',
    'Slightly balanced — I struggle often',
    'Moderately balanced — it varies a lot',
    'Mostly balanced — I manage it well',
    'Very balanced — I feel well in control',
  ],
  mentally: [
    "Not mentally ready at all — I'd struggle",
    "Slightly mentally ready — I'd need more",
    'Moderately mentally ready — it varies',
    "Mostly mentally ready — I'd cope well",
    "Fully mentally ready — I'm prepared",
  ],
  motivated: [
    "Not motivated at all — I'd give up quickly",
    'Slightly motivated — my drive fades fast',
    'Moderately motivated — it depends',
    "Quite motivated — I'd keep pushing",
    "Highly motivated — I'd stay fully driven",
  ],
  likely: [
    "Very unlikely — I almost certainly wouldn't",
    'Unlikely — probably not',
    'Possibly — it could go either way',
    'Likely — I probably would',
    'Very likely — I almost certainly would',
  ],
  clear: [
    'Not clear at all — I have no idea',
    'Slightly clear — mostly unsure',
    'Moderately clear — somewhat formed',
    'Mostly clear — fairly defined',
    'Completely clear — I know exactly',
  ],
  calm: [
    'Not calm at all — I feel very tense',
    'Slightly calm — often on edge',
    'Moderately calm — it varies',
    'Mostly calm — usually relaxed',
    'Completely calm — fully at ease',
  ],
  comfortable: [
    "Not comfortable at all — I'd avoid it",
    'Slightly comfortable — quite uneasy',
    'Moderately comfortable — it depends',
    'Mostly comfortable — generally at ease',
    'Completely comfortable — fully at ease',
  ],
  satisfied: [
    'Not satisfied at all — far from it',
    'Slightly satisfied — still lacking',
    "Moderately satisfied — it's okay",
    'Quite satisfied — mostly content',
    'Completely satisfied — fully content',
  ],
};

// Resolve the feeling dimension for a question. Prefers the word right after
// "how" (the actual scale dimension), then a priority keyword scan, then
// defaults to `confident` (these are all response_type='confidence').
export function detectFeeling(question) {
  const q = (question || '').toLowerCase();
  const anchor = q.match(/how\s+([a-z]+)/);
  const word = anchor ? anchor[1] : '';

  if (word === 'emotionally') return q.includes('balanced') ? 'balanced' : 'stable';
  if (word === 'mentally') return 'mentally';
  if (SCALES[word]) return word;
  if (word === 'confidently' || word === 'confidence') return 'confident';
  if (word === 'hope') return 'hopeful';
  if (word === 'motivation') return 'motivated';

  // keyword scan (priority order) for the 'how <non-feeling-word>' / no-how cases
  const order = ['confident', 'hopeful', 'prepared', 'ready', 'stable', 'balanced',
    'motivated', 'likely', 'clear', 'calm', 'comfortable', 'satisfied'];
  for (const k of order) {
    if (k === 'confident' && /confiden/.test(q)) return 'confident';
    if (k === 'hopeful' && /hope/.test(q)) return 'hopeful';
    if (k === 'motivated' && /motivat/.test(q)) return 'motivated';
    if (k === 'satisfied' && /satisf/.test(q)) return 'satisfied';
    if (k !== 'confident' && k !== 'hopeful' && k !== 'motivated' && k !== 'satisfied'
        && q.includes(k)) return k;
  }
  return 'confident';
}

export function optionsFor(question) {
  return SCALES[detectFeeling(question)];
}

function csvCell(s) {
  const v = String(s ?? '');
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

async function main() {
  const { rows } = await pool.query(
    `SELECT id, response_type, question, option_a, option_b, option_c, option_d, option_e
       FROM capadex_clarity_questions
      WHERE TRIM(option_a) ILIKE 'very low' AND TRIM(option_e) ILIKE 'very high'
        AND response_type = 'confidence'
      ORDER BY id`);

  const outDir = path.join(process.cwd(), 'scripts', 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const csvPath = path.join(outDir, 'confidence-options-review.csv');
  const header = ['id', 'feeling', 'question', 'new_a', 'new_b', 'new_c', 'new_d', 'new_e'];
  const lines = [header.join(',')];

  const dist = {};
  for (const r of rows) {
    const feeling = detectFeeling(r.question);
    dist[feeling] = (dist[feeling] || 0) + 1;
    const opts = SCALES[feeling];
    lines.push([r.id, feeling, r.question, ...opts].map(csvCell).join(','));
  }
  fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');

  console.log(`Rows: ${rows.length}`);
  console.log('Feeling distribution:', JSON.stringify(dist, null, 2));
  console.log(`Review CSV: ${csvPath}`);

  if (APPLY) {
    let n = 0;
    for (const r of rows) {
      const o = SCALES[detectFeeling(r.question)];
      await pool.query(
        `UPDATE capadex_clarity_questions
            SET option_a=$2, option_b=$3, option_c=$4, option_d=$5, option_e=$6
          WHERE id=$1`,
        [r.id, o[0], o[1], o[2], o[3], o[4]]);
      n++;
    }
    console.log(`APPLIED ${n} updates to DB.`);
  } else {
    console.log('Dry-run only — no DB writes. Re-run with --apply to commit.');
  }
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
