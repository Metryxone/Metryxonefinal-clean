// Generate detailed, context-aware answer options for ALL the bland generic
// templated scales across capadex_clarity_questions (frequency, intensity,
// agreement, situational_fit, readiness, coping_effectiveness, emotional_impact,
// energy_motivation, behavioral_consistency, social_comfort, difficulty, …).
//
// Confidence-type rows are handled separately by generate-confidence-options.mjs.
//
// Each row is classified ONLY when its current options exactly match a known
// generic template (by response_type + option signature) — genuinely bespoke,
// per-question option sets are left untouched (returns null -> skipped). Only the
// option *text* (option_a..option_e) is rewritten; *_score columns and the
// ascending A->E semantic order are preserved, so scoring is unaffected.
//
//   node scripts/generate-clarity-options.mjs            # dry-run -> CSV only
//   node scripts/generate-clarity-options.mjs --apply    # write to DB
//
// CSV review file: scripts/out/clarity-options-review.csv
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const APPLY = process.argv.includes('--apply');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const D = '\u2014'; // em dash

const FREQUENCY_OFTEN = [
  `Never ${D} it doesn't happen to me`,
  `Rarely ${D} only once in a while`,
  `Sometimes ${D} it happens on and off`,
  `Often ${D} it happens regularly`,
  `Very often ${D} it happens almost daily`,
];
const FREQUENCY_ALWAYS = [
  `Never ${D} it never happens`,
  `Rarely ${D} hardly ever`,
  `Sometimes ${D} now and then`,
  `Often ${D} most of the time`,
  `Always ${D} every single time`,
];
const INTENSITY_DEGREE = [
  `Not at all ${D} it doesn't affect me`,
  `Slightly ${D} just a little`,
  `Moderately ${D} to a fair degree`,
  `Strongly ${D} quite a lot`,
  `Extremely ${D} to a very high degree`,
];
const SPEED = [
  `Very slowly ${D} it takes me a long time`,
  `Slowly ${D} it takes a while`,
  `Moderately ${D} at an average pace`,
  `Quickly ${D} fairly fast`,
  `Very quickly ${D} almost immediately`,
];
const DIFFICULTY = [
  `Not difficult ${D} it's easy for me`,
  `Slightly difficult ${D} minor effort`,
  `Moderately difficult ${D} some struggle`,
  `Very difficult ${D} a real struggle`,
  `Extremely difficult ${D} almost impossible`,
];
const AGREEMENT = [
  `Strongly disagree ${D} not true for me at all`,
  `Disagree ${D} mostly not true for me`,
  `Neutral ${D} I'm unsure either way`,
  `Agree ${D} mostly true for me`,
  `Strongly agree ${D} very true for me`,
];
const SITUATIONAL_FIT = [
  `Not like me ${D} this doesn't describe me`,
  `Slightly like me ${D} rarely describes me`,
  `Somewhat like me ${D} sometimes describes me`,
  `Mostly like me ${D} usually describes me`,
  `Exactly like me ${D} this is just like me`,
];
const READINESS = [
  `Not ready at all ${D} I couldn't start now`,
  `Slightly ready ${D} I'd need a lot more`,
  `Moderately ready ${D} I could manage some of it`,
  `Mostly ready ${D} I'd handle it with effort`,
  `Fully ready ${D} I could start right now`,
];
const COPING = [
  `Very ineffective ${D} it doesn't help me`,
  `Ineffective ${D} it rarely helps`,
  `Neutral ${D} it helps a little`,
  `Effective ${D} it usually helps`,
  `Very effective ${D} it works well for me`,
];
const IMPACT = [
  `No impact ${D} it doesn't affect me`,
  `Mild impact ${D} a small effect`,
  `Moderate impact ${D} a noticeable effect`,
  `Major impact ${D} a strong effect`,
  `Severe impact ${D} it affects me deeply`,
];
const ENERGY = [
  `Completely drained ${D} no energy left`,
  `Low energy ${D} mostly depleted`,
  `Neutral ${D} neither drained nor energized`,
  `Energized ${D} motivated and active`,
  `Highly energized ${D} full of drive`,
];
const CONSISTENCY = [
  `Never true ${D} this is never the case`,
  `Rarely true ${D} only occasionally`,
  `Sometimes true ${D} it varies`,
  `Often true ${D} usually the case`,
  `Always true ${D} this is always the case`,
];
const SOCIAL_COMFORT = [
  `Very uncomfortable ${D} I'd really avoid it`,
  `Uncomfortable ${D} quite uneasy`,
  `Neutral ${D} neither at ease nor not`,
  `Comfortable ${D} generally at ease`,
  `Very comfortable ${D} fully at ease`,
];
const COMPLETENESS = [
  `Not at all ${D} none of it`,
  `Slightly ${D} a small part`,
  `Moderately ${D} about half`,
  `Mostly ${D} a large part`,
  `Completely ${D} all of it`,
];
const CLARITY = [
  `Not at all ${D} completely unclear`,
  `Slightly clear ${D} mostly unsure`,
  `Moderately clear ${D} partly formed`,
  `Mostly clear ${D} fairly defined`,
  `Very clearly ${D} I see it clearly`,
];
const LEVEL = [
  `Very low ${D} far below where I want it`,
  `Low ${D} below where I want it`,
  `Moderate ${D} somewhere in the middle`,
  `High ${D} above average for me`,
  `Very high ${D} well above average`,
];

// Classify a row's current options to a detailed scale, or null if it isn't a
// recognized generic template (then it's left untouched). Matched primarily by
// the option *signature* (option_a / option_e), so the same bland scale is
// caught regardless of which response_type it appears under.
export function classifyScale(rt, optA, optE) {
  const a = (optA || '').toLowerCase().trim();
  const e = (optE || '').toLowerCase().trim();
  if (a.includes(D)) return null; // already detailed

  if (a.startsWith('never true')) return CONSISTENCY;
  if (a.startsWith('never') && e.startsWith('always')) return FREQUENCY_ALWAYS;
  if (a.startsWith('never')) return FREQUENCY_OFTEN;
  if (a.startsWith('strongly disag')) return AGREEMENT;
  if (a.startsWith('not like me')) return SITUATIONAL_FIT;
  if (a.startsWith('not ready')) return READINESS;
  if (a.startsWith('very ineffective')) return COPING;
  if (a.startsWith('completely drain')) return ENERGY;
  if (a.startsWith('very uncomfort')) return SOCIAL_COMFORT;
  if (a.startsWith('very slow') || e.includes('quick')) return SPEED;
  if (a.includes('impact') || e.includes('impact')) return IMPACT;
  if (a.includes('difficult') || e.includes('difficult')) return DIFFICULTY;
  if (a.startsWith('very low') || (a.startsWith('low') && e.includes('high'))) return LEVEL;
  if (a.startsWith('not at all')) {
    if (e.includes('clear')) return CLARITY;
    if (e.includes('complete')) return COMPLETENESS;
    return INTENSITY_DEGREE;
  }
  return null;
}

function csvCell(s) {
  const v = String(s ?? '');
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

async function main() {
  const { rows } = await pool.query(
    `SELECT id, response_type, question, option_a, option_b, option_c, option_d, option_e
       FROM capadex_clarity_questions
      ORDER BY id`);

  const outDir = path.join(process.cwd(), 'scripts', 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const csvPath = path.join(outDir, 'clarity-options-review.csv');
  const lines = [['id', 'response_type', 'question', 'new_a', 'new_b', 'new_c', 'new_d', 'new_e'].join(',')];

  const dist = {};
  const targets = [];
  let skipped = 0;
  for (const r of rows) {
    const scale = classifyScale(r.response_type, r.option_a, r.option_e);
    if (!scale) { skipped++; continue; }
    dist[r.response_type] = (dist[r.response_type] || 0) + 1;
    targets.push({ id: r.id, scale });
    lines.push([r.id, r.response_type, r.question, ...scale].map(csvCell).join(','));
  }
  fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');

  console.log(`Total rows: ${rows.length}  |  will rewrite: ${targets.length}  |  left untouched: ${skipped}`);
  console.log('Rewrites by response_type:', JSON.stringify(dist, null, 2));
  console.log(`Review CSV: ${csvPath}`);

  if (APPLY) {
    let n = 0;
    for (const t of targets) {
      const o = t.scale;
      await pool.query(
        `UPDATE capadex_clarity_questions
            SET option_a=$2, option_b=$3, option_c=$4, option_d=$5, option_e=$6
          WHERE id=$1`,
        [t.id, o[0], o[1], o[2], o[3], o[4]]);
      n++;
    }
    console.log(`APPLIED ${n} updates to DB.`);
  } else {
    console.log('Dry-run only — no DB writes. Re-run with --apply to commit.');
  }
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
